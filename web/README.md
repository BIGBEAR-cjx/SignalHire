# SignalHire Web App

This directory contains the Next.js App Router frontend and API routes for SignalHire.

## Responsibilities

- Product UI for search, projects, shortlist, history, settings, verification, and public reports.
- API routes for search, verify, status polling, cancel, retry, feedback, projects, shortlist, history, auth session sync, worker health, and outreach drafts.
- Domain helpers for MiroMind research, Insforge persistence, localization, evidence quality, research-loop presentation, and talent payload normalization.
- Scripts for schema checks, live-job smoke tests, retry checks, worker-health checks, and database seeding.

## Quick Start

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open http://localhost:3000.

Cached sample searches can be used without a live worker. Non-cached live research requires Insforge and MiroMind credentials plus a running worker process from `../worker`.

## Useful Commands

```bash
npm run lint
npm run build
npm run verify:schema
npm run verify:worker-health
npm run verify:live
npm run verify:retry
```

Environment-dependent checks need `.env.local` values. See `../docs/verification.md` for expected outputs and production smoke-test variants.

## Key Files

| Path | Purpose |
|------|---------|
| `app/app/search/page.tsx` | Main search workspace route |
| `components/ResearchTool.tsx` | Search run orchestration, polling, stop, feedback loop, results |
| `components/research-workspace.tsx` | Shared panels for input, process, feedback, timelines, errors, sharing |
| `components/result.tsx` | Evidence-first talent result and public report rendering |
| `lib/miro.ts` | MiroMind client, prompt, stream handling, output parsing |
| `lib/db.ts` | Insforge persistence and research queue helpers |
| `lib/research-loop.mjs` | Testable research-loop, feedback, and project iteration view models |
| `lib/talent-profile.mjs` | Talent payload normalization and evidence view helpers |
| `lib/i18n.mjs` | Chinese/English fixed copy |
| `scripts/` | Production and local verification utilities |

## Production Demo

- Demo: https://signal-hire-eight.vercel.app
- Search workspace: https://signal-hire-eight.vercel.app/app/search
