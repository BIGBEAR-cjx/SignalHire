import { createClient } from "@insforge/sdk";
import { buildInboxQueue, mergeInboxThreadsWithDueFollowUps } from "./inbox-agent.mjs";
import { syncGmailInboxForProjectCore } from "./inbox-sync-core.mjs";
import { getGmailConnectionStatus, getGmailThreadMessages, type GmailThreadMessage } from "./gmail";
import { listOutreachThreads, updateOutreachThread, type OutreachThread } from "./outreach-threads";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
const client = BASE && KEY ? createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }) : null;
const TABLE = "inbox_threads";

export type InboxThread = {
  id: string;
  user_id: string;
  project_id: string | null;
  outreach_thread_id: string | null;
  shortlist_item_id: string | null;
  candidate_name: string;
  gmail_thread_id: string;
  gmail_message_id: string;
  classification: string;
  classification_reason: string;
  last_message_excerpt: string;
  suggested_reply: string;
  raw_payload: unknown;
  created_at: string;
  updated_at: string;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function listRoleRelatedOutreachThreads(input: { userId: string; projectId: string }): Promise<OutreachThread[]> {
  const threads = await listOutreachThreads({ userId: input.userId, projectId: input.projectId });
  return threads.filter((thread) => cleanString(thread.gmail_thread_id));
}

async function findInboxThread(input: { userId: string; gmailThreadId: string }): Promise<InboxThread | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("*")
      .eq("user_id", input.userId)
      .eq("gmail_thread_id", input.gmailThreadId)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return (data as InboxThread[])[0];
  } catch {
    return null;
  }
}

async function saveInboxThread(input: {
  userId: string;
  projectId: string;
  outreachThread: OutreachThread;
  message: GmailThreadMessage;
  classification: {
    classification: string;
    classification_reason: string;
    last_message_excerpt: string;
    suggested_reply: string;
  };
}) {
  if (!client) return null;
  const row = {
    project_id: input.projectId,
    outreach_thread_id: input.outreachThread.id,
    shortlist_item_id: input.outreachThread.shortlist_item_id,
    candidate_name: input.outreachThread.candidate_name,
    gmail_thread_id: input.outreachThread.gmail_thread_id,
    gmail_message_id: input.message.id,
    classification: input.classification.classification,
    classification_reason: input.classification.classification_reason,
    last_message_excerpt: input.classification.last_message_excerpt,
    suggested_reply: input.classification.suggested_reply,
    raw_payload: input.message,
    updated_at: new Date().toISOString(),
  };
  try {
    const existing = await findInboxThread({ userId: input.userId, gmailThreadId: input.outreachThread.gmail_thread_id });
    const query = existing
      ? client.database.from(TABLE).update(row).eq("id", existing.id).eq("user_id", input.userId)
      : client.database.from(TABLE).insert({ user_id: input.userId, ...row });
    const { data, error } = await query.select("*");
    if (error || !data || data.length === 0) return null;
    return (data as InboxThread[])[0];
  } catch {
    return null;
  }
}

export async function listInboxThreads(input: { userId: string; projectId: string }): Promise<InboxThread[]> {
  if (!client) return [];
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("*")
      .eq("user_id", input.userId)
      .eq("project_id", input.projectId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error || !data) return [];
    return data as InboxThread[];
  } catch {
    return [];
  }
}

export async function buildProjectInboxQueueView(userId: string, projectId: string) {
  const threads = await listInboxThreads({ userId, projectId });
  const outreachThreads = await listOutreachThreads({ userId, projectId });
  const outreachById = new Map(outreachThreads.map((thread) => [thread.id, thread]));
  const mergedThreads = threads.map((thread) => {
    const outreach = thread.outreach_thread_id ? outreachById.get(thread.outreach_thread_id) : null;
    return {
      ...thread,
      action_notes: outreach?.notes ?? "",
      outreach_status: outreach?.status ?? "",
      next_follow_up_at: outreach?.next_follow_up_at ?? null,
      candidate_snapshot: outreach?.candidate_snapshot ?? {},
      sequence_messages: outreach?.sequence_messages ?? [],
      role_brief: outreach?.role_brief ?? "",
    };
  });
  return buildInboxQueue({
    threads: mergeInboxThreadsWithDueFollowUps({
      inboxThreads: mergedThreads as never[],
      outreachThreads: outreachThreads as never[],
    }) as never[],
  });
}

export async function syncGmailInboxForProject(input: { userId: string; projectId: string; roleBrief?: string }) {
  return syncGmailInboxForProjectCore(({
    userId: input.userId,
    projectId: input.projectId,
    roleBrief: input.roleBrief,
    getGmailConnectionStatus,
    listRoleRelatedOutreachThreads,
    getGmailThreadMessages,
    saveInboxThread,
    updateOutreachThread,
  }) as never);
}
