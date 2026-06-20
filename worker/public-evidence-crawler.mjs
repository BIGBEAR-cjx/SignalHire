const PRIVATE_URL_RE = /\/(login|signin|sign-in|signup|register|account|auth|session|oauth|callback)(\/|$|\?)/i;
const BLOCKED_HOST_RE = /(^|\.)linkedin\.com$/i;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePath(value) {
  const clean = cleanString(value);
  return clean.startsWith("/") ? clean : `/${clean}`;
}

export function parseRobotsTxt(text = "") {
  const rules = [];
  let active = false;
  let crawlDelayMs = 0;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line || !line.includes(":")) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      active = value === "*";
      continue;
    }
    if (!active) continue;
    if (key === "allow" || key === "disallow") {
      if (value) rules.push({ type: key, path: normalizePath(value) });
    }
    if (key === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) crawlDelayMs = Math.round(seconds * 1000);
    }
  }
  return { rules, crawlDelayMs };
}

export function isUrlAllowedByRobots(url, robotsRules = { rules: [] }) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const path = parsed.pathname || "/";
  let best = null;
  for (const rule of robotsRules.rules ?? []) {
    if (!rule.path || !path.startsWith(rule.path)) continue;
    if (!best || rule.path.length > best.path.length) best = rule;
  }
  return best?.type !== "disallow";
}

function isPublicHttpUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (parsed.protocol === "http:" || parsed.protocol === "https:") && !PRIVATE_URL_RE.test(`${parsed.pathname}${parsed.search}`);
}

function isBlockedHost(url) {
  try {
    return BLOCKED_HOST_RE.test(new URL(url).hostname);
  } catch {
    return true;
  }
}

async function fetchText(fetchImpl, url, init) {
  const res = await fetchImpl(url, init);
  if (!res?.ok) return { ok: false, status: res?.status ?? 0, text: "" };
  return { ok: true, status: res.status ?? 200, text: await res.text(), contentType: res.headers?.get?.("content-type") ?? "" };
}

export async function fetchAllowedPublicEvidencePage(url, {
  fetchImpl = globalThis.fetch,
  userAgent = "SignalHirePublicEvidenceBot/0.1 (+https://signalhire.local)",
  maxChars = 120000,
} = {}) {
  if (isBlockedHost(url)) return { allowed: false, reason: "blocked_host", url };
  if (!isPublicHttpUrl(url)) return { allowed: false, reason: "private_or_login_url", url };
  const parsed = new URL(url);
  const robotsUrl = `${parsed.origin}/robots.txt`;
  const headers = { "user-agent": userAgent, accept: "text/html,text/plain;q=0.9,*/*;q=0.1" };
  const robots = await fetchText(fetchImpl, robotsUrl, { headers });
  const rules = parseRobotsTxt(robots.ok ? robots.text : "");
  if (!isUrlAllowedByRobots(url, rules)) return { allowed: false, reason: "robots_disallow", url, robots_url: robotsUrl };
  const page = await fetchText(fetchImpl, url, { headers });
  if (!page.ok) return { allowed: false, reason: "fetch_failed", status: page.status, url, robots_url: robotsUrl };
  return {
    allowed: true,
    url,
    robots_url: robotsUrl,
    crawl_delay_ms: rules.crawlDelayMs,
    content_type: page.contentType,
    text: page.text.slice(0, maxChars),
  };
}
