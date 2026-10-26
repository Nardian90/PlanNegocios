// ============================================================================
// Exportador DOCX (Microsoft Word) — renderer del MODELO DOCUMENTAL CANÓNICO
// (misión PLANEX-DOC-001 §7).
//
// Genera un .docx REAL, válido y editable con la biblioteca «docx»:
//   · Portada profesional + campo TOC ACTUALIZABLE (Word lo numera al abrir
//     con F9 / «Actualizar campos» — la biblioteca lo permite y se activa).
//   · Estilos de Word (Heading1/2, Normal, estilos propios de bloques) en
//     lugar de formato manual suelto; jerarquía de títulos navegable.
//   · Tablas EDITABLES con fila de encabezado repetida (tableHeader),
//     anchos proporcionales y sombreado consistente.
//   · Encabezado y pie con numeración «Página X de Y» (PageNumber.CURRENT /
//     TOTAL_PAGES) en TODAS las secciones.
//   · Orientación apaisada SOLO para las tablas financieras anchas (grupos
//     de tablas consecutivas), sin cambiar el resto del documento.
//   · Texto seleccionable y contenido reutilizable: NO se insertan imágenes
//     del PDF ni capturas del visor.
//
// Fidelidad: consume EXACTAMENTE el mismo modelo canónico que el PDF y el
// visor (mismos datos, textos, importes y advertencias). Los motores de
// composición de Word y PDF difieren: se exige alta fidelidad visual y
// estructural, no identidad absoluta de paginación (misión §3.2).
// ============================================================================

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  PageOrientation,
  Footer,
  Header,
  PageNumber,
  TableOfContents,
  TabStopType,
  ImageRun,
} from 'docx';
import { PlanexProject, ComputedModel } from '../types';
import { construirDocumentoPlanex, OpcionesDocumento } from '../doc/construir';
import { DocumentoPlanex, ElementoDoc, TablaDoc, etiquetaAnalisis } from '../doc/modelo';
import { asegurarTexto } from '../doc/texto';
import { rasterizarPNG } from '../doc/figuras';
import { requiereApaisada, type MedidorAncho } from './pdf';

/** Texto canónico WinAnni-seguro compartido con el PDF (misión §8: el
 *  contenido de ambos formatos coincide carácter a carácter). */
function T(texto: string | null | undefined): string {
  return asegurarTexto(texto);
}

// Anchos de contenido en DXA (twips): A4 = 11906 × 16838 DXA con márgenes 1440.
const CONTENT_PORTRAIT = 11906 - 1440 * 2;
const CONTENT_LANDSCAPE = 16838 - 1440 * 2;

const AZUL = '1E3A5F';
const AZUL_CLARO = 'F4F6F9';
const TINTA = '334155';
const AMBAR = 'B45309';
const AMBAR_CLARO = 'FFF7E6';
const GRIS_BORDE = 'CBD5E1';
const GRIS_TEXTO = '64748B';

/** ¿Celda con aspecto numérico/monetario? (para alinear a la derecha). */
function esNumerica(texto: string): boolean {
  const t = texto.trim();
  if (!t) return false;
  return /^[-–—]?[\d.,]+([ ]?%|[ ]?(kUSD|kCUP|USD|CUP|años?))?$/.test(t) || /^[\d.,]+ %$/.test(t);
}

/** Columnas numéricas por CONTENIDO (≥ 80 % de celdas numéricas): misma regla
 *  que el PDF (DOC-003 §5.3) — una columna «Estado» o «Fuente» no se alinea a
 *  la derecha por su posición. */
function columnasNumericasWord(tabla: TablaDoc): boolean[] {
  const n = tabla.encabezados.length;
  const out: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const celdas = tabla.filas.map((f) => (f[i] ?? '').trim()).filter((c) => c !== '' && c !== '—');
    if (i === 0 || !celdas.length) {
      out[i] = false;
      continue;
    }
    out[i] = celdas.filter((c) => esNumerica(c)).length / celdas.length >= 0.8;
  }
  return out;
}

/** Medición aproximada de Calibri (mm) para el criterio de orientación
 *  compartido con el PDF (DOC-003 §4.2): misma decisión de contenido, métricas
 *  del propio formato. Word envuelve automáticamente, así que basta un buen
 *  umbral, no un ajuste milimétrico. */
const medirWord: MedidorAncho = (texto, size, negrita) => {
  let em = 0;
  for (const ch of texto) {
    if (ch === ' ' || ch === '.' || ch === ',') em += 0.26;
    else if (/[0-9]/.test(ch)) em += 0.507;
    else if (/[iljt|!;:'’]/.test(ch)) em += 0.28;
    else if (/[A-ZÁÉÍÓÚÑQWMBDKHGNUVR]/.test(ch)) em += 0.62;
    else em += 0.5;
  }
  return em * (size / 2.8346) * (negrita ? 1.05 : 1);
};

// Ancho útil vertical en mm (márgenes 1440 DXA = 25,4 mm).
const ANCHO_UTIL_RETRATO_MM = (11906 - 1440 * 2) / 1440 * 25.4;

/** ¿La tabla va a página apaisada? MISMO criterio de contenido que el PDF. */
function esApaisadaWord(tabla: TablaDoc): boolean {
  return requiereApaisada(tabla, medirWord, ANCHO_UTIL_RETRATO_MM, 7.5);
}

/** Reparte el ancho de contenido entre columnas según su contenido. */
function anchosColumnas(tabla: TablaDoc, ancho: number): number[] {
  const n = tabla.encabezados.length;
  const pesos = new Array(n).fill(0);
  tabla.encabezados.forEach((h, i) => (pesos[i] = Math.max(pesos[i], Math.min(h.length, 34))));
  for (const fila of tabla.filas) {
    fila.forEach((c, i) => {
      if (i < n) pesos[i] = Math.max(pesos[i], Math.min((c ?? '').length, 30));
    });
  }
  for (let i = 0; i < n; i++) pesos[i] = Math.max(pesos[i], 6);
  // La primera columna (conceptos) algo más holgada.
  if (n > 2) pesos[0] *= 1.35;
  const suma = pesos.reduce((s, p) => s + p, 0);
  return pesos.map((p) => Math.round((ancho * p) / suma));
}

function celdasFila(tabla: TablaDoc, fila: string[], esEncabezado: boolean, ancho: number, size: number, opts?: { numericas?: boolean[]; resaltada?: boolean; ultima?: boolean }): TableCell[] {
  const numericas = opts?.numericas ?? [];
  return fila.map((celda, i) => {
    const alinear = esEncabezado
      ? i === 0
        ? AlignmentType.LEFT
        : numericas[i]
          ? AlignmentType.CENTER
          : AlignmentType.LEFT
      : i === 0
        ? AlignmentType.LEFT
        : (tabla.alineaciones?.[i] ?? (numericas[i] ? 'der' : 'izq')) === 'der'
          ? AlignmentType.RIGHT
          : (tabla.alineaciones?.[i] ?? (numericas[i] ? 'der' : 'izq')) === 'cen'
            ? AlignmentType.CENTER
            : AlignmentType.LEFT;
    // Filetes horizontales selectivos (mismo lenguaje visual que el PDF):
    // cabecera con cierre superior e inferior; totales con filete superior;
    // última fila con cierre inferior. SIN rejilla vertical.
    const bordesCelda =
      esEncabezado || opts?.resaltada || opts?.ultima
        ? {
            top: esEncabezado ? { style: BorderStyle.SINGLE, size: 8, color: '64748B' } : opts?.resaltada ? { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' } : undefined,
            bottom: opts?.ultima ? { style: BorderStyle.SINGLE, size: 8, color: '64748B' } : esEncabezado ? { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' } : undefined,
          }
        : undefined;
    return new TableCell({
      children: [
        new Paragraph({
          alignment: alinear,
          children: [
            new TextRun({
              text: celda === null ? '' : T(celda),
              bold: esEncabezado || opts?.resaltada,
              color: esEncabezado ? AZUL : TINTA,
              size: esEncabezado ? size : size,
              font: 'Calibri',
            }),
          ],
        }),
      ],
      shading: esEncabezado
        ? { type: ShadingType.CLEAR, color: 'auto', fill: 'EEF2F7' }
        : undefined,
      borders: bordesCelda,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      width: { size: anchosColumnas(tabla, ancho)[i], type: WidthType.DXA },
    });
  });
}

function tablaWord(tabla: TablaDoc, ancho: number): Table {
  // DOC-003-R1 §4: la fuente sigue la decisión de ORIENTACIÓN POR CONTENIDO
  // (mismo criterio compartido con el PDF), no la declaración «ancha»; una
  // tabla estrecha absorbida en un grupo apaisado conserva sus 8,5 pt.
  const size = esApaisadaWord(tabla) ? 15 : 17; // half-points: 7,5 pt apaisada / 8,5 pt normal (§5.2)
  const numericas = columnasNumericasWord(tabla);
  const resaltar = new Set(tabla.resaltar ?? []);
  const children: TableRow[] = [];
  children.push(
    new TableRow({
      tableHeader: true, // encabezado repetido en páginas siguientes
      cantSplit: true,
      children: celdasFila(tabla, tabla.encabezados, true, ancho, size, { numericas }),
    })
  );
  tabla.filas.forEach((fila, idx) => {
    children.push(
      new TableRow({
        cantSplit: true, // no cortar filas entre páginas
        children: celdasFila(tabla, fila, false, ancho, size, {
          numericas,
          resaltada: resaltar.has(idx),
          ultima: idx === tabla.filas.length - 1,
        }),
      })
    );
  });
  return new Table({
    rows: children,
    width: { size: ancho, type: WidthType.DXA },
    columnWidths: anchosColumnas(tabla, ancho),
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    },
  });
}

/** Nota al pie de tabla (APA): fuente/supuesto/lectura, cuando existe. */
function notaTabla(texto: string): Paragraph {
  return new Paragraph({
    style: 'NotaTexto',
    spacing: { before: 40, after: 160 },
    children: [new TextRun({ text: T(`Nota. ${texto}`), italics: true, size: 15, color: GRIS_TEXTO, font: 'Calibri' })],
  });
}

function tituloTabla(texto: string, _numero?: number): Paragraph {
  return new Paragraph({
    style: 'NotaTabla',
    spacing: { before: 200, after: 80 },
    keepNext: true, // evita títulos de tabla huérfanos al final de página (§3.2)
    keepLines: true,
    children: [new TextRun({ text: T(texto), bold: true, size: 18, color: AZUL, font: 'Calibri' })],
  });
}

/** Párrafo narrativo JUSTIFICADO (§3.1): convención editorial de PLANEX para
 *  el cuerpo; títulos, etiquetas y celdas NO se justifican. */
function parrafoSimple(texto: string, opts?: { italica?: boolean; pequeno?: boolean; justificado?: boolean }): Paragraph {
  return new Paragraph({
    style: opts?.pequeno ? 'NotaTexto' : undefined,
    spacing: { before: 60, after: 60, line: 276 },
    alignment: (opts?.justificado ?? true) ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
    children: [
      new TextRun({
        text: T(texto),
        italics: opts?.italica,
        size: opts?.pequeno ? 16 : 20,
        color: TINTA,
        font: 'Calibri',
      }),
    ],
  });
}

function bloqueAnalisis(el: Extract<ElementoDoc, { tipo: 'analisis' }>): Paragraph[] {
  return [
    new Paragraph({
      style: 'AnalisisPlanex',
      spacing: { before: 160, after: 20 },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: AMBAR_CLARO },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: AMBAR, space: 4 } },
      children: [
        new TextRun({ text: T(el.bloque.titulo), bold: true, size: 18, color: AMBAR, font: 'Calibri' }),
        new TextRun({ text: '  ·  ' + T(etiquetaAnalisis(el.bloque.estado)), size: 14, color: el.bloque.estado === 'desactualizado' ? 'B91C1C' : '8C6428', font: 'Calibri' }),
      ],
    }),
    new Paragraph({
      style: 'AnalisisCuerpo',
      spacing: { before: 0, after: 160 },
      alignment: AlignmentType.JUSTIFIED,
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: AMBAR_CLARO },
      border: {
        left: { style: BorderStyle.SINGLE, size: 18, color: AMBAR, space: 4 },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: AMBAR_CLARO, space: 1 },
      },
      children: [new TextRun({ text: T(el.bloque.texto), size: 18, color: TINTA, font: 'Calibri' })],
    }),
  ];
}

/** Bloque de figura (§9): título APA, imagen PNG rasterizada localmente con
 *  el MISMO modelo de datos del PDF, leyenda con muestras de color y nota. */
function bloqueFigura(el: Extract<ElementoDoc, { tipo: 'figura' }>): (Paragraph | Table)[] {
  const f = el.figura;
  const { png } = rasterizarPNG(f, { ancho: 640, alto: 320 });
  const salida: (Paragraph | Table)[] = [];
  salida.push(
    new Paragraph({
      style: 'NotaTabla',
      spacing: { before: 240, after: 80 },
      keepNext: true,
      keepLines: true,
      children: [new TextRun({ text: T(f.titulo), bold: true, size: 18, color: AZUL, font: 'Calibri' })],
    })
  );
  salida.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepLines: true,
      spacing: { after: 80 },
      children: [
        new ImageRun({
          type: 'png',
          data: png,
          transformation: { width: 580, height: 290 },
        }),
      ],
    })
  );
  // Leyenda con muestras de color (texto del documento, no dentro del gráfico)
  salida.push(
    new Paragraph({
      spacing: { before: 40, after: 40 },
      children: f.leyenda.flatMap((item, idx) => {
        const runs: TextRun[] = [];
        if (idx > 0) runs.push(new TextRun({ text: '   ·   ', size: 14, color: GRIS_TEXTO, font: 'Calibri' }));
        runs.push(new TextRun({ text: '—— ', size: 16, color: item.color.replace('#', '').toUpperCase(), font: 'Calibri' }));
        runs.push(new TextRun({ text: T(item.etiqueta), size: 16, color: GRIS_TEXTO, font: 'Calibri' }));
        return runs;
      }),
    })
  );
  salida.push(
    new Paragraph({
      style: 'NotaTexto',
      spacing: { before: 20, after: 60 },
      children: [
        new TextRun({ text: `Unidades del eje vertical: ${T(f.unidad)}. Eje horizontal: ${T(f.ejeX)}. `, size: 16, color: GRIS_TEXTO, font: 'Calibri' }),
        new TextRun({ text: `Nota. ${T(f.nota)}`, italics: true, size: 16, color: GRIS_TEXTO, font: 'Calibri' }),
      ],
    })
  );
  return salida;
}

function bloqueAviso(texto: string): Table {
  return new Table({
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            children: [
              new Paragraph({
                spacing: { before: 60, after: 60 },
                children: [new TextRun({ text: T(texto), size: 16, color: '92400E', font: 'Calibri' })],
              }),
            ],
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FFF3CD' },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
          }),
        ],
      }),
    ],
    width: { size: CONTENT_PORTRAIT, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: AMBAR },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: AMBAR },
      left: { style: BorderStyle.SINGLE, size: 6, color: AMBAR },
      right: { style: BorderStyle.SINGLE, size: 6, color: AMBAR },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    },
  });
}

/** Elementos → hijos Word (retrato). */
function hijosElementos(elementos: ElementoDoc[], salida: (Paragraph | Table)[]): void {
  for (const el of elementos) {
    switch (el.tipo) {
      case 'parrafo':
        salida.push(parrafoSimple(el.texto, { italica: el.italica, pequeno: el.pequeno }));
        break;
      case 'campos':
        for (const item of el.items) {
          salida.push(
            new Paragraph({
              spacing: { before: 40, after: 40 },
              alignment: AlignmentType.LEFT,
              children: [
                new TextRun({ text: `${T(item.etiqueta)}: `, bold: true, size: 19, color: AZUL, font: 'Calibri' }),
                new TextRun({ text: T(item.valor) || '—', size: 19, color: TINTA, font: 'Calibri' }),
              ],
            })
          );
        }
        break;
      case 'subtitulo':
        salida.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 220, after: 80 },
            children: [new TextRun({ text: T(el.texto), size: 24, bold: true, color: AZUL, font: 'Calibri' })],
          })
        );
        break;
      case 'tabla':
        if (el.tabla.titulo) salida.push(tituloTabla(el.tabla.titulo, el.tabla.numero));
        salida.push(tablaWord(el.tabla, CONTENT_PORTRAIT));
        if (el.tabla.nota) salida.push(notaTabla(el.tabla.nota));
        break;
      case 'analisis':
        salida.push(...bloqueAnalisis(el));
        break;
      case 'aviso':
        salida.push(bloqueAviso(el.texto));
        break;
      case 'figura':
        salida.push(...bloqueFigura(el));
        break;
    }
  }
}

function pieDocumento(documento: DocumentoPlanex): Footer {
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_PORTRAIT }],
        children: [
          new TextRun({ text: 'PLANEX Cuba — Plan de Negocios (GOC-2026-O57)', size: 13, color: GRIS_TEXTO, font: 'Calibri' }),
          new TextRun({ children: ['\tPágina ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 13, color: GRIS_TEXTO, font: 'Calibri' }),
          ...(documento.meta.esDemo
            ? [new TextRun({ text: '   ·   EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS', size: 13, color: AMBAR, font: 'Calibri' })]
            : []),
        ],
      }),
    ],
  });
}

function encabezadoDocumento(documento: DocumentoPlanex): Header {
  return new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_PORTRAIT }],
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: AZUL, space: 2 } },
        children: [
          new TextRun({ text: 'PLAN DE NEGOCIOS', bold: true, size: 15, color: AZUL, font: 'Calibri' }),
          new TextRun({ text: `\t${T(documento.meta.nombreProyecto)}`, size: 13, color: GRIS_TEXTO, font: 'Calibri' }),
        ],
      }),
    ],
  });
}

/** Propiedades de página por orientación. */
function pagina(orientacion: 'retrato' | 'apaisado') {
  return {
    margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
    size:
      orientacion === 'apaisado'
        ? { orientation: PageOrientation.LANDSCAPE, width: 16838, height: 11906 }
        : { orientation: PageOrientation.PORTRAIT, width: 11906, height: 16838 },
  };
}

/** Genera el documento Word (.docx) desde el modelo canónico. */
export async function exportarDOCX(
  proyecto: PlanexProject,
  modelo: ComputedModel,
  opciones?: OpcionesDocumento
): Promise<{ datos: Blob; nombre: string; documento: DocumentoPlanex }> {
  const documento = construirDocumentoPlanex(proyecto, modelo, opciones);
  const doc = await construirDOCX(documento);
  const datos = await Packer.toBlob(doc);
  const sufijo = documento.meta.moneda === 'CUP' ? ' CUP' : ' USD';
  const nombre = `${T((documento.meta.nombreProyecto || proyecto.nombre).slice(0, 40))}${sufijo}.docx`;
  return { datos, nombre, documento };
}

async function construirDOCX(documento: DocumentoPlanex): Promise<Document> {
  const meta = documento.meta;

  // ------------------------------------------------------------- Portada
  const portada: (Paragraph | Table)[] = [];
  portada.push(new Paragraph({ spacing: { before: 2400, after: 0 }, children: [] }));
  portada.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: T(documento.portada.titulo), bold: true, size: 52, color: AZUL, font: 'Calibri' })],
    })
  );
  portada.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: T(documento.portada.subtitulo), size: 22, color: TINTA, font: 'Calibri' })],
    })
  );
  portada.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: T(documento.portada.marca), size: 17, color: GRIS_TEXTO, font: 'Calibri' })],
    })
  );
  portada.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: T(documento.portada.nombreProyecto), bold: true, size: 34, color: TINTA, font: 'Calibri' })],
    })
  );
  if (documento.portada.denominacion) {
    portada.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [new TextRun({ text: T(documento.portada.denominacion), size: 21, color: GRIS_TEXTO, font: 'Calibri' })],
      })
    );
  }
  for (const cifra of documento.portada.cifras) {
    portada.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 50 },
        children: [
          new TextRun({ text: `${T(cifra.etiqueta)}: `, bold: true, size: 19, color: TINTA, font: 'Calibri' }),
          new TextRun({ text: T(cifra.valor), size: 19, color: TINTA, font: 'Calibri' }),
        ],
      })
    );
  }
  if (documento.portada.avisoDemo) {
    portada.push(new Paragraph({ spacing: { before: 200 }, children: [] }));
    portada.push(bloqueAviso(documento.portada.avisoDemo));
  }

  // ------------------------------------------------------------- Índice
  const indice: (Paragraph | TableOfContents)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      children: [new TextRun({ text: 'Índice', size: 30, bold: true, color: AZUL, font: 'Calibri' })],
    }),
    // Campo TOC actualizable de Word: numera las páginas al actualizar campos
    // (la biblioteca lo permite; features.updateFields lo pide al abrir).
    new TableOfContents('Índice del plan de negocios', {
      hyperlink: true,
      headingStyleRange: '1-1',
    }),
  ];

  // --------------------------------------------- Cuerpo con orientaciones
  type Grupo = { orientacion: 'retrato' | 'apaisado'; hijos: (Paragraph | Table)[] };
  const grupos: Grupo[] = [{ orientacion: 'retrato', hijos: [] }];

  for (const seccion of documento.secciones) {
    const actual = grupos[grupos.length - 1];
    // Título de sección como Heading1 (entra en el TOC con rango 1-1).
    actual.hijos.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun({ text: T(seccion.titulo), size: 30, bold: true, color: AZUL, font: 'Calibri' })],
      })
    );

    // Divide el flujo cuando aparecen tablas anchas consecutivas (mismo
    // criterio de CONTENIDO que el PDF).
    let i = 0;
    while (i < seccion.elementos.length) {
      const el = seccion.elementos[i];
      if (el.tipo === 'tabla' && esApaisadaWord(el.tabla)) {
        // ¿Ya estamos en un grupo apaisado por otra tabla contigua?
        if (grupos[grupos.length - 1].orientacion !== 'apaisado') {
          grupos.push({ orientacion: 'apaisado', hijos: [] });
        }
        const g = grupos[grupos.length - 1];
        if (el.tabla.titulo) g.hijos.push(tituloTabla(el.tabla.titulo, el.tabla.numero));
        g.hijos.push(tablaWord(el.tabla, CONTENT_LANDSCAPE));
        i++;
        // Las tablas estrechas contiguas se quedan también en apaisado para
        // evitar dos saltos de orientación innecesarios.
        while (i < seccion.elementos.length && seccion.elementos[i].tipo === 'tabla') {
          const t = seccion.elementos[i] as Extract<ElementoDoc, { tipo: 'tabla' }>;
          if (t.tabla.titulo) g.hijos.push(tituloTabla(t.tabla.titulo, t.tabla.numero));
          g.hijos.push(tablaWord(t.tabla, CONTENT_LANDSCAPE));
          i++;
        }
        grupos.push({ orientacion: 'retrato', hijos: [] });
      } else {
        if (grupos[grupos.length - 1].orientacion === 'apaisado') grupos.push({ orientacion: 'retrato', hijos: [] });
        hijosElementos([el], grupos[grupos.length - 1].hijos);
        i++;
      }
    }
  }

  // ------------------------------------------------------------ Documento
  const footer = pieDocumento(documento);
  const header = encabezadoDocumento(documento);

  const sections = [
    // Portada: sin encabezado/pie (página de título).
    { properties: { page: pagina('retrato') }, children: portada },
    // Índice.
    { properties: { page: pagina('retrato') }, headers: { default: header }, footers: { default: footer }, children: indice },
    // Cuerpo: retrato por defecto, apaisado solo donde hay tablas anchas.
    ...grupos
      .filter((g) => g.hijos.length > 0)
      .map((g) => ({
        properties: { page: pagina(g.orientacion) },
        headers: { default: header },
        footers: { default: footer },
        children: g.hijos,
      })),
  ];

  const doc = new Document({
    creator: 'PLANEX Cuba',
    title: `${T(documento.meta.nombreProyecto)} — Plan de Negocios`,
    description: `Documento generado por PLANEX Cuba. Moneda de presentación: ${meta.moneda}.`,
    features: { updateFields: true },
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 20, color: TINTA } },
        heading1: { run: { font: 'Calibri', size: 30, bold: true, color: AZUL } },
        heading2: { run: { font: 'Calibri', size: 24, bold: true, color: AZUL } },
      },
      paragraphStyles: [
        {
          id: 'NotaTabla',
          name: 'Nota de tabla',
          basedOn: 'Normal',
          run: { font: 'Calibri', color: AZUL },
        },
        {
          id: 'NotaTexto',
          name: 'Texto de nota',
          basedOn: 'Normal',
          run: { font: 'Calibri', size: 16, color: GRIS_TEXTO },
        },
        {
          id: 'AnalisisPlanex',
          name: 'Análisis PLANEX',
          basedOn: 'Normal',
          run: { font: 'Calibri' },
        },
        {
          id: 'AnalisisCuerpo',
          name: 'Cuerpo de análisis PLANEX',
          basedOn: 'Normal',
          run: { font: 'Calibri' },
        },
      ],
    },
    sections,
  });
  return doc;
}
