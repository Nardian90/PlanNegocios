// ============================================================================
// PLANEX-DOC-001 — Escenario E (documento extenso y tablas multipágina),
// Escenario F (inconsistencias visibles, no ocultas) y sincronía del worker
// de pdf.js con la versión instalada (misión §4 y §12 H).
// ============================================================================
import { describe, test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { construirDocumentoPlanex } from '../../src/lib/planex/doc/construir';
import { exportarPDF } from '../../src/lib/planex/io/pdf';
import { exportarDOCX } from '../../src/lib/planex/io/docx';
import type { TablaDoc } from '../../src/lib/planex/doc/modelo';

function textoPDF(buf: Buffer): string {
  const s = buf.toString('latin1');
  const partes: string[] = [];
  for (const m of s.matchAll(/\((.*?)\) Tj/g)) partes.push(m[1]);
  return partes.join(' ').replace(/\\(\(|\))/g, (x) => x.slice(1));
}

const p = crearProyectoClinica();
const m = computeProject(p);
const doc = construirDocumentoPlanex(p, m, { moneda: 'USD' });

// Await en el nivel superior del módulo (mismo patrón que pdf.test.ts).
const { datos: datosE } = exportarPDF(p, m, { moneda: 'USD' });
const buf = Buffer.from(await datosE.arrayBuffer());

describe('DOC-001 Escenario E — Documento extenso y tablas multipágina', () => {
  const paginas = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const texto = textoPDF(buf);

  test('el documento es extenso: muchas páginas con índice real', () => {
    expect(paginas).toBeGreaterThanOrEqual(18);
    // Índice con numeración de páginas reales (doble pasada).
    expect(texto).toContain('Índice');
    expect(/Notas, parámetros y supuestos del modelo\s*\d+/.test(texto)).toBe(true);
  });

  test('las cabeceras de la tabla multipágina se repiten (showHead everyPage)', async () => {
    // Caso FORZADO: un plan con 80 inversiones desborda la tabla de 4.10
    // varias páginas; su encabezado «Vida útil (años)» (exclusivo de esa
    // tabla) debe repetirse una vez por página ocupada.
    const pLargo = crearProyectoClinica();
    for (let i = 0; i < 80; i++) {
      pLargo.financiero.inversion.push({
        id: `inv-test-${i}`,
        concepto: `Activo de prueba ${i + 1} con denominación larga para el ajuste de línea`,
        categoria: 'inversion_fija',
        moneda: i % 2 === 0 ? 'USD' : 'CUP',
        monto: 5 + i,
        vidaUtilAnios: 5 + (i % 7),
        anioDisponible: 1,
        valorResidualPct: 0.05,
        metodoDepreciacion: 'lineal',
        observacion: 'fila de prueba generada para el caso multipágina',
      });
    }
    const mLargo = computeProject(pLargo);
    const { datos } = exportarPDF(pLargo, mLargo, { moneda: 'USD' });
    const bufLargo = Buffer.from(await datos.arrayBuffer());
    const textoLargo = textoPDF(bufLargo);
    const repeticiones = (textoLargo.match(/Vida útil \(años\)/g) ?? []).length;
    expect(repeticiones).toBeGreaterThanOrEqual(2);
    const paginasLargo = (bufLargo.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(paginasLargo).toBeGreaterThan(paginas);
  });

  test('los pies de página numeran todas las páginas tras la portada', () => {
    for (const patron of [`Página 2 de ${paginas}`, `Página ${Math.floor(paginas / 2)} de ${paginas}`, `Página ${paginas - 1} de ${paginas}`]) {
      expect(texto).toContain(patron);
    }
  });

  test('ninguna columna se pierde: los años extremos del estado de resultados están presentes', () => {
    const N = p.ajustes.horizonteAnios;
    for (const t of [0, 1, N]) expect(texto).toContain(`Año ${t}`);
    expect(texto).toContain('Total');
  });

  test('el Word extenso estructura las tablas anchas en orientación apaisada', async () => {
    const { datos: word } = await exportarDOCX(p, m, { moneda: 'USD' });
    const wbuf = Buffer.from(await word.arrayBuffer());
    const s = wbuf.toString('binary');
    // El ZIP no contiene imágenes (sin rasterizados) y sí muchas tablas.
    expect(s).not.toContain('media/');
  });
});

describe('DOC-001 Escenario F — Las inconsistencias NO se ocultan', () => {
  test('la insuficiencia de financiación aparece en análisis y diagnóstico', async () => {
    const p2 = crearProyectoClinica();
    // Retiramos aportaciones hasta crear insuficiencia.
    p2.aportaciones.forEach((a) => {
      a.montos = a.montos.map(() => 0);
    });
    const m2 = computeProject(p2);
    const doc2 = construirDocumentoPlanex(p2, m2, { moneda: 'USD' });
    const { datos } = exportarPDF(p2, m2, { moneda: 'USD' });
    const texto = textoPDF(Buffer.from(await datos.arrayBuffer()));

    const dif = m2.valores['diferencia_financiacion_k']?.[0] ?? 0;
    expect(dif).toBeLessThan(-0.05);
    // El documento lo dice en el análisis de financiación…
    expect(texto).toContain('insuficiencia de financiación');
    // …y en el resumen ejecutivo NO se presenta como viable.
    const resumen = doc2.secciones.find((s) => s.id === '4.4')!.elementos.find((e): e is Extract<typeof e, { tipo: 'analisis' }> => e.tipo === 'analisis')!;
    expect(resumen.bloque.texto).toContain('financiación insuficiente');
    // …y el diagnóstico lo reporta como advertencia importante.
    const diag = doc2.secciones.find((s) => s.id === 'diagnostico')!;
    const tablaHallazgos = diag.elementos.find((e): e is Extract<typeof e, { tipo: 'tabla' }> => e.tipo === 'tabla')!.tabla;
    expect(tablaHallazgos.filas.some((f) => f.join(' ').includes('FINANCIACION_INSUFICIENTE'))).toBe(true);
  });

  test('la demanda por encima de la capacidad queda marcada como LIMITADA', async () => {
    const p3 = crearProyectoClinica();
    p3.servicios.forEach((s) => {
      s.cantidadBaseMensual *= 40; // demanda imposible para la capacidad instalada
    });
    const m3 = computeProject(p3);
    const doc3 = construirDocumentoPlanex(p3, m3, { moneda: 'USD' });
    const tablaSvc = doc3.secciones
      .find((s) => s.id === '4.6')!
      .elementos.find((e): e is Extract<typeof e, { tipo: 'tabla' }> => e.tipo === 'tabla' && !!e.tabla.titulo?.includes('Servicios previstos'))!.tabla;
    expect(tablaSvc.filas.some((f) => f.some((c) => String(c).startsWith('LIMITADA')))).toBe(true);
    const { datos } = exportarPDF(p3, m3, { moneda: 'USD' });
    const texto = textoPDF(Buffer.from(await datos.arrayBuffer()));
    expect(texto).toContain('LIMITADA');
  });
});

describe('DOC-001 §4/§12 H — Worker de pdf.js sincronizado y desplegable', () => {
  test('public/pdfjs contiene el worker de la MISMA versión instalada', () => {
    const workerRuta = new URL('../../public/pdfjs/pdf.worker.min.mjs', import.meta.url).pathname;
    expect(existsSync(workerRuta)).toBe(true);
    const worker = readFileSync(workerRuta);
    expect(worker.length).toBeGreaterThan(500_000);
    const version = JSON.parse(readFileSync(new URL('../../public/pdfjs/VERSION.json', import.meta.url).pathname, 'utf-8')) as { pdfjsDist: string };
    const pkg = JSON.parse(readFileSync(new URL('../../node_modules/pdfjs-dist/package.json', import.meta.url).pathname, 'utf-8')) as { version: string };
    expect(version.pdfjsDist).toBe(pkg.version);
    const instalado = readFileSync(new URL('../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).pathname);
    expect(worker.equals(instalado)).toBe(true);
  });
});
