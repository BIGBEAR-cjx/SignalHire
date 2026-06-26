# Autonomous Recruiter P2k PRD: Approval Outcome Visibility

## 1. Summary

P2j 已经把 contact resolution 和 ready draft approval 合并成一个动作，但 release PRD 仍保留一个真实操作风险：合并动作会连续 PATCH 多个 outreach threads；如果中途网络失败，用户只能通过刷新后的状态间接判断哪些已批准、哪些失败。

P2k 的目标是把这个结果变成明确、可审计的 UI summary：`Resolve & approve ready` 完成后，Role Workspace 直接展示本次批准了多少 drafts、哪些失败、是否没有可批准目标。P2k 不改变 provider、approval、send 或 Gmail 逻辑，只提升执行反馈。

## 2. Goals

- 为 P2j combined action 增加 approval outcome summary。
- 记录并展示：
  - attempted approval count
  - approved count
  - failed count
  - skipped/no-target state
  - failed candidate names / ids
- PATCH 失败不能静默吞掉；用户应看到失败项。
- 成功/失败后仍刷新 Role Workspace，让 server state 成为最终事实来源。

## 3. Non-Goals

本阶段不做：

- 重试队列。
- 后端批量 approval API。
- 自动发送 Gmail。
- 修改 contact resolution provider。
- 修改 send eligibility。
- 修改 outreach thread schema。
- 引入 toast 系统或全局通知组件。

## 4. Product Behavior

### P2k.1 Approval Outcome View Model

新增纯 helper：

- `buildOutreachApprovalOutcome({ targets, approved, failed })`

输出：

- `attempted`
- `approved`
- `failed`
- `status`: `none` | `all_approved` | `partial_failed` | `all_failed`
- `failed_items`

规则：

- 没有 targets：`status = "none"`。
- targets 全成功：`status = "all_approved"`。
- 部分失败：`status = "partial_failed"`。
- 全部失败：`status = "all_failed"`。

验收：

- 0 target、全成功、部分失败、全失败都可区分。
- failed item 保留 id/name/error，便于用户定位。

### P2k.2 Role Workspace Summary

在 Gmail Outreach Sequence 的 contact resolution summary 下方显示 approval outcome：

- English:
  - `No ready drafts approved.`
  - `Approved 3 ready drafts.`
  - `Approved 2 ready drafts; 1 failed.`
- Chinese:
  - `本次没有可批准草稿。`
  - `已批准 3 条可发送草稿。`
  - `已批准 2 条可发送草稿；1 条失败。`

失败项展示 candidate name 或 thread id，以及 error。

验收：

- 用户点击 `Resolve & approve ready` 后能知道批准结果，而不是只看到 contact resolution summary。
- PATCH 失败不会被隐藏。
- 文案继续说明这是 approve，不是 send。

### P2k.3 Safety

- 合并动作仍不调用 send route。
- Outcome summary 不改变 provider cost guard。
- Summary 只来自本次前端动作，不写入 DB。

## 5. Test Plan

Unit tests:

- `outreach-readiness.test.mjs`
  - `buildOutreachApprovalOutcome` returns `none` for no targets.
  - returns `all_approved` when all targets succeed.
  - returns `partial_failed` with failed item details.
  - returns `all_failed` when no approvals succeed.

Source/UI tests:

- `api-route-copy.test.mjs`
  - Role Workspace imports `buildOutreachApprovalOutcome`.
  - `prepareOutreachReadyDrafts` records approval failures instead of ignoring PATCH response.
  - UI renders `approvalOutcome` summary.
  - Combined action still does not call send route.

Verification:

- `node --test outreach-readiness.test.mjs api-route-copy.test.mjs`
- `npm --prefix web run build`
- Two independent agents:
  - Product function acceptance。
  - UX/safety acceptance。

## 6. Rollout Plan

1. Add failing unit and source tests.
2. Add approval outcome helper.
3. Wire P2j combined action to collect PATCH results.
4. Render outcome summary under bulk contact summary.
5. Run focused tests/build.
6. Run two independent agents.
7. Write release PRD, commit, push, verify production.
