import test from "node:test";
import assert from "node:assert/strict";

import { buildResearchProgressView } from "./web/lib/research-progress.mjs";

test("formats active search and fetch events as a readable research timeline", () => {
  const view = buildResearchProgressView({
    feed: [
      { id: 1, kind: "search", info: "LLM inference vLLM site:github.com" },
      { id: 2, kind: "fetch", info: "https://github.com/example/vllm-project" },
    ],
    live: { searches: 1, fetches: 1 },
  });

  assert.equal(view.statsText, "搜索 1 次 · 抓取 1 页");
  assert.equal(view.active?.label, "正在读取来源");
  assert.equal(view.active?.detail, "https://github.com/example/vllm-project");
  assert.equal(view.timeline.length, 2);
  assert.equal(view.timeline[0].label, "读取来源");
  assert.equal(view.timeline[0].detail, "https://github.com/example/vllm-project");
  assert.equal(view.timeline[1].label, "搜索关键词");
  assert.equal(view.timeline[1].detail, "LLM inference vLLM site:github.com");
});

test("shows a planning state before search events arrive", () => {
  const view = buildResearchProgressView({ feed: [], live: null });

  assert.equal(view.statsText, "等待第一批搜索事件");
  assert.equal(view.active?.label, "正在生成搜索计划");
  assert.equal(view.active?.detail, "系统正在拆解需求、准备检索关键词和信息源。");
  assert.equal(view.timeline.length, 0);
});
