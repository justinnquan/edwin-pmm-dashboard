/* ===========================================================================
   /data — CALENDAR, RNG, SEASONALITY, PROVISIONED POPULATION
   The generator's ground truth. The analytics layer is NOT allowed to read
   the seasonal model directly — it must recover seasonality from prior-year
   data.
=========================================================================== */

export const TODAY = new Date(Date.UTC(2026, 7, 26)); // Wed 26 Aug 2026
export const START = new Date(Date.UTC(2025, 1, 1)); // 1 Feb 2025 (gives YoY depth)
export const DAY = 86400000;

export const iso = (d: Date): string => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY);
export const daysBetween = (a: Date, b: Date): number =>
  Math.round((b.getTime() - a.getTime()) / DAY);
export const fmtShort = (s: string): string => {
  const d = new Date(s + "T00:00:00Z");
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
};

// Deterministic RNG so every reviewer sees identical numbers.
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --- Seasonal model: Canadian K-12 calendar (ON/AB) ------------------------
   Share of provisioned teachers active on a given weekday. Anchor points are
   interpolated. */
const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const doy = (m: number, d: number): number => CUM[m - 1] + d;

const SEASON: [number, number, number][] = [
  [1, 1, 0.03], [1, 8, 0.28], [2, 1, 0.31], [3, 1, 0.32], [3, 14, 0.22],
  [3, 20, 0.08], [4, 1, 0.3], [5, 1, 0.31], [6, 1, 0.28], [6, 20, 0.18],
  [6, 30, 0.07], [7, 15, 0.03], [8, 1, 0.04], [8, 15, 0.06], [8, 26, 0.115],
  [9, 3, 0.24], [9, 15, 0.33], [10, 1, 0.35], [11, 1, 0.34], [12, 1, 0.31],
  [12, 18, 0.2], [12, 24, 0.03], [12, 31, 0.03],
];
const ANCHORS: [number, number][] = SEASON.map(
  ([m, d, v]) => [doy(m, d), v] as [number, number]
).sort((a, b) => a[0] - b[0]);

export function seasonalRate(date: Date): number {
  const n = Math.min(365, doy(date.getUTCMonth() + 1, date.getUTCDate()));
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [x0, y0] = ANCHORS[i];
    const [x1, y1] = ANCHORS[i + 1];
    if (n >= x0 && n <= x1) return y0 + ((y1 - y0) * (n - x0)) / (x1 - x0);
  }
  return ANCHORS[0][1];
}

export const DOW = [0.42, 1, 1, 1, 1, 0.97, 0.3]; // Sun..Sat

// Provisioned seats: K-12 licences step at the school year, ramping in late Aug.
export function provisioned(date: Date): number {
  const t = date.getTime();
  const ramp = (from: number, to: number, a: number, b: number): number => {
    if (t <= a) return from;
    if (t >= b) return to;
    return from + ((to - from) * (t - a)) / (b - a);
  };
  if (t < Date.UTC(2025, 7, 15)) return 24100;
  if (t < Date.UTC(2025, 8, 10))
    return ramp(24100, 26900, Date.UTC(2025, 7, 15), Date.UTC(2025, 8, 10));
  if (t < Date.UTC(2026, 7, 15)) return 26900;
  return ramp(26900, 28400, Date.UTC(2026, 7, 15), Date.UTC(2026, 8, 10));
}
