// ============================================================================
// Tokenizador del lenguaje de fórmulas PLANEX (sin eval, seguro)
// ============================================================================

export type TokTipo = 'numero' | 'ident' | 'cadena' | 'op' | 'eof';

export interface Token {
  tipo: TokTipo;
  /** Texto literal (identificadores en minúsculas, operadores tal cual). */
  valor: string;
  num?: number;
  pos: number;
}

export class FormulaError extends Error {
  pos: number;
  constructor(mensaje: string, pos = -1) {
    super(mensaje);
    this.name = 'FormulaError';
    this.pos = pos;
  }
}

const OPERADORES = ['<=', '>=', '<>', '!=', '==', '+', '-', '*', '/', '^', '(', ')', ',', '<', '>', '=', '%'];

export function tokenizar(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    // Cadena entre comillas dobles
    if (c === '"') {
      const inicio = i;
      i++;
      let sb = '';
      while (i < n && src[i] !== '"') {
        sb += src[i];
        i++;
      }
      if (i >= n) throw new FormulaError('Cadena sin cerrar (falta la comilla final)', inicio);
      i++; // cierra comilla
      tokens.push({ tipo: 'cadena', valor: sb, pos: inicio });
      continue;
    }
    // Número
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const inicio = i;
      let snum = '';
      while (i < n && /[0-9.]/.test(src[i])) {
        snum += src[i];
        i++;
      }
      const num = Number(snum);
      if (!isFinite(num)) throw new FormulaError(`Número no válido: "${snum}"`, inicio);
      tokens.push({ tipo: 'numero', valor: snum, num, pos: inicio });
      continue;
    }
    // Identificador (sin tildes ni ñ, documentado)
    if (/[A-Za-z_]/.test(c)) {
      const inicio = i;
      let sid = '';
      while (i < n && /[A-Za-z0-9_]/.test(src[i])) {
        sid += src[i];
        i++;
      }
      tokens.push({ tipo: 'ident', valor: sid, pos: inicio });
      continue;
    }
    // Operadores
    const op = OPERADORES.find((o) => src.startsWith(o, i));
    if (op) {
      tokens.push({ tipo: 'op', valor: op, pos: i });
      i += op.length;
      continue;
    }
    throw new FormulaError(`Carácter no admitido: "${c}"`, i);
  }
  tokens.push({ tipo: 'eof', valor: '', pos: n });
  return tokens;
}
