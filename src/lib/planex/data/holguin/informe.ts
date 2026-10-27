// ============================================================================
// PLANEX-DATA-001 — Constructor del «Informe de análisis documental y
// brechas de información» del expediente Holguín.
//
// Genera un DocumentoPlanex (el modelo canónico de la app) que el
// compositor editorial (io/pdf.ts) compone con la misma calidad del plan:
// justificación real, paginación inteligente, tablas corporativas, índice
// y pies numerados. TODO el contenido procede de los módulos de datos
// (fuentes/registro/cobertura/brechas): el PDF y la vista «Expediente
// documental» salen de la MISMA fuente de información.
// ============================================================================

import type {
  DocumentoPlanex,
  SeccionDoc,
  ElementoDoc,
  TablaDoc,
} from '../../doc/modelo';
import { FUENTES, RESUMEN_FUENTES, SHA256_ZIP } from './fuentes';
import { REGISTRO, CategoriaDato } from './registro';
import { coberturaGlobal, coberturaPorEpigrafe, EPIGRAFES, censoRegistro } from './cobertura';
import {
  CONTRADICCIONES,
  BRECHAS,
  VALIDACIONES,
  PLAN_CIERRE,
  resumenExpediente,
  PrioridadBrecha,
} from './brechas';

export const NOMBRE_INFORME_PROYECTO = 'Centro Estomatológico Internacional Holguín';

const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;

const parrafo = (texto: string): ElementoDoc => ({ tipo: 'parrafo', texto });
const subtitulo = (texto: string): ElementoDoc => ({ tipo: 'subtitulo', texto });
const aviso = (texto: string): ElementoDoc => ({ tipo: 'aviso', texto });
const italica = (texto: string): ElementoDoc => ({ tipo: 'parrafo', texto, italica: true });

function tabla(t: TablaDoc): ElementoDoc {
  return { tipo: 'tabla', tabla: t };
}

function sec(id: string, titulo: string, elementos: ElementoDoc[], opts?: { enIndice?: boolean; paginaNueva?: boolean }): SeccionDoc {
  return {
    id,
    titulo,
    enIndice: opts?.enIndice ?? true,
    paginaNueva: opts?.paginaNueva ?? false,
    elementos,
  };
}

// ---------------------------------------------------------------------------
// Documento completo
// ---------------------------------------------------------------------------

export function construirDocumentoBrechas(): DocumentoPlanex {
  const glob = coberturaGlobal();
  const censo = censoRegistro();
  const res = resumenExpediente();
  const porEpi = coberturaPorEpigrafe();
  const hoy = new Date();
  const fechaCorte = hoy.toISOString().slice(0, 10);

  const etiquetaCategoria: Record<CategoriaDato, string> = {
    A: 'A — Confirmado documentalmente',
    B: 'B — Derivado (fórmula conservada)',
    C: 'C — Provisional',
    D: 'D — Contradictorio',
    E: 'E — Pendiente',
    F: 'F — No aplicable',
  };

  const secciones: SeccionDoc[] = [
    sec(
      'resumen',
      '1. Resumen ejecutivo',
      [
        parrafo(
          `Se recibió y analizó un expediente documental de ${RESUMEN_FUENTES.total} fuentes (ZIP «Planex.zip», ${(RESUMEN_FUENTES.bytesZip / 1024).toFixed(0)} KiB, sha256 ${SHA256_ZIP.slice(0, 16)}…): el borrador del Contrato de Asociación Económica Internacional, la valoración económica del proyecto, el anexo de cálculo de pre-factibilidad, dos cotizaciones de Leisure Exporting LLC (equipos e insumos), el inventario de medios existentes de la Sucursal Holguín, la relación de capital humano y un diagnóstico de servicios. ${RESUMEN_FUENTES.leidasCompletas} fuentes se leyeron completas; ${RESUMEN_FUENTES.visualParcial} presenta contenido gráfico parcialmente ilegible (marcas del cronograma).`
        ),
        parrafo(
          `El expediente corresponde al «Centro Estomatológico Internacional Holguín»: una Asociación Económica Internacional entre Comercializadora de Servicios Médicos Cubanos, S.A. (CSMC, S.A.) y Leisure Exporting LLC (Estados Unidos) para prestar servicios de estomatología en la provincia de Holguín con 15 líneas de servicio, cinco equipos de inversión (5 274,00 USD), insumos por 63 581,30 USD (6 meses) y una plantilla de 10 trabajadores. La cobertura verificada es de ${pct(glob.pctCamposCompletados)} de los campos metodológicos obligatorios (${glob.camposCompletos} de ${glob.camposTotales - glob.camposDerivados}); otras ${glob.camposParciales} se sustentan en evidencia parcial o contradictoria y ${glob.camposPendientes} carecen de evidencia suficiente.`
        ),
        parrafo(
          `Con respaldo documental puede construirse: la identidad de las partes y su caracterización registral, el objeto y la modalidad, la cartera de servicios con precios y demanda, el desglose de inversión y aportes, la plantilla de fuerza de trabajo, el contexto técnico-operativo del deterioro actual y el marco normativo invocado. Las principales limitaciones son: la ausencia de estudio de mercado y de estudio de capacidad, la dirección exacta y el avalúo del inmueble en blanco, y una CRÍTICA contradicción de tipo de cambio (24 frente a 120 CUP/USD dentro del propio modelo) que bloquea la interpretación de todos los indicadores financieros del expediente.`
        ),
        parrafo(
          `Se registraron ${res.contradicciones} contradicciones (de ellas ${res.contradiccionesCriticas} crítica y ${res.contradiccionesAltas} de severidad alta) y ${res.brechas} brechas de información (${res.brechasBloqueantes} bloqueantes). Los documentos y decisiones que impiden cerrar el plan se detallan en las secciones 6 a 9; los más urgentes: la decisión de tasa de cambio con sustento normativo, el avalúo del usufructo, la base legal del impuesto sobre utilidades y el estudio de mercado.`
        ),
        aviso(
          'Este informe es un entregable de evaluación documental preliminar: identifica qué se recibió, qué falta y qué se contradice. No certifica la viabilidad del negocio ni el cumplimiento legal, y no sustituye la revisión de especialistas ni las validaciones de las autoridades competentes.'
        ),
      ]
      // Sin paginaNueva: el compositor ya abre el cuerpo en página propia
      // tras el índice (paginaNueva aquí dejaría una página vacía).
    ),

    sec(
      'metodologia',
      '2. Alcance y metodología',
      [
        parrafo(
          'Inventario: las 9 fuentes se extrajeron a un directorio de trabajo aislado y se registraron con nombre, tipo, tamaño, fecha y huella SHA-256 (sección 3). Los dos documentos en formato binario (.doc) se convirtieron con LibreOffice y se verificó la conversión contra el original; los PDF se procesaron con extracción de texto por página; los .docx se leyeron con su estructura de tablas. Todo el contenido visual con marcas (cronograma trimestral) se declaró como parcialmente ilegible en lugar de presumir su lectura.'
        ),
        parrafo(
          'Extracción y clasificación: cada dato relevante pasó al registro central con valor literal, valor normalizado, unidad y moneda, período, fuente, localizador exacto y una categoría de confianza: A confirmado documentalmente, B derivado con fórmula conservada, C provisional, D contradictorio, E pendiente y F no aplicable. El registro queda con ' +
            `${censo.total} datos: ${censo.confirmados} confirmados, ${censo.derivados} derivados, ${censo.provisionales} provisionales, ${censo.contradictorios} contradictorios y ${censo.pendientes} pendientes.`
        ),
        parrafo(
          `Definición de los porcentajes de cobertura (denominadores explícitos): ${glob.denominadorNota}`
        ),
        parrafo(
          'Regla de fidelidad aplicada: no se alteraron nombres, denominaciones, importes, fechas ni terminología de las fuentes; las contradicciones se conservan con ambos valores y sus localizadores; los campos sin evidencia se marcan como pendientes y ningún hueco se rellenó con supuestos. Los datos de contacto personal (teléfonos y correos de personas naturales) no se incorporaron. Los originales del ZIP no se copian al repositorio.'
        ),
        parrafo(
          'Limitaciones del análisis: el cronograma directivo del anexo usa marcas gráficas ilegibles; el análisis de sensibilidad del anexo presenta celdas rotas (0,0) y valores no conciliables; la escala salarial tiene tres versiones irreconciliables sin aclaración. Estos límites se declaran en lugar de resolverse por criterio del analista.'
        ),
      ]
    ),

    sec(
      'inventario',
      '3. Inventario de documentación',
      [
        tabla({
          titulo: 'Fuentes analizadas (originales no publicados en el repositorio)',
          encabezados: ['ID', 'Documento', 'Tipo', 'Tamaño', 'Lectura', 'Qué aporta (resumen)'],
          filas: FUENTES.map((f) => [
            f.id,
            f.nombre,
            f.tipo,
            `${(f.bytes / 1024).toFixed(0)} KiB`,
            f.estadoLectura === 'completa' ? 'completa' : 'visual parcial',
            f.aporte,
          ]),
          alineaciones: ['izq', 'izq', 'izq', 'der', 'izq', 'izq'],
          nota: `ZIP «Planex.zip», ${(RESUMEN_FUENTES.bytesZip / 1024).toFixed(0)} KiB, sha256 ${SHA256_ZIP}. Huellas SHA-256 de cada fuente en el anexo de inventario.`,
        }),
        ...FUENTES.flatMap((f): ElementoDoc[] => [
          subtitulo(`${f.id} — ${f.nombre}`),
          parrafo(
            `Limitaciones de la evidencia: ${f.limitaciones.join(' ')}`
          ),
        ]),
      ]
    ),

    sec(
      'incorporable',
      '4. Información incorporable',
      [
        parrafo(
          'Incorporación directa a la aplicación (categoría A): identidad y caracterización registral de ambas partes (escrituras, registros, NIT, licencias), objeto y modalidad, plazo, regla de reparto pactada (50/50), localización provincial, cartera de 15 servicios con precios de lista y demanda mensual, desglose de inversión (5 equipos con sus importes de cotización y gastos previos), aportes por socio con su composición, plantilla de 10 plazas con categorías, contexto técnico del deterioro (inventario de 42 medios, servicios suspendidos, prótesis al 75 %), y marco normativo invocado por el contrato.'
        ),
        parrafo(
          'Requiere normalización: la denominación del proyecto (tres variantes en el expediente) se unificó como «Centro Estomatológico Internacional Holguín» marcándola como denominación de trabajo; los precios de la tabla de servicios se normalizaron a USD dividiendo entre 120 (la propia tabla declara esa tasa y el diagnóstico de servicios confirma dos precios USD por caso); los rótulos «MCUP/MUSD» del anexo se interpretaron como MILES de CUP/USD por coherencia con todas las tablas (documentado en el registro).'
        ),
        parrafo(
          'Calculable a partir de fuentes documentadas (categoría B, fórmulas conservadas en el registro): el costo variable unitario por servicio (reparto provisional proporcional al precio que preserva el total de la cotización: 127 162,60 USD anuales ÷ 115 814,00 USD de ingresos = factor 1,09805), el salario promedio por plaza (estructura relativa de la plantilla escalada para alcanzar el costo salarial total del EERR: factor ×2,6984 en las plazas cubanas, con fórmula y verificación de cierre 4 320,0 kCUP/año), y la vida útil del equipamiento (tasa 6 % anual del expediente ≈ 17 años lineales).'
        ),
        parrafo(
          'Modelable mediante reglas existentes: el impuesto sobre utilidades del anexo (15 % solo en los años 8–10) se reproduce con la regla editable del motor y una condición de período; el resto del modelo usa las reglas de fábrica sin fórmulas nuevas. Ningún resultado derivado se “hardcodea”: los indicadores se recalculan desde los datos.'
        ),
        tabla({
          titulo: 'Referencia de datos clave incorporados al modelo de la aplicación',
          encabezados: ['Dato', 'Valor adoptado', 'Categoría', 'Fuente y localizador'],
          filas: REGISTRO.filter((r) =>
            ['H-001', 'H-009', 'H-010', 'H-012', 'H-013', 'H-020', 'H-021', 'H-022', 'H-026', 'H-027', 'H-028', 'H-029', 'H-033', 'H-035', 'H-037', 'H-040', 'H-090', 'H-091', 'H-025'].includes(r.id)
          ).map((r) => [r.id, r.campo, etiquetaCategoria[r.categoria], `${r.fuenteId} — ${r.localizador.split(';')[0].trim()}`]),
          alineaciones: ['izq', 'izq', 'izq', 'izq'],
          nota: 'Registro completo con valores literales y fórmulas en el anexo y en la sección «Expediente documental» de la aplicación.',
        }),
      ]
    ),

    sec(
      'cobertura',
      '5. Matriz de cobertura de la metodología',
      [
        parrafo(
          `Cobertura medida por campo y por epígrafe (censo de ${glob.camposTotales} campos; ${glob.camposDerivados} de ellos son generados dinámicamente por la aplicación y no computan como información del expediente): ${glob.camposCompletos} completos, ${glob.camposParciales} parciales o con contradicción activa, ${glob.camposPendientes} pendientes. El ${pct(glob.pctSeccionesSustanciales)} de los epígrafes dispone de información sustancial (al menos un campo con evidencia). ${glob.requisitosValidacionExterna} requisitos dependen de validaciones externas y ${glob.camposDecisionPromotor} campos solo pueden completarse mediante estimaciones o decisiones del promotor.`
        ),
        tabla({
          titulo: 'Cobertura por epígrafe (4.1–4.12)',
          encabezados: ['Epígrafe', 'Título', 'Campos', 'Completos', 'Parciales', 'Pendientes', 'Dinámicos'],
          filas: porEpi.map((e) => [e.epigrafe, e.titulo, String(e.total), String(e.completos), String(e.parciales), String(e.pendientes), String(e.derivados)]),
          alineaciones: ['izq', 'izq', 'der', 'der', 'der', 'der', 'der'],
          nota: 'Denominador por epígrafe: censo de campos metodológicamente exigibles implementados en la aplicación y verificados contra el expediente. La cobertura de información no equivale a viabilidad del negocio ni a cumplimiento legal.',
        }),
        tabla({
          titulo: 'Detalle de estado por campo',
          encabezados: ['Epígrafe', 'Campo', 'Estado', 'Evidencia'],
          filas: EPIGRAFES.flatMap((e) =>
            e.campos.map((c) => [e.id, c.campo, c.estado === 'completo' ? 'Completo' : c.estado === 'parcial' ? 'Parcial' : c.estado === 'derivado' ? 'Dinámico' : 'Pendiente', c.evidencia])
          ),
          alineaciones: ['izq', 'izq', 'izq', 'izq'],
          ancha: true,
          nota: 'La misma matriz, con observaciones campo a campo, está disponible en la sección «Expediente documental» de la aplicación.',
        }),
      ]
    ),

    sec(
      'brechas',
      '6. Información faltante para completar el plan',
      [
        parrafo(
          `Cada brecha indica qué falta exactamente, por qué es necesaria, qué debe aportar el promotor, su prioridad y el criterio objetivo para considerarla resuelta. Bloqueantes para estructurar el plan: ${BRECHAS.filter((b) => b.prioridad === 'bloqueante').map((b) => b.id).join(', ')}. Las demás se priorizan en la sección 9.`
        ),
        ...BRECHAS.map(
          (b): ElementoDoc =>
            tabla({
              titulo: `${b.id} · ${b.titulo} (${b.epigrafe}) — prioridad ${b.prioridad}`,
              encabezados: ['Aspecto', 'Contenido'],
              filas: [
                ['Qué falta', b.falta],
                ['Por qué es necesaria', b.motivo],
                ['Se pide al promotor', `${b.requiere} (responsable: ${b.responsable})`],
                ['Criterio de cierre', b.criterioCierre],
                ['Datos del registro', b.registroIds.join(', ') || '—'],
              ],
              alineaciones: ['izq', 'izq'],
            })
        ),
      ]
    ),

    sec(
      'contradicciones',
      '7. Contradicciones y riesgos',
      [
        parrafo(
          'Contradicciones registradas: dos o más fuentes presentan valores incompatibles para el mismo concepto. Por regla de la misión NO se resolvió ninguna en silencio: ambos valores se conservan con su localizador y la decisión o evidencia que los resuelve queda indicada. La C-01 (tasa de cambio) es BLOQUEANTE del modelo financiero.'
        ),
        ...CONTRADICCIONES.map(
          (c): ElementoDoc[] => [
            subtitulo(`${c.id} — ${c.titulo} (severidad: ${c.severidad})`),
            ...c.valores.map((v) => parrafo(`Valor: ${v.valor}. Localización: ${v.fuenteLocalizador}`)),
            parrafo(`Impacto: ${c.impacto}`),
            parrafo(`Acción requerida: ${c.accionRequerida}`),
            tabla({
              titulo: `Resumen de ${c.id}`,
              encabezados: ['ID', 'Severidad', 'Registros afectados'],
              filas: [[c.id, c.severidad, c.registroIds.join(', ')]],
              alineaciones: ['izq', 'izq', 'izq'],
            }),
          ]
        ).flat(),
      ]
    ),

    sec(
      'validaciones',
      '8. Validaciones normativas y administrativas pendientes',
      [
        parrafo(
          'Requisitos identificados para este tipo de propuesta, separando la norma que el expediente invoca, la evidencia realmente aportada y la validación pendiente. La lista procede del expediente y de la metodología; NO se presenta como exhaustiva: la verificación integral de vigencias y requisitos corresponde a los especialistas jurídicos.'
        ),
        tabla({
          titulo: 'Estado de las validaciones',
          encabezados: ['ID', 'Requisito', 'Norma invocada', 'Evidencia del expediente', 'Pendiente'],
          filas: VALIDACIONES.map((v) => [v.id, v.requisito, v.normaInvocada, v.evidenciaExpediente, v.pendiente]),
          alineaciones: ['izq', 'izq', 'izq', 'izq', 'izq'],
          ancha: true,
          nota: 'Ninguna de estas validaciones se acredita por el solo hecho de existir el expediente: cada una requiere el documento o la consulta indicada.',
        }),
      ]
    ),

    sec(
      'plancierre',
      '9. Plan priorizado de cierre',
      [
        parrafo(
          'Los pendientes se agrupan en cinco bloques con una secuencia de recolección que evita pedir documentos innecesarios o duplicados: primero la identidad del negocio, después las decisiones que estabilizan las cifras, luego el mercado y la operación, y en paralelo las verificaciones jurídicas.'
        ),
        ...PLAN_CIERRE.flatMap(
          (b): ElementoDoc[] => [
            subtitulo(b.titulo),
            parrafo(b.secuenci),
            tabla({
              titulo: `Brechas del bloque (${b.brechas.length})`,
              encabezados: ['ID', 'Brecha', 'Prioridad'],
              filas: BRECHAS.filter((x) => b.brechas.includes(x.id)).map((x) => [x.id, x.titulo, x.prioridad]),
              alineaciones: ['izq', 'izq', 'izq'],
            }),
          ]
        ),
        parrafo(
          'Se recomienda pedir primero: (1) la decisión de tasa de cambio con su sustento normativo, porque un solo parámetro recalcula todo el modelo; (2) el paquete de identidad del negocio (denominación, elaborador, inmueble y avalúo); (3) la verificación tributaria del impuesto sobre utilidades y la exención aplicable; (4) el estudio de mercado. Con esos cuatro pasos las brechas restantes se cierran sobre cifras estables y sin recolectar documentos dos veces.'
        ),
      ]
    ),

    sec(
      'criterios',
      '10. Criterios de terminación',
      [
        parrafo(
          'Completitud de información: el expediente documental puede considerarse completo para pasar a revisión final del plan cuando (a) las brechas bloqueantes B-06 (usufructo), B-16 (régimen tributario) y B-24 (estudio de mercado) estén resueltas con documentos; (b) las contradicciones C-01 (tasa), C-05 (reparto), C-06 (depreciación) y C-07 (salarios) tengan decisión escrita del promotor; y (c) las brechas de prioridad alta tengan respuesta o documento alternativo explícito. Los campos «dinámicos» (índice, síntesis, conclusiones cuantitativas) no computan: se generan desde el modelo.'
        ),
        parrafo(
          'Consistencia financiera: el modelo se considerará consistente cuando (a) la regla de impuesto y la tasa citen su base legal verificada; (b) el EERR recalcuclado por la aplicación concilie con los estados del expediente o las diferencias estén explicadas una a una; (c) aportes e inversión concilien en la misma moneda y con la tasa decidida; y (d) los indicadores (recuperación, dividendos, beneficios al país) se deriven del modelo activo y no de los cuadros del anexo (cuyos valores no se adoptan: C-02).'
        ),
        parrafo(
          'Validación jurídica externa: la aprobación de la constitución de la AEI, la inscripción registral, la licencia comercial, las licencias sanitarias y el régimen aduanero y tributario aplicable requieren constancias de las autoridades competentes (V-01 a V-08). Ninguna parte de este informe sustituye esas constancias: el plan solo puede presentarse oficialmente cuando las validaciones estén documentadas.'
        ),
        italica(
          'Criterio de honestidad de la entrega: la plantilla de la aplicación quedará marcada como «evaluación preliminar» mientras existan contradicciones sin resolver; ningún campo pendiente se mostrará como completo.'
        ),
      ]
    ),

    // ------------------------------------------------------------------ anexos
    sec(
      'anexo-brechas',
      'Anexo A — Matriz detallada de brechas',
      [
        tabla({
          titulo: 'Brechas con dependencias y responsables',
          encabezados: ['ID', 'Epígrafe', 'Brecha', 'Prioridad', 'Responsable', 'Dependencias'],
          filas: BRECHAS.map((b) => [b.id, b.epigrafe, b.titulo, b.prioridad, b.responsable, b.dependencias.join(', ') || '—']),
          alineaciones: ['izq', 'izq', 'izq', 'izq', 'izq', 'izq'],
          ancha: true,
        }),
      ],
      { paginaNueva: true }
    ),
    sec(
      'anexo-contradicciones',
      'Anexo B — Registro de contradicciones',
      [
        tabla({
          titulo: 'Contradicciones con severidad y registros',
          encabezados: ['ID', 'Contradicción', 'Severidad', 'Registros', 'Acción'],
          filas: CONTRADICCIONES.map((c) => [c.id, c.titulo, c.severidad, c.registroIds.join(', '), c.accionRequerida]),
          alineaciones: ['izq', 'izq', 'izq', 'izq', 'izq'],
          ancha: true,
        }),
      ]
    ),
    sec(
      'anexo-fuentes',
      'Anexo C — Inventario de fuentes con huellas',
      [
        tabla({
          titulo: 'Huellas SHA-256 del expediente analizado',
          encabezados: ['ID', 'Documento', 'SHA-256'],
          filas: FUENTES.map((f) => [f.id, f.nombre, f.sha256]),
          alineaciones: ['izq', 'izq', 'izq'],
          nota: `ZIP: ${SHA256_ZIP}`,
        }),
      ]
    ),
    sec(
      'anexo-registro',
      'Anexo D — Registro de información fidedigna',
      [
        parrafo(
          `Registro central con ${REGISTRO.length} datos: valor literal, categoría (A confirmado, B derivado, C provisional, D contradictorio, E pendiente), fuente y localizador. La versión interactiva completa está en la sección «Expediente documental» de la aplicación.`
        ),
        ...REGISTRO.map(
          (r): ElementoDoc =>
            tabla({
              titulo: `${r.id} · ${r.campo} (${r.epigrafe})`,
              encabezados: ['Aspecto', 'Contenido'],
              filas: [
                ['Categoría', etiquetaCategoria[r.categoria]],
                ['Valor literal', r.valorLiteral],
                ...(r.valorNormalizado ? [['Valor normalizado', r.valorNormalizado] as string[]] : []),
                ...(r.unidad ? [['Unidad', r.unidad] as string[]] : []),
                ...(r.periodo ? [['Período', r.periodo] as string[]] : []),
                ['Fuente y localizador', `${r.fuenteId} — ${r.localizador}`],
                ...(r.derivacion ? [['Fórmula conservada', r.derivacion] as string[]] : []),
                ['Tratamiento en PLANEX', r.tratamiento],
                ...(r.observaciones ? [['Observaciones', r.observaciones] as string[]] : []),
              ],
              alineaciones: ['izq', 'izq'],
            })
        ),
      ]
    ),
    sec(
      'anexo-glosario',
      'Anexo E — Glosario y unidades',
      [
        tabla({
          titulo: 'Términos y unidades empleados',
          encabezados: ['Término', 'Significado en este informe'],
          filas: [
            ['AEI / CAEI', 'Asociación Económica Internacional / Contrato de Asociación Económica Internacional: unión temporal de partes sin personalidad jurídica (modalidad de inversión extranjera).'],
            ['kCUP / kUSD', 'Miles de CUP / miles de USD (los rótulos «MCUP/MUSD» del anexo del expediente designan MILES, no millones: interpretación documentada).'],
            ['Tasa 1×24 / 1×120', 'Tipos de cambio CUP/USD que coexisten en el expediente: 24 en los encabezados del modelo; 120 en la lista de precios de los servicios (contradicción C-01).'],
            ['EERR', 'Estado de rendimiento (económico) proyectado del anexo de pre-factibilidad.'],
            ['Categorías A–F', 'Clasificación de confianza del registro: A confirmado, B derivado, C provisional, D contradictorio, E pendiente, F no aplicable.'],
            ['Tasa 6 %', 'Tasa de depreciación anual del equipamiento declarada por el expediente (≈16,7 años de vida útil).'],
            ['TPR', 'Tratamientos pulporadiculares (endodoncia): servicio suspendido del expediente.'],
            ['Cuadro básico', 'Lista de renglones de insumos que garantizan el servicio estomatológico (71 declarados por la sucursal).'],
          ],
          alineaciones: ['izq', 'izq'],
        }),
      ]
    ),
  ];

  return {
    meta: {
      nombreProyecto: NOMBRE_INFORME_PROYECTO,
      fechaDocumento: fechaCorte,
      esquema: 'PLANEX-DATA-001',
      horizonte: 10,
      esDemo: false,
      moneda: 'CUP',
      unidadTabla: 'unidades indicadas en cada tabla',
      notaMoneda:
        'El expediente mezcla dos tasas de cambio (24 y 120 CUP/USD): los importes de este informe se citan en su moneda de origen con la tasa de su fuente, y ninguna cifra convertible entre ambas se presenta sin esa marca.',
      tituloCorriente: 'INFORME DE ANÁLISIS DOCUMENTAL',
      marcaPie: 'PLANEX Cuba — Informe de análisis documental y brechas (misión DATA-001)',
    },
    portada: {
      titulo: 'INFORME DE ANÁLISIS DOCUMENTAL',
      subtitulo: 'Brechas de información, contradicciones y plan de cierre del expediente del proyecto',
      marca: 'PLANEX Cuba — expediente real en evaluación preliminar',
      nombreProyecto: NOMBRE_INFORME_PROYECTO,
      denominacion:
        'Asociación Económica Internacional (CSMC, S.A. + Leisure Exporting LLC) — provincia de Holguín',
      cifras: [
        { etiqueta: 'Fuentes analizadas', valor: `${RESUMEN_FUENTES.total} documentos (${RESUMEN_FUENTES.leidasCompletas} lecturas completas)` },
        { etiqueta: 'Cobertura de campos obligatorios', valor: pct(glob.pctCamposCompletados) },
        { etiqueta: 'Contradicciones registradas', valor: `${res.contradicciones} (${res.contradiccionesCriticas} crítica)` },
        { etiqueta: 'Brechas de información', valor: `${res.brechas} (${res.brechasBloqueantes} bloqueantes)` },
        { etiqueta: 'Validaciones normativas pendientes', valor: String(res.validaciones) },
        { etiqueta: 'Fecha de corte', valor: fechaCorte },
        { etiqueta: 'Versión del informe', valor: '1.0 (evaluación documental preliminar)' },
      ],
      avisoDemo:
        'PROYECTO DOCUMENTAL EN EVALUACIÓN PRELIMINAR: los datos son trazables al expediente del promotor; las contradicciones permanecen visibles y los campos sin evidencia se marcan como pendientes. Este informe no sustituye la evaluación oficial ni acredita el cumplimiento de requisitos legales, tributarios, sanitarios o de inversión.',
    },
    secciones,
  };
}

// ---------------------------------------------------------------------------
// Resumen de secciones para consumo por la vista o las pruebas
// ---------------------------------------------------------------------------

export function resumenInforme() {
  const doc = construirDocumentoBrechas();
  return {
    secciones: doc.secciones.length,
    ids: doc.secciones.map((s) => s.id),
    fechaDocumento: doc.meta.fechaDocumento,
  };
}

export type { PrioridadBrecha };
