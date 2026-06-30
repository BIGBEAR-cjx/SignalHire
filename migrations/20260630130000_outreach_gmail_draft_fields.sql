alter table public.outreach_threads
  add column if not exists gmail_draft_id text not null default '',
  add column if not exists gmail_draft_updated_at timestamptz;
