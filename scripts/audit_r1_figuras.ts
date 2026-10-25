// Smoke test R1: figuras con ejes etiquetados (H7) + PDF/DOCX.
import { computeProject } from '../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../src/lib/planex/templates/clinica';
import { generarFiguras, rasterizarPNG } from '../src/lib/planex/doc/figuras';
import { construirDocumentoPlanex } from '../src/lib/planex/doc/construir';
import { exportarPDF } from '../src/lib/planex/io/pdf';
import { exportarDOCX } from '../src/lib/planex/io/docx';
import { writeFileSync } from 'fs';

const p = crearProyectoClinica();
const m = computeProject(p);
const conv = { kUSDaK: (k: number) => k * 743, unidadTabla: 'Miles de CUP (kCUP)', unidadCorta: 'kCUP' };
const figuras = generarFiguras(p, m, conv);
for (const f of figuras) {
  console.log(`\n--- ${f.clave} ---`);
  console.log('marcasY:', f.marcasY.map((x) => x.etiqueta).join(' | '));
  console.log('marcasX:', f.marcasX.map((x) => x.etiqueta).join(' '));
  console.log('ejes:', JSON.stringify(f.ejes));
  const { png } = rasterizarPNG(f, { ancho: 640, alto: 320, escala: 1 });
  writeFileSync(`/tmp/fig-${f.clave}.png`, png);
  console.log('PNG bytes:', png.length);
}

// Documento + exportaciones
const doc = construirDocumentoPlanex(p, m, { moneda: 'CUP' });
const figFlujos = doc.secciones.flatMap((s) => s.elementos).find((e) => e.tipo === 'figura' && e.figura.clave === 'flujos');
if (figFlujos?.tipo === 'figura') console.log('\nfigura flujos del doc, marcasY:', figFlujos.figura.marcasY.map((x) => x.etiqueta).join(' | '));

const { datos: pdf } = exportarPDF(p, m, { moneda: 'CUP' });
const buf = Buffer.from(await pdf.arrayBuffer());
writeFileSync('/tmp/salida-clinica-cup-r1.pdf', buf);
console.log('\nPDF bytes:', buf.length);

const { datos: docx } = await exportarDOCX(p, m, { moneda: 'CUP' });
const bufDocx = Buffer.from(await docx.arrayBuffer());
writeFileSync('/tmp/salida-clinica-cup-r1.docx', bufDocx);
console.log('DOCX bytes:', bufDocx.length);

// Texto del PDF: comprobar que las etiquetas del eje Y aparecen como texto vectorial
const latin = buf.toString('latin1');
const etiquetas = figuras[1].marcasY.map((x) => x.etiqueta);
for (const et of etiquetas.slice(0, 3)) console.log(`PDF contiene "${et}":`, latin.includes(et));
console.log('PDF contiene marca de año "7":', /\(7\) Tj/.test(latin));
