# Autonomous Recruiter P2j Release PRD

## 1. Release Summary

本次发布把 P2c 的 contact resolution 和 P1a/P2i 的 Gmail outreach 控制串成更低摩擦的 outreach readiness 动作：

- Role Workspace Gmail Outreach Sequence 新增 `Resolve & approve ready` / `解析并批准可发送草稿`。
- 新增 `selectOutreachReadinessTargets`，根据当前 contact profile 和 bulk contact resolution result 选择可批准的 drafted threads。
- 合并动作先运行 `/api/contact-resolution/bulk`，继续展示 resolved/skipped/failed/cost_units summary。
- 合并动作只 PATCH `approved`，不调用 Gmail send route，不自动发送邮件。
- Bulk lookup 相关按钮互锁，避免用户同时触发两次 provider lookup。
- Helper 只信任 `resolved` 或 `skipped + already_sendable` 且 `can_send` 的 bulk rows，不信任 malformed failed rows。
- 既有 `Resolve missing contacts` 和 `Approve ready drafts` 保留，支持用户拆步操作。

## 2. Scope

包含：

- `docs/superpowers/specs/2026-06-26-autonomous-recruiter-p2j-outreach-readiness-prd.md`
- `web/lib/outreach-readiness.mjs`
- `web/lib/outreach-readiness.d.ts`
- `web/app/app/projects/[id]/page.tsx`
- `outreach-readiness.test.mjs`
- `api-route-copy.test.mjs`

不包含：

- 新 contact provider。
- Apollo。
- 自动发送 Gmail。
- 低置信 email override。
- Gmail scope 变化。
- 成本护栏变化。

## 3. Verification

已通过：

- `node --test outreach-readiness.test.mjs contact-resolution-bulk.test.mjs contact-resolution-route.test.mjs contact-resolution.test.mjs contact-providers.test.mjs api-route-copy.test.mjs` (`82/82`)
- `npm --prefix web run build`
- `git diff --check`

验收：

- Product function acceptance agent：PASS。
- UX/safety acceptance agent：PASS。

## 4. Rollout Checks

- Provider key 仍只在 server route 使用，前端不接触 Hunter key。
- 合并动作不会调用 `/api/outreach-threads/[id]/send` 或 `/api/inbox/actions/send`。
- 只有 `drafted` 且已有 sendable email 或 bulk result `can_send` 的 thread 会被批准。
- Bulk result 必须是可信 ready 状态；`error` / `not_found` 即使误带 `can_send` 也不会被批准。
- 发送仍需要用户在每个 `approved` thread 上逐封点击 `Send`。
- Provider disabled / quota / rate limit / not found 仍通过 bulk summary 和 item reason 展示。

## 5. Known Residual Risks

- 合并动作会连续 PATCH 多个 outreach thread；若中途网络失败，可能出现部分已批准、部分未批准。当前 UI 会刷新 workspace，后续可增加 per-target approval summary。
- 新动作依赖当前页面中的 queue items；如果 bulk resolution 返回后服务器侧发生并发变更，下一次刷新会以服务端状态为准。
- P2j 不解决“没有公司 domain/LinkedIn 时 Hunter 无法查找”的 provider 输入质量问题；这应留给后续 sourcing/profile enrichment。
