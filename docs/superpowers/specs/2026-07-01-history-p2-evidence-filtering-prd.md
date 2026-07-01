# P2 PRD: History Evidence-First Filtering

日期：2026-07-01

## 1. Summary

`History Evidence-First Filtering` 把 History 从按时间排列的 run list，升级为可复用的招聘记忆库。用户可以按 evidence quality、needs action、gap type、outreach draft readiness 找回历史搜索，而不是只靠关键词。

## 2. Product Promise

> Reopen the right recruiting run by evidence state, not by memory.

中文表达：

> 不靠记忆找历史搜索，而是按证据状态、缺口和外联进度找回可复用结果。

## 3. Users And Jobs

### Recruiter

Job：找到可以继续推进的历史岗位或搜索结果。

成功体验：能筛出有高置信候选人、有外联草稿、或需要补证据的历史 run。

### Hiring Manager

Job：复盘为什么一个 search 还不能交付。

成功体验：卡片直接显示 gap 类型、待核验数量和下一步。

## 4. Scope

### In Scope

- 现有 evidence filters 继续保留：
  - high confidence
  - needs verification
  - low evidence
  - has gaps
  - shortlist ready
- 新增：
  - has outreach drafts
  - gap type quick filtering
  - richer needs-action reason text
  - gap type chips in result card
- URL 参数可复用：
  - `evidence`
  - `gap`
  - `status=needs_action`
- 从 existing `result` payload 推导 summary，不加 DB schema。

### Out Of Scope

- 新数据库表。
- 跨用户全局搜索。
- 对 Gmail threads 做 server-side join。
- 新 analytics dashboard。

## 5. Evidence Summary Model

```ts
type HistoryEvidenceSummary = {
  candidate_count: number;
  high_confidence_count: number;
  needs_verification_count: number;
  low_evidence_count: number;
  primary_gaps: string[];
  gap_types: string[];
  has_gaps: boolean;
  shortlist_ready: boolean;
  outreach_draft_count: number;
  has_outreach_drafts: boolean;
};
```

## 6. Filtering Rules

- `evidence=has_outreach_drafts` matches runs where result payload or candidates include outreach drafts / outreach drafted status.
- `gap=<type>` matches normalized gap labels from evidence coverage.
- `status=needs_action` matches failed/canceled runs or runs with gaps / verification needs / low evidence.
- Keyword search remains unchanged.

## 7. UX Requirements

- Evidence filter dropdown adds `Has outreach drafts`.
- More filters adds `Gap type` when gap options exist.
- Active chips must be removable.
- Result cards show:
  - candidate count
  - high confidence count
  - need verification count
  - outreach draft count when present
  - top gap labels
- Copy should make the next action obvious: continue role, retry research, adjust input, view progress.

## 8. Acceptance Criteria

- Filtering by `has_outreach_drafts` returns only matching runs.
- Filtering by a gap label returns runs whose evidence summary includes that gap.
- Active gap filter appears as a removable chip.
- Tests cover normalization, chip labels, evidence matching, and page static markers.

## 9. Metrics

- History runs reopened.
- Filters used per session.
- Runs reopened with outreach drafts.
- Needs-action runs resolved.
