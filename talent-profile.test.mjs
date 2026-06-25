import test from "node:test";
import assert from "node:assert/strict";
import * as talentProfile from "./web/lib/talent-profile.mjs";
import {
  AI_DIRECTIONS,
  buildCoverageBackfillPlan,
  buildEvidenceCoverage,
  buildSourceExecution,
  buildSourceQueryPlan,
  buildCandidateComparisonRows,
  buildAgentExecutionLayer,
  buildAgentSearchStrategy,
  buildSearchResultWorkspace,
  normalizeTalentSearchResult,
  isTalentSearchResult,
  parsePublicTalentSource,
} from "./web/lib/talent-profile.mjs";
import { researchStream } from "./web/lib/miro.ts";
import {
  buildCandidateEvidenceSourceRowsForRun as buildWorkerCandidateEvidenceSourceRowsForRun,
  normalizeTalentSearchResult as normalizeWorkerTalentSearchResult,
} from "./worker/talent-profile.mjs";

test("normalizes talent shortlist shape and clamps scores", () => {
  const result = normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find LLM inference engineers",
      target_directions: ["LLM Systems"],
      required_skills: ["vLLM"],
      preferred_skills: ["Triton"],
      seniority: "senior",
      geography: "global",
      evidence_preferences: ["open source"],
      exclusions: [],
    },
    talent_map: [
      { direction: "LLM Systems", fit: "primary", candidate_count: 1, rationale: "main fit" },
    ],
    candidates: [
      {
        name: "Ada Lovelace",
        headline: "LLM systems engineer",
        location: "London",
        current_role: "Engineer",
        current_company: "Example AI",
        ai_directions: ["LLM Systems"],
        match_score: 140,
        score_breakdown: {
          achievement_signals: 50,
          skill_match: 30,
          work_history: 10,
          evidence_quality: 10,
        },
        strongest_signals: ["Maintains a public inference project"],
        uncertainties: [],
        links: { github: "https://github.com/example", linkedin: null, scholar: null, huggingface: null, website: null, other: null },
        claims: [
          {
            claim: "Maintains an inference project",
            verdict: "verified",
            evidence: [{ note: "Project page", url: "https://example.com/project", source_type: "project" }],
          },
          {
            claim: "Has a private claim with no source",
            verdict: "verified",
            evidence: [],
          },
        ],
        evidence_audit: {
          verified_claims: [],
          unverified_claims: [],
          contradicted_claims: [],
          single_source_claims: [],
          identity_risks: [],
          recency_notes: [],
          overall_evidence_quality: "high",
        },
        outreach_angle: "Mention inference work.",
        summary: "Strong LLM systems fit.",
      },
    ],
  });

  assert.equal(result.candidates[0].match_score, 100);
  assert.equal(result.candidates[0].claims[1].verdict, "unverified");
  assert.equal(result.candidates[0].claims[1].evidence.length, 0);
  assert.ok(isTalentSearchResult(result));
  assert.ok(AI_DIRECTIONS.includes("AI Infrastructure / LLM Systems"));
});

test("normalizes unsupported education claims without sources as unverified", async () => {
  const { normalizeResult } = await import("./web/lib/miro.ts");
  const result = normalizeResult({
    candidate_name: "Kerry Zheng",
    overall_trust: "medium",
    claims: [
      {
        claim: "本科就读于湖北师范大学电子信息工程专业",
        verdict: "contradicted",
        claim_category: "education",
        education_check_status: "inconsistent",
        evidence: [],
      },
    ],
    red_flags: [],
  });

  assert.equal(result.claims[0].verdict, "unverified");
  assert.equal(result.claims[0].education_check_status, "public_insufficient");
});

test("normalizes search plan and evidence graph", () => {
  const result = normalizeTalentSearchResult({
    search_plan: {
      must_have: ["LLM serving", "  "],
      nice_to_have: ["Triton"],
      exclusions: ["pure prompt engineering"],
      source_strategy: [
        { source_type: "code", target: "GitHub", reason: "verify engineering" },
        null,
        { source_type: "", target: "", reason: "" },
      ],
      adjacent_pools: [
        { pool: "Distributed systems engineers", reason: "transferable infra" },
        { pool: "", reason: "" },
      ],
    },
    evidence_graph: {
      summary: "Code evidence is strongest.",
      source_mix: [
        { source_type: "code", count: 3 },
        { source_type: "paper", count: -1 },
      ],
      candidates: [
        {
          candidate_name: "Ada Lovelace",
          independent_sources: 5.6,
          source_types: ["code", "", "blog"],
          strongest_evidence: ["Merged serving PRs"],
          weakest_evidence: ["Location from one profile"],
          cross_validation: "Code and blog agree.",
          risk_flags: ["No recent public updates"],
        },
        null,
      ],
    },
    candidates: [{ name: "Ada Lovelace", match_score: 90 }],
  });

  assert.deepEqual(result.search_plan.must_have, ["LLM serving"]);
  assert.equal(result.search_plan.source_strategy.length, 1);
  assert.equal(result.search_plan.adjacent_pools.length, 1);
  assert.equal(result.evidence_graph.summary, "Code evidence is strongest.");
  assert.equal(result.evidence_graph.source_mix[0].count, 3);
  assert.equal(result.evidence_graph.source_mix[1].count, 0);
  assert.equal(result.evidence_graph.candidates.length, 1);
  assert.equal(result.evidence_graph.candidates[0].independent_sources, 6);
  assert.deepEqual(result.evidence_graph.candidates[0].source_types, ["code", "blog"]);
});

test("builds evidence coverage groups from source mix and candidate evidence", () => {
  const result = normalizeTalentSearchResult({
    evidence_graph: {
      source_mix: [
        { source_type: "paper", count: 2 },
        { source_type: "code", count: 1 },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        claims: [
          {
            claim: "Works on AI infra",
            verdict: "verified",
            evidence: [
              { note: "company", url: "https://example.ai/team/ada", source_type: "company" },
              { note: "talk", url: "https://conf.example/talks/ada", source_type: "talk" },
            ],
          },
        ],
      },
    ],
  });

  const coverage = buildEvidenceCoverage(result);

  assert.equal(coverage.find((item) => item.key === "research")?.count, 2);
  assert.equal(coverage.find((item) => item.key === "practice")?.count, 1);
  assert.equal(coverage.find((item) => item.key === "work_history")?.count, 1);
  assert.equal(coverage.find((item) => item.key === "public_voice")?.count, 1);
  assert.equal(coverage.every((item) => item.status === "covered"), true);
});

test("builds executable source query plan from brief and source strategy", () => {
  const result = normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find LLM inference engineers",
      target_directions: ["AI Infrastructure / LLM Systems"],
      required_skills: ["vLLM", "Triton"],
    },
    search_plan: {
      source_strategy: [
        {
          source_type: "code",
          target: "GitHub repositories",
          reason: "verify engineering work",
          coverage_group: "practice",
          query: "vLLM Triton site:github.com",
        },
        {
          source_type: "paper",
          target: "arXiv and conference pages",
          reason: "verify research output",
        },
      ],
    },
  });

  const plan = buildSourceQueryPlan(result);

  assert.equal(plan.length, 2);
  assert.equal(plan[0].coverage_group, "practice");
  assert.equal(plan[0].query, "vLLM Triton site:github.com");
  assert.equal(plan[0].target, "GitHub repositories");
  assert.match(plan[1].query, /Find LLM inference engineers/);
  assert.match(plan[1].query, /vLLM/);
  assert.match(plan[1].query, /site:arxiv.org/);
});

test("builds agent search strategy with multi-channel query fan-out", () => {
  const strategy = buildAgentSearchStrategy("AI Marketing / AI 增长负责人，Web3 + AI 招聘赛道，内容矩阵，小红书 Twitter", {
    locale: "zh",
    cachedCandidateHints: [{ name: "Ada Growth" }],
  });

  assert.equal(strategy.channels.length >= 4, true);
  assert.equal(strategy.role_category, "growth_marketing");
  assert.equal(strategy.recall_mode, "aggressive_public_web_recall");
  assert.ok(strategy.channels.some((channel) => channel.key === "content-social"));
  assert.equal(strategy.channels.some((channel) => channel.key === "open-source" && channel.coverage_group === "practice"), false);
  assert.ok(strategy.channels.some((channel) => channel.coverage_group === "public_voice"));
  assert.ok(strategy.channels.flatMap((channel) => channel.query_variants).some((query) => /AI Marketing|AI 增长|内容矩阵/.test(query)));
  assert.ok(strategy.score_dimensions.some((item) => /增长|Growth/i.test(item.label)));
  assert.ok(strategy.evidence_priorities.some((item) => /没有具体 URL/.test(item)));
  assert.ok(strategy.evidence_priorities.some((item) => /Ada Growth/.test(item)));
});

test("detects 12 internet role categories and builds role-specific playbooks", () => {
  const cases = [
    ["React Next.js 全栈工程师 Node.js Python", "software_engineering", /GitHub|Stack Overflow|技术社区/i],
    ["机器学习算法工程师 推荐系统 数据科学 Python", "ai_ml_data", /Google Scholar|Kaggle|Hugging Face|论文/i],
    ["B2B SaaS 产品经理 增长产品 用户路径", "product_management", /Product Hunt|产品案例|roadmap/i],
    ["UX Designer 产品设计师 Figma 作品集", "design_creative", /Behance|Dribbble|portfolio|作品集/i],
    ["AI Marketing 增长负责人 内容矩阵 小红书 Twitter", "growth_marketing", /内容平台|小红书|Twitter|case study/i],
    ["社区运营 用户运营 活动运营 Discord", "operations_community", /Discord|社区|活动|社群/i],
    ["BD 商务拓展 SaaS 销售 GTM enterprise", "sales_bd_gtm", /客户案例|CRM|Sales Navigator|company/i],
    ["客户成功 解决方案 售前 支持 renewal", "customer_success_support", /case study|客户成功|support|solution/i],
    ["DevOps SRE 云原生 Kubernetes 安全", "security_infra_devops", /CNCF|GitHub|安全|incident/i],
    ["CEO Office 战略 经营分析 商业分析", "business_strategy_ops", /咨询|strategy|analysis|经营/i],
    ["招聘负责人 HRBP 财务 法务 行政", "people_finance_admin", /LinkedIn|HR|招聘|finance/i],
    ["COO VP Growth 创始型业务负责人", "executive_founder_leadership", /founder|CEO|高管|媒体/i],
  ];

  for (const [query, expectedCategory, channelPattern] of cases) {
    assert.equal(talentProfile.detectInternetRoleCategory(query), expectedCategory);
    const playbook = talentProfile.buildInternetRoleSearchPlaybook(query, { locale: "zh" });
    assert.equal(playbook.role_category, expectedCategory);
    assert.ok(playbook.channels.length >= 4);
    assert.ok(playbook.channels.some((channel) => channelPattern.test(`${channel.target} ${channel.label} ${channel.query_variants.join(" ")}`)), query);
    assert.ok(playbook.query_clusters.some((cluster) => cluster.key === "precise_match"));
    assert.ok(playbook.score_dimensions.length >= 4);
  }
});

test("cleans pasted internet JD into role context without polluting candidate requirements", () => {
  const jd = [
    "AI Marketing / AI 增长负责人",
    "复制",
    "复制",
    "",
    "分享",
    "分享",
    "#Web3",
    "#员工内推",
    "#AI",
    "岗位职责",
    "你将负责从 0 到 1 搭建 OkayJob 的「AI 驱动增长体系」：",
    "1. 全网内容与流量增长",
    "负责在以下平台建立内容矩阵：",
    "* Twitter（X）、小红书、知乎、公众号、YouTube、TikTok",
    "岗位要求",
    "必备能力（硬要求）",
    "* 熟悉至少 2 个主流内容平台（如小红书 / Twitter / 公众号）",
    "* 有实际增长案例（比如从 0→1 或 10万+用户）",
    "* 熟练使用 AI 工具",
    "加分项（强烈加分）",
    "做过 AI 产品或增长项目",
    "会搭建自动化营销系统",
    "我们不想要的人",
    "* 只会“写文案”，但没有增长结果",
    "* 只做执行，不思考增长策略",
    "岗位备注",
    "* Web3 + AI 的高增长赛道",
  ].join("\n");

  const draft = talentProfile.buildSearchIntakeDraft(jd, { locale: "zh" });

  assert.equal(draft.role_category, "growth_marketing");
  assert.equal(draft.role_title, "AI Marketing / AI 增长负责人");
  assert.ok(draft.employer_context.some((item) => /OkayJob/.test(item)));
  assert.ok(draft.candidate_requirements.some((item) => /主流内容平台|增长案例|AI 工具/.test(item)));
  assert.ok(draft.nice_to_have.some((item) => /AI 产品|自动化营销系统/.test(item)));
  assert.ok(draft.exclusions.some((item) => /只会.*写文案|不思考增长策略/.test(item)));
  assert.ok(draft.raw_noise.includes("复制"));
  assert.equal(draft.must_have.some((item) => /OkayJob/.test(item)), false);
  assert.equal(draft.must_have.some((item) => /^复制$|^分享$|#Web3/.test(item)), false);

  const input = talentProfile.buildSearchInputFromSearchIntake({ draft, locale: "zh" });
  assert.match(input, /岗位类别：增长\/市场\/品牌\/内容/);
  assert.match(input, /role_category: growth_marketing/);
  assert.match(input, /雇主背景：/);
  assert.match(input, /渠道计划：/);
  assert.doesNotMatch(input, /^复制$/m);
});

test("role detection prioritizes role title over employer market context", () => {
  const growthJd = [
    "AI Growth / Marketing Lead",
    "职责:",
    "负责 OkayJob HR SaaS recruiting automation 平台增长",
    "要求:",
    "熟悉小红书/Twitter 内容矩阵，有增长案例",
  ].join("\n");
  const productJd = [
    "Product Manager",
    "职责:",
    "负责 Recruiting SaaS 产品路线图和用户路径",
    "要求:",
    "B2B SaaS 产品经验，做过自动化工作流",
  ].join("\n");

  const growthDraft = talentProfile.buildSearchIntakeDraft(growthJd, { locale: "zh" });
  const productDraft = talentProfile.buildSearchIntakeDraft(productJd, { locale: "zh" });

  assert.equal(talentProfile.detectInternetRoleCategory(growthJd), "growth_marketing");
  assert.equal(growthDraft.role_category, "growth_marketing");
  assert.ok(growthDraft.employer_context.some((item) => /OkayJob HR SaaS/.test(item)));
  assert.ok(growthDraft.candidate_requirements.some((item) => /小红书|增长案例/.test(item)));
  assert.equal(growthDraft.must_have.some((item) => /^职责:?$|^要求:?$/i.test(item)), false);

  assert.equal(talentProfile.detectInternetRoleCategory(productJd), "product_management");
  assert.equal(productDraft.role_category, "product_management");
  assert.ok(productDraft.candidate_requirements.some((item) => /产品路线图|用户路径|B2B SaaS 产品经验/.test(item)));
  assert.equal(productDraft.employer_context.some((item) => /产品路线图|B2B SaaS 产品经验/.test(item)), false);
  assert.equal(productDraft.must_have.some((item) => /^职责:?$|^要求:?$/i.test(item)), false);

  const queuedGrowthInput = talentProfile.buildSearchInputFromSearchIntake({ draft: growthDraft, locale: "zh" });
  const queuedProductInput = talentProfile.buildSearchInputFromSearchIntake({ draft: productDraft, locale: "zh" });
  assert.equal(buildAgentSearchStrategy(queuedGrowthInput, { locale: "zh" }).role_category, "growth_marketing");
  assert.equal(buildAgentSearchStrategy(queuedProductInput, { locale: "zh" }).role_category, "product_management");
});

test("builds agent execution layer with submissions and delivery clusters", () => {
  const result = {
    search_brief: { original_query: "Find AI growth lead with Web3 and content matrix evidence" },
    search_plan: {
      source_strategy: [
        {
          source_type: "profile",
          target: "LinkedIn",
          coverage_group: "work_history",
          query: "AI growth lead Web3 LinkedIn",
          reason: "verify work history",
        },
        {
          source_type: "blog",
          target: "public content",
          coverage_group: "public_voice",
          query: "AI growth content matrix blog",
          reason: "verify public voice",
        },
      ],
    },
    source_execution: {
      jobs: [
        {
          job_id: "profile-1",
          source_type: "profile",
          coverage_group: "work_history",
          query: "AI growth lead Web3 LinkedIn",
          status: "completed",
          urls_found: 3,
          evidence_found: 2,
          candidate_leads: ["Julio Barragan"],
        },
      ],
    },
    evidence_graph: {
      source_mix: [
        { source_type: "profile", count: 2 },
        { source_type: "blog", count: 1 },
      ],
      candidates: [
        {
          candidate_name: "Julio Barragan",
          independent_sources: 2,
          source_types: ["profile", "blog"],
          strongest_evidence: ["Company profile and campaign blog agree on AI + Web3 marketing work"],
          weakest_evidence: [],
          risk_flags: [],
        },
        {
          candidate_name: "Single Source Lead",
          independent_sources: 1,
          source_types: ["profile"],
          strongest_evidence: ["Profile headline mentions AI growth"],
          weakest_evidence: ["Only one source supports the fit"],
          risk_flags: ["single-source"],
        },
      ],
    },
    candidates: [
      {
        name: "Julio Barragan",
        current_role: "Head of Marketing",
        current_company: "Sahara AI",
        match_score: 86,
        strongest_signals: ["AI + Web3 marketing leader with public campaign evidence"],
        claims: [
          {
            claim: "Works on AI + Web3 marketing",
            verdict: "verified",
            evidence: [
              { note: "Company profile", url: "https://example.com/julio", source_type: "profile" },
              { note: "Campaign blog", url: "https://example.com/blog", source_type: "blog" },
            ],
          },
        ],
        evidence_audit: { overall_evidence_quality: "high" },
      },
      {
        name: "Single Source Lead",
        current_role: "Growth Consultant",
        current_company: "Example",
        match_score: 82,
        strongest_signals: ["LinkedIn headline mentions AI growth"],
        claims: [
          {
            claim: "AI growth consultant",
            verdict: "verified",
            evidence: [{ note: "Profile", url: "https://example.com/profile", source_type: "profile" }],
          },
        ],
        evidence_audit: { overall_evidence_quality: "medium" },
      },
    ],
  };

  const execution = buildAgentExecutionLayer(result, { locale: "zh", stats: { searches: 7, fetches: 4 }, durationMs: 123000 });

  assert.equal(execution.candidate_submission_events.length, 2);
  assert.equal(execution.candidate_submission_events[0].name, "Julio Barragan");
  assert.equal(execution.candidate_submission_events[0].independent_sources, 2);
  assert.equal(execution.execution_trace[0].tool, "profile");
  assert.equal(execution.telemetry.search_count, 7);
  assert.equal(execution.telemetry.fetch_count, 4);
  assert.equal(execution.telemetry.submitted_count, 2);
  assert.ok(execution.delivery_clusters.some((cluster) => cluster.key === "high_confidence" && cluster.candidate_indices.includes(0)));
  assert.ok(execution.delivery_clusters.some((cluster) => cluster.key === "needs_verification" && cluster.candidate_indices.includes(1)));

  const workspace = buildSearchResultWorkspace(result, { locale: "zh", stats: { searches: 7, fetches: 4, durationSeconds: 123 } });
  assert.equal(workspace.completion.submitted_count, 2);
  assert.equal(workspace.completion.execution_trace_count, 1);
  assert.equal(workspace.candidates[0].submission.name, "Julio Barragan");
  assert.ok(workspace.delivery_clusters.some((cluster) => cluster.key === "high_confidence"));
  assert.equal(workspace.agent_execution.telemetry.source_mix.length, 2);
});

test("normalizes cached talent results without dropping persisted agent execution", () => {
  const result = normalizeTalentSearchResult({
    search_brief: { original_query: "Find AI growth lead" },
    candidates: [{ name: "Ada Growth", match_score: 88 }],
    agent_execution: {
      search_strategy: {
        summary: "Persisted strategy",
        channels: [{ key: "people-profile", label: "People profiles", coverage_group: "work_history", source_types: ["profile"], query_variants: ["AI growth LinkedIn"], reason: "verify profile" }],
        target_segments: [],
        evidence_priorities: ["No URL, no verified claim."],
      },
      execution_trace: [{ trace_id: "trace-1", tool: "profile", source_type: "profile", coverage_group: "work_history", query: "AI growth LinkedIn", status: "completed", candidates_found: 1, evidence_found: 1, duration_ms: 12, note: "cached trace" }],
      candidate_submission_events: [{ row_id: "row-1", candidate_index: 0, name: "Ada Growth", role: "Growth Lead", source: "profile", match_score: 88, evidence_quality: "medium", independent_sources: 1, reason: "cached submission", status: "submitted" }],
      delivery_clusters: [{ key: "needs_verification", label: "Needs verification", candidate_indices: [0], rationale: "single source", next_action: "backfill" }],
      telemetry: { duration_ms: 1200, search_count: 2, fetch_count: 1, tool_count: 1, submitted_count: 1, source_mix: [{ source_type: "profile", count: 1 }] },
    },
  });

  assert.equal(result.agent_execution.search_strategy.summary, "Persisted strategy");
  assert.equal(result.agent_execution.execution_trace[0].note, "cached trace");
  assert.equal(result.agent_execution.candidate_submission_events[0].reason, "cached submission");
  const workspace = buildSearchResultWorkspace(result, { locale: "en" });
  assert.equal(workspace.agent_execution.telemetry.duration_ms, 1200);
  assert.equal(workspace.candidates[0].submission.reason, "cached submission");
});

test("builds editable search plan draft and compiles it into search input", () => {
  assert.equal(typeof talentProfile.buildEditableSearchPlanDraft, "function");
  assert.equal(typeof talentProfile.buildSearchInputFromEditablePlan, "function");

  const draft = talentProfile.buildEditableSearchPlanDraft("Find senior LLM inference engineers with vLLM, Triton, remote US/EU, exclude prompt-only profiles");

  assert.equal(draft.search_brief.original_query, "Find senior LLM inference engineers with vLLM, Triton, remote US/EU, exclude prompt-only profiles");
  assert.ok(draft.search_plan.must_have.some((item) => /LLM inference/i.test(item)));
  assert.ok(draft.search_plan.exclusions.some((item) => /prompt-only/i.test(item)));
  assert.equal(draft.search_plan.source_strategy.length, 4);
  assert.equal(draft.search_plan.source_strategy[0].source_type, "code");
  assert.equal(draft.search_plan.source_strategy[0].coverage_group, "practice");
  assert.match(draft.search_plan.source_strategy[0].query, /site:github.com/);

  draft.search_plan.must_have.push("Production TensorRT-LLM work");
  draft.search_plan.exclusions.push("Pure academic profiles without code");
  draft.search_plan.source_strategy[0].query = "vLLM TensorRT-LLM site:github.com";

  const input = talentProfile.buildSearchInputFromEditablePlan({ draft });
  assert.match(input, /Editable Search Plan/);
  assert.match(input, /Production TensorRT-LLM work/);
  assert.match(input, /Pure academic profiles without code/);
  assert.match(input, /vLLM TensorRT-LLM site:github.com/);
  assert.match(input, /Return the normal SignalHire talent shortlist payload/);
});

test("builds editable search plan by decomposing a pasted JD instead of copying the whole JD", () => {
  const jd = [
    "AI Marketing / AI 增长负责人",
    "岗位职责",
    "你将负责从 0 到 1 搭建 OkayJob 的「AI 驱动增长体系」：",
    "1. 全网内容与流量增长，负责小红书、公众号、视频号、LinkedIn 等内容矩阵。",
    "2. 增长实验与转化，设计落地页、注册、激活和转介绍实验。",
    "任职要求",
    "1. 3 年以上增长、内容营销或 AI 产品增长经验。",
    "2. 熟悉 AI 工具、自动化工作流和数据分析。",
    "加分项",
    "- 做过海外市场增长。",
    "- 有招聘或 HR SaaS 经验。",
    "排除项",
    "- 只做传统投放、没有内容或产品增长经验。",
    "- 不能接受早期 0 到 1 环境。",
  ].join("\n");

  const draft = talentProfile.buildEditableSearchPlanDraft(jd, { locale: "zh" });
  const plan = draft.search_plan;
  const sourceQueries = plan.source_strategy.map((source) => source.query);

  assert.ok(plan.must_have.some((item) => /AI Marketing|AI 增长/.test(item)));
  assert.ok(plan.must_have.some((item) => /3 年以上|增长.*经验/.test(item)));
  assert.ok(plan.nice_to_have.some((item) => /海外市场/.test(item)));
  assert.ok(plan.exclusions.some((item) => /传统投放/.test(item)));

  assert.equal(plan.must_have.includes(jd), false);
  assert.equal(plan.source_strategy.some((source) => source.query.includes("岗位职责")), false);
  assert.equal(sourceQueries.some((query) => query.length > 180), false);
});

test("builds a search result workspace with completion metrics, candidate groups, and evidence handoff", () => {
  assert.equal(typeof buildSearchResultWorkspace, "function");

  const result = normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find AI full-stack engineers with Next.js and LangChain",
    },
    search_plan: {
      source_strategy: [
        { source_type: "code", target: "GitHub", reason: "verify projects", coverage_group: "practice", query: "Next.js LangChain site:github.com" },
        { source_type: "profile", target: "LinkedIn", reason: "verify work history", coverage_group: "work_history", query: "AI full stack LinkedIn" },
      ],
    },
    source_execution: {
      jobs: [
        { source_type: "code", query: "Next.js LangChain site:github.com", status: "completed", urls_found: 12, evidence_found: 4, candidate_leads: ["Ada Chen"] },
        { source_type: "profile", query: "AI full stack LinkedIn", status: "partial", urls_found: 6, evidence_found: 1, candidate_leads: ["Bo Lin"] },
      ],
    },
    evidence_graph: {
      source_mix: [
        { source_type: "code", count: 4 },
        { source_type: "company", count: 1 },
      ],
      candidates: [
        {
          candidate_name: "Ada Chen",
          independent_sources: 3,
          source_types: ["code", "company"],
          strongest_evidence: ["Maintains a LangChain app repository"],
        },
        {
          candidate_name: "Bo Lin",
          independent_sources: 1,
          source_types: ["profile"],
          weakest_evidence: ["Only one public profile supports current role"],
        },
      ],
    },
    candidates: [
      {
        name: "Ada Chen",
        headline: "AI full-stack engineer",
        current_role: "Engineer",
        current_company: "Example AI",
        match_score: 88,
        strongest_signals: ["Maintains a LangChain app repository"],
        ai_directions: ["Applied AI / Agents"],
        evidence_audit: { overall_evidence_quality: "high" },
        links: { github: "https://github.com/ada/langchain-app" },
        claims: [
          {
            claim: "Maintains a LangChain app repository",
            verdict: "verified",
            evidence: [{ note: "repo", url: "https://github.com/ada/langchain-app", source_type: "code" }],
          },
        ],
      },
      {
        name: "Bo Lin",
        headline: "AI engineer",
        match_score: 68,
        uncertainties: ["Only one public profile supports current role"],
        evidence_audit: { overall_evidence_quality: "low" },
        claims: [
          {
            claim: "Works on AI full-stack apps",
            verdict: "unverified",
            evidence: [],
          },
        ],
      },
    ],
  });

  const workspace = buildSearchResultWorkspace(result, {
    locale: "zh",
    stats: { searches: 9, fetches: 57, durationSeconds: 218 },
  });

  assert.equal(workspace.completion.status, "complete");
  assert.equal(workspace.completion.candidate_count, 2);
  assert.equal(workspace.completion.tool_count, 2);
  assert.equal(workspace.completion.searches, 9);
  assert.equal(workspace.completion.fetches, 57);
  assert.equal(workspace.completion.duration_seconds, 218);
  assert.equal(workspace.selected_candidate_index, 0);
  assert.equal(workspace.candidates[0].name, "Ada Chen");
  assert.equal(workspace.candidates[0].handoff_action.label, "分享证据摘要");
  assert.equal(workspace.candidates[0].handoff_action.enabled, true);
  assert.equal(workspace.candidates[0].next_interview_questions.length > 0, true);
  assert.ok(workspace.candidates[0].strongest_evidence.some((item) => /LangChain/.test(item)));
  assert.equal(workspace.candidates[0].bucket, "high_confidence");
  assert.equal(workspace.candidates[1].bucket, "needs_verification");
  assert.ok(workspace.candidates[1].risk_flags.some((item) => /Only one public profile/.test(item)));
  assert.ok(workspace.candidates[1].primary_risk.includes("Only one public profile"));
  assert.deepEqual(workspace.groups.map((group) => group.key), ["high_confidence", "needs_verification"]);
  assert.equal(workspace.research_log.default_open, false);
  assert.equal(workspace.research_log.jobs.length, 2);
  assert.ok(workspace.summary.includes("2 位候选人"));
  assert.equal(workspace.delivery_report.title, "Evidence-qualified shortlist");
  assert.equal(workspace.delivery_report.ready_for_hiring_manager, true);
});

test("builds search intake draft and clarification questions from a pasted JD", () => {
  assert.equal(typeof talentProfile.buildRoleBriefDraft, "function");
  assert.equal(typeof talentProfile.buildSearchIntakeDraft, "function");
  assert.equal(typeof talentProfile.buildSearchIntakeQuestions, "function");
  assert.equal(typeof talentProfile.answerSearchIntakeQuestion, "function");
  assert.equal(typeof talentProfile.buildSearchInputFromSearchIntake, "function");

  const jd = [
    "AI全栈开发工程师",
    "岗位职责",
    "负责 OkayJob 平台全栈迭代与 AI Agent 应用。",
    "任职要求",
    "熟悉 React/Next.js + Node.js/Python 全栈技术栈。",
    "具备 vibe coding 实战作品和 AI 原生思维。",
    "加分项",
    "开源维护、技术内容创作、LangChain/AutoGPT 等 LLM 应用经验。",
    "排除项",
    "纯传统 CRUD 开发，无 AI 原生开发经验。",
  ].join("\n");

  const draft = talentProfile.buildSearchIntakeDraft(jd, { locale: "zh" });
  assert.equal(draft.role_title, "AI全栈开发工程师");
  assert.ok(draft.must_have.some((item) => /React\/Next\.js/.test(item)));
  assert.ok(draft.nice_to_have.some((item) => /开源维护/.test(item)));
  assert.ok(draft.exclusions.some((item) => /传统 CRUD/.test(item)));
  assert.ok(draft.unknowns.includes("location"));
  assert.ok(draft.unknowns.includes("salary"));
  assert.ok(draft.unknowns.includes("target_count"));

  const questions = talentProfile.buildSearchIntakeQuestions(draft, { locale: "zh" });
  assert.deepEqual(questions.slice(0, 3).map((question) => question.key), ["location", "salary", "target_count"]);
  assert.ok(questions[0].options.some((option) => option.value === "remote_anywhere"));
  assert.equal(questions.every((question) => question.skippable), true);

  const withLocation = talentProfile.answerSearchIntakeQuestion(draft, {
    key: "location",
    value: "remote_anywhere",
    label: "不限地点（全国/海外远程均可）",
  });
  const withSalary = talentProfile.answerSearchIntakeQuestion(withLocation, {
    key: "salary",
    value: "20-30K",
    label: "20-30K",
  });
  const withCount = talentProfile.answerSearchIntakeQuestion(withSalary, {
    key: "target_count",
    value: "many",
    label: "越多越好",
  });

  assert.equal(withCount.clarification.location, "不限地点（全国/海外远程均可）");
  assert.equal(withCount.clarification.salary, "20-30K");
  assert.equal(withCount.clarification.target_count, "越多越好");
  assert.equal(withCount.unknowns.includes("location"), false);

  const input = talentProfile.buildSearchInputFromSearchIntake({ draft: withCount, locale: "zh" });
  assert.match(input, /搜索前需求确认/);
  assert.match(input, /地点：不限地点/);
  assert.match(input, /薪资：20-30K/);
  assert.match(input, /目标候选数量：越多越好/);
  assert.doesNotMatch(input, /岗位职责/);
});

test("builds role brief drafts from low-friction intake sources without running search", () => {
  const jobUrlDraft = talentProfile.buildRoleBriefDraft("https://jobs.example.com/roles/ai-growth-lead", {
    locale: "zh",
    sourceType: "job_url",
  });
  assert.equal(jobUrlDraft.intake_source.type, "job_url");
  assert.equal(jobUrlDraft.intake_source.label, "Job URL");
  assert.match(jobUrlDraft.original_query, /Job URL/);
  assert.match(jobUrlDraft.original_query, /https:\/\/jobs\.example\.com\/roles\/ai-growth-lead/);
  assert.equal(jobUrlDraft.confirmation.required_before_search, true);
  assert.ok(jobUrlDraft.confirmation.summary.includes("先确认岗位理解"));
  assert.ok(jobUrlDraft.search_plan_preview.some((item) => /渠道|Channel/i.test(item.label)));

  const similarDraft = talentProfile.buildRoleBriefDraft("https://www.linkedin.com/in/example-person", {
    locale: "en",
    sourceType: "similar_profile",
  });
  assert.equal(similarDraft.intake_source.type, "similar_profile");
  assert.equal(similarDraft.intake_source.label, "Similar profile");
  assert.match(similarDraft.original_query, /Similar profile/);
  assert.equal(similarDraft.confirmation.primary_action, "Confirm role brief and start deep research");
  assert.ok(similarDraft.confirmation.summary.includes("Confirm this role brief before deep research"));
});

test("keeps skipped search intake questions out of the clarification queue", () => {
  const draft = talentProfile.buildSearchIntakeDraft("AI 全栈开发工程师，熟悉 React 和 AI Agent", { locale: "zh" });
  const skipped = ["location", "salary", "target_count"].reduce((current, key) => talentProfile.answerSearchIntakeQuestion(current, {
    key,
    skipped: true,
  }), draft);

  assert.deepEqual(skipped.unknowns, []);
  assert.deepEqual(skipped.skipped_questions, ["location", "salary", "target_count"]);
  assert.deepEqual(talentProfile.buildSearchIntakeQuestions(skipped, { locale: "zh" }), []);
});

test("builds Chinese editable search plan input copy", () => {
  const draft = talentProfile.buildEditableSearchPlanDraft("Find senior LLM inference engineers with vLLM");
  const input = talentProfile.buildSearchInputFromEditablePlan({ draft, locale: "zh" });

  assert.match(input, /SignalHire 可编辑搜索计划/);
  assert.match(input, /原始搜索画像：Find senior LLM inference engineers with vLLM/);
  assert.match(input, /必备条件：/);
  assert.match(input, /来源计划：/);
  assert.match(input, /- 实践\/代码:/);
  assert.doesNotMatch(input, /- practice\/code:/);
  assert.match(input, /返回标准 SignalHire 人才 shortlist payload/);
});

test("builds localized editable search plan draft copy", () => {
  const zh = talentProfile.buildEditableSearchPlanDraft("Find senior LLM inference engineers with vLLM");
  assert.match(zh.search_plan.source_strategy[0].reason, /代码|工程|实践/);
  assert.equal(zh.search_plan.adjacent_pools[0].reason, "从精确关键词之外发现可迁移的公开证据");

  const en = talentProfile.buildEditableSearchPlanDraft("Find senior LLM inference engineers with vLLM", { locale: "en" });
  assert.match(en.search_plan.source_strategy[0].reason, /code|engineering|practice/i);
  assert.equal(en.search_plan.adjacent_pools[0].reason, "surface transferable public evidence beyond exact keyword matches");
});

test("builds a three-question candidate review brief", () => {
  assert.equal(typeof talentProfile.buildCandidateReviewBrief, "function");

  const result = normalizeTalentSearchResult({
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Staff AI Infrastructure Engineer",
        current_company: "Example AI",
        ai_directions: ["AI Infrastructure / LLM Systems"],
        match_score: 91,
        strongest_signals: ["Maintains public vLLM serving code"],
        uncertainties: ["Availability is single-source."],
        claims: [
          {
            claim: "Maintains public vLLM serving code",
            verdict: "verified",
            evidence: [
              { note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" },
              { note: "Paper", url: "https://arxiv.org/abs/1234.5678", source_type: "paper" },
            ],
          },
          {
            claim: "Recently led hiring for an AI infra team",
            verdict: "unverified",
            evidence: [],
          },
        ],
        evidence_audit: { overall_evidence_quality: "high" },
      },
    ],
  });

  const brief = talentProfile.buildCandidateReviewBrief({ result, candidate: result.candidates[0], locale: "zh" });

  assert.deepEqual(brief.sections.map((section) => section.key), [
    "why_recommended",
    "evidence_strength",
    "next_action",
  ]);
  assert.equal(brief.sections.length, 3);
  assert.match(brief.sections[0].body, /Maintains public vLLM serving code/);
  assert.match(brief.sections[1].body, /证据质量/);
  assert.match(brief.sections[2].body, /补齐|复核|推进/);
});

test("builds AI vertical profile cache entries and similar candidate suggestions", () => {
  assert.equal(typeof talentProfile.buildCandidateProfileCacheEntry, "function");
  assert.equal(typeof talentProfile.buildSimilarCandidateSuggestions, "function");

  const result = normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find LLM inference and RAG evaluation engineers",
      required_skills: ["vLLM", "retrieval eval"],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Staff AI Infrastructure Engineer",
        current_company: "Example AI",
        ai_directions: ["AI Infrastructure / LLM Systems", "Data / Evaluation / Safety"],
        match_score: 91,
        strongest_signals: ["Maintains vLLM serving and RAG evaluation repos"],
        claims: [
          {
            claim: "Maintains vLLM serving and RAG evaluation repos",
            verdict: "verified",
            evidence: [
              { note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" },
              { note: "Eval paper", url: "https://openreview.net/forum?id=eval", source_type: "paper" },
            ],
          },
        ],
        evidence_audit: { overall_evidence_quality: "high" },
      },
      {
        name: "Grace Hopper",
        current_role: "RAG Evaluation Lead",
        current_company: "RetrievalCo",
        ai_directions: ["Data / Evaluation / Safety"],
        match_score: 86,
        strongest_signals: ["Built retrieval evaluation harnesses for agentic RAG"],
        claims: [
          {
            claim: "Built retrieval evaluation harnesses for agentic RAG",
            verdict: "verified",
            evidence: [
              { note: "Project", url: "https://huggingface.co/example/rag-eval", source_type: "huggingface" },
            ],
          },
        ],
        evidence_audit: { overall_evidence_quality: "medium" },
      },
      {
        name: "Lin Chen",
        current_role: "AI GTM Lead",
        current_company: "SalesAI",
        ai_directions: ["AI Product / Solutions"],
        match_score: 78,
        strongest_signals: ["Led AI GTM motion for enterprise copilots"],
        claims: [],
      },
    ],
  });

  const cacheEntry = talentProfile.buildCandidateProfileCacheEntry({ result, candidate: result.candidates[0] });
  assert.equal(cacheEntry.cache_key, "ada-lovelace");
  assert.deepEqual(cacheEntry.vertical_tags, ["LLM infra", "RAG", "eval"]);
  assert.equal(cacheEntry.evidence_urls.length, 2);
  assert.deepEqual(cacheEntry.source_types, ["code", "paper"]);
  assert.equal(cacheEntry.confidence, "high");
  assert.match(cacheEntry.search_text, /Ada Lovelace/);
  assert.match(cacheEntry.search_text, /retrieval eval/);

  const similar = talentProfile.buildSimilarCandidateSuggestions({ result, candidate: result.candidates[0] });
  assert.equal(similar[0].name, "Grace Hopper");
  assert.deepEqual(similar[0].shared_vertical_tags, ["RAG", "eval"]);
  assert.equal(similar.some((candidate) => candidate.name === "Lin Chen"), false);
});

test("builds feedback-optimized search input for the next round", () => {
  assert.equal(typeof talentProfile.buildFeedbackOptimizedSearchInput, "function");

  const result = normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find senior LLM inference engineers in North America",
      required_skills: ["vLLM", "Triton"],
      geography: "North America",
    },
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Staff Engineer",
        current_company: "Example AI",
        ai_directions: ["AI Infrastructure / LLM Systems"],
        match_score: 92,
        strongest_signals: ["Merged public vLLM serving PRs"],
        uncertainties: ["Location needs confirmation"],
        evidence_audit: { overall_evidence_quality: "high" },
      },
      {
        name: "Grace Hopper",
        current_role: "Engineer",
        current_company: "InfraCo",
        ai_directions: ["ML Platform / MLOps"],
        match_score: 74,
        strongest_signals: ["Built internal inference tooling"],
        uncertainties: ["No public code found"],
        evidence_audit: { overall_evidence_quality: "medium" },
      },
    ],
  });

  const input = talentProfile.buildFeedbackOptimizedSearchInput({
    result,
    feedback: {
      precision: "partial",
      satisfaction: "mixed",
      issue: "wrong_seniority",
      focus: "stricter_match",
    },
  });

  assert.match(input, /Feedback-optimized SignalHire search/);
  assert.match(input, /Find senior LLM inference engineers in North America/);
  assert.match(input, /部分精准/);
  assert.match(input, /一般/);
  assert.match(input, /资历不对/);
  assert.match(input, /更严格匹配/);
  assert.match(input, /Ada Lovelace/);
  assert.match(input, /Grace Hopper/);
  assert.match(input, /Do not simply rerank the same shortlist/);
  assert.match(input, /Return the normal SignalHire talent shortlist payload/);
});

test("builds Chinese feedback-optimized search input copy", () => {
  const result = normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find senior LLM inference engineers in North America",
      required_skills: ["vLLM"],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Staff Engineer",
        current_company: "Example AI",
        ai_directions: ["AI Infrastructure / LLM Systems"],
        match_score: 92,
        strongest_signals: ["Merged public vLLM serving PRs"],
        uncertainties: [],
      },
    ],
  });

  const input = talentProfile.buildFeedbackOptimizedSearchInput({
    result,
    feedback: {
      precision: "partial",
      satisfaction: "mixed",
      issue: "wrong_seniority",
      focus: "stricter_match",
    },
    locale: "zh",
  });

  assert.match(input, /SignalHire 反馈优化搜索/);
  assert.match(input, /原始搜索画像：Find senior LLM inference engineers in North America/);
  assert.match(input, /用户对上一轮 shortlist 的反馈：/);
  assert.match(input, /上一轮候选名单学习样本：/);
  assert.match(input, /Ada Lovelace：匹配分 92；/);
  assert.match(input, /信号：Merged public vLLM serving PRs；风险：暂无主要不确定性/);
  assert.match(input, /不要只重新排序同一批候选人/);
  assert.match(input, /返回标准 SignalHire 人才 shortlist payload/);
});

test("builds candidate evidence audit summary from claims and evidence graph", () => {
  assert.equal(typeof talentProfile.buildCandidateEvidenceAudit, "function");

  const result = normalizeTalentSearchResult({
    evidence_graph: {
      candidates: [
        {
          candidate_name: "Ada Lovelace",
          independent_sources: 4,
          source_types: ["code", "blog"],
          strongest_evidence: ["Public vLLM integration and technical write-up agree."],
          weakest_evidence: ["Location appears on one profile only."],
          cross_validation: "GitHub, blog, and company sources support the core LLM systems fit.",
          risk_flags: ["Current location is single-source."],
        },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        uncertainties: ["Recent availability is unknown."],
        claims: [
          {
            claim: "Maintains a public vLLM integration",
            verdict: "verified",
            evidence: [
              { note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" },
              { note: "Technical post", url: "https://example.com/vllm", source_type: "blog" },
            ],
          },
          {
            claim: "Is currently based in Berlin",
            verdict: "verified",
            evidence: [
              { note: "Profile", url: "https://profile.example/ada", source_type: "profile" },
            ],
          },
          {
            claim: "Led TensorRT-LLM work at Example AI",
            verdict: "unverified",
            evidence: [],
          },
          {
            claim: "Currently works at OldCo",
            verdict: "contradicted",
            evidence: [
              { note: "Company page lists a different employer", url: "https://company.example/team/ada", source_type: "company" },
            ],
          },
        ],
        evidence_audit: {
          identity_risks: ["Same-name profile exists on GitHub."],
          recency_notes: ["Most concrete activity is from 2025."],
          overall_evidence_quality: "high",
        },
      },
    ],
  });

  const summary = talentProfile.buildCandidateEvidenceAudit({
    result,
    candidate: result.candidates[0],
  });

  assert.equal(summary.candidate_name, "Ada Lovelace");
  assert.equal(summary.overall_evidence_quality, "high");
  assert.equal(summary.verified_count, 2);
  assert.equal(summary.unverified_count, 1);
  assert.equal(summary.contradicted_count, 1);
  assert.equal(summary.independent_sources, 4);
  assert.deepEqual(summary.source_types, ["code", "blog", "profile", "company"]);
  assert.deepEqual(summary.single_source_claims, ["Is currently based in Berlin", "Currently works at OldCo"]);
  assert.deepEqual(summary.identity_risks, ["Same-name profile exists on GitHub."]);
  assert.deepEqual(summary.recency_notes, ["Most concrete activity is from 2025."]);
  assert.equal(summary.cross_validation, "GitHub, blog, and company sources support the core LLM systems fit.");
  assert.deepEqual(summary.risk_flags, ["Current location is single-source.", "Recent availability is unknown."]);
});

test("builds localized candidate evidence dossier for result review", () => {
  assert.equal(typeof talentProfile.buildCandidateEvidenceDossier, "function");

  const result = normalizeTalentSearchResult({
    evidence_graph: {
      candidates: [
        {
          candidate_name: "Ada Lovelace",
          independent_sources: 4,
          source_types: ["code", "paper", "company"],
          strongest_evidence: ["Public serving repository and paper cite the same inference work."],
          weakest_evidence: ["Availability is inferred from one profile."],
          cross_validation: "Code, research, and company sources support the core AI infrastructure fit.",
          risk_flags: ["Availability is single-source."],
        },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Staff AI Infrastructure Engineer",
        current_company: "Example AI",
        match_score: 91,
        strongest_signals: ["Maintains public vLLM serving code"],
        uncertainties: ["Recent availability is unknown."],
        claims: [
          {
            claim: "Maintains public vLLM serving code",
            verdict: "verified",
            evidence: [
              { note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" },
              { note: "Paper", url: "https://arxiv.org/abs/1234.5678", source_type: "paper" },
            ],
          },
          {
            claim: "Currently available",
            verdict: "unverified",
            evidence: [],
          },
        ],
        evidence_audit: {
          overall_evidence_quality: "high",
          single_source_claims: ["Currently available"],
        },
      },
    ],
  });

  const zh = talentProfile.buildCandidateEvidenceDossier({ result, candidate: result.candidates[0], locale: "zh" });
  assert.equal(zh.title, "候选人证据档案");
  assert.match(zh.conclusion, /Ada Lovelace/);
  assert.match(zh.conclusion, /强匹配/);
  assert.equal(zh.metrics[0].label, "匹配分");
  assert.equal(zh.metrics[0].value, "91");
  assert.equal(zh.metrics[2].label, "证据质量");
  assert.equal(zh.metrics[2].value, "强");
  assert.match(zh.conclusion, /强 证据质量/);
  assert.doesNotMatch(zh.conclusion, /high 证据质量/);
  assert.deepEqual(zh.source_types, ["code", "paper", "company"]);
  assert.equal(zh.primary_evidence[0], "Public serving repository and paper cite the same inference work.");
  assert.match(zh.risk_summary, /Availability is single-source/);
  assert.deepEqual(
    zh.evidence_groups.map((group) => [group.key, group.label, group.status, group.source_types, group.claim_count]),
    [
      ["research", "研究", "covered", ["paper"], 1],
      ["practice", "实践", "covered", ["code"], 1],
      ["work_history", "工作经历", "covered", ["company"], 0],
      ["public_voice", "公开表达", "missing", [], 0],
    ],
  );
  assert.deepEqual(zh.evidence_groups[0].primary_claims, ["Maintains public vLLM serving code"]);
  assert.deepEqual(zh.evidence_groups[3].missing_source_types, ["talk", "blog", "podcast", "interview"]);
  assert.ok(zh.verification_gaps.some((gap) => /缺少公开表达证据/.test(gap)));
  assert.equal(zh.backfill_jobs.length, 1);
  assert.deepEqual(zh.backfill_jobs[0].candidate_names, ["Ada Lovelace"]);
  assert.equal(zh.backfill_jobs[0].coverage_group, "public_voice");
  assert.equal(zh.backfill_jobs[0].missing_source_type, "talk");
  assert.deepEqual(zh.backfill_jobs[0].source_types_to_check, ["talk", "blog", "podcast", "interview"]);
  assert.equal(zh.backfill_jobs[0].status, "planned");
  assert.match(zh.backfill_jobs[0].query, /Ada Lovelace/);
  assert.match(zh.backfill_jobs[0].reason, /缺少公开表达证据/);

  const en = talentProfile.buildCandidateEvidenceDossier({ result, candidate: result.candidates[0], locale: "en" });
  assert.equal(en.title, "Candidate evidence dossier");
  assert.match(en.conclusion, /strong match/);
  assert.equal(en.metrics[1].label, "Independent sources");
  assert.equal(en.metrics[1].value, "4");
  assert.equal(en.metrics[2].value, "High");
  assert.match(en.verdict_summary, /1 verified/);
  assert.equal(en.evidence_groups[0].label, "Research");
  assert.ok(en.verification_gaps.some((gap) => /Public voice evidence is missing/.test(gap)));
  assert.match(en.backfill_jobs[0].reason, /Public voice evidence is missing/);
});

test("localizes missing candidate name in Chinese evidence dossier", () => {
  const result = normalizeTalentSearchResult({
    candidates: [
      {
        name: "",
        current_role: "AI Engineer",
        current_company: "Example AI",
        match_score: 73,
        claims: [],
      },
    ],
  });

  const dossier = talentProfile.buildCandidateEvidenceDossier({
    result,
    candidate: result.candidates[0],
    locale: "zh",
  });

  assert.match(dossier.conclusion, /未知候选人/);
  assert.doesNotMatch(dossier.conclusion, /Unknown candidate/);
});

test("builds a candidate claim-source matrix for evidence dossier review", () => {
  assert.equal(typeof talentProfile.buildCandidateEvidenceMatrix, "function");

  const result = normalizeTalentSearchResult({
    candidates: [
      {
        name: "Ada Lovelace",
        claims: [
          {
            claim: "Maintains public vLLM serving code",
            verdict: "verified",
            evidence: [
              { note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" },
              { note: "Technical post", url: "https://example.com/vllm", source_type: "blog" },
            ],
          },
          {
            claim: "Currently available",
            verdict: "unverified",
            evidence: [],
          },
          {
            claim: "Currently works at OldCo",
            verdict: "contradicted",
            evidence: [
              { note: "Company team page", url: "https://example.ai/team/ada", source_type: "company" },
            ],
          },
        ],
      },
    ],
  });

  const matrix = talentProfile.buildCandidateEvidenceMatrix({
    result,
    candidate: result.candidates[0],
    locale: "zh",
  });

  assert.equal(matrix.title, "声称与来源矩阵");
  assert.deepEqual(matrix.summary, {
    verified: 1,
    unverified: 1,
    contradicted: 1,
    no_source: 1,
    single_source: 1,
  });
  assert.deepEqual(
    matrix.rows.map((row) => [row.claim, row.verdict, row.verdict_label, row.evidence_count, row.risk_label]),
    [
      ["Maintains public vLLM serving code", "verified", "已验证", 2, "多来源"],
      ["Currently available", "unverified", "未确认", 0, "无公开来源"],
      ["Currently works at OldCo", "contradicted", "矛盾", 1, "矛盾"],
    ],
  );
  assert.deepEqual(matrix.rows[0].source_types, ["code", "blog"]);
  assert.deepEqual(matrix.rows[0].sources.map((source) => [source.host, source.source_type]), [
    ["github.com", "code"],
    ["example.com", "blog"],
  ]);
  assert.equal(matrix.rows[1].sources.length, 0);

  const en = talentProfile.buildCandidateEvidenceMatrix({
    result,
    candidate: result.candidates[0],
    locale: "en",
  });
  assert.equal(en.title, "Claim-source matrix");
  assert.equal(en.rows[1].risk_label, "No public source");
});

test("builds localized candidate reading summary before raw evidence", () => {
  assert.equal(typeof talentProfile.buildCandidateReadingSummary, "function");

  const result = normalizeTalentSearchResult({
    evidence_graph: {
      candidates: [
        {
          candidate_name: "Ada Lovelace",
          independent_sources: 4,
          source_types: ["code", "paper", "company"],
          strongest_evidence: ["Public serving repository and paper cite the same inference work."],
          weakest_evidence: ["Availability is inferred from one profile."],
          cross_validation: "Code, research, and company sources support the core AI infrastructure fit.",
          risk_flags: ["Availability is single-source."],
        },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Staff AI Infrastructure Engineer",
        current_company: "Example AI",
        match_score: 91,
        ai_directions: ["AI Infrastructure / LLM Systems"],
        strongest_signals: ["Maintains public vLLM serving code"],
        uncertainties: ["Recent availability is unknown."],
        claims: [
          {
            claim: "Maintains public vLLM serving code",
            verdict: "verified",
            evidence: [
              { note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" },
              { note: "Paper", url: "https://arxiv.org/abs/1234.5678", source_type: "paper" },
            ],
          },
          {
            claim: "Currently available",
            verdict: "unverified",
            evidence: [],
          },
        ],
        evidence_audit: {
          overall_evidence_quality: "high",
          single_source_claims: ["Currently available"],
        },
      },
    ],
  });

  const zh = talentProfile.buildCandidateReadingSummary({ result, candidate: result.candidates[0], locale: "zh" });
  assert.equal(zh.title, "候选人阅读摘要");
  assert.equal(zh.sections[0].label, "推荐判断");
  assert.match(zh.sections[0].body, /Ada Lovelace/);
  assert.match(zh.sections[0].body, /强推荐/);
  assert.match(zh.sections[0].body, /Staff AI Infrastructure Engineer/);
  assert.equal(zh.sections[1].label, "匹配理由");
  assert.match(zh.sections[1].body, /主要匹配 AI Infrastructure \/ LLM Systems/);
  assert.match(zh.sections[1].body, /Maintains public vLLM serving code/);
  assert.equal(zh.sections[2].label, "证据可信度");
  assert.match(zh.sections[2].body, /4 个独立信源/);
  assert.match(zh.sections[2].body, /1 条已验证/);
  assert.match(zh.sections[2].body, /整体证据质量为 强/);
  assert.doesNotMatch(zh.sections[2].body, /整体证据质量为 high/);
  assert.equal(zh.sections[3].label, "风险与下一步");
  assert.match(zh.sections[3].body, /Availability is single-source/);
  assert.match(zh.sections[3].body, /人工复核/);

  const en = talentProfile.buildCandidateReadingSummary({ result, candidate: result.candidates[0], locale: "en" });
  assert.equal(en.title, "Candidate reading summary");
  assert.equal(en.sections[0].label, "Recommendation");
  assert.match(en.sections[0].body, /strong recommendation/);
  assert.equal(en.sections[2].label, "Evidence confidence");
  assert.match(en.sections[2].body, /4 independent sources/);
  assert.match(en.sections[2].body, /overall evidence quality is High/);
  assert.match(en.sections[3].body, /Human review/);
});

test("localizes missing candidate name in Chinese reading summary", () => {
  const result = normalizeTalentSearchResult({
    candidates: [
      {
        name: "",
        current_role: "AI Engineer",
        current_company: "Example AI",
        match_score: 78,
        claims: [],
      },
    ],
  });

  const summary = talentProfile.buildCandidateReadingSummary({
    result,
    candidate: result.candidates[0],
    locale: "zh",
  });

  assert.match(summary.sections[0].body, /未知候选人/);
  assert.doesNotMatch(summary.sections[0].body, /Unknown candidate/);
});

test("builds shortlist delivery report for hiring manager handoff", () => {
  assert.equal(typeof talentProfile.buildShortlistDeliveryReport, "function");

  const result = normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find senior LLM inference engineers in North America",
      target_directions: ["AI Infrastructure / LLM Systems"],
      required_skills: ["vLLM", "Triton"],
      geography: "North America",
    },
    evidence_graph: {
      source_mix: [
        { source_type: "code", count: 3 },
        { source_type: "company", count: 1 },
      ],
      candidates: [
        {
          candidate_name: "Ada Lovelace",
          independent_sources: 4,
          source_types: ["code", "blog", "company"],
          risk_flags: ["Location is single-source."],
        },
        {
          candidate_name: "Grace Hopper",
          independent_sources: 1,
          source_types: ["profile"],
          risk_flags: ["Implementation evidence is thin."],
        },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Staff Engineer",
        current_company: "Example AI",
        ai_directions: ["AI Infrastructure / LLM Systems"],
        match_score: 92,
        strongest_signals: ["Merged public vLLM serving PRs"],
        uncertainties: ["Location needs confirmation"],
        evidence_audit: { overall_evidence_quality: "high" },
        claims: [
          {
            claim: "Maintains public vLLM serving work",
            verdict: "verified",
            evidence: [
              { note: "GitHub", url: "https://github.com/example/vllm", source_type: "code" },
              { note: "Blog", url: "https://example.com/vllm", source_type: "blog" },
            ],
          },
        ],
      },
      {
        name: "Grace Hopper",
        current_role: "Engineer",
        current_company: "InfraCo",
        ai_directions: ["ML Platform / MLOps"],
        match_score: 81,
        strongest_signals: ["Built internal inference tooling"],
        uncertainties: ["No public code found"],
        evidence_audit: { overall_evidence_quality: "medium" },
        claims: [
          {
            claim: "Works on inference tooling",
            verdict: "verified",
            evidence: [{ note: "Profile", url: "https://profile.example/grace", source_type: "profile" }],
          },
        ],
      },
      {
        name: "Alan Turing",
        match_score: 62,
        uncertainties: ["Mostly research-only signal"],
        evidence_audit: { overall_evidence_quality: "low" },
      },
    ],
  });

  const report = talentProfile.buildShortlistDeliveryReport(result);

  assert.equal(report.brief_summary, "Find senior LLM inference engineers in North America");
  assert.equal(report.candidate_count, 3);
  assert.equal(report.strong_recommendation_count, 2);
  assert.equal(report.average_match_score, 78);
  assert.equal(report.high_evidence_count, 1);
  assert.equal(report.covered_group_count, 3);
  assert.equal(report.coverage_group_count, 4);
  assert.equal(report.recommended_candidates.length, 2);
  assert.equal(report.recommended_candidates[0].name, "Ada Lovelace");
  assert.equal(report.recommended_candidates[0].role, "Staff Engineer / Example AI");
  assert.equal(report.recommended_candidates[0].recommendation_reason, "Merged public vLLM serving PRs");
  assert.equal(report.recommended_candidates[0].evidence_quality, "high");
  assert.equal(report.recommended_candidates[0].independent_sources, 4);
  assert.equal(report.recommended_candidates[0].primary_risk, "Location is single-source.");
  assert.ok(report.report_risks.some((risk) => /1 个信息源覆盖缺口/.test(risk)));
  assert.ok(report.report_risks.some((risk) => /Alan Turing/.test(risk)));
  assert.deepEqual(report.next_steps.slice(0, 2), ["优先审阅 2 位强推荐候选人的证据详情。", "对 1 个信息源覆盖缺口执行补搜。"]);
});

test("builds English shortlist delivery report copy", () => {
  const result = normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find senior LLM inference engineers in North America",
    },
    evidence_graph: {
      source_mix: [
        { source_type: "code", count: 2 },
        { source_type: "company", count: 1 },
      ],
      candidates: [
        {
          candidate_name: "Ada Lovelace",
          independent_sources: 3,
          source_types: ["code", "company"],
          risk_flags: ["Location is single-source."],
        },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Staff Engineer",
        current_company: "Example AI",
        match_score: 91,
        strongest_signals: ["Merged public vLLM serving PRs"],
        evidence_audit: { overall_evidence_quality: "high" },
        claims: [
          {
            claim: "Maintains public vLLM serving work",
            verdict: "verified",
            evidence: [{ note: "GitHub", url: "https://github.com/example/vllm", source_type: "code" }],
          },
        ],
      },
      {
        name: "Alan Turing",
        match_score: 62,
        evidence_audit: { overall_evidence_quality: "low" },
      },
    ],
  });

  const report = talentProfile.buildShortlistDeliveryReport(result, { locale: "en" });

  assert.equal(report.coverage_summary.find((group) => group.key === "practice")?.label, "Practice");
  assert.ok(report.report_risks.some((risk) => /2 source coverage gaps need backfill\./.test(risk)));
  assert.ok(report.report_risks.some((risk) => /Weak-evidence candidates: Alan Turing\./.test(risk)));
  assert.deepEqual(report.next_steps.slice(0, 2), [
    "Review evidence details for 1 strong recommended candidate.",
    "Run backfill for 2 source coverage gaps.",
  ]);
  assert.equal(report.next_steps.at(-1), "Share candidate details with the hiring manager for human review.");
});

test("normalizes source execution and falls back to planned jobs", () => {
  const result = normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find LLM inference engineers",
      required_skills: ["vLLM"],
    },
    search_plan: {
      source_strategy: [
        { source_type: "code", target: "GitHub", reason: "verify code", coverage_group: "practice", query: "vLLM site:github.com" },
      ],
    },
    source_execution: {
      summary: "Code source search completed; paper search still thin.",
      jobs: [
        {
          job_id: "code-1",
          source_type: "code",
          coverage_group: "practice",
          query: "vLLM site:github.com",
          status: "completed",
          urls_found: 2.4,
          evidence_found: 3,
          candidate_leads: ["Ada Lovelace", ""],
          source_urls: [
            "https://github.com/example/vllm-project",
            "https://www.google.com/search?q=vllm",
          ],
          error: "",
          next_action: "Use GitHub evidence in candidate claims.",
        },
        {
          source_type: "paper",
          query: "vLLM site:arxiv.org",
          status: "unknown",
          urls_found: -1,
          evidence_found: 0,
          source_urls: [],
          error: "No concrete paper source found.",
        },
      ],
    },
  });

  assert.equal(result.source_execution.summary, "Code source search completed; paper search still thin.");
  assert.equal(result.source_execution.jobs.length, 2);
  assert.equal(result.source_execution.jobs[0].status, "completed");
  assert.equal(result.source_execution.jobs[0].urls_found, 2);
  assert.equal(result.source_execution.jobs[0].evidence_found, 3);
  assert.deepEqual(result.source_execution.jobs[0].candidate_leads, ["Ada Lovelace"]);
  assert.deepEqual(result.source_execution.jobs[0].source_urls, ["https://github.com/example/vllm-project"]);
  assert.equal(result.source_execution.jobs[1].status, "planned");
  assert.equal(result.source_execution.jobs[1].coverage_group, "research");

  const fallback = buildSourceExecution(normalizeTalentSearchResult({
    search_brief: { original_query: "Find AI infra talent", required_skills: ["Triton"] },
    search_plan: {
      source_strategy: [
        { source_type: "paper", target: "arXiv", reason: "verify research" },
      ],
    },
  }));

  assert.equal(fallback.summary, "");
  assert.equal(fallback.jobs.length, 1);
  assert.equal(fallback.jobs[0].status, "planned");
  assert.match(fallback.jobs[0].query, /site:arxiv.org/);
});

test("builds coverage backfill plan from returned jobs or missing coverage", () => {
  const returned = normalizeTalentSearchResult({
    coverage_backfill: {
      summary: "Practice evidence is missing for two candidates.",
      jobs: [
        {
          gap_id: "practice-code",
          coverage_group: "practice",
          missing_source_type: "code",
          query: "vLLM site:github.com",
          reason: "No public code evidence yet.",
          priority: 2.4,
          status: "ready",
          candidate_names: ["Ada Lovelace", ""],
          source_types_to_check: ["code", "huggingface", ""],
        },
        {
          gap_id: "",
          coverage_group: "unknown",
          missing_source_type: "",
          query: "",
          reason: "",
        },
      ],
    },
  });

  assert.equal(returned.coverage_backfill.summary, "Practice evidence is missing for two candidates.");
  assert.equal(returned.coverage_backfill.jobs.length, 1);
  assert.equal(returned.coverage_backfill.jobs[0].coverage_group, "practice");
  assert.equal(returned.coverage_backfill.jobs[0].missing_source_type, "code");
  assert.equal(returned.coverage_backfill.jobs[0].priority, 2);
  assert.equal(returned.coverage_backfill.jobs[0].status, "planned");
  assert.deepEqual(returned.coverage_backfill.jobs[0].candidate_names, ["Ada Lovelace"]);
  assert.deepEqual(returned.coverage_backfill.jobs[0].source_types_to_check, ["code", "huggingface"]);

  const derived = buildCoverageBackfillPlan(normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find LLM inference engineers",
      required_skills: ["vLLM"],
    },
    evidence_graph: {
      source_mix: [{ source_type: "paper", count: 2 }],
      candidates: [
        { candidate_name: "Ada Lovelace", source_types: ["paper"], risk_flags: ["No public implementation evidence"] },
      ],
    },
    source_execution: {
      jobs: [
        {
          source_type: "code",
          coverage_group: "practice",
          query: "vLLM site:github.com",
          status: "failed",
          error: "No concrete GitHub source found.",
        },
      ],
    },
    candidates: [{ name: "Ada Lovelace" }],
  }));

  assert.equal(derived.jobs.some((job) => job.coverage_group === "practice"), true);
  const practiceJob = derived.jobs.find((job) => job.coverage_group === "practice");
  assert.equal(practiceJob?.status, "planned");
  assert.match(practiceJob?.query ?? "", /site:github.com/);
  assert.deepEqual(practiceJob?.candidate_names, ["Ada Lovelace"]);
  assert.match(practiceJob?.reason ?? "", /缺少实践/);
  assert.match(derived.summary, /待补/);
});

test("builds English coverage backfill fallback copy", () => {
  const derived = buildCoverageBackfillPlan(normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find LLM inference engineers",
      required_skills: ["vLLM"],
    },
    evidence_graph: {
      source_mix: [{ source_type: "paper", count: 2 }],
      candidates: [
        { candidate_name: "Ada Lovelace", source_types: ["paper"], risk_flags: ["No public implementation evidence"] },
      ],
    },
    candidates: [{ name: "Ada Lovelace" }],
  }), { locale: "en" });

  const practiceJob = derived.jobs.find((job) => job.coverage_group === "practice");
  assert.equal(practiceJob?.reason, "Practice coverage is missing. Backfill code sources for cross-validation.");
  assert.equal(derived.summary, "6 coverage gaps need backfill.");
});

test("builds focused search input for a coverage backfill job", () => {
  assert.equal(typeof talentProfile.buildBackfillSearchInput, "function");

  const input = talentProfile.buildBackfillSearchInput({
    job: {
      gap_id: "practice-code",
      coverage_group: "practice",
      missing_source_type: "code",
      query: "vLLM Triton site:github.com",
      reason: "No public implementation evidence yet.",
      priority: 1,
      status: "planned",
      candidate_names: ["Ada Lovelace", "Grace Hopper"],
      source_types_to_check: ["code", "huggingface"],
    },
    originalQuery: "Find senior LLM inference engineers in North America",
  });

  assert.match(input, /Coverage backfill search/);
  assert.match(input, /Find senior LLM inference engineers in North America/);
  assert.match(input, /practice/);
  assert.match(input, /code/);
  assert.match(input, /vLLM Triton site:github.com/);
  assert.match(input, /Ada Lovelace, Grace Hopper/);
  assert.match(input, /No public implementation evidence yet/);
  assert.match(input, /specific source URLs/);
});

test("builds Chinese focused search input for a coverage backfill job", () => {
  const input = talentProfile.buildBackfillSearchInput({
    job: {
      gap_id: "practice-code",
      coverage_group: "practice",
      missing_source_type: "code",
      query: "vLLM Triton site:github.com",
      reason: "",
      priority: 1,
      status: "planned",
      candidate_names: [],
      source_types_to_check: ["code", "huggingface"],
    },
    originalQuery: "",
    locale: "zh",
  });

  assert.match(input, /SignalHire 覆盖缺口补搜/);
  assert.match(input, /原始搜索画像：未提供/);
  assert.match(input, /覆盖组：实践/);
  assert.doesNotMatch(input, /覆盖组：practice/);
  assert.match(input, /缺失来源类型：代码/);
  assert.doesNotMatch(input, /缺失来源类型：code/);
  assert.match(input, /受影响候选人：未指定具体候选人/);
  assert.match(input, /需要检查的来源类型：代码、Hugging Face/);
  assert.doesNotMatch(input, /需要检查的来源类型：code, huggingface/);
  assert.match(input, /优先补充具体公开证据和明确来源 URL/);
});

test("summarizes backfill evidence that can merge into the original report", () => {
  assert.equal(typeof talentProfile.buildBackfillMergeSummary, "function");

  const originalResult = normalizeTalentSearchResult({
    evidence_graph: {
      source_mix: [{ source_type: "paper", count: 1 }],
      candidates: [
        { candidate_name: "Ada Lovelace", source_types: ["paper"], independent_sources: 1 },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        claims: [
          {
            claim: "Published LLM systems research",
            verdict: "verified",
            evidence: [{ note: "paper", url: "https://arxiv.org/abs/1234.5678", source_type: "paper" }],
          },
        ],
      },
    ],
  });
  const backfillResult = normalizeTalentSearchResult({
    evidence_graph: {
      source_mix: [{ source_type: "code", count: 1 }],
      candidates: [
        { candidate_name: "Ada Lovelace", source_types: ["code"], independent_sources: 1 },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        claims: [
          {
            claim: "Maintains a public vLLM integration",
            verdict: "verified",
            evidence: [{ note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" }],
          },
        ],
      },
    ],
  });

  const summary = talentProfile.buildBackfillMergeSummary({ originalResult, backfillResult });

  assert.equal(summary.improved_candidates.length, 1);
  assert.equal(summary.improved_candidates[0].candidate_name, "Ada Lovelace");
  assert.equal(summary.improved_candidates[0].new_evidence_count, 1);
  assert.deepEqual(summary.improved_candidates[0].new_source_types, ["code"]);
  assert.deepEqual(summary.improved_candidates[0].new_evidence_urls, ["https://github.com/example/vllm"]);
  assert.equal(summary.coverage_gains.find((item) => item.key === "practice")?.before_count, 0);
  assert.equal(summary.coverage_gains.find((item) => item.key === "practice")?.after_count, 1);
  assert.match(summary.summary, /1 位候选人/);
  assert.match(summary.summary, /1 条新增证据/);
});

test("builds English backfill merge summary copy", () => {
  const originalResult = normalizeTalentSearchResult({
    candidates: [
      {
        name: "Ada Lovelace",
        claims: [
          {
            claim: "Maintains public inference code",
            verdict: "unverified",
            evidence: [],
          },
        ],
      },
    ],
  });
  const backfillResult = normalizeTalentSearchResult({
    evidence_graph: {
      source_mix: [{ source_type: "code", count: 1 }],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        claims: [
          {
            claim: "Maintains a public vLLM integration",
            verdict: "verified",
            evidence: [{ note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" }],
          },
        ],
      },
    ],
  });

  const summary = talentProfile.buildBackfillMergeSummary({ originalResult, backfillResult, locale: "en" });

  assert.equal(summary.summary, "1 candidate has 1 new evidence item.");
  assert.equal(summary.improved_candidates[0].merge_note, "Added code source evidence.");
});

test("merges backfill evidence into the original talent report", () => {
  assert.equal(typeof talentProfile.mergeBackfillResult, "function");

  const originalResult = normalizeTalentSearchResult({
    search_brief: { original_query: "Find LLM infra engineers" },
    evidence_graph: {
      source_mix: [{ source_type: "paper", count: 1 }],
      candidates: [
        { candidate_name: "Ada Lovelace", source_types: ["paper"], independent_sources: 1 },
      ],
    },
    coverage_backfill: {
      jobs: [
        {
          gap_id: "practice-code",
          coverage_group: "practice",
          missing_source_type: "code",
          query: "vLLM site:github.com",
          reason: "No code evidence yet.",
        },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        claims: [
          {
            claim: "Published LLM systems research",
            verdict: "verified",
            evidence: [{ note: "paper", url: "https://arxiv.org/abs/1234.5678", source_type: "paper" }],
          },
        ],
      },
    ],
  });
  const backfillResult = normalizeTalentSearchResult({
    evidence_graph: {
      source_mix: [{ source_type: "code", count: 1 }],
      candidates: [
        {
          candidate_name: "Ada Lovelace",
          source_types: ["code"],
          independent_sources: 1,
          strongest_evidence: ["Public vLLM integration"],
        },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        claims: [
          {
            claim: "Maintains a public vLLM integration",
            verdict: "verified",
            evidence: [{ note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" }],
          },
        ],
      },
    ],
  });

  const merged = talentProfile.mergeBackfillResult({ originalResult, backfillResult, mergedAt: "2026-06-03T00:00:00.000Z" });
  const candidate = merged.candidates.find((item) => item.name === "Ada Lovelace");
  assert.equal(candidate?.claims.length, 2);
  assert.equal(candidate?.claims[1].claim, "Maintains a public vLLM integration");
  assert.equal(merged.evidence_graph.source_mix.find((item) => item.source_type === "code")?.count, 1);
  assert.deepEqual(
    merged.evidence_graph.candidates.find((item) => item.candidate_name === "Ada Lovelace")?.source_types,
    ["paper", "code"],
  );
  assert.equal(merged.coverage_backfill.jobs.find((job) => job.gap_id === "practice-code")?.status, "completed");
  assert.equal(merged.backfill_merge.merged_at, "2026-06-03T00:00:00.000Z");
  const dossier = talentProfile.buildCandidateEvidenceDossier({ result: merged, candidate, locale: "zh" });
  assert.equal(dossier.backfill_delta.title, "补搜新增证据");
  assert.equal(dossier.backfill_delta.merged_at, "2026-06-03T00:00:00.000Z");
  assert.equal(dossier.backfill_delta.new_evidence_count, 1);
  assert.deepEqual(dossier.backfill_delta.new_source_types, ["code"]);
  assert.deepEqual(dossier.backfill_delta.new_evidence_urls, ["https://github.com/example/vllm"]);
  assert.match(dossier.backfill_delta.merge_note, /新增 code 来源证据/);

  const mergedAgain = talentProfile.mergeBackfillResult({ originalResult: merged, backfillResult, mergedAt: "2026-06-03T00:01:00.000Z" });
  const urls = mergedAgain.candidates
    .find((item) => item.name === "Ada Lovelace")
    ?.claims.flatMap((claim) => claim.evidence.map((evidence) => evidence.url));
  assert.equal(urls?.filter((url) => url === "https://github.com/example/vllm").length, 1);
});

test("builds candidate comparison rows from shortlist and evidence graph", () => {
  const result = normalizeTalentSearchResult({
    evidence_graph: {
      candidates: [
        {
          candidate_name: "Ada Lovelace",
          independent_sources: 4,
          source_types: ["code", "blog"],
          risk_flags: ["Location is single-source"],
        },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Staff Engineer",
        current_company: "Example AI",
        ai_directions: ["AI Infrastructure / LLM Systems", "ML Platform / MLOps"],
        match_score: 91,
        score_breakdown: {
          achievement_signals: 39,
          skill_match: 24,
          work_history: 18,
          evidence_quality: 13,
        },
        strongest_signals: ["Merged LLM serving PRs"],
        evidence_audit: {
          overall_evidence_quality: "high",
          verified_claims: [],
          unverified_claims: [],
          contradicted_claims: [],
          single_source_claims: [],
          identity_risks: [],
          recency_notes: [],
        },
      },
    ],
  });

  const rows = buildCandidateComparisonRows(result);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Ada Lovelace");
  assert.equal(rows[0].role, "Staff Engineer / Example AI");
  assert.equal(rows[0].primary_direction, "AI Infrastructure / LLM Systems");
  assert.equal(rows[0].secondary_directions, "ML Platform / MLOps");
  assert.equal(rows[0].match_score, 91);
  assert.equal(rows[0].evidence_quality, "high");
  assert.equal(rows[0].independent_sources, 4);
  assert.equal(rows[0].source_types, "code, blog");
  assert.equal(rows[0].coverage_gaps, "研究, 工作经历");
  assert.equal(rows[0].top_signal, "Merged LLM serving PRs");
  assert.equal(rows[0].risk_summary, "Location is single-source");
});

test("builds candidate comparison rows from candidate evidence when evidence graph is absent", () => {
  const result = normalizeTalentSearchResult({
    candidates: [
      {
        name: "Grace Hopper",
        match_score: 84,
        claims: [
          {
            claim: "Built an evaluation system",
            verdict: "verified",
            evidence: [
              { note: "code", url: "https://github.com/example/eval", source_type: "code" },
              { note: "blog", url: "https://example.com/eval", source_type: "blog" },
            ],
          },
        ],
        uncertainties: ["Only one recent project found"],
      },
    ],
  });

  const rows = buildCandidateComparisonRows(result);

  assert.equal(rows[0].independent_sources, 2);
  assert.equal(rows[0].source_types, "code, blog");
  assert.equal(rows[0].risk_summary, "Only one recent project found");
});

test("filters search-result URLs from evidence", () => {
  const result = normalizeTalentSearchResult({
    candidates: [
      {
        name: "Grace Hopper",
        claims: [
          {
            claim: "Published AI infra work",
            verdict: "verified",
            evidence: [
              { note: "search", url: "https://www.google.com/search?q=grace+ai", source_type: "search" },
              { note: "paper", url: "https://arxiv.org/abs/1234.5678", source_type: "paper" },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(result.candidates[0].claims[0].evidence.length, 1);
  assert.equal(result.candidates[0].claims[0].evidence[0].source_type, "paper");
});

test("handles malformed nested objects without throwing", () => {
  const result = normalizeTalentSearchResult({
    search_brief: null,
    talent_map: [null, { direction: "AI Research / Applied Science", candidate_count: -2 }],
    candidates: [null, { name: "", links: null, score_breakdown: null, evidence_audit: null, claims: [null] }],
  });

  assert.equal(result.search_brief.original_query, "");
  assert.equal(result.talent_map.length, 1);
  assert.equal(result.talent_map[0].candidate_count, 0);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].name, "Unknown candidate");
  assert.equal(result.candidates[1].links.github, null);
  assert.equal(result.candidates[1].claims[0].verdict, "unverified");
});

test("detects v1 talent payloads without misclassifying legacy reports", () => {
  assert.equal(isTalentSearchResult({ candidate_name: "Ada", claims: [] }), false);
  assert.equal(isTalentSearchResult({ candidates: [{ name: "Ada", claims: [] }] }), false);
  assert.equal(isTalentSearchResult({ candidates: [null] }), false);
  assert.equal(isTalentSearchResult({ candidates: [{ name: "Ada", match_score: 80 }] }), true);
});

test("normalizes v1 talent payload for web streaming output", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    MIROMIND_BASE_URL: process.env.MIROMIND_BASE_URL,
    MIROMIND_API_KEY: process.env.MIROMIND_API_KEY,
    MIROMIND_MODEL: process.env.MIROMIND_MODEL,
  };
  const payload = {
    search_brief: { original_query: "Find AI infra talent" },
    candidates: [
      {
        name: "Ada Lovelace",
        match_score: 140,
        claims: [
          {
            claim: "Maintains an AI infra project",
            verdict: "verified",
            evidence: [
              { note: "search", url: "https://www.google.com/search?q=ada+ai", source_type: "search" },
              { note: "project", url: "https://example.com/project", source_type: "project" },
            ],
          },
          {
            claim: "Has an unsupported claim",
            verdict: "verified",
            evidence: [],
          },
        ],
      },
    ],
  };
  const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(payload) } }] })}\n\ndata: [DONE]\n\n`;
  let saved;

  process.env.MIROMIND_BASE_URL = "https://miro.example";
  process.env.MIROMIND_API_KEY = "test-key";
  process.env.MIROMIND_MODEL = "test-model";
  globalThis.fetch = async () => new Response(new TextEncoder().encode(sse), { status: 200 });

  try {
    const res = researchStream({
      prompt: "Find AI infra talent",
      onDone: async (data) => {
        saved = data;
        return "run-1";
      },
    });
    const events = (await res.text()).trim().split("\n").map((line) => JSON.parse(line));
    const done = events.find((event) => event.type === "done");

    assert.equal(saved.candidates[0].match_score, 100);
    assert.equal(saved.candidates[0].claims[0].evidence.length, 1);
    assert.equal(saved.candidates[0].claims[0].evidence[0].url, "https://example.com/project");
    assert.equal(saved.candidates[0].claims[1].verdict, "unverified");
    assert.equal(done.data.candidates[0].match_score, 100);
    assert.equal(done.data.candidates[0].claims[0].evidence.length, 1);
    assert.equal(done.data.candidates[0].claims[1].verdict, "unverified");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("normalizes cached v1 talent payload for web streaming output", async () => {
  const res = researchStream({
    cached: {
      search_brief: { original_query: "Find AI infra talent" },
      candidates: [
        {
          name: "Ada Lovelace",
          match_score: 140,
          claims: [
            {
              claim: "Maintains an AI infra project",
              verdict: "verified",
              evidence: [
                { note: "search", url: "https://www.google.com/search?q=ada+ai", source_type: "search" },
                { note: "project", url: "https://example.com/project", source_type: "project" },
              ],
            },
          ],
        },
      ],
    },
    runId: "cached-run",
  });
  const events = (await res.text()).trim().split("\n").map((line) => JSON.parse(line));
  const done = events.find((event) => event.type === "done");

  assert.equal(done.runId, "cached-run");
  assert.equal(done.stats.cached, true);
  assert.equal(done.data.candidates[0].match_score, 100);
  assert.equal(done.data.candidates[0].claims[0].evidence.length, 1);
  assert.equal(done.data.candidates[0].claims[0].evidence[0].url, "https://example.com/project");
});

test("search prompt requests search plan and evidence graph", async () => {
  const { searchPrompt, verifyPrompt } = await import("./web/lib/miro.ts");
  const prompt = searchPrompt("Find AI infra engineers");
  const verify = verifyPrompt("Ada says she built a vLLM project and earned an AI master's degree.");

  assert.doesNotMatch(prompt, /AI DIRECTIONS/);
  assert.match(prompt, /INTERNET ROLE STRATEGY/);
  assert.match(prompt, /role_category/);
  assert.match(prompt, /query_clusters/);
  assert.match(prompt, /score_dimensions/);
  assert.match(prompt, /source mix/);
  assert.match(prompt, /Do not treat the hiring company or product as a candidate target/);
  assert.match(prompt, /"search_plan"/);
  assert.match(prompt, /"source_execution"/);
  assert.match(prompt, /"coverage_backfill"/);
  assert.match(prompt, /"evidence_graph"/);
  assert.match(prompt, /coverage_checklist/);
  assert.match(prompt, /missing_source_type/);
  assert.match(prompt, /source_types_to_check/);
  assert.match(prompt, /urls_found/);
  assert.match(prompt, /evidence_found/);
  assert.match(prompt, /coverage_group/);
  assert.match(prompt, /"query"/);
  assert.match(prompt, /research \| practice \| work_history \| public_voice/);
  assert.match(prompt, /patent \| dataset \| benchmark/);
  assert.match(prompt, /source_strategy/);
  assert.match(prompt, /OPEN-SOURCE EVIDENCE ENRICHMENT PLAN/);
  assert.match(prompt, /GitHub repository search/);
  assert.match(prompt, /Hugging Face model search/);
  assert.match(prompt, /OpenAlex works search/);
  assert.match(prompt, /Semantic Scholar paper search/);
  assert.match(prompt, /OpenReview note search/);
  assert.match(prompt, /independent_sources/);
  assert.match(prompt, /cross_validation/);
  assert.match(prompt, /OUTPUT LANGUAGE/);
  assert.match(prompt, /Platform language: Chinese \(Simplified\)/);
  assert.match(prompt, /user-facing text fields/);
  assert.match(prompt, /Do not paste raw source passages/);
  assert.match(verify, /OUTPUT LANGUAGE/);
  assert.match(verify, /Platform language: Chinese \(Simplified\)/);
  assert.match(verify, /claim/);
  assert.match(verify, /claim_category/);
  assert.match(verify, /education_check_status/);
  assert.match(verify, /recommended_next_action/);
  assert.match(verify, /public_evidence_search/);
  assert.match(verify, /candidate_provided_verification/);
  assert.match(verify, /employer_ordered_verification/);
  assert.match(verify, /manual_hr_attestation/);
  assert.match(verify, /school_official/);
  assert.match(verify, /admission_notice/);
  assert.match(verify, /award_notice/);
  assert.match(verify, /thesis_repository/);
  assert.match(verify, /lab_profile/);
  assert.match(verify, /education_verification/);
  assert.match(verify, /manual_attestation/);
  assert.match(verify, /HR-provided supporting material/);
  assert.match(verify, /education_verification \| work_verification \| award_verification \| project_verification \| publication_verification \| identity_verification \| manual_attestation \| other_supporting_material/);
  assert.match(verify, /Do not mark education claims as "contradicted" solely because no public source is found/);
  assert.match(verify, /red_flags/);
});

test("worker prompt and normalizer support search plan and evidence graph", async () => {
  const { searchPrompt, verifyPrompt } = await import("./worker/lib.mjs");
  const prompt = searchPrompt("AI Marketing / AI 增长负责人，内容矩阵，小红书 Twitter", "Chinese (Simplified)", [
    {
      name: "Ada Growth",
      role: "Head of Growth",
      vertical_tags: ["growth marketing"],
      source_types: ["content_platform"],
      matched_terms: ["content matrix", "AI growth"],
      evidence_urls: ["https://example.com/growth-case"],
    },
  ], [
    {
      candidate_name: "growth-case",
      title: "AI growth case study",
      provider: "anysearch",
      source_type: "case_study",
      url: "https://example.com/growth-case",
    },
  ]);
  const verify = verifyPrompt("Ada says she built a vLLM project and earned an AI master's degree.");
  assert.doesNotMatch(prompt, /AI DIRECTIONS/);
  assert.match(prompt, /INTERNET ROLE STRATEGY/);
  assert.match(prompt, /growth_marketing/);
  assert.match(prompt, /content-social/);
  assert.match(prompt, /candidate_pool_summary/);
  assert.match(prompt, /Do not treat the hiring company or product as a candidate target/);
  const result = normalizeWorkerTalentSearchResult({
    search_plan: {
      must_have: ["LLM serving"],
      source_strategy: [{ source_type: "", target: "GitHub", reason: "verify code", coverage_group: "practice", query: "site:github.com vLLM" }],
    },
    source_execution: {
      summary: "GitHub source completed.",
      jobs: [{
        source_type: "code",
        coverage_group: "practice",
        query: "site:github.com vLLM",
        status: "completed",
        urls_found: 1,
        evidence_found: 1,
        source_urls: ["https://github.com/example/vllm"],
      }],
    },
    coverage_backfill: {
      summary: "Practice coverage complete.",
      jobs: [{
        coverage_group: "practice",
        missing_source_type: "code",
        query: "site:github.com vLLM",
        reason: "Double-check implementation evidence.",
        candidate_names: ["Ada Lovelace"],
        source_types_to_check: ["code"],
      }],
    },
    evidence_graph: {
      candidates: [{
        candidate_name: "Ada Lovelace",
        independent_sources: 2,
        source_types: ["code"],
        cross_validation: "GitHub and blog agree.",
      }],
    },
    candidates: [{ name: "Ada Lovelace", match_score: 90 }],
  });

  assert.match(prompt, /"search_plan"/);
  assert.match(prompt, /"source_execution"/);
  assert.match(prompt, /"coverage_backfill"/);
  assert.match(prompt, /"evidence_graph"/);
  assert.match(prompt, /coverage_checklist/);
  assert.match(prompt, /missing_source_type/);
  assert.match(prompt, /source_types_to_check/);
  assert.match(prompt, /urls_found/);
  assert.match(prompt, /evidence_found/);
  assert.match(prompt, /coverage_group/);
  assert.match(prompt, /"query"/);
  assert.match(prompt, /research \| practice \| work_history \| public_voice/);
  assert.match(prompt, /patent \| dataset \| benchmark/);
  assert.match(prompt, /source_strategy/);
  assert.match(prompt, /independent_sources/);
  assert.match(prompt, /cross_validation/);
  assert.match(prompt, /OUTPUT LANGUAGE/);
  assert.match(prompt, /Platform language: Chinese \(Simplified\)/);
  assert.match(prompt, /user-facing text fields/);
  assert.match(prompt, /Do not paste raw source passages/);
  assert.match(prompt, /CANDIDATE CACHE HINTS/);
  assert.match(prompt, /Ada Growth/);
  assert.match(prompt, /Do not stop at these cached candidates/);
  assert.match(prompt, /OPEN-SOURCE PRECHECK LEADS/);
  assert.match(prompt, /growth-case/);
  assert.match(verify, /OUTPUT LANGUAGE/);
  assert.match(verify, /Platform language: Chinese \(Simplified\)/);
  assert.match(verify, /claim_category/);
  assert.match(verify, /education_check_status/);
  assert.match(verify, /recommended_next_action/);
  assert.match(verify, /public_evidence_search/);
  assert.match(verify, /candidate_provided_verification/);
  assert.match(verify, /employer_ordered_verification/);
  assert.match(verify, /manual_hr_attestation/);
  assert.match(verify, /school_official/);
  assert.match(verify, /admission_notice/);
  assert.match(verify, /award_notice/);
  assert.match(verify, /thesis_repository/);
  assert.match(verify, /lab_profile/);
  assert.match(verify, /education_verification/);
  assert.match(verify, /manual_attestation/);
  assert.match(verify, /HR-provided supporting material/);
  assert.match(verify, /education_verification \| work_verification \| award_verification \| project_verification \| publication_verification \| identity_verification \| manual_attestation \| other_supporting_material/);
  assert.match(verify, /Do not mark education claims as "contradicted" solely because no public source is found/);
  assert.match(verify, /claim/);
  assert.match(verify, /red_flags/);
  assert.deepEqual(result.search_plan.must_have, ["LLM serving"]);
  assert.equal(result.search_plan.source_strategy[0].source_type, "other");
  assert.equal(result.search_plan.source_strategy[0].coverage_group, "practice");
  assert.equal(result.search_plan.source_strategy[0].query, "site:github.com vLLM");
  assert.equal(result.source_execution.jobs[0].status, "completed");
  assert.equal(result.source_execution.jobs[0].source_urls[0], "https://github.com/example/vllm");
  assert.equal(result.coverage_backfill.jobs[0].coverage_group, "practice");
  assert.equal(result.coverage_backfill.jobs[0].missing_source_type, "code");
  assert.equal(result.evidence_graph.candidates[0].candidate_name, "Ada Lovelace");
});

test("open evidence query builder uses role-aware aggressive public web recall", async () => {
  const { buildOpenEvidenceSearchQueries, buildOpenEvidenceSourceRequests } = await import("./worker/open-evidence-sources.mjs");
  const strategy = buildAgentSearchStrategy("AI Marketing / AI 增长负责人，内容矩阵，小红书 Twitter", { locale: "zh" });
  const queries = buildOpenEvidenceSearchQueries("AI Marketing / AI 增长负责人，内容矩阵，小红书 Twitter", {
    maxQueries: 8,
    searchStrategy: strategy,
  });

  assert.ok(queries.some((query) => /LinkedIn|site:linkedin\.com/.test(query)));
  assert.ok(queries.some((query) => /小红书|Twitter|YouTube|TikTok|内容平台/.test(query)));
  assert.ok(queries.some((query) => /case study|增长案例|portfolio|公开案例/i.test(query)));
  assert.equal(queries.some((query) => /\bemail|phone|private contact|邮箱猜测\b/i.test(query)), false);

  const requests = buildOpenEvidenceSourceRequests("AI Marketing / AI 增长负责人，内容矩阵，小红书 Twitter", {
    maxQueries: 2,
    searchStrategy: strategy,
  });
  assert.ok(requests.some((request) => request.provider === "anysearch" && request.source_type === "web"));
  assert.ok(requests.some((request) => request.source_query.includes("LinkedIn")));
});

test("parses public AI talent sources into structured source signals", () => {
  const cases = [
    ["https://github.com/vllm-project/vllm", "github_repo", "practice", "code", "vllm-project", "vllm"],
    ["https://arxiv.org/abs/2401.12345", "arxiv_paper", "research", "paper", "2401.12345", ""],
    ["https://openreview.net/forum?id=abc123", "openreview_paper", "research", "paper", "abc123", ""],
    ["https://huggingface.co/meta-llama/Llama-3.1-8B", "huggingface_model", "practice", "huggingface", "meta-llama", "Llama-3.1-8B"],
    ["https://scholar.google.com/citations?user=abcDEF", "google_scholar_profile", "work_history", "profile", "abcDEF", ""],
    ["https://example.ai/team/ada-lovelace", "company_team_page", "work_history", "company", "example.ai", ""],
  ];

  for (const [url, family, coverageGroup, sourceType, primaryId, secondaryId] of cases) {
    const parsed = parsePublicTalentSource(url);
    assert.equal(parsed.url, url);
    assert.equal(parsed.family, family);
    assert.equal(parsed.coverage_group, coverageGroup);
    assert.equal(parsed.source_type, sourceType);
    assert.equal(parsed.primary_id, primaryId);
    assert.equal(parsed.secondary_id, secondaryId);
  }
});

test("worker builds candidate evidence source rows for persisted search output", () => {
  assert.equal(typeof buildWorkerCandidateEvidenceSourceRowsForRun, "function");

  const rows = buildWorkerCandidateEvidenceSourceRowsForRun({
    userId: "user-1",
    sourceRunId: "run-1",
    observedAt: "2026-06-12T00:00:00.000Z",
    result: {
      search_brief: { original_query: "Find vLLM maintainers" },
      candidates: [
        {
          name: "Ada Lovelace",
          match_score: 91,
          claims: [
            {
              claim: "Maintains vLLM",
              verdict: "verified",
              evidence: [{ note: "repo", url: "https://github.com/example/vllm", source_type: "code" }],
            },
          ],
        },
      ],
    },
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].candidate_profile_cache_key, "user-1:ada-lovelace");
  assert.equal(rows[0].family, "github_repo");
  assert.equal(rows[0].source_type, "code");
});
