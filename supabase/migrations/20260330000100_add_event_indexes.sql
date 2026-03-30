-- ============================================================
-- Migration: 20260330000100_add_event_indexes.sql
--
-- Adds indexes that are missing on the events table.
--
-- Why this matters:
--   Every query on events from the app filters by team_id (both
--   explicitly in syncFromSupabase and implicitly via the RLS policy
--   USING (team_id = auth_team_id())). Without an index the database
--   does a full sequential scan of all events across every team.
--
--   The new match_id FK column (added in 20260329000200) is also used
--   by future per-match queries and by the RLS checks that flow through
--   the match FK. Indexing it now avoids a retroactive migration later.
--
-- How to apply:
--   Supabase dashboard → your project → SQL Editor → paste and Run.
-- ============================================================

create index if not exists events_team_id_idx
  on public.events (team_id);

create index if not exists events_match_id_idx
  on public.events (match_id);
