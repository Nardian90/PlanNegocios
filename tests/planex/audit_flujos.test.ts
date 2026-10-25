// ============================================================================
// MISIÓN §16.3 — Pruebas de flujo de caja y recuperación (AMBOS indicadores).
//  · Recuperación del proyecto (FCFF) y del capital aportado (FCFE).
//  Casos: dentro del horizonte, fuera del horizonte, sin recuperación,
//  acumulado con varios cambios de signo, inversiones adicionales,
//  amortizaciones y deuda, cambios del capital de trabajo.
// ============================================================================

import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { calcularRecuperacion, acumular } from '../../src/lib/planex/engine/flujos';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import type { PlanexProject } from '../../src/lib/planex/types';

function clonar<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

describe('MISIÓN §4.3/§16.3 — Cálculo de la recuperación (interpolación)', () => {
  test('interpolación lineal explícita: (t−1) + |anterior| / (actual − anterior)', () => {
    // Acumulado: −100 en año 3, +50 en año 4 → 3 + 100/150 = 3,6667
    const r = calcularRecuperacion('proyecto', { 0: -400, 1: -300, 2: -200, 3: -100, 4: 50 }, [0, 1, 2, 3, 4]);
    expect(r.anios).toBeCloseTo(3 + 100 / 150, 4);
    expect(r.anioCruce).toBe(4);
    expect(r.indeterminado).toBe(false);
    expect(r.motivo).toContain('interpolación lineal');
  });

  test('recuperación en el primer período (acumulado ya positivo)', () => {
    const r = calcularRecuperacion('socios', { 0: 10, 1: 20 }, [0, 1]);
    expect(r.anios).toBe(0);
  });

  test('fuera del horizonte: null y sin número aparentemente definitivo', () => {
    const r = calcularRecuperacion('proyecto', { 0: -400, 1: -300, 2: -250 }, [0, 1, 2]);
    expect(r.anios).toBeNull();
    expect(r.motivo).toContain('No se recupera');
  });

  test('flujos no convencionales (varios cambios de signo): indeterminado con advertencia', () => {
    // Flujos −100, +120, −50, +80 → acumulado −100, +20, −30, +50: cruza el
    // cero varias veces y el período de recuperación queda indeterminado.
    const acum = acumular({ 0: -100, 1: 120, 2: -50, 3: 80 }, [0, 1, 2, 3]);
    const r = calcularRecuperacion('proyecto', acum, [0, 1, 2, 3]);
    expect(r.indeterminado).toBe(true);
    expect(r.motivo).toContain('más de una vez');
  });
});

describe('MISIÓN §16.3 — Flujos del proyecto y de los socios en la clínica', () => {
  const p = crearProyectoClinica();
  const m = computeProject(p);

  test('FCFF excluye las decisiones de financiación; FCFE las incluye', () => {
    for (const t of m.years) {
      const f = m.deuda[t];
      // FCFE = FCFF − interés pagado + desembolso − amortización
      expect(m.indicadores.fcfe[t]).toBeCloseTo(
        m.indicadores.fcff[t] - f.interesPagado + f.desembolso - f.amortizacion,
        4
      );
    }
  });

  test('la recuperación del proyecto y la de los socios son indicadores SEPARADOS', () => {
    const recP = m.indicadores.recuperacionProyecto;
    const recS = m.indicadores.recuperacionSocios;
    expect(recP.indicador).toBe('proyecto');
    expect(recS.indicador).toBe('socios');
    // Con el crédito de la clínica, los socios recuperan ANTES (el desembolso
    // alivia el año 0) pero pagan servicio de deuda después: ambos cercanos.
    expect(recP.anios).not.toBeNull();
    expect(recS.anios).not.toBeNull();
    expect(recS.anios!).toBeLessThan(recP.anios! + 1);
    expect(recS.anios!).toBeGreaterThan(2);
    expect(recP.anios!).toBeGreaterThan(3);
    // El plan viejo afirmaba 4,0 años mezclando metodologías: el nuevo valor
    // surge de los flujos y NO está forzado a la cifra anterior.
    expect(recP.anios).not.toBeCloseTo(4.0, 2);
  });

  test('con crédito deshabilitado, FCFF y FCFE coinciden', () => {
    const q = clonar(crearProyectoClinica());
    q.financiero.deuda.habilitada = false;
    q.parametros.find((x) => x.id === 'credito_monto_k')!.valor = 0;
    // Ajuste de aportaciones para cubrir la inversión exactamente (sin crédito)
    q.aportaciones.find((a) => a.id === 'ap-ex-ef')!.montos = [420 + 300, 0, 0];
    const mm = computeProject(q);
    for (const t of mm.years) {
      expect(mm.indicadores.fcfe[t]).toBeCloseTo(mm.indicadores.fcff[t], 6);
    }
    expect(mm.indicadores.recuperacionProyecto.anios).toBeCloseTo(mm.indicadores.recuperacionSocios.anios!, 6);
  });

  test('capital de trabajo: sin recuperación por defecto (conservador) y con parámetro > 0 entra en el último año', () => {
    const base = crearProyectoClinica();
    const mBase = computeProject(base);
    expect(base.parametros.find((x) => x.id === 'pct_recuperacion_capital_trabajo')!.valor).toBe(0);
    expect(mBase.indicadores.fcff[10]).not.toBeCloseTo(mBase.indicadores.fcff[9] + 0, 4); // sin liberación
    expect(mBase.issues.some((i) => i.codigo === 'CT_RECUPERACION')).toBe(false);

    const q = clonar(base);
    q.parametros.find((x) => x.id === 'pct_recuperacion_capital_trabajo')!.valor = 0.5;
    const m2 = computeProject(q);
    const ct = q.parametros.find((x) => x.id === 'capital_trabajo_k')!.valor;
    expect(m2.indicadores.fcff[10]).toBeCloseTo(mBase.indicadores.fcff[10] + 0.5 * ct, 4);
    // Solo en el ÚLTIMO año del horizonte.
    expect(m2.indicadores.fcff[5]).toBeCloseTo(mBase.indicadores.fcff[5], 4);
    expect(m2.issues.some((i) => i.codigo === 'CT_RECUPERACION')).toBe(true);
  });

  test('inversiones adicionales (ampliación) retrasan el acumulado y pueden crear flujos no convencionales', () => {
    const base = crearProyectoClinica();
    const mBase = computeProject(base);
    const capex = mBase.indicadores.capexAmpliaciones[7] ?? 0;
    expect(capex).toBeCloseTo(150, 1); // ampliación programada del año 7
    // El FCFF del año 7 incorpora el CAPEX de la ampliación.
    expect(mBase.indicadores.fcff[7]).toBeCloseTo(
      mBase.valores['utilidad_despues_impuestos_k'][7] +
        mBase.deuda[7].interesDevengado +
        mBase.valores['depreciacion_anual_k'][7] -
        capex,
      4
    );
    // Y el acumulado del año 7 crece menos que sin ampliación.
    const sinAmp = clonar(base);
    sinAmp.recursos.find((r) => r.id === 're-gab')!.expansiones = [];
    const mSin = computeProject(sinAmp);
    expect(mBase.indicadores.fcffAcumulado[7]).toBeLessThan(mSin.indicadores.fcffAcumulado[7]);
  });

  test('sin recuperación en horizonte corto: NO_RECUPERACION + texto de conclusiones honesto', () => {
    const q = clonar(crearProyectoClinica());
    q.ajustes.horizonteAnios = 2;
    const m2 = computeProject(q);
    expect(m2.indicadores.recuperacionProyecto.anios).toBeNull();
    expect(m2.issues.some((i) => i.codigo === 'NO_RECUPERACION')).toBe(true);
  });

  test('la recuperación se calcula sobre los FLUJOS y cambia al modificarlos (no es fija)', () => {
    const base = crearProyectoClinica();
    const m1 = computeProject(base);
    const q = clonar(base);
    q.parametros.find((x) => x.id === 'crecimiento_precios')!.valor = 0.0; // precios planos
    const m2 = computeProject(q);
    expect(m2.indicadores.recuperacionProyecto.anios!).toBeGreaterThan(m1.indicadores.recuperacionProyecto.anios!);
  });
});

describe('MISIÓN §16.3 — FCFE con deuda: caja de dividendos y servicio', () => {
  test('la caja acumulada para dividendos usa el FCFE ANTES de repartos', () => {
    const p = crearProyectoClinica();
    const m = computeProject(p);
    for (const d of m.dividendos) {
      expect(d.cajaAcumulada).toBeCloseTo(m.indicadores.fcfeAcumulado[d.anio] ?? 0, 4);
      expect(d.pagables).toBeLessThanOrEqual(d.propuestos + 1e-9);
      expect(d.pagables).toBeLessThanOrEqual(Math.max(0, d.cajaAcumulada) + 1e-9);
    }
  });

  test('pagables = MIN(propuestos, max(0, caja)): la liquidez modelada decide el reparto', () => {
    const p = crearProyectoClinica();
    const m = computeProject(p);
    // La caja acumulada (FCFE desde el inicio, ANTES de repartos) es negativa
    // mientras la empresa no ha recuperado su desembolso inicial: allí los
    // dividendos propuestos quedan recortados a cero; cuando la caja es
    // suficiente el reparte es íntegro. La identidad MIN se cumple SIEMPRE.
    for (const d of m.dividendos) {
      expect(d.pagables).toBeCloseTo(Math.min(d.propuestos, Math.max(0, d.cajaAcumulada)), 6);
      expect(d.pagables).toBeLessThanOrEqual(d.propuestos + 1e-9);
      expect(d.pagables).toBeLessThanOrEqual(Math.max(0, d.cajaAcumulada) + 1e-9);
    }
    const restringidos = m.dividendos.filter((d) => d.propuestos > d.pagables + 0.005);
    // La plantilla demostrativa SÍ restringe dividendos durante la fase en
    // que la caja acumulada aún no cubre lo propuesto (misión §8: no toda
    // utilidad propuesta es pagable; la liquidez modelada decide).
    expect(restringidos.length).toBeGreaterThan(0);
    expect(m.issues.some((i) => i.codigo === 'DIVIDENDOS_RESTRINGIDOS')).toBe(true);
    // Toda restricción cumple propuestos > max(0, caja) (la identidad MIN ya
    // lo garantiza; se explicita como documentación del criterio).
    for (const d of restringidos) expect(d.propuestos).toBeGreaterThan(Math.max(0, d.cajaAcumulada));
  });

  test('caja ajustada: los propuestos se recortan a los pagables (restricción por liquidez)', () => {
    const q = clonar(crearProyectoClinica());
    // Reparto del 100 %: los propuestos pueden superar la caja en el año 1
    q.parametros.find((x) => x.id === 'pct_reparto_dividendos')!.valor = 1;
    const m = computeProject(q);
    const d1 = m.dividendos.find((d) => d.anio === 1)!;
    // pagables = MIN(propuestos, max(0, caja)) — nunca por encima de la caja.
    expect(d1.pagables).toBeLessThanOrEqual(Math.max(0, d1.cajaAcumulada) + 1e-9);
    const recorte = m.dividendos.filter((d) => d.propuestos > d.pagables + 0.005);
    if (recorte.length > 0) {
      expect(m.issues.some((i) => i.codigo === 'DIVIDENDOS_RESTRINGIDOS')).toBe(true);
    }
  });

  test('el saldo acumulable absorbe la pérdida de montaje antes de distribuir (misión §8)', () => {
    const p = crearProyectoClinica();
    const m = computeProject(p);
    const d1 = m.dividendos.find((d) => d.anio === 1)!;
    expect(d1.saldoAcumulablePrevio).toBeCloseTo(-1.44, 4); // pérdida del año 0
    expect(d1.base).toBeCloseTo(Math.max(0, d1.udi + d1.saldoAcumulablePrevio), 4);
    // Reserva del 10 % sobre la base, reparto del 50 % del distribuible.
    const pctReserva = p.parametros.find((x) => x.id === 'pct_reserva_legal')!.valor;
    const pctReparto = p.parametros.find((x) => x.id === 'pct_reparto_dividendos')!.valor;
    expect(d1.reserva).toBeCloseTo(d1.base * pctReserva, 4);
    expect(d1.propuestos).toBeCloseTo((d1.base - d1.reserva) * pctReparto, 4);
  });

  test('participación y reparto son conceptos distintos (40 % cubana ≠ 50 % reparto)', () => {
    const p = crearProyectoClinica();
    const m = computeProject(p);
    const pctCubana = p.parametros.find((x) => x.id === 'pct_parte_cubana')!.valor;
    const pctReparto = p.parametros.find((x) => x.id === 'pct_reparto_dividendos')!.valor;
    expect(pctCubana).not.toBe(pctReparto);
    for (const d of m.dividendos) {
      if (d.pagables <= 0) continue;
      expect(d.socioNacional).toBeCloseTo(d.pagables * pctCubana, 6);
      expect(d.socioExtranjero).toBeCloseTo(d.pagables * (1 - pctCubana), 6);
      expect(d.socioNacional + d.socioExtranjero).toBeCloseTo(d.pagables, 6);
    }
  });
});
