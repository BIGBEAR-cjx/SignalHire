import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LEDGER_ENTRY_LABELS_ZH,
  MONITOR_FAILURE_LABELS_ZH,
  OPS_ERROR_MESSAGES_ZH,
  REVIEW_VERDICT_LABELS_ZH,
  SEARCH_EVAL_COPY_ZH,
  apiErrorMessage,
  formatOpsDate,
  formatOpsNumber,
  localizeSearchEvalCase,
  monitorFailureReasonLabel,
  opsApiError,
  opsFailureReason,
  opsLedgerType,
  opsVerdict,
  reviewVerdictLabel,
  ledgerEntryTypeLabel,
} from "./web/lib/ops-copy.mjs";

const fixture = JSON.parse(await readFile(new URL("./docs/evals/search-eval-v1-cases.json", import.meta.url), "utf8"));

test("maps known ops API errors and never echoes unknown codes", () => {
  assert.equal(apiErrorMessage("login_required", "备用中文提示"), "请先登录");
  assert.equal(opsApiError({ error: "credits_grant_failed" }, "备用中文提示"), "Credits 发放失败");
  assert.equal(opsApiError({ error: "future_internal_error" }, "请稍后重试"), "请稍后重试");
  assert.notEqual(opsApiError({ error: "future_internal_error" }, "请稍后重试"), "future_internal_error");
  assert.equal(apiErrorMessage("future_internal_error", ""), "操作失败");
  assert.equal(apiErrorMessage("toString", "安全兜底"), "安全兜底");
});

test("localizes ledger, monitor failure, and review verdict enums", () => {
  for (const [value, label] of Object.entries(LEDGER_ENTRY_LABELS_ZH)) assert.equal(ledgerEntryTypeLabel(value), label);
  for (const [value, label] of Object.entries(MONITOR_FAILURE_LABELS_ZH)) assert.equal(monitorFailureReasonLabel(value), label);
  for (const [value, label] of Object.entries(REVIEW_VERDICT_LABELS_ZH)) assert.equal(reviewVerdictLabel(value), label);
  assert.equal(opsLedgerType("unexpected"), "未知类型");
  assert.equal(opsFailureReason("unexpected"), "未知原因");
  assert.equal(opsVerdict("unexpected"), "未知结论");
  assert.equal(opsLedgerType("toString"), "未知类型");
});

test("formats operations timestamps in zh-CN 24-hour form and numbers", () => {
  const formatted = formatOpsDate("2026-08-05T08:07:08Z");
  assert.match(formatted, /2026/);
  assert.match(formatted, /16:07:08/);
  assert.doesNotMatch(formatted, /上午|下午/);
  assert.equal(formatOpsDate("not-a-date"), "时间不可用");
  assert.equal(formatOpsDate(null), "时间不可用");
  assert.equal(formatOpsNumber(1234567.89), "1,234,567.89");
  assert.equal(formatOpsNumber("42"), "42");
  assert.equal(formatOpsNumber(""), "—");
  assert.equal(formatOpsNumber(null), "—");
});

test("provides localized copy for every stable Search Eval case", () => {
  assert.equal(fixture.cases.length, 30);
  assert.equal(Object.keys(SEARCH_EVAL_COPY_ZH).length, 30);
  for (const source of fixture.cases) {
    const localized = localizeSearchEvalCase(source);
    assert.equal(localized.id, source.id);
    assert.match(localized.brief, /[\u4e00-\u9fff]/);
    assert.equal(localized.requiredConditions.length, source.required_conditions.length);
    assert.equal(localized.excludedConditions.length, source.excluded_conditions.length);
    assert.equal(localized.required_conditions.length, source.required_conditions.length);
    assert.ok(localized.requiredConditions.every((condition) => /[\u4e00-\u9fff]/.test(condition) || /[A-Za-z]/.test(condition)));
  }
});

test("Search Eval localization fails closed for an unmapped case", () => {
  assert.throws(() => localizeSearchEvalCase({ id: "new-stable-case" }), /Missing zh-CN Search Eval copy/);
});

test("all operations pages are fixed to Chinese copy", async () => {
  const [layout, login, credits, review] = await Promise.all([
    readFile(new URL("./web/app/ops/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("./web/app/ops/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./web/app/ops/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./web/app/ops/search-eval-review/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /SignalHire 管理后台/);
  assert.match(login, /login\(email\.trim\(\), password, "zh"\)/);
  assert.match(login, />管理后台</);
  assert.match(credits, />Credits 运营台</);
  assert.match(credits, /opsLedgerType\(entry\.entry_type\)/);
  assert.match(review, />Search Eval 独立复核</);
  assert.match(review, /localizeSearchEvalCase/);
  assert.doesNotMatch(`${login}\n${credits}\n${review}`, /Operations access required|Go to ops sign in|Credits operations|Search Eval independent review/);
});
