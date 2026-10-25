// Script de verificación: imprime los valores reales del modelo nuevo para
// la plantilla clínica y el centro de diagnóstico (anclas de pruebas).
import { computeProject } from '../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../src/lib/planex/templates/clinica';
import { crearProyectoCentro } from '../src/lib/planex/templates/centro';
import { diagnosticar } from '../src/lib/planex/model/controles';

function volcar(nombre: string, p: ReturnType<typeof crearProyectoClinica>) {
  const m = computeProject(p);
  console.log(`\n=== ${nombre} ===`);
  console.log('ok:', m.ok);
  console.log('issues:', [...new Set(m.issues.map((i) => i.codigo))].join(', '));
  const v = (id: string, t: number) => m.valores[id]?.[t] ?? 0;
  const ind = m.indicadores;
  console.log('inversion_total_k:', v('inversion_total_k', 0));
  console.log('aportaciones_total_k:', v('aportaciones_total_k', 0));
  console.log('dif_financiacion:', v('diferencia_financiacion_k', 0));
  console.log('ingresos año1:', v('ingresos_servicios_k', 1), 'año5:', v('ingresos_servicios_k', 5), 'año10:', v('ingresos_servicios_k', 10));
  console.log('costos_variables año1:', v('costos_variables_k', 1));
  console.log('depreciación año0:', v('depreciacion_anual_k', 0), 'año1:', v('depreciacion_anual_k', 1), 'año8:', v('depreciacion_anual_k', 8), 'año10:', v('depreciacion_anual_k', 10));
  console.log('costo_laboral año0:', v('costo_laboral_k', 0), 'año1:', v('costo_laboral_k', 1));
  console.log('canon año0:', v('canon_k', 0), 'año1:', v('canon_k', 1));
  console.log('UAI año0:', v('utilidad_antes_impuestos_k', 0), 'año1:', v('utilidad_antes_impuestos_k', 1), 'año2:', v('utilidad_antes_impuestos_k', 2), 'año3:', v('utilidad_antes_impuestos_k', 3));
  console.log('impuesto año1:', v('impuesto_utilidades_k', 1));
  console.log('UDI año0:', v('utilidad_despues_impuestos_k', 0), 'año1:', v('utilidad_despues_impuestos_k', 1));
  console.log('FCFF 0..5:', [0, 1, 2, 3, 4, 5].map((t) => ind.fcff[t]?.toFixed(2)).join(', '));
  console.log('FCFFacum 0..5:', [0, 1, 2, 3, 4, 5].map((t) => ind.fcffAcumulado[t]?.toFixed(2)).join(', '));
  console.log('FCFE 0..5:', [0, 1, 2, 3, 4, 5].map((t) => ind.fcfe[t]?.toFixed(2)).join(', '));
  console.log('FCFEacum 0..5:', [0, 1, 2, 3, 4, 5].map((t) => ind.fcfeAcumulado[t]?.toFixed(2)).join(', '));
  console.log('recProyecto:', JSON.stringify(ind.recuperacionProyecto));
  console.log('recSocios:', JSON.stringify(ind.recuperacionSocios));
  console.log('deuda años1-3:', m.deuda.slice(1, 4).map((f) => `int:${f.interesDevengado.toFixed(1)} amort:${f.amortizacion.toFixed(1)} saldo:${f.saldoFinal.toFixed(1)}`).join(' | '));
  console.log('deuda saldo año6,7:', m.deuda[6].saldoFinal, m.deuda[7].saldoFinal);
  console.log('dividendos año1:', JSON.stringify(m.dividendos.find((d) => d.anio === 1)));
  console.log('dividendos año2:', JSON.stringify(m.dividendos.find((d) => d.anio === 2)));
  console.log('div cubana año1:', v('dividendos_parte_cubana_k', 1), 'año2:', v('dividendos_parte_cubana_k', 2));
  console.log('beneficios año0:', ind.beneficiosPais[0], 'año1:', ind.beneficiosPais[1]);
  console.log('beneficios acum total:', ind.beneficiosPaisAcumulados, 'explot:', ind.beneficiosPaisExplotacion);
  console.log('capacidad sv-1 año1:', JSON.stringify(m.capacidadServicios['sv-1']?.[1]));
  console.log('capacidad sv-1 año9:', JSON.stringify(m.capacidadServicios['sv-1']?.[9]));
  console.log('capacidad sv-1 año10:', JSON.stringify(m.capacidadServicios['sv-1']?.[10]));
  console.log('excedidas:', m.servicios.filter((s) => s.capacidadesExcedidas.length).map((s) => s.id + ':' + s.capacidadesExcedidas.join('/')).join(' | ') || 'ninguna');
  console.log('capexAmp:', JSON.stringify(ind.capexAmpliaciones));
  const recs = m.recursosCalculados.map((r) => `${r.nombre}: max ${Math.max(...Object.values(r.utilizacion)).toFixed(3)}`).join(' | ');
  console.log('recursos util:', recs);
  const d = diagnosticar(p, m);
  console.log('diagnóstico conteo:', JSON.stringify(d.resumen.conteo));
  console.log('dimensiones:', d.resumen.dimensiones.map((x) => `${x.id}=${x.estado}`).join(' '));
  return m;
}

const clinica = volcar('CLÍNICA SONRISA HABANA', crearProyectoClinica());

// Escenario A forzado: la ampliación se ignora
const escA = crearProyectoClinica();
escA.tecnico.escenarioCapacidad = 'A_constante';
const mA = computeProject(escA);
console.log('\n=== CLÍNICA esc. A ===');
console.log('excedidas:', mA.servicios.filter((s) => s.capacidadesExcedidas.length).map((s) => s.id + ':' + s.capacidadesExcedidas.join('/')).join(' | ') || 'ninguna');
console.log('ingresos año10 (A):', mA.valores['ingresos_servicios_k']?.[10]);
console.log('issues:', [...new Set(mA.issues.map((i) => i.codigo))].join(', '));

volcar('CENTRO DE DIAGNÓSTICO', crearProyectoCentro() as unknown as ReturnType<typeof crearProyectoClinica>);
