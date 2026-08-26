/* ===========================================================================
   /analytics — CALCULATION LAYER (series + seasonally-adjusted change)
   All gating and caveating lives in this layer so no component can render an
   ungated number by accident.
=========================================================================== */
import type { Filters, SeriesPoint, SummableMetric } from "../data/schema";
import { CELLS } from "../data/segments";
import { DATA } from "../data/generate";
import { addDays, iso, provisioned } from "../data/calendar";
import { YOY_LAG } from "./constants";

export function cellFilter(f: Filters): number[] {
  return CELLS.filter(
    (c) =>
      (f.province === "All" || c.province === f.province) &&
      (f.grade === "All" || c.grade === f.grade) &&
      (f.subject === "All" || c.subject === f.subject)
  ).map((c) => c.id);
}

// Sum a metric across selected cells on one date.
export function sumOn(dateKey: string, metric: SummableMetric, ids: number[]): number | null {
  const list = DATA.byDate.get(dateKey);
  if (!list) return null;
  let s = 0;
  for (const id of ids) s += list[id][metric];
  return s;
}

export function seriesFor(
  metric: SummableMetric,
  ids: number[],
  from: Date,
  to: Date
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const k = iso(d);
    const v = sumOn(k, metric, ids);
    if (v == null) continue;
    const priorKey = iso(addDays(d, -YOY_LAG));
    const prior = sumOn(priorKey, metric, ids);
    // Baseline = prior year, rescaled by seat growth. Estimated from data only.
    let baseline: number | null = null;
    if (prior != null) {
      const g = provisioned(d) / provisioned(addDays(d, -YOY_LAG));
      baseline = prior * g;
    }
    out.push({ date: k, value: v, baseline });
  }
  return out;
}

export const mean = (a: number[]): number =>
  a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

export function windowMean(
  metric: SummableMetric,
  ids: number[],
  endDate: Date,
  days: number,
  useBaseline = false
): number | null {
  const vals: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(endDate, -i);
    if (useBaseline) {
      const prior = sumOn(iso(addDays(d, -YOY_LAG)), metric, ids);
      if (prior != null) vals.push(prior * (provisioned(d) / provisioned(addDays(d, -YOY_LAG))));
    } else {
      const v = sumOn(iso(d), metric, ids);
      if (v != null) vals.push(v);
    }
  }
  return vals.length ? mean(vals) : null;
}

/* Seasonally-adjusted change.
   raw      = how the metric actually moved period over period
   expected = how the prior-year baseline moved over the same calendar window
   adjusted = raw movement divided by expected movement, minus 1
   This is the number the whole dashboard turns on. */
export function adjustedChange(
  metric: SummableMetric,
  ids: number[],
  endDate: Date,
  days: number
): { raw: number; expected: number; adjusted: number; post: number; pre: number } | null {
  const post = windowMean(metric, ids, endDate, days);
  const pre = windowMean(metric, ids, addDays(endDate, -days), days);
  const bPost = windowMean(metric, ids, endDate, days, true);
  const bPre = windowMean(metric, ids, addDays(endDate, -days), days, true);
  if (!post || !pre || !bPost || !bPre) return null;
  const raw = post / pre - 1;
  const expected = bPost / bPre - 1;
  const adjusted = post / pre / (bPost / bPre) - 1;
  return { raw, expected, adjusted, post, pre };
}
