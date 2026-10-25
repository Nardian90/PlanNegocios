// ============================================================================
// Exportador XLSX — libro Excel auténtico con FÓRMULAS REALES y referencias
// entre hojas. Las celdas calculadas llevan fórmula + valor en caché, y el
// libro se configura con recálculo automático al abrir (fullCalcOnLoad).
// Las reglas que no pueden traducirse se documentan (nunca se sustituyen
// en silencio) y se escriben con su valor estático y aviso.
// ============================================================================

import * as XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import { PlanexProject, ComputedModel, Regla } from '../types';
import { parsear } from '../engine/parser';
import { traducir, NoTraducible, letraCol, COL_SERVICIO, COL_PERSONAL, CtxTraduccion } from '../excel/traductor';
import { fmtAnios } from '../format';

type Celda = { v?: string | number | boolean | null; f?: string; z?: string; s?: Record<string, unknown> };

// Paleta sobria (sin azul/índigo): gris pizarra para encabezados, ámbar claro
// para entradas, verde claro para fórmulas, gris para totales.
const ST = {
  titulo: { font: { bold: true, sz: 14, color: { rgb: '333F50' } } },
  subtitulo: { font: { italic: true, sz: 10, color: { rgb: '595959' } } },
  encabezado: {
    fill: { patternType: 'solid', fgColor: { rgb: '333F50' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  },
  entrada: { fill: { patternType: 'solid', fgColor: { rgb: 'FFF2CC' } } },
  formula: { fill: { patternType: 'solid', fgColor: { rgb: 'E2EFDA' } } },
  total: { fill: { patternType: 'solid', fgColor: { rgb: 'E7E6E6' } }, font: { bold: true } },
  nota: { font: { italic: true, sz: 9, color: { rgb: '7F6000' } } },
  alerta: { fill: { patternType: 'solid', fgColor: { rgb: 'F8CBAD' } }, font: { bold: true, color: { rgb: '843C0C' }, sz: 9 } },
  ok: { font: { bold: true, color: { rgb: '2F6B2F' } } },
};

const Z = { kusd: '#,##0.0', usd: '#,##0.0', cup: '#,##0', pct: '0.0%', num: '#,##0.0', anios: '0.0' };

class Hoja {
  celdas: Record<string, Celda> = {};
  maxFila = 0;
  maxCol = 0;

  /** f y c son 1-based (A1 = f1, c1). */
  set(f: number, c: number, cel: Celda) {
    const addr = XLSX.utils.encode_cell({ r: f - 1, c: c - 1 });
    this.celdas[addr] = cel;
    if (f > this.maxFila) this.maxFila = f;
    if (c > this.maxCol) this.maxCol = c;
  }

  texto(f: number, c: number, v: string, s?: Record<string, unknown>) {
    this.set(f, c, { v, s });
  }

  /** Valor estático de entrada (editable). */
  entrada(f: number, c: number, v: number | string, z?: string) {
    this.set(f, c, { v, z, s: ST.entrada });
  }

  /** Celda con fórmula y valor en caché. */
  formula(f: number, c: number, v: number | string, fml: string, z?: string, extra?: Record<string, unknown>) {
    this.set(f, c, { v, f: fml, z, s: { ...ST.formula, ...(extra ?? {}) } });
  }

  aHoja(): XLSX.WorkSheet {
    const ref = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: Math.max(this.maxFila, 1) - 1, c: Math.max(this.maxCol, 1) - 1 });
    const ws: XLSX.WorkSheet = { '!ref': ref };
    for (const [addr, cel] of Object.entries(this.celdas)) {
      const celda: Record<string, unknown> = { t: typeof cel.v === 'number' ? 'n' : 's', v: cel.v ?? '' };
      if (cel.f) celda.f = cel.f;
      if (cel.z) celda.z = cel.z;
      if (cel.s) celda.s = cel.s;
      // Celdas vacías sin fórmula se omiten (evita celdas "fantasma")
      if (!cel.f && (cel.v === '' || cel.v === null)) celda.t = 'z';
      ws[addr] = celda as unknown as XLSX.CellObject;
    }
    return ws;
  }
}

interface FilaProyeccion {
  tipo: 'regla' | 'param' | 'entrada';
  id: string;
  etiqueta: string;
  negrita?: boolean;
}

const FILAS_PROYECCIONES: FilaProyeccion[] = [
  { tipo: 'regla', id: 'ingresos_servicios_usd', etiqueta: 'Ingresos por servicios (USD)' },
  { tipo: 'regla', id: 'ingresos_servicios_k', etiqueta: 'Ingresos por servicios' },
  { tipo: 'entrada', id: 'otros_ingresos', etiqueta: 'Otros ingresos (editable)' },
  { tipo: 'regla', id: 'ingresos_totales_k', etiqueta: 'INGRESOS TOTALES', negrita: true },
  { tipo: 'regla', id: 'costos_variables_usd', etiqueta: 'Costos variables (USD)' },
  { tipo: 'regla', id: 'costos_variables_k', etiqueta: 'Costos variables' },
  { tipo: 'regla', id: 'costo_laboral_cup', etiqueta: 'Costo laboral (CUP)' },
  { tipo: 'regla', id: 'costo_laboral_k', etiqueta: 'Costo laboral' },
  { tipo: 'param', id: 'canon_anual_k', etiqueta: 'Canon' },
  { tipo: 'regla', id: 'mantenimiento_k', etiqueta: 'Mantenimiento' },
  { tipo: 'param', id: 'servicios_publicos_anual_k', etiqueta: 'Servicios públicos' },
  { tipo: 'regla', id: 'gastos_admin_k', etiqueta: 'Gastos administrativos' },
  { tipo: 'param', id: 'otros_gastos_fijos_k', etiqueta: 'Otros gastos fijos' },
  { tipo: 'regla', id: 'depreciacion_anual_k', etiqueta: 'Depreciación' },
  { tipo: 'regla', id: 'interes_k', etiqueta: 'Intereses del crédito' },
  { tipo: 'regla', id: 'amortizacion_k', etiqueta: 'Amortización del crédito' },
  { tipo: 'regla', id: 'saldo_deuda_k', etiqueta: 'Saldo de la deuda (fin de año)' },
  { tipo: 'regla', id: 'costos_totales_k', etiqueta: 'COSTOS Y GASTOS TOTALES', negrita: true },
  { tipo: 'regla', id: 'utilidad_antes_impuestos_k', etiqueta: 'UTILIDAD ANTES DE IMPUESTOS', negrita: true },
  { tipo: 'regla', id: 'impuesto_utilidades_k', etiqueta: 'Impuesto sobre utilidades (regla demostrativa)' },
  { tipo: 'regla', id: 'utilidad_despues_impuestos_k', etiqueta: 'UTILIDAD DESPUÉS DE IMPUESTOS', negrita: true },
  { tipo: 'regla', id: 'flujo_neto_k', etiqueta: 'FLUJO DE CAJA NETO', negrita: true },
  { tipo: 'regla', id: 'flujo_acumulado_k', etiqueta: 'FLUJO DE CAJA ACUMULADO', negrita: true },
  { tipo: 'regla', id: 'saldo_pendiente_k', etiqueta: 'Saldo pendiente de recuperar' },
];

const FILAS_FINANCIACION: { fila: number; id: string; etiqueta: string; negrita?: boolean }[] = [
  { fila: 3, id: 'gastos_previos_k', etiqueta: 'Gastos previos (USD)' },
  { fila: 4, id: 'inversion_fija_usd_k', etiqueta: 'Inversión fija en USD' },
  { fila: 5, id: 'inversion_fija_cup_k', etiqueta: 'Inversión fija en CUP (convertida)' },
  { fila: 6, id: 'inversion_fija_k', etiqueta: 'Inversión fija total' },
  { fila: 7, id: 'CAPITAL_TRABAJO', etiqueta: 'Capital de trabajo' },
  { fila: 8, id: 'inversion_total_k', etiqueta: 'COSTO TOTAL DE LA INVERSIÓN INICIAL', negrita: true },
  { fila: 10, id: 'aportaciones_total_k', etiqueta: 'Total de aportaciones de los socios' },
  { fila: 11, id: 'OTRAS_FUENTES', etiqueta: 'Otras fuentes disponibles' },
  { fila: 12, id: 'CREDITO', etiqueta: 'Crédito externo' },
  { fila: 13, id: 'financiacion_disponible_k', etiqueta: 'FINANCIACIÓN DISPONIBLE', negrita: true },
  { fila: 14, id: 'necesidad_financiacion_k', etiqueta: 'Necesidad de financiación' },
  { fila: 15, id: 'diferencia_financiacion_k', etiqueta: 'Diferencia de financiación', negrita: true },
];

const SIN_TOTAL = new Set(['saldo_deuda_k', 'flujo_acumulado_k']);

export interface ResultadoXLSX {
  datos: ArrayBuffer;
  nombre: string;
  noTraducibles: { id: string; nombre: string; motivo: string }[];
}

/**
 * Inyecta <calcPr fullCalcOnLoad="1"/> en xl/workbook.xml para que Excel y
 * LibreOffice recalculen las fórmulas al abrir el libro (xlsx-js-style no lo
 * escribe de forma nativa).
 */
export async function activarRecalculoAutomatico(datos: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(datos);
  const archivo = zip.file('xl/workbook.xml');
  if (!archivo) return datos;
  let xml = await archivo.async('string');
  if (xml.includes('<calcPr')) {
    xml = xml.replace(/<calcPr\b([^>]*)\/>/g, (m, attrs: string) =>
      attrs.includes('fullCalcOnLoad') ? m : `<calcPr${attrs} fullCalcOnLoad="1"/>`
    );
  } else if (xml.includes('</sheets>')) {
    xml = xml.replace('</sheets>', '</sheets><calcPr calcId="171027" fullCalcOnLoad="1"/>');
  }
  zip.file('xl/workbook.xml', xml);
  const salida = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  return salida as ArrayBuffer;
}

export async function exportarXLSX(proyecto: PlanexProject, modelo: ComputedModel): Promise<ResultadoXLSX> {
  const N = proyecto.ajustes.horizonteAnios;
  const years = modelo.years;
  const noTraducibles: ResultadoXLSX['noTraducibles'] = [];
  const esDemo = proyecto.planex.plantillaOrigen === 'clinica';

  // ------------------------------------------------------------- layouts
  const filaParam = (id: string) => 3 + proyecto.parametros.findIndex((p) => p.id === id);
  const filaReglaAnio = (id: string) => {
    const i = FILAS_PROYECCIONES.findIndex((x) => x.tipo === 'regla' && x.id === id);
    return i >= 0 ? 4 + i : -1;
  };
  const filaReglaProyecto = (id: string) => FILAS_FINANCIACION.find((x) => x.id === id)?.fila ?? -1;
  const filaOtrosIngresos = 4 + FILAS_PROYECCIONES.findIndex((x) => x.tipo === 'entrada' && x.id === 'otros_ingresos');
  const nAport = proyecto.aportaciones.length;
  const rangoAportaciones: [number, number] = nAport ? [4, 3 + nAport] : [4, 4];
  const nInv = proyecto.financiero.inversion.length;
  const rangoInversion: [number, number] = nInv ? [4, 3 + nInv] : [4, 4];
  const nSvc = proyecto.servicios.length;
  const rangoServicios: [number, number] = nSvc ? [4, 3 + nSvc * N] : [4, 4];
  const filasPersonal = proyecto.personal.filter((p) => p.etapa === 'montaje').length + proyecto.personal.filter((p) => p.etapa === 'operacion').length * N;
  const rangoPersonal: [number, number] = filasPersonal ? [4, 3 + filasPersonal] : [4, 4];

  const ctxAnio = (col: number, fila: number): CtxTraduccion => ({
    modo: 'anio',
    filaParam,
    filaReglaAnio,
    filaReglaProyecto,
    periodos: N,
    filaOtrosIngresos,
    col,
    fila,
    filaPeriodos: 3,
    rangoServicios,
    rangoPersonal,
    rangoAportaciones,
    rangoInversion,
    colTotalAportaciones: 'F',
  });
  const ctxFilaServicio = (fila: number): CtxTraduccion => ({
    modo: 'filaServicio',
    filaParam,
    filaReglaAnio,
    filaReglaProyecto,
    periodos: N,
    filaOtrosIngresos,
    col: 6,
    fila,
    filaPeriodos: 3,
    rangoServicios,
    rangoPersonal,
    rangoAportaciones,
    rangoInversion,
    colTotalAportaciones: 'F',
  });
  const ctxFilaPersonal = (fila: number): CtxTraduccion => ({
    modo: 'filaPersonal',
    filaParam,
    filaReglaAnio,
    filaReglaProyecto,
    periodos: N,
    filaOtrosIngresos,
    col: 5,
    fila,
    filaPeriodos: 3,
    rangoServicios,
    rangoPersonal,
    rangoAportaciones,
    rangoInversion,
    colTotalAportaciones: 'F',
  });

  /** Traduce una regla; devuelve null si no es traducible. */
  function traducirRegla(r: Regla, ctx: CtxTraduccion): string | null {
    if (!r.habilitada) return null;
    try {
      const ast = parsear(r.expresion);
      return traducir(ast, ctx);
    } catch (e) {
      if (e instanceof NoTraducible || (e as Error).name === 'NoTraducible') {
        noTraducibles.push({ id: r.id, nombre: r.nombre, motivo: (e as Error).message });
        return null;
      }
      // Error de la propia regla: no exportar valores falsos
      noTraducibles.push({ id: r.id, nombre: r.nombre, motivo: `Regla con error: ${(e as Error).message}` });
      return null;
    }
  }

  const val = (id: string, t: number): number | string => {
    const v = modelo.valores[id]?.[t];
    if (!Number.isFinite(v)) return '#ERROR';
    return v;
  };

  const reglasPorId = new Map(proyecto.reglas.map((r) => [r.id, r]));
  const valorParam = (id: string) => proyecto.parametros.find((p) => p.id === id)?.valor ?? 0;

  // ============================================================== Portada
  const hPortada = new Hoja();
  hPortada.texto(1, 1, 'PLANEX Cuba — Plan de Negocios para propuestas de inversión extranjera', ST.titulo);
  hPortada.texto(2, 1, 'Metodología: Bases metodológicas GOC-2026-O57 (epígrafes 4.1–4.12)', ST.subtitulo);
  hPortada.texto(4, 1, 'Proyecto:');
  hPortada.texto(4, 2, proyecto.titulo.nombreProyecto || proyecto.nombre);
  hPortada.texto(5, 1, 'Denominación:');
  hPortada.texto(5, 2, proyecto.titulo.denominacionPropuesta);
  hPortada.texto(6, 1, 'Plantilla de origen:');
  hPortada.texto(6, 2, proyecto.planex.plantillaOrigen);
  hPortada.texto(7, 1, 'Fecha de exportación:');
  hPortada.texto(7, 2, new Date().toLocaleString('es-ES'));
  hPortada.texto(8, 1, 'Versión de esquema:');
  hPortada.texto(8, 2, proyecto.planex.schemaVersion);
  const filaInversionTotal = filaReglaProyecto('inversion_total_k');
  const filaAport = filaReglaProyecto('aportaciones_total_k');
  hPortada.texto(10, 1, 'Inversión total (kUSD):');
  hPortada.formula(10, 2, val('inversion_total_k', 0) as number, `=Financiacion!$D$${filaInversionTotal}`, Z.kusd);
  hPortada.texto(11, 1, 'Aportaciones (kUSD):');
  hPortada.formula(11, 2, val('aportaciones_total_k', 0) as number, `=Financiacion!$D$${filaAport}`, Z.kusd);
  const filaIng = filaReglaAnio('ingresos_totales_k');
  hPortada.texto(12, 1, 'Ingresos totales año 1 (kUSD):');
  hPortada.formula(12, 2, val('ingresos_totales_k', 1) as number, `=Proyecciones!D$${filaIng}`, Z.kusd);
  const filaNeta = filaReglaAnio('utilidad_despues_impuestos_k');
  hPortada.texto(13, 1, 'Utilidad después de impuestos año 1 (kUSD):');
  hPortada.formula(13, 2, val('utilidad_despues_impuestos_k', 1) as number, `=Proyecciones!D$${filaNeta}`, Z.kusd);
  hPortada.texto(14, 1, 'Período de recuperación:');
  hPortada.texto(14, 2, modelo.indicadores.recuperacionAnios === null ? 'No se recupera en el horizonte' : fmtAnios(modelo.indicadores.recuperacionAnios));
  hPortada.texto(15, 1, 'Nota: la recuperación se interpola linealmente sobre el flujo de caja acumulado; en Excel se exporta como valor (método documentado).', ST.nota);
  if (esDemo) {
    hPortada.texto(17, 1, 'EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS. No constituye una propuesta aprobada ni acredita el cumplimiento de requisitos legales, tributarios, sanitarios o de inversión. Validar las cifras, supuestos, autorizaciones y requisitos aplicables antes de su presentación oficial.', ST.alerta);
    hPortada.texto(18, 1, 'La tasa del impuesto sobre utilidades (35 % inicial) es un supuesto de demostración editable: no constituye la tasa legal aplicable.', ST.alerta);
  }

  // ============================================================== Resumen
  const hResumen = new Hoja();
  hResumen.texto(1, 1, 'Resumen ejecutivo', ST.titulo);
  hResumen.texto(2, 1, proyecto.resumen.introduccion.slice(0, 800));
  hResumen.texto(4, 1, 'Indicador', ST.encabezado);
  hResumen.texto(4, 2, 'Valor', ST.encabezado);
  const kpi = (f: number, et: string, v: string | number, z?: string, fml?: string) => {
    hResumen.texto(f, 1, et);
    if (fml) hResumen.formula(f, 2, v, fml, z);
    else hResumen.set(f, 2, { v, z, s: ST.formula });
  };
  kpi(5, 'Horizonte de análisis (años)', N, Z.anios);
  kpi(6, 'Inversión total (kUSD)', val('inversion_total_k', 0), Z.kusd, `=Financiacion!$D$${filaInversionTotal}`);
  kpi(7, 'Aportaciones de los socios (kUSD)', val('aportaciones_total_k', 0), Z.kusd, `=Financiacion!$D$${filaAport}`);
  kpi(8, 'Ingresos totales año 1 (kUSD)', val('ingresos_totales_k', 1), Z.kusd, `=Proyecciones!D$${filaIng}`);
  kpi(9, 'Utilidad después de impuestos año 1 (kUSD)', val('utilidad_despues_impuestos_k', 1), Z.kusd, `=Proyecciones!D$${filaNeta}`);
  kpi(10, 'Utilidad neta acumulada años 1–N (kUSD)', modelo.indicadores.utilidadNetaAcumulada, Z.kusd, `=SUM(Proyecciones!D${filaNeta}:${letraCol(2 + N)}${filaNeta})`);
  const filaBP = filaReglaAnio('total_beneficios_pais_k');
  kpi(11, 'Beneficios directos al país acumulados (kUSD)', modelo.indicadores.beneficiosPaisAcumulados, Z.kusd, `=SUM(Proyecciones!D${filaBP}:${letraCol(2 + N)}${filaBP})`);
  kpi(12, 'Período de recuperación (años)', modelo.indicadores.recuperacionAnios ?? '—', Z.anios);
  kpi(13, 'Total de trabajadores (operación)', modelo.indicadores.totalTrabajadores, '0');
  kpi(14, 'Salario promedio anual (CUP)', modelo.indicadores.salarioPromedioAnualCUP ?? '—', Z.cup);
  hResumen.texto(16, 1, 'Notas:', ST.nota);
  hResumen.texto(17, 1, proyecto.resumen.notas, ST.nota);
  if (esDemo) hResumen.texto(19, 1, 'EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS — validar cifras y supuestos antes de un uso oficial.', ST.alerta);

  // ============================================================== Parametros
  const hParam = new Hoja();
  hParam.texto(1, 1, 'Parámetros de cálculo (Nivel A)', ST.titulo);
  const encParam = ['ID', 'Nombre', 'Valor', 'Unidad', 'Descripción', 'Fuente / justificación', 'Fecha ref.'];
  encParam.forEach((e, i) => hParam.texto(2, 1 + i, e, ST.encabezado));
  proyecto.parametros.forEach((p, i) => {
    const f = 3 + i;
    hParam.texto(f, 1, p.id);
    hParam.texto(f, 2, p.nombre);
    hParam.entrada(f, 3, p.valor, p.tipo === 'porcentaje' ? Z.pct : p.tipo === 'cup' ? Z.cup : p.tipo === 'anios' ? Z.anios : Z.num);
    hParam.texto(f, 4, p.unidad);
    hParam.texto(f, 5, p.descripcion);
    hParam.texto(f, 6, p.demo ? `${p.fuente} [SUPUESTO DEMOSTRATIVO]` : p.fuente);
    hParam.texto(f, 7, p.fechaRef);
  });

  // ============================================================== Inversion
  const hInv = new Hoja();
  hInv.texto(1, 1, 'Inversiones (4.10) — detalle', ST.titulo);
  ['Concepto', 'Categoría', 'Moneda', 'Monto', 'Vida útil (años)', 'Dep. anual', 'Observación'].forEach((e, i) => hInv.texto(3, 1 + i, e, ST.encabezado));
  proyecto.financiero.inversion.forEach((r, i) => {
    const f = 4 + i;
    hInv.entrada(f, 1, r.concepto);
    hInv.entrada(f, 2, r.categoria);
    hInv.entrada(f, 3, r.moneda);
    hInv.entrada(f, 4, r.monto, Z.kusd);
    hInv.entrada(f, 5, r.vidaUtilAnios, '0');
    hInv.formula(f, 6, r.categoria === 'inversion_fija' && r.vidaUtilAnios > 0 ? r.monto / r.vidaUtilAnios : 0, `=IF(AND(B${f}="inversion_fija",E${f}>0),D${f}/E${f},0)`, Z.kusd);
    hInv.texto(f, 7, r.observacion);
  });
  const fInvFin = 3 + nInv;
  const sumaInv = (f: number, et: string, criterios: string) => {
    hInv.texto(f, 1, et, ST.total);
    hInv.formula(f, 4, 0, `=SUMIFS($D$4:$D$${fInvFin},${criterios})`, Z.kusd, ST.total);
  };
  sumaInv(fInvFin + 2, 'Subtotal gastos previos (USD)', `$B$4:$B$${fInvFin},"gastos_previos",$C$4:$C$${fInvFin},"USD"`);
  sumaInv(fInvFin + 3, 'Subtotal inversión fija (USD)', `$B$4:$B$${fInvFin},"inversion_fija",$C$4:$C$${fInvFin},"USD"`);
  sumaInv(fInvFin + 4, 'Subtotal inversión fija (CUP)', `$B$4:$B$${fInvFin},"inversion_fija",$C$4:$C$${fInvFin},"CUP"`);
  hInv.texto(fInvFin + 5, 1, 'Capital de trabajo (parámetro)', ST.total);
  hInv.formula(fInvFin + 5, 4, valorParam('capital_trabajo_k'), `=Parametros!$C$${filaParam('capital_trabajo_k')}`, Z.kusd, ST.total);
  hInv.texto(fInvFin + 6, 1, 'INVERSIÓN TOTAL (regla del motor)', ST.total);
  hInv.formula(fInvFin + 6, 4, val('inversion_total_k', 0) as number, `=Financiacion!$D$${filaInversionTotal}`, Z.kusd, ST.total);
  // Vehículos
  const fVeh = fInvFin + 8;
  hInv.texto(fVeh, 1, 'Desglose de vehículos', ST.titulo);
  ['Tipo', 'Cantidad', 'Monto (kUSD)'].forEach((e, i) => hInv.texto(fVeh + 1, 1 + i, e, ST.encabezado));
  proyecto.financiero.vehiculos.forEach((v, i) => {
    const f = fVeh + 2 + i;
    hInv.entrada(f, 1, v.tipo);
    hInv.entrada(f, 2, v.cantidad, '0');
    hInv.entrada(f, 3, v.montoKUSD, Z.kusd);
  });
  hInv.texto(fVeh + 2 + proyecto.financiero.vehiculos.length, 1, 'Total vehículos', ST.total);
  hInv.formula(fVeh + 2 + proyecto.financiero.vehiculos.length, 3, proyecto.financiero.vehiculos.reduce((s, v) => s + v.montoKUSD, 0), `=SUM(C${fVeh + 2}:C${fVeh + 1 + proyecto.financiero.vehiculos.length})`, Z.kusd, ST.total);

  // ============================================================== Aportaciones
  const hAport = new Hoja();
  hAport.texto(1, 1, 'Aportaciones de los socios (4.5) — miles de USD con un decimal', ST.titulo);
  ['Socio', 'Tipo de aporte', 'Año 1', 'Año 2', 'Año 3', 'Total', 'Referencia documental'].forEach((e, i) => hAport.texto(3, 1 + i, e, ST.encabezado));
  proyecto.aportaciones.forEach((a, i) => {
    const f = 4 + i;
    hAport.entrada(f, 1, a.socio === 'nacional' ? 'Nacional' : 'Extranjero');
    hAport.entrada(f, 2, a.tipo);
    a.montos.forEach((m, j) => hAport.entrada(f, 3 + j, m, Z.kusd));
    hAport.formula(f, 6, a.montos.reduce((s, m) => s + m, 0), `=SUM(C${f}:E${f})`, Z.kusd);
    hAport.texto(f, 7, a.referenciaDocumental + (a.tipo === 'derechos_reales' ? ' [Requiere certificación de la Dirección de Patrimonio del MFP cuando corresponda]' : ''));
  });
  if (nAport > 0) {
    const fT = 4 + nAport;
    hAport.texto(fT, 1, 'TOTAL', ST.total);
    ['C', 'D', 'E', 'F'].forEach((c) => hAport.formula(fT, c.charCodeAt(0) - 64, proyecto.aportaciones.reduce((s, a) => s + (c === 'F' ? a.montos.reduce((x, m) => x + m, 0) : a.montos[c.charCodeAt(0) - 67] ?? 0), 0), `=SUM(${c}4:${c}${fT - 1})`, Z.kusd, ST.total));
  }

  // ============================================================== Financiacion
  const hFin = new Hoja();
  hFin.texto(1, 1, 'Fuentes de financiamiento y partidas de proyecto (4.7)', ST.titulo);
  ['Concepto', 'Unidad', '', 'Valor'].forEach((e, i) => hFin.texto(3, 1 + i, e, ST.encabezado));
  for (const fr of FILAS_FINANCIACION) {
    const f = fr.fila;
    const r = reglasPorId.get(fr.id);
    hFin.texto(f, 1, fr.etiqueta, fr.negrita ? ST.total : undefined);
    hFin.texto(f, 2, 'kUSD');
    if (r) {
      const fml = traducirRegla(r, ctxAnio(3, f)); // col D (índice 3)
      if (fml) hFin.formula(f, 4, val(fr.id, 0) as number, `=${fml}`, Z.kusd, fr.negrita ? ST.total : undefined);
      else hFin.set(f, 4, { v: val(fr.id, 0), z: Z.kusd, s: ST.alerta });
    } else if (fr.id === 'CAPITAL_TRABAJO') {
      hFin.formula(f, 4, valorParam('capital_trabajo_k'), `=Parametros!$C$${filaParam('capital_trabajo_k')}`, Z.kusd);
    } else if (fr.id === 'OTRAS_FUENTES') {
      hFin.formula(f, 4, valorParam('otras_fuentes_k'), `=Parametros!$C$${filaParam('otras_fuentes_k')}`, Z.kusd);
    } else if (fr.id === 'CREDITO') {
      hFin.formula(f, 4, valorParam('credito_monto_k'), `=Parametros!$C$${filaParam('credito_monto_k')}`, Z.kusd);
    }
  }
  hFin.texto(17, 1, 'Control de suficiencia:', ST.nota);
  hFin.formula(17, 2, 'OK', `=IF(D15<-0.05,"INSUFICIENTE",IF(D15>0.05,"EXCESO","OK"))`);
  hFin.texto(18, 1, 'Condiciones del crédito: tasa, plazo de amortización y período de gracia se parametrizan en la hoja Parametros.', ST.nota);

  // ============================================================== Servicios
  const hSvc = new Hoja();
  hSvc.texto(1, 1, 'Servicios (4.6) — proyección por servicio y año (formato largo)', ST.titulo);
  ['Año', 'Servicio', 'Precio base', 'Cant. base mensual', 'Capacidad mensual', 'CVU base', 'Precio proy.', 'Cant. mensual proy.', 'Cant. anual', 'Costo unit. proy.', 'Ingreso anual (USD)', 'Costo var. total (USD)', 'Margen (USD)', 'Control capacidad'].forEach((e, i) => hSvc.texto(3, 1 + i, e, ST.encabezado));
  let fSvc = 4;
  for (const t of years) {
    if (t === 0) continue;
    for (const s of proyecto.servicios) {
      hSvc.entrada(fSvc, 1, t, '0');
      hSvc.entrada(fSvc, 2, s.nombre);
      hSvc.entrada(fSvc, 3, s.precioBase, Z.usd);
      hSvc.entrada(fSvc, 4, s.cantidadBaseMensual, '#,##0');
      hSvc.entrada(fSvc, 5, s.capacidadMaxMensual, '#,##0');
      hSvc.entrada(fSvc, 6, s.costoVariableUnitario, Z.usd);
      // G..M: fórmulas desde las reglas de ámbito servicio
      for (const idRegla of ['srv_precio_proy', 'srv_cantidad_mensual_proy', 'srv_cantidad_anual', 'srv_costo_unitario_proy', 'srv_ingreso_anual', 'srv_costo_variable_total', 'srv_margen_contribucion']) {
        const r = reglasPorId.get(idRegla)!;
        const col = COL_SERVICIO[idRegla];
        const fml = traducirRegla(r, ctxFilaServicio(fSvc));
        const vCache = modelo.servicios.find((x) => x.id === s.id)?.valores[t]?.[idRegla] ?? 0;
        if (fml) hSvc.formula(fSvc, col.charCodeAt(0) - 64, vCache, `=${fml}`, Z.usd);
        else hSvc.set(fSvc, col.charCodeAt(0) - 64, { v: Number.isFinite(vCache) ? vCache : '#ERROR', z: Z.usd, s: ST.alerta });
      }
      hSvc.formula(fSvc, 14, modelo.servicios.find((x) => x.id === s.id)?.capacidadesExcedidas.includes(t) ? 'EXCEDE' : '', `=IF(H${fSvc}>E${fSvc},"EXCEDE","")`);
      fSvc++;
    }
  }
  if (nSvc > 0) hSvc.texto(fSvc + 1, 1, 'Celdas ámbar = datos editables. Celdas verdes = fórmulas. «EXCEDE» indica cantidad proyectada por encima de la capacidad instalada.', ST.nota);

  // ============================================================== Personal
  const hPer = new Hoja();
  hPer.texto(1, 1, 'Fuerza de trabajo (4.9) — proyección por categoría y año', ST.titulo);
  ['Año', 'Etapa', 'Grupo', 'Cantidad', 'Salario base anual (CUP)', 'Salario proy. (CUP)', 'Costo (CUP)'].forEach((e, i) => hPer.texto(3, 1 + i, e, ST.encabezado));
  let fPer = 4;
  const escribirPersonal = (t: number, p: (typeof proyecto.personal)[number]) => {
    hPer.entrada(fPer, 1, t, '0');
    hPer.entrada(fPer, 2, p.etapa);
    hPer.entrada(fPer, 3, p.grupo);
    hPer.entrada(fPer, 4, p.cantidad, '0');
    hPer.entrada(fPer, 5, p.salarioPromedioAnualCUP, Z.cup);
    const rSal = reglasPorId.get('salario_anual_proy')!;
    const fml = traducirRegla(rSal, ctxFilaPersonal(fPer));
    const factor = Math.pow(1 + valorParam('crecimiento_salarios'), Math.max(0, t - 1));
    if (fml) hPer.formula(fPer, 6, p.salarioPromedioAnualCUP * factor, `=${fml}`, Z.cup);
    else hPer.entrada(fPer, 6, p.salarioPromedioAnualCUP * factor, Z.cup);
    hPer.formula(fPer, 7, p.cantidad * p.salarioPromedioAnualCUP * factor, `=D${fPer}*F${fPer}`, Z.cup);
    fPer++;
  };
  for (const p of proyecto.personal.filter((x) => x.etapa === 'montaje')) escribirPersonal(0, p);
  for (const t of years) {
    if (t === 0) continue;
    for (const p of proyecto.personal.filter((x) => x.etapa === 'operacion')) escribirPersonal(t, p);
  }
  hPer.texto(fPer + 1, 1, 'Nota: las filas de etapa «montaje» corresponden al año 0; las de «operación» a los años 1 en adelante.', ST.nota);
  hPer.texto(fPer + 2, 1, `Entidad autorizada a contratar la fuerza de trabajo: ${proyecto.fuerza.entidadContratante || '—'}`, ST.nota);

  // ============================================================== Proyecciones
  const hProy = new Hoja();
  hProy.texto(1, 1, 'Proyección de ingresos, costos, utilidades y flujos (4.7) — miles de USD', ST.titulo);
  hProy.texto(2, 1, 'Año 0 = inversión; años 1–N = operación. Celdas ámbar = entrada; verdes = fórmula con referencias entre hojas.', ST.nota);
  hProy.texto(3, 1, 'Concepto', ST.encabezado);
  hProy.texto(3, 2, 'Unidad', ST.encabezado);
  years.forEach((t) => hProy.set(3, 3 + t, { v: t, z: '0', s: ST.encabezado }));
  hProy.texto(3, 4 + N, 'Total', ST.encabezado);
  FILAS_PROYECCIONES.forEach((fp, i) => {
    const f = 4 + i;
    hProy.texto(f, 1, fp.etiqueta, fp.negrita ? ST.total : undefined);
    hProy.texto(f, 2, fp.tipo === 'regla' && fp.id.endsWith('_usd') ? 'USD' : fp.id === 'costo_laboral_cup' ? 'CUP' : 'kUSD');
    if (fp.tipo === 'entrada') {
      years.forEach((t) => hProy.entrada(f, 3 + t, t === 0 ? 0 : proyecto.financiero.otrosIngresos[t - 1] ?? 0, Z.kusd));
    } else if (fp.tipo === 'param') {
      const filaP = filaParam(fp.id);
      years.forEach((t) => hProy.formula(f, 3 + t, valorParam(fp.id), `=Parametros!$C$${filaP}`, Z.kusd));
    } else {
      const r = reglasPorId.get(fp.id);
      years.forEach((t) => {
        if (!r) return;
        // Año t vive en la columna (3+t) 1-based → índice 0-based (2+t)
        const fml = traducirRegla(r, ctxAnio(2 + t, f));
        const v = val(fp.id, t);
        if (fml) hProy.formula(f, 3 + t, v as number, `=${fml}`, Z.kusd, fp.negrita ? ST.total : undefined);
        else hProy.set(f, 3 + t, { v, z: Z.kusd, s: ST.alerta });
      });
    }
    if (!SIN_TOTAL.has(fp.id) && fp.tipo !== 'entrada') {
      hProy.formula(f, 4 + N, val(fp.id, -1) === '#ERROR' ? '#ERROR' : (sumarSerie(modelo, fp.id, years) as number), `=SUM(C${f}:${letraCol(2 + N)}${f})`, Z.kusd, ST.total);
    } else if (fp.tipo === 'entrada') {
      hProy.formula(f, 4 + N, proyecto.financiero.otrosIngresos.reduce((s, x) => s + x, 0), `=SUM(C${f}:${letraCol(2 + N)}${f})`, Z.kusd, ST.total);
    }
  });

  // ============================================================== FlujoCaja
  const hFlujo = new Hoja();
  hFlujo.texto(1, 1, 'Flujos de caja y recuperación (4.7)', ST.titulo);
  hFlujo.texto(3, 1, 'Concepto', ST.encabezado);
  years.forEach((t) => hFlujo.set(3, 2 + t, { v: t, z: '0', s: ST.encabezado }));
  const filaFlujo = (id: string, f: number, et: string) => {
    hFlujo.texto(f, 1, et, ST.total);
    years.forEach((t) => hFlujo.formula(f, 2 + t, val(id, t) as number, `=Proyecciones!${letraCol(2 + t)}$${filaReglaAnio(id)}`, Z.kusd));
  };
  filaFlujo('flujo_neto_k', 4, 'Flujo de caja neto');
  filaFlujo('flujo_acumulado_k', 5, 'Flujo de caja acumulado');
  filaFlujo('saldo_pendiente_k', 6, 'Saldo pendiente de recuperar');
  hFlujo.texto(8, 1, 'Período de recuperación (interpolación lineal del flujo acumulado):');
  hFlujo.set(8, 2, { v: modelo.indicadores.recuperacionAnios ?? 'No recuperado en el horizonte', z: Z.anios, s: ST.formula });
  hFlujo.texto(9, 1, 'Método: año previo al cruce + |acumulado previo| / (acumulado actual − acumulado previo). Exportado como valor documentado; la parte recurrente (acumulado) sí es fórmula en la hoja Proyecciones.', ST.nota);
  if (esDemo) hFlujo.texto(11, 1, 'ADVERTENCIA: ejemplo ilustrativo con datos ficticios.', ST.alerta);

  // ============================================================== BeneficiosPais
  const hBP = new Hoja();
  hBP.texto(1, 1, 'Beneficios directos al país (4.11) — miles de USD por año', ST.titulo);
  hBP.texto(3, 1, 'Concepto', ST.encabezado);
  years.forEach((t) => hBP.set(3, 2 + t, { v: t, z: '0', s: ST.encabezado }));
  hBP.texto(3, 2 + years.length, 'Total', ST.encabezado);
  const conceptosBP: { et: string; ref: () => string; v: (t: number) => number | string }[] = [
    { et: 'Impuesto sobre utilidades', ref: () => `Proyecciones!%COL%$${filaReglaAnio('impuesto_utilidades_k')}`, v: (t) => val('impuesto_utilidades_k', t) },
    { et: 'Otros impuestos, tasas y contribuciones', ref: () => `Parametros!$C$${filaParam('otros_impuestos_anual_k')}`, v: () => valorParam('otros_impuestos_anual_k') },
    { et: 'Dividendos de la parte cubana', ref: () => `Proyecciones!%COL%$${filaReglaAnio('dividendos_parte_cubana_k')}`, v: (t) => val('dividendos_parte_cubana_k', t) },
    { et: 'Aranceles', ref: () => `Parametros!$C$${filaParam('aranceles_anual_k')}`, v: () => valorParam('aranceles_anual_k') },
    { et: 'Pagos por la fuerza de trabajo', ref: () => `Proyecciones!%COL%$${filaReglaAnio('pagos_fuerza_trabajo_k')}`, v: (t) => val('pagos_fuerza_trabajo_k', t) },
    { et: 'Canon', ref: () => `Parametros!$C$${filaParam('canon_anual_k')}`, v: () => valorParam('canon_anual_k') },
    { et: 'Royalties', ref: () => `Parametros!$C$${filaParam('royalties_anual_k')}`, v: () => valorParam('royalties_anual_k') },
    { et: 'Otros ingresos', ref: () => `Parametros!$C$${filaParam('otros_beneficios_pais_k')}`, v: () => valorParam('otros_beneficios_pais_k') },
  ];
  conceptosBP.forEach((c, i) => {
    const f = 4 + i;
    hBP.texto(f, 1, c.et);
    years.forEach((t) => {
      const ref = c.ref().replace('%COL%', letraCol(1 + t));
      hBP.formula(f, 2 + t, c.v(t) as number, `=${ref}`, Z.kusd);
    });
    hBP.formula(f, 2 + years.length, sumarSerieBP(c.v, years), `=SUM(B${f}:${letraCol(1 + years.length)}${f})`, Z.kusd, ST.total);
  });
  const fTotBP = 4 + conceptosBP.length;
  hBP.texto(fTotBP, 1, 'TOTAL BENEFICIOS DIRECTOS AL PAÍS', ST.total);
  years.forEach((t) => {
    const col = letraCol(1 + t);
    hBP.formula(fTotBP, 2 + t, val('total_beneficios_pais_k', t) as number, `=SUM(${col}${4}:${col}${fTotBP - 1})`, Z.kusd, ST.total);
  });
  hBP.formula(fTotBP, 2 + years.length, modelo.indicadores.beneficiosPaisAcumulados, `=SUM(B${fTotBP}:${letraCol(1 + years.length)}${fTotBP})`, Z.kusd, ST.total);

  // ============================================================== FuerzaTrabajo
  const hFT = new Hoja();
  hFT.texto(1, 1, 'Fuerza de trabajo (4.9) — resumen', ST.titulo);
  ['Categoría', 'Cantidad', 'Salario promedio anual (CUP)'].forEach((e, i) => hFT.texto(3, 1 + i, e, ST.encabezado));
  const grupos = ['cubano_directivo', 'cubano_otro', 'extranjero_directivo', 'extranjero_otro'] as const;
  grupos.forEach((g, i) => {
    const f = 4 + i;
    hFT.texto(f, 1, g);
    hFT.formula(f, 2, modelo.indicadores.trabajadoresPorGrupo[g] ?? 0, `=SUMIFS(Personal!$D$4:$D$${3 + filasPersonal},Personal!$C$4:$C$${3 + filasPersonal},"${g}",Personal!$A$4:$A$${3 + filasPersonal},">0")`, '0');
    const filasGrupo = proyecto.personal.filter((p) => p.etapa === 'operacion' && p.grupo === g);
    const prom = filasGrupo.reduce((s, p) => s + p.cantidad * p.salarioPromedioAnualCUP, 0) / Math.max(1, filasGrupo.reduce((s, p) => s + p.cantidad, 0));
    hFT.set(f, 3, { v: filasGrupo.length ? prom : 0, z: Z.cup, s: ST.formula });
  });
  hFT.texto(8, 1, 'Total (operación)', ST.total);
  hFT.formula(8, 2, modelo.indicadores.totalTrabajadores, '=SUM(B4:B7)', '0', ST.total);
  hFT.texto(9, 1, 'Trabajadores en etapa de montaje (año 0)');
  hFT.formula(9, 2, modelo.indicadores.trabajadoresMontaje, `=SUMIFS(Personal!$D$4:$D$${3 + filasPersonal},Personal!$A$4:$A$${3 + filasPersonal},0)`, '0');
  hFT.texto(10, 1, 'Salario promedio anual ponderado (CUP)');
  hFT.set(10, 2, { v: modelo.indicadores.salarioPromedioAnualCUP ?? 0, z: Z.cup, s: ST.formula });
  hFT.texto(12, 1, `Entidad autorizada a contratar: ${proyecto.fuerza.entidadContratante || '—'}`, ST.nota);

  // ============================================================== Cronograma / Consumos / Mercado / Descripcion / Reglas / Controles
  const hCro = new Hoja();
  hCro.texto(1, 1, 'Cronograma inversionista (4.10)', ST.titulo);
  ['Etapa', 'Inicio', 'Fin', 'Observación'].forEach((e, i) => hCro.texto(3, 1 + i, e, ST.encabezado));
  proyecto.cronograma.forEach((c, i) => {
    const f = 4 + i;
    hCro.entrada(f, 1, c.etapa);
    hCro.entrada(f, 2, c.inicio);
    hCro.entrada(f, 3, c.fin);
    hCro.entrada(f, 4, c.observacion);
  });

  const hCons = new Hoja();
  hCons.texto(1, 1, 'Consumos técnicos (4.6)', ST.titulo);
  ['Concepto', 'Unidad', 'Cantidad', 'Período', 'Observación'].forEach((e, i) => hCons.texto(3, 1 + i, e, ST.encabezado));
  proyecto.consumos.forEach((c, i) => {
    const f = 4 + i;
    hCons.entrada(f, 1, c.concepto);
    hCons.entrada(f, 2, c.unidad);
    hCons.entrada(f, 3, c.cantidad, '#,##0.0');
    hCons.entrada(f, 4, c.periodo);
    hCons.entrada(f, 5, c.observacion);
  });
  const tecnicas: [string, string][] = [
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
  let fCons = 5 + proyecto.consumos.length;
  hCons.texto(fCons, 1, 'Notas técnicas', ST.titulo);
  tecnicas.forEach(([k, v], i) => {
    hCons.texto(fCons + 1 + i, 1, k);
    hCons.texto(fCons + 1 + i, 2, v);
  });

  const hMer = new Hoja();
  hMer.texto(1, 1, 'Análisis de mercado (4.8)', ST.titulo);
  const mercado: [string, string][] = [
    ['Caracterización de productos y servicios', proyecto.mercado.caracterizacion],
    ['Requisitos regulatorios y registros', proyecto.mercado.requisitosRegulatorios],
    ['Materias primas y materiales auxiliares', proyecto.mercado.materiasPrimas],
    ['Fuentes y ubicación de suministros', proyecto.mercado.fuentesSuministro],
    ['Consumo estimado', proyecto.mercado.consumoEstimado],
    ['Demanda aparente', proyecto.mercado.demandaAparente],
    ['Demanda solvente', proyecto.mercado.demandaSolvente],
    ['Método de estimación', proyecto.mercado.metodoEstimacion],
    ['Fuentes consultadas (con fecha)', proyecto.mercado.fuentesConsulta],
    ['Comercialización: exportaciones', proyecto.mercado.ventasExportacion],
    ['Comercialización: divisas', proyecto.mercado.ventasDivisas],
    ['Comercialización: moneda nacional', proyecto.mercado.ventasMonedaNacional],
  ];
  mercado.forEach(([k, v], i) => {
    hMer.texto(3 + i, 1, k, ST.encabezado);
    hMer.texto(3 + i, 2, v);
  });

  const hDes = new Hoja();
  hDes.texto(1, 1, 'Descripción del negocio (4.1, 4.2, 4.5, 4.12)', ST.titulo);
  const descripcion: [string, string][] = [
    ['Elaborado por', proyecto.general.elaboradoPor],
    ['Cargo', proyecto.general.cargo],
    ['Fecha', proyecto.general.fecha],
    ['Declaración de responsabilidad', proyecto.general.declaracionResponsabilidad ? 'Aceptada' : 'Pendiente'],
    ['Nombre del proyecto', proyecto.titulo.nombreProyecto],
    ['Denominación de la propuesta', proyecto.titulo.denominacionPropuesta],
    ['Modalidad de inversión', proyecto.negocio.modalidad],
    ['Objeto social o contractual', proyecto.negocio.objetoSocial],
    ['Plazo de vigencia', proyecto.negocio.plazoVigencia],
    ['Fundamentación y propuesta de valor', proyecto.negocio.fundamentacion],
    ['Relación con objetivos de la inversión extranjera', proyecto.negocio.objetivosInversion],
    ['Relación con el PNDES', proyecto.negocio.relacionPNDES],
    ['Relación con la estrategia territorial', proyecto.negocio.relacionEDT],
    ['Bienes y servicios', proyecto.negocio.bienesServicios],
    ['Mercado interno', proyecto.negocio.mercadoInterno],
    ['Mercado externo', proyecto.negocio.mercadoExterno],
    ['Regla de distribución de beneficios', proyecto.negocio.reglaDistribucion],
    ['Inversionista extranjero — nombre', proyecto.inversionistaExtranjero.nombre],
    ['Inversionista extranjero — domicilio', proyecto.inversionistaExtranjero.domicilio],
    ['Inversionista extranjero — identificación fiscal', proyecto.inversionistaExtranjero.identificacionFiscal],
    ['Inversionista extranjero — experiencia', proyecto.inversionistaExtranjero.experiencia],
    ['Inversionista extranjero — vinculación con Cuba', proyecto.inversionistaExtranjero.vinculacionCuba],
    ['Inversionista nacional — nombre', proyecto.inversionistaNacional.nombre],
    ['Inversionista nacional — domicilio', proyecto.inversionistaNacional.domicilio],
    ['Inversionista nacional — identificación fiscal', proyecto.inversionistaNacional.identificacionFiscal],
    ['Inversionista nacional — experiencia', proyecto.inversionistaNacional.experiencia],
    ['Inversionista nacional — vinculación con Cuba', proyecto.inversionistaNacional.vinculacionCuba],
    ['Conclusiones', proyecto.conclusiones.texto],
  ];
  descripcion.forEach(([k, v], i) => {
    hDes.texto(3 + i, 1, k, ST.encabezado);
    hDes.texto(3 + i, 2, v);
  });

  const hReg = new Hoja();
  hReg.texto(1, 1, 'Configuración de cálculos (3.1/3.2) — reglas activas', ST.titulo);
  ['ID', 'Nombre', 'Categoría', 'Ámbito', 'Unidad', 'Habilitada', 'Expresión activa (motor PLANEX)', 'Equivalente Excel (año 1)', 'Estado'].forEach((e, i) => hReg.texto(3, 1 + i, e, ST.encabezado));
  proyecto.reglas.forEach((r, i) => {
    const f = 4 + i;
    hReg.texto(f, 1, r.id);
    hReg.texto(f, 2, r.nombre);
    hReg.texto(f, 3, r.categoria);
    hReg.texto(f, 4, r.ambito);
    hReg.texto(f, 5, r.unidad);
    hReg.texto(f, 6, r.habilitada ? 'Sí' : 'No');
    hReg.texto(f, 7, r.expresion + (r.modificada ? '  [MODIFICADA por el usuario]' : ''));
    let estado = r.habilitada ? 'TRADUCIDA' : 'DESHABILITADA';
    if (!r.habilitada) {
      hReg.texto(f, 8, '—');
    } else {
      const yaRegistrada = noTraducibles.some((x) => x.id === r.id);
      try {
        const ast = parsear(r.expresion);
        const ctx =
          r.ambito === 'anio'
            ? ctxAnio(3, filaReglaAnio(r.id) > 0 ? filaReglaAnio(r.id) : 4)
            : r.ambito === 'servicio'
              ? ctxFilaServicio(4)
              : r.ambito === 'personal'
                ? ctxFilaPersonal(4)
                : ctxAnio(3, FILAS_FINANCIACION.find((x) => x.id === r.id)?.fila ?? 4);
        const fml = traducir(ast, ctx);
        hReg.texto(f, 8, `=${fml}`);
        void yaRegistrada;
      } catch {
        estado = noTraducibles.some((x) => x.id === r.id) ? 'NO TRADUCIBLE (valor estático + nota)' : 'TRADUCIDA PARCIALMENTE';
        hReg.texto(f, 8, 'NO TRADUCIBLE: se exporta el valor calculado por el motor; la fórmula activa solo es equivalente dentro de la aplicación.');
      }
    }
    hReg.texto(f, 9, estado);
  });
  hReg.texto(5 + proyecto.reglas.length, 1, 'Los parámetros (Nivel A) viven en la hoja Parametros y las fórmulas los referencian con referencias absolutas.', ST.nota);

  const hCtrl = new Hoja();
  hCtrl.texto(1, 1, 'Controles de consistencia', ST.titulo);
  ['Control', 'Resultado', 'Criterio'].forEach((e, i) => hCtrl.texto(3, 1 + i, e, ST.encabezado));
  hCtrl.texto(4, 1, 'Suficiencia de la financiación');
  hCtrl.formula(4, 2, 'OK', `=IF(Financiacion!$D$15<-0.05,"INSUFICIENTE",IF(Financiacion!$D$15>0.05,"EXCESO","OK"))`);
  hCtrl.texto(4, 3, 'Diferencia de financiación entre −0,05 y +0,05 kUSD');
  hCtrl.texto(5, 1, 'Servicios por encima de la capacidad instalada');
  hCtrl.formula(5, 2, 0, `=COUNTIF(Servicios!$N$4:$N$${3 + nSvc * N},"EXCEDE")`, '0');
  hCtrl.texto(5, 3, 'Recuento de filas «EXCEDE» = 0');
  hCtrl.texto(6, 1, 'Monedas no válidas en inversiones');
  hCtrl.formula(6, 2, 0, `=SUMPRODUCT((Inversion!$C$4:$C$${3 + nInv}<>"USD")*(Inversion!$C$4:$C$${3 + nInv}<>"CUP"))`, '0');
  hCtrl.texto(6, 3, 'Solo se admiten USD y CUP');
  hCtrl.texto(7, 1, 'Inversión fija sin vida útil');
  hCtrl.formula(7, 2, proyecto.financiero.inversion.filter((x) => x.categoria === 'inversion_fija' && x.vidaUtilAnios <= 0).length, `=SUMPRODUCT((Inversion!$B$4:$B$${3 + nInv}="inversion_fija")*(Inversion!$E$4:$E$${3 + nInv}<=0))`, '0');
  hCtrl.texto(7, 3, 'Partidas fijas con vida útil > 0');
  const fUAI = filaReglaAnio('utilidad_antes_impuestos_k');
  const fImp = filaReglaAnio('impuesto_utilidades_k');
  hCtrl.texto(8, 1, 'Coherencia del impuesto con la regla activa');
  hCtrl.formula(8, 2, 'OK', `=IF(ABS(Proyecciones!D${fImp}-MAX(0,Proyecciones!D${fUAI}*Parametros!$C$${filaParam('tasa_impuesto_utilidades')}))<=0.05,"OK","REVISAR FÓRMULA")`);
  hCtrl.texto(8, 3, 'Impuesto (año 1) = MAX(0; UAI × tasa) — si cambió la fórmula, revise este control');
  hCtrl.texto(10, 1, 'ADVERTENCIA: este libro refleja reglas y parámetros activos al exportar. Los valores marcados NO TRADUCIBLE se exportan estáticos y documentados.', ST.nota);
  if (esDemo) hCtrl.texto(11, 1, 'EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS.', ST.alerta);

  // ============================================================== libro
  const wb = XLSX.utils.book_new();
  const agregar = (h: Hoja, nombre: string, anchos?: number[]) => {
    const ws = h.aHoja();
    if (anchos) ws['!cols'] = anchos.map((w) => ({ wch: w }));
    if (nSvc > 0 && nombre === 'Servicios') ws['!autofilter'] = { ref: `A3:N${3 + nSvc * N}` };
    if (nInv > 0 && nombre === 'Inversion') ws['!autofilter'] = { ref: `A3:G${3 + nInv}` };
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  };
  agregar(hPortada, 'Portada', [42, 60]);
  agregar(hResumen, 'Resumen', [46, 20]);
  agregar(hParam, 'Parametros', [30, 40, 12, 10, 70, 60, 12]);
  agregar(hInv, 'Inversion', [52, 16, 10, 12, 14, 12, 40]);
  agregar(hAport, 'Aportaciones', [14, 26, 12, 12, 12, 12, 60]);
  agregar(hFin, 'Financiacion', [48, 10, 4, 14]);
  agregar(hSvc, 'Servicios', [6, 38, 12, 14, 14, 10, 12, 14, 12, 14, 16, 16, 14, 14]);
  agregar(hPer, 'Personal', [6, 12, 22, 10, 22, 18, 16]);
  agregar(hProy, 'Proyecciones', [44, 8, ...years.map(() => 11), 12]);
  agregar(hFlujo, 'FlujoCaja', [46, ...years.map(() => 11)]);
  agregar(hBP, 'BeneficiosPais', [40, ...years.map(() => 11), 12]);
  agregar(hFT, 'FuerzaTrabajo', [40, 12, 24]);
  agregar(hCro, 'Cronograma', [42, 10, 10, 40]);
  agregar(hCons, 'ConsumosTecnicos', [34, 12, 12, 14, 40]);
  agregar(hMer, 'Mercado', [40, 90]);
  agregar(hDes, 'Descripcion', [40, 90]);
  agregar(hReg, 'Reglas', [26, 34, 20, 10, 12, 11, 80, 80, 22]);
  agregar(hCtrl, 'Controles', [40, 16, 60]);

  wb.Props = { Title: proyecto.titulo.nombreProyecto || proyecto.nombre, Author: 'PLANEX Cuba', CreatedDate: new Date() };

  let datos = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  datos = await activarRecalculoAutomatico(datos);
  return { datos, nombre: `${(proyecto.titulo.nombreProyecto || proyecto.nombre).slice(0, 40)}.xlsx`, noTraducibles };
}

function sumarSerie(modelo: ComputedModel, id: string, years: number[]): number {
  let s = 0;
  for (const t of years) {
    const v = modelo.valores[id]?.[t];
    if (Number.isFinite(v)) s += v as number;
  }
  return s;
}

function sumarSerieBP(v: (t: number) => number | string, years: number[]): number {
  let s = 0;
  for (const t of years) {
    const x = v(t);
    if (typeof x === 'number') s += x;
  }
  return s;
}
