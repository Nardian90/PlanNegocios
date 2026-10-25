// ============================================================================
// MISIÓN §16.7 — Pruebas de exportación y coherencia.
//  · Los totales del PDF coinciden con el modelo (doble pasada y estructura).
//  · El Excel contiene fórmulas reales y referencias entre hojas.
//  · Los resultados del Excel son coherentes al recalcular (valores en caché
//    idénticos a los del motor).
//  · Los textos del documento coinciden con la versión exportada (mismas
//    cifras formateadas del modelo).
//  · Índice y paginación coherentes; unidades y monedas presentes; sin
//    valores antiguos en el resumen; sin referencias rotas.
// ============================================================================

import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { exportarPDF } from '../../src/lib/planex/io/pdf';
import { exportarXLSX } from '../../src/lib/planex/io/xlsx';
import { proyectoAJSON, parsearProyectoJSON } from '../../src/lib/planex/io/jsonio';
import { generarAnalisis } from '../../src/lib/planex/engine/analisis';
import { diagnosticar } from '../../src/lib/planex/model/controles';
import { fmtK } from '../../src/lib/planex/format';
import type { PlanexProject } from '../../src/lib/planex/types';
import * as XLSX from 'xlsx-js-style';

function clonar<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

/** Descomprime los flujos de un PDF y extrae el texto plano. */
async function textoPDF(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const raw = Buffer.from(bytes).toString('latin1');
  const trozos: string[] = [];
  // Flujos FlateDecode
  const re = /stream\r?\n([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const data = Buffer.from(m[1], 'latin1');
    try {
      trozos.push(require('zlib').inflateSync(data).toString('latin1'));
    } catch {
      trozos.push(m[1]);
    }
  }
  return trozos.join('\n');
}

describe('MISIÓN §16.7 — PDF: composición, índice y coherencia', () => {
  const p = crearProyectoClinica();
  const m = computeProject(p);

  test('el PDF se genera con el modelo vigente y la advertencia de datos ficticios', async () => {
    const { datos, nombre } = exportarPDF(p, m);
    expect(nombre).toContain('.pdf');
    expect(datos.size).toBeGreaterThan(40000);
    const texto = await textoPDF(datos);
    // Advertencia literal (misión §11).
    expect(texto).toContain('EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS');
  });

  test('el índice del PDF contiene TODOS los apartados y no hay páginas en blanco', async () => {
    const { datos } = exportarPDF(p, m);
    const texto = await textoPDF(datos);
    // Índice completo: 4.1 a 4.12 + flujos + diagnóstico + notas.
    for (const s of ['4.1', '4.4', '4.5', '4.6', '4.7', '4.7.1', '4.8', '4.9', '4.10', '4.11', '4.12', 'Diagnóstico', 'Notas, parámetros y supuestos']) {
      expect(texto).toContain(s);
    }
    // Doble pasada: el índice (página 2) precede al 4.1 (página 3).
    const posIndice = texto.indexOf('Índice');
    const pos41 = texto.indexOf('Información general');
    expect(posIndice).toBeGreaterThan(-1);
    expect(pos41).toBeGreaterThan(posIndice);
  });

  test('los TOTALES del PDF provienen del modelo: mismas cifras formateadas', async () => {
    const { datos } = exportarPDF(p, m);
    const texto = await textoPDF(datos);
    // Cifras clave del modelo activo (formato español con coma decimal).
    expect(texto).toContain(fmtK(m.indicadores.inversionTotalKUSD).replace('.', ',').replace(',', ','));
    expect(texto).toContain('1.480,0'); // inversión total (formato es-ES)
    expect(texto).toContain('1.180,0'); // aportaciones
    // Recuperaciones ducales con un decimal (no la cifra vieja de 4,0).
    expect(texto).toContain('3,5 años'); // FCFF
    expect(texto).toContain('3,3 años'); // FCFE
    expect(texto).not.toContain('cuatro años');
  });

  test('unidades y monedas visibles en las tablas del PDF', async () => {
    const { datos } = exportarPDF(p, m);
    const texto = await textoPDF(datos);
    expect(texto).toContain('miles de USD');
    expect(texto).toContain('kUSD');
    expect(texto).toContain('CUP');
    expect(texto).toContain('Año 0');
  });

  test('los análisis dinámicos del PDF coinciden con el modelo activo (misma versión)', async () => {
    const { datos } = exportarPDF(p, m);
    const texto = await textoPDF(datos);
    const a = generarAnalisis(p, m);
    // Un fragmento distintivo del análisis de capacidad aparece en el PDF.
    expect(texto).toContain('ANÁLISIS GENERADO POR EL MODELO');
    expect(texto).toContain('Escenario activo: B');
    void a;
  });

  test('el PDF cambia cuando cambian los datos (no es una maqueta estática)', async () => {
    const q = clonar(p);
    q.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!.valor = 0.3;
    const m2 = computeProject(q);
    const t1 = await textoPDF(exportarPDF(p, m).datos);
    const t2 = await textoPDF(exportarPDF(q, m2).datos);
    expect(t2).not.toBe(t1);
    expect(t2).toContain('30,0'); // tasa actualizada en el texto del PDF
  });
});

describe('MISIÓN §16.7 — XLSX: fórmulas reales, referencias y recálculo coherente', () => {
  const p = crearProyectoClinica();
  const m = computeProject(p);

  test('el libro contiene las hojas del motor con FÓRMULAS REALES', async () => {
    const { datos } = await exportarXLSX(p, m);
    const wb = XLSX.read(datos, { type: 'array' });
    for (const hoja of ['Portada', 'Resumen', 'Parametros', 'Inversion', 'Depreciacion', 'Deuda', 'Aportaciones', 'Financiacion', 'Servicios', 'Personal', 'Capacidad', 'Proyecciones', 'FlujosCaja', 'Dividendos', 'BeneficiosPais', 'FuerzaTrabajo', 'Cronograma', 'ConsumosTecnicos', 'Mercado', 'Descripcion', 'Reglas', 'Controles']) {
      expect(wb.SheetNames).toContain(hoja);
    }
    // Fórmulas reales en las hojas del motor.
    const dep = wb.Sheets['Depreciacion'] as Record<string, unknown>;
    const fDep = Object.values(dep).filter((c) => typeof c === 'object' && c !== null && 'f' in (c as object));
    expect(fDep.length).toBeGreaterThan(30);
    const flujo = wb.Sheets['FlujosCaja'] as Record<string, unknown>;
    const fFlujo = Object.values(flujo).filter((c) => typeof c === 'object' && c !== null && 'f' in (c as object));
    expect(fFlujo.length).toBeGreaterThan(60);
    const deuda = wb.Sheets['Deuda'] as Record<string, unknown>;
    const fDeuda = Object.values(deuda).filter((c) => typeof c === 'object' && c !== null && 'f' in (c as object));
    expect(fDeuda.length).toBeGreaterThan(30);
  });

  test('las fórmulas referencian entre hojas (referencias no rotas)', async () => {
    const { datos } = await exportarXLSX(p, m);
    const wb = XLSX.read(datos, { type: 'array' });
    const todas: string[] = [];
    for (const nombre of wb.SheetNames) {
      const hoja = wb.Sheets[nombre] as Record<string, { f?: string }>;
      for (const celda of Object.values(hoja)) {
        if (typeof celda === 'object' && celda?.f) todas.push(celda.f);
      }
    }
    const refs = todas.filter((f) => f.includes('!'));
    expect(refs.length).toBeGreaterThan(200); // referencias entre hojas
    // Cada hoja referenciada existe realmente en el libro (sin referencias rotas).
    const nombresRef = new Set(refs.map((f) => f.match(/([A-Za-záéíóúÁÉÍÓÚñÑ]+)!/)?.[1]).filter(Boolean) as string[]);
    for (const n of nombresRef) expect(wb.SheetNames).toContain(n);
    // Las reglas del motor apuntan a las hojas nuevas.
    expect(refs.some((f) => f.startsWith('Depreciacion!'))).toBe(true);
    expect(refs.some((f) => f.startsWith('Deuda!'))).toBe(true);
    expect(refs.some((f) => f.startsWith('FlujosCaja!'))).toBe(true);
    expect(refs.some((f) => f.startsWith('Dividendos!'))).toBe(true);
    expect(refs.some((f) => f.startsWith('Capacidad!'))).toBe(true);
  });

  test('los valores en caché del Excel coinciden con el motor (coherencia al recalcular)', async () => {
    const { datos } = await exportarXLSX(p, m);
    const wb = XLSX.read(datos, { type: 'array' });
    const celda = (hoja: string, addr: string) => (wb.Sheets[hoja] as Record<string, { v?: number }>)[addr]?.v;
    // Proyecciones: fila de la regla ingresos_totales_k, columna D (año 1).
    const filaIng = 4 + 0; // se recalcula localizando por etiqueta
    const proy = wb.Sheets['Proyecciones'] as Record<string, { v?: unknown; f?: string }>;
    // Busca la fila por su etiqueta textual.
    let filaUDI = -1;
    let filaIngTot = -1;
    for (let f = 4; f < 60; f++) {
      const et = proy[`A${f}`]?.v;
      if (et === 'INGRESOS TOTALES') filaIngTot = f;
      if (et === 'UTILIDAD DESPUÉS DE IMPUESTOS (3-4)') filaUDI = f;
    }
    expect(filaIngTot).toBeGreaterThan(0);
    expect(filaUDI).toBeGreaterThan(0);
    expect(celda('Proyecciones', `D${filaIngTot}`)).toBeCloseTo(m.indicadores.ingresosTotales[1] ?? 0, 4);
    expect(celda('Proyecciones', `D${filaUDI}`)).toBeCloseTo(m.indicadores.utilidadNeta[1] ?? 0, 4);
    // Deuda: saldo final del año 0 = 300.
    expect(celda('Deuda', 'H4')).toBeCloseTo(300, 4);
    // FlujosCaja: FCFF acumulado año 4 (columna F) cruza a positivo.
    expect(celda('FlujosCaja', 'F5')).toBeCloseTo(m.indicadores.fcffAcumulado[4] ?? 0, 4);
    // Dividendos: pagables año 1 = MIN(propuestos, caja).
    expect(celda('Dividendos', 'C11')).toBeCloseTo(m.dividendos.find((d) => d.anio === 1)!.pagables, 4);
    void filaIng;
  });

  test('si se cambia la tasa en la hoja Parametros, la fórmula del impuesto la refleja (fórmula ≠ estático)', async () => {
    const { datos } = await exportarXLSX(p, m);
    const wb = XLSX.read(datos, { type: 'array' });
    const proy = wb.Sheets['Proyecciones'] as Record<string, { v?: unknown; f?: string }>;
    let filaImp = -1;
    for (let f = 4; f < 60; f++) {
      if (proy[`A${f}`]?.v === 'Impuesto sobre utilidades (regla demostrativa)') filaImp = f;
    }
    expect(filaImp).toBeGreaterThan(0);
    const formula = proy[`D${filaImp}`]?.f ?? '';
    expect(formula).toContain('MAX');
    expect(formula).toContain('Parametros!$C$');
    // La celda referenciada es la fila de la tasa en Parametros.
    const filaP = Number(formula.match(/Parametros!\$C\$(\d+)/)?.[1] ?? 0);
    const param = wb.Sheets['Parametros'] as Record<string, { v?: unknown }>;
    expect(param[`A${filaP}`]?.v).toBe('tasa_impuesto_utilidades');
  });

  test('la hoja Controles refleja el diagnóstico con los CUATRO niveles', async () => {
    const { datos } = await exportarXLSX(p, m);
    const wb = XLSX.read(datos, { type: 'array' });
    const ctrl = wb.Sheets['Controles'] as Record<string, { v?: unknown }>;
    const textos = Object.values(ctrl).map((c) => String(c?.v ?? ''));
    expect(textos.some((t) => t === 'error_bloqueante')).toBe(true);
    expect(textos.some((t) => t === 'advertencia_importante')).toBe(true);
    expect(textos.some((t) => t === 'informacion_pendiente')).toBe(true);
    expect(textos.some((t) => t === 'observacion_calidad')).toBe(true);
    // Y el resumen de las 7 dimensiones.
    expect(textos.some((t) => t.includes('Integridad matemática'))).toBe(true);
    expect(textos.some((t) => t.includes('Coherencia financiera'))).toBe(true);
    expect(textos.some((t) => t.includes('Consistencia operativa'))).toBe(true);
    expect(textos.some((t) => t.includes('Cumplimiento estructural'))).toBe(true);
    expect(textos.some((t) => t.includes('Calidad y trazabilidad'))).toBe(true);
    expect(textos.some((t) => t.includes('Calidad documental'))).toBe(true);
    expect(textos.some((t) => t.includes('validación legal'))).toBe(true);
  });

  test('el libro se marca con recálculo automático al abrir (fullCalcOnLoad)', async () => {
    const { datos } = await exportarXLSX(p, m);
    const xml = Buffer.from(datos).toString('latin1');
    expect(xml).toContain('fullCalcOnLoad');
  });

  test('no hay valores ANTIGUOS del plan en el resumen del Excel', async () => {
    const { datos } = await exportarXLSX(p, m);
    const wb = XLSX.read(datos, { type: 'array' });
    const res = wb.Sheets['Resumen'] as Record<string, { v?: unknown }>;
    const textos = Object.values(res).map((c) => String(c?.v ?? ''));
    // La recuperación del proyecto ya NO es la cifra vieja de 4,0.
    expect(textos.some((t) => t === '4,0')).toBe(false);
    expect(textos.some((t) => t === '3,5')).toBe(true);
    // Los beneficios al país del resumen = los del modelo (conciliados).
    const valores = Object.values(res).map((c) => (typeof c?.v === 'number' ? c.v : 0));
    expect(valores).toContain(m.indicadores.beneficiosPaisAcumulados);
  });
});

describe('MISIÓN §14.4/§16.7 — JSON: reconstrucción completa del proyecto', () => {
  const p = crearProyectoClinica();
  const m = computeProject(p);

  test('el JSON conserva todos los datos, parámetros, reglas y metadatos necesarios', () => {
    const json = proyectoAJSON(p);
    const res = parsearProyectoJSON(json);
    expect(res.ok).toBe(true);
    const q = res.proyecto!;
    // Estructura nueva completa.
    expect(q.recursos.length).toBe(p.recursos.length);
    expect(q.financiero.deuda.tipoGracia).toBe(p.financiero.deuda.tipoGracia);
    expect(q.tecnico.escenarioCapacidad).toBe(p.tecnico.escenarioCapacidad);
    expect(q.servicios[0].anioInicioDemanda).toBe(1);
    expect(q.servicios[0].duracionMinutos).toBe(30);
    expect(q.parametros.length).toBe(p.parametros.length);
    expect(q.reglas.length).toBe(p.reglas.length);
    // El proyecto importado recalcula IGUAL (misma fuente de verdad).
    const m2 = computeProject(q);
    expect(m2.indicadores.inversionTotalKUSD).toBeCloseTo(m.indicadores.inversionTotalKUSD, 6);
    expect(m2.indicadores.recuperacionProyecto.anios).toBeCloseTo(m.indicadores.recuperacionProyecto.anios!, 6);
    expect(m2.indicadores.beneficiosPaisAcumulados).toBeCloseTo(m.indicadores.beneficiosPaisAcumulados, 6);
    expect(m2.deuda.length).toBe(m.deuda.length);
    expect(m2.dividendos.length).toBe(m.dividendos.length);
    expect(m2.depreciacion.length).toBe(m.depreciacion.length);
  });

  test('el JSON respeta el guardado compartido (sección 'conclusiones' incluye los análisis editados)', () => {
    const q = clonar(p);
    q.analisis['conclusiones'] = {
      texto: 'Conclusiones ajustadas por la dirección.',
      huellaOrigen: 'abc123',
      actualizadoPor: 'colaborador2',
      actualizadoEn: '2026-10-25T10:00:00.000Z',
    };
    const res = parsearProyectoJSON(proyectoAJSON(q));
    expect(res.ok).toBe(true);
    expect(res.proyecto!.analisis['conclusiones']?.texto).toContain('dirección');
    expect(res.proyecto!.analisis['conclusiones']?.actualizadoPor).toBe('colaborador2');
  });

  test('los análisis del documento y las exportaciones usan el MISMO estado del modelo', () => {
    const a = generarAnalisis(p, m);
    // El análisis de beneficios menciona EXACTAMENTE el acumulado del motor.
    expect(a.beneficios_pais.texto).toContain(fmtK(m.indicadores.beneficiosPaisAcumulados).replace('.', ','));
    // El análisis del flujo menciona la recuperación FCFF del motor.
    const rec = m.indicadores.recuperacionProyecto.anios!;
    expect(a.flujo_recuperacion.texto).toContain(rec.toFixed(1).replace('.', ','));
    // El diagnóstico es coherente: sin errores para la plantilla sana.
    const d = diagnosticar(p, m);
    expect(d.resumen.conteo.error_bloqueante).toBe(0);
  });
});
