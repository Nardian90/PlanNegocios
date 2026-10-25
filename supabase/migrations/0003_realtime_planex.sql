-- ============================================================================
-- PLANEX — Migración 0003: Realtime (postgres_changes) para dos
-- colaboradores suscritos a los mismos planes.
--
--   * Se añaden plans y plan_sections a la publicación supabase_realtime.
--   * replica identity FULL: el evento UPDATE incluye el registro previo
--     (necesario para detectar conflictos por versión y mostrar quién
--     guardó antes) y habilita la autorización RLS de la suscripción
--     (WalRus): cada suscriptor solo recibe filas que su política SELECT
--     le permite leer.
--   * Un mensaje de Realtime NO es prueba de autorización: las lecturas
--     y escrituras siguen protegidas por RLS en el servidor.
--
-- Idempotente: tolera tablas ya publicadas (duplicate_object) y publicación
-- ya existente.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.plans;
  exception
    when duplicate_object then null; -- ya estaba publicada
  end;
  begin
    alter publication supabase_realtime add table public.plan_sections;
  exception
    when duplicate_object then null;
  end;
end $$;

alter table public.plan_sections replica identity full;
alter table public.plans replica identity full;
