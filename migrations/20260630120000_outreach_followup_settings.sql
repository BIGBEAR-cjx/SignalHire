alter table public.projects
  add column if not exists outreach_settings jsonb not null default '{}'::jsonb;
