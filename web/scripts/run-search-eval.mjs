import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { scoreCase } from "../lib/search-eval.mjs";

const QUALITY_GATES = {
  precision_at_10: 0.05,
  hard_constraint_recall: 0.05,
  valid_evidence_rate: 0.05,
};
const LATENCY_GATE = 0.25;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function average(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

export function percentile(values, percentage) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(sorted.length * percentage) - 1)];
}

function runIdentifier(run = {}) {
  return cleanString(run.id) || cleanString(run.run_id) || "";
}

function runCaseId(run = {}) {
  const evaluation = objectValue(run.evaluation);
  return cleanString(run.case_id) || cleanString(evaluation.case_id);
}

function isCompletedRun(run = {}) {
  return ["completed", "done"].includes(cleanString(run.status).toLowerCase());
}

function metadataFor(run = {}) {
  const evaluation = objectValue(run.evaluation);
  const evaluator = cleanString(run.evaluator) || cleanString(run.evaluator_version) || cleanString(evaluation.evaluator) || cleanString(evaluation.evaluator_version);
  const strategy = cleanString(run.strategy) || cleanString(run.strategy_version) || cleanString(evaluation.strategy) || cleanString(evaluation.strategy_version);
  const route = cleanString(run.route) || cleanString(evaluation.route);
  const routeReason = cleanString(run.route_reason) || cleanString(run.routeReason) || cleanString(evaluation.route_reason) || cleanString(evaluation.routeReason);
  return {
    evaluator,
    evaluator_version: evaluator,
    strategy,
    strategy_version: strategy,
    route,
    route_reason: routeReason,
  };
}

function metricValue(sources, key, aliases = []) {
  for (const source of sources) {
    const row = objectValue(source);
    for (const name of [key, ...aliases]) {
      const value = finiteNumber(row[name]);
      if (value !== null) return value;
    }
  }
  return undefined;
}

function resultForScoring(run = {}) {
  const result = objectValue(run.result);
  const telemetry = objectValue(result.agent_execution).telemetry;
  const sources = [run.run_metrics, result.run_metrics, telemetry, run.stats, result.stats, run, result];
  const candidates = Array.isArray(result.candidates)
    ? result.candidates
    : Array.isArray(result.talent_profiles)
      ? result.talent_profiles
      : Array.isArray(run.candidates)
        ? run.candidates
        : undefined;

  return {
    ...result,
    candidates,
    run_metrics: {
      duration_ms: metricValue(sources, "duration_ms", ["durationMs"]),
      search_count: metricValue(sources, "search_count", ["searches"]),
      fetch_count: metricValue(sources, "fetch_count", ["fetches"]),
    },
  };
}

function reportCase({ caseDefinition, run }, fixture) {
  const id = cleanString(caseDefinition?.id) || runCaseId(run) || "unknown-case";
  if (!run) return { case_id: id, status: "inconclusive", reason: "missing_completed_run" };

  const metadata = metadataFor(run);
  if (!metadata.evaluator || !metadata.strategy || !metadata.route || !metadata.route_reason) {
    return {
      case_id: id,
      run_id: runIdentifier(run) || null,
      ...metadata,
      status: "inconclusive",
      reason: "missing_run_metadata",
    };
  }

  const score = scoreCase(caseDefinition, resultForScoring(run), { fixture });
  const row = {
    case_id: id,
    run_id: runIdentifier(run) || null,
    ...metadata,
    status: score.status,
    ...(score.status === "scored" ? score : { reason: score.reason || "inconclusive" }),
  };
  if (score.status === "scored") {
    row.duration_ms = resultForScoring(run).run_metrics.duration_ms;
    row.search_count = resultForScoring(run).run_metrics.search_count;
    row.fetch_count = resultForScoring(run).run_metrics.fetch_count;
  }
  return row;
}

function summaryFor(rows) {
  const scored = rows.filter((row) => row.status === "scored");
  const summary = {
    status: scored.length === rows.length && rows.length > 0 ? "scored" : "inconclusive",
    total_cases: rows.length,
    scored_cases: scored.length,
    inconclusive_cases: rows.length - scored.length,
    precision_at_5: average(scored.map((row) => row.precision_at_5)),
    precision_at_10: average(scored.map((row) => row.precision_at_10)),
    known_relevant_recall_at_10: average(scored.map((row) => row.known_relevant_recall_at_10)),
    hard_constraint_recall: average(scored.map((row) => row.hard_constraint_recall)),
    valid_evidence_rate: average(scored.map((row) => row.valid_evidence_rate)),
    identity_errors: scored.reduce((total, row) => total + row.identity_errors, 0),
    p50_duration_ms: percentile(scored.map((row) => row.duration_ms), 0.5),
    p95_duration_ms: percentile(scored.map((row) => row.duration_ms), 0.95),
    search_count: scored.reduce((total, row) => total + row.search_count, 0),
    fetch_count: scored.reduce((total, row) => total + row.fetch_count, 0),
  };
  return summary;
}

/**
 * Builds a deterministic evaluation artifact from exported, already-completed runs.
 * The runner deliberately has no database or queue dependency.
 */
export function buildEvalReport(entries = [], { fixture = {}, generatedAt = new Date().toISOString() } = {}) {
  const rows = (Array.isArray(entries) ? entries : [])
    .map((entry) => reportCase(objectValue(entry), fixture))
    .sort((left, right) => [left.case_id, left.strategy, left.run_id || ""].join("\u0000").localeCompare([right.case_id, right.strategy, right.run_id || ""].join("\u0000")));

  return {
    schema_version: "search-eval-report-v1",
    generated_at: generatedAt,
    summary: summaryFor(rows),
    cases: rows,
  };
}

function comparisonValue(report, metric) {
  return finiteNumber(objectValue(report?.summary)[metric]);
}

export function compareToBaseline(current, baseline) {
  const currentSummary = objectValue(current?.summary);
  const baselineSummary = objectValue(baseline?.summary);
  if (currentSummary.status !== "scored" || baselineSummary.status !== "scored") {
    return { status: "inconclusive", failed: false, failures: [], reason: "current_or_baseline_inconclusive" };
  }

  const required = [...Object.keys(QUALITY_GATES), "p95_duration_ms"];
  if (required.some((metric) => comparisonValue(current, metric) === null || comparisonValue(baseline, metric) === null)) {
    return { status: "inconclusive", failed: false, failures: [], reason: "missing_baseline_metrics" };
  }

  if (Object.keys(QUALITY_GATES).some((metric) => {
    const currentValue = comparisonValue(current, metric);
    const baselineValue = comparisonValue(baseline, metric);
    return currentValue < 0 || currentValue > 1 || baselineValue < 0 || baselineValue > 1;
  }) || comparisonValue(current, "p95_duration_ms") < 0 || comparisonValue(baseline, "p95_duration_ms") <= 0) {
    return { status: "inconclusive", failed: false, failures: [], reason: "invalid_comparison_metrics" };
  }

  const failures = [];
  for (const [metric, decline] of Object.entries(QUALITY_GATES)) {
    const delta = comparisonValue(current, metric) - comparisonValue(baseline, metric);
    if (delta < -decline) failures.push({ metric, baseline: comparisonValue(baseline, metric), current: comparisonValue(current, metric), delta, threshold: -decline });
  }
  const baselineP95 = comparisonValue(baseline, "p95_duration_ms");
  const currentP95 = comparisonValue(current, "p95_duration_ms");
  const p95Increase = (currentP95 - baselineP95) / baselineP95;
  if (p95Increase > LATENCY_GATE) failures.push({ metric: "p95_duration_ms", baseline: baselineP95, current: currentP95, increase: p95Increase, threshold: LATENCY_GATE });

  return { status: failures.length ? "failed" : "passed", failed: failures.length > 0, failures };
}

function runsFromExport(value) {
  if (Array.isArray(value)) return value;
  const object = objectValue(value);
  return Array.isArray(object.runs) ? object.runs : Array.isArray(object.data) ? object.data : [];
}

function newestRun(runs = []) {
  return [...runs].sort((left, right) => {
    const leftTime = Date.parse(left.finished_at || left.updated_at || left.created_at || 0) || 0;
    const rightTime = Date.parse(right.finished_at || right.updated_at || right.created_at || 0) || 0;
    return rightTime - leftTime || runIdentifier(right).localeCompare(runIdentifier(left));
  })[0] || null;
}

function markdownReport(report, comparison) {
  const summary = report.summary;
  const percent = (value) => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—";
  const rows = report.cases.map((row) => `| ${row.case_id} | ${row.status} | ${row.evaluator || "—"} | ${row.strategy || "—"} | ${row.route || "—"} | ${row.route_reason || row.reason || "—"} | ${percent(row.precision_at_10)} | ${percent(row.hard_constraint_recall)} | ${percent(row.valid_evidence_rate)} | ${row.duration_ms ?? "—"} |`).join("\n");
  const gate = comparison
    ? `Baseline gate: **${comparison.status}**${comparison.failures?.length ? ` (${comparison.failures.map((item) => item.metric).join(", ")})` : ""}.`
    : "Baseline gate: not evaluated (no baseline supplied).";
  return `# Search Eval v1\n\nGenerated: ${report.generated_at}\n\nStatus: **${summary.status}**. ${gate}\n\n| Scored | Inconclusive | P50 | P95 | P@10 | Known-relevant recall@10 | Hard-condition recall | Valid evidence |\n| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n| ${summary.scored_cases}/${summary.total_cases} | ${summary.inconclusive_cases} | ${summary.p50_duration_ms ?? "—"} ms | ${summary.p95_duration_ms ?? "—"} ms | ${percent(summary.precision_at_10)} | ${percent(summary.known_relevant_recall_at_10)} | ${percent(summary.hard_constraint_recall)} | ${percent(summary.valid_evidence_rate)} |\n\n| Case | Status | Evaluator | Strategy | Route | Reason | P@10 | Hard recall | Evidence | Duration |\n| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: |\n${rows || "| — | inconclusive | — | — | — | no_cases | — | — | — | — |"}\n`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function runSearchEval({ casesPath, runsPath, baselinePath = "", outDir, generatedAt } = {}) {
  const fixture = objectValue(await readJson(casesPath));
  const caseDefinitions = Array.isArray(fixture.cases) ? fixture.cases : [];
  const exportedRuns = runsFromExport(await readJson(runsPath));
  const completedByCase = new Map();
  for (const run of exportedRuns.filter((row) => isCompletedRun(objectValue(row)))) {
    const caseId = runCaseId(run);
    if (!caseId) continue;
    const runs = completedByCase.get(caseId) || [];
    runs.push(run);
    completedByCase.set(caseId, runs);
  }
  const report = buildEvalReport(caseDefinitions.map((caseDefinition) => ({ caseDefinition, run: newestRun(completedByCase.get(cleanString(caseDefinition?.id))) })), { fixture, generatedAt });
  const baseline = baselinePath ? await readJson(baselinePath) : null;
  const comparison = baseline ? compareToBaseline(report, baseline) : null;
  const rendered = { ...report, ...(comparison ? { comparison } : {}) };

  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(resolve(outDir, "search-eval.json"), `${JSON.stringify(rendered, null, 2)}\n`),
    writeFile(resolve(outDir, "search-eval.md"), markdownReport(report, comparison)),
  ]);

  const exitCode = report.summary.status === "inconclusive" || comparison?.status === "inconclusive"
    ? 2
    : comparison?.failed
      ? 1
      : 0;
  return { report: rendered, exitCode };
}

function usage() {
  return "Usage: node web/scripts/run-search-eval.mjs --cases CASES.json --runs RUNS.json --out OUTPUT_DIR [--baseline BASELINE.json]";
}

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (name === "--help" || name === "-h") return { help: true };
    if (!["--cases", "--runs", "--baseline", "--out"].includes(name) || index + 1 >= args.length) return { error: `Invalid argument: ${name}` };
    values[name.slice(2)] = args[index + 1];
    index += 1;
  }
  if (!values.cases || !values.runs || !values.out) return { error: "--cases, --runs, and --out are required" };
  return { casesPath: values.cases, runsPath: values.runs, baselinePath: values.baseline, outDir: values.out };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (options.error) {
    console.error(options.error);
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  try {
    const { report, exitCode } = await runSearchEval(options);
    console.log(`Search Eval ${report.summary.status}; report written to ${resolve(options.outDir)}.`);
    process.exitCode = exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) await main();
