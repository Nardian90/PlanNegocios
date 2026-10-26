// ============================================================================
// DOC-003-R1 §6 — Utilidad de auditoría documental: POSICIONES REALES del
// texto y los filetes dibujados, extraídas de los flujos de contenido del
// PDF (jsPDF escribe sin compresión, de modo que los operadores Td/Tj y
// m/l S son directamente legibles).
//
// Las pruebas de colisión NO consultan valores internos del compositor:
// miden lo que el PDF realmente dibuja.
// ============================================================================
const PT = 2.8346; // pt → mm

export interface RunTexto {
  pagina: number;
  x: number; // mm desde el borde izquierdo (inicio de avance del Tj)
  y: number; // mm desde el borde SUPERIOR (línea base del Tj)
  size: number; // pt
  texto: string;
  color: [number, number, number]; // relleno (0–1)
  fuente: string; // /F1, /F2, …
}

export interface Segmento {
  pagina: number;
  x1: number;
  y1: number; // mm, desde arriba
  x2: number;
  y2: number;
  color: [number, number, number];
  anchoMm: number;
}

export interface PaginaPDF {
  numero: number;
  anchoPt: number;
  altoPt: number;
  apaisada: boolean;
}

/** Decodifica una cadena literal de PDF ((…) Tj) a texto plano. */
function decodificar(s: string): string {
  return s
    .replace(/\\([nrtbf()\\])/g, (_m, c: string) => {
      switch (c) {
        case 'n':
          return '\n';
        case 'r':
          return '\r';
        case 't':
          return '\t';
        default:
          return c;
      }
    })
    .replace(/\\([0-7]{1,3})/g, (_m, oct: string) => String.fromCharCode(parseInt(oct, 8)));
}

export interface PDFParseado {
  runs: RunTexto[];
  segmentos: Segmento[];
  paginas: PaginaPDF[];
}

/** Extrae las posiciones reales de texto y líneas vectoriales del PDF. */
export function parsearPDF(buf: Buffer): PDFParseado {
  const s = buf.toString('latin1');
  // --- objetos: mapa número → cuerpo (dict + stream opcional) ---
  const objetos = new Map<number, { dict: string; stream: string }>();
  const reObj = /(\d+) 0 obj([\s\S]*?)endobj/g;
  let m: RegExpExecArray | null;
  while ((m = reObj.exec(s))) {
    const cuerpo = m[2];
    const dict = cuerpo.match(/<<[\s\S]*?>>/)?.[0] ?? '';
    const iStream = cuerpo.indexOf('stream');
    const stream =
      iStream >= 0
        ? cuerpo.slice(iStream + 'stream'.length).replace(/^\r?\n/, '').replace(/endstream\s*$/, '')
        : '';
    objetos.set(Number(m[1]), { dict, stream });
  }
  // --- páginas en orden: objetos con /Type /Page (no /Pages) ---
  const paginasInfo: { contents: number[]; mediaBox: [number, number, number, number] }[] = [];
  for (const [, obj] of objetos) {
    if (!/\/Type\s*\/Page[^s]/.test(obj.dict)) continue;
    const mb = obj.dict.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    const mediaBox: [number, number, number, number] = mb
      ? [Number(mb[1]), Number(mb[2]), Number(mb[3]), Number(mb[4])]
      : [0, 0, 595.28, 841.89];
    const contents: number[] = [];
    const arr = obj.dict.match(/\/Contents\s*\[([^\]]*)\]/);
    if (arr) {
      for (const p of arr[1].matchAll(/(\d+)\s+0\s+R/g)) contents.push(Number(p[1]));
    } else {
      const uno = obj.dict.match(/\/Contents\s+(\d+)\s+0\s+R/);
      if (uno) contents.push(Number(uno[1]));
    }
    paginasInfo.push({ contents, mediaBox });
  }

  const runs: RunTexto[] = [];
  const segmentos: Segmento[] = [];
  const paginas: PaginaPDF[] = [];

  paginasInfo.forEach((info, idx) => {
    const [, , anchoPt, altoPt] = info.mediaBox;
    paginas.push({ numero: idx + 1, anchoPt, altoPt, apaisada: anchoPt > altoPt });
    const stream = info.contents.map((c) => objetos.get(c)?.stream ?? '').join('\n');
    // --- texto: cada BT…ET es una llamada text() ---
    const reBT = /BT([\s\S]*?)ET/g;
    let bt: RegExpExecArray | null;
    while ((bt = reBT.exec(stream))) {
      const bloque = bt[1];
      const fT = bloque.match(/\/(F\d+)\s+([\d.]+)\s+Tf/);
      const td = bloque.match(/(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+Td/);
      const tj = bloque.match(/\(((?:\\.|[^\\)])*)\)\s*Tj/);
      if (!fT || !td || !tj) continue;
      const rg = bloque.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/);
      runs.push({
        pagina: idx + 1,
        x: Number(td[1]) / PT,
        y: (altoPt - Number(td[2])) / PT,
        size: Number(fT[2]),
        texto: decodificar(tj[1]),
        color: rg ? [Number(rg[1]), Number(rg[2]), Number(rg[3])] : [0, 0, 0],
        fuente: fT[1],
      });
    }
    // --- segmentos trazados: color RG → grosor w → path m/l S ---
    const reLinea =
      /([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+RG\s+([\d.]+)\s+w\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+m\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+l\s+S/g;
    let ln: RegExpExecArray | null;
    while ((ln = reLinea.exec(stream))) {
      segmentos.push({
        pagina: idx + 1,
        color: [Number(ln[1]), Number(ln[2]), Number(ln[3])],
        anchoMm: Number(ln[4]) / PT,
        x1: Number(ln[5]) / PT,
        y1: (altoPt - Number(ln[6])) / PT,
        x2: Number(ln[7]) / PT,
        y2: (altoPt - Number(ln[8])) / PT,
      });
    }
  });

  return { runs, segmentos, paginas };
}

/** ¿Fuente en negrita? (numeración FIJA de jsPDF: F2/F4 = Helvetica-Bold). */
export function esNegrita(fuente: string): boolean {
  const n = Number(fuente.replace(/[^0-9]/g, ''));
  return n === 2 || n === 4;
}

/** ¿Color ámbar del filete de análisis (217, 119, 6)? */
export function esAmbar(c: [number, number, number]): boolean {
  const [r, g, b] = c;
  return Math.abs(r - 217 / 255) < 0.02 && Math.abs(g - 119 / 255) < 0.02 && Math.abs(b - 6 / 255) < 0.02;
}
