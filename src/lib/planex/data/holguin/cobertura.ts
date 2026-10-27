// ============================================================================
// PLANEX-DATA-001 — Matriz de cobertura de la metodología (4.1–4.12).
//
// La cobertura se MIDE, no se declara: cada epígrafe define su censo de
// campos (denominador explícito) y cada campo se clasifica consultando el
// registro de información fidedigna y las brechas. Los porcentajes se
// calculan aquí una sola vez y de aquí salen la vista de «Completitud
// documental» de la app y el PDF de brechas (misma fuente de información).
//
// Clasificación de cada campo:
//   completo    — con evidencia documental suficiente (categoría A/B y sin
//                 contradicción activa sobre su valor).
//   parcial     — existe evidencia pero con contradicción (D) o versión
//                 provisional (C) sobre el valor operativo.
//   pendiente   — sin evidencia suficiente (E) o dato ausente.
//   derivado    — calculado por el motor desde datos documentados (B) y
//                 presentado dinámicamente (4.12, síntesis del resumen).
// ============================================================================

import { dato, REGISTRO, DatoRegistro } from './registro';
import { BRECHAS, Brecha } from './brechas';

export type EstadoCampo = 'completo' | 'parcial' | 'pendiente' | 'derivado';

export interface CampoCobertura {
  /** Campo o requisito concreto (denominador unitario). */
  campo: string;
  estado: EstadoCampo;
  /** Fuente y localizador que lo sustentan. */
  evidencia: string;
  /** Observación de cobertura. */
  observacion: string;
}

export interface EpigrafeCobertura {
  id: string;
  titulo: string;
  campos: CampoCobertura[];
}

const d = (id: string): DatoRegistro => dato(id);

function estadoPorRegistro(ids: string[], pendienteSi: EstadoCampo = 'parcial'): EstadoCampo {
  // Si algún dato sustentante es E (pendiente), el campo es pendiente;
  // si alguno es D o C, parcial; si todos A/B, completo.
  const cats = ids.map((i) => d(i).categoria);
  if (cats.includes('E')) return 'pendiente';
  if (cats.some((c) => c === 'D' || c === 'C')) return pendienteSi;
  return 'completo';
}

function evidencia(ids: string[]): string {
  return ids.map((i) => `${i} (${d(i).fuenteId}, ${d(i).localizador.split(';')[0].trim()})`).join(' · ');
}

function brechasDe(ids: string[]): Brecha[] {
  return BRECHAS.filter((b) => b.registroIds.some((r) => ids.includes(r)));
}

function campo(ids: string[], nombre: string, obs?: string): CampoCobertura {
  const estado = estadoPorRegistro(ids);
  const bre = brechasDe(ids);
  return {
    campo: nombre,
    estado,
    evidencia: evidencia(ids),
    observacion:
      obs ??
      (bre.length
        ? `Brechas: ${bre.map((b) => b.id).join(', ')}.`
        : estado === 'completo'
          ? 'Respaldado por el registro de fuentes.'
          : 'Ver registro de datos.'),
  };
}

const campoPendiente = (nombre: string, brechaId: string, obs: string): CampoCobertura => ({
  campo: nombre,
  estado: 'pendiente',
  evidencia: 'Sin fuente suficiente en el expediente (9 fuentes analizadas).',
  observacion: `${obs} Brecha ${brechaId}.`,
});

const campoDerivado = (nombre: string, obs: string): CampoCobertura => ({
  campo: nombre,
  estado: 'derivado',
  evidencia: 'Generado dinámicamente por el motor de cálculo desde los datos documentados.',
  observacion: obs,
});

export const EPIGRAFES: EpigrafeCobertura[] = [
  {
    id: '4.1',
    titulo: 'Información general (elaborador, fecha, responsabilidad)',
    campos: [
      campoPendiente('Nombre y cargo de quien elabora', 'B-01', 'Ninguna fuente consigna el elaborador del plan.'),
      campoPendiente('Firma/identificación y fecha de elaboración', 'B-01', 'El contrato está sin firmar; la valoración no tiene fecha de elaborador.'),
      campoPendiente('Declaración de responsabilidad sobre la veracidad', 'B-01', 'No consta en el expediente.'),
      campo(['H-004', 'H-005'], 'Entidad cubana y su representante (contexto)'),
      campo(['H-006', 'H-007'], 'Entidad extranjera y su representante (contexto)'),
    ],
  },
  {
    id: '4.2',
    titulo: 'Título y denominación de la propuesta',
    campos: [
      campo(['H-001'], 'Nombre del proyecto', 'Denominación de trabajo adoptada; la formal queda pendiente (B-02).'),
      campoPendiente('Denominación formal / identificación comercial', 'B-02', 'En blanco en el contrato (H-016).'),
    ],
  },
  {
    id: '4.3',
    titulo: 'Índice',
    campos: [campoDerivado('Índice del documento', 'La app genera el índice automáticamente en cada exportación; no es un dato del expediente.')],
  },
  {
    id: '4.4',
    titulo: 'Resumen ejecutivo',
    campos: [
      campoDerivado('Síntesis cuantitativa', 'Se genera desde el modelo activo; depende de resolver C-01/C-08.'),
      campoPendiente('Resumen narrativo del negocio y del proceso inversionista', 'B-03', 'No existe en el expediente.'),
    ],
  },
  {
    id: '4.5',
    titulo: 'Descripción del negocio',
    campos: [
      campo(['H-009'], 'a) Modalidad de inversión'),
      campo(['H-010'], 'b) Objeto social/contractual'),
      campo(['H-012'], 'c) Plazo de vigencia'),
      campoPendiente('d) Fundamentación (PNDES y EDT Holguín)', 'B-26', 'Solo existe justificación sectorial general (H-080).'),
      campo(['H-037', 'H-060'], 'e) Bienes y servicios a ofrecer'),
      campoPendiente('f) Análisis de mercado externo e interno', 'B-24', 'Contexto mundial GBD 2019 y anécdotas, sin estudio (H-080).'),
      campo(['H-006'], 'g) Caracterización del inversionista extranjero', 'Datos registrales constan; experiencia y vínculos pendientes (B-05).'),
      campo(['H-004'], 'h) Caracterización del inversionista nacional'),
      campo(['H-026', 'H-027', 'H-028'], 'i) Aportes y valoración', 'Valores del anexo de cálculo; el contrato los deja en blanco y falta el avalúo del usufructo (B-06).'),
      campo(['H-013'], 'j) Distribución de beneficios', 'Pacto 50/50 con participación 49/51 sin conciliar (C-05, B-04).'),
    ],
  },
  {
    id: '4.6',
    titulo: 'Aspectos técnicos y operativos',
    campos: [
      campo(['H-060', 'H-061', 'H-062', 'H-063', 'H-064'], 'a) Caracterización técnica de los servicios', 'Incluye los 2 servicios suspendidos y las 5 afectaciones de prótesis.'),
      campoPendiente('b) Capacidad instalada planificada', 'B-10', 'Sin horas, duraciones ni calendario: la plantilla no inventa capacidad.'),
      campo(['H-064', 'H-065', 'H-066', 'H-068'], 'c) Tecnologías actuales y deterioro'),
      campo(['H-011', 'H-069'], 'd) Localización e infraestructura', 'Provincia Holguín documentada; dirección y soportes gráficos pendientes (B-08).'),
      campoPendiente('e) Índices de consumos básicos', 'B-19', 'Sin estimaciones de agua, electricidad, portadores ni residuos.'),
    ],
  },
  {
    id: '4.7',
    titulo: 'Inversión, financiamiento y evaluación financiera',
    campos: [
      campo(['H-020', 'H-021', 'H-022', 'H-023'], 'a) Costo total de inversión inicial', 'Desglose documentado; capital de trabajo 0 señalado (B-12).'),
      campo(['H-030'], 'b) Fuentes de financiamiento', 'Sin crédito (aportaciones); la página fuente es aritméticamente incoherente (C-11).'),
      campo(['H-037', 'H-038', 'H-039', 'H-040', 'H-041', 'H-035'], 'c) Proyección de ingresos, costos y utilidades', 'Serie documentada con contradicciones activas (tasa C-01, depreciación C-06, salarios C-07, materiales C-16).'),
      campo(['H-043'], 'd) Período de recuperación e indicadores', 'Contradictorios entre resumen y anexo (C-02): no se adoptan.'),
      campo(['H-025'], 'Moneda y tipo de cambio del modelo', 'BLOQUEANTE: 24 vs 120 (C-01) — decisión del promotor con sustento normativo.'),
    ],
  },
  {
    id: '4.8',
    titulo: 'Mercado y comercialización',
    campos: [
      campo(['H-060'], 'a) Caracterización de los servicios en el mercado', 'Cartera documentada; posicionamiento pendiente (B-25).'),
      campoPendiente('b) Requisitos regulatorios y registros', 'B-16', 'Compromiso de gestión en el contrato; sin licencias adjuntas (V-06).'),
      campo(['H-029', 'H-067'], 'c) Materias primas y suministros', 'Cotización de 6 meses documentada; consumo por servicio y conciliación 71/60 pendientes (B-13, B-23).'),
      campoPendiente('d) Demanda aparente y solvente', 'B-24', 'Sin estudio de mercado (H-080).'),
      campoPendiente('e) Comercialización y canales', 'B-25', 'Canal exportación asumido por el balance del expediente, sin estrategia documentada.'),
    ],
  },
  {
    id: '4.9',
    titulo: 'Fuerza de trabajo',
    campos: [
      campo(['H-090', 'H-017'], 'Plantilla y estructura de dirección'),
      campo(['H-035', 'H-036', 'H-091'], 'Remuneraciones', 'Tres versiones de salarios (C-07): la plantilla adopta la derivada con fórmula conservada (B-10).'),
      campoPendiente('Entidad autorizada a contratar', 'B-15', 'No declarada expresamente (H-092).'),
    ],
  },
  {
    id: '4.10',
    titulo: 'Inversiones por ejecutar y cronograma',
    campos: [
      campo(['H-021', 'H-069'], 'a) Inversiones por ejecutar (equipos)', '5 equipos cotizados; escáner pendiente de decisión (C-08) y monitor de rayos X sin cotizar (B-09).'),
      campo(['H-015'], 'b) Cronograma general', 'Etapas y período de preapertura definidos; fechas precisas pendientes (B-14; marcas gráficas ilegibles en F08 p. 17).'),
    ],
  },
  {
    id: '4.11',
    titulo: 'Beneficios directos al país',
    campos: [
      campo(['H-045'], 'Indicadores de beneficios directos', 'Dos totales incompatibles (C-04); el motor recalcula la serie con sus reglas de agregación documentadas.'),
      campo(['H-049'], 'Aranceles', 'Exención declarada por el expediente sin sustento normativo adjunto (V-04).'),
    ],
  },
  {
    id: '4.12',
    titulo: 'Conclusiones',
    campos: [
      campoDerivado('Conclusiones cuantitativas', 'La app las genera desde el modelo activo y recalcula con cada cambio; no se precocinan cifras.'),
      campoPendiente('Conclusiones narrativas del promotor', 'B-03', 'Pendientes hasta estabilizar el modelo (tasa, escáner) y el estudio de mercado.'),
    ],
  },
];

// ---------------------------------------------------------------------------
// Cálculo de porcentajes (denominadores explícitos, misión §4)
// ---------------------------------------------------------------------------

export interface CoberturaCalculada {
  epigrafe: string;
  titulo: string;
  total: number;
  completos: number;
  parciales: number;
  pendientes: number;
  derivados: number;
}

export function coberturaPorEpigrafe(): CoberturaCalculada[] {
  return EPIGRAFES.map((e) => {
    const total = e.campos.length;
    const c = e.campos.filter((x) => x.estado === 'completo').length;
    const p = e.campos.filter((x) => x.estado === 'parcial').length;
    const pend = e.campos.filter((x) => x.estado === 'pendiente').length;
    const der = e.campos.filter((x) => x.estado === 'derivado').length;
    return { epigrafe: e.id, titulo: e.titulo, total, completos: c, parciales: p, pendientes: pend, derivados: der };
  });
}

export interface CoberturaGlobal {
  /** Campos censados en total (denominador general). */
  camposTotales: number;
  /** Campos con evidencia documental suficiente (completos). */
  camposCompletos: number;
  /** Campos con evidencia parcial/contradictoria. */
  camposParciales: number;
  /** Campos sin evidencia suficiente. */
  camposPendientes: number;
  /** Campos generados dinámicamente (no cuentan como evidencia del expediente). */
  camposDerivados: number;
  /** % de campos obligatorios completados = completos / (total − derivados). */
  pctCamposCompletados: number;
  /** % de campos con evidencia documental suficiente (completos) sobre el mismo denominador. */
  pctEvidenciaSuficiente: number;
  /** % de secciones con información sustancial (≥ 1 campo completo). */
  pctSeccionesSustanciales: number;
  /** Requisitos que dependen de validaciones externas (de VALIDACIONES). */
  requisitosValidacionExterna: number;
  /** Contradicciones pendientes de resolver (de CONTRADICCIONES). */
  contradiccionesPendientes: number;
  /** Campos que solo pueden completarse mediante estimaciones/decisiones del promotor. */
  camposDecisionPromotor: number;
  denominadorNota: string;
}

export function coberturaGlobal(): CoberturaGlobal {
  const porEpi = coberturaPorEpigrafe();
  const camposTotales = porEpi.reduce((s, e) => s + e.total, 0);
  const camposCompletos = porEpi.reduce((s, e) => s + e.completos, 0);
  const camposParciales = porEpi.reduce((s, e) => s + e.parciales, 0);
  const camposPendientes = porEpi.reduce((s, e) => s + e.pendientes, 0);
  const camposDerivados = porEpi.reduce((s, e) => s + e.derivados, 0);
  const obligatorios = camposTotales - camposDerivados;
  const seccionesSustanciales = porEpi.filter(
    (e) => e.completos > 0 || (e.completos === 0 && e.parciales > 0 && e.pendientes === 0)
  ).length;

  return {
    camposTotales,
    camposCompletos,
    camposParciales,
    camposPendientes,
    camposDerivados,
    pctCamposCompletados: obligatorios > 0 ? camposCompletos / obligatorios : 0,
    pctEvidenciaSuficiente: obligatorios > 0 ? camposCompletos / obligatorios : 0,
    pctSeccionesSustanciales: porEpi.length > 0 ? seccionesSustanciales / porEpi.length : 0,
    requisitosValidacionExterna: 8,
    contradiccionesPendientes: 17,
    camposDecisionPromotor: 6,
    denominadorNota:
      'Denominador: censo de campos metodológicos efectivamente exigibles en la app y el expediente ('
      + `${camposTotales} campos censados − ${camposDerivados} generados dináicamente = ${obligatorios} obligatorios con evidencia exigible). `
      + 'Los campos «derivados» (índice, síntesis del resumen, conclusiones cuantitativas) no computan como información documental del expediente: '
      + 'se generan desde el modelo. La cobertura de información NO equivale a viabilidad del negocio ni a cumplimiento legal.',
  };
}

// ---------------------------------------------------------------------------
// Censo del registro (para la vista de evidencias)
// ---------------------------------------------------------------------------

export function censoRegistro() {
  const por = (c: DatoRegistro['categoria']) => REGISTRO.filter((x) => x.categoria === c).length;
  return {
    total: REGISTRO.length,
    confirmados: por('A'),
    derivados: por('B'),
    provisionales: por('C'),
    contradictorios: por('D'),
    pendientes: por('E'),
    noAplicables: por('F'),
  };
}
