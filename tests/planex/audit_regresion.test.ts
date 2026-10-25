// ============================================================================
// MISIÓN §16.1 — Pruebas de regresión sobre las cifras actualmente visibles.
//
// «Utiliza los datos originales como pruebas de partida para comprobar que
// el motor realiza las operaciones básicas correctamente.» Con los valores
// visibles del plan original deben verificarse:
//   inversión 45+1 200+235 = 1 480 · aportes extranjeros 708 · nacionales 472
//   aportaciones 1 180 · financiación con crédito 1 480 · ingresos año 1: 967,8
//   costos variables año 1: 254,8 · UAI año 1 (premisas originales): 369,2
//   impuesto año 1 (35 % demo): 129,22 · UDI año 1: 239,98
// Estos valores verifican operaciones aisladas: NO obligan a conservar las
// proyecciones antiguas (la recuperación y las conclusiones defectuosas se
// recalculan con las reglas corregidas).
// ============================================================================

import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { parametrosPorDefecto, reglasPorDefecto } from '../../src/lib/planex/templates/reglas';
import { crearProyectoBase } from '../../src/lib/planex/model/factory';
import type { PlanexProject, InversionRow } from '../../src/lib/planex/types';

function clonar<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

/** Reconstruye las ENTRADAS ORIGINALES del plan «Sonrisa Habana» (los mismos
 *  datos visibles que la misión usa como ancla) sobre la base del motor 2.0.0,
 *  con el activo disponible desde el año 1 (corrección del defecto de
 *  depreciar en montaje) y los parámetros de fábrica originales. */
function proyectoConEntradasOriginales(): PlanexProject {
  const p = crearProyectoBase('clinica');
  p.ajustes.horizonteAnios = 10;
  const inv = (id: string, concepto: string, categoria: InversionRow['categoria'], monto: number, vida: number): InversionRow => ({
    id,
    concepto,
    categoria,
    moneda: 'USD',
    monto,
    vidaUtilAnios: vida,
    anioDisponible: categoria === 'inversion_fija' ? 1 : 0,
    valorResidualPct: 0,
    metodoDepreciacion: 'lineal',
    observacion: 'Entrada original (ancla §16.1)',
  });
  p.financiero.inversion = [
    inv('iv-1', 'Estudios de factibilidad y gastos de constitución', 'gastos_previos', 25, 0),
    inv('iv-2', 'Licencias, registros y autorizaciones sanitarias', 'gastos_previos', 12, 0),
    inv('iv-3', 'Gastos de puesta en marcha y capacitación inicial', 'gastos_previos', 8, 0),
    inv('iv-4', 'Equipamiento clínico (5 sillones e instrumental)', 'inversion_fija', 520, 10),
    inv('iv-5', 'Equipos de imagenología dental (2)', 'inversion_fija', 180, 10),
    inv('iv-6', 'Laboratorio de prótesis', 'inversion_fija', 95, 10),
    inv('iv-7', 'Equipamiento de esterilización y compresores', 'inversion_fija', 85, 10),
    inv('iv-8', 'Mobiliario clínico y de oficina', 'inversion_fija', 60, 8),
    inv('iv-9', 'Informática y software de gestión clínica', 'inversion_fija', 35, 5),
    inv('iv-10', 'Adecuación y montaje de instalaciones', 'inversion_fija', 180, 20),
    inv('iv-11', 'Vehículos (ver desglose)', 'inversion_fija', 45, 8),
  ];
  p.aportaciones = [
    { id: 'ap-ex-ef', socio: 'extranjero', tipo: 'efectivo', montos: [420, 0, 0], referenciaDocumental: '' },
    { id: 'ap-ex-af', socio: 'extranjero', tipo: 'activos_fijos_tangibles', montos: [288, 0, 0], referenciaDocumental: '' },
    { id: 'ap-na-af', socio: 'nacional', tipo: 'activos_fijos_tangibles', montos: [180, 0, 0], referenciaDocumental: '' },
    { id: 'ap-na-ac', socio: 'nacional', tipo: 'activos_circulantes', montos: [152, 0, 0], referenciaDocumental: '' },
    { id: 'ap-na-ef', socio: 'nacional', tipo: 'efectivo', montos: [140, 0, 0], referenciaDocumental: '' },
  ];
  p.personal = [
    { id: 'pe-m1', etapa: 'montaje', grupo: 'cubano_otro', cantidad: 6, salarioPromedioAnualCUP: 96000 },
    { id: 'pe-o1', etapa: 'operacion', grupo: 'cubano_directivo', cantidad: 3, salarioPromedioAnualCUP: 312000 },
    { id: 'pe-o2', etapa: 'operacion', grupo: 'cubano_otro', cantidad: 12, salarioPromedioAnualCUP: 264000 },
    { id: 'pe-o3', etapa: 'operacion', grupo: 'cubano_otro', cantidad: 6, salarioPromedioAnualCUP: 168000 },
    { id: 'pe-o4', etapa: 'operacion', grupo: 'cubano_otro', cantidad: 5, salarioPromedioAnualCUP: 120000 },
    { id: 'pe-o5', etapa: 'operacion', grupo: 'extranjero_directivo', cantidad: 1, salarioPromedioAnualCUP: 9600000 },
  ];
  p.servicios = [
    { id: 'sv-1', nombre: 'Consulta estomatológica', precioBase: 25, cantidadBaseMensual: 400, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 6, duracionMinutos: 30, recursoIds: [], fuente: 'ancla §16.1' },
    { id: 'sv-2', nombre: 'Odontología preventiva', precioBase: 35, cantidadBaseMensual: 160, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 10, duracionMinutos: 40, recursoIds: [], fuente: 'ancla' },
    { id: 'sv-3', nombre: 'Restauraciones', precioBase: 60, cantidadBaseMensual: 220, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 18, duracionMinutos: 45, recursoIds: [], fuente: 'ancla' },
    { id: 'sv-4', nombre: 'Endodoncia', precioBase: 150, cantidadBaseMensual: 70, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 40, duracionMinutos: 60, recursoIds: [], fuente: 'ancla' },
    { id: 'sv-5', nombre: 'Periodoncia', precioBase: 120, cantidadBaseMensual: 60, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 30, duracionMinutos: 50, recursoIds: [], fuente: 'ancla' },
    { id: 'sv-6', nombre: 'Cirugía oral', precioBase: 180, cantidadBaseMensual: 35, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 45, duracionMinutos: 60, recursoIds: [], fuente: 'ancla' },
    { id: 'sv-7', nombre: 'Prótesis estomatológica', precioBase: 400, cantidadBaseMensual: 28, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 120, duracionMinutos: 90, recursoIds: [], fuente: 'ancla' },
    { id: 'sv-8', nombre: 'Ortodoncia', precioBase: 1200, cantidadBaseMensual: 9, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 300, duracionMinutos: 90, recursoIds: [], fuente: 'ancla' },
    { id: 'sv-9', nombre: 'Imagenología dental', precioBase: 45, cantidadBaseMensual: 130, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 8, duracionMinutos: 20, recursoIds: [], fuente: 'ancla' },
  ];
  // Parámetros y reglas de fábrica originales (35 %, canon 30, públicos 40,
  // otros 10, crédito 300, CT 235, crecimiento 5/3/4 %, admin 5 %, mant 3 %).
  p.parametros = parametrosPorDefecto({ creditoKUSD: 300, capitalTrabajoKUSD: 235 });
  p.reglas = reglasPorDefecto();
  // Crédito original del plan: 300 kUSD al 8 %, desembolsado en el año 0,
  // gracia de principal 1 año, capital constante (ancla §16.1: interés del
  // año 1 = 24 kUSD; sin este calendario no hay gasto financiero que deducir
  // de la UAI y las cifras del documento original no concilian).
  p.financiero.deuda = {
    habilitada: true,
    anioDesembolso: 0,
    tipoGracia: 'principal',
    metodo: 'capital_constante',
    fuente: 'Entrada original (ancla §16.1): supuesto ficticio de crédito externo.',
  };
  return p;
}

describe('MISIÓN §16.1 — Regresión sobre las cifras visibles originales', () => {
  const p = proyectoConEntradasOriginales();
  const m = computeProject(p);
  const v = (id: string, t: number) => m.valores[id]?.[t] ?? 0;

  test('inversión inicial: 45 + 1 200 + 235 = 1 480 kUSD', () => {
    expect(v('gastos_previos_k', 0)).toBeCloseTo(45, 1);
    expect(v('inversion_fija_k', 0)).toBeCloseTo(1200, 1);
    expect(m.indicadores.inversionTotalKUSD).toBeCloseTo(1480, 1);
  });

  test('aportes extranjeros: 420 + 288 = 708 kUSD', () => {
    const ex = p.aportaciones.filter((a) => a.socio === 'extranjero').reduce((s, a) => s + a.montos.reduce((x, y) => x + y, 0), 0);
    expect(ex).toBeCloseTo(708, 1);
  });

  test('aportes nacionales: 180 + 152 + 140 = 472 kUSD', () => {
    const na = p.aportaciones.filter((a) => a.socio === 'nacional').reduce((s, a) => s + a.montos.reduce((x, y) => x + y, 0), 0);
    expect(na).toBeCloseTo(472, 1);
  });

  test('aportaciones totales: 708 + 472 = 1 180 kUSD', () => {
    expect(m.indicadores.aportacionesTotalesKUSD).toBeCloseTo(1180, 1);
  });

  test('financiación disponible con crédito: 1 180 + 300 = 1 480 kUSD', () => {
    expect(v('financiacion_disponible_k', 0)).toBeCloseTo(1480, 1);
    expect(v('diferencia_financiacion_k', 0)).toBeCloseTo(0, 1);
  });

  test('ingresos del año 1 por los nueve servicios: 967,8 kUSD', () => {
    expect(v('ingresos_servicios_k', 1)).toBeCloseTo(967.8, 1);
  });

  test('costos variables del año 1 con precios y cantidades originales: 254,8 kUSD', () => {
    expect(v('costos_variables_k', 1)).toBeCloseTo(254.8, 1);
  });

  test('si los costos y partidas del año 1 permanecen como en el documento: UAI = 386,9 kUSD', () => {
    // costos_variables 254,8 + laboral 20,61 (15 312 000 CUP / 743 / 1000) + canon 30
    // + mant 36 (3 % de 1 200) + públicos 40 + admin 48,39 (5 % de 967,8)
    // + otros 10 + dep 117,125 + int 24. La tasa 743 baja el costo laboral
    // expresado en kUSD respecto de la tasa 400 (38,28 → 20,61) y la UAI sube.
    expect(v('costo_laboral_k', 1)).toBeCloseTo(15312000 / 743 / 1000, 2);
    expect(v('mantenimiento_k', 1)).toBeCloseTo(36, 1);
    expect(v('gastos_admin_k', 1)).toBeCloseTo(48.39, 1);
    expect(v('depreciacion_anual_k', 1)).toBeCloseTo(117.125, 3);
    expect(v('interes_k', 1)).toBeCloseTo(24, 1);
    expect(v('utilidad_antes_impuestos_k', 1)).toBeCloseTo(369.185 + (38.28 - 15312000 / 743 / 1000), 1);
  });

  test('con la regla simplificada demostrativa del 35 %: impuesto año 1 = 135,40 kUSD', () => {
    // Con la tasa 743 el exacto es el 35 % × UAI año 1 (UAI = 369,185 + 38,28 −
    // 15 312 000 / 743 / 1000 = 386,8567): 135,39983 exacto. El motor calcula
    // con precisión completa: se verifica a UN decimal (135,4) y el valor exacto.
    expect(v('impuesto_utilidades_k', 1)).toBeCloseTo(135.4, 1);
    expect(v('impuesto_utilidades_k', 1)).toBeCloseTo((369.185 + (38.28 - 15312000 / 743 / 1000)) * 0.35, 4);
  });

  test('utilidad después de impuestos del año 1 bajo esas mismas premisas: 251,46 kUSD', () => {
    // El exacto es UAI × 0,65 = 251,45683 (tasa 743).
    expect(v('utilidad_despues_impuestos_k', 1)).toBeCloseTo(251.46, 1);
    expect(v('utilidad_despues_impuestos_k', 1)).toBeCloseTo((369.185 + (38.28 - 15312000 / 743 / 1000)) * 0.65, 4);
  });

  test('los resultados CORREGIDOS difieren donde el modelo viejo era defectuoso (documentación del cambio)', () => {
    // Año 0: ya no hay depreciación (defecto corregido: activos disponibles en 1)
    expect(v('depreciacion_anual_k', 0)).toBe(0);
    // Los costos fijos de explotación ya no se cargan al montaje (año 0)
    expect(v('canon_k', 0)).toBe(0);
    expect(v('servicios_publicos_k', 0)).toBe(0);
    // La recuperación ya NO es la cifra vieja de 4,0 años: surge del flujo FCFF
    // corregido (el plan viejo mezclaba utilidad neta con amortizaciones).
    const rec = m.indicadores.recuperacionProyecto.anios;
    expect(rec).not.toBeNull();
    expect(rec).not.toBeCloseTo(4.0, 1);
    expect(rec!).toBeGreaterThan(3);
    expect(rec!).toBeLessThan(5);
    // El flujo del año 1 bajo la metodología FCFF (incluye intereses añadidos
    // por ser flujo del financiador, excluye amortización por no ser gasto).
    // Con la tasa 743: UDI 251,45683 + int 24 + dep 117,125 = 392,58183 exacto.
    expect(m.indicadores.fcff[1]).toBeCloseTo(251.46 + 24 + 117.125, 1);
    expect(m.indicadores.fcff[1]).toBeCloseTo((369.185 + (38.28 - 15312000 / 743 / 1000)) * 0.65 + 24 + 117.125, 4);
  });
});

describe('MISIÓN §3.1 — Conciliación de inversión y financiación', () => {
  const p = proyectoConEntradasOriginales();
  const m = computeProject(p);
  const v = (id: string, t: number) => m.valores[id]?.[t] ?? 0;

  test('inversión inicial = gastos previos + inversión fija + capital de trabajo', () => {
    expect(v('gastos_previos_k', 0) + v('inversion_fija_k', 0) + 235).toBeCloseTo(m.indicadores.inversionTotalKUSD, 1);
  });

  test('aportaciones totales = extranjero + nacional', () => {
    const ex = p.aportaciones.filter((a) => a.socio === 'extranjero').reduce((s, a) => s + a.montos.reduce((x, y) => x + y, 0), 0);
    const na = p.aportaciones.filter((a) => a.socio === 'nacional').reduce((s, a) => s + a.montos.reduce((x, y) => x + y, 0), 0);
    expect(m.indicadores.aportacionesTotalesKUSD).toBeCloseTo(ex + na, 1);
  });

  test('fuentes disponibles = aportaciones + otras fuentes + crédito', () => {
    expect(v('financiacion_disponible_k', 0)).toBeCloseTo(m.indicadores.aportacionesTotalesKUSD + 0 + 300, 1);
  });

  test('diferencia de financiación = fuentes disponibles − inversión requerida', () => {
    expect(v('diferencia_financiacion_k', 0)).toBeCloseTo(v('financiacion_disponible_k', 0) - m.indicadores.inversionTotalKUSD, 2);
  });

  test('los conceptos desglosados no están duplicados entre categorías', () => {
    const categorias = new Set(p.financiero.inversion.map((r) => r.categoria));
    expect(categorias.size).toBe(2); // gastos_previos + inversion_fija
    const ids = p.financiero.inversion.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Los gastos previos y la inversión fija son DISJUNTOS: el total es la
    // suma exacta de las partidas clasificadas (sin dobles contabilizaciones).
    const sumaClasificada = p.financiero.inversion.reduce((s, r) => s + r.monto, 0);
    expect(v('gastos_previos_k', 0) + v('inversion_fija_k', 0)).toBeCloseTo(sumaClasificada, 1);
  });

  test('insuficiencia de financiación: importe, origen y advertencia bloqueante', () => {
    const q = clonar(p);
    q.aportaciones = q.aportaciones.slice(0, 2); // solo extranjero: 708
    const mm = computeProject(q);
    const dif = mm.valores['diferencia_financiacion_k']?.[0] ?? 0;
    expect(dif).toBeCloseTo(-472, 1);
    const issue = mm.issues.find((i) => i.codigo === 'FINANCIACION_INSUFICIENTE');
    expect(issue).toBeDefined();
    expect(issue!.mensaje).toContain('472,0');
  });
});
