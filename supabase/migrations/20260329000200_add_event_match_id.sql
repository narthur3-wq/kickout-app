alter table public.events
  add column if not exists match_id text references public.matches(id);
