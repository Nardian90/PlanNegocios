// ============================================================================
// PLANEX — Trazabilidad de fuentes y alcance de parámetros (misión DOC-002
// §4.3 y §6).
//
// Genera, DESDE EL PROPIO PROYECTO (sin constantes duplicadas):
//   · Fichas de alcance por parámetro financiero: partidas afectadas
//     (derivadas de las reglas que lo referencian), fórmula, unidad, ámbito
//     de aplicación, naturaleza del efecto (contable/caja/análisis),
//     redondeo e interacciones.
//   · El bloque de fuentes: distingue normas oficiales, referencias legales
//     declaradas, cotizaciones, datos proporcionados por el usuario e
//     HIPÓTESIS ilustrativas. Un supuesto ficticio NUNCA se cuenta como
//     fuente validada (§5).
// ============================================================================

import { PlanexProject } from '../types';
import { parsear, extraerVariables } from '../engine/parser';
import { fmtK, fmtPct, esReferenciaHipotesis } from '../format';

// ---------------------------------------------------------------------------
// Fichas de parámetros
// ---------------------------------------------------------------------------

export type EfectoParametro = 'contable_y_caja' | 'solo_caja' | 'solo_analisis' | 'presentacion';

export interface FichaParametro {
  id: string;
  nombre: string;
  valor: string;
  unidad: string;
  esDemo: boolean;
  fechaRef: string;
  fuente: string;
  /** Nombres de las partidas (reglas) que usan el parámetro. */
  partidas: string[];
  /** Expresiones activas de esas partidas (fórmula aplicada). */
  formulas: string[];
  /** Ámbito de aplicación de las partidas (proyecto/año/servicio/personal). */
  ambitos: string[];
  /** Naturaleza del efecto (descripción documentada). */
  efecto: string;
  /** Regla de redondeo del modelo (uniforme y documentada). */
  redondeo: string;
}

const EFECTO_POR_PARAM: Record<string, EfectoParametro> = {
  tasa_impuesto_utilidades: 'contable_y_caja',
  tipo_cambio: 'presentacion',
  tasa_interes: 'contable_y_caja',
  plazo_amortizacion: 'solo_caja',
  periodo_gracia: 'contable_y_caja',
  inflacion: 'contable_y_caja',
  inflacion_costos_fijos: 'contable_y_caja',
  crecimiento_precios: 'contable_y_caja',
  crecimiento_volumen: 'contable_y_caja',
  crecimiento_salarios: 'contable_y_caja',
  pct_gastos_admin: 'contable_y_caja',
  pct_mantenimiento: 'contable_y_caja',
  factor_costo_laboral: 'contable_y_caja',
  pct_parte_cubana: 'solo_caja',
  pct_reparto_dividendos: 'solo_caja',
  pct_reserva_legal: 'solo_caja',
  pct_recuperacion_capital_trabajo: 'solo_caja',
  servicios_publicos_anual_k: 'contable_y_caja',
  canon_anual_k: 'contable_y_caja',
  otros_gastos_fijos_k: 'contable_y_caja',
  credito_monto_k: 'solo_caja',
  otras_fuentes_k: 'solo_caja',
  capital_trabajo_k: 'solo_caja',
  aranceles_anual_k: 'contable_y_caja',
  otros_impuestos_anual_k: 'contable_y_caja',
  royalties_anual_k: 'contable_y_caja',
  otros_beneficios_pais_anual_k: 'contable_y_caja',
  umbral_utilizacion_capacidad: 'solo_analisis',
  umbral_margen_minimo: 'solo_analisis',
};

const TEXTO_EFECTO: Record<EfectoParametro, string> = {
  contable_y_caja: 'Afecta el estado de resultados y la caja (ambos)',
  solo_caja: 'Afecta la caja (flujo de financiación/distribución), no el estado de resultados',
  solo_analisis: 'No interviene en el cálculo: califica los análisis y alertas',
  presentacion: 'Afecta la presentación documental y la conversión entre monedas, no los datos de origen',
};

/** Fichas de alcance de TODOS los parámetros, con las partidas derivadas de
 *  las reglas activas (nada de listas manuales que puedan quedarse viejas). */
export function fichasParametros(p: PlanexProject): FichaParametro[] {
  // id de regla → { nombre, ambito, expresión, variables referenciadas }
  const reglas = p.reglas
    .map((r) => {
      try {
        return { r, vars: [...extraerVariables(parsear(r.expresion))] };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<{ r: (typeof p.reglas)[number]; vars: string[] }>;

  return p.parametros.map((x) => {
    const usos = reglas.filter((u) => u.vars.includes(x.id));
    const partidas = [...new Set(usos.map((u) => `${u.r.nombre} (${u.r.id})`))];
    const formulas = [...new Set(usos.map((u) => `${u.r.id} = ${u.r.expresion}`))];
    const ambitos = [...new Set(usos.map((u) => u.r.ambito))];
    const efecto = EFECTO_POR_PARAM[x.id] ?? 'contable_y_caja';
    return {
      id: x.id,
      nombre: x.nombre,
      valor: x.tipo === 'porcentaje' ? fmtPct(x.valor) : `${fmtK(x.valor)} ${x.unidad}`,
      unidad: x.unidad,
      esDemo: !!x.demo,
      fechaRef: x.fechaRef || '—',
      fuente: x.fuente || '—',
      partidas: partidas.length ? partidas : ['(ninguna partida activa lo referencia: parámetro informativo o sin uso actual)'],
      formulas: formulas.length ? formulas : ['—'],
      ambitos: ambitos.length ? ambitos : ['—'],
      efecto: TEXTO_EFECTO[efecto],
      redondeo: 'Precisión interna completa; el redondeo es solo de presentación (un decimal al formatear)',
    };
  });
}

// ---------------------------------------------------------------------------
// Bloque de fuentes y supuestos
// ---------------------------------------------------------------------------

export type TipoFuente =
  | 'norma_oficial'
  | 'referencia_legal_declarada'
  | 'cotizacion'
  | 'dato_usuario'
  | 'hipotesis_ilustrativa';

export interface FilaFuente {
  fuente: string;
  tipo: TipoFuente;
  emisor: string;
  fechaRef: string;
  respalda: string;
  estado: string;
}

const ETIQUETA_TIPO: Record<TipoFuente, string> = {
  norma_oficial: 'Norma oficial',
  referencia_legal_declarada: 'Referencia legal declarada',
  cotizacion: 'Cotización / tasa',
  dato_usuario: 'Dato del usuario',
  hipotesis_ilustrativa: 'HIPÓTESIS ilustrativa',
};

export const ETIQUETAS_TIPO_FUENTE = ETIQUETA_TIPO;

/** Construye el bloque de trazabilidad de fuentes del informe (§6). */
export function fuentesTrazabilidad(p: PlanexProject): FilaFuente[] {
  const filas: FilaFuente[] = [];

  filas.push({
    fuente: 'Bases Metodológicas — Resolución 78/2026, Gaceta Oficial GOC-2026-O57',
    tipo: 'norma_oficial',
    emisor: 'Ministerio de Economía y Planificación / Gaceta Oficial de la República de Cuba',
    fechaRef: '09/07/2026',
    respalda: 'Estructura metodológica 4.1–4.12, unidades y contenido requeridos del plan de negocios (incluidos los desgloses por canal y los indicadores de beneficios directos al país).',
    estado: 'Estructura APLICADA por la aplicación; el cumplimiento del CONTENIDO depende de los datos del plan y de sus validaciones.',
  });

  const mod = p.negocio.modalidad ?? '';
  if (/ley\s*118|decreto.?ley\s*335/i.test(mod)) {
    filas.push({
      fuente: 'Ley 118/2014 «Ley de la Inversión Extranjera» y Decreto-Ley 335/2018 (según la modalidad declarada en 4.5)',
      tipo: 'referencia_legal_declarada',
      emisor: 'Asamblea Nacional del Poder Popular / Consejo de Estado (referencia declarada por el usuario)',
      fechaRef: '—',
      respalda: 'Modalidad de la inversión extranjera declarada en el apartado 4.5.',
      estado: 'Referencia legal declarada: la aplicabilidad al proyecto concreto REQUIERE verificación jurídica documentada (el plan no acredita su cumplimiento).',
    });
  }

  const tc = p.parametros.find((x) => x.id === 'tipo_cambio');
  if (tc) {
    filas.push({
      fuente: `Tipo de cambio ${fmtK(tc.valor)} CUP por USD (parámetro «tipo_cambio»)`,
      tipo: 'cotizacion',
      emisor: (tc.fuente || 'fuente no documentada') + (tc.demo ? ' — SUPUESTO DE DEMOSTRACIÓN' : ''),
      fechaRef: tc.fechaRef || '—',
      respalda: 'Conversión de salarios (CUP→USD), partidas de inversión en CUP y presentación dual del documento.',
      estado: tc.demo
        ? 'PENDIENTE DE VALIDACIÓN OFICIAL: tasa ilustrativa; documente la tasa oficial vigente, su fecha y su fuente antes de un uso oficial.'
        : 'Tasa definida por el usuario: verifique su fuente oficial y fecha de vigencia.',
    });
  }

  const tasa = p.parametros.find((x) => x.id === 'tasa_impuesto_utilidades');
  if (tasa) {
    filas.push({
      fuente: `Tasa de impuesto sobre utilidades ${fmtPct(tasa.valor)} (parámetro «tasa_impuesto_utilidades»)`,
      tipo: tasa.demo ? 'hipotesis_ilustrativa' : 'dato_usuario',
      emisor: tasa.fuente || 'fuente no documentada',
      fechaRef: tasa.fechaRef || '—',
      respalda: 'Impuesto sobre utilidades y, a través de él, utilidad neta, FCFF/FCFE (vía escudo fiscal), recuperaciones, dividendos y beneficios al país.',
      estado: tasa.demo
        ? 'SUPUESTO DE DEMOSTRACIÓN que CONDICIONA las conclusiones económicas: documente la tasa legal aplicable antes de cualquier presentación.'
        : 'Definida por el usuario: exija la norma tributaria aplicable y su vigencia.',
    });
  }

  for (const a of p.aportaciones) {
    const hip = esReferenciaHipotesis(a.referenciaDocumental);
    filas.push({
      fuente: `Aportación ${a.id} — ${a.referenciaDocumental?.trim() || 'sin referencia declarada'}`,
      tipo: hip ? 'hipotesis_ilustrativa' : 'dato_usuario',
      emisor: a.socio === 'nacional' ? 'Socio nacional' : 'Socio extranjero',
      fechaRef: '—',
      respalda: `Aporte de ${fmtK(a.montos.reduce((s, v) => s + v, 0))} kUSD al capital social.`,
      estado: hip
        ? 'Referencia NO identificable (vacía, ficticia, proforma o pendiente): no cuenta como respaldo validado; adjunte el instrumento identificable (título, emisor, fecha).'
        : 'Referencia declarada por el usuario: verifique el documento identificable y su soporte.',
    });
  }

  filas.push({
    fuente: 'Demanda solvente, captación y precios de servicios (apartados 4.6 y 4.8)',
    tipo: /fictici|ilustrativ|supuesto/i.test(p.mercado.fuentesConsulta ?? '') ? 'hipotesis_ilustrativa' : 'dato_usuario',
    emisor: p.mercado.metodoEstimacion?.trim() || 'método no documentado',
    fechaRef: '—',
    respalda: 'Volumen de servicios, ingresos por línea y desglose por canales.',
    estado: 'Estimación del usuario/hipótesis ilustrativa: sin estudio de mercado verificable, la demanda NO debe presentarse como dato validado.',
  });

  filas.push({
    fuente: 'Requisitos regulatorios declarados (apartado 4.8)',
    tipo: 'dato_usuario',
    emisor: 'Usuario del plan',
    fechaRef: '—',
    respalda: 'Requisitos legales, sanitarios y ambientales identificados.',
    estado: 'LISTADO no verificado: cada autorización exige evidencia externa comprobable (número, emisor, fecha y estado de aprobación). La aplicación NO declara su cumplimiento.',
  });

  return filas;
}
