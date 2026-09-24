/* ===========================================================================
   /theme — DESIGN TOKENS
   Phia, Edwin's design system ("Phia by Edwin"). Values are the primitive and
   semantic tokens from its colors_and_type.css. Every colour in the app is
   read from here, so the whole dashboard re-themes from this one object.

   The key names predate Phia and are kept so that no call site changes:
   `navy` is Phia blue-800, `warn` is Phia red-600, `good` is green-500.
=========================================================================== */
export const T = {
  // Brand blue ramp
  blue: "#017ACC", // blue-600 — THE Edwin blue
  blue100: "#EDF6FC", // subtle fills, selected items, info backgrounds
  blue200: "#C3DBEA",
  blue300: "#B1E3FF",
  navy: "#004D80", // blue-800 — hover/press on blue, release markers

  // Neutrals (warm grey ramp; never pure black)
  ink: "#2A2A2A", // neutral-900 — headings, strong text
  soft: "#4A4A4A", // neutral-700 — body text
  muted: "#7C7C7C", // neutral-500 — secondary text
  faint: "#BCBCBC", // neutral-300 — disabled, field outlines
  border: "#E1E1E1", // neutral-100 — hairline borders
  subtle: "#F1F1F1", // neutral-50 — table heads, alt rows, segmented tracks
  bg: "#FEFDFB", // neutral-25 — the off-white canvas
  surface: "#FFFFFF",

  // Semantic accents
  warn: "#D5401B", // red-600 — negative change, warnings
  error: "#DF313C", // red-500
  good: "#189E4E", // green-500 — positive change
  caution: "#8A5A1D", // warning text on the warning tint
  goodBg: "#E8F6EC",
  warnBg: "#FDEBEC",
  cautionBg: "#FFF4E1",

  // Data viz
  baseline: "#829394", // neutral-400 — the dotted last-year line
  logins: "#8686FC", // violet-500 — new logged-in teachers, the second trend line

  // Elevation (soft grey/blue, low opacity)
  shadowXs: "0 1px 2px rgba(74,74,74,0.08)",
  shadowSm: "0 2px 4px rgba(74,74,74,0.12)",
  shadowMd: "0 4px 10px rgba(74,74,74,0.16)",
  shadowLg: "0 8px 24px rgba(74,74,74,0.18)",
  shadowBrand: "0 4px 12px rgba(1,122,204,0.25)",

  font: "'Source Sans Pro', 'Source Sans 3', 'Open Sans', -apple-system, 'Segoe UI', sans-serif",
  fontUI: "Inter, 'Source Sans Pro', sans-serif",
} as const;

/** Numbers and data render in Inter with tabular figures, per Phia. */
export const num = { fontFamily: T.fontUI, fontVariantNumeric: "tabular-nums" } as const;

/** The small uppercase label Phia allows for eyebrows, KPI names and table heads. */
export const eyebrow = {
  color: T.muted,
  fontFamily: T.fontUI,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
} as const;
