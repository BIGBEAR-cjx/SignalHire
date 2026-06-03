# Shortlist Delivery Report v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把搜索结果整理成更适合 HR、猎头和 hiring manager 阅读的 shortlist 交付报告摘要。

**Architecture:** 不新增数据库表，也不改变模型输出 schema。新增 `buildShortlistDeliveryReport()` 从现有 `TalentSearchResult`、候选人评分、证据覆盖和候选人审计摘要中派生报告级指标、推荐候选人、主要风险和下一步建议；`ShortlistDeliveryReportView` 在搜索页和分享页复用。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Node built-in test runner, existing SignalHire talent result normalizer.

---

## Scope

- 新增报告级 helper：`buildShortlistDeliveryReport(result)`。
- 报告摘要包含：岗位画像摘要、候选人数、强推荐人数、平均匹配分、证据强候选人数、覆盖组状态。
- 展示推荐候选人 Top 5：姓名、角色、分数、推荐理由、主要风险。
- 展示报告级风险和下一步建议。
- 搜索页和分享页都展示同一报告摘要。

本轮不做 PDF、CSV、下载按钮、邮件发送、权限控制或新数据库表。

## File Structure

- Modify: `talent-profile.test.mjs`
  - 写失败测试，覆盖 shortlist delivery report 的派生逻辑。
- Modify: `web/lib/talent-profile.mjs`
  - 新增并导出 `buildShortlistDeliveryReport()`。
- Modify: `web/lib/talent-profile.d.ts`
  - 增加 `ShortlistDeliveryReport` 和 `ShortlistDeliveryCandidate` 类型。
- Modify: `web/components/result.tsx`
  - 新增 `ShortlistDeliveryReportView`。
- Modify: `web/components/ResearchTool.tsx`
  - 在搜索结果中渲染 `ShortlistDeliveryReportView`。
- Modify: `web/app/r/[id]/page.tsx`
  - 在分享报告中渲染 `ShortlistDeliveryReportView`。

## Tasks

- [x] 写 `buildShortlistDeliveryReport()` 失败测试。
- [x] 运行 `node --test talent-profile.test.mjs`，确认因 helper 缺失失败。
- [x] 实现 helper 和类型声明。
- [x] 新增 `ShortlistDeliveryReportView` 并接入搜索页/分享页。
- [x] 运行单测、eslint、tsc、build、diff check。
- [x] 检查本地入口 HTTP 状态；生产入口在合并部署后检查。
