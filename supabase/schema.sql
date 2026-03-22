-- ============================================================
-- Páirc — Supabase schema
-- Run this once in your project's SQL editor:
--   https://supabase.com/dashboard → your project → SQL Editor
-- ============================================================

create table if not exists events (
  id                    text primary key,
  schema_version        integer not null default 1,
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
  event_type            text not null default 'kickout',
  direction             text not null default 'ours',
  restart_reason        text,
  shot_type             text,
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
  score_us              text,
  score_them            text,
  flag                  boolean default false,
  ko_sequence           integer,
  updated_at            timestamptz default now()
);

-- Invite allowlist — only emails in this table can access the app.
-- Add rows via: INSERT INTO allowed_users (email) VALUES ('user@example.com');
create table if not exists allowed_users (
  email    text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);

-- Row Level Security — access gated to invited users only.
alter table events enable row level security;
alter table allowed_users enable row level security;

-- Invited users can read their own allowlist entry (used by userHasAccess()).
create policy "allowed_user_self_read"
  on allowed_users for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Invited users can read/write/delete events.
create policy "authenticated_read"
  on events for select to authenticated
  using (exists (
    select 1 from allowed_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  ));

create policy "authenticated_write"
  on events for insert to authenticated
  with check (exists (
    select 1 from allowed_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  ));

create policy "authenticated_update"
  on events for update to authenticated
  using (exists (
    select 1 from allowed_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  ));

create policy "authenticated_delete"
  on events for delete to authenticated
  using (exists (
    select 1 from allowed_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  ));

-- Keep updated_at current automatically
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger events_updated_at
  before update on events
  for each row execute function set_updated_at();

-- ── Migration: run on an existing DB created from an older schema ──────────
-- alter table events add column if not exists event_type     text not null default 'kickout';
-- alter table events add column if not exists direction      text not null default 'ours';
-- alter table events add column if not exists restart_reason text;
-- alter table events add column if not exists schema_version integer not null default 1;
-- alter table events drop column if exists time_to_tee_s;
-- alter table events drop column if exists total_time_s;
-- alter table events drop column if exists scored_20s;
-- alter table events drop column if exists notes;
