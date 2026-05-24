// 临时诊断端点: 排查生产环境 Insforge 环境变量/连接问题。诊断完即删。
// 不泄露密钥: 只报变量是否存在、base host、key 前缀、以及一次真实 DB 探测的结果。
import { createClient } from "@insforge/sdk";

export const runtime = "nodejs";

export async function GET() {
  const BASE = process.env.INSFORGE_API_BASE_URL;
  const KEY = process.env.INSFORGE_API_KEY;
  const out: Record<string, unknown> = {
    hasBase: !!BASE,
    hasKey: !!KEY,
    baseHost: BASE ? (() => { try { return new URL(BASE).host; } catch { return "INVALID_URL"; } })() : null,
    keyPrefix: KEY ? KEY.slice(0, 3) : null,
    keyLen: KEY ? KEY.length : 0,
  };
  if (BASE && KEY) {
    try {
      const c = createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true });
      const { data, error } = await c.database.from("research_runs").select("cache_key").limit(1);
      out.probe = error
        ? "error: " + (error.message || JSON.stringify(error))
        : "ok rows=" + (Array.isArray(data) ? data.length : "?");
    } catch (e) {
      out.probe = "throw: " + (e as Error).message;
    }
  } else {
    out.probe = "skipped (缺少环境变量)";
  }
  return Response.json(out);
}
