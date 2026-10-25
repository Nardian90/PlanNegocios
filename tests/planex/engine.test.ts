// ============================================================================
// Pruebas del motor de cálculo PLANEX (bun test) — esquema 2.0.0.
// Ejecución: bun test tests/planex
//
// Anclas de regresión verificadas contra el motor nuevo (los valores del
// enunciado de la misión §16.1 se comprueban en audit_regresion.test.ts).
// Aquí: coherencia estructural del motor, reglas editables y validaciones.
// ============================================================================

import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { crearProyectoDefault } from '../../src/lib/planex/templates/default';
import { parsearProyectoJSON, proyectoAJSON } from '../../src/lib/planex/io/jsonio';
import { diagnosticar } from '../../src/lib/planex/model/controles';
import type { PlanexProject } from '../../src/lib/planex/types';

function clonar(p: PlanexProject): PlanexProject {
  return JSON.parse(JSON.stringify(p));
}

function val(modelo: ReturnType<typeof computeProject>, id: string, t: number): number {
  return modelo.valores[id]?.[t] ?? 0;
}

describe('Plantilla Clínica — carga inicial completa (esquema 2.0.0)', () => {
  const modelo = computeProject(crearProyectoClinica());

  test('calcula SIN errores de motor (misión: la plantilla abre coherente)', () => {
    expect(modelo.issues.filter((i) => i.tipo === 'error').length).toBe(0);
    expect(modelo.ok).toBe(true);
  });

  test('la plantilla demo presenta los hallazgos REALES de la conciliación del arranque (DOC-002 §4.2)', () => {
    const { resumen, hallazgos } = diagnosticar(crearProyectoClinica(), modelo);
    expect(resumen.conteo.error_bloqueante).toBe(0);
    // DOC-002 §4.2: el gasto de montaje del año 0 (576,0 kCUP en presentación
    // CUP) queda SIN cobertura de las fuentes declaradas: la plantilla muestra
    // honestamente esa brecha como advertencia importante (no la oculta).
    expect(resumen.conteo.advertencia_importante).toBe(1);
    expect(hallazgos.some((h) => h.codigo === 'FINANCIACION_ANO0')).toBe(true);
    expect(resumen.estadoGeneral.estado).toBe('borrador_demostracion');
  });

  test('ingresos por servicios del año 1 = 967,8 kUSD (ancla manual)', () => {
    expect(val(modelo, 'ingresos_servicios_k', 1)).toBeCloseTo(967.8, 1);
  });

  test('costos variables año 1 = 254,8 kUSD', () => {
    expect(val(modelo, 'costos_variables_k', 1)).toBeCloseTo(254.82, 1);
  });

  test('costo laboral año 1 = 20,6 kUSD (15 312 000 CUP / 743 / 1000)', () => {
    expect(val(modelo, 'costo_laboral_k', 1)).toBeCloseTo(15312000 / 743 / 1000, 2);
  });

  test('año 0 (montaje): solo costo laboral de montaje; sin canon/públicos/otros ni depreciación', () => {
    expect(val(modelo, 'costo_laboral_k', 0)).toBeCloseTo((6 * 96000) / 743 / 1000, 2); // 6 × 96 000 CUP / 743 / 1000
    expect(val(modelo, 'canon_k', 0)).toBe(0);
    expect(val(modelo, 'servicios_publicos_k', 0)).toBe(0);
    expect(val(modelo, 'otros_gastos_k', 0)).toBe(0);
    expect(val(modelo, 'depreciacion_anual_k', 0)).toBe(0); // defecto corregido
    expect(val(modelo, 'utilidad_despues_impuestos_k', 0)).toBeCloseTo(-(6 * 96000) / 743 / 1000, 2);
  });

  test('depreciación: año 1 = 117,125 kUSD; activos respetan disponibilidad y tope depreciable', () => {
    expect(val(modelo, 'depreciacion_anual_k', 1)).toBeCloseTo(117.125, 2);
    for (const a of modelo.depreciacion) {
      expect(a.acumulada).toBeLessThanOrEqual(a.baseDepreciableKUSD + 0.01);
      for (let t = 0; t < a.anioDisponible; t++) expect(a.depreciacion[t] ?? 0).toBe(0);
    }
  });

  test('impuesto = MAX(0, UAI × 35 %) y utilidad neta = UAI − impuesto', () => {
    for (const t of [1, 2, 3, 5, 8]) {
      const uai = val(modelo, 'utilidad_antes_impuestos_k', t);
      const imp = val(modelo, 'impuesto_utilidades_k', t);
      const neta = val(modelo, 'utilidad_despues_impuestos_k', t);
      expect(imp).toBeCloseTo(Math.max(0, uai * 0.35), 2);
      expect(neta).toBeCloseTo(uai - imp, 2);
    }
  });

  test('flujos del proyecto y de los socios: acumulados por recurrencia LAG y coherentes con el motor', () => {
    let acumP = 0;
    let acumS = 0;
    for (const t of modelo.years) {
      acumP += val(modelo, 'flujo_proyecto_k', t);
      acumS += val(modelo, 'flujo_socios_k', t);
      expect(val(modelo, 'flujo_acumulado_proyecto_k', t)).toBeCloseTo(acumP, 2);
      expect(val(modelo, 'flujo_acumulado_socios_k', t)).toBeCloseTo(acumS, 2);
      expect(val(modelo, 'flujo_proyecto_k', t)).toBeCloseTo(modelo.indicadores.fcff[t] ?? 0, 2);
      expect(val(modelo, 'flujo_socios_k', t)).toBeCloseTo(modelo.indicadores.fcfe[t] ?? 0, 2);
    }
  });

  test('año 0 de los flujos: FCFF = −inversión total + resultado de montaje; FCFE = −aportaciones + montaje + desembolso', () => {
    expect(modelo.indicadores.fcff[0]).toBeCloseTo(-(1480 + (6 * 96000) / 743 / 1000), 2); // −1 480 − 0,78
    expect(modelo.indicadores.fcfe[0]).toBeCloseTo(-(1180 + (6 * 96000) / 743 / 1000), 2); // FCFF + crédito (300) = −1 180 − 0,78
  });

  test('crédito: gracia 1 (capital constante), intereses sobre saldo y amortización dentro del saldo', () => {
    expect(val(modelo, 'saldo_deuda_k', 0)).toBeCloseTo(300, 1);
    expect(val(modelo, 'amortizacion_k', 1)).toBeCloseTo(0, 1); // gracia
    expect(val(modelo, 'amortizacion_k', 2)).toBeCloseTo(60, 1);
    expect(val(modelo, 'interes_k', 1)).toBeCloseTo(24, 1); // 300 × 8 %
    expect(val(modelo, 'saldo_deuda_k', 6)).toBeCloseTo(0, 1);
    expect(val(modelo, 'interes_k', 7)).toBeCloseTo(0, 1);
    for (const f of modelo.deuda) {
      const esperado = f.saldoInicial + f.desembolso + f.interesCapitalizado - f.amortizacion;
      expect(f.saldoFinal).toBeCloseTo(esperado, 4); // invariante §6
      expect(f.saldoFinal).toBeGreaterThanOrEqual(-0.01);
    }
  });

  test('recuperación de la inversión total entre 3 y 5 años; horizonte ≥ recuperación + 1; socios también recuperados', () => {
    const rec = modelo.indicadores.recuperacionProyecto.anios;
    expect(rec).not.toBeNull();
    expect(rec!).toBeGreaterThan(3);
    expect(rec!).toBeLessThan(5);
    expect(modelo.years.length - 1).toBeGreaterThanOrEqual(Math.ceil(rec! + 1));
    expect(modelo.issues.some((i) => i.codigo === 'HORIZONTE_CORTO')).toBe(false);
    expect(modelo.indicadores.recuperacionSocios.anios).not.toBeNull();
  });

  test('financiación exacta: diferencia ≈ 0 sin alertas de insuficiencia/exceso', () => {
    expect(val(modelo, 'inversion_total_k', 0)).toBeCloseTo(1480, 1);
    expect(val(modelo, 'aportaciones_total_k', 0)).toBeCloseTo(1180, 1);
    expect(val(modelo, 'diferencia_financiacion_k', 0)).toBeCloseTo(0, 1);
    expect(modelo.issues.some((i) => i.codigo === 'FINANCIACION_INSUFICIENTE')).toBe(false);
    expect(modelo.issues.some((i) => i.codigo === 'FINANCIACION_EXCESO')).toBe(false);
  });

  test('beneficios al país: sin doble contabilización y conciliados resumen↔tabla (misión §9)', () => {
    const b1 = val(modelo, 'total_beneficios_pais_k', 1);
    const imp = val(modelo, 'impuesto_utilidades_k', 1);
    const div = val(modelo, 'dividendos_parte_cubana_k', 1);
    const ft = val(modelo, 'pagos_fuerza_trabajo_k', 1);
    // + otros imp (5) + aranceles (8) + canon (30); royalties y otros = 0
    expect(imp + div + ft + 5 + 8 + 30).toBeCloseTo(b1, 1);
    // Conciliación total: resumen = suma de todos los años de la misma regla.
    const suma = modelo.years.reduce((s, t) => s + val(modelo, 'total_beneficios_pais_k', t), 0);
    expect(modelo.indicadores.beneficiosPaisAcumulados).toBeCloseTo(suma, 1);
    // El subtotal de explotación difiere del total exactamente por el año 0.
    expect(modelo.indicadores.beneficiosPaisAcumulados - modelo.indicadores.beneficiosPaisExplotacion).toBeCloseTo(
      val(modelo, 'total_beneficios_pais_k', 0),
      2
    );
    // Dividendos de la parte cubana = pagables × 40 % (módulo de dividendos).
    const d1 = modelo.dividendos.find((x) => x.anio === 1)!;
    expect(d1.pagables).toBeLessThanOrEqual(Math.max(0, d1.cajaAcumulada) + 1e-9);
    expect(div).toBeCloseTo(d1.pagables * 0.4, 2);
  });

  test('año 0 de beneficios: SOLO pagos por fuerza de trabajo de montaje (corregido)', () => {
    expect(val(modelo, 'total_beneficios_pais_k', 0)).toBeCloseTo((6 * 96000) / 743 / 1000, 2);
    expect(val(modelo, 'canon_k', 0)).toBe(0);
    expect(val(modelo, 'aranceles_k', 0)).toBe(0);
  });

  test('marca los datos ficticios y la tasa demostrativa', () => {
    expect(modelo.issues.some((i) => i.codigo === 'DATOS_FICTICIOS')).toBe(true);
    expect(modelo.issues.some((i) => i.codigo === 'TASA_DEMO')).toBe(true);
  });

  test('plantilla sin excesos de capacidad (escenario B activo); escenario A sí alerta', () => {
    expect(modelo.servicios.filter((s) => s.capacidadesExcedidas.length > 0).length).toBe(0);
    const escA = clonar(crearProyectoClinica());
    escA.tecnico.escenarioCapacidad = 'A_constante';
    const mA = computeProject(escA);
    expect(mA.servicios.filter((s) => s.capacidadesExcedidas.length > 0).length).toBeGreaterThan(0);
    expect(mA.issues.some((i) => i.codigo === 'CAPACIDAD')).toBe(true);
  });
});

describe('Nivel A — parámetros: recálculo inmediato', () => {
  test('cambiar la tasa del 35 % al 30 % reduce el impuesto en 5 % × UAI en todos los años', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    const param = p.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!;
    param.valor = 0.3;
    const m2 = computeProject(p);
    for (const t of [1, 2, 3, 5, 8, 10]) {
      const uai = val(m1, 'utilidad_antes_impuestos_k', t);
      expect(val(m2, 'impuesto_utilidades_k', t)).toBeCloseTo(val(m1, 'impuesto_utilidades_k', t) - uai * 0.05, 2);
      expect(val(m2, 'utilidad_despues_impuestos_k', t)).toBeCloseTo(val(m1, 'utilidad_despues_impuestos_k', t) + uai * 0.05, 2);
    }
    expect(val(m2, 'utilidad_antes_impuestos_k', 1)).toBeCloseTo(val(m1, 'utilidad_antes_impuestos_k', 1), 4);
  });

  test('cambiar el tipo de cambio CUP/USD modifica el costo laboral y la utilidad', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    p.parametros.find((x) => x.id === 'tipo_cambio')!.valor = 371.5; // mitad de 743: duplica el costo laboral en kUSD
    const m2 = computeProject(p);
    expect(val(m2, 'costo_laboral_k', 1)).toBeCloseTo(val(m1, 'costo_laboral_k', 1) * 2, 1);
    expect(val(m2, 'utilidad_antes_impuestos_k', 1)).toBeLessThan(val(m1, 'utilidad_antes_impuestos_k', 1));
  });

  test('cambiar el monto del crédito altera saldo, intereses y financiación', () => {
    const p = clonar(crearProyectoClinica());
    p.parametros.find((x) => x.id === 'credito_monto_k')!.valor = 480;
    const m = computeProject(p);
    expect(val(m, 'saldo_deuda_k', 0)).toBeCloseTo(480, 1);
    expect(val(m, 'interes_k', 1)).toBeCloseTo(38.4, 1);
    expect(m.issues.some((i) => i.codigo === 'FINANCIACION_EXCESO')).toBe(true); // sobran 180 kUSD
  });

  test('gracia TOTAL capitaliza intereses: el saldo crece durante la gracia', () => {
    const p = clonar(crearProyectoClinica());
    p.financiero.deuda.tipoGracia = 'total';
    const m = computeProject(p);
    expect(val(m, 'saldo_deuda_k', 1)).toBeCloseTo(300 * 1.08, 1); // 300 + 24 capitalizados
    expect(m.deuda[1].interesPagado).toBeCloseTo(0, 2);
    expect(m.deuda[1].interesCapitalizado).toBeCloseTo(24, 1);
  });

  test('método francés: cuota total constante y saldo a cero al vencimiento', () => {
    const p = clonar(crearProyectoClinica());
    p.financiero.deuda.metodo = 'sistema_frances';
    const m = computeProject(p);
    const servicio = m.deuda.slice(2, 7).map((f) => f.interesPagado + f.amortizacion);
    for (const s of servicio) expect(s).toBeCloseTo(servicio[0], 1);
    expect(val(m, 'saldo_deuda_k', 6)).toBeCloseTo(0, 1);
  });

  test('pago único (bullet): sin amortizaciones intermedias y saldo liquidado al vencimiento', () => {
    const p = clonar(crearProyectoClinica());
    p.financiero.deuda.metodo = 'pago_unico';
    const m = computeProject(p);
    for (const t of [2, 3, 4, 5]) expect(val(m, 'amortizacion_k', t)).toBeCloseTo(0, 1);
    expect(val(m, 'amortizacion_k', 6)).toBeCloseTo(300, 1);
    expect(val(m, 'saldo_deuda_k', 6)).toBeCloseTo(0, 1);
  });
});

describe('Prueba obligatoria: precio, volumen y costo del servicio', () => {
  test('cambiar el precio de un servicio actualiza ingresos, costos, resultados y flujos', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    p.servicios[0].precioBase = 50; // +25 USD
    const m2 = computeProject(p);
    // +25 USD × 400/mes × 12 = +120 kUSD (la demanda de consultas cabe en la capacidad)
    expect(val(m2, 'ingresos_servicios_k', 1)).toBeCloseTo(val(m1, 'ingresos_servicios_k', 1) + 120, 1);
    expect(val(m2, 'costos_variables_k', 1)).toBeCloseTo(val(m1, 'costos_variables_k', 1), 1);
    const deltaUAI = val(m2, 'utilidad_antes_impuestos_k', 1) - val(m1, 'utilidad_antes_impuestos_k', 1);
    expect(deltaUAI).toBeCloseTo(120 - 0.05 * 120, 1); // admin es 5 % de ingresos
    expect(val(m2, 'impuesto_utilidades_k', 1)).toBeGreaterThan(val(m1, 'impuesto_utilidades_k', 1));
    expect(val(m2, 'flujo_acumulado_proyecto_k', 10)).toBeGreaterThan(val(m1, 'flujo_acumulado_proyecto_k', 10));
  });

  test('cambiar el volumen de pacientes actualiza ingresos y costos variables', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    p.servicios[0].cantidadBaseMensual = 500; // +100/mes
    const m2 = computeProject(p);
    expect(val(m2, 'ingresos_servicios_k', 1)).toBeCloseTo(val(m1, 'ingresos_servicios_k', 1) + 30, 1); // 100 × 12 × 25 USD
    expect(val(m2, 'costos_variables_k', 1)).toBeCloseTo(val(m1, 'costos_variables_k', 1) + 7.2, 1); // 100 × 12 × 6
  });

  test('cambiar el costo variable unitario actualiza costos y utilidad', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    p.servicios[0].costoVariableUnitario = 8; // +2 USD
    const m2 = computeProject(p);
    expect(val(m2, 'costos_variables_k', 1)).toBeCloseTo(val(m1, 'costos_variables_k', 1) + 9.6, 1);
    expect(val(m2, 'utilidad_antes_impuestos_k', 1)).toBeCloseTo(val(m1, 'utilidad_antes_impuestos_k', 1) - 9.6, 1);
  });
});

describe('Nivel B — fórmulas editables', () => {
  test('modificar la fórmula del impuesto (base = ingresos totales) recalcula', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    const regla = p.reglas.find((r) => r.id === 'impuesto_utilidades_k')!;
    regla.expresionAnterior = regla.expresion;
    regla.expresion = 'MAX(0, ingresos_totales_k * tasa_impuesto_utilidades)';
    regla.modificada = true;
    const m2 = computeProject(p);
    for (const t of [1, 3, 5]) {
      expect(val(m2, 'impuesto_utilidades_k', t)).toBeCloseTo(val(m2, 'ingresos_totales_k', t) * 0.35, 2);
    }
    expect(val(m2, 'impuesto_utilidades_k', 1)).toBeGreaterThan(val(m1, 'impuesto_utilidades_k', 1));
  });

  test('restaurar la regla predeterminada devuelve el resultado original', () => {
    const p = clonar(crearProyectoClinica());
    const regla = p.reglas.find((r) => r.id === 'impuesto_utilidades_k')!;
    const original = regla.expresion;
    regla.expresion = 'MAX(0, ingresos_totales_k * tasa_impuesto_utilidades)';
    const mMod = computeProject(p);
    regla.expresion = regla.expresionDefault;
    const mRest = computeProject(p);
    expect(val(mRest, 'impuesto_utilidades_k', 1)).not.toBeCloseTo(val(mMod, 'impuesto_utilidades_k', 1), 1);
    expect(regla.expresionDefault).toBe(original);
  });

  test('rechaza una fórmula con sintaxis inválida y marca la partida', () => {
    const p = clonar(crearProyectoClinica());
    p.reglas.find((r) => r.id === 'impuesto_utilidades_k')!.expresion = 'MAX(0, utilidad_antes_impuestos_k *';
    const m = computeProject(p);
    expect(m.ok).toBe(false);
    expect(m.estados['impuesto_utilidades_k'].ok).toBe(false);
    expect(m.issues.some((i) => i.codigo === 'SINTAXIS')).toBe(true);
    expect(m.valores['impuesto_utilidades_k']).toBeUndefined();
    expect(m.estados['utilidad_despues_impuestos_k'].ok).toBe(false);
  });

  test('rechaza variables inexistentes', () => {
    const p = clonar(crearProyectoClinica());
    p.reglas.find((r) => r.id === 'gastos_admin_k')!.expresion = 'variable_inexistente * 2';
    const m = computeProject(p);
    expect(m.estados['gastos_admin_k'].ok).toBe(false);
    expect(m.estados['gastos_admin_k'].error).toContain('variable_inexistente');
  });

  test('detecta dependencias circulares y las reporta', () => {
    const p = clonar(crearProyectoClinica());
    p.reglas.find((r) => r.id === 'mantenimiento_k')!.expresion = 'gastos_admin_k * 2';
    p.reglas.find((r) => r.id === 'gastos_admin_k')!.expresion = 'mantenimiento_k * 2';
    const m = computeProject(p);
    expect(m.ok).toBe(false);
    const ciclo = m.issues.find((i) => i.codigo === 'DEPENDENCIA_CIRCULAR');
    expect(ciclo).toBeDefined();
    expect(m.valores['mantenimiento_k']).toBeUndefined();
    expect(m.valores['gastos_admin_k']).toBeUndefined();
  });

  test('detecta división por cero como error (no produce valores falsos)', () => {
    const p = clonar(crearProyectoClinica());
    p.reglas.find((r) => r.id === 'gastos_admin_k')!.expresion = 'ingresos_totales_k / 0';
    const m = computeProject(p);
    expect(m.estados['gastos_admin_k'].ok).toBe(false);
    expect(m.ok).toBe(false);
  });

  test('deshabilitar una regla produce error en las dependientes (sin valores falsos)', () => {
    const p = clonar(crearProyectoClinica());
    p.reglas.find((r) => r.id === 'ingresos_servicios_usd')!.habilitada = false;
    const m = computeProject(p);
    expect(m.ok).toBe(false);
    expect(m.estados['ingresos_servicios_k'].ok).toBe(false);
  });

  test('el prefijo mtr_ está reservado: una regla con ese prefijo se rechaza', () => {
    const p = clonar(crearProyectoClinica());
    p.reglas.push({
      id: 'mtr_trampa',
      nombre: 'Trampa de prefijo',
      descripcion: 'test',
      expresion: '1',
      expresionDefault: '1',
      ambito: 'anio',
      unidad: 'kUSD',
      categoria: 'test',
      habilitada: true,
    });
    const m = computeProject(p);
    expect(m.issues.some((i) => i.codigo === 'PREFIJO_RESERVADO')).toBe(true);
  });
});

describe('Validaciones y control de consistencia', () => {
  test('detecta insuficiencia de financiación al reducir aportaciones', () => {
    const p = clonar(crearProyectoClinica());
    p.aportaciones = p.aportaciones.slice(0, 2); // quitar las del socio nacional
    const m = computeProject(p);
    const issue = m.issues.find((i) => i.codigo === 'FINANCIACION_INSUFICIENTE');
    expect(issue).toBeDefined();
    expect(val(m, 'diferencia_financiacion_k', 0)).toBeLessThan(-0.05);
    const d = diagnosticar(p, m);
    expect(d.resumen.conteo.error_bloqueante).toBeGreaterThan(0);
  });

  test('rechaza datos incompletos con pendientes (plantilla Default)', () => {
    const m = computeProject(crearProyectoDefault());
    expect(m.issues.some((i) => i.codigo === 'SIN_SERVICIOS')).toBe(true);
    expect(m.issues.some((i) => i.codigo === 'SIN_INVERSION')).toBe(true);
    expect(m.issues.some((i) => i.codigo === 'SIN_APORTACIONES')).toBe(true);
    expect(m.issues.some((i) => i.codigo === 'SIN_PERSONAL')).toBe(true);
    // Sin servicios no hay ingresos: los costos fijos de operación activan
    // desde el año 1 (canon 30 + públicos 40 + otros 10).
    expect(val(m, 'ingresos_totales_k', 1)).toBe(0);
    expect(val(m, 'utilidad_antes_impuestos_k', 1)).toBeCloseTo(-80, 1);
    expect(val(m, 'utilidad_antes_impuestos_k', 0)).toBe(0);
    expect(m.ok).toBe(true); // son pendientes, no errores de cálculo
  });

  test('horizonte 3 (sin recuperación) genera NO_RECUPERACION; horizonte 4 genera HORIZONTE_CORTO', () => {
    const a = clonar(crearProyectoClinica());
    a.ajustes.horizonteAnios = 3; // recuperación ~3,5: acumulado aún negativo en el año 3
    const ma = computeProject(a);
    expect(ma.issues.some((i) => i.codigo === 'NO_RECUPERACION')).toBe(true);
    expect(ma.indicadores.recuperacionProyecto.anios).toBeNull();

    const b = clonar(crearProyectoClinica());
    b.ajustes.horizonteAnios = 4; // recuperación 3,50 → necesita ≥ 5 (ceil(3,50+1))
    const mb = computeProject(b);
    expect(mb.indicadores.recuperacionProyecto.anios).not.toBeNull();
    expect(mb.issues.some((i) => i.codigo === 'HORIZONTE_CORTO')).toBe(true);
  });

  test('derechos reales sin referencia documental generan advertencia', () => {
    const p = clonar(crearProyectoClinica());
    p.aportaciones.push({ id: 'ap-dr', socio: 'nacional', tipo: 'derechos_reales', montos: [50, 0, 0], referenciaDocumental: '' });
    const m = computeProject(p);
    expect(m.issues.some((i) => i.codigo === 'DERECHO_REAL_SIN_REF')).toBe(true);
  });

  test('inversión fija sin vida útil no se deprecia y genera inconsistencia', () => {
    const p = clonar(crearProyectoClinica());
    p.financiero.inversion.find((r) => r.id === 'iv-4')!.vidaUtilAnios = 0;
    const m = computeProject(p);
    expect(m.issues.some((i) => i.codigo === 'DEPRECIACION')).toBe(true);
    expect(val(m, 'depreciacion_anual_k', 1)).toBeCloseTo(117.125 - 52, 2);
  });

  test('la participación cubana distinta de la composición real de aportaciones genera advertencia', () => {
    const p = clonar(crearProyectoClinica());
    p.parametros.find((x) => x.id === 'pct_parte_cubana')!.valor = 0.3;
    const m = computeProject(p);
    const d = diagnosticar(p, m);
    expect(d.hallazgos.some((h) => h.codigo === 'PARTICIPACION_INCOHERENTE')).toBe(true);
  });
});

describe('JSON — guardar, recuperar y rechazar', () => {
  test('exportar e importar conserva datos, parámetros, reglas, recursos y deuda', () => {
    const p = clonar(crearProyectoClinica());
    p.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!.valor = 0.3;
    const regla = p.reglas.find((r) => r.id === 'impuesto_utilidades_k')!;
    regla.expresion = 'MAX(0, ingresos_totales_k * tasa_impuesto_utilidades)';
    regla.expresionAnterior = regla.expresionDefault;
    regla.modificada = true;
    const json = proyectoAJSON(p);
    const res = parsearProyectoJSON(json);
    expect(res.ok).toBe(true);
    const q = res.proyecto!;
    expect(q.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!.valor).toBeCloseTo(0.3, 6);
    expect(q.reglas.find((r) => r.id === 'impuesto_utilidades_k')!.expresion).toContain('ingresos_totales_k');
    expect(q.recursos.length).toBe(4);
    expect(q.financiero.deuda.metodo).toBe('capital_constante');
    expect(q.tecnico.escenarioCapacidad).toBe('B_ampliacion');
    // Recalcula con lo importado
    const m = computeProject(q);
    expect(val(m, 'impuesto_utilidades_k', 1)).toBeCloseTo(val(m, 'ingresos_totales_k', 1) * 0.3, 1);
  });

  test('rechaza JSON malformado con error comprensible', () => {
    const res = parsearProyectoJSON('{esto no es json');
    expect(res.ok).toBe(false);
    expect(res.errores.length).toBeGreaterThan(0);
  });

  test('rechaza JSON sin esquema planex', () => {
    const res = parsearProyectoJSON(JSON.stringify({ nombre: 'otra cosa', datos: 123 }));
    expect(res.ok).toBe(false);
    expect(res.errores.some((e) => e.includes('planex'))).toBe(true);
  });

  test('los proyectos son independientes: modificar uno no altera la plantilla original', () => {
    const p1 = clonar(crearProyectoClinica());
    p1.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!.valor = 0.2;
    const p2 = crearProyectoClinica();
    expect(p2.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!.valor).toBeCloseTo(0.35, 6);
    const pD = crearProyectoDefault();
    expect(pD.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!.valor).toBeCloseTo(0.35, 6);
  });
});
