// Smoke test R2: cobertura temporal + escudo robusto (no es suite formal).
import { computeProject } from '../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../src/lib/planex/templates/clinica';
import { PlanexProject } from '../src/lib/planex/types';

const clon = (): PlanexProject => JSON.parse(JSON.stringify(p0)) as PlanexProject;
const p0 = crearProyectoClinica();

function resumen(etiqueta: string, p: PlanexProject) {
  const m = computeProject(p);
  const esc = m.indicadores.escudoFiscalInfo;
  console.log(`\n=== ${etiqueta} ===`);
  console.log('escudo clase:', esc.clase, '| confiable:', esc.confiable, '| noCalculable:', esc.noCalculableAnios);
  console.log('escudo año1:', (m.indicadores.escudoFiscal[1] ?? 0).toFixed(3));
  console.log('arranque: fuentesAnio0', m.arranque.fuentesAnio0.toFixed(2), '| brecha', m.arranque.brecha.toFixed(3), '| brechaNominal', m.arranque.brechaNominal.toFixed(3), '| noInventariadas', m.arranque.noInventariadas.map((x) => x.id));
  console.log('cobertura deficitCaja:', JSON.stringify(m.cobertura.deficitCaja));
  console.log('cobertura deficitCobertura:', JSON.stringify(m.cobertura.deficitCobertura));
  console.log('caja proyectada:', m.cobertura.porAnio.slice(0, 4).map((c) => `t${c.anio}:${c.cajaProyectada.toFixed(1)}`).join(' '));
  console.log('issues:', m.issues.filter((i) => ['FINANCIACION_ANO0', 'DEFICIT_CAJA_PROYECTADA', 'SALIDA_CAJA_ANIO0_NO_INVENTARIADA', 'ESCUDO_FISCAL_NO_CALCULABLE', 'FINANCIACION_INSUFICIENTE'].includes(i.codigo)).map((i) => i.codigo));
  return m;
}

// 1) Base: todo disponible en el año 0
const mBase = resumen('BASE (todo en año 0)', p0);

// 2) Financiación total suficiente pero desembolsos tardíos (aportaciones en año 1)
const pTardia = clon();
pTardia.aportaciones.forEach((a) => { a.montos = [0, a.montos[0], 0]; });
resumen('APORTACIONES TARDÍAS (año 1)', pTardia);

// 3) Crédito con desembolso en año posterior
const pCredito = clon();
pCredito.financiero.deuda.anioDesembolso = 1;
resumen('CRÉDITO EN AÑO 1', pCredito);

// 4) Aportaciones distribuidas en varios años
const pDist = clon();
pDist.aportaciones.forEach((a) => { const m0 = a.montos[0]; a.montos = [m0 * 0.5, m0 * 0.3, m0 * 0.2]; });
resumen('APORTACIONES DISTRIBUIDAS 50/30/20', pDist);

// 5) Regla de impuestos con base intermedia y umbral
const pInter = clon();
{
  const reglas = pInter.reglas;
  const nuevo = {
    id: 'base_gravable_k',
    nombre: 'Base gravable (demo R2)',
    descripcion: 'Base intermedia de prueba: MAX(0, UAI − 400).',
    ambito: 'anio' as const,
    categoria: 'Resultados',
    unidad: 'kUSD',
    expresion: 'MAX(0, utilidad_antes_impuestos_k - 400)',
    expresionDefault: 'MAX(0, utilidad_antes_impuestos_k - 400)',
    habilitada: true,
  };
  reglas.push(nuevo);
  const imp = reglas.find((r) => r.id === 'impuesto_utilidades_k')!;
  imp.expresion = 'base_gravable_k * tasa_impuesto_utilidades';
  const cti = reglas.find((r) => r.id === 'costos_totales_k')!;
  cti.expresion = cti.expresion.replace('interes_k', 'interes_k'); // sin cambio
}
{
  const m = computeProject(pInter);
  const uai1 = m.valores['utilidad_antes_impuestos_k'][1];
  const int1 = m.deuda.find((f) => f.anio === 1)!.interesDevengado;
  const tasa = 0.35;
  const esperado = Math.max(0, Math.max(0, uai1 + int1 - 400) * tasa - Math.max(0, uai1 - 400) * tasa);
  console.log('\n=== BASE INTERMEDIA (MAX(0, UAI−400) × 35 %) ===');
  console.log('uai1:', uai1.toFixed(2), 'int1:', int1.toFixed(2));
  console.log('escudo motor:', (m.indicadores.escudoFiscal[1] ?? 0).toFixed(4));
  console.log('escudo esperado (contrafactual independiente):', esperado.toFixed(4));
  console.log('clase:', m.indicadores.escudoFiscalInfo.clase, '| confiable:', m.indicadores.escudoFiscalInfo.confiable);
}

// 6) Regla independiente de la base (impuesto sobre INGRESOS)
const pInd = clon();
{
  const imp = pInd.reglas.find((r) => r.id === 'impuesto_utilidades_k')!;
  imp.expresion = 'ingresos_totales_k * 0.05';
}
{
  const m = computeProject(pInd);
  console.log('\n=== IMPUESTO SOBRE INGRESOS (independiente de la base) ===');
  console.log('clase:', m.indicadores.escudoFiscalInfo.clase, '| escudo año1:', m.indicadores.escudoFiscal[1], '| confiable:', m.indicadores.escudoFiscalInfo.confiable);
}

// 7) Regla que evalúa bien pero NO puede reevaluarse en el contrafactual:
//    base = POW(410 − UAI, 0,5): con UAI real (∈ (386, 410)) la raíz existe;
//    con la base hipotética UAI+24 > 410 la base es negativa → error de dominio.
const pCirc = clon();
{
  pCirc.reglas.push({
    id: 'base_raiz_k',
    nombre: 'Base con raíz (demo R2)',
    descripcion: 'Base de prueba: raíz cuadrada de (410 − UAI).',
    ambito: 'anio',
    categoria: 'Resultados',
    unidad: 'kUSD',
    expresion: 'POW(410 - utilidad_antes_impuestos_k, 0.5)',
    expresionDefault: 'POW(410 - utilidad_antes_impuestos_k, 0.5)',
    habilitada: true,
  });
  const imp = pCirc.reglas.find((r) => r.id === 'impuesto_utilidades_k')!;
  imp.expresion = 'base_raiz_k * tasa_impuesto_utilidades';
}
{
  const m = computeProject(pCirc);
  console.log('\n=== REGLA NO REEVALUABLE (raíz de base negativa en contrafactual) ===');
  console.log('impuesto año1 (evaluación normal):', m.valores['impuesto_utilidades_k'][1]?.toFixed(3), '| UDI año1:', m.valores['utilidad_despues_impuestos_k'][1]?.toFixed(2));
  console.log('clase:', m.indicadores.escudoFiscalInfo.clase, '| confiable:', m.indicadores.escudoFiscalInfo.confiable, '| noCalculable:', m.indicadores.escudoFiscalInfo.noCalculableAnios);
  console.log('issues ESCUDO_FISCAL_NO_CALCULABLE:', m.issues.filter((i) => i.codigo === 'ESCUDO_FISCAL_NO_CALCULABLE').length);
}

// 8) Gasto adicional de puesta en marcha no inventariado (regla nueva en costos)
const pGasto = clon();
{
  pGasto.reglas.push({
    id: 'gasto_puesta_marcha_k',
    nombre: 'Gasto adicional de puesta en marcha',
    descripcion: 'Gasto del año 0 no capitalizable (prueba R2).',
    ambito: 'anio',
    categoria: 'Costos',
    unidad: 'kUSD',
    expresion: 'IF(PERIODO = 0, 25, 0)',
    expresionDefault: 'IF(PERIODO = 0, 25, 0)',
    habilitada: true,
  });
  const ct = pGasto.reglas.find((r) => r.id === 'costos_totales_k')!;
  ct.expresion = ct.expresion + ' + gasto_puesta_marcha_k';
}
{
  const m = computeProject(pGasto);
  console.log('\n=== GASTO ADICIONAL NO INVENTARIADO (25 kUSD año 0) ===');
  console.log('noInventariadas:', m.arranque.noInventariadas.map((x) => `${x.id}:${x.monto}`));
  console.log('brecha (no computa el gasto hasta declararse):', m.arranque.brecha.toFixed(3));
  console.log('issue SALIDA_CAJA_ANIO0_NO_INVENTARIADA:', m.issues.some((i) => i.codigo === 'SALIDA_CAJA_ANIO0_NO_INVENTARIADA'));
}

// 9) Sin deuda
const pSin = clon();
pSin.financiero.deuda.habilitada = false;
pSin.parametros.find((x) => x.id === 'credito_monto_k')!.valor = 0;
pSin.parametros.find((x) => x.id === 'capital_trabajo_k')!.valor = 235 + 300; // compensar el crédito para que la financiación siga cuadrando
{
  const m = computeProject(pSin);
  console.log('\n=== SIN DEUDA ===');
  console.log('clase:', m.indicadores.escudoFiscalInfo.clase, '| escudo total:', Object.values(m.indicadores.escudoFiscal).reduce((s, v) => s + v, 0));
  console.log('FCFF=FCFE todos los años:', m.years.every((t) => Math.abs((m.indicadores.fcff[t] ?? 0) - (m.indicadores.fcfe[t] ?? 0)) < 1e-9));
}

console.log('\nBASE issues FINANCIACION_ANO0:', mBase.issues.some((i) => i.codigo === 'FINANCIACION_ANO0'));
console.log('BASE recuperación proyecto:', mBase.indicadores.recuperacionProyecto.anios, '| socios:', mBase.indicadores.recuperacionSocios.anios);
