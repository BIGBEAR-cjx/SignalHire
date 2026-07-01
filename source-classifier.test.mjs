import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildSourceMixUxView,
  classifySourceType,
  sourceTypeLabel,
  sourceTypeTooltip,
} from "./web/lib/source-classifier.mjs";

test("classifies GitHub sources from URL and metadata text", () => {
  assert.equal(classifySourceType({ source_url: "https://github.com/ada/evals" }), "github");
  assert.equal(classifySourceType({ metadata: { provider: "GitHub Search" } }), "github");
});

test("classifies paper sources from publication hosts and providers", () => {
  assert.equal(classifySourceType({ url: "https://openreview.net/forum?id=abc" }), "paper");
  assert.equal(classifySourceType({ source_url: "https://arxiv.org/abs/2401.12345" }), "paper");
  assert.equal(classifySourceType({ provider: "OpenAlex" }), "paper");
  assert.equal(classifySourceType({ metadata: { source_family: "Semantic Scholar" } }), "paper");
});

test("classifies company pages without overriding GitHub or LinkedIn", () => {
  assert.equal(classifySourceType({ source_url: "https://example.ai/team/ada" }), "company_page");
  assert.equal(classifySourceType({ source_url: "https://example.ai/jobs/ml-engineer" }), "company_page");
  assert.equal(classifySourceType({ metadata: { page_type: "employment page" } }), "company_page");
  assert.equal(classifySourceType({ source_url: "https://github.com/example/about" }), "github");
  assert.equal(classifySourceType({ source_url: "https://www.linkedin.com/company/example/about" }), "linkedin_seed");
});

test("classifies personal sites only when source looks personal", () => {
  assert.equal(
    classifySourceType({
      source_url: "https://ada.dev",
      title: "Ada Lovelace - portfolio",
    }),
    "personal_site",
  );
  assert.equal(
    classifySourceType({
      source_url: "https://example.ai/blog/launch",
      title: "Example AI launch notes",
    }),
    "public_web",
  );
});

test("preserves lead, internal, and upload source types", () => {
  assert.equal(classifySourceType({ source_type: "people_api", provider: "pdl" }), "people_api");
  assert.equal(classifySourceType({ source_url: "https://linkedin.com/in/ada" }), "linkedin_seed");
  assert.equal(classifySourceType({ source_type: "internal_resume" }), "internal_resume");
  assert.equal(classifySourceType({ source_type: "manual_upload" }), "manual_upload");
});

test("falls back to public web for unknown public sources", () => {
  assert.equal(classifySourceType({ source_url: "https://example.ai/blog/ada" }), "public_web");
  assert.equal(classifySourceType({ source_type: "unknown_source" }), "public_web");
  assert.equal(classifySourceType(), "public_web");
});

test("returns labels and tooltips for every source type", () => {
  const sourceTypes = [
    "github",
    "paper",
    "company_page",
    "personal_site",
    "people_api",
    "linkedin_seed",
    "public_web",
    "internal_resume",
    "manual_upload",
  ];

  for (const sourceType of sourceTypes) {
    assert.ok(sourceTypeLabel(sourceType, "en"));
    assert.ok(sourceTypeLabel(sourceType, "zh"));
    assert.ok(sourceTypeTooltip(sourceType, "en"));
    assert.ok(sourceTypeTooltip(sourceType, "zh"));
  }

  assert.equal(sourceTypeLabel("github", "en"), "GitHub");
  assert.equal(sourceTypeLabel("linkedin_seed", "zh"), "LinkedIn 线索");
  assert.match(sourceTypeTooltip("people_api", "en"), /lead\/contact source/i);
  assert.match(sourceTypeTooltip("paper", "zh"), /研究证据/);
});

test("builds source mix UX counts for evidence-backed and lead-only sources", () => {
  const view = buildSourceMixUxView([
    { source_type: "github", count: 2 },
    { source_type: "people_api", count: 3 },
    { source_type: "linkedin_seed", count: 1 },
    { source_type: "public_web", count: 4 },
  ], { locale: "en" });

  assert.equal(view.evidence_source_count, 6);
  assert.equal(view.lead_source_count, 4);
  assert.equal(view.total_source_count, 10);
  assert.deepEqual(view.evidence_types, ["github", "public_web"]);
  assert.deepEqual(view.lead_types, ["people_api", "linkedin_seed"]);
  assert.equal(view.status_label, "Evidence-backed with profile leads");
  assert.match(view.next_step, /verify profile leads before outreach/i);
});

test("builds source mix UX copy for lead-only coverage", () => {
  const view = buildSourceMixUxView([
    { source_type: "people_api", count: 2 },
  ], { locale: "zh" });

  assert.equal(view.evidence_source_count, 0);
  assert.equal(view.lead_source_count, 2);
  assert.equal(view.total_source_count, 2);
  assert.equal(view.status_label, "资料线索需补证据");
  assert.match(view.next_step, /推荐或外联前需先验证公开证据/);
});

test("Role Workspace references source mix UX helper without database search copy", () => {
  const page = readFileSync(new URL("./web/app/app/projects/[id]/page.tsx", import.meta.url), "utf8");

  assert.match(page, /buildSourceMixUxView/);
  assert.doesNotMatch(page, /database search/i);
});
