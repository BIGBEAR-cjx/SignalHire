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
  └─> a single prompt to the MiroMind Deep Research agent, which autonomously:
        · searches the open web (~85 searches/query) and fetches pages (~15/query)
        · extracts each claim and cross-checks it against multiple independent sources
        · returns a verdict + evidence URLs as one clean JSON object
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

## Quick start

Requirements: **Node 22+** (uses `--env-file`).

### 1. Set your MiroMind credentials

Create `.env.local` in the repo root (and a copy in `web/`):

```bash
cp .env.example .env.local
cp .env.example web/.env.local
# then edit both and paste your key
```

```ini
MIROMIND_API_KEY=your-key-here
MIROMIND_BASE_URL=https://api.miromind.ai/v1
MIROMIND_MODEL=mirothinker-1-7-deepresearch-mini
```

> `.env.local` is gitignored — never commit your key.

### 2. Run from the command line

```bash
# Search for candidates (deep research, ~4-10 min)
node --env-file=.env.local engine.mjs "Senior Rust engineer who contributed to Tokio"

# Verify a candidate's bio (~2 min) — "打脸" mode
node --env-file=.env.local verify.mjs "Jordan Smith — I created the Tokio runtime, PhD from Stanford..."
```

### 3. Run the web app

```bash
cd web
npm install
npm run dev      # http://localhost:3000
```

In the web app, the **example chips** in Search mode return pre-cached, fact-checked results
instantly (no waiting on live research) — see "Demo notes" below.

## Project structure

```
miro.mjs        Shared MiroMind streaming client + JSON parsing + normalizeResult() guardrail
engine.mjs      CLI: search mode
verify.mjs      CLI: verify ("打脸") mode
web/            Next.js app (App Router + Tailwind)
  lib/miro.ts   Server-side MiroMind client + prompts + guardrail (web equivalent of miro.mjs)
  lib/cache.ts  Pre-cached, verified demo results + fuzzy query matching
  app/api/      /api/search and /api/verify routes
  app/page.tsx  Single-page UI: dual mode, verdict badges, evidence links
```

## Demo notes

Live deep research is slow (a search query takes ~4-10 minutes; verification ~2 minutes) — too long
to wait for on stage. So the web app is **cache-first**: example queries return verified, pre-computed
results in ~0.1s, which also serves as a fallback if the live API times out. Free-text queries that
fuzzily match a cached one are served instantly too; anything else runs live.

---

*UCWS 2026 — MiroMind Deep Research Track.*
