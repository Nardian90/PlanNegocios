// ============================================================================
// MISIÓN §16.4 — Pruebas de capacidad.
// Modifica: precio, cantidad prevista, capacidad mensual, número de
// gabinetes (recursos), horario, tiempo por procedimiento, cantidad de
// profesionales e inversión de ampliación; y confirma que se actualizan
// cantidades realizables, ingresos, costos, capacidad utilizada y
// recuperación. También: escenarios A/B y arranque de demanda por servicio.
// ============================================================================

import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import type { PlanexProject } from '../../src/lib/planex/types';

function clonar<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

const val = (m: ReturnType<typeof computeProject>, id: string, t: number) => m.valores[id]?.[t] ?? 0;

describe('MISIÓN §16.4 — Capacidad derivada de recursos', () => {
  test('la capacidad teórica del recurso se deriva de unidades × horas × días × (1 − mantenimiento)', () => {
    const p = crearProyectoClinica();
    const m = computeProject(p);
    // Gabinetes: 5 × 8 h/día × 288 días × 0,95 → minutos-mes = × 60 / 12
    const minMes = 5 * 8 * 288 * 0.95 * (60 / 12);
    expect(m.recursosCalculados.find((r) => r.id === 're-gab')!.horasDisponibles[1]).toBeCloseTo(minMes / 60, 3);
    // Capacidad teórica de consultas (30 min) en el año 1: min-mes / 30
    expect(m.capacidadServicios['sv-1'][1].capacidadMensual).toBeCloseTo(minMes / 30, 1);
  });

  test('cambiar el PRECIO de un servicio no altera la capacidad ni la cantidad realizable', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    p.servicios[0].precioBase = 60;
    const m2 = computeProject(p);
    expect(m2.capacidadServicios['sv-1'][1].capacidadMensual).toBeCloseTo(m1.capacidadServicios['sv-1'][1].capacidadMensual, 4);
    expect(m2.capacidadServicios['sv-1'][1].cantidadRealMensual).toBeCloseTo(m1.capacidadServicios['sv-1'][1].cantidadRealMensual, 4);
    expect(val(m2, 'ingresos_servicios_k', 1)).toBeGreaterThan(val(m1, 'ingresos_servicios_k', 1));
  });

  test('cambiar la CANTIDAD prevista actualiza demanda, utilización y (si supera) lo realizable', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    p.servicios[0].cantidadBaseMensual = 2500; // demanda muy superior a 1 824/mes
    const m2 = computeProject(p);
    // La demanda crece pero la producción queda LIMITADA por el recurso.
    expect(m2.capacidadServicios['sv-1'][1].demandaMensual).toBeCloseTo(2500, 0);
    expect(m2.capacidadServicios['sv-1'][1].cantidadRealMensual).toBeLessThan(2500);
    expect(m2.servicios.find((s) => s.id === 'sv-1')!.capacidadesExcedidas.length).toBeGreaterThan(0);
    // La utilización supera el 100 % de la capacidad instalada.
    expect(m2.capacidadServicios['sv-1'][1].utilizacion).toBeGreaterThan(1);
    expect(m2.issues.some((i) => i.codigo === 'CAPACIDAD')).toBe(true);
    // Y los INGRESOS también quedan limitados (cascada, misión §16.4).
    expect(val(m2, 'ingresos_servicios_k', 1)).toBeLessThan(val(m1, 'ingresos_servicios_k', 1));
  });

  test('cambiar la CAPACIDAD MENSUAL del propio servicio (tope directo) limita la producción', () => {
    const p = clonar(crearProyectoClinica());
    p.servicios[0].capacidadMaxMensual = 300; // por debajo de la demanda (400)
    const m = computeProject(p);
    expect(m.capacidadServicios['sv-1'][1].cantidadRealMensual).toBeCloseTo(300, 3);
    expect(m.servicios.find((s) => s.id === 'sv-1')!.capacidadesExcedidas).toContain(1);
  });

  test('añadir GABINETES (unidades del recurso) aumenta la capacidad y la producción atendible', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    p.recursos.find((r) => r.id === 're-gab')!.cantidad = 6;
    const m2 = computeProject(p);
    // Capacidad del servicio de consulta: +1 gabinete → +20 % de minutos.
    const cap1 = m1.capacidadServicios['sv-1'][1].capacidadMensual;
    const cap2 = m2.capacidadServicios['sv-1'][1].capacidadMensual;
    expect(cap2).toBeCloseTo(cap1 * 1.2, 0);
    // La demanda del año 1 sigue atendible (no excedida).
    expect(m2.servicios.find((s) => s.id === 'sv-1')!.capacidadesExcedidas.length).toBe(0);
  });

  test('cambiar el HORARIO (horas/día) de los gabinetes escala la capacidad', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    p.recursos.find((r) => r.id === 're-gab')!.horasDia = 10;
    const m2 = computeProject(p);
    expect(m2.capacidadServicios['sv-1'][1].capacidadMensual).toBeCloseTo(
      (m1.capacidadServicios['sv-1'][1].capacidadMensual / 8) * 10,
      0
    );
  });

  test('cambiar el TIEMPO por procedimiento (duración) reduce la capacidad en unidades', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    p.servicios[0].duracionMinutos = 60; // el doble de tiempo por consulta
    const m2 = computeProject(p);
    expect(m2.capacidadServicios['sv-1'][1].capacidadMensual).toBeCloseTo(
      m1.capacidadServicios['sv-1'][1].capacidadMensual / 2,
      0
    );
  });

  test('cambiar la cantidad de PROFESIONALES limita los servicios que dependen de ellos', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    p.recursos.find((r) => r.id === 're-prof')!.cantidad = 2; // plantilla insuficiente
    const m2 = computeProject(p);
    // Los profesionales pasan a ser el recurso limitante de la clínica.
    const utilProf = Math.max(...Object.values(m2.recursosCalculados.find((r) => r.id === 're-prof')!.utilizacion));
    expect(utilProf).toBeGreaterThan(1);
    // La producción realizable cae respecto del modelo base.
    const real1 = m1.servicios.reduce((s, x) => s + (x.cantidades[1] ?? 0), 0);
    const real2 = m2.servicios.reduce((s, x) => s + (x.cantidades[1] ?? 0), 0);
    expect(real2).toBeLessThan(real1);
    expect(m2.issues.some((i) => i.codigo === 'CAPACIDAD')).toBe(true);
  });

  test('la INVERSIÓN de ampliación (escenario B) crea CAPEX, nueva capacidad y depreciación', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    const amp = p.recursos.find((r) => r.id === 're-gab')!.expansiones[0];
    amp.costoKUSD = 220; // inversión de ampliación mayor
    amp.cantidad = 3;
    const m2 = computeProject(p);
    expect(m2.indicadores.capexAmpliaciones[amp.anio]).toBeCloseTo(220, 1);
    // Capacidad del año 8: 5 + 3 gabinetes (vs 7 en m1).
    const cap1 = m1.capacidadServicios['sv-1'][8].capacidadMensual;
    const cap2 = m2.capacidadServicios['sv-1'][8].capacidadMensual;
    expect(cap2).toBeCloseTo((cap1 / 7) * 8, 0);
    // Depreciación adicional desde el año de la ampliación.
    const ampActivo = m2.depreciacion.find((a) => a.id === 're-gab-amp-ex-gab-1');
    expect(ampActivo).toBeDefined();
    expect(ampActivo!.depreciacion[amp.anio]).toBeCloseTo(220 / 10, 3); // vida 10
    expect(m2.issues.some((i) => i.codigo === 'ESCENARIO_B')).toBe(true);
  });

  test('escenario A ignora las ampliaciones y recorta la demanda con advertencia', () => {
    const p = clonar(crearProyectoClinica());
    const mB = computeProject(p);
    p.tecnico.escenarioCapacidad = 'A_constante';
    const mA = computeProject(p);
    expect(mA.indicadores.capexAmpliaciones[7]).toBe(0);
    expect(Object.values(mA.indicadores.capexAmpliaciones).every((v) => v === 0)).toBe(true);
    // En el escenario A la demanda tardía excede la capacidad base.
    expect(mA.servicios.filter((s) => s.capacidadesExcedidas.length > 0).length).toBeGreaterThan(0);
    // En el escenario B no hay excedencias (ampliación programada).
    expect(mB.servicios.filter((s) => s.capacidadesExcedidas.length > 0).length).toBe(0);
    // Los ingresos tardíos del B superan a los del A (capacidad ampliada).
    expect(val(mB, 'ingresos_servicios_k', 10)).toBeGreaterThan(val(mA, 'ingresos_servicios_k', 10));
  });

  test('el ARRANQUE DE DEMANDA por servicio pospone la facturación sin recurso disponible', () => {
    const p = clonar(crearProyectoClinica());
    p.servicios.find((s) => s.id === 'sv-8')!.anioInicioDemanda = 4; // ortodoncia desde el año 4
    const m = computeProject(p);
    const sc = m.servicios.find((s) => s.id === 'sv-8')!;
    expect(sc.valores[1]['srv_cantidad_mensual_proy']).toBeCloseTo(0, 6);
    expect(sc.valores[1]['srv_ingreso_anual']).toBeCloseTo(0, 6);
    expect(sc.valores[4]['srv_cantidad_mensual_proy']).toBeGreaterThan(0);
    expect(m.capacidadServicios['sv-8'][1].demandaMensual).toBe(0);
  });

  test('recursos COMPARTIDOS: la demanda de varias líneas se suma sobre el mismo pool', () => {
    const p = clonar(crearProyectoClinica());
    const m = computeProject(p);
    // Los minutos demandados al pool de gabinetes = Σ demanda × duración de
    // TODOS los servicios que lo usan (no por separado).
    const esperado = p.servicios
      .filter((s) => s.recursoIds.includes('re-gab'))
      .reduce((s, x) => s + x.cantidadBaseMensual * x.duracionMinutos, 0);
    expect(m.recursosCalculados.find((r) => r.id === 're-gab')!.horasDemandadas[1] * 60).toBeCloseTo(esperado, 2);
  });

  test('corrección en cascada: precios de capacidad → ingresos → costos → recuperación', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    // Capacidad imposible: 1 gabinete. La producción se recorta → ingresos
    // menores → recuperación MÁS TARDÍA.
    p.recursos.find((r) => r.id === 're-gab')!.cantidad = 1;
    const m2 = computeProject(p);
    expect(val(m2, 'ingresos_servicios_k', 1)).toBeLessThan(val(m1, 'ingresos_servicios_k', 1));
    expect(m2.indicadores.recuperacionProyecto.anios!).toBeGreaterThan(m1.indicadores.recuperacionProyecto.anios!);
    expect(m2.indicadores.recuperacionProyecto.indeterminado).toBe(false);
  });
});
