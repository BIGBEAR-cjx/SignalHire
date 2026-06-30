alter table public.projects
  add column if not exists network_seeds jsonb not null default '[]'::jsonb;
