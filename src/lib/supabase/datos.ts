// ============================================================================
// PLANEX — Acceso a datos de Supabase (PostgREST con la sesión del usuario).
//
// Todas las operaciones pasan por RLS en el servidor. Ninguna función de este
// módulo usa claves privilegiadas: la SPA solo posee la clave publicable.
// ============================================================================

import { supabase } from './cliente';
import type { ActividadRow, ComentarioRow, PlanRow, SeccionRow, VersionRow } from './tipos';
import { CLAVES_SECCION, extraerSecciones, type ClaveSeccion } from '@/lib/planex/secciones-sync';
import type { PlanexProject } from '@/lib/planex/types';
import { SCHEMA_VERSION } from '@/lib/planex/types';

// ----------------------------------------------------------------------------
// Planes
// ----------------------------------------------------------------------------

export async function listarProyectos(workspaceId: string): Promise<PlanRow[]> {
  const { data, error } = await supabase()
    .from('plans')
    .select('id,workspace_id,title,template_key,status,created_by,updated_by,updated_by_name,created_at,updated_at,schema_version,revision')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`No se pudieron listar los proyectos: ${error.message}`);
  return data ?? [];
}

export async function obtenerPlan(planId: string): Promise<PlanRow | null> {
  const { data, error } = await supabase()
    .from('plans')
    .select('id,workspace_id,title,template_key,status,created_by,updated_by,updated_by_name,created_at,updated_at,schema_version,revision')
    .eq('id', planId)
    .maybeSingle<PlanRow>();
  if (error) throw new Error(`No se pudo leer el plan: ${error.message}`);
  return data ?? null;
}

export async function actualizarTituloPlan(planId: string, titulo: string): Promise<boolean> {
  const { error } = await supabase().from('plans').update({ title: titulo }).eq('id', planId);
  return !error;
}

export async function actualizarEstadoPlan(planId: string, estado: PlanRow['status']): Promise<boolean> {
  const { error } = await supabase().from('plans').update({ status: estado }).eq('id', planId);
  return !error;
}

// ----------------------------------------------------------------------------
// Creación (plantilla → plan compartido) y duplicado
// ----------------------------------------------------------------------------

export async function crearPlanCompartido(
  workspaceId: string,
  titulo: string,
  plantilla: 'clinica' | 'default',
  proyecto: PlanexProject,
): Promise<PlanRow> {
  const sb = supabase();
  const { data: plan, error } = await sb
    .from('plans')
    .insert({ workspace_id: workspaceId, title: titulo, template_key: plantilla, schema_version: SCHEMA_VERSION })
    .select()
    .single<PlanRow>();
  if (error || !plan) throw new Error(`No se pudo crear el plan en el espacio compartido: ${error?.message ?? 'respuesta vacía'}`);

  const secciones = extraerSecciones(proyecto);
  const filas = CLAVES_SECCION.map((clave) => ({
    plan_id: plan.id,
    section_key: clave,
    content: secciones[clave],
  }));
  const { error: errSecciones } = await sb.from('plan_sections').insert(filas);
  if (errSecciones) throw new Error(`El plan se creó pero no se pudieron guardar sus secciones: ${errSecciones.message}`);

  await registrarActividad(plan.id, 'plan_creado', null, `Plantilla: ${plantilla === 'clinica' ? 'Clínica Estomatológica (ejemplo ilustrativo)' : 'Default'}`);
  return plan;
}

export async function duplicarPlanCompartido(plan: PlanRow, titulo: string): Promise<PlanRow> {
  const sb = supabase();
  const { data: secciones } = await sb.from('plan_sections').select('section_key,content').eq('plan_id', plan.id);
  const { data: copia, error } = await sb
    .from('plans')
    .insert({ workspace_id: plan.workspace_id, title: titulo, template_key: plan.template_key, schema_version: plan.schema_version })
    .select()
    .single<PlanRow>();
  if (error || !copia) throw new Error(`No se pudo duplicar el plan: ${error?.message ?? 'respuesta vacía'}`);
  if (secciones && secciones.length > 0) {
    const filas = (secciones as Pick<SeccionRow, 'section_key' | 'content'>[]).map((s) => ({
      plan_id: copia.id,
      section_key: s.section_key,
      content: s.content,
    }));
    const { error: errSec } = await sb.from('plan_sections').insert(filas);
    if (errSec) throw new Error(`La copia se creó pero no se pudieron copiar las secciones: ${errSec.message}`);
  }
  await registrarActividad(copia.id, 'plan_creado', null, `Duplicado de «${plan.title}»`);
  return copia;
}

// ----------------------------------------------------------------------------
// Secciones (control de concurrencia optimista por section_version)
// ----------------------------------------------------------------------------

export async function obtenerSecciones(planId: string): Promise<SeccionRow[]> {
  const { data, error } = await supabase()
    .from('plan_sections')
    .select('id,plan_id,section_key,content,section_version,updated_by,updated_by_name,updated_at')
    .eq('plan_id', planId)
    .order('section_key');
  if (error) throw new Error(`No se pudieron leer las secciones del plan: ${error.message}`);
  return data ?? [];
}

export interface ResultadoGuardado {
  /** true = la escritura se aplicó. */
  aplicado: boolean;
  version?: number;
  updated_at?: string;
  updated_by?: string | null;
  /** Si aplicado=false y conflicto=true, otro colaborador guardó antes. */
  conflicto?: boolean;
  error?: string;
}

/**
 * Guarda una sección indicando la versión sobre la que se escribe
 * (control de concurrencia): si otro colaborador guardó antes, el servidor
 * mantiene su versión y esta escritura devuelve conflicto sin tocar nada.
 */
export async function guardarSeccion(
  planId: string,
  clave: ClaveSeccion,
  contenido: Record<string, unknown>,
  versionEsperada: number,
): Promise<ResultadoGuardado> {
  let data: { section_version: number; updated_at: string; updated_by: string | null }[] | null = null;
  let error: { message: string } | null = null;
  try {
    const r = await supabase()
      .from('plan_sections')
      .update({ content: contenido })
      .eq('plan_id', planId)
      .eq('section_key', clave)
      .eq('section_version', versionEsperada)
      .select('section_version,updated_at,updated_by');
    data = r.data as typeof data;
    error = r.error;
  } catch (e) {
    // Fallo de red (sin conexión): NUNCA lanzar, o el remitente quedaría
    // atascado con la sección «en vuelo» para siempre.
    return { aplicado: false, error: `Error de red al guardar: ${(e as Error).message}` };
  }
  if (error) return { aplicado: false, error: error.message };
  const fila = (data ?? [])[0];
  if (!fila) return { aplicado: false, conflicto: true };
  return { aplicado: true, version: fila.section_version, updated_at: fila.updated_at, updated_by: fila.updated_by };
}

export async function crearSeccion(planId: string, clave: ClaveSeccion, contenido: Record<string, unknown>): Promise<SeccionRow> {
  const { data, error } = await supabase()
    .from('plan_sections')
    .insert({ plan_id: planId, section_key: clave, content: contenido })
    .select('id,plan_id,section_key,content,section_version,updated_by,updated_by_name,updated_at')
    .single<SeccionRow>();
  if (error || !data) throw new Error(`No se pudo crear la sección «${clave}»: ${error?.message ?? 'respuesta vacía'}`);
  return data;
}

// ----------------------------------------------------------------------------
// Versiones (instantáneas inmutables) e historial
// ----------------------------------------------------------------------------

export async function listarVersiones(planId: string): Promise<VersionRow[]> {
  const { data, error } = await supabase()
    .from('plan_versions')
    .select('id,plan_id,version_number,created_by,created_by_name,description,snapshot,created_at')
    .eq('plan_id', planId)
    .order('version_number', { ascending: false });
  if (error) throw new Error(`No se pudo leer el historial de versiones: ${error.message}`);
  return data ?? [];
}

export async function crearInstantanea(
  planId: string,
  descripcion: string,
  snapshot: VersionRow['snapshot'],
): Promise<VersionRow> {
  const sb = supabase();
  // Número de versión = máximo + 1 (reintentos ante carrera por el UNIQUE).
  for (let intento = 0; intento < 4; intento++) {
    const { data: ultima } = await sb
      .from('plan_versions')
      .select('version_number')
      .eq('plan_id', planId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle<{ version_number: number }>();
    const numero = (ultima?.version_number ?? 0) + 1 + intento;
    const { data, error } = await sb
      .from('plan_versions')
      .insert({ plan_id: planId, version_number: numero, description: descripcion, snapshot })
      .select('id,plan_id,version_number,created_by,created_by_name,description,snapshot,created_at')
      .single<VersionRow>();
    if (data) return data;
    if (error && !/duplicate key/i.test(error.message)) throw new Error(`No se pudo guardar la versión: ${error.message}`);
  }
  throw new Error('No se pudo asignar un número de versión (inténtelo de nuevo).');
}

export async function obtenerVersion(versionId: string): Promise<VersionRow | null> {
  const { data, error } = await supabase()
    .from('plan_versions')
    .select('id,plan_id,version_number,created_by,created_by_name,description,snapshot,created_at')
    .eq('id', versionId)
    .maybeSingle<VersionRow>();
  if (error) throw new Error(`No se pudo leer la versión: ${error.message}`);
  return data ?? null;
}

// ----------------------------------------------------------------------------
// Actividad
// ----------------------------------------------------------------------------

export async function listarActividad(planId: string, limite = 60): Promise<ActividadRow[]> {
  const { data, error } = await supabase()
    .from('plan_activity_log')
    .select('id,plan_id,section_key,operation,field_path,user_id,user_name,created_at')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw new Error(`No se pudo leer la actividad: ${error.message}`);
  return data ?? [];
}

export async function registrarActividad(
  planId: string,
  operacion: string,
  claveSeccion: string | null,
  detalle: string,
): Promise<void> {
  const { error } = await supabase()
    .from('plan_activity_log')
    .insert({ plan_id: planId, operation: operacion, section_key: claveSeccion, field_path: detalle });
  if (error) throw new Error(`No se pudo registrar la actividad: ${error.message}`);
}

// ----------------------------------------------------------------------------
// Comentarios y asignaciones (no alteran datos financieros)
// ----------------------------------------------------------------------------

export async function listarComentarios(planId: string): Promise<ComentarioRow[]> {
  const { data, error } = await supabase()
    .from('plan_comments')
    .select('id,plan_id,section_key,content,user_id,user_name,created_at')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`No se pudieron leer los comentarios: ${error.message}`);
  return data ?? [];
}

export async function agregarComentario(planId: string, claveSeccion: ClaveSeccion | null, texto: string): Promise<ComentarioRow> {
  const { data, error } = await supabase()
    .from('plan_comments')
    .insert({ plan_id: planId, section_key: claveSeccion, content: texto })
    .select('id,plan_id,section_key,content,user_id,user_name,created_at')
    .single<ComentarioRow>();
  if (error || !data) throw new Error(`No se pudo publicar el comentario: ${error?.message ?? 'respuesta vacía'}`);
  return data;
}

export async function eliminarComentario(id: string): Promise<boolean> {
  const { error } = await supabase().from('plan_comments').delete().eq('id', id);
  return !error;
}
