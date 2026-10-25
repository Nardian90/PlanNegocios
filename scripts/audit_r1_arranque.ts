// Smoke test R1: conciliación del arranque desde salidas de caja explícitas.
import { computeProject } from '../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../src/lib/planex/templates/clinica';
import { conciliarArranque } from '../src/lib/planex/engine/flujos';
import { generarAnalisis } from '../src/lib/planex/engine/analisis';
import { diagnosticar } from '../src/lib/planex/model/controles';

const p = crearProyectoClinica();
const m = computeProject(p);
const a = conciliarArranque(m);
console.log('conciliarArranque:', JSON.stringify(a, null, 1));
const issue = m.issues.find((i) => i.codigo === 'FINANCIACION_ANO0');
console.log('FINANCIACION_ANO0 presente:', !!issue);
console.log('mensaje:', issue?.mensaje?.slice(0, 260));
const an = generarAnalisis(p, m);
console.log('narrativa contiene 576,0:', an.inversion_financiacion.texto.includes('576,0'));
console.log('narrativa salidas explícitas:', an.inversion_financiacion.texto.includes('salidas de caja del año 0 explícitamente identificadas'));
const d = diagnosticar(p, m);
console.log('diagnóstico estado:', d.resumen.estadoGeneral.estado);
console.log('hallazgo FINANCIACION_ANO0:', d.hallazgos.some((h) => h.codigo === 'FINANCIACION_ANO0'));
