// ============================================================================
// PLANEX — Comparación de dos versiones guardadas del plan (misión UX-002
// §4.2: «Comparar versiones» con diferencias REALES, no decorativas).
//
// Módulo PURO: recibe dos filas de plan_versions (con su instantánea) y
// produce las diferencias campo a campo agrupadas por sección del plan.
// La vista de Colaboración lo usa directamente; las pruebas lo cubren.
// ============================================================================

import { diferenciarJSON } from '@/lib/planex/diferencias';
import { nombreSeccion } from '@/lib/planex/secciones-sync';
import type { VersionRow } from './tipos';

export interface ComparacionSeccion {
  clave: string;
  titulo: string;
  diferencias: { ruta: string; antes: string; despues: string }[];
}

/** Diferencia REAL de dos instantáneas, agrupada por sección del plan. */
export function compararSnapshots(va: VersionRow, vb: VersionRow): ComparacionSeccion[] {
  const seccionesA = (va.snapshot?.secciones ?? {}) as Record<string, Record<string, unknown>>;
  const seccionesB = (vb.snapshot?.secciones ?? {}) as Record<string, Record<string, unknown>>;
  const claves = Array.from(new Set([...Object.keys(seccionesA), ...Object.keys(seccionesB)]));
  const salida: ComparacionSeccion[] = [];
  for (const clave of claves) {
    const diferencias = diferenciarJSON(seccionesA[clave] ?? {}, seccionesB[clave] ?? {});
    salida.push({ clave, titulo: nombreSeccion(clave), diferencias });
  }
  return salida;
}

/** Total de campos con diferencia entre las dos versiones. */
export function contarCambios(comparacion: ComparacionSeccion[]): number {
  return comparacion.reduce((s, c) => s + c.diferencias.length, 0);
}
