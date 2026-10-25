// ============================================================================
// MISIÓN §17 — PRUEBA DE GENERALIZACIÓN: crear un SEGUNDO PROYECTO.
//
// «Centro de Diagnóstico Integral Imagen Habana»: datos diferentes y una
// estructura de negocio DISTINTA (inversión extranjera total, sin crédito,
// horizonte de 8 años, escenario A, tasa 30 %, aporte en CUP, activo con
// disponibilidad diferida en el año 3 y línea con arranque de demanda tardío).
//
// Se comprueba que es posible: cambiar nombre/actividad, líneas de servicios,
// filas de inversión, tasas y supuestos, horizonte, fuentes de financiación,
// costos y estructura de personal, generar análisis desde los resultados
// nuevos y exportar PDF/Excel/JSON — TODO con las mismas reglas de fábrica,
// SIN copiar fórmulas de Sonrisa Habana y SIN alterar la plantilla original.
// ============================================================================

import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { crearProyectoCentro } from '../../src/lib/planex/templates/centro';
import { crearProyectoDefault } from '../../src/lib/planex/templates/default';
import { generarAnalisis } from '../../src/lib/planex/engine/analisis';
import { diagnosticar } from '../../src/lib/planex/model/controles';
import { exportarPDF } from '../../src/lib/planex/io/pdf';
import { exportarXLSX } from '../../src/lib/planex/io/xlsx';
import { proyectoAJSON, parsearProyectoJSON } from '../../src/lib/planex/io/jsonio';
import * as XLSX from 'xlsx-js-style';

function clonar<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

describe('MISIÓN §17 — Segundo proyecto: Centro de Diagnóstico «Imagen Habana»', () => {
  const clinica = crearProyectoClinica();
  const centro = crearProyectoCentro();
  const mClinica = computeProject(clinica);
  const mCentro = computeProject(centro);

  test('cambia el nombre y la actividad SIN tocar la plantilla original', () => {
    expect(centro.titulo.nombreProyecto).toContain('Centro de Diagnóstico');
    expect(centro.titulo.nombreProyecto).not.toContain('Sonrisa Habana');
    expect(centro.negocio.modalidad).toContain('Inversión extranjera total');
    expect(clinica.negocio.modalidad).toContain('Empresa Mixta');
    // La clínica original NO cambió por construir el centro (independencia).
    const clinica2 = crearProyectoClinica();
    expect(clinica2.servicios).toHaveLength(9);
    expect(clinica2.recursos).toHaveLength(4);
    expect(clinica2.ajustes.horizonteAnios).toBe(10);
  });

  test('usa OTRAS líneas de servicio y horizonte (8 años), con las MISMAS reglas de fábrica', () => {
    expect(centro.servicios).toHaveLength(6);
    expect(centro.servicios.map((s) => s.nombre)).not.toEqual(clinica.servicios.map((s) => s.nombre));
    expect(centro.ajustes.horizonteAnios).toBe(8);
    expect(clinica.ajustes.horizonteAnios).toBe(10);
    // Misma fuente de reglas: ningún identificador de regla propio del centro.
    const idsReglasCentro = centro.reglas.map((r) => r.id);
    const idsReglasClinica = clinica.reglas.map((r) => r.id);
    expect(idsReglasCentro).toEqual(idsReglasClinica);
    expect(centro.reglas.every((r) => !r.modificada)).toBe(true); // fábrica sin tocar
  });

  test('añade filas de inversión propias, con un activo en CUP y otro de disponibilidad diferida', () => {
    expect(centro.financiero.inversion).toHaveLength(9);
    const cup = centro.financiero.inversion.find((r) => r.id === 'iv-9')!;
    expect(cup.moneda).toBe('CUP');
    expect(centro.financiero.inversion.find((r) => r.id === 'iv-6')!.anioDisponible).toBe(3);
    // La depreciación del activo diferido NULO antes del año 3 (motor común).
    const rm = mCentro.depreciacion.find((a) => a.id === 'iv-6')!;
    expect(rm.depreciacion[1]).toBe(0);
    expect(rm.depreciacion[2]).toBe(0);
    expect(rm.depreciacion[3]).toBeGreaterThan(0);
  });

  test('configura tasas y supuestos distintos (30 %) y fuentes de financiación SIN crédito', () => {
    expect(centro.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!.valor).toBeCloseTo(0.3, 6);
    expect(centro.parametros.find((x) => x.id === 'crecimiento_volumen')!.valor).toBeCloseTo(0.06, 6);
    expect(centro.financiero.deuda.habilitada).toBe(false);
    expect(centro.parametros.find((x) => x.id === 'credito_monto_k')!.valor).toBe(0);
    // Conciliación de financiación: aportaciones = inversión exacta.
    expect(mCentro.indicadores.aportacionesTotalesKUSD).toBeCloseTo(mCentro.indicadores.inversionTotalKUSD, 1);
    expect(mCentro.valores['diferencia_financiacion_k']?.[0]).toBeCloseTo(0, 1);
  });

  test('otra estructura de personal: sin extranjeros y montaje reducido', () => {
    expect(mCentro.indicadores.extranjeros).toBe(0);
    expect(mCentro.indicadores.cubanos).toBeGreaterThan(0);
    expect(mCentro.indicadores.trabajadoresMontaje).toBe(4);
    expect(mCentro.indicadores.totalTrabajadores).toBe(18);
  });

  test('el motor calcula el centro coherente (escenario A) y con arranque de demanda diferido', () => {
    expect(mCentro.ok).toBe(true);
    const d = diagnosticar(centro, mCentro);
    expect(d.resumen.conteo.error_bloqueante).toBe(0);
    // DOC-002 §4.2: la conciliación del desembolso inicial detecta que los
    // gastos de montaje del año 0 no están cubiertos por las fuentes: es un
    // hallazgo REAL de la plantilla (advertencia importante FINANCIACION_ANO0).
    expect(d.resumen.conteo.advertencia_importante).toBe(1);
    expect(d.hallazgos.some((h) => h.codigo === 'FINANCIACION_ANO0')).toBe(true);
    expect(d.resumen.estadoGeneral.estado).toBe('borrador_demostracion');
    // La resonancia NO factura en años 1-2 (recurso disponible en el año 3).
    const rm = mCentro.servicios.find((s) => s.id === 'dz-4')!;
    expect(rm.valores[1]['srv_ingreso_anual']).toBeCloseTo(0, 6);
    expect(rm.valores[2]['srv_ingreso_anual']).toBeCloseTo(0, 6);
    expect(rm.valores[3]['srv_ingreso_anual']).toBeGreaterThan(0);
    expect(mCentro.capacidadServicios['dz-4'][1].demandaMensual).toBe(0);
  });

  test('sin crédito: FCFF = FCFE y una sola recuperación (los flujos lo demuestran)', () => {
    for (const t of mCentro.years) {
      expect(mCentro.indicadores.fcfe[t]).toBeCloseTo(mCentro.indicadores.fcff[t], 6);
    }
    expect(mCentro.indicadores.recuperacionProyecto.anios).toBeCloseTo(mCentro.indicadores.recuperacionSocios.anios!, 6);
    expect(mCentro.indicadores.recuperacionProyecto.anios).not.toBeNull();
    expect(mCentro.indicadores.recuperacionProyecto.anios!).toBeGreaterThan(4);
    expect(centro.ajustes.horizonteAnios).toBeGreaterThanOrEqual(
      Math.ceil(mCentro.indicadores.recuperacionProyecto.anios! + 1)
    );
    expect(mCentro.issues.some((i) => i.codigo === 'HORIZONTE_CORTO')).toBe(false);
  });

  test('los resultados del centro DIFIEREN de los de la clínica (no son clones)', () => {
    expect(mCentro.indicadores.inversionTotalKUSD).not.toBeCloseTo(mClinica.indicadores.inversionTotalKUSD, 0);
    expect(mCentro.indicadores.ingresosTotales[1] ?? 0).not.toBeCloseTo(mClinica.indicadores.ingresosTotales[1] ?? 0, 0);
    expect(mCentro.indicadores.recuperacionProyecto.anios).not.toBeCloseTo(mClinica.indicadores.recuperacionProyecto.anios!, 1);
    // Dividendos solo al extranjero (participación cubana 0 %).
    expect(mCentro.dividendos.every((d) => d.socioNacional === 0)).toBe(true);
    expect(mClinica.dividendos.some((d) => d.socioNacional > 0)).toBe(true);
  });

  test('los ANÁLISIS se generan desde los resultados nuevos del centro', () => {
    const a = generarAnalisis(centro, mCentro);
    // El resumen menciona el centro, su horizonte y su inversión.
    expect(a.resumen_ejecutivo.texto).toContain('Centro de Diagnóstico');
    expect(a.resumen_ejecutivo.texto).toContain('8 años');
    expect(a.resumen_ejecutivo.texto).toContain('2.188,8'); // inversión del centro (tasa 743: 1 900 + 88,8 + 200 de capital de trabajo)
    // Escenario A declarado en el análisis de capacidad.
    expect(a.capacidad.texto).toContain('Escenario activo: A');
    expect(a.capacidad.texto).not.toContain('LIMITADO');
    // El análisis de deuda declara que NO hay crédito (coherente con los datos).
    expect(a.deuda_depreciacion.texto).toContain('no incluye crédito');
    // Las conclusiones derivan del modelo nuevo (recuperación ≈ 4,5 con tasa 743).
    expect(a.conclusiones.texto).toContain('4,5 años');
  });

  test('el diagnóstico del centro evalúa las dimensiones con datos propios', () => {
    const d = diagnosticar(centro, mCentro);
    // DOC-002 §5: las SEIS dimensiones independientes.
    const integridad = d.resumen.dimensiones.find((x) => x.id === 'integridad_aritmetica')!;
    expect(integridad.estado).toBe('ok');
    const coherencia = d.resumen.dimensiones.find((x) => x.id === 'coherencia_financiera_contable')!;
    expect(coherencia.detalle).toContain('2.188,8');
    expect(d.resumen.dimensiones.length).toBe(6);
    expect(d.resumen.dimensiones.map((x) => x.id)).toEqual([
      'integridad_aritmetica',
      'coherencia_financiera_contable',
      'evidencia_trazabilidad',
      'estructura_metodologica',
      'validacion_normativa_comercial',
      'calidad_documental',
    ]);
  });

  test('exporta PDF y Excel desde el estado del centro (coherentes con su modelo)', async () => {
    const pdf = exportarPDF(centro, mCentro);
    expect(pdf.nombre).toContain('Centro de Diagnóstico');
    expect(pdf.datos.size).toBeGreaterThan(40000);
    const xlsx = await exportarXLSX(centro, mCentro);
    expect(xlsx.datos.byteLength).toBeGreaterThan(40000);
    // El libro del centro contiene las hojas del motor con sus datos propios.
    const wb = XLSX.read(xlsx.datos, { type: 'array' });
    expect(wb.SheetNames).toContain('Capacidad');
    expect(wb.SheetNames).toContain('Dividendos');
    // Sin crédito: la hoja Deuda del centro queda en ceros por fórmula.
    const deuda = wb.Sheets['Deuda'] as Record<string, { v?: number }>;
    expect(deuda['H4']?.v ?? 0).toBeCloseTo(0, 4);
  });

  test('exporta JSON y reconstruye el proyecto completo con análisis propios', () => {
    const res = parsearProyectoJSON(proyectoAJSON(centro));
    expect(res.ok).toBe(true);
    const q = res.proyecto!;
    expect(q.planex.plantillaOrigen).toBe('centro');
    expect(q.ajustes.horizonteAnios).toBe(8);
    expect(q.servicios).toHaveLength(6);
    expect(q.financiero.deuda.habilitada).toBe(false);
    const m2 = computeProject(q);
    expect(m2.indicadores.inversionTotalKUSD).toBeCloseTo(mCentro.indicadores.inversionTotalKUSD, 6);
    expect(m2.indicadores.recuperacionProyecto.anios).toBeCloseTo(mCentro.indicadores.recuperacionProyecto.anios!, 6);
  });

  test('la plantilla Default sigue permitiendo crear un negocio DIFERENTE (generalización plena)', () => {
    const def = crearProyectoDefault();
    def.nombre = 'Servicios técnicos industriales «Habana Tec» (ejemplo)';
    def.ajustes.horizonteAnios = 6;
    def.servicios = [
      { id: 'st-1', nombre: 'Mantenimiento industrial (contrato anual)', precioBase: 1200, cantidadBaseMensual: 8, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 300, duracionMinutos: 240, recursoIds: [], fuente: 'supuesto' },
    ];
    def.aportaciones = [{ id: 'ap-1', socio: 'extranjero', tipo: 'efectivo', montos: [500, 0, 0], referenciaDocumental: '' }];
    def.financiero.inversion = [
      { id: 'iv-1', concepto: 'Herramienta y equipos de diagnóstico', categoria: 'inversion_fija', moneda: 'USD', monto: 300, vidaUtilAnios: 7, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: '' },
    ];
    def.personal = [{ id: 'pe-1', etapa: 'operacion', grupo: 'cubano_directivo', cantidad: 2, salarioPromedioAnualCUP: 240000 }];
    def.parametros.find((x) => x.id === 'capital_trabajo_k')!.valor = 50;
    const mDef = computeProject(def);
    // Motor común, negocio distinto: calcula y genera análisis propios.
    expect(mDef.ok).toBe(true);
    const aDef = generarAnalisis(def, mDef);
    expect(aDef.resumen_ejecutivo.texto).toContain('115,2'); // ingresos año 1: 8×12×1 200 USD
  });
});
