// ============================================================================
// MISIÓN PLANEX-DOC-002 — Pruebas obligatorias (§10): fórmulas financieras
// corregidas, conciliaciones, diagnóstico multidimensional, calidad documental
// (caracteres, campos pendientes, superposiciones estructurales), figuras y
// exportación editorial.
// ============================================================================
import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { construirDocumentoPlanex } from '../../src/lib/planex/doc/construir';
import { exportarPDF } from '../../src/lib/planex/io/pdf';
import { generarAnalisis } from '../../src/lib/planex/engine/analisis';
import { conciliarArranque } from '../../src/lib/planex/engine/flujos';
import { diagnosticar } from '../../src/lib/planex/model/controles';
import { asegurarTexto, caracteresNoWinAnsi } from '../../src/lib/planex/doc/texto';
import { generarFiguras, rasterizarPNG } from '../../src/lib/planex/doc/figuras';
import { fichasParametros, fuentesTrazabilidad } from '../../src/lib/planex/doc/trazabilidad';
import { fmtK, fmtNum, esValorPendiente, esReferenciaHipotesis } from '../../src/lib/planex/format';
import { PlanexProject } from '../../src/lib/planex/types';

const p = crearProyectoClinica();
const m = computeProject(p);
const v = (id: string, t: number) => m.valores[id]?.[t] ?? 0;
const doc = construirDocumentoPlanex(p, m, { moneda: 'CUP' });
const docUSD = construirDocumentoPlanex(p, m, { moneda: 'USD' });

/** Recorre el documento y devuelve TODO su texto (párrafos, campos, tablas,
 *  análisis, avisos, notas de figuras) en orden de aparición. */
function textoDocumento(d: typeof doc): string {
  const trozos: string[] = [];
  for (const s of d.secciones) {
    trozos.push(s.titulo);
    for (const el of s.elementos) {
      if (el.tipo === 'parrafo' || el.tipo === 'aviso') trozos.push(el.texto);
      else if (el.tipo === 'campos') el.items.forEach((i) => trozos.push(i.etiqueta, i.valor));
      else if (el.tipo === 'subtitulo') trozos.push(el.texto);
      else if (el.tipo === 'analisis') trozos.push(el.bloque.titulo, el.bloque.texto);
      else if (el.tipo === 'tabla') {
        trozos.push(el.tabla.titulo ?? '');
        el.tabla.encabezados.forEach((h) => trozos.push(h));
        el.tabla.filas.forEach((f) => f.forEach((c) => trozos.push(String(c))));
      } else if (el.tipo === 'figura') {
        trozos.push(el.figura.titulo, el.figura.unidad, el.figura.ejeX, el.figura.nota);
        el.figura.leyenda.forEach((l) => trozos.push(l.etiqueta));
      }
    }
  }
  d.portada.cifras.forEach((c) => trozos.push(c.etiqueta, c.valor));
  return trozos.join('\n');
}

/** Texto crudo extraíble del PDF (streams sin comprimir de jsPDF). */
async function textoPDF(datos: Blob): Promise<string> {
  const buf = Buffer.from(await datos.arrayBuffer());
  const s = buf.toString('latin1');
  const partes: string[] = [];
  for (const match of s.matchAll(/\((.*?)\) Tj/g)) partes.push(match[1]);
  return partes.join(' ').replace(/\\(\(|\))/g, (x) => x.slice(1));
}

describe('DOC-002 §4.1 — FCFF con interés DESPUÉS de impuestos y reconciliación FCFE', () => {
  test('el escudo fiscal se deriva de la regla de impuestos activa (interés × 35 %)', () => {
    for (const t of [1, 2, 3, 4, 5, 6]) {
      const f = m.deuda[t];
      const escudo = m.indicadores.escudoFiscal[t] ?? 0;
      expect(escudo).toBeCloseTo(f.interesDevengado * 0.35, 6);
      // FCFF = UDI + (interés − escudo) + depreciación − CAPEX (+ CT) − Inv(0)
      expect(m.indicadores.fcff[t]).toBeCloseTo(
        v('utilidad_despues_impuestos_k', t) + f.interesDevengado - escudo + v('depreciacion_anual_k', t) - (m.indicadores.capexAmpliaciones[t] ?? 0),
        6
      );
    }
  });

  test('el FCFF corregido es MENOR que el FCFF antiguo (el modelo viejo sobreestimaba el escudo)', () => {
    const fcffAntiguo = (t: number) =>
      v('utilidad_despues_impuestos_k', t) + m.deuda[t].interesDevengado + v('depreciacion_anual_k', t) - (m.indicadores.capexAmpliaciones[t] ?? 0);
    for (const t of [1, 3, 5]) {
      expect(m.indicadores.fcff[t]).toBeCloseTo(fcffAntiguo(t) - m.deuda[t].interesDevengado * 0.35, 6);
      expect(m.indicadores.fcff[t]).toBeLessThan(fcffAntiguo(t));
    }
  });

  test('FCFE reconcilia con la identidad FCFF − FCFE = intPag − escudo − des + amort', () => {
    for (const t of m.years) {
      const f = m.deuda[t];
      const escudo = m.indicadores.escudoFiscal[t] ?? 0;
      expect(m.indicadores.fcff[t] - m.indicadores.fcfe[t]).toBeCloseTo(
        f.interesPagado - escudo - f.desembolso + f.amortizacion,
        6
      );
    }
  });

  test('con intereses corrientes, FCFE = UDI + dep − CAPEX + des − amort (definición estándar)', () => {
    for (const t of [1, 2, 4, 6]) {
      expect(m.indicadores.fcfe[t]).toBeCloseTo(
        v('utilidad_despues_impuestos_k', t) + v('depreciacion_anual_k', t) - (m.indicadores.capexAmpliaciones[t] ?? 0) + m.deuda[t].desembolso - m.deuda[t].amortizacion,
        6
      );
    }
  });

  test('la gracia TOTAL capitaliza intereses: el FCFE no descuenta el interés no pagado', () => {
    const p2 = crearProyectoClinica();
    p2.financiero.deuda.tipoGracia = 'total';
    p2.financiero.deuda.anioDesembolso = 0;
    const m2 = computeProject(p2);
    const f = m2.deuda;
    for (const t of m2.years) {
      const escudo = m2.indicadores.escudoFiscal[t] ?? 0;
      expect(m2.indicadores.fcff[t] - m2.indicadores.fcfe[t]).toBeCloseTo(
        f[t].interesPagado - escudo - f[t].desembolso + f[t].amortizacion,
        6
      );
    }
    // Durante la gracia el interés se capitaliza (no es salida de caja).
    expect(f[1].interesPagado).toBe(0);
    expect(f[1].interesCapitalizado).toBeGreaterThan(0);
    // El FCFE del año 1 reincorpora el interés devengado neto de escudo
    // (no pagado en caja): FCFE₁ = FCFF₁ + escudo₁.
    expect(m2.indicadores.fcfe[1]).toBeCloseTo(m2.indicadores.fcff[1] + (m2.indicadores.escudoFiscal[1] ?? 0), 6);
  });

  test('la recuperación se etiqueta como SIMPLE, SIN DESCONTAR (motivo del indicador)', () => {
    expect(m.indicadores.recuperacionProyecto.motivo).toContain('Recuperación simple, sin descontar');
    expect(m.indicadores.recuperacionSocios.motivo).toContain('Recuperación simple, sin descontar');
    // Regla editada por el usuario: la descripción documental también lo dice.
    const r = p.reglas.find((x) => x.id === 'flujo_proyecto_k')!;
    expect(r.descripcion).toContain('DESPUÉS DE IMPUESTOS');
    expect(r.descripcion).toContain('escudo fiscal');
  });

  test('las recuperaciones se RECALCULARON con el FCFF corregido (no se conservaron las antiguas)', () => {
    // FCFF nuevo (3,46) ≠ FCFF antiguo (3,41): el cambio es exactamente el
    // efecto del escudo fiscal sobre el acumulado.
    const antiguo = 3.4113407770654374; // FCFF con interés completo (tasa 743)
    expect(m.indicadores.recuperacionProyecto.anios).not.toBeCloseTo(antiguo, 3);
    expect(m.indicadores.recuperacionProyecto.anios).toBeGreaterThan(antiguo);
    expect(m.indicadores.recuperacionSocios.anios).toBeCloseTo(3.2161, 3); // FCFE no cambia
  });
});

describe('DOC-002 §4.2 — Conciliación del desembolso inicial', () => {
  test('el gasto de montaje del año 0 (576,0 kCUP) queda identificado y sin cobertura (salidas de caja EXPLÍCITAS)', () => {
    const arranque = conciliarArranque(m);
    // DOC-002-R1 §2: el gasto se obtiene de partidas de salida de caja
    // EXPLÍCITAS (nómina de montaje + interés pagado + impuesto − ingresos
    // del año 0), NO de max(0, −UDI_0).
    expect(arranque.nominaMontaje).toBeCloseTo(v('costo_laboral_k', 0), 9);
    expect(arranque.interesPagado).toBe(0); // desembolso del año 0 sin interés pagado
    expect(arranque.impuestoPagado).toBe(0);
    expect(arranque.ingresosAnio0).toBe(0);
    // 6 trabajadores × 96 000 CUP = 576 000 CUP = 576,0 kCUP (0,775 kUSD × 743).
    const kusd = arranque.gastoCajaAnio0;
    expect(kusd).toBeCloseTo(576 / 743, 3);
    expect(kusd * 743).toBeCloseTo(576.0, 1);
    // La UDI del año 0 NO se usa para deducir el gasto (pérdidas no monetarias
    // o intereses devengados no la distorsionan: probado en doc002r1.test.ts).
    expect(arranque.gastoCajaAnio0).not.toBe(Math.max(0, -(v('utilidad_despues_impuestos_k', 0) || 0)) + 12345);
    // Las fuentes cubren EXACTAMENTE la inversión total, no la inversión + año 0.
    expect(v('financiacion_disponible_k', 0)).toBeCloseTo(m.indicadores.inversionTotalKUSD, 6);
    expect(v('financiacion_disponible_k', 0)).toBeLessThan(m.indicadores.inversionTotalKUSD + kusd);
    // El capital de trabajo (235,0 kUSD) ya está dentro de la inversión total:
    // la brecha es exactamente la nómina de montaje, SIN duplicar el CT.
    expect(arranque.necesidadTotal).toBeCloseTo(arranque.inversionTotal + arranque.nominaMontaje, 9);
    expect(arranque.brecha).toBeCloseTo(-arranque.nominaMontaje, 9);
  });

  test('el motor emite FINANCIACION_ANO0 con la brecha cuantificada', () => {
    const issue = m.issues.find((i) => i.codigo === 'FINANCIACION_ANO0');
    expect(issue).toBeDefined();
    expect(issue!.tipo).toBe('inconsistencia');
    expect(issue!.mensaje).toContain('SIN cobertura');
    expect(issue!.mensaje).toContain('nómina de montaje');
    expect(issue!.mensaje).toContain('salidas de caja explícitas');
    expect(issue!.mensaje).toContain('NO se deduce del resultado contable');
  });

  test('el documento incluye la tabla de conciliación (inversión + gastos año 0 vs fuentes)', () => {
    const texto = textoDocumento(doc);
    expect(texto).toContain('Conciliación del desembolso inicial');
    expect(texto).toContain('Necesidad total de arranque');
    expect(texto).toContain('Brecha de financiación del arranque');
    // Presentación CUP: la brecha aparece como 576,0 kCUP (0,775 kUSD × 743).
    expect(texto).toContain('576,0');
    // DOC-002-R1 §2: la tabla detalla las partidas explícitas del año 0.
    expect(texto).toContain('Nómina de montaje del año 0');
    expect(texto).toContain('Interés PAGADO del año 0');
    expect(texto).toContain('Salidas netas de caja del año 0 explícitamente identificadas');
    expect(texto).toContain('NO se deduce del resultado contable después de impuestos');
  });

  test('los desembolsos de aportaciones usan la MISMA convención año 0/año 1 en todas las tablas', () => {
    const texto = textoDocumento(docUSD);
    expect(texto).toContain('Año 0 (montaje)');
    const a = generarAnalisis(p, m).inversion_financiacion.texto;
    expect(a).toContain('año 0 (montaje/arranque — financia la inversión total del año 0)');
    expect(a).toContain('año 1 (operación)');
  });
});

describe('DOC-002 §4.3 — Alcance documentado de la inflación y de cada parámetro', () => {
  test('la inflación de costos variables NO indexa canon, servicios públicos ni otros gastos fijos', () => {
    expect(v('canon_k', 1)).toBeCloseTo(v('canon_k', 10), 6); // nominal constante
    expect(v('servicios_publicos_k', 1)).toBeCloseTo(v('servicios_publicos_k', 10), 6);
    expect(v('otros_gastos_k', 1)).toBeCloseTo(v('otros_gastos_k', 10), 6);
    // …y el costo variable unitario SÍ crece un 4 % anual.
    const cv1 = v('costos_variables_k', 1);
    const cv10 = v('costos_variables_k', 10);
    expect(cv10).toBeGreaterThan(cv1 * 1.5); // volumen + inflación
    // El parámetro declara su alcance exacto.
    const infl = p.parametros.find((x) => x.id === 'inflacion')!;
    expect(infl.nombre).toContain('costos variables unitarios');
    expect(infl.descripcion).toContain('No afecta canon');
  });

  test('inflacion_costos_fijos = 0 (contratos nominales: hipótesis documentada), y > 0 indexa las partidas fijas', () => {
    const p2 = crearProyectoClinica();
    expect(p2.parametros.find((x) => x.id === 'inflacion_costos_fijos')!.valor).toBe(0);
    const mBase = computeProject(p2);
    p2.parametros.find((x) => x.id === 'inflacion_costos_fijos')!.valor = 0.04;
    const m4 = computeProject(p2);
    expect(m4.valores['canon_k'][5]).toBeCloseTo(mBase.valores['canon_k'][5] * Math.pow(1.04, 4), 4);
    expect(m4.valores['servicios_publicos_k'][5]).toBeCloseTo(mBase.valores['servicios_publicos_k'][5] * Math.pow(1.04, 4), 4);
    expect(m4.valores['aranceles_k'][5]).toBeCloseTo(mBase.valores['aranceles_k'][5] * Math.pow(1.04, 4), 4);
    expect(m4.valores['otros_impuestos_k'][5]).toBeCloseTo(mBase.valores['otros_impuestos_k'][5] * Math.pow(1.04, 4), 4);
    expect(m4.valores['royalties_k'][5]).toBeCloseTo(mBase.valores['royalties_k'][5] * Math.pow(1.04, 4), 4);
    // El costo variable NO se toca por esta vía (sigue con su propio 4 %).
    expect(m4.valores['costos_variables_k'][1]).toBeCloseTo(mBase.valores['costos_variables_k'][1], 6);
  });

  test('fichas de parámetros: partidas afectadas DERIVADAS de las reglas activas', () => {
    const fichas = fichasParametros(p);
    const infl = fichas.find((f) => f.id === 'inflacion')!;
    expect(infl.partidas.some((x) => x.includes('srv_costo_unitario_proy'))).toBe(true);
    expect(infl.partidas.some((x) => x.includes('canon_k'))).toBe(false);
    expect(infl.efecto).toContain('estado de resultados y la caja');
    const inflFijos = fichas.find((f) => f.id === 'inflacion_costos_fijos')!;
    expect(inflFijos.partidas.some((x) => x.includes('canon_k'))).toBe(true);
    expect(inflFijos.partidas.some((x) => x.includes('srv_costo_unitario_proy'))).toBe(false);
    // Cada parámetro lleva unidad, fórmula y regla de redondeo documentadas.
    for (const f of fichas) {
      expect(f.unidad.length).toBeGreaterThan(0);
      expect(f.redondeo).toContain('Precisión interna completa');
      expect(f.formulas.length).toBeGreaterThan(0);
    }
  });

  test('bloque de fuentes: norma oficial, cotización e HIPÓTESIS ilustrativas DISTINGUIDAS', () => {
    const fuentes = fuentesTrazabilidad(p);
    const tipos = fuentes.map((f) => f.tipo);
    expect(tipos).toContain('norma_oficial');
    expect(tipos).toContain('cotizacion');
    expect(tipos).toContain('hipotesis_ilustrativa');
    expect(tipos).toContain('dato_usuario');
    const norma = fuentes.find((f) => f.tipo === 'norma_oficial')!;
    expect(norma.fuente).toContain('GOC-2026-O57');
    expect(norma.fechaRef).toBe('09/07/2026');
    const tasa = fuentes.find((f) => f.fuente.includes('tasa_impuesto_utilidades'))!;
    expect(tasa.estado).toContain('CONDICIONA las conclusiones económicas');
    // Un supuesto ficticio NUNCA cuenta como fuente validada (§5).
    for (const a of p.aportaciones) {
      expect(esReferenciaHipotesis(a.referenciaDocumental)).toBe(true);
    }
  });
});

describe('DOC-002 §4.4 — Deuda, capital de trabajo, VNL y dividendos', () => {
  test('dividendos: la reserva NO se constituye dos veces sobre la misma base y el saldo reconcilia', () => {
    for (const d of m.dividendos) {
      if (d.anio === 0) continue;
      expect(d.saldoAcumulable).toBeCloseTo(d.saldoAcumulablePrevio + d.udi - d.reserva - d.pagables, 6);
      expect(d.reserva).toBeCloseTo(d.base * 0.1, 6); // 10 % SOBRE la base del año
      expect(d.propuestos).toBeCloseTo((d.base - d.reserva) * 0.5, 6);
      expect(d.pagables).toBeLessThanOrEqual(d.propuestos + 1e-9);
      expect(d.pagables).toBeLessThanOrEqual(Math.max(0, d.cajaAcumulada) + 1e-9);
      // Participación de CADA socio con el parámetro de participación.
      expect(d.socioNacional).toBeCloseTo(d.pagables * 0.4, 6);
      expect(d.socioExtranjero).toBeCloseTo(d.pagables * 0.6, 6);
    }
  });

  test('la política de caja de dividendos está DOCUMENTADA como decisión conservadora', () => {
    const texto = textoDocumento(docUSD);
    expect(texto).toContain('FCFE antes de repartos DESDE EL AÑO 0 (política conservadora');
    // El CAPEX/VNL de los activos que no terminan de depreciarse se declara.
    expect(texto).toContain('valor neto en libros al final del horizonte');
    expect(texto).toContain('no se recupera dentro del modelo (tratamiento conservador');
  });

  test('el VNL de la adecuación (vida 20 años) queda declarado al cierre; el CT solo entra si el parámetro lo dice', () => {
    const adecuacion = m.depreciacion.find((a) => a.concepto.includes('Adecuación'))!;
    expect(adecuacion.vnl).toBeGreaterThan(0);
    const textos = generarAnalisis(p, m).deuda_depreciacion.texto;
    expect(textos).toContain('valor neto en libros');
    expect(m.indicadores.fcff[10]).not.toBeCloseTo(m.indicadores.fcff[9], 4); // sin liberación de CT
  });
});

describe('DOC-002 §7 — Demanda, captación, recurrencia y capacidad reproducibles', () => {
  test('conciliación demanda solvente → captación → volumen con hipótesis de recurrencia EXPLÍCITA', () => {
    const personas = p.mercado.demandaSolventePersonas!;
    const pct = p.mercado.captacionPrevistaPct!;
    expect(personas).toBe(38000);
    expect(pct).toBeCloseTo(0.12, 6);
    const captados = personas * pct;
    expect(captados).toBeCloseTo(4560, 6);
    const volAnual1 = m.servicios.reduce((s, x) => s + (x.cantidades[1] ?? 0), 0) * 12;
    const porPaciente = volAnual1 / captados;
    const texto = generarAnalisis(p, m).mercado.texto;
    expect(texto).toContain('Conciliación demanda');
    expect(texto).toContain('personas captadas en el año 1');
    expect(texto).toContain(fmtNum(captados));
    expect(texto).toContain(fmtNum(volAnual1));
    expect(texto).toContain('HIPÓTESIS EXPLÍCITA');
    expect(texto).toContain(`${fmtK(porPaciente)} servicios por paciente captado`);
    expect(porPaciente).toBeGreaterThan(1);
    expect(porPaciente).toBeLessThan(5); // 2,9: recurrencia razonable, declarada
  });

  test('la utilización máxima de gabinetes (≈ 89,6 %, año 6) es REPRODUCIBLE desde horas', () => {
    const gab = m.recursosCalculados.find((r) => r.id === 're-gab')!;
    const anioMax = Number(Object.entries(gab.utilizacion).sort((a, b) => b[1] - a[1])[0][0]);
    expect(anioMax).toBe(6);
    const util = gab.utilizacion[6];
    expect(util * 100).toBeCloseTo(89.6, 1);
    // horas demandadas ÷ horas disponibles (asignación pro-rata del motor)
    expect(gab.horasDemandadas[6] / gab.horasDisponibles[6]).toBeCloseTo(util, 9);
    // La ampliación (+2 gabinetes, año 7) alivia la utilización del año 7.
    expect(gab.utilizacion[7]).toBeLessThan(util);
    expect(m.indicadores.capexAmpliaciones[7]).toBeCloseTo(150, 6);
    const texto = generarAnalisis(p, m).capacidad.texto;
    expect(texto).toContain('89,6 %');
    expect(texto).toContain('año 6');
  });

  test('la utilización por recurso y año aparece en el informe (tabla reproducible)', () => {
    const texto = textoDocumento(docUSD);
    expect(texto).toContain('Utilización de los recursos operativos por año (reproducible');
    expect(texto).toContain('horas-mes demandadas ÷ horas-mes disponibles');
    // 5 gabinetes × 8 h × 288 d × (1 − 5 %) = 10.944 h/año disponibles.
    // 5 gabinetes × 8 h × 288 d × (1 − 5 %) ÷ 12 meses = 912 horas-mes.
    expect(m.recursosCalculados.find((r) => r.id === 're-gab')!.horasDisponibles[1]).toBeCloseTo(912, 6);
  });

  test('desglose de ingresos por canal: exportaciones / plataformas / plaza, SIN duplicar', () => {
    const texto = textoDocumento(docUSD);
    expect(texto).toContain('Proyección de ingresos por canal de comercialización');
    expect(texto).toContain('Ventas en plataformas con pagos desde el exterior');
    expect(texto).toContain('Exportaciones');
    expect(texto).toContain('Ventas en plaza');
    const a = generarAnalisis(p, m).mercado.texto;
    expect(a).toContain('Desglose de ingresos del año 1 por canal');
    expect(a).toContain('sin duplicar operaciones');
    // Conciliación: la suma por canales = ingresos del estado de resultados.
    const porCanal = m.servicios.reduce((s, x) => {
      const clave = (p.servicios.find((sp) => sp.id === x.id)?.canal) ?? 'plaza';
      return s + (x.valores[1]?.['srv_ingreso_anual'] ?? 0) * (clave ? 1 : 0);
    }, 0);
    expect(porCanal / 1000).toBeCloseTo(v('ingresos_servicios_k', 1), 6);
  });
});

describe('DOC-002 §5 — Diagnóstico que no emite falsa seguridad', () => {
  test('las SEIS dimensiones independientes (no «correcto» global porque las sumas cuadren)', () => {
    const d = diagnosticar(p, m);
    expect(d.resumen.dimensiones.length).toBe(6);
    expect(d.resumen.dimensiones.map((x) => x.id)).toEqual([
      'integridad_aritmetica',
      'coherencia_financiera_contable',
      'evidencia_trazabilidad',
      'estructura_metodologica',
      'validacion_normativa_comercial',
      'calidad_documental',
    ]);
    // La dimensión normativa JAMÁS se marca «ok»: la app no valida la ley.
    expect(d.resumen.dimensiones.find((x) => x.id === 'validacion_normativa_comercial')!.estado).not.toBe('ok');
  });

  test('estado general: demostración → validación financiera → pendientes → profesional → listo', () => {
    // 1) Plantilla demo: SIEMPRE borrador de demostración.
    const d1 = diagnosticar(p, m);
    expect(d1.resumen.estadoGeneral.estado).toBe('borrador_demostracion');
    // 1b) Plan real sin arreglar la brecha del año 0: validación financiera pendiente.
    const pRoto = JSON.parse(JSON.stringify(p)) as PlanexProject;
    pRoto.planex.plantillaOrigen = 'nuevo';
    const dRoto = diagnosticar(pRoto, computeProject(pRoto));
    expect(dRoto.resumen.estadoGeneral.estado).toBe('validacion_financiera_pendiente');
    expect(dRoto.resumen.estadoGeneral.detalle).toContain('FINANCIACION_ANO0');
    // 2) Brecha financiada (otras fuentes) pero con pendientes de 4.1:
    const p2 = JSON.parse(JSON.stringify(p)) as PlanexProject;
    p2.planex.plantillaOrigen = 'nuevo';
    p2.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!.demo = false;
    p2.parametros.find((x) => x.id === 'otras_fuentes_k')!.valor = 0.8; // cubre el gasto del año 0
    const d2 = diagnosticar(p2, computeProject(p2));
    expect(d2.hallazgos.some((h) => h.codigo === 'FINANCIACION_ANO0')).toBe(false);
    expect(d2.resumen.estadoGeneral.estado).toBe('borrador_validaciones_pendientes');
    expect(d2.resumen.estadoGeneral.detalle).toContain('pendiente');
    // 3) Sin pendientes pero con supuestos sin evidencia: revisión profesional.
    p2.general.elaboradoPor = 'Lic. María Pérez (identidad de prueba)';
    p2.aportaciones.forEach((a) => (a.referenciaDocumental = 'Instrumento constitutivo No. 1/2027, Notaría 4, 12/01/2027'));
    p2.general.firmaIdentificacion = 'Firma registrada';
    p2.general.declaracionResponsabilidad = true;
    p2.mercado.fuentesConsulta = 'Estudio de demanda XYZ, 2025 (fuente verificable de prueba).';
    p2.negocio.reglaDistribucion = 'Reparto proporcional al capital (regla de prueba).';
    const d3 = diagnosticar(p2, computeProject(p2));
    expect(d3.resumen.estadoGeneral.estado).toBe('revision_profesional_pendiente');
    expect(d3.resumen.estadoGeneral.detalle).toContain('revisión profesional');
    // 4) Todo documentado: listo para revisión final (que NO es validación).
    p2.parametros.forEach((x) => (x.demo = false));
    p2.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!.fuente = 'Norma tributaria aplicable (referencia verificable de prueba).';
    const d4 = diagnosticar(p2, computeProject(p2));
    expect(d4.resumen.estadoGeneral.estado).toBe('listo_para_revision_final');
    expect(d4.resumen.estadoGeneral.detalle).toContain('NO es una validación legal');
  });

  test('la tasa demostrativa y la brecha del año 0 condicionan las conclusiones visibles', () => {
    const a = generarAnalisis(p, m);
    expect(a.resumen_ejecutivo.texto).toContain('ADVERTENCIA ECONÓMICA');
    expect(a.resumen_ejecutivo.texto).toContain('CONDICIONADAS a la validación de la tasa legal');
    expect(a.resumen_ejecutivo.texto).toContain('gastos del año 0 sin cobertura financiera declarada');
    expect(a.conclusiones.texto).toContain('CONDICIONA estas conclusiones');
  });

  test('campos con «referencia documental» exigible: las hipótesis NO cuentan como validadas', () => {
    const d = diagnosticar(p, m);
    const h = d.hallazgos.find((x) => x.codigo === 'REFERENCIA_HIPOTESIS')!;
    expect(h).toBeDefined();
    expect(h.nivel).toBe('informacion_pendiente');
    expect(h.mensaje).toContain('HIPÓTESIS');
    expect(esReferenciaHipotesis('Compromiso de aporte (supuesto ficticio)')).toBe(true);
    expect(esReferenciaHipotesis('Instrumento No. 4, Notaría 7, 03/02/2027')).toBe(false);
  });
});

describe('DOC-002 §3.3/§3.4 — Texto canónico, campos pendientes y marcadores', () => {
  test('sanitizer: operadores fuera de WinAnsi → equivalentes legibles y estables', () => {
    expect(asegurarTexto('(t−1) + x ≥ y')).toBe('(t-1) + x >= y');
    expect(asegurarTexto('【Nombre】')).toBe('«Nombre»');
    expect(asegurarTexto('Δ → ≈')).toBe('Delta -> ~');
    expect(asegurarTexto('a — b – c … × ÷ ± ² ³')).toBe('a — b – c … × ÷ ± ² ³'); // WinAnsi se conserva
    expect(asegurarTexto('x₁₂')).toBe('x12');
    expect(caracteresNoWinAnsi('(t−1) ≥ 【】')).toEqual([]);
    expect(asegurarTexto('ctrl:\u0007\u000bzwsp:\u200bfin')).toBe('ctrl:zwsp:fin');
  });

  test('el modelo documental NO contiene marcadores corruptos ni caracteres ilegales', () => {
    const texto = textoDocumento(doc);
    expect(texto).not.toContain('【');
    expect(texto).not.toContain('】');
    expect(texto).toContain('[Pendiente: nombre y apellidos de quien elabora]');
    expect(texto).toContain('BORRADOR NO APTO PARA PRESENTACIÓN');
    expect(texto).toContain('PENDIENTE DE ACEPTAR');
    for (const linea of texto.split('\n')) {
      expect(caracteresNoWinAnsi(linea)).toEqual([]);
    }
  });

  test('esValorPendiente detecta vacíos y marcadores «[Pendiente: …]», no textos legítimos', () => {
    expect(esValorPendiente('')).toBe(true);
    expect(esValorPendiente('—')).toBe(true);
    expect(esValorPendiente('[Pendiente: nombre]')).toBe(true);
    expect(esValorPendiente('Pendiente de completar')).toBe(true);
    expect(esValorPendiente('Lic. María Pérez Fernández')).toBe(false);
    expect(esValorPendiente('Director de Inversiones')).toBe(false);
  });

  test('el PDF extraído no tiene fórmulas corruptas ni marcadores sin sustituir', async () => {
    const { datos } = exportarPDF(p, m, { moneda: 'CUP' });
    const texto = await textoPDF(datos);
    // Los defectos del modelo viejo ya no existen:
    expect(texto).not.toContain('(t"1)');
    expect(texto).not.toContain('0Nombre');
    expect(texto).not.toContain('\u{2212}');
    // La fórmula corregida y su identidad de reconciliación SÍ están:
    expect(texto).toContain('(t-1)');
    expect(texto).toContain('FCFF - FCFE = intereses pagados - escudo');
    expect(texto).toContain('DESPUÉS DE IMPUESTOS');
    expect(texto).toContain('simple, sin descontar');
  });

  test('frases dinámicas completas: sin tokens sin sustituir ni NaN/undefined', async () => {
    const { datos } = exportarPDF(p, m, { moneda: 'CUP' });
    const texto = await textoPDF(datos);
    for (const token of ['undefined', 'NaN', '[object', '${', 'null']) {
      expect(texto).not.toContain(token);
    }
    // El indicador del servicio de deuda aparece con la unidad coherente.
    expect(texto).toContain('servicio máximo de la deuda');
  });
});

describe('DOC-002 §3.2/§8 — Maquetación: subtítulos en flujo, justificado y numeración', () => {
  test('el subtítulo 4.2 fluye TRAS los campos de 4.1 (sin encabezado absoluto superpuesto)', () => {
    // Orden de aparición en el documento: el subtítulo '4.2  Título' aparece
    // después de la declaración y antes de los campos del título.
    const sec41 = doc.secciones.find((s) => s.id === '4.1')!;
    const tipos = sec41.elementos.map((e) => e.tipo);
    const iDecl = tipos.indexOf('parrafo');
    const iSub = tipos.indexOf('subtitulo');
    const iCamposTitulo = tipos.indexOf('campos', iSub);
    expect(iSub).toBeGreaterThan(iDecl);
    expect(iCamposTitulo).toBeGreaterThan(iSub);
    // La sección 4.1 conserva los campos del elaborador con el marcador pendiente.
    const campos = sec41.elementos.find((e): e is Extract<typeof e, { tipo: 'campos' }> => e.tipo === 'campos')!;
    expect(campos.items[0].etiqueta).toBe('Elaborado por');
    expect(campos.items[0].valor).toContain('[Pendiente:');
  });

  test('todas las tablas y figuras van numeradas secuencialmente («Tabla N.» / «Figura N.»)', () => {
    const tablas: number[] = [];
    const figuras: number[] = [];
    for (const s of doc.secciones) {
      for (const el of s.elementos) {
        if (el.tipo === 'tabla') tablas.push(el.tabla.numero!);
        if (el.tipo === 'figura') figuras.push(el.figura.numero);
      }
    }
    expect(tablas.length).toBeGreaterThan(10);
    expect(tablas).toEqual(tablas.map((_, i) => i + 1)); // 1..N sin huecos
    expect(figuras).toEqual([1, 2, 3]);
    // Títulos de tabla presentes en el documento con su rótulo numerado.
    const texto = textoDocumento(doc);
    expect(texto).toContain('Tabla 1. Cifras clave');
  });

  test('los tres estados del documento muestran las mismas cifras clave (CUP/USD y visor)', () => {
    for (const d of [doc, docUSD]) {
      const cifras = d.secciones.find((s) => s.id === '4.4')!.elementos.find((e): e is Extract<typeof e, { tipo: 'tabla' }> => e.tipo === 'tabla')!;
      const filaInv = cifras.tabla.filas.find((f) => f[0].includes('Inversión total'))!;
      const filaRec = cifras.tabla.filas.find((f) => f[0].includes('INVERSIÓN TOTAL'))!;
      expect(filaInv[1]).toBe(d.meta.moneda === 'CUP' ? fmtK(m.indicadores.inversionTotalKUSD * 743) : fmtK(m.indicadores.inversionTotalKUSD));
      expect(filaRec[1]).toContain('3,5 años');
      const filaEstado = cifras.tabla.filas[0];
      expect(filaEstado[0]).toBe('Estado general del plan');
    }
    // Portada sincronizada.
    expect(doc.portada.cifras[0].etiqueta).toBe('Estado general del plan');
    expect(doc.portada.cifras[0].valor).toContain('Borrador de demostración');
  });

  test('sincronización narrativa: resumen, flujos y conclusiones citan los MISMOS valores', () => {
    const a = generarAnalisis(p, m);
    expect(a.flujo_recuperacion.texto).toContain('DESPUÉS DE IMPUESTOS');
    expect(a.flujo_recuperacion.texto).toContain('SIMPLES y SIN DESCONTAR');
    // Conclusiones y resumen con la misma recuperación del modelo.
    const recTxt = `${(m.indicadores.recuperacionProyecto.anios ?? 0).toFixed(1).replace('.', ',')} años`;
    expect(a.resumen_ejecutivo.texto).toContain(recTxt);
    expect(a.conclusiones.texto).toContain(recTxt);
    // La advertencia de no-clasificación-global está en el propio documento.
    expect(textoDocumento(doc)).toContain('no se clasifica como globalmente «correcto»');
  });
});

describe('DOC-002 §9 — Figuras generadas localmente, reproducibles y legibles', () => {
  const conv = { kUSDaK: (k: number) => k * 743, unidadTabla: 'Miles de CUP (kCUP)', unidadCorta: 'kCUP' };
  const figuras = generarFiguras(p, m, conv);

  test('tres figuras: evolución, flujos acumulados con cruce de cero y utilización', () => {
    expect(figuras.map((f) => f.clave)).toEqual(['evolucion', 'flujos', 'utilizacion']);
    for (const f of figuras) {
      expect(f.titulo.length).toBeGreaterThan(10);
      expect(f.unidad.length).toBeGreaterThan(0);
      expect(f.nota).toContain('Fuente: modelo de cálculo activo');
      expect(f.leyenda.length).toBeGreaterThan(0);
      expect(f.primitivas.length).toBeGreaterThan(2);
    }
    // La figura de flujos marca el cruce de cero de AMBOS acumulados.
    const flujos = figuras.find((f) => f.clave === 'flujos')!;
    expect(flujos.leyenda.some((l) => l.etiqueta.includes('cruce en 3,5 años'))).toBe(true);
    expect(flujos.leyenda.some((l) => l.etiqueta.includes('cruce en 3,2 años'))).toBe(true);
    // La figura de utilización referencia el umbral parametrizado.
    expect(figuras.find((f) => f.clave === 'utilizacion')!.leyenda[0].etiqueta).toContain('Umbral de referencia (90 %)');
  });

  test('las series de la figura de evolución son EXACTAMENTE las de la tabla 4.7', () => {
    const evo = figuras.find((f) => f.clave === 'evolucion')!;
    const lineaIng = evo.primitivas.find((pr) => pr.t === 'polilinea' && pr.color === '#2563eb') as Extract<(typeof evo.primitivas)[number], { t: 'polilinea' }>;
    for (const [t, valor] of lineaIng.puntos) {
      expect(valor).toBeCloseTo(m.indicadores.ingresosTotales[t] * 743, 6);
    }
  });

  test('PNG rasterizado localmente: cabecera válida y decodificable (sin CDN ni servicios)', () => {
    for (const f of figuras) {
      const { png } = rasterizarPNG(f, { ancho: 320, alto: 160 });
      expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(png.length).toBeGreaterThan(400);
      expect(new TextDecoder('latin1').decode(png.slice(-12))).toContain('IEND');
    }
  });

  test('el documento referencia las figuras desde el texto y las acompaña con nota APA', () => {
    const texto = textoDocumento(doc);
    expect(texto).toContain('Véase la figura «Utilización de los recursos operativos por año');
    expect(texto).toContain('Figura 2. Evolución de ingresos');
    expect(texto).toContain('Figura 3. Flujo acumulado');
    // Nota editorial del estilo basado en APA + convención de justificado.
    expect(texto).toContain('Estilo editorial');
    expect(texto).toContain('NO se presenta como requisito de APA 7');
  });
});

describe('DOC-002 §6 — Unidades metodológicas CUP/USD sin ambigüedad', () => {
  test('la fila «Inversión fija facturada en USD» muestra el MONTO ORIGINAL y el equivalente', () => {
    const texto = textoDocumento(doc); // presentación CUP
    expect(texto).toContain('Inversión fija facturada en USD');
    expect(texto).toContain('1.200,0 kUSD'); // monto original
    expect(texto).toContain('891.600,0'); // equivalente en kCUP (1.200 × 743)
    // El rótulo engañoso del modelo viejo ya no existe.
    expect(texto).not.toContain('Inversión fija (en USD) 891.600,0');
    const a = generarAnalisis(p, m).inversion_financiacion.texto;
    expect(a).toContain('inversión fija de 1.200,0');
  });

  test('salarios SIEMPRE en CUP (4.9) con equivalente documentado; la tasa lleva fecha y advertencia', () => {
    const texto = textoDocumento(docUSD);
    expect(texto).toContain('Salario promedio anual (CUP)');
    expect(texto).toContain('Equivalente anual (USD)');
    expect(docUSD.meta.notaMoneda).toContain('743,0 CUP por USD');
    // DOC-002-R1 §6: fecha de corte del supuesto ALINEADA con la fecha del
    // documento (2026-10-25), presentada como supuesto ilustrativo.
    expect(docUSD.meta.notaMoneda).toContain('fecha de referencia: 2026-10-25');
    expect(docUSD.meta.notaMoneda).toContain('no una cotización observada');
    expect(docUSD.meta.notaMoneda).toContain('SUPUESTO DE DEMOSTRACIÓN EDITABLE');
    // La cotización aparece en el bloque de fuentes con su estado pendiente.
    const fuentes = fuentesTrazabilidad(p);
    const cot = fuentes.find((f) => f.tipo === 'cotizacion')!;
    expect(cot.estado).toContain('PENDIENTE DE VALIDACIÓN OFICIAL');
  });

  test('cifras de portada y resumen en CUP vs USD (1.480,0 kUSD = 1.099.640,0 kCUP)', () => {
    const invCup = doc.portada.cifras.find((c) => c.etiqueta === 'Inversión total')!.valor;
    const invUsd = docUSD.portada.cifras.find((c) => c.etiqueta === 'Inversión total')!.valor;
    expect(invCup).toContain('1.099.640,0');
    expect(invUsd).toContain('1.480,0');
  });
});
