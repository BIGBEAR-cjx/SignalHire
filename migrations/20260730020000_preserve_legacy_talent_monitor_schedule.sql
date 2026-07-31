-- Existing daily/weekly tasks predate Monitor schedule_time. Preserve their
-- established UTC cadence after the v2 columns received their defaults.
update public.search_tasks
set schedule_time = to_char(
  coalesce(next_run_at, last_run_at, created_at) at time zone 'UTC',
  'HH24:MI'
)::time
where frequency in ('daily', 'weekly');
