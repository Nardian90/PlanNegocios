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
import { fmtPct } from '../format';

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
      ejes: { xMin: 1, xMax: N, yMin: Math.min(0, minV), yMax: redondearEje(maxV, maxV) },
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
      ejes: { xMin: 0, xMax: N, yMin: Math.min(0, minV), yMax: redondearEje(maxV, maxV) },
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

/** Rasteriza una figura a PNG (RGB sin alfa, fondo blanco). */
export function rasterizarPNG(figura: FiguraDoc, opts?: { ancho?: number; alto?: number; escala?: number }): { png: Uint8Array; ancho: number; alto: number } {
  const ancho = opts?.ancho ?? 640;
  const alto = opts?.alto ?? 320;
  const lienzo: Lienzo = { ancho, alto, px: new Uint8Array(ancho * alto * 3).fill(255) };

  const { xMin, xMax, yMin, yMax } = figura.ejes;
  const pad = 26;
  const pxX = (x: number) => pad + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * (ancho - 2 * pad);
  const pxY = (y: number) => alto - pad - ((y - yMin) / Math.max(1e-9, yMax - yMin)) * (alto - 2 * pad);

  // Rejilla horizontal (5 líneas) y ejes
  for (let i = 0; i <= 5; i++) {
    const y = yMin + ((yMax - yMin) * i) / 5;
    pintarLinea(lienzo, pad, Math.round(pxY(y)), ancho - pad, Math.round(pxY(y)), '#eef2f7', 1);
  }
  // Ejes
  pintarLinea(lienzo, pad, pad, pad, alto - pad, COLORES_FIGURAS.eje, 1);
  pintarLinea(lienzo, pad, alto - pad, ancho - pad, alto - pad, COLORES_FIGURAS.eje, 1);
  if (yMin < 0 && yMax > 0) pintarLinea(lienzo, pad, Math.round(pxY(0)), ancho - pad, Math.round(pxY(0)), '#cbd5e1', 1);

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
