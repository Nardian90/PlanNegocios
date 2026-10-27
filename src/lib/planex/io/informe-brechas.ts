// ============================================================================
// PLANEX-DATA-001 — Exportación del informe PDF de brechas documentales.
//
// Compone el «Informe de análisis documental y brechas de información»
// del expediente Holguín con el MISMO compositor editorial del plan de
// negocios (io/pdf.ts): justificación real, paginación inteligente, tablas
// corporativas, índice con doble pasada y pies numerados. El nombre sigue
// la convención de la misión:
//   PLANEX_Informe_Brechas_Documentales_<proyecto>_<fecha>.pdf
// ============================================================================

import { componerDesdeModeloConIndice } from './pdf';
import { construirDocumentoBrechas, NOMBRE_INFORME_PROYECTO } from '../data/holguin/informe';
import { descargarArchivo } from './jsonio';

function nombreArchivo(): string {
  const fecha = new Date().toISOString().slice(0, 10);
  const slug = NOMBRE_INFORME_PROYECTO
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `PLANEX_Informe_Brechas_Documentales_${slug}_${fecha}.pdf`;
}

/** Compone el informe y devuelve los bytes (uso navegador y headless). */
export function componerInformeBrechas(): { datos: ArrayBuffer; nombre: string } {
  const documento = construirDocumentoBrechas();
  const { datos } = componerDesdeModeloConIndice(documento);
  return { datos, nombre: nombreArchivo() };
}

/** Exporta el informe PDF en el navegador (descarga del usuario). */
export async function exportarInformeBrechasPDF(): Promise<void> {
  const { datos, nombre } = componerInformeBrechas();
  descargarArchivo(nombre, datos, 'application/pdf');
}
