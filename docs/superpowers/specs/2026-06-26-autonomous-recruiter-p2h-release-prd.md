# Autonomous Recruiter P2h Release PRD

## 1. Release Summary

本次发布把 P2g 的后台 Gmail inbox sync 从“平台日志可见”推进为“Role Workspace 可见”：

- 新增 `projects.inbox_sync_summary`，持久化每个 role 最近一次后台同步摘要。
- 后台 sync 对每个 project 写入 `source`、`ok`、`last_attempted_at`、`last_synced_at`、`scanned`、`synced`、`skipped_reason`、`error_count`、`errors`。
- `/api/projects/[id]` 返回项目级 inbox sync summary。
- Role Workspace 的 Inbox Agent 区显示 Background sync / 后台同步状态。
- Gmail 未连接或缺 readonly scope 会作为 skipped 状态展示，不误报为后台失败。
- 真正的 sync/query/write 错误会进入 `errors` 并让 cron summary `ok=false`。

## 2. Scope

包含：

- `migrations/20260626130000_autonomous_recruiter_p2h_inbox_sync_summary.sql`
- `web/lib/inbox-background-sync.mjs`
- `web/lib/inbox-background-sync.d.ts`
- `web/lib/inbox-background-sync.ts`
- `web/lib/projects.ts`
- `web/app/api/projects/[id]/route.ts`
- `web/app/app/projects/[id]/page.tsx`
- `inbox-background-sync.test.mjs`
- `api-route-copy.test.mjs`

不包含：

- Gmail watch / PubSub。
- Gmail `modify` scope。
- 自动发送候选人回复。
- 自动发送 follow-up。
- Google Calendar。
- 新 contact provider。
- 高频 Vercel cron；当前生产仍受 Hobby daily cron 限制。

## 3. Verification

已通过：

- `node --test inbox-background-sync.test.mjs inbox-sync.test.mjs inbox-thread-merge.test.mjs gmail.test.mjs api-route-copy.test.mjs` (`72/72`)
- `npm --prefix web run build`
- Production Insforge schema check: `projects.inbox_sync_summary` exists as `jsonb`

待完成：

- Product function acceptance agent。
- UX/ops acceptance agent。

## 4. Rollout Checks

- Migration 是 additive column，不删除旧数据。
- Project API 对旧项目默认返回 `{}`，页面可渲染未同步状态。
- Background sync summary 写入失败不阻断后续项目，但会进入 cron errors。
- Role Workspace 不展示 Gmail token、refresh token、Google client secret 或 raw provider URL。
- 手动 sync 按钮保留，后台状态只做可见性增强。

## 5. Known Residual Risks

- 当前 summary 是 project 级，不保留每个失败 Gmail thread 的完整明细。
- 当前 Vercel Hobby cron 只能每日运行；如果要接近 autonomous inbox，应升级 Vercel Pro 后恢复 30 分钟或更短间隔。
- P2h migration 已在当前生产 Insforge 数据库应用；后续新环境仍需运行 migration 脚本。
