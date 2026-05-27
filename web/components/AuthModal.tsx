"use client";

// AuthModal —— 首页右上角「登录」/ 触发搜索时弹出的登录注册弹窗。
// 登录 / 注册两个 tab; 注册若开了邮箱验证, 进入 OTP 验证子步骤。
// 成功 → onAuthed(user) (父组件关弹窗 + 续跑挂起的动作)。
import { useEffect, useState } from "react";
import { login, register, verify } from "@/lib/auth";

type Tab = "login" | "register";
type Stage = "form" | "verify";

function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <g stroke="#111111" strokeWidth={22} fill="none" strokeLinecap="round">
        <circle cx="256" cy="256" r="130" />
        <circle cx="256" cy="256" r="70" />
        <path d="M186 256a70 70 0 1 0 70-70" />
      </g>
      <circle cx="256" cy="256" r="16" fill="#9EFF4F" />
    </svg>
  );
}

export default function AuthModal({
  open,
  onClose,
  onAuthed,
}: {
  open: boolean;
  onClose: () => void;
  onAuthed: (user: { email: string }) => void;
}) {
  const [tab, setTab] = useState<Tab>("login");
  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function switchTab(t: Tab) {
    setTab(t); setStage("form"); setErr("");
  }

  function done() {
    const u = { email: email.trim() };
    setPassword(""); setOtp(""); setErr(""); setStage("form"); setBusy(false);
    onAuthed(u);
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await login(email.trim(), password);
    setBusy(false);
    if (r.ok) return done();
    if (r.needVerify) { setStage("verify"); setErr("请输入邮箱收到的验证码完成验证"); return; }
    setErr(r.error);
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await register(email.trim(), password, name.trim() || undefined);
    setBusy(false);
    if (r.ok) return done();
    if (r.needVerify) { setStage("verify"); setErr(""); return; }
    setErr(r.error);
  }

  async function submitVerify(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await verify(email.trim(), otp.trim());
    setBusy(false);
    if (r.ok) return done();
    setErr(r.error);
  }

  const inputCls =
    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white";
  const btnCls =
    "w-full rounded-xl bg-gray-900 px-5 py-2.5 font-medium text-white transition hover:bg-gray-800 disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="sh-fade-in-up relative w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="关闭"
          className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-900"
        >
          ✕
        </button>

        <div className="mb-5 flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="text-[16px] font-semibold tracking-tight text-gray-900">SignalHire</span>
        </div>

        {stage === "verify" ? (
          <form onSubmit={submitVerify} className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900">验证邮箱</h2>
            <p className="text-sm text-gray-500">
              验证码已发送到 <span className="font-medium text-gray-700">{email}</span>，请输入。
            </p>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6 位验证码"
              inputMode="numeric"
              autoFocus
              className={inputCls}
            />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button type="submit" disabled={busy} className={btnCls}>
              {busy ? "验证中…" : "验证并登录"}
            </button>
            <button
              type="button"
              onClick={() => { setStage("form"); setErr(""); }}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-900"
            >
              ← 返回
            </button>
          </form>
        ) : (
          <>
            {/* tab 切换 */}
            <div className="mb-5 inline-flex w-full rounded-xl bg-gray-100 p-1">
              <button
                onClick={() => switchTab("login")}
                className={`flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition ${tab === "login" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
              >
                登录
              </button>
              <button
                onClick={() => switchTab("register")}
                className={`flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition ${tab === "register" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
              >
                注册
              </button>
            </div>

            <form onSubmit={tab === "login" ? submitLogin : submitRegister} className="space-y-3">
              {tab === "register" && (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="名字（可选）"
                  className={inputCls}
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="邮箱"
                autoFocus
                required
                className={inputCls}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "register" ? "密码（至少 6 位）" : "密码"}
                required
                minLength={6}
                className={inputCls}
              />
              {err && <p className="text-sm text-red-600">{err}</p>}
              <button type="submit" disabled={busy} className={btnCls}>
                {busy ? "处理中…" : tab === "login" ? "登录" : "注册"}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-500">
              {tab === "login" ? "还没有账号？" : "已有账号？"}
              <button
                onClick={() => switchTab(tab === "login" ? "register" : "login")}
                className="ml-1 font-medium text-gray-900 underline-offset-4 hover:underline"
              >
                {tab === "login" ? "去注册" : "去登录"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
