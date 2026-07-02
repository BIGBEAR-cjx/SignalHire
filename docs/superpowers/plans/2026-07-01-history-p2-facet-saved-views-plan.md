# History P2 Facet Counts and Saved Views Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining History P2 work: more trustworthy facet counts and compact saved-view management.

**Architecture:** Keep all data inside the existing `/api/history` flow and localStorage saved views. Split the work into one backend counting task and one frontend saved-view layout task so they can be implemented independently.

**Tech Stack:** Next.js App Router, React client components, Node test runner, existing `web/lib/history.mjs` and `web/lib/db.ts` helpers.

---

## Task Table

| Priority | Task | Owner | Files | Verify |
| --- | --- | --- | --- | --- |
| P2 | Precise History facet counts | Backend/data agent | `web/lib/db.ts`, `history-filters.test.mjs` | `node --test history-filters.test.mjs` |
| P2 | Saved views overflow management | Frontend/interaction agent | `web/app/app/history/page.tsx`, `history-filters.test.mjs` | `node --test history-filters.test.mjs`; `npm --prefix web run build` |

## Task 1: Precise History Facet Counts

**Files:**
- Modify: `web/lib/db.ts`
- Modify: `history-filters.test.mjs`

- [ ] Keep the main paginated `historyRuns` list query behavior intact.
- [ ] Add a cursor-independent facet query using the same base filters except selected facet filters.
- [ ] Build `facetCounts` from the facet query's History run views.
- [ ] Keep tenant scoping through `r.user_id = $1`.
- [ ] Preserve derived evidence filtering and `nextCursor` behavior.
- [ ] Add a test/source assertion that facet counts are not built only from the paginated `rows`.
- [ ] Run `node --test history-filters.test.mjs`.

## Task 2: Saved Views Overflow Management

**Files:**
- Modify: `web/app/app/history/page.tsx`
- Modify: `history-filters.test.mjs`

- [ ] Add a small inline saved view limit of 4.
- [ ] Render the most recent 4 saved views inline.
- [ ] Render an overflow toggle only when saved views exceed 4.
- [ ] Render overflow views in a compact wrapped panel.
- [ ] Keep apply/delete actions and accessible labels for both inline and overflow views.
- [ ] Add a test/source assertion for the inline limit and overflow control.
- [ ] Run `node --test history-filters.test.mjs`.

## Self-Review

- Both tasks preserve the current API and localStorage model.
- No schema migration is required.
- No auto-send or outreach behavior is touched.
- Both tasks can be implemented independently, then integrated by the main agent.

