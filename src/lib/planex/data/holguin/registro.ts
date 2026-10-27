// ============================================================================
// PLANEX-DATA-001 — Registro central de información fidedigna del
// expediente «Centro Estomatológico Internacional Holguín».
//
// Categorías (misión §3):
//   A — Confirmado documentalmente: aparece de forma inequívoca en una
//       fuente identificable (fuente + localizador).
//   B — Derivado: se calcula a partir de datos documentados; la fórmula
//       queda conservada en «derivacion».
//   C — Provisional: existe un valor, pero su vigencia/aprobación no está
//       suficientemente acreditada.
//   D — Contradictorio: dos o más fuentes presentan valores incompatibles.
//   E — Pendiente: no existe evidencia suficiente para completar el campo.
//   F — No aplicable al tipo de proyecto (con justificación).
//
// REGLA DE FIDELIDAD: los valores literales se transcriben TAL CUAL
// aparecen (incluidas las grafías del original cuando se citan entre
// comillas). Nada se corrige en silencio: toda divergencia entre fuentes
// se registra como contradicción (D) con ambos valores y el tratamiento
// queda a la vista. Los datos de contacto personal (teléfonos/correos de
// personas naturales) NO se incorporan (protección documental §1).
// ============================================================================

export type CategoriaDato = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface DatoRegistro {
  /** Identificador estable (H-###). */
  id: string;
  /** Campo o concepto del plan al que aporta. */
  campo: string;
  /** Epígrafe metodológico (4.1–4.12) o etiquén de cálculo. */
  epigrafe: string;
  /** Valor literal de la fuente (transcripción). */
  valorLiteral: string;
  /** Valor normalizado para el modelo (si difiere del literal). */
  valorNormalizado?: string;
  /** Unidad y moneda del valor. */
  unidad?: string;
  /** Período o fecha de referencia. */
  periodo?: string;
  /** Fuente(s) documental(es) (id de FUENTES). */
  fuenteId: string;
  /** Localizador exacto dentro de la fuente (página, tabla, cláusula, fila). */
  localizador: string;
  categoria: CategoriaDato;
  /** Nivel de confianza narrado (opcional). */
  confianza?: string;
  /** Tratamiento previsto en PLANEX. */
  tratamiento: string;
  /** Fórmula conservada para los derivados (categoría B). */
  derivacion?: string;
  /** Observaciones, discrepancias, referencias cruzadas. */
  observaciones?: string;
}

export const REGISTRO: DatoRegistro[] = [
  // ------------------------------------------------------------- Identidad
  {
    id: 'H-001',
    campo: 'Nombre del proyecto',
    epigrafe: '4.2',
    valorLiteral:
      '«CENTRO ESTOMATOLÓGICO INTERNACIONAL HOLGUIN (VALORACION ECONÓMICA 26/11/25)» (F02); «Centro Internacional Estomatológico» (F01); «Proyecto: Clinica Estomatologica Holguin» (F08, encabezado de todas las tablas); «Clínica Estomatológica Holguín» (F02, tabla de aportaciones).',
    valorNormalizado: 'Centro Estomatológico Internacional Holguín',
    fuenteId: 'F02',
    localizador: 'F02, título del documento; F01, cláusula 1; F08, encabezados de tablas.',
    categoria: 'C',
    confianza: 'Alta en el contenido, provisional en la forma: el expediente no unifica la denominación.',
    tratamiento: 'Se adopta «Centro Estomatológico Internacional Holguín» como denominación de trabajo; la denominación formal queda PENDIENTE (el contrato deja la «identificación comercial» en blanco).',
    observaciones: 'Las variantes se conservan; la unificación definitiva corresponde al promotor (véase brecha B-02).',
  },
  {
    id: 'H-002',
    campo: 'Partes de la asociación',
    epigrafe: '4.5 g) h)',
    valorLiteral:
      '«COMERCIALIZADORA DE SERVICIOS MÉDICOS CUBANOS, S.A., en forma abreviada CSMC, S.A.» y «Leisure Exporting LLC», constituida bajo las leyes de los Estados Unidos de América.',
    fuenteId: 'F01',
    localizador: 'F01, encabezamiento «DE UNA PARTE / Y DE LA OTRA PARTE»; F02, apartado «Socios».',
    categoria: 'A',
    tratamiento: 'Incorporadas como inversionista nacional y extranjera del plan.',
  },
  {
    id: 'H-003',
    campo: 'Denominación de la parte cubana',
    epigrafe: '4.5 h)',
    valorLiteral:
      'El expediente alterna «SMC» (F02, intro.; F02 tabla de equipamiento «Sucursal Holguín de SMC»), «CSMC, S.A.» (F01 y F02) y «CMSM» (F02, encabezado de la tabla de servicios «LISTADO DE PRECIOS DE CMSM»).',
    fuenteId: 'F01',
    localizador: 'F01 completo; F02 intro. y tablas.',
    categoria: 'D',
    confianza: 'El nombre legal completo consta una sola vez (F01); las abreviaturas divergen.',
    tratamiento: 'Se usa la forma completa «Comercializadora de Servicios Médicos Cubanos, S.A. (CSMC, S.A.)» con la aclaración de la variante; la abreviatura oficial queda pendiente de confirmación con el registro mercantil.',
    observaciones: 'Contradicción registrada C-10. Ninguna de las tres abreviaturas se corrige en silencio.',
  },
  {
    id: 'H-004',
    campo: 'Caracterización legal de la parte cubana',
    epigrafe: '4.5 h)',
    valorLiteral:
      'Sociedad mercantil de capital totalmente cubano, domicilio social en calle 44, número 502, entre 5ta Avenida y 5ta A, municipio Playa, La Habana; constituida por Escritura Notarial número 366 de 11 de octubre de 2011; modificación estatuaria por Escritura número 394 de 17 de septiembre de 2015; inscrita en el Registro Mercantil de La Habana, Libro de Sociedades de Capital Totalmente Cubano, Tomo XXVIII, Folio 120, Hoja 38, Inscripción Primera, 13 de octubre de 2011; Registro Administrativo ONEI código 60598; Licencia para operar en divisas G1199680001; NIT 30001869140.',
    fuenteId: 'F01',
    localizador: 'F01, encabezamiento, párrafo de CSMC, S.A.',
    categoria: 'A',
    tratamiento: 'Incorporada a 4.5 h) (inversionista nacional). Los datos de contacto personal del representante no se publican (§1).',
    observaciones: 'Verificación registral pendiente (la escritura se cita, no se adjunta).',
  },
  {
    id: 'H-005',
    campo: 'Representante de la parte cubana',
    epigrafe: '4.5 h)',
    valorLiteral:
      '«Dr. Michael Cabrera Laza, en su carácter de Presidente de la sociedad por Acuerdo número 78/25 de la Junta General de Accionistas, en sesión extraordinaria de fecha 4 de noviembre de 2025».',
    fuenteId: 'F01',
    localizador: 'F01, encabezamiento y bloque de firmas.',
    categoria: 'A',
    tratamiento: 'Incorporado a 4.1 (elaboración/responsabilidad queda pendiente: el documento no está firmado).',
  },
  {
    id: 'H-006',
    campo: 'Caracterización legal de la parte extranjera',
    epigrafe: '4.5 g)',
    valorLiteral:
      '«Leisure Exporting LLC, constituida bajo las leyes de los Estados Unidos de América … inscrita con número L23000147130, y protocolizada a través del Acta de Protocolización número 897 … autorizada en fecha 13 de septiembre de 2024 por la Lic. Ivett Irinia González, Notaria de La Habana».',
    fuenteId: 'F01',
    localizador: 'F01, encabezamiento, párrafo de Leisure Exporting LLC.',
    categoria: 'A',
    tratamiento: 'Incorporada a 4.5 g) (inversionista extranjero).',
    observaciones: 'La caracterización de experiencia y vínculos con Cuba sigue pendiente (F05 la señala y el expediente no la aporta).',
  },
  {
    id: 'H-007',
    campo: 'Representante de la parte extranjera',
    epigrafe: '4.5 g)',
    valorLiteral:
      '«Yovannis Camilo Dominguez Fornaris, en su carácter de Manager y Representante Legal de Leisure Exporting LLC» (F01); firma la cotización como «Yovannis Domínguez, Representante legal de Leisure Exporting LLC» (F03/F06).',
    fuenteId: 'F01',
    localizador: 'F01, encabezamiento; F03/F06, pie de firma.',
    categoria: 'A',
    tratamiento: 'Incorporado. Los teléfonos/correo de contacto comercial de la cotización no se publican (§1).',
  },
  {
    id: 'H-008',
    campo: 'Domicilio de la parte extranjera',
    epigrafe: '4.5 g)',
    valorLiteral:
      '«número 3964, SOUTH CIR LARGO, Florida, Estados Unidos de América, Código Postal 37774» (F01) frente a «Radicados en 6800 N Ave. Tampa Florida FL 33604. EEUU» (F03, F06 y F08).',
    fuenteId: 'F01',
    localizador: 'F01, encabezamiento; F03/F06/F08, membrete de la cotización.',
    categoria: 'D',
    confianza: 'Dos domicilios distintos; no se puede privilegiar ninguno sin evidencia.',
    tratamiento: 'Se registran AMBOS y se solicita la acreditación registral vigente (brecha B-05). La plantilla consigna el del contrato con la marca de contradicción.',
    observaciones: 'Contradicción C-09.',
  },
  {
    id: 'H-009',
    campo: 'Modalidad de inversión',
    epigrafe: '4.5 a)',
    valorLiteral:
      '«Modalidad de inversión extranjera que se propone: Asociación Económica Internacional» (F02); el objeto del contrato es «la comercialización y prestación de servicios de estomatología y bienes asociados … bajo la forma … de Contrato de Asociación Económica Internacional» (F01).',
    valorNormalizado: 'AEI por contrato (CAEI) — unión temporal sin personalidad jurídica.',
    fuenteId: 'F02',
    localizador: 'F02, «Modalidad»; F01, cláusula 1 y 2.1.',
    categoria: 'A',
    tratamiento: 'Incorporada a 4.5 a). La aprobación de la constitución de la AEI por la autoridad competente queda como validación pendiente.',
  },
  {
    id: 'H-010',
    campo: 'Objeto del negocio',
    epigrafe: '4.5 b)',
    valorLiteral:
      '«comercialización y prestación de servicios de estomatología y bienes asociados, por profesionales y técnicos cubanos altamente calificados en un Centro Internacional Estomatológico de alta tecnología en el territorio cubano de la provincia de Holguín, así como capacitación profesional, enfocado a la mejora continua, con la utilización de alta tecnología que permita el acceso a nuevos mercados en América Latina, Centro América y el Caribe».',
    fuenteId: 'F01',
    localizador: 'F01, cláusula 1 «OBJETO».',
    categoria: 'A',
    tratamiento: 'Incorporado a 4.5 b) con la terminología original.',
  },
  {
    id: 'H-011',
    campo: 'Localización',
    epigrafe: '4.6 d)',
    valorLiteral:
      '«en el territorio cubano de la provincia de Holguín» (F01/F02); la dirección del inmueble aparece en blanco en el contrato («cuya ubicación se encuentra en ______________, provincia Holguín»).',
    valorNormalizado: 'Provincia Holguín, Cuba. Dirección exacta PENDIENTE.',
    fuenteId: 'F01',
    localizador: 'F01, cláusula 1.2; F02, objetivo general.',
    categoria: 'C',
    tratamiento: 'Provincia incorporada; el campo de dirección queda pendiente (brecha B-08). El inmueble se aporta por derecho real de usufructo (F01), sin avalúo ni certificado de Patrimonio.',
  },
  {
    id: 'H-012',
    campo: 'Plazo de vigencia',
    epigrafe: '4.5 c)',
    valorLiteral:
      '«tendrá una duración de diez (10) años» desde la inscripción en el Registro Mercantil (F01); «se realizó la proyección para 10 años y se propone evaluarlo en el 2034 para prorrogarlo 10 años más» (F02).',
    valorNormalizado: '10 años de operación, evaluación de prórroga en 2034.',
    fuenteId: 'F01',
    localizador: 'F01, cláusula «ENTRADA EN VIGOR Y VIGENCIA»; F02, «Plazo o Período de vigencia».',
    categoria: 'A',
    tratamiento: 'Horizonte de 10 años en el modelo; la prórroga se documenta como decisión futura de las partes (estudios de postinversión, F01 cláusula 8.3).',
  },
  {
    id: 'H-013',
    campo: 'Distribución de beneficios',
    epigrafe: '4.5 j)',
    valorLiteral:
      '«una proporción porcentual del cincuenta por ciento (50%)» para cada parte (F01, cláusula 7.5); dividendos repartidos 50/50 en el EERR (F08, p. 9) frente a participaciones del 49 % (cubana) y 51 % (extranjera) en la tabla de aportaciones (F02/F08, p. 1).',
    fuenteId: 'F01',
    localizador: 'F01, cláusula 7.5; F02 tabla de aportaciones; F08, p. 1 y p. 9.',
    categoria: 'D',
    confianza: 'El contrato pacta reparto 50/50; la composición del fondo común declara 49/51. No son incompatibles jurídicamente, pero el expediente no explica la regla.',
    tratamiento: 'El modelo aplica el reparto pactado 50/50 y conserva la participación 49/51 declarada; el diagnóstico de PLANEX señala la incoherencia entre ambas cifras hasta que el promotor la aclare (brecha B-04).',
    observaciones: 'Contradicción C-05.',
  },
  {
    id: 'H-014',
    campo: 'Marco normativo invocado por el expediente',
    epigrafe: 'marco legal',
    valorLiteral:
      'Ley 118 «Ley de Inversión Extranjera», 29 de marzo de 2014; Decreto 325 «Reglamento de la Ley de Inversión Extranjera», 9 de abril de 2014; Decreto 347 «Modificativo del Decreto 325», citado «de 9 de abril de 2014»; Decreto-Ley 69 «Sobre la mediación de conflictos», 19 de enero de 2023; Ley 59 «Código Civil», 17 de julio de 1987; revisión de bases metodológicas conforme al «Anexo Único de la Resolución 78/2026» (F05).',
    fuenteId: 'F01',
    localizador: 'F01, cláusulas 2.2 y 16.5; F05, encabezado.',
    categoria: 'C',
    confianza: 'Las normas se citan por el expediente; su vigencia exacta y aplicabilidad a este proyecto requieren verificación en fuentes oficiales.',
    tratamiento: 'Se incorporan como marco invocado por el expediente; la verificación de vigencias y de la fecha del Decreto 347 queda en la sección de validaciones normativas.',
  },
  {
    id: 'H-015',
    campo: 'Período de preapertura',
    epigrafe: '4.10 b)',
    valorLiteral:
      '«Período comprendido entre la fecha de inscripción en el Registro Mercantil de la Escritura Pública … y la fecha del inicio del período de operaciones», con cronograma de acciones revisado semanalmente por las partes.',
    fuenteId: 'F01',
    localizador: 'F01, cláusula 3 «PERÍODO DE PREAPERTURA».',
    categoria: 'A',
    tratamiento: 'Reflejado en el cronograma (etapa 2026); las fechas precisas siguen pendientes (brecha B-14).',
  },
  {
    id: 'H-016',
    campo: 'Identificación comercial del Centro',
    epigrafe: '4.2',
    valorLiteral: '«se identificará comercialmente como “_______________________”» (en blanco).',
    fuenteId: 'F01',
    localizador: 'F01, cláusula 2.5.',
    categoria: 'E',
    tratamiento: 'Pendiente; brecha B-02.',
  },
  {
    id: 'H-017',
    campo: 'Estructura de dirección y plantilla propuesta',
    epigrafe: '4.9',
    valorLiteral:
      'Copresidencia (Presidente de SMC y CEO de Leisure Exporting LLC); Consejo de Dirección; Director de la AEI (director de la Sucursal Holguín); Administrador; Almacenero; Contable; 2 Especialistas en Estomatología (titular y reserva); 1 Licenciado(a) en Asistencia Estomatológica; 1 Licenciado(a) o técnico de Prótesis; 1 Auxiliar General.',
    fuenteId: 'F01',
    localizador: 'F01, nota introductoria (base conceptual del contrato).',
    categoria: 'A',
    tratamiento: 'Incorporada como estructura de mando y referencia de la plantilla de 4.9.',
  },

  // ------------------------------------------------------------ Inversión
  {
    id: 'H-020',
    campo: 'Costo total de la inversión inicial',
    epigrafe: '4.7 a)',
    valorLiteral:
      '«La inversión tiene un costo de 152.78 MCUP de ellos 126.58 MCUP para equipamiento que aportará el socio extranjero y 26.2 MCUP para los Gastos Previos que serán aportados por CSMC. El Costo de la Inversión expresado en MUSD asciende a 6.37» (F02); tabla de inversión: CAPITAL FIJO 152,78, CAPITAL DE TRABAJO INICIAL 0,00 (F08, p. 5).',
    valorNormalizado:
      'Inversión total 152,78 miles de CUP (≈6,37 miles de USD a la tasa 1×24 que declara el propio expediente): inversión fija 126,58 + gastos previos 26,20. Los rótulos «MCUP/MUSD» del expediente designan MILES, no millones.',
    unidad: 'miles de CUP / miles de USD',
    periodo: 'Año de inversión (2026 en el modelo del expediente)',
    fuenteId: 'F08',
    localizador: 'F02, «Costo de Inversión»; F08, p. 5 (COSTO DE LA INVERSIÓN INICIAL) y p. 6.',
    categoria: 'A',
    tratamiento: 'Incorporada a 4.7/4.10 con su desglose documentado. La escala («miles» pese al rótulo MCUP) se explica en el informe y es consistente con todas las tablas del expediente.',
    observaciones: 'Capital de trabajo inicial en 0,00: sin colchón de operación (anomalía señalada en el informe).',
  },
  {
    id: 'H-021',
    campo: 'Inversión fija por equipamiento (5 equipos)',
    epigrafe: '4.10 a)',
    valorLiteral:
      'Compresor de aire para uso estomatológico 3 500,00 + envío 350,00 + transporte 35,00 = 3 885,00; Prensa hidráulica 316,00 + 62,00 + 35,00 = 413,00; Micromotor de mano 209,00 + 40,00 + 35,00 = 284,00; Eliminador de burbujas 285,00 + 70,00 + 35,00 = 290,00; Olla polimerizadora a presión 289,00 + 78,00 + 35,00 = 402,00. Total 5 274,00 USD = 126 576,00 CUP (a 24).',
    valorNormalizado: 'Total 5 274,00 USD (5 equipos), equivalente a 126,58 miles de CUP en el modelo.',
    unidad: 'USD / miles de CUP',
    fuenteId: 'F06',
    localizador: 'F06, tabla (cotización de recursos tecnológicos); F08, p. 15 (mismos importes); F02, tabla de equipamiento (variante ampliada, véase H-024).',
    categoria: 'A',
    tratamiento: 'Cada equipo entra como partida individual de inversión fija en USD (5 filas), trazable a la cotización. Depreciación del expediente: 6 % anual (≈16,7 años de vida útil).',
  },
  {
    id: 'H-022',
    campo: 'Gastos previos de preoperación',
    epigrafe: '4.7 a)',
    valorLiteral: '«Gastos financieros en el período de Inversión Inicial 1,20» y «Otros gastos de Pre-Operación (Detallar) 25,00» (total 26,20).',
    valorNormalizado: '26,20 miles de CUP (1,20 financieros + 25,00 otros de preoperación), aportados por CSMC en efectivo.',
    unidad: 'miles de CUP',
    fuenteId: 'F08',
    localizador: 'F08, p. 5, desglose de GASTOS PREVIOS DE PRE-OPERACIÓN (II).',
    categoria: 'A',
    tratamiento: 'Dos partidas de gastos previos en CUP. El expediente no detalla el concepto de los 25,00 (pendiente de desglose, brecha B-11).',
    observaciones: 'Los «25,00» sin desglose y los salarios de preapertura (que la escritura prevé aportados por CSMC) pueden solaparse: se solicita aclaración (C-11).',
  },
  {
    id: 'H-023',
    campo: 'Capital de trabajo inicial',
    epigrafe: '4.7 a)',
    valorLiteral: '«CAPITAL DE TRABAJO INICIAL (IV) 0,00 … COSTO TOTAL DE INVERSIÓN INICIAL (V) 152,78».',
    valorNormalizado: '0,00 (el expediente no prevé capital de trabajo inicial).',
    unidad: 'miles de CUP',
    fuenteId: 'F08',
    localizador: 'F08, p. 5.',
    categoria: 'C',
    confianza: 'Valor explícito del modelo, pero inconsistente con la operación real (existencias y cuentas por cobrar aparecen en el estado de situación).',
    tratamiento: 'Se mantiene 0 en el modelo (fiel al expediente) y se señala como riesgo (brecha B-12).',
  },
  {
    id: 'H-024',
    campo: 'Escáner intraoral 3D (inclusión en el modelo)',
    epigrafe: '4.10 a)',
    valorLiteral:
      'F02 incluye en su tabla de equipamiento el «Escáner intraoral 3D» por 12 000,00 + 35,00 = 12 035,00 USD (y una línea suelta que lo valora «1444 200.00 (1*120)» CUP); F08 (inversión, p. 15) y F06 NO lo incluyen: la inversión fija del modelo queda en 5 274,00 USD. F02 recomienda por otra parte «incrementar el escáner intraoral 3D en las nuevas tecnologías».',
    fuenteId: 'F02',
    localizador: 'F02, tabla de equipamiento (6 filas) y Tabla 3; F06, tabla (5 filas); F08, p. 15.',
    categoria: 'D',
    confianza: 'Cotización existente pero decisión no plasmada en el modelo.',
    tratamiento: 'La plantilla incorpora los 5 equipos del modelo; el escáner queda como DECISIÓN PENDIENTE del promotor con ambas cifras conservadas (brecha B-07).',
    observaciones: 'Contradicción C-08. Si se aprueba, la inversión fija pasaría de 5,274 a ≈17,309 kUSD (17 309,00 USD totales de la variante F02).',
  },
  {
    id: 'H-025',
    campo: 'Tipo de cambio del modelo',
    epigrafe: 'cálculo',
    valorLiteral:
      'Encabezados del expediente: «UM: MMiles de CUP con un decimal y tasa de cambio de 1*24» (todas las tablas de F08 y la tabla de aportaciones de F02); la tabla de servicios declara «INGRESOS ANUALES EN USD A TASA DE 1*120» (F02/F08, p. 23) y F09 expresa los precios por caso en USD (TPR 80,00; blanqueamiento 150,00) que equivalen exactamente a los precios CUP ÷ 120.',
    valorNormalizado:
      'DOS tasas coexisten: 24 CUP/USD (rotulación del modelo, aplicada a inversiones, insumos y conversión de totales) y 120 CUP/USD (lista oficial de precios CSMC que origina los precios CUP de los servicios).',
    fuenteId: 'F08',
    localizador: 'F08, encabezados de todas las tablas y p. 23; F02, tabla de servicios; F09, precios por caso.',
    categoria: 'D',
    confianza: 'La tasa 120 está respaldada por la lista de precios (los precios USD existen de forma primaria); la tasa 24 no tiene respaldo normativo citado y no corresponde a la tasa oficial vigente.',
    tratamiento:
      'La plantilla fija el parámetro de tipo de cambio en 120 CUP/USD (fuente: lista de precios CSMC y F09) y conserva la tasa 24 como contradicción documentada. TODOS los totales en «MUSD» del expediente dependen de la tasa 24 y quedan marcados como no verificables hasta la decisión del promotor.',
    observaciones: 'Contradicción C-01 (CRÍTICA, bloqueante del modelo financiero). Véase informe §7.',
  },
  {
    id: 'H-026',
    campo: 'Aportación de la parte cubana',
    epigrafe: '4.5 i)',
    valorLiteral: '«Efectivo 1,600.0 … APORTACION EN CUP 1,600.0 … APORTACIÓN EN USD 66.7 … Por ciento de participación 49%».',
    valorNormalizado: 'Efectivo: 1 600,0 miles de CUP (66,7 miles de USD a 24; 13,3 miles de USD a 120). Participación declarada: 49 %.',
    unidad: 'miles de CUP',
    fuenteId: 'F02',
    localizador: 'F02, tabla de aportaciones; F08, p. 1.',
    categoria: 'A',
    tratamiento: 'Incorporada como aportación en efectivo del socio nacional. El destino declarado: salarios de preapertura y arrendamiento durante la preapertura y los primeros 6 meses (F02).',
    observaciones: 'El contrato (F01) deja el monto dinerario de CSMC en blanco: el valor procede del anexo de cálculo.',
  },
  {
    id: 'H-027',
    campo: 'Aportación de la parte extranjera',
    epigrafe: '4.5 i)',
    valorLiteral:
      '«Activos Circulantes (Detallar) 1,526.0 … USD 63.6» y «Activos Fijos Tangibles (Detallar) 126.6 … USD 5.3 … Por ciento de participación 51%».',
    valorNormalizado:
      'Activos circulantes (insumos, stock de 6 meses): 1 526,0 miles de CUP = 63 581,30 USD (cotización F03). Activos fijos tangibles (5 equipos): 126,6 miles de CUP = 5 274,00 USD (F06). Participación declarada: 51 %.',
    unidad: 'miles de CUP / USD',
    fuenteId: 'F08',
    localizador: 'F08, p. 1 (tabla de aportaciones); F03, total de la cotización; F06, total de equipos.',
    categoria: 'A',
    tratamiento: 'Incorporadas como aportaciones en especie (circulantes y fijos) del socio extranjero, trazables a las cotizaciones.',
    observaciones: 'Conciliación verificada: 63 581,30 USD × 24 = 1 525 951 CUP ≈ 1 526,0 miles de CUP ✓.',
  },
  {
    id: 'H-028',
    campo: 'Total de aportes al fondo común',
    epigrafe: '4.5 i)',
    valorLiteral: '«TOTAL DE APORTES A FONDO COMÚN 3,252.5 / 3,252.5 / 135.5» (CUP/CUP/USD a 24); la tabla de financiamientos expresa «(-) Aportes o aportaciones 3,252.53».',
    valorNormalizado: '3 252,5 miles de CUP = 135,5 miles de USD a la tasa 24 del expediente (1 600,0 CSMC + 1 652,5 Leisure).',
    unidad: 'miles de CUP / USD',
    fuenteId: 'F02',
    localizador: 'F02, tabla de aportaciones; F08, p. 1 y p. 7.',
    categoria: 'A',
    tratamiento: 'Incorporada la cifra literal. La relación aportes/inversión (3 252,5 vs 152,78 en las mismas unidades) queda registrada como incoherencia del expediente (C-11).',
  },
  {
    id: 'H-029',
    campo: 'Cotización de insumos (6 meses)',
    epigrafe: '4.8 c)',
    valorLiteral: '«TOTAL … 10,733.75 [precios unitarios] 63,581.30 [costo de 6 meses]» — ≈60 renglones de insumos y material gastable, firmada por Leisure Exporting LLC.',
    valorNormalizado: '63 581,30 USD de insumos para 6 meses (= 1 526,0 miles de CUP a 24, conciliado con H-027). Costo anual implícito del modelo: 127,16 miles de USD (EERR 3 051,9 miles de CUP a 24).',
    unidad: 'USD',
    fuenteId: 'F03',
    localizador: 'F03, columna TOTAL; F08, p. 2–4 (mismo desglose); F02 (gasto material anual por renglón).',
    categoria: 'A',
    tratamiento: 'Base del costo variable del modelo (véase H-040 para el tratamiento del reparto por servicio).',
  },
  {
    id: 'H-030',
    campo: 'Financiamiento externo',
    epigrafe: '4.7 b)',
    valorLiteral: '«Necesidad de financiamiento externo 0,00 … Financiamientos para Inversión 0,00 … Intereses anuales a pagar 0,00» en todas las filas.',
    valorNormalizado: 'Sin créditos: financiación 100 % con aportaciones; sin intereses ni servicio de deuda.',
    fuenteId: 'F08',
    localizador: 'F08, p. 7 (FINANCIAMIENTOS).',
    categoria: 'A',
    tratamiento: 'Crédito deshabilitado en la plantilla (coherente con la app: calendario de deuda vacío).',
    observaciones: 'La página del expediente resta los aportes (3 252,53) de la inversión (152,78) y declara necesidad 0,00: aritméticamente incoherente (C-11); la lectura correcta es que los aportes cubren la inversión con un remanente de 3 099,75 que el propio estado de situación interpreta como efectivo inicial.',
  },
  {
    id: 'H-031',
    campo: 'Depreciación del equipamiento',
    epigrafe: 'cálculo',
    valorLiteral:
      '«Equipamiento Tecnológico … Tasa (%) 6 … Depreciación en el Período 7,6 … Depreciación Acumulada 7,6 / 15,19 / 22,78 / … / 75,95».',
    valorNormalizado: 'Tasa 6 % anual sobre 126,58 miles de CUP = 7,6 miles de CUP por año. Vida útil implícita ≈16,7 años.',
    unidad: 'miles de CUP',
    periodo: 'Años 1–10',
    fuenteId: 'F08',
    localizador: 'F08, p. 14 (DEPRECIACION TASA AÑOS).',
    categoria: 'B',
    derivacion: 'Depreciación anual = 126,58 × 6 % = 7,595 ≈ 7,6 miles de CUP/año.',
    tratamiento: 'La plantilla usa vida útil de 17 años (lineal ≈ 6 %) para los 5 activos. DEFECTO REGISTRADO: el EERR del expediente carga la depreciación ACUMULADA como gasto de cada período (12,8 / 20,4 / … / 75,9; total 417,7 en 10 años) en lugar de la anual constante (7,6): subestima la UAI de los años 2–10 (contradicción C-06).',
  },
  {
    id: 'H-032',
    campo: 'Amortización de gastos previos',
    epigrafe: 'cálculo',
    valorLiteral: '«Gastos Previos a la Explotación … TASA 20 %, 5 AÑOS … Amortización en el Período 5,2 (años 1–5) … Amortización Acumulada … 26,0».',
    valorNormalizado: '26,0 miles de CUP amortizados al 20 % anual en 5 años (5,2 por año, años 1–5).',
    unidad: 'miles de CUP',
    fuenteId: 'F08',
    localizador: 'F08, p. 14.',
    categoria: 'A',
    tratamiento: 'El motor de PLANEX no amortiza gastos previos como gasto del período (los trata en el flujo de inversión); divergencia documentada en el informe §5.',
  },
  {
    id: 'H-033',
    campo: 'Impuesto sobre utilidades',
    epigrafe: 'cálculo',
    valorLiteral:
      'EERR: «(-) Impuesto sobre Utilidades … 903.9 / 902.9 / 901.8» solo en los años 8, 9 y 10 (15 % de las utilidades imponibles de esos años); años 1–7 sin impuesto; total 2 708,58.',
    valorNormalizado: 'Tasa 15 % aplicada únicamente a los años 8–10. El expediente NO cita la base legal de la exención de los años 1–7.',
    unidad: 'miles de CUP',
    periodo: 'Años 1–10',
    fuenteId: 'F08',
    localizador: 'F08, p. 9 (EERR, impuesto) y p. 11 (flujo, desglose).',
    categoria: 'C',
    confianza: 'El patrón es inequívoco (903,94 = 15 % de 6 026,3) pero el beneficio fiscal carece de respaldo normativo adjunto.',
    tratamiento: 'La plantilla reproduce el patrón documentado (regla editable con condición de años ≥ 8 y tasa parametrizada al 15 %) marcándolo como supuesto del expediente PENDIENTE DE VALIDACIÓN NORMATIVA (brecha B-16).',
    observaciones: 'Verificar la exención por beneficios de la Ley 118 (art. 34 y concordantes) y su duración exacta para esta modalidad.',
  },
  {
    id: 'H-034',
    campo: 'Otros impuestos, tasas y contribuciones',
    epigrafe: 'cálculo',
    valorLiteral:
      '«Otros Impuestos, tasas y contribuciones (impuesto transporte terrestre; contribución Desarrollo Local (1% ventas brutas); Tasa Radicación de Anuncios y Propaganda Comercial) 689.0 [año 1] / 682.1 [años 2+]», total 6 827,90.',
    valorNormalizado: '≈682,1 miles de CUP por año de operación (incluye 1 % de las ventas brutas por contribución al desarrollo local; el resto sin desglosar).',
    unidad: 'miles de CUP',
    fuenteId: 'F08',
    localizador: 'F08, p. 8 (EERR) y p. 19 (beneficio país).',
    categoria: 'C',
    confianza: 'Total sin desglose verificable: solo se declara el componente del 1 %.',
    tratamiento: 'Incorporado como parámetro anual único con su fórmula documental pendiente de desglosar (brecha B-17).',
  },
  {
    id: 'H-035',
    campo: 'Costo salarial del modelo (EERR)',
    epigrafe: '4.9',
    valorLiteral:
      '«Fuerza de Trabajo Directa 3,072.0» al año (total 30 720,0) y «Gastos Generales y de Administración (incluye gastos bancarios y seguro) 1,248.0» cuyo sub-renglón «De ellos: Fuerza trabajo» es 1,248.0 (total 12 480,0). Beneficio país: «Salario de trabajadores cubanos 4,320.00» al año (total 43 200,00).',
    valorNormalizado: 'Costo salarial total del modelo: 4 320,0 miles de CUP por año (3 072,0 directo + 1 248,0 administrativo) = 360 000 CUP/mes.',
    unidad: 'miles de CUP',
    periodo: 'Años 1–10 (constante)',
    fuenteId: 'F08',
    localizador: 'F08, p. 8 (EERR), p. 21 (fuerza de trabajo) y p. 19 (beneficio país).',
    categoria: 'A',
    tratamiento: 'Cifra adoptada como costo salarial del modelo (la que sostiene todos los resultados del expediente). Coherente con H-090 en plantillas.',
    observaciones: 'No concilia con la plantilla salarial del propio anexo (H-036): véase C-07.',
  },
  {
    id: 'H-036',
    campo: 'Plantilla salarial declarada',
    epigrafe: '4.9',
    valorLiteral:
      'F08 (p. 21): «Personal Total … Pago por FT (en CUP) MENSUAL 146,000.00 … Monto Anual (en MCUP) 4,320.00»; desglose per cápita: directivo 20 000; administrador 17 000; almacenero 10 000; económico 15 000; médico especialista 2 × 15 000; lic. estomatología 12 000; lic. prótesis 12 000; asistente 10 000; + 1 directivo extranjero 20 000. F07 aporta una TERCERA escala (médico 5 750; licenciadas 4 210; asistente 2 810).',
    valorNormalizado:
      'Plantilla: 10 plazas (9 cubanas + 1 directivo extranjero). Salario mensual declarado: 146 000 CUP (126 000 cubanos + 20 000 extranjero) ⇒ 1 752,0 miles de CUP/año, frente a los 4 320,0 del EERR (factor ×2,47).',
    unidad: 'CUP/mes',
    fuenteId: 'F08',
    localizador: 'F08, p. 21 (dos tablas de fuerza de trabajo); F07, tabla de capital humano.',
    categoria: 'D',
    confianza: 'Tres versiones de salarios irreconciliables sin aclaración del promotor.',
    tratamiento: 'Se adopta la estructura de PLANTILLAS (10 plazas con su distribución per cápita relativa) y el TOTAL del EERR (4 320 kCUP/año), derivando el salario promedio por plaza con fórmula conservada (H-091). Ambas cifras quedan visibles como contradicción C-07; brecha B-10.',
    observaciones: 'El extranjero coincide en ambas (20 000 CUP/mes = 240 kCUP/año); la divergencia está en los salarios cubanos (126 000 vs 340 000 CUP/mes implícitos).',
  },
  {
    id: 'H-037',
    campo: 'Servicios y precios',
    epigrafe: '4.6 a) / 4.8',
    valorLiteral:
      '15 servicios con «PRECIO POR SERV. EN CUP POR LISTADO DE PRECIOS DE CMSM», cantidad mensual, ingresos mensuales/anuales en CUP y «INGRESOS ANUALES EN USD A TASA DE 1*120»: TPR 9 600,00 ×3; Obturaciones de resina 2 400,00 ×15; Obturaciones de amalgamas 1 800,00 ×15; Profilaxis con ultrasonido 6 000,00 ×10; Prótesis 23 236,00 ×15; Exodoncia 14 900,00 ×10; Resedimentado de corona 3 000,00 ×5; Corona y espiga acrílica 9 600,00 ×5; Pulpotomía 3 600,00 ×3; Drenaje de absceso 3 600,00 ×5; Reparación de prótesis 2 400,00 ×5; Cura óxido de zinc 3 000,00 ×25; Radiografía 1 800,00 ×30; Corona acrílica 9 600,00 ×10; Blanqueamientos 18 000,00 ×10. TOTALES 1 158 140,00 CUP/mes; 13 897 680,00 CUP/año; 115 814,00 USD/año.',
    valorNormalizado:
      '15 líneas de servicio con precios en CUP (= precio USD × 120) y demanda mensual prevista. Equivalente anual: 115 814,00 USD (= 13 897,68 miles de CUP a 120).',
    unidad: 'CUP/servicio · servicios/mes',
    periodo: 'Demanda del año 1 (constante en la plantilla)',
    fuenteId: 'F02',
    localizador: 'F02, tabla de servicios; F08, p. 23 (idéntica).',
    categoria: 'A',
    tratamiento: 'Cada servicio entra como fila individual con su precio (USD = CUP ÷ 120, documentado por F09), cantidad mensual y fuente citada. El motor recalcula ingresos y limita por capacidad cuando exista.',
    observaciones: 'Precios USD confirmados por F09 en dos servicios (TPR 80,00; blanqueamiento 150,00) ✓.',
  },
  {
    id: 'H-038',
    campo: 'Ingresos por ventas — año 1',
    epigrafe: '4.7 c)',
    valorLiteral: '«Ventas Brutas … 13,897.7» (año 2026 del EERR; total 10 años: 132 789,7).',
    valorNormalizado: '13 897,68 miles de CUP en el año 1 (= 115 814,00 USD a 120).',
    unidad: 'miles de CUP',
    periodo: 'Año 1 de operación',
    fuenteId: 'F08',
    localizador: 'F08, p. 8 (EERR, ventas brutas) y p. 23 (tabla de servicios).',
    categoria: 'A',
    tratamiento: 'Referencia documental de ingresos del año 1; el motor la recalcula desde H-037 (concilia exactamente).',
  },
  {
    id: 'H-039',
    campo: 'Ingresos por ventas — años 2–10',
    epigrafe: '4.7 c)',
    valorLiteral: '«13,210.22» por año de los años 2 al 10 (sin explicación de la variación frente al año 1).',
    valorNormalizado: '13 210,22 miles de CUP/año (−4,95 % frente al año 1, sin causa documentada).',
    unidad: 'miles de CUP',
    periodo: 'Años 2–10',
    fuenteId: 'F08',
    localizador: 'F08, p. 8 (EERR).',
    categoria: 'D',
    confianza: 'La caída del 4,95 % no está justificada en ninguna fuente.',
    tratamiento: 'La plantilla mantiene la demanda constante del año 1 (13 897,68); la diferencia queda registrada como contradicción C-14 a aclarar (¿descuento, menor actividad, ajuste?).',
  },
  {
    id: 'H-040',
    campo: 'Costo de materiales por servicio',
    epigrafe: '4.6 / 4.8 c)',
    valorLiteral: 'El EERR solo registra el agregado: «Total materias primas y materiales» 1 526,0 (año 1) y 3 051,9 (años 2+). La cotización (F03) desglosa por INSUMO, no por servicio.',
    valorNormalizado:
      'Costo material agregado: 63,58 miles de USD en el año 1 y 127,16 miles de USD por año a partir del 2 (63 581,30 USD × 2). SIN reparto por servicio documentado.',
    unidad: 'miles de USD',
    periodo: 'Años 1–10',
    fuenteId: 'F03',
    localizador: 'F03, total; F08, p. 8 (EERR, materias primas).',
    categoria: 'B',
    derivacion:
      'Reparto provisional adoptado: costo unitario de cada servicio = precio del servicio × (127 162,60 USD anuales ÷ 115 814,00 USD anuales de ingresos) = precio × 1,09805. Convenio EDITABLE y marcado: preserva el total documentado y no inventa consumos por línea; el reparto real es una brecha (B-13).',
    tratamiento: 'Costos variables unitarios derivados por la convención anterior, con el total cuadrando con la cotización. El diagnóstico de PLANEX marcará todas las líneas con margen negativo: es la señal visible del bloqueo de tasas (H-025), no un error de cálculo.',
    observaciones: 'ALERTA: el costo material real en USD (127,16 kUSD/año) EXCEDE el ingreso anual a precios de lista (115,81 kUSD): véase C-01/C-02 del informe.',
  },
  {
    id: 'H-041',
    campo: 'Gastos generales y de administración',
    epigrafe: '4.7 c)',
    valorLiteral: '«Gastos Generales y de Administración (incluye gastos bancarios y seguro) 0,0» con «De ellos: Fuerza trabajo … 1,248.0» al año.',
    valorNormalizado: 'El gasto administrativo del modelo es 100 % fuerza de trabajo (ya incluida en H-035); sin gastos bancarios, seguros ni otros gastos generales.',
    unidad: 'miles de CUP',
    fuenteId: 'F08',
    localizador: 'F08, p. 8 (EERR).',
    categoria: 'C',
    confianza: 'La etiqueta menciona «gastos bancarios y seguro» pero todas las cifras de esos conceptos son 0,0.',
    tratamiento: 'Parámetros de gastos fijos distintos de salarios en 0 (fieles al expediente), con la ausencia señalada en el informe (¿sin seguros de responsabilidad civil sanitaria?).',
  },
  {
    id: 'H-042',
    campo: 'Resultados del modelo del expediente (EERR)',
    epigrafe: '4.7 c)',
    valorLiteral:
      'UAI total 65 805,1 (año 1: 8 597,9; años 2+: ≈6 380); utilidades imponibles 62 514,8; utilidad neta 59 806,2; utilidades a distribuir 51 059,9 con «Dividendos socio o parte cubana 25,530.0» y «Dividendos socio o parte extranjera 25,530.0» (50/50).',
    valorNormalizado: 'Distribución 50/50 de utilidades disponibles, total 51 059,9 miles de CUP en 10 años (25 529,96 por socio).',
    unidad: 'miles de CUP',
    periodo: 'Años 1–10',
    fuenteId: 'F08',
    localizador: 'F08, p. 8–9 (EERR completo).',
    categoria: 'A',
    tratamiento: 'Referencias documentales; el motor de PLANEX recalcula su propia serie (véase informe §5 por las divergencias y sus causas).',
    observaciones: 'El resumen de F02 declara una «utilidad distribuible 58,547.0» que no concilia con esta tabla (C-12).',
  },
  {
    id: 'H-043',
    campo: 'Indicadores de evaluación (VAN/TIR/recuperación/RVAN)',
    epigrafe: '4.7 d)',
    valorLiteral:
      'F02 (narrativo): «VAN positivo de 24,709.58 … TIR muy positiva de 1387.85% … se recupera en 0.84 años … RVAN 162.74». F08 (flujo de caja, p. 11): «Valor Actual Neto 20,771.60 … TIR 904.02% … Período de recuperación actualizados 0.92 … RVAN 136.96» (tasa de actualización 20 %; la página de sensibilidad rotula «VAN al 10 %»).',
    valorNormalizado: 'DOS series de indicadores incompatibles entre el resumen y el anexo del propio expediente.',
    unidad: 'miles de CUP · % · años',
    periodo: 'Años 0–10',
    fuenteId: 'F08',
    localizador: 'F02, «evaluación de la viabilidad»; F08, p. 11 y p. 12.',
    categoria: 'D',
    confianza: 'Ninguna de las dos series es verificable: dependen de la tasa de cambio discutida (H-025) y de flujos con depreciación mal cargada (H-031).',
    tratamiento: 'AMBAS series se conservan documentadas; la plantilla no las adopta. El motor genera sus propios indicadores desde los datos documentados y el informe explica las causas de la divergencia.',
    observaciones: 'Contradicción C-02.',
  },
  {
    id: 'H-044',
    campo: 'Balance financiero externo',
    epigrafe: '4.11 / anexo',
    valorLiteral:
      'F02: «el Balance Financiero Externo, es positivo aportando en 10 años un efecto de 2,783.35 MUSD». F08 p. 10: «EFECTO NETO SOBRE LAS DIVISAS (1-2) … TOTAL 3,255.84». F08 p. 20 (resumen): «EFECTO NETO SOBRE LAS DIVISAS (1-2) … 2,925.19».',
    valorNormalizado: 'TRES totales distintos para el mismo concepto: 2 783,35 / 3 255,84 / 2 925,19 (miles de USD).',
    unidad: 'miles de USD',
    periodo: '10 años',
    fuenteId: 'F08',
    localizador: 'F02, «Balance Financiero Externo»; F08, p. 10 y p. 20.',
    categoria: 'D',
    tratamiento: 'Conservados los tres valores con sus localizadores; ninguno se adopta (C-03).',
  },
  {
    id: 'H-045',
    campo: 'Beneficios directos al país',
    epigrafe: '4.11',
    valorLiteral:
      'F08 p. 19: «TOTAL RESULTADOS PAÍS 78,266.44» (impuesto utilidades 2 708,58 + otros impuestos 6 827,90 + dividendos parte cubana 25 529,96 + salarios 43 200,00). F02: «El Beneficio País es igualmente positivo pues impacta con 36,762.93 MCUP en beneficios directos».',
    valorNormalizado: 'Dos totales incompatibles: 78 266,44 (anexo F08) frente a 36 762,93 (resumen F02), en miles de CUP.',
    unidad: 'miles de CUP',
    periodo: 'Años 1–10',
    fuenteId: 'F08',
    localizador: 'F08, p. 19 (BENEFICIO PAÍS); F02, «Beneficio País».',
    categoria: 'D',
    tratamiento: 'Conservados ambos; el motor recalcula la serie con sus propias reglas de agregación documentadas (C-04).',
    observaciones: 'La partida «Salario de trabajadores cubanos» del expediente (43 200,0) incluye implícitamente el salario del directivo extranjero (240,0): etiquetado impreciso registrado (C-17).',
  },
  {
    id: 'H-046',
    campo: 'Tasa de actualización',
    epigrafe: 'cálculo',
    valorLiteral: '«Tasa de actualización (en porciento) 20%» (F08, p. 11); el cuadro de sensibilidad rotula «VAN al: 10.0 %».',
    valorNormalizado: 'Tasa declarada 20 % (con una referencia contradictoria al 10 % en la página de sensibilidad).',
    fuenteId: 'F08',
    localizador: 'F08, p. 11 y p. 12.',
    categoria: 'C',
    tratamiento: 'Registrada; la app calcula la recuperación simple (los indicadores descontados del expediente no se adoptan).',
  },
  {
    id: 'H-047',
    campo: 'Canon / arrendamiento del inmueble',
    epigrafe: '4.7 c)',
    valorLiteral:
      'F02: la parte cubana garantiza «el pago del arrendamiento del inmueble en el periodo de preapertura y en los primeros 6 meses de la puesta en marcha». El EERR no contiene partida de arrendamiento (0,0) y el importe no consta.',
    valorNormalizado: 'Importe del canon NO DOCUMENTADO; además, su tratamiento a partir del mes 7 de operación queda sin definir.',
    fuenteId: 'F02',
    localizador: 'F02, «Aportes o Aportaciones»; F08, p. 8 (EERR sin canon).',
    categoria: 'E',
    tratamiento: 'Canon 0 en el modelo con marca de pendiente (brecha B-18); la plantilla documenta la obligación de CSMC según F02.',
  },
  {
    id: 'H-048',
    campo: 'Servicios públicos, mantenimiento y otros gastos fijos',
    epigrafe: '4.6 e)',
    valorLiteral: 'EERR: «Servicios Públicos 0,0», «Gastos de Mantenimiento 0,0», «Otros Gastos (Detallar) 0,0» en todos los años.',
    valorNormalizado: 'El modelo del expediente no reconoce ningún costo por servicios públicos ni mantenimiento.',
    fuenteId: 'F08',
    localizador: 'F08, p. 8 (EERR).',
    categoria: 'C',
    confianza: 'Cifras explícitas pero de realismo improbable en una instalación asistencial (equipos de rayos X, autoclave, climatización).',
    tratamiento: 'Se mantienen en 0 (fieles al expediente) y se señalan como brecha de estimación (B-19) con los índices de consumo igualmente ausentes.',
  },
  {
    id: 'H-049',
    campo: 'Aranceles de importación',
    epigrafe: '4.8 b)',
    valorLiteral: '«Arancel aduanal a la importación en cuba: Libre de impuestos x AEI» (columna de la cotización de equipos).',
    valorNormalizado: 'El expediente declara exención arancelaria por la condición de AEI.',
    fuenteId: 'F06',
    localizador: 'F06/F02, tabla de cotización de equipamiento; F08, p. 10 (aranceles 0).',
    categoria: 'C',
    confianza: 'Afirmación del expediente sin cita normativa: la exención requiere verificación legal (Ley 118 y normativa aduanera).',
    tratamiento: 'Aranceles 0 en el modelo, con validación normativa pendiente (V-04).',
  },

  // ----------------------------------------------------------- 4.6 técnico
  {
    id: 'H-060',
    campo: 'Cartera de servicios',
    epigrafe: '4.6 a)',
    valorLiteral:
      '«Servicios que se ofertan»: Examen Estomatológico, Odontopediatría, Odontogeriatría, Ortodoncia, Periodoncia, Prótesis Estomatológica, Imagenología, Esterilización; «Servicios que se incluyen»: Estética (blanqueamientos, cirugías, carillas dentales) y diagnóstico mediante tecnología (F02). F09: 15 servicios posibles, 13 que se prestan, 2 suspendidos.',
    valorNormalizado: '15 líneas de servicio en la tabla de precios; 13 activas; TPR y blanqueamientos suspendidos.',
    fuenteId: 'F09',
    localizador: 'F02, «Servicios que se ofertan/se incluyen»; F09, recuento.',
    categoria: 'A',
    tratamiento: 'Incorporada la tabla de 15 servicios de precios; la cartera narrativa queda documentada en 4.6 a).',
  },
  {
    id: 'H-061',
    campo: 'Servicio suspendido I — Tratamientos Pulpo Radiculares (TPR)',
    epigrafe: '4.6 a)',
    valorLiteral: '«Suspendido por las limas que se utilizan quedando en el canal y Rayo x … Precio de un caso: 80.00 USD … Dejado de ingresar por esta causa: 560.00 USD (en 6 meses) … El inversor tiene disposición de aportar ambos recursos».',
    valorNormalizado: 'TPR suspendido (limas + rayos X); 80,00 USD/caso; 560,00 USD dejados de ingresar en 6 meses.',
    unidad: 'USD',
    fuenteId: 'F09',
    localizador: 'F09, apartado «I. TPR».',
    categoria: 'A',
    tratamiento: 'Incorporado a 4.6 (afectaciones) y a la brecha de insumos de endodoncia (limas no cotizadas, B-20).',
  },
  {
    id: 'H-062',
    campo: 'Servicio suspendido II — Blanqueamientos',
    epigrafe: '4.6 a)',
    valorLiteral: '«Precio de un caso: 150.00 USD … Pacientes rechazados quinquenio: 73 … Dejado de ingresar por esta causa: 10950.00 USD … El inversor asegura mantener el abastecimiento de kit todo el tiempo iniciando con un donativo para revitalizar el servicio de inmediato, inicio (500 casos)».',
    valorNormalizado: 'Blanqueamientos suspendidos por falta de kits; 150,00 USD/caso; 73 pacientes rechazados en el quinquenio; 10 950,00 USD de ingreso perdido.',
    unidad: 'USD',
    fuenteId: 'F09',
    localizador: 'F09, apartado «II. Blanqueamientos dentales».',
    categoria: 'A',
    tratamiento: 'Incorporado a 4.6/4.8. El «donativo inicial (500 casos)» no está cotizado: brecha B-21.',
  },
  {
    id: 'H-063',
    campo: 'Prótesis — servicio principal afectado',
    epigrafe: '4.6 a)',
    valorLiteral: '«Prótesis es el servicio de más demanda y que más ingresa en un año por este concepto el promedio de ingreso es de 50.000 USD. Hoy este servicio se presta al 75% por tecnología afectada».',
    valorNormalizado: 'Prótesis: ≈50 000 USD/año de ingreso promedio histórico; operación al 75 % de capacidad por deterioro tecnológico.',
    unidad: 'USD/año · %',
    fuenteId: 'F09',
    localizador: 'F09, apartado de prótesis.',
    categoria: 'C',
    confianza: 'Promedio sin período base ni fuente de las estadísticas; útil como referencia, no como proyección.',
    tratamiento: 'Documentado en 4.6; NO se usa como proyección (la tabla de precios manda).',
    observaciones: 'La cifra de la tabla de servicios para prótesis (15/mes × 193,63 USD) equivale a 34 854 USD/año, distinto del promedio histórico citado: se conservan ambas.',
  },
  {
    id: 'H-064',
    campo: 'Cinco afectaciones tecnológicas de prótesis',
    epigrafe: '4.6 c)',
    valorLiteral:
      '1) Motor de baja «híbrido producto a una innovación de baja calidad»; 2) prensa hidráulica antigua (proceso más largo que el protocolizado, casos con afectación de la dimensión vertical que obligan a repetir); 3) sin micromotor de mano (correcciones con pieza de mano, calidad afectada y roturas frecuentes); 4) sin eliminador de burbujas (calidad de las prótesis afectada); 5) sin olla polimerizadora a presión (cocción en microondas: más tiempo y menor calidad).',
    fuenteId: 'F09',
    localizador: 'F09, numeración 1–5 de prótesis.',
    categoria: 'A',
    tratamiento: 'Incorporadas a 4.6 c) como tecnologías actuales deterioradas; justifican la inversión de F06 (B-22).',
  },
  {
    id: 'H-065',
    campo: 'Equipo de rayos X — estado',
    epigrafe: '4.6 c)',
    valorLiteral: '«EQUIPO RAYOS X ESTOMATOLOGIA … Monitor Roto» (inventario); «Equipo digital de rayos X afectado por el monitor roto» (afectaciones); «Monitor tecnológico Equipo R(x). Se recupera el equipo y se incorporan dos servicios Rx y TPR» (propuesta).',
    valorNormalizado: 'Equipo de rayos X digital fuera de servicio por monitor roto; su reparación (monitor) reactivaría los servicios de radiografía y TPR.',
    fuenteId: 'F04',
    localizador: 'F04, inventario; F07, afectaciones; F09, propuesta 1.',
    categoria: 'A',
    tratamiento: 'Incorporado a 4.6. La reposición del monitor NO está cotizada en la inversión (brecha B-09) pese a que la tabla de servicios proyecta 30 radiografías/mes y el TPR depende del equipo.',
  },
  {
    id: 'H-066',
    campo: 'Compresor — no conforme',
    epigrafe: '4.6 c)',
    valorLiteral: '«Compresor que disponemos debe ser seco y el que estamos utilizando usa aceite» (afectaciones); inventario: «COMPRESOR TANQUE 200LT … Regular».',
    valorNormalizado: 'Compresor con aceite en estado regular: no conforme para uso estomatológico (debe ser seco, libre de aceite).',
    fuenteId: 'F07',
    localizador: 'F07, «PRINCIPALES AFECTACIONES»; F04, inventario.',
    categoria: 'A',
    tratamiento: 'Incorporado a 4.6: justifica el compresor seco de la inversión (3 885,00 USD).',
  },
  {
    id: 'H-067',
    campo: 'Cuadro básico de insumos',
    epigrafe: '4.8 c)',
    valorLiteral: '«El cuadro básico cuenta con 71 renglones para garantizar el servicio».',
    valorNormalizado: 'Cuadro básico de 71 renglones; la cotización F03 desarrolla ≈60 renglones.',
    fuenteId: 'F07',
    localizador: 'F07, «CUADRO BASICO».',
    categoria: 'C',
    tratamiento: 'Documentado; la conciliación completa 71 vs ≈60 renglones queda pendiente (B-23).',
  },
  {
    id: 'H-068',
    campo: 'Inventario de equipos existentes',
    epigrafe: '4.6 a) d)',
    valorLiteral:
      '42 medios inventariados con estado técnico: 2 «GABINETE DENTAL COMPLETO» (Bien), 1 equipo de rayos X (monitor roto), 1 autoclave de mesa 40 L (Regular), 1 compresor 200 L (Regular), 1 láser terapéutico y de blanqueamiento con 12 puntas (Bien), 1 banco de prótesis, 1 prensa hidráulica, destiladora 5 L/h, climatización, informática (PC + monitor), mobiliario de sala de espera y consultas.',
    valorNormalizado: 'Inventario de medios existentes: 2 gabinetes de atención completos, 1 posición de imagenología (inoperativa), 1 banco/laboratorio de prótesis, esterilización (autoclave regular), y soporte general. Sin avalúos.',
    fuenteId: 'F04',
    localizador: 'F04, tabla (42 filas); F07, misma tabla.',
    categoria: 'A',
    tratamiento: 'Incorporado como inventario de 4.6 (tecnologías actuales); SIN horas de utilización ni avalúos (la plantilla no inventa capacidad: véase B-10).',
  },
  {
    id: 'H-069',
    campo: 'Propuesta de inversión en equipos — justificación',
    epigrafe: '4.10 a)',
    valorLiteral: '«5 Equipos de los cuales: 2 recuperan servicios [monitor Rx + kit de blanqueamientos], 2 modernizan la tecnología [motor de baja + prensa hidráulica], 1 incorpora como tecnología nueva [micromotor de mano / eliminador de burbujas]».',
    valorNormalizado: 'La inversión de 5 equipos recupera 2 servicios suspendidos, moderniza 2 procesos de prótesis e incorpora tecnología nueva.',
    fuenteId: 'F09',
    localizador: 'F09, «Posible solución» y «Propuesta inversión».',
    categoria: 'A',
    tratamiento: 'Incorporada a 4.10 como justificación de las partidas (notas de cada fila de inversión).',
    observaciones: 'El kit de blanqueamientos (consumible, «no son equipos») se trata como insumo de la cotización F03; el monitor del rayos X no está cotizado (B-09).',
  },

  // --------------------------------------------------------- 4.8 mercado
  {
    id: 'H-080',
    campo: 'Análisis de mercado',
    epigrafe: '4.5 f) / 4.8',
    valorLiteral:
      'F02 solo aporta contexto general: carga mundial de enfermedades bucodentales (≈3 500 millones de personas; Global Burden of Disease Study 2019), variabilidad de precios entre países y referencias a las estadísticas de 2019 como «año pre crisis», recomendando a SMC «realizar el estudio de factibilidad». F09 aporta anécdotas de demanda represada (73 pacientes rechazados de blanqueamiento en 5 años; prótesis al 75 %).',
    valorNormalizado: 'SIN estudio de mercado: ni demanda aparente/solvente, ni mercados objetivo, ni proyección de captación.',
    fuenteId: 'F02',
    localizador: 'F02, introducción y recomendación inicial; F09 (anécdotas); F05 (confirma el faltante).',
    categoria: 'E',
    tratamiento: 'Los campos de mercado quedan PENDIENTES con sus marcadores; las anécdotas se documentan como contexto cualitativo (brechas B-24/B-25).',
  },

  // --------------------------------------------------------- 4.9 fuerza
  {
    id: 'H-090',
    campo: 'Plantilla de fuerza de trabajo',
    epigrafe: '4.9',
    valorLiteral:
      '«Cubano 9 … 126,000.0 [CUP/mes] … 4,080.0 [kCUP/año] … Extranjero 1 … 20,000.0 … 240.0 … 10 … 146,000.00 … 4,320.00» con categorías: directivos 2, técnicos 4, administrativos 2, servicios 2.',
    valorNormalizado:
      '10 plazas: 9 cubanas (1 directivo, 2 médicos especialistas, 1 lic. estomatología, 1 lic. prótesis, 1 administrador, 1 económico, 1 almacenero, 1 asistente) + 1 directivo extranjero.',
    unidad: 'plazas',
    periodo: 'Operación (años 1–10)',
    fuenteId: 'F08',
    localizador: 'F08, p. 21 (FUERZA DE TRABAJO, dos tablas); F01, nota introductoria (coincide en estructura).',
    categoria: 'A',
    tratamiento: 'Estructura de plantillas incorporada a 4.9 (agrupada por las categorías del modelo: directivos/técnicos/administrativos/servicios).',
  },
  {
    id: 'H-091',
    campo: 'Salario promedio por plaza (derivado)',
    epigrafe: '4.9',
    valorLiteral: 'No existe salario por plaza compatible con el EERR (véase H-036).',
    valorNormalizado:
      'Salario promedio derivado por plaza: se conserva la ESTRUCTURA relativa de la plantilla (H-090) y el TOTAL del EERR (H-035): cubanos escalados ×(340 000/126 000) ≈ ×2,6984 (directivo 53 967; admin 45 873; económico 40 476; médicos 40 476; lic. 32 381; almacenero/asistente 26 984 CUP/mes); extranjero sin escalar (20 000 CUP/mes, documentado).',
    unidad: 'CUP/mes',
    fuenteId: 'F08',
    localizador: 'Derivado de F08 p. 21 y p. 8 (fórmula conservada).',
    categoria: 'B',
    derivacion:
      'factor = (4 080,0 kCUP/año ÷ 12) ÷ 126 000 CUP/mes = 2,6984 sobre los salarios declarados de las plazas cubanas; el extranjero permanece a 20 000 CUP/mes (240 kCUP/año en ambas fuentes). Total reconstruido: 4 319,99 kCUP/año ≈ 4 320,0 ✓.',
    tratamiento: 'Adoptado como salario de cada grupo en la plantilla, marcado como DERIVADO pendiente de la composición salarial real (brecha B-10).',
  },
  {
    id: 'H-092',
    campo: 'Entidad autorizada a contratar la fuerza de trabajo',
    epigrafe: '4.9',
    valorLiteral: 'No se declara expresamente (F05 lo señala). El contrato prevé que CSMC contrate la fuerza de trabajo cubana conforme a la legislación vigente.',
    valorNormalizado: 'PENDIENTE: entidad empleadora no declarada (implícita: CSMC, S.A.).',
    fuenteId: 'F05',
    localizador: 'F05, epígrafe 4.9; F01, cláusulas 3 y 8.1.',
    categoria: 'E',
    tratamiento: 'Campo pendiente con marcador (brecha B-15).',
  },
];

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export function dato(id: string): DatoRegistro {
  const d = REGISTRO.find((x) => x.id === id);
  if (!d) throw new Error(`Dato de registro inexistente: ${id}`);
  return d;
}

export function porCategoria(cat: CategoriaDato): DatoRegistro[] {
  return REGISTRO.filter((x) => x.categoria === cat);
}

export function porEpigrafe(epigrafe: string): DatoRegistro[] {
  return REGISTRO.filter(
    (x) => x.epigrafe === epigrafe || x.epigrafe.startsWith(`${epigrafe} `) || x.epigrafe.includes(`(${epigrafe})`)
  );
}

export const CONTEO_CATEGORIAS = {
  A: porCategoria('A').length,
  B: porCategoria('B').length,
  C: porCategoria('C').length,
  D: porCategoria('D').length,
  E: porCategoria('E').length,
  F: porCategoria('F').length,
} as Record<CategoriaDato, number>;
