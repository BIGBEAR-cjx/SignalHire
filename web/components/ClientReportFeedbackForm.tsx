"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type Locale = "zh" | "en";
type Sentiment = "ready_to_interview" | "needs_more_candidates" | "needs_stronger_evidence" | "not_a_fit";

const OPTIONS: Array<{ value: Sentiment; zh: string; en: string }> = [
  { value: "ready_to_interview", zh: "可以约面", en: "Ready to interview" },
  { value: "needs_more_candidates", zh: "需要更多候选人", en: "Need more candidates" },
  { value: "needs_stronger_evidence", zh: "需要更强证据", en: "Need stronger evidence" },
  { value: "not_a_fit", zh: "暂不匹配", en: "Not a fit" },
];

const COPY = {
  zh: {
    title: "招聘经理反馈",
    reviewer: "反馈人",
    reviewerPlaceholder: "例如：Hiring Manager",
    note: "反馈",
    notePlaceholder: "告诉团队下一步该推进谁、补什么证据，或为什么暂缓。",
    submit: "保存反馈",
    saving: "保存中",
    saved: "反馈已保存。",
    error: "反馈保存失败，请检查分享链接后重试。",
  },
  en: {
    title: "Hiring manager feedback",
    reviewer: "Reviewer",
    reviewerPlaceholder: "e.g. Hiring Manager",
    note: "Feedback",
    notePlaceholder: "Tell the team who to move next, what evidence is missing, or why this is not a fit.",
    submit: "Save feedback",
    saving: "Saving",
    saved: "Feedback saved.",
    error: "Feedback could not be saved. Check the share link and try again.",
  },
} as const;

export function ClientReportFeedbackForm({
  reportId,
  token,
  locale,
}: {
  reportId: string;
  token: string;
  locale: Locale;
}) {
  const copy = COPY[locale];
  const [sentiment, setSentiment] = useState<Sentiment>("ready_to_interview");
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim() || status === "saving") return;
    setStatus("saving");
    const response = await fetch(`/api/reports/${reportId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        locale,
        feedback: { sentiment, reviewer, note },
      }),
    });
    setStatus(response.ok ? "saved" : "error");
    if (response.ok) setNote("");
  }

  return (
    <form
      onSubmit={submitFeedback}
      data-feedback-event="manager_feedback"
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-gray-950">{copy.title}</h2>
        <select
          value={sentiment}
          onChange={(event) => setSentiment(event.target.value as Sentiment)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-gray-950"
        >
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option[locale]}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
        <label className="text-xs font-medium text-gray-500">
          {copy.reviewer}
          <input
            value={reviewer}
            onChange={(event) => setReviewer(event.target.value)}
            placeholder={copy.reviewerPlaceholder}
            className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-800 outline-none focus:border-gray-950"
          />
        </label>
        <label className="text-xs font-medium text-gray-500">
          {copy.note}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={copy.notePlaceholder}
            rows={3}
            className="mt-1 w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-950"
            required
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className={`text-xs ${status === "error" ? "text-red-600" : "text-gray-500"}`}>
          {status === "saved" ? copy.saved : status === "error" ? copy.error : ""}
        </p>
        <button
          type="submit"
          disabled={status === "saving" || !note.trim()}
          className="inline-flex h-10 items-center justify-center rounded-full bg-gray-950 px-4 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {status === "saving" ? copy.saving : copy.submit}
        </button>
      </div>
    </form>
  );
}
