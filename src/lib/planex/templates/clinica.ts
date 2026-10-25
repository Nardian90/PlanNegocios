// ============================================================================
// Plantilla «Clínica Estomatológica» — ejemplo completo con datos ficticios
// coherentes entre sí (todo marcado como supuesto ilustrativo).
// Modelo: Empresa Mixta (60 % extranjero / 40 % cubano), La Habana.
// Horizonte 10 años ≥ recuperación (~4 años) + 1.
// ============================================================================

import { PlanexProject, ADVERTENCIA_DATOS_FICTICIOS } from '../types';
import { parametrosPorDefecto, reglasPorDefecto } from './reglas';
import { crearProyectoBase } from '../model/factory';

export function crearProyectoClinica(): PlanexProject {
  const p = crearProyectoBase('clinica');

  p.nombre = 'Clínica Estomatológica «Sonrisa Habana» S.A. — Plan de Negocios (ejemplo ilustrativo)';
  p.ajustes.horizonteAnios = 10;

  // ------------------------------------------------------------- 4.1 / 4.2
  p.titulo = {
    nombreProyecto: 'Clínica Estomatológica «Sonrisa Habana»',
    denominacionPropuesta: 'Constitución de una empresa mixta para la prestación de servicios estomatológicos integrales en La Habana',
  };
  p.general = {
    elaboradoPor: '«Nombre y apellidos de quien elabora»',
    cargo: 'Especialista de inversiones (ejemplo ilustrativo)',
    firmaIdentificacion: '',
    fecha: '2026-10-25',
    declaracionResponsabilidad: true,
  };

  // ------------------------------------------------------------- 4.4
  p.resumen = {
    introduccion:
      'El presente ejemplo ilustrativo resume la propuesta de constitución de una empresa mixta entre un inversionista extranjero del sector de servicios de salud y una entidad nacional cubana, para la prestación de servicios estomatológicos integrales de calidad en La Habana. Todas las cifras son datos ficticios de demostración de la aplicación y deben sustituirse y validarse antes de cualquier presentación oficial. La propuesta contempla la rehabilitación y equipamiento de una instalación asistencial con 5 gabinetes, la incorporación de tecnologías de imagenología digital y laboratorio de prótesis, y la generación de empleo calificado. El modelo financiero del ejemplo proyecta 10 años de operación, con recuperación de la inversión en torno al cuarto año y aportes sostenidos al país en concepto de impuestos, canon, dividendos de la parte cubana y pagos por la fuerza de trabajo.',
    notas: 'Las cifras de este resumen se vinculan automáticamente al modelo financiero y se actualizan al cambiar parámetros o fórmulas.',
  };

  // ------------------------------------------------------------- 4.5
  p.negocio = {
    modalidad: 'Empresa Mixta (Ley 118/2014, Decreto-Ley 335/2018)',
    objetoSocial:
      'Prestación de servicios estomatológicos integrales: consulta y diagnóstico, odontología preventiva, restauraciones, endodoncia, periodoncia, cirugía oral, prótesis estomatológica, ortodoncia e imagenología dental; así como servicios de laboratorio de prótesis y atención a pacientes nacionales e internacionales.',
    plazoVigencia: '20 años renovables (supuesto ilustrativo)',
    fundamentacion:
      'La propuesta responde a la demanda insatisfecha de servicios estomatológicos especializados con estándares internacionales, tanto para la población nacional con capacidad de pago como para pacientes internacionales. La clínica incorpora tecnología de diagnóstico digital, esterilización de última generación y protocolos de bioseguridad, con transferencia de conocimiento al personal cubano. Este texto es ilustrativo y debe sustentarse en estudios reales.',
    objetivosInversion:
      'Vinculación ilustrativa con los objetivos de la Ley 118: sustitución de importaciones de servicios por oferta nacional; generación de ingresos exportables (atención a pacientes internacionales); transferencia de tecnología y know-how; creación de empleo calificado; encadenamientos con laboratorios y proveedores nacionales de materiales, en lo posible.',
    relacionPNDES:
      'Alineación ilustrativa con el Plan Nacional de Desarrollo Económico y Social: eje de transformación de los servicios con alto valor agregado y exportables; objetivo de elevar la calidad de vida mediante servicios de salud. (Validar la alineación real con el PNDES vigente.)',
    relacionEDT:
      'Contribución ilustrativa a la Estrategia de Desarrollo Territorial de La Habana: fortalecimiento del polo de servicios de salud y posicionamiento de la ciudad como destino de turismo de salud. (Validar con la EDT municipal aplicable.)',
    bienesServicios:
      'Servicios estomatológicos especializados con equipamiento digital. Estructura de 9 líneas de servicios con precios y volúmenes previstos definidos en la sección 4.6. El detalle de precios y volúmenes es un supuesto ficticio precargado para demostrar el motor de cálculo.',
    mercadoInterno:
      'Demanda de la población con capacidad de pago en La Habana y municipios cercanos; convenios con entidades empleadoras para planes de atención. Estimación ficticia de demanda aparente y solvente en la sección 4.8.',
    mercadoExterno:
      'Atención a pacientes internacionales (turismo de salud) mediante acuerdos con turoperadores y plataformas de reservas médicas. Supuesto ilustrativo: participación creciente a partir del tercer año.',
    reglaDistribucion:
      'Distribución de utilidades conforme a la participación en el capital social (60 % socio extranjero / 40 % socio nacional, supuesto ilustrativo), previa cobertura de obligaciones y constitution de reservas conforme a la legislación vigente. (Regla a validar jurídicamente.)',
  };
  p.inversionistaExtranjero = {
    nombre: 'Grupo Dental Internacional S.A. (ficticio)',
    domicilio: 'Av. Ejemplo 123, Ciudad Ejemplo, País Ejemplo (dato ficticio)',
    identificacionFiscal: 'NIF-EJEMPLO-000000 (ficticio)',
    experiencia: 'Operador ilustrativo de redes de clínicas dentales con 15 años de experiencia (dato ficticio para la demostración).',
    vinculacionCuba: 'Sin operaciones previas en Cuba (supuesto ilustrativo).',
  };
  p.inversionistaNacional = {
    nombre: 'Entidad Nacional de Servicios de Salud (ficticia)',
    domicilio: 'Calle Ejemplo 456, La Habana, Cuba (dato ficticio)',
    identificacionFiscal: 'Código ONAT ficticio (dato ilustrativo)',
    experiencia: 'Entidad empleadora y prestadora de servicios de salud (dato ficticio).',
    vinculacionCuba: 'Aporta instalaciones y fuerza de trabajo calificada (supuesto ilustrativo).',
  };

  // Aportaciones (kUSD) — Extranjero 708 (60 %) + Nacional 472 (40 %) = 1 180
  p.aportaciones = [
    { id: 'ap-ex-ef', socio: 'extranjero', tipo: 'efectivo', montos: [420, 0, 0], referenciaDocumental: '' },
    { id: 'ap-ex-af', socio: 'extranjero', tipo: 'activos_fijos_tangibles', montos: [288, 0, 0], referenciaDocumental: 'Equipamiento dental e imagenología nuevos (factura proforma ilustrativa)' },
    { id: 'ap-na-af', socio: 'nacional', tipo: 'activos_fijos_tangibles', montos: [180, 0, 0], referenciaDocumental: 'Instalaciones adecuadas y montadas (avalúo ilustrativo)' },
    { id: 'ap-na-ac', socio: 'nacional', tipo: 'activos_circulantes', montos: [152, 0, 0], referenciaDocumental: 'Inventario inicial de materiales y consumibles (ilustrativo)' },
    { id: 'ap-na-ef', socio: 'nacional', tipo: 'efectivo', montos: [140, 0, 0], referenciaDocumental: '' },
  ];

  // ------------------------------------------------------------- 4.6
  p.tecnico = {
    caracterizacion:
      'Clínica estomatológica integral con 5 gabinetes de atención, 1 laboratorio de prótesis, 1 sala de imagenología dental (2 equipos), área de esterilización central con autoclaves de vacío y compresores dedicados, recepción y administración. Modelo operativo con cita programada y horario extendido (lunes a sábado). Instalación en local existente sujeto a adecuación y montaje (supuesto ilustrativo).',
    capacidadInstalada:
      '5 gabinetes × 6 días/semana × 3 turnos equivalentes; capacidad teórica máxima de cada línea de servicio precargada en la tabla de servicios. La aplicación advierte automáticamente cuando las cantidades proyectadas superan la capacidad instalada.',
    plazoNiveles: 'Alcanzar la ocupación plena prevista hacia el tercer año de operación (supuesto ilustrativo con crecimiento del 5 % anual del volumen).',
    tecnologiasActuales: 'Instalación base con equipamiento básico existente (dato ficticio).',
    tecnologiasNuevas: 'Radiógrafos digitales panorámicos/periapicales, sillones de última generación, autoclaves de vacío clase B, sistema de gestión clínica digital (historia de salud electrónica) y laboratorio de prótesis CAD/CAM básico (todos supuestos ilustrativos).',
    localizacion: 'Municipio Playa, La Habana, Cuba (dirección ficticia: Calle Ejemplo e/ Ejemplo y Ejemplo, Reparto Ejemplo).',
    infraestructura: 'Red eléctrica, agua, alcantarillado, comunicaciones y acceso vial disponibles en la ubicación (supuesto ilustrativo).',
    terrenosInstalaciones: 'Local en régimen de usufructo/arrendamiento estatal con canon anual parametrizado (supuesto ficticio de 30 kUSD/año).',
    necesidadesConstruccion: 'Adecuación de 450 m²: climatización, red de aire comprimido, aspiración centralizada, área de esterilización y laboratorio (monto ilustrativo en la tabla de inversiones).',
  };

  p.servicios = [
    { id: 'sv-1', nombre: 'Consulta estomatológica', precioBase: 25, cantidadBaseMensual: 400, capacidadMaxMensual: 440, costoVariableUnitario: 6, fuente: 'Supuesto ficticio (estudio de precios ilustrativo)' },
    { id: 'sv-2', nombre: 'Odontología preventiva (profilaxis y sellado)', precioBase: 35, cantidadBaseMensual: 160, capacidadMaxMensual: 200, costoVariableUnitario: 10, fuente: 'Supuesto ficticio' },
    { id: 'sv-3', nombre: 'Restauraciones (obturaciones)', precioBase: 60, cantidadBaseMensual: 220, capacidadMaxMensual: 260, costoVariableUnitario: 18, fuente: 'Supuesto ficticio' },
    { id: 'sv-4', nombre: 'Endodoncia', precioBase: 150, cantidadBaseMensual: 70, capacidadMaxMensual: 90, costoVariableUnitario: 40, fuente: 'Supuesto ficticio' },
    { id: 'sv-5', nombre: 'Periodoncia', precioBase: 120, cantidadBaseMensual: 60, capacidadMaxMensual: 80, costoVariableUnitario: 30, fuente: 'Supuesto ficticio' },
    { id: 'sv-6', nombre: 'Cirugía oral', precioBase: 180, cantidadBaseMensual: 35, capacidadMaxMensual: 45, costoVariableUnitario: 45, fuente: 'Supuesto ficticio' },
    { id: 'sv-7', nombre: 'Prótesis estomatológica', precioBase: 400, cantidadBaseMensual: 28, capacidadMaxMensual: 40, costoVariableUnitario: 120, fuente: 'Supuesto ficticio' },
    { id: 'sv-8', nombre: 'Ortodoncia', precioBase: 1200, cantidadBaseMensual: 9, capacidadMaxMensual: 15, costoVariableUnitario: 300, fuente: 'Supuesto ficticio' },
    { id: 'sv-9', nombre: 'Imagenología dental', precioBase: 45, cantidadBaseMensual: 130, capacidadMaxMensual: 160, costoVariableUnitario: 8, fuente: 'Supuesto ficticio' },
  ];

  p.consumos = [
    { id: 'cn-1', concepto: 'Agua potable', unidad: 'm³/día', cantidad: 8, periodo: 'Operación', observacion: 'Supuesto ficticio' },
    { id: 'cn-2', concepto: 'Electricidad', unidad: 'kWh/día', cantidad: 320, periodo: 'Operación', observacion: 'Supuesto ficticio' },
    { id: 'cn-3', concepto: 'Portador energético (respaldo)', unidad: 'L/mes', cantidad: 120, periodo: 'Operación', observacion: 'Supuesto ficticio' },
    { id: 'cn-4', concepto: 'Residuos sólidos asimilables', unidad: 'kg/día', cantidad: 45, periodo: 'Operación', observacion: 'Supuesto ficticio' },
    { id: 'cn-5', concepto: 'Residuos biomédicos (DYMED)', unidad: 'kg/mes', cantidad: 60, periodo: 'Operación', observacion: 'Supuesto ficticio' },
  ];

  // ------------------------------------------------------------- 4.7 / 4.10
  // Inversión (kUSD): previos 45 + fija 1 200 (USD) + capital de trabajo 235 = 1 480
  p.financiero.inversion = [
    { id: 'iv-1', concepto: 'Estudios de factibilidad y gastos de constitución', categoria: 'gastos_previos', moneda: 'USD', monto: 25, vidaUtilAnios: 0, observacion: 'Ficticio' },
    { id: 'iv-2', concepto: 'Licencias, registros y autorizaciones sanitarias', categoria: 'gastos_previos', moneda: 'USD', monto: 12, vidaUtilAnios: 0, observacion: 'Ficticio' },
    { id: 'iv-3', concepto: 'Gastos de puesta en marcha y capacitación inicial', categoria: 'gastos_previos', moneda: 'USD', monto: 8, vidaUtilAnios: 0, observacion: 'Ficticio' },
    { id: 'iv-4', concepto: 'Equipamiento clínico (5 sillones e instrumental)', categoria: 'inversion_fija', moneda: 'USD', monto: 520, vidaUtilAnios: 10, observacion: 'Ficticio' },
    { id: 'iv-5', concepto: 'Equipos de imagenología dental (2)', categoria: 'inversion_fija', moneda: 'USD', monto: 180, vidaUtilAnios: 10, observacion: 'Ficticio' },
    { id: 'iv-6', concepto: 'Laboratorio de prótesis', categoria: 'inversion_fija', moneda: 'USD', monto: 95, vidaUtilAnios: 10, observacion: 'Ficticio' },
    { id: 'iv-7', concepto: 'Equipamiento de esterilización y compresores', categoria: 'inversion_fija', moneda: 'USD', monto: 85, vidaUtilAnios: 10, observacion: 'Ficticio' },
    { id: 'iv-8', concepto: 'Mobiliario clínico y de oficina', categoria: 'inversion_fija', moneda: 'USD', monto: 60, vidaUtilAnios: 8, observacion: 'Ficticio' },
    { id: 'iv-9', concepto: 'Informática y software de gestión clínica', categoria: 'inversion_fija', moneda: 'USD', monto: 35, vidaUtilAnios: 5, observacion: 'Ficticio' },
    { id: 'iv-10', concepto: 'Adecuación y montaje de instalaciones', categoria: 'inversion_fija', moneda: 'USD', monto: 180, vidaUtilAnios: 20, observacion: 'Ficticio' },
    { id: 'iv-11', concepto: 'Vehículos (ver desglose)', categoria: 'inversion_fija', moneda: 'USD', monto: 45, vidaUtilAnios: 8, observacion: 'Ficticio' },
  ];
  p.financiero.vehiculos = [
    { id: 'vh-1', tipo: 'Automóvil ligero (dirección y gestión)', cantidad: 1, montoKUSD: 25 },
    { id: 'vh-2', tipo: 'Microbús (transporte de personal y pacientes)', cantidad: 1, montoKUSD: 20 },
  ];
  p.financiero.otrosIngresos = Array.from({ length: 10 }, () => 0);

  // Crédito: 300 kUSD al 8 %, gracia 1 año, amortización 5 años (parámetros).
  // La inversión (1 480) se cubre con aportaciones (1 180) + crédito (300).
  p.parametros = parametrosPorDefecto({ creditoKUSD: 300, capitalTrabajoKUSD: 235 });
  p.reglas = reglasPorDefecto();

  // ------------------------------------------------------------- 4.8
  p.mercado = {
    caracterizacion: 'Servicios estomatológicos de calidad con estándares internacionales. Descripción ilustrativa para la demostración: la caracterización real exige estudios de mercado primary.',
    requisitosRegulatorios: 'Licencia sanitaria (MINSAP), registro de la empresa mixta (ONEI/Registro Mercantil), autorizaciones ambientales y de residuos biomédicos; requisitos de inversión extranjera (CEPEC/DAMN según corresponda). Lista ilustrativa: verificar la normativa aplicable.',
    materiasPrimas: 'Materiales odontológicos y consumibles: resinas, anestésicos, aleaciones, implantes, insumos de bioseguridad y esterilización (detalle ficticio).',
    fuentesSuministro: 'Importación vía proveedores internacionales certificados (supuesto ficticio); evaluar proveedores nacionales donde exista oferta.',
    consumoEstimado: 'Costo variable unitario por servicio precargado en la tabla de servicios (supuestos ficticios).',
    demandaAparente: 'Población servida estimada (ficticia): 240 000 habitantes; prevalencia estimada de necesidad de tratamiento: 60 % de adultos. Estimación ilustrativa no verificada.',
    demandaSolvente: 'Estimación ficticia: 38 000 personas con capacidad de pago en el área de influencia; captación objetivo del año 1: ~4 800 pacientes (~12,6 %). Supuesto no verificado.',
    metodoEstimacion: 'Método ilustrativo: estimación por referencias públicas y supuestos de captación. La aplicación exige documentar fuentes y fechas; no simula investigación de mercado real.',
    fuentesConsulta: 'Fuentes ficticias de demostración: ONEI (proyecciones demográficas ilustrativas), referencias sectoriales no verificadas.',
    ventasExportacion: 'Atención a pacientes internacionales (turismo de salud): supuesto ilustrativo, crecimiento a partir del tercer año, incluido dentro de los precios en USD de la tabla de servicios.',
    ventasDivisas: 'Los servicios se facturan en divisas según la política establecida (supuesto ficticio).',
    ventasMonedaNacional: 'Se contempla un componente de venta en moneda nacional a población nacional con capacidad de pago (supuesto ficticio a definir).',
  };

  // ------------------------------------------------------------- 4.9
  p.fuerza = {
    entidadContratante: 'Entidad empleadora autorizada (supuesto ilustrativo: la parte nacional contratante según la legislación vigente).',
  };
  p.personal = [
    // Montaje (año 0)
    { id: 'pe-m1', etapa: 'montaje', grupo: 'cubano_otro', cantidad: 6, salarioPromedioAnualCUP: 96000 },
    // Operación (años 1+)
    { id: 'pe-o1', etapa: 'operacion', grupo: 'cubano_directivo', cantidad: 3, salarioPromedioAnualCUP: 312000 },
    { id: 'pe-o2', etapa: 'operacion', grupo: 'cubano_otro', cantidad: 12, salarioPromedioAnualCUP: 264000 },
    { id: 'pe-o3', etapa: 'operacion', grupo: 'cubano_otro', cantidad: 6, salarioPromedioAnualCUP: 168000 },
    { id: 'pe-o4', etapa: 'operacion', grupo: 'cubano_otro', cantidad: 5, salarioPromedioAnualCUP: 120000 },
    { id: 'pe-o5', etapa: 'operacion', grupo: 'extranjero_directivo', cantidad: 1, salarioPromedioAnualCUP: 9600000 },
  ];

  // ------------------------------------------------------------- 4.10
  p.cronograma = [
    { id: 'cr-1', etapa: 'Preinversión y estudios', inicio: '2026-07', fin: '2026-12', observacion: 'Ficticio' },
    { id: 'cr-2', etapa: 'Ejecución (adecuación y montaje)', inicio: '2027-01', fin: '2027-09', observacion: 'Ficticio' },
    { id: 'cr-3', etapa: 'Desactivación e inicio de explotación', inicio: '2027-08', fin: '2027-10', observacion: 'Ficticio' },
    { id: 'cr-4', etapa: 'Pruebas y puesta en marcha', inicio: '2027-09', fin: '2027-10', observacion: 'Ficticio' },
    { id: 'cr-5', etapa: 'Operación comercial', inicio: '2027-11', fin: '2037-10', observacion: 'Horizonte de 10 años (ficticio)' },
  ];

  // ------------------------------------------------------------- 4.12
  p.conclusiones = {
    texto:
      'CONCLUSIONES PRELIMINARES (EJEMPLO ILUSTRATIVO): Con los supuestos ficticios precargados, el modelo financiero del ejemplo muestra utilidades después de impuestos crecientes, recuperación de la inversión en torno al cuarto año de operación y beneficios directos al país acumulados superiores al monto invertido dentro del horizonte de análisis. La plantilla demuestra la creación de 27 empleos directos en operación y la incorporación de tecnología digital. ADVERTENCIA: estas conclusiones se basan íntegramente en datos ficticios de demostración; no constituyen una evaluación de viabilidad real. Una propuesta seria exigiría validar la demanda solvente, los precios, los costos, la tasa tributaria aplicable y los requisitos legales, sanitarios y de inversión. No debe declararse viable un proyecto solo porque presente beneficios contables en un año.',
  };

  return p;
}

export const NOTA_CLINICA = ADVERTENCIA_DATOS_FICTICIOS;
