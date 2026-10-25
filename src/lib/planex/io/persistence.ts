// ============================================================================
// Persistencia local (localStorage) — sin cuentas en línea, sin servicios
// externos, sin base de datos remota.
// ============================================================================

import { PlanexProject } from '../types';
import { normalizarProyecto } from '../model/factory';

const CLAVE_ACTUAL = 'planex.proyecto.actual';
const CLAVE_BIBLIOTECA = 'planex.biblioteca';
const CLAVE_TEMA = 'planex.tema';

export interface EntradaBiblioteca {
  id: string;
  nombre: string;
  plantillaOrigen: string;
  guardado: string;
}

function seguroParse<T>(texto: string | null, porDefecto: T): T {
  if (!texto) return porDefecto;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return porDefecto;
  }
}

export function guardarActual(p: PlanexProject): void {
  try {
    localStorage.setItem(CLAVE_ACTUAL, JSON.stringify(p));
  } catch {
    /* almacenamiento lleno o no disponible: la app sigue funcionando en memoria */
  }
}

export function cargarActual(): PlanexProject | null {
  try {
    const texto = localStorage.getItem(CLAVE_ACTUAL);
    if (!texto) return null;
    const dato = JSON.parse(texto);
    if (!dato || typeof dato !== 'object') return null;
    // Re-normalizar para tolerar cambios de versión del esquema.
    return normalizarProyecto(dato);
  } catch {
    return null;
  }
}

export function listarBiblioteca(): EntradaBiblioteca[] {
  return seguroParse<EntradaBiblioteca[]>(localStorage.getItem(CLAVE_BIBLIOTECA), []);
}

export function guardarEnBiblioteca(p: PlanexProject): EntradaBiblioteca {
  const lista = listarBiblioteca().filter((x) => x.id !== p.id);
  const entrada: EntradaBiblioteca = {
    id: p.id,
    nombre: p.nombre,
    plantillaOrigen: p.planex.plantillaOrigen,
    guardado: new Date().toISOString(),
  };
  // El proyecto completo se guarda bajo su propio id.
  try {
    localStorage.setItem(`planex.proyecto.${p.id}`, JSON.stringify(p));
    localStorage.setItem(CLAVE_BIBLIOTECA, JSON.stringify([entrada, ...lista].slice(0, 20)));
  } catch {
    /* ignorar errores de cuota */
  }
  return entrada;
}

export function cargarDeBiblioteca(id: string): PlanexProject | null {
  try {
    const texto = localStorage.getItem(`planex.proyecto.${id}`);
    if (!texto) return null;
    return normalizarProyecto(JSON.parse(texto));
  } catch {
    return null;
  }
}

export function eliminarDeBiblioteca(id: string): void {
  const lista = listarBiblioteca().filter((x) => x.id !== id);
  try {
    localStorage.removeItem(`planex.proyecto.${id}`);
    localStorage.setItem(CLAVE_BIBLIOTECA, JSON.stringify(lista));
  } catch {
    /* ignorar */
  }
}

export function guardarTema(tema: 'dark' | 'light'): void {
  try {
    localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    /* ignorar */
  }
}

export function cargarTema(): 'dark' | 'light' | null {
  const t = localStorage.getItem(CLAVE_TEMA);
  return t === 'dark' || t === 'light' ? t : null;
}

// ----------------------------------------------------------------------------
// Copia local de trabajo por plan (mecanismo de RECUPERACIÓN).
//
// Supabase es la fuente compartida de verdad cuando hay conexión; esta caché
// solo preserva el trabajo pendiente ante un cierre inesperado o una
// interrupción de red. Nunca se presenta como «guardado en el servidor».
// ----------------------------------------------------------------------------

const claveCachePlan = (id: string) => `planex.cache.${id}`;

export function guardarCachePlan(id: string, p: PlanexProject): void {
  try {
    localStorage.setItem(claveCachePlan(id), JSON.stringify(p));
  } catch {
    /* cuota agotada: la sincronización con Supabase no se ve afectada */
  }
}

export function cargarCachePlan(id: string): PlanexProject | null {
  try {
    const texto = localStorage.getItem(claveCachePlan(id));
    if (!texto) return null;
    return normalizarProyecto(JSON.parse(texto));
  } catch {
    return null;
  }
}

export function borrarCachePlan(id: string): void {
  try {
    localStorage.removeItem(claveCachePlan(id));
  } catch {
    /* ignorar */
  }
}
