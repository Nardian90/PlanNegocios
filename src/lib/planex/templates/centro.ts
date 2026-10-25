// ============================================================================
// Plantilla «Centro de Diagnóstico Integral» — SEGUNDO PROYECTO de la prueba
// de generalización (misión §17). Datos ficticios, estructura de negocio
// DISTINTA a la clínica, y SIN fórmulas nuevas: reutiliza el mismo motor, las
// mismas reglas de fábrica y los mismos parámetros. Solo cambian los datos.
//
// Diferencias estructurales frente a Sonrisa Habana:
//  - Horizonte 8 años (no 10).
//  - Sin crédito (financiación 100 % con aportaciones) → sin intereses ni
//    amortizaciones; los flujos del proyecto y de los socios coinciden.
//  - Escenario A (capacidad constante): demanda limitada por los equipos
//    instalados, sin ampliaciones.
//  - Tasa de demostración 30 % (la clínica usa 35 %).
//  - Un aporte de la parte nacional en CUP (conversión documentada).
//  - Activos con vidas útiles y disponibilidades distintas, uno de ellos
//    disponible a partir del año 3 (depósito de contraste).
// ============================================================================

import { PlanexProject } from '../types';
import { parametrosPorDefecto, reglasPorDefecto } from './reglas';
import { crearProyectoBase } from '../model/factory';
import { normalizarSerie } from '../model/factory';

export function crearProyectoCentro(): PlanexProject {
  const p = crearProyectoBase('centro');

  p.nombre = 'Centro de Diagnóstico Integral «Imagen Habana» — Plan de Negocios (ejemplo ilustrativo)';
  p.ajustes.horizonteAnios = 8;

  p.titulo = {
    nombreProyecto: 'Centro de Diagnóstico Integral «Imagen Habana»',
    denominacionPropuesta: 'Inversión extranjera total para la prestación de servicios de diagnóstico por imagen en La Habana',
  };
  p.general = {
    elaboradoPor: '【Nombre y apellidos de quien elabora】',
    cargo: 'Especialista de inversiones (ejemplo ilustrativo)',
    firmaIdentificacion: '',
    fecha: '2026-10-25',
    declaracionResponsabilidad: true,
  };
  p.resumen = {
    introduccion:
      'Segundo ejemplo ilustrativo de la prueba de generalización de PLANEX: un centro de diagnóstico por imagen con estructura distinta a la plantilla clínica (inversión extranjera total, sin crédito, horizonte de 8 años, escenario de capacidad constante y un activo incorporado en el año 3). Todos los datos son ficticios y las cifras cuantitativas del resumen se generan desde el modelo de cálculo: no hay resultados escritos de antemano. Construido SIN fórmulas de negocio nuevas: solo datos sobre el motor común.',
    notas: 'Las cifras del resumen cuantitativo provienen del modelo activo y se recalculan al cambiar cualquier dato.',
  };

  p.negocio = {
    modalidad: 'Inversión extranjera total (Ley 118/2014 — referencia ilustrativa a validar)',
    objetoSocial:
      'Servicios de diagnóstico por imagen: radiología convencional y digital, ultrasonido, tomografía axial computarizada, resonancia magnética, electrocardiografía y pruebas de esfuerzo; laboratorio clínico básico de apoyo.',
    plazoVigencia: '15 años renovables (supuesto ilustrativo)',
    fundamentacion:
      'Demanda insatisfecha de estudios diagnósticos con tiempos de espera reducidos para pacientes nacionales con capacidad de pago y convenios con prestadores de salud. Ejemplo ilustrativo de generalización: sustentar con estudios reales.',
    objetivosInversion:
      'Sustitución de importaciones de servicios diagnósticos, incorporación de tecnología de imagen de última generación, generación de empleo calificado y encadenamientos con el sistema de salud (ilustrativo).',
    relacionPNDES: 'Alineación ilustrativa con el PNDES: servicios de alto valor agregado con impacto en la calidad de vida. (A validar.)',
    relacionEDT: 'Contribución ilustrativa a la EDT de La Habana como polo de servicios de salud. (A validar.)',
    bienesServicios:
      'Seis líneas de servicios diagnósticos con precios y demandas previstas ficticias en la tabla 4.6; la producción queda limitada por los equipos instalados (escenario A: capacidad constante, sin ampliaciones).',
    mercadoInterno: 'Pacientes ambulatorios nacionales con capacidad de pago y convenios con entidades del sistema de salud (supuesto ilustrativo).',
    mercadoExterno: 'Convenios con prestadores de turismo de salud para estudios de diagnóstico (supuesto ilustrativo).',
    reglaDistribucion:
      'Al ser inversión extranjera total no existe socio nacional: el parámetro de participación cubana es 0 % y no se proyectan dividendos a la parte cubana. El impuesto sobre utilidades y los demás pagos al país concentran los beneficios directos. (Modalidad a validar jurídicamente.)',
  };
  p.inversionistaExtranjero = {
    nombre: 'Global Imaging Health S.A. (ficticio)',
    domicilio: 'Tower Example St., Ciudad Ejemplo (dato ficticio)',
    identificacionFiscal: 'TAX-EJEMPLO-999999 (ficticio)',
    experiencia: 'Operador ilustrativo de redes de diagnóstico por imagen (dato ficticio).',
    vinculacionCuba: 'Sin operaciones previas en Cuba (supuesto ilustrativo).',
  };
  p.inversionistaNacional = {
    nombre: '— (sin socio nacional en esta modalidad)',
    domicilio: '—',
    identificacionFiscal: '—',
    experiencia: '—',
    vinculacionCuba: '—',
  };

  // Aportaciones: 100 % extranjero. 1 900 kUSD de aporte en efectivo en USD
  // y un local acondicionado aportado en CUP (conversión documentada):
  // 66 000 000 CUP / 400 = 165 kUSD → total 2 065 kUSD.
  p.aportaciones = [
    { id: 'ap-ex-ef', socio: 'extranjero', tipo: 'efectivo', montos: [1500, 600, 0], referenciaDocumental: 'Compromiso de aporte en efectivo (ficticio; adjuntar instrumento)' },
    { id: 'ap-ex-loc', socio: 'extranjero', tipo: 'activos_fijos_tangibles', montos: [165, 0, 0], referenciaDocumental: 'Local acondicionado en CUP (ficticio; avalúo y documentación de Patrimonio pendientes)' },
  ];

  p.tecnico = {
    caracterizacion:
      'Centro de diagnóstico con 2 salas de radiología digital, 1 sala de ultrasonido (2 equipos), 1 TAC, 1 resonancia magnética y laboratorio clínico de apoyo. Ejemplo ilustrativo de generalización.',
    capacidadInstalada:
      'Capacidad derivada de los recursos operativos: 2 salas de radiología, 2 equipos de ultrasonido, 1 TAC y 1 resonancia (disponible desde el año 3), con técnicos y especialistas como recurso compartido. Escenario ACTIVO: A (capacidad constante): sin ampliaciones programadas; la demanda no atendible queda limitada y advertida.',
    plazoNiveles: 'Demanda creciente del 6 % anual desde el año 1 (supuesto ilustrativo).',
    tecnologiasActuales: 'Equipos de referencia del mercado (dato ficticio).',
    tecnologiasNuevas: 'Radiología digital directa, TAC multicorte y resonancia 1.5 T (supuestos ilustrativos).',
    localizacion: 'Municipio Vedado, La Habana (dirección ficticia).',
    infraestructura: 'Red eléctrica trifásica, chiller de resonancia y respaldo energético (supuesto ilustrativo).',
    terrenosInstalaciones: 'Local en régimen de arrendamiento con canon parametrizado (supuesto ficticio).',
    necesidadesConstruccion: 'Blindaje radiológico de salas y adecuación de 600 m² (monto ilustrativo en inversiones).',
    escenarioCapacidad: 'A_constante',
  };

  p.recursos = [
    {
      id: 're-rad',
      nombre: 'Salas de radiología digital',
      tipo: 'equipo',
      cantidad: 2,
      horasDia: 10,
      diasAnio: 300,
      pctMantenimiento: 0.08,
      anioDisponible: 1,
      expansiones: [],
      observacion: 'Estudios convencionales y digitales (supuesto ficticio).',
    },
    {
      id: 're-us',
      nombre: 'Equipos de ultrasonido',
      tipo: 'equipo',
      cantidad: 2,
      horasDia: 8,
      diasAnio: 300,
      pctMantenimiento: 0.08,
      anioDisponible: 1,
      expansiones: [],
      observacion: 'Doppler y general (supuesto ficticio).',
    },
    {
      id: 're-tac',
      nombre: 'Tomógrafo (TAC)',
      tipo: 'equipo',
      cantidad: 1,
      horasDia: 10,
      diasAnio: 300,
      pctMantenimiento: 0.1,
      anioDisponible: 1,
      expansiones: [],
      observacion: 'Estudios multicorte (supuesto ficticio).',
    },
    {
      id: 're-rm',
      nombre: 'Resonancia magnética',
      tipo: 'equipo',
      cantidad: 1,
      horasDia: 10,
      diasAnio: 300,
      pctMantenimiento: 0.12,
      anioDisponible: 3,
      expansiones: [],
      observacion: 'Incorporada en el año 3 (CAPEX de ampliación inicial no requerido: forma parte de la inversión inicial con disponibilidad diferida).',
    },
    {
      id: 're-tec',
      nombre: 'Técnicos y especialistas de imagen',
      tipo: 'profesional',
      cantidad: 9,
      horasDia: 7,
      diasAnio: 300,
      pctMantenimiento: 0.05,
      anioDisponible: 1,
      expansiones: [],
      observacion: 'Personal técnico y médico compartido entre modalidades (supuesto ficticio).',
    },
  ];

  // Demanda prevista ficticia del año 1 (mensual). capacidadMaxMensual = 0
  // (sin tope directo: limita la capacidad de los recursos compartidos).
  p.servicios = [
    { id: 'dz-1', nombre: 'Radiografía digital (por estudio)', precioBase: 18, cantidadBaseMensual: 850, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 3, duracionMinutos: 15, recursoIds: ['re-rad', 're-tec'], fuente: 'Supuesto ficticio' },
    { id: 'dz-2', nombre: 'Ultrasonido (por estudio)', precioBase: 40, cantidadBaseMensual: 320, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 7, duracionMinutos: 30, recursoIds: ['re-us', 're-tec'], fuente: 'Supuesto ficticio' },
    { id: 'dz-3', nombre: 'TAC (por estudio)', precioBase: 180, cantidadBaseMensual: 130, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 35, duracionMinutos: 20, recursoIds: ['re-tac', 're-tec'], fuente: 'Supuesto ficticio' },
    { id: 'dz-4', nombre: 'Resonancia magnética (por estudio)', precioBase: 320, cantidadBaseMensual: 45, anioInicioDemanda: 3, capacidadMaxMensual: 0, costoVariableUnitario: 60, duracionMinutos: 35, recursoIds: ['re-rm', 're-tec'], fuente: 'Supuesto ficticio. Demanda desde el año 3 (arranque de la línea: campo «arranque de demanda» de la tabla de servicios).' },
    { id: 'dz-5', nombre: 'Electrocardiografía y prueba de esfuerzo', precioBase: 55, cantidadBaseMensual: 150, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 8, duracionMinutos: 30, recursoIds: ['re-tec'], fuente: 'Supuesto ficticio' },
    { id: 'dz-6', nombre: 'Laboratorio clínico (panel básico)', precioBase: 22, cantidadBaseMensual: 400, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 5, duracionMinutos: 15, recursoIds: ['re-tec'], fuente: 'Supuesto ficticio' },
  ];

  p.consumos = [
    { id: 'cn-1', concepto: 'Electricidad', unidad: 'kWh/día', cantidad: 540, periodo: 'Operación', observacion: 'Supuesto ficticio' },
    { id: 'cn-2', concepto: 'Agua', unidad: 'm³/día', cantidad: 4, periodo: 'Operación', observacion: 'Supuesto ficticio' },
    { id: 'cn-3', concepto: 'Helio (resonancia)', unidad: 'L/año', cantidad: 400, periodo: 'Operación', observacion: 'Supuesto ficticio' },
  ];

  // Inversión (kUSD): previos 60 + fija 1 805 (1 640 USD + 165 CUP convertidos)
  // + capital de trabajo 200 = 2 065 = aportaciones exactas (sin crédito).
  p.financiero.inversion = [
    { id: 'iv-1', concepto: 'Estudios, constitución y registros', categoria: 'gastos_previos', moneda: 'USD', monto: 35, vidaUtilAnios: 0, anioDisponible: 0, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
    { id: 'iv-2', concepto: 'Licencias sanitarias y regulatorias', categoria: 'gastos_previos', moneda: 'USD', monto: 25, vidaUtilAnios: 0, anioDisponible: 0, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
    { id: 'iv-3', concepto: 'Radiología digital (2 salas)', categoria: 'inversion_fija', moneda: 'USD', monto: 340, vidaUtilAnios: 8, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
    { id: 'iv-4', concepto: 'Ultrasonido (2 equipos)', categoria: 'inversion_fija', moneda: 'USD', monto: 120, vidaUtilAnios: 8, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
    { id: 'iv-5', concepto: 'Tomógrafo multicorte', categoria: 'inversion_fija', moneda: 'USD', monto: 480, vidaUtilAnios: 8, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
    { id: 'iv-6', concepto: 'Resonancia magnética 1.5 T', categoria: 'inversion_fija', moneda: 'USD', monto: 700, vidaUtilAnios: 10, anioDisponible: 3, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio. Disponible desde el año 3: no deprecia antes.' },
    { id: 'iv-7', concepto: 'Laboratorio clínico de apoyo', categoria: 'inversion_fija', moneda: 'USD', monto: 95, vidaUtilAnios: 7, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
    { id: 'iv-8', concepto: 'Blindaje radiológico y adecuación', categoria: 'inversion_fija', moneda: 'USD', monto: 105, vidaUtilAnios: 20, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
    { id: 'iv-9', concepto: 'Local acondicionado (aportado en CUP)', categoria: 'inversion_fija', moneda: 'CUP', monto: 66000, vidaUtilAnios: 20, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: '66 000 kCUP / 400 CUP por USD = 165 kUSD (ficticio; misma partida aportada por el inversionista: avalúo conciliado, sin doble contabilización)' },
  ];
  p.financiero.vehiculos = [];
  p.financiero.otrosIngresos = normalizarSerie([], 8);

  // Sin crédito: financiación con aportaciones exclusivamente.
  p.financiero.deuda = {
    habilitada: false,
    anioDesembolso: 0,
    tipoGracia: 'principal',
    metodo: 'capital_constante',
    fuente: 'No se prevé crédito en esta modalidad (supuesto ficticio).',
  };
  p.parametros = parametrosPorDefecto({ creditoKUSD: 0, capitalTrabajoKUSD: 200 });
  const setParam = (id: string, valor: number) => {
    const x = p.parametros.find((q) => q.id === id);
    if (x) x.valor = valor;
  };
  setParam('tasa_impuesto_utilidades', 0.3); // tasa de demostración distinta (30 %)
  setParam('pct_parte_cubana', 0); // inversión extranjera total: sin dividendo cubano
  setParam('crecimiento_volumen', 0.06);
  setParam('crecimiento_precios', 0.02);
  setParam('canon_anual_k', 24);
  setParam('servicios_publicos_anual_k', 55);
  setParam('otros_gastos_fijos_k', 18);
  setParam('aranceles_anual_k', 12);
  setParam('otros_impuestos_anual_k', 4);
  setParam('pct_mantenimiento', 0.04);
  p.reglas = reglasPorDefecto();

  p.mercado = {
    caracterizacion: 'Servicios diagnósticos de imagen con estándares internacionales. Descripción ilustrativa de generalización.',
    requisitosRegulatorios: 'Licencia sanitaria (MINSAP), autorizaciones de energía ionizante y protección radiológica, registro de la inversión extranjera. Lista ilustrativa a verificar.',
    materiasPrimas: 'Consumibles radiológicos, medio de contraste y reactivos de laboratorio (ficticios).',
    fuentesSuministro: 'Importación de consumibles con certificación (supuesto ficticio).',
    consumoEstimado: 'Costos variables unitarios ficticios en la tabla de servicios.',
    demandaAparente: 'Supuesto ilustrativo no verificado: población del área de influencia con indicaciones diagnósticas anuales estimadas.',
    demandaSolvente: 'Supuesto ilustrativo no verificado de captación por convenios y pacientes directos.',
    metodoEstimacion: 'Estimación ilustrativa por referencias; documentar fuentes y fechas en un uso real.',
    fuentesConsulta: 'Fuentes ficticias de demostración.',
    ventasExportacion: 'Estudios a pacientes internacionales vía turismo de salud (supuesto ilustrativo).',
    ventasDivisas: 'Facturación en divisas (supuesto ficticio).',
    ventasMonedaNacional: 'Sin componente en moneda nacional en este ejemplo (supuesto ficticio).',
  };

  p.fuerza = { entidadContratante: 'Entidad empleadora autorizada según la modalidad de inversión extranjera total (supuesto ilustrativo).' };
  p.personal = [
    { id: 'pe-m1', etapa: 'montaje', grupo: 'cubano_otro', cantidad: 4, salarioPromedioAnualCUP: 84000 },
    { id: 'pe-o1', etapa: 'operacion', grupo: 'cubano_directivo', cantidad: 2, salarioPromedioAnualCUP: 300000 },
    { id: 'pe-o2', etapa: 'operacion', grupo: 'cubano_otro', cantidad: 10, salarioPromedioAnualCUP: 216000 },
    { id: 'pe-o3', etapa: 'operacion', grupo: 'cubano_otro', cantidad: 6, salarioPromedioAnualCUP: 144000 },
  ];

  p.cronograma = [
    { id: 'cr-1', etapa: 'Estudios y constitución', inicio: '2026-07', fin: '2026-12', observacion: 'Ficticio' },
    { id: 'cr-2', etapa: 'Licencias y protección radiológica', inicio: '2026-10', fin: '2027-04', observacion: 'Ficticio' },
    { id: 'cr-3', etapa: 'Obra civil y blindaje', inicio: '2027-01', fin: '2027-08', observacion: 'Ficticio' },
    { id: 'cr-4', etapa: 'Instalación y pruebas de equipos', inicio: '2027-07', fin: '2027-10', observacion: 'Ficticio' },
    { id: 'cr-5', etapa: 'Operación (radiología, US, TAC, laboratorio)', inicio: '2027-11', fin: '2029-10', observacion: 'Ficticio: resonancia disponible desde el año 3.' },
    { id: 'cr-6', etapa: 'Operación plena (incluye resonancia)', inicio: '2029-11', fin: '2035-10', observacion: 'Horizonte de 8 años (ficticio).' },
  ];

  p.conclusiones = {
    texto:
      'Marco de lectura del segundo ejemplo ilustrativo: la síntesis cuantitativa se GENERA desde el modelo (análisis dinámico) y no está escrita de antemano. Este proyecto demuestra la generalización del motor: otra actividad, otro horizonte, sin crédito, escenario de capacidad constante, tasa distinta y un activo con disponibilidad diferida — todo con las mismas reglas de fábrica. Datos ficticios: validar todo antes de un uso oficial.',
  };

  return p;
}

export const NOTA_CENTRO =
  'EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS (proyecto de prueba de generalización). No constituye una propuesta aprobada ni acredita cumplimiento legal, tributario ni sanitario.';
