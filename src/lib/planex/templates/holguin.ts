// ============================================================================
// PLANEX-DATA-001 — Plantilla «Centro Estomatológico Internacional Holguín».
//
// Proyecto REAL construido exclusivamente con datos del expediente (ZIP
// «Planex.zip», 9 fuentes inventariadas con huella SHA-256). Cada dato
// cita su entrada del registro de información fidedigna (H-###), su fuente
// (F##) y su localizador. Las contradicciones del expediente PERMANECEN
// VISIBLES (no se resuelven en silencio) y los campos sin evidencia quedan
// marcados como PENDIENTES con rótulo profesional.
//
// Decisiones documentadas de modelado (todas reversibles desde la app):
//  · Moneda de presentación: CUP. Tipo de cambio 120 CUP/USD (H-025:
//    lista de precios CSMC y F09); la tasa 24 de los encabezados del
//    expediente queda registrada como contradicción crítica C-01.
//  · Motor en kUSD nativo: precios de servicios en USD (F09/Tabla 4),
//    insumos y equipos a su costo real en USD de las cotizaciones.
//  · SIN capacidad inventada (B-10): no hay horas/duraciones documentadas,
//    la demanda prevista circula y el diagnóstico lo marca.
//  · SIN montaje salarial en el año 0 (tratamiento de la preapertura sin
//    aclarar en el expediente, B-11/B-27).
//  · Impuesto 15 % solo en años 8–10: patrón del expediente (H-033) con
//    base legal pendiente (B-16).
// ============================================================================

import { PlanexProject, Parametro, Regla } from '../types';
import { parametrosPorDefecto, reglasPorDefecto } from '../templates/reglas';
import { crearProyectoBase } from '../model/factory';

// ---------------------------------------------------------------------------
// Constantes derivadas del registro (fórmulas conservadas)
// ---------------------------------------------------------------------------

/**
 * Costo variable unitario por servicio = precio × FACTOR_MATERIALES.
 * FACTOR_MATERIALES = 127 162,60 USD (consumo material anual del expediente:
 * cotización de 6 meses 63 581,30 × 2) ÷ 115 814,00 USD (ingresos anuales
 * a precios de lista). Convención EDITABLE y provisional (H-040, brecha
 * B-13): preserva el total documentado sin inventar consumos por línea.
 */
const FACTOR_MATERIALES = 127162.6 / 115814.0; // 1,09805

/**
 * Salario cubano derivado: la estructura relativa de la plantilla del
 * expediente (H-090: 126 000 CUP/mes para 9 plazas) escalada para alcanzar
 * el costo salarial total del EERR (H-035: 4 080 kCUP/año cubanos). El
 * directivo extranjero queda a su valor documentado (20 000 CUP/mes).
 */
const FACTOR_SALARIO_CUBANO = (4080000 / 12) / 126000; // 2,6984…

/** Conveniencia: costo unitario provisional del servicio (H-040). */
const costoUnitario = (precioUSD: number) => Number((precioUSD * FACTOR_MATERIALES).toFixed(2));

export function crearProyectoHolguin(): PlanexProject {
  const p = crearProyectoBase('holguin');

  p.nombre = 'Centro Estomatológico Internacional Holguín — Plan de Negocios (expediente documental, evaluación preliminar)';
  p.ajustes.horizonteAnios = 10;
  p.ajustes.monedaPresentacion = 'CUP';

  // ------------------------------------------------------------- 4.1 / 4.2
  p.titulo = {
    nombreProyecto: 'Centro Estomatológico Internacional Holguín',
    denominacionPropuesta:
      'Contrato de Asociación Económica Internacional entre Comercializadora de Servicios Médicos Cubanos, S.A. (CSMC, S.A.) y Leisure Exporting LLC para la comercialización y prestación de servicios de estomatología y bienes asociados en la provincia de Holguín',
  };
  p.general = {
    elaboradoPor: '[Pendiente: nombre y apellidos de quien elabora — brecha B-01]',
    cargo: '[Pendiente: cargo del elaborador — brecha B-01]',
    firmaIdentificacion: '',
    fecha: '',
    declaracionResponsabilidad: false,
  };

  // ------------------------------------------------------------- 4.4
  p.resumen = {
    introduccion:
      'Propuesta de Asociación Económica Internacional (AEI) entre la Comercializadora de Servicios Médicos Cubanos, S.A. (CSMC, S.A.) y Leisure Exporting LLC (Estados Unidos) para la comercialización y prestación de servicios de estomatología y bienes asociados por profesionales y técnicos cubanos altamente calificados en un Centro Internacional Estomatológico de alta tecnología en la provincia de Holguín, así como la capacitación profesional, con acceso a nuevos mercados en América Latina, Centroamérica y el Caribe (contrato de AEI, fuente F01). La inversión documentada comprende cinco equipos de tecnología estomatológica cotizados por 5 274,00 USD y gastos previos de preoperación por 26,20 miles de CUP aportados por CSMC; la operación proyecta 15 líneas de servicio con una demanda prevista de 115 814,00 USD anuales a precios de lista. Las cifras cuantitativas del resumen se generan desde el modelo de cálculo activo y se recalculan con cada cambio de datos. ESTADO DOCUMENTAL: evaluación preliminar — el expediente contiene contradicciones críticas sin resolver (tasa de cambio 24 frente a 120 en el propio modelo, depreciación mal cargada en el estado de resultados del expediente, tres versiones de salarios) cuya resolución corresponde al promotor y condiciona los resultados; ninguna cifra del modelo del expediente se presenta aquí como validada.',
    notas: 'Cifras del resumen: modelo activo (dinámicas). Fuente documental de cada dato: registro H-### (véase la sección «Expediente documental»).',
  };

  // ------------------------------------------------------------- 4.5
  p.negocio = {
    modalidad:
      'Contrato de Asociación Económica Internacional (AEI) — unión temporal de las partes, sin personalidad jurídica (Ley 118/2014 y Decreto 325/2014, invocadas por el contrato; registro H-009). La aprobación de la constitución de la AEI por la autoridad competente y su inscripción en el Registro Mercantil son validaciones pendientes (V-01, V-02).',
    objetoSocial:
      'Comercialización y prestación de servicios de estomatología y bienes asociados por profesionales y técnicos cubanos altamente calificados en un Centro Internacional Estomatológico de alta tecnología en la provincia de Holguín, así como capacitación profesional, enfocada a la mejora continua, con la utilización de alta tecnología que permita el acceso a nuevos mercados en América Latina, Centroamérica y el Caribe (texto del contrato, fuente F01, cláusula 1; registro H-010).',
    plazoVigencia:
      'Diez (10) años contados desde la inscripción de la Escritura Pública en el Registro Mercantil, con evaluación en 2034 para valorar una prórroga de diez años más (contrato F01, cláusula de vigencia; valoración F02; registro H-012). El modelo del expediente proyecta diez años de operación (2026–2035 en su calendario).',
    fundamentacion:
      '[Pendiente: fundamentación formal con la vinculación expresa al Plan Nacional de Desarrollo Económico y Social y a la Estrategia de Desarrollo Territorial de Holguín — brecha B-26.] Contexto documentado del expediente: las enfermedades bucodentales afectan a casi 3 500 millones de personas y la caries dental no tratada es el trastorno de salud más frecuente (Global Burden of Disease Study 2019, citado por la valoración F02); el proyecto se propone convertir a Cuba en destino competitivo para la salud bucal aprovechando la reputación histórica de los servicios estomatológicos de Holguín, recuperar sus instalaciones deterioradas (dos servicios suspendidos y prótesis al 75 % de capacidad por afectaciones tecnológicas, registros H-061 a H-066) e introducir tecnologías de rehabilitación protésica digital, cirugía guiada, medicina regenerativa, telemedicina y ortodoncia digital personalizada (F02).',
    objetivosInversion:
      'Rehabilitar los servicios estomatológicos de la provincia; incorporar y mantener nuevas tecnologías, equipamientos, piezas de repuesto, instrumental, medicamentos, materiales gastables e insumos desechables; capacitar a los recursos humanos y ofertar atención estomatológica de alta profesionalidad a nivel internacional como exportación de servicios (objetivos específicos de la valoración F02).',
    relacionPNDES: '[Pendiente: alineación con el PNDES vigente — brecha B-26.]',
    relacionEDT: '[Pendiente: alineación con la Estrategia de Desarrollo Territorial de Holguín — brecha B-26.]',
    bienesServicios:
      'Quince líneas de servicio con precios de la lista de CSMC (en CUP, equivalentes a precios en USD según la propia tabla del expediente) y demanda mensual prevista documentadas en 4.6: tratamientos pulporadiculares, obturaciones de resina y de amalgama, profilaxis con ultrasonido, prótesis, exodoncia, resedimentado de corona, corona y espiga acrílica, pulpotomía, drenaje de absceso, reparación de prótesis, cura de óxido de zinc, radiografía, corona acrílica y blanqueamientos (registros H-037 y H-060). La cartera narrativa del expediente incluye además examen estomatológico, odontopediatría, odontogeriatría, ortodoncia, periodoncia, imagenología, esterilización y estética (blanqueamientos, cirugías, carillas).',
    mercadoInterno:
      '[Pendiente: análisis del mercado interno — brecha B-24.] Contexto documentado: la demanda actual presenta servicios represados (73 pacientes de blanqueamiento rechazados en el quinquenio y prótesis operando al 75 % de su capacidad, registro H-062/H-063), pero el expediente no aporta demanda aparente ni solvente.',
    mercadoExterno:
      '[Pendiente: análisis del mercado externo y estrategia de comercialización — brechas B-24 y B-25.] El objeto contractual declara como propósito el acceso a nuevos mercados en América Latina, Centroamérica y el Caribe (H-010), y el balance financiero externo del expediente computa la totalidad de los ingresos como exportaciones, pero no existe estudio de mercado ni plan comercial adjunto.',
    reglaDistribucion:
      'El contrato pacta la distribución de los beneficios económicos en proporción paritaria del cincuenta por ciento (50 %) para cada parte (F01, cláusula 7.5; registro H-013), pago anual en USD tras certificación de los estados financieros. INCOHERENCIA REGISTRADA (C-05): la tabla de aportaciones del expediente declara participaciones del 49 % (cubana) y 51 % (extranjera) sin conciliar con el reparto paritario; brecha B-04 pendiente de decisión de las partes. El modelo aplica el reparto pactado 50/50.',
  };
  p.inversionistaExtranjero = {
    nombre: 'Leisure Exporting LLC',
    domicilio:
      'Constituida bajo las leyes de los Estados Unidos de América. Domicilio según el contrato: 3964 South Cir Largo, Florida 37774 (F01). [Contradicción C-09: la cotización consigna 6800 N Ave., Tampa, Florida 33604 — acreditación registral pendiente, brecha B-05.]',
    identificacionFiscal: 'Registro núm. L23000147130; Acta de Protocolización núm. 897 de 13 de septiembre de 2024, Lic. Ivett Irinia González, Notaria de La Habana (F01; registro H-006).',
    experiencia: '[Pendiente: experiencia en la rama y vínculos con el mercado cubano — brecha B-05.]',
    vinculacionCuba:
      'Representada por Yovannis Camilo Domínguez Fornaris, Manager y Representante Legal (F01; H-007). Cotiza y aportará los equipos e insumos del proyecto (cotizaciones F03 y F06).',
  };
  p.inversionistaNacional = {
    nombre: 'Comercializadora de Servicios Médicos Cubanos, S.A. (CSMC, S.A.)',
    domicilio:
      'Calle 44, número 502, entre 5ta Avenida y 5ta A, municipio Playa, provincia La Habana, República de Cuba (F01; registro H-004). [Pendiente: uniformar la abreviatura oficial — contradicción C-10: el expediente alterna SMC / CSMC / CMSM.]',
    identificacionFiscal:
      'Escritura Notarial núm. 366 de 11 de octubre de 2011, con modificación estatuaria por Escritura núm. 394 de 17 de septiembre de 2015; Registro Mercantil de La Habana, Libro de Sociedades de Capital Totalmente Cubano, Tomo XXVIII, Folio 120, Hoja 38, Inscripción Primera (13 de octubre de 2011); código ONEI 60598; licencia para operar en divisas G1199680001; NIT 30001869140 (F01; H-004).',
    experiencia: 'Sociedad mercantil de capital totalmente cubano dedicada a la comercialización de servicios médicos (F01). [Pendiente: objeto social vigente y experiencia específica en estomatología.]',
    vinculacionCuba: 'Aportará el derecho real de usufructo del inmueble del Centro en Holguín, efectivo para la preapertura (salarios y arrendamiento) y la gestión registral, sanitaria y de contratación del proyecto (F01, cláusulas 1.2, 7 y 8.1).',
  };

  // Aportaciones (kUSD) — valores de las cotizaciones y de la tabla de
  // aportaciones del expediente (H-026 a H-028). El efectivo cubano se
  // convierte a kUSD con el tipo de cambio del modelo (120, H-025); las
  // aportaciones en especie a su costo real en USD.
  p.aportaciones = [
    {
      id: 'ap-cu-ef',
      socio: 'nacional',
      tipo: 'efectivo',
      montos: [1600 / 120, 0, 0],
      referenciaDocumental:
        'Efectivo de CSMC: 1 600,0 miles de CUP (H-026; F02/F08 p. 1) = 13,33 kUSD a la tasa 120 del modelo (H-025). Destino documentado: salarios de preapertura y arrendamiento en preapertura y primeros 6 meses (F02). [El expediente lo expresa como 66,7 «USD» usando su tasa 24: véase C-01.]',
    },
    {
      id: 'ap-ex-ac',
      socio: 'extranjero',
      tipo: 'activos_circulantes',
      montos: [63581.3 / 1000, 0, 0],
      referenciaDocumental:
        'Insumos y material gastable (stock de 6 meses): cotización F03, total 63 581,30 USD (H-027/H-029) = 1 526,0 miles de CUP a la tasa 24 que declara el expediente (conciliado).',
    },
    {
      id: 'ap-ex-af',
      socio: 'extranjero',
      tipo: 'activos_fijos_tangibles',
      montos: [5.274, 0, 0],
      referenciaDocumental:
        'Cinco equipos de tecnología estomatológica: cotización F06, total 5 274,00 USD (H-021) = 126,6 miles de CUP a la tasa 24 del expediente. [El escáner intraoral 3D cotizado en F02 (12 035,00 USD) NO está incluido: decisión pendiente, contradicción C-08 / brecha B-07.]',
    },
  ];

  // ------------------------------------------------------------- 4.6
  p.tecnico = {
    caracterizacion:
      'Centro estomatológico internacional que operará sobre la instalación existente del Departamento de Estomatología de la Sucursal Holguín de SMC, con dos gabinetes dentales completos en buen estado, un laboratorio de prótesis (banco de prótesis y prensa hidráulica en uso), esterilización (autoclave de mesa de 40 L en estado regular), un equipo de rayos X estomatológico INOPERATIVO (monitor roto), un compresor de 200 L con aceite en estado regular (no conforme: el uso estomatológico exige compresor seco), un láser terapéutico y de blanqueamiento con 12 puntas, climatización, informática y mobiliario de espera y consulta (inventario de 42 medios, fuente F04; registros H-065, H-066, H-068). El expediente no aporta superficies ni distribución de áreas. [Pendiente: dirección exacta y soportes gráficos — brecha B-08.]',
    capacidadInstalada:
      'SIN ESTUDIO DE CAPACIDAD DOCUMENTADO (brecha B-10): el expediente no aporta horas de utilización por recurso, duración media por procedimiento ni calendario de atención. La plantilla NO INVENTA capacidad: la tabla de recursos queda vacía y la demanda prevista de la tabla de servicios circula sin límite técnico; el diagnóstico de la app marca esta ausencia en cada recálculo. La dotación existente documentada (2 gabinetes, 1 posición de imagenología inoperativa, 1 banco de prótesis y 10 trabajadores) no permite derivar capacidad sin los datos de utilización. [Pendiente: cronometrajes y calendario para limitar la producción por capacidad real.]',
    plazoNiveles:
      'La valoración del expediente recomienda construir el estudio de factibilidad con las estadísticas de 2019 como año pre-crisis para «reflejar cifras aún más sustanciales» (F02) — es decir, la demanda prevista de la tabla (año 1) se reconoce como base conservadora. [Pendiente: proyección de niveles de producción y su plazo — brechas B-10 y B-24.]',
    tecnologiasActuales:
      'Equipamiento existente deteriorado (F04/F09; registros H-064 a H-066): motor de baja «híbrido producto de una innovación de baja calidad» en prótesis; prensa hidráulica antigua (proceso más largo que el protocolizado, casos repetidos por afectación de la dimensión vertical); correcciones sin micromotor de mano (con roturas frecuentes de la pieza de mano); sin eliminador de burbujas (calidad de prótesis afectada); cocción de prótesis en microondas por no disponer de olla polimerizadora a presión; equipo de rayos X con monitor roto; compresor con aceite no conforme. Desabastecimiento general de los renglones del cuadro básico (71 renglones, H-067).',
    tecnologiasNuevas:
      'Cinco equipos aportados por el inversionista (cotización F06; justificación de F09, registro H-069): compresor de aire seco para uso estomatológico (3 885,00 USD), prensa hidráulica nueva (413,00 USD), micromotor de mano (284,00 USD), eliminador de burbujas (290,00 USD) y olla polimerizadora a presión (402,00 USD). Con ellos se recuperan dos servicios suspendidos (radiografía y blanqueamientos — este último por insumos), se modernizan dos procesos de prótesis y se incorpora tecnología nueva. [Pendientes: monitor del equipo de rayos X, sin cotizar (B-09); escáner intraoral 3D cotizado pero no decidido (C-08/B-07); limas de endodoncia para TPR (B-20).]',
    localizacion:
      'Provincia de Holguín, Cuba (contrato y valoración; registro H-011). [Pendiente: dirección del inmueble — en blanco en el contrato —, características del local e infraestructura disponible; brechas B-06 y B-08.]',
    infraestructura: '[Pendiente: infraestructura disponible (electricidad, agua, comunicaciones) — brecha B-08.]',
    terrenosInstalaciones:
      'Inmueble de la Sucursal Holguín aportado en derecho real de usufructo durante la vigencia del contrato (F01, cláusula 1.2). [Pendiente: identificación del inmueble, avalúo y certificado de la Dirección de Patrimonio — brecha B-06.]',
    necesidadesConstruccion:
      '[Pendiente: presupuesto y alcance de las obras de remodelación del Centro que el contrato encarga a CSMC (cláusula 8.1 b)] — el modelo de inversión del expediente presupuesta 0,00 para construcción y montaje (H-020). Brecha B-27.',
    escenarioCapacidad: 'A_constante',
  };

  p.recursos = [];
  p.consumos = [];

  // Servicios: 15 líneas documentadas (H-037). Precio en USD (= CUP ÷ 120,
  // confirmado por F09 en TPR y blanqueamientos); demanda mensual prevista
  // de la tabla del expediente; costo variable provisional por la convención
  // de reparto de materiales (H-040, brecha B-13) — EDITABLE.
  // Sin duraciones ni recursos (B-10): nada inventado.
  const svc = (
    id: string,
    nombre: string,
    precioUSD: number,
    cantidad: number,
    fuente: string
  ): PlanexProject['servicios'][number] => ({
    id,
    nombre,
    precioBase: precioUSD,
    cantidadBaseMensual: cantidad,
    anioInicioDemanda: 1,
    capacidadMaxMensual: 0,
    costoVariableUnitario: costoUnitario(precioUSD),
    duracionMinutos: 0,
    recursoIds: [],
    fuente,
    canal: 'exportacion',
  });

  p.servicios = [
    svc('sv-h01', 'Tratamientos pulporadiculares (TPR)', 80.0, 3,
      'H-037 (F02 Tabla 4 / F08 p. 23: 9 600,00 CUP = 80,00 USD; 3/mes). Servicio hoy suspendido por limas y rayos X (H-061): se proyecta su recuperación. [Pendiente: monitor Rx (B-09) y limas (B-20).]'),
    svc('sv-h02', 'Obturaciones de resina', 20.0, 15,
      'H-037 (2 400,00 CUP = 20,00 USD; 15/mes).'),
    svc('sv-h03', 'Obturaciones de amalgamas', 15.0, 15,
      'H-037 (1 800,00 CUP = 15,00 USD; 15/mes).'),
    svc('sv-h04', 'Profilaxis con ultrasonido', 50.0, 10,
      'H-037 (6 000,00 CUP = 50,00 USD; 10/mes).'),
    svc('sv-h05', 'Prótesis', 23236 / 120, 15,
      'H-037 (23 236,00 CUP = 193,6333 USD; 15/mes). Servicio principal según F09 (H-063: ~50 000 USD/año de ingreso promedio histórico; hoy al 75 % por tecnología afectada).'),
    svc('sv-h06', 'Exodoncia', 14900 / 120, 10,
      'H-037 (14 900,00 CUP = 124,1667 USD; 10/mes).'),
    svc('sv-h07', 'Resedimentado de corona', 25.0, 5,
      'H-037 (3 000,00 CUP = 25,00 USD; 5/mes).'),
    svc('sv-h08', 'Corona y espiga acrílica', 80.0, 5,
      'H-037 (9 600,00 CUP = 80,00 USD; 5/mes).'),
    svc('sv-h09', 'Pulpotomía', 30.0, 3,
      'H-037 (3 600,00 CUP = 30,00 USD; 3/mes).'),
    svc('sv-h10', 'Drenaje de absceso', 30.0, 5,
      'H-037 (3 600,00 CUP = 30,00 USD; 5/mes).'),
    svc('sv-h11', 'Reparación de prótesis', 20.0, 5,
      'H-037 (2 400,00 CUP = 20,00 USD; 5/mes).'),
    svc('sv-h12', 'Cura de óxido de zinc', 25.0, 25,
      'H-037 (3 000,00 CUP = 25,00 USD; 25/mes).'),
    svc('sv-h13', 'Radiografía', 15.0, 30,
      'H-037 (1 800,00 CUP = 15,00 USD; 30/mes). Requiere el equipo de rayos X reparado (H-065): su monitor NO está cotizado en la inversión (brecha B-09).'),
    svc('sv-h14', 'Corona acrílica', 80.0, 10,
      'H-037 (9 600,00 CUP = 80,00 USD; 10/mes).'),
    svc('sv-h15', 'Blanqueamientos', 150.0, 10,
      'H-037 (18 000,00 CUP = 150,00 USD; 10/mes; precio confirmado por F09). Servicio hoy suspendido por falta de kits (H-062); recuperación comprometida por el inversionista con un donativo inicial de 500 casos [sin cotizar, B-21].'),
  ];

  // ------------------------------------------------------------- 4.7 / 4.10
  p.financiero.inversion = [
    {
      id: 'iv-h1',
      concepto: 'Compresor de aire seco para uso estomatológico (recupera la conformidad técnica: el actual usa aceite)',
      categoria: 'inversion_fija',
      moneda: 'USD',
      monto: 3.885,
      vidaUtilAnios: 17,
      anioDisponible: 1,
      valorResidualPct: 0,
      metodoDepreciacion: 'lineal',
      observacion: 'H-021 (F06: 3 500,00 + envío 350,00 + transporte 35,00 = 3 885,00 USD). Depreciación del expediente: 6 % anual ≈ 16,7 años (H-031); se modela lineal a 17.',
    },
    {
      id: 'iv-h2',
      concepto: 'Prensa hidráulica de estomatología (moderniza el proceso de prótesis)',
      categoria: 'inversion_fija',
      moneda: 'USD',
      monto: 0.413,
      vidaUtilAnios: 17,
      anioDisponible: 1,
      valorResidualPct: 0,
      metodoDepreciacion: 'lineal',
      observacion: 'H-021 (F06: 316,00 + 62,00 + 35,00 = 413,00 USD). H-064: sustituye la prensa antigua con repetición de procesos.',
    },
    {
      id: 'iv-h3',
      concepto: 'Micromotor de mano (tecnología nueva para prótesis)',
      categoria: 'inversion_fija',
      moneda: 'USD',
      monto: 0.284,
      vidaUtilAnios: 17,
      anioDisponible: 1,
      valorResidualPct: 0,
      metodoDepreciacion: 'lineal',
      observacion: 'H-021 (F06: 209,00 + 40,00 + 35,00 = 284,00 USD). H-064: hoy se corrige con pieza de mano (roturas frecuentes).',
    },
    {
      id: 'iv-h4',
      concepto: 'Eliminador de burbujas (calidad de prótesis)',
      categoria: 'inversion_fija',
      moneda: 'USD',
      monto: 0.29,
      vidaUtilAnios: 17,
      anioDisponible: 1,
      valorResidualPct: 0,
      metodoDepreciacion: 'lineal',
      observacion: 'H-021 (F06: 285,00 + 70,00 + 35,00 = 290,00 USD).',
    },
    {
      id: 'iv-h5',
      concepto: 'Olla polimerizadora a presión (sustituye la cocción en microondas)',
      categoria: 'inversion_fija',
      moneda: 'USD',
      monto: 0.402,
      vidaUtilAnios: 17,
      anioDisponible: 1,
      valorResidualPct: 0,
      metodoDepreciacion: 'lineal',
      observacion: 'H-021 (F06: 289,00 + 78,00 + 35,00 = 402,00 USD).',
    },
    {
      id: 'iv-h6',
      concepto: 'Gastos financieros del período de inversión',
      categoria: 'gastos_previos',
      moneda: 'CUP',
      monto: 1.2,
      vidaUtilAnios: 0,
      anioDisponible: 0,
      valorResidualPct: 0,
      metodoDepreciacion: 'lineal',
      observacion: 'H-022 (F08 p. 5). Aportados por CSMC (H-020).',
    },
    {
      id: 'iv-h7',
      concepto: 'Otros gastos de preoperación (sin desglose en el expediente)',
      categoria: 'gastos_previos',
      moneda: 'CUP',
      monto: 25.0,
      vidaUtilAnios: 0,
      anioDisponible: 0,
      valorResidualPct: 0,
      metodoDepreciacion: 'lineal',
      observacion: 'H-022 (F08 p. 5: «Otros gastos de Pre-Operación (Detallar) 25,00»). [Pendiente: desglose y posible solape con los salarios de preapertura — brecha B-11.]',
    },
  ];
  p.financiero.vehiculos = [];
  p.financiero.otrosIngresos = Array.from({ length: 10 }, () => 0);
  p.financiero.deuda = {
    habilitada: false,
    anioDesembolso: 0,
    tipoGracia: 'principal',
    metodo: 'capital_constante',
    fuente: 'Sin financiamiento externo: la tabla de financiamientos del expediente declara necesidad 0,00 y ningún crédito (H-030, F08 p. 7).',
  };

  // Parámetros: valores del expediente con su fuente (Nivel A editable).
  const params = parametrosPorDefecto({ creditoKUSD: 0, capitalTrabajoKUSD: 0 });
  const fijar = (id: string, valor: number, fuente: string, descNueva?: string) => {
    const x = params.find((q: Parametro) => q.id === id);
    if (!x) throw new Error(`Parámetro inexistente: ${id}`);
    x.valor = valor;
    x.fuente = fuente;
    x.demo = false;
    if (descNueva) x.descripcion = descNueva;
  };
  fijar('tipo_cambio', 120,
    'Documental (H-025): lista de precios de CSMC «A TASA DE 1*120» (F02/F08 p. 23) y precios por caso en USD de F09 (TPR 80,00; blanqueamiento 150,00) que equivalen a los CUP ÷ 120. CONTRADICCIÓN REGISTRADA (C-01): los encabezados del expediente usan 1×24; decisión de tasa a cargo del promotor con sustento normativo (V-07).',
    'Tipo de cambio CUP/USD del modelo. Valor 120 DOCUMENTADO por la lista de precios del expediente; la tasa 24 de los encabezados del anexo queda como contradicción crítica pendiente (C-01). Aplica a salarios y a las partidas expresadas en CUP.');
  fijar('tasa_impuesto_utilidades', 0.15,
    'Expediente (H-033): el EERR aplica 15 % solo en los años 8–10; SIN base legal citada (brecha B-16, validación V-05).',
    'Tasa del impuesto sobre utilidades según el patrón del expediente (15 % aplicado a los años 8–10). PENDIENTE DE VALIDACIÓN NORMATIVA.');
  fijar('crecimiento_precios', 0, 'Expediente: precios constantes de la lista (H-037), sin crecimiento documentado.', undefined);
  fijar('crecimiento_volumen', 0,
    'Expediente: demanda mensual prevista constante (H-037). [Contradicción C-14: el EERR del expediente reduce los ingresos un 4,95 % desde el año 2 sin explicación; la plantilla mantiene la demanda del año 1 y registra la divergencia.]', undefined);
  fijar('inflacion', 0, 'Expediente: cotización vigente sin cláusula de indexación documentada (H-029).', undefined);
  fijar('inflacion_costos_fijos', 0, 'Expediente: partidas fijas en 0 o sin contrato de indexación (H-041, H-048).', undefined);
  fijar('crecimiento_salarios', 0, 'Expediente: costo salarial constante (H-035).', undefined);
  fijar('pct_gastos_admin', 0,
    'Expediente (H-041): los gastos generales y de administración del EERR son 100 % fuerza de trabajo (1 248,0 kCUP/año), ya modelada en 4.9; no hay otros gastos administrativos.', undefined);
  fijar('pct_mantenimiento', 0,
    'Expediente (H-048): «Gastos de Mantenimiento 0,0» en todos los años del EERR. [Brecha B-19: realismo improbable en instalación con rayos X y autoclave.]', undefined);
  fijar('factor_costo_laboral', 1.0,
    'Expediente: el costo salarial del EERR (4 320 kCUP/año) se toma como costo TOTAL (H-035); las líneas de seguridad social (540,0) y provisión (86,4) del anexo de fuerza de trabajo no concilian con el EERR (C-07).', undefined);
  fijar('pct_parte_cubana', 0.5,
    'Contrato (H-013): reparto de beneficios 50/50 (F01, cláusula 7.5). INCOHERENCIA (C-05): la tabla de aportaciones declara participación 49/51 — brecha B-04.',
    'Participación aplicada al reparto: 50 % según el contrato. La tabla de aportaciones del expediente declara 49 % (el diagnóstico de la app señala la incoherencia hasta que se aclare).');
  fijar('pct_reparto_dividendos', 1.0,
    'Expediente (H-042): el EERR distribuye íntegramente las utilidades disponibles (51 059,9 kCUP repartidas 50/50 en 10 años).', undefined);
  fijar('pct_reserva_legal', 0.16,
    'Derivado (H-042): reservas del EERR ≈ 16 % de la base distribuible en los años 1–7 (5 % contingencias + 1 % fondo de estimulación + ~10 % otras reservas voluntarias; 11 % en los años 8–10). Aproximación editable pendiente de la política societaria real.', undefined);
  fijar('servicios_publicos_anual_k', 0,
    'Expediente (H-048): «Servicios Públicos 0,0» en todos los años del EERR. [Brecha B-19: consumo no estimado.]', undefined);
  fijar('canon_anual_k', 0,
    'PENDIENTE (H-047): el importe del arrendamiento no consta; CSMC lo garantiza solo en preapertura y los primeros 6 meses (F02). Brecha B-18.', undefined);
  fijar('otros_gastos_fijos_k', 0, 'Expediente (H-041/H-048): sin otros gastos fijos reconocidos.', undefined);
  fijar('aranceles_anual_k', 0,
    'Expediente (H-049): «Libre de impuestos x AEI» en la cotización de equipos; balance externo con aranceles 0. Validación normativa pendiente (V-04).', undefined);
  fijar('otros_impuestos_anual_k', 5.68,
    'Expediente (H-034): 682,1 miles de CUP/año (impuesto de transporte terrestre + contribución al desarrollo local 1 % de las ventas brutas + tasa de radicación de anuncios) = 5,68 kUSD a la tasa 120. [Pendiente: desglose, brecha B-17.]', undefined);
  fijar('royalties_anual_k', 0, 'Expediente: sin royalties (F08, beneficio país con la partida en 0).', undefined);
  fijar('otros_beneficios_pais_anual_k', 0, 'Expediente: sin otros beneficios al país (F08 p. 19).', undefined);
  fijar('credito_monto_k', 0, 'Expediente (H-030): sin financiamiento externo.', undefined);
  fijar('otras_fuentes_k', 0, 'Expediente (H-030): sin otras fuentes.', undefined);
  fijar('capital_trabajo_k', 0,
    'Expediente (H-023): capital de trabajo inicial 0,00. [Anomalía registrada — brecha B-12: el propio estado de situación proyecta existencias y cuentas por cobrar.]', undefined);
  fijar('pct_recuperacion_capital_trabajo', 0, 'N/A sin capital de trabajo.', undefined);
  p.parametros = params;

  // Reglas de fábrica con DOS expresiones ajustadas al expediente (ambas
  // editables y trazables; las de fábrica NO se tocan):
  // 1) Impuesto 15 % solo en los años 8–10 (H-033).
  const reglas = reglasPorDefecto();
  const imp = reglas.find((r: Regla) => r.id === 'impuesto_utilidades_k');
  if (!imp) throw new Error('Regla de impuesto no encontrada');
  imp.expresion = 'IF(PERIODO >= 8, MAX(0, utilidad_antes_impuestos_k * tasa_impuesto_utilidades), 0)';
  imp.expresionDefault = imp.expresion;
  imp.descripcion =
    'Patrón del EXPEDIENTE (H-033, F08 p. 9): impuesto del 15 % sobre la utilidad antes de impuestos SOLO en los años 8 a 10; los años 1–7 tributan 0 (exención SIN base legal citada — validación V-05/brecha B-16 pendiente). Regla editable: con la norma verificada, sustituya la expresión por la aplicable.';
  imp.categoria = 'Resultados';
  // 2) Gastos previos: la regla de fábrica solo suma las partidas en USD, por
  //    lo que las 26,20 kCUP documentales (H-022) se perderían en silencio.
  //    Este proyecto extiende la EXPRESIÓN (nivel B, mecanismo diseñado de la
  //    app) para sumar las partidas en CUP convertidas con el tipo de
  //    cambio, igual que el motor ya hace con la inversión fija en CUP.
  //    HALLAZGO para el propietario: extender la REGLA DE FÁBRICA requiere
  //    recalcibrar la línea base editorial de DOC-003 (véase informe).
  const gp = reglas.find((r: Regla) => r.id === 'gastos_previos_k');
  if (!gp) throw new Error('Regla de gastos previos no encontrada');
  gp.expresion =
    'SUMA_INVERSIONES(IF(AND(categoria_inv = "gastos_previos", moneda_inv = "USD"), monto_inv, 0)) + SUMA_INVERSIONES(IF(AND(categoria_inv = "gastos_previos", moneda_inv = "CUP"), monto_inv, 0)) / tipo_cambio';
  gp.expresionDefault = gp.expresion;
  gp.descripcion =
    'EXPRESIÓN EXTENDIDA en este proyecto (H-022): suma las partidas de gastos previos en USD MÁS las partidas en CUP (26,20 kCUP del expediente) convertidas a miles de USD con el tipo de cambio parametrizado. La regla de fábrica solo suma USD: sin esta extensión, las partidas en CUP se ignorarían en silencio (hallazgo documentado en el informe de la misión).';
  p.reglas = reglas;

  // ------------------------------------------------------------- 4.8
  p.mercado = {
    caracterizacion:
      'Servicios estomatológicos de estándar internacional prestados por profesionales cubanos, con 15 líneas de servicio a precios de lista de CSMC (H-037/H-060). Contexto documentado de demanda represada: 13 de 15 servicios activos; TPR y blanqueamientos suspendidos (73 pacientes de blanqueamiento rechazados en el quinquenio, 10 950,00 USD de ingreso perdido; prótesis — el servicio de más demanda e ingreso — operando al 75 % con un promedio histórico de ≈50 000 USD/año) (F09; H-061 a H-063). [Pendiente: caracterización de mercado propiamente dicha — brecha B-24.]',
    requisitosRegulatorios:
      '[Pendiente: requisitos regulatorios verificados — brecha B-16 y validaciones V-01 a V-06.] Compromisos documentados del contrato (F01, cláusula 8.1): CSMC gestionará licencias comerciales y sanitarias, registros (Mercantil, ONAT, ONEI), autorizaciones locales para nuevas tecnologías, aval técnico de los medios, nomenclador de importación/exportación y gestiones ante la Aduana. La exención arancelaria declarada por la cotización (H-049) requiere verificación (V-04).',
    materiasPrimas:
      'Insumos y material gastable del cuadro básico de estomatología (71 renglones declarados, H-067): anestésicos (benzocaína, articaína), resinas compuestas (Filtek Z250 XT en 6 tonos), adhesivos, ionómeros, cementos, materiales de prótesis (acrílicos, monómero, ceras, alginato, piedras, dientes de polímero), profilaxis, esterilización y desinfección, y kits de blanqueamiento (F03, ≈60 renglones cotizados). [Pendientes: limas de endodoncia para TPR (B-20) y conciliación 71/60 renglones (B-23).]',
    fuentesSuministro:
      'Importación aportada por Leisure Exporting LLC (stock inicial de 6 meses: 63 581,30 USD, cotización F03) y reposición prevista por el mismo canal (F02: la parte extranjera garantiza los insumos). [Pendiente: contrato de suministro continuo — brecha B-22.]',
    consumoEstimado:
      'Costo material del modelo: 63 581,30 USD en el primer período de 6 meses (stock aportado) y 127 162,60 USD anuales implícitos en el EERR del expediente (3 051,9 kCUP/año a su tasa 24; H-029/H-040). Reparto por servicio provisional (H-040): convención proporcional al precio, EDITABLE, pendiente del desglose real (B-13).',
    demandaAparente: '[Pendiente: demanda aparente — sin estudio de mercado (H-080; brecha B-24).]',
    demandaSolvente: '[Pendiente: demanda solvente y captación prevista — sin estudio (H-080; brecha B-24).]',
    metodoEstimacion:
      'Sin método de estimación documentado. La valoración recomienda el estudio de factibilidad con las estadísticas de 2019 como año pre-crisis (F02); F09 aporta referencias anecdóticas de demanda represada. La app exige documentar fuentes y fechas: ninguna estimación de mercado se incorpora como dato.',
    fuentesConsulta:
      'Fuentes del expediente: lista de precios de CSMC (F02/F08), diagnóstico de servicios (F09), inventario y cuadro básico (F04/F07). Referencia contextual: Global Burden of Disease Study 2019 (citado por F02). [Pendiente: fuentes primarias de mercado — brecha B-24.]',
    ventasExportacion:
      'El balance financiero externo del expediente computa la totalidad de los ingresos como exportaciones de servicios (F08, p. 10: «Exportaciones 132 789,7»), y el objeto contractual declara el acceso a mercados de América Latina, Centroamérica y el Caribe. Los 15 servicios quedan clasificados en el canal de exportación (H-037). [Pendiente: plan comercial y contratos — brecha B-25.]',
    ventasDivisas: '[Pendiente: política de facturación en divisas — brecha B-25.]',
    ventasMonedaNacional:
      '[Pendiente: componente de venta en moneda nacional, si existiera — el expediente no lo desglosa (brecha B-25).] Los precios de la lista están expresados en CUP (equivalentes a USD a la tasa 120, H-025).',
  };

  // ------------------------------------------------------------- 4.9
  p.fuerza = {
    entidadContratante:
      '[Pendiente: entidad autorizada a contratar — brecha B-15; implícita CSMC, S.A. según el contrato.] El contrato prevé la contratación de la fuerza de trabajo cubana conforme a la legislación vigente y la revisión de currículos por el Consejo de Dirección (F01, cláusula 3).',
  };
  p.personal = [
    {
      id: 'pe-h1',
      etapa: 'operacion',
      grupo: 'cubano_directivo',
      cantidad: 1,
      salarioPromedioAnualCUP: 647628,
    },
    {
      id: 'pe-h2',
      etapa: 'operacion',
      grupo: 'cubano_otro',
      cantidad: 4,
      salarioPromedioAnualCUP: 437142,
    },
    {
      id: 'pe-h3',
      etapa: 'operacion',
      grupo: 'cubano_otro',
      cantidad: 2,
      salarioPromedioAnualCUP: 518094,
    },
    {
      id: 'pe-h4',
      etapa: 'operacion',
      grupo: 'cubano_otro',
      cantidad: 2,
      salarioPromedioAnualCUP: 323808,
    },
    {
      id: 'pe-h5',
      etapa: 'operacion',
      grupo: 'extranjero_directivo',
      cantidad: 1,
      salarioPromedioAnualCUP: 240000,
    },
  ];

  // ------------------------------------------------------------- 4.10
  // Cronograma: fases DOCUMENTADAS del expediente (F08 p. 17 y F01). Las
  // fechas de inicio/fin son de colocación PROVISIONAL editable: el
  // cronograma del anexo tiene marcas gráficas ilegibles (brecha B-14).
  p.cronograma = [
    {
      id: 'cr-h1',
      etapa: 'Preinversión: estudios, investigaciones y permisos',
      inicio: '2026-01',
      fin: '2026-06',
      observacion: 'Fase documentada (F08 p. 17). [Pendiente: fechas precisas — B-14; colocación provisional 2026 editable.]',
    },
    {
      id: 'cr-h2',
      etapa: 'Preapertura: inscripciones, cuentas, aportes y ejecución de inversiones pactadas',
      inicio: '2026-02',
      fin: '2026-12',
      observacion: 'Período de preapertura del contrato (H-015): cronograma de acciones revisado semanalmente por las partes. [Fechas provisionales — B-14.]',
    },
    {
      id: 'cr-h3',
      etapa: 'Ejecución: recepción de suministros importados y montaje de equipos',
      inicio: '2026-07',
      fin: '2026-11',
      observacion: 'Fase documentada (F08 p. 17: recepción de suministros, montaje, asistencia técnica y capacitación). [Provisional — B-14.]',
    },
    {
      id: 'cr-h4',
      etapa: 'Pruebas, puesta en marcha e inicio de la explotación',
      inicio: '2026-12',
      fin: '2027-01',
      observacion: 'Fase documentada (F08 p. 17). El inicio de operaciones queda condicionado a las licencias (V-02, V-06). [Provisional — B-14.]',
    },
    {
      id: 'cr-h5',
      etapa: 'Operación comercial (horizonte de 10 años)',
      inicio: '2027-01',
      fin: '2036-12',
      observacion: 'Horizonte documentado (H-012): 10 años de operación; el calendario del expediente rotula 2026–2035 con un desfase interno de etiquetado registrado (el EERR y el flujo usan años distintos para la inversión).',
    },
    {
      id: 'cr-h6',
      etapa: 'Estudios de postinversión y evaluación de la prórroga',
      inicio: '2034-01',
      fin: '2034-12',
      observacion: 'F02: evaluación en 2034 para valorar 10 años más de vigencia (H-012); F08 p. 17: «Estudios de Postinversión Año 2034».',
    },
  ];

  // ------------------------------------------------------------- 4.12
  p.conclusiones = {
    texto:
      'CONCLUSIONES (marco de lectura del proyecto documental): la síntesis cuantitativa se GENERA a partir del modelo de cálculo activo y se recalcula con cada cambio de datos, parámetros o fórmulas. ESTADO DE LA EVALUACIÓN: preliminar. El expediente documental presenta contradicciones críticas no resueltas que condicionan los resultados — la tasa de cambio 24 frente a 120 (C-01) es determinante: a los precios reales de lista y al costo real de los insumos cotizados, el margen operativo del modelo es negativo, mientras que el modelo del expediente (que valora los insumos a la tasa 24) reporta utilidades; la decisión cambiaria corresponde al promotor con sustento normativo. Adicionalmente, la depreciación del estado de resultados del expediente está mal cargada (C-06), los salarios tienen tres versiones incompatibles (C-07), la capacidad instalada no está estudiada (B-10) y no existe estudio de mercado (B-24). Ninguna cifra del expediente se presenta como validada; la lectura de la inversión, los ingresos, la utilidad, la recuperación, los dividendos y los beneficios directos al país debe hacerse sobre el modelo activo y la sección «Expediente documental», no sobre los indicadores del anexo del expediente (C-02). Antes de cualquier presentación oficial deben resolverse las brechas bloqueantes (B-06, B-16, B-24) y las validaciones normativas (V-01 a V-08).',
  };

  return p;
}

export const NOTA_HOLGUIN =
  'PROYECTO DOCUMENTAL EN EVALUACIÓN PRELIMINAR. Los datos proceden del expediente del promotor (9 fuentes con huella SHA-256) y son trazables campo a campo; las contradicciones del expediente permanecen visibles y los campos sin evidencia se marcan como pendientes. No constituye una propuesta aprobada ni acredita el cumplimiento de requisitos legales, tributarios, sanitarios o de inversión.';
