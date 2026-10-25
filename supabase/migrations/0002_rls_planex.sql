-- ============================================================================
-- PLANEX — Migración 0002: Row Level Security (RLS) de mínimo privilegio.
--
-- Principios:
--   * Ningún dato es accesible para anónimos: todas las políticas son
--     `TO authenticated` con condición REAL de pertenencia al espacio.
--   * TO authenticated por sí solo NO protege nada: cada política exige
--     planex_es_miembro(...) sobre el espacio de trabajo correspondiente.
--   * La pertenencia se comprueba en el SERVIDOR (función + políticas),
--     no en la interfaz.
--   * El usuario no puede cambiar relaciones (plan→espacio, sección→plan,
--     alias del perfil) para eludir permisos: triggers lo impiden.
--   * Historial (plan_versions, plan_activity_log) inmutable vía API:
--     solo INSERT y SELECT; sin UPDATE ni DELETE para usuarios.
--   * workspace_members y workspaces: escritura SOLO administrativa
--     (la clave de servicio pasa por encima de RLS; los usuarios no).
--   * Un usuario no puede autoconcederse membresías ni roles: no existen
--     políticas INSERT/UPDATE/DELETE para workspace_members.
--
-- Idempotente: drop policy if exists + create policy.
-- ============================================================================

alter table public.profiles              enable row level security;
alter table public.workspaces            enable row level security;
alter table public.workspace_members     enable row level security;
alter table public.plans                 enable row level security;
alter table public.plan_sections         enable row level security;
alter table public.plan_versions         enable row level security;
alter table public.plan_activity_log     enable row level security;
alter table public.plan_comments         enable row level security;
alter table public.plan_section_assignments enable row level security;

-- ----------------------------------------------------------------------------
-- profiles: lectura del propio perfil y de los compañeros de espacio;
-- actualización solo del propio (y el trigger impide tocar el alias).
-- ----------------------------------------------------------------------------

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
        from public.workspace_members m
       where m.user_id = profiles.id
         and public.planex_es_miembro(m.workspace_id)
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Sin políticas INSERT/DELETE: los perfiles nacen con el usuario de Auth
-- (trigger planex_on_auth_user_created) y la API no permite crearlos.

-- ----------------------------------------------------------------------------
-- workspaces: visibles solo para sus miembros. Escritura solo administrativa.
-- ----------------------------------------------------------------------------

drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select to authenticated
  using (public.planex_es_miembro(workspaces.id));

-- ----------------------------------------------------------------------------
-- workspace_members: el usuario ve sus propias filas y las de compañeros
-- de espacios a los que pertenece. Escritura solo administrativa.
-- ----------------------------------------------------------------------------

drop policy if exists members_select on public.workspace_members;
create policy members_select on public.workspace_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.planex_es_miembro(workspace_members.workspace_id)
  );

-- ----------------------------------------------------------------------------
-- plans: lectura/edición por pertenencia al espacio; creación ligada al
-- propio usuario; sin borrado por API (evita la eliminación irreversible).
-- ----------------------------------------------------------------------------

drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans
  for select to authenticated
  using (public.planex_es_miembro(plans.workspace_id));

drop policy if exists plans_insert on public.plans;
create policy plans_insert on public.plans
  for insert to authenticated
  with check (
    public.planex_es_miembro(plans.workspace_id, 'editor')
    and created_by = auth.uid()
  );

drop policy if exists plans_update on public.plans;
create policy plans_update on public.plans
  for update to authenticated
  using (public.planex_es_miembro(plans.workspace_id, 'editor'))
  with check (
    public.planex_es_miembro(plans.workspace_id, 'editor')
    and workspace_id = plans.workspace_id
  );

-- Sin política DELETE sobre plans: la eliminación es solo administrativa.

-- ----------------------------------------------------------------------------
-- plan_sections: acceso a través del plan contenedor + escritura editor.
-- WITH CHECK revalida el plan destino (impide eludir permisos moviendo
-- la sección a un plan no autorizado; el trigger lo impide además).
-- ----------------------------------------------------------------------------

drop policy if exists sections_select on public.plan_sections;
create policy sections_select on public.plan_sections
  for select to authenticated
  using (
    exists (
      select 1 from public.plans p
       where p.id = plan_sections.plan_id
         and public.planex_es_miembro(p.workspace_id)
    )
  );

drop policy if exists sections_insert on public.plan_sections;
create policy sections_insert on public.plan_sections
  for insert to authenticated
  with check (
    exists (
      select 1 from public.plans p
       where p.id = plan_id
         and public.planex_es_miembro(p.workspace_id, 'editor')
    )
  );

drop policy if exists sections_update on public.plan_sections;
create policy sections_update on public.plan_sections
  for update to authenticated
  using (
    exists (
      select 1 from public.plans p
       where p.id = plan_sections.plan_id
         and public.planex_es_miembro(p.workspace_id, 'editor')
    )
  )
  with check (
    exists (
      select 1 from public.plans p
       where p.id = plan_id
         and public.planex_es_miembro(p.workspace_id, 'editor')
    )
  );

-- Sin política DELETE: las secciones no se borran por API.

-- ----------------------------------------------------------------------------
-- plan_versions: historial inmutable. SELECT por pertenencia; INSERT por
-- editor con autoría ligada al propio usuario (trigger la sella igualmente).
-- ----------------------------------------------------------------------------

drop policy if exists versions_select on public.plan_versions;
create policy versions_select on public.plan_versions
  for select to authenticated
  using (
    exists (
      select 1 from public.plans p
       where p.id = plan_versions.plan_id
         and public.planex_es_miembro(p.workspace_id)
    )
  );

drop policy if exists versions_insert on public.plan_versions;
create policy versions_insert on public.plan_versions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.plans p
       where p.id = plan_id
         and public.planex_es_miembro(p.workspace_id, 'editor')
    )
    and created_by = auth.uid()
  );

-- Sin UPDATE/DELETE: el historial no se manipula desde la API.

-- ----------------------------------------------------------------------------
-- plan_activity_log: append-only con autoría sellada por el servidor.
-- ----------------------------------------------------------------------------

drop policy if exists activity_select on public.plan_activity_log;
create policy activity_select on public.plan_activity_log
  for select to authenticated
  using (
    exists (
      select 1 from public.plans p
       where p.id = plan_activity_log.plan_id
         and public.planex_es_miembro(p.workspace_id)
    )
  );

drop policy if exists activity_insert on public.plan_activity_log;
create policy activity_insert on public.plan_activity_log
  for insert to authenticated
  with check (
    exists (
      select 1 from public.plans p
       where p.id = plan_id
         and public.planex_es_miembro(p.workspace_id, 'editor')
    )
    and user_id = auth.uid()
  );

-- Sin UPDATE/DELETE: registro append-only.

-- ----------------------------------------------------------------------------
-- plan_comments: lectura por miembros; creación propia; edición/borrado
-- solo del propio comentario. Nunca alteran datos financieros.
-- ----------------------------------------------------------------------------

drop policy if exists comments_select on public.plan_comments;
create policy comments_select on public.plan_comments
  for select to authenticated
  using (
    exists (
      select 1 from public.plans p
       where p.id = plan_comments.plan_id
         and public.planex_es_miembro(p.workspace_id)
    )
  );

drop policy if exists comments_insert on public.plan_comments;
create policy comments_insert on public.plan_comments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.plans p
       where p.id = plan_id
         and public.planex_es_miembro(p.workspace_id, 'editor')
    )
    and user_id = auth.uid()
  );

drop policy if exists comments_update on public.plan_comments;
create policy comments_update on public.plan_comments
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists comments_delete on public.plan_comments;
create policy comments_delete on public.plan_comments
  for delete to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- plan_section_assignments: gestión editorial (editores del espacio).
-- ----------------------------------------------------------------------------

drop policy if exists assignments_select on public.plan_section_assignments;
create policy assignments_select on public.plan_section_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.plans p
       where p.id = plan_section_assignments.plan_id
         and public.planex_es_miembro(p.workspace_id)
    )
  );

drop policy if exists assignments_insert on public.plan_section_assignments;
create policy assignments_insert on public.plan_section_assignments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.plans p
       where p.id = plan_id
         and public.planex_es_miembro(p.workspace_id, 'editor')
    )
  );

drop policy if exists assignments_delete on public.plan_section_assignments;
create policy assignments_delete on public.plan_section_assignments
  for delete to authenticated
  using (
    exists (
      select 1 from public.plans p
       where p.id = plan_section_assignments.plan_id
         and public.planex_es_miembro(p.workspace_id, 'editor')
    )
  );
