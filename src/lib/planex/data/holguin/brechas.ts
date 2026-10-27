// ============================================================================
// PLANEX-DATA-001 — Brechas de información, contradicciones y validaciones
// normativas del expediente Holguín.
//
// Este módulo se deriva del registro (registro.ts): cada brecha cita los
// identificadores H-### que la sustentan y cada contradicción conserva
// AMBOS valores con su localizador. Nada se resuelve en silencio: la
// misión exige que las contradicciones permanezcan visibles y que las
// decisiones económicas o jurídicas queden para el promotor.
// ============================================================================

import { dato } from './registro';

export type PrioridadBrecha = 'bloqueante' | 'alta' | 'media' | 'baja';
export type SeveridadContradiccion = 'critica' | 'alta' | 'media' | 'baja';
export type BloqueCierre =
  | 'estructura'
  | 'financiero'
  | 'mercado_operacion'
  | 'juridico_admin'
  | 'no_bloqueante';

export interface Brecha {
  id: string;
  titulo: string;
  epigrafe: string;
  /** Información concreta que falta (nunca «falta información»). */
  falta: string;
  /** Por qué es necesaria. */
  motivo: string;
  /** Qué debe aportar el promotor (documento, dato o decisión). */
  requiere: string;
  responsable: 'Promotor (CSMC/Leisure)' | 'Promotor (CSMC)' | 'Promotor (Leisure)' | 'Especialista designado';
  prioridad: PrioridadBrecha;
  bloque: BloqueCierre;
  /** Brechas que se cierran junto con esta. */
  dependencias: string[];
  /** Criterio objetivo de cierre. */
  criterioCierre: string;
  /** Datos del registro que sustentan la brecha. */
  registroIds: string[];
}

export interface Contradiccion {
  id: string;
  titulo: string;
  /** Valores en conflicto con su fuente y localizador. */
  valores: { valor: string; fuenteLocalizador: string }[];
  severidad: SeveridadContradiccion;
  /** Efecto sobre la evaluación si no se resuelve. */
  impacto: string;
  /** Decisión o evidencia que la resuelve. */
  accionRequerida: string;
  registroIds: string[];
}

export interface ValidacionNormativa {
  id: string;
  requisito: string;
  /** Norma invocada por el expediente (con su cita literal). */
  normaInvocada: string;
  /** Evidencia de cumplimiento aportada por el expediente. */
  evidenciaExpediente: string;
  estado: 'invocada_sin_evidencia' | 'parcial' | 'pendiente_verificacion' | 'no_invocada';
  /** Qué validaría o qué documento falta. */
  pendiente: string;
  registroIds: string[];
}

// ---------------------------------------------------------------------------
// CONTRADICCIONES (cada una conserva ambos valores)
// ---------------------------------------------------------------------------

export const CONTRADICCIONES: Contradiccion[] = [
  {
    id: 'C-01',
    titulo: 'Tasa de cambio 24 frente a 120 en el mismo modelo',
    valores: [
      { valor: '24 CUP/USD', fuenteLocalizador: 'Encabezados «tasa de cambio de 1*24» de TODAS las tablas de F08 y de la tabla de aportaciones de F02.' },
      { valor: '120 CUP/USD', fuenteLocalizador: 'Tabla de servicios «A TASA DE 1*120» (F02 y F08 p. 23); precios por caso en USD de F09 (TPR 80,00; blanqueamiento 150,00) que equivalen a los precios CUP ÷ 120.' },
    ],
    severidad: 'critica',
    impacto:
      'BLOQUEANTE DEL MODELO FINANCIERO. El expediente valora los insumos y equipos importados a 24 CUP/USD (63 581,30 USD → 1 526,0 kCUP) pero genera los ingresos a precios nacidos de la tasa 120. A tasa única verificable (120), el costo material real (127,2 kUSD/año desde el año 2) EXCEDE el ingreso anual a precios de lista (115,8 kUSD): la rentabilidad declarada del expediente desaparece. Todos los totales en «MUSD» del expediente (ventas 5 532,9; utilidad 2 439,5; balance externo 2 783,35) dependen de la tasa 24 y no son verificables.',
    accionRequerida:
      'Decisión del promotor con sustento normativo: (1) tasa oficial aplicable a la contabilidad de la AEI (Banco Central de Cuba, fecha de referencia); (2) tasa de conversión aplicable a la lista de precios CSMC; (3) tratamiento cambiario de los aportes en especie importados. Con la tasa decidida, el modelo se recalcula cambiando UN parámetro.',
    registroIds: ['H-025', 'H-029', 'H-037', 'H-040'],
  },
  {
    id: 'C-02',
    titulo: 'Indicadores del resumen frente a los del anexo de cálculo',
    valores: [
      { valor: 'VAN 24 709,58 · TIR 1387,85 % · recuperación 0,84 años · RVAN 162,74', fuenteLocalizador: 'F02, párrafo «evaluación de la viabilidad».' },
      { valor: 'VAN 20 771,60 · TIR 904,02 % · recuperación actualizada 0,92 años · RVAN 136,96', fuenteLocalizador: 'F08, p. 11 (flujo de caja, tasa 20 %).' },
    ],
    severidad: 'alta',
    impacto:
      'Ninguna serie de indicadores es confiable: provienen de un modelo con depreciación mal cargada (C-06) y tasa de cambio discutida (C-01), y ni siquiera coinciden entre el resumen y su propio anexo.',
    accionRequerida: 'Recalcular los indicadores con el modelo corregido y la tasa decidida; no citar los valores del expediente en presentaciones oficiales.',
    registroIds: ['H-043', 'H-046'],
  },
  {
    id: 'C-03',
    titulo: 'Tres totales del balance financiero externo',
    valores: [
      { valor: '3 255,84 kUSD', fuenteLocalizador: 'F08, p. 10 (Efecto neto sobre las divisas).' },
      { valor: '2 925,19 kUSD', fuenteLocalizador: 'F08, p. 20 (Resumen del balance externo).' },
      { valor: '2 783,35 «MUSD»', fuenteLocalizador: 'F02, párrafo del Balance Financiero Externo.' },
    ],
    severidad: 'media',
    impacto: 'El efecto sobre las divisas no puede citarse: tres páginas del mismo expediente dan tres totales distintos.',
    accionRequerida: 'Identificar qué tabla es la vigente y recalcular el balance externo con la tasa decidida.',
    registroIds: ['H-044'],
  },
  {
    id: 'C-04',
    titulo: 'Beneficio país: anexo frente a resumen',
    valores: [
      { valor: '78 266,44 kCUP (10 años)', fuenteLocalizador: 'F08, p. 19 (tabla BENEFICIO PAÍS con desglose).' },
      { valor: '36 762,93 «MCUP»', fuenteLocalizador: 'F02, párrafo «El Beneficio País es igualmente positivo…».' },
    ],
    severidad: 'media',
    impacto: 'La diferencia (41 503,5) no se explica; el resumen parece provenir de una versión anterior del modelo.',
    accionRequerida: 'Aclarar la versión vigente del cálculo de beneficios al país.',
    registroIds: ['H-045'],
  },
  {
    id: 'C-05',
    titulo: 'Distribución 50/50 pactada frente a participación 49/51 declarada',
    valores: [
      { valor: '50 % / 50 % (dividendos por igual a cada parte)', fuenteLocalizador: 'F01, cláusula 7.5; EERR de F08 p. 9 (25 530,0 a cada socio).' },
      { valor: '49 % cubana / 51 % extranjera', fuenteLocalizador: 'Tabla de aportaciones de F02 y F08 p. 1.' },
    ],
    severidad: 'media',
    impacto: 'La regla de reparto y la composición del fondo común no cuadran: el diagnóstico de la app señala la incoherencia en cada recálculo.',
    accionRequerida: 'Pactar expresamente la regla (¿reparto paritario con participación 49/51?) y documentarla en el contrato definitivo.',
    registroIds: ['H-013', 'H-026', 'H-027', 'H-028'],
  },
  {
    id: 'C-06',
    titulo: 'El EERR carga la depreciación acumulada como gasto del período',
    valores: [
      { valor: 'Depreciación anual del equipo: 7,6 kCUP/año (tasa 6 %)', fuenteLocalizador: 'F08, p. 14 (DEPRECIACION: 7,6 por período).' },
      { valor: 'Gasto cargado en el EERR: 12,8 / 20,4 / 28,0 / … / 75,9 (acumulada, total 417,7)', fuenteLocalizador: 'F08, p. 8 (EERR, fila «Depreciación y Amortización»).' },
    ],
    severidad: 'alta',
    impacto:
      'Los años 2–10 soportan un gasto por depreciación creciente e incorrecto (el doble contable: 417,7 kCUP cargados frente a 76,0 reales): la UAI de la explotación está SUBESTIMADA en el expediente y la utilidad no distribuye lo que debería.',
    accionRequerida: 'Corregir el EERR fuente (gasto = 7,6/año + amortización 5,2/años 1–5) y recalcular. El motor de PLANEX ya lo hace así.',
    registroIds: ['H-031', 'H-032'],
  },
  {
    id: 'C-07',
    titulo: 'Tres versiones de salarios incompatibles',
    valores: [
      { valor: '146 000 CUP/mes (plantilla de 10 plazas: 126 000 cubanos + 20 000 extranjero)', fuenteLocalizador: 'F08, p. 21 (tabla de fuerza de trabajo).' },
      { valor: '360 000 CUP/mes implícitos (EERR: 3 072,0 directo + 1 248,0 administrativo = 4 320,0 kCUP/año)', fuenteLocalizador: 'F08, p. 8 y p. 19.' },
      { valor: 'Escala básica: médico 5 750; licenciadas 4 210; asistente 2 810 CUP/mes', fuenteLocalizador: 'F07, tabla de capital humano.' },
    ],
    severidad: 'alta',
    impacto:
      'El costo laboral del EERR es 2,47 veces la plantilla declarada (y 6–7 veces la escala básica de F07): o la plantilla está incompleta (¿estimulación, pagos en divisas, seguridad social?) o el EERR sobrecarga salarios. Afecta la UAI y el beneficio país (los salarios son el 55 % del beneficio país del anexo).',
    accionRequerida: 'Aportar la composición salarial real por plaza (escala + estimulación + cargas) y la base del 4 320,0 kCUP/año.',
    registroIds: ['H-035', 'H-036', 'H-090', 'H-091'],
  },
  {
    id: 'C-08',
    titulo: 'Escáner intraoral 3D: cotizado en F02, ausente del modelo',
    valores: [
      { valor: 'Incluido: 12 035,00 USD (inversión total de la variante: 17 309,00 USD)', fuenteLocalizador: 'F02, tabla de equipamiento (6 filas) y Tabla 3.' },
      { valor: 'Excluido: la inversión fija del modelo queda en 5 274,00 USD (5 filas)', fuenteLocalizador: 'F06, cotización; F08, p. 5 y p. 15.' },
    ],
    severidad: 'media',
    impacto: 'La decisión sobre el escáner cambia la inversión fija en +12 035 USD (×3,3) y su depreciación; F02 lo recomienda («incrementar el escáner intraoral 3D») pero el cálculo no lo asume.',
    accionRequerida: 'Decisión del promotor: incorporarlo (y recotizar con su mantenimiento) o excluirlo definitivamente.',
    registroIds: ['H-024', 'H-021'],
  },
  {
    id: 'C-09',
    titulo: 'Domicilio de Leisure Exporting LLC',
    valores: [
      { valor: '3964 South Cir Largo, Florida 37774', fuenteLocalizador: 'F01, encabezamiento del contrato.' },
      { valor: '6800 N Ave., Tampa, Florida 33604', fuenteLocalizador: 'F03/F06, membrete de la cotización; F08, p. 2.' },
    ],
    severidad: 'media',
    impacto: 'El domicilio legal de una parte del contrato no puede quedar ambiguo en un instrumento destinado a inscripción registral.',
    accionRequerida: 'Acreditación registral vigente de Leisure Exporting LLC (Florida Division of Corporations) y unificación del domicilio.',
    registroIds: ['H-008'],
  },
  {
    id: 'C-10',
    titulo: 'Tres abreviaturas de la entidad cubana (SMC / CSMC / CMSM)',
    valores: [
      { valor: '«CSMC, S.A.»', fuenteLocalizador: 'F01 y F02 (forma dominante en el contrato).' },
      { valor: '«SMC»', fuenteLocalizador: 'F02, introducción; encabezado de cotizaciones «Sucursal Holguín de SMC».' },
      { valor: '«CMSM»', fuenteLocalizador: 'F02, encabezado de la tabla de servicios («LISTADO DE PRECIOS DE CMSM»).' },
    ],
    severidad: 'media',
    impacto: 'Riesgo de identificación registral inconsistente en el instrumento jurídico y en el plan.',
    accionRequerida: 'Uniformar con la razón social inscrita (Registro Mercantil) en la versión definitiva del contrato.',
    registroIds: ['H-003', 'H-004'],
  },
  {
    id: 'C-11',
    titulo: 'Aportes (3 252,53) frente a inversión (152,78) en la misma página de financiamientos',
    valores: [
      { valor: 'Aportes o aportaciones: 3 252,53 kCUP', fuenteLocalizador: 'F08, p. 7 (FINANCIAMIENTOS).' },
      { valor: 'Costo de Inversión Inicial: 152,78 kCUP; «Necesidad de financiamiento externo 0,00»', fuenteLocalizador: 'F08, p. 7 y p. 5.' },
    ],
    severidad: 'alta',
    impacto:
      'La aritmética de la página es imposible (152,78 − 3 252,53 ≠ 0,00) y el estado de situación convierte el excedente en «efectivo en banco» inicial de 3 099,75 kCUP, tratando los insumos aportados en especie (1 526,0) como si fueran caja: los activos quedan doble-contados al arranque.',
    accionRequerida: 'Reconstruir la página de financiamientos separando aportes dinerarios de aportes en especie y definir el destino del excedente de caja.',
    registroIds: ['H-028', 'H-030', 'H-020'],
  },
  {
    id: 'C-12',
    titulo: 'Utilidad distribuible del resumen frente a utilidades a distribuir del EERR',
    valores: [
      { valor: '58 547,0 «MCUP» distribuibles', fuenteLocalizador: 'F02, párrafo de utilidad distribuible.' },
      { valor: '51 059,9 kCUP utilidades a distribuir (25 529,9 por socio)', fuenteLocalizador: 'F08, p. 9 (EERR).' },
    ],
    severidad: 'media',
    impacto: 'Las cifras de reparto citables difieren entre resumen y anexo (7 487,1 kCUP de diferencia).',
    accionRequerida: 'Recalcular con el modelo corregido; no citar la cifra del resumen.',
    registroIds: ['H-042'],
  },
  {
    id: 'C-13',
    titulo: 'Costos y gastos totales: resumen frente a EERR',
    valores: [
      { valor: '52 513,1 «MCUP» (2 188,0 «MUSD»)', fuenteLocalizador: 'F02, párrafo de Costos y Gastos.' },
      { valor: '59 713,07 kCUP de operación (60 156,7 con depreciación e intereses)', fuenteLocalizador: 'F08, p. 8 (EERR).' },
    ],
    severidad: 'media',
    impacto: 'El resumen subestima los costos del anexo en 7 200 kCUP: las citas del resumen no son utilizables.',
    accionRequerida: 'Unificar con el anexo corregido.',
    registroIds: ['H-042'],
  },
  {
    id: 'C-14',
    titulo: 'Ingresos del año 2 en adelante un 4,95 % menores sin explicación',
    valores: [
      { valor: 'Año 1: 13 897,68 kCUP', fuenteLocalizador: 'F08, p. 8 y tabla de servicios.' },
      { valor: 'Años 2–10: 13 210,22 kCUP/año', fuenteLocalizador: 'F08, p. 8 (EERR).' },
    ],
    severidad: 'media',
    impacto: 'La caída de 687,46 kCUP/año no está justificada (¿descuento, calendario, menor actividad?) y arrastra UAI, dividendos y beneficio país.',
    accionRequerida: 'Justificar la serie de ingresos o unificarla con la tabla de servicios (la plantilla mantiene la demanda constante del año 1).',
    registroIds: ['H-038', 'H-039'],
  },
  {
    id: 'C-15',
    titulo: 'Impuesto sobre utilidades solo en los años 8–10 sin base legal citada',
    valores: [
      { valor: 'Años 1–7: 0,00 de impuesto', fuenteLocalizador: 'F08, p. 9 (EERR).' },
      { valor: 'Años 8–10: 15 % de las utilidades imponibles (903,94 / 902,86 / 901,78)', fuenteLocalizador: 'F08, p. 9 y p. 11.' },
    ],
    severidad: 'alta',
    impacto: 'La rentabilidad de los años 1–7 depende de una exención fiscal NO ACREDITADA: si la exención no procede, la utilidad neta del período baja ≈15 % cada año.',
    accionRequerida: 'Verificar el beneficio fiscal de la Ley 118 (y su Reglamento) para la modalidad AEI: artículo exacto, duración y requisitos; adjuntar la consulta o respuesta de la autoridad.',
    registroIds: ['H-033'],
  },
  {
    id: 'C-16',
    titulo: 'Materiales del año 1 por valor de solo 6 meses frente a un año completo de ingresos',
    valores: [
      { valor: 'Año 1: 1 526,0 kCUP de materiales (stock de 6 meses de la cotización)', fuenteLocalizador: 'F08, p. 8; F02 («stock para los primeros 6 meses»).' },
      { valor: 'Año 1: 13 897,68 kCUP de ingresos (12 meses de operación)', fuenteLocalizador: 'F08, p. 8.' },
    ],
    severidad: 'media',
    impacto: 'El año 1 reconoce un año de ingresos con medio año de consumo material: la UAI del año 1 está SOBREESTIMADA frente a los años siguientes.',
    accionRequerida: 'Aclarar si el stock aportado cubre 6 o 12 meses y alinear consumo e ingresos.',
    registroIds: ['H-029', 'H-040', 'H-038'],
  },
  {
    id: 'C-17',
    titulo: '«Salario de trabajadores cubanos» del beneficio país incluye al directivo extranjero',
    valores: [
      { valor: 'Partida «Salario de trabajadores cubanos»: 4 320,00 kCUP/año', fuenteLocalizador: 'F08, p. 19 (BENEFICIO PAÍS).' },
      { valor: 'Total salarial del modelo incluido el extranjero: 4 320,0 kCUP/año (extranjero: 240,0)', fuenteLocalizador: 'F08, p. 21.' },
    ],
    severidad: 'baja',
    impacto: 'La partida sobreestima el beneficio país cubano en 240,0 kCUP/año (2,4 M CUP en 10 años) por etiquetado impreciso.',
    accionRequerida: 'Corregir la etiqueta o excluir el salario extranjero del beneficio país.',
    registroIds: ['H-045', 'H-035'],
  },
];

// ---------------------------------------------------------------------------
// BRECHAS (qué falta y cómo cerrarlo)
// ---------------------------------------------------------------------------

export const BRECHAS: Brecha[] = [
  {
    id: 'B-01',
    titulo: 'Responsable de la elaboración del plan',
    epigrafe: '4.1',
    falta: 'Nombre, cargo, firma, fecha de elaboración y declaración de responsabilidad sobre la veracidad de los datos (4.1).',
    motivo: 'La metodología exige identificar al elaborador y su declaración responsable; el contrato está sin firmar y la valoración no consigna autor.',
    requiere: 'Quien elabora el plan (nombre y cargo), fecha y firma (o la designación formal del especialista).',
    responsable: 'Promotor (CSMC)',
    prioridad: 'alta',
    bloque: 'estructura',
    dependencias: [],
    criterioCierre: 'Apartado 4.1 completo con elaborador identificado y declaración aceptada en la app.',
    registroIds: ['H-005'],
  },
  {
    id: 'B-02',
    titulo: 'Denominación formal del proyecto e identificación comercial',
    epigrafe: '4.2',
    falta: 'Título formal del proyecto y la identificación comercial pactada (en blanco en el contrato).',
    motivo: 'El expediente usa variantes («Centro Estomatológico Internacional», «Clínica Estomatológica Holguín», «Centro Internacional Estomatológico») sin fijar la denominación.',
    requiere: 'Decisión escrita de las partes sobre la denominación del Centro y su identificación comercial.',
    responsable: 'Promotor (CSMC/Leisure)',
    prioridad: 'alta',
    bloque: 'estructura',
    dependencias: [],
    criterioCierre: 'Denominación única usada en contrato, plan y tabla de aportaciones.',
    registroIds: ['H-001', 'H-016'],
  },
  {
    id: 'B-03',
    titulo: 'Resumen ejecutivo',
    epigrafe: '4.4',
    falta: 'Resumen ejecutivo narrativo (negocio, entidades, inversión, tiempo del proceso inversionista y resultados esperados).',
    motivo: 'La valoración económica no lo contiene; las cifras del modelo corregido aún dependen de decisiones (tasa, escáner).',
    requiere: 'Redactar el resumen tras resolver C-01 y C-08 (la app genera las cifras desde el modelo).',
    responsable: 'Especialista designado',
    prioridad: 'media',
    bloque: 'estructura',
    dependencias: ['B-04', 'B-07'],
    criterioCierre: 'Apartado 4.4 redactado con cifras del modelo activo y verificado contra el registro.',
    registroIds: [],
  },
  {
    id: 'B-04',
    titulo: 'Regla de reparto frente a composición del fondo común',
    epigrafe: '4.5 j)',
    falta: 'Aclaración escrita de la regla de distribución (50/50) frente a la participación declarada (49/51).',
    motivo: 'Ambas cifras conviven sin explicación; afecta dividendos y beneficio país.',
    requiere: 'Cláusula contractual expresa que concilie participación y reparto (o corrección de la tabla de aportes).',
    responsable: 'Promotor (CSMC/Leisure)',
    prioridad: 'alta',
    bloque: 'financiero',
    dependencias: [],
    criterioCierre: 'Contrato y tabla de aportaciones concilian (el diagnóstico de la app deja de marcar la incoherencia).',
    registroIds: ['H-013', 'H-028'],
  },
  {
    id: 'B-05',
    titulo: 'Acreditación registral de Leisure Exporting LLC y domicilio único',
    epigrafe: '4.5 g)',
    falta: 'Certificación registral vigente (Florida Division of Corporations), domicilio legal único y experiencia/vínculos de la inversionista.',
    motivo: 'Dos domicilios contradictorios (C-09) y la caracterización de experiencia requerida por 4.5 g) no consta.',
    requiere: 'Documento registral vigente y nota de experiencia comercial de Leisure Exporting LLC.',
    responsable: 'Promotor (Leisure)',
    prioridad: 'alta',
    bloque: 'juridico_admin',
    dependencias: [],
    criterioCierre: 'Domicilio único acreditado y 4.5 g) completo.',
    registroIds: ['H-006', 'H-008'],
  },
  {
    id: 'B-06',
    titulo: 'Avalúo y certificado del derecho de usufructo del inmueble',
    epigrafe: '4.5 i)',
    falta: 'Dirección exacta del inmueble, avalúo del derecho real de usufructo aportado y Certificado de la Dirección de Patrimonio (MFP) cuando aplique.',
    motivo: 'El contrato aporta el usufructo «por valor de ______»: sin valor ni inmueble identificado la aportación no puede valorarse.',
    requiere: 'Identificación del inmueble, avalúo y certificación de Patrimonio.',
    responsable: 'Promotor (CSMC)',
    prioridad: 'bloqueante',
    bloque: 'juridico_admin',
    dependencias: [],
    criterioCierre: 'Usufructo identificado y valorado con certificación adjunta (la tabla de aportaciones completa su fila de derechos reales).',
    registroIds: ['H-011', 'H-026'],
  },
  {
    id: 'B-07',
    titulo: 'Decisión sobre el escáner intraoral 3D',
    epigrafe: '4.10 a)',
    falta: 'Decisión de incluir o excluir el escáner intraoral 3D (12 035,00 USD cotizados) y, si se incluye, su cotización de mantenimiento.',
    motivo: 'C-08: la inversión puede crecer ×3,3; F02 lo recomienda pero el modelo no lo incluye.',
    requiere: 'Decisión de las partes + cotización formal actualizada.',
    responsable: 'Promotor (CSMC/Leisure)',
    prioridad: 'alta',
    bloque: 'financiero',
    dependencias: [],
    criterioCierre: 'Inversión fija única (5 o 6 equipos) reflejada en cotización, contrato y modelo.',
    registroIds: ['H-024', 'H-021'],
  },
  {
    id: 'B-08',
    titulo: 'Localización exacta e infraestructura del Centro',
    epigrafe: '4.6 d)',
    falta: 'Dirección del inmueble, características (áreas, gabinetes, servicios), infraestructura disponible y soportes gráficos.',
    motivo: 'Solo consta «provincia Holguín»; 4.6 d) exige dirección, infraestructura y terrenos/instalaciones.',
    requiere: 'Datos catastrales/arquitectónicos del inmueble y plano o fotos.',
    responsable: 'Promotor (CSMC)',
    prioridad: 'alta',
    bloque: 'estructura',
    dependencias: ['B-06'],
    criterioCierre: '4.6 d) completo con dirección y soporte gráfico.',
    registroIds: ['H-011', 'H-068'],
  },
  {
    id: 'B-09',
    titulo: 'Reposición del monitor del equipo de rayos X',
    epigrafe: '4.10 a)',
    falta: 'Cotización del monitor del equipo de rayos X (condición para reactivar radiografía — 30/mes previstos — y TPR).',
    motivo: 'H-065: el equipo está inoperativo y su reparación NO está en la inversión cotizada; los ingresos de radiografía del plan carecen de soporte de capacidad.',
    requiere: 'Cotización del monitor (o decisión de sustituir el equipo) antes de aprobar la proyección de radiografía y TPR.',
    responsable: 'Promotor (Leisure)',
    prioridad: 'alta',
    bloque: 'mercado_operacion',
    dependencias: [],
    criterioCierre: 'Partida de inversión o aporte que cubra el monitor, y servicio de radiografía respaldado.',
    registroIds: ['H-065', 'H-037'],
  },
  {
    id: 'B-10',
    titulo: 'Estudio de capacidad instalada',
    epigrafe: '4.6 b)',
    falta: 'Horas de utilización por recurso (2 gabinetes, imagenología, banco de prótesis, profesionales), duración media por procedimiento y capacidad mensual resultante.',
    motivo: 'El expediente no aporta duraciones ni horarios; la plantilla NO INVENTA capacidad (la demanda prevista circula sin límite y el diagnóstico lo marca).',
    requiere: 'Estudio de capacidad con duraciones por servicio y calendario de atención (o cronometrajes reales).',
    responsable: 'Promotor (CSMC)',
    prioridad: 'alta',
    bloque: 'mercado_operacion',
    dependencias: [],
    criterioCierre: 'Tabla de recursos con horas y duraciones documentadas; la app limita la producción por capacidad.',
    registroIds: ['H-068', 'H-037'],
  },
  {
    id: 'B-11',
    titulo: 'Desglose de los gastos previos (25,0 kCUP sin detallar)',
    epigrafe: '4.7 a)',
    falta: 'Composición de los «Otros gastos de Pre-Operación 25,00» kCUP y su eventual solape con salarios de preapertura (aportados por CSMC según F02).',
    motivo: 'Sin desglose no se puede verificar que los gastos previos no dupliquen costos de preapertura.',
    requiere: 'Presupuesto de preapertura desglosado (trámites, remodelación menor, salarios, arrendamiento).',
    responsable: 'Promotor (CSMC)',
    prioridad: 'media',
    bloque: 'financiero',
    dependencias: [],
    criterioCierre: 'Gastos previos desglosados por concepto sin doble contabilización con la preapertura.',
    registroIds: ['H-022', 'H-026'],
  },
  {
    id: 'B-12',
    titulo: 'Capital de trabajo inicial',
    epigrafe: '4.7 a)',
    falta: 'Justificación del capital de trabajo en 0,00 o definición del colchón necesario.',
    motivo: 'El propio estado de situación proyecta existencias y cuentas por cobrar: un capital de trabajo nulo es improbable y expone la operación a faltantes de caja.',
    requiere: 'Política de capital de trabajo (inventarios, cuentas por cobrar 30 días, caja 10 días según el anexo).',
    responsable: 'Promotor (CSMC/Leisure)',
    prioridad: 'media',
    bloque: 'financiero',
    dependencias: [],
    criterioCierre: 'Parámetro de capital de trabajo justificado (o su justificación explícita en 0).',
    registroIds: ['H-023'],
  },
  {
    id: 'B-13',
    titulo: 'Consumo de materiales por servicio',
    epigrafe: '4.8 c)',
    falta: 'Desglose del consumo de insumos por línea de servicio (la cotización totaliza 63 581,30 USD/6 meses sin reparto por servicio).',
    motivo: 'El margen por servicio es hoy una convención (H-040): sin consumo real no se puede evaluar qué líneas sostienen el negocio.',
    requiere: 'Matriz de consumo (renglón del cuadro básico × servicio) o al menos agrupada por línea.',
    responsable: 'Promotor (CSMC)',
    prioridad: 'alta',
    bloque: 'financiero',
    dependencias: [],
    criterioCierre: 'Costos variables por servicio documentados (se sustituye la convención provisional).',
    registroIds: ['H-029', 'H-040', 'H-067'],
  },
  {
    id: 'B-14',
    titulo: 'Cronograma con fechas precisas',
    epigrafe: '4.10 b)',
    falta: 'Fechas de firma, inscripción registral, licencias, recepción de equipos, montaje y puesta en marcha (el cronograma del anexo tiene marcas gráficas ilegibles).',
    motivo: 'El período de preapertura y el arranque definen el año 0 del modelo y el compromiso de desembolsos.',
    requiere: 'Cronograma fechado aprobado por el Consejo de Dirección.',
    responsable: 'Promotor (CSMC/Leisure)',
    prioridad: 'media',
    bloque: 'estructura',
    dependencias: [],
    criterioCierre: 'Cronograma fechado en la app (tabla 4.10) sin etapas gráficas pendientes.',
    registroIds: ['H-015'],
  },
  {
    id: 'B-15',
    titulo: 'Entidad autorizada a contratar la fuerza de trabajo',
    epigrafe: '4.9',
    falta: 'Declaración de la entidad empleadora y del régimen de contratación del personal cubano y extranjero.',
    motivo: 'Requisito expreso de 4.9; determina quién responde por salarios y seguridad social.',
    requiere: 'Constancia de la entidad empleadora (esperable: CSMC, S.A.) y su autorización.',
    responsable: 'Promotor (CSMC)',
    prioridad: 'media',
    bloque: 'juridico_admin',
    dependencias: [],
    criterioCierre: 'Campo de 4.9 completo en la app con referencia documental.',
    registroIds: ['H-092', 'H-017'],
  },
  {
    id: 'B-16',
    titulo: 'Base legal del impuesto sobre utilidades y de la exención de los años 1–7',
    epigrafe: '4.8 b) / cálculo',
    falta: 'Norma que fije la tasa (15 %) y la exención de los años 1–7 aplicable a esta AEI.',
    motivo: 'C-15: la rentabilidad depende de la exención; la tasa citada no tiene respaldo adjunto.',
    requiere: 'Texto legal vigente (Ley 118 y normativa tributaria) o consulta a la autoridad competente.',
    responsable: 'Especialista designado',
    prioridad: 'bloqueante',
    bloque: 'juridico_admin',
    dependencias: [],
    criterioCierre: 'Regla de impuesto de la plantilla con fuente normativa verificada (parámetro con «fuente» oficial).',
    registroIds: ['H-033'],
  },
  {
    id: 'B-17',
    titulo: 'Desglose de otros impuestos, tasas y contribuciones',
    epigrafe: '4.7 c)',
    falta: 'Composición de los 682,1 kCUP/año (transporte terrestre, contribución al desarrollo local 1 %, tasa de anuncios).',
    motivo: 'Solo el 1 % está especificado; el resto no es verificable.',
    requiere: 'Detalle de cada tributo con su norma y base de cálculo.',
    responsable: 'Especialista designado',
    prioridad: 'media',
    bloque: 'juridico_admin',
    dependencias: [],
    criterioCierre: 'Parámetros por tributo (o el parámetro único con fórmula documentada).',
    registroIds: ['H-034'],
  },
  {
    id: 'B-18',
    titulo: 'Importe del canon/arrendamiento y su tratamiento tras el mes 7',
    epigrafe: '4.7 c)',
    falta: 'Monto del arrendamiento del inmueble y quién lo paga a partir del séptimo mes de operación.',
    motivo: 'CSMC lo garantiza solo en preapertura y los primeros 6 meses; el EERR no reconoce partida alguna de canon.',
    requiere: 'Contrato de arrendamiento (o condiciones pactadas) con importe y vigencia.',
    responsable: 'Promotor (CSMC)',
    prioridad: 'alta',
    bloque: 'financiero',
    dependencias: ['B-06'],
    criterioCierre: 'Parámetro de canon con importe y fuente contractual en el modelo.',
    registroIds: ['H-047'],
  },
  {
    id: 'B-19',
    titulo: 'Índices de consumos básicos y costos de operación no salariales',
    epigrafe: '4.6 e)',
    falta: 'Consumos de agua, electricidad, portadores y residuos; y tratamientos de seguros, gastos bancarios y mantenimiento (todos en 0 en el modelo).',
    motivo: 'Un centro con rayos X, autoclave y climatización sin gastos públicos ni seguros es irreal y subestima costos.',
    requiere: 'Facturas/estimaciones de consumos y la política de seguros (incluida la responsabilidad civil sanitaria).',
    responsable: 'Promotor (CSMC)',
    prioridad: 'media',
    bloque: 'mercado_operacion',
    dependencias: [],
    criterioCierre: 'Tabla de consumos con fuentes y parámetros de costos fijos distintos de cero justificados.',
    registroIds: ['H-048'],
  },
  {
    id: 'B-20',
    titulo: 'Insumos de endodoncia (limas) para el servicio TPR',
    epigrafe: '4.8 c)',
    falta: 'Cotización de limas endodónticas (el TPR está suspendido «por las limas que se utilizan quedando en el canal»).',
    motivo: 'El plan proyecta 3 TPR/mes, pero su insumo crítico no está en la cotización de insumos.',
    requiere: 'Renglon(es) de limas en el cuadro básico y su cotización.',
    responsable: 'Promotor (Leisure)',
    prioridad: 'alta',
    bloque: 'mercado_operacion',
    dependencias: [],
    criterioCierre: 'Cuadro básico conciliado (B-23) con las limas cotizadas.',
    registroIds: ['H-061', 'H-067', 'H-029'],
  },
  {
    id: 'B-21',
    titulo: 'Alcance y costo del «donativo inicial» de kits de blanqueamiento (500 casos)',
    epigrafe: '4.8 c)',
    falta: 'Cotización del kit inicial de blanqueamiento y su carácter (donativo = ¿aporte o costo del socio extranjero?).',
    motivo: 'F09 lo compromete («inicio 500 casos») pero no está cotizado ni modelado.',
    requiere: 'Cotización del kit y carta de intención del socio extranjero.',
    responsable: 'Promotor (Leisure)',
    prioridad: 'baja',
    bloque: 'no_bloqueante',
    dependencias: [],
    criterioCierre: 'Insumo cotizado y tratamiento definido (dentro de activos circulantes o donativo excluido del modelo).',
    registroIds: ['H-062'],
  },
  {
    id: 'B-22',
    titulo: 'Contrato de suministro continuo de insumos',
    epigrafe: '4.8 c)',
    falta: 'Compromiso formal de Leisure Exporting LLC de mantener el abastecimiento (volúmenes, precios, plazos) más allá del stock inicial.',
    motivo: 'El modelo compra 127,2 kUSD/año de insumos desde el año 2 sin contrato de suministro adjunto; el desabastecimiento es la causa de los servicios suspendidos hoy.',
    requiere: 'Proyecto de contrato de suministro o carta de compromiso con condiciones.',
    responsable: 'Promotor (CSMC/Leisure)',
    prioridad: 'alta',
    bloque: 'mercado_operacion',
    dependencias: ['B-13'],
    criterioCierre: 'Contrato/compromiso adjunto y la fuente de suministro citada en 4.8.',
    registroIds: ['H-029', 'H-061', 'H-062'],
  },
  {
    id: 'B-23',
    titulo: 'Conciliación del cuadro básico (71 renglones) con la cotización (≈60)',
    epigrafe: '4.8 c)',
    falta: 'Lista del cuadro básico completo (71 renglones) y su correspondencia con los renglones cotizados.',
    motivo: 'No se puede verificar que la cotización cubra todo lo necesario para los 15 servicios.',
    requiere: 'Cuadro básico completo y marcado de lo cotizado.',
    responsable: 'Promotor (CSMC)',
    prioridad: 'media',
    bloque: 'mercado_operacion',
    dependencias: ['B-20'],
    criterioCierre: 'Cobertura 100 % de los 71 renglones (cotizados o con fuente nacional).',
    registroIds: ['H-067', 'H-029'],
  },
  {
    id: 'B-24',
    titulo: 'Estudio de mercado: demanda aparente y solvente',
    epigrafe: '4.8 d)',
    falta: 'Mercados objetivo, demanda aparente y solvente, y proyección de captación (el expediente solo aporta contexto mundial GBD 2019 y anécdotas de demanda represada).',
    motivo: 'Requisito de 4.5 f) y 4.8 d); la propia valoración recomienda el estudio con las estadísticas de 2019 como año base.',
    requiere: 'Estudio de mercado (fuentes, fechas, área de influencia, precios de la competencia internacional).',
    responsable: 'Promotor (CSMC)',
    prioridad: 'bloqueante',
    bloque: 'mercado_operacion',
    dependencias: [],
    criterioCierre: '4.8 con demanda solvente cuantificada y método de estimación con fuentes.',
    registroIds: ['H-080', 'H-062', 'H-063'],
  },
  {
    id: 'B-25',
    titulo: 'Estrategia de comercialización por canal',
    epigrafe: '4.8 e)',
    falta: 'Definición de canales (¿turismo de salud, contratos con turoperadores, plataformas?), política de precios para internacionales ydesglos de ventas por canal.',
    motivo: 'El balance externo del expediente computa el 100 % de los ingresos como exportaciones, pero no existe estrategia documentada.',
    requiere: 'Plan comercial y contratos/cartas de intención con comercializadores.',
    responsable: 'Promotor (CSMC/Leisure)',
    prioridad: 'alta',
    bloque: 'mercado_operacion',
    dependencias: ['B-24'],
    criterioCierre: 'Canales declarados por servicio en la app y plan comercial adjunto.',
    registroIds: ['H-080', 'H-037'],
  },
  {
    id: 'B-26',
    titulo: 'Fundamentación normativa del plan (PNDES y EDT Holguín)',
    epigrafe: '4.5 d)',
    falta: 'Vinculación expresa del proyecto con el Plan Nacional de Desarrollo y la Estrategia de Desarrollo Territorial de Holguín.',
    motivo: 'Requisito de 4.5 d); solo existe la justificación sectorial de la valoración.',
    requiere: 'Texto de alineación con citas de los documentos estratégicos vigentes.',
    responsable: 'Especialista designado',
    prioridad: 'media',
    bloque: 'estructura',
    dependencias: [],
    criterioCierre: 'Apartado 4.5 d) completo en la app.',
    registroIds: ['H-080'],
  },
  {
    id: 'B-27',
    titulo: 'Presupuesto de remodelación/montaje del Centro',
    epigrafe: '4.10 a)',
    falta: 'Presupuesto y alcance de las «obras de remodelación del Centro» que el contrato encarga a CSMC.',
    motivo: 'La cláusula 8.1 b) del contrato prevé remodelación con presupuesto aprobado, pero el modelo de inversión la cuantiza en 0,00.',
    requiere: 'Proyecto técnico con presupuesto de remodelación (o declaración de que el inmueble no la requiere).',
    responsable: 'Promotor (CSMC)',
    prioridad: 'media',
    bloque: 'financiero',
    dependencias: ['B-06'],
    criterioCierre: 'Inversión con partida de remodelación justificada (o su exclusión razonada).',
    registroIds: ['H-020', 'H-011'],
  },
];

// ---------------------------------------------------------------------------
// VALIDACIONES NORMATIVAS Y ADMINISTRATIVAS PENDIENTES
// ---------------------------------------------------------------------------

export const VALIDACIONES: ValidacionNormativa[] = [
  {
    id: 'V-01',
    requisito: 'Aprobación de la constitución de la AEI por la autoridad competente',
    normaInvocada: 'Ley 118/2014 y Decreto 325/2014 (citadas en F01, cláusula 2.2).',
    evidenciaExpediente: 'Ninguna: el contrato es un borrador sin firmar y sin constancia de presentación a aprobación.',
    estado: 'invocada_sin_evidencia',
    pendiente: 'Presentación del CAEI a los órganos competentes (según la Ley 118: aprobación del órgano u organismo rector y demás instancias aplicables) y su autorización documentada.',
    registroIds: ['H-009', 'H-014'],
  },
  {
    id: 'V-02',
    requisito: 'Inscripción del CAEI en el Registro Mercantil y licencia comercial',
    normaInvocada: 'F01, cláusula 2.3: CSMC gestionará la inscripción de la Escritura Pública y la licencia comercial.',
    evidenciaExpediente: 'Ninguna (el período de preapertura se define a partir de esa inscripción, aún no producida).',
    estado: 'invocada_sin_evidencia',
    pendiente: 'Escritura Pública formalizada e inscrita; licencia comercial emitida.',
    registroIds: ['H-015', 'H-014'],
  },
  {
    id: 'V-03',
    requisito: 'Vigencia y aplicabilidad del marco normativo citado',
    normaInvocada: 'Ley 118/2014; Decreto 325/2014; Decreto 347 «Modificativo» (citado «de 9 de abril de 2014», fecha a verificar); DL 69/2023; Ley 59/1987; Resolución 78/2026 (bases metodológicas, citada por F05).',
    evidenciaExpediente: 'Citas textuales del contrato y de la revisión metodológica.',
    estado: 'pendiente_verificacion',
    pendiente: 'Verificar en la Gaceta Oficial la vigencia de cada norma (en especial la fecha del Decreto 347 y las modificaciones al Decreto 325) y su aplicabilidad a una AEI de servicios de salud.',
    registroIds: ['H-014'],
  },
  {
    id: 'V-04',
    requisito: 'Exención arancelaria de las importaciones de la AEI',
    normaInvocada: 'Cotización: «Arancel aduanal a la importación en cuba: Libre de impuestos x AEI».',
    evidenciaExpediente: 'Solo la afirmación de la cotización; el balance externo computa aranceles 0.',
    estado: 'invocada_sin_evidencia',
    pendiente: 'Verificar el régimen aduanero aplicable (Ley 118 y normativa de la Aduana General de la República) para las importaciones de la AEI y documentar el artículo que lo sustenta.',
    registroIds: ['H-049'],
  },
  {
    id: 'V-05',
    requisito: 'Régimen tributario aplicable (impuesto sobre utilidades, exenciones, contribuciones locales)',
    normaInvocada: 'Ninguna norma tributaria se cita en el expediente.',
    evidenciaExpediente: 'El modelo aplica 15 % solo en los años 8–10 y una partida agregada de «otros impuestos» (682,1 kCUP/año).',
    estado: 'no_invocada',
    pendiente: 'Determinar con la ONAT/normativa vigente: tasa del impuesto sobre utilidades para AEI, exenciones y su duración, contribución al desarrollo local, tasas por anuncios y transporte; desglosar la partida del modelo.',
    registroIds: ['H-033', 'H-034'],
  },
  {
    id: 'V-06',
    requisito: 'Licencias y registros sanitarios para prestar servicios estomatológicos internacionales',
    normaInvocada: 'F01, cláusula 8.1 a): CSMC gestionará «licencias comerciales, sanitarias y otros títulos habilitantes».',
    evidenciaExpediente: 'Compromiso de gestión, sin licencias adjuntas.',
    estado: 'invocada_sin_evidencia',
    pendiente: 'Licencia sanitaria del Centro (MINSAP), habilitaciones de imagenología (rayos X — protección radiológica) y acreditaciones de los profesionales para la atención internacional.',
    registroIds: ['H-011', 'H-065'],
  },
  {
    id: 'V-07',
    requisito: 'Tipo de cambio oficial aplicable a la contabilidad del negocio',
    normaInvocada: 'Ninguna: el expediente usa tasas 24 y 120 simultáneamente.',
    evidenciaExpediente: 'Encabezados «1*24» (F08) y lista de precios «1*120» (F02/F08 p. 23; F09).',
    estado: 'no_invocada',
    pendiente: 'Tasa vigente publicada por el Banco Central de Cuba a la fecha de corte del plan y su campo de aplicación (lista de precios, contabilidad, aportes).',
    registroIds: ['H-025'],
  },
  {
    id: 'V-08',
    requisito: 'Registro de la marca/identificación comercial y permisos de anuncios',
    normaInvocada: 'El modelo incluye «Tasa Radicación de Anuncios y Propaganda Comercial» dentro de otros impuestos.',
    evidenciaExpediente: 'Partida impositiva sin soporte documental de anuncios existentes.',
    estado: 'invocada_sin_evidencia',
    pendiente: 'Definir la identificación comercial (B-02), su registro, y la publicidad prevista (o excluir la tasa si no habrá anuncios).',
    registroIds: ['H-034', 'H-016'],
  },
];

// ---------------------------------------------------------------------------
// PLAN DE CIERRE PRIORIZADO
// ---------------------------------------------------------------------------

export const PLAN_CIERRE: { bloque: BloqueCierre; titulo: string; brechas: string[]; secuenci: string }[] = [
  {
    bloque: 'estructura',
    titulo: 'Bloqueantes para estructurar el plan',
    brechas: ['B-01', 'B-02', 'B-06', 'B-08', 'B-14', 'B-26'],
    secuenci: 'Primero la identidad del negocio (denominación, elaborador, inmueble con su usufructo y dirección): todo lo demás cita esos datos.',
  },
  {
    bloque: 'financiero',
    titulo: 'Necesarios para cerrar el modelo financiero',
    brechas: ['B-04', 'B-07', 'B-11', 'B-12', 'B-13', 'B-18', 'B-27'],
    secuenci: 'Decidir tasa de cambio (V-07) y escáner (B-07) de primera: con la tasa resuelta, el modelo se recalcula cambiando un parámetro y el resto de brechas financieras se cierra sobre cifras estables.',
  },
  {
    bloque: 'mercado_operacion',
    titulo: 'Necesarios para sustentar mercado y operación',
    brechas: ['B-09', 'B-10', 'B-19', 'B-20', 'B-22', 'B-23', 'B-24', 'B-25'],
    secuenci: 'El estudio de mercado (B-24) condiciona la estrategia comercial (B-25) y la validación de las cantidades previstas; en paralelo, cerrar el cuadro básico (B-23 + B-20) y el monitor del rayos X (B-09).',
  },
  {
    bloque: 'juridico_admin',
    titulo: 'Necesarios para la revisión jurídica, administrativa y regulatoria',
    brechas: ['B-05', 'B-15', 'B-16', 'B-17'],
    secuenci: 'Con el contrato en vía de firma: acreditación registral del extranjero (B-05), régimen tributario verificado (B-16 + B-17), entidad empleadora (B-15) y las aprobaciones V-01/V-02.',
  },
  {
    bloque: 'no_bloqueante',
    titulo: 'Mejoras no bloqueantes',
    brechas: ['B-03', 'B-21'],
    secuenci: 'El resumen ejecutivo (B-03) se redacta al final, con el modelo estable; el donativo de kits (B-21) se documenta cuando el socio lo formalice.',
  },
];

// ---------------------------------------------------------------------------
// Consultas derivadas del registro (única fuente de verdad)
// ---------------------------------------------------------------------------

export function brechasPorPrioridad(p: PrioridadBrecha): Brecha[] {
  return BRECHAS.filter((b) => b.prioridad === p);
}

export function contradiccionesCriticas(): Contradiccion[] {
  return CONTRADICCIONES.filter((c) => c.severidad === 'critica');
}

/** Resumen numérico usado por la portada y la vista de completitud. */
export function resumenExpediente() {
  const crit = CONTRADICCIONES.filter((c) => c.severidad === 'critica').length;
  const altas = CONTRADICCIONES.filter((c) => c.severidad === 'alta').length;
  const bloqueantes = BRECHAS.filter((b) => b.prioridad === 'bloqueante').length;
  return {
    fuentes: 9,
    contradicciones: CONTRADICCIONES.length,
    contradiccionesCriticas: crit,
    contradiccionesAltas: altas,
    brechas: BRECHAS.length,
    brechasBloqueantes: bloqueantes,
    validaciones: VALIDACIONES.length,
    validacionesSinEvidencia: VALIDACIONES.filter((v) => v.estado === 'invocada_sin_evidencia' || v.estado === 'no_invocada')
      .length,
  };
}

/** Los textos largos se construyen bajo demanda para no duplicar contenido. */
export function textoContradiccion(id: string): string {
  const c = CONTRADICCIONES.find((x) => x.id === id);
  if (!c) throw new Error(`Contradicción inexistente: ${id}`);
  const vals = c.valores.map((v) => `• ${v.valor} — ${v.fuenteLocalizador}`).join('\n');
  return `${c.titulo}\nValores en conflicto:\n${vals}\nImpacto: ${c.impacto}\nAcción requerida: ${c.accionRequerida}`;
}

export function citaRegistro(ids: string[]): string {
  return ids.map((i) => `${i}: ${dato(i).campo}`).join('; ');
}
