// ============================================================================
// PLANEX — Centro de ayuda y guía de trabajo (misión UX-002 §2).
//
// Contenido organizado según el marco Diátaxis (https://diataxis.fr):
//   * Tutoriales   — aprender mediante un recorrido real en la aplicación.
//   * Guías        — resolver objetivos concretos paso a paso.
//   * Referencia   — consultar la descripción exacta de campos y fórmulas.
//   * Conceptos    — comprender el porqué y las consecuencias.
//
// Reglas editoriales de este contenido:
//   1. Solo documenta capacidades REALES de la aplicación (verificables en
//      el código); las limitaciones se declaran explícitamente.
//   2. Todo ejemplo numérico es reproducible con las plantillas de
//      demostración (Clínica estomatológica y Centro de diagnóstico) con la
//      tasa por defecto de 743 CUP/USD.
//   3. Las cifras didácticas se rotulan como ficticias; ninguna se presenta
//      como tasa oficial, presupuesto aprobado o requisito legal verificado.
// ============================================================================

export type CapaDiataxis = 'tutoriales' | 'guias' | 'referencia' | 'conceptos';

export const CAPAS: { id: CapaDiataxis; titulo: string; descripcion: string }[] = [
  {
    id: 'tutoriales',
    titulo: 'Tutoriales',
    descripcion: 'Recorridos completos y progresivos para aprender a usar PLANEX haciendo un plan real de principio a fin.',
  },
  {
    id: 'guias',
    titulo: 'Guías prácticas',
    descripcion: 'Cómo hacer…: resolver una tarea concreta paso a paso, sin leer el tutorial completo.',
  },
  {
    id: 'referencia',
    titulo: 'Referencia',
    descripcion: 'Descripción exacta de secciones, campos, parámetros, monedas, fórmulas, indicadores, validaciones y permisos.',
  },
  {
    id: 'conceptos',
    titulo: 'Conceptos',
    descripcion: 'Explicaciones sobre el porqué de las funciones, las relaciones entre componentes y las consecuencias de las decisiones financieras.',
  },
];

export interface PasoTutorial {
  titulo: string;
  donde: string;
  accion: string;
  resultado: string;
  evitar?: string;
}

export type BloqueAyuda =
  | { tipo: 'p'; texto: string }
  | { tipo: 'lista'; elementos: string[] }
  | { tipo: 'pasos'; pasos: PasoTutorial[] }
  | { tipo: 'nota'; texto: string }
  | { tipo: 'aviso'; texto: string }
  | { tipo: 'formula'; expresion: string; variables: { nombre: string; significado: string; unidad: string }[]; ejemplo: string }
  | { tipo: 'tabla'; encabezados: string[]; filas: string[][] };

export interface ArticuloAyuda {
  id: string;
  capa: CapaDiataxis;
  titulo: string;
  resumen: string;
  etiquetas: string[];
  /** Guías: objetivo en una frase. */
  objetivo?: string;
  /** Guías: requisitos previos verificables. */
  requisitos?: string[];
  /** Guías: resultado esperado al terminar. */
  resultado?: string;
  /** Guías: errores frecuentes y cómo evitarlos. */
  errores?: string[];
  /** Ids de artículos relacionados (todos deben existir). */
  relacionados?: string[];
  bloques: BloqueAyuda[];
}

export const AVISO_DIDACTICO =
  'Ejemplo didáctico: cifras hipotéticas, no verificadas ni constitutivas de tasas oficiales, presupuestos aprobados o datos reales de una entidad.';

export const AVISO_TASA =
  'El tipo de cambio por defecto (743 CUP/USD) y el impuesto del 35 % son supuestos ilustrativos pendientes de validación oficial. Antes de un uso oficial, sustitúyalos por los valores vigentes y documente fecha y fuente.';

// ============================================================================
// TUTORIALES
// ============================================================================

const TUTORIAL: ArticuloAyuda[] = [
  {
    id: 'tutorial-primer-plan',
    capa: 'tutoriales',
    titulo: 'Crear un plan de negocio a partir de una plantilla (recorrido completo)',
    resumen:
      'Recorrido progresivo y real: crear el plan, rellenar las secciones 4.1–4.12 con la plantilla de clínica estomatológica, introducir inversiones y financiación, revisar proyecciones e indicadores y exportar el documento.',
    etiquetas: ['tutorial', 'empezar', 'crear plan', 'plantilla', 'clínica', 'recorrido', '4.1', '4.12', 'exportar'],
    objetivo: 'Completar un primer plan de negocio de inversión extranjera en Cuba, de la creación a la exportación.',
    requisitos: [
      'Tener acceso a PLANEX (alias y contraseña de colaborador del espacio compartido).',
      'Conectar con el servidor de colaboración (indicador de sincronización en verde o «Guardado…»).',
    ],
    resultado:
      'Un plan compartido con las doce secciones metodológicas cumplimentadas, sin errores bloqueantes de cálculo, previsualizado como PDF real y exportable en PDF, Word y Excel.',
    errores: [
      'Abandonar el navegador con el indicador en «Cambios pendientes de guardar»: el plan se guarda automáticamente, pero conviene esperar al «Guardado» antes de cerrar.',
      'Editar cifras de la plantilla sin actualizar las descripciones textuales: el resumen ejecutivo y los análisis reaccionan a los datos, no a los textos viejos.',
      'Dejar conflictos de edición sin resolver: la aplicación nunca fusiona cifras automáticamente.',
    ],
    relacionados: ['guia-cambiar-tasa', 'guia-plan-financiado', 'guia-generar-pdf', 'guia-compartir-plan'],
    bloques: [
      {
        tipo: 'p',
        texto:
          'Este tutorial recorre la aplicación tal como existe: cada paso indica DÓNDE está la acción, QUÉ hacer, QUÉ resultado esperar y qué errores evitar. Utiliza la plantilla de demostración «Clínica estomatológica» como caso didáctico; todas sus cifras son ficticias y están marcadas como tales en toda la aplicación.',
      },
      {
        tipo: 'pasos',
        pasos: [
          {
            titulo: '1. Crear el plan y darle nombre',
            donde: 'Panel «Proyectos compartidos» (vista Proyectos) → botón «Crear plan».',
            accion:
              'Escriba el nombre del proyecto (p. ej. «Mi clínica de prueba») y seleccione la plantilla «Clínica estomatológica (demo)». Confirme la creación.',
            resultado:
              'El plan aparece en el panel y se abre el editor con el plan cargado. La barra superior muestra el nombre (editable) y la insignia «Clínica (demo)».',
            evitar:
              'Nombres ambiguos («Plan 1»): el panel y la actividad usan el nombre para identificar el trabajo de ambos colaboradores.',
          },
          {
            titulo: '2. Reconocer el mapa de secciones',
            donde: 'Editor → columna izquierda (escritorio) o botones 4.1…4.12 (pantallas estrechas).',
            accion:
              'Recorra las once áreas: 4.1–4.3 información general e índice, 4.4 resumen ejecutivo, 4.5 descripción del negocio, 4.6 aspectos técnicos, 4.7 análisis financiero, 4.8 mercado, 4.9 fuerza de trabajo, 4.10 inversiones, 4.11 beneficios al país, 4.12 conclusiones, y «Configuración de cálculos».',
            resultado:
              'Cada botón muestra su porcentaje de cumplimentación; la barra superior muestra el total del plan en la barra de progreso «Cumplimentación».',
            evitar:
              'Empezar por la configuración de cálculos: los porcentajes se explican mejor tras recorrer las secciones de contenido.',
          },
          {
            titulo: '3. Sustituir los datos ficticios de la información general',
            donde: 'Sección 4.1–4.3 (Información general e índice).',
            accion:
              'Reemplace nombre del proyecto, inversionista extranjero, modalidad de inversión y demás campos generales por los datos reales del proyecto. La plantilla trae valores de ejemplo rotulados como ficticios.',
            resultado: 'La sección queda con sus datos; el índice del documento se genera automáticamente a partir de las secciones cumplimentadas.',
            evitar: 'Presentar los datos ficticios de la plantilla como datos reales de una entidad.',
          },
          {
            titulo: '4. Revisar la inversión inicial y su conciliación',
            donde: 'Sección 4.10 (Inversiones) y tabla «Inversiones por concepto».',
            accion:
              'Verifique cada partida: categoría (gastos previos / inversión fija), moneda de origen (USD o CUP), monto, vida útil y año de disponibilidad. En la plantilla clínica la inversión total es 1 480,0 kUSD: 45 de gastos previos + 1 200 de inversión fija + 235 de capital de trabajo.',
            resultado:
              'La suma de los conceptos coincide con el total; el equivalente en la moneda de presentación se recalcula al instante.',
            evitar:
              'Sumar CUP y USD a mano en la tabla: el motor convierte cada partida UNA sola vez con el tipo de cambio parametrizado (regla de conversión única).',
          },
          {
            titulo: '5. Definir fuentes de financiación y verificar que explican la inversión',
            donde: 'Sección 4.7 (Análisis financiero) → aportaciones y crédito.',
            accion:
              'Revise las aportaciones por socio (efectivo y activos) y el crédito (monto, tasa, plazo, gracia). En la plantilla: aportaciones 1 180 kUSD + crédito 300 kUSD = 1 480 kUSD, exactamente la inversión.',
            resultado: 'La tabla de financiación muestra «diferencia de financiación» igual a cero (o superávit/déficit) sin advertencias de insuficiencia.',
            evitar: 'Dejar la financiación insuficiente: la aplicación emite una advertencia bloqueante con el importe exacto que falta y dónde corregirlo.',
          },
          {
            titulo: '6. Introducir servicios, precios y volúmenes previstos',
            donde: 'Sección 4.7 (Análisis financiero) → servicios; sección 4.6 (Aspectos técnicos) → capacidad y recursos.',
            accion:
              'Ajuste por servicio: precio base (USD), cantidad base mensual, crecimiento anual, capacidad máxima mensual, costo variable unitario, duración en minutos y recursos técnicos que consume. La plantilla trae nueve servicios estomatológicos.',
            resultado:
              'Las proyecciones de ingresos y costos se recalculan al instante; si la demanda supera la capacidad, aparece una advertencia de capacidad instalada con la sección afectada.',
            evitar: 'Poner capacidad máxima 0 «para no limitar»: entienda el escenario activo antes de ignorar la advertencia; una capacidad mal declarada distorsiona los ingresos reconocidos.',
          },
          {
            titulo: '7. Revisar proyecciones, indicadores y validaciones',
            donde: 'Sección 4.7 (proyecciones e indicadores), botón de alertas (campana) y sección 4.11 (Beneficios al país).',
            accion:
              'Lea el estado de resultados proyectado, los flujos de caja (FCFF del proyecto y FCFE de los socios), la recuperación de la inversión y los beneficios acumulados al país. Abra el panel de diagnóstico y recorra los cuatro niveles de hallazgos; pulse un hallazgo para ir a su sección.',
            resultado:
              'Con la plantilla clínica y tasa 743: utilidad antes de impuestos del año 1 = 386,9 kUSD, impuesto 135,4, utilidad neta 251,5, recuperación de la inversión 3,4 años (proyecto) y 3,2 (socios). Sin errores bloqueantes.',
            evitar: 'Tratar el «100 % de cumplimentación» como prueba de calidad: la completitud formal no valida supuestos; lea el diagnóstico.',
          },
          {
            titulo: '8. Previsualizar, exportar y guardar versiones',
            donde: 'Menú «Exportar» → «Previsualizar documento (PDF real)»; luego Exportar PDF / Word / Excel; y vista «Colaboración» → Historial.',
            accion:
              'Abra la vista documental: el visor muestra el PDF REAL con paginación, zoom, búsqueda y pantalla completa, y un selector de moneda de presentación (USD/CUP). Descargue el PDF (idéntico al mostrado) y el Word editable. Después guarde una versión con descripción desde «Colaboración → Historial de versiones».',
            resultado:
              'El documento final se revisa antes de entregarlo; la versión queda registrada con su autoría y el plan queda respaldado en el espacio compartido.',
            evitar: 'Exportar con errores de cálculo sin leer la advertencia previa: la exportación se permite con las partidas afectadas marcadas, pero el receptor verá las marcas.',
          },
        ],
      },
      { tipo: 'aviso', texto: AVISO_DIDACTICO },
      {
        tipo: 'nota',
        texto:
          'Duración orientativa: 45–90 minutos para un primer recorrido. Cada etapa puede repetirse con datos reales cuando los tenga; los análisis narrativos se regeneran con los cambios.',
      },
    ],
  },
];

// ============================================================================
// GUÍAS PRÁCTICAS
// ============================================================================

const GUIAS: ArticuloAyuda[] = [
  {
    id: 'guia-cambiar-tasa',
    capa: 'guias',
    titulo: 'Cómo cambiar la tasa de cambio CUP/USD',
    resumen: 'Editar el parámetro tipo_cambio del plan y comprobar su efecto inmediato en costos, inversiones y documentos.',
    etiquetas: ['tasa', 'tipo de cambio', 'cup', 'usd', 'parámetro', 'configuración', '743'],
    objetivo: 'Sustituir el supuesto de tipo de cambio por el valor que el proyecto considere vigente y documentable.',
    requisitos: ['Un plan abierto en el editor.', 'Conocer la tasa y su fecha de referencia.'],
    resultado: 'Todas las partidas en CUP (salarios e inversiones en CUP) se convierten con la nueva tasa; el documento registra tasa, fecha y fuente en sus notas.',
    errores: [
      'Cambiar la tasa y no documentar fecha/fuente: la nota documental del PDF y Word usa los campos del parámetro.',
      'Convertir a mano cantidades ya convertidas: la conversión es UNA sola vez desde la moneda de origen; aplicar de nuevo la tasa produce dobles conversiones.',
    ],
    relacionados: ['ref-monedas-unidades', 'guia-monedad-presentacion', 'guia-supuesto-configurable'],
    bloques: [
      { tipo: 'p', texto: 'La tasa vive en un único lugar: el parámetro «tipo_cambio» del plan (Nivel A). No hay tasas duplicadas.' },
      {
        tipo: 'pasos',
        pasos: [
          { titulo: '1. Abrir la configuración de cálculos', donde: 'Editor → «Configuración de cálculos» (icono ⚙ en la navegación de secciones).', accion: 'Localice el parámetro «Tipo de cambio (CUP por USD)».', resultado: 'Se muestra el valor vigente (por defecto 743), su unidad, su fuente y su fecha de referencia.', evitar: 'Buscar la tasa dentro de una tabla de inversión: ahí solo se ven los efectos.' },
          { titulo: '2. Editar el valor', donde: 'Misma pantalla → campo numérico del parámetro.', accion: 'Escriba la nueva tasa (p. ej. 800) y actualice la fecha de referencia.', resultado: 'El motor recalcula al momento: el costo laboral en kUSD cambia de inmediato en proyecciones e indicadores.', evitar: 'Introducir 0,80 pensando en «USD por CUP»: el parámetro expresa CUP por cada USD (743 significa que 1 USD = 743 CUP).' },
          { titulo: '3. Verificar el efecto', donde: 'Sección 4.7 (proyecciones) y vista de previsualización.', accion: 'Compare el costo laboral y las partidas en CUP antes y después.', resultado: 'Con la plantilla clínica, el costo laboral del año 1 con tasa 743 es 20,6 kUSD (15 312 000 CUP / 743 / 1 000).', evitar: 'Esperar un botón «recalcular»: no existe ni hace falta; todo recalcula solo.' },
          { titulo: '4. Comprobar la documentación', donde: 'Vista documental → selector de moneda → nota del documento.', accion: 'Genere la previsualización y lea la nota de conversión.', resultado: 'El documento declara la tasa aplicada, su fecha y su fuente, y advierte que es un supuesto ilustrativo pendiente de validar.', evitar: 'Presentar el documento con una tasa sin fecha de referencia.' },
        ],
      },
      { tipo: 'formula', expresion: 'USD = CUP / tasa     ·     CUP = USD × tasa', variables: [{ nombre: 'tasa', significado: 'CUP por cada USD (parámetro tipo_cambio)', unidad: 'CUP/USD' }, { nombre: 'CUP', significado: 'importe en pesos cubanos', unidad: 'CUP' }, { nombre: 'USD', significado: 'importe equivalente en dólares', unidad: 'USD' }], ejemplo: `Con la tasa por defecto 743: 400 000 CUP / 743 = 538,36 USD. ${AVISO_DIDACTICO}` },
    ],
  },
  {
    id: 'guia-monedad-presentacion',
    capa: 'guias',
    titulo: 'Cómo presentar un plan en CUP o USD',
    resumen: 'Usar el selector de moneda de presentación de la vista documental y entender qué se convierte y qué no.',
    etiquetas: ['moneda', 'presentación', 'cup', 'usd', 'visor', 'previsualización', 'documento'],
    objetivo: 'Generar el mismo documento en miles de USD o en miles de CUP sin modificar los datos originales del plan.',
    requisitos: ['Un plan abierto con datos financieros.', 'Tasa de cambio configurada (por defecto 743 CUP/USD).'],
    resultado: 'El visor, el PDF y el Word se muestran en la moneda elegida, con la unidad correcta y la nota de conversión; los datos del plan permanecen intactos.',
    errores: [
      'Creer que el selector modifica los datos: solo cambia la PRESENTACIÓN; los valores de origen no se reescriben.',
      'Esperar que los porcentajes o las plantillas de trabajadores se conviertan: las magnitudes no monetarias no se convierten.',
    ],
    relacionados: ['guia-cambiar-tasa', 'ref-monedas-unidades', 'ref-exportaciones'],
    bloques: [
      { tipo: 'p', texto: 'La moneda de presentación es una preferencia GUARDADA EN EL PLAN (ajustes.monedaPresentacion): persiste entre sesiones y la ven ambos colaboradores.' },
      {
        tipo: 'pasos',
        pasos: [
          { titulo: '1. Abrir la vista documental', donde: 'Editor → menú «Exportar» → «Previsualizar documento (PDF real)».', accion: 'La vista dedica una pantalla completa al documento (no es un modal).', resultado: 'El visor carga el PDF real del plan activo.' },
          { titulo: '2. Elegir la moneda', donde: 'Barra de controles del visor → selector «Moneda» (USD / CUP).', accion: 'Cambie entre USD y CUP.', resultado: 'El documento se regenera en la moneda elegida con las unidades correctas (kUSD o kCUP); la regeneración solo ocurre si los datos cambiaron (control por huella).', evitar: 'Cambiar la moneda repetidamente para «forzar» la regeneración: el visor detecta los cambios de datos y evita regeneraciones innecesarias.' },
          { titulo: '3. Verificar las unidades', donde: 'Tablas del documento («Cifras clave», inversiones, proyecciones).', accion: 'Compruebe los encabezados de unidad.', resultado: 'En CUP, la inversión de la clínica (1 480 kUSD) se muestra como 1 099 640,0 kCUP (1 480 × 743); en USD, 1 480,0 kUSD.', evitar: 'Confundir «miles de CUP» con CUP completos: cada tabla declara su unidad; los salarios se expresan en CUP completos conforme a la metodología 4.9.' },
          { titulo: '4. Exportar en la moneda elegida', donde: 'Misma vista → «Descargar» (idéntico al visor) o menú Exportar del editor.', accion: 'Descargue el PDF o el Word.', resultado: 'La descarga y lo visible son exactamente lo mismo documento.', evitar: 'Suponer que el editor y el visor usan monedas distintas: ambos usan la misma preferencia del plan.' },
        ],
      },
      { tipo: 'lista', elementos: ['Se convierte: importes monetarios (inversiones, ingresos, costos, flujos, beneficios al país).', 'No se convierte: porcentajes, cantidades físicas, horas, vidas útiles, plantillas de trabajadores y períodos.', 'Los salarios se expresan en CUP (metodología 4.9) con su equivalente anual en USD documentado.'] },
      { tipo: 'aviso', texto: AVISO_TASA },
    ],
  },
  {
    id: 'guia-supuesto-configurable',
    capa: 'guias',
    titulo: 'Cómo modificar un supuesto financiero configurable',
    resumen: 'Editar parámetros (Nivel A) y reglas (Nivel C) del motor de cálculo, con ejemplo real del impuesto del 35 % al 30 %.',
    etiquetas: ['parámetro', 'regla', 'supuesto', 'impuesto', '35', '30', 'fórmula', 'configuración', 'nivel a', 'nivel c'],
    objetivo: 'Adaptar los supuestos del motor (tasas, porcentajes, plazos) al caso concreto del proyecto.',
    requisitos: ['Un plan abierto.', 'Saber distinguir parámetro (valor) de regla (fórmula).'],
    resultado: 'El plan recalcula con los supuestos nuevos y queda registrado en el historial de la sección «Configuración de cálculos».',
    errores: [
      'Editar la fórmula cuando basta el valor: el impuesto usa el parámetro tasa_impuesto_utilidades; no hace falta tocar la fórmula para cambiar la tasa.',
      'Escribir fórmulas con nombres de variables inexistentes: el editor de reglas valida la expresión y marca los errores antes de aplicarla.',
    ],
    relacionados: ['ref-parametros', 'ref-formulas', 'guia-cambiar-tasa'],
    bloques: [
      { tipo: 'p', texto: 'PLANEX separa tres niveles de configuración: parámetros (valores: impuesto, tipo de cambio, tasas de interés, inflación…), tablas de datos (inversiones, servicios, personal…) y reglas (fórmulas que combinan parámetros y datos).' },
      {
        tipo: 'pasos',
        pasos: [
          { titulo: '1. Identificar qué hay que cambiar', donde: 'Editor → «Configuración de cálculos».', accion: 'Localice el supuesto: ¿es un valor (parámetro) o una fórmula (regla)?', resultado: 'Sabe si edita un número o una expresión.' },
          { titulo: '2. Cambiar el valor del parámetro', donde: 'Parámetros (Nivel A) → campo numérico.', accion: 'Ejemplo real: tasa de impuesto del 35 % (0,35) al 30 % (0,30).', resultado: 'Con la plantilla clínica y tasa 743, el impuesto del año 1 pasa de 135,4 kUSD (35 % × 386,9 de UAI) a 116,1 kUSD (30 % × 386,9).', evitar: 'Introducir 30 pensando en «30 %»: el campo es decimal (0,30); el 35 % se guarda como 0,35.' },
          { titulo: '3. (Avanzado) Cambiar la fórmula de la regla', donde: 'Reglas (Nivel C) → abrir la regla → editor de fórmula.', accion: 'Solo si el cálculo mismo cambia. Ejemplo: impuesto = MAX(0, utilidad_antes_impuestos_k × tasa_impuesto_utilidades).', resultado: 'La regla recalcula con la nueva expresión; las exportaciones documentan la fórmula vigente.', evitar: 'Romper la fórmula a mitad de edición: si un cálculo falla, el plan muestra el error en vez de inventar cifras.' },
        ],
      },
      { tipo: 'nota', texto: 'Los cambios de configuración se guardan como cualquier otra sección del plan: con autoría, versiones y restauración disponibles en la vista de Colaboración.' },
    ],
  },
  {
    id: 'guia-plan-financiado',
    capa: 'guias',
    titulo: 'Cómo comprobar que el plan está financiado',
    resumen: 'Conciliar inversión total con aportaciones y crédito, y entender la advertencia de financiación insuficiente.',
    etiquetas: ['financiación', 'aportaciones', 'crédito', 'inversión', 'conciliación', 'diferencia'],
    objetivo: 'Verificar que la inversión requerida queda explicada por las fuentes (aportaciones de socios y financiación ajena).',
    requisitos: ['Inversiones definidas (4.10/4.7).', 'Fuentes de financiación introducidas (aportaciones y, si existe, crédito).'],
    resultado: 'La diferencia de financiación es cero o positiva; sin advertencia FINANCIACION_INSUFICIENTE.',
    errores: [
      'Contar el capital de trabajo fuera de la inversión: el modelo lo incluye en la inversión total (la clínica: 45 + 1 200 + 235 = 1 480 kUSD).',
      'Añadir «aportaciones» ficticias para tapar el hueco: la advertencia señala el importe y la acción correcta, no cifras de relleno.',
    ],
    relacionados: ['con-inversion-vs-gasto', 'con-financiacion', 'ref-estados-alertas', 'guia-diferencia-resumen-tabla'],
    bloques: [
      {
        tipo: 'pasos',
        pasos: [
          { titulo: '1. Abrir la conciliación', donde: 'Sección 4.7 (Análisis financiero) → tabla de financiación.', accion: 'Lea «financiación disponible» (aportaciones + otras fuentes + crédito) y «diferencia de financiación».', resultado: 'La clínica demostrativa: 1 180 (aportaciones) + 300 (crédito) = 1 480 kUSD disponibles frente a 1 480 requeridos → diferencia 0.' },
          { titulo: '2. Revisar las advertencias', donde: 'Campana de diagnóstico del editor.', accion: 'Busque FINANCIACION_INSUFICIENTE (si existe).', resultado: 'Si falta financiación, el mensaje indica el importe exacto (p. ej. «faltan 472,0 kUSD») y dónde corregir; si sobra financiación, aparece una advertencia de exceso.', evitar: 'Ignorar la advertencia y exportar: el documento sale con el déficit visible; la aplicación no maquilla la insuficiencia.' },
          { titulo: '3. Corregir con datos reales', donde: 'Aportaciones (socios, tipo y montos por año) y crédito (monto, tasa, plazo, gracia).', accion: 'Ajuste las fuentes hasta explicar la inversión.', resultado: 'La diferencia vuelve a cero o positivo y la advertencia desaparece al recalcular.' },
        ],
      },
      { tipo: 'formula', expresion: 'diferencia = (aportaciones + otras fuentes + crédito) − inversión total', variables: [{ nombre: 'aportaciones', significado: 'aportes de socios (efectivo y activos), por año', unidad: 'kUSD' }, { nombre: 'crédito', significado: 'desembolsos del crédito previstos', unidad: 'kUSD' }, { nombre: 'inversión total', significado: 'gastos previos + inversión fija + capital de trabajo', unidad: 'kUSD' }], ejemplo: `Clínica demostrativa: (1 180 + 0 + 300) − 1 480 = 0 kUSD. ${AVISO_DIDACTICO}` },
    ],
  },
  {
    id: 'guia-diferencia-resumen-tabla',
    capa: 'guias',
    titulo: 'Cómo identificar una diferencia entre el resumen ejecutivo y una tabla financiera',
    resumen: 'Revisar advertencias de coherencia financiera y localizar el origen del desfase sin ocultar la inconsistencia.',
    etiquetas: ['resumen', 'coherencia', 'inconsistencia', 'advertencia', 'diagnóstico', 'diferencia'],
    objetivo: 'Detectar y corregir desfases entre textos narrativos y las cifras de las tablas del modelo.',
    requisitos: ['Un plan con datos introducidos.', 'Leer el panel de diagnóstico (campana del editor).'],
    resultado: 'La diferencia queda identificada en su sección y corregida; el diagnóstico deja de señalarla.',
    errores: [
      'Editar el texto del resumen para que «suene» coherente con cifras defectuosas: primero se corrige el dato, después se revisa el texto.',
      'Esconder la advertencia editando el análisis: las advertencias se regeneran desde el modelo; ocultar el síntoma no corrige la causa.',
    ],
    relacionados: ['ref-estados-alertas', 'guia-plan-financiado', 'con-proyeccion-no-viabilidad'],
    bloques: [
      { tipo: 'p', texto: 'Los textos analíticos (resumen ejecutivo, análisis por sección) se GENERAN desde el modelo de cálculo con las cifras vigentes. Una diferencia aparente casi siempre significa que un dato cambió y un texto editado a mano quedó desfasado.' },
      {
        tipo: 'pasos',
        pasos: [
          { titulo: '1. Abrir el diagnóstico', donde: 'Editor → campana de alertas → panel de diagnóstico.', accion: 'Lea los hallazgos de coherencia financiera: cada uno muestra código, mensaje, consecuencia y corrección sugerida.', resultado: 'Sabe QUÉ se desfasa y en qué sección.' },
          { titulo: '2. Ir a la sección señalada', donde: 'Pulse el hallazgo.', accion: 'El panel le lleva a la sección concreta (4.7, 4.10…).', resultado: 'Está editando el dato que origina el desfase.' },
          { titulo: '3. Corregir el dato y regenerar', donde: 'La sección señalada.', accion: 'Corrija el dato (monto, cantidad, parámetro). El modelo recalcula.', resultado: 'Las tablas y los textos generados vuelven a coincidir; el análisis editado a mano se marca cuando su huella de origen no coincide con el modelo, para que decida si conservar su texto o regenerarlo.' },
        ],
      },
      { tipo: 'nota', texto: 'La aplicación NO oculta inconsistencias: si una cifra no cuadra, la muestra con su código y consecuencia. La política es «visibilidad primero».' },
    ],
  },
  {
    id: 'guia-advertencia-capacidad',
    capa: 'guias',
    titulo: 'Cómo interpretar una advertencia de capacidad instalada',
    resumen: 'Entender los escenarios A y B, la capacidad máxima mensual por servicio y por qué la demanda puede quedar limitada.',
    etiquetas: ['capacidad', 'advertencia', 'escenario a', 'escenario b', 'ampliación', 'demanda', 'recursos'],
    objetivo: 'Decidir con criterio si la demanda proyectada es atendible con la capacidad declarada.',
    requisitos: ['Servicios con demanda prevista (4.7).', 'Recursos técnicos declarados y escenario de capacidad activo (4.6).'],
    resultado: 'Sabe si la advertencia refleja un límite real (escenario A) o si la ampliación programada (escenario B) absorbe el crecimiento.',
    errores: [
      'Aumentar la capacidad máxima «para que desaparezca la advertencia» sin sustento: la capacidad debe derivarse de recursos, turnos y tiempos reales.',
      'Ignorar que los ingresos reconocidos se limitan por la capacidad: la advertencia existe porque el modelo NO vende por encima de lo atendible.',
    ],
    relacionados: ['con-proyeccion-no-viabilidad', 'ref-secciones', 'ref-indicadores'],
    bloques: [
      { tipo: 'p', texto: 'La advertencia de capacidad (código CAPACIDAD) aparece cuando la demanda proyectada de un servicio supera lo atendible. El modelo calcula lo atendible desde la capacidad máxima mensual del servicio y los recursos técnicos compartidos.' },
      { tipo: 'lista', elementos: [
        'Escenario A (capacidad constante): la capacidad no crece; la demanda no atendible queda limitada y ADVERTIDA, no vendida.',
        'Escenario B (ampliación programada): las ampliaciones añaden capacidad y CAPEX en sus años de ejecución; el modelo las incluye íntegramente (no presenta una recuperación optimista que ignore la inversión adicional).',
        'La capacidad máxima mensual 0 significa «sin tope explícito»; declárela a partir de recursos, turnos y duración de cada servicio.',
      ] },
      {
        tipo: 'pasos',
        pasos: [
          { titulo: '1. Localizar el servicio limitado', donde: 'Diagnóstico → hallazgo CAPACIDAD; sección 4.7 → servicios.', accion: 'El hallazgo nombra el servicio y el año a partir del cual la demanda excede la capacidad.', resultado: 'Sabe qué servicio y qué año se ven afectados.' },
          { titulo: '2. Decidir la respuesta de negocio', donde: 'Sección 4.6 (recursos y escenarios) y 4.7 (capacidad máxima).', accion: 'Opciones reales: (a) añadir recursos/ampliaciones y activar el escenario B, (b) ajustar la demanda prevista, o (c) aceptar el límite y su efecto en los ingresos.', resultado: 'La advertencia desaparece solo si el plan atiende la demanda; si la acepta, queda documentada como advertencia con su efecto.' },
        ],
      },
      { tipo: 'aviso', texto: AVISO_DIDACTICO },
    ],
  },
  {
    id: 'guia-formulas-impuestos',
    capa: 'guias',
    titulo: 'Cómo revisar las fórmulas de impuestos, amortización y recuperación',
    resumen: 'Abrir las reglas del motor, leer su fórmula y sus variables, y entender depreciación lineal e interpolación de recuperación.',
    etiquetas: ['fórmula', 'impuesto', 'amortización', 'depreciación', 'recuperación', 'reglas', 'nivel c', 'interpolación'],
    objetivo: 'Verificar CÓMO calcula el motor cada partida clave antes de fiarse del resultado.',
    requisitos: ['Un plan abierto.', 'Nociones básicas de la expresión de reglas (variables y operaciones).'],
    resultado: 'Comprueba que impuesto, depreciación y recuperación se calculan como el proyecto espera.',
    errores: [
      'Confundir amortización del crédito (financiación ajena) con depreciación contable (inversión fija): son conceptos y fórmulas distintas.',
      'Suponer que la recuperación es «año entero»: se interpola linealmente dentro del año de cruce.',
    ],
    relacionados: ['ref-formulas', 'guia-supuesto-configurable', 'con-recuperacion-inversion'],
    bloques: [
      {
        tipo: 'pasos',
        pasos: [
          { titulo: '1. Abrir la regla del impuesto', donde: 'Editor → «Configuración de cálculos» → reglas.', accion: 'Localice «impuesto_utilidades_k» y lea su expresión: MAX(0, utilidad_antes_impuestos_k × tasa_impuesto_utilidades).', resultado: 'MAX(0, …) significa que años con pérdidas no generan impuesto negativo.' },
          { titulo: '2. Revisar depreciación y amortización', donde: 'Reglas de depreciación + tabla de inversiones (vida útil, año de disponibilidad, valor residual).', accion: 'La depreciación es lineal sobre la base depreciable, solo desde el año de disponibilidad, con tope depreciable.', resultado: 'Ejemplo clínica: la depreciación del año 1 es 117,125 kUSD con los activos disponibles ese año; los activos del año 3 no deprecian antes.', evitar: 'Dejar vidas útiles en 0 para activos depreciables.' },
          { titulo: '3. Entender la recuperación', donde: 'Sección 4.7 → indicadores de recuperación.', accion: 'Lea los DOS valores: recuperación de la inversión total (flujo del proyecto, FCFF) y del capital aportado (flujo de socios, FCFE).', resultado: 'Clínica con tasa 743: 3,4 años (proyecto) y 3,2 años (socios), interpolados dentro del año de cruce.', evitar: 'Comparar la recuperación del proyecto con la de los socios esperando que coincidan: difieren por el crédito (desembolsos e intereses).' },
        ],
      },
      { tipo: 'formula', expresion: 'impuesto = MAX(0, UAI × tasa)', variables: [{ nombre: 'UAI', significado: 'utilidad antes de impuestos del año', unidad: 'kUSD' }, { nombre: 'tasa', significado: 'tasa de impuesto sobre utilidades (parámetro)', unidad: 'decimal (0,35 = 35 %)' }], ejemplo: `Clínica, año 1, tasa 743: 386,86 × 0,35 = 135,40 kUSD. ${AVISO_DIDACTICO}` },
    ],
  },
  {
    id: 'guia-generar-pdf',
    capa: 'guias',
    titulo: 'Cómo generar, revisar y descargar el PDF',
    resumen: 'Usar la vista documental con el visor real: paginación, zoom, búsqueda, pantalla completa y descarga idéntica.',
    etiquetas: ['pdf', 'visor', 'previsualización', 'descargar', 'exportar', 'documento'],
    objetivo: 'Revisar el documento final tal como saldrá, y descargar exactamente lo revisado.',
    requisitos: ['Un plan con datos.', 'Sin errores bloqueantes, o dispuesto a exportarlos marcados (se advierte antes).'],
    resultado: 'PDF revisado página a página y descargado, idéntico byte a byte a lo mostrado en el visor.',
    errores: [
      'Descargar sin revisar la nota de conversión ni el índice: el PDF es la cara visible del plan; las advertencias de datos ficticios y tasa ilustrativa van incluidas.',
      'Pensar que la previsualización es «aproximada»: es el PDF real generado por el mismo motor que la descarga.',
    ],
    relacionados: ['guia-exportar-word', 'ref-exportaciones', 'guia-monedad-presentacion'],
    bloques: [
      {
        tipo: 'pasos',
        pasos: [
          { titulo: '1. Abrir la previsualización', donde: 'Editor → menú «Exportar» → «Previsualizar documento (PDF real)».', accion: 'Se abre la vista documental completa (URL propia #/preview?plan=…, no un modal).', resultado: 'El visor muestra el PDF del plan con su estado de generación, fecha y moneda de presentación.' },
          { titulo: '2. Revisar como se leerá', donde: 'Controles del visor.', accion: 'Use paginación y zoom, el ajuste de ancho/página, la búsqueda con resaltado y la pantalla completa.', resultado: 'Puede leer portada, índice con páginas reales, tablas con encabezados repetidos en cada página y pies numerados.' },
          { titulo: '3. Descargar', donde: 'Botón «Descargar» del visor o menú «Exportar» → «Exportar PDF».', accion: 'Descargue.', resultado: 'El archivo descargado es el mismo documento que está viendo (mismos bytes que la generación activa del visor).', evitar: 'Editar datos con el visor abierto esperando que «se actualice solo»: el visor regenera al cambiar de vuelta a la vista o al pulsar actualizar; observe el indicador de estado.' },
        ],
      },
      { tipo: 'nota', texto: 'Antes de exportar, la aplicación confirma los cambios pendientes con el servidor y advierte de conflictos sin resolver: la exportación usa siempre una versión consistente de los datos.' },
    ],
  },
  {
    id: 'guia-exportar-word',
    capa: 'guias',
    titulo: 'Cómo exportar un documento Word editable',
    resumen: 'Generar el .docx con estilos reales de Word, tablas editables, índice actualizable y tablas anchas en apaisado.',
    etiquetas: ['word', 'docx', 'exportar', 'editable', 'índice', 'apaisado'],
    objetivo: 'Obtener un documento Word estructurado y editable para continuar el trabajo fuera de PLANEX.',
    requisitos: ['Un plan con datos.', 'Un procesador capaz de abrir .docx.'],
    resultado: 'Archivo .docx con estilos de título, tablas editables (no imágenes), índice actualizable y pies de página.',
    errores: [
      'Esperar que el índice Word venga con números de página fijos: el índice usa campos de Word; al abrir, acepte «Actualizar campos» para que Word calcule las páginas reales.',
      'Editar el Word y esperar que PLANEX recupere esos cambios: la vía de importación es el JSON del proyecto; el Word es un producto de salida.',
    ],
    relacionados: ['guia-generar-pdf', 'ref-exportaciones'],
    bloques: [
      {
        tipo: 'pasos',
        pasos: [
          { titulo: '1. Exportar', donde: 'Editor → menú «Exportar» → «Exportar Word (.docx)».', accion: 'Confirme si hay advertencias (errores marcados, cambios pendientes).', resultado: 'Se descarga un .docx real generado desde el mismo modelo documental que el PDF.' },
          { titulo: '2. Actualizar el índice al abrir', donde: 'Word/LibreOffice al abrir el archivo.', accion: 'Acepte la actualización de campos (o selecciónelos y pulse F9 en Word).', resultado: 'El índice muestra las páginas reales según su procesador y su configuración de página.' },
          { titulo: '3. Editar con criterio', donde: 'El documento abierto.', accion: 'Los títulos usan estilos de Word y las tablas son tablas reales: pueden editarse, ordenarse y copiarse.', resultado: 'El equipo puede continuar redactando la versión final fuera de la aplicación.', evitar: 'Borrar las advertencias del documento (datos ficticios, tasa ilustrativa): forman parte de la trazabilidad.' },
        ],
      },
      { tipo: 'lista', elementos: ['El Word NO es un PDF convertido a imágenes: es un documento con estilos, párrafos y tablas nativas.', 'Las tablas muy anchas se colocan en secciones apaisadas para no sacrificar la legibilidad.', 'La nota de conversión de moneda y las advertencias didácticas se incluyen igual que en el PDF.'] },
    ],
  },
  {
    id: 'guia-versiones-comparar',
    capa: 'guias',
    titulo: 'Cómo consultar y comparar versiones',
    resumen: 'Usar la vista Colaboración → Historial para ver versiones, y Comparar para ver las diferencias reales campo a campo.',
    etiquetas: ['versiones', 'comparar', 'historial', 'instantánea', 'diferencias', 'colaboración'],
    objetivo: 'Saber qué cambió entre dos versiones guardadas, con evidencia por sección y campo.',
    requisitos: ['Un plan con AL MENOS DOS versiones guardadas (si no, guarde la primera desde Historial).'],
    resultado: 'Lista de diferencias reales por sección (datos generales, supuestos, inversiones, financiación, proyecciones y contenido documental).',
    errores: [
      'Comparar solo fechas esperando «ver» el cambio: la comparación es de CONTENIDO, campo a campo.',
      'Esperar versiones automáticas de cada pulsación: las versiones se guardan explícitamente (más la copia automática previa a cada restauración).',
    ],
    relacionados: ['guia-restaurar-version', 'guia-compartir-plan', 'ref-colaboracion-versiones'],
    bloques: [
      {
        tipo: 'pasos',
        pasos: [
          { titulo: '1. Abrir la vista de colaboración', donde: 'Editor → botón «Colaboración».', accion: 'Se abre la vista integrada (no un modal) con pestañas.', resultado: 'URL propia #/colaboracion?plan=…&tab=historial; se puede recargar, compartir y usar Atrás/Adelante.' },
          { titulo: '2. Guardar una versión', donde: 'Pestaña «Historial de versiones».', accion: 'Escriba una descripción y pulse «Guardar versión».', resultado: 'Instantánea inmutable de TODAS las secciones, con autor, fecha y número.' },
          { titulo: '3. Comparar dos versiones', donde: 'Pestaña «Comparar versiones» (o botón «Comparar» de una versión del historial).', accion: 'Elija la versión base (A) y la nueva (B); intercámbielas si hace falta.', resultado: 'Diferencias agrupadas por sección, con ruta del campo, valor en A y valor en B; contador total de cambios.' },
        ],
      },
      { tipo: 'nota', texto: 'La selección de versiones queda reflejada en la URL (?a=…&b=…), por lo que un enlace directo reproduce exactamente la comparación.' },
    ],
  },
  {
    id: 'guia-restaurar-version',
    capa: 'guias',
    titulo: 'Cómo restaurar una versión anterior',
    resumen: 'Volver a una instantánea guardada con confirmación explícita, copia de seguridad automática y trazabilidad completa.',
    etiquetas: ['restaurar', 'versión', 'historial', 'copia de seguridad', 'trazabilidad'],
    objetivo: 'Recuperar un estado anterior del plan sin perder nada de lo ocurrido después.',
    requisitos: ['Al menos una versión guardada.', 'Confirmar la acción explícitamente (la aplicación pide confirmación).'],
    resultado: 'El plan activo queda con el contenido de la versión elegida; el historial conserva TODAS las versiones y se crea una copia de seguridad del estado previo.',
    errores: [
      'Temer perder el historial posterior: la restauración NO borra versiones; el estado previo queda como copia automática.',
      'Restaurar sin avisar al otro colaborador: el cambio se registra en la actividad con su autoría, pero coordinar evita trabajo duplicado.',
    ],
    relacionados: ['guia-versiones-comparar', 'ref-colaboracion-versiones'],
    bloques: [
      {
        tipo: 'pasos',
        pasos: [
          { titulo: '1. Elegir la versión', donde: 'Colaboración → «Historial de versiones».', accion: 'Pulse «Restaurar» en la versión deseada.', resultado: 'Aparece la confirmación con fecha, autor y descripción de la versión.' },
          { titulo: '2. Confirmar', donde: 'Diálogo de confirmación.', accion: 'Lea el efecto (sustituye el estado activo; se guarda copia automática del estado actual) y confirme.', resultado: 'El plan se restaura y la actividad registra «Versión restaurada» con autoría.' },
          { titulo: '3. Verificar', donde: 'Editor y pestaña Historial.', accion: 'Revise las secciones afectadas y compare versiones si desea evidencia del cambio.', resultado: 'Puede acreditar QUÉ se restauró, QUIÉN lo hizo y CUÁNDO.' },
        ],
      },
      { tipo: 'nota', texto: 'La restauración usa el mismo control de concurrencia que la edición: si otro colaborador cambió secciones mientras tanto, el sistema lo detecta y exige resolución explícita.' },
    ],
  },
  {
    id: 'guia-compartir-plan',
    capa: 'guias',
    titulo: 'Cómo compartir un plan con otro colaborador y entender sus permisos',
    resumen: 'Cómo funciona el espacio compartido, qué puede hacer cada rol, y cómo se aíslan los datos entre proyectos y usuarios.',
    etiquetas: ['compartir', 'colaboración', 'permisos', 'roles', 'rls', 'espacio', 'seguridad'],
    objetivo: 'Trabajar dos personas sobre el mismo plan sabiendo quién puede hacer qué.',
    requisitos: ['Ambos colaboradores con cuenta del espacio compartido (alias y contraseña).'],
    resultado: 'Edición simultánea con autoría, resolución explícita de conflictos y aislamiento verificado por políticas RLS del servidor.',
    errores: [
      'Editar la misma sección a la vez sin mirar el aviso de conflicto: el sistema conserva ambas versiones y exige decidir cuál prevalece.',
      'Suponer que «cerrar sesión» borra el plan: los planes viven en el espacio compartido del servidor; cerrar sesión solo sale de la vista.',
    ],
    relacionados: ['guia-versiones-comparar', 'ref-colaboracion-versiones', 'con-advertencia-vs-incumplimiento'],
    bloques: [
      { tipo: 'p', texto: 'Los planes viven en un espacio compartido del servidor (Supabase). Ambos colaboradores entran con su alias y ven los mismos planes en el panel, en tiempo real (sin recargar).' },
      { tipo: 'lista', elementos: [
        'Rol EDITOR: editar todas las secciones, guardar y restaurar versiones, comentar y exportar. La autoría de cada cambio queda en la actividad.',
        'Aislamiento por políticas RLS: un usuario sin membresía del espacio no puede leer ni escribir sus planes, ni construyendo peticiones manualmente. El servidor rechaza el acceso.',
        'Concurrencia optimista: si dos editores tocan la misma sección, el segundo recibe un conflicto con TRES resoluciones explícitas (copia local + remota / cargar remota / sobrescribir con la mía). Nunca hay fusión automática de cifras.',
        'Autoguardado: cada cambio se envía poco después de escribir (indicador de estado real: pendiente/guardando/guardado/error/conflicto/sin conexión).',
      ] },
      {
        tipo: 'pasos',
        pasos: [
          { titulo: '1. Ver a los participantes', donde: 'Colaboración → pestaña «Colaboradores».', accion: 'Consulte la lista de miembros del espacio con su rol.', resultado: 'Sabe quién trabaja en el espacio y con qué permisos reales.' },
          { titulo: '2. Coordinar con comentarios', donde: 'Pestaña «Comentarios».', accion: 'Deje observaciones por sección (no alteran cifras).', resultado: 'El otro colaborador ve el comentario al abrir la misma vista, con autor y fecha.' },
          { titulo: '3. Resolver conflictos si surgen', donde: 'Pestaña «Conflictos» (aparece solo cuando existen).', accion: 'Compare su versión con la del otro colaborador campo a campo y decida explícitamente.', resultado: 'Ninguna cifra se pierde silenciosamente; la decisión queda en el historial.' },
        ],
      },
    ],
  },
];

// ============================================================================
// REFERENCIA
// ============================================================================

const REFERENCIA: ArticuloAyuda[] = [
  {
    id: 'ref-secciones',
    capa: 'referencia',
    titulo: 'Secciones metodológicas 4.1–4.12',
    resumen: 'Qué contiene cada sección del editor, con qué datos alimenta al motor y qué validaciones la vigilan.',
    etiquetas: ['secciones', '4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9', '4.10', '4.11', '4.12', 'metodología', 'índice'],
    relacionados: ['ref-parametros', 'ref-indicadores'],
    bloques: [
      { tipo: 'p', texto: 'La estructura del editor sigue las Bases Metodológicas que inspiran la plantilla documental (GOC-2026-O57, referencia ilustrativa a validar). El editor añade una sección de configuración de cálculos que no forma parte del índice del documento.' },
      {
        tipo: 'tabla',
        encabezados: ['Sección', 'Contenido principal', 'Alimenta al motor con'],
        filas: [
          ['4.1–4.3 Información general e índice', 'Nombre del proyecto, inversionistas, modalidad de inversión extranjera, datos generales e índice automático.', 'Nombre y metadatos del plan.'],
          ['4.4 Resumen ejecutivo', 'Síntesis generada desde el modelo (inversión, financiación, ingresos, recuperación) editable con control de huella.', 'Texto generado a partir de los indicadores.'],
          ['4.5 Descripción del negocio', 'Objeto del negocio, inversionista extranjero y nacional, vínculos con Cuba.', 'Contexto narrativo.'],
          ['4.6 Aspectos técnicos', 'Caracterización, capacidad instalada, recursos técnicos, escenarios A/B, consumo de recursos por servicio.', 'Recursos, capacidad y consumos técnicos.'],
          ['4.7 Análisis financiero', 'Inversiones, aportaciones, crédito, servicios (precio/cantidad/capacidad/costo), personal indirecto, proyecciones e indicadores.', 'La mayor parte de los datos del motor.'],
          ['4.8 Mercado', 'Análisis de mercado y demanda.', 'Textos de contexto.'],
          ['4.9 Fuerza de trabajo', 'Plantilla por etapa y grupo con salarios anuales en CUP.', 'Costo laboral y beneficios al país (pagos a trabajadores).'],
          ['4.10 Inversiones', 'Tabla de inversiones por concepto (categoría, moneda, monto, vida útil, disponibilidad, valor residual).', 'Inversión total, depreciación, calendario.'],
          ['4.11 Beneficios al país', 'Utilidades, impuestos, pagos a trabajadores y otros aportes acumulados.', 'Sección de salida: refleja el modelo.'],
          ['4.12 Conclusiones', 'Conclusiones generadas desde el modelo, editables con control de huella.', 'Texto generado a partir de los indicadores.'],
          ['Configuración de cálculos', 'Parámetros (Nivel A) y reglas (Nivel C) del motor.', 'Supuestos y fórmulas de todo el cálculo.'],
        ],
      },
      { tipo: 'nota', texto: 'El índice del documento exportado se genera automáticamente con las páginas reales (doble pasada en el PDF; campos actualizables en el Word).' },
    ],
  },
  {
    id: 'ref-parametros',
    capa: 'referencia',
    titulo: 'Parámetros financieros (Nivel A)',
    resumen: 'Valores configurables del plan: impuesto, tipo de cambio, crédito, inflación, dividendos y participación.',
    etiquetas: ['parámetros', 'nivel a', 'impuesto', 'tipo de cambio', 'crédito', 'inflación', 'dividendos', 'parte cubana'],
    relacionados: ['guia-supuesto-configurable', 'guia-cambiar-tasa', 'ref-formulas'],
    bloques: [
      { tipo: 'p', texto: 'Los parámetros son VALORES (no fórmulas) que el motor combina según las reglas. Todos son editables y su cambio recalcula el plan al instante. Los marcados «demo» son supuestos ilustrativos pendientes de validación oficial.' },
      {
        tipo: 'tabla',
        encabezados: ['Parámetro', 'Valor por defecto', 'Unidad', 'Uso en el cálculo'],
        filas: [
          ['tasa_impuesto_utilidades', '0,35 (35 %)', 'decimal', 'Impuesto sobre utilidades: MAX(0, UAI × tasa). Supuesto demostrativo pendiente de confirmación tributaria.'],
          ['tipo_cambio', '743', 'CUP/USD', 'Conversión única de partidas en CUP (salarios e inversiones) a kUSD. Tasa ilustrativa del 2026-10-26, pendiente de validación oficial.'],
          ['tasa_interes', '0,08 (8 %)', '% anual', 'Intereses del crédito sobre el saldo vigente.'],
          ['plazo_amortizacion', '5', 'años', 'Anualidades de amortización del principal tras la gracia.'],
          ['periodo_gracia', '1', 'años', 'Años de gracia del crédito (solo principal o total, configurable en el calendario de deuda).'],
          ['inflacion', '0,04 (4 %)', '% anual', 'Crecimiento de los costos variables unitarios.'],
          ['crecimiento_precios', '0,03 (3 %)', '% anual', 'Variación anual de los precios de los servicios.'],
          ['pct_reserva_legal', '0,10 (10 %)', 'decimal', 'Reserva sobre la base distribuible de dividendos.'],
          ['pct_reparto_dividendos', '0,50 (50 %)', 'decimal', 'Fracción del distribuible repartida como dividendos.'],
          ['pct_parte_cubana', '0,40 (40 %)', 'decimal', 'Participación cubana en los dividendos distribuidos (concepto distinto del reparto).'],
        ],
      },
      { tipo: 'aviso', texto: AVISO_TASA },
    ],
  },
  {
    id: 'ref-monedas-unidades',
    capa: 'referencia',
    titulo: 'Monedas, unidades, escalas y reglas de conversión',
    resumen: 'Cómo PLANEX maneja CUP y USD: moneda de origen, moneda de presentación, unidades de tabla y qué no se convierte.',
    etiquetas: ['moneda', 'unidades', 'kUSD', 'kCUP', 'conversión', 'escala', 'miles', 'salarios'],
    relacionados: ['guia-monedad-presentacion', 'guia-cambiar-tasa', 'ref-formulas'],
    bloques: [
      { tipo: 'p', texto: 'Cada importe del plan tiene una MONEDA DE ORIGEN declarada (USD o CUP) en sus datos. El motor calcula internamente en miles de USD (kUSD) convirtiendo las partidas en CUP UNA sola vez con el parámetro tipo_cambio. La MONEDA DE PRESENTACIÓN (USD o CUP, preferencia del plan) solo afecta a cómo se muestra el documento.' },
      {
        tipo: 'formula',
        expresion: 'USD = CUP / tasa     ·     CUP = USD × tasa     ·     kCUP = kUSD × tasa',
        variables: [
          { nombre: 'tasa', significado: 'parámetro tipo_cambio (CUP por USD)', unidad: 'CUP/USD' },
          { nombre: 'kUSD', significado: 'miles de dólares', unidad: 'miles de USD' },
          { nombre: 'kCUP', significado: 'miles de pesos cubanos', unidad: 'miles de CUP' },
        ],
        ejemplo: `Tasa por defecto 743: 400 000 CUP / 743 = 538,36 USD; una inversión de 100 kCUP equivale a 100 / 743 = 0,1346 kUSD; 1 480 kUSD en presentación CUP son 1 480 × 743 = 1 099 640,0 kCUP. ${AVISO_DIDACTICO}`,
      },
      {
        tipo: 'tabla',
        encabezados: ['Magnitud', 'Unidad de origen', 'En presentación USD', 'En presentación CUP'],
        filas: [
          ['Inversiones y flujos', 'USD o CUP (según partida)', 'Miles de USD (kUSD)', 'Miles de CUP (kCUP)'],
          ['Salarios', 'CUP completos (anual por trabajador)', 'CUP con equivalente anual en USD documentado', 'CUP (sin equivalente: ya es la moneda pedida)'],
          ['Porcentajes, vidas útiles, horas, plantillas', 'No monetarias', 'Sin conversión', 'Sin conversión'],
          ['Precios de servicios', 'USD', 'USD', 'Equivalentes en CUP vía tasa'],
        ],
      },
      { tipo: 'lista', elementos: [
        'La conversión se aplica una sola vez desde la moneda de origen: nunca en cascada ni dos veces.',
        'El documento incluye una nota de conversión con la tasa aplicada, su fecha de referencia, su fuente y la advertencia de validación pendiente.',
        'Cambiar la moneda de presentación NO modifica ningún dato del plan (verificable: el JSON no cambia).',
      ] },
    ],
  },
  {
    id: 'ref-formulas',
    capa: 'referencia',
    titulo: 'Fórmulas del motor: expresión, variables, unidades y ejemplos',
    resumen: 'Fichas de las fórmulas clave: impuesto, depreciación, costo laboral, flujos, recuperación y dividendos, con ejemplo numérico reproducible.',
    etiquetas: ['fórmulas', 'motor', 'impuesto', 'depreciación', 'fcff', 'fcfe', 'recuperación', 'dividendos', 'ejemplo'],
    relacionados: ['ref-parametros', 'guia-formulas-impuestos', 'con-ingresos-resultado-caja'],
    bloques: [
      { tipo: 'p', texto: 'Todas las reglas viven en «Configuración de cálculos» y son editables (Nivel C). Las fórmulas siguientes son las vigentes por defecto; un plan puede haberlas personalizado.' },
      {
        tipo: 'formula',
        expresion: 'impuesto_utilidades_k = MAX(0, utilidad_antes_impuestos_k × tasa_impuesto_utilidades)',
        variables: [
          { nombre: 'utilidad_antes_impuestos_k', significado: 'UAI del año', unidad: 'kUSD' },
          { nombre: 'tasa_impuesto_utilidades', significado: 'tasa del impuesto (parámetro)', unidad: 'decimal' },
        ],
        ejemplo: `Clínica, año 1 (tasa de cambio 743): 386,86 × 0,35 = 135,40 kUSD. Años con UAI negativa pagan 0 (MAX). ${AVISO_DIDACTICO}`,
      },
      {
        tipo: 'formula',
        expresion: 'depreciación_anual = base depreciable / vida útil   (solo desde el año de disponibilidad)',
        variables: [
          { nombre: 'base depreciable', significado: 'monto del activo convertido a kUSD (CUP se convierte una vez con tipo_cambio)', unidad: 'kUSD' },
          { nombre: 'vida útil', significado: 'años de depreciación lineal declarados en la partida', unidad: 'años' },
          { nombre: 'año de disponibilidad', significado: 'primer año en que el activo opera; no deprecia antes', unidad: 'año del horizonte' },
        ],
        ejemplo: `Clínica, año 1: con los activos disponibles ese año la depreciación es 117,125 kUSD. Un activo disponible desde el año 3 no deprecia en los años 1–2. ${AVISO_DIDACTICO}`,
      },
      {
        tipo: 'formula',
        expresion: 'costo_laboral_k = Σ (trabajadores × salario anual en CUP) / tipo_cambio / 1 000',
        variables: [
          { nombre: 'salario anual', significado: 'salario promedio anual por trabajador, en CUP completos (sección 4.9)', unidad: 'CUP/año' },
          { nombre: 'tipo_cambio', significado: 'parámetro CUP por USD', unidad: 'CUP/USD' },
        ],
        ejemplo: `Clínica, año 1: 15 312 000 CUP / 743 / 1 000 = 20,61 kUSD. Montaje (año 0): 6 × 96 000 CUP → 0,78 kUSD. ${AVISO_DIDACTICO}`,
      },
      {
        tipo: 'formula',
        expresion: 'FCFF = utilidad neta + intereses devengados + depreciación − CAPEX de ampliaciones   ·   FCFE = FCFF − intereses pagados + desembolsos del crédito − amortizaciones',
        variables: [
          { nombre: 'FCFF', significado: 'flujo de caja del proyecto (financiador): mide la recuperación de la INVERSIÓN TOTAL', unidad: 'kUSD' },
          { nombre: 'FCFE', significado: 'flujo de los socios: mide la recuperación del CAPITAL APORTADO', unidad: 'kUSD' },
        ],
        ejemplo: `Clínica, año 0 (tasa 743): FCFF = −(1 480 + 0,78) = −1 480,78 kUSD (inversión total más pérdida de montaje); FCFE = −(1 180 + 0,78) kUSD (aportaciones más pérdida). ${AVISO_DIDACTICO}`,
      },
      {
        tipo: 'formula',
        expresion: 'recuperación = (t−1) + |acumulado anterior| / (acumulado del año t − acumulado anterior)',
        variables: [
          { nombre: 't', significado: 'primer año en que el acumulado cruza cero', unidad: 'año' },
          { nombre: 'acumulado', significado: 'flujo acumulado del proyecto (FCFF) o de los socios (FCFE)', unidad: 'kUSD' },
        ],
        ejemplo: `Clínica (tasa 743): el proyecto recupera en 3,4 años (interpolación dentro del año 4) y los socios en 3,2. El capital de trabajo no se recupera dentro del modelo (parámetro de recuperación en 0 %: tratamiento conservador). ${AVISO_DIDACTICO}`,
      },
      {
        tipo: 'formula',
        expresion: 'dividendos pagaderos = MAX(0, UDI + saldo acumulable previo − reserva) × pct_reparto',
        variables: [
          { nombre: 'saldo acumulable previo', significado: 'pérdidas de años anteriores que aún absorben la base distribuible', unidad: 'kUSD' },
          { nombre: 'reserva', significado: 'reserva legal (pct_reserva_legal × base)', unidad: 'kUSD' },
          { nombre: 'pct_reparto', significado: 'fracción del distribuible que se reparte', unidad: 'decimal' },
        ],
        ejemplo: 'La pérdida del año 0 de montaje se absorbe antes de repartir: la caja de dividendos no paga beneficios que la contabilidad acumulada no soporta.',
      },
    ],
  },
  {
    id: 'ref-indicadores',
    capa: 'referencia',
    titulo: 'Indicadores financieros y criterios de interpretación',
    resumen: 'Qué indicadores calcula el modelo y cómo leerlos: inversión total, financiación, UAI/impuesto/UDI, FCFF/FCFE, recuperaciones y beneficios al país.',
    etiquetas: ['indicadores', 'inversión total', 'uai', 'udi', 'fcff', 'fcfe', 'recuperación', 'beneficios al país', 'interpretación'],
    relacionados: ['ref-formulas', 'con-recuperacion-inversion', 'con-proyeccion-no-viabilidad'],
    bloques: [
      {
        tipo: 'tabla',
        encabezados: ['Indicador', 'Qué mide', 'Criterio de lectura'],
        filas: [
          ['Inversión total (kUSD)', 'Gastos previos + inversión fija + capital de trabajo.', 'Debe estar explicada por las fuentes de financiación (diferencia ≥ 0).'],
          ['Financiación disponible (kUSD)', 'Aportaciones + otras fuentes + desembolsos del crédito.', 'Diferencia negativa = advertencia bloqueante con importe exacto.'],
          ['UAI / impuesto / UDI (por año)', 'Estado de resultados proyectado.', 'El impuesto usa la tasa del parámetro; años con pérdida pagan 0.'],
          ['FCFF (flujo del proyecto)', 'Caja generada por el proyecto como tal (recuperación de la inversión total).', 'El cruce del acumulado da la recuperación; el horizonte debe cubrirla + 1 año (metodología).'],
          ['FCFE (flujo de los socios)', 'Caja para los aportantes tras el servicio de la deuda (recuperación del capital aportado).', 'Difiere del FCFF por el crédito: no espere que coincidan.'],
          ['Recuperación (años, interpolada)', 'Años hasta recuperar inversión total o capital aportado.', 'Se interpola dentro del año de cruce (no años enteros).'],
          ['Beneficios al país (acumulados)', 'Utilidades, impuestos y pagos a la fuerza de trabajo acumulados.', 'Se calculan desde el modelo; el documento los concilia con las tablas.'],
          ['Caja de dividendos (por año)', 'Distribuciones pagaderas tras reserva y absorción de pérdidas previas.', 'Pagaderos = 0 si la caja acumulada no alcanza; se documenta la restricción.'],
        ],
      },
      { tipo: 'nota', texto: 'El modelo no calcula VPN/TIR: la plantilla metodológica se apoya en los flujos, las recuperaciones duales y los beneficios al país. Si su análisis exige descuento, exporte los flujos (Excel con fórmulas reales) y añada su criterio fuera del motor, documentándolo.' },
      { tipo: 'aviso', texto: AVISO_DIDACTICO },
    ],
  },
  {
    id: 'ref-estados-alertas',
    capa: 'referencia',
    titulo: 'Estados, advertencias, validaciones y errores',
    resumen: 'Los cuatro niveles del diagnóstico, los códigos más comunes y el significado del estado de sincronización.',
    etiquetas: ['diagnóstico', 'advertencias', 'validaciones', 'errores', 'códigos', 'sincronización', 'estados'],
    relacionados: ['guia-diferencia-resumen-tabla', 'guia-advertencia-capacidad', 'guia-plan-financiado'],
    bloques: [
      { tipo: 'p', texto: 'El diagnóstico (campana del editor → panel lateral) clasifica los hallazgos en cuatro niveles. La completitud NO es prueba de calidad: un apartado relleno con supuestos sin respaldo no es un apartado validado.' },
      {
        tipo: 'tabla',
        encabezados: ['Nivel', 'Significado', 'Ejemplos de códigos'],
        filas: [
          ['Error bloqueante', 'El cálculo no puede continuar con integridad; se muestra en vez de inventar cifras.', 'Errores de fórmula/regla; datos imprescindibles ausentes.'],
          ['Advertencia importante', 'Incoherencia financiera que condiciona el resultado y debe resolverse o aceptarse conscientemente.', 'FINANCIACION_INSUFICIENTE (con importe exacto), FINANCIACION_EXCESO, CAPACIDAD (demanda no atendible), HORIZONTE_CORTO.'],
          ['Información pendiente', 'Datos que la metodología espera y aún no constan.', 'Campos pendientes de la plantilla; fuente/fecha de la tasa sin documentar.'],
          ['Observación de calidad', 'Mejoras de trazabilidad o contexto.', 'DATOS_FICTICIOS (la plantilla sigue siendo demostrativa), TASA_DEMO (tasa ilustrativa sin validar), DIVIDENDOS_RESTRINGIDOS (explica el importe retenido).'],
        ],
      },
      { tipo: 'p', texto: 'Estado de sincronización (barra del editor y de la vista de Colaboración):' },
      { tipo: 'lista', elementos: [
        '«Guardado HH:MM» / verde: todo confirmado en el servidor.',
        '«Cambios pendientes de guardar» / «Guardando…»: autoguardado en curso (envío poco después de escribir).',
        '«Error al guardar»: su trabajo se conserva localmente y se reintenta; revise la conexión.',
        '«N sección(es) con conflicto de edición»: otro colaborador guardó antes; resuelva explícitamente en Colaboración → Conflictos.',
        '«Sin conexión»: los cambios se conservan localmente y se reintentarán; nada se marca como guardado sin estarlo.',
      ] },
    ],
  },
  {
    id: 'ref-colaboracion-versiones',
    capa: 'referencia',
    titulo: 'Colaboración, permisos e historial de versiones',
    resumen: 'Referencia de la vista de Colaboración: pestañas, versiones, restauración, conflictos, comentarios y aislamiento de datos.',
    etiquetas: ['colaboración', 'versiones', 'permisos', 'roles', 'conflictos', 'comentarios', 'actividad', 'rls'],
    relacionados: ['guia-compartir-plan', 'guia-versiones-comparar', 'guia-restaurar-version'],
    bloques: [
      {
        tipo: 'tabla',
        encabezados: ['Pestaña', 'Qué muestra'],
        filas: [
          ['Resumen y actividad', 'Estado del plan, sincronización real, última versión y registro append-only de cambios con autoría.'],
          ['Historial de versiones', 'Instantáneas inmutables (todas las secciones), guardado con descripción, detalles de cada versión y restauración con confirmación.'],
          ['Comparar versiones', 'Diferencias reales campo a campo entre dos versiones seleccionadas (URL con ?a y ?b reproducible).'],
          ['Comentarios', 'Observaciones por sección con autor y fecha; no alteran datos financieros.'],
          ['Colaboradores', 'Miembros del espacio y rol real (editor); explicación de permisos y aislamiento RLS.'],
          ['Conflictos (si existen)', 'Comparación local vs. remota por sección y tres resoluciones explícitas; nunca fusión automática.'],
        ],
      },
      { tipo: 'lista', elementos: [
        'Las versiones son instantáneas COMPLETAS: restaurar sustituye el estado activo tras guardar una copia de seguridad automática del estado previo; el historial nunca se borra.',
        'Cada sección guarda su versión (concurrency control) y la actividad registra quién cambió qué y cuándo.',
        'La vista completa vive en una URL propia (#/colaboracion?plan=…&tab=…): recargable, compartible y con Atrás/Adelante funcional.',
      ] },
    ],
  },
  {
    id: 'ref-exportaciones',
    capa: 'referencia',
    titulo: 'Formatos de exportación y limitaciones documentales',
    resumen: 'Qué produce cada exportación (PDF, Word, Excel, JSON) y qué limitaciones tiene cada formato.',
    etiquetas: ['exportar', 'pdf', 'word', 'docx', 'excel', 'xlsx', 'json', 'limitaciones'],
    relacionados: ['guia-generar-pdf', 'guia-exportar-word', 'ref-monedas-unidades'],
    bloques: [
      {
        tipo: 'tabla',
        encabezados: ['Formato', 'Qué incluye', 'Limitaciones documentadas'],
        filas: [
          ['PDF (previsualización y descarga)', 'Portada, índice con páginas reales (doble pasada), secciones 4.1–4.12, tablas con encabezados repetidos y pies numerados, nota de conversión y advertencias didácticas.', 'Documento final de lectura, no editable. La descarga es idéntica a lo mostrado en el visor.'],
          ['Word (.docx)', 'Mismo modelo documental que el PDF, con estilos de Word, tablas editables, índice por campos actualizables y secciones apaisadas para tablas anchas.', 'El índice requiere «Actualizar campos» al abrir. Es un producto de salida: no se reimporta.'],
          ['Excel (.xlsx)', '22 hojas del motor con FÓRMULAS REALES y recálculo automático al abrir; parámetros, reglas y controles documentados.', 'Algunas reglas no traducibles se exportan como valor estático, documentadas en la hoja «Reglas».'],
          ['JSON del proyecto', 'Esquema versionado con TODAS las secciones, parámetros, reglas y análisis editados.', 'Formato de intercambio de PLANEX: solo este archivo reconstruye el proyecto completo al importarlo.'],
        ],
      },
      { tipo: 'nota', texto: 'Antes de cualquier exportación la aplicación confirma los cambios pendientes y advierte de conflictos, para que el archivo salga de una versión consistente de los datos.' },
      { tipo: 'aviso', texto: AVISO_DIDACTICO },
    ],
  },
];

// ============================================================================
// CONCEPTOS Y EXPLICACIONES
// ============================================================================

const CONCEPTOS: ArticuloAyuda[] = [
  {
    id: 'con-inversion-vs-gasto',
    capa: 'conceptos',
    titulo: 'Inversión, gasto operativo y capital de trabajo',
    resumen: 'Por qué un desembolso no siempre es inversión: la distinción que ordena el plan y sus impuestos.',
    etiquetas: ['inversión', 'gasto', 'capital de trabajo', 'concepto', 'contabilidad'],
    relacionados: ['con-financiacion', 'ref-secciones'],
    bloques: [
      { tipo: 'p', texto: 'La inversión son los recursos que crean capacidad de producir durante años (equipos, obras, licencias de larga duración) más los gastos necesarios para poner el negocio en marcha y el capital que financia la operación inicial. El gasto operativo, en cambio, se consume en el año en que se incurre: salarios, materiales, servicios públicos.' },
      { tipo: 'p', texto: 'La distinción no es cosmética: la inversión se recupera a través de la depreciación a lo largo de la vida útil de los activos, mientras que el gasto operativo afecta directamente a la utilidad del año. Mezclarlos infla o deprime artificialmente el resultado, distorsiona la recuperación de la inversión y puede inducir errores tributarios graves.' },
      { tipo: 'p', texto: 'El capital de trabajo es la liquidez inicial para operar antes de cobrar: en PLANEX es una partida explícita de la inversión total. La clínica demostrativa, por ejemplo, declara 1 480,0 kUSD de inversión total: 45 de gastos previos + 1 200 de inversión fija + 235 de capital de trabajo. Por eso la inversión puede estar «completa» y aun así el plan necesita liquidez para arrancar.' },
      { tipo: 'aviso', texto: AVISO_DIDACTICO },
    ],
  },
  {
    id: 'con-financiacion',
    capa: 'conceptos',
    titulo: 'Inversión inicial, aportaciones y financiación ajena',
    resumen: 'Cómo se relacionan lo que cuesta el proyecto, lo que ponen los socios y lo que presta un tercero.',
    etiquetas: ['financiación', 'aportaciones', 'crédito', 'socios', 'concepto'],
    relacionados: ['guia-plan-financiado', 'con-ingresos-resultado-caja'],
    bloques: [
      { tipo: 'p', texto: 'Toda inversión inicial debe quedar explicada por fuentes: aportes de los socios (efectivo o activos aportados) y, en su caso, financiación ajena (créditos). Si las fuentes no cubren la inversión, el plan no es ejecutable tal como está escrito, por atractivas que sean sus proyecciones.' },
      { tipo: 'p', texto: 'El crédito cambia la ESTRUCTURA del plan, no solo su monto: traslada la recuperación hacia los socios con otra velocidad (FCFE frente a FCFF), añade intereses y amortizaciones, y puede pedir garantías. Un plan financiado al 100 % con aportes y otro apalancado tienen riesgos distintos aunque la inversión total coincida.' },
      { tipo: 'p', texto: 'La plantilla clínica ilustra el caso «exacto»: aportaciones 1 180 + crédito 300 = 1 480 kUSD, igual a la inversión total. El centro de diagnóstico ilustra el caso sin deuda: 2 188,8 kUSD explicados íntegramente con aportes de los socios, uno de ellos un local aportado en CUP cuya conversión a kUSD queda documentada en la partida.' },
      { tipo: 'aviso', texto: AVISO_DIDACTICO },
    ],
  },
  {
    id: 'con-ingresos-resultado-caja',
    capa: 'conceptos',
    titulo: 'Ingresos, resultado contable y flujo de caja',
    resumen: 'Tres magnitudes distintas que el plan calcula por separado y por qué confundirlas lleva a decisiones erróneas.',
    etiquetas: ['ingresos', 'utilidad', 'flujo de caja', 'fcff', 'fcfe', 'concepto', 'contabilidad'],
    relacionados: ['ref-formulas', 'con-recuperacion-inversion'],
    bloques: [
      { tipo: 'p', texto: 'Los ingresos miden lo vendido; el resultado contable (utilidad) resta a los ingresos los gastos del período, incluida la depreciación, que no es un desembolso; el flujo de caja mide el dinero efectivo que entra y sale. Un negocio puede ser rentable en papel y quedarse sin liquidez, o al revés.' },
      { tipo: 'p', texto: 'PLANEX calcula por ello DOS flujos separados: el del proyecto (FCFF, que mide la recuperación de la inversión total) y el de los socios (FCFE, que resta el servicio de la deuda y mide la recuperación de los aportes). La diferencia entre ambos procede exclusivamente del crédito: desembolsos que entran, intereses y amortizaciones que salen.' },
      { tipo: 'p', texto: 'La caja de dividendos añade una tercera lente: solo se reparte cuando la utilidad acumulada lo soporta (tras la reserva y la absorción de pérdidas previas). Por eso el año 0 de montaje de la clínica, con su pequeña pérdida, retrasa el primer reparto: la contabilidad manda sobre el entusiasmo.' },
    ],
  },
  {
    id: 'con-precios-volumenes-costos',
    capa: 'conceptos',
    titulo: 'Cómo afectan precios, volúmenes y costos a las proyecciones',
    resumen: 'La mecánica de ingresos y costos variables: crecimiento compuesto, capacidad que limita y costos que inflan.',
    etiquetas: ['precios', 'volúmenes', 'costos', 'proyecciones', 'demanda', 'capacidad', 'concepto'],
    relacionados: ['guia-advertencia-capacidad', 'con-proyeccion-no-viabilidad'],
    bloques: [
      { tipo: 'p', texto: 'Los ingresos del año n se derivan del precio unitario, la cantidad demandada y el crecimiento anual de ambos (parámetros de crecimiento de precios e inflación de costos). Como el crecimiento es compuesto, pequeños cambios porcentuales producen diferencias grandes al final del horizonte: 3 % de crecimiento de precios durante 10 años multiplica los precios por 1,34, no por 1,30.' },
      { tipo: 'p', texto: 'La capacidad instala el límite físico: el modelo no reconoce ingresos por encima de lo atendible. Ese es el propósito de la advertencia de capacidad: no es un fastidio del sistema, es el modelo negándose a vender servicios que no pueden prestarse. Los costos variables escalan con el volumen efectivamente atendido, mientras los costos fijos (canon, servicios públicos, administración) escalan con reglas propias declaradas.' },
      { tipo: 'p', texto: 'Sensibilidad práctica: suba un precio y verá ingresos crecer solo si la demanda lo absorbe; baje el costo variable y verá el margen inmediato; aumente la capacidad declarada solo si añade los recursos o ampliaciones que la sustentan (el escenario B exige declarar el CAPEX de esas ampliaciones).' },
    ],
  },
  {
    id: 'con-recuperacion-inversion',
    capa: 'conceptos',
    titulo: 'Cómo interpretar el período de recuperación de la inversión',
    resumen: 'Qué dice y qué no dice el indicador: dos recuperaciones, interpolación y lo que el número no puede prometer.',
    etiquetas: ['recuperación', 'payback', 'inversión', 'indicador', 'concepto'],
    relacionados: ['ref-indicadores', 'con-proyeccion-no-viabilidad'],
    bloques: [
      { tipo: 'p', texto: 'El período de recuperación expresa cuántos años tarda el flujo acumulado en devolver el dinero puesto. PLANEX calcula DOS: la recuperación de la inversión total (con el flujo del proyecto, FCFF) y la del capital aportado (con el flujo de los socios, FCFE). Suelen diferir: el crédito adelanta caja a cambio de servicio posterior.' },
      { tipo: 'p', texto: 'El número es interpolado dentro del año en que el acumulado cruza cero: 3,4 años significa que en algún punto del cuarto año se completa la recuperación. También es sensible al supuesto conservador del modelo: el capital de trabajo no se recupera dentro del horizonte (parámetro en 0 %), lo que retrasa el cruce respecto de modelos más optimistas.' },
      { tipo: 'p', texto: 'Lo que NO dice: nada sobre lo que ocurre después de recuperar (un plan que recupera en 3 años y luego se funde vale menos que otro que recupera en 5 y sostiene 15 años de beneficios), nada sobre el riesgo de los supuestos, y nada sobre requisitos normativos. Úselo como termómetro, no como veredicto.' },
      { tipo: 'aviso', texto: AVISO_DIDACTICO },
    ],
  },
  {
    id: 'con-proyeccion-no-viabilidad',
    capa: 'conceptos',
    titulo: 'Por qué una proyección matemática correcta no demuestra viabilidad económica',
    resumen: 'La diferencia entre calcular bien y ser viable: supuestos, mercado, ejecución y contexto normativo.',
    etiquetas: ['viabilidad', 'proyección', 'supuestos', 'riesgo', 'concepto', 'calidad'],
    relacionados: ['con-recuperacion-inversion', 'con-plantilla-demo'],
    bloques: [
      { tipo: 'p', texto: 'El motor garantiza que las cifras se DERIVEN correctamente de los supuestos: que no se sumen CUP con USD, que la depreciación empiece cuando el activo opera, que la recuperación se interpole bien. La coherencia interna es condición necesaria, no suficiente.' },
      { tipo: 'p', texto: 'La viabilidad depende de la CALIDAD de los supuestos: que los precios se sostengan, que la demanda exista, que los costos no se desborden, que la inversión se ejecute en plazo y presupuesto, que el marco tributario, laboral y de inversión extranjera aplicable se cumpla. Ninguna de esas condiciones se demuestra con un modelo de cálculo.' },
      { tipo: 'p', texto: 'Por eso PLANEX separa lo que puede garantizar (integridad del cálculo, trazabilidad de cambios, advertencias visibles) de lo que no (que los supuestos sean ciertos). El diagnóstico señala lo pendiente; la decisión de negocio es suya. Presentar una proyección coherente como «prueba de viabilidad» ante un evaluador es un error conceptual que la aplicación no puede cometer por usted, pero tampoco puede impedir.' },
    ],
  },
  {
    id: 'con-advertencia-vs-incumplimiento',
    capa: 'conceptos',
    titulo: 'Advertencia de coherencia financiera frente a incumplimiento normativo',
    resumen: 'Dos clases de señal distinta: una la emite el motor sobre sus propios datos; la otra solo puede dictaminarla el cumplimiento normativo.',
    etiquetas: ['advertencia', 'normativa', 'cumplimiento', 'diagnóstico', 'concepto'],
    relacionados: ['ref-estados-alertas', 'con-proyeccion-no-viabilidad'],
    bloques: [
      { tipo: 'p', texto: 'Una advertencia de coherencia financiera (financiación insuficiente, capacidad excedida, horizonte corto) es una observación MATEMÁTICA del modelo sobre sus propios datos: significa que el plan, tal como está escrito, tiene un hueco interno. Se corrige con datos o se acepta conscientemente, y queda visible.' },
      { tipo: 'p', texto: 'Un incumplimiento normativo es otra cosa: que el plan viole o no una disposición legal o reglamentaria aplicable (tributaria, sanitaria, laboral, de inversión extranjera). PLANEX NO dictamina cumplimiento normativo: no conoce la normativa vigente de su sector, ni su jurisdicción exacta, ni las condiciones del permiso concreto. Sus advertencias sobre la tasa o el impuesto dicen «supuesto sin validar», no «esto es legal».' },
      { tipo: 'p', texto: 'Consecuencia práctica: un plan sin advertencias del motor puede aún así ser normativamente inviable, y un plan con advertencias puede ser perfectamente legal. La validación normativa corresponde a profesionales con las fuentes oficiales pertinentes; la aplicación la que hace es no dejarle confundir una cosa con la otra.' },
    ],
  },
  {
    id: 'con-plantilla-demo',
    capa: 'conceptos',
    titulo: 'Por qué una plantilla de demostración no sustituye la información real',
    resumen: 'El papel didáctico de las plantillas y sus límites: aprender el instrumento no es evaluar el proyecto.',
    etiquetas: ['plantilla', 'demostración', 'clínica', 'centro', 'datos ficticios', 'concepto'],
    relacionados: ['con-proyeccion-no-viabilidad', 'tutorial-primer-plan'],
    bloques: [
      { tipo: 'p', texto: 'Las plantillas (clínica estomatológica, centro de diagnóstico, plan en blanco) existen para aprender el instrumento con datos que ya cuadran: ver cómo se articulan inversión, financiación, servicios y validaciones sin partir de cero. Todas sus cifras están marcadas como ficticias en la propia aplicación, en el visor y en cada documento exportado.' },
      { tipo: 'p', texto: 'Sus límites son estructurales: los precios no provienen de un estudio de mercado, los salarios de convenios reales, la capacidad de ingeniería de planta, ni las tasas de fuentes oficiales validadas. Conservar cifras de la plantilla en un plan oficial —incluso «ajustando un poco»— es fabricar evidencia, y el aviso de datos ficticios seguirá apareciendo mientras el plan no declare datos propios.' },
      { tipo: 'p', texto: 'El uso legítimo de una plantilla es la base para reemplazar sistemáticamente cada supuesto por información real con fuente documentada, y validar después el conjunto con análisis profesional y verificación normativa aplicable. La plantilla acelera el aprendizaje de la herramienta; la calidad del plan la ponen los datos y el criterio.' },
      { tipo: 'aviso', texto: AVISO_DIDACTICO },
    ],
  },
];

// ============================================================================
// Agregación, validación de integridad y búsqueda
// ============================================================================

export const ARTICULOS_AYUDA: ArticuloAyuda[] = [...TUTORIAL, ...GUIAS, ...REFERENCIA, ...CONCEPTOS];

export function articuloPorId(id: string): ArticuloAyuda | undefined {
  return ARTICULOS_AYUDA.find((a) => a.id === id);
}

export function articulosPorCapa(capa: CapaDiataxis): ArticuloAyuda[] {
  return ARTICULOS_AYUDA.filter((a) => a.capa === capa);
}

export function capaDeArticulo(id: string): CapaDiataxis | undefined {
  return articuloPorId(id)?.capa;
}

/** Normaliza texto para búsqueda tolerante a acentos y caja. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[«»"'()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textoCompleto(a: ArticuloAyuda): string {
  const partes: string[] = [a.titulo, a.resumen, ...a.etiquetas];
  if (a.objetivo) partes.push(a.objetivo);
  if (a.requisitos) partes.push(...a.requisitos);
  if (a.resultado) partes.push(a.resultado);
  if (a.errores) partes.push(...a.errores);
  for (const b of a.bloques) {
    if (b.tipo === 'p' || b.tipo === 'nota' || b.tipo === 'aviso') partes.push(b.texto);
    if (b.tipo === 'lista' || b.tipo === 'pasos') {
      const items = b.tipo === 'lista' ? b.elementos : b.pasos.map((p) => `${p.titulo}. ${p.donde} ${p.accion} ${p.resultado} ${p.evitar ?? ''}`);
      partes.push(...items);
    }
    if (b.tipo === 'formula') partes.push(b.expresion, b.ejemplo, ...b.variables.map((v) => `${v.nombre} ${v.significado} ${v.unidad}`));
    if (b.tipo === 'tabla') partes.push(...b.encabezados, ...b.filas.flat());
  }
  return normalizar(partes.join(' . '));
}

const INDICE_BUSQUEDA = ARTICULOS_AYUDA.map((a) => ({ articulo: a, texto: textoCompleto(a) }));

export interface ResultadoBusqueda {
  articulo: ArticuloAyuda;
  /** Fragmento del artículo donde apareció la coincidencia (para el listado). */
  fragmento: string;
}

/** Búsqueda simple y útil: por términos, tolerante a acentos y caja. */
export function buscarAyuda(consulta: string): ResultadoBusqueda[] {
  const q = normalizar(consulta);
  if (q.length < 2) return [];
  const terminos = q.split(' ').filter(Boolean);
  const resultados: { r: ResultadoBusqueda; puntuacion: number }[] = [];
  for (const { articulo, texto } of INDICE_BUSQUEDA) {
    let puntuacion = 0;
    for (const t of terminos) {
      const enTitulo = normalizar(articulo.titulo).includes(t);
      const enResumen = normalizar(articulo.resumen).includes(t);
      const enTexto = texto.includes(t);
      if (!enTexto && !enTitulo && !enResumen) {
        puntuacion = -1;
        break;
      }
      puntuacion += enTitulo ? 4 : enResumen ? 2 : 1;
    }
    if (puntuacion > 0) {
      resultados.push({
        r: { articulo, fragmento: fragmentoDe(articulo, terminos[0]) },
        puntuacion,
      });
    }
  }
  return resultados.sort((x, y) => y.puntuacion - x.puntuacion).map((x) => x.r);
}

function fragmentoDe(a: ArticuloAyuda, termino: string): string {
  const fuente: string[] = [a.resumen];
  for (const b of a.bloques) {
    if (b.tipo === 'p' || b.tipo === 'nota' || b.tipo === 'aviso') fuente.push(b.texto);
  }
  for (const texto of fuente) {
    const i = normalizar(texto).indexOf(termino);
    if (i >= 0) {
      const inicio = Math.max(0, i - 60);
      const fin = Math.min(texto.length, i + 140);
      return `${inicio > 0 ? '…' : ''}${texto.slice(inicio, fin)}${fin < texto.length ? '…' : ''}`;
    }
  }
  return a.resumen;
}

/**
 * Validación de integridad del contenido (usada por las pruebas):
 * ids únicos, capas correctas, enlaces internos resueltos, sin artículos vacíos.
 */
export function auditarContenido(): { errores: string[] } {
  const errores: string[] = [];
  const ids = new Set<string>();
  for (const a of ARTICULOS_AYUDA) {
    if (ids.has(a.id)) errores.push(`id duplicado: ${a.id}`);
    ids.add(a.id);
    if (!CAPAS.some((c) => c.id === a.capa)) errores.push(`${a.id}: capa desconocida ${a.capa}`);
    if (a.bloques.length === 0) errores.push(`${a.id}: sin bloques`);
    if (a.capa === 'guias') {
      if (!a.objetivo) errores.push(`${a.id}: guía sin objetivo`);
      if (!a.requisitos?.length) errores.push(`${a.id}: guía sin requisitos`);
      if (!a.resultado) errores.push(`${a.id}: guía sin resultado esperado`);
      if (!a.errores?.length) errores.push(`${a.id}: guía sin errores frecuentes`);
      const tienePasos = a.bloques.some((b) => b.tipo === 'pasos' && b.pasos.length > 0);
      if (!tienePasos) errores.push(`${a.id}: guía sin pasos`);
    }
    for (const b of a.bloques) {
      if (b.tipo === 'pasos') {
        for (const p of b.pasos) {
          if (!p.donde || !p.accion || !p.resultado) errores.push(`${a.id}: paso incompleto «${p.titulo}»`);
        }
      }
      if (b.tipo === 'tabla') {
        for (const f of b.filas) {
          if (f.length !== b.encabezados.length) errores.push(`${a.id}: fila de tabla con ${f.length} celdas para ${b.encabezados.length} encabezados`);
        }
      }
    }
  }
  for (const a of ARTICULOS_AYUDA) {
    for (const r of a.relacionados ?? []) {
      if (!ids.has(r)) errores.push(`${a.id}: enlace roto → ${r}`);
    }
  }
  for (const capa of CAPAS) {
    if (!ARTICULOS_AYUDA.some((a) => a.capa === capa.id)) errores.push(`capa vacía: ${capa.id}`);
  }
  return { errores };
}
