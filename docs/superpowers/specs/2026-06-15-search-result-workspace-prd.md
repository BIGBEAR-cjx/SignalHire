# Search Result Workspace PRD

## 1. 背景

DINQ 的最终搜索完成态不是单纯输出候选人，而是把搜索过程、候选人列表、候选人富集档案和商业动作放在同一屏。SignalHire 已经具备搜索计划、候选人证据审计、候选池、补证据和外联草稿能力，但搜索完成后的默认界面仍偏“审阅流程”，没有把结果态包装成一个招聘决策工作台。

本 PRD 的目标是把搜索完成态升级为 Search Result Workspace，让用户完成搜索后能直接判断、筛选、推进和商业化转化。

## 2. 产品目标

- 让用户在搜索完成后 2 分钟内理解：搜了什么、找到了多少人、谁最值得看、为什么匹配、证据是否足够、下一步该做什么。
- 保留 SignalHire 的 evidence-first 定位，不把低证据候选人包装成强推荐。
- 在候选人详情区增加 “Get email -10” 商业化入口，为后续点数扣费、联系方式富集和付费转化预留主动作。
- 将 Research Log 从主视觉降级为可展开的研究过程，增强信任但不干扰候选人判断。

## 3. 用户角色

- HR / Recruiter：需要从搜索结果快速筛选候选人并推进外联。
- 创始人 / Hiring Manager：需要理解候选人为什么值得聊，不能只看名字列表。
- 猎头：需要把候选人、证据和下一步动作整理成可交付结果。

## 4. MVP 范围

包含：

- 搜索完成摘要条：
  - search complete
  - 候选人数
  - source / tool 覆盖
  - 证据覆盖
  - 本轮搜索统计
- 左侧候选人操作列表：
  - match score
  - evidence quality
  - independent source count
  - 一句话匹配理由
  - 主要风险或待验证项
  - 状态：new / shortlisted / needs evidence / passed
- 右侧 Candidate Intelligence Drawer：
  - 候选人基础信息
  - source chips
  - match context
  - Get email -10
  - shortlist
  - draft outreach
  - need more evidence
  - evidence-first profile
- 候选人分组：
  - high-confidence matches
  - needs verification
  - adjacent pool
  - lower-confidence leads
- Research Log 默认折叠：
  - search plan
  - source execution
  - coverage backfill
  - talent map
  - candidate comparison

不包含：

- 真实邮箱抓取。
- 点数扣减。
- 支付。
- 邮箱 OAuth。
- 邮件自动发送。

## 5. 核心用户流程

1. 用户完成一次搜索。
2. 结果页顶部显示完成摘要：找到多少候选人、用了多少来源、证据覆盖如何。
3. 用户在左侧候选人列表按匹配分和证据质量查看候选人。
4. 用户点击候选人，右侧详情抽屉更新。
5. 用户可以执行：
   - Get email -10
   - Add to shortlist
   - Draft outreach
   - Need more evidence
   - Pass
6. 用户需要追溯搜索过程时，展开 Research Log。

## 6. 设计原则

- 列表优先，不做纯聊天结果。
- 右侧详情不跳页，保持候选人列表上下文。
- 分数必须配合证据状态展示。
- 低证据候选人要明确显示需要补证据。
- 商业入口可以先出现，但必须避免暗示真实邮箱已经可用。

## 7. 数据与技术方案

- 新增纯函数 `buildSearchResultWorkspace(result, options)`：
  - 输入 `TalentSearchResult`
  - 输出 completion metrics、candidate rows、candidate groups、research log summary、selected candidate index。
- React 组件只消费 workspace view model，避免把排序、分组和商业入口逻辑散落在 JSX。
- 复用现有：
  - `buildCandidateEvidenceAudit`
  - `buildEvidenceCoverage`
  - `buildSourceExecution`
  - `CandidateProfileView`
  - shortlist API
  - outreach modal
  - coverage backfill

## 8. 商业化入口

MVP 中 `Get email -10` 是明确商业动作入口：

- 文案固定为 `Get email -10`。
- 位置在候选人详情主操作区，比 Draft outreach 更靠前。
- 点击后进入占位状态，说明联系方式富集和点数扣减即将接入。
- 不执行真实扣费，不猜测私人邮箱，不生成未经验证邮箱。

后续版本：

- 增加 credit balance。
- 接入联系方式富集 API。
- 增加扣点确认。
- 增加合规说明和来源记录。

## 9. 验收标准

- 搜索完成后默认展示 Search Result Workspace，而不是只展示旧版审阅卡片。
- 顶部能看到候选人数、来源/工具数量、证据覆盖和完成状态。
- 候选人列表每行都有 match score、evidence quality、匹配理由和下一步动作。
- 点击候选人时，右侧详情区更新，不离开当前结果页。
- 右侧详情区存在 `Get email -10` 入口。
- `Get email -10` 不会猜测邮箱或显示假邮箱。
- Research Log 默认折叠，展开后能看到搜索计划和来源执行信息。
- 现有 shortlist、need more evidence、draft outreach 功能仍可从结果态触发。
- 新增 view model 有自动化测试覆盖。
- 构建通过。
- 独立 agent 完成验收，并覆盖产品设计、交互、代码和功能风险。
