import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { t } from "./web/lib/i18n.mjs";

test("landing homepage uses outcome-led source network messaging", () => {
  const source = readFileSync("web/app/Landing.tsx", "utf8");

  assert.equal(t("zh", "landing.title"), "找得准，看得清。");
  assert.equal(t("zh", "landing.demo"), "看它怎么找人");
  assert.notEqual(t("zh", "landing.demo"), "查看样例报告");

  for (const key of [
    "landing.sources.title",
    "landing.judgment.title",
    "landing.outreach.title",
    "landing.samples.title",
  ]) {
    assert.notEqual(t("zh", key), key);
    assert.notEqual(t("en", key), key);
  }

  assert.match(source, /SourceNetwork/);
  assert.match(source, /CandidateJudgment/);
  assert.match(source, /OutreachPreview/);
  assert.match(source, /href="#reports"/);
  assert.match(source, /LandingHeading/);
  assert.match(source, /看一次完整搜人，/);
  assert.match(source, /所见即所得。/);
});

test("landing homepage includes DINQ-inspired lightweight motion hooks", () => {
  const landing = readFileSync("web/app/Landing.tsx", "utf8");
  const styles = readFileSync("web/app/globals.css", "utf8");

  for (const marker of [
    "data-sh-reveal",
    "IntersectionObserver",
    "sh-source-node",
    "sh-flow-line",
    "sh-report-panel",
    "sh-sample-card",
  ]) {
    assert.match(landing, new RegExp(marker));
  }

  for (const marker of [
    "@keyframes sh-line-flow",
    "@keyframes sh-hub-pulse",
    "@keyframes sh-meter-fill",
    ".sh-reveal",
    ".sh-search-hub::before",
    "prefers-reduced-motion",
  ]) {
    assert.match(styles, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
