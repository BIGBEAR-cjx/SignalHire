"use client";

// OutreachModal —— AI 外联邮件草稿生成 (Phase 2.A.3)。
// 4 tone 切换 + 可编辑 subject/body + 复制 + 用邮件 App 发送 (mailto:) + 重新生成。
// 候选人详情面板/收藏夹/搜人结果都挂同一个 Modal。
import { useEffect, useRef, useState } from "react";
import { FiCheckCircle, FiCopy, FiRefreshCw, FiSend, FiX } from "react-icons/fi";
import { IconButton, SegmentedControl, StatusBadge } from "@/components/ui/signal-ui";
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
        className="sh-fade-in-up relative flex w-full max-w-3xl flex-col rounded-[32px] border border-white/70 bg-white/94 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "92vh" }}
      >
        <IconButton label="关闭" onClick={onClose} Icon={FiX} className="absolute right-4 top-4" />

        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Evidence outreach</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--sh-ink)]">起草外联邮件</h2>
          {candidateName && <p className="mt-2 text-sm text-[var(--sh-muted)]">写给 {candidateName}</p>}
        </header>

        <div className="mb-3">
          <SegmentedControl value={tone} onChange={setTone} items={TONES} />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-[var(--sh-muted)]">你的名字 (用于邮件签名)</label>
          <input
            value={sender}
            onChange={(e) => saveSender(e.target.value)}
            onBlur={() => { if (sender) regen(); }}
            placeholder="例如:王力"
            className="block w-full rounded-2xl border border-black/10 bg-white/72 px-4 py-3 text-sm text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)] focus:border-black/20 focus:bg-white"
          />
        </div>

        <div className="mb-3 flex-1 overflow-y-auto rounded-3xl border border-black/10 bg-neutral-50/80 p-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-[var(--sh-muted)]">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              正在根据证据起草…
            </div>
          )}
          {!loading && error && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-100">{error}</p>}
          {!loading && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--sh-muted)]">主题</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="block w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[var(--sh-ink)] outline-none focus:border-black/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--sh-muted)]">正文</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="block w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm leading-relaxed text-[var(--sh-ink)] outline-none focus:border-black/20"
                />
              </div>
            </div>
          )}
        </div>

        {evidenceBrief && (
          <section className="mb-3 rounded-3xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusBadge label="本次外联依据" dotClassName="bg-blue-500" className="bg-white text-blue-800 ring-blue-100" />
              <button
                type="button"
                onClick={copyEvidence}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 hover:ring-blue-300"
              >
                {evidenceCopied ? <FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> : <FiCopy className="h-3.5 w-3.5" aria-hidden="true" />}
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

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={regen}
            disabled={loading}
            className="sh-secondary-action min-h-10 px-3 py-2 text-sm disabled:opacity-50"
          >
            <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
            重新生成
          </button>
          <button
            onClick={copyAll}
            disabled={loading || !body}
            className="sh-secondary-action min-h-10 px-3 py-2 text-sm disabled:opacity-50"
          >
            {copied ? <FiCheckCircle className="h-4 w-4" aria-hidden="true" /> : <FiCopy className="h-4 w-4" aria-hidden="true" />}
            {copied ? "已复制" : "复制全文"}
          </button>
          <button
            onClick={openMailto}
            disabled={loading || !body}
            className="sh-primary-action min-h-10 px-4 py-2 text-sm disabled:opacity-50"
          >
            <FiSend className="h-4 w-4" aria-hidden="true" />
            用邮件 App 发送
          </button>
        </div>
      </div>
    </div>
  );
}
