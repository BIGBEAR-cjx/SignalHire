import assert from "node:assert/strict";
import { test } from "node:test";

import { isLocale, normalizeLocale, t } from "./web/lib/i18n.mjs";

test("normalizes supported locales and falls back to Chinese", () => {
  assert.equal(normalizeLocale("zh"), "zh");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("fr"), "zh");
  assert.equal(normalizeLocale(undefined), "zh");
});

test("identifies supported locales", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("ja"), false);
});

test("translates known keys and falls back to Chinese or key", () => {
  assert.equal(t("zh", "nav.search"), "智能搜人");
  assert.equal(t("en", "nav.search"), "AI Search");
  assert.equal(t("fr", "nav.search"), "智能搜人");
  assert.equal(t("en", "missing.key"), "missing.key");
});

test("translates project evidence matrix labels", () => {
  const keys = [
    ["projects.evidenceMatrix.summary.total", "总数", "Total"],
    ["projects.evidenceMatrix.summary.active", "推进中", "Active"],
    ["projects.evidenceMatrix.summary.risk", "风险", "Risk"],
    ["projects.evidenceMatrix.summary.needsBackfill", "需补证据", "Needs evidence"],
    ["projects.evidenceMatrix.summary.ready", "可审阅", "Ready"],
    ["projects.evidenceMatrix.summary.rejected", "已拒", "Rejected"],
    ["projects.evidenceMatrix.column.candidate", "候选人", "Candidate"],
    ["projects.evidenceMatrix.column.status", "状态", "Status"],
    ["projects.evidenceMatrix.column.match", "匹配", "Match"],
    ["projects.evidenceMatrix.column.evidence", "证据", "Evidence"],
    ["projects.evidenceMatrix.column.sources", "信源", "Sources"],
    ["projects.evidenceMatrix.column.checks", "核验", "Checks"],
    ["projects.evidenceMatrix.column.priority", "优先级", "Priority"],
    ["projects.evidenceMatrix.column.next", "下一步", "Next step"],
  ];

  for (const [key, zh, en] of keys) {
    assert.equal(t("zh", key), zh);
    assert.equal(t("en", key), en);
  }
});

test("translates editable search plan labels", () => {
  const keys = [
    ["research.plan.mustHave", "必须条件", "Must-have criteria"],
    ["research.plan.niceToHave", "加分条件", "Nice-to-have criteria"],
    ["research.plan.exclusions", "排除条件", "Exclusions"],
  ];

  for (const [key, zh, en] of keys) {
    assert.equal(t("zh", key), zh);
    assert.equal(t("en", key), en);
  }
});

test("translates research fallback error labels", () => {
  const keys = [
    ["research.error.emptyResult", "研究完成但结果为空，请重新研究", "Research completed but returned no result. Run it again."],
    ["research.error.failed", "研究失败，请重试", "Research failed. Try again."],
    ["research.error.generic", "出错了", "Something went wrong."],
    ["research.error.backfillQueued", "补搜入队失败", "Failed to queue evidence backfill."],
  ];

  for (const [key, zh, en] of keys) {
    assert.equal(t("zh", key), zh);
    assert.equal(t("en", key), en);
  }
});

test("translates research progress labels", () => {
  const keys = [
    ["research.progress.fetch.label", "读取来源", "Source read"],
    ["research.progress.search.label", "搜索关键词", "Search query"],
    ["research.progress.step.label", "研究步骤", "Research step"],
    ["research.progress.stats", "搜索 2 次 · 抓取 1 页", "2 searches · 1 pages fetched", { searches: 2, fetches: 1 }, { searches: 2, fetches: 1 }],
    ["research.progress.statsWaiting", "等待第一批搜索事件", "Waiting for the first search event"],
  ];

  for (const [key, zh, en, zhParams, enParams] of keys) {
    assert.equal(t("zh", key, zhParams), zh);
    assert.equal(t("en", key, enParams), en);
  }
});

test("translates source quality labels", () => {
  const keys = [
    ["sourceQuality.strong.label", "证据较厚", "Strong evidence"],
    ["sourceQuality.strong.hint", "多数声称有多个独立信源支撑", "Most claims are supported by multiple independent sources"],
    ["sourceQuality.moderate.label", "证据中等", "Moderate evidence"],
    ["sourceQuality.moderate.hint", "大部分声称有信源, 但密度不高", "Most claims have sources, but the density is limited"],
    ["sourceQuality.thin.label", "证据偏薄", "Thin evidence"],
    ["sourceQuality.thin.hint", "信源稀疏, 谨慎做决策依据", "Sources are sparse; use caution before making decisions"],
    ["sourceQuality.sourceCount.none", "无来源", "No sources"],
    ["sourceQuality.sourceCount.one", "1 处独立信源", "1 independent source", { count: 1 }, { count: 1 }],
    ["sourceQuality.sourceCount.many", "2 处独立信源", "2 independent sources", { count: 2 }, { count: 2 }],
  ];

  for (const [key, zh, en, zhParams, enParams] of keys) {
    assert.equal(t("zh", key, zhParams), zh);
    assert.equal(t("en", key, enParams), en);
  }
});

test("translates result verdict and source labels", () => {
  const keys = [
    ["result.unknownCandidate", "未知候选人", "Unknown candidate"],
    ["result.source", "来源", "Source"],
    ["result.verified", "已验证", "Verified"],
    ["result.contradicted", "矛盾", "Contradicted"],
    ["result.unverified", "查无实据", "No evidence found"],
    ["result.sourceCountTitle", "覆盖该声称的不同域名数 (越多越可靠)", "Number of distinct domains covering this claim (more is stronger)"],
  ];

  for (const [key, zh, en] of keys) {
    assert.equal(t("zh", key), zh);
    assert.equal(t("en", key), en);
  }
});

test("translates result delivery summary labels", () => {
  const keys = [
    ["result.deliveryTitle", "交付报告摘要", "Delivery summary"],
    ["result.deliveryBadge", "招聘候选名单", "Recruiting shortlist"],
    ["result.candidates", "候选人", "Candidates"],
    ["result.strongRecommendations", "3 位强推荐", "3 strong recommendations", { count: 3 }, { count: 3 }],
    ["result.averageMatch", "平均匹配分", "Average match"],
    ["result.strongEvidenceCandidates", "证据强候选人", "Strong-evidence candidates"],
    ["result.sourceCoverage", "信息源覆盖", "Source coverage"],
    ["result.priorityReview", "优先审阅候选人", "Priority review candidates"],
    ["result.sourcesShort", "信源", "sources"],
    ["result.deliveryRisks", "交付风险", "Delivery risks"],
    ["result.nextSteps", "建议下一步", "Suggested next steps"],
  ];

  for (const [key, zh, en, zhParams, enParams] of keys) {
    assert.equal(t("zh", key, zhParams), zh);
    assert.equal(t("en", key, enParams), en);
  }
});

test("translates result search plan labels", () => {
  const keys = [
    ["result.searchPlanTitle", "搜索计划", "Search plan"],
    ["result.searchPlanDesc", "系统如何拆解岗位画像、选择来源并扩展相邻人才池。", "How the system decomposed the role profile, selected sources, and expanded adjacent talent pools."],
    ["result.notIdentified", "未识别", "Not identified"],
    ["result.sourceQueryPlan", "来源查询计划", "Source query plan"],
    ["result.items", "条", "items"],
    ["result.adjacentPools", "相邻人才池", "Adjacent talent pools"],
  ];

  for (const [key, zh, en] of keys) {
    assert.equal(t("zh", key), zh);
    assert.equal(t("en", key), en);
  }
});

test("translates result source execution labels", () => {
  const keys = [
    ["result.research", "研究", "Research"],
    ["result.practice", "实践", "Practice"],
    ["result.work_history", "工作经历", "Work history"],
    ["result.public_voice", "公开表达", "Public voice"],
    ["result.planned", "待执行", "Planned"],
    ["result.completed", "已完成", "Completed"],
    ["result.partial", "部分完成", "Partial"],
    ["result.failed", "失败", "Failed"],
    ["result.sourceExecutionTitle", "来源执行记录", "Source execution log"],
    ["result.sourceExecutionReturned", "记录每类来源任务的实际查询、具体链接、证据数量和后续缺口。", "Shows the actual query, links, evidence count, and remaining gaps for each source task."],
    ["result.sourceExecutionPlanned", "本次结果未返回执行记录，先展示可执行的来源任务计划。", "This result did not return execution logs, so the executable source plan is shown instead."],
    ["result.executed", "已执行", "executed"],
    ["result.evidence", "证据", "evidence"],
    ["result.links", "链接", "links"],
    ["result.leads", "线索", "Leads"],
  ];

  for (const [key, zh, en] of keys) {
    assert.equal(t("zh", key), zh);
    assert.equal(t("en", key), en);
  }
});

test("translates result backfill labels", () => {
  const keys = [
    ["result.backfillTitle", "缺口补搜计划", "Gap backfill plan"],
    ["result.backfillDesc", "把缺失或偏弱的信息源覆盖转成下一轮可执行查询。", "Turns missing or weak source coverage into executable queries for the next round."],
    ["result.gaps", "个缺口", "gaps"],
    ["result.plannedBackfill", "待补搜", "Backfill planned"],
    ["result.completedBackfill", "已补齐", "Backfilled"],
    ["result.skippedBackfill", "已跳过", "Skipped"],
    ["result.affectedCandidates", "影响候选人", "Affected candidates"],
    ["result.prioritySources", "优先来源", "Priority sources"],
    ["result.enqueueingBackfill", "补搜入队中…", "Queueing backfill..."],
    ["result.backfillGap", "补搜这个缺口", "Backfill this gap"],
    ["result.backfillDeltaTitle", "补搜证据增量", "Backfill evidence delta"],
    ["result.candidateBackfillMerged", "已回流到候选人档案", "Merged into this candidate dossier"],
    ["result.merged", "已合并", "Merged"],
    ["result.mergeable", "可合并", "Mergeable"],
    ["result.newSources", "新增来源", "New sources"],
    ["result.newEvidence", "+2 证据", "+2 evidence", { count: 2 }, { count: 2 }],
    ["result.backfillNewCandidates", "补搜还发现新候选人：张三", "Backfill also found new candidates: Alice", { names: "张三" }, { names: "Alice" }],
    ["result.mergedBack", "已合并回原报告", "Merged into original report"],
    ["result.merging", "正在合并…", "Merging..."],
    ["result.mergeBack", "合并回原报告", "Merge into original report"],
  ];

  for (const [key, zh, en, zhParams, enParams] of keys) {
    assert.equal(t("zh", key, zhParams), zh);
    assert.equal(t("en", key, enParams), en);
  }
});

test("translates project detail status labels", () => {
  const keys = [
    ["projects.detail.status.open", "进行中", "Open"],
    ["projects.detail.status.paused", "暂停", "Paused"],
    ["projects.detail.status.closed", "已关闭", "Closed"],
    ["projects.detail.candidateStatus.new", "待联系", "New"],
    ["projects.detail.candidateStatus.contacted", "已联系", "Contacted"],
    ["projects.detail.candidateStatus.interviewing", "面试中", "Interviewing"],
    ["projects.detail.candidateStatus.hired", "已 hire", "Hired"],
    ["projects.detail.candidateStatus.rejected", "已拒", "Rejected"],
  ];

  for (const [key, zh, en] of keys) {
    assert.equal(t("zh", key), zh);
    assert.equal(t("en", key), en);
  }
});

test("translates project detail shell labels", () => {
  const keys = [
    ["projects.detail.backToProjects", "回项目列表", "Back to projects"],
    ["projects.detail.loading.title", "正在加载项目", "Loading project"],
    ["projects.detail.loading.desc", "正在读取项目画像、候选人和历史研究。", "Reading project profile, candidates, and research history."],
    ["projects.detail.kpi.candidates", "候选人", "Candidates"],
    ["projects.detail.kpi.people", "人", "people"],
    ["projects.detail.candidates.title", "候选人", "Candidates"],
    ["projects.detail.candidates.loadingTitle", "正在加载候选人", "Loading candidates"],
    ["projects.detail.candidates.loadingDesc", "正在同步本项目下的候选人状态和证据画像。", "Syncing candidate status and evidence profiles for this project."],
    ["projects.detail.candidates.emptyTitle", "本项目还没有候选人", "No candidates in this project yet"],
    ["projects.detail.candidates.emptyDesc", "先在本项目下启动一次搜人，候选人会自动回到这个项目空间。", "Run a search in this project first. Candidates will return to this project space automatically."],
    ["projects.detail.candidates.filteredEmptyTitle", "这个状态下没有候选人", "No candidates in this status"],
    ["projects.detail.candidates.filteredEmptyDesc", "切换状态筛选，或继续补充候选人。", "Switch status filters or add more candidates."],
    ["projects.detail.candidates.selectHint", "点左侧候选人查看画像、切状态、写备注。", "Select a candidate on the left to view the profile, change status, and add notes."],
    ["projects.detail.funnel.eyebrow", "候选人漏斗", "Candidate funnel"],
    ["projects.detail.funnel.title", "状态漏斗", "Status funnel"],
  ];

  for (const [key, zh, en] of keys) {
    assert.equal(t("zh", key), zh);
    assert.equal(t("en", key), en);
  }
});

test("translates project detail interaction labels", () => {
  const keys = [
    ["projects.detail.header.eyebrow", "项目工作台", "Project workbench"],
    ["projects.detail.header.editTitle", "点击编辑", "Click to edit"],
    ["projects.detail.header.deleteProject", "删除项目", "Delete project"],
    ["projects.detail.header.deleteConfirm", "删除这个项目?\n关联候选人和历史会回到「候选池(全部)」, 不会丢失。", "Delete this project?\nRelated candidates and history will return to Shortlist (all). Nothing will be lost."],
    ["projects.detail.header.deleteFailed", "删除失败", "Delete failed"],
    ["projects.detail.brief.label", "招聘需求 / brief", "Hiring brief"],
    ["projects.detail.brief.edit", "编辑", "Edit"],
    ["projects.detail.brief.add", "添加", "Add"],
    ["projects.detail.brief.placeholder", "粘贴 JD, 或一句话描述要找什么样的人。", "Paste a JD, or describe the person you need in one sentence."],
    ["projects.detail.brief.empty", "暂无 brief — 加上之后, 在本项目下搜人会预填它", "No brief yet - add one and searches in this project will prefill it."],
    ["projects.detail.candidate.unknownName", "(无名)", "(Unnamed)"],
    ["projects.detail.candidate.notesPrefix", "备注：第一轮已沟通", "Notes: First round completed", { notes: "第一轮已沟通" }, { notes: "First round completed" }],
    ["projects.detail.candidate.updateFailed", "更新失败", "Update failed"],
    ["projects.detail.candidate.removeConfirm", "把这个候选人移出候选池?", "Remove this candidate from the shortlist?"],
    ["projects.detail.candidate.unassign", "移出项目", "Remove from project"],
    ["projects.detail.candidate.delete", "删除候选人", "Delete candidate"],
    ["projects.detail.candidate.feedbackSaved", "会同步到下一轮搜索优化。", "Saved into next-round search signals."],
    ["projects.detail.candidate.outreach", "AI 起草外联邮件", "Draft outreach with AI"],
    ["projects.detail.candidate.notes", "备注", "Notes"],
    ["projects.detail.candidate.saved", "已保存", "Saved"],
    ["projects.detail.candidate.autosave", "自动保存", "Autosaving"],
    ["projects.detail.candidate.notesPlaceholder", "第一次约见印象 / 你想问的问题 / 候选人对项目的反应…", "First-call impression / questions to ask / candidate reaction..."],
    ["projects.detail.candidate.addedAt", "添加于 2026/6/5 12:00", "Added at 6/5/2026, 12:00 PM", { date: "2026/6/5 12:00" }, { date: "6/5/2026, 12:00 PM" }],
  ];

  for (const [key, zh, en, zhParams, enParams] of keys) {
    assert.equal(t("zh", key, zhParams), zh);
    assert.equal(t("en", key, enParams), en);
  }
});

test("translates project detail queue and fallback labels", () => {
  const keys = [
    ["projects.detail.error.loadProject", "加载失败", "Failed to load project"],
    ["projects.detail.error.loadCandidates", "候选人加载失败", "Failed to load candidates"],
    ["projects.actionBrief.eyebrow", "工作台", "Workbench"],
    ["projects.actionBrief.startSearch", "启动搜人", "Start search"],
    ["projects.decisionQueue.eyebrow", "决策队列", "Decision queue"],
    ["projects.decisionQueue.title", "候选人决策队列", "Candidate decision queue"],
    ["projects.decisionQueue.description", "按待看、推进中、需补证据和不合适分组，先处理证据风险和高意向候选人。", "Grouped by review, active progress, evidence gaps, and not-a-fit so teams can handle the highest-risk candidates first."],
    ["projects.decisionQueue.backfill", "补搜证据", "Backfill evidence"],
    ["projects.decisionQueue.overflow", "还有 3 位，切换下方列表继续查看。", "3 more candidates. Use the list below to keep reviewing.", { count: 3 }, { count: 3 }],
    ["projects.decisionQueue.empty", "暂无候选人", "No candidates"],
  ];

  for (const [key, zh, en, zhParams, enParams] of keys) {
    assert.equal(t("zh", key, zhParams), zh);
    assert.equal(t("en", key, enParams), en);
  }
});

test("translates shortlist fallback labels", () => {
  assert.equal(t("zh", "shortlist.loadFailed"), "加载失败");
  assert.equal(t("en", "shortlist.loadFailed"), "Failed to load shortlist");
});

test("translates projects fallback labels", () => {
  assert.equal(t("zh", "projects.loadFailed"), "加载失败");
  assert.equal(t("en", "projects.loadFailed"), "Failed to load projects");
});

test("translates overview empty onboarding labels", () => {
  const keys = [
    ["overview.emptyTitle", "开始第一轮 AI 人才搜索", "Start your first AI talent search"],
    ["overview.emptyDesc", "创建项目或直接描述人才画像，SignalHire 会生成候选名单、证据摘要和下一轮优化建议。", "Create a project or describe the talent profile directly. SignalHire will generate a shortlist, evidence summary, and next-round recommendations."],
    ["overview.emptyAction", "开始搜人", "Start search"],
  ];

  for (const [key, zh, en] of keys) {
    assert.equal(t("zh", key), zh);
    assert.equal(t("en", key), en);
  }
});

test("translates auth modal labels", () => {
  const keys = [
    ["common.close", "关闭", "Close"],
    ["auth.modalNeedVerify", "请输入邮箱收到的验证码完成验证", "Enter the verification code sent to your email to finish verification."],
    ["auth.modalCodeSent", "验证码已发送到 test@example.com，请输入。", "A code has been sent to test@example.com. Enter it below.", { email: "test@example.com" }, { email: "test@example.com" }],
    ["auth.modalAccount", "账户", "Account"],
    ["auth.modalLoginTitle", "登录控制台", "Log in to workspace"],
    ["auth.modalRegisterTitle", "创建 SignalHire 账号", "Create a SignalHire account"],
    ["auth.nameOptional", "名字（可选）", "Name (optional)"],
    ["auth.passwordRegisterPlaceholder", "密码（至少 6 位）", "Password (at least 6 characters)"],
    ["auth.processing", "处理中…", "Processing…"],
    ["auth.back", "返回", "Back"],
    ["auth.goRegister", "去注册", "Sign up"],
    ["auth.goLogin", "去登录", "Log in"],
  ];

  for (const [key, zh, en, zhParams, enParams] of keys) {
    assert.equal(t("zh", key, zhParams), zh);
    assert.equal(t("en", key, enParams), en);
  }
});

test("translates outreach modal labels", () => {
  const keys = [
    ["outreach.tone.professional", "专业", "Professional"],
    ["outreach.tone.friendly", "友好", "Friendly"],
    ["outreach.tone.short", "短而准", "Short"],
    ["outreach.tone.detailed", "详细", "Detailed"],
    ["outreach.eyebrow", "证据外联", "Evidence outreach"],
    ["outreach.title", "起草外联邮件", "Draft outreach email"],
    ["outreach.toCandidate", "写给 Ada", "Writing to Ada", { name: "Ada" }, { name: "Ada" }],
    ["outreach.senderLabel", "你的名字 (用于邮件签名)", "Your name (for email signature)"],
    ["outreach.senderPlaceholder", "例如:王力", "Example: Alex Wang"],
    ["outreach.loading", "正在根据证据起草…", "Drafting from evidence..."],
    ["outreach.subject", "主题", "Subject"],
    ["outreach.body", "正文", "Body"],
    ["outreach.evidenceTitle", "本次外联依据", "Evidence used for this outreach"],
    ["outreach.copyEvidence", "复制依据", "Copy evidence"],
    ["outreach.copiedEvidence", "已复制依据", "Evidence copied"],
    ["outreach.evidenceLinks", "3 个证据链接", "3 evidence links", { count: 3 }, { count: 3 }],
    ["outreach.riskNote", "注意: 身份需复核", "Note: Review identity", { note: "身份需复核" }, { note: "Review identity" }],
    ["outreach.regenerate", "重新生成", "Regenerate"],
    ["outreach.copyAll", "复制全文", "Copy full email"],
    ["outreach.sendMail", "用邮件 App 发送", "Send with Mail app"],
    ["outreach.error.localDraft", "AI 生成失败，已使用本地证据草稿：timeout", "AI generation failed. Local evidence draft used: timeout", { message: "timeout" }, { message: "timeout" }],
    ["outreach.clipboard.contactAngle", "联系角度", "Contact angle"],
    ["outreach.clipboard.proofPoints", "证据点", "Proof points"],
    ["outreach.clipboard.sources", "来源", "Sources"],
    ["outreach.clipboard.note", "注意", "Note"],
  ];

  for (const [key, zh, en, zhParams, enParams] of keys) {
    assert.equal(t("zh", key, zhParams), zh);
    assert.equal(t("en", key, enParams), en);
  }
});
