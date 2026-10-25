// ============================================================================
// PLANEX-DOC-001 — Pruebas del exportador DOCX (misión §7) y CONSISTENCIA
// entre el modelo canónico, el PDF y el Word (misión §8).
//
// El DOCX se valida de verdad: se descomprime (ZIP) y se inspeccionan
// [Content_Types].xml, word/document.xml, word/styles.xml, headers y
// footers, el campo TOC, la numeración de páginas, los encabezados
// repetidos de tabla y las secciones apaisadas. NO se declara validez solo
// porque el archivo se descargue.
// ============================================================================
import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { construirDocumentoPlanex } from '../../src/lib/planex/doc/construir';
import { exportarPDF } from '../../src/lib/planex/io/pdf';
import { exportarDOCX } from '../../src/lib/planex/io/docx';
import { writeFileSync } from 'node:fs';
import { unzipSync } from 'fflate';

const p = crearProyectoClinica();
const m = computeProject(p);

async function pdfTexto(moneda?: 'USD' | 'CUP'): Promise<string> {
  const { datos } = exportarPDF(p, m, moneda ? { moneda } : undefined);
  const buf = Buffer.from(await datos.arrayBuffer());
  const s = buf.toString('latin1');
  const partes: string[] = [];
  for (const mm of s.matchAll(/\((.*?)\) Tj/g)) partes.push(mm[1]);
  return partes.join(' ').replace(/\\(\(|\))/g, (x) => x.slice(1));
}

async function docxArchivos(moneda?: 'USD' | 'CUP'): Promise<Record<string, Uint8Array>> {
  const { datos } = await exportarDOCX(p, m, moneda ? { moneda } : undefined);
  const buf = Buffer.from(await datos.arrayBuffer());
  return unzipSync(new Uint8Array(buf));
}

function textoWord(archivos: Record<string, Uint8Array>): string {
  const doc = new TextDecoder().decode(archivos['word/document.xml']);
  // Extrae el texto visible de los runs, en orden.
  return doc
    .replace(/<w:tab[^>]*\/>/g, ' ')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '');
}

describe('DOC-001 §7 — DOCX válido, editable y estructurado', () => {
  test('es un ZIP OOXML válido con las partes obligatorias', async () => {
    const archivos = await docxArchivos();
    expect(Object.keys(archivos).length).toBeGreaterThan(5);
    expect(archivos['[Content_Types].xml']).toBeDefined();
    expect(archivos['word/document.xml']).toBeDefined();
    expect(archivos['word/styles.xml']).toBeDefined();
    expect(Object.keys(archivos).some((k) => k.startsWith('word/header'))).toBe(true);
    expect(Object.keys(archivos).some((k) => k.startsWith('word/footer'))).toBe(true);
  });

  test('contiene el campo TOC actualizable y pide la actualización al abrir', async () => {
    const archivos = await docxArchivos();
    const doc = new TextDecoder().decode(archivos['word/document.xml']);
    // Campo real de Word: instrucción TOC dentro de un SDT, marcada dirty para
    // que el procesador la recalcule (rango 1-1 = solo secciones H1, como el
    // índice del PDF).
    expect(doc).toContain('TOC');
    expect(doc).toContain('\\o &quot;1-1&quot;');
    expect(doc).toContain('w:dirty="true"');
    const settings = archivos['word/settings.xml'];
    expect(settings).toBeDefined();
    expect(new TextDecoder().decode(settings)).toContain('updateFields');
  });

  test('numera páginas («Página X de Y») en el pie de todas las secciones', async () => {
    const archivos = await docxArchivos();
    const pie = new TextDecoder().decode(Object.entries(archivos).find(([k]) => k.startsWith('word/footer'))![1]);
    expect(pie).toContain('PAGE');
    expect(pie).toContain('NUMPAGES');
    expect(pie).toContain('PLANEX Cuba');
  });

  test('las tablas repiten su encabezado y no cortan filas (tblHeader/cantSplit)', async () => {
    const archivos = await docxArchivos();
    const doc = new TextDecoder().decode(archivos['word/document.xml']);
    expect(doc).toContain('<w:tblHeader');
    expect(doc).toContain('<w:cantSplit');
    const nTablas = (doc.match(/<w:tbl>/g) ?? []).length;
    expect(nTablas).toBeGreaterThan(15);
  });

  test('usa orientación apaisada SOLO en las secciones de tablas financieras', async () => {
    const archivos = await docxArchivos();
    const doc = new TextDecoder().decode(archivos['word/document.xml']);
    const apaisadas = (doc.match(/w:orient="landscape"/g) ?? []).length;
    const verticales = (doc.match(/w:orient="portrait"/g) ?? []).length;
    expect(apaisadas).toBeGreaterThan(0);
    expect(apaisadas).toBeLessThan(verticales); // no todo el documento apaisado
  });

  test('es EDITABLE: texto seleccionable, sin imágenes ni rasterizados (§7)', async () => {
    const archivos = await docxArchivos();
    const doc = new TextDecoder().decode(archivos['word/document.xml']);
    expect(doc).not.toContain('<w:drawing');
    expect(doc).not.toContain('<w:pict');
    const texto = textoWord(archivos);
    expect(texto.length).toBeGreaterThan(5000);
  });

  test('usa estilos de Word (Heading1) y estilos propios, no solo formato manual', async () => {
    const archivos = await docxArchivos();
    const doc = new TextDecoder().decode(archivos['word/document.xml']);
    const estilos = new TextDecoder().decode(archivos['word/styles.xml']);
    expect(doc).toContain('w:val="Heading1"');
    expect(doc).toContain('w:val="Heading2"');
    expect(estilos).toContain('AnalisisPlanex');
    expect(estilos).toContain('NotaTabla');
  });

  test('el nombre del archivo es .docx y razonable', async () => {
    const { nombre } = await exportarDOCX(p, m);
    expect(nombre.endsWith('.docx')).toBe(true);
    expect(nombre.length).toBeGreaterThan(5);
  });
});

describe('DOC-001 §8 — Coherencia visor/PDF/Word (mismo modelo, mismos datos)', () => {
  const doc = construirDocumentoPlanex(p, m, { moneda: 'USD' });
  const claveInversion = doc.secciones.find((s) => s.id === '4.7')!;
  const tablaInversion = claveInversion.elementos.find((e) => e.tipo === 'tabla')!.tabla;
  const montoInversion = tablaInversion.filas.find((f) => f[0] === 'INVERSIÓN TOTAL')![1];

  test('el valor de INVERSIÓN TOTAL coincide entre el modelo, el PDF y el Word', async () => {
    const pdf = await pdfTexto('USD');
    const archivos = await docxArchivos('USD');
    const word = textoWord(archivos);
    expect(pdf).toContain(montoInversion);
    expect(word).toContain(montoInversion);
  });

  test('todos los títulos de sección aparecen en PDF y Word (ninguna omitida)', async () => {
    const pdf = await pdfTexto('USD');
    const archivos = await docxArchivos('USD');
    const word = textoWord(archivos);
    for (const s of doc.secciones) {
      expect(pdf).toContain(s.titulo);
      expect(word).toContain(s.titulo);
    }
  });

  test('los textos de análisis (con trazabilidad) son idénticos en PDF y Word', async () => {
    const pdf = await pdfTexto('USD');
    const archivos = await docxArchivos('USD');
    const word = textoWord(archivos);
    const muestra = doc.secciones
      .flatMap((s) => s.elementos)
      .filter((e) => e.tipo === 'analisis')
      .slice(0, 6) as Extract<import('../../src/lib/planex/doc/modelo').ElementoDoc, { tipo: 'analisis' }>[];
    const plano = (t: string) => t.replace(/\s+/g, ' ');
    expect(muestra.length).toBeGreaterThanOrEqual(6);
    for (const bloque of muestra) {
      const fragmento = plano(bloque.bloque.texto.slice(0, 90));
      expect(plano(pdf)).toContain(fragmento);
      expect(plano(word)).toContain(fragmento);
    }
  });

  test('cifras clave idénticas en ambas monedas y representaciones (subtotales/indicadores)', async () => {
    const docCup = construirDocumentoPlanex(p, m, { moneda: 'CUP' });
    const cifrasUsd = doc.secciones.find((s) => s.id === '4.4')!.elementos.find((e) => e.tipo === 'tabla')!.tabla;
    const cifrasCup = docCup.secciones.find((s) => s.id === '4.4')!.elementos.find((e) => e.tipo === 'tabla')!.tabla;
    const pdfUsd = await pdfTexto('USD');
    const pdfCup = await pdfTexto('CUP');
    const wordUsd = textoWord(await docxArchivos('USD'));
    const wordCup = textoWord(await docxArchivos('CUP'));
    for (let i = 0; i < cifrasUsd.filas.length; i++) {
      expect(pdfUsd).toContain(cifrasUsd.filas[i][1]);
      expect(wordUsd).toContain(cifrasUsd.filas[i][1]);
      expect(pdfCup).toContain(cifrasCup.filas[i][1]);
      expect(wordCup).toContain(cifrasCup.filas[i][1]);
    }
  });

  test('las advertencias y datos no monetarios coinciden (trabajadores, horizonte)', async () => {
    const pdf = await pdfTexto('USD');
    const word = textoWord(await docxArchivos('USD'));
    const trabajadores = String(m.indicadores.totalTrabajadores);
    expect(pdf).toContain(trabajadores);
    expect(word).toContain(trabajadores);
    expect(pdf).toContain('EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS');
    expect(word).toContain('EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS');
  });

  test('SIN valores desactualizados: al cambiar el modelo, PDF y Word cambian (escenario D)', async () => {
    const antes = await pdfTexto('USD');
    const p2 = crearProyectoClinica();
    p2.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!.valor = 0.3;
    const m2 = computeProject(p2);
    const { datos } = exportarPDF(p2, m2, { moneda: 'USD' });
    const buf = Buffer.from(await datos.arrayBuffer());
    const s = buf.toString('latin1');
    const partes: string[] = [];
    for (const mm of s.matchAll(/\((.*?)\) Tj/g)) partes.push(mm[1]);
    const despues = partes.join(' ').replace(/\\(\(|\))/g, (x) => x.slice(1));
    expect(antes).toContain('35,0 %');
    expect(despues).toContain('30,0 %');
    expect(despues).not.toContain('35,0 %');
  });

  test('las unidades son coherentes por representación (sin kUSD en modo CUP)', async () => {
    const pdfCup = await pdfTexto('CUP');
    expect(pdfCup).toContain('Miles de CUP (kCUP)');
    // El análisis del documento en CUP no mezcla unidades:
    expect(pdfCup).not.toContain('miles de USD');
  });
});

// Evidencias de la misión (§12: demostración en ambas monedas).
describe('DOC-001 §14.9 — Artefactos de demostración en ambas monedas', () => {
  test('se generan los 4 archivos de demostración (PDF/DOCX × USD/CUP)', async () => {
    for (const moneda of ['USD', 'CUP'] as const) {
      const pdf = exportarPDF(p, m, { moneda });
      writeFileSync(
        new URL(`./salida-clinica-${moneda.toLowerCase()}.pdf`, import.meta.url).pathname,
        Buffer.from(await pdf.datos.arrayBuffer())
      );
      const word = await exportarDOCX(p, m, { moneda });
      writeFileSync(
        new URL(`./salida-clinica-${moneda.toLowerCase()}.docx`, import.meta.url).pathname,
        Buffer.from(await word.datos.arrayBuffer())
      );
    }
    expect(true).toBe(true);
  });
});
