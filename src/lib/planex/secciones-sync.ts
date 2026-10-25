// ============================================================================
// PLANEX — Proyección del proyecto en 12 SECCIONES sincronizables.
//
// Cada sección es un grupo de claves de primer nivel de PlanexProject que se
// guarda como una fila independiente de plan_sections (con su propia
// section_version). Así, dos personas pueden editar apartados distintos sin
// pisarse; los parámetros y las reglas de cálculo tienen sección propia
// (modificaciones de alto impacto, vigiladas de forma especial).
//
// El nombre y las fechas del proyecto (id, nombre, creado, actualizado, el
// bloque planex) NO viven en secciones: provienen de la fila plans.
// ============================================================================

import { PlanexProject } from './types';

export const CLAVES_SECCION = [
  'identificacion',
  'descripcion',
  'tecnico',
  'produccion',
  'inversiones',
  'mercado',
  'fuerza',
  'cronograma',
  'conclusiones',
  'parametros',
  'reglas',
  'meta',
] as const;

export type ClaveSeccion = (typeof CLAVES_SECCION)[number];

const MAPA_SECCION: Record<ClaveSeccion, (keyof PlanexProject)[]> = {
  identificacion: ['general', 'titulo', 'resumen'],
  descripcion: ['negocio', 'inversionistaExtranjero', 'inversionistaNacional'],
  tecnico: ['tecnico', 'consumos'],
  produccion: ['servicios', 'recursos'],
  inversiones: ['aportaciones', 'financiero'],
  mercado: ['mercado'],
  fuerza: ['fuerza', 'personal'],
  cronograma: ['cronograma'],
  conclusiones: ['conclusiones', 'analisis'],
  parametros: ['parametros'],
  reglas: ['reglas'],
  meta: ['ajustes'],
};

const NOMBRES_SECCION: Record<ClaveSeccion, string> = {
  identificacion: 'Información general',
  descripcion: 'Descripción del negocio',
  tecnico: 'Aspectos técnicos',
  produccion: 'Producción y servicios',
  inversiones: 'Inversión y financiación',
  mercado: 'Mercado',
  fuerza: 'Fuerza de trabajo',
  cronograma: 'Cronograma',
  conclusiones: 'Conclusiones',
  parametros: 'Parámetros de cálculo',
  reglas: 'Reglas de cálculo',
  meta: 'Ajustes del modelo',
};

export function nombreSeccion(clave: string): string {
  return NOMBRES_SECCION[clave as ClaveSeccion] ?? clave;
}

/** Extrae el contenido de una sección (subconjunto estable del proyecto). */
export function extraerSeccion(p: PlanexProject, clave: ClaveSeccion): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const campo of MAPA_SECCION[clave]) {
    salida[campo] = p[campo];
  }
  return salida;
}

/** Extrae todas las secciones de un proyecto. */
export function extraerSecciones(p: PlanexProject): Record<ClaveSeccion, Record<string, unknown>> {
  const salida = {} as Record<ClaveSeccion, Record<string, unknown>>;
  for (const clave of CLAVES_SECCION) salida[clave] = extraerSeccion(p, clave);
  return salida;
}

/**
 * Sustituye en un proyecto el contenido de una sección (clon profundo).
 * Devuelve un NUEVO proyecto; no muta el original.
 */
export function aplicarSeccion(
  base: PlanexProject,
  clave: ClaveSeccion,
  contenido: Record<string, unknown>,
): PlanexProject {
  const p: PlanexProject = JSON.parse(JSON.stringify(base));
  for (const campo of MAPA_SECCION[clave]) {
    const valor = contenido[campo];
    if (valor !== undefined) {
      (p as unknown as Record<string, unknown>)[campo] = valor;
    }
  }
  return p;
}

/**
 * Huella canónica de una sección para detectar cambios.
 * Serializa con las claves ORDENADAS en todos los niveles: el mismo
 * contenido produce siempre la misma huella, aunque el servidor (jsonb)
 * devuelva las claves en otro orden. Los arrays conservan su orden
 * (semánticamente significativo en el modelo).
 * NOTA: no usar el «replacer» de claves de JSON.stringify (array), porque
 * filtra también las claves de los niveles anidados y dejaría la huella
 * vacía ({"mercado":{}}), incapaz de detectar cualquier cambio.
 */
export function huellaSeccion(contenido: Record<string, unknown>): string {
  const ordenar = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(ordenar);
    if (x && typeof x === 'object') {
      const salida: Record<string, unknown> = {};
      for (const k of Object.keys(x as Record<string, unknown>).sort()) {
        salida[k] = ordenar((x as Record<string, unknown>)[k]);
      }
      return salida;
    }
    return x;
  };
  return JSON.stringify(ordenar(contenido));
}
