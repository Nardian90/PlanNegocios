// ============================================================================
// Plantilla «Clínica Estomatológica Sonrisa Habana» — ejemplo completo con
// datos ficticios COHERENTES entre sí (todo marcado como supuesto ilustrativo).
//
// Coherencia operativa (misión §7.3): la capacidad se deriva de los recursos
// operativos (5 gabinetes, 2 equipos de imagenología, laboratorio de prótesis
// y 12 profesionales). Con el crecimiento de demanda del 5 % anual, la
// capacidad base de gabinetes se satura hacia el año 9, por lo que el
// ESCENARIO ACTIVO ES B: una ampliación programada (+2 gabinetes, 150 kUSD)
// entra en el año 8 con su CAPEX, su depreciación y su nueva capacidad.
// Ninguna cifra de resultado está escrita aquí: todas provienen del motor.
//
// Modelo: Empresa Mixta (60 % extranjero / 40 % cubano), La Habana.
// ============================================================================

import { PlanexProject } from '../types';
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
    elaboradoPor: '【Nombre y apellidos de quien elabora】',
    cargo: 'Especialista de inversiones (ejemplo ilustrativo)',
    firmaIdentificacion: '',
    fecha: '2026-10-25',
    declaracionResponsabilidad: true,
  };

  // ------------------------------------------------------------- 4.4
  // El texto introductorio es editable por el usuario; las CIFRAS del resumen
  // se generan aparte, a partir del modelo (análisis dinámico), y se
  // actualizan solas: aquí no se fija cifra alguna de resultado.
  p.resumen = {
    introduccion:
      'Ejemplo ilustrativo de una propuesta de constitución de una empresa mixta entre un inversionista extranjero del sector de servicios de salud y una entidad nacional cubana, para la prestación de servicios estomatológicos integrales en La Habana. La propuesta contempla la rehabilitación y equipamiento de una instalación asistencial con 5 gabinetes, la incorporación de tecnologías de imagenología digital y laboratorio de prótesis, y la generación de empleo calificado. Todas las cifras de este ejemplo son datos ficticios de demostración de la aplicación: la síntesis cuantitativa del resumen se genera automáticamente desde el modelo financiero y se recalcula al cambiar cualquier parámetro o fórmula. Antes de cualquier presentación oficial deben sustituirse los supuestos y validarse las autorizaciones legales, sanitarias y tributarias aplicables.',
    notas: 'Las cifras del resumen cuantitativo provienen del modelo de cálculo activo (análisis dinámico) y se actualizan al cambiar parámetros o fórmulas.',
  };

  // ------------------------------------------------------------- 4.5
  p.negocio = {
    modalidad: 'Empresa Mixta (Ley 118/2014; Decreto-Ley 335/2018 — referencia ilustrativa a validar)',
    objetoSocial:
      'Prestación de servicios estomatológicos integrales: consulta y diagnóstico, odontología preventiva, restauraciones, endodoncia, periodoncia, cirugía oral, prótesis estomatológica, ortodoncia e imagenología dental; atención a pacientes nacionales e internacionales y servicios de laboratorio de prótesis.',
    plazoVigencia: '20 años renovables (supuesto ilustrativo)',
    fundamentacion:
      'La propuesta responde a la demanda insatisfecha de servicios estomatológicos especializados con estándares internacionales, tanto para la población nacional con capacidad de pago como para pacientes internacionales. La clínica incorpora tecnología de diagnóstico digital, esterilización de última generación y protocolos de bioseguridad, con transferencia de conocimiento al personal cubano. Texto ilustrativo: debe sustentarse en estudios reales de demanda y competencia.',
    objetivosInversion:
      'Vinculación ilustrativa con los objetivos de la Ley 118: sustitución de servicios importados por oferta nacional; generación de ingresos exportables (atención a pacientes internacionales); transferencia de tecnología; creación de empleo calificado; encadenamientos con proveedores nacionales cuando exista oferta.',
    relacionPNDES:
      'Alineación ilustrativa con el Plan Nacional de Desarrollo Económico y Social: transformación de los servicios con alto valor agregado y exportables; elevación de la calidad de vida mediante servicios de salud. (Validar la alineación real con el PNDES vigente.)',
    relacionEDT:
      'Contribución ilustrativa a la Estrategia de Desarrollo Territorial de La Habana: fortalecimiento del polo de servicios de salud y posicionamiento como destino de turismo de salud. (Validar con la EDT municipal aplicable.)',
    bienesServicios:
      'Servicios estomatológicos especializados con equipamiento digital. Nueve líneas de servicio con precios, demanda prevista, duración y recursos requeridos definidos en 4.6; el motor de cálculo limita la producción a la capacidad instalada del escenario activo. El detalle de precios y volúmenes es un supuesto ficticio precargado para demostrar el modelo.',
    mercadoInterno:
      'Demanda de la población con capacidad de pago en La Habana y municipios cercanos; convenios con entidades empleadoras para planes de atención. La demanda solvente y su captación son supuestos ilustrativos definidos en 4.8.',
    mercadoExterno:
      'Atención a pacientes internacionales (turismo de salud) mediante acuerdos con turoperadores y plataformas de reservas médicas. Supuesto ilustrativo: participación creciente a partir del tercer año.',
    reglaDistribucion:
      'Distribución de utilidades conforme a la participación en el capital social (60 % socio extranjero / 40 % socio nacional, supuesto ilustrativo), previa absorción de pérdidas acumuladas y constitución de las reservas que correspondan según la legislación vigente. El módulo de dividendos del modelo distingue utilidad contable, utilidad distribuible, dividendos propuestos y dividendos pagables según la caja disponible. (Regla a validar jurídicamente.)',
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
    experiencia: 'Entidad empleadora y prestadora de servicios de salud conforme a su objeto social vigente (dato ficticio).',
    vinculacionCuba: 'Aporta instalaciones y fuerza de trabajo calificada (supuesto ilustrativo).',
  };

  // Aportaciones (kUSD) — Extranjero 708 (60 %) + Nacional 472 (40 %) = 1 180
  p.aportaciones = [
    { id: 'ap-ex-ef', socio: 'extranjero', tipo: 'efectivo', montos: [420, 0, 0], referenciaDocumental: 'Compromiso de aporte en efectivo (supuesto ficticio; adjuntar instrumento constitutivo)' },
    { id: 'ap-ex-af', socio: 'extranjero', tipo: 'activos_fijos_tangibles', montos: [288, 0, 0], referenciaDocumental: 'Equipamiento dental e imagenología nuevos (factura proforma ilustrativa; avalúo pendiente)' },
    { id: 'ap-na-af', socio: 'nacional', tipo: 'activos_fijos_tangibles', montos: [180, 0, 0], referenciaDocumental: 'Instalaciones adecuadas y montadas (avalúo ilustrativo; comprobar documentación de Patrimonio)' },
    { id: 'ap-na-ac', socio: 'nacional', tipo: 'activos_circulantes', montos: [152, 0, 0], referenciaDocumental: 'Inventario inicial de materiales y consumibles (ilustrativo)' },
    { id: 'ap-na-ef', socio: 'nacional', tipo: 'efectivo', montos: [140, 0, 0], referenciaDocumental: 'Aporte en efectivo del socio nacional (supuesto ficticio)' },
  ];

  // ------------------------------------------------------------- 4.6
  p.tecnico = {
    caracterizacion:
      'Clínica estomatológica integral con 5 gabinetes de atención (ampliables a 7 según el escenario activo), 1 laboratorio de prótesis, 1 sala de imagenología dental (2 equipos), esterilización central con autoclaves de vacío y compresores dedicados, recepción y administración. Modelo operativo con cita programada y horario extendido (lunes a sábado). Instalación en local existente sujeto a adecuación y montaje (supuesto ilustrativo).',
    capacidadInstalada:
      'La capacidad se deriva de los recursos operativos de la tabla 4.6 (no de una cifra aislada): 5 gabinetes × 8 h/día × 288 días/año, con 5 % de mantenimiento; 2 equipos de imagenología a 6 h/día; laboratorio de prótesis a 6 h/día; y 12 profesionales a 6 h/día. Cada servicio declara su duración media y los recursos que ocupa simultáneamente; como los gabinetes y los profesionales se COMPARTEN entre líneas, el motor reparte el tiempo disponible (asignación proporcional) y limita la producción a lo realmente atendible. Escenario ACTIVO: B (ampliación) — véase la ampliación programada en la tabla de recursos.',
    plazoNiveles: 'Crecimiento de la demanda del 5 % anual desde el año 1 (supuesto ilustrativo); la ampliación de gabinetes del año 8 sostiene el crecimiento posterior.',
    tecnologiasActuales: 'Instalación base con equipamiento básico existente (dato ficticio).',
    tecnologiasNuevas: 'Radiógrafos digitales panorámicos/periapicales, sillones de última generación, autoclaves de vacío clase B, sistema de gestión clínica digital y laboratorio de prótesis CAD/CAM básico (todos supuestos ilustrativos).',
    localizacion: 'Municipio Playa, La Habana, Cuba (dirección ficticia: Calle Ejemplo e/ Ejemplo y Ejemplo, Reparto Ejemplo).',
    infraestructura: 'Red eléctrica, agua, alcantarillado, comunicaciones y acceso vial disponibles en la ubicación (supuesto ilustrativo).',
    terrenosInstalaciones: 'Local en régimen de usufructo/arrendamiento estatal con canon anual parametrizado (supuesto ficticio).',
    necesidadesConstruccion: 'Adecuación de 450 m²: climatización, red de aire comprimido, aspiración centralizada, área de esterilización y laboratorio (monto ilustrativo en la tabla de inversiones).',
    escenarioCapacidad: 'B_ampliacion',
  };

  // Recursos operativos (misión §7.2): la capacidad nace de aquí.
  p.recursos = [
    {
      id: 're-gab',
      nombre: 'Gabinetes de atención (sillones)',
      tipo: 'gabinete',
      cantidad: 5,
      horasDia: 8,
      diasAnio: 288,
      pctMantenimiento: 0.05,
      anioDisponible: 1,
      expansiones: [
        { id: 'ex-gab-1', anio: 7, cantidad: 2, costoKUSD: 150, vidaUtilAnios: 10, observacion: 'Ampliación programada del escenario B: 2 gabinetes adicionales con equipamiento (supuesto ficticio). Entra en el año 7, cuando la utilización de la base llega a su máximo.' },
      ],
      observacion: 'Sillones/posiciones compartidos por todas las líneas clínicas (supuesto ficticio).',
    },
    {
      id: 're-img',
      nombre: 'Equipos de imagenología dental',
      tipo: 'equipo',
      cantidad: 2,
      horasDia: 6,
      diasAnio: 288,
      pctMantenimiento: 0.1,
      anioDisponible: 1,
      expansiones: [],
      observacion: 'Radiografía panorámica/periapical (supuesto ficticio).',
    },
    {
      id: 're-lab',
      nombre: 'Laboratorio de prótesis',
      tipo: 'local',
      cantidad: 1,
      horasDia: 6,
      diasAnio: 288,
      pctMantenimiento: 0.05,
      anioDisponible: 1,
      expansiones: [],
      observacion: 'Posición de trabajo del laboratorio (supuesto ficticio).',
    },
    {
      id: 're-prof',
      nombre: 'Profesionales estomatológicos',
      tipo: 'profesional',
      cantidad: 12,
      horasDia: 6,
      diasAnio: 288,
      pctMantenimiento: 0.05,
      anioDisponible: 1,
      expansiones: [],
      observacion: 'Estomatólogos e higienistas; el personal de administración no limita la capacidad clínica (supuesto ficticio).',
    },
  ];

  // Servicios: demanda prevista (ficticia), duración media y recursos que ocupa
  // cada procedimiento. capacidadMaxMensual = 0: sin tope técnico directo;
  // el límite real lo imponen los recursos compartidos del escenario activo.
  p.servicios = [
    { id: 'sv-1', nombre: 'Consulta estomatológica', precioBase: 25, cantidadBaseMensual: 400, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 6, duracionMinutos: 30, recursoIds: ['re-gab', 're-prof'], fuente: 'Supuesto ficticio (estudio de precios ilustrativo)' },
    { id: 'sv-2', nombre: 'Odontología preventiva (profilaxis y sellado)', precioBase: 35, cantidadBaseMensual: 160, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 10, duracionMinutos: 40, recursoIds: ['re-gab', 're-prof'], fuente: 'Supuesto ficticio' },
    { id: 'sv-3', nombre: 'Restauraciones (obturaciones)', precioBase: 60, cantidadBaseMensual: 220, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 18, duracionMinutos: 45, recursoIds: ['re-gab', 're-prof'], fuente: 'Supuesto ficticio' },
    { id: 'sv-4', nombre: 'Endodoncia', precioBase: 150, cantidadBaseMensual: 70, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 40, duracionMinutos: 60, recursoIds: ['re-gab', 're-prof'], fuente: 'Supuesto ficticio' },
    { id: 'sv-5', nombre: 'Periodoncia', precioBase: 120, cantidadBaseMensual: 60, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 30, duracionMinutos: 50, recursoIds: ['re-gab', 're-prof'], fuente: 'Supuesto ficticio' },
    { id: 'sv-6', nombre: 'Cirugía oral', precioBase: 180, cantidadBaseMensual: 35, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 45, duracionMinutos: 60, recursoIds: ['re-gab', 're-prof'], fuente: 'Supuesto ficticio' },
    { id: 'sv-7', nombre: 'Prótesis estomatológica', precioBase: 400, cantidadBaseMensual: 28, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 120, duracionMinutos: 90, recursoIds: ['re-lab', 're-prof'], fuente: 'Supuesto ficticio' },
    { id: 'sv-8', nombre: 'Ortodoncia', precioBase: 1200, cantidadBaseMensual: 9, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 300, duracionMinutos: 90, recursoIds: ['re-gab', 're-prof'], fuente: 'Supuesto ficticio' },
    { id: 'sv-9', nombre: 'Imagenología dental', precioBase: 45, cantidadBaseMensual: 130, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 8, duracionMinutos: 20, recursoIds: ['re-img', 're-prof'], fuente: 'Supuesto ficticio' },
  ];

  p.consumos = [
    { id: 'cn-1', concepto: 'Agua potable', unidad: 'm³/día', cantidad: 8, periodo: 'Operación', observacion: 'Supuesto ficticio' },
    { id: 'cn-2', concepto: 'Electricidad', unidad: 'kWh/día', cantidad: 320, periodo: 'Operación', observacion: 'Supuesto ficticio' },
    { id: 'cn-3', concepto: 'Portador energético (respaldo)', unidad: 'L/mes', cantidad: 120, periodo: 'Operación', observacion: 'Supuesto ficticio' },
    { id: 'cn-4', concepto: 'Residuos sólidos asimilables', unidad: 'kg/día', cantidad: 45, periodo: 'Operación', observacion: 'Supuesto ficticio' },
    { id: 'cn-5', concepto: 'Residuos biomédicos (DYMED)', unidad: 'kg/mes', cantidad: 60, periodo: 'Operación', observacion: 'Supuesto ficticio' },
  ];

  // ------------------------------------------------------------- 4.7 / 4.10
  // Inversión (kUSD): previos 45 + fija 1 200 (USD) + capital de trabajo 235 = 1 480.
  // Año de disponibilidad 1 para todos los activos: la depreciación del año 0
  // es CERO (el defecto de depreciar en montaje quedó corregido).
  p.financiero.inversion = [
    { id: 'iv-1', concepto: 'Estudios de factibilidad y gastos de constitución', categoria: 'gastos_previos', moneda: 'USD', monto: 25, vidaUtilAnios: 0, anioDisponible: 0, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio. No incluye el personal de montaje (que se paga como gasto del año 0).' },
    { id: 'iv-2', concepto: 'Licencias, registros y autorizaciones sanitarias', categoria: 'gastos_previos', moneda: 'USD', monto: 12, vidaUtilAnios: 0, anioDisponible: 0, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
    { id: 'iv-3', concepto: 'Gastos de puesta en marcha (trámites, capacitación formal, materiales de prueba)', categoria: 'gastos_previos', moneda: 'USD', monto: 8, vidaUtilAnios: 0, anioDisponible: 0, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio. Sin doble contabilización: la nómina de montaje se registra como costo del año 0.' },
    { id: 'iv-4', concepto: 'Equipamiento clínico (5 sillones e instrumental)', categoria: 'inversion_fija', moneda: 'USD', monto: 520, vidaUtilAnios: 10, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
    { id: 'iv-5', concepto: 'Equipos de imagenología dental (2)', categoria: 'inversion_fija', moneda: 'USD', monto: 180, vidaUtilAnios: 10, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
    { id: 'iv-6', concepto: 'Laboratorio de prótesis', categoria: 'inversion_fija', moneda: 'USD', monto: 95, vidaUtilAnios: 10, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
    { id: 'iv-7', concepto: 'Equipamiento de esterilización y compresores', categoria: 'inversion_fija', moneda: 'USD', monto: 85, vidaUtilAnios: 10, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
    { id: 'iv-8', concepto: 'Mobiliario clínico y de oficina', categoria: 'inversion_fija', moneda: 'USD', monto: 60, vidaUtilAnios: 8, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
    { id: 'iv-9', concepto: 'Informática y software de gestión clínica', categoria: 'inversion_fija', moneda: 'USD', monto: 35, vidaUtilAnios: 5, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
    { id: 'iv-10', concepto: 'Adecuación y montaje de instalaciones', categoria: 'inversion_fija', moneda: 'USD', monto: 180, vidaUtilAnios: 20, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio (quedará valor neto en libros al cierre del horizonte; el diagnóstico lo señala).' },
    { id: 'iv-11', concepto: 'Vehículos (ver desglose)', categoria: 'inversion_fija', moneda: 'USD', monto: 45, vidaUtilAnios: 8, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: 'Ficticio' },
  ];
  p.financiero.vehiculos = [
    { id: 'vh-1', tipo: 'Automóvil ligero (dirección y gestión)', cantidad: 1, montoKUSD: 25 },
    { id: 'vh-2', tipo: 'Microbús (transporte de personal y pacientes)', cantidad: 1, montoKUSD: 20 },
  ];
  p.financiero.otrosIngresos = Array.from({ length: 10 }, () => 0);

  // Crédito: 300 kUSD al 8 %, desembolso en el año 0, gracia de principal
  // 1 año, amortización por capital constante en 5 años.
  p.financiero.deuda = {
    habilitada: true,
    anioDesembolso: 0,
    tipoGracia: 'principal',
    metodo: 'capital_constante',
    fuente: 'Supuesto ficticio: crédito externo de demostración. Documentar contrato real antes de un uso oficial.',
  };
  p.parametros = parametrosPorDefecto({ creditoKUSD: 300, capitalTrabajoKUSD: 235 });
  p.reglas = reglasPorDefecto();

  // ------------------------------------------------------------- 4.8
  p.mercado = {
    caracterizacion: 'Servicios estomatológicos de calidad con estándares internacionales. Descripción ilustrativa para la demostración: la caracterización real exige estudios de mercado primarios.',
    requisitosRegulatorios: 'Licencia sanitaria (MINSAP), registro de la empresa mixta (Registro Mercantil), autorizaciones ambientales y de residuos biomédicos; requisitos de inversión extranjera (CEPEC/DAMN según corresponda). Lista ilustrativa: verificar la normativa aplicable y su estado de cumplimiento antes de la presentación.',
    materiasPrimas: 'Materiales odontológicos y consumibles: resinas, anestésicos, aleaciones, implantes, insumos de bioseguridad y esterilización (detalle ficticio).',
    fuentesSuministro: 'Importación vía proveedores internacionales certificados (supuesto ficticio); evaluar proveedores nacionales donde exista oferta.',
    consumoEstimado: 'Costo variable unitario por servicio precargado en la tabla de servicios (supuestos ficticios).',
    demandaAparente: 'Supuesto ilustrativo: población servida estimada de 240 000 habitantes y prevalencia de necesidad de tratamiento del 60 % de adultos. Estimación NO verificada: una propuesta real debe aportar fuentes con fecha.',
    demandaSolvente: 'Supuesto ilustrativo: 38 000 personas con capacidad de pago en el área de influencia; captación objetivo del año 1 en torno al 12 %. Supuesto NO verificado.',
    metodoEstimacion: 'Método ilustrativo por referencias públicas y supuestos de captación. La aplicación exige documentar fuentes y fechas; no simula investigación de mercado real.',
    fuentesConsulta: 'Fuentes ficticias de demostración: proyecciones demográficas ilustrativas y referencias sectoriales no verificadas.',
    ventasExportacion: 'Atención a pacientes internacionales (turismo de salud): supuesto ilustrativo, crecimiento a partir del tercer año, incluido dentro de los precios en USD de la tabla de servicios (los ingresos en divisas deben desglosarse por canales sin duplicar operaciones).',
    ventasDivisas: 'Los servicios se facturan en divisas según la política establecida (supuesto ficticio a definir).',
    ventasMonedaNacional: 'Se contempla un componente de venta en moneda nacional a población nacional con capacidad de pago (supuesto ficticio a definir).',
  };

  // ------------------------------------------------------------- 4.9
  p.fuerza = {
    entidadContratante: 'Entidad empleadora autorizada (supuesto ilustrativo: la parte nacional contratante según la legislación vigente).',
  };
  p.personal = [
    // Montaje (año 0): personal transitorio de ejecución. Su nómina es gasto
    // del año 0 (no está en gastos previos: sin doble contabilización).
    { id: 'pe-m1', etapa: 'montaje', grupo: 'cubano_otro', cantidad: 6, salarioPromedioAnualCUP: 96000 },
    // Operación (años 1+): plantilla estable.
    { id: 'pe-o1', etapa: 'operacion', grupo: 'cubano_directivo', cantidad: 3, salarioPromedioAnualCUP: 312000 },
    { id: 'pe-o2', etapa: 'operacion', grupo: 'cubano_otro', cantidad: 12, salarioPromedioAnualCUP: 264000 },
    { id: 'pe-o3', etapa: 'operacion', grupo: 'cubano_otro', cantidad: 6, salarioPromedioAnualCUP: 168000 },
    { id: 'pe-o4', etapa: 'operacion', grupo: 'cubano_otro', cantidad: 5, salarioPromedioAnualCUP: 120000 },
    { id: 'pe-o5', etapa: 'operacion', grupo: 'extranjero_directivo', cantidad: 1, salarioPromedioAnualCUP: 9600000 },
  ];

  // ------------------------------------------------------------- 4.10
  p.cronograma = [
    { id: 'cr-1', etapa: 'Preinversión y estudios', inicio: '2026-07', fin: '2026-12', observacion: 'Ficticio' },
    { id: 'cr-2', etapa: 'Licencias y autorizaciones', inicio: '2026-10', fin: '2027-03', observacion: 'Ficticio. La operación no puede comenzar sin las licencias resueltas.' },
    { id: 'cr-3', etapa: 'Ejecución (adecuación y montaje)', inicio: '2027-01', fin: '2027-09', observacion: 'Ficticio' },
    { id: 'cr-4', etapa: 'Instalación de equipos y pruebas', inicio: '2027-08', fin: '2027-10', observacion: 'Ficticio' },
    { id: 'cr-5', etapa: 'Puesta en marcha y apertura', inicio: '2027-10', fin: '2027-11', observacion: 'Ficticio' },
    { id: 'cr-6', etapa: 'Operación comercial', inicio: '2027-11', fin: '2037-10', observacion: 'Horizonte de 10 años (ficticio)' },
    { id: 'cr-7', etapa: 'Ampliación de capacidad (+2 gabinetes, escenario B)', inicio: '2033-06', fin: '2033-10', observacion: 'Ficticio. Año 7 de la proyección, cuando la utilización de la base alcanza su máximo; su retraso desplaza la capacidad y los ingresos asociados.' },
  ];

  // ------------------------------------------------------------- 4.12
  // Sin cifras precocinadas: las conclusiones cuantitativas las genera el
  // análisis dinámico a partir del modelo; este texto solo declara el marco.
  p.conclusiones = {
    texto:
      'CONCLUSIONES (marco de lectura del ejemplo ilustrativo): la síntesis cuantitativa de este apartado se GENERA a partir del modelo de cálculo activo y acompaña a este texto en la vista documental y en el PDF; no está escrita de antemano y se recalcula con cada cambio de datos, parámetros o fórmulas. En consecuencia, el lector debe interpretar la inversión, los ingresos, la utilidad, la recuperación de la inversión total y del capital aportado, los dividendos y los beneficios directos al país a partir de la sección «Conclusiones (análisis dinámico)», no de este párrafo. ADVERTENCIA: este ejemplo se basa íntegramente en datos ficticios de demostración y no constituye una evaluación de viabilidad real. Una propuesta seria exige validar la demanda solvente, los precios, los costos, la tasa tributaria aplicable, las licencias sanitarias y los requisitos legales y de inversión, y debe reconocer expresamente cualquier limitación pendiente que el diagnóstico del modelo señale.',
  };

  return p;
}

export const NOTA_CLINICA =
  'EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS. No constituye una propuesta aprobada ni acredita el cumplimiento de requisitos legales, tributarios, sanitarios o de inversión. Validar las cifras, supuestos, autorizaciones y requisitos aplicables antes de su presentación oficial.';
