# Engineering Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the project reproducible and verifiable by cleaning lint errors, documenting required infrastructure, and defining a repeatable local/deployment checklist without changing product behavior.

**Architecture:** Keep the existing three-part shape: Next.js web app, Insforge-backed persistence/queue, and a long-running Node worker for MiroMind research. This plan only tightens types, documentation, and verification around the current implementation.

**Tech Stack:** Next.js 16.2.6, React 19.2.4, TypeScript, Tailwind CSS 4, Insforge SDK, Node ESM worker, MiroMind OpenAI-compatible streaming API.

---

## File Structure

- Modify `web/app/page.tsx`: replace loose client-side `any` state/event parsing with local result and stream-event types.
- Modify `web/lib/miro.ts`: type MiroMind stream chunks and normalized claim structures enough to satisfy lint while preserving permissive runtime parsing.
- Modify `README.md`: align setup instructions with the current web + worker + Insforge architecture.
- Modify `web/.env.example`: make environment variable roles explicit for web, auth, DB, and MiroMind.
- Modify `worker/README.md`: clarify worker startup, required variables, and how it interacts with `research_runs`.
- Create `docs/insforge-research-runs.md`: document the DB table contract used by `web/lib/db.ts`, `worker/index.mjs`, and `web/scripts/seed-db.mjs`.
- Create `docs/verification.md`: document local checks and live end-to-end checks, separating static checks from checks requiring real credentials.

---

### Task 1: Clean TypeScript Lint Errors

**Files:**
- Modify: `web/app/page.tsx`
- Modify: `web/lib/miro.ts`

- [ ] **Step 1: Inspect the current lint failures**

Run:

```bash
cd /Users/jianxiongchen/Desktop/signalhire/web
npm run lint
```

Expected: FAIL with `@typescript-eslint/no-explicit-any` in `app/page.tsx` and `lib/miro.ts`.

- [ ] **Step 2: Add client result and stream event types in `web/app/page.tsx`**

Near the existing `FeedItem` and `HistoryItem` types, add:

```ts
import {
  CandidateCard,
  TrustReportView,
  type Candidate,
  type VerifyReport,
} from "@/components/result";

type SearchResult = { candidates?: Candidate[] };
type AppResult = SearchResult | VerifyReport;
type RunStats = { searches: number; fetches: number; cached?: boolean };
type ResearchStepEvent = {
  type: "step";
  kind: "search" | "fetch";
  info: string;
  searches: number;
  fetches: number;
};
type ResearchDoneEvent = {
  type: "done";
  data: AppResult;
  stats?: RunStats | null;
  runId?: string | null;
};
type ResearchErrorEvent = { type: "error"; error?: string };
type ResearchEvent = ResearchStepEvent | ResearchDoneEvent | ResearchErrorEvent;
type QueueResponse = { queued?: boolean; jobId?: string; error?: string };
```

Replace the current `result` and `stats` state types:

```ts
const [result, setResult] = useState<AppResult | null>(null);
const [stats, setStats] = useState<RunStats | null>(null);
```

- [ ] **Step 3: Parse NDJSON events as `ResearchEvent`**

In `run()`, replace the loose event declaration:

```ts
let ev: ResearchEvent;
try { ev = JSON.parse(line) as ResearchEvent; } catch { continue; }
```

Keep the existing branch behavior. `ev.type` narrows the union, so `ev.searches`, `ev.data`, and `ev.error` remain available in the relevant branch.

- [ ] **Step 4: Type the queued JSON response**

In the non-NDJSON branch, replace the untyped fallback parse with:

```ts
const j = (await res.json().catch(() => ({}))) as QueueResponse;
```

Keep the existing `res.ok`, `j.queued`, and `j.jobId` behavior.

- [ ] **Step 5: Add permissive MiroMind stream types in `web/lib/miro.ts`**

Near the existing `Verdict` type, add:

```ts
type MiroReasoningStep =
  | { type: "web_search"; web_search?: { search_keywords?: unknown } }
  | { type: "fetch_url_content"; fetch_url_content?: { url?: unknown } }
  | { type: "thinking" }
  | { type?: string };

type MiroStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning_steps?: MiroReasoningStep[];
    };
  }>;
};

type EvidenceLike = { url?: unknown };
type ClaimLike = {
  verdict?: unknown;
  evidence?: EvidenceLike[];
};
type SearchResultLike = { candidates?: Array<{ claims?: ClaimLike[] }> };
type VerifyResultLike = { claims?: ClaimLike[] };
type NormalizableResult = SearchResultLike & VerifyResultLike;
```

- [ ] **Step 6: Replace `any` in stream parsing and normalization**

In `streamResearch`, replace:

```ts
let obj: MiroStreamChunk;
try { obj = JSON.parse(data) as MiroStreamChunk; } catch { continue; }
```

Change `parseJson` to:

```ts
export function parseJson(content: string): unknown {
  try { return JSON.parse(content) as unknown; } catch {}
  const m = content.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]) as unknown; } catch {} }
  return null;
}
```

Change `normalizeClaims` to:

```ts
function normalizeClaims(claims: ClaimLike[]): void {
  for (const cl of claims ?? []) {
    cl.evidence = (cl.evidence ?? []).filter((e) => e?.url && !isSearchUrl(e.url));
    let v = String(cl.verdict ?? "").toLowerCase().trim();
    if (!VERDICTS.includes(v as Verdict)) v = "unverified";
    if (v === "verified" && cl.evidence.length === 0) v = "unverified";
    cl.verdict = v;
  }
}
```

Change `normalizeResult` to:

```ts
export function normalizeResult<T>(data: T): T {
  if (!data || typeof data !== "object") return data;
  const d = data as NormalizableResult;
  if (Array.isArray(d.candidates)) {
    for (const c of d.candidates) normalizeClaims(c?.claims ?? []);
  }
  if (Array.isArray(d.claims)) normalizeClaims(d.claims);
  return data;
}
```

- [ ] **Step 7: Verify lint and build**

Run:

```bash
cd /Users/jianxiongchen/Desktop/signalhire/web
npm run lint
npm run build
```

Expected: both PASS. If `npm run build` fails in a sandbox with a Turbopack port-binding panic, rerun it outside the sandbox; the known environment-only failure says `binding to a port` and `Operation not permitted`.

- [ ] **Step 8: Commit Task 1**

```bash
cd /Users/jianxiongchen/Desktop/signalhire
git add web/app/page.tsx web/lib/miro.ts
git commit -m "chore: clean TypeScript lint baseline"
```

---

### Task 2: Document the Current Runtime Architecture

**Files:**
- Modify: `README.md`
- Modify: `web/.env.example`
- Modify: `worker/README.md`

- [ ] **Step 1: Update `README.md` architecture section**

Replace the older project structure and quick-start wording with content that describes:

```md
## Current architecture

SignalHire has three runtime pieces:

1. `web/` - Next.js app. It serves the landing page, auth modal, search/verify tool, cached demo results, history, report sharing, and API routes.
2. Insforge - persistence and queue. The `research_runs` table stores cached reports and queued/running/done/error jobs.
3. `worker/` - long-running Node process. It polls queued jobs, runs MiroMind deep research, writes progress, and saves final results.

The web app is cache-first. Built-in demo examples work without live MiroMind calls. Non-cached inputs require Insforge DB and the worker.
```

- [ ] **Step 2: Update `README.md` setup commands**

Ensure the quick start includes these exact commands:

```bash
cd web
npm ci
npm run dev
```

For production validation:

```bash
cd web
npm run lint
npm run build
```

For worker setup:

```bash
cd worker
npm ci
node --env-file=../web/.env.local index.mjs
```

- [ ] **Step 3: Update `web/.env.example` comments**

Keep the existing variables, but group them:

```ini
# MiroMind deep research. Required by the worker for non-cached live research.
MIROMIND_API_KEY=your-miromind-api-key
MIROMIND_BASE_URL=https://api.miromind.ai/v1
MIROMIND_MODEL=mirothinker-1-7-deepresearch-mini

# Insforge server-side DB and queue access. Required for history, share links, and queued live research.
INSFORGE_API_BASE_URL=https://your-project.insforge.app
INSFORGE_API_KEY=your-insforge-access-key

# Insforge client auth base URL. Public value used by the browser auth SDK.
NEXT_PUBLIC_INSFORGE_API_BASE_URL=https://your-project.insforge.app
```

- [ ] **Step 4: Update `worker/README.md` with the runtime contract**

Add:

```md
## Runtime contract

The worker expects `research_runs` rows with `status='queued'`. It claims one row by changing it to `running`, streams MiroMind progress into `progress`, and finishes with either:

- `status='done'`, `result`, `stats`, `summary`
- `status='error'`, `error`

It is safe to run one worker for the demo. Multiple workers should also be safe because claiming updates only rows still marked `queued`.
```

- [ ] **Step 5: Verify documentation references**

Run:

```bash
cd /Users/jianxiongchen/Desktop/signalhire
rg "middleware|登录墙|无数据库|无登录|~/headhunter"
```

Expected: no stale instructions that contradict the current soft-login + Insforge queue architecture, except historical notes if clearly labeled as historical.

- [ ] **Step 6: Commit Task 2**

```bash
cd /Users/jianxiongchen/Desktop/signalhire
git add README.md web/.env.example worker/README.md
git commit -m "docs: align setup with web worker architecture"
```

---

### Task 3: Add the Insforge Table Contract

**Files:**
- Create: `docs/insforge-research-runs.md`

- [ ] **Step 1: Create the DB contract doc**

Create `docs/insforge-research-runs.md` with:

```md
# Insforge `research_runs` Contract

`research_runs` is both the report cache and the async job queue.

## Required columns

| Column | Purpose |
| --- | --- |
| `id` | Primary key used by `/r/[id]` and `/api/status?id=...`. |
| `cache_key` | Unique key in the format `<kind>:<flat_key>`. |
| `kind` | `search` or `verify`. |
| `flat_key` | Normalized query text from `flatten()`. |
| `query_text` | Original role query or candidate bio. |
| `label` | Short display label for history. |
| `summary` | Short completion summary. |
| `result` | JSON result rendered by `CandidateCard` or `TrustReportView`. |
| `stats` | JSON object such as `{ "searches": 0, "fetches": 0 }`. |
| `status` | `queued`, `running`, `done`, or `error`. |
| `progress` | JSON object `{ "searches": number, "fetches": number, "recent": [...] }`. |
| `error` | Error message for failed jobs. |
| `created_at` | Creation timestamp. Used by the worker to claim oldest queued jobs first. |
| `updated_at` | Last state change timestamp. |

## Required constraints

- `cache_key` must be unique.
- `id` must be stable and URL-safe.

## State flow

`web/app/api/search/route.ts` and `web/app/api/verify/route.ts` create or update rows as `queued`.

`worker/index.mjs` changes `queued -> running -> done` or `queued -> running -> error`.

`web/app/api/status/route.ts` reads `status`, `progress`, `result`, and `error`.

`web/app/r/[id]/page.tsx` reads completed rows by `id`.

## Seeded demo rows

Run this after creating the table:

```bash
cd web
node --env-file=.env.local scripts/seed-db.mjs
```

The seed script upserts the built-in demo reports so history and share links work immediately.
```

- [ ] **Step 2: Cross-check all documented columns against code**

Run:

```bash
cd /Users/jianxiongchen/Desktop/signalhire
rg "research_runs|cache_key|flat_key|query_text|status|progress|created_at|updated_at" web worker
```

Expected: every field read or written by `web/lib/db.ts`, `web/scripts/seed-db.mjs`, and `worker/index.mjs` appears in the contract.

- [ ] **Step 3: Commit Task 3**

```bash
cd /Users/jianxiongchen/Desktop/signalhire
git add docs/insforge-research-runs.md
git commit -m "docs: define research runs table contract"
```

---

### Task 4: Add a Verification Checklist

**Files:**
- Create: `docs/verification.md`

- [ ] **Step 1: Create static verification commands**

Create `docs/verification.md` with:

```md
# Verification

## Static checks

Run after every code change:

```bash
cd web
npm run lint
npm run build
```

Run after worker changes:

```bash
cd worker
node --check index.mjs
node --check lib.mjs
```

## Known local environment note

In restricted sandboxes, `next build` can fail with a Turbopack panic that mentions `binding to a port` and `Operation not permitted`. Re-run the same command in an unrestricted local terminal before treating it as a product build failure.
```

- [ ] **Step 2: Add credential-dependent checks**

Append:

```md
## Checks requiring real credentials

These require `web/.env.local` with Insforge and MiroMind values.

### Seed demo reports

```bash
cd web
node --env-file=.env.local scripts/seed-db.mjs
```

Expected: all three JSON seed files print `ok`.

### Run the web app

```bash
cd web
npm run dev
```

Expected:

- Landing page loads at `http://localhost:3000`.
- Built-in search and verify examples return cached results.
- After seeding, history shows the seeded rows.
- Shared report links open `/r/[id]`.

### Run the worker

```bash
cd worker
node --env-file=../web/.env.local index.mjs
```

Expected:

- Logs include `SignalHire worker 启动`.
- Non-cached queued rows eventually become `done` or `error`.
- `/api/status?id=<id>` reflects progress while running.
```

- [ ] **Step 3: Commit Task 4**

```bash
cd /Users/jianxiongchen/Desktop/signalhire
git add docs/verification.md
git commit -m "docs: add verification checklist"
```

---

### Task 5: Final Baseline Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run web checks**

```bash
cd /Users/jianxiongchen/Desktop/signalhire/web
npm run lint
npm run build
```

Expected: both PASS.

- [ ] **Step 2: Run worker syntax checks**

```bash
cd /Users/jianxiongchen/Desktop/signalhire/worker
node --check index.mjs
node --check lib.mjs
```

Expected: both commands exit with code 0 and no output.

- [ ] **Step 3: Confirm no uncommitted files**

```bash
cd /Users/jianxiongchen/Desktop/signalhire
git status --short
```

Expected: no output.

- [ ] **Step 4: Record residual dependency audit risk**

Run:

```bash
cd /Users/jianxiongchen/Desktop/signalhire/web
npm audit --audit-level=moderate
```

Expected: if the same `2 moderate severity vulnerabilities` remain, do not run `npm audit fix --force` in this baseline task. Record them in the final handoff because `--force` can introduce breaking dependency changes.

---

## Self-Review

- Spec coverage: covers lint baseline, build verification, worker syntax verification, README/env/worker docs, Insforge table contract, and live verification checklist.
- Placeholder scan: no placeholder markers; every task has exact files and commands.
- Type consistency: uses existing project types from `components/result.tsx` and preserves existing state names, route behavior, and DB fields.
- Scope control: no UI redesign, auth behavior change, deployment automation, dependency upgrade, or product feature work is included.
