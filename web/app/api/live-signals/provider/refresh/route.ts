import { buildSignalhireAggregateLiveSignalProviderRefresh } from "@/lib/live-signal-refresh.mjs";

export const runtime = "nodejs";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function bearerToken(req: Request) {
  const header = cleanString(req.headers.get("authorization"));
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export async function POST(req: Request) {
  const apiKey = cleanString(process.env.LIVE_SIGNAL_PROVIDER_API_KEY);
  if (!apiKey) return Response.json({ error: "live_signal_provider_key_not_configured" }, { status: 503 });
  if (bearerToken(req) !== apiKey) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_provider_payload" }, { status: 400 });
  }

  return Response.json(buildSignalhireAggregateLiveSignalProviderRefresh(body));
}
