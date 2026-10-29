// ============================================================================
// PLANEX-DATA-002 — Exportación del «Documento de consultas al promotor».
//
// Compone el documento de supuestos, dudas y pendientes del expediente
// Holguín con el MISMO compositor editorial del plan de negocios
// (componerDesdeModeloConIndice) y lo entrega en PDF y DOCX desde el MISMO
// modelo canónico. El nombre sigue la convención de la serie documental:
//   PLANEX_Consultas_Promotor_<proyecto>_<fecha>.pdf / .docx
// ============================================================================

import { componerDesdeModeloConIndice } from './pdf';
import { exportarDOCXDesdeModelo } from './docx';
import { construirDocumentoConsultas } from '../data/holguin/consultas-doc';
import { NOMBRE_INFORME_PROYECTO } from '../data/holguin/informe';
import { descargarArchivo } from './jsonio';

function slugProyecto(): string {
  return NOMBRE_INFORME_PROYECTO.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function nombreArchivo(ext: 'pdf' | 'docx'): string {
  const fecha = new Date().toISOString().slice(0, 10);
  return `PLANEX_Consultas_Promotor_${slugProyecto()}_${fecha}.${ext}`;
}

/** Compone el documento de consultas y devuelve los bytes del PDF. */
export function componerDocumentoConsultasPDF(): { datos: ArrayBuffer; nombre: string } {
  const documento = construirDocumentoConsultas();
  const { datos } = componerDesdeModeloConIndice(documento);
  return { datos, nombre: nombreArchivo('pdf') };
}

/** Exporta el PDF en el navegador (descarga del usuario). */
export async function exportarConsultasPDF(): Promise<void> {
  const { datos, nombre } = componerDocumentoConsultasPDF();
  descargarArchivo(nombre, datos, 'application/pdf');
}

/** Exporta el DOCX editable (para responder intercalado) en el navegador. */
export async function exportarConsultasDOCX(): Promise<void> {
  const documento = construirDocumentoConsultas();
  const { datos } = await exportarDOCXDesdeModelo(documento);
  descargarArchivo(nombreArchivo('docx'), await datos.arrayBuffer(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
