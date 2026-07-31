-- A partial settlement has two distinct ledger events: the actual consumption
-- and the release of unused reserved Credits. Preserve both balance snapshots.

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
  v_existing_entry_amount integer;
  v_has_existing_entry boolean := false;
  v_ledger_entry_id uuid;
  v_release_amount integer;
  v_settlement_amount integer;
  v_settle_available integer;
  v_settle_reserved integer;
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

  select ledger.entry_type, ledger.reservation_id, ledger.amount
  into v_existing_entry_type, v_existing_reservation_id, v_existing_entry_amount
  from public.credit_ledger_entries as ledger
  where ledger.user_id = v_reservation.user_id
    and ledger.idempotency_key = v_settle_key;
  v_has_existing_entry := found;

  if v_has_existing_entry and (v_existing_entry_type <> 'settle' or v_existing_reservation_id <> v_reservation.id) then
    raise exception 'idempotency key collides with a different Credits operation';
  end if;
  if v_reservation.status = 'settled' and v_reservation.settle_idempotency_key = v_settle_key then
    if v_reservation.settled_amount <> p_amount then
      raise exception 'idempotency key collides with a different settlement amount';
    end if;
    if not v_has_existing_entry or v_existing_entry_amount <> p_amount then
      raise exception 'settled Credits reservation has an invalid ledger entry';
    end if;
    select ledger.id into v_ledger_entry_id
    from public.credit_ledger_entries as ledger
    where ledger.user_id = v_reservation.user_id and ledger.idempotency_key = v_settle_key;
    return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, v_reservation.id, v_ledger_entry_id, v_reservation.status, true;
    return;
  end if;
  if v_reservation.status <> 'reserved' then raise exception 'Credits reservation is already closed'; end if;
  if v_has_existing_entry then raise exception 'idempotency key collides with an incomplete Credits operation'; end if;
  if p_amount > v_reservation.reserved_amount then raise exception 'settlement exceeds reserved Credits'; end if;

  v_settlement_amount := p_amount;
  v_release_amount := v_reservation.reserved_amount - v_settlement_amount;
  v_settle_available := v_account.available_credits;
  v_settle_reserved := v_account.reserved_credits - v_settlement_amount;
  if v_settle_reserved < 0 then raise exception 'reserved Credits balance is inconsistent'; end if;

  update public.credit_accounts as account
  set available_credits = account.available_credits + v_release_amount,
      reserved_credits = account.reserved_credits - v_reservation.reserved_amount,
      updated_at = pg_catalog.now()
  where account.user_id = v_reservation.user_id
  returning * into v_account;

  update public.credit_reservations as reservation
  set settled_amount = v_settlement_amount,
      released_amount = v_release_amount,
      status = 'settled',
      settle_idempotency_key = v_settle_key,
      updated_at = pg_catalog.now()
  where reservation.id = v_reservation.id
  returning * into v_reservation;

  insert into public.credit_ledger_entries (
    user_id, reservation_id, run_id, entry_type, amount, available_after, reserved_after, idempotency_key
  ) values (
    v_reservation.user_id, v_reservation.id, p_run_id, 'settle', v_settlement_amount,
    v_settle_available, v_settle_reserved, v_settle_key
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
