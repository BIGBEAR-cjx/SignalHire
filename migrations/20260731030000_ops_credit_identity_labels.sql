-- Operator-recorded labels make a post-onboarding account findable by email.
-- They are not Auth-verified identities: the initial grant still requires a
-- separately validated user_id, and this mapping is immutable once recorded.

create table if not exists public.ops_credit_identity_labels (
  user_id uuid primary key,
  email text not null unique check (email = lower(btrim(email))),
  label_source text not null default 'ops_recorded' check (label_source = 'ops_recorded'),
  created_at timestamptz not null default now()
);

alter table public.ops_credit_identity_labels enable row level security;
revoke all on table public.ops_credit_identity_labels from public;

create or replace function public.record_ops_credit_identity_label(
  p_user_id uuid,
  p_email text
)
returns table (
  user_id uuid,
  email text,
  label_source text,
  duplicate boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_existing public.ops_credit_identity_labels%rowtype;
  v_email text;
begin
  if p_user_id is null then raise exception 'user id is required'; end if;
  v_email := lower(btrim(coalesce(p_email, '')));
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'email is required';
  end if;

  insert into public.ops_credit_identity_labels (user_id, email)
  values (p_user_id, v_email)
  on conflict do nothing
  returning * into v_existing;

  if found then
    return query select v_existing.user_id, v_existing.email, v_existing.label_source, false;
    return;
  end if;

  select * into v_existing
  from public.ops_credit_identity_labels as label
  where label.user_id = p_user_id;
  if found then
    if v_existing.email <> v_email then
      raise exception 'user id already has a different operator-recorded email label';
    end if;
    return query select v_existing.user_id, v_existing.email, v_existing.label_source, true;
    return;
  end if;

  select * into v_existing
  from public.ops_credit_identity_labels as label
  where label.email = v_email;
  if found then
    raise exception 'email already has a different operator-recorded user label';
  end if;

  raise exception 'operator-recorded email label could not be stored';
end;
$$;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    execute 'grant select on table public.ops_credit_identity_labels to service_role';
    execute 'grant execute on function public.record_ops_credit_identity_label(uuid, text) to service_role';
  end if;
end;
$$;

revoke all on function public.record_ops_credit_identity_label(uuid, text) from public;
