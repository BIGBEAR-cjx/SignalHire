import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFeedbackOptimizationPreview,
  buildProjectNextSteps,
  buildResearchLoopView,
  extractRecentResearchItems,
  inferResearchCoverage,
} from "./web/lib/research-loop.mjs";

const mixedFeed = [
  { id: 1, kind: "search", info: "LLM inference engineers site:github.com" },
  { id: 2, kind: "fetch", info: "https://github.com/example/inference-runtime" },
  { id: 3, kind: "fetch", info: "https://arxiv.org/abs/2401.12345" },
  { id: 4, kind: "fetch", info: "https://openai.com/research" },
  { id: 5, kind: "fetch", info: "https://example.dev/blog/ai-systems" },
];

test("builds a Chinese research loop view from active search and fetch events", () => {
  const view = buildResearchLoopView({
    feed: mixedFeed,
    live: { searches: 1, fetches: 4 },
    jobStatus: { phase: "running" },
  });

  assert.equal(view.locale, "zh");
  assert.equal(view.phase.key, "fetching");
  assert.equal(view.phase.label, "正在读取来源");
  assert.equal(view.phase.detail, "https://example.dev/blog/ai-systems");
  assert.equal(view.statsText, "搜索 1 次 · 抓取 4 页");
  assert.deepEqual(
    view.coverage.map((item) => item.key),
    ["github", "papers", "company", "public_web"],
  );
  assert.deepEqual(
    view.recentItems.map((item) => [item.kind, item.detail]),
    [
      ["fetch", "https://example.dev/blog/ai-systems"],
      ["fetch", "https://openai.com/research"],
      ["fetch", "https://arxiv.org/abs/2401.12345"],
      ["fetch", "https://github.com/example/inference-runtime"],
      ["search", "LLM inference engineers site:github.com"],
    ],
  );
});

test("builds an English planning state when no research events exist", () => {
  const view = buildResearchLoopView({ feed: [], live: null, locale: "en" });

  assert.equal(view.locale, "en");
  assert.equal(view.phase.key, "planning");
  assert.equal(view.phase.label, "Planning the search");
  assert.equal(view.phase.detail, "Breaking down the profile into keywords and source targets.");
  assert.equal(view.statsText, "Waiting for the first research event");
  assert.deepEqual(view.coverage, []);
  assert.deepEqual(view.recentItems, []);
});

test("infers source coverage from research feed text", () => {
  const coverage = inferResearchCoverage(mixedFeed);

  assert.deepEqual(
    coverage.map((item) => [item.key, item.count]),
    [
      ["github", 2],
      ["papers", 1],
      ["company", 1],
      ["public_web", 1],
    ],
  );
});

test("extracts recent search and fetch items with stable ids and details", () => {
  const recentItems = extractRecentResearchItems([
    { id: 1, kind: "think", info: "preparing" },
    { id: 2, kind: "search", info: "first query" },
    { id: 3, kind: "fetch", info: "https://example.com/a" },
    { id: 4, kind: "search", info: "second query" },
  ]);

  assert.deepEqual(recentItems, [
    { id: 4, kind: "search", detail: "second query", sourceType: "public_web" },
    { id: 3, kind: "fetch", detail: "https://example.com/a", sourceType: "public_web" },
    { id: 2, kind: "search", detail: "first query", sourceType: "public_web" },
  ]);
});

test("requires precision and satisfaction before feedback optimization can run", () => {
  const preview = buildFeedbackOptimizationPreview({
    feedback: { precision: "off", satisfaction: "" },
    locale: "en",
  });

  assert.equal(preview.locale, "en");
  assert.equal(preview.canRun, false);
  assert.deepEqual(preview.required, ["satisfaction"]);
  assert.equal(preview.statusText, "Choose precision and satisfaction to preview the next round.");
  assert.deepEqual(preview.actions, []);
});

test("previews stricter evidence and broader sourcing for weak feedback", () => {
  const preview = buildFeedbackOptimizationPreview({
    feedback: {
      precision: "off",
      satisfaction: "unsatisfied",
      issue: "weak_evidence",
      focus: "expand_sources",
    },
  });

  assert.equal(preview.locale, "zh");
  assert.equal(preview.canRun, true);
  assert.deepEqual(
    preview.actions.map((item) => item.key),
    ["tighten_profile", "strengthen_evidence", "expand_sources", "adjust_candidate_pool"],
  );
  assert.match(preview.actions[0].label, /收紧/);
  assert.match(preview.actions[2].detail, /GitHub|论文|公司页/);
});

test("builds project next steps for empty and filtered projects", () => {
  assert.deepEqual(buildProjectNextSteps({ candidateCount: 0, runCount: 0 }), {
    locale: "zh",
    title: "下一步建议",
    state: "empty",
    latestRunLabel: "",
    actions: [
      {
        key: "start_search",
        label: "启动本项目搜人",
        detail: "候选池为空，先用项目画像启动第一轮搜索。",
      },
    ],
  });

  const filtered = buildProjectNextSteps({
    candidateCount: 8,
    runCount: 2,
    hasFilter: true,
    latestRunLabel: "LLM infra search",
    locale: "en",
  });

  assert.equal(filtered.locale, "en");
  assert.equal(filtered.state, "filtered");
  assert.deepEqual(
    filtered.actions.map((item) => item.key),
    ["review_candidates", "review_latest_run", "clear_filter"],
  );
  assert.match(filtered.actions[1].detail, /LLM infra search/);
});
