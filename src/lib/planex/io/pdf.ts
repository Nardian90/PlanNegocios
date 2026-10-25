// ============================================================================
// Exportador PDF — renderer del MODELO DOCUMENTAL CANÓNICO (misión
// PLANEX-DOC-001 §3.2, §6).
//
// El contenido (texto, tablas, importes, análisis, avisos) NO se define aquí:
// proviene de doc/construir.ts, la misma fuente que consumen el visor de
// previsualización y el exportador DOCX. Este archivo solo decide la
// COMPOSICIÓN sobre papel A4:
//
//   · Portada profesional + cifras clave de portada.
//   · Índice con numeración REAL de páginas (doble pasada).
//   · Encabezado por sección y pies de página numerados.
//   · Tablas con encabezados repetidos (autoTable, showHead everyPage),
//     textos desbordados controlados y saltos de página verificados en la
//     misión AUDIT-001 (sin páginas en blanco ni filas cortadas).
//
// La moneda de presentación llega ya resuelta dentro del modelo; este
// renderer es agnóstico de la moneda.
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PlanexProject, ComputedModel, MonedaPresentacion } from '../types';
import { construirDocumentoPlanex, OpcionesDocumento } from '../doc/construir';
import { DocumentoPlanex, ElementoDoc, SeccionDoc, etiquetaAnalisis } from '../doc/modelo';
import { monedaPresentacionDe } from '../doc/moneda';

const M = 14; // margen mm
const ANCHO = 210;
const ALTO = 297;

function encabezadoPagina(doc: jsPDF, titulo: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(titulo, M, 20);
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.4);
  doc.line(M, 23, ANCHO - M, 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
}

function parrafo(doc: jsPDF, texto: string, opts?: { startY?: number; size?: number; italica?: boolean }): number {
  let y = opts?.startY ?? 30;
  if (!texto) return y;
  doc.setFont('helvetica', opts?.italica ? 'italic' : 'normal');
  doc.setFontSize(opts?.size ?? 9);
  doc.setTextColor(51, 65, 85);
  const lineas = doc.splitTextToSize(texto, ANCHO - 2 * M);
  for (const linea of lineas) {
    if (y > ALTO - 22) {
      doc.addPage();
      y = 20;
    }
    doc.text(linea, M, y);
    y += 4.4;
  }
  return y + 2;
}

function bloqueAviso(doc: jsPDF, texto: string, y: number): number {
  doc.setFillColor(255, 243, 205);
  doc.setDrawColor(217, 119, 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14);
  const lineas = doc.splitTextToSize(texto, ANCHO - 2 * M - 8);
  const alto = Math.max(16, lineas.length * 3.6 + 8);
  let yy = y;
  if (yy > ALTO - alto - 20) {
    doc.addPage();
    yy = 20;
  }
  doc.rect(M, yy + 2, ANCHO - 2 * M, alto, 'FD');
  doc.text(lineas, M + 4, yy + 8);
  return yy + alto + 6;
}

function tabla(doc: jsPDF, titulo: string, startY: number, head: string[][], body: string[][], opts?: { size?: number }) {
  let y = startY;
  if (titulo) {
    if (y > ALTO - 40) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const lineas = doc.splitTextToSize(titulo, ANCHO - 2 * M);
    doc.text(lineas, M, y);
    y += 4.5 * lineas.length;
  }
  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: M, right: M, top: 18, bottom: 20 },
    styles: { font: 'helvetica', fontSize: opts?.size ?? 7, cellPadding: 1.4, overflow: 'linebreak', textColor: [51, 65, 85] },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: opts?.size ?? 7, halign: 'center' },
    alternateRowStyles: { fillColor: [244, 246, 249] },
    showHead: 'everyPage',
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
}

/** Renderiza un elemento del modelo canónico; devuelve el nuevo cursor Y. */
function renderElemento(doc: jsPDF, el: ElementoDoc, y: number): number {
  switch (el.tipo) {
    case 'parrafo':
      return parrafo(doc, el.texto, { startY: y, size: el.pequeno ? (el.italica ? 8 : 7.5) : el.italica ? 9 : 9, italica: el.italica });
    case 'campos': {
      let yy = y;
      for (const item of el.items) {
        yy = parrafo(doc, `${item.etiqueta}:`, { startY: yy, size: 9 });
        yy = parrafo(doc, item.valor || '—', { startY: yy - 1, size: 8.5 });
      }
      return yy;
    }
    case 'subtitulo': {
      let yy = y;
      if (yy > ALTO - 40) {
        doc.addPage();
        yy = 20;
      }
      encabezadoPagina(doc, el.texto);
      return yy + 4;
    }
    case 'tabla': {
      const size = el.tabla.ancha ? 6 : 7.5;
      return tabla(doc, el.tabla.titulo ?? '', y, [el.tabla.encabezados], el.tabla.filas.map((f) => f.map((c) => (c === null ? '' : c))), { size });
    }
    case 'analisis': {
      let yy = y;
      if (yy > ALTO - 40) {
        doc.addPage();
        yy = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(120, 81, 40);
      doc.text(el.bloque.titulo, M, yy);
      yy += 4;
      doc.setFontSize(7);
      if (el.bloque.estado === 'desactualizado') doc.setTextColor(185, 28, 28);
      else doc.setTextColor(140, 100, 40);
      doc.text(etiquetaAnalisis(el.bloque.estado), M, yy);
      yy += 2;
      return parrafo(doc, el.bloque.texto, { startY: yy + 3, size: 8 });
    }
    case 'aviso':
      return bloqueAviso(doc, el.texto, y);
  }
}

function renderSeccion(doc: jsPDF, seccion: SeccionDoc, esPrimera: boolean, registrar?: Record<string, number>) {
  // La primera sección fluye tras la portada (pasada 1) o tras el índice
  // (pasada 2): esas páginas ya la crean sus bloques previos con su salto
  // correspondiente, así que aquí no se fuerza otro salto (evita páginas
  // en blanco y mantiene la numeración del índice exacta).
  if (!esPrimera && seccion.paginaNueva) {
    doc.addPage();
  }
  if (registrar) registrar[seccion.titulo] = doc.getCurrentPageInfo().pageNumber;
  encabezadoPagina(doc, seccion.titulo);
  let y = 30;
  for (const el of seccion.elementos) {
    y = renderElemento(doc, el, y);
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
  doc.text(documento.portada.titulo, ANCHO / 2, 24, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(documento.portada.subtitulo, ANCHO / 2, 34, { align: 'center' });
  doc.setFontSize(9);
  doc.text(documento.portada.marca, ANCHO / 2, 43, { align: 'center' });
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(doc.splitTextToSize(documento.portada.nombreProyecto, ANCHO - 2 * M - 20), M, 76);
  let y =
    76 + doc.getTextDimensions(doc.splitTextToSize(documento.portada.nombreProyecto, ANCHO - 2 * M - 20)).h + 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (documento.portada.denominacion) {
    doc.text(doc.splitTextToSize(documento.portada.denominacion, ANCHO - 2 * M - 20), M, y);
    y += doc.getTextDimensions(doc.splitTextToSize(documento.portada.denominacion, ANCHO - 2 * M - 20)).h + 4;
  }
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  let primera = true;
  for (const cifra of documento.portada.cifras) {
    y = parrafo(doc, `${cifra.etiqueta}: ${cifra.valor}`, { startY: primera ? y + 4 : y, size: 10 });
    primera = false;
  }
  if (documento.portada.avisoDemo) {
    y = bloqueAviso(doc, documento.portada.avisoDemo, y + 2);
  }
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  doc.text(
    `Generado localmente por PLANEX Cuba el ${new Date().toLocaleString('es-ES')}. Cifras y análisis provienen del modelo de cálculo activo (misma versión para tablas, resumen, conclusiones y exportaciones).`,
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
      if (ty > ALTO - 26) {
        doc.addPage();
        ty = 20;
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(seccion.titulo, M, ty);
      doc.setFont('helvetica', 'bold');
      doc.text(String(pag), ANCHO - M, ty, { align: 'right' });
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.1);
      doc.line(M + doc.getTextDimensions(seccion.titulo).w + 2, ty - 1, ANCHO - M - 6, ty - 1);
      ty += 6.5;
    }
    doc.addPage();
  }

  // ============================================================ Secciones
  for (let i = 0; i < documento.secciones.length; i++) {
    renderSeccion(doc, documento.secciones[i], i === 0, registrar);
  }

  // ============================================================ Pies de página
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(M, ALTO - 14, ANCHO - M, ALTO - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('PLANEX Cuba — Plan de Negocios (GOC-2026-O57)', M, ALTO - 9);
    doc.text(`Página ${i} de ${total}`, ANCHO - M, ALTO - 9, { align: 'right' });
    if (meta.esDemo) doc.text('EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS', ANCHO / 2, ALTO - 9, { align: 'center' });
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
  const paginasIndice = Math.max(1, Math.ceil(enIndice / 36));
  const paginasAjustadas = Object.fromEntries(
    Object.entries(registro).map(([k, v]) => [k, v + paginasIndice])
  );
  // Pasada 2: documento final con índice y numeración coherente.
  const { doc } = construirDesdeModelo(documento, { paginasSecciones: paginasAjustadas });
  const datos = doc.output('blob');
  const sufijo = documento.meta.moneda === 'CUP' ? ' CUP' : ' USD';
  const nombre = `${(documento.meta.nombreProyecto || proyecto.nombre).slice(0, 40)}${sufijo}.pdf`;
  return { datos, nombre, documento };
}

/** Versión de solo texto plano del documento (índices de pruebas E2E). */
export { construirDocumentoPlanex };
