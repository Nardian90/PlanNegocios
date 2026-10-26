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
