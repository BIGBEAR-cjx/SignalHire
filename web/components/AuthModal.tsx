"use client";

// AuthModal —— 首页右上角「登录」/ 触发搜索时弹出的登录注册弹窗。
// 登录 / 注册两个 tab; 注册若开了邮箱验证, 进入 OTP 验证子步骤。
// 成功 → onAuthed(user) (父组件关弹窗 + 续跑挂起的动作)。
import { useEffect, useState } from "react";
import { FiArrowLeft, FiX } from "react-icons/fi";
import { IconButton, LogoMark, SegmentedControl } from "@/components/ui/signal-ui";
import { login, register, verify } from "@/lib/auth";

type Tab = "login" | "register";
type Stage = "form" | "verify";

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
    "w-full rounded-2xl border border-black/10 bg-white/72 px-4 py-3 text-[var(--sh-ink)] outline-none transition placeholder:text-[var(--sh-faint)] focus:border-black/20 focus:bg-white";
  const btnCls =
    "w-full rounded-full bg-[var(--sh-ink)] px-5 py-3 font-semibold text-white transition hover:bg-black disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="sh-fade-in-up relative w-full max-w-md rounded-[32px] border border-white/70 bg-white/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton label="关闭" onClick={onClose} Icon={FiX} className="absolute right-4 top-4" />

        <div className="mb-6 flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="text-[16px] font-semibold tracking-tight text-[var(--sh-ink)]">SignalHire</span>
        </div>

        {stage === "verify" ? (
          <form onSubmit={submitVerify} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Email verification</p>
            <h2 className="text-2xl font-semibold text-[var(--sh-ink)]">验证邮箱</h2>
            <p className="text-sm leading-6 text-[var(--sh-muted)]">
              验证码已发送到 <span className="font-semibold text-[var(--sh-ink)]">{email}</span>，请输入。
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[var(--sh-muted)] hover:bg-neutral-100 hover:text-[var(--sh-ink)]"
            >
              <FiArrowLeft className="h-4 w-4" aria-hidden="true" />
              返回
            </button>
          </form>
        ) : (
          <>
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Account</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--sh-ink)]">{tab === "login" ? "登录控制台" : "创建 SignalHire 账号"}</h2>
              <div className="mt-4">
                <SegmentedControl
                  value={tab}
                  onChange={switchTab}
                  items={[
                    { value: "login", label: "登录" },
                    { value: "register", label: "注册" },
                  ]}
                />
              </div>
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

            <p className="mt-4 text-center text-sm text-[var(--sh-muted)]">
              {tab === "login" ? "还没有账号？" : "已有账号？"}
              <button
                onClick={() => switchTab(tab === "login" ? "register" : "login")}
                className="ml-1 font-semibold text-[var(--sh-ink)] underline-offset-4 hover:underline"
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
