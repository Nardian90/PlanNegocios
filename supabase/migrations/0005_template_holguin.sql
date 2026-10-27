-- ============================================================================
-- PLANEX-DATA-001 · Migración 0005 — Plantilla «holguin» (proyecto real).
--
-- Extiende la restricción template_key de plans para admitir la plantilla
-- documental «holguin» (Centro Estomatológico Internacional Holguín, primer
-- proyecto REAL de la aplicación: datos trazables al expediente del
-- promotor, no un ejemplo ficticio). Cambio aditivo y compatible hacia
-- atrás: «clinica», «default» y «centro» siguen admitiéndose.
--
-- Aplicación (con las credenciales del propietario en .env.admin.local):
--   bun run scripts/aplicar-migracion.ts supabase/migrations/0005_template_holguin.sql
-- ============================================================================

alter table public.plans
  drop constraint if exists plans_template_key_check;

alter table public.plans
  add constraint plans_template_key_check
  check (template_key in ('clinica', 'default', 'centro', 'holguin'));
