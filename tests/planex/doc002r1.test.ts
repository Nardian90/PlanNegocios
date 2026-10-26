// ============================================================================
// MISIÓN PLANEX-DOC-002-R1 — Pruebas independientes de cierre de hallazgos.
//
// §8 de la misión: aserciones INDEPENDIENTES (no repiten las suites previas):
//   · Ingreso del año 1 en ambas monedas (canónico, PDF y DOCX): 967,8 kUSD
//     = 719.075,4 kCUP a la tasa 743 — no limitado a la inversión total.
//   · Conciliación de intereses devengados/pagados/capitalizados en FCFF/FCFE.
//   · Cobertura de la financiación inicial desde salidas de caja EXPLÍCITAS
//     (pérdidas no monetarias, ingresos del año 0, devengos y resultados
//     negativos en escenarios distintos).
//   · Consistencia del año de ampliación en tablas, narrativas y figuras.
//   · Consistencia de los gráficos con las tablas de origen (ejes etiquetados).
//   · Fecha de referencia de la tasa respecto a la fecha del documento.
//   · Base matemática exacta de la reserva de dividendos (H5) e hipótesis de
//     inflación de costos fijos con sensibilidad (H4).
// ============================================================================
import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { construirDocumentoPlanex } from '../../src/lib/planex/doc/construir';
import { exportarPDF } from '../../src/lib/planex/io/pdf';
import { exportarDOCX } from '../../src/lib/planex/io/docx';
import { generarAnalisis } from '../../src/lib/planex/engine/analisis';
import { conciliarArranque } from '../../src/lib/planex/engine/flujos';
import { diagnosticar } from '../../src/lib/planex/model/controles';
import { generarFiguras, rasterizarPNG, rejillaY, marcasAnios, PrimitivaFigura } from '../../src/lib/planex/doc/figuras';
import { notaConversion, crearContextoMoneda, tasaCambioDe } from '../../src/lib/planex/doc/moneda';
import { fichasParametros } from '../../src/lib/planex/doc/trazabilidad';
import { fmtK } from '../../src/lib/planex/format';
import { PlanexProject } from '../../src/lib/planex/types';
import { unzipSync, unzlibSync } from 'fflate';

const p = crearProyectoClinica();
const m = computeProject(p);
const v = (id: string, t: number) => m.valores[id]?.[t] ?? 0;
const docCUP = construirDocumentoPlanex(p, m, { moneda: 'CUP' });
const docUSD = construirDocumentoPlanex(p, m, { moneda: 'USD' });

function textoDocumento(d: typeof docCUP): string {
  const trozos: string[] = [];
  for (const s of d.secciones) {
    trozos.push(s.titulo);
    for (const el of s.elementos) {
      if (el.tipo === 'parrafo' || el.tipo === 'aviso') trozos.push(el.texto);
      else if (el.tipo === 'campos') el.items.forEach((i) => trozos.push(i.etiqueta, i.valor));
      else if (el.tipo === 'subtitulo') trozos.push(el.texto);
      else if (el.tipo === 'analisis') trozos.push(el.bloque.titulo, el.bloque.texto);
      else if (el.tipo === 'tabla') {
        trozos.push(el.tabla.titulo ?? '');
        el.tabla.encabezados.forEach((h) => trozos.push(h));
        el.tabla.filas.forEach((f) => f.forEach((c) => trozos.push(String(c))));
      } else if (el.tipo === 'figura') {
        trozos.push(el.figura.titulo, el.figura.unidad, el.figura.ejeX, el.figura.nota);
        el.figura.leyenda.forEach((l) => trozos.push(l.etiqueta));
      }
    }
  }
  d.portada.cifras.forEach((c) => trozos.push(c.etiqueta, c.valor));
  return trozos.join('\n');
}

async function pdfTexto(moneda: 'USD' | 'CUP'): Promise<string> {
  const { datos } = exportarPDF(p, m, { moneda });
  const buf = Buffer.from(await datos.arrayBuffer());
  const s = buf.toString('latin1');
  const partes: string[] = [];
  for (const mm of s.matchAll(/\((.*?)\) Tj/g)) partes.push(mm[1]);
  return partes.join(' ').replace(/\\(\(|\))/g, (x) => x.slice(1));
}

async function docxTexto(moneda: 'USD' | 'CUP'): Promise<string> {
  const { datos } = await exportarDOCX(p, m, { moneda });
  const buf = Buffer.from(await datos.arrayBuffer());
  const archivos = unzipSync(new Uint8Array(buf));
  const doc = new TextDecoder().decode(archivos['word/document.xml']);
  return doc.replace(/<w:tab[^>]*\/>/g, ' ').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
}

const clon = (): PlanexProject => JSON.parse(JSON.stringify(p)) as PlanexProject;

// ============================================================================
// H1 — Conciliación CUP/USD del ingreso del año 1 (canónico, PDF y DOCX)
// ============================================================================

describe('DOC-002-R1 §1 — Ingreso del año 1 en ambas monedas, en canónico/PDF/DOCX', () => {
  test('el motor calcula 967,8 kUSD exactos y 967,8 × 743 = 719.075,4 kCUP', () => {
    expect(v('ingresos_servicios_k', 1)).toBeCloseTo(967.8, 6);
    expect(v('ingresos_totales_k', 1)).toBeCloseTo(967.8, 6);
    expect(m.indicadores.ingresosTotales[1]).toBeCloseTo(967.8, 6);
    expect(967.8 * 743).toBeCloseTo(719075.4, 6);
  });

  test('documento canónico: el ingreso del año 1 aparece en kCUP (CUP) y en kUSD (USD)', () => {
    const textoCUP = textoDocumento(docCUP);
    const textoUSD = textoDocumento(docUSD);
    expect(textoCUP).toContain('719.075,4');
    expect(textoUSD).toContain('967,8');
    // La errata 718.675,4 del informe de auditoría NUNCA aparece en los documentos.
    expect(textoCUP).not.toContain('718.675,4');
    expect(textoUSD).not.toContain('718.675,4');
  });

  test('PDF: el ingreso del año 1 aparece en la moneda de cada variante y sin la errata', async () => {
    const textoCUP = await pdfTexto('CUP');
    const textoUSD = await pdfTexto('USD');
    // La variante CUP muestra el ingreso del año 1 en kCUP; la USD, en kUSD.
    expect(textoCUP).toContain('719.075,4');
    expect(textoUSD).toContain('967,8');
    expect(textoCUP).not.toContain('718.675,4');
    expect(textoUSD).not.toContain('718.675,4');
  });

  test('DOCX: el ingreso del año 1 aparece en la moneda de cada variante y sin la errata', async () => {
    const textoCUP = await docxTexto('CUP');
    const textoUSD = await docxTexto('USD');
    // La variante CUP muestra el ingreso del año 1 en kCUP; la USD, en kUSD.
    expect(textoCUP).toContain('719.075,4');
    expect(textoUSD).toContain('967,8');
    expect(textoCUP).not.toContain('718.675,4');
    expect(textoUSD).not.toContain('718.675,4');
  });

  test('el informe de auditoría del repositorio ya no cita la cifra errónea como válida', async () => {
    const { readFileSync } = await import('node:fs');
    const informe = readFileSync('docs/DOC002_INFORME_AUDITORIA.md', 'utf8');
    // La cifra errónea solo puede aparecer DENTRO de una nota de errata
    // (corrección), nunca presentada como el valor válido del modelo.
    const lineasConErrata = informe.split('\n').filter((l) => l.includes('718.675,4'));
    expect(lineasConErrata.length).toBeGreaterThanOrEqual(1);
    for (const linea of lineasConErrata) {
      expect(/errata|corregid/i.test(linea)).toBe(true);
    }
    expect(informe).toContain('719.075,4 kCUP (= 967,8 kUSD × 743');
    expect(informe).toContain('errata de dígito');
  });
});

// ============================================================================
// H2 — Cobertura de la financiación inicial desde salidas de caja EXPLÍCITAS
// ============================================================================

describe('DOC-002-R1 §2 — Brecha del arranque desde salidas de caja explícitas', () => {
  test('clínica: la brecha es EXACTAMENTE la nómina de montaje (576,0 kCUP), sin duplicar el capital de trabajo', () => {
    const a = conciliarArranque(m);
    expect(a.nominaMontaje).toBeCloseTo(v('costo_laboral_k', 0), 9);
    expect(a.gastoCajaAnio0).toBeCloseTo(a.nominaMontaje, 9); // sin otros componentes
    expect(a.brecha).toBeCloseTo(-a.nominaMontaje, 9);
    expect(a.brecha * 743).toBeCloseTo(-576.0, 1); // 576,0 kCUP de faltante
    // El capital de trabajo (235,0 kUSD) está dentro de la inversión total:
    // no aparece como componente de la brecha.
    expect(a.necesidadTotal).toBeCloseTo(a.inversionTotal + a.nominaMontaje, 9);
    const ct = p.parametros.find((x) => x.id === 'capital_trabajo_k')!.valor;
    expect(a.necesidadTotal).not.toBeCloseTo(a.inversionTotal + a.nominaMontaje + ct, 3);
  });

  test('PÉRDIDAS NO MONETARIAS: la depreciación del año 0 NO agranda la brecha (la UDI sí la agrandaría)', () => {
    const pDep = clon();
    // Activo fijo disponible ya en el año 0 → depreciación NO monetaria del año 0.
    const activo = pDep.financiero.inversion.find((i) => i.id === 'iv-4')!;
    activo.anioDisponible = 0;
    const mDep = computeProject(pDep);
    expect(mDep.valores['depreciacion_anual_k']?.[0]).toBeGreaterThan(0); // pérdida no monetaria real
    const aDep = conciliarArranque(mDep);
    // La UDI del año 0 contiene la depreciación (−52 kUSD más)…
    expect(mDep.valores['utilidad_despues_impuestos_k']?.[0]).toBeLessThan(-v('costo_laboral_k', 0) - 50);
    // …pero la brecha de CAJA sigue siendo SOLO la nómina de montaje.
    expect(aDep.nominaMontaje).toBeCloseTo(v('costo_laboral_k', 0), 9);
    expect(aDep.gastoCajaAnio0).toBeCloseTo(v('costo_laboral_k', 0), 9);
    expect(aDep.brecha).toBeCloseTo(-v('costo_laboral_k', 0), 9);
    // La fórmula antigua max(0, −UDI_0) habría sobreestimado la brecha en 52+ kUSD.
    expect(Math.max(0, -(mDep.valores['utilidad_despues_impuestos_k']?.[0] ?? 0))).toBeGreaterThan(aDep.gastoCajaAnio0 + 50);
    const issue = mDep.issues.find((i) => i.codigo === 'FINANCIACION_ANO0');
    expect(issue).toBeDefined();
    expect(issue!.mensaje).toContain('NO se deduce del resultado contable');
  });

  test('INGRESOS DEL AÑO 0: los otros ingresos declarados reducen la necesidad de caja del arranque', () => {
    // El motor estructura el año 0 como montaje sin ingresos: la serie
    // «otros_ingresos_serie» es cero en el año 0 por diseño (los otros
    // ingresos se declaran para los años de operación 1..N).
    const pIng = clon();
    pIng.financiero.otrosIngresos = Array.from({ length: 10 }, () => 0);
    pIng.financiero.otrosIngresos[0] = 0.5;
    const mIng = computeProject(pIng);
    expect(mIng.valores['ingresos_totales_k']?.[0]).toBe(0);
    // La rama de ingresos del año 0 de la conciliación se prueba con un
    // modelo sintético explícito (la partida existe como regla activa).
    const aSint = conciliarArranque({
      valores: {
        costo_laboral_k: { 0: 0.775 },
        impuesto_utilidades_k: { 0: 0 },
        ingresos_totales_k: { 0: 0.5 },
        financiacion_disponible_k: { 0: 10 },
        inversion_total_k: { 0: 10 },
      },
      deuda: [{ anio: 0, interesPagado: 0 }],
    });
    expect(aSint.ingresosAnio0).toBeCloseTo(0.5, 9);
    expect(aSint.gastoCajaAnio0).toBeCloseTo(0.775 - 0.5, 9);
    expect(aSint.necesidadTotal).toBeCloseTo(10.275, 9);
    expect(aSint.brecha).toBeCloseTo(-0.275, 9);
    // La brecha cuantificada del hallazgo citaría los ingresos explícitos.
    expect(aSint.brecha).toBeGreaterThan(-0.775); // reducida, no la nómina íntegra
  });

  test('INTERÉS/DEVENGOS: con gracia TOTAL, el interés devengado capitalizado del año 0+ NO es salida de caja', () => {
    const pGr = clon();
    pGr.financiero.deuda.tipoGracia = 'total';
    const mGr = computeProject(pGr);
    // Convención del calendario: el año del desembolso no devenga interés.
    expect(mGr.deuda[0].interesDevengado).toBe(0);
    expect(mGr.deuda[0].interesPagado).toBe(0);
    // En los años de gracia el interés se devenga y se CAPITALIZA (no se paga).
    expect(mGr.deuda[1].interesDevengado).toBeGreaterThan(0);
    expect(mGr.deuda[1].interesCapitalizado).toBeCloseTo(mGr.deuda[1].interesDevengado, 6);
    expect(mGr.deuda[1].interesPagado).toBe(0);
    // La brecha del arranque sigue siendo solo la nómina: el devengo no es caja.
    const aGr = conciliarArranque(mGr);
    expect(aGr.interesPagado).toBe(0);
    expect(aGr.gastoCajaAnio0).toBeCloseTo(v('costo_laboral_k', 0), 9);
    expect(aGr.brecha).toBeCloseTo(-v('costo_laboral_k', 0), 9);
  });

  test('RESULTADOS NEGATIVOS/POSITIVOS: la brecha es estable ante UDI_0 distinta con la misma caja', () => {
    // Mismo gasto de caja, resultado contable distinto (dep 52 en el año 0):
    // la brecha NO cambia aunque la UDI_0 cambie −52 kUSD.
    const base = conciliarArranque(m).brecha;
    const pDep = clon();
    pDep.financiero.inversion.find((i) => i.id === 'iv-4')!.anioDisponible = 0;
    const aDep = conciliarArranque(computeProject(pDep));
    expect(aDep.brecha).toBeCloseTo(base, 9);
    // Y con ingresos explícitos del año 0, la brecha baja exactamente en el
    // ingreso (ni más ni menos), probado sobre el modelo sintético con la
    // MISMA nómina: 10 − 10,275 = −0,275 en lugar de −0,775.
    const aSintSinIngresos = conciliarArranque({
      valores: { costo_laboral_k: { 0: 0.775 }, financiacion_disponible_k: { 0: 10 }, inversion_total_k: { 0: 10 } },
      deuda: [],
    });
    const aSintConIngresos = conciliarArranque({
      valores: { costo_laboral_k: { 0: 0.775 }, ingresos_totales_k: { 0: 0.5 }, financiacion_disponible_k: { 0: 10 }, inversion_total_k: { 0: 10 } },
      deuda: [],
    });
    expect(aSintConIngresos.brecha).toBeCloseTo(aSintSinIngresos.brecha + 0.5, 9);
  });

  test('la tabla del diagnóstico desglosa las partidas explícitas (motor, documento y control comparten fuente)', () => {
    const a = conciliarArranque(m);
    const texto = textoDocumento(docCUP);
    expect(texto).toContain('Nómina de montaje del año 0');
    expect(texto).toContain('Interés PAGADO del año 0');
    // DOC-002-R2 §2: el impuesto se etiqueta DEVENGADO con el supuesto de
    // pago en el mismo período explícito (no es un pago verificado).
    expect(texto).toContain('Impuesto sobre utilidades DEVENGADO del año 0');
    expect(texto).toContain('pagado en el mismo período');
    expect(texto).toContain('Menos: ingresos explícitos del año 0');
    expect(texto).toContain('Salidas netas de caja del año 0 explícitamente identificadas');
    // R2 §2: el inventario trazable se publica con estado de pago y tratamiento.
    expect(texto).toContain('Inventario de partidas de caja del año 0');
    expect(texto).toContain('Estado de pago');
    expect(texto).toContain('Tratamiento dentro de la inversión');
    // El control de diagnóstico usa la MISMA conciliación (sin UDI_0).
    const d = diagnosticar(p, m);
    const h = d.hallazgos.find((x) => x.codigo === 'FINANCIACION_ANO0' || x.codigo === 'DESEMBOLSO_INICIAL_CONCILIADO');
    expect(h).toBeDefined();
    expect(h!.mensaje).toContain('nómina de montaje');
    expect(a.gastoCajaAnio0).toBeGreaterThan(0);
  });
});

// ============================================================================
// H2b — Conciliación de intereses devengados/pagados/capitalizados en FCFF/FCFE
// ============================================================================

describe('DOC-002-R1 §8 — Intereses devengados/pagados/capitalizados y FCFF/FCFE', () => {
  test('devengo = pagado + capitalizado en CADA período, para gracia de principal y gracia total', () => {
    for (const gracia of ['principal', 'total'] as const) {
      const pg = clon();
      pg.financiero.deuda.tipoGracia = gracia;
      const mg = computeProject(pg);
      for (const f of mg.deuda) {
        expect(f.interesDevengado).toBeCloseTo(f.interesPagado + f.interesCapitalizado, 9);
        // Invariante de saldo del calendario.
        expect(f.saldoFinal).toBeCloseTo(f.saldoInicial + f.desembolso + f.interesCapitalizado - f.amortizacion, 9);
      }
    }
  });

  test('FCFF reincorpora el DEVENGADO neto de escudo y FCFE restituye el PAGADO neto de escudo', () => {
    for (const t of m.years) {
      const f = m.deuda[t];
      const escudo = m.indicadores.escudoFiscal[t] ?? 0;
      // FCFF = UDI + (devengado − escudo) + dep − CAPEX (+ CT) − inv(0)
      expect(m.indicadores.fcff[t]).toBeCloseTo(
        v('utilidad_despues_impuestos_k', t) + f.interesDevengado - escudo + v('depreciacion_anual_k', t) - (m.indicadores.capexAmpliaciones[t] ?? 0) - (t === 0 ? v('inversion_total_k', 0) : 0),
        6
      );
      // FCFE = FCFF − (pagado − escudo) + desembolso − amortización
      expect(m.indicadores.fcfe[t]).toBeCloseTo(
        m.indicadores.fcff[t] - f.interesPagado + escudo + f.desembolso - f.amortizacion,
        6
      );
      // Identidad de reconciliación independiente.
      expect(m.indicadores.fcff[t] - m.indicadores.fcfe[t]).toBeCloseTo(f.interesPagado - escudo - f.desembolso + f.amortizacion, 6);
    }
  });

  test('con gracia TOTAL el interés capitalizado no es salida de caja: FCFE₁ = FCFF₁ + escudo₁', () => {
    const pg = clon();
    pg.financiero.deuda.tipoGracia = 'total';
    const mg = computeProject(pg);
    expect(mg.deuda[1].interesPagado).toBe(0);
    expect(mg.deuda[1].interesCapitalizado).toBeGreaterThan(0);
    expect(mg.indicadores.fcfe[1]).toBeCloseTo(mg.indicadores.fcff[1] + (mg.indicadores.escudoFiscal[1] ?? 0), 6);
  });
});

// ============================================================================
// H3 — Consistencia del año de ampliación (tablas, narrativa, figuras)
// ============================================================================

describe('DOC-002-R1 §3 — El año de la ampliación proviene del dato estructurado', () => {
  const anioAmp = p.recursos.flatMap((r) => r.expansiones.map((e) => e.anio))[0]; // 7

  test('capacidad, CAPEX y depreciación usan el MISMO año registrado (7)', () => {
    expect(anioAmp).toBe(7);
    expect(m.indicadores.capexAmpliaciones[anioAmp]).toBeCloseTo(150, 6);
    const activo = m.depreciacion.find((a) => a.id === 're-gab-amp-ex-gab-1')!;
    expect(activo.anioDisponible).toBe(anioAmp);
    expect(activo.depreciacion[anioAmp]).toBeCloseTo(15, 6); // 150 / 10 años
    // El alivio de utilización ocurre exactamente el año registrado.
    const gab = m.recursosCalculados.find((r) => r.id === 're-gab')!;
    expect(gab.utilizacion[anioAmp]).toBeLessThan(gab.utilizacion[anioAmp - 1]);
  });

  test('la narrativa de la plantilla ya no fija NINGÚN año de ampliación (apunta al dato estructurado)', () => {
    expect(/ampliaci[\wáéíóú]*[^.;]{0,140}?\ba[ñn]o\s+\d/i.test(p.tecnico.plazoNiveles)).toBe(false);
    expect(p.tecnico.plazoNiveles).toContain('tabla de recursos');
  });

  test('el documento deriva una tabla de ampliaciones con el año registrado (tablas = modelo)', () => {
    const texto = textoDocumento(docCUP);
    expect(texto).toContain('Ampliaciones programadas según la tabla de recursos');
    expect(texto).toContain('derivadas del modelo');
    expect(texto).toContain(`año ${anioAmp}`); // el año estructurado, no uno narrado
    expect(texto).not.toContain('ampliación de gabinetes del año 8');
    // El análisis de inversiones/cronograma cita el año desde capexAmpliaciones.
    const a = generarAnalisis(p, m);
    expect(a.inversiones_cronograma.texto).toContain(`años ${anioAmp}`);
  });

  test('la PRUEBA que impide narrar una fecha distinta: el hallazgo AMPLIACION_NARRATIVA_INCONSISTENTE se dispara', () => {
    const dBase = diagnosticar(p, m);
    expect(dBase.hallazgos.some((h) => h.codigo === 'AMPLIACION_NARRATIVA_INCONSISTENTE')).toBe(false);
    // Copia con la narrativa antigua (año 8): el control la bloquea.
    const pMal = clon();
    pMal.tecnico.plazoNiveles = 'Crecimiento del 5 % anual; la ampliación de gabinetes del año 8 sostiene el crecimiento.';
    const dMal = diagnosticar(pMal, computeProject(pMal));
    const h = dMal.hallazgos.find((x) => x.codigo === 'AMPLIACION_NARRATIVA_INCONSISTENTE');
    expect(h).toBeDefined();
    expect(h!.nivel).toBe('advertencia_importante');
    expect(h!.mensaje).toContain('año 8');
    expect(h!.mensaje).toContain(`registra en el/los año(s) 7`);
    // La figura de utilización muestra el alivio en el año registrado (7), no en otro.
    const figuras = generarFiguras(p, m, { kUSDaK: (k) => k * 743, unidadTabla: 'Miles de CUP (kCUP)', unidadCorta: 'kCUP' });
    const util = figuras.find((f) => f.clave === 'utilizacion')!;
    expect(util.marcasX.map((x) => x.etiqueta)).toContain(String(anioAmp));
  });
});

// ============================================================================
// H4 — Hipótesis de inflación fija con sensibilidad; H5 — base de la reserva
// ============================================================================

describe('DOC-002-R1 §4/§5 — Inflación de costos fijos y base de la reserva de dividendos', () => {
  test('inflacion_costos_fijos = 0 %: hipótesis de GASTOS NOMINALES CONSTANTES sujeta a prueba contractual (no «conservadora»)', () => {
    const param = p.parametros.find((x) => x.id === 'inflacion_costos_fijos')!;
    expect(param.descripcion).toContain('GASTOS NOMINALES CONSTANTES');
    expect(param.descripcion).toContain('verificación contractual PENDIENTE');
    expect(param.descripcion).not.toContain('deliberada y conservadora');
    expect(param.descripcion).toContain('no se califica automáticamente de conservadora');
    // La narrativa del informe declara la hipótesis con SUS partidas afectadas.
    const a = generarAnalisis(p, m);
    expect(a.ingresos_costos.texto).toContain('GASTOS NOMINALES CONSTANTES');
    expect(a.ingresos_costos.texto).toContain('canon, servicios públicos, otros gastos fijos, aranceles, otros impuestos y royalties');
    expect(a.ingresos_costos.texto).toContain('SUBESTIMA los costos y SOBREESTIMA el resultado');
  });

  test('SENSIBILIDAD: con inflación fija positiva el informe cuantifica el efecto frente al caso 0 %', () => {
    const p4 = clon();
    p4.parametros.find((x) => x.id === 'inflacion_costos_fijos')!.valor = 0.04;
    const m4 = computeProject(p4);
    const a4 = generarAnalisis(p4, m4);
    expect(a4.ingresos_costos.texto).toContain('Sensibilidad de la indexación de costos fijos');
    expect(a4.ingresos_costos.texto).toContain('frente a la hipótesis de gastos nominales constantes (0 %)');
    // La cifra de sensibilidad es reproducible: canon_k[10](4 %) − canon_k[10](0 %)
    const fijos = ['canon_k', 'servicios_publicos_k', 'otros_gastos_k', 'aranceles_k', 'otros_impuestos_k', 'royalties_k'];
    const suma = (modelo: typeof m, t: number) => fijos.reduce((s, id) => s + (modelo.valores[id]?.[t] ?? 0), 0);
    const delta = suma(m4, 10) - suma(m, 10);
    expect(delta).toBeGreaterThan(0);
    // El texto menciona el delta con el formato del informe (kUSD nativo).
    expect(a4.ingresos_costos.texto).toContain(`añade ${fmtK(delta)}`);
    // El costo variable NO se toca por esta vía (su propio 4 % ya estaba).
    expect(m4.valores['costos_variables_k'][1]).toBeCloseTo(m.valores['costos_variables_k'][1], 6);
  });

  test('la ficha del parámetro documenta las partidas afectadas DERIVADAS de las reglas activas', () => {
    const fichas = fichasParametros(p);
    const inflFijos = fichas.find((f) => f.id === 'inflacion_costos_fijos')!;
    for (const id of ['canon_k', 'servicios_publicos_k', 'otros_gastos_k', 'aranceles_k', 'otros_impuestos_k', 'royalties_k']) {
      expect(inflFijos.partidas.some((x) => x.includes(id))).toBe(true);
    }
    expect(inflFijos.partidas.some((x) => x.includes('srv_costo_unitario_proy'))).toBe(false);
  });

  test('reserva de dividendos: base = MAX(0, UDI del año + saldo ACUMULADO de ejercicios anteriores), documentada y con validación jurídica pendiente', () => {
    // Año 2: la base incluye utilidades RETENIDAS del año 1 (no solo la UDI_2).
    const d2 = m.dividendos.find((d) => d.anio === 2)!;
    expect(d2.saldoAcumulablePrevio).toBeGreaterThan(0); // saldo acumulado POSITIVO
    expect(d2.base).toBeCloseTo(Math.max(0, d2.udi + d2.saldoAcumulablePrevio), 9);
    expect(d2.base).toBeGreaterThan(d2.udi); // la base NO es solo la utilidad del año
    expect(d2.reserva).toBeCloseTo(d2.base * 0.1, 9);
    // Documentación exacta (parámetro, informe y regla del módulo).
    const param = p.parametros.find((x) => x.id === 'pct_reserva_legal')!;
    expect(param.descripcion).toContain('base_t = MAX(0, UDI del año t + saldo acumulable de ejercicios anteriores');
    expect(param.descripcion).toContain('NO se calcula solo sobre la utilidad del año');
    expect(param.descripcion).toContain('PENDIENTE DE VALIDACIÓN JURÍDICA');
    const texto = textoDocumento(docCUP);
    expect(texto).toContain('base_t = MAX(0, UDI_t + saldoAcumulable_(t−1))');
    expect(texto).toContain('la base NO es solo la utilidad del año');
    expect(texto).toContain('SUPUESTO EDITABLE PENDIENTE DE VALIDACIÓN JURÍDICA');
  });
});

// ============================================================================
// H6 — Fecha de referencia de la tasa vs fecha del documento
// ============================================================================

describe('DOC-002-R1 §6 — Fecha de la tasa respecto al documento', () => {
  test('la fecha de corte del supuesto (2026-10-25) NO es posterior a la fecha del documento', () => {
    const t = tasaCambioDe(p);
    expect(t.fecha).toBe('2026-10-25');
    expect(p.general.fecha).toBe('2026-10-25');
    expect(t.fecha <= p.general.fecha).toBe(true);
    const d = diagnosticar(p, m);
    expect(d.hallazgos.some((h) => h.codigo === 'TASA_FECHA_FUTURA')).toBe(false);
    // La nota de conversión la presenta como supuesto ilustrativo, no observado.
    const ctx = crearContextoMoneda(p, 'USD');
    const nota = notaConversion(ctx, t, p.general.fecha);
    expect(nota).toContain('fecha de corte del supuesto ilustrativo, no una cotización observada');
    expect(nota).toContain('PENDIENTE DE VALIDACIÓN OFICIAL');
  });

  test('una fecha de tasa POSTERIOR al documento queda BLOQUEADA por el diagnóstico y marcada como PREVISTA', () => {
    const pFut = clon();
    pFut.parametros.find((x) => x.id === 'tipo_cambio')!.fechaRef = '2026-10-26';
    const mFut = computeProject(pFut);
    const d = diagnosticar(pFut, mFut);
    const h = d.hallazgos.find((x) => x.codigo === 'TASA_FECHA_FUTURA');
    expect(h).toBeDefined();
    expect(h!.nivel).toBe('advertencia_importante');
    expect(h!.mensaje).toContain('POSTERIOR');
    expect(h!.mensaje).toContain('NO puede presentarse como dato observado');
    // La nota de conversión la marca como PREVISTA mientras no se corrija.
    const t = tasaCambioDe(pFut);
    const nota = notaConversion(crearContextoMoneda(pFut, 'USD'), t, pFut.general.fecha);
    expect(nota).toContain('PREVISTA: es posterior a la fecha del documento');
  });
});

// ============================================================================
// H7 — Gráfico de flujo acumulado con ejes etiquetados y series = tablas
// ============================================================================

/** Decodifica el PNG propio (filtro 0, RGB) para inspeccionar píxeles. */
function decodificarPNG(png: Uint8Array): { ancho: number; alto: number; px: Uint8Array } {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const ancho = dv.getUint32(16);
  const alto = dv.getUint32(20);
  let idat = new Uint8Array(0);
  let off = 8;
  while (off < png.length) {
    const len = dv.getUint32(off);
    const tipo = new TextDecoder('latin1').decode(png.subarray(off + 4, off + 8));
    if (tipo === 'IDAT') {
      const prev = idat;
      idat = new Uint8Array(prev.length + len);
      idat.set(prev);
      idat.set(png.subarray(off + 8, off + 8 + len), prev.length);
    }
    off += 12 + len;
    if (tipo === 'IEND') break;
  }
  const crudo = unzlibSync(idat);
  const px = new Uint8Array(ancho * alto * 3);
  const stride = ancho * 3 + 1;
  for (let y = 0; y < alto; y++) {
    if (crudo[y * stride] !== 0) throw new Error('filtro PNG inesperado');
    px.set(crudo.subarray(y * stride + 1, (y + 1) * stride), y * ancho * 3);
  }
  return { ancho, alto, px };
}

describe('DOC-002-R1 §7 — Figuras con ejes etiquetados, series idénticas a las tablas', () => {
  const conv = { kUSDaK: (k: number) => k * 743, unidadTabla: 'Miles de CUP (kCUP)', unidadCorta: 'kCUP' };
  const figuras = generarFiguras(p, m, conv);
  const convK = conv.kUSDaK;

  test('las TRES figuras llevan marcas numéricas en el eje Y y años en el eje X', () => {
    for (const f of figuras) {
      // Eje Y: varias líneas etiquetadas, TODAS dentro del rango trazado.
      expect(f.marcasY.length).toBeGreaterThanOrEqual(3);
      for (const marca of f.marcasY) {
        expect(marca.etiqueta.length).toBeGreaterThan(0);
        expect(marca.y).toBeGreaterThanOrEqual(f.ejes.yMin - 1e-6);
        expect(marca.y).toBeLessThanOrEqual(f.ejes.yMax + 1e-6);
      }
      // Eje X: una marca por año del rango (0–10 o 1–10).
      expect(f.marcasX.length).toBeGreaterThanOrEqual(4);
      for (const marca of f.marcasX) {
        expect(Number(marca.etiqueta)).toBe(marca.x);
      }
      // La rejilla etiquetada es la MISMA lista que dibujan los renderizadores.
      const rejilla = rejillaY(f.ejes, f.clave === 'utilizacion');
      expect(rejilla.map((x) => x.etiqueta)).toEqual(f.marcasY.map((x) => x.etiqueta));
    }
  });

  test('flujos: rejilla con el CERO incluido y años 0..10 completos (paso 1)', () => {
    const flujos = figuras.find((f) => f.clave === 'flujos')!;
    expect(flujos.marcasY.some((x) => x.y === 0)).toBe(true);
    expect(flujos.marcasX.map((x) => x.etiqueta)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    // El nivel cero y los cruces de recuperación siguen diferenciados.
    expect(flujos.leyenda.some((l) => l.etiqueta.includes('cruce en 3,5 años'))).toBe(true);
    expect(flujos.leyenda.some((l) => l.etiqueta.includes('cruce en 3,2 años'))).toBe(true);
    expect(flujos.leyenda.some((l) => l.etiqueta.includes('Cero (recuperación simple, sin descontar)'))).toBe(true);
    // Series FCFF/FCFE diferenciadas por color.
    const colores = new Set(flujos.leyenda.map((l) => l.color));
    expect(colores.size).toBeGreaterThanOrEqual(3);
  });

  test('horizontes largos: el paso de años evita solapes (marcas cada 2 años con N=24)', () => {
    expect(marcasAnios(0, 10).map((x) => x.etiqueta)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    const paso2 = marcasAnios(0, 24);
    expect(paso2.length).toBeLessThanOrEqual(13);
    expect(paso2[0].etiqueta).toBe('0');
    expect(paso2[1].etiqueta).toBe('2');
    expect(paso2.length).toBe(13); // 0, 2, 4, …, 24
  });

  test('las series de CADA figura son EXACTAMENTE las de las tablas de origen', () => {
    // Evolución = estado de resultados (tabla 4.7).
    const evo = figuras.find((f) => f.clave === 'evolucion')!;
    const linea = (color: string) => evo.primitivas.find((pr) => pr.t === 'polilinea' && pr.color === color) as Extract<(typeof evo.primitivas)[number], { t: 'polilinea' }>;
    for (const [t, punto] of linea('#2563eb').puntos) expect(punto).toBeCloseTo(convK(m.indicadores.ingresosTotales[t]), 6);
    for (const [t, punto] of linea('#b91c1c').puntos) expect(punto).toBeCloseTo(convK(m.valores['costos_totales_k'][t]), 6);
    for (const [t, punto] of linea('#15803d').puntos) expect(punto).toBeCloseTo(convK(m.indicadores.utilidadNeta[t]), 6);
    // Flujos = tabla 4.7.1 de acumulados.
    const flujos = figuras.find((f) => f.clave === 'flujos')!;
    const lFcff = flujos.primitivas.find((pr) => pr.t === 'polilinea' && pr.color === '#1d4ed8') as Extract<(typeof flujos.primitivas)[number], { t: 'polilinea' }>;
    const lFcfe = flujos.primitivas.find((pr) => pr.t === 'polilinea' && pr.color === '#b45309') as Extract<(typeof flujos.primitivas)[number], { t: 'polilinea' }>;
    for (const [t, punto] of lFcff.puntos) expect(punto).toBeCloseTo(convK(m.indicadores.fcffAcumulado[t]), 6);
    for (const [t, punto] of lFcfe.puntos) expect(punto).toBeCloseTo(convK(m.indicadores.fcfeAcumulado[t]), 6);
    // Utilización = tabla 4.6 (horas-mes demandadas ÷ disponibles): las
    // polilíneas van en el MISMO orden que recursosCalculados (paleta por índice).
    const util = figuras.find((f) => f.clave === 'utilizacion')!;
    const paleta = ['#0f766e', '#7c3aed', '#be185d', '#4d7c0f', '#b45309', '#0369a1'];
    const polilineasUtil = util.primitivas.filter((pr): pr is Extract<PrimitivaFigura, { t: 'polilinea' }> => pr.t === 'polilinea');
    expect(polilineasUtil.length).toBe(m.recursosCalculados.length);
    polilineasUtil.forEach((pr, i) => {
      expect(pr.color).toBe(paleta[i % paleta.length]);
      for (const [t, punto] of pr.puntos) expect(punto).toBeCloseTo((m.recursosCalculados[i].utilizacion[t] ?? 0) * 100, 9);
    });
  });

  test('PDF: las etiquetas del eje Y de los flujos aparecen como TEXTO vectorial, junto al título/leyenda/nota', async () => {
    const texto = await pdfTexto('CUP');
    const flujos = figuras.find((f) => f.clave === 'flujos')!;
    for (const marca of flujos.marcasY) {
      expect(texto).toContain(marca.etiqueta);
    }
    // Las marcas de año también viajan como texto del eje. (La aserción evita
    // el guion largo «—»: la extracción latin1 del stream jsPDF lo lee como
    // byte 0x97, no como U+2014.)
    expect(texto).toContain('Figura 3. Flujo acumulado');
    expect(texto).toContain('Unidades del eje vertical: Miles de CUP (kCUP)');
    expect(texto).toContain('cruce en 3,5 años');
    expect(texto).toContain('Nota. Fuente: modelo de cálculo activo (flujos de caja');
  });

  test('PNG (Word): las etiquetas numéricas y los años se dibujan como píxeles reales', () => {
    const flujos = figuras.find((f) => f.clave === 'flujos')!;
    const { png } = rasterizarPNG(flujos, { ancho: 640, alto: 320, escala: 1 });
    const { ancho, alto, px } = decodificarPNG(png);
    const oscuro = (x: number, y: number) => {
      const i = (y * ancho + x) * 3;
      return px[i] < 160 && px[i + 1] < 160 && px[i + 2] < 160;
    };
    // Columnas de etiquetas del eje Y (a la izquierda del área de trazado).
    let pxEtiquetasY = 0;
    for (let y = 0; y < alto; y++) for (let x = 0; x < 56; x++) if (oscuro(x, y)) pxEtiquetasY++;
    expect(pxEtiquetasY).toBeGreaterThan(50); // dígitos presentes, no en blanco
    // Filas de marcas de año (debajo del eje horizontal).
    let pxEtiquetasX = 0;
    for (let y = alto - 18; y < alto; y++) for (let x = 0; x < ancho; x++) if (oscuro(x, y)) pxEtiquetasX++;
    expect(pxEtiquetasX).toBeGreaterThan(40);
    // PNG decodificable de punta a punta (misma fuente que las tablas).
    expect(new TextDecoder('latin1').decode(png.slice(-12))).toContain('IEND');
  });
});
