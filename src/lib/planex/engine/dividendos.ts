// ============================================================================
// Motor estructural — Dividendos y beneficios distribuibles (misión §8).
//
// El modelo anterior aplicaba «UDI × participación × reparto» sin resolver
// resultados acumulados, reservas ni disponibilidad de efectivo. Este módulo
// recorre el horizonte con estado contable y de caja:
//
//   saldoAcumulable_0 = UDI_0 (pérdida de montaje, si existe)
//   para t = 1..N:
//     base_t          = max(0, UDI_t + saldoAcumulable_{t−1})
//                       (las pérdidas acumuladas reducen la base; nunca se
//                        distribuye por encima de los resultados positivos
//                        acumulados no distribuidos)
//     reserva_t       = pct_reserva × base_t
//     distribuible_t  = base_t − reserva_t
//     propuestos_t    = pct_reparto × distribuible_t
//     cajaAcumulada_t  = Σ_{k=1..t} FCFE_k   (antes de dividendos)
//     pagables_t      = min(propuestos_t, max(0, cajaAcumulada_t))
//                       (no se paga más de lo que la caja modelada permite)
//     socioNacional    = pagables_t × participación cubana
//     socioExtranjero  = pagables_t × (1 − participación cubana)
//     saldoAcumulable_t = saldoAcumulable_{t−1} + UDI_t − reserva_t − pagables_t
//
// La PARTICIPACIÓN de cada socio (composición del capital) y el REPARTO
// (fracción distribuible) son conceptos distintos y se configuran por
// separado. Los porcentajes y la reserva son supuestos demostrativos editables
// que deben validarse jurídicamente: el sistema no fija la regla legal.
// ============================================================================

import { DividendosAnio } from '../types';

export interface EntradaDividendos {
  udiPorAnio: Record<number, number>;
  years: number[];
  /** Fracción de la utilidad distribuible que se propone repartir. */
  pctReparto: number;
  /** Reserva (fracción de la base distribuible) — supuesto editable. */
  pctReserva: number;
  /** Participación de la parte cubana en el capital social. */
  pctParteCubana: number;
  /** Caja acumulada disponible para distribuir por año (FCFE antes de dividendos). */
  cajaAcumulada: Record<number, number>;
}

export function calcularDividendos(entrada: EntradaDividendos): DividendosAnio[] {
  const { udiPorAnio, years, pctReparto, pctReserva, pctParteCubana, cajaAcumulada } = entrada;
  const reparto = clamp01(pctReparto);
  const reserva = clamp01(pctReserva);
  const cubana = clamp01(pctParteCubana);

  const salida: DividendosAnio[] = [];
  let saldo = 0;

  for (const t of years) {
    const udi = Number.isFinite(udiPorAnio[t]) ? udiPorAnio[t] : 0;
    if (t === 0) {
      saldo = udi; // la pérdida de montaje (si existe) arranca el acumulable
      salida.push({
        anio: t,
        udi,
        saldoAcumulablePrevio: 0,
        base: 0,
        reserva: 0,
        distribuible: 0,
        propuestos: 0,
        cajaAcumulada: 0,
        pagables: 0,
        socioNacional: 0,
        socioExtranjero: 0,
        saldoAcumulable: saldo,
      });
      continue;
    }
    const previo = saldo;
    const base = Math.max(0, udi + previo);
    const res = base * reserva;
    const distribuible = base - res;
    const propuestos = distribuible * reparto;
    const caja = Number.isFinite(cajaAcumulada[t]) ? cajaAcumulada[t] : 0;
    const pagables = Math.min(propuestos, Math.max(0, caja));
    saldo = previo + udi - res - pagables;
    salida.push({
      anio: t,
      udi,
      saldoAcumulablePrevio: previo,
      base,
      reserva: res,
      distribuible,
      propuestos,
      cajaAcumulada: caja,
      pagables,
      socioNacional: pagables * cubana,
      socioExtranjero: pagables * (1 - cubana),
      saldoAcumulable: saldo,
    });
  }
  return salida;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}
