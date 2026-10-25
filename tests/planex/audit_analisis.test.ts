// ============================================================================
// MISIÓN §16.6 — Pruebas de análisis narrativo (reacción de los TEXTOS).
//  · Si los ingresos bajan, el análisis refleja la disminución.
//  · Si un servicio supera su capacidad, se explica la restricción.
//  · Si aparece insuficiencia de financiación, se explica el importe.
//  · Si cambia la tasa, se actualiza el análisis del resultado.
//  · Si la recuperación queda fuera del horizonte, las conclusiones dejan
//    de afirmar que se recupera dentro.
//  · Si los datos de mercado carecen de fuente, el análisis indica la
//    limitación; si se corrige una inconsistencia, las alertas se actualizan.
//  · Trazabilidad (§12.13): editado → desactualizado → regenerado.
// Se inspecciona el CONTENIDO TEXTUAL, no solo los importes.
// ============================================================================

import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { generarAnalisis, estadoAnalisis, type ClaveAnalisis } from '../../src/lib/planex/engine/analisis';
import { diagnosticar } from '../../src/lib/planex/model/controles';
import type { PlanexProject } from '../../src/lib/planex/types';

function clonar<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

const val = (m: ReturnType<typeof computeProject>, id: string, t: number) => m.valores[id]?.[t] ?? 0;

describe('MISIÓN §16.6 — Los análisis reaccionan a los cambios de datos', () => {
  test('si los ingresos BAJAN, el análisis de ingresos/costos refleja la disminución', () => {
    const p1 = crearProyectoClinica();
    const m1 = computeProject(p1);
    const p2 = clonar(p1);
    p2.parametros.find((x) => x.id === 'crecimiento_volumen')!.valor = 0;
    p2.servicios.forEach((s) => {
      s.precioBase = s.precioBase * 0.6;
    });
    const m2 = computeProject(p2);
    expect(val(m2, 'ingresos_servicios_k', 1)).toBeLessThan(val(m1, 'ingresos_servicios_k', 1));
    const a1 = generarAnalisis(p1, m1).ingresos_costos.texto;
    const a2 = generarAnalisis(p2, m2).ingresos_costos.texto;
    expect(a2).not.toBe(a1);
    // El texto nuevo contiene el valor recalculado (≈ 580,7 kUSD) y declina.
    expect(a2).toContain('580,7');
    expect(a2).toContain('DESCIENDE');
  });

  test('si un servicio supera su CAPACIDAD, el análisis explica la restricción (no la vende como crecimiento)', () => {
    const p = clonar(crearProyectoClinica());
    p.tecnico.escenarioCapacidad = 'A_constante'; // sin ampliación: excede en años 9-10
    const m = computeProject(p);
    const a = generarAnalisis(p, m).capacidad.texto;
    expect(a).toContain('LIMITADO'); // "El modelo ha LIMITADO los ingresos…"
    expect(a).toContain('no puede atenderse');
    expect(m.issues.some((i) => i.codigo === 'CAPACIDAD')).toBe(true);
  });

  test('si aparece INSUFICIENCIA DE FINANCIACIÓN, el análisis explica el importe y la acción', () => {
    const p = clonar(crearProyectoClinica());
    p.aportaciones.find((a) => a.id === 'ap-na-ef')!.montos = [40, 0, 0]; // −100 kUSD
    const m = computeProject(p);
    const dif = val(m, 'diferencia_financiacion_k', 0);
    expect(dif).toBeCloseTo(-100, 1);
    const a = generarAnalisis(p, m).inversion_financiacion.texto;
    expect(a).toContain('insuficiencia de financiación de 100,0 kUSD');
    expect(a).toContain('no es financiable');
    // Y el resumen ejecutivo lo lista entre los riesgos.
    const r = generarAnalisis(p, m).resumen_ejecutivo.texto;
    expect(r).toContain('financiación insuficiente');
  });

  test('si la RECUPERACIÓN queda fuera del horizonte, el análisis deja de afirmar que se recupera', () => {
    const p = clonar(crearProyectoClinica());
    p.ajustes.horizonteAnios = 2;
    const m = computeProject(p);
    const a = generarAnalisis(p, m).flujo_recuperacion.texto;
    expect(a).toContain('NO se recupera dentro del horizonte');
    expect(a).not.toContain('se recupera en');
    const c = generarAnalisis(p, m).conclusiones.texto;
    expect(c).toContain('NO recupera');
    expect(/recupera la inversión total en \d/.test(c)).toBe(false);
  });

  test('si faltan FUENTES de mercado, el análisis indica la limitación; si se documentan, cambia', () => {
    const p1 = clonar(crearProyectoClinica()); // fuentes marcadas como ficticias
    const m1 = computeProject(p1);
    const a1 = generarAnalisis(p1, m1).mercado.texto;
    expect(a1).toContain('SUPUESTO de demostración');
    const p2 = clonar(p1);
    p2.mercado.fuentesConsulta = 'Estudio de demanda de la Dirección Provincial de Salud (2026-09), encuesta propia (2026-08).';
    p2.mercado.demandaAparente = '38 000 personas con indicación clínica anual (estudio citado).';
    p2.mercado.demandaSolvente = '12 000 con capacidad de pago confirmada (encuesta propia).';
    const m2 = computeProject(p2);
    const a2 = generarAnalisis(p2, m2).mercado.texto;
    expect(a2).toContain('documentadas');
    expect(a2).not.toContain('SUPUESTO de demostración');
  });

  test('si se corrige una inconsistencia, las alertas y el análisis se actualizan', () => {
    const p = clonar(crearProyectoClinica());
    p.tecnico.escenarioCapacidad = 'A_constante';
    const mA = computeProject(p);
    expect(generarAnalisis(p, mA).capacidad.texto).toContain('no puede atenderse');
    const dA = diagnosticar(p, mA);
    expect(dA.hallazgos.some((h) => h.codigo === 'CAPACIDAD')).toBe(true);
    // Corrección: se reactiva el escenario B con la ampliación programada.
    p.tecnico.escenarioCapacidad = 'B_ampliacion';
    const mB = computeProject(p);
    const dB = diagnosticar(p, mB);
    expect(dB.hallazgos.some((h) => h.codigo === 'CAPACIDAD')).toBe(false);
    expect(generarAnalisis(p, mB).capacidad.texto).not.toContain('no puede atenderse');
  });

  test('si cambia la TASA tributaria, el análisis del resultado se actualiza', () => {
    const p1 = crearProyectoClinica();
    const m1 = computeProject(p1);
    const p2 = clonar(p1);
    p2.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!.valor = 0.3;
    const m2 = computeProject(p2);
    const a1 = generarAnalisis(p1, m1).ingresos_costos.texto;
    const a2 = generarAnalisis(p2, m2).ingresos_costos.texto;
    expect(a1).toContain('35,0 %');
    expect(a2).toContain('30,0 %');
    // El impuesto del año 1 mencionado cambia de 135,4 (35 % × UAI con tasa 743)
    // a 116,1 (30 % × la misma UAI).
    expect(a1).toContain('135,4');
    expect(a2).toContain('116,1');
  });

  test('el resumen ejecutivo NUNCA se presenta como viable si hay errores o advertencias críticas', () => {
    const p = clonar(crearProyectoClinica());
    p.reglas.find((r) => r.id === 'impuesto_utilidades_k')!.expresion = 'MAX(0, utilidad_antes_impuestos_k * tasa_impuesto_utilidades';
    const m = computeProject(p);
    const r = generarAnalisis(p, m).resumen_ejecutivo.texto;
    expect(r).toContain('errores de cálculo sin resolver');
    expect(r).toContain('no puede presentarse como una evaluación favorable');
  });

  test('con el modelo sano, el resumen NO esconde los datos pendientes de verificar', () => {
    const p = crearProyectoClinica();
    const m = computeProject(p);
    const r = generarAnalisis(p, m).resumen_ejecutivo.texto;
    expect(r).toContain('Datos pendientes de verificar');
    expect(r).toContain('tasa tributaria aplicable');
  });
});

describe('MISIÓN §12.13 — Trazabilidad de los textos (generado / manual / desactualizado)', () => {
  test('estado inicial: todos los análisis «generado» con el texto del modelo', () => {
    const p = crearProyectoClinica();
    const m = computeProject(p);
    const a = generarAnalisis(p, m);
    for (const clave of ['aportaciones', 'capacidad', 'conclusiones'] as ClaveAnalisis[]) {
      const est = estadoAnalisis(p, clave, a[clave]);
      expect(est.estado).toBe('generado');
      expect(est.texto).toBe(a[clave].texto);
    }
  });

  test('edición manual con huella actual → estado «manual» y texto del usuario', () => {
    const p = crearProyectoClinica();
    const m = computeProject(p);
    const a = generarAnalisis(p, m);
    p.analisis['capacidad'] = {
      texto: 'Valoración propia del equipo: la ampliación de gabinetes es viable.',
      huellaOrigen: a.capacidad.huella,
      actualizadoPor: 'colaborador1',
      actualizadoEn: '2026-10-25T12:00:00.000Z',
    };
    const est = estadoAnalisis(p, 'capacidad', a.capacidad);
    expect(est.estado).toBe('manual');
    expect(est.texto).toContain('Valoración propia del equipo');
  });

  test('si los datos cambian tras la edición, el estado pasa a «desactualizado» (sin sobrescribir)', () => {
    const p = crearProyectoClinica();
    const m1 = computeProject(p);
    const a1 = generarAnalisis(p, m1);
    p.analisis['flujo_recuperacion'] = {
      texto: 'Interpretación del elaborador con los datos de ayer.',
      huellaOrigen: a1.flujo_recuperacion.huella,
    };
    // Cambia el modelo: el crecimiento de precios baja.
    p.parametros.find((x) => x.id === 'crecimiento_precios')!.valor = 0.01;
    const m2 = computeProject(p);
    const a2 = generarAnalisis(p, m2);
    const est = estadoAnalisis(p, 'flujo_recuperacion', a2.flujo_recuperacion);
    expect(est.estado).toBe('desactualizado');
    expect(est.texto).toContain('datos de ayer'); // no se sobrescribe
    expect(est.texto).not.toBe(a2.flujo_recuperacion.texto);
    // Regenerar restaura el texto del modelo actual.
    delete p.analisis['flujo_recuperacion'];
    const est3 = estadoAnalisis(p, 'flujo_recuperacion', a2.flujo_recuperacion);
    expect(est3.estado).toBe('generado');
    expect(est3.texto).toBe(a2.flujo_recuperacion.texto);
  });

  test('la huella del análisis cambia con cada dato relevante (no con el tiempo)', () => {
    const p1 = crearProyectoClinica();
    const m1 = computeProject(p1);
    const a1 = generarAnalisis(p1, m1);
    // Recalcular SIN cambios → misma huella (determinista).
    const a1b = generarAnalisis(p1, computeProject(p1));
    expect(a1b.conclusiones.huella).toBe(a1.conclusiones.huella);
    // Un cambio de tasa → huella distinta en los análisis que la usan.
    const p2 = clonar(p1);
    p2.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!.valor = 0.3;
    const a2 = generarAnalisis(p2, computeProject(p2));
    expect(a2.ingresos_costos.huella).not.toBe(a1.ingresos_costos.huella);
    expect(a2.conclusiones.huella).not.toBe(a1.conclusiones.huella);
  });

  test('el diagnóstico señala los análisis desactualizados como observación de calidad', () => {
    const p = crearProyectoClinica();
    const m = computeProject(p);
    p.analisis['conclusiones'] = { texto: 'Texto viejo.', huellaOrigen: 'huella-que-no-coincide' };
    const d = diagnosticar(p, m);
    const h = d.hallazgos.find((x) => x.codigo === 'ANALISIS_REVISAR');
    expect(h).toBeDefined();
    expect(h!.nivel).toBe('observacion_calidad');
    expect(h!.mensaje).toContain('conclusiones');
  });
});
