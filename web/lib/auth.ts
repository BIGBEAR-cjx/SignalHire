// lib/auth.ts —— 客户端认证封装 (Insforge Auth)。
// 认证端点无需 key, 仅需 baseUrl (公开)。拿到 accessToken 后 POST 给 /api/auth/session 写 httpOnly cookie。
import { createClient } from "@insforge/sdk";
import { authErrorMessage } from "./auth-copy.mjs";
import { syncSessionCookieFromTokenManager } from "@/lib/auth-session-sync.mjs";

const BASE = process.env.NEXT_PUBLIC_INSFORGE_API_BASE_URL;
const client = createClient({ baseUrl: BASE });

// 把 token 写进服务端 httpOnly cookie, 供服务端路由读取登录态。
async function setSession(accessToken: string) {
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
}

export type AuthResult =
  | { ok: true }
  | { ok: false; needVerify?: boolean; error: string };

export async function register(email: string, password: string, name?: string, locale = "zh"): Promise<AuthResult> {
  try {
    const { data, error } = await client.auth.signUp({ email, password, name });
    if (error) return { ok: false, error: authErrorMessage(locale, "registerFailed", error.message) };
    if (data?.accessToken) { await setSession(data.accessToken); return { ok: true }; }
    // 开了邮箱验证: 没拿到 token, 需要验证码
    if (data?.requireEmailVerification) return { ok: false, needVerify: true, error: authErrorMessage(locale, "needCode") };
    return { ok: false, error: authErrorMessage(locale, "registerNoToken") };
  } catch (e) {
    return { ok: false, error: authErrorMessage(locale, "registerFailed", (e as Error).message) };
  }
}

export async function verify(email: string, otp: string, locale = "zh"): Promise<AuthResult> {
  try {
    const { data, error } = await client.auth.verifyEmail({ email, otp });
    if (error) return { ok: false, error: authErrorMessage(locale, "verifyFailed", error.message) };
    if (data?.accessToken) { await setSession(data.accessToken); return { ok: true }; }
    return { ok: false, error: authErrorMessage(locale, "verifyNoToken") };
  } catch (e) {
    return { ok: false, error: authErrorMessage(locale, "verifyFailed", (e as Error).message) };
  }
}

export async function login(email: string, password: string, locale = "zh"): Promise<AuthResult> {
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      // 403 = 邮箱未验证
      const verifyHint = error.statusCode === 403 || /verify/i.test(error.message || "");
      return {
        ok: false,
        needVerify: verifyHint,
        error: verifyHint
          ? authErrorMessage(locale, "loginVerifyFirst")
          : authErrorMessage(locale, "loginFailed", error.message),
      };
    }
    if (data?.accessToken) { await setSession(data.accessToken); return { ok: true }; }
    return { ok: false, error: authErrorMessage(locale, "loginNoToken") };
  } catch (e) {
    return { ok: false, error: authErrorMessage(locale, "loginFailed", (e as Error).message) };
  }
}

export async function logout() {
  try { await client.auth.signOut(); } catch {}
  try { await fetch("/api/auth/session", { method: "DELETE" }); } catch {}
}

export async function currentUser(): Promise<{ email: string } | null> {
  try {
    const { data } = await client.auth.getCurrentUser();
    if (!data?.user) return null;
    // 同步 cookie: SDK 内部刚刚可能用 refresh_token 续了 accessToken,
    // 而 /api/auth/session 写的 sh_token cookie 还是旧的 JWT (已过期 → API 401)。
    // 这里把当前(可能新)accessToken 重写回 cookie, 保证服务端鉴权能用。
    await syncSessionCookie();
    return { email: data.user.email };
  } catch {
    return null;
  }
}

// 从 SDK 拿当前 accessToken 并同步到 httpOnly cookie。
// 失败完全静默 (cookie 同步是优化, 不是必需)。
async function syncSessionCookie() {
  await syncSessionCookieFromTokenManager(client);
}
