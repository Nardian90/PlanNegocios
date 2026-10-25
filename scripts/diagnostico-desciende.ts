// Diagnóstico del proyecto p2 del test §16.6 (ingresos a la baja):
// vuelca UAI/UDI/ingresos por año y el análisis generado, para decidir
// el mecanismo correcto de 'DESCIENDE'.
import { computeProject } from '../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../src/lib/planex/templates/clinica';
import { generarAnalisis } from '../src/lib/planex/engine/analisis';

const p1 = crearProyectoClinica();
const m1 = computeProject(p1);
const p2 = JSON.parse(JSON.stringify(p1)) as typeof p1;
p2.parametros.find((x) => x.id === 'crecimiento_volumen')!.valor = 0;
p2.servicios.forEach((s) => { s.precioBase = s.precioBase * 0.6; });
const m2 = computeProject(p2);

const v = (m: typeof m2, id: string, t: number) => m.valores[id]?.[t] ?? 0;
console.log('t | ingresos | UAI | UDI');
for (let t = 1; t <= 10; t++) {
  console.log(
    `${t} | ${v(m2, 'ingresos_totales_k', t).toFixed(2)} | ${v(m2, 'utilidad_antes_impuestos_k', t).toFixed(3)} | ${v(m2, 'utilidad_despues_impuestos_k', t).toFixed(3)}`
  );
}
console.log('\nUAI mínimo intermedio vs año1:',
  (() => {
    const uais = Array.from({ length: 10 }, (_, i) => v(m2, 'utilidad_antes_impuestos_k', i + 1));
    const minAfter1 = Math.min(...uais.slice(1));
    return `uai1=${uais[0].toFixed(3)} min(t>=2)=${minAfter1.toFixed(3)} declinaAlgunAño=${uais.some((x, i) => i > 0 && x < uais[i - 1])}`;
  })()
);
console.log('\n--- análisis ingresos_costos (p2) ---');
console.log(generarAnalisis(p2, m2).ingresos_costos.texto);
console.log('\n--- m1 ingresos año1:', v(m1, 'ingresos_totales_k', 1), 'vs m2:', v(m2, 'ingresos_totales_k', 1));
