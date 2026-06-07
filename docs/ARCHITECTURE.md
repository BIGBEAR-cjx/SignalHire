# Architecture

SignalHire is an evidence-first AI talent search workspace. The app turns a hiring brief into a queue-backed deep research job, normalizes the returned payload, and presents a shortlist with source-backed claims, feedback, and project iteration controls.

## System Map

```text
User brief
  -> web/ Next.js App Router UI
  -> cache/history lookup
  -> Insforge research_runs queue
  -> worker/ long-running Node process
  -> MiroMind Deep Research API
  -> normalized talent payload
  -> search UI, projects, shortlist, history, share report
```

## Runtime Parts

| Part | Responsibility |
|------|----------------|
| `web/` | Product UI, API routes, auth/session sync, cache-first search, status polling, projects, shortlist, history, public reports |
| `web/lib/miro.ts` | MiroMind prompt, streaming client, result parsing, and normalization guardrails |
| `web/lib/db.ts` | Insforge access for `research_runs`, queue state, history, feedback persistence, retry, cancel |
| `web/lib/research-loop.mjs` | Testable presentation helpers for live research state, feedback preview, project next steps, control room, and project search console |
| `web/components/ResearchTool.tsx` | Search workspace orchestration: run, stop, status polling, feedback-optimized next search, result rendering |
| `web/components/research-workspace.tsx` | Reusable UI panels for input, live process, feedback preview, timelines, errors, and share actions |
| `worker/` | Polls queued jobs, runs non-cached MiroMind research outside serverless timeouts, writes progress/result/error back to Insforge |
| `docs/` | Verification, database notes, demo guide, implementation specs, and iteration plans |

## Data Flow

1. The user submits a hiring brief in `web/components/ResearchTool.tsx`.
2. `/api/search` checks built-in cache/history and creates a queued `research_runs` row for non-cached live research.
3. The browser polls `/api/status` and renders status through `buildResearchLoopView()`.
4. `worker/index.mjs` claims queued rows and calls the MiroMind OpenAI-compatible API.
5. Streaming research steps update search/fetch counters and recent work.
6. Final model output is normalized into the SignalHire talent payload shape.
7. The UI renders shortlist, talent map, evidence graph, evidence quality, share report, shortlist actions, and project controls.
8. Feedback choices are persisted into `research_runs.result.search_feedback` and can generate a next-round optimized search input.

## Core Product Logic

### Search Visibility

`buildResearchLoopView()` composes feed events, live counters, and job status into:

- current phase and detail
- active search/fetch cards
- search/fetch counts
- recent research items
- source coverage chips for GitHub, papers, company pages, and public web
- evidence timeline
- stop-action availability

### Feedback Loop

`buildFeedbackOptimizationPreview()` requires precision and satisfaction before the next-round search can run. The preview turns choices such as weak evidence, too broad, too few, wrong seniority, wrong direction, or wrong location into concrete optimization actions.

### Project Iteration

`buildProjectNextSteps()` and related project helpers summarize candidate pool state, filters, research rounds, feedback, and next-search constraints so the project detail page can guide the next action without adding a separate workflow.

## Persistence Model

The app uses `research_runs` as the single queue/history/cache/share persistence surface. Search feedback is stored under `result.search_feedback`; there is no separate feedback table. This keeps the schema simple while preserving the next-round optimization context beside the run that produced it.

## Verification Layers

| Layer | Commands |
|-------|----------|
| Research loop helpers | `node --test research-loop.test.mjs` |
| Research progress compatibility | `node --test research-progress.test.mjs` |
| Talent payload normalization | `node --test talent-profile.test.mjs` |
| Copy and localization | `node --test i18n.test.mjs` |
| Next.js production build | `cd web && npm run build` |
| Whitespace and patch hygiene | `git diff --check` |
| Production reachability | `curl -I -L https://signal-hire-eight.vercel.app` |

Full environment-dependent checks are listed in `docs/verification.md`.
