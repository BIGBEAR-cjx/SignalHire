# History Precise Facet Counts PRD

## Background

History is becoming SignalHire's recruiting memory surface. The current facet counts are useful, but they are derived from the page's fetched run window. When the user filters by status, evidence, or a saved view, counts can look like a page count instead of a management count.

## Goal

Make History facet counts reflect the full matching result set for the active base query, not just the currently loaded page.

## Users

- Recruiter reusing previous searches and verification runs.
- Agency operator checking which runs need action.
- Hiring workflow owner comparing search, verify, evidence, and gap states.

## Requirements

### P0

- Counts must remain tenant-scoped by `user_id`.
- Counts must not require a schema migration.
- Existing History list pagination must continue to work.

### P1

- Status and kind counts should be calculated from all records matching the current base filters: keyword, project, range, and cursor-independent scope.
- Evidence, gap, and needs-action counts should be calculated from the same base scope after building History run views.
- Applying a facet should not make unrelated facet counts collapse to zero solely because that facet is selected.
- Derived evidence filters should continue scanning enough records to find matching runs and expose `nextCursor` when more rows may exist.

### P2

- Keep the implementation conservative: no new table, no background aggregate job, no saved-view server storage.
- Keep the current API shape: `/api/history` returns `facetCounts`.

## Non-Goals

- Real-time analytics dashboard.
- Cross-user or admin-wide reporting.
- Persistent server-side saved views.

## UX Notes

- Counts are management hints. They should be stable enough that recruiters trust quick filters and saved views.
- It is acceptable for counts to reflect the active base query, not every historical run in the workspace.

## Acceptance Criteria

- With `status=done`, `facetCounts.status.error` can still be non-zero when error runs match the same keyword/project/range base scope.
- With a derived evidence filter and no matches in the first scan window, `nextCursor` remains available when older rows may contain matches.
- Existing tests for History filters, chips, saved views, and API exposure still pass.
- `npm --prefix web run build` passes.

