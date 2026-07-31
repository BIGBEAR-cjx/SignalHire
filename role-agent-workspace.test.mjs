import test from "node:test";
import assert from "node:assert/strict";
import { buildRoleAgentWorkspaceView } from "./web/lib/role-agent-workspace.mjs";

test("builds P0 role agent workspace goals health next actions and activity", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-1", status: "active" },
    settings: {
      agent_status: "active",
      capacity_goal: { contacted: 4, replied: 2, interested: 1, interview_ready: 1 },
    },
    leadPreview: {
      status: "preview_available",
      summary: { item_count: 3, can_outreach_count: 0 },
      items: [
        { id: "lead-1", candidate_name: "Preview Lead" },
        { id: "lead-2", candidate_name: "Second Lead" },
      ],
    },
    candidateGraph: {
      summary: {
        candidate_count: 2,
        contactable_count: 1,
        ready_for_outreach_count: 1,
        needs_verification_count: 1,
        interview_ready_count: 0,
      },
    },
    outreachQueue: {
      items: [
        {
          id: "draft-1",
          candidate_name: "No Contact",
          status: "drafted",
          updated_at: "2026-07-02T10:00:00.000Z",
          contact_profile: { emails: [] },
        },
        {
          id: "approved-1",
          candidate_name: "Ready Candidate",
          status: "approved",
          updated_at: "2026-07-02T11:00:00.000Z",
          contact_profile: { emails: [{ value: "ready@example.ai", source: "hunter", confidence: "high", deliverability_status: "valid" }] },
        },
        {
          id: "follow-1",
          candidate_name: "Follow Candidate",
          status: "follow_up_due",
          updated_at: "2026-07-02T12:00:00.000Z",
          contact_profile: { emails: [{ value: "follow@example.ai", source: "hunter", confidence: "high", deliverability_status: "valid" }] },
        },
      ],
    },
    sequenceAnalytics: { summary: { sent: 1, replied: 0, interested: 0, due_follow_up: 1 } },
    inboxQueue: {
      summary: { total: 1, interested: 1, needs_human_reply: 0 },
      interested_candidates: [{ id: "inbox-1", candidate_name: "Interested Candidate", updated_at: "2026-07-02T13:00:00.000Z" }],
    },
    searchTasks: [],
    latestRun: { status: "done", updated_at: "2026-07-02T09:00:00.000Z" },
    locale: "en",
  });

  assert.equal(view.status, "review_required");
  assert.equal(view.goals_configured, true);
  assert.deepEqual(view.goals, { contacted: 4, replied: 2, interested: 1, interview_ready: 1 });
  assert.deepEqual(view.counts, {
    candidates: 2,
    preview_leads: 3,
    contacted: 1,
    replied: 0,
    interested: 1,
    interview_ready: 0,
  });
  assert.equal(view.health.candidate_gap, false);
  assert.equal(view.health.contact_gap, true);
  assert.equal(view.health.reply_gap, true);
  assert.equal(view.health.interview_gap, true);
  assert.ok(view.health.blocked_actions.includes("missing_contact"));
  assert.deepEqual(view.next_actions.map((action) => action.type), [
    "review_interested_candidates",
    "resolve_contacts",
    "approve_or_send_outreach",
    "follow_up",
    "review_preview_leads",
  ]);
  assert.equal(view.next_actions[0].affected_count, 1);
  assert.match(view.next_actions[1].reason, /missing contact/i);
  assert.ok(view.activity.some((entry) => entry.context === "Ready Candidate"));
});

test("keeps paused role agent visible while marking next actions as manual review", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-paused", status: "active" },
    settings: { agent_status: "paused", capacity_goal: { contacted: 2, replied: 1, interested: 1, interview_ready: 1 } },
    candidateGraph: { summary: { candidate_count: 0, contactable_count: 0, interview_ready_count: 0 } },
    leadPreview: { status: "waiting_for_leads", summary: { item_count: 0 }, items: [] },
    searchTasks: [],
    outreachQueue: { items: [] },
    inboxQueue: { summary: { interested: 0 }, interested_candidates: [] },
    locale: "zh",
  });

  assert.equal(view.status, "paused");
  assert.equal(view.goals_configured, true);
  assert.equal(view.health.candidate_gap, true);
  assert.equal(view.next_actions[0].type, "run_sourcing");
  assert.equal(view.next_actions[0].blocked_reason, "agent_paused");
  assert.match(view.next_actions[0].label, /运行搜索/);
});

test("marks default role agent goals as not configured", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-default", status: "active" },
    settings: {},
    candidateGraph: { summary: { candidate_count: 0 } },
    leadPreview: { summary: { item_count: 0 } },
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
  });

  assert.equal(view.goals_configured, false);
  assert.deepEqual(view.goals, { contacted: 0, replied: 0, interested: 0, interview_ready: 0 });
});

test("adds role agent metric events to recent activity", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-activity", status: "active" },
    settings: {},
    roleAgentMetrics: {
      recent_events: [
        { event_type: "settings_update", action_type: "capacity_goal", at: "2026-07-03T09:02:00.000Z" },
        { event_type: "next_action_execution", action_type: "resolve_contacts", action_status: "failed", detail: "Contact provider unavailable.", at: "2026-07-03T09:01:30.000Z" },
        { event_type: "next_action_click", action_type: "resolve_contacts", at: "2026-07-03T09:01:00.000Z" },
      ],
    },
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
    latestRun: { status: "done", updated_at: "2026-07-03T09:00:00.000Z" },
    locale: "en",
  });

  assert.equal(view.activity[0].label, "Role Agent settings update");
  assert.equal(view.activity[0].context, "Capacity goals");
  assert.equal(view.activity[1].label, "Role Agent action failed");
  assert.equal(view.activity[1].context, "Resolve contacts · Contact provider unavailable.");
  assert.equal(view.activity[2].label, "Role Agent next action");
  assert.equal(view.activity[2].context, "Resolve contacts");
});

test("surfaces manager feedback as a client feedback audit", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-client-feedback", status: "active" },
    settings: {},
    roleAgentMetrics: {
      manager_feedback_count: 2,
      recent_events: [
        {
          event_type: "manager_feedback",
          action_type: "client_delivery_feedback",
          action_status: "succeeded",
          detail: "Client feedback: ready_to_interview by Hiring Manager - Move Ada to interview next week. (/r/run-1?t=token)",
          at: "2026-07-03T13:00:00.000Z",
        },
        {
          event_type: "manager_feedback",
          action_type: "client_delivery_feedback",
          action_status: "succeeded",
          detail: "Client feedback: needs_more_candidates by Client - Need more infra candidates.",
          at: "2026-07-03T12:00:00.000Z",
        },
        {
          event_type: "manager_feedback",
          action_type: "candidate_note",
          action_status: "succeeded",
          detail: "Internal note should not appear.",
          at: "2026-07-03T11:00:00.000Z",
        },
      ],
    },
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
    locale: "en",
  });

  assert.equal(view.client_feedback_audit.count, 2);
  assert.deepEqual(view.client_feedback_audit.latest[0], {
    sentiment: "ready_to_interview",
    reviewer: "Hiring Manager",
    note: "Move Ada to interview next week.",
    report_href: "/r/run-1?t=token",
    at: "2026-07-03T13:00:00.000Z",
  });
  assert.equal(view.client_feedback_audit.history.length, 2);
  assert.equal(view.client_feedback_audit.history[0].report_href, "/r/run-1?t=token");
  assert.equal(view.client_feedback_audit.history[1].sentiment, "needs_more_candidates");
  assert.equal(view.activity[0].label, "Manager feedback");
  assert.equal(view.activity[0].context, "Hiring Manager · ready_to_interview");
});

test("builds a client delivery audit trail from report views and feedback", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-client-audit", status: "active" },
    settings: {},
    roleAgentMetrics: {
      client_report_views: 2,
      manager_feedback_count: 1,
      recent_events: [
        {
          event_type: "client_report_view",
          action_type: "shareable_client_delivery_loop",
          detail: "/r/run-2?lang=en&t=token-2",
          at: "2026-07-03T14:00:00.000Z",
        },
        {
          event_type: "manager_feedback",
          action_type: "client_delivery_feedback",
          detail: "Client feedback: needs_more_candidates by Client - Need more staff engineers. (/r/run-2?lang=en&t=token-2)",
          at: "2026-07-03T14:05:00.000Z",
        },
        {
          event_type: "client_report_view",
          action_type: "shareable_client_delivery_loop",
          detail: "/r/run-1?lang=en&t=token-1",
          at: "2026-07-02T10:00:00.000Z",
        },
      ],
    },
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
    locale: "en",
  });

  assert.deepEqual(view.client_delivery_audit.counts, {
    report_views: 2,
    feedback: 1,
  });
  assert.equal(view.client_delivery_audit.latest_report_href, "/r/run-2?lang=en&t=token-2");
  assert.match(view.client_delivery_audit.summary, /2 report views, 1 feedback/);
  assert.deepEqual(view.client_delivery_audit.timeline.map((entry) => entry.type), ["feedback", "report_view", "report_view"]);
  assert.equal(view.client_delivery_audit.timeline[0].report_href, "/r/run-2?lang=en&t=token-2");
  assert.equal(view.client_delivery_audit.timeline[0].actor, "Client");
  assert.equal(view.client_delivery_audit.timeline[1].label, "Report viewed");
});

test("builds client delivery audit trail from persisted audit events", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-persisted-client-audit", status: "active" },
    settings: {},
    roleAgentMetrics: {},
    clientDeliveryAuditEvents: [
      {
        event_type: "report_view",
        action_type: "shareable_client_delivery_loop",
        report_href: "/r/run-3?lang=en&t=token-3",
        actor: "Client",
        detail: "/r/run-3?lang=en&t=token-3",
        event_at: "2026-07-03T15:00:00.000Z",
      },
      {
        event_type: "feedback",
        action_type: "client_delivery_feedback",
        report_href: "/r/run-3?lang=en&t=token-3",
        actor: "Hiring Manager",
        sentiment: "ready_to_interview",
        note: "Move Ada forward.",
        detail: "Client feedback: ready_to_interview by Hiring Manager - Move Ada forward. (/r/run-3?lang=en&t=token-3)",
        event_at: "2026-07-03T15:05:00.000Z",
      },
    ],
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
    locale: "en",
  });

  assert.deepEqual(view.client_delivery_audit.counts, {
    report_views: 1,
    feedback: 1,
  });
  assert.equal(view.client_delivery_audit.latest_report_href, "/r/run-3?lang=en&t=token-3");
  assert.deepEqual(view.client_delivery_audit.timeline.map((entry) => entry.type), ["feedback", "report_view"]);
  assert.equal(view.client_delivery_audit.timeline[0].actor, "Hiring Manager");
  assert.equal(view.client_delivery_audit.timeline[0].detail, "ready_to_interview: Move Ada forward.");
});

test("surfaces detailed role health blockers from contacts drafts search and inbox", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-blockers", status: "active" },
    settings: { capacity_goal: { contacted: 5, replied: 2, interested: 1, interview_ready: 1 } },
    candidateGraph: { summary: { candidate_count: 0, contactable_count: 0, interview_ready_count: 0 } },
    leadPreview: { summary: { item_count: 0 } },
    searchTasks: [],
    latestRun: { status: "done", updated_at: "2026-07-03T09:00:00.000Z" },
    outreachQueue: {
      items: [
        {
          id: "low-contact",
          candidate_name: "Low Contact",
          status: "drafted",
          contact_profile: {
            emails: [{ value: "low@example.com", confidence: "low", deliverability_status: "valid" }],
          },
        },
      ],
    },
    inboxQueue: {
      summary: { needs_human_reply: 1 },
      items: [{ id: "reply-1", candidate_name: "Reply Candidate", classification: "needs_human_reply" }],
    },
  });

  assert.ok(view.health.blocked_actions.includes("low_confidence_contact"));
  assert.ok(view.health.blocked_actions.includes("unapproved_draft"));
  assert.ok(view.health.blocked_actions.includes("no_preview_leads"));
  assert.ok(view.health.blocked_actions.includes("no_active_search_task"));
  assert.ok(view.health.blocked_actions.includes("needs_human_reply"));
});

test("marks active roles with human blockers as review required", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-review", status: "active" },
    settings: { agent_status: "active", capacity_goal: { contacted: 1 } },
    candidateGraph: { summary: { candidate_count: 1, contactable_count: 0 } },
    leadPreview: { summary: { item_count: 0 } },
    outreachQueue: {
      items: [
        {
          id: "draft-review",
          candidate_name: "Review Candidate",
          status: "drafted",
          contact_profile: { emails: [] },
        },
      ],
    },
    inboxQueue: { items: [] },
  });

  assert.equal(view.status, "review_required");
  assert.ok(view.health.blocked_actions.includes("missing_contact"));
  assert.ok(view.health.blocked_actions.includes("unapproved_draft"));
});

test("prompts interested review for needs scheduling inbox items", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-scheduling", status: "active" },
    settings: { capacity_goal: { contacted: 1, interested: 1, interview_ready: 1 } },
    candidateGraph: { summary: { candidate_count: 1, contactable_count: 1, interview_ready_count: 0 } },
    leadPreview: { summary: { item_count: 0 } },
    outreachQueue: { items: [] },
    inboxQueue: {
      summary: { interested: 0, needs_scheduling: 1 },
      items: [],
      interested_candidates: [],
    },
  });

  assert.equal(view.counts.interested, 1);
  assert.equal(view.health.interview_gap, true);
  assert.equal(view.next_actions[0].type, "review_interested_candidates");
  assert.equal(view.next_actions[0].affected_count, 1);
});

test("falls back to outreach queue statuses for goal progress counts", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-progress", status: "active" },
    settings: { capacity_goal: { contacted: 3, replied: 2, interested: 1, interview_ready: 1 } },
    candidateGraph: { summary: { candidate_count: 3, contactable_count: 3, interview_ready_count: 1 } },
    leadPreview: { summary: { item_count: 0 } },
    outreachQueue: {
      items: [
        {
          id: "sent-1",
          candidate_name: "Sent Candidate",
          status: "sent",
          sent_at: "2026-07-03T09:00:00.000Z",
          contact_profile: { emails: [{ value: "sent@example.com", confidence: "high", deliverability_status: "valid" }] },
        },
        {
          id: "replied-1",
          candidate_name: "Replied Candidate",
          status: "replied",
          contact_profile: { emails: [{ value: "reply@example.com", confidence: "high", deliverability_status: "valid" }] },
        },
        {
          id: "interested-1",
          candidate_name: "Interested Candidate",
          status: "interested",
          classification: "interested",
          contact_profile: { emails: [{ value: "interested@example.com", confidence: "high", deliverability_status: "valid" }] },
        },
      ],
    },
    inboxQueue: { items: [] },
  });

  assert.equal(view.counts.contacted, 3);
  assert.equal(view.counts.replied, 1);
  assert.equal(view.counts.interested, 1);
  assert.equal(view.counts.interview_ready, 1);
});

test("prompts follow up from inbox due follow-up summary", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-follow-up", status: "active" },
    settings: { capacity_goal: { contacted: 1 } },
    candidateGraph: { summary: { candidate_count: 1, contactable_count: 1 } },
    leadPreview: { summary: { item_count: 0 } },
    outreachQueue: { items: [] },
    inboxQueue: {
      summary: { due_follow_up: 2 },
      items: [
        { id: "follow-1", candidate_name: "Follow One", classification: "no_reply_follow_up" },
        { id: "follow-2", candidate_name: "Follow Two", classification: "no_reply_follow_up" },
      ],
    },
  });

  const followUpAction = view.next_actions.find((action) => action.type === "follow_up");
  assert.equal(followUpAction?.affected_count, 2);
  assert.ok(view.health.blocked_actions.includes("due_follow_up"));
});

test("shows sourcing action as blocked while a search is already running", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-running-search", status: "active" },
    settings: { capacity_goal: { contacted: 3 } },
    candidateGraph: { summary: { candidate_count: 0, contactable_count: 0 } },
    leadPreview: { summary: { item_count: 0 } },
    searchTasks: [],
    latestRun: { status: "running", updated_at: "2026-07-03T09:00:00.000Z" },
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
  });

  const sourcingAction = view.next_actions.find((action) => action.type === "run_sourcing");
  assert.equal(view.status, "active");
  assert.equal(sourcingAction?.blocked_reason, "active_search_running");
});

test("prompts contact resolution from candidate graph contact gap", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-contact-coverage", status: "active" },
    settings: { capacity_goal: { contacted: 4 } },
    candidateGraph: { summary: { candidate_count: 4, contactable_count: 1, interview_ready_count: 0 } },
    leadPreview: { summary: { item_count: 0 } },
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
  });

  const resolveAction = view.next_actions.find((action) => action.type === "resolve_contacts");
  assert.equal(view.health.contact_gap, true);
  assert.equal(resolveAction?.affected_count, 3);
});

test("prompts outreach approval from queue summary when items are not loaded", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-summary-outreach", status: "active" },
    settings: { capacity_goal: { contacted: 2 } },
    candidateGraph: { summary: { candidate_count: 2, contactable_count: 2, interview_ready_count: 0 } },
    leadPreview: { summary: { item_count: 0 } },
    outreachQueue: { summary: { drafted: 2 }, items: [] },
    inboxQueue: { items: [] },
  });

  const outreachAction = view.next_actions.find((action) => action.type === "approve_or_send_outreach");
  assert.equal(outreachAction?.affected_count, 2);
});

test("summarizes smart report delivery context for role agent panel", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-delivery", status: "active" },
    settings: { capacity_goal: { contacted: 2 } },
    candidateGraph: { summary: { candidate_count: 2, contactable_count: 2, interview_ready_count: 0 } },
    leadPreview: { summary: { item_count: 0 } },
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
    smartReport: {
      query: "Founding AI engineer",
      candidates: [
        {
          name: "Strong Candidate",
          match_score: 86,
          evidence_quality: "high",
          strongest_signals: ["Built production LLM infra"],
          outreach_status: "needs_scheduling",
        },
        {
          name: "Risk Candidate",
          match_score: 61,
          evidence_audit: { overall_evidence_quality: "low", risk_flags: ["Only self-reported claims"] },
        },
      ],
      evidence_graph: { source_mix: [{ source_type: "github", count: 2 }] },
    },
    locale: "en",
  });

  assert.equal(view.delivery_summary.title, "Smart Report");
  assert.equal(view.delivery_summary.metrics.candidates, 2);
  assert.equal(view.delivery_summary.metrics.ready_for_outreach, 1);
  assert.equal(view.delivery_summary.metrics.needs_scheduling, 1);
  assert.deepEqual(view.delivery_summary.source_mix, [{ label: "GitHub", count: 2 }]);
  assert.ok(view.delivery_summary.risks.some((risk) => risk.includes("Risk Candidate")));
  assert.ok(view.delivery_summary.next_actions.some((action) => action.includes("Share this report")));
});

test("builds a client delivery loop with current week progress", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-client-delivery-loop", status: "active" },
    settings: {},
    candidateGraph: {
      summary: { candidate_count: 2, contactable_count: 1 },
      candidates: [
        { candidate_id: "new-1", canonical_name: "New Candidate", updated_at: "2026-07-03T08:00:00.000Z" },
        { candidate_id: "old-1", canonical_name: "Old Candidate", updated_at: "2026-06-20T08:00:00.000Z" },
      ],
    },
    outreachQueue: {
      items: [
        { id: "sent-1", candidate_name: "Sent Candidate", status: "sent", sent_at: "2026-07-02T08:00:00.000Z" },
        { id: "old-sent-1", candidate_name: "Old Sent Candidate", status: "sent", sent_at: "2026-06-18T08:00:00.000Z" },
      ],
    },
    inboxQueue: {
      items: [
        { id: "reply-1", candidate_name: "Reply Candidate", classification: "ask_for_details", updated_at: "2026-07-01T08:00:00.000Z" },
        { id: "ready-1", candidate_name: "Ready Candidate", classification: "interested", readiness: "interview_ready", updated_at: "2026-07-03T09:00:00.000Z" },
        {
          id: "confirmed-1",
          candidate_name: "Confirmed Candidate",
          classification: "interview_ready",
          readiness: "interview_ready",
          action_status: "scheduled",
          interview_event: { status: "confirmed", starts_at: "2026-07-05T16:00:00.000Z" },
          updated_at: "2026-07-03T10:00:00.000Z",
        },
      ],
    },
    smartReport: {
      query: "AI platform engineer",
      candidates: [{ name: "New Candidate", match_score: 80, evidence_quality: "high" }],
    },
    locale: "en",
  });

  assert.equal(view.delivery_summary.weekly_progress.window_label, "Last 7 days");
  assert.deepEqual(view.delivery_summary.weekly_progress.metrics, {
    new_candidates: 1,
    contacted: 1,
    replied: 3,
    interview_ready: 2,
    confirmed: 1,
  });
  assert.equal(view.delivery_summary.client_delivery_loop.title, "Client delivery loop");
  assert.deepEqual(view.delivery_summary.client_delivery_loop.metrics, [
    { key: "new_candidates", label: "New candidates", value: 1 },
    { key: "contacted", label: "Contacted", value: 1 },
    { key: "replied", label: "Replied", value: 3 },
    { key: "interview_ready", label: "Interview-ready", value: 2 },
    { key: "confirmed", label: "Confirmed", value: 1 },
  ]);
  assert.ok(view.delivery_summary.client_delivery_loop.risks.length >= 1);
  assert.ok(view.delivery_summary.client_delivery_loop.next_steps.length >= 1);
});

test("adds sequence audit events and follow-up run summaries to recent activity", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-activity-sources", status: "active" },
    settings: {},
    outreachQueue: {
      items: [
        {
          id: "thread-audit",
          candidate_name: "Audit Candidate",
          status: "sent",
          updated_at: "2026-07-03T09:00:00.000Z",
          sequence_messages: [
            {
              step: 2,
              audit_events: [
                { action: "saved", at: "2026-07-03T09:10:00.000Z", summary: "Saved follow-up draft." },
                { action: "reviewed", at: "2026-07-03T09:12:00.000Z", summary: "Reviewed follow-up draft." },
              ],
            },
          ],
        },
      ],
    },
    inboxQueue: { items: [] },
    roleAgentMetrics: {
      outreach_followup_summary: {
        last_run_at: "2026-07-03T09:15:00.000Z",
        scanned: 4,
        drafted: 2,
        failed: 1,
      },
    },
    activityLimit: 8,
    locale: "en",
  });

  assert.equal(view.activity[0].label, "Follow-up scheduler");
  assert.match(view.activity[0].context, /scanned 4/);
  assert.ok(view.activity.some((entry) => entry.label === "Sequence reviewed" && entry.context === "Audit Candidate"));
  assert.ok(view.activity.some((entry) => entry.status === "sequence_audit"));
});

test("ranks why-now candidates from inbox follow-ups and fresh contactable evidence", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-why-now", status: "active" },
    settings: {},
    candidateGraph: {
      candidates: [
        {
          candidate_id: "fresh-1",
          canonical_name: "Fresh Contactable",
          readiness: "ready_for_outreach",
          contactability_score: 91,
          evidence_quality: "strong",
          source_types: ["github", "company_page"],
          updated_at: "2026-07-03T08:00:00.000Z",
        },
      ],
    },
    outreachQueue: {
      items: [
        {
          candidate_id: "follow-1",
          candidate_name: "Follow Due",
          status: "follow_up_due",
          updated_at: "2026-07-03T09:00:00.000Z",
        },
      ],
    },
    inboxQueue: {
      items: [
        {
          candidate_id: "reply-1",
          candidate_name: "Interested Reply",
          classification: "interested",
          readiness: "needs_scheduling",
          updated_at: "2026-07-03T10:00:00.000Z",
        },
      ],
    },
    locale: "en",
  });

  assert.equal(view.why_now[0].candidate_name, "Interested Reply");
  assert.equal(view.why_now[0].next_best_action, "review_interested_candidates");
  assert.match(view.why_now[0].why_now, /interested/i);
  assert.ok(view.why_now.some((item) => item.candidate_name === "Follow Due" && item.next_best_action === "follow_up"));
  assert.ok(view.why_now.some((item) => item.candidate_name === "Fresh Contactable" && item.next_best_action === "approve_or_send_outreach"));
});

test("adds live signal explanations to why-now candidates", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-live-signals", status: "active" },
    settings: {},
    candidateGraph: {
      candidates: [
        {
          candidate_id: "live-1",
          canonical_name: "Live Signal Candidate",
          readiness: "ready_for_outreach",
          contactability_score: 88,
          evidence_quality: "strong",
          activity_signals: [
            { source: "github", label: "GitHub activity on retrieval infra", at: "2026-07-03T08:30:00.000Z" },
          ],
          profile_freshness: { status: "fresh", label: "Profile refreshed this week", refreshed_at: "2026-07-03T08:00:00.000Z" },
          company_signals: [
            { source: "company_hiring", label: "Company opened two AI platform roles", at: "2026-07-03T07:30:00.000Z" },
          ],
          tech_stack_signals: [
            { source: "tech_stack", label: "Recent LangGraph stack mention", at: "2026-07-03T07:00:00.000Z" },
          ],
          recent_updates: [
            { source: "paper", label: "Published retrieval evaluation notes", at: "2026-07-02T18:00:00.000Z" },
          ],
        },
      ],
    },
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
    locale: "en",
  });

  assert.equal(view.why_now[0].candidate_name, "Live Signal Candidate");
  assert.match(view.why_now[0].why_now, /GitHub activity/);
  assert.ok(view.why_now[0].signals.includes("Company opened two AI platform roles"));
  assert.ok(view.why_now[0].signals.includes("Recent LangGraph stack mention"));
  assert.deepEqual(view.why_now[0].signal_sources, ["github", "profile", "company_hiring", "tech_stack", "paper"]);
});

test("uses a fresh persisted GitHub signal for why-now without surfacing expired evidence", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-persisted-live-signal", status: "active" },
    settings: {},
    candidateGraph: {
      candidates: [
        {
          candidate_id: "github:ada",
          canonical_name: "Ada Lovelace",
          live_signals: [
            {
              provider: "github",
              type: "candidate_activity",
              source_url: "https://github.com/ada/retrieval-evals",
              summary: "Published a retrieval evaluation update.",
              confidence: "high",
              observed_at: "2026-07-03T08:30:00.000Z",
              expires_at: "2026-07-10T08:30:00.000Z",
            },
            {
              provider: "github",
              type: "candidate_activity",
              source_url: "https://github.com/ada/old-update",
              summary: "Old update.",
              confidence: "high",
              observed_at: "2026-06-01T08:30:00.000Z",
              expires_at: "2026-06-10T08:30:00.000Z",
            },
          ],
        },
      ],
    },
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
    now: "2026-07-03T12:00:00.000Z",
    locale: "en",
  });

  assert.equal(view.why_now[0].candidate_name, "Ada Lovelace");
  assert.match(view.why_now[0].why_now, /retrieval evaluation/i);
  assert.equal(view.why_now[0].signal_contract.length, 1);
  assert.deepEqual(view.why_now[0].signal_contract[0], {
    type: "candidate_activity",
    source: "github",
    label: "Published a retrieval evaluation update.",
    confidence: "high",
    freshness: "fresh",
    at: "2026-07-03T08:30:00.000Z",
    expires_at: "2026-07-10T08:30:00.000Z",
    source_url: "https://github.com/ada/retrieval-evals",
  });
});

test("ingests live signals from candidate evidence and role context", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-live-ingestion", status: "active" },
    settings: {},
    candidateGraph: {
      candidates: [
        {
          candidate_id: "ingested-1",
          canonical_name: "Evidence Signal Candidate",
          current_company: "Example AI",
          readiness: "ready_for_outreach",
          contactability_score: 86,
          evidence_quality: "strong",
          source_evidence: [
            {
              source_type: "github",
              title: "Pushed LangGraph evaluation harness",
              updated_at: "2026-07-03T08:30:00.000Z",
            },
            {
              source_type: "blog",
              title: "Wrote about pgvector retrieval",
              published_at: "2026-07-02T18:00:00.000Z",
            },
          ],
          tech_stack: [
            { name: "LangGraph", source: "github", detected_at: "2026-07-03T08:30:00.000Z" },
          ],
          company_open_roles: [
            { title: "AI Platform Engineer", at: "2026-07-03T07:30:00.000Z" },
          ],
          profile_updated_at: "2026-07-03T08:00:00.000Z",
        },
      ],
    },
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
    now: "2026-07-03T12:00:00.000Z",
    locale: "en",
  });

  assert.equal(view.why_now[0].candidate_name, "Evidence Signal Candidate");
  assert.ok(view.why_now[0].signals.some((signal) => /LangGraph evaluation harness/.test(signal)));
  assert.ok(view.why_now[0].signals.some((signal) => /pgvector retrieval/.test(signal)));
  assert.ok(view.why_now[0].signals.some((signal) => /AI Platform Engineer/.test(signal)));
  assert.deepEqual(view.why_now[0].signal_contract.map((signal) => signal.type), [
    "candidate_activity",
    "recent_content",
    "profile_freshness",
    "company_hiring",
    "tech_stack",
  ]);
  assert.equal(view.why_now[0].contact_timing.urgency, "now");
});

test("prioritizes why-now candidates with a clear contact timing window", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-contact-window", status: "active" },
    settings: {},
    candidateGraph: {
      candidates: [
        {
          candidate_id: "now-1",
          canonical_name: "Contact Window Candidate",
          readiness: "ready_for_outreach",
          contactability_score: 92,
          evidence_quality: "strong",
          activity_signals: [
            { source: "github", label: "Merged vector search benchmark today", at: "2026-07-03T08:30:00.000Z" },
          ],
          profile_freshness: { status: "fresh", label: "Profile refreshed today", refreshed_at: "2026-07-03T08:00:00.000Z" },
          company_signals: [
            { source: "company_hiring", label: "Company opened AI infra hiring this week", at: "2026-07-03T07:30:00.000Z" },
          ],
          tech_stack_signals: [
            { source: "tech_stack", label: "Recent pgvector stack update", at: "2026-07-03T07:00:00.000Z" },
          ],
        },
        {
          candidate_id: "later-1",
          canonical_name: "Later Candidate",
          readiness: "ready_for_outreach",
          contactability_score: 88,
          evidence_quality: "strong",
          source_types: ["github"],
          updated_at: "2026-06-10T08:00:00.000Z",
        },
      ],
    },
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
    locale: "en",
  });

  assert.equal(view.why_now[0].candidate_name, "Contact Window Candidate");
  assert.equal(view.why_now[0].contact_timing.urgency, "now");
  assert.equal(view.why_now[0].contact_timing.score, 100);
  assert.match(view.why_now[0].contact_timing.reason, /activity.*company.*tech/i);
  assert.equal(view.why_now.find((item) => item.candidate_name === "Later Candidate")?.contact_timing.urgency, "this_week");
});

test("normalizes live signal contract and downranks expired signals", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-live-signal-contract", status: "active" },
    settings: {},
    candidateGraph: {
      candidates: [
        {
          candidate_id: "fresh-signal",
          canonical_name: "Fresh Signal Candidate",
          readiness: "ready_for_outreach",
          contactability_score: 85,
          evidence_quality: "strong",
          activity_signals: [
            {
              type: "candidate_activity",
              source: "github",
              label: "Published retrieval eval benchmark",
              confidence: "high",
              at: "2026-07-03T08:30:00.000Z",
              expires_at: "2026-07-10T08:30:00.000Z",
            },
          ],
          company_signals: [
            {
              type: "company_hiring",
              source: "company_jobs",
              label: "Company opened AI infrastructure roles",
              confidence: "medium",
              at: "2026-07-03T07:30:00.000Z",
              expires_at: "2026-07-08T07:30:00.000Z",
            },
          ],
          tech_stack_signals: [
            {
              type: "tech_stack",
              source: "profile",
              label: "Recent pgvector stack mention",
              confidence: "high",
              at: "2026-07-03T07:00:00.000Z",
              expires_at: "2026-07-09T07:00:00.000Z",
            },
          ],
        },
        {
          candidate_id: "expired-signal",
          canonical_name: "Expired Signal Candidate",
          readiness: "ready_for_outreach",
          contactability_score: 99,
          evidence_quality: "strong",
          activity_signals: [
            {
              type: "candidate_activity",
              source: "github",
              label: "Old launch post",
              confidence: "high",
              at: "2026-06-01T08:30:00.000Z",
              expires_at: "2026-06-10T08:30:00.000Z",
            },
          ],
          company_signals: [
            {
              type: "company_hiring",
              source: "company_jobs",
              label: "Old hiring spike",
              confidence: "high",
              at: "2026-06-01T07:30:00.000Z",
              expires_at: "2026-06-10T07:30:00.000Z",
            },
          ],
          tech_stack_signals: [
            {
              type: "tech_stack",
              source: "profile",
              label: "Old stack mention",
              confidence: "high",
              at: "2026-06-01T07:00:00.000Z",
              expires_at: "2026-06-10T07:00:00.000Z",
            },
          ],
        },
      ],
    },
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
    now: "2026-07-03T12:00:00.000Z",
    locale: "en",
  });

  assert.equal(view.why_now[0].candidate_name, "Fresh Signal Candidate");
  assert.equal(view.why_now[0].contact_timing.urgency, "now");
  assert.equal(view.why_now[0].signal_contract[0].type, "candidate_activity");
  assert.equal(view.why_now[0].signal_contract[0].freshness, "fresh");
  assert.equal(view.why_now[0].signal_contract[0].confidence, "high");
  assert.equal(view.why_now[0].signal_contract[0].expires_at, "2026-07-10T08:30:00.000Z");
  const expired = view.why_now.find((item) => item.candidate_name === "Expired Signal Candidate");
  assert.equal(expired?.contact_timing.urgency, "this_week");
  assert.equal(expired?.signal_contract[0].freshness, "expired");
});

test("builds a live signal refresh queue for stale or expired candidates", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-live-refresh", status: "active" },
    settings: {},
    candidateGraph: {
      live_signal_provider_status: "ready",
      candidates: [
        {
          candidate_id: "stale-signal",
          canonical_name: "Stale Signal Candidate",
          activity_signals: [
            { type: "candidate_activity", source: "github", label: "Old project update", confidence: "medium", at: "2026-05-20T08:30:00.000Z" },
          ],
        },
        {
          candidate_id: "expired-signal",
          canonical_name: "Expired Signal Candidate",
          company_signals: [
            {
              type: "company_hiring",
              source: "company_jobs",
              label: "Expired hiring spike",
              confidence: "high",
              at: "2026-06-01T07:30:00.000Z",
              expires_at: "2026-06-10T07:30:00.000Z",
            },
          ],
        },
        {
          candidate_id: "fresh-signal",
          canonical_name: "Fresh Signal Candidate",
          activity_signals: [
            { type: "candidate_activity", source: "github", label: "Fresh benchmark", confidence: "high", at: "2026-07-03T08:30:00.000Z" },
          ],
        },
      ],
    },
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
    now: "2026-07-03T12:00:00.000Z",
    locale: "en",
  });

  assert.equal(view.signal_refresh.status, "due");
  assert.equal(view.signal_refresh.provider_status, "ready");
  assert.equal(view.signal_refresh.due_count, 2);
  assert.equal(view.signal_refresh.stale_count, 1);
  assert.equal(view.signal_refresh.expired_count, 1);
  assert.deepEqual(view.signal_refresh.targets.map((item) => item.candidate_name), [
    "Expired Signal Candidate",
    "Stale Signal Candidate",
  ]);
  assert.ok(view.health.blocked_actions.includes("stale_live_signals"));
  const action = view.next_actions.find((item) => item.type === "refresh_live_signals");
  assert.equal(action?.affected_count, 2);
  assert.match(action?.reason ?? "", /signals/i);
});

test("blocks a due live signal refresh when no real provider is configured", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-live-refresh-blocked", status: "active" },
    settings: {},
    candidateGraph: {
      candidates: [
        {
          candidate_id: "stale-signal",
          canonical_name: "Stale Signal Candidate",
          activity_signals: [
            { type: "candidate_activity", source: "github", label: "Old project update", confidence: "medium", at: "2026-05-20T08:30:00.000Z" },
          ],
        },
      ],
    },
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
    now: "2026-07-03T12:00:00.000Z",
    locale: "en",
  });

  assert.equal(view.signal_refresh.provider_status, "not_configured");
  assert.equal(view.signal_refresh.status, "blocked");
  assert.equal(view.signal_refresh.due_count, 1);
  assert.match(view.signal_refresh.summary, /provider/i);
  assert.equal(view.next_actions.find((item) => item.type === "refresh_live_signals")?.blocked_reason, "provider_not_configured");
});

test("builds a contact and outreach autopilot path with recovery states", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-autopilot", status: "active" },
    settings: { approval_mode: "auto_follow_up_only", auto_follow_up_only: true },
    outreachQueue: {
      items: [
        {
          id: "needs-contact",
          candidate_name: "Needs Contact",
          status: "drafted",
          contact_profile: { emails: [] },
        },
        {
          id: "needs-approval",
          candidate_name: "Needs Approval",
          status: "drafted",
          contact_profile: { emails: [{ value: "approval@example.com", source: "hunter", confidence: "high", deliverability_status: "valid" }] },
        },
        {
          id: "ready-send",
          candidate_name: "Ready Send",
          status: "approved",
          contact_profile: { emails: [{ value: "send@example.com", source: "hunter", confidence: "high", deliverability_status: "valid" }] },
        },
        {
          id: "failed-send",
          candidate_name: "Failed Send",
          status: "approved",
          send_error: "gmail_rate_limit",
          contact_profile: { emails: [{ value: "failed@example.com", source: "hunter", confidence: "high", deliverability_status: "valid" }] },
        },
        {
          id: "follow-due",
          candidate_name: "Follow Due",
          status: "follow_up_due",
          contact_profile: { emails: [{ value: "follow@example.com", source: "hunter", confidence: "high", deliverability_status: "valid" }] },
          sequence_messages: [
            { step: 1, subject: "First", body: "First", send_mode: "manual_approval_required", approved: true },
            { step: 2, subject: "Follow", body: "Follow", send_mode: "draft_for_review", approved: true },
          ],
        },
      ],
    },
    inboxQueue: { items: [] },
    locale: "en",
  });

  assert.equal(view.autopilot_path.status, "needs_recovery");
  assert.equal(view.autopilot_path.recoverable_count, 1);
  assert.deepEqual(view.autopilot_path.stages.map((stage) => stage.type), [
    "resolve_contacts",
    "approve_drafts",
    "send_first_email",
    "retry_failures",
    "follow_up",
  ]);
  assert.equal(view.autopilot_path.stages.find((stage) => stage.type === "resolve_contacts")?.count, 1);
  assert.equal(view.autopilot_path.stages.find((stage) => stage.type === "approve_drafts")?.count, 1);
  assert.equal(view.autopilot_path.stages.find((stage) => stage.type === "send_first_email")?.count, 1);
  assert.equal(view.autopilot_path.stages.find((stage) => stage.type === "retry_failures")?.status, "ready");
  assert.equal(view.autopilot_path.stages.find((stage) => stage.type === "follow_up")?.auto_eligible_count, 1);
  assert.equal(view.autopilot_path.workflow.mode, "auto_follow_up_only");
  assert.equal(view.autopilot_path.workflow.next_step, "resolve_contacts");
  assert.equal(view.autopilot_path.workflow.blocked_count, 1);
  assert.deepEqual(view.autopilot_path.workflow.steps.map((step) => step.type), [
    "resolve_contacts",
    "approve_drafts",
    "send_first_email",
    "retry_failures",
    "follow_up",
  ]);
  assert.deepEqual(view.autopilot_path.workflow.steps[0].targets, [{ id: "needs-contact", candidate_name: "Needs Contact" }]);
  assert.equal(view.autopilot_path.workflow.steps.find((step) => step.type === "send_first_email")?.can_auto_execute, false);
  assert.match(view.autopilot_path.workflow.steps.find((step) => step.type === "send_first_email")?.guardrail ?? "", /manual/i);
  assert.equal(view.autopilot_path.workflow.steps.find((step) => step.type === "follow_up")?.can_auto_execute, true);
  assert.match(view.autopilot_path.summary, /1 recovery/i);
});

test("prompts retry failed outreach from recoverable send errors", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-retry-failed-send", status: "active" },
    settings: { capacity_goal: { contacted: 1 } },
    outreachQueue: {
      items: [
        {
          id: "failed-send-1",
          candidate_name: "Failed Send",
          status: "approved",
          send_error: "gmail_rate_limit",
          contact_profile: { emails: [{ value: "failed@example.com", source: "hunter", confidence: "high", deliverability_status: "valid" }] },
        },
      ],
    },
    inboxQueue: { items: [] },
    locale: "en",
  });

  const retryAction = view.next_actions.find((action) => action.type === "retry_failed_outreach");
  assert.equal(view.autopilot_path.status, "needs_recovery");
  assert.equal(retryAction?.affected_count, 1);
  assert.match(retryAction?.reason ?? "", /failed outreach/i);
  assert.equal(view.why_now[0].next_best_action, "retry_failed_outreach");
});

test("summarizes persisted contact and outreach recovery history", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-autopilot-history", status: "active" },
    settings: {},
    outreachQueue: {
      items: [
        {
          id: "resolved-contact",
          candidate_name: "Resolved Contact",
          status: "drafted",
          contact_profile: {
            emails: [{ value: "resolved@example.com", source: "hunter", confidence: "high", deliverability_status: "valid" }],
            resolution: { status: "resolved", provider: "hunter", searched_at: "2026-07-03T08:00:00.000Z", cost_units: 1 },
          },
        },
        {
          id: "draft-saved",
          candidate_name: "Draft Saved",
          status: "approved",
          gmail_draft_updated_at: "2026-07-03T09:00:00.000Z",
          contact_profile: { emails: [{ value: "draft@example.com", source: "hunter", confidence: "high", deliverability_status: "valid" }] },
        },
        {
          id: "sent-item",
          candidate_name: "Sent Item",
          status: "sent",
          sent_at: "2026-07-03T10:00:00.000Z",
          contact_profile: { emails: [{ value: "sent@example.com", source: "hunter", confidence: "high", deliverability_status: "valid" }] },
        },
        {
          id: "failed-item",
          candidate_name: "Failed Item",
          status: "approved",
          send_error: "gmail_rate_limit",
          updated_at: "2026-07-03T11:00:00.000Z",
          contact_profile: { emails: [{ value: "failed@example.com", source: "hunter", confidence: "high", deliverability_status: "valid" }] },
        },
      ],
    },
    inboxQueue: { items: [] },
    roleAgentMetrics: {
      recent_events: [
        {
          event_type: "next_action_execution",
          action_type: "retry_failed_outreach",
          action_status: "succeeded",
          detail: "2 failed sends retried, 1 still failed.",
          at: "2026-07-03T12:00:00.000Z",
        },
      ],
    },
    locale: "en",
  });

  assert.deepEqual(view.autopilot_recovery.counts, {
    contacts_resolved: 1,
    drafts_saved: 1,
    sent: 1,
    failed: 1,
  });
  assert.equal(view.autopilot_recovery.history[0].type, "send_failed");
  assert.equal(view.autopilot_recovery.history[0].candidate_name, "Failed Item");
  assert.match(view.autopilot_recovery.summary, /1 failed/);
  assert.deepEqual(view.autopilot_recovery.last_run, {
    action_type: "retry_failed_outreach",
    status: "succeeded",
    detail: "2 failed sends retried, 1 still failed.",
    at: "2026-07-03T12:00:00.000Z",
  });
});

test("surfaces role agent execution log retryable items in autopilot recovery", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-execution-log", status: "active" },
    settings: {},
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
    roleAgentMetrics: {
      execution_log: [
        {
          action_type: "approve_or_send_outreach",
          status: "succeeded",
          detail: "2 ready drafts approved, 1 failed. No emails were sent.",
          targets: [
            { id: "thread-1", candidate_name: "Ready Candidate" },
          ],
          result: { approved: 2, failed: 1 },
          failed_items: [
            { id: "thread-3", candidate_name: "Failed Candidate", error: "approval_failed" },
          ],
          retryable: true,
          at: "2026-07-03T09:06:00.000Z",
        },
      ],
    },
    locale: "en",
  });

  assert.equal(view.autopilot_recovery.last_run.action_type, "approve_or_send_outreach");
  assert.equal(view.autopilot_recovery.execution_log[0].result.failed, 1);
  assert.deepEqual(view.autopilot_recovery.retryable_items, [
    {
      action_type: "approve_or_send_outreach",
      candidate_name: "Failed Candidate",
      error: "approval_failed",
      at: "2026-07-03T09:06:00.000Z",
    },
  ]);
});

test("surfaces role agent run manifests in autopilot recovery", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-run-manifest", status: "active" },
    settings: {},
    outreachQueue: { items: [] },
    inboxQueue: { items: [] },
    roleAgentMetrics: {
      role_agent_runs: [
        {
          run_id: "run-approval-1",
          action_type: "approve_or_send_outreach",
          workflow_step: "approve_drafts",
          status: "failed",
          detail: "1 approved, 1 failed.",
          targets: [{ id: "thread-1", candidate_name: "Ready Candidate" }],
          result: { approved: 1, failed: 1 },
          failed_items: [{ id: "thread-2", candidate_name: "Failed Candidate", error: "approval_failed" }],
          retryable: true,
          guardrail: "First-email send requires manual confirmation.",
          started_at: "2026-07-03T09:06:00.000Z",
          finished_at: "2026-07-03T09:07:00.000Z",
          updated_at: "2026-07-03T09:07:00.000Z",
        },
      ],
    },
    locale: "en",
  });

  assert.equal(view.autopilot_recovery.runs[0].run_id, "run-approval-1");
  assert.equal(view.autopilot_recovery.runs[0].workflow_step, "approve_drafts");
  assert.equal(view.autopilot_recovery.runs[0].status, "failed");
  assert.equal(view.autopilot_recovery.runs[0].retryable, true);
  assert.equal(view.autopilot_recovery.runs[0].failed_items[0].candidate_name, "Failed Candidate");
});

test("builds inbox-to-interview pipeline queues and next steps", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-inbox-pipeline", status: "active" },
    settings: {},
    outreachQueue: { items: [] },
    inboxQueue: {
      items: [
        {
          id: "details-1",
          outreach_thread_id: "thread-details-1",
          candidate_name: "Details Candidate",
          classification: "ask_for_details",
          next_action: "reply",
          action_label: "Reply with role details",
          action_status: "pending",
          suggested_reply: "Here are more details.",
          updated_at: "2026-07-03T08:00:00.000Z",
        },
        {
          id: "follow-1",
          outreach_thread_id: "thread-follow-1",
          candidate_name: "Follow Candidate",
          classification: "no_reply_follow_up",
          next_action: "save_follow_up_draft",
          action_label: "Save follow-up draft",
          action_status: "pending",
          reply_draft: "Quick follow-up.",
          updated_at: "2026-07-03T09:00:00.000Z",
        },
        {
          id: "stop-1",
          outreach_thread_id: "thread-stop-1",
          candidate_name: "Stop Candidate",
          classification: "not_interested",
          next_action: "stop",
          action_label: "Stop follow-up",
          action_status: "pending",
          updated_at: "2026-07-03T10:00:00.000Z",
        },
        {
          id: "ready-1",
          outreach_thread_id: "thread-ready-1",
          candidate_name: "Ready Candidate",
          classification: "interested",
          readiness: "interview_ready",
          next_action: "schedule",
          action_status: "interview_ready",
          saved_scheduling_draft: "Calendar-aware draft saved.",
          calendar_availability: { status: "draft_saved", slots_count: 3, last_checked_at: "2026-07-03T10:55:00.000Z" },
          scheduling_packet: {
            handoff_title: "Interview handoff",
            candidate_reply: "Calendar-aware draft saved.",
            hiring_manager_note: "Ask about retrieval evals.",
          },
          updated_at: "2026-07-03T11:00:00.000Z",
        },
        {
          id: "confirmed-1",
          outreach_thread_id: "thread-confirmed-1",
          candidate_name: "Confirmed Candidate",
          classification: "interview_ready",
          readiness: "interview_ready",
          next_action: "schedule",
          action_status: "scheduled",
          interview_event: {
            status: "confirmed",
            starts_at: "2026-07-05T16:00:00.000Z",
            calendar_event_id: "evt-123",
          },
          scheduling_packet: {
            handoff_title: "Confirmed handoff",
            candidate_reply: "Confirmed for Friday.",
          },
          updated_at: "2026-07-03T13:00:00.000Z",
        },
        {
          id: "recovery-1",
          outreach_thread_id: "thread-recovery-1",
          candidate_name: "Recovery Candidate",
          classification: "interested",
          readiness: "needs_scheduling",
          next_action: "schedule",
          action_status: "pending",
          calendar_availability: {
            status: "calendar_freebusy_failed",
            last_checked_at: "2026-07-03T12:30:00.000Z",
          },
          updated_at: "2026-07-03T12:30:00.000Z",
        },
      ],
      interested_candidates: [
        {
          id: "interested-1",
          outreach_thread_id: "thread-interested-1",
          candidate_name: "Interested Candidate",
          classification: "interested",
          readiness: "needs_scheduling",
          next_action: "schedule",
          action_status: "pending",
          scheduling_packet: { handoff_title: "Interview handoff", candidate_reply: "Share times." },
          updated_at: "2026-07-03T12:00:00.000Z",
        },
      ],
    },
    locale: "en",
  });

  assert.deepEqual(view.inbox_pipeline.summary, {
    interested: 2,
    scheduling: 1,
    interview_ready: 2,
    confirmed: 1,
    canceled: 0,
    needs_recovery: 1,
    waiting_on_candidate: 0,
    waiting_on_manager: 0,
    ready_to_confirm: 0,
    needs_reply: 1,
    due_follow_up: 1,
    stop_sequence: 1,
  });
  assert.equal(view.inbox_pipeline.interested_queue[0].candidate_name, "Recovery Candidate");
  assert.equal(view.inbox_pipeline.interested_queue[0].scheduling_state.status, "needs_recovery");
  assert.equal(view.inbox_pipeline.interested_queue[1].scheduling_state.status, "needs_scheduling");
  assert.equal(view.inbox_pipeline.interview_ready_queue[0].candidate_name, "Confirmed Candidate");
  assert.equal(view.inbox_pipeline.interview_ready_queue[0].scheduling_state.status, "confirmed");
  assert.equal(view.inbox_pipeline.interview_ready_queue[0].scheduling_state.event.starts_at, "2026-07-05T16:00:00.000Z");
  assert.equal(view.inbox_pipeline.interview_ready_queue[1].candidate_name, "Ready Candidate");
  assert.equal(view.inbox_pipeline.interview_ready_queue[1].scheduling_state.status, "draft_saved");
  assert.deepEqual(view.inbox_pipeline.interview_ready_queue[1].handoff, {
    title: "Interview handoff",
    candidate_reply: "Calendar-aware draft saved.",
    manager_note: "Ask about retrieval evals.",
  });
  assert.deepEqual(view.inbox_pipeline.interview_ready_queue[1].calendar_status, {
    status: "draft_saved",
    slots_count: 3,
    last_checked_at: "2026-07-03T10:55:00.000Z",
  });
  assert.equal(view.inbox_pipeline.interview_ready_queue[1].recovery_next_step, "Review saved scheduling draft and share calendar options.");
  assert.deepEqual(view.inbox_pipeline.next_steps.map((step) => step.type), ["stop_sequence", "follow_up", "reply_with_details"]);
  assert.deepEqual(view.inbox_pipeline.next_steps.map((step) => [step.type, step.action_target_id, step.action, step.can_apply]), [
    ["stop_sequence", "thread-stop-1", "stop", true],
    ["follow_up", "thread-follow-1", "save_follow_up_draft", true],
    ["reply_with_details", "thread-details-1", "reply", true],
  ]);
  assert.match(view.inbox_pipeline.next_steps.find((step) => step.type === "reply_with_details")?.detail ?? "", /more details/i);
});

test("role workspace recognizes held slots and confirmed calendar writeback", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-calendar-writeback", status: "active" },
    settings: {},
    outreachQueue: { items: [] },
    inboxQueue: {
      items: [
        {
          id: "held-1",
          outreach_thread_id: "thread-held-1",
          candidate_name: "Held Candidate",
          classification: "interested",
          next_action: "schedule",
          action_status: "slot_held",
          calendar_availability: {
            status: "slot_held",
            slots_count: 1,
            last_checked_at: "2026-07-03T14:00:00.000Z",
          },
          updated_at: "2026-07-03T14:00:00.000Z",
        },
        {
          id: "confirmed-writeback-1",
          outreach_thread_id: "thread-confirmed-writeback-1",
          candidate_name: "Confirmed Writeback",
          classification: "interested",
          next_action: "schedule",
          action_status: "confirmed",
          interview_event: {
            status: "confirmed",
            starts_at: "2026-07-05T16:00:00.000Z",
            calendar_event_id: "evt-456",
          },
          updated_at: "2026-07-03T15:00:00.000Z",
        },
      ],
    },
    locale: "en",
  });

  assert.deepEqual(view.inbox_pipeline.summary, {
    interested: 1,
    scheduling: 0,
    interview_ready: 1,
    confirmed: 1,
    canceled: 0,
    needs_recovery: 0,
    waiting_on_candidate: 0,
    waiting_on_manager: 0,
    ready_to_confirm: 0,
    needs_reply: 0,
    due_follow_up: 0,
    stop_sequence: 0,
  });
  assert.equal(view.inbox_pipeline.interested_queue[0].candidate_name, "Held Candidate");
  assert.equal(view.inbox_pipeline.interested_queue[0].scheduling_state.status, "slot_held");
  assert.equal(view.inbox_pipeline.interview_ready_queue[0].candidate_name, "Confirmed Writeback");
  assert.equal(view.inbox_pipeline.interview_ready_queue[0].scheduling_state.status, "confirmed");
  assert.equal(view.inbox_pipeline.interview_ready_queue[0].scheduling_state.event.calendar_event_id, "evt-456");
});

test("builds inbox-to-interview activity timeline from scheduling states", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-interview-timeline", status: "active" },
    settings: {},
    outreachQueue: { items: [] },
    inboxQueue: {
      items: [
        {
          id: "timeline-1",
          outreach_thread_id: "thread-timeline-1",
          candidate_name: "Timeline Candidate",
          classification: "interested",
          classification_reason: "Candidate replied yes to a first call.",
          received_at: "2026-07-03T09:00:00.000Z",
          next_action: "schedule",
          action_status: "confirmed",
          saved_scheduling_draft: "Here are three slots.",
          scheduling_draft_saved_at: "2026-07-03T10:00:00.000Z",
          scheduling_negotiation: {
            candidate_windows: ["2026-07-06T15:00:00.000Z"],
            updated_at: "2026-07-03T11:00:00.000Z",
          },
          calendar_availability: {
            status: "slot_held",
            slots_count: 1,
            last_checked_at: "2026-07-03T12:00:00.000Z",
          },
          interview_event: {
            status: "confirmed",
            starts_at: "2026-07-06T15:00:00.000Z",
            calendar_event_id: "evt-timeline",
            updated_at: "2026-07-03T13:00:00.000Z",
          },
          updated_at: "2026-07-03T13:00:00.000Z",
        },
      ],
    },
    locale: "en",
  });

  assert.deepEqual(view.inbox_pipeline.interview_ready_queue[0].activity_timeline.map((event) => event.type), [
    "interview_confirmed",
    "slot_held",
    "time_negotiation",
    "scheduling_draft_saved",
    "interested_reply",
  ]);
  assert.equal(view.inbox_pipeline.interview_ready_queue[0].activity_timeline[0].at, "2026-07-03T13:00:00.000Z");
  assert.match(view.inbox_pipeline.interview_ready_queue[0].activity_timeline[0].label, /Interview confirmed/);
  assert.match(view.inbox_pipeline.interview_ready_queue[0].activity_timeline[2].detail, /candidate/i);
  assert.equal(view.inbox_pipeline.interview_ready_queue[0].activity_timeline[3].status, "draft_saved");
});

test("builds candidate and manager time negotiation states", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-negotiation", status: "active" },
    settings: {},
    outreachQueue: { items: [] },
    inboxQueue: {
      items: [
        {
          id: "candidate-times",
          outreach_thread_id: "thread-candidate-times",
          candidate_name: "Candidate Times",
          classification: "interested",
          readiness: "needs_scheduling",
          next_action: "schedule",
          action_status: "pending",
          scheduling_negotiation: {
            candidate_windows: ["2026-07-06T15:00:00.000Z"],
            last_actor: "candidate",
            updated_at: "2026-07-03T12:00:00.000Z",
          },
          updated_at: "2026-07-03T12:00:00.000Z",
        },
        {
          id: "manager-times",
          outreach_thread_id: "thread-manager-times",
          candidate_name: "Manager Times",
          classification: "interested",
          readiness: "needs_scheduling",
          next_action: "schedule",
          action_status: "pending",
          scheduling_negotiation: {
            manager_windows: ["2026-07-06T16:00:00.000Z"],
            last_actor: "manager",
            updated_at: "2026-07-03T12:30:00.000Z",
          },
          updated_at: "2026-07-03T12:30:00.000Z",
        },
        {
          id: "mutual-slot",
          outreach_thread_id: "thread-mutual-slot",
          candidate_name: "Mutual Slot",
          classification: "interested",
          readiness: "needs_scheduling",
          next_action: "schedule",
          action_status: "pending",
          scheduling_negotiation: {
            proposed_slot: { starts_at: "2026-07-06T17:00:00.000Z", ends_at: "2026-07-06T17:30:00.000Z" },
            candidate_confirmed_slot: { starts_at: "2026-07-06T17:00:00.000Z" },
            manager_confirmed_slot: { starts_at: "2026-07-06T17:00:00.000Z" },
            updated_at: "2026-07-03T13:00:00.000Z",
          },
          updated_at: "2026-07-03T13:00:00.000Z",
        },
      ],
    },
    locale: "en",
  });

  assert.equal(view.inbox_pipeline.summary.waiting_on_candidate, 1);
  assert.equal(view.inbox_pipeline.summary.waiting_on_manager, 1);
  assert.equal(view.inbox_pipeline.summary.ready_to_confirm, 1);
  assert.deepEqual(view.inbox_pipeline.interested_queue.map((item) => [item.candidate_name, item.scheduling_state.status]), [
    ["Mutual Slot", "ready_to_confirm"],
    ["Manager Times", "waiting_on_candidate"],
    ["Candidate Times", "waiting_on_manager"],
  ]);
  assert.equal(view.inbox_pipeline.interested_queue[0].negotiation_state.status, "ready_to_confirm");
  assert.equal(view.inbox_pipeline.interested_queue[0].negotiation_state.proposed_slot.starts_at, "2026-07-06T17:00:00.000Z");
  assert.match(view.inbox_pipeline.interested_queue[0].recovery_next_step, /Create the calendar event/i);
  assert.match(view.inbox_pipeline.interested_queue[1].recovery_next_step, /Share manager availability/i);
  assert.match(view.inbox_pipeline.interested_queue[2].recovery_next_step, /Review candidate availability/i);
});

test("role workspace recognizes rescheduled and canceled calendar lifecycle states", () => {
  const view = buildRoleAgentWorkspaceView({
    role: { id: "role-calendar-lifecycle", status: "active" },
    settings: {},
    outreachQueue: { items: [] },
    inboxQueue: {
      items: [
        {
          id: "rescheduled-1",
          outreach_thread_id: "thread-rescheduled-1",
          candidate_name: "Rescheduled Candidate",
          classification: "interview_ready",
          next_action: "schedule",
          action_status: "rescheduled",
          interview_event: {
            status: "rescheduled",
            starts_at: "2026-07-06T16:00:00.000Z",
            calendar_event_id: "evt-rescheduled",
          },
          updated_at: "2026-07-03T15:00:00.000Z",
        },
        {
          id: "canceled-1",
          outreach_thread_id: "thread-canceled-1",
          candidate_name: "Canceled Candidate",
          classification: "interview_ready",
          next_action: "schedule",
          action_status: "canceled",
          interview_event: {
            status: "canceled",
            calendar_event_id: "evt-canceled",
          },
          updated_at: "2026-07-03T16:00:00.000Z",
        },
      ],
    },
    locale: "en",
  });

  assert.equal(view.inbox_pipeline.summary.interview_ready, 2);
  assert.equal(view.inbox_pipeline.summary.confirmed, 0);
  assert.equal(view.inbox_pipeline.summary.canceled, 1);
  assert.equal(view.inbox_pipeline.interview_ready_queue[0].scheduling_state.status, "canceled");
  assert.equal(view.inbox_pipeline.interview_ready_queue[1].scheduling_state.status, "rescheduled");
});
