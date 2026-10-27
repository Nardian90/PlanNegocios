// ============================================================================
// PLANEX-DATA-001 — Inventario documental del expediente Holguín.
//
// Registro ESTRUCTURADO de las fuentes analizadas del ZIP «Planex.zip»
// (sha256 e47e7b31…839b25). Los originales NO se copian al repositorio:
// aquí solo se documenta qué se analizó, su huella criptográfica y qué
// aporta cada fuente al plan. Los datos personales de contacto (teléfonos
// y correos de personas naturales) no se incorporan (§1 protección
// documental de la misión).
//
// Categorías de lectura:
//   completa       — texto y tablas extraídos íntegramente.
//   visual_parcial — tablas/celdas con contenido gráfico no legible en texto.
// ============================================================================

export type EstadoLecturaFuente = 'completa' | 'visual_parcial' | 'ilegible';

export interface FuenteDoc {
  /** Identificador estable citado por el registro de datos. */
  id: string;
  /** Nombre original del archivo dentro del ZIP. */
  nombre: string;
  tipo: 'PDF' | 'DOCX' | 'DOC_legacy';
  bytes: number;
  /** Fecha de los archivos dentro del ZIP (fs), no la del contenido. */
  fechaZip: string;
  sha256: string;
  estadoLectura: EstadoLecturaFuente;
  /** Qué contiene y qué aporta al plan (resumen, sin reproducir el original). */
  aporte: string;
  /** Secciones de PLANEX a las que alimenta. */
  secciones: string[];
  /** Limitaciones de la evidencia. */
  limitaciones: string[];
}

export const SHA256_ZIP =
  'e47e7b310e4ac3653273ce9eca03c19ad27f0b15be2895f85cce859bee839b25';

export const FUENTES: FuenteDoc[] = [
  {
    id: 'F01',
    nombre: '1 CAEI.Clinica.Estomat.HOLGUÍN 17.12.25.docx',
    tipo: 'DOCX',
    bytes: 146056,
    fechaZip: '2026-10-27',
    sha256: '3a7a96757f2b6f8f0ce2026e9ba6c30acb7c2df9633bcc09a4c2ce34338cabe2',
    estadoLectura: 'completa',
    aporte:
      'Borrador del Contrato de Asociación Económica Internacional (CAEI): partes, objeto, régimen jurídico, preapertura, órganos de dirección, aportaciones (montos en blanco), distribución de beneficios (50/50), confidencialidad, arbitraje, terminación y liquidación.',
    secciones: ['4.1', '4.5', '4.9 (estructura)', '4.10 (obligaciones)', 'marco legal'],
    limitaciones: [
      'BORRADOR SIN FIRMAR: fecha «[*] de [*] de 202[*]», dirección del inmueble e identificación comercial en blanco, montos de aportaciones con puntos suspensivos.',
      'Denominación de la parte cubana alterna entre «SMC», «CSMC, S.A.» y «CMSM» dentro del propio documento.',
      'Domicilio de Leisure Exporting LLC difiere del de la cotización (véase registro H-008).',
    ],
  },
  {
    id: 'F02',
    nombre: 'CENTRO INTERNACIONAL ESTOMATOLOGIA HOLGUIN (VERSION 17-12-25).doc',
    tipo: 'DOC_legacy',
    bytes: 1745408,
    fechaZip: '2026-10-27',
    sha256: '965d005e794b0a66f7226b1bb51102d7ac9b76a877ad8741b8bc69beea04dc96',
    estadoLectura: 'completa',
    aporte:
      'Valoración económica del proyecto (26/11/25): introducción, objetivos, socios, aportes, modalidad, plazo, costo de inversión, resultados proyectados a 10 años, indicadores y beneficios. Tablas: aportaciones (49/51), cotización de equipamiento ampliada (6 equipos con escáner 3D) y servicios con precios y demanda.',
    secciones: ['4.4', '4.5', '4.6', '4.7', '4.8 (parcial)', '4.11', '4.12 (cifras)'],
    limitaciones: [
      'El resumen narrativo no concilia con el anexo de tablas (véase H-043/H-044/H-045).',
      'Rótulos «MCUP/MUSD» usados para cifras en MILES (véase H-020).',
      'Tabla de servicios convierte a USD a tasa 1×120 mientras el resto del modelo declara 1×24 (H-025).',
    ],
  },
  {
    id: 'F03',
    nombre: 'Cotización de insumos y material gastable para proyecto de Asociación Económica Internacional.pdf',
    tipo: 'PDF',
    bytes: 617425,
    fechaZip: '2026-10-27',
    sha256: 'e3936eb79d4d793dc7664605635774865a8d22fdc9e24fc85fdc0323a5475571',
    estadoLectura: 'completa',
    aporte:
      'Cotización formal de Leisure Exporting LLC para insumos y material gastable (≈60 renglones con precio unitario y costo de 6 meses): total 10 733,75 USD en precios unitarios y 63 581,30 USD por 6 meses. Base de la aportación de activos circulantes.',
    secciones: ['4.5 i)', '4.7 (materiales)', '4.8 c)'],
    limitaciones: [
      'Sin fecha de emisión ni vigencia explícitas en el encabezado.',
      'No desglosa el consumo por servicio: solo totales por renglón.',
    ],
  },
  {
    id: 'F04',
    nombre: 'Equipamiento Estomatologia Holguin..docx',
    tipo: 'DOCX',
    bytes: 15277,
    fechaZip: '2026-10-27',
    sha256: 'd14eb5113b08607260159ce7e56d6c6c4691c60f5adce6c3ba00b05e2029214d',
    estadoLectura: 'completa',
    aporte:
      'Inventario de equipos y medios EXISTENTES del Departamento de Estomatología de la Sucursal Holguín de SMC (42 medios con estado técnico): 2 gabinetes dentales completos, equipo de rayos X (monitor roto), autoclave (regular), compresor con aceite (regular), láser de blanqueamiento, banco de prótesis, prensa hidráulica, mobiliario.',
    secciones: ['4.6 a) c)', '4.8 (contexto técnico)'],
    limitaciones: [
      'Sin avalúos ni valores contables de los activos existentes.',
      'Sin fechas de adquisición ni datos de utilización (horas/día).',
    ],
  },
  {
    id: 'F05',
    nombre: 'IA REVISIÓN.docx',
    tipo: 'DOCX',
    bytes: 17209,
    fechaZip: '2026-10-27',
    sha256: '85db40ea3cef7246afe0dcaa6abd6166ab2727d0ed44c2d378c6e52bb747bd0f',
    estadoLectura: 'completa',
    aporte:
      'Revisión previa (asistida por IA) del expediente contra el Anexo Único de la Resolución 78/2026: lista de faltantes por epígrafe 4.1–4.12 e inconsistencias observadas. Fuente SECUNDARIA de contraste: cada afirmación se verificó contra los documentos primarios en esta misión.',
    secciones: ['auditoría metodológica'],
    limitaciones: [
      'No es un documento primario del proyecto: sus afirmaciones se cotejaron una a una (algunas se matizan en este informe; p. ej., la caracterización de inversionistas SÍ consta en F01).',
    ],
  },
  {
    id: 'F06',
    nombre: 'INVERSION EXTRANJERA Estomatologia.doc',
    tipo: 'DOC_legacy',
    bytes: 83968,
    fechaZip: '2026-10-27',
    sha256: 'c2a2bedcf32128946fe91c00d135f62227fc541c799a0440137294cfebeb69c1',
    estadoLectura: 'completa',
    aporte:
      'Cotización de recursos tecnológicos (5 equipos: compresor, prensa hidráulica, micromotor, eliminador de burbujas, olla polimerizadora) con precios USD, envío por ítem (600,00 USD), arancel «Libre de impuestos x AEI» y transporte (35,00 USD/equipo): total 5 274,00 USD. Es la versión de la cotización que el modelo financiero sí incorpora.',
    secciones: ['4.7 (inversión fija)', '4.10 a)'],
    limitaciones: ['Sin fecha ni vigencia explícitas.', 'No incluye el escáner intraoral 3D (véase H-024).'],
  },
  {
    id: 'F07',
    nombre: 'Inv. Extranjera Estomatologia..docx',
    tipo: 'DOCX',
    bytes: 32195,
    fechaZip: '2026-10-27',
    sha256: '8df2bfed9f170eb5a69f9939fe3f13f1c9159500c8d0fa23d5e212bdaecc1345',
    estadoLectura: 'completa',
    aporte:
      'Relación de capital humano y medios disponibles de la Sucursal Holguín: plantilla salarial en escala básica (médico 5 750; licenciadas 4 210; asistente 2 810 CUP), cuadro básico de 71 renglones, inventario de equipos y las tres afectaciones principales (rayos X con monitor roto, compresor con aceite que debe ser seco, desabastecimiento general).',
    secciones: ['4.6', '4.9', '4.8 c)'],
    limitaciones: [
      'Escala salarial INCOMPATIBLE con la plantilla del modelo (H-036) y con el EERR (H-035): tres versiones de salarios en el expediente.',
    ],
  },
  {
    id: 'F08',
    nombre: 'TABLAS CALCULO DE PREFACTIBILIDAD 1ra version.pdf',
    tipo: 'PDF',
    bytes: 597900,
    fechaZip: '2026-10-27',
    sha256: '74a21fb0ffbcf5c3390d217d57aeaf9db03e265ffd4a43807b6ee930b75e91c7',
    estadoLectura: 'visual_parcial',
    aporte:
      'Anexo de cálculo de pre-factibilidad (23 páginas, «1ra versión», fecha del software 7/1/26): costo de inversión, presupuesto, financiamientos, EERR 10 años (2026–2035), balance financiero externo, flujo de caja, VAN/TIR, variación de capital de trabajo, depreciación, cronograma, fuerza de trabajo, beneficio país y estado de situación proyectado.',
    secciones: ['4.7 (completo)', '4.9', '4.10', '4.11', 'cálculo'],
    limitaciones: [
      'Cronograma directivo (p. 17): las marcas trimestrales son gráficas y no se pudieron leer como texto.',
      'Análisis de sensibilidad (p. 12) con variaciones rotas (0,0) y VAN no conciliables.',
      'EERR carga depreciación ACUMULADA como gasto del período (H-031).',
      'Encabezados «MMiles de CUP … tasa de cambio de 1*24» (H-025) frente a la tabla de servicios a 1×120.',
    ],
  },
  {
    id: 'F09',
    nombre: 'servicios estomatológicos2 (Autoguardado).docx',
    tipo: 'DOCX',
    bytes: 41201,
    fechaZip: '2026-10-27',
    sha256: 'e42c55f9885c1964ac62d67f2766154fc0d59a2eb059d277df133517f958c007',
    estadoLectura: 'completa',
    aporte:
      'Diagnóstico de servicios: 15 posibles, 13 activos, 2 suspendidos (TPR por limas y rayos X; blanqueamientos por falta de kits) con precios USD por caso e ingresos dejados de percibir; prótesis al 75 % de capacidad por 5 afectaciones tecnológicas; propuesta de inversión de 5 equipos (2 recuperan servicios, 2 modernizan, 1 incorpora tecnología).',
    secciones: ['4.6 a)', '4.8 (demanda anecdótica)', '4.10'],
    limitaciones: [
      '«Autoguardado»: versión no cerrada del documento.',
      'Cifras de ingresos perdidos declaradas sin período exacto (p. ej., «560,00 USD (en 6 meses)»).',
    ],
  },
];

export const RESUMEN_FUENTES = {
  total: 9,
  leidasCompletas: 8,
  visualParcial: 1,
  ilegibles: 0,
  bytesZip: 2882860,
  tipos: { PDF: 2, DOCX: 6, DOC_legacy: 2 } as Record<FuenteDoc['tipo'], number>,
};
