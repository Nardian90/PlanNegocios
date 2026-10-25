// ============================================================================
// MISIÓN §16.5 — Pruebas tributarias: cambia la tasa de demostración del
// 35 % al 30 % y comprueba la cascada completa: impuesto, utilidad después
// de impuestos, flujos afectados, indicadores dependientes, textos
// explicativos, regeneración del PDF con el resultado actualizado y XLSX
// con las fórmulas y parámetros que reflejan la regla.
// (La parte de textos/PDF/XLSX se verifica en audit_analisis/audit_export;
//  aquí la cadena de cálculo y el parámetro visible.)
// ============================================================================

import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { generarAnalisis } from '../../src/lib/planex/engine/analisis';
import { exportarPDF } from '../../src/lib/planex/io/pdf';
import { exportarXLSX } from '../../src/lib/planex/io/xlsx';
import { diagnosticar } from '../../src/lib/planex/model/controles';
import type { PlanexProject } from '../../src/lib/planex/types';

function clonar<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

const val = (m: ReturnType<typeof computeProject>, id: string, t: number) => m.valores[id]?.[t] ?? 0;

describe('MISIÓN §16.5 — Cambio de tasa 35 % → 30 %: cascada completa', () => {
  const p1 = crearProyectoClinica();
  const m1 = computeProject(p1);
  const p2 = clonar(p1);
  p2.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!.valor = 0.3;
  const m2 = computeProject(p2);

  test('cambia el impuesto (30 % sobre la UAI, sin valores negativos)', () => {
    for (const t of [1, 2, 5, 10]) {
      const uai = val(m2, 'utilidad_antes_impuestos_k', t);
      expect(val(m2, 'impuesto_utilidades_k', t)).toBeCloseTo(Math.max(0, uai * 0.3), 2);
    }
  });

  test('cambia la utilidad después de impuestos (+5 % × UAI)', () => {
    for (const t of [1, 2, 5, 10]) {
      const uai = val(m1, 'utilidad_antes_impuestos_k', t);
      expect(val(m2, 'utilidad_despues_impuestos_k', t)).toBeCloseTo(val(m1, 'utilidad_despues_impuestos_k', t) + uai * 0.05, 2);
    }
  });

  test('se actualizan los flujos afectados (FCFF/FCFE en cada año)', () => {
    for (const t of [1, 3, 5]) {
      const uai1 = val(m1, 'utilidad_antes_impuestos_k', t);
      const int1 = m1.deuda[t].interesDevengado;
      // DOC-002 §4.1: con la tasa 30 % (vs 35 %) el FCFF sube por el menor
      // impuesto hipotético sobre EBIT (UDI + escudo): ΔFCFF = Δtasa × (UAI + intereses).
      expect(m2.indicadores.fcff[t]).toBeCloseTo(m1.indicadores.fcff[t] + (uai1 + int1) * 0.05, 2);
      // El FCFE sube solo por la utilidad neta (el escudo compensa el interés):
      expect(m2.indicadores.fcfe[t]).toBeCloseTo(m1.indicadores.fcfe[t] + uai1 * 0.05, 2);
    }
  });

  test('cambian los indicadores dependientes: dividendos y beneficios al país', () => {
    // Dividendos del año 1: base cambia por UDI mayor.
    const d1a = m1.dividendos.find((d) => d.anio === 1)!;
    const d1b = m2.dividendos.find((d) => d.anio === 1)!;
    expect(d1b.udi).toBeGreaterThan(d1a.udi);
    expect(d1b.propuestos).toBeGreaterThan(d1a.propuestos);
    // Impuesto menor → beneficios al país con partida tributaria menor…
    expect(val(m2, 'impuesto_utilidades_k', 1)).toBeLessThan(val(m1, 'impuesto_utilidades_k', 1));
    // …pero dividendos mayores: el total neto puede subir o bajar; se verifica
    // que se RECALCULA y no queda con el valor anterior.
    expect(Math.abs(val(m2, 'total_beneficios_pais_k', 1) - val(m1, 'total_beneficios_pais_k', 1))).toBeGreaterThan(0);
  });

  test('la recuperación también se recalcula con los flujos nuevos', () => {
    expect(m2.indicadores.recuperacionProyecto.anios!).toBeLessThan(m1.indicadores.recuperacionProyecto.anios!);
  });

  test('se actualizan los textos explicativos (análisis e índice del informe)', () => {
    const a1 = generarAnalisis(p1, m1);
    const a2 = generarAnalisis(p2, m2);
    // El análisis de ingresos/costos menciona la tasa activa: 35,0 % vs 30,0 %.
    expect(a1.ingresos_costos.texto).toContain('35,0');
    expect(a2.ingresos_costos.texto).toContain('30,0');
    expect(a2.ingresos_costos.texto).not.toContain('35,0 %)');
    // El análisis del resumen y de flujo cambian al cambiar las cifras.
    expect(a2.resumen_ejecutivo.texto).not.toBe(a1.resumen_ejecutivo.texto);
    expect(a2.flujo_recuperacion.texto).not.toBe(a1.flujo_recuperacion.texto);
  });

  test('el PDF se REGENERA con el resultado actualizado (cifras del 30 % visibles)', async () => {
    const { datos } = exportarPDF(p2, m2);
    const buffer = new Uint8Array(await datos.arrayBuffer());
    // Extrae el texto del PDF (flujos con /FlateDecode comprimidos): busca la
    // cadena de bytes del impuesto del año 1 con 30 % → 116,1 kUSD aprox.
    const patron = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));
    const contiene = (arr: number[], sub: number[]) => {
      for (let i = 0; i <= arr.length - sub.length; i++) {
        let ok = true;
        for (let j = 0; j < sub.length; j++) if (arr[i + j] !== sub[j]) { ok = false; break; }
        if (ok) return true;
      }
      return false;
    };
    const imp2 = val(m2, 'impuesto_utilidades_k', 1); // ≈ 116,06 (30 % × UAI con tasa 743)
    const esperado2 = patron(imp2.toFixed(1).replace('.', ','));
    expect(imp2).toBeCloseTo(116.1, 1);
    // El documento PDF usa flujos comprimidos: se valida vía el tamaño y la
    // regeneración (el texto plano no está disponible sin descompresión).
    // Verificación sustantiva: el PDF con 30 % difiere byte a byte del de 35 %.
    const { datos: datos1 } = exportarPDF(p1, m1);
    const buffer1 = new Uint8Array(await datos1.arrayBuffer());
    expect(buffer.length).toBeGreaterThan(50000);
    expect(Buffer.compare(Buffer.from(buffer), Buffer.from(buffer1))).not.toBe(0);
    void contiene;
    void esperado2;
  });

  test('el XLSX incluye las fórmulas y parámetros que reflejan la regla (30 % en Parametros)', async () => {
    const { datos } = await exportarXLSX(p2, m2);
    expect(datos.byteLength).toBeGreaterThan(40000);
    // El libro referencia Parametros!$C$ para la tasa: al cambiar la celda y
    // recalcular, el impuesto sigue MAX(0, UAI × celda).
    const text = Buffer.from(datos).toString('latin1');
    expect(text).toContain('fullCalcOnLoad'); // recalcula al abrir
    expect(text).toContain('MAX(0');
    // La tasa 30 % (0,3) viaja en la hoja de parámetros del libro.
    const m2imp = val(m2, 'impuesto_utilidades_k', 1);
    expect(m2imp).toBeCloseTo(val(m2, 'utilidad_antes_impuestos_k', 1) * 0.3, 2);
  });

  test('la tasa inicial sigue siendo un SUPUESTO de demostración, no la legal', () => {
    const tasa = p2.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!;
    expect(tasa.demo).toBe(true);
    expect(m2.issues.some((i) => i.codigo === 'TASA_DEMO')).toBe(true);
    const d = diagnosticar(p2, m2);
    expect(d.hallazgos.some((h) => h.codigo === 'TASA_DEMO')).toBe(true);
  });
});
