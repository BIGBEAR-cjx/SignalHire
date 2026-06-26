# Autonomous Recruiter P2e PRD: No-reply Follow-up Queue

## 1. Summary

P2e 的目标是补齐 P2a/P2d 之后仍然需要人工盯 inbox 的一块：首封 Gmail 已发出、还没有候选人回复、且已经到达跟进时间的外联线程。

系统应该在 Role Workspace 的 Inbox Agent 中自动汇总这些 no-reply follow-up items，生成基于 evidence hook 的跟进草稿，并允许用户保存或复制。第一版仍然 human-in-loop：不自动发送，不申请 Gmail modify 权限，不读取非 SignalHire 创建的 Gmail thread。

## 2. Goals

- 已发送或已联系的 outreach thread 如果到达 `next_follow_up_at` 且没有候选人回复，会进入 Inbox Agent 队列。
- no-reply item 使用已有 `sequence_messages`、candidate snapshot、role brief 生成 follow-up draft。
- follow-up draft 明确是草稿，用户保存后进入 `follow_up_due`，不会自动发送。
- Inbox Agent summary 和 priority line 能提示用户优先处理到期 follow-up。
- 已有 interested、ask_for_details、not_interested、bounced、later 分类逻辑保持兼容。

## 3. Non-Goals

本阶段不做：

- 自动发送 follow-up。
- Gmail modify / label / archive 权限。
- Google Calendar API。
- 对非 SignalHire 创建的 Gmail thread 做读取或分类。
- Apollo/PDL/Mira 联系方式策略调整。
- 大模型在线改写 follow-up；第一版使用确定性模板和已有 evidence hook。

## 4. Product Scope

### P2e.1 Due Follow-up Detection

范围：

- 在构建 project inbox queue 时，合并两类输入：
  - 已同步的 Gmail candidate replies。
  - 没有 candidate reply、但 `next_follow_up_at <= now` 或 status 为 `follow_up_due` 的 outreach threads。
- 只纳入有 `gmail_thread_id` 的 role-related outreach thread。
- 已经 stopped、bounced、rejected、hired 的 thread 不进入 follow-up 队列。

验收：

- sent/contacted/follow_up_scheduled thread 到期后能进入 inbox queue。
- 有 candidate reply 的 thread 不重复生成 no-reply item。
- stopped/bounced thread 不生成 follow-up。

### P2e.2 Follow-up Draft View Model

范围：

- 新增 no-reply classification/action：
  - `classification: "no_reply_follow_up"`
  - `next_action: "save_follow_up_draft"`
  - `action_label: "Save follow-up draft"`
  - `priority: "medium"`
- follow-up draft 来源优先级：
  1. `sequence_messages` 中 step 2 或 step 3。
  2. candidate strongest evidence / outreach angle。
  3. role brief fallback。
- 草稿必须引用候选人或证据 hook，但不能声称候选人已回复。

验收：

- no-reply item 有 `reply_draft`。
- `reply_draft` 引用 evidence hook 或 role context。
- 文案不包含 “thanks for your reply” 这类错误暗示。

### P2e.3 Action Persistence

范围：

- 扩展 `/api/inbox/actions` 支持 `save_follow_up_draft`。
- 保存后写入 outreach thread：
  - `body: reply_draft`
  - `status: "follow_up_due"`
  - `notes` action marker
- 不设置 `sent_at`，不调用 Gmail send API。

验收：

- 保存 follow-up draft 后 action status 为 `draft_saved`。
- outreach thread status 为 `follow_up_due`。
- 不触发 Gmail send。

### P2e.4 Role Workspace UX

范围：

- Inbox Agent summary 增加 due follow-up 数。
- priority line 优先级：
  1. needs scheduling
  2. due follow-up drafts
  3. needs reply
  4. review required
- Inbox Queue 中 no-reply item 显示：
  - candidate name
  - due follow-up label
  - draft preview
  - Save follow-up draft
  - Copy follow-up draft
- 移动端保持无横向溢出。

验收：

- 用户能在 Role Workspace 直接看到哪些候选人需要跟进。
- 用户能复制或保存 follow-up 草稿。
- 界面明确表达“草稿/待确认”，不误导为已发送。

## 5. Test Plan

Unit tests:

- `inbox-agent.test.mjs`
  - no-reply due thread builds `save_follow_up_draft` action.
  - follow-up draft prefers `sequence_messages` step 2.
  - no-reply item does not enter interested queue.
  - summary counts due follow-up drafts.

- `inbox-actions.test.mjs`
  - `save_follow_up_draft` persists draft body and maps to `follow_up_due`.
  - action marker stores `reply_draft` with `draft_saved`.

- `inbox-thread-merge.test.mjs`
  - due outreach threads without candidate replies are merged into inbox queue.
  - outreach threads with existing candidate replies are not duplicated.
  - stopped/bounced threads are ignored.

Source/API tests:

- `api-route-copy.test.mjs`
  - Role Workspace renders due follow-up copy/action labels.
  - Inbox action allowlist includes `save_follow_up_draft`.

Verification:

- `node --test inbox-agent.test.mjs inbox-actions.test.mjs inbox-thread-merge.test.mjs api-route-copy.test.mjs`
- `npm --prefix web run build`
- Two independent agents:
  - Product function acceptance.
  - UX acceptance.

## 6. Rollout Plan

1. Add failing tests for no-reply queue, draft persistence, merge behavior, and UI/source labels.
2. Implement minimal inbox agent view model changes.
3. Implement due outreach thread merge in project inbox view.
4. Extend inbox action persistence.
5. Update Role Workspace labels and copy controls.
6. Run tests/build.
7. Run two independent acceptance agents.
8. Write release PRD before merging and publishing.
