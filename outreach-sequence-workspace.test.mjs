import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOutreachSequenceWorkspace,
  buildOutreachSequenceWorkspaceItem,
  patchOutreachSequenceStep,
} from "./web/lib/outreach-sequence-workspace.mjs";

function candidate() {
  return {
    name: "Ada Lovelace",
    strongest_signals: ["Published GPU inference benchmarks", "Maintains an eval toolkit"],
    outreach_angle: "Lead with her inference benchmark work.",
  };
}

function contactProfile(patch = {}) {
  return {
    emails: [
      {
        value: "ada@example.com",
        source: "github",
        confidence: "high",
        deliverability_status: "valid",
      },
    ],
    contactability_score: 92,
    ...patch,
  };
}

function queueItem(patch = {}) {
  return {
    id: "thread-1",
    candidate_name: "Ada Lovelace",
    candidate_snapshot: candidate(),
    contact_profile: contactProfile(),
    subject: "Ada, quick note",
    body: "First email body",
    status: "drafted",
    tone: "professional",
    role_brief: "a founding ML infrastructure engineer",
    queue_state: "draft",
    sequence_messages: [],
    ...patch,
  };
}

test("blocks queue items with no sendable email and exposes resolve contact", () => {
  const item = buildOutreachSequenceWorkspaceItem({
    item: queueItem({
      contact_profile: contactProfile({ emails: [] }),
    }),
    settings: { auto_follow_up_only: true },
  });

  assert.equal(item.current_step, 1);
  assert.equal(item.next_action, "resolve contact");
  assert.equal(item.sendable_contact, false);
  assert.equal(item.block_reasons.includes("no_email"), true);
  assert.equal(item.steps[0].state, "blocked");
  assert.equal(item.steps[0].auto_sendable, false);
});

test("surfaces low-confidence and bounced email block reasons", () => {
  const lowConfidence = buildOutreachSequenceWorkspaceItem({
    item: queueItem({
      contact_profile: contactProfile({
        emails: [{ value: "ada@example.com", source: "github", confidence: "low", deliverability_status: "valid" }],
      }),
    }),
    settings: {},
  });
  const bounced = buildOutreachSequenceWorkspaceItem({
    item: queueItem({
      contact_profile: contactProfile({
        emails: [{ value: "ada@example.com", source: "github", confidence: "high", deliverability_status: "bounced" }],
      }),
    }),
    settings: {},
  });

  assert.equal(lowConfidence.next_action, "resolve contact");
  assert.equal(lowConfidence.block_reasons.includes("low_confidence_email"), true);
  assert.equal(bounced.next_action, "resolve contact");
  assert.equal(bounced.block_reasons.includes("bounced_email"), true);
});

test("drafted first email with sendable contact asks for draft approval", () => {
  const item = buildOutreachSequenceWorkspaceItem({
    item: queueItem(),
    settings: { auto_follow_up_only: true },
  });

  assert.equal(item.current_step, 1);
  assert.equal(item.next_action, "approve draft");
  assert.deepEqual(item.block_reasons, ["unapproved_thread"]);
  assert.equal(item.steps[0].send_mode, "manual_approval_required");
  assert.equal(item.steps[0].state, "review");
  assert.equal(item.steps[0].auto_sendable, false);
  assert.equal(item.evidence_ref_count > 0, true);
});

test("approved first email remains manual-send only and never auto-sendable", () => {
  const item = buildOutreachSequenceWorkspaceItem({
    item: queueItem({ status: "approved", approved_at: "2026-07-01T10:00:00.000Z" }),
    settings: { auto_follow_up_only: true },
  });

  assert.equal(item.current_step, 1);
  assert.equal(item.next_action, "send first email");
  assert.deepEqual(item.block_reasons, []);
  assert.equal(item.steps[0].state, "ready");
  assert.equal(item.steps[0].auto_sendable, false);
  assert.equal(item.steps[0].send_mode, "manual_approval_required");
});

test("preserves existing sequence messages instead of rebuilding them", () => {
  const item = buildOutreachSequenceWorkspaceItem({
    item: queueItem({
      sequence_messages: [
        {
          step: 1,
          subject: "Stored first",
          body: "Stored first body",
          send_mode: "manual_approval_required",
          evidence_refs: ["stored evidence"],
          approved: true,
        },
        {
          step: 2,
          subject: "Stored follow-up",
          body: "Stored follow-up body",
          send_mode: "draft_for_review",
          evidence_refs: ["stored evidence"],
          delay_days: 7,
        },
      ],
    }),
    settings: {},
  });

  assert.equal(item.steps[0].subject, "Stored first");
  assert.equal(item.steps[0].body_preview, "Stored first body");
  assert.deepEqual(item.steps[0].evidence_refs, ["stored evidence"]);
  assert.equal(item.steps[1].subject, "Stored follow-up");
});

test("patches one sequence step without changing neighboring steps and appends audit events", () => {
  const sequence = [
    { step: 1, subject: "First", body: "First body", send_mode: "manual_approval_required", approved: false },
    { step: 2, subject: "Follow-up", body: "Follow-up body", send_mode: "draft_for_review", audit_events: [{ action: "saved", at: "2026-06-30T10:00:00.000Z", summary: "Initial save" }] },
    { step: 3, subject: "Last", body: "Last body", send_mode: "draft_for_review", approved: false },
  ];

  const patched = patchOutreachSequenceStep(sequence, {
    step: 2,
    subject: "  Updated follow-up  ",
    body: "  Updated follow-up body  ",
    now: new Date("2026-07-01T09:00:00.000Z"),
  });

  assert.deepEqual(patched[0], sequence[0]);
  assert.equal(patched[1].subject, "Updated follow-up");
  assert.equal(patched[1].body, "Updated follow-up body");
  assert.deepEqual(patched[1].audit_events, [
    { action: "saved", at: "2026-06-30T10:00:00.000Z", summary: "Initial save" },
    { action: "saved", at: "2026-07-01T09:00:00.000Z", summary: "Saved step 2." },
  ]);
  assert.deepEqual(patched[2], sequence[2]);
  assert.notEqual(patched[1], sequence[1]);
});

test("reviewing step 1 never makes it auto-sendable", () => {
  const patched = patchOutreachSequenceStep([
    { step: 1, subject: "First", body: "First body", send_mode: "draft_for_review" },
    { step: 2, subject: "Follow-up", body: "Follow-up body", send_mode: "draft_for_review" },
  ], {
    step: 1,
    reviewed: true,
    now: new Date("2026-07-01T10:00:00.000Z"),
  });
  const item = buildOutreachSequenceWorkspaceItem({
    item: queueItem({ status: "approved", sequence_messages: patched }),
    settings: { auto_follow_up_only: true },
  });

  assert.equal(patched[0].send_mode, "manual_approval_required");
  assert.equal(patched[0].approved, true);
  assert.equal(patched[0].reviewed_at, "2026-07-01T10:00:00.000Z");
  assert.equal(item.steps[0].send_mode, "manual_approval_required");
  assert.equal(item.steps[0].auto_sendable, false);
});

test("skipped follow-up exposes review metadata without active review work", () => {
  const sequence = patchOutreachSequenceStep([
    { step: 1, subject: "First", body: "First body", send_mode: "manual_approval_required", approved: true },
    { step: 2, subject: "Follow-up", body: "Follow-up body", send_mode: "draft_for_review", approved: true },
    { step: 3, subject: "Last", body: "Last body", send_mode: "draft_for_review", approved: false },
  ], {
    step: 2,
    skipped: true,
    now: new Date("2026-07-01T11:00:00.000Z"),
  });

  const workspace = buildOutreachSequenceWorkspace({
    queue: { items: [queueItem({ status: "follow_up_due", gmail_thread_id: "gmail-thread-1", sequence_messages: sequence })] },
    settings: { auto_follow_up_only: true },
  });
  const step = workspace.items[0].steps[1];

  assert.equal(step.state, "skipped");
  assert.equal(step.approved, true);
  assert.equal(step.reviewed, true);
  assert.equal(step.skipped, true);
  assert.equal(step.auto_sendable, false);
  assert.deepEqual(step.audit_events, [
    { action: "skipped", at: "2026-07-01T11:00:00.000Z", summary: "Skipped step 2." },
  ]);
  assert.equal(workspace.summary.review, 0);
});

test("falls back to evidence-driven sequence when stored sequence is missing", () => {
  const item = buildOutreachSequenceWorkspaceItem({
    item: queueItem({ sequence_messages: null }),
    settings: {},
  });

  assert.deepEqual(item.steps.map((step) => step.step), [1, 2, 3]);
  assert.equal(item.steps[0].send_mode, "manual_approval_required");
  assert.equal(item.steps[1].send_mode, "draft_for_review");
  assert.match(item.steps[0].body_preview, /GPU inference benchmarks|eval toolkit/);
});

test("auto follow-up eligibility only applies to approved step 2 or 3 messages when enabled", () => {
  const item = buildOutreachSequenceWorkspaceItem({
    item: queueItem({
      status: "follow_up_due",
      gmail_thread_id: "gmail-thread-1",
      sequence_messages: [
        { step: 1, subject: "First", body: "First", send_mode: "manual_approval_required", approved: true },
        { step: 2, subject: "Follow-up", body: "Follow-up", send_mode: "draft_for_review", approved: true },
        { step: 3, subject: "Last", body: "Last", send_mode: "draft_for_review", approved: false },
      ],
    }),
    settings: { auto_follow_up_only: true },
  });

  assert.equal(item.current_step, 2);
  assert.equal(item.next_action, "review follow-up");
  assert.equal(item.steps[0].auto_sendable, false);
  assert.equal(item.steps[1].auto_sendable, true);
  assert.equal(item.steps[2].auto_sendable, false);
});

test("contact-blocked follow-ups are never auto-sendable", () => {
  const sequence = [
    { step: 1, subject: "First", body: "First", send_mode: "manual_approval_required", approved: true },
    { step: 2, subject: "Follow-up", body: "Follow-up", send_mode: "draft_for_review", approved: true },
    { step: 3, subject: "Last", body: "Last", send_mode: "draft_for_review", approved: true },
  ];
  const cases = [
    {
      label: "no email",
      contact_profile: contactProfile({ emails: [] }),
      reason: "no_email",
    },
    {
      label: "low confidence",
      contact_profile: contactProfile({
        emails: [{ value: "ada@example.com", source: "github", confidence: "low", deliverability_status: "valid" }],
      }),
      reason: "low_confidence_email",
    },
    {
      label: "bounced",
      contact_profile: contactProfile({
        emails: [{ value: "ada@example.com", source: "github", confidence: "high", deliverability_status: "bounced" }],
      }),
      reason: "bounced_email",
    },
  ];

  for (const itemCase of cases) {
    const item = buildOutreachSequenceWorkspaceItem({
      item: queueItem({
        status: "follow_up_due",
        contact_profile: itemCase.contact_profile,
        sequence_messages: sequence,
      }),
      settings: { auto_follow_up_only: true },
    });

    assert.equal(item.block_reasons.includes(itemCase.reason), true, itemCase.label);
    assert.equal(item.steps[1].state, "blocked", itemCase.label);
    assert.equal(item.steps[1].auto_sendable, false, itemCase.label);
    assert.equal(item.steps[2].auto_sendable, false, itemCase.label);
  }
});

test("uses existing follow-up draft marker to identify step 3 as current", () => {
  const marker = `<!--signalhire-follow-up-draft:${encodeURIComponent(JSON.stringify({ step: 3, action_status: "draft_saved" }))}-->`;
  const item = buildOutreachSequenceWorkspaceItem({
    item: queueItem({
      status: "follow_up_due",
      notes: marker,
      gmail_thread_id: "gmail-thread-1",
      sequence_messages: [
        { step: 1, subject: "First", body: "First", send_mode: "manual_approval_required", approved: true },
        { step: 2, subject: "Follow-up", body: "Follow-up", send_mode: "draft_for_review", approved: true },
        { step: 3, subject: "Last", body: "Last", send_mode: "draft_for_review", approved: true },
      ],
    }),
    settings: { auto_follow_up_only: true },
  });

  assert.equal(item.current_step, 3);
  assert.equal(item.steps[1].state, "sent");
  assert.equal(item.steps[2].state, "review");
  assert.equal(item.steps[2].auto_sendable, true);
});

test("builds role-level workspace context without replacing candidate review", () => {
  const workspace = buildOutreachSequenceWorkspace({
    queue: { summary: { due: 1 }, items: [queueItem(), queueItem({ id: "thread-2", status: "approved" })] },
    settings: { auto_follow_up_only: true, client_visible_digest: false },
    digest: { markdown: "Weekly digest" },
    sequenceAnalytics: { replies: 2 },
  });

  assert.equal(workspace.settings.auto_follow_up_only, true);
  assert.equal(workspace.settings.follow_up_interval_days, 7);
  assert.equal(workspace.role_context.digest.markdown, "Weekly digest");
  assert.deepEqual(workspace.role_context.sequence_analytics, { replies: 2 });
  assert.equal(workspace.items.length, 2);
  assert.equal(workspace.summary.total, 2);
  assert.equal(workspace.summary.ready, 1);
});
