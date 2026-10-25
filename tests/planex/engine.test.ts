// ============================================================================
// Pruebas del motor de cálculo PLANEX (bun test)
// Ejecución: bun test tests/planex
// ============================================================================
import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { crearProyectoDefault } from '../../src/lib/planex/templates/default';
import { parsearProyectoJSON, proyectoAJSON } from '../../src/lib/planex/io/jsonio';
import type { PlanexProject } from '../../src/lib/planex/types';

function clonar(p: PlanexProject): PlanexProject {
  return JSON.parse(JSON.stringify(p));
}

function val(modelo: ReturnType<typeof computeProject>, id: string, t: number): number {
  return modelo.valores[id]?.[t] ?? 0;
}

describe('Plantilla Clínica — carga inicial completa', () => {
  const modelo = computeProject(crearProyectoClinica());

  test('calcula sin errores de motor', () => {
    const errores = modelo.issues.filter((i) => i.tipo === 'error');
    expect(errores.length).toBe(0);
  });

  test('ingresos por servicios del año 1 = 967,8 kUSD (valor esperado manual)', () => {
    expect(val(modelo, 'ingresos_servicios_k', 1)).toBeCloseTo(967.8, 1);
  });

  test('costos variables año 1 = 254,8 kUSD', () => {
    expect(val(modelo, 'costos_variables_k', 1)).toBeCloseTo(254.82, 1);
  });

  test('costo laboral año 1 = 38,3 kUSD (15 312 000 CUP / 400 / 1000)', () => {
    expect(val(modelo, 'costo_laboral_k', 1)).toBeCloseTo(38.28, 1);
  });

  test('depreciación anual = 117,125 kUSD', () => {
    expect(val(modelo, 'depreciacion_anual_k', 1)).toBeCloseTo(117.125, 2);
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

  test('flujo acumulado = suma acumulada de flujos netos (recurrencia LAG)', () => {
    let acum = 0;
    for (const t of modelo.years) {
      acum += val(modelo, 'flujo_neto_k', t);
      expect(val(modelo, 'flujo_acumulado_k', t)).toBeCloseTo(acum, 2);
    }
  });

  test('crédito: saldo, intereses y amortización según gracia 1 y plazo 5', () => {
    expect(val(modelo, 'saldo_deuda_k', 0)).toBeCloseTo(300, 1);
    expect(val(modelo, 'amortizacion_k', 1)).toBeCloseTo(0, 1); // gracia
    expect(val(modelo, 'amortizacion_k', 2)).toBeCloseTo(60, 1);
    expect(val(modelo, 'interes_k', 1)).toBeCloseTo(24, 1); // 300 × 8 %
    expect(val(modelo, 'saldo_deuda_k', 7)).toBeCloseTo(0, 1); // amortizado en el año 6
    expect(val(modelo, 'interes_k', 7)).toBeCloseTo(0, 1);
  });

  test('recuperación de la inversión entre 3,5 y 5 años y horizonte ≥ recuperación + 1', () => {
    const rec = modelo.indicadores.recuperacionAnios;
    expect(rec).not.toBeNull();
    expect(rec!).toBeGreaterThan(3.5);
    expect(rec!).toBeLessThan(5);
    expect(modelo.years.length - 1).toBeGreaterThanOrEqual(Math.ceil(rec! + 1));
    expect(modelo.issues.some((i) => i.codigo === 'HORIZONTE_CORTO')).toBe(false);
  });

  test('financiación exacta: diferencia ≈ 0 sin alertas de insuficiencia/exceso', () => {
    expect(val(modelo, 'inversion_total_k', 0)).toBeCloseTo(1480, 1);
    expect(val(modelo, 'aportaciones_total_k', 0)).toBeCloseTo(1180, 1);
    expect(val(modelo, 'diferencia_financiacion_k', 0)).toBeCloseTo(0, 1);
    expect(modelo.issues.some((i) => i.codigo === 'FINANCIACION_INSUFICIENTE')).toBe(false);
  });

  test('beneficios al país año 1 ≈ 258,5 kUSD y sin doble contabilización', () => {
    const b = val(modelo, 'total_beneficios_pais_k', 1);
    expect(b).toBeCloseTo(258.49, 0);
    const imp = val(modelo, 'impuesto_utilidades_k', 1);
    const div = val(modelo, 'dividendos_parte_cubana_k', 1);
    const ft = val(modelo, 'pagos_fuerza_trabajo_k', 1);
    expect(imp + div + ft + 5 + 8 + 30).toBeCloseTo(b, 1); // + otros imp, aranceles, canon
  });

  test('marca los datos ficticios y la tasa demostrativa', () => {
    expect(modelo.issues.some((i) => i.codigo === 'DATOS_FICTICIOS')).toBe(true);
    expect(modelo.issues.some((i) => i.codigo === 'TASA_DEMO')).toBe(true);
  });

  test('advierte capacidad excedida en años avanzados (crecimiento 5 %)', () => {
    const conAlerta = modelo.servicios.filter((s) => s.capacidadesExcedidas.length > 0);
    expect(conAlerta.length).toBeGreaterThan(0);
    expect(modelo.issues.some((i) => i.codigo === 'CAPACIDAD')).toBe(true);
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
    // La UAI no cambia (el impuesto no afecta la base)
    expect(val(m2, 'utilidad_antes_impuestos_k', 1)).toBeCloseTo(val(m1, 'utilidad_antes_impuestos_k', 1), 4);
  });

  test('cambiar el tipo de cambio CUP/USD modifica el costo laboral y la utilidad', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    p.parametros.find((x) => x.id === 'tipo_cambio')!.valor = 200;
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
});

describe('Prueba obligatoria: precio, volumen y costo del servicio', () => {
  test('cambiar el precio de un servicio actualiza ingresos, costos, resultados y flujos', () => {
    const p = clonar(crearProyectoClinica());
    const m1 = computeProject(p);
    p.servicios[0].precioBase = 50; // +25 USD
    const m2 = computeProject(p);
    // +25 USD × 400/mes × 12 = +120 kUSD
    expect(val(m2, 'ingresos_servicios_k', 1)).toBeCloseTo(val(m1, 'ingresos_servicios_k', 1) + 120, 1);
    expect(val(m2, 'costos_variables_k', 1)).toBeCloseTo(val(m1, 'costos_variables_k', 1), 1);
    const deltaUAI = val(m2, 'utilidad_antes_impuestos_k', 1) - val(m1, 'utilidad_antes_impuestos_k', 1);
    expect(deltaUAI).toBeCloseTo(120 - 0.05 * 120, 1); // admin es 5 % de ingresos
    expect(val(m2, 'impuesto_utilidades_k', 1)).toBeGreaterThan(val(m1, 'impuesto_utilidades_k', 1));
    expect(val(m2, 'flujo_acumulado_k', 10)).toBeGreaterThan(val(m1, 'flujo_acumulado_k', 10));
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
    // +2 USD × 400 servicios/mes × 12 meses = +9,6 kUSD
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
    // La partida dependiente también falla, no muestra valores falsos
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
});

describe('Validaciones y control de consistencia', () => {
  test('detecta insuficiencia de financiación al reducir aportaciones', () => {
    const p = clonar(crearProyectoClinica());
    p.aportaciones = p.aportaciones.slice(0, 2); // quitar las del socio nacional
    const m = computeProject(p);
    const issue = m.issues.find((i) => i.codigo === 'FINANCIACION_INSUFICIENTE');
    expect(issue).toBeDefined();
    expect(val(m, 'diferencia_financiacion_k', 0)).toBeLessThan(-0.05);
  });

  test('rechaza datos incompletos con pendientes (plantilla Default)', () => {
    const m = computeProject(crearProyectoDefault());
    expect(m.issues.some((i) => i.codigo === 'SIN_SERVICIOS')).toBe(true);
    expect(m.issues.some((i) => i.codigo === 'SIN_INVERSION')).toBe(true);
    expect(m.issues.some((i) => i.codigo === 'SIN_APORTACIONES')).toBe(true);
    expect(m.issues.some((i) => i.codigo === 'SIN_PERSONAL')).toBe(true);
    // Sin servicios no hay ingresos: el resultado refleja solo los parámetros
    // de costos fijos de fábrica (canon 30 + públicos 40 + otros 10) y queda
    // señalado como pendiente, no como resultado definitivo.
    expect(val(m, 'ingresos_totales_k', 1)).toBe(0);
    expect(val(m, 'utilidad_antes_impuestos_k', 1)).toBeCloseTo(-80, 1);
    expect(m.ok).toBe(true); // son pendientes, no errores de cálculo
  });

  test('horizonte 4 (sin recuperación) genera NO_RECUPERACION; horizonte 5 genera HORIZONTE_CORTO', () => {
    const a = clonar(crearProyectoClinica());
    a.ajustes.horizonteAnios = 4; // recuperación ~4,04: aún negativo en el año 4
    const ma = computeProject(a);
    expect(ma.issues.some((i) => i.codigo === 'NO_RECUPERACION')).toBe(true);
    expect(ma.indicadores.recuperacionAnios).toBeNull();

    const b = clonar(crearProyectoClinica());
    b.ajustes.horizonteAnios = 5; // recuperación 4,04 → necesita ≥ 6 (ceil(4,04+1))
    const mb = computeProject(b);
    expect(mb.indicadores.recuperacionAnios).not.toBeNull();
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
    expect(m.issues.some((i) => i.codigo === 'VIDA_UTIL')).toBe(true);
    expect(val(m, 'depreciacion_anual_k', 1)).toBeCloseTo(117.125 - 52, 2);
  });
});

describe('JSON — guardar, recuperar y rechazar', () => {
  test('exportar e importar conserva datos, parámetros y reglas modificadas', () => {
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
    // Recalcula con lo importado: impuesto sobre ingresos con 30 %
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
