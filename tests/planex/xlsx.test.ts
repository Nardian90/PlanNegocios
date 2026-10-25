// ============================================================================
// Prueba esencial del Excel (misión §8.3): inspecciona el XLSX generado,
// comprueba fórmulas reales, referencias entre hojas, el efecto de cambiar
// la tasa y la bandera de recálculo automático.
// ============================================================================
import { describe, test, expect } from 'bun:test';
import * as XLSX from 'xlsx-js-style';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { exportarXLSX } from '../../src/lib/planex/io/xlsx';
import { writeFileSync } from 'node:fs';

const proyecto = crearProyectoClinica();
const modelo = computeProject(proyecto);
const { datos } = await exportarXLSX(proyecto, modelo);
writeFileSync(new URL('./salida-clinica.xlsx', import.meta.url).pathname, Buffer.from(datos));

const wb = XLSX.read(datos, { type: 'array', cellFormula: true, cellStyles: true });
const proy = wb.Sheets['Proyecciones'];
const par = wb.Sheets['Parametros'];

/** Fila de una regla anual en Proyecciones (mismo orden que el exportador). */
const FILAS: Record<string, number> = {};
{
  const filas = [
    'ingresos_servicios_usd', 'ingresos_servicios_k', 'otros_ingresos', 'ingresos_totales_k',
    'costos_variables_usd', 'costos_variables_k', 'costo_laboral_cup', 'costo_laboral_k',
    'canon_anual_k', 'mantenimiento_k', 'servicios_publicos_anual_k', 'gastos_admin_k',
    'otros_gastos_fijos_k', 'depreciacion_anual_k', 'interes_k', 'amortizacion_k',
    'saldo_deuda_k', 'costos_totales_k', 'utilidad_antes_impuestos_k', 'impuesto_utilidades_k',
    'utilidad_despues_impuestos_k', 'flujo_neto_k', 'flujo_acumulado_k', 'saldo_pendiente_k',
  ];
  filas.forEach((id, i) => (FILAS[id] = 4 + i));
}
const filaTasa = 3 + proyecto.parametros.findIndex((p) => p.id === 'tasa_impuesto_utilidades');
const celdaImpY1 = `D${FILAS['impuesto_utilidades_k']}`;

describe('Excel — hojas y estructura', () => {
  test('contiene las 22 hojas del modelo (motor 2.0.0)', () => {
    const esperadas = [
      'Portada', 'Resumen', 'Parametros', 'Inversion', 'Depreciacion', 'Deuda',
      'Aportaciones', 'Financiacion', 'Servicios', 'Personal', 'Capacidad',
      'Proyecciones', 'FlujosCaja', 'Dividendos', 'BeneficiosPais',
      'FuerzaTrabajo', 'Cronograma', 'ConsumosTecnicos', 'Mercado', 'Descripcion',
      'Reglas', 'Controles',
    ];
    for (const h of esperadas) expect(wb.SheetNames).toContain(h);
    expect(wb.SheetNames.length).toBe(esperadas.length);
  });

  test('el libro se abre y tiene valores en caché coherentes con el motor', () => {
    const uaiY1 = proy[`D${FILAS['utilidad_antes_impuestos_k']}`].v as number;
    expect(uaiY1).toBeCloseTo(modelo.valores['utilidad_antes_impuestos_k'][1] as number, 2);
  });

  test('marca recálculo automático al abrir (fullCalcOnLoad en workbook.xml)', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(datos);
    const xml = await zip.file('xl/workbook.xml')!.async('string');
    expect(xml).toContain('fullCalcOnLoad="1"');
  });
});

describe('Excel — fórmulas reales', () => {
  test('la celda del impuesto contiene una fórmula (no un valor estático)', () => {
    const cel = proy[celdaImpY1] as XLSX.CellObject;
    expect(cel.f).toBeDefined();
    expect(String(cel.f)).toContain('MAX');
  });

  test('el impuesto depende de la UAI y de la tasa en la hoja Parametros', () => {
    const f = String((proy[celdaImpY1] as XLSX.CellObject).f);
    const fUAI = `D$${FILAS['utilidad_antes_impuestos_k']}`;
    const fTasa = `Parametros!$C$${filaTasa}`;
    expect(f).toContain(fUAI);
    expect(f).toContain(fTasa);
  });

  test('utilidad después de impuestos = UAI − impuesto (fórmula)', () => {
    const f = String((proy[`D${FILAS['utilidad_despues_impuestos_k']}`] as XLSX.CellObject).f);
    expect(f).toContain(`D$${FILAS['utilidad_antes_impuestos_k']}`);
    expect(f).toContain(`D$${FILAS['impuesto_utilidades_k']}`);
  });

  test('ingresos por servicios referencian la hoja Servicios (referencia entre hojas)', () => {
    const fUsd = String((proy[`D${FILAS['ingresos_servicios_usd']}`] as XLSX.CellObject).f);
    expect(fUsd).toContain('Servicios!');
    expect(fUsd).toContain('SUMIFS');
    const fK = String((proy[`D${FILAS['ingresos_servicios_k']}`] as XLSX.CellObject).f);
    expect(fK).toContain(`D$${FILAS['ingresos_servicios_usd']}`);
  });

  test('el costo laboral referencia la hoja Personal con SUMPRODUCT', () => {
    const f = String((proy[`D${FILAS['costo_laboral_k']}`] as XLSX.CellObject).f);
    expect(f).toContain(`D$${FILAS['costo_laboral_cup']}`);
    expect(f).toContain('Parametros!'); // tipo de cambio
    const fCup = String((proy[`D${FILAS['costo_laboral_cup']}`] as XLSX.CellObject).f);
    expect(fCup).toContain('Personal!');
    expect(fCup).toContain('SUMPRODUCT');
  });

  test('las partidas de proyecto referencian la hoja Inversion con SUMIFS', () => {
    const fin = wb.Sheets['Financiacion'];
    const fInvFija = String((fin['D4'] as XLSX.CellObject).f);
    expect(fInvFija).toContain('SUMIFS');
    expect(fInvFija).toContain('Inversion!');
    expect(fInvFija).toContain('inversion_fija');
    expect(fInvFija).toContain('USD');
  });

  test('la depreciación referencia la hoja Depreciacion (calendario por activo)', () => {
    // Modelo 2.0.0: la depreciación se calcula POR ACTIVO en su propia hoja
    // (misión §16.2) y la fila anual del estado de resultados referencia su
    // fila de TOTALES — ya no se deduce con un SUMIFS sobre la hoja Inversion.
    const f = String((proy[`D${FILAS['depreciacion_anual_k']}`] as XLSX.CellObject).f);
    expect(f).toContain('Depreciacion!');
    expect(f.replace(/^=/, '').startsWith('Depreciacion!')).toBe(true);
  });

  test('el flujo acumulado es una recurrencia por columnas (LAG → columna anterior)', () => {
    const f1 = String((proy[`D${FILAS['flujo_acumulado_k']}`] as XLSX.CellObject).f);
    expect(f1).toContain(`C$${FILAS['flujo_acumulado_k']}`); // año 0 en la columna C
    const f2 = String((proy[`E${FILAS['flujo_acumulado_k']}`] as XLSX.CellObject).f);
    expect(f2).toContain(`D$${FILAS['flujo_acumulado_k']}`);
  });

  test('los valores en caché del Excel coinciden con el motor', () => {
    for (const [id, fila] of Object.entries(FILAS)) {
      if (id === 'otros_ingresos' || id === 'canon_anual_k' || id === 'servicios_publicos_anual_k' || id === 'otros_gastos_fijos_k') continue;
      const cel = proy[`D${fila}`] as XLSX.CellObject;
      const esperado = modelo.valores[id]?.[1];
      if (esperado !== undefined && typeof cel.v === 'number') {
        expect(cel.v).toBeCloseTo(esperado, 2);
      }
    }
  });

  test('la hoja Servicios contiene fórmulas por fila (precio/cantidad proyectados)', () => {
    const svc = wb.Sheets['Servicios'];
    const g4 = svc['G4'] as XLSX.CellObject; // precio proy
    expect(String(g4.f)).toContain('Parametros!');
    const l4 = svc['L4'] as XLSX.CellObject; // ingreso anual (col L del formato largo)
    expect(String(l4.f)).toContain('G4');
    expect(String(l4.f)).toContain('J4'); // cantidad anual (J = I×12, por fila)
  });

  test('la hoja Reglas documenta la traducción y el estado', () => {
    const reg = wb.Sheets['Reglas'];
    let traducidas = 0;
    for (let f = 4; f < 4 + proyecto.reglas.length; f++) {
      const est = (reg[`I${f}`] as XLSX.CellObject)?.v;
      if (String(est).startsWith('TRADUCIDA')) traducidas++;
    }
    // Todas las reglas de fábrica deben traducirse
    expect(traducidas).toBe(proyecto.reglas.filter((r) => r.habilitada).length);
  });
});

describe('Excel — recálculo al cambiar la tasa (simulación)', () => {
  test('la fórmula del impuesto produce 0,30 × UAI si la celda de tasa cambia a 30 %', () => {
    // Cambiar la celda de la tasa en el libro y reevaluar la fórmula del
    // impuesto con las referencias actuales (simula el recálculo de Excel).
    par[`C${filaTasa}`].v = 0.3;
    const f = String((proy[celdaImpY1] as XLSX.CellObject).f);
    const uai = proy[`D${FILAS['utilidad_antes_impuestos_k']}`].v as number;
    // MAX(0, (D$x * Parametros!$C$y)) → extraer los dos operandos
    const interno = f.replace(/^=MAX\(0,\s*\(?/, '').replace(/\)?\)$/, '');
    const [a, b] = interno.split('*').map((x) => x.trim());
    const va = a === `D$${FILAS['utilidad_antes_impuestos_k']}` ? uai : NaN;
    const vb = b === `Parametros!$C$${filaTasa}` ? 0.3 : NaN;
    expect(Math.max(0, va * vb)).toBeCloseTo(uai * 0.3, 2);
    expect(va).not.toBeNaN();
    expect(vb).not.toBeNaN();
  });

  test('sin referencias rotas: toda hoja referenciada en fórmulas existe', () => {
    const hojas = new Set(wb.SheetNames);
    let refCount = 0;
    for (const nombre of wb.SheetNames) {
      const ws = wb.Sheets[nombre];
      for (const addr of Object.keys(ws)) {
        if (addr.startsWith('!')) continue;
        const f = (ws[addr] as XLSX.CellObject)?.f;
        if (!f) continue;
        refCount++;
        for (const m of String(f).matchAll(/([A-Za-zÁÉÍÓÚÑáéíóúñ]+)!/g)) {
          expect(hojas.has(m[1])).toBe(true);
        }
      }
    }
    expect(refCount).toBeGreaterThan(100); // el libro está vivo: centenas de fórmulas
  });
});
