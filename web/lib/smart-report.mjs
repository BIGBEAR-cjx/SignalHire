import { buildReferralPathViews } from "./referral-paths.mjs";
import { sourceTypeLabel, sourceTypeTooltip } from "./source-classifier.mjs";

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanArray(value, limit = 6) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, limit) : [];
}

function clientSafeArray(value, limit = 6) {
  const blocked = /debug|internal|role_agent|execution_log|next_action_execution|stack trace/i;
  return cleanArray(value, limit * 2)
    .filter((item) => !blocked.test(item))
    .slice(0, limit);
}

function clientSafeText(value) {
  return clientSafeArray([value], 1)[0] || "";
}

function candidateCountFromResult(result) {
  return isRecord(result) && Array.isArray(result.candidates) ? result.candidates.filter(isRecord).length : 0;
}

function validIso(value) {
  const clean = cleanString(value);
  if (!clean) return "";
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function stableHash(value) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function candidateRole(candidate) {
  return cleanString(candidate.headline || candidate.current_role || candidate.current_title || candidate.role);
}

function evidenceQuality(candidate) {
  const audit = isRecord(candidate.evidence_audit) ? candidate.evidence_audit : {};
  return cleanString(audit.overall_evidence_quality || candidate.evidence_quality || "low").toLowerCase();
}

function primaryRisk(candidate) {
  const audit = isRecord(candidate.evidence_audit) ? candidate.evidence_audit : {};
  return cleanArray(audit.risk_flags, 1)[0]
    || cleanArray(audit.identity_risks, 1)[0]
    || cleanArray(audit.unverified_claims, 1)[0]
    || cleanArray(candidate.uncertainties, 1)[0]
    || "";
}

function candidateEvidenceSummary(candidate) {
  return cleanArray(candidate.strongest_signals, 1)[0]
    || cleanString(candidate.summary)
    || candidateRole(candidate)
    || "Review candidate evidence before sharing.";
}

function candidateNextAction(candidate, locale) {
  const quality = evidenceQuality(candidate);
  const risk = primaryRisk(candidate);
  const score = Number(candidate.match_score) || 0;
  if (quality === "low" || risk) {
    return locale === "en"
      ? "Verify evidence before outreach or recommendation."
      : "先补公开证据，再决定是否外联或推荐。";
  }
  if (score >= 75) {
    return locale === "en"
      ? "Review evidence and consider controlled outreach."
      : "复核证据后，可进入受控外联。";
  }
  return locale === "en"
    ? "Keep as a next-round search seed."
    : "保留为下一轮搜索种子。";
}

function sourceMixFrom(result, locale) {
  const graph = isRecord(result.evidence_graph) ? result.evidence_graph : {};
  const telemetry = isRecord(result.agent_execution?.telemetry) ? result.agent_execution.telemetry : {};
  const rows = Array.isArray(graph.source_mix) && graph.source_mix.length ? graph.source_mix : telemetry.source_mix;
  return (Array.isArray(rows) ? rows : []).map((item) => {
    const sourceType = cleanString(item?.source_type || "public_web");
    return {
      source_type: sourceType,
      label: sourceTypeLabel(sourceType, locale),
      count: Number(item?.count) || 0,
      tooltip: sourceTypeTooltip(sourceType, locale),
    };
  }).filter((item) => item.count > 0);
}

function referralSummaryFrom(result, candidates, locale) {
  const networkSeeds = Array.isArray(result.network_seeds) ? result.network_seeds : result.networkSeeds;
  const views = buildReferralPathViews({ candidates, networkSeeds, locale });
  return views.flatMap((view) => view.paths.filter((path) => path.client_safe).slice(0, 2).map((path) => ({
    candidate_name: view.candidate_name,
    path_type: path.path_type,
    shared_context: path.shared_context,
    introducer_label: path.introducer_label,
    confidence: path.confidence,
    intro_snippet: path.intro_snippet,
  }))).slice(0, 6);
}

function clientDeliveryLoopFrom(result, candidates, metrics, risks, nextActions, locale) {
  const explicit = isRecord(result.client_delivery_loop) ? result.client_delivery_loop : {};
  const explicitWeekly = isRecord(explicit.weekly_progress) ? explicit.weekly_progress : {};
  const explicitMetrics = isRecord(explicitWeekly.metrics) ? explicitWeekly.metrics : {};
  const statusOf = (candidate) => cleanString(candidate.outreach_status || candidate.status).toLowerCase();
  const contacted = candidates.filter((candidate) => ["contacted", "sent", "replied", "interested", "interview_ready", "needs_scheduling"].includes(statusOf(candidate))).length;
  const replied = candidates.filter((candidate) => ["replied", "interested", "interview_ready", "needs_scheduling"].includes(statusOf(candidate))).length;
  const interviewReady = Number(explicitMetrics.interview_ready) || metrics.needs_scheduling;
  const confirmed = Number(explicitMetrics.confirmed) || candidates.filter((candidate) => ["confirmed", "scheduled"].includes(statusOf(candidate))).length;
  const loopRisks = clientSafeArray(explicit.risks, 4);
  const loopNextActions = clientSafeArray(explicit.next_actions, 4);
  const strongLabel = locale === "en"
    ? `${metrics.strong_evidence} strong evidence`
    : `${metrics.strong_evidence} 位强证据`;
  const weakEvidence = Math.max(0, metrics.candidates - metrics.strong_evidence);
  const weakLabel = locale === "en"
    ? `${weakEvidence} need evidence review`
    : `${weakEvidence} 位需复核证据`;
  return {
    title: locale === "en" ? "Client Delivery Loop" : "客户持续交付",
    summary: locale === "en"
      ? "A shareable view of delivery progress, evidence strength, risks, and next actions."
      : "面向客户/招聘经理的交付进度、证据强弱、风险和下一步。",
    weekly_progress: {
      window_label: cleanString(explicitWeekly.window_label) || (locale === "en" ? "This delivery" : "本次交付"),
      metrics: {
        new_candidates: Number(explicitMetrics.new_candidates) || metrics.candidates,
        contacted: Number(explicitMetrics.contacted) || contacted,
        replied: Number(explicitMetrics.replied) || replied,
        interview_ready: interviewReady,
        confirmed,
      },
    },
    evidence_summary: `${strongLabel}; ${weakLabel}.`,
    risks: loopRisks.length ? loopRisks : clientSafeArray(risks, 4),
    next_actions: loopNextActions.length ? loopNextActions : clientSafeArray(nextActions, 4),
  };
}

export function attachClientDeliveryLoopSnapshot(result = {}, snapshot = {}) {
  if (!isRecord(result) || !isRecord(snapshot)) return result;
  const weeklyProgress = isRecord(snapshot.weekly_progress) ? snapshot.weekly_progress : {};
  const risks = clientSafeArray(snapshot.risks, 4);
  const nextActions = clientSafeArray(snapshot.next_actions, 4);
  if (!isRecord(weeklyProgress) && risks.length === 0 && nextActions.length === 0) return result;
  return {
    ...result,
    client_delivery_loop: {
      ...(isRecord(result.client_delivery_loop) ? result.client_delivery_loop : {}),
      ...(isRecord(weeklyProgress) ? { weekly_progress: weeklyProgress } : {}),
      ...(risks.length ? { risks } : {}),
      ...(nextActions.length ? { next_actions: nextActions } : {}),
    },
  };
}

export function buildClientDeliveryVersionHistory(runs = [], { currentRunId = "", locale = "zh", limit = 6 } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const currentId = cleanString(currentRunId);
  const maxItems = Math.max(1, Math.min(Number(limit) || 6, 10));
  const items = (Array.isArray(runs) ? runs : [])
    .filter((run) => isRecord(run) && cleanString(run.kind) === "search" && cleanString(run.id))
    .slice()
    .sort((a, b) => new Date(cleanString(b.updated_at)).getTime() - new Date(cleanString(a.updated_at)).getTime())
    .slice(0, maxItems)
    .map((run) => ({
      id: cleanString(run.id),
      label: clientSafeText(run.label) || (normalizedLocale === "en" ? "Delivery update" : "交付版本"),
      summary: clientSafeText(run.summary),
      status: clientSafeText(run.status),
      delivered_at: cleanString(run.updated_at),
      candidate_count: candidateCountFromResult(run.result),
      href: cleanString(run.clientDeliveryReportHref),
      is_current: cleanString(run.id) === currentId,
    }))
    .filter((item) => item.href || item.is_current);
  return {
    title: normalizedLocale === "en" ? "Delivery versions" : "交付版本历史",
    summary: normalizedLocale === "en"
      ? "Recent client-facing delivery updates for this role."
      : "这个岗位最近面向客户的交付更新。",
    items,
  };
}

function weekDateKey(value) {
  const iso = validIso(value);
  if (!iso) return "";
  const date = new Date(iso);
  const day = date.getUTCDay();
  const offset = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function addDaysKey(value, days) {
  const iso = validIso(value);
  if (!iso) return "";
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function archivedReportRow(run, snapshot) {
  return {
    id: cleanString(run.id),
    label: clientSafeText(run.label) || "Delivery update",
    summary: clientSafeText(run.summary),
    delivered_at: validIso(run.updated_at || run.finished_at || run.created_at),
    href: cleanString(run.clientDeliveryReportHref),
    snapshot_id: snapshot.snapshot_id,
    candidate_count: snapshot.candidate_count,
  };
}

export function buildClientDeliveryWeeklyArchive(runs = [], { locale = "zh", limit = 8 } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const maxWeeks = Math.max(1, Math.min(Number(limit) || 8, 12));
  const grouped = new Map();
  for (const run of Array.isArray(runs) ? runs : []) {
    if (!isRecord(run) || cleanString(run.kind) !== "search" || !cleanString(run.id)) continue;
    const deliveredAt = validIso(run.updated_at || run.finished_at || run.created_at);
    const weekStart = weekDateKey(deliveredAt);
    if (!weekStart) continue;
    const snapshot = buildClientDeliverySnapshot(run, isRecord(run.result) ? run.result : {}, { locale: normalizedLocale });
    if (!snapshot.snapshot_id) continue;
    const entry = grouped.get(weekStart) ?? [];
    entry.push({ run, snapshot, report: archivedReportRow(run, snapshot) });
    grouped.set(weekStart, entry);
  }
  const items = [...grouped.entries()]
    .sort(([a], [b]) => String(b).localeCompare(String(a)))
    .slice(0, maxWeeks)
    .map(([weekStart, rows]) => {
      const sortedRows = rows
        .slice()
        .sort((a, b) => String(b.report.delivered_at).localeCompare(String(a.report.delivered_at)));
      const latest = sortedRows[0];
      const archivePayload = JSON.stringify({
        week_start: weekStart,
        latest_snapshot_id: latest.snapshot.snapshot_id,
        reports: sortedRows.map((row) => row.report.id),
      });
      return {
        archive_id: `cda_${stableHash(archivePayload)}`,
        week_start: weekStart,
        week_end: addDaysKey(weekStart, 6),
        label: latest.snapshot.window_label || (normalizedLocale === "en" ? `Week of ${weekStart}` : `${weekStart} 周交付`),
        latest_report_id: latest.report.id,
        latest_snapshot_id: latest.snapshot.snapshot_id,
        metrics: latest.snapshot.metrics,
        risks: latest.snapshot.risks,
        next_actions: latest.snapshot.next_actions,
        reports: sortedRows.map((row) => row.report),
      };
    });
  return {
    title: normalizedLocale === "en" ? "Weekly delivery archive" : "周交付归档",
    summary: normalizedLocale === "en"
      ? "Persisted client-facing report versions grouped into weekly delivery records."
      : "基于已持久化客户报告版本生成的周交付记录。",
    items,
  };
}

export function buildClientDeliverySnapshot(run = {}, result = {}, { locale = "zh" } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const sourceRun = isRecord(run) ? run : {};
  const sourceResult = isRecord(result) ? result : {};
  const report = buildSmartReportView(sourceResult, { locale: normalizedLocale });
  const loop = report.client_delivery_loop;
  const frozenAt = validIso(sourceRun.updated_at || sourceRun.finished_at || sourceRun.created_at);
  const runId = cleanString(sourceRun.id || sourceRun.run_id);
  const candidateKeys = Array.isArray(sourceResult.candidates)
    ? sourceResult.candidates.filter(isRecord).map((candidate) => cleanString(candidate.id || candidate.candidate_id || candidate.name)).filter(Boolean).slice(0, 50)
    : [];
  const payload = JSON.stringify({
    run_id: runId,
    frozen_at: frozenAt,
    brief: report.brief_summary,
    metrics: loop.weekly_progress.metrics,
    candidate_keys: candidateKeys,
    risks: loop.risks,
    next_actions: loop.next_actions,
  });
  return {
    title: normalizedLocale === "en" ? "Frozen delivery snapshot" : "冻结交付快照",
    summary: normalizedLocale === "en"
      ? "This snapshot is anchored to the report version and delivery data shown on this page."
      : "该快照固定到此页面展示的报告版本和交付数据。",
    snapshot_id: `cds_${stableHash(payload)}`,
    frozen_at: frozenAt,
    window_label: loop.weekly_progress.window_label,
    metrics: loop.weekly_progress.metrics,
    candidate_count: report.metrics.candidates,
    evidence_summary: loop.evidence_summary,
    risks: loop.risks,
    next_actions: loop.next_actions,
  };
}

export function buildSmartReportView(result = {}, { locale = "zh" } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const candidates = Array.isArray(result.candidates) ? result.candidates.filter(isRecord) : [];
  const strongEvidence = candidates.filter((candidate) => evidenceQuality(candidate) === "high");
  const readyForOutreach = candidates.filter((candidate) => evidenceQuality(candidate) === "high" && !primaryRisk(candidate) && (Number(candidate.match_score) || 0) >= 75);
  const lowEvidence = candidates.filter((candidate) => evidenceQuality(candidate) === "low");
  const brief = cleanString(result.search_brief?.original_query)
    || cleanString(result.query)
    || cleanString(result.role)
    || (normalizedLocale === "en" ? "Candidate delivery report" : "候选人交付报告");

  const topCandidates = candidates
    .slice()
    .sort((a, b) => (Number(b.match_score) || 0) - (Number(a.match_score) || 0))
    .slice(0, 5)
    .map((candidate) => ({
      name: cleanString(candidate.name) || (normalizedLocale === "en" ? "Unknown candidate" : "未知候选人"),
      role: candidateRole(candidate),
      match_score: Number(candidate.match_score) || 0,
      evidence_quality: evidenceQuality(candidate),
      evidence_summary: candidateEvidenceSummary(candidate),
      primary_risk: primaryRisk(candidate),
      outreach_status: cleanString(candidate.outreach_status || candidate.status) || (normalizedLocale === "en" ? "Not started" : "尚未开始"),
      next_action: candidateNextAction(candidate, normalizedLocale),
    }));

  const risks = [];
  if (lowEvidence.length > 0) {
    risks.push(normalizedLocale === "en"
      ? `Needs evidence verification: ${lowEvidence.map((candidate) => cleanString(candidate.name)).filter(Boolean).slice(0, 4).join(", ")}`
      : `需要补证据：${lowEvidence.map((candidate) => cleanString(candidate.name)).filter(Boolean).slice(0, 4).join("、")}`);
  }
  for (const candidate of candidates) {
    const risk = primaryRisk(candidate);
    if (risk) risks.push(`${cleanString(candidate.name) || "Candidate"}: ${risk}`);
  }

  const nextActions = [];
  if (readyForOutreach.length > 0) {
    nextActions.push(normalizedLocale === "en"
      ? `Review ${readyForOutreach.length} evidence-backed candidate${readyForOutreach.length === 1 ? "" : "s"} for controlled outreach.`
      : `优先复核 ${readyForOutreach.length} 位证据较完整候选人，并进入受控外联。`);
  }
  if (lowEvidence.length > 0) {
    nextActions.push(normalizedLocale === "en"
      ? "Backfill weak public evidence before recommending profile leads."
      : "先为低证据 profile leads 补公开证据，再进入推荐。");
  }
  nextActions.push(normalizedLocale === "en"
    ? "Share this report with the hiring manager or client for review."
    : "把这份报告发给 hiring manager 或客户进行审阅。");

  return {
    title: normalizedLocale === "en" ? "Smart Report" : "智能交付报告",
    brief_summary: brief,
    metrics: {
      candidates: candidates.length,
      strong_evidence: strongEvidence.length,
      ready_for_outreach: readyForOutreach.length,
      needs_scheduling: candidates.filter((candidate) => cleanString(candidate.outreach_status || candidate.status) === "needs_scheduling").length,
    },
    source_mix: sourceMixFrom(result, normalizedLocale),
    top_candidates: topCandidates,
    referral_summary: referralSummaryFrom(result, candidates, normalizedLocale),
    risks: [...new Set(risks)].slice(0, 6),
    next_actions: [...new Set(nextActions)].slice(0, 5),
    client_delivery_loop: clientDeliveryLoopFrom(
      result,
      candidates,
      {
        candidates: candidates.length,
        strong_evidence: strongEvidence.length,
        ready_for_outreach: readyForOutreach.length,
        needs_scheduling: candidates.filter((candidate) => cleanString(candidate.outreach_status || candidate.status) === "needs_scheduling").length,
      },
      [...new Set(risks)].slice(0, 6),
      [...new Set(nextActions)].slice(0, 5),
      normalizedLocale,
    ),
  };
}
