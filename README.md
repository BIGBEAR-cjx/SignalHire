# SignalHire

*Find signals. Not resumes.*

SignalHire 是一个 role-based AI recruiting workspace。它把岗位 brief、人才画像或候选人资料
转成可执行的搜人、证据审阅、联系方式准备、外联、回复处理和候选人交付流程，输出 shortlist、
匹配理由、来源链接、证据风险、联系方式置信度、外联序列、项目候选池、持续搜人任务和客户可见报告。

**Live demo:** https://signal-hire-eight.vercel.app

**Core app entry:** https://signal-hire-eight.vercel.app/app/search

---

## 当前产品状态

SignalHire 的主线已经从单次 AI 人才搜索，扩展为面向互联网岗位的 role agent 招聘工作台：

- **Role-aware sourcing**：从粘贴的 JD 或自然语言 brief 中识别岗位类型、雇主上下文、must-have、
  nice-to-have、排除项和来源策略。当前策略层覆盖软件工程、AI/ML/Data、产品、设计、增长、运营、
  销售/BD、客户成功、安全/DevOps、战略/运营、职能支持和高管/创始人等 12 类互联网岗位。
- **Agent execution layer**：搜索结果不只显示候选人，还显示搜索策略、执行 trace、来源组合、候选
  提交事件、delivery clusters 和下一步建议。
- **Fast lead preview**：搜索运行中即可展示 unverified leads 和 `open_evidence_leads`，用户可以先判断方向；
  preview leads 明确不能直接外联，直到公开证据和联系方式来源被复核。
- **Evidence-first shortlist**：候选人卡片保留匹配分、强/弱证据、claim verdict、来源链接、证据
  coverage 和待验证风险，避免把单一来源或自述包装成强推荐。
- **CandidateGraph and source mix**：成功搜索会把候选人快照、证据 URL、来源类型和标签写入
  `candidate_profiles` / `candidate_evidence_sources`，并在 Role Workspace 中展示多来源候选人图、
  profile leads、LinkedIn URL seed、internal resume/manual upload、source mix、去重和 readiness。
- **Open evidence precheck**：worker 在 MiroMind deep research 前可用 GitHub、Hugging Face、
  OpenAlex、Semantic Scholar、OpenReview、AnySearch 和可选 Maigret 做公开证据预检，并把候选线索
  写入 `open_evidence_leads`。
- **Projects and Talent Monitor**：项目页维护候选人池、候选人状态、反馈信号、下一轮搜索约束，以及
  `search_tasks` 持续搜人任务；Vercel Cron 可触发 due tasks。
- **Profile lead and contact resolution**：可选 OpenJobs/Mira profile lead provider 和 Hunter contact provider
  支持候选人扩展、联系方式解析、source/confidence/deliverability 标注和 contactability score。
- **Gmail Outreach Sequence**：`outreach_threads` 支持 3-step evidence-based sequence、逐步编辑/审核、
  批量解析联系方式、批准草稿、Gmail draft/send、follow-up draft、失败重试和 sequence analytics。
- **Inbox Agent and scheduling**：Gmail 线程可同步并分类 interested、ask for details、later、not interested、
  bounced、out of office、needs human reply；感兴趣候选人可以生成 scheduling packet 和 Calendar availability 草稿，暂留首个可约时间，跟踪候选人/manager 时间协商状态，创建、改期或取消 Google Calendar interview event，并把 confirmed/rescheduled/canceled interview 写回交付状态。
- **Role Agent controls and why-now signals**：项目页可持久化 agent status、capacity goals、approval mode、client-visible digest / report field visibility，
  并展示 next tasks、`run_sourcing` direct manual search-task execution、backend RoleAgentRun sourcing / live-signal refresh / `prepare_outreach`、`resolve_contacts` direct bulk contact resolution、`approve_or_send_outreach` direct ready-draft approval without sending、`retry_failed_outreach` direct failed-send retry、`follow_up` direct Gmail draft saving without sending、`review_interested_candidates` direct first inbox next-step application、`refresh_live_signals` stale/expired signal refresh queue with scheduled provider cron、HTTP provider hook 和 provider guardrail fallback、next-action execution states、execution log with targets/results/failed items/retryability、带 run_id/workflow_step/status/guardrails 的 persisted role-agent run manifests、capacity pressure、activity log、blocked automation reasons、contact/outreach autopilot path 和带 target preview / guardrails 的 unified workflow run plan
  和 persisted recovery history、latest execution summary、retryable failed item display、带 scheduling state、candidate/manager negotiation state、persisted two-sided message history、activity timeline、slot-held/confirmed/rescheduled/canceled writeback、Google Calendar event lifecycle actions 和 handoff/calendar/recovery state 的 inbox-to-interview queue、Role Agent-to-Inbox action bridge，以及基于回复、跟进、contactability、fresh evidence、candidate/company/tech stack signals 的 `why_now` 候选人排序、contact timing window、从 CandidateGraph evidence/profile/company-open-role/tech-stack context 推断的 live signal ingestion、带 type/source/confidence/freshness/expires_at 的 live signal contract、过期信号降权和 stale/expired signal refresh queue。
- **Delivery and operations**：Smart Report、token-gated / invited-customer-account shareable client delivery loop、customer `/client` workspace、authorized project list、client project tabs、interview-ready queue、project-level delivery snapshot injection、client delivery weekly progress、report-version frozen delivery snapshot manifest、shareable delivery version history、基于 persisted report versions 的 weekly delivery archive manifest、independent weekly delivery archive storage/readback、Client Delivery Audit Center with CSV export、Role Agent client delivery loop metrics/risks/next steps、confirmed interview metric、client-safe delivery filtering、client-visible report field controls、customer account access controls、shareable report view metrics、manager/client feedback capture、retained feedback audit history、metrics-derived and persisted client delivery audit trail 和 independent client delivery audit event storage、referral path、ATS-lite Greenhouse import/export、History facet counts
  和 saved views 把搜索、外联、证据和客户交付组织成可复用的招聘记忆。

内置缓存示例用于快速体验。非缓存 live research 需要 Insforge、MiroMind 和运行中的 worker，通常需要
几分钟完成。

## 核心工作流

| 阶段 | 内容 |
|------|------|
| 输入 | JD、岗位 brief、人才画像、候选人资料或项目下一轮搜索约束 |
| Intake | 清理 JD 噪音，分离雇主上下文与候选人要求，生成 role category、channel plan 和 query clusters |
| 预检 / preview | 可选公开来源预检，写入 `open_evidence_leads`，并在搜索运行中展示 unverified lead preview |
| Deep research | worker 领取队列任务，调用 MiroMind 搜索、抓取、综合和交叉验证公开证据 |
| 输出 | shortlist、talent map、search plan、execution trace、delivery clusters、evidence graph、source mix、Smart Report |
| 联系方式 | 候选人进入 ContactProfile，记录 email/phone/LinkedIn、来源、置信度、deliverability 和 contactability |
| 外联 | 生成 evidence-based 3-step sequence，支持编辑、审核、批量准备、Gmail draft/send 和 follow-up draft |
| 回复 / 约面 | Inbox Agent 分类回复，生成 reply draft、follow-up、stop、scheduling packet、Calendar availability 草稿、slot hold、Google Calendar event create/reschedule/cancel 和 interview lifecycle writeback |
| 迭代 | 候选人加入项目池，反馈进入下一轮搜索约束，search tasks 可持续运行，Role Agent 维护目标和下一步 |

Verify 能力仍作为候选人背景核验的辅助入口；主产品定位是证据可追溯的搜人、候选判断和项目迭代。

## How it works

```text
Hiring brief / JD / candidate text / ATS role
  -> web/ Next.js app
  -> role-aware intake + cache/history lookup
  -> Insforge research_runs queue
  -> worker/ long-running Node process
      -> open evidence precheck
      -> MiroMind Deep Research API
      -> streaming progress + agent execution telemetry
  -> normalized talent payload
  -> search workspace / lead preview / CandidateGraph / project pool
  -> contact resolution / outreach sequence / inbox agent / scheduling draft / slot hold / Google Calendar event lifecycle / interview writeback
  -> Smart Report / ATS-lite export / history memory
```

MiroMind 是底层 deep-research engine。SignalHire 负责队列、缓存、公开证据预检、结构化 guardrails、
项目工作台、联系方式解析、外联序列、收件箱动作、Role Agent 控制面板和交付 UI。

## 当前架构

| 部分 | 职责 |
|------|------|
| `web/` | Next.js App Router UI、API routes、auth/session sync、搜索工作台、项目、shortlist、history、public report |
| `web/lib/talent-profile.mjs` | 搜索 payload normalizer、role-aware strategy、agent execution layer、evidence dossier、cache rows |
| `web/lib/db.ts` | Insforge `research_runs`、history、feedback、retry/cancel、candidate cache、project、outreach 和 search queue access |
| `web/lib/candidate-graph.mjs` | 多来源候选人合并、source mix、merge keys、readiness 和 contact coverage |
| `web/lib/lead-preview.mjs` | 搜索运行中的 unverified lead preview、source summary 和 outreach block reason |
| `web/lib/contact-*.mjs` | ContactProfile、Hunter/provider resolution、bulk resolution 和 send eligibility |
| `web/lib/outreach-*.mjs` | 外联草稿、3-step sequence、Gmail draft/send、follow-up draft、readiness 和 activity digest |
| `web/lib/inbox-*.mjs` | Gmail sync、reply classification、today queue、reply actions 和 scheduling packet |
| `web/lib/role-agent-guardrails.mjs` | Role Agent status、capacity goals、approval mode、next tasks 和 blocked automation view |
| `web/lib/smart-report.mjs` | 客户可见交付报告、source mix、risk、next actions 和 referral summary |
| `web/lib/ats-lite.mjs` | Greenhouse-oriented ATS-lite import/export、dedupe keys 和 evidence-backed candidate payload |
| `web/lib/search-tasks.*` | Talent Monitor / AI Sourcer tasks、due run 计算、候选人新增/证据更新分类 |
| `web/lib/outreach-threads.*` | 外联线程、状态、Gmail thread、sequence messages、跟进时间和项目/候选人关联 |
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
| `projects.outreach_settings` | Role Agent status、capacity goals、approval mode、follow-up interval、client-visible digest 和 report field visibility |
| `outreach_threads` | 外联草稿、Gmail thread、contact profile、sequence messages、approval/send state、notes 和 follow-up 时间 |

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

可选 profile lead / contact / inbox / ATS 能力：

- `MIRA_KEY`
- `HUNTER_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GREENHOUSE_API_KEY`

可选 live signal provider：

- `LIVE_SIGNAL_PROVIDER_URL`
- `LIVE_SIGNAL_PROVIDER_API_KEY`

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

`web/vercel.json` 配置了 cron routes：

- `/api/cron/worker-health`：每日检查队列健康。
- `/api/cron/search-tasks`：每日触发 due Talent Monitor tasks。
- `/api/cron/inbox-sync`：同步 SignalHire 相关 Gmail threads，用于 Inbox Agent。
- `/api/cron/outreach-followups`：处理 due follow-up draft 工作。
- `/api/cron/live-signals`：刷新 stale / expired Role Agent live signals；未配置 provider 时记录可恢复 guardrail。

生产环境需要设置 `CRON_SECRET`，cron routes 会校验 `Authorization: Bearer $CRON_SECRET`。

## 验证

Last verified locally: 2026-07-04

```bash
git diff --check
node --test
npm --prefix web run build
```

结果：空白检查、596 个 Node tests、Next.js production build 均通过。

2026-07-04 发布后 smoke：

- Vercel production deployment `dpl_56z3vNKtF8tCWFvN8bRYvpPBaSU2` Ready，并 alias 到 `https://signal-hire-eight.vercel.app`。
- Vercel authenticated fetch：`/client` 返回 200，`/api/client-portal/workspace` 匿名返回 401。
- 本地 production build 浏览器 QA：desktop/mobile `/client`、`/client/projects/[id]` 和 `/login?next=/client` 未登录状态可见登录入口，无 loading 卡死或明显文本重叠。
- 普通 headless browser 访问生产 URL 会被 Vercel Security Checkpoint 拦截；真实登录态客户门户 QA 仍需要可用测试账号和可通过 Vercel 检查的浏览器会话。

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
  app/          Public landing, app shell, API routes, projects, search, reports, history, settings
  components/   Search workspace, lead preview, result views, outreach modal, shared UI
  lib/          Domain helpers, Insforge access, MiroMind client, candidate graph, contact, inbox, task/outreach/cache logic
  scripts/      Schema, migration, live-job, retry, worker-health checks
worker/         Long-running Node worker for non-cached live research
migrations/     Research queue, candidate cache, open evidence, search tasks, outreach tables
*.test.mjs      Node test suites for domain helpers and integration contracts
```

## Guardrails

- `open_evidence_leads` 和 profile leads 是发现线索，不是已验证推荐。
- 候选人身份合并不能只靠姓名，需要 LinkedIn URL、邮箱 hash、个人站点、公司页、GitHub、Scholar 或多来源强标识。
- 联系方式必须带 source、confidence、deliverability 或 resolution metadata，不能把无来源联系方式包装成可发送。
- 外联、跟进、收件箱和日程动作都必须保留可审阅状态、失败恢复和 activity/audit trail。
- 自动化如果能明显提升用户体验，可以进入路线图；产品上必须让用户知道系统做了什么、为什么做、下一步是什么。

---

*SignalHire v1 — evidence-first sourcing, candidate judgment, and recruiting execution.*
