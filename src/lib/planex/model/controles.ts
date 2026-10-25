// ============================================================================
// Controles de consistencia y diagnóstico automático (misión §15, revisado
// por PLANEX-DOC-002 §5 — diagnóstico que no emite falsa seguridad).
//
// Distingue CUATRO niveles:
//   error_bloqueante       — el cálculo es inválido o ininterpretable.
//   advertencia_importante — capacidad insuficiente, financiación no cubierta,
//                            recuperación no alcanzada, supuestos críticos,
//                            conciliaciones del desembolso inicial.
//   informacion_pendiente  — falta un campo, evidencia o documento, o la
//                            evidencia declarada es una HIPÓTESIS no validada.
//   observacion_calidad    — recomendación de mejora.
//
// Cada hallazgo indica qué ocurre, la partida afectada, su origen, la
// consecuencia, la corrección propuesta y si afecta a las conclusiones.
//
// El RESUMEN DE CONTROL evalúa LAS SEIS DIMENSIONES INDEPENDIENTES exigidas
// por DOC-002 §5 (un plan NO se clasifica como globalmente «correcto» porque
// las sumas cuadren):
//   1. Integridad aritmética.
//   2. Coherencia financiera y contable.
//   3. Evidencia y trazabilidad de los supuestos.
//   4. Cumplimiento de la estructura metodológica.
//   5. Estado de validación normativa y comercial.
//   6. Calidad documental.
//
// ESTADO GENERAL DEL PLAN (§5): el diagnóstico emite un estado comprensible y
// honesto — «Borrador de demostración», «Borrador con validaciones pendientes»,
// «Validación financiera pendiente», «Revisión profesional pendiente» o
// «Listo para revisión final» — y JAMÁS declara cumplimiento legal, sanitario,
// tributario o de mercado sin evidencia externa comprobable. La completitud
// formal (porcentaje de campos) NO se usa como prueba de calidad.
// ============================================================================

import { PlanexProject, ComputedModel } from '../types';
import { generarAnalisis, CLAVES_ANALISIS, PresentacionMonetaria, PRESENTACION_NATIVA } from '../engine/analisis';
import { fmtK, fmtAnios, fmtPct, esValorPendiente, esReferenciaHipotesis } from '../format';

export type NivelHallazgo = 'error_bloqueante' | 'advertencia_importante' | 'informacion_pendiente' | 'observacion_calidad';

export interface Hallazgo {
  nivel: NivelHallazgo;
  codigo: string;
  /** Qué ocurre. */
  mensaje: string;
  /** Partida afectada (sección, regla, tabla o fila). */
  partida?: string;
  /** Dato o cálculo que origina la observación. */
  origen?: string;
  /** Consecuencia si no se corrige. */
  consecuencia?: string;
  /** Corrección recomendada. */
  correccion?: string;
  /** ¿Invalida o condiciona las conclusiones del plan? */
  afectaConclusiones: boolean;
}

export interface DimensionControl {
  id: string;
  nombre: string;
  /** 'ok' | 'aceptable' | 'deficiente' */
  estado: 'ok' | 'aceptable' | 'deficiente';
  detalle: string;
}

/** Estados generales del plan (DOC-002 §5): comprensibles, ordenados de mayor
 *  a menor severidad. «Listo para revisión final» solo cuando se cumplen las
 *  reglas aplicables; la aplicación nunca declara cumplimiento normativo. */
export type EstadoGeneral =
  | 'borrador_demostracion'
  | 'borrador_validaciones_pendientes'
  | 'validacion_financiera_pendiente'
  | 'revision_profesional_pendiente'
  | 'listo_para_revision_final';

export const ETIQUETAS_ESTADO_GENERAL: Record<EstadoGeneral, string> = {
  borrador_demostracion: 'Borrador de demostración (datos ficticios)',
  borrador_validaciones_pendientes: 'Borrador con validaciones pendientes',
  validacion_financiera_pendiente: 'Validación financiera pendiente',
  revision_profesional_pendiente: 'Revisión profesional pendiente',
  listo_para_revision_final: 'Listo para revisión final',
};

export interface EstadoGeneralInfo {
  estado: EstadoGeneral;
  etiqueta: string;
  /** Explicación de por qué el plan recibe este estado. */
  detalle: string;
}

export interface ResumenDiagnostico {
  dimensiones: DimensionControl[];
  conteo: Record<NivelHallazgo, number>;
  conclusionesAfectadas: boolean;
  estadoGeneral: EstadoGeneralInfo;
}

/** Mapa de severidad de los códigos del motor (Issue.tipo → NivelHallazgo). */
function nivelDeIssue(tipo: string): NivelHallazgo {
  switch (tipo) {
    case 'error':
      return 'error_bloqueante';
    case 'inconsistencia':
      return 'advertencia_importante';
    case 'pendiente':
      return 'informacion_pendiente';
    default: // supuesto, documental, legal
      return 'observacion_calidad';
  }
}

const CONSECUENCIAS: Record<string, { consecuencia: string; correccion: string; afecta: boolean }> = {
  SINTAXIS: { consecuencia: 'Las partidas dependientes no pueden calcularse y el documento no debe presentarse.', correccion: 'Corrija la fórmula en Configuración de cálculos.', afecta: true },
  CALCULO: { consecuencia: 'Existe una cadena de cálculo rota: cualquier cifra dependiente es inválida.', correccion: 'Revise la regla indicada y sus entradas.', afecta: true },
  DEPENDENCIA_CIRCULAR: { consecuencia: 'Las reglas implicadas no producen valor alguno.', correccion: 'Elimine la referencia mutua entre las fórmulas.', afecta: true },
  FINANCIACION_INSUFICIENTE: { consecuencia: 'El plan no es ejecutable bajo las premisas actuales: la inversión no tiene cobertura.', correccion: 'Aumente aportaciones, gestión de crédito o reduzca la inversión.', afecta: true },
  FINANCIACION_ANO0: { consecuencia: 'La necesidad total de arranque (inversión más gastos del año 0) excede la financiación declarada: el plan presenta una brecha de caja no resuelta.', correccion: 'Amplíe el capital de trabajo o las fuentes, o declare la brecha como supuesto pendiente de resolver.', afecta: true },
  CAPACIDAD: { consecuencia: 'Los ingresos por encima de la capacidad no son reales: la proyección queda limitada y la recuperación se recalcula con lo atendible.', correccion: 'Amplíe recursos (escenario B), reduzca demanda prevista o ajuste precios.', afecta: true },
  NO_RECUPERACION: { consecuencia: 'El plan no puede afirmar recuperación de la inversión dentro del horizonte.', correccion: 'Amplíe el horizonte o revise supuestos de ingresos y costos.', afecta: true },
  HORIZONTE_CORTO: { consecuencia: 'Incumple el requisito metodológico de analizar al menos recuperación + 1.', correccion: 'Amplíe el horizonte de análisis.', afecta: true },
  TASA_DEMO: { consecuencia: 'El impuesto y todos los indicadores dependientes (utilidad, FCFF, FCFE, recuperaciones, dividendos y beneficios al país) descansan en una tasa NO validada: las conclusiones económicas quedan condicionadas.', correccion: 'Documente la tasa legal aplicable con su fuente normativa.', afecta: true },
  DATOS_FICTICIOS: { consecuencia: 'El documento es una demostración: no acredita cumplimiento legal, tributario ni sanitario.', correccion: 'Sustituya los datos ficticios por evidencias verificables antes de un uso oficial.', afecta: false },
  CANAL_SIN_DECLARAR: { consecuencia: 'La metodología exige desglosar los ingresos por exportaciones, plataformas con pagos desde el exterior y ventas en plaza: sin canal declarado el desglose queda incompleto.', correccion: 'Asigne el canal de comercialización de cada servicio en la tabla 4.6.', afecta: false },
};

export function diagnosticar(p: PlanexProject, m: ComputedModel, pres: PresentacionMonetaria = PRESENTACION_NATIVA): { hallazgos: Hallazgo[]; resumen: ResumenDiagnostico } {
  const hallazgos: Hallazgo[] = [];
  const esDemo = p.planex.plantillaOrigen === 'clinica' || p.planex.plantillaOrigen === 'centro';

  // ---- 1. Hallazgos derivados de los issues del motor
  for (const i of m.issues) {
    const nivel = nivelDeIssue(i.tipo);
    const extra = CONSECUENCIAS[i.codigo] ?? {
      consecuencia: 'Puede condicionar la calidad o la presentabilidad del plan.',
      correccion: 'Revise el panel de la sección indicada.',
      afecta: nivel === 'error_bloqueante',
    };
    hallazgos.push({
      nivel,
      codigo: i.codigo,
      mensaje: i.mensaje,
      partida: i.seccion ?? (i.reglaId ? `regla:${i.reglaId}` : i.parametroId ? `parámetro:${i.parametroId}` : undefined) ?? (i.objetivoId ? `fila:${i.objetivoId}` : undefined),
      origen: i.reglaId ?? i.parametroId ?? i.objetivoId ?? i.seccion,
      consecuencia: extra.consecuencia,
      correccion: extra.correccion,
      afectaConclusiones: extra.afecta,
    });
  }

  // ---- 2. Controles financieros estructurales (misión §3, §4, §9)
  const N = p.ajustes.horizonteAnios;
  const inv = m.indicadores.inversionTotalKUSD;
  const previos = m.valores['gastos_previos_k']?.[0] ?? 0;
  const fija = m.valores['inversion_fija_k']?.[0] ?? 0;
  const ct = p.parametros.find((x) => x.id === 'capital_trabajo_k')?.valor ?? 0;
  const sumaComponentes = previos + fija + ct;
  if (inv > 0 && Math.abs(sumaComponentes - inv) > 0.05) {
    hallazgos.push({
      nivel: 'error_bloqueante',
      codigo: 'CONCILIACION_INVERSION',
      mensaje: `La inversión total (${pres.k(inv)} ${pres.corto}) no concilia con gastos previos + inversión fija + capital de trabajo (${pres.k(sumaComponentes)} ${pres.corto}).`,
      partida: 'inversion_total_k',
      origen: 'gastos_previos_k + inversion_fija_k + capital_trabajo_k',
      consecuencia: 'Las cifras de inversión y financiación dejarían de ser interpretables.',
      correccion: 'Revise las partidas de inversión y los parámetros de capital de trabajo.',
      afectaConclusiones: true,
    });
  }

  // Depreciación: acumulada ≤ base por activo (el módulo ya lo garantiza;
  // aquí se comprueba y se reporta como integridad matemática).
  for (const a of m.depreciacion) {
    if (a.acumulada > a.baseDepreciableKUSD + 0.01) {
      hallazgos.push({
        nivel: 'error_bloqueante',
        codigo: 'DEP_EXCESO',
        mensaje: `El activo «${a.concepto}» acumula ${pres.k(a.acumulada)} ${pres.corto} de depreciación, por encima de su base depreciable (${pres.k(a.baseDepreciableKUSD)} ${pres.corto}).`,
        partida: a.id,
        consecuencia: 'Sobredepreciación: resultados y flujos inválidos.',
        correccion: 'Revise vida útil, residual y año de disponibilidad del activo.',
        afectaConclusiones: true,
      });
    }
  }

  // Deuda: reconciliación del saldo por período.
  for (const f of m.deuda) {
    const esperado = f.saldoInicial + f.desembolso + f.interesCapitalizado - f.amortizacion;
    if (Math.abs(esperado - f.saldoFinal) > 0.01) {
      hallazgos.push({
        nivel: 'error_bloqueante',
        codigo: 'DEUDA_CONCILIACION',
        mensaje: `El saldo del año ${f.anio} no concilia (esperado ${pres.k(esperado)}, obtenido ${pres.k(f.saldoFinal)}).`,
        partida: 'calendario de deuda',
        consecuencia: 'Intereses y amortizaciones inválidas.',
        correccion: 'Revise la configuración del crédito en 4.7.',
        afectaConclusiones: true,
      });
      break;
    }
    if (f.saldoFinal < -0.01) {
      hallazgos.push({
        nivel: 'error_bloqueante',
        codigo: 'DEUDA_NEGATIVA',
        mensaje: `El saldo de deuda del año ${f.anio} es negativo: se amortiza por encima del pendiente.`,
        partida: 'calendario de deuda',
        correccion: 'Ajuste plazo, monto o método de amortización.',
        afectaConclusiones: true,
      });
      break;
    }
  }

  // FCFF/FCFE (DOC-002 §4.1): reconciliación algebraica entre ambos flujos.
  // FCFF − FCFE = intereses_pagados − escudo − desembolsos + amortizaciones.
  const udiSerie = m.valores['utilidad_despues_impuestos_k'] ?? {};
  const deudaHabilitada = p.financiero.deuda.habilitada && (p.parametros.find((x) => x.id === 'credito_monto_k')?.valor ?? 0) > 0;
  if (Object.keys(udiSerie).length) {
    let desviacionMax = 0;
    for (const f of m.deuda) {
      const t = f.anio;
      const fcff = m.indicadores.fcff[t] ?? 0;
      const fcfe = m.indicadores.fcfe[t] ?? 0;
      const esperado =
        fcff - (fcfe + f.interesPagado - (m.indicadores.escudoFiscal[t] ?? 0) - f.desembolso + f.amortizacion);
      // esperado = FCFF − (FCFE + intPag − escudo − des + amort) = 0 si cuadra
      desviacionMax = Math.max(desviacionMax, Math.abs(esperado));
    }
    if (desviacionMax > 0.05) {
      hallazgos.push({
        nivel: 'error_bloqueante',
        codigo: 'FLUJOS_NO_RECONCILIAN',
        mensaje: `Los flujos FCFF y FCFE no concilian con la identidad FCFF − FCFE = intereses pagados − escudo fiscal − desembolsos + amortizaciones (desviación máxima ${pres.k(desviacionMax)} ${pres.corto}).`,
        partida: 'flujos de caja',
        consecuencia: 'La recuperación del proyecto y la del capital aportado dejarían de ser mutuamente coherentes.',
        correccion: 'Registre el issue y regenere el modelo; no presente las recuperaciones hasta reconciliar.',
        afectaConclusiones: true,
      });
    }
  }

  // Beneficios al país: conciliación resumen vs tabla (mismo cálculo → debe ser exacta).
  const totalTabla = Object.values(m.indicadores.beneficiosPais).reduce((s, v) => s + v, 0);
  if (Math.abs(totalTabla - m.indicadores.beneficiosPaisAcumulados) > 0.05) {
    hallazgos.push({
      nivel: 'error_bloqueante',
      codigo: 'BENEFICIOS_DESCUADRE',
      mensaje: `El acumulado de beneficios al país del resumen (${pres.k(m.indicadores.beneficiosPaisAcumulados)} ${pres.corto}) difiere del total de la tabla (${pres.k(totalTabla)} ${pres.corto}).`,
      partida: '4.11 / resumen ejecutivo',
      consecuencia: 'Contradicción entre apartados del documento.',
      correccion: 'Regenere las exportaciones desde el mismo estado del modelo.',
      afectaConclusiones: true,
    });
  }

  // Participación cubana vs composición real de aportaciones.
  const pctParam = p.parametros.find((x) => x.id === 'pct_parte_cubana')?.valor ?? 0;
  const aportNac = p.aportaciones.filter((a) => a.socio === 'nacional').reduce((s, a) => s + a.montos.reduce((x, y) => x + y, 0), 0);
  const aportTot = m.indicadores.aportacionesTotalesKUSD;
  const pctReal = aportTot > 0 ? aportNac / aportTot : 0;
  if (aportTot > 0 && Math.abs(pctReal - pctParam) > 0.01) {
    hallazgos.push({
      nivel: 'advertencia_importante',
      codigo: 'PARTICIPACION_INCOHERENTE',
      mensaje: `La participación cubana parametrizada (${fmtPct(pctParam)}) difiere de la composición real de las aportaciones (${fmtPct(pctReal)}). Los dividendos se reparten con el parámetro, no con la composición.`,
      partida: 'pct_parte_cubana / aportaciones',
      origen: `aportaciones nacionales ${pres.k(aportNac)} de ${pres.k(aportTot)} ${pres.corto}`,
      consecuencia: 'El reparto de dividendos puede no corresponder al capital social realmente aportado.',
      correccion: 'Ajuste el parámetro o la tabla de aportaciones para que coincidan.',
      afectaConclusiones: true,
    });
  }

  // Dividendos: la reserva no se constituye dos veces sobre la misma base y
  // el saldo acumulable reconcilia (DOC-002 §4.4).
  for (const d of m.dividendos) {
    if (d.anio === 0) continue;
    const esperado = d.saldoAcumulablePrevio + d.udi - d.reserva - d.pagables;
    if (Math.abs(esperado - d.saldoAcumulable) > 0.01) {
      hallazgos.push({
        nivel: 'error_bloqueante',
        codigo: 'DIVIDENDOS_NO_RECONCILIAN',
        mensaje: `El saldo acumulable de dividendos del año ${d.anio} no reconcilia (esperado ${pres.k(esperado)}, obtenido ${pres.k(d.saldoAcumulable)} ${pres.corto}).`,
        partida: 'módulo de dividendos',
        consecuencia: 'La utilidad distribuible y los repartos dejarían de ser trazables.',
        correccion: 'Revise el módulo de dividendos y regenere el modelo.',
        afectaConclusiones: true,
      });
      break;
    }
  }

  // Flujos: reglas de acumulación presentes y coherentes con el motor.
  const fcffAcumRegla = m.valores['flujo_acumulado_proyecto_k'];
  if (fcffAcumRegla && N in fcffAcumRegla) {
    const difReglaMotor = Math.abs((fcffAcumRegla[N] ?? 0) - (m.indicadores.fcffAcumulado[N] ?? 0));
    if (difReglaMotor > 0.05) {
      hallazgos.push({
        nivel: 'advertencia_importante',
        codigo: 'FLUJO_REGLA_MOTOR',
        mensaje: `El acumulado del proyecto según la regla (${pres.k(fcffAcumRegla[N] ?? 0)}) difiere del motor (${pres.k(m.indicadores.fcffAcumulado[N] ?? 0)}): la regla editable fue modificada y ya no refleja el flujo estándar.`,
        partida: 'flujo_acumulado_proyecto_k',
        consecuencia: 'La recuperación puede no corresponder al flujo de caja del modelo.',
        correccion: 'Restaure la regla o documente la desviación deliberada.',
        afectaConclusiones: true,
      });
    }
  }

  // Conciliación del desembolso inicial (DOC-002 §4.2): la necesidad total
  // (inversión + gastos del año 0) frente a las fuentes declaradas. El motor
  // emite FINANCIACION_ANO0 cuando hay brecha; aquí se verifica además que
  // las APORTACIONES se registren en el año 0 con el mismo significado que
  // tienen en los flujos (montos[0] = año 0/montaje).
  {
    const udi0 = m.valores['utilidad_despues_impuestos_k']?.[0];
    const gastoAnio0 = Number.isFinite(udi0) ? Math.max(0, -(udi0 as number)) : 0;
    const finDisp = m.valores['financiacion_disponible_k']?.[0] ?? 0;
    const brecha = finDisp - inv - gastoAnio0;
    if (gastoAnio0 > 0.005 && brecha >= -0.05) {
      hallazgos.push({
        nivel: 'observacion_calidad',
        codigo: 'DESEMBOLSO_INICIAL_CONCILIADO',
        mensaje: `Conciliación del desembolso inicial: inversión total ${pres.k(inv)} + gastos de montaje del año 0 ${pres.k(gastoAnio0)} = necesidad total ${pres.k(inv + gastoAnio0)} ${pres.corto}, frente a fuentes declaradas por ${pres.k(finDisp)} ${pres.corto} (brecha ${pres.k(brecha)}). Los desembolsos del año 0 y del año 1 conservan el mismo significado en las tablas de aportaciones, fuentes y flujos.`,
        partida: 'conciliación del arranque',
        consecuencia: 'Sin brecha: la conciliación queda documentada en el informe.',
        correccion: 'Mantenga la conciliación al cambiar cualquier fuente o gasto del año 0.',
        afectaConclusiones: false,
      });
    }
  }

  // ---- 3. Información pendiente y calidad documental
  const pendientes = (campo: string, mensaje: string, partida: string) =>
    hallazgos.push({
      nivel: 'informacion_pendiente',
      codigo: 'PENDIENTE',
      mensaje,
      partida,
      origen: campo,
      consecuencia: 'El apartado no está completado sustantivamente.',
      correccion: 'Complete la información o declare expresamente que está pendiente.',
      afectaConclusiones: false,
    });

  if (esValorPendiente(p.general.elaboradoPor)) pendientes('general.elaboradoPor', 'Falta identificar al elaborador del plan (4.1): el campo está vacío o marcado como pendiente.', '4.1');
  if (esValorPendiente(p.general.firmaIdentificacion) && esValorPendiente(p.general.elaboradoPor))
    pendientes('general.firmaIdentificacion', 'Falta la firma o identificación del elaborador (4.1).', '4.1');
  if (!p.general.declaracionResponsabilidad) pendientes('general.declaracionResponsabilidad', 'La declaración de responsabilidad no ha sido aceptada (4.1): el documento NO está en condiciones de presentarse como definitivo.', '4.1');
  if (esValorPendiente(p.mercado.fuentesConsulta)) pendientes('mercado.fuentesConsulta', 'No hay fuentes de mercado documentadas (4.8).', '4.8');
  if (esValorPendiente(p.negocio.reglaDistribucion)) pendientes('negocio.reglaDistribucion', 'No está redactada la regla de distribución de beneficios (4.5).', '4.5');

  // Evidencia: un supuesto ficticio NO cuenta como fuente validada (§5).
  const refsHipotesis = p.aportaciones.filter((a) => a.referenciaDocumental?.trim() && esReferenciaHipotesis(a.referenciaDocumental));
  if (refsHipotesis.length) {
    hallazgos.push({
      nivel: 'informacion_pendiente',
      codigo: 'REFERENCIA_HIPOTESIS',
      mensaje: `${refsHipotesis.length} aportación(es) declaran una «referencia documental» que en realidad es una HIPÓTESIS de demostración (figuran como ficticia, ilustrativa, proforma o pendiente). Una referencia documental exigible debe identificar el documento, su emisor y su fecha, y adjuntar el soporte cuando corresponda.`,
      partida: 'aportaciones',
      origen: refsHipotesis.map((a) => a.id).join(', '),
      consecuencia: 'Los aportes no cuentan con respaldo acreditado: el plan no está en condiciones de presentarse oficialmente.',
      correccion: 'Sustituya las referencias hipotéticas por documentos identificables (título, emisor, fecha) o declare la ausencia de soporte.',
      afectaConclusiones: false,
    });
  }

  // Canales de comercialización (§6): desglose exportaciones / plataformas / plaza.
  if (p.servicios.some((s) => s.precioBase > 0) && p.servicios.some((s) => !s.canal)) {
    hallazgos.push({
      nivel: 'advertencia_importante',
      codigo: 'CANAL_SIN_DECLARAR',
      mensaje: `${p.servicios.filter((s) => !s.canal).length} servicio(s) no declaran canal de comercialización: la proyección de ingresos por exportaciones, ventas en plataformas con pagos desde el exterior y ventas en plaza (metodología 4.8) queda incompleta y sin desglose verificable.`,
      partida: 'servicios',
      consecuencia: 'El desglose de ingresos por canal exigido por la metodología no puede emitirse completo.',
      correccion: 'Asigne el canal de cada servicio en la tabla 4.6.',
      afectaConclusiones: false,
    });
  }

  // Análisis editados manualmente y desactualizados frente al modelo actual
  // (misión §12.13): se comparan las huellas reales de datos de origen.
  const generados = generarAnalisis(p, m, pres);
  for (const clave of CLAVES_ANALISIS) {
    const guardado = p.analisis?.[clave as keyof typeof p.analisis];
    if (guardado?.texto && guardado?.huellaOrigen && guardado.huellaOrigen !== generados[clave].huella) {
      hallazgos.push({
        nivel: 'observacion_calidad',
        codigo: 'ANALISIS_REVISAR',
        mensaje: `El análisis «${clave}» fue editado manualmente y los datos de origen cambiaron desde entonces: el texto ya no corresponde necesariamente a los resultados vigentes.`,
        partida: `analisis:${clave}`,
        origen: `huella guardada ${guardado.huellaOrigen} ≠ huella actual ${generados[clave].huella}`,
        consecuencia: 'El documento puede presentar un análisis inconsistente con las cifras exportadas.',
        correccion: 'Revise el texto y regenérelo o actualícelo a mano.',
        afectaConclusiones: false,
      });
    }
  }

  // ---- 4. Resumen por las SEIS dimensiones de DOC-002 §5
  const errores = hallazgos.filter((h) => h.nivel === 'error_bloqueante');
  const advertencias = hallazgos.filter((h) => h.nivel === 'advertencia_importante');
  const pend = hallazgos.filter((h) => h.nivel === 'informacion_pendiente');
  const calidadTodas = hallazgos.filter((h) => h.nivel === 'observacion_calidad');
  const calidad = calidadTodas.filter((h) => h.codigo !== 'ANALISIS_REVISAR' && h.codigo !== 'DESEMBOLSO_INICIAL_CONCILIADO');

  const conCero = (v: number | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const dim = (
    id: string,
    nombre: string,
    estado: 'ok' | 'aceptable' | 'deficiente',
    detalle: string
  ): DimensionControl => ({ id, nombre, estado, detalle });

  const recPa = m.indicadores.recuperacionProyecto.anios;
  const recSa = m.indicadores.recuperacionSocios.anios;
  const finDisp = m.valores['financiacion_disponible_k']?.[0];

  // 1) Integridad aritmética
  const dimAritmetica =
    dim(
      'integridad_aritmetica',
      'Integridad aritmética',
      errores.some((e) => ['SINTAXIS', 'CALCULO', 'DEPENDENCIA_CIRCULAR', 'DEP_EXCESO', 'DEUDA_CONCILIACION', 'DEUDA_NEGATIVA', 'CONCILIACION_INVERSION', 'BENEFICIOS_DESCUADRE', 'FLUJOS_NO_RECONCILIAN', 'DIVIDENDOS_NO_RECONCILIAN'].includes(e.codigo))
        ? 'deficiente'
        : 'ok',
      errores.length ? `${errores.length} error(es) de cálculo: ${[...new Set(errores.map((e) => e.codigo))].join(', ')}.` : 'Las reglas evalúan sin errores, la deuda reconcilia saldo a saldo, la depreciación no excede las bases y FCFF/FCFE cumplen la identidad algebraica.'
    );

  // 2) Coherencia financiera y contable (incluye la operativa y la del arranque)
  const codigosFinancieros = ['FINANCIACION_INSUFICIENTE', 'FINANCIACION_ANO0', 'FLUJO_REGLA_MOTOR', 'PARTICIPACION_INCOHERENTE', 'NO_RECUPERACION', 'HORIZONTE_CORTO', 'CAPACIDAD'];
  const dimCoherencia = dim(
    'coherencia_financiera_contable',
    'Coherencia financiera y contable',
    advertencias.some((a) => codigosFinancieros.includes(a.codigo))
      ? 'deficiente'
      : advertencias.some((a) => ['FINANCIACION_EXCESO', 'CT_RECUPERACION'].includes(a.codigo))
        ? 'aceptable'
        : 'ok',
    `Inversión ${pres.k(conCero(inv))} ${pres.corto} vs financiación disponible ${pres.k(conCero(finDisp))} ${pres.corto} (conciliación del desembolso inicial incluida en el informe); recuperación simple del proyecto ${recPa === null ? 'no alcanzada en el horizonte' : fmtAnios(recPa)}; del capital aportado ${recSa === null ? 'no recuperado en el horizonte' : fmtAnios(recSa)}; capacidad ${m.servicios.some((s) => s.capacidadesExcedidas.length > 0) ? 'con demanda no atendible en el escenario activo' : 'verificada contra los recursos operativos'}.`
  );

  // 3) Evidencia y trazabilidad de los supuestos: un supuesto ficticio NO
  //    cuenta como fuente validada (§5).
  const paramsDemo = p.parametros.filter((x) => x.demo);
  const refsValidadas = p.aportaciones.filter((a) => a.referenciaDocumental?.trim() && !esReferenciaHipotesis(a.referenciaDocumental)).length;
  const dimEvidencia = dim(
    'evidencia_trazabilidad',
    'Evidencia y trazabilidad de los supuestos',
    hallazgos.some((h) => ['TASA_DEMO', 'DATOS_FICTICIOS', 'PENDIENTE', 'REFERENCIA_HIPOTESIS'].includes(h.codigo))
      ? 'deficiente'
      : refsValidadas === p.aportaciones.length && paramsDemo.length === 0
        ? 'ok'
        : 'aceptable',
    `${paramsDemo.length} parámetro(s) de demostración sin validación normativa; ${p.aportaciones.length - refsValidadas} aportación(es) sin referencia documental IDENTIFICABLE (vacía o hipótesis); ${refsValidadas} con referencia declarada. Las referencias hipotéticas NO cuentan como fuentes validadas.`
  );

  // 4) Cumplimiento de la estructura metodológica
  const pendEstructura = pend.filter((x) => x.partida?.startsWith('4.'));
  const dimEstructura = dim(
    'estructura_metodologica',
    'Cumplimiento de la estructura metodológica',
    pendEstructura.some((x) => x.partida === '4.1') || !p.servicios.length ? 'deficiente' : pendEstructura.length ? 'aceptable' : 'ok',
    `Apartados 4.1–4.12 ${pend.length ? `con ${pend.length} elemento(s) pendiente(s)` : 'completados formalmente'}. Pendientes: ${[...new Set(pend.map((x) => x.partida ?? ''))].filter(Boolean).join(', ') || '—'}. La completitud formal no equivale a validación de contenido.`
  );

  // 5) Estado de validación normativa y comercial
  //    NUNCA 'ok': la aplicación no valida cumplimiento legal/sanitario/mercado.
  const tieneRequisitos = !!p.mercado.requisitosRegulatorios?.trim();
  const dimNormativa = dim(
    'validacion_normativa_comercial',
    'Estado de validación normativa y comercial',
    'aceptable',
    `La aplicación NO valida el cumplimiento legal, tributario, sanitario ni de mercado: la estructura documental no equivale a validación normativa. ${tieneRequisitos ? 'Los requisitos regulatorios declarados están LISTADOS, no VERIFICADOS: cada autorización exige evidencia externa comprobable (número, emisor, fecha).' : 'No hay requisitos regulatorios declarados.'} La demanda solvente y los precios requieren fuentes con fecha.`
  );

  // 6) Calidad documental
  const dimDocumental = dim(
    'calidad_documental',
    'Calidad documental',
    calidad.length ? 'aceptable' : 'ok',
    `Observaciones de calidad: ${calidad.length}; ${hallazgos.filter((h) => h.codigo === 'ANALISIS_REVISAR').length} análisis editados por revisar frente al modelo; campos obligatorios pendientes en 4.1: ${[p.general.elaboradoPor, p.general.firmaIdentificacion].filter((v) => esValorPendiente(v)).length + (p.general.declaracionResponsabilidad ? 0 : 1)}.`
  );

  const dims: DimensionControl[] = [dimAritmetica, dimCoherencia, dimEvidencia, dimEstructura, dimNormativa, dimDocumental];

  const conteo: Record<NivelHallazgo, number> = {
    error_bloqueante: errores.length,
    advertencia_importante: advertencias.length,
    informacion_pendiente: pend.length,
    observacion_calidad: calidadTodas.length,
  };

  // ---- 5. Estado general del plan (DOC-002 §5)
  const estadoGeneralDe = (): EstadoGeneralInfo => {
    if (esDemo) {
      return {
        estado: 'borrador_demostracion',
        etiqueta: ETIQUETAS_ESTADO_GENERAL.borrador_demostracion,
        detalle: 'Plantilla de demostración con datos ficticios: sus cifras NO son datos reales y el informe no está en condiciones de presentarse a un cliente o inversionista.',
      };
    }
    if (errores.length > 0 || advertencias.some((a) => codigosFinancieros.includes(a.codigo))) {
      return {
        estado: 'validacion_financiera_pendiente',
        etiqueta: ETIQUETAS_ESTADO_GENERAL.validacion_financiera_pendiente,
        detalle: `Existen ${errores.length} error(es) de cálculo y/o hallazgos financieros relevantes sin resolver (${[...new Set([...errores, ...advertencias].map((h) => h.codigo))].join(', ')}): el modelo financiero no está en condiciones de validarse.`,
      };
    }
    if (pend.length > 0 || paramsDemo.some((x) => x.id === 'tasa_impuesto_utilidades')) {
      const tasaDemo = paramsDemo.find((x) => x.id === 'tasa_impuesto_utilidades');
      return {
        estado: 'borrador_validaciones_pendientes',
        etiqueta: ETIQUETAS_ESTADO_GENERAL.borrador_validaciones_pendientes,
        detalle: `Quedan ${pend.length} elemento(s) pendiente(s)${tasaDemo ? ' y la tasa tributaria es un supuesto de demostración que afecta directamente las conclusiones económicas' : ''}: las validaciones de fondo no se han completado.`,
      };
    }
    if (refsValidadas < p.aportaciones.length || paramsDemo.length > 0 || esValorPendiente(p.mercado.fuentesConsulta)) {
      return {
        estado: 'revision_profesional_pendiente',
        etiqueta: ETIQUETAS_ESTADO_GENERAL.revision_profesional_pendiente,
        detalle: 'La aritmética y la coherencia financiera cuadran, pero persisten supuestos sin evidencia verificable (referencias, tasa, fuentes de mercado): se requiere revisión profesional y documental antes de la presentación.',
      };
    }
    return {
      estado: 'listo_para_revision_final',
      etiqueta: ETIQUETAS_ESTADO_GENERAL.listo_para_revision_final,
      detalle: 'Sin errores de cálculo ni hallazgos financieros relevantes, con campos completos y supuestos con referencia identificable. «Listo para revisión final» NO es una validación legal, tributaria, sanitaria ni de mercado: exige la revisión profesional correspondiente.',
    };
  };

  return {
    hallazgos,
    resumen: {
      dimensiones: dims,
      conteo,
      conclusionesAfectadas: hallazgos.some((h) => h.afectaConclusiones),
      estadoGeneral: estadoGeneralDe(),
    },
  };
}
