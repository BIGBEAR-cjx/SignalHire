-- P4 Client Delivery Loop hardening: independent weekly archive table.
--
-- Purpose:
--   Persist weekly client delivery archive snapshots outside report-version
--   derivation so future customer portals, exports, and audit views can read a
--   stable weekly delivery table.
--
-- Apply through the same Insforge raw SQL admin endpoint used by existing
-- migrations.

CREATE TABLE IF NOT EXISTS client_delivery_weekly_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  archive_id text NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  label text,
  latest_report_id text,
  latest_snapshot_id text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  reports jsonb NOT NULL DEFAULT '[]'::jsonb,
  latest_report_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id, archive_id)
);

CREATE INDEX IF NOT EXISTS client_delivery_weekly_archives_project_week_idx
  ON client_delivery_weekly_archives (project_id, week_start DESC);

CREATE INDEX IF NOT EXISTS client_delivery_weekly_archives_user_week_idx
  ON client_delivery_weekly_archives (user_id, week_start DESC);
