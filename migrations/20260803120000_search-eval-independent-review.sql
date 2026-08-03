-- Independent human review is recorded as append-only snapshots. A production
-- review record never updates the version-controlled Search Eval fixture.

create table if not exists public.search_eval_independent_review_sessions (
  id uuid primary key default gen_random_uuid(),
  reviewer_name text not null check (length(btrim(reviewer_name)) between 2 and 120),
  submitted_by_user_id uuid not null references auth.users(id) on delete restrict,
  submitted_by_email text not null check (submitted_by_email = lower(btrim(submitted_by_email))),
  fixture_version text not null check (length(btrim(fixture_version)) between 1 and 120),
  submitted_at timestamptz not null default now()
);

create index if not exists search_eval_independent_review_sessions_submitted_at_idx
  on public.search_eval_independent_review_sessions (submitted_at desc);

create table if not exists public.search_eval_independent_review_entries (
  review_session_id uuid not null references public.search_eval_independent_review_sessions(id) on delete restrict,
  case_id text not null check (length(btrim(case_id)) between 1 and 160),
  verdict text not null check (verdict in ('pass', 'revise', 'uncertain')),
  notes text not null default '' check (length(notes) <= 2000 and (verdict = 'pass' or length(btrim(notes)) > 0)),
  primary key (review_session_id, case_id)
);

create index if not exists search_eval_independent_review_entries_case_id_idx
  on public.search_eval_independent_review_entries (case_id);

create table if not exists public.search_eval_review_promotions (
  review_session_id uuid primary key references public.search_eval_independent_review_sessions(id) on delete restrict,
  confirmed_by_user_id uuid not null references auth.users(id) on delete restrict,
  confirmed_by_email text not null check (confirmed_by_email = lower(btrim(confirmed_by_email))),
  confirmed_at timestamptz not null default now()
);

alter table public.search_eval_independent_review_sessions enable row level security;
alter table public.search_eval_independent_review_entries enable row level security;
alter table public.search_eval_review_promotions enable row level security;

revoke all on table public.search_eval_independent_review_sessions from public;
revoke all on table public.search_eval_independent_review_entries from public;
revoke all on table public.search_eval_review_promotions from public;
revoke all on table public.search_eval_independent_review_sessions from anon, authenticated;
revoke all on table public.search_eval_independent_review_entries from anon, authenticated;
revoke all on table public.search_eval_review_promotions from anon, authenticated;

create or replace function public.prevent_search_eval_review_history_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Search Eval review history is append-only';
end;
$$;

create trigger search_eval_independent_review_sessions_append_only
before update or delete on public.search_eval_independent_review_sessions
for each row execute function public.prevent_search_eval_review_history_mutation();

create trigger search_eval_independent_review_entries_append_only
before update or delete on public.search_eval_independent_review_entries
for each row execute function public.prevent_search_eval_review_history_mutation();

create trigger search_eval_review_promotions_append_only
before update or delete on public.search_eval_review_promotions
for each row execute function public.prevent_search_eval_review_history_mutation();
