"use client";

// 营销首页 —— 只做产品展示, 不再内嵌工具。
// 任何 CTA(hero 输入框/登录/查看示例) → 已登录直接跳 /app/*, 未登录先弹 AuthModal, 登录后跳过去。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Landing from "./Landing";
import AuthModal from "@/components/AuthModal";
import { currentUser, logout } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [postAuthUrl, setPostAuthUrl] = useState<string>("/app");

  useEffect(() => { currentUser().then(setUser); }, []);

  function goOrAuth(targetUrl: string) {
    if (user) router.push(targetUrl);
    else { setPostAuthUrl(targetUrl); setAuthOpen(true); }
  }

  async function handleLogout() {
    await logout();
    setUser(null);
  }

  return (
    <>
      <Landing
        user={user}
        onLoginClick={() => { setPostAuthUrl("/app"); setAuthOpen(true); }}
        onLogout={handleLogout}
        onSearch={(q) => goOrAuth(`/app/search?q=${encodeURIComponent(q)}`)}
        onDemo={() => goOrAuth("/app/verify?demo=1")}
      />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={(u) => {
          setUser(u);
          setAuthOpen(false);
          router.push(postAuthUrl);
        }}
      />
    </>
  );
}
