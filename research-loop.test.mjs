import test from "node:test";
import assert from "node:assert/strict";
import * as researchLoop from "./web/lib/research-loop.mjs";

import {
  buildFeedbackOptimizationPreview,
  buildLatestProjectFeedbackPreference,
  buildPersistedSearchFeedback,
  buildProjectResearchRounds,
  buildProjectNextSteps,
  buildProjectControlRoom,
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
  assert.deepEqual(
    view.stageTimeline.map((item) => [item.key, item.state]),
    [
      ["planning", "done"],
      ["searching", "done"],
      ["fetching", "active"],
      ["synthesizing", "pending"],
      ["shortlisting", "pending"],
    ],
  );
  assert.equal(view.stageTimeline[2].label, "正在读取来源");
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
  assert.deepEqual(
    view.stageTimeline.map((item) => [item.key, item.state, item.label]),
    [
      ["planning", "active", "Planning the search"],
      ["searching", "pending", "Searching keywords"],
      ["fetching", "pending", "Reading a source"],
      ["synthesizing", "pending", "Synthesizing evidence"],
      ["shortlisting", "pending", "Building the shortlist"],
    ],
  );
});

test("marks synthesis stage active from explicit job status", () => {
  const view = buildResearchLoopView({
    feed: mixedFeed,
    live: { searches: 2, fetches: 4 },
    jobStatus: { phase: "synthesizing" },
  });

  assert.deepEqual(
    view.stageTimeline.map((item) => [item.key, item.state]),
    [
      ["planning", "done"],
      ["searching", "done"],
      ["fetching", "done"],
      ["synthesizing", "active"],
      ["shortlisting", "pending"],
    ],
  );
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

test("adds source labels and verification intent to live research items", () => {
  const view = buildResearchLoopView({
    feed: [
      { id: 1, kind: "search", info: "agent framework site:github.com" },
      { id: 2, kind: "fetch", info: "https://arxiv.org/abs/2401.12345" },
    ],
    live: { searches: 1, fetches: 1 },
  });

  assert.deepEqual(
    view.recentItems.map((item) => [item.sourceType, item.sourceLabel, item.intent]),
    [
      ["papers", "论文", "读取论文来源，确认研究、论文或引用证据。"],
      ["github", "GitHub", "查找代码、项目和开源贡献线索。"],
    ],
  );
});

test("builds an evidence timeline from live research events", () => {
  const view = buildResearchLoopView({
    feed: [
      { id: 1, kind: "search", info: "agent evaluation benchmark site:github.com" },
      { id: 2, kind: "fetch", info: "https://github.com/example/agent-eval" },
      { id: 3, kind: "fetch", info: "https://example.ai/team/ada" },
      { id: 4, kind: "search", info: "Ada Lovelace agent eval benchmark site:arxiv.org" },
    ],
    live: { searches: 2, fetches: 2 },
    jobStatus: { phase: "running" },
    locale: "zh",
  });

  assert.ok(Array.isArray(view.evidenceTimeline));
  assert.deepEqual(
    view.evidenceTimeline.map((item) => [item.stage, item.label, item.sourceLabel, item.state]),
    [
      ["search", "扩展搜索", "论文", "active"],
      ["read", "读取来源", "公司页", "done"],
      ["read", "读取来源", "GitHub", "done"],
      ["search", "扩展搜索", "GitHub", "done"],
    ],
  );
  assert.match(view.evidenceTimeline[0].detail, /site:arxiv/);
  assert.match(view.evidenceTimeline[0].nextStep, /论文/);
  assert.equal(view.evidenceTimelineSummary.label, "证据时间线");
  assert.equal(view.evidenceTimelineSummary.detail, "2 次搜索 · 2 次来源读取 · 覆盖 GitHub、论文、公司页");
});

test("summarizes observable running search work for the foreground console", () => {
  const view = buildResearchLoopView({
    feed: [
      { id: 1, kind: "search", info: "multimodal agent engineer site:github.com" },
      { id: 2, kind: "fetch", info: "https://github.com/example/agent-runtime" },
      { id: 3, kind: "search", info: "multimodal agent engineer site:arxiv.org" },
      { id: 4, kind: "fetch", info: "https://arxiv.org/abs/2601.12345" },
    ],
    live: { searches: 2, fetches: 2 },
    jobStatus: { phase: "running" },
    locale: "zh",
  });

  assert.equal(view.observability.canStop, true);
  assert.equal(view.observability.currentSearch.label, "正在搜索");
  assert.equal(view.observability.currentSearch.detail, "multimodal agent engineer site:arxiv.org");
  assert.equal(view.observability.currentFetch.label, "正在读取");
  assert.equal(view.observability.currentFetch.detail, "https://arxiv.org/abs/2601.12345");
  assert.equal(view.observability.coverage.label, "来源覆盖");
  assert.equal(view.observability.coverage.detail, "GitHub、论文");
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

test("builds a project action brief from candidate queues", () => {
  assert.equal(typeof researchLoop.buildProjectActionBrief, "function");

  const items = [
    {
      id: "weak-evidence",
      status: "new",
      candidate: {
        name: "Grace",
        match_score: 88,
        evidence_audit: { overall_evidence_quality: "low" },
        claims: [{ claim: "Built agent infra", verdict: "unverified", evidence: [] }],
      },
    },
    {
      id: "review",
      status: "new",
      candidate: { name: "Ada", match_score: 91, evidence_audit: { overall_evidence_quality: "high" }, claims: [] },
    },
    {
      id: "contacted",
      status: "contacted",
      candidate: { name: "Lin", match_score: 82, evidence_audit: { overall_evidence_quality: "medium" }, claims: [] },
    },
  ];

  const zh = researchLoop.buildProjectActionBrief({ items, locale: "zh" });
  assert.equal(zh.title, "今日待处理");
  assert.equal(zh.summary, "3 位候选人中，1 位需补证据、1 位待评估、1 位推进中。");
  assert.equal(zh.primaryAction.key, "needs_evidence");
  assert.equal(zh.primaryAction.label, "先补证据");
  assert.match(zh.primaryAction.detail, /Grace/);
  assert.match(zh.primaryAction.backfillInput, /Candidate evidence backfill search for SignalHire/);
  assert.match(zh.primaryAction.backfillInput, /Grace/);
  assert.deepEqual(
    zh.actions.map((action) => [action.key, action.count, action.label, Boolean(action.backfillInput)]),
    [
      ["needs_evidence", 1, "补证据", true],
      ["review", 1, "评估候选人", false],
      ["interested", 1, "推进沟通", false],
    ],
  );
  assert.equal(zh.actions[0].targetItemId, "weak-evidence");

  const en = researchLoop.buildProjectActionBrief({ items, locale: "en" });
  assert.equal(en.title, "Today");
  assert.equal(en.summary, "Across 3 candidates: 1 need evidence, 1 need review, and 1 are in progress.");
  assert.equal(en.primaryAction.label, "Backfill evidence first");
  assert.equal(en.actions[1].label, "Review candidates");
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

test("builds project command priorities from candidate evidence gaps and feedback", () => {
  const consoleView = buildProjectSearchConsole({
    locale: "zh",
    project: {
      name: "AI Agent 工程师",
      brief: "找做过 AI Agent 产品落地的工程师",
    },
    candidateCount: 2,
    items: [
      {
        id: "item-1",
        status: "new",
        candidate: {
          name: "Chen Wei",
          match_score: 86,
          evidence_audit: { overall_evidence_quality: "low" },
          claims: [{ claim: "做过多 Agent 编排平台", verdict: "unverified" }],
        },
      },
      {
        id: "item-2",
        status: "contacted",
        candidate: {
          name: "Alex Kim",
          match_score: 82,
          evidence_audit: { overall_evidence_quality: "high" },
          claims: [{ claim: "开源过 Agent eval 框架", verdict: "verified" }],
        },
      },
    ],
    runs: [
      {
        id: "run-2",
        kind: "search",
        label: "Feedback-optimized SignalHire search.",
        query_text: "Feedback-optimized SignalHire search.\nExpand practice evidence.",
        status: "done",
        updated_at: "2026-06-05T12:00:00.000Z",
        result: {
          search_feedback: {
            precision: "partial",
            satisfaction: "mixed",
            issue: "weak_evidence",
            focus: "stronger_evidence",
            optimized_query: "补充产品实践和代码证据",
          },
        },
      },
    ],
  });

  assert.equal(consoleView.priorities.title, "作战台优先级");
  assert.deepEqual(
    consoleView.priorities.items.map((item) => [item.key, item.label]),
    [
      ["backfill_evidence", "先补证据"],
      ["apply_feedback", "按反馈开启下一轮"],
      ["progress_candidates", "推进沟通"],
    ],
  );
  assert.match(consoleView.priorities.items[0].detail, /1 位候选人存在证据缺口/);
  assert.match(consoleView.priorities.items[1].detail, /最近反馈已经转成下一轮搜索条件/);
});

test("turns candidate status signals into next-round project search refinements", () => {
  const consoleView = buildProjectSearchConsole({
    locale: "zh",
    project: {
      name: "多模态 Agent 工程师",
      brief: "找做过多模态 Agent 产品落地和开源工具的资深工程师",
    },
    candidateCount: 4,
    items: [
      {
        id: "rejected-1",
        status: "rejected",
        candidate: {
          name: "Bad Fit",
          ai_directions: ["通用 Chatbot", "Prompt 运营"],
          evidence_audit: { overall_evidence_quality: "high" },
          claims: [],
        },
      },
      {
        id: "weak-1",
        status: "new",
        candidate: {
          name: "Weak Evidence",
          ai_directions: ["多模态 Agent"],
          evidence_audit: { overall_evidence_quality: "low" },
          claims: [{ claim: "落地过多模态 Agent 产品", verdict: "unverified" }],
        },
      },
      {
        id: "active-1",
        status: "interviewing",
        candidate: {
          name: "Strong Match",
          current_role: "AI Engineer",
          current_company: "Acme AI",
          ai_directions: ["多模态 Agent", "开源工具"],
          evidence_audit: { overall_evidence_quality: "high" },
          claims: [{ claim: "维护多模态 Agent 工具", verdict: "verified" }],
        },
      },
    ],
    runs: [
      {
        id: "run-1",
        kind: "search",
        label: "多模态 Agent 工程师",
        query_text: "找做过多模态 Agent 产品落地和开源工具的资深工程师",
        status: "done",
        updated_at: "2026-06-05T10:00:00.000Z",
      },
    ],
  });

  assert.deepEqual(
    consoleView.refinementSuggestions.items.map((item) => item.key),
    ["avoid_rejected_patterns", "strengthen_evidence", "find_similar_to_active"],
  );
  assert.match(consoleView.refinementSuggestions.items[0].detail, /通用 Chatbot、Prompt 运营/);
  assert.match(consoleView.refinementSuggestions.items[1].detail, /1 位候选人证据不足/);
  assert.match(consoleView.refinementSuggestions.items[2].detail, /Strong Match/);
  assert.match(consoleView.nextSearchInput, /避开已拒绝画像/);
  assert.match(consoleView.nextSearchInput, /优先交叉核验/);
  assert.match(consoleView.nextSearchInput, /参考已推进候选人/);
});

test("turns reviewed candidate feedback into project search signals", () => {
  assert.equal(typeof researchLoop.buildProjectCandidateFeedbackSignals, "function");

  const consoleView = buildProjectSearchConsole({
    locale: "zh",
    project: {
      name: "AI Agent 产品工程师",
      brief: "找做过 AI Agent 产品落地和开源工具的资深工程师",
    },
    candidateCount: 2,
    items: [
      {
        id: "candidate-1",
        status: "rejected",
        candidate: {
          name: "Wrong Direction",
          feedback: {
            precision: "off",
            satisfaction: "unsatisfied",
            issue: "wrong_direction",
            focus: "adjacent_pools",
          },
          evidence_audit: { overall_evidence_quality: "high" },
          claims: [],
        },
      },
      {
        id: "candidate-2",
        status: "new",
        candidate: {
          name: "Weak Evidence",
          feedback: {
            precision: "partial",
            satisfaction: "mixed",
            issue: "weak_evidence",
            focus: "stronger_evidence",
          },
          evidence_audit: { overall_evidence_quality: "low" },
          claims: [{ claim: "Agent 产品落地", verdict: "unverified" }],
        },
      },
    ],
    runs: [
      {
        id: "run-1",
        kind: "search",
        label: "AI Agent 产品工程师",
        query_text: "找做过 AI Agent 产品落地和开源工具的资深工程师",
        status: "done",
        updated_at: "2026-06-05T10:00:00.000Z",
      },
    ],
  });

  assert.equal(consoleView.candidateFeedbackSignals.title, "候选人反馈信号");
  assert.deepEqual(
    consoleView.candidateFeedbackSignals.items.map((item) => item.key),
    ["tighten_profile", "strengthen_evidence", "expand_sources"],
  );
  assert.match(consoleView.candidateFeedbackSignals.items[0].detail, /Wrong Direction/);
  assert.match(consoleView.candidateFeedbackSignals.items[1].detail, /Weak Evidence/);
  assert.match(consoleView.nextSearchInput, /候选人反馈优化建议/);
  assert.match(consoleView.nextSearchInput, /收紧候选画像/);
  assert.match(consoleView.nextSearchInput, /补强证据要求/);
});

test("builds an editable next-search constraint diff from project signals", () => {
  const consoleView = buildProjectSearchConsole({
    locale: "zh",
    project: {
      name: "AI Agent 产品工程师",
      brief: "找做过 AI Agent 产品落地和开源工具的资深工程师",
    },
    candidateCount: 3,
    items: [
      {
        id: "rejected-1",
        status: "rejected",
        candidate: {
          name: "Wrong Direction",
          ai_directions: ["通用 Chatbot"],
          feedback: {
            precision: "off",
            satisfaction: "unsatisfied",
            issue: "wrong_direction",
            focus: "adjacent_pools",
          },
          evidence_audit: { overall_evidence_quality: "high" },
          claims: [],
        },
      },
      {
        id: "weak-1",
        status: "new",
        candidate: {
          name: "Weak Evidence",
          feedback: {
            precision: "partial",
            satisfaction: "mixed",
            issue: "weak_evidence",
            focus: "stronger_evidence",
          },
          evidence_audit: { overall_evidence_quality: "low" },
          claims: [{ claim: "Agent 产品落地", verdict: "unverified" }],
        },
      },
    ],
    runs: [
      {
        id: "run-1",
        kind: "search",
        label: "AI Agent 产品工程师",
        query_text: "找做过 AI Agent 产品落地和开源工具的资深工程师",
        status: "done",
        updated_at: "2026-06-05T10:00:00.000Z",
      },
    ],
  });

  assert.equal(consoleView.constraintDiff.title, "下一轮搜索约束 diff");
  assert.equal(consoleView.constraintDiff.originalInput, "找做过 AI Agent 产品落地和开源工具的资深工程师");
  assert.match(consoleView.constraintDiff.optimizedInput, /候选人反馈优化建议/);
  assert.equal(consoleView.constraintDiff.empty, false);
  assert.match(consoleView.constraintDiff.editableHint, /开始搜索前/);
  assert.deepEqual(
    consoleView.constraintDiff.changes.map((item) => [item.key, item.type, item.typeLabel, item.sourceLabel]),
    [
      ["avoid_rejected_patterns", "reduce", "降低权重", "候选人状态优化"],
      ["strengthen_evidence", "strengthen", "强化约束", "候选人状态优化"],
      ["tighten_profile", "strengthen", "强化约束", "候选人反馈信号"],
      ["strengthen_evidence", "strengthen", "强化约束", "候选人反馈信号"],
      ["expand_sources", "add", "新增条件", "候选人反馈信号"],
    ],
  );
});

test("builds a project control room from brief, feedback, rounds, and candidate queue", () => {
  assert.equal(typeof researchLoop.buildProjectControlRoom, "function");

  const room = buildProjectControlRoom({
    locale: "zh",
    project: {
      name: "AI Agent 产品工程师",
      brief: "找做过 AI Agent 产品落地和开源工具的资深工程师",
    },
    candidateCount: 2,
    items: [
      {
        id: "candidate-1",
        status: "rejected",
        candidate: {
          name: "Wrong Direction",
          ai_directions: ["通用 Chatbot"],
          feedback: {
            precision: "off",
            satisfaction: "unsatisfied",
            issue: "wrong_direction",
            focus: "adjacent_pools",
          },
          evidence_audit: { overall_evidence_quality: "high" },
          claims: [],
        },
      },
      {
        id: "candidate-2",
        status: "new",
        candidate: {
          name: "Weak Evidence",
          feedback: {
            precision: "partial",
            satisfaction: "mixed",
            issue: "weak_evidence",
            focus: "stronger_evidence",
          },
          evidence_audit: { overall_evidence_quality: "low" },
          claims: [{ claim: "Agent 产品落地", verdict: "unverified" }],
        },
      },
    ],
    runs: [
      {
        id: "run-1",
        kind: "search",
        label: "AI Agent 产品工程师",
        query_text: "找做过 AI Agent 产品落地和开源工具的资深工程师",
        status: "done",
        updated_at: "2026-06-05T10:00:00.000Z",
      },
    ],
  });

  assert.equal(room.title, "项目控制台");
  assert.equal(room.focus.label, "先补证据");
  assert.match(room.focus.detail, /1 位需补证据/);
  assert.deepEqual(
    room.cards.map((card) => [card.key, card.label, card.value]),
    [
      ["brief", "当前画像", "已定义"],
      ["feedback", "反馈学习", "2"],
      ["next_search", "下一轮约束", "5"],
      ["rounds", "搜索历史", "1"],
      ["queue", "候选队列", "1"],
    ],
  );
  assert.match(room.cards[2].detail, /下一轮搜索约束 diff/);
  assert.match(room.cards[4].detail, /需要补证据/);
});

test("builds a project detail hierarchy that avoids duplicate summary panels", () => {
  assert.equal(typeof researchLoop.buildProjectDetailHierarchy, "function");

  const hierarchy = researchLoop.buildProjectDetailHierarchy({
    hasCandidates: true,
    hasControlRoom: true,
    locale: "zh",
  });

  assert.deepEqual(hierarchy.primary, ["header", "control_room"]);
  assert.deepEqual(hierarchy.secondary.slice(0, 3), ["search_console", "kpi_strip", "status_funnel"]);
  assert.deepEqual(hierarchy.hidden, ["action_brief", "candidate_feedback_summary"]);
  assert.equal(hierarchy.notes.action_brief, "控制台已承接今日优先动作，避免重复显示。");
  assert.equal(hierarchy.notes.candidate_feedback_summary, "控制台已承接反馈学习摘要，保留候选人反馈信号在搜索控制台中。");
});

test("builds a project detail hierarchy that avoids duplicate candidate review panels", () => {
  assert.equal(typeof researchLoop.buildProjectDetailHierarchy, "function");

  const hierarchy = researchLoop.buildProjectDetailHierarchy({
    hasCandidates: true,
    hasControlRoom: true,
    hasProjectEvidenceMatrix: true,
    locale: "zh",
  });

  assert.deepEqual(
    hierarchy.secondary.filter((section) => section.startsWith("candidate_")),
    ["candidate_decision_queue", "candidate_evidence_matrix", "candidate_list"],
  );
  assert.ok(hierarchy.hidden.includes("candidate_comparison"));
  assert.equal(hierarchy.notes.candidate_comparison, "项目证据矩阵已承接候选人对比指标，通用对比面板作为无矩阵时的回退。");
});

test("builds a project detail hierarchy that avoids duplicate evidence priority panels", () => {
  assert.equal(typeof researchLoop.buildProjectDetailHierarchy, "function");

  const hierarchy = researchLoop.buildProjectDetailHierarchy({
    hasCandidates: true,
    hasControlRoom: true,
    hasProjectEvidenceMatrix: true,
    locale: "zh",
  });

  assert.ok(hierarchy.hidden.includes("candidate_evidence_priority"));
  assert.equal(hierarchy.notes.candidate_evidence_priority, "项目证据矩阵已包含证据优先级、信源和下一步动作，紧凑优先级面板作为无矩阵时的回退。");
});

test("builds a project detail hierarchy that avoids duplicate status count panels", () => {
  assert.equal(typeof researchLoop.buildProjectDetailHierarchy, "function");

  const hierarchy = researchLoop.buildProjectDetailHierarchy({
    hasCandidates: true,
    hasControlRoom: true,
    hasStatusFunnel: true,
    locale: "zh",
  });

  assert.deepEqual(hierarchy.secondary.slice(0, 3), ["search_console", "status_funnel", "candidate_decision_queue"]);
  assert.ok(hierarchy.hidden.includes("kpi_strip"));
  assert.equal(hierarchy.notes.kpi_strip, "状态漏斗已承接候选人总数、状态计数和筛选动作，KPI 条作为无漏斗时的回退。");
});

test("builds a project detail hierarchy that avoids duplicate research round summaries", () => {
  assert.equal(typeof researchLoop.buildProjectDetailHierarchy, "function");

  const hierarchy = researchLoop.buildProjectDetailHierarchy({
    hasCandidates: true,
    hasControlRoom: true,
    hasResearchRounds: true,
    locale: "zh",
  });

  assert.ok(hierarchy.hidden.includes("latest_round_summary"));
  assert.equal(hierarchy.notes.latest_round_summary, "研究轮次列表已展示最新轮次和历史记录，搜索控制台只保留下一轮搜索约束。");
});

test("builds a project detail hierarchy that avoids duplicate search console priorities", () => {
  assert.equal(typeof researchLoop.buildProjectDetailHierarchy, "function");

  const hierarchy = researchLoop.buildProjectDetailHierarchy({
    hasCandidates: true,
    hasControlRoom: true,
    hasSearchConsolePriorities: true,
    locale: "zh",
  });

  assert.ok(hierarchy.hidden.includes("search_console_priorities"));
  assert.equal(hierarchy.notes.search_console_priorities, "项目控制台已承接优先动作，搜索控制台优先级作为无控制台时的回退。");
});

test("builds a project detail hierarchy that avoids duplicate search feedback summaries", () => {
  assert.equal(typeof researchLoop.buildProjectDetailHierarchy, "function");

  const hierarchy = researchLoop.buildProjectDetailHierarchy({
    hasCandidates: true,
    hasResearchRoundFeedback: true,
    hasSearchConsoleFeedback: true,
    locale: "zh",
  });

  assert.ok(hierarchy.hidden.includes("search_console_feedback"));
  assert.equal(hierarchy.notes.search_console_feedback, "研究轮次列表已展示搜索反馈摘要，搜索控制台反馈卡作为无轮次反馈时的回退。");
});

test("builds a project detail hierarchy that avoids duplicate search refinement suggestions", () => {
  assert.equal(typeof researchLoop.buildProjectDetailHierarchy, "function");

  const hierarchy = researchLoop.buildProjectDetailHierarchy({
    hasConstraintDiffRefinements: true,
    hasSearchRefinementSuggestions: true,
    locale: "zh",
  });

  assert.ok(hierarchy.hidden.includes("search_refinement_suggestions"));
  assert.equal(hierarchy.notes.search_refinement_suggestions, "下一轮搜索约束 diff 已展示候选人状态优化，详情建议块作为无 diff 覆盖时的回退。");
});

test("builds a project detail hierarchy that avoids duplicate project brief summaries", () => {
  assert.equal(typeof researchLoop.buildProjectDetailHierarchy, "function");

  const hierarchy = researchLoop.buildProjectDetailHierarchy({
    hasHeaderBrief: true,
    hasSearchConsoleBrief: true,
    locale: "zh",
  });

  assert.ok(hierarchy.hidden.includes("search_console_brief"));
  assert.equal(hierarchy.notes.search_console_brief, "项目头部已展示并可编辑 brief，搜索控制台只保留下一轮搜索约束。");
});

test("parses project next-search text into editable constraint sections", () => {
  assert.equal(typeof researchLoop.buildSearchConstraintEditor, "function");
  assert.equal(typeof researchLoop.buildSearchInputFromConstraintEditor, "function");

  const input = [
    "找做过 AI Agent 产品落地和开源工具的资深工程师",
    "",
    "候选人状态优化建议：",
    "- 避开已拒绝画像：降低通用 Chatbot 的权重，寻找更贴近项目画像的人选。",
    "- 优先交叉核验：要求候选人具备可公开验证的论文、代码、项目、任职或技术写作证据。",
    "",
    "候选人反馈优化建议：",
    "- 收紧候选画像: 提高必备技能、方向和资历匹配门槛，减少明显不相关候选人。",
    "- 补强证据要求: 优先寻找可交叉核验的项目、论文、代码、公开发言或任职证据。",
  ].join("\n");

  const editor = researchLoop.buildSearchConstraintEditor({ input, locale: "zh" });

  assert.equal(editor.title, "编辑下一轮搜索约束");
  assert.equal(editor.base.label, "基础画像");
  assert.equal(editor.base.value, "找做过 AI Agent 产品落地和开源工具的资深工程师");
  assert.deepEqual(
    editor.sections.map((section) => [section.key, section.label, section.items.length]),
    [
      ["project_refinements", "候选人状态优化建议", 2],
      ["candidate_feedback", "候选人反馈优化建议", 2],
    ],
  );
  assert.equal(editor.sections[0].items[0], "避开已拒绝画像：降低通用 Chatbot 的权重，寻找更贴近项目画像的人选。");
  assert.equal(editor.empty, false);

  const rebuilt = researchLoop.buildSearchInputFromConstraintEditor({
    editor: {
      ...editor,
      base: { ...editor.base, value: "更新后的基础画像" },
      sections: editor.sections.map((section) => section.key === "candidate_feedback"
        ? { ...section, items: [...section.items, "扩大公开来源覆盖"] }
        : section),
    },
  });

  assert.match(rebuilt, /^更新后的基础画像/);
  assert.match(rebuilt, /候选人状态优化建议：\n- 避开已拒绝画像/);
  assert.match(rebuilt, /候选人反馈优化建议：[\s\S]*- 扩大公开来源覆盖/);
});

test("summarizes reviewed candidate feedback at project level", () => {
  assert.equal(typeof researchLoop.buildProjectCandidateFeedbackSummary, "function");

  const summary = researchLoop.buildProjectCandidateFeedbackSummary({
    locale: "zh",
    items: [
      {
        id: "candidate-1",
        candidate: {
          name: "Wrong Direction",
          feedback: {
            precision: "off",
            satisfaction: "unsatisfied",
            issue: "wrong_direction",
            focus: "adjacent_pools",
          },
        },
      },
      {
        id: "candidate-2",
        candidate: {
          name: "Weak Evidence",
          feedback: {
            precision: "partial",
            satisfaction: "mixed",
            issue: "weak_evidence",
            focus: "stronger_evidence",
          },
        },
      },
      {
        id: "candidate-3",
        candidate: {
          name: "Unread Candidate",
          feedback: { precision: "partial" },
        },
      },
    ],
  });

  assert.equal(summary.title, "反馈学习");
  assert.equal(summary.empty, false);
  assert.equal(summary.reviewedCount, 2);
  assert.match(summary.summary, /已学习 2 位候选人的反馈/);
  assert.match(summary.nextSearchHint, /下一轮搜索会优先应用这些约束/);
  assert.deepEqual(
    summary.items.map((item) => item.key),
    ["tighten_profile", "strengthen_evidence", "expand_sources"],
  );
  assert.match(summary.items[0].detail, /Wrong Direction、Weak Evidence/);
  assert.match(summary.items[1].detail, /Weak Evidence/);

  const en = researchLoop.buildProjectCandidateFeedbackSummary({ locale: "en", items: [] });
  assert.equal(en.title, "Feedback learning");
  assert.equal(en.empty, true);
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
