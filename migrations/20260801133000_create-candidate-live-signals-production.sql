create table if not exists public.candidate_live_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  candidate_merge_key text not null,
  provider text not null,
  type text not null,
  source_url text not null,
  summary text not null,
  confidence text not null default 'low',
  observed_at timestamptz not null,
  expires_at timestamptz not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_live_signals_source_url_https_check
    check (source_url ~ '^https://'),
  constraint candidate_live_signals_expires_after_observed_check
    check (expires_at > observed_at),
  constraint candidate_live_signals_evidence_key_unique
    unique (user_id, project_id, provider, candidate_merge_key, source_url, content_hash)
);

create index if not exists candidate_live_signals_project_expires_idx
  on public.candidate_live_signals (project_id, expires_at);
