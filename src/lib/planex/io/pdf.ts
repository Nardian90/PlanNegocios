// ============================================================================
// Exportador PDF — renderer del MODELO DOCUMENTAL CANÓNICO (misión
// PLANEX-DOC-001 §3.2, §6; revisado por PLANEX-DOC-002 §3).
//
// El contenido (texto, tablas, importes, análisis, avisos, figuras) NO se
// define aquí: proviene de doc/construir.ts, la misma fuente que consumen el
// visor de previsualización y el exportador DOCX. Este archivo solo decide la
// COMPOSICIÓN sobre papel A4:
//
//   · Portada profesional + cifras clave de portada.
//   · Índice con numeración REAL de páginas (doble pasada).
//   · Encabezado por sección y pies de página numerados.
//   · Cuerpo narrativo JUSTIFICADO (convención editorial de PLANEX; no un
//     requisito de APA 7), con interlineado estable — §3.1 DOC-002.
//   · Subtítulos en FLUJO (nunca encabezados absolutos: el defecto de
//     superposición de 4.1 quedó corregido de raíz) — §3.2 DOC-002.
//   · Texto WinAnsi-seguro vía doc/texto.ts: fórmulas y caracteres nunca se
//     corrompen — §3.3 DOC-002.
//   · Tablas con encabezados repetidos (autoTable, showHead everyPage),
//     primera columna de conceptos más ancha y cifras alineadas.
//   · Figuras vectoriales dibujadas con las primitivas de jsPDF desde los
//     mismos datos del modelo — §9 DOC-002 (sin imágenes ni CDN).
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PlanexProject, ComputedModel, MonedaPresentacion } from '../types';
import { construirDocumentoPlanex, OpcionesDocumento } from '../doc/construir';
import { DocumentoPlanex, ElementoDoc, etiquetaAnalisis } from '../doc/modelo';
import { monedaPresentacionDe } from '../doc/moneda';
import { asegurarTexto } from '../doc/texto';
import { FiguraDoc } from '../doc/figuras';

const M = 14; // margen mm
const ANCHO = 210;
const ALTO = 297;
const ZONA_PIE = 20; // reservado para el pie (línea + numeración)

function T(texto: string | null | undefined): string {
  return asegurarTexto(texto);
}

function hexARgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** ¿Es una tabla «muy ancha» que el PDF debe componer en página APAISADA
 *  (como hace Word) para no cortar palabras? (misión §3.2/§8) */
function esTablaApaisada(el: Extract<ElementoDoc, { tipo: 'tabla' }>): boolean {
  return !!el.tabla.ancha && el.tabla.encabezados.length >= 10;
}

function encabezadoPagina(doc: jsPDF, titulo: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(T(titulo), M, 20);
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.4);
  doc.line(M, 23, ANCHO - M, 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
}

/** Párrafo narrativo JUSTIFICADO (§3.1): cuerpo alineado a ambos márgenes
 *  como convención editorial de PLANEX; los títulos, etiquetas y celdas NO
 *  pasan por aquí. La última línea queda alineación natural de jsPDF. */
function parrafo(
  doc: jsPDF,
  texto: string,
  opts?: { startY?: number; size?: number; italica?: boolean; justificado?: boolean }
): number {
  let y = opts?.startY ?? 30;
  const limpio = T(texto);
  if (!limpio) return y;
  const justificado = opts?.justificado ?? true;
  doc.setFont('helvetica', opts?.italica ? 'italic' : 'normal');
  doc.setFontSize(opts?.size ?? 9);
  doc.setTextColor(51, 65, 85);
  const ancho = ANCHO - 2 * M;
  const lineas = doc.splitTextToSize(limpio, ancho);
  const interlineado = (opts?.size ?? 9) * 0.48;
  for (const linea of lineas) {
    if (y > ALTO - ZONA_PIE - 4) {
      doc.addPage();
      y = 22;
    }
    const esFinal = linea === lineas[lineas.length - 1];
    if (justificado && !esFinal) {
      doc.text(linea, M, y, { maxWidth: ancho, align: 'justify' });
    } else {
      doc.text(linea, M, y);
    }
    y += interlineado;
  }
  return y + 2.6;
}

function bloqueAviso(doc: jsPDF, texto: string, y: number): number {
  doc.setFillColor(255, 243, 205);
  doc.setDrawColor(217, 119, 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14);
  const limpio = T(texto);
  const lineas = doc.splitTextToSize(limpio, ANCHO - 2 * M - 8);
  const alto = Math.max(16, lineas.length * 3.6 + 8);
  let yy = y;
  if (yy > ALTO - alto - ZONA_PIE - 2) {
    doc.addPage();
    yy = 22;
  }
  doc.rect(M, yy + 2, ANCHO - 2 * M, alto, 'FD');
  doc.text(lineas, M + 4, yy + 8);
  return yy + alto + 7;
}

/** Anchos por CONTENIDO: la primera columna (conceptos) recibe espacio
 *  proporcional al texto real y las numéricas solo lo que necesitan: evita
 *  palabras partidas y columnas ilegibles (misión §3.2). */
function pesosColumnas(head: string[][], body: string[][]): number[] {
  const n = head[0]?.length ?? 1;
  const pesos: number[] = [];
  for (let i = 0; i < n; i++) {
    let maxL = Math.max(4, (head[0][i] ?? '').length);
    for (const f of body) maxL = Math.max(maxL, (f[i] ?? '').length);
    // Raíz del largo máximo: suaviza extremos sin columnas gigantes.
    const base = Math.sqrt(maxL);
    pesos.push(i === 0 ? Math.max(base * 2.4, 7) : Math.max(base * 1.15, 3.4));
  }
  return pesos;
}

/** Tabla con anchos por contenido (§3.2: legibilidad, sin palabras partidas). */
function tabla(
  doc: jsPDF,
  titulo: string,
  _numero: number | undefined,
  startY: number,
  head: string[][],
  body: string[][],
  opts?: { size?: number; anchoUtil?: number; altoUtil?: number }
) {
  const anchoUtil = opts?.anchoUtil ?? ANCHO - 2 * M;
  const altoUtil = opts?.altoUtil ?? ALTO;
  let y = startY;
  const tituloCompleto = T(titulo);
  if (titulo) {
    if (y > altoUtil - 52) {
      // Evita títulos de tabla huérfanos al final de página (§3.2)
      doc.addPage();
      y = 22;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const lineas = doc.splitTextToSize(tituloCompleto, anchoUtil);
    doc.text(lineas, M, y);
    y += 4.5 * lineas.length + 1;
  }
  const nCols = head[0]?.length ?? 1;
  const headLimpio = head.map((fila) => fila.map((c) => T(c)));
  const bodyLimpio = body.map((f) => f.map((c) => T(c === null ? '' : c)));
  const pesos = pesosColumnas(headLimpio, bodyLimpio);
  const sumaPesos = pesos.reduce((s, p) => s + p, 0);
  const columnStyles: Record<number, { halign: 'left' | 'right'; cellWidth: number }> = {};
  for (let i = 0; i < nCols; i++) {
    columnStyles[i] = { halign: i === 0 ? 'left' : 'right', cellWidth: (anchoUtil * pesos[i]) / sumaPesos };
  }
  autoTable(doc, {
    head: headLimpio,
    body: bodyLimpio,
    startY: y,
    margin: { left: M, right: M, top: 18, bottom: ZONA_PIE },
    styles: { font: 'helvetica', fontSize: opts?.size ?? 7, cellPadding: 1.4, overflow: 'linebreak', textColor: [51, 65, 85], lineColor: [203, 213, 225], lineWidth: 0.1 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: opts?.size ?? 7, halign: 'center', fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 246, 249] },
    columnStyles,
    showHead: 'everyPage',
    theme: 'grid',
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
}

/** Dibuja una figura del modelo con primitivas vectoriales (§9): mismos
 *  datos que las tablas; sin imágenes rasterizadas ni recursos remotos.
 *  (DOC-002-R1 §7) Los ejes llevan ETIQUETAS NUMÉRICAS: rejilla con valores
 *  «bonitos» rotulados a la izquierda y marcas de año bajo el eje horizontal. */
function dibujarFigura(doc: jsPDF, f: FiguraDoc, y0: number): number {
  const altoFig = 76;
  let y = y0;
  if (y > ALTO - altoFig - ZONA_PIE - 24) {
    doc.addPage();
    y = 22;
  }
  // Título (estilo APA): el rótulo «Figura N.» ya viene en el título del modelo.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  const lineas = doc.splitTextToSize(T(f.titulo), ANCHO - 2 * M);
  doc.text(lineas, M, y);
  y += 4.5 * lineas.length + 2;

  // Margen izquierdo adaptativo: la etiqueta Y más larga cabe completa (§7).
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  const anchoEtiquetaY = f.marcasY.reduce((m, x) => Math.max(m, doc.getTextDimensions(T(x.etiqueta)).w), 0);
  const izq = M + 4 + anchoEtiquetaY + 2;
  const der = ANCHO - M - 4;
  const abajo = y + altoFig;
  const { xMin, xMax, yMin, yMax } = f.ejes;
  const px = (x: number) => izq + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * (der - izq);
  const py = (v: number) => abajo - ((v - yMin) / Math.max(1e-9, yMax - yMin)) * (altoFig - 6);

  // Rejilla horizontal: las MISMAS líneas «bonitas» que llevan etiqueta (§7)
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.15);
  for (const marca of f.marcasY) {
    doc.line(izq, py(marca.y), der, py(marca.y));
  }
  // Ejes
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(izq, y + 2, izq, abajo);
  doc.line(izq, abajo, der, abajo);
  if (yMin < 0 && yMax > 0) {
    doc.setDrawColor(203, 213, 225);
    doc.line(izq, py(0), der, py(0));
  }

  // Etiquetas numéricas del eje vertical + ticks (DOC-002-R1 §7)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  for (const marca of f.marcasY) {
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.4);
    doc.line(izq - 1.1, py(marca.y), izq, py(marca.y));
    doc.text(T(marca.etiqueta), izq - 1.5, py(marca.y) + 1.1, { align: 'right' });
  }
  // Marcas de años del eje horizontal + ticks
  for (const marca of f.marcasX) {
    doc.line(px(marca.x), abajo, px(marca.x), abajo + 1.1);
    doc.text(T(marca.etiqueta), px(marca.x), abajo + 3.6, { align: 'center' });
  }

  const trazo = (color: string, grosor: number) => {
    const [r, g, b] = hexARgb(color);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(grosor);
  };
  for (const pr of f.primitivas) {
    if (pr.t === 'linea') {
      trazo(pr.color, pr.grosor);
      doc.setLineDashPattern(pr.punteada ? [1.6, 1.4] : [], 0);
      doc.line(px(pr.x1), py(pr.y1), px(pr.x2), py(pr.y2));
      doc.setLineDashPattern([], 0);
    } else if (pr.t === 'polilinea') {
      trazo(pr.color, pr.grosor);
      for (let i = 1; i < pr.puntos.length; i++) {
        const [x1, y1] = pr.puntos[i - 1];
        const [x2, y2] = pr.puntos[i];
        doc.line(px(x1), py(y1), px(x2), py(y2));
      }
    } else if (pr.t === 'rect') {
      const [r, g, b] = hexARgb(pr.color);
      doc.setFillColor(r, g, b);
      doc.rect(px(pr.x), py(pr.y + pr.h), px(pr.x + pr.w) - px(pr.x), py(pr.y) - py(pr.y + pr.h), pr.rellena ? 'F' : 'S');
    }
  }

  let yFin = abajo + 6;
  // Leyenda con muestras de color (texto del documento, no dentro del gráfico)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  for (const item of f.leyenda) {
    if (yFin > ALTO - ZONA_PIE - 6) {
      doc.addPage();
      yFin = 22;
    }
    const [r, g, b] = hexARgb(item.color);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(1.2);
    doc.line(M, yFin - 1, M + 5, yFin - 1);
    doc.setTextColor(71, 85, 105);
    doc.text(T(item.etiqueta), M + 7, yFin);
    yFin += 3.6;
  }
  // Unidades y nota (APA)
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.text(T(`Unidades del eje vertical: ${f.unidad}. Eje horizontal: ${f.ejeX}.`), M, yFin + 1);
  yFin += 4.5;
  const notaLineas = doc.splitTextToSize(T(`Nota. ${f.nota}`), ANCHO - 2 * M);
  for (const linea of notaLineas) {
    if (yFin > ALTO - ZONA_PIE - 4) {
      doc.addPage();
      yFin = 22;
    }
    doc.text(linea, M, yFin);
    yFin += 3.4;
  }
  return yFin + 5;
}

/** Renderiza un elemento del modelo canónico; devuelve el nuevo cursor Y. */
function renderElemento(doc: jsPDF, el: ElementoDoc, y: number): number {
  switch (el.tipo) {
    case 'parrafo':
      return parrafo(doc, el.texto, { startY: y, size: el.pequeno ? (el.italica ? 8 : 7.5) : el.italica ? 9 : 9, italica: el.italica });
    case 'campos': {
      // Etiquetas en negrita y valores en flujo: nunca posicionamiento
      // absoluto (§3.2) y con separación vertical suficiente (§3.4).
      let yy = y;
      for (const item of el.items) {
        if (yy > ALTO - ZONA_PIE - 18) {
          doc.addPage();
          yy = 22;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(T(`${item.etiqueta}:`), M, yy);
        yy += 4.6;
        const valor = T(item.valor) || '—';
        yy = parrafo(doc, valor, { startY: yy, size: 8.7, justificado: false });
        yy += 1.2;
      }
      return yy;
    }
    case 'subtitulo': {
      // §3.2: subtítulo EN FLUJO, no como encabezado absoluto de página.
      let yy = y;
      if (yy > ALTO - ZONA_PIE - 26) {
        doc.addPage();
        yy = 22;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      const lineas = doc.splitTextToSize(T(el.texto), ANCHO - 2 * M);
      doc.text(lineas, M, yy);
      yy += 5 * lineas.length;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(M, yy - 2.2, ANCHO - M, yy - 2.2);
      return yy + 2.5;
    }
    case 'tabla': {
      const size = el.tabla.ancha ? 6 : 7.5;
      return tabla(doc, el.tabla.titulo ?? '', el.tabla.numero, y, [el.tabla.encabezados], el.tabla.filas.map((f) => f.map((c) => (c === null ? '' : c))), { size });
    }
    case 'analisis': {
      let yy = y;
      if (yy > ALTO - ZONA_PIE - 30) {
        doc.addPage();
        yy = 22;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(120, 81, 40);
      doc.text(T(el.bloque.titulo), M, yy);
      yy += 4;
      doc.setFontSize(7);
      if (el.bloque.estado === 'desactualizado') doc.setTextColor(185, 28, 28);
      else doc.setTextColor(140, 100, 40);
      doc.text(T(etiquetaAnalisis(el.bloque.estado)), M, yy);
      yy += 2;
      return parrafo(doc, el.bloque.texto, { startY: yy + 3, size: 8 });
    }
    case 'aviso':
      return bloqueAviso(doc, el.texto, y);
    case 'figura':
      return dibujarFigura(doc, el.figura, y);
  }
}

function construirDesdeModelo(
  documento: DocumentoPlanex,
  opciones?: { registrar?: Record<string, number>; paginasSecciones?: Record<string, number> }
): { doc: jsPDF } {
  const registrar = opciones?.registrar;
  const paginasSecciones = opciones?.paginasSecciones;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
  const meta = documento.meta;

  // ============================================================ Portada
  doc.setFillColor(51, 65, 85);
  doc.rect(0, 0, ANCHO, 52, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(T(documento.portada.titulo), ANCHO / 2, 24, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(T(documento.portada.subtitulo), ANCHO / 2, 34, { align: 'center' });
  doc.setFontSize(9);
  doc.text(T(documento.portada.marca), ANCHO / 2, 43, { align: 'center' });
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  const nombreProyecto = T(documento.portada.nombreProyecto);
  const lineasNP = doc.splitTextToSize(nombreProyecto, ANCHO - 2 * M - 20);
  doc.text(lineasNP, M, 76);
  let y = 76 + lineasNP.length * 6.4 + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (documento.portada.denominacion) {
    const lineasDen = doc.splitTextToSize(T(documento.portada.denominacion), ANCHO - 2 * M - 20);
    doc.text(lineasDen, M, y);
    y += lineasDen.length * 4.6 + 4;
  }
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  let primera = true;
  for (const cifra of documento.portada.cifras) {
    y = parrafo(doc, `${T(cifra.etiqueta)}: ${T(cifra.valor)}`, { startY: primera ? y + 4 : y, size: 10, justificado: false });
    primera = false;
  }
  if (documento.portada.avisoDemo) {
    y = bloqueAviso(doc, documento.portada.avisoDemo, y + 2);
  }
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  doc.text(
    T(
      `Generado localmente por PLANEX Cuba el ${new Date().toLocaleString('es-ES')}. Cifras y análisis provienen del modelo de cálculo activo (misma versión para tablas, resumen, conclusiones y exportaciones).`
    ),
    M,
    ALTO - 16
  );
  doc.addPage();

  // ============================================================ Índice
  if (paginasSecciones) {
    encabezadoPagina(doc, 'Índice');
    let ty = 32;
    doc.setFontSize(9);
    for (const seccion of documento.secciones) {
      if (!seccion.enIndice) continue;
      const pag = paginasSecciones[seccion.titulo];
      if (pag === undefined) continue;
      if (ty > ALTO - ZONA_PIE - 8) {
        doc.addPage();
        encabezadoPagina(doc, 'Índice (continuación)');
        ty = 32;
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(T(seccion.titulo), M, ty);
      doc.setFont('helvetica', 'bold');
      doc.text(String(pag), ANCHO - M, ty, { align: 'right' });
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.1);
      doc.line(M + doc.getTextDimensions(T(seccion.titulo)).w + 2, ty - 1, ANCHO - M - 6, ty - 1);
      ty += 6.5;
    }
    doc.addPage();
  }

  // ============================================================ Secciones
  // (las tablas MUY anchas se componen en páginas APAISADAS dedicadas,
  //  como en Word: sin palabras partidas ni columnas ilegibles)
  for (let i = 0; i < documento.secciones.length; i++) {
    const seccion = documento.secciones[i];
    const esPrimera = i === 0;
    if (!esPrimera && seccion.paginaNueva) {
      doc.addPage();
    }
    if (registrar) registrar[seccion.titulo] = doc.getCurrentPageInfo().pageNumber;
    encabezadoPagina(doc, seccion.titulo);
    let y = 30;
    let k = 0;
    while (k < seccion.elementos.length) {
      const el = seccion.elementos[k];
      if (el.tipo === 'tabla' && esTablaApaisada(el)) {
        // Abre UNA página apaisada y vuelca en ella TODAS las tablas anchas
        // consecutivas (grupo), con sus títulos.
        doc.addPage([ALTO, ANCHO], 'landscape');
        let yy = 20;
        while (k < seccion.elementos.length && seccion.elementos[k].tipo === 'tabla') {
          const t = seccion.elementos[k] as Extract<ElementoDoc, { tipo: 'tabla' }>;
          yy = tabla(doc, t.tabla.titulo ?? '', t.tabla.numero, yy, [t.tabla.encabezados], t.tabla.filas.map((f) => f.map((c) => (c === null ? '' : c))), { size: 6, anchoUtil: ALTO - 2 * M, altoUtil: ANCHO });
          k++;
        }
        doc.addPage([ANCHO, ALTO], 'portrait');
        y = 30; // el contenido siguiente continúa en página vertical nueva
        continue;
      }
      y = renderElemento(doc, el, y);
      k++;
    }
  }

  // ============================================================ Pies de página
  // (adaptados al tamaño/orientación de CADA página: retrato y apaisada)
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    const anchoPag = doc.internal.pageSize.getWidth();
    const altoPag = doc.internal.pageSize.getHeight();
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(M, altoPag - 14, anchoPag - M, altoPag - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('PLANEX Cuba — Plan de Negocios (GOC-2026-O57)', M, altoPag - 9);
    doc.text(`Página ${i} de ${total}`, anchoPag - M, altoPag - 9, { align: 'right' });
    if (meta.esDemo) doc.text('EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS', anchoPag / 2, altoPag - 9, { align: 'center' });
  }
  return { doc };
}

/** Genera el PDF con índice paginado (doble pasada) desde el modelo canónico. */
export function exportarPDF(
  proyecto: PlanexProject,
  modelo: ComputedModel,
  opciones?: OpcionesDocumento
): { datos: Blob; nombre: string; documento: DocumentoPlanex } {
  const documento = construirDocumentoPlanex(proyecto, modelo, opciones);

  // Pasada 1: registrar en qué página empieza cada sección (sin índice).
  const registro: Record<string, number> = {};
  construirDesdeModelo(documento, { registrar: registro });
  const enIndice = documento.secciones.filter((s) => s.enIndice).length;
  const paginasIndice = Math.max(1, Math.ceil(enIndice / 34));
  const paginasAjustadas = Object.fromEntries(
    Object.entries(registro).map(([k, v]) => [k, v + paginasIndice])
  );
  // Pasada 2: documento final con índice y numeración coherente.
  const { doc } = construirDesdeModelo(documento, { paginasSecciones: paginasAjustadas });
  const datos = doc.output('blob');
  const sufijo = documento.meta.moneda === 'CUP' ? ' CUP' : ' USD';
  const nombre = `${T((documento.meta.nombreProyecto || proyecto.nombre).slice(0, 40))}${sufijo}.pdf`;
  return { datos, nombre, documento };
}

/** Versión de solo texto plano del documento (índices de pruebas E2E). */
export { construirDocumentoPlanex };
