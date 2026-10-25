// ============================================================================
// Exportador PDF — documento profesional con portada, índice con numeración
// real (doble pasada), secciones metodológicas 4.1–4.12, tablas legibles con
// encabezados repetidos, ANÁLISIS DINÁMICOS generados por el motor (misión
// §12), diagnóstico con cuatro niveles (§15) y advertencia de datos ficticios.
//
// Correcciones de composición (misión §14.2): sin páginas en blanco (el índice
// no fuerza un salto adicional), índice completo con todas las secciones,
// unidades en todas las tablas, encabezados repetidos por autoTable y textos
// desbordados controlados por splitTextToSize.
//
// Las cifras y textos provienen SIEMPRE de la misma versión del modelo
// (proyecto + ComputedModel): el análisis de cada tabla se genera con el
// estado activo y se marca si el usuario lo editó y quedó desactualizado.
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PlanexProject,
  ComputedModel,
  ADVERTENCIA_DATOS_FICTICIOS,
  DECLARACION_RESPONSABILIDAD,
  ESTADO_RESULTADOS,
  BENEFICIOS_PAIS,
  ETIQUETAS_APORTACION,
  ETIQUETAS_GRUPO,
  ETIQUETAS_CATEGORIA_INV,
  ETIQUETAS_METODO_AMORT,
  ETIQUETAS_TIPO_GRACIA,
  ETIQUETAS_RECURSO,
} from '../types';
import { valorLinea } from '../engine/engine';
import { generarAnalisis, estadoAnalisis, ClaveAnalisis } from '../engine/analisis';
import { diagnosticar } from '../model/controles';
import { fmtK, fmtCUP, fmtPct, fmtAnios, fechaLarga, mesAnio } from '../format';

const M = 14; // margen mm
const ANCHO = 210;
const ALTO = 297;

function encabezadoPagina(doc: jsPDF, titulo: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(titulo, M, 20);
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.4);
  doc.line(M, 23, ANCHO - M, 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
}

function parrafo(doc: jsPDF, texto: string, opts?: { startY?: number; size?: number }): number {
  let y = opts?.startY ?? 30;
  if (!texto) return y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(opts?.size ?? 9);
  doc.setTextColor(51, 65, 85);
  const lineas = doc.splitTextToSize(texto, ANCHO - 2 * M);
  for (const linea of lineas) {
    if (y > ALTO - 22) {
      doc.addPage();
      y = 20;
    }
    doc.text(linea, M, y);
    y += 4.4;
  }
  return y + 2;
}

function tituloBloque(doc: jsPDF, texto: string, y: number): number {
  let yy = y;
  if (yy > ALTO - 40) {
    doc.addPage();
    yy = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(doc.splitTextToSize(texto, ANCHO - 2 * M), M, yy);
  return yy + 5;
}

function tabla(doc: jsPDF, titulo: string, startY: number, head: string[][], body: (string | number)[][], opts?: { size?: number }) {
  let y = startY;
  if (titulo) {
    if (y > ALTO - 40) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const lineas = doc.splitTextToSize(titulo, ANCHO - 2 * M);
    doc.text(lineas, M, y);
    y += 4.5 * lineas.length;
  }
  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: M, right: M, top: 18, bottom: 20 },
    styles: { font: 'helvetica', fontSize: opts?.size ?? 7, cellPadding: 1.4, overflow: 'linebreak', textColor: [51, 65, 85] },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: opts?.size ?? 7, halign: 'center' },
    alternateRowStyles: { fillColor: [244, 246, 249] },
    showHead: 'everyPage',
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
}

/** Bloque de análisis dinámico: título + texto + etiqueta de trazabilidad. */
function bloqueAnalisis(
  doc: jsPDF,
  titulo: string,
  clave: ClaveAnalisis,
  proyecto: PlanexProject,
  modelo: ComputedModel,
  y: number
): number {
  const generados = generarAnalisis(proyecto, modelo);
  const actual = generados[clave];
  const { estado, texto } = estadoAnalisis(proyecto, clave, actual);
  const etiqueta =
    estado === 'generado'
      ? 'ANÁLISIS GENERADO POR EL MODELO'
      : estado === 'manual'
        ? 'ANÁLISIS EDITADO POR EL USUARIO (al día con los datos actuales)'
        : 'ANÁLISIS EDITADO POR EL USUARIO — DESACTUALIZADO: los datos de origen cambiaron';
  let yy = y;
  if (yy > ALTO - 40) {
    doc.addPage();
    yy = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 81, 40);
  doc.text(titulo, M, yy);
  yy += 4;
  doc.setFontSize(7);
  if (estado === 'desactualizado') doc.setTextColor(185, 28, 28);
  else doc.setTextColor(140, 100, 40);
  doc.text(etiqueta, M, yy);
  yy += 2;
  yy = parrafo(doc, texto, { startY: yy + 3, size: 8 });
  return yy;
}

function construirDocumento(
  proyecto: PlanexProject,
  modelo: ComputedModel,
  opciones?: { registrar?: Record<string, number>; paginasSecciones?: Record<string, number> }
): { doc: jsPDF } {
  const registrar = opciones?.registrar;
  const paginasSecciones = opciones?.paginasSecciones;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
  const N = proyecto.ajustes.horizonteAnios;
  const years = modelo.years;
  const esDemo = proyecto.planex.plantillaOrigen === 'clinica' || proyecto.planex.plantillaOrigen === 'centro';
  const marcar = (titulo: string) => {
    if (registrar) registrar[titulo] = doc.getCurrentPageInfo().pageNumber;
    encabezadoPagina(doc, titulo);
  };
  const val = (id: string, t: number) => modelo.valores[id]?.[t] ?? 0;
  const param = (id: string) => proyecto.parametros.find((p) => p.id === id)?.valor ?? 0;
  const recP = modelo.indicadores.recuperacionProyecto;
  const recS = modelo.indicadores.recuperacionSocios;

  // ============================================================ Portada
  doc.setFillColor(51, 65, 85);
  doc.rect(0, 0, ANCHO, 52, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('PLAN DE NEGOCIOS', ANCHO / 2, 24, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Propuesta de negocio con inversión extranjera — Bases metodológicas GOC-2026-O57', ANCHO / 2, 34, { align: 'center' });
  doc.setFontSize(9);
  doc.text('Elaborado con PLANEX Cuba', ANCHO / 2, 43, { align: 'center' });
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  const tituloProyecto = proyecto.titulo.nombreProyecto || proyecto.nombre;
  const subtitulo = proyecto.titulo.denominacionPropuesta || '';
  doc.text(doc.splitTextToSize(tituloProyecto, ANCHO - 2 * M - 20), M, 76);
  let y = 76 + doc.getTextDimensions(doc.splitTextToSize(tituloProyecto, ANCHO - 2 * M - 20)).h + 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (subtitulo) {
    doc.text(doc.splitTextToSize(subtitulo, ANCHO - 2 * M - 20), M, y);
    y += doc.getTextDimensions(doc.splitTextToSize(subtitulo, ANCHO - 2 * M - 20)).h + 4;
  }
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  y = parrafo(
    doc,
    `Inversión total: ${fmtK(modelo.indicadores.inversionTotalKUSD)} miles de USD · Horizonte de análisis: ${N} años · Recuperación de la inversión total (flujo del proyecto): ${recP.anios === null ? 'no recuperada en el horizonte' : fmtAnios(recP.anios)} · Recuperación del capital aportado (flujo de los socios): ${recS.anios === null ? 'no recuperada en el horizonte' : fmtAnios(recS.anios)}`,
    { startY: y + 4, size: 10 }
  );
  y = parrafo(doc, `Fecha del documento: ${fechaLarga(proyecto.general.fecha || proyecto.actualizado)} · Versión de esquema: ${proyecto.planex.schemaVersion}`, { startY: y });
  if (esDemo) {
    doc.setFillColor(255, 243, 205);
    doc.setDrawColor(217, 119, 6);
    const aviso = ADVERTENCIA_DATOS_FICTICIOS;
    doc.rect(M, y + 2, ANCHO - 2 * M, 24, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14);
    doc.text(doc.splitTextToSize(aviso, ANCHO - 2 * M - 8), M + 4, y + 8);
    y += 30;
  }
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  doc.text(`Generado localmente por PLANEX Cuba el ${new Date().toLocaleString('es-ES')}. Cifras y análisis provienen del modelo de cálculo activo (misma versión para tablas, resumen, conclusiones y exportaciones).`, M, ALTO - 16);
  doc.addPage();

  // ============================================================ Índice (doble pasada)
  const INDICE_TITULO = 'Índice';
  if (paginasSecciones) {
    encabezadoPagina(doc, INDICE_TITULO);
    let ty = 32;
    doc.setFontSize(9);
    for (const [titulo, pag] of Object.entries(paginasSecciones)) {
      if (ty > ALTO - 26) {
        doc.addPage();
        ty = 20;
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(titulo, M, ty);
      doc.setFont('helvetica', 'bold');
      doc.text(String(pag), ANCHO - M, ty, { align: 'right' });
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.1);
      doc.line(M + doc.getTextDimensions(titulo).w + 2, ty - 1, ANCHO - M - 6, ty - 1);
      ty += 6.5;
    }
  }

  // ============================================================ 4.1 + 4.2
  // Pasada 2: tras el índice se abre página nueva para 4.1 (la numeración del
  // índice se calculó como registro + páginas del índice). Pasada 1 (sin
  // índice): 4.1 continúa en la página siguiente a la portada, SIN páginas
  // en blanco intermedias.
  if (paginasSecciones) {
    doc.addPage();
  }
  marcar('4.1  Información general');
  let y2 = 30;
  y2 = parrafo(doc, `Elaborado por: ${proyecto.general.elaboradoPor || '—'}${proyecto.general.cargo ? ` (${proyecto.general.cargo})` : ''}`, { startY: y2 });
  y2 = parrafo(doc, `Firma o identificación: ${proyecto.general.firmaIdentificacion || '—'}`, { startY: y2 });
  y2 = parrafo(doc, `Fecha: ${fechaLarga(proyecto.general.fecha)}`, { startY: y2 });
  y2 = parrafo(doc, 'Declaración de responsabilidad sobre la veracidad y confiabilidad de los datos:', { startY: y2 });
  doc.setFont('helvetica', 'italic');
  y2 = parrafo(doc, proyecto.general.declaracionResponsabilidad ? DECLARACION_RESPONSABILIDAD : 'Pendiente de aceptar en la aplicación.', { startY: y2 });
  y2 += 4;
  encabezadoPagina(doc, '4.2  Título');
  y2 = parrafo(doc, `Nombre del proyecto: ${proyecto.titulo.nombreProyecto || '—'}`, { startY: y2 + 4 });
  y2 = parrafo(doc, `Denominación de la propuesta: ${proyecto.titulo.denominacionPropuesta || '—'}`, { startY: y2 });

  // ============================================================ 4.4 Resumen
  doc.addPage();
  marcar('4.4  Resumen ejecutivo');
  y2 = 30;
  y2 = parrafo(doc, proyecto.resumen.introduccion || '—', { startY: y2 });
  const cuerpoResumen: (string | number)[][] = [
    ['Inversión total (miles de USD)', fmtK(modelo.indicadores.inversionTotalKUSD)],
    ['Aportaciones de los socios (miles de USD)', fmtK(modelo.indicadores.aportacionesTotalesKUSD)],
    ['Crédito externo previsto (miles de USD)', proyecto.financiero.deuda.habilitada ? fmtK(param('credito_monto_k')) : 'No previsto'],
    ['Horizonte de análisis (años)', String(N)],
    ['Ingresos totales del año 1 (miles de USD)', fmtK(modelo.indicadores.ingresosTotales[1] ?? 0)],
    ['Utilidad después de impuestos del año 1 (miles de USD)', fmtK(modelo.indicadores.utilidadNeta[1] ?? 0)],
    ['Recuperación de la INVERSIÓN TOTAL (flujo del proyecto)', recP.anios === null ? 'No recuperada en el horizonte' : fmtAnios(recP.anios)],
    ['Recuperación del CAPITAL APORTADO (flujo de los socios)', recS.anios === null ? 'No recuperada en el horizonte' : fmtAnios(recS.anios)],
    ['Beneficios directos al país acumulados — período completo (miles de USD)', fmtK(modelo.indicadores.beneficiosPaisAcumulados)],
    ['Beneficios directos al país — explotación, años 1–N (miles de USD)', fmtK(modelo.indicadores.beneficiosPaisExplotacion)],
    ['Empleos directos en operación', String(modelo.indicadores.totalTrabajadores)],
    ['Salario promedio anual (CUP)', modelo.indicadores.salarioPromedioAnualCUP === null ? '—' : fmtCUP(modelo.indicadores.salarioPromedioAnualCUP)],
  ];
  y2 = tabla(doc, 'Cifras clave (vinculadas al modelo financiero activo)', y2 + 2, [['Indicador', 'Valor']], cuerpoResumen, { size: 8 });
  y2 = bloqueAnalisis(doc, 'Resumen ejecutivo — análisis dinámico', 'resumen_ejecutivo', proyecto, modelo, y2);
  y2 = parrafo(doc, proyecto.resumen.notas, { startY: y2, size: 8 });
  if (esDemo) y2 = parrafo(doc, 'ADVERTENCIA: ' + ADVERTENCIA_DATOS_FICTICIOS, { startY: y2, size: 7.5 });

  // ============================================================ 4.5 Descripción
  doc.addPage();
  marcar('4.5  Descripción del negocio');
  y2 = 30;
  const camposNegocio: [string, string][] = [
    ['Modalidad de la inversión extranjera', proyecto.negocio.modalidad],
    ['Objeto social o contractual', proyecto.negocio.objetoSocial],
    ['Plazo de vigencia', proyecto.negocio.plazoVigencia],
    ['Fundamentación y propuesta de valor', proyecto.negocio.fundamentacion],
    ['Relación con los objetivos de la inversión extranjera', proyecto.negocio.objetivosInversion],
    ['Relación con el PNDES', proyecto.negocio.relacionPNDES],
    ['Relación con la estrategia territorial', proyecto.negocio.relacionEDT],
    ['Bienes y servicios', proyecto.negocio.bienesServicios],
    ['Mercado interno', proyecto.negocio.mercadoInterno],
    ['Mercado externo', proyecto.negocio.mercadoExterno],
    ['Regla de distribución de beneficios', proyecto.negocio.reglaDistribucion],
  ];
  for (const [k, v] of camposNegocio) {
    y2 = parrafo(doc, `${k}:`, { startY: y2, size: 9 });
    y2 = parrafo(doc, v || '—', { startY: y2 - 1, size: 8.5 });
  }
  y2 += 2;
  doc.setFontSize(9);
  if (y2 > ALTO - 60) { doc.addPage(); y2 = 22; }
  y2 = tabla(doc, 'Inversionista extranjero', y2, [['Campo', 'Contenido']], [
    ['Nombre', proyecto.inversionistaExtranjero.nombre || '—'],
    ['Domicilio', proyecto.inversionistaExtranjero.domicilio || '—'],
    ['Identificación fiscal', proyecto.inversionistaExtranjero.identificacionFiscal || '—'],
    ['Experiencia', proyecto.inversionistaExtranjero.experiencia || '—'],
    ['Vinculación con Cuba', proyecto.inversionistaExtranjero.vinculacionCuba || '—'],
  ], { size: 8 });
  y2 = tabla(doc, 'Inversionista nacional', y2, [['Campo', 'Contenido']], [
    ['Nombre', proyecto.inversionistaNacional.nombre || '—'],
    ['Domicilio', proyecto.inversionistaNacional.domicilio || '—'],
    ['Identificación fiscal', proyecto.inversionistaNacional.identificacionFiscal || '—'],
    ['Experiencia (objeto social vigente, cuando corresponda)', proyecto.inversionistaNacional.experiencia || '—'],
    ['Vinculación con Cuba', proyecto.inversionistaNacional.vinculacionCuba || '—'],
  ], { size: 8 });

  // Aportaciones
  if (proyecto.aportaciones.length) {
    if (y2 > ALTO - 70) { doc.addPage(); y2 = 22; }
    const bodyAport = proyecto.aportaciones.map((a) => [
      a.socio === 'nacional' ? 'Nacional' : 'Extranjero',
      ETIQUETAS_APORTACION[a.tipo],
      ...a.montos.map((m) => fmtK(m)),
      fmtK(a.montos.reduce((s, m) => s + m, 0)),
      a.referenciaDocumental ? 'Sí' : a.tipo === 'derechos_reales' ? 'PENDIENTE' : '—',
    ]);
    y2 = tabla(doc, 'Aportaciones de los socios (miles de USD con un decimal)', y2, [['Socio', 'Tipo de aporte', 'Año 1', 'Año 2', 'Año 3', 'Total', 'Ref. doc.']], bodyAport, { size: 7 });
    y2 = parrafo(doc, 'Los aportes de derechos reales requieren la certificación de la Dirección de Patrimonio del MFP cuando corresponda (metodología 4.5). Los aportes en activos deben conciliar con el inventario de inversiones para evitar la doble contabilización del mismo bien.', { startY: y2, size: 7.5 });
    y2 = bloqueAnalisis(doc, 'Análisis de las aportaciones', 'aportaciones', proyecto, modelo, y2);
  }

  // ============================================================ 4.6 Técnico
  doc.addPage();
  marcar('4.6  Aspectos técnicos y operativos');
  y2 = 30;
  const camposTec: [string, string][] = [
    ['Caracterización de bienes y servicios', proyecto.tecnico.caracterizacion],
    ['Capacidad instalada', proyecto.tecnico.capacidadInstalada],
    ['Plazo para alcanzar los niveles previstos', proyecto.tecnico.plazoNiveles],
    ['Tecnologías utilizadas', proyecto.tecnico.tecnologiasActuales],
    ['Tecnologías a incorporar', proyecto.tecnico.tecnologiasNuevas],
    ['Localización', proyecto.tecnico.localizacion],
    ['Infraestructura requerida', proyecto.tecnico.infraestructura],
    ['Terrenos e instalaciones', proyecto.tecnico.terrenosInstalaciones],
    ['Necesidades de construcción', proyecto.tecnico.necesidadesConstruccion],
  ];
  for (const [k, v] of camposTec) {
    y2 = parrafo(doc, `${k}:`, { startY: y2, size: 9 });
    y2 = parrafo(doc, v || '—', { startY: y2 - 1, size: 8.5 });
  }
  // Recursos operativos
  if (proyecto.recursos.length) {
    if (y2 > ALTO - 60) { doc.addPage(); y2 = 22; }
    y2 = parrafo(doc, `Escenario de capacidad ACTIVO: ${proyecto.tecnico.escenarioCapacidad === 'B_ampliacion' ? 'B — ampliaciones programadas' : 'A — capacidad constante (las ampliaciones definidas no se aplican)'}.`, { startY: y2, size: 8.5 });
    const bodyRec = proyecto.recursos.map((r) => [
      r.nombre,
      ETIQUETAS_RECURSO[r.tipo],
      String(r.cantidad),
      fmtK(r.horasDia),
      String(r.diasAnio),
      fmtPct(r.pctMantenimiento),
      String(r.anioDisponible),
      r.expansiones.length ? r.expansiones.map((e) => `+${e.cantidad} en año ${e.anio} (${fmtK(e.costoKUSD)} kUSD)`).join('; ') : '—',
    ]);
    y2 = tabla(doc, 'Recursos operativos (la capacidad se deriva de estos datos)', y2, [['Recurso', 'Tipo', 'Cant.', 'Horas/día', 'Días/año', 'Mantenim.', 'Disp. desde año', 'Ampliaciones']], bodyRec, { size: 6.5 });
  }
  // Servicios con demanda/realizable/capacidad
  if (proyecto.servicios.length) {
    if (y2 > ALTO - 60) { doc.addPage(); y2 = 22; }
    const bodySvc = proyecto.servicios.map((s) => {
      const sc = modelo.servicios.find((x) => x.id === s.id);
      const cap1 = modelo.capacidadServicios[s.id]?.[1];
      const limitada = sc && sc.capacidadesExcedidas.length > 0;
      return [
        s.nombre,
        fmtK(s.precioBase),
        String(s.cantidadBaseMensual),
        fmtK(s.duracionMinutos),
        String(s.recursoIds.length ? s.recursoIds.length : '—'),
        fmtK(s.costoVariableUnitario),
        fmtK(sc?.valores[1]?.['srv_cantidad_real_mensual'] ?? 0),
        cap1 ? fmtK(cap1.capacidadMensual) : '—',
        limitada ? `LIMITADA (${sc!.capacidadesExcedidas.join(', ')})` : 'Atendible',
      ];
    });
    y2 = tabla(doc, 'Servicios previstos (año 1; precios y montos en USD; demanda vs. capacidad del escenario activo)', y2, [['Servicio', 'Precio unit.', 'Demanda mensual', 'Duración (min)', 'Recursos que usa', 'CVU', 'Cantidad realizable/mes', 'Capacidad mensual', 'Estado de la capacidad']], bodySvc, { size: 6.2 });
    y2 = bloqueAnalisis(doc, 'Análisis de capacidad y servicios', 'capacidad', proyecto, modelo, y2);
  }
  if (proyecto.consumos.length) {
    y2 = tabla(doc, 'Estimación de consumos y residuos', y2, [['Concepto', 'Unidad', 'Cantidad', 'Período', 'Observación']], proyecto.consumos.map((c) => [c.concepto, c.unidad, String(c.cantidad), c.periodo, c.observacion]), { size: 7 });
  }

  // ============================================================ 4.7 Financiero
  doc.addPage();
  marcar('4.7  Análisis financiero');
  y2 = 30;
  const invUSD = val('inversion_fija_usd_k', 0);
  const invCUP = val('inversion_fija_cup_k', 0);
  y2 = tabla(doc, 'Costo total de la inversión inicial (miles de USD)', y2, [['Componente', 'Monto']], [
    ['Gastos previos', fmtK(val('gastos_previos_k', 0))],
    ['Inversión fija (en USD)', fmtK(invUSD)],
    ['Inversión fija en CUP convertida (tipo de cambio parametrizado)', fmtK(invCUP)],
    ['Capital de trabajo', fmtK(param('capital_trabajo_k'))],
    ['INVERSIÓN TOTAL', fmtK(modelo.indicadores.inversionTotalKUSD)],
  ], { size: 8 });
  y2 = tabla(doc, 'Fuentes de financiamiento (miles de USD)', y2, [['Fuente', 'Monto']], [
    ['Aportaciones de los socios', fmtK(modelo.indicadores.aportacionesTotalesKUSD)],
    ['Otras fuentes disponibles', fmtK(param('otras_fuentes_k'))],
    ['Crédito externo', fmtK(param('credito_monto_k'))],
    ['Financiación disponible', fmtK(val('financiacion_disponible_k', 0))],
    ['Necesidad de financiación', fmtK(val('necesidad_financiacion_k', 0))],
    ['Diferencia (exceso/insuficiencia)', fmtK(val('diferencia_financiacion_k', 0))],
  ], { size: 8 });
  y2 = bloqueAnalisis(doc, 'Análisis de inversión y financiación', 'inversion_financiacion', proyecto, modelo, y2);

  // Calendario de deuda
  if (proyecto.financiero.deuda.habilitada && param('credito_monto_k') > 0) {
    if (y2 > ALTO - 70) { doc.addPage(); y2 = 22; }
    y2 = parrafo(doc, `Crédito: ${ETIQUETAS_TIPO_GRACIA[proyecto.financiero.deuda.tipoGracia]}, ${param('periodo_gracia')} año(s); método: ${ETIQUETAS_METODO_AMORT[proyecto.financiero.deuda.metodo]} en ${param('plazo_amortizacion')} anualidades; desembolso en el año ${proyecto.financiero.deuda.anioDesembolso}. Tasa: ${fmtPct(param('tasa_interes'))} (supuesto editable).`, { startY: y2, size: 8 });
    const bodyDeuda = modelo.deuda.map((f) => [
      f.anio === 0 ? 'Año 0' : `Año ${f.anio}`,
      fmtK(f.saldoInicial),
      fmtK(f.desembolso),
      fmtK(f.interesDevengado),
      fmtK(f.amortizacion),
      fmtK(f.saldoFinal),
    ]);
    y2 = tabla(doc, 'Calendario financiero de la deuda (miles de USD): saldo final = saldo inicial + desembolso + capitalización − amortización', y2, [['Período', 'Saldo inicial', 'Desembolso', 'Interés devengado', 'Amortización', 'Saldo final']], bodyDeuda, { size: 6.8 });
  }

  // Depreciación por activo
  if (modelo.depreciacion.length) {
    if (y2 > ALTO - 70) { doc.addPage(); y2 = 22; }
    const bodyDep = modelo.depreciacion.map((a) => {
      const fila: (string | number)[] = [a.concepto, fmtK(a.baseDepreciableKUSD), String(a.vidaUtilAnios), String(a.anioDisponible), fmtPct(a.valorResidualPct)];
      for (const t of [1, 2, 3, 5, N]) fila.push(t <= N ? fmtK(a.depreciacion[t] ?? 0) : '—');
      fila.push(fmtK(a.acumulada), fmtK(a.vnl));
      return fila;
    });
    const headDep = ['Activo', 'Base depreciable (kUSD)', 'Vida útil', 'Disp. desde', 'Residual', ...[1, 2, 3, 5, N].map((t) => `Año ${t}`), 'Acumulada', 'VNL'];
    y2 = tabla(doc, 'Depreciación por activo (kUSD; por activo, limitada al importe depreciable; años de muestra y extremos)', y2, [headDep], bodyDep, { size: 6.2 });
  }
  y2 = bloqueAnalisis(doc, 'Análisis de deuda y depreciación', 'deuda_depreciacion', proyecto, modelo, y2);

  // Estado de resultados (tabla grande)
  if (y2 > ALTO - 80) { doc.addPage(); y2 = 22; }
  const headProj: string[][] = [['Concepto', 'Unidad', ...years.map((t) => (t === 0 ? 'Año 0' : `Año ${t}`)), 'Total']];
  const bodyProj: (string | number)[][] = [];
  for (const grupo of ESTADO_RESULTADOS) {
    for (const linea of grupo.lineas) {
      const fila: (string | number)[] = [linea.etiqueta, 'kUSD'];
      let total = 0;
      for (const t of years) {
        const v = valorLinea(modelo, proyecto, linea.ref, t);
        fila.push(fmtK(v));
        total += v;
      }
      fila.push(fmtK(total));
      bodyProj.push(fila);
    }
  }
  for (const id of ['amortizacion_k', 'saldo_deuda_k', 'dividendos_pagables_k']) {
    const r = proyecto.reglas.find((x) => x.id === id);
    if (!r) continue;
    const fila: (string | number)[] = [id === 'dividendos_pagables_k' ? 'Dividendos pagables (memoria; no es gasto)' : `${r.nombre} (memoria; flujo de financiación, no gasto)`, 'kUSD'];
    for (const t of years) fila.push(fmtK(val(id, t)));
    fila.push('');
    bodyProj.push(fila);
  }
  y2 = tabla(doc, 'Proyección de ingresos, costos y utilidades (miles de USD)', y2, headProj, bodyProj, { size: 6 });
  y2 = bloqueAnalisis(doc, 'Análisis de ingresos, costos y utilidades', 'ingresos_costos', proyecto, modelo, y2);

  // Flujos de caja FCFF/FCFE + recuperación
  doc.addPage();
  marcar('4.7.1  Flujos de caja y recuperación de la inversión');
  y2 = 30;
  y2 = parrafo(doc, 'El modelo calcula DOS indicadores separados: la recuperación de la INVERSIÓN TOTAL con el flujo de caja del proyecto (FCFF) y la recuperación del CAPITAL APORTADO con el flujo de los socios (FCFE). Ninguno mezcla la utilidad contable con la amortización del crédito.', { startY: y2, size: 8.5 });
  const headFlujo: string[][] = [['Concepto (kUSD)', ...years.map((t) => (t === 0 ? 'Año 0' : `Año ${t}`))]];
  const bodyFlujo: (string | number)[][] = [
    ['Flujo del PROYECTO (FCFF)', ...years.map((t) => fmtK(modelo.indicadores.fcff[t] ?? 0))],
    ['Flujo acumulado del proyecto', ...years.map((t) => fmtK(modelo.indicadores.fcffAcumulado[t] ?? 0))],
    ['Saldo pendiente de recuperar (inversión total)', ...years.map((t) => fmtK(val('saldo_pendiente_proyecto_k', t)))],
    ['Flujo de los SOCIOS (FCFE)', ...years.map((t) => fmtK(modelo.indicadores.fcfe[t] ?? 0))],
    ['Flujo acumulado de los socios', ...years.map((t) => fmtK(modelo.indicadores.fcfeAcumulado[t] ?? 0))],
    ['Saldo pendiente de recuperar (capital aportado)', ...years.map((t) => fmtK(val('saldo_pendiente_socios_k', t)))],
  ];
  y2 = tabla(doc, 'Flujos de caja del proyecto y de los socios (miles de USD)', y2, headFlujo, bodyFlujo, { size: 6.5 });
  y2 = parrafo(
    doc,
    `Recuperación de la inversión total: ${recP.anios === null ? 'NO se recupera dentro del horizonte' : `${fmtAnios(recP.anios)} (cruce en el año ${recP.anioCruce})`}. Método: interpolación lineal del acumulado, (t−1) + |acumulado anterior| / (acumulado actual − acumulado anterior). Recuperación del capital aportado: ${recS.anios === null ? 'NO se recupera dentro del horizonte' : `${fmtAnios(recS.anios)} (cruce en el año ${recS.anioCruce})`}. ${recP.indeterminado || recS.indeterminado ? 'ATENCIÓN: algún acumulado cambia de signo más de una vez (flujos no convencionales): interpretar con cautela.' : ''} ${N < Math.ceil((recP.anios ?? 0) + 1) && recP.anios !== null ? 'El horizonte es menor que recuperación + 1: la metodología exige ampliarlo.' : 'Horizonte ≥ recuperación + 1 conforme a la metodología.'} El capital de trabajo solo se recupera si el parámetro correspondiente lo indica (regla explícita).`,
    { startY: y2, size: 7.5 }
  );
  y2 = bloqueAnalisis(doc, 'Análisis del flujo de caja y la recuperación', 'flujo_recuperacion', proyecto, modelo, y2);

  // Dividendos
  if (modelo.dividendos.length) {
    if (y2 > ALTO - 70) { doc.addPage(); y2 = 22; }
    const bodyDiv = modelo.dividendos.map((d) => [
      d.anio === 0 ? 'Año 0' : `Año ${d.anio}`,
      fmtK(d.udi),
      fmtK(d.base),
      fmtK(d.reserva),
      fmtK(d.propuestos),
      fmtK(d.pagables),
      fmtK(d.socioNacional),
      fmtK(d.saldoAcumulable),
    ]);
    y2 = tabla(doc, 'Módulo de dividendos (kUSD): base distribuible, reserva, propuestos y PAGABLES limitados por caja', y2, [['Período', 'UDI', 'Base', 'Reserva', 'Propuestos', 'Pagables', 'Socio nacional', 'Saldo acumulable']], bodyDiv, { size: 6.8 });
    y2 = parrafo(doc, 'Ningún dividendo se paga por encima de la caja acumulada disponible (FCFE antes de distribuciones). La PARTICIPACIÓN en el capital (composición) y el PORCENTAJE DE REPARTO son conceptos distintos y se configuran por separado. Los dividendos de la parte cubana que figuran en 4.11 salen de este mismo módulo.', { startY: y2, size: 7.5 });
  }

  // ============================================================ 4.8 Mercado
  doc.addPage();
  marcar('4.8  Análisis o caracterización del mercado');
  y2 = 30;
  const camposMer: [string, string][] = [
    ['Caracterización de productos y servicios', proyecto.mercado.caracterizacion],
    ['Requisitos regulatorios y registros necesarios', proyecto.mercado.requisitosRegulatorios],
    ['Materias primas y materiales auxiliares', proyecto.mercado.materiasPrimas],
    ['Fuentes y ubicación de los suministros', proyecto.mercado.fuentesSuministro],
    ['Consumo estimado', proyecto.mercado.consumoEstimado],
    ['Demanda aparente', proyecto.mercado.demandaAparente],
    ['Demanda solvente', proyecto.mercado.demandaSolvente],
    ['Método y fuentes de estimación', `${proyecto.mercado.metodoEstimacion} ${proyecto.mercado.fuentesConsulta}`],
    ['Comercialización — exportaciones', proyecto.mercado.ventasExportacion],
    ['Comercialización — divisas (plataformas con pagos desde el exterior)', proyecto.mercado.ventasDivisas],
    ['Comercialización — moneda nacional', proyecto.mercado.ventasMonedaNacional],
  ];
  for (const [k, v] of camposMer) {
    y2 = parrafo(doc, `${k}:`, { startY: y2, size: 9 });
    y2 = parrafo(doc, v || '—', { startY: y2 - 1, size: 8.5 });
  }
  y2 = bloqueAnalisis(doc, 'Análisis de mercado — lectura de los datos disponibles', 'mercado', proyecto, modelo, y2);

  // ============================================================ 4.9 Fuerza
  doc.addPage();
  marcar('4.9  Fuerza de trabajo');
  y2 = 30;
  y2 = parrafo(doc, `Entidad autorizada a contratar la fuerza de trabajo: ${proyecto.fuerza.entidadContratante || '—'}`, { startY: y2 });
  const bodyPer: (string | number)[][] = [];
  const grupos = ['cubano_directivo', 'cubano_otro', 'extranjero_directivo', 'extranjero_otro'] as const;
  for (const g of grupos) {
    for (const etapa of ['montaje', 'operacion'] as const) {
      const filas = proyecto.personal.filter((p) => p.grupo === g && p.etapa === etapa);
      if (filas.length) {
        const cantidad = filas.reduce((s, p) => s + p.cantidad, 0);
        const salario = filas.reduce((s, p) => s + p.cantidad * p.salarioPromedioAnualCUP, 0) / Math.max(1, cantidad);
        bodyPer.push([ETIQUETAS_GRUPO[g], etapa === 'montaje' ? 'Montaje (año 0, transitorio)' : 'Operación', String(cantidad), fmtCUP(salario)]);
      }
    }
  }
  bodyPer.push(['TOTAL (operación)', '', String(modelo.indicadores.totalTrabajadores), modelo.indicadores.salarioPromedioAnualCUP === null ? '—' : fmtCUP(modelo.indicadores.salarioPromedioAnualCUP)]);
  y2 = tabla(doc, 'Fuerza de trabajo por categoría y etapa de contratación (salarios en CUP)', y2, [['Categoría', 'Etapa', 'Cantidad', 'Salario promedio anual (CUP)']], bodyPer, { size: 8 });
  y2 = bloqueAnalisis(doc, 'Análisis de la fuerza de trabajo', 'fuerza_trabajo', proyecto, modelo, y2);

  // ============================================================ 4.10 Inversiones
  doc.addPage();
  marcar('4.10  Inversiones');
  y2 = 30;
  if (proyecto.financiero.inversion.length) {
    const bodyInv = proyecto.financiero.inversion.map((r) => [
      r.concepto,
      ETIQUETAS_CATEGORIA_INV[r.categoria],
      r.moneda,
      fmtK(r.monto),
      r.vidaUtilAnios > 0 ? String(r.vidaUtilAnios) : '—',
      r.categoria === 'inversion_fija' ? String(r.anioDisponible) : '—',
      r.categoria === 'inversion_fija' ? fmtPct(r.valorResidualPct) : '—',
      r.observacion,
    ]);
    y2 = tabla(doc, 'Inversiones por concepto (miles, en la moneda indicada; activos con disponibilidad y residual)', y2, [['Concepto', 'Categoría', 'Moneda', 'Monto', 'Vida útil (años)', 'Disp. desde', 'Residual', 'Observación']], bodyInv, { size: 6.5 });
    y2 = parrafo(doc, 'No se suman monedas diferentes: los montos en CUP se convierten con el tipo de cambio parametrizado (con fecha y fuente) para los totales. Los activos fijos deprecian desde su año de disponibilidad y solo por su importe depreciable.', { startY: y2, size: 7.5 });
  }
  if (proyecto.financiero.vehiculos.length) {
    y2 = tabla(doc, 'Desglose de vehículos', y2, [['Tipo', 'Cantidad', 'Monto (miles de USD)']], proyecto.financiero.vehiculos.map((v) => [v.tipo, String(v.cantidad), fmtK(v.montoKUSD)]), { size: 8 });
  }
  if (proyecto.cronograma.length) {
    y2 = tabla(doc, 'Cronograma inversionista', y2, [['Etapa', 'Inicio', 'Fin', 'Observación']], proyecto.cronograma.map((c) => [c.etapa, mesAnio(c.inicio), mesAnio(c.fin), c.observacion]), { size: 7.5 });
  }
  y2 = bloqueAnalisis(doc, 'Análisis de inversiones y cronograma', 'inversiones_cronograma', proyecto, modelo, y2);

  // ============================================================ 4.11 Beneficios
  doc.addPage();
  marcar('4.11  Indicadores de beneficios directos al país');
  y2 = 30;
  const headBP: string[][] = [['Partida', ...years.map((t) => (t === 0 ? 'Año 0' : `Año ${t}`)), 'Total']];
  const bodyBP: (string | number)[][] = [];
  for (const linea of BENEFICIOS_PAIS) {
    const fila: (string | number)[] = [linea.etiqueta + (linea.incluyeAnioCero ? ' [incluye año 0]' : ' [años 1–N]')];
    let total = 0;
    for (const t of years) {
      const v = valorLinea(modelo, proyecto, linea.ref, t);
      fila.push(fmtK(v));
      total += v;
    }
    fila.push(fmtK(total));
    bodyBP.push(fila);
  }
  y2 = tabla(doc, 'Beneficios directos al país por año (miles de USD; etiqueta de período por partida)', y2, headBP, bodyBP, { size: 6.2 });
  y2 = parrafo(doc, `Período de análisis: ${N} años de operación, verificando el requisito de contemplar la recuperación más un año. Total acumulado del período completo: ${fmtK(modelo.indicadores.beneficiosPaisAcumulados)} miles de USD (incluye el año 0). Subtotal de la explotación (años 1–${N}): ${fmtK(modelo.indicadores.beneficiosPaisExplotacion)} miles de USD. Ambos totales provienen del mismo cálculo del motor: resumen, tabla y conclusiones coinciden.`, { startY: y2, size: 7.5 });
  y2 = bloqueAnalisis(doc, 'Análisis de los beneficios directos al país', 'beneficios_pais', proyecto, modelo, y2);

  // ============================================================ 4.12 Conclusiones
  doc.addPage();
  marcar('4.12  Conclusiones');
  y2 = 30;
  y2 = parrafo(doc, proyecto.conclusiones.texto || '—', { startY: y2, size: 9 });
  y2 = bloqueAnalisis(doc, 'Conclusiones (análisis dinámico del modelo)', 'conclusiones', proyecto, modelo, y2);

  // ============================================================ Diagnóstico
  doc.addPage();
  marcar('Diagnóstico y controles de consistencia');
  y2 = 30;
  const { hallazgos, resumen } = diagnosticar(proyecto, modelo);
  y2 = parrafo(doc, `Resumen de control — conteo: ${resumen.conteo.error_bloqueante} error(es) bloqueante(s), ${resumen.conteo.advertencia_importante} advertencia(s) importante(s), ${resumen.conteo.informacion_pendiente} información pendiente, ${resumen.conteo.observacion_calidad} observación(es) de calidad. ${resumen.conclusionesAfectadas ? 'Existen hallazgos que condicionan las conclusiones del plan.' : 'Ningún hallazgo invalida por sí mismo las conclusiones bajo los supuestos vigentes.'} La completitud formal no se usa como prueba de calidad: la validación legal, tributaria, sanitaria y de mercado queda sujeta a verificación externa.`, { startY: y2, size: 8 });
  const bodyDim = resumen.dimensiones.map((d) => [d.nombre, d.estado === 'ok' ? 'Correcto' : d.estado === 'aceptable' ? 'Aceptable' : 'Deficiente', d.detalle]);
  y2 = tabla(doc, 'Resumen de control por dimensiones', y2, [['Dimensión', 'Estado', 'Detalle']], bodyDim, { size: 7 });
  if (hallazgos.length) {
    const bodyHall = hallazgos.map((h) => [h.nivel, h.codigo, h.mensaje, h.afectaConclusiones ? 'SÍ' : 'No']);
    y2 = tabla(doc, 'Hallazgos del diagnóstico', y2, [['Nivel', 'Código', 'Hallazgo', '¿Afecta conclusiones?']], bodyHall, { size: 6.5 });
  } else {
    y2 = parrafo(doc, 'No se emitieron hallazgos.', { startY: y2, size: 8 });
  }

  // ============================================================ Notas y supuestos
  doc.addPage();
  marcar('Notas, parámetros y supuestos del modelo');
  y2 = 30;
  const bodyParams = proyecto.parametros.map((p) => [p.nombre, p.tipo === 'porcentaje' ? fmtPct(p.valor) : `${fmtK(p.valor)} ${p.unidad}`, p.demo ? 'SUPUESTO DEMOSTRATIVO' : 'Definido por el usuario', p.fechaRef || '—']);
  y2 = tabla(doc, 'Parámetros de cálculo activos (Nivel A — editables en la aplicación)', y2, [['Parámetro', 'Valor', 'Naturaleza', 'Fecha ref.']], bodyParams, { size: 7 });
  y2 = parrafo(doc, 'Reglas de cálculo activas (Nivel B): fórmulas completas, ámbito y equivalencias Excel pueden consultarse en «Configuración de cálculos» de la aplicación y en la hoja «Reglas» del libro exportado. Las variables del motor (mtr_*) provienen de las hojas Depreciacion, Deuda, FlujosCaja, Dividendos y Capacidad. La regla del impuesto sobre utilidades es demostrativa y editable: no constituye la tasa legal aplicable.', { startY: y2, size: 8 });
  y2 = parrafo(doc, 'Redondeo: los cálculos usan precisión interna completa y el redondeo es solo de presentación (miles de USD con un decimal); pequeñas diferencias con la suma visual de cifras redondeadas se explican por este motivo de forma uniforme.', { startY: y2, size: 8 });
  y2 = parrafo(doc, `Moneda y conversión: CUP y USD se mantienen separados; la conversión usa el tipo de cambio parametrizado (${fmtK(param('tipo_cambio'))} CUP/USD) con fecha y fuente documentadas. La conversión se aplica una sola vez.`, { startY: y2, size: 8 });
  if (esDemo) {
    y2 = parrafo(doc, ADVERTENCIA_DATOS_FICTICIOS, { startY: y2 + 2, size: 8 });
  }

  // Pies de página en todas las páginas tras la portada.
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(M, ALTO - 14, ANCHO - M, ALTO - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('PLANEX Cuba — Plan de Negocios (GOC-2026-O57)', M, ALTO - 9);
    doc.text(`Página ${i} de ${total}`, ANCHO - M, ALTO - 9, { align: 'right' });
    if (esDemo) doc.text('EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS', ANCHO / 2, ALTO - 9, { align: 'center' });
  }
  return { doc };
}

/** Genera el PDF con índice paginado (doble pasada). */
export function exportarPDF(proyecto: PlanexProject, modelo: ComputedModel): { datos: Blob; nombre: string } {
  // Pasada 1: registrar en qué página empieza cada sección (sin índice).
  const registro: Record<string, number> = {};
  construirDocumento(proyecto, modelo, { registrar: registro });
  // El índice ocupa al menos una página tras la portada.
  const paginasIndice = Math.max(1, Math.ceil(Object.keys(registro).length / 36));
  const paginasAjustadas = Object.fromEntries(
    Object.entries(registro).map(([k, v]) => [k, v + paginasIndice])
  );
  // Pasada 2: documento final con índice y numeración coherente.
  const { doc } = construirDocumento(proyecto, modelo, { paginasSecciones: paginasAjustadas });
  const datos = doc.output('blob');
  return { datos, nombre: `${(proyecto.titulo.nombreProyecto || proyecto.nombre).slice(0, 40)}.pdf` };
}
