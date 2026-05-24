# SignalHire 异步研究 worker

跑长任务的后台 worker:轮询 `research_runs` 里 `status='queued'` 的任务 → 跑 MiroMind 深度研究(4-10 分钟,无超时)→ 把进度/结果写回 Insforge。Vercel 函数有 60s 超时跑不完,所以长研究放这里。

## 环境变量

| 变量 | 说明 |
|------|------|
| `INSFORGE_API_BASE_URL` | Insforge 项目 URL(如 `https://xxx.insforge.app`) |
| `INSFORGE_API_KEY` | Insforge access key |
| `MIROMIND_API_KEY` / `MIROMIND_BASE_URL` / `MIROMIND_MODEL` | MiroMind 凭证 |

## 本地跑

```bash
cd worker
npm install
node --env-file=../web/.env.local index.mjs
```

## 部署到 Insforge Compute(方案 A)

1. Insforge 后台 → **Compute** 标签 → 新建容器/服务,指向本仓库的 `worker/` 目录(用其中的 `Dockerfile`),或推一个用此 Dockerfile 构建的镜像。
2. 配上面 5 个环境变量。
3. 选最小档(Nano ≈ $5/月,Pro 套餐 $10 额度基本覆盖)。
4. 启动后看日志应出现:`SignalHire worker 启动, 轮询 research_runs…`

> worker 与宿主无关:若 Compute 部署不顺,把 `worker/` 原样部到 Railway/Render(直接跑 Node,`git push` 自动部署)也行,环境变量一致即可。

## 设计要点

- **认领防并发**:`update status=running where id=? and status='queued'` + `.select()` 确认。
- **重试**:MiroMind 长连接偶发被网络掐断 → 整次研究最多重试 3 次。
- **写库确认**:关键的"完成"写库用 `.select()` 校验行数 + 失败重试,杜绝"以为写了其实没写"。
- **失败兜底**:多次失败标 `status='error'`,前端停止轮询并报错,不会把任务孤儿在 running。
