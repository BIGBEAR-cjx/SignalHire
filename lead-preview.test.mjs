import test from "node:test";
import assert from "node:assert/strict";
import { buildLeadPreviewView } from "./web/lib/lead-preview.mjs";
import { buildLeadPreviewConstraint } from "./web/lib/lead-preview-feedback.mjs";

test("builds unverified lead previews from progress candidate submission events", () => {
  const view = buildLeadPreviewView({
    run: {
      status: "running",
      progress: {
        agent_execution: {
          candidate_submission_events: [
            {
              name: "Ada Lovelace",
              headline: "ML Systems Engineer",
              company: "Example AI",
              source_type: "github",
              source_url: "https://github.com/ada",
              match_reason: "Maintains GPU inference projects",
              confidence: "medium",
            },
          ],
        },
      },
    },
  });

  assert.equal(view.status, "preview_available");
  assert.equal(view.feedback_constraints.length, 0);
  assert.equal(view.items[0].label, "unverified lead");
  assert.equal(view.items[0].candidate_name, "Ada Lovelace");
  assert.equal(view.items[0].headline, "ML Systems Engineer");
  assert.equal(view.items[0].company, "Example AI");
  assert.equal(view.items[0].source_type, "github");
  assert.equal(view.items[0].source_url, "https://github.com/ada");
  assert.equal(view.items[0].possible_match_reason, "Maintains GPU inference projects");
  assert.equal(view.items[0].confidence, "medium");
  assert.equal(view.items[0].feedback_state, "untouched");
  assert.equal(view.items[0].can_outreach, false);
  assert.deepEqual(view.items[0].missing_evidence, ["public evidence packet", "contact provenance"]);
});

test("builds preview items from open evidence leads", () => {
  const view = buildLeadPreviewView({
    run: { status: "running" },
    openEvidenceLeads: [
      {
        id: "lead-1",
        provider: "github",
        source_type: "github",
        source_url: "https://github.com/ada",
        title: "Ada Lovelace",
        snippet: "Maintains inference benchmarks",
        confidence: "high",
      },
    ],
  });

  assert.equal(view.status, "preview_available");
  assert.equal(view.items[0].id, "github.com/ada");
  assert.equal(view.items[0].candidate_name, "Ada Lovelace");
  assert.equal(view.items[0].headline, "Maintains inference benchmarks");
  assert.equal(view.items[0].source_type, "github");
  assert.equal(view.items[0].possible_match_reason, "Maintains inference benchmarks");
  assert.equal(view.items[0].confidence, "high");
  assert.equal(view.items[0].feedback_state, "untouched");
});

test("labels people API rows as profile leads that require verification", () => {
  const view = buildLeadPreviewView({
    run: { status: "running" },
    openEvidenceLeads: [
      {
        provider: "openjobs_mira",
        source_type: "people_api",
        url: "https://linkedin.com/in/ada",
        title: "Ada Lovelace",
        snippet: "OpenJobs profile lead",
        confidence: "low",
      },
    ],
  });

  assert.equal(view.items[0].label, "profile lead");
  assert.equal(view.items[0].source_type, "people_api");
  assert.equal(view.items[0].can_outreach, false);
  assert.match(view.items[0].next_verification_step, /evidence verification/i);
});

test("dedupes preview leads by source url and name company key", () => {
  const view = buildLeadPreviewView({
    run: {
      status: "running",
      progress: {
        agent_execution: {
          candidate_submission_events: [
            { name: "Ada Lovelace", company: "Example AI", source_url: "https://github.com/ada", source_type: "github" },
            { name: "Ada Lovelace", company: "Example AI", source_url: "https://github.com/ada/", source_type: "github" },
            { name: "Grace Hopper", company: "Navy", source_type: "paper" },
            { name: "Grace Hopper", company: "Navy", source_type: "conference" },
          ],
        },
      },
    },
  });

  assert.equal(view.items.length, 2);
  assert.deepEqual(
    view.items.map((item) => item.candidate_name),
    ["Ada Lovelace", "Grace Hopper"],
  );
});

test("returns completed status when verified shortlist or candidates exist", () => {
  const shortlistView = buildLeadPreviewView({
    run: {
      status: "completed",
      progress: {
        agent_execution: {
          candidate_submission_events: [{ name: "Ada Lovelace", source_url: "https://github.com/ada" }],
        },
      },
      result: { shortlist: [{ name: "Grace Hopper" }] },
    },
  });
  const candidatesView = buildLeadPreviewView({
    run: {
      status: "completed",
      result: { candidates: [{ name: "Grace Hopper" }] },
    },
  });

  assert.equal(shortlistView.status, "verified_results_available");
  assert.equal(shortlistView.items.length, 0);
  assert.equal(candidatesView.status, "verified_results_available");
  assert.equal(candidatesView.items.length, 0);
});

test("uses result candidate submission events only when verified results are absent", () => {
  const view = buildLeadPreviewView({
    run: {
      status: "completed",
      result: {
        agent_execution: {
          candidate_submission_events: [
            {
              name: "Ada Growth",
              role: "Growth Lead",
              source: "profile",
              source_url: "https://example.com/ada",
              reason: "Cached submission",
            },
          ],
        },
      },
    },
  });

  assert.equal(view.status, "preview_available");
  assert.equal(view.items[0].candidate_name, "Ada Growth");
  assert.equal(view.items[0].headline, "Growth Lead");
  assert.equal(view.items[0].source_type, "profile");
  assert.equal(view.items[0].possible_match_reason, "Cached submission");
});

test("returns waiting status and ignores malformed lead rows", () => {
  const view = buildLeadPreviewView({
    run: {
      progress: {
        agent_execution: {
          candidate_submission_events: [null, "bad row", {}, { name: "  " }],
        },
      },
    },
    openEvidenceLeads: [null, {}],
  });

  assert.equal(view.status, "waiting_for_leads");
  assert.equal(view.items.length, 0);
});

test("not relevant feedback becomes a next-search constraint", () => {
  const constraint = buildLeadPreviewConstraint({
    lead: {
      id: "github.com/ada",
      candidate_name: "Ada Lovelace",
      source_type: "github",
      source_url: "https://github.com/ada",
      possible_match_reason: "Only frontend demos, not infra",
    },
    reason: "Too frontend-focused",
  });

  assert.deepEqual(constraint, {
    lead_id: "github.com/ada",
    feedback: "not_relevant",
    reason: "Too frontend-focused",
    source_type: "github",
    source_url: "https://github.com/ada",
    candidate_name: "Ada Lovelace",
    next_search_instruction: "Avoid similar github leads: Too frontend-focused. Source: https://github.com/ada",
  });
});
