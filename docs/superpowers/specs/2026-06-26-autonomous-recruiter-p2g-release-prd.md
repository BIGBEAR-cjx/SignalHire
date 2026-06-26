# Autonomous Recruiter P2g Release PRD

## 1. Release Summary

本次发布将 P2f 的手动 Gmail reply sync 推进为后台定期 sync：

- 新增 `/api/cron/inbox-sync`，使用 `CRON_SECRET` Bearer 鉴权。
- 新增 background inbox sync runner，从活跃 outreach threads 中选择需要同步的 role。
- 每次 cron run 默认最多处理 10 个项目，每个项目最多扫描 20 个 Gmail thread。
- Vercel 生产 cron 当前使用 daily schedule，以兼容 Hobby plan；升级 Pro 后可恢复 30 分钟级同步。
- 复用 P2f 的 `syncGmailInboxForProject`，不复制 inbox 分类逻辑。
- 返回 ops-friendly summary：项目数、thread 数、同步回复数、跳过原因、错误和运行时间。

## 2. Scope

包含：

- `web/lib/inbox-background-sync.mjs`
- `web/lib/inbox-background-sync.ts`
- `web/lib/inbox-background-sync.d.ts`
- `web/app/api/cron/inbox-sync/route.ts`
- `web/vercel.json`
- `web/lib/inbox-sync-core.mjs`
- `web/lib/inbox.ts`
- `inbox-background-sync.test.mjs`
- `api-route-copy.test.mjs`

不包含：

- 自动发送回复。
- 自动发送 follow-up。
- Gmail `modify` scope。
- Google Calendar。
- Gmail watch / PubSub。
- 全量 inbox 扫描。

## 3. Verification

已通过：

- `node --test inbox-background-sync.test.mjs inbox-sync.test.mjs inbox-thread-merge.test.mjs gmail.test.mjs api-route-copy.test.mjs` (`68/68`)
- `npm --prefix web run build`

## 4. Rollout Checks

- Cron route 使用 `CRON_SECRET`，未授权返回 401。
- Route 不暴露 Gmail token、refresh token、Google client secret 或 token encryption key。
- Runner 只选择有 `gmail_thread_id` 的活跃 outreach thread。
- stopped/bounced/rejected/hired 不进入后台 sync；即使同项目被 active thread 选中，sync core 也不会扫描这些 inactive thread。
- 单项目失败不会阻断后续项目。
- Query/listProjects 失败和 sync errors 会让 summary `ok=false` 并进入 `errors`。
- Gmail 未连接等可预期跳过会进入 `skipped`，不把整次 cron 标成失败。
- 空结果返回成功 summary。

## 5. Known Residual Risks

- 当前 Vercel cron 为每日一次以兼容 Hobby plan；如果需要“少管 inbox”的准实时体验，应升级 Vercel Pro 后改回 30 分钟或更短间隔。
- Runner 使用 outreach thread 查询作为候选项目来源；如果 future schema 拆分 role/outreach，需要同步更新选择逻辑。
- 未做 Vercel cron 真实线上 run 日志抽样；发布后应观察首轮 `/api/cron/inbox-sync` 日志。
