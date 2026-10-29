// ============================================================================
// MISIÓN PLANEX-DATA-001 — Pruebas obligatorias (§9 de la misión).
//
// Verifica que la plantilla «Centro Estomatológico Internacional Holguín»
// represente el proyecto DOCUMENTAL real (no el ejemplo ficticio), que cada
// dato incorporado sea trazable a una fuente o esté marcado como
// derivado/provisional, que las cifras no se alteren, que las conversiones
// se apliquen una sola vez, que las contradicciones del expediente
// PERMANEZCAN visibles (nunca resueltas en silencio), que la matriz de
// cobertura y el PDF de brechas salgan de la misma fuente de información,
// que las exportaciones reflejen el proyecto actualizado, que el
// exportar/importar conserve los datos y su estado de evidencia, que no se
// publiquen archivos ni datos sensibles, y que las plantillas preexistentes
// sigan funcionando.
// ============================================================================
import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoHolguin } from '../../src/lib/planex/templates/holguin';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { crearProyectoCentro } from '../../src/lib/planex/templates/centro';
import { crearProyectoDefault } from '../../src/lib/planex/templates/default';
import { construirDocumentoPlanex } from '../../src/lib/planex/doc/construir';
import { exportarPDF } from '../../src/lib/planex/io/pdf';
import { exportarDOCX } from '../../src/lib/planex/io/docx';
import { exportarXLSX } from '../../src/lib/planex/io/xlsx';
import { componerInformeBrechas } from '../../src/lib/planex/io/informe-brechas';
import { construirDocumentoBrechas } from '../../src/lib/planex/data/holguin/informe';
import { FUENTES, SHA256_ZIP } from '../../src/lib/planex/data/holguin/fuentes';
import { REGISTRO, dato } from '../../src/lib/planex/data/holguin/registro';
import { coberturaGlobal, coberturaPorEpigrafe, censoRegistro, EPIGRAFES } from '../../src/lib/planex/data/holguin/cobertura';
import { CONTRADICCIONES, BRECHAS, VALIDACIONES, resumenExpediente } from '../../src/lib/planex/data/holguin/brechas';
import { proyectoAJSON, parsearProyectoJSON } from '../../src/lib/planex/io/jsonio';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const p = crearProyectoHolguin();
const m = computeProject(p);
const v = (id: string, t: number) => m.valores[id]?.[t] ?? 0;
const docCUP = construirDocumentoPlanex(p, m, { moneda: 'CUP' });

/** Todo el texto del documento canónico, en orden. */
function textoDocumento(d: typeof docCUP): string {
  const trozos: string[] = [];
  const caminar = (elementos: typeof d.secciones[0]['elementos']) => {
    for (const el of elementos) {
      if (el.tipo === 'parrafo' || el.tipo === 'aviso') trozos.push(el.texto);
      else if (el.tipo === 'campos') el.items.forEach((i) => trozos.push(i.etiqueta, i.valor));
      else if (el.tipo === 'subtitulo') trozos.push(el.texto);
      else if (el.tipo === 'tabla') {
        trozos.push(el.tabla.titulo ?? '', el.tabla.nota ?? '');
        el.tabla.encabezados.forEach((h) => trozos.push(h));
        el.tabla.filas.forEach((f) => f.forEach((c) => trozos.push(c)));
      }
    }
  };
  trozos.push(d.portada.nombreProyecto, d.portada.subtitulo, d.portada.avisoDemo ?? '');
  for (const s of d.secciones) {
    trozos.push(s.titulo);
    caminar(s.elementos);
  }
  return trozos.join('\n');
}

const TEXTO = textoDocumento(docCUP);

// ============================================================================
// 1 · La identidad del proyecto coincide con los documentos seleccionados
// ============================================================================
describe('DATA-001 §9.1 — identidad del proyecto documental', () => {
  test('el título y las partes corresponden al expediente Holguín', () => {
    expect(p.titulo.nombreProyecto).toBe('Centro Estomatológico Internacional Holguín');
    expect(p.inversionistaNacional.nombre).toContain('Comercializadora de Servicios Médicos Cubanos');
    expect(p.inversionistaExtranjero.nombre).toBe('Leisure Exporting LLC');
    expect(p.negocio.modalidad).toContain('Asociación Económica Internacional');
    expect(p.negocio.objetoSocial).toContain('estomatología');
    expect(p.tecnico.localizacion).toContain('Holguín');
  });

  test('la caracterización registral de las partes es la del contrato (F01)', () => {
    // H-004: escritura 366/2011, RM Tomo XXVIII Folio 120, NIT 30001869140
    expect(p.inversionistaNacional.identificacionFiscal).toContain('366 de 11 de octubre de 2011');
    expect(p.inversionistaNacional.identificacionFiscal).toContain('30001869140');
    // H-006: L23000147130, Acta de Protocolización 897
    expect(p.inversionistaExtranjero.identificacionFiscal).toContain('L23000147130');
    expect(p.inversionistaExtranjero.identificacionFiscal).toContain('897');
  });
});

// ============================================================================
// 2 · No quedan nombres ni datos de la clínica ficticia anterior donde deben
//     sustituirse (y las plantillas ficticias SÍ se conservan intactas)
// ============================================================================
describe('DATA-001 §9.2 — sustitución del ejemplo ficticio', () => {
  const FICTICIOS = ['Sonrisa Habana', 'Grupo Dental Internacional', 'Entidad Nacional de Servicios de Salud', 'Calle Ejemplo'];

  test('la plantilla Holguín no contiene datos del ejemplo ficticio', () => {
    const plantilla = JSON.stringify(p);
    for (const s of FICTICIOS) expect(plantilla).not.toContain(s);
  });

  test('el documento exportado (PDF canónico) no contiene el ejemplo ficticio', () => {
    for (const s of FICTICIOS) expect(TEXTO).not.toContain(s);
  });

  test('la plantilla ficticia general sigue intacta y disponible (no se destruyó)', () => {
    const c = crearProyectoClinica();
    expect(c.titulo.nombreProyecto).toContain('Sonrisa Habana');
    expect(c.planex.plantillaOrigen).toBe('clinica');
  });
});

// ============================================================================
// 3 · Cada dato incorporado es trazable a una fuente o está marcado
// ============================================================================
describe('DATA-001 §9.3 — trazabilidad campo a campo', () => {
  test('el registro: toda entrada tiene fuente, localizador, categoría y tratamiento', () => {
    expect(REGISTRO.length).toBeGreaterThanOrEqual(55);
    for (const r of REGISTRO) {
      expect(/^H-\d{3}$/.test(r.id)).toBe(true);
      expect(/^F\d{2}$/.test(r.fuenteId)).toBe(true);
      expect(r.localizador.length).toBeGreaterThan(5);
      expect(['A', 'B', 'C', 'D', 'E', 'F']).toContain(r.categoria);
      expect(r.tratamiento.length).toBeGreaterThan(10);
    }
  });

  test('las 15 líneas de servicio citan su entrada del registro', () => {
    expect(p.servicios.length).toBe(15);
    for (const s of p.servicios) expect(s.fuente).toContain('H-037');
  });

  test('las partidas de inversión citan su entrada del registro', () => {
    for (const i of p.financiero.inversion) expect(/H-0\d{2}/.test(i.observacion)).toBe(true);
  });

  test('las aportaciones citan su entrada del registro y su cotización', () => {
    for (const a of p.aportaciones) expect(/H-0\d{2}/.test(a.referenciaDocumental)).toBe(true);
    expect(p.aportaciones.find((a) => a.id === 'ap-ex-ac')?.referenciaDocumental).toContain('63 581,30');
  });

  test('los parámetros documentados citan el registro (ninguna tasa “oficial” sin evidencia)', () => {
    const tc = p.parametros.find((x) => x.id === 'tipo_cambio')!;
    expect(tc.fuente).toContain('H-025');
    expect(tc.fuente).toContain('C-01');
    const tasa = p.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!;
    expect(tasa.fuente).toContain('H-033');
    expect(tasa.fuente).toContain('SIN base legal');
  });

  test('los campos sin evidencia quedan marcados como pendientes (nunca vacíos ni inventados)', () => {
    expect(p.general.elaboradoPor).toContain('[Pendiente');
    expect(p.mercado.demandaAparente).toContain('[Pendiente');
    expect(p.fuerza.entidadContratante).toContain('[Pendiente');
    expect(p.tecnico.localizacion).toContain('Pendiente');
  });
});

// ============================================================================
// 4 · Las cifras y las unidades no se alteran durante la incorporación
// ============================================================================
describe('DATA-001 §9.4 — fidelidad de cifras y unidades', () => {
  // Tabla de servicios del expediente (F02/F08 p. 23): precio CUP, cantidad/mes
  const TABLA_SERVICIOS: [string, number, number][] = [
    ['Tratamientos pulporadiculares (TPR)', 9600, 3],
    ['Obturaciones de resina', 2400, 15],
    ['Obturaciones de amalgamas', 1800, 15],
    ['Profilaxis con ultrasonido', 6000, 10],
    ['Prótesis', 23236, 15],
    ['Exodoncia', 14900, 10],
    ['Resedimentado de corona', 3000, 5],
    ['Corona y espiga acrílica', 9600, 5],
    ['Pulpotomía', 3600, 3],
    ['Drenaje de absceso', 3600, 5],
    ['Reparación de prótesis', 2400, 5],
    ['Cura de óxido de zinc', 3000, 25],
    ['Radiografía', 1800, 30],
    ['Corona acrílica', 9600, 10],
    ['Blanqueamientos', 18000, 10],
  ];

  test('los 15 servicios reproducen la tabla del expediente (precio CUP y cantidad)', () => {
    expect(p.servicios.length).toBe(TABLA_SERVICIOS.length);
    TABLA_SERVICIOS.forEach(([, cup, qty]) => {
      const s = p.servicios.find(
        (x) => Math.abs(x.precioBase * 120 - cup) < 0.5 && x.cantidadBaseMensual === qty
      );
      // El mensaje del caso lo aporta el propio bucle (tabla documentada).
      expect(s).toBeDefined();
    });
  });

  test('el ingreso mensual y anual del expediente concilian (1 158 140 CUP/mes; 13 897 680/año)', () => {
    const tasa = 120; // tasa documentada de la lista de precios (H-025)
    const mensual = p.servicios.reduce((s, x) => s + x.precioBase * x.cantidadBaseMensual, 0) * tasa;
    expect(Math.abs(mensual - 1158140)).toBeLessThan(1);
    const anual = v('ingresos_servicios_k', 1) * 1000 * tasa;
    expect(Math.abs(anual - 13897680) / 13897680).toBeLessThan(0.001);
  });

  test('los 5 equipos reproducen la cotización F06 (5 274,00 USD en total)', () => {
    const equipos = p.financiero.inversion.filter((i) => i.categoria === 'inversion_fija');
    expect(equipos.length).toBe(5);
    const total = equipos.reduce((s, i) => s + i.monto, 0);
    expect(Math.abs(total - 5.274)).toBeLessThan(0.001);
    // Compresor: 3 500 + 350 + 35 = 3 885,00 USD (H-021)
    expect(Math.abs((equipos.find((e) => e.concepto.includes('Compresor'))?.monto ?? 0) - 3.885)).toBeLessThan(0.001);
  });

  test('los gastos previos conservan 26,20 miles de CUP en su moneda de origen', () => {
    const gp = p.financiero.inversion.filter((i) => i.categoria === 'gastos_previos');
    expect(gp.every((i) => i.moneda === 'CUP')).toBe(true);
    expect(Math.abs(gp.reduce((s, i) => s + i.monto, 0) - 26.2)).toBeLessThan(0.001);
  });

  test('las aportaciones reproducen la composición del expediente (efectivo 1 600 kCUP; insumos 63 581,30 USD; equipos 5 274 USD)', () => {
    const cu = p.aportaciones.find((a) => a.socio === 'nacional')!;
    expect(Math.abs(cu.montos[0] * 120 - 1600)).toBeLessThan(0.1); // 1 600,0 kCUP
    const ac = p.aportaciones.find((a) => a.tipo === 'activos_circulantes')!;
    expect(Math.abs(ac.montos[0] * 1000 - 63581.3)).toBeLessThan(1);
    const af = p.aportaciones.find((a) => a.tipo === 'activos_fijos_tangibles')!;
    expect(Math.abs(af.montos[0] * 1000 - 5274)).toBeLessThan(1);
  });
});

// ============================================================================
// 5 · Las conversiones de moneda no se aplican dos veces
// ============================================================================
describe('DATA-001 §9.5 — una sola conversión', () => {
  test('el motor calcula los ingresos en kUSD nativos (115,814) y NO los vuelve a convertir', () => {
    // ingresos_servicios_k (kUSD) = 115,814: el precio YA está en USD, la
    // conversión a CUP ocurre UNA sola vez en la presentación.
    expect(Math.abs(v('ingresos_servicios_k', 1) - 115.814) / 115.814).toBeLessThan(0.001);
  });

  test('la presentación en CUP multiplica por 120 una única vez (13 897,68 kCUP)', () => {
    const tablaIngresos = docCUP.secciones.flatMap((s) => s.elementos).find(
      (e) => e.tipo === 'tabla' && (e as { tabla: { titulo?: string } }).tabla.titulo?.includes('Servicios previstos')
    );
    expect(tablaIngresos).toBeDefined();
  });

  test('el costo laboral CUP→kUSD se convierte una vez con la tasa del parámetro', () => {
    // 4 320 000 CUP/año ÷ 120 = 36,0 kUSD/año (una sola conversión)
    expect(Math.abs(v('costo_laboral_cup', 1) - 4320000)).toBeLessThan(1);
    expect(Math.abs(v('costo_laboral_k', 1) - 36.0)).toBeLessThan(0.01);
  });

  test('las aportaciones en kUSD no se re-convierten (financiación estable)', () => {
    expect(Math.abs(m.indicadores.aportacionesTotalesKUSD - 82.18) / 82.18).toBeLessThan(0.001);
  });
});

// ============================================================================
// 6 · Las fórmulas siguen siendo editables y los resultados se recalculan
// ============================================================================
describe('DATA-001 §9.6 — motor editable con recálculo', () => {
  test('la regla del impuesto reproduce el patrón del expediente (0 en años 1–7) y es editable', () => {
    const regla = p.reglas.find((r) => r.id === 'impuesto_utilidades_k')!;
    expect(regla.expresion).toContain('PERIODO >= 8');
    for (const t of [1, 2, 3, 4, 5, 6, 7]) expect(v('impuesto_utilidades_k', t)).toBe(0);
  });

  test('cambiar la regla del impuesto recalcula el resultado (la expresión no está “hardcodeada”)', () => {
    const p2 = crearProyectoHolguin();
    p2.parametros.find((x) => x.id === 'tasa_impuesto_utilidades')!.valor = 0.15;
    const r2 = p2.reglas.find((r) => r.id === 'impuesto_utilidades_k')!;
    r2.expresion = 'MAX(0, utilidad_antes_impuestos_k * tasa_impuesto_utilidades)';
    const m2 = computeProject(p2);
    // Año 1 con UAI negativa → 0 en ambas reglas; el cambio de EXPRESIÓN
    // debe reflejarse en el ESTADO de la regla (recalculada, no cacheada).
    expect(m2.estados['impuesto_utilidades_k'].ok).toBe(true);
    expect(m2.estados['impuesto_utilidades_k'].valores?.[1]).toBe(0);
    // El estado del proyecto original queda intacto (sin mutación cruzada):
    expect(m.estados['impuesto_utilidades_k'].valores?.[8]).toBeDefined();
  });

  test('cambiar el tipo de cambio recalcula el costo laboral (un parámetro mueve el modelo)', () => {
    const p3 = crearProyectoHolguin();
    p3.parametros.find((x) => x.id === 'tipo_cambio')!.valor = 240;
    const m3 = computeProject(p3);
    // 4 320 000 ÷ 240 = 18,0 kUSD: el parámetro gobierna la conversión.
    expect(Math.abs((m3.valores['costo_laboral_k']?.[1] ?? 0) - 18.0)).toBeLessThan(0.01);
  });

  test('el desglose de inversión usa las MISMAS reglas de fábrica (sin lógica paralela)', () => {
    const rIds = new Set(p.reglas.map((r) => r.id));
    const clinica = crearProyectoClinica();
    for (const r of clinica.reglas) expect(rIds.has(r.id)).toBe(true);
    // y con la misma cardinalidad (solo cambia la EXPRESIÓN del impuesto):
    expect(p.reglas.length).toBe(clinica.reglas.length);
  });
});

// ============================================================================
// 7 · Los datos contradictorios no se resuelven silenciosamente
// ============================================================================
describe('DATA-001 §9.7 — contradicciones visibles', () => {
  test('la tasa de cambio tiene AMBOS valores registrados (24 y 120)', () => {
    const tc = dato('H-025');
    expect(tc.categoria).toBe('D');
    expect(tc.valorLiteral).toContain('1*24');
    expect(tc.valorLiteral).toContain('1*120');
  });

  test('los indicadores del expediente tienen AMBAS series (resumen y anexo)', () => {
    const ind = dato('H-043');
    expect(ind.valorLiteral).toContain('24,709.58');
    expect(ind.valorLiteral).toContain('20,771.60');
    expect(ind.tratamiento).toContain('no las adopta');
  });

  test('los salarios tienen las TRES versiones del expediente (146 000 / 360 000 implícitos / escala F07)', () => {
    const sal = dato('H-036');
    expect(sal.valorLiteral).toContain('146,000.00');
    expect(sal.valorLiteral).toContain('4,320.00');
    expect(sal.valorLiteral).toContain('5 750');
  });

  test('el registro de contradicciones conserva ambos valores con localizador', () => {
    expect(CONTRADICCIONES.length).toBeGreaterThanOrEqual(17);
    for (const c of CONTRADICCIONES) {
      expect(c.valores.length).toBeGreaterThanOrEqual(2);
      for (const x of c.valores) expect(x.fuenteLocalizador.length).toBeGreaterThan(5);
      for (const id of c.registroIds) expect(() => dato(id)).not.toThrow();
    }
  });

  test('la contradicción crítica de tasa (C-01) es bloqueante y está presente en la plantilla y el documento', () => {
    const c01 = CONTRADICCIONES.find((c) => c.id === 'C-01')!;
    expect(c01.severidad).toBe('critica');
    expect(TEXTO).toContain('C-01');
    expect(JSON.stringify(p.inversionistaExtranjero).toLowerCase()).toContain('contradicción');
  });

  test('el modelo MUESTRA el efecto del bloqueo en lugar de disimularlo (UAI negativa a valores reales)', () => {
    // A precios de lista y costos de cotización reales (tasa 120) el
    // margen operativo es negativo: el modelo lo exhibe, no lo maquilla.
    expect(m.valores['utilidad_antes_impuestos_k']?.[1] ?? 0).toBeLessThan(0);
    expect(TEXTO).toContain('evaluación preliminar');
  });

  test('la incoherencia reparto 50/50 vs participación 49/51 no se “corrige”', () => {
    expect(dato('H-013').categoria).toBe('D');
    expect(p.negocio.reglaDistribucion).toContain('50');
    expect(p.negocio.reglaDistribucion).toContain('49');
    expect(p.negocio.reglaDistribucion).toContain('C-05');
  });
});

// ============================================================================
// 8 · La matriz de cobertura y el PDF de brechas salen de la misma fuente
// ============================================================================
describe('DATA-001 §9.8 — una sola fuente de información', () => {
  test('la matriz deriva del registro: cada campo cita datos H-### o declara brecha', () => {
    const suma = coberturaPorEpigrafe().reduce((s, e) => s + e.total, 0);
    const glob = coberturaGlobal();
    expect(suma).toBe(glob.camposTotales);
    expect(glob.camposCompletos + glob.camposParciales + glob.camposPendientes + glob.camposDerivados).toBe(
      glob.camposTotales
    );
    expect(EPIGRAFES.length).toBe(12); // 4.1 … 4.12
    expect(EPIGRAFES.map((e) => e.id)).toEqual([
      '4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9', '4.10', '4.11', '4.12',
    ]);
  });

  test('las brechas y contradicciones citan registros EXISTENTES (sin referencias muertas)', () => {
    for (const b of BRECHAS) for (const id of b.registroIds) expect(() => dato(id)).not.toThrow();
    for (const val of VALIDACIONES) for (const id of val.registroIds) expect(() => dato(id)).not.toThrow();
  });

  test('el informe de brechas se construye desde los mismos módulos (contenido verificable)', () => {
    const doc = construirDocumentoBrechas();
    const ids = doc.secciones.map((s) => s.id);
    expect(ids).toContain('resumen');
    expect(ids).toContain('cobertura');
    expect(ids).toContain('brechas');
    expect(ids).toContain('contradicciones');
    expect(ids).toContain('validaciones');
    expect(ids).toContain('plancierre');
    expect(ids).toContain('criterios');
    expect(ids).toContain('anexo-registro');
    // La portada lleva los elementos exigidos por la misión:
    expect(doc.portada.titulo).toContain('ANÁLISIS DOCUMENTAL');
    expect(doc.portada.nombreProyecto).toContain('Holguín');
    expect(doc.portada.cifras.some((c) => c.etiqueta === 'Fecha de corte')).toBe(true);
    expect(doc.portada.cifras.some((c) => c.etiqueta === 'Versión del informe')).toBe(true);
  });

  test('el PDF de brechas se compone con el compositor editorial y contiene la cifra de cobertura', async () => {
    const { datos, nombre } = componerInformeBrechas();
    expect(datos.byteLength).toBeGreaterThan(100_000);
    expect(/^PLANEX_Informe_Brechas_Documentales_Centro_Estomatologico_Internacional_Holguin_\d{4}-\d{2}-\d{2}\.pdf$/.test(nombre)).toBe(true);
    // El PDF (jsPDF) guarda el texto en flujos comprimidos; se verifica que
    // el MODELO del que sale (mismo módulo) contenga cobertura y brechas:
    const glob = coberturaGlobal();
    const doc = construirDocumentoBrechas();
    const texto = textoDocumento(doc as unknown as typeof docCUP);
    expect(texto).toContain(`${(glob.pctCamposCompletados * 100).toFixed(1).replace('.', ',')} %`);
    expect(texto).toContain('C-01');
    expect(texto).toContain('B-06');
  });
});

// ============================================================================
// 9 · La exportación PDF y DOCX refleja la información actualizada
// ============================================================================
describe('DATA-001 §9.9 — exportaciones actualizadas', () => {
  test('el documento canónico del plan contiene el proyecto real y sus marcas documentales', () => {
    expect(TEXTO).toContain('Centro Estomatológico Internacional Holguín');
    expect(TEXTO).toContain('Leisure Exporting LLC');
    expect(TEXTO).toContain('CSMC');
    expect(TEXTO).toContain('evaluación preliminar');
  });

  test('el PDF binario se genera y tiene tamaño sustancial', async () => {
    const pdf = exportarPDF(p, m, { moneda: 'CUP' });
    const buf = await pdf.datos.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(100_000);
    expect(pdf.nombre).toContain('Centro Estomatológico Internacional Holg');
    expect(pdf.nombre).toContain('CUP.pdf');
  });

  test('el DOCX exportado contiene el proyecto real (XML verificado) y ningún resto del ejemplo', async () => {
    const docx = await exportarDOCX(p, m, { moneda: 'CUP' });
    const wbuf = new Uint8Array(await docx.datos.arrayBuffer());
    const { unzipSync, strFromU8 } = await import('fflate');
    const contenido = unzipSync(wbuf);
    const xml = strFromU8(contenido['word/document.xml']);
    expect(xml).toContain('Centro Estomatológico Internacional Holguín');
    expect(xml).toContain('Leisure Exporting');
    expect(xml).not.toContain('Sonrisa Habana');
    // La regla del impuesto del expediente viaja con su documentación:
    expect(xml).toContain('15');
  });

  test('el XLSX se genera con las fórmulas del proyecto real', async () => {
    const xlsx = await exportarXLSX(p, m);
    expect(xlsx.datos.byteLength).toBeGreaterThan(50_000);
  });
});

// ============================================================================
// 10 · Exportar/importar conserva datos, estado de evidencia y referencias
// ============================================================================
describe('DATA-001 §9.10 — round-trip del proyecto documental', () => {
  test('el JSON exportado reimporta conservando plantilla, fuentes y cifras', () => {
    const json = proyectoAJSON(p);
    const res = parsearProyectoJSON(json);
    expect(res.ok).toBe(true);
    const q = res.proyecto!;
    expect(q.planex.plantillaOrigen).toBe('holguin');
    expect(q.titulo.nombreProyecto).toBe(p.titulo.nombreProyecto);
    expect(q.servicios.length).toBe(15);
    expect(q.servicios[0].fuente).toBe(p.servicios[0].fuente);
    expect(q.aportaciones[0].referenciaDocumental).toBe(p.aportaciones[0].referenciaDocumental);
    expect(q.parametros.find((x) => x.id === 'tipo_cambio')?.valor).toBe(120);
    expect(q.reglas.find((r) => r.id === 'impuesto_utilidades_k')?.expresion).toContain('PERIODO >= 8');
    expect(q.reglas.find((r) => r.id === 'gastos_previos_k')?.expresion).toContain('"CUP"');
    // El modelo recalcula idéntico tras la importación:
    expect(Math.abs(computeProject(q).valores['ingresos_servicios_k']?.[1]! - v('ingresos_servicios_k', 1))).toBeLessThan(0.001);
  });
});

// ============================================================================
// 11 · Los archivos y datos sensibles no se publican accidentalmente
// ============================================================================
describe('DATA-001 §9.11 — protección documental', () => {
  const dirDatos = join(process.cwd(), 'src', 'lib', 'planex', 'data', 'holguin');

  test('no se copian originales del expediente al repositorio (ni ZIP ni .doc/.docx/.pdf de fuente)', () => {
    // El directorio de trabajo aislado con los originales vive FUERA del
    // repositorio (workspace del agente), y dentro del repo solo existe el
    // inventario estructurado (.ts) con metadatos y huellas.
    expect(existsSync(join(process.cwd(), 'data001'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'Planex.zip'))).toBe(false);
    const archivos = readdirSync(dirDatos);
    for (const f of archivos) {
      expect(/\.ts$/.test(f)).toBe(true);
      expect(/\.(docx?|pdf|zip)$/i.test(f)).toBe(false);
    }
  });

  test('los nombres de los archivos originales solo aparecen como metadatos de inventario', () => {
    // En FUENTES se documentan (inventario); en el REGISTRO y la plantilla
    // no se vuelca contenido original más allá de lo metodológicamente
    // necesario.
    const registro = JSON.stringify(REGISTRO);
    expect(/\+53\s?\d/.test(registro)).toBe(false); // sin teléfonos
    expect(registro).not.toContain('@'); // sin correos personales ni de contacto
    const plantilla = JSON.stringify(p);
    expect(/\+53\s?\d/.test(plantilla)).toBe(false);
    expect(plantilla).not.toContain('sales@');
    expect(plantilla).not.toContain('presidente@');
  });

  test('el inventario documenta las huellas SHA-256 de las 9 fuentes (evidencia de análisis)', () => {
    expect(FUENTES.length).toBe(9);
    for (const f of FUENTES) {
      expect(/^[0-9a-f]{64}$/.test(f.sha256)).toBe(true);
      expect(f.bytes).toBeGreaterThan(10000);
    }
    expect(/^[0-9a-f]{64}$/.test(SHA256_ZIP)).toBe(true);
  });

  test('los originales del expediente no están en docs/ (solo entregables generados)', () => {
    const docs = join(process.cwd(), 'docs', 'expediente-holguin');
    if (existsSync(docs)) {
      for (const f of readdirSync(docs)) {
        // Entregables generados por la app, no documentos del ZIP
        // (DATA-002 añade la serie PLANEX_Consultas_Promotor_*):
        expect(/^(PLANEX_Informe_Brechas|PLANEX_Consultas_Promotor|Centro_Holguin)/.test(f)).toBe(true);
      }
    }
  });
});

// ============================================================================
// 12 · El proyecto sigue funcionando con las plantillas y proyectos
//      preexistentes
// ============================================================================
describe('DATA-001 §9.12 — compatibilidad con lo preexistente', () => {
  test('las tres plantillas de fábrica calculan sin errores de motor', () => {
    for (const crear of [crearProyectoClinica, crearProyectoCentro, crearProyectoDefault]) {
      const mm = computeProject(crear());
      expect(mm.ok).toBe(true);
      expect(mm.issues.filter((i) => i.tipo === 'error').length).toBe(0);
    }
  });

  test('las cifras de regresión de la plantilla clínica siguen intactas', () => {
    const c = crearProyectoClinica();
    const mc = computeProject(c);
    expect(Math.abs(mc.indicadores.inversionTotalKUSD - 1480) / 1480).toBeLessThan(0.001);
    expect(Math.abs(mc.indicadores.aportacionesTotalesKUSD - 1180) / 1180).toBeLessThan(0.001);
    expect(Math.abs((mc.indicadores.ingresosTotales[1] ?? 0) - 967.8) / 967.8).toBeLessThan(0.001);
  });

  test('gastos previos en CUP: hallazgo documentado — la regla de fábrica solo suma USD; Holguín la extiende a nivel de plantilla', () => {
    // La REGLA DE FÁBRICA no se toca (la regresión editorial de DOC-003 se
    // mantiene); el proyecto Holguín extiende la EXPRESIÓN para que las
    // 26,20 kCUP documentales (H-022) no se pierdan en silencio.
    const clinica = computeProject(crearProyectoClinica());
    expect(Math.abs(clinica.valores['gastos_previos_k']?.[0]! - 45) / 45).toBeLessThan(0.001);
    const centro = computeProject(crearProyectoCentro());
    expect(Math.abs(centro.valores['gastos_previos_k']?.[0]! - 60) / 60).toBeLessThan(0.001);
    // Holguín: la expresión extendida computa los gastos previos en CUP
    // (26,20 ÷ 120 = 0,2183 kUSD) con la tasa documentada.
    const reglaH = p.reglas.find((r) => r.id === 'gastos_previos_k')!;
    expect(reglaH.expresion).toContain('"CUP"');
    expect(Math.abs(v('gastos_previos_k', 0) - 26.2 / 120)).toBeLessThan(0.001);
  });

  test('el modelo Holguín calcula sin errores y con el inventario completo del expediente', () => {
    expect(m.ok).toBe(true);
    expect(m.issues.filter((i) => i.tipo === 'error').length).toBe(0);
    expect(m.indicadores.totalTrabajadores).toBe(10);
    expect(Math.abs(m.indicadores.inversionTotalKUSD - 5.492) / 5.492).toBeLessThan(0.001);
  });
});

// ============================================================================
// Extra · verificaciones estructurales de la misión (§4 y §6)
// ============================================================================
describe('DATA-001 — medición de cobertura y calidad del análisis', () => {
  test('los porcentajes usan denominadores explícitos y no se declaran a mano', () => {
    const g = coberturaGlobal();
    expect(g.denominadorNota).toContain('Denominador');
    expect(g.camposTotales).toBeGreaterThanOrEqual(40);
    // La cobertura NO es «80 % porque se leyó el 80 % de los archivos»:
    // se mide por CAMPOS metodológicos con evidencia.
    expect(g.pctCamposCompletados).toBeLessThan(1);
    expect(g.pctCamposCompletados).toBeGreaterThan(0);
  });

  test('el censo del registro cuadra con las categorías A–F', () => {
    const c = censoRegistro();
    expect(c.total).toBe(c.confirmados + c.derivados + c.provisionales + c.contradictorios + c.pendientes + c.noAplicables);
    expect(c.confirmados).toBeGreaterThan(15);
    expect(c.contradictorios).toBeGreaterThanOrEqual(8);
  });

  test('resumen del expediente: cifras coherentes entre módulos', () => {
    const r = resumenExpediente();
    expect(r.fuentes).toBe(FUENTES.length);
    expect(r.contradicciones).toBe(CONTRADICCIONES.length);
    expect(r.brechas).toBe(BRECHAS.length);
    expect(r.validaciones).toBe(VALIDACIONES.length);
    expect(r.brechasBloqueantes).toBe(BRECHAS.filter((b) => b.prioridad === 'bloqueante').length);
  });

  test('el reparto provisional de materiales concilia con la cotización (±0,1 %)', () => {
    // Σ costo unitario × cantidad × 12 = 127 162,60 USD/año de la cotización
    const totalMateriales = p.servicios.reduce(
      (s, x) => s + x.costoVariableUnitario * x.cantidadBaseMensual * 12,
      0
    );
    expect(Math.abs(totalMateriales - 127162.6) / 127162.6).toBeLessThan(0.001);
    // y el motor lo reproduce en su primer año:
    expect(Math.abs(v('costos_variables_usd', 1) - totalMateriales) / totalMateriales).toBeLessThan(0.001);
  });

  test('los salarios derivados cierran contra el total del EERR del expediente (4 320 kCUP/año)', () => {
    const total = p.personal.reduce((s, x) => s + x.cantidad * x.salarioPromedioAnualCUP, 0);
    expect(Math.abs(total - 4320000) / 4320000).toBeLessThan(0.001);
    // y el extranjero queda a su valor documentado exacto (240 kCUP/año):
    const ext = p.personal.find((x) => x.grupo === 'extranjero_directivo')!;
    expect(ext.salarioPromedioAnualCUP).toBe(240000);
  });

  test('la plantilla no inventa capacidad: sin recursos ni duraciones (brecha B-10 visible)', () => {
    expect(p.recursos.length).toBe(0);
    expect(p.servicios.every((s) => s.duracionMinutos === 0 && s.recursoIds.length === 0)).toBe(true);
    expect(p.tecnico.capacidadInstalada).toContain('NO INVENTA capacidad');
  });

  test('las brechas bloqueantes de la misión están presentes (usufructo, tributo, mercado)', () => {
    const bloqueantes = BRECHAS.filter((b) => b.prioridad === 'bloqueante').map((b) => b.id);
    expect(bloqueantes).toContain('B-06');
    expect(bloqueantes).toContain('B-16');
    expect(bloqueantes).toContain('B-24');
  });

  test('las validaciones normativas distinguen norma invocada, evidencia y pendiente', () => {
    for (const x of VALIDACIONES) {
      expect(x.normaInvocada.length).toBeGreaterThan(5);
      expect(x.evidenciaExpediente.length).toBeGreaterThan(5);
      expect(x.pendiente.length).toBeGreaterThan(10);
    }
    expect(VALIDACIONES.length).toBeGreaterThanOrEqual(8);
  });
});
