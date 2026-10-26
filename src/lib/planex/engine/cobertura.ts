// ============================================================================
// Motor estructural — Cobertura temporal de la financiación y salidas de caja
// del año 0 (misión PLANEX-DOC-002-R2 §1–§2).
//
// §1 — La conciliación TOTAL inversión/financiación se conserva, pero NO puede
//      usarse el total nominal de fuentes futuras como si todo estuviera
//      disponible en el año 0. Este módulo separa expresamente:
//        · fuentes COMPROMETIDAS para todo el proyecto (conciliación total);
//        · aportaciones EFECTIVAMENTE disponibles en el año 0 (montos[0]);
//        · aportaciones que entran en los años 1 y 2 (montos[1], montos[2]);
//        · año EFECTIVO de desembolso del principal del crédito (calendario);
//        · otras fuentes: el parámetro NO tiene estructura de fechas — se
//          documenta el supuesto «disponibles en el año 0» en lugar de
//          fingir una fecha inexistente;
//        · necesidades de inversión y gastos NO capitalizables por período;
//        · saldo de caja proyectado y DÉFICITS TEMPORALES del horizonte.
//
//      Dos vistas complementarias, ambas reconciliables:
//        Vista A (cobertura):  fuentes acumuladas − necesidades acumuladas
//          (solo financiación e inversión; detecta desembolsos tardíos).
//        Vista B (tesorería):  caja(t) = Σ FCFE + Σ aportaciones fechadas
//          + Σ otras fuentes − Σ dividendos (incluye la operación; detecta
//          déficits aunque la conciliación total cuadre).
//      Identidad de la Vista B (probada en tests): el FCFE ya contiene el
//      desembolso del crédito, la amortización y el servicio de la deuda, de
//      modo que la tesorería del año 0 coincide EXACTAMENTE con la Vista A.
//
// §2 — Las salidas de caja del año 0 NO se infieren de la UDI ni de otra
//      magnitud contable agregada: se INVENTARIAN partida a partida con su
//      período, estado de pago y tratamiento dentro de la inversión. La nómina
//      de montaje, el interés pagado, el impuesto devengado y los ingresos
//      explícitos son COMPONENTS conocidos, no una enumeración universal: el
//      BARRIDO detecta cualquier regla de gasto con valor en el año 0 que el
//      inventario no cubra y la marca como «no inventariada» (hallazgo
//      explícito) en lugar de ignorarla en silencio. El capital de trabajo,
//      los gastos previos y las inversiones fijas ya están DENTRO de la
//      inversión total: jamás se suman dos veces.
// ============================================================================

import {
  CoberturaAnio,
  CoberturaFinanciacion,
  ConciliacionArranque,
  FilaDeuda,
  PlanexProject,
  SalidaCajaAnio0,
} from '../types';

/** Entrada estructural mínima para el inventario y la conciliación del
 *  arranque (el ComputedModel completo la satisface). */
export interface ModeloArranque {
  valores: Record<string, Record<number, number>>;
  estados: Record<string, { refs?: string[] }>;
  deuda: FilaDeuda[];
}

/** Entrada estructural mínima para la cobertura temporal (el ComputedModel
 *  completo la satisface). */
export interface ModeloCobertura extends ModeloArranque {
  years: number[];
  dividendos: { anio: number; pagables: number }[];
  indicadores: { fcfe: Record<number, number>; capexAmpliaciones: Record<number, number> };
  arranque?: ConciliacionArranque;
}

/** Reglas de gasto del estado de resultados conocidas por el inventario del
 *  año 0 (identificador → tratamiento documentado). Cualquier OTRA regla de
 *  gasto con valor en el año 0 queda fuera del inventario y se reporta. */
const REGISTRADAS: Record<string, string> = {
  costo_laboral_k: 'Nómina de montaje del año 0: gasto del período, NO capitalizable.',
  interes_k: 'Interés del crédito: la parte PAGADA es caja (calendario de deuda); la capitalizada NO.',
  impuesto_utilidades_k: 'Impuesto DEVENGADO (regla contable): pago supuesto en el mismo período.',
};

/** Reglas que son gasto contable SIN salida de caja en el año 0. */
const NO_MONETARIAS: Record<string, string> = {
  depreciacion_anual_k: 'Depreciación: gasto contable no monetario; NO es salida de caja del año 0.',
};

/** Reglas de ingreso del año 0 (reducen la necesidad de caja). */
const REGISTRADAS_INGRESO: Record<string, string> = {
  ingresos_totales_k: 'Ingresos explícitos del año 0 (servicios + otros ingresos declarados).',
};

// ---------------------------------------------------------------------------
// Inventario de salidas de caja del año 0 (R2 §2)
// ---------------------------------------------------------------------------

/** Inventa las partidas de caja del año 0: conocidas (con estado de pago y
 *  tratamiento) + barrido de reglas de gasto no cubiertas. */
export function inventariarSalidasCajaAnio0(m: {
  valores: Record<string, Record<number, number>>;
  estados: Record<string, { refs?: string[] }>;
  deuda: { anio: number; interesPagado?: number; interesDevengado?: number; interesCapitalizado?: number }[];
}): { partidas: SalidaCajaAnio0[]; noInventariadas: { id: string; etiqueta: string; monto: number }[]; salidasNetas: number } {
  const val0 = (id: string): number => {
    const v = m.valores[id]?.[0];
    return Number.isFinite(v) ? (v as number) : 0;
  };
  const filadeuda0 = m.deuda.find((f) => f.anio === 0);
  const partidas: SalidaCajaAnio0[] = [];

  // --- Nómina de montaje (regla costo_laboral_k, año 0) -------------------
  const nomina = Math.max(0, val0('costo_laboral_k'));
  partidas.push({
    id: 'costo_laboral_k',
    etiqueta: 'Nómina de montaje del año 0',
    monto: nomina,
    tipo: 'nomina_montaje',
    computa: true,
    estadoPago: 'pagadera en el año 0 (nómina de la fase de montaje)',
    tratamiento: 'Gasto del período NO capitalizable y NO incluido en la inversión total: financia con caja del arranque. No es gasto previo capitalizable ni duplica el capital de trabajo.',
    fuente: 'regla «costo_laboral_k» (SUMA_PERSONAL, etapa montaje), año 0',
  });

  // --- Interés del año 0: PAGADO (caja) vs CAPITALIZADO (no caja) ---------
  const interesPagado = Math.max(0, filadeuda0?.interesPagado ?? 0);
  partidas.push({
    id: 'deuda.interesPagado[0]',
    etiqueta: 'Interés PAGADO del año 0',
    monto: interesPagado,
    tipo: 'interes_pagado',
    computa: interesPagado > 0,
    estadoPago: 'pagado en el año 0 según el calendario de deuda',
    tratamiento: 'Servicio corriente de la deuda: salida de caja del arranque, no capitalizable. Solo computa si el calendario lo sitúa en el año 0.',
    fuente: 'calendario de deuda (fila año 0, columna interés pagado)',
  });
  const interesCap = Math.max(0, filadeuda0?.interesCapitalizado ?? 0);
  if (interesCap > 0.005) {
    partidas.push({
      id: 'deuda.interesCapitalizado[0]',
      etiqueta: 'Interés devengado NO pagado del año 0 (capitalizado)',
      monto: interesCap,
      tipo: 'interes_devengado_no_pagado',
      computa: false,
      estadoPago: 'devengado y capitalizado en el saldo: NO es salida de caja del año 0',
      tratamiento: 'La gracia total capitaliza el interés: incrementa el saldo de la deuda, no la necesidad de caja del arranque.',
      fuente: 'calendario de deuda (fila año 0, columna interés capitalizado)',
    });
  }

  // --- Impuesto del año 0: DEVENGADO (regla contable) ---------------------
  const impuesto = Math.max(0, val0('impuesto_utilidades_k'));
  partidas.push({
    id: 'impuesto_utilidades_k',
    etiqueta: 'Impuesto sobre utilidades DEVENGADO del año 0',
    monto: impuesto,
    tipo: 'impuesto_devengado',
    computa: impuesto > 0,
    estadoPago: 'DEVENGADO según la regla contable; SUPUESTO del modelo simplificado: pagado en el mismo período (NO es un pago verificado: no existe calendario de pagos tributario)',
    tratamiento: 'Valor de una regla contable, no un pago observado. Con pérdidas de montaje la regla plana devuelve cero. Documentar el supuesto y su diferencia frente a un calendario tributario real.',
    fuente: 'regla «impuesto_utilidades_k» (regla contable editable), año 0',
  });

  // --- Ingresos explícitos del año 0 ---------------------------------------
  const ingresos = Math.max(0, val0('ingresos_totales_k'));
  partidas.push({
    id: 'ingresos_totales_k',
    etiqueta: 'Ingresos explícitos del año 0',
    monto: -ingresos,
    tipo: 'ingreso_explicito',
    computa: ingresos > 0,
    estadoPago: 'cobro supuesto en el mismo período',
    tratamiento: 'Reduce la necesidad de caja del arranque. No incluye ingresos de servicios de operación (año 0 = montaje sin servicios).',
    fuente: 'regla «ingresos_totales_k», año 0',
  });

  // --- Gastos contables del año 0 SIN salida de caja (documentados) --------
  for (const [id, tratamiento] of Object.entries(NO_MONETARIAS)) {
    const v = val0(id);
    if (Math.abs(v) > 0.005) {
      partidas.push({
        id,
        etiqueta: `${id} del año 0 (gasto no monetario)`,
        monto: Math.max(0, v),
        tipo: 'gasto_no_monetario',
        computa: false,
        estadoPago: 'devengado contable, SIN movimiento de caja',
        tratamiento,
        fuente: `regla «${id}», año 0`,
      });
    }
  }

  // --- BARRIDO: reglas de gasto del estado de resultados con valor en el
  //     año 0 que el inventario NO cubre (no se presume enumeración universal).
  const noInventariadas: { id: string; etiqueta: string; monto: number }[] = [];
  const refsCostos = m.estados['costos_totales_k']?.refs ?? [];
  const cubiertas = new Set([
    ...Object.keys(REGISTRADAS),
    ...Object.keys(NO_MONETARIAS),
    ...Object.keys(REGISTRADAS_INGRESO),
    'costos_totales_k',
  ]);
  for (const ref of refsCostos) {
    if (cubiertas.has(ref)) continue;
    const v = val0(ref);
    if (v > 0.005) {
      noInventariadas.push({ id: ref, etiqueta: ref, monto: v });
      partidas.push({
        id: ref,
        etiqueta: `Regla de gasto «${ref}» con valor en el año 0`,
        monto: v,
        tipo: 'gasto_no_inventariado',
        computa: false, // NO computa hasta que el usuario declare su tratamiento
        estadoPago: 'SIN declarar: ni el inventario ni la inversión total la recogen',
        tratamiento: 'PENDIENTE DE DECLARACIÓN: determine si es salida de caja del año 0 (y agréguela a la necesidad del arranque), gasto cubierto por otra partida o gasto no monetario. El modelo la señala en lugar de ignorarla.',
        fuente: `regla «${ref}» referenciada por «costos_totales_k», año 0`,
      });
    }
  }

  const salidasNetas = partidas.filter((p) => p.computa).reduce((s, p) => s + p.monto, 0);
  return { partidas, noInventariadas, salidasNetas };
}

// ---------------------------------------------------------------------------
// Conciliación del arranque (ampliada: brecha TEMPORAL, R2 §1)
// ---------------------------------------------------------------------------

/** Aportaciones por año de vencimiento (montos[t]; índice = año 0/1/2). */
export function aportacionesPorAnioDe(p: PlanexProject): number[] {
  const porAnio: number[] = [0, 0, 0];
  for (const a of p.aportaciones ?? []) {
    (a.montos ?? []).forEach((v, i) => {
      porAnio[i] = (porAnio[i] ?? 0) + (Number.isFinite(v) ? v : 0);
    });
  }
  return porAnio;
}

/** Reconstruye la conciliación del arranque a partir del inventario de
 *  salidas de caja del año 0 y de las fuentes CON desembolso en el año 0. */
export function conciliarArranqueDesdeInventario(m: ModeloArranque, p: PlanexProject): ConciliacionArranque {
  const inv = inventariarSalidasCajaAnio0(m);
  const val = (id: string): number => {
    const v = m.valores[id]?.[0];
    return Number.isFinite(v) ? (v as number) : 0;
  };
  const nominaMontaje = Math.max(0, val('costo_laboral_k'));
  const interesPagado = Math.max(0, m.deuda.find((f) => f.anio === 0)?.interesPagado ?? 0);
  const impuestoPagado = Math.max(0, val('impuesto_utilidades_k'));
  const ingresosAnio0 = Math.max(0, val('ingresos_totales_k'));
  const gastoCajaAnio0 = inv.salidasNetas; // nómina + interés pagado + impuesto devengado − ingresos
  const financiacionDisponible = val('financiacion_disponible_k'); // COMPROMETIDA (total)
  const aportAnio0 = aportacionesPorAnioDe(p)[0] ?? 0;
  const otrasFuentesAnio0 = Math.max(
    0,
    p.parametros.find((x) => x.id === 'otras_fuentes_k')?.valor ?? 0
  );
  const creditoAnio0 = Math.max(0, m.deuda.find((f) => f.anio === 0)?.desembolso ?? 0);
  const fuentesAnio0 = aportAnio0 + otrasFuentesAnio0 + creditoAnio0;
  const inversionTotal = val('inversion_total_k');
  const necesidadTotal = inversionTotal + Math.max(0, gastoCajaAnio0);
  return {
    nominaMontaje,
    interesPagado,
    impuestoPagado,
    ingresosAnio0,
    gastoCajaAnio0,
    financiacionDisponible,
    fuentesAnio0,
    inversionTotal,
    necesidadTotal,
    brecha: fuentesAnio0 - necesidadTotal,
    brechaNominal: financiacionDisponible - necesidadTotal,
    partidas: inv.partidas,
    noInventariadas: inv.noInventariadas,
  };
}

// ---------------------------------------------------------------------------
// Cobertura temporal por período (R2 §1)
// ---------------------------------------------------------------------------

/** Construye el calendario de cobertura temporal y la tesorería proyectada. */
export function calcularCoberturaFinanciacion(p: PlanexProject, m: ModeloCobertura): CoberturaFinanciacion {
  const N = m.years[m.years.length - 1] ?? 0;
  const aportPorAnio = aportacionesPorAnioDe(p);
  const otrasFuentes = Math.max(0, p.parametros.find((x) => x.id === 'otras_fuentes_k')?.valor ?? 0);
  const fila = (t: number) => m.deuda.find((f) => f.anio === t);
  const capexAmp = m.indicadores.capexAmpliaciones ?? {};
  const divPorAnio = new Map<number, number>();
  for (const d of m.dividendos ?? []) divPorAnio.set(d.anio, d.pagables);

  // Necesidades no capitalizables del arranque (inventario neto, año 0).
  const arranque = m.arranque ?? conciliarArranqueDesdeInventario(m, p);
  const salidasNoCap0 = Math.max(0, arranque.gastoCajaAnio0);
  const porAnio: CoberturaAnio[] = [];
  let fuentesAcum = 0;
  let necesidadesAcum = 0;
  let cajaAcum = 0;
  const deficitCaja: CoberturaFinanciacion['deficitCaja'] = [];
  const deficitCobertura: CoberturaFinanciacion['deficitCobertura'] = [];

  for (const t of m.years) {
    const aportaciones = aportPorAnio[t] ?? 0; // años 3+: 0
    const otras = t === 0 ? otrasFuentes : 0; // supuesto documentado: año 0
    const credito = Math.max(0, fila(t)?.desembolso ?? 0);
    const fuentes = aportaciones + otras + credito;
    fuentesAcum += fuentes;

    const inversionCapitalizable = t === 0 ? (m.valores['inversion_total_k']?.[0] ?? 0) : (capexAmp[t] ?? 0);
    const salidasNoCapitalizables = t === 0 ? salidasNoCap0 : 0;
    const necesidades = inversionCapitalizable + salidasNoCapitalizables;
    necesidadesAcum += necesidades;

    const saldoCobertura = fuentesAcum - necesidadesAcum;

    // Vista B (tesorería): el FCFE ya descuenta amortizaciones e intereses
    // pagados e incluye el desembolso del crédito; se le retira el principal
    // (que ya entró como fuente) para no duplicarlo.
    const fcfe = m.indicadores.fcfe?.[t] ?? 0;
    const flujoOperativo = fcfe - credito;
    const dividendos = divPorAnio.get(t) ?? 0;
    cajaAcum += fuentes + flujoOperativo - dividendos;

    porAnio.push({
      anio: t,
      aportaciones,
      otrasFuentes: otras,
      credito,
      fuentes,
      fuentesAcumuladas: fuentesAcum,
      inversionCapitalizable,
      salidasNoCapitalizables,
      necesidades,
      necesidadesAcumuladas: necesidadesAcum,
      saldoCobertura,
      flujoOperativo,
      dividendos,
      cajaProyectada: cajaAcum,
    });

    if (saldoCobertura < -0.05) {
      deficitCobertura.push({ anio: t, monto: -saldoCobertura, cubiertoEn: null });
    }
    if (cajaAcum < -0.05) {
      deficitCaja.push({ anio: t, monto: -cajaAcum, cubiertoEn: null });
    }
  }

  // Año en que cada déficit queda cubierto (primera caja/saldo posterior ≥ 0).
  const marcarCobertura = (
    deficits: CoberturaFinanciacion['deficitCaja'],
    serie: (t: number) => number
  ) => {
    for (const d of deficits) {
      for (let t = d.anio + 1; t <= N; t++) {
        if (serie(t) >= -0.05) {
          d.cubiertoEn = t;
          break;
        }
      }
    }
  };
  marcarCobertura(deficitCaja, (t) => porAnio[t]?.cajaProyectada ?? 0);
  marcarCobertura(deficitCobertura, (t) => porAnio[t]?.saldoCobertura ?? 0);

  // Fusiona déficits consecutivos del mismo episodio (años contiguos): un
  // episodio = racha máxima de años en déficit; se reporta su primer año, la
  // profundidad máxima y el año en que la serie vuelve a ser no negativa.
  const episodios = (
    deficits: CoberturaFinanciacion['deficitCaja']
  ): CoberturaFinanciacion['deficitCaja'] => {
    const salida: CoberturaFinanciacion['deficitCaja'] = [];
    let i = 0;
    while (i < deficits.length) {
      let j = i;
      while (j + 1 < deficits.length && deficits[j + 1].anio === deficits[j].anio + 1) j++;
      const monto = Math.max(...deficits.slice(i, j + 1).map((d) => d.monto));
      salida.push({ anio: deficits[i].anio, monto, cubiertoEn: deficits[j].cubiertoEn });
      i = j + 1;
    }
    return salida;
  };

  const creditoHabilitado = (p.financiero?.deuda?.habilitada ?? false) && (p.parametros.find((x) => x.id === 'credito_monto_k')?.valor ?? 0) > 0;
  const anioDesembolsoCredito = creditoHabilitado
    ? (m.deuda.find((f) => f.desembolso > 0)?.anio ?? null)
    : null;

  void (m.deuda as FilaDeuda[]); // trazabilidad estructural con el modelo completo

  return {
    porAnio,
    aportacionesPorAnio: aportPorAnio,
    anioDesembolsoCredito,
    otrasFuentesSinFecha: otrasFuentes > 0,
    deficitCaja: episodios(deficitCaja),
    deficitCobertura: episodios(deficitCobertura),
  };
}
