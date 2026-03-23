-- ============================================================
-- Migration: 20260323000000_team_rls.sql
--
-- Introduces team-scoped Row Level Security so that each club's
-- data is fully isolated from every other club's data.
--
-- What this adds:
--   1. A `teams` table — one row per club.
--   2. `team_id` on `allowed_users` — associates each invited user
--      with a team. Set this when inviting users.
--   3. `team_id` on `events` — written by the app on every save.
--   4. `auth_team_id()` helper function — looks up the current
--      user's team_id efficiently inside RLS policies.
--   5. New team-scoped RLS policies replacing the old invite-only ones.
--
-- How to apply:
--   Supabase dashboard → your project → SQL Editor → paste and Run.
--
-- After running, set up your first team:
--   INSERT INTO teams (name) VALUES ('Clontarf GAA')
--     RETURNING id;
--   -- Copy the returned id, then:
--   UPDATE allowed_users
--     SET team_id = '<the-id-from-above>'
--     WHERE email IN ('analyst@example.com', ...);
--
-- To invite a user from a second club:
--   INSERT INTO teams (name) VALUES ('New Club GAA')
--     RETURNING id;
--   INSERT INTO allowed_users (email, team_id)
--     VALUES ('newclub@example.com', '<new-team-id>');
-- ============================================================

-- 1. Teams table
CREATE TABLE IF NOT EXISTS teams (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- 2. Add team_id to allowed_users
ALTER TABLE allowed_users
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);

-- 3. Add team_id to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);

-- 4. Helper function — returns the current user's team_id.
--    SECURITY DEFINER so it can bypass RLS on allowed_users
--    without causing infinite recursion in event policies.
CREATE OR REPLACE FUNCTION auth_team_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT team_id
  FROM   allowed_users
  WHERE  email = lower(coalesce(auth.jwt() ->> 'email', ''))
  LIMIT  1
$$;

-- 5. Drop old invite-only event policies
DROP POLICY IF EXISTS "authenticated_read"   ON events;
DROP POLICY IF EXISTS "authenticated_write"  ON events;
DROP POLICY IF EXISTS "authenticated_update" ON events;
DROP POLICY IF EXISTS "authenticated_delete" ON events;

-- 6. New team-scoped policies for events
CREATE POLICY "team_read" ON events
  FOR SELECT TO authenticated
  USING (team_id = auth_team_id());

CREATE POLICY "team_insert" ON events
  FOR INSERT TO authenticated
  WITH CHECK (team_id = auth_team_id());

CREATE POLICY "team_update" ON events
  FOR UPDATE TO authenticated
  USING (team_id = auth_team_id());

CREATE POLICY "team_delete" ON events
  FOR DELETE TO authenticated
  USING (team_id = auth_team_id());

-- 7. Users can read their own team record (name etc.)
CREATE POLICY "team_self_read" ON teams
  FOR SELECT TO authenticated
  USING (id = auth_team_id());
