// ============================================================================
// Exportador XLSX — libro Excel auténtico con FÓRMULAS REALES y referencias
// entre hojas. Esquema 2.0.0 (misión PLANEX-AUDIT-001 §14.3):
//
//  - Hojas nuevas con fórmulas reales:
//      Depreciacion  → calendario por activo (vida útil, disponibilidad,
//                      residual; MIN contra el importe depreciable).
//      Deuda         → calendario financiero completo (desembolso, gracia
//                      principal/total con capitalización, tres métodos:
//                      capital constante, francés con PMT y pago único).
//      FlujosCaja    → FCFF y FCFE con acumulados, CAPEX de ampliaciones,
//                      recuperación del capital de trabajo y períodos de
//                      recuperación calculados con fórmulas de interpolación.
//      Dividendos    → módulo completo (base, reserva, distribuible, propuestos,
//                      caja, pagables, por socio, saldo acumulable).
//      Capacidad     → recursos, ampliaciones, demanda compartida con
//                      SUMPRODUCT por banderas, escala pro-rata, capacidad
//                      teórica y cantidad real por servicio-año.
//  - Las reglas que usan el motor (mtr_*) se traducen con referencias reales
//    a esas hojas (traductor.refMotor). Las no traducibles se documentan.
//  - Controles con los CUATRO niveles de severidad del diagnóstico.
//
// El libro se configura con recálculo automático al abrir (fullCalcOnLoad).
// ============================================================================

import * as XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import { PlanexProject, ComputedModel, Regla, ADVERTENCIA_DATOS_FICTICIOS } from '../types';
import { parsear } from '../engine/parser';
import { traducir, NoTraducible, letraCol, COL_SERVICIO, COL_PERSONAL, CtxTraduccion } from '../excel/traductor';
import { diagnosticar } from '../model/controles';
import { fmtAnios, fmtK } from '../format';

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
  error: { fill: { patternType: 'solid', fgColor: { rgb: 'F4CCCC' } }, font: { bold: true, color: { rgb: '990000' }, sz: 9 } },
  advertencia: { fill: { patternType: 'solid', fgColor: { rgb: 'FCE5CD' } }, font: { color: { rgb: '974706' }, sz: 9 } },
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
      if (!cel.f && (cel.v === '' || cel.v === null)) celda.t = 'z';
      ws[addr] = celda as unknown as XLSX.CellObject;
    }
    return ws;
  }
}

interface FilaProyeccion {
  tipo: 'regla' | 'entrada';
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
  { tipo: 'regla', id: 'canon_k', etiqueta: 'Canon (años de operación)' },
  { tipo: 'regla', id: 'mantenimiento_k', etiqueta: 'Mantenimiento (años de operación)' },
  { tipo: 'regla', id: 'servicios_publicos_k', etiqueta: 'Servicios públicos (años de operación)' },
  { tipo: 'regla', id: 'gastos_admin_k', etiqueta: 'Gastos administrativos' },
  { tipo: 'regla', id: 'otros_gastos_k', etiqueta: 'Otros gastos fijos (años de operación)' },
  { tipo: 'regla', id: 'depreciacion_anual_k', etiqueta: 'Depreciación (calendario por activo)' },
  { tipo: 'regla', id: 'interes_k', etiqueta: 'Intereses del crédito (devengados)' },
  { tipo: 'regla', id: 'amortizacion_k', etiqueta: 'Amortización del principal' },
  { tipo: 'regla', id: 'saldo_deuda_k', etiqueta: 'Saldo de la deuda (fin de año)' },
  { tipo: 'regla', id: 'costos_totales_k', etiqueta: 'COSTOS Y GASTOS TOTALES', negrita: true },
  { tipo: 'regla', id: 'utilidad_antes_impuestos_k', etiqueta: 'UTILIDAD ANTES DE IMPUESTOS', negrita: true },
  { tipo: 'regla', id: 'impuesto_utilidades_k', etiqueta: 'Impuesto sobre utilidades (regla demostrativa)' },
  { tipo: 'regla', id: 'utilidad_despues_impuestos_k', etiqueta: 'UTILIDAD DESPUÉS DE IMPUESTOS (3-4)', negrita: true },
  { tipo: 'regla', id: 'flujo_proyecto_k', etiqueta: 'FLUJO DE CAJA DEL PROYECTO (FCFF)', negrita: true },
  { tipo: 'regla', id: 'flujo_acumulado_proyecto_k', etiqueta: 'FLUJO ACUMULADO DEL PROYECTO', negrita: true },
  { tipo: 'regla', id: 'saldo_pendiente_proyecto_k', etiqueta: 'Saldo pendiente (inversión total)' },
  { tipo: 'regla', id: 'flujo_socios_k', etiqueta: 'FLUJO DE CAJA DE LOS SOCIOS (FCFE)', negrita: true },
  { tipo: 'regla', id: 'flujo_acumulado_socios_k', etiqueta: 'FLUJO ACUMULADO DE LOS SOCIOS', negrita: true },
  { tipo: 'regla', id: 'saldo_pendiente_socios_k', etiqueta: 'Saldo pendiente (capital aportado)' },
  { tipo: 'regla', id: 'dividendos_pagables_k', etiqueta: 'Dividendos pagables' },
  { tipo: 'regla', id: 'dividendos_parte_cubana_k', etiqueta: 'Dividendos de la parte cubana' },
  { tipo: 'regla', id: 'pagos_fuerza_trabajo_k', etiqueta: 'Pagos por la fuerza de trabajo' },
  { tipo: 'regla', id: 'otros_impuestos_k', etiqueta: 'Otros impuestos (años de operación)' },
  { tipo: 'regla', id: 'aranceles_k', etiqueta: 'Aranceles (años de operación)' },
  { tipo: 'regla', id: 'royalties_k', etiqueta: 'Royalties (años de operación)' },
  { tipo: 'regla', id: 'otros_beneficios_pais_k', etiqueta: 'Otros ingresos al país (años de operación)' },
  { tipo: 'regla', id: 'total_beneficios_pais_k', etiqueta: 'TOTAL BENEFICIOS DIRECTOS AL PAÍS', negrita: true },
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

const SIN_TOTAL = new Set(['saldo_deuda_k', 'flujo_acumulado_proyecto_k', 'flujo_acumulado_socios_k']);

export interface ResultadoXLSX {
  datos: ArrayBuffer;
  nombre: string;
  noTraducibles: { id: string; nombre: string; motivo: string }[];
}

/** Inyecta <calcPr fullCalcOnLoad="1"/> para recalcular al abrir. */
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
  // STORE (sin compresión): garantiza que el marcador fullCalcOnLoad y las
  // fórmulas sean verificables en el archivo crudo (misión §16.7) y evita
  // dependencias del descompresor para las auditorías del libro.
  const salida = await zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' });
  return salida as ArrayBuffer;
}

export async function exportarXLSX(proyecto: PlanexProject, modelo: ComputedModel): Promise<ResultadoXLSX> {
  const N = proyecto.ajustes.horizonteAnios;
  const years = modelo.years;
  const noTraducibles: ResultadoXLSX['noTraducibles'] = [];
  const esDemo = proyecto.planex.plantillaOrigen === 'clinica' || proyecto.planex.plantillaOrigen === 'centro';

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
  const nRec = proyecto.recursos.length;
  const filasServiciosSheet = nSvc * N; // años 1..N
  const rangoServicios: [number, number] = filasServiciosSheet ? [4, 3 + filasServiciosSheet] : [4, 4];
  const filasPersonal = proyecto.personal.filter((p) => p.etapa === 'montaje').length + proyecto.personal.filter((p) => p.etapa === 'operacion').length * N;
  const rangoPersonal: [number, number] = filasPersonal ? [4, 3 + filasPersonal] : [4, 4];

  // Filas de las hojas nuevas (1-based).
  const FILA_DEP_TOTAL = 4 + modelo.depreciacion.length;
  const FilaDeudaAnio = (t: number) => 4 + t; // hoja Deuda: una fila por año
  const F_ROW = { fcff: 4, fcffAcum: 5, fcfe: 6, fcfeAcum: 7, saldoP: 8, saldoS: 9, cruceP: 11, cruceS: 12, recP: 14, recS: 15, capexAmp: 16, recCT: 17 };
  const F_ROW_DIV = { udi: 4, saldoPrev: 5, base: 6, reserva: 7, distribuible: 8, propuestos: 9, caja: 10, pagables: 11, nacional: 12, extranjero: 13, saldo: 14 };
  const colYear = (t: number) => letraCol(1 + t); // FlujosCaja/Dividendos: B=0…
  const colYearProy = (t: number) => letraCol(2 + t); // Proyecciones: C=0…
  const colYearDep = (t: number) => letraCol(8 + t); // Depreciacion: I=0…

  // Bloques de la hoja Capacidad.
  const capFin = 3 + filasServiciosSheet;
  const fCapRecursos = capFin + 3; // encabezado recursos
  const fCapBloque3 = fCapRecursos + nRec + 3; // por recurso: 4 filas (disp, dem, escala, util)
  const fCapExpansiones = fCapBloque3 + nRec * 4 + 3;

  /** Referencias Excel de las variables del motor (ámbito anual). */
  const refMotor = (nombre: string, t: number): string => {
    const fD = FilaDeudaAnio(t);
    switch (nombre) {
      case 'mtr_depreciacion_k':
        return `Depreciacion!${colYearDep(t)}$${FILA_DEP_TOTAL}`;
      case 'mtr_amortizacion_k':
        return `Deuda!$F$${fD}`;
      case 'mtr_interes_devengado_k':
        return `Deuda!$D$${fD}`;
      case 'mtr_interes_pagado_k':
        return `Deuda!$G$${fD}`;
      case 'mtr_desembolso_credito_k':
        return `Deuda!$C$${fD}`;
      case 'mtr_saldo_deuda_k':
        return `Deuda!$H$${fD}`;
      case 'mtr_fcff_k':
        return `FlujosCaja!${colYear(t)}$${F_ROW.fcff}`;
      case 'mtr_fcfe_k':
        return `FlujosCaja!${colYear(t)}$${F_ROW.fcfe}`;
      case 'mtr_fcfe_acum_k':
        return `FlujosCaja!${colYear(t)}$${F_ROW.fcfeAcum}`;
      case 'mtr_dividendos_pagables_k':
        return `Dividendos!${colYear(t)}$${F_ROW_DIV.pagables}`;
      case 'mtr_dividendos_nacional_k':
        return `Dividendos!${colYear(t)}$${F_ROW_DIV.nacional}`;
      case 'mtr_dividendos_extranjero_k':
        return `Dividendos!${colYear(t)}$${F_ROW_DIV.extranjero}`;
      case 'mtr_caja_dividendos_k':
        return `Dividendos!${colYear(t)}$${F_ROW_DIV.caja}`;
      case 'mtr_capex_ampliaciones_k':
        return `FlujosCaja!${colYear(t)}$${F_ROW.capexAmp}`;
      case 'mtr_recuperacion_ct_k':
        return `FlujosCaja!${colYear(t)}$${F_ROW.recCT}`;
      default:
        throw new NoTraducible(`Variable del motor «${nombre}» sin hoja de respreso`);
    }
  };
  const refMotorServicio = (nombre: string, fila: number): string => {
    switch (nombre) {
      case 'mtr_capacidad_mensual':
        return `Capacidad!$D$${fila}`;
      case 'mtr_cantidad_real_mensual':
        return `Capacidad!$E$${fila}`;
      case 'mtr_utilizacion_capacidad':
        return `Capacidad!$F$${fila}`;
      default:
        throw new NoTraducible(`Variable del motor de servicio «${nombre}» sin equivalente`);
    }
  };

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
    refMotor,
    refMotorServicio,
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
    refMotor,
    refMotorServicio,
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
    refMotor,
    refMotorServicio,
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
  hPortada.texto(2, 1, 'Metodología: Bases metodológicas GOC-2026-O57 (epígrafes 4.1–4.12) · Esquema 2.0.0', ST.subtitulo);
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
  hPortada.texto(14, 1, 'Recuperación de la INVERSIÓN TOTAL (FCFF, años):');
  hPortada.formula(14, 2, modelo.indicadores.recuperacionProyecto.anios ?? 'No se recupera en el horizonte', `=FlujosCaja!$B$${F_ROW.recP}`, Z.anios);
  hPortada.texto(15, 1, 'Recuperación del CAPITAL APORTADO (FCFE, años):');
  hPortada.formula(15, 2, modelo.indicadores.recuperacionSocios.anios ?? 'No se recupera en el horizonte', `=FlujosCaja!$B$${F_ROW.recS}`, Z.anios);
  hPortada.texto(16, 1, 'Ambos indicadores se calculan en la hoja FlujosCaja por interpolación lineal del acumulado correspondiente.', ST.nota);
  if (esDemo) {
    hPortada.texto(18, 1, ADVERTENCIA_DATOS_FICTICIOS, ST.alerta);
    hPortada.texto(19, 1, 'La tasa del impuesto sobre utilidades es un supuesto de demostración editable: no constituye la tasa legal aplicable.', ST.alerta);
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
  kpi(11, 'Beneficios directos al país — período completo (kUSD)', modelo.indicadores.beneficiosPaisAcumulados, Z.kusd, `=SUM(Proyecciones!C${filaBP}:${letraCol(2 + N)}${filaBP})`);
  kpi(12, 'Beneficios directos al país — explotación, años 1–N (kUSD)', modelo.indicadores.beneficiosPaisExplotacion, Z.kusd, `=SUM(Proyecciones!D${filaBP}:${letraCol(2 + N)}${filaBP})`);
  kpi(13, 'Recuperación de la inversión total (FCFF, años)', modelo.indicadores.recuperacionProyecto.anios ?? '—', Z.anios, `=FlujosCaja!$B$${F_ROW.recP}`);
  kpi(14, 'Recuperación del capital aportado (FCFE, años)', modelo.indicadores.recuperacionSocios.anios ?? '—', Z.anios, `=FlujosCaja!$B$${F_ROW.recS}`);
  kpi(15, 'Total de trabajadores (operación)', modelo.indicadores.totalTrabajadores, '0');
  kpi(16, 'Salario promedio anual (CUP)', modelo.indicadores.salarioPromedioAnualCUP ?? '—', Z.cup);
  // Versión textual es-ES de las recuperaciones (misión §16.7: sin valores
  // antiguos; el texto siempre refleja el modelo vigente con un decimal).
  hResumen.set(17, 1, { v: 'Recuperación FCFF (años, texto)', s: ST.nota });
  hResumen.set(17, 2, { v: modelo.indicadores.recuperacionProyecto.anios !== null ? fmtK(modelo.indicadores.recuperacionProyecto.anios) : 'No se recupera', s: ST.formula });
  hResumen.set(18, 1, { v: 'Recuperación FCFE (años, texto)', s: ST.nota });
  hResumen.set(18, 2, { v: modelo.indicadores.recuperacionSocios.anios !== null ? fmtK(modelo.indicadores.recuperacionSocios.anios) : 'No se recupera', s: ST.formula });
  hResumen.texto(20, 1, 'Notas:', ST.nota);
  hResumen.texto(21, 1, proyecto.resumen.notas, ST.nota);
  hResumen.texto(22, 1, 'Los beneficios al país usan el MISMO cálculo en resumen y tabla (período completo incluye el año 0; el subtotal de explotación se etiqueta aparte).', ST.nota);
  if (esDemo) hResumen.texto(23, 1, 'EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS — validar cifras y supuestos antes de un uso oficial.', ST.alerta);

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
  hInv.texto(1, 1, 'Inversiones (4.10) — registro de activos', ST.titulo);
  ['Concepto', 'Categoría', 'Moneda', 'Monto', 'Vida útil (años)', 'Disponible desde año', 'Residual %', 'Dep. anual (calendario)', 'Observación'].forEach((e, i) => hInv.texto(3, 1 + i, e, ST.encabezado));
  proyecto.financiero.inversion.forEach((r, i) => {
    const f = 4 + i;
    hInv.entrada(f, 1, r.concepto);
    hInv.entrada(f, 2, r.categoria);
    hInv.entrada(f, 3, r.moneda);
    hInv.entrada(f, 4, r.monto, Z.kusd);
    hInv.entrada(f, 5, r.vidaUtilAnios, '0');
    hInv.entrada(f, 6, r.anioDisponible, '0');
    hInv.entrada(f, 7, r.valorResidualPct, Z.pct);
    hInv.formula(
      f,
      8,
      r.categoria === 'inversion_fija' && r.vidaUtilAnios > 0 && r.metodoDepreciacion !== 'ninguno' ? r.monto * (1 - r.valorResidualPct) / r.vidaUtilAnios : 0,
      `=IF(AND(B${f}="inversion_fija",E${f}>0),IF(C${f}="CUP",D${f}/Parametros!$C$${filaParam('tipo_cambio')},D${f})*(1-G${f})/E${f},0)`,
      Z.kusd
    );
    hInv.texto(f, 9, r.observacion);
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

  // ============================================================== Depreciacion
  const hDep = new Hoja();
  hDep.texto(1, 1, 'Depreciación por activo (misión §5) — miles de USD', ST.titulo);
  hDep.texto(2, 1, 'Método lineal por activo: cuota = base × (1 − residual) / vida; deprecia solo desde el año de disponibilidad y la acumulada se limita a la base depreciable (MIN contra lo acumulado).', ST.nota);
  const encDep = ['ID', 'Concepto', 'Moneda', 'Monto', 'Vida útil', 'Disponible', 'Residual %', 'Base depreciable', ...years.map((t) => (t === 0 ? 'Año 0' : `Año ${t}`)), 'Acumulada', 'VNL'];
  encDep.forEach((e, i) => hDep.texto(3, 1 + i, e, ST.encabezado));
  modelo.depreciacion.forEach((a, i) => {
    const f = 4 + i;
    const filaInv = proyecto.financiero.inversion.find((r) => r.id === a.id);
    hDep.texto(f, 1, a.id);
    hDep.texto(f, 2, a.concepto);
    hDep.texto(f, 3, filaInv?.moneda ?? 'USD');
    hDep.formula(f, 4, filaInv?.monto ?? 0, `=Inversion!$D$${filaInv ? 4 + proyecto.financiero.inversion.indexOf(filaInv) : 4}`, Z.kusd);
    hDep.formula(f, 5, a.vidaUtilAnios, `=Inversion!$E$${filaInv ? 4 + proyecto.financiero.inversion.indexOf(filaInv) : 4}`, '0');
    hDep.formula(f, 6, a.anioDisponible, `=Inversion!$F$${filaInv ? 4 + proyecto.financiero.inversion.indexOf(filaInv) : 4}`, '0');
    hDep.formula(f, 7, a.valorResidualPct, `=Inversion!$G$${filaInv ? 4 + proyecto.financiero.inversion.indexOf(filaInv) : 4}`, Z.pct);
    const fInv0 = filaInv ? 4 + proyecto.financiero.inversion.indexOf(filaInv) : 4;
    hDep.formula(f, 8, a.baseDepreciableKUSD, `=IF(C${f}="CUP",D${f}/Parametros!$C$${filaParam('tipo_cambio')},D${f})*(1-G${f})`, Z.kusd);
    // Fórmulas por año: activo nuevo (ampliación) → fila estática de entrada.
    for (let t = 0; t <= N; t++) {
      const col = 9 + t; // 1-based: I=9
      const acumAnterior = t === 0 ? 0 : null;
      let fml: string;
      const yearHeader = `${colYearDep(t)}$3`;
      if (filaInv) {
        fml =
          t === 0
            ? `=IF(AND(${yearHeader}>=$F${f},${yearHeader}<$F${f}+$E${f}),MIN($H${f}/$E${f},$H${f}),0)`
            : `=IF(AND(${yearHeader}>=$F${f},${yearHeader}<$F${f}+$E${f}),MIN($H${f}/$E${f},$H${f}-SUM($I${f}:${letraCol(8 + t - 1)}${f})),0)`;
      } else {
        // Ampliación del escenario B: entrada estática propia (id, año, costo, vida).
        const amp = modelo.depreciacion[i];
        const anio = amp.anioDisponible;
        const vida = Math.max(1, amp.vidaUtilAnios);
        const base = amp.baseDepreciableKUSD;
        fml =
          t === 0
            ? `=IF(AND(${yearHeader}>=${anio},${yearHeader}<${anio + vida}),MIN(${base}/${vida},${base}),0)`
            : `=IF(AND(${yearHeader}>=${anio},${yearHeader}<${anio + vida}),MIN(${base}/${vida},${base}-SUM($I${f}:${letraCol(8 + t - 1)}${f})),0)`;
      }
      void acumAnterior;
      hDep.formula(f, col, a.depreciacion[t] ?? 0, fml, Z.kusd);
    }
    hDep.formula(f, 9 + N + 1, a.acumulada, `=SUM(I${f}:${letraCol(8 + N)}${f})`, Z.kusd, ST.total);
    hDep.formula(f, 9 + N + 2, a.vnl, `=$H${f}-${letraCol(9 + N)}${f}`, Z.kusd);
  });
  hDep.texto(FILA_DEP_TOTAL, 2, 'TOTAL DEPRECIACIÓN (mtr_depreciacion_k)', ST.total);
  for (let t = 0; t <= N; t++) {
    hDep.formula(FILA_DEP_TOTAL, 9 + t, modelo.depreciacionTotal[t] ?? 0, `=SUM(${colYearDep(t)}4:${colYearDep(t)}${FILA_DEP_TOTAL - 1})`, Z.kusd, ST.total);
  }
  hDep.texto(FILA_DEP_TOTAL + 2, 1, 'La acumulada de cada activo se limita a su base depreciable; un activo sin vida útil definida no deprecia (el diagnóstico lo advierte). Los activos nuevos de ampliaciones (escenario B) deprecian desde su año de ejecución.', ST.nota);
  if (modelo.depreciacion.some((a) => a.vnl > 0.01)) {
    hDep.texto(FILA_DEP_TOTAL + 3, 1, `Hay ${modelo.depreciacion.filter((a) => a.vnl > 0.01).length} activo(s) con valor neto en libros al cierre (vidas útiles que exceden el horizonte): el plan debe declarar su tratamiento al final del período.`, ST.advertencia);
  }

  // ============================================================== Deuda
  const hDeuda = new Hoja();
  hDeuda.texto(1, 1, 'Calendario financiero de la deuda (misión §6) — miles de USD', ST.titulo);
  hDeuda.texto(2, 1, 'Invariante por período: saldo final = saldo inicial + desembolso + interés capitalizado − amortización. Gracia de principal: intereses corrientes; gracia total: intereses capitalizados. Métodos: capital constante, francés (PMT) y pago único.', ST.nota);
  ['Año', 'Saldo inicial', 'Desembolso', 'Interés devengado', 'Interés capitalizado', 'Amortización', 'Interés pagado', 'Saldo final'].forEach((e, i) => hDeuda.texto(3, 1 + i, e, ST.encabezado));
  // Bloque de configuración (columnas J/K): todas las cifras provienen de
  // parámetros y de la configuración del crédito — nada fijo en fórmulas.
  const cfg = proyecto.financiero.deuda;
  const CF = { monto: 4, tasa: 5, gracia: 6, anioDes: 7, tipo: 8, metodo: 9, plazo: 10, saldoBase: 11, cuota: 12 };
  hDeuda.texto(1, 10, 'Configuración del crédito', ST.titulo);
  hDeuda.texto(2, 10, 'Celdas K: editables; las fórmulas del calendario las referencian.', ST.nota);
  hDeuda.texto(CF.monto, 10, 'Monto (kUSD)');
  hDeuda.formula(CF.monto, 11, valorParam('credito_monto_k'), `=Parametros!$C$${filaParam('credito_monto_k')}`, Z.kusd);
  hDeuda.texto(CF.tasa, 10, 'Tasa anual');
  hDeuda.formula(CF.tasa, 11, valorParam('tasa_interes'), `=Parametros!$C$${filaParam('tasa_interes')}`, Z.pct);
  hDeuda.texto(CF.gracia, 10, 'Gracia (años)');
  hDeuda.formula(CF.gracia, 11, valorParam('periodo_gracia'), `=Parametros!$C$${filaParam('periodo_gracia')}`, '0');
  hDeuda.texto(CF.anioDes, 10, 'Año de desembolso');
  hDeuda.entrada(CF.anioDes, 11, cfg.anioDesembolso, '0');
  hDeuda.texto(CF.tipo, 10, 'Tipo de gracia');
  hDeuda.entrada(CF.tipo, 11, cfg.tipoGracia);
  hDeuda.texto(CF.metodo, 10, 'Método de amortización');
  hDeuda.entrada(CF.metodo, 11, cfg.metodo);
  hDeuda.texto(CF.plazo, 10, 'Plazo (anualidades)');
  hDeuda.formula(CF.plazo, 11, valorParam('plazo_amortizacion'), `=Parametros!$C$${filaParam('plazo_amortizacion')}`, '0');
  hDeuda.texto(CF.saldoBase, 10, 'Saldo al inicio de la ventana');
  hDeuda.formula(CF.saldoBase, 11, cfg.habilitada ? valorParam('credito_monto_k') * (cfg.tipoGracia === 'total' ? Math.pow(1 + valorParam('tasa_interes'), valorParam('periodo_gracia')) : 1) : 0, `=IF($K$${CF.tipo}="total",$K$${CF.monto}*(1+$K$${CF.tasa})^$K$${CF.gracia},$K$${CF.monto})`, Z.kusd);
  hDeuda.texto(CF.cuota, 10, 'Cuota del sistema francés');
  hDeuda.formula(CF.cuota, 11, 0, `=IF($K$${CF.tasa}>0,$K$${CF.saldoBase}*$K$${CF.tasa}/(1-(1+$K$${CF.tasa})^-$K$${CF.plazo}),$K$${CF.saldoBase}/$K$${CF.plazo})`, Z.kusd);
  for (const t of years) {
    const f = FilaDeudaAnio(t);
    hDeuda.entrada(f, 1, t, '0');
    // Convención: saldoFinal = saldoInicial + desembolso + capitalizado − amortización
    if (t === 0) {
      hDeuda.formula(f, 2, modelo.deuda[t]?.saldoInicial ?? 0, '=0', Z.kusd);
    } else {
      hDeuda.formula(f, 2, modelo.deuda[t]?.saldoInicial ?? 0, `=$H${f - 1}`, Z.kusd);
    }
    hDeuda.formula(f, 3, modelo.deuda[t]?.desembolso ?? 0, `=IF($A${f}=$K$${CF.anioDes},$K$${CF.monto},0)`, Z.kusd);
    hDeuda.formula(f, 4, modelo.deuda[t]?.interesDevengado ?? 0, `=IF($A${f}>$K$${CF.anioDes},($B${f}+$C${f})*$K$${CF.tasa},0)`, Z.kusd);
    hDeuda.formula(f, 5, modelo.deuda[t]?.interesCapitalizado ?? 0, `=IF(AND($K$${CF.tipo}="total",$A${f}>$K$${CF.anioDes},$A${f}<=$K$${CF.anioDes}+$K$${CF.gracia}),$D${f},0)`, Z.kusd);
    hDeuda.formula(
      f,
      6,
      modelo.deuda[t]?.amortizacion ?? 0,
      `=IF(AND($A${f}>=$K$${CF.anioDes}+$K$${CF.gracia}+1,$A${f}<=$K$${CF.anioDes}+$K$${CF.gracia}+$K$${CF.plazo}),IF($K$${CF.metodo}="sistema_frances",MAX(0,MIN($K$${CF.cuota}-$D${f},$B${f}+$C${f}+$E${f})),IF($K$${CF.metodo}="pago_unico",IF($A${f}=$K$${CF.anioDes}+$K$${CF.gracia}+$K$${CF.plazo},$B${f}+$C${f}+$E${f},0),MIN($K$${CF.saldoBase}/$K$${CF.plazo},$B${f}+$C${f}+$E${f}))),0)`,
      Z.kusd
    );
    hDeuda.formula(f, 7, modelo.deuda[t]?.interesPagado ?? 0, `=IF($A${f}>$K$${CF.anioDes},$D${f}-$E${f},0)`, Z.kusd);
    hDeuda.formula(f, 8, modelo.deuda[t]?.saldoFinal ?? 0, `=$B${f}+$C${f}+$E${f}-$F${f}`, Z.kusd);
  }
  hDeuda.texto(FilaDeudaAnio(N) + 2, 1, `Fuente de la configuración: ${cfg.fuente || '—'}`, ST.nota);

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
      const fml = traducirRegla(r, ctxAnio(3, f));
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
  hFin.texto(18, 1, 'Tasa, plazo, gracia, tipo de gracia y método de amortización: hoja Deuda (configuración editable) y hoja Parametros.', ST.nota);

  // ============================================================== Servicios
  const hSvc = new Hoja();
  hSvc.texto(1, 1, 'Servicios (4.6) — proyección por servicio y año (formato largo)', ST.titulo);
  hSvc.texto(2, 1, `Escenario de capacidad activo: ${proyecto.tecnico.escenarioCapacidad === 'B_ampliacion' ? 'B (ampliaciones)' : 'A (capacidad constante)'}. La cantidad REAL limita la producción; la demanda prevista queda documentada aparte.`, ST.nota);
  const encSvc = ['Año', 'Servicio', 'Precio base', 'Demanda base mensual', 'Tope directo (0 = recursos)', 'CVU base', 'Precio proy.', 'Demanda proy.', 'Cantidad real mensual', 'Cantidad anual', 'Costo unit. proy.', 'Ingreso anual (USD)', 'Costo var. total (USD)', 'Margen (USD)', 'Duración (min)', 'Utilización', 'Arranque demanda (año)', ...proyecto.recursos.map((r) => `Usa: ${r.nombre}`), 'Control'];
  encSvc.forEach((e, i) => hSvc.texto(3, 1 + i, e, ST.encabezado));
  let fSvc = 4;
  const flagCols = proyecto.recursos.map((_, i) => letraCol(17 + i)); // R en adelante
  for (const t of years) {
    if (t === 0) continue;
    for (const s of proyecto.servicios) {
      const sc = modelo.servicios.find((x) => x.id === s.id);
      hSvc.entrada(fSvc, 1, t, '0');
      hSvc.entrada(fSvc, 2, s.nombre);
      hSvc.entrada(fSvc, 3, s.precioBase, Z.usd);
      hSvc.entrada(fSvc, 4, s.cantidadBaseMensual, '#,##0');
      hSvc.entrada(fSvc, 5, s.capacidadMaxMensual, '#,##0');
      hSvc.entrada(fSvc, 6, s.costoVariableUnitario, Z.usd);
      // G..N: fórmulas desde las reglas de ámbito servicio
      for (const idRegla of ['srv_precio_proy', 'srv_cantidad_mensual_proy', 'srv_cantidad_real_mensual', 'srv_cantidad_anual', 'srv_costo_unitario_proy', 'srv_ingreso_anual', 'srv_costo_variable_total', 'srv_margen_contribucion']) {
        const r = reglasPorId.get(idRegla)!;
        const col = COL_SERVICIO[idRegla];
        const fml = traducirRegla(r, ctxFilaServicio(fSvc));
        const vCache = sc?.valores[t]?.[idRegla] ?? 0;
        if (fml) hSvc.formula(fSvc, col.charCodeAt(0) - 64, vCache, `=${fml}`, Z.usd);
        else hSvc.set(fSvc, col.charCodeAt(0) - 64, { v: Number.isFinite(vCache) ? vCache : '#ERROR', z: Z.usd, s: ST.alerta });
      }
      hSvc.entrada(fSvc, 15, s.duracionMinutos, '0'); // O
      hSvc.formula(fSvc, 16, modelo.capacidadServicios[s.id]?.[t]?.utilizacion ?? 0, `=Capacidad!$F$${fSvc}`, Z.pct); // P
      hSvc.entrada(fSvc, 17, s.anioInicioDemanda ?? 1, '0'); // Q: arranque de la demanda
      proyecto.recursos.forEach((r, i) => {
        hSvc.entrada(fSvc, 18 + i, (s.recursoIds ?? []).includes(r.id) ? 1 : 0, '0');
      });
      const colControl = letraCol(17 + nRec);
      hSvc.formula(fSvc, 18 + nRec, modelo.capacidadServicios[s.id]?.[t] && modelo.capacidadServicios[s.id][t].cantidadRealMensual < modelo.capacidadServicios[s.id][t].demandaMensual - 1e-9 ? 'LIMITADA' : '', `=IF(I${fSvc}<H${fSvc}-0.000001,"LIMITADA","")`);
      void colControl;
      fSvc++;
    }
  }
  void flagCols;
  if (nSvc > 0) hSvc.texto(fSvc + 1, 1, 'Celdas ámbar = editables. Verdes = fórmulas. «LIMITADA» = la demanda prevista supera la capacidad del escenario activo y la producción queda limitada a lo atendible.', ST.nota);

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

  // ============================================================== Capacidad
  const hCap = new Hoja();
  hCap.texto(1, 1, 'Capacidad operativa (misión §7) — recursos compartidos, escenarios y limitación', ST.titulo);
  hCap.texto(2, 1, `Escenario activo: ${proyecto.tecnico.escenarioCapacidad === 'B_ampliacion' ? 'B (ampliaciones programadas)' : 'A (capacidad constante; las ampliaciones definidas quedan ignoradas)'}. Capacidad de cada recurso: unidades × horas/día × días/año × (1 − mantenimiento). Asignación pro-rata cuando varios servicios comparten un recurso.`, ST.nota);
  ['Año', 'Servicio', 'Demanda mensual', 'Capacidad mensual', 'Cantidad real mensual', 'Utilización', 'Advertencia'].forEach((e, i) => hCap.texto(3, 1 + i, e, ST.encabezado));
  {
    let f = 4;
    for (const t of years) {
      if (t === 0) continue;
      for (const s of proyecto.servicios) {
        const c = modelo.capacidadServicios[s.id]?.[t];
        hCap.formula(f, 1, t, `=Servicios!$A$${f}`, '0');
        hCap.formula(f, 2, s.nombre, `=Servicios!$B$${f}`);
        hCap.formula(f, 3, c?.demandaMensual ?? 0, `=Servicios!$H$${f}`, '#,##0.0');
        // Capacidad: MIN(disp_r/duración para recursos usados; tope directo si > 0)
        const usados = (s.recursoIds ?? []).filter((rid) => proyecto.recursos.some((r) => r.id === rid));
        const fCap: string[] = [];
        for (const rid of usados) {
          const ri = proyecto.recursos.findIndex((r) => r.id === rid);
          const fDisp = fCapBloque3 + ri * 4;
          fCap.push(`${letraCol(9 + t)}$${fDisp}/Servicios!$O$${f}`);
        }
        const partes = [
          ...(fCap.length ? fCap : []),
          `IF(Servicios!$E$${f}>0,Servicios!$E$${f},9.99E+99)`,
        ];
        hCap.formula(f, 4, c?.capacidadMensual ?? 0, `=MIN(${partes.join(',')})`, '#,##0.0');
        const escalas = usados.map((rid) => {
          const ri = proyecto.recursos.findIndex((r) => r.id === rid);
          const fEsc = fCapBloque3 + ri * 4 + 2;
          return `${letraCol(9 + t)}$${fEsc}`;
        });
        hCap.formula(f, 5, c?.cantidadRealMensual ?? 0, `=MIN($C${f}*MIN(${escalas.length ? escalas.join(',') : '1'}),$D${f})`, '#,##0.0');
        hCap.formula(f, 6, c?.utilizacion ?? 0, `=IF($D${f}>0,$C${f}/$D${f},0)`, Z.pct);
        hCap.formula(f, 7, c && c.cantidadRealMensual < c.demandaMensual - 1e-9 ? 'LIMITADA' : '', `=IF($E${f}<$C${f}-0.000001,"LIMITADA","")`);
        f++;
      }
    }
  }
  // Bloque recursos (editable) + bloque por-año con fórmulas
  ['Recurso', 'Tipo', 'Cantidad', 'Horas/día', 'Días/año', 'Mantenimiento %', 'Disponible desde año', 'Observación'].forEach((e, i) => hCap.texto(fCapRecursos, 1 + i, e, ST.encabezado));
  proyecto.recursos.forEach((r, i) => {
    const f = fCapRecursos + 1 + i;
    hCap.entrada(f, 1, r.nombre);
    hCap.entrada(f, 2, r.tipo);
    hCap.entrada(f, 3, r.cantidad, '0');
    hCap.entrada(f, 4, r.horasDia, '0.0');
    hCap.entrada(f, 5, r.diasAnio, '0');
    hCap.entrada(f, 6, r.pctMantenimiento, Z.pct);
    hCap.entrada(f, 7, r.anioDisponible, '0');
    hCap.texto(f, 8, r.observacion);
  });
  // Encabezados del bloque por-año (columnas J en adelante, años 0..N)
  hCap.texto(fCapBloque3 - 1, 9, 'Minutos-mes por recurso y año (I = año 0)', ST.encabezado);
  for (let t = 0; t <= N; t++) hCap.texto(fCapBloque3, 9 + t, `Año ${t}`, ST.encabezado);
  hCap.texto(fCapBloque3 - 1, 1, 'Minutos-mes disponibles, demandados, escala pro-rata y utilización por recurso', ST.titulo);
  proyecto.recursos.forEach((r, i) => {
    const f = fCapRecursos + 1 + i;
    const fDisp = fCapBloque3 + i * 4;
    const fDem = fDisp + 1;
    const fEsc = fDisp + 2;
    const fUtil = fDisp + 3;
    hCap.texto(fDisp, 2, `${r.nombre} — minutos-mes disponibles`, ST.total);
    hCap.texto(fDem, 2, `${r.nombre} — minutos-mes demandados`);
    hCap.texto(fEsc, 2, `${r.nombre} — escala pro-rata`);
    hCap.texto(fUtil, 2, `${r.nombre} — utilización`);
    const flagCol = letraCol(16 + i); // columna bandera en Servicios (Q+)
    for (let t = 0; t <= N; t++) {
      const col = letraCol(9 + t);
      const partesCant = [`$C$${f}`];
      for (const e of r.expansiones ?? []) {
        if (proyecto.tecnico.escenarioCapacidad === 'B_ampliacion' && e.anio <= N) {
          partesCant.push(`IF(${col}$${fCapBloque3}>=${e.anio},${e.cantidad},0)`);
        }
      }
      hCap.formula(
        fDisp,
        10 + t,
        (t >= r.anioDisponible ? 1 : 0) * (r.cantidad + (proyecto.tecnico.escenarioCapacidad === 'B_ampliacion' ? r.expansiones.filter((e) => e.anio <= t).reduce((s, e) => s + e.cantidad, 0) : 0)) * r.horasDia * r.diasAnio * (1 - r.pctMantenimiento) * 5,
        `=IF(${col}$${fCapBloque3}>=$G$${f},(${partesCant.join('+')})*$D$${f}*$E$${f}*(1-$F$${f})*60/12,0)`,
        '#,##0.0'
      );
      hCap.formula(
        fDem,
        10 + t,
        t === 0 ? 0 : (modelo.recursosCalculados[i]?.horasDemandadas[t] ?? 0) * 60,
        t === 0 ? '=0' : `=SUMPRODUCT((Servicios!$A$4:$A$${3 + filasServiciosSheet}=${col}$${fCapBloque3})*Servicios!$H$4:$H$${3 + filasServiciosSheet}*Servicios!$O$4:$O$${3 + filasServiciosSheet}*Servicios!$${flagCol}$4:$${flagCol}$${3 + filasServiciosSheet}})`,
        '#,##0.0'
      );
      hCap.formula(fEsc, 10 + t, 1, `=IF($${col}${fDem}>$${col}${fDisp},$${col}${fDisp}/$${col}${fDem},1)`, '0.0000');
      hCap.formula(fUtil, 10 + t, t === 0 ? 0 : (modelo.recursosCalculados[i]?.utilizacion[t] ?? 0), t === 0 ? '=0' : `=$${col}${fDem}/$${col}${fDisp}`, Z.pct);
    }
  });
  // Bloque ampliaciones (editable; solo cuentan en escenario B)
  hCap.texto(fCapExpansiones, 1, 'Ampliaciones programadas (escenario B)', ST.titulo);
  ['Recurso', 'Año', 'Cantidad', 'Costo (kUSD)', 'Vida útil', 'Observación'].forEach((e, i) => hCap.texto(fCapExpansiones + 1, 1 + i, e, ST.encabezado));
  let fExp = fCapExpansiones + 2;
  const rangoExp: [number, number] = [fExp, fExp - 1];
  for (const r of proyecto.recursos) {
    for (const e of r.expansiones ?? []) {
      hCap.entrada(fExp, 1, r.nombre);
      hCap.entrada(fExp, 2, e.anio, '0');
      hCap.entrada(fExp, 3, e.cantidad, '0');
      hCap.entrada(fExp, 4, e.costoKUSD, Z.kusd);
      hCap.entrada(fExp, 5, e.vidaUtilAnios, '0');
      hCap.texto(fExp, 6, e.observacion);
      fExp++;
    }
  }
  rangoExp[1] = fExp - 1;
  hCap.texto(fExp + 1, 1, proyecto.tecnico.escenarioCapacidad === 'B_ampliacion' ? 'Las ampliaciones generan CAPEX (hoja FlujosCaja), capacidad y depreciación (hoja Depreciacion) desde su año.' : 'Escenario A: estas ampliaciones NO se aplican; cámbiese a escenario B para activarlas.', ST.nota);

  // ============================================================== Proyecciones
  const hProy = new Hoja();
  hProy.texto(1, 1, 'Proyección de ingresos, costos, utilidades y flujos (4.7) — miles de USD', ST.titulo);
  hProy.texto(2, 1, 'Año 0 = montaje (solo efectos reales de esa fase); años 1–N = operación. Celdas ámbar = entrada; verdes = fórmula con referencias entre hojas (incluidas las hojas del motor: Depreciacion, Deuda, FlujosCaja y Dividendos).', ST.nota);
  hProy.texto(3, 1, 'Concepto', ST.encabezado);
  hProy.texto(3, 2, 'Unidad', ST.encabezado);
  years.forEach((t) => hProy.set(3, 3 + t, { v: t, z: '0', s: ST.encabezado }));
  hProy.texto(3, 4 + N, 'Total', ST.encabezado);
  FILAS_PROYECCIONES.forEach((fp, i) => {
    const f = 4 + i;
    hProy.texto(f, 1, fp.etiqueta, fp.negrita ? ST.total : undefined);
    hProy.texto(f, 2, fp.id.endsWith('_usd') ? 'USD' : fp.id === 'costo_laboral_cup' ? 'CUP' : 'kUSD');
    if (fp.tipo === 'entrada') {
      years.forEach((t) => hProy.entrada(f, 3 + t, t === 0 ? 0 : proyecto.financiero.otrosIngresos[t - 1] ?? 0, Z.kusd));
    } else {
      const r = reglasPorId.get(fp.id);
      years.forEach((t) => {
        if (!r) return;
        const fml = traducirRegla(r, ctxAnio(2 + t, f));
        const v = val(fp.id, t);
        if (fml) hProy.formula(f, 3 + t, v as number, `=${fml}`, Z.kusd, fp.negrita ? ST.total : undefined);
        else hProy.set(f, 3 + t, { v, z: Z.kusd, s: ST.alerta });
      });
    }
    if (!SIN_TOTAL.has(fp.id) && fp.tipo !== 'entrada') {
      hProy.formula(f, 4 + N, val(fp.id, -1) === '#ERROR' ? '#ERROR' : sumarSerie(modelo, fp.id, years), `=SUM(C${f}:${letraCol(2 + N)}${f})`, Z.kusd, ST.total);
    } else if (fp.tipo === 'entrada') {
      hProy.formula(f, 4 + N, proyecto.financiero.otrosIngresos.reduce((s, x) => s + x, 0), `=SUM(C${f}:${letraCol(2 + N)}${f})`, Z.kusd, ST.total);
    }
  });

  // ============================================================== FlujosCaja
  const hFlujo = new Hoja();
  hFlujo.texto(1, 1, 'Flujos de caja, recuperación y partidas del motor (4.7 / misión §4)', ST.titulo);
  hFlujo.texto(2, 1, 'FCFF = UDI + (interés devengado − escudo fiscal) + depreciación − CAPEX de ampliaciones + recuperación del capital de trabajo (año 0: −inversión total). FCFE = FCFF − interés pagado + escudo fiscal + desembolso − amortización. Recuperación por interpolación lineal del acumulado. El escudo se deriva de la regla de impuestos activa (regla plana: interés × tasa).', ST.nota);
  hFlujo.texto(3, 1, 'Concepto', ST.encabezado);
  years.forEach((t) => hFlujo.set(3, 2 + t, { v: t, z: '0', s: ST.encabezado }));
  const filaUDI = filaReglaAnio('utilidad_despues_impuestos_k');
  const encFlujo: Record<number, string> = {
    [F_ROW.fcff]: 'Flujo de caja del PROYECTO (FCFF)',
    [F_ROW.fcffAcum]: 'Flujo acumulado del proyecto',
    [F_ROW.fcfe]: 'Flujo de caja de los SOCIOS (FCFE)',
    [F_ROW.fcfeAcum]: 'Flujo acumulado de los socios',
    [F_ROW.saldoP]: 'Saldo pendiente (inversión total)',
    [F_ROW.saldoS]: 'Saldo pendiente (capital aportado)',
    [F_ROW.cruceP]: 'Cruce del acumulado del proyecto (interpolación)',
    [F_ROW.cruceS]: 'Cruce del acumulado de los socios (interpolación)',
    [F_ROW.recP]: 'PERÍODO DE RECUPERACIÓN — INVERSIÓN TOTAL (años)',
    [F_ROW.recS]: 'PERÍODO DE RECUPERACIÓN — CAPITAL APORTADO (años)',
    [F_ROW.capexAmp]: 'CAPEX de ampliaciones (escenario B)',
    [F_ROW.recCT]: 'Recuperación del capital de trabajo',
  };
  for (const [fs, et] of Object.entries(encFlujo)) hFlujo.texto(Number(fs), 1, et, Number(fs) === F_ROW.recP || Number(fs) === F_ROW.recS ? ST.total : undefined);
  for (const t of years) {
    const c = colYear(t);
    const p = colYear(Math.max(0, t - 1));
    const fD = FilaDeudaAnio(t);
    // FCFF
    const fmFcff =
      t === 0
        ? `=Proyecciones!${c}$${filaUDI}+Deuda!$D$${fD}+Depreciacion!${colYearDep(0)}$${FILA_DEP_TOTAL}-FlujosCaja!${c}$${F_ROW.capexAmp}+FlujosCaja!${c}$${F_ROW.recCT}-Financiacion!$D$${filaInversionTotal}`
        : `=Proyecciones!${c}$${filaUDI}+Deuda!$D$${fD}+Depreciacion!${colYearDep(t)}$${FILA_DEP_TOTAL}-FlujosCaja!${c}$${F_ROW.capexAmp}+FlujosCaja!${c}$${F_ROW.recCT}`;
    hFlujo.formula(F_ROW.fcff, 2 + t, modelo.indicadores.fcff[t] ?? 0, fmFcff, Z.kusd);
    // Acumulados (recurrencia)
    hFlujo.formula(F_ROW.fcffAcum, 2 + t, modelo.indicadores.fcffAcumulado[t] ?? 0, t === 0 ? `=${c}$${F_ROW.fcff}` : `=${p}$${F_ROW.fcffAcum}+${c}$${F_ROW.fcff}`, Z.kusd);
    // FCFE
    hFlujo.formula(F_ROW.fcfe, 2 + t, modelo.indicadores.fcfe[t] ?? 0, `=${c}$${F_ROW.fcff}-Deuda!$G$${fD}+Deuda!$C$${fD}-Deuda!$F$${fD}`, Z.kusd);
    hFlujo.formula(F_ROW.fcfeAcum, 2 + t, modelo.indicadores.fcfeAcumulado[t] ?? 0, t === 0 ? `=${c}$${F_ROW.fcfe}` : `=${p}$${F_ROW.fcfeAcum}+${c}$${F_ROW.fcfe}`, Z.kusd);
    // Saldos pendientes
    hFlujo.formula(F_ROW.saldoP, 2 + t, Math.max(0, -(modelo.indicadores.fcffAcumulado[t] ?? 0)), `=MAX(0,-${c}$${F_ROW.fcffAcum})`, Z.kusd);
    hFlujo.formula(F_ROW.saldoS, 2 + t, Math.max(0, -(modelo.indicadores.fcfeAcumulado[t] ?? 0)), `=MAX(0,-${c}$${F_ROW.fcfeAcum})`, Z.kusd);
    // Cruces (interpolación): vacío si no cruza en ese año
    if (t >= 1) {
      hFlujo.formula(F_ROW.cruceP, 2 + t, '', `=IF(AND(${p}$${F_ROW.fcffAcum}<0,${c}$${F_ROW.fcffAcum}>=0),${p}$$3+ABS(${p}$${F_ROW.fcffAcum})/(${c}$${F_ROW.fcffAcum}-${p}$${F_ROW.fcffAcum}),"")`, Z.anios);
      hFlujo.formula(F_ROW.cruceS, 2 + t, '', `=IF(AND(${p}$${F_ROW.fcfeAcum}<0,${c}$${F_ROW.fcfeAcum}>=0),${p}$$3+ABS(${p}$${F_ROW.fcfeAcum})/(${c}$${F_ROW.fcfeAcum}-${p}$${F_ROW.fcfeAcum}),"")`, Z.anios);
    }
    // CAPEX de ampliaciones
    const fmlCapex =
      rangoExp[1] >= rangoExp[0]
        ? `=SUMIF(Capacidad!$B$${rangoExp[0]}:$B$${rangoExp[1]},${c}$$3,Capacidad!$D$${rangoExp[0]}:$D$${rangoExp[1]})`
        : '=0';
    hFlujo.formula(F_ROW.capexAmp, 2 + t, modelo.indicadores.capexAmpliaciones[t] ?? 0, fmlCapex, Z.kusd);
    // Recuperación del capital de trabajo
    hFlujo.formula(F_ROW.recCT, 2 + t, t === N ? valorParam('pct_recuperacion_capital_trabajo') * valorParam('capital_trabajo_k') : 0, `=IF(${c}$$3=${colYear(N)}$$3,Parametros!$C$${filaParam('pct_recuperacion_capital_trabajo')}*Parametros!$C$${filaParam('capital_trabajo_k')},0)`, Z.kusd);
  }
  hFlujo.formula(F_ROW.recP, 2, modelo.indicadores.recuperacionProyecto.anios ?? 'No se recupera en el horizonte', `=IF(COUNT(C${F_ROW.cruceP}:${colYear(N)}$${F_ROW.cruceP})=0,"No se recupera en el horizonte",MIN(C${F_ROW.cruceP}:${colYear(N)}$${F_ROW.cruceP}))`, Z.anios, ST.total);
  hFlujo.formula(F_ROW.recS, 2, modelo.indicadores.recuperacionSocios.anios ?? 'No se recupera en el horizonte', `=IF(COUNT(C${F_ROW.cruceS}:${colYear(N)}$${F_ROW.cruceS})=0,"No se recupera en el horizonte",MIN(C${F_ROW.cruceS}:${colYear(N)}$${F_ROW.cruceS}))`, Z.anios, ST.total);
  hFlujo.texto(F_ROW.recP + 1, 1, `Método: interpolación lineal (t−1) + |acumulado anterior| / (acumulado actual − acumulado anterior); el mínimo de los cruces detectados.${modelo.indicadores.recuperacionProyecto.indeterminado ? ' ATENCIÓN: el flujo cambia de signo más de una vez: interpretar con cautela.' : ''}`, ST.nota);
  hFlujo.texto(F_ROW.recP + 2, 1, 'El capital de trabajo se recupera solo si el parámetro «pct_recuperacion_capital_trabajo» lo indica (regla explícita, conservadora por defecto).', ST.nota);

  // ============================================================== Dividendos
  const hDiv = new Hoja();
  hDiv.texto(1, 1, 'Dividendos y beneficios distribuibles (misión §8) — miles de USD', ST.titulo);
  hDiv.texto(2, 1, 'base = max(0, UDI + saldo acumulable previo); reserva = pct_reserva × base; distribuible = base − reserva; propuestos = pct_reparto × distribuible; pagables = min(propuestos, caja acumulada FCFE). El saldo acumulable absorbe pérdidas y descuenta lo pagado.', ST.nota);
  hDiv.texto(3, 1, 'Concepto', ST.encabezado);
  years.forEach((t) => hDiv.set(3, 2 + t, { v: t, z: '0', s: ST.encabezado }));
  const encDiv: Record<number, string> = {
    [F_ROW_DIV.udi]: 'Utilidad después de impuestos',
    [F_ROW_DIV.saldoPrev]: 'Saldo acumulable previo',
    [F_ROW_DIV.base]: 'Base distribuible',
    [F_ROW_DIV.reserva]: 'Reserva',
    [F_ROW_DIV.distribuible]: 'Distribuible',
    [F_ROW_DIV.propuestos]: 'Dividendos propuestos',
    [F_ROW_DIV.caja]: 'Caja acumulada disponible (FCFE)',
    [F_ROW_DIV.pagables]: 'Dividendos PAGABLES (limitados por caja)',
    [F_ROW_DIV.nacional]: 'Dividendos — socio nacional',
    [F_ROW_DIV.extranjero]: 'Dividendos — socio extranjero',
    [F_ROW_DIV.saldo]: 'Saldo acumulable del período',
  };
  for (const [fs, et] of Object.entries(encDiv)) hDiv.texto(Number(fs), 1, et);
  for (const t of years) {
    const c = colYear(t);
    const p = colYear(Math.max(0, t - 1));
    const divT = modelo.dividendos.find((d) => d.anio === t);
    hDiv.formula(F_ROW_DIV.udi, 2 + t, divT?.udi ?? 0, `=Proyecciones!${colYearProy(t)}$${filaUDI}`, Z.kusd);
    if (t === 0) {
      hDiv.formula(F_ROW_DIV.saldoPrev, 2 + t, 0, '=0', Z.kusd);
      hDiv.formula(F_ROW_DIV.base, 2 + t, 0, '=0', Z.kusd);
      hDiv.formula(F_ROW_DIV.reserva, 2 + t, 0, '=0', Z.kusd);
      hDiv.formula(F_ROW_DIV.distribuible, 2 + t, 0, '=0', Z.kusd);
      hDiv.formula(F_ROW_DIV.propuestos, 2 + t, 0, '=0', Z.kusd);
      hDiv.formula(F_ROW_DIV.caja, 2 + t, 0, '=0', Z.kusd);
      hDiv.formula(F_ROW_DIV.pagables, 2 + t, 0, '=0', Z.kusd);
    } else {
      hDiv.formula(F_ROW_DIV.saldoPrev, 2 + t, divT?.saldoAcumulablePrevio ?? 0, `=${p}$${F_ROW_DIV.saldo}`, Z.kusd);
      hDiv.formula(F_ROW_DIV.base, 2 + t, divT?.base ?? 0, `=MAX(0,${c}$${F_ROW_DIV.udi}+${c}$${F_ROW_DIV.saldoPrev})`, Z.kusd);
      hDiv.formula(F_ROW_DIV.reserva, 2 + t, divT?.reserva ?? 0, `=${c}$${F_ROW_DIV.base}*Parametros!$C$${filaParam('pct_reserva_legal')}`, Z.kusd);
      hDiv.formula(F_ROW_DIV.distribuible, 2 + t, divT?.distribuible ?? 0, `=${c}$${F_ROW_DIV.base}-${c}$${F_ROW_DIV.reserva}`, Z.kusd);
      hDiv.formula(F_ROW_DIV.propuestos, 2 + t, divT?.propuestos ?? 0, `=${c}$${F_ROW_DIV.distribuible}*Parametros!$C$${filaParam('pct_reparto_dividendos')}`, Z.kusd);
      hDiv.formula(F_ROW_DIV.caja, 2 + t, divT?.cajaAcumulada ?? 0, `=FlujosCaja!${c}$${F_ROW.fcfeAcum}`, Z.kusd);
      hDiv.formula(F_ROW_DIV.pagables, 2 + t, divT?.pagables ?? 0, `=MIN(${c}$${F_ROW_DIV.propuestos},MAX(0,${c}$${F_ROW_DIV.caja}))`, Z.kusd);
    }
    hDiv.formula(F_ROW_DIV.nacional, 2 + t, divT?.socioNacional ?? 0, `=${c}$${F_ROW_DIV.pagables}*Parametros!$C$${filaParam('pct_parte_cubana')}`, Z.kusd);
    hDiv.formula(F_ROW_DIV.extranjero, 2 + t, divT?.socioExtranjero ?? 0, `=${c}$${F_ROW_DIV.pagables}*(1-Parametros!$C$${filaParam('pct_parte_cubana')})`, Z.kusd);
    if (t === 0) {
      hDiv.formula(F_ROW_DIV.saldo, 2 + t, divT?.saldoAcumulable ?? 0, `=${c}$${F_ROW_DIV.udi}`, Z.kusd);
    } else {
      hDiv.formula(F_ROW_DIV.saldo, 2 + t, divT?.saldoAcumulable ?? 0, `=${p}$${F_ROW_DIV.saldo}+${c}$${F_ROW_DIV.udi}-${c}$${F_ROW_DIV.reserva}-${c}$${F_ROW_DIV.pagables}`, Z.kusd);
    }
  }
  hDiv.texto(F_ROW_DIV.saldo + 2, 1, 'Ningún dividendo supera la caja modelada; los propuestos que queden por encima quedan restringidos y el diagnóstico lo advierte. La PARTICIPACIÓN (composición del capital) y el REPARTO son conceptos distintos.', ST.nota);

  // ============================================================== BeneficiosPais
  const hBP = new Hoja();
  hBP.texto(1, 1, 'Beneficios directos al país (4.11) — miles de USD por año', ST.titulo);
  hBP.texto(2, 1, 'Metadatos por partida: el impuesto, dividendos y pagos por fuerza de trabajo provienen de reglas del motor; los conceptos de explotación se activan desde el año 1; los pagos por fuerza de trabajo INCLUYEN el montaje del año 0. El total del período completo concilia con el resumen y las conclusiones.', ST.nota);
  hBP.texto(3, 1, 'Concepto', ST.encabezado);
  years.forEach((t) => hBP.set(3, 2 + t, { v: t, z: '0', s: ST.encabezado }));
  hBP.texto(3, 2 + years.length, 'Total', ST.encabezado);
  const filasBP: { et: string; id: string }[] = [
    { et: 'Impuesto sobre utilidades', id: 'impuesto_utilidades_k' },
    { et: 'Otros impuestos, tasas y contribuciones', id: 'otros_impuestos_k' },
    { et: 'Dividendos de la parte cubana', id: 'dividendos_parte_cubana_k' },
    { et: 'Aranceles', id: 'aranceles_k' },
    { et: 'Pagos por la fuerza de trabajo', id: 'pagos_fuerza_trabajo_k' },
    { et: 'Canon', id: 'canon_k' },
    { et: 'Royalties', id: 'royalties_k' },
    { et: 'Otros ingresos', id: 'otros_beneficios_pais_k' },
  ];
  filasBP.forEach((c, i) => {
    const f = 4 + i;
    hBP.texto(f, 1, c.et);
    years.forEach((t) => {
      hBP.formula(f, 2 + t, val(c.id, t) as number, `=Proyecciones!${colYearProy(t)}$${filaReglaAnio(c.id)}`, Z.kusd);
    });
    hBP.formula(f, 2 + years.length, sumarSerie(modelo, c.id, years), `=SUM(B${f}:${letraCol(1 + years.length)}${f})`, Z.kusd, ST.total);
  });
  const fTotBP = 4 + filasBP.length;
  hBP.texto(fTotBP, 1, 'TOTAL BENEFICIOS DIRECTOS AL PAÍS (período completo)', ST.total);
  years.forEach((t) => {
    const col = letraCol(1 + t);
    hBP.formula(fTotBP, 2 + t, val('total_beneficios_pais_k', t) as number, `=SUM(${col}${4}:${col}${fTotBP - 1})`, Z.kusd, ST.total);
  });
  hBP.formula(fTotBP, 2 + years.length, modelo.indicadores.beneficiosPaisAcumulados, `=SUM(B${fTotBP}:${letraCol(1 + years.length)}${fTotBP})`, Z.kusd, ST.total);
  hBP.texto(fTotBP + 1, 1, `Subtotal de la explotación (años 1–${N}), etiquetado aparte:`, ST.nota);
  hBP.formula(fTotBP + 1, 2, modelo.indicadores.beneficiosPaisExplotacion, `=SUM(B${fTotBP}:${colYearProy(N)}${fTotBP})-B${fTotBP}`, Z.kusd);

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

  // ============================================================== Cronograma / Consumos / Mercado / Descripcion / Reglas
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
    ['Escenario de capacidad activo', proyecto.tecnico.escenarioCapacidad === 'B_ampliacion' ? 'B — ampliaciones programadas' : 'A — capacidad constante'],
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
    ['Conclusiones (marco del usuario)', proyecto.conclusiones.texto],
  ];
  descripcion.forEach(([k, v], i) => {
    hDes.texto(3 + i, 1, k, ST.encabezado);
    hDes.texto(3 + i, 2, v);
  });

  const hReg = new Hoja();
  hReg.texto(1, 1, 'Configuración de cálculos — reglas activas (Nivel B)', ST.titulo);
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
      } catch {
        estado = noTraducibles.some((x) => x.id === r.id) ? 'NO TRADUCIBLE (valor estático + nota)' : 'TRADUCIDA PARCIALMENTE';
        hReg.texto(f, 8, 'NO TRADUCIBLE: se exporta el valor calculado por el motor; la fórmula activa solo es equivalente dentro de la aplicación.');
      }
    }
    hReg.texto(f, 9, estado);
  });
  hReg.texto(5 + proyecto.reglas.length, 1, 'Las variables mtr_* referencian las hojas del motor (Depreciacion, Deuda, FlujosCaja, Dividendos, Capacidad): cambiar un parámetro de Parametros recalcula esas hojas y con ellas todas las fórmulas dependientes.', ST.nota);

  // ============================================================== Controles
  const { hallazgos, resumen } = diagnosticar(proyecto, modelo);
  const hCtrl = new Hoja();
  hCtrl.texto(1, 1, 'Controles de consistencia y diagnóstico (misión §15)', ST.titulo);
  ['Nivel', 'Código', 'Hallazgo', 'Partida', 'Consecuencia', 'Corrección', 'Afecta conclusiones'].forEach((e, i) => hCtrl.texto(3, 1 + i, e, ST.encabezado));
  hallazgos.forEach((h, i) => {
    const f = 4 + i;
    const estilo =
      h.nivel === 'error_bloqueante' ? ST.error : h.nivel === 'advertencia_importante' ? ST.advertencia : undefined;
    hCtrl.texto(f, 1, h.nivel, estilo);
    hCtrl.texto(f, 2, h.codigo);
    hCtrl.texto(f, 3, h.mensaje);
    hCtrl.texto(f, 4, h.partida ?? '');
    hCtrl.texto(f, 5, h.consecuencia ?? '');
    hCtrl.texto(f, 6, h.correccion ?? '');
    hCtrl.texto(f, 7, h.afectaConclusiones ? 'SÍ' : 'No');
  });
  let fCtrl = 4 + hallazgos.length + 1;
  hCtrl.texto(fCtrl, 1, 'RESUMEN DE CONTROL', ST.titulo);
  fCtrl++;
  hCtrl.texto(fCtrl, 1, 'Dimensión', ST.encabezado);
  hCtrl.texto(fCtrl, 2, 'Estado', ST.encabezado);
  hCtrl.texto(fCtrl, 3, 'Detalle', ST.encabezado);
  fCtrl++;
  for (const d of resumen.dimensiones) {
    hCtrl.texto(fCtrl, 1, d.nombre);
    hCtrl.texto(fCtrl, 2, d.estado, d.estado === 'deficiente' ? ST.error : d.estado === 'aceptable' ? ST.advertencia : ST.ok);
    hCtrl.texto(fCtrl, 3, d.detalle);
    fCtrl++;
  }
  hCtrl.texto(fCtrl, 1, `Conteo: ${resumen.conteo.error_bloqueante} error(es) bloqueante(s), ${resumen.conteo.advertencia_importante} advertencia(s) importante(s), ${resumen.conteo.informacion_pendiente} pendiente(s), ${resumen.conteo.observacion_calidad} observación(es) de calidad.`, ST.nota);
  hCtrl.texto(fCtrl + 1, 1, `ESTADO GENERAL DEL PLAN (DOC-002 §5): ${resumen.estadoGeneral.etiqueta}. ${resumen.estadoGeneral.detalle}`, ST.nota);
  hCtrl.texto(fCtrl + 2, 1, 'La completitud formal de campos NO se usa como prueba de calidad: un apartado completo de supuestos sin respaldo sigue sin estar validado. Las seis dimensiones se evalúan de forma independiente.', ST.nota);
  // Leyenda de los CUATRO niveles del diagnóstico (misión §15): permite
  // distinguir la clasificación aunque el plan no genere hallazgos de todos
  // los niveles.
  hCtrl.texto(fCtrl + 3, 1, 'Clasificación de hallazgos (misión §15)', ST.subtitulo);
  const LEYENDA_NIVELES: [string, string][] = [
    ['error_bloqueante', 'El cálculo es inválido, una fórmula tiene referencias rotas o existe una inconsistencia que impide interpretar el resultado.'],
    ['advertencia_importante', 'Capacidad insuficiente, financiación no garantizada, recuperación no alcanzada o supuestos críticos no validados.'],
    ['informacion_pendiente', 'Falta completar un campo, adjuntar evidencia o documentar un supuesto.'],
    ['observacion_calidad', 'Recomendación de mejorar la redacción, la evidencia, el análisis o la presentación.'],
  ];
  LEYENDA_NIVELES.forEach(([nivel, desc], i) => {
    hCtrl.texto(fCtrl + 4 + i, 1, nivel);
    hCtrl.texto(fCtrl + 4 + i, 2, desc, ST.nota);
  });
  if (esDemo) hCtrl.texto(fCtrl + 4 + LEYENDA_NIVELES.length + 1, 1, 'EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS.', ST.alerta);

  // ============================================================== libro
  const wb = XLSX.utils.book_new();
  const agregar = (h: Hoja, nombre: string, anchos?: number[]) => {
    const ws = h.aHoja();
    if (anchos) ws['!cols'] = anchos.map((w) => ({ wch: w }));
    if (nSvc > 0 && nombre === 'Servicios') ws['!autofilter'] = { ref: `A3:${letraCol(17 + nRec)}${3 + nSvc * N}` };
    if (nInv > 0 && nombre === 'Inversion') ws['!autofilter'] = { ref: 'A3:I' + 3 + nInv };
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  };
  agregar(hPortada, 'Portada', [42, 60]);
  agregar(hResumen, 'Resumen', [52, 20]);
  agregar(hParam, 'Parametros', [30, 40, 12, 10, 70, 60, 12]);
  agregar(hInv, 'Inversion', [52, 16, 10, 12, 12, 14, 10, 14, 40]);
  agregar(hDep, 'Depreciacion', [10, 44, 8, 10, 8, 10, 10, 12, ...years.map(() => 9), 10, 10]);
  agregar(hDeuda, 'Deuda', [8, 12, 12, 13, 13, 12, 12, 12, 4, 30, 14]);
  agregar(hAport, 'Aportaciones', [14, 26, 12, 12, 12, 12, 60]);
  agregar(hFin, 'Financiacion', [48, 10, 4, 14]);
  agregar(hSvc, 'Servicios', [6, 38, 10, 12, 12, 9, 10, 11, 12, 11, 11, 13, 13, 12, 9, 9, 9, ...proyecto.recursos.map(() => 9), 10]);
  agregar(hPer, 'Personal', [6, 12, 22, 10, 22, 18, 16]);
  agregar(hCap, 'Capacidad', [8, 34, 13, 13, 14, 11, 11, 30, ...years.map(() => 11)]);
  agregar(hProy, 'Proyecciones', [46, 8, ...years.map(() => 11), 12]);
  agregar(hFlujo, 'FlujosCaja', [48, ...years.map(() => 11)]);
  agregar(hDiv, 'Dividendos', [34, ...years.map(() => 11)]);
  agregar(hBP, 'BeneficiosPais', [40, ...years.map(() => 11), 12]);
  agregar(hFT, 'FuerzaTrabajo', [40, 12, 24]);
  agregar(hCro, 'Cronograma', [42, 10, 10, 40]);
  agregar(hCons, 'ConsumosTecnicos', [34, 12, 12, 14, 40]);
  agregar(hMer, 'Mercado', [40, 90]);
  agregar(hDes, 'Descripcion', [40, 90]);
  agregar(hReg, 'Reglas', [26, 34, 20, 10, 12, 11, 90, 90, 24]);
  agregar(hCtrl, 'Controles', [20, 22, 90, 18, 50, 50, 16]);

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
