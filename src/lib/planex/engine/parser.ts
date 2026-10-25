// ============================================================================
// Parser del lenguaje de fórmulas PLANEX → AST
// Gramática (precedencia de menor a mayor):
//   expr    := or
//   or      := and (OR and)*
//   and     := not (AND not)*
//   not     := NOT not | comp
//   comp    := add ((= | == | <> | != | < | > | <= | >=) add)?
//   add     := mul (('+' | '-') mul)*
//   mul     := unario (('*' | '/') unario)*
//   unario  := ('-' | '+') unario | potencia
//   potencia:= postfijo ('^' unario)?          (asociativo por la derecha)
//   postfijo:= primario ('%')*
//   primario:= NUMERO | CADENA | TRUE | FALSE
//            | ident ('(' args ')')?
//            | '(' expr ')'
// ============================================================================

import { FormulaError, tokenizar, Token } from './tokenizer';

export type Nodo =
  | { t: 'num'; v: number }
  | { t: 'cadena'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'var'; nombre: string; pos: number }
  | { t: 'bin'; op: string; a: Nodo; b: Nodo }
  | { t: 'un'; op: string; a: Nodo }
  | { t: 'pct'; a: Nodo }
  | { t: 'call'; nombre: string; args: Nodo[]; pos: number };

export const FUNCIONES_ADMITIDAS = [
  'IF', 'MIN', 'MAX', 'ABS', 'ROUND', 'SUM', 'AND', 'OR', 'NOT', 'LAG', 'POW',
  'SUMA_SERVICIOS', 'SUMA_PERSONAL', 'SUMA_APORTACIONES', 'SUMA_INVERSIONES',
];

class Parser {
  private toks: Token[];
  private i = 0;

  constructor(src: string) {
    this.toks = tokenizar(src);
  }

  private peek(): Token {
    return this.toks[this.i];
  }

  private next(): Token {
    return this.toks[this.i++];
  }

  private esOp(op: string): boolean {
    const t = this.peek();
    return t.tipo === 'op' && t.valor === op;
  }

  private esKw(kw: string): boolean {
    const t = this.peek();
    return t.tipo === 'ident' && t.valor.toUpperCase() === kw;
  }

  private esperarOp(op: string): Token {
    if (!this.esOp(op)) {
      throw new FormulaError(`Se esperaba "${op}" y se encontró "${this.peek().valor || 'fin de la fórmula'}"`, this.peek().pos);
    }
    return this.next();
  }

  private esperarCierre(): void {
    this.esperarOp(')');
  }

  parse(): Nodo {
    const n = this.expr();
    if (this.peek().tipo !== 'eof') {
      throw new FormulaError(`Sobra "${this.peek().valor}" al final de la fórmula`, this.peek().pos);
    }
    return n;
  }

  private expr(): Nodo {
    return this.or();
  }

  private or(): Nodo {
    let a = this.and();
    while (this.esKw('OR')) {
      this.next();
      const b = this.and();
      a = { t: 'call', nombre: 'OR', args: [a, b], pos: -1 };
    }
    return a;
  }

  private and(): Nodo {
    let a = this.not();
    while (this.esKw('AND')) {
      this.next();
      const b = this.not();
      a = { t: 'call', nombre: 'AND', args: [a, b], pos: -1 };
    }
    return a;
  }

  private not(): Nodo {
    if (this.esKw('NOT')) {
      this.next();
      return { t: 'un', op: 'NOT', a: this.not() };
    }
    return this.comp();
  }

  private comp(): Nodo {
    const a = this.add();
    const t = this.peek();
    if (t.tipo === 'op' && ['=', '==', '<>', '!=', '<', '>', '<=', '>='].includes(t.valor)) {
      this.next();
      const b = this.add();
      const op = t.valor === '==' ? '=' : t.valor === '!=' ? '<>' : t.valor;
      return { t: 'bin', op, a, b };
    }
    return a;
  }

  private add(): Nodo {
    let a = this.mul();
    while (this.esOp('+') || this.esOp('-')) {
      const op = this.next().valor;
      const b = this.mul();
      a = { t: 'bin', op, a, b };
    }
    return a;
  }

  private mul(): Nodo {
    let a = this.unario();
    while (this.esOp('*') || this.esOp('/')) {
      const op = this.next().valor;
      const b = this.unario();
      a = { t: 'bin', op, a, b };
    }
    return a;
  }

  private unario(): Nodo {
    if (this.esOp('-')) {
      this.next();
      return { t: 'un', op: '-', a: this.unario() };
    }
    if (this.esOp('+')) {
      this.next();
      return this.unario();
    }
    return this.potencia();
  }

  private potencia(): Nodo {
    const a = this.postfijo();
    if (this.esOp('^')) {
      this.next();
      const b = this.unario(); // asociativo por la derecha
      return { t: 'bin', op: '^', a, b };
    }
    return a;
  }

  private postfijo(): Nodo {
    let a = this.primario();
    while (this.esOp('%')) {
      this.next();
      a = { t: 'pct', a };
    }
    return a;
  }

  private primario(): Nodo {
    const t = this.peek();
    if (t.tipo === 'numero') {
      this.next();
      return { t: 'num', v: t.num! };
    }
    if (t.tipo === 'cadena') {
      this.next();
      return { t: 'cadena', v: t.valor };
    }
    if (t.tipo === 'ident') {
      const up = t.valor.toUpperCase();
      if (up === 'TRUE' || up === 'FALSE') {
        this.next();
        return { t: 'bool', v: up === 'TRUE' };
      }
      // ¿función?
      const sig = this.toks[this.i + 1];
      if (sig && sig.tipo === 'op' && sig.valor === '(') {
        if (!FUNCIONES_ADMITIDAS.includes(up)) {
          throw new FormulaError(`Función no admitida: ${t.valor}()`, t.pos);
        }
        const pos = t.pos;
        this.next(); // ident
        this.next(); // (
        const args: Nodo[] = [];
        if (!this.esOp(')')) {
          args.push(this.expr());
          while (this.esOp(',')) {
            this.next();
            args.push(this.expr());
          }
        }
        this.esperarCierre();
        if (up === 'LAG') {
          if (args.length < 1 || args.length > 2) {
            throw new FormulaError('LAG admite 1 o 2 argumentos: LAG(variable, períodos)', pos);
          }
          if (args[0].t !== 'var') {
            throw new FormulaError('El primer argumento de LAG debe ser una variable (nombre de partida)', pos);
          }
        }
        return { t: 'call', nombre: up, args, pos };
      }
      this.next();
      return { t: 'var', nombre: t.valor, pos: t.pos };
    }
    if (t.tipo === 'op' && t.valor === '(') {
      this.next();
      const e = this.expr();
      this.esperarCierre();
      return e;
    }
    throw new FormulaError(`Se esperaba un valor y se encontró "${t.valor || 'fin de la fórmula'}"`, t.pos);
  }
}

/** Analiza una expresión y devuelve su AST (lanza FormulaError si es inválida). */
export function parsear(src: string): Nodo {
  if (!src || !src.trim()) throw new FormulaError('La fórmula está vacía', 0);
  return new Parser(src).parse();
}

// ---------------------------------------------------------------------------
// Recorrido del AST
// ---------------------------------------------------------------------------

/** Variables referenciadas (excluyendo nombres de funciones). */
export function extraerVariables(n: Nodo, vars: Set<string> = new Set()): Set<string> {
  switch (n.t) {
    case 'num':
    case 'cadena':
    case 'bool':
      break;
    case 'var':
      vars.add(n.nombre);
      break;
    case 'bin':
      extraerVariables(n.a, vars);
      extraerVariables(n.b, vars);
      break;
    case 'un':
      extraerVariables(n.a, vars);
      break;
    case 'pct':
      extraerVariables(n.a, vars);
      break;
    case 'call':
      for (const a of n.args) extraerVariables(a, vars);
      break;
  }
  return vars;
}

/** Variables usadas dentro de LAG(...) — referencias a años anteriores. */
export function extraerLags(n: Nodo, lags: string[] = []): string[] {
  if (n.t === 'call') {
    if (n.nombre === 'LAG' && n.args[0].t === 'var') {
      lags.push(n.args[0].nombre);
    }
    for (const a of n.args) extraerLags(a, lags);
  } else if (n.t === 'bin') {
    extraerLags(n.a, lags);
    extraerLags(n.b, lags);
  } else if (n.t === 'un' || n.t === 'pct') {
    extraerLags(n.a, lags);
  }
  return lags;
}
