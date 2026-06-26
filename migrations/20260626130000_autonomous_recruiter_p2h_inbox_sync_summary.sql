-- Autonomous Recruiter P2h: persist project-level inbox sync visibility.

alter table public.projects
  add column if not exists inbox_sync_summary jsonb not null default '{}'::jsonb;
