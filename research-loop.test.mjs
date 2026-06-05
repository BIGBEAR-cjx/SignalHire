import test from "node:test";
import assert from "node:assert/strict";
import * as researchLoop from "./web/lib/research-loop.mjs";

import {
  buildFeedbackOptimizationPreview,
  buildLatestProjectFeedbackPreference,
  buildPersistedSearchFeedback,
  buildProjectResearchRounds,
  buildProjectNextSteps,
  buildProjectSearchConsole,
  buildResearchLoopView,
  extractRecentResearchItems,
  inferResearchCoverage,
  mergeSearchFeedbackIntoResult,
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
    view.sourceGroups.map((item) => [item.key, item.count, item.latestKind, item.latestDetail]),
    [
      ["github", 2, "fetch", "https://github.com/example/inference-runtime"],
      ["papers", 1, "fetch", "https://arxiv.org/abs/2401.12345"],
      ["company", 1, "fetch", "https://openai.com/research"],
      ["public_web", 1, "fetch", "https://example.dev/blog/ai-systems"],
    ],
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
  assert.deepEqual(view.sourceGroups, []);
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

test("builds localized candidate feedback choices next to reviewed candidate", () => {
  assert.equal(typeof researchLoop.buildCandidateFeedbackPanel, "function");

  const zh = researchLoop.buildCandidateFeedbackPanel({
    candidate: { name: "Ada Lovelace" },
    feedback: { precision: "partial", satisfaction: "mixed", issue: "weak_evidence" },
    locale: "zh",
  });

  assert.equal(zh.title, "这位候选人是否合适？");
  assert.match(zh.description, /Ada Lovelace/);
  assert.deepEqual(zh.groups.map((group) => group.key), ["precision", "satisfaction", "issue", "focus"]);
  assert.equal(zh.groups[0].options.find((option) => option.value === "partial")?.selected, true);
  assert.equal(zh.groups[1].options.find((option) => option.value === "mixed")?.selected, true);
  assert.equal(zh.groups[2].options.find((option) => option.value === "weak_evidence")?.selected, true);
  assert.equal(zh.groups[3].options.find((option) => option.value === "stronger_evidence")?.label, "强化证据");

  const en = researchLoop.buildCandidateFeedbackPanel({
    candidate: { name: "Ada Lovelace" },
    feedback: { precision: "off", satisfaction: "unsatisfied", focus: "adjacent_pools" },
    locale: "en",
  });

  assert.equal(en.title, "Is this candidate a fit?");
  assert.match(en.description, /Ada Lovelace/);
  assert.equal(en.groups[0].options.find((option) => option.value === "off")?.selected, true);
  assert.equal(en.groups[3].options.find((option) => option.value === "adjacent_pools")?.selected, true);
});

test("builds project candidate decision queues from status and evidence risk", () => {
  assert.equal(typeof researchLoop.buildProjectCandidateDecisionQueue, "function");

  const items = [
    {
      id: "new-strong",
      status: "new",
      candidate: { name: "Ada", evidence_audit: { overall_evidence_quality: "high" }, claims: [] },
    },
    {
      id: "weak-evidence",
      status: "new",
      candidate: {
        name: "Grace",
        evidence_audit: { overall_evidence_quality: "low" },
        claims: [{ claim: "Built agent infra", verdict: "unverified", evidence: [] }],
      },
    },
    {
      id: "contacted",
      status: "contacted",
      candidate: { name: "Lin", evidence_audit: { overall_evidence_quality: "medium" }, claims: [] },
    },
    {
      id: "rejected",
      status: "rejected",
      candidate: { name: "Alan", evidence_audit: { overall_evidence_quality: "high" }, claims: [] },
    },
  ];

  const zh = researchLoop.buildProjectCandidateDecisionQueue({ items, locale: "zh" });

  assert.deepEqual(zh.columns.map((column) => [column.key, column.title, column.count]), [
    ["review", "待看", 1],
    ["interested", "推进中", 1],
    ["needs_evidence", "需补证据", 1],
    ["rejected", "不合适", 1],
  ]);
  assert.deepEqual(zh.columns.map((column) => column.items.map((item) => item.id)), [
    ["new-strong"],
    ["contacted"],
    ["weak-evidence"],
    ["rejected"],
  ]);
  assert.match(zh.columns[2].items[0].reason, /证据/);
  assert.equal(zh.columns[2].items[0].canBackfill, true);
  assert.match(zh.columns[2].items[0].backfillInput, /Candidate evidence backfill search for SignalHire/);
  assert.match(zh.columns[2].items[0].backfillInput, /Grace/);
  assert.match(zh.columns[2].items[0].backfillInput, /Built agent infra/);
  assert.equal(zh.columns[0].items[0].canBackfill, false);
  assert.equal(zh.columns[0].items[0].backfillInput, "");

  const en = researchLoop.buildProjectCandidateDecisionQueue({ items, locale: "en" });
  assert.equal(en.columns[0].title, "To review");
  assert.equal(en.columns[2].title, "Needs evidence");
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

test("builds a project search console from brief, latest round, feedback, and next steps", () => {
  const consoleView = buildProjectSearchConsole({
    project: {
      name: "Senior AI Infra",
      brief: "找做过 vLLM 推理服务的资深工程师",
    },
    candidateCount: 6,
    hasFilter: false,
    runs: [
      {
        id: "run-2",
        kind: "search",
        label: "Feedback-optimized SignalHire search.",
        query_text: "Feedback-optimized SignalHire search.\nExpand GitHub and paper sources.",
        status: "done",
        summary: "Expanded source coverage",
        updated_at: "2026-06-05T12:00:00.000Z",
        result: {
          search_feedback: {
            precision: "partial",
            satisfaction: "mixed",
            issue: "weak_evidence",
            focus: "expand_sources",
            optimized_query: "下一轮优化画像",
          },
        },
      },
      {
        id: "run-1",
        kind: "search",
        label: "Senior AI Infra",
        query_text: "Senior AI Infra",
        status: "done",
        updated_at: "2026-06-05T11:00:00.000Z",
      },
    ],
  });

  assert.equal(consoleView.locale, "zh");
  assert.equal(consoleView.title, "项目搜索控制台");
  assert.equal(consoleView.briefText, "找做过 vLLM 推理服务的资深工程师");
  assert.equal(consoleView.latestRound?.badge, "反馈优化");
  assert.equal(consoleView.latestRound?.label, "Feedback-optimized SignalHire search.");
  assert.equal(consoleView.nextSearchInput, "下一轮优化画像");
  assert.deepEqual(
    consoleView.feedback?.items.map((item) => [item.label, item.value]),
    [
      ["精准度", "部分精准"],
      ["满意度", "一般"],
      ["主要问题", "证据不足"],
      ["下一轮方向", "扩来源"],
    ],
  );
  assert.deepEqual(
    consoleView.nextSteps.actions.map((item) => item.key),
    ["review_candidates", "review_latest_run"],
  );
});

test("builds project research rounds from newest-first project runs", () => {
  const rounds = buildProjectResearchRounds({
    runs: [
      {
        id: "run-3",
        kind: "search",
        label: "Feedback-optimized SignalHire search.",
        query_text: "Feedback-optimized SignalHire search.\nUser feedback from reviewed shortlist:\nPrecision: 不精准",
        status: "done",
        summary: "Found replacement candidates",
        updated_at: "2026-06-05T12:00:00.000Z",
        result: {
          search_feedback: {
            precision: "off",
            satisfaction: "unsatisfied",
            issue: "weak_evidence",
            focus: "expand_sources",
          },
        },
      },
      {
        id: "run-2",
        kind: "search",
        label: "补搜 practice/code",
        query_text: "Backfill SignalHire search for missing evidence",
        status: "done",
        summary: "Filled code evidence",
        updated_at: "2026-06-05T11:00:00.000Z",
      },
      {
        id: "run-1",
        kind: "search",
        label: "Senior LLM infra engineer",
        query_text: "Senior LLM infra engineer",
        status: "done",
        summary: "Initial shortlist",
        updated_at: "2026-06-05T10:00:00.000Z",
      },
    ],
  });

  assert.equal(rounds.locale, "zh");
  assert.equal(rounds.title, "项目搜索轮次");
  assert.deepEqual(
    rounds.items.map((item) => [item.id, item.roundNumber, item.kind, item.variant, item.badge]),
    [
      ["run-3", 3, "search", "feedback", "反馈优化"],
      ["run-2", 2, "search", "backfill", "证据补搜"],
      ["run-1", 1, "search", "initial", "首轮搜索"],
    ],
  );
  assert.equal(rounds.items[0].nextSearchInput, rounds.items[0].queryText);
  assert.match(rounds.items[0].description, /根据上一轮反馈/);
  assert.equal(rounds.items[0].feedbackSummary.title, "本轮反馈");
  assert.deepEqual(
    rounds.items[0].feedbackSummary.items.map((item) => [item.key, item.label, item.value]),
    [
      ["precision", "精准度", "不精准"],
      ["satisfaction", "满意度", "不满意"],
      ["issue", "主要问题", "证据不足"],
      ["focus", "下一轮方向", "扩来源"],
    ],
  );
});

test("builds English feedback summaries for project research rounds", () => {
  const rounds = buildProjectResearchRounds({
    locale: "en",
    runs: [
      {
        id: "run-1",
        kind: "search",
        label: "Senior LLM infra engineer",
        query_text: "Senior LLM infra engineer",
        status: "done",
        updated_at: "2026-06-05T10:00:00.000Z",
        result: {
          search_feedback: {
            precision: "partial",
            satisfaction: "mixed",
            issue: "wrong_seniority",
            focus: "higher_seniority",
          },
        },
      },
    ],
  });

  assert.equal(rounds.items[0].feedbackSummary.title, "Round feedback");
  assert.deepEqual(
    rounds.items[0].feedbackSummary.items.map((item) => [item.label, item.value]),
    [
      ["Precision", "Partly precise"],
      ["Satisfaction", "Mixed"],
      ["Main issue", "Wrong seniority"],
      ["Next-round focus", "Higher seniority"],
    ],
  );
});

test("builds English empty project research rounds", () => {
  const rounds = buildProjectResearchRounds({ runs: [], locale: "en" });

  assert.equal(rounds.locale, "en");
  assert.equal(rounds.title, "Project search rounds");
  assert.equal(rounds.emptyText, "No project search rounds yet.");
  assert.deepEqual(rounds.items, []);
});

test("builds the latest project feedback preference from saved search feedback", () => {
  const preference = buildLatestProjectFeedbackPreference({
    locale: "zh",
    baseInput: "原始画像",
    runs: [
      {
        id: "old-run",
        updated_at: "2026-06-05T09:00:00.000Z",
        result: {
          search_feedback: {
            precision: "accurate",
            satisfaction: "satisfied",
            optimized_query: "旧的优化画像",
          },
        },
      },
      {
        id: "latest-run",
        updated_at: "2026-06-05T10:00:00.000Z",
        result: {
          search_feedback: {
            precision: "partial",
            satisfaction: "mixed",
            issue: "weak_evidence",
            focus: "expand_sources",
            optimized_query: "新的优化画像",
          },
        },
      },
    ],
  });

  assert.equal(preference.canApply, true);
  assert.equal(preference.title, "已应用最近反馈偏好");
  assert.equal(preference.detail, "已把最近一轮反馈转成下一轮搜索条件，开始前仍可继续编辑。");
  assert.equal(preference.optimizedInput, "新的优化画像");
  assert.deepEqual(
    preference.items.map((item) => [item.label, item.value]),
    [
      ["精准度", "部分精准"],
      ["满意度", "一般"],
      ["主要问题", "证据不足"],
      ["下一轮方向", "扩来源"],
    ],
  );
});

test("does not apply project feedback preference without a saved optimized query", () => {
  const preference = buildLatestProjectFeedbackPreference({
    locale: "en",
    baseInput: "Original profile",
    runs: [
      {
        id: "run-with-feedback",
        updated_at: "2026-06-05T10:00:00.000Z",
        result: {
          search_feedback: {
            precision: "off",
            satisfaction: "unsatisfied",
          },
        },
      },
    ],
  });

  assert.equal(preference.canApply, false);
  assert.equal(preference.optimizedInput, "Original profile");
  assert.deepEqual(preference.items, []);
});

test("builds a persisted search feedback payload with optimization actions", () => {
  const persisted = buildPersistedSearchFeedback({
    feedback: {
      precision: "off",
      satisfaction: "unsatisfied",
      issue: "weak_evidence",
      focus: "expand_sources",
    },
    optimizedInput: "Feedback-optimized SignalHire search.\nExpand GitHub and paper sources.",
    createdAt: "2026-06-05T12:34:56.000Z",
  });

  assert.equal(persisted.version, 1);
  assert.equal(persisted.precision, "off");
  assert.equal(persisted.satisfaction, "unsatisfied");
  assert.equal(persisted.issue, "weak_evidence");
  assert.equal(persisted.focus, "expand_sources");
  assert.equal(persisted.created_at, "2026-06-05T12:34:56.000Z");
  assert.equal(persisted.optimized_query, "Feedback-optimized SignalHire search.\nExpand GitHub and paper sources.");
  assert.deepEqual(persisted.optimization_actions, ["tighten_profile", "strengthen_evidence", "expand_sources", "adjust_candidate_pool"]);
});

test("merges persisted feedback into a talent result without dropping existing result fields", () => {
  const result = {
    search_brief: { original_query: "Find LLM infra engineers" },
    candidates: [{ name: "Ada Lovelace" }],
  };

  const merged = mergeSearchFeedbackIntoResult({
    result,
    feedback: { precision: "partial", satisfaction: "mixed", issue: "wrong_seniority" },
    optimizedInput: "Feedback-optimized SignalHire search.",
    createdAt: "2026-06-05T13:00:00.000Z",
  });

  assert.equal(merged.search_brief.original_query, "Find LLM infra engineers");
  assert.equal(merged.candidates[0].name, "Ada Lovelace");
  assert.equal(merged.search_feedback.precision, "partial");
  assert.equal(merged.search_feedback.satisfaction, "mixed");
  assert.deepEqual(merged.search_feedback.optimization_actions, ["tighten_profile", "expand_sources", "adjust_seniority"]);
});
