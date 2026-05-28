# Research Job Reliability v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make non-cached research jobs explainable and recoverable with clearer status, worker stale recovery, bounded retries, and a manual retry path.

**Architecture:** A small shared `job-state.mjs` module defines queue status semantics for both the web app and worker. API routes expose richer status and retry controls, the worker uses the same helper for stale recovery and retry transitions, and the UI renders the returned status view.

**Tech Stack:** Node ESM, Next.js App Router route handlers, TypeScript client components, Insforge `research_runs`.

---

## Scope

- Add status semantics for `queued`, `running`, `retrying`, `done`, and `error`.
- Track `attempt_count`, `max_attempts`, `last_error`, `locked_at`, `started_at`, and `finished_at`.
- Recover stale `running` jobs after 10 minutes without progress.
- Retry transient worker failures until the max attempt count is reached.
- Add `/api/retry` for user-triggered retry of final `error` jobs.
- Update the UI to show job phase/detail and a retry button when retry is allowed.

## Verification

- `node --test job-state.test.mjs`
- `cd web && npm run lint`
- `cd web && npm run build`
- `cd worker && node --check index.mjs && node --check lib.mjs`
