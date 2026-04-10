-- ============================================================
-- Migration: 20260409000100_add_possession_event_paths.sql
--
-- Extends possession-analysis events so one event can capture:
--   - A receive point
--   - up to three structured carry waypoints
--   - a release point
--   - an optional destination point after release
-- ============================================================

alter table public.possession_events
  add column if not exists carry_waypoints jsonb not null default '[]'::jsonb;

alter table public.possession_events
  add column if not exists target_x numeric;

alter table public.possession_events
  add column if not exists target_y numeric;
