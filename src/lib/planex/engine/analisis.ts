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
//
// Moneda de presentación (misión PLANEX-DOC-001 §5): los importes monetarios
// del motor (kUSD) se formatean a través de un contexto de presentación que
// convierte UNA sola vez desde la moneda de origen. El contexto por defecto
// (PRESENTACION_NATIVA) reproduce exactamente la salida anterior en kUSD.
// Las HUELLAS se computan sobre los valores de ORIGEN: cambiar la moneda de
// presentación nunca marca un texto manual como desactualizado.
//
// Permanecen SIEMPRE en su unidad de origen (no se convierten): el tipo de
// cambio (CUP/USD), los factores técnicos, los salarios en CUP (metodología
// 4.9) y los importes de filas expresados en la moneda de la propia fila
// (p. ej. inversiones), que conservan su etiqueta de moneda de origen.
// ============================================================================

import { PlanexProject, ComputedModel, EstadoAnalisis, ETIQUETAS_APORTACION, ETIQUETAS_CATEGORIA_INV } from '../types';
import { fmtK, fmtPct, fmtNum, fmtAnios } from '../format';
import { conciliarArranque } from './flujos';
import { computeProject } from './engine';

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

/**
 * Presentación monetaria de los textos (misión DOC-001 §3.2): convierte un
 * importe del motor (kUSD) a MILES de la moneda de presentación y lo formatea,
 * junto con las etiquetas de unidad correspondientes.
 */
export interface PresentacionMonetaria {
  /** Importe del motor en kUSD → texto en miles de la moneda de presentación. */
  k: (n: number) => string;
  /** Abreviatura de la unidad: 'kUSD' | 'kCUP'. */
  corto: string;
  /** Unidad en textos: 'miles de USD' | 'miles de CUP'. */
  largo: string;
}

/** Contexto nativo del motor: idéntico a la salida histórica en kUSD. */
export const PRESENTACION_NATIVA: PresentacionMonetaria = {
  k: fmtK,
  corto: 'kUSD',
  largo: 'miles de USD',
};

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

function analisisAportaciones(p: PlanexProject, m: ComputedModel, pres: PresentacionMonetaria): { texto: string; huella: string } {
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
    `Las aportaciones comprometidas suman ${pres.k(tot)} ${pres.largo}: el inversionista extranjero aporta ${pres.k(extranjero)} (${fmtPct(pct(extranjero, tot))}) y la parte nacional ${pres.k(nacional)} (${fmtPct(pct(nacional, tot))}).`,
    tipos.length
      ? `Por tipo de aporte, ${tipos.map(([t, v]) => `${ETIQUETAS_APORTACION[t as keyof typeof ETIQUETAS_APORTACION] ?? t} con ${pres.k(v)} (${fmtPct(pct(v, tot))})`).join(', ')}.`
      : 'No hay aportaciones registradas: complete la tabla de aportaciones (4.5) antes de evaluar la financiación.',
    `La composición del capital resultante es ${fmtPct(pct(extranjero, tot))} extranjero / ${fmtPct(pct(nacional, tot))} nacional; el parámetro de participación cubana configurado es ${fmtPct(parametro(p, 'pct_parte_cubana'))} y el diagnóstico comprueba su coherencia con estas aportaciones.`,
  ];
  if (Math.abs(dif) <= 0.05) {
    frases.push(
      `Con estas aportaciones y las demás fuentes, la financiación disponible cubre exactamente la inversión total calculada (diferencia de ${pres.k(dif)} ${pres.corto}) bajo las premisas vigentes; ello no implica que los fondos estén comprometidos ni desembolsados: las aportaciones requieren documentación de respaldo.`
    );
  } else if (dif < 0) {
    frases.push(
      `Existe una insuficiencia de financiación de ${pres.k(Math.abs(dif))} ${pres.corto} frente a la inversión total: el plan debe aumentar aportaciones, gestionar crédito adicional o reducir el alcance de la inversión antes de presentarse.`
    );
  } else {
    frases.push(
      `La financiación supera la inversión total en ${pres.k(dif)} ${pres.corto}: verifique si el exceso corresponde a capital de trabajo adicional documentado o debe ajustar las fuentes.`
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

function analisisCapacidad(p: PlanexProject, m: ComputedModel, pres: PresentacionMonetaria): { texto: string; huella: string } {
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
    `En el año 1 los ingresos por servicios ascienden a ${pres.k(ingresoTotal / 1000)} ${pres.largo}. Las tres líneas principales (${top3.map((x) => `«${x.s.nombre}» con ${fmtPct(pct(x.ingreso, ingresoTotal))}`).join(', ')}) concentran ${fmtPct(concentracion)} del ingreso${top ? `, encabezadas por «${top.s.nombre}» con ${pres.k(top.ingreso / 1000)} ${pres.largo}` : ''}.`
  );
  frases.push(
    `El margen de contribución del año 1 es ${pres.k(m.indicadores.margenContribucionAnio1 ? m.indicadores.margenContribucionAnio1 / 1000 : 0)} ${pres.largo} (${fmtPct(pct(m.indicadores.margenContribucionAnio1 ?? 0, ingresoTotal))} de los ingresos). La línea que más margen aporta es «${mayorMargen?.s.nombre ?? '—'}» (${pres.k((mayorMargen?.margen ?? 0) / 1000)} ${pres.largo}) y la que menos, «${menorMargen?.s.nombre ?? '—'}» (${pres.k((menorMargen?.margen ?? 0) / 1000)}).`
  );
  if (margenBajo.length) {
    frases.push(
      `${margenBajo.length} línea(s) quedan por debajo del margen mínimo de referencia (${fmtPct(umbralMargen)}): ${margenBajo.map((x) => `«${x.s.nombre}» (${fmtPct(x.margenPct)})`).join(', ')}. Revise sus precios o costos variables antes de escalar el negocio sobre ellas.`
    );
  }

  const escenario = p.tecnico.escenarioCapacidad;
  frases.push(
    escenario === 'B_ampliacion'
      ? `Escenario activo: B (ampliación de capacidad). Las ampliaciones programadas en la tabla de recursos generan CAPEX en sus años de ejecución y amplían la capacidad disponible; el total de CAPEX de ampliaciones del horizonte es ${pres.k(Object.values(m.indicadores.capexAmpliaciones).reduce((s, v) => s + v, 0))} ${pres.largo}.`
      : 'Escenario activo: A (capacidad constante). Las cantidades proyectadas quedan limitadas a la capacidad instalada actual; cualquier ampliación futura debe programarse explícitamente en el escenario B.'
  );

  const excedidos = m.servicios.filter((s) => s.capacidadesExcedidas.length > 0);
  if (excedidos.length) {
    frases.push(
      `La demanda prevista no puede atenderse íntegramente en ${excedidos.length} línea(s): ${excedidos.map((s) => {
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
    .map((r) => {
      const utils = Object.values(r.utilizacion);
      const util = Math.max(...utils);
      const anioUtil = Number(Object.entries(r.utilizacion).sort((a, b) => b[1] - a[1])[0][0]);
      return { r, util, anioUtil, horasDisp: r.horasDisponibles[anioUtil] ?? 0, horasDem: r.horasDemandadas[anioUtil] ?? 0 };
    })
    .filter((x) => x.util > umbral)
    .sort((x, y) => y.util - x.util);
  if (recursosSaturados.length) {
    frases.push(
      `Recursos con mayor utilización: ${recursosSaturados.slice(0, 3).map((x) => `«${x.r.nombre}» llega a ${fmtPct(x.util)} en el año ${x.anioUtil} (${fmtK(x.horasDem)} horas demandadas de ${fmtK(x.horasDisp)} disponibles)`).join(', ')} (umbral de referencia ${fmtPct(umbral)}); la combinación de servicios deja poco margen para mantenimiento e imprevistos en esos recursos compartidos. La utilización de cada recurso y año puede reproducirse desde la tabla de utilización de recursos del apartado 4.6 (horas-mes demandadas ÷ horas-mes disponibles).`
    );
  } else if (m.recursosCalculados.length) {
    const maxRecurso = m.recursosCalculados.map((r) => {
      const utils = Object.values(r.utilizacion);
      return { r, util: Math.max(...utils), anioUtil: Number(Object.entries(r.utilizacion).sort((a, b) => b[1] - a[1])[0][0]) };
    }).sort((x, y) => y.util - x.util)[0];
    frases.push(`Ningún recurso supera el umbral de utilización de referencia (${fmtPct(umbral)}); el más cargado es «${maxRecurso?.r.nombre ?? '—'}» con ${fmtPct(maxRecurso?.util ?? 0)} en el año ${maxRecurso?.anioUtil ?? '—'}.`);
  } else {
    frases.push('No hay recursos operativos definidos: la capacidad no está siendo verificada contra gabinetes, equipos ni personal, lo que impide validar la operatividad del plan (complétela en 4.6).');
  }

  huellaDatos.push(margenes, concentracion, excedidos.map((e) => e.id), recursosSaturados.map((r) => r.r.id), escenario, m.indicadores.capexAmpliaciones);
  return { texto: lista(frases), huella: huellaDe(huellaDatos) };
}

function analisisInversionFinanciacion(p: PlanexProject, m: ComputedModel, pres: PresentacionMonetaria): { texto: string; huella: string } {
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
    `La inversión inicial total calculada es ${pres.k(inv)} ${pres.largo}, compuesta por gastos previos de ${pres.k(previos)} (${fmtPct(pct(previos, inv))}), inversión fija de ${pres.k(fija)} (${fmtPct(pct(fija, inv))}) y capital de trabajo inicial de ${pres.k(ct)} (${fmtPct(pct(ct, inv))}).`,
    mayores.length
      ? `Las partidas de mayor peso son ${mayores.map((x) => `«${x.concepto}» (${fmtK(x.monto)} ${x.moneda})`).join(', ')}.`
      : 'No hay partidas de inversión registradas: complete la tabla de inversiones (4.10).',
  ];
  if (fijaCUP > 0.001) {
    frases.push(
      `Dentro de la inversión fija, ${pres.k(fijaCUP)} ${pres.corto} provienen de partidas expresadas en CUP convertidas con el tipo de cambio parametrizado de ${fmtK(parametro(p, 'tipo_cambio'))} CUP/USD (con fecha y fuente documentables): las monedas no se suman sin convertir.`
    );
  }
  frases.push(
    `Las fuentes disponibles suman ${pres.k(aport + otras + credito)} ${pres.largo} (aportaciones ${pres.k(aport)}, otras fuentes ${pres.k(otras)}, crédito ${pres.k(credito)}). La necesidad de financiación (inversión menos aportaciones y otras fuentes) es ${pres.k(nec)} ${pres.corto}${
      credito > 0
        ? nec > credito
          ? `, cubierta solo en ${fmtPct(pct(credito, nec))} por el crédito previsto: el faltante se cuantifica en la diferencia de financiación`
          : ', cubierta por el crédito previsto; el servicio de esa deuda (intereses y amortizaciones) se analiza en el calendario correspondiente'
        : ' y no se ha previsto crédito para cubrirla'}.`
  );
  if (dif < -0.05) {
    frases.push(`Existe una insuficiencia de financiación de ${pres.k(Math.abs(dif))} ${pres.corto} frente a la inversión total: el plan no es financiable bajo las premisas actuales (diferencia de financiación: faltan ${pres.k(Math.abs(dif))} ${pres.corto}). Aumente aportaciones, gestione crédito adicional o reduzca el alcance de la inversión antes de cualquier presentación.`);
  } else if (dif > 0.05) {
    frases.push(`Diferencia de financiación: sobran ${pres.k(dif)} ${pres.corto} sin asignar a inversión; justifique su uso o ajuste las fuentes.`);
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
    frases.push(
      `Calendario de desembolsos de aportaciones (misma convención de años 0/1/2 que las tablas de financiación y flujos): ${porAnio.map((v, i) => `año ${i} (${i === 0 ? 'montaje/arranque — financia la inversión total del año 0' : 'operación'}): ${pres.k(v)} ${pres.corto}`).join('; ')}.`
    );
  }
  // Cobertura TEMPORAL de la financiación (R2 §1): fuentes comprometidas para
  // todo el proyecto frente a las efectivamente disponibles en cada período,
  // año efectivo de desembolso del crédito, fecha de las otras fuentes y
  // déficits cuando realmente se producen.
  {
    const cob = m.cobertura;
    const dispAnio0 = m.arranque.fuentesAnio0;
    const tardias = porAnio.slice(1).some((v) => v > 0.005);
    const partesFuentes = [
      `aportaciones con vencimiento en el año 0 ${pres.k(cob.aportacionesPorAnio[0] ?? 0)}`,
      cob.anioDesembolsoCredito !== null
        ? `principal del crédito desembolsado en el año ${cob.anioDesembolsoCredito} (${pres.k(cob.porAnio[cob.anioDesembolsoCredito]?.credito ?? 0)})`
        : 'sin crédito desembolsado',
    ];
    if (otras > 0.005) {
      partesFuentes.push(
        `otras fuentes ${pres.k(otras)} — el parámetro no declara FECHA: se suponen disponibles en el año 0 (supuesto documentado, no un desembolso verificado)`
      );
    }
    frases.push(
      `Cobertura temporal: las fuentes COMPROMETIDAS para todo el proyecto suman ${pres.k(aport + otras + credito)} ${pres.corto}, pero las disponibles con desembolso efectivo en el año 0 suman ${pres.k(dispAnio0)} ${pres.corto} (${partesFuentes.join('; ')}).${tardias ? ` Las aportaciones de los años 1 y 2 (${pres.k((cob.aportacionesPorAnio[1] ?? 0) + (cob.aportacionesPorAnio[2] ?? 0))} ${pres.corto}) entran DESPUÉS del arranque y no pueden financiar la inversión del año 0.` : ''} El control por período exige que cada necesidad esté cubierta el año en que se produce, no en el agregado del horizonte.`
    );
    if (cob.deficitCaja.length === 0) {
      frases.push(
        `La tesorería proyectada (aportaciones fechadas + otras fuentes + desembolsos del crédito + flujos operativos − dividendos) no es negativa en ningún año del horizonte: no se detectan déficits temporales.`
      );
    } else {
      const texto = cob.deficitCaja
        .map(
          (d) =>
            `año ${d.anio} (faltan ${pres.k(d.monto)} ${pres.corto}${d.cubiertoEn !== null ? `; cubiertas desde el año ${d.cubiertoEn}` : '; no cubiertas dentro del horizonte'})`
        )
        .join('; ');
      frases.push(
        `DÉFICIT TEMPORAL de tesorería en: ${texto}. ${m.arranque.brechaNominal >= -0.05 ? 'La financiación total comprometida cubre la necesidad total del horizonte: el problema es de CALENDARIO (los desembolsos llegan después de las necesidades), no de cuantía.' : 'Además, la financiación total comprometida no cubre la necesidad total: el problema es de cuantía Y de calendario.'} Reprograme los desembolsos, amplíe el capital de trabajo o declare el supuesto.`
      );
    }
  }
  // Conciliación del desembolso inicial (DOC-002-R1 §2, temporal en R2 §1):
  // salidas de caja EXPLÍCITAS e INVENTARIADAS del año 0 (no el resultado
  // contable después de impuestos) frente a las fuentes del año 0.
  {
    const arranque = conciliarArranque(m);
    const gastoAnio0 = arranque.gastoCajaAnio0;
    if (arranque.nominaMontaje > 0.005 || arranque.interesPagado > 0.005 || arranque.impuestoPagado > 0.005) {
      const necesidad = arranque.necesidadTotal;
      const brecha = arranque.brecha;
      const partes = [
        arranque.nominaMontaje > 0.005 ? `nómina de montaje ${pres.k(arranque.nominaMontaje)}` : '',
        arranque.interesPagado > 0.005 ? `interés pagado del año 0 ${pres.k(arranque.interesPagado)}` : '',
        arranque.impuestoPagado > 0.005 ? `impuesto DEVENGADO del año 0 ${pres.k(arranque.impuestoPagado)} (regla contable; supuesto del modelo simplificado: pagado en el mismo período — no es un pago verificado)` : '',
      ].filter(Boolean);
      const menos = arranque.ingresosAnio0 > 0.005 ? `, menos ingresos explícitos del año 0 por ${pres.k(arranque.ingresosAnio0)}` : '';
      frases.push(
        `Conciliación del desembolso inicial: la inversión total (${pres.k(inv)} ${pres.corto}) más las salidas de caja del año 0 explícitamente identificadas (${partes.join(' + ')}${menos}: total ${pres.k(Math.max(0, gastoAnio0))} ${pres.corto}; gastos de la fase de montaje del año 0 registrados como gasto del período, no capitalizables y NO incluidos en la inversión total — el capital de trabajo ya está dentro de la inversión total y no se duplica) exigen una necesidad total de arranque de ${pres.k(necesidad)} ${pres.corto}; las fuentes con desembolso efectivo en el año 0 suman ${pres.k(arranque.fuentesAnio0)} ${pres.corto}${brecha < -0.05 ? `, de modo que queda una BRECHA TEMPORAL de ${pres.k(Math.abs(brecha))} ${pres.corto} que debe financiarse (mayor capital de trabajo, aporte anticipado o crédito con desembolso en el año 0) o declararse expresamente como supuesto pendiente` : ' y cubren la necesidad total del arranque'}${arranque.brechaNominal < -0.05 && brecha < arranque.brechaNominal + 0.05 ? ` (la brecha según el total nominal comprometido es ${pres.k(Math.abs(arranque.brechaNominal))} ${pres.corto}: ni siquiera el agregado del horizonte cubre la necesidad)` : ''}. El gasto del año 0 se cuantifica desde partidas de salida de caja explícitas e inventariadas — nómina de montaje, interés pagado según el calendario de deuda e impuesto devengado con su estado de pago declarado —, no desde el resultado contable después de impuestos. Los desembolsos del año 0 y del año 1 conservan el mismo significado en todas las tablas.`
      );
    }
  }
  return {
    texto: lista(frases),
    huella: huellaDe({
      inv,
      previos,
      fija,
      ct,
      aport,
      otras,
      credito,
      dif,
      porAnio,
      mayores: mayores.map((x) => x.id),
      // R2 §1: la huella incorpora la estructura TEMPORAL (fuentes por año,
      // déficits y brechas), de modo que un análisis manual quede marcado como
      // desactualizado si cambia el calendario de desembolsos.
      fuentesAnio0: m.arranque.fuentesAnio0,
      brechaAnio0: m.arranque.brecha,
      deficitCaja: m.cobertura.deficitCaja.map((d) => [d.anio, Math.round(d.monto * 100) / 100, d.cubiertoEn]),
      anioCredito: m.cobertura.anioDesembolsoCredito,
    }),
  };
}

function analisisIngresosCostos(p: PlanexProject, m: ComputedModel, pres: PresentacionMonetaria): { texto: string; huella: string } {
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
    `Los ingresos totales pasan de ${pres.k(ing1)} ${pres.largo} en el año 1 a ${pres.k(ingN)} en el año ${N} (crecimiento medio implícito ${fmtPct(crecimientoIng)} anual). Esa trayectoria resulta de la demanda prevista, los precios con su crecimiento parametrizado y la limitación por capacidad del escenario activo; no incluye facturación por encima de lo atendible.`,
    `En el año 1 los costos variables absorben ${fmtPct(pct(cv1, ing1))} de los ingresos, la fuerza de trabajo ${fmtPct(pct(cl1, ing1))} y los costos fijos de operación (canon, mantenimiento, servicios públicos, gastos administrativos y otros) ${fmtPct(pct(fijo1, ing1))}. La depreciación del período es ${pres.k(dep1)} ${pres.largo}: es un gasto contable que no representa salida de caja.`,
    `Con la regla tributaria activa (tasa parametrizada de ${fmtPct(tasa)}, supuesto de demostración), el impuesto del año 1 es ${pres.k(imp1)} ${pres.largo} y la utilidad después de impuestos ${pres.k(udi1)} (${fmtPct(pct(udi1, ing1))} de margen neto).`,
    uaiN > uai1
      ? `La utilidad antes de impuestos mejora de ${pres.k(uai1)} (año 1) a ${pres.k(uaiN)} (año ${N}): el modelo atribuye la variación al crecimiento de demanda y precios activado por las reglas vigentes, sin cambios de capacidad adicionales a los programados.`
      : uaiN < uai1
        ? `La utilidad antes de impuestos DESCIENDE de ${pres.k(uai1)} (año 1) a ${pres.k(uaiN)} (año ${N}): revise qué partida crece más que los ingresos (costos variables por inflación, capacidad limitante o cargas financieras).`
        : `La utilidad antes de impuestos permanece en ${pres.k(uai1)} ${pres.largo} entre el año 1 y el año ${N}: verifique si el modelo refleja la dinámica prevista del negocio.`,
  ];
  const uaiSerie: number[] = [];
  for (let t = 1; t <= N; t++) uaiSerie.push(m.valores['utilidad_antes_impuestos_k']?.[t] ?? 0);
  const caidas: number[] = [];
  for (let t = 2; t <= N; t++) {
    if (uaiSerie[t - 1] < uaiSerie[t - 2] - 1e-9) caidas.push(t);
  }
  if (caidas.length) {
    const t0 = caidas[0];
    frases.push(
      `La utilidad antes de impuestos DESCIENDE en el año ${t0} (de ${pres.k(uaiSerie[t0 - 2])} a ${pres.k(uaiSerie[t0 - 1])} ${pres.corto})${caidas.length > 1 ? ` y vuelve a caer en ${caidas.length - 1} año(s) más` : ''}: revise qué partida crece más que los ingresos (costos variables por inflación, capacidad limitante, cargas financieras o nuevas depreciaciones de ampliaciones) antes de proyectar crecimiento sobre esa trayectoria.`
    );
  }
  const caja = m.indicadores.fcfeAcumulado[N] ?? 0;
  if (udi1 > 0 && caja < 0) {
    frases.push('ATENCIÓN: el plan muestra utilidad contable positiva pero la caja acumulada de los socios sigue negativa en el horizonte; rentabilidad contable y liquidez NO son equivalentes: revise el calendario de cobros, el capital de trabajo y el servicio de la deuda.');
  }

  // Hipótesis de inflación de costos fijos y sensibilidad de resultados
  // (DOC-002-R1 §4): 0 % se declara como HIPÓTESIS DE GASTOS NOMINALES
  // CONSTANTES sujeta a prueba contractual (no «conservadora» por defecto);
  // con un valor positivo se presenta la sensibilidad frente al caso 0 %.
  const PARTIDAS_FIJAS = ['canon_k', 'servicios_publicos_k', 'otros_gastos_k', 'aranceles_k', 'otros_impuestos_k', 'royalties_k'];
  const infFijos = parametro(p, 'inflacion_costos_fijos');
  if (infFijos > 1e-9) {
    const p0 = JSON.parse(JSON.stringify(p)) as PlanexProject;
    const param0 = p0.parametros.find((x) => x.id === 'inflacion_costos_fijos');
    if (param0) param0.valor = 0;
    try {
      const m0 = computeProject(p0);
      const sumaPartidas = (modelo: ComputedModel, t: number) => PARTIDAS_FIJAS.reduce((s, id) => s + (modelo.valores[id]?.[t] ?? 0), 0);
      const sumaUdi = (modelo: ComputedModel) => modelo.years.reduce((s, t) => s + (modelo.indicadores.utilidadNeta[t] ?? 0), 0);
      const dFijosN = sumaPartidas(m, N) - sumaPartidas(m0, N);
      const dUdi = sumaUdi(m) - sumaUdi(m0);
      frases.push(
        `Sensibilidad de la indexación de costos fijos (${fmtPct(infFijos)} anual): frente a la hipótesis de gastos nominales constantes (0 %), la indexación añade ${pres.k(dFijosN)} ${pres.corto} de costos fijos en el año ${N} y modifica la utilidad después de impuestos acumulada del horizonte en ${pres.k(dUdi)} ${pres.corto} (variación total, con su efecto tributario). Partidas afectadas por el parámetro: canon, servicios públicos, otros gastos fijos, aranceles, otros impuestos y royalties (el costo variable unitario sigue su propio parámetro de inflación). La elección del ${fmtPct(infFijos)} debe sostenerse en la prueba contractual de cada partida.`
      );
    } catch {
      frases.push(
        `Los costos fijos se indexan al ${fmtPct(infFijos)} anual (parámetro «inflacion_costos_fijos»): partidas afectadas — canon, servicios públicos, otros gastos fijos, aranceles, otros impuestos y royalties. La indexación debe sostenerse en la prueba contractual de cada partida.`
      );
    }
  } else {
    frases.push(
      `Los costos fijos (canon, servicios públicos, otros gastos fijos, aranceles, otros impuestos y royalties) permanecen a valores nominales constantes durante el horizonte por la HIPÓTESIS del parámetro «inflacion_costos_fijos» = 0 %: es una hipótesis de GASTOS NOMINALES CONSTANTES sujeta a PRUEBA CONTRACTUAL — solo es válida si los contratos reales fijan importes nominales por todo el período — y no se califica automáticamente de conservadora: si los contratos efectivamente se indexan, mantener 0 % SUBESTIMA los costos y SOBREESTIMA el resultado. Al cambiar el parámetro a un valor positivo, el informe presentará la sensibilidad de resultados frente a la indexación.`
    );
  }
  return { texto: lista(frases), huella: huellaDe({ ing1, ingN, uai1, uaiN, imp1, cv1, cl1, dep1, fijo1, tasa, caja, infFijos }) };
}

function analisisDeudaDepreciacion(p: PlanexProject, m: ComputedModel, pres: PresentacionMonetaria): { texto: string; huella: string } {
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
      `El crédito de ${pres.k(monto)} ${pres.largo} se desembolsa en el año ${cfg.anioDesembolso} con tasa del ${fmtPct(tasa)}, gracia de ${gracia} año(s) de tipo ${cfg.tipoGracia === 'total' ? 'TOTAL (los intereses se capitalizan en el saldo)' : 'de principal (los intereses se pagan corriente)'} y amortización por ${cfg.metodo === 'capital_constante' ? 'capital constante' : cfg.metodo === 'sistema_frances' ? 'sistema francés (cuota total constante)' : 'pago único al vencimiento'} en ${plazo} anualidades.`
    );
    frases.push(
      `A lo largo del horizonte se devengan ${pres.k(interesTotal)} ${pres.largo} de intereses y se amortizan ${pres.k(amortTotal)}; el saldo pendiente al cierre del horizonte es ${pres.k(fin.saldoFinal)} ${pres.corto}. La tabla de deuda verifica saldo final = saldo inicial + desembolso + capitalización − amortización en cada período y ningún período amortiza por encima del saldo.`
    );
    const servicio = m.deuda.map((f) => f.interesPagado + f.amortizacion);
    const maxServicio = Math.max(...servicio.slice(1));
    const anioMax = servicio.indexOf(maxServicio);
    frases.push(
      `El servicio máximo de la deuda (interés pagado + amortización) es ${pres.k(maxServicio)} ${pres.corto} en el año ${anioMax}: compárelo con el flujo de caja del proyecto del mismo año (${pres.k(m.indicadores.fcff[anioMax] ?? 0)} ${pres.corto}) para valorar el margen de cobertura.`
    );
    const escudoTotal = Object.values(m.indicadores.escudoFiscal).reduce((s, v) => s + v, 0);
    if (escudoTotal > 0.001) {
      const intTotalDesp = interesTotal - escudoTotal;
      frases.push(
        `Los flujos del proyecto reincorporan el interés DESPUÉS DE IMPUESTOS: del interés devengado total (${pres.k(interesTotal)} ${pres.corto}), el escudo fiscal deducido del impuesto asciende a ${pres.k(escudoTotal)} ${pres.corto} y solo ${pres.k(intTotalDesp)} ${pres.corto} vuelven al FCFF. El FCFE restituye ese escudo (los socios sí lo disfrutan vía menor impuesto), de modo que FCFF y FCFE reconcilian: FCFF − FCFE = intereses pagados − escudo − desembolsos + amortizaciones.`
      );
    }
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
      ? `El registro de activos depreciables contiene ${activos.length} activo(s). La depreciación anual total es ${pres.k(depPorAnio[1] ?? 0)} ${pres.largo} en el año 1 y alcanza su máximo (${pres.k(depPorAnio[anioPico] ?? 0)}) en el año ${anioPico}; cada activo deprecia desde su año de disponibilidad, respeta su vida útil y nunca supera su importe depreciable.`
      : 'No hay activos depreciables definidos: la depreciación es nula y el flujo de caja no incorpora reincorporación alguna.'
  );
  if (sinDepreciar.length) {
    frases.push(
      `${sinDepreciar.length} activo(s) quedan con valor neto en libros al final del horizonte (p. ej. «${sinDepreciar[0].concepto}» con ${pres.k(sinDepreciar[0].vnl)} ${pres.corto}): el plan debe declarar el tratamiento de ese valor residual al cierre.`
    );
  }
  frases.push('La depreciación es un gasto no monetario: reduce la utilidad contable pero el flujo de caja la reincorpora una sola vez; las amortizaciones del principal, en cambio, son salidas de caja del financiador y no gasto del estado de resultados.');

  return { texto: lista(frases), huella: huellaDe({ cfg, interesTotal, amortTotal, fin: m.deuda[m.deuda.length - 1]?.saldoFinal, activos: activos.map((a) => [a.id, a.acumulada, a.vnl]), totalDep }) };
}

function analisisFlujoRecuperacion(p: PlanexProject, m: ComputedModel, pres: PresentacionMonetaria): { texto: string; huella: string } {
  const N = p.ajustes.horizonteAnios;
  const recP = m.indicadores.recuperacionProyecto;
  const recS = m.indicadores.recuperacionSocios;
  const frases: string[] = [];

  frases.push(
    'El modelo calcula DOS indicadores separados. La recuperación de la INVERSIÓN TOTAL se mide con el flujo de caja del proyecto (FCFF = utilidad neta + intereses DESPUÉS DE IMPUESTOS + depreciación − CAPEX de ampliaciones; el interés devengado se reincorpora neto de su escudo fiscal — la porción de interés que el impuesto ya absorbe —, con la inversión total como desembolso del año 0). La recuperación del CAPITAL APORTADO se mide con el flujo de los socios (FCFE = FCFF − intereses pagados + escudo fiscal + desembolsos del crédito − amortizaciones, con las aportaciones como desembolso inicial). Ambas recuperaciones son SIMPLES y SIN DESCONTAR: no se aplica tasa de descuento alguna a los flujos.'
  );
  if (recP.anios !== null && !recP.indeterminado) {
    frases.push(
      `Con los flujos vigentes, la inversión total de ${pres.k(m.indicadores.inversionTotalKUSD)} ${pres.corto} se recupera en ${fmtAnios(recP.anios)} (cruce del acumulado en el año ${recP.anioCruce}; interpolación lineal: (t−1) + |acumulado anterior| / (acumulado actual − acumulado anterior)). El saldo pendiente de recuperar al final del año ${Math.max(0, (recP.anioCruce ?? 1) - 1)} era ${pres.k(-m.indicadores.fcffAcumulado[Math.max(0, (recP.anioCruce ?? 1) - 1)])} ${pres.corto}.`
    );
  } else if (recP.indeterminado) {
    frases.push(`La recuperación de la inversión total no puede emitirse como una cifra única fiable: ${recP.motivo}`);
  } else {
    frases.push(
      `La inversión total NO se recupera dentro del horizonte de ${N} años con el flujo del proyecto: el acumulado termina en ${pres.k(m.indicadores.fcffAcumulado[N] ?? 0)} ${pres.corto}. Debe decirse expresamente; cualquier afirmación de recuperación en el plan sería incorrecta con los datos actuales.`
    );
  }
  if (recS.anios !== null && !recS.indeterminado) {
    frases.push(
      `El capital aportado por los socios (${pres.k(m.indicadores.aportacionesTotalesKUSD)} ${pres.corto}) se recupera en ${fmtAnios(recS.anios)} (cruce en el año ${recS.anioCruce}), ${recS.anios !== null && recP.anios !== null && recS.anios >= recP.anios ? 'más tardía que' : 'más temprana que'} la recuperación de la inversión total: la diferencia procede del crédito (desembolsos) y de su servicio (intereses y amortizaciones).`
    );
  } else if (recS.indeterminado) {
    frases.push(`La recuperación del capital aportado no puede emitirse como una cifra única fiable: ${recS.motivo}`);
  } else {
    frases.push(`El capital aportado por los socios NO se recupera dentro del horizonte según el flujo de los socios (acumulado final: ${pres.k(m.indicadores.fcfeAcumulado[N] ?? 0)} ${pres.corto}).`);
  }

  const capexAmp = Object.values(m.indicadores.capexAmpliaciones).reduce((s, v) => s + v, 0);
  if (capexAmp > 0.001) {
    frases.push(
      `Las ampliaciones de capacidad del escenario B añaden ${pres.k(capexAmp)} ${pres.largo} de CAPEX en sus años de ejecución, retrasando el acumulado del proyecto en esos años; el modelo los incluye íntegramente (no presenta una recuperación optimista que ignore las inversiones adicionales).`
    );
  }
  const pctCT = parametro(p, 'pct_recuperacion_capital_trabajo');
  if (pctCT > 0) {
    frases.push(
      `El modelo libera el ${fmtPct(pctCT)} del capital de trabajo (${pres.k(pctCT * parametro(p, 'capital_trabajo_k'))} ${pres.corto}) en el último año: esa recuperación es un supuesto parametrizado que debe justificarse.`
    );
  } else {
    frases.push('El capital de trabajo inicial no se recupera dentro del modelo (tratamiento conservador, parámetro de recuperación en 0 %).');
  }
  if (m.indicadores.recuperacionProyecto.anios !== null && N < Math.ceil(m.indicadores.recuperacionProyecto.anios + 1)) {
    frases.push('ATENCIÓN: el horizonte es menor que la recuperación más un año; la metodología exige ampliar el horizonte antes de presentar el plan.');
  }
  return {
    texto: lista(frases),
    huella: huellaDe({ recP, recS, fcff: m.indicadores.fcff, fcfe: m.indicadores.fcfe, capexAmp, pctCT, N }),
  };
}

function analisisMercado(p: PlanexProject, m: ComputedModel, pres: PresentacionMonetaria): { texto: string; huella: string } {
  const ing1 = m.indicadores.ingresosTotales[1] ?? 0;
  const frases: string[] = [];
  const sinFuente = !p.mercado.fuentesConsulta?.trim() || /fictici|ilustrativ|supuesto/i.test(p.mercado.fuentesConsulta);

  frases.push(
    `El volumen de negocio modelado en el año 1 (${pres.k(ing1)} ${pres.largo}) se apoya en la demanda prevista definida en la tabla de servicios. La aplicación no simula una investigación de mercado: los valores de demanda aparente y demanda solvente declarados en el apartado 4.8 ${p.mercado.demandaAparente?.trim() && p.mercado.demandaSolvente?.trim() ? 'están registrados' : 'NO están registrados'} y deben sustentarse en fuentes verificables.`
  );
  frases.push(
    sinFuente
      ? 'Las fuentes consultadas no están documentadas (o están marcadas como ficticias de demostración): el análisis de mercado del plan es un SUPUESTO de demostración. Una propuesta real exige investigaciones de demanda, precios de referencia y competidores con fecha y fuente.'
      : 'Las fuentes consultadas figuran documentadas: verifique que incluyan fecha de consulta y que la demanda solvente sea coherente con el volumen modelado.'
  );
  // Conciliación demanda solvente → captación → volumen (DOC-002 §7):
  // la relación entre personas captadas y servicios previstos debe declararse
  // como hipótesis explícita de recurrencia (frecuencia de visita y servicios
  // por paciente), no darse por supuesto.
  {
    const personas = p.mercado.demandaSolventePersonas;
    const pctCapt = p.mercado.captacionPrevistaPct;
    const volAnual1 = (m.servicios ?? []).reduce((s, x) => s + (x.cantidades?.[1] ?? 0), 0) * 12;
    if (Number.isFinite(personas) && Number.isFinite(pctCapt) && (personas as number) > 0 && volAnual1 > 0) {
      const captados = (personas as number) * (pctCapt as number);
      const porPaciente = volAnual1 / Math.max(1, captados);
      frases.push(
        `Conciliación demanda → captación → volumen: la demanda solvente declarada (${fmtNum(personas as number)} personas) con la captación objetivo (${fmtPct(pctCapt as number)}) implica unas ${fmtNum(captados)} personas captadas en el año 1, mientras que el volumen previsto de servicios asciende a ${fmtNum(volAnual1)} servicios anuales en todas las líneas: el modelo lo reconcilia mediante la HIPÓTESIS EXPLÍCITA de pacientes recurrentes con ≈ ${fmtK(porPaciente)} servicios por paciente captado al año (frecuencia de visita y servicios por paciente a validar con la práctica clínica real; es un supuesto, no un dato).`
      );
    } else {
      frases.push(
        'La demanda solvente cuantificada y la captación objetivo no están declaradas: no es posible conciliar personas captadas con el volumen de servicios previsto (hipótesis de recurrencia pendiente). Complételas en 4.8.'
      );
    }
  }
  // Desglose por canales (DOC-002 §6): exportaciones / plataformas / plaza.
  {
    const canales = new Map<string, { anual: number; nombres: string[] }>();
    for (const s of p.servicios) {
      const clave = s.canal ?? 'plaza';
      const v = (m.servicios.find((x) => x.id === s.id)?.valores[1]?.['srv_ingreso_anual'] ?? 0) / 1000;
      const e = canales.get(clave) ?? { anual: 0, nombres: [] };
      e.anual += v;
      e.nombres.push(s.nombre);
      canales.set(clave, e);
    }
    const sinCanal = p.servicios.filter((s) => !s.canal);
    const etiqueta: Record<string, string> = {
      exportacion: 'exportaciones',
      plataformas_exterior: 'ventas en plataformas con pagos desde el exterior',
      plaza: 'ventas en plaza',
    };
    const total = [...canales.values()].reduce((s, x) => s + x.anual, 0);
    if (total > 0) {
      frases.push(
        `Desglose de ingresos del año 1 por canal (metodología 4.8, sin duplicar operaciones): ${[...canales.entries()]
          .map(([k, x]) => `${etiqueta[k] ?? k}: ${pres.k(x.anual)} ${pres.corto} (${fmtPct(total > 0 ? x.anual / total : 0)})`)
          .join(', ')}.${sinCanal.length ? ` ATENCIÓN: ${sinCanal.length} servicio(s) sin canal declarado se computan en plaza por defecto; asigne el canal correcto en la tabla de servicios.` : ''}`
      );
    }
  }
  if (p.mercado.ventasExportacion?.trim()) {
    frases.push(
      `La estrategia de comercialización contempla ventas al exterior («${p.mercado.ventasExportacion.slice(0, 120)}…»): los ingresos en divisas deben identificarse por separado en la estructura de ingresos (exportaciones / plataformas con pagos desde el exterior / venta en plaza) sin duplicar operaciones.`
    );
  }
  frases.push(
    `Supuestos de mayor impacto en los resultados de mercado: precios unitarios (crecimiento ${fmtPct(parametro(p, 'crecimiento_precios'))} anual), demanda (crecimiento ${fmtPct(parametro(p, 'crecimiento_volumen'))} anual) y tope de capacidad del escenario activo. Un error de ±10 % en la demanda del año 1 desplaza los ingresos del año 1 en ±${pres.k(ing1 * 0.1)} ${pres.largo}.`
  );
  return { texto: lista(frases), huella: huellaDe({ ing1, sinFuente, exp: p.mercado.ventasExportacion, da: p.mercado.demandaAparente, ds: p.mercado.demandaSolvente, cp: parametro(p, 'crecimiento_precios'), cv: parametro(p, 'crecimiento_volumen'), personas: p.mercado.demandaSolventePersonas, pct: p.mercado.captacionPrevistaPct, canales: p.servicios.map((s) => s.canal ?? null) }) };
}

function analisisFuerzaTrabajo(p: PlanexProject, m: ComputedModel, pres: PresentacionMonetaria): { texto: string; huella: string } {
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
    `El salario promedio anual ponderado de la plantilla de operación es ${fmtK(ind.salarioPromedioAnualCUP ?? 0)} CUP. El costo laboral del año 1 asciende a ${pres.k(cl1)} ${pres.largo} (salarios en CUP convertidos con el tipo de cambio parametrizado, multiplicados por el factor de costo laboral de ${fmtK(parametro(p, 'factor_costo_laboral'))}), equivalente al ${fmtPct(pct(cl1, m.indicadores.ingresosTotales[1] ?? 0))} de los ingresos del año 1.`,
    montajeCosto > 0.001
      ? `El costo laboral del año 0 (montaje) es ${pres.k(montajeCosto)} ${pres.corto} y se registra como gasto del período: no forma parte de los gastos previos de la inversión, por lo que no está duplicado.`
      : 'No se registran costos de personal de montaje en el año 0.',
    `Los pagos por la fuerza de trabajo son uno de los beneficios directos al país: el costo laboral acumulado de la explotación es ${pres.k(pagosFTAcum)} ${pres.largo}. La remuneración de cada categoría y su etapa de contratación figuran en la tabla 4.9; su validación frente a la legislación laboral vigente queda fuera del modelo.`,
  ];
  return { texto: lista(frases), huella: huellaDe({ ind, cl1, montajeCosto, grupos, pagosFTAcum }) };
}

function analisisInversionesCronograma(p: PlanexProject, m: ComputedModel, pres: PresentacionMonetaria): { texto: string; huella: string } {
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
      `Las ampliaciones del escenario B añaden desembolsos en los años ${Object.entries(m.indicadores.capexAmpliaciones).filter(([, v]) => v > 0).map(([t, v]) => `${t}: ${pres.k(v)} ${pres.corto}`).join(', ')}. Un retraso en esas inversiones desplazaría la capacidad disponible y con ella los ingresos; el modelo los vincula, así que cualquier cambio de fecha exige reevaluar la proyección.`
    );
  }
  void activosCriticos;
  return { texto: lista(frases), huella: huellaDe({ catPesos, filas: filas.slice(0, 3).map((f) => f.id), etapas, capex: m.indicadores.capexAmpliaciones }) };
}

function analisisBeneficiosPais(p: PlanexProject, m: ComputedModel, pres: PresentacionMonetaria): { texto: string; huella: string } {
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
    `Los beneficios directos al país acumulan ${pres.k(total)} ${pres.largo} en el período completo del análisis (años 0 a ${p.ajustes.horizonteAnios}). El subtotal de la explotación (años 1 a ${p.ajustes.horizonteAnios}) es ${pres.k(explot)} ${pres.largo} y el año 0 aporta ${pres.k(anio0)} (pagos por la fuerza de trabajo de montaje, único concepto activo en esa fase). Ambos totales provienen del mismo cálculo del motor: resumen, tabla y conclusiones coinciden por construcción.`,
    `Composición del período: impuestos sobre utilidades ${pres.k(imp)}, pagos por la fuerza de trabajo ${pres.k(pagosFT + (m.valores['pagos_fuerza_trabajo_k']?.[0] ?? 0))}, dividendos de la parte cubana ${pres.k(divCub)}, canon ${pres.k(canon)}, aranceles ${pres.k(aranceles)} y otros impuestos y tasas ${pres.k(otrosImp)} ${pres.largo}.`,
    `Los pagos por la fuerza de trabajo referencian el costo laboral del modelo (sin doble contabilización con los salarios ya deducidos en el estado de resultados); los dividendos cubanos provienen del módulo de dividendos (limitado por resultados acumulados, reservas y caja disponible) y no de un porcentaje aplicado en paralelo.`,
  ];
  const inv = m.indicadores.inversionTotalKUSD;
  frases.push(
    total > inv
      ? `El acumulado (${pres.k(total)} ${pres.corto}) supera la inversión total del proyecto (${pres.k(inv)} ${pres.corto}) dentro del horizonte; aun así, estos son beneficios PROYECTADOS, no ingresos estatales efectivos, y dependen de que la operación ocurra según lo modelado.`
      : `El acumulado (${pres.k(total)} ${pres.corto}) ${total > 0 ? 'es inferior' : 'no supera'} a la inversión total del proyecto (${pres.k(inv)} ${pres.corto}) dentro del horizonte: preséntelo con esa perspectiva.`
  );
  const pendientes = p.aportaciones.some((a) => a.tipo === 'derechos_reales' && !a.referenciaDocumental?.trim());
  if (pendientes) frases.push('Existen aportaciones con derechos reales pendientes de documentación: los certificados exigibles forman parte de la acreditación de estos beneficios ante las autoridades.');
  void ft;
  return { texto: lista(frases), huella: huellaDe({ total, explot, anio0, imp, pagosFT, divCub, canon, aranceles, otrosImp, inv }) };
}

function analisisResumenEjecutivo(p: PlanexProject, m: ComputedModel, pres: PresentacionMonetaria): { texto: string; huella: string } {
  const ind = m.indicadores;
  const N = p.ajustes.horizonteAnios;
  const errores = m.issues.filter((i) => i.tipo === 'error');
  const recP = ind.recuperacionProyecto;
  const recS = ind.recuperacionSocios;
  const excesoCapacidad = m.servicios.some((s) => s.capacidadesExcedidas.length > 0);
  const insuficiente = (m.valores['diferencia_financiacion_k']?.[0] ?? 0) < -0.05;
  const tasaDemo = p.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')?.demo ?? false;
  const brechaAnio0 = m.issues.some((i) => i.codigo === 'FINANCIACION_ANO0');

  const frases = [
    `${p.titulo.nombreProyecto || p.nombre} es una propuesta de ${p.negocio.modalidad || 'inversión extranjera'} con una inversión total calculada de ${pres.k(ind.inversionTotalKUSD)} ${pres.largo}, financiada con ${pres.k(ind.aportacionesTotalesKUSD)} ${pres.corto} de aportaciones de los socios${parametro(p, 'credito_monto_k') > 0 && p.financiero.deuda.habilitada ? ` y un crédito de ${pres.k(parametro(p, 'credito_monto_k'))} ${pres.corto}` : ''}, sobre un horizonte de análisis de ${N} años.`,
    `Con los supuestos activos, el modelo proyecta ingresos del año 1 por ${pres.k(ind.ingresosTotales[1] ?? 0)} ${pres.largo}, utilidad después de impuestos de ${pres.k(ind.utilidadNeta[1] ?? 0)} ${pres.corto} y una plantilla de ${fmtNum(ind.totalTrabajadores)} trabajadores en operación.`,
    recP.anios !== null && !recP.indeterminado
      ? `La inversión total se recupera en ${fmtAnios(recP.anios)} (recuperación simple, sin descontar) por el flujo de caja del proyecto; el capital aportado por los socios, en ${recS.anios !== null && !recS.indeterminado ? fmtAnios(recS.anios) : 'plazo no determinado'}.`
      : `La inversión total NO se recupera dentro del horizonte de ${N} años con el flujo del proyecto: el plan debe declararlo expresamente.`,
    `Los beneficios directos al país acumulan ${pres.k(ind.beneficiosPaisAcumulados)} ${pres.largo} en el período completo (explotación: ${pres.k(ind.beneficiosPaisExplotacion)} ${pres.corto}), con impuestos sobre utilidades por ${pres.k(ind.impuestosTotales)} ${pres.corto} y dividendos de la parte cubana por ${pres.k(Object.values(m.valores['dividendos_parte_cubana_k'] ?? {}).reduce((s, v) => s + v, 0))} ${pres.corto}.`,
  ];
  const riesgos: string[] = [];
  if (errores.length) riesgos.push(`errores de cálculo sin resolver (${errores.length})`);
  if (insuficiente) riesgos.push('financiación insuficiente');
  if (brechaAnio0) riesgos.push('gastos del año 0 sin cobertura financiera declarada');
  if (excesoCapacidad) riesgos.push('demanda no atendible con la capacidad activa');
  if (recP.anios === null) riesgos.push('recuperación de la inversión fuera del horizonte');
  if (N < Math.ceil((recP.anios ?? 0) + 1)) riesgos.push('horizonte menor que recuperación + 1');
  if (!p.mercado.fuentesConsulta?.trim()) riesgos.push('fuentes de mercado sin documentar');
  if (tasaDemo) riesgos.push('tasa tributaria de demostración que condiciona las conclusiones económicas');
  frases.push(
    riesgos.length
      ? `Riesgos y advertencias activas: ${riesgos.join('; ')}. Mientras no se corrijan, el resumen no puede presentarse como una evaluación favorable.`
      : 'El diagnóstico no arroja errores de cálculo ni advertencias críticas bajo los supuestos vigentes; ello no equivale a una validación legal, de mercado ni sanitaria.'
  );
  if (tasaDemo) {
    frases.push(
      `ADVERTENCIA ECONÓMICA: la tasa de impuesto aplicada (${fmtPct(parametro(p, 'tasa_impuesto_utilidades'))}) es un SUPUESTO DE DEMOSTRACIÓN no validado normativamente: la utilidad neta, los flujos FCFF/FCFE, las recuperaciones, los dividendos y los beneficios al país dependen de ella, por lo que las conclusiones económicas quedan CONDICIONADAS a la validación de la tasa legal aplicable.`
    );
  }
  frases.push('Datos pendientes de verificar: tasa tributaria aplicable, tipo de cambio oficial vigente, licencias y autorizaciones, certificaciones de aportes y demanda solvente documentada.');

  return { texto: lista(frases), huella: huellaDe({ inv: ind.inversionTotalKUSD, ap: ind.aportacionesTotalesKUSD, ing: ind.ingresosTotales[1], udi: ind.utilidadNeta[1], recP, recS, bp: ind.beneficiosPaisAcumulados, bpE: ind.beneficiosPaisExplotacion, riesgos, tasaDemo, brechaAnio0, N }) };
}

function analisisConclusiones(p: PlanexProject, m: ComputedModel, pres: PresentacionMonetaria): { texto: string; huella: string } {
  const ind = m.indicadores;
  const N = p.ajustes.horizonteAnios;
  const recP = ind.recuperacionProyecto;
  const errores = m.issues.filter((i) => i.tipo === 'error');
  const advertencias = m.issues.filter((i) => i.tipo === 'inconsistencia');
  const insuficiente = (m.valores['diferencia_financiacion_k']?.[0] ?? 0) < -0.05;
  const excesoCapacidad = m.servicios.some((s) => s.capacidadesExcedidas.length > 0);
  const tasaDemo = p.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')?.demo ?? false;

  const frases: string[] = [];
  frases.push(
    `Sobre los resultados económicos preliminares del modelo: inversión total de ${pres.k(ind.inversionTotalKUSD)} ${pres.largo}, ingresos del año 1 de ${pres.k(ind.ingresosTotales[1] ?? 0)} ${pres.corto}, utilidad después de impuestos de ${pres.k(ind.utilidadNeta[1] ?? 0)} ${pres.corto} y beneficios directos al país acumulados de ${pres.k(ind.beneficiosPaisAcumulados)} ${pres.corto} en ${N} años.`
  );
  frases.push(
    recP.anios !== null && !recP.indeterminado
      ? `El flujo de caja del proyecto recupera la inversión total en ${fmtAnios(recP.anios)} (recuperación simple, sin descontar)${ind.recuperacionSocios.anios !== null && !ind.recuperacionSocios.indeterminado ? `, y el flujo de los socios recupera el capital aportado en ${fmtAnios(ind.recuperacionSocios.anios)}` : ''}. Estos períodos derivan de los flujos vigentes y pueden cambiar al cambiar cualquier supuesto.`
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
    `Estas conclusiones se generan desde el estado actual del modelo de cálculo. ${advertencias.length ? `Persisten ${advertencias.length} advertencia(s) de consistencia` : 'No persisten advertencias de consistencia'}${tasaDemo ? '; además, la tasa de impuesto es un supuesto de demostración que CONDICIONA estas conclusiones: debe validarse normativamente antes de cualquier uso oficial' : ''}. En todo caso, la viabilidad jurídica, sanitaria y de mercado de la propuesta queda sujeta a validaciones externas que este documento no sustituye.`
  );
  return { texto: lista(frases), huella: huellaDe({ inv: ind.inversionTotalKUSD, ing: ind.ingresosTotales[1], udi: ind.utilidadNeta[1], bp: ind.beneficiosPaisAcumulados, recP, recS: ind.recuperacionSocios, bloqueantes, advertencias: advertencias.length, tasaDemo, N }) };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/** Genera TODOS los análisis con sus huellas a partir del modelo actual.
 *  El contexto de presentación es opcional: por defecto reproduce la salida
 *  nativa del motor en kUSD (retrocompatible con todas las pruebas). */
export function generarAnalisis(
  p: PlanexProject,
  m: ComputedModel,
  pres: PresentacionMonetaria = PRESENTACION_NATIVA
): Record<ClaveAnalisis, AnalisisGenerado> {
  return {
    resumen_ejecutivo: analisisResumenEjecutivo(p, m, pres),
    aportaciones: analisisAportaciones(p, m, pres),
    capacidad: analisisCapacidad(p, m, pres),
    inversion_financiacion: analisisInversionFinanciacion(p, m, pres),
    ingresos_costos: analisisIngresosCostos(p, m, pres),
    deuda_depreciacion: analisisDeudaDepreciacion(p, m, pres),
    flujo_recuperacion: analisisFlujoRecuperacion(p, m, pres),
    mercado: analisisMercado(p, m, pres),
    fuerza_trabajo: analisisFuerzaTrabajo(p, m, pres),
    inversiones_cronograma: analisisInversionesCronograma(p, m, pres),
    beneficios_pais: analisisBeneficiosPais(p, m, pres),
    conclusiones: analisisConclusiones(p, m, pres),
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
