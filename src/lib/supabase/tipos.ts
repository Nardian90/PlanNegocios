// ============================================================================
// PLANEX — Tipos de las tablas de Supabase (solo las usadas por la SPA).
// ============================================================================

export interface PerfilRow {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface MembresiaRow {
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  created_at: string;
  workspaces?: { id: string; name: string; description: string } | null;
}

export interface PlanRow {
  id: string;
  workspace_id: string;
  title: string;
  template_key: 'clinica' | 'default' | 'centro';
  status: 'borrador' | 'en_revision' | 'finalizado';
  created_by: string;
  updated_by: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
  schema_version: string;
  revision: number;
}

export interface SeccionRow {
  id: string;
  plan_id: string;
  section_key: string;
  content: Record<string, unknown>;
  section_version: number;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: string;
}

/** Instantánea guardada en plan_versions (formato planex.version.1). */
export interface SnapshotPlanex {
  formato?: string;
  generado?: string;
  meta?: {
    title?: string;
    template_key?: string;
    status?: string;
    revision?: number;
    schema_version?: string;
  };
  secciones?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface VersionRow {
  id: string;
  plan_id: string;
  version_number: number;
  created_by: string;
  created_by_name: string | null;
  description: string;
  snapshot: SnapshotPlanex;
  created_at: string;
}

export interface ActividadRow {
  id: string;
  plan_id: string;
  section_key: string | null;
  operation: string;
  field_path: string | null;
  user_id: string;
  user_name: string | null;
  created_at: string;
}

export interface ComentarioRow {
  id: string;
  plan_id: string;
  section_key: string | null;
  content: string;
  user_id: string;
  user_name: string | null;
  created_at: string;
}

export interface AsignacionRow {
  id: string;
  plan_id: string;
  section_key: string;
  user_id: string;
  user_name: string | null;
  created_at: string;
}
