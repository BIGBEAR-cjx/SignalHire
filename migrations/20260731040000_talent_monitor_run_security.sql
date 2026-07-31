-- A task run must always belong to the same user as its monitor. Run writes
-- are service-only so browser routes cannot bypass Credits or the task lock.
update public.search_task_runs as run
set user_id = task.user_id
from public.search_tasks as task
where task.id = run.search_task_id
  and run.user_id is distinct from task.user_id;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'search_tasks_id_user_unique'
      and conrelid = 'public.search_tasks'::regclass
  ) then
    alter table public.search_tasks
      add constraint search_tasks_id_user_unique unique (id, user_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'search_task_runs_task_user_fk'
      and conrelid = 'public.search_task_runs'::regclass
  ) then
    alter table public.search_task_runs
      add constraint search_task_runs_task_user_fk
      foreign key (search_task_id, user_id)
      references public.search_tasks (id, user_id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'search_task_runs_reservation_fk'
      and conrelid = 'public.search_task_runs'::regclass
  ) then
    alter table public.search_task_runs
      add constraint search_task_runs_reservation_fk
      foreign key (credit_reservation_id)
      references public.credit_reservations (id)
      on delete restrict;
  end if;
end $$;

create unique index if not exists search_task_runs_one_active_per_task_idx
  on public.search_task_runs (search_task_id)
  where status in ('queued', 'running');

alter table public.search_task_runs enable row level security;
revoke all on table public.search_task_runs from public;

create or replace function public.create_monitor_run(
  p_user_id uuid,
  p_search_task_id uuid,
  p_run_id uuid,
  p_credit_reservation_id uuid,
  p_credits_reserved integer,
  p_config_snapshot jsonb
)
returns table (run_id uuid, run_status text, is_duplicate boolean, pause_reason text)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_task public.search_tasks%rowtype;
  v_existing public.search_task_runs%rowtype;
begin
  if p_credits_reserved <= 0 or p_config_snapshot is null then
    raise exception 'invalid monitor run input';
  end if;

  select * into v_task
  from public.search_tasks as task
  where task.id = p_search_task_id and task.user_id = p_user_id
  for update;
  if not found then return; end if;

  select * into v_existing
  from public.search_task_runs as run
  where run.search_task_id = p_search_task_id
    and run.status in ('queued', 'running')
  order by run.created_at asc
  limit 1;
  if found then
    return query select v_existing.id, v_existing.status, true, null::text;
    return;
  end if;

  if v_task.status <> 'active' then
    return query select null::uuid, 'blocked'::text, false, coalesce(v_task.pause_reason, 'monitor_inactive');
    return;
  end if;

  if v_task.monthly_credit_used + v_task.monthly_credit_reserved + p_credits_reserved > v_task.monthly_credit_limit then
    update public.search_tasks as task
    set status = 'paused', pause_reason = 'monthly_credit_limit', updated_at = now()
    where task.id = v_task.id;
    return query select null::uuid, 'blocked'::text, false, 'monthly_credit_limit'::text;
    return;
  end if;

  insert into public.search_task_runs (
    id, user_id, search_task_id, status, credit_reservation_id, credits_reserved, config_snapshot
  ) values (
    p_run_id, p_user_id, p_search_task_id, 'queued', p_credit_reservation_id, p_credits_reserved, p_config_snapshot
  );
  update public.search_tasks as task
  set monthly_credit_reserved = task.monthly_credit_reserved + p_credits_reserved,
      last_run_status = 'queued', updated_at = now()
  where task.id = v_task.id;
  return query select p_run_id, 'queued'::text, false, null::text;
end;
$$;

create or replace function public.abort_monitor_run(
  p_run_id uuid,
  p_release_idempotency_key text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_run public.search_task_runs%rowtype;
begin
  select * into v_run from public.search_task_runs as run where run.id = p_run_id for update;
  if not found then return false; end if;
  if v_run.status not in ('queued', 'running') then return true; end if;

  perform public.release_credits(v_run.id, p_release_idempotency_key);
  update public.search_task_runs as run
  set status = 'cancelled', finished_at = now(), stop_reason = 'queue_unavailable', updated_at = now()
  where run.id = v_run.id;
  update public.search_tasks as task
  set monthly_credit_reserved = greatest(0, task.monthly_credit_reserved - v_run.credits_reserved),
      last_run_status = 'cancelled', updated_at = now()
  where task.id = v_run.search_task_id and task.user_id = v_run.user_id;
  return true;
end;
$$;

create or replace function public.link_monitor_research_run(
  p_run_id uuid,
  p_research_run_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_run public.search_task_runs%rowtype;
begin
  select * into v_run from public.search_task_runs as run where run.id = p_run_id for update;
  if not found or v_run.status <> 'queued' then return false; end if;
  if not exists (
    select 1 from public.research_runs as research
    where research.id = p_research_run_id
      and research.user_id = v_run.user_id
      and research.search_task_id = v_run.search_task_id
  ) then return false; end if;
  update public.search_task_runs as run
  set research_run_id = p_research_run_id, updated_at = now()
  where run.id = v_run.id;
  return true;
end;
$$;

revoke all on function public.create_monitor_run(uuid, uuid, uuid, uuid, integer, jsonb) from public;
revoke all on function public.abort_monitor_run(uuid, text) from public;
revoke all on function public.link_monitor_research_run(uuid, uuid) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on table public.search_task_runs to service_role;
    grant execute on function public.create_monitor_run(uuid, uuid, uuid, uuid, integer, jsonb) to service_role;
    grant execute on function public.abort_monitor_run(uuid, text) to service_role;
    grant execute on function public.link_monitor_research_run(uuid, uuid) to service_role;
  else
    raise notice 'Talent Monitor run access remains closed: service_role does not exist';
  end if;
end $$;
