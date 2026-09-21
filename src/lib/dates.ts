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

export const fmtShort = (s: string): string =>
  fromIso(s).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
