import { createClient } from "@insforge/sdk";
import {
  buildOutreachQueue,
  buildOutreachThreadDraft,
  normalizeOutreachThreadPatch,
} from "./outreach-threads.mjs";
import { buildContactProfile } from "./contact-profile.mjs";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
const client = BASE && KEY ? createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }) : null;
const TABLE = "outreach_threads";

export interface OutreachThread {
  id: string;
  user_id: string;
  project_id: string | null;
  shortlist_item_id: string | null;
  candidate_name: string;
  candidate_snapshot: unknown;
  tone: string;
  role_brief: string;
  subject: string;
  body: string;
  status: string;
  notes: string;
  contact_profile: unknown;
  sequence_messages: unknown;
  approved_at: string | null;
  sent_at: string | null;
  gmail_message_id: string;
  gmail_thread_id: string;
  send_error: string;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function ensureOutreachRelationshipAccess(input: {
  userId: string;
  projectId?: string | null;
  shortlistItemId?: string | null;
}): Promise<boolean> {
  if (!client) return false;
  try {
    if (input.projectId) {
      const { data, error } = await client.database
        .from("projects")
        .select("id")
        .eq("id", input.projectId)
        .eq("user_id", input.userId)
        .limit(1);
      if (error || !data || data.length === 0) return false;
    }

    if (input.shortlistItemId) {
      const { data, error } = await client.database
        .from("shortlist_items")
        .select("id,project_id")
        .eq("id", input.shortlistItemId)
        .eq("user_id", input.userId)
        .limit(1);
      if (error || !data || data.length === 0) return false;
      const shortlistProjectId = (data[0] as { project_id?: string | null }).project_id ?? null;
      if (shortlistProjectId !== (input.projectId ?? null)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function listOutreachThreads(input: {
  userId: string;
  projectId?: string | null;
  shortlistItemId?: string | null;
}): Promise<OutreachThread[]> {
  if (!client) return [];
  try {
    let query = client.database
      .from(TABLE)
      .select("*")
      .eq("user_id", input.userId);
    if (input.projectId) query = query.eq("project_id", input.projectId);
    if (input.shortlistItemId) query = query.eq("shortlist_item_id", input.shortlistItemId);
    const { data, error } = await query.order("updated_at", { ascending: false }).limit(200);
    if (error || !data) return [];
    return data as OutreachThread[];
  } catch {
    return [];
  }
}

export async function listOutreachQueue(input: { userId: string; projectId?: string | null }) {
  const threads = await listOutreachThreads(input);
  return buildOutreachQueue({ threads: threads as never[] });
}

export async function getOutreachThread(input: { userId: string; id: string }): Promise<OutreachThread | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("*")
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return (data as OutreachThread[])[0];
  } catch {
    return null;
  }
}

export async function createOutreachThread(input: {
  userId: string;
  projectId?: string | null;
  shortlistItemId?: string | null;
  candidate: unknown;
  tone?: string;
  roleBrief?: string;
  subject: string;
  body: string;
  status?: string;
  nextFollowUpAt?: string | null;
}): Promise<OutreachThread | null> {
  if (!client) return null;
  if (!(await ensureOutreachRelationshipAccess({
    userId: input.userId,
    projectId: input.projectId,
    shortlistItemId: input.shortlistItemId,
  }))) return null;
  const candidate = typeof input.candidate === "object" && input.candidate !== null
    ? { ...(input.candidate as Record<string, unknown>), contact_profile: buildContactProfile(input.candidate as never) }
    : { contact_profile: buildContactProfile(input.candidate as never) };
  const draft = buildOutreachThreadDraft({
    candidate,
    shortlistItemId: input.shortlistItemId ?? null,
    projectId: input.projectId ?? null,
    tone: input.tone ?? "professional",
    roleBrief: input.roleBrief ?? "",
    generatedDraft: { subject: input.subject, body: input.body },
    status: input.status ?? "drafted",
    nextFollowUpAt: input.nextFollowUpAt ?? null,
  } as never) as Record<string, unknown>;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .insert({ user_id: input.userId, ...draft })
      .select("*");
    if (error || !data || data.length === 0) return null;
    return (data as OutreachThread[])[0];
  } catch {
    return null;
  }
}

export async function updateOutreachThread(input: {
  userId: string;
  id: string;
  status?: string;
  subject?: string;
  body?: string;
  notes?: string;
  contact_profile?: unknown;
  sequence_messages?: unknown;
  next_follow_up_at?: string | null;
  last_contacted_at?: string | null;
  approved_at?: string | null;
  sent_at?: string | null;
  gmail_message_id?: string;
  gmail_thread_id?: string;
  send_error?: string;
}): Promise<OutreachThread | null> {
  if (!client) return null;
  const patch = normalizeOutreachThreadPatch(input);
  if (Object.keys(patch).length === 0) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*");
    if (error || !data || data.length === 0) return null;
    return (data as OutreachThread[])[0];
  } catch {
    return null;
  }
}
