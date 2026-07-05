import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClientPortalProjectView,
  buildClientPortalWorkspaceView,
  filterClientPortalAuthorizedProjects,
} from "./web/lib/client-portal-workspace.mjs";

const viewer = { id: "customer-user", email: "hiring@client.ai" };

function project(overrides = {}) {
  return {
    id: "project-1",
    user_id: "owner-1",
    name: "Founding AI Engineer",
    brief: "Build applied AI systems",
    status: "open",
    updated_at: "2026-07-03T10:00:00.000Z",
    candidates_total: 8,
    outreach_settings: {
      client_delivery_access: {
        mode: "token_or_customer_account",
        allowed_emails: ["hiring@client.ai"],
        allowed_domains: [],
      },
    },
    ...overrides,
  };
}

test("filters customer portal projects by account access and excludes token-only projects", () => {
  const authorizedByEmail = project({ id: "email-match" });
  const authorizedByDomain = project({
    id: "domain-match",
    outreach_settings: {
      client_delivery_access: {
        mode: "token_or_customer_account",
        allowed_emails: [],
        allowed_domains: ["client.ai"],
      },
    },
  });
  const tokenOnly = project({
    id: "token-only",
    outreach_settings: { client_delivery_access: { mode: "token_only" } },
  });
  const notAllowed = project({
    id: "not-allowed",
    outreach_settings: {
      client_delivery_access: {
        mode: "token_or_customer_account",
        allowed_emails: ["other@example.com"],
        allowed_domains: ["example.com"],
      },
    },
  });

  const authorized = filterClientPortalAuthorizedProjects(
    [authorizedByEmail, authorizedByDomain, tokenOnly, notAllowed],
    viewer,
  );

  assert.deepEqual(authorized.map((item) => item.id), ["email-match", "domain-match"]);
  assert.equal(authorized[0].access_reason, "valid_customer_account");
  assert.equal(authorized[0].access.method, "email");
  assert.equal(authorized[1].access.method, "domain");
  assert.equal(authorized[1].access.matched, "client.ai");
});

test("builds a client-safe workspace summary from authorized projects", () => {
  const workspace = buildClientPortalWorkspaceView({
    viewer,
    projects: [
      project({ id: "project-1", name: "AI Infra Lead", updated_at: "2026-07-01T09:00:00.000Z" }),
      project({ id: "project-2", name: "ML Platform", updated_at: "2026-07-02T09:00:00.000Z" }),
    ],
    projectDetails: {
      "project-1": {
        deliverySummary: {
          metrics: { candidate_count: 6, contacted: 4, replied: 2, interested: 1, interview_ready: 1, confirmed: 0 },
          risks: ["Need stronger evidence on production ML"],
          next_actions: ["Confirm shortlist"],
        },
        weeklyArchives: [
          {
            archive_id: "week-1",
            week_start: "2026-06-29",
            week_end: "2026-07-05",
            metrics: { new_candidates: 3, contacted: 4, replied: 2, interview_ready: 1, confirmed: 0 },
            risks: ["internal debug risk should not leak"],
            next_actions: ["Review interview-ready queue"],
            latest_report_at: "2026-07-03T12:00:00.000Z",
          },
        ],
        candidateQueue: [
          { name: "Ava Chen", scheduling_state: "ready_to_schedule" },
        ],
      },
      "project-2": {
        deliverySummary: {
          metrics: { candidate_count: 2, contacted: 1, replied: 1, interested: 0, interview_ready: 0, confirmed: 0 },
          risks: [],
          next_actions: ["Wait for replies"],
        },
        weeklyArchives: [],
        candidateQueue: [],
      },
    },
    now: "2026-07-04T00:00:00.000Z",
  });

  assert.equal(workspace.summary.authorized_projects, 2);
  assert.equal(workspace.summary.interview_ready, 1);
  assert.equal(workspace.summary.this_week_replies, 2);
  assert.equal(workspace.summary.latest_activity, "2026-07-03T12:00:00.000Z");
  assert.deepEqual(workspace.projects.map((item) => item.id), ["project-1", "project-2"]);
  assert.equal(workspace.projects[0].access.viewer_email, "hiring@client.ai");
  assert.equal(JSON.stringify(workspace).includes("internal debug"), false);
  assert.equal(JSON.stringify(workspace).includes("allowed_emails"), false);
});

test("builds a client-safe project workspace with tabs, reports, feedback, and message history", () => {
  const view = buildClientPortalProjectView({
    viewer,
    project: project({ id: "project-1" }),
    reports: [
      {
        id: "report-1",
        kind: "search",
        label: "Week 27 client delivery",
        summary: "Latest shortlist",
        status: "done",
        updated_at: "2026-07-03T12:00:00.000Z",
        result: { execution_log: "should not leak" },
      },
    ],
    weeklyArchives: [
      {
        archive_id: "week-1",
        week_start: "2026-06-29",
        week_end: "2026-07-05",
        metrics: { new_candidates: 3, contacted: 4, replied: 2, interview_ready: 1, confirmed: 0 },
        risks: ["Risk: calendar not confirmed"],
        next_actions: ["Approve interview"],
        latest_report_at: "2026-07-03T12:00:00.000Z",
      },
    ],
    deliverySummary: {
      metrics: { candidate_count: 8, contacted: 4, replied: 2, interested: 1, interview_ready: 1, confirmed: 0 },
      risks: ["Risk: calendar not confirmed"],
      next_actions: ["Approve interview"],
    },
    candidateQueue: [
      {
        id: "candidate-1",
        name: "Ava Chen",
        headline: "Staff AI Engineer",
        evidence_summary: "Built production retrieval systems.",
        risks: ["May need relocation confirmation"],
        scheduling_state: "ready_to_schedule",
        next_action: "Send interview slots",
        message_history: { summary: { inbound: 1, outbound: 2, total: 3 } },
      },
    ],
    auditEvents: [
      {
        event_type: "feedback",
        actor: "Hiring manager",
        sentiment: "ready_to_interview",
        note: "Looks strong",
        report_href: "/r/report-1",
        event_at: "2026-07-03T13:00:00.000Z",
      },
      {
        event_type: "feedback",
        actor: "internal role_agent",
        sentiment: "debug",
        note: "execution_log",
        report_href: "/r/report-1",
        event_at: "2026-07-03T14:00:00.000Z",
      },
    ],
  });

  assert.equal(view.authorized, true);
  assert.equal(view.project.id, "project-1");
  assert.equal(view.summary.interview_ready, 1);
  assert.equal(view.access.method, "email");
  assert.equal(view.access.viewer_email, "hiring@client.ai");
  assert.equal(view.interview_ready_queue[0].message_history.summary.total, 3);
  assert.equal(view.reports[0].href, "/r/report-1");
  assert.deepEqual(view.tabs, ["overview", "interview-ready", "weekly-archive", "reports", "feedback"]);
  assert.equal(view.feedback_history.length, 1);
  assert.equal(JSON.stringify(view).includes("execution_log"), false);
  assert.equal(JSON.stringify(view).includes("role_agent"), false);
});
