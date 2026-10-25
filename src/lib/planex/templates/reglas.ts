// ============================================================================
// Parámetros (Nivel A) y reglas (Nivel B) preconfigurados de fábrica.
// Ambas plantillas comparten este conjunto; los valores por defecto de los
// parámetros se ajustan por plantilla. Nada de esto es una constante rígida:
// todo es editable desde la interfaz y se guarda por proyecto.
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
      descripcion: 'Tasa de conversión utilizada para expresar en miles de USD los montos en CUP (salarios, inversiones).',
      valor: 400,
      unidad: 'CUP/USD',
      tipo: 'numero',
      fuente: 'Supuesto de demostración editable (referencia ilustrativa).',
      fechaRef: '2026-10-01',
      editable: true,
      demo: true,
    },
    {
      id: 'tasa_interes',
      nombre: 'Tasa de interés anual del crédito',
      descripcion: 'Interés nominal anual del crédito externo previsto.',
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
      descripcion: 'Años iniciales del crédito en los que no se amortiza principal (solo intereses).',
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
      nombre: 'Variación anual del volumen (pacientes)',
      descripcion: 'Crecimiento anual previsto de la cantidad de servicios demandados.',
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
      descripcion: 'Porcentaje de la inversión fija destinado anualmente a mantenimiento.',
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
      nombre: 'Participación de la parte cubana',
      descripcion: 'Porcentaje del capital social aportado por el socio nacional (base del reparto de dividendos).',
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
      nombre: 'Reparto de dividendos (% de la utilidad neta)',
      descripcion: 'Porcentaje de la utilidad después de impuestos que se prevé distribuir entre los socios.',
      valor: 0.5,
      unidad: '%',
      tipo: 'porcentaje',
      fuente: 'Supuesto editable.',
      fechaRef: '',
      editable: true,
      demo: false,
    },
    {
      id: 'servicios_publicos_anual_k',
      nombre: 'Servicios públicos anuales',
      descripcion: 'Agua, electricidad y portadores energéticos por año (miles de USD).',
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
      descripcion: 'Pago anual por el derecho de uso del suelo/instalaciones (miles de USD).',
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
      descripcion: 'Gastos fijos no incluidos en otras partidas (seguros, comunicaciones, otros) en miles de USD.',
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
      descripcion: 'Principal del crédito externo previsto (miles de USD).',
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
      descripcion: 'Capital de trabajo dentro del costo total de la inversión inicial (miles de USD).',
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
      descripcion: 'Derechos aduaneros previstos por año (miles de USD).',
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
      descripcion: 'Impuestos, tasas y contribuciones distintas del impuesto sobre utilidades (miles de USD).',
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
      id: 'otros_beneficios_pais_k',
      nombre: 'Otros ingresos anuales al país',
      descripcion: 'Otros aportes directos al país no contemplados en las partidas anteriores (miles de USD).',
      valor: 0,
      unidad: 'kUSD/año',
      tipo: 'moneda_kusd',
      fuente: 'Supuesto editable.',
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
      'Cantidad mensual proyectada',
      'Cantidad mensual de servicios en el año actual, con crecimiento anual del volumen.',
      'servicio',
      'Servicios',
      'servicios/mes',
      'cantidad_base_mensual * (1 + crecimiento_volumen) ^ MAX(0, PERIODO - 1)'
    ),
    r(
      'srv_cantidad_anual',
      'Cantidad anual de servicios',
      'Cantidad mensual proyectada multiplicada por los meses del año.',
      'servicio',
      'Servicios',
      'servicios/año',
      'srv_cantidad_mensual_proy * MESES_ANIO'
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
      'srv_ingreso_anual',
      'Ingreso anual por servicio',
      'Ingreso del servicio en el año actual: precio unitario × cantidad anual.',
      'servicio',
      'Ingresos',
      'USD/año',
      'srv_precio_proy * srv_cantidad_anual'
    ),
    r(
      'srv_costo_variable_total',
      'Costo variable total del servicio',
      'Costo variable unitario × cantidad anual del servicio.',
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
    // ------------------------------------------------- Ámbito año
    r(
      'ingresos_servicios_usd',
      'Ingresos por servicios (USD)',
      'Suma de los ingresos anuales de todos los servicios en el año.',
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
      'Suma de cantidad × salario anual proyectado por categoría, multiplicado por el factor de costo laboral.',
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
    r(
      'mantenimiento_k',
      'Mantenimiento',
      'Porcentaje de la inversión fija aplicado como mantenimiento anual (regla de porcentaje configurable).',
      'anio',
      'Costos',
      'kUSD',
      'pct_mantenimiento * inversion_fija_k'
    ),
    r(
      'gastos_admin_k',
      'Gastos administrativos',
      'Porcentaje de los ingresos totales destinado a gastos administrativos (regla de porcentaje configurable).',
      'anio',
      'Costos',
      'kUSD',
      'pct_gastos_admin * ingresos_totales_k'
    ),
    r(
      'depreciacion_anual_k',
      'Depreciación anual',
      'Suma de monto / vida útil de las partidas de inversión fija (USD) más la parte en CUP convertida.',
      'anio',
      'Costos',
      'kUSD',
      'SUMA_INVERSIONES(IF(AND(categoria_inv = "inversion_fija", moneda_inv = "USD"), monto_inv * IF(vida_util_inv > 0, 1 / vida_util_inv, 0), 0)) + SUMA_INVERSIONES(IF(AND(categoria_inv = "inversion_fija", moneda_inv = "CUP"), monto_inv * IF(vida_util_inv > 0, 1 / vida_util_inv, 0), 0)) / tipo_cambio'
    ),
    r(
      'amortizacion_k',
      'Amortización del crédito',
      'Anualidad de amortización del principal tras el período de gracia.',
      'anio',
      'Inversión y financiación',
      'kUSD',
      'IF(AND(PERIODO > periodo_gracia, PERIODO <= periodo_gracia + plazo_amortizacion), credito_monto_k / plazo_amortizacion, 0)'
    ),
    r(
      'saldo_deuda_k',
      'Saldo de la deuda',
      'Saldo pendiente del crédito al final de cada año (recurrencia con LAG).',
      'anio',
      'Inversión y financiación',
      'kUSD',
      'IF(PERIODO = 0, credito_monto_k, MAX(0, LAG(saldo_deuda_k, 1) - amortizacion_k))'
    ),
    r(
      'interes_k',
      'Intereses del crédito',
      'Interés del año sobre el saldo de la deuda del año anterior.',
      'anio',
      'Costos',
      'kUSD',
      'IF(PERIODO = 0, 0, LAG(saldo_deuda_k, 1) * tasa_interes)'
    ),
    r(
      'costos_totales_k',
      'Costos y gastos totales',
      'Suma de todos los costos y gastos del año (variables, laborales, canon, mantenimiento, servicios públicos, administrativos, otros fijos, depreciación e intereses).',
      'anio',
      'Costos',
      'kUSD',
      'costos_variables_k + costo_laboral_k + canon_anual_k + mantenimiento_k + servicios_publicos_anual_k + gastos_admin_k + otros_gastos_fijos_k + depreciacion_anual_k + interes_k'
    ),
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
    r(
      'flujo_neto_k',
      'Flujo de caja neto',
      'Año 0: desembolso de la inversión total. Años de operación: utilidad neta + depreciación − amortización del principal.',
      'anio',
      'Flujo de caja',
      'kUSD',
      'IF(PERIODO = 0, -inversion_total_k, utilidad_despues_impuestos_k + depreciacion_anual_k - amortizacion_k)'
    ),
    r(
      'flujo_acumulado_k',
      'Flujo de caja acumulado',
      'Suma acumulada de los flujos netos (recurrencia con LAG).',
      'anio',
      'Flujo de caja',
      'kUSD',
      'IF(PERIODO = 0, flujo_neto_k, LAG(flujo_acumulado_k, 1) + flujo_neto_k)'
    ),
    r(
      'saldo_pendiente_k',
      'Saldo pendiente de recuperar',
      'Parte de la inversión aún no recuperada por el flujo acumulado.',
      'anio',
      'Flujo de caja',
      'kUSD',
      'MAX(0, -flujo_acumulado_k)'
    ),
    r(
      'dividendos_parte_cubana_k',
      'Dividendos de la parte cubana',
      'Utilidad neta distribuible × participación cubana, solo con utilidad positiva.',
      'anio',
      'Beneficios al país',
      'kUSD',
      'IF(utilidad_despues_impuestos_k > 0, utilidad_despues_impuestos_k * pct_parte_cubana * pct_reparto_dividendos, 0)'
    ),
    r(
      'pagos_fuerza_trabajo_k',
      'Pagos por la fuerza de trabajo',
      'Vinculado al costo laboral del año (evita doble contabilización).',
      'anio',
      'Beneficios al país',
      'kUSD',
      'costo_laboral_k'
    ),
    r(
      'total_beneficios_pais_k',
      'Total de beneficios directos al país',
      'Suma de impuestos, aranceles, dividendos cubanos, pagos por fuerza de trabajo, canon, royalties y otros ingresos, sin duplicar partidas.',
      'anio',
      'Beneficios al país',
      'kUSD',
      'impuesto_utilidades_k + otros_impuestos_anual_k + aranceles_anual_k + dividendos_parte_cubana_k + pagos_fuerza_trabajo_k + canon_anual_k + royalties_anual_k + otros_beneficios_pais_k'
    ),
  ];
}
