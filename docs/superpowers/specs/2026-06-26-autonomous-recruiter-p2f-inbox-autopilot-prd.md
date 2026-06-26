# Autonomous Recruiter P2f PRD: Gmail Reply Sync And Inbox Autopilot

## 1. Summary

P2f 的目标是把已落地的 Gmail send、reply sync、Inbox Agent、interested scheduling 和 no-reply follow-up 队列，升级成每天可运营的 autonomous recruiter inbox loop。

当前系统已经能发信、读取 Gmail thread、分类回复并生成下一步动作，但仍有三个产品缺口：

- Gmail access token 过期后缺少 refresh 闭环，sync/send 容易失败。
- Role Workspace 对 sync 状态、scope 缺口和错误原因表达不够清楚。
- Inbox Queue 虽然有 action item，但还没有足够明确的今日优先处理视图和状态推进反馈。

P2f 不做自动发送回复，不做自动发送 follow-up，不接 Calendar，不新增 provider。核心是让用户打开 Role Workspace 后能知道：Gmail 是否可同步、刚刚同步了什么、哪些候选人现在最值得处理、哪些线程已经停止或需要人工判断。

## 2. Goals

- Gmail token 过期时，系统能用 refresh token 获取新的 access token，并更新连接记录。
- Gmail sync 返回结构化 summary：`connected`、`can_read_inbox`、`scanned`、`synced`、`errors`、`skipped_reason`、`last_synced_at`。
- Role Workspace 显示 inbox sync 状态、最后同步时间、同步结果和 scope 缺口。
- Gmail 未连接或缺少 `gmail.readonly` 时，用户看到明确的重新连接说明。
- Inbox Agent 增加今日优先队列，将待约面、待回复、到期 follow-up、人工复核按优先级排序。
- 同步后的回复继续推进 outreach thread 状态：
  - `interested` -> `replied`
  - `ask_for_details` -> `needs_reply`
  - `later` / `out_of_office` -> `follow_up_later`
  - `not_interested` -> `stopped`
  - `bounced` -> `bounced`
- 每条自动分类都保留原文片段、分类理由和建议动作，用户可以人工覆盖。

## 3. Non-Goals

本阶段不做：

- 自动发送候选人回复。
- 自动发送 follow-up。
- Google Calendar API。
- Gmail `modify` 权限。
- Gmail label / archive / mark read。
- 非 SignalHire 创建 thread 的 inbox 管理。
- 新 contact data provider。
- Apollo。
- 重新设计 Role Workspace 信息架构。

## 4. Primary User Stories

### Recruiter

作为 recruiter，我希望每天打开一个 role 时能看到 Gmail 是否同步成功、哪些候选人回复了、哪些需要约面或回复，这样我不用反复检查 inbox。

### Founder / Hiring Manager

作为 founder，我希望 interested candidate 自动浮到最上面，并带着证据、风险和候选人回复上下文，这样我能快速决定是否推进面试。

### Operator

作为 operator，我希望 Gmail 权限缺失、token 过期、provider error 等状态被明确展示，避免用户把空队列误解为没有候选人回复。

## 5. Product Scope

### P2f.1 Gmail Token Refresh

范围：

- `accessTokenFor` 在 access token 缺失或过期时使用 refresh token 刷新。
- 刷新成功后更新 `gmail_connections.encrypted_token_bundle` 和 `expires_at`。
- 没有 refresh token 时返回明确错误 `gmail_reconnect_required`。
- 不把 token、client secret 或原始 Gmail error 暴露给前端。

验收：

- 未过期 token 直接使用。
- 过期 token 有 refresh token 时会刷新并保存。
- 过期 token 无 refresh token 时 send/sync 返回 reconnect required。

### P2f.2 Sync Result View Model

范围：

- `syncGmailInboxForProject` 返回稳定 summary：
  - `ok`
  - `connected`
  - `can_read_inbox`
  - `scanned`
  - `synced`
  - `errors`
  - `skipped_reason`
  - `last_synced_at`
- 缺少 Gmail 连接或缺少 readonly scope 时不抛异常，返回可展示状态。
- Role Workspace 在手动 sync 后展示结果摘要。

验收：

- Gmail 未连接时显示 Gmail not connected。
- Gmail 已连接但缺少 readonly scope 时显示 reconnect with inbox access。
- sync 成功后显示 scanned/synced 数量和最后同步时间。
- sync partial failure 显示失败数量但仍保留成功结果。

### P2f.3 Inbox Today Queue

范围：

- 扩展 `buildInboxQueue` 输出 `today_queue`。
- 排序优先级：
  1. interested / needs scheduling
  2. ask for details / needs reply
  3. no-reply follow-up due
  4. needs human review
  5. later / out of office
  6. stopped / bounced
- 每个 item 包含 `today_rank`、`today_reason`、`next_action`、`action_label`、`priority`、`last_message_excerpt`。
- Role Workspace 显示今日优先处理区，避免用户只看到一串分类列表。

验收：

- interested candidate 总是排在 no-reply follow-up 前面。
- stopped / bounced 不作为待处理项突出。
- UI 语言表达“建议下一步”，不暗示系统已经自动发送。

### P2f.4 Status Transition Feedback

范围：

- Gmail sync 后继续更新 outreach thread 状态。
- 对 `ask_for_details`、`later`、`out_of_office` 增加明确状态映射。
- 状态变更写入 notes action marker，供 Role Workspace 刷新后复原。

验收：

- interested -> replied。
- ask_for_details -> needs_reply。
- later / out_of_office -> follow_up_later。
- not_interested -> stopped。
- bounced -> bounced。

## 6. Test Plan

Unit tests:

- `gmail.test.mjs`
  - expired token with refresh token refreshes and persists.
  - missing refresh token returns reconnect required.
  - refreshed token is not exposed in send/sync response.
- `inbox-agent.test.mjs`
  - today queue sorts interested before due follow-up and review.
  - stopped/bounced items are not highlighted as actionable today.
- `inbox-sync.test.mjs`
  - Gmail disconnected returns structured skipped summary.
  - readonly scope missing returns structured reconnect summary.
  - ask_for_details/later/out_of_office update thread status and notes.

Source/API tests:

- `api-route-copy.test.mjs`
  - Gmail sync route exposes structured summary fields.
  - Role Workspace renders sync status, reconnect copy, today queue, and last synced copy.

Verification:

- `node --test gmail-outreach.test.mjs gmail.test.mjs inbox-agent.test.mjs inbox-actions.test.mjs inbox-sync.test.mjs api-route-copy.test.mjs`
- `npm --prefix web run build`
- Desktop and mobile Role Workspace browser smoke when local auth allows.
- Two independent agents:
  - Product function acceptance.
  - UX acceptance.

## 7. Rollout Plan

1. Add failing tests for token refresh, structured sync summary, today queue, and status mapping.
2. Implement Gmail token refresh with persisted encrypted token bundle update.
3. Implement structured sync summary and status mapping.
4. Implement inbox today queue view model.
5. Update Role Workspace sync status and today queue UI.
6. Run focused tests and build.
7. Run two independent acceptance agents.
8. Write release PRD before merging and publishing.
