const TONE_LABELS = {
  friendly: "friendly",
  professional: "professional",
  short: "short",
  detailed: "detailed",
};

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value, limit = 20) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, limit) : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstName(name) {
  const clean = cleanString(name);
  return clean.split(/\s+/)[0] || "there";
}

function roleLine(candidate = {}) {
  return [candidate.current_role, candidate.current_company].map(cleanString).filter(Boolean).join(" at ");
}

function profileLabels(links = {}) {
  const labels = [];
  if (links.github) labels.push("GitHub");
  if (links.linkedin) labels.push("LinkedIn");
  if (links.scholar) labels.push("Scholar");
  if (links.huggingface) labels.push("Hugging Face");
  if (links.website) labels.push("Website");
  return labels;
}

function verifiedClaims(candidate = {}) {
  return (Array.isArray(candidate.claims) ? candidate.claims : [])
    .filter((claim) => cleanString(claim?.verdict).toLowerCase() === "verified")
    .map((claim) => cleanString(claim?.claim))
    .filter(Boolean)
    .slice(0, 5);
}

function evidenceLinks(candidate = {}) {
  const urls = [];
  for (const claim of Array.isArray(candidate.claims) ? candidate.claims : []) {
    if (cleanString(claim?.verdict).toLowerCase() !== "verified") continue;
    for (const evidence of Array.isArray(claim?.evidence) ? claim.evidence : []) {
      const url = cleanString(evidence?.url);
      if (url && !urls.includes(url)) urls.push(url);
    }
  }
  return urls.slice(0, 5);
}

export function buildOutreachEvidenceBrief(candidate = {}) {
  candidate = asObject(candidate);
  const proofPoints = [];
  for (const item of cleanStringArray(candidate.strongest_signals, 4)) {
    if (!proofPoints.includes(item)) proofPoints.push(item);
  }
  for (const item of verifiedClaims(candidate)) {
    if (!proofPoints.includes(item)) proofPoints.push(item);
  }
  return {
    candidate_name: cleanString(candidate.name) || "Candidate",
    contact_angle: cleanString(candidate.outreach_angle) || proofPoints[0] || cleanString(candidate.summary) || cleanString(candidate.headline),
    proof_points: proofPoints.slice(0, 6),
    evidence_links: evidenceLinks(candidate),
    risk_note: cleanStringArray(candidate.uncertainties, 1)[0] || "",
    public_profiles: profileLabels(candidate.links),
  };
}

export function buildEvidenceDrivenOutreachDraft({ candidate = {}, tone = "professional", senderName = "", roleBrief = "" } = {}) {
  candidate = asObject(candidate);
  const evidence = buildOutreachEvidenceBrief(candidate);
  const name = evidence.candidate_name;
  const first = firstName(name);
  const role = roleLine(candidate);
  const sender = cleanString(senderName) || "[Your name]";
  const hiringContext = cleanString(roleBrief);
  const primaryProof = evidence.proof_points[0] || cleanString(candidate.summary) || cleanString(candidate.headline) || "your AI work";
  const secondaryProof = evidence.proof_points[1] || evidence.proof_points[0] || "";
  const subjectFocus = primaryProof.length > 42 ? "your AI work" : primaryProof;
  const subject = `${first}, quick note on ${subjectFocus}`.slice(0, 78);
  const contextLine = hiringContext
    ? `I am reaching out because we are looking for ${hiringContext}, and your background looks directly relevant.`
    : "I am reaching out about a role that looks closely aligned with your AI work.";
  const roleContext = role ? `I noticed you are ${role}. ` : "";
  const proofLine = secondaryProof && secondaryProof !== primaryProof
    ? `What stood out was ${primaryProof}, plus ${secondaryProof}.`
    : `What stood out was ${primaryProof}.`;
  const angleLine = evidence.contact_angle && evidence.contact_angle !== primaryProof
    ? `The reason I thought of you specifically: ${evidence.contact_angle}`
    : "";
  const close = "Would you be open to a short conversation this week or next?";
  const bodyByTone = {
    short: [
      `Hi ${first},`,
      "",
      `${contextLine} ${proofLine}`,
      close,
      "",
      sender,
    ],
    friendly: [
      `Hi ${first},`,
      "",
      `${roleContext}${proofLine}`,
      `${contextLine} ${angleLine}`.trim(),
      close,
      "",
      sender,
    ],
    detailed: [
      `Hi ${first},`,
      "",
      `${roleContext}${contextLine}`,
      "",
      proofLine,
      angleLine,
      "I wanted to reach out with a focused note rather than a generic recruiting message.",
      "",
      close,
      "",
      sender,
    ],
    professional: [
      `Hi ${first},`,
      "",
      `${contextLine}`,
      `${roleContext}${proofLine}`,
      angleLine,
      "",
      close,
      "",
      sender,
    ],
  };
  return {
    subject,
    body: (bodyByTone[TONE_LABELS[tone] ? tone : "professional"] || bodyByTone.professional)
      .filter((line) => line !== "")
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    evidence_brief: evidence,
  };
}

function sequenceEvidenceRefs(evidence) {
  const refs = [];
  for (const item of [...cleanStringArray(evidence?.proof_points, 3), cleanString(evidence?.contact_angle)]) {
    if (item && !refs.includes(item)) refs.push(item);
  }
  return refs.slice(0, 3);
}

export function buildEvidenceDrivenOutreachSequence({ candidate = {}, tone = "professional", senderName = "", roleBrief = "" } = {}) {
  const firstDraft = buildEvidenceDrivenOutreachDraft({ candidate, tone, senderName, roleBrief });
  const evidence = firstDraft.evidence_brief;
  const first = firstName(evidence.candidate_name);
  const sender = cleanString(senderName) || "[Your name]";
  const refs = sequenceEvidenceRefs(evidence);
  const proof = refs[0] || cleanString(evidence.contact_angle) || "your recent work";
  const roleContext = cleanString(roleBrief);
  const followUpContext = roleContext
    ? `I am following up because ${proof} still looks relevant for ${roleContext}.`
    : `I am following up because ${proof} still looks relevant to this search.`;
  const subject = `Re: ${firstDraft.subject || `${first}, quick note`}`.slice(0, 78);

  return [
    {
      step: 1,
      subject: firstDraft.subject,
      body: firstDraft.body,
      send_mode: "manual_approval_required",
      evidence_refs: refs,
    },
    {
      step: 2,
      subject,
      body: [
        `Hi ${first},`,
        "",
        followUpContext,
        "Would it be worth a short conversation?",
        "",
        sender,
      ].join("\n\n").trim(),
      send_mode: "draft_for_review",
      evidence_refs: refs,
      delay_days: 7,
    },
    {
      step: 3,
      subject,
      body: [
        `Hi ${first},`,
        "",
        "Last note from me. If the timing is not right, no problem.",
        `I reached out because ${proof}.`,
        "",
        sender,
      ].join("\n\n").trim(),
      send_mode: "draft_for_review",
      evidence_refs: refs,
      delay_days: 7,
    },
  ];
}
