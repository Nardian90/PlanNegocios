// ============================================================================
// Exportador PDF — documento profesional con portada, índice con numeración,
// secciones metodológicas 4.1–4.12, tablas legibles, encabezados y pies de
// página consistentes, y advertencia de datos ficticios (plantilla clínica).
// Texto seleccionable (no capturas). Índice a doble pasada.
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PlanexProject, ComputedModel, ADVERTENCIA_DATOS_FICTICIOS, DECLARACION_RESPONSABILIDAD, ESTADO_RESULTADOS, BENEFICIOS_PAIS, ETIQUETAS_APORTACION, ETIQUETAS_GRUPO, ETIQUETAS_CATEGORIA_INV } from '../types';
import { valorLinea } from '../engine/engine';
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

function tabla(doc: jsPDF, titulo: string, startY: number, head: string[][], body: (string | number)[][], opts?: { size?: number; colWidths?: 'auto' | Record<number, number> }) {
  let y = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  if (titulo) {
    if (y > ALTO - 40) {
      doc.addPage();
      y = 20;
    }
    doc.text(titulo, M, y);
    y += 3;
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
  const esDemo = proyecto.planex.plantillaOrigen === 'clinica';
  const marcar = (titulo: string) => {
    if (registrar) registrar[titulo] = doc.getCurrentPageInfo().pageNumber;
    encabezadoPagina(doc, titulo);
  };
  const val = (id: string, t: number) => modelo.valores[id]?.[t] ?? 0;

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
  y = parrafo(doc, `Inversión total: ${fmtK(modelo.indicadores.inversionTotalKUSD)} miles de USD · Horizonte de análisis: ${N} años · Período de recuperación: ${modelo.indicadores.recuperacionAnios === null ? 'no recuperado en el horizonte' : fmtAnios(modelo.indicadores.recuperacionAnios)}`, { startY: y + 4, size: 10 });
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
  doc.text(`Generado localmente por PLANEX Cuba el ${new Date().toLocaleString('es-ES')}. Las cifras provienen del modelo de cálculo activo.`, M, ALTO - 16);
  doc.addPage();

  // ============================================================ Índice (doble pasada)
  const INDICE_TITULO = 'Índice';
  if (paginasSecciones) {
    encabezadoPagina(doc, INDICE_TITULO);
    let ty = 32;
    doc.setFontSize(9);
    for (const [titulo, pag] of Object.entries(paginasSecciones)) {
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
    doc.addPage();
  }

  // ============================================================ 4.1 + 4.2
  doc.addPage();
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
    ['Aportaciones de los socios (miles de USD)', fmtK(val('aportaciones_total_k', 0))],
    ['Financiamiento con crédito (miles de USD)', fmtK(val('financiacion_disponible_k', 0) - val('aportaciones_total_k', 0) - (proyecto.parametros.find((p) => p.id === 'otras_fuentes_k')?.valor ?? 0))],
    ['Horizonte de análisis (años)', String(N)],
    ['Ingresos totales del año 1 (miles de USD)', fmtK(modelo.indicadores.ingresosTotales[1] ?? 0)],
    ['Utilidad después de impuestos del año 1 (miles de USD)', fmtK(modelo.indicadores.utilidadNeta[1] ?? 0)],
    ['Período de recuperación', modelo.indicadores.recuperacionAnios === null ? 'No recuperado en el horizonte' : fmtAnios(modelo.indicadores.recuperacionAnios)],
    ['Beneficios directos al país acumulados (miles de USD)', fmtK(modelo.indicadores.beneficiosPaisAcumulados)],
    ['Empleos directos en operación', String(modelo.indicadores.totalTrabajadores)],
    ['Salario promedio anual (CUP)', modelo.indicadores.salarioPromedioAnualCUP === null ? '—' : fmtCUP(modelo.indicadores.salarioPromedioAnualCUP)],
  ];
  y2 = tabla(doc, 'Cifras clave (vinculadas al modelo financiero activo)', y2 + 2, [['Indicador', 'Valor']], cuerpoResumen, { size: 8 });
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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
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
    ['Experiencia', proyecto.inversionistaNacional.experiencia || '—'],
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
    y2 = parrafo(doc, 'Los aportes de derechos reales requieren la certificación de la Dirección de Patrimonio del MFP cuando corresponda (metodología 4.5).', { startY: y2, size: 7.5 });
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
    doc.setFont('helvetica', 'bold');
    y2 = parrafo(doc, `${k}:`, { startY: y2, size: 9 });
    y2 = parrafo(doc, v || '—', { startY: y2 - 1, size: 8.5 });
  }
  if (proyecto.servicios.length) {
    if (y2 > ALTO - 60) { doc.addPage(); y2 = 22; }
    const bodySvc = proyecto.servicios.map((s) => {
      const sc = modelo.servicios.find((x) => x.id === s.id);
      const excede = sc && sc.capacidadesExcedidas.length > 0;
      return [s.nombre, fmtK(s.precioBase), String(s.cantidadBaseMensual), String(s.capacidadMaxMensual), fmtK(s.costoVariableUnitario), fmtK(sc?.valores[1]?.['srv_ingreso_anual'] ?? 0), excede ? `EXCEDE (${sc!.capacidadesExcedidas.join(', ')})` : '—'];
    });
    y2 = tabla(doc, 'Servicios previstos (año 1; precios y montos en USD)', y2, [['Servicio', 'Precio unit.', 'Cantidad mensual', 'Capacidad mensual', 'Costo var. unit.', 'Ingreso anual', 'Capacidad']], bodySvc, { size: 6.5 });
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
    ['Capital de trabajo', fmtK(proyecto.parametros.find((p) => p.id === 'capital_trabajo_k')?.valor ?? 0)],
    ['INVERSIÓN TOTAL', fmtK(modelo.indicadores.inversionTotalKUSD)],
  ], { size: 8 });
  const param = (id: string) => proyecto.parametros.find((p) => p.id === id)?.valor ?? 0;
  y2 = tabla(doc, 'Fuentes de financiamiento (miles de USD)', y2, [['Fuente', 'Monto']], [
    ['Aportaciones de los socios', fmtK(val('aportaciones_total_k', 0))],
    ['Otras fuentes disponibles', fmtK(param('otras_fuentes_k'))],
    ['Crédito externo', fmtK(param('credito_monto_k'))],
    ['Financiación disponible', fmtK(val('financiacion_disponible_k', 0))],
    ['Necesidad de financiación', fmtK(val('necesidad_financiacion_k', 0))],
    ['Diferencia (exceso/insuficiencia)', fmtK(val('diferencia_financiacion_k', 0))],
  ], { size: 8 });
  const tasa = param('tasa_impuesto_utilidades');
  y2 = parrafo(doc, `Impuesto sobre utilidades — regla activa: MAX(0, utilidad antes de impuestos × tasa). Tasa parametrizada: ${fmtPct(tasa)} (supuesto de demostración editable; no constituye la tasa legal aplicable). Crédito: tasa ${fmtPct(param('tasa_interes'))}, gracia ${param('periodo_gracia')} año(s), amortización ${param('plazo_amortizacion')} año(s). Conversión CUP/USD: ${fmtK(param('tipo_cambio'))} (parametrizada con fecha y fuente).`, { startY: y2, size: 8 });

  // Proyecciones (tabla grande)
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
  for (const id of ['amortizacion_k', 'saldo_deuda_k']) {
    const r = proyecto.reglas.find((x) => x.id === id);
    if (!r) continue;
    const fila: (string | number)[] = [r.nombre, 'kUSD'];
    for (const t of years) fila.push(fmtK(val(id, t)));
    fila.push('');
    bodyProj.push(fila);
  }
  y2 = tabla(doc, 'Proyección de ingresos, costos y utilidades (miles de USD)', y2, headProj, bodyProj, { size: 6 });

  const bodyFlujo: (string | number)[][] = [
    ['FLUJO DE CAJA NETO', 'kUSD', ...years.map((t) => fmtK(val('flujo_neto_k', t))), ''],
    ['FLUJO DE CAJA ACUMULADO', 'kUSD', ...years.map((t) => fmtK(val('flujo_acumulado_k', t))), ''],
    ['Saldo pendiente de recuperar', 'kUSD', ...years.map((t) => fmtK(val('saldo_pendiente_k', t))), ''],
  ];
  y2 = tabla(doc, 'Flujo de caja y recuperación de la inversión', y2, [['Concepto', 'Unidad', ...years.map((t) => (t === 0 ? 'Año 0' : `Año ${t}`))]], bodyFlujo, { size: 6.5 });
  y2 = parrafo(doc, `Período de recuperación: ${modelo.indicadores.recuperacionAnios === null ? 'la inversión no se recupera dentro del horizonte de análisis' : fmtAnios(modelo.indicadores.recuperacionAnios) + ' (interpolación lineal del flujo acumulado; basado en flujos de caja, no en la utilidad contable)'}. Horizonte de análisis: ${N} años ${modelo.indicadores.recuperacionAnios !== null && N >= Math.ceil(modelo.indicadores.recuperacionAnios + 1) ? '≥ recuperación + 1 (cumple la metodología)' : '— VERIFICAR: la metodología exige al menos recuperación + 1'}.`, { startY: y2, size: 7.5 });

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
    ['Comercialización — divisas', proyecto.mercado.ventasDivisas],
    ['Comercialización — moneda nacional', proyecto.mercado.ventasMonedaNacional],
  ];
  for (const [k, v] of camposMer) {
    doc.setFont('helvetica', 'bold');
    y2 = parrafo(doc, `${k}:`, { startY: y2, size: 9 });
    y2 = parrafo(doc, v || '—', { startY: y2 - 1, size: 8.5 });
  }

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
        bodyPer.push([ETIQUETAS_GRUPO[g], etapa === 'montaje' ? 'Montaje (año 0)' : 'Operación', String(cantidad), fmtCUP(salario)]);
      }
    }
  }
  bodyPer.push(['TOTAL (operación)', '', String(modelo.indicadores.totalTrabajadores), modelo.indicadores.salarioPromedioAnualCUP === null ? '—' : fmtCUP(modelo.indicadores.salarioPromedioAnualCUP)]);
  y2 = tabla(doc, 'Fuerza de trabajo por categoría y etapa de contratación', y2, [['Categoría', 'Etapa', 'Cantidad', 'Salario promedio anual (CUP)']], bodyPer, { size: 8 });
  y2 = parrafo(doc, `Costo laboral del año 1 (regla activa del motor): ${fmtK(val('costo_laboral_k', 1))} miles de USD. Total de trabajadores cubanos: ${modelo.indicadores.cubanos}; extranjeros: ${modelo.indicadores.extranjeros}. Etapa de montaje: ${modelo.indicadores.trabajadoresMontaje} trabajador(es).`, { startY: y2, size: 8 });

  // ============================================================ 4.10 Inversiones
  doc.addPage();
  marcar('4.10  Inversiones');
  y2 = 30;
  if (proyecto.financiero.inversion.length) {
    const bodyInv = proyecto.financiero.inversion.map((r) => [r.concepto, ETIQUETAS_CATEGORIA_INV[r.categoria], r.moneda, fmtK(r.monto), r.vidaUtilAnios > 0 ? String(r.vidaUtilAnios) : '—', r.observacion]);
    y2 = tabla(doc, 'Inversiones por concepto (miles, en la moneda indicada)', y2, [['Concepto', 'Categoría', 'Moneda', 'Monto', 'Vida útil (años)', 'Observación']], bodyInv, { size: 7 });
    y2 = parrafo(doc, 'No se suman directamente monedas diferentes: los montos en CUP se convierten con el tipo de cambio parametrizado (con fecha y fuente) para los totales del análisis financiero.', { startY: y2, size: 7.5 });
  }
  if (proyecto.financiero.vehiculos.length) {
    y2 = tabla(doc, 'Desglose de vehículos', y2, [['Tipo', 'Cantidad', 'Monto (miles de USD)']], proyecto.financiero.vehiculos.map((v) => [v.tipo, String(v.cantidad), fmtK(v.montoKUSD)]), { size: 8 });
  }
  if (proyecto.cronograma.length) {
    y2 = tabla(doc, 'Cronograma inversionista', y2, [['Etapa', 'Inicio', 'Fin', 'Observación']], proyecto.cronograma.map((c) => [c.etapa, mesAnio(c.inicio), mesAnio(c.fin), c.observacion]), { size: 8 });
  }

  // ============================================================ 4.11 Beneficios
  doc.addPage();
  marcar('4.11  Indicadores de beneficios directos al país');
  y2 = 30;
  const headBP: string[][] = [['Partida', ...years.map((t) => (t === 0 ? 'Año 0' : `Año ${t}`)), 'Total']];
  const bodyBP: (string | number)[][] = [];
  for (const linea of BENEFICIOS_PAIS) {
    const fila: (string | number)[] = [linea.etiqueta];
    let total = 0;
    for (const t of years) {
      const v = valorLinea(modelo, proyecto, linea.ref, t);
      fila.push(fmtK(v));
      total += v;
    }
    fila.push(fmtK(total));
    bodyBP.push(fila);
  }
  y2 = tabla(doc, 'Beneficios directos al país por año (miles de USD)', y2, headBP, bodyBP, { size: 6.5 });
  y2 = parrafo(doc, `Período de análisis: ${N} años, verificando el requisito metodológico de contemplar la recuperación de la inversión más un año. Total acumulado de beneficios: ${fmtK(modelo.indicadores.beneficiosPaisAcumulados)} miles de USD. Las partidas están vinculadas a los cálculos financieros sin doble contabilización (los pagos por fuerza de trabajo referencian el costo laboral; el impuesto referencia la regla activa).`, { startY: y2, size: 7.5 });

  // ============================================================ 4.12 Conclusiones
  doc.addPage();
  marcar('4.12  Conclusiones');
  y2 = 30;
  y2 = parrafo(doc, proyecto.conclusiones.texto || '—', { startY: y2, size: 9 });

  // ============================================================ Notas y supuestos
  doc.addPage();
  marcar('Notas y supuestos del modelo');
  y2 = 30;
  const bodyParams = proyecto.parametros.map((p) => [p.nombre, p.tipo === 'porcentaje' ? fmtPct(p.valor) : `${fmtK(p.valor)} ${p.unidad}`, p.demo ? 'SUPUESTO DEMOSTRATIVO' : 'Definido por el usuario', p.fechaRef || '—']);
  y2 = tabla(doc, 'Parámetros de cálculo activos (Nivel A — editables en la aplicación)', y2, [['Parámetro', 'Valor', 'Naturaleza', 'Fecha ref.']], bodyParams, { size: 7 });
  y2 = parrafo(doc, 'Reglas de cálculo activas (Nivel B): las fórmulas completas, su ámbito y su traducción a Excel pueden consultarse en la sección «Configuración de cálculos» de la aplicación y en la hoja «Reglas» del libro exportado. La regla del impuesto sobre utilidades es demostrativa y editable; no constituye la tasa legal aplicable.', { startY: y2, size: 8 });
  if (esDemo) {
    y2 = parrafo(doc, ADVERTENCIA_DATOS_FICTICIOS, { startY: y2 + 2, size: 8 });
  }

  // Encabezados repetidos gestionados por autoTable; pies de página:
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
  const paginasIndice = Math.max(1, Math.ceil(Object.keys(registro).length / 38));
  const paginasAjustadas = Object.fromEntries(
    Object.entries(registro).map(([k, v]) => [k, v + paginasIndice])
  );
  // Pasada 2: documento final con índice y numeración coherente.
  const { doc } = construirDocumento(proyecto, modelo, { paginasSecciones: paginasAjustadas });
  const datos = doc.output('blob');
  return { datos, nombre: `${(proyecto.titulo.nombreProyecto || proyecto.nombre).slice(0, 40)}.pdf` };
}
