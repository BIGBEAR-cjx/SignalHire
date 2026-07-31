-- Terminal monitor accounting is database-owned. A worker may retry any RPC,
-- but a run can settle or release its one reservation only once.
create or replace function public.mark_monitor_run_running(p_research_run_id uuid)
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
  where run.research_run_id = p_research_run_id
  for update;
  if not found then return 'not_monitor'; end if;

  select * into v_research
  from public.research_runs as research
  where research.id = p_research_run_id
  for update;
  if not found or v_research.status not in ('running', 'retrying') then return 'blocked'; end if;
  if v_run.status in ('done', 'failed', 'cancelled') then return v_run.status; end if;

  update public.search_task_runs as run
  set status = 'running', started_at = coalesce(run.started_at, pg_catalog.now()), updated_at = pg_catalog.now()
  where run.id = v_run.id and run.status in ('pending', 'queued', 'running');
  update public.search_tasks as task
  set last_run_status = 'running', updated_at = pg_catalog.now()
  where task.id = v_run.search_task_id and task.user_id = v_run.user_id;
  return 'running';
end;
$$;

create or replace function public.settle_monitor_run(p_research_run_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_run public.search_task_runs%rowtype;
  v_research public.research_runs%rowtype;
  v_reservation public.credit_reservations%rowtype;
  v_requested integer;
  v_returned integer;
  v_new integer;
  v_updated integer;
  v_seen integer;
  v_skipped integer;
begin
  select * into v_run
  from public.search_task_runs as run
  where run.research_run_id = p_research_run_id
  for update;
  if not found then return 'not_monitor'; end if;
  if v_run.status = 'done' then return 'settled'; end if;
  if v_run.status in ('failed', 'cancelled') then return v_run.status; end if;

  select * into v_research
  from public.research_runs as research
  where research.id = p_research_run_id
  for update;
  if not found or v_research.status <> 'done' then return 'blocked'; end if;
  if v_research.user_id <> v_run.user_id or v_research.search_task_id <> v_run.search_task_id then
    raise exception 'monitor run research linkage is invalid';
  end if;
  select * into v_reservation
  from public.credit_reservations as reservation
  where reservation.id = v_run.credit_reservation_id
  for update;
  if not found
    or v_reservation.run_id <> v_run.id
    or v_reservation.user_id <> v_run.user_id
    or v_reservation.reserved_amount <> v_run.credits_reserved
    or v_reservation.status <> 'reserved' then
    raise exception 'monitor run Credits reservation linkage is invalid';
  end if;
  if pg_catalog.jsonb_typeof(v_run.config_snapshot -> 'candidate_batch_size') <> 'number' then
    raise exception 'monitor run snapshot has no valid candidate batch size';
  end if;
  v_requested := (v_run.config_snapshot ->> 'candidate_batch_size')::integer;
  if v_requested not in (5, 10, 20) then
    raise exception 'monitor run snapshot has no valid candidate batch size';
  end if;
  if pg_catalog.jsonb_typeof(v_research.result -> 'candidates') <> 'array' then
    raise exception 'completed monitor research has no candidate array';
  end if;
  v_returned := pg_catalog.jsonb_array_length(v_research.result -> 'candidates');
  if v_returned > v_requested or v_returned > v_run.credits_reserved then
    raise exception 'completed monitor research exceeds immutable candidate batch';
  end if;

  select
    count(*) filter (where item ->> 'discovery_state' = 'new_candidate'),
    count(*) filter (where item ->> 'discovery_state' = 'seen_before' and coalesce((item ->> 'evidence_updated')::boolean, false) = false),
    count(*) filter (where coalesce((item ->> 'evidence_updated')::boolean, false) = true)
  into v_new, v_seen, v_updated
  from pg_catalog.jsonb_array_elements(coalesce(v_research.result #> '{task_discovery,items}', '[]'::jsonb)) as item;
  v_skipped := greatest(0, coalesce((v_research.result #>> '{task_discovery,summary,skipped_candidates}')::integer, 0));

  -- This happens only after the worker's done result has been persisted. The
  -- Credits RPC has its own run-id lock and exact idempotency key. A completed
  -- empty search is successful but consumes no Credits, so it releases instead
  -- of attempting the invalid settle_credits(..., 0, ...) operation.
  if v_returned = 0 then
    perform public.release_credits(v_run.id, 'research-run:' || v_run.id::text || ':release');
  else
    perform public.settle_credits(
      v_run.id,
      v_returned,
      'research-run:' || v_run.id::text || ':settle'
    );
  end if;
  update public.search_task_runs as run
  set status = 'done', requested_count = v_requested, returned_count = v_returned,
      new_candidates = v_new, updated_candidates = v_updated, seen_candidates = v_seen,
      skipped_candidates = v_skipped, credits_consumed = v_returned,
      credits_released = v_run.credits_reserved - v_returned,
      error_summary = null, finished_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where run.id = v_run.id;
  update public.search_tasks as task
  set monthly_credit_reserved = greatest(0, task.monthly_credit_reserved - v_run.credits_reserved),
      monthly_credit_used = task.monthly_credit_used + v_returned,
      last_run_status = 'done', updated_at = pg_catalog.now()
  where task.id = v_run.search_task_id and task.user_id = v_run.user_id;
  return 'settled';
end;
$$;

create or replace function public.release_monitor_run(
  p_research_run_id uuid,
  p_stop_reason text default 'failed'
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_run public.search_task_runs%rowtype;
  v_research public.research_runs%rowtype;
  v_reservation public.credit_reservations%rowtype;
  v_terminal_status text;
begin
  select * into v_run
  from public.search_task_runs as run
  where run.research_run_id = p_research_run_id
  for update;
  if not found then return 'not_monitor'; end if;
  if v_run.status = 'done' then return 'settled'; end if;
  if v_run.status in ('failed', 'cancelled') then return 'released'; end if;

  select * into v_research
  from public.research_runs as research
  where research.id = p_research_run_id
  for update;
  if not found or v_research.status not in ('error', 'canceled') then return 'blocked'; end if;
  if v_research.user_id <> v_run.user_id or v_research.search_task_id <> v_run.search_task_id then
    raise exception 'monitor run research linkage is invalid';
  end if;
  select * into v_reservation
  from public.credit_reservations as reservation
  where reservation.id = v_run.credit_reservation_id
  for update;
  if not found
    or v_reservation.run_id <> v_run.id
    or v_reservation.user_id <> v_run.user_id
    or v_reservation.reserved_amount <> v_run.credits_reserved
    or v_reservation.status <> 'reserved' then
    raise exception 'monitor run Credits reservation linkage is invalid';
  end if;
  v_terminal_status := case when v_research.status = 'canceled' then 'cancelled' else 'failed' end;

  perform public.release_credits(v_run.id, 'research-run:' || v_run.id::text || ':release');
  update public.search_task_runs as run
  set status = v_terminal_status, credits_consumed = 0, credits_released = v_run.credits_reserved,
      stop_reason = left(coalesce(nullif(btrim(p_stop_reason), ''), v_terminal_status), 120),
      error_summary = left(coalesce(v_research.last_error, v_research.error, v_terminal_status), 500),
      finished_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where run.id = v_run.id;
  update public.search_tasks as task
  set monthly_credit_reserved = greatest(0, task.monthly_credit_reserved - v_run.credits_reserved),
      last_run_status = v_terminal_status, updated_at = pg_catalog.now()
  where task.id = v_run.search_task_id and task.user_id = v_run.user_id;
  return 'released';
end;
$$;

create or replace function public.reconcile_monitor_run_outcomes(p_limit integer default 20)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_research_id uuid;
  v_count integer := 0;
begin
  for v_research_id in
    select run.research_run_id
    from public.search_task_runs as run
    join public.research_runs as research on research.id = run.research_run_id
    where run.status in ('pending', 'queued', 'running')
      and research.status in ('done', 'error', 'canceled')
    order by research.updated_at asc
    limit greatest(1, least(coalesce(p_limit, 20), 100))
    for update of run skip locked
  loop
    if (select status from public.research_runs where id = v_research_id) = 'done' then
      perform public.settle_monitor_run(v_research_id);
    else
      perform public.release_monitor_run(v_research_id, 'terminal_reconciliation');
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.mark_monitor_run_running(uuid) from public;
revoke all on function public.settle_monitor_run(uuid) from public;
revoke all on function public.release_monitor_run(uuid, text) from public;
revoke all on function public.reconcile_monitor_run_outcomes(integer) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.mark_monitor_run_running(uuid) to service_role;
    grant execute on function public.settle_monitor_run(uuid) to service_role;
    grant execute on function public.release_monitor_run(uuid, text) to service_role;
    grant execute on function public.reconcile_monitor_run_outcomes(integer) to service_role;
  else
    raise notice 'Talent Monitor terminal accounting remains closed: service_role does not exist';
  end if;
end $$;
