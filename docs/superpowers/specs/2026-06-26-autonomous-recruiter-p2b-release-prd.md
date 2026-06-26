# Autonomous Recruiter P2b Release PRD

## 1. Summary

本发布把本地已完成并验收过的 P2b Reply-to-Action Loop 推送上线。P2b 将 Role Workspace 的 Inbox Agent 从“回复分类列表”升级为“可执行动作闭环”：

- Gmail reply classification 输出 `next_action`、`action_label`、`action_status`。
- 用户可以在 Role Workspace 中处理 reply action：mark interview-ready、save suggested draft、schedule follow-up、stop follow-up、mark reviewed。
- action 通过 `/api/inbox/actions` 写回 outreach thread，并可从 `notes` / `status` 恢复。
- Role Workspace 顶部展示今日优先动作。
- Hiring manager handoff 明确展示 evidence / risks / unverified 的空状态。

## 2. Release Goals

- 提交当前 P2b PRD、代码、测试和 UI 变更。
- 推送到 `main`，触发线上部署。
- 确认 production deployment 成功。
- 线上 smoke 至少验证：
  - `/api/inbox/actions` route 存在，未登录返回 auth error 而不是 404。
  - build route list 包含 `/api/inbox/actions`。
  - 不泄漏 Gmail token、Hunter key、Mira key。

## 3. Non-Goals

本发布不做：

- 新 contact provider。
- Calendar API。
- 自动回复候选人。
- 自动发送 follow-up。
- 修改 Gmail OAuth scopes。
- 修复本地测试账号登录态问题。
- 数据迁移。

## 4. Acceptance Criteria

- `node --test` 相关套件通过。
- `npm --prefix web run build` 通过。
- 两个独立 agent 验收已完成，提出的问题已处理或记录。
- Browser QA 桌面和移动端完成：
  - Inbox Agent 渲染。
  - 今日优先动作可见。
  - action button 可点击并显示成功反馈。
  - 移动端无横向溢出。
  - 无误导用户“系统已自动约面/自动发送”的文案。
- Git commit 和 push 成功。
- Production deployment ready。

## 5. Rollback Plan

如果线上 smoke 失败：

- 优先回滚本次 commit。
- 如果只是 auth-gated smoke 返回 401，且 route 存在、build 成功，则不回滚。
- 如果 `/api/inbox/actions` 线上 404 或 build route 缺失，回滚本次发布。

## 6. Verification Commands

```bash
node --test candidate-graph.test.mjs people-providers.test.mjs contact-providers.test.mjs contact-resolution-route.test.mjs openjobs-provider.test.mjs openjobs-route.test.mjs contact-profile.test.mjs contact-resolution.test.mjs gmail-outreach.test.mjs inbox-agent.test.mjs inbox-actions.test.mjs outreach-threads.test.mjs api-route-copy.test.mjs search-tasks.test.mjs talent-profile.test.mjs history-filters.test.mjs i18n.test.mjs
npm --prefix web run build
```

## 7. Known Risk

本地真实测试账号登录态在 QA 时仍被 app 识别为未登录；P2b 的 Role Workspace rendered QA 使用 mock authenticated API 完成。这不阻塞 P2b 发布，但后续应单独排查 auth/session 同步问题。
