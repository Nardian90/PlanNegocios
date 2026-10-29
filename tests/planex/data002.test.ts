// ============================================================================
// MISIÓN PLANEX-DATA-002 — Pruebas del «Documento de consultas al promotor».
//
// Verifica que el documento de supuestos, dudas y pendientes: (1) sale de
// módulos de datos con integridad referencial contra el registro de la
// misión anterior (C-##, B-##, V-##, H-###), (2) RESPONDE la pregunta
// normativa central del propietario (¿por qué 15 % y no 35 %?) con las
// citas exactas halladas, (3) no deriva del modelo (tasa e impuesto del
// documento = parámetros de la plantilla), (4) se compone en PDF con el
// compositor editorial sin violaciones de densidad y en DOCX desde el
// MISMO modelo, (5) no incorpora datos personales del expediente, y
// (6) conserva el comportamiento exacto de los documentos preexistentes.
// ============================================================================
import { describe, test, expect } from 'bun:test';
import { construirDocumentoPlanex } from '../../src/lib/planex/doc/construir';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoHolguin } from '../../src/lib/planex/templates/holguin';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import {
  SUPUESTOS,
  NORMATIVA,
  FECHA_CONSULTA_NORMATIVA,
} from '../../src/lib/planex/data/holguin/consultas';
import { CONSULTAS, resumenConsultas } from '../../src/lib/planex/data/holguin/consultas-preguntas';
import {
  construirDocumentoConsultas,
  resumenDocumentoConsultas,
} from '../../src/lib/planex/data/holguin/consultas-doc';
import { CONTRADICCIONES, BRECHAS, VALIDACIONES } from '../../src/lib/planex/data/holguin/brechas';
import { dato } from '../../src/lib/planex/data/holguin/registro';
import { componerDocumentoConsultasPDF } from '../../src/lib/planex/io/consultas';
import { exportarDOCXDesdeModelo } from '../../src/lib/planex/io/docx';
import {
  violacionesDensidad,
  excepcionesOcupacionBaja,
  componerDesdeModeloConIndice,
} from '../../src/lib/planex/io/pdf';
import type { DocumentoPlanex } from '../../src/lib/planex/doc/modelo';

const p = crearProyectoHolguin();
const m = computeProject(p);

/** Todo el texto del documento canónico, en orden. */
function textoDocumento(d: DocumentoPlanex): string {
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
  d.portada.cifras.forEach((c) => trozos.push(c.etiqueta, c.valor));
  for (const s of d.secciones) {
    trozos.push(s.titulo);
    caminar(s.elementos);
  }
  return trozos.join('\n');
}

const idsContradicciones = new Set(CONTRADICCIONES.map((c) => c.id));
const idsBrechas = new Set(BRECHAS.map((b) => b.id));
const idsValidaciones = new Set(VALIDACIONES.map((v) => v.id));
const idsSupuestos = new Set(SUPUESTOS.map((s) => s.id));

/** Las referencias C-##, B-##, V-##, S-## y H-### de las consultas existen. */
function referenciaValida(ref: string): boolean {
  if (/^C-\d{2}$/.test(ref)) return idsContradicciones.has(ref);
  if (/^B-\d{2}$/.test(ref)) return idsBrechas.has(ref);
  if (/^V-\d{2}$/.test(ref)) return idsValidaciones.has(ref);
  if (/^S-\d{2}$/.test(ref)) return idsSupuestos.has(ref);
  if (/^H-\d{3}$/.test(ref)) {
    try {
      dato(ref);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// ============================================================================
// 1 · Integridad de los módulos de datos de consultas
// ============================================================================
describe('DATA-002 §1 — integridad referencial de los datos de consultas', () => {
  test('supuestos: IDs únicos, completos y con referencias vivas', () => {
    const vistos = new Set<string>();
    for (const s of SUPUESTOS) {
      expect(/^S-\d{2}$/.test(s.id)).toBe(true);
      expect(vistos.has(s.id)).toBe(false);
      vistos.add(s.id);
      expect(s.concepto.length).toBeGreaterThan(3);
      expect(s.valorAdoptado.length).toBeGreaterThan(1);
      expect(s.dondeEnPlanex.length).toBeGreaterThan(3);
      expect(s.fundamento.length).toBeGreaterThan(30);
      expect(s.efectoSiCambia.length).toBeGreaterThan(20);
      expect(s.comoConfirmar.length).toBeGreaterThan(20);
      expect(s.referencias.length).toBeGreaterThan(0);
      for (const r of s.referencias) expect(referenciaValida(r)).toBe(true);
    }
    expect(SUPUESTOS.length).toBeGreaterThanOrEqual(15);
  });

  test('consultas: IDs únicos, autocontenidas y con referencias vivas', () => {
    const vistos = new Set<string>();
    for (const c of CONSULTAS) {
      expect(/^Q-\d{2}$/.test(c.id)).toBe(true);
      expect(vistos.has(c.id)).toBe(false);
      vistos.add(c.id);
      expect(c.pregunta.length).toBeGreaterThan(20);
      // El contexto cita un localizador exacto del sistema documental: fuente
      // F0x, registro H-###, contradicción C-##, brecha B-## o validación V-##
      // (las preguntas de ausencia citan la brecha; las de norma nueva, la norma):
      expect(
        /F0\d/.test(c.contexto) ||
          /H-\d{3}/.test(c.contexto) ||
          /(C|B|V)-\d{2}/.test(c.contexto)
      ).toBe(true);
      expect(c.motivo.length).toBeGreaterThan(30);
      expect(c.loResuelve.length).toBeGreaterThan(15);
      expect(c.responde.length).toBeGreaterThan(5);
      expect(['critica', 'alta', 'media', 'baja']).toContain(c.prioridad);
      expect(c.referencias.length).toBeGreaterThan(0);
      for (const r of c.referencias) expect(referenciaValida(r)).toBe(true);
    }
    expect(CONSULTAS.length).toBeGreaterThanOrEqual(24);
  });

  test('cada área de la metodología crítica tiene consultas y las críticas son las esperadas', () => {
    const res = resumenConsultas();
    expect(res.total).toBe(CONSULTAS.length);
    expect(res.criticas).toBeGreaterThanOrEqual(6);
    const criticas = CONSULTAS.filter((c) => c.prioridad === 'critica').map((c) => c.id);
    for (const esperada of ['Q-06', 'Q-08', 'Q-09', 'Q-11', 'Q-19', 'Q-23']) {
      expect(criticas).toContain(esperada);
    }
  });

  test('normativa: IDs únicos y con verificación pendiente declarada', () => {
    const vistos = new Set<string>();
    for (const n of NORMATIVA) {
      expect(/^N-\d{2}$/.test(n.id)).toBe(true);
      expect(vistos.has(n.id)).toBe(false);
      vistos.add(n.id);
      expect(n.norma.length).toBeGreaterThan(20);
      expect(n.queEstablece.length).toBeGreaterThan(80);
      expect(n.aplicacionAlProyecto.length).toBeGreaterThan(20);
      expect(n.verificacionPendiente.length).toBeGreaterThan(20);
    }
    expect(NORMATIVA.length).toBeGreaterThanOrEqual(6);
  });
});

// ============================================================================
// 2 · El documento RESPONDE la pregunta central y no deriva del modelo
// ============================================================================
describe('DATA-002 §2 — respuesta normativa del impuesto y de la tasa', () => {
  const doc = construirDocumentoConsultas();
  const TEXTO = textoDocumento(doc);

  test('el impuesto del 15 % tiene sustento directo: Ley 118, artículo 36.1 (y su exención de 8 años)', () => {
    // La pregunta del propietario: ¿por qué 15 % y no 35 %?
    expect(TEXTO).toContain('15 %');
    expect(TEXTO).toContain('36.1');
    expect(TEXTO).toContain('Ley 118');
    expect(TEXTO).toContain('artículo 36.2');
    expect(TEXTO).toContain('ocho años');
  });

  test('la tasa general del 35 % aparece como régimen general (Ley 113 / presupuesto) y la exclusión del art. 43 se cita', () => {
    expect(TEXTO).toContain('35 %');
    expect(TEXTO).toContain('Ley 113');
    expect(TEXTO).toContain('artículo 43');
  });

  test('la verificación jurídica queda como pendiente explícita (nada se presenta como acreditado)', () => {
    expect(TEXTO).toContain('Asesor jurídico');
    expect(TEXTO).toContain('Pronunciamiento');
    expect(TEXTO).toContain('verificación');
  });

  test('la tasa oficial vigente consultada (758,00 CUP/USD el 29/10/2026) aparece con su fecha', () => {
    expect(TEXTO).toContain('758,00');
    expect(TEXTO).toContain(FECHA_CONSULTA_NORMATIVA);
  });

  test('la contradicción C-01 (24 vs 120) permanece SIN resolverse en el documento', () => {
    expect(TEXTO).toContain('C-01');
    expect(TEXTO).toContain('120 CUP/USD');
    // La tasa del documento sigue siendo la documental (no la oficial ni la 24):
    expect(TEXTO).toContain('Tasa de cambio del modelo');
  });

  test('sin deriva: la tasa del documento de consultas coincide con el parámetro del modelo', () => {
    const param = p.parametros.find((x) => x.id === 'tipo_cambio');
    expect(param?.valor).toBe(120);
    // El supuesto S-01 declara el mismo valor:
    const s01 = SUPUESTOS.find((s) => s.id === 'S-01');
    expect(s01?.valorAdoptado).toContain('120');
  });

  test('sin deriva: el impuesto del documento coincide con el parámetro y la regla del modelo', () => {
    const param = p.parametros.find((x) => x.id === 'tasa_impuesto_utilidades');
    expect(param?.valor).toBeCloseTo(0.15, 6);
    const regla = p.reglas.find((r) => r.id === 'impuesto_utilidades_k');
    expect(regla?.expresion).toContain('PERIODO >= 8');
    const s02 = SUPUESTOS.find((s) => s.id === 'S-02');
    expect(s02?.valorAdoptado).toContain('15 %');
  });
});

// ============================================================================
// 3 · Una sola fuente, composición editorial del PDF
// ============================================================================
describe('DATA-002 §3 — una sola fuente de información y composición editorial', () => {
  test('el documento de consultas se construye desde los mismos módulos (secciones verificables)', () => {
    const res = resumenDocumentoConsultas();
    const ids = new Set(res.ids);
    for (const esperada of [
      'proposito',
      'supuestos',
      'normativa',
      'resumen',
      'efecto',
      'anexo-mapa',
    ]) {
      expect(ids.has(esperada)).toBe(true);
    }
    // Subsecciones de consultas por área (4.1 … 4.6):
    for (const area of [
      'consultas-identidad_legal',
      'consultas-financiero_fiscal',
      'consultas-mercado_precios',
      'consultas-operacion_laboral',
      'consultas-suministros_inversion',
      'consultas-normativo_validaciones',
    ]) {
      expect(ids.has(area)).toBe(true);
    }
  });

  test('la portada lleva las cifras de control y el estado de trabajo para el promotor', () => {
    const doc = construirDocumentoConsultas();
    const etiquetas = doc.portada.cifras.map((c) => c.etiqueta);
    for (const e of ['Consultas al promotor', 'Supuestos del modelo', 'Normas consultadas', 'Fecha de corte', 'Versión del documento']) {
      expect(etiquetas).toContain(e);
    }
    expect(doc.portada.avisoDemo).toContain('DOCUMENTO DE TRABAJO');
    expect(doc.meta.tituloCorriente).toBe('CONSULTAS AL PROMOTOR');
    expect(doc.meta.marcaPie).toContain('DATA-002');
  });

  test('el PDF se compone con el compositor editorial, con el nombre de la serie y sin violaciones de densidad', () => {
    const { datos, nombre } = componerDocumentoConsultasPDF();
    expect(datos.byteLength).toBeGreaterThan(100_000);
    expect(
      /^PLANEX_Consultas_Promotor_Centro_Estomatologico_Internacional_Holguin_\d{4}-\d{2}-\d{2}\.pdf$/.test(
        nombre
      )
    ).toBe(true);
    // Composición con diagnóstico: reutiliza la vía del informe de brechas.
    const { diagnostico } = componerDesdeModeloConIndice(construirDocumentoConsultas());
    expect(violacionesDensidad(diagnostico)).toEqual([]);
    for (const pag of excepcionesOcupacionBaja(diagnostico)) {
      expect(pag.motivos.length).toBeGreaterThan(0);
    }
  });

  test('el DOCX sale del MISMO modelo canónico (gemelo editable para responder)', async () => {
    const documento = construirDocumentoConsultas();
    const { datos } = await exportarDOCXDesdeModelo(documento);
    expect(datos.size).toBeGreaterThan(20_000);
    // La misma instancia de modelo: mismo número de secciones que el PDF.
    const res = resumenDocumentoConsultas();
    expect(documento.secciones.length).toBe(res.secciones);
  });
});

// ============================================================================
// 4 · Protección documental (sin datos personales del expediente)
// ============================================================================
describe('DATA-002 §4 — protección documental', () => {
  test('los módulos de consultas no incorporan teléfonos ni correos personales', () => {
    for (const modulo of [JSON.stringify(SUPUESTOS), JSON.stringify(CONSULTAS), JSON.stringify(NORMATIVA)]) {
      expect(/\+53\s?\d/.test(modulo)).toBe(false);
      expect(modulo).not.toContain('@');
    }
  });

  test('las consultas citan sus contradicciones/brechas/validaciones, no contenido original', () => {
    // Ninguna consulta vuelca párrafos del expediente: citan localizadores.
    const ids = new Set([...idsContradicciones, ...idsBrechas, ...idsValidaciones]);
    const citadas = new Set<string>();
    for (const c of CONSULTAS) for (const r of c.referencias) citadas.add(r);
    // Al menos una consulta por cada contradicción crítica y por las validaciones:
    expect(citadas.has('C-01')).toBe(true);
    for (const v of VALIDACIONES) expect(citadas.has(v.id)).toBe(true);
    expect(citadas.size).toBeGreaterThan(0);
  });
});

// ============================================================================
// 5 · Compatibilidad: el comportamiento previo queda intacto
// ============================================================================
describe('DATA-002 §5 — compatibilidad con los documentos preexistentes', () => {
  test('el plan de negocios sigue usando su encabezado clásico (fallback exacto, sin título corriente)', () => {
    const docClinica = construirDocumentoPlanex(p, m, { moneda: 'CUP' });
    expect(docClinica.meta.tituloCorriente).toBeUndefined();
    expect(docClinica.meta.marcaPie).toBeUndefined();
    expect(docClinica.portada.titulo).toContain('PLAN DE NEGOCIOS');
    // El plan clínico (regresión de AUDIT-001) tampoco define metadatos nuevos:
    const clinica = crearProyectoClinica();
    const docC = construirDocumentoPlanex(clinica, computeProject(clinica), { moneda: 'CUP' });
    expect(docC.meta.tituloCorriente).toBeUndefined();
  });

  test('el documento de consultas ES distinto del plan (no lo sustituye ni se mezcla)', () => {
    const doc = construirDocumentoConsultas();
    expect(doc.meta.esquema).toBe('PLANEX-DATA-002');
    expect(doc.portada.titulo).not.toContain('PLAN DE NEGOCIOS');
    const plan = construirDocumentoPlanex(p, m, { moneda: 'CUP' });
    expect(plan.meta.esquema).not.toBe('PLANEX-DATA-002');
  });
});
