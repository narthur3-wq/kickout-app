-- ============================================================
-- Páirc — Supabase schema (current, including team RLS)
-- Run this once on a fresh project in the SQL editor:
--   https://supabase.com/dashboard → your project → SQL Editor
--
-- For existing databases, apply migrations in order instead:
--   supabase/migrations/20260322000000_add_rls.sql
--   supabase/migrations/20260323000000_team_rls.sql
-- ============================================================

-- ── Teams ────────────────────────────────────────────────────
-- One row per club. Create a team first, then assign users to it.
create table if not exists teams (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now()
);

create unique index if not exists teams_name_lower_unique
  on teams ((lower(name)));

-- ── Invite allowlist ─────────────────────────────────────────
-- Only emails in this table can access the app.
-- Each user must be assigned to a team before they can read/write events.
--
-- To invite a user:
--   INSERT INTO allowed_users (email, team_id)
--     VALUES ('analyst@example.com', '<team-uuid>');
create table if not exists allowed_users (
  email    text primary key check (email = lower(email)),
  team_id  uuid references teams(id),
  added_at timestamptz not null default now()
);

-- ── Events ───────────────────────────────────────────────────
create table if not exists events (
  id                    text        primary key,
  schema_version        integer     not null default 1,
  created_at            timestamptz not null default now(),
  team_id               uuid        references teams(id),
  match_date            date,
  team                  text,
  opponent              text,
  period                text,
  clock                 text,
  target_player         text,
  outcome               text        not null,
  contest_type          text,
  break_outcome         text,
  event_type            text        not null default 'kickout',
  direction             text        not null default 'ours',
  restart_reason        text,
  shot_type             text,
  x                     numeric     not null,
  y                     numeric     not null,
  x_m                   numeric,
  y_m                   numeric,
  depth_from_own_goal_m numeric,
  side_band             text,
  depth_band            text,
  zone_code             text,
  our_goal_at_top       boolean     default true,
  pickup_x              numeric,
  pickup_y              numeric,
  pickup_x_m            numeric,
  pickup_y_m            numeric,
  break_displacement_m  numeric,
  score_us              text,
  score_them            text,
  flag                  boolean     default false,
  ko_sequence           integer,
  updated_at            timestamptz default now()
);

-- ── Row Level Security ───────────────────────────────────────
alter table teams        enable row level security;
alter table allowed_users enable row level security;
alter table events        enable row level security;

-- Users can read their own allowlist entry (used by userHasAccess()).
create policy "allowed_user_self_read"
  on allowed_users for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Helper: returns the current user's team_id.
-- SECURITY DEFINER so event policies can call it without recursion.
create or replace function auth_team_id()
returns uuid language sql stable security definer as $$
  select team_id
  from   allowed_users
  where  email = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit  1
$$;

-- Users can read their own team record.
create policy "team_self_read"
  on teams for select to authenticated
  using (id = auth_team_id());

-- Events are fully scoped to the user's team.
create policy "team_read"
  on events for select to authenticated
  using (team_id = auth_team_id());

create policy "team_insert"
  on events for insert to authenticated
  with check (team_id = auth_team_id());

create policy "team_update"
  on events for update to authenticated
  using (team_id = auth_team_id());

create policy "team_delete"
  on events for delete to authenticated
  using (team_id = auth_team_id());

-- ── Triggers ─────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger events_updated_at
  before update on events
  for each row execute function set_updated_at();
