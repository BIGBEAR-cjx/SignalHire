# 搜索前需求澄清 PRD

## 1. 背景

SignalHire 已经具备 AI 人才搜索、证据覆盖、候选人报告、项目候选池和搜索计划编辑能力。当前问题是：用户输入 JD 或一句岗位描述后，系统很快进入 `must_have / nice_to_have / exclusions / source_strategy` 这样的搜索计划编辑界面。

这套结构对系统和高级用户有价值，但对多数 HR、创始人和猎头来说过早暴露了内部检索模型。用户更自然的决策语言是：地点、薪资、候选数量、证据偏好、哪些条件必须满足、哪些条件只是加分。

DINQ 的搜索前交互值得学习的不是聊天 UI 本身，而是它把复杂搜人任务拆成几个低成本、可点击、招聘方能快速回答的问题。SignalHire 应保留 evidence-first 的产品定位，在搜索前增加一层轻量需求澄清，让用户先确认招聘约束，再进入证据化搜索。

## 2. 产品目标

把 SignalHire 的搜索前流程从“直接生成高级搜索计划”升级为“先澄清招聘约束，再生成可执行搜索计划”。

用户输入 JD 或自然语言需求后，系统应先输出一张可确认的需求理解卡，并在缺少关键约束时提出 2 到 4 个选择题。用户可以点选、手动输入或跳过。完成后，系统生成搜索确认卡，再启动深度搜索。

## 3. 目标用户

- 初创公司创始人：知道想招什么人，但没有写成结构化招聘条件。
- HR / Recruiter：需要快速把 JD 转成可执行搜索任务。
- 猎头：需要把客户给的模糊岗位需求转成清晰 candidate profile。
- Hiring manager：希望搜索前确认系统理解没有偏差。

## 4. 用户问题

当前流程存在三个问题：

- 认知负担高：`practice / research / work_history / public_voice` 是系统视角，不是招聘方第一语言。
- 缺关键约束：地点、薪资、候选数量、证据偏好经常不在 JD 里，但会显著影响搜索策略。
- 搜索启动前缺确认：用户无法在低成本阶段确认“系统到底准备搜什么人”。

## 5. 设计原则

- 先用招聘语言，再用系统语言。
- 选择题优先，手动输入兜底。
- 用户始终可以跳过澄清，直接搜索。
- 不把 SignalHire 改成纯聊天产品，聊天式澄清只作为 intake layer。
- 高级搜索计划继续存在，但默认折叠。
- 搜索确认必须可解释，不能只是黑盒总结。

## 6. MVP 范围

### 包含

1. 需求理解卡
   - 岗位标题
   - 必须条件
   - 加分条件
   - 排除条件
   - 系统发现的不确定项

2. 搜索前澄清问题
   - 工作地点偏好
   - 薪资范围
   - 目标候选人数 / 搜索深度
   - 证据偏好

3. 选择题交互
   - 每题 3 到 5 个建议选项
   - 支持“自定义输入”
   - 支持“跳过”

4. 搜索确认卡
   - 汇总最终 candidate profile
   - 展示系统将如何搜索
   - 展示哪些条件影响搜索权重
   - 主按钮：开始搜索
   - 次按钮：继续调整
   - 高级入口：展开高级搜索策略

5. 与现有搜索计划打通
   - 用户选择会更新 `search_plan.must_have`
   - 用户选择会更新 `search_plan.nice_to_have`
   - 用户选择会更新 `search_plan.exclusions`
   - 用户选择会更新 `search_plan.source_strategy[].query`
   - `practice / research / work_history / public_voice` 面板保留，但默认折叠

### 不包含

- 不做完整聊天机器人。
- 不做多轮自由对话记忆。
- 不新增真实邮箱触达。
- 不新增数据库表。
- 不做复杂问卷后台配置。
- 不替换现有 worker 输出协议。
- 不改变搜索结果页的证据展示结构。

## 7. 核心用户流程

### 7.1 输入 JD 后生成需求理解

1. 用户进入搜索页。
2. 用户输入一句需求或上传 JD。
3. 系统解析出需求理解卡。
4. 用户看到结构化结果，而不是直接看到高级搜索计划。

示例：

- 岗位：AI 全栈开发工程师
- 必须条件：
  - React / Next.js
  - Node.js 或 Python
  - AI Agent 或 LLM 应用实战
  - 应届或毕业 3 年内
- 加分条件：
  - 开源维护经历
  - 技术内容创作
  - LangChain / AutoGPT / Cursor / Claude / Codex 实战
- 排除条件：
  - 纯传统 CRUD
  - 无 AI 原生开发经验

### 7.2 进入 3 问澄清

如果系统判断缺少关键约束，展示澄清问题。

问题 1：工作地点

- 不限地点（全国 / 海外远程均可）
- 北上广深一线城市
- 杭州 / 成都 / 南京等新一线
- 海外华人优先
- 自定义

问题 2：薪资范围

- 20-30K
- 30-50K
- 50K 以上
- 面议 / 按能力定
- 自定义

问题 3：目标候选人数

- 3-5 位精选
- 8-10 位
- 15-20 位
- 越多越好
- 自定义

可选问题 4：证据偏好

- 开源项目优先
- 产品落地优先
- 大厂 / 知名团队经历优先
- 论文 / 研究经历优先
- 技术内容 / 公开表达优先

### 7.3 生成搜索确认卡

用户回答后，系统生成搜索确认卡。

确认卡内容：

- 搜索目标：一句话总结要找的人。
- 必须条件：用于硬过滤或高权重匹配。
- 加分条件：用于排序和候选解释。
- 排除条件：用于降低明显不匹配候选。
- 地点与薪资：用于搜索关键词和候选评估。
- 目标数量：影响搜索深度。
- 证据偏好：影响来源优先级。
- 搜索方向：用自然语言说明 source strategy。

CTA：

- 开始搜索
- 继续调整
- 展开高级搜索策略

### 7.4 搜索中进度语言优化

搜索启动后，搜索过程不只显示技术事件，还要显示用户能理解的计划执行语言。

示例：

- 正在规划搜索方向：优先找 GitHub 上有 Next.js + LangChain / LLM 项目的年轻开发者。
- 正在补工作经历证据：查找公司页、个人主页和公开履历。
- 正在补公开表达证据：查找技术博客、演讲、播客和社交内容。
- 正在整理候选人：按匹配度、证据质量和风险排序。

## 8. 信息架构

搜索页建议结构：

1. 输入区
2. 需求理解卡
3. 澄清问题区
4. 搜索确认卡
5. 高级搜索策略（默认折叠）
6. 搜索过程面板
7. 搜索结果

显示规则：

- 输入后未生成计划：只显示输入区。
- 已生成需求理解但未确认：显示需求理解卡和澄清问题。
- 澄清完成或用户跳过：显示搜索确认卡。
- 用户展开高级：显示现有搜索策略编辑面板。
- 搜索启动：隐藏澄清问题，保留搜索确认摘要。

## 9. 数据结构建议

第一版不新增数据库表，只在前端和搜索输入中组织结构。

### `SearchIntakeDraft`

```ts
type SearchIntakeDraft = {
  original_query: string;
  role_title: string;
  must_have: string[];
  nice_to_have: string[];
  exclusions: string[];
  unknowns: string[];
  clarification: {
    location?: string;
    salary?: string;
    target_count?: string;
    evidence_preference?: string;
  };
  skipped_questions: string[];
};
```

### `ClarificationQuestion`

```ts
type ClarificationQuestion = {
  key: "location" | "salary" | "target_count" | "evidence_preference";
  question: string;
  reason: string;
  options: Array<{
    label: string;
    value: string;
    effect: string;
  }>;
  allow_custom: boolean;
  skippable: boolean;
};
```

### 与现有 `TalentSearchResult` 的映射

- `role_title` 写入 `search_brief.target_directions` 或搜索摘要。
- `must_have` 写入 `search_plan.must_have`。
- `nice_to_have` 写入 `search_plan.nice_to_have`。
- `exclusions` 写入 `search_plan.exclusions`。
- `location / salary / target_count / evidence_preference` 写入最终 search input 文本，并影响 `source_strategy[].query`。
- `evidence_preference` 用于调整 source strategy 排序，不删除其他来源。

## 10. 组件设计

### `SearchIntakePanel`

职责：承接用户输入后的需求理解和澄清入口。

输入：

- `input`
- `draft`
- `questions`
- `onAnswer`
- `onSkip`
- `onEditDraft`
- `onConfirm`

输出：

- 需求理解卡
- 当前澄清问题
- 选项按钮
- 自定义输入框
- 跳过按钮

### `RequirementUnderstandingCard`

职责：展示系统如何理解 JD。

模块：

- 岗位标题
- 必须条件
- 加分条件
- 排除条件
- 不确定项

### `ClarificationQuestionCard`

职责：展示一个问题和多个选项。

交互：

- 点击选项后进入下一题。
- 用户输入自定义答案后进入下一题。
- 点击跳过后保留 skipped state。

### `SearchConfirmationCard`

职责：搜索启动前的最终确认。

模块：

- 搜索目标摘要
- 关键约束
- 目标数量
- 证据偏好
- 搜索方向摘要
- 开始搜索按钮
- 继续调整按钮
- 展开高级搜索策略按钮

### `AdvancedSearchPlanDisclosure`

职责：承载现有 `EditableSearchPlanPanel`。

规则：

- 默认折叠。
- 标题用用户语言，例如“高级：查看系统搜索策略”。
- 展开后仍允许编辑 `must_have / nice_to_have / exclusions / source_strategy`。

## 11. 文案要求

文案要避免技术化和系统自夸。

推荐文案：

- “我先确认几个会影响搜索质量的条件。”
- “这些条件会影响候选人排序和证据来源优先级。”
- “你可以跳过，系统会按当前信息直接搜索。”
- “开始搜索前，请确认这就是你要找的人。”

避免文案：

- “正在优化多源搜索策略。”
- “请配置 evidence coverage 权重。”
- “请编辑 source strategy。”
- “AI 将为你生成精准人才画像。”

## 12. 成功指标

产品指标：

- 搜索前澄清完成率。
- 用户跳过澄清比例。
- 搜索启动率。
- 搜索后反馈中“方向不对”的比例下降。
- 搜索后候选人加入 shortlist 的比例上升。
- 用户手动编辑高级搜索策略的比例下降。

质量指标：

- JD 全文不应被直接复制进 source query。
- 澄清问题不超过 4 个。
- 任一问题都可跳过。
- 用户在 30 秒内能从输入进入搜索。
- 搜索确认卡能被招聘方直接读懂。

## 13. 验收标准

- 输入 JD 后，页面先展示需求理解卡，而不是直接展示高级搜索策略。
- 需求理解卡至少包含必须条件、加分条件、排除条件。
- 如果地点、薪资、目标数量缺失，系统展示澄清问题。
- 每个澄清问题都有可点击选项、自定义输入和跳过。
- 回答澄清问题后，搜索确认卡会同步更新。
- 点击“开始搜索”后，调用现有搜索流程。
- 点击“展开高级搜索策略”后，可以看到并编辑现有 `EditableSearchPlanPanel`。
- 高级搜索策略默认不打断普通用户。
- `practice / research / work_history / public_voice` 不作为第一层用户入口展示。
- 中文和英文界面文案都存在。

## 14. 分阶段交付

### Phase 1：搜索前澄清 MVP

目标：先把搜索前用户心智改顺。

交付：

- `SearchIntakeDraft` helper。
- `RequirementUnderstandingCard`。
- `ClarificationQuestionCard`。
- `SearchConfirmationCard`。
- 高级搜索策略默认折叠。
- 地点、薪资、候选数量三类问题。
- 单元测试覆盖 JD 解析和澄清映射。

### Phase 2：证据偏好与搜索过程语言

目标：让用户知道为什么这样搜。

交付：

- 证据偏好问题。
- source strategy 排序调整。
- 搜索中自然语言进度摘要。
- 搜索确认卡保留在结果页顶部。

### Phase 3：项目级复用

目标：让项目长期搜索任务也能复用 intake。

交付：

- Project brief 编辑时复用需求理解卡。
- Talent Monitor 创建时复用澄清问题。
- Search Task 的 next run 继承澄清约束。

## 15. 风险与取舍

风险 1：过多问题降低启动率。

应对：MVP 固定最多 3 个必问问题，全部可跳过。

风险 2：规则解析不如 LLM 准确。

应对：第一版只做高确定性段落识别和用户确认，不假装自动理解完整语义。

风险 3：隐藏高级搜索策略影响高级用户。

应对：默认折叠但入口明确，已展开过的用户可在本地记住偏好。

风险 4：变成聊天产品，削弱 SignalHire 的证据定位。

应对：澄清流程只发生在搜索前，搜索后仍以证据报告、候选人审阅、shortlist 和 follow-up 为主。

## 16. 推荐结论

应该学习 DINQ 的“搜索前低摩擦澄清”能力，但不学习其纯聊天形态。SignalHire 的差异化仍然是 evidence-first recruiting workspace。最优路线是：在现有搜索页前加一个 intake layer，把用户语言转成搜索计划，再把高级搜索策略藏到可展开区域。

这会让新用户更容易启动第一次搜索，也能减少“搜出来方向不对”的反馈，同时不牺牲 SignalHire 后续的证据审计和招聘执行闭环。
