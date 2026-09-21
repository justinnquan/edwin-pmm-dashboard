/* ===========================================================================
   /analytics — CALCULATION LAYER (series + seasonally-adjusted change)
   All gating and caveating lives in this layer so no component can render an
   ungated number by accident.
=========================================================================== */
import type { Filters, SeriesPoint, SummableMetric } from "../data/schema";
import { src } from "../data/source";
import { addDays, iso } from "../lib/dates";
import { YOY_LAG, BASELINE_SMOOTH, MATERIALITY, CONFIDENCE_Z } from "./constants";

export function cellFilter(f: Filters): number[] {
  return src().cells.filter(
    (c) =>
      (f.province === "All" || c.province === f.province) &&
      (f.grade === "All" || c.grade === f.grade) &&
      (f.subject === "All" || c.subject === f.subject)
  ).map((c) => c.id);
}

// Sum a metric across selected cells on one date.
export function sumOn(dateKey: string, metric: SummableMetric, ids: number[]): number | null {
  const list = src().rowsOn(dateKey);
  if (!list) return null;
  let s = 0;
  for (const id of ids) s += list[id][metric];
  return s;
}

export const mean = (a: number[]): number =>
  a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

const stddev = (a: number[], m: number): number =>
  a.length < 2 ? 0 : Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));

/* Smoothed prior-year baseline for a single date: a centred ±BASELINE_SMOOTH-day
   rolling mean of the prior-year counterpart, each day rescaled for seat growth.
   Averaging the whole span (rather than a single point that carries its own noise
   draw) stops the baseline from adding noise to the comparison. A ±3-day window
   spans all seven weekdays, so it also removes day-of-week effects from the
   baseline — safe because every window the analytics layer compares is ≥ 7 days.
   Returns null only if no day in the span resolves. */
function baselineOn(metric: SummableMetric, ids: number[], date: Date): number | null {
  const vals: number[] = [];
  for (let o = -BASELINE_SMOOTH; o <= BASELINE_SMOOTH; o++) {
    const cur = addDays(date, o);
    const prior = addDays(cur, -YOY_LAG);
    const pv = sumOn(iso(prior), metric, ids);
    if (pv == null) continue;
    // Rescale the prior year for seat growth. Where the source cannot answer
    // for either date, compare like for like rather than inventing a ratio.
    const now = src().seatsOn(cur, ids);
    const then = src().seatsOn(prior, ids);
    const scale = now != null && then != null && then > 0 ? now / then : 1;
    vals.push(pv * scale);
  }
  return vals.length ? mean(vals) : null;
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
    out.push({ date: k, value: v, baseline: baselineOn(metric, ids, d) });
  }
  return out;
}

/* Day-of-week factors over a trailing ~9 weeks: each weekday's mean relative to
   the overall mean, for the given metric and segment. Used to deseasonalize the
   day-of-week pattern out of the standard-error estimate. Estimated from the
   data only (not the generator's DOW constants). */
const DOW_LOOKBACK = 63;
function dowFactors(metric: SummableMetric, ids: number[], endDate: Date): number[] {
  const sum = new Array(7).fill(0);
  const cnt = new Array(7).fill(0);
  let total = 0;
  let tc = 0;
  for (let i = 0; i < DOW_LOOKBACK; i++) {
    const d = addDays(endDate, -i);
    const v = sumOn(iso(d), metric, ids);
    if (v == null) continue;
    const k = d.getUTCDay();
    sum[k] += v;
    cnt[k] += 1;
    total += v;
    tc += 1;
  }
  if (!tc) return new Array(7).fill(1);
  const overall = total / tc;
  return sum.map((s, k) => (cnt[k] && overall ? s / cnt[k] / overall : 1));
}

/* Window statistics: mean, standard error of the mean, and resolved-day count,
   over a trailing window. `useBaseline` averages the smoothed prior-year
   baseline instead of the actual series.

   The SE is computed on a day-of-week-DESEASONALIZED daily series. Day-of-week
   is a deterministic within-window structure (weekends run far below weekdays),
   not sampling error — leaving it in sd(daily) would inflate the SE roughly
   four-fold and reject genuine campaign effects. We divide it out first; what
   remains (irregular noise plus any steep within-window seasonal curvature)
   correctly widens the band during volatile periods. The smoothed baseline is
   already day-of-week-flat, so its path skips this step. */
export function windowStats(
  metric: SummableMetric,
  ids: number[],
  endDate: Date,
  days: number,
  useBaseline = false
): { mean: number; se: number; n: number } | null {
  const raw: number[] = [];
  const dows: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(endDate, -i);
    const v = useBaseline ? baselineOn(metric, ids, d) : sumOn(iso(d), metric, ids);
    if (v != null) {
      raw.push(v);
      dows.push(d.getUTCDay());
    }
  }
  if (!raw.length) return null;
  const m = mean(raw);
  if (useBaseline) return { mean: m, se: stddev(raw, m) / Math.sqrt(raw.length), n: raw.length };

  const f = dowFactors(metric, ids, endDate);
  const des = raw.map((v, i) => v / (f[dows[i]] || 1));
  const dm = mean(des);
  return { mean: m, se: stddev(des, dm) / Math.sqrt(des.length), n: raw.length };
}

export function windowMean(
  metric: SummableMetric,
  ids: number[],
  endDate: Date,
  days: number,
  useBaseline = false
): number | null {
  const s = windowStats(metric, ids, endDate, days, useBaseline);
  return s ? s.mean : null;
}

/* Statistics of the daily actual/baseline ratio over a window, day-of-week
   deseasonalized. Because the seasonal level and steep ramps live in BOTH the
   actual and its prior-year baseline, they largely cancel inside each day's
   ratio — so the SD reflects genuine deviation (noise + baseline-tracking error
   during volatile periods), not the deterministic ramp. This drives a far more
   honest uncertainty band than adding four window variances in quadrature,
   which would double-count that shared structure. */
export function ratioWindowStats(
  metric: SummableMetric,
  ids: number[],
  endDate: Date,
  days: number
): { mean: number; se: number } | null {
  const rs: number[] = [];
  const dows: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(endDate, -i);
    const a = sumOn(iso(d), metric, ids);
    const b = baselineOn(metric, ids, d);
    if (a != null && b != null && b > 0) {
      rs.push(a / b);
      dows.push(d.getUTCDay());
    }
  }
  if (!rs.length) return null;
  const m = mean(rs);
  const f = dowFactors(metric, ids, endDate);
  const des = rs.map((r, i) => r / (f[dows[i]] || 1));
  return { mean: m, se: stddev(des, mean(des)) / Math.sqrt(des.length) };
}

/* SE of a seasonally-adjusted change via the ratio-of-ratios of the two period
   ratios (post-vs-baseline and pre-vs-baseline), delta method on the log scale,
   plus a count-based (Poisson) term from the objective metric's own volume.

   The ratio term captures noise and baseline-tracking error. The count term
   (1/total in each window) captures the extra uncertainty of estimating a rate
   from few events: negligible for high-volume metrics (thousands of resource
   opens a day), but large for sparse ones — e.g. classes created in mid-summer,
   a handful a day — where a small absolute wobble reads as a big percentage.
   Without it a stable low-volume artifact reads as a confident, material result. */
export function adjustedSE(
  metric: SummableMetric,
  ids: number[],
  postEnd: Date,
  preEnd: Date,
  days: number,
  adjusted: number
): number | null {
  const postR = ratioWindowStats(metric, ids, postEnd, days);
  const preR = ratioWindowStats(metric, ids, preEnd, days);
  const postM = windowStats(metric, ids, postEnd, days);
  const preM = windowStats(metric, ids, preEnd, days);
  if (!postR || !preR || !postM || !preM || !postR.mean || !preR.mean) return null;
  const postTotal = Math.max(1, postM.mean * postM.n);
  const preTotal = Math.max(1, preM.mean * preM.n);
  const relVar =
    (postR.se / postR.mean) ** 2 +
    (preR.se / preR.mean) ** 2 +
    1 / postTotal +
    1 / preTotal;
  return (1 + adjusted) * Math.sqrt(relVar);
}

export interface AdjustedChange {
  raw: number;
  expected: number;
  adjusted: number;
  post: number;
  pre: number;
  se: number;
  threshold: number;
  material: boolean;
}

/* Seasonally-adjusted change.
   raw      = how the metric actually moved period over period
   expected = how the prior-year baseline moved over the same calendar window
   adjusted = raw movement divided by expected movement, minus 1
   se       = std error of `adjusted` via the delta method on the log scale
   material = clears both the 5% floor AND its own ~95% uncertainty band
   This is the number the whole dashboard turns on. */
export function adjustedChange(
  metric: SummableMetric,
  ids: number[],
  endDate: Date,
  days: number
): AdjustedChange | null {
  const sPost = windowStats(metric, ids, endDate, days);
  const sPre = windowStats(metric, ids, addDays(endDate, -days), days);
  const sBPost = windowStats(metric, ids, endDate, days, true);
  const sBPre = windowStats(metric, ids, addDays(endDate, -days), days, true);
  if (!sPost || !sPre || !sBPost || !sBPre) return null;
  const { mean: post } = sPost;
  const { mean: pre } = sPre;
  const { mean: bPost } = sBPost;
  const { mean: bPre } = sBPre;
  if (!post || !pre || !bPost || !bPre) return null;

  const raw = post / pre - 1;
  const expected = bPost / bPre - 1;
  const adjusted = post / pre / (bPost / bPre) - 1;
  const se = adjustedSE(metric, ids, endDate, addDays(endDate, -days), days, adjusted);
  if (se == null) return null;
  const threshold = Math.max(MATERIALITY, CONFIDENCE_Z * se);
  return { raw, expected, adjusted, post, pre, se, threshold, material: Math.abs(adjusted) >= threshold };
}

/* Seat-weighted mean of a per-cell rate metric over a trailing window:
   Σ(rate_cell × seats_cell) / Σ(seats_cell), averaged across the window's days.
   Used for rates (e.g. retention) so small cells don't count as much as large
   ones — an unweighted mean over cells would misrepresent the population. */
export function seatWeightedRate(
  metric: SummableMetric,
  ids: number[],
  endDate: Date,
  days: number
): number | null {
  const seatsById = new Map<number, number>(
    ids.map((id) => [id, src().seatsOn(endDate, [id]) ?? 0])
  );
  const totalSeats = ids.reduce((s, id) => s + (seatsById.get(id) ?? 0), 0);
  if (totalSeats <= 0) return null;
  const dayRates: number[] = [];
  for (let i = 0; i < days; i++) {
    const k = iso(addDays(endDate, -i));
    const list = src().rowsOn(k);
    if (!list) continue;
    let numr = 0;
    for (const id of ids) numr += list[id][metric] * (seatsById.get(id) ?? 0);
    dayRates.push(numr / totalSeats);
  }
  return dayRates.length ? mean(dayRates) : null;
}
