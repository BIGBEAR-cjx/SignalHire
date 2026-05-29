# SignalHire

*Find signals. Not resumes.*

SignalHire 是面向公司 HR 和猎头的全球 AI 方向人才搜索平台。用户输入 AI 人才画像或岗位
搜索 brief，系统会综合论文、开源实践、项目经历、公开演讲、技术文章、工作经历等公开
来源，扩大信息源并做交叉验证。非缓存 live research 的目标输出是可分享的候选人 shortlist、
人才地图和证据审计；内置缓存示例用于快速体验，可能返回预缓存的结构化结果。

---

## 产品定位

SignalHire 的核心不是简历库检索，而是 AI 人才画像匹配和证据可信度判断。它帮助招聘团队
把一句岗位需求扩展成可审计的人才搜索任务：先理解理想候选人的研究方向、工程能力、行业
背景和公开成果，再从多个公开来源中寻找匹配信号，最后用来源、判定和证据质量解释为什么
某个人值得进入下一轮接触。

交付形式参考 Lessie 类搜索结果，但重点放在 AI 方向人才的深度画像、匹配理由和可追溯证据，
而不是只给出大量姓名或简历链接。

## 核心工作流

| 阶段 | 内容 |
|------|------|
| 输入 | AI 人才画像或搜索 brief，例如研究方向、模型/系统经验、行业场景、地域、资历和排除条件 |
| 搜索范围 | 论文、开源贡献、项目实践、公开演讲、技术文章、工作经历、公开组织页面等公开来源 |
| 输出 | 非缓存 live research / 新版 payload 目标输出 10-15 位候选人 shortlist、人才地图、匹配分、关键匹配理由、证据审计和可分享报告 |
| 交叉验证 | 每条关键 claim 都要记录来源、判定和证据质量，避免只依赖单一简介或二手摘要 |

Verify 能力仍可作为历史兼容能力或候选人背景核验的辅助入口，但主产品定位是 AI 人才搜索、
shortlist 生成和证据可信度审计。

## How it works

```
AI 人才画像 / 搜索 brief
  └─> web/ Next.js app 先检查内置缓存和历史结果
  └─> 未命中缓存时，在 Insforge research_runs 中创建 status='queued' 的研究任务
  └─> worker/ 领取任务，并把结构化 brief 发送给 MiroMind Deep Research agent
        · 扩展搜索关键词和候选来源
        · 检索论文、开源、项目、演讲、文章、工作经历等公开信息
        · 非缓存 live research 提炼候选人、人才地图、匹配理由和关键 claims
        · 对关键 claims 做跨来源核验，并记录证据链接和证据质量
        · 流式写入研究进度，最终返回结构化 JSON
  └─> normalizeResult() guardrail: 统一 shortlist、match_score、evidence_audit 和 claims 结构
  └─> UI 渲染新版 payload 中的候选人 cards、人才地图、证据审计和可分享报告
```

MiroMind 是底层 deep-research engine：一次 API 调用负责搜索、抓取、综合和交叉验证。应用侧
重点负责队列、缓存、结构化约束、结果展示和分享链路。

### What this uses from MiroMind

- **Autonomous deep research in one call**：单次 `chat/completions` 请求触发多轮公开网络搜索、
  页面抓取、综合判断和交叉验证。
- **Streaming (`stream: true`)**：长时间研究任务需要流式返回，避免代理把非流式请求当作空闲
  连接中断；同时可以把 `reasoning_steps`（`web_search` / `fetch_url_content`）展示为实时
  研究进度。
- **OpenAI-compatible API**：model `mirothinker-1-7-deepresearch-mini` at
  `https://api.miromind.ai/v1`.

## 当前架构

SignalHire 当前由四个运行部分组成：

1. `web/` Next.js app：提供产品 UI、轻登录/auth modal、缓存示例、历史记录、分享页，以及把
   缓存未命中的搜索请求写入队列的 API routes。
2. Insforge persistence and queue：`research_runs` 存储缓存样例、用户历史、可分享报告链接、
   排队任务、进度、结果和错误。
3. `worker/` long-running Node process：轮询 `research_runs`，领取排队任务，在无 serverless
   timeout 的环境中执行 MiroMind research，并把进度和结果写回 Insforge。
4. Vercel worker-health routes：`/api/worker-health` 返回脱敏队列健康摘要；
   `/api/cron/worker-health` 由 Vercel Cron 调用，在 queued/running jobs 过旧时失败。

应用是 cache-first。内置样例和 fuzzy matches 应该无需实时 MiroMind 调用即可返回预缓存结构化
结果，用于快速体验；这些缓存结果不代表所有路径都会包含 10-15 位候选人、人才地图或证据审计。
真实非缓存搜索由 worker 生成新版 shortlist payload。非缓存输入需要 Insforge DB 访问权限，以及
带有 MiroMind credentials 的运行中 worker。生产环境需要在 Vercel 设置 `CRON_SECRET`，供 cron
route 认证。

## Quick start

要求：**Node 22+**（使用 `--env-file`）。

### 1. 配置 web 环境

从 example 创建 `web/.env.local`，并填入需要使用的服务：

```bash
cp web/.env.example web/.env.local
```

worker 执行非缓存 live research 时需要 MiroMind variables。历史记录、分享链接和 queued live
research 需要 Insforge server-side variables。浏览器 auth SDK 会使用公开的
`NEXT_PUBLIC_INSFORGE_API_BASE_URL`。

> `.env.local` 已 gitignore。不要提交真实密钥。

### 2. 运行 web app

```bash
cd web
npm ci
npm run dev
```

内置示例 chips 可能返回预缓存的结构化结果，用于快速体验，不需要 worker；真实非缓存搜索由
worker 生成新版 shortlist payload。

### 3. 运行 worker 处理 live research

```bash
cd worker
npm ci
node --env-file=../web/.env.local index.mjs
```

生产 worker 当前部署在 Railway。2026-05-28 观察到的 Railway CLI mapping 是 project
`sublime-enthusiasm`（`e994adce-23d2-40e4-bedb-67ab7031b415`）、service `SignalHire`、
environment `production`。Railway 会把 `worker/` 目录作为独立 build context，因此 worker
代码必须保持自包含，不能 import `../web` 中的文件。

### 4. 校验生产构建

```bash
cd web
npm run lint
npm run build
npm run verify:worker-health
```

## 项目结构

```
web/            Next.js app (App Router + Tailwind)
  lib/cache.ts  Pre-cached shortlist results + fuzzy query matching
  lib/db.ts     Insforge server-side access to research_runs
  lib/miro.ts   Server-side MiroMind client + prompts + normalizeResult() guardrail
  app/api/      Search, verify, status, history, and auth session routes
  app/r/[id]/   Shareable report page backed by research_runs
worker/         Long-running Node worker for queued non-cached research
```

## Live research notes

Live deep research 需要几分钟完成，因为系统会扩展搜索范围、抓取公开来源、综合候选人信息并
核验证据。web app 因此采用 **cache-first**：示例查询和能 fuzzy match 到缓存的 free-text
queries 可能立即返回预缓存结构化结果，用于快速体验；其他输入会进入 Insforge 队列，由 worker
异步处理并生成新版 shortlist payload。

---

*SignalHire v1 — AI talent search with evidence audit.*
