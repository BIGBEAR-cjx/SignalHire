import { runContactResolution } from "@/lib/contact-resolution-route.mjs";
import { getOutreachThread, updateOutreachThread } from "@/lib/outreach-threads";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { outreach_thread_id?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  const result = await runContactResolution({
    body,
    user,
    env: process.env,
    getOutreachThread,
    updateOutreachThread,
    messages: {
      loginRequired: t(locale, "api.error.loginRequired"),
      missingId: t(locale, "api.error.missingId"),
      notFound: t(locale, "api.error.shortlistUpdateUnavailable"),
    },
  });
  return Response.json(result.body, { status: result.status });
}
