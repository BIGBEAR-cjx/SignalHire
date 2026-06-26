# Autonomous Recruiter P2h PRD: Inbox Sync Visibility

## 1. Summary

P2g 已经把 Gmail reply sync 从手动按钮推进到后台 cron，但同步结果主要停留在 cron response / platform logs。P2h 的目标是把后台同步状态持久化到 role 级工作台，让用户打开 Role Workspace 时能看到系统最近是否同步过、同步了多少回复、哪些项目被跳过或失败。

本阶段不改变 Gmail 权限、不自动发送回复、不新增 provider。只把 P2g 的后台执行结果变成用户和运营都可见的项目级状态。

## 2. Goals

- 每次后台 inbox sync 对单个 project 的结果写回 project 级 `inbox_sync_summary`。
- `/api/projects/[id]` 返回 `project.inbox_sync_summary`。
- Role Workspace 的 Inbox Agent 区显示最近后台同步状态：
  - last synced / attempted time
  - scanned threads
  - synced replies
  - skipped reason
  - error count
- 手动 sync 继续保留，并在成功后刷新项目详情。
- 未同步过时不制造错误状态，只显示系统会自动同步或可手动同步。
- Vercel Hobby 当前 daily cron 限制要在 PRD 中明确；升级 Pro 后再恢复高频 sync。

## 3. Non-Goals

本阶段不做：

- Gmail watch / PubSub。
- Gmail `modify` 权限。
- 自动发送回复或 follow-up。
- Google Calendar。
- 新 contact data provider。
- 新付费计量。
- 全量 inbox 扫描。

## 4. Product Behavior

### P2h.1 Project Sync Summary Persistence

新增字段：

- `projects.inbox_sync_summary jsonb not null default '{}'::jsonb`

后台 sync 每个 project 完成后写入：

```ts
type ProjectInboxSyncSummary = {
  source: "background" | "manual";
  ok: boolean;
  last_attempted_at: string;
  last_synced_at: string;
  scanned: number;
  synced: number;
  skipped_reason: string;
  error_count: number;
  errors: Array<{ error: string }>;
};
```

验收：

- 成功 sync 写入 `ok=true`、`scanned`、`synced`、`last_synced_at`。
- Gmail 未连接/缺 scope 写入 `ok=true` + `skipped_reason`，不把项目标成失败。
- provider/query/sync error 写入 `ok=false` + `error_count`。
- 写 summary 失败不阻断其他项目 sync，但进入 cron summary errors。

### P2h.2 Project API Exposure

范围：

- `getProject` / `listProjects` 保持兼容。
- 项目详情 GET 返回 `project.inbox_sync_summary`。
- 列表页不需要新增 UI，避免扩大范围。

验收：

- `/api/projects/[id]` 返回 sync summary。
- 没有字段或旧数据时返回 `{}` / 空状态，不影响页面渲染。

### P2h.3 Role Workspace Visibility

Inbox Agent 区新增一行状态摘要：

- 英文：`Background sync: last checked ... · scanned X · synced Y`
- 中文：`后台同步：上次检查 ... · 扫描 X · 同步 Y`

状态表达：

- `ok=true` 且无 skipped/error：绿色或中性。
- `skipped_reason`：琥珀色提示，需要用户重新连接 Gmail 时给出连接入口。
- `ok=false`：显示错误数量和最近错误，不泄露 token/provider secret。
- 未同步过：显示“后台同步会自动检查；也可以手动同步”。

验收：

- 用户能区分“没有回复”和“系统没有同步/权限不足”。
- 错误原因是招聘方可理解语言。
- 移动端不新增横向溢出。

## 5. Test Plan

Unit tests:

- `inbox-background-sync.test.mjs`
  - per-project sync result is normalized into project summary metadata.
  - skipped Gmail states persist as skipped, not failed.
  - summary persistence errors are surfaced but do not stop later projects.

Source/API tests:

- `api-route-copy.test.mjs`
  - migration adds `projects.inbox_sync_summary`.
  - background sync writes project inbox sync summary.
  - project detail API returns `inbox_sync_summary`.
  - Role Workspace renders background sync status copy.

Verification:

- `node --test inbox-background-sync.test.mjs api-route-copy.test.mjs`
- `npm --prefix web run build`
- Two independent agents:
  - Product function acceptance.
  - UX/ops acceptance.

## 6. Rollout Plan

1. Add failing tests for summary normalization, persistence failure behavior, migration/API/UI source coverage.
2. Add additive migration.
3. Implement summary normalization and project summary writer.
4. Wire background sync to persist per-project result.
5. Expose summary through project API and render in Inbox Agent panel.
6. Run focused tests/build.
7. Run two independent acceptance agents before merge/push.
