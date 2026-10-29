// ============================================================================
// PLANEX-DATA-002 — Supuestos adoptados en el modelo Holguín y marco
// normativo consultado, para el «Documento de consultas al promotor».
//
// Cada supuesto cita su origen (registro H-###, parámetro o regla de la
// plantilla), el efecto de cambiarlo y cómo se confirma. La normativa
// registra las citas exactas halladas el 29/10/2026 (fecha de consulta) y
// qué verificación queda pendiente para el asesor jurídico del promotor.
// Ninguna cifra se inventa y ninguna contradicción del expediente se
// resuelve aquí: este módulo EXPONE lo adoptado y lo que falta decidir.
// ============================================================================

export type OrigenSupuesto =
  | 'documental'
  | 'derivado'
  | 'regla_extendida'
  | 'provisional';

export type ResponsableConsulta =
  | 'Promotor (CSMC)'
  | 'Promotor (Leisure)'
  | 'Promotor (CSMC/Leisure)'
  | 'Especialista designado'
  | 'Asesor jurídico del promotor';

export type PrioridadConsulta = 'critica' | 'alta' | 'media' | 'baja';

export type AreaConsulta =
  | 'identidad_legal'
  | 'financiero_fiscal'
  | 'mercado_precios'
  | 'operacion_laboral'
  | 'suministros_inversion'
  | 'normativo_validaciones';

export interface Supuesto {
  id: string;
  concepto: string;
  valorAdoptado: string;
  dondeEnPlanex: string;
  origen: OrigenSupuesto;
  fundamento: string;
  efectoSiCambia: string;
  comoConfirmar: string;
  referencias: string[];
}

export interface NormaConsultada {
  id: string;
  norma: string;
  queEstablece: string;
  aplicacionAlProyecto: string;
  verificacionPendiente: string;
  fuenteConsulta: string;
}

/** Fecha de la consulta normativa en fuentes oficiales y especializadas. */
export const FECHA_CONSULTA_NORMATIVA = '29/10/2026';

export const ETIQUETA_AREA: Record<AreaConsulta, string> = {
  identidad_legal: 'Identidad y marco jurídico',
  financiero_fiscal: 'Financiero y fiscal',
  mercado_precios: 'Mercado y precios',
  operacion_laboral: 'Operación y fuerza de trabajo',
  suministros_inversion: 'Suministros e inversión',
  normativo_validaciones: 'Validaciones normativas y administrativas',
};

// ---------------------------------------------------------------------------
// SUPUESTOS adoptados por el modelo (plantilla «holguin»)
// ---------------------------------------------------------------------------

export const SUPUESTOS: Supuesto[] = [
  {
    id: 'S-01',
    concepto: 'Tipo de cambio del modelo',
    valorAdoptado: '120 CUP/USD',
    dondeEnPlanex: 'Parámetro «tipo_cambio» (editable) — 4.7 y todos los cálculos que convierten monedas.',
    origen: 'documental',
    fundamento:
      'Lista de precios de CSMC «A TASA DE 1*120» (F02 y F08 p. 23) y precios por caso en USD de F09 (TPR 80,00; blanqueamiento 150,00) que equivalen exactamente a los precios en CUP divididos entre 120 (registro H-025). El expediente usa ADEMÁS la tasa 24 en TODOS los encabezados de sus tablas: contradicción crítica C-01 conservada con ambos valores.',
    efectoSiCambia:
      'Recalcula salarios (4 320 kCUP/año → kUSD), la aportación en efectivo de CSMC, los otros impuestos (682,1 kCUP/año) y toda la presentación CUP↔USD del plan. Un parámetro, sin tocar fórmulas.',
    comoConfirmar:
      'Decisión escrita del promotor con sustento normativo: tasa aplicable a la contabilidad de la AEI bajo el régimen vigente de divisas (V-07). El modelo puede recalcularse en el acto con la tasa decidida.',
    referencias: ['C-01', 'V-07', 'H-025'],
  },
  {
    id: 'S-02',
    concepto: 'Impuesto sobre utilidades',
    valorAdoptado: '15 % sobre la utilidad neta imponible, aplicado solo en los años 8 a 10',
    dondeEnPlanex: 'Parámetro «tasa_impuesto_utilidades» (0,15) + regla editable «impuesto_utilidades_k» (IF(PERIODO >= 8, …)).',
    origen: 'documental',
    fundamento:
      'Patrón del propio expediente (H-033): el EERR de F08 p. 9 aplica 0,00 en los años 1–7 y 15 % en los años 8–10 (903,94 / 902,86 / 901,78 kCUP), sin citar base legal. La investigación normativa de esta misión halló sustento directo: la Ley 118/2014 (Inversión Extranjera), artículo 36.1, fija el 15 % para las partes en contratos de asociación económica internacional, y su artículo 36.2 exime del impuesto durante ocho años a partir de la constitución.',
    efectoSiCambia:
      'Si la exención de los años 1–7 no procede, la utilidad neta de esos años baja ≈15 % cada año. Si el proyecto quedara excluido del régimen especial (art. 43), la tasa general aplicable sería la de la Ley 113 (35 %, confirmada por la Ley 181/2025 del Presupuesto 2026).',
    comoConfirmar:
      'Pronunciamiento escrito (ONAT/asesoría jurídica) de que este CAEI tributa por el artículo 36 de la Ley 118 y de que las modificaciones de 2026 no alteran los artículos 34 a 45. Con la norma verificada, la regla se sustituye desde la interfaz sin editar código.',
    referencias: ['C-15', 'B-16', 'V-05', 'H-033'],
  },
  {
    id: 'S-03',
    concepto: 'Ventana de la exención de 8 años',
    valorAdoptado: 'Exención aplicada a los años 1–7 del horizonte de operación; impuesto desde el año 8',
    dondeEnPlanex: 'Expresión de la regla «impuesto_utilidades_k» (condición PERIODO >= 8).',
    origen: 'provisional',
    fundamento:
      'La Ley 118, artículo 36.2, concede la exención «por un período de ocho años a partir de su constitución». El expediente tributa desde su año 8 de operación, lo que solo es consistente si la constitución y el inicio de operaciones coinciden aproximadamente. La fecha de constitución formal no consta en el expediente (las fechas del cronograma de F08 p. 17 son marcas ilegibles).',
    efectoSiCambia:
      'Si la AEI se constituyó antes del inicio de operaciones, parte de la exención ya está consumida y el impuesto debería empezar antes del año 8 del modelo.',
    comoConfirmar:
      'Fecha de constitución formal de la AEI y fecha del Acta de Inicio de las Operaciones (contrato F01, cláusula de preapertura), más cualquier prórroga de la exención aprobada por el Consejo de Ministros.',
    referencias: ['C-15', 'B-16', 'H-033'],
  },
  {
    id: 'S-04',
    concepto: 'Reparto de beneficios',
    valorAdoptado: '50 % / 50 % entre CSMC, S.A. y Leisure Exporting LLC',
    dondeEnPlanex: 'Parámetro «pct_parte_cubiana» (0,50) — sección 4.11 y reparto de dividendos.',
    origen: 'documental',
    fundamento:
      'Contrato de AEI, cláusula 7.5 (F01; registro H-013): reparto 50/50. CONTRADICCIÓN conservada: la tabla de aportaciones del propio expediente declara participación 49 % / 51 % (C-05, brecha B-04) — el diagnóstico de la app la señala mientras no se aclare.',
    efectoSiCambia:
      'Cambia el reparto de dividendos y el beneficio país por socio en 4.11; no altera los resultados del proyecto.',
    comoConfirmar: 'Decisión escrita de las partes sobre cuál de las dos reglas gobierna (contrato vs tabla de aportaciones).',
    referencias: ['C-05', 'B-04', 'H-013'],
  },
  {
    id: 'S-05',
    concepto: 'Costo variable de materiales por servicio',
    valorAdoptado: 'Precio del servicio × 1,09805 (factor de materiales)',
    dondeEnPlanex: 'Constante FACTOR_MATERIALES de la plantilla (editable), usada en el costo unitario de cada servicio (4.6).',
    origen: 'derivado',
    fundamento:
      'El expediente NO desglosa el consumo material por línea de servicio: solo documenta el consumo anual total. El factor conserva ese total documentado (127 162,60 USD anuales desde el año 2 = cotización de 6 meses 63 581,30 × 2) repartido proporcionalmente al precio de cada servicio (H-040, brecha B-13).',
    efectoSiCambia:
      'Con el consumo real por servicio, el costo variable de cada línea cambia y con él el margen por servicio y la utilidad; el total documentado dejaría de ser la referencia.',
    comoConfirmar:
      'Desglose del consumo de materiales por servicio (cuadro básico × servicios) o al menos por los renglones de mayor peso (prótesis, TPR, blanqueamiento).',
    referencias: ['B-13', 'H-040'],
  },
  {
    id: 'S-06',
    concepto: 'Materiales del año 1 por solo 6 meses',
    valorAdoptado: 'Año 1: 63 581,30 USD (stock de 6 meses); año 2 en adelante: 127 162,60 USD/año',
    dondeEnPlanex: 'Costos variables de 4.6/4.7 (derivados de la cotización F03).',
    origen: 'documental',
    fundamento:
      'La cotización F03 es explícitamente un stock de 6 meses (H-027/H-029) y el EERR del expediente computa 6 meses de materiales en el año 1 con ingresos de 12 meses (C-16): el costo del año 1 queda subestimado frente a un año completo de operación.',
    efectoSiCambia:
      'Si el año 1 opera 12 meses completos, su costo material se duplica y la utilidad del año 1 (ya negativa a tasas documentadas) empeora.',
    comoConfirmar:
      'Aclarar si el año 1 del EERR es un año de operación plena o un año de arranque con 6 meses de operación real (cronograma con fechas legibles — B-15).',
    referencias: ['C-16', 'H-027', 'H-029'],
  },
  {
    id: 'S-07',
    concepto: 'Costo de la fuerza de trabajo',
    valorAdoptado: '4 320,0 kCUP/año como costo TOTAL (factor 1,0), 10 trabajadores',
    dondeEnPlanex: 'Parámetro «factor_costo_laboral» (1,0) + plantilla de 4.9 con escala salarial derivada (fórmula conservada).',
    origen: 'documental',
    fundamento:
      'El EERR del expediente (H-035) carga 4 320 kCUP/año de fuerza de trabajo. CONTRADICCIÓN conservada (C-07): el anexo de fuerza de trabajo suma además seguridad social (540,0) y provisión (86,4) que no concilian con el EERR, y existen tres versiones de la escala salarial (H-090 y anexo). La escala por plaza es DERIVADA: la estructura relativa del anexo escalada para cerrar exacto en 4 320 kCUP/año.',
    efectoSiCambia:
      'Si el costo real incluye seguridad social u otras cargas, el costo laboral anual sube (con 540,0 kCUP más: +12,5 %) y los resultados empeoran.',
    comoConfirmar:
      'Escala salarial definitiva y aclaración de si el 4 320 kCUP/año del EERR ya incluye las cargas de seguridad social, o si estas se suman aparte.',
    referencias: ['C-07', 'B-14', 'H-035', 'H-090'],
  },
  {
    id: 'S-08',
    concepto: 'Depreciación del equipamiento',
    valorAdoptado: 'Depreciación ANUAL lineal sobre los equipos (tasa del 6 % declarada por el expediente ≈ 16,7 años de vida útil)',
    dondeEnPlanex: 'Cálculo de depreciación de 4.7 (regla de fábrica del motor, vidas útiles por partida de inversión).',
    origen: 'derivado',
    fundamento:
      'El expediente declara una tasa de depreciación del 6 % anual, pero su EERR carga la depreciación ACUMULADA de cada período como gasto del período (C-06), lo que infla el costo de los años finales. El modelo corrige ese error de carga y aplica la depreciación anual correcta a la tasa declarada, conservando el total del expediente. La vida útil resultante (≈16,7 años) es más larga que la usual para equipamiento médico de alta tecnología.',
    efectoSiCambia:
      'Una vida útil más corta (p. ej. 10 años) eleva la depreciación anual, reduce la utilidad contable de cada año y cambia la recuperación del capital.',
    comoConfirmar:
      'Vida útil económica autorizada para cada equipo y criterio de depreciación aplicable a la AEI (norma contable vigente y política del Consejo de Administración).',
    referencias: ['C-06', 'B-15', 'H-047'],
  },
  {
    id: 'S-09',
    concepto: 'Mantenimiento y servicios públicos',
    valorAdoptado: '0,00 kUSD/año en ambos conceptos durante todo el horizonte',
    dondeEnPlanex: 'Parámetros «pct_mantenimiento» (0) y «servicios_publicos_anual_k» (0) — costos fijos de 4.7/4.9.',
    origen: 'documental',
    fundamento:
      'El EERR del expediente declara «Gastos de Mantenimiento 0,0» y «Servicios Públicos 0,0» en todos los años (H-048). Brecha de realismo registrada: una instalación con rayos X, autoclave y climatización difícilmente sostiene costos nulos de mantenimiento y energía.',
    efectoSiCambia:
      'Cada kUSD anual de mantenimiento o servicios públicos que se reconozca reduce la utilidad año a año y retrasa la recuperación.',
    comoConfirmar:
      'Presupuesto realista de mantenimiento y servicios públicos de la Sucursal Holguín (o su costo histórico), y decisión de quién lo asume (AEI o CSMC como aportación en especie).',
    referencias: ['B-19', 'H-048'],
  },
  {
    id: 'S-10',
    concepto: 'Canon o arrendamiento del inmueble',
    valorAdoptado: '0,00 kUSD/año tras la preapertura',
    dondeEnPlanex: 'Parámetro «canon_anual_k» (0) — costos fijos de 4.7.',
    origen: 'provisional',
    fundamento:
      'CSMC garantiza el arrendamiento solo en la preapertura y los primeros 6 meses (F02); el importe del canon NO consta en el expediente (H-047, brecha B-18) y el inmueble se aporta por derecho real de usufructo al fondo común (F01).',
    efectoSiCambia:
      'Un canon anual reconocido reduce la utilidad de cada año de operación en ese importe.',
    comoConfirmar:
      'Importe del canon/arrendamiento tras el mes 7 y su tratamiento contractual (incluido en el usufructo o pagado por la AEI).',
    referencias: ['B-18', 'H-047'],
  },
  {
    id: 'S-11',
    concepto: 'Otros impuestos, tasas y contribuciones',
    valorAdoptado: '682,1 kCUP/año (5,68 kUSD a la tasa 120): impuesto de transporte terrestre + contribución al desarrollo local (1 % de las ventas brutas) + tasa de radicación de anuncios',
    dondeEnPlanex: 'Parámetro «otros_impuestos_anual_k» (5,68) — 4.10 y beneficios al país.',
    origen: 'documental',
    fundamento:
      'Partidas del propio expediente (H-034), sin desglose adjunto (brecha B-17). Hallazgo normativo: la Ley 118, artículo 42, EXIME a las partes en AEI de la contribución territorial para el desarrollo local DURANTE el período de recuperación de la inversión — si el proyecto aún no se recupera, esa partida podría no corresponder todavía.',
    efectoSiCambia:
      'Sin la contribución territorial (1 % de las ventas), los otros impuestos bajan ≈1 159 kCUP/año ≈ 9,66 kUSD/año y la utilidad sube en igual medida.',
    comoConfirmar:
      'Desglose de las tres partidas y confirmación del asesor jurídico sobre la exención del artículo 42 mientras no concluya la recuperación de la inversión.',
    referencias: ['B-17', 'H-034'],
  },
  {
    id: 'S-12',
    concepto: 'Aranceles de importación',
    valorAdoptado: '0,00 kUSD/año («Libre de impuestos x AEI» según la cotización de equipos)',
    dondeEnPlanex: 'Parámetro «aranceles_anual_k» (0) — costos de 4.7/4.10.',
    origen: 'documental',
    fundamento:
      'La cotización de equipos declara «Libre de impuestos x AEI» (H-049) y el balance externo computa aranceles 0. La Ley 118, artículo 41, EXIME del impuesto aduanero a las AEI por las importaciones de equipos y maquinarias DURANTE el proceso inversionista, según las normas del Ministerio de Finanzas y Precios — sustento que la cotización invoca sin citar.',
    efectoSiCambia:
      'Si la exención no procede o no cubre reposiciones futuras (p. ej. el monitor del equipo de rayos X), aparecen costos de importación no modelados.',
    comoConfirmar:
      'Certificado o resolución de la exención arancelaria para este negocio (V-04) y alcance: solo inversión inicial o también reposiciones.',
    referencias: ['V-04', 'H-049'],
  },
  {
    id: 'S-13',
    concepto: 'Precios y demanda constantes',
    valorAdoptado: 'Sin crecimiento de precios ni de volumen en el horizonte (0 % ambos)',
    dondeEnPlanex: 'Parámetros «crecimiento_precios» (0) y «crecimiento_volumen» (0) — proyección de 4.7.',
    origen: 'documental',
    fundamento:
      'La lista de precios y la demanda mensual prevista del expediente son constantes (H-037). CONTRADICCIÓN conservada: el EERR del expediente reduce los ingresos un 4,95 % desde el año 2 sin explicación (C-14); el modelo mantiene la demanda del año 1 y registra la divergencia en lugar de reproducirla sin causa.',
    efectoSiCambia:
      'Cualquier indexación de precios o variación de demanda recalcula la proyección completa; replicar el −4,95 % del EERR requeriría su justificación documentada.',
    comoConfirmar:
      'Política de actualización de la lista de precios de CSMC y sustento del −4,95 % del EERR (o su corrección).',
    referencias: ['C-14', 'H-037'],
  },
  {
    id: 'S-14',
    concepto: 'Escáner intraoral 3D',
    valorAdoptado: 'EXCLUIDO de la inversión (no cotizado en el modelo)',
    dondeEnPlanex: 'Inversión fija de 4.6 — solo los 5 equipos de F06 (5 274,00 USD).',
    origen: 'provisional',
    fundamento:
      'El escáner intraoral 3D aparece cotizado en F02 (12 035,00 USD) pero NO está en la tabla de inversión del anexo (C-08, brecha B-07): decidir si se incluye es competencia del promotor. Las tecnologías del objeto contractual (rehabilitación protésica digital, cirugía guiada) lo hacen plausible.',
    efectoSiCambia:
      'Incluirlo suma 12 035,00 USD a la inversión (≈ +230 % sobre los equipos actuales) y activa su depreciación; excluirlo exige declarar qué tecnologías sustituyen al escáner en los servicios digitales prometidos.',
    comoConfirmar: 'Decisión escrita de las partes sobre incluirlo, excluirlo o diferirlo a una segunda fase.',
    referencias: ['C-08', 'B-07', 'H-021'],
  },
  {
    id: 'S-15',
    concepto: 'Capital de trabajo inicial',
    valorAdoptado: '0,00 kUSD',
    dondeEnPlanex: 'Parámetro «capital_trabajo_k» (0) — inversión y financiamiento de 4.5/4.6.',
    origen: 'documental',
    fundamento:
      'La tabla de financiamientos del expediente declara capital de trabajo 0,00 (H-023), pero su propio estado de situación proyecta existencias y cuentas por cobrar: anomalía registrada (brecha B-12).',
    efectoSiCambia:
      'Un capital de trabajo real (p. ej. el stock semestral de insumos ya cotizado) eleva la inversión total y la necesidad de aportaciones.',
    comoConfirmar: 'Cálculo del capital de trabajo necesario para el ciclo operativo (insumos + cuentas por cobrar − proveedores).',
    referencias: ['B-12', 'H-023'],
  },
  {
    id: 'S-16',
    concepto: 'Reserva legal y fondos',
    valorAdoptado: '≈16 % de la base distribuible en los años 1–7 (11 % en los años 8–10)',
    dondeEnPlanex: 'Parámetro «pct_reserva_legal» (0,16) — reparto de 4.11.',
    origen: 'derivado',
    fundamento:
      'Aproximación derivada del patrón del propio EERR (H-042): 5 % contingencias + 1 % fondo de estimulación + ≈10 % reservas voluntarias en los años 1–7. La política societaria real no está documentada.',
    efectoSiCambia:
      'Cambia el monto repartible entre socios cada año (no el resultado del proyecto). El Decreto-Ley 128/2026 (art. 29 reformado) faculta a los órganos de dirección a decidir el destino de las utilidades, incluido el fondo de estimulación.',
    comoConfirmar: 'Política de reservas y distribución aprobada por el Consejo de Administración de la AEI.',
    referencias: ['H-042'],
  },
  {
    id: 'S-17',
    concepto: 'Gastos previos en CUP dentro del total de inversión',
    valorAdoptado: '26,20 kCUP de preoperación se suman al total (regla extendida de la plantilla)',
    dondeEnPlanex: 'Regla «gastos_previos_k» con expresión extendida (suma partidas en USD y en CUP convertidas).',
    origen: 'regla_extendida',
    fundamento:
      'Los gastos previos del expediente están en CUP (H-022). La regla de fábrica solo sumaba partidas en USD y las habría IGNORADO en silencio; la plantilla extiende la EXPRESIÓN (mecanismo diseñado de la app) para incluirlas. Hallazgo documentado al propietario: extender la regla de fábrica exige recalibrar la línea base editorial de DOC-003.',
    efectoSiCambia:
      'Sin la extensión, la inversión total del proyecto pierde 26,20 kCUP (≈0,22 kUSD) — efecto pequeño pero de integridad.',
    comoConfirmar: 'Decisión del propietario de la app sobre extender la regla de fábrica para todos los proyectos.',
    referencias: ['H-022'],
  },
];

// ---------------------------------------------------------------------------
// NORMATIVA consultada (citas del 29/10/2026 — verificaciones pendientes
// marcadas; ninguna se presenta como acreditada para ESTE negocio)
// ---------------------------------------------------------------------------

export const NORMATIVA: NormaConsultada[] = [
  {
    id: 'N-01',
    norma:
      'Ley 118 «De la Inversión Extranjera», de 29 de marzo de 2014 (GOC-2014-O29), Título VIII — régimen tributario especial, artículos 34 a 45.',
    queEstablece:
      'Art. 36.1: las partes en contratos de asociación económica internacional pagan el impuesto sobre utilidades aplicando «un tipo impositivo del quince por ciento (15 %) sobre la utilidad neta imponible». Art. 36.2: exención del impuesto sobre utilidades «por un período de ocho años a partir de su constitución», prorrogable por el Consejo de Ministros. Art. 36.3: exención de la utilidad neta autorizada a reinvertir. Art. 39: exención del impuesto por la utilización de la fuerza de trabajo. Art. 41: exención del impuesto aduanero por las importaciones de equipos y maquinarias durante el proceso inversionista, según normas del MFP. Art. 42: exención de la contribución territorial para el desarrollo local durante el período de recuperación de la inversión. Arts. 37 y 38: bonificación del 50 % en los impuestos sobre las ventas y sobre los servicios, con exención durante el primer año de operación. Art. 35: exención del impuesto sobre ingresos personales a los inversionistas por dividendos. Art. 43: EXCLUYE del régimen especial a los contratos de administración hotelera, productiva o de servicios y de prestación de servicios profesionales, que tributan por la Ley del Sistema Tributario (salvo la exención de los impuestos sobre ventas y servicios para el inversionista extranjero en esos contratos).',
    aplicacionAlProyecto:
      'SUSTENTA el patrón del expediente que el modelo adopta (S-02 y S-03): 15 % a partir del año 8 de la exención. Implica además dos partidas del modelo posiblemente sobretaxadas hoy (S-11: contribución al desarrollo local exenta durante la recuperación) o eximibles (S-12: aranceles del proceso inversionista).',
    verificacionPendiente:
      'Pronunciamiento jurídico de que este CAEI NO queda excluido por el artículo 43 (prestación de servicios estomatológicos: ¿asociación para producir servicios directamente, o contrato de «prestación de servicios profesionales»?), y de que los artículos 34 a 45 no fueron alterados por el Decreto-Ley 128 de 2026.',
    fuenteConsulta:
      'Texto consolidado de la Ley 118/2014 (arts. 34–45), Diario Oficial/RAE y copias de la Gaceta Oficial de la República de Cuba.',
  },
  {
    id: 'N-02',
    norma:
      'Decreto-Ley 128 de 2026, modificativo de la Ley 118 «De la Inversión Extranjera» (firmado el 28 de julio de 2026; publicado en la Gaceta Oficial No. 73 Ordinaria de 2026, con vigencia inmediata; parte de las 176 transformaciones aprobadas el 19 de junio de 2026).',
    queEstablece:
      'Art. 25 reformado: empresas mixtas y partes en AEI pueden abrir y operar cuentas en bancos del exterior con NOTIFICACIÓN al Banco Central (ya no autorización previa), y concertar operaciones crediticias con instituciones financieras extranjeras (Resolución 100/2026 del BCU). Art. 29 reformado: los órganos de dirección deciden el destino de las utilidades, incluida la creación de un fondo de estimulación; posibilidad de gratificaciones en divisas a trabajadores; EXCLUIDO para contratos de administración hotelera, productiva o de servicios y de prestación de servicios profesionales. Art. 30.1 reformado: los trabajadores pueden ser contratados DIRECTAMENTE por las partes de la AEI o a través de entidades empleadoras autorizadas por el MTSS (Acuerdo 10443/2026 del Consejo de Ministros; Resolución 56/2026 del MTSS).',
    aplicacionAlProyecto:
      'Define la modalidad de contratación laboral aplicable (consulta de fuerza de trabajo) y amplía la gestión de divisas y utilidades del negocio. No se identificó en las reseñas consultadas que modifique los artículos 34 a 45 (régimen tributario).',
    verificacionPendiente:
      'Texto íntegro del Decreto-Ley 128 (Gaceta No. 73/2026) para confirmar qué artículos de la Ley 118 quedaron reformados y su efecto sobre ESTE CAEI, incluida la exclusión del art. 29 reformado.',
    fuenteConsulta:
      'Gaceta Oficial No. 73 Ordinaria de 2026; reseñas de MINCEX (octubre 2026) y prensa especializada del 3 de septiembre de 2026.',
  },
  {
    id: 'N-03',
    norma:
      'Ley 113 «Del Sistema Tributario», de 23 de julio de 2012 (GOC-2012-O53), texto concordado y actualizado (Edición Especial No. 1 de 12 de enero de 2026 tras el Decreto-Ley 21/2020 y el Decreto-Ley 107/2025, entre otros).',
    queEstablece:
      'Tributos, principios y procedimientos generales del sistema tributario cubano. El impuesto sobre utilidades de las entidades aplica la tasa general del 35 % — confirmada para 2026 por la Ley del Presupuesto del Estado (Ley 181/2025): «35 % sobre utilidades». Contiene además el impuesto de transporte terrestre, la contribución territorial para el desarrollo local (aplicación local) y la tasa de radicación de anuncios, partidas que el expediente incluye en «otros impuestos».',
    aplicacionAlProyecto:
      'Es la tasa general (35 %) que aplicaría SOLO si el negocio quedara excluido del régimen especial de la Ley 118 por su artículo 43. Las demás partidas del expediente (transporte, desarrollo local, anuncios) se rigen por esta ley en lo que no esté eximido.',
    verificacionPendiente:
      'Confirmación con el asesor jurídico de la tasa vigente para cada tributo en 2026 y de las exenciones aplicables por la Ley 118 (arts. 41 y 42) durante el período que corresponda.',
    fuenteConsulta:
      'Gaceta Oficial (gacetaoficial.gob.cu), ficha de la Ley 113 con sus normas modificativas; reseña de la Ley 181/2025 (Presupuesto 2026).',
  },
  {
    id: 'N-04',
    norma:
      'Decreto-Ley 113 de 2025 «Sobre las transacciones en divisas en la economía nacional» (10 de diciembre de 2025; GOC-2025-536-O89), con la Resolución 140/2025 del MEP (bases generales del sistema de gestión, control y asignación de divisas — modificada en 2026, GOC-2026-O141) y las Resoluciones 125 y 126/2025 del BCU (cuentas en divisas y asignación de capacidad de acceso a la divisa, ACAD).',
    queEstablece:
      'Actualiza el régimen jurídico de las transacciones en divisas: autoriza operaciones en divisas a personas jurídicas y naturales (incluidas las asociaciones económicas internacionales, expresamente dentro del ámbito de la Resolución 140/2025), regula las cuentas en divisas y el acceso a la divisa mediante capacidad asignada (ACAD), y faculta al BCU a declarar monedas de curso legal. El Ministerio de Economía y Planificación informa trimestralmente al Consejo de Ministros.',
    aplicacionAlProyecto:
      'Es el marco vigente de la divisa para la AEI (ingresos en divisas, pagos de insumos importados, cuentas bancarias). La tasa de cambio oficial del Banco Central de Cuba consultada el 29/10/2026 es de 758,00 CUP por USD (844,18 por EUR; 539,41 por CAD), con tasas de compra/venta por segmento — sustancialmente distinta de las tasas 24 y 120 que coexisten en el expediente (C-01).',
    verificacionPendiente:
      'Determinación del régimen cambiario aplicable a la contabilidad y los estados financieros de ESTA AEI (tasa oficial de referencia, fecha de aplicación y conversión de los aportes en especie importados), y de la capacidad de acceso a la divisa que se le asignará (Q-08 y V-07).',
    fuenteConsulta:
      'Banco Central de Cuba (bc.gob.cu, tasas del 29/10/2026); Gaceta Oficial No. 89 Ordinaria de 2025; reseñas oficiales de diciembre de 2025.',
  },
  {
    id: 'N-05',
    norma:
      'GOC-2026-O57, de 9 de julio de 2026 — «Bases metodológicas para la elaboración del Plan de Negocios para la presentación de las propuestas de negocios con inversión extranjera».',
    queEstablece:
      'Metodología de referencia del plan de negocios: estructura de los apartados 4.1 a 4.12 (información general, resumen ejecutivo, descripción del negocio, aspectos técnicos y operativos, análisis financiero, flujos de caja, mercado, fuerza de trabajo, inversiones, beneficios directos al país y conclusiones), exigencias de coherencia de cifras y presentación de la propuesta ante las autoridades competentes.',
    aplicacionAlProyecto:
      'Es la metodología que la aplicación PLANEX implementa y contra la cual se midió la cobertura del expediente (55,3 % de campos obligatorios con evidencia suficiente, 15 parciales, 6 pendientes y 4 dinámicos). El plan solo puede presentarse cuando los campos pendientes tengan evidencia y las contradicciones registradas estén resueltas por el promotor.',
    verificacionPendiente:
      'Revisión por especialistas de la versión vigente del documento metodológico y de los requisitos de presentación formal para la modalidad CAEI.',
    fuenteConsulta:
      'Documento de referencia de la misión (texto suministrado del GOC-2026-O57, 9 de julio de 2026).',
  },
  {
    id: 'N-06',
    norma:
      'Ley 181/2025 «Del Presupuesto del Estado» para el año 2026 (GOC-2025-O99), y leyes anuales del presupuesto precedentes (Ley 174/2024) en lo que adecúan la Ley 113.',
    queEstablece:
      'Consolida para 2026 los tipos impositivos vigentes: «35 % sobre utilidades» y 15 % como tasa general de los impuestos sobre las ventas minoristas y los servicios (incluyendo mipymes y cooperativas no agropecuarias).',
    aplicacionAlProyecto:
      'Confirma que la tasa general del impuesto sobre utilidades sigue siendo 35 % en 2026, y que el 15 % del expediente SOLO puede sostenerse por el régimen especial de la Ley 118 (art. 36.1) para esta modalidad de AEI.',
    verificacionPendiente:
      'Comprobación anual (ley del presupuesto vigente al momento de la presentación) de que no cambia la tasa aplicable al negocio.',
    fuenteConsulta:
      'Reseñas de la Gaceta Oficial y prensa económica (enero de 2026) sobre la Ley del Presupuesto 2026.',
  },
];

/** Censos para portada y resumen. */
export function resumenSupuestos() {
  const porOrigen = SUPUESTOS.reduce((acc, s) => {
    acc[s.origen] = (acc[s.origen] ?? 0) + 1;
    return acc;
  }, {} as Record<OrigenSupuesto, number>);
  return { total: SUPUESTOS.length, porOrigen };
}
