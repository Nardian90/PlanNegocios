// ============================================================================
// Traductor AST → fórmulas Excel.
// Convierte las expresiones activas del motor PLANEX a fórmulas XLSX reales
// con referencias entre hojas. Si una construcción no puede traducirse de
// manera equivalente, lanza NoTraducible (el exportador documenta la regla,
// escribe el valor estático y lo advierte: nunca sustituye en silencio).
// ============================================================================

import { Nodo } from '../engine/parser';

export class NoTraducible extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'NoTraducible';
  }
}

export function letraCol(idx0: number): string {
  let n = idx0;
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/** Columnas de la hoja Servicios (formato largo: una fila por servicio-año). */
export const COL_SERVICIO: Record<string, string> = {
  precio_base: 'C',
  cantidad_base_mensual: 'D',
  capacidad_max_mensual: 'E',
  costo_variable_unitario: 'F',
  duracion_minutos: 'O',
  anio_inicio_demanda: 'Q',
  srv_precio_proy: 'G',
  srv_cantidad_mensual_proy: 'H',
  srv_cantidad_real_mensual: 'I',
  srv_cantidad_anual: 'J',
  srv_costo_unitario_proy: 'K',
  srv_ingreso_anual: 'L',
  srv_costo_variable_total: 'M',
  srv_margen_contribucion: 'N',
};

export const COL_PERSONAL: Record<string, string> = {
  cantidad: 'D',
  salario_promedio_anual: 'E',
  salario_anual_proy: 'F',
};

export interface CtxTraduccion {
  modo: 'anio' | 'filaServicio' | 'filaPersonal';
  /** Fila del parámetro en la hoja Parametros. */
  filaParam: (id: string) => number;
  /** Fila de la regla anual en la hoja Proyecciones. */
  filaReglaAnio: (id: string) => number;
  /** Fila de la regla de proyecto en la hoja Financiacion. */
  filaReglaProyecto: (id: string) => number;
  /** Número total de períodos (años de operación). */
  periodos: number;
  /** Fila de la serie de otros ingresos (regla/entrada anual). */
  filaOtrosIngresos: number;
  /** Columna actual (índice 0-based) y fila actual. */
  col: number;
  fila: number;
  /** Fila de los números de período (encabezado) en la hoja actual. */
  filaPeriodos: number;
  /** Rango de filas de datos de las hojas auxiliares (1-based, inclusivo). */
  rangoServicios: [number, number];
  rangoPersonal: [number, number];
  rangoAportaciones: [number, number];
  rangoInversion: [number, number];
  /** Columna del total de aportaciones (por fila). */
  colTotalAportaciones: string;
  /** Referencia Excel de una variable del motor (mtr_*) en modo anual.
   *  Recibe el nombre y el AÑO t. Debe existir para traducir reglas que usan
   *  el motor estructural (depreciación, deuda, flujos, dividendos). */
  refMotor?: (nombre: string, anio: number) => string;
  /** Referencia Excel de una variable del motor de ámbito servicio (capacidad).
   *  Recibe el nombre y la FILA actual (fila servicio-año alineada con la
   *  hoja Capacidad). */
  refMotorServicio?: (nombre: string, fila: number) => string;
}

function esVar(n: Nodo): n is { t: 'var'; nombre: string; pos: number } {
  return n.t === 'var';
}

/** Extrae la cadena de factores de un producto (a*b*c…). */
function factoresProducto(n: Nodo): { vars: string[]; otros: number } | null {
  const vars: string[] = [];
  let otros = 1;
  const rec = (x: Nodo): boolean => {
    if (x.t === 'bin' && x.op === '*') {
      return rec(x.a) && rec(x.b);
    }
    if (x.t === 'var') {
      vars.push(x.nombre);
      return true;
    }
    if (x.t === 'num') {
      otros *= x.v;
      return true;
    }
    return false;
  };
  if (rec(n)) return { vars, otros };
  return null;
}

export function traducir(n: Nodo, ctx: CtxTraduccion): string {
  switch (n.t) {
    case 'num':
      return String(n.v);
    case 'cadena':
      return `"${n.v}"`;
    case 'bool':
      return n.v ? 'TRUE' : 'FALSE';
    case 'var':
      return traducirVar(n.nombre, ctx);
    case 'un':
      return n.op === '-' ? `(-${traducir(n.a, ctx)})` : traducir(n.a, ctx);
    case 'pct':
      return `(${traducir(n.a, ctx)}/100)`;
    case 'bin': {
      const a = traducir(n.a, ctx);
      const b = traducir(n.b, ctx);
      switch (n.op) {
        case '+':
          return `(${a}+${b})`;
        case '-':
          return `(${a}-${b})`;
        case '*':
          return `(${a}*${b})`;
        case '/':
          return `(${a}/${b})`;
        case '^':
          return `(${a}^${b})`;
        case '=':
          return `(${a}=${b})`;
        case '<>':
          return `(${a}<>${b})`;
        case '<':
          return `(${a}<${b})`;
        case '>':
          return `(${a}>${b})`;
        case '<=':
          return `(${a}<=${b})`;
        case '>=':
          return `(${a}>=${b})`;
        default:
          throw new NoTraducible(`Operador sin equivalente Excel: ${n.op}`);
      }
    }
    case 'call': {
      const args = n.args.map((x) => traducir(x, ctx));
      switch (n.nombre) {
        case 'IF':
          return `IF(${args.join(',')})`;
        case 'AND':
          return `AND(${args.join(',')})`;
        case 'OR':
          return `OR(${args.join(',')})`;
        case 'NOT':
          return `NOT(${args.join(',')})`;
        case 'MIN':
          return `MIN(${args.join(',')})`;
        case 'MAX':
          return `MAX(${args.join(',')})`;
        case 'ABS':
          return `ABS(${args.join(',')})`;
        case 'ROUND':
          return `ROUND(${args.join(',')})`;
        case 'SUM':
          return `SUM(${args.join(',')})`;
        case 'POW':
          return `POWER(${args.join(',')})`;
        case 'LAG': {
          if (ctx.modo !== 'anio') throw new NoTraducible('LAG solo traducible en reglas anuales');
          const nombre = (n.args[0] as { t: 'var'; nombre: string }).nombre;
          const k = n.args.length === 2 ? Math.trunc(obtenerNumero(n.args[1])) : 1;
          if (ctx.col - k < 0) throw new NoTraducible('LAG antes de la primera columna');
          const colAnt = letraCol(ctx.col - k);
          return `${colAnt}$${ctx.filaReglaAnio(nombre)}`;
        }
        case 'SUMA_SERVICIOS':
          return traducirSumaServicios(n.args[0], ctx);
        case 'SUMA_PERSONAL':
          return traducirSumaPersonal(n.args[0], ctx);
        case 'SUMA_APORTACIONES':
          return traducirSumaAportaciones(n.args[0], ctx);
        case 'SUMA_INVERSIONES':
          return traducirSumaInversiones(n.args[0], ctx);
        default:
          throw new NoTraducible(`Función sin equivalente Excel: ${n.nombre}`);
      }
    }
    default:
      throw new NoTraducible('Nodo no soportado');
  }
}

function obtenerNumero(n: Nodo): number {
  if (n.t === 'num') return n.v;
  throw new NoTraducible('Se esperaba un número literal');
}

function traducirVar(nombre: string, ctx: CtxTraduccion): string {
  if (ctx.modo === 'filaServicio') {
    if (nombre === 'PERIODO') return `$A${ctx.fila}`;
    if (nombre === 'PERIODOS') return String(ctx.periodos);
    if (nombre === 'MESES_ANIO') return '12';
    if (nombre.startsWith('mtr_')) {
      if (!ctx.refMotorServicio) throw new NoTraducible(`Variable del motor «${nombre}» sin hoja de capacidad disponible en este contexto`);
      return ctx.refMotorServicio(nombre, ctx.fila);
    }
    const col = COL_SERVICIO[nombre];
    if (col) return `${col}${ctx.fila}`;
    return traducirVarGlobal(nombre, ctx);
  }
  if (ctx.modo === 'filaPersonal') {
    if (nombre === 'PERIODO') return `$A${ctx.fila}`;
    if (nombre === 'PERIODOS') return String(ctx.periodos);
    if (nombre === 'MESES_ANIO') return '12';
    const col = COL_PERSONAL[nombre];
    if (col) return `${col}${ctx.fila}`;
    return traducirVarGlobal(nombre, ctx);
  }
  // modo anio: variables del motor, luego otra regla anual, luego global
  if (nombre === 'PERIODO') return `${letraCol(ctx.col)}$${ctx.filaPeriodos}`;
  if (nombre === 'PERIODOS') return String(ctx.periodos);
  if (nombre === 'MESES_ANIO') return '12';
  if (nombre === 'otros_ingresos_serie') return `${letraCol(ctx.col)}$${ctx.filaOtrosIngresos}`;
  if (nombre.startsWith('mtr_')) {
    if (!ctx.refMotor) throw new NoTraducible(`Variable del motor «${nombre}» sin equivalente Excel en este contexto`);
    const anio = ctx.col - 2; // ctx.col es 0-based; el año t vive en la columna 2+t
    if (anio < 0) throw new NoTraducible(`Variable del motor «${nombre}» usada fuera del rango de años`);
    return ctx.refMotor(nombre, anio);
  }
  const filaAnio = ctx.filaReglaAnio(nombre);
  if (filaAnio > 0) return `${letraCol(ctx.col)}$${filaAnio}`;
  return traducirVarGlobal(nombre, ctx);
}

function traducirPeriodos(_ctx: CtxTraduccion): string {
  return String(_ctx.periodos);
}

function traducirVarGlobal(nombre: string, ctx: CtxTraduccion): string {
  // Parámetros → celda absoluta en Parametros (lo resuelve el exportador;
  // si no existe la fila, la variable es de otro tipo).
  if (nombre === 'MESES_ANIO') return '12';
  const filaP = ctx.filaParam(nombre);
  if (filaP > 0) return `Parametros!$C$${filaP}`;
  const filaR = ctx.filaReglaProyecto(nombre);
  if (filaR > 0) return `Financiacion!$D$${filaR}`;
  throw new NoTraducible(`Variable «${nombre}» sin equivalente Excel en este contexto`);
}

// ---------------------------------------------------------------------------
// Sumatorias por tabla
// ---------------------------------------------------------------------------

function traducirSumaServicios(expr: Nodo, ctx: CtxTraduccion): string {
  const per = ctx.modo === 'anio' ? `${letraCol(ctx.col)}$${ctx.filaPeriodos}` : `$A${ctx.fila}`;
  const [f1, f2] = ctx.rangoServicios;
  if (esVar(expr) && COL_SERVICIO[expr.nombre]) {
    const c = COL_SERVICIO[expr.nombre];
    return `SUMIFS(Servicios!$${c}$${f1}:$${c}$${f2},Servicios!$A$${f1}:$A$${f2},${per})`;
  }
  const prod = factoresProducto(expr);
  if (prod && prod.vars.length >= 2 && prod.vars.every((v) => COL_SERVICIO[v])) {
    const cols = prod.vars.map((v) => `$${COL_SERVICIO[v]}$${f1}:$${COL_SERVICIO[v]}$${f2}`).join('*');
    return `SUMPRODUCT((Servicios!$A$${f1}:$A$${f2}=${per})*${cols})`;
  }
  throw new NoTraducible('SUMA_SERVICIOS con expresión no traducible: use una variable de servicio o un producto de variables');
}

function traducirSumaPersonal(expr: Nodo, ctx: CtxTraduccion): string {
  const per = ctx.modo === 'anio' ? `${letraCol(ctx.col)}$${ctx.filaPeriodos}` : `$A${ctx.fila}`;
  const [f1, f2] = ctx.rangoPersonal;
  if (esVar(expr) && COL_PERSONAL[expr.nombre]) {
    const c = COL_PERSONAL[expr.nombre];
    return `SUMIFS(Personal!$${c}$${f1}:$${c}$${f2},Personal!$A$${f1}:$A$${f2},${per})`;
  }
  const prod = factoresProducto(expr);
  if (prod && prod.vars.length >= 2 && prod.vars.every((v) => COL_PERSONAL[v])) {
    const cols = prod.vars.map((v) => `$${COL_PERSONAL[v]}$${f1}:$${COL_PERSONAL[v]}$${f2}`).join('*');
    return `SUMPRODUCT((Personal!$A$${f1}:$A$${f2}=${per})*${cols})`;
  }
  throw new NoTraducible('SUMA_PERSONAL con expresión no traducible: use «cantidad * salario_anual_proy» o similar');
}

function traducirSumaAportaciones(expr: Nodo, ctx: CtxTraduccion): string {
  if (esVar(expr) && expr.nombre === 'monto_aportacion') {
    const [f1, f2] = ctx.rangoAportaciones;
    const c = ctx.colTotalAportaciones;
    return `SUM(Aportaciones!$${c}$${f1}:$${c}$${f2})`;
  }
  throw new NoTraducible('SUMA_APORTACIONES solo traduce la variable «monto_aportacion» (total por fila)');
}

/**
 * SUMA_INVERSIONES(IF(AND(categoria_inv = "x", moneda_inv = "y"), BODY, 0))
 *   - BODY = monto_inv                  → SUMIFS(monto, categoría, moneda)
 *   - BODY incluye vida_util_inv        → SUMIFS(dep. anual auxiliar, …)
 */
function traducirSumaInversiones(expr: Nodo, ctx: CtxTraduccion): string {
  const [f1, f2] = ctx.rangoInversion;
  const cuerpo = extraerCuerpoIF(expr);
  if (!cuerpo) throw new NoTraducible('SUMA_INVERSIONES traduce la forma IF(AND(categoría, moneda), monto, 0)');
  const usaVida = contieneVar(cuerpo.body, 'vida_util_inv');
  // Hoja Inversion (esquema 2.0.0): A concepto, B categoría, C moneda,
  // D monto, E vida útil, F disponible, G residual, H dep. anual.
  const colDatos = usaVida ? 'H' : 'D';
  const rangoDatos = `Inversion!$${colDatos}$${f1}:$${colDatos}$${f2}`;
  const rangoCat = `Inversion!$B$${f1}:$B$${f2}`;
  const rangoMon = `Inversion!$C$${f1}:$C$${f2}`;
  if (!esVar(cuerpo.body) && !usaVida) {
    throw new NoTraducible('SUMA_INVERSIONES: cuerpo de la condición no soportado');
  }
  return `SUMIFS(${rangoDatos},${rangoCat},"${cuerpo.categoria}",${rangoMon},"${cuerpo.moneda}")`;
}

function extraerCuerpoIF(expr: Nodo): { categoria: string; moneda: string; body: Nodo } | null {
  if (expr.t !== 'call' || expr.nombre !== 'IF' || expr.args.length !== 3) return null;
  const cond = expr.args[0];
  if (cond.t !== 'call' || cond.nombre !== 'AND' || cond.args.length !== 2) return null;
  const lector = (lado: Nodo): { campo: string; valor: string } | null => {
    if (lado.t !== 'bin' || lado.op !== '=') return null;
    if (lado.a.t === 'var' && lado.b.t === 'cadena') return { campo: lado.a.nombre, valor: lado.b.v };
    if (lado.b.t === 'var' && lado.a.t === 'cadena') return { campo: lado.b.nombre, valor: lado.a.v };
    return null;
  };
  const l1 = lector(cond.args[0]);
  const l2 = lector(cond.args[1]);
  if (!l1 || !l2) return null;
  const cat = l1.campo === 'categoria_inv' ? l1 : l2.campo === 'categoria_inv' ? l2 : null;
  const mon = l1.campo === 'moneda_inv' ? l1 : l2.campo === 'moneda_inv' ? l2 : null;
  if (!cat || !mon) return null;
  // El «si no» debe ser 0
  if (expr.args[2].t !== 'num' || expr.args[2].v !== 0) return null;
  return { categoria: cat.valor, moneda: mon.valor, body: expr.args[1] };
}

function contieneVar(n: Nodo, nombre: string): boolean {
  if (n.t === 'var') return n.nombre === nombre;
  if (n.t === 'bin') return contieneVar(n.a, nombre) || contieneVar(n.b, nombre);
  if (n.t === 'un' || n.t === 'pct') return contieneVar(n.a, nombre);
  if (n.t === 'call') return n.args.some((a) => contieneVar(a, nombre));
  return false;
}
