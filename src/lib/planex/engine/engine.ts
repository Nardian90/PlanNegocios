// ============================================================================
// Motor de cálculo PLANEX — única fuente de verdad para interfaz,
// validaciones, análisis, previsualización, PDF y Excel.
//
// Fases:
//  1. Parseo de reglas (errores de sintaxis → issues). El prefijo «mtr_» está
//     reservado para las variables del motor estructural.
//  2. Motor estructural (misión §5–§8): calendario de depreciación por activo,
//     calendario de deuda, CAPEX de ampliaciones y recuperación del capital
//     de trabajo — todos derivados de datos y parámetros, nunca de cifras
//     fijas.
//  3. Grafo de dependencias por ámbito + orden topológico + detección de
//     ciclos (las auto-referencias vía LAG son recurrencias legítimas).
//  4. Evaluación por año:
//       a) reglas de servicio SIN variables del motor (demanda, precios…);
//       b) capacidad del año (recursos compartidos, escenario A/B);
//       c) reglas de servicio restantes (limitadas por capacidad);
//       d) reglas de personal y de año (con variables mtr_ y cálculo perezoso
//          de FCFF/FCFE y dividendos, que dependen de la utilidad del período).
//  5. Indicadores: recuperación del proyecto (FCFF) y del capital aportado
//     (FCFE) con interpolación lineal, dividendos, beneficios al país
//     conciliados, fuerza de trabajo.
//  6. Emisión de issues (errores, inconsistencias, pendientes, supuestos).
//
// Principio de la misión PLANEX-AUDIT-001: ninguna partida final está
// escrita en el código; todas derivan de entradas, parámetros y reglas.
// ============================================================================

import {
  PlanexProject,
  Regla,
  ComputedModel,
  Issue,
  EstadoRegla,
  ServicioCalculado,
  Indicadores,
  Recuperacion,
  DividendosAnio,
  CapacidadServicio,
  RecursoCalculado,
  ADVERTENCIA_DATOS_FICTICIOS,
  InversionRow,
} from '../types';
import { parsear, Nodo, extraerVariables, extraerLags } from './parser';
import { evalNodo, EvalContexto, Valor } from './evaluator';
import { FormulaError } from './tokenizer';
import { fmtK, fmtPct } from '../format';
import { calcularDepreciacion } from './depreciacion';
import { calcularDeuda } from './deuda';
import { capacidadAnio, ampliacionesActivas } from './capacidad';
import { calcularRecuperacion, acumular } from './flujos';

const CAMPOS_SERVICIO: Record<string, (s: PlanexProject['servicios'][number]) => Valor> = {
  precio_base: (s) => s.precioBase,
  cantidad_base_mensual: (s) => s.cantidadBaseMensual,
  anio_inicio_demanda: (s) => (Number.isFinite(s.anioInicioDemanda) && s.anioInicioDemanda >= 1 ? s.anioInicioDemanda : 1),
  capacidad_max_mensual: (s) => s.capacidadMaxMensual,
  costo_variable_unitario: (s) => s.costoVariableUnitario,
  duracion_minutos: (s) => s.duracionMinutos,
};

const CAMPOS_PERSONAL: Record<string, (p: PlanexProject['personal'][number]) => Valor> = {
  cantidad: (p) => p.cantidad,
  salario_promedio_anual: (p) => p.salarioPromedioAnualCUP,
  etapa_personal: (p) => p.etapa,
  grupo_personal: (p) => p.grupo,
};

const CAMPOS_APORTACION: Record<string, (a: PlanexProject['aportaciones'][number]) => Valor> = {
  monto_aportacion: (a) => a.montos.reduce((x, y) => x + (Number.isFinite(y) ? y : 0), 0),
  socio_aportacion: (a) => a.socio,
  tipo_aportacion: (a) => a.tipo,
};

const CAMPOS_INVERSION: Record<string, (i: PlanexProject['financiero']['inversion'][number]) => Valor> = {
  monto_inv: (i) => i.monto,
  categoria_inv: (i) => i.categoria,
  moneda_inv: (i) => i.moneda,
  vida_util_inv: (i) => i.vidaUtilAnios,
  anio_disponible_inv: (i) => i.anioDisponible,
  residual_inv: (i) => i.valorResidualPct,
};

const PREFIJO_MOTOR = 'mtr_';

/** Orden topológico por ámbito. Devuelve ciclos detectados. */
function ordenarAmbito(
  reglas: Regla[],
  asts: Map<string, Nodo>,
  universo: Set<string>
): { orden: string[]; ciclos: string[] } {
  const ids = reglas.map((r) => r.id);
  const idSet = new Set(ids);
  const deps = new Map<string, Set<string>>();
  const selfCiclo: string[] = [];
  for (const r of reglas) {
    const ast = asts.get(r.id);
    if (!ast) continue;
    const todas = extraerVariables(ast);
    const lags = new Set(extraerLags(ast));
    const d = new Set<string>();
    for (const v of todas) {
      if (!universo.has(v) || !idSet.has(v)) continue;
      if (v === r.id) {
        if (!lags.has(v)) selfCiclo.push(r.id);
        continue;
      }
      d.add(v);
    }
    deps.set(r.id, d);
  }
  const orden: string[] = [];
  const visitados = new Set<string>();
  let progreso = true;
  while (progreso) {
    progreso = false;
    for (const id of ids) {
      if (visitados.has(id)) continue;
      let listo = true;
      for (const dep of deps.get(id) ?? []) {
        if (!visitados.has(dep)) {
          listo = false;
          break;
        }
      }
      if (listo) {
        visitados.add(id);
        orden.push(id);
        progreso = true;
      }
    }
  }
  const restantes = ids.filter((id) => !visitados.has(id));
  return { orden, ciclos: [...new Set([...selfCiclo, ...restantes])] };
}

export function computeProject(proyecto: PlanexProject): ComputedModel {
  const N = Math.max(1, Math.min(30, Math.trunc(proyecto.ajustes?.horizonteAnios ?? 10)));
  const years: number[] = Array.from({ length: N + 1 }, (_, i) => i);
  const issues: Issue[] = [];
  const valores: Record<string, Record<number, number>> = {};
  const estados: Record<string, EstadoRegla> = {};

  const paramMap = new Map(proyecto.parametros.map((p) => [p.id, p]));
  const reglaMap = new Map(proyecto.reglas.map((r) => [r.id, r]));
  const activas = proyecto.reglas.filter((r) => r.habilitada);

  const valorParam = (nombre: string): number | undefined => paramMap.get(nombre)?.valor;

  // ------------------------------------------------- 0. Motor estructural
  const tipoCambio = Math.max(1, valorParam('tipo_cambio') ?? 1);
  const capitalTrabajo = Number.isFinite(valorParam('capital_trabajo_k')) ? valorParam('capital_trabajo_k')! : 0;
  const pctRecuperacionCT = Math.min(1, Math.max(0, valorParam('pct_recuperacion_capital_trabajo') ?? 0));
  const escenario = proyecto.tecnico?.escenarioCapacidad ?? 'A_constante';

  // Ampliaciones del escenario B: CAPEX por año y activos depreciables.
  const { capexPorAnio: capexAmp, ampliaciones: activosAmp } = ampliacionesActivas(
    proyecto.recursos ?? [],
    escenario,
    N
  );

  // Registro de activos depreciables: inversiones fijas + ampliaciones (esc. B).
  const filasActivos: InversionRow[] = [
    ...(proyecto.financiero?.inversion ?? []).map((r) => ({ ...r })),
    ...activosAmp.map<InversionRow>((a) => ({
      id: a.id,
      concepto: a.concepto,
      categoria: 'inversion_fija',
      moneda: 'USD',
      monto: a.costoKUSD,
      vidaUtilAnios: a.vidaUtilAnios,
      anioDisponible: a.anioDisponible,
      valorResidualPct: 0,
      metodoDepreciacion: 'lineal',
      observacion: 'Ampliación de capacidad (escenario B)',
    })),
  ];
  const dep = calcularDepreciacion({ inversion: filasActivos, horizonteAnios: N, tipoCambio });
  for (const msg of dep.issues) {
    issues.push({ tipo: 'inconsistencia', codigo: 'DEPRECIACION', mensaje: msg, seccion: 'inversiones' });
  }

  // Calendario de deuda.
  const deuda = calcularDeuda({
    config: proyecto.financiero?.deuda ?? { habilitada: false, anioDesembolso: 0, tipoGracia: 'principal', metodo: 'capital_constante', fuente: '' },
    montoKUSD: valorParam('credito_monto_k') ?? 0,
    tasaInteres: valorParam('tasa_interes') ?? 0,
    periodoGracia: valorParam('periodo_gracia') ?? 0,
    plazoAmortizacion: valorParam('plazo_amortizacion') ?? 1,
    horizonteAnios: N,
  });
  for (const msg of deuda.issues) {
    issues.push({ tipo: 'inconsistencia', codigo: 'DEUDA', mensaje: msg, seccion: 'financiero' });
  }
  const filaDeuda = (t: number) => deuda.filas[Math.min(t, deuda.filas.length - 1)];

  const motorAnio: Record<string, Record<number, number>> = {
    mtr_depreciacion_k: dep.totalPorAnio,
    mtr_amortizacion_k: Object.fromEntries(years.map((t) => [t, filaDeuda(t).amortizacion])),
    mtr_interes_devengado_k: Object.fromEntries(years.map((t) => [t, filaDeuda(t).interesDevengado])),
    mtr_interes_pagado_k: Object.fromEntries(years.map((t) => [t, filaDeuda(t).interesPagado])),
    mtr_saldo_deuda_k: Object.fromEntries(years.map((t) => [t, filaDeuda(t).saldoFinal])),
    mtr_desembolso_credito_k: Object.fromEntries(years.map((t) => [t, filaDeuda(t).desembolso])),
    mtr_capex_ampliaciones_k: capexAmp,
    mtr_recuperacion_ct_k: Object.fromEntries(years.map((t) => [t, t === N ? pctRecuperacionCT * capitalTrabajo : 0])),
  };

  // ------------------------------------------------------------- 1. Parseo
  const asts = new Map<string, Nodo>();
  for (const r of activas) {
    if (r.id.startsWith(PREFIJO_MOTOR)) {
      issues.push({
        tipo: 'error',
        codigo: 'PREFIJO_RESERVADO',
        mensaje: `El identificador «${r.id}» usa el prefijo reservado «${PREFIJO_MOTOR}» del motor estructural. Renombre la regla.`,
        reglaId: r.id,
        seccion: 'config',
      });
      continue;
    }
    try {
      asts.set(r.id, parsear(r.expresion));
    } catch (e) {
      const err = e as FormulaError;
      estados[r.id] = { id: r.id, ok: false, error: err.message ?? String(e), refs: [], params: [] };
      issues.push({
        tipo: 'error',
        codigo: 'SINTAXIS',
        mensaje: `Regla «${r.nombre}» (${r.id}): ${err.message}`,
        reglaId: r.id,
        seccion: 'config',
      });
    }
  }
  for (const r of activas) {
    const ast = asts.get(r.id);
    if (!ast) continue;
    const lags = extraerLags(ast);
    if (lags.length > 0 && r.ambito !== 'anio') {
      issues.push({
        tipo: 'error',
        codigo: 'LAG_AMBITO',
        mensaje: `Regla «${r.nombre}»: LAG solo puede usarse en reglas de ámbito anual.`,
        reglaId: r.id,
        seccion: 'config',
      });
    }
  }

  // --------------------------------------------- 2. Grafo y orden topológico
  const porAmbito = (a: Regla['ambito']) => activas.filter((r) => r.ambito === a && asts.has(r.id));
  const universe = (rs: Regla[]) => new Set(rs.map((r) => r.id));
  const ordServicio = ordenarAmbito(porAmbito('servicio'), asts, universe(porAmbito('servicio')));
  const ordPersonal = ordenarAmbito(porAmbito('personal'), asts, universe(porAmbito('personal')));
  const ordProyecto = ordenarAmbito(porAmbito('proyecto'), asts, universe(porAmbito('proyecto')));
  const ordAnio = ordenarAmbito(porAmbito('anio'), asts, universe(porAmbito('anio')));
  for (const [amb, res] of [
    ['servicio', ordServicio],
    ['personal', ordPersonal],
    ['proyecto', ordProyecto],
    ['anio', ordAnio],
  ] as const) {
    if (res.ciclos.length > 0) {
      issues.push({
        tipo: 'error',
        codigo: 'DEPENDENCIA_CIRCULAR',
        mensaje: `Dependencia circular entre reglas de ámbito ${amb}: ${res.ciclos.join(' ↔ ')}. Revise las fórmulas para eliminar el ciclo.`,
        seccion: 'config',
      });
    }
  }

  // Fase de reglas de servicio: las que no usan (transitivamente) variables
  // del motor se evalúan primero; la capacidad del año se resuelve después.
  const usaMotor = (id: string, memo: Map<string, boolean>): boolean => {
    if (memo.has(id)) return memo.get(id)!;
    const ast = asts.get(id);
    if (!ast) return false;
    memo.set(id, true); // guarda temporal contra ciclos
    let usa = [...extraerVariables(ast)].some((v) => v.startsWith(PREFIJO_MOTOR));
    if (!usa) {
      for (const v of extraerVariables(ast)) {
        if (usaMotor(v, memo)) {
          usa = true;
          break;
        }
      }
    }
    memo.set(id, usa);
    return usa;
  };
  const memoFase = new Map<string, boolean>();
  const fase1Servicio = ordServicio.orden.filter((id) => !usaMotor(id, memoFase));
  const fase2Servicio = ordServicio.orden.filter((id) => usaMotor(id, memoFase));

  // ------------------------------------------------- contexto de resolución
  const otrosIngresos = (t: number): number => {
    if (t <= 0) return 0;
    const v = proyecto.financiero?.otrosIngresos?.[t - 1];
    return Number.isFinite(v) ? v : 0;
  };

  /** Resolver para reglas de ámbito proyecto. */
  const resolverProyecto = (t: number) => (nombre: string, pos: number): Valor => {
    if (nombre === 'MESES_ANIO') return 12;
    if (nombre === 'PERIODO' || nombre === 'PERIODOS') {
      throw new FormulaError(`"${nombre}" no está disponible en reglas de ámbito proyecto`, pos);
    }
    if (nombre.startsWith(PREFIJO_MOTOR)) {
      throw new FormulaError(
        `Las variables del motor (${PREFIJO_MOTOR}*) son de ámbito anual o de servicio; no pueden usarse en reglas de ámbito proyecto`,
        pos
      );
    }
    const p = valorParam(nombre);
    if (p !== undefined) return p;
    const r = reglaMap.get(nombre);
    if (r && r.ambito === 'proyecto') {
      if (!r.habilitada) throw new FormulaError(`La partida "${nombre}" está deshabilitada`, pos);
      if (!(nombre in valores)) throw new FormulaError(`La partida "${nombre}" no pudo calcularse por un error previo`, pos);
      return valores[nombre][0];
    }
    if (r) throw new FormulaError(`La partida "${nombre}" pertenece a otro ámbito y no puede referenciarse aquí`, pos);
    throw new FormulaError(`Variable no definida: "${nombre}"`, pos);
  };

  // ---------- Estado perezoso de flujos y dividendos (necesitan la UDI)
  const fcffCache: Record<number, number> = {};
  const fcfeCache: Record<number, number> = {};
  const fcfeAcumCache: Record<number, number> = {};
  const dividendosPasos: Record<number, DividendosAnio> = {};
  let dividendosHasta = -1;

  const udiDe = (t: number, pos: number): number => {
    const r = reglaMap.get('utilidad_despues_impuestos_k');
    if (!r || !r.habilitada) {
      throw new FormulaError('El cálculo de flujos y dividendos requiere la regla «utilidad_despues_impuestos_k» (está deshabilitada o no existe)', pos);
    }
    const v = valores['utilidad_despues_impuestos_k']?.[t];
    if (!Number.isFinite(v)) {
      throw new FormulaError(
        `La utilidad después de impuestos del año ${t} aún no está calculada: esta regla debe evaluarse después de «utilidad_despues_impuestos_k» (revise el orden de las dependencias)`,
        pos
      );
    }
    return v;
  };

  const fcffDe = (t: number, pos: number): number => {
    if (t in fcffCache) return fcffCache[t];
    const udi = udiDe(t, pos);
    const v =
      udi +
      (motorAnio['mtr_interes_devengado_k'][t] ?? 0) +
      (motorAnio['mtr_depreciacion_k'][t] ?? 0) -
      (motorAnio['mtr_capex_ampliaciones_k'][t] ?? 0) +
      (motorAnio['mtr_recuperacion_ct_k'][t] ?? 0) -
      (t === 0 ? (Number.isFinite(valores['inversion_total_k']?.[0]) ? valores['inversion_total_k'][0] : NaN) : 0);
    if (!Number.isFinite(v)) {
      throw new FormulaError('El cálculo del flujo del proyecto requiere la partida «inversion_total_k» del año 0', pos);
    }
    fcffCache[t] = v;
    return v;
  };

  const fcfeDe = (t: number, pos: number): number => {
    if (t in fcfeCache) return fcfeCache[t];
    const fcff = fcffDe(t, pos);
    const v =
      fcff -
      (motorAnio['mtr_interes_pagado_k'][t] ?? 0) +
      (motorAnio['mtr_desembolso_credito_k'][t] ?? 0) -
      (motorAnio['mtr_amortizacion_k'][t] ?? 0);
    fcfeCache[t] = v;
    return v;
  };

  const fcfeAcumDe = (t: number, pos: number): number => {
    if (t in fcfeAcumCache) return fcfeAcumCache[t];
    // Caja acumulada para dividendos: FCFE ANTES de repartos, DESDE EL AÑO 0
    // (misión §16.3: coincide con indicadores.fcfeAcumulado — el acumulado
    // completo incluye la fase de inversión; no puede repartirse caja que
    // la empresa aún no ha generado).
    let s = 0;
    for (let k = 0; k <= t; k++) s += fcfeDe(k, pos);
    fcfeAcumCache[t] = s;
    return s;
  };

  const dividendosPaso = (t: number, pos: number): DividendosAnio => {
    if (t in dividendosPasos) return dividendosPasos[t];
    const pctReparto = Math.min(1, Math.max(0, valorParam('pct_reparto_dividendos') ?? 0));
    const pctReserva = Math.min(1, Math.max(0, valorParam('pct_reserva_legal') ?? 0));
    const pctCubana = Math.min(1, Math.max(0, valorParam('pct_parte_cubana') ?? 0));
    for (let k = dividendosHasta + 1; k <= t; k++) {
      const previo = k - 1 in dividendosPasos ? dividendosPasos[k - 1].saldoAcumulable : 0;
      const udi = udiDe(k, pos);
      let fila: DividendosAnio;
      if (k === 0) {
        fila = {
          anio: 0,
          udi,
          saldoAcumulablePrevio: 0,
          base: 0,
          reserva: 0,
          distribuible: 0,
          propuestos: 0,
          // La caja del año 0 también es el FCFE acumulado del año 0
          // (misión §16.3: identidad caja = fcfeAcumulado para TODOS los años).
          cajaAcumulada: fcfeAcumDe(k, pos),
          pagables: 0,
          socioNacional: 0,
          socioExtranjero: 0,
          saldoAcumulable: udi,
        };
      } else {
        const base = Math.max(0, udi + previo);
        const reserva = base * pctReserva;
        const distribuible = base - reserva;
        const propuestos = distribuible * pctReparto;
        const caja = fcfeAcumDe(k, pos);
        const pagables = Math.min(propuestos, Math.max(0, caja));
        fila = {
          anio: k,
          udi,
          saldoAcumulablePrevio: previo,
          base,
          reserva,
          distribuible,
          propuestos,
          cajaAcumulada: caja,
          pagables,
          socioNacional: pagables * pctCubana,
          socioExtranjero: pagables * (1 - pctCubana),
          saldoAcumulable: previo + udi - reserva - pagables,
        };
      }
      dividendosPasos[k] = fila;
      dividendosHasta = k;
    }
    return dividendosPasos[t];
  };

  /** Resolver para reglas de ámbito año (t = año actual). */
  const resolverAnio = (t: number) => (nombre: string, pos: number): Valor => {
    if (nombre === 'PERIODO') return t;
    if (nombre === 'PERIODOS') return N;
    if (nombre === 'MESES_ANIO') return 12;
    if (nombre === 'otros_ingresos_serie') return otrosIngresos(t);
    if (nombre.startsWith(PREFIJO_MOTOR)) {
      if (nombre in motorAnio) {
        const v = motorAnio[nombre][t];
        return Number.isFinite(v) ? v : 0;
      }
      if (nombre === 'mtr_fcff_k') return fcffDe(t, pos);
      if (nombre === 'mtr_fcfe_k') return fcfeDe(t, pos);
      if (nombre === 'mtr_fcfe_acum_k') return fcfeAcumDe(t, pos);
      if (nombre === 'mtr_dividendos_pagables_k') return dividendosPaso(t, pos).pagables;
      if (nombre === 'mtr_dividendos_nacional_k') return dividendosPaso(t, pos).socioNacional;
      if (nombre === 'mtr_dividendos_extranjero_k') return dividendosPaso(t, pos).socioExtranjero;
      if (nombre === 'mtr_caja_dividendos_k') return dividendosPaso(t, pos).cajaAcumulada;
      throw new FormulaError(`Variable del motor no definida: "${nombre}"`, pos);
    }
    const p = valorParam(nombre);
    if (p !== undefined) return p;
    const r = reglaMap.get(nombre);
    if (r && (r.ambito === 'anio' || r.ambito === 'proyecto')) {
      if (!r.habilitada) throw new FormulaError(`La partida "${nombre}" está deshabilitada`, pos);
      if (!(nombre in valores)) throw new FormulaError(`La partida "${nombre}" no pudo calcularse por un error previo`, pos);
      const tt = r.ambito === 'proyecto' ? 0 : t;
      return valores[nombre][tt] ?? 0;
    }
    if (r) throw new FormulaError(`La partida "${nombre}" pertenece al ámbito ${r.ambito}; use la función de sumatoria correspondiente`, pos);
    throw new FormulaError(`Variable no definida: "${nombre}"`, pos);
  };

  const lagAnio = (t: number) => (nombre: string, k: number, pos: number): number => {
    const r = reglaMap.get(nombre);
    if (!r || r.ambito !== 'anio') throw new FormulaError(`LAG requiere una partida de ámbito anual`, pos);
    const tk = t - k;
    if (tk < 0) {
      throw new FormulaError(`LAG(${nombre}, ${k}) en el año ${t} cae antes del primer período (año 0)`, pos);
    }
    if (!(nombre in valores) || valores[nombre][tk] === undefined) {
      throw new FormulaError(`La partida "${nombre}" aún no está calculada para el año ${tk}`, pos);
    }
    return valores[nombre][tk];
  };

  const num = (v: Valor, pos: number): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    throw new FormulaError('Se esperaba un valor numérico', pos);
  };

  // ------------------------------------------------ evaluación de una regla
  function evaluarRegla(ast: Nodo, ctx: EvalContexto): number {
    const v = evalNodo(ast, ctx);
    const x = typeof v === 'boolean' ? (v ? 1 : 0) : v;
    const n = num(x, -1);
    if (!isFinite(n)) {
      throw new FormulaError('El resultado no es finito (¿división por cero o desbordamiento?)');
    }
    return n;
  }

  function falla(r: Regla, e: unknown) {
    const err = e as FormulaError;
    estados[r.id] = { id: r.id, ok: false, error: err.message ?? String(e), refs: [], params: [] };
    if (!issues.some((i) => i.reglaId === r.id)) {
      issues.push({
        tipo: 'error',
        codigo: 'CALCULO',
        mensaje: `Regla «${r.nombre}» (${r.ambito}): ${err.message ?? String(e)}`,
        reglaId: r.id,
        seccion: 'config',
      });
    }
  }

  // ------------------------------------------ 3a. Reglas de ámbito proyecto
  const sumaInversionesFn = (expr: Nodo): number => {
    let s = 0;
    for (const row of proyecto.financiero?.inversion ?? []) {
      const resolver = (nombre: string, pos: number): Valor => {
        const campo = CAMPOS_INVERSION[nombre];
        if (campo) return campo(row);
        const p = valorParam(nombre);
        if (p !== undefined) return p;
        if (nombre === 'MESES_ANIO') return 12;
        throw new FormulaError(`Variable no definida en la tabla de inversiones: "${nombre}"`, pos);
      };
      const v = num(evalNodo(expr, { resolver, periodo: 0, periodos: N, lag: () => { throw new FormulaError('LAG no disponible aquí'); } }), -1);
      if (isFinite(v)) s += v;
    }
    return s;
  };

  const sumaAportacionesFn = (expr: Nodo): number => {
    let s = 0;
    for (const row of proyecto.aportaciones ?? []) {
      const resolver = (nombre: string, pos: number): Valor => {
        const campo = CAMPOS_APORTACION[nombre];
        if (campo) return campo(row);
        const p = valorParam(nombre);
        if (p !== undefined) return p;
        throw new FormulaError(`Variable no definida en la tabla de aportaciones: "${nombre}"`, pos);
      };
      const v = num(evalNodo(expr, { resolver, periodo: 0, periodos: N, lag: () => { throw new FormulaError('LAG no disponible aquí'); } }), -1);
      if (isFinite(v)) s += v;
    }
    return s;
  };

  for (const id of ordProyecto.orden) {
    const r = reglaMap.get(id)!;
    try {
      const ctx: EvalContexto = {
        resolver: resolverProyecto(0),
        periodo: 0,
        periodos: N,
        lag: () => {
          throw new FormulaError('LAG solo está disponible en reglas de ámbito anual');
        },
        sumaInversiones: sumaInversionesFn,
        sumaAportaciones: sumaAportacionesFn,
      };
      const v = evaluarRegla(asts.get(id)!, ctx);
      valores[id] = { 0: v };
      const ast = asts.get(id)!;
      estados[id] = {
        id,
        ok: true,
        valores: { 0: v },
        refs: [...extraerVariables(ast)],
        params: [...extraerVariables(ast)].filter((x) => paramMap.has(x)),
      };
    } catch (e) {
      falla(r, e);
    }
  }

  // ------------------------- 3b. Filas de servicios y personal, por año
  const serviciosCalc: ServicioCalculado[] = (proyecto.servicios ?? []).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    valores: {},
    cantidades: {},
    capacidadesExcedidas: [],
  }));

  const personalVal: Record<string, Record<string, Record<number, number>>> = {};
  for (const p of proyecto.personal ?? []) personalVal[p.id] = {};

  // Capacidad del año t (diferida): necesita la demanda ya evaluada (fase 1).
  const capacidadCache: Record<number, Record<string, CapacidadServicio>> = {};
  const recursosPorAnio: Record<
    number,
    { porServicio: Record<string, CapacidadServicio>; recursos: { id: string; nombre: string; minutosDisponibles: number; minutosDemandados: number; utilizacion: number }[] }
  > = {};
  const demandaFila = (row: PlanexProject['servicios'][number], t: number): number => {
    const idx = (proyecto.servicios ?? []).findIndex((s) => s.id === row.id);
    if (idx < 0) return 0;
    const v = serviciosCalc[idx].valores[t]?.['srv_cantidad_mensual_proy'];
    return Number.isFinite(v) ? v : 0;
  };
  const REGLA_DEMANDA = 'srv_cantidad_mensual_proy';
  const astDemanda = asts.get(REGLA_DEMANDA);
  const reglaDemanda = reglaMap.get(REGLA_DEMANDA);

  const evaluarReglaServicio = (idx: number, t: number, id: string) => {
    const row = proyecto.servicios[idx];
    const svc = serviciosCalc[idx];
    const r = reglaMap.get(id)!;
    const resolver = (nombre: string, pos: number): Valor => {
      const campo = CAMPOS_SERVICIO[nombre];
      if (campo) return campo(row);
      if (nombre === 'PERIODO') return t;
      if (nombre === 'PERIODOS') return N;
      if (nombre === 'MESES_ANIO') return 12;
      if (nombre.startsWith(PREFIJO_MOTOR)) {
        if (nombre === 'mtr_capacidad_mensual') {
          const c = capacidadCache[t]?.[row.id];
          if (!c) throw new FormulaError('La capacidad del año aún no está calculada', pos);
          return c.capacidadMensual;
        }
        if (nombre === 'mtr_demanda_mensual') {
          const v = svc.valores[t]?.[REGLA_DEMANDA];
          return Number.isFinite(v) ? v : 0;
        }
        if (nombre === 'mtr_cantidad_real_mensual') {
          const c = capacidadCache[t]?.[row.id];
          if (!c) throw new FormulaError('La capacidad del año aún no está calculada', pos);
          return c.cantidadRealMensual;
        }
        if (nombre === 'mtr_utilizacion_capacidad') {
          const c = capacidadCache[t]?.[row.id];
          if (!c) throw new FormulaError('La capacidad del año aún no está calculada', pos);
          return c.utilizacion;
        }
        throw new FormulaError(`Variable del motor no disponible en el ámbito de servicios: "${nombre}"`, pos);
      }
      const p = valorParam(nombre);
      if (p !== undefined) return p;
      if (ordServicio.orden.includes(nombre)) return svc.valores[t][nombre];
      throw new FormulaError(`Variable no definida en el ámbito de servicios: "${nombre}"`, pos);
    };
    try {
      const v = evaluarRegla(asts.get(id)!, {
        resolver,
        periodo: t,
        periodos: N,
        lag: () => {
          throw new FormulaError('LAG no está disponible en el ámbito de servicios');
        },
      });
      svc.valores[t][id] = v;
      if (!estados[id]) estados[id] = { id, ok: true, refs: [], params: [] };
      if (!estados[id].valores) estados[id].valores = {};
      estados[id].valores![t] = (estados[id].valores![t] ?? 0) + v; // suma entre servicios (auditoría)
    } catch (e) {
      falla(r, e);
      svc.valores[t][id] = NaN;
    }
  };

  const resolverCapacidadAnio = (t: number) => {
    if (capacidadCache[t]) return;
    // La demanda de TODOS los servicios debe existir antes de repartir recursos.
    if (astDemanda && reglaDemanda?.habilitada) {
      for (let idx = 0; idx < (proyecto.servicios?.length ?? 0); idx++) {
        if (Number.isFinite(serviciosCalc[idx].valores[t]?.[REGLA_DEMANDA])) continue;
        evaluarReglaServicio(idx, t, REGLA_DEMANDA);
      }
    }
    const res = capacidadAnio(proyecto.recursos ?? [], proyecto.servicios ?? [], escenario, t, (s) => demandaFila(s, t));
    capacidadCache[t] = res.porServicio;
    recursosPorAnio[t] = res;
    const idsRecursos = new Set((proyecto.recursos ?? []).map((r) => r.id));
    for (const s of proyecto.servicios ?? []) {
      for (const rid of s.recursoIds ?? []) {
        if (!idsRecursos.has(rid)) {
          const msg = `El servicio «${s.nombre}» utiliza el recurso «${rid}» que no está definido en la tabla de recursos operativos: su capacidad no queda limitada por ese recurso.`;
          if (!issues.some((i) => i.codigo === 'RECURSO_INEXISTENTE' && i.mensaje === msg)) {
            issues.push({ tipo: 'inconsistencia', codigo: 'RECURSO_INEXISTENTE', mensaje: msg, seccion: 'tecnico' });
          }
        }
      }
    }
  };

  const evaluarServicioAnio = (t: number) => {
    for (let idx = 0; idx < (proyecto.servicios?.length ?? 0); idx++) {
      serviciosCalc[idx].valores[t] = {};
      for (const id of fase1Servicio) evaluarReglaServicio(idx, t, id);
    }
    resolverCapacidadAnio(t);
    for (let idx = 0; idx < (proyecto.servicios?.length ?? 0); idx++) {
      for (const id of fase2Servicio) evaluarReglaServicio(idx, t, id);
      const c = capacidadCache[t]?.[proyecto.servicios[idx].id];
      const cant = serviciosCalc[idx].valores[t]?.['srv_cantidad_real_mensual'];
      serviciosCalc[idx].cantidades[t] = Number.isFinite(cant) ? cant : 0;
      if (c && c.cantidadRealMensual < c.demandaMensual - 1e-9) {
        serviciosCalc[idx].capacidadesExcedidas.push(t);
      }
    }
  };

  const evaluarPersonalAnio = (t: number) => {
    const filas = (proyecto.personal ?? []).filter((p) =>
      t === 0 ? p.etapa === 'montaje' : p.etapa === 'operacion'
    );
    for (const row of filas) {
      personalVal[row.id] ??= {};
      for (const id of ordPersonal.orden) {
        const r = reglaMap.get(id)!;
        const resolver = (nombre: string, pos: number): Valor => {
          const campo = CAMPOS_PERSONAL[nombre];
          if (campo) return campo(row);
          if (nombre === 'PERIODO') return t;
          if (nombre === 'PERIODOS') return N;
          if (nombre === 'MESES_ANIO') return 12;
          if (nombre.startsWith(PREFIJO_MOTOR)) {
            throw new FormulaError(`Las variables del motor no están disponibles en el ámbito de personal ("${nombre}")`, pos);
          }
          const p = valorParam(nombre);
          if (p !== undefined) return p;
          if (ordPersonal.orden.includes(nombre)) return personalVal[row.id]?.[nombre]?.[t] ?? 0;
          throw new FormulaError(`Variable no definida en el ámbito de personal: "${nombre}"`, pos);
        };
        try {
          const v = evaluarRegla(asts.get(id)!, {
            resolver,
            periodo: t,
            periodos: N,
            lag: () => {
              throw new FormulaError('LAG no está disponible en el ámbito de personal');
            },
          });
          personalVal[row.id][id] = { ...(personalVal[row.id][id] ?? {}), [t]: v };
          if (!estados[id]) estados[id] = { id, ok: true, refs: [], params: [] };
          if (!estados[id].valores) estados[id].valores = {};
          estados[id].valores![t] = (estados[id].valores![t] ?? 0) + v;
        } catch (e) {
          falla(r, e);
        }
      }
    }
  };

  // ------------------------------------------------- 3c. Reglas de año
  const evaluarAnio = (t: number) => {
    const sumaServiciosFn = (expr: Nodo): number => {
      if (t === 0) return 0;
      let s = 0;
      for (let idx = 0; idx < (proyecto.servicios?.length ?? 0); idx++) {
        const row = proyecto.servicios[idx];
        const svc = serviciosCalc[idx];
        const resolver = (nombre: string, pos: number): Valor => {
          const campo = CAMPOS_SERVICIO[nombre];
          if (campo) return campo(row);
          if (nombre === 'PERIODO') return t;
          if (nombre === 'PERIODOS') return N;
          if (nombre === 'MESES_ANIO') return 12;
          if (nombre.startsWith(PREFIJO_MOTOR)) {
            const c = capacidadCache[t]?.[row.id];
            if (nombre === 'mtr_capacidad_mensual') return c ? c.capacidadMensual : 0;
            if (nombre === 'mtr_cantidad_real_mensual') return c ? c.cantidadRealMensual : 0;
            if (nombre === 'mtr_utilizacion_capacidad') return c ? c.utilizacion : 0;
            if (nombre === 'mtr_demanda_mensual') {
              const v = svc.valores[t]?.[REGLA_DEMANDA];
              return Number.isFinite(v) ? v : 0;
            }
            throw new FormulaError(`Variable del motor no disponible en SUMA_SERVICIOS: "${nombre}"`, pos);
          }
          const p = valorParam(nombre);
          if (p !== undefined) return p;
          if (nombre in svc.valores[t]) return svc.valores[t][nombre];
          throw new FormulaError(`Variable no definida dentro de SUMA_SERVICIOS: "${nombre}"`, pos);
        };
        s += num(evalNodo(expr, { resolver, periodo: t, periodos: N, lag: () => { throw new FormulaError('LAG no disponible aquí'); } }), -1);
      }
      return s;
    };

    const sumaPersonalFn = (expr: Nodo): number => {
      let s = 0;
      for (const row of (proyecto.personal ?? []).filter((p) =>
        t === 0 ? p.etapa === 'montaje' : p.etapa === 'operacion'
      )) {
        const resolver = (nombre: string, pos: number): Valor => {
          const campo = CAMPOS_PERSONAL[nombre];
          if (campo) return campo(row);
          if (nombre === 'PERIODO') return t;
          if (nombre === 'PERIODOS') return N;
          if (nombre === 'MESES_ANIO') return 12;
          const p = valorParam(nombre);
          if (p !== undefined) return p;
          if (personalVal[row.id]?.[nombre]?.[t] !== undefined) return personalVal[row.id][nombre][t];
          throw new FormulaError(`Variable no definida dentro de SUMA_PERSONAL: "${nombre}"`, pos);
        };
        s += num(evalNodo(expr, { resolver, periodo: t, periodos: N, lag: () => { throw new FormulaError('LAG no disponible aquí'); } }), -1);
      }
      return s;
    };

    for (const id of ordAnio.orden) {
      const r = reglaMap.get(id)!;
      if (estados[id] && !estados[id].ok) continue; // ya falló en un año anterior: mantener error
      try {
        const ctx: EvalContexto = {
          resolver: resolverAnio(t),
          periodo: t,
          periodos: N,
          lag: lagAnio(t),
          sumaServicios: sumaServiciosFn,
          sumaPersonal: sumaPersonalFn,
          sumaInversiones: sumaInversionesFn,
          sumaAportaciones: sumaAportacionesFn,
        };
        const v = evaluarRegla(asts.get(id)!, ctx);
        valores[id] ??= {};
        valores[id][t] = v;
        const ast = asts.get(id)!;
        estados[id] = {
          id,
          ok: true,
          valores: valores[id],
          refs: [...extraerVariables(ast)],
          params: [...extraerVariables(ast)].filter((x) => paramMap.has(x)),
        };
      } catch (e) {
        falla(r, e);
      }
    }
  };

  for (const t of years) {
    if (t > 0) evaluarServicioAnio(t);
    evaluarPersonalAnio(t);
    evaluarAnio(t);
  }

  // Finaliza la serie de dividendos para los años no solicitados por reglas
  // (el módulo completo se expone en el modelo y las tablas).
  if (reglaMap.get('utilidad_despues_impuestos_k')?.habilitada && valores['utilidad_despues_impuestos_k']) {
    for (const t of years) {
      if (t in dividendosPasos) continue;
      if (!Number.isFinite(valores['utilidad_despues_impuestos_k'][t])) continue;
      try {
        dividendosPaso(t, -1);
      } catch {
        dividendosHasta = Math.max(dividendosHasta, t - 1);
      }
    }
  }

  // Reglas deshabilitadas: estado informativo
  for (const r of proyecto.reglas) {
    if (!r.habilitada && !estados[r.id]) {
      estados[r.id] = { id: r.id, ok: true, refs: [], params: [] };
    }
  }

  // ---------------------------------------------------- 4. Indicadores
  const val = (id: string, t: number): number => {
    const v = valores[id]?.[t];
    return Number.isFinite(v) ? v : 0;
  };

  // Series de flujos (desde el motor, con caché; los años sin UDI quedan en 0).
  const fcff: Record<number, number> = {};
  const fcfe: Record<number, number> = {};
  for (const t of years) {
    fcff[t] = fcffCache[t] ?? 0;
    fcfe[t] = fcfeCache[t] ?? 0;
  }
  const fcffAcum = acumular(fcff, years);
  const fcfeAcum = acumular(fcfe, years);

  const reglaAcumProyecto = valores['flujo_acumulado_proyecto_k'];
  const reglaAcumSocios = valores['flujo_acumulado_socios_k'];
  const recuperacionProyecto: Recuperacion = reglaAcumProyecto
    ? calcularRecuperacion('proyecto', reglaAcumProyecto, years)
    : {
        indicador: 'proyecto',
        anios: null,
        anioCruce: null,
        indeterminado: true,
        motivo:
          'No puede calcularse con fiabilidad: falta la regla «flujo_acumulado_proyecto_k» (deshabilitada, con error o eliminada). El plan debe definir el flujo de caja del proyecto para evaluar la recuperación de la inversión total.',
      };
  const recuperacionSocios: Recuperacion = reglaAcumSocios
    ? calcularRecuperacion('socios', reglaAcumSocios, years)
    : {
        indicador: 'socios',
        anios: null,
        anioCruce: null,
        indeterminado: true,
        motivo:
          'No puede calcularse con fiabilidad: falta la regla «flujo_acumulado_socios_k». El plan debe definir el flujo de caja de los socios para evaluar la recuperación del capital aportado.',
      };

  const operacion = (proyecto.personal ?? []).filter((p) => p.etapa === 'operacion');
  const montaje = (proyecto.personal ?? []).filter((p) => p.etapa === 'montaje');
  const trabajadoresPorGrupo: Record<string, number> = {};
  let cubanos = 0;
  let extranjeros = 0;
  for (const p of operacion) {
    trabajadoresPorGrupo[p.grupo] = (trabajadoresPorGrupo[p.grupo] ?? 0) + (Number.isFinite(p.cantidad) ? p.cantidad : 0);
    if (p.grupo.startsWith('cubano')) cubanos += p.cantidad;
    else extranjeros += p.cantidad;
  }
  const totalCant = operacion.reduce((s, p) => s + (Number.isFinite(p.cantidad) ? p.cantidad : 0), 0);
  const salarioProm =
    totalCant > 0
      ? operacion.reduce((s, p) => s + p.cantidad * p.salarioPromedioAnualCUP, 0) / totalCant
      : null;

  const utilidadNeta: Record<number, number> = {};
  const beneficiosPais: Record<number, number> = {};
  const ingresosTotales: Record<number, number> = {};
  let utilidadNetaAcum = 0;
  let beneficiosPaisAcum = 0;
  let beneficiosPaisExplot = 0;
  let impuestosTot = 0;
  for (const t of years) {
    utilidadNeta[t] = val('utilidad_despues_impuestos_k', t);
    beneficiosPais[t] = val('total_beneficios_pais_k', t);
    ingresosTotales[t] = val('ingresos_totales_k', t);
    // Acumulado de beneficios: TODO el período (incluye el año 0), idéntico al
    // de la tabla 4.11 — el resumen y las conclusiones usan este mismo total.
    beneficiosPaisAcum += beneficiosPais[t];
    if (t >= 1) {
      utilidadNetaAcum += utilidadNeta[t];
      beneficiosPaisExplot += beneficiosPais[t];
      impuestosTot += val('impuesto_utilidades_k', t);
    }
  }

  const margenAnio1 = (proyecto.servicios ?? []).length
    ? serviciosCalc.reduce((s, x) => s + (x.valores[1]?.['srv_margen_contribucion'] ?? 0), 0)
    : null;

  const dividendosFinales: DividendosAnio[] = years
    .filter((t) => t in dividendosPasos)
    .map((t) => dividendosPasos[t]);

  const capacidadFinal: Record<string, Record<number, CapacidadServicio>> = {};
  for (const t of years) {
    for (const s of proyecto.servicios ?? []) {
      const c = capacidadCache[t]?.[s.id];
      if (c) capacidadFinal[s.id] = { ...(capacidadFinal[s.id] ?? {}), [t]: c };
    }
  }
  const recursosCalculados: RecursoCalculado[] = (proyecto.recursos ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    horasDisponibles: Object.fromEntries(years.map((t) => [t, (recursosPorAnio[t]?.recursos.find((x) => x.id === r.id)?.minutosDisponibles ?? 0) / 60])),
    horasDemandadas: Object.fromEntries(years.map((t) => [t, (recursosPorAnio[t]?.recursos.find((x) => x.id === r.id)?.minutosDemandados ?? 0) / 60])),
    utilizacion: Object.fromEntries(years.map((t) => [t, recursosPorAnio[t]?.recursos.find((x) => x.id === r.id)?.utilizacion ?? 0])),
  }));

  const indicadores: Indicadores = {
    recuperacionProyecto,
    recuperacionSocios,
    inversionTotalKUSD: val('inversion_total_k', 0),
    aportacionesTotalesKUSD: val('aportaciones_total_k', 0),
    ingresosTotales,
    utilidadNeta,
    utilidadNetaAcumulada: utilidadNetaAcum,
    beneficiosPais,
    beneficiosPaisAcumulados: beneficiosPaisAcum,
    beneficiosPaisExplotacion: beneficiosPaisExplot,
    impuestosTotales: impuestosTot,
    totalTrabajadores: totalCant,
    trabajadoresMontaje: montaje.reduce((s, p) => s + (Number.isFinite(p.cantidad) ? p.cantidad : 0), 0),
    trabajadoresPorGrupo,
    cubanos,
    extranjeros,
    salarioPromedioAnualCUP: salarioProm,
    margenContribucionAnio1: margenAnio1,
    fcff,
    fcffAcumulado: fcffAcum,
    fcfe,
    fcfeAcumulado: fcfeAcum,
    capexAmpliaciones: capexAmp,
  };

  // ---------------------------------------------------------- 5. Issues
  // Capacidad: demanda no atendible (misión §7).
  const umbralUtil = Math.min(1, Math.max(0.01, valorParam('umbral_utilizacion_capacidad') ?? 0.9));
  for (const svc of serviciosCalc) {
    if (svc.capacidadesExcedidas.length > 0) {
      const t0 = svc.capacidadesExcedidas[0];
      const c = capacidadFinal[svc.id]?.[t0];
      const pctPerdido = c && c.demandaMensual > 0 ? (1 - c.cantidadRealMensual / c.demandaMensual) * 100 : 0;
      issues.push({
        tipo: 'inconsistencia',
        codigo: 'CAPACIDAD',
        mensaje: `El servicio «${svc.nombre}» no puede atender ${fmtPct(pctPerdido)} de la demanda prevista en los años ${svc.capacidadesExcedidas.join(', ')} con la capacidad activa. La proyección se ha limitado a la demanda atendible; para servir toda la demanda se requiere ampliar recursos (escenario B) o revisar precios o volúmenes.`,
        seccion: 'tecnico',
        objetivoId: svc.id,
      });
    }
  }
  if ((proyecto.servicios ?? []).some((s) => (s.recursoIds ?? []).length > 0) && !(proyecto.recursos ?? []).length) {
    issues.push({
      tipo: 'inconsistencia',
      codigo: 'SIN_RECURSOS',
      mensaje: 'Hay servicios que declaran recursos operativos pero la tabla de recursos está vacía: la capacidad no queda limitada por recursos y la proyección no es operativamente verificable. Complete la tabla de recursos (4.6).',
      seccion: 'tecnico',
    });
  }
  if ((proyecto.recursos ?? []).length > 0) {
    const alertas = (proyecto.recursos ?? [])
      .map((r) => {
        const util = Math.max(...years.map((t) => recursosPorAnio[t]?.recursos.find((x) => x.id === r.id)?.utilizacion ?? 0));
        return { r, util };
      })
      .filter((x) => x.util > umbralUtil);
    for (const { r, util } of alertas) {
      issues.push({
        tipo: 'supuesto',
        codigo: 'UTILIZACION_ALTA',
        mensaje: `El recurso «${r.nombre}» alcanza una utilización máxima de ${fmtPct(util, 0)} (umbral de referencia: ${fmtPct(umbralUtil, 0)}). Verifique la combinación de servicios y los tiempos de procedimiento: una utilización tan alta deja poco margen para imprevistos y mantenimiento.`,
        seccion: 'tecnico',
        objetivoId: r.id,
      });
    }
  }
  // Financiación
  const dif = valores['diferencia_financiacion_k']?.[0];
  if (Number.isFinite(dif)) {
    if (dif < -0.05) {
      issues.push({
        tipo: 'error',
        codigo: 'FINANCIACION_INSUFICIENTE',
        mensaje: `Financiación insuficiente: faltan ${fmtK(Math.abs(dif))} kUSD para cubrir la inversión total. Aumente las aportaciones, otras fuentes o el crédito.`,
        seccion: 'financiero',
      });
    } else if (dif > 0.05) {
      issues.push({
        tipo: 'inconsistencia',
        codigo: 'FINANCIACION_EXCESO',
        mensaje: `Exceso de financiación sin asignar: ${fmtK(dif)} kUSD por encima de la inversión total. Verifique si corresponde a capital de trabajo adicional o ajuste las fuentes.`,
        seccion: 'financiero',
      });
    }
  }
  // Recuperación y horizonte (indicador del proyecto)
  if (reglaAcumProyecto) {
    if (recuperacionProyecto.anios === null) {
      issues.push({
        tipo: 'inconsistencia',
        codigo: 'NO_RECUPERACION',
        mensaje: `La inversión total del proyecto no se recupera dentro del horizonte de ${N} años con el flujo de caja del proyecto (FCFF). Amplíe el horizonte o revise los supuestos; no debe presentarse como recuperado.`,
        seccion: 'financiero',
      });
    } else if (N < Math.ceil(recuperacionProyecto.anios + 1)) {
      issues.push({
        tipo: 'inconsistencia',
        codigo: 'HORIZONTE_CORTO',
        mensaje: `El horizonte de análisis (${N} años) es inferior al período de recuperación del proyecto (${fmtK(recuperacionProyecto.anios)} años) más un año, como exige la metodología. Amplíe el horizonte.`,
        seccion: 'financiero',
      });
    }
    if (recuperacionProyecto.indeterminado && recuperacionProyecto.anios !== null) {
      issues.push({
        tipo: 'inconsistencia',
        codigo: 'FLUJO_NO_CONVENCIONAL',
        mensaje: 'El flujo acumulado del proyecto cambia de signo más de una vez (posibles inversiones adicionales): el período de recuperación calculado por interpolación debe interpretarse con cautela.',
        seccion: 'financiero',
      });
    }
  }
  if (reglaAcumSocios && recuperacionSocios.anios === null) {
    issues.push({
      tipo: 'pendiente',
      codigo: 'NO_RECUPERACION_SOCIOS',
      mensaje: `El capital aportado por los socios no se recupera dentro del horizonte de ${N} años según el flujo de caja de los socios (FCFE). Si se presenta, debe decirse expresamente.`,
      seccion: 'financiero',
    });
  }
  // Datos pendientes
  if (!(proyecto.servicios ?? []).length) {
    issues.push({ tipo: 'pendiente', codigo: 'SIN_SERVICIOS', mensaje: 'No hay servicios definidos: complete la tabla de servicios (4.6) para calcular ingresos y costos variables.', seccion: 'tecnico' });
  }
  if (!(proyecto.financiero?.inversion ?? []).length) {
    issues.push({ tipo: 'pendiente', codigo: 'SIN_INVERSION', mensaje: 'No hay partidas de inversión definidas: complete la tabla de inversiones (4.10).', seccion: 'inversiones' });
  }
  if (!(proyecto.aportaciones ?? []).length) {
    issues.push({ tipo: 'pendiente', codigo: 'SIN_APORTACIONES', mensaje: 'No hay aportaciones definidas: complete la tabla de aportaciones de los socios (4.5).', seccion: 'negocio' });
  }
  if (!(proyecto.personal ?? []).length) {
    issues.push({ tipo: 'pendiente', codigo: 'SIN_PERSONAL', mensaje: 'No hay filas de fuerza de trabajo: complete la tabla (4.9) para vincular el costo laboral.', seccion: 'fuerza' });
  }
  if (!(proyecto.personal ?? []).some((p) => p.etapa === 'operacion')) {
    issues.push({ tipo: 'pendiente', codigo: 'SIN_PERSONAL_OPERACION', mensaje: 'No hay personal de etapa «operación»: el costo laboral de los años de operación será cero.', seccion: 'fuerza' });
  }
  // Derechos reales sin referencia documental
  for (const a of proyecto.aportaciones ?? []) {
    if (a.tipo === 'derechos_reales' && !a.referenciaDocumental?.trim()) {
      issues.push({
        tipo: 'documental',
        codigo: 'DERECHO_REAL_SIN_REF',
        mensaje: `La aportación por derechos reales del socio ${a.socio} carece de referencia documental. La metodología exige adjuntar la certificación de la Dirección de Patrimonio del MFP cuando corresponda.`,
        seccion: 'negocio',
        objetivoId: a.id,
      });
    }
  }
  // Depreciación: activos disponibles después de la operación
  for (const a of dep.activos) {
    if (a.vidaUtilAnios > 0 && a.anioDisponible + a.vidaUtilAnios > N + 1) {
      issues.push({
        tipo: 'documental',
        codigo: 'DEP_FUERA_HORIZONTE',
        mensaje: `El activo «${a.concepto}» (vida útil ${a.vidaUtilAnios} años, disponible en el año ${a.anioDisponible}) no termina de depreciarse dentro del horizonte de ${N} años: quedará un valor neto en libros al final del análisis.`,
        seccion: 'inversiones',
        objetivoId: a.id,
      });
    }
  }
  // Dividendos restringidos por caja
  for (const d of dividendosFinales) {
    if (d.propuestos > d.pagables + 0.005) {
      issues.push({
        tipo: 'documental',
        codigo: 'DIVIDENDOS_RESTRINGIDOS',
        mensaje: `En el año ${d.anio} los dividendos propuestos (${fmtK(d.propuestos)} kUSD) superan la caja disponible (${fmtK(d.cajaAcumulada)} kUSD): solo se consideran pagables ${fmtK(d.pagables)} kUSD. La política de distribución está limitada por la liquidez modelada.`,
        seccion: 'financiero',
      });
      break;
    }
  }
  // Inversiones en CUP
  if ((proyecto.financiero?.inversion ?? []).some((i) => i.moneda === 'CUP')) {
    issues.push({
      tipo: 'documental',
      codigo: 'INVERSION_CUP',
      mensaje: `Existen partidas de inversión en CUP: se convierten con el tipo de cambio parametrizado. Verifique la tasa, la fecha de referencia y la fuente.`,
      seccion: 'inversiones',
    });
  }
  // Capital de trabajo con recuperación
  if (pctRecuperacionCT > 0) {
    issues.push({
      tipo: 'supuesto',
      codigo: 'CT_RECUPERACION',
      mensaje: `El modelo incorpora la recuperación del ${fmtPct(pctRecuperacionCT, 0)} del capital de trabajo en el último año del horizonte (regla parametrizada). Debe justificarse documentalmente que esa fracción es realmente recuperable al final del período.`,
      seccion: 'financiero',
      parametroId: 'pct_recuperacion_capital_trabajo',
    });
  }
  // Escenario de capacidad activo
  if (escenario === 'B_ampliacion' && activosAmp.length > 0) {
    issues.push({
      tipo: 'supuesto',
      codigo: 'ESCENARIO_B',
      mensaje: `Escenario activo: B (ampliación de capacidad). Las ampliaciones programadas (${activosAmp.length}) generan CAPEX y nueva capacidad en sus años de ejecución; sus cifras provienen de la tabla de recursos operativos.`,
      seccion: 'tecnico',
    });
  }
  // Advertencia de datos ficticios (plantilla demostrativa)
  if (proyecto.planex?.plantillaOrigen === 'clinica' || proyecto.planex?.plantillaOrigen === 'centro') {
    issues.push({ tipo: 'documental', codigo: 'DATOS_FICTICIOS', mensaje: ADVERTENCIA_DATOS_FICTICIOS, seccion: 'general' });
  }
  const tasaDemo = paramMap.get('tasa_impuesto_utilidades');
  if (tasaDemo?.demo) {
    issues.push({
      tipo: 'supuesto',
      codigo: 'TASA_DEMO',
      mensaje: `La tasa de impuesto sobre utilidades (${fmtPct(tasaDemo.valor)}) es un supuesto de demostración editable. No constituye la tasa legal aplicable: documente la fuente normativa antes de un uso oficial.`,
      parametroId: 'tasa_impuesto_utilidades',
      seccion: 'config',
    });
  }

  const ok = !issues.some((i) => i.tipo === 'error');

  return {
    years,
    ok,
    valores,
    estados,
    servicios: serviciosCalc,
    issues,
    indicadores,
    depreciacion: dep.activos,
    depreciacionTotal: dep.totalPorAnio,
    deuda: deuda.filas,
    dividendos: dividendosFinales,
    capacidadServicios: capacidadFinal,
    recursosCalculados,
  };
}

// ---------------------------------------------------------------------------
// Utilidades para la interfaz y los exportadores
// ---------------------------------------------------------------------------

/** Valor de una línea del estado de resultados / beneficios para un año. */
export function valorLinea(
  modelo: ComputedModel,
  proyecto: PlanexProject,
  ref: { tipo: 'regla'; id: string } | { tipo: 'param'; id: string } | { tipo: 'entrada'; id: 'otros_ingresos' },
  t: number
): number {
  if (ref.tipo === 'regla') {
    const v = modelo.valores[ref.id]?.[t];
    return Number.isFinite(v) ? v : 0;
  }
  if (ref.tipo === 'param') {
    const p = proyecto.parametros.find((x) => x.id === ref.id);
    return Number.isFinite(p?.valor) ? p!.valor : 0;
  }
  if (t <= 0) return 0;
  const v = proyecto.financiero?.otrosIngresos?.[t - 1];
  return Number.isFinite(v) ? v : 0;
}
