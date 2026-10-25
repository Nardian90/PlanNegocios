-- ============================================================================
-- PLANEX-AUDIT-001 · Migración 0004 — Plantilla «centro» (prueba de
-- generalización, misión §17).
--
-- Extiende la restricción template_key de plans para admitir la tercera
-- plantilla de fábrica «centro» (Centro de Diagnóstico Integral, ejemplo
-- ilustrativo con estructura de negocio distinta). El cambio es aditivo y
-- compatible hacia atrás: el código anterior solo escribía «clinica» y
-- «default», que siguen admitiéndose.
-- ============================================================================

alter table public.plans
  drop constraint if exists plans_template_key_check;

alter table public.plans
  add constraint plans_template_key_check
  check (template_key in ('clinica', 'default', 'centro'));
