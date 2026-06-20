create table if not exists public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_run_id uuid references public.research_runs(id) on delete set null,
  cache_key text not null unique,
  name text not null,
  "current_role" text,
  current_company text,
  role text not null default '',
  ai_directions jsonb not null default '[]'::jsonb,
  vertical_tags jsonb not null default '[]'::jsonb,
  match_score integer not null default 0,
  confidence text not null default 'medium',
  independent_sources integer not null default 0,
  source_types jsonb not null default '[]'::jsonb,
  evidence_urls jsonb not null default '[]'::jsonb,
  search_text text not null default '',
  profile jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists candidate_profiles_user_seen_idx
  on public.candidate_profiles (user_id, last_seen_at desc);

create index if not exists candidate_profiles_vertical_tags_gin_idx
  on public.candidate_profiles using gin (vertical_tags);

create index if not exists candidate_profiles_source_types_gin_idx
  on public.candidate_profiles using gin (source_types);

create table if not exists public.candidate_evidence_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_run_id uuid references public.research_runs(id) on delete set null,
  candidate_profile_cache_key text not null references public.candidate_profiles(cache_key) on delete cascade,
  cache_key text not null unique,
  candidate_name text not null,
  claim text not null default '',
  verdict text not null default 'unverified',
  note text not null default '',
  url text not null,
  host text not null default '',
  family text not null default 'other_public_source',
  coverage_group text not null default 'public_voice',
  source_type text not null default 'other',
  primary_id text not null default '',
  secondary_id text not null default '',
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists candidate_evidence_sources_user_idx
  on public.candidate_evidence_sources (user_id, observed_at desc);

create index if not exists candidate_evidence_sources_candidate_idx
  on public.candidate_evidence_sources (candidate_profile_cache_key);

create index if not exists candidate_evidence_sources_family_idx
  on public.candidate_evidence_sources (family, source_type);

create table if not exists public.open_evidence_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_run_id uuid references public.research_runs(id) on delete set null,
  cache_key text not null unique,
  query_text text not null default '',
  provider text not null,
  family text not null default 'open_evidence',
  coverage_group text not null default 'public_voice',
  source_type text not null default 'other',
  candidate_name text not null,
  title text not null default '',
  url text not null,
  metric integer not null default 0,
  year integer,
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists open_evidence_leads_user_idx
  on public.open_evidence_leads (user_id, observed_at desc);

create index if not exists open_evidence_leads_run_idx
  on public.open_evidence_leads (source_run_id);

create index if not exists open_evidence_leads_provider_idx
  on public.open_evidence_leads (provider, source_type);
