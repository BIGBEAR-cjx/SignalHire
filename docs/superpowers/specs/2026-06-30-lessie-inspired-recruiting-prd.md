# Lessie-Inspired Recruiting Module PRD Index

日期：2026-06-30

## 1. Summary

本 PRD 索引把 Lessie 招聘模块中值得学习的能力，转成 SignalHire 的三阶段产品路线。每个阶段都有独立详细 PRD，不再把所有内容放在一个总概览里。

核心判断：

- Lessie 的优势是泛人脉搜索、联系人验证、快速结果和 AI 个性化外联。
- SignalHire 不应转向泛人脉数据库，而应把这些能力吸收进 `evidence-first recruiting workspace`。
- SignalHire 的差异化继续是：候选人为什么匹配、证据来自哪里、哪些结论不可靠、下一步能否安全外联。

本轮只做 3 个阶段：

1. `P1 Fast Lead Preview`：先展示未验证候选线索，再等待深度 evidence packet。
2. `P2 Source Mix UX`：把多平台来源覆盖做成候选人卡片和 Role Workspace 的核心信息。
3. `P3 Outreach Sequence Workspace`：把外联从单封草稿升级为可审批、可编辑、可跳过的序列工作台。

明确不做：`SEO / Free Tools Acquisition`。这个方向本轮移出范围，不进入执行计划。

## 2. Detailed PRDs

- P1 detailed PRD: `docs/superpowers/specs/2026-06-30-lessie-p1-fast-lead-preview-prd.md`
- P2 detailed PRD: `docs/superpowers/specs/2026-06-30-lessie-p2-source-mix-ux-prd.md`
- P3 detailed PRD: `docs/superpowers/specs/2026-06-30-lessie-p3-outreach-sequence-prd.md`

## 3. Current Baseline

当前 repo 已有可复用基线：

- `web/lib/candidate-graph.mjs`：已有 CandidateGraph、source mix、readiness、contact coverage。
- `web/lib/projects.ts`：项目详情已能构建 `candidateGraph` view model。
- `web/app/app/projects/[id]/page.tsx`：Role Workspace 已展示 Autonomous sourcing、source mix、readiness、contact coverage。
- `web/lib/contact-profile.mjs` / `web/lib/contact-resolution.mjs`：已有带来源、置信度、deliverability 的 contact profile 和解析结果。
- `web/lib/contact-providers.mjs`：已有 Hunter provider normalizer 和 provider config。
- `web/app/api/contact-resolution/*`：已有单个和批量联系方式解析 API。
- `web/app/app/projects/[id]/page.tsx`：已有 Gmail Outreach Sequence、批量解析、批准、发送、跳过、风险提示。
- `web/lib/outreach-draft.mjs`：已有基于 evidence angle 的首封外联草稿生成。

因此本路线不重复建设 CandidateGraph 或基础 contact resolution，重点是把现有能力包装成更快、更清晰、更可推进的招聘工作流。

## 4. Goals

- 搜索任务启动后，用户能尽快看到可审阅的候选线索，而不是等待完整 deep research 才有反馈。
- Role Workspace 能一眼解释候选人来自哪些平台、证据覆盖是否足够、联系方式是否可信。
- 外联工作台支持按候选人批量推进，但首封邮件仍需人工审批。
- 所有新能力都保持 SignalHire 的 guardrails：不抓登录态、不猜邮箱、不隐藏来源、不把未验证线索包装成推荐。

## 5. Non-Goals

本阶段不做：

- P4 SEO / Free Tools Acquisition。
- 泛人脉搜索平台。
- 简历数据库或联系人数据库营销。
- 自动全量解锁邮箱。
- 未经用户确认的首封自动发送。
- LinkedIn 登录墙抓取。
- ATS 深集成。
- 以 95% 匹配率或 95% 邮箱准确率做未经验证的营销承诺。

## 6. Prioritized Phases

### P0: Baseline Audit And Copy Cleanup

优先级：最高。耗时：0.5-1 天。

目的：确认当前已实现能力的真实状态，避免后续重复开发。

验收：

- 有一份清楚的 baseline checklist。
- 新开发任务不重复实现现有 `candidate-graph`、`contact-resolution`、Gmail sequence。

### P1: Fast Lead Preview

优先级：最高。耗时：2-4 天。

详细方案见：`docs/superpowers/specs/2026-06-30-lessie-p1-fast-lead-preview-prd.md`

一句话目标：把搜索体验从“等待完整研究结束”改成“先看未验证线索，再补证据”。

### P2: Source Mix UX Upgrade

优先级：高。耗时：2-3 天。

详细方案见：`docs/superpowers/specs/2026-06-30-lessie-p2-source-mix-ux-prd.md`

一句话目标：把多平台来源覆盖做成 SignalHire 的可信卖点，让用户能判断候选人是否来源充分、证据充分。

### P3: Outreach Sequence Workspace Upgrade

优先级：中高。耗时：3-5 天。

详细方案见：`docs/superpowers/specs/2026-06-30-lessie-p3-outreach-sequence-prd.md`

一句话目标：把外联从“草稿保存”升级为“序列推进”，学习 Lessie 的 AI 个性化外联，但保留人工审批和证据透明。

## 7. Metrics

- Search first visible lead time：从提交搜索到第一个 preview lead 的时间。
- Preview-to-shortlist conversion：preview lead 中最终进入 verified shortlist 的比例。
- Source coverage：每个 ready candidate 的 source type 数量。
- Readiness explainability：用户是否能理解为什么一个候选人可外联或需补证据。
- Contact readiness：有 sendable sourced email 的 outreach candidates 占比。
- Outreach approval rate：draft -> approved。

## 8. Execution Model

采用总 agent 管控、多子 agent 并行开发、独立 agent 验收模式。

- Controller Agent：维护范围、拆任务、合并冲突、决定执行顺序。
- Implementer Agents：每个 agent 只负责一个边界清晰的任务。
- Spec Review Agents：逐任务检查是否符合对应阶段 PRD，不做代码风格评审。
- Code Quality Review Agents：逐任务检查实现质量、测试覆盖、回归风险。
- Independent Acceptance Agent：所有任务完成后，从用户视角做端到端验收，不能参与前面实现。

并行原则：

- P1 和 P2 可以并行，但要避免同时改同一段 Role Workspace UI。
- P3 依赖 contact profile 和 outreach thread 现有状态，可在 P1/P2 view-model 稳定后并行推进。
- P4 已移出范围，任何子 agent 不应创建 public free tools、SEO 页面或 free-tools 测试。

## 9. Confirmed Decisions

- Preview lead 支持 `Not relevant` 反馈，并写入下一轮 search constraints。
- `open_evidence_leads` 直接接入 P1。
- Search workspace 和 Role Workspace 都展示 preview。
- Source chips 需要 tooltip。
- Shareable shortlist report 复用 source mix。
- GitHub / paper / company page 在 P2 就细分。
- Role-level setting 允许开启 `auto_follow_up_only`。
- Follow-up 默认间隔是 7 天。
- Agency 用户需要客户可见的 outreach activity digest。
