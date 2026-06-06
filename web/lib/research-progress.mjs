import { t as translate } from "./i18n.mjs";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLocale(locale) {
  return locale === "en" ? "en" : "zh";
}

function msg(locale, key, params = {}) {
  return translate(locale, key, params);
}

function eventLabels(kind, locale) {
  if (kind === "fetch") return { label: msg(locale, "research.progress.fetch.label"), activeLabel: msg(locale, "research.loop.phase.fetching.label") };
  if (kind === "search") return { label: msg(locale, "research.progress.search.label"), activeLabel: msg(locale, "research.loop.phase.searching.label") };
  return { label: msg(locale, "research.progress.step.label"), activeLabel: msg(locale, "research.loop.phase.running.label") };
}

function eventDetail(item, locale) {
  const detail = cleanString(item?.info);
  if (detail) return detail;
  return item?.kind === "fetch" ? msg(locale, "research.loop.phase.fetching.detail") : msg(locale, "research.loop.phase.searching.detail");
}

function formatEvent(item, active = false, locale = "zh") {
  const labels = eventLabels(item?.kind, locale);
  return {
    id: item?.id ?? 0,
    kind: item?.kind || "search",
    label: active ? labels.activeLabel : labels.label,
    detail: eventDetail(item, locale),
  };
}

/**
 * @param {{ feed?: Array<{ id?: number; kind?: string; info?: string }>; live?: { searches?: number; fetches?: number } | null; locale?: string }} input
 */
export function buildResearchProgressView({ feed = [], live = null, locale: inputLocale } = {}) {
  const locale = normalizeLocale(inputLocale);
  const cleanFeed = Array.isArray(feed) ? feed.filter(Boolean) : [];
  const searches = Number(live?.searches ?? 0);
  const fetches = Number(live?.fetches ?? 0);
  const latest = cleanFeed[cleanFeed.length - 1];
  return {
    statsText: searches || fetches ? msg(locale, "research.progress.stats", { searches, fetches }) : msg(locale, "research.progress.statsWaiting"),
    active: latest
      ? formatEvent(latest, true, locale)
      : {
          id: -1,
          kind: "think",
          label: msg(locale, "research.loop.phase.planning.label"),
          detail: msg(locale, "research.loop.phase.planning.detail"),
        },
    timeline: cleanFeed.slice(-12).reverse().map((item) => formatEvent(item, false, locale)),
  };
}
