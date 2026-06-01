# Search Plan + Evidence Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 shortlist 结果里加入可解释的搜索计划和结构化证据图，让用户先看到系统如何拆解需求，并在结果里看到来源覆盖、交叉验证和证据风险。

**Architecture:** 第一阶段不新增数据库表，继续把新版 payload 存在 `research_runs.result`。新增字段由 `web/lib/talent-profile.mjs` 统一归一化，`web/lib/miro.ts` 的 prompt 要求模型输出，`web/components/result.tsx` 负责展示，分享页复用同一组展示组件。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Node built-in test runner, existing MiroMind streaming flow.

---

## Scope

本计划只实现 P0.1：

- `search_plan`：把自然语言 brief 拆成必须条件、加分条件、排除条件、来源策略和相邻人才池。
- `evidence_graph`：按候选人汇总来源类型、独立域名、强/弱证据、单源风险和交叉验证摘要。
- UI 展示：搜索结果顶部展示 Search Plan；候选人详情里展示 Evidence Graph 摘要。
- 验证：normalizer 单测、streaming/cache 归一化单测、lint/build。

本计划不实现联系人 enrichment、自动外联序列、ATS 集成、独立 candidate/source 表、定时刷新。

## File Structure

- Modify: `talent-profile.test.mjs`
  为 `search_plan` 和 `evidence_graph` 写失败测试，覆盖脏输入、搜索链接过滤、默认值和 streaming/cache 归一化。
- Modify: `web/lib/talent-profile.mjs`
  新增 `normalizeSearchPlan()`、`normalizeEvidenceGraph()`，并把字段挂到 `normalizeTalentSearchResult()`。
- Modify: `web/lib/talent-profile.d.ts`
  增加 `TalentSearchPlan`、`EvidenceGraphItem`、`TalentEvidenceGraph` 类型。
- Modify: `web/lib/miro.ts`
  更新 `searchPrompt()` 输出 JSON shape，要求模型返回 `search_plan` 和 `evidence_graph`。
- Modify: `web/components/result.tsx`
  新增 `SearchPlanView` 和 `EvidenceGraphView`，复用现有证据质量视觉语言。
- Modify: `web/components/ResearchTool.tsx`
  在结果区渲染 `SearchPlanView`，并在候选人详情渲染 `EvidenceGraphView`。
- Inspect: `web/app/r/[id]/page.tsx`
  确认分享页是否通过 `TalentMapView` / `CandidateProfileView` 复用结果组件；如果没有，补上同样展示。

## Data Shape

第一阶段 payload 目标结构：

```json
{
  "search_plan": {
    "must_have": ["LLM inference production experience"],
    "nice_to_have": ["Triton or TensorRT-LLM"],
    "exclusions": ["pure prompt engineering profiles"],
    "source_strategy": [
      { "source_type": "code", "target": "GitHub, Hugging Face, release notes", "reason": "verify production engineering signals" },
      { "source_type": "paper", "target": "arXiv, OpenReview, conference pages", "reason": "verify research depth when relevant" }
    ],
    "adjacent_pools": [
      { "pool": "distributed systems engineers moving into LLM serving", "reason": "transferable infra background" }
    ]
  },
  "evidence_graph": {
    "summary": "Most strong evidence comes from code and project sources; research sources are sparse.",
    "source_mix": [
      { "source_type": "code", "count": 8 },
      { "source_type": "paper", "count": 3 }
    ],
    "candidates": [
      {
        "candidate_name": "First Last",
        "independent_sources": 4,
        "source_types": ["code", "blog", "company", "profile"],
        "strongest_evidence": ["Merged PRs in vLLM"],
        "weakest_evidence": ["Current location only from one profile"],
        "cross_validation": "Core LLM serving claim is supported by GitHub and company engineering blog.",
        "risk_flags": ["No recent public activity after 2024"]
      }
    ]
  }
}
```

## Task 1: Domain Model And Normalizer

**Files:**
- Modify: `talent-profile.test.mjs`
- Modify: `web/lib/talent-profile.mjs`
- Modify: `web/lib/talent-profile.d.ts`

- [ ] **Step 1: Write failing tests**

Add this test to `talent-profile.test.mjs` after the first test:

```js
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
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
node --test talent-profile.test.mjs
```

Expected: FAIL because `result.search_plan` or `result.evidence_graph` is missing.

- [ ] **Step 3: Implement normalizers**

In `web/lib/talent-profile.mjs`, add helpers near `normalizeBrief()`:

```js
function cleanStringArray(values, limit = 20) {
  return (Array.isArray(values) ? values : []).map(cleanString).filter(Boolean).slice(0, limit);
}

function normalizeSearchPlan(plan = {}) {
  plan = isPlainObject(plan) ? plan : {};
  return {
    must_have: cleanStringArray(plan.must_have),
    nice_to_have: cleanStringArray(plan.nice_to_have),
    exclusions: cleanStringArray(plan.exclusions),
    source_strategy: (Array.isArray(plan.source_strategy) ? plan.source_strategy : [])
      .map((item) => {
        item = isPlainObject(item) ? item : {};
        return {
          source_type: cleanString(item.source_type) || "other",
          target: cleanString(item.target),
          reason: cleanString(item.reason),
        };
      })
      .filter((item) => item.target || item.reason)
      .slice(0, 12),
    adjacent_pools: (Array.isArray(plan.adjacent_pools) ? plan.adjacent_pools : [])
      .map((item) => {
        item = isPlainObject(item) ? item : {};
        return {
          pool: cleanString(item.pool),
          reason: cleanString(item.reason),
        };
      })
      .filter((item) => item.pool || item.reason)
      .slice(0, 8),
  };
}

function normalizeEvidenceGraph(graph = {}) {
  graph = isPlainObject(graph) ? graph : {};
  return {
    summary: cleanString(graph.summary),
    source_mix: (Array.isArray(graph.source_mix) ? graph.source_mix : [])
      .map((item) => {
        item = isPlainObject(item) ? item : {};
        return {
          source_type: cleanString(item.source_type) || "other",
          count: Math.max(0, Math.round(Number(item.count) || 0)),
        };
      })
      .filter((item) => item.source_type)
      .slice(0, 12),
    candidates: (Array.isArray(graph.candidates) ? graph.candidates : [])
      .map((item) => {
        item = isPlainObject(item) ? item : {};
        return {
          candidate_name: cleanString(item.candidate_name),
          independent_sources: Math.max(0, Math.round(Number(item.independent_sources) || 0)),
          source_types: cleanStringArray(item.source_types, 12),
          strongest_evidence: cleanStringArray(item.strongest_evidence, 8),
          weakest_evidence: cleanStringArray(item.weakest_evidence, 8),
          cross_validation: cleanString(item.cross_validation),
          risk_flags: cleanStringArray(item.risk_flags, 8),
        };
      })
      .filter((item) => item.candidate_name || item.source_types.length || item.cross_validation)
      .slice(0, 20),
  };
}
```

Then update `normalizeTalentSearchResult()`:

```js
export function normalizeTalentSearchResult(data) {
  const source = isPlainObject(data) ? data : {};
  return {
    search_brief: normalizeBrief(source.search_brief),
    search_plan: normalizeSearchPlan(source.search_plan),
    talent_map: normalizeTalentMap(source.talent_map),
    evidence_graph: normalizeEvidenceGraph(source.evidence_graph),
    candidates: (Array.isArray(source.candidates) ? source.candidates : []).map(normalizeCandidate),
  };
}
```

- [ ] **Step 4: Update type declarations**

In `web/lib/talent-profile.d.ts`, add:

```ts
export type SearchPlanSourceStrategy = { source_type: string; target: string; reason: string };
export type SearchPlanAdjacentPool = { pool: string; reason: string };
export type TalentSearchPlan = { must_have: string[]; nice_to_have: string[]; exclusions: string[]; source_strategy: SearchPlanSourceStrategy[]; adjacent_pools: SearchPlanAdjacentPool[] };
export type EvidenceGraphSourceMix = { source_type: string; count: number };
export type EvidenceGraphCandidate = { candidate_name: string; independent_sources: number; source_types: string[]; strongest_evidence: string[]; weakest_evidence: string[]; cross_validation: string; risk_flags: string[] };
export type TalentEvidenceGraph = { summary: string; source_mix: EvidenceGraphSourceMix[]; candidates: EvidenceGraphCandidate[] };
```

Then change `TalentSearchResult` to:

```ts
export type TalentSearchResult = { search_brief: TalentSearchBrief; search_plan: TalentSearchPlan; talent_map: TalentMapItem[]; evidence_graph: TalentEvidenceGraph; candidates: TalentCandidate[] };
```

- [ ] **Step 5: Run tests**

Run:

```bash
node --test talent-profile.test.mjs
```

Expected: PASS.

## Task 2: Prompt Contract

**Files:**
- Modify: `web/lib/miro.ts`
- Modify: `talent-profile.test.mjs`

- [ ] **Step 1: Add prompt contract test**

Add this test near the prompt-related tests:

```js
test("search prompt requests search plan and evidence graph", async () => {
  const { searchPrompt } = await import("./web/lib/miro.ts");
  const prompt = searchPrompt("Find AI infra engineers");

  assert.match(prompt, /"search_plan"/);
  assert.match(prompt, /"evidence_graph"/);
  assert.match(prompt, /source_strategy/);
  assert.match(prompt, /independent_sources/);
  assert.match(prompt, /cross_validation/);
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
node --test talent-profile.test.mjs
```

Expected: FAIL because the prompt does not yet include the new output fields.

- [ ] **Step 3: Update `searchPrompt()`**

In `web/lib/miro.ts`, expand the output JSON shape immediately after `search_brief`:

```ts
  "search_plan": {
    "must_have": ["explicit non-negotiable criteria extracted from the brief"],
    "nice_to_have": ["preferred but not required criteria"],
    "exclusions": ["profiles or signals to avoid"],
    "source_strategy": [
      {
        "source_type": "paper | code | profile | company | talk | blog | project | community | other",
        "target": "specific platforms or source families to search",
        "reason": "why this source family matters for this brief"
      }
    ],
    "adjacent_pools": [
      {
        "pool": "adjacent candidate pool worth exploring",
        "reason": "why this pool may transfer into the role"
      }
    ]
  },
```

Add this block before `"candidates"`:

```ts
  "evidence_graph": {
    "summary": "short summary of evidence coverage, source diversity, and main verification risks",
    "source_mix": [
      { "source_type": "paper | code | profile | company | talk | blog | project | community | other", "count": 0 }
    ],
    "candidates": [
      {
        "candidate_name": "First Last",
        "independent_sources": 0,
        "source_types": ["code", "company"],
        "strongest_evidence": ["specific strongest evidence signal"],
        "weakest_evidence": ["specific weak or single-source evidence signal"],
        "cross_validation": "how independent sources agree or disagree on the core fit claims",
        "risk_flags": ["identity, recency, single-source, or contradiction risks"]
      }
    ]
  },
```

- [ ] **Step 4: Run tests**

Run:

```bash
node --test talent-profile.test.mjs
```

Expected: PASS.

## Task 3: Result UI

**Files:**
- Modify: `web/components/result.tsx`
- Modify: `web/components/ResearchTool.tsx`

- [ ] **Step 1: Add display components**

In `web/components/result.tsx`, add `SearchPlanView` after `QualityPill()`:

```tsx
export function SearchPlanView({ result }: { result: TalentSearchResult }) {
  const plan = result.search_plan;
  const hasPlan = plan.must_have.length || plan.nice_to_have.length || plan.exclusions.length || plan.source_strategy.length || plan.adjacent_pools.length;
  if (!hasPlan) return null;
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">搜索计划</h2>
        <p className="mt-1 text-sm text-gray-500">系统如何拆解岗位画像、选择来源并扩展相邻人才池。</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <PlanList title="必须条件" items={plan.must_have} tone="emerald" />
        <PlanList title="加分条件" items={plan.nice_to_have} tone="blue" />
        <PlanList title="排除条件" items={plan.exclusions} tone="red" />
      </div>
      {plan.source_strategy.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {plan.source_strategy.map((source, i) => (
            <article key={`${source.source_type}-${i}`} className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{source.source_type}</p>
              <h3 className="mt-1 text-sm font-semibold text-gray-900">{source.target}</h3>
              {source.reason && <p className="mt-2 text-sm leading-relaxed text-gray-600">{source.reason}</p>}
            </article>
          ))}
        </div>
      )}
      {plan.adjacent_pools.length > 0 && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <p className="text-sm font-semibold text-blue-900">相邻人才池</p>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-blue-900/80">
            {plan.adjacent_pools.map((pool, i) => (
              <li key={`${pool.pool}-${i}`}>
                <span className="font-medium">{pool.pool}</span>
                {pool.reason && <span className="text-blue-800/70"> — {pool.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
```

Add helper before `SearchPlanView`:

```tsx
function PlanList({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "blue" | "red" }) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    red: "bg-red-50 text-red-700 ring-red-100",
  }[tone];
  return (
    <div className={`rounded-xl p-4 ring-1 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm opacity-70">未识别</p>
      )}
    </div>
  );
}
```

Add `EvidenceGraphView` after `EvidenceAuditView()`:

```tsx
export function EvidenceGraphView({ result, candidate }: { result: TalentSearchResult; candidate: TalentCandidate }) {
  const node = result.evidence_graph.candidates.find((item) => item.candidate_name === candidate.name);
  if (!node && !result.evidence_graph.summary && result.evidence_graph.source_mix.length === 0) return null;
  return (
    <section className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900">证据图</h4>
        {node && (
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
            {node.independent_sources} 个独立信源
          </span>
        )}
      </div>
      {node?.source_types.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {node.source_types.map((type) => (
            <span key={type} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
              {type}
            </span>
          ))}
        </div>
      ) : null}
      {node?.cross_validation && <p className="mt-3 text-sm leading-relaxed text-gray-700">{node.cross_validation}</p>}
      {node?.strongest_evidence.length ? <EvidenceList title="最强证据" items={node.strongest_evidence} tone="emerald" /> : null}
      {node?.weakest_evidence.length ? <EvidenceList title="弱证据" items={node.weakest_evidence} tone="amber" /> : null}
      {node?.risk_flags.length ? <EvidenceList title="风险" items={node.risk_flags} tone="red" /> : null}
    </section>
  );
}
```

Add helper:

```tsx
function EvidenceList({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "amber" | "red" }) {
  const toneClass = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
  }[tone];
  return (
    <div className="mt-3">
      <p className={`text-xs font-semibold ${toneClass}`}>{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-600">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Wire UI into `ResearchTool`**

Update the import in `web/components/ResearchTool.tsx`:

```tsx
import {
  CandidateCard,
  CandidateProfileView,
  EvidenceGraphView,
  SearchPlanView,
  ShortlistCard,
  TalentMapView,
  TrustReportView,
  type Candidate,
  type VerifyReport,
} from "@/components/result";
```

Render Search Plan before Talent Map:

```tsx
<>
  <SearchPlanView result={result} />
  <TalentMapView result={result} />
```

Render Evidence Graph above Candidate Profile:

```tsx
<EvidenceGraphView result={result} candidate={result.candidates[selectedCandidateIndex]} />
<CandidateProfileView candidate={result.candidates[selectedCandidateIndex]} />
```

- [ ] **Step 3: Run lint**

Run:

```bash
cd web && npm run lint
```

Expected: PASS.

## Task 4: Share Report Coverage

**Files:**
- Inspect: `web/app/r/[id]/page.tsx`
- Modify only if it does not reuse the new components.

- [ ] **Step 1: Inspect share page**

Run:

```bash
sed -n '1,260p' web/app/r/[id]/page.tsx
```

Expected: identify whether `TalentMapView` and `CandidateProfileView` are already used.

- [ ] **Step 2: If needed, add shared views**

If the share page renders `TalentSearchResult`, import and render:

```tsx
import { CandidateProfileView, EvidenceGraphView, SearchPlanView, TalentMapView } from "@/components/result";
```

Then add:

```tsx
<SearchPlanView result={data} />
<TalentMapView result={data} />
```

For selected or listed candidates, add:

```tsx
<EvidenceGraphView result={data} candidate={candidate} />
<CandidateProfileView candidate={candidate} />
```

If the share page already delegates to these components through an existing result renderer, make no code change.

- [ ] **Step 3: Run build**

Run:

```bash
cd web && npm run build
```

Expected: PASS. If sandbox blocks local port binding, rerun unrestricted according to the local approval flow.

## Task 5: Verification And Commit

**Files:**
- All modified files from previous tasks.

- [ ] **Step 1: Run focused tests**

Run:

```bash
node --test talent-profile.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run existing related tests**

Run:

```bash
node --test run-storage.test.mjs
node --test job-state.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run static checks**

Run:

```bash
node --check worker/index.mjs
node --check worker/lib.mjs
node --check worker/talent-profile.mjs
cd web && npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
cd web && npm run build
```

Expected: PASS.

- [ ] **Step 5: Review diff**

Run:

```bash
git diff --stat
git diff -- talent-profile.test.mjs web/lib/talent-profile.mjs web/lib/talent-profile.d.ts web/lib/miro.ts web/components/result.tsx web/components/ResearchTool.tsx web/app/r/[id]/page.tsx
```

Expected: diff only contains Search Plan / Evidence Graph related changes.

- [ ] **Step 6: Commit**

Run:

```bash
git add talent-profile.test.mjs web/lib/talent-profile.mjs web/lib/talent-profile.d.ts web/lib/miro.ts web/components/result.tsx web/components/ResearchTool.tsx web/app/r/[id]/page.tsx docs/superpowers/plans/2026-06-01-search-plan-evidence-graph.md
git commit -m "feat: add search plan evidence graph foundation"
```

Expected: commit created on the current branch.

## Self-Review

- Spec coverage: covers Search Brief 解析可见性、公开来源策略、交叉验证、证据风险、候选人详情展示。Does not cover P1 export/enrichment/ATS by design.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: field names are consistent across JSON shape, normalizer, type declarations, UI components, and tests.
