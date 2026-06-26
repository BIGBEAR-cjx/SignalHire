# Autonomous Recruiter P2j PRD: Outreach Readiness Auto-Prepare

## 1. Summary

P2c 已经支持 Hunter contact resolution，P2i 已经支持用户手动发送 Inbox Agent 保存草稿。当前 Role Workspace 仍有一个操作摩擦：用户通常要先点 `Resolve missing contacts`，等待结果，再点 `Approve ready drafts`，之后才能逐封发送。对“省招聘工时、少管 inbox、直接拿面试”的方向来说，下一步应把“补联系方式 + 批准已可发送草稿”合并成一个明确、可控、不会自动发信的准备动作。

P2j 的目标是新增 `Resolve & approve ready` / `解析并批准可发送草稿`：用户点击一次后，系统先按 P2c 的成本护栏解析缺失联系方式，再把已有或新解析出 sendable email 的 `drafted` outreach threads 批准为 `approved`。P2j 不发送邮件；真实发送仍需要用户逐封点击 `Send`。

## 2. Goals

- 在 Role Workspace 的 Gmail Outreach Sequence 区新增一个合并动作：
  - 运行 bulk contact resolution。
  - 基于 bulk 结果和现有 contact profile 找到可发送的 `drafted` threads。
  - 批量批准这些 ready drafts。
- 继续展示 contact resolution summary，包括 resolved/skipped/failed/cost_units。
- 保持 P2c 成本护栏：每次 bulk provider lookup 最多 10 个。
- 保持 P1a/P2i 安全边界：不自动发送 Gmail，不绕过 email source/confidence/deliverability gate。
- 对 provider disabled、quota、rate limit、not found 等结果保持可见。

## 3. Non-Goals

本阶段不做：

- 第二个 live contact provider。
- 恢复 Apollo。
- 自动发送首封邮件。
- 自动发送 follow-up。
- 绕过用户批准。
- 低置信邮箱手动 override。
- 修改 Gmail scope。
- 修改 Hunter 计费策略或 provider max call 上限。

## 4. Product Behavior

### P2j.1 Outreach Readiness Target Selection

新增纯 view-model helper：

- 输入：
  - 当前 outreach queue items。
  - bulk contact resolution result。
- 输出：
  - 可批准的 thread ids。

选择规则：

- 只选择 `status === "drafted"` 的 outreach thread。
- 如果当前 contact_profile 已有 sendable email，可以选择。
- 如果 bulk result 中对应 item `can_send === true`，可以选择。
- 不选择 failed、not found、skipped without sendable email、非 drafted thread。
- 去重并保持当前 queue 顺序。

验收：

- 已有 sendable email 的 draft 即使 bulk 跳过，也会被批准。
- 新解析出 sendable email 的 draft 会被批准。
- 非 drafted thread 不会被批准。
- 低置信或无来源邮箱不会被批准。

### P2j.2 Combined UI Action

Role Workspace Gmail Outreach Sequence：

- 新增 `Resolve & approve ready` / `解析并批准可发送草稿`。
- 点击后：
  1. 调用 `/api/contact-resolution/bulk`。
  2. 展示 bulk summary。
  3. 对 helper 返回的 thread ids 逐个 PATCH 为 `approved`，并写入 sequence messages。
  4. 刷新 Role Workspace。
- 如果 provider disabled：
  - 不跑 provider lookup。
  - 仍可通过现有 `Approve ready drafts` 批准已有 sendable email 的草稿。
- 如果没有任何可批准草稿：
  - 显示 summary，不伪造成功。

验收：

- 用户能用一个动作把缺联系方式的 drafted candidates 推进到 `approved`，前提是 provider 找到 sendable email。
- UI 文案明确这是 prepare/approve，不是 send。
- 失败原因继续 inline 或 summary 可见。
- 移动端按钮保持 wrap，不造成横向溢出。

### P2j.3 Safety And Auditability

- Bulk contact resolution 继续通过 server route 执行，不在前端暴露 provider key。
- 合并动作只 PATCH outreach thread 状态，不调用 Gmail send route。
- 每个被批准的 thread 仍需要后续逐封点击 `Send`。
- 已有 contact profile 的 source/confidence/deliverability 仍由 `primaryEmail` gate 控制。

## 5. Test Plan

Unit tests:

- `outreach-readiness.test.mjs`
  - selects existing sendable drafted threads.
  - selects newly resolved drafted threads from bulk result.
  - excludes non-drafted, failed, not sendable, duplicate ids.

Source/API tests:

- `api-route-copy.test.mjs`
  - Role Workspace renders `Resolve & approve ready` / `解析并批准可发送草稿`。
  - Combined action calls `/api/contact-resolution/bulk` before approving targets.
  - Combined action does not call `/api/outreach-threads/[id]/send` or `/api/inbox/actions/send`.

Verification:

- `node --test outreach-readiness.test.mjs contact-resolution-bulk.test.mjs api-route-copy.test.mjs`
- `npm --prefix web run build`
- 两个独立 agent：
  - Product function acceptance。
  - UX/safety acceptance。

## 6. Rollout Plan

1. Add failing unit/source tests.
2. Add `web/lib/outreach-readiness.mjs` helper.
3. Wire Role Workspace combined action.
4. Run focused tests and build.
5. Run two independent acceptance agents.
6. Write release PRD, commit, merge, push, and verify production route/page availability.
