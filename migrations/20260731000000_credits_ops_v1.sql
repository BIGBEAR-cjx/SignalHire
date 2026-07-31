-- Credits balances are mutated only by the RPCs in this migration. Ledger and
-- operations-audit rows are immutable, so every material balance change remains explainable.

create table if not exists public.credit_accounts (
  user_id uuid primary key,
  available_credits integer not null default 0 check (available_credits >= 0),
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  run_id uuid not null,
  reserved_amount integer not null check (reserved_amount > 0),
  settled_amount integer not null default 0 check (settled_amount >= 0),
  released_amount integer not null default 0 check (released_amount >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'settled', 'released')),
  reserve_idempotency_key text not null check (length(btrim(reserve_idempotency_key)) between 1 and 200),
  settle_idempotency_key text check (settle_idempotency_key is null or length(btrim(settle_idempotency_key)) between 1 and 200),
  release_idempotency_key text check (release_idempotency_key is null or length(btrim(release_idempotency_key)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_reservations_amounts_check check (settled_amount + released_amount <= reserved_amount),
  constraint credit_reservations_status_amounts_check check (
    (status = 'reserved' and settled_amount = 0 and released_amount = 0)
    or (status = 'settled' and settled_amount + released_amount = reserved_amount)
    or (status = 'released' and settled_amount = 0 and released_amount = reserved_amount)
  ),
  unique (run_id),
  unique (user_id, reserve_idempotency_key)
);

create index if not exists credit_reservations_user_status_idx
  on public.credit_reservations (user_id, status, updated_at desc);

create table if not exists public.credit_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  reservation_id uuid references public.credit_reservations(id) on delete restrict,
  run_id uuid,
  entry_type text not null check (entry_type in ('grant', 'reserve', 'settle', 'release')),
  amount integer not null check (amount > 0),
  available_after integer not null check (available_after >= 0),
  reserved_after integer not null check (reserved_after >= 0),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 1 and 200),
  actor_user_id uuid,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists credit_ledger_entries_user_created_idx
  on public.credit_ledger_entries (user_id, created_at desc);

create index if not exists credit_ledger_entries_reservation_idx
  on public.credit_ledger_entries (reservation_id, created_at asc);

create table if not exists public.ops_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  target_user_id uuid,
  event_type text not null,
  credit_ledger_entry_id uuid references public.credit_ledger_entries(id) on delete restrict,
  idempotency_key text check (idempotency_key is null or length(btrim(idempotency_key)) between 1 and 200),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(detail) = 'object')
);

create index if not exists ops_audit_events_created_idx
  on public.ops_audit_events (created_at desc);

create or replace function public.prevent_credits_history_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Credits history is append-only';
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.credit_ledger_entries'::regclass
      and tgname = 'credit_ledger_entries_append_only'
      and not tgisinternal
  ) then
    create trigger credit_ledger_entries_append_only
    before update or delete on public.credit_ledger_entries
    for each row execute function public.prevent_credits_history_mutation();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.ops_audit_events'::regclass
      and tgname = 'ops_audit_events_append_only'
      and not tgisinternal
  ) then
    create trigger ops_audit_events_append_only
    before update or delete on public.ops_audit_events
    for each row execute function public.prevent_credits_history_mutation();
  end if;
end $$;

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
set search_path = public, pg_temp
as $$
declare
  v_account public.credit_accounts%rowtype;
  v_existing_ledger_id uuid;
  v_ledger_entry_id uuid;
begin
  if p_user_id is null then raise exception 'user id is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be a positive integer'; end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then raise exception 'idempotency key is required'; end if;

  insert into public.credit_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_account
  from public.credit_accounts
  where user_id = p_user_id
  for update;

  select id into v_existing_ledger_id
  from public.credit_ledger_entries
  where user_id = p_user_id and idempotency_key = btrim(p_idempotency_key);

  if found then
    return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, null::uuid, v_existing_ledger_id, 'granted'::text, true;
    return;
  end if;

  update public.credit_accounts
  set available_credits = available_credits + p_amount, updated_at = now()
  where user_id = p_user_id
  returning * into v_account;

  insert into public.credit_ledger_entries (
    user_id, entry_type, amount, available_after, reserved_after, idempotency_key, actor_user_id, note
  ) values (
    p_user_id, 'grant', p_amount, v_account.available_credits, v_account.reserved_credits, btrim(p_idempotency_key), p_actor_user_id, coalesce(p_note, '')
  ) returning id into v_ledger_entry_id;

  return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, null::uuid, v_ledger_entry_id, 'granted'::text, false;
end;
$$;

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
set search_path = public, pg_temp
as $$
declare
  v_account public.credit_accounts%rowtype;
  v_reservation public.credit_reservations%rowtype;
  v_existing_ledger_id uuid;
  v_ledger_entry_id uuid;
begin
  if p_user_id is null or p_run_id is null then raise exception 'user id and run id are required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be a positive integer'; end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then raise exception 'idempotency key is required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_run_id::text, 0));
  insert into public.credit_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_account
  from public.credit_accounts
  where user_id = p_user_id
  for update;

  select * into v_reservation
  from public.credit_reservations
  where run_id = p_run_id;

  if found then
    if v_reservation.user_id <> p_user_id or v_reservation.reserved_amount <> p_amount or v_reservation.reserve_idempotency_key <> btrim(p_idempotency_key) then
      raise exception 'run already has a different Credits reservation';
    end if;
    select id into v_existing_ledger_id
    from public.credit_ledger_entries
    where user_id = p_user_id and idempotency_key = btrim(p_idempotency_key);
    return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, v_reservation.id, v_existing_ledger_id, v_reservation.status, true;
    return;
  end if;

  select id into v_existing_ledger_id
  from public.credit_ledger_entries
  where user_id = p_user_id and idempotency_key = btrim(p_idempotency_key);
  if found then raise exception 'idempotency key already belongs to another Credits operation'; end if;
  if v_account.available_credits < p_amount then raise exception 'insufficient available Credits'; end if;

  update public.credit_accounts
  set available_credits = available_credits - p_amount,
      reserved_credits = reserved_credits + p_amount,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_account;

  insert into public.credit_reservations (user_id, run_id, reserved_amount, reserve_idempotency_key)
  values (p_user_id, p_run_id, p_amount, btrim(p_idempotency_key))
  returning * into v_reservation;

  insert into public.credit_ledger_entries (
    user_id, reservation_id, run_id, entry_type, amount, available_after, reserved_after, idempotency_key
  ) values (
    p_user_id, v_reservation.id, p_run_id, 'reserve', p_amount, v_account.available_credits, v_account.reserved_credits, btrim(p_idempotency_key)
  ) returning id into v_ledger_entry_id;

  return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, v_reservation.id, v_ledger_entry_id, v_reservation.status, false;
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
set search_path = public, pg_temp
as $$
declare
  v_account public.credit_accounts%rowtype;
  v_reservation public.credit_reservations%rowtype;
  v_ledger_entry_id uuid;
  v_release_amount integer;
  v_release_key text;
begin
  if p_run_id is null then raise exception 'run id is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be a positive integer'; end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 190 then raise exception 'idempotency key is required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_run_id::text, 0));
  select * into v_reservation from public.credit_reservations where run_id = p_run_id;
  if not found then raise exception 'Credits reservation not found'; end if;

  select * into v_account
  from public.credit_accounts
  where user_id = v_reservation.user_id
  for update;

  if v_reservation.status = 'settled' and v_reservation.settle_idempotency_key = btrim(p_idempotency_key) then
    select id into v_ledger_entry_id
    from public.credit_ledger_entries
    where user_id = v_reservation.user_id and idempotency_key = btrim(p_idempotency_key);
    return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, v_reservation.id, v_ledger_entry_id, v_reservation.status, true;
    return;
  end if;
  if v_reservation.status <> 'reserved' then raise exception 'Credits reservation is already closed'; end if;
  if p_amount > v_reservation.reserved_amount then raise exception 'settlement exceeds reserved Credits'; end if;

  v_release_amount := v_reservation.reserved_amount - p_amount;
  v_release_key := btrim(p_idempotency_key) || ':release';

  update public.credit_accounts
  set available_credits = available_credits + v_release_amount,
      reserved_credits = reserved_credits - v_reservation.reserved_amount,
      updated_at = now()
  where user_id = v_reservation.user_id
  returning * into v_account;

  update public.credit_reservations
  set settled_amount = p_amount,
      released_amount = v_release_amount,
      status = 'settled',
      settle_idempotency_key = btrim(p_idempotency_key),
      updated_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  insert into public.credit_ledger_entries (
    user_id, reservation_id, run_id, entry_type, amount, available_after, reserved_after, idempotency_key
  ) values (
    v_reservation.user_id, v_reservation.id, p_run_id, 'settle', p_amount, v_account.available_credits, v_account.reserved_credits, btrim(p_idempotency_key)
  ) returning id into v_ledger_entry_id;

  if v_release_amount > 0 then
    insert into public.credit_ledger_entries (
      user_id, reservation_id, run_id, entry_type, amount, available_after, reserved_after, idempotency_key
    ) values (
      v_reservation.user_id, v_reservation.id, p_run_id, 'release', v_release_amount, v_account.available_credits, v_account.reserved_credits, v_release_key
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
set search_path = public, pg_temp
as $$
declare
  v_account public.credit_accounts%rowtype;
  v_reservation public.credit_reservations%rowtype;
  v_ledger_entry_id uuid;
begin
  if p_run_id is null then raise exception 'run id is required'; end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then raise exception 'idempotency key is required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_run_id::text, 0));
  select * into v_reservation from public.credit_reservations where run_id = p_run_id;
  if not found then raise exception 'Credits reservation not found'; end if;

  select * into v_account
  from public.credit_accounts
  where user_id = v_reservation.user_id
  for update;

  if v_reservation.status = 'released' and v_reservation.release_idempotency_key = btrim(p_idempotency_key) then
    select id into v_ledger_entry_id
    from public.credit_ledger_entries
    where user_id = v_reservation.user_id and idempotency_key = btrim(p_idempotency_key);
    return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, v_reservation.id, v_ledger_entry_id, v_reservation.status, true;
    return;
  end if;
  if v_reservation.status <> 'reserved' then raise exception 'Credits reservation is already closed'; end if;

  update public.credit_accounts
  set available_credits = available_credits + v_reservation.reserved_amount,
      reserved_credits = reserved_credits - v_reservation.reserved_amount,
      updated_at = now()
  where user_id = v_reservation.user_id
  returning * into v_account;

  update public.credit_reservations
  set released_amount = reserved_amount,
      status = 'released',
      release_idempotency_key = btrim(p_idempotency_key),
      updated_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  insert into public.credit_ledger_entries (
    user_id, reservation_id, run_id, entry_type, amount, available_after, reserved_after, idempotency_key
  ) values (
    v_reservation.user_id, v_reservation.id, p_run_id, 'release', v_reservation.reserved_amount, v_account.available_credits, v_account.reserved_credits, btrim(p_idempotency_key)
  ) returning id into v_ledger_entry_id;

  return query select v_account.user_id, v_account.available_credits, v_account.reserved_credits, v_reservation.id, v_ledger_entry_id, v_reservation.status, false;
end;
$$;
