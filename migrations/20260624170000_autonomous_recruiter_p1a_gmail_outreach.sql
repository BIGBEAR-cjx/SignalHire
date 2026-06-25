create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  gmail_address text not null default '',
  encrypted_token_bundle text not null default '',
  scope text not null default '',
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists gmail_connections_user_idx
  on public.gmail_connections (user_id, updated_at desc);

alter table public.outreach_threads
  add column if not exists contact_profile jsonb not null default '{"emails":[],"phones":[],"linkedin_url":"","contactability_score":0}'::jsonb,
  add column if not exists sequence_messages jsonb not null default '[]'::jsonb,
  add column if not exists approved_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists gmail_message_id text not null default '',
  add column if not exists gmail_thread_id text not null default '',
  add column if not exists send_error text not null default '';

create index if not exists outreach_threads_send_state_idx
  on public.outreach_threads (user_id, status, sent_at desc);
