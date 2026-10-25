// ============================================================================
// PLANEX-DOC-001 — Pruebas de MONEDA DE PRESENTACIÓN (misión §5, escenarios
// A, B y C): conversión única desde la moneda de origen, escalado correcto,
// unidades en tablas, integridad de los datos originales, documentación de
// la tasa y huellas independientes de la moneda.
// ============================================================================
import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { crearProyectoCentro } from '../../src/lib/planex/templates/centro';
import { construirDocumentoPlanex } from '../../src/lib/planex/doc/construir';
import { crearContextoMoneda, tasaCambioDe, monedaPresentacionDe } from '../../src/lib/planex/doc/moneda';
import { generarAnalisis, PRESENTACION_NATIVA } from '../../src/lib/planex/engine/analisis';
import { exportarPDF } from '../../src/lib/planex/io/pdf';
import { fmtK } from '../../src/lib/planex/format';
import type { TablaDoc } from '../../src/lib/planex/doc/modelo';

function tablaPorTitulo(doc: ReturnType<typeof construirDocumentoPlanex>, titulo: string): TablaDoc | null {
  for (const s of doc.secciones) {
    for (const el of s.elementos) {
      if (el.tipo === 'tabla' && el.tabla.titulo && el.tabla.titulo.includes(titulo)) return el.tabla;
    }
  }
  return null;
}

describe('DOC-001 §5 — Contexto de conversión', () => {
  const p = crearProyectoClinica();
  const ctxUsd = crearContextoMoneda(p, 'USD');
  const ctxCup = crearContextoMoneda(p, 'CUP');
  const tasa = 743; // parámetro demo tipo_cambio (tasa ilustrativa, pendiente de validación oficial)

  test('la tasa se lee del parámetro existente tipo_cambio (fuente única)', () => {
    const t = tasaCambioDe(p);
    expect(t.tasa).toBe(tasa);
    // DOC-002-R1 §6: fecha de corte del supuesto ALINEADA con la fecha del
    // documento (2026-10-25); una fecha posterior la marcaría el diagnóstico.
    expect(t.fecha).toBe('2026-10-25');
    expect(p.general.fecha).toBe('2026-10-25');
    expect(t.fecha <= p.general.fecha).toBe(true);
    expect(t.fuente.length).toBeGreaterThan(0);
    expect(t.demo).toBe(true);
  });

  test('USD: kUSD identidad; CUP completos → miles de USD vía tasa', () => {
    expect(ctxUsd.kUSDaK(1480)).toBe(1480);
    expect(ctxUsd.cupAK(743_000)).toBe(1); // 743 000 CUP = 1000 USD = 1 kUSD
    expect(ctxUsd.cupAUsd(743_000)).toBe(1000);
    expect(ctxUsd.montoFilaAK({ id: 'x', concepto: '', categoria: 'inversion_fija', moneda: 'CUP', monto: 100, vidaUtilAnios: 5, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: '' })).toBeCloseTo(100 / 743, 10); // 100 kCUP / 743 = 0,1346 kUSD
  });

  test('CUP: kUSD → kCUP multiplicando por la tasa; CUP → kCUP / 1000; fila USD → kCUP', () => {
    expect(ctxCup.kUSDaK(1480)).toBe(1480 * 743); // 1.099.640,0
    expect(ctxCup.cupAK(400_000)).toBe(400);
    expect(ctxCup.montoFilaAK({ id: 'x', concepto: '', categoria: 'inversion_fija', moneda: 'USD', monto: 100, vidaUtilAnios: 5, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: '' })).toBe(100 * 743); // 74 300,0
  });

  test('las etiquetas de unidad distinguen kUSD de kCUP (misión §5.1)', () => {
    expect(ctxUsd.unidadTabla).toBe('Miles de USD (kUSD)');
    expect(ctxCup.unidadTabla).toBe('Miles de CUP (kCUP)');
    expect(ctxUsd.unidadCorta).toBe('kUSD');
    expect(ctxCup.unidadCorta).toBe('kCUP');
    expect(ctxUsd.unidadLarga).toBe('miles de USD');
    expect(ctxCup.unidadLarga).toBe('miles de CUP');
  });

  test('por defecto la presentación de un plan nuevo es USD (retrocompatible)', () => {
    expect(monedaPresentacionDe(p)).toBe('USD');
  });
});

describe('DOC-001 Escenario A — Presentación en USD', () => {
  const p = crearProyectoClinica();
  const m = computeProject(p);
  const doc = construirDocumentoPlanex(p, m, { moneda: 'USD' });

  test('el documento declara la moneda y su unidad en tablas financieras', () => {
    expect(doc.meta.moneda).toBe('USD');
    expect(doc.meta.unidadTabla).toBe('Miles de USD (kUSD)');
  });

  test('las cifras del modelo llegan sin conversión (unidad nativa kUSD)', () => {
    const cifras = tablaPorTitulo(doc, 'Cifras clave');
    expect(cifras).not.toBeNull();
    const filaInv = cifras!.filas.find((f) => f[0].includes('Inversión total'))!;
    expect(filaInv[1]).toBe(fmtK(m.indicadores.inversionTotalKUSD)); // 1.480,0
    expect(filaInv[0]).toContain('miles de USD');
    expect(cifras!.filas[0][0]).toBe('Estado general del plan');
  });

  test('los salarios permanecen en CUP (metodología 4.9) con equivalente USD', () => {
    const fuerza = tablaPorTitulo(doc, 'Fuerza de trabajo por categoría');
    expect(fuerza).not.toBeNull();
    expect(fuerza!.encabezados.some((h) => h.includes('CUP'))).toBe(true);
    expect(fuerza!.encabezados.some((h) => h.includes('Equivalente anual (USD)'))).toBe(true);
  });

  test('el índice de inversiones muestra la moneda de origen y la presentación', () => {
    const inv = tablaPorTitulo(doc, 'Inversiones por concepto');
    expect(inv!.encabezados).toContain('Moneda');
    expect(inv!.encabezados.some((h) => h.startsWith('En USD (kUSD)'))).toBe(true);
  });

  test('la nota del documento documenta tasa, fecha y fuente (misión §5.2.10)', () => {
    expect(doc.meta.notaMoneda).toContain('USD');
    expect(doc.meta.notaMoneda).toContain('743,0 CUP por USD');
    // DOC-002-R1 §6: fecha de corte del supuesto (igual a la del documento),
    // presentada como supuesto ilustrativo, no como cotización observada.
    expect(doc.meta.notaMoneda).toContain('2026-10-25');
    expect(doc.meta.notaMoneda).toContain('fecha de corte del supuesto ilustrativo, no una cotización observada');
    expect(doc.meta.notaMoneda.toLowerCase()).toContain('una sola vez');
  });

  test('el PDF exportado contiene las unidades USD/kUSD', async () => {
    const { datos } = exportarPDF(p, m, { moneda: 'USD' });
    const buf = Buffer.from(await datos.arrayBuffer());
    const s = buf.toString('latin1');
    const partes: string[] = [];
    for (const mm of s.matchAll(/\((.*?)\) Tj/g)) partes.push(mm[1]);
    const texto = partes.join(' ').replace(/\\(\(|\))/g, (x) => x.slice(1));
    expect(texto).toContain('Miles de USD (kUSD)');
    expect(texto).toContain('1.480,0');
  });
});

describe('DOC-001 Escenario B — Presentación en CUP', () => {
  const p = crearProyectoClinica();
  const original = JSON.parse(JSON.stringify(p)) as typeof p;
  const m = computeProject(p);
  const tasa = 743;
  const doc = construirDocumentoPlanex(p, m, { moneda: 'CUP' });

  test('los importes convertibles se escalan a kCUP (= kUSD × tasa) exactamente', () => {
    const cifras = tablaPorTitulo(doc, 'Cifras clave');
    const invKUSD = m.indicadores.inversionTotalKUSD;
    const esperado = fmtK(invKUSD * tasa);
    const filaInv = cifras!.filas.find((f) => f[0].includes('Inversión total'))!;
    expect(filaInv[1]).toBe(esperado); // 1.099.640,0
    expect(filaInv[0]).toContain('miles de CUP');
  });

  test('no se confunde USD con miles: la unidad de tabla declara kCUP', () => {
    expect(doc.meta.unidadTabla).toBe('Miles de CUP (kCUP)');
  });

  test('los salarios SIGUEN en CUP y no se duplican en kCUP (§5.1)', () => {
    const fuerza = tablaPorTitulo(doc, 'Fuerza de trabajo por categoría');
    expect(fuerza!.encabezados.some((h) => h.includes('CUP'))).toBe(true);
    expect(fuerza!.encabezados.some((h) => h.includes('Equivalente'))).toBe(false); // ya es la moneda pedida
  });

  test('LOS DATOS ORIGINALES NO SE MODIFICAN al cambiar la moneda (§5.2.1)', () => {
    expect(JSON.stringify(p)).toBe(JSON.stringify(original));
  });

  test('las magnitudes no monetarias NO se convierten (§5.2.7)', () => {
    const docUsd = construirDocumentoPlanex(p, m, { moneda: 'USD' });
    const getCant = (d: typeof docUsd) => {
      const cifras = tablaPorTitulo(d, 'Cifras clave');
      return cifras!.filas.find((f) => f[0].startsWith('Empleos directos'))![1];
    };
    expect(getCant(docUsd)).toBe(getCant(doc)); // misma plantilla de trabajadores
    const horizonteUsd = docUsd.secciones.find((s) => s.id === '4.4')!;
    const horizonteCup = doc.secciones.find((s) => s.id === '4.4')!;
    expect(
      (horizonteUsd.elementos.find((e) => e.tipo === 'tabla') as { tabla: TablaDoc }).tabla.filas.find((f) => f[0].startsWith('Horizonte'))![1]
    ).toBe(
      (horizonteCup.elementos.find((e) => e.tipo === 'tabla') as { tabla: TablaDoc }).tabla.filas.find((f) => f[0].startsWith('Horizonte'))![1]
    );
  });

  test('el análisis narrativo se emite en la moneda de presentación (misión §3.2)', () => {
    const pres = { k: (n: number) => fmtK(n * tasa), corto: 'kCUP', largo: 'miles de CUP' };
    const textos = generarAnalisis(p, m, pres);
    const nativo = generarAnalisis(p, m, PRESENTACION_NATIVA);
    expect(textos.aportaciones.texto).toContain('miles de CUP');
    expect(textos.aportaciones.texto).not.toContain('kUSD');
    expect(nativo.aportaciones.texto).toContain('miles de USD');
  });

  test('cambiar la moneda NO invalida los análisis editados: huellas idénticas (§5.3)', () => {
    const pres = { k: (n: number) => fmtK(n * tasa), corto: 'kCUP', largo: 'miles de CUP' };
    const a = generarAnalisis(p, m, PRESENTACION_NATIVA);
    const b = generarAnalisis(p, m, pres);
    for (const clave of Object.keys(a) as (keyof typeof a)[]) {
      expect(a[clave].huella).toBe(b[clave].huella);
    }
  });
});

describe('DOC-001 Escenario C — Cambio de tasa de cambio', () => {
  const p = crearProyectoClinica();
  const m1 = computeProject(p);
  const original = JSON.parse(JSON.stringify(p)) as typeof p;

  test('al cambiar la tasa, los importes convertibles se actualizan y los originales quedan intactos', () => {
    const doc400 = construirDocumentoPlanex(p, m1, { moneda: 'CUP' });
    // El usuario edita el parámetro tipo_cambio (Nivel A).
    const param = p.parametros.find((x) => x.id === 'tipo_cambio')!;
    param.valor = 800;
    const m2 = computeProject(p);
    const doc800 = construirDocumentoPlanex(p, m2, { moneda: 'CUP' });

    const fila400 = tablaPorTitulo(doc400, 'Cifras clave')!.filas.find((f) => f[0].includes('Inversión total'))!;
    const fila800 = tablaPorTitulo(doc800, 'Cifras clave')!.filas.find((f) => f[0].includes('Inversión total'))!;
    const inv400 = fila400[1];
    const inv800 = fila800[1];
    // La inversión en kUSD NO cambia con la tasa (motor nativo)…
    expect(fila800[0]).toContain('miles de CUP');
    // …pero el equivalente en kCUP se duplica con la tasa.
    const kusd800 = computeProject({ ...p, parametros: p.parametros.map((x) => ({ ...x })) }).indicadores.inversionTotalKUSD;
    expect(inv800).toBe(fmtK(kusd800 * 800));
    expect(inv800).not.toBe(inv400);
    // El parámetro editado PERSISTE (es un dato del usuario), pero ningún otro
    // importe del plan se reescribió:
    expect(JSON.stringify(p.parametros.find((x) => x.id === 'tipo_cambio')!.valor)).toBe('800');
    expect(JSON.stringify(p.financiero.inversion)).toBe(JSON.stringify(original.financiero.inversion));
    expect(JSON.stringify(p.personal)).toBe(JSON.stringify(original.personal));
    expect(JSON.stringify(p.aportaciones)).toBe(JSON.stringify(original.aportaciones));
  });

  test('el documento identifica la tasa aplicada en sus notas (§5.2.10)', () => {
    const m = computeProject(p);
    const doc = construirDocumentoPlanex(p, m, { moneda: 'CUP' });
    expect(doc.meta.notaMoneda).toContain('800,0 CUP por USD');
  });
});

describe('DOC-001 §5.3 — Plantillas Centro y persistencia de la preferencia', () => {
  test('la plantilla Centro también exporta en ambas monedas con coherencia', () => {
    const p = crearProyectoCentro();
    const m = computeProject(p);
    const usd = construirDocumentoPlanex(p, m, { moneda: 'USD' });
    const cup = construirDocumentoPlanex(p, m, { moneda: 'CUP' });
    expect(usd.meta.moneda).toBe('USD');
    expect(cup.meta.moneda).toBe('CUP');
    const tasa = tasaCambioDe(p).tasa;
    const invUsd = m.indicadores.inversionTotalKUSD;
    const cifrasUsd = tablaPorTitulo(usd, 'Cifras clave')!;
    const cifrasCup = tablaPorTitulo(cup, 'Cifras clave')!;
    expect(cifrasUsd.filas.find((f) => f[0].includes('Inversión total'))![1]).toBe(fmtK(invUsd));
    expect(cifrasCup.filas.find((f) => f[0].includes('Inversión total'))![1]).toBe(fmtK(invUsd * tasa));
  });

  test('ajustes.monedaPresentacion es opcional y retrocompatible en el JSON', () => {
    const p = crearProyectoClinica();
    const sinCampo = JSON.parse(JSON.stringify(p)) as Record<string, { horizonteAnios: number }>;
    delete sinCampo.ajustes;
    const ajustes = { horizonteAnios: 10 } as typeof p.ajustes;
    expect(ajustes.monedaPresentacion ?? 'USD').toBe('USD');
    expect(monedaPresentacionDe(p)).toBe('USD');
  });
});
