// ============================================================================
// PLANEX-DATA-002 — Exportación headless del «Documento de consultas al
// promotor» (PDF + DOCX) del expediente Holguín.
//
// Genera en docs/expediente-holguin/:
//   · PLANEX_Consultas_Promotor_<proyecto>_<fecha>.pdf
//   · PLANEX_Consultas_Promotor_<proyecto>_<fecha>.docx  (editable, para responder)
//
// Uso: bun run scripts/exportar_consultas.ts
// ============================================================================

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { construirDocumentoConsultas } from '../src/lib/planex/data/holguin/consultas-doc';
import { componerDocumentoConsultasPDF } from '../src/lib/planex/io/consultas';
import { exportarDOCXDesdeModelo } from '../src/lib/planex/io/docx';
import { SUPUESTOS, NORMATIVA } from '../src/lib/planex/data/holguin/consultas';
import { CONSULTAS, resumenConsultas } from '../src/lib/planex/data/holguin/consultas-preguntas';

const dirDocs = join(process.cwd(), 'docs', 'expediente-holguin');
mkdirSync(dirDocs, { recursive: true });

const grab = (bytes: Uint8Array | ArrayBuffer, nombre: string) => {
  const buf = bytes instanceof Uint8Array ? Buffer.from(bytes) : Buffer.from(new Uint8Array(bytes));
  writeFileSync(join(dirDocs, nombre), buf);
  console.log(`OK ${nombre} (${(buf.length / 1024).toFixed(1)} KiB)`);
};

console.log('Generando el documento de consultas al promotor…');

// PDF con el compositor editorial (misma vía que el informe de brechas).
const pdf = componerDocumentoConsultasPDF();
grab(pdf.datos, pdf.nombre);

// DOCX gemelo editable, desde el MISMO modelo canónico.
const documento = construirDocumentoConsultas();
const docx = await exportarDOCXDesdeModelo(documento);
grab(new Uint8Array(await docx.datos.arrayBuffer()), pdf.nombre.replace(/\.pdf$/, '.docx'));

const res = resumenConsultas();
console.log('\nCifras de control del documento de consultas:');
console.log(`  Consultas:                ${res.total} (críticas: ${res.criticas}, altas: ${res.altas})`);
console.log(`  Supuestos documentados:   ${SUPUESTOS.length}`);
console.log(`  Normas consultadas:       ${NORMATIVA.length}`);
console.log(`  Secciones del documento:  ${documento.secciones.length}`);
console.log(`  Q-08 (tasa de cambio) y Q-09 (impuesto 15 %/35 %): ${CONSULTAS.some((c) => c.id === 'Q-08' && c.prioridad === 'critica') && CONSULTAS.some((c) => c.id === 'Q-09' && c.prioridad === 'critica') ? 'presentes y críticas' : 'FALTAN'}`);
