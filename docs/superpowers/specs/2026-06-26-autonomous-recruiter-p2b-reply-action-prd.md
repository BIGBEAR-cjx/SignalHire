# Autonomous Recruiter P2b PRD: Reply-to-Action Loop

## 1. Summary

P2b 的目标是把 P2 已有的 Gmail reply sync 和 Inbox Agent 从“分类列表”升级为“可执行动作闭环”。用户打开 Role Workspace 后，不需要翻 Gmail thread，而是直接看到每个候选回复应该如何推进：约面、回复问题、稍后跟进、停止跟进或人工复核。

本阶段仍保持 human-in-loop：

- 不自动发送候选人回复。
- 不自动发送 follow-up。
- 不接 Google Calendar API。
- 不读取未授权邮箱。
- 不把低置信 contact 当成可发送对象。

## 2. Goals

- Inbox item 必须有明确的 `next_action`、状态和用户可执行控件。
- 用户点击 action 后，状态能持久化，刷新页面不丢。
- `interested` 候选人可以推进为 interview-ready handoff。
- `ask_for_details` 可以生成并保存回复草稿。
- `later` / `out_of_office` 可以保存稍后跟进状态。
- `not_interested` / `bounced` 可以停止后续跟进。
- Role 页面顶部能表达“今天下一步该做什么”。

## 3. Non-Goals

本阶段不做：

- 自动回复候选人。
- 自动发送 follow-up。
- 自动创建 Calendar invite。
- 第二个 contact provider。
- Gmail label / modify 权限。
- ATS 同步。
- 收费或 billing 逻辑。

## 4. User Stories

### Recruiter

作为 recruiter，我希望看到每条候选人回复对应的下一步按钮，这样我不用判断 inbox，也不会遗漏需要推进的人。

### Hiring Manager

作为 hiring manager，我希望 interested 候选人带着证据、风险和建议问题进入 handoff，这样我能快速决定是否面试。

### Founder

作为 founder，我希望系统帮我停掉不感兴趣或 bounced 的人，把注意力集中在能推进的人身上。

## 5. Product Scope

### P2b.1 Inbox Action State Model

新增 action state view model：

- `pending`
- `draft_saved`
- `scheduled`
- `interview_ready`
- `stopped`
- `reviewed`

分类到动作的默认映射：

- `interested` -> `schedule`
- `ask_for_details` -> `reply`
- `later` / `out_of_office` -> `follow_up_later`
- `not_interested` / `bounced` -> `stop`
- `needs_human_reply` -> `review`

验收：

- 每个 inbox item 都有 `next_action`、`action_label`、`action_status`。
- action status 能从现有 thread metadata 派生。
- 未执行 action 时默认为 `pending`。

### P2b.2 Persisted Action Apply API

新增或复用 API，把用户 action 写回 outreach thread：

- `POST /api/inbox/actions`

输入：

- `outreach_thread_id`
- `action`
- `reply_draft`
- `follow_up_at`
- `scheduling_message`

输出：

- `ok`
- updated action state
- updated thread status

状态映射：

- `schedule` -> outreach thread `replied`，action `interview_ready`
- `reply` -> outreach thread `replied`，action `draft_saved`
- `follow_up_later` -> outreach thread `follow_up_scheduled`，action `scheduled`
- `stop` -> outreach thread `stopped`，action `stopped`
- `review` -> outreach thread `replied`，action `reviewed`

验收：

- 未登录用户不能写 action。
- 用户不能更新不属于自己的 thread。
- 无效 action 返回 400。
- 刷新 Role Workspace 后仍能看到 action 状态。

### P2b.3 Role Workspace Action Controls

在 Inbox Agent 区增加行动控件：

- interested：`Mark interview-ready`、`Copy handoff`
- ask for details：展示回复草稿，支持 `Save reply draft`
- later / out of office：`Schedule follow-up`
- not interested / bounced：`Stop follow-up`
- needs human reply：`Mark reviewed`

验收：

- 用户不用离开 Role Workspace 就能处理 inbox action。
- action 成功后按钮状态更新。
- 错误展示在当前 item 上，不吞掉。
- 移动端无横向溢出。

### P2b.4 Today Action Summary

Role Workspace 顶部或 Inbox Agent 顶部展示 action summary：

- interested / needs scheduling
- needs reply
- follow up later
- stopped
- review required

验收：

- 用户打开页面第一眼知道下一步处理哪类回复。
- summary 数字来自当前 inbox queue，不手写。

## 6. Data Notes

第一版优先不新增表。把 action metadata 作为 additive metadata 写回 `outreach_threads` 已有 JSON 或可扩展字段；如果当前 schema 没有合适字段，则在现有 update API 中只写已有可承载字段，避免迁移阻塞。

推荐 metadata shape：

```ts
type InboxActionState = {
  action_status: "pending" | "draft_saved" | "scheduled" | "interview_ready" | "stopped" | "reviewed";
  action_applied_at: string;
  reply_draft?: string;
  follow_up_at?: string;
  scheduling_message?: string;
};
```

## 7. Test Plan

Unit tests：

- `inbox-agent.test.mjs`
  - classification -> action status defaults
  - summary counts by action type

- `inbox-actions.test.mjs`
  - invalid action rejected
  - schedule / reply / follow_up_later / stop / review map to correct thread status
  - action metadata preserves user draft

API/source tests：

- route exists and checks auth
- route uses user-scoped thread lookup/update
- Role Workspace renders action controls and posts to `/api/inbox/actions`

Verification：

- `node --test inbox-agent.test.mjs inbox-actions.test.mjs api-route-copy.test.mjs`
- `npm --prefix web run build`
- Desktop and mobile Role Workspace browser check.

## 8. Rollout Plan

1. Add pure inbox action model and tests.
2. Add action apply route core and API route.
3. Wire Role Workspace controls.
4. Add action summary UI.
5. Run tests and build.
6. Run two independent acceptance agents:
   - Product function agent: validates action state, API persistence, and role workflow.
   - UX agent: validates clarity, mobile layout, and hiring manager readability.
