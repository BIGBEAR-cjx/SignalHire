# Autonomous Recruiter P2d Release PRD

## 1. Summary

本发布把已经完成并通过双 agent 验收的 P2d Scheduling Coordinator 合并到 `main` 并发布线上。P2d 的产品目标是让 interested candidate 从“回复分类”进一步进入可处理的约面交接：用户可以复制候选人约面回复、复制 hiring manager handoff，并将候选人标记为 interview-ready。

本 PRD 只覆盖发布集成，不新增业务功能。

## 2. Scope

包含：

- 将 `codex/p2d-scheduling-coordinator` 合并到 `main`。
- 保留 P2d PRD、scheduling packet view model、candidate reply、manager handoff、interview-ready action persistence、Role Workspace UX 和测试。
- 在 `main` 上重新运行 P2d 相关 Node tests。
- 在 `main` 上重新运行 `npm --prefix web run build`。
- 推送 `main` 到远端，触发 Vercel production deployment。
- 确认 deployment 对应最新 commit 且状态为 ready。

不包含：

- Google Calendar API。
- 自动发送候选人回复。
- 自动发送 follow-up。
- Gmail modify / label 权限。
- ATS 同步。
- 线上真实 Gmail 发信 smoke。

## 3. Acceptance Criteria

- `main` 包含 P2d commit。
- 工作树干净。
- `node --test inbox-agent.test.mjs inbox-actions.test.mjs api-route-copy.test.mjs` 通过。
- `npm --prefix web run build` 通过。
- `git push origin main` 成功。
- Vercel production deployment 对应最新 commit，且状态为 ready。

## 4. Rollback Plan

- 如果 merge 冲突，停止并修复冲突后重新运行测试。
- 如果 main 上测试或 build 失败，不推送。
- 如果 Vercel deployment 失败，保留本地 main 提交但不标记发布完成，先查看 deployment logs。
- 如果线上 smoke 受 Vercel auth/security checkpoint 影响，只记录 deployment ready，不声称真实业务流已线上点击验证。
