// ============================================================================
// PLANEX-DATA-002 — Consultas al promotor del expediente Holguín.
//
// Cada consulta cita su contexto con localizador exacto (fuente y página/
// tabla), por qué se necesita, quién responde, qué documento o decisión la
// cierra, su prioridad y las contradicciones (C-##), brechas (B-##) o
// validaciones (V-##) que la sustentan. Ninguna pregunta está respondida
// aquí: las respuestas pertenecen al promotor y sus especialistas, y con
// ellas el modelo se recalcula cambiando los parámetros señalados.
// ============================================================================

import type {
  AreaConsulta,
  PrioridadConsulta,
  ResponsableConsulta,
} from './consultas';

export interface Consulta {
  id: string;
  area: AreaConsulta;
  titulo: string;
  pregunta: string;
  contexto: string;
  motivo: string;
  responde: ResponsableConsulta;
  loResuelve: string;
  prioridad: PrioridadConsulta;
  referencias: string[];
}

export const CONSULTAS: Consulta[] = [
  // ------------------------------------------------------- identidad y legal
  {
    id: 'Q-01',
    area: 'identidad_legal',
    titulo: 'Denominación formal del proyecto e identificación comercial',
    pregunta:
      '¿Cuál es la denominación formal del proyecto y la identificación comercial con la que debe presentarse el plan (nombre del Centro, marca, siglas)?',
    contexto:
      'El expediente alterna «Centro Internacional Estomatológico de alta tecnología» (F01, objeto contractual), «CENTRO INTERNACIONAL ESTOMATOLOGIA HOLGUIN» (F02, portada) y referencias al «Centro» sin nombre propio (F01, cláusula del usufructo). Brecha B-02.',
    motivo:
      'La portada, el título del plan (4.1/4.2) y todos los documentos exportados deben llevar la denominación exacta que el promotor presentará a las autoridades; un nombre no documentado no puede inventarse.',
    responde: 'Promotor (CSMC/Leisure)',
    loResuelve:
      'Escrito breve de las partes con la denominación oficial y la identificación comercial (incluida la marca, si está registrada — V-08).',
    prioridad: 'alta',
    referencias: ['B-02', 'V-08'],
  },
  {
    id: 'Q-02',
    area: 'identidad_legal',
    titulo: 'Localización exacta del Centro',
    pregunta:
      '¿Cuál es la dirección exacta del inmueble y su descripción (superficie, estado, plantas)?',
    contexto:
      'El contrato de AEI (F01) deja EN BLANCO la ubicación del inmueble aportado por usufructo: «su ubicación se encuentra en __________, provincia Holguín». Brecha B-08.',
    motivo:
      'La localización es un campo obligatorio del apartado 4.1, condiciona licencias, costos de remodelación y el estudio de mercado territorial; no puede sustituirse por «provincia Holguín».',
    responde: 'Promotor (CSMC)',
    loResuelve: 'Dirección exacta del inmueble (y plano o croquis si existe), con la referencia catastral de que se disponga.',
    prioridad: 'alta',
    referencias: ['B-08'],
  },
  {
    id: 'Q-03',
    area: 'identidad_legal',
    titulo: 'Reparto de beneficios: 50/50 del contrato frente a 49/51 de la tabla de aportaciones',
    pregunta:
      '¿Qué regla gobierna el reparto: el 50/50 de la cláusula 7.5 del contrato o la participación 49/51 que declara la tabla de aportaciones del expediente?',
    contexto:
      'Contrato F01 (cláusula 7.5; registro H-013): reparto de beneficios 50/50. Tabla de aportaciones de F02/F08: participación declarada 49 % CSMC / 51 % Leisure. Contradicción C-05, brecha B-04.',
    motivo:
      'El reparto determina el dividendo por socio (4.11) y la presentación del negocio ante las autoridades; dos reglas incompatibles no pueden coexistir en el plan presentable.',
    responde: 'Promotor (CSMC/Leisure)',
    loResuelve:
      'Decisión escrita de las partes (acta del Consejo de Administración) que deje sin efecto una de las dos reglas o corrija la tabla de aportaciones.',
    prioridad: 'alta',
    referencias: ['C-05', 'B-04', 'H-013'],
  },
  {
    id: 'Q-04',
    area: 'identidad_legal',
    titulo: 'Acreditación registral y domicilio único de Leisure Exporting LLC',
    pregunta:
      '¿Cuál es el domicilio social vigente de Leisure Exporting LLC y cuál es el documento que acredita su constitución y la representación de su Manager?',
    contexto:
      'El expediente declara dos domicilios incompatibles para Leisure Exporting LLC: «3964 South Cir Largo, Florida» (F01, comparecencia) y un acta notarial protocolizada en La Habana (C-09, brecha B-03).',
    motivo:
      'La identificación de las partes (4.1) debe ser exacta y única para la presentación del CAEI ante el Registro Mercantil y las autoridades (V-02); un domicilio contradictorio retrasa la validación.',
    responde: 'Promotor (Leisure)',
    loResuelve:
      'Documento constitutivo vigente y certificado de domicilio de Leisure Exporting LLC (más aclaración de la protocolización cubana del 13 de septiembre de 2024).',
    prioridad: 'media',
    referencias: ['C-09', 'B-03'],
  },
  {
    id: 'Q-05',
    area: 'identidad_legal',
    titulo: 'Denominación exacta de la entidad cubana',
    pregunta: '¿La entidad cubana es «Comercializadora de Servicios Médicos Cubanos, S.A.» (CSMC, S.A.)? ¿Cuál es su abreviatura oficial?',
    contexto:
      'El expediente alterna tres abreviaturas: SMC, CSMC y CMSM (C-10, brecha B-01). El contrato (F01) la identifica en su comparecencia como «Comercializadora de Servicios Médicos Cubanos, S.A., en forma abreviada CSMC, S.A.».',
    motivo: 'La identidad de las partes debe ser unívoca en todos los apartados del plan y en sus anexos.',
    responde: 'Promotor (CSMC)',
    loResuelve: 'Confirmación escrita de la denominación y abreviatura oficiales (con sus datos registrales ya aportados en F01).',
    prioridad: 'media',
    referencias: ['C-10', 'B-01'],
  },
  {
    id: 'Q-06',
    area: 'identidad_legal',
    titulo: 'Fecha de constitución formal de la AEI y aprobación por la autoridad competente',
    pregunta:
      '¿En qué fecha quedó formalmente constituida la AEI y con qué resolución o acta la aprobó la autoridad competente? ¿Cuándo se prevé el Acta de Inicio de las Operaciones?',
    contexto:
      'El contrato (F01) define el Período de Preapertura y el Acta de Inicio de las Operaciones, pero el expediente no adjunta la aprobación de la constitución (V-01), la inscripción registral del CAEI (V-02), ni fechas legibles del cronograma (F08 p. 17, marcas gráficas — B-15).',
    motivo:
      'La exención del impuesto sobre utilidades corre «a partir de la constitución» (Ley 118, art. 36.2): sin la fecha exacta no se puede ubicar el año 8 en el que el impuesto comienza (S-03), ni calibrar el cronograma del plan.',
    responde: 'Promotor (CSMC/Leisure)',
    loResuelve:
      'Copia de la autorización de constitución de la AEI, certificación del Registro Mercantil del CAEI y cronograma con fechas precisas de preapertura e inicio de operaciones.',
    prioridad: 'critica',
    referencias: ['V-01', 'V-02', 'B-15', 'S-03'],
  },
  {
    id: 'Q-07',
    area: 'identidad_legal',
    titulo: 'Avalúo del derecho de usufructo y presupuesto de remodelación',
    pregunta:
      '¿Cuál es el avalúo del inmueble aportado por usufructo, existe certificación del derecho, y con qué presupuesto se remodelará/acondicionará el Centro para la operación?',
    contexto:
      'CSMC aporta «el derecho real de usufructo del inmueble» (F01, cláusula de puesta a disposición) sin avalúo adjunto ni certificado (brecha B-05); el expediente no contiene presupuesto de remodelación/montaje (brecha B-27) pese a que la valoración describe instalaciones deterioradas (dos servicios suspendidos y prótesis al 75 % de capacidad, F09).',
    motivo:
      'El valor del usufructo es una aportación al fondo común (4.5/4.6) y la remodelación es una inversión potencialmente omitida del plan; ambos condicionan la inversión total y el reparto.',
    responde: 'Promotor (CSMC)',
    loResuelve:
      'Certificado del derecho de usufructo con avalúo, y presupuesto de remodelación/montaje con su fuente (o decisión de asumir la remodelación fuera del fondo común).',
    prioridad: 'alta',
    referencias: ['B-05', 'B-27'],
  },

  // ---------------------------------------------------- financiero y fiscal
  {
    id: 'Q-08',
    area: 'financiero_fiscal',
    titulo: 'Tasa de cambio aplicable: 24, 120 o la tasa oficial vigente',
    pregunta:
      '¿Qué tasa de cambio gobierna el plan? ¿Qué tasa se aplica a la contabilidad y estados financieros de la AEI, qué tasa sustenta la lista de precios en CUP, y con qué tasa se valoran los aportes en especie importados?',
    contexto:
      'El expediente usa DOS tasas simultáneas: 24 CUP/USD en TODOS los encabezados de sus tablas (inversión, insumos, totales «MUSD») y 120 CUP/USD en la lista de precios de los servicios (confirmada por F09: TPR 80,00 USD = 9 600 CUP; blanqueamiento 150,00 USD = 18 000 CUP). El modelo adopta la 120 documental (S-01) y conserva la contradicción (C-01). Adicionalmente, la tasa oficial del Banco Central de Cuba consultada el 29/10/2026 es de 758,00 CUP por USD bajo el régimen del Decreto-Ley 113/2025 — ninguna de las dos tasas del expediente coincide con la oficial vigente.',
    motivo:
      'Es la contradicción CRÍTICA y bloqueante del modelo: con la tasa 24 los indicadores del expediente no son verificables (sus «MUSD» son en realidad miles), y con la tasa documental 120 el costo material real (127,2 kUSD/año desde el año 2) EXCEDE el ingreso a precios de lista (115,8 kUSD/año): la rentabilidad declarada desaparece. Ninguna decisión económica puede presentarse sin resolverla (V-07).',
    responde: 'Promotor (CSMC/Leisure)',
    loResuelve:
      'Decisión escrita del promotor con sustento normativo: (1) tasa aplicable a la contabilidad de la AEI (Banco Central, fecha de referencia); (2) vigencia de la lista de precios en CUP bajo el régimen de divisas vigente; (3) tratamiento cambiario de los aportes en especie importados. Con la tasa decidida, el modelo se recalcula cambiando UN parámetro.',
    prioridad: 'critica',
    referencias: ['C-01', 'V-07', 'S-01'],
  },
  {
    id: 'Q-09',
    area: 'financiero_fiscal',
    titulo: 'Impuesto sobre utilidades: ¿por qué 15 % y no la tasa general de 35 %?',
    pregunta:
      '¿El impuesto sobre utilidades de esta AEI se rige por el artículo 36 de la Ley 118 (15 % y exención de 8 años), o por la tasa general del 35 % de la Ley 113? ¿Qué pronunciamiento lo confirma por escrito?',
    contexto:
      'El EERR del anexo (F08, p. 9) aplica 15 % SOLO en los años 8–10 y 0,00 en los años 1–7, sin citar base legal (C-15, brecha B-16, validación V-05). La investigación normativa halló sustento DIRECTO del patrón: la Ley 118 «De la Inversión Extranjera», artículo 36.1, fija el 15 % sobre la utilidad neta imponible para las partes en contratos de asociación económica internacional, y su artículo 36.2 concede la exención de 8 años a partir de la constitución (prorrogable). La tasa general del 35 % (Ley 113, confirmada por la Ley 181/2025 del Presupuesto 2026) solo aplicaría si el negocio quedara excluido del régimen especial: el artículo 43 excluye de este régimen a los contratos de administración hotelera, productiva o de servicios y a los de prestación de servicios profesionales.',
    motivo:
      'Es la pregunta fiscal CENTRAL del plan: si el negocio tributara al 35 % sin exención, la utilidad neta del horizonte caería ≈35 % cada año frente al 15 % en solo 3 años. La exclusión del artículo 43 debe descartarse expresamente porque el objeto del CAEI es la prestación de servicios estomatológicos.',
    responde: 'Asesor jurídico del promotor',
    loResuelve:
      'Consulta o pronunciamiento escrito (ONAT/asesoría) que: (1) confirme la aplicación del artículo 36.1 (15 %) a este CAEI; (2) descarte la exclusión del artículo 43; (3) certifique que el Decreto-Ley 128/2026 no alteró los artículos 34 a 45. Con la norma verificada, se sustituye la regla de impuesto desde la interfaz sin editar código (S-02).',
    prioridad: 'critica',
    referencias: ['C-15', 'B-16', 'V-05', 'S-02'],
  },
  {
    id: 'Q-10',
    area: 'financiero_fiscal',
    titulo: 'Contribución territorial al desarrollo local durante la recuperación',
    pregunta:
      '¿La AEI está exenta de la contribución territorial al desarrollo local (1 % de las ventas brutas que computa el expediente) mientras no concluya la recuperación de la inversión?',
    contexto:
      'El expediente incluye la contribución al desarrollo local dentro de «otros impuestos» por 682,1 kCUP/año (H-034, brecha B-17). La Ley 118, artículo 42, exime a las partes en AEI de esa contribución DURANTE el período de recuperación de la inversión. El modelo conserva la partida por fidelidad al expediente (S-11) y a las tasas documentadas el proyecto NO se recupera en el horizonte.',
    motivo:
      'Si la exención del artículo 42 aplica, los otros impuestos bajan ≈1 159 kCUP/año (≈9,66 kUSD) y la utilidad sube en igual medida; es una partida material para el resultado anual.',
    responde: 'Asesor jurídico del promotor',
    loResuelve:
      'Pronunciamiento sobre la aplicación del artículo 42 a este negocio y la fecha de inicio del cómputo del período de recuperación; desglose de las tres partidas de «otros impuestos».',
    prioridad: 'alta',
    referencias: ['B-17', 'S-11', 'H-034'],
  },
  {
    id: 'Q-11',
    area: 'financiero_fiscal',
    titulo: 'Conciliación de aportes e inversión de la tabla de financiamientos',
    pregunta:
      '¿Cómo concilian los aportes totales declarados (3 252,53) con la inversión total (152,78) que aparecen en la misma página de la tabla de financiamientos, y en qué moneda y a qué tasa se aportó efectivamente cada partida?',
    contexto:
      'F08 p. 1: la tabla de financiamientos declara aportes por 3 252,53 y necesidad/inversión por 152,78 en la misma página (contradicción C-11). El modelo adopta la composición documentada (efectivo 1 600,0 kCUP; insumos 63 581,30 USD; equipos 5 274,00 USD) con sus cotizaciones y fuentes.',
    motivo:
      'La financiación de 4.6 debe conciliar exactamente con la inversión de 4.5/4.6 y con el reparto (Q-03); valores con magnitudes incompatibles no pueden presentarse a ninguna autoridad.',
    responde: 'Promotor (CSMC/Leisure)',
    loResuelve:
      'Versión vigente de la tabla de financiamientos con moneda, tasa de conversión y fecha de cada aporte, firmada o aprobada; explicación del sobrante si los aportes exceden la inversión (¿capital de trabajo? — Q-13).',
    prioridad: 'critica',
    referencias: ['C-11', 'B-12'],
  },
  {
    id: 'Q-12',
    area: 'financiero_fiscal',
    titulo: 'Capital de trabajo inicial',
    pregunta: '¿Cuál es el capital de trabajo necesario para el ciclo operativo del Centro?',
    contexto:
      'La tabla de financiamientos declara capital de trabajo 0,00 (H-023), pero el propio estado de situación del expediente proyecta existencias y cuentas por cobrar: anomalía registrada (brecha B-12).',
    motivo:
      'Sin capital de trabajo, el plan subestima la necesidad real de fondos y las aportaciones; es un requisito de coherencia del 4.6 y del estado de situación proyectado.',
    responde: 'Promotor (CSMC/Leisure)',
    loResuelve: 'Cálculo del capital de trabajo (insumos + cuentas por cobrar − proveedores) o justificación documentada de su cobertura por otro mecanismo.',
    prioridad: 'alta',
    referencias: ['B-12', 'H-023', 'S-15'],
  },
  {
    id: 'Q-13',
    area: 'financiero_fiscal',
    titulo: 'Desglose de los gastos previos',
    pregunta: '¿Qué componen los gastos previos de preoperación (25,0 kCUP del expediente / 26,20 kCUP del modelo) y quién los asume?',
    contexto:
      'La tabla de financiamientos carga «Gastos Previos» por 25,0 kCUP sin desglose (F08 p. 1); la plantilla incorpora 26,20 kCUP documentados con destino a salarios de preapertura y arrendamiento en preapertura y primeros 6 meses (F02; registro H-022). Brecha B-11.',
    motivo:
      'El 4.6 exige el desglose de inversión por concepto; además el destino documentado (hasta 6 meses de operación) sugiere que parte del gasto es de operación y no de inversión.',
    responde: 'Promotor (CSMC)',
    loResuelve: 'Desglose de los gastos previos por concepto, importe y moneda, con su tratamiento (inversión vs gasto del período).',
    prioridad: 'media',
    referencias: ['B-11', 'H-022', 'S-17'],
  },
  {
    id: 'Q-14',
    area: 'financiero_fiscal',
    titulo: 'Vida útil del equipamiento y criterio de depreciación',
    pregunta:
      '¿Qué vida útil económica se asigna a cada equipo y con qué norma se depreciará? ¿Se sustituye el monitor del equipo de rayos X (no cotizado) y con qué frecuencia se reponen los equipos principales?',
    contexto:
      'El expediente declara una tasa de depreciación del 6 % anual (≈16,7 años de vida útil) y su EERR carga depreciación acumulada como gasto del período (contradicción C-06); el modelo corrige la carga y aplica la depreciación anual a la tasa declarada (S-08). El monitor del equipo de rayos X reparado NO está cotizado en la inversión (brecha B-09; H-065).',
    motivo:
      'La vida útil determina la depreciación anual y el resultado contable de cada año; la reposición del monitor es un costo real no modelado para el servicio de radiografía (10 casos/mes previstos).',
    responde: 'Promotor (CSMC/Leisure)',
    loResuelve:
      'Tabla de vidas útiles por equipo (norma contable vigente para AEI o decisión del Consejo de Administración) y cotización de reposición del monitor de rayos X.',
    prioridad: 'alta',
    referencias: ['C-06', 'B-09', 'S-08', 'H-065'],
  },
  {
    id: 'Q-15',
    area: 'financiero_fiscal',
    titulo: 'Canon/arrendamiento tras los primeros 6 meses',
    pregunta: '¿Qué importe de canon o arrendamiento pagará la AEI desde el mes 7 en adelante?',
    contexto:
      'CSMC garantiza el arrendamiento en la preapertura y los primeros 6 meses (F02); el importe posterior NO consta (H-047, brecha B-18). El modelo usa 0,00 (S-10).',
    motivo: 'Un canon anual omitido sobreestima la utilidad de los años 2–10; su cuantía es material para el 4.7.',
    responde: 'Promotor (CSMC)',
    loResuelve: 'Importe del canon/arrendamiento mensual o anual a partir del mes 7 y su tratamiento contractual (¿incluido en el usufructo aportado?).',
    prioridad: 'alta',
    referencias: ['B-18', 'H-047', 'S-10'],
  },
  {
    id: 'Q-16',
    area: 'financiero_fiscal',
    titulo: 'Ingresos del año 2 en adelante: ¿por qué el EERR los reduce un 4,95 %?',
    pregunta: '¿El EERR reduce los ingresos un 4,95 % desde el año 2 por una razón documentada (menos demanda, menos precios), o es un error de cálculo que debe corregirse?',
    contexto:
      'El EERR del expediente (F08, p. 9) reduce los ingresos de los años 2–10 un 4,95 % frente al año 1, sin explicación (contradicción C-14). El modelo mantiene la demanda y los precios del año 1 (S-13) y registra la divergencia.',
    motivo:
      'La proyección de ingresos de 4.7 debe ser única y explicada; reproducir el −4,95 % sin causa o ignorarlo sin decisión afecta todos los indicadores del plan.',
    responde: 'Promotor (CSMC/Leisure)',
    loResuelve: 'Aclaración escrita del autor del anexo sobre la razón del −4,95 % (y su corrección si fue un error).',
    prioridad: 'media',
    referencias: ['C-14', 'S-13'],
  },
  {
    id: 'Q-17',
    area: 'financiero_fiscal',
    titulo: 'Año 1: ¿operación plena o arranque con 6 meses?',
    pregunta: '¿El año 1 del modelo es un año de operación plena (12 meses) o un año de arranque con solo 6 meses de operación y de materiales?',
    contexto:
      'La cotización F03 es un stock de 6 meses y el EERR computa 6 meses de materiales en el año 1 frente a 12 meses de ingresos (contradicción C-16; S-06).',
    motivo:
      'Si el año 1 opera 12 meses, su costo material se duplica y la utilidad del año 1 (ya negativa a tasas documentadas) empeora; el plan debe declarar el supuesto de arranque.',
    responde: 'Promotor (CSMC/Leisure)',
    loResuelve: 'Cronograma con la fecha real de apertura y el alcance de la operación del año 1 (coherente con Q-06).',
    prioridad: 'alta',
    referencias: ['C-16', 'S-06', 'B-15'],
  },
  {
    id: 'Q-18',
    area: 'financiero_fiscal',
    titulo: 'Mantenimiento y servicios públicos del Centro',
    pregunta: '¿Qué presupuesto anual realista de mantenimiento y servicios públicos debe cargar el plan, o quién los asume?',
    contexto:
      'El EERR declara «Gastos de Mantenimiento 0,0» y «Servicios Públicos 0,0» en todos los años (H-048), implausible para una instalación con rayos X, autoclave y climatización (brecha B-19; S-09).',
    motivo:
      'Cada kUSD anual omitido sobreestima la utilidad de TODO el horizonte; es una de las partidas de realismo que un evaluador cuestionará de inmediato.',
    responde: 'Promotor (CSMC)',
    loResuelve: 'Costo histórico o presupuesto de mantenimiento y servicios públicos de la Sucursal, y decisión de su asunción (AEI o CSMC).',
    prioridad: 'alta',
    referencias: ['B-19', 'S-09', 'H-048'],
  },

  // ------------------------------------------------------- mercado y precios
  {
    id: 'Q-19',
    area: 'mercado_precios',
    titulo: 'Estudio de mercado: demanda aparente y solvente',
    pregunta:
      '¿Existe un estudio de mercado con demanda aparente y demanda solvente por línea de servicio y por año (mercado externo turístico y mercado interno), o cuándo se elaborará?',
    contexto:
      'El expediente documenta demanda REPRESADA (73 pacientes de blanqueamiento rechazados en el quinquenio; prótesis al 75 % de su capacidad con ≈50 000 USD/año de ingreso histórico; TPR y blanqueamientos suspendidos — F09, H-061 a H-063), pero NO aporta estudio de mercado (brecha B-24). La demanda prevista de la tabla (115 814,00 USD/año) es una colocación de la lista, no un estudio.',
    motivo:
      'El 4.8 exige la caracterización del mercado y la demanda solvente que sustente los volúmenes proyectados; sin ella, los ingresos del plan no tienen sustento y ningún evaluador puede validarlos.',
    responde: 'Promotor (CSMC/Leisure)',
    loResuelve:
      'Estudio de mercado (externo: flujo turístico de Holguín y precio disposición a pagar; interno: demanda solvente en divisas) con su fuente y fecha, o compromiso con plazo de elaboración.',
    prioridad: 'critica',
    referencias: ['B-24', 'H-061', 'H-062', 'H-063'],
  },
  {
    id: 'Q-20',
    area: 'mercado_precios',
    titulo: 'Vigencia de la lista de precios de CSMC',
    pregunta:
      '¿La lista de precios en CUP «a tasa 1×120» sigue vigente en las condiciones del régimen cambiario actual, y con qué política se actualizará?',
    contexto:
      'Los precios de los 15 servicios provienen de la lista de CSMC en CUP con su equivalencia en USD a 120 (H-025/H-037). La tasa oficial vigente consultada el 29/10/2026 es 758,00 CUP/USD (C-01, V-07).',
    motivo:
      'Si la lista se actualiza o la política de precios cambia, los ingresos de 4.6/4.7 y la competitividad internacional del Centro cambian por completo.',
    responde: 'Promotor (CSMC)',
    loResuelve: 'Confirmación escrita de la vigencia de la lista de precios (fecha de aprobación) y política de revisión.',
    prioridad: 'alta',
    referencias: ['C-01', 'V-07', 'S-01'],
  },
  {
    id: 'Q-21',
    area: 'mercado_precios',
    titulo: 'Estudio de capacidad instalada y estrategia comercial',
    pregunta:
      '¿Con qué capacidad horaria/plazas opera el Centro (turnos, sillones, especialistas) y qué estrategia de comercialización por canal sustentará la demanda (turoperadores, hotelera, directa, aseguradoras)?',
    contexto:
      'El expediente no aporta estudio de capacidad (brecha B-10) ni estrategia de comercialización (brecha B-25); la demanda mensual prevista de la tabla es la única referencia y el balance externo computa la totalidad de los ingresos como exportación de servicios.',
    motivo:
      'El 4.4/4.8 exige compatibilidad entre capacidad instalada, demanda y producción prevista; sin capacidad documentada, la demanda prevista no puede validarse ni planificarse la fuerza de trabajo.',
    responde: 'Promotor (CSMC/Leisure)',
    loResuelve: 'Estudio de capacidad (sillones, turnos, horas especialista disponibles) y plan comercial por canal con metas anuales.',
    prioridad: 'alta',
    referencias: ['B-10', 'B-25'],
  },

  // --------------------------------------------- operación y fuerza de trabajo
  {
    id: 'Q-22',
    area: 'operacion_laboral',
    titulo: 'Entidad empleadora y modalidad de contratación',
    pregunta:
      '¿Quién contratará a los 10 trabajadores: directamente las partes de la AEI (ahora posible por el Decreto-Ley 128/2026, art. 30.1) o a través de una entidad empleadora autorizada? ¿Qué entidad figura como empleadora ante ONAT y seguridad social?',
    contexto:
      'El expediente no identifica a la entidad empleadora (brecha B-14); el nuevo artículo 30.1 de la Ley 118 (reformado por el Decreto-Ley 128/2026) admite ambas vías con la Resolución 56/2026 del MTSS. El beneficio país del expediente incluye «salario de trabajadores cubanos» que abarca al directivo extranjero (contradicción C-17).',
    motivo:
      'La modalidad de contratación determina quién carga el costo laboral, la seguridad social y el impuesto por utilización de la fuerza de trabajo (exento para AEI por la Ley 118, art. 39), y afecta el beneficio país (C-17).',
    responde: 'Promotor (CSMC/Leisure)',
    loResuelve: 'Decisión de las partes sobre la entidad empleadora y la modalidad, con la identificación fiscal correspondiente.',
    prioridad: 'alta',
    referencias: ['B-14', 'C-17'],
  },
  {
    id: 'Q-23',
    area: 'operacion_laboral',
    titulo: 'Escala salarial definitiva y cargas de seguridad social',
    pregunta:
      '¿Cuál es la escala salarial definitiva por plaza (incluido el directivo extranjero) y si el costo de 4 320 kCUP/año incluye o no la seguridad social?',
    contexto:
      'Existen tres versiones de salarios en el expediente (contradicción C-07): el EERR carga 4 320 kCUP/año como fuerza de trabajo (H-035), el anexo de fuerza de trabajo añade seguridad social (540,0) y provisión (86,4) que no concilian con el EERR, y la escala por plaza del propio anexo (H-090) suma un total distinto. El modelo adopta el 4 320 kCUP/año como costo TOTAL (S-07) con escala derivada de fórmula conservada.',
    motivo:
      'El costo laboral es la partida fija mayor del plan: si las cargas no están incluidas, el costo anual sube ≈12,5 % y cambia todo el resultado.',
    responde: 'Promotor (CSMC)',
    loResuelve: 'Plantilla aprobada con escala salarial por plaza, aclaración de las cargas incluidas en el 4 320 kCUP/año (o el monto a sumar) y tratamiento del salario del directivo extranjero (C-17).',
    prioridad: 'critica',
    referencias: ['C-07', 'B-14', 'S-07', 'H-035', 'H-090'],
  },
  {
    id: 'Q-24',
    area: 'operacion_laboral',
    titulo: 'Licencias sanitarias y registros para prestar servicios internacionales',
    pregunta:
      '¿Qué licencias, registros y autorizaciones sanitarias necesita el Centro para prestar servicios estomatológicos internacionales, y cuáles existen ya otorgadas?',
    contexto:
      'El contrato compromete a CSMC a gestionar «licencias comerciales y sanitarias, registros, autorizaciones locales para nuevas tecnologías, aval técnico de los medios y nomenclador de importación/exportación» (F01, cláusula 8.1), pero el expediente no adjunta ninguna (validación V-06).',
    motivo:
      'El 4.8 (requisitos regulatorios) y la operatividad legal del Centro dependen de estas licencias; presentar el plan sin su estado real es un vacío regulatorio evidente.',
    responde: 'Promotor (CSMC)',
    loResuelve: 'Relación de licencias/registros exigibles con su norma y el estado de cada trámite (otorgada, en trámite, pendiente).',
    prioridad: 'alta',
    referencias: ['V-06'],
  },

  // --------------------------------------------- suministros e inversión
  {
    id: 'Q-25',
    area: 'suministros_inversion',
    titulo: 'Contrato de suministro continuo de insumos',
    pregunta:
      '¿Existe contrato o compromiso de suministro continuo de insumos (y con qué proveedor/cadena), y cómo se concilian el cuadro básico de 71 renglones con la cotización de ≈60?',
    contexto:
      'La cotización F03 cubre ≈60 renglones por 63 581,30 USD (stock de 6 meses), mientras la sucursal declara un cuadro básico de 71 renglones: conciliación pendiente (brecha B-23). El servicio TPR exige limas NO incluidas en la cotización (brecha B-20) y el blanqueamiento depende de un «donativo inicial» de 500 kits sin cotizar (brecha B-21).',
    motivo:
      'Sin contrato de suministro, la operación del año 2 en adelante carece de respaldo de costos; sin conciliar 71 vs 60, el costo material anual (127,2 kUSD) puede estar subestimado.',
    responde: 'Promotor (Leisure)',
    loResuelve:
      'Contrato o carta de intención de suministro con vigencia y precios; conciliación cuadro básico/cotización; cotización de limas para TPR y alcance del donativo de kits de blanqueamiento.',
    prioridad: 'alta',
    referencias: ['B-20', 'B-21', 'B-22', 'B-23'],
  },
  {
    id: 'Q-26',
    area: 'suministros_inversion',
    titulo: 'Decisión sobre el escáner intraoral 3D',
    pregunta: '¿Se incluye el escáner intraoral 3D (12 035,00 USD, cotizado en F02) en la inversión del proyecto, se excluye, o se difiere a una fase posterior?',
    contexto:
      'El escáner está cotizado en F02 pero NO aparece en la tabla de inversión del anexo (contradicción C-08, brecha B-07). Las tecnologías prometidas (rehabilitación protésica digital, cirugía guiada, ortodoncia digital) lo hacen plausible.',
    motivo:
      'Su inclusión eleva la inversión ≈230 % sobre los equipos actuales; su exclusión exige declarar con qué medios se prestarán los servicios digitales del objeto contractual.',
    responde: 'Promotor (CSMC/Leisure)',
    loResuelve: 'Decisión escrita de las partes (incluir/excluir/diferir) y, si se incluye, cotización formal con vida útil y depreciación.',
    prioridad: 'alta',
    referencias: ['C-08', 'B-07', 'S-14'],
  },

  // --------------------------------------------- validaciones normativas
  {
    id: 'Q-27',
    area: 'normativo_validaciones',
    titulo: 'Paquete de validaciones normativas y administrativas',
    pregunta:
      '¿Cuál es el estado documental de las ocho validaciones pendientes del expediente (aprobación de la AEI, inscripción del CAEI, exención arancelaria, licencias sanitarias, registro de marca) y quién gestionará cada una?',
    contexto:
      'Validaciones registradas del expediente: V-01 aprobación de la constitución; V-02 inscripción registral del CAEI y licencia comercial; V-03 vigencia del marco normativo invocado; V-04 exención arancelaria; V-05 régimen tributario; V-06 licencias sanitarias; V-07 tipo de cambio oficial; V-08 registro de marca y permisos de anuncios. Ninguna tiene evidencia adjunta (estados: invocada_sin_evidencia, pendiente_verificacion o no_invocada).',
    motivo:
      'La presentación formal de la propuesta exige acreditar los requisitos que el propio expediente invoca; el plan no puede afirmar cumplimiento sin evidencia.',
    responde: 'Especialista designado',
    loResuelve:
      'Tabla de seguimiento con las 8 validaciones, autoridad competente de cada una, norma aplicable, documento que la acredita y fecha objetivo de cierre.',
    prioridad: 'alta',
    referencias: ['V-01', 'V-02', 'V-03', 'V-04', 'V-05', 'V-06', 'V-07', 'V-08'],
  },
  {
    id: 'Q-28',
    area: 'normativo_validaciones',
    titulo: 'Operativa de divisas de la AEI bajo el régimen vigente',
    pregunta:
      '¿Con qué operativa de divisas trabajará la AEI (cuentas en divisas, capacidad de acceso asignada) y qué requisitos del Decreto-Ley 113/2025 y sus resoluciones le aplican?',
    contexto:
      'El Decreto-Ley 113/2025 y la Resolución 140/2025 del MEP (modificada en 2026) regulan las transacciones en divisas con las asociaciones económicas internacionales expresamente dentro de su ámbito; el Decreto-Ley 128/2026 permite a las partes de AEI cuentas en bancos del exterior con notificación al BCU (Resolución 100/2026). El balance externo del expediente computa la totalidad de los ingresos como exportación de servicios, pero con TRES totales incompatibles entre sus propias páginas (C-03: 3 255,84 / 2 925,19 / 2 783,35 kUSD) y con un beneficio país que no concilia entre anexo y resumen (C-04).',
    motivo:
      'La recaudación (ingresos en divisas), el pago de insumos importados y las utilidades a distribuir dependen de la operativa de divisas aprobada; sin ella, ni el balance externo (4.12) ni el reparto (4.11) son verificables.',
    responde: 'Promotor (CSMC/Leisure)',
    loResuelve:
      'Confirmación bancaria de la operativa de divisas del negocio (cuentas, monedas, capacidad de acceso a la divisa) conforme al régimen vigente.',
    prioridad: 'alta',
    referencias: ['C-03', 'C-04'],
  },
];

/** Censos por área y prioridad (portada y resumen del documento). */
export function resumenConsultas() {
  const porArea = CONSULTAS.reduce((acc, c) => {
    acc[c.area] = (acc[c.area] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const porPrioridad = CONSULTAS.reduce((acc, c) => {
    acc[c.prioridad] = (acc[c.prioridad] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return {
    total: CONSULTAS.length,
    porArea,
    porPrioridad,
    criticas: CONSULTAS.filter((c) => c.prioridad === 'critica').length,
    altas: CONSULTAS.filter((c) => c.prioridad === 'alta').length,
  };
}
