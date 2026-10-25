// ============================================================================
// Motor estructural — Depreciación por activo y período (misión §5).
//
// Cada fila de inversión fija es un activo depreciable con:
//  - costo de adquisición (USD o CUP, convertida con tipo_cambio),
//  - valor residual configurable,
//  - año de disponibilidad para uso (por defecto 1: primer año de operación),
//  - vida útil y método (lineal).
//
// Reglas del calendario (documentadas en docs/audit/MODELO_FINANCIERO.md):
//  dep(a, t) = 0                                   si t < disponible(a)
//  dep(a, t) = min(cuota, base − acumulada_previa)  si disponible(a) ≤ t < disponible(a) + vida
//  dep(a, t) = 0                                    si t ≥ disponible(a) + vida
//  cuota = base × (1 − residual) / vida   (lineal)
//
// El calendario limita la depreciación acumulada al importe depreciable:
// un activo jamás deprecia más que su base ni continúa depreciándose una vez
// agotada su vida útil. La depreciación NO es desembolso: el flujo de caja la
// reincorpora una sola vez como gasto no monetario.
// ============================================================================

import { InversionRow, ActivoDepreciable } from '../types';

export interface EntradaDepreciacion {
  inversion: InversionRow[];
  horizonteAnios: number;
  tipoCambio: number;
}

/** Construye el registro de activos depreciables y su calendario completo. */
export function calcularDepreciacion(entrada: EntradaDepreciacion): {
  activos: ActivoDepreciable[];
  totalPorAnio: Record<number, number>;
  issues: string[];
} {
  const { inversion, horizonteAnios, tipoCambio } = entrada;
  const activos: ActivoDepreciable[] = [];
  const totalPorAnio: Record<number, number> = {};
  const issues: string[] = [];
  const tc = Number.isFinite(tipoCambio) && tipoCambio > 0 ? tipoCambio : 1;

  for (let t = 0; t <= horizonteAnios; t++) totalPorAnio[t] = 0;

  for (const fila of inversion) {
    if (fila.categoria !== 'inversion_fija') continue;
    if (fila.metodoDepreciacion === 'ninguno') continue;

    const costoKUSD =
      fila.moneda === 'CUP' ? (Number.isFinite(fila.monto) ? fila.monto : 0) / tc : Number.isFinite(fila.monto) ? fila.monto : 0;

    const vida = Math.max(0, Math.trunc(fila.vidaUtilAnios));
    const disponible = Number.isFinite(fila.anioDisponible) ? Math.trunc(fila.anioDisponible) : 1;
    const residualPct = Number.isFinite(fila.valorResidualPct)
      ? Math.min(1, Math.max(0, fila.valorResidualPct))
      : 0;

    if (vida <= 0) {
      issues.push(
        `La partida de inversión fija «${fila.concepto}» no tiene vida útil definida: no se deprecia y el flujo de caja no reincorpora importe alguno por este activo.`
      );
    }
    if (costoKUSD < 0) {
      issues.push(`La partida «${fila.concepto}» tiene costo negativo: revise el monto.`);
    }

    const base = Math.max(0, costoKUSD);
    const baseDepreciable = base * (1 - residualPct);
    const activo: ActivoDepreciable = {
      id: fila.id,
      concepto: fila.concepto,
      baseDepreciableKUSD: baseDepreciable,
      vidaUtilAnios: vida,
      anioDisponible: disponible,
      valorResidualPct: residualPct,
      metodo: fila.metodoDepreciacion ?? 'lineal',
      depreciacion: {},
      acumulada: 0,
      vnl: base,
    };

    if (vida > 0 && baseDepreciable > 0) {
      const cuota = baseDepreciable / vida;
      let acumulada = 0;
      for (let t = 0; t <= horizonteAnios; t++) {
        let dep = 0;
        if (t >= disponible && t < disponible + vida) {
          dep = Math.min(cuota, baseDepreciable - acumulada);
          if (dep < 0) dep = 0;
        }
        activo.depreciacion[t] = dep;
        acumulada += dep;
        totalPorAnio[t] = (totalPorAnio[t] ?? 0) + dep;
      }
      activo.acumulada = acumulada;
    } else {
      for (let t = 0; t <= horizonteAnios; t++) activo.depreciacion[t] = 0;
    }
    activo.vnl = base - activo.acumulada;
    activos.push(activo);
  }

  return { activos, totalPorAnio, issues };
}
