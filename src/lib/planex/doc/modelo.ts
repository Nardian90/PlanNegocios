// ============================================================================
// PLANEX — Modelo documental CANÓNICO (misión PLANEX-DOC-001 §3.1).
//
// Única representación tipada del documento del plan. La construye
// doc/construir.ts a partir del proyecto activo, del ComputedModel del motor
// y de la moneda de presentación; de ella se alimentan LOS TRES formatos:
//
//   · Visor de previsualización (PDF real generado del modelo)
//   · Exportador PDF (jsPDF)
//   · Exportador DOCX (docx)
//
// Nada de lo que se ve en un formato se calcula de forma independiente:
// textos, tablas, importes, análisis y avisos existen UNA sola vez aquí.
// El motor financiero sigue siendo la única fuente de las cifras; este
// modelo es la única fuente de la PRESENTACIÓN documental.
// ============================================================================

import { ClaveAnalisis } from '../engine/analisis';
import { EstadoAnalisis } from '../types';
import { MonedaPresentacion } from '../types';

// ---------------------------------------------------------------------------
// Tablas
// ---------------------------------------------------------------------------

export type Alineacion = 'izq' | 'der' | 'cen';

export interface TablaDoc {
  /** Título visible de la tabla (encima). */
  titulo?: string;
  /** Encabezados de columnas (una fila). */
  encabezados: string[];
  /** Filas de celdas YA FORMATEADAS (con la moneda de presentación). */
  filas: string[][];
  /** ¿Columna 1 alineada a la izquierda y el resto a la derecha? (defecto). */
  alineaciones?: Alineacion[];
  /** Tabla ancha (financieras con muchos años): DOCX la pone apaisada,
   *  el PDF usa la fuente compacta ya validada de la misión AUDIT-001. */
  ancha?: boolean;
  /** Unidad monetaria de la tabla, cuando toda ella comparte unidad. */
  unidad?: string;
}

// ---------------------------------------------------------------------------
// Elementos de contenido
// ---------------------------------------------------------------------------

export interface AnalisisDoc {
  titulo: string;
  clave: ClaveAnalisis;
  /** Texto FINAL resuelto (generado o el editado por el usuario). */
  texto: string;
  estado: EstadoAnalisis;
}

export type ElementoDoc =
  | { tipo: 'parrafo'; texto: string; italica?: boolean; pequeno?: boolean }
  | { tipo: 'campos'; items: { etiqueta: string; valor: string }[] }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'tabla'; tabla: TablaDoc }
  | { tipo: 'analisis'; bloque: AnalisisDoc }
  | { tipo: 'aviso'; texto: string };

// ---------------------------------------------------------------------------
// Secciones y documento
// ---------------------------------------------------------------------------

export interface SeccionDoc {
  /** Identificador estable ('4.1', '4.4', …, 'diagnostico', 'notas'). */
  id: string;
  /** Título completo tal como aparece en el documento y el índice. */
  titulo: string;
  /** ¿Aparece en el índice? (4.2 comparte el flujo de 4.1, como siempre). */
  enIndice: boolean;
  /** ¿Empieza en página nueva? (composición validada de AUDIT-001). */
  paginaNueva: boolean;
  elementos: ElementoDoc[];
}

export interface PortadaDoc {
  titulo: string;
  subtitulo: string;
  marca: string;
  nombreProyecto: string;
  denominacion: string;
  /** Cifras clave de portada, ya formateadas con la moneda de presentación. */
  cifras: { etiqueta: string; valor: string }[];
  avisoDemo?: string;
}

export interface MetaDocumento {
  nombreProyecto: string;
  fechaDocumento: string;
  esquema: string;
  horizonte: number;
  esDemo: boolean;
  moneda: MonedaPresentacion;
  /** Etiqueta de unidad para tablas financieras (p. ej. «Miles de USD (kUSD)»). */
  unidadTabla: string;
  /** Texto documental de la tasa aplicada (misión §5.2.10). */
  notaMoneda: string;
}

export interface DocumentoPlanex {
  meta: MetaDocumento;
  portada: PortadaDoc;
  /** Secciones en orden; el índice y la paginación los computa cada
   *  formato a partir de este mismo orden (PDF: doble pasada; DOCX: campo
   *  TOC actualizable de Word). */
  secciones: SeccionDoc[];
}

/** Etiqueta de trazabilidad de un bloque de análisis (misión §12.13). */
export function etiquetaAnalisis(estado: EstadoAnalisis): string {
  return estado === 'generado'
    ? 'ANÁLISIS GENERADO POR EL MODELO'
    : estado === 'manual'
      ? 'ANÁLISIS EDITADO POR EL USUARIO (al día con los datos actuales)'
      : 'ANÁLISIS EDITADO POR EL USUARIO — DESACTUALIZADO: los datos de origen cambiaron';
}
