// ============================================================================
// PLANEX — Contexto de moneda de presentación (misión PLANEX-DOC-001 §5).
//
// Fuente única de verdad de la tasa: el PARÁMETRO «tipo_cambio» del propio
// plan (CUP por USD), con su fecha y fuente documentadas. Este módulo no
// introduce tasas propias ni modifica datos: expone conversiones DESDE LA
// MONEDA DE ORIGEN hacia la moneda de presentación, aplicadas UNA sola vez
// y con precisión completa (el redondeo ocurre solo al formatear).
//
//   USD = CUP / tasa_CUP_por_USD
//   CUP = USD × tasa_CUP_por_USD
//
// Reglas protegidas (misión §5.2):
//   1. Los importes del plan JAMÁS se reescriben al cambiar la moneda.
//   2. Cada importe se convierte desde su moneda de origen, nunca desde una
//      cifra ya convertida (sin conversiones encadenadas).
//   3. Los porcentajes, cantidades físicas, trabajadores, horas, vidas útiles
//      y períodos NO se convierten.
//   4. Los salarios permanecen en CUP (unidad que exige la metodología 4.9);
//      cuando la presentación es USD se añade el equivalente documentado.
// ============================================================================

import { PlanexProject, MonedaPresentacion, InversionRow } from '../types';
import { fmtK } from '../format';

export interface DatosTasa {
  /** CUP por USD (parámetro tipo_cambio del plan). */
  tasa: number;
  /** Fecha de referencia ISO (yyyy-mm-dd) o ''. */
  fecha: string;
  /** Fuente documentada del supuesto. */
  fuente: string;
  /** ¿Es un supuesto de demostración? */
  demo: boolean;
}

/** Tasa activa del plan, leída del parámetro existente (fuente de verdad). */
export function tasaCambioDe(p: PlanexProject): DatosTasa {
  const param = p.parametros.find((x) => x.id === 'tipo_cambio');
  const valor = param?.valor;
  const tasa = Number.isFinite(valor) && (valor as number) > 0 ? (valor as number) : 1;
  return {
    tasa,
    fecha: param?.fechaRef ?? '',
    fuente: param?.fuente ?? '',
    demo: param?.demo ?? false,
  };
}

export interface ContextoMoneda {
  moneda: MonedaPresentacion;
  tasa: number;
  /** Importe del motor en kUSD → MILES de la moneda de presentación. */
  kUSDaK: (k: number) => number;
  /** Importe en CUP completos → MILES de la moneda de presentación. */
  cupAK: (cup: number) => number;
  /** CUP completos → USD completos (equivalentes puntuales, p. ej. salarios). */
  cupAUsd: (cup: number) => number;
  /** USD completos → CUP completos (equivalentes puntuales). */
  usdACup: (usd: number) => number;
  /** Formatea MILES de la moneda de presentación (1 decimal, es-ES agrupado). */
  fmtKPres: (n: number) => string;
  /** Etiqueta de unidad para encabezados de tablas financieras. */
  unidadTabla: string;
  /** Abreviatura de la unidad: 'kUSD' | 'kCUP'. */
  unidadCorta: string;
  /** Unidad en textos: 'miles de USD' | 'miles de CUP'. */
  unidadLarga: string;
  /** Código de moneda: 'USD' | 'CUP'. */
  simbolo: string;
  /** Fila de inversión (monto en miles de la moneda de la fila) → miles de presentación. */
  montoFilaAK: (fila: InversionRow) => number;
}

/** Crea el contexto de conversión para la moneda pedida. */
export function crearContextoMoneda(p: PlanexProject, moneda: MonedaPresentacion): ContextoMoneda {
  const { tasa } = tasaCambioDe(p);

  if (moneda === 'USD') {
    return {
      moneda,
      tasa,
      // kUSD → kUSD (identidad; la conversión CUP→USD ya la hizo el motor).
      kUSDaK: (k) => k,
      // CUP completos → miles de USD: CUP/tasa/1000.
      cupAK: (cup) => cup / tasa / 1000,
      cupAUsd: (cup) => cup / tasa,
      usdACup: (usd) => usd * tasa,
      fmtKPres: fmtK,
      unidadTabla: 'Miles de USD (kUSD)',
      unidadCorta: 'kUSD',
      unidadLarga: 'miles de USD',
      simbolo: 'USD',
      // Fila en USD → kUSD (identidad); fila en CUP → kUSD vía tasa.
      montoFilaAK: (f) => (f.moneda === 'CUP' ? f.monto / tasa : f.monto),
    };
  }

  return {
    moneda,
    tasa,
    // kUSD → miles de CUP: kUSD × tasa (1000 USD → 1000·tasa CUP = tasa·miles).
    kUSDaK: (k) => k * tasa,
    // CUP completos → miles de CUP.
    cupAK: (cup) => cup / 1000,
    cupAUsd: (cup) => cup,
    usdACup: (usd) => usd,
    fmtKPres: fmtK,
    unidadTabla: 'Miles de CUP (kCUP)',
    unidadCorta: 'kCUP',
    unidadLarga: 'miles de CUP',
    simbolo: 'CUP',
    // Fila en USD → kCUP vía tasa; fila en CUP → kCUP (identidad).
    montoFilaAK: (f) => (f.moneda === 'USD' ? f.monto * tasa : f.monto),
  };
}

/** Moneda de presentación del plan con valor por defecto retrocompatible. */
export function monedaPresentacionDe(p: PlanexProject): MonedaPresentacion {
  return p.ajustes.monedaPresentacion === 'CUP' ? 'CUP' : 'USD';
}

/** Nota documental de conversión (misión §5.2.10): tasa, fecha y fuente.
 *  (DOC-002-R1 §6): con un supuesto de demostración, la fecha se presenta
 *  como CORTE DEL SUPUESTO, no como cotización observada; una fecha posterior
 *  a la del documento se marca como PREVISTA (el diagnóstico la emite como
 *  hallazgo TASA_FECHA_FUTURA). */
export function notaConversion(ctx: ContextoMoneda, tasa: DatosTasa, fechaDocumento?: string): string {
  const fechaDoc = (fechaDocumento ?? '').trim();
  const esISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const posterior = esISO(fechaDoc) && esISO(tasa.fecha) && tasa.fecha > fechaDoc;
  const fecha = tasa.fecha
    ? ` (fecha de referencia: ${tasa.fecha}${tasa.demo ? ' — fecha de corte del supuesto ilustrativo, no una cotización observada' : ''}${posterior ? ', PREVISTA: es posterior a la fecha del documento' : ''})`
    : '';
  const origen = tasa.fuente || 'fuente no documentada';
  const sup = tasa.demo
    ? ' SUPUESTO DE DEMOSTRACIÓN EDITABLE, PENDIENTE DE VALIDACIÓN OFICIAL: manténgalo como supuesto ilustrativo mientras no exista una fuente oficial verificable; antes de un uso oficial debe sustituirse por la tasa vigente con su fecha y fuente documentadas.'
    : '';
  return (
    `Moneda de presentación del documento: ${ctx.simbolo}. ` +
    `Conversión aplicada una sola vez desde la moneda de origen de cada importe con el tipo de cambio parametrizado de ` +
    `${fmtK(tasa.tasa)} CUP por USD${fecha}; fuente: ${origen}.${sup} ` +
    `Los porcentajes, cantidades físicas, plantillas, horas y períodos no se convierten; los salarios se expresan en CUP ` +
    `conforme a la metodología 4.9${ctx.moneda === 'USD' ? ', con su equivalente en USD documentado' : ''}. ` +
    `El redondeo es solo de presentación: los totales se calculan con precisión completa y pueden diferir de la suma de cifras redondeadas.`
  );
}
