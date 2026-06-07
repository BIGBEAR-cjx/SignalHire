---
name: SignalHire
description: Evidence-first AI talent search workspace for HR and recruiters.
colors:
  canvas: "#f5f5f7"
  ink: "#1d1d1f"
  muted: "#6e6e73"
  faint: "#86868b"
  line: "#00000014"
  surface: "#ffffffd1"
  surface-strong: "#ffffff"
  primary-blue: "#0071e3"
  primary-blue-hover: "#0077ed"
  verified-bg: "#ecfdf5"
  verified-text: "#047857"
  warning-bg: "#fffbeb"
  warning-text: "#b45309"
  danger-bg: "#fef2f2"
  danger-text: "#b91c1c"
typography:
  display:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.primary-blue}"
    textColor: "{colors.surface-strong}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-blue-hover}"
    textColor: "{colors.surface-strong}"
    rounded: "{rounded.pill}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
    height: "40px"
  surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  status-verified:
    backgroundColor: "{colors.verified-bg}"
    textColor: "{colors.verified-text}"
    rounded: "{rounded.pill}"
  status-warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning-text}"
    rounded: "{rounded.pill}"
  status-danger:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger-text}"
    rounded: "{rounded.pill}"
---

# Design System: SignalHire

## 1. Overview

**Creative North Star: "The Evidence Desk"**

SignalHire is a product UI for investigative recruiting. The surface should feel like a calm evidence desk: quiet enough for repeated HR work, sharp enough to make judgment calls, and transparent enough that a recruiter can explain every shortlist decision.

The original hackathon direction still matters: the memorable moment is not finding hundreds of people, it is showing a candidate claim, checking it against public sources, and revealing whether it is verified, unsupported, or contradicted. The current product has expanded from a demo into a Next.js workspace with search, verification, projects, shortlist, history, share reports, queue status, and worker-backed live research.

Default register is product, even though the public landing page also needs demo appeal. Product decisions should optimize clarity, trust, and repeatable workflow over spectacle.

**Key Characteristics:**
- Evidence-first hierarchy: source links, claims, confidence, and red flags are more important than decorative metrics.
- Restrained light system: soft canvas, white surfaces, near-black ink, one blue action color, semantic verdict colors.
- Dense but readable workspace: panels and cards can be information-rich, but every cluster must make the next recruiting action clear.
- Explicit uncertainty: unverified and contradicted claims are useful states, not failures to hide.

## 2. Colors

The palette is a restrained light product system: cool Apple-like canvas, white translucent surfaces, near-black ink, one blue action accent, and semantic evidence colors.

### Primary
- **Action Blue** (#0071e3): Primary actions, active links, loading indicators, and selected navigation when the action needs user momentum.
- **Action Blue Hover** (#0077ed): Hover state for primary buttons and high-confidence action affordances.

### Neutral
- **Canvas Gray** (#f5f5f7): Page background and full app shell.
- **Ink Black** (#1d1d1f): Headings, labels, primary data, and strong controls.
- **Muted Gray** (#6e6e73): Secondary explanatory text, panel descriptions, metadata.
- **Faint Gray** (#86868b): Placeholder text, low-priority hints, subdued timestamps.
- **Hairline Black** (#00000014): Borders and dividers. Use as full borders, not colored side stripes.
- **Glass Surface** (#ffffffd1): Main card and shell surface, usually paired with `backdrop-filter`.
- **Strong Surface** (#ffffff): Inputs, focused surfaces, high-priority panels.

### Tertiary
- **Verified Green** (#ecfdf5 / #047857): Verified claims, successful coverage, strong source confidence.
- **Warning Amber** (#fffbeb / #b45309): Unverified claims, weak coverage, needs follow-up.
- **Contradiction Red** (#fef2f2 / #b91c1c): Contradicted claims, red flags, blocking risk.

### Named Rules

**The One Action Color Rule.** Blue is for actions and selection, not decoration. If a panel is not clickable or selected, it should not borrow primary blue for flair.

**The Evidence Color Rule.** Green, amber, and red only describe evidence states. Do not use them as generic brand accents.

**The Full-Border Rule.** Use complete borders, rings, icons, badges, and subtle backgrounds for emphasis. Do not use thick `border-left` or `border-right` accent strips.

## 3. Typography

**Display Font:** Geist Sans with Apple/system and Chinese UI fallbacks.
**Body Font:** Geist Sans with Apple/system and Chinese UI fallbacks.
**Label/Mono Font:** Geist Mono only for code-like queries, source snippets, IDs, and live research traces.

**Character:** Product-first, precise, and compact. The type should feel like a professional operating surface, not a campaign poster.

### Hierarchy
- **Display** (600, 48-60px, 1.04): Landing hero and rare first-screen messages. Keep letter spacing no tighter than `-0.025em`.
- **Headline** (600, 36-48px, 1.15): Page introductions and major workspace screens.
- **Title** (600, 20-24px, 1.3): Panel titles, report section headers, and card titles.
- **Body** (400, 15-16px, 1.6-1.75): Explanatory copy, report summaries, candidate rationale. Keep prose around 65-75ch when it is not table data.
- **Label** (600, 12-14px, 1.4): Buttons, badges, tabs, field labels, dense metadata. Uppercase labels are allowed only for short system categories.

### Named Rules

**The Product Scale Rule.** Inside the app, use fixed rem/text sizes and tight hierarchy. Avoid fluid `clamp()` typography in dashboards, tables, sidebars, and dense panels.

**The Evidence Copy Rule.** Write specific nouns and verbs: "claim verified by 3 sources" beats generic confidence language.

## 4. Elevation

SignalHire uses a hybrid of tonal layering, thin borders, and restrained shadows. Depth should clarify hierarchy: app shell, surfaces, modals, and hover states. It should not make every repeated card float.

### Shadow Vocabulary
- **Surface Ambient** (`0 20px 60px rgba(0, 0, 0, 0.05)`): Main `.sh-surface` containers. Use with a full 1px border.
- **Button Lift** (`0 12px 30px rgba(0, 113, 227, 0.24)`): Primary action buttons only.
- **Large Demo Surface** (`0 28px 90px rgba(0, 0, 0, 0.10)`): Public landing hero visual or modal-grade framed experiences.
- **Hover Lift** (`0 24px 68px rgba(0, 0, 0, 0.10)`): Occasional clickable report cards; never required for every list row.

### Named Rules

**The Structural Shadow Rule.** A shadow must explain layering or interaction. If it only makes a card feel more "designed", remove it or use a simple ring.

**The No Ghost Card Rule.** Avoid combining a decorative 1px border with a broad soft shadow on repeated cards. Dense product grids should usually use border plus tonal surface.

## 5. Components

### Buttons
- **Shape:** Pill (`999px`) for primary and secondary actions.
- **Primary:** Action Blue background, white text, 40px minimum height, `10px 16px` default padding, 600 weight.
- **Hover / Focus:** Blue hover shift, light translate-up on pointer hover, visible browser focus. Do not remove outlines unless replacing them with a high-contrast focus ring.
- **Secondary:** Translucent white background, hairline border, ink text, same height and typography as primary.
- **Disabled / Loading:** Maintain dimensions; use opacity for disabled and keep loading state near the action text or in the containing panel.

### Chips
- **Style:** Pill, 12px label, 1px ring, semantic or neutral background.
- **State:** Selected chips use near-black fill and white text. Unselected chips use white or neutral fill with muted text.
- **Evidence chips:** Verified, warning, and danger chips must include both text and icon or context; do not rely on color alone.

### Cards / Containers
- **Corner Style:** Shared `.sh-surface` uses 24px. Repeated dense cards should prefer 12-16px; hero or modal-grade containers may use 24px only when they are large.
- **Background:** `Glass Surface` or `Strong Surface` over `Canvas Gray`.
- **Shadow Strategy:** Follow Elevation. Repeated rows should prefer border/ring and light tonal separation.
- **Border:** `1px solid var(--sh-line)` or Tailwind `ring-black/5` / `border-black/10`.
- **Internal Padding:** 16px for dense cards, 20-24px for panels, 32px only for empty states or marketing sections.

### Inputs / Fields
- **Style:** White or translucent white fill, 1px neutral border, 12-18px radius depending on size.
- **Focus:** Border shifts to Action Blue or ink; background becomes white.
- **Error / Disabled:** Red text/background only for error state, not warning or empty content. Disabled should preserve contrast and clearly reduce interactivity.
- **Planning textareas:** When using tinted green, blue, or red backgrounds, text must use the same hue family at a dark value, not generic gray.

### Navigation
- **Desktop app:** Left sidebar at 216px, glass-white background, border-right hairline, icon + text nav items.
- **Mobile app:** Top bar plus bottom nav. Targets should stay close to 44px high.
- **Active state:** Near-black filled item or Action Blue icon/text, depending on surface. Use one active grammar per navigation region.
- **Public landing:** Sticky pill nav is acceptable as a brand/demo affordance, but app surfaces should stay utilitarian.

### Evidence Panels
- **Claim block:** Full border plus subtle semantic background. No side-tab accent borders.
- **Verdict badge:** Icon + label + semantic color.
- **Source link:** Small neutral pill or favicon row. Keep URL evidence visible and clickable.
- **Share report fallback:** If report data is missing, show a calm empty/error state with a recovery link. Do not imply the candidate was evaluated if the record is absent.

## 6. Do's and Don'ts

### Do:
- **Do** lead every result page with what was searched, who was found, what was verified, and what needs follow-up.
- **Do** use `var(--sh-*)` tokens or documented Tailwind semantic classes before introducing new one-off colors.
- **Do** keep verdict colors tied to evidence states: verified, unverified, contradicted.
- **Do** preserve the current light-only posture unless there is a real dark-mode implementation across every surface.
- **Do** make uncertainty visible with copy, badges, source counts, and next-step recommendations.
- **Do** use skeletons, queued/running states, and progress details for long research jobs so latency becomes understandable.
- **Do** retain the original product story in demos: SignalHire is not a resume volume tool, it is a claim-verification and talent-search workspace.

### Don't:
- **Don't** make SignalHire look like a traditional resume database, ATS back office, generic purple-blue SaaS template, or complex BI dashboard.
- **Don't** show broad lists of names without reasoning, evidence, or confidence.
- **Don't** use thick colored side borders (`border-left` or `border-right` greater than 1px) as card accents.
- **Don't** use gradient text, decorative glassmorphism, repeated hero metric cards, or identical icon-card grids as default page structure.
- **Don't** use gray text on colored backgrounds; use a darker shade of the same hue family.
- **Don't** use semantic red, amber, or green as decoration. They must mean evidence state.
- **Don't** let the landing page become more important than the product workflow. Demo appeal should reveal real output, not hide the tool.
