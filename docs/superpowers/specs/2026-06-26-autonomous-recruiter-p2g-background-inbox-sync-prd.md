# Autonomous Recruiter P2g PRD: Background Gmail Sync

## 1. Summary

P2f 已经让 Role Workspace 可以手动同步 Gmail replies，并把回复推进到 Inbox Agent 的 today queue。P2g 的目标是把这个 loop 从“用户点按钮才更新”推进到“系统定期扫描有活跃外联的 role”，让用户打开工作台时更接近已经整理好的 inbox。

本阶段只做后台 sync 调度和状态汇总，不做自动发送、不做 Gmail modify、不做 Calendar、不读取非 SignalHire 创建的 Gmail thread。

## 2. Goals

- 新增 cron-safe API：定期同步有活跃 outreach thread 的项目。
- 只扫描满足条件的 role：
  - 项目属于有 Gmail connection 的用户。
  - 项目下有 `sent`、`replied`、`needs_reply`、`follow_up_later`、`follow_up_scheduled`、`follow_up_due` 等活跃 outreach thread。
  - outreach thread 有 `gmail_thread_id`。
- 每次 cron run 有成本/安全上限：
  - 最多处理 N 个项目。
  - 每个项目最多扫描 M 个 Gmail thread。
  - 单个项目失败不影响其他项目。
- 返回结构化 summary，方便 Vercel cron / ops 判断：
  - `ok`
  - `projects_scanned`
  - `threads_scanned`
  - `replies_synced`
  - `skipped`
  - `errors`
  - `ran_at`
- 复用 P2f 的 `syncGmailInboxForProjectCore`，不新建第二套分类逻辑。
- Role Workspace 手动 sync 继续保留。

## 3. Non-Goals

本阶段不做：

- 自动发送候选人回复。
- 自动发送 follow-up。
- Gmail `modify` scope。
- Google Calendar API。
- Gmail watch / PubSub push notifications。
- 全量扫描用户 inbox。
- 读取非 SignalHire outreach 创建的 thread。
- 新增 paid billing / credit 计费。

## 4. Product Behavior

### P2g.1 Background Sync Scope

后台 sync 只处理 active outreach 项目。一个 project 进入后台 sync 的条件：

- project 有至少一个 role-related outreach thread。
- thread 有 `gmail_thread_id`。
- thread 状态不是 `stopped`、`bounced`、`rejected`、`hired`。

验收：

- 没有 Gmail thread 的项目不会被扫描。
- stopped/bounced/rejected/hired 项目不会被扫描。
- sent/follow_up_later/follow_up_scheduled/follow_up_due 项目会进入扫描。

### P2g.2 Cron API

新增 route：

- `GET /api/cron/inbox-sync`

行为：

- 使用 `CRON_SECRET` 或现有 cron auth pattern 校验请求。
- 未授权返回 401。
- 授权后调用 background sync runner。
- 默认最多处理 10 个项目，每项目最多扫描 20 个 thread。

验收：

- 未带 secret 返回 401。
- 带 secret 返回结构化 summary。
- route 不暴露 Gmail token、refresh token、Google client secret。

### P2g.3 Background Runner

新增 `web/lib/inbox-background-sync.mjs`：

- 纯函数/runner 层接收依赖注入，方便测试。
- 先查询候选项目和 outreach thread。
- 对每个项目调用 `syncGmailInboxForProjectCore`。
- 合并每个项目的结果为总 summary。
- 单项目失败写入 `errors`，继续跑下一个项目。

验收：

- 单项目失败不影响其他项目。
- 达到项目上限后停止。
- 合并 `scanned/synced/errors/skipped_reason`。

### P2g.4 Ops Visibility

Cron summary 必须清楚表达：

- 跑了几个项目。
- 扫了几个 Gmail thread。
- 同步了几条候选人回复。
- 哪些项目被跳过或失败。

验收：

- Vercel cron 日志能直接看到 summary JSON。
- 空结果返回 `ok: true`，而不是 error。

## 5. Test Plan

Unit tests:

- `inbox-background-sync.test.mjs`
  - filters only projects with active Gmail outreach threads.
  - respects max project and max thread limits.
  - single project failure does not stop later projects.
  - aggregates scanned/synced/errors/skipped counts.

Source/API tests:

- `api-route-copy.test.mjs`
  - `/api/cron/inbox-sync` exists.
  - route validates cron auth.
  - route calls background sync runner.
  - route does not expose Gmail token or Google secret.

Verification:

- `node --test inbox-background-sync.test.mjs inbox-sync.test.mjs api-route-copy.test.mjs`
- `npm --prefix web run build`
- Two independent agents:
  - Product function acceptance.
  - UX/ops acceptance.

## 6. Rollout Plan

1. Add failing tests for background sync runner and cron route copy.
2. Implement runner with dependency injection.
3. Implement cron route using existing cron auth pattern.
4. Run focused tests and build.
5. Run two independent agents.
6. Write release PRD before merging and publishing.
