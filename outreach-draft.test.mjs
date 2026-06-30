import test from "node:test";
import assert from "node:assert/strict";
import * as outreachDraft from "./web/lib/outreach-draft.mjs";

test("builds evidence brief from strongest signals and verified claims", () => {
  assert.equal(typeof outreachDraft.buildOutreachEvidenceBrief, "function");

  const brief = outreachDraft.buildOutreachEvidenceBrief({
    name: "Ada Lovelace",
    outreach_angle: "Mention her public LLM serving work.",
    strongest_signals: ["Merged vLLM serving PRs", "Wrote a Triton inference post"],
    claims: [
      {
        claim: "Maintains a public vLLM integration",
        verdict: "verified",
        evidence: [{ note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" }],
      },
      {
        claim: "Currently lives in Berlin",
        verdict: "unverified",
        evidence: [],
      },
    ],
    uncertainties: ["Availability is unknown"],
    links: { github: "https://github.com/example", linkedin: "https://linkedin.com/in/example" },
  });

  assert.equal(brief.candidate_name, "Ada Lovelace");
  assert.equal(brief.contact_angle, "Mention her public LLM serving work.");
  assert.deepEqual(brief.proof_points.slice(0, 3), [
    "Merged vLLM serving PRs",
    "Wrote a Triton inference post",
    "Maintains a public vLLM integration",
  ]);
  assert.deepEqual(brief.evidence_links, ["https://github.com/example/vllm"]);
  assert.equal(brief.risk_note, "Availability is unknown");
  assert.deepEqual(brief.public_profiles, ["GitHub", "LinkedIn"]);
});

test("builds editable outreach draft that references evidence and omits unverified claims", () => {
  assert.equal(typeof outreachDraft.buildEvidenceDrivenOutreachDraft, "function");

  const draft = outreachDraft.buildEvidenceDrivenOutreachDraft({
    tone: "short",
    senderName: "Chen",
    roleBrief: "Senior LLM inference engineer",
    candidate: {
      name: "Ada Lovelace",
      current_role: "Staff Engineer",
      current_company: "Example AI",
      strongest_signals: ["Merged vLLM serving PRs"],
      claims: [
        { claim: "Maintains a public vLLM integration", verdict: "verified" },
        { claim: "Currently lives in Berlin", verdict: "unverified" },
      ],
      outreach_angle: "Lead with her LLM serving work.",
    },
  });

  assert.match(draft.subject, /Ada/);
  assert.match(draft.body, /vLLM serving PRs/);
  assert.match(draft.body, /Senior LLM inference engineer/);
  assert.match(draft.body, /Chen/);
  assert.doesNotMatch(draft.body, /Berlin/);
  assert.equal(draft.evidence_brief.proof_points.includes("Maintains a public vLLM integration"), true);
});

test("builds three outreach sequence messages with review-only follow-ups", () => {
  assert.equal(typeof outreachDraft.buildEvidenceDrivenOutreachSequence, "function");

  const sequence = outreachDraft.buildEvidenceDrivenOutreachSequence({
    tone: "friendly",
    senderName: "Jian",
    roleBrief: "a founding ML infrastructure engineer",
    candidate: {
      name: "Ada Lovelace",
      current_role: "ML Engineer",
      current_company: "Example AI",
      strongest_signals: ["Published GPU inference benchmarks", "Maintains an open-source eval toolkit"],
      claims: [
        {
          claim: "Maintains eval toolkit",
          verdict: "verified",
          evidence: [{ url: "https://github.com/ada/eval" }],
        },
      ],
      outreach_angle: "Lead with her GPU inference benchmark work.",
    },
  });

  assert.equal(sequence.length, 3);
  assert.deepEqual(sequence.map((message) => message.step), [1, 2, 3]);
  assert.equal(sequence[0].send_mode, "manual_approval_required");
  assert.equal(sequence[1].send_mode, "draft_for_review");
  assert.equal(sequence[2].send_mode, "draft_for_review");
  assert.equal(sequence[1].delay_days, 7);
  assert.equal(sequence[2].delay_days, 7);
  assert.deepEqual(sequence[0].evidence_refs.slice(0, 2), [
    "Published GPU inference benchmarks",
    "Maintains an open-source eval toolkit",
  ]);
  assert.match(sequence[0].body, /GPU inference benchmarks|eval toolkit/);
  assert.match(sequence[1].body, /GPU inference benchmarks|eval toolkit/);
  assert.match(sequence[2].body, /GPU inference benchmarks|eval toolkit/);
});
