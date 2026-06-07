# Demo Guide

Last checked: 2026-06-07

## Public URLs

- Production demo: https://signal-hire-eight.vercel.app
- Search workspace: https://signal-hire-eight.vercel.app/app/search

Both URLs returned HTTP 200 during the latest repository cleanup.

## What to Demo

1. Open the production demo and enter the app.
2. Go to the search workspace.
3. Start with a cached sample query for a fast walkthrough.
4. Show the research process panel: phase, current search/fetch work, source coverage, recent items, and stop control.
5. Review the shortlist: match reasons, evidence quality, source links, claims, and risk signals.
6. Select feedback choices for precision, satisfaction, main issue, and next-round direction.
7. Confirm the optimization preview before running the next search.
8. Open a project detail page to show candidate pool state, research rounds, feedback learning, and next-step suggestions.
9. Open a share report path when seeded data is available to show public report delivery.

## Judge Checklist

| Requirement | Evidence |
|-------------|----------|
| Demo is reachable | `curl -I -L https://signal-hire-eight.vercel.app` returns HTTP 200 |
| Core app is reachable | `curl -I -L https://signal-hire-eight.vercel.app/app/search` returns HTTP 200 |
| Search is inspectable | `ResearchProcessPanel` renders live phase, search/fetch stats, source coverage, recent work, and stop action |
| Feedback loop exists | `FeedbackOptimizationPreview` requires core choices and previews next-round changes |
| Project iteration exists | Project detail uses next-step suggestions, research rounds, feedback summaries, and next-search context |
| Evidence is auditable | Result UI surfaces claims, verdicts, source links, evidence coverage, and quality labels |

## Smoke Commands

```bash
curl -I -L https://signal-hire-eight.vercel.app
curl -I -L https://signal-hire-eight.vercel.app/app/search
```

Expected: HTTP 200.

Live non-cached research requires a logged-in production session plus active Insforge and worker credentials. Local and production live-job checks are documented in `docs/verification.md`.
