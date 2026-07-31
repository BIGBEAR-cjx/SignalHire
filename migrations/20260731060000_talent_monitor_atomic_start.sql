-- DB-owned monitor start contract. A Credits reservation, immutable monitor
-- run, and nonclaimable research row are committed together or not at all.
-- This is forward-only; it replaces the earlier two-RPC handoff safely.
alter table public.search_task_runs
  drop constraint if exists search_task_runs_status_check;
alter table public.search_task_runs
  add constraint search_task_runs_status_check
  check (status in ('pending', 'queued', 'running', 'done', 'failed', 'cancelled', 'blocked'));

drop index if exists public.search_task_runs_one_active_per_task_idx;
create unique index search_task_runs_one_active_per_task_idx
  on public.search_task_runs (search_task_id)
  where status in ('pending', 'queued', 'running');

create or replace function public.start_monitor_run(
  p_user_id uuid,
  p_search_task_id uuid,
  p_monitor_run_id uuid,
  p_research_run_id uuid,
  p_candidate_hints jsonb default '[]'::jsonb,
  p_platform_language text default 'Chinese (Simplified)'
)
returns table (
  monitor_run_id uuid,
  research_run_id uuid,
  run_status text,
  is_duplicate boolean,
  pause_reason text
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_task public.search_tasks%rowtype;
  v_existing public.search_task_runs%rowtype;
  v_reservation record;
  v_snapshot jsonb;
  v_amount integer;
begin
  select * into v_task
  from public.search_tasks as task
  where task.id = p_search_task_id and task.user_id = p_user_id
  for update;
  if not found then return; end if;

  select * into v_existing
  from public.search_task_runs as run
  where run.search_task_id = p_search_task_id
    and run.status in ('pending', 'queued', 'running')
  order by run.created_at asc
  limit 1;
  if found then
    return query select v_existing.id, v_existing.research_run_id, v_existing.status, true, null::text;
    return;
  end if;

  if v_task.status <> 'active' then
    return query select null::uuid, null::uuid, 'blocked'::text, false, coalesce(v_task.pause_reason, 'monitor_inactive');
    return;
  end if;

  v_amount := v_task.candidate_batch_size;
  if v_task.monthly_credit_used + v_task.monthly_credit_reserved + v_amount > v_task.monthly_credit_limit then
    update public.search_tasks as task
    set status = 'paused', pause_reason = 'monthly_credit_limit', updated_at = now()
    where task.id = v_task.id;
    return query select null::uuid, null::uuid, 'paused'::text, false, 'monthly_credit_limit'::text;
    return;
  end if;

  begin
    select * into v_reservation
    from public.reserve_credits(
      p_user_id,
      p_monitor_run_id,
      v_amount,
      'research-run:' || p_monitor_run_id::text
    );
  exception when others then
    if SQLERRM = 'insufficient available Credits' then
      update public.search_tasks as task
      set status = 'paused', pause_reason = 'insufficient_credits', updated_at = now()
      where task.id = v_task.id;
      return query select null::uuid, null::uuid, 'paused'::text, false, 'insufficient_credits'::text;
      return;
    end if;
    raise;
  end;

  if v_reservation.reservation_id is null or v_reservation.status <> 'reserved' then
    raise exception 'monitor Credits reservation was not confirmed';
  end if;

  v_snapshot := jsonb_build_object(
    'name', v_task.name,
    'brief', v_task.brief,
    'frequency', v_task.frequency,
    'candidate_batch_size', v_task.candidate_batch_size,
    'timezone', v_task.timezone,
    'schedule_time', to_char(v_task.schedule_time, 'HH24:MI'),
    'monthly_credit_limit', v_task.monthly_credit_limit,
    'notification_enabled', v_task.notification_enabled
  );

  insert into public.research_runs (
    id, cache_key, kind, flat_key, query_text, label, summary, result, stats,
    status, progress, error, last_error, attempt_count, max_attempts,
    locked_at, started_at, finished_at, user_id, project_id, search_task_id, updated_at
  ) values (
    p_research_run_id,
    'search:monitor-run:' || p_monitor_run_id::text,
    'search',
    'monitor-run:' || p_monitor_run_id::text,
    left(v_task.brief, 240),
    left(v_task.name || ' · Monitor run', 80),
    'Queued monitor research',
    null, null,
    'pending',
    jsonb_build_object(
      'original_query', v_task.brief,
      'platform_language', coalesce(nullif(btrim(p_platform_language), ''), 'Chinese (Simplified)'),
      'candidate_profile_hints', case when jsonb_typeof(p_candidate_hints) = 'array' then p_candidate_hints else '[]'::jsonb end,
      'agent_execution', jsonb_build_object('search_strategy', null)
    ),
    null, null, 0, 3,
    null, null, null, p_user_id, v_task.project_id, v_task.id, now()
  );

  insert into public.search_task_runs (
    id, user_id, search_task_id, research_run_id, status, credit_reservation_id,
    credits_reserved, config_snapshot
  ) values (
    p_monitor_run_id, p_user_id, v_task.id, p_research_run_id, 'pending',
    v_reservation.reservation_id, v_amount, v_snapshot
  );
  update public.search_tasks as task
  set monthly_credit_reserved = task.monthly_credit_reserved + v_amount,
      last_run_status = 'pending', updated_at = now()
  where task.id = v_task.id;
  return query select p_monitor_run_id, p_research_run_id, 'pending'::text, false, null::text;
end;
$$;

create or replace function public.activate_monitor_run(
  p_user_id uuid,
  p_monitor_run_id uuid,
  p_research_run_id uuid,
  p_next_run_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_run public.search_task_runs%rowtype;
  v_research public.research_runs%rowtype;
begin
  select * into v_run
  from public.search_task_runs as run
  where run.id = p_monitor_run_id and run.user_id = p_user_id
  for update;
  if not found then return 'blocked'; end if;
  if v_run.status in ('queued', 'running') then return v_run.status; end if;
  if v_run.status <> 'pending' or v_run.research_run_id <> p_research_run_id then return 'blocked'; end if;

  select * into v_research from public.research_runs as research where research.id = p_research_run_id for update;
  if not found
    or v_research.user_id <> v_run.user_id
    or v_research.search_task_id <> v_run.search_task_id
    or v_research.status <> 'pending' then
    return 'blocked';
  end if;

  update public.research_runs as research
  set status = 'queued', updated_at = now()
  where research.id = v_research.id and research.status = 'pending';
  if not found then return 'blocked'; end if;
  update public.search_task_runs as run
  set status = 'queued', updated_at = now()
  where run.id = v_run.id and run.status = 'pending';
  if not found then raise exception 'monitor activation lost its run lock'; end if;
  update public.search_tasks as task
  set last_run_at = now(), last_run_status = 'queued', pause_reason = null,
      next_run_at = p_next_run_at, updated_at = now()
  where task.id = v_run.search_task_id and task.user_id = v_run.user_id;
  return 'queued';
end;
$$;

create or replace function public.reconcile_stalled_monitor_runs(p_before timestamptz)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_run public.search_task_runs%rowtype;
  v_count integer := 0;
begin
  for v_run in
    select * from public.search_task_runs as run
    where run.status = 'pending' and run.updated_at <= p_before
    order by run.updated_at asc
    for update skip locked
  loop
    update public.research_runs as research
    set status = 'failed', error = 'monitor_pending_timeout', last_error = 'monitor_pending_timeout',
        finished_at = now(), updated_at = now()
    where research.id = v_run.research_run_id and research.status = 'pending';
    if not found then continue; end if;

    perform public.release_credits(v_run.id, 'research-run:' || v_run.id::text || ':release');
    update public.search_task_runs as run
    set status = 'cancelled', stop_reason = 'pending_timeout', finished_at = now(), updated_at = now()
    where run.id = v_run.id;
    update public.search_tasks as task
    set monthly_credit_reserved = greatest(0, task.monthly_credit_reserved - v_run.credits_reserved),
        last_run_status = 'cancelled', updated_at = now()
    where task.id = v_run.search_task_id and task.user_id = v_run.user_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.start_monitor_run(uuid, uuid, uuid, uuid, jsonb, text) from public;
revoke all on function public.activate_monitor_run(uuid, uuid, uuid, timestamptz) from public;
revoke all on function public.reconcile_stalled_monitor_runs(timestamptz) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.start_monitor_run(uuid, uuid, uuid, uuid, jsonb, text) to service_role;
    grant execute on function public.activate_monitor_run(uuid, uuid, uuid, timestamptz) to service_role;
    grant execute on function public.reconcile_stalled_monitor_runs(timestamptz) to service_role;
  else
    raise notice 'Atomic Talent Monitor start remains closed: service_role does not exist';
  end if;
end $$;
