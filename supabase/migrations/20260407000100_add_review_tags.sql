-- ============================================================
-- Migration: 20260407000100_add_review_tags.sql
--
-- Adds retrospective review tags that are edited after the match:
--   - kickout / turnover conversion_result
--   - shot score_source
-- ============================================================

alter table public.events
  add column if not exists conversion_result text;

alter table public.events
  add column if not exists score_source text;

alter table public.events
  drop constraint if exists events_conversion_result_check;

alter table public.events
  add constraint events_conversion_result_check
  check (conversion_result in ('score', 'no_score', 'unreviewed') or conversion_result is null);

alter table public.events
  drop constraint if exists events_score_source_check;

alter table public.events
  add constraint events_score_source_check
  check (score_source in ('kickout', 'turnover', 'settled', 'free', 'other', 'unreviewed') or score_source is null);
