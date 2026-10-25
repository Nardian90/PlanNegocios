// ============================================================================
// Motor de cálculo PLANEX — única fuente de verdad para interfaz,
// validaciones, previsualización, PDF y Excel.
//
// Fases:
//  1. Parseo de reglas (errores de sintaxis → issues).
//  2. Grafo de dependencias por ámbito + orden topológico + detección de ciclos
//     (las auto-referencias vía LAG son recurrencias legítimas).
//  3. Evaluación: reglas de proyecto → por año (filas servicio/personal → reglas de año).
//  4. Indicadores (recuperación, beneficios acumulados, fuerza de trabajo).
//  5. Emisión de issues (errores, inconsistencias, pendientes, supuestos).
// ============================================================================

import {
  PlanexProject,
  Regla,
  ComputedModel,
  Issue,
  EstadoRegla,
  ServicioCalculado,
  Indicadores,
  ADVERTENCIA_DATOS_FICTICIOS,
} from '../types';
import { parsear, Nodo, extraerVariables, extraerLags } from './parser';
import { evalNodo, EvalContexto, Valor } from './evaluator';
import { FormulaError } from './tokenizer';

const CAMPOS_SERVICIO: Record<string, (s: PlanexProject['servicios'][number]) => Valor> = {
  precio_base: (s) => s.precioBase,
  cantidad_base_mensual: (s) => s.cantidadBaseMensual,
  capacidad_max_mensual: (s) => s.capacidadMaxMensual,
  costo_variable_unitario: (s) => s.costoVariableUnitario,
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
};

/** Orden topológico por ámbito. Devuelve ciclos detectados (auto-referencias
 *  sin LAG y grupos no resueltos). */
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

  // ---------------------------------------------------------------- 1. Parseo
  const asts = new Map<string, Nodo>();
  for (const r of activas) {
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

  // ------------------------------------------------- contexto de resolución
  const otrosIngresos = (t: number): number => {
    if (t <= 0) return 0;
    const v = proyecto.financiero?.otrosIngresos?.[t - 1];
    return Number.isFinite(v) ? v : 0;
  };

  const valorParam = (nombre: string): number | undefined => paramMap.get(nombre)?.valor;

  /** Resolver para reglas de ámbito proyecto. */
  const resolverProyecto = (t: number) => (nombre: string, pos: number): Valor => {
    if (nombre === 'MESES_ANIO') return 12;
    if (nombre === 'PERIODO' || nombre === 'PERIODOS') {
      throw new FormulaError(`"${nombre}" no está disponible en reglas de ámbito proyecto`, pos);
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

  /** Resolver para reglas de ámbito año (t = año actual). */
  const resolverAnio = (t: number) => (nombre: string, pos: number): Valor => {
    if (nombre === 'PERIODO') return t;
    if (nombre === 'PERIODOS') return N;
    if (nombre === 'MESES_ANIO') return 12;
    if (nombre === 'otros_ingresos_serie') return otrosIngresos(t);
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

  // Valores por fila de personal: rowId -> reglaId -> año -> valor
  const personalVal: Record<string, Record<string, Record<number, number>>> = {};
  for (const p of proyecto.personal ?? []) personalVal[p.id] = {};

  const evaluarServicioAnio = (t: number) => {
    for (let idx = 0; idx < (proyecto.servicios?.length ?? 0); idx++) {
      const row = proyecto.servicios[idx];
      const svc = serviciosCalc[idx];
      svc.valores[t] = {};
      for (const id of ordServicio.orden) {
        const r = reglaMap.get(id)!;
        const resolver = (nombre: string, pos: number): Valor => {
          const campo = CAMPOS_SERVICIO[nombre];
          if (campo) return campo(row);
          if (nombre === 'PERIODO') return t;
          if (nombre === 'PERIODOS') return N;
          if (nombre === 'MESES_ANIO') return 12;
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
      }
      const cant = svc.valores[t]['srv_cantidad_mensual_proy'];
      svc.cantidades[t] = isFinite(cant) ? cant : 0;
      if (isFinite(cant) && cant > row.capacidadMaxMensual + 1e-9) {
        svc.capacidadesExcedidas.push(t);
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

  function calcularRecuperacion(): number | null {
    const acum = valores['flujo_acumulado_k'];
    if (!acum) return null;
    if ((acum[0] ?? 0) >= 0) return 0;
    for (let t = 1; t <= N; t++) {
      const a = acum[t - 1] ?? 0;
      const b = acum[t] ?? 0;
      if (a < 0 && b >= 0) {
        return t - 1 + -a / (b - a);
      }
    }
    return null;
  }

  const recuperacion = calcularRecuperacion();

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
  let impuestosTot = 0;
  for (const t of years) {
    utilidadNeta[t] = val('utilidad_despues_impuestos_k', t);
    beneficiosPais[t] = val('total_beneficios_pais_k', t);
    ingresosTotales[t] = val('ingresos_totales_k', t);
    if (t >= 1) {
      utilidadNetaAcum += utilidadNeta[t];
      beneficiosPaisAcum += beneficiosPais[t];
      impuestosTot += val('impuesto_utilidades_k', t);
    }
  }

  const margenAnio1 = (proyecto.servicios ?? []).length
    ? serviciosCalc.reduce((s, x) => s + (x.valores[1]?.['srv_margen_contribucion'] ?? 0), 0)
    : null;

  const indicadores: Indicadores = {
    recuperacionAnios: recuperacion,
    inversionTotalKUSD: val('inversion_total_k', 0),
    ingresosTotales,
    utilidadNeta,
    utilidadNetaAcumulada: utilidadNetaAcum,
    beneficiosPais,
    beneficiosPaisAcumulados: beneficiosPaisAcum,
    impuestosTotales: impuestosTot,
    totalTrabajadores: totalCant,
    trabajadoresMontaje: montaje.reduce((s, p) => s + (Number.isFinite(p.cantidad) ? p.cantidad : 0), 0),
    trabajadoresPorGrupo,
    cubanos,
    extranjeros,
    salarioPromedioAnualCUP: salarioProm,
    margenContribucionAnio1: margenAnio1,
  };

  // ---------------------------------------------------------- 5. Issues
  // Capacidad
  for (const svc of serviciosCalc) {
    if (svc.capacidadesExcedidas.length > 0) {
      issues.push({
        tipo: 'inconsistencia',
        codigo: 'CAPACIDAD',
        mensaje: `El servicio «${svc.nombre}» supera la capacidad instalada en los años ${svc.capacidadesExcedidas.join(', ')}. Revise la capacidad máxima, el crecimiento del volumen o la ocupación prevista.`,
        seccion: 'tecnico',
        objetivoId: svc.id,
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
        mensaje: `Financiación insuficiente: faltan ${Math.abs(dif).toFixed(1)} kUSD para cubrir la inversión total. Aumente las aportaciones, otras fuentes o el crédito.`,
        seccion: 'financiero',
      });
    } else if (dif > 0.05) {
      issues.push({
        tipo: 'inconsistencia',
        codigo: 'FINANCIACION_EXCESO',
        mensaje: `Exceso de financiación sin asignar: ${dif.toFixed(1)} kUSD por encima de la inversión total. Verifique si corresponde a capital de trabajo adicional o ajuste las fuentes.`,
        seccion: 'financiero',
      });
    }
  }
  // Recuperación y horizonte
  if (valores['flujo_acumulado_k']) {
    if (recuperacion === null) {
      issues.push({
        tipo: 'inconsistencia',
        codigo: 'NO_RECUPERACION',
        mensaje: `La inversión no se recupera dentro del horizonte de ${N} años. Amplíe el horizonte o revise los supuestos del modelo.`,
        seccion: 'financiero',
      });
    } else if (N < Math.ceil(recuperacion + 1)) {
      issues.push({
        tipo: 'inconsistencia',
        codigo: 'HORIZONTE_CORTO',
        mensaje: `El horizonte de análisis (${N} años) es inferior al período de recuperación (${recuperacion.toFixed(1)} años) más un año, como exige la metodología. Amplíe el horizonte.`,
        seccion: 'financiero',
      });
    }
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
  // Inversión fija sin vida útil
  for (const i of proyecto.financiero?.inversion ?? []) {
    if (i.categoria === 'inversion_fija' && (!Number.isFinite(i.vidaUtilAnios) || i.vidaUtilAnios <= 0)) {
      issues.push({
        tipo: 'inconsistencia',
        codigo: 'VIDA_UTIL',
        mensaje: `La partida de inversión fija «${i.concepto}» no tiene vida útil definida: no se incluirá en la depreciación anual.`,
        seccion: 'inversiones',
        objetivoId: i.id,
      });
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
  // Advertencia de datos ficticios (plantilla demostrativa)
  if (proyecto.planex?.plantillaOrigen === 'clinica') {
    issues.push({ tipo: 'documental', codigo: 'DATOS_FICTICIOS', mensaje: ADVERTENCIA_DATOS_FICTICIOS, seccion: 'general' });
  }
  const tasaDemo = paramMap.get('tasa_impuesto_utilidades');
  if (tasaDemo?.demo) {
    issues.push({
      tipo: 'supuesto',
      codigo: 'TASA_DEMO',
      mensaje: `La tasa de impuesto sobre utilidades (${(tasaDemo.valor * 100).toFixed(1)} %) es un supuesto de demostración editable. No constituye la tasa legal aplicable: documente la fuente normativa antes de un uso oficial.`,
      parametroId: 'tasa_impuesto_utilidades',
      seccion: 'config',
    });
  }

  const ok = !issues.some((i) => i.tipo === 'error');

  return { years, ok, valores, estados, servicios: serviciosCalc, issues, indicadores };
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
