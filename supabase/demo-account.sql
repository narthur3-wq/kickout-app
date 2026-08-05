-- ============================================================
-- Demo account setup
--
-- Creates an isolated team for the public demo account and puts the
-- demo email on the allowlist. Run once, in the Supabase SQL editor.
--
-- WHY A SEPARATE TEAM: every table in this schema is gated by
-- `auth_team_id()` (see 20260323000000_team_rls.sql), which resolves the
-- signed-in user's `allowed_users.team_id`. Giving the demo account its
-- own team is what stops a demo visitor from ever reading or writing a
-- real club's data. Do NOT assign the demo user to a real club's team.
--
-- This file only creates the team and the allowlist row. Two steps are
-- deliberately left manual because they need the Auth admin API or the
-- dashboard:
--
--   1. Create the Auth user (email + password) — dashboard, or the
--      existing onboard-user Edge Function.
--   2. Seed the match — sign in as the demo account in the app and use
--      Events → Import JSON with documentation/demo/demo-match-2026.json.
--
-- Full walkthrough: documentation/demo-access.md
-- ============================================================

-- 1. The demo team. Named so it is obvious in any admin view.
INSERT INTO teams (name)
VALUES ('Pairc Demo')
ON CONFLICT DO NOTHING;

-- 2. Allowlist the demo email against that team.
--    Change the email here if you use a different one — it must match
--    VITE_DEMO_EMAIL in the deployment environment.
INSERT INTO allowed_users (email, team_id)
VALUES (
  'demo@pairc.app',
  (SELECT id FROM teams WHERE name = 'Pairc Demo' LIMIT 1)
)
ON CONFLICT (email) DO UPDATE
  SET team_id = EXCLUDED.team_id;

-- 3. Verify: this must return exactly one row, and the team_id must NOT
--    match any real club's team.
SELECT au.email, t.name AS team_name, au.team_id
FROM   allowed_users au
JOIN   teams t ON t.id = au.team_id
WHERE  au.email = 'demo@pairc.app';

-- ── Resetting the demo ──────────────────────────────────────────────
-- To wipe whatever visitors have recorded and restore the seed match,
-- delete the demo team's rows and re-import the JSON. Scoped by team_id,
-- so it cannot touch real data:
--
--   DELETE FROM events  WHERE team_id = (SELECT id FROM teams WHERE name = 'Pairc Demo');
--   DELETE FROM matches WHERE team_id = (SELECT id FROM teams WHERE name = 'Pairc Demo');
