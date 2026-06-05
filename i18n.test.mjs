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
