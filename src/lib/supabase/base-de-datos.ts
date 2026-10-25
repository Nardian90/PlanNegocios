// ============================================================================
// PLANEX — Tipos de esquema de la base de datos Supabase (escritos a mano
// conforme a supabase/migrations). Tipar el cliente elimina la categoría de
// errores «never[]» y documenta el esquema en el propio código.
// ============================================================================

export type RolMiembro = 'owner' | 'editor' | 'viewer';
export type EstadoPlan = 'borrador' | 'en_revision' | 'finalizado';
export type PlantillaKey = 'clinica' | 'default';

export type PerfilDB = {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export type MiembroDB = {
  workspace_id: string;
  user_id: string;
  role: RolMiembro;
  created_at: string;
}

export type EspacioDB = {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export type PlanDB = {
  id: string;
  workspace_id: string;
  title: string;
  template_key: PlantillaKey;
  status: EstadoPlan;
  created_by: string;
  updated_by: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
  schema_version: string;
  revision: number;
}

export type SeccionDB = {
  id: string;
  plan_id: string;
  section_key: string;
  content: Record<string, unknown>;
  section_version: number;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: string;
}

export type VersionDB = {
  id: string;
  plan_id: string;
  version_number: number;
  created_by: string;
  created_by_name: string | null;
  description: string;
  snapshot: Record<string, unknown>;
  created_at: string;
}

export type ActividadDB = {
  id: string;
  plan_id: string;
  section_key: string | null;
  operation: string;
  field_path: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  user_id: string;
  user_name: string | null;
  created_at: string;
}

export type ComentarioDB = {
  id: string;
  plan_id: string;
  section_key: string | null;
  content: string;
  user_id: string;
  user_name: string | null;
  created_at: string;
}

export type AsignacionDB = {
  id: string;
  plan_id: string;
  section_key: string;
  user_id: string;
  user_name: string | null;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: PerfilDB;
        Insert: { id: string; username: string; display_name?: string };
        Update: { display_name?: string };
        Relationships: [];
      };
      workspaces: {
        Row: EspacioDB;
        Insert: { id?: string; name: string; description?: string };
        Update: { name?: string; description?: string };
        Relationships: [];
      };
      workspace_members: {
        Row: MiembroDB;
        Insert: { workspace_id: string; user_id: string; role?: RolMiembro };
        Update: { role?: RolMiembro };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey',
            columns: ['workspace_id'],
            isOneToOne: false,
            referencedRelation: 'workspaces',
            referencedColumns: ['id'],
          },
        ];
      };
      plans: {
        Row: PlanDB;
        // created_by/updated_by los sella el servidor en BEFORE INSERT/UPDATE.
        Insert: {
          id?: string;
          workspace_id: string;
          title?: string;
          template_key?: PlantillaKey;
          status?: EstadoPlan;
          schema_version?: string;
        };
        Update: { title?: string; status?: EstadoPlan };
        Relationships: [
          {
            foreignKeyName: 'plans_workspace_id_fkey',
            columns: ['workspace_id'],
            isOneToOne: false,
            referencedRelation: 'workspaces',
            referencedColumns: ['id'],
          },
        ];
      };
      plan_sections: {
        Row: SeccionDB;
        Insert: { id?: string; plan_id: string; section_key: string; content?: Record<string, unknown> };
        Update: { content?: Record<string, unknown> };
        Relationships: [
          {
            foreignKeyName: 'plan_sections_plan_id_fkey',
            columns: ['plan_id'],
            isOneToOne: false,
            referencedRelation: 'plans',
            referencedColumns: ['id'],
          },
        ];
      };
      plan_versions: {
        Row: VersionDB;
        Insert: {
          id?: string;
          plan_id: string;
          version_number: number;
          description?: string;
          snapshot: Record<string, unknown>;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: 'plan_versions_plan_id_fkey',
            columns: ['plan_id'],
            isOneToOne: false,
            referencedRelation: 'plans',
            referencedColumns: ['id'],
          },
        ];
      };
      plan_activity_log: {
        Row: ActividadDB;
        Insert: {
          id?: string;
          plan_id: string;
          section_key?: string | null;
          operation: string;
          field_path?: string | null;
          old_value?: Record<string, unknown> | null;
          new_value?: Record<string, unknown> | null;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: 'plan_activity_log_plan_id_fkey',
            columns: ['plan_id'],
            isOneToOne: false,
            referencedRelation: 'plans',
            referencedColumns: ['id'],
          },
        ];
      };
      plan_comments: {
        Row: ComentarioDB;
        Insert: { id?: string; plan_id: string; section_key?: string | null; content: string };
        Update: { content?: string };
        Relationships: [
          {
            foreignKeyName: 'plan_comments_plan_id_fkey',
            columns: ['plan_id'],
            isOneToOne: false,
            referencedRelation: 'plans',
            referencedColumns: ['id'],
          },
        ];
      };
      plan_section_assignments: {
        Row: AsignacionDB;
        Insert: { id?: string; plan_id: string; section_key: string };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: 'plan_section_assignments_plan_id_fkey',
            columns: ['plan_id'],
            isOneToOne: false,
            referencedRelation: 'plans',
            referencedColumns: ['id'],
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      planex_es_miembro: { Args: { p_workspace: string; p_min_rol?: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
