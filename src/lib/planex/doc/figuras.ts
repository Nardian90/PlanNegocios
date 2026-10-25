// ============================================================================
// PLANEX — Figuras del informe (misión DOC-002 §9).
//
// Las figuras se generan desde los MISMOS datos que alimentan el documento
// (ComputedModel del motor) como PRIMITIVAS vectoriales compartidas:
//   · El PDF las dibuja con las primitivas vectoriales de jsPDF (nada de
//     imágenes rasterizadas ni servicios externos).
//   · El DOCX las rasteriza a PNG con un codificador PNG PROPIO (zlib vía
//     fflate, ya presente como dependencia de jsPDF): sin CDN, sin canvas,
//     sin recursos remotos que puedan desaparecer.
//   · El gráfico en sí NO lleva texto dentro (título, leyenda, unidades y
//     nota se componen como TEXTO del documento en ambos formatos): las
//     cifras, los ejes y las líneas son idénticos en PDF y Word.
//
// Cada figura aporta información que las tablas no transmiten con igual
// claridad: evolución de resultados, cruce de cero de los flujos acumulados
// (recuperación simple) y utilización verificable de los recursos compartidos.
// No se incluyen gráficos decorativos ni escenarios no modelados.
// ============================================================================

import { PlanexProject, ComputedModel } from '../types';
import { fmtPct, fmtK, fmtNum } from '../format';

// ---------------------------------------------------------------------------
// Primitivas (coordenadas de datos)
// ---------------------------------------------------------------------------

export type PrimitivaFigura =
  | { t: 'linea'; x1: number; y1: number; x2: number; y2: number; color: string; grosor: number; punteada?: boolean }
  | { t: 'polilinea'; puntos: Array<[number, number]>; color: string; grosor: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; color: string; rellena?: boolean; borde?: string };

export interface FiguraDoc {
  /** Clave estable de la figura ('evolucion' | 'flujos' | 'utilizacion'). */
  clave: 'evolucion' | 'flujos' | 'utilizacion';
  /** Número de figura asignado por el constructor en orden de aparición. */
  numero: number;
  /** Título visible de la figura (encima, estilo APA: «Figura N. Título»). */
  titulo: string;
  /** Unidad del eje vertical (p. ej. «Miles de CUP (kCUP)» o «%»). */
  unidad: string;
  /** Etiquetas del eje X (p. ej. «Años del horizonte (0–10)»). */
  ejeX: string;
  leyenda: { etiqueta: string; color: string }[];
  /** Nota de fuente y supuestos (debajo, estilo APA). */
  nota: string;
  /** Rango de datos: [xMin, xMax, yMin, yMax]. */
  ejes: { xMin: number; xMax: number; yMin: number; yMax: number };
  /** Rejilla del eje vertical con ETIQUETAS NUMÉRICAS (DOC-002-R1 §7):
   *  valores «bonitos» (múltiplos redondos) dentro del rango, uno por línea
   *  de rejilla dibujada; renderizadores y etiquetas usan la MISMA lista. */
  marcasY: { y: number; etiqueta: string }[];
  /** Marcas del eje horizontal con el Año (DOC-002-R1 §7): una por año del
   *  rango (paso > 1 cuando el horizonte es muy largo para evitar solapes). */
  marcasX: { x: number; etiqueta: string }[];
  primitivas: PrimitivaFigura[];
}

export const COLORES_FIGURAS = {
  ingresos: '#2563eb',
  costos: '#b91c1c',
  utilidad: '#15803d',
  fcff: '#1d4ed8',
  fcfe: '#b45309',
  umbral: '#64748b',
  eje: '#94a3b8',
  relleno: '#e2e8f0',
};

// ---------------------------------------------------------------------------
// Generación desde el modelo
// ---------------------------------------------------------------------------

function redondearEje(v: number, max: number): number {
  const abs = Math.abs(max) || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(abs)));
  const paso = mag <= 0 ? 1 : mag;
  // Techo «bonito»: múltiplos del orden de magnitud con margen del 5 %
  return Math.ceil((v * 1.05) / (paso / 2)) * (paso / 2);
}

// ---------------------------------------------------------------------------
// Ejes con etiquetas numéricas (misión DOC-002-R1 §7)
// ---------------------------------------------------------------------------

/** Paso «bonito» para la rejilla del eje Y: de la escala 1/2/2,5/5/10 se
 *  elige el valor MÁS CERCANO al objetivo (distancia logarítmica), de modo
 *  que la rejilla conserve ~4-7 líneas incluso cuando el objetivo cae justo
 *  por encima de un peldaño (p. ej. 1,1 × 10^n → 1 × 10^n, no 2 × 10^n). */
function pasoBonito(rango: number): number {
  const abs = Math.abs(rango) || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(abs)));
  const norm = abs / mag;
  let mejor = 1;
  let mejorDist = Infinity;
  for (const peldaño of [1, 2, 2.5, 5, 10]) {
    const dist = Math.abs(Math.log(norm / peldaño));
    if (dist < mejorDist) {
      mejorDist = dist;
      mejor = peldaño;
    }
  }
  return mejor * mag;
}

/** Rejilla del eje vertical: múltiplos redondos DENTRO del rango, con su
 *  etiqueta numérica formateada (es-ES agrupado; 1 decimal si el paso < 1
 *  para que las etiquetas no colisionen). Renderizadores y etiquetas usan
 *  esta MISMA lista: cada línea de rejilla lleva su cifra. */
export function rejillaY(ejes: { yMin: number; yMax: number }, esPorcentaje: boolean): { y: number; etiqueta: string }[] {
  const paso = pasoBonito((ejes.yMax - ejes.yMin) / 5);
  // Primer múltiplo DENTRO del rango (ceil: nunca por debajo de yMin) y último
  // que no supere yMax: toda línea etiquetada cae dentro del área trazada.
  const inicio = Math.ceil(ejes.yMin / paso - 1e-9) * paso;
  const fin = Math.floor(ejes.yMax / paso + 1e-9) * paso;
  const salida: { y: number; etiqueta: string }[] = [];
  for (let v = inicio; v <= fin + paso * 1e-6; v += paso) {
    const redondeado = Math.round(v * 1e6) / 1e6;
    const cifra = paso < 1 ? fmtK(redondeado) : fmtNum(redondeado);
    salida.push({ y: redondeado, etiqueta: esPorcentaje ? `${cifra} %` : cifra });
  }
  return salida;
}

/** Marcas del eje horizontal: una por año del rango; paso > 1 cuando el
 *  horizonte es tan largo que etiquetar cada año solaparía las cifras. */
export function marcasAnios(xMin: number, xMax: number): { x: number; etiqueta: string }[] {
  const span = Math.max(1, xMax - xMin);
  const paso = Math.max(1, Math.ceil(span / 12));
  const salida: { x: number; etiqueta: string }[] = [];
  for (let x = Math.ceil(xMin / paso) * paso; x <= xMax + 1e-9; x += paso) {
    salida.push({ x, etiqueta: String(Math.round(x)) });
  }
  return salida;
}

/** Genera las figuras del informe desde el modelo activo y la moneda de
 *  presentación (los importes del motor en kUSD se convierten con kUSDaK). */
export function generarFiguras(
  p: PlanexProject,
  m: ComputedModel,
  conv: { kUSDaK: (k: number) => number; unidadTabla: string; unidadCorta: string },
  maxFiguras?: { evolucion?: boolean; flujos?: boolean; utilizacion?: boolean }
): FiguraDoc[] {
  const N = p.ajustes.horizonteAnios;
  const years = m.years.filter((t) => t >= 1);
  const figuras: FiguraDoc[] = [];
  const convK = conv.kUSDaK;

  // ------------------------------------------------- Figura: evolución de resultados
  if (maxFiguras?.evolucion !== false && years.length > 1) {
    const ing = years.map((t) => convK(m.indicadores.ingresosTotales[t] ?? 0));
    const cos = years.map((t) => convK(m.valores['costos_totales_k']?.[t] ?? 0));
    const udi = years.map((t) => convK(m.indicadores.utilidadNeta[t] ?? 0));
    const maxV = Math.max(...ing, ...cos, ...udi, 0);
    const minV = Math.min(...ing, ...cos, ...udi, 0);
    const ejes = { xMin: 1, xMax: N, yMin: Math.min(0, minV), yMax: redondearEje(maxV, maxV) };
    figuras.push({
      clave: 'evolucion',
      numero: 0,
      titulo: 'Evolución de ingresos, costos y utilidad durante el horizonte',
      unidad: conv.unidadTabla,
      ejeX: `Años de operación (1–${N})`,
      leyenda: [
        { etiqueta: 'Ingresos totales', color: COLORES_FIGURAS.ingresos },
        { etiqueta: 'Costos y gastos totales', color: COLORES_FIGURAS.costos },
        { etiqueta: 'Utilidad después de impuestos', color: COLORES_FIGURAS.utilidad },
      ],
      nota: `Fuente: modelo de cálculo activo (estado de resultados, años 1–${N}). Importes en ${conv.unidadTabla.toLowerCase()}; cantidades limitadas por la capacidad del escenario activo. Los valores de cada año corresponden a las mismas cifras de la tabla «Proyección de ingresos, costos y utilidades» del apartado 4.7.`,
      ejes,
      marcasY: rejillaY(ejes, false),
      marcasX: marcasAnios(ejes.xMin, ejes.xMax),
      primitivas: [
        { t: 'polilinea', puntos: years.map((t, i) => [t, ing[i]]), color: COLORES_FIGURAS.ingresos, grosor: 2 },
        { t: 'polilinea', puntos: years.map((t, i) => [t, cos[i]]), color: COLORES_FIGURAS.costos, grosor: 2 },
        { t: 'polilinea', puntos: years.map((t, i) => [t, udi[i]]), color: COLORES_FIGURAS.utilidad, grosor: 2 },
      ],
    });
  }

  // ------------------------------------------------- Figura: flujos acumulados
  if (maxFiguras?.flujos !== false && m.indicadores.fcffAcumulado) {
    const acumP = m.years.map((t) => convK(m.indicadores.fcffAcumulado[t] ?? 0));
    const acumS = m.years.map((t) => convK(m.indicadores.fcfeAcumulado[t] ?? 0));
    const maxV = Math.max(...acumP, ...acumS, 0);
    const minV = Math.min(...acumP, ...acumS, 0);
    const recP = m.indicadores.recuperacionProyecto;
    const recS = m.indicadores.recuperacionSocios;
    const primitivas: PrimitivaFigura[] = [
      { t: 'linea', x1: 0, y1: 0, x2: N, y2: 0, color: COLORES_FIGURAS.umbral, grosor: 1, punteada: true },
      { t: 'polilinea', puntos: m.years.map((t, i) => [t, acumP[i]]), color: COLORES_FIGURAS.fcff, grosor: 2 },
      { t: 'polilinea', puntos: m.years.map((t, i) => [t, acumS[i]]), color: COLORES_FIGURAS.fcfe, grosor: 2 },
    ];
    // Marcadores del cruce de cero (recuperación simple, sin descontar).
    for (const rec of [recP, recS]) {
      if (rec.anios !== null && !rec.indeterminado) {
        primitivas.push({ t: 'linea', x1: rec.anios, y1: minV, x2: rec.anios, y2: 0, color: rec.indicador === 'proyecto' ? COLORES_FIGURAS.fcff : COLORES_FIGURAS.fcfe, grosor: 1, punteada: true });
      }
    }
    const ejes = { xMin: 0, xMax: N, yMin: Math.min(0, minV), yMax: redondearEje(maxV, maxV) };
    figuras.push({
      clave: 'flujos',
      numero: 0,
      titulo: 'Flujo acumulado del proyecto (FCFF) y del capital de los socios (FCFE), con cruce de cero',
      unidad: conv.unidadTabla,
      ejeX: `Años del análisis (0–${N}); el cruce del eje horizontal marca la recuperación simple`,
      leyenda: [
        { etiqueta: `Flujo acumulado del proyecto (FCFF)${recP.anios !== null ? ` — cruce en ${recP.anios.toFixed(1).replace('.', ',')} años` : ''}`, color: COLORES_FIGURAS.fcff },
        { etiqueta: `Flujo acumulado de los socios (FCFE)${recS.anios !== null ? ` — cruce en ${recS.anios.toFixed(1).replace('.', ',')} años` : ''}`, color: COLORES_FIGURAS.fcfe },
        { etiqueta: 'Cero (recuperación simple, sin descontar)', color: COLORES_FIGURAS.umbral },
      ],
      nota: `Fuente: modelo de cálculo activo (flujos de caja, años 0–${N}). Importes en ${conv.unidadTabla.toLowerCase()}. Las verticales punteadas señalan los cruces de cero del acumulado (recuperación simple, sin descontar, por interpolación lineal intranual); el FCFF reincorpora el interés después de impuestos y el FCFE restituye su escudo fiscal.`,
      ejes,
      marcasY: rejillaY(ejes, false),
      marcasX: marcasAnios(ejes.xMin, ejes.xMax),
      primitivas,
    });
  }

  // ------------------------------------------------- Figura: utilización de recursos
  if (maxFiguras?.utilizacion !== false && m.recursosCalculados.length > 0) {
    const umbral = Math.min(1, Math.max(0.01, p.parametros.find((x) => x.id === 'umbral_utilizacion_capacidad')?.valor ?? 0.9));
    const primitivas: PrimitivaFigura[] = [
      { t: 'linea', x1: 1, y1: umbral * 100, x2: N, y2: umbral * 100, color: COLORES_FIGURAS.umbral, grosor: 1, punteada: true },
    ];
    const paleta = ['#0f766e', '#7c3aed', '#be185d', '#4d7c0f', '#b45309', '#0369a1'];
    const leyenda: { etiqueta: string; color: string }[] = [
      { etiqueta: `Umbral de referencia (${fmtPct(umbral, 0)})`, color: COLORES_FIGURAS.umbral },
    ];
    let maxUtil = umbral * 100;
    m.recursosCalculados.forEach((r, i) => {
      const color = paleta[i % paleta.length];
      const puntos: Array<[number, number]> = years.map((t) => [t, (r.utilizacion[t] ?? 0) * 100]);
      maxUtil = Math.max(maxUtil, ...puntos.map(([, y]) => y));
      primitivas.push({ t: 'polilinea', puntos, color, grosor: 2 });
      leyenda.push({ etiqueta: r.nombre, color });
    });
    figuras.push({
      clave: 'utilizacion',
      numero: 0,
      titulo: 'Utilización de los recursos operativos por año (horas-mes demandadas ÷ horas-mes disponibles)',
      unidad: '% de utilización',
      ejeX: `Años de operación (1–${N})`,
      leyenda,
      nota: `Fuente: modelo de cálculo activo (capacidad del escenario activo, años 1–${N}). La utilización de cada recurso y año se reproduce como horas-mes demandadas divididas por horas-mes disponibles (tabla de utilización del apartado 4.6); el umbral de referencia es un parámetro de análisis, no un límite técnico.`,
      ejes: { xMin: 1, xMax: N, yMin: 0, yMax: redondearEje(maxUtil, maxUtil) },
      marcasY: rejillaY({ yMin: 0, yMax: redondearEje(maxUtil, maxUtil) }, true),
      marcasX: marcasAnios(1, N),
      primitivas,
    });
  }

  return figuras;
}

// ---------------------------------------------------------------------------
// Rasterizador PNG (para DOCX) — codificador PNG propio con fflate
// ---------------------------------------------------------------------------

import { zlibSync } from 'fflate';

/** CRC-32 (PNG) — tabla estándar. */
const TABLA_CRC: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunkPNG(tipo: string, datos: Uint8Array): Uint8Array {
  const salida = new Uint8Array(12 + datos.length);
  const vista = new DataView(salida.buffer);
  vista.setUint32(0, datos.length);
  for (let i = 0; i < 4; i++) salida[4 + i] = tipo.charCodeAt(i);
  salida.set(datos, 8);
  vista.setUint32(8 + datos.length, crc32(salida.subarray(4, 8 + datos.length)));
  return salida;
}

function hexArgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

interface Lienzo {
  ancho: number;
  alto: number;
  px: Uint8Array; // RGB, 3 bytes por píxel
}

function pintar(lienzo: Lienzo, x: number, y: number, color: string) {
  if (x < 0 || y < 0 || x >= lienzo.ancho || y >= lienzo.alto) return;
  const [r, g, b] = hexArgb(color);
  const i = (y * lienzo.ancho + x) * 3;
  lienzo.px[i] = r;
  lienzo.px[i + 1] = g;
  lienzo.px[i + 2] = b;
}

function pintarLinea(lienzo: Lienzo, x1: number, y1: number, x2: number, y2: number, color: string, grosor: number, punteada?: boolean) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let x = x1;
  let y = y1;
  let paso = 0;
  const medio = Math.floor(grosor / 2);
  const marcar = !punteada || paso % 6 < 4; // trazo 4 px, hueco 2 px
  for (;;) {
    if (!punteada || paso % 6 < 4) {
      for (let gy = 0; gy < grosor; gy++) {
        for (let gx = 0; gx < grosor; gx++) {
          pintar(lienzo, x + gx - medio, y + gy - medio, color);
        }
      }
    }
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    paso++;
  }
  void marcar;
}

/** Fuente bitmap 5×7 (DOC-002-R1 §7): glifos necesarios para las etiquetas
 *  de los ejes (dígitos, signo menos, separadores es-ES, porcentaje y
 *  espacio). Cada glifo son 7 filas de 5 píxeles, codificadas en bits. */
const FUENTE_5X7: Record<string, number[]> = {
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x06, 0x06],
  ',': [0x00, 0x00, 0x00, 0x00, 0x06, 0x06, 0x0c],
  '%': [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
};

/** Dibuja texto con la fuente bitmap 5×7 (escala entera ≥ 1). Devuelve el
 *  ancho ocupado en píxeles. Alineación: 'fin' termina en xFin, 'centro'
 *  centra, 'inicio' empieza en x. */
function pintarTexto(lienzo: Lienzo, texto: string, x: number, y: number, color: string, escala: number, alineado: 'inicio' | 'centro' | 'fin' = 'inicio'): number {
  const chars = [...texto];
  const anchoTotal = chars.length * 6 * escala - escala;
  let x0 = x;
  if (alineado === 'centro') x0 = x - anchoTotal / 2;
  else if (alineado === 'fin') x0 = x - anchoTotal;
  x0 = Math.round(x0);
  const y0 = Math.round(y);
  chars.forEach((ch, i) => {
    const glifo = FUENTE_5X7[ch];
    if (!glifo) return;
    for (let fila = 0; fila < 7; fila++) {
      const bits = glifo[fila];
      for (let col = 0; col < 5; col++) {
        if (bits & (1 << (4 - col))) {
          for (let sy = 0; sy < escala; sy++) {
            for (let sx = 0; sx < escala; sx++) {
              pintar(lienzo, x0 + i * 6 * escala + col * escala + sx, y0 + fila * escala + sy, color);
            }
          }
        }
      }
    }
  });
  return anchoTotal;
}

/** Ancho estimado (px) de un texto con la fuente bitmap. */
function anchoTexto(texto: string, escala: number): number {
  return [...texto].length * 6 * escala - escala;
}

/** Rasteriza una figura a PNG (RGB sin alfa, fondo blanco). */
export function rasterizarPNG(figura: FiguraDoc, opts?: { ancho?: number; alto?: number; escala?: number }): { png: Uint8Array; ancho: number; alto: number } {
  const ancho = opts?.ancho ?? 640;
  const alto = opts?.alto ?? 320;
  const lienzo: Lienzo = { ancho, alto, px: new Uint8Array(ancho * alto * 3).fill(255) };

  const { xMin, xMax, yMin, yMax } = figura.ejes;
  const escala = Math.max(1, opts?.escala ?? 1);
  // Márgenes adaptativos: las etiquetas numéricas del eje vertical (izquierda)
  // y las marcas de años (abajo) necesitan espacio FUERA del área de trazado.
  const padSup = 12;
  const padDer = 12;
  const padInf = 12 /* eje */ + 7 * escala /* año */ + 6;
  const etiquetaMasLarga = figura.marcasY.reduce((m, x) => Math.max(m, x.etiqueta.length), 0);
  const padIzq = 8 + anchoTexto('0'.repeat(etiquetaMasLarga), escala) + 8;
  const pxX = (x: number) => padIzq + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * (ancho - padIzq - padDer);
  const pxY = (y: number) => alto - padInf - ((y - yMin) / Math.max(1e-9, yMax - yMin)) * (alto - padSup - padInf);

  // Rejilla horizontal: las MISMAS líneas «bonitas» que llevan etiqueta.
  for (const marca of figura.marcasY) {
    pintarLinea(lienzo, padIzq, Math.round(pxY(marca.y)), ancho - padDer, Math.round(pxY(marca.y)), '#eef2f7', 1);
  }
  // Ejes
  pintarLinea(lienzo, padIzq, padSup, padIzq, alto - padInf, COLORES_FIGURAS.eje, 1);
  pintarLinea(lienzo, padIzq, alto - padInf, ancho - padDer, alto - padInf, COLORES_FIGURAS.eje, 1);
  if (yMin < 0 && yMax > 0) pintarLinea(lienzo, padIzq, Math.round(pxY(0)), ancho - padDer, Math.round(pxY(0)), '#cbd5e1', 1);

  // Etiquetas numéricas del eje vertical y ticks (DOC-002-R1 §7)
  const colorEje = '#64748b';
  for (const marca of figura.marcasY) {
    const y = Math.round(pxY(marca.y));
    pintarLinea(lienzo, padIzq - 4, y, padIzq, y, COLORES_FIGURAS.eje, 1);
    pintarTexto(lienzo, marca.etiqueta, padIzq - 6, y - Math.round(3.5 * escala) + 1, colorEje, escala, 'fin');
  }
  // Marcas de años del eje horizontal y ticks
  for (const marca of figura.marcasX) {
    const x = Math.round(pxX(marca.x));
    pintarLinea(lienzo, x, alto - padInf, x, alto - padInf + 4, COLORES_FIGURAS.eje, 1);
    pintarTexto(lienzo, marca.etiqueta, x, alto - padInf + 6, colorEje, escala, 'centro');
  }

  for (const pr of figura.primitivas) {
    if (pr.t === 'linea') {
      pintarLinea(lienzo, Math.round(pxX(pr.x1)), Math.round(pxY(pr.y1)), Math.round(pxX(pr.x2)), Math.round(pxY(pr.y2)), pr.color, Math.max(1, Math.round(pr.grosor)), pr.punteada);
    } else if (pr.t === 'polilinea') {
      for (let i = 1; i < pr.puntos.length; i++) {
        const [x1, y1] = pr.puntos[i - 1];
        const [x2, y2] = pr.puntos[i];
        pintarLinea(lienzo, Math.round(pxX(x1)), Math.round(pxY(y1)), Math.round(pxX(x2)), Math.round(pxY(y2)), pr.color, Math.max(1, Math.round(pr.grosor)));
      }
    } else if (pr.t === 'rect') {
      const xA = Math.round(pxX(pr.x));
      const yA = Math.round(pxY(pr.y + pr.h));
      const w = Math.round(pxX(pr.x + pr.w) - pxX(pr.x));
      const h = Math.round(pxY(pr.y) - pxY(pr.y + pr.h));
      for (let yy = yA; yy < yA + h; yy++) {
        for (let xx = xA; xx < xA + w; xx++) {
          pintar(lienzo, xx, yy, pr.rellena ? pr.color : (pr.borde ?? pr.color));
        }
      }
    }
  }

  // PNG: IHDR + IDAT + IEND
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, ancho);
  v.setUint32(4, alto);
  ihdr[8] = 8; // profundidad de bits
  ihdr[9] = 2; // color type: RGB
  // Scanlines con byte de filtro 0
  const crudos = new Uint8Array((ancho * 3 + 1) * alto);
  for (let y = 0; y < alto; y++) {
    crudos[y * (ancho * 3 + 1)] = 0;
    crudos.set(lienzo.px.subarray(y * ancho * 3, (y + 1) * ancho * 3), y * (ancho * 3 + 1) + 1);
  }
  const idat = zlibSync(crudos, { level: 6 });
  const partes = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunkPNG('IHDR', ihdr),
    chunkPNG('IDAT', idat),
    chunkPNG('IEND', new Uint8Array(0)),
  ];
  const total = partes.reduce((s, p) => s + p.length, 0);
  const png = new Uint8Array(total);
  let off = 0;
  for (const parte of partes) {
    png.set(parte, off);
    off += parte.length;
  }
  return { png, ancho, alto };
}
