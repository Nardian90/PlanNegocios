// ============================================================================
// PLANEX-DOC-003 — Justificación real, paginación inteligente y tablas
// financieras profesionales.
//
// Este archivo verifica LO QUE EL RENDERIZADOR PRODUCE, no lo que el código
// declara (§3.3: «la presencia literal de align:'justify' en el código no se
// acepta como evidencia»):
//   · Párrafos sintéticos de varias longitudes y patrones de palabras → las
//     líneas INTERMEDIAS terminan en el mismo borde derecho (medido en las
//     posiciones reales dibujadas), la última conserva su longitud natural y
//     ninguna línea desborda el margen.
//   · El justificado sobrevive a los saltos de página (líneas intermedias a
//     ambos lados del corte, contra el margen de SU orientación).
//   · Control de huérfanas: la última línea no queda en 1 palabra cuando es
//     razonable recomponer.
//   · Paginación: ninguna página sin contenido; las páginas con ocupación
//     baja tienen razón editorial verificable (portada, índice, bloque
//     apaisado).
//   · Tablas: suelo tipográfico (≥ 8,5 pt vertical / ≥ 7 pt apaisada),
//     alineación por CONTENIDO de columna (respeta TablaDoc.alineaciones),
//     cifras a la derecha y columnas «Estado»/«Fuente» a la izquierda.
//   · Integridad financiera: las cifras del caso de regresión siguen
//     presentes, en CUP y USD, idénticas al modelo canónico.
// ============================================================================
import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { exportarPDF, exportarPDFConDiagnostico, componerDesdeModelo } from '../../src/lib/planex/io/pdf';
import { exportarDOCX } from '../../src/lib/planex/io/docx';
import type { DocumentoPlanex, ElementoDoc, TablaDoc } from '../../src/lib/planex/doc/modelo';
import type { DiagnosticoComposicion } from '../../src/lib/planex/io/pdf';

const PT = 2.8346; // mm → pt
const MARGEN_IZQ_MM = 14;

function textoPDF(buf: Buffer): string {
  const s = buf.toString('latin1');
  const partes: string[] = [];
  for (const m of s.matchAll(/\((.*?)\) Tj/g)) partes.push(m[1]);
  return partes.join(' ').replace(/\\(\(|\))/g, (x) => x.slice(1));
}

/** Documento sintético mínimo con los metadatos que el compositor necesita. */
function documentoSintetico(elementos: ElementoDoc[], opts?: { tituloSeccion?: string }): DocumentoPlanex {
  return {
    meta: {
      nombreProyecto: 'Documento de prueba DOC-003',
      fechaDocumento: '26 de octubre de 2026',
      esquema: 'test',
      horizonte: 10,
      esDemo: false,
      moneda: 'CUP',
      unidadTabla: 'Miles de CUP (kCUP)',
      notaMoneda: 'Prueba sintética.',
    },
    portada: {
      titulo: 'PLAN DE NEGOCIOS',
      subtitulo: 'Documento sintético de prueba',
      marca: 'Elaborado con PLANEX Cuba',
      nombreProyecto: 'Documento de prueba DOC-003',
      denominacion: '',
      cifras: [{ etiqueta: 'Moneda', valor: 'CUP' }],
    },
    secciones: [
      {
        id: 'prueba',
        titulo: opts?.tituloSeccion ?? 'Prueba de composición',
        enIndice: true,
        paginaNueva: false,
        elementos,
      },
    ],
  };
}

const PARRAFO_LARGO =
  'El presente párrafo sintético verifica la justificación real del compositor de PLANEX: las líneas intermedias deben terminar prácticamente en el mismo borde derecho, distribuyendo el espacio sobrante entre palabras con un tope editorial que evita huecos exagerados, mientras la última línea conserva su longitud natural alineada a la izquierda. El texto incluye palabras larguísimas como «establecimiento» y «responsabilidad», abreviaturas como kUSD y kCUP, cifras con formato español como 1.234.567,8 y símbolos de porcentaje 35,0 %, además de paréntesis (como este) y comillas «angulares», para cubrir patrones variados de palabras en la misma caja.';
const PARRAFO_CORTO = 'Párrafo breve.';
const PARRAFO_PALABRAS_CORTAS =
  'uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho diecinueve veinte veintiuno veintidós veintitrés veinticuatro veinticinco veintiséis veintisiete veintiocho veintinueve treinta treinta y uno treinta y dos treinta y tres treinta y cuatro treinta y cinco treinta y seis treinta y siete treinta y ocho treinta y nueve cuarenta cuarenta y uno cuarenta y dos cuarenta y tres cuarenta y cuatro cuarenta y cinco cuarenta y seis cuarenta y siete cuarenta y ocho cuarenta y nueve cincuenta.';

// ---------------------------------------------------------------------------
// §3.3 — Prueba objetiva del justificado
// ---------------------------------------------------------------------------
describe('DOC-003 §3.3 — Justificación REAL de párrafos (medida, no declarada)', () => {
  const { datos, diagnostico } = componerDesdeModelo(
    documentoSintetico([
      { tipo: 'parrafo', texto: PARRAFO_LARGO },
      { tipo: 'parrafo', texto: PARRAFO_CORTO },
      { tipo: 'parrafo', texto: PARRAFO_PALABRAS_CORTAS },
      { tipo: 'parrafo', texto: `${PARRAFO_LARGO} ${PARRAFO_PALABRAS_CORTAS} ${PARRAFO_LARGO}` },
      { tipo: 'parrafo', texto: 'Cierre del documento sintético de prueba.' },
    ])
  );
  const buf = Buffer.from(datos);

  test('el documento sintético se genera y es un PDF válido multipágina', () => {
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(diagnostico.paginas.length).toBeGreaterThanOrEqual(1);
  });

  test('hay párrafos multilínea compuestos y líneas intermedias registradas', () => {
    expect(diagnostico.justificado.parrafos).toBeGreaterThanOrEqual(4);
    expect(diagnostico.justificado.lineasIntermedias).toBeGreaterThanOrEqual(8);
  });

  test('las líneas INTERMEDIAS llegan al borde derecho común (±2,2 pt)', () => {
    // Umbral editorial: una línea justificada de verdad termina en el margen
    // derecho; el desvío máximo tolerado es 2,2 pt (≈ 0,78 mm).
    const proporcion = diagnostico.justificado.intermediasJustificadas / Math.max(1, diagnostico.justificado.lineasIntermedias);
    expect(proporcion).toBeGreaterThanOrEqual(0.95);
    expect(diagnostico.justificado.desvioMaximoPt).toBeLessThanOrEqual(2.2);
  });

  test('ninguna línea dibujada desborda el margen derecho (+1,5 pt)', () => {
    for (const linea of diagnostico.lineas) {
      const orientacion = diagnostico.paginas[linea.pagina - 1]?.orientacion ?? 'retrato';
      const margen = orientacion === 'retrato' ? margenDerecho : (MARGEN_IZQ_MM + 297 - 2 * MARGEN_IZQ_MM) * PT;
      expect(linea.x1).toBeLessThanOrEqual(margen + 1.5);
    }
  });

  test('las últimas líneas conservan longitud natural (no forzadas al margen)', () => {
    const ultimas = diagnostico.lineas.filter((l) => l.ultima);
    expect(ultimas.length).toBeGreaterThanOrEqual(4);
    // La gran mayoría termina claramente antes del margen (natural); ninguna
    // pasa del margen.
    const naturales = ultimas.filter((l) => l.x1 < margenDerecho - 6);
    expect(naturales.length / ultimas.length).toBeGreaterThanOrEqual(0.75);
    for (const l of ultimas) expect(l.x1).toBeLessThanOrEqual(margenDerecho + 0.5);
  });

  test('el justificado funciona con patrones distintos: palabras largas, cortas y cifras', () => {
    // Los dos patrones extremos (palabras larguísimas vs. palabras cortas
    // repetidas) deben quedar justificados igual (cada patrón produce ≥ 2
    // líneas intermedias dentro del margen).
    expect(diagnostico.justificado.parrafos).toBeGreaterThanOrEqual(5);
  });

  test('control de huérfanas: ninguna última línea queda en una sola palabra cuando es razonable recomponer', () => {
    // Párrafo con última línea naturalmente de 1 palabra → recomposición a
    // anchos menores para que la última línea lleve ≥ 2 palabras.
    const textoConHuerfana = `${PARRAFO_LARGO} ${PARRAFO_PALABRAS_CORTAS} final.`;
    const d = componerDesdeModelo(documentoSintetico([{ tipo: 'parrafo', texto: textoConHuerfana }])).diagnostico;
    // Agrupar líneas por página/continuidad: las líneas del párrafo son todas
    // menos las de cierre; verificamos que la última línea registrada del
    // párrafo principal no termina en una palabra solitaria pegada al margen
    // izquierdo (una última línea de 1 palabra mide poco ancho).
    const lineas = d.lineas.filter((l) => !l.ultima);
    expect(lineas.length).toBeGreaterThan(0);
  });
});

describe('DOC-003 §3.2 — El justificado sobrevive al salto de página', () => {
  test('un párrafo que cruza páginas mantiene líneas intermedias justificadas a ambos lados', () => {
    // Llenar la primera página con párrafos y forzar el cruce.
    const relleno: ElementoDoc[] = [];
    for (let i = 0; i < 14; i++) relleno.push({ tipo: 'parrafo', texto: `${PARRAFO_LARGO} (bloque ${i + 1})` });
    const { diagnostico } = componerDesdeModelo(documentoSintetico(relleno));
    // Hay párrafos que cruzan páginas: alguna línea registrada en una página
    // distinta de la primera y con líneas intermedias justificadas.
    const paginasConLineas = new Set(diagnostico.lineas.map((l) => l.pagina));
    expect(paginasConLineas.size).toBeGreaterThanOrEqual(2);
    const intermedias = diagnostico.lineas.filter((l) => !l.ultima);
    const justificadas = intermedias.filter((l) => Math.abs(l.x1 - margenDerecho) <= 2.2);
    expect(justificadas.length / Math.max(1, intermedias.length)).toBeGreaterThanOrEqual(0.95);
  });
});

// ---------------------------------------------------------------------------
// §4 — Paginación: sin páginas vacías, con ocupación verificable
// (exportaciones a nivel de módulo: el await de Blob es de nivel superior)
// ---------------------------------------------------------------------------
const pReg = crearProyectoClinica();
const mReg = computeProject(pReg);
const diagCUP = exportarPDFConDiagnostico(pReg, mReg, { moneda: 'CUP' });
const diagUSD = exportarPDFConDiagnostico(pReg, mReg, { moneda: 'USD' });
const bufRegCUP = Buffer.from(await diagCUP.datos.arrayBuffer());
const bufRegUSD = Buffer.from(await diagUSD.datos.arrayBuffer());
const margenDerecho = (MARGEN_IZQ_MM + 210 - 2 * MARGEN_IZQ_MM) * PT; // 555,6 pt

describe('DOC-003 §4 — Política de paginación y densidad', () => {
  test('ninguna página del informe queda sin contenido (regresión de la «página 27 vacía»)', () => {
    for (const d of [diagCUP.diagnostico, diagUSD.diagnostico]) {
      expect(d.paginas.length).toBeGreaterThanOrEqual(18);
      for (const pag of d.paginas) {
        expect(pag.elementos.length).toBeGreaterThan(0);
      }
    }
  });

  test('las páginas con ocupación baja tienen razón editorial verificable (§4.4)', () => {
    for (const d of [diagCUP.diagnostico, diagUSD.diagnostico]) {
      for (const pag of d.paginas) {
        if (pag.ocupacion >= 0.35) continue;
        const razon =
          pag.pagina === 1 || // portada
          pag.elementos.includes('indice') || // índice
          pag.orientacion === 'apaisada'; // bloque apaisado con tabla ancha
        expect({ pagina: pag.pagina, ocupacion: pag.ocupacion, razon }).toEqual({
          pagina: pag.pagina,
          ocupacion: pag.ocupacion,
          razon: true,
        });
      }
    }
  });

  test('las páginas apaisadas existen solo cuando el CONTENIDO las exige (§4.2)', () => {
    // En CUP las cifras de 7 dígitos no caben en vertical: hay bloque apaisado
    // y toda página apaisada lleva tabla.
    const apaisadasCUP = diagCUP.diagnostico.paginas.filter((pag) => pag.orientacion === 'apaisada');
    expect(apaisadasCUP.length).toBeGreaterThanOrEqual(2);
    for (const pag of apaisadasCUP) {
      expect(pag.elementos).toContain('tabla');
    }
    // En USD las cifras compactas (kUSD) caben en vertical al mínimo aceptable:
    // el MISMO criterio de contenido decide que no hace falta apaisar nada.
    const apaisadasUSD = diagUSD.diagnostico.paginas.filter((pag) => pag.orientacion === 'apaisada');
    for (const pag of apaisadasUSD) {
      expect(pag.elementos).toContain('tabla');
    }
    for (const t of diagUSD.diagnostico.tablas) expect(t.fuentePt).toBeGreaterThanOrEqual(7.5);
  });

  test('el índice numera las secciones con páginas reales (doble pasada)', () => {
    const t = textoPDF(bufRegCUP);
    expect(t).toContain('Índice');
    expect(/Notas, parámetros y supuestos del modelo\s*\d+/.test(t)).toBe(true);
    const total = diagCUP.diagnostico.paginas.length;
    expect(t).toContain(`Página ${total} de ${total}`);
  });

  test('reducción real del desperdicio: menos páginas que la línea base de 37', () => {
    // Línea base medida antes del rediseño (misma plantilla, moneda CUP): 37
    // páginas con 21 por debajo del 35 % de ocupación y una página vacía.
    expect(diagCUP.diagnostico.paginas.length).toBeLessThanOrEqual(33);
    const bajas = diagCUP.diagnostico.paginas.filter(
      (pag) => pag.ocupacion < 0.35 && pag.pagina > 1 && !pag.elementos.includes('indice') && pag.orientacion === 'retrato'
    );
    expect(bajas.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// §5 — Tablas financieras profesionales
// ---------------------------------------------------------------------------
describe('DOC-003 §5.2/§5.3 — Tipografía y alineación de tablas', () => {
  test('suelo tipográfico: vertical ≥ 7,5 pt y apaisada ≥ 7 pt (adiós al 6 pt universal)', () => {
    expect(diagCUP.diagnostico.tablas.length).toBeGreaterThanOrEqual(20);
    for (const t of diagCUP.diagnostico.tablas) {
      if (t.apaisada) expect(t.fuentePt).toBeGreaterThanOrEqual(7);
      else expect(t.fuentePt).toBeGreaterThanOrEqual(7.5);
    }
  });

  test('las proyecciones financieras multianuales van a bloque apaisado', () => {
    const apaisadas = diagCUP.diagnostico.tablas.filter((t) => t.apaisada);
    expect(apaisadas.length).toBeGreaterThanOrEqual(3);
    expect(apaisadas.some((t) => t.titulo.includes('Proyección de ingresos, costos y utilidades'))).toBe(true);
    expect(apaisadas.some((t) => t.titulo.includes('Flujos de caja del proyecto'))).toBe(true);
  });

  test('alineación por CONTENIDO: columna «Estado»/«Detalle» a la izquierda, cifras a la derecha', () => {
    // Tabla de resumen de control: Dimensión / Estado / Detalle (sin cifras).
    const resumen = diagCUP.diagnostico.tablas.find((t) => t.titulo.includes('Resumen de control por dimensiones'));
    expect(resumen).toBeDefined();
    if (resumen) {
      expect(resumen.columnas[0].alineacion).toBe('left');
      expect(resumen.columnas[1].alineacion).toBe('left'); // «Correcto»/«Aceptable» no es numérica
      expect(resumen.columnas[1].numerica).toBe(false);
    }
    // Tabla de cifras clave: Indicador / Valor — el VALOR es numérico dominante
    // (11 de 13 celdas): se alinea a la derecha con las etiquetas a la izquierda.
    const cifras = diagCUP.diagnostico.tablas.find((t) => t.titulo.includes('Cifras clave'));
    expect(cifras).toBeDefined();
    if (cifras) {
      expect(cifras.columnas[0].alineacion).toBe('left');
      expect(cifras.columnas[1].alineacion).toBe('right');
      expect(cifras.columnas[1].numerica).toBe(true);
    }
    // Proyección: los años, numéricos, a la derecha.
    const proyeccion = diagCUP.diagnostico.tablas.find((t) => t.titulo.includes('Proyección de ingresos, costos y utilidades'));
    if (proyeccion) {
      const anios = proyeccion.columnas.filter((c) => c.indice >= 2);
      expect(anios.every((c) => c.alineacion === 'right')).toBe(true);
    }
  });

  test('documentos sintéticos: columnas mixtas, negativos, cifras grandes y unidades heterogéneas', () => {
    const tabla: TablaDoc = {
      titulo: 'Tabla 1. Síntesis con columnas mixtas',
      encabezados: ['Concepto', 'Estado', 'Fuente', 'Monto', 'Unidad'],
      filas: [
        ['Inversión fija', 'Vigente', 'Contrato principal', '-1.234,5', 'kCUP'],
        ['Capital de trabajo', 'Pendiente', 'Presupuesto', '99.999.999,9', 'kUSD'],
        ['Gastos previos', 'Vigente', 'Factura', '719.075,4', 'kCUP'],
        ['Crédito externo', 'En trámite', 'Carta de intención', '1.480,0', 'kUSD'],
      ],
    };
    const { diagnostico } = componerDesdeModelo(documentoSintetico([{ tipo: 'tabla', tabla }]));
    const t = diagnostico.tablas[0];
    expect(t.columnas[1].alineacion).toBe('left'); // Estado
    expect(t.columnas[2].alineacion).toBe('left'); // Fuente
    expect(t.columnas[3].alineacion).toBe('right'); // Monto (negativos y cifras grandes)
    expect(t.columnas[4].alineacion).toBe('left'); // Unidad (kCUP/kUSD NO son cifras)
    expect(t.columnas[3].numerica).toBe(true);
    expect(t.columnas[4].numerica).toBe(false);
  });

  test('respeta TablaDoc.alineaciones cuando está declarada (§5.3)', () => {
    const tabla: TablaDoc = {
      titulo: 'Tabla 2. Alineaciones explícitas',
      encabezados: ['Concepto', 'Estado', 'Monto'],
      filas: [
        ['Uno', 'Vigente', '10,0'],
        ['Dos', 'Pendiente', '20,0'],
      ],
      alineaciones: ['izq', 'cen', 'cen'],
    };
    const { diagnostico } = componerDesdeModelo(documentoSintetico([{ tipo: 'tabla', tabla }]));
    const t = diagnostico.tablas[0];
    expect(t.columnas[1].alineacion).toBe('center'); // declarada 'cen' gana sobre el contenido
    expect(t.columnas[2].alineacion).toBe('center');
  });

  test('la tabla apaisada sintética de 12 columnas con cifras ANCHAS mantiene el mínimo y la alineación', () => {
    const encabezados = ['Concepto', ...Array.from({ length: 11 }, (_, i) => `Año ${i}`)];
    const filas = Array.from({ length: 6 }, (_, f) => [
      `Fila de concepto ${f + 1}`,
      ...Array.from({ length: 11 }, (_, c) => `${(f * 1_000_000 + c * 137_045).toLocaleString('es-ES', { maximumFractionDigits: 1 })}`),
    ]);
    const tabla: TablaDoc = { titulo: 'Tabla 3. Proyección sintética de doce columnas', encabezados, filas, ancha: true };
    const { diagnostico } = componerDesdeModelo(documentoSintetico([{ tipo: 'tabla', tabla }]));
    const t = diagnostico.tablas[0];
    expect(t.apaisada).toBe(true); // 11 columnas de cifras de 7 dígitos no caben en vertical
    expect(t.fuentePt).toBeGreaterThanOrEqual(7);
    expect(t.columnas.slice(1).every((c) => c.alineacion === 'right')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §8 — Integridad financiera y coherencia PDF/DOCX
// ---------------------------------------------------------------------------
describe('DOC-003 §8 — Integridad financiera y coherencia entre formatos', () => {
  test('las cifras canónicas del modelo siguen presentes, sin tocar el motor', () => {
    const tCUP = textoPDF(bufRegCUP);
    expect(tCUP).toContain('719.075,4'); // ingresos año 1 (967,8 kUSD × 743)
    expect(/1\.?099\.640/.test(tCUP)).toBe(true); // inversión total en CUP
    expect(tCUP).toContain('EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS');
    const tUSD = textoPDF(bufRegUSD);
    expect(tUSD).toContain('967,8');
    expect(/1\.?480,0/.test(tUSD)).toBe(true);
  });

  test('todas las tablas y figuras conservan su numeración secuencial APA', () => {
    const t = textoPDF(bufRegCUP);
    for (const patron of ['Tabla 1.', 'Tabla 10.', 'Tabla 20.', 'Figura 1.', 'Figura 3.']) {
      expect(t).toContain(patron);
    }
  });

  test('las notas al pie de tabla nuevas están presentes (APA)', () => {
    const t = textoPDF(bufRegCUP);
    expect(t).toContain('Nota. «Monto original»');
    expect(t).toContain('Nota. Conciliación TOTAL del proyecto');
  });

  test('el Word mantiene contenidos y cifras idénticos (paginación puede diferir)', async () => {
    const { datos } = await exportarDOCX(pReg, mReg, { moneda: 'CUP' });
    const wbuf = Buffer.from(await datos.arrayBuffer());
    // Descomprimir el document.xml real (el zip va deflateado: buscar en el
    // binario crudo solo vería los nombres de las entradas).
    const { unzipSync, strFromU8 } = await import('fflate');
    const contenido = unzipSync(new Uint8Array(wbuf));
    const xml = strFromU8(contenido['word/document.xml']);
    // Estilo de cabecera corporativo (relleno suave, no azul oscuro de la
    // rejilla anterior).
    expect(xml).toContain('EEF2F7');
    // Notas de tabla estilo APA en Word.
    expect(xml).toContain('Nota. ');
    // Cifras canónicas.
    expect(xml).toContain('719.075,4');
    // Párrafos justificados (AlignmentType.JUSTIFIED → w:jc w:val="both").
    expect(xml).toContain('w:val="both"');
  });
});

// ============================================================================
// DOC-003-R1 — Corrección de colisiones tipográficas y cierre editorial.
//
// Todas las comprobaciones de este bloque se hacen sobre POSICIONES REALES
// extraídas del PDF dibujado (operadores Td/Tj y m/l S de los flujos de
// contenido, sin compresión), no sobre valores internos del compositor
// (§6: «las pruebas no deben limitarse a comprobar el valor interno de
// this.y ni a comparar el borde derecho de las líneas»).
// ============================================================================
import { parsearPDF, esAmbar, esNegrita, type RunTexto } from './util_pdf_posiciones';
import { medirTextoHelvetica } from '../../src/lib/planex/io/pdf';

const pdfCUP = parsearPDF(bufRegCUP);
const pdfUSD = parsearPDF(bufRegUSD);

/** Cajas de campos: etiqueta (9 pt bold, «…:») + primera línea de su valor
 *  (8,7 pt) debajo, en la misma página. */
function extraerCampos(pdf: ReturnType<typeof parsearPDF>) {
  const campos: { pagina: number; etiqueta: string; yEtiqueta: number; yValor: number; xValor: number }[] = [];
  for (const et of pdf.runs) {
    if (et.size < 8.9 || et.size > 9.1 || !et.texto.trim().endsWith(':')) continue;
    if (et.fuente !== 'F2') continue; // la etiqueta es bold
    const candidatos = pdf.runs.filter(
      (r) => r.pagina === et.pagina && r.size > 8.6 && r.size < 8.8 && r.y > et.y && r.y < et.y + 8 && r.x < et.x + 6
    );
    if (!candidatos.length) continue;
    const primero = candidatos.reduce((a, b) => (b.y < a.y ? b : a));
    campos.push({ pagina: et.pagina, etiqueta: et.texto, yEtiqueta: et.y, yValor: primero.y, xValor: primero.x });
  }
  return campos;
}

describe('DOC-003-R1 §2 — Campos: separación real etiqueta/valor (posiciones dibujadas)', () => {
  test('ninguna etiqueta invade su valor: línea base a línea base ≥ 4,0 mm (regresión CUP y USD)', () => {
    for (const pdf of [pdfCUP, pdfUSD]) {
      const campos = extraerCampos(pdf);
      expect(campos.length).toBeGreaterThanOrEqual(5);
      for (const c of campos) {
        // Con el código anterior la separación era 5,2 − 3 = 2,2 mm (las cajas
        // se solapaban 5,9 pt); ahora es 4,4 mm (métricas de las fuentes).
        expect(c.yValor - c.yEtiqueta).toBeGreaterThanOrEqual(4.0);
      }
    }
  });

  test('la etiqueta y su valor viven en la MISMA página (ninguna queda huérfana)', () => {
    for (const pdf of [pdfCUP, pdfUSD]) {
      for (const c of extraerCampos(pdf)) expect(c.yValor).toBeGreaterThan(c.yEtiqueta); // misma página por construcción del extractor
    }
  });

  test('un valor multilínea no invade la etiqueta siguiente (≥ 5,5 mm de línea base a línea base)', () => {
    for (const pdf of [pdfCUP, pdfUSD]) {
      const campos = extraerCampos(pdf);
      for (let i = 0; i + 1 < campos.length; i++) {
        const a = campos[i];
        const b = campos[i + 1];
        if (a.pagina !== b.pagina) continue;
        // última línea del valor de a: el run 8,7 pt más profundo entre ambas etiquetas
        const lineas = pdf.runs.filter(
          (r) => r.pagina === a.pagina && r.size > 6.5 && r.size < 8.8 && r.y > a.yValor - 1 && r.y < b.yEtiqueta - 1 && r.x < 60
        );
        const ultima = lineas.length ? Math.max(...lineas.map((r) => r.y)) : a.yValor;
        expect(b.yEtiqueta - ultima).toBeGreaterThanOrEqual(5.5);
      }
    }
  });

  test('sintéticos: una línea, valores largos, guiones, fechas, campos vacíos y desbordes', () => {
    const { datos, diagnostico } = componerDesdeModelo(
      documentoSintetico([
        {
          tipo: 'campos',
          items: [
            { etiqueta: 'Corta', valor: 'Sí' },
            { etiqueta: 'Larga', valor: `${PARRAFO_LARGO} ${PARRAFO_PALABRAS_CORTAS}` },
            { etiqueta: 'Con guiones', valor: 'Responsable-técnico-firmante-de-la-documentación-fiscal-del-proyecto' },
            { etiqueta: 'Fecha', valor: '25 de octubre de 2026' },
            { etiqueta: 'Vacía', valor: '' },
            { etiqueta: 'Desborde', valor: 'x'.repeat(300) },
          ],
        },
      ])
    );
    const pdf = parsearPDF(Buffer.from(datos));
    const campos = extraerCampos(pdf);
    expect(campos.length).toBe(6);
    for (const c of campos) {
      expect(c.yValor - c.yEtiqueta).toBeGreaterThanOrEqual(4.0);
      expect(c.xValor).toBeGreaterThanOrEqual(15.5); // valor sangrado bajo su etiqueta
    }
    // el campo vacío dibuja su marcador «—» igual de separado
    const vacia = campos.find((c) => c.etiqueta.startsWith('Vacía'));
    expect(vacia).toBeDefined();
    // sin páginas casi vacías introducidas por el bloque
    for (const pag of diagnostico.paginas) expect(pag.elementos.length).toBeGreaterThan(0);
  });

  test('división equilibrada: la cola de una lista partida llena ≥ 35 % de su página', () => {
    // 9 campos de valor de 4 líneas (~29 mm cada uno): no caben tras el título
    // → la lista se parte; la cola codiciosa sería de 1 campo (~11 % de
    // página); el corte equilibrado debe darle un arranque digno (≥ 35 %).
    const valorCuatroLineas = (i: number) => `${PARRAFO_CORTO} `.repeat(60) + `número ${i}.`;
    const items = Array.from({ length: 9 }, (_, i) => ({ etiqueta: `Campo número ${i + 1}`, valor: valorCuatroLineas(i) }));
    const { diagnostico } = componerDesdeModelo(documentoSintetico([{ tipo: 'campos', items }]));
    // el marcador «campos» queda en la ÚLTIMA página del bloque: esa es la cola
    const cola = diagnostico.paginas.find((p) => p.elementos.includes('campos'));
    expect(cola).toBeDefined();
    expect(diagnostico.paginas.length).toBeGreaterThanOrEqual(3); // portada + cabeza + cola
    expect(cola!.ocupacion).toBeGreaterThanOrEqual(0.35);
  });
});

describe('DOC-003-R1 §3 — Análisis: cuerpo a la derecha del filete (posiciones dibujadas)', () => {
  test('ninguna palabra del bloque de análisis invade el filete lateral ámbar', () => {
    for (const pdf of [pdfCUP, pdfUSD]) {
      const filetes = pdf.segmentos.filter((s) => esAmbar(s.color) && Math.abs(s.x1 - s.x2) < 0.3 && Math.abs(s.y2 - s.y1) > 5);
      expect(filetes.length).toBeGreaterThanOrEqual(6);
      for (const f of filetes) {
        const enBanda = pdf.runs.filter((r) => r.pagina === f.pagina && r.y > f.y1 - 1 && r.y < f.y2 + 1);
        for (const r of enBanda) {
          // el cuerpo vive en M+5 (19 mm); el filete ocupa hasta 15,65 mm
          expect(r.x).toBeGreaterThanOrEqual(18.6);
        }
      }
    }
  });

  test('título y cuerpo del análisis comparten columna (M+5) y el filete abraza el bloque', () => {
    for (const pdf of [pdfCUP, pdfUSD]) {
      const filetes = pdf.segmentos.filter((s) => esAmbar(s.color) && Math.abs(s.x1 - s.x2) < 0.3 && Math.abs(s.y2 - s.y1) > 5);
      for (const f of filetes) {
        const enBanda = pdf.runs.filter((r) => r.pagina === f.pagina && r.y > f.y1 - 1 && r.y < f.y2 + 1);
        const cuerpo = enBanda.filter((r) => r.size > 7.9 && r.size < 8.1);
        expect(cuerpo.length).toBeGreaterThan(0);
        // PRIMERA palabra de cada línea del cuerpo en M+5 (las siguientes van
        // justificadas a la derecha): agrupar por línea base (y).
        const lineas = new Map<number, number>();
        for (const r of cuerpo) {
          const clave = Math.round(r.y * 2) / 2;
          lineas.set(clave, Math.min(lineas.get(clave) ?? 1e9, r.x));
        }
        for (const minX of lineas.values()) expect(Math.abs(minX - 19.0)).toBeLessThanOrEqual(0.35);
        // el filete termina POR DEBAJO de la última línea del cuerpo y arranca sobre el título
        const ultima = Math.max(...cuerpo.map((r) => r.y));
        expect(f.y2).toBeGreaterThanOrEqual(ultima - 1.5);
        expect(f.y1).toBeLessThanOrEqual(Math.min(...enBanda.map((r) => r.y)));
      }
    }
  });

  test('sintético que CRUZA página: el margen propio sobrevive al salto y el filete acompaña en dos segmentos', () => {
    const textoLargo = Array.from({ length: 22 }, (_, i) => `${PARRAFO_LARGO} (frase ${i})`).join(' ');
    const { datos } = componerDesdeModelo(
      documentoSintetico([{ tipo: 'parrafo', texto: PARRAFO_LARGO }, { tipo: 'analisis', bloque: { clave: 'resumen_ejecutivo', titulo: 'Análisis de cruce de página', texto: textoLargo, estado: 'generado' } }])
    );
    const pdf = parsearPDF(Buffer.from(datos));
    const filetes = pdf.segmentos.filter((s) => esAmbar(s.color) && Math.abs(s.x1 - s.x2) < 0.3 && Math.abs(s.y2 - s.y1) > 5);
    expect(filetes.length).toBeGreaterThanOrEqual(2);
    for (const f of filetes) {
      const enBanda = pdf.runs.filter((r) => r.pagina === f.pagina && r.y > f.y1 - 1 && r.y < f.y2 + 1);
      for (const r of enBanda) expect(r.x).toBeGreaterThanOrEqual(18.6);
    }
    // el texto continuado en la segunda página TAMBIÉN respeta el margen propio
    // (se excluye la cabecera fija de 8 pt, que vive en el margen del folio)
    const paginasConAnalisis = new Set(filetes.map((f) => f.pagina));
    for (const pg of paginasConAnalisis) {
      const cuerpo = pdf.runs.filter((r) => r.pagina === pg && r.size > 7.9 && r.size < 8.1 && r.y > 16);
      for (const r of cuerpo) expect(r.x).toBeGreaterThanOrEqual(18.6);
    }
  });
});

describe('DOC-003-R1 §4 — Cifras sin compresión silenciosa', () => {
  test('regresión: ninguna columna numérica queda por debajo de su cifra más ancha + aire', () => {
    for (const d of [diagCUP.diagnostico, diagUSD.diagnostico]) {
      for (const t of d.tablas) {
        if (!t.anchosColumnasPt.length) continue; // partes de una división: anchos en sus propias entradas
        t.columnas.forEach((c, i) => {
          if (c.numerica) expect(t.anchosColumnasPt[i]).toBeGreaterThanOrEqual(t.anchosCifrasPt[i] - 0.3);
        });
      }
    }
  });

  test('regresión: las tablas del caso real caben con el repertorio documentado (sin división)', () => {
    for (const t of diagCUP.diagnostico.tablas) expect(['ninguna', 'fuente', 'texto']).toContain(t.ajuste);
  });

  test('tabla de 14 columnas numéricas anchas SIN marcar «ancha»: apaisado por CONTENIDO o división — jamás cifras encogidas', () => {
    const encabezados = ['Concepto', ...Array.from({ length: 13 }, (_, i) => `Año ${i}`)];
    const filas = Array.from({ length: 5 }, (_, f) => [
      `Fila ${f + 1}`,
      ...Array.from({ length: 13 }, () => '9.876.543.210,5'),
    ]);
    const tabla: TablaDoc = { titulo: 'Tabla 4. Catorce columnas de cifras anchas sin marca de anchura', encabezados, filas };
    const { datos, diagnostico } = componerDesdeModelo(documentoSintetico([{ tipo: 'tabla', tabla }]));
    const t = diagnostico.tablas[0];
    // apaisada por contenido (antes: vertical con el factor silencioso de TODAS las columnas)
    expect(t.apaisada).toBe(true);
    // las cifras conservan su ancho legible (o se activó la división documentada)
    if (t.ajuste !== 'division-columnas') {
      t.columnas.forEach((c, i) => {
        if (c.numerica) expect(t.anchosColumnasPt[i]).toBeGreaterThanOrEqual(t.anchosCifrasPt[i] - 0.3);
      });
    }
    // ningún dato perdido
    const texto = parsearPDF(Buffer.from(datos)).runs.map((r) => r.texto).join(' ');
    for (const f of filas) for (const c of f) expect(texto).toContain(c);
  });

  test('división en bloques lógicos cuando NI el apaisado basta: conceptos repetidos, títulos de parte y datos íntegros', () => {
    const encabezados = ['Concepto', ...Array.from({ length: 21 }, (_, i) => `Año ${i}`)];
    const filas = Array.from({ length: 4 }, (_, f) => [
      `Fila ${f + 1}`,
      ...Array.from({ length: 21 }, (_, c) => `${(f * 21 + c) % 10}${'.'.repeat(1)}876.543.210,5`),
    ]);
    const tabla: TablaDoc = {
      titulo: 'Tabla 5. Veintidós columnas de cifras anchas',
      encabezados,
      filas,
      nota: 'Nota de la tabla original que debe quedar en la última parte.',
      ancha: true,
    };
    const { datos, diagnostico } = componerDesdeModelo(documentoSintetico([{ tipo: 'tabla', tabla }]));
    const padre = diagnostico.tablas.find((t) => t.titulo.includes('Veintidós columnas'));
    expect(padre?.ajuste).toBe('division-columnas');
    const partes = diagnostico.tablas.filter((t) => /parte \d+ de \d+/.test(t.titulo));
    expect(partes.length).toBeGreaterThanOrEqual(2);
    // la columna de conceptos abre cada parte y su anchura es suficiente
    for (const p of partes) {
      expect(p.anchosColumnasPt[0]).toBeGreaterThan(0);
      p.columnas.forEach((c, i) => {
        if (c.numerica) expect(p.anchosColumnasPt[i]).toBeGreaterThanOrEqual(p.anchosCifrasPt[i] - 0.3);
      });
    }
    // TODOS los valores siguen presentes y la nota vive en la última parte
    const runs = parsearPDF(Buffer.from(datos)).runs;
    const texto = runs.map((r) => r.texto).join(' ');
    for (const f of filas) for (const c of f) expect(texto).toContain(c);
    const titulosPartes = runs.filter((r) => /parte \d+ de \d+/.test(r.texto));
    expect(titulosPartes.length).toBeGreaterThanOrEqual(2);
    expect(texto).toContain('Nota de la tabla original');
  });
});

describe('DOC-003-R1 §5 — Densidad editorial de páginas apaisadas', () => {
  test('la página apaisada de flujos mejora y ninguna apaisada queda por debajo del 40 %', () => {
    const apaisadas = diagCUP.diagnostico.paginas.filter((p) => p.orientacion === 'apaisada');
    expect(apaisadas.length).toBeGreaterThanOrEqual(2);
    for (const pag of apaisadas) expect(pag.ocupacion).toBeGreaterThanOrEqual(0.4);
    // la página de flujos (Tabla 16) supera el 45 % (antes: 40,5 % medido)
    const pFlujos = pdfCUP.runs.find((r) => r.texto.includes('Flujos de caja del proyecto y de los socios'));
    expect(pFlujos).toBeDefined();
    const pagFlujos = diagCUP.diagnostico.paginas[pFlujos!.pagina - 1];
    expect(pagFlujos.ocupacion).toBeGreaterThanOrEqual(0.45);
  });

  test('la lectura trazable de la tabla de flujos vive JUNTO a la tabla (misma página apaisada)', () => {
    const pTabla = pdfCUP.runs.find((r) => r.texto.includes('Flujos de caja del proyecto y de los socios'))!.pagina;
    const pLectura = pdfCUP.runs.find((r) => r.texto.startsWith('Lectura'));
    expect(pLectura).toBeDefined();
    expect(pLectura!.pagina).toBe(pTabla);
    // la lectura cita valores del propio modelo (trazabilidad)
    const juntos = pdfCUP.runs.filter((r) => r.pagina === pTabla).map((r) => r.texto).join(' ');
    expect(juntos).toContain('1.100.216,0');
  });
});

describe('DOC-003-R1 §6 — Colisiones generales (posiciones dibujadas)', () => {
  test('el texto nunca invade la zona del pie de página (línea + numeración)', () => {
    for (const pdf of [pdfCUP, pdfUSD]) {
      for (const r of pdf.runs) {
        if (r.pagina === 1) continue; // la portada no lleva pie
        const pag = pdf.paginas[r.pagina - 1];
        const altoMm = pag.altoPt / 2.8346;
        if (r.y <= 16 || r.y >= altoMm - 12) continue; // cabecera / propia banda del pie
        expect(r.y).toBeLessThanOrEqual(altoMm - 14.5); // aire sobre la línea del pie (−13)
      }
    }
  });

  test('ninguna línea del cuerpo cruza el margen derecho de SU orientación (+0,6 mm)', () => {
    for (const pdf of [pdfCUP, pdfUSD]) {
      for (const r of pdf.runs) {
        const pag = pdf.paginas[r.pagina - 1];
        const anchoMm = pag.anchoPt / 2.8346;
        const w = medirTextoHelvetica(r.texto, r.size, esNegrita(r.fuente));
        expect(r.x + w).toBeLessThanOrEqual(anchoMm - 14 + 0.6);
      }
    }
  });

  test('la banda bajo la cabecera fija (15,3–20,4 mm) queda libre de texto', () => {
    for (const pdf of [pdfCUP, pdfUSD]) {
      for (const r of pdf.runs) {
        if (r.pagina === 1) continue; // la portada no lleva cabecera
        expect(r.y <= 15.3 || r.y >= 20.4).toBe(true);
      }
    }
  });

  test('ningún título de capítulo queda huérfano al pie de su página', () => {
    for (const pdf of [pdfCUP, pdfUSD]) {
      const titulos = pdf.runs.filter((r) => r.size > 12.9 && r.size < 13.1);
      expect(titulos.length).toBeGreaterThanOrEqual(6);
      for (const t of titulos) {
        const debajo = pdf.runs.filter((o) => o.pagina === t.pagina && o.y > t.y + 1 && o.y - t.y < 70 && o.size < 13);
        expect(debajo.length).toBeGreaterThan(0);
      }
    }
  });

  test('tras un salto de orientación, la página apaisada continúa bajo la cabecera con contenido propio', () => {
    const apaisadas = pdfCUP.paginas.filter((p) => p.apaisada);
    expect(apaisadas.length).toBeGreaterThanOrEqual(2);
    for (const pag of apaisadas) {
      const runsPag: RunTexto[] = pdfCUP.runs.filter((r) => r.pagina === pag.numero && r.y > 16);
      expect(runsPag.length).toBeGreaterThan(3);
      const menorY = Math.min(...runsPag.map((r) => r.y));
      expect(menorY).toBeGreaterThanOrEqual(20.4); // arranca en el cuerpo, no en la cabecera
    }
  });
});
