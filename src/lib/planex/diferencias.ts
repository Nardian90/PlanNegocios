// ============================================================================
// PLANEX — Diferencia de dos contenidos JSON (hojas), para comparaciones de
// conflictos de edición y de versiones guardadas.
//
// Módulo PURO (sin dependencias de React ni de red): la misma función que
// usa la vista de Colaboración y las pruebas unitarias.
// ============================================================================

export interface LineaDiff {
  ruta: string;
  antes: string;
  despues: string;
}

export function diferenciarJSON(antes: unknown, despues: unknown, ruta = '', salida: LineaDiff[] = [], profundidad = 0): LineaDiff[] {
  if (salida.length > 80) return salida;
  if (JSON.stringify(antes) === JSON.stringify(despues)) return salida;
  if (Array.isArray(antes) && Array.isArray(despues)) {
    const max = Math.max(antes.length, despues.length);
    if (profundidad > 4 || max > 60) {
      salida.push({ ruta: ruta || '(lista)', antes: `elementos: ${antes.length}`, despues: `elementos: ${despues.length}` });
      return salida;
    }
    for (let i = 0; i < max; i++) {
      diferenciarJSON(antes[i], despues[i], `${ruta || 'lista'}[${i}]`, salida, profundidad + 1);
    }
    return salida;
  }
  if (antes && despues && typeof antes === 'object' && typeof despues === 'object') {
    const claves = [...new Set([...Object.keys(antes as object), ...Object.keys(despues as object)])].sort();
    for (const c of claves) {
      diferenciarJSON((antes as Record<string, unknown>)[c], (despues as Record<string, unknown>)[c], ruta ? `${ruta}.${c}` : c, salida, profundidad + 1);
    }
    return salida;
  }
  salida.push({
    ruta: ruta || '(valor)',
    antes: antes === undefined ? '—' : JSON.stringify(antes),
    despues: despues === undefined ? '—' : JSON.stringify(despues),
  });
  return salida;
}
