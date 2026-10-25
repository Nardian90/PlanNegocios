// ============================================================================
// MISIÓN §16.2 — Pruebas específicas de depreciación.
//  · La depreciación comienza conforme a la regla configurada (disponibilidad).
//  · La vida útil se respeta por activo.
//  · La acumulada no supera el importe depreciable.
//  · Las adiciones de activos modifican el calendario.
//  · Los activos totalmente depreciados no siguen depreciando.
//  · La depreciación se incorpora correctamente al flujo de caja.
//  · No se confunde gasto de depreciación con desembolso monetario.
// ============================================================================

import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { calcularDepreciacion } from '../../src/lib/planex/engine/depreciacion';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import type { InversionRow } from '../../src/lib/planex/types';

function clonar<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

const activo = (id: string, monto: number, vida: number, disponible = 1, residual = 0): InversionRow => ({
  id,
  concepto: `Activo ${id}`,
  categoria: 'inversion_fija',
  moneda: 'USD',
  monto,
  vidaUtilAnios: vida,
  anioDisponible: disponible,
  valorResidualPct: residual,
  metodoDepreciacion: 'lineal',
  observacion: '',
});

describe('MISIÓN §16.2 — Depreciación por activo', () => {
  test('calendario lineal: cuota constante, vida útil respetada y acumulada = base exacta', () => {
    const { activos, totalPorAnio } = calcularDepreciacion({
      inversion: [activo('a1', 100, 5)],
      horizonteAnios: 10,
      tipoCambio: 400,
    });
    expect(activos).toHaveLength(1);
    const a = activos[0];
    for (let t = 1; t <= 5; t++) expect(a.depreciacion[t]).toBeCloseTo(20, 6);
    for (let t = 6; t <= 10; t++) expect(a.depreciacion[t]).toBe(0);
    expect(a.acumulada).toBeCloseTo(100, 6);
    expect(a.vnl).toBeCloseTo(0, 6);
    expect(totalPorAnio[0]).toBe(0);
  });

  test('activo disponible a partir del año 3: NO deprecia antes (defecto del plan viejo corregido)', () => {
    const { activos } = calcularDepreciacion({
      inversion: [activo('a1', 100, 5, 3)],
      horizonteAnios: 10,
      tipoCambio: 400,
    });
    const a = activos[0];
    // Antes de la disponibilidad no hay depreciación (el plan viejo cargaba
    // el año 0 de montaje: corregido).
    expect(a.depreciacion[0]).toBe(0);
    expect(a.depreciacion[1]).toBe(0);
    expect(a.depreciacion[2]).toBe(0);
    // Vida útil 5 años DESDE la disponibilidad: deprecia los años 3 a 7.
    expect(a.depreciacion[3]).toBeCloseTo(20, 6);
    expect(a.depreciacion[7]).toBeCloseTo(20, 6);
    // Totalmente depreciado al agotar la vida: años 8+ sin depreciación.
    expect(a.depreciacion[8]).toBe(0);
    expect(a.depreciacion[9]).toBe(0);
    expect(a.acumulada).toBeCloseTo(100, 6);
    expect(a.vnl).toBeCloseTo(0, 6);
  });

  test('valor residual: la base depreciable descuenta el residual y el VNL lo conserva', () => {
    const { activos } = calcularDepreciacion({
      inversion: [activo('a1', 100, 4, 1, 0.1)],
      horizonteAnios: 8,
      tipoCambio: 400,
    });
    const a = activos[0];
    expect(a.baseDepreciableKUSD).toBeCloseTo(90, 6);
    expect(a.acumulada).toBeCloseTo(90, 6);
    expect(a.vnl).toBeCloseTo(10, 6); // 10 % de residual
  });

  test('la acumulada NUNCA supera el importe depreciable (caso horizonte > vida)', () => {
    const { activos } = calcularDepreciacion({
      inversion: [activo('a1', 100, 20, 1)],
      horizonteAnios: 5,
      tipoCambio: 400,
    });
    expect(activos[0].acumulada).toBeCloseTo(25, 6); // 5 años × 5
    expect(activos[0].acumulada).toBeLessThanOrEqual(activos[0].baseDepreciableKUSD + 1e-9);
  });

  test('activo en CUP: se convierte una sola vez con el tipo de cambio', () => {
    const fila: InversionRow = { ...activo('a1', 40000, 4, 1), moneda: 'CUP' }; // 40 000 kCUP
    const { activos } = calcularDepreciacion({ inversion: [fila], horizonteAnios: 8, tipoCambio: 400 });
    expect(activos[0].baseDepreciableKUSD).toBeCloseTo(100, 6);
    expect(activos[0].depreciacion[1]).toBeCloseTo(25, 6);
  });

  test('sin vida útil no se deprecia y se reporta el hallazgo', () => {
    const { activos, totalPorAnio, issues } = calcularDepreciacion({
      inversion: [activo('a1', 100, 0)],
      horizonteAnios: 5,
      tipoCambio: 400,
    });
    expect(totalPorAnio[1]).toBe(0);
    expect(activos[0].acumulada).toBe(0);
    expect(issues.length).toBeGreaterThan(0);
  });

  test('método «ninguno»: el activo queda fuera del calendario', () => {
    const fila: InversionRow = { ...activo('a1', 100, 10), metodoDepreciacion: 'ninguno' };
    const { activos } = calcularDepreciacion({ inversion: [fila], horizonteAnios: 5, tipoCambio: 400 });
    expect(activos).toHaveLength(0);
  });

  test('adiciones de activos (ampliación) modifican el calendario desde su año', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    // Ampliación en el año 5: 60 kUSD, vida 6 años.
    p.financiero.inversion.push(activo('amp', 60, 6, 5));
    const m2 = computeProject(p);
    expect(m2.depreciacion.length).toBe(m1.depreciacion.length + 1);
    expect(m2.valores['depreciacion_anual_k'][4]).toBeCloseTo(m1.valores['depreciacion_anual_k'][4], 6);
    expect(m2.valores['depreciacion_anual_k'][5]).toBeCloseTo(m1.valores['depreciacion_anual_k'][5] + 10, 6);
    expect(m2.valores['depreciacion_anual_k'][10]).toBeCloseTo(m1.valores['depreciacion_anual_k'][10] + 10, 6);
  });

  test('activos totalmente depreciados dejan de depreciar (clínica: informática 5 años)', () => {
    const p = crearProyectoClinica();
    const m = computeProject(p);
    const inf = m.depreciacion.find((a) => a.id === 'iv-9')!;
    expect(inf.vidaUtilAnios).toBe(5);
    for (let t = 6; t <= 10; t++) expect(inf.depreciacion[t]).toBe(0);
    expect(inf.acumulada).toBeCloseTo(35, 4);
  });

  test('la depreciación se reincorpora UNA sola vez al flujo (gasto no monetario)', () => {
    const p = crearProyectoClinica();
    const m = computeProject(p);
    // DOC-002 §4.1: FCFF_año1 = UDI + (intereses devengados − escudo fiscal)
    //               + depreciación − CAPEX ampliaciones
    const udi = m.valores['utilidad_despues_impuestos_k'][1];
    const inter = m.deuda[1].interesDevengado;
    const dep = m.valores['depreciacion_anual_k'][1];
    const capex = m.indicadores.capexAmpliaciones[1] ?? 0;
    const escudo = m.indicadores.escudoFiscal[1];
    expect(escudo).toBeCloseTo(inter * 0.35, 4); // escudo = interés × tasa con la regla plana
    expect(m.indicadores.fcff[1]).toBeCloseTo(udi + inter - escudo + dep - capex, 4);
    // Y el CAPEX de la ampliación NO entra en el año 1 (la ampliación es año 7).
    expect(capex).toBe(0);
  });

  test('la depreciación de cada activo es exactamente la suma del calendario del motor', () => {
    const p = crearProyectoClinica();
    const m = computeProject(p);
    for (const t of m.years) {
      const suma = m.depreciacion.reduce((s, a) => s + (a.depreciacion[t] ?? 0), 0);
      expect(m.depreciacionTotal[t]).toBeCloseTo(suma, 6);
    }
  });
});
