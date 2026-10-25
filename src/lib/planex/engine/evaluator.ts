// ============================================================================
// Evaluador del lenguaje PLANEX (sin eval; tipos: número, booleano, cadena)
// ============================================================================

import { FormulaError } from './tokenizer';
import { Nodo } from './parser';

export type Valor = number | boolean | string;

export interface EvalContexto {
  /** Resuelve un identificador (parámetro, regla, campo de fila, constante). */
  resolver: (nombre: string, pos: number) => Valor;
  /** Período actual (0 = inversión; 1..N = operación). */
  periodo: number;
  /** Número total de períodos de operación. */
  periodos: number;
  /** Valor de una partida en un año anterior. */
  lag: (nombre: string, n: number, pos: number) => number;
  /** Sumatorias por tabla (evalúan la expresión en cada fila). */
  sumaServicios?: (expr: Nodo) => number;
  sumaPersonal?: (expr: Nodo) => number;
  sumaAportaciones?: (expr: Nodo) => number;
  sumaInversiones?: (expr: Nodo) => number;
}

function aNumero(v: Valor, pos: number): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  throw new FormulaError('Se esperaba un valor numérico', pos);
}

function aBool(v: Valor, pos: number): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  throw new FormulaError('Se esperaba una condición (verdadero/falso)', pos);
}

function iguales(a: Valor, b: Valor): boolean {
  if (typeof a === 'string' || typeof b === 'string') {
    return String(a) === String(b);
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return aBool(a, -1) === aBool(b, -1);
  }
  return a === b;
}

export function evalNodo(n: Nodo, ctx: EvalContexto): Valor {
  switch (n.t) {
    case 'num':
      return n.v;
    case 'cadena':
      return n.v;
    case 'bool':
      return n.v;
    case 'var':
      return ctx.resolver(n.nombre, n.pos);
    case 'pct':
      return aNumero(evalNodo(n.a, ctx), -1) / 100;
    case 'un': {
      if (n.op === '-') return -aNumero(evalNodo(n.a, ctx), -1);
      return aNumero(evalNodo(n.a, ctx), -1);
    }
    case 'bin': {
      const a = evalNodo(n.a, ctx);
      // IF no está aquí; AND/OR son llamadas. División por cero → Infinity
      // (el motor la detecta después con isFinite).
      const b = evalNodo(n.b, ctx);
      switch (n.op) {
        case '+':
          return aNumero(a, -1) + aNumero(b, -1);
        case '-':
          return aNumero(a, -1) - aNumero(b, -1);
        case '*':
          return aNumero(a, -1) * aNumero(b, -1);
        case '/':
          return aNumero(a, -1) / aNumero(b, -1);
        case '^': {
          const base = aNumero(a, -1);
          const exp = aNumero(b, -1);
          if (base < 0 && !Number.isInteger(exp)) {
            throw new FormulaError('Potencia no definida: base negativa con exponente fraccionario', -1);
          }
          return Math.pow(base, exp);
        }
        case '=':
          return iguales(a, b);
        case '<>':
          return !iguales(a, b);
        case '<':
          return aNumero(a, -1) < aNumero(b, -1);
        case '>':
          return aNumero(a, -1) > aNumero(b, -1);
        case '<=':
          return aNumero(a, -1) <= aNumero(b, -1);
        case '>=':
          return aNumero(a, -1) >= aNumero(b, -1);
        default:
          throw new FormulaError(`Operador no admitido: ${n.op}`, -1);
      }
    }
    case 'call': {
      switch (n.nombre) {
        case 'IF': {
          if (n.args.length !== 3) throw new FormulaError('IF admite exactamente 3 argumentos: IF(condición, entonces, si_no)', n.pos);
          const cond = aBool(evalNodo(n.args[0], ctx), n.pos);
          // Cortocircuito: solo se evalúa la rama elegida.
          return cond ? evalNodo(n.args[1], ctx) : evalNodo(n.args[2], ctx);
        }
        case 'AND': {
          if (n.args.length < 2) throw new FormulaError('AND admite 2 o más argumentos', n.pos);
          for (const a of n.args) {
            if (!aBool(evalNodo(a, ctx), n.pos)) return false;
          }
          return true;
        }
        case 'OR': {
          if (n.args.length < 2) throw new FormulaError('OR admite 2 o más argumentos', n.pos);
          for (const a of n.args) {
            if (aBool(evalNodo(a, ctx), n.pos)) return true;
          }
          return false;
        }
        case 'NOT': {
          if (n.args.length !== 1) throw new FormulaError('NOT admite 1 argumento', n.pos);
          return !aBool(evalNodo(n.args[0], ctx), n.pos);
        }
        case 'MIN': {
          if (n.args.length < 2) throw new FormulaError('MIN admite 2 o más argumentos', n.pos);
          let m = Infinity;
          for (const a of n.args) m = Math.min(m, aNumero(evalNodo(a, ctx), n.pos));
          return m;
        }
        case 'MAX': {
          if (n.args.length < 2) throw new FormulaError('MAX admite 2 o más argumentos', n.pos);
          let m = -Infinity;
          for (const a of n.args) m = Math.max(m, aNumero(evalNodo(a, ctx), n.pos));
          return m;
        }
        case 'ABS':
          if (n.args.length !== 1) throw new FormulaError('ABS admite 1 argumento', n.pos);
          return Math.abs(aNumero(evalNodo(n.args[0], ctx), n.pos));
        case 'ROUND': {
          if (n.args.length < 1 || n.args.length > 2) throw new FormulaError('ROUND admite 1 o 2 argumentos: ROUND(valor, decimales)', n.pos);
          const v = aNumero(evalNodo(n.args[0], ctx), n.pos);
          const d = n.args.length === 2 ? Math.trunc(aNumero(evalNodo(n.args[1], ctx), n.pos)) : 0;
          const f = Math.pow(10, d);
          return Math.round(v * f) / f;
        }
        case 'SUM': {
          if (n.args.length < 1) throw new FormulaError('SUM admite 1 o más argumentos', n.pos);
          let s = 0;
          for (const a of n.args) s += aNumero(evalNodo(a, ctx), n.pos);
          return s;
        }
        case 'POW': {
          if (n.args.length !== 2) throw new FormulaError('POW admite 2 argumentos', n.pos);
          const base = aNumero(evalNodo(n.args[0], ctx), n.pos);
          const exp = aNumero(evalNodo(n.args[1], ctx), n.pos);
          if (base < 0 && !Number.isInteger(exp)) {
            throw new FormulaError('Potencia no definida: base negativa con exponente fraccionario', n.pos);
          }
          return Math.pow(base, exp);
        }
        case 'LAG': {
          if (n.args.length < 1 || n.args.length > 2) throw new FormulaError('LAG admite 1 o 2 argumentos: LAG(partida, años)', n.pos);
          const nombre = (n.args[0] as { t: 'var'; nombre: string }).nombre;
          const k = n.args.length === 2 ? Math.trunc(aNumero(evalNodo(n.args[1], ctx), n.pos)) : 1;
          return ctx.lag(nombre, k, n.pos);
        }
        case 'SUMA_SERVICIOS':
        case 'SUMA_PERSONAL':
        case 'SUMA_APORTACIONES':
        case 'SUMA_INVERSIONES':
          return evalSumaTabla(n.nombre, n.args, ctx);
        default:
          throw new FormulaError(`Función no admitida: ${n.nombre}`, n.pos);
      }
    }
    default:
      throw new FormulaError('Nodo desconocido', -1);
  }
}

/** Agregaciones por tabla: dispatch del evaluador. */
export function evalSumaTabla(
  nombre: string,
  args: Nodo[],
  ctx: EvalContexto
): number {
  if (args.length !== 1) {
    throw new FormulaError(`${nombre} admite exactamente 1 argumento (expresión evaluada por fila)`, -1);
  }
  const fn =
    nombre === 'SUMA_SERVICIOS'
      ? ctx.sumaServicios
      : nombre === 'SUMA_PERSONAL'
        ? ctx.sumaPersonal
        : nombre === 'SUMA_APORTACIONES'
          ? ctx.sumaAportaciones
          : nombre === 'SUMA_INVERSIONES'
            ? ctx.sumaInversiones
            : undefined;
  if (!fn) throw new FormulaError(`Función no admitida: ${nombre}`, -1);
  return fn(args[0]);
}
