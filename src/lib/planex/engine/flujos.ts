// ============================================================================
// Motor estructural — Flujos de caja y recuperación (misión §4, revisada por
// PLANEX-DOC-002 §4.1).
//
// El plan anterior mezclaba la utilidad neta con la amortización del crédito
// y comparaba el resultado contra la INVERSIÓN TOTAL del proyecto. Esa mezcla
// no permite interpretar la recuperación. Se reconstruyen DOS indicadores:
//
// 1) FLUJO DEL PROYECTO (FCFF) — decisiones de inversión, excluidas las de
//    financiación. La utilidad neta (UDI) ya descuenta el gasto por intereses
//    CON SU EFECTO TRIBUTARIO (escudo fiscal): los intereses reducen el
//    impuesto a pagar. Por eso al FCFF solo se reincorpora el interés DESPUÉS
//    DE IMPUESTOS, no el interés completo:
//    FCFF_t = UDI_t + (intereses_devengados_t − escudo_fiscal_t) + depreciación_t
//             − CAPEX_t − ΔCT_t (+ CT recup.)
//    El escudo se DERIVA de la propia regla de impuestos del proyecto:
//      escudo_t = impuesto(sin deducir intereses)_t − impuesto(regla activa)_t
//    Con la regla plana vigente (MAX(0, UAI × tasa)) equivale a
//    intereses × tasa cuando la base es positiva. Si la regla de impuestos
//    no depende de la base después de intereses, el escudo es cero y la
//    fórmula coincide con la reincorporación completa (coherente con el
//    tratamiento fiscal real del modelo).
//    FCFF_0 = UDI_0 − inversiónTotal  (el efecto de montaje del año 0 queda
//     incluido; el CAPEX inicial es la inversión total).
//    Recuperación de la INVERSIÓN TOTAL: primer instante en que el flujo
//    acumulado del proyecto cruza el cero.
//
// 2) FLUJO DE LOS SOCIOS (FCFE) — perspectiva del capital aportado:
//    FCFE_t = FCFF_t − (intereses_pagados_t − escudo_fiscal_t)
//             + desembolsoDeuda_t − amortización_t
//    FCFE_0 = −aportacionesTotales + UDI_0 + desembolso_0
//    (equivale a UDI + depreciación − amortización + desembolsos − CAPEX − ΔCT
//     cuando los intereses se pagan corrientes; si la gracia es TOTAL, la
//     porción capitalizada no es salida de caja y se reincorpora íntegra)
//    Recuperación del CAPITAL APORTADO: cruce del acumulado FCFE.
//
// RECONCILIACIÓN ALGEBRAICA (probada en tests):
//    FCFF_t − FCFE_t = intereses_pagados_t − escudo_t − desembolsos_t + amortización_t
//    Con intereses corrientes: FCFE_t = UDI + depreciación − CAPEX + recup. CT
//      + desembolsos − amortizaciones (definición estándar del flujo al accista).
//
// RECUPERACIÓN (§4.3): interpolación lineal intranual explícita. Es una
// RECUPERACIÓN SIMPLE, SIN DESCONTAR: no se aplica tasa de descuento alguna
// a los flujos (no es un VAN ni una TIR).    payback = (t−1) + |acum_{t−1}| / (acum_t − acum_{t−1})
//  cuando acum_{t−1} < 0 ≤ acum_t. Se distingue:
//    - recuperación dentro del horizonte,
//    - recuperación posterior al horizonte (no recuperado en N años),
//    - indeterminada (flujos no convencionales con varios cambios de signo:
//      se advierte y NO se emite una cifra aparentemente definitiva).
//
// CAPITAL DE TRABAJO (§4.4): el desembolso inicial forma parte de la inversión
// total. Su recuperación al final del horizonte NO se supone: solo entra si
// el parámetro `pct_recuperacion_capital_trabajo` lo indica (regla explícita,
// documentada y configurable; el 0 % por defecto es una HIPÓTESIS conservadora
// del modelo, no una regla universal).
// ============================================================================

import { Recuperacion, FlujoIndicador } from '../types';

/** Período de recuperación (SIMPLE, SIN DESCONTAR) por interpolación lineal
 *  sobre el acumulado. Devuelve también los cambios de signo para calificar
 *  el indicador. */
export function calcularRecuperacion(
  indicador: FlujoIndicador,
  acumulado: Record<number, number>,
  years: number[]
): Recuperacion {
  const motivoBase =
    indicador === 'proyecto'
      ? 'Acumulado del flujo de caja del proyecto (FCFF) frente a la inversión total. Recuperación simple, sin descontar: los flujos no se actualizan con tasa de descuento alguna.'
      : 'Acumulado del flujo de caja de los socios (FCFE) frente al capital aportado. Recuperación simple, sin descontar: los flujos no se actualizan con tasa de descuento alguna.';

  const valores = years.map((t) => acumulado[t] ?? 0);
  // Cambios de signo en el acumulado a partir del primer valor negativo.
  let cruces = 0;
  let prev: number | null = null;
  for (const v of valores) {
    if (v === 0) continue;
    if (prev !== null && Math.sign(v) !== Math.sign(prev)) cruces++;
    prev = v;
  }

  if ((acumulado[years[0]] ?? 0) >= 0) {
    return { indicador, anios: 0, anioCruce: years[0], indeterminado: false, motivo: `${motivoBase} El acumulado ya es no negativo en el primer período.` };
  }

  for (let i = 1; i < years.length; i++) {
    const a = valores[i - 1];
    const b = valores[i];
    if (a < 0 && b >= 0) {
      const anios = years[i - 1] + -a / (b - a);
      const indeterminado = cruces > 1;
      return {
        indicador,
        anios,
        anioCruce: years[i],
        indeterminado,
        motivo: indeterminado
          ? `${motivoBase} Se aplica interpolación lineal intranual: (t−1) + |acumulado anterior| / (acumulado actual − acumulado anterior). ATENCIÓN: el acumulado cambia de signo más de una vez (flujos no convencionales, p. ej. inversiones adicionales): el período de recuperación debe interpretarse con cautela.`
          : `${motivoBase} Se aplica interpolación lineal intranual: (t−1) + |acumulado anterior| / (acumulado actual − acumulado anterior).`,
      };
    }
  }

  return {
    indicador,
    anios: null,
    anioCruce: null,
    indeterminado: cruces > 1,
    motivo: cruces > 1
      ? `${motivoBase} No se recupera dentro del horizonte y el acumulado cambia de signo más de una vez: interpretación limitada.`
      : `${motivoBase} No se recupera dentro del horizonte de análisis.`,
  };
}

/** Serie acumulada de un flujo por año. */
export function acumular(flujo: Record<number, number>, years: number[]): Record<number, number> {
  const salida: Record<number, number> = {};
  let suma = 0;
  for (const t of years) {
    suma += flujo[t] ?? 0;
    salida[t] = suma;
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Conciliación del arranque (misión DOC-002-R1 §2)
//
// La brecha de financiación del año 0 se obtiene de PARTIDAS DE SALIDA DE
// CAJA EXPLÍCITAMENTE IDENTIFICADAS como no capitalizables y no incluidas en
// la inversión total. NO se deduce del resultado contable después de
// impuestos (UDI_0): la UDI del año 0 incluye pérdidas no monetarias
// (depreciación de activos disponibles en el año 0), intereses devengados
// PERO CAPITALIZADOS (que no son salida de caja) y netea ingresos del año 0,
// por lo que max(0, −UDI_0) NO representa el gasto de caja del arranque.
//
// Partidas explícitas consideradas (todas reglas/series activas del modelo):
//   · nómina de montaje del año 0        → regla «costo_laboral_k» (SUMA_PERSONAL
//     sobre la etapa «montaje»; gasto del período, no capitalizable)
//   · interés PAGADO del año 0          → calendario de deuda (solo caja: la
//     porción capitalizada en gracia total NO es salida)
//   · impuesto sobre utilidades del año 0 → regla «impuesto_utilidades_k» (si
//     es positivo: con pérdidas de montaje la regla plana da cero)
//   · menos ingresos explícitos del año 0 → regla «ingresos_totales_k» (solo
//     año 0: otros ingresos declarados por el usuario)
//
// El capital de trabajo NO se suma aparte: ya está DENTRO de la inversión
// total («inversion_total_k = gastos previos + inversión fija + capital de
// trabajo»), de modo que la brecha nunca lo duplica.
// ---------------------------------------------------------------------------

export interface ConciliacionArranque {
  /** Nómina de montaje del año 0 (kUSD; regla costo_laboral_k, año 0). */
  nominaMontaje: number;
  /** Interés PAGADO en caja durante el año 0 (kUSD; excluye lo capitalizado). */
  interesPagado: number;
  /** Impuesto sobre utilidades pagadero del año 0 (kUSD; ≥ 0). */
  impuestoPagado: number;
  /** Ingresos explícitos del año 0 (kUSD; reducen la necesidad de caja). */
  ingresosAnio0: number;
  /** Salidas netas de caja del año 0 explícitamente identificadas (kUSD). */
  gastoCajaAnio0: number;
  /** Financiación disponible declarada (kUSD; año 0). */
  financiacionDisponible: number;
  /** Inversión total (kUSD; incluye el capital de trabajo). */
  inversionTotal: number;
  /** Necesidad total de arranque = inversión total + gasto de caja del año 0. */
  necesidadTotal: number;
  /** Brecha de financiación (kUSD; negativa = faltante sin cobertura). */
  brecha: number;
}

/** Concilia el arranque desde salidas de caja EXPLÍCITAS del año 0 (DOC-002-R1). */
export function conciliarArranque(m: {
  valores: Record<string, Record<number, number>>;
  deuda: { anio: number; interesPagado: number }[];
}): ConciliacionArranque {
  const val = (id: string): number => {
    const v = m.valores[id]?.[0];
    return Number.isFinite(v) ? (v as number) : 0;
  };
  const nominaMontaje = Math.max(0, val('costo_laboral_k'));
  const interesPagado = Math.max(0, m.deuda.find((f) => f.anio === 0)?.interesPagado ?? 0);
  const impuestoPagado = Math.max(0, val('impuesto_utilidades_k'));
  const ingresosAnio0 = Math.max(0, val('ingresos_totales_k'));
  const gastoCajaAnio0 = nominaMontaje + interesPagado + impuestoPagado - ingresosAnio0;
  const financiacionDisponible = val('financiacion_disponible_k');
  const inversionTotal = val('inversion_total_k');
  const necesidadTotal = inversionTotal + Math.max(0, gastoCajaAnio0);
  const brecha = financiacionDisponible - necesidadTotal;
  return {
    nominaMontaje,
    interesPagado,
    impuestoPagado,
    ingresosAnio0,
    gastoCajaAnio0,
    financiacionDisponible,
    inversionTotal,
    necesidadTotal,
    brecha,
  };
}
