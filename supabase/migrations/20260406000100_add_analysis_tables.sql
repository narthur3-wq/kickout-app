-- ============================================================
-- Migration: 20260406000100_add_analysis_tables.sql
--
-- Adds the Phase 2 post-match analysis schema:
--   - squad roster identities
--   - possession analysis sessions + events
--   - pass impact sessions + events
--
-- Design choices:
--   - team ownership lives on roster + session rows
--   - analysis event rows inherit team scope through their parent session
--   - sessions keep player_name for readability / legacy fallback
--   - squad_player_id is nullable and set to null if a roster player is deleted
--
-- How to apply:
--   Supabase dashboard -> your project -> SQL Editor -> paste and Run.
-- ============================================================

create table if not exists public.squad_players (
  id         uuid        primary key default gen_random_uuid(),
  team_id    uuid        not null references public.teams(id),
  name       text        not null,
  active     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists squad_players_team_name_unique
  on public.squad_players (team_id, lower(name));

create index if not exists squad_players_team_active_idx
  on public.squad_players (team_id, active, name);

create table if not exists public.possession_sessions (
  id              uuid        primary key,
  team_id         uuid        not null references public.teams(id),
  match_id        text        references public.matches(id),
  squad_player_id uuid        references public.squad_players(id) on delete set null,
  player_name     text        not null,
  our_goal_at_top boolean     not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists possession_sessions_team_updated_idx
  on public.possession_sessions (team_id, updated_at desc);

create index if not exists possession_sessions_match_idx
  on public.possession_sessions (match_id);

create index if not exists possession_sessions_team_player_idx
  on public.possession_sessions (team_id, squad_player_id, updated_at desc);

create index if not exists possession_sessions_team_player_name_idx
  on public.possession_sessions (team_id, lower(player_name));

create table if not exists public.possession_events (
  id             uuid        primary key,
  session_id     uuid        not null references public.possession_sessions(id) on delete cascade,
  receive_x      numeric     not null,
  receive_y      numeric     not null,
  release_x      numeric     not null,
  release_y      numeric     not null,
  outcome        text        not null,
  under_pressure boolean     not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists possession_events_session_created_idx
  on public.possession_events (session_id, created_at desc);

create table if not exists public.pass_sessions (
  id              uuid        primary key,
  team_id         uuid        not null references public.teams(id),
  match_id        text        references public.matches(id),
  squad_player_id uuid        references public.squad_players(id) on delete set null,
  player_name     text        not null,
  our_goal_at_top boolean     not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists pass_sessions_team_updated_idx
  on public.pass_sessions (team_id, updated_at desc);

create index if not exists pass_sessions_match_idx
  on public.pass_sessions (match_id);

create index if not exists pass_sessions_team_player_idx
  on public.pass_sessions (team_id, squad_player_id, updated_at desc);

create index if not exists pass_sessions_team_player_name_idx
  on public.pass_sessions (team_id, lower(player_name));

create table if not exists public.pass_events (
  id         uuid        primary key,
  session_id uuid        not null references public.pass_sessions(id) on delete cascade,
  from_x     numeric     not null,
  from_y     numeric     not null,
  to_x       numeric     not null,
  to_y       numeric     not null,
  pass_type  text        not null,
  completed  boolean     not null default true,
  created_at timestamptz not null default now()
);

create index if not exists pass_events_session_created_idx
  on public.pass_events (session_id, created_at desc);

alter table public.squad_players enable row level security;
alter table public.possession_sessions enable row level security;
alter table public.possession_events enable row level security;
alter table public.pass_sessions enable row level security;
alter table public.pass_events enable row level security;

drop policy if exists "team_squad_read" on public.squad_players;
drop policy if exists "team_squad_insert" on public.squad_players;
drop policy if exists "team_squad_update" on public.squad_players;
drop policy if exists "team_squad_delete" on public.squad_players;

create policy "team_squad_read"
  on public.squad_players for select to authenticated
  using (team_id = auth_team_id());

create policy "team_squad_insert"
  on public.squad_players for insert to authenticated
  with check (team_id = auth_team_id());

create policy "team_squad_update"
  on public.squad_players for update to authenticated
  using (team_id = auth_team_id())
  with check (team_id = auth_team_id());

create policy "team_squad_delete"
  on public.squad_players for delete to authenticated
  using (team_id = auth_team_id());

drop policy if exists "team_possession_session_read" on public.possession_sessions;
drop policy if exists "team_possession_session_insert" on public.possession_sessions;
drop policy if exists "team_possession_session_update" on public.possession_sessions;
drop policy if exists "team_possession_session_delete" on public.possession_sessions;

create policy "team_possession_session_read"
  on public.possession_sessions for select to authenticated
  using (team_id = auth_team_id());

create policy "team_possession_session_insert"
  on public.possession_sessions for insert to authenticated
  with check (
    team_id = auth_team_id()
    and (match_id is null or exists (
      select 1 from public.matches
      where public.matches.id = match_id
        and public.matches.team_id = auth_team_id()
    ))
    and (squad_player_id is null or exists (
      select 1 from public.squad_players
      where public.squad_players.id = squad_player_id
        and public.squad_players.team_id = auth_team_id()
    ))
  );

create policy "team_possession_session_update"
  on public.possession_sessions for update to authenticated
  using (team_id = auth_team_id())
  with check (
    team_id = auth_team_id()
    and (match_id is null or exists (
      select 1 from public.matches
      where public.matches.id = match_id
        and public.matches.team_id = auth_team_id()
    ))
    and (squad_player_id is null or exists (
      select 1 from public.squad_players
      where public.squad_players.id = squad_player_id
        and public.squad_players.team_id = auth_team_id()
    ))
  );

create policy "team_possession_session_delete"
  on public.possession_sessions for delete to authenticated
  using (team_id = auth_team_id());

drop policy if exists "team_possession_event_read" on public.possession_events;
drop policy if exists "team_possession_event_insert" on public.possession_events;
drop policy if exists "team_possession_event_update" on public.possession_events;
drop policy if exists "team_possession_event_delete" on public.possession_events;

create policy "team_possession_event_read"
  on public.possession_events for select to authenticated
  using (exists (
    select 1 from public.possession_sessions
    where public.possession_sessions.id = session_id
      and public.possession_sessions.team_id = auth_team_id()
  ));

create policy "team_possession_event_insert"
  on public.possession_events for insert to authenticated
  with check (exists (
    select 1 from public.possession_sessions
    where public.possession_sessions.id = session_id
      and public.possession_sessions.team_id = auth_team_id()
  ));

create policy "team_possession_event_update"
  on public.possession_events for update to authenticated
  using (exists (
    select 1 from public.possession_sessions
    where public.possession_sessions.id = session_id
      and public.possession_sessions.team_id = auth_team_id()
  ))
  with check (exists (
    select 1 from public.possession_sessions
    where public.possession_sessions.id = session_id
      and public.possession_sessions.team_id = auth_team_id()
  ));

create policy "team_possession_event_delete"
  on public.possession_events for delete to authenticated
  using (exists (
    select 1 from public.possession_sessions
    where public.possession_sessions.id = session_id
      and public.possession_sessions.team_id = auth_team_id()
  ));

drop policy if exists "team_pass_session_read" on public.pass_sessions;
drop policy if exists "team_pass_session_insert" on public.pass_sessions;
drop policy if exists "team_pass_session_update" on public.pass_sessions;
drop policy if exists "team_pass_session_delete" on public.pass_sessions;

create policy "team_pass_session_read"
  on public.pass_sessions for select to authenticated
  using (team_id = auth_team_id());

create policy "team_pass_session_insert"
  on public.pass_sessions for insert to authenticated
  with check (
    team_id = auth_team_id()
    and (match_id is null or exists (
      select 1 from public.matches
      where public.matches.id = match_id
        and public.matches.team_id = auth_team_id()
    ))
    and (squad_player_id is null or exists (
      select 1 from public.squad_players
      where public.squad_players.id = squad_player_id
        and public.squad_players.team_id = auth_team_id()
    ))
  );

create policy "team_pass_session_update"
  on public.pass_sessions for update to authenticated
  using (team_id = auth_team_id())
  with check (
    team_id = auth_team_id()
    and (match_id is null or exists (
      select 1 from public.matches
      where public.matches.id = match_id
        and public.matches.team_id = auth_team_id()
    ))
    and (squad_player_id is null or exists (
      select 1 from public.squad_players
      where public.squad_players.id = squad_player_id
        and public.squad_players.team_id = auth_team_id()
    ))
  );

create policy "team_pass_session_delete"
  on public.pass_sessions for delete to authenticated
  using (team_id = auth_team_id());

drop policy if exists "team_pass_event_read" on public.pass_events;
drop policy if exists "team_pass_event_insert" on public.pass_events;
drop policy if exists "team_pass_event_update" on public.pass_events;
drop policy if exists "team_pass_event_delete" on public.pass_events;

create policy "team_pass_event_read"
  on public.pass_events for select to authenticated
  using (exists (
    select 1 from public.pass_sessions
    where public.pass_sessions.id = session_id
      and public.pass_sessions.team_id = auth_team_id()
  ));

create policy "team_pass_event_insert"
  on public.pass_events for insert to authenticated
  with check (exists (
    select 1 from public.pass_sessions
    where public.pass_sessions.id = session_id
      and public.pass_sessions.team_id = auth_team_id()
  ));

create policy "team_pass_event_update"
  on public.pass_events for update to authenticated
  using (exists (
    select 1 from public.pass_sessions
    where public.pass_sessions.id = session_id
      and public.pass_sessions.team_id = auth_team_id()
  ))
  with check (exists (
    select 1 from public.pass_sessions
    where public.pass_sessions.id = session_id
      and public.pass_sessions.team_id = auth_team_id()
  ));

create policy "team_pass_event_delete"
  on public.pass_events for delete to authenticated
  using (exists (
    select 1 from public.pass_sessions
    where public.pass_sessions.id = session_id
      and public.pass_sessions.team_id = auth_team_id()
  ));

drop trigger if exists squad_players_updated_at on public.squad_players;
drop trigger if exists possession_sessions_updated_at on public.possession_sessions;
drop trigger if exists pass_sessions_updated_at on public.pass_sessions;

create trigger squad_players_updated_at
  before update on public.squad_players
  for each row execute function public.set_updated_at();

create trigger possession_sessions_updated_at
  before update on public.possession_sessions
  for each row execute function public.set_updated_at();

create trigger pass_sessions_updated_at
  before update on public.pass_sessions
  for each row execute function public.set_updated_at();
