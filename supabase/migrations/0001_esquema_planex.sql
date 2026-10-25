-- ============================================================================
-- PLANEX — Migración 0001: esquema de colaboración multiusuario.
--
-- Entidades:
--   profiles              ← perfiles ligados a auth.users (sin contraseñas).
--   workspaces            ← espacio de trabajo compartido.
--   workspace_members     ← pertenencia y rol por usuario (protegida: solo
--                            la administración puede escribirla).
--   plans                 ← metadatos de cada plan (título, plantilla,
--                            estado, autores, versión del esquema).
--   plan_sections         ← contenido por sección con versionado optimista
--                            (section_version) para detectar conflictos.
--   plan_versions         ← instantáneas recuperables e inmutables.
--   plan_activity_log     ← registro append-only de cambios relevantes.
--   plan_comments         ← observaciones por plan/sección.
--   plan_section_assignments ← apartados asignados a un colaborador.
--
-- Claves estables de sección (section_key) admitidas: 12 secciones.
-- Idempotente: puede ejecutarse de nuevo sin efectos adversos.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Tablas
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique,
  display_name text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'editor'
                check (role in ('owner', 'editor', 'viewer')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.plans (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  title          text not null default 'Plan de negocios',
  template_key   text not null default 'default'
                   check (template_key in ('clinica', 'default')),
  status         text not null default 'borrador'
                   check (status in ('borrador', 'en_revision', 'finalizado')),
  created_by     uuid not null references auth.users (id),
  updated_by     uuid references auth.users (id),
  updated_by_name text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  schema_version text not null default '1.0.0',
  revision       integer not null default 1
);
create index if not exists plans_ws_updated_idx
  on public.plans (workspace_id, updated_at desc);

create table if not exists public.plan_sections (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references public.plans (id) on delete cascade,
  section_key    text not null check (
    section_key in (
      'identificacion', 'descripcion', 'tecnico', 'produccion',
      'inversiones', 'mercado', 'fuerza', 'cronograma',
      'conclusiones', 'parametros', 'reglas', 'meta'
    )
  ),
  content        jsonb not null default '{}'::jsonb,
  section_version integer not null default 1,
  updated_by     uuid references auth.users (id),
  updated_by_name text,
  updated_at     timestamptz not null default now(),
  constraint plan_sections_plan_key unique (plan_id, section_key)
);
create index if not exists plan_sections_plan_idx
  on public.plan_sections (plan_id);

create table if not exists public.plan_versions (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references public.plans (id) on delete cascade,
  version_number  integer not null,
  created_by      uuid not null references auth.users (id),
  created_by_name text,
  description     text not null default '',
  snapshot        jsonb not null,
  created_at      timestamptz not null default now(),
  constraint plan_versions_num unique (plan_id, version_number)
);

create table if not exists public.plan_activity_log (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans (id) on delete cascade,
  section_key text,
  operation   text not null,
  field_path  text,
  old_value   jsonb,
  new_value   jsonb,
  user_id     uuid not null references auth.users (id),
  user_name   text,
  created_at  timestamptz not null default now()
);
create index if not exists plan_activity_idx
  on public.plan_activity_log (plan_id, created_at desc);

create table if not exists public.plan_comments (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans (id) on delete cascade,
  section_key text,
  content     text not null check (length(btrim(content)) > 0),
  user_id     uuid not null references auth.users (id),
  user_name   text,
  created_at  timestamptz not null default now()
);
create index if not exists plan_comments_idx
  on public.plan_comments (plan_id, created_at desc);

create table if not exists public.plan_section_assignments (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans (id) on delete cascade,
  section_key text not null,
  user_id     uuid not null references auth.users (id),
  user_name   text,
  created_at  timestamptz not null default now(),
  constraint plan_assign_uniq unique (plan_id, section_key)
);

-- ----------------------------------------------------------------------------
-- Perfil automático al crear cada usuario de Auth.
-- Patrón documentado de Supabase: SECURITY DEFINER mínimo, search_path fijo.
-- El alias (username) proviene de user_metadata SOLO como semilla inicial;
-- nunca como fuente de autorización (los permisos viven en workspace_members).
-- ----------------------------------------------------------------------------

create or replace function public.planex_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    )),
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do update
    set display_name = excluded.display_name;
  return new;
end;
$$;

drop trigger if exists planex_on_auth_user_created on auth.users;
create trigger planex_on_auth_user_created
  after insert on auth.users
  for each row execute function public.planex_handle_new_user();

-- ----------------------------------------------------------------------------
-- Perfiles: updated_at automático y alias (username) inmutable desde la API.
-- ----------------------------------------------------------------------------

create or replace function public.planex_profiles_guard()
returns trigger
language plpgsql
as $$
begin
  if new.username is distinct from old.username then
    raise exception 'El alias (username) del perfil no puede modificarse desde la API.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists planex_profiles_guard on public.profiles;
create trigger planex_profiles_guard
  before update on public.profiles
  for each row execute function public.planex_profiles_guard();

-- ----------------------------------------------------------------------------
-- Función auxiliar de pertenencia.
--
-- SECURITY DEFINER mínimo y justificado (la misión exige evitar políticas
-- recursivas o ambiguas): si fuera INVOKER, consultaría workspace_members
-- bajo el RLS de la MISMA tabla que la invoca y provocaría recursión
-- ("stack depth limit exceeded"). Como DEFINER (propietario postgres, sin
-- FORCE RLS) la consulta interna se resuelve sin re-evaluar políticas.
-- Contramedidas: search_path fijo, solo lectura (SELECT EXISTS), la
-- identidad proviene SIEMPRE de auth.uid() (JWT del solicitante, no de
-- parámetros), y execute restringido a authenticated.
-- ----------------------------------------------------------------------------

create or replace function public.planex_es_miembro(
  p_workspace uuid,
  p_min_rol   text default 'viewer'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.workspace_members m
     where m.workspace_id = p_workspace
       and m.user_id = auth.uid()
       and (
         p_min_rol = 'viewer'
         or (p_min_rol = 'editor' and m.role in ('owner', 'editor'))
         or m.role = 'owner'
       )
  );
$$;

revoke execute on function public.planex_es_miembro(uuid, text) from public, anon;
grant execute on function public.planex_es_miembro(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- planes: sello de autoría/fecha, metadatos inmutables por la API y
-- revisión + registro de actividad solo cuando cambian metadatos reales.
-- ----------------------------------------------------------------------------

create or replace function public.planex_plans_stamp()
returns trigger
language plpgsql
as $$
declare
  v_nombre text;
begin
  select coalesce(display_name, username) into v_nombre
    from public.profiles where id = auth.uid();

  if tg_op = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id then
      raise exception 'No se puede mover un plan a otro espacio de trabajo.';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'No se puede alterar el autor de creación del plan.';
    end if;
    if new.title is distinct from old.title
       or new.status is distinct from old.status
       or new.template_key is distinct from old.template_key then
      new.revision := old.revision + 1;
      insert into public.plan_activity_log
        (plan_id, operation, field_path, old_value, new_value, user_id, user_name)
      values
        (new.id, 'plan_actualizado', 'metadatos',
         to_jsonb(old) - '{updated_at,updated_by,updated_by_name,revision}'::text[],
         to_jsonb(new) - '{updated_at,updated_by,updated_by_name,revision}'::text[],
         auth.uid(), coalesce(v_nombre, ''));
    end if;
  else
    new.created_by := auth.uid();
  end if;

  new.updated_by := auth.uid();
  new.updated_by_name := coalesce(v_nombre, '');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists planex_plans_stamp on public.plans;
create trigger planex_plans_stamp
  before insert or update on public.plans
  for each row execute function public.planex_plans_stamp();

-- ----------------------------------------------------------------------------
-- plan_sections: versión optimista (+1 por escritura), autor y fecha
-- automáticos, plan/clave inmutables.
-- ----------------------------------------------------------------------------

create or replace function public.planex_sections_stamp()
returns trigger
language plpgsql
as $$
declare
  v_nombre text;
begin
  if tg_op = 'UPDATE' then
    if new.plan_id is distinct from old.plan_id then
      raise exception 'No se puede mover una sección a otro plan.';
    end if;
    if new.section_key is distinct from old.section_key then
      raise exception 'No se puede renombrar la clave de una sección.';
    end if;
    new.section_version := old.section_version + 1;
  end if;

  select coalesce(display_name, username) into v_nombre
    from public.profiles where id = auth.uid();
  new.updated_by := auth.uid();
  new.updated_by_name := coalesce(v_nombre, '');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists planex_sections_stamp on public.plan_sections;
create trigger planex_sections_stamp
  before insert or update on public.plan_sections
  for each row execute function public.planex_sections_stamp();

-- Registro de actividad automático por cada escritura de sección.
create or replace function public.planex_sections_log()
returns trigger
language plpgsql
as $$
begin
  insert into public.plan_activity_log
    (plan_id, section_key, operation, field_path,
     old_value, new_value, user_id, user_name)
  values
    (new.plan_id, new.section_key,
     case when tg_op = 'INSERT' then 'seccion_creada'
          else 'seccion_actualizada' end,
     new.section_key,
     case when tg_op = 'UPDATE' then old.content end,
     new.content,
     new.updated_by, new.updated_by_name);
  return null;
end;
$$;

drop trigger if exists planex_sections_log on public.plan_sections;
create trigger planex_sections_log
  after insert or update on public.plan_sections
  for each row execute function public.planex_sections_log();

-- La escritura de una sección refresca la fecha/autor del plan contenedor.
create or replace function public.planex_sections_touch_plan()
returns trigger
language plpgsql
as $$
begin
  update public.plans
     set updated_at = new.updated_at,
         updated_by = new.updated_by,
         updated_by_name = new.updated_by_name
   where id = new.plan_id;
  return null;
end;
$$;

drop trigger if exists planex_sections_touch_plan on public.plan_sections;
create trigger planex_sections_touch_plan
  after insert or update on public.plan_sections
  for each row execute function public.planex_sections_touch_plan();

-- ----------------------------------------------------------------------------
-- Registro de actividad: autoría servida por el servidor (no por el cliente).
-- ----------------------------------------------------------------------------

create or replace function public.planex_activity_stamp()
returns trigger
language plpgsql
as $$
declare
  v_nombre text;
begin
  new.user_id := auth.uid();
  select coalesce(display_name, username) into v_nombre
    from public.profiles where id = auth.uid();
  new.user_name := coalesce(v_nombre, '');
  return new;
end;
$$;

drop trigger if exists planex_activity_stamp on public.plan_activity_log;
create trigger planex_activity_stamp
  before insert on public.plan_activity_log
  for each row execute function public.planex_activity_stamp();

-- ----------------------------------------------------------------------------
-- Versiones, comentarios y asignaciones: identidad y nombre desde el perfil.
-- ----------------------------------------------------------------------------

create or replace function public.planex_versions_stamp()
returns trigger
language plpgsql
as $$
declare
  v_nombre text;
begin
  new.created_by := auth.uid();
  select coalesce(display_name, username) into v_nombre
    from public.profiles where id = auth.uid();
  new.created_by_name := coalesce(v_nombre, '');
  return new;
end;
$$;

drop trigger if exists planex_versions_stamp on public.plan_versions;
create trigger planex_versions_stamp
  before insert on public.plan_versions
  for each row execute function public.planex_versions_stamp();

create or replace function public.planex_comments_stamp()
returns trigger
language plpgsql
as $$
declare
  v_nombre text;
begin
  new.user_id := auth.uid();
  select coalesce(display_name, username) into v_nombre
    from public.profiles where id = auth.uid();
  new.user_name := coalesce(v_nombre, '');
  return new;
end;
$$;

drop trigger if exists planex_comments_stamp on public.plan_comments;
create trigger planex_comments_stamp
  before insert on public.plan_comments
  for each row execute function public.planex_comments_stamp();

create or replace function public.planex_assignments_stamp()
returns trigger
language plpgsql
as $$
declare
  v_nombre text;
begin
  new.user_id := auth.uid();
  select coalesce(display_name, username) into v_nombre
    from public.profiles where id = auth.uid();
  new.user_name := coalesce(v_nombre, '');
  return new;
end;
$$;

drop trigger if exists planex_assignments_stamp on public.plan_section_assignments;
create trigger planex_assignments_stamp
  before insert on public.plan_section_assignments
  for each row execute function public.planex_assignments_stamp();
