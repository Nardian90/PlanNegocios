// ============================================================================
// Análisis narrativo DINÁMICO (misión §12).
//
// Cada texto se GENERA a partir de los resultados actuales del motor de
// cálculo: cifras, variaciones, participaciones, umbrales parametrizados y
// estado de los controles. No hay conclusiones escritas de antemano: si
// cambia un dato, un parámetro, una fórmula, una capacidad o el horizonte,
// el texto cambia con él.
//
// Sistema determinista de plantillas lingüísticas: no se envía información
// financiera a servicios externos ni se requiere una API de IA.
//
// Trazabilidad (§12.13): cada análisis tiene una HUELLA canónica de los
// valores que lo sustentan. El proyecto puede guardar una edición manual con
// la huella de su momento («huellaOrigen»); si el modelo cambia y la huella
// ya no coincide, el estado pasa a «desactualizado» y el sistema advierte en
// lugar de sobrescribir en silencio el texto del usuario. Regenerar sustituye
// el texto por la versión actual del modelo.
// ============================================================================

import { PlanexProject, ComputedModel, EstadoAnalisis, ETIQUETAS_APORTACION, ETIQUETAS_CATEGORIA_INV } from '../types';
import { fmtK, fmtPct, fmtNum, fmtAnios } from '../format';

export const CLAVES_ANALISIS = [
  'resumen_ejecutivo',
  'aportaciones',
  'capacidad',
  'inversion_financiacion',
  'ingresos_costos',
  'deuda_depreciacion',
  'flujo_recuperacion',
  'mercado',
  'fuerza_trabajo',
  'inversiones_cronograma',
  'beneficios_pais',
  'conclusiones',
] as const;

export type ClaveAnalisis = (typeof CLAVES_ANALISIS)[number];

export interface AnalisisGenerado {
  texto: string;
  huella: string;
}

/** Hash determinista (FNV-1a) de la huella canónica. */
function hash(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function huellaDe(x: unknown): string {
  return hash(JSON.stringify(x));
}

// ---------------------------------------------------------------------------
// Utilidades de redacción
// ---------------------------------------------------------------------------

function parametro(p: PlanexProject, id: string): number {
  return p.parametros.find((x) => x.id === id)?.valor ?? 0;
}

function lista(frases: string[]): string {
  return frases.join(' ');
}

function pct(n: number, d: number): number {
  return d > 0 ? n / d : 0;
}

// ---------------------------------------------------------------------------
// Generadores (uno por apartado con tablas importantes)
// ---------------------------------------------------------------------------

function analisisAportaciones(p: PlanexProject, m: ComputedModel): { texto: string; huella: string } {
  const tot = m.indicadores.aportacionesTotalesKUSD;
  const extranjero = p.aportaciones.filter((a) => a.socio === 'extranjero').reduce((s, a) => s + a.montos.reduce((x, y) => x + y, 0), 0);
  const nacional = p.aportaciones.filter((a) => a.socio === 'nacional').reduce((s, a) => s + a.montos.reduce((x, y) => x + y, 0), 0);
  const sinRef = p.aportaciones.filter((a) => !a.referenciaDocumental?.trim());
  const porTipo = new Map<string, number>();
  for (const a of p.aportaciones) {
    const t = a.montos.reduce((x, y) => x + y, 0);
    porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + t);
  }
  const tipos = [...porTipo.entries()].sort((x, y) => y[1] - x[1]);
  const dif = m.valores['diferencia_financiacion_k']?.[0] ?? 0;

  const frases = [
    `Las aportaciones comprometidas suman ${fmtK(tot)} miles de USD: el inversionista extranjero aporta ${fmtK(extranjero)} (${fmtPct(pct(extranjero, tot))}) y la parte nacional ${fmtK(nacional)} (${fmtPct(pct(nacional, tot))}).`,
    tipos.length
      ? `Por tipo de aporte, ${tipos.map(([t, v]) => `${ETIQUETAS_APORTACION[t as keyof typeof ETIQUETAS_APORTACION] ?? t} con ${fmtK(v)} (${fmtPct(pct(v, tot))})`).join(', ')}.`
      : 'No hay aportaciones registradas: complete la tabla de aportaciones (4.5) antes de evaluar la financiación.',
    `La composición del capital resultante es ${fmtPct(pct(extranjero, tot))} extranjero / ${fmtPct(pct(nacional, tot))} nacional; el parámetro de participación cubana configurado es ${fmtPct(parametro(p, 'pct_parte_cubana'))} y el diagnóstico comprueba su coherencia con estas aportaciones.`,
  ];
  if (Math.abs(dif) <= 0.05) {
    frases.push(
      `Con estas aportaciones y las demás fuentes, la financiación disponible cubre exactamente la inversión total calculada (diferencia de ${fmtK(dif)} kUSD) bajo las premisas vigentes; ello no implica que los fondos estén comprometidos ni desembolsados: las aportaciones requieren documentación de respaldo.`
    );
  } else if (dif < 0) {
    frases.push(
      `Existe una insuficiencia de financiación de ${fmtK(Math.abs(dif))} kUSD frente a la inversión total: el plan debe aumentar aportaciones, gestionar crédito adicional o reducir el alcance de la inversión antes de presentarse.`
    );
  } else {
    frases.push(
      `La financiación supera la inversión total en ${fmtK(dif)} kUSD: verifique si el exceso corresponde a capital de trabajo adicional documentado o debe ajustar las fuentes.`
    );
  }
  if (sinRef.length) {
    frases.push(
      `${sinRef.length} aportación(es) carecen de referencia documental; los aportes en activos fijos y derechos requieren avalúo o certificación (Dirección de Patrimonio del MFP cuando corresponda) y su valoración debe conciliar con el inventario de inversiones para evitar doble contabilización del mismo bien.`
    );
  }
  frases.push(
    'Estas cifras son estimaciones de la plantilla mientras no se adjunten los documentos de respaldo; no constituyen validación jurídica de los aportes.'
  );
  return { texto: lista(frases), huella: huellaDe({ tot, extranjero, nacional, tipos, dif, sinRef: sinRef.length }) };
}

function analisisCapacidad(p: PlanexProject, m: ComputedModel): { texto: string; huella: string } {
  const umbral = parametro(p, 'umbral_utilizacion_capacidad');
  const umbralMargen = parametro(p, 'umbral_margen_minimo');
  const frases: string[] = [];
  const huellaDatos: unknown[] = [];

  if (!p.servicios.length) {
    return { texto: 'No hay servicios definidos: complete la tabla de servicios (4.6) con precios, demanda prevista, duración y recursos utilizados para generar este análisis.', huella: huellaDe({ vacio: true }) };
  }

  const margenes = p.servicios.map((s) => {
    const sc = m.servicios.find((x) => x.id === s.id);
    const ingreso = sc?.valores[1]?.['srv_ingreso_anual'] ?? 0;
    const margen = sc?.valores[1]?.['srv_margen_contribucion'] ?? 0;
    return { s, ingreso, margen, margenPct: pct(margen, ingreso) };
  });
  const ingresoTotal = margenes.reduce((x, y) => x + y.ingreso, 0);
  const ordenados = [...margenes].sort((x, y) => y.ingreso - x.ingreso);
  const top = ordenados[0];
  const top3 = ordenados.slice(0, 3);
  const concentracion = pct(top3.reduce((s, x) => s + x.ingreso, 0), ingresoTotal);
  const mayorMargen = [...margenes].sort((x, y) => y.margen - x.margen)[0];
  const menorMargen = [...margenes].sort((x, y) => x.margen - y.margen)[0];
  const margenBajo = margenes.filter((x) => x.margenPct < umbralMargen && x.ingreso > 0);

  frases.push(
    `En el año 1 los ingresos por servicios ascienden a ${fmtK(ingresoTotal / 1000)} miles de USD. Las tres líneas principales (${top3.map((x) => `«${x.s.nombre}» con ${fmtPct(pct(x.ingreso, ingresoTotal))}`).join(', ')}) concentran ${fmtPct(concentracion)} del ingreso${top ? `, encabezadas por «${top.s.nombre}» con ${fmtK(top.ingreso / 1000)} miles de USD` : ''}.`
  );
  frases.push(
    `El margen de contribución del año 1 es ${fmtK(m.indicadores.margenContribucionAnio1 ? m.indicadores.margenContribucionAnio1 / 1000 : 0)} miles de USD (${fmtPct(pct(m.indicadores.margenContribucionAnio1 ?? 0, ingresoTotal))} de los ingresos). La línea que más margen aporta es «${mayorMargen?.s.nombre ?? '—'}» (${fmtK((mayorMargen?.margen ?? 0) / 1000)} miles de USD) y la que menos, «${menorMargen?.s.nombre ?? '—'}» (${fmtK((menorMargen?.margen ?? 0) / 1000)}).`
  );
  if (margenBajo.length) {
    frases.push(
      `${margenBajo.length} línea(s) quedan por debajo del margen mínimo de referencia (${fmtPct(umbralMargen)}): ${margenBajo.map((x) => `«${x.s.nombre}» (${fmtPct(x.margenPct)})`).join(', ')}. Revise sus precios o costos variables antes de escalar el negocio sobre ellas.`
    );
  }

  const escenario = p.tecnico.escenarioCapacidad;
  frases.push(
    escenario === 'B_ampliacion'
      ? `Escenario activo: B (ampliación de capacidad). Las ampliaciones programadas en la tabla de recursos generan CAPEX en sus años de ejecución y amplían la capacidad disponible; el total de CAPEX de ampliaciones del horizonte es ${fmtK(Object.values(m.indicadores.capexAmpliaciones).reduce((s, v) => s + v, 0))} miles de USD.`
      : 'Escenario activo: A (capacidad constante). Las cantidades proyectadas quedan limitadas a la capacidad instalada actual; cualquier ampliación futura debe programarse explícitamente en el escenario B.'
  );

  const excedidos = m.servicios.filter((s) => s.capacidadesExcedidas.length > 0);
  if (excedidos.length) {
    frases.push(
      `La demanda prevista NO puede atenderse íntegramente en ${excedidos.length} línea(s): ${excedidos.map((s) => {
        const t = s.capacidadesExcedidas[0];
        const c = m.capacidadServicios[s.id]?.[t];
        const perdida = c ? (1 - c.cantidadRealMensual / Math.max(1e-9, c.demandaMensual)) : 0;
        return `«${s.nombre}» desde el año ${t} (se atiende ${fmtPct(1 - perdida)} de la demanda)`;
      }).join(', ')}. El modelo ha LIMITADO los ingresos y costos a la demanda realmente atendible: no describa ese crecimiento como alcanzable sin las ampliaciones o ajustes necesarios.`
    );
  } else {
    frases.push('Con la capacidad del escenario activo, toda la demanda prevista de todas las líneas puede atenderse dentro del horizonte: no hay ventas limitadas por capacidad.');
  }

  const recursosSaturados = m.recursosCalculados
    .map((r) => ({ r, util: Math.max(...Object.values(r.utilizacion)) }))
    .filter((x) => x.util > umbral)
    .sort((x, y) => y.util - x.util);
  if (recursosSaturados.length) {
    frases.push(
      `Recursos con mayor utilización: ${recursosSaturados.slice(0, 3).map((x) => `«${x.r.nombre}» llega a ${fmtPct(x.util)}`).join(', ')} (umbral de referencia ${fmtPct(umbral)}); la combinación de servicios deja poco margen para mantenimiento e imprevistos en esos recursos compartidos.`
    );
  } else if (m.recursosCalculados.length) {
    const maxRecurso = m.recursosCalculados.map((r) => ({ r, util: Math.max(...Object.values(r.utilizacion)) })).sort((x, y) => y.util - x.util)[0];
    frases.push(`Ningún recurso supera el umbral de utilización de referencia (${fmtPct(umbral)}); el más cargado es «${maxRecurso?.r.nombre ?? '—'}» con ${fmtPct(maxRecurso?.util ?? 0)}.`);
  } else {
    frases.push('No hay recursos operativos definidos: la capacidad no está siendo verificada contra gabinetes, equipos ni personal, lo que impide validar la operatividad del plan (complétela en 4.6).');
  }

  huellaDatos.push(margenes, concentracion, excedidos.map((e) => e.id), recursosSaturados.map((r) => r.r.id), escenario, m.indicadores.capexAmpliaciones);
  return { texto: lista(frases), huella: huellaDe(huellaDatos) };
}

function analisisInversionFinanciacion(p: PlanexProject, m: ComputedModel): { texto: string; huella: string } {
  const inv = m.indicadores.inversionTotalKUSD;
  const previos = m.valores['gastos_previos_k']?.[0] ?? 0;
  const fija = m.valores['inversion_fija_k']?.[0] ?? 0;
  const ct = parametro(p, 'capital_trabajo_k');
  const fijaCUP = m.valores['inversion_fija_cup_k']?.[0] ?? 0;
  const aport = m.indicadores.aportacionesTotalesKUSD;
  const otras = parametro(p, 'otras_fuentes_k');
  const credito = parametro(p, 'credito_monto_k');
  const nec = m.valores['necesidad_financiacion_k']?.[0] ?? 0;
  const dif = m.valores['diferencia_financiacion_k']?.[0] ?? 0;

  const porCategoria = new Map<string, number>();
  for (const r of p.financiero.inversion) porCategoria.set(r.categoria, (porCategoria.get(r.categoria) ?? 0) + r.monto);
  const mayores = [...p.financiero.inversion].sort((x, y) => y.monto - x.monto).slice(0, 3);

  const frases = [
    `La inversión inicial total calculada es ${fmtK(inv)} miles de USD, compuesta por gastos previos de ${fmtK(previos)} (${fmtPct(pct(previos, inv))}), inversión fija de ${fmtK(fija)} (${fmtPct(pct(fija, inv))}) y capital de trabajo inicial de ${fmtK(ct)} (${fmtPct(pct(ct, inv))}).`,
    mayores.length
      ? `Las partidas de mayor peso son ${mayores.map((x) => `«${x.concepto}» (${fmtK(x.monto)} ${x.moneda})`).join(', ')}.`
      : 'No hay partidas de inversión registradas: complete la tabla de inversiones (4.10).',
  ];
  if (fijaCUP > 0.001) {
    frases.push(
      `Dentro de la inversión fija, ${fmtK(fijaCUP)} miles de USD provienen de partidas expresadas en CUP convertidas con el tipo de cambio parametrizado de ${fmtK(parametro(p, 'tipo_cambio'))} CUP/USD (con fecha y fuente documentables): las monedas no se suman sin convertir.`
    );
  }
  frases.push(
    `Las fuentes disponibles suman ${fmtK(aport + otras + credito)} miles de USD (aportaciones ${fmtK(aport)}, otras fuentes ${fmtK(otras)}, crédito ${fmtK(credito)}). La necesidad de financiación (inversión menos aportaciones y otras fuentes) es ${fmtK(nec)} kUSD${credito > 0 ? `, cubierta por el crédito previsto; el servicio de esa deuda (intereses y amortizaciones) se analiza en el calendario correspondiente` : ' y no se ha previsto crédito para cubrirla'}.`
  );
  if (dif < -0.05) {
    frases.push(`Diferencia de financiación: faltan ${fmtK(Math.abs(dif))} kUSD. El plan no es financiable bajo las premisas actuales: corríjalo antes de cualquier presentación.`);
  } else if (dif > 0.05) {
    frases.push(`Diferencia de financiación: sobran ${fmtK(dif)} kUSD sin asignar a inversión; justifique su uso o ajuste las fuentes.`);
  } else {
    frases.push('La diferencia de financiación es nula bajo las premisas vigentes: el modelo cubre la inversión calculada. No se afirma que la financiación esté concedida ni que los fondos estén disponibles de manera real.');
  }
  const porAnio = p.aportaciones.reduce<number[]>((acc, a) => {
    a.montos.forEach((v, i) => {
      acc[i] = (acc[i] ?? 0) + v;
    });
    return acc;
  }, []);
  if (porAnio.some((v) => v > 0)) {
    frases.push(`Calendario de desembolsos de aportaciones: ${porAnio.map((v, i) => `año ${i + 1}: ${fmtK(v)} kUSD`).join('; ')}.`);
  }
  return { texto: lista(frases), huella: huellaDe({ inv, previos, fija, ct, aport, otras, credito, dif, porAnio, mayores: mayores.map((x) => x.id) }) };
}

function analisisIngresosCostos(p: PlanexProject, m: ComputedModel): { texto: string; huella: string } {
  const N = p.ajustes.horizonteAnios;
  const ing1 = m.indicadores.ingresosTotales[1] ?? 0;
  const ingN = m.indicadores.ingresosTotales[N] ?? 0;
  const uai1 = m.valores['utilidad_antes_impuestos_k']?.[1] ?? 0;
  const uaiN = m.valores['utilidad_antes_impuestos_k']?.[N] ?? 0;
  const imp1 = m.valores['impuesto_utilidades_k']?.[1] ?? 0;
  const udi1 = m.indicadores.utilidadNeta[1] ?? 0;
  const cv1 = m.valores['costos_variables_k']?.[1] ?? 0;
  const cl1 = m.valores['costo_laboral_k']?.[1] ?? 0;
  const dep1 = m.valores['depreciacion_anual_k']?.[1] ?? 0;
  const tasa = parametro(p, 'tasa_impuesto_utilidades');
  const fijo1 = (m.valores['canon_k']?.[1] ?? 0) + (m.valores['mantenimiento_k']?.[1] ?? 0) + (m.valores['servicios_publicos_k']?.[1] ?? 0) + (m.valores['gastos_admin_k']?.[1] ?? 0) + (m.valores['otros_gastos_fijos_k']?.[1] ?? 0);
  const crecimientoIng = ing1 > 0.01 ? Math.pow(ingN / ing1, 1 / Math.max(1, N - 1)) - 1 : 0;

  const frases = [
    `Los ingresos totales pasan de ${fmtK(ing1)} miles de USD en el año 1 a ${fmtK(ingN)} en el año ${N} (crecimiento medio implícito ${fmtPct(crecimientoIng)} anual). Esa trayectoria resulta de la demanda prevista, los precios con su crecimiento parametrizado y la limitación por capacidad del escenario activo; no incluye facturación por encima de lo atendible.`,
    `En el año 1 los costos variables absorben ${fmtPct(pct(cv1, ing1))} de los ingresos, la fuerza de trabajo ${fmtPct(pct(cl1, ing1))} y los costos fijos de operación (canon, mantenimiento, servicios públicos, gastos administrativos y otros) ${fmtPct(pct(fijo1, ing1))}. La depreciación del período es ${fmtK(dep1)} miles de USD: es un gasto contable que no representa salida de caja.`,
    `Con la regla tributaria activa (tasa parametrizada de ${fmtPct(tasa)}, supuesto de demostración), el impuesto del año 1 es ${fmtK(imp1)} miles de USD y la utilidad después de impuestos ${fmtK(udi1)} (${fmtPct(pct(udi1, ing1))} de margen neto).`,
    uaiN > uai1
      ? `La utilidad antes de impuestos mejora de ${fmtK(uai1)} (año 1) a ${fmtK(uaiN)} (año ${N}): el modelo atribuye la variación al crecimiento de demanda y precios activado por las reglas vigentes, sin cambios de capacidad adicionales a los programados.`
      : uaiN < uai1
        ? `La utilidad antes de impuestos DESCIENDE de ${fmtK(uai1)} (año 1) a ${fmtK(uaiN)} (año ${N}): revise qué partida crece más que los ingresos (costos variables por inflación, capacidad limitante o cargas financieras).`
        : `La utilidad antes de impuestos permanece en ${fmtK(uai1)} miles de USD entre el año 1 y el año ${N}: verifique si el modelo refleja la dinámica prevista del negocio.`,
  ];
  const caja = m.indicadores.fcfeAcumulado[N] ?? 0;
  if (udi1 > 0 && caja < 0) {
    frases.push('ATENCIÓN: el plan muestra utilidad contable positiva pero la caja acumulada de los socios sigue negativa en el horizonte; rentabilidad contable y liquidez NO son equivalentes: revise el calendario de cobros, el capital de trabajo y el servicio de la deuda.');
  }
  return { texto: lista(frases), huella: huellaDe({ ing1, ingN, uai1, uaiN, imp1, cv1, cl1, dep1, fijo1, tasa, caja }) };
}

function analisisDeudaDepreciacion(p: PlanexProject, m: ComputedModel): { texto: string; huella: string } {
  const cfg = p.financiero.deuda;
  const frases: string[] = [];
  const interesTotal = m.deuda.reduce((s, f) => s + f.interesDevengado, 0);
  const amortTotal = m.deuda.reduce((s, f) => s + f.amortizacion, 0);

  if (!cfg.habilitada || parametro(p, 'credito_monto_k') <= 0) {
    frases.push('El plan no incluye crédito: toda la inversión se financia con aportaciones y otras fuentes. En consecuencia no existen intereses ni amortizaciones y la diferencia entre el flujo del proyecto y el de los socios es nula.');
  } else {
    const monto = parametro(p, 'credito_monto_k');
    const tasa = parametro(p, 'tasa_interes');
    const gracia = parametro(p, 'periodo_gracia');
    const plazo = parametro(p, 'plazo_amortizacion');
    const fin = m.deuda[m.deuda.length - 1];
    frases.push(
      `El crédito de ${fmtK(monto)} miles de USD se desembolsa en el año ${cfg.anioDesembolso} con tasa del ${fmtPct(tasa)}, gracia de ${gracia} año(s) de tipo ${cfg.tipoGracia === 'total' ? 'TOTAL (los intereses se capitalizan en el saldo)' : 'de principal (los intereses se pagan corriente)'} y amortización por ${cfg.metodo === 'capital_constante' ? 'capital constante' : cfg.metodo === 'sistema_frances' ? 'sistema francés (cuota total constante)' : 'pago único al vencimiento'} en ${plazo} anualidades.`
    );
    frases.push(
      `A lo largo del horizonte se devengan ${fmtK(interesTotal)} miles de USD de intereses y se amortizan ${fmtK(amortTotal)}; el saldo pendiente al cierre del horizonte es ${fmtK(fin.saldoFinal)} kUSD. La tabla de deuda verifica saldo final = saldo inicial + desembolso + capitalización − amortización en cada período y ningún período amortiza por encima del saldo.`
    );
    const servicio = m.deuda.map((f) => f.interesPagado + f.amortizacion);
    const maxServicio = Math.max(...servicio.slice(1));
    const anioMax = servicio.indexOf(maxServicio);
    frases.push(
      `El servicio máximo de la deuda (interés pagado + amortización) es ${fmtK(maxServicio)} miles de USD en el año ${anioMax}: compárelo con el flujo de caja del proyecto del mismo año (${fmtK(m.indicadores.fcff[anioMax] ?? 0)} kUSD) para valorar el margen de cobertura.`
    );
  }

  const activos = m.depreciacion;
  const totalDep = m.depreciacionTotal;
  const depPorAnio = Object.values(totalDep);
  let anioPico = 0;
  for (const [k, v] of Object.entries(totalDep)) {
    if (v > (totalDep[anioPico] ?? 0)) anioPico = Number(k);
  }
  const sinDepreciar = activos.filter((a) => a.vnl > 0.01 && a.anioDisponible + a.vidaUtilAnios > p.ajustes.horizonteAnios + 1);
  frases.push(
    activos.length
      ? `El registro de activos depreciables contiene ${activos.length} activo(s). La depreciación anual total es ${fmtK(depPorAnio[1] ?? 0)} miles de USD en el año 1 y alcanza su máximo (${fmtK(depPorAnio[anioPico] ?? 0)}) en el año ${anioPico}; cada activo deprecia desde su año de disponibilidad, respeta su vida útil y nunca supera su importe depreciable.`
      : 'No hay activos depreciables definidos: la depreciación es nula y el flujo de caja no incorpora reincorporación alguna.'
  );
  if (sinDepreciar.length) {
    frases.push(
      `${sinDepreciar.length} activo(s) quedan con valor neto en libros al final del horizonte (p. ej. «${sinDepreciar[0].concepto}» con ${fmtK(sinDepreciar[0].vnl)} kUSD): el plan debe declarar el tratamiento de ese valor residual al cierre.`
    );
  }
  frases.push('La depreciación es un gasto no monetario: reduce la utilidad contable pero el flujo de caja la reincorpora una sola vez; las amortizaciones del principal, en cambio, son salidas de caja del financiador y no gasto del estado de resultados.');

  return { texto: lista(frases), huella: huellaDe({ cfg, interesTotal, amortTotal, fin: m.deuda[m.deuda.length - 1]?.saldoFinal, activos: activos.map((a) => [a.id, a.acumulada, a.vnl]), totalDep }) };
}

function analisisFlujoRecuperacion(p: PlanexProject, m: ComputedModel): { texto: string; huella: string } {
  const N = p.ajustes.horizonteAnios;
  const recP = m.indicadores.recuperacionProyecto;
  const recS = m.indicadores.recuperacionSocios;
  const frases: string[] = [];

  frases.push(
    `El modelo calcula DOS indicadores separados. La recuperación de la INVERSIÓN TOTAL se mide con el flujo de caja del proyecto (FCFF = utilidad neta + intereses devengados + depreciación − CAPEX de ampliaciones, con la inversión total como desembolso del año 0). La recuperación del CAPITAL APORTADO se mide con el flujo de los socios (FCFE = flujo del proyecto − intereses pagados + desembolsos del crédito − amortizaciones, con las aportaciones como desembolso inicial).`
  );
  if (recP.anios !== null && !recP.indeterminado) {
    frases.push(
      `Con los flujos vigentes, la inversión total de ${fmtK(m.indicadores.inversionTotalKUSD)} kUSD se recupera en ${fmtAnios(recP.anios)} (cruce del acumulado en el año ${recP.anioCruce}; interpolación lineal: (t−1) + |acumulado anterior| / (acumulado actual − acumulado anterior)). El saldo pendiente de recuperar al final del año ${Math.max(0, (recP.anioCruce ?? 1) - 1)} era ${fmtK(-m.indicadores.fcffAcumulado[Math.max(0, (recP.anioCruce ?? 1) - 1)])} kUSD.`
    );
  } else if (recP.indeterminado) {
    frases.push(`La recuperación de la inversión total no puede emitirse como una cifra única fiable: ${recP.motivo}`);
  } else {
    frases.push(
      `La inversión total NO se recupera dentro del horizonte de ${N} años con el flujo del proyecto: el acumulado termina en ${fmtK(m.indicadores.fcffAcumulado[N] ?? 0)} kUSD. Debe decirse expresamente; cualquier afirmación de recuperación en el plan sería incorrecta con los datos actuales.`
    );
  }
  if (recS.anios !== null && !recS.indeterminado) {
    frases.push(
      `El capital aportado por los socios (${fmtK(m.indicadores.aportacionesTotalesKUSD)} kUSD) se recupera en ${fmtAnios(recS.anios)} (cruce en el año ${recS.anioCruce}), más ${recS.anios !== null && recP.anios !== null && recS.anios >= recP.anios ? 'tardío que' : 'temprano que'} la recuperación de la inversión total: la diferencia procede del crédito (desembolsos) y de su servicio (intereses y amortizaciones).`
    );
  } else if (recS.indeterminado) {
    frases.push(`La recuperación del capital aportado no puede emitirse como cifra única fiable: ${recS.motivo}`);
  } else {
    frases.push(`El capital aportado por los socios NO se recupera dentro del horizonte según el flujo de los socios (acumulado final: ${fmtK(m.indicadores.fcfeAcumulado[N] ?? 0)} kUSD).`);
  }

  const capexAmp = Object.values(m.indicadores.capexAmpliaciones).reduce((s, v) => s + v, 0);
  if (capexAmp > 0.001) {
    frases.push(
      `Las ampliaciones de capacidad del escenario B añaden ${fmtK(capexAmp)} miles de USD de CAPEX en sus años de ejecución, retrasando el acumulado del proyecto en esos años; el modelo los incluye íntegramente (no presenta una recuperación optimista que ignore las inversiones adicionales).`
    );
  }
  const pctCT = parametro(p, 'pct_recuperacion_capital_trabajo');
  if (pctCT > 0) {
    frases.push(
      `El modelo libera el ${fmtPct(pctCT)} del capital de trabajo (${fmtK(pctCT * parametro(p, 'capital_trabajo_k'))} kUSD) en el último año: esa recuperación es un supuesto parametrizado que debe justificarse.`
    );
  } else {
    frases.push('El capital de trabajo inicial no se recupera en el modelo (tratamiento conservador, parámetro de recuperación en 0 %).');
  }
  if (m.indicadores.recuperacionProyecto.anios !== null && N < Math.ceil(m.indicadores.recuperacionProyecto.anios + 1)) {
    frases.push('ATENCIÓN: el horizonte es menor que la recuperación más un año; la metodología exige ampliar el horizonte antes de presentar el plan.');
  }
  return {
    texto: lista(frases),
    huella: huellaDe({ recP, recS, fcff: m.indicadores.fcff, fcfe: m.indicadores.fcfe, capexAmp, pctCT, N }),
  };
}

function analisisMercado(p: PlanexProject, m: ComputedModel): { texto: string; huella: string } {
  const ing1 = m.indicadores.ingresosTotales[1] ?? 0;
  const frases: string[] = [];
  const sinFuente = !p.mercado.fuentesConsulta?.trim() || /fictici|ilustrativ|supuesto/i.test(p.mercado.fuentesConsulta);

  frases.push(
    `El volumen de negocio modelado en el año 1 (${fmtK(ing1)} miles de USD) se apoya en la demanda prevista definida en la tabla de servicios. La aplicación no simula una investigación de mercado: los valores de demanda aparente y demanda solvente declarados en el apartado 4.8 ${p.mercado.demandaAparente?.trim() && p.mercado.demandaSolvente?.trim() ? 'están registrados' : 'NO están registrados'} y deben sustentarse en fuentes verificables.`
  );
  frases.push(
    sinFuente
      ? 'Las fuentes consultadas no están documentadas (o están marcadas como ficticias de demostración): el análisis de mercado del plan es un SUPUESTO de demostración. Una propuesta real exige investigaciones de demanda, precios de referencia y competidores con fecha y fuente.'
      : 'Las fuentes consultadas figuran documentadas: verifique que incluyan fecha de consulta y que la demanda solvente sea coherente con el volumen modelado.'
  );
  if (p.mercado.ventasExportacion?.trim()) {
    frases.push(
      `La estrategia de comercialización contempla ventas al exterior («${p.mercado.ventasExportacion.slice(0, 120)}…»): los ingresos en divisas deben identificarse por separado en la estructura de ingresos (exportaciones / plataformas con pagos desde el exterior / venta en plaza) sin duplicar operaciones.`
    );
  }
  frases.push(
    `Supuestos de mayor impacto en los resultados de mercado: precios unitarios (crecimiento ${fmtPct(parametro(p, 'crecimiento_precios'))} anual), demanda (crecimiento ${fmtPct(parametro(p, 'crecimiento_volumen'))} anual) y tope de capacidad del escenario activo. Un error de ±10 % en la demanda del año 1 desplaza los ingresos del año 1 en ±${fmtK(ing1 * 0.1)} miles de USD.`
  );
  return { texto: lista(frases), huella: huellaDe({ ing1, sinFuente, exp: p.mercado.ventasExportacion, da: p.mercado.demandaAparente, ds: p.mercado.demandaSolvente, cp: parametro(p, 'crecimiento_precios'), cv: parametro(p, 'crecimiento_volumen') }) };
}

function analisisFuerzaTrabajo(p: PlanexProject, m: ComputedModel): { texto: string; huella: string } {
  const ind = m.indicadores;
  const grupos = Object.entries(ind.trabajadoresPorGrupo).filter(([, v]) => v > 0);
  const cl1 = m.valores['costo_laboral_k']?.[1] ?? 0;
  const montajeCosto = m.valores['costo_laboral_k']?.[0] ?? 0;
  const pagosFTAcum = Object.entries(m.valores['pagos_fuerza_trabajo_k'] ?? {}).reduce((s, [t, v]) => s + (Number(t) >= 1 ? v : 0), 0);
  const frases = [
    `La plantilla de operación prevista es de ${fmtNum(ind.totalTrabajadores)} trabajadores (${fmtNum(ind.cubanos)} cubanos y ${fmtNum(ind.extranjeros)} extranjero(s)), más ${fmtNum(ind.trabajadoresMontaje)} trabajador(es) temporal(es) de montaje del año 0. El personal de montaje es transitorio para la ejecución del proyecto y no debe confundirse con la plantilla estable de operación.`,
    grupos.length
      ? `Distribución por categorías de operación: ${grupos.map(([g, v]) => `${fmtNum(v)} en ${g.replace(/_/g, ' — ')}`).join(', ')}.`
      : 'No hay personal de operación definido: complete la tabla 4.9.',
    `El salario promedio anual ponderado de la plantilla de operación es ${fmtK(ind.salarioPromedioAnualCUP ?? 0)} CUP. El costo laboral del año 1 asciende a ${fmtK(cl1)} miles de USD (salarios en CUP convertidos con el tipo de cambio parametrizado, multiplicados por el factor de costo laboral de ${fmtK(parametro(p, 'factor_costo_laboral'))}), equivalente al ${fmtPct(pct(cl1, m.indicadores.ingresosTotales[1] ?? 0))} de los ingresos del año 1.`,
    montajeCosto > 0.001
      ? `El costo laboral del año 0 (montaje) es ${fmtK(montajeCosto)} kUSD y se registra como gasto del período: no forma parte de los gastos previos de la inversión, por lo que no está duplicado.`
      : 'No se registran costos de personal de montaje en el año 0.',
    `Los pagos por la fuerza de trabajo son uno de los beneficios directos al país: el costo laboral acumulado de la explotación es ${fmtK(pagosFTAcum)} miles de USD. La remuneración de cada categoría y su etapa de contratación figuran en la tabla 4.9; su validación frente a la legislación laboral vigente queda fuera del modelo.`,
  ];
  return { texto: lista(frases), huella: huellaDe({ ind, cl1, montajeCosto, grupos, pagosFTAcum }) };
}

function analisisInversionesCronograma(p: PlanexProject, m: ComputedModel): { texto: string; huella: string } {
  const filas = [...p.financiero.inversion].sort((x, y) => y.monto - x.monto);
  const catPesos = ['gastos_previos', 'inversion_fija', 'inducida'].map((c) => {
    const v = p.financiero.inversion.filter((x) => x.categoria === c).reduce((s, x) => s + x.monto, 0);
    return { c, v };
  }).filter((x) => x.v > 0);
  const activosCriticos = m.depreciacion.slice(0, 0); // el detalle por activo está en 4.7
  const etapas = p.cronograma.length;
  const frases = [
    `La inversión se agrupa en ${catPesos.map((x) => `${ETIQUETAS_CATEGORIA_INV[x.c as keyof typeof ETIQUETAS_CATEGORIA_INV] ?? x.c} (${fmtK(x.v)})`).join(', ')}. El activo de mayor importe es «${filas[0]?.concepto ?? '—'}» con ${fmtK(filas[0]?.monto ?? 0)} ${filas[0]?.moneda ?? ''} y vida útil de ${filas[0]?.vidaUtilAnios ?? 0} años.`,
    `La relación entre inversión y capacidad queda explícita en la tabla de recursos operativos: el escenario ${p.tecnico.escenarioCapacidad === 'B_ampliacion' ? 'B incluye ampliaciones con CAPEX propio' : 'A no contempla ampliaciones; la capacidad final es la instalada inicialmente'}.`,
  ];
  if (etapas) {
    frases.push(
      `El cronograma inversionista define ${etapas} etapas, de «${p.cronograma[0].etapa}» (${p.cronograma[0].inicio}) a «${p.cronograma[p.cronograma.length - 1].etapa}» (${p.cronograma[p.cronograma.length - 1].fin}). El modelo no valida licencias, obras ni pruebas: los requisitos previos sin resolver en el cronograma deben resolverse antes de declarar operativa la instalación.`
    );
  } else {
    frases.push('El cronograma inversionista está vacío: defina las etapas de licencia, obra, instalación, pruebas y apertura (4.10).');
  }
  if (m.indicadores.capexAmpliaciones && Object.values(m.indicadores.capexAmpliaciones).some((v) => v > 0)) {
    frases.push(
      `Las ampliaciones del escenario B añaden desembolsos en los años ${Object.entries(m.indicadores.capexAmpliaciones).filter(([, v]) => v > 0).map(([t, v]) => `${t}: ${fmtK(v)} kUSD`).join(', ')}. Un retraso en esas inversiones desplazaría la capacidad disponible y con ella los ingresos; el modelo los vincula, así que cualquier cambio de fecha exige reevaluar la proyección.`
    );
  }
  void activosCriticos;
  return { texto: lista(frases), huella: huellaDe({ catPesos, filas: filas.slice(0, 3).map((f) => f.id), etapas, capex: m.indicadores.capexAmpliaciones }) };
}

function analisisBeneficiosPais(p: PlanexProject, m: ComputedModel): { texto: string; huella: string } {
  const total = m.indicadores.beneficiosPaisAcumulados;
  const explot = m.indicadores.beneficiosPaisExplotacion;
  const anio0 = m.indicadores.beneficiosPais[0] ?? 0;
  const imp = Object.entries(m.indicadores.beneficiosPais).reduce((s, [t, v]) => s + (Number(t) >= 1 ? (m.valores['impuesto_utilidades_k']?.[Number(t)] ?? 0) : 0), 0);
  const ft = Object.entries(m.indicadores.beneficiosPais).reduce((s, [t, v]) => s + (Number(t) >= 1 ? v : 0), 0) * 0;
  const pagosFT = Object.entries(m.valores['pagos_fuerza_trabajo_k'] ?? {}).reduce((s, [t, v]) => s + (Number(t) >= 1 ? v : 0), 0);
  const divCub = Object.entries(m.valores['dividendos_parte_cubana_k'] ?? {}).reduce((s, [, v]) => s + v, 0);
  const canon = parametro(p, 'canon_anual_k') * p.ajustes.horizonteAnios;
  const aranceles = parametro(p, 'aranceles_anual_k') * p.ajustes.horizonteAnios;
  const otrosImp = parametro(p, 'otros_impuestos_anual_k') * p.ajustes.horizonteAnios;

  const frases = [
    `Los beneficios directos al país acumulan ${fmtK(total)} miles de USD en el período completo del análisis (años 0 a ${p.ajustes.horizonteAnios}). El subtotal de la explotación (años 1 a ${p.ajustes.horizonteAnios}) es ${fmtK(explot)} miles de USD y el año 0 aporta ${fmtK(anio0)} (pagos por la fuerza de trabajo de montaje, único concepto activo en esa fase). Ambos totales provienen del mismo cálculo del motor: resumen, tabla y conclusiones coinciden por construcción.`,
    `Composición del período: impuestos sobre utilidades ${fmtK(imp)}, pagos por la fuerza de trabajo ${fmtK(pagosFT + (m.valores['pagos_fuerza_trabajo_k']?.[0] ?? 0))}, dividendos de la parte cubana ${fmtK(divCub)}, canon ${fmtK(canon)}, aranceles ${fmtK(aranceles)} y otros impuestos y tasas ${fmtK(otrosImp)} miles de USD.`,
    `Los pagos por la fuerza de trabajo referencian el costo laboral del modelo (sin doble contabilización con los salarios ya deducidos en el estado de resultados); los dividendos cubanos provienen del módulo de dividendos (limitado por resultados acumulados, reservas y caja disponible) y no de un porcentaje aplicado en paralelo.`,
  ];
  const inv = m.indicadores.inversionTotalKUSD;
  frases.push(
    total > inv
      ? `El acumulado (${fmtK(total)} kUSD) supera la inversión total del proyecto (${fmtK(inv)} kUSD) dentro del horizonte; aun así, estos son beneficios PROYECTADOS, no ingresos estatales efectivos, y dependen de que la operación ocurra según lo modelado.`
      : `El acumulado (${fmtK(total)} kUSD) ${total > 0 ? 'es inferior' : 'no supera'} a la inversión total del proyecto (${fmtK(inv)} kUSD) dentro del horizonte: preséntelo con esa perspectiva.`
  );
  const pendientes = p.aportaciones.some((a) => a.tipo === 'derechos_reales' && !a.referenciaDocumental?.trim());
  if (pendientes) frases.push('Existen aportaciones con derechos reales pendientes de documentación: los certificados exigibles forman parte de la acreditación de estos beneficios ante las autoridades.');
  void ft;
  return { texto: lista(frases), huella: huellaDe({ total, explot, anio0, imp, pagosFT, divCub, canon, aranceles, otrosImp, inv }) };
}

function analisisResumenEjecutivo(p: PlanexProject, m: ComputedModel): { texto: string; huella: string } {
  const ind = m.indicadores;
  const N = p.ajustes.horizonteAnios;
  const errores = m.issues.filter((i) => i.tipo === 'error');
  const recP = ind.recuperacionProyecto;
  const recS = ind.recuperacionSocios;
  const excesoCapacidad = m.servicios.some((s) => s.capacidadesExcedidas.length > 0);
  const insuficiente = (m.valores['diferencia_financiacion_k']?.[0] ?? 0) < -0.05;

  const frases = [
    `${p.titulo.nombreProyecto || p.nombre} es una propuesta de ${p.negocio.modalidad || 'inversión extranjera'} con una inversión total calculada de ${fmtK(ind.inversionTotalKUSD)} miles de USD, financiada con ${fmtK(ind.aportacionesTotalesKUSD)} kUSD de aportaciones de los socios${parametro(p, 'credito_monto_k') > 0 && p.financiero.deuda.habilitada ? ` y un crédito de ${fmtK(parametro(p, 'credito_monto_k'))} kUSD` : ''}, sobre un horizonte de análisis de ${N} años.`,
    `Con los supuestos activos, el modelo proyecta ingresos del año 1 por ${fmtK(ind.ingresosTotales[1] ?? 0)} miles de USD, utilidad después de impuestos de ${fmtK(ind.utilidadNeta[1] ?? 0)} kUSD y una plantilla de ${fmtNum(ind.totalTrabajadores)} trabajadores en operación.`,
    recP.anios !== null && !recP.indeterminado
      ? `La inversión total se recupera en ${fmtAnios(recP.anios)} por el flujo de caja del proyecto; el capital aportado por los socios, en ${recS.anios !== null && !recS.indeterminado ? fmtAnios(recS.anios) : 'plazo no determinado'}.`
      : `La inversión total NO se recupera dentro del horizonte de ${N} años con el flujo del proyecto: el plan debe declararlo expresamente.`,
    `Los beneficios directos al país acumulan ${fmtK(ind.beneficiosPaisAcumulados)} miles de USD en el período completo (explotación: ${fmtK(ind.beneficiosPaisExplotacion)} kUSD), con impuestos sobre utilidades por ${fmtK(ind.impuestosTotales)} kUSD y dividendos de la parte cubana por ${fmtK(Object.values(m.valores['dividendos_parte_cubana_k'] ?? {}).reduce((s, v) => s + v, 0))} kUSD.`,
  ];
  const riesgos: string[] = [];
  if (errores.length) riesgos.push(`errores de cálculo sin resolver (${errores.length})`);
  if (insuficiente) riesgos.push('financiación insuficiente');
  if (excesoCapacidad) riesgos.push('demanda no atendible con la capacidad activa');
  if (recP.anios === null) riesgos.push('recuperación de la inversión fuera del horizonte');
  if (N < Math.ceil((recP.anios ?? 0) + 1)) riesgos.push('horizonte menor que recuperación + 1');
  if (!p.mercado.fuentesConsulta?.trim()) riesgos.push('fuentes de mercado sin documentar');
  frases.push(
    riesgos.length
      ? `Riesgos y advertencias activas: ${riesgos.join('; ')}. Mientras no se corrijan, el resumen no puede presentarse como una evaluación favorable.`
      : 'El diagnóstico no arroja errores de cálculo ni advertencias críticas bajo los supuestos vigentes; ello no equivale a una validación legal, de mercado ni sanitaria.'
  );
  frases.push('Datos pendientes de verificar: tasa tributaria aplicable, tipo de cambio oficial vigente, licencias y autorizaciones, certificaciones de aportes y demanda solvente documentada.');

  return { texto: lista(frases), huella: huellaDe({ inv: ind.inversionTotalKUSD, ap: ind.aportacionesTotalesKUSD, ing: ind.ingresosTotales[1], udi: ind.utilidadNeta[1], recP, recS, bp: ind.beneficiosPaisAcumulados, bpE: ind.beneficiosPaisExplotacion, riesgos, N }) };
}

function analisisConclusiones(p: PlanexProject, m: ComputedModel): { texto: string; huella: string } {
  const ind = m.indicadores;
  const N = p.ajustes.horizonteAnios;
  const recP = ind.recuperacionProyecto;
  const errores = m.issues.filter((i) => i.tipo === 'error');
  const advertencias = m.issues.filter((i) => i.tipo === 'inconsistencia');
  const insuficiente = (m.valores['diferencia_financiacion_k']?.[0] ?? 0) < -0.05;
  const excesoCapacidad = m.servicios.some((s) => s.capacidadesExcedidas.length > 0);

  const frases: string[] = [];
  frases.push(
    `Sobre los resultados económicos preliminares del modelo: inversión total de ${fmtK(ind.inversionTotalKUSD)} miles de USD, ingresos del año 1 de ${fmtK(ind.ingresosTotales[1] ?? 0)} kUSD, utilidad después de impuestos de ${fmtK(ind.utilidadNeta[1] ?? 0)} kUSD y beneficios directos al país acumulados de ${fmtK(ind.beneficiosPaisAcumulados)} kUSD en ${N} años.`
  );
  frases.push(
    recP.anios !== null && !recP.indeterminado
      ? `El flujo de caja del proyecto recupera la inversión total en ${fmtAnios(recP.anios)}${ind.recuperacionSocios.anios !== null && !ind.recuperacionSocios.indeterminado ? `, y el flujo de los socios recupera el capital aportado en ${fmtAnios(ind.recuperacionSocios.anios)}` : ''}. Estos períodos derivan de los flujos vigentes y pueden cambiar al cambiar cualquier supuesto.`
      : 'El flujo de caja del proyecto NO recupera la inversión total dentro del horizonte: la propuesta, tal como está modelada, no puede presentarse como recuperada.'
  );
  const bloqueantes: string[] = [];
  if (errores.length) bloqueantes.push(`${errores.length} error(es) de cálculo`);
  if (insuficiente) bloqueantes.push('insuficiencia de financiación');
  if (excesoCapacidad) bloqueantes.push('demanda no atendible con la capacidad activa');
  if (recP.anios === null) bloqueantes.push('recuperación no alcanzada en el horizonte');
  frases.push(
    bloqueantes.length
      ? `El diagnóstico impide calificar el plan como viable en su estado actual: ${bloqueantes.join(', ')}. Corrija estas causas y regenere el análisis antes de extraer conclusiones definitivas.`
      : 'Con los supuestos vigentes, el modelo no presenta errores de cálculo ni insuficiencias operativas conocidas; las advertencias restantes figuran en el panel de diagnóstico.'
  );
  frases.push(
    `Estas conclusiones se generan desde el estado actual del modelo de cálculo. ${advertencias.length ? `Persisten ${advertencias.length} advertencia(s) de consistencia` : 'No persisten advertencias de consistencia'}; en todo caso, la viabilidad jurídica, sanitaria y de mercado de la propuesta queda sujeta a validaciones externas que este documento no sustituye.`
  );
  return { texto: lista(frases), huella: huellaDe({ inv: ind.inversionTotalKUSD, ing: ind.ingresosTotales[1], udi: ind.utilidadNeta[1], bp: ind.beneficiosPaisAcumulados, recP, recS: ind.recuperacionSocios, bloqueantes, advertencias: advertencias.length, N }) };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/** Genera TODOS los análisis con sus huellas a partir del modelo actual. */
export function generarAnalisis(p: PlanexProject, m: ComputedModel): Record<ClaveAnalisis, AnalisisGenerado> {
  return {
    resumen_ejecutivo: analisisResumenEjecutivo(p, m),
    aportaciones: analisisAportaciones(p, m),
    capacidad: analisisCapacidad(p, m),
    inversion_financiacion: analisisInversionFinanciacion(p, m),
    ingresos_costos: analisisIngresosCostos(p, m),
    deuda_depreciacion: analisisDeudaDepreciacion(p, m),
    flujo_recuperacion: analisisFlujoRecuperacion(p, m),
    mercado: analisisMercado(p, m),
    fuerza_trabajo: analisisFuerzaTrabajo(p, m),
    inversiones_cronograma: analisisInversionesCronograma(p, m),
    beneficios_pais: analisisBeneficiosPais(p, m),
    conclusiones: analisisConclusiones(p, m),
  };
}

/** Estado de trazabilidad de un análisis dado (misión §12.13). */
export function estadoAnalisis(
  p: PlanexProject,
  clave: ClaveAnalisis,
  actual: AnalisisGenerado
): { estado: EstadoAnalisis; texto: string } {
  const guardado = p.analisis?.[clave];
  if (!guardado?.texto) return { estado: 'generado', texto: actual.texto };
  if (guardado.huellaOrigen === actual.huella) return { estado: 'manual', texto: guardado.texto };
  return { estado: 'desactualizado', texto: guardado.texto };
}
