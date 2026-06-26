# Autonomous Recruiter P2i Release PRD

## 1. Release Summary

本次发布补齐 Inbox Agent 保存草稿后的受控发送闭环：

- 新增 `/api/inbox/actions/send`，只允许登录用户发送自己 role 下的已保存 Inbox draft。
- 新增 `validateInboxDraftSend`，只允许 `reply` / `save_follow_up_draft` 且 `draft_saved` 的草稿发送。
- 发送前继续要求 Gmail connected、sendable sourced email、`gmail_thread_id` 和非空 message body。
- 新增 `buildInboxDraftSentPatch`，发送后把 inbox action marker 更新为 `sent`，保留人工 notes。
- Gmail send payload 对 Inbox draft send 传入原 `gmail_thread_id`，避免已保存 reply/follow-up 变成新的 Gmail conversation。
- Role Workspace Inbox Queue 对已保存草稿显示 `Send saved draft` / `发送已保存草稿`。
- 不做自动发送，不新增 Gmail `modify` scope，不做批量发送。

## 2. Scope

包含：

- `docs/superpowers/specs/2026-06-26-autonomous-recruiter-p2i-controlled-inbox-draft-send-prd.md`
- `web/app/api/inbox/actions/send/route.ts`
- `web/lib/gmail-outreach.mjs`
- `web/lib/gmail.ts`
- `web/lib/inbox-actions.mjs`
- `web/app/app/projects/[id]/page.tsx`
- `gmail-outreach.test.mjs`
- `inbox-actions.test.mjs`
- `api-route-copy.test.mjs`

不包含：

- 自动回复候选人。
- 自动发送 follow-up。
- Gmail `modify` / labels / archive。
- Google Calendar。
- 非 SignalHire Gmail thread 管理。
- 批量发送。
- 新 contact provider。

## 3. Verification

已通过：

- `node --test gmail-outreach.test.mjs gmail.test.mjs inbox-actions.test.mjs inbox-agent.test.mjs inbox-sync.test.mjs inbox-thread-merge.test.mjs api-route-copy.test.mjs` (`90/90`)
- `npm --prefix web run build`

待完成：

- Product function acceptance agent final pass。
- UX/safety acceptance agent passed source review。

## 4. Rollout Checks

- Route 不直接引用或返回 Gmail token、refresh token、Google client secret 或 token encryption key。
- 发送资格要求最新 inbox action marker 为 `draft_saved`，不是任意 body 都可发送。
- 没有 `gmail_thread_id` 的草稿不能通过 P2i 发送，避免把非 SignalHire thread 当作 inbox reply。
- 发送失败会写回 `send_error`，不会静默失败。
- UI 文案继续表达 human-in-loop；不会暗示系统自动发送。

## 5. Known Residual Risks

- 当前 Gmail raw message 没有完整 `In-Reply-To` / `References` threading header；P2i 已在 Gmail send payload 传入原 `threadId`，后续若要更稳定 threaded reply，需要扩展 Gmail message builder。
- P2i 不做批量发送；这是安全边界，不是缺陷。
- P2i 仍依赖已解析的 sendable email；无联系方式候选人仍需先走 contact resolution。
