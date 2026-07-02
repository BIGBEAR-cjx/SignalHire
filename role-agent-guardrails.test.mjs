import test from "node:test";
import assert from "node:assert/strict";
import { buildRoleAgentGuardrailsView } from "./web/lib/role-agent-guardrails.mjs";

test("builds a conservative role agent guardrail view model", () => {
  const view = buildRoleAgentGuardrailsView({
    role: { id: "role-1", status: "active", capacity_goal: 3 },
    settings: {
      auto_follow_up_only: false,
      capacity_goal: {
        contacted: 4,
        replied: 2,
        interested: 3,
        interview_ready: 1,
      },
    },
    now: new Date("2026-07-01T12:00:00.000Z"),
    threads: [
      {
        id: "t1",
        candidate_name: "Ada Lovelace",
        status: "sent",
        sequence_step: 1,
        sent_at: "2026-07-01T09:00:00.000Z",
        evidence_angle: "Published GPU inference benchmarks",
        contact_profile: { emails: [{ value: "ada@example.ai", source: "hunter", confidence: "high", deliverability_status: "valid" }] },
      },
      {
        id: "t2",
        candidate_name: "Grace Hopper",
        status: "interview_ready",
        sequence_step: 2,
        approved: true,
        send_mode: "draft_for_review",
        last_activity_at: "2026-07-01T11:00:00.000Z",
        evidence_angle: "Led compiler adoption",
        inbox_classification: "interview_ready",
        contact_profile: { emails: [{ value: "grace@example.ai", source: "manual", confidence: "high", deliverability_status: "valid" }] },
      },
    ],
  });

  assert.equal(view.panel_title, "Role Agent Guardrails");
  assert.equal(view.role_id, "role-1");
  assert.equal(view.status, "review_required");
  assert.equal(view.approval_mode.mode, "manual_all");
  assert.equal(view.approval_mode.first_email_manual, true);
  assert.deepEqual(view.current_counts, {
    contacted: 2,
    replied: 0,
    interested: 1,
    interview_ready: 1,
  });
  assert.deepEqual(view.capacity_summary, {
    goal: 3,
    capacity_goal: {
      contacted: 4,
      replied: 2,
      interested: 3,
      interview_ready: 1,
    },
    contacted: 2,
    replied: 0,
    interested: 1,
    interview_ready: 1,
    remaining_by_stage: {
      contacted: 2,
      replied: 2,
      interested: 2,
      interview_ready: 0,
    },
    remaining_to_goal: 2,
    pressure: "needs_pipeline",
  });
  assert.ok(view.blocked_automation_reasons.some((reason) => reason.code === "first_email_manual"));
  assert.ok(view.blocked_automation_reasons.some((reason) => reason.code === "follow_up_not_auto_eligible"));
  assert.ok(view.next_tasks.some((task) => task.source === "capacity"));
  assert.match(view.controlled_workflow_copy, /controlled workflow/i);
});

test("normalizes auto_high_confidence into blocked manual-safe mode", () => {
  const view = buildRoleAgentGuardrailsView({
    role: { id: "role-auto", status: "active" },
    settings: { auto_high_confidence: true, auto_follow_up_only: true },
    threads: [
      {
        id: "t1",
        candidate_name: "Ada Lovelace",
        status: "sent",
        sequence_step: 2,
        approved: true,
        send_mode: "draft_for_review",
        evidence_angle: "Relevant role history",
        contact_profile: { emails: [{ value: "ada@example.ai", source: "hunter", confidence: "high", deliverability_status: "valid" }] },
      },
    ],
  });

  assert.equal(view.status, "review_required");
  assert.equal(view.approval_mode.mode, "manual_all");
  assert.equal(view.approval_mode.auto_follow_up_only, false);
  assert.equal(view.approval_mode.high_confidence_auto_send_blocked, true);
  assert.ok(view.blocked_automation_reasons.some((reason) => reason.code === "high_confidence_auto_send_blocked"));
  assert.ok(view.blocked_automation_reasons.some((reason) => reason.code === "follow_up_not_auto_eligible"));
});

test("uses persisted paused role agent status and capacity goals", () => {
  const view = buildRoleAgentGuardrailsView({
    role: { id: "role-paused", status: "active", capacity_goal: 99 },
    settings: {
      agent_status: "paused",
      approval_mode: "auto_follow_up_only",
      capacity_goal: {
        contacted: 5,
        replied: 2,
        interested: 1,
        interview_ready: 1,
      },
    },
    threads: [
      {
        id: "contacted",
        candidate_name: "Contacted",
        status: "sent",
        sequence_step: 2,
        approved: true,
        send_mode: "draft_for_review",
        evidence_angle: "Strong match",
        contact_profile: { emails: [{ value: "contacted@example.ai", source: "manual", confidence: "high", deliverability_status: "valid" }] },
      },
      {
        id: "interview",
        candidate_name: "Interview",
        status: "interview_ready",
        sequence_step: 2,
        approved: true,
        send_mode: "draft_for_review",
        evidence_angle: "Strong match",
        contact_profile: { emails: [{ value: "interview@example.ai", source: "manual", confidence: "high", deliverability_status: "valid" }] },
      },
    ],
  });

  assert.equal(view.status, "paused");
  assert.equal(view.approval_mode.mode, "auto_follow_up_only");
  assert.deepEqual(view.capacity_summary.capacity_goal, {
    contacted: 5,
    replied: 2,
    interested: 1,
    interview_ready: 1,
  });
  assert.deepEqual(view.capacity_summary.remaining_by_stage, {
    contacted: 3,
    replied: 2,
    interested: 0,
    interview_ready: 0,
  });
  assert.equal(view.capacity_summary.goal, 1);
  assert.equal(view.capacity_summary.remaining_to_goal, 0);
});

test("uses persisted active role agent status when resumed", () => {
  const view = buildRoleAgentGuardrailsView({
    role: { id: "role-active", status: "paused", paused: true },
    settings: {
      agent_status: "active",
      approval_mode: "manual_all",
      capacity_goal: {
        contacted: 0,
        replied: 0,
        interested: 0,
        interview_ready: 0,
      },
    },
    threads: [],
  });

  assert.equal(view.status, "active");
});

test("keeps first email manual while allowing existing auto follow-up-only semantics", () => {
  const view = buildRoleAgentGuardrailsView({
    role: { id: "role-followups", status: "active" },
    settings: { auto_follow_up_only: true },
    threads: [
      {
        id: "first",
        candidate_name: "First Step",
        status: "approved",
        sequence_step: 1,
        approved: true,
        send_mode: "draft_for_review",
        evidence_angle: "Strong match",
        contact_profile: { emails: [{ value: "first@example.ai", source: "manual", confidence: "high", deliverability_status: "valid" }] },
      },
      {
        id: "follow",
        candidate_name: "Follow Up",
        status: "sent",
        sequence_step: 2,
        approved: true,
        send_mode: "draft_for_review",
        evidence_angle: "Strong match",
        contact_profile: { emails: [{ value: "follow@example.ai", source: "manual", confidence: "high", deliverability_status: "valid" }] },
      },
    ],
  });

  const reasonCodes = view.blocked_automation_reasons.map((reason) => reason.code);
  assert.equal(view.approval_mode.mode, "auto_follow_up_only");
  assert.equal(view.approval_mode.first_email_manual, true);
  assert.ok(reasonCodes.includes("first_email_manual"));
  assert.ok(reasonCodes.includes("first_email_candidates_manual"));
  assert.equal(reasonCodes.includes("follow_up_not_auto_eligible"), false);
});

test("returns next tasks from sequence analytics and evidence gaps", () => {
  const view = buildRoleAgentGuardrailsView({
    roleId: "role-gaps",
    settings: { auto_follow_up_only: true },
    now: new Date("2026-07-01T12:00:00.000Z"),
    threads: [
      {
        id: "due",
        candidate_name: "Due Candidate",
        status: "follow_up_scheduled",
        sequence_step: 2,
        next_follow_up_at: "2026-07-01T09:00:00.000Z",
        approved: true,
        send_mode: "draft_for_review",
        contact_profile: { emails: [{ value: "due@example.ai", source: "manual", confidence: "high", deliverability_status: "valid" }] },
      },
      {
        id: "low-evidence",
        candidate_name: "Low Evidence",
        status: "drafted",
        sequence_step: 1,
        evidence_status: "needs_verification",
        contact_profile: { emails: [{ value: "low@example.ai", source: "manual", confidence: "high", deliverability_status: "valid" }] },
      },
    ],
  });

  assert.ok(view.next_tasks.some((task) => task.source === "sequence_analytics" && /follow-up/i.test(task.label)));
  assert.ok(view.next_tasks.some((task) => task.source === "evidence_gaps" && /2 candidates/.test(task.label)));
  assert.ok(view.blocked_automation_reasons.some((reason) => reason.code === "evidence_review_required"));
});

test("localizes helper-generated role agent tasks for Chinese UI", () => {
  const view = buildRoleAgentGuardrailsView({
    roleId: "role-zh",
    locale: "zh",
    capacityGoal: 2,
    threads: [
      {
        id: "needs-evidence",
        candidate_name: "候选人",
        status: "drafted",
        sequence_step: 1,
        evidence_status: "needs_verification",
        contact_profile: { emails: [{ value: "candidate@example.ai", source: "manual", confidence: "high", deliverability_status: "valid" }] },
      },
    ],
  });

  assert.equal(view.approval_mode.label, "需要人工批准");
  assert.ok(view.next_tasks.some((task) => /复核 1 位候选人的证据缺口/.test(task.label)));
  assert.ok(view.next_tasks.some((task) => /补充 2 位有意向候选人/.test(task.label)));
});

test("summarizes contact, evidence, stop-state blockers and compact activity", () => {
  const view = buildRoleAgentGuardrailsView({
    roleId: "role-blocked",
    activityLimit: 2,
    threads: [
      {
        id: "newer",
        candidate_name: "Newer Candidate",
        status: "bounced",
        sequence_step: 2,
        last_activity_at: "2026-07-01T11:00:00.000Z",
        evidence_angle: "Clear match",
        contact_profile: { emails: [{ value: "newer@example.ai", source: "hunter", confidence: "high", deliverability_status: "bounced" }] },
      },
      {
        id: "older",
        candidate_name: "Older Candidate",
        status: "drafted",
        sequence_step: 1,
        last_activity_at: "2026-07-01T09:00:00.000Z",
        contact_profile: { emails: [{ value: "older@example.ai", confidence: "low", deliverability_status: "valid" }] },
      },
      {
        id: "hidden",
        candidate_name: "Hidden Candidate",
        status: "drafted",
        last_activity_at: "2026-07-01T08:00:00.000Z",
      },
    ],
  });

  const reasonCodes = view.blocked_automation_reasons.map((reason) => reason.code);
  assert.ok(reasonCodes.includes("candidate_stop_state"));
  assert.ok(reasonCodes.includes("contact_not_sendable"));
  assert.ok(reasonCodes.includes("low_confidence_contact"));
  assert.ok(reasonCodes.includes("source_less_contact"));
  assert.ok(reasonCodes.includes("missing_contact"));
  assert.equal(view.activity_log.length, 2);
  assert.equal(view.activity_log[0].candidate, "Newer Candidate");
  assert.equal(view.activity_log[1].candidate, "Older Candidate");
  assert.doesNotMatch(JSON.stringify(view.activity_log), /Hidden Candidate/);
});
