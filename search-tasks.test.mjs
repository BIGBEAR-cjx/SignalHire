import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNextRunAt,
  buildSearchTaskRunLabel,
  classifyTaskCandidates,
  normalizeSearchTaskInput,
  summarizeTaskRuns,
} from "./web/lib/search-tasks.mjs";

test("normalizes search task input with safe defaults", () => {
  const input = normalizeSearchTaskInput({
    name: "  Agent monitor  ",
    brief: "  Find founding agent engineers  ",
    frequency: "daily",
    status: "paused",
  });

  assert.deepEqual(input, {
    name: "Agent monitor",
    brief: "Find founding agent engineers",
    frequency: "daily",
    status: "paused",
  });

  const fallback = normalizeSearchTaskInput({ name: "", brief: "LLM infra", frequency: "cron" });
  assert.equal(fallback.name, "LLM infra");
  assert.equal(fallback.frequency, "manual");
  assert.equal(fallback.status, "active");
});

test("computes next run times for manual, daily, and weekly monitors", () => {
  const now = new Date("2026-06-15T10:00:00.000Z");

  assert.equal(buildNextRunAt({ frequency: "manual", now }), null);
  assert.equal(buildNextRunAt({ frequency: "daily", now }), "2026-06-16T10:00:00.000Z");
  assert.equal(buildNextRunAt({ frequency: "weekly", now }), "2026-06-22T10:00:00.000Z");
});

test("builds stable labels for task-created research runs", () => {
  assert.equal(
    buildSearchTaskRunLabel({ taskName: "Agent monitor", sequence: 3 }),
    "Agent monitor · Monitor run 3",
  );
});

test("classifies task run candidates as new, seen before, or evidence updated", () => {
  const result = {
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Engineer",
        current_company: "Example AI",
        evidence_audit: { overall_evidence_quality: "high" },
        claims: [{ claim: "Built agent infra", verdict: "verified", evidence: [{ url: "https://github.com/example/agent", source_type: "code" }] }],
      },
      {
        name: "Grace Hopper",
        claims: [{ claim: "Published eval work", verdict: "verified", evidence: [{ url: "https://arxiv.org/abs/1234.5678", source_type: "paper" }] }],
      },
      {
        name: "Katherine Johnson",
        claims: [{ claim: "Works on robotics", verdict: "unverified", evidence: [] }],
      },
    ],
  };
  const knownProfiles = [
    { cache_key: "ada-lovelace", name: "Ada Lovelace", current_role: "Engineer", current_company: "Example AI", evidence_urls: ["https://example.com/old"], updated_at: "2026-06-01T00:00:00.000Z" },
    { cache_key: "katherine-johnson", name: "Katherine Johnson", evidence_urls: [], updated_at: "2026-06-01T00:00:00.000Z" },
  ];

  const classified = classifyTaskCandidates({ result, knownProfiles });

  assert.deepEqual(classified.summary, { new_candidates: 1, seen_candidates: 2, updated_candidates: 1 });
  assert.deepEqual(
    classified.items.map((item) => [item.name, item.discovery_state, item.evidence_updated]),
    [
      ["Ada Lovelace", "seen_before", true],
      ["Grace Hopper", "new_candidate", false],
      ["Katherine Johnson", "seen_before", false],
    ],
  );
});

test("does not collapse same-name candidates across different companies", () => {
  const result = {
    candidates: [
      {
        name: "Alex Chen",
        current_role: "Agent Engineer",
        current_company: "NewCo AI",
        claims: [{ claim: "Built eval agents", verdict: "verified", evidence: [{ url: "https://newco.example/alex", source_type: "company" }] }],
      },
    ],
  };
  const knownProfiles = [
    {
      cache_key: "alex-chen-oldco",
      name: "Alex Chen",
      current_role: "Research Engineer",
      current_company: "OldCo Labs",
      evidence_urls: ["https://oldco.example/alex"],
    },
  ];

  const classified = classifyTaskCandidates({ result, knownProfiles });

  assert.equal(classified.summary.new_candidates, 1);
  assert.equal(classified.summary.seen_candidates, 0);
  assert.equal(classified.items[0].discovery_state, "new_candidate");
});

test("does not use sparse name-only cache rows for candidates with role or company evidence", () => {
  const classified = classifyTaskCandidates({
    result: {
      candidates: [
        {
          name: "Alex Chen",
          current_role: "Agent Engineer",
          current_company: "NewCo AI",
          claims: [{ claim: "Built eval agents", verdict: "verified", evidence: [{ url: "https://newco.example/alex", source_type: "company" }] }],
        },
      ],
    },
    knownProfiles: [
      { cache_key: "alex-chen", name: "Alex Chen", evidence_urls: ["https://old.example/alex"] },
    ],
  });

  assert.equal(classified.summary.new_candidates, 1);
  assert.equal(classified.summary.seen_candidates, 0);
  assert.equal(classified.items[0].discovery_state, "new_candidate");
});

test("keeps name-only matching for sparse candidates without identity context", () => {
  const classified = classifyTaskCandidates({
    result: {
      candidates: [
        { name: "Alex Chen", claims: [{ claim: "Works on agents", verdict: "unverified", evidence: [] }] },
      ],
    },
    knownProfiles: [
      { cache_key: "alex-chen", name: "Alex Chen", evidence_urls: [] },
    ],
  });

  assert.equal(classified.summary.new_candidates, 0);
  assert.equal(classified.summary.seen_candidates, 1);
  assert.equal(classified.items[0].discovery_state, "seen_before");
});

test("summarizes monitor run history for project task cards", () => {
  const summary = summarizeTaskRuns([
    { status: "done", result: { task_discovery: { summary: { new_candidates: 2, updated_candidates: 1 } } }, updated_at: "2026-06-15T09:00:00.000Z" },
    { status: "running", result: null, updated_at: "2026-06-15T10:00:00.000Z" },
  ]);

  assert.deepEqual(summary, {
    last_status: "running",
    last_run_at: "2026-06-15T10:00:00.000Z",
    new_candidates: 2,
    updated_candidates: 1,
  });
});
