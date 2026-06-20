# SignalHire

*Find signals. Not resumes.*

SignalHire 是一个 evidence-first recruiting workspace。它把岗位 brief、人才画像或候选人资料
转成可审计的公开证据搜索任务，输出候选人 shortlist、匹配理由、来源链接、证据风险、项目候选
池、持续搜人任务和外联草稿。

**Live demo:** https://signal-hire-eight.vercel.app

**Core app entry:** https://signal-hire-eight.vercel.app/app/search

---

## 当前产品状态

SignalHire 的主线已经从单次 AI 人才搜索，扩展为面向互联网岗位的证据优先搜人与交付工作台：

- **Role-aware sourcing**：从粘贴的 JD 或自然语言 brief 中识别岗位类型、雇主上下文、must-have、
  nice-to-have、排除项和来源策略。当前策略层覆盖软件工程、AI/ML/Data、产品、设计、增长、运营、
  销售/BD、客户成功、安全/DevOps、战略/运营、职能支持和高管/创始人等 12 类互联网岗位。
- **Agent execution layer**：搜索结果不只显示候选人，还显示搜索策略、执行 trace、来源组合、候选
  提交事件、delivery clusters 和下一步建议。
- **Evidence-first shortlist**：候选人卡片保留匹配分、强/弱证据、claim verdict、来源链接、证据
  coverage 和待验证风险，避免把单一来源或自述包装成强推荐。
- **Candidate profile cache**：成功搜索会把候选人快照、证据 URL、来源类型和标签写入
  `candidate_profiles` / `candidate_evidence_sources`，用于去重、相似候选人和下一轮召回提示。
- **Open evidence precheck**：worker 在 MiroMind deep research 前可用 GitHub、Hugging Face、
  OpenAlex、Semantic Scholar、OpenReview、AnySearch 和可选 Maigret 做公开证据预检，并把候选线索
  写入 `open_evidence_leads`。
- **Projects and Talent Monitor**：项目页维护候选人池、候选人状态、反馈信号、下一轮搜索约束，以及
  `search_tasks` 持续搜人任务；Vercel Cron 可触发 due tasks。
- **Outreach threads**：外联草稿和跟进事项保存在 `outreach_threads`，关联项目和 shortlist item。
  v1 保持手动复制发送，不自动发邮件。

内置缓存示例用于快速体验。非缓存 live research 需要 Insforge、MiroMind 和运行中的 worker，通常需要
几分钟完成。

## 核心工作流

| 阶段 | 内容 |
|------|------|
| 输入 | JD、岗位 brief、人才画像、候选人资料或项目下一轮搜索约束 |
| Intake | 清理 JD 噪音，分离雇主上下文与候选人要求，生成 role category、channel plan 和 query clusters |
| 预检 | 可选公开来源预检，写入 `open_evidence_leads`，但不把预检线索当作已验证候选人 |
| Deep research | worker 领取队列任务，调用 MiroMind 搜索、抓取、综合和交叉验证公开证据 |
| 输出 | shortlist、talent map、search plan、execution trace、delivery clusters、evidence graph、share report |
| 迭代 | 候选人加入项目池，反馈进入下一轮搜索约束，search tasks 可持续运行，外联草稿保留跟进状态 |

Verify 能力仍作为候选人背景核验的辅助入口；主产品定位是证据可追溯的搜人、候选判断和项目迭代。

## How it works

```text
Hiring brief / JD / candidate text
  -> web/ Next.js app
  -> role-aware intake + cache/history lookup
  -> Insforge research_runs queue
  -> worker/ long-running Node process
      -> open evidence precheck
      -> MiroMind Deep Research API
      -> streaming progress + agent execution telemetry
  -> normalized talent payload
  -> search workspace / project pool / shortlist / outreach / share report
```

MiroMind 是底层 deep-research engine。SignalHire 负责队列、缓存、公开证据预检、结构化 guardrails、
项目工作台、外联记录和交付 UI。

## 当前架构

| 部分 | 职责 |
|------|------|
| `web/` | Next.js App Router UI、API routes、auth/session sync、搜索工作台、项目、shortlist、history、public report |
| `web/lib/talent-profile.mjs` | 搜索 payload normalizer、role-aware strategy、agent execution layer、evidence dossier、cache rows |
| `web/lib/db.ts` | Insforge `research_runs`、history、feedback、retry/cancel、candidate cache 和 search queue access |
| `web/lib/search-tasks.*` | Talent Monitor / AI Sourcer tasks、due run 计算、候选人新增/证据更新分类 |
| `web/lib/outreach-threads.*` | 外联草稿、状态、跟进时间和项目/候选人关联 |
| `worker/` | 长任务运行时，领取 queued/retrying jobs，执行公开证据预检和 MiroMind live research |
| `migrations/` | `research_runs` 可靠性、candidate cache、open evidence leads、search tasks、outreach threads |
| `docs/` | 架构、验证、研究记录、PRD 和迭代计划 |

生产上 web 部署到 Vercel；worker 可部署到 Railway、Insforge Compute 或其他长期运行的 Node/Docker
宿主。worker 必须保持自包含，不能 import `../web`，因为 Railway build context 是 `worker/`。

## Persistence model

| 表 / 字段 | 用途 |
|-----------|------|
| `research_runs` | 搜索/核验历史、队列状态、progress、result、share report、retry/cancel |
| `research_runs.result.agent_execution` | 搜索策略、执行 trace、candidate submission events、delivery clusters、telemetry |
| `candidate_profiles` | 成功搜索后的候选人快照、标签、来源类型、召回和去重 cache |
| `candidate_evidence_sources` | 归一化后的候选人证据 URL、claim、verdict、source family |
| `open_evidence_leads` | worker 预检阶段发现的公开候选线索，身份解析前只作 lead |
| `search_tasks` | 项目内持续搜人任务、frequency、next run 和 last run |
| `outreach_threads` | 外联草稿、手动联系状态、notes 和 follow-up 时间 |

## Quick start

要求：**Node 22+**（项目使用 `--env-file` / `--env-file-if-exists`）。

### 1. 配置环境

```bash
cp web/.env.example web/.env.local
```

必填：

- `INSFORGE_API_BASE_URL`
- `INSFORGE_API_KEY`
- `NEXT_PUBLIC_INSFORGE_API_BASE_URL`
- `MIROMIND_API_KEY`
- `MIROMIND_BASE_URL`
- `MIROMIND_MODEL`

可选公开证据 precheck：

- `GITHUB_TOKEN`
- `SEMANTIC_SCHOLAR_API_KEY`
- `OPENALEX_API_KEY`
- `HF_TOKEN`
- `ANYSEARCH_API_KEY`
- `OPEN_EVIDENCE_MAX_QUERIES`
- `MAIGRET_ENABLED` / `MAIGRET_COMMAND` / `MAIGRET_*`

> `.env.local` 已 gitignore。不要提交真实密钥。

### 2. 安装并运行 web app

```bash
cd web
npm ci
npm run dev
```

内置 demo/cache 路径可不依赖 worker 快速体验；非缓存 live research 会进入 Insforge 队列。

### 3. 应用数据库迁移

在 `web/.env.local` 或 shell 中配置 Insforge server-side variables 后：

```bash
npm --prefix web run migrate:ai-cache
npm --prefix web run verify:schema
```

`migrate:ai-cache` 当前会应用：

- `migrations/20260612110000_candidate-profile-cache.sql`
- `migrations/20260615100000_dinq-recruiting-agent-mvp.sql`

### 4. 运行 worker

```bash
cd worker
npm ci
node --env-file=../web/.env.local index.mjs
```

worker 默认 `WORKER_CONCURRENCY=3`，并会把请求值 clamp 到最大 3。它使用状态保护领取 queued/retrying
jobs，写入 streaming progress，失败时进入 bounded retry，并恢复 stale running jobs。

### 5. 生产监控

`web/vercel.json` 配置了两个 cron routes：

- `/api/cron/worker-health`：每日检查队列健康。
- `/api/cron/search-tasks`：每日触发 due Talent Monitor tasks。

生产环境需要设置 `CRON_SECRET`，cron routes 会校验 `Authorization: Bearer $CRON_SECRET`。

## 验证

Last verified locally: 2026-06-20

```bash
git diff --check
node --test api-route-copy.test.mjs open-evidence-sources.test.mjs run-storage.test.mjs talent-profile.test.mjs landing-redesign.test.mjs outreach-threads.test.mjs search-tasks.test.mjs talent-intelligence.test.mjs worker-concurrency.test.mjs
npm --prefix web run build
```

结果：空白检查、130 个 Node tests、Next.js production build 均通过。

常用环境检查：

```bash
npm --prefix web run verify:schema
npm --prefix web run verify:worker-health
npm --prefix web run verify:live
npm --prefix web run verify:retry
```

`verify:live` 需要 web server、worker、Insforge 和 MiroMind 都可用；生产 live smoke test 还需要登录
cookie/token 或测试账号。

## 项目结构

```text
README.md       Product, architecture, runtime, migration, and verification entry point
PRODUCT.md      Product audience, purpose, personality, and design principles
DESIGN.md       SignalHire design system and UI rules
docs/
  ARCHITECTURE.md
  DEMO.md
  verification.md
  research/
  superpowers/
web/            Next.js app (App Router + Tailwind)
  app/          Public landing, app shell, API routes, projects, search, reports
  components/   Search workspace, result views, outreach modal, shared UI
  lib/          Domain helpers, Insforge access, MiroMind client, task/outreach/cache logic
  scripts/      Schema, migration, live-job, retry, worker-health checks
worker/         Long-running Node worker for non-cached live research
migrations/     Research queue, candidate cache, open evidence, search tasks, outreach tables
*.test.mjs      Node test suites for domain helpers and integration contracts
```

## Guardrails

- SignalHire 不抓取登录态、私密数据、邮箱/电话，也不绕过 CAPTCHA 或反爬。
- LinkedIn profile crawling 默认禁止；未来如接入，只能走合规官方 API/provider。
- `open_evidence_leads` 是发现线索，不是已验证证据。
- 候选人身份合并不能只靠姓名，需要 GitHub、Scholar、个人站点、公司页或多来源强标识。
- 外联 v1 保存草稿和跟进，不自动发送邮件。

---

*SignalHire v1 — evidence-first sourcing, candidate judgment, and recruiting execution.*
