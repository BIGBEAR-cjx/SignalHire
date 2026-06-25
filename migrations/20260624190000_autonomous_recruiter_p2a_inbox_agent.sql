-- Autonomous Recruiter P2a: Gmail Inbox Agent + Interested Candidate Queue.
-- Stores only role-related Gmail threads that originated from SignalHire outreach.

create table if not exists public.inbox_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid references public.projects(id) on delete set null,
  outreach_thread_id uuid references public.outreach_threads(id) on delete cascade,
  shortlist_item_id uuid references public.shortlist_items(id) on delete set null,
  candidate_name text not null default '',
  gmail_thread_id text not null default '',
  gmail_message_id text not null default '',
  classification text not null default 'needs_human_reply',
  classification_reason text not null default '',
  last_message_excerpt text not null default '',
  suggested_reply text not null default '',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, gmail_thread_id)
);

create index if not exists inbox_threads_user_project_updated_idx
  on public.inbox_threads(user_id, project_id, updated_at desc);

create index if not exists inbox_threads_user_classification_updated_idx
  on public.inbox_threads(user_id, classification, updated_at desc);

create index if not exists inbox_threads_outreach_thread_idx
  on public.inbox_threads(outreach_thread_id);
