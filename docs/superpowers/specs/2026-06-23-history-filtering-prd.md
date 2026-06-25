# 历史页筛选 PRD

## 1. 背景

SignalHire 的历史页当前只展示当前用户最近 20 条已完成研究记录。每条记录只区分搜人和核验，点击后回到对应工具页并带回原始输入。

这满足了“快速重开最近一次研究”的基础需求，但不支持用户按岗位、状态、时间、证据质量或下一步动作查找历史。随着 Role Workspace、候选池、补证据任务和外联草稿增加，历史页不能继续只是一个完成记录列表。它需要成为用户找回研究、继续工作和审计交付质量的入口。

本 PRD 采用 B-light 方案：历史页筛选优先服务招聘工作流，而不是做成通用后台表格。

## 2. 产品目标

- 用户能快速找回某次搜人或候选人核验。
- 用户能按状态、时间、类型和 Role 过滤研究记录。
- 用户能识别哪些历史记录需要继续、重试、补证据或交付给 hiring manager。
- 历史页延续 SignalHire 的 evidence-first 定位，突出证据状态和下一步动作。
- 第一版避免复杂字段查询、批量操作和保存视图。

## 3. 目标用户

- Recruiter：需要回到历史搜索，继续推进候选人筛选和外联准备。
- Hiring manager：需要复看某个岗位的候选人研究和核验证据。
- 创始人：需要快速找回之前搜索过的岗位方向，继续调整 candidate profile。
- 猎头：需要按客户或岗位追踪多轮研究记录。

## 4. 用户问题

当前历史页存在四个问题：

- 只能看最近 20 条已完成记录，筛选会产生假空结果。
- 只区分 search / verify，无法按 queued / running / error / canceled / done 找记录。
- 缺少 Role / project 维度，用户不能围绕一个岗位找回多轮搜索。
- 缺少 evidence 和 action 维度，用户不知道哪条历史需要补证据、重试或继续推进。

## 5. 设计原则

- 先服务“继续工作”，再服务“查数据”。
- 默认展示高频筛选，低频筛选放进 More filters。
- 使用招聘方能理解的语言，少暴露内部 worker 状态。
- 状态和证据要可解释，不能只显示技术枚举。
- URL query state 要保留筛选状态，支持刷新和返回。
- 第一版做服务端过滤，不只筛当前已加载的 20 条。

## 6. MVP 范围

### 包含

1. 服务端历史查询筛选
   - 关键词 `q`
   - 类型 `kind`
   - 状态 `status`
   - Role / project `projectId`
   - 时间范围 `range`
   - 分页或加载更多 `limit` / `cursor`

2. 历史页筛选 UI
   - 顶部关键词搜索框
   - 高频筛选 chips
   - More filters 面板
   - Active filters chips
   - Clear all

3. 历史记录卡片增强
   - 类型：搜人 / 核验
   - 状态：排队中 / 运行中 / 重试中 / 已完成 / 失败 / 已取消
   - 更新时间
   - Role / project 名称
   - 摘要
   - 下一步 CTA

4. 基础下一步动作
   - 已完成 search：打开结果或进入 Role Workspace
   - 已完成 verify：打开核验报告或回到核验页
   - error：重试
   - canceled：调整输入后重新开始
   - queued / running / retrying：查看进度

5. 空状态
   - 无历史记录
   - 当前筛选无结果
   - 搜索关键词无结果
   - 项目无历史记录

### 不包含

- 保存筛选视图。
- 批量操作。
- 任意字段高级查询语法。
- 全文搜索完整 result JSON。
- 新增 ATS 集成。
- 邮件自动发送。
- 后台运营管理表格。

## 7. 分阶段路线图

### P0：基础筛选和状态可见

目标：让历史页从“最近完成记录”升级为“可查找的研究记录”。

范围：

- `/api/history` 支持 `q`、`kind`、`status`、`range`、`limit`。
- 历史查询不再固定只返回 `status=done`。
- 前端增加搜索框、类型 chips、状态 chips、时间筛选。
- 历史卡片显示状态、更新时间和合理 CTA。
- 筛选状态写入 URL query。

验收：

- 用户能筛出 search / verify。
- 用户能筛出 done / error / canceled / running 等状态。
- 用户能按关键词搜索历史输入和标题。
- 用户刷新页面后筛选条件仍保留。
- 没有匹配结果时展示筛选空状态，而不是普通空历史。

### P1：Role 维度和下一步动作

目标：让历史页能围绕岗位项目继续推进。

范围：

- `/api/history` 返回 `project_id`、`search_task_id` 和 project 名称。
- More filters 支持 Role / project 筛选。
- 有 Role 的记录优先进入 Role Workspace。
- 卡片展示下一步动作：
  - Continue role
  - Review shortlist
  - Retry research
  - Adjust input
  - View report
- Role 筛选结果可展示该 Role 下的多轮 search run。

验收：

- 用户能按 Role 找到多轮搜索历史。
- 同一个 Role 下的 search / verify / backfill 记录能被聚合查看。
- 点击有 Role 的记录不会只回到孤立 search 页，而是优先回到 Role Workspace。
- 失败或取消的任务有明确恢复路径。

### P2：Evidence-first 筛选

目标：让历史页支持按交付质量和证据缺口找记录。

范围：

- 从 `result` 派生 evidence summary view model。
- 支持筛选：
  - High confidence
  - Needs verification
  - Low evidence
  - Has evidence gaps
  - Has shortlist-ready candidates
  - Has outreach drafts
- 卡片展示 evidence summary：
  - 候选人数
  - high-confidence 数量
  - needs verification 数量
  - 主要证据缺口
- 增加 `Needs action` 快捷筛选。

验收：

- 低证据结果不会被包装成强推荐。
- 用户能筛出需要补证据的历史记录。
- 用户能筛出可交付给 hiring manager 的 shortlist 记录。
- Evidence-first 维度来自结果 view model，不要求第一版新增数据库列。

## 8. 信息架构

历史页建议结构：

1. Page intro
2. Search input
3. Quick filters
4. More filters
5. Active filters
6. Result count / sort
7. History result list
8. Empty state

Quick filters 建议：

- All
- Search
- Verify
- Running
- Needs action
- Done

More filters 建议：

- Status
- Time range
- Role / project
- Evidence quality
- Result outcome

## 9. 数据与技术方案

### API query

`GET /api/history`

建议参数：

- `q`: string
- `kind`: `all | search | verify`
- `status`: `all | queued | running | retrying | done | error | canceled`
- `projectId`: string
- `range`: `all | today | 7d | 30d`
- `limit`: number
- `cursor`: string
- `locale`: string

### API response

```ts
type HistoryRunView = {
  id: string;
  kind: "search" | "verify";
  status: "queued" | "running" | "retrying" | "done" | "error" | "canceled";
  label: string;
  summary: string;
  query_text: string;
  project_id: string | null;
  project_name: string | null;
  search_task_id: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  next_action: {
    label: string;
    href: string;
    kind: "open" | "retry" | "adjust" | "progress";
  };
  evidence_summary?: {
    candidate_count: number;
    high_confidence_count: number;
    needs_verification_count: number;
    primary_gaps: string[];
  };
};
```

### 实现原则

- P0 优先走 `research_runs` 查询，不新增表。
- P1 如需 project 名称，可用现有 project 数据做 join 或二次查询。
- P2 evidence summary 先作为 view model 从 `result` 派生。
- 若数据量增长明显，再考虑全文索引或派生字段落库。

## 10. 文案建议

页面标题：

- 中文：研究历史
- 英文：Research history

页面描述：

- 中文：查找、恢复和审阅每一次搜人与核验记录。
- 英文：Find, resume, and review every search and verification run.

搜索框：

- 中文：搜索岗位、候选人、查询词或证据摘要
- 英文：Search role, candidate, query, or evidence summary

无筛选结果：

- 中文：没有匹配的历史记录
- 英文：No matching research history

## 11. 验收标准

- 历史页支持关键词、类型、状态和时间筛选。
- 筛选不是只作用于当前 20 条，而是由 API 返回匹配结果。
- 筛选状态可以刷新保留。
- 每条历史记录能清楚显示类型、状态、更新时间和下一步动作。
- 已完成 search / verify 能正确回到对应结果。
- error / canceled / running 状态有合理 CTA。
- P1 完成后，用户能按 Role 找到该岗位所有历史研究。
- P2 完成后，用户能按 evidence quality 和 needs action 找记录。
- 移动端和桌面端筛选控件不遮挡、不溢出。
- Node tests、前端 build 和浏览器截图检查通过。

## 12. 风险与取舍

- 如果只做前端过滤，用户会误以为没有匹配历史，因此 P0 必须改 API。
- 如果第一版引入太多 evidence 过滤，会拖慢交付，因此 evidence-first 维度放到 P2。
- 如果直接暴露所有 worker 状态，招聘用户会困惑，因此 UI 文案要翻译成用户动作。
- 如果历史页承担太多 Role Workspace 能力，会形成重复页面，因此历史页只负责查找和入口，深度推进回到 Role Workspace。
