alter table public.research_runs
  add column if not exists status text not null default 'done',
  add column if not exists progress jsonb,
  add column if not exists error text,
  add column if not exists last_error text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists locked_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

update public.research_runs
set
  status = coalesce(status, 'done'),
  attempt_count = coalesce(attempt_count, 0),
  max_attempts = coalesce(max_attempts, 3);
