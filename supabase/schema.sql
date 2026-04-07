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
--   supabase/migrations/20260406000100_add_analysis_tables.sql
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

-- Squad roster used by post-match analysis
create table if not exists squad_players (
  id         uuid        primary key default gen_random_uuid(),
  team_id    uuid        not null references teams(id),
  name       text        not null,
  active     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists squad_players_team_name_unique
  on squad_players (team_id, lower(name));

create index if not exists squad_players_team_active_idx
  on squad_players (team_id, active, name);

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

-- Post-match possession analysis sessions
create table if not exists possession_sessions (
  id              uuid        primary key,
  team_id         uuid        not null references teams(id),
  match_id        text        references matches(id),
  squad_player_id uuid        references squad_players(id) on delete set null,
  player_name     text        not null,
  our_goal_at_top boolean     not null default true,
  half            text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table possession_sessions
  drop constraint if exists possession_sessions_half_check;

alter table possession_sessions
  add constraint possession_sessions_half_check
  check (half in ('first', 'second', 'et') or half is null);

create index if not exists possession_sessions_team_updated_idx
  on possession_sessions (team_id, updated_at desc);

create index if not exists possession_sessions_match_idx
  on possession_sessions (match_id);

create index if not exists possession_sessions_team_player_idx
  on possession_sessions (team_id, squad_player_id, updated_at desc);

create index if not exists possession_sessions_team_player_name_idx
  on possession_sessions (team_id, lower(player_name));

create table if not exists possession_events (
  id             uuid        primary key,
  session_id     uuid        not null references possession_sessions(id) on delete cascade,
  receive_x      numeric     not null,
  receive_y      numeric     not null,
  release_x      numeric     not null,
  release_y      numeric     not null,
  outcome        text        not null,
  under_pressure boolean     not null default false,
  assist         boolean     not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists possession_events_session_created_idx
  on possession_events (session_id, created_at desc);

-- Post-match passing analysis sessions
create table if not exists pass_sessions (
  id              uuid        primary key,
  team_id         uuid        not null references teams(id),
  match_id        text        references matches(id),
  squad_player_id uuid        references squad_players(id) on delete set null,
  player_name     text        not null,
  our_goal_at_top boolean     not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists pass_sessions_team_updated_idx
  on pass_sessions (team_id, updated_at desc);

create index if not exists pass_sessions_match_idx
  on pass_sessions (match_id);

create index if not exists pass_sessions_team_player_idx
  on pass_sessions (team_id, squad_player_id, updated_at desc);

create index if not exists pass_sessions_team_player_name_idx
  on pass_sessions (team_id, lower(player_name));

create table if not exists pass_events (
  id         uuid        primary key,
  session_id uuid        not null references pass_sessions(id) on delete cascade,
  from_x     numeric     not null,
  from_y     numeric     not null,
  to_x       numeric     not null,
  to_y       numeric     not null,
  pass_type  text        not null,
  completed  boolean     not null default true,
  created_at timestamptz not null default now()
);

create index if not exists pass_events_session_created_idx
  on pass_events (session_id, created_at desc);

-- Row Level Security
alter table teams         enable row level security;
alter table allowed_users enable row level security;
alter table matches       enable row level security;
alter table events        enable row level security;
alter table squad_players enable row level security;
alter table possession_sessions enable row level security;
alter table possession_events enable row level security;
alter table pass_sessions enable row level security;
alter table pass_events enable row level security;

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

create policy "team_squad_read"
  on squad_players for select to authenticated
  using (team_id = auth_team_id());

create policy "team_squad_insert"
  on squad_players for insert to authenticated
  with check (team_id = auth_team_id());

create policy "team_squad_update"
  on squad_players for update to authenticated
  using (team_id = auth_team_id())
  with check (team_id = auth_team_id());

create policy "team_squad_delete"
  on squad_players for delete to authenticated
  using (team_id = auth_team_id());

create policy "team_possession_session_read"
  on possession_sessions for select to authenticated
  using (team_id = auth_team_id());

create policy "team_possession_session_insert"
  on possession_sessions for insert to authenticated
  with check (
    team_id = auth_team_id()
    and (match_id is null or exists (
      select 1 from matches
      where matches.id = match_id
        and matches.team_id = auth_team_id()
    ))
    and (squad_player_id is null or exists (
      select 1 from squad_players
      where squad_players.id = squad_player_id
        and squad_players.team_id = auth_team_id()
    ))
  );

create policy "team_possession_session_update"
  on possession_sessions for update to authenticated
  using (team_id = auth_team_id())
  with check (
    team_id = auth_team_id()
    and (match_id is null or exists (
      select 1 from matches
      where matches.id = match_id
        and matches.team_id = auth_team_id()
    ))
    and (squad_player_id is null or exists (
      select 1 from squad_players
      where squad_players.id = squad_player_id
        and squad_players.team_id = auth_team_id()
    ))
  );

create policy "team_possession_session_delete"
  on possession_sessions for delete to authenticated
  using (team_id = auth_team_id());

create policy "team_possession_event_read"
  on possession_events for select to authenticated
  using (exists (
    select 1 from possession_sessions
    where possession_sessions.id = session_id
      and possession_sessions.team_id = auth_team_id()
  ));

create policy "team_possession_event_insert"
  on possession_events for insert to authenticated
  with check (exists (
    select 1 from possession_sessions
    where possession_sessions.id = session_id
      and possession_sessions.team_id = auth_team_id()
  ));

create policy "team_possession_event_update"
  on possession_events for update to authenticated
  using (exists (
    select 1 from possession_sessions
    where possession_sessions.id = session_id
      and possession_sessions.team_id = auth_team_id()
  ))
  with check (exists (
    select 1 from possession_sessions
    where possession_sessions.id = session_id
      and possession_sessions.team_id = auth_team_id()
  ));

create policy "team_possession_event_delete"
  on possession_events for delete to authenticated
  using (exists (
    select 1 from possession_sessions
    where possession_sessions.id = session_id
      and possession_sessions.team_id = auth_team_id()
  ));

create policy "team_pass_session_read"
  on pass_sessions for select to authenticated
  using (team_id = auth_team_id());

create policy "team_pass_session_insert"
  on pass_sessions for insert to authenticated
  with check (
    team_id = auth_team_id()
    and (match_id is null or exists (
      select 1 from matches
      where matches.id = match_id
        and matches.team_id = auth_team_id()
    ))
    and (squad_player_id is null or exists (
      select 1 from squad_players
      where squad_players.id = squad_player_id
        and squad_players.team_id = auth_team_id()
    ))
  );

create policy "team_pass_session_update"
  on pass_sessions for update to authenticated
  using (team_id = auth_team_id())
  with check (
    team_id = auth_team_id()
    and (match_id is null or exists (
      select 1 from matches
      where matches.id = match_id
        and matches.team_id = auth_team_id()
    ))
    and (squad_player_id is null or exists (
      select 1 from squad_players
      where squad_players.id = squad_player_id
        and squad_players.team_id = auth_team_id()
    ))
  );

create policy "team_pass_session_delete"
  on pass_sessions for delete to authenticated
  using (team_id = auth_team_id());

create policy "team_pass_event_read"
  on pass_events for select to authenticated
  using (exists (
    select 1 from pass_sessions
    where pass_sessions.id = session_id
      and pass_sessions.team_id = auth_team_id()
  ));

create policy "team_pass_event_insert"
  on pass_events for insert to authenticated
  with check (exists (
    select 1 from pass_sessions
    where pass_sessions.id = session_id
      and pass_sessions.team_id = auth_team_id()
  ));

create policy "team_pass_event_update"
  on pass_events for update to authenticated
  using (exists (
    select 1 from pass_sessions
    where pass_sessions.id = session_id
      and pass_sessions.team_id = auth_team_id()
  ))
  with check (exists (
    select 1 from pass_sessions
    where pass_sessions.id = session_id
      and pass_sessions.team_id = auth_team_id()
  ));

create policy "team_pass_event_delete"
  on pass_events for delete to authenticated
  using (exists (
    select 1 from pass_sessions
    where pass_sessions.id = session_id
      and pass_sessions.team_id = auth_team_id()
  ));

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

create trigger squad_players_updated_at
  before update on squad_players
  for each row execute function set_updated_at();

create trigger possession_sessions_updated_at
  before update on possession_sessions
  for each row execute function set_updated_at();

create trigger pass_sessions_updated_at
  before update on pass_sessions
  for each row execute function set_updated_at();
