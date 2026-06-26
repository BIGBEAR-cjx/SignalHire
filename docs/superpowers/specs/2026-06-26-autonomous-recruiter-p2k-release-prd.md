# Autonomous Recruiter P2k Release PRD

## 1. Release Summary

本次发布补齐 P2j 的执行反馈缺口：`Resolve & approve ready` 完成后，Role Workspace 会显示本次 approval outcome，而不是只显示 contact resolution summary。

- 新增 `buildOutreachApprovalOutcome`。
- `prepareOutreachReadyDrafts` 收集每个 approval PATCH 的成功/失败结果。
- UI 展示：
  - no target
  - all approved
  - partial failed
  - all failed
- 失败项展示 candidate name/id 和 error。
- Outcome summary 明确显示 `No emails were sent.` / `未发送邮件。`
- PATCH HTTP failure 和 thrown network failure 都会进入 failed outcome。
- 不改变 contact provider、Gmail send、send eligibility 或 outreach thread schema。

## 2. Scope

包含：

- `docs/superpowers/specs/2026-06-26-autonomous-recruiter-p2k-approval-outcome-prd.md`
- `docs/superpowers/specs/2026-06-26-autonomous-recruiter-p2k-release-prd.md`
- `web/lib/outreach-readiness.mjs`
- `web/lib/outreach-readiness.d.ts`
- `web/app/app/projects/[id]/page.tsx`
- `outreach-readiness.test.mjs`
- `api-route-copy.test.mjs`

不包含：

- 后端批量 approval API。
- PATCH retry。
- 自动发送 Gmail。
- contact provider 变更。
- schema migration。

## 3. Verification

已通过：

- `node --test outreach-readiness.test.mjs contact-resolution-bulk.test.mjs contact-resolution-route.test.mjs contact-resolution.test.mjs contact-providers.test.mjs api-route-copy.test.mjs` (`83/83`)
- `npm --prefix web run build`

验收：

- Product function acceptance agent：PASS。
- UX/safety acceptance agent：PASS。

## 4. Rollout Checks

- `Resolve & approve ready` 仍只调用 contact resolution bulk 和 outreach thread PATCH。
- Combined action 不调用 `/api/outreach-threads/[id]/send` 或 `/api/inbox/actions/send`。
- PATCH 失败会进入 `approvalOutcome.failed_items`，不会静默丢失。
- PATCH fetch 抛错也会进入 `approvalOutcome.failed_items`，不会跳过 summary。
- Summary 仅是本次前端动作反馈，不写 DB。
- Server state 仍通过 workspace refresh 成为最终事实来源。

## 5. Known Residual Risks

- P2k 展示失败项，但不自动重试。用户可重新点击 prepare 或手动批准。
- 如果 workspace refresh 失败，summary 仍显示本次前端收集结果；下一次页面加载会以服务端状态为准。
