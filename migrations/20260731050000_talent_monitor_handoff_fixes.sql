-- Tighten the monitor run handoff after the initial v2 migration. This is a
-- forward migration so already-deployed environments receive the same checks.
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
  v_reservation public.credit_reservations%rowtype;
begin
  if p_credits_reserved <= 0 or p_config_snapshot is null then
    raise exception 'invalid monitor run input';
  end if;

  select * into v_task
  from public.search_tasks as task
  where task.id = p_search_task_id and task.user_id = p_user_id
  for update;
  if not found then return; end if;

  select * into v_reservation
  from public.credit_reservations as reservation
  where reservation.id = p_credit_reservation_id
  for update;
  if not found
    or v_reservation.user_id <> p_user_id
    or v_reservation.run_id <> p_run_id
    or v_reservation.status <> 'reserved'
    or v_reservation.reserved_amount <> p_credits_reserved then
    raise exception 'invalid monitor Credits reservation';
  end if;

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
  p_release_idempotency_key text,
  p_research_run_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_run public.search_task_runs%rowtype;
  v_research public.research_runs%rowtype;
begin
  select * into v_run from public.search_task_runs as run where run.id = p_run_id for update;
  if not found then return false; end if;
  if v_run.status not in ('queued', 'running') then return true; end if;

  if p_research_run_id is not null then
    select * into v_research from public.research_runs as research where research.id = p_research_run_id for update;
    if not found
      or v_research.user_id <> v_run.user_id
      or v_research.search_task_id <> v_run.search_task_id
      or v_research.status <> 'queued' then
      return false;
    end if;
    update public.research_runs as research
    set status = 'failed', error = 'monitor_handoff_failed', last_error = 'monitor_handoff_failed',
        finished_at = now(), updated_at = now()
    where research.id = v_research.id and research.status = 'queued';
    if not found then return false; end if;
  elsif v_run.research_run_id is not null then
    return false;
  end if;

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

revoke all on function public.create_monitor_run(uuid, uuid, uuid, uuid, integer, jsonb) from public;
revoke all on function public.abort_monitor_run(uuid, text, uuid) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.create_monitor_run(uuid, uuid, uuid, uuid, integer, jsonb) to service_role;
    grant execute on function public.abort_monitor_run(uuid, text, uuid) to service_role;
  else
    raise notice 'Talent Monitor handoff remains closed: service_role does not exist';
  end if;
end $$;
