#!/usr/bin/env python3
"""
PLANEX Cuba — generador de activos rasterizados del icono (misión UX-002 §3).

Reproduce EXACTAMENTE la geometría de public/icon.svg (viewBox 64x64):
  · Squircle (2,2,60,60) rx 14, degradado diagonal #1E293B → #115E59.
  · Filo interior sutil blanco 16 % (1.5 de grosor).
  · Documento (17,11,30,42) rx 4.5, trazo blanco #F1F5F9 de 4.
  · Barras (24,35,5,10) #94A3B8 · (31,28,5,17) #E2E8F0 · (38,21,5,24) #2DD4BF.

Renderiza a 1024 px (supermuestreo) y reduce con LANCZOS a cada tamaño final:
  public/icon-512.png · public/icon-192.png · public/apple-touch-icon.png (180)
  public/favicon.ico (16 + 32 + 48 embebidos)

Uso:  python3 scripts/generar-icono-planex.py [ruta_raiz_del_repo]
"""
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageOps

RAIZ = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..")
PUBLIC = os.path.join(RAIZ, "public")

# Geometría en coordenadas del viewBox 64x64 (fuente única: public/icon.svg).
FONDO = (2, 2, 60, 60)
RX_FONDO = 14
FILO = (3, 3, 58, 58)
RX_FILO = 13
GROSO_FILO = 1.5
DOC = (17, 11, 30, 42)
RX_DOC = 4.5
GROSO_DOC = 4.0
BARRAS = [
    ((24, 35, 5, 10), (148, 163, 184, 255)),   # #94A3B8
    ((31, 28, 5, 17), (226, 232, 240, 255)),    # #E2E8F0
    ((38, 21, 5, 24), (45, 212, 191, 255)),    # #2DD4BF
]
INICIO = (30, 41, 59, 255)   # #1E293B
FIN = (17, 94, 89, 255)      # #115E59
BLANCO_DOC = (241, 245, 249, 255)   # #F1F5F9
FILO_COLOR = (248, 250, 252, int(255 * 0.16))  # #F8FAFC al 16 %


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(4))


def redondear(dibujo, caja, radio, **kw):
    """rounded_rectangle con compatibilidad de firmas de Pillow."""
    try:
        dibujo.rounded_rectangle(caja, radius=radio, **kw)
    except AttributeError:  # Pillow muy antiguo
        dibujo.rectangle(caja, **kw)


def renderizar(tam: int, cuadrado_completo: bool = False) -> Image.Image:
    """Renderiza el icono a un lienzo cuadrado de `tam` px (supermuestreado).

    `cuadrado_completo` rellena todo el lienzo (sin esquinas redondeadas ni
    margen): es la forma correcta para apple-touch-icon, donde iOS recorta
    las esquinas por sí mismo y castiga la transparencia con fondo negro.
    """
    sup = 1024
    s = sup / 64.0
    img = Image.new("RGBA", (sup, sup), (0, 0, 0, 0))

    # 1) Degradado DIAGONAL pizarra → verde azulado: promedio de un degradado
    #    vertical y uno horizontal (mismo criterio que x1=0 y1=0 x2=1 y2=1 del SVG).
    vertical = Image.linear_gradient("L")          # 256×256, 0→255 de arriba abajo
    horizontal = vertical.rotate(-90, expand=True)  # 0→255 de izquierda a derecha
    diagonal = ImageChops.add(vertical, horizontal, scale=2)
    grad = ImageOps.colorize(diagonal.resize((sup, sup)), black=INICIO[:3], white=FIN[:3]).convert("RGBA")

    if cuadrado_completo:
        img.paste(grad, (0, 0))
    else:
        # Máscara del squircle.
        mascara = Image.new("L", (sup, sup), 0)
        md = ImageDraw.Draw(mascara)
        redondear(md, [FONDO[0] * s, FONDO[1] * s, (FONDO[0] + FONDO[2]) * s, (FONDO[1] + FONDO[3]) * s], RX_FONDO * s, fill=255)
        img.paste(grad, (0, 0), mascara)

    d = ImageDraw.Draw(img)

    # 2) Filo interior sutil (para pestañas oscuras).
    redondear(
        d,
        [FILO[0] * s, FILO[1] * s, (FILO[0] + FILO[2]) * s, (FILO[1] + FILO[3]) * s],
        RX_FILO * s,
        outline=FILO_COLOR,
        width=max(1, int(GROSO_FILO * s)),
    )

    # 3) El documento (trazo centrado en la trayectoria, como en SVG).
    doc = [DOC[0] * s, DOC[1] * s, (DOC[0] + DOC[2]) * s, (DOC[1] + DOC[3]) * s]
    medio = GROSO_DOC * s / 2
    redondear(
        d,
        [doc[0] + medio, doc[1] + medio, doc[2] - medio, doc[3] - medio],
        RX_DOC * s,
        outline=BLANCO_DOC,
        width=int(GROSO_DOC * s),
    )

    # 4) Barras ascendentes.
    for caja, color in BARRAS:
        redondear(
            d,
            [caja[0] * s, caja[1] * s, (caja[0] + caja[2]) * s, (caja[1] + caja[3]) * s],
            1.6 * s,
            fill=color,
        )

    return img.resize((tam, tam), Image.LANCZOS)


def main() -> None:
    os.makedirs(PUBLIC, exist_ok=True)
    base = renderizar(1024)

    icono512 = base.resize((512, 512), Image.LANCZOS)
    icono512.save(os.path.join(PUBLIC, "icon-512.png"))
    icono192 = base.resize((192, 192), Image.LANCZOS)
    icono192.save(os.path.join(PUBLIC, "icon-192.png"))
    # Apple exige opaco y a sangre completa (iOS recorta las esquinas solo).
    apple = renderizar(1024, cuadrado_completo=True).resize((180, 180), Image.LANCZOS)
    apple.save(os.path.join(PUBLIC, "apple-touch-icon.png"))

    # ICO multipágina: 48 (mejor calidad para accesos directos), 32, 16.
    base.resize((48, 48), Image.LANCZOS).save(
        os.path.join(PUBLIC, "favicon.ico"),
        format="ICO",
        append_images=[base.resize((32, 32), Image.LANCZOS), base.resize((16, 16), Image.LANCZOS)],
    )

    print("OK: public/icon-512.png, icon-192.png, apple-touch-icon.png (180, opaco) y favicon.ico (16/32/48)")


if __name__ == "__main__":
    main()
