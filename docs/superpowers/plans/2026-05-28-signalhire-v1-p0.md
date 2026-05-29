# SignalHire v1 P0 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有“搜人 / 验证 demo”升级为 v1 P0：用户输入 AI 岗位画像，系统返回 10-15 位按 AI 方向分层的高质量候选人 shortlist，并提供 Candidate Profile + Evidence Audit 与 Web share report。

**Architecture:** 第一版不新增复杂 candidate/source 表，继续复用 `research_runs.result` 承载新版 shortlist payload，避免数据库迁移扩大风险。新增一个共享 domain model/normalizer，`web/lib/miro.ts` 和 `worker/lib.mjs` 使用同一结果结构；前端展示层从“3 张候选人卡片”升级为 Search Brief、Talent Map、Shortlist、Candidate Profile/Report 四个视图。

**Tech Stack:** Next.js App Router、React、TypeScript、Node ESM、MiroMind Deep Research、Insforge `research_runs`、Railway worker。

---

## 范围决策

- P0 使用公开来源搜索和交叉验证。
- P0 继续使用 `research_runs` 作为搜索任务、缓存、历史和分享报告存储。
- P0 不做 PDF / CSV / Excel。
- P0 不接付费 enrichment。
- P0 不猜测私人邮箱。
- P0 不保留旧的 “验证候选人” 作为主入口；验证能力迁移到 Candidate Profile 的 Evidence Audit。

## 文件结构

- Create: `web/lib/talent-profile.mjs`
  - 共享 AI 人才方向、结果 normalizer、score clamp、证据清洗规则。
- Create: `web/lib/talent-profile.d.ts`
  - 给 TS/TSX 使用的 v1 结果类型。
- Create: `talent-profile.test.mjs`
  - 纯 Node 测试，覆盖 normalizer 和 evidence audit 降级规则。
- Modify: `web/lib/miro.ts`
  - 搜索 prompt 输出 v1 shortlist payload；`normalizeResult()` 支持新版候选人结构。
- Modify: `worker/lib.mjs`
  - worker 自包含版本同步 prompt 和 normalizer，保持 Railway build context 独立。
- Modify: `worker/index.mjs`
  - `summarize()` 支持新版 shortlist summary。
- Modify: `web/components/result.tsx`
  - 新增 `TalentMapView`、`ShortlistCard`、`CandidateProfileView`、`EvidenceAuditView`，保留旧组件兼容 seeded demo。
- Modify: `web/app/page.tsx`
  - 主入口改为 Search Brief；移除旧 verify tab；增加 shortlist 状态和详情展开。
- Modify: `web/app/r/[id]/page.tsx`
  - 分享页支持新版 shortlist report。
- Modify: `web/scripts/verify-live-research-job.mjs`
  - 校验新版 `search_brief`、`talent_map`、10-15 位候选人、score 和 evidence audit。
- Modify: `README.md`
  - 删除黑客松定位，改为 v1 产品定位和验证命令。

---

### Task 1: 共享 v1 结果模型与 normalizer

**Files:**
- Create: `web/lib/talent-profile.mjs`
- Create: `web/lib/talent-profile.d.ts`
- Create: `talent-profile.test.mjs`

- [ ] **Step 1: 写失败测试**

Create `talent-profile.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_DIRECTIONS,
  normalizeTalentSearchResult,
  isTalentSearchResult,
} from "./web/lib/talent-profile.mjs";

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
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
node --test talent-profile.test.mjs
```

Expected: FAIL，错误包含 `Cannot find module './web/lib/talent-profile.mjs'`。

- [ ] **Step 3: 实现 `web/lib/talent-profile.mjs`**

Create `web/lib/talent-profile.mjs`:

```js
export const AI_DIRECTIONS = [
  "AI Infrastructure / LLM Systems",
  "AI Research / Applied Science",
  "Applied AI / Agents",
  "ML Platform / MLOps",
  "Data / Evaluation / Safety",
  "AI Product / Solutions",
  "Founder / Builder",
];

export const VERDICTS = ["verified", "contradicted", "unverified"];
export const EVIDENCE_QUALITY = ["high", "medium", "low"];

export function isSearchUrl(url) {
  return (
    typeof url === "string" &&
    /(google|bing|duckduckgo)\.[a-z.]+\/(search|url)|[?&]q=/i.test(url)
  );
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeEvidence(evidence) {
  return (Array.isArray(evidence) ? evidence : [])
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      note: cleanString(item.note),
      url: cleanString(item.url),
      source_type: cleanString(item.source_type) || "other",
    }))
    .filter((item) => item.url && !isSearchUrl(item.url));
}

function normalizeClaim(claim) {
  const evidence = normalizeEvidence(claim?.evidence);
  let verdict = cleanString(claim?.verdict).toLowerCase();
  if (!VERDICTS.includes(verdict)) verdict = "unverified";
  if (verdict === "verified" && evidence.length === 0) verdict = "unverified";
  return {
    claim: cleanString(claim?.claim),
    verdict,
    evidence,
  };
}

function normalizeLinks(links = {}) {
  return {
    github: cleanString(links.github) || null,
    linkedin: cleanString(links.linkedin) || null,
    scholar: cleanString(links.scholar) || null,
    huggingface: cleanString(links.huggingface) || null,
    website: cleanString(links.website) || null,
    other: cleanString(links.other) || null,
  };
}

function normalizeScoreBreakdown(score = {}) {
  return {
    achievement_signals: clampScore(score.achievement_signals),
    skill_match: clampScore(score.skill_match),
    work_history: clampScore(score.work_history),
    evidence_quality: clampScore(score.evidence_quality),
  };
}

function normalizeAudit(audit = {}) {
  const quality = cleanString(audit.overall_evidence_quality).toLowerCase();
  return {
    verified_claims: Array.isArray(audit.verified_claims) ? audit.verified_claims.map(cleanString).filter(Boolean) : [],
    unverified_claims: Array.isArray(audit.unverified_claims) ? audit.unverified_claims.map(cleanString).filter(Boolean) : [],
    contradicted_claims: Array.isArray(audit.contradicted_claims) ? audit.contradicted_claims.map(cleanString).filter(Boolean) : [],
    single_source_claims: Array.isArray(audit.single_source_claims) ? audit.single_source_claims.map(cleanString).filter(Boolean) : [],
    identity_risks: Array.isArray(audit.identity_risks) ? audit.identity_risks.map(cleanString).filter(Boolean) : [],
    recency_notes: Array.isArray(audit.recency_notes) ? audit.recency_notes.map(cleanString).filter(Boolean) : [],
    overall_evidence_quality: EVIDENCE_QUALITY.includes(quality) ? quality : "medium",
  };
}

function normalizeCandidate(candidate = {}) {
  const claims = (Array.isArray(candidate.claims) ? candidate.claims : []).map(normalizeClaim);
  return {
    name: cleanString(candidate.name) || "Unknown candidate",
    headline: cleanString(candidate.headline),
    location: cleanString(candidate.location) || null,
    current_role: cleanString(candidate.current_role) || null,
    current_company: cleanString(candidate.current_company) || null,
    ai_directions: Array.isArray(candidate.ai_directions)
      ? candidate.ai_directions.map(cleanString).filter(Boolean)
      : [],
    match_score: clampScore(candidate.match_score),
    score_breakdown: normalizeScoreBreakdown(candidate.score_breakdown),
    strongest_signals: Array.isArray(candidate.strongest_signals)
      ? candidate.strongest_signals.map(cleanString).filter(Boolean).slice(0, 5)
      : [],
    uncertainties: Array.isArray(candidate.uncertainties)
      ? candidate.uncertainties.map(cleanString).filter(Boolean).slice(0, 5)
      : [],
    links: normalizeLinks(candidate.links),
    claims,
    evidence_audit: normalizeAudit(candidate.evidence_audit),
    outreach_angle: cleanString(candidate.outreach_angle),
    summary: cleanString(candidate.summary),
  };
}

function normalizeBrief(brief = {}) {
  return {
    original_query: cleanString(brief.original_query),
    target_directions: Array.isArray(brief.target_directions) ? brief.target_directions.map(cleanString).filter(Boolean) : [],
    required_skills: Array.isArray(brief.required_skills) ? brief.required_skills.map(cleanString).filter(Boolean) : [],
    preferred_skills: Array.isArray(brief.preferred_skills) ? brief.preferred_skills.map(cleanString).filter(Boolean) : [],
    seniority: cleanString(brief.seniority) || null,
    geography: cleanString(brief.geography) || null,
    evidence_preferences: Array.isArray(brief.evidence_preferences) ? brief.evidence_preferences.map(cleanString).filter(Boolean) : [],
    exclusions: Array.isArray(brief.exclusions) ? brief.exclusions.map(cleanString).filter(Boolean) : [],
  };
}

function normalizeTalentMap(map = []) {
  return (Array.isArray(map) ? map : []).map((item) => ({
    direction: cleanString(item.direction),
    fit: cleanString(item.fit) || "adjacent",
    candidate_count: Math.max(0, Number(item.candidate_count) || 0),
    rationale: cleanString(item.rationale),
  })).filter((item) => item.direction);
}

export function normalizeTalentSearchResult(data) {
  const source = data && typeof data === "object" ? data : {};
  return {
    search_brief: normalizeBrief(source.search_brief),
    talent_map: normalizeTalentMap(source.talent_map),
    candidates: (Array.isArray(source.candidates) ? source.candidates : []).map(normalizeCandidate),
  };
}

export function isTalentSearchResult(data) {
  return Boolean(
    data &&
    typeof data === "object" &&
    Array.isArray(data.candidates) &&
    (data.search_brief || data.talent_map || data.candidates.some((candidate) => "match_score" in candidate)),
  );
}
```

- [ ] **Step 4: 实现 `web/lib/talent-profile.d.ts`**

Create `web/lib/talent-profile.d.ts`:

```ts
export type Verdict = "verified" | "contradicted" | "unverified";
export type EvidenceQuality = "high" | "medium" | "low";

export type TalentEvidence = {
  note: string;
  url: string;
  source_type: string;
};

export type TalentClaim = {
  claim: string;
  verdict: Verdict;
  evidence: TalentEvidence[];
};

export type TalentSearchBrief = {
  original_query: string;
  target_directions: string[];
  required_skills: string[];
  preferred_skills: string[];
  seniority: string | null;
  geography: string | null;
  evidence_preferences: string[];
  exclusions: string[];
};

export type TalentMapItem = {
  direction: string;
  fit: string;
  candidate_count: number;
  rationale: string;
};

export type ScoreBreakdown = {
  achievement_signals: number;
  skill_match: number;
  work_history: number;
  evidence_quality: number;
};

export type EvidenceAudit = {
  verified_claims: string[];
  unverified_claims: string[];
  contradicted_claims: string[];
  single_source_claims: string[];
  identity_risks: string[];
  recency_notes: string[];
  overall_evidence_quality: EvidenceQuality;
};

export type TalentCandidate = {
  name: string;
  headline: string;
  location: string | null;
  current_role: string | null;
  current_company: string | null;
  ai_directions: string[];
  match_score: number;
  score_breakdown: ScoreBreakdown;
  strongest_signals: string[];
  uncertainties: string[];
  links: {
    github: string | null;
    linkedin: string | null;
    scholar: string | null;
    huggingface: string | null;
    website: string | null;
    other: string | null;
  };
  claims: TalentClaim[];
  evidence_audit: EvidenceAudit;
  outreach_angle: string;
  summary: string;
};

export type TalentSearchResult = {
  search_brief: TalentSearchBrief;
  talent_map: TalentMapItem[];
  candidates: TalentCandidate[];
};

export const AI_DIRECTIONS: string[];
export function normalizeTalentSearchResult(data: unknown): TalentSearchResult;
export function isTalentSearchResult(data: unknown): data is TalentSearchResult;
export function isSearchUrl(url: unknown): boolean;
```

- [ ] **Step 5: 运行测试并确认通过**

Run:

```bash
node --test talent-profile.test.mjs
```

Expected: PASS，2 个测试通过。

- [ ] **Step 6: 提交**

```bash
git add web/lib/talent-profile.mjs web/lib/talent-profile.d.ts talent-profile.test.mjs
git commit -m "feat: add talent shortlist domain model"
```

---

### Task 2: 更新 MiroMind prompt 与 worker summary

**Files:**
- Modify: `web/lib/miro.ts`
- Modify: `worker/lib.mjs`
- Modify: `worker/index.mjs`
- Test: `talent-profile.test.mjs`

- [ ] **Step 1: 给新版 payload 增加回归测试**

Append to `talent-profile.test.mjs`:

```js
test("recognizes v1 talent result but not legacy verify report", () => {
  assert.equal(isTalentSearchResult({ candidate_name: "Ada", claims: [] }), false);
  assert.equal(isTalentSearchResult({ candidates: [{ name: "Ada", match_score: 80 }] }), true);
});
```

- [ ] **Step 2: 运行测试并确认通过**

Run:

```bash
node --test talent-profile.test.mjs
```

Expected: PASS，3 个测试通过。

- [ ] **Step 3: 更新 `web/lib/miro.ts` imports 和 `normalizeResult()`**

Modify the top imports:

```ts
import { isTalentSearchResult, normalizeTalentSearchResult } from "./talent-profile.mjs";
```

Replace `normalizeResult()` with:

```ts
export function normalizeResult<T>(data: T): T {
  if (!data || typeof data !== "object") return data;
  if (isTalentSearchResult(data)) return normalizeTalentSearchResult(data) as T;
  const d = data as ResultLike;
  if (Array.isArray(d.candidates)) for (const c of d.candidates) normalizeClaims(c?.claims ?? []);
  if (Array.isArray(d.claims)) normalizeClaims(d.claims);
  return data;
}
```

- [ ] **Step 4: 替换 `web/lib/miro.ts` 的 `searchPrompt`**

Replace the current `searchPrompt` export with:

```ts
export const searchPrompt = (query: string) => `You are SignalHire, an AI talent sourcing and evidence-audit agent for HR teams and headhunters.

TASK:
Search globally for 10 to 15 real AI talent candidates for this hiring brief:
"${query}"

The result must feel like a high-quality hiring shortlist, not raw search results.

SEARCH STRATEGY:
- Prefer public, verifiable achievement signals over resume keywords.
- Search broadly across papers, arXiv, OpenReview, Semantic Scholar, conference pages, GitHub, Hugging Face, Papers with Code, personal sites, technical blogs, company engineering blogs, project pages, benchmark pages, talks, podcasts, interviews, and public profile pages.
- Group candidates by AI talent direction.
- Include primary matches and adjacent transferable candidates when useful.
- Every candidate must be a single real named person.
- Never return teams, organizations, unnamed contributors, or collectives.
- Do not guess private email addresses.

AI DIRECTIONS:
- AI Infrastructure / LLM Systems
- AI Research / Applied Science
- Applied AI / Agents
- ML Platform / MLOps
- Data / Evaluation / Safety
- AI Product / Solutions
- Founder / Builder

SCORING:
Return match_score from 0 to 100.
Use this weighting:
- achievement_signals: 40
- skill_match: 25
- work_history: 20
- evidence_quality: 15

EVIDENCE RULES:
- Key claims need specific source URLs.
- A search-results URL is not evidence.
- "verified" means public evidence clearly supports the claim.
- "contradicted" means public evidence conflicts with the claim.
- "unverified" means the claim is plausible but not supported by clear public evidence.
- If a claim has no concrete evidence URL, use "unverified".

OUTPUT RULES:
Respond with only one JSON object and no prose.
Use exactly this shape:
{
  "search_brief": {
    "original_query": "string",
    "target_directions": ["string"],
    "required_skills": ["string"],
    "preferred_skills": ["string"],
    "seniority": "string or null",
    "geography": "string or null",
    "evidence_preferences": ["string"],
    "exclusions": ["string"]
  },
  "talent_map": [
    {
      "direction": "AI Infrastructure / LLM Systems",
      "fit": "primary | adjacent | high_potential",
      "candidate_count": 0,
      "rationale": "string"
    }
  ],
  "candidates": [
    {
      "name": "First Last",
      "headline": "current role / concise summary",
      "location": "city, region, country or null",
      "current_role": "string or null",
      "current_company": "string or null",
      "ai_directions": ["AI Infrastructure / LLM Systems"],
      "match_score": 0,
      "score_breakdown": {
        "achievement_signals": 0,
        "skill_match": 0,
        "work_history": 0,
        "evidence_quality": 0
      },
      "strongest_signals": ["3 to 5 concrete signals"],
      "uncertainties": ["known gaps or risks"],
      "links": {
        "github": "url or null",
        "linkedin": "url or null",
        "scholar": "url or null",
        "huggingface": "url or null",
        "website": "url or null",
        "other": "url or null"
      },
      "claims": [
        {
          "claim": "concrete factual claim",
          "verdict": "verified | contradicted | unverified",
          "evidence": [
            { "note": "what the source proves", "url": "https://example.com/source-page", "source_type": "paper | code | profile | company | talk | blog | project | other" }
          ]
        }
      ],
      "evidence_audit": {
        "verified_claims": ["string"],
        "unverified_claims": ["string"],
        "contradicted_claims": ["string"],
        "single_source_claims": ["string"],
        "identity_risks": ["string"],
        "recency_notes": ["string"],
        "overall_evidence_quality": "high | medium | low"
      },
      "outreach_angle": "one specific reason to contact this person",
      "summary": "2 sentence explanation of fit and evidence strength"
    }
  ]
}`;
```

- [ ] **Step 5: 同步 `worker/lib.mjs`**

Add these imports at the top of `worker/lib.mjs`:

```js
import { isTalentSearchResult, normalizeTalentSearchResult } from "../web/lib/talent-profile.mjs";
```

Then stop and replace that import with a worker-local copy before committing, because Railway builds only `worker/` context. Create `worker/talent-profile.mjs` by copying `web/lib/talent-profile.mjs`, and use:

```js
import { isTalentSearchResult, normalizeTalentSearchResult } from "./talent-profile.mjs";
```

The final committed worker import must be `./talent-profile.mjs`, not `../web/lib/talent-profile.mjs`.

- [ ] **Step 6: 更新 `worker/index.mjs` summary**

Replace `summarize()` with:

```js
function summarize(kind, data) {
  if (kind === "search") {
    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    const top = candidates.slice(0, 3).map((c) => `${c?.name ?? "候选人"} ${c?.match_score ?? 0}`).join(", ");
    return `${candidates.length} 位 AI 候选人${top ? ` · ${top}` : ""}`;
  }
  const claims = Array.isArray(data?.claims) ? data.claims : [];
  const contra = claims.filter((c) => c?.verdict === "contradicted").length;
  return `可信度 ${data?.overall_trust ?? "?"}${contra ? ` · ${contra} 矛盾` : ""}`;
}
```

- [ ] **Step 7: 运行检查**

Run:

```bash
node --test talent-profile.test.mjs
node --check worker/index.mjs
node --check worker/lib.mjs
node --check worker/talent-profile.mjs
```

Expected: all pass.

- [ ] **Step 8: 提交**

```bash
git add web/lib/miro.ts worker/lib.mjs worker/index.mjs worker/talent-profile.mjs talent-profile.test.mjs
git commit -m "feat: generate ai talent shortlist payloads"
```

---

### Task 3: 新增 Shortlist 展示组件

**Files:**
- Modify: `web/components/result.tsx`

- [ ] **Step 1: 扩展类型 imports**

At the top of `web/components/result.tsx`, add:

```ts
import type { TalentCandidate, TalentSearchResult } from "@/lib/talent-profile.mjs";
```

- [ ] **Step 2: 新增证据质量和分数组件**

Append before `CandidateCard`:

```tsx
const QUALITY: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  low: "bg-red-50 text-red-700 ring-red-200",
};

function ScorePill({ score }: { score: number }) {
  const tone = score >= 80 ? "bg-emerald-600" : score >= 65 ? "bg-amber-500" : "bg-gray-500";
  return (
    <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${tone}`}>
      {score}
    </span>
  );
}

function QualityPill({ value }: { value: string }) {
  const label = value === "high" ? "证据强" : value === "low" ? "证据弱" : "证据中等";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${QUALITY[value] ?? QUALITY.medium}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 3: 新增 `TalentMapView`**

Append:

```tsx
export function TalentMapView({ result }: { result: TalentSearchResult }) {
  if (!result.talent_map?.length) return null;
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">AI 人才方向分布</h2>
          <p className="mt-1 text-xs text-gray-500">按岗位画像识别主匹配、相邻可迁移和高潜力人才池。</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {result.talent_map.map((item) => (
          <div key={item.direction} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">{item.direction}</p>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                {item.candidate_count} 人
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">{item.fit} · {item.rationale}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: 新增 `ShortlistCard`**

Append:

```tsx
export function ShortlistCard({
  candidate,
  selected,
  onToggle,
  onOpen,
}: {
  candidate: TalentCandidate;
  selected: boolean;
  onToggle?: () => void;
  onOpen?: () => void;
}) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-start gap-4">
        <ScorePill score={candidate.match_score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{candidate.name}</h3>
            <QualityPill value={candidate.evidence_audit.overall_evidence_quality} />
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{candidate.headline}</p>
          <p className="mt-1 text-xs text-gray-400">
            {[candidate.current_role, candidate.current_company, candidate.location].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {candidate.ai_directions.map((direction) => (
              <span key={direction} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                {direction}
              </span>
            ))}
          </div>
          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {candidate.strongest_signals.slice(0, 3).map((signal) => <li key={signal}>• {signal}</li>)}
          </ul>
          {candidate.uncertainties.length > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              不确定点：{candidate.uncertainties[0]}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {onOpen && (
            <button onClick={onOpen} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-900">
              查看详情
            </button>
          )}
          {onToggle && (
            <button onClick={onToggle} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800">
              {selected ? "移出 shortlist" : "加入 shortlist"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 5: 新增 `EvidenceAuditView` 和 `CandidateProfileView`**

Append:

```tsx
export function EvidenceAuditView({ candidate }: { candidate: TalentCandidate }) {
  const audit = candidate.evidence_audit;
  const rows = [
    ["已验证", audit.verified_claims],
    ["未验证", audit.unverified_claims],
    ["矛盾", audit.contradicted_claims],
    ["单一来源", audit.single_source_claims],
    ["身份风险", audit.identity_risks],
    ["时效说明", audit.recency_notes],
  ] as const;
  return (
    <section className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">Evidence Audit</h4>
        <QualityPill value={audit.overall_evidence_quality} />
      </div>
      <div className="mt-3 space-y-2">
        {rows.map(([label, items]) => (
          items.length > 0 && (
            <div key={label}>
              <p className="text-xs font-semibold text-gray-500">{label}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-gray-600">
                {items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )
        ))}
      </div>
    </section>
  );
}

export function CandidateProfileView({ candidate }: { candidate: TalentCandidate }) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-start gap-4">
        <ScorePill score={candidate.match_score} />
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{candidate.name}</h3>
          <p className="mt-1 text-sm text-gray-500">{candidate.summary || candidate.headline}</p>
          {candidate.outreach_angle && (
            <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">联系角度：{candidate.outreach_angle}</p>
          )}
        </div>
      </div>
      <div className="mt-5 grid gap-4">
        <EvidenceAuditView candidate={candidate} />
        <div className="space-y-2.5">
          {candidate.claims.map((claim, index) => <ClaimBlock key={index} c={claim} />)}
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 6: 运行 lint/build**

Run:

```bash
cd web
npm run lint
npm run build
```

Expected: both pass. If `next build` fails inside sandbox with Turbopack port binding, rerun outside sandbox as documented in `docs/verification.md`.

- [ ] **Step 7: 提交**

```bash
git add web/components/result.tsx
git commit -m "feat: add talent shortlist result components"
```

---

### Task 4: 主页面改为 Search Brief + Shortlist

**Files:**
- Modify: `web/app/page.tsx`

- [ ] **Step 1: 更新类型和 imports**

Replace result imports:

```ts
import {
  CandidateProfileView,
  ShortlistCard,
  TalentMapView,
  TrustReportView,
  type Candidate,
  type VerifyReport,
} from "@/components/result";
import type { TalentCandidate, TalentSearchResult } from "@/lib/talent-profile.mjs";
```

Replace `type SearchResult`:

```ts
type SearchResult = { candidates?: Candidate[] } | TalentSearchResult;
```

Add helper:

```ts
function isTalentSearchResult(result: AppResult | null): result is TalentSearchResult {
  return Boolean(result && "talent_map" in result && "search_brief" in result && Array.isArray((result as TalentSearchResult).candidates));
}
```

- [ ] **Step 2: 修改默认状态**

Change initial state:

```ts
const [mode, setMode] = useState<"search" | "verify">("search");
const [query, setQuery] = useState("找做过 LLM inference / serving、熟悉 vLLM 或 Triton、能做 AI infra 落地的 senior engineer，北美或欧洲优先，可远程");
const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number | null>(null);
const [shortlist, setShortlist] = useState<number[]>([]);
```

When clearing a run inside `run()`, also reset:

```ts
setSelectedCandidateIndex(null);
setShortlist([]);
```

- [ ] **Step 3: 隐藏旧 verify 主入口**

Replace the segmented control block with:

```tsx
<div className="flex items-center justify-between gap-3">
  <div>
    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Search Brief</p>
    <h2 className="mt-1 text-lg font-semibold text-gray-900">全球 AI 人才搜索</h2>
  </div>
  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
    10-15 人 shortlist
  </span>
</div>
```

Keep `mode` in code only for backward compatibility with history rows and old verify reports.

- [ ] **Step 4: 输入框改成岗位画像 textarea**

Replace the search/verify conditional input with:

```tsx
<textarea
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  rows={5}
  placeholder="例如：找做过 LLM inference / serving、熟悉 vLLM 或 Triton、能做 AI infra 落地的 senior engineer，北美或欧洲优先，可远程"
  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
/>
```

Replace submit button label:

```tsx
{loading ? "正在搜索全球 AI 候选人…" : "生成 AI 人才 shortlist"}
```

- [ ] **Step 5: 渲染新版结果**

Replace the current `result &&` result rendering branch with:

```tsx
{result && (
  <div className="mt-6 space-y-4">
    <div className="flex items-center justify-between gap-3">
      {stats ? (
        <p className="flex items-center gap-2 text-xs text-gray-500">
          {stats.cached ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-200">
              预缓存 · 秒出
            </span>
          ) : (
            <span>本次研究：网页搜索 {stats.searches} 次 · 抓取 {stats.fetches} 次</span>
          )}
        </p>
      ) : <span />}
      {runId && (
        <button
          onClick={() => {
            navigator.clipboard?.writeText(`${location.origin}/r/${runId}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-900"
        >
          {copied ? "链接已复制" : "分享报告"}
        </button>
      )}
    </div>

    {isTalentSearchResult(result) ? (
      <>
        <TalentMapView result={result} />
        <section className="space-y-3">
          {result.candidates.map((candidate: TalentCandidate, index: number) => (
            <ShortlistCard
              key={`${candidate.name}-${index}`}
              candidate={candidate}
              selected={shortlist.includes(index)}
              onToggle={() => {
                setShortlist((items) => items.includes(index) ? items.filter((item) => item !== index) : [...items, index]);
              }}
              onOpen={() => setSelectedCandidateIndex(index)}
            />
          ))}
        </section>
        {selectedCandidateIndex !== null && result.candidates[selectedCandidateIndex] && (
          <CandidateProfileView candidate={result.candidates[selectedCandidateIndex]} />
        )}
      </>
    ) : mode === "search"
      ? ("candidates" in result ? result.candidates ?? [] : []).map((c: Candidate, i: number) => <CandidateCard key={i} c={c} delay={i * 90} />)
      : isVerifyReport(result) && <TrustReportView r={result} />}
  </div>
)}
```

- [ ] **Step 6: 更新 history 文案**

Change history title copy:

```tsx
<h2 className="text-sm font-semibold text-gray-700">搜索项目历史</h2>
<p className="mt-0.5 text-xs text-gray-400">点击任意一条重新打开已完成的 shortlist 或证据报告</p>
```

- [ ] **Step 7: 运行验证**

Run:

```bash
cd web
npm run lint
npm run build
```

Expected: both pass.

- [ ] **Step 8: 提交**

```bash
git add web/app/page.tsx
git commit -m "feat: make search brief the main workflow"
```

---

### Task 5: 分享页支持新版 shortlist report

**Files:**
- Modify: `web/app/r/[id]/page.tsx`

- [ ] **Step 1: 更新 imports**

Replace component imports:

```ts
import {
  CandidateCard,
  CandidateProfileView,
  TalentMapView,
  TrustReportView,
  type Candidate,
  type VerifyReport,
} from "@/components/result";
import type { TalentSearchResult } from "@/lib/talent-profile.mjs";
```

Add helper:

```ts
function isTalentSearchResult(result: unknown): result is TalentSearchResult {
  return Boolean(result && typeof result === "object" && "talent_map" in result && "search_brief" in result);
}
```

- [ ] **Step 2: 修改 metadata 文案**

Inside `generateMetadata`, change description:

```ts
description: row.summary || "SignalHire 生成的 AI 人才 shortlist 与公开证据报告。",
```

- [ ] **Step 3: 修改报告 badge 和上下文文案**

Change header badge:

```tsx
<span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">AI 人才报告</span>
```

Change context label:

```tsx
{row.kind === "search" ? "岗位画像" : "候选人证据审计"}
```

Change evidence line:

```tsx
SignalHire 基于公开来源生成 · 候选人按 AI 方向分层 · 关键结论附可点击证据
```

- [ ] **Step 4: 渲染新版 shortlist report**

Replace result block with:

```tsx
<div className="mt-6 space-y-4">
  {row.kind === "search" && isTalentSearchResult(row.result) ? (
    <>
      <TalentMapView result={row.result} />
      {(row.result as TalentSearchResult).candidates.map((candidate, index) => (
        <CandidateProfileView key={`${candidate.name}-${index}`} candidate={candidate} />
      ))}
    </>
  ) : row.kind === "search"
    ? ((row.result as { candidates?: Candidate[] })?.candidates ?? []).map((c, i) => (
        <CandidateCard key={i} c={c} delay={i * 90} />
      ))
    : <TrustReportView r={row.result as VerifyReport} />}
</div>
```

- [ ] **Step 5: 更新 CTA**

Replace CTA text:

```tsx
<p className="text-base font-semibold text-gray-900">想为你的 AI 岗位生成这样的 shortlist？</p>
<p className="mt-1 text-sm text-gray-500">SignalHire 从公开来源搜索全球 AI 人才，并把论文、开源、实践和工作经历证据整理成可交付报告。</p>
<Link href="/" className="mt-4 inline-block rounded-xl bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800">
  生成 AI 人才 shortlist →
</Link>
```

- [ ] **Step 6: 运行验证**

Run:

```bash
cd web
npm run lint
npm run build
```

Expected: both pass.

- [ ] **Step 7: 提交**

```bash
git add 'web/app/r/[id]/page.tsx'
git commit -m "feat: render shareable ai shortlist reports"
```

---

### Task 6: live verification script 校验新版 payload

**Files:**
- Modify: `web/scripts/verify-live-research-job.mjs`

- [ ] **Step 1: 修改 smoke query**

Use a product-realistic query:

```js
query: "Senior AI infrastructure engineer with public LLM serving, inference optimization, vLLM, Triton, or Kubernetes work; North America or Europe preferred",
```

- [ ] **Step 2: 增加 payload 校验函数**

Add before polling loop:

```js
function assertTalentPayload(status) {
  const result = status?.result;
  if (!result || typeof result !== "object") throw new Error("Job reached done without object result");
  if (!result.search_brief) throw new Error("Talent result missing search_brief");
  if (!Array.isArray(result.talent_map)) throw new Error("Talent result missing talent_map");
  if (!Array.isArray(result.candidates)) throw new Error("Talent result missing candidates");
  if (result.candidates.length < 10 || result.candidates.length > 15) {
    throw new Error(`Expected 10-15 candidates, got ${result.candidates.length}`);
  }
  for (const candidate of result.candidates) {
    if (!candidate.name) throw new Error("Candidate missing name");
    if (!Number.isFinite(Number(candidate.match_score))) throw new Error(`${candidate.name} missing match_score`);
    if (!candidate.evidence_audit) throw new Error(`${candidate.name} missing evidence_audit`);
    if (!Array.isArray(candidate.claims)) throw new Error(`${candidate.name} missing claims`);
  }
}
```

- [ ] **Step 3: 在 done 分支调用校验**

Replace done branch result check:

```js
if (status.status === "done") {
  assertTalentPayload(status);
  console.log(`live research job ok: ${queued.jobId}`);
  break;
}
```

- [ ] **Step 4: 运行语法检查**

Run:

```bash
node --check web/scripts/verify-live-research-job.mjs
```

Expected: no output, exit 0.

- [ ] **Step 5: 提交**

```bash
git add web/scripts/verify-live-research-job.mjs
git commit -m "test: verify live talent shortlist payloads"
```

---

### Task 7: 文档和产品定位收尾

**Files:**
- Modify: `README.md`
- Modify: `docs/verification.md`

- [ ] **Step 1: 更新 README 顶部定位**

Replace hackathon-oriented intro with:

```md
# SignalHire

*Find AI talent signals. Not resume keywords.*

SignalHire is a global AI talent search and evidence delivery platform for company HR teams and headhunters. You describe an AI hiring brief; SignalHire searches public sources across papers, open source, product practice, work history, and public profiles, then returns a 10-15 person shortlist with explainable scores and evidence audit.
```

- [ ] **Step 2: 更新 README 模式描述**

Replace the "Two modes" table with:

```md
## Core workflow

| Step | Input | Output |
|------|-------|--------|
| Search Brief | Natural-language AI hiring brief | Structured target directions, skills, geography, evidence preferences |
| AI Talent Search | Parsed brief | 10-15 global candidates grouped by AI direction |
| Evidence Audit | Candidate public signals | Verified, unverified, and contradicted claims with source URLs |
| Share Report | Final shortlist | Web link for hiring manager or client review |
```

- [ ] **Step 3: 更新 docs verification 的 live check 描述**

Replace the `verify:live` paragraph with:

```md
`verify:live` expects the web server and worker to already be running. It submits a realistic AI hiring brief, uses a private header to bypass DB cache without polluting the prompt, and polls `/api/status` until the job returns a v1 talent shortlist payload. The script verifies `search_brief`, `talent_map`, 10-15 candidates, `match_score`, and `evidence_audit`.
```

- [ ] **Step 4: 运行 markdown 搜索确认没有旧黑客松定位残留**

Run:

```bash
rg -n "UCWS|hackathon|黑客松|3 real|Two modes|打脸" README.md docs web/app web/components
```

Expected: Only historical spec notes may mention 黑客松 as non-goal. Product-facing README/app copy should not mention UCWS or hackathon.

- [ ] **Step 5: 提交**

```bash
git add README.md docs/verification.md
git commit -m "docs: update product positioning for ai talent search"
```

---

### Task 8: 全量验证和发布

**Files:**
- No source edits unless verification reveals a defect.

- [ ] **Step 1: 跑本地静态验证**

Run:

```bash
node --test talent-profile.test.mjs
node --test job-state.test.mjs
node --check worker/index.mjs
node --check worker/lib.mjs
node --check worker/talent-profile.mjs
cd web && npm run lint
cd web && npm run build
```

Expected:

- `talent-profile.test.mjs` passes.
- `job-state.test.mjs` passes.
- all `node --check` commands exit 0.
- `npm run lint` exits 0.
- `npm run build` exits 0 or hits only documented sandbox Turbopack port binding; if sandbox error occurs, rerun build outside sandbox and require exit 0.

- [ ] **Step 2: 推送到 main**

Run:

```bash
git status --short
git push origin main
```

Expected:

- `git status --short` is empty before push.
- push updates `origin/main`.

- [ ] **Step 3: 确认 Vercel/Railway 状态**

Run through available tools:

```bash
git show -s --format='%H %s' HEAD
```

Expected:

- GitHub commit status has Vercel success.
- Railway worker service status is success.

- [ ] **Step 4: 跑生产健康检查**

Run:

```bash
cd web
APP_BASE_URL=https://signal-hire-git-main-nobitas-projects-1b1e24ca.vercel.app npm run verify:worker-health
```

If Vercel Protection is enabled, include `VERCEL_AUTOMATION_BYPASS_SECRET` in the environment without printing its value.

Expected: JSON includes `"ok": true`, `queued: 0`, `retrying: 0`, and `stale_count: 0`.

- [ ] **Step 5: 跑一次真实 live smoke**

Run:

```bash
cd web
APP_BASE_URL=https://signal-hire-git-main-nobitas-projects-1b1e24ca.vercel.app RESEARCH_VERIFY_MODE=search npm run verify:live
```

If Vercel Protection is enabled, include `VERCEL_AUTOMATION_BYPASS_SECRET` in the environment without printing its value.

Expected:

- script logs a concrete job id such as `jobId=0fa42e1f-f5a3-432d-80a0-d507a7c78019`.
- phase reaches `done`.
- script logs `live research job ok: <job id from this run>`.
- no payload assertion fails.

- [ ] **Step 6: 最终提交说明**

Report:

- Latest commit SHA.
- Vercel deployment URL.
- Health check result.
- Live smoke job ID.
- Any known limitation left for P1.
