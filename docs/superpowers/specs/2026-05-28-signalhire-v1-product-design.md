# SignalHire v1 产品设计

日期：2026-05-28

## 产品定位

SignalHire v1 是一个面向公司 HR 和猎头的全球 AI 人才搜索与证据交付平台。

产品从岗位画像出发，围绕全球公开来源搜索 AI 人才信号，返回一份小而精的候选人 shortlist，并把证据整理成可分享的交付报告。后续产品迭代不再受黑客松 demo 约束。

核心承诺：

> 从论文、开源、实践项目、工作经历和公开 profile 中，找到 10-15 位全球相关 AI 候选人，并给出可解释、可验证的证据。

SignalHire 不应该做成泛化的人才数据库。它的差异化是：广泛公开来源覆盖、交叉验证、可解释评分，以及适合交付给客户或 hiring manager 的报告形态。

## 目标用户

v1 的目标用户包括：

- 猎头：为客户准备 AI 候选人 shortlist。
- 公司 HR / Talent Partner：为内部 AI 岗位找人，并把结果分享给 hiring manager。

v1 同时服务这两类用户，但优先保证报告、分享和导出的交付感，而不是先做高频 CRM 工作流。

## 主流程

1. 用户用自然语言输入岗位画像。
2. SignalHire 把岗位画像解析成结构化搜索 profile。
3. SignalHire 从广泛公开来源中搜索候选人信号。
4. SignalHire 抽取候选人和证据。
5. SignalHire 交叉验证论文、开源、产品实践、工作经历和身份 profile。
6. SignalHire 按 AI 人才方向对候选人分层。
7. SignalHire 返回 10-15 人高质量 shortlist。
8. 用户审阅候选人、移除弱匹配、打开候选人详情页，并分享 Web 报告。

## v1 产品范围

### P0

- Search Brief 输入与解析。
- AI 人才方向分层。
- 10-15 人高质量候选人 shortlist。
- 可解释 match score。
- 候选人卡片展示 strongest signals 和 evidence quality。
- Candidate Profile + Evidence Audit。
- Shortlist 保存 / 移除。
- Web share link。
- 公开来源证据与交叉验证。
- 可选展示公开联系方式和公开 profile 链接。

### P1

- PDF 导出。
- CSV / Excel 导出。
- 整份 shortlist 的证据审计摘要。
- 付费或授权 enrichment 集成。
- Saved search alerts。
- Outreach opener 生成。
- 团队协作。
- ATS / CRM 集成。

## v1 非目标

- 不做高容量 people CRM。
- 不把 outreach 自动化作为核心产品。
- 不推断或猜测私人邮箱。
- 不允许付费 enrichment 来源成为候选人匹配的唯一证据。
- 不保留旧的 “Verify candidate” tab 作为主入口。
- 不再围绕黑客松 demo 或预缓存流程优化。

## Search Brief

主入口是岗位画像，而不是 Boolean query builder。

示例：

> 找 senior engineers，要求有 LLM inference 或 serving 经验，最好做过 vLLM、Triton、TensorRT-LLM、Kubernetes 或 distributed systems。北美或欧洲优先，可远程。

解析后的 brief 应包含：

- 目标 AI 方向。
- 必备技能和加分技能。
- 资历要求。
- 地区或远程约束。
- 证据偏好。
- 排除条件。
- 值得探索的相邻人才池。

解析结果需要让用户看得懂，并且至少具备基础可编辑能力，让用户知道系统接下来会搜什么。

## AI 人才方向

搜索结果按 AI 方向分层展示。这个分层的目标是帮助用户理解人才市场，同时服务 shortlist 筛选。

初始方向分类：

- AI Infrastructure / LLM Systems
- AI Research / Applied Science
- Applied AI / Agents
- ML Platform / MLOps
- Data / Evaluation / Safety
- AI Product / Solutions
- Founder / Builder

每次搜索应识别：

- 主匹配方向。
- 相邻可迁移方向。
- 高潜力候选人来源。

最终 10-15 位候选人不需要在各方向平均分布，分布应跟随岗位画像。

## 搜索结果交付

v1 的结果应该像一份 hiring shortlist，而不是原始搜索结果。

每张候选人卡片应展示：

- 姓名。
- 当前角色和公司，如果公开可得。
- 地区或区域，如果公开可得。
- AI 方向标签。
- Match score。
- Strongest signals。
- Evidence quality。
- 主要不确定点或风险。
- 公开 profile / contact links，如果公开可得。
- 加入 / 移出 shortlist。
- Candidate Profile 入口。

默认结果数量为 10-15 位候选人。这个数量能降低人工审阅成本，也更符合高质量交付定位。

## Match Score

评分是综合加权，并且必须可解释。默认权重应让真实成果信号高于简历关键词。

v1 建议权重：

- 真实成果信号：40%
- 岗位技能匹配：25%
- 工作经历相关性：20%
- 证据质量：15%

真实成果信号包括论文、会议录用、开源贡献、Hugging Face 模型或数据集、已上线项目、技术文章、benchmark 参与、demo 和公开产品实践。

每个 score 都应包含简短解释：

- 为什么这个候选人匹配。
- 哪些信号拉高了评分。
- 哪些证据较强。
- 哪些结论仍然不确定。

## Candidate Profile

Candidate Profile 是单个候选人的深度详情页。

它应包含：

- 候选人摘要。
- 方向和技能标签。
- 为什么该候选人匹配当前 brief。
- 论文和研究信号。
- 开源和工程实践信号。
- 产品或应用实践信号。
- 工作经历信号。
- 公开 profile 链接。
- 明确公开的联系方式。
- Evidence Audit。
- 建议联系角度。

这个页面既要适合内部审阅，也要能作为客户交付报告的素材来源。

## Evidence Audit

旧的独立 “Verify candidate” 模式应变成 Candidate Profile 中的动作，而不是顶层入口。

v1 使用的入口和语言：

- Candidate Profile 中包含 “Evidence Audit” 或 “Verify Evidence”。
- P0 先做单候选人级别的证据审计。
- P1 再做整份 shortlist 的证据审计摘要。

Evidence Audit 应回答：

- 哪些关键声称已验证？
- 哪些声称未验证？
- 哪些声称被证据反驳？
- 哪些结论只依赖单一来源？
- 是否存在同名误配或身份混淆？
- 公开 profile 是否足够近期？
- 最强信号是否真的和岗位画像相关？

## 数据源策略

P0 使用公开、可验证来源。P1 可加入付费或授权 enrichment。

公开来源类别：

- 论文和研究：arXiv、OpenReview、Semantic Scholar、Google Scholar、会议页面、实验室页面。
- 开源和工程：GitHub、Hugging Face、Papers with Code、项目主页、benchmark 页面、release notes、issue 和 PR 活动。
- 产品和实践：demo、技术博客、公司工程博客、launch post、文档、演讲、slides、case study。
- 工作经历：公开可见 LinkedIn、公司 team 页面、个人主页、新闻、播客、访谈。
- 社区和影响力：X/Twitter、YouTube、Substack、Medium、Hacker News、会议 speaker bio。
- 身份信号：个人域名、Scholar profile、GitHub profile、ORCID、公司页面、会议 bio。

证据规则：

- 关键结论必须有 source URL。
- 强声称应尽可能由独立来源交叉验证。
- 付费或授权 enrichment 可以补充，但不能成为候选人匹配的唯一支撑。
- 未验证或弱证据必须明确标注。
- 搜索结果页 URL 不是证据。

## 联系信息

v1 展示公开可得的联系方式和 profile 链接：

- 个人网站。
- LinkedIn。
- GitHub。
- Google Scholar。
- Hugging Face。
- X/Twitter。
- 只有候选人或其关联页面明确公开时才展示邮箱。

v1 不猜测私人邮箱。

## 可分享客户报告

P0 交付格式是 Web share link。

分享报告应包含：

- 岗位画像摘要。
- 搜索策略摘要。
- AI 方向分布。
- Shortlist 候选人。
- 候选人级别 match explanation。
- 证据摘要。
- 已知不确定点。

P1 增加 PDF 和 CSV / Excel 导出。

## 现有产品迁移

当前 Search mode 映射到新的 Search Brief 和 Shortlist 工作流。

当前 Verify mode 应从主导航中移除或弱化，它的能力迁移到 Candidate Profile 的 Evidence Audit。

现有 `/r/[id]` report 概念可以演进成候选人和 shortlist 的可分享报告。

现有 worker queue 仍然有价值，因为更深的公开来源搜索仍会是长任务。

## 成功标准

v1 成功时，用户应能：

- 输入一个 AI 岗位画像。
- 收到 10-15 位可信的全球 AI 候选人。
- 理解每个候选人为什么匹配。
- 看到来自多种来源类型的证据。
- 在分享前识别不确定点或风险。
- 保存或移除 shortlist 中的候选人。
- 把 Web 报告分享给 hiring manager 或客户。

结果体验应该更接近顾问交付的高质量 shortlist，而不是原始搜索结果堆叠。

## 实现计划阶段待定问题

以下问题应在后续实现计划中解决：

- Search Brief 解析应使用确定性 schema extraction、纯 LLM extraction，还是混合方案。
- 第一版实现前是否需要单独的 candidate 和 source records 表。
- 第一版 shortlist report 应继续使用一个 `research_runs` result payload，还是改成 project-oriented data model。
- 如何缓存 source-level evidence，降低重复搜索成本。
- 第一版 AI 方向 taxonomy 是否允许用户编辑。
