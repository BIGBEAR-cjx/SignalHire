# Autonomous Recruiter P2f Release PRD

## 1. Release Summary

本次发布将 P2 Inbox Agent 从“可手动同步和分类”推进到“可运营的 Gmail reply loop”：

- Gmail access token 过期时可通过 refresh token 刷新，并持久化新的 encrypted token bundle。
- Gmail sync 返回结构化结果，包含连接状态、readonly scope、扫描数、同步数、错误、跳过原因和最后同步时间。
- Inbox Agent 输出 `today_queue`，把待约面、待回复、到期 follow-up、人工复核按优先级排序。
- Role Workspace 展示 Sync result、last synced、readonly 缺失重新授权入口和 Today priority queue。
- Reply sync 会将主要回复分类推进到 outreach thread 状态，仍保持 human-in-loop，不自动发送回复或 follow-up。

## 2. Scope

包含：

- `web/lib/gmail-token.mjs` / `.d.ts`
- `web/lib/gmail.ts`
- `web/lib/inbox-sync-core.mjs` / `.d.ts`
- `web/lib/inbox.ts`
- `web/lib/inbox-agent.mjs`
- `web/app/app/projects/[id]/page.tsx`
- `gmail.test.mjs`
- `inbox-sync.test.mjs`
- `inbox-agent.test.mjs`
- `api-route-copy.test.mjs`

不包含：

- 自动发送候选人回复。
- 自动发送 follow-up。
- Google Calendar API。
- Gmail `modify` scope。
- 新 contact provider。
- Apollo。

## 3. Verification

已通过：

- `node --test gmail-outreach.test.mjs gmail.test.mjs inbox-agent.test.mjs inbox-actions.test.mjs inbox-sync.test.mjs inbox-thread-merge.test.mjs api-route-copy.test.mjs` (`83/83`)
- `npm --prefix web run build`

浏览器 smoke：

- 本地 dev server 使用当前分支启动成功。
- `/app/projects` desktop/mobile 未出现横向溢出。
- Playwright 登录测试账号后仍落入本地 auth fallback，未能完成真实 Role Workspace 已登录视觉验收；因此 Role Workspace 视觉部分主要由 source check、build 和独立 UX agent 只读验收覆盖。

## 4. Rollout Checks

- Gmail token 或 secret 不返回前端。
- 缺少 Gmail 连接或 readonly scope 时 sync 不抛出原始错误，返回结构化状态。
- `today_queue` 不包含 stopped/bounced 作为今日待处理。
- UI 文案明确“建议下一步”，不声称已自动发送。

## 5. Known Residual Risks

- 本地 auth 状态阻断真实 Role Workspace 浏览器截图，发布前无法完全证明登录后页面的视觉状态。
- Gmail refresh 依赖 refresh token；没有 refresh token 的旧连接会返回 `gmail_reconnect_required` 并提示用户重新授权。
- Sync 仍是手动触发，未接 cron 或后台自动同步。
- Refresh 后未强制校验 `saveConnection` 返回值；如果数据库写入失败，本次请求仍可继续，但后续可能再次 refresh。
