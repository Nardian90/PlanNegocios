// ============================================================================
// PLANEX — Exportación del plan de regresión (misión DOC-002-R1, validación
// de cierre: «exportar el plan de regresión»).
//
// Regenera, desde el motor activo y la plantilla de demostración
// «Clínica Estomatológica Sonrisa Habana», los exportables que se entregan
// como evidencia en docs/ejemplos:
//   · Ejemplo_Clinica_Plan_de_Negocios.pdf      (presentación en CUP)
//   · Ejemplo_Clinica_Plan_de_Negocios_USD.pdf  (presentación en USD)
//   · Ejemplo_Clinica_Plan_de_Negocios.docx     (Word, CUP)
//   · Ejemplo_Clinica_Plan_de_Negocios_USD.docx (Word, USD)
//   · Ejemplo_Clinica_Libro_con_formulas.xlsx   (libro editable con fórmulas)
//
// Uso: bun scripts/exportar_regresion.ts
// ============================================================================
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeProject } from '../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../src/lib/planex/templates/clinica';
import { exportarPDF } from '../src/lib/planex/io/pdf';
import { exportarDOCX } from '../src/lib/planex/io/docx';
import { exportarXLSX } from '../src/lib/planex/io/xlsx';

const proyecto = crearProyectoClinica();
const modelo = computeProject(proyecto);
const dirDocs = join(process.cwd(), 'docs', 'ejemplos');

const grab = (datos: ArrayBuffer | Uint8Array, nombre: string) => {
  const buf = datos instanceof Uint8Array ? Buffer.from(datos) : Buffer.from(new Uint8Array(datos));
  writeFileSync(join(dirDocs, nombre), buf);
  console.log(`OK ${nombre} (${(buf.length / 1024).toFixed(1)} KiB)`);
};

console.log('Exportando el plan de regresión (Clínica Estomatológica Sonrisa Habana)…');
const pdfCUP = exportarPDF(proyecto, modelo, { moneda: 'CUP' });
grab(await pdfCUP.datos.arrayBuffer(), 'Ejemplo_Clinica_Plan_de_Negocios.pdf');
const pdfUSD = exportarPDF(proyecto, modelo, { moneda: 'USD' });
grab(await pdfUSD.datos.arrayBuffer(), 'Ejemplo_Clinica_Plan_de_Negocios_USD.pdf');

const docxCUP = await exportarDOCX(proyecto, modelo, { moneda: 'CUP' });
grab(await docxCUP.datos.arrayBuffer(), 'Ejemplo_Clinica_Plan_de_Negocios.docx');
const docxUSD = await exportarDOCX(proyecto, modelo, { moneda: 'USD' });
grab(await docxUSD.datos.arrayBuffer(), 'Ejemplo_Clinica_Plan_de_Negocios_USD.docx');

const xlsx = await exportarXLSX(proyecto, modelo);
grab(xlsx.datos, 'Ejemplo_Clinica_Libro_con_formulas.xlsx');

console.log('\nCifras de control del modelo activo (regresión DOC-002-R1):');
console.log(`  Ingresos año 1:        967,8 kUSD = ${(967.8 * 743).toLocaleString('es-ES', { maximumFractionDigits: 1 })} kCUP`);
console.log(`  Inversión total:       1.480,0 kUSD = ${(1480 * 743).toLocaleString('es-ES', { maximumFractionDigits: 1 })} kCUP`);
console.log(`  Brecha del arranque:   ${(0.775235531628533 * 743).toLocaleString('es-ES', { maximumFractionDigits: 1 })} kCUP (nómina de montaje, salidas de caja explícitas)`);
console.log(`  Recuperaciones:        proyecto ${(modelo.indicadores.recuperacionProyecto.anios ?? 0).toFixed(2).replace('.', ',')} años · socios ${(modelo.indicadores.recuperacionSocios.anios ?? 0).toFixed(2).replace('.', ',')} años (simples, sin descontar)`);
