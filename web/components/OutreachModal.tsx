"use client";

// OutreachModal —— AI 外联邮件草稿生成 (Phase 2.A.3)。
// 4 tone 切换 + 可编辑 subject/body + 📋 复制 + 📧 用邮件 App 发送 (mailto:) + 🔄 重新生成。
// 候选人详情面板/收藏夹/搜人结果都挂同一个 Modal。
import { useEffect, useRef, useState } from "react";
import {
  buildEvidenceDrivenOutreachDraft,
  buildOutreachEvidenceBrief,
  type OutreachEvidenceBrief,
} from "@/lib/outreach-draft.mjs";

type Tone = "friendly" | "professional" | "short" | "detailed";

const TONES: { value: Tone; label: string }[] = [
  { value: "professional", label: "专业" },
  { value: "friendly",     label: "友好" },
  { value: "short",        label: "短而准" },
  { value: "detailed",     label: "详细" },
];

const SENDER_KEY = "sh_outreach_sender";

export interface OutreachModalProps {
  open: boolean;
  onClose: () => void;
  candidate: unknown;        // 任意候选人形状, /api/outreach 不挑
  candidateName?: string;    // 仅用于显示
  candidateEmail?: string;   // 有邮箱直接进 mailto: To
  roleBrief?: string;        // 可选: 当前岗位画像, 让邮件更贴需求
}

export default function OutreachModal({ open, onClose, candidate, candidateName, candidateEmail, roleBrief }: OutreachModalProps) {
  const [tone, setTone] = useState<Tone>("professional");
  const [sender, setSender] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(SENDER_KEY) || "";
  });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [evidenceBrief, setEvidenceBrief] = useState<OutreachEvidenceBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [evidenceCopied, setEvidenceCopied] = useState(false);
  const generatedFor = useRef<{ tone: Tone; candidate: unknown } | null>(null);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 打开 / 候选人变化 / tone 切换 → 触发生成 (但同 candidate+tone 不重复)
  useEffect(() => {
    if (!open || !candidate) return;
    const last = generatedFor.current;
    if (last && last.tone === tone && last.candidate === candidate) return;
    generateDraft(tone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidate, tone]);

  async function generateDraft(t: Tone) {
    setLoading(true); setError("");
    const localDraft = buildEvidenceDrivenOutreachDraft({
      candidate,
      tone: t,
      senderName: sender.trim() || undefined,
      roleBrief,
    });
    setEvidenceBrief(localDraft.evidence_brief);
    try {
      const r = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate,
          tone: t,
          role_brief: roleBrief,
          sender_name: sender.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSubject(j.subject || localDraft.subject);
      setBody(j.body || localDraft.body);
      setEvidenceBrief(j.evidence_brief || localDraft.evidence_brief);
      generatedFor.current = { tone: t, candidate };
    } catch (e) {
      setSubject(localDraft.subject);
      setBody(localDraft.body);
      setEvidenceBrief(localDraft.evidence_brief);
      setError(`AI 生成失败，已使用本地证据草稿：${(e as Error).message}`);
      generatedFor.current = { tone: t, candidate };
    } finally {
      setLoading(false);
    }
  }

  function saveSender(v: string) {
    setSender(v);
    if (typeof window !== "undefined") window.localStorage.setItem(SENDER_KEY, v);
  }

  function copyAll() {
    const text = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function copyEvidence() {
    const brief = evidenceBrief || buildOutreachEvidenceBrief(candidate);
    const text = [
      brief.contact_angle ? `联系角度: ${brief.contact_angle}` : "",
      brief.proof_points.length ? `证据点:\n- ${brief.proof_points.join("\n- ")}` : "",
      brief.evidence_links.length ? `来源:\n- ${brief.evidence_links.join("\n- ")}` : "",
      brief.risk_note ? `注意: ${brief.risk_note}` : "",
    ].filter(Boolean).join("\n\n");
    navigator.clipboard?.writeText(text);
    setEvidenceCopied(true);
    setTimeout(() => setEvidenceCopied(false), 1500);
  }

  function openMailto() {
    const to = candidateEmail ? encodeURIComponent(candidateEmail) : "";
    const su = encodeURIComponent(subject);
    const bo = encodeURIComponent(body);
    window.location.href = `mailto:${to}?subject=${su}&body=${bo}`;
  }

  function regen() {
    generatedFor.current = null;
    generateDraft(tone);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="sh-fade-in-up relative flex w-full max-w-2xl flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "92vh" }}
      >
        <button onClick={onClose} aria-label="关闭" className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-900">✕</button>

        <header className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">起草外联邮件</h2>
          {candidateName && <p className="mt-0.5 text-sm text-gray-500">写给 {candidateName}</p>}
        </header>

        {/* tone 切换 */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">语气</span>
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTone(t.value)}
              disabled={loading}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                tone === t.value ? "bg-gray-900 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 你的名字 (localStorage 缓存) */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-600">你的名字 (用于邮件签名)</label>
          <input
            value={sender}
            onChange={(e) => saveSender(e.target.value)}
            onBlur={() => { if (sender) regen(); }}
            placeholder="例如:王力"
            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
          />
        </div>

        {/* 生成出来的草稿 */}
        <div className="mb-3 flex-1 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/50 p-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              MiroMind 起草中…
            </div>
          )}
          {!loading && error && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-100">{error}</p>}
          {!loading && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">主题</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">正文</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="block w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed text-gray-900 outline-none focus:border-gray-900"
                />
              </div>
            </div>
          )}
        </div>

        {evidenceBrief && (
          <section className="mb-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-blue-900">本次外联依据</p>
              <button
                type="button"
                onClick={copyEvidence}
                className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100 hover:ring-blue-300"
              >
                {evidenceCopied ? "已复制依据" : "复制依据"}
              </button>
            </div>
            {evidenceBrief.contact_angle && (
              <p className="mt-2 text-sm leading-relaxed text-blue-900">{evidenceBrief.contact_angle}</p>
            )}
            {evidenceBrief.proof_points.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-blue-900/80">
                {evidenceBrief.proof_points.slice(0, 4).map((point) => <li key={point}>{point}</li>)}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {evidenceBrief.public_profiles.map((profile) => (
                <span key={profile} className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                  {profile}
                </span>
              ))}
              {evidenceBrief.evidence_links.length > 0 && (
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                  {evidenceBrief.evidence_links.length} 个证据链接
                </span>
              )}
            </div>
            {evidenceBrief.risk_note && (
              <p className="mt-2 text-xs leading-relaxed text-amber-700">注意: {evidenceBrief.risk_note}</p>
            )}
          </section>
        )}

        {/* 操作栏 */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={regen}
            disabled={loading}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-900 disabled:opacity-50"
          >
            🔄 重新生成
          </button>
          <button
            onClick={copyAll}
            disabled={loading || !body}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-900 disabled:opacity-50"
          >
            {copied ? "✓ 已复制" : "📋 复制全文"}
          </button>
          <button
            onClick={openMailto}
            disabled={loading || !body}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            📧 用邮件 App 发送
          </button>
        </div>
      </div>
    </div>
  );
}
