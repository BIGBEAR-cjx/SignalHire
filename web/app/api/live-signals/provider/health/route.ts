export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    provider: "signalhire_aggregate_live_signal_provider",
  });
}
