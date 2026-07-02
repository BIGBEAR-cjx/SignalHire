# P2 PRD: History Facet Counts And Saved Views

日期：2026-07-01

## 1. Summary

`History Facet Counts And Saved Views` makes History useful for repeated recruiting operations. Users can see counts next to status/evidence/gap filters and save local filter presets for recurring work modes.

## 2. Product Promise

> Turn History into a reusable recruiting memory board, not just a run list.

中文表达：

> 把历史记录变成可复用的招聘记忆面板，而不是一次性列表。

## 3. Users And Jobs

### Recruiter

Job：每天打开 History 快速找到“需要处理”“有外联草稿”“有证据缺口”的搜索。

成功体验：能一眼看到每类有多少条，并保存常用筛选视图。

### Hiring Manager

Job：复盘某类岗位或搜索为什么还不能交付。

成功体验：用 saved view 复用同一套 evidence filters。

## 4. Scope

### In Scope

- `/api/history` returns facet counts for:
  - status
  - kind
  - evidence
  - gap
  - needs action
- History page displays compact counts in filter options / quick filters.
- Local saved views:
  - save current filters with a name
  - apply saved view
  - delete saved view
  - stored in `localStorage`
- URL remains source of truth for active filters.

### Out Of Scope

- Server-side saved views.
- Cross-device sync.
- New database table.
- Analytics dashboard.

## 5. Data Contract

```ts
type HistoryFacetCounts = {
  status: Record<string, number>;
  kind: Record<string, number>;
  evidence: Record<string, number>;
  gap: Record<string, number>;
  needs_action: number;
};

type SavedHistoryView = {
  id: string;
  name: string;
  filters: {
    q: string;
    kind: string;
    status: string;
    range: string;
    projectId: string;
    evidence: string;
    gap: string;
  };
  created_at: string;
};
```

## 6. Acceptance Criteria

- Facet counts are returned without adding DB schema.
- Counts respect tenant scope and the same base query result cap as History.
- Saved views survive page refresh in the same browser.
- Applying a saved view updates URL and refetches History.
- Deleting a saved view removes it from localStorage.

## 7. Metrics

- Saved views created.
- Saved views applied.
- Filter chips removed.
- Needs-action histories reopened.
