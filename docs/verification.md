# 验证说明

## 静态检查

运行 web 检查：

```bash
cd web
npm run lint
npm run build
npm run verify:worker-health
```

运行 worker 语法检查：

```bash
cd worker
node --check index.mjs
node --check lib.mjs
```

修改 queue 或 worker 之后，运行共享 job-state 检查：

```bash
node --test job-state.test.mjs
```

## 已知本地环境说明

在受限 sandbox 中，`next build` 可能因为 Turbopack 尝试 `binding to a port` 而报
`Operation not permitted`。如果发生这种情况，先在不受限的本地终端重新运行 build，再判断是否
是产品问题。

## 需要真实凭证的检查

依赖凭证的检查需要 `web/.env.local` 中配置 Insforge 和 MiroMind values。

## 写入示例报告

命令：

```bash
cd web && node --env-file=.env.local scripts/seed-db.mjs
```

期望：所有 JSON seed files 都打印 `ok`。

## 检查 research_runs schema

命令：

```bash
cd web && npm run verify:schema
```

期望：`research_runs schema ok`。如果因为缺少 column 失败，先补齐
`docs/insforge-research-runs.md` 中列出的 v1 columns，再运行 live jobs。

## 运行 web app

命令：

```bash
cd web && npm run dev
```

期望：页面可以加载，缓存示例可用，seeded history 可见，分享报告链接可访问。

## 运行 worker

命令：

```bash
cd worker && node --env-file=../web/.env.local index.mjs
```

期望：logs 显示 worker 启动和处理进度，status updates 能反映 worker 行为。

## Worker health 和生产监控

公开 health summary：

```bash
curl -fsS "$APP_BASE_URL/api/worker-health"
```

脚本检查：

```bash
cd web
APP_BASE_URL=https://your-production-host npm run verify:worker-health
```

期望：JSON 中包含 `"ok": true`。非 2xx 响应表示 queued、retrying 或 running jobs 超过共享的
stale threshold，或 server 无法读取 Insforge。

Vercel Cron 会在生产部署上调用 `/api/cron/worker-health`。它需要在 Vercel environment 中配置
`CRON_SECRET`，因为 route 会校验 `Authorization: Bearer $CRON_SECRET`。当前
`web/vercel.json` schedule 是每日一次（`0 0 * * *`），所以仍符合 Vercel Hobby 限制；incident
期间使用 `verify:worker-health` script 做 on-demand checks。

Railway 生产 worker 检查：

```bash
npx -y @railway/cli@4.65.0 service status --project e994adce-23d2-40e4-bedb-67ab7031b415 --service SignalHire --environment production --json
```

2026-05-28 观察到的 Railway CLI mapping 是 project `sublime-enthusiasm`、service `SignalHire`、
environment `production`。worker Docker build context 是 `worker/`，所以 worker code 不能 import
`../web` 中的文件。

## Research job 可靠性检查

对于带真实凭证的非缓存查询：

- `/api/search` 或 `/api/verify` 返回 `{ queued: true, jobId }`。
- `/api/status?id=<jobId>` 会随着 job 在 `queued`、`running`、`retrying`、`done`、`error`
  之间流转而返回对应的 `status_view.phase`。
- 如果 worker 在某行处于 `running` 时崩溃，后续 worker loop 会把 stale row 移回 `retrying`。
- 如果某行最终进入 `error`，`POST /api/retry` 携带 `{ "id": "<jobId>" }` 会把它移回 `queued`。

脚本检查：

```bash
cd web
npm run verify:schema
npm run verify:live
npm run verify:retry
```

`verify:live` 期望 web server 和 worker 已经在运行。它会提交一个稳定的、非缓存的 AI 人才搜索
brief，然后轮询 `/api/status`，直到任务进入 `done` 或 `error`。任务完成后，它会校验新版
payload：`search_brief`、`talent_map`、10-15 位 `candidates`、每位候选人的 `match_score`、
`evidence_audit`，以及可追溯的 `claims`。

`verify:live` 保持 human-facing query 稳定且真实。它会发送私有
`x-signalhire-verify-run-id` header 来绕过 DB cache，便于 smoke tests 每次都跑 live job，同时
不会把 timestamps 或 random IDs 写进 MiroMind 需要研究的 prompt。它还会用 exponential backoff
重试短暂的 fetch/TLS/5xx failures。

`verify:retry` 会创建一条 synthetic `error` row，调用 `/api/retry`，确认该 row 回到 `queued`，
然后删除 synthetic row。
