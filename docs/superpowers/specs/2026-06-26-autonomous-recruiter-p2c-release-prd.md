# Autonomous Recruiter P2c Release PRD

## 1. Summary

本发布把已经完成并通过双 agent 验收的 P2c Live Contact Provider Resolution 合并到 `main` 并发布线上。P2c 的产品目标是让 Role Workspace 可以对缺联系方式的 outreach draft 进行可控批量解析，并用 Hunter 作为第一个 live contact provider 的实现路径。

本 PRD 只覆盖发布集成，不新增业务功能。

## 2. Scope

包含：

- 将 `codex/p2c-live-contact-provider` 合并到 `main`。
- 保留 P2c PRD、bulk contact resolution API、contact resolution cache gate、provider error persistence、Role Workspace bulk UX 和测试。
- 在 `main` 上重新运行 P2c 相关 Node tests。
- 在 `main` 上重新运行 `npm --prefix web run build`。
- 推送 `main` 到远端，触发 Vercel deployment。
- 确认 deployment 进入 ready 或明确记录阻断原因。

不包含：

- 配置真实 `HUNTER_API_KEY`。
- 真实消耗 Hunter credits 的线上 smoke。
- 真实 Gmail 发信 smoke。
- 新增 Prospeo / Findymail / PDL live adapter。
- 自动发送 follow-up。
- Google Calendar / ATS 集成。

## 3. Acceptance Criteria

- `main` 包含 P2c commit。
- 工作树干净。
- `node --test contact-resolution.test.mjs contact-resolution-route.test.mjs contact-resolution-bulk.test.mjs contact-providers.test.mjs api-route-copy.test.mjs` 通过。
- `npm --prefix web run build` 通过。
- `git push origin main` 成功。
- Vercel production deployment 对应最新 commit，且状态为 ready；如果被 Vercel security / auth checkpoint 阻挡 smoke，要说明这是 smoke 边界而不是 build failure。

## 4. Rollback Plan

- 如果 merge 冲突，停止并修复冲突后重新运行测试。
- 如果 main 上测试或 build 失败，不推送。
- 如果 Vercel deployment 失败，保留 main 提交但不标记发布完成，查看 deployment logs 后修复。
- 如果线上 smoke 受 Vercel auth/security checkpoint 影响，保留 deployment ready 作为发布证明，不声称业务流已线上点击验证。
