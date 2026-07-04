import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClientDeliveryAuditCenterCsv,
  buildClientDeliveryAuditCenterView,
} from "./web/lib/client-delivery-audit-center.mjs";

const projects = [
  { id: "project-1", name: "AI Infra Lead" },
  { id: "project-2", name: "Platform Engineer" },
];

const events = [
  {
    project_id: "project-1",
    event_type: "report_view",
    action_type: "shareable_client_delivery_loop",
    report_href: "/r/run-1?t=token",
    actor: "Client",
    detail: "/r/run-1?t=token",
    event_at: "2026-07-03T10:00:00.000Z",
  },
  {
    project_id: "project-1",
    event_type: "feedback",
    action_type: "client_delivery_feedback",
    report_href: "/r/run-1?t=token",
    actor: "Hiring Manager",
    sentiment: "ready_to_interview",
    note: "Move Ada forward.",
    detail: "Client feedback: ready_to_interview by Hiring Manager - Move Ada forward.",
    event_at: "2026-07-03T11:00:00.000Z",
  },
  {
    project_id: "project-2",
    event_type: "report_view",
    action_type: "shareable_client_delivery_loop",
    report_href: "/r/run-old?t=token",
    actor: "Client",
    detail: "debug: internal role_agent note",
    event_at: "2026-05-01T10:00:00.000Z",
  },
];

const weeklyArchives = [
  {
    project_id: "project-1",
    archive_id: "cda_week_1",
    week_start: "2026-06-29",
    week_end: "2026-07-05",
    label: "Week of Jun 29",
    latest_report_id: "run-1",
    latest_snapshot_id: "cds_1",
    metrics: { new_candidates: 4, contacted: 3, replied: 2, interview_ready: 1, confirmed: 1 },
    risks: ["One candidate needs compensation alignment.", "debug: hidden"],
    next_actions: ["Share confirmed interview with client.", "inspect execution_log"],
    reports: [{ id: "run-1", href: "/r/run-1?t=token", delivered_at: "2026-07-03T10:00:00.000Z" }],
    latest_report_at: "2026-07-03T10:00:00.000Z",
  },
];

test("builds client delivery audit center dashboard view", () => {
  const view = buildClientDeliveryAuditCenterView({
    projects,
    events,
    weeklyArchives,
    filters: { project: "all", range: "30d", type: "all" },
    now: "2026-07-04T00:00:00.000Z",
    locale: "en",
  });

  assert.deepEqual(view.summary, {
    report_views: 1,
    feedback: 1,
    weekly_archives: 1,
    latest_activity: "2026-07-03T11:00:00.000Z",
  });
  assert.deepEqual(view.events.map((event) => event.event_type), ["feedback", "report_view"]);
  assert.equal(view.events[0].project_name, "AI Infra Lead");
  assert.equal(view.weekly_archives[0].metrics.confirmed, 1);
  assert.doesNotMatch(JSON.stringify(view), /debug|execution_log|role_agent/i);
});

test("filters audit center by project range and event type", () => {
  const view = buildClientDeliveryAuditCenterView({
    projects,
    events,
    weeklyArchives,
    filters: { project: "project-1", range: "7d", type: "feedback" },
    now: "2026-07-04T00:00:00.000Z",
    locale: "en",
  });

  assert.equal(view.summary.report_views, 0);
  assert.equal(view.summary.feedback, 1);
  assert.equal(view.events.length, 1);
  assert.equal(view.events[0].event_type, "feedback");
  assert.equal(view.events[0].project_id, "project-1");
  assert.equal(view.weekly_archives.length, 1);
});

test("exports audit center rows with a stable csv header", () => {
  const view = buildClientDeliveryAuditCenterView({
    projects,
    events,
    weeklyArchives,
    filters: { project: "project-1", range: "30d", type: "all" },
    now: "2026-07-04T00:00:00.000Z",
    locale: "en",
  });
  const csv = buildClientDeliveryAuditCenterCsv(view);

  assert.equal(csv.split("\n")[0], "project,event_type,actor,sentiment,note,report_href,event_at,archive_id,week_start,week_end,latest_report_id");
  assert.match(csv, /AI Infra Lead,feedback,Hiring Manager,ready_to_interview,Move Ada forward\.,\/r\/run-1\?t=token,2026-07-03T11:00:00.000Z,,,,/);
  assert.match(csv, /AI Infra Lead,weekly_archive,,,,,,cda_week_1,2026-06-29,2026-07-05,run-1/);
  assert.doesNotMatch(csv, /debug|execution_log|role_agent/i);
});
