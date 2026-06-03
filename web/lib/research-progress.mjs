function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function eventLabels(kind) {
  if (kind === "fetch") return { label: "读取来源", activeLabel: "正在读取来源" };
  if (kind === "search") return { label: "搜索关键词", activeLabel: "正在搜索关键词" };
  return { label: "研究步骤", activeLabel: "正在推进研究" };
}

function eventDetail(item) {
  const detail = cleanString(item?.info);
  if (detail) return detail;
  return item?.kind === "fetch" ? "等待来源内容返回" : "等待搜索关键词返回";
}

function formatEvent(item, active = false) {
  const labels = eventLabels(item?.kind);
  return {
    id: item?.id ?? 0,
    kind: item?.kind || "search",
    label: active ? labels.activeLabel : labels.label,
    detail: eventDetail(item),
  };
}

/**
 * @param {{ feed?: Array<{ id?: number; kind?: string; info?: string }>; live?: { searches?: number; fetches?: number } | null }} input
 */
export function buildResearchProgressView({ feed = [], live = null } = {}) {
  const cleanFeed = Array.isArray(feed) ? feed.filter(Boolean) : [];
  const searches = Number(live?.searches ?? 0);
  const fetches = Number(live?.fetches ?? 0);
  const latest = cleanFeed[cleanFeed.length - 1];
  return {
    statsText: searches || fetches ? `搜索 ${searches} 次 · 抓取 ${fetches} 页` : "等待第一批搜索事件",
    active: latest
      ? formatEvent(latest, true)
      : {
          id: -1,
          kind: "think",
          label: "正在生成搜索计划",
          detail: "系统正在拆解需求、准备检索关键词和信息源。",
        },
    timeline: cleanFeed.slice(-12).reverse().map((item) => formatEvent(item)),
  };
}
