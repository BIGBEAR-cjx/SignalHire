"use client";

// /app/settings —— 设置(最小版)
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCheckCircle, FiCopy, FiLogOut } from "react-icons/fi";
import { logout } from "@/lib/auth";
import { PageIntro, SecondaryAction, Surface } from "@/components/ui/signal-ui";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 从服务端拿 (含 user.id, 方便 SQL backfill 用)
    fetch("/api/whoami")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.user && setUser(j.user))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Settings"
        title="账户和偏好。"
        description="管理登录账户、复制用户标识，并为后续团队协作与通知偏好预留空间。"
      />

      <Surface className="p-5 md:p-6">
        <h2 className="text-xl font-semibold text-[var(--sh-ink)]">账户</h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500">邮箱</dt>
            <dd className="font-medium text-gray-900">{user?.email ?? "加载中…"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500">User ID</dt>
            <dd className="flex items-center gap-2">
              <code className="rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700">
                {user?.id ?? "加载中…"}
              </code>
              {user?.id && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(user.id);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-[var(--sh-muted)] hover:border-black/20"
                >
                  {copied ? <FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> : <FiCopy className="h-3.5 w-3.5" aria-hidden="true" />}
                  {copied ? "已复制" : "复制"}
                </button>
              )}
            </dd>
          </div>
        </dl>
        <SecondaryAction onClick={handleLogout} className="mt-5">
          <FiLogOut className="h-4 w-4" aria-hidden="true" />
          退出登录
        </SecondaryAction>
      </Surface>

      <Surface className="p-5 md:p-6">
        <h2 className="text-xl font-semibold text-[var(--sh-ink)]">即将上线</h2>
        <ul className="mt-4 grid gap-2 text-sm text-[var(--sh-muted)] sm:grid-cols-2">
          {["修改密码", "邮件通知偏好", "团队 / 协作", "计费 / 用量", "API Keys"].map((item) => (
            <li key={item} className="rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-black/5">{item}</li>
          ))}
        </ul>
      </Surface>
    </div>
  );
}
