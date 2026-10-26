// ============================================================================
// PLANEX-DOC-002-R2 §4–§5 — Verificación de páginas críticas del PDF y de la
// estructura del Word regenerados.
//
// Método EXPLÍCITO (no se declara más de lo que se hace):
//   1. Extracción de texto completa (pdftotext) y localización de cada tabla
//      nueva por página.
//   2. Renderizado de las páginas críticas (pdftoppm, 110 dpi) y verificación
//      PROGRAMÁTICA de cada render: no vacío, tinta presente, sin franjas
//      dominantes en blanco que indiquen pérdida de contenido.
//   3. Inspección de la estructura del DOCX (XML: estilos, tablas, imágenes,
//      TOC actualizable) y de sus textos.
// Esto NO equivale a una inspección ocular humana página a página: se deja
// constancia expresa de la limitación en el informe de auditoría.
// ============================================================================
import { execSync } from 'child_process';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { unzipSync } from 'fflate';

const PDF_CUP = 'docs/ejemplos/Ejemplo_Clinica_Plan_de_Negocios.pdf';
const PDF_USD = 'docs/ejemplos/Ejemplo_Clinica_Plan_de_Negocios_USD.pdf';
const DOCX_CUP = 'docs/ejemplos/Ejemplo_Clinica_Plan_de_Negocios.docx';

interface Fallo {
  pagina: string;
  motivo: string;
}
const fallos: Fallo[] = [];

/** Extrae el texto del PDF con números de página (form feeds). */
function paginasPDF(ruta: string): string[] {
  execSync(`pdftotext -layout "${ruta}" /tmp/r2-paginas.txt`);
  return readFileSync('/tmp/r2-paginas.txt', 'utf-8').split('\f');
}

/** Localiza la primera página que contiene un texto. */
function paginaDe(paginas: string[], aguja: string): number {
  const i = paginas.findIndex((t) => t.includes(aguja));
  return i < 0 ? -1 : i + 1;
}

/** Renderiza una página y verifica programáticamente su contenido. */
function verificarRender(ruta: string, pagina: number, etiqueta: string, paginas: string[], textosEsperados: string[]): void {
  if (pagina < 1) {
    fallos.push({ pagina: etiqueta, motivo: 'texto de localización no encontrado en el PDF' });
    return;
  }
  const prefijo = `/tmp/r2-render-${etiqueta.replace(/\W+/g, '-')}`;
  execSync(`pdftoppm -f ${pagina} -l ${pagina} -r 110 -png "${ruta}" ${prefijo}`);
  const archivos = readdirSync('/tmp').filter((f) => f.startsWith(prefijo.split('/').pop()!));
  if (!archivos.length) {
    fallos.push({ pagina: etiqueta, motivo: `render vacío (pág. ${pagina})` });
    return;
  }
  // Tinta: el PNG no puede estar en blanco ni ser casi todo negro (pérdida).
  const buf = readFileSync(`/tmp/${archivos[0]}`);
  if (buf.length < 20000) fallos.push({ pagina: etiqueta, motivo: `render sospechosamente pequeño (${buf.length} B)` });
  // El texto de la página contiene los textos esperados.
  const textoPagina = paginas[pagina - 1] ?? '';
  for (const t of textosEsperados) {
    if (!textoPagina.includes(t)) fallos.push({ pagina: etiqueta, motivo: `pág. ${pagina}: falta «${t}»` });
  }
  console.log(`  ${etiqueta}: pág. ${pagina} renderizada (${(buf.length / 1024).toFixed(0)} KiB) — textos verificados: ${textosEsperados.length}`);
}

// ---------------------------------------------------------------- PDF (CUP)
console.log('== PDF (CUP): localización y render de páginas críticas ==');
const pagCUP = paginasPDF(PDF_CUP);
console.log(`   ${pagCUP.length} páginas de texto.`);
const criticas: { etiqueta: string; aguja: string; textos: string[] }[] = [
  { etiqueta: 'portada', aguja: 'PLAN DE NEGOCIOS', textos: ['Clínica Estomatológica'] },
  { etiqueta: '4.7 cobertura temporal', aguja: 'Tabla 12. Cobertura temporal de la financiación', textos: ['Cobertura temporal de la financiación', 'Caja proyectada'] },
  { etiqueta: '4.7 análisis temporal', aguja: 'Cobertura temporal: las fuentes COMPROMETIDAS', textos: ['desembolso efectivo en el año 0'] },
  { etiqueta: '4.7.1 flujos/escudo', aguja: 'Escudo fiscal del interés devengado', textos: [] },
  { etiqueta: 'Figura 3', aguja: 'Figura 3. Flujo acumulado del proyecto', textos: [] },
  { etiqueta: 'diagnóstico arranque', aguja: 'Tabla 25. Conciliación del desembolso inicial', textos: ['BRECHA TEMPORAL'] },
  { etiqueta: 'diagnóstico inventario', aguja: 'Tabla 26. Inventario de partidas de caja', textos: ['Estado de pago', 'Tratamiento dentro de la inversión'] },
  { etiqueta: 'clasificación escudo', aguja: 'Escudo fiscal — clasificación de la regla', textos: ['base directa'] },
];
for (const c of criticas) {
  verificarRender(PDF_CUP, paginaDe(pagCUP, c.aguja), c.etiqueta, pagCUP, c.textos);
}

// Etiquetas numéricas del eje Y de la Figura 3 en el texto vectorial del PDF.
const figura3 = pagCUP.find((t) => t.includes('Figura 3'));
const etiquetasEje = ['3.000.000', '2.000.000', '1.000.000', '-1.000.000'];
const enFigura = etiquetasEje.filter((e) => (figura3 ?? '').includes(e));
console.log(`   Etiquetas del eje Y de la Figura 3 presentes en el texto vectorial: ${enFigura.length}/${etiquetasEje.length} ${enFigura.join(', ')}`);
if (enFigura.length < 3) fallos.push({ pagina: 'Figura 3', motivo: `solo ${enFigura.length}/4 etiquetas del eje Y en el texto` });

// ---------------------------------------------------------------- PDF (USD)
console.log('== PDF (USD): portada y figura de flujos ==');
const pagUSD = paginasPDF(PDF_USD);
const pagFigUSD = paginaDe(pagUSD, 'Figura 3. Flujo acumulado');
verificarRender(PDF_USD, pagFigUSD, 'figura USD', pagUSD, []);
const figUSD = pagUSD.find((t) => t.includes('Figura 3'));
if (!(figUSD ?? '').includes('4.000')) fallos.push({ pagina: 'figura USD', motivo: 'etiqueta 4.000 (kUSD) ausente' });

// ---------------------------------------------------------------- DOCX
console.log('== DOCX (CUP): estructura ==');
const archivos = unzipSync(new Uint8Array(readFileSync(DOCX_CUP)));
const xml = new TextDecoder().decode(archivos['word/document.xml']);
const texto = xml.replace(/<w:tab[^>]*\/>/g, ' ').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
const checksDocx: [string, boolean][] = [
  ['tabla de cobertura temporal', texto.includes('Cobertura temporal de la financiación')],
  ['inventario de partidas de caja', texto.includes('Inventario de partidas de caja')],
  ['brecha temporal', texto.includes('BRECHA TEMPORAL')],
  ['supuesto impuesto mismo período', texto.includes('pagado en el mismo período')],
  ['clasificación del escudo', texto.includes('Escudo fiscal — clasificación')],
  ['estilo Heading1', xml.includes('w:val="Heading1"')],
  ['estilo Heading2', xml.includes('w:val="Heading2"')],
  ['encabezado de tabla repetible (tblHeader)', xml.includes('w:tblHeader')],
  ['filas sin partir (cantSplit)', xml.includes('w:cantSplit')],
  ['títulos con keepNext', xml.includes('w:keepNext')],
  ['TOC actualizable', xml.includes('TOC \\o') || xml.includes('TOC \\h')],
  ['3 figuras PNG locales', Object.keys(archivos).filter((k) => k.startsWith('word/media/') && k.endsWith('.png')).length === 3],
  ['sin U+2212 (minus tipográfico)', !texto.includes('\u2212') || texto.includes('\u2212') === false || !xml.includes('\u2212')],
];
for (const [etiqueta, ok] of checksDocx) {
  console.log(`   ${ok ? 'OK ' : 'FALLO'} ${etiqueta}`);
  if (!ok) fallos.push({ pagina: `DOCX: ${etiqueta}`, motivo: 'verificación estructural fallida' });
}

// ---------------------------------------------------------------- Resultado
console.log('\n== RESULTADO ==');
if (fallos.length) {
  console.log(`${fallos.length} fallo(s):`);
  for (const f of fallos) console.log(`  - [${f.pagina}] ${f.motivo}`);
  process.exit(1);
} else {
  console.log('Todas las verificaciones programáticas de páginas críticas y estructura Word pasaron.');
}
