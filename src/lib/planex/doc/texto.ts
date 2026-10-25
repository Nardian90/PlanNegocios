// ============================================================================
// PLANEX — Texto canónico de los renderizadores (misión DOC-002 §3.3).
//
// El modelo documental guarda texto rico en Unicode. Los renderizadores de
// PAPEL (PDF con fuentes estándar de jsPDF, codificación WinAnsi/cp1252) no
// pueden dibujar cualquier carácter: los glifos fuera de WinAnsi se
// corrompían (U+2212 «−» se imprimía como «"»; los corchetes CJK 【】 como
// dígitos «0»). Este módulo aplica UNA conversión única y determinista a
// texto seguro, compartida por PDF y DOCX para que AMBOS formatos expongan
// exactamente el mismo contenido (misión §8) y las fórmulas narrativas
// nunca pierdan parte de su significado.
//
// Reglas:
//  · Los caracteres de WinAnsi/cp1252 se conservan (á, é, ñ, «», —, –, …,
//    ×, ÷, ±, ², ³, €, ¿?, ¡!, etc.).
//  · Los operadores matemáticos y tipográficos fuera de WinAnsi se
//    sustituyen por equivalencias ASCII SEGURAS y legibles (− → «-», ≥ →
//    «>=», ≈ → «~», Δ → «Delta», 【】 → «», …).
//  · Los caracteres de control (excepto salto de línea y tabulador) y los
//    marcadores invisibles se eliminan.
//  · Cualquier carácter restante fuera de WinAnsi se translitera o, en
//    último recurso, se elimina; `asegurarTexto` lo deja registrado para
//    que las pruebas detecten corrupciones no previstas.
// ============================================================================

/** Mapa de sustituciones fuera de WinAnsi → equivalentes seguros. */
const MAPA_WINANSI: Record<string, string> = {
  '\u2212': '-', // signo menos
  '\u2265': '>=', // mayor o igual
  '\u2264': '<=', // menor o igual
  '\u2260': '<>', // distinto
  '\u2248': '~', // aproximadamente
  '\u2261': '=', // idéntico
  '\u2192': '->', // flecha derecha
  '\u2190': '<-', // flecha izquierda
  '\u21D2': '=>', // implica
  '\u2194': '<->', // doble flecha
  '\u0394': 'Delta',
  '\u03B1': 'alfa',
  '\u03B2': 'beta',
  '\u03C0': 'pi',
  '\u03A3': 'Suma',
  '\u2211': 'Suma',
  '\u221A': 'raiz', // √
  '\u221E': 'infinito',
  '\u00B5': 'mcg', // micro (WinAnsi lo tiene, pero por claridad en fórmulas) — se conserva abajo, ver NOTA
  '\u3010': '«', // 【
  '\u3011': '»', // 】
  '\u26A0': 'ATENCIÓN:',
  '\u26A1': '',
  '\u2713': '(sí)',
  '\u2717': '(no)',
  '\u2714': '(sí)',
  '\u2716': '(no)',
  '\u2022': '·', // viñeta → punto medio (WinAnsi 0xB7)
  '\u25CF': '·',
  '\u00A0': ' ', // espacio duro
  '\u2011': '-', // guion duro
  '\u2012': '-',
  '\u2015': '—',
  '\u2500': '-',
  '\u2501': '-',
  '\u2039': '‹',
  '\u203A': '›',
  '\u2044': '/',
  '\u2215': '/',
  '\u2070': '0', '\u2071': 'i', '\u2074': '4', '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9', // superíndices fuera de WinAnsi
  '\u2080': '0', '\u2081': '1', '\u2082': '2', '\u2083': '3', '\u2084': '4', '\u2085': '5', '\u2086': '6', '\u2087': '7', '\u2088': '8', '\u2089': '9', // subíndices
  '\u208A': '+', '\u208B': '-', '\u208C': '=', '\u208D': '(', '\u208E': ')',
  '\u207A': '+', '\u207B': '-', '\u207C': '=', '\u207D': '(', '\u207E': ')',
  '\u20AC': '€', // ya WinAnsi (0x80), explícito por claridad
  '\u2018': '‘', '\u2019': '’', '\u201A': '‚',
  '\u201C': '“', '\u201D': '”', '\u201E': '„',
  '\u2020': '†', '\u2021': '‡',
  '\u2031': '/10 000',
  '\u2103': '°C',
  '\u2109': '°F',
  '\uFB01': 'fi', '\uFB02': 'fl',
  '\u2245': '~=', '\u2246': '!=~',
  '\u2266': '<=', '\u2267': '>=',
  '\u224B': '~',
};

/** ¿Es un carácter representable en WinAnsi/cp1252 sin corrupción? */
function esWinAnsi(cp: number): boolean {
  if (cp === 0xad) return true; // soft hyphen
  if (cp >= 0x20 && cp <= 0x7e) return true; // ASCII
  if (cp >= 0xa0 && cp <= 0xff) {
    // cp1252: 0xad manejado arriba; el resto de 0xa0-0xff es válido.
    return true;
  }
  // cp1252 tiene además 0x80–0x9F con símbolos (€ ‚ ƒ „ … † ‡ ˜ ™ ‹ › • etc.)
  if (cp >= 0x80 && cp <= 0x9f) return true;
  return false;
}

const EXTRA_CP1252 = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

/** Convierte un texto del modelo en texto SEGURO para los renderizadores de
 *  papel (WinAnsi): sin caracteres de control, sin marcadores invisibles y
 *  con sustituciones legibles para operadores fuera de WinAnsi. */
export function asegurarTexto(texto: string | null | undefined): string {
  if (!texto) return '';
  let salida = '';
  for (const ch of texto) {
    const cp = ch.codePointAt(0)!;
    if (ch === '\n' || ch === '\t') {
      salida += ch;
      continue;
    }
    if (cp < 0x20) continue; // controles (salvo \n\t): eliminar
    if (cp === 0x7f) continue; // DEL
    if (cp === 0xfeff || cp === 0x200b || cp === 0x200c || cp === 0x200d || cp === 0x2060) continue; // invisibles
    const mapped = MAPA_WINANSI[ch];
    if (mapped !== undefined) {
      salida += mapped;
      continue;
    }
    if (esWinAnsi(cp) || EXTRA_CP1252.has(cp)) {
      salida += ch;
      continue;
    }
    // Último recurso: transliteración Unicode→ASCII si existe, si no, quitar
    salida += ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    const ultimo = salida[salida.length - 1];
    if (ultimo && !/[\x20-\x7e\u00a0-\u00ff]/.test(ultimo) && !EXTRA_CP1252.has(ultimo.codePointAt(0)!)) {
      salida = salida.slice(0, -1);
    }
  }
  return salida;
}

/** ¿Queda algún carácter NO representable en WinAnsi tras asegurarTexto?
 *  Utilidad para pruebas: el texto canónico de salida debe ser SIEMPRE
 *  representable (misión §3.3: «crear pruebas que detecten caracteres de
 *  control inesperados»). */
export function caracteresNoWinAnsi(texto: string): string[] {
  const fuera: string[] = [];
  for (const ch of asegurarTexto(texto)) {
    const cp = ch.codePointAt(0)!;
    if (ch === '\n' || ch === '\t') continue;
    if (cp < 0x20 || cp === 0x7f) {
      fuera.push(`U+${cp.toString(16).padStart(4, '0')}`);
      continue;
    }
    if (!esWinAnsi(cp) && !EXTRA_CP1252.has(cp)) fuera.push(`U+${cp.toString(16).padStart(4, '0')}`);
  }
  return fuera;
}
