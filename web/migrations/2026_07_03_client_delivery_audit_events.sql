-- P4 Client Delivery Loop hardening: independent audit events.
--
-- Purpose:
--   Persist client report view / feedback events outside project metrics JSON so
--   future customer portals, audit exports, and retention policies do not depend
--   only on role_agent_metrics.recent_events.
--
-- Apply through the same Insforge raw SQL admin endpoint used by existing
-- migrations.

CREATE TABLE IF NOT EXISTS client_delivery_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('report_view', 'feedback')),
  action_type text NOT NULL,
  report_href text,
  actor text,
  sentiment text,
  note text,
  detail text,
  event_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_delivery_audit_events_project_event_at_idx
  ON client_delivery_audit_events (project_id, event_at DESC);

CREATE INDEX IF NOT EXISTS client_delivery_audit_events_user_event_at_idx
  ON client_delivery_audit_events (user_id, event_at DESC);

CREATE INDEX IF NOT EXISTS client_delivery_audit_events_event_type_idx
  ON client_delivery_audit_events (event_type);
