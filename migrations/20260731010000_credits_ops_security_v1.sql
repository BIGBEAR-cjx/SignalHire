-- SECURITY MODEL: no browser role may access Credits tables or execute Credits
-- RPCs. The application calls these functions only from a server-side
-- service_role client. Run the deployment access/concurrency checks after this
-- migration because local contract tests cannot prove live role configuration.

alter table public.credit_accounts enable row level security;
alter table public.credit_ledger_entries enable row level security;
alter table public.credit_reservations enable row level security;
alter table public.ops_audit_events enable row level security;

create unique index if not exists ops_audit_events_ledger_entry_unique
  on public.ops_audit_events (credit_ledger_entry_id);

-- Existing functions were created in the initial Credits migration. Keep their
-- SQL bodies but remove public from resolution to prevent object shadowing.
alter function public.prevent_credits_history_mutation() set search_path = pg_catalog;
alter function public.reserve_credits(uuid, uuid, integer, text) set search_path = pg_catalog;

create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount integer,
  p_idempotency_key text,
  p_actor_user_id uuid default null,
  p_note text default ''
)
returns table (
  account_user_id uuid,
  available_credits integer,
  reserved_credits integer,
  reservation_id uuid,
  ledger_entry_id uuid,
  status text,
  duplicate boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_account public.credit_accounts%rowtype;
  v_existing_ledger_id uuid;
  v_existing_entry_type text;
  v_existing_amount integer;
  v_existing_actor_user_id uuid;
  v_existing_note text;
  v_ledger_entry_id uuid;
begin
  if p_user_id is null then raise exception 'user id is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be a positive integer'; end if;
  if p_idempotency_key is null or length(pg_catalog.btrim(p_idempotency_key)) not between 1 and 200 then raise exception 'idempotency key is required'; end if;

  insert into public.credit_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_account
  from public.credit_accounts as account
  where account.user_id = p_user_id
  for update;

  select ledger.id, ledger.entry_type, ledger.amount, ledger.actor_user_id, ledger.note
  into v_existing_ledger_id, v_existing_entry_type, v_existing_amount, v_existing_actor_user_id, v_existing_note
  from public.credit_ledger_entries as ledger
  where ledger.user_id = p_user_id
    and ledger.idempotency_key = pg_catalog.btrim(p_idempotency_key);

  if found then
    if v_existing_entry_type <> 'grant'
      or v_existing_amount <> p_amount
      or v_existing_actor_user_id is distinct from p_actor_user_id
      or v_existing_note <> coalesce(p_note, '') then
      raise exception 'idempotency key collides with a different Credits operation';
    end if;

    insert into public.ops_audit_events (
      actor_user_id, target_user_id, event_type, credit_ledger_entry_id, idempotency_key, detail
    ) values (
      p_actor_user_id, p_user_id, 'credits_granted', v_existing_ledger_id, pg_catalog.btrim(p_idempotency_key),
      pg_catalog.jsonb_build_object('amount', p_amount, 'reason', coalesce(p_note, ''))
    ) on conflict (credit_ledger_entry_id) do nothing;

    return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, null::uuid, v_existing_ledger_id, 'granted'::text, true;
    return;
  end if;

  update public.credit_accounts as account
  set available_credits = account.available_credits + p_amount,
      updated_at = pg_catalog.now()
  where account.user_id = p_user_id
  returning * into v_account;

  insert into public.credit_ledger_entries (
    user_id, entry_type, amount, available_after, reserved_after, idempotency_key, actor_user_id, note
  ) values (
    p_user_id, 'grant', p_amount, v_account.available_credits, v_account.reserved_credits,
    pg_catalog.btrim(p_idempotency_key), p_actor_user_id, coalesce(p_note, '')
  ) returning id into v_ledger_entry_id;

  insert into public.ops_audit_events (
    actor_user_id, target_user_id, event_type, credit_ledger_entry_id, idempotency_key, detail
  ) values (
    p_actor_user_id, p_user_id, 'credits_granted', v_ledger_entry_id, pg_catalog.btrim(p_idempotency_key),
    pg_catalog.jsonb_build_object('amount', p_amount, 'reason', coalesce(p_note, ''))
  ) on conflict (credit_ledger_entry_id) do nothing;

  return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, null::uuid, v_ledger_entry_id, 'granted'::text, false;
end;
$$;

create or replace function public.settle_credits(
  p_run_id uuid,
  p_amount integer,
  p_idempotency_key text
)
returns table (
  account_user_id uuid,
  available_credits integer,
  reserved_credits integer,
  reservation_id uuid,
  ledger_entry_id uuid,
  status text,
  duplicate boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_account public.credit_accounts%rowtype;
  v_reservation public.credit_reservations%rowtype;
  v_existing_entry_type text;
  v_existing_reservation_id uuid;
  v_ledger_entry_id uuid;
  v_release_amount integer;
  v_settle_key text;
  v_release_key text;
begin
  if p_run_id is null then raise exception 'run id is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be a positive integer'; end if;
  v_settle_key := 'research-run:' || p_run_id::text || ':settle';
  v_release_key := 'research-run:' || p_run_id::text || ':release';
  if p_idempotency_key is null or pg_catalog.btrim(p_idempotency_key) <> v_settle_key then
    raise exception 'idempotency key does not match the run settlement operation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_run_id::text, 0));
  select * into v_reservation
  from public.credit_reservations as reservation
  where reservation.run_id = p_run_id;
  if not found then raise exception 'Credits reservation not found'; end if;

  select * into v_account
  from public.credit_accounts as account
  where account.user_id = v_reservation.user_id
  for update;

  select ledger.entry_type, ledger.reservation_id
  into v_existing_entry_type, v_existing_reservation_id
  from public.credit_ledger_entries as ledger
  where ledger.user_id = v_reservation.user_id
    and ledger.idempotency_key = v_settle_key;

  if found and (v_existing_entry_type <> 'settle' or v_existing_reservation_id <> v_reservation.id) then
    raise exception 'idempotency key collides with a different Credits operation';
  end if;
  if v_reservation.status = 'settled' and v_reservation.settle_idempotency_key = v_settle_key then
    select ledger.id into v_ledger_entry_id
    from public.credit_ledger_entries as ledger
    where ledger.user_id = v_reservation.user_id and ledger.idempotency_key = v_settle_key;
    return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, v_reservation.id, v_ledger_entry_id, v_reservation.status, true;
    return;
  end if;
  if v_reservation.status <> 'reserved' then raise exception 'Credits reservation is already closed'; end if;
  if found then raise exception 'idempotency key collides with an incomplete Credits operation'; end if;
  if p_amount > v_reservation.reserved_amount then raise exception 'settlement exceeds reserved Credits'; end if;

  v_release_amount := v_reservation.reserved_amount - p_amount;
  update public.credit_accounts as account
  set available_credits = account.available_credits + v_release_amount,
      reserved_credits = account.reserved_credits - v_reservation.reserved_amount,
      updated_at = pg_catalog.now()
  where account.user_id = v_reservation.user_id
  returning * into v_account;

  update public.credit_reservations as reservation
  set settled_amount = p_amount,
      released_amount = v_release_amount,
      status = 'settled',
      settle_idempotency_key = v_settle_key,
      updated_at = pg_catalog.now()
  where reservation.id = v_reservation.id
  returning * into v_reservation;

  insert into public.credit_ledger_entries (
    user_id, reservation_id, run_id, entry_type, amount, available_after, reserved_after, idempotency_key
  ) values (
    v_reservation.user_id, v_reservation.id, p_run_id, 'settle', p_amount,
    v_account.available_credits, v_account.reserved_credits, v_settle_key
  ) returning id into v_ledger_entry_id;

  if v_release_amount > 0 then
    insert into public.credit_ledger_entries (
      user_id, reservation_id, run_id, entry_type, amount, available_after, reserved_after, idempotency_key
    ) values (
      v_reservation.user_id, v_reservation.id, p_run_id, 'release', v_release_amount,
      v_account.available_credits, v_account.reserved_credits, v_release_key
    );
  end if;

  return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, v_reservation.id, v_ledger_entry_id, v_reservation.status, false;
end;
$$;

create or replace function public.release_credits(
  p_run_id uuid,
  p_idempotency_key text
)
returns table (
  account_user_id uuid,
  available_credits integer,
  reserved_credits integer,
  reservation_id uuid,
  ledger_entry_id uuid,
  status text,
  duplicate boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_account public.credit_accounts%rowtype;
  v_reservation public.credit_reservations%rowtype;
  v_existing_entry_type text;
  v_existing_reservation_id uuid;
  v_ledger_entry_id uuid;
  v_release_key text;
begin
  if p_run_id is null then raise exception 'run id is required'; end if;
  v_release_key := 'research-run:' || p_run_id::text || ':release';
  if p_idempotency_key is null or pg_catalog.btrim(p_idempotency_key) <> v_release_key then
    raise exception 'idempotency key does not match the run release operation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_run_id::text, 0));
  select * into v_reservation
  from public.credit_reservations as reservation
  where reservation.run_id = p_run_id;
  if not found then raise exception 'Credits reservation not found'; end if;

  select * into v_account
  from public.credit_accounts as account
  where account.user_id = v_reservation.user_id
  for update;

  select ledger.entry_type, ledger.reservation_id
  into v_existing_entry_type, v_existing_reservation_id
  from public.credit_ledger_entries as ledger
  where ledger.user_id = v_reservation.user_id
    and ledger.idempotency_key = v_release_key;

  if found and (v_existing_entry_type <> 'release' or v_existing_reservation_id <> v_reservation.id) then
    raise exception 'idempotency key collides with a different Credits operation';
  end if;
  if v_reservation.status = 'released' and v_reservation.release_idempotency_key = v_release_key then
    select ledger.id into v_ledger_entry_id
    from public.credit_ledger_entries as ledger
    where ledger.user_id = v_reservation.user_id and ledger.idempotency_key = v_release_key;
    return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, v_reservation.id, v_ledger_entry_id, v_reservation.status, true;
    return;
  end if;
  if v_reservation.status <> 'reserved' then raise exception 'Credits reservation is already closed'; end if;
  if found then raise exception 'idempotency key collides with an incomplete Credits operation'; end if;

  update public.credit_accounts as account
  set available_credits = account.available_credits + v_reservation.reserved_amount,
      reserved_credits = account.reserved_credits - v_reservation.reserved_amount,
      updated_at = pg_catalog.now()
  where account.user_id = v_reservation.user_id
  returning * into v_account;

  update public.credit_reservations as reservation
  set released_amount = reservation.reserved_amount,
      status = 'released',
      release_idempotency_key = v_release_key,
      updated_at = pg_catalog.now()
  where reservation.id = v_reservation.id
  returning * into v_reservation;

  insert into public.credit_ledger_entries (
    user_id, reservation_id, run_id, entry_type, amount, available_after, reserved_after, idempotency_key
  ) values (
    v_reservation.user_id, v_reservation.id, p_run_id, 'release', v_reservation.reserved_amount,
    v_account.available_credits, v_account.reserved_credits, v_release_key
  ) returning id into v_ledger_entry_id;

  return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, v_reservation.id, v_ledger_entry_id, v_reservation.status, false;
end;
$$;

revoke all on function public.grant_credits(uuid, integer, text, uuid, text) from public;
revoke all on function public.reserve_credits(uuid, uuid, integer, text) from public;
revoke all on function public.settle_credits(uuid, integer, text) from public;
revoke all on function public.release_credits(uuid, text) from public;

do $$
declare
  v_role text;
  v_function_signature text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = v_role) then
      foreach v_function_signature in array array[
        'public.grant_credits(uuid, integer, text, uuid, text)',
        'public.reserve_credits(uuid, uuid, integer, text)',
        'public.settle_credits(uuid, integer, text)',
        'public.release_credits(uuid, text)'
      ] loop
        execute pg_catalog.format('revoke all on function %s from %I', v_function_signature, v_role);
      end loop;
    end if;
  end loop;

  -- Deployment preflight must confirm that the server API key maps to this
  -- role. If InsForge uses a differently named privileged role, this migration
  -- intentionally leaves RPC execution closed until a deployment-specific grant.
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.grant_credits(uuid, integer, text, uuid, text) to service_role';
    execute 'grant execute on function public.reserve_credits(uuid, uuid, integer, text) to service_role';
    execute 'grant execute on function public.settle_credits(uuid, integer, text) to service_role';
    execute 'grant execute on function public.release_credits(uuid, text) to service_role';
  else
    raise notice 'Credits RPC execution remains closed: service_role does not exist';
  end if;

  foreach v_role in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = v_role) then
      execute pg_catalog.format('revoke all on table public.credit_accounts, public.credit_ledger_entries, public.credit_reservations, public.ops_audit_events from %I', v_role);
    end if;
  end loop;
end;
$$;

revoke all on table public.credit_accounts from public;
revoke all on table public.credit_ledger_entries from public;
revoke all on table public.credit_reservations from public;
revoke all on table public.ops_audit_events from public;
