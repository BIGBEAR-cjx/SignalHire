import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_TAGS = "coding,global,us";
const DEFAULT_EXCLUDE_TAGS = "dating,nsfw,porn";
const BLOCKED_HOST_RE = /(^|\.)linkedin\.com$/i;
const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/gi;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function parsedUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isBlockedHost(url) {
  const parsed = parsedUrl(url);
  return !parsed || BLOCKED_HOST_RE.test(parsed.hostname);
}

function pathParts(url) {
  return parsedUrl(url)?.pathname.split("/").filter(Boolean) ?? [];
}

function validAlias(value) {
  const alias = cleanString(value).replace(/^@/, "");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/.test(alias)) return "";
  if (/^(login|signin|signup|register|search|explore|topics|marketplace|features|orgs)$/i.test(alias)) return "";
  return alias;
}

function aliasFromUrl(url) {
  const parsed = parsedUrl(url);
  if (!parsed || isBlockedHost(url)) return null;
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const parts = pathParts(url);
  if (host === "github.com") {
    const alias = validAlias(parts[0]);
    return alias ? { alias, source: "github", url: parsed.toString() } : null;
  }
  if (host === "huggingface.co") {
    const alias = validAlias(parts[0]);
    return alias ? { alias, source: "huggingface", url: parsed.toString() } : null;
  }
  return null;
}

export function extractMaigretAliasesFromText(text, { maxAliases = 3 } = {}) {
  const urls = String(text ?? "").match(URL_RE) ?? [];
  return uniqueBy(urls.map(aliasFromUrl).filter(Boolean), (item) => item.alias.toLowerCase())
    .slice(0, Math.max(0, Number(maxAliases) || 0));
}

function parseMaigretOutput(output) {
  if (Array.isArray(output)) return output;
  if (output && typeof output === "object") {
    if (Array.isArray(output.results)) return output.results;
    if (output.url_user || output.profile_url || output.url || output.status) return [output];
    return Object.entries(output).map(([siteName, value]) => ({ site_name: siteName, ...(value && typeof value === "object" ? value : {}) }));
  }
  const text = String(output ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return parseMaigretOutput(parsed);
  } catch {
    return text.split(/\r?\n/).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }
}

function isFoundResult(item) {
  const status = cleanString(item?.status?.status ?? item?.status?.value ?? item?.status).toLowerCase();
  if (!status) return Boolean(cleanString(item?.url_user ?? item?.profile_url ?? item?.url));
  return /claimed|found|exists|available yes|success/.test(status) && !/not|unknown|available$|missing|error/.test(status);
}

function maigretSourceType(siteName, url) {
  const host = parsedUrl(url)?.hostname.replace(/^www\./, "").toLowerCase() ?? "";
  const site = cleanString(siteName).toLowerCase();
  if (host === "github.com" || site.includes("github")) return "code";
  if (host === "huggingface.co" || site.includes("hugging face")) return "code";
  if (/reddit|hackernews|news\.ycombinator|stackoverflow|stack overflow|dev\.to/.test(`${host} ${site}`)) return "community";
  if (/twitter|x\.com|mastodon|telegram|facebook|instagram|threads|social/.test(`${host} ${site}`)) return "social_profile";
  return "profile";
}

function maigretFamily(siteName) {
  const slug = cleanString(siteName).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `maigret_${slug || "profile"}`;
}

export function normalizeMaigretResults(output, { alias = "" } = {}) {
  return parseMaigretOutput(output).flatMap((item) => {
    const url = cleanString(item?.url_user ?? item?.profile_url ?? item?.url);
    if (!url || isBlockedHost(url) || !isFoundResult(item)) return [];
    const siteName = cleanString(item?.site_name ?? item?.site ?? item?.name) || parsedUrl(url)?.hostname.replace(/^www\./, "") || "Profile";
    const ids = item?.ids_data && typeof item.ids_data === "object" ? item.ids_data : {};
    const fullname = cleanString(ids.fullname ?? ids.name ?? item?.fullname ?? item?.name);
    const candidateName = validAlias(item?.username) || validAlias(alias) || pathParts(url).at(-1) || siteName;
    return [{
      provider: "maigret",
      family: maigretFamily(siteName),
      coverage_group: "public_voice",
      source_type: maigretSourceType(siteName, url),
      candidate_name: candidateName,
      title: `${siteName}${fullname ? ` - ${fullname}` : ""}`,
      url,
      metric: 0,
      year: null,
    }];
  });
}

function buildMaigretArgs(alias, {
  topSites = 200,
  tags = DEFAULT_TAGS,
  excludeTags = DEFAULT_EXCLUDE_TAGS,
} = {}) {
  return [
    alias,
    "--top-sites", String(topSites),
    "--tags", tags,
    "--exclude-tags", excludeTags,
    "--no-recursion",
    "--json", "ndjson",
  ];
}

export async function runMaigretProvider(text, {
  enabled = false,
  command = "maigret",
  maxAliases = 3,
  timeoutMs = 90000,
  topSites = 200,
  tags = DEFAULT_TAGS,
  excludeTags = DEFAULT_EXCLUDE_TAGS,
  execFileImpl = execFileAsync,
  nowImpl = () => Date.now(),
} = {}) {
  if (!enabled) {
    return { leads: [], errors: [], provider_stats: { maigret: { status: "disabled", requests: 0, attempts: 0, lead_count: 0, duration_ms: 0 } } };
  }
  const aliases = extractMaigretAliasesFromText(text, { maxAliases });
  if (aliases.length === 0) {
    return { leads: [], errors: [], provider_stats: { maigret: { status: "no_aliases", requests: 0, attempts: 0, lead_count: 0, duration_ms: 0 } } };
  }
  const started = nowImpl();
  const leads = [];
  const errors = [];
  for (const item of aliases) {
    try {
      const { stdout = "" } = await execFileImpl(command, buildMaigretArgs(item.alias, { topSites, tags, excludeTags }), { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 4 });
      leads.push(...normalizeMaigretResults(stdout, { alias: item.alias }));
    } catch (error) {
      errors.push({ provider: "maigret", alias: item.alias, error: error?.message ?? String(error) });
    }
  }
  const duration = Math.max(0, nowImpl() - started);
  return {
    leads,
    errors,
    provider_stats: {
      maigret: {
        status: errors.length === aliases.length ? "error" : errors.length > 0 ? "partial" : "ok",
        attempts: aliases.length,
        requests: aliases.length,
        lead_count: leads.length,
        duration_ms: duration,
        error: errors[0]?.error,
      },
    },
  };
}
