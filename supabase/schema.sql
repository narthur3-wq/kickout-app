-- ============================================================
-- Pairc - Supabase schema (current, including team RLS)
-- Run this once on a fresh project in the SQL editor:
--   https://supabase.com/dashboard -> your project -> SQL Editor
--
-- For existing databases, apply migrations in order instead:
--   supabase/migrations/20260322000000_add_rls.sql
--   supabase/migrations/20260323000000_team_rls.sql
--   supabase/migrations/20260323010000_team_name_uniqueness.sql
--   supabase/migrations/20260325000100_allow_null_contest_type.sql
--   supabase/migrations/20260326000100_add_turnover_players.sql
--   supabase/migrations/20260329000100_add_matches_table.sql
--   supabase/migrations/20260329000200_add_event_match_id.sql
--   supabase/migrations/20260330000100_add_event_indexes.sql
-- ============================================================

-- Teams
create table if not exists teams (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now()
);

create unique index if not exists teams_name_lower_unique
  on teams ((lower(name)));

-- Invite allowlist
create table if not exists allowed_users (
  email    text primary key check (email = lower(email)),
  team_id  uuid references teams(id),
  added_at timestamptz not null default now()
);

-- Matches
create table if not exists matches (
  id            text        primary key,
  team_id       uuid        not null references teams(id),
  team          text        not null,
  opponent      text        not null,
  match_date    date        not null,
  status        text        not null default 'open',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_event_at timestamptz,
  created_by    uuid,
  closed_at     timestamptz,
  constraint matches_status_check check (status in ('open', 'closed'))
);

create index if not exists matches_team_updated_idx
  on matches (team_id, updated_at desc);

-- Indexes on events used by every team-scoped query and by RLS policy evaluation.
create index if not exists events_team_id_idx
  on events (team_id);

create index if not exists events_match_id_idx
  on events (match_id);

-- Events
create table if not exists events (
  id                    text        primary key,
  schema_version        integer     not null default 1,
  created_at            timestamptz not null default now(),
  team_id               uuid        references teams(id),
  match_id              text        references matches(id),
  match_date            date,
  team                  text,
  opponent              text,
  period                text,
  clock                 text,
  target_player         text,
  turnover_lost_player  text,
  turnover_won_player   text,
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

-- Row Level Security
alter table teams         enable row level security;
alter table allowed_users enable row level security;
alter table matches       enable row level security;
alter table events        enable row level security;

create policy "allowed_user_self_read"
  on allowed_users for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

create or replace function auth_team_id()
returns uuid language sql stable security definer as $$
  select team_id
  from   allowed_users
  where  email = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit  1
$$;

create policy "team_self_read"
  on teams for select to authenticated
  using (id = auth_team_id());

create policy "team_match_read"
  on matches for select to authenticated
  using (team_id = auth_team_id());

create policy "team_match_insert"
  on matches for insert to authenticated
  with check (team_id = auth_team_id());

create policy "team_match_update"
  on matches for update to authenticated
  using (team_id = auth_team_id());

create policy "team_match_delete"
  on matches for delete to authenticated
  using (team_id = auth_team_id());

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

-- Triggers
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger matches_updated_at
  before update on matches
  for each row execute function set_updated_at();

create trigger events_updated_at
  before update on events
  for each row execute function set_updated_at();
