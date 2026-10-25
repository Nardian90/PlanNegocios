// ============================================================================
// PLANEX Cuba — Modelo de datos (fuente única de verdad)
// Plan de Negocios para propuestas de inversión extranjera (GOC-2026-O57)
// ============================================================================

/** Ámbito de evaluación de una regla. */
export type AmbitoRegla = 'servicio' | 'personal' | 'proyecto' | 'anio';

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
  /** Cantidad mensual prevista (año 1). */
  cantidadBaseMensual: number;
  /** Capacidad máxima mensual instalada. */
  capacidadMaxMensual: number;
  /** Costo variable unitario (USD). */
  costoVariableUnitario: number;
  fuente: string;
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

export interface InversionRow {
  id: string;
  concepto: string;
  categoria: CategoriaInversion;
  moneda: Moneda;
  /** Monto en la moneda de la fila (miles, un decimal). */
  monto: number;
  /** Vida útil en años para depreciación (solo inversión fija). */
  vidaUtilAnios: number;
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
}

export interface MercadoInfo {
  caracterizacion: string;
  requisitosRegulatorios: string;
  materiasPrimas: string;
  fuentesSuministro: string;
  consumoEstimado: string;
  demandaAparente: string;
  demandaSolvente: string;
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

export const SCHEMA_VERSION = '1.0.0';

export interface PlanexMeta {
  schemaVersion: string;
  app: string;
  generado: string;
  plantillaOrigen: 'clinica' | 'default' | 'nuevo';
}

export interface Ajustes {
  horizonteAnios: number;
}

export interface FinancieroInfo {
  inversion: InversionRow[];
  vehiculos: VehiculoRow[];
  /** Otros ingresos por año (kUSD, índice 0 = año 1). */
  otrosIngresos: number[];
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
  servicios: ServicioRow[];
  financiero: FinancieroInfo;
  mercado: MercadoInfo;
  fuerza: FuerzaInfo;
  personal: PersonalRow[];
  cronograma: CronogramaRow[];
  conclusiones: ConclusionesInfo;
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
  cantidades: Record<number, number>;
  capacidadesExcedidas: number[];
}

export interface Indicadores {
  recuperacionAnios: number | null;
  inversionTotalKUSD: number;
  ingresosTotales: Record<number, number>;
  utilidadNeta: Record<number, number>;
  utilidadNetaAcumulada: number;
  beneficiosPais: Record<number, number>;
  beneficiosPaisAcumulados: number;
  impuestosTotales: number;
  totalTrabajadores: number;
  trabajadoresMontaje: number;
  trabajadoresPorGrupo: Record<string, number>;
  cubanos: number;
  extranjeros: number;
  salarioPromedioAnualCUP: number | null;
  margenContribucionAnio1: number | null;
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

/** Estado de resultados (4.7) — las cifras provienen siempre del motor. */
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
      { id: 'c_canon', etiqueta: 'Canon (arrendamiento)', ref: { tipo: 'param', id: 'canon_anual_k' } },
      { id: 'c_mant', etiqueta: 'Mantenimiento', ref: { tipo: 'regla', id: 'mantenimiento_k' } },
      { id: 'c_pub', etiqueta: 'Servicios públicos (agua, electricidad, portadores)', ref: { tipo: 'param', id: 'servicios_publicos_anual_k' } },
      { id: 'c_adm', etiqueta: 'Gastos administrativos', ref: { tipo: 'regla', id: 'gastos_admin_k' } },
      { id: 'c_otros', etiqueta: 'Otros gastos fijos', ref: { tipo: 'param', id: 'otros_gastos_fijos_k' } },
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

/** Beneficios directos al país (4.11). */
export const BENEFICIOS_PAIS: LineaEstado[] = [
  { id: 'b_imp', etiqueta: 'Impuesto sobre utilidades', ref: { tipo: 'regla', id: 'impuesto_utilidades_k' } },
  { id: 'b_otrosimp', etiqueta: 'Otros impuestos, tasas y contribuciones', ref: { tipo: 'param', id: 'otros_impuestos_anual_k' } },
  { id: 'b_div', etiqueta: 'Dividendos de la parte cubana', ref: { tipo: 'regla', id: 'dividendos_parte_cubana_k' } },
  { id: 'b_aranc', etiqueta: 'Aranceles', ref: { tipo: 'param', id: 'aranceles_anual_k' } },
  { id: 'b_ft', etiqueta: 'Pagos por la fuerza de trabajo', ref: { tipo: 'regla', id: 'pagos_fuerza_trabajo_k' } },
  { id: 'b_canon', etiqueta: 'Canon', ref: { tipo: 'param', id: 'canon_anual_k' } },
  { id: 'b_roy', etiqueta: 'Royalties', ref: { tipo: 'param', id: 'royalties_anual_k' } },
  { id: 'b_otros', etiqueta: 'Otros ingresos', ref: { tipo: 'param', id: 'otros_beneficios_pais_k' } },
  { id: 'b_tot', etiqueta: 'TOTAL BENEFICIOS DIRECTOS AL PAÍS', ref: { tipo: 'regla', id: 'total_beneficios_pais_k' }, negrita: true },
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
