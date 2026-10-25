// ============================================================================
// Parámetros (Nivel A) y reglas (Nivel B) preconfigurados de fábrica.
// Todas las plantillas comparten este conjunto; los valores por defecto de los
// parámetros se ajustan por plantilla. Nada es una constante rígida: todo es
// editable desde la interfaz y se guarda por proyecto.
//
// Convenciones del esquema 2.0.0 (misión PLANEX-AUDIT-001):
//  - Prefijo «mtr_» RESERVADO: variables calculadas por el motor estructural
//    (depreciación por activo, calendario de deuda, capacidad, FCFF/FCFE,
//    dividendos). Las reglas las referencian; su origen es trazable.
//  - Los costos fijos de EXPLOTACIÓN (canon, servicios públicos, otros gastos
//    fijos, otros impuestos, aranceles, royalties, otros ingresos al país)
//    activan solo en años de operación (t ≥ 1) mediante reglas envolventes.
//  - El año 0 (montaje) solo admite costos reales de esa fase (p. ej. la
//    fuerza de trabajo de montaje); los costos de puesta en marcha no
//    recurrentes deben presupuestarse en «gastos previos» (4.10).
// ============================================================================

import { Parametro, Regla } from '../types';

const FUENTE_DEMO =
  'Supuesto de demostración editable. No constituye la tasa legal aplicable al negocio real: documente la fuente normativa y las condiciones antes de un uso oficial.';

export function parametrosPorDefecto(opciones: { creditoKUSD: number; capitalTrabajoKUSD: number }): Parametro[] {
  return [
    {
      id: 'tasa_impuesto_utilidades',
      nombre: 'Tasa del impuesto sobre utilidades (demostrativa)',
      descripcion:
        'Tasa aplicada a la utilidad antes de impuestos en la regla de demostración. Valor inicial 35 %, editable. No implica que sea la tasa legal vigente ni sustituye las reglas tributarias del negocio real.',
      valor: 0.35,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: FUENTE_DEMO,
      fechaRef: '',
      editable: true,
      demo: true,
    },
    {
      id: 'tipo_cambio',
      nombre: 'Tipo de cambio (CUP por USD)',
      descripcion:
        'Conversión CUP → USD aplicada a los salarios y a las inversiones expresadas en CUP. Finalidad: expresar en miles de USD las partidas en CUP del estado de resultados, la inversión y los beneficios al país. Valor por defecto: 743 CUP/USD, tasa ilustrativa PENDIENTE DE VALIDACIÓN OFICIAL: antes de un uso oficial debe sustituirse por la tasa vigente y documentarse la fecha de referencia y la fuente oficial.',
      valor: 743,
      unidad: 'CUP/USD',
      tipo: 'numero',
      fuente: 'Supuesto de demostración editable (743 CUP/USD, tasa ilustrativa pendiente de validación oficial).',
      fechaRef: '2026-10-26',
      editable: true,
      demo: true,
    },
    {
      id: 'tasa_interes',
      nombre: 'Tasa de interés anual del crédito',
      descripcion: 'Interés nominal anual del crédito previsto.',
      valor: 0.08,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: 'Supuesto editable según condiciones reales del financiamiento.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'plazo_amortizacion',
      nombre: 'Plazo de amortización del crédito',
      descripcion: 'Número de anualidades de amortización del principal tras el período de gracia.',
      valor: 5,
      unidad: 'años',
      tipo: 'anios',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'periodo_gracia',
      nombre: 'Período de gracia del crédito',
      descripcion: 'Años de gracia. La naturaleza (solo principal o total, con capitalización de intereses) se configura en 4.7 → calendario de deuda.',
      valor: 1,
      unidad: 'años',
      tipo: 'anios',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'inflacion',
      nombre: 'Inflación prevista (costos)',
      descripcion: 'Crecimiento anual aplicado a los costos variables unitarios de los servicios.',
      valor: 0.04,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'crecimiento_precios',
      nombre: 'Crecimiento anual de precios',
      descripcion: 'Variación anual prevista de los precios unitarios de los servicios.',
      valor: 0.03,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'crecimiento_volumen',
      nombre: 'Variación anual del volumen (demanda)',
      descripcion: 'Crecimiento anual previsto de la DEMANDA de servicios. La producción real queda limitada por la capacidad instalada del escenario activo.',
      valor: 0.05,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'crecimiento_salarios',
      nombre: 'Crecimiento anual de salarios',
      descripcion: 'Crecimiento anual previsto del salario promedio en CUP.',
      valor: 0.05,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'pct_gastos_admin',
      nombre: 'Gastos administrativos (% de los ingresos)',
      descripcion: 'Porcentaje de los ingresos totales destinado a gastos administrativos.',
      valor: 0.05,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'pct_mantenimiento',
      nombre: 'Mantenimiento (% de la inversión fija)',
      descripcion: 'Porcentaje de la inversión fija destinado anualmente a mantenimiento (años de operación).',
      valor: 0.03,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'factor_costo_laboral',
      nombre: 'Factor de costo laboral',
      descripcion: 'Multiplicador sobre los salarios para reflejar contribuciones y cargas del empleador (1.0 = solo salarios).',
      valor: 1.0,
      unidad: '×',
      tipo: 'numero',
      fuente: 'Supuesto editable. Validar el tratamiento aplicable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'pct_parte_cubana',
      nombre: 'Participación de la parte cubana en el capital',
      descripcion: 'Porcentaje del capital social aportado por el socio nacional. PARTICIPACIÓN (composición del capital) ≠ porcentaje de reparto. Verifique la coherencia con la tabla de aportaciones (el diagnóstico la comprueba).',
      valor: 0.4,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: 'Supuesto editable según estructura acordada.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'pct_reparto_dividendos',
      nombre: 'Reparto de dividendos (% de la utilidad distribuible)',
      descripcion: 'Fracción de la utilidad distribuible (tras absorber pérdidas acumuladas y constituir la reserva) que se propone distribuir. REPARTO ≠ participación.',
      valor: 0.5,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: 'Supuesto de política de distribución editable (debe validarse jurídicamente para la modalidad del negocio).',
      fechaRef: '',
      editable: true,
      demo: true,
    },
    {
      id: 'pct_reserva_legal',
      nombre: 'Reserva sobre la utilidad distribuible',
      descripcion: 'Fracción de la base distribuible que se retiene como reserva antes de calcular los dividendos propuestos. Supuesto de demostración: la reserva legalmente exigible debe validarse.',
      valor: 0.1,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: 'Supuesto de demostración editable. Validar la reserva exigible para la modalidad del negocio.',
      fechaRef: '',
      editable: true,
      demo: true,
    },
    {
      id: 'pct_recuperacion_capital_trabajo',
      nombre: 'Recuperación del capital de trabajo al cierre',
      descripcion: 'Fracción del capital de trabajo inicial que el modelo libera en el ÚLTIMO año del horizonte. 0 = tratamiento conservador (no se supone recuperación). Cualquier valor > 0 debe justificarse documentalmente.',
      valor: 0,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: 'Regla explícita y conservadora: 0 % (sin recuperación supuesta). Edítela solo con justificación.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'servicios_publicos_anual_k',
      nombre: 'Servicios públicos anuales',
      descripcion: 'Agua, electricidad y portadores energéticos por año de operación (miles de USD).',
      valor: 40,
      unidad: 'kUSD/año',
      tipo: 'moneda_kusd',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'canon_anual_k',
      nombre: 'Canon anual',
      descripcion: 'Pago anual por el derecho de uso del suelo/instalaciones en años de operación (miles de USD).',
      valor: 30,
      unidad: 'kUSD/año',
      tipo: 'moneda_kusd',
      fuente: 'Supuesto editable según contrato.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'otros_gastos_fijos_k',
      nombre: 'Otros gastos fijos anuales',
      descripcion: 'Gastos fijos de operación no incluidos en otras partidas (seguros, comunicaciones, otros) en miles de USD.',
      valor: 10,
      unidad: 'kUSD/año',
      tipo: 'moneda_kusd',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'credito_monto_k',
      nombre: 'Monto del crédito externo',
      descripcion: 'Principal del crédito externo previsto (miles de USD). Desembolso, gracia y amortización: 4.7 → calendario de deuda.',
      valor: opciones.creditoKUSD,
      unidad: 'kUSD',
      tipo: 'moneda_kusd',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'otras_fuentes_k',
      nombre: 'Otras fuentes de financiamiento',
      descripcion: 'Fuentes disponibles distintas de aportaciones y crédito (miles de USD).',
      valor: 0,
      unidad: 'kUSD',
      tipo: 'moneda_kusd',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'capital_trabajo_k',
      nombre: 'Capital de trabajo inicial',
      descripcion: 'Capital de trabajo dentro del costo total de la inversión inicial (miles de USD). Se desembolsa en el año 0; su recuperación al cierre solo entra si el parámetro de recuperación lo indica.',
      valor: opciones.capitalTrabajoKUSD,
      unidad: 'kUSD',
      tipo: 'moneda_kusd',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'aranceles_anual_k',
      nombre: 'Aranceles anuales',
      descripcion: 'Derechos aduaneros previstos por año de operación (miles de USD).',
      valor: 8,
      unidad: 'kUSD/año',
      tipo: 'moneda_kusd',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'otros_impuestos_anual_k',
      nombre: 'Otros impuestos y tasas anuales',
      descripcion: 'Impuestos, tasas y contribuciones distintas del impuesto sobre utilidades, por año de operación (miles de USD).',
      valor: 5,
      unidad: 'kUSD/año',
      tipo: 'moneda_kusd',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'royalties_anual_k',
      nombre: 'Royalties anuales',
      descripcion: 'Pagos anuales por regalías tecnológicas o de marca al país (miles de USD).',
      valor: 0,
      unidad: 'kUSD/año',
      tipo: 'moneda_kusd',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'otros_beneficios_pais_anual_k',
      nombre: 'Otros ingresos anuales al país',
      descripcion: 'Otros aportes directos al país no contemplados en las partidas anteriores (miles de USD, años de operación).',
      valor: 0,
      unidad: 'kUSD/año',
      tipo: 'moneda_kusd',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'umbral_utilizacion_capacidad',
      nombre: 'Umbral de utilización de recursos (análisis)',
      descripcion: 'Umbral configurable del análisis: porcentaje de utilización de un recurso a partir del cual el texto analítico advierte saturación. No interviene en ningún cálculo: solo califica los análisis.',
      valor: 0.9,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: 'Política de análisis configurable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'umbral_margen_minimo',
      nombre: 'Umbral de margen de contribución mínimo (análisis)',
      descripcion: 'Margen sobre ingresos por debajo del cual el análisis advierte que una línea de servicio aporta poco margen. Solo califica los análisis.',
      valor: 0.15,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: 'Política de análisis configurable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
  ];
}

// ---------------------------------------------------------------------------
// Reglas por defecto. La expresión es editable desde la interfaz.
// Identificadores sin tildes; documentación del lenguaje en la propia app.
// ---------------------------------------------------------------------------

export function reglasPorDefecto(): Regla[] {
  const r = (
    id: string,
    nombre: string,
    descripcion: string,
    ambito: Regla['ambito'],
    categoria: string,
    unidad: string,
    expresion: string
  ): Regla => ({
    id,
    nombre,
    descripcion,
    expresion,
    expresionDefault: expresion,
    ambito,
    unidad,
    categoria,
    habilitada: true,
  });

  return [
    // ------------------------------------------------- Ámbito servicio
    r(
      'srv_precio_proy',
      'Precio proyectado del servicio',
      'Precio unitario del servicio en el año actual, con crecimiento anual de precios desde el año 1.',
      'servicio',
      'Servicios',
      'USD/servicio',
      'precio_base * (1 + crecimiento_precios) ^ MAX(0, PERIODO - 1)'
    ),
    r(
      'srv_cantidad_mensual_proy',
      'Demanda mensual prevista',
      'DEMANDA mensual del servicio en el año actual: inicia en el año de arranque configurado por servicio (anio_inicio_demanda, 1 por defecto) y crece con el volumen. La producción realizable puede quedar por debajo si la capacidad instalada del escenario activo no basta; el motor la limita en srv_cantidad_real_mensual.',
      'servicio',
      'Servicios',
      'servicios/mes',
      'IF(PERIODO >= anio_inicio_demanda, cantidad_base_mensual * (1 + crecimiento_volumen) ^ MAX(0, PERIODO - anio_inicio_demanda), 0)'
    ),
    r(
      'srv_costo_unitario_proy',
      'Costo variable unitario proyectado',
      'Costo variable unitario del servicio con la inflación prevista.',
      'servicio',
      'Servicios',
      'USD/servicio',
      'costo_variable_unitario * (1 + inflacion) ^ MAX(0, PERIODO - 1)'
    ),
    r(
      'srv_cantidad_real_mensual',
      'Cantidad realizable mensual (limitada por capacidad)',
      'Demanda prevista limitada por la capacidad realmente disponible del escenario activo: incluye el tope técnico del propio servicio Y la asignación pro-rata de los recursos compartidos (cuando varios servicios comparten gabinetes, equipos o profesionales, la demanda agregada no puede superar el pool de tiempo disponible). Ningún servicio genera ingresos por encima de su capacidad de prestación.',
      'servicio',
      'Servicios',
      'servicios/mes',
      'mtr_cantidad_real_mensual'
    ),
    r(
      'srv_cantidad_anual',
      'Cantidad anual de servicios',
      'Cantidad realizable mensual multiplicada por los meses del año.',
      'servicio',
      'Servicios',
      'servicios/año',
      'srv_cantidad_real_mensual * MESES_ANIO'
    ),
    r(
      'srv_ingreso_anual',
      'Ingreso anual por servicio',
      'Ingreso del servicio en el año actual: precio unitario × cantidad anual realizable.',
      'servicio',
      'Ingresos',
      'USD/año',
      'srv_precio_proy * srv_cantidad_anual'
    ),
    r(
      'srv_costo_variable_total',
      'Costo variable total del servicio',
      'Costo variable unitario × cantidad anual realizable del servicio.',
      'servicio',
      'Costos',
      'USD/año',
      'srv_costo_unitario_proy * srv_cantidad_anual'
    ),
    r(
      'srv_margen_contribucion',
      'Margen de contribución del servicio',
      'Ingreso anual menos costo variable total del servicio.',
      'servicio',
      'Servicios',
      'USD/año',
      'srv_ingreso_anual - srv_costo_variable_total'
    ),
    // ------------------------------------------------- Ámbito personal
    r(
      'salario_anual_proy',
      'Salario anual proyectado',
      'Salario promedio anual en CUP con el crecimiento salarial previsto.',
      'personal',
      'Personal',
      'CUP/año',
      'salario_promedio_anual * (1 + crecimiento_salarios) ^ MAX(0, PERIODO - 1)'
    ),
    // ------------------------------------------------- Ámbito proyecto
    r(
      'gastos_previos_k',
      'Gastos previos (USD)',
      'Suma de las partidas de inversión con categoría «gastos_previos» en USD.',
      'proyecto',
      'Inversión y financiación',
      'kUSD',
      'SUMA_INVERSIONES(IF(AND(categoria_inv = "gastos_previos", moneda_inv = "USD"), monto_inv, 0))'
    ),
    r(
      'inversion_fija_usd_k',
      'Inversión fija en USD',
      'Suma de las partidas de inversión fija expresadas en USD.',
      'proyecto',
      'Inversión y financiación',
      'kUSD',
      'SUMA_INVERSIONES(IF(AND(categoria_inv = "inversion_fija", moneda_inv = "USD"), monto_inv, 0))'
    ),
    r(
      'inversion_fija_cup_k',
      'Inversión fija en CUP convertida',
      'Partidas de inversión fija en CUP convertidas a miles de USD con el tipo de cambio parametrizado.',
      'proyecto',
      'Inversión y financiación',
      'kUSD',
      'SUMA_INVERSIONES(IF(AND(categoria_inv = "inversion_fija", moneda_inv = "CUP"), monto_inv, 0)) / tipo_cambio'
    ),
    r(
      'inversion_fija_k',
      'Inversión fija total',
      'Inversión fija en USD más la convertida desde CUP. No se suman monedas distintas sin conversión.',
      'proyecto',
      'Inversión y financiación',
      'kUSD',
      'inversion_fija_usd_k + inversion_fija_cup_k'
    ),
    r(
      'inversion_total_k',
      'Costo total de la inversión inicial',
      'Gastos previos + inversión fija + capital de trabajo.',
      'proyecto',
      'Inversión y financiación',
      'kUSD',
      'gastos_previos_k + inversion_fija_k + capital_trabajo_k'
    ),
    r(
      'aportaciones_total_k',
      'Total de aportaciones de los socios',
      'Suma de todas las aportaciones (los tres años) de ambos socios.',
      'proyecto',
      'Inversión y financiación',
      'kUSD',
      'SUMA_APORTACIONES(monto_aportacion)'
    ),
    r(
      'financiacion_disponible_k',
      'Financiación disponible',
      'Aportaciones + otras fuentes disponibles + crédito externo.',
      'proyecto',
      'Inversión y financiación',
      'kUSD',
      'aportaciones_total_k + otras_fuentes_k + credito_monto_k'
    ),
    r(
      'necesidad_financiacion_k',
      'Necesidad de financiación',
      'Inversión total − aportaciones − otras fuentes disponibles.',
      'proyecto',
      'Inversión y financiación',
      'kUSD',
      'inversion_total_k - aportaciones_total_k - otras_fuentes_k'
    ),
    r(
      'diferencia_financiacion_k',
      'Diferencia de financiación',
      'Financiación disponible − inversión requerida. Negativa: insuficiencia. Positiva: exceso sin asignar.',
      'proyecto',
      'Inversión y financiación',
      'kUSD',
      'financiacion_disponible_k - inversion_total_k'
    ),
    // ------------------------------------------------- Ámbito año: ingresos y costos
    r(
      'ingresos_servicios_usd',
      'Ingresos por servicios (USD)',
      'Suma de los ingresos anuales de todos los servicios en el año (sobre cantidades realizables).',
      'anio',
      'Ingresos',
      'USD',
      'SUMA_SERVICIOS(srv_ingreso_anual)'
    ),
    r(
      'ingresos_servicios_k',
      'Ingresos por servicios',
      'Ingresos por servicios del año expresados en miles de USD.',
      'anio',
      'Ingresos',
      'kUSD',
      'ingresos_servicios_usd / 1000'
    ),
    r(
      'ingresos_totales_k',
      'Ingresos totales',
      'Ingresos por servicios + otros ingresos del año.',
      'anio',
      'Ingresos',
      'kUSD',
      'ingresos_servicios_k + otros_ingresos_serie'
    ),
    r(
      'costos_variables_usd',
      'Costos variables (USD)',
      'Suma de los costos variables totales de todos los servicios en el año.',
      'anio',
      'Costos',
      'USD',
      'SUMA_SERVICIOS(srv_costo_variable_total)'
    ),
    r(
      'costos_variables_k',
      'Costos variables',
      'Costos variables del año en miles de USD (materiales y consumibles).',
      'anio',
      'Costos',
      'kUSD',
      'costos_variables_usd / 1000'
    ),
    r(
      'costo_laboral_cup',
      'Costo laboral en CUP',
      'Suma de cantidad × salario anual proyectado por categoría (año 0: personal de montaje; años 1+: operación), multiplicado por el factor de costo laboral.',
      'anio',
      'Costos',
      'CUP',
      'SUMA_PERSONAL(cantidad * salario_anual_proy) * factor_costo_laboral'
    ),
    r(
      'costo_laboral_k',
      'Costo laboral',
      'Costo laboral en CUP convertido a miles de USD con el tipo de cambio.',
      'anio',
      'Costos',
      'kUSD',
      'costo_laboral_cup / tipo_cambio / 1000'
    ),
    // Costos fijos SOLO en años de operación (envolventes explícitas)
    r(
      'canon_k',
      'Canon (años de operación)',
      'Canon anual activado a partir del año 1. El año 0 (montaje) no genera canon: los gastos de esa fase pertenecen a los gastos previos.',
      'anio',
      'Costos',
      'kUSD',
      'IF(PERIODO >= 1, canon_anual_k, 0)'
    ),
    r(
      'servicios_publicos_k',
      'Servicios públicos (años de operación)',
      'Agua, electricidad y portadores en años de operación.',
      'anio',
      'Costos',
      'kUSD',
      'IF(PERIODO >= 1, servicios_publicos_anual_k, 0)'
    ),
    r(
      'otros_gastos_k',
      'Otros gastos fijos (años de operación)',
      'Gastos fijos no incluidos en otras partidas, en años de operación.',
      'anio',
      'Costos',
      'kUSD',
      'IF(PERIODO >= 1, otros_gastos_fijos_k, 0)'
    ),
    r(
      'mantenimiento_k',
      'Mantenimiento (años de operación)',
      'Porcentaje de la inversión fija aplicado como mantenimiento anual en años de operación.',
      'anio',
      'Costos',
      'kUSD',
      'IF(PERIODO >= 1, pct_mantenimiento * inversion_fija_k, 0)'
    ),
    r(
      'gastos_admin_k',
      'Gastos administrativos',
      'Porcentaje de los ingresos totales destinado a gastos administrativos (el año 0, sin ingresos, es cero).',
      'anio',
      'Costos',
      'kUSD',
      'pct_gastos_admin * ingresos_totales_k'
    ),
    r(
      'depreciacion_anual_k',
      'Depreciación anual (calendario por activo)',
      'Variable del motor mtr_depreciacion_k: suma de la depreciación de cada activo según su costo, vida útil, valor residual y año de disponibilidad. El calendario limita la depreciación acumulada al importe depreciable de cada activo y no deprecia activos no disponibles.',
      'anio',
      'Costos',
      'kUSD',
      'mtr_depreciacion_k'
    ),
    r(
      'interes_k',
      'Intereses del crédito (gasto devengado)',
      'Interés devengado del período según el calendario de deuda (incluye la porción capitalizada si la gracia es total).',
      'anio',
      'Costos',
      'kUSD',
      'mtr_interes_devengado_k'
    ),
    r(
      'amortizacion_k',
      'Amortización del principal del crédito',
      'Amortización del principal según el calendario de deuda (método, gracia y plazo configurados en 4.7). Es un flujo de financiación, NO un gasto del estado de resultados.',
      'anio',
      'Inversión y financiación',
      'kUSD',
      'mtr_amortizacion_k'
    ),
    r(
      'saldo_deuda_k',
      'Saldo de la deuda al cierre',
      'Saldo pendiente al final de cada año según el calendario de deuda (verifica saldo final = inicial + desembolso + capitalización − amortización).',
      'anio',
      'Inversión y financiación',
      'kUSD',
      'mtr_saldo_deuda_k'
    ),
    r(
      'costos_totales_k',
      'Costos y gastos totales',
      'Suma de todos los costos y gastos del año (variables, laborales, canon, mantenimiento, servicios públicos, administrativos, otros fijos, depreciación e intereses).',
      'anio',
      'Costos',
      'kUSD',
      'costos_variables_k + costo_laboral_k + canon_k + mantenimiento_k + servicios_publicos_k + gastos_admin_k + otros_gastos_k + depreciacion_anual_k + interes_k'
    ),
    // ------------------------------------------------- Ámbito año: resultados
    r(
      'utilidad_antes_impuestos_k',
      'Utilidad antes de impuestos',
      'Ingresos totales − costos y gastos totales.',
      'anio',
      'Resultados',
      'kUSD',
      'ingresos_totales_k - costos_totales_k'
    ),
    r(
      'impuesto_utilidades_k',
      'Impuesto sobre utilidades (regla demostrativa)',
      'REGLA DEMOSTRATIVA EDITABLE: base de cálculo = utilidad antes de impuestos; tasa parametrizada (35 % inicial, supuesto de demostración, no tasa legal); resultados negativos tributan cero. Puede cambiar la base o la expresión.',
      'anio',
      'Resultados',
      'kUSD',
      'MAX(0, utilidad_antes_impuestos_k * tasa_impuesto_utilidades)'
    ),
    r(
      'utilidad_despues_impuestos_k',
      'Utilidad después de impuestos',
      'Utilidad antes de impuestos − impuesto sobre utilidades.',
      'anio',
      'Resultados',
      'kUSD',
      'utilidad_antes_impuestos_k - impuesto_utilidades_k'
    ),
    // ------------------------------------------------- Ámbito año: flujos de caja
    r(
      'flujo_proyecto_k',
      'Flujo de caja del PROYECTO (FCFF)',
      'Flujo del proyecto antes de decisiones de financiación: UDI + intereses devengados + depreciación − CAPEX de ampliaciones (+ recuperación del capital de trabajo en el último año). Año 0: −inversión total + resultado de montaje. Base de la recuperación de la INVERSIÓN TOTAL.',
      'anio',
      'Flujo de caja',
      'kUSD',
      'mtr_fcff_k'
    ),
    r(
      'flujo_acumulado_proyecto_k',
      'Flujo acumulado del proyecto',
      'Suma acumulada del flujo del proyecto (recurrencia con LAG).',
      'anio',
      'Flujo de caja',
      'kUSD',
      'IF(PERIODO = 0, flujo_proyecto_k, LAG(flujo_acumulado_proyecto_k, 1) + flujo_proyecto_k)'
    ),
    r(
      'saldo_pendiente_proyecto_k',
      'Saldo pendiente de recuperar (proyecto)',
      'Parte de la inversión total aún no recuperada por el flujo acumulado del proyecto.',
      'anio',
      'Flujo de caja',
      'kUSD',
      'MAX(0, -flujo_acumulado_proyecto_k)'
    ),
    r(
      'flujo_socios_k',
      'Flujo de caja de los SOCIOS (FCFE)',
      'Flujo para los aportantes: flujo del proyecto − intereses pagados + desembolsos del crédito − amortización del principal. Año 0: −aportaciones + resultado de montaje + desembolso del crédito. Base de la recuperación del CAPITAL APORTADO.',
      'anio',
      'Flujo de caja',
      'kUSD',
      'mtr_fcfe_k'
    ),
    r(
      'flujo_acumulado_socios_k',
      'Flujo acumulado de los socios',
      'Suma acumulada del flujo de los socios (recurrencia con LAG).',
      'anio',
      'Flujo de caja',
      'kUSD',
      'IF(PERIODO = 0, flujo_socios_k, LAG(flujo_acumulado_socios_k, 1) + flujo_socios_k)'
    ),
    r(
      'saldo_pendiente_socios_k',
      'Saldo pendiente de recuperar (socios)',
      'Parte del capital aportado aún no recuperado por el flujo acumulado de los socios.',
      'anio',
      'Flujo de caja',
      'kUSD',
      'MAX(0, -flujo_acumulado_socios_k)'
    ),
    // ------------------------------------------------- Ámbito año: dividendos
    r(
      'dividendos_pagables_k',
      'Dividendos pagables',
      'Dividendos efectivamente distribuibles según el módulo de dividendos: propuestos (utilidad distribuible × reparto) limitados por la caja acumulada disponible. Ningún dividendo se paga por encima de la liquidez modelada.',
      'anio',
      'Beneficios al país',
      'kUSD',
      'mtr_dividendos_pagables_k'
    ),
    r(
      'dividendos_parte_cubana_k',
      'Dividendos de la parte cubana',
      'Dividendos efectivamente pagables × participación de la parte cubana en el capital. Concilia con el módulo de dividendos (no es un cálculo aparte).',
      'anio',
      'Beneficios al país',
      'kUSD',
      'mtr_dividendos_nacional_k'
    ),
    // ------------------------------------------------- Ámbito año: beneficios al país
    r(
      'pagos_fuerza_trabajo_k',
      'Pagos por la fuerza de trabajo',
      'Vinculado al costo laboral del año (evita doble contabilización). Incluye el personal de montaje del año 0 como pago real a trabajadores cubanos.',
      'anio',
      'Beneficios al país',
      'kUSD',
      'costo_laboral_k'
    ),
    r(
      'otros_impuestos_k',
      'Otros impuestos y tasas (años de operación)',
      'Impuestos, tasas y contribuciones distintas del impuesto sobre utilidades, en años de operación.',
      'anio',
      'Beneficios al país',
      'kUSD',
      'IF(PERIODO >= 1, otros_impuestos_anual_k, 0)'
    ),
    r(
      'aranceles_k',
      'Aranceles (años de operación)',
      'Derechos aduaneros en años de operación.',
      'anio',
      'Beneficios al país',
      'kUSD',
      'IF(PERIODO >= 1, aranceles_anual_k, 0)'
    ),
    r(
      'royalties_k',
      'Royalties (años de operación)',
      'Regalías al país en años de operación.',
      'anio',
      'Beneficios al país',
      'kUSD',
      'IF(PERIODO >= 1, royalties_anual_k, 0)'
    ),
    r(
      'otros_beneficios_pais_k',
      'Otros ingresos al país (años de operación)',
      'Otros aportes directos al país en años de operación.',
      'anio',
      'Beneficios al país',
      'kUSD',
      'IF(PERIODO >= 1, otros_beneficios_pais_anual_k, 0)'
    ),
    r(
      'total_beneficios_pais_k',
      'Total de beneficios directos al país',
      'Suma de impuestos, otros impuestos, aranceles, dividendos cubanos, pagos por fuerza de trabajo, canon, royalties y otros ingresos, sin duplicar partidas. Los beneficios de explotación se activan desde el año 1; los pagos por fuerza de trabajo incluyen el montaje del año 0. Este total es el mismo que aparece en el resumen y las conclusiones.',
      'anio',
      'Beneficios al país',
      'kUSD',
      'impuesto_utilidades_k + otros_impuestos_k + aranceles_k + dividendos_parte_cubana_k + pagos_fuerza_trabajo_k + canon_k + royalties_k + otros_beneficios_pais_k'
    ),
  ];
}
