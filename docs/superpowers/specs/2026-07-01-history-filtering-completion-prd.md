# PRD: History Filtering Completion

## 1. Product Goal

Make History a working recovery and reuse surface for recruiters. A user should be able to find a prior role/search run, understand why it appears in the current filter set, and reopen the right next action without scanning a raw chronological list.

## 2. Current Baseline

Already present:
- `/api/history` supports server-side filters through `historyRuns`.
- `/app/history` supports keyword, type, status, time range, role, evidence filter, quick filters, URL persistence, and pagination.
- `buildHistoryRunView` returns project name, next action, evidence summary, and `needs_action`.

Remaining problem:
- Active filters are not represented as removable chips, so users can get stuck in a filtered state.
- `needs_action` is functionally supported, but the product explanation is thin.
- Evidence summary exists, but the list does not clearly distinguish “recover this role” from “inspect evidence gap”.

## 3. Target Users

- Recruiter working across many open roles.
- Agency operator who needs to reopen client delivery work.
- Hiring partner who wants the latest status of a role without rerunning search.

## 4. User Stories

1. As a recruiter, I can see active filters as chips and remove one filter without clearing the entire page.
2. As a recruiter, I can filter to “Needs action” and understand whether the reason is failed/canceled run, evidence gaps, or candidates needing verification.
3. As a recruiter, I can jump back to the role workspace when a run is tied to a role.
4. As a bilingual user, filter labels and empty states work in Chinese and English.

## 5. Functional Requirements

### P0 Active Filter Summary

- Add a pure helper that converts normalized filters into display chips.
- Chips must support:
  - keyword query
  - kind
  - status, including `needs_action`
  - time range
  - role/project
  - evidence filter
- UI must render chips near the filter bar.
- Each chip can be removed independently.
- The clear-all action remains available.

### P1 Needs Action Explanation

- Each history item that has `needs_action` should expose a compact reason:
  - failed or canceled run
  - evidence gaps
  - candidates needing verification
- The list card should display the reason without expanding the card height unpredictably.

### P1 Role Recovery

- When a run has `project_id`, primary action remains “Continue role”.
- Role name must be visible in the card metadata.
- Role filter must remain stable after refresh and load-more.

## 6. Data Contract

Add to `HistoryRunView`:

```ts
needs_action_reasons?: string[];
```

Add helper:

```ts
buildHistoryFilterChips(filters, projects, { locale })
```

Expected chip shape:

```ts
{
  key: string;
  label: string;
  clearPatch: Record<string, string>;
}
```

## 7. Acceptance Criteria

- Active filter chips render for q, kind, status, range, project, and evidence.
- Removing one chip only resets that filter.
- Needs-action cards show at least one reason when `needs_action` is true.
- `node --test history-filters.test.mjs` passes.
- `npm --prefix web run build` passes after integration.

## 8. Out Of Scope

- New database table.
- Full text search index.
- Saved search views.
- Team-level shared history.

