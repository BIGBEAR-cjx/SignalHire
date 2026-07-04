export type TwoSidedMessageHistory = {
  summary: {
    outbound: number;
    inbound: number;
    system: number;
    total: number;
  };
  messages: Array<{
    id: string;
    direction: "outbound" | "inbound" | "system";
    status: string;
    subject: string;
    body: string;
    at: string;
    source: string;
  }>;
};

export function buildTwoSidedMessageHistory(input?: {
  outreachThread?: unknown;
  inboxThread?: unknown;
  gmailMessages?: unknown[];
  actorEmail?: string;
}): TwoSidedMessageHistory;
