# SignalHire

*Find signals. Not resumes.*

SignalHire 是一个证据优先的 AI 招聘工作台。它把岗位 brief、JD 或候选人资料转成可审阅的搜人、
候选判断、联系方式准备、外联、回复处理和客户交付流程。

它不是简历库，也不是只返回一串名字的搜索工具。SignalHire 的目标是帮助招聘团队回答三个问题：

1. 谁值得进入 shortlist？
2. 为什么这个人匹配，证据来自哪里，风险是什么？
3. 下一步应该搜索、验证、联系、跟进、约面，还是交付给客户/manager？

**Live demo:** https://signal-hire-eight.vercel.app

**Core app entry:** https://signal-hire-eight.vercel.app/app/search

---

## Product Overview

SignalHire has evolved from a one-shot AI talent search into a role-based recruiting workspace:

- **Role-aware sourcing**: Turn a JD or natural-language brief into role category, must-have criteria, exclusions, source strategy, and query clusters.
- **Evidence-first shortlist**: Review candidates with match reasons, public source links, evidence strength, claim verdicts, coverage, and unresolved risks.
- **Lead preview while research runs**: See unverified leads early, but keep outreach blocked until evidence and contact provenance are reviewed.
- **CandidateGraph and source mix**: Merge public evidence, profile leads, LinkedIn URL seeds, internal resume/manual upload paths, contact profiles, and source readiness into one candidate view.
- **Contact and outreach workspace**: Resolve contact profiles when providers are configured, prepare 3-step evidence-based outreach sequences, review drafts, save Gmail drafts, send approved messages, retry failures, and track follow-ups.
- **Inbox-to-interview flow**: Classify replies, surface interested candidates, prepare scheduling packets, hold slots, and write interview lifecycle state back into delivery reporting when Gmail/Calendar access is connected.
- **Role Agent controls**: Track role goals, health, blocked reasons, next actions, activity history, why-now signals, contact timing, execution logs, and recovery state from one project workspace.
- **Client delivery loop**: Share Smart Reports, client-safe delivery summaries, weekly progress, interview-ready candidates, report history, feedback, and audit trails through token-gated or customer-account access.

Built-in cached examples are available for quick evaluation. Non-cached live research requires Insforge, MiroMind, and a running worker, and usually takes several minutes.

## Who It Is For

SignalHire is designed for:

- Company HR and talent teams that need evidence-backed sourcing for AI, technical, product, growth, and operating roles.
- Founders and hiring managers who want to inspect why a candidate is worth interviewing, not just receive a list of names.
- Recruiters and boutique agencies that need to deliver credible shortlists, outreach progress, and client-ready reports.
- Recruiting operators who want a controlled role agent rather than a black-box outbound automation tool.

## Core Workflow

| Stage | What SignalHire does |
|------|------|
| Input | Accepts a JD, role brief, candidate text, ATS role, or project search constraint |
| Intake | Separates employer context from candidate requirements and builds role-aware search strategy |
| Preview | Runs optional open-evidence prechecks and shows unverified leads while research is still running |
| Research | Uses the worker and MiroMind deep research to search, fetch, summarize, and cross-check public evidence |
| Review | Produces shortlist, talent map, execution trace, source mix, evidence graph, and Smart Report |
| Contact | Builds ContactProfile records with source, confidence, deliverability, and contactability metadata when providers are configured |
| Outreach | Drafts evidence-based sequences and supports review, approval, Gmail draft/send, follow-up draft, and retry workflows |
| Inbox | Classifies replies and turns interested candidates into scheduling, interview-ready, or human-review actions |
| Delivery | Packages role progress, candidate evidence, outreach state, risks, and client feedback into reusable recruiting memory |

## Current Boundaries

- SignalHire is **not** a resume database, traditional ATS, or mass cold-email platform.
- Preview leads and profile leads are discovery signals, not verified recommendations.
- Contact enrichment, Gmail, Calendar, Greenhouse, and external live-signal features require provider configuration.
- `approve_or_send_outreach` currently approves ready drafts without blindly auto-sending first-touch emails.
- Full unattended recruiting autopilot is still a roadmap direction; current automation keeps visible state, guardrails, audit history, and manual recovery paths.
- Verify remains an auxiliary candidate background-check entry point. The main product is evidence-traceable sourcing, candidate judgment, and recruiting execution.

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
- `RESEND_API_KEY`
- `CLIENT_PORTAL_INVITE_FROM`

可选外部 live signal provider（不配置时使用内置 `internal_live_signal_provider` fallback）：

- `LIVE_SIGNAL_PROVIDER_URL`
- `LIVE_SIGNAL_PROVIDER_HEALTH_URL`
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
npm --prefix web run verify:release -- --base-url https://signal-hire-eight.vercel.app
```

`verify:live` 需要 web server、worker、Insforge 和 MiroMind 都可用；生产 live smoke test 还需要登录
cookie/token 或测试账号。

`verify:release` 会检查 runtime env、live signal provider health（外部 URL 或内置 fallback）、`/client`、匿名
`/api/client-portal/workspace`、客户门户 token QA 和可选浏览器 QA。需要浏览器检查时先安装或提供
Playwright：

```bash
npm --prefix web run verify:release -- --base-url http://127.0.0.1:3000 --browser
```

线上 Vercel URL 可能对普通 headless browser 返回 Security Checkpoint；这种情况下设置
`VERCEL_AUTOMATION_BYPASS_SECRET`，`verify:release` 会把 `x-vercel-protection-bypass` 同时用于 fetch
和 Playwright。登录态客户门户 QA 需要设置 `SIGNALHIRE_QA_USER_ID` / `SIGNALHIRE_QA_EMAIL`，脚本会生成短期
`sh_token`。

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
