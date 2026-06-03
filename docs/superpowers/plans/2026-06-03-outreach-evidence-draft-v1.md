# Outreach Evidence Draft v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for helper behavior before UI wiring.

**Goal:** 让 AI 外联弹窗基于候选人的公开证据生成更可信、可编辑、可复制的首封外联消息。

**Architecture:** 新增纯前后端可复用 helper `web/lib/outreach-draft.mjs`，从候选人的 `strongest_signals`、`outreach_angle`、已验证 claims 和公开链接派生证据摘要与本地兜底草稿。现有 `/api/outreach` 继续负责 AI 生成；前端在 API 失败或缺配置时使用本地证据驱动草稿，并展示可复制证据引用。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Node built-in test runner, existing SignalHire talent result shape.

---

## Scope

- 新增 `buildOutreachEvidenceBrief(candidate)`。
- 新增 `buildEvidenceDrivenOutreachDraft({ candidate, tone, senderName, roleBrief })`。
- 外联弹窗展示联系角度、证据引用、风险提示。
- AI API 失败时自动回退到本地草稿，而不是只显示错误。
- 继续保留 tone、编辑 subject/body、复制全文和 mailto。

本轮不做批量外联、不接 Gmail/Outlook OAuth、不写数据库、不做发送追踪。

## Tasks

- [x] 写 `outreach-draft.test.mjs` 失败测试。
- [x] 实现 `web/lib/outreach-draft.mjs` 和类型声明。
- [x] 让 `/api/outreach` 返回 AI 草稿时附带同一份证据摘要。
- [x] 更新 `OutreachModal`：展示证据摘要、API 失败时使用本地草稿。
- [x] 运行单测、lint、tsc、build、HTTP 检查。
