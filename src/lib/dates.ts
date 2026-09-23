/* ===========================================================================
   /lib — DATE UTILITIES
   Pure calendar arithmetic with no knowledge of Edwin, the synthetic
   generator, or the seasonal model.

   These used to live in `src/data/calendar.ts` alongside the seasonal anchors,
   the deterministic RNG and the provisioned-seat curve — all of which are
   generator ground truth. Sharing a file made the ground-truth barrier
   unreadable: every layer that legitimately needed `addDays` had to import
   from the one module it was least allowed to touch. Splitting them lets the
   barrier be enforced mechanically.
=========================================================================== */

export const DAY = 86400000;

/** UTC calendar day as `YYYY-MM-DD`. Every date key in the app is UTC, so a
    reviewer in Vancouver and a reviewer in Halifax see the same buckets. */
export const iso = (d: Date): string => d.toISOString().slice(0, 10);

export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY);

export const daysBetween = (a: Date, b: Date): number =>
  Math.round((b.getTime() - a.getTime()) / DAY);

/** Parse a `YYYY-MM-DD` key back to a UTC date. */
export const fromIso = (s: string): Date => new Date(s + "T00:00:00Z");

/** "Sep 10, 2025". Every date a reader sees carries its year: the dashboard
    spans school years, and "Sep 10" alone no longer says which one. */
export const fmtShort = (s: string): string =>
  fromIso(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "Sep 10 '25" — compact enough for chart axis ticks. */
export const fmtAxis = (s: string): string => {
  const d = fromIso(s);
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${md} '${String(d.getUTCFullYear()).slice(2)}`;
};

/** "Aug 1 – Sep 22, 2026", or "Aug 3, 2025 – Jun 30, 2026" across years. */
export const fmtRange = (from: string, to: string): string => {
  const a = fromIso(from);
  const b = fromIso(to);
  const md = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return a.getUTCFullYear() === b.getUTCFullYear()
    ? `${md(a)} – ${fmtShort(to)}`
    : `${fmtShort(from)} – ${fmtShort(to)}`;
};

/* --- School years -----------------------------------------------------------
   A school year runs Aug 1 → Jun 30 and is labelled by its two calendar
   years, "2025/26". July belongs to the year that just ended: nothing is
   taught, and it is where summer's trough sits in last year's curve. */

/** The school year a date falls in, e.g. "2025/26". */
export function schoolYearOf(d: Date): string {
  const y = d.getUTCFullYear();
  const start = d.getUTCMonth() >= 7 ? y : y - 1; // Aug (7) onward starts a new year
  return `${start}/${String(start + 1).slice(2)}`;
}

/** First and last day of a school year label. */
export function schoolYearBounds(label: string): { from: string; to: string } {
  const start = Number(label.slice(0, 4));
  return { from: `${start}-08-01`, to: `${start + 1}-06-30` };
}

/** The school year before this one, e.g. "2025/26" → "2024/25". */
export function priorSchoolYear(label: string): string {
  const start = Number(label.slice(0, 4)) - 1;
  return `${start}/${String(start + 1).slice(2)}`;
}

/** Today as a UTC calendar day key. */
export const todayIso = (): string => iso(new Date());
