-- ============================================================
-- KickOut App — Supabase schema
-- Run this once in your project's SQL editor:
--   https://supabase.com/dashboard → your project → SQL Editor
-- ============================================================

create table if not exists events (
  id                    text primary key,
  created_at            timestamptz not null default now(),
  match_date            date,
  team                  text,
  opponent              text,
  period                text,
  clock                 text,
  target_player         text,
  outcome               text not null,
  contest_type          text not null,
  break_outcome         text,
  time_to_tee_s         numeric,
  total_time_s          numeric,
  scored_20s            boolean default false,
  x                     numeric not null,
  y                     numeric not null,
  x_m                   numeric,
  y_m                   numeric,
  depth_from_own_goal_m numeric,
  side_band             text,
  depth_band            text,
  zone_code             text,
  our_goal_at_top       boolean default true,
  pickup_x              numeric,
  pickup_y              numeric,
  pickup_x_m            numeric,
  pickup_y_m            numeric,
  break_displacement_m  numeric,
  updated_at            timestamptz default now()
);

-- Row Level Security — all authenticated users share a single team view.
-- For 3–4 known users this is the right trade-off; add user_id column
-- and per-user policies if you ever need per-user isolation.
alter table events enable row level security;

create policy "authenticated users can read all events"
  on events for select to authenticated using (true);

create policy "authenticated users can insert events"
  on events for insert to authenticated with check (true);

create policy "authenticated users can update events"
  on events for update to authenticated using (true);

create policy "authenticated users can delete events"
  on events for delete to authenticated using (true);

-- Keep updated_at current automatically
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger events_updated_at
  before update on events
  for each row execute function set_updated_at();
