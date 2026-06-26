# Autonomous Recruiter P2e Release PRD: No-reply Follow-up Queue

## 1. Release Summary

本次发布把 P2e No-reply Follow-up Queue 合并到主产品。目标是让 Role Workspace 不只处理已经回复的 Gmail thread，也能发现首封已发送但无人回复、且已经到达跟进时间的候选人，并生成可保存/复制的 follow-up draft。

发布后仍保持 human-in-loop：不自动发送 follow-up，不新增 Gmail modify 权限，不读取非 SignalHire 创建的 Gmail thread。

## 2. Release Scope

- Inbox Agent 合并 due no-reply outreach threads。
- 新增 `no_reply_follow_up` queue item。
- 新增 `save_follow_up_draft` action。
- Role Workspace 显示 due follow-up summary、priority line、保存草稿和复制草稿入口。
- 修复 `follow_up_scheduled` 到期后被旧状态禁用的问题。
- 保持 interested scheduling、ask-for-details reply、stop follow-up 等现有路径兼容。

## 3. Safety Checks

- `save_follow_up_draft` 只更新 outreach thread 的 `status/body/notes`。
- 不写 `sent_at`。
- 不调用 Gmail send API。
- stopped/bounced/rejected/hired 或没有 `gmail_thread_id` 的 thread 不进入 no-reply follow-up queue。
- 已经有 candidate reply 的 thread 不重复生成 no-reply item。

## 4. Verification

Required before merge:

- `node --test inbox-agent.test.mjs inbox-actions.test.mjs inbox-thread-merge.test.mjs api-route-copy.test.mjs`
- `npm --prefix web run build`
- Product function acceptance agent: PASS.
- UX acceptance agent: PASS.

Manual smoke:

- Local `/login` page loads.
- Project page auth shell loads.
- Full Role Workspace entity screenshot may require a valid local auth state and seeded project data; if unavailable, do not claim full visual verification.

## 5. Rollout Plan

1. Commit P2e branch.
2. Merge branch into `main`.
3. Re-run required tests/build on `main`.
4. Push `main`.
5. Confirm Vercel production deployment is READY and points to the merge commit.
