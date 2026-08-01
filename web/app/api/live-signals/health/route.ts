export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    provider: process.env.LIVE_SIGNAL_PROVIDER_URL?.trim()
      ? "external_live_signal_provider"
      : "github_public_events",
  });
}
