// ============================================================================
// Motor estructural — Calendario financiero de la deuda (misión §6).
//
// Un único crédito con desembolso único en `anioDesembolso` (0 = montaje).
// Condiciones parametrizadas: tasa de interés, período de gracia, plazo de
// amortización, tipo de gracia y método de amortización.
//
// Invariantes verificados por el módulo y por las pruebas:
//   saldoFinal = saldoInicial + desembolso + interesCapitalizado − amortizacion
//   amortizacion_t ≤ saldo pendiente (nunca negativo)
//   intereses_t = saldo al inicio del período (con desembolso del año) × tasa
//
// Gracia de PRINCIPAL: durante la gracia se pagan intereses (flujo de caja),
// el saldo no cambia.
// Gracia TOTAL: durante la gracia no se paga nada; el interés devengado se
// CAPITALIZA en el saldo (documentado; produce un servicio mayor después).
//
// Métodos tras la gracia (ventana de amortización = gracia+1 … gracia+plazo):
//   capital_constante: amortización = min(monto/plazo, saldo) en cada año de
//     la ventana; el saldo llega exactamente a cero.
//   sistema_frances: cuota total constante C = monto × i / (1 − (1+i)^−plazo);
//     interés_t = saldo_inicial × i; amortización_t = C − interés_t.
//   pago_unico: no se amortiza hasta el último año de la ventana; entonces
//     amortiza el saldo completo (bullet).
//
// Todo el calendario se recalcula a partir de los parámetros: ninguna cifra
// del servicio de la deuda está fija en el código.
// ============================================================================

import { DeudaConfig, FilaDeuda } from '../types';

export interface EntradaDeuda {
  config: DeudaConfig;
  montoKUSD: number;
  tasaInteres: number; // fracción anual
  periodoGracia: number; // años
  plazoAmortizacion: number; // anualidades
  horizonteAnios: number;
}

export function calcularDeuda(entrada: EntradaDeuda): {
  filas: FilaDeuda[];
  issues: string[];
} {
  const { config, montoKUSD, tasaInteres, periodoGracia, plazoAmortizacion, horizonteAnios } = entrada;
  const issues: string[] = [];
  const filas: FilaDeuda[] = [];

  const monto = Number.isFinite(montoKUSD) ? montoKUSD : 0;
  const tasa = Number.isFinite(tasaInteres) ? Math.max(0, tasaInteres) : 0;
  const gracia = Math.max(0, Math.trunc(Number.isFinite(periodoGracia) ? periodoGracia : 0));
  const plazo = Math.max(1, Math.trunc(Number.isFinite(plazoAmortizacion) ? plazoAmortizacion : 1));
  const desembolsoAnio = Math.max(0, Math.trunc(config.anioDesembolso));

  if (!config.habilitada || monto <= 0) {
    for (let t = 0; t <= horizonteAnios; t++) {
      filas.push({
        anio: t,
        saldoInicial: 0,
        desembolso: 0,
        interesDevengado: 0,
        interesCapitalizado: 0,
        amortizacion: 0,
        interesPagado: 0,
        saldoFinal: 0,
      });
    }
    return { filas, issues };
  }

  if (desembolsoAnio > horizonteAnios) {
    issues.push(
      `El crédito se desembolsa en el año ${desembolsoAnio}, fuera del horizonte de análisis (${horizonteAnios} años): el modelo no recoge su efecto. Ajuste el año de desembolso o el horizonte.`
    );
  }

  // Saldo al inicio de la ventana de amortización: con gracia total los
  // intereses devengados durante la gracia se capitalizan ((1+i)^gracia);
  // con gracia de principal el saldo es el monto original.
  const factorCapitalizacion = config.tipoGracia === 'total' ? Math.pow(1 + tasa, gracia) : 1;
  const saldoBaseVentana = monto * factorCapitalizacion;

  // Cuota del sistema francés: C = P·i / (1 − (1+i)^−n)
  const cuotaFrances =
    tasa > 0
      ? (saldoBaseVentana * tasa) / (1 - Math.pow(1 + tasa, -plazo))
      : saldoBaseVentana / plazo;

  let saldo = 0;
  for (let t = 0; t <= horizonteAnios; t++) {
    const desembolso = t === desembolsoAnio ? monto : 0;
    // Convención del invariante (misión §6): saldoFinal = saldoInicial +
    // desembolso + interésCapitalizado − amortización. El saldo INICIAL es
    // el saldo final del período anterior (no incluye el desembolso del año).
    const saldoInicial = saldo;
    const saldoConDesembolso = saldoInicial + desembolso;
    const enVentana = t >= desembolsoAnio + gracia + 1 && t <= desembolsoAnio + gracia + plazo;
    const finVentana = desembolsoAnio + gracia + plazo;
    const enGracia = t > desembolsoAnio && t <= desembolsoAnio + gracia;

    const interesDevengado = t > desembolsoAnio ? saldoConDesembolso * tasa : 0;
    let interesCapitalizado = 0;
    let interesPagado = 0;
    if (enGracia) {
      if (config.tipoGracia === 'total') interesCapitalizado = interesDevengado;
      else interesPagado = interesDevengado;
    } else if (t > desembolsoAnio) {
      interesPagado = interesDevengado;
    }

    let amortizacion = 0;
    if (enVentana) {
      const saldoParaAmortizar = saldoConDesembolso + interesCapitalizado;
      if (config.metodo === 'capital_constante') {
        amortizacion = Math.min(saldoBaseVentana / plazo, Math.max(0, saldoParaAmortizar));
      } else if (config.metodo === 'sistema_frances') {
        const cuota = Math.min(cuotaFrances, saldoParaAmortizar + interesDevengado);
        amortizacion = Math.max(0, Math.min(cuota - interesDevengado, saldoParaAmortizar));
      } else {
        // pago único al vencimiento
        amortizacion = t === finVentana ? Math.max(0, saldoParaAmortizar) : 0;
      }
    }
    if (amortizacion > saldoConDesembolso + interesCapitalizado) {
      amortizacion = Math.max(0, saldoConDesembolso + interesCapitalizado);
      if (t === finVentana) {
        issues.push(
          `En el año ${t} la amortización excedía el saldo pendiente: se ha limitado al saldo. Revise el plazo y el monto del crédito.`
        );
      }
    }

    const saldoFinal = saldoInicial + desembolso + interesCapitalizado - amortizacion;
    filas.push({
      anio: t,
      saldoInicial,
      desembolso,
      interesDevengado,
      interesCapitalizado,
      amortizacion,
      interesPagado,
      saldoFinal,
    });
    saldo = saldoFinal;
  }

  const fin = filas[horizonteAnios];
  if (fin && Math.abs(fin.saldoFinal) > 0.01 && desembolsoAnio + gracia + plazo <= horizonteAnios) {
    issues.push(
      `El saldo de deuda al final del horizonte no es cero (${fin.saldoFinal.toFixed(1)} kUSD) aunque la ventana de amortización concluye dentro del horizonte: revise la configuración del crédito.`
    );
  }

  return { filas, issues };
}
