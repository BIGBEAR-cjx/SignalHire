-- The return-table columns are PL/pgSQL variables. Qualify account fields in
-- the balance update so PostgreSQL does not confuse them with those outputs.
create or replace function public.reserve_credits(
  p_user_id uuid,
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
  v_existing_ledger_id uuid;
  v_ledger_entry_id uuid;
begin
  if p_user_id is null or p_run_id is null then raise exception 'user id and run id are required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be a positive integer'; end if;
  if p_idempotency_key is null or length(pg_catalog.btrim(p_idempotency_key)) not between 1 and 200 then raise exception 'idempotency key is required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_run_id::text, 0));
  insert into public.credit_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_account
  from public.credit_accounts as account
  where account.user_id = p_user_id
  for update;

  select * into v_reservation
  from public.credit_reservations as reservation
  where reservation.run_id = p_run_id;

  if found then
    if v_reservation.user_id <> p_user_id or v_reservation.reserved_amount <> p_amount or v_reservation.reserve_idempotency_key <> pg_catalog.btrim(p_idempotency_key) then
      raise exception 'run already has a different Credits reservation';
    end if;
    select ledger.id into v_existing_ledger_id
    from public.credit_ledger_entries as ledger
    where ledger.user_id = p_user_id and ledger.idempotency_key = pg_catalog.btrim(p_idempotency_key);
    return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, v_reservation.id, v_existing_ledger_id, v_reservation.status, true;
    return;
  end if;

  select ledger.id into v_existing_ledger_id
  from public.credit_ledger_entries as ledger
  where ledger.user_id = p_user_id and ledger.idempotency_key = pg_catalog.btrim(p_idempotency_key);
  if found then raise exception 'idempotency key already belongs to another Credits operation'; end if;
  if v_account.available_credits < p_amount then raise exception 'insufficient available Credits'; end if;

  update public.credit_accounts as account
  set available_credits = account.available_credits - p_amount,
      reserved_credits = account.reserved_credits + p_amount,
      updated_at = pg_catalog.now()
  where account.user_id = p_user_id
  returning * into v_account;

  insert into public.credit_reservations (user_id, run_id, reserved_amount, reserve_idempotency_key)
  values (p_user_id, p_run_id, p_amount, pg_catalog.btrim(p_idempotency_key))
  returning * into v_reservation;

  insert into public.credit_ledger_entries (
    user_id, reservation_id, run_id, entry_type, amount, available_after, reserved_after, idempotency_key
  ) values (
    p_user_id, v_reservation.id, p_run_id, 'reserve', p_amount, v_account.available_credits, v_account.reserved_credits, pg_catalog.btrim(p_idempotency_key)
  ) returning id into v_ledger_entry_id;

  return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, v_reservation.id, v_ledger_entry_id, v_reservation.status, false;
end;
$$;
