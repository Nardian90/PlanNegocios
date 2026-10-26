// ============================================================================
// PLANEX Cuba — Modelo de datos (fuente única de verdad)
// Plan de Negocios para propuestas de inversión extranjera (GOC-2026-O57)
//
// Esquema 2.0.0 (misión PLANEX-AUDIT-001):
//  - Registro de activos depreciables con calendario por activo.
//  - Calendario de deuda explícito (gracia principal/total, 3 métodos).
//  - Recursos operativos compartidos y capacidad derivada de datos.
//  - Escenarios de capacidad A (constante) y B (ampliaciones).
//  - Flujos de caja separados: proyecto (FCFF) y socios (FCFE).
//  - Módulo de dividendos con resultados acumulados, reservas y efectivo.
//  - Beneficios directos al país con metadatos por partida.
//  - Textos analíticos dinámicos con trazabilidad (generado/manual/desactualizado).
//  - Diagnóstico con cuatro niveles de severidad.
// ============================================================================

/** Ámbito de evaluación de una regla. */
export type AmbitoRegla = 'servicio' | 'personal' | 'proyecto' | 'anio';

/**
 * Moneda de PRESENTACIÓN del documento (misión PLANEX-DOC-001 §5).
 * No altera los datos del plan ni los cálculos del motor: determina en qué
 * moneda se muestran los importes en la previsualización, el PDF y el DOCX.
 * El motor calcula en miles de USD (kUSD) y los salarios en CUP; la
 * conversión se aplica UNA sola vez, desde la moneda de origen.
 */
export type MonedaPresentacion = 'CUP' | 'USD';

export type TipoParametro =
  | 'porcentaje'
  | 'moneda_kusd'
  | 'cup'
  | 'usd'
  | 'numero'
  | 'anios';

/** Nivel A de configuración: parámetros de cálculo. */
export interface Parametro {
  id: string;
  nombre: string;
  descripcion: string;
  valor: number;
  unidad: string;
  tipo: TipoParametro;
  fuente: string;
  fechaRef: string; // ISO (yyyy-mm-dd) o ''
  editable: boolean;
  /** Supuesto de demostración — debe validarse antes de un uso oficial. */
  demo: boolean;
}

/** Nivel B de configuración: regla con expresión editable. */
export interface Regla {
  id: string;
  nombre: string;
  descripcion: string;
  /** Expresión activa (lenguaje PLANEX). */
  expresion: string;
  /** Expresión de fábrica para restaurar. */
  expresionDefault: string;
  ambito: AmbitoRegla;
  unidad: string;
  categoria: string;
  habilitada: boolean;
  /** Expresión anterior si fue modificada (historial mínimo). */
  expresionAnterior?: string;
  modificada?: boolean;
}

// ---------------------------------------------------------------------------
// Filas de tablas editables
// ---------------------------------------------------------------------------

export interface ServicioRow {
  id: string;
  nombre: string;
  /** Precio unitario previsto (USD). */
  precioBase: number;
  /** Cantidad mensual prevista — DEMANDA (año 1). El motor limita por capacidad. */
  cantidadBaseMensual: number;
  /** Año en que la línea inicia su demanda (1 = primer año de operación). */
  anioInicioDemanda: number;
  /** Capacidad técnica máxima mensual ADICIONAL del propio servicio (0 = sin tope directo). */
  capacidadMaxMensual: number;
  /** Costo variable unitario (USD). */
  costoVariableUnitario: number;
  /** Duración media del procedimiento en minutos (consumo de recursos). */
  duracionMinutos: number;
  /** Recursos operativos que utiliza cada procedimiento (ids de RecursoRow). */
  recursoIds: string[];
  fuente: string;
  /** Canal de comercialización (metodología 4.8): los ingresos se desglosan
   *  por canal SIN duplicar operaciones. Sin valor = sin canal declarado
   *  (el diagnóstico lo marca como pendiente). */
  canal?: 'exportacion' | 'plataformas_exterior' | 'plaza';
}

export interface ExpansionRecurso {
  id: string;
  /** Año de disponibilidad de la ampliación (≥ 1). */
  anio: number;
  /** Unidades añadidas al recurso. */
  cantidad: number;
  /** Costo de la ampliación (kUSD). Se trata como CAPEX del año. */
  costoKUSD: number;
  /** Vida útil de la ampliación para su depreciación (años). */
  vidaUtilAnios: number;
  observacion: string;
}

export interface RecursoRow {
  id: string;
  nombre: string;
  tipo: 'gabinete' | 'sillon' | 'equipo' | 'profesional' | 'local' | 'otro';
  /** Unidades disponibles en el escenario base. */
  cantidad: number;
  /** Horas de utilización por unidad y día. */
  horasDia: number;
  /** Días de operación por año. */
  diasAnio: number;
  /** Fracción de horas dedicada a mantenimiento (0–1). */
  pctMantenimiento: number;
  /** Año desde el que el recurso está disponible (≥ 0; 1 = operación). */
  anioDisponible: number;
  expansiones: ExpansionRecurso[];
  observacion: string;
}

export type GrupoPersonal = 'cubano_directivo' | 'cubano_otro' | 'extranjero_directivo' | 'extranjero_otro';
export type EtapaPersonal = 'montaje' | 'operacion';

export interface PersonalRow {
  id: string;
  etapa: EtapaPersonal;
  grupo: GrupoPersonal;
  cantidad: number;
  /** Salario promedio anual en CUP (metodología 4.9). */
  salarioPromedioAnualCUP: number;
}

export type TipoAportacion =
  | 'efectivo'
  | 'activos_circulantes'
  | 'activos_fijos_tangibles'
  | 'derechos_reales'
  | 'intangibles'
  | 'otros';

export interface AportacionRow {
  id: string;
  socio: 'nacional' | 'extranjero';
  tipo: TipoAportacion;
  /** Montos por año (kUSD, índice 0 = año 1). Longitud fija: 3 años. */
  montos: number[];
  referenciaDocumental: string;
}

export type CategoriaInversion = 'gastos_previos' | 'inversion_fija' | 'inducida';
export type Moneda = 'USD' | 'CUP';
export type MetodoDepreciacion = 'lineal' | 'ninguno';

export interface InversionRow {
  id: string;
  concepto: string;
  categoria: CategoriaInversion;
  moneda: Moneda;
  /** Monto en la moneda de la fila (miles, un decimal). */
  monto: number;
  /** Vida útil en años para depreciación (solo inversión fija). */
  vidaUtilAnios: number;
  /** Año en que el activo está disponible para su uso (1 = primer año de operación). */
  anioDisponible: number;
  /** Valor residual como fracción del costo (0–1). */
  valorResidualPct: number;
  metodoDepreciacion: MetodoDepreciacion;
  observacion: string;
}

export interface VehiculoRow {
  id: string;
  tipo: string;
  cantidad: number;
  montoKUSD: number;
}

export interface ConsumoRow {
  id: string;
  concepto: string;
  unidad: string;
  cantidad: number;
  periodo: string;
  observacion: string;
}

export interface CronogramaRow {
  id: string;
  etapa: string;
  inicio: string; // yyyy-mm
  fin: string;
  observacion: string;
}

// ---------------------------------------------------------------------------
// Calendario de deuda (misión §6)
// ---------------------------------------------------------------------------

export type TipoGracia = 'principal' | 'total';
export type MetodoAmortizacion = 'capital_constante' | 'sistema_frances' | 'pago_unico';

export interface DeudaConfig {
  /** ¿Existe crédito? Si es false, el resto de campos se ignora. */
  habilitada: boolean;
  /** Año en que se desembolsa el principal (0 = año de montaje). */
  anioDesembolso: number;
  /** Gracia de principal (solo intereses) o total (no se paga nada; el interés
   *  devengado se capitaliza en el saldo). */
  tipoGracia: TipoGracia;
  /** Método de amortización del principal tras la gracia. */
  metodo: MetodoAmortizacion;
  /** Documentación del supuesto (contrato, fuente). */
  fuente: string;
}

export interface FilaDeuda {
  anio: number;
  saldoInicial: number;
  desembolso: number;
  interesDevengado: number;
  interesCapitalizado: number;
  amortizacion: number;
  interesPagado: number;
  saldoFinal: number;
}

// ---------------------------------------------------------------------------
// Escenarios de capacidad (misión §7.3)
// ---------------------------------------------------------------------------

export type EscenarioCapacidad = 'A_constante' | 'B_ampliacion';

// ---------------------------------------------------------------------------
// Textos analíticos con trazabilidad (misión §12.13)
// ---------------------------------------------------------------------------

export type EstadoAnalisis = 'generado' | 'manual' | 'desactualizado';

export interface AnalisisGuardado {
  /** Texto manual del usuario (undefined → se muestra el generado). */
  texto?: string;
  /** Huella de los datos de origen en el momento del guardado manual. */
  huellaOrigen?: string;
  /** Autor y fecha de la última edición manual (trazabilidad colaborativa). */
  actualizadoPor?: string;
  actualizadoEn?: string;
}

export type RegistroAnalisis = Record<string, AnalisisGuardado>;

// ---------------------------------------------------------------------------
// Secciones narrativas (4.1 – 4.12)
// ---------------------------------------------------------------------------

export interface GeneralInfo {
  elaboradoPor: string;
  cargo: string;
  firmaIdentificacion: string;
  fecha: string;
  declaracionResponsabilidad: boolean;
}

export interface TituloInfo {
  nombreProyecto: string;
  denominacionPropuesta: string;
}

export interface ResumenInfo {
  introduccion: string;
  notas: string;
}

export interface NegocioInfo {
  modalidad: string;
  objetoSocial: string;
  plazoVigencia: string;
  fundamentacion: string;
  objetivosInversion: string;
  relacionPNDES: string;
  relacionEDT: string;
  bienesServicios: string;
  mercadoInterno: string;
  mercadoExterno: string;
  reglaDistribucion: string;
}

export interface InversionistaInfo {
  nombre: string;
  domicilio: string;
  identificacionFiscal: string;
  experiencia: string;
  vinculacionCuba: string;
}

export interface TecnicoInfo {
  caracterizacion: string;
  capacidadInstalada: string;
  plazoNiveles: string;
  tecnologiasActuales: string;
  tecnologiasNuevas: string;
  localizacion: string;
  infraestructura: string;
  terrenosInstalaciones: string;
  necesidadesConstruccion: string;
  /** Escenario activo de capacidad (misión §7.3). */
  escenarioCapacidad: EscenarioCapacidad;
}

export interface MercadoInfo {
  caracterizacion: string;
  requisitosRegulatorios: string;
  materiasPrimas: string;
  fuentesSuministro: string;
  consumoEstimado: string;
  demandaAparente: string;
  demandaSolvente: string;
  /** Demanda solvente cuantificada (personas con capacidad de pago), para la
   *  conciliación demanda/captación/volumen (misión DOC-002 §7). Opcional. */
  demandaSolventePersonas?: number;
  /** Captación objetivo del año 1 como fracción (0–1) de la demanda solvente. Opcional. */
  captacionPrevistaPct?: number;
  metodoEstimacion: string;
  fuentesConsulta: string;
  ventasExportacion: string;
  ventasDivisas: string;
  ventasMonedaNacional: string;
}

export interface FuerzaInfo {
  entidadContratante: string;
}

export interface ConclusionesInfo {
  texto: string;
}

// ---------------------------------------------------------------------------
// Proyecto completo
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = '2.0.0';

export interface PlanexMeta {
  schemaVersion: string;
  app: string;
  generado: string;
  plantillaOrigen: 'clinica' | 'default' | 'centro' | 'nuevo';
}

export interface Ajustes {
  horizonteAnios: number;
  /** Moneda de presentación del documento. Opcional: los planes creados
   *  antes de DOC-001 se interpretan como 'USD' (unidad nativa del motor). */
  monedaPresentacion?: MonedaPresentacion;
}

export interface FinancieroInfo {
  inversion: InversionRow[];
  vehiculos: VehiculoRow[];
  /** Otros ingresos por año (kUSD, índice 0 = año 1). */
  otrosIngresos: number[];
  /** Calendario de deuda (misión §6). */
  deuda: DeudaConfig;
}

export interface PlanexProject {
  planex: PlanexMeta;
  id: string;
  nombre: string;
  creado: string;
  actualizado: string;
  ajustes: Ajustes;
  general: GeneralInfo;
  titulo: TituloInfo;
  resumen: ResumenInfo;
  negocio: NegocioInfo;
  inversionistaExtranjero: InversionistaInfo;
  inversionistaNacional: InversionistaInfo;
  aportaciones: AportacionRow[];
  tecnico: TecnicoInfo;
  consumos: ConsumoRow[];
  recursos: RecursoRow[];
  servicios: ServicioRow[];
  financiero: FinancieroInfo;
  mercado: MercadoInfo;
  fuerza: FuerzaInfo;
  personal: PersonalRow[];
  cronograma: CronogramaRow[];
  conclusiones: ConclusionesInfo;
  /** Textos analíticos editables con trazabilidad (misión §12.13). */
  analisis: RegistroAnalisis;
  parametros: Parametro[];
  reglas: Regla[];
}

// ---------------------------------------------------------------------------
// Resultados del motor de cálculo
// ---------------------------------------------------------------------------

export type TipoIssue =
  | 'error'
  | 'inconsistencia'
  | 'pendiente'
  | 'supuesto'
  | 'documental'
  | 'legal';

export interface Issue {
  tipo: TipoIssue;
  codigo: string;
  mensaje: string;
  seccion?: string;
  reglaId?: string;
  parametroId?: string;
  objetivoId?: string;
}

/** Estado de una regla tras el cálculo. */
export interface EstadoRegla {
  id: string;
  ok: boolean;
  error?: string;
  /** Valores por año. */
  valores?: Record<number, number>;
  refs: string[];
  params: string[];
}

export interface ServicioCalculado {
  id: string;
  nombre: string;
  /** Valores por año de las reglas de ámbito servicio. */
  valores: Record<number, Record<string, number>>;
  /** Cantidad REALIZABLE por año (limitada por capacidad). */
  cantidades: Record<number, number>;
  /** Años en los que la demanda prevista superó la capacidad disponible. */
  capacidadesExcedidas: number[];
}

/** Resultado de capacidad por servicio y año (misión §7). */
export interface CapacidadServicio {
  demandaMensual: number;
  capacidadMensual: number;
  cantidadRealMensual: number;
  /** demanda / capacidad (puede superar 1). */
  utilizacion: number;
}

export interface RecursoCalculado {
  id: string;
  nombre: string;
  /** Horas-mes disponibles por año (tras mantenimiento y ampliaciones). */
  horasDisponibles: Record<number, number>;
  /** Horas-mes demandadas por los servicios que lo usan. */
  horasDemandadas: Record<number, number>;
  /** demanda / disponible. */
  utilizacion: Record<number, number>;
}

/** Depreciación por activo (misión §5). */
export interface ActivoDepreciable {
  id: string;
  concepto: string;
  /** Base depreciable en kUSD (monto − residual, CUP convertido). */
  baseDepreciableKUSD: number;
  vidaUtilAnios: number;
  anioDisponible: number;
  valorResidualPct: number;
  metodo: MetodoDepreciacion;
  /** Depreciación por año (kUSD). */
  depreciacion: Record<number, number>;
  /** Acumulada al final del horizonte. */
  acumulada: number;
  /** Valor neto en libros al final del horizonte. */
  vnl: number;
}

export interface DividendosAnio {
  anio: number;
  udi: number;
  saldoAcumulablePrevio: number;
  base: number;
  reserva: number;
  distribuible: number;
  propuestos: number;
  cajaAcumulada: number;
  pagables: number;
  socioNacional: number;
  socioExtranjero: number;
  saldoAcumulable: number;
}

export type FlujoIndicador = 'proyecto' | 'socios';

export interface Recuperacion {
  indicador: FlujoIndicador;
  /** Período de recuperación en años (interpolación lineal) o null. */
  anios: number | null;
  /** Año en que se cruza el cero (si ocurre dentro del horizonte). */
  anioCruce: number | null;
  /** ¿No se puede determinar (flujos no convencionales / falta de datos)? */
  indeterminado: boolean;
  motivo: string;
}

// ---------------------------------------------------------------------------
// Cobertura temporal de la financiación y salidas de caja del año 0
// (misión PLANEX-DOC-002-R2 §1–§2)
// ---------------------------------------------------------------------------

/** Partida de caja del año 0 identificada por el mecanismo de inventario.
 *  Cada salida no capitalizable se declara con su período, estado de pago y
 *  tratamiento dentro de la inversión: el inventario es TRAZABLE y no presume
 *  una enumeración universal (el barrido detecta partidas no inventariadas). */
export type TipoSalidaCajaAnio0 =
  | 'nomina_montaje' // gasto del período, no capitalizable
  | 'interes_pagado' // según calendario de deuda (solo caja)
  | 'interes_devengado_no_pagado' // capitalizado en gracia total: NO es caja
  | 'impuesto_devengado' // regla contable; pago supuesto, no verificado
  | 'ingreso_explicito' // reduce la necesidad de caja
  | 'gasto_no_monetario' // p. ej. depreciación: contable, sin salida de caja
  | 'gasto_no_inventariado'; // regla de gasto con valor en año 0 sin registro

export interface SalidaCajaAnio0 {
  /** Identificador estable de la partida (regla o serie de origen). */
  id: string;
  /** Etiqueta humana. */
  etiqueta: string;
  /** Monto del año 0 (kUSD; ingresos con signo negativo en la necesidad). */
  monto: number;
  tipo: TipoSalidaCajaAnio0;
  /** ¿Computa como salida neta de caja del arranque? */
  computa: boolean;
  /** Estado de pago declarado (p. ej. «pagado», «devengado — supuesto: pagado
   *  en el mismo período», «capitalizado: no es salida de caja»). */
  estadoPago: string;
  /** Tratamiento dentro de la inversión (por qué no se capitaliza ni duplica). */
  tratamiento: string;
  /** Fuente de trazabilidad (regla, parámetro o calendario de origen). */
  fuente: string;
}

/** Conciliación del arranque (DOC-002-R1 §2, revisada por R2 §1: la brecha
 *  del año 0 se mide contra las fuentes con desembolso EFECTIVO en el año 0,
 *  no contra el total nominal comprometido para todo el proyecto). */
export interface ConciliacionArranque {
  /** Nómina de montaje del año 0 (kUSD; regla costo_laboral_k, año 0). */
  nominaMontaje: number;
  /** Interés PAGADO en caja durante el año 0 (kUSD; excluye lo capitalizado). */
  interesPagado: number;
  /** Impuesto sobre utilidades DEVENGADO del año 0 (kUSD; ≥ 0). El modelo
   *  simplificado supone el pago en el mismo período: supuesto documentado,
   *  no un pago verificado. */
  impuestoPagado: number;
  /** Ingresos explícitos del año 0 (kUSD; reducen la necesidad de caja). */
  ingresosAnio0: number;
  /** Salidas netas de caja del año 0 explícitamente identificadas (kUSD). */
  gastoCajaAnio0: number;
  /** Financiación COMPROMETIDA para todo el proyecto (kUSD; conciliación
   *  total que se conserva — NO equivale a disponibilidad del año 0). */
  financiacionDisponible: number;
  /** Fuentes con desembolso efectivo en el AÑO 0 (kUSD): aportaciones con
   *  vencimiento en el año 0 + otras fuentes (supuesto: año 0) + desembolso
   *  del principal del crédito en el año 0 según el calendario. */
  fuentesAnio0: number;
  /** Inversión total (kUSD; incluye el capital de trabajo). */
  inversionTotal: number;
  /** Necesidad total de arranque = inversión total + gasto de caja del año 0. */
  necesidadTotal: number;
  /** Brecha TEMPORAL del año 0 (kUSD; negativa = faltante sin cobertura
   *  efectiva en el año 0, aunque el total nominal alcance). */
  brecha: number;
  /** Brecha según el total NOMINAL comprometido (conciliación total). */
  brechaNominal: number;
  /** Inventario trazable de partidas de caja del año 0 (computen o no). */
  partidas: SalidaCajaAnio0[];
  /** Reglas de gasto con valor en el año 0 NO cubiertas por el inventario. */
  noInventariadas: { id: string; etiqueta: string; monto: number }[];
}

/** Un período del calendario de cobertura temporal de la financiación. */
export interface CoberturaAnio {
  anio: number;
  /** Aportaciones con vencimiento en el año (kUSD; montos[t], t ≤ 2). */
  aportaciones: number;
  /** Otras fuentes del año (kUSD; supuesto documentado: año 0). */
  otrasFuentes: number;
  /** Desembolso del principal del crédito según el calendario (kUSD). */
  credito: number;
  /** Fuentes del período (kUSD). */
  fuentes: number;
  /** Fuentes acumuladas a cierre del período (kUSD). */
  fuentesAcumuladas: number;
  /** Inversión capitalizable del período (kUSD; año 0: inversión total;
   *  años posteriores: CAPEX de ampliaciones del escenario activo). */
  inversionCapitalizable: number;
  /** Salidas de caja no capitalizables del período (kUSD; año 0: inventario
   *  neto; años de operación: cubiertas por el flujo operativo, 0 aquí). */
  salidasNoCapitalizables: number;
  /** Necesidades del período (kUSD). */
  necesidades: number;
  /** Necesidades acumuladas a cierre del período (kUSD). */
  necesidadesAcumuladas: number;
  /** Cobertura acumulada de la financiación (Vista A): fuentes acumuladas −
   *  necesidades acumuladas (kUSD; sin flujos operativos). */
  saldoCobertura: number;
  /** Flujo operativo y de servicio de la deuda del período (kUSD): FCFE del
   *  año sin el desembolso del principal del crédito. */
  flujoOperativo: number;
  /** Dividendos pagados del período (kUSD; módulo de dividendos). */
  dividendos: number;
  /** Tesorería proyectada acumulada (Vista B): caja = Σ FCFE + Σ aportaciones
   *  + Σ otras fuentes − Σ dividendos (kUSD). */
  cajaProyectada: number;
}

/** Cobertura temporal de la financiación (R2 §1): separa las fuentes
 *  comprometidas para todo el proyecto de las efectivamente disponibles en
 *  cada período, proyecta el saldo de caja y detecta déficits temporales. */
export interface CoberturaFinanciacion {
  /** Calendario por año (0..N). */
  porAnio: CoberturaAnio[];
  /** Aportaciones comprometidas en el año 0 / año 1 / año 2 (kUSD). */
  aportacionesPorAnio: number[];
  /** Año efectivo de desembolso del principal del crédito (null si no hay). */
  anioDesembolsoCredito: number | null;
  /** ¿Las «otras fuentes» carecen de estructura de fechas? (supuesto: año 0). */
  otrasFuentesSinFecha: boolean;
  /** Déficits de tesorería proyectada (años con caja < 0): cada uno con el
   *  monto del faltante y el año en que la caja vuelve a ser no negativa. */
  deficitCaja: { anio: number; monto: number; cubiertoEn: number | null }[];
  /** Déficits de la vista de cobertura (fuentes vs necesidades, sin flujos
   *  operativos): detecta desembolsos tardíos aunque la operación los cure. */
  deficitCobertura: { anio: number; monto: number; cubiertoEn: number | null }[];
}

/** Clasificación de la regla de impuestos a efectos del escudo fiscal
 *  (R2 §3): el motor distingue si la regla puede reevaluarse en el escenario
 *  contrafactual y de qué depende, en lugar de asignar silenciosamente cero. */
export type ClaseEscudoFiscal =
  | 'sin_regla' // no existe regla de impuesto habilitada
  | 'sin_deuda' // sin intereses devengados: escudo 0 por definición
  | 'independiente_de_la_base' // no depende de la base afectada: escudo 0 legítimo
  | 'base_directa' // grava directamente la utilidad antes de intereses
  | 'base_indirecta'; // depende de bases intermedias que dependen de la UAI

export interface EscudoFiscalInfo {
  clase: ClaseEscudoFiscal;
  /** Explicación humana de la clasificación y sus consecuencias. */
  detalle: string;
  /** Años en los que la regla debía poder reevaluarse y falló: el escudo se
   *  tomó como 0 y los flujos quedan marcados como NO confiables. */
  noCalculableAnios: number[];
  /** ¿El escudo calculado es confiable para valorar los flujos? */
  confiable: boolean;
}

export interface Indicadores {
  /** Recuperación de la INVERSIÓN TOTAL del proyecto (flujo FCFF). */
  recuperacionProyecto: Recuperacion;
  /** Recuperación del CAPITAL APORTADO por los socios (flujo FCFE). */
  recuperacionSocios: Recuperacion;
  inversionTotalKUSD: number;
  aportacionesTotalesKUSD: number;
  ingresosTotales: Record<number, number>;
  utilidadNeta: Record<number, number>;
  utilidadNetaAcumulada: number;
  beneficiosPais: Record<number, number>;
  /** Total de beneficios al país incluyendo el año 0 (conciliado con la tabla). */
  beneficiosPaisAcumulados: number;
  /** Subtotal de beneficios al país de la explotación (años 1..N), etiquetado. */
  beneficiosPaisExplotacion: number;
  impuestosTotales: number;
  totalTrabajadores: number;
  trabajadoresMontaje: number;
  trabajadoresPorGrupo: Record<string, number>;
  cubanos: number;
  extranjeros: number;
  salarioPromedioAnualCUP: number | null;
  margenContribucionAnio1: number | null;
  /** FCFF por año (kUSD). */
  fcff: Record<number, number>;
  fcffAcumulado: Record<number, number>;
  /** FCFE por año (kUSD). */
  fcfe: Record<number, number>;
  fcfeAcumulado: Record<number, number>;
  /** Escudo fiscal del interés devengado por año (kUSD): reducción del impuesto
   *  atribuible al gasto por intereses, derivada de la regla de impuestos
   *  activa. El FCFF reincorpora el interés DESPUÉS de impuestos. */
  escudoFiscal: Record<number, number>;
  /** Clasificación y fiabilidad del escudo fiscal (R2 §3). */
  escudoFiscalInfo: EscudoFiscalInfo;
  /** CAPEX de ampliaciones por año (kUSD). */
  capexAmpliaciones: Record<number, number>;
}

export interface ComputedModel {
  years: number[];
  ok: boolean;
  /** reglaId -> año -> valor (ámbito proyecto: solo año 0). */
  valores: Record<string, Record<number, number>>;
  estados: Record<string, EstadoRegla>;
  servicios: ServicioCalculado[];
  issues: Issue[];
  indicadores: Indicadores;
  /** Motor estructural (misión §4–§8). */
  depreciacion: ActivoDepreciable[];
  depreciacionTotal: Record<number, number>;
  deuda: FilaDeuda[];
  dividendos: DividendosAnio[];
  capacidadServicios: Record<string, Record<number, CapacidadServicio>>;
  recursosCalculados: RecursoCalculado[];
  /** Conciliación del arranque (brecha TEMPORAL del año 0 + inventario de
   *  partidas de caja del año 0) — DOC-002-R1 §2, revisada por R2 §1–§2. */
  arranque: ConciliacionArranque;
  /** Cobertura temporal de la financiación y tesorería proyectada (R2 §1). */
  cobertura: CoberturaFinanciacion;
}

export const ADVERTENCIA_DATOS_FICTICIOS =
  'EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS. No constituye una propuesta aprobada ni acredita el cumplimiento de requisitos legales, tributarios, sanitarios o de inversión. Validar las cifras, supuestos, autorizaciones y requisitos aplicables antes de su presentación oficial.';

export const DECLARACION_RESPONSABILIDAD =
  'Declaro que los datos e informaciones contenidas en el presente Plan de Negocios son veraces y confiables, y asumo la responsabilidad correspondiente según la normativa vigente.';

// ---------------------------------------------------------------------------
// Estructura de presentación (estado de resultados, beneficios, financiación)
// ---------------------------------------------------------------------------

export type RefLinea =
  | { tipo: 'regla'; id: string }
  | { tipo: 'param'; id: string }
  | { tipo: 'entrada'; id: 'otros_ingresos' };

export interface LineaEstado {
  id: string;
  etiqueta: string;
  ref: RefLinea;
  negrita?: boolean;
}

export interface GrupoEstado {
  titulo: string;
  lineas: LineaEstado[];
}

/** Estado de resultados (4.7) — las cifras provienen siempre del motor.
 *  Los costos fijos de explotación (canon, públicos, otros) se activan solo
 *  en años de operación mediante reglas envolventes IF(PERIODO >= 1, …). */
export const ESTADO_RESULTADOS: GrupoEstado[] = [
  {
    titulo: 'Ingresos',
    lineas: [
      { id: 'ing_srv', etiqueta: 'Ingresos por servicios', ref: { tipo: 'regla', id: 'ingresos_servicios_k' } },
      { id: 'ing_otros', etiqueta: 'Otros ingresos', ref: { tipo: 'entrada', id: 'otros_ingresos' } },
      { id: 'ing_tot', etiqueta: 'INGRESOS TOTALES', ref: { tipo: 'regla', id: 'ingresos_totales_k' }, negrita: true },
    ],
  },
  {
    titulo: 'Costos y gastos',
    lineas: [
      { id: 'c_var', etiqueta: 'Costos variables (materiales y consumibles)', ref: { tipo: 'regla', id: 'costos_variables_k' } },
      { id: 'c_lab', etiqueta: 'Costo de la fuerza de trabajo', ref: { tipo: 'regla', id: 'costo_laboral_k' } },
      { id: 'c_canon', etiqueta: 'Canon (arrendamiento)', ref: { tipo: 'regla', id: 'canon_k' } },
      { id: 'c_mant', etiqueta: 'Mantenimiento', ref: { tipo: 'regla', id: 'mantenimiento_k' } },
      { id: 'c_pub', etiqueta: 'Servicios públicos (agua, electricidad, portadores)', ref: { tipo: 'regla', id: 'servicios_publicos_k' } },
      { id: 'c_adm', etiqueta: 'Gastos administrativos', ref: { tipo: 'regla', id: 'gastos_admin_k' } },
      { id: 'c_otros', etiqueta: 'Otros gastos fijos', ref: { tipo: 'regla', id: 'otros_gastos_k' } },
      { id: 'c_dep', etiqueta: 'Depreciación', ref: { tipo: 'regla', id: 'depreciacion_anual_k' } },
      { id: 'c_int', etiqueta: 'Intereses del crédito', ref: { tipo: 'regla', id: 'interes_k' } },
      { id: 'c_tot', etiqueta: 'COSTOS Y GASTOS TOTALES', ref: { tipo: 'regla', id: 'costos_totales_k' }, negrita: true },
    ],
  },
  {
    titulo: 'Resultados',
    lineas: [
      { id: 'uai', etiqueta: 'UTILIDAD ANTES DE IMPUESTOS (1-2)', ref: { tipo: 'regla', id: 'utilidad_antes_impuestos_k' }, negrita: true },
      { id: 'imp', etiqueta: 'Impuesto sobre utilidades', ref: { tipo: 'regla', id: 'impuesto_utilidades_k' } },
      { id: 'net', etiqueta: 'UTILIDAD DESPUÉS DE IMPUESTOS (3-4)', ref: { tipo: 'regla', id: 'utilidad_despues_impuestos_k' }, negrita: true },
    ],
  },
];

export interface LineaBeneficioPais {
  id: string;
  etiqueta: string;
  ref: RefLinea;
  negrita?: boolean;
  /** ¿La partida incluye el año 0 (montaje)? (misión §9) */
  incluyeAnioCero: boolean;
  /** Criterio de agregación documentado. */
  reglaAgregacion: string;
}

/** Beneficios directos al país (4.11) — con metadatos por partida (misión §9). */
export const BENEFICIOS_PAIS: LineaBeneficioPais[] = [
  { id: 'b_imp', etiqueta: 'Impuesto sobre utilidades', ref: { tipo: 'regla', id: 'impuesto_utilidades_k' }, incluyeAnioCero: false, reglaAgregacion: 'Suma anual de la regla activa del impuesto (años 1..N).' },
  { id: 'b_otrosimp', etiqueta: 'Otros impuestos, tasas y contribuciones', ref: { tipo: 'regla', id: 'otros_impuestos_k' }, incluyeAnioCero: false, reglaAgregacion: 'Suma anual del parámetro en años de operación (1..N).' },
  { id: 'b_div', etiqueta: 'Dividendos de la parte cubana', ref: { tipo: 'regla', id: 'dividendos_parte_cubana_k' }, incluyeAnioCero: false, reglaAgregacion: 'Módulo de dividendos: pagables × participación cubana (años 1..N).' },
  { id: 'b_aranc', etiqueta: 'Aranceles', ref: { tipo: 'regla', id: 'aranceles_k' }, incluyeAnioCero: false, reglaAgregacion: 'Suma anual del parámetro en años de operación (1..N).' },
  { id: 'b_ft', etiqueta: 'Pagos por la fuerza de trabajo', ref: { tipo: 'regla', id: 'pagos_fuerza_trabajo_k' }, incluyeAnioCero: true, reglaAgregacion: 'Costo laboral del año; incluye el personal de montaje del año 0 (pago real a trabajadores cubanos).' },
  { id: 'b_canon', etiqueta: 'Canon', ref: { tipo: 'regla', id: 'canon_k' }, incluyeAnioCero: false, reglaAgregacion: 'Suma anual del parámetro en años de operación (1..N).' },
  { id: 'b_roy', etiqueta: 'Royalties', ref: { tipo: 'regla', id: 'royalties_k' }, incluyeAnioCero: false, reglaAgregacion: 'Suma anual del parámetro en años de operación (1..N).' },
  { id: 'b_otros', etiqueta: 'Otros ingresos', ref: { tipo: 'regla', id: 'otros_beneficios_pais_k' }, incluyeAnioCero: false, reglaAgregacion: 'Suma anual del parámetro en años de operación (1..N).' },
  { id: 'b_tot', etiqueta: 'TOTAL BENEFICIOS DIRECTOS AL PAÍS', ref: { tipo: 'regla', id: 'total_beneficios_pais_k' }, negrita: true, incluyeAnioCero: true, reglaAgregacion: 'Suma de las partidas anteriores con el período indicado en cada una; un único acumulado conciliado entre resumen, tabla y conclusiones.' },
];

/** Etiquetas de apoyo. */
export const ETIQUETAS_APORTACION: Record<TipoAportacion, string> = {
  efectivo: 'Efectivo',
  activos_circulantes: 'Activos circulantes',
  activos_fijos_tangibles: 'Activos fijos tangibles',
  derechos_reales: 'Derechos reales',
  intangibles: 'Otros activos intangibles',
  otros: 'Otros',
};

export const ETIQUETAS_GRUPO: Record<GrupoPersonal, string> = {
  cubano_directivo: 'Cubanos — directivos',
  cubano_otro: 'Cubanos — otros trabajadores',
  extranjero_directivo: 'Extranjeros — directivos',
  extranjero_otro: 'Extranjeros — otros trabajadores',
};

export const ETIQUETAS_CATEGORIA_INV: Record<CategoriaInversion, string> = {
  gastos_previos: 'Gastos previos',
  inversion_fija: 'Inversión fija',
  inducida: 'Inversiones inducidas',
};

export const ETIQUETAS_RECURSO: Record<RecursoRow['tipo'], string> = {
  gabinete: 'Gabinete',
  sillon: 'Sillón / posición de atención',
  equipo: 'Equipo',
  profesional: 'Profesional',
  local: 'Local / área',
  otro: 'Otro',
};

export const ETIQUETAS_METODO_AMORT: Record<MetodoAmortizacion, string> = {
  capital_constante: 'Capital constante (cuotas de principal iguales)',
  sistema_frances: 'Sistema francés (cuota total constante)',
  pago_unico: 'Pago único al vencimiento (bullet)',
};

export const ETIQUETAS_TIPO_GRACIA: Record<TipoGracia, string> = {
  principal: 'Gracia de principal (se pagan intereses)',
  total: 'Gracia total (intereses capitalizados)',
};
