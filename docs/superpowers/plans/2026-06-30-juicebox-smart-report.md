# Juicebox P1 Smart Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first Juicebox-inspired priority: a client-ready SignalHire Smart Report on public candidate reports.

**Architecture:** Add a pure `web/lib/smart-report.mjs` view-model builder that wraps existing talent search data without new database tables. Render a new `SmartReportView` component inside `web/components/result.tsx`, then show it near the top of `web/app/r/[id]/page.tsx`. Keep outreach status conservative because public run reports do not yet have project outreach thread data.

**Tech Stack:** Next.js App Router, TypeScript/TSX, ESM helper modules, Node `node:test`.

---

## File Structure

- Create `web/lib/smart-report.mjs`: pure Smart Report view model builder.
- Create `web/lib/smart-report.d.ts`: TypeScript declarations for TSX imports.
- Modify `web/components/result.tsx`: import the builder and render `SmartReportView`.
- Modify `web/app/r/[id]/page.tsx`: place Smart Report before the existing delivery report.
- Modify `api-route-copy.test.mjs`: route/component wiring assertions.
- Create `smart-report.test.mjs`: behavior tests for metrics, source labels, candidate next actions, and low-evidence guardrails.

## Task 1: Smart Report View Model

**Files:**
- Create: `smart-report.test.mjs`
- Create: `web/lib/smart-report.mjs`
- Create: `web/lib/smart-report.d.ts`

- [ ] **Step 1: Write the failing test**

Add `smart-report.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildSmartReportView } from "./web/lib/smart-report.mjs";

test("builds a client-ready smart report with source mix, risks, and next actions", () => {
  const report = buildSmartReportView({
    search_brief: { original_query: "Hire an AI infra lead" },
    evidence_graph: {
      source_mix: [
        { source_type: "github", count: 2 },
        { source_type: "people_api", count: 1 },
      ],
    },
    candidates: [
      {
        name: "Ada",
        headline: "AI Infra Lead",
        match_score: 88,
        strongest_signals: ["Built vLLM deployment"],
        uncertainties: [],
        evidence_audit: {
          overall_evidence_quality: "high",
          risk_flags: [],
          unverified_claims: [],
        },
      },
      {
        name: "Lin",
        headline: "ML Engineer",
        match_score: 71,
        strongest_signals: ["OpenJobs profile lead"],
        uncertainties: ["Needs public evidence"],
        evidence_audit: {
          overall_evidence_quality: "low",
          risk_flags: ["OpenJobs profile has not been independently verified"],
          unverified_claims: ["Profile provider claims"],
        },
      },
    ],
  }, { locale: "en" });

  assert.equal(report.title, "Smart Report");
  assert.equal(report.metrics.candidates, 2);
  assert.equal(report.metrics.strong_evidence, 1);
  assert.equal(report.metrics.ready_for_outreach, 1);
  assert.equal(report.metrics.needs_scheduling, 0);
  assert.deepEqual(report.source_mix.map((item) => item.label), ["GitHub", "People API"]);
  assert.equal(report.top_candidates[0].name, "Ada");
  assert.equal(report.top_candidates[0].outreach_status, "Not started");
  assert.match(report.top_candidates[0].next_action, /review/i);
  assert.match(report.top_candidates[1].next_action, /verify evidence/i);
  assert.match(report.risks.join(" "), /Lin/);
  assert.ok(report.next_actions.some((action) => /Share this report/i.test(action)));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test smart-report.test.mjs`

Expected: FAIL with module not found for `web/lib/smart-report.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `web/lib/smart-report.mjs`:

```js
import { sourceTypeLabel, sourceTypeTooltip } from "./source-classifier.mjs";

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanArray(value, limit = 6) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, limit) : [];
}

function candidateRole(candidate) {
  return cleanString(candidate.headline || candidate.current_role || candidate.current_title || candidate.role);
}

function evidenceQuality(candidate) {
  const audit = isRecord(candidate.evidence_audit) ? candidate.evidence_audit : {};
  return cleanString(audit.overall_evidence_quality || candidate.evidence_quality || "low").toLowerCase();
}

function primaryRisk(candidate) {
  const audit = isRecord(candidate.evidence_audit) ? candidate.evidence_audit : {};
  return cleanArray(audit.risk_flags, 1)[0]
    || cleanArray(audit.identity_risks, 1)[0]
    || cleanArray(audit.unverified_claims, 1)[0]
    || cleanArray(candidate.uncertainties, 1)[0]
    || "";
}

function candidateEvidenceSummary(candidate) {
  return cleanArray(candidate.strongest_signals, 1)[0]
    || cleanString(candidate.summary)
    || candidateRole(candidate)
    || "Review candidate evidence before sharing.";
}

function candidateNextAction(candidate, locale) {
  const quality = evidenceQuality(candidate);
  const risk = primaryRisk(candidate);
  const score = Number(candidate.match_score) || 0;
  if (quality === "low" || risk) {
    return locale === "en"
      ? "Verify evidence before outreach or recommendation."
      : "先补公开证据，再决定是否外联或推荐。";
  }
  if (score >= 75) {
    return locale === "en"
      ? "Review evidence and consider controlled outreach."
      : "复核证据后，可进入受控外联。";
  }
  return locale === "en"
    ? "Keep as a next-round search seed."
    : "保留为下一轮搜索种子。";
}

function sourceMixFrom(result, locale) {
  const graph = isRecord(result.evidence_graph) ? result.evidence_graph : {};
  const telemetry = isRecord(result.agent_execution?.telemetry) ? result.agent_execution.telemetry : {};
  const rows = Array.isArray(graph.source_mix) && graph.source_mix.length ? graph.source_mix : telemetry.source_mix;
  return (Array.isArray(rows) ? rows : []).map((item) => {
    const sourceType = cleanString(item?.source_type || "public_web");
    return {
      source_type: sourceType,
      label: sourceTypeLabel(sourceType, locale),
      count: Number(item?.count) || 0,
      tooltip: sourceTypeTooltip(sourceType, locale),
    };
  }).filter((item) => item.count > 0);
}

export function buildSmartReportView(result = {}, { locale = "zh" } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const candidates = Array.isArray(result.candidates) ? result.candidates.filter(isRecord) : [];
  const strongEvidence = candidates.filter((candidate) => evidenceQuality(candidate) === "high");
  const readyForOutreach = candidates.filter((candidate) => evidenceQuality(candidate) === "high" && !primaryRisk(candidate) && (Number(candidate.match_score) || 0) >= 75);
  const lowEvidence = candidates.filter((candidate) => evidenceQuality(candidate) === "low");
  const brief = cleanString(result.search_brief?.original_query)
    || cleanString(result.query)
    || cleanString(result.role)
    || (normalizedLocale === "en" ? "Candidate delivery report" : "候选人交付报告");

  const topCandidates = candidates
    .slice()
    .sort((a, b) => (Number(b.match_score) || 0) - (Number(a.match_score) || 0))
    .slice(0, 5)
    .map((candidate) => ({
      name: cleanString(candidate.name) || (normalizedLocale === "en" ? "Unknown candidate" : "未知候选人"),
      role: candidateRole(candidate),
      match_score: Number(candidate.match_score) || 0,
      evidence_quality: evidenceQuality(candidate),
      evidence_summary: candidateEvidenceSummary(candidate),
      primary_risk: primaryRisk(candidate),
      outreach_status: cleanString(candidate.outreach_status || candidate.status) || (normalizedLocale === "en" ? "Not started" : "尚未开始"),
      next_action: candidateNextAction(candidate, normalizedLocale),
    }));

  const risks = [];
  if (lowEvidence.length > 0) {
    risks.push(normalizedLocale === "en"
      ? `Needs evidence verification: ${lowEvidence.map((candidate) => cleanString(candidate.name)).filter(Boolean).slice(0, 4).join(", ")}`
      : `需要补证据：${lowEvidence.map((candidate) => cleanString(candidate.name)).filter(Boolean).slice(0, 4).join("、")}`);
  }
  for (const candidate of candidates) {
    const risk = primaryRisk(candidate);
    if (risk) risks.push(`${cleanString(candidate.name) || "Candidate"}: ${risk}`);
  }

  const nextActions = [];
  if (readyForOutreach.length > 0) {
    nextActions.push(normalizedLocale === "en"
      ? `Review ${readyForOutreach.length} evidence-backed candidate${readyForOutreach.length === 1 ? "" : "s"} for controlled outreach.`
      : `优先复核 ${readyForOutreach.length} 位证据较完整候选人，并进入受控外联。`);
  }
  if (lowEvidence.length > 0) {
    nextActions.push(normalizedLocale === "en"
      ? "Backfill weak public evidence before recommending profile leads."
      : "先为低证据 profile leads 补公开证据，再进入推荐。");
  }
  nextActions.push(normalizedLocale === "en"
    ? "Share this report with the hiring manager or client for review."
    : "把这份报告发给 hiring manager 或客户进行审阅。");

  return {
    title: normalizedLocale === "en" ? "Smart Report" : "智能交付报告",
    brief_summary: brief,
    metrics: {
      candidates: candidates.length,
      strong_evidence: strongEvidence.length,
      ready_for_outreach: readyForOutreach.length,
      needs_scheduling: candidates.filter((candidate) => cleanString(candidate.outreach_status || candidate.status) === "needs_scheduling").length,
    },
    source_mix: sourceMixFrom(result, normalizedLocale),
    top_candidates: topCandidates,
    risks: [...new Set(risks)].slice(0, 6),
    next_actions: [...new Set(nextActions)].slice(0, 5),
  };
}
```

Create `web/lib/smart-report.d.ts`:

```ts
export type SmartReportView = {
  title: string;
  brief_summary: string;
  metrics: {
    candidates: number;
    strong_evidence: number;
    ready_for_outreach: number;
    needs_scheduling: number;
  };
  source_mix: Array<{
    source_type: string;
    label: string;
    count: number;
    tooltip: string;
  }>;
  top_candidates: Array<{
    name: string;
    role: string;
    match_score: number;
    evidence_quality: string;
    evidence_summary: string;
    primary_risk: string;
    outreach_status: string;
    next_action: string;
  }>;
  risks: string[];
  next_actions: string[];
};

export function buildSmartReportView(result?: unknown, options?: { locale?: "zh" | "en" }): SmartReportView;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test smart-report.test.mjs`

Expected: PASS.

## Task 2: Public Report Wiring

**Files:**
- Modify: `web/components/result.tsx`
- Modify: `web/app/r/[id]/page.tsx`
- Modify: `api-route-copy.test.mjs`

- [ ] **Step 1: Write failing wiring assertions**

Append to `api-route-copy.test.mjs`:

```js
test("public report renders SignalHire Smart Report before candidate details", () => {
  const resultComponents = readFileSync("web/components/result.tsx", "utf8");
  const reportPage = readFileSync("web/app/r/[id]/page.tsx", "utf8");

  assert.match(resultComponents, /buildSmartReportView/);
  assert.match(resultComponents, /export function SmartReportPanel/);
  assert.match(resultComponents, /Smart Report|智能交付报告/);
  assert.match(resultComponents, /Ready for outreach|可外联/);
  assert.match(reportPage, /SmartReportPanel/);
  assert.match(reportPage, /<SmartReportPanel result=\{talentResult\} locale=\{locale\} \\/>/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test api-route-copy.test.mjs --test-name-pattern "public report renders SignalHire Smart Report"`

Expected: FAIL because `SmartReportPanel` is not implemented.

- [ ] **Step 3: Add the component and report wiring**

In `web/components/result.tsx`, import the builder:

```ts
import { buildSmartReportView } from "@/lib/smart-report.mjs";
```

Add `SmartReportPanel` before `SourceMixSummaryView`:

```tsx
export function SmartReportPanel({ result, locale }: { result: TalentSearchResult } & ResultLocaleProps) {
  const report = buildSmartReportView(result, { locale });
  if (report.metrics.candidates === 0) return null;
  const isEn = locale === "en";
  return (
    <ResultSurface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
            {isEn ? "Hiring manager / client view" : "Hiring manager / 客户视图"}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">{report.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{report.brief_summary}</p>
        </div>
        <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
          {isEn ? "Client-ready" : "可交付"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReportMetric label={isEn ? "Candidates" : "候选人"} value={report.metrics.candidates} />
        <ReportMetric label={isEn ? "Strong evidence" : "强证据"} value={report.metrics.strong_evidence} />
        <ReportMetric label={isEn ? "Ready for outreach" : "可外联"} value={report.metrics.ready_for_outreach} />
        <ReportMetric label={isEn ? "Needs scheduling" : "待约面"} value={report.metrics.needs_scheduling} />
      </div>
      {report.source_mix.length > 0 && (
        <div className="mt-4 rounded-2xl border border-black/10 bg-white/72 p-4">
          <p className="text-sm font-semibold text-gray-900">{isEn ? "Source mix" : "来源构成"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {report.source_mix.slice(0, 8).map((item) => (
              <span key={item.source_type} title={item.tooltip} className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 ring-1 ring-black/10">
                {item.label} · {item.count}
              </span>
            ))}
          </div>
        </div>
      )}
      {report.top_candidates.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {report.top_candidates.map((candidate) => (
            <article key={candidate.name} className="rounded-2xl border border-black/10 bg-white/72 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{candidate.name}</h3>
                  {candidate.role && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{candidate.role}</p>}
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                  {candidate.match_score}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-gray-700">{candidate.evidence_summary}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <QualityPill value={candidate.evidence_quality} locale={locale} />
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                  {candidate.outreach_status}
                </span>
              </div>
              {candidate.primary_risk && <p className="mt-2 text-xs leading-relaxed text-amber-700">{candidate.primary_risk}</p>}
              <p className="mt-2 text-xs leading-relaxed text-blue-800">{candidate.next_action}</p>
            </article>
          ))}
        </div>
      )}
      {(report.risks.length > 0 || report.next_actions.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {report.risks.length > 0 && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-sm font-semibold text-amber-900">{isEn ? "Risks and evidence gaps" : "风险和证据缺口"}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-amber-800">
                {report.risks.map((risk) => <li key={risk}>{risk}</li>)}
              </ul>
            </div>
          )}
          {report.next_actions.length > 0 && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-sm font-semibold text-blue-900">{isEn ? "Recommended next actions" : "推荐下一步"}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-blue-900/80">
                {report.next_actions.map((action) => <li key={action}>{action}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </ResultSurface>
  );
}
```

In `web/app/r/[id]/page.tsx`, import and render the panel:

```ts
import {
  CandidateCard,
  CandidateComparisonView,
  CandidateProfileView,
  EvidenceGraphView,
  ShortlistDeliveryReportView,
  SmartReportPanel,
  TrustReportView,
  type Claim,
  type Candidate,
  type VerifyReport,
} from "@/components/result";
```

Then render before `ShortlistDeliveryReportView`:

```tsx
<SmartReportPanel result={talentResult} locale={locale} />
<ShortlistDeliveryReportView result={talentResult} locale={locale} />
```

- [ ] **Step 4: Run targeted wiring test**

Run: `node --test api-route-copy.test.mjs --test-name-pattern "public report renders SignalHire Smart Report"`

Expected: PASS.

## Task 3: Verification

**Files:**
- Existing tests only.

- [ ] **Step 1: Run Smart Report tests**

Run: `node --test smart-report.test.mjs api-route-copy.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run relevant recruiting regression tests**

Run: `node --test api-route-copy.test.mjs candidate-graph.test.mjs openjobs-provider.test.mjs gmail-outreach.test.mjs inbox-agent.test.mjs inbox-actions.test.mjs outreach-followups.test.mjs calendar-availability.test.mjs smart-report.test.mjs`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm --prefix web run build`

Expected: Next.js production build succeeds.
