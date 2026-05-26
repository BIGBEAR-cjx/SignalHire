// lib/auth.ts —— 客户端认证封装 (Insforge Auth)。
// 认证端点无需 key, 仅需 baseUrl (公开)。拿到 accessToken 后 POST 给 /api/auth/session 写 httpOnly cookie。
import { createClient } from "@insforge/sdk";

const BASE = process.env.NEXT_PUBLIC_INSFORGE_API_BASE_URL;
const client = createClient({ baseUrl: BASE });

// 把 token 写进服务端 httpOnly cookie (middleware 据此放行)。
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

export async function register(email: string, password: string, name?: string): Promise<AuthResult> {
  try {
    const { data, error } = await client.auth.signUp({ email, password, name });
    if (error) return { ok: false, error: error.message || "注册失败" };
    if (data?.accessToken) { await setSession(data.accessToken); return { ok: true }; }
    // 开了邮箱验证: 没拿到 token, 需要验证码
    if (data?.requireEmailVerification) return { ok: false, needVerify: true, error: "请输入邮箱收到的验证码" };
    return { ok: false, error: "注册未返回令牌" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function verify(email: string, otp: string): Promise<AuthResult> {
  try {
    const { data, error } = await client.auth.verifyEmail({ email, otp });
    if (error) return { ok: false, error: error.message || "验证失败" };
    if (data?.accessToken) { await setSession(data.accessToken); return { ok: true }; }
    return { ok: false, error: "验证未返回令牌" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      // 403 = 邮箱未验证
      const verifyHint = error.statusCode === 403 || /verify/i.test(error.message || "");
      return { ok: false, needVerify: verifyHint, error: verifyHint ? "请先验证邮箱" : (error.message || "登录失败") };
    }
    if (data?.accessToken) { await setSession(data.accessToken); return { ok: true }; }
    return { ok: false, error: "登录未返回令牌" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function logout() {
  try { await client.auth.signOut(); } catch {}
  try { await fetch("/api/auth/session", { method: "DELETE" }); } catch {}
}

export async function currentUser(): Promise<{ email: string } | null> {
  try {
    const { data } = await client.auth.getCurrentUser();
    return data?.user ? { email: data.user.email } : null;
  } catch {
    return null;
  }
}
