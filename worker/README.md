# SignalHire 异步研究 worker

跑长任务的后台 worker:轮询 `research_runs` 里 `status='queued'`/`status='retrying'` 的任务 → 跑 MiroMind 深度研究(4-10 分钟,无超时)→ 把进度/结果写回 Insforge。Vercel 函数有 60s 超时跑不完,所以长研究放这里。

## 环境变量

| 变量 | 说明 |
|------|------|
| `INSFORGE_API_BASE_URL` | Insforge 项目 URL(如 `https://xxx.insforge.app`) |
| `INSFORGE_API_KEY` | Insforge access key |
| `MIROMIND_API_KEY` / `MIROMIND_BASE_URL` / `MIROMIND_MODEL` | MiroMind 凭证 |

## 本地跑

```bash
cd worker
npm ci
node --env-file=../web/.env.local index.mjs
```

## Runtime contract

The worker is the long-running runtime for non-cached live research.

- It expects Insforge `research_runs` rows with `status='queued'`.
- It claims one row by changing `status` from `queued` or `retrying` to `running`.
- While MiroMind streams, it writes research activity into `progress`.
- On success, it writes `status='done'` plus `result`, `stats`, and `summary`.
- On transient failure, it writes `status='retrying'` plus `last_error` until `max_attempts` is reached.
- On final failure, it writes `status='error'` plus `error`.
- On each loop, it recovers stale `running` rows so worker crashes do not leave jobs orphaned.

One worker is enough for the demo. Multiple workers should be safe because each worker only proceeds
after the status-guarded claim condition succeeds.

## 部署到 Insforge Compute(方案 A)

1. Insforge 后台 → **Compute** 标签 → 新建容器/服务,指向本仓库的 `worker/` 目录(用其中的 `Dockerfile`),或推一个用此 Dockerfile 构建的镜像。
2. 配上面 5 个环境变量。
3. 选最小档(Nano ≈ $5/月,Pro 套餐 $10 额度基本覆盖)。
4. 启动后看日志应出现:`SignalHire worker 启动, 轮询 research_runs…`

> worker 与宿主无关:若 Compute 部署不顺,把 `worker/` 原样部到 Railway/Render(直接跑 Node,`git push` 自动部署)也行,环境变量一致即可。

## 部署到 Railway(当前生产)

当前 Railway CLI 看到的生产映射:

| 项 | 值 |
|----|----|
| Project ID | `e994adce-23d2-40e4-bedb-67ab7031b415` |
| Project name | `sublime-enthusiasm` |
| Service | `SignalHire` |
| Environment | `production` |

Railway 的 build context 是 `worker/`, Dockerfile 是 `worker/Dockerfile`。因此 worker 必须自包含:

- 可以 import `./job-state.mjs`、`./lib.mjs` 等 `worker/` 内文件。
- 不要 import `../web/...`; Railway 构建时不会把 `web/` 放进 worker 镜像 context。
- 部署后日志应出现 `SignalHire worker 启动, 轮询 research_runs...` 和 `health server on :$PORT`。

常用检查:

```bash
npx -y @railway/cli@4.65.0 service status --project e994adce-23d2-40e4-bedb-67ab7031b415 --service SignalHire --environment production --json
```

若 Railway/Vercel/Insforge token 曾在聊天或截图里暴露,在平台后台轮换并删除旧 token。不要把真实 secret 写入仓库、README、issue 或 PR 描述。

## 设计要点

- **认领防并发**:`update status=running where id=? and status in ('queued','retrying')` + `.select()` 确认。
- **重试**:MiroMind 长连接偶发被网络掐断 → 单次 worker 尝试内有短重试；整条任务按 `attempt_count/max_attempts` 做有界重试。
- **写库确认**:关键的"完成"写库用 `.select()` 校验行数 + 失败重试,杜绝"以为写了其实没写"。
- **失败兜底**:失败先标 `status='retrying'`,达到上限后标 `status='error'`; 每轮会恢复超时 `running` 任务,不会把任务孤儿在 running。
