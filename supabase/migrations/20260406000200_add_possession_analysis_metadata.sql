-- ============================================================
-- Migration: 20260406000200_add_possession_analysis_metadata.sql
--
-- Adds possession-analysis metadata that must survive local-first
-- sync round-trips:
--   - session half tag
--   - possession event assist flag
-- ============================================================

alter table public.possession_sessions
  add column if not exists half text;

alter table public.possession_sessions
  drop constraint if exists possession_sessions_half_check;

alter table public.possession_sessions
  add constraint possession_sessions_half_check
  check (half in ('first', 'second', 'et') or half is null);

alter table public.possession_events
  add column if not exists assist boolean not null default false;
