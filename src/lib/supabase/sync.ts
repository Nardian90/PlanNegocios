'use client';

// ============================================================================
// PLANEX — Motor de sincronización del plan compartido (Supabase).
//
// Flujo de autoguardado por cambio de campo:
//   1) la UI muta el modelo (almacén zustand de la app);
//   2) aquí se detectan qué SECCIONES cambiaron (huella JSON por sección);
//   3) se marcan como pendientes y se programa el envío con debounce (1,4 s);
//   4) cada sección se guarda indicando la versión sobre la que se escribe
//      (control de concurrencia optimista);
//   5) si otro colaborador guardó esa sección antes, el servidor NO aplica
//      la escritura (0 filas): se conserva el trabajo local, se recupera la
//      versión persistida y se informa del conflicto con opciones de
//      resolución (comparar / cargar remota / guardar copia / sobrescribir
//      de forma explícita). Nunca se sobrescribe en silencio.
//
// Realtime: cada suscripción recibe los cambios persistidos de ambos
// colaboradores filtrados por RLS (WalRus). Un mensaje de Realtime NO es
// prueba de autorización: las lecturas/escrituras siguen protegidas en el
// servidor. Los ecos propios se detectan por updated_by.
//
// Sin conexión: los cambios pendientes se conservan (con caché local de
// recuperación) y se reintenta de forma controlada; nunca se presentan como
// guardados en el servidor.
// ============================================================================

import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './cliente';
import {
  actualizarTituloPlan,
  crearInstantanea,
  crearSeccion,
  guardarSeccion,
  listarVersiones,
  obtenerPlan,
  obtenerSecciones,
  obtenerVersion,
  registrarActividad,
  actualizarEstadoPlan,
} from './datos';
import type { PlanRow, SeccionRow, VersionRow } from './tipos';
import { useAuth } from './auth';
import { usePlanex } from '@/lib/planex/store';
import type { PlanexProject } from '@/lib/planex/types';
import { normalizarProyecto } from '@/lib/planex/model/factory';
import { crearProyectoClinica } from '@/lib/planex/templates/clinica';
import {
  CLAVES_SECCION,
  aplicarSeccion,
  extraerSeccion,
  huellaSeccion,
  nombreSeccion,
  type ClaveSeccion,
} from '@/lib/planex/secciones-sync';
import { guardarCachePlan, cargarCachePlan } from '@/lib/planex/io/persistence';
import { toast } from 'sonner';

// ----------------------------------------------------------------------------
// Estado observable por la interfaz
// ----------------------------------------------------------------------------

export type EstadoSeccion = 'limpio' | 'sucio' | 'guardando' | 'error' | 'conflicto';

export interface InfoConflicto {
  clave: ClaveSeccion;
  contenidoRemoto: Record<string, unknown>;
  versionRemota: number;
  autor: string;
  fecha: string;
}

interface SyncState {
  planId: string | null;
  plan: PlanRow | null;
  estados: Partial<Record<ClaveSeccion, EstadoSeccion>>;
  conflictos: Partial<Record<ClaveSeccion, InfoConflicto>>;
  guardadoEn: string | null;
  conectado: boolean;
  cargando: boolean;
  errorCarga: string | null;
  avisoSinConexion: boolean;
  tienePendientesLocal: boolean;

  fijar: (p: Partial<SyncState>) => void;
}

export const useSync = create<SyncState>((set) => ({
  planId: null,
  plan: null,
  estados: {},
  conflictos: {},
  guardadoEn: null,
  conectado: true,
  cargando: false,
  errorCarga: null,
  avisoSinConexion: false,
  tienePendientesLocal: false,
  fijar: (p) => set(p),
}));

// ----------------------------------------------------------------------------
// Estado interno del módulo (no reactivo)
// ----------------------------------------------------------------------------

let versiones: Partial<Record<ClaveSeccion, number>> = {};
let baseHuellas: Partial<Record<ClaveSeccion, string>> = {};
let filasId: Partial<Record<ClaveSeccion, string>> = {};
let enVuelo = new Set<ClaveSeccion>();
let temporizador: ReturnType<typeof setTimeout> | null = null;
let temporizadorTitulo: ReturnType<typeof setTimeout> | null = null;
let desuscribirMutaciones: (() => void) | null = null;
let canal: RealtimeChannel | null = null;
let reintento: ReturnType<typeof setInterval> | null = null;
let tituloPendiente = false;

const DEMORA_GUARDADO = 1400;
const DEMORA_TITULO = 1200;
const INTERVALO_REINTENTO = 20000;

function setEstado(clave: ClaveSeccion, estado: EstadoSeccion) {
  const { estados } = useSync.getState();
  if (estados[clave] === estado) return;
  useSync.getState().fijar({ estados: { ...estados, [clave]: estado } });
}

function setConflicto(clave: ClaveSeccion, info: InfoConflicto | null) {
  const { conflictos } = useSync.getState();
  const copia = { ...conflictos };
  if (info) copia[clave] = info;
  else delete copia[clave];
  useSync.getState().fijar({ conflictos: copia });
}

export function resumenConflictos(): InfoConflicto[] {
  return Object.values(useSync.getState().conflictos).filter((x): x is InfoConflicto => !!x);
}

/** Secciones con cambios aún no confirmados en el servidor. */
export function seccionesPendientes(): ClaveSeccion[] {
  const { estados, conflictos } = useSync.getState();
  return CLAVES_SECCION.filter((c) => estados[c] === 'sucio' || estados[c] === 'guardando' || estados[c] === 'error' || conflictos[c]);
}

export function hayConflictos(): boolean {
  return resumenConflictos().length > 0;
}

/** Contenido LOCAL vigente de una sección (para diálogos de comparación). */
export function extraerContenidoLocal(proyecto: PlanexProject, clave: ClaveSeccion): Record<string, unknown> {
  return extraerSeccion(proyecto, clave);
}

// ----------------------------------------------------------------------------
// Carga del plan compartido
// ----------------------------------------------------------------------------

function ensamblarProyecto(plan: PlanRow, filas: SeccionRow[], esqueleto: PlanexProject): PlanexProject {
  let p = esqueleto;
  for (const clave of CLAVES_SECCION) {
    const fila = filas.find((f) => f.section_key === clave);
    if (fila) p = aplicarSeccion(p, clave, fila.content);
  }
  p.id = plan.id;
  p.nombre = plan.title;
  p.creado = plan.created_at;
  p.actualizado = plan.updated_at;
  p.planex = {
    schemaVersion: plan.schema_version,
    app: 'PLANEX Cuba',
    generado: new Date().toISOString(),
    plantillaOrigen: plan.template_key,
  };
  return normalizarProyecto(p);
}

export async function cargarPlan(planId: string): Promise<{ ok: boolean; error?: string }> {
  const yaCargado =
    useSync.getState().planId === planId && useSync.getState().plan !== null && usePlanex.getState().proyecto.id === planId;
  if (yaCargado) {
    // Navegación interna (editor ↔ vista previa): se conserva el estado vivo
    // y NO se recarga el proyecto desde el servidor.
    return { ok: true };
  }
  detenerCanal();
  useSync.getState().fijar({ cargando: true, errorCarga: null, conflictos: {}, avisoSinConexion: false, tienePendientesLocal: false });
  try {
    const [plan, filas] = await Promise.all([obtenerPlan(planId), obtenerSecciones(planId)]);
    if (!plan) {
      useSync.getState().fijar({ cargando: false, errorCarga: 'El plan solicitado no existe o no está autorizado para su cuenta.' });
      return { ok: false, error: 'no_existe' };
    }
    let completas = filas;
    const faltantes = CLAVES_SECCION.filter((c) => !filas.some((f) => f.section_key === c));
    for (const clave of faltantes) {
      // Plan antiguo sin alguna de las claves: se crea la fila con el
      // contenido vigente del modelo local (esqueleto).
      const nueva = await crearSeccion(planId, clave, extraerSeccion(crearProyectoClinica(), clave));
      completas = [...completas, nueva];
    }

    versiones = {};
    baseHuellas = {};
    filasId = {};
    const estados: Partial<Record<ClaveSeccion, EstadoSeccion>> = {};
    for (const fila of completas) {
      const clave = fila.section_key as ClaveSeccion;
      versiones[clave] = fila.section_version;
      filasId[clave] = fila.id;
      estados[clave] = 'limpio';
    }

    const esqueleto = usePlanex.getState().proyecto;
    const proyecto = ensamblarProyecto(plan, completas, esqueleto);
    usePlanex.getState().fijarProyecto(proyecto);
    // Las huellas base se computan sobre la forma NORMALIZADA local: la
    // normalización rellena campos calculados que el contenido crudo del
    // servidor no incluye, y comparar contra el crudo provocaría guardados
    // espurios (y conflictos en cascada entre sesiones).
    for (const clave of CLAVES_SECCION) {
      baseHuellas[clave] = huellaSeccion(extraerSeccion(proyecto, clave));
    }
    const seccionActual = usePlanex.getState().seccion;
    if (!seccionActual || seccionActual === 'inicio') {
      usePlanex.getState().setSeccion('general');
    }

    useSync.getState().fijar({
      planId,
      plan,
      estados,
      conflictos: {},
      guardadoEn: null,
      cargando: false,
      conectado: true,
      tienePendientesLocal: revisarCacheLocal(planId, plan.updated_at),
    });

    suscribirMutaciones();
    await iniciarCanal(planId);
    return { ok: true };
  } catch (e) {
    // Sin conexión al cargar: caché local de recuperación (nunca presentada
    // como guardada en el servidor).
    const cache = cargarCachePlan(planId);
    let conCache = false;
    if (cache) {
      const proyecto = normalizarProyecto(cache);
      usePlanex.getState().fijarProyecto(proyecto);
      conCache = true;
    }
    useSync.getState().fijar({
      planId,
      plan: null,
      cargando: false,
      conectado: false,
      avisoSinConexion: true,
      errorCarga: null,
      tienePendientesLocal: conCache,
    });
    return {
      ok: false,
      error: `No se pudo cargar el plan desde Supabase: ${(e as Error).message}. ` +
        (conCache ? 'Se muestra la copia local de trabajo; los cambios NO se confirman en el servidor hasta restablecerse la conexión.' : ''),
    };
  }
}

/** Compara la caché local con la versión del servidor para ofrecer recuperación. */
function revisarCacheLocal(planId: string, actualizadoServidor: string): boolean {
  const cache = cargarCachePlan(planId);
  if (!cache) return false;
  try {
    if (cache.id === planId && (cache.actualizado ?? '') > actualizadoServidor) {
      return true; // hay trabajo local posterior a lo guardado en el servidor
    }
  } catch {
    return false;
  }
  return false;
}

/** Aplica la copia local como cambios pendientes (nunca se guarda en silencio). */
export function recuperarCambiosLocales(): void {
  const planId = useSync.getState().planId;
  if (!planId) return;
  const cache = cargarCachePlan(planId);
  if (!cache) return;
  const proyecto = normalizarProyecto(cache);
  usePlanex.getState().fijarProyecto(proyecto);
  useSync.getState().fijar({ tienePendientesLocal: false });
  // Las huellas difieren del servidor: el ciclo de autoguardado normal
  // detectará las secciones cambiadas y las enviará CON control de versiones.
  programarGuardado();
  toast.info('Cambios locales restaurados', { description: 'Se enviarán al servidor con control de conflictos.' });
}

// ----------------------------------------------------------------------------
// Detección de cambios y programación del guardado
// ----------------------------------------------------------------------------

function suscribirMutaciones() {
  if (desuscribirMutaciones) return;
  desuscribirMutaciones = usePlanex.subscribe((st, prev) => {
    if (st.proyecto !== prev.proyecto) programarGuardado();
  });
}

function programarGuardado() {
  if (!useSync.getState().planId) return;
  const proyecto = usePlanex.getState().proyecto;
  const { estados, conflictos } = useSync.getState();
  let hayCambiosSecciones = false;
  for (const clave of CLAVES_SECCION) {
    const huella = huellaSeccion(extraerSeccion(proyecto, clave));
    if (huella !== baseHuellas[clave]) {
      hayCambiosSecciones = true;
      if (!conflictos[clave] && !enVuelo.has(clave)) setEstado(clave, 'sucio');
    }
  }
  // Caché local de trabajo (recuperación ante cierres inesperados).
  programarCache();

  if (hayCambiosSecciones) {
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      temporizador = null;
      void sincronizarAhora();
    }, DEMORA_GUARDADO);
  }

  // El título del plan (metadato de la fila plans) va por su propio debounce.
  const plan = useSync.getState().plan;
  if (plan && proyecto.nombre !== plan.title) {
    tituloPendiente = true;
    if (temporizadorTitulo) clearTimeout(temporizadorTitulo);
    temporizadorTitulo = setTimeout(() => {
      temporizadorTitulo = null;
      void enviarTitulo();
    }, DEMORA_TITULO);
  }
}

let temporizadorCache: ReturnType<typeof setTimeout> | null = null;
function programarCache() {
  if (temporizadorCache) return;
  temporizadorCache = setTimeout(() => {
    temporizadorCache = null;
    const planId = useSync.getState().planId;
    if (planId) guardarCachePlan(planId, usePlanex.getState().proyecto);
  }, 800);
}

async function enviarTitulo() {
  const planId = useSync.getState().planId;
  const proyecto = usePlanex.getState().proyecto;
  if (!planId || !tituloPendiente) return;
  tituloPendiente = false;
  const { plan } = useSync.getState();
  if (plan && proyecto.nombre !== plan.title) {
    const ok = await actualizarTituloPlan(planId, proyecto.nombre);
    if (!ok) {
      tituloPendiente = true;
      marcarDesconexion('No se pudo actualizar el título del plan.');
    }
  }
}

// ----------------------------------------------------------------------------
// Envío de secciones (concurrencia optimista)
// ----------------------------------------------------------------------------

export async function sincronizarAhora(): Promise<{ ok: boolean; conflictos: number; errores: number }> {
  const planId = useSync.getState().planId;
  if (!planId) return { ok: true, conflictos: 0, errores: 0 };
  const proyecto = usePlanex.getState().proyecto;
  const { estados, conflictos } = useSync.getState();

  let conflictosNuevos = 0;
  let errores = 0;

  for (const clave of CLAVES_SECCION) {
    if (enVuelo.has(clave)) continue;
    if (conflictos[clave]) continue; // a la espera de decisión explícita del usuario
    const huella = huellaSeccion(extraerSeccion(proyecto, clave));
    if (huella === baseHuellas[clave]) {
      if (estados[clave] === 'sucio') setEstado(clave, 'limpio');
      continue;
    }
    if (estados[clave] === 'guardando') continue;

    enVuelo.add(clave);
    setEstado(clave, 'guardando');
    const contenido = extraerSeccion(proyecto, clave);
    const huellaEnviada = huella;
    const versionEsperada = versiones[clave] ?? 1;
    let res: Awaited<ReturnType<typeof guardarSeccion>>;
    try {
      res = await guardarSeccion(planId, clave, contenido, versionEsperada);
    } catch (e) {
      res = { aplicado: false, error: `Error inesperado al guardar: ${(e as Error).message}` };
    } finally {
      enVuelo.delete(clave);
    }

    if (res.aplicado) {
      versiones[clave] = res.version ?? versionEsperada;
      baseHuellas[clave] = huellaEnviada;
      // ¿El usuario siguió escribiendo mientras se guardaba?
      const huellaActual = huellaSeccion(extraerSeccion(usePlanex.getState().proyecto, clave));
      if (huellaActual === huellaEnviada) {
        setEstado(clave, 'limpio');
        setConflicto(clave, null);
      } else {
        setEstado(clave, 'sucio');
      }
      useSync.getState().fijar({ guardadoEn: new Date().toISOString(), conectado: true, avisoSinConexion: false });
    } else if (res.conflicto) {
      await examinarConflicto(clave);
      conflictosNuevos++;
    } else {
      setEstado(clave, 'error');
      errores++;
      marcarDesconexion(res.error ?? 'Error de red al guardar.');
    }
  }

  await enviarTitulo();
  return { ok: errores === 0, conflictos: conflictosNuevos, errores };
}

/** Recupera la fila persistida y decide: eco propio o conflicto real. */
async function examinarConflicto(clave: ClaveSeccion): Promise<void> {
  const planId = useSync.getState().planId!;
  const versionConocida = versiones[clave] ?? 0; // capturada ANTES de la lectura
  const filas = await obtenerSecciones(planId);
  const fila = filas.find((f) => f.section_key === clave);
  if (!fila) {
    setEstado(clave, 'sucio');
    return;
  }
  // Si la versión conocida cambió mientras se leía la fila (p. ej. el
  // usuario resolvió el conflicto explícitamente o un guardado posterior
  // avanzó la versión), este examen es antiguo: descartarlo sin reabrir.
  if ((versiones[clave] ?? 0) !== versionConocida) return;
  const myId = useAuth.getState().usuario?.id;
  versiones[clave] = fila.section_version;
  filasId[clave] = fila.id;

  if (fila.updated_by && fila.updated_by === myId) {
    // Eco propio (p. ej. evento perdido): adoptar la versión y reintentar.
    baseHuellas[clave] = huellaSeccion(fila.content);
    setEstado(clave, 'sucio');
    programarGuardado();
    return;
  }

  setEstado(clave, 'conflicto');
  setConflicto(clave, {
    clave,
    contenidoRemoto: fila.content,
    versionRemota: fila.section_version,
    autor: fila.updated_by_name ?? 'otro colaborador',
    fecha: fila.updated_at,
  });
  toast.warning(`Conflicto de edición en «${nombreSeccion(clave)}»`, {
    description: `${fila.updated_by_name ?? 'Otro colaborador'} guardó esta sección mientras usted la editaba. Revise las diferencias.`,
    duration: 9000,
  });
}

function marcarDesconexion(mensaje: string) {
  const conectado = typeof navigator !== 'undefined' ? navigator.onLine : true;
  useSync.getState().fijar({ conectado, avisoSinConexion: !conectado, errorCarga: conectado ? null : mensaje });
  if (!conectado) {
    toast.error('Sin conexión', { description: 'Los cambios se conservan localmente y se reintentarán automáticamente.', duration: 6000 });
  }
}

// ----------------------------------------------------------------------------
// Resolución de conflictos
// ----------------------------------------------------------------------------

export type AccionConflicto = 'remoto' | 'copia_y_remoto' | 'sobrescribir';

export async function resolverConflicto(clave: ClaveSeccion, accion: AccionConflicto): Promise<void> {
  const planId = useSync.getState().planId;
  const info = useSync.getState().conflictos[clave];
  if (!planId || !info) return;

  if (accion === 'copia_y_remoto' || accion === 'sobrescribir') {
    if (accion === 'copia_y_remoto') {
      // Instantánea de seguridad con el contenido local antes de sustituirlo.
      const proyecto = usePlanex.getState().proyecto;
      await sincronizarSeccionesAjenas();
      try {
        await crearInstantanea(
          planId,
          `Copia local de respaldo — conflicto en «${nombreSeccion(clave)}»`,
          construirSnapshot(proyecto, useSync.getState().plan),
        );
      } catch {
        /* si la copia falla, se avisa pero se continúa */
      }
    }
  }

  if (accion === 'remoto' || accion === 'copia_y_remoto') {
    aplicarRemoto(clave, info.contenidoRemoto, info.versionRemota);
    toast.success(`Sección «${nombreSeccion(clave)}» actualizada con la versión de ${info.autor}.`);
  } else {
    // Sobrescritura EXPLÍCITA: se escribe sobre la versión remota conocida,
    // creando una versión nueva; nunca en silencio. El guardado se fuerza de
    // inmediato (sin esperar al debounce) y se libera cualquier envío
    // anterior atascado.
    versiones[clave] = info.versionRemota;
    enVuelo.delete(clave);
    setConflicto(clave, null);
    setEstado(clave, 'sucio');
    toast.info(`Sus cambios en «${nombreSeccion(clave)}» se guardarán sobre la versión de ${info.autor}.`);
    void sincronizarAhora();
  }
  if (accion === 'remoto' || accion === 'copia_y_remoto') {
    setConflicto(clave, null);
  }
}

/** Guarda las secciones sin conflicto antes de hacer una instantánea. */
async function sincronizarSeccionesAjenas() {
  await sincronizarAhora();
}

/** Aplica el contenido remoto a la sesión local (sin recargar la app). */
function aplicarRemoto(clave: ClaveSeccion, contenido: Record<string, unknown>, versionRemota: number) {
  const actual = usePlanex.getState().proyecto;
  const aplicado = aplicarSeccion(actual, clave, contenido);
  const nuevo = normalizarProyecto(aplicado);
  usePlanex.getState().fijarProyecto(nuevo);
  versiones[clave] = versionRemota;
  baseHuellas[clave] = huellaSeccion(extraerSeccion(nuevo, clave));
  setEstado(clave, 'limpio');
}

// ----------------------------------------------------------------------------
// Realtime (postgres_changes con autorización RLS)
// ----------------------------------------------------------------------------

export async function iniciarCanal(planId: string): Promise<void> {
  detenerCanal();
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  if (data.session?.access_token) sb.realtime.setAuth(data.session.access_token);

  const miId = useAuth.getState().usuario?.id ?? '';
  canal = sb
    .channel(`planex-plan-${planId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'plan_sections', filter: `plan_id=eq.${planId}` },
      (carga: { new: SeccionRow }) => {
        void manejarEventoSeccion(carga.new, miId);
      },
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'plan_sections', filter: `plan_id=eq.${planId}` },
      (carga: { new: SeccionRow }) => {
        void manejarEventoSeccion(carga.new, miId);
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'plans', filter: `id=eq.${planId}` },
      (carga: { new: PlanRow }) => {
        manejarEventoPlan(carga.new);
      },
    )
    .subscribe((estado: string) => {
      if (estado === 'SUBSCRIBED') {
        useSync.getState().fijar({ conectado: true, avisoSinConexion: false });
      } else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT' || estado === 'CLOSED') {
        if (useSync.getState().planId === planId) {
          useSync.getState().fijar({ conectado: false });
        }
      }
    });

  if (!reintento) {
    reintento = setInterval(() => {
      const { planId: pid, conectado } = useSync.getState();
      if (!pid) return;
      if (!conectado || seccionesPendientes().some((c) => useSync.getState().estados[c] === 'error')) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        void sincronizarAhora();
      }
    }, INTERVALO_REINTENTO);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', alVolverLinea);
    window.addEventListener('offline', alCaerLinea);
  }
}

function alCaerLinea() {
  useSync.getState().fijar({ conectado: false, avisoSinConexion: true });
  toast.error('Conexión perdida', { description: 'Sus cambios se conservan localmente; no se marcarán como guardados en el servidor.', duration: 8000 });
}

function alVolverLinea() {
  useSync.getState().fijar({ conectado: true, avisoSinConexion: false });
  toast.success('Conexión restablecida', { description: 'Comprobando si el plan cambió en el servidor…' });
  void sincronizarAhora();
}

async function manejarEventoSeccion(fila: SeccionRow, miId: string): Promise<void> {
  const clave = fila.section_key as ClaveSeccion;
  if (!CLAVES_SECCION.includes(clave)) return;
  if (!useSync.getState().planId) return;

  if (fila.updated_by && fila.updated_by === miId) {
    // Eco de la propia escritura: adoptar la versión y seguir.
    versiones[clave] = fila.section_version;
    baseHuellas[clave] = huellaSeccion(fila.content);
    return;
  }

  // Guarda de antigüedad: los eventos con versión ya conocida (p. ej.
  // fotogramas amortiguados por el socket durante una desconexión) no deben
  // reabrir conflictos ni reaplicar contenido antiguo.
  if ((fila.section_version ?? 0) <= (versiones[clave] ?? 0)) return;

  const { estados, conflictos } = useSync.getState();
  const huellaLocal = huellaSeccion(extraerSeccion(usePlanex.getState().proyecto, clave));
  const pendienteLocal = huellaLocal !== baseHuellas[clave] || estados[clave] === 'sucio' || estados[clave] === 'guardando' || enVuelo.has(clave);

  if (pendienteLocal || conflictos[clave]) {
    // Cambio remoto mientras se edita: no pisar el trabajo local.
    versiones[clave] = fila.section_version;
    if (!conflictos[clave]) {
      setEstado(clave, 'conflicto');
      setConflicto(clave, {
        clave,
        contenidoRemoto: fila.content,
        versionRemota: fila.section_version,
        autor: fila.updated_by_name ?? 'otro colaborador',
        fecha: fila.updated_at,
      });
      toast.warning(`${fila.updated_by_name ?? 'Otro colaborador'} actualizó «${nombreSeccion(clave)}»`, {
        description: 'Su edición local no guardada se conserva; revise el conflicto antes de continuar.',
        duration: 9000,
      });
    }
    return;
  }

  // Sin trabajo local pendiente: aplicar el cambio y recalcular (el motor
  // recalcula las dependencias en el próximo render; el proyecto completo se
  // reensambla en el almacén).
  aplicarRemoto(clave, fila.content, fila.section_version);
  toast.info(`«${nombreSeccion(clave)}» actualizada por ${fila.updated_by_name ?? 'otro colaborador'}`, { duration: 5000 });
}

function manejarEventoPlan(plan: PlanRow): void {
  const actual = useSync.getState().plan;
  if (!actual) return;
  if (plan.revision === actual.revision && plan.updated_at === actual.updated_at) return;
  const tituloCambio = plan.title !== actual.title;
  const estadoCambio = plan.status !== actual.status;
  useSync.getState().fijar({ plan });

  if (tituloCambio && !tituloPendiente) {
    const proyecto = usePlanex.getState().proyecto;
    const nuevo = { ...proyecto, nombre: plan.title };
    usePlanex.getState().fijarProyecto(nuevo);
  }
  if (estadoCambio) {
    toast.info(`Estado del plan: ${plan.status === 'en_revision' ? 'en revisión' : plan.status === 'finalizado' ? 'finalizado' : 'borrador'}`, {
      description: `Actualizado por ${plan.updated_by_name ?? 'otro colaborador'}.`,
      duration: 6000,
    });
  }
}

export function detenerCanal(): void {
  if (canal) {
    try {
      void supabase().removeChannel(canal);
    } catch {
      /* canal ya cerrado */
    }
    canal = null;
  }
}

/** Descarga total al cerrar sesión o salir del plan. */
export function descargarPlan(): void {
  detenerCanal();
  if (temporizador) clearTimeout(temporizador);
  if (temporizadorTitulo) clearTimeout(temporizadorTitulo);
  temporizador = null;
  temporizadorTitulo = null;
  tituloPendiente = false;
  enVuelo = new Set();
  versiones = {};
  baseHuellas = {};
  filasId = {};
  if (desuscribirMutaciones) {
    desuscribirMutaciones();
    desuscribirMutaciones = null;
  }
  if (reintento) {
    clearInterval(reintento);
    reintento = null;
  }
  useSync.getState().fijar({
    planId: null,
    plan: null,
    estados: {},
    conflictos: {},
    guardadoEn: null,
    tienePendientesLocal: false,
    errorCarga: null,
    cargando: false,
  });
}

// ----------------------------------------------------------------------------
// Versiones e historial
// ----------------------------------------------------------------------------

export function construirSnapshot(proyecto: PlanexProject, plan: PlanRow | null): VersionRow['snapshot'] {
  const secciones: Record<string, unknown> = {};
  for (const clave of CLAVES_SECCION) {
    secciones[clave] = extraerSeccion(proyecto, clave);
  }
  return {
    formato: 'planex.version.1',
    generado: new Date().toISOString(),
    meta: plan
      ? { title: plan.title, template_key: plan.template_key, status: plan.status, revision: plan.revision, schema_version: plan.schema_version }
      : { title: proyecto.nombre },
    secciones,
  };
}

export async function guardarVersionActual(descripcion: string): Promise<{ ok: boolean; error?: string }> {
  const planId = useSync.getState().planId;
  if (!planId) return { ok: false, error: 'No hay un plan abierto.' };
  const previo = await sincronizarAhora();
  if (previo.conflictos > 0) {
    return { ok: false, error: 'Hay conflictos de edición sin resolver. Resuélvalos antes de guardar la versión.' };
  }
  const proyecto = usePlanex.getState().proyecto;
  try {
    await crearInstantanea(planId, descripcion || 'Versión guardada', construirSnapshot(proyecto, useSync.getState().plan));
    await registrarActividad(planId, 'version_guardada', null, descripcion || 'Versión guardada');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function traerVersiones(): Promise<VersionRow[]> {
  const planId = useSync.getState().planId;
  if (!planId) return [];
  return listarVersiones(planId);
}

export interface ResultadoRestauracion {
  ok: boolean;
  error?: string;
  descripcion?: string;
}

export async function restaurarVersion(versionId: string): Promise<ResultadoRestauracion> {
  const planId = useSync.getState().planId;
  if (!planId) return { ok: false, error: 'No hay un plan abierto.' };
  try {
    const version = await obtenerVersion(versionId);
    if (!version || version.plan_id !== planId) return { ok: false, error: 'La versión solicitada no pertenece a este plan.' };

    // 1) No restaurar con conflictos pendientes ni guardar por encima de nadie.
    const previo = await sincronizarAhora();
    if (previo.conflictos > 0) {
      return { ok: false, error: 'Hay conflictos de edición sin resolver. Resuélvalos antes de restaurar la versión.' };
    }

    // 2) Instantánea de seguridad con el estado ACTUAL (el historial nunca se
    //    borra; restaurar no elimina cambios posteriores, quedan en el historial).
    const proyectoActual = usePlanex.getState().proyecto;
    await crearInstantanea(
      planId,
      `Copia de seguridad automática antes de restaurar la versión ${version.version_number}`,
      construirSnapshot(proyectoActual, useSync.getState().plan),
    );

    // 3) Aplicar el contenido de la versión con control de concurrencia.
    const filas = await obtenerSecciones(planId);
    const seccionesDestino = (version.snapshot?.secciones ?? {}) as Record<ClaveSeccion, Record<string, unknown>>;
    let base = proyectoActual;
    const nuevasVersiones: Partial<Record<ClaveSeccion, number>> = {};

    for (const clave of CLAVES_SECCION) {
      const contenidoDestino = seccionesDestino[clave];
      if (!contenidoDestino) continue;
      const actual = filas.find((f) => f.section_key === clave);
      if (!actual) continue;
      if (huellaSeccion(contenidoDestino) === huellaSeccion(actual.content)) {
        nuevasVersiones[clave] = actual.section_version;
        continue;
      }
      let intento = 0;
      let versionActual = actual.section_version;
      while (intento < 3) {
        const res = await guardarSeccion(planId, clave, contenidoDestino, versionActual);
        if (res.aplicado) {
          nuevasVersiones[clave] = res.version ?? versionActual + 1;
          break;
        }
        if (!res.conflicto) throw new Error(res.error ?? 'Error de red restaurando la versión.');
        const fresco = (await obtenerSecciones(planId)).find((f) => f.section_key === clave);
        if (!fresco) throw new Error('La sección desapareció mientras se restauraba.');
        versionActual = fresco.section_version;
        intento++;
      }
      if (intento >= 3) {
        return { ok: false, error: `Otro colaborador está guardando la sección «${nombreSeccion(clave)}» en este momento. Intente la restauración en unos segundos.` };
      }
      base = aplicarSeccion(base, clave, contenidoDestino);
    }

    // 4) Título de la versión restaurada.
    const metaDestino = (version.snapshot?.meta ?? null) as { title?: string } | null;
    if (metaDestino?.title) {
      const okTitulo = await actualizarTituloPlan(planId, metaDestino.title);
      if (okTitulo) base = { ...base, nombre: metaDestino.title };
    }

    // 5) Reflejar en la sesión local (sin recargar la app) y registrar.
    base = { ...base, actualizado: new Date().toISOString() };
    const restaurado = normalizarProyecto(base);
    usePlanex.getState().fijarProyecto(restaurado);
    versiones = { ...versiones, ...nuevasVersiones };
    for (const clave of CLAVES_SECCION) {
      baseHuellas[clave] = huellaSeccion(extraerSeccion(restaurado, clave));
    }
    useSync.getState().fijar({ estados: {}, conflictos: {}, guardadoEn: new Date().toISOString() });
    await registrarActividad(planId, 'version_restaurada', null, `Restaurada la versión ${version.version_number}: ${version.description || 'sin descripción'}`);
    return { ok: true, descripcion: version.description };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ----------------------------------------------------------------------------
// Utilidades para la UI
// ----------------------------------------------------------------------------

export type ResumenSincronizacion =
  | { tipo: 'conflicto'; texto: string }
  | { tipo: 'error'; texto: string }
  | { tipo: 'sin_conexion'; texto: string }
  | { tipo: 'guardando'; texto: string }
  | { tipo: 'pendiente'; texto: string }
  | { tipo: 'guardado'; texto: string };

export function resumenSincronizacion(): ResumenSincronizacion {
  const { estados, conflictos, guardadoEn, conectado, cargando } = useSync.getState();
  if (cargando) return { tipo: 'guardando', texto: 'Cargando el plan compartido…' };
  const nConflictos = Object.keys(conflictos).length;
  if (nConflictos > 0) return { tipo: 'conflicto', texto: `${nConflictos} sección(es) con conflicto de edición` };
  const lista = Object.values(estados);
  if (lista.includes('error')) return { tipo: 'error', texto: 'Error al guardar; se conserva su trabajo local' };
  if (!conectado) return { tipo: 'sin_conexion', texto: 'Sin conexión: cambios pendientes en este navegador' };
  if (lista.includes('guardando')) return { tipo: 'guardando', texto: 'Guardando en Supabase…' };
  if (lista.includes('sucio')) return { tipo: 'pendiente', texto: 'Cambios pendientes de guardar' };
  if (guardadoEn) return { tipo: 'guardado', texto: `Guardado ${new Date(guardadoEn).toLocaleTimeString('es-ES')}` };
  return { tipo: 'guardado', texto: 'Sincronizado con Supabase' };
}

// La diferencia de contenidos (hojas JSON) vive ahora en un módulo PURO
// compartido por la comparación de conflictos y de versiones:
// src/lib/planex/diferencias.ts. Se reexporta aquí para no romper los
// importaciones existentes.
export { diferenciarJSON, type LineaDiff } from '@/lib/planex/diferencias';

export { actualizarEstadoPlan };
