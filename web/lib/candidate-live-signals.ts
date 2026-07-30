import { createClient } from "@insforge/sdk";
import {
  buildCandidateLiveSignalUpsertRows,
  normalizeCandidateLiveSignal,
} from "./candidate-live-signals.mjs";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
const TABLE = "candidate_live_signals";
const client = BASE && KEY ? createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }) : null;

export interface CandidateLiveSignal {
  id: string;
  user_id: string;
  project_id: string;
  candidate_merge_key: string;
  provider: string;
  type: string;
  source_url: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  observed_at: string;
  expires_at: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

function mapSignal(value: Record<string, unknown>): CandidateLiveSignal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const normalized = normalizeCandidateLiveSignal(value);
  if (!normalized) return null;
  return {
    id: String(value.id ?? ""),
    ...normalized,
    confidence: normalized.confidence as CandidateLiveSignal["confidence"],
    created_at: String(value.created_at ?? ""),
    updated_at: String(value.updated_at ?? ""),
  };
}

export async function upsertCandidateLiveSignals(signals: unknown[]): Promise<CandidateLiveSignal[]> {
  if (!client) return [];
  const rows = buildCandidateLiveSignalUpsertRows(signals);
  if (!rows.length) return [];
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .upsert(rows, { onConflict: "user_id,project_id,provider,candidate_merge_key,source_url,content_hash" })
      .select("*");
    if (error || !data) return [];
    return data
      .map((row) => mapSignal(row as Record<string, unknown>))
      .filter((row): row is CandidateLiveSignal => Boolean(row));
  } catch {
    return [];
  }
}

export async function listActiveCandidateLiveSignals(input: {
  userId: string;
  projectId: string;
  now?: string;
}): Promise<CandidateLiveSignal[]> {
  if (!client || !input || !input.userId || !input.projectId) return [];
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("*")
      .eq("user_id", input.userId)
      .eq("project_id", input.projectId)
      .gt("expires_at", input.now || new Date().toISOString())
      .order("observed_at", { ascending: false });
    if (error || !data) return [];
    return data
      .map((row) => mapSignal(row as Record<string, unknown>))
      .filter((row): row is CandidateLiveSignal => Boolean(row));
  } catch {
    return [];
  }
}
