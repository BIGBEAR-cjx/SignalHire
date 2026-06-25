import { buildRoleBriefDraft } from "@/lib/talent-profile.mjs";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

const URL_SOURCES = new Set(["job_url", "linkedin_url"]);
const buildRoleBrief = buildRoleBriefDraft as (value: string, options: { locale: string; sourceType: string }) => ReturnType<typeof buildRoleBriefDraft>;

function isUrlSource(sourceType: string) {
  return URL_SOURCES.has(sourceType);
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function pickMeta(html: string, name: string) {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return decodeHtml(cleanText(html.match(pattern)?.[1]));
}

function extractHtmlRoleText(html: string) {
  const title = decodeHtml(cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]));
  const description = pickMeta(html, "description") || pickMeta(html, "og:description");
  const body = decodeHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "));
  return [title, description, cleanText(body).slice(0, 12000)].filter(Boolean).join("\n");
}

function urlSlugFallback(url: string) {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname)
      .replace(/[-_/]+/g, " ")
      .replace(/\b\d{4,}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return [parsed.hostname.replace(/^www\./, ""), path].filter(Boolean).join("\n");
  } catch {
    return url;
  }
}

async function fetchRoleSourceText(value: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(value, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "accept": "text/html,text/plain;q=0.9,*/*;q=0.5",
        "user-agent": "SignalHire role intake (+https://signalhire.local)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get("content-type") ?? "";
    const text = await response.text();
    const extracted = type.includes("html") ? extractHtmlRoleText(text) : cleanText(text).slice(0, 12000);
    return { ok: Boolean(extracted), text: extracted || urlSlugFallback(value), status: extracted ? "extracted" : "fallback", error: "" };
  } catch (error) {
    return {
      ok: false,
      text: urlSlugFallback(value),
      status: "fallback",
      error: error instanceof Error ? error.message : "fetch_failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  let body: { value?: unknown; sourceType?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });

  const value = cleanText(body.value);
  const sourceType = cleanText(body.sourceType) || "natural_language";
  if (!value) return Response.json({ error: t(locale, "api.error.missingQuery") }, { status: 400 });

  const extraction = isUrlSource(sourceType)
    ? await fetchRoleSourceText(value)
    : { ok: true, text: value, status: "provided", error: "" };
  const draft = buildRoleBrief(extraction.text || value, { locale, sourceType });
  return Response.json({
    draft: {
      ...draft,
      intake_source: {
        ...draft.intake_source,
        value,
      },
      source_extraction: {
        status: extraction.status,
        url: isUrlSource(sourceType) ? value : "",
        error: extraction.error,
      },
    },
  });
}
