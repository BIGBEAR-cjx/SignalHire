function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanLower(value) {
  return cleanString(value).toLowerCase();
}

function cleanList(value) {
  if (Array.isArray(value)) return value.map(cleanString).filter(Boolean);
  const single = cleanString(value);
  return single ? [single] : [];
}

function normalizeLinkedInUrl(value) {
  const clean = cleanString(value).toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  const match = clean.match(/linkedin\.com\/in\/[^/]+/);
  return match?.[0] ?? "";
}

function unique(values) {
  const seen = new Set();
  const out = [];
  for (const value of values.map(cleanString).filter(Boolean)) {
    const key = cleanLower(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function splitSeedCell(value) {
  return cleanString(value).split(/[;,]/).map(cleanString).filter(Boolean);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(text ?? "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (char === "\"") {
      if (quoted && next === "\"") {
        cell += "\"";
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => cleanString(value))) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => cleanString(value))) rows.push(row);
  return rows;
}

function schoolsFrom(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (isRecord(item)) return cleanList(item.school || item.name || item.institution);
      return cleanList(item);
    });
  }
  return cleanList(value);
}

function projectsFrom(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (isRecord(item)) return cleanList(item.project || item.name || item.title);
      return cleanList(item);
    });
  }
  return cleanList(value);
}

export function normalizeNetworkSeed(seed = {}) {
  const source = isRecord(seed) ? seed : {};
  return {
    label: cleanString(source.label || source.name || source.introducer || "Network seed"),
    relation: cleanString(source.relation || source.path_type || ""),
    linkedin_url: normalizeLinkedInUrl(source.linkedin_url || source.linkedin || source.url),
    companies: unique([
      ...cleanList(source.company),
      ...cleanList(source.current_company),
      ...cleanList(source.companies),
    ]),
    schools: unique([
      ...schoolsFrom(source.school),
      ...schoolsFrom(source.schools),
      ...schoolsFrom(source.education),
    ]),
    projects: unique([
      ...projectsFrom(source.project),
      ...projectsFrom(source.projects),
    ]),
  };
}

export function parseNetworkSeedCsv(text = "") {
  const rows = parseCsv(text);
  const headers = (rows.shift() ?? []).map((header) => cleanLower(header).replace(/\s+/g, "_"));
  if (headers.length === 0) return [];
  const seeds = rows.map((row) => {
    const source = {};
    headers.forEach((header, index) => {
      const value = cleanString(row[index]);
      if (!value) return;
      if (["name", "label", "introducer"].includes(header)) source.name = value;
      if (["relation", "path_type"].includes(header)) source.relation = value;
      if (["linkedin_url", "linkedin", "url"].includes(header)) source.linkedin_url = value;
      if (["company", "current_company", "companies"].includes(header)) source.companies = splitSeedCell(value);
      if (["school", "schools", "education"].includes(header)) source.schools = splitSeedCell(value);
      if (["project", "projects"].includes(header)) source.projects = splitSeedCell(value);
    });
    return normalizeNetworkSeed(source);
  });
  return seeds.filter((seed) => seed.linkedin_url || seed.companies.length || seed.schools.length || seed.projects.length);
}

function normalizeCandidate(candidate = {}) {
  const source = isRecord(candidate) ? candidate : {};
  const links = isRecord(source.links) ? source.links : {};
  const contactProfile = isRecord(source.contact_profile) ? source.contact_profile : {};
  return {
    id: cleanString(source.id || source.candidate_id || source.name),
    name: cleanString(source.name || source.candidate_name || "Unknown candidate"),
    linkedin_url: normalizeLinkedInUrl(source.linkedin_url || links.linkedin || contactProfile.linkedin_url),
    companies: unique([
      ...cleanList(source.company),
      ...cleanList(source.current_company),
      ...cleanList(source.companies),
    ]),
    schools: unique([
      ...schoolsFrom(source.school),
      ...schoolsFrom(source.schools),
      ...schoolsFrom(source.education),
    ]),
    projects: unique([
      ...projectsFrom(source.project),
      ...projectsFrom(source.projects),
    ]),
  };
}

function intersects(left, right) {
  const rightKeys = new Set(right.map(cleanLower));
  return left.find((value) => rightKeys.has(cleanLower(value))) || "";
}

function introSnippet({ candidateName, seedLabel, context, locale }) {
  if (locale === "zh") {
    return `可以请 ${seedLabel} 基于 ${context} 帮忙判断是否适合引荐 ${candidateName}。`;
  }
  return `Could ${seedLabel} sanity-check a warm intro to ${candidateName} based on ${context}?`;
}

function path({ type, candidate, seed, context, confidence = "medium", locale }) {
  return {
    path_type: type,
    shared_context: type === "manual_seed"
      ? (locale === "zh" ? `用户提供了 ${candidate.name} 的 LinkedIn 线索。` : `User provided a manual LinkedIn seed for ${candidate.name}.`)
      : (locale === "zh" ? `${seed.label} 和 ${candidate.name} 可能有共同背景：${context}。` : `${seed.label} and ${candidate.name} may have shared context: ${context}.`),
    introducer_label: seed.label,
    confidence,
    intro_snippet: introSnippet({ candidateName: candidate.name, seedLabel: seed.label, context, locale }),
    client_safe: true,
  };
}

function pathsForCandidate(candidate, seeds, locale) {
  const rows = [];
  for (const seed of seeds) {
    if (candidate.linkedin_url && seed.linkedin_url && candidate.linkedin_url === seed.linkedin_url) {
      rows.push(path({
        type: "manual_seed",
        candidate,
        seed,
        context: "manual LinkedIn seed",
        confidence: "high",
        locale,
      }));
    }

    const company = intersects(candidate.companies, seed.companies);
    if (company) {
      rows.push(path({
        type: "shared_company",
        candidate,
        seed,
        context: company,
        confidence: "medium",
        locale,
      }));
    }

    const school = intersects(candidate.schools, seed.schools);
    if (school) {
      rows.push(path({
        type: "shared_school",
        candidate,
        seed,
        context: school,
        confidence: "medium",
        locale,
      }));
    }

    const project = intersects(candidate.projects, seed.projects);
    if (project) {
      rows.push(path({
        type: "shared_project",
        candidate,
        seed,
        context: project,
        confidence: "medium",
        locale,
      }));
    }
  }

  const priority = { manual_seed: 0, shared_company: 1, shared_school: 2, shared_project: 3, known_candidate: 4 };
  const seen = new Set();
  return rows
    .sort((a, b) => (priority[a.path_type] ?? 9) - (priority[b.path_type] ?? 9))
    .filter((item) => {
      const key = `${item.path_type}:${cleanLower(item.shared_context)}:${cleanLower(item.introducer_label)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 2);
}

export function buildReferralPathViews({ candidates = [], networkSeeds = [], locale = "zh" } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const seeds = (Array.isArray(networkSeeds) ? networkSeeds : []).map(normalizeNetworkSeed).filter((seed) => (
    seed.linkedin_url || seed.companies.length || seed.schools.length || seed.projects.length
  ));
  if (seeds.length === 0) return [];

  return (Array.isArray(candidates) ? candidates : []).map(normalizeCandidate).map((candidate) => ({
    candidate_id: candidate.id,
    candidate_name: candidate.name,
    paths: pathsForCandidate(candidate, seeds, normalizedLocale),
  })).filter((view) => view.paths.length > 0);
}
