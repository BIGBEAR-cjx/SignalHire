/**
 * Chinese copy for the operations console.
 *
 * This module deliberately does not expose API error codes or raw enum values
 * to users. New values must either be added to the maps below or use the
 * explicit, caller-provided Chinese fallback.
 */

export const OPS_ERROR_MESSAGES_ZH = Object.freeze({
  login_required: "请先登录",
  forbidden: "无权访问后台",
  user_id_or_email_required: "请输入用户 ID 或邮箱",
  user_id_required: "缺少用户 ID",
  invalid_json: "请求格式无效",
  invalid_grant: "Credits 发放参数无效",
  identity_label_failed: "身份标签记录失败",
  credits_lookup_failed: "Credits 账户查询失败",
  credits_grant_failed: "Credits 发放失败",
  credits_ledger_lookup_failed: "Credits 账本查询失败",
  failed_reservations_lookup_failed: "失败预留查询失败",
  search_eval_review_lookup_failed: "Search Eval 复核数据加载失败",
  search_eval_review_storage_not_configured: "Search Eval 复核存储未配置",
  invalid_review_submission: "复核提交内容无效",
  search_eval_review_store_failed: "Search Eval 复核保存失败",
  invalid_review_id: "复核 ID 无效",
  review_is_not_ready_for_promotion: "复核尚未满足升级条件",
  review_confirmation_failed: "复核确认失败",
  search_eval_review_confirmation_failed: "Search Eval 复核确认失败",
});

export const LEDGER_ENTRY_LABELS_ZH = Object.freeze({
  grant: "发放",
  reserve: "预留",
  settle: "结算",
  release: "释放",
});

export const MONITOR_FAILURE_LABELS_ZH = Object.freeze({
  monitor_run_failed: "运行失败",
  monitor_run_cancelled: "运行已取消",
});

export const REVIEW_VERDICT_LABELS_ZH = Object.freeze({
  pass: "通过",
  revise: "需修订",
  uncertain: "不确定",
});

/** Return a safe Chinese message for an API error code. */
export function apiErrorMessage(errorCode, fallback = "操作失败") {
  return typeof errorCode === "string" && Object.prototype.hasOwnProperty.call(OPS_ERROR_MESSAGES_ZH, errorCode)
    ? OPS_ERROR_MESSAGES_ZH[errorCode]
    : (typeof fallback === "string" && fallback.trim() ? fallback : "操作失败");
}

// Name used by a few consumers that treat API errors as copy rather than messages.
export const localizeApiError = apiErrorMessage;

/** Localize the `{ error: code }` payload returned by an ops API route. */
export function opsApiError(payload, fallback = "操作失败") {
  const code = typeof payload === "string"
    ? payload
    : payload && typeof payload === "object" && typeof payload.error === "string"
      ? payload.error
      : "";
  return apiErrorMessage(code, fallback);
}

export function ledgerEntryTypeLabel(entryType) {
  return typeof entryType === "string" && Object.prototype.hasOwnProperty.call(LEDGER_ENTRY_LABELS_ZH, entryType)
    ? LEDGER_ENTRY_LABELS_ZH[entryType]
    : "未知类型";
}

export const localizeLedgerEntryType = ledgerEntryTypeLabel;
export const opsLedgerType = ledgerEntryTypeLabel;

export function monitorFailureReasonLabel(reason) {
  return typeof reason === "string" && Object.prototype.hasOwnProperty.call(MONITOR_FAILURE_LABELS_ZH, reason)
    ? MONITOR_FAILURE_LABELS_ZH[reason]
    : "未知原因";
}

export const localizeMonitorFailureReason = monitorFailureReasonLabel;
export const opsFailureReason = monitorFailureReasonLabel;

const OPS_DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Shanghai",
});

export function formatOpsDate(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return "时间不可用";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? OPS_DATE_FORMATTER.format(date) : "时间不可用";
}

export const formatOpsDateTime = formatOpsDate;
export const formatOpsTimestamp = formatOpsDate;

const OPS_NUMBER_FORMATTER = new Intl.NumberFormat("zh-CN");

export function formatOpsNumber(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return "—";
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? OPS_NUMBER_FORMATTER.format(number) : "—";
}

export function reviewVerdictLabel(verdict) {
  return typeof verdict === "string" && Object.prototype.hasOwnProperty.call(REVIEW_VERDICT_LABELS_ZH, verdict)
    ? REVIEW_VERDICT_LABELS_ZH[verdict]
    : "未知结论";
}

export const localizeReviewVerdict = reviewVerdictLabel;
export const opsVerdict = reviewVerdictLabel;

// Stable fixture copy is keyed by case id so a missing translation cannot
// silently fall back to English copy in the review console.
export const SEARCH_EVAL_COPY_ZH = Object.freeze({
  "l1-open-source-ml-inference": {
    brief: "寻找有公开证据维护开源 ML 推理基础设施的工程师。",
    requiredConditions: ["开源贡献", "ML 推理基础设施"],
    excludedConditions: ["仅销售型资料"],
  },
  "l1-github-rust-data-engineer": {
    brief: "寻找有公开 Rust 数据处理项目经历的数据工程师。",
    requiredConditions: ["Rust", "数据处理"],
    excludedConditions: ["仅前端工作"],
  },
  "l1-llm-evaluation-researcher": {
    brief: "寻找有公开语言模型评测工作的研究人员。",
    requiredConditions: ["语言模型评测", "已发表研究"],
    excludedConditions: ["无法验证的基准测试声明"],
  },
  "l1-kubernetes-platform-engineer": {
    brief: "寻找有公开 Kubernetes 平台维护证据的工程师。",
    requiredConditions: ["Kubernetes", "平台工程"],
    excludedConditions: ["只有证书、没有交付证据"],
  },
  "l1-computer-vision-paper-author": {
    brief: "寻找发表过公开同行评审论文的计算机视觉工程师。",
    requiredConditions: ["计算机视觉", "同行评审论文"],
    excludedConditions: ["只有营销案例研究"],
  },
  "l1-security-incident-responder": {
    brief: "寻找有公开事件响应或漏洞披露证据的安全工程师。",
    requiredConditions: ["安全工程", "公开披露或安全公告"],
    excludedConditions: ["安全销售"],
  },
  "l1-database-performance-engineer": {
    brief: "寻找有公开 PostgreSQL 数据库性能工作经历的工程师。",
    requiredConditions: ["PostgreSQL", "性能工程"],
    excludedConditions: ["泛化 SQL 培训"],
  },
  "l1-product-analytics-builder": {
    brief: "寻找有公开事件管道实现证据的产品分析工程师。",
    requiredConditions: ["产品分析", "事件管道"],
    excludedConditions: ["仅仪表盘分析"],
  },
  "l1-typescript-design-systems": {
    brief: "寻找做过开源 TypeScript 设计系统的前端工程师。",
    requiredConditions: ["TypeScript", "设计系统"],
    excludedConditions: ["只有视觉设计、没有代码"],
  },
  "l1-open-source-observability": {
    brief: "寻找有公开可观测性插桩工作的工程师。",
    requiredConditions: ["可观测性", "插桩"],
    excludedConditions: ["监控采购"],
  },
  "l2-agent-platform-founder-engineer": {
    brief: "寻找打造过 LLM agents、负责生产基础设施并有公开技术证据的创始阶段工程师。",
    requiredConditions: ["LLM agents", "生产基础设施", "创始阶段所有权"],
    excludedConditions: ["猎头机构招聘", "仅提示词资料"],
  },
  "l2-ai-recruiting-workflow-builder": {
    brief: "寻找有 AI 辅助招聘工作流和隐私意识数据处理公开经历、具备产品思维的工程师。",
    requiredConditions: ["AI 工作流", "招聘工作流", "隐私意识数据处理"],
    excludedConditions: ["批量外联自动化"],
  },
  "l2-edge-ai-systems-engineer": {
    brief: "寻找同时具备嵌入式系统、端侧 ML 和性能分析经验的工程师。",
    requiredConditions: ["嵌入式系统", "端侧 ML", "性能分析"],
    excludedConditions: ["仅云端 ML"],
  },
  "l2-multilingual-nlp-engineer": {
    brief: "寻找有多语言模型工作、评测证据和生产 Python 经验的 NLP 工程师。",
    requiredConditions: ["多语言 NLP", "评测", "生产 Python"],
    excludedConditions: ["仅英文内容写作"],
  },
  "l2-privacy-data-platform-engineer": {
    brief: "寻找做过开源隐私工具、SQL 系统并有安全证据的数据平台工程师。",
    requiredConditions: ["数据平台", "隐私工具", "安全证据"],
    excludedConditions: ["仅政策型隐私岗位"],
  },
  "l2-developer-tools-product-engineer": {
    brief: "寻找构建过开发者工具、公开 API 文档和工作流集成的全栈工程师。",
    requiredConditions: ["开发者工具", "公开 API", "工作流集成"],
    excludedConditions: ["仅无代码自动化"],
  },
  "l2-mlops-reliability-engineer": {
    brief: "寻找有模型服务、可观测性和轮值可靠性证据的 MLOps 工程师。",
    requiredConditions: ["模型服务", "可观测性", "可靠性"],
    excludedConditions: ["仅 notebook ML"],
  },
  "l2-web-performance-engineer": {
    brief: "寻找有 React、Web 性能和无障碍组件证据的前端系统工程师。",
    requiredConditions: ["React", "Web 性能", "无障碍"],
    excludedConditions: ["只有静态设计作品集"],
  },
  "l2-fintech-backend-engineer": {
    brief: "寻找有支付集成、账本正确性以及 Go 或 Java 证据的后端工程师。",
    requiredConditions: ["支付集成", "账本正确性", "Go 或 Java"],
    excludedConditions: ["消费金融营销"],
  },
  "l2-research-engineer-rag": {
    brief: "寻找有检索增强生成、评测和文档证据的研究工程师。",
    requiredConditions: ["检索增强生成", "评测", "文档"],
    excludedConditions: ["泛化聊天机器人实现"],
  },
  "l3-underground-agent-evals-builder": {
    brief: "寻找不依赖显眼 AI 实验室品牌、低调维护 agent 评测工具并分享可复现证据的实干工程师。",
    requiredConditions: ["agent 评测", "可复现工具", "实操维护"],
    excludedConditions: ["只有大实验室品牌", "未经验证的社交媒体声明"],
  },
  "l3-quiet-distributed-systems-operator": {
    brief: "寻找低调但有公开事故、共识和生产运维证据的分布式系统工程师。",
    requiredConditions: ["分布式系统", "共识或复制", "生产运维"],
    excludedConditions: ["仅教程型资料"],
  },
  "l3-open-source-ai-safety-builder": {
    brief: "寻找低调参与开源 AI 安全工具、经验测试并清楚记录限制的实践者。",
    requiredConditions: ["AI 安全工具", "实证测试", "限制说明文档"],
    excludedConditions: ["仅政策评论"],
  },
  "l3-developer-education-to-platform-builder": {
    brief: "寻找既做开发者教育、又有公开证据交付生产开发者平台的人，而不只是内容创作者。",
    requiredConditions: ["开发者教育", "生产平台", "代码所有权"],
    excludedConditions: ["没有工程证据的内容创作者"],
  },
  "l3-climate-data-engineer": {
    brief: "寻找有公开气候数据基础设施、科学数据标准和实用软件证据的数据工程师。",
    requiredConditions: ["气候数据", "科学数据标准", "软件工程"],
    excludedConditions: ["仅气候倡议"],
  },
  "l3-healthcare-interoperability-builder": {
    brief: "寻找有开源医疗互操作性、数据可靠性和隐私意识实现证据的后端工程师。",
    requiredConditions: ["医疗互操作性", "数据可靠性", "隐私意识实现"],
    excludedConditions: ["没有软件工作的临床岗位"],
  },
  "l3-accessibility-infrastructure-engineer": {
    brief: "寻找维护工程基础设施并有公开自动化测试证据的无障碍专家。",
    requiredConditions: ["无障碍", "工程基础设施", "自动化测试"],
    excludedConditions: ["仅人工审计"],
  },
  "l3-robotics-simulation-engineer": {
    brief: "寻找有公开仿真、硬件在环和可复现控制栈证据的机器人学工程师。",
    requiredConditions: ["机器人仿真", "硬件在环", "控制栈"],
    excludedConditions: ["只有 CAD 作品集"],
  },
  "l3-compiler-toolchain-engineer": {
    brief: "寻找有公开工具链工作和性能证据、且贡献不止一个教程项目的编译器工程师。",
    requiredConditions: ["编译器工具链", "性能", "持续贡献"],
    excludedConditions: ["一次性玩具编译器"],
  },
  "l3-public-interest-security-engineer": {
    brief: "寻找服务于公共利益基础设施、并有可复现威胁模型或验证证据的安全工程师。",
    requiredConditions: ["安全工程", "公共利益基础设施", "验证证据"],
    excludedConditions: ["通用网络安全认证"],
  },
});

function missingCaseCopy(caseId) {
  throw new Error(`Missing zh-CN Search Eval copy for case: ${caseId || "unknown"}`);
}

/**
 * Localize one stable Search Eval case. The input may be an id or the source
 * case object; the returned object keeps non-copy fields and replaces only the
 * three human-facing copy fields.
 */
export function localizeSearchEvalCase(caseOrId) {
  const source = typeof caseOrId === "string" ? { id: caseOrId } : caseOrId;
  const id = source && typeof source === "object" && typeof source.id === "string" ? source.id : "";
  const copy = SEARCH_EVAL_COPY_ZH[id];
  if (!copy) missingCaseCopy(id);
  const localized = {
    ...(typeof caseOrId === "object" && caseOrId !== null ? caseOrId : { id }),
    brief: copy.brief,
    requiredConditions: [...copy.requiredConditions],
    excludedConditions: [...copy.excludedConditions],
  };
  // Also replace source-fixture snake_case fields when the helper is called
  // directly with a raw fixture item.
  if (Object.prototype.hasOwnProperty.call(localized, "required_conditions")) {
    localized.required_conditions = [...copy.requiredConditions];
  }
  if (Object.prototype.hasOwnProperty.call(localized, "excluded_conditions")) {
    localized.excluded_conditions = [...copy.excludedConditions];
  }
  return localized;
}

export const localizeSearchEval = localizeSearchEvalCase;

/** Localize every case and fail closed if a fixture includes an unknown id. */
export function localizeSearchEvalCases(cases) {
  if (!Array.isArray(cases)) throw new Error("Search Eval cases are unavailable");
  return cases.map(localizeSearchEvalCase);
}
