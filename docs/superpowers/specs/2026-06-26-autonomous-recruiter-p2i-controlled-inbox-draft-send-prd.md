# Autonomous Recruiter P2i PRD: Controlled Inbox Draft Send

## 1. Summary

P2a-P2h 已经完成 Gmail 首封发信、reply sync、Inbox Agent 分类、follow-up draft、后台同步和可见性。但当前闭环还有一个明显断点：Inbox Agent 可以保存 `reply` / `follow-up` 草稿，却没有一个清晰的“用户确认后从 Gmail 发送这条已保存草稿”的路径。用户仍需要回到 Gmail 或把 thread 状态手动改回首封发送逻辑。

P2i 的目标是补上这个 human-in-loop 发送闭环：用户在 Role Workspace 里看到已保存的 reply/follow-up draft，可以明确点击发送；系统复用 Gmail send 权限和既有 outreach thread，不自动发送任何邮件。

## 2. Goals

- 新增受控 Inbox draft send 路径，只允许用户点击后发送。
- 支持两类已保存草稿：
  - `reply` action 保存后的候选人回复草稿。
  - `save_follow_up_draft` 保存后的到期 follow-up 草稿。
- 发送前继续检查：
  - 用户拥有该 outreach thread。
  - Gmail 已连接。
  - thread 有 sendable sourced email。
  - thread 有 `gmail_thread_id`，确保这是 SignalHire 创建或已同步的 role-related Gmail thread。
  - thread body 非空。
  - inbox action marker 表示草稿已保存，且 action 属于允许发送的类型。
- 发送后更新 outreach thread：
  - `status: "sent"` for follow-up draft send。
  - `status: "replied"` for reply draft send。
  - `gmail_message_id`
  - `gmail_thread_id`
  - `send_error: ""`
  - notes action marker 更新为 `sent`。
- Role Workspace 在 Inbox Queue 中对已保存草稿显示 `Send saved draft` / `发送已保存草稿`。

## 3. Non-Goals

本阶段不做：

- 自动发送回复。
- 自动发送 follow-up。
- Gmail `modify` / label / archive。
- Google Calendar invite。
- Gmail thread reply API 的完整 MIME threading header 支持。
- 非 SignalHire thread 的 inbox 管理。
- 新 contact provider。
- 批量发送。

## 4. Product Behavior

### P2i.1 Send Eligibility

一个 Inbox draft 可发送的条件：

- `outreach_thread_id` 存在。
- `thread.gmail_thread_id` 存在。
- `thread.body` 存在。
- `contact_profile` 中有 sendable email。
- Gmail connected。
- `notes` 中最新 `signalhire-inbox-action` marker 为：
  - `action: "reply", action_status: "draft_saved"`；或
  - `action: "save_follow_up_draft", action_status: "draft_saved"`。

验收：

- 未保存草稿不能发送。
- follow_up_later / schedule / stop / review action 不能发送。
- 没有 Gmail thread id 的草稿不能发送。
- 没有 sendable email 的草稿不能发送。

### P2i.2 Send API

新增 route：

- `POST /api/inbox/actions/send`

请求：

```json
{
  "outreach_thread_id": "uuid",
  "locale": "zh"
}
```

行为：

- 使用 `getUser()` 鉴权。
- 用 `getOutreachThread({ userId, id })` 做 ownership lookup。
- 调用 server-only Gmail send helper。
- 不在 response 中返回 Gmail access token、refresh token、raw provider payload。

验收：

- 未登录 401。
- 缺 thread id 400。
- 非当前用户 thread 404。
- 不符合 eligibility 返回明确 reason。
- 成功返回更新后的 thread。

### P2i.3 UI

Role Workspace Inbox Agent：

- 对 `action_status === "draft_saved"` 且 `next_action` 为 `reply` 或 `save_follow_up_draft` 的 item 展示 `Send saved draft`。
- 点击前仍展示草稿内容和 “Nothing is sent automatically” 语义。
- 发送成功后刷新 workspace。
- 发送失败展示 inline error。

验收：

- 用户能从 Inbox Queue 对已保存 reply/follow-up draft 一键发送。
- 未保存草稿仍只显示 `Save suggested draft` / `Save follow-up draft`。
- 移动端按钮不造成横向溢出。

## 5. Test Plan

Unit tests:

- `gmail-outreach.test.mjs`
  - validates saved inbox reply/follow-up drafts are eligible.
  - rejects missing Gmail thread id, missing body, missing sendable email, unsaved draft, and unsupported action.

- `inbox-actions.test.mjs`
  - send action marker maps `reply` to `sent` action status without losing human notes.
  - send action marker maps `save_follow_up_draft` to `sent` action status.

API/source tests:

- `api-route-copy.test.mjs`
  - `/api/inbox/actions/send` exists and uses `getUser`, `getOutreachThread`, and server-only Gmail helper.
  - Role Workspace renders `Send saved draft` / `发送已保存草稿`.
  - Gmail send helper does not expose secrets in response.

Verification:

- `node --test gmail-outreach.test.mjs inbox-actions.test.mjs api-route-copy.test.mjs`
- `npm --prefix web run build`
- Two independent agents:
  - Product function acceptance.
  - UX/safety acceptance.

## 6. Rollout Plan

1. Add failing tests for eligibility, marker update, API route/source coverage, and UI copy.
2. Add pure validation and marker helpers.
3. Add server-only send helper and API route.
4. Wire Role Workspace button and inline error handling.
5. Run focused tests/build.
6. Run two independent acceptance agents.
7. Write release PRD before merge/push.
