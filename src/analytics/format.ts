/* ===========================================================================
   /analytics — FORMATTERS
=========================================================================== */

export const pct = (v: number | null | undefined): string =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

export const int = (v: number | null | undefined): string =>
  v == null ? "—" : Math.round(v).toLocaleString("en-CA");
