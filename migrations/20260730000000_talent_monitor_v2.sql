alter table public.search_tasks
  add column if not exists candidate_batch_size integer not null default 10,
  add column if not exists timezone text not null default 'UTC',
  add column if not exists schedule_time time without time zone not null default '09:00',
  add column if not exists monthly_credit_limit integer not null default 20,
  add column if not exists monthly_credit_used integer not null default 0,
  add column if not exists monthly_credit_reserved integer not null default 0,
  add column if not exists notification_enabled boolean not null default false,
  add column if not exists pause_reason text,
  add column if not exists last_run_status text;

update public.search_tasks
set frequency = 'manual'
where frequency not in ('manual', 'daily', 'weekly');

update public.search_tasks
set status = 'active'
where status not in ('active', 'paused');

update public.search_tasks
set candidate_batch_size = 10
where candidate_batch_size not in (5, 10, 20);

update public.search_tasks
set monthly_credit_limit = 20
where monthly_credit_limit < 0;

update public.search_tasks
set monthly_credit_used = 0
where monthly_credit_used < 0;

update public.search_tasks
set monthly_credit_reserved = 0
where monthly_credit_reserved < 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'search_tasks_frequency_check' and conrelid = 'public.search_tasks'::regclass) then
    alter table public.search_tasks
      add constraint search_tasks_frequency_check check (frequency in ('manual', 'daily', 'weekly'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'search_tasks_status_check' and conrelid = 'public.search_tasks'::regclass) then
    alter table public.search_tasks
      add constraint search_tasks_status_check check (status in ('active', 'paused'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'search_tasks_batch_size_check' and conrelid = 'public.search_tasks'::regclass) then
    alter table public.search_tasks
      add constraint search_tasks_batch_size_check check (candidate_batch_size in (5, 10, 20));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'search_tasks_monthly_credits_check' and conrelid = 'public.search_tasks'::regclass) then
    alter table public.search_tasks
      add constraint search_tasks_monthly_credits_check check (
        monthly_credit_limit >= 0
        and monthly_credit_used >= 0
        and monthly_credit_reserved >= 0
      );
  end if;
end $$;

create table if not exists public.search_task_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  search_task_id uuid not null references public.search_tasks(id) on delete cascade,
  research_run_id uuid references public.research_runs(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'cancelled', 'blocked')),
  started_at timestamptz,
  finished_at timestamptz,
  requested_count integer not null default 0 check (requested_count >= 0),
  returned_count integer not null default 0 check (returned_count >= 0),
  new_candidates integer not null default 0 check (new_candidates >= 0),
  updated_candidates integer not null default 0 check (updated_candidates >= 0),
  seen_candidates integer not null default 0 check (seen_candidates >= 0),
  skipped_candidates integer not null default 0 check (skipped_candidates >= 0),
  credit_reservation_id uuid,
  credits_reserved integer not null default 0 check (credits_reserved >= 0),
  credits_consumed integer not null default 0 check (credits_consumed >= 0),
  credits_released integer not null default 0 check (credits_released >= 0),
  stop_reason text,
  error_summary text,
  config_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists search_task_runs_task_updated_idx
  on public.search_task_runs (search_task_id, updated_at desc);

create index if not exists search_task_runs_research_run_idx
  on public.search_task_runs (research_run_id)
  where research_run_id is not null;

create or replace function public.prevent_search_task_run_config_snapshot_update()
returns trigger
language plpgsql
as $$
begin
  if new.config_snapshot is distinct from old.config_snapshot then
    raise exception 'search_task_runs.config_snapshot is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists search_task_runs_config_snapshot_immutable on public.search_task_runs;
create trigger search_task_runs_config_snapshot_immutable
before update on public.search_task_runs
for each row execute function public.prevent_search_task_run_config_snapshot_update();
