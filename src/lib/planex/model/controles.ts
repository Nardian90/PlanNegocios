// ============================================================================
// Controles de consistencia y diagnóstico automático (misión §15).
//
// Distingue CUATRO niveles:
//   error_bloqueante       — el cálculo es inválido o ininterpretable.
//   advertencia_importante — capacidad insuficiente, financiación no cubierta,
//                            recuperación no alcanzada, supuestos críticos.
//   informacion_pendiente  — falta un campo, evidencia o documento.
//   observacion_calidad    — recomendación de mejora (redacción, evidencia,
//                            análisis, presentación).
//
// Cada hallazgo indica qué ocurre, la partida afectada, su origen, la
// consecuencia, la corrección propuesta y si afecta a las conclusiones.
//
// El RESUMEN DE CONTROL evalúa siete dimensiones del plan (integridad
// matemática, coherencia financiera, consistencia operativa, cumplimiento
// estructural, calidad de fuentes, calidad documental y validación legal).
// La completitud formal (porcentaje de campos) NO se usa como prueba de
// calidad: un apartado completo de supuestos sin respaldo no es un apartado
// validado.
// ============================================================================

import { PlanexProject, ComputedModel } from '../types';
import { generarAnalisis, CLAVES_ANALISIS, PresentacionMonetaria, PRESENTACION_NATIVA } from '../engine/analisis';
import { fmtK, fmtAnios, fmtPct } from '../format';

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

export interface ResumenDiagnostico {
  dimensiones: DimensionControl[];
  conteo: Record<NivelHallazgo, number>;
  conclusionesAfectadas: boolean;
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
  CAPACIDAD: { consecuencia: 'Los ingresos por encima de la capacidad no son reales: la proyección queda limitada y la recuperación se recalcula con lo atendible.', correccion: 'Amplíe recursos (escenario B), reduzca demanda prevista o ajuste precios.', afecta: true },
  NO_RECUPERACION: { consecuencia: 'El plan no puede afirmar recuperación de la inversión dentro del horizonte.', correccion: 'Amplíe el horizonte o revise supuestos de ingresos y costos.', afecta: true },
  HORIZONTE_CORTO: { consecuencia: 'Incumple el requisito metodológico de analizar al menos recuperación + 1.', correccion: 'Amplíe el horizonte de análisis.', afecta: true },
  TASA_DEMO: { consecuencia: 'El impuesto y todos los indicadores dependientes descansan en una tasa no validada.', correccion: 'Documente la tasa legal aplicable con su fuente normativa.', afecta: true },
  DATOS_FICTICIOS: { consecuencia: 'El documento es una demostración: no acredita cumplimiento legal, tributario ni sanitario.', correccion: 'Sustituya los datos ficticios por evidencias verificables antes de un uso oficial.', afecta: false },
};

export function diagnosticar(p: PlanexProject, m: ComputedModel, pres: PresentacionMonetaria = PRESENTACION_NATIVA): { hallazgos: Hallazgo[]; resumen: ResumenDiagnostico } {
  const hallazgos: Hallazgo[] = [];

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
        consecuencia: 'Intereses y amortizaciones inválidos.',
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

  if (!p.general.elaboradoPor?.trim()) pendientes('general.elaboradoPor', 'Falta identificar al elaborador del plan (4.1).', '4.1');
  if (!p.general.firmaIdentificacion?.trim() && !p.general.elaboradoPor?.trim())
    pendientes('general.firmaIdentificacion', 'Falta la firma o identificación del elaborador (4.1).', '4.1');
  if (!p.general.declaracionResponsabilidad) pendientes('general.declaracionResponsabilidad', 'La declaración de responsabilidad no ha sido aceptada (4.1).', '4.1');
  if (!p.mercado.fuentesConsulta?.trim()) pendientes('mercado.fuentesConsulta', 'No hay fuentes de mercado documentadas (4.8).', '4.8');
  if (!p.negocio.reglaDistribucion?.trim()) pendientes('negocio.reglaDistribucion', 'No está redactada la regla de distribución de beneficios (4.5).', '4.5');

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

  // ---- 4. Resumen por dimensiones
  const errores = hallazgos.filter((h) => h.nivel === 'error_bloqueante');
  const advertencias = hallazgos.filter((h) => h.nivel === 'advertencia_importante');
  const pend = hallazgos.filter((h) => h.nivel === 'informacion_pendiente');
  const calidadTodas = hallazgos.filter((h) => h.nivel === 'observacion_calidad');
  const calidad = calidadTodas.filter((h) => h.codigo !== 'ANALISIS_REVISAR');

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

  const dims: DimensionControl[] = [
    dim(
      'integridad_matematica',
      'Integridad matemática',
      errores.some((e) => ['SINTAXIS', 'CALCULO', 'DEPENDENCIA_CIRCULAR', 'DEP_EXCESO', 'DEUDA_CONCILIACION', 'DEUDA_NEGATIVA', 'CONCILIACION_INVERSION', 'BENEFICIOS_DESCUADRE'].includes(e.codigo))
        ? 'deficiente'
        : 'ok',
      errores.length ? `${errores.length} error(es) bloqueante(s): ${[...new Set(errores.map((e) => e.codigo))].join(', ')}.` : 'Sin errores de cálculo: todas las reglas evaluaron y las conciliaciones cuadran.'
    ),
    dim(
      'coherencia_financiera',
      'Coherencia financiera',
      advertencias.some((a) => ['FINANCIACION_INSUFICIENTE', 'FLUJO_REGLA_MOTOR', 'PARTICIPACION_INCOHERENTE', 'NO_RECUPERACION', 'HORIZONTE_CORTO'].includes(a.codigo))
        ? 'deficiente'
        : advertencias.some((a) => ['FINANCIACION_EXCESO', 'CT_RECUPERACION'].includes(a.codigo))
          ? 'aceptable'
          : 'ok',
      `Inversión ${pres.k(conCero(inv))} ${pres.corto} vs financiación disponible ${pres.k(conCero(finDisp))} ${pres.corto}; recuperación del proyecto ${recPa === null ? 'no alcanzada en el horizonte' : fmtAnios(recPa)}; socios ${recSa === null ? 'no recuperado en el horizonte' : fmtAnios(recSa)}.`
    ),
    dim(
      'consistencia_operativa',
      'Consistencia operativa',
      m.servicios.some((s) => s.capacidadesExcedidas.length > 0) ? 'deficiente' : m.recursosCalculados.length ? 'ok' : 'aceptable',
      m.servicios.some((s) => s.capacidadesExcedidas.length > 0)
        ? `${m.servicios.filter((s) => s.capacidadesExcedidas.length > 0).length} servicio(s) con demanda no atendible en el escenario activo.`
        : m.recursosCalculados.length
          ? `Capacidad verificada contra ${m.recursosCalculados.length} recurso(s) operativos; ninguna demanda supera la capacidad.`
          : 'Sin recursos operativos definidos: la capacidad no está verificada.'
    ),
    dim(
      'cumplimiento_estructural',
      'Cumplimiento estructural de la metodología',
      pend.some((x) => x.partida === '4.1') || !p.servicios.length ? 'deficiente' : pend.length ? 'aceptable' : 'ok',
      `Apartados 4.1–4.12 ${pend.length ? `con ${pend.length} elemento(s) pendiente(s)` : 'completados formalmente'}. Pendientes: ${[...new Set(pend.map((x) => x.partida ?? ''))].filter(Boolean).join(', ') || '—'}.`
    ),
    dim(
      'calidad_fuentes',
      'Calidad y trazabilidad de las fuentes',
      hallazgos.some((h) => ['TASA_DEMO', 'DATOS_FICTICIOS', 'PENDIENTE'].includes(h.codigo)) ? 'aceptable' : 'ok',
      `${p.parametros.filter((x) => x.demo).length} parámetro(s) marcados como supuesto de demostración; ${p.aportaciones.filter((a) => !a.referenciaDocumental?.trim()).length} aportación(es) sin referencia documental.`
    ),
    dim(
      'calidad_documental',
      'Calidad documental',
      calidad.length ? 'aceptable' : 'ok',
      `Observaciones de calidad: ${calidad.length}; ${hallazgos.filter((h) => h.codigo === 'ANALISIS_REVISAR').length} análisis editados por revisar frente al modelo.`
    ),
    dim(
      'validacion_legal',
      'Estado de validación legal y regulatoria',
      'aceptable',
      'La aplicación NO valida el cumplimiento legal, tributario, sanitario ni de inversión: la estructura documental no equivale a validación normativa. Certificaciones, licencias y tasas aplicables requieren verificación externa documentada.'
    ),
  ];

  const conteo: Record<NivelHallazgo, number> = {
    error_bloqueante: errores.length,
    advertencia_importante: advertencias.length,
    informacion_pendiente: pend.length,
    observacion_calidad: calidadTodas.length,
  };

  return {
    hallazgos,
    resumen: {
      dimensiones: dims,
      conteo,
      conclusionesAfectadas: hallazgos.some((h) => h.afectaConclusiones),
    },
  };
}
