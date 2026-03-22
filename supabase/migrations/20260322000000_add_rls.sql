-- ============================================================
-- Migration: 20260322000000_add_rls.sql
--
-- What this does:
--   Enables Row Level Security (RLS) on the `events` table and
--   adds four policies so that only authenticated users can read,
--   insert, update, or delete rows.  All authenticated users share
--   a single team view — appropriate for a small, trusted squad.
--
-- How to apply:
--   Option A (recommended): Supabase dashboard → your project →
--     SQL Editor → paste this file and click Run.
--   Option B (CLI): supabase db push
--     (requires supabase/config.toml and a linked project).
--
-- Future work — per-user scoping:
--   The write policies below use USING (true) / WITH CHECK (true),
--   meaning any authenticated user can modify any row.  To restrict
--   each user to their own events, add a `user_id uuid` column that
--   references auth.users(id), backfill it, then replace the USING /
--   WITH CHECK clauses with:
--     USING (user_id = auth.uid())
--     WITH CHECK (user_id = auth.uid())
--   Do this in a separate migration AFTER the column has been added.
-- ============================================================

-- 1. Add newer event fields and the invite allowlist table.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS shot_type text;

CREATE TABLE IF NOT EXISTS allowed_users (
  email    text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);

-- 2. Enable RLS on the events table.
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;

-- 3. Allow invited users to read their own allowlist entry.
CREATE POLICY "allowed_user_self_read"
  ON allowed_users
  FOR SELECT
  TO authenticated
  USING (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 4. SELECT — invited authenticated users may read all events.
CREATE POLICY "authenticated_read"
  ON events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM allowed_users
      WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- 5. INSERT — invited authenticated users may create events.
CREATE POLICY "authenticated_write"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM allowed_users
      WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- 6. UPDATE — invited authenticated users may update any event.
CREATE POLICY "authenticated_update"
  ON events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM allowed_users
      WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- 7. DELETE — invited authenticated users may delete any event.
CREATE POLICY "authenticated_delete"
  ON events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM allowed_users
      WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
