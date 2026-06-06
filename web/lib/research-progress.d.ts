export type ResearchProgressFeedItem = { id?: number; kind?: string; info?: string };
export type ResearchProgressLive = { searches?: number; fetches?: number } | null;
export type ResearchProgressEventView = { id: number; kind: string; label: string; detail: string };
export type ResearchProgressView = {
  statsText: string;
  active: ResearchProgressEventView | null;
  timeline: ResearchProgressEventView[];
};
export function buildResearchProgressView(input?: { feed?: ResearchProgressFeedItem[]; live?: ResearchProgressLive; locale?: "zh" | "en" | string }): ResearchProgressView;
