// ============================================================================
// MISIÓN PLANEX-DOC-002-R2 — Pruebas de regresión: cobertura temporal de la
// financiación, inventario de salidas de caja del año 0, distinción
// devengado/pagado y robustez del escudo fiscal ante reglas personalizadas.
//
// Aserciones INDEPENDIENTES (R2 §5): los valores esperados se calculan en la
// propia prueba desde las series de origen (UAI, intereses del calendario,
// aportaciones fechadas, dividendos), no reproduciendo la identidad algebraica
// del motor; las verificaciones de coherencia usan identidades contables
// externas (tesorería = Σ FCFE + Σ aportaciones fechadas − Σ dividendos).
// ============================================================================
import { describe, test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { construirDocumentoPlanex } from '../../src/lib/planex/doc/construir';
import { exportarPDF } from '../../src/lib/planex/io/pdf';
import { exportarDOCX } from '../../src/lib/planex/io/docx';
import { diagnosticar } from '../../src/lib/planex/model/controles';
import { inventariarSalidasCajaAnio0, aportacionesPorAnioDe } from '../../src/lib/planex/engine/cobertura';
import { PlanexProject } from '../../src/lib/planex/types';
import { unzipSync, unzlibSync } from 'fflate';

const p0 = crearProyectoClinica();
const m0 = computeProject(p0);
const clon = (): PlanexProject => JSON.parse(JSON.stringify(p0)) as PlanexProject;

const v = (mm: ReturnType<typeof computeProject>, id: string, t: number) => mm.valores[id]?.[t] ?? 0;

function textoDocumento(mm: ReturnType<typeof computeProject>, pp: PlanexProject, moneda: 'CUP' | 'USD' = 'CUP'): string {
  const d = construirDocumentoPlanex(pp, mm, { moneda });
  const trozos: string[] = [];
  for (const s of d.secciones) {
    trozos.push(s.titulo);
    for (const el of s.elementos) {
      if (el.tipo === 'parrafo' || el.tipo === 'aviso') trozos.push(el.texto);
      else if (el.tipo === 'subtitulo') trozos.push(el.texto);
      else if (el.tipo === 'analisis') trozos.push(el.bloque.titulo, el.bloque.texto);
      else if (el.tipo === 'tabla') {
        trozos.push(el.tabla.titulo ?? '');
        el.tabla.encabezados.forEach((h) => trozos.push(h));
        el.tabla.filas.forEach((f) => f.forEach((c) => trozos.push(String(c))));
      } else if (el.tipo === 'figura') {
        trozos.push(el.figura.titulo, el.figura.nota);
      }
    }
  }
  return trozos.join('\n');
}

async function pdfTextoEnMemoria(pp: PlanexProject, mm: ReturnType<typeof computeProject>): Promise<string> {
  const { datos } = exportarPDF(pp, mm, { moneda: 'CUP' });
  const buf = Buffer.from(await datos.arrayBuffer());
  const s = buf.toString('latin1');
  const partes: string[] = [];
  for (const mm2 of s.matchAll(/\((.*?)\) Tj/g)) partes.push(mm2[1]);
  return partes.join(' ').replace(/\\(\(|\))/g, (x) => x.slice(1));
}

async function docxTextoEnMemoria(pp: PlanexProject, mm: ReturnType<typeof computeProject>): Promise<string> {
  const { datos } = await exportarDOCX(pp, mm, { moneda: 'CUP' });
  const buf = Buffer.from(await datos.arrayBuffer());
  const archivos = unzipSync(new Uint8Array(buf));
  const doc = new TextDecoder().decode(archivos['word/document.xml']);
  return doc.replace(/<w:tab[^>]*\/>/g, ' ').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
}

// ============================================================================
// §1 — Total de fuentes frente a disponibilidad temporal
// ============================================================================

describe('DOC-002-R2 §1 — Fuentes comprometidas vs disponibilidad temporal', () => {
  test('BASE (todo con vencimiento en el año 0): comprometido = disponible en el año 0; brecha solo por la nómina de montaje', () => {
    expect(aportacionesPorAnioDe(p0)).toEqual([1180, 0, 0]);
    expect(m0.cobertura.anioDesembolsoCredito).toBe(0);
    expect(m0.arranque.fuentesAnio0).toBeCloseTo(1180 + 300, 6); // aportaciones año 0 + crédito año 0
    expect(m0.arranque.financiacionDisponible).toBeCloseTo(1480, 6); // comprometido (aport + otras 0 + crédito)
    // Brecha temporal = brecha nominal en la demo (todo fechado en el año 0):
    // exactamente la nómina de montaje (0,775 kUSD = 576,0 kCUP).
    expect(m0.arranque.brecha).toBeCloseTo(-v(m0, 'costo_laboral_k', 0), 9);
    expect(m0.arranque.brecha).toBeCloseTo(m0.arranque.brechaNominal, 9);
    expect(m0.arranque.brecha * 743).toBeCloseTo(-576.0, 1);
    // El único déficit es el del año 0 (conocido de R1), cubierto desde el año 1.
    expect(m0.cobertura.deficitCaja.length).toBe(1);
    expect(m0.cobertura.deficitCaja[0].anio).toBe(0);
    expect(m0.cobertura.deficitCaja[0].cubiertoEn).toBe(1);
    expect(m0.issues.some((i) => i.codigo === 'DEFICIT_CAJA_PROYECTADA')).toBe(false);
  });

  test('FINANCIACIÓN TOTAL SUFICIENTE PERO DESDEMBOLSOS TARDÍOS: el año 0 queda descubierto EXACTAMENTE en lo que llega tarde', () => {
    const p = clon();
    p.aportaciones.forEach((a) => { a.montos = [0, a.montos[0], 0]; }); // 1180 → año 1
    p.personal = p.personal.filter((x) => x.etapa !== 'montaje'); // sin gasto de montaje: lo nominal cubre EXACTO
    const m = computeProject(p);
    // La conciliación TOTAL sigue cuadrando (no hay FINANCIACION_INSUFICIENTE).
    expect(v(m, 'financiacion_disponible_k', 0)).toBeCloseTo(1480, 6);
    expect(m.issues.some((i) => i.codigo === 'FINANCIACION_INSUFICIENTE')).toBe(false);
    // ...pero la disponibilidad del año 0 es SOLO el crédito.
    expect(m.arranque.fuentesAnio0).toBeCloseTo(300, 6);
    expect(m.arranque.brechaNominal).toBeGreaterThanOrEqual(-0.05);
    expect(m.arranque.brecha).toBeCloseTo(-1180, 6);
    // El déficit se detecta el año en que se produce y queda cubierto al llegar el aporte.
    expect(m.cobertura.deficitCaja.length).toBe(1);
    expect(m.cobertura.deficitCaja[0].anio).toBe(0);
    expect(m.cobertura.deficitCaja[0].cubiertoEn).toBe(1);
    // El hallazgo del motor explica que el problema es de CALENDARIO (lo
    // nominal cubre; los desembolsos llegan tarde).
    const issue = m.issues.find((i) => i.codigo === 'FINANCIACION_ANO0');
    expect(issue).toBeDefined();
    expect(issue!.mensaje).toContain('SIN cobertura temporal');
    expect(issue!.mensaje).toContain('desembolsos llegan DESPUÉS');
    // La vista de cobertura (sin flujos operativos) también detecta el faltante.
    expect(m.cobertura.porAnio[0].saldoCobertura).toBeCloseTo(m.arranque.brecha, 6);
  });

  test('PRÉSTAMO CON DESEMBOLSO EN AÑO POSTERIOR: el principal no cuenta como disponible en el año 0', () => {
    const p = clon();
    p.financiero.deuda.anioDesembolso = 1;
    const m = computeProject(p);
    expect(m.cobertura.anioDesembolsoCredito).toBe(1);
    expect(m.deuda[0].desembolso).toBe(0);
    expect(m.deuda[1].desembolso).toBeCloseTo(300, 6);
    expect(m.cobertura.porAnio[0].credito).toBe(0);
    expect(m.cobertura.porAnio[1].credito).toBeCloseTo(300, 6);
    // Fuentes del año 0: solo las aportaciones (1180); el crédito llega en el año 1.
    expect(m.arranque.fuentesAnio0).toBeCloseTo(1180, 6);
    expect(m.arranque.brecha).toBeCloseTo(-(300 + v(m, 'costo_laboral_k', 0)), 6);
    expect(m.cobertura.deficitCaja[0].anio).toBe(0);
    expect(m.cobertura.deficitCaja[0].cubiertoEn).toBe(1);
    // El interés del año 1 con desembolso tardío: el calendario no devenga el
    // año del desembolso, de modo que el escudo del año 1 es cero por diseño.
    expect(m.deuda[1].interesDevengado).toBe(0);
    expect(m.indicadores.escudoFiscal[1] ?? 0).toBe(0);
  });

  test('APORTACIONES DISTRIBUIDAS EN VARIOS AÑOS: el calendario expone cada vencimiento y el déficit del año 0', () => {
    const p = clon();
    p.aportaciones.forEach((a) => { const t = a.montos[0]; a.montos = [t * 0.5, t * 0.3, t * 0.2]; });
    const m = computeProject(p);
    expect(m.cobertura.aportacionesPorAnio[0]).toBeCloseTo(590, 6);
    expect(m.cobertura.aportacionesPorAnio[1]).toBeCloseTo(354, 6);
    expect(m.cobertura.aportacionesPorAnio[2]).toBeCloseTo(236, 6);
    expect(m.arranque.fuentesAnio0).toBeCloseTo(590 + 300, 6);
    expect(m.arranque.brecha).toBeCloseTo(-(590 + v(m, 'costo_laboral_k', 0)), 6);
    // La tesorería del año 0 es negativa (falta el 50 % del aporte) y queda
    // cubierta en el año 1 al entrar los 354 kUSD restantes de ese tramo.
    expect(m.cobertura.porAnio[0].cajaProyectada).toBeLessThan(-0.05);
    expect(m.cobertura.porAnio[1].cajaProyectada).toBeGreaterThan(0);
    expect(m.cobertura.deficitCaja.length).toBe(1);
    expect(m.cobertura.deficitCaja[0].anio).toBe(0);
    expect(m.cobertura.deficitCaja[0].cubiertoEn).toBe(1);
    // Las necesidades del año 0 NO cambian: inversión + nómina (independiente del calendario).
    expect(m.cobertura.porAnio[0].necesidades).toBeCloseTo(m0.cobertura.porAnio[0].necesidades, 9);
  });

  test('FINANCIACIÓN COMPLETA DISPONIBLE EN EL AÑO 0 Y SIN GASTO DE MONTAJE: ningún déficit en el horizonte', () => {
    const p = clon();
    p.personal = p.personal.filter((x) => x.etapa !== 'montaje'); // nómina de montaje = 0
    const m = computeProject(p);
    expect(m.arranque.gastoCajaAnio0).toBe(0);
    expect(m.arranque.necesidadTotal).toBeCloseTo(m.arranque.inversionTotal, 9);
    expect(m.arranque.brecha).toBeCloseTo(0, 9);
    expect(m.cobertura.deficitCaja.length).toBe(0);
    expect(m.issues.some((i) => i.codigo === 'FINANCIACION_ANO0')).toBe(false);
    expect(m.issues.some((i) => i.codigo === 'DEFICIT_CAJA_PROYECTADA')).toBe(false);
    // La tesorería proyectada nunca es negativa: el control documental existe.
    for (const c of m.cobertura.porAnio) expect(c.cajaProyectada).toBeGreaterThanOrEqual(-0.05);
    // La vista de cobertura (solo financiación vs necesidades) SÍ muestra el
    // CAPEX de la ampliación del año 7 sin fuentes nuevas: la operación lo
    // autofinancia — dos vistas distintas, y los hallazgos usan la de caja.
    const y7 = m.cobertura.porAnio[7];
    expect(y7.saldoCobertura).toBeLessThan(-0.05);
    expect(y7.cajaProyectada).toBeGreaterThan(0);
    const d = diagnosticar(p, m);
    expect(d.hallazgos.some((h) => h.codigo === 'COBERTURA_TEMPORAL_CONCILIADA')).toBe(true);
  });

  test('la tabla «Cobertura temporal» del informe separa comprometido vs disponible por período (canónico, PDF y DOCX)', async () => {
    const texto = textoDocumento(m0, p0);
    expect(texto).toContain('Cobertura temporal de la financiación y tesorería proyectada');
    expect(texto).toContain('fuentes comprometidas para todo el proyecto');
    expect(texto).toContain('Aportaciones del año');
    expect(texto).toContain('Caja proyectada');
    expect(texto).toContain('no declaran fecha');
    const pdf = await pdfTextoEnMemoria(p0, m0);
    expect(pdf).toContain('Cobertura temporal de la financiación');
    const docx = await docxTextoEnMemoria(p0, m0);
    expect(docx).toContain('Cobertura temporal de la financiación');
  });
});

// ============================================================================
// §2 — Déficit de caja por período (identidad externa de tesorería)
// ============================================================================

describe('DOC-002-R2 §2 — Déficit de caja por período', () => {
  test('identidad EXTERNA: caja(t) = Σ FCFE + Σ aportaciones fechadas + Σ otras fuentes − Σ dividendos, todos los años', () => {
    const casos: { etiqueta: string; p: PlanexProject }[] = [
      { etiqueta: 'base', p: p0 },
      { etiqueta: 'aportaciones año 1', p: (() => { const p = clon(); p.aportaciones.forEach((a) => { a.montos = [0, a.montos[0], 0]; }); return p; })() },
      { etiqueta: 'crédito año 2', p: (() => { const p = clon(); p.financiero.deuda.anioDesembolso = 2; return p; })() },
      { etiqueta: 'aportaciones año 2', p: (() => { const p = clon(); p.aportaciones.forEach((a) => { a.montos = [0, 0, a.montos[0]]; }); return p; })() },
    ];
    for (const { p } of casos) {
      const m = computeProject(p);
      const aport = aportacionesPorAnioDe(p);
      const otras = p.parametros.find((x) => x.id === 'otras_fuentes_k')?.valor ?? 0;
      let esperado = 0;
      for (const t of m.years) {
        const fcfe = m.indicadores.fcfe[t] ?? 0;
        const div = m.dividendos.find((d) => d.anio === t)?.pagables ?? 0;
        // Independiente del motor: la tesorería suma el FCFE (que ya trae el
        // desembolso del crédito y descuenta el servicio de la deuda), las
        // aportaciones con vencimiento en el año, las otras fuentes (año 0,
        // supuesto documentado) y descuenta los dividendos pagados.
        esperado += fcfe + (aport[t] ?? 0) + (t === 0 ? otras : 0) - div;
        expect(m.cobertura.porAnio[t].cajaProyectada).toBeCloseTo(esperado, 6);
      }
    }
  });

  test('en el año 0 la vista de cobertura y la tesorería proyectada COINCIDEN (sin operación)', () => {
    for (const m of [m0]) {
      const c0 = m.cobertura.porAnio[0];
      expect(c0.saldoCobertura).toBeCloseTo(c0.cajaProyectada, 6);
      expect(c0.saldoCobertura).toBeCloseTo(m.arranque.brecha, 6);
    }
  });

  test('las necesidades de cada período: año 0 = inversión total + salidas no capitalizables; años 1+ = CAPEX de ampliaciones', () => {
    const capex = m0.indicadores.capexAmpliaciones;
    for (const t of m0.years) {
      const esperado = t === 0 ? v(m0, 'inversion_total_k', 0) + Math.max(0, m0.arranque.gastoCajaAnio0) : (capex[t] ?? 0);
      expect(m0.cobertura.porAnio[t].necesidades).toBeCloseTo(esperado, 9);
    }
    // La ampliación del año 7 (escenario B de la demo) es una necesidad del año 7.
    expect(m0.cobertura.porAnio[7].necesidades).toBeCloseTo(capex[7] ?? 0, 9);
  });

  test('aportaciones solo en el año 2: el déficit persiste hasta el año 2 (cubiertoEn = 2), no «desde el año 1»', () => {
    const p = clon();
    p.aportaciones.forEach((a) => { a.montos = [0, 0, a.montos[0]]; });
    const m = computeProject(p);
    expect(m.cobertura.porAnio[0].cajaProyectada).toBeLessThan(-0.05);
    expect(m.cobertura.porAnio[1].cajaProyectada).toBeLessThan(-0.05);
    expect(m.cobertura.porAnio[2].cajaProyectada).toBeGreaterThan(0);
    expect(m.cobertura.deficitCaja.length).toBe(1);
    expect(m.cobertura.deficitCaja[0].cubiertoEn).toBe(2);
  });

  test('la tesorería proyectada NO es el FCFE acumulado: vistas distintas, cruce distinto', () => {
    // Año 1 de la demo: la caja ya es positiva (la aportación del año 0 está
    // dentro) mientras el FCFE acumulado sigue negativo (inversión pendiente
    // de recuperar). Confundir ambas series falsearía la liquidez.
    expect(m0.cobertura.porAnio[1].cajaProyectada).toBeGreaterThan(0);
    expect(m0.indicadores.fcfeAcumulado[1]).toBeLessThan(0);
  });
});

// ============================================================================
// §3 — Gastos de caja no incluidos en inversión capitalizada (inventario)
// ============================================================================

describe('DOC-002-R2 §3 — Inventario trazable de salidas de caja del año 0', () => {
  test('partidas conocidas con período, estado de pago y tratamiento; el impuesto se declara DEVENGADO con supuesto de pago', () => {
    const inv = inventariarSalidasCajaAnio0(m0);
    const ids = inv.partidas.map((x) => x.id);
    expect(ids).toContain('costo_laboral_k');
    expect(ids).toContain('impuesto_utilidades_k');
    expect(ids).toContain('ingresos_totales_k');
    expect(ids).toContain('deuda.interesPagado[0]');
    const imp = inv.partidas.find((x) => x.id === 'impuesto_utilidades_k')!;
    expect(imp.tipo).toBe('impuesto_devengado');
    expect(imp.estadoPago).toContain('DEVENGADO');
    expect(imp.estadoPago).toContain('pagado en el mismo período');
    expect(imp.estadoPago).toContain('NO es un pago verificado');
    const nomina = inv.partidas.find((x) => x.id === 'costo_laboral_k')!;
    expect(nomina.tratamiento).toContain('NO capitalizable');
    expect(nomina.tratamiento).toContain('duplica el capital de trabajo');
  });

  test('GASTO ADICIONAL DE PUESTA EN MARCHA: el barrido lo detecta y exige declaración (no lo ignora ni lo deduce de un agregado)', () => {
    const p = clon();
    p.reglas.push({
      id: 'gasto_puesta_marcha_k',
      nombre: 'Gasto adicional de puesta en marcha',
      descripcion: 'Gasto del año 0 no capitalizable (prueba R2).',
      ambito: 'anio',
      categoria: 'Costos',
      unidad: 'kUSD',
      expresion: 'IF(PERIODO = 0, 25, 0)',
      expresionDefault: 'IF(PERIODO = 0, 25, 0)',
      habilitada: true,
    });
    const ct = p.reglas.find((r) => r.id === 'costos_totales_k')!;
    ct.expresion = ct.expresion + ' + gasto_puesta_marcha_k';
    const m = computeProject(p);
    expect(v(m, 'gasto_puesta_marcha_k', 0)).toBeCloseTo(25, 6);
    expect(m.arranque.noInventariadas.length).toBe(1);
    expect(m.arranque.noInventariadas[0].id).toBe('gasto_puesta_marcha_k');
    expect(m.arranque.noInventariadas[0].monto).toBeCloseTo(25, 6);
    const partida = m.arranque.partidas.find((x) => x.id === 'gasto_puesta_marcha_k')!;
    expect(partida.computa).toBe(false); // NO computa hasta declarar su tratamiento
    expect(partida.estadoPago).toContain('SIN declarar');
    // Hallazgo explícito (no silencioso), con consecuencias y corrección.
    const issue = m.issues.find((i) => i.codigo === 'SALIDA_CAJA_ANIO0_NO_INVENTARIADA');
    expect(issue).toBeDefined();
    expect(issue!.mensaje).toContain('gasto_puesta_marcha_k');
    const d = diagnosticar(p, m);
    const h = d.hallazgos.find((x) => x.codigo === 'SALIDA_CAJA_ANIO0_NO_INVENTARIADA');
    expect(h).toBeDefined();
    expect(h!.afectaConclusiones).toBe(true);
    // La inversión total NO crece (no capitaliza el gasto) ni lo duplica.
    expect(v(m, 'inversion_total_k', 0)).toBeCloseTo(v(m0, 'inversion_total_k', 0), 9);
  });

  test('PÉRDIDAS NO MONETARIAS: la depreciación del año 0 figura en el inventario como gasto SIN salida de caja', () => {
    // La demo base no deprecia en el año 0 (activos disponibles desde el
    // año 1): se habilita la adecuación en el año 0 como en DOC-002-R1 §2.
    const pDep = clon();
    pDep.financiero.inversion.find((i) => i.id === 'iv-4')!.anioDisponible = 0;
    const mDep = computeProject(pDep);
    const inv = inventariarSalidasCajaAnio0(mDep);
    const dep = inv.partidas.find((x) => x.id === 'depreciacion_anual_k');
    expect(dep).toBeDefined();
    expect(dep!.tipo).toBe('gasto_no_monetario');
    expect(dep!.computa).toBe(false);
    expect(dep!.monto).toBeGreaterThan(50); // ≈ 52 kUSD de adecuación disponible en el año 0
    // Y NO agranda la necesidad: las salidas netas siguen siendo la nómina
    // (la UDI del año 0 sí cae: pérdida no monetaria ≠ salida de caja).
    expect(inv.salidasNetas).toBeCloseTo(v(mDep, 'costo_laboral_k', 0), 9);
    expect(v(mDep, 'utilidad_despues_impuestos_k', 0)).toBeLessThan(v(m0, 'utilidad_despues_impuestos_k', 0) - 50);
    expect(mDep.arranque.brecha).toBeCloseTo(m0.arranque.brecha, 9);
  });

  test('INTERESES DEVENGADOS PERO NO PAGADOS: lo capitalizado en gracia total queda documentado y fuera de la caja', () => {
    const p = clon();
    p.financiero.deuda.tipoGracia = 'total';
    p.financiero.deuda.anioDesembolso = 0;
    // Con desembolso en el año 0 no hay devengo ese año (convención del
    // calendario): forzamos gracia con devengo desde el año 1 y verificamos
    // que el año 0 no registre capitalización (no hay devengo previo).
    const m = computeProject(p);
    const inv = inventariarSalidasCajaAnio0(m);
    expect(inv.partidas.find((x) => x.id === 'deuda.interesPagado[0]')!.computa).toBe(false);
    expect(inv.partidas.some((x) => x.id === 'deuda.interesCapitalizado[0]')).toBe(false);
    // En los años de gracia el interés se capitaliza (no es caja del año 0).
    expect(m.deuda[1].interesCapitalizado).toBeCloseTo(m.deuda[1].interesDevengado, 6);
    expect(m.deuda[1].interesPagado).toBe(0);
  });

  test('FECHAS DE PAGO DISTINTAS: el interés del año 0 solo computa si el calendario lo sitúa en el año 0', () => {
    // Modelamos un crédito desembolsado en el año 0 con gracia de principal:
    // el primer interés se PAGA en el año 1, no en el año 0 (t > desembolso).
    const m = m0;
    const inv = inventariarSalidasCajaAnio0(m);
    const interes0 = inv.partidas.find((x) => x.id === 'deuda.interesPagado[0]')!;
    expect(interes0.monto).toBe(0);
    expect(interes0.computa).toBe(false);
    expect(m.deuda[1].interesPagado).toBeGreaterThan(0); // se paga desde el año 1
  });

  test('el diagnóstico y el documento publican el inventario con estado de pago y tratamiento', () => {
    const texto = textoDocumento(m0, p0);
    expect(texto).toContain('Inventario de partidas de caja del año 0');
    expect(texto).toContain('¿Computa en la necesidad?');
    expect(texto).toContain('mecanismo trazable con barrido de reglas de gasto');
    // El supuesto devengado/pagado es visible en el diagnóstico.
    const d = diagnosticar(p0, m0);
    expect(d.hallazgos.some((h) => h.codigo === 'SUPUESTO_IMPUESTO_MISMO_PERIODO')).toBe(true);
  });
});

// ============================================================================
// §4 — Escudo fiscal de reglas personalizadas (contrafactual INDEPENDIENTE)
// ============================================================================

describe('DOC-002-R2 §4 — Robustez del escudo fiscal ante reglas personalizadas', () => {
  const uai1 = () => v(m0, 'utilidad_antes_impuestos_k', 1);
  const int1 = () => m0.deuda.find((f) => f.anio === 1)!.interesDevengado;
  const tasa = () => 0.35;

  /** Regla de impuestos de reemplazo (misma forma que el motor). */
  function conImpuesto(expresion: string, extra?: { id: string; expresion: string }): { p: PlanexProject; m: ReturnType<typeof computeProject> } {
    const p = clon();
    if (extra) {
      p.reglas.push({
        id: extra.id,
        nombre: `Base intermedia (${extra.id})`,
        descripcion: 'Base intermedia de prueba (R2).',
        ambito: 'anio',
        categoria: 'Resultados',
        unidad: 'kUSD',
        expresion: extra.expresion,
        expresionDefault: extra.expresion,
        habilitada: true,
      });
    }
    p.reglas.find((r) => r.id === 'impuesto_utilidades_k')!.expresion = expresion;
    return { p, m: computeProject(p) };
  }

  test('TASA PLANA sobre la UAI (regla por defecto): el escudo es EXACTAMENTE el contrafactual independiente', () => {
    const esperado = Math.max(0, (uai1() + int1()) * tasa()) - Math.max(0, uai1() * tasa());
    expect(m0.indicadores.escudoFiscalInfo.clase).toBe('base_directa');
    expect(m0.indicadores.escudoFiscalInfo.confiable).toBe(true);
    expect(m0.indicadores.escudoFiscal[1]).toBeCloseTo(esperado, 9);
    // ...y NO es la identidad plana «interés × tasa» cuando la base cambia:
    // se verifica año a año contra el contrafactual recalculado.
    for (const t of m0.years) {
      const uai = v(m0, 'utilidad_antes_impuestos_k', t);
      const i = m0.deuda.find((f) => f.anio === t)!.interesDevengado;
      const esp = Math.max(0, (uai + i) * tasa()) - Math.max(0, uai * tasa());
      expect(m0.indicadores.escudoFiscal[t] ?? 0).toBeCloseTo(esp, 9);
    }
  });

  test('TOPE sobre la base: el escudo respeta el tope (≠ interés × tasa)', () => {
    const { m } = conImpuesto('MAX(0, MIN(utilidad_antes_impuestos_k, 400) * tasa_impuesto_utilidades)');
    // Contrafactual calculado EN LA PRUEBA desde las series de origen.
    const uai = uai1();
    const i = int1();
    const esperado = Math.max(0, Math.min(uai + i, 400) * tasa()) - Math.max(0, Math.min(uai, 400) * tasa());
    expect(esperado).not.toBeCloseTo(i * tasa(), 6); // el tope ACTÚA: no es el caso plano
    expect(m.indicadores.escudoFiscalInfo.clase).toBe('base_directa');
    expect(m.indicadores.escudoFiscal[1]).toBeCloseTo(esperado, 9);
    expect(m.indicadores.escudoFiscal[1]).not.toBeCloseTo(i * tasa(), 6);
  });

  test('BASE INTERMEDIA con umbral: la reevaluación es TRANSITIVA (antes daba un escudo 0 FALSO)', () => {
    // base_gravable = MAX(0, UAI − 400): con la UAI de la demo la base real
    // es 0 (no hay impuesto), pero la base contrafactual (UAI+intereses − 400)
    // es positiva → el escudo existe y NO es interés × tasa.
    const { m } = conImpuesto(
      'base_gravable_r2_k * tasa_impuesto_utilidades',
      { id: 'base_gravable_r2_k', expresion: 'MAX(0, utilidad_antes_impuestos_k - 400)' }
    );
    const uai = uai1();
    const i = int1();
    const esperado = Math.max(0, uai + i - 400) * tasa() - Math.max(0, uai - 400) * tasa();
    expect(esperado).toBeGreaterThan(0);
    expect(esperado).not.toBeCloseTo(i * tasa(), 6); // 3,80 ≠ 8,40: el umbral recorta
    expect(m.indicadores.escudoFiscalInfo.clase).toBe('base_indirecta');
    expect(m.indicadores.escudoFiscalInfo.confiable).toBe(true);
    expect(m.indicadores.escudoFiscal[1]).toBeCloseTo(esperado, 9);
    // El escudo falso 0 habría sobreestimado el FCFF en exactamente el escudo:
    const fcffCorregido = m.indicadores.fcff[1];
    expect(fcffCorregido).toBeCloseTo(
      v(m, 'utilidad_despues_impuestos_k', 1) + i - esperado + v(m, 'depreciacion_anual_k', 1),
      6
    );
  });

  test('REGLA INDEPENDIENTE DE LA BASE (impuesto sobre ingresos): escudo 0 LEGÍTIMO documentado, sin hallazgo de error', () => {
    const { p, m } = conImpuesto('ingresos_totales_k * 0.05');
    expect(m.indicadores.escudoFiscalInfo.clase).toBe('independiente_de_la_base');
    expect(m.indicadores.escudoFiscalInfo.confiable).toBe(true);
    for (const t of m.years) expect(m.indicadores.escudoFiscal[t] ?? 0).toBe(0);
    expect(m.issues.some((i) => i.codigo === 'ESCUDO_FISCAL_NO_CALCULABLE')).toBe(false);
    // El FCFF reincorpora el interés COMPLETO (coherente con esa regla):
    const t = 1;
    const i = int1();
    expect(m.indicadores.fcff[t]).toBeCloseTo(
      v(m, 'utilidad_despues_impuestos_k', t) + i + v(m, 'depreciacion_anual_k', t),
      6
    );
    // Documentado y visible en el diagnóstico (clasificación expuesta).
    const d = diagnosticar(p, m);
    expect(d.hallazgos.some((h) => h.codigo === 'ESCUDO_FISCAL_CLASE' && h.mensaje.includes('independiente de la base'))).toBe(true);
  });

  test('RESULTADO NEGATIVO: base negativa con interés — el escudo es el contrafactual exacto (recuperación parcial o cero)', () => {
    // Canon incrementado → UAI(1) negativa pero UAI(1)+interés positiva: el
    // contrafactual recupera parte del impuesto hipotético.
    const p = clon();
    const canon = p.parametros.find((x) => x.id === 'canon_anual_k')!;
    canon.valor = canon.valor + 395;
    const m = computeProject(p);
    const uai = v(m, 'utilidad_antes_impuestos_k', 1);
    const i = m.deuda.find((f) => f.anio === 1)!.interesDevengado;
    expect(uai).toBeLessThan(0);
    expect(uai + i).toBeGreaterThan(0);
    const esperado = Math.max(0, (uai + i) * tasa()) - Math.max(0, uai * tasa());
    expect(m.indicadores.escudoFiscal[1]).toBeCloseTo(esperado, 9);
    expect(m.indicadores.escudoFiscalInfo.confiable).toBe(true); // reevaluación exitosa
    // Y con base MUY negativa (uai + interés < 0), el escudo es cero sin error.
    const p2 = clon();
    const canon2 = p2.parametros.find((x) => x.id === 'canon_anual_k')!;
    canon2.valor = canon2.valor + 800;
    const m2 = computeProject(p2);
    const uai2 = v(m2, 'utilidad_antes_impuestos_k', 1);
    expect(uai2 + int1()).toBeLessThan(0);
    expect(m2.indicadores.escudoFiscal[1] ?? 0).toBe(0);
    expect(m2.indicadores.escudoFiscalInfo.confiable).toBe(true);
    expect(m2.issues.some((x) => x.codigo === 'ESCUDO_FISCAL_NO_CALCULABLE')).toBe(false);
  });

  test('AUSENCIA DE DEUDA: escudo cero por definición y FCFF = FCFE todos los años', () => {
    const p = clon();
    p.financiero.deuda.habilitada = false;
    p.parametros.find((x) => x.id === 'credito_monto_k')!.valor = 0;
    p.parametros.find((x) => x.id === 'capital_trabajo_k')!.valor = 235 + 300; // la financiación sigue cuadrando
    const m = computeProject(p);
    expect(m.indicadores.escudoFiscalInfo.clase).toBe('sin_deuda');
    for (const t of m.years) {
      expect(m.indicadores.escudoFiscal[t] ?? 0).toBe(0);
      expect(m.indicadores.fcff[t]).toBeCloseTo(m.indicadores.fcfe[t], 9);
    }
  });

  test('REGLA QUE NO PUEDE REEVALUARSE (error de dominio en el contrafactual): hallazgo explícito y flujos NO confiables', () => {
    // base = POW(410 − UAI, 0,5): con la UAI real la raíz existe; con la base
    // hipotética (UAI+intereses > 410) la base es negativa → el contrafactual
    // falla. La regla evalúa bien en el escenario real (el plan «parece»
    // válido): el motor debe marcarlo, no callar.
    const p = clon();
    p.reglas.push({
      id: 'base_raiz_r2_k',
      nombre: 'Base con raíz (prueba R2)',
      descripcion: 'Base de prueba: raíz cuadrada de (410 − UAI).',
      ambito: 'anio',
      categoria: 'Resultados',
      unidad: 'kUSD',
      expresion: 'POW(410 - utilidad_antes_impuestos_k, 0.5)',
      expresionDefault: 'POW(410 - utilidad_antes_impuestos_k, 0.5)',
      habilitada: true,
    });
    p.reglas.find((r) => r.id === 'impuesto_utilidades_k')!.expresion = 'base_raiz_r2_k * tasa_impuesto_utilidades';
    const m = computeProject(p);
    // La regla SÍ produce impuesto en el escenario real (aparentemente válida).
    expect(v(m, 'impuesto_utilidades_k', 1)).toBeGreaterThan(0);
    expect(m.indicadores.escudoFiscalInfo.clase).toBe('base_indirecta');
    expect(m.indicadores.escudoFiscalInfo.confiable).toBe(false);
    expect(m.indicadores.escudoFiscalInfo.noCalculableAnios.length).toBeGreaterThan(0);
    // Hallazgo explícito con severidad y consecuencias (no un cero silencioso).
    const issue = m.issues.find((i) => i.codigo === 'ESCUDO_FISCAL_NO_CALCULABLE');
    expect(issue).toBeDefined();
    expect(issue!.mensaje).toContain('NO CONFIABLES');
    const d = diagnosticar(p, m);
    const h = d.hallazgos.find((x) => x.codigo === 'ESCUDO_FISCAL_NO_CALCULABLE')!;
    expect(h.nivel).toBe('advertencia_importante');
    expect(h.afectaConclusiones).toBe(true);
    // La dimensión de coherencia financiera queda deficiente y el estado
    // general del plan NO puede ser «listo».
    expect(d.resumen.dimensiones.find((x) => x.id === 'coherencia_financiera_contable')!.estado).toBe('deficiente');
  });

  test('sin fallback plano silencioso: la clasificación queda expuesta en el modelo y en el informe', () => {
    const texto = textoDocumento(m0, p0);
    expect(texto).toContain('Escudo fiscal — clasificación');
    expect(texto).toContain('base directa');
    // La identidad de reconciliación FCFF−FCFE sigue vigente en todos los casos.
    const casos = [
      m0,
      conImpuesto('MAX(0, MIN(utilidad_antes_impuestos_k, 400) * tasa_impuesto_utilidades)').m,
    ];
    for (const m of casos) {
      for (const f of m.deuda) {
        const t = f.anio;
        const escudo = m.indicadores.escudoFiscal[t] ?? 0;
        expect(m.indicadores.fcff[t] - m.indicadores.fcfe[t]).toBeCloseTo(
          f.interesPagado - escudo - f.desembolso + f.amortizacion,
          6
        );
      }
    }
  });
});

// ============================================================================
// §5 — Coherencia entre flujos, deuda, financiación y recuperación
// ============================================================================

describe('DOC-002-R2 §5 — Coherencia flujos / deuda / financiación / recuperación', () => {
  test('las fuentes acumuladas del horizonte reconcilian con la financiación comprometida (nominal)', () => {
    const pTardia = clon();
    pTardia.aportaciones.forEach((a) => { a.montos = [0, a.montos[0], 0]; });
    for (const m of [m0, computeProject(pTardia)]) {
      const ultima = m.cobertura.porAnio[m.cobertura.porAnio.length - 1];
      expect(ultima.fuentesAcumuladas).toBeCloseTo(v(m, 'financiacion_disponible_k', 0), 6);
    }
  });

  test('el calendario de cobertura usa el MISMO desembolso del calendario de deuda (una sola fuente)', () => {
    const p = clon();
    p.financiero.deuda.anioDesembolso = 2;
    const m = computeProject(p);
    for (const t of m.years) {
      expect(m.cobertura.porAnio[t].credito).toBe(m.deuda.find((f) => f.anio === t)?.desembolso ?? 0);
    }
    // El FCFE del año 2 incorpora el desembolso (misma serie), y la tesorería
    // NO lo duplica (el flujo operativo lo excluye y entra como fuente).
    const t2 = m.cobertura.porAnio[2];
    expect(t2.flujoOperativo).toBeCloseTo((m.indicadores.fcfe[2] ?? 0) - t2.credito, 9);
  });

  test('con desembolsos tardíos la identidad FCFF−FCFE y las recuperaciones siguen cuadrando', () => {
    const p = clon();
    p.aportaciones.forEach((a) => { a.montos = [0, 0, a.montos[0]]; });
    p.financiero.deuda.anioDesembolso = 1;
    const m = computeProject(p);
    for (const f of m.deuda) {
      const escudo = m.indicadores.escudoFiscal[f.anio] ?? 0;
      expect(m.indicadores.fcff[f.anio] - m.indicadores.fcfe[f.anio]).toBeCloseTo(
        f.interesPagado - escudo - f.desembolso + f.amortizacion,
        6
      );
    }
    // La recuperación no cambia por el calendario de aportaciones (el FCFE
    // mide la recuperación del capital invertido, no la tesorería).
    expect(m.indicadores.recuperacionSocios.anios).not.toBeNull();
    // La caja del año 2 recibe la aportación tardía: el déficit (años 0–1)
    // queda cubierto exactamente al llegar el aporte.
    expect(m.cobertura.deficitCaja[0].cubiertoEn).toBe(2);
    const d = diagnosticar(p, m);
    expect(d.hallazgos.some((h) => h.codigo === 'FINANCIACION_ANO0')).toBe(true);
  });
});

// ============================================================================
// §6 — Correspondencia entre capturas, PDF/DOCX vigentes e informe
// ============================================================================

describe('DOC-002-R2 §6 — Correspondencia evidencias / documentos vigentes / informe', () => {
  const RUTA_CAPTURA = 'docs/capturas/doc002-figura-flujos-cruce-cero.png';
  const RUTA_CAPTURA_ANTES = 'docs/capturas/doc002-figura-flujos-cruce-cero-antes-de-etiquetas.png';
  const RUTA_INFORME = 'docs/DOC002_INFORME_AUDITORIA.md';

  test('la captura del gráfico acumulado existe y es la versión REGENERADA con etiquetas numéricas y marcas de año', () => {
    expect(existsSync(RUTA_CAPTURA)).toBe(true);
    const buf = readFileSync(RUTA_CAPTURA);
    expect(buf.length).toBeGreaterThan(5000);
    // PNG válido (firma + IHDR) y dimensiones de la captura regenerada.
    expect(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    const ancho = buf.readUInt32BE(16);
    const alto = buf.readUInt32BE(20);
    expect(ancho).toBeGreaterThanOrEqual(960);
    expect(alto).toBeGreaterThanOrEqual(480);
    // Píxeles de ETIQUETAS reales: banda izquierda (cifras del eje Y) y banda
    // inferior (años) contienen tinta fuera del color de rejilla.
    const { pixelesEtiquetaIzq, pixelesEtiquetaInf } = contarTintaEtiquetas(buf);
    expect(pixelesEtiquetaIzq).toBeGreaterThan(150);
    expect(pixelesEtiquetaInf).toBeGreaterThan(60);
  });

  test('la captura ANTERIOR se conserva identificada como evidencia «antes»', () => {
    expect(existsSync(RUTA_CAPTURA_ANTES)).toBe(true);
    const buf = readFileSync(RUTA_CAPTURA_ANTES);
    expect(buf.length).toBeGreaterThan(1000);
  });

  test('el PDF de regresión regenerado contiene la tabla de cobertura temporal y el inventario', () => {
    // El ejemplo regenerado en disco (scripts/exportar_regresion.ts).
    const ruta = 'docs/ejemplos/Ejemplo_Clinica_Plan_de_Negocios.pdf';
    expect(existsSync(ruta)).toBe(true);
    const latin = readFileSync(ruta).toString('latin1');
    const partes: string[] = [];
    for (const mm of latin.matchAll(/\((.*?)\) Tj/g)) partes.push(mm[1]);
    const texto = partes.join(' ');
    expect(texto).toContain('Cobertura temporal de la financiación');
    expect(texto).toContain('Inventario de partidas de caja');
    expect(texto).toContain('BRECHA TEMPORAL');
  });

  test('el DOCX de regresión regenerado contiene las mismas secciones nuevas', () => {
    const ruta = 'docs/ejemplos/Ejemplo_Clinica_Plan_de_Negocios.docx';
    expect(existsSync(ruta)).toBe(true);
    const archivos = unzipSync(new Uint8Array(readFileSync(ruta)));
    const doc = new TextDecoder().decode(archivos['word/document.xml']);
    const texto = doc.replace(/<[^>]+>/g, '');
    expect(texto).toContain('Cobertura temporal de la financiación');
    expect(texto).toContain('Inventario de partidas de caja');
    // Las 3 figuras siguen presentes como PNG locales (se excluye la entrada
    // de directorio del ZIP).
    const medias = Object.keys(archivos).filter((k) => k.startsWith('word/media/') && k.endsWith('.png'));
    expect(medias.length).toBe(3);
  });

  test('el informe de auditoría refleja el historial REAL de los PR #5 y #6 (fusionados) y la rama R2 en curso', () => {
    expect(existsSync(RUTA_INFORME)).toBe(true);
    const texto = readFileSync(RUTA_INFORME, 'utf-8');
    // El PR #5 y el PR #6 figuran como FUSIONADOS (no como pendientes).
    expect(/#5[^.]*fusionado/i.test(texto)).toBe(true);
    expect(/#6[^.]*fusionado/i.test(texto)).toBe(true);
    // La cabecera ya no declara «no se fusiona» sobre la rama histórica ya fusionada.
    expect(/Rama: `audit\/planex-doc-002`\. No se fusiona/.test(texto)).toBe(false);
    // La misión R2 queda declarada como rama de continuación SIN fusión.
    expect(texto).toContain('fix/planex-doc-002-r2-cobertura-temporal');
    expect(texto).toContain('PLANEX-DOC-002-R2');
    // La evidencia de la captura regenerada queda referenciada.
    expect(texto).toContain(RUTA_CAPTURA);
    expect(texto).toContain('antes-de-etiquetas');
  });
});

// ---------------------------------------------------------------------------
// Utilidad: decodifica el PNG (sin filtrado: filtro 0 por scanline) y cuenta
// píxeles de tinta en las bandas de etiquetas (izquierda del área de trazado
// y debajo del eje X), donde solo hay texto de ejes.
// ---------------------------------------------------------------------------

function contarTintaEtiquetas(buf: Buffer): { pixelesEtiquetaIzq: number; pixelesEtiquetaInf: number } {
  // Localiza el chunk IDAT y lo descomprime (RGB, 8 bits).
  let off = 8;
  let idat: Uint8Array | null = null;
  let ancho = 0;
  let alto = 0;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const tipo = buf.toString('ascii', off + 4, off + 8);
    if (tipo === 'IHDR') {
      ancho = buf.readUInt32BE(off + 8);
      alto = buf.readUInt32BE(off + 12);
    } else if (tipo === 'IDAT') {
      const trozo = buf.subarray(off + 8, off + 8 + len);
      idat = idat ? Buffer.concat([Buffer.from(idat), trozo]) : trozo;
    } else if (tipo === 'IEND') break;
    off += 12 + len;
  }
  if (!idat) return { pixelesEtiquetaIzq: 0, pixelesEtiquetaInf: 0 };
  const crudo = unzlibSync(new Uint8Array(idat));
  const stride = ancho * 3 + 1;
  // Bandas de etiquetas: 0..12 % del ancho (eje Y) y último 8 % del alto (años).
  const limiteIzq = Math.floor(ancho * 0.12);
  const desdeInf = Math.floor(alto * 0.9);
  let izq = 0;
  let inf = 0;
  for (let y = 0; y < alto; y++) {
    const fila = y * stride + 1;
    for (let x = 0; x < ancho; x++) {
      const i = fila + x * 3;
      const r = crudo[i];
      const g = crudo[i + 1];
      const b = crudo[i + 2];
      const esTinta = r < 200 && g < 200 && b < 200; // texto gris #64748b y ejes
      if (esTinta) {
        if (x < limiteIzq && y > alto * 0.08 && y < alto * 0.92) izq++;
        if (y >= desdeInf && x > limiteIzq) inf++;
      }
    }
  }
  return { pixelesEtiquetaIzq: izq, pixelesEtiquetaInf: inf };
}
