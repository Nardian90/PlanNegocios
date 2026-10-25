// Auditoría R1: valores del modelo de la clínica (año 0 y año 1) + deuda + ampliaciones.
import { computeProject } from '../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../src/lib/planex/templates/clinica';

const p = crearProyectoClinica();
const m = computeProject(p);
const v = (id: string, t: number) => m.valores[id]?.[t] ?? 0;

console.log('=== AÑO 0 ===');
console.log('costo_laboral_k[0]        =', v('costo_laboral_k', 0));
console.log('impuesto_utilidades_k[0]  =', v('impuesto_utilidades_k', 0));
console.log('ingresos_totales_k[0]     =', v('ingresos_totales_k', 0));
console.log('utilidad_despues_imp[0]   =', v('utilidad_despues_impuestos_k', 0));
console.log('depreciacion_anual_k[0]   =', v('depreciacion_anual_k', 0));
console.log('inversion_total_k[0]      =', v('inversion_total_k', 0));
console.log('financiacion_disponible_k =', v('financiacion_disponible_k', 0));
console.log('deuda[0]                  =', JSON.stringify(m.deuda[0]));
console.log('deuda[1]                  =', JSON.stringify(m.deuda[1]));
console.log('=== AÑO 1 ===');
console.log('ingresos_servicios_k[1]   =', v('ingresos_servicios_k', 1));
console.log('ingresos_totales_k[1]     =', v('ingresos_totales_k', 1));
console.log('indicadores.ingresosTotales[1] =', m.indicadores.ingresosTotales[1]);
console.log('× 743 =', m.indicadores.ingresosTotales[1] * 743);
console.log('=== INVERSIÓN ===');
console.log('inversionTotalKUSD =', m.indicadores.inversionTotalKUSD, '×743 =', m.indicadores.inversionTotalKUSD * 743);
console.log('=== AMPLIACIONES ===');
console.log('capexAmpliaciones =', JSON.stringify(m.indicadores.capexAmpliaciones));
const re = p.recursos ?? [];
for (const r of re) console.log(`recurso ${r.id} (${r.nombre}): expansiones=`, JSON.stringify(r.expansiones));
console.log('=== DEPRECIACIÓN (ampliación) ===');
for (const a of m.depreciacion) if (a.concepto.includes('mpliaci')) console.log(JSON.stringify(a));
console.log('=== UTILIZACIÓN gabinetes ===');
const gab = m.recursosCalculados.find((r) => r.id === 're-gab');
if (gab) {
  for (const t of [6, 7, 8]) console.log(`util[${t}] =`, (gab.utilizacion[t] * 100).toFixed(2));
}
console.log('=== TASA / FECHAS ===');
const tc = p.parametros.find((x) => x.id === 'tipo_cambio');
console.log('tipo_cambio =', tc?.valor, 'fechaRef =', tc?.fechaRef, 'demo =', tc?.demo);
console.log('general.fecha =', p.general.fecha);
console.log('=== PARÁMETROS RESERVA / REPARTO ===');
for (const id of ['pct_reserva_legal', 'pct_reparto_dividendos', 'factor_costo_laboral', 'inflacion_costos_fijos']) {
  const x = p.parametros.find((q) => q.id === id);
  console.log(`${id} =`, x?.valor, '| demo:', x?.demo);
}
console.log('=== DIVIDENDOS años 1-3 ===');
for (const d of m.dividendos.slice(0, 4)) console.log(JSON.stringify(d));
