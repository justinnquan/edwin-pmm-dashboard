/* ===========================================================================
   /analytics — FORMATTERS
=========================================================================== */

export const pct = (v: number | null | undefined): string =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

export const int = (v: number | null | undefined): string =>
  v == null ? "—" : Math.round(v).toLocaleString("en-CA");

/** Unsigned magnitude, for thresholds and bars rather than changes. `pct` is a
    signed delta formatter and renders a threshold as "+5.0%", which reads as a
    movement rather than a bar. */
export const pctAbs = (v: number | null | undefined): string =>
  v == null ? "—" : `${(Math.abs(v) * 100).toFixed(1)}%`;
