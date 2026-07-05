export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    provider: "internal_live_signal_provider",
  });
}
