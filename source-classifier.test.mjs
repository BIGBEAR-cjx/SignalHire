import test from "node:test";
import assert from "node:assert/strict";
import {
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
  assert.match(sourceTypeTooltip("people_api", "en"), /Lead\/contact source/);
  assert.match(sourceTypeTooltip("paper", "zh"), /研究证据/);
});
