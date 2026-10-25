// ============================================================================
// Motor estructural — Flujos de caja y recuperación (misión §4).
//
// El plan anterior mezclaba la utilidad neta con la amortización del crédito
// y comparaba el resultado contra la INVERSIÓN TOTAL del proyecto. Esa mezcla
// no permite interpretar la recuperación. Se reconstruyen DOS indicadores:
//
// 1) FLUJO DEL PROYECTO (FCFF) — decisiones de inversión, excluidas las de
//    financiación:
//    FCFF_t = UDI_t + intereses_t + depreciación_t − CAPEX_t − ΔCT_t (+ CT recup.)
//    (UDI ya descuenta intereses e impuestos; los intereses se reincorporan
//     por ser un flujo del financiador y no del proyecto; los impuestos son
//     los de la regla activa — tratamiento documentado.)
//    FCFF_0 = UDI_0 − inversiónTotal  (el efecto de montaje del año 0 queda
//     incluido; el CAPEX inicial es la inversión total).
//    Recuperación de la INVERSIÓN TOTAL: primer instante en que el flujo
//    acumulado del proyecto cruza el cero.
//
// 2) FLUJO DE LOS SOCIOS (FCFE) — perspectiva del capital aportado:
//    FCFE_t = FCFF_t − intereses_t + desembolsoDeuda_t − amortización_t
//    FCFE_0 = −aportacionesTotales + UDI_0 + desembolso_0
//    (equivale a UDI + depreciación − amortización + desembolsos − CAPEX − ΔCT)
//    Recuperación del CAPITAL APORTADO: cruce del acumulado FCFE.
//
// RECUPERACIÓN (§4.3): interpolación lineal intranual explícita
//    payback = (t−1) + |acum_{t−1}| / (acum_t − acum_{t−1})
//  cuando acum_{t−1} < 0 ≤ acum_t. Se distingue:
//    - recuperación dentro del horizonte,
//    - recuperación posterior al horizonte (no recuperado en N años),
//    - indeterminada (flujos no convencionales con varios cambios de signo:
//      se advierte y NO se emite una cifra aparentemente definitiva).
//
// CAPITAL DE TRABAJO (§4.4): el desembolso inicial forma parte de la inversión
// total. Su recuperación al final del horizonte NO se supone: solo entra si
// el parámetro `pct_recuperacion_capital_trabajo` lo indica (regla explícita,
// documentada y configurable).
// ============================================================================

import { Recuperacion, FlujoIndicador } from '../types';

/** Período de recuperación por interpolación lineal sobre el acumulado.
 *  Devuelve también los cambios de signo para calificar el indicador. */
export function calcularRecuperacion(
  indicador: FlujoIndicador,
  acumulado: Record<number, number>,
  years: number[]
): Recuperacion {
  const motivoBase =
    indicador === 'proyecto'
      ? 'Acumulado del flujo de caja del proyecto (FCFF) frente a la inversión total.'
      : 'Acumulado del flujo de caja de los socios (FCFE) frente al capital aportado.';

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
