alter table public.events
  add column if not exists turnover_lost_player text,
  add column if not exists turnover_won_player text;
