create table if not exists public.matches (
  id            text        primary key,
  team_id       uuid        not null references public.teams(id),
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
  on public.matches (team_id, updated_at desc);

alter table public.matches enable row level security;

create policy "team_match_read"
  on public.matches for select to authenticated
  using (team_id = auth_team_id());

create policy "team_match_insert"
  on public.matches for insert to authenticated
  with check (team_id = auth_team_id());

create policy "team_match_update"
  on public.matches for update to authenticated
  using (team_id = auth_team_id());

create policy "team_match_delete"
  on public.matches for delete to authenticated
  using (team_id = auth_team_id());

create trigger matches_updated_at
  before update on public.matches
  for each row execute function set_updated_at();
