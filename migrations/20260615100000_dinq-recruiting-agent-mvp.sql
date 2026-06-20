create table if not exists public.search_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  brief text not null,
  frequency text not null default 'manual',
  status text not null default 'active',
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.research_runs
  add column if not exists search_task_id uuid references public.search_tasks(id) on delete set null;

create index if not exists search_tasks_user_project_idx
  on public.search_tasks (user_id, project_id, updated_at desc);

create index if not exists search_tasks_due_idx
  on public.search_tasks (status, next_run_at);

create index if not exists research_runs_search_task_idx
  on public.research_runs (search_task_id, updated_at desc);

create table if not exists public.outreach_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid references public.projects(id) on delete set null,
  shortlist_item_id uuid references public.shortlist_items(id) on delete set null,
  candidate_name text not null default '',
  candidate_snapshot jsonb not null default '{}'::jsonb,
  tone text not null default 'professional',
  role_brief text not null default '',
  subject text not null default '',
  body text not null default '',
  status text not null default 'drafted',
  notes text not null default '',
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outreach_threads_user_project_idx
  on public.outreach_threads (user_id, project_id, updated_at desc);

create index if not exists outreach_threads_shortlist_idx
  on public.outreach_threads (shortlist_item_id, updated_at desc);

create index if not exists outreach_threads_followup_idx
  on public.outreach_threads (user_id, next_follow_up_at, status);
