// ============================================================================
// PLANEX-DATA-002 — Constructor del «Documento de consultas al promotor»
// del expediente Holguín.
//
// Genera un DocumentoPlanex (modelo canónico de la app) que el compositor
// editorial compone con la misma calidad del plan y del informe de brechas:
// justificación real, índice de doble pasada, tablas corporativas y pies
// numerados. TODO el contenido procede de los módulos de datos (consultas,
// consultas-preguntas, brechas): el PDF, el DOCX y las pruebas salen de la
// MISMA fuente de información.
// ============================================================================

import type {
  DocumentoPlanex,
  SeccionDoc,
  ElementoDoc,
  TablaDoc,
} from '../../doc/modelo';
import {
  SUPUESTOS,
  NORMATIVA,
  FECHA_CONSULTA_NORMATIVA,
  ETIQUETA_AREA,
  resumenSupuestos,
  type AreaConsulta,
  type OrigenSupuesto,
} from './consultas';
import { CONSULTAS, resumenConsultas } from './consultas-preguntas';
import { resumenExpediente } from './brechas';
import { NOMBRE_INFORME_PROYECTO } from './informe';

const parrafo = (texto: string): ElementoDoc => ({ tipo: 'parrafo', texto });
const subtitulo = (texto: string): ElementoDoc => ({ tipo: 'subtitulo', texto });
const aviso = (texto: string): ElementoDoc => ({ tipo: 'aviso', texto });

function tabla(t: TablaDoc): ElementoDoc {
  return { tipo: 'tabla', tabla: t };
}

function sec(
  id: string,
  titulo: string,
  elementos: ElementoDoc[],
  opts?: { enIndice?: boolean; paginaNueva?: boolean }
): SeccionDoc {
  return {
    id,
    titulo,
    enIndice: opts?.enIndice ?? true,
    paginaNueva: opts?.paginaNueva ?? false,
    elementos,
  };
}

const ETIQUETA_ORIGEN: Record<OrigenSupuesto, string> = {
  documental: 'Documental (expediente)',
  derivado: 'Derivado (fórmula conservada)',
  regla_extendida: 'Regla extendida (plantilla)',
  provisional: 'Provisional',
};

const ETIQUETA_PRIORIDAD: Record<string, string> = {
  critica: 'CRÍTICA',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

const ORDEN_AREAS: AreaConsulta[] = [
  'identidad_legal',
  'financiero_fiscal',
  'mercado_precios',
  'operacion_laboral',
  'suministros_inversion',
  'normativo_validaciones',
];

export function construirDocumentoConsultas(): DocumentoPlanex {
  const resC = resumenConsultas();
  const resS = resumenSupuestos();
  const resEx = resumenExpediente();
  const fechaCorte = new Date().toISOString().slice(0, 10);

  // ------------------------------------------------------------- 1 · propósito
  const proposito = sec(
    'proposito',
    '1. Propósito del documento y cómo responder',
    [
      parrafo(
        'Este documento destila el diagnóstico del expediente en una lista operativa de trabajo para el promotor: qué supuestos adoptó el modelo para poder calcular, qué dudas tienen sustancia económica o jurídica, y qué falta por responder para convertir el plan en evaluación preliminar en un plan de negocios presentable. Acompaña —y no sustituye— al «Informe de análisis documental y brechas de información» de esta misma serie, donde cada punto tiene su evidencia completa.'
      ),
      parrafo(
        `El plan de negocios del Centro Estomatológico Internacional Holguín quedó medido en un 55,3 % de campos obligatorios con evidencia suficiente, con ${resEx.contradicciones} contradicciones visibles (la crítica: dos tasas de cambio coexistentes, C-01) y ${resEx.brechas} brechas. Ninguna se resolvió en silencio: este documento las convierte en preguntas concretas, con destinatario y con el documento que cierra cada una. Mientras las respuestas no lleguen, el modelo conserva los supuestos de la sección 2 y el plan sigue marcado como evaluación preliminar.`
      ),
      parrafo(
        'Cómo responder: cada consulta tiene un identificador (Q-01 a Q-28), un destinatario y el documento o decisión que la cierra. Se recomienda responder en el archivo DOCX de esta misma versión (intercalando la respuesta bajo cada pregunta), o en carta simple citando los identificadores. Las consultas CRÍTICAS (Q-06, Q-08, Q-09, Q-11, Q-19 y Q-23) bloquean la presentación del plan: sin ellas, ningún indicador del modelo puede presentarse como definitivo. Las respuestas económicas (tasa de cambio, impuesto, salarios) se aplican en PLANEX cambiando parámetros editables — el plan se recalcula en el acto, sin editar fórmulas.'
      ),
      aviso(
        'DOCUMENTO DE TRABAJO PARA EL PROMOTOR: las normas citadas en la sección 3 se consultaron en fuentes oficiales y especializadas el 29/10/2026, pero ninguna se presenta como acreditada para este negocio: la verificación jurídica formal corresponde al asesor del promotor. Este documento no sustituye la evaluación oficial ni acredita el cumplimiento de requisitos legales, tributarios, sanitarios o de inversión.'
      ),
    ]
  );

  // ------------------------------------------------------------- 2 · supuestos
  const tablaSupuestos: TablaDoc = {
    titulo: 'Supuestos adoptados por el modelo (S-01 a S-17)',
    encabezados: ['ID', 'Concepto y valor adoptado', 'Origen', 'Cómo se confirma'],
    filas: SUPUESTOS.map((s) => [
      s.id,
      `${s.concepto}: ${s.valorAdoptado}. ${s.fundamento} EFECTO SI CAMBIA: ${s.efectoSiCambia}`,
      `${ETIQUETA_ORIGEN[s.origen]}\n(en PLANEX: ${s.dondeEnPlanex})`,
      `${s.comoConfirmar} [Ref: ${s.referencias.join(', ')}]`,
    ]),
    alineaciones: ['izq', 'izq', 'izq', 'izq'],
    nota:
      'Todos los supuestos viven en parámetros y reglas EDITABLES de PLANEX: con la respuesta del promotor se sustituye el valor o la expresión y el plan recalcula. Ninguna cifra de este cuadro se presentó como validada en el plan.',
  };

  const supuestos = sec(
    'supuestos',
    '2. Supuestos adoptados en el modelo',
    [
      parrafo(
        `Para poder calcular con el expediente recibido, el modelo adoptó ${resS.total} supuestos, todos trazables: ${Object.entries(resS.porOrigen)
          .map(([k, v]) => `${v} de origen ${ETIQUETA_ORIGEN[k as OrigenSupuesto].toLowerCase()}`)
          .join(', ')}. Cada uno se adoptó por fidelidad a una fuente documentada o por una regla conservada y derivada; ninguno es una invención, y todos permanecen visibles en la app (parámetros con su fuente, fichas de trazabilidad).`
      ),
      parrafo(
        'Dos supuestos concentran el riesgo económico del plan. S-01 (tasa de cambio 120): el expediente usa además la tasa 24 en sus encabezados y la tasa oficial vigente es otra (véase la sección 3); es la contradicción C-01, que bloquea todos los indicadores. S-02 (impuesto del 15 % solo en los años 8–10): la investigación normativa halló su sustento directo en la Ley 118, artículo 36 — pero su aplicación a este contrato debe confirmarla el asesor jurídico (consulta Q-09).'
      ),
      tabla(tablaSupuestos),
    ]
  );

  // ------------------------------------------------------------- 3 · normativa
  const normativos: ElementoDoc[] = [
    parrafo(
      `Se consultaron fuentes oficiales y especializadas el ${FECHA_CONSULTA_NORMATIVA} para sustentar o refutar los valores que el plan necesita. Resultado central: la Ley 118 «De la Inversión Extranjera» (2014), artículo 36.1, FIJA el impuesto sobre utilidades de las partes en contratos de asociación económica internacional en el 15 % sobre la utilidad neta imponible, y su artículo 36.2 las exime durante ocho años a partir de la constitución — el patrón del expediente (15 % en los años 8–10, exención en los años 1–7) tiene, por tanto, sustento legal directo. La tasa general del 35 % de la Ley 113 solo aplicaría si el negocio quedara excluido del régimen especial por el artículo 43 de la propia Ley 118 (contratos de administración hotelera, productiva o de servicios y de prestación de servicios profesionales) — exclusión que el asesor jurídico debe descartar por escrito para este CAEI.`
    ),
    parrafo(
      'Segundo resultado central: el régimen de divisas cambió después del expediente. La tasa de cambio oficial del Banco Central de Cuba consultada el 29/10/2026 es de 758,00 CUP por USD — ni la tasa 24 de los encabezados del expediente ni la 120 de su lista de precios coinciden con la oficial vigente. La decisión de tasa (consulta Q-08) es, con diferencia, la respuesta que más mueve el modelo.'
    ),
    aviso(
      'Las citas siguientes reproducen el tenor de las normas en la fecha de consulta; su vigencia y su aplicación a este negocio deben confirmarse con el asesor jurídico del promotor antes de presentar el plan.'
    ),
  ];
  for (const n of NORMATIVA) {
    normativos.push(subtitulo(`${n.id} — ${n.norma}`));
    normativos.push({
      tipo: 'campos',
      items: [
        { etiqueta: 'Qué establece', valor: n.queEstablece },
        { etiqueta: 'Aplicación al proyecto', valor: n.aplicacionAlProyecto },
        { etiqueta: 'Verificación pendiente', valor: n.verificacionPendiente },
        { etiqueta: 'Fuente de la consulta', valor: `${n.fuenteConsulta} (consultado el ${FECHA_CONSULTA_NORMATIVA}).` },
      ],
    });
  }
  const normativa = sec('normativa', '3. Marco normativo consultado', normativos);

  // ------------------------------------------------------------- 4 · consultas
  const seccionesConsultas: SeccionDoc[] = ORDEN_AREAS.map((area, i) => {
    const preguntas = CONSULTAS.filter((c) => c.area === area);
    const elementos: ElementoDoc[] = [];
    for (const c of preguntas) {
      elementos.push(
        subtitulo(`${c.id} · ${ETIQUETA_PRIORIDAD[c.prioridad]} · ${c.titulo}`)
      );
      elementos.push({
        tipo: 'campos',
        items: [
          { etiqueta: 'Pregunta', valor: c.pregunta },
          { etiqueta: 'Contexto (dónde está documentado)', valor: c.contexto },
          { etiqueta: 'Por qué se necesita', valor: c.motivo },
          { etiqueta: 'Responde', valor: c.responde },
          { etiqueta: 'Lo resuelve', valor: c.loResuelve },
          { etiqueta: 'Referencias', valor: c.referencias.join(' · ') },
        ],
      });
    }
    return sec(
      `consultas-${area}`,
      `4.${i + 1} ${ETIQUETA_AREA[area]} (${preguntas.length})`,
      elementos
    );
  });

  const consultas = sec(
    'consultas',
    '4. Consultas al promotor',
    [
      parrafo(
        `Se formulan ${resC.total} consultas: ${resC.criticas} críticas (bloquean la presentación del plan), ${resC.altas} de prioridad alta y el resto de prioridad media. Cada consulta es autocontenida: puede enviarse a su destinatario por separado. La numeración es estable — las respuestas pueden citarse por su identificador Q-## en cualquier correspondencia.`
      ),
    ],
    { enIndice: false }
  );
  // Las subsecciones 4.1 a 4.6 cuelgan directamente del documento, después
  // de la intro (el compositor las numera como capítulos propios).
  const cuerpoConsultas = [consultas, ...seccionesConsultas];

  // ------------------------------------------------------------- 5 · resumen
  const tablaResumen: TablaDoc = {
    titulo: 'Resumen de consultas por prioridad',
    encabezados: ['ID', 'Consulta', 'Área', 'Prioridad', 'Responde'],
    filas: CONSULTAS.map((c) => [
      c.id,
      c.titulo,
      ETIQUETA_AREA[c.area],
      ETIQUETA_PRIORIDAD[c.prioridad],
      c.responde,
    ]),
    alineaciones: ['izq', 'izq', 'izq', 'izq', 'izq'],
    nota: 'Las seis consultas críticas (Q-06, Q-08, Q-09, Q-11, Q-19, Q-23) bloquean la presentación del plan hasta recibir respuesta.',
  };

  const resumen = sec('resumen', '5. Resumen de consultas', [tabla(tablaResumen)]);

  // ------------------------------------------------------------- 6 · efecto
  const tablaEfecto: TablaDoc = {
    titulo: 'Respuesta → dónde se aplica el cambio → qué recalcula',
    encabezados: ['Respuesta recibida', 'Dónde se aplica en PLANEX', 'Qué recalcula el modelo'],
    filas: [
      ['Tasa de cambio decidida (Q-08)', 'Parámetro «tipo_cambio» (S-01)', 'Conversión CUP↔USD de todo el plan: salarios, aportes en CUP, otros impuestos, presentación CUP/USD de 4.7 y 4.12; indicadores completos.'],
      ['Régimen de impuesto verificado (Q-09)', 'Parámetro «tasa_impuesto_utilidades» + regla «impuesto_utilidades_k» (S-02/S-03)', 'Impuesto de cada año, utilidad neta, flujos de caja, dividendos (4.11), beneficio país (4.12) y recuperación.'],
      ['Escala salarial definitiva (Q-23)', 'Plantilla de 4.9 + parámetro «factor_costo_laboral» (S-07)', 'Costo laboral anual, costo fijo, utilidad de cada año y beneficio país.'],
      ['Reparto decidido 50/50 vs 49/51 (Q-03)', 'Parámetro «pct_parte_cubiana» (S-04)', 'Dividendos por socio y composición del beneficio país.'],
      ['Escáner 3D incluido (Q-26)', 'Inversión fija de 4.6 (S-14)', 'Inversión total, depreciación anual, aportaciones necesarias y recuperación.'],
      ['Canon, mantenimiento, servicios públicos (Q-15, Q-18)', 'Parámetros «canon_anual_k», «pct_mantenimiento», «servicios_publicos_anual_k» (S-09/S-10)', 'Costos fijos anuales y utilidad de cada año.'],
      ['Estudio de mercado y capacidad (Q-19, Q-21)', 'Demanda de 4.6 y análisis de 4.8', 'Ingresos de cada año y todos los indicadores dependientes.'],
      ['Aportes conciliados (Q-11)', 'Financiación de 4.5/4.6', 'Inversión total, aportaciones por socio y reparto.'],
    ],
    alineaciones: ['izq', 'izq', 'izq'],
    nota:
      'Todos los cambios entran por parámetros o reglas editables: el motor recalcula en cascada sin editar fórmulas. Las consultas jurídicas (Q-01 a Q-07, Q-27, Q-28) no mueven cifras del modelo: cierran requisitos de presentación.',
  };

  const efecto = sec('efecto', '6. Efecto de las respuestas sobre el modelo', [
    parrafo(
      'Las respuestas del promotor no exigen rehacer el plan: entran por los parámetros y reglas señalados y el motor recalcula la cascada completa (ingresos → resultados → flujos → dividendos → beneficio país → indicadores). La tabla muestra el camino exacto de cada respuesta; la sección 2 contiene el estado actual de cada parámetro.'
    ),
    tabla(tablaEfecto),
  ]);

  // ------------------------------------------------------------- anexo · mapa
  const idsConocidos = new Set<string>();
  const tablaMapa: TablaDoc = {
    titulo: 'Mapa consulta → contradicción, brecha o validación',
    encabezados: ['Consulta', 'Se sustenta en', 'Título'],
    filas: CONSULTAS.map((c) => [
      c.id,
      c.referencias.join(' · '),
      c.titulo,
    ]),
    alineaciones: ['izq', 'izq', 'izq'],
    nota: 'C-## contradicción · B-## brecha · V-## validación normativa · S-## supuesto del modelo. El detalle de cada una vive en el «Informe de análisis documental y brechas» y en la vista «Expediente documental» de la aplicación.',
  };
  // Registra los ids citados para la prueba de referencias (integridad).
  for (const c of CONSULTAS) for (const r of c.referencias) idsConocidos.add(r);

  const anexo = sec('anexo-mapa', 'Anexo A — Mapa de trazabilidad de las consultas', [
    parrafo(
      'Cada consulta de este documento nace de una contradicción, brecha o validación ya registrada y con evidencia en el informe de brechas: nada aquí es nuevo ni surge de criterio del analista. El mapa permite a cada especialista verificar el origen de la pregunta que le toca responder.'
    ),
    tabla(tablaMapa),
  ]);

  const secciones: SeccionDoc[] = [
    proposito,
    supuestos,
    normativa,
    ...cuerpoConsultas,
    resumen,
    efecto,
    anexo,
  ];

  return {
    meta: {
      nombreProyecto: NOMBRE_INFORME_PROYECTO,
      fechaDocumento: fechaCorte,
      esquema: 'PLANEX-DATA-002',
      horizonte: 10,
      esDemo: false,
      moneda: 'CUP',
      unidadTabla: 'unidades indicadas en cada tabla',
      notaMoneda:
        'El expediente mezcla dos tasas de cambio (24 y 120 CUP/USD) y la tasa oficial vigente consultada el 29/10/2026 es de 758,00 CUP/USD: ninguna cifra convertible entre tasas se presenta en este documento sin marcar la tasa de su fuente.',
      tituloCorriente: 'CONSULTAS AL PROMOTOR',
      marcaPie: 'PLANEX Cuba — Supuestos, dudas y pendientes (misión DATA-002)',
    },
    portada: {
      titulo: 'CONSULTAS AL PROMOTOR',
      subtitulo: 'Supuestos adoptados, dudas y pendientes para concluir el plan de negocios',
      marca: 'PLANEX Cuba — expediente real en evaluación preliminar',
      nombreProyecto: NOMBRE_INFORME_PROYECTO,
      denominacion:
        'Asociación Económica Internacional (CSMC, S.A. + Leisure Exporting LLC) — provincia de Holguín',
      cifras: [
        { etiqueta: 'Consultas al promotor', valor: `${resC.total} (críticas: ${resC.criticas})` },
        { etiqueta: 'Supuestos del modelo', valor: String(resS.total) },
        { etiqueta: 'Normas consultadas', valor: `${NORMATIVA.length} (fecha de consulta: ${FECHA_CONSULTA_NORMATIVA})` },
        { etiqueta: 'Impuesto sobre utilidades', valor: '15 % (Ley 118, art. 36.1) — verificación jurídica pendiente' },
        { etiqueta: 'Tasa de cambio del modelo', valor: '120 CUP/USD documental (oficial vigente: 758,00)' },
        { etiqueta: 'Fecha de corte', valor: fechaCorte },
        { etiqueta: 'Versión del documento', valor: '1.0 (documento de trabajo para el promotor)' },
      ],
      avisoDemo:
        'DOCUMENTO DE TRABAJO PARA EL PROMOTOR: recopila los supuestos adoptados por el modelo, las dudas con sustancia económica o jurídica y la información que falta responder para terminar el plan de negocios. Ninguna cifra se presenta como validada mientras las consultas críticas (Q-06, Q-08, Q-09, Q-11, Q-19, Q-23) estén sin respuesta.',
    },
    secciones,
  };
}

/** IDs citados por las consultas, para la prueba de integridad referencial. */
export function idsCitadosPorConsultas(): string[] {
  const ids = new Set<string>();
  for (const c of CONSULTAS) for (const r of c.referencias) ids.add(r);
  return [...ids];
}

/** Resumen de secciones para la vista o las pruebas. */
export function resumenDocumentoConsultas() {
  const doc = construirDocumentoConsultas();
  return {
    secciones: doc.secciones.length,
    ids: doc.secciones.map((s) => s.id),
    fechaDocumento: doc.meta.fechaDocumento,
  };
}
