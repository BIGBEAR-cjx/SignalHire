# SignalHire

*Find signals. Not resumes.*

**Competitors hand you 500 résumés. We hand you 5 people who have already been fact-checked.**
> 竞品给你 500 份简历。我们给你 5 个**已被核实过**的人。

A technical recruiting tool built on the **MiroMind Deep Research** API. You describe a role in one
sentence; SignalHire searches the open web for real candidates and **cross-verifies every claim they
make** against multiple independent public sources — labelling each as ✅ verified, ⚠️ unverified, or
❌ contradicted, with a clickable evidence link for every verdict.

Built for **UCWS 2026 · MiroMind Deep Research Track**.

---

## The problem

The expensive part of hiring isn't *finding* people — it's *verifying* them. Résumés and LinkedIn
profiles routinely overstate ("core contributor", "5 years at a big tech company"). Existing AI
recruiting tools (Juicebox, Lessie) are strong on **breadth** (they find a lot) but weak on
**trust** (they don't check). SignalHire's edge is exactly that gap: honest, evidence-backed
verification.

## The "wow" moment

A real result from the `Senior Rust engineer who contributed to Tokio` query:

> **Matilda Smeds** — claims to have contributed to Tokio
> - ⚠️ *"Has contributed to the Tokio project"* → only a fork on her profile, no merged PRs found
> - ❌ *"Has substantial code merged into the core tokio-rs/tokio repo"* → 89 contributions in the
>   last year, but **all to her own repos** — none to `tokio-rs/tokio`
>
> Compare with **Carl Lerche** (Tokio's creator) and **Alice Ryhl** (Tokio core maintainer), whose
> claims come back ✅ verified with Wikipedia, the official Tokio blog, and conference pages as proof.

Every verdict carries a real, clickable source URL. That turns "the AI is making things up" into
"the AI showed its evidence."

## Two modes

| Mode | Input | Output |
|------|-------|--------|
| **Search** (搜人) | A role description | 3 real, individually-named candidates, each with cross-verified claims + evidence |
| **Verify** (验证 / "打脸") | A candidate's self-described bio / résumé | A trust report: every claim judged verified/contradicted/unverified, plus 🚩 red flags |

## How it works

```
One sentence (role or bio)
  └─> web/ Next.js app checks the built-in cache first
  └─> cache miss creates an Insforge research_runs row with status='queued'
  └─> worker/ claims the row and sends a single prompt to the MiroMind Deep Research agent, which autonomously:
        · searches the open web (~85 searches/query) and fetches pages (~15/query)
        · extracts each claim and cross-checks it against multiple independent sources
        · streams progress and returns a verdict + evidence URLs as one clean JSON object
  └─> normalizeResult() guardrail: enforces the 3 allowed verdicts and drops any
      "evidence" that is just a search-results URL (a search link is not proof)
  └─> UI renders candidate cards with ✅/⚠️/❌ badges + clickable evidence links
```

MiroMind *is* the deep-research engine — one API call does the searching, fetching, and
cross-verification itself. No separate scraper or search loop is needed.

### What this uses from MiroMind

- **Autonomous deep research in one call** — a single `chat/completions` request triggers dozens of
  web searches and page fetches and returns synthesized, cross-checked findings.
- **Streaming (`stream: true`)** — required: a multi-minute non-streaming request gets dropped by
  proxies as an idle connection. Streaming also exposes the live `reasoning_steps`
  (`web_search` / `fetch_url_content`), which we surface as real-time research progress.
- **OpenAI-compatible API** — model `mirothinker-1-7-deepresearch-mini` at `https://api.miromind.ai/v1`.

## Current architecture

SignalHire currently runs as three runtime pieces:

1. `web/` Next.js app: serves the product UI, soft login/auth modal, cached demo examples, history,
   share pages, and API routes that enqueue cache misses.
2. Insforge persistence and queue: `research_runs` stores cached examples, user history, shareable
   report links, queued work, progress, results, and errors.
3. `worker/` long-running Node process: polls `research_runs`, claims queued rows, runs MiroMind
   research without a serverless timeout, and writes progress/results back to Insforge.

The app is cache-first. Built-in demo examples and fuzzy matches should work immediately without
live MiroMind calls. Non-cached inputs require Insforge DB access plus a running worker with
MiroMind credentials.

## Quick start

Requirements: **Node 22+** (uses `--env-file`).

### 1. Configure the web environment

Create `web/.env.local` from the example and fill in the services you want to use:

```bash
cp web/.env.example web/.env.local
```

MiroMind variables are required by the worker for non-cached live research. Insforge server-side
variables are required for history, share links, and queued live research. The public
`NEXT_PUBLIC_INSFORGE_API_BASE_URL` value is used by the browser auth SDK.

> `.env.local` is gitignored. Never commit real keys.

### 2. Run the web app

```bash
cd web
npm ci
npm run dev
```

The built-in example chips in Search and Verify modes return pre-cached, fact-checked results
without the worker.

### 3. Run the worker for live research

```bash
cd worker
npm ci
node --env-file=../web/.env.local index.mjs
```

### 4. Validate production build

```bash
cd web
npm run lint
npm run build
```

## Project structure

```
web/            Next.js app (App Router + Tailwind)
  lib/cache.ts  Pre-cached, verified demo results + fuzzy query matching
  lib/db.ts     Insforge server-side access to research_runs
  lib/miro.ts   Server-side MiroMind client + prompts + normalizeResult() guardrail
  app/api/      Search, verify, status, history, and auth session routes
  app/r/[id]/   Shareable report page backed by research_runs
worker/         Long-running Node worker for queued non-cached research
```

## Demo notes

Live deep research is slow (a search query takes ~4-10 minutes; verification ~2 minutes) — too long
to wait for on stage. So the web app is **cache-first**: example queries return verified, pre-computed
results in ~0.1s. Free-text queries that fuzzily match a cached one are served instantly too.
Anything else is queued in Insforge and processed by the worker.

---

*UCWS 2026 — MiroMind Deep Research Track.*
