# Candidate Evidence Audit v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在候选人详情页提供更清晰的证据审计面板，让 HR 和猎头快速判断候选人的关键信号是否可信、是否有单源/身份/时效风险。

**Architecture:** 不新增数据库表，继续复用 `research_runs.result` 中的 `candidates[].claims`、`candidates[].evidence_audit` 和 `evidence_graph.candidates`。在 `web/lib/talent-profile.mjs` 增加一个派生 helper，统一计算验证数量、独立信源、来源类型、审计条目和交叉验证摘要；`web/components/result.tsx` 只负责展示。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Node built-in test runner, existing SignalHire talent result normalizer.

---

## Scope

- 做候选人级 Evidence Audit v1 面板。
- 增加可测试的 `buildCandidateEvidenceAudit()` helper。
- 候选人详情页展示：证据质量、独立信源数、来源类型、已验证/未验证/矛盾数量、单源声称、身份风险、时效说明、交叉验证摘要。
- 分享报告页复用同一组件。

不做数据库迁移、PDF 导出、人工复核工单、付费 enrichment 或 ATS/CRM 集成。

## File Structure

- Modify: `talent-profile.test.mjs`
  - 先写失败测试，覆盖 helper 从 claims/evidence_graph/evidence_audit 派生审计摘要。
- Modify: `web/lib/talent-profile.mjs`
  - 新增并导出 `buildCandidateEvidenceAudit()`。
- Modify: `web/lib/talent-profile.d.ts`
  - 增加 `CandidateEvidenceAuditSummary` 类型和 helper 声明。
- Modify: `web/components/result.tsx`
  - `EvidenceAuditView` 接收 candidate/result，使用 helper 展示完整审计面板。
  - `CandidateProfileView` 接收可选 `result`，让详情页能显示 evidence graph 交叉验证。
- Modify: `web/components/ResearchTool.tsx`
  - 给 `CandidateProfileView` 传入当前 result。
- Modify: `web/app/r/[id]/page.tsx`
  - 分享报告页同样传入 talentResult。

## Tasks

- [x] 写 `buildCandidateEvidenceAudit()` 失败测试。
- [x] 运行 `node --test talent-profile.test.mjs`，确认测试因 helper 缺失失败。
- [x] 实现 helper 和类型声明。
- [x] 更新 Evidence Audit UI，复用 helper。
- [x] 运行单测、eslint、tsc、build。
- [x] 本地检查 `/app/search` HTTP 200；截图级浏览器检查因当前 Playwright/browser 工具不可用未执行。
