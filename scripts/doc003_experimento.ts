// Experimento DOC-003: comportamiento de jsPDF addPage y autoTable
// en páginas apaisadas (¿hereda orientación la página añadida por autoTable?)
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const doc = new jsPDF({ unit: 'mm', format: 'a4' });

// 1) addPage() sin args tras una apaisada
doc.addPage([297, 210], 'landscape');
console.log('Página 2 (apaisada explícita):', doc.internal.pageSize.getWidth().toFixed(1), 'x', doc.internal.pageSize.getHeight().toFixed(1));
doc.addPage(); // sin args
console.log('Página 3 (addPage sin args tras apaisada):', doc.internal.pageSize.getWidth().toFixed(1), 'x', doc.internal.pageSize.getHeight().toFixed(1));

// 2) autoTable en apaisada que desborda: ¿las páginas de continuación heredan?
const doc2 = new jsPDF({ unit: 'mm', format: 'a4' });
doc2.addPage([297, 210], 'landscape');
const filas: string[][] = [];
for (let i = 0; i < 60; i++) filas.push([`Fila ${i}`, `${i * 1000}`, `${i * 2}`, `${i * 3}`, `${i * 4}`, `${i * 5}`, `${i * 6}`, `${i * 7}`]);
autoTable(doc2, {
  head: [['Concepto', 'Año 1', 'Año 2', 'Año 3', 'Año 4', 'Año 5', 'Año 6', 'Año 7']],
  body: filas,
  startY: 20,
  margin: { left: 14, right: 14 },
  styles: { fontSize: 7.5 },
});
const total = doc2.getNumberOfPages();
console.log('autoTable apaisada desbordada → páginas:', total);
for (let i = 1; i <= total; i++) {
  doc2.setPage(i);
  console.log(`  pág ${i}:`, doc2.internal.pageSize.getWidth().toFixed(1), 'x', doc2.internal.pageSize.getHeight().toFixed(1));
}

// 3) Medición de palabras (getTextWidth) y posiciones de texto de salida
const doc3 = new jsPDF({ unit: 'mm', format: 'a4' });
doc3.setFont('helvetica', 'normal');
doc3.setFontSize(9);
const palabras = ['Ingresos', 'por', 'servicios', 'estomatológicos', '1.099.640,0'];
console.log('Anchos de palabra (mm) a 9pt:', palabras.map((p) => doc3.getTextWidth(p).toFixed(2)).join(', '));
console.log('Ancho espacio (mm):', doc3.getTextWidth(' ').toFixed(3));

// 4) ¿Cómo emite doc.text por palabra? Verificar Tj por palabra en el stream
doc3.text('PALABRA1', 14, 30);
doc3.text('PALABRA2', 60, 30);
const s = doc3.output('arraybuffer');
const latin = Buffer.from(s).toString('latin1');
const tjs = [...latin.matchAll(/\((.*?)\) Tj/g)].map((m) => m[1]);
console.log('Tjs emitidos:', JSON.stringify(tjs));
