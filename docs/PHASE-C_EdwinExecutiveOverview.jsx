import React, { useState, useMemo } from "react";
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area,
} from "recharts";

/* ============================================================================
   EDWIN PRODUCT MARKETING DASHBOARD — PHASE C: EXECUTIVE OVERVIEW
   Prototype on synthetic data. No real Edwin/Pardot data is used.

   LAYERS (each block below maps 1:1 to a file in the eventual Claude Code repo)
     /theme      → tokens                    (PLACEHOLDER — swap for Phia)
     /data       → seeded synthetic generator + schema
     /analytics  → KPI calc, seasonal adjustment, gating, insight rules
     /components → presentational only, never computes a metric
     /pages      → ExecutiveOverview

   THE UI NEVER COMPUTES A METRIC. It asks /analytics, which reads /data.
   Swapping /data for a real adapter leaves /analytics and /components alone.
============================================================================ */


/* ===========================================================================
   /theme — DESIGN TOKENS
   PLACEHOLDER. Replace this single object with the Phia token export.
   Values below are Edwin brand standards used as a stand-in.
=========================================================================== */
const T = {
  blue: "#017ACC", navy: "#003865", ink: "#1A1F2E", soft: "#4A5264",
  muted: "#8891A3", border: "#E4E8EF", bg: "#FAFBFC", surface: "#FFFFFF",
  warn: "#E8633A", good: "#1F8A70", baseline: "#9BB0C4", railTint: "#0B2745",
  font: "Nunito, 'Segoe UI', system-ui, -apple-system, sans-serif",
};
const num = { fontVariantNumeric: "tabular-nums" };


/* ===========================================================================
   /data — SYNTHETIC DATA LAYER
=========================================================================== */

const TODAY = new Date(Date.UTC(2026, 7, 26));      // Wed 26 Aug 2026
const START = new Date(Date.UTC(2025, 1, 1));       // 1 Feb 2025 (gives YoY depth)
const DAY = 86400000;

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const daysBetween = (a, b) => Math.round((b - a) / DAY);
const fmtShort = (s) => {
  const d = new Date(s + "T00:00:00Z");
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
};

// Deterministic RNG so every reviewer sees identical numbers.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --- Seasonal model: Canadian K-12 calendar (ON/AB) ------------------------
   Share of provisioned teachers active on a given weekday. Anchor points are
   interpolated. This is the generator's ground truth; the analytics layer is
   NOT allowed to read it and must recover seasonality from prior-year data. */
const SEASON = [
  [1, 1, 0.030], [1, 8, 0.280], [2, 1, 0.310], [3, 1, 0.320], [3, 14, 0.220],
  [3, 20, 0.080], [4, 1, 0.300], [5, 1, 0.310], [6, 1, 0.280], [6, 20, 0.180],
  [6, 30, 0.070], [7, 15, 0.030], [8, 1, 0.040], [8, 15, 0.060], [8, 26, 0.115],
  [9, 3, 0.240], [9, 15, 0.330], [10, 1, 0.350], [11, 1, 0.340], [12, 1, 0.310],
  [12, 18, 0.200], [12, 24, 0.030], [12, 31, 0.030],
];
const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const doy = (m, d) => CUM[m - 1] + d;
const ANCHORS = SEASON.map(([m, d, v]) => [doy(m, d), v]).sort((a, b) => a[0] - b[0]);

function seasonalRate(date) {
  const n = Math.min(365, doy(date.getUTCMonth() + 1, date.getUTCDate()));
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [x0, y0] = ANCHORS[i], [x1, y1] = ANCHORS[i + 1];
    if (n >= x0 && n <= x1) return y0 + ((y1 - y0) * (n - x0)) / (x1 - x0);
  }
  return ANCHORS[0][1];
}
const DOW = [0.42, 1, 1, 1, 1, 0.97, 0.30]; // Sun..Sat

// Provisioned seats: K-12 licences step at the school year, ramping in late Aug.
function provisioned(date) {
  const t = date.getTime();
  const ramp = (from, to, a, b) => {
    if (t <= a) return from;
    if (t >= b) return to;
    return from + ((to - from) * (t - a)) / (b - a);
  };
  if (t < Date.UTC(2025, 7, 15)) return 24100;
  if (t < Date.UTC(2025, 8, 10)) return ramp(24100, 26900, Date.UTC(2025, 7, 15), Date.UTC(2025, 8, 10));
  if (t < Date.UTC(2026, 7, 15)) return 26900;
  return ramp(26900, 28400, Date.UTC(2026, 7, 15), Date.UTC(2026, 8, 10));
}

/* --- Segment cells --------------------------------------------------------- */
const PROVINCES = [{ k: "ON", w: 0.71, e: 1.04 }, { k: "AB", w: 0.29, e: 0.93 }];
const GRADES = [
  { k: "Primary (1–3)", w: 0.30, e: 1.06 },
  { k: "Junior/Intermediate (4–8)", w: 0.38, e: 1.02 },
  { k: "Secondary (9–12)", w: 0.32, e: 0.89 },
];
const SUBJECTS = [
  { k: "Mathematics", w: 0.30, e: 1.05 }, { k: "English/ELA", w: 0.28, e: 1.00 },
  { k: "Science", w: 0.22, e: 0.96 }, { k: "Social Studies", w: 0.20, e: 0.92 },
];

const CELLS = [];
PROVINCES.forEach((p) => GRADES.forEach((g) => SUBJECTS.forEach((s) => {
  CELLS.push({
    id: CELLS.length, province: p.k, grade: g.k, subject: s.k,
    weight: p.w * g.w * s.w, engagement: p.e * g.e * s.e,
  });
})));

/* --- Campaigns -------------------------------------------------------------
   `effects` is the injected ground truth. The analytics layer must recover it
   from the data alone. The mix is deliberately honest: one campaign that is
   pure seasonality, one high-CTR/no-impact, one sustained real lift, one dud. */
const ALL = () => true;
const CAMPAIGNS = [
  {
    id: "c-report-card", name: "Report Card Season Time-Savers",
    type: "Product/feature launch", channel: "Pardot email", launch: "2026-06-01",
    audience: "ON + AB, Primary and Junior/Intermediate",
    target: (c) => c.grade !== "Secondary (9–12)",
    sends: 19400, openRate: 0.41, clickRate: 0.062,
    effects: { assignmentsCreated: 0.14, resourceOpens: 0.07 }, halfLife: 30,
  },
  {
    id: "c-summer-prep", name: "Summer Prep — Build Your First Class",
    type: "Re-engagement", channel: "Pardot email", launch: "2026-07-14",
    audience: "All teachers", target: ALL,
    sends: 24100, openRate: 0.22, clickRate: 0.019,
    effects: {}, halfLife: 10,
  },
  {
    id: "c-threaded", name: "New Content — Threaded Releases",
    type: "Release notes", channel: "In-product release notes", launch: "2026-08-05",
    audience: "All teachers", target: ALL,
    sends: 8900, openRate: 1.0, clickRate: 0.031,
    effects: { resourceOpens: 0.02 }, halfLife: 14,
  },
  {
    id: "c-bts", name: "Back to School 2026 — Ready Day One",
    type: "Pardot email", channel: "Pardot email", launch: "2026-08-10",
    audience: "All teachers", target: ALL,
    sends: 27800, openRate: 0.48, clickRate: 0.094,
    effects: { wau: 0.02 }, halfLife: 21,
  },
  {
    id: "c-pc-preview", name: "ELA Progress Checks — Preview",
    type: "Product/feature launch", channel: "Pardot email", launch: "2026-08-17",
    audience: "Ontario, Secondary English/ELA",
    target: (c) => c.province === "ON" && c.grade === "Secondary (9–12)" && c.subject === "English/ELA",
    sends: 2180, openRate: 0.54, clickRate: 0.128,
    effects: { resourceOpens: 0.01 }, halfLife: 14,
  },
  {
    id: "c-ets", name: "Edwin Teaching System — First Look",
    type: "In-app notification", channel: "In-app notification", launch: "2026-08-18",
    audience: "All teachers", target: ALL,
    sends: 6240, openRate: 1.0, clickRate: 0.27,
    effects: { resourceOpens: 0.12, wau: 0.06 }, halfLife: 45,
  },
  {
    id: "c-slides", name: "Edwin Slides — Coming Soon",
    type: "In-app notification", channel: "In-app notification", launch: "2026-08-24",
    audience: "All teachers", target: ALL,
    sends: 1980, openRate: 1.0, clickRate: 0.19,
    effects: { resourceOpens: 0.05 }, halfLife: 21,
  },
];

const RELEASES = [
  { date: "2026-04-14", name: "Assignment auto-grading" },
  { date: "2026-08-24", name: "Edwin Teaching System live" },
];

// Multiplier applied by the generator; decays from launch.
function campaignMultiplier(cell, date, metric) {
  let m = 1;
  for (const c of CAMPAIGNS) {
    const lift = c.effects[metric];
    if (!lift || !c.target(cell)) continue;
    const d = daysBetween(new Date(c.launch + "T00:00:00Z"), date);
    if (d < 0) continue;
    m *= 1 + lift * Math.pow(0.5, d / c.halfLife);
  }
  return m;
}

/* --- Generate the daily fact table (date × cell) --------------------------- */
function generate() {
  const rows = [];
  const byDate = new Map();
  const rng = mulberry32(20260826);
  const total = daysBetween(START, TODAY);

  for (let i = 0; i <= total; i++) {
    const date = addDays(START, i);
    const key = iso(date);
    const prov = provisioned(date);
    const season = seasonalRate(date);
    const dow = DOW[date.getUTCDay()];
    const list = [];

    for (const cell of CELLS) {
      const seats = prov * cell.weight;
      const noise = 1 + (rng() - 0.5) * 0.05;

      const dailyActive = seats * season * dow * cell.engagement * noise;
      const wau = seats * Math.min(0.62, season * 1.42) * cell.engagement
        * (1 + (rng() - 0.5) * 0.03) * campaignMultiplier(cell, date, "wau");

      const opensPer = 3.1 + season * 2.4;
      const resourceOpens = dailyActive * opensPer * campaignMultiplier(cell, date, "resourceOpens");
      const classesCreated = dailyActive * (0.006 + (season > 0.2 ? 0.02 : 0.002))
        * campaignMultiplier(cell, date, "classesCreated");
      const assignmentsCreated = dailyActive * 0.34 * campaignMultiplier(cell, date, "assignmentsCreated");
      const ahaUsers = wau * (0.24 + season * 0.55) * campaignMultiplier(cell, date, "assignmentsCreated");

      const row = {
        date: key, cellId: cell.id, provisioned: seats, dailyActive, wau,
        resourceOpens, classesCreated, assignmentsCreated,
        ahaUsers: Math.min(ahaUsers, wau * 0.92),
        retentionW4: Math.max(0.18, Math.min(0.74, 0.30 + season * 1.15)),
      };
      rows.push(row); list.push(row);
    }
    byDate.set(key, list);
  }
  return { rows, byDate };
}

/* --- Lightweight user panel (exposure de-duplication only) ----------------- */
function buildPanel() {
  const n = 28400;
  const cellOf = new Int8Array(n);
  const rng = mulberry32(77);
  const cum = []; let acc = 0;
  CELLS.forEach((c) => { acc += c.weight; cum.push(acc); });
  for (let i = 0; i < n; i++) {
    const r = rng() * acc;
    cellOf[i] = cum.findIndex((v) => r <= v);
  }
  const exposure = {};
  for (const c of CAMPAIGNS) {
    const bits = new Uint8Array(n);
    const eligible = [];
    for (let i = 0; i < n; i++) if (c.target(CELLS[cellOf[i]])) eligible.push(i);
    const coverage = Math.min(1, c.sends / Math.max(1, eligible.length));
    for (const i of eligible) if (rng() < coverage) bits[i] = 1;
    exposure[c.id] = bits;
  }
  return { n, cellOf, exposure };
}

const DATA = generate();
const PANEL = buildPanel();


/* ===========================================================================
   /analytics — CALCULATION LAYER
   All gating and caveating lives here so no component can render an
   ungated number by accident.
=========================================================================== */

const MIN_N = 300;          // minimum exposed teachers before a result renders
const MATERIALITY = 0.05;   // 5% seasonally-adjusted change to count as material
const YOY_LAG = 364;        // preserves day-of-week alignment

const METRIC_LABEL = {
  wau: "Weekly active teachers", resourceOpens: "Resource engagement",
  assignmentsCreated: "Assignments created", classesCreated: "Classes created",
  ahaUsers: "Adoption (class or assignment created)",
};

function cellFilter(f) {
  return CELLS.filter((c) =>
    (f.province === "All" || c.province === f.province) &&
    (f.grade === "All" || c.grade === f.grade) &&
    (f.subject === "All" || c.subject === f.subject)
  ).map((c) => c.id);
}

// Sum a metric across selected cells on one date.
function sumOn(dateKey, metric, ids) {
  const list = DATA.byDate.get(dateKey);
  if (!list) return null;
  let s = 0;
  for (const id of ids) s += list[id][metric];
  return s;
}

function seriesFor(metric, ids, from, to) {
  const out = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const k = iso(d);
    const v = sumOn(k, metric, ids);
    if (v == null) continue;
    const priorKey = iso(addDays(d, -YOY_LAG));
    const prior = sumOn(priorKey, metric, ids);
    // Baseline = prior year, rescaled by seat growth. Estimated from data only.
    let baseline = null;
    if (prior != null) {
      const g = provisioned(d) / provisioned(addDays(d, -YOY_LAG));
      baseline = prior * g;
    }
    out.push({ date: k, value: v, baseline });
  }
  return out;
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

function windowMean(metric, ids, endDate, days, useBaseline = false) {
  const vals = [];
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
function adjustedChange(metric, ids, endDate, days) {
  const post = windowMean(metric, ids, endDate, days);
  const pre = windowMean(metric, ids, addDays(endDate, -days), days);
  const bPost = windowMean(metric, ids, endDate, days, true);
  const bPre = windowMean(metric, ids, addDays(endDate, -days), days, true);
  if (!post || !pre || !bPost || !bPre) return null;
  const raw = post / pre - 1;
  const expected = bPost / bPre - 1;
  const adjusted = (post / pre) / (bPost / bPre) - 1;
  return { raw, expected, adjusted, post, pre };
}

// Distinct teachers exposed, within the current segment filter.
function reachedIn(campaignIds, ids) {
  const set = new Set(ids);
  const bits = campaignIds.map((c) => PANEL.exposure[c]).filter(Boolean);
  if (!bits.length) return 0;
  let n = 0;
  for (let i = 0; i < PANEL.n; i++) {
    if (!set.has(PANEL.cellOf[i])) continue;
    for (const b of bits) if (b[i]) { n++; break; }
  }
  return n;
}

function campaignsInWindow(days) {
  const from = addDays(TODAY, -days);
  return CAMPAIGNS.filter((c) => {
    const d = new Date(c.launch + "T00:00:00Z");
    return d >= from && d <= TODAY;
  });
}

/* Before vs. after for one campaign, seasonally adjusted and N-gated. */
function campaignImpact(campaign, metric, ids, windowDays) {
  const launch = new Date(campaign.launch + "T00:00:00Z");
  const elapsed = daysBetween(launch, TODAY);
  const targetIds = ids.filter((id) => campaign.target(CELLS[id]));
  const n = targetIds.length ? reachedIn([campaign.id], targetIds) : 0;

  if (!targetIds.length)
    return { state: "out-of-segment", n: 0 };
  if (elapsed < windowDays)
    return { state: "insufficient-window", n, elapsed, needed: windowDays };
  if (n < MIN_N)
    return { state: "insufficient-n", n };

  const post = windowMean(metric, targetIds, addDays(launch, windowDays), windowDays);
  const pre = windowMean(metric, targetIds, addDays(launch, -1), windowDays);
  const bPost = windowMean(metric, targetIds, addDays(launch, windowDays), windowDays, true);
  const bPre = windowMean(metric, targetIds, addDays(launch, -1), windowDays, true);
  if (!post || !pre || !bPost || !bPre) return { state: "no-baseline", n };

  const adjusted = (post / pre) / (bPost / bPre) - 1;
  return {
    state: "ok", n, adjusted, raw: post / pre - 1,
    expected: bPost / bPre - 1, material: Math.abs(adjusted) >= MATERIALITY,
  };
}

/* Deterministic insight rules. No free-text generation.
   A statement renders only if it clears materiality AND minimum N. */
function buildInsights(ids, windowDays) {
  const out = []; let suppressed = 0;

  // R1 — seasonality guard on the headline metric.
  const wow = adjustedChange("wau", ids, TODAY, 7);
  if (wow) {
    if (Math.abs(wow.raw) >= 0.10 && Math.abs(wow.adjusted) < MATERIALITY) {
      out.push({
        tone: "watch",
        text: `Weekly active teachers moved ${pct(wow.raw)} week over week, but ${pct(wow.adjusted)} after seasonal adjustment.`,
        detail: "The movement is consistent with the normal back-to-school ramp. Prior-year baseline moved " + pct(wow.expected) + " over the same calendar window.",
      });
    } else if (Math.abs(wow.adjusted) >= MATERIALITY) {
      out.push({
        tone: wow.adjusted > 0 ? "positive" : "negative",
        text: `Weekly active teachers are ${pct(wow.adjusted)} against the seasonal baseline.`,
        detail: "Raw week-over-week change was " + pct(wow.raw) + ".",
      });
    }
  }

  // R2 — campaign-associated changes.
  for (const c of campaignsInWindow(30)) {
    for (const metric of ["resourceOpens", "assignmentsCreated", "wau"]) {
      const r = campaignImpact(c, metric, ids, windowDays);
      if (r.state === "insufficient-n") { suppressed++; continue; }
      if (r.state !== "ok" || !r.material) continue;
      out.push({
        tone: r.adjusted > 0 ? "positive" : "negative",
        text: `${METRIC_LABEL[metric]} is ${pct(r.adjusted)} against baseline since ${c.name} (${fmtShort(c.launch)}).`,
        detail: `${r.n.toLocaleString()} teachers exposed. Observed association over a ${windowDays}-day window, not proven causation.`,
        campaignId: c.id,
      });
    }
  }

  // R3 — segment declines.
  for (const p of PROVINCES) for (const g of GRADES) {
    const segIds = ids.filter((id) => CELLS[id].province === p.k && CELLS[id].grade === g.k);
    if (!segIds.length) continue;
    const seats = segIds.reduce((s, id) => s + provisioned(TODAY) * CELLS[id].weight, 0);
    const ch = adjustedChange("classesCreated", segIds, TODAY, 14);
    if (!ch) continue;
    if (seats < MIN_N) { suppressed++; continue; }
    if (ch.adjusted <= -MATERIALITY) {
      out.push({
        tone: "negative",
        text: `Class creation in ${p.k} ${g.k} is ${pct(ch.adjusted)} against the seasonal baseline.`,
        detail: "Fourteen-day window. Worth checking before September onboarding volume peaks.",
      });
    }
  }

  const ranked = out.sort((a, b) => order(a.tone) - order(b.tone)).slice(0, 4);
  return { insights: ranked, suppressed };
}
const order = (t) => ({ watch: 0, positive: 1, negative: 2 }[t] ?? 3);

const pct = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);
const int = (v) => (v == null ? "—" : Math.round(v).toLocaleString("en-CA"));


/* ===========================================================================
   /components — PRESENTATION ONLY
=========================================================================== */

function Card({ children, className = "", style = {} }) {
  return (
    <div className={"rounded-lg " + className}
      style={{ background: T.surface, border: `1px solid ${T.border}`, ...style }}>
      {children}
    </div>
  );
}

function Chip({ tone = "muted", children }) {
  const map = { good: T.good, warn: T.warn, blue: T.blue, muted: T.muted };
  const c = map[tone] || T.muted;
  return (
    <span className="inline-block rounded px-2 py-1 text-xs font-semibold"
      style={{ color: c, background: c + "14", letterSpacing: "0.02em" }}>
      {children}
    </span>
  );
}

function KpiCard({ label, value, unit, raw, adjusted, note, caveat, primary }) {
  const tone = adjusted == null ? T.muted : adjusted >= 0 ? T.good : T.warn;
  return (
    <Card className="p-4 flex flex-col justify-between" style={primary ? { borderColor: T.blue } : {}}>
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs font-bold uppercase" style={{ color: T.muted, letterSpacing: "0.06em" }}>
            {label}
          </div>
          {caveat && <Chip tone="warn">Association</Chip>}
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span style={{ ...num, color: primary ? T.blue : T.ink, fontSize: primary ? 38 : 30, fontWeight: 800, lineHeight: 1 }}>
            {value}
          </span>
          {unit && <span className="text-sm font-semibold" style={{ color: T.soft }}>{unit}</span>}
        </div>
      </div>

      {/* SIGNATURE: raw movement and the seasonally-adjusted movement, always paired. */}
      <div className="mt-4">
        {raw != null && (
          <div className="flex items-center gap-3 text-xs" style={num}>
            <span style={{ color: T.muted }}>Raw <b style={{ color: T.soft }}>{raw}</b></span>
            <span style={{ color: T.border }}>│</span>
            <span style={{ color: T.muted }}>Adjusted <b style={{ color: tone }}>{adjusted == null ? "—" : pct(adjusted)}</b></span>
          </div>
        )}
        {note && <div className="mt-2 text-xs" style={{ color: T.muted, lineHeight: 1.5 }}>{note}</div>}
      </div>
    </Card>
  );
}

function InsightStrip({ insights, suppressed }) {
  const color = { positive: T.good, negative: T.warn, watch: T.blue };
  const word = { positive: "Above baseline", negative: "Below baseline", watch: "Read carefully" };
  if (!insights.length) {
    return (
      <Card className="p-5">
        <div className="text-sm font-semibold" style={{ color: T.ink }}>No material changes to report</div>
        <div className="mt-1 text-xs" style={{ color: T.muted }}>
          Nothing in this segment cleared the 5% seasonally-adjusted threshold and the {MIN_N}-teacher minimum.
        </div>
      </Card>
    );
  }
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
      {insights.map((i, k) => (
        <Card key={k} className="p-4" style={{ borderLeft: `3px solid ${color[i.tone]}` }}>
          <Chip tone={i.tone === "positive" ? "good" : i.tone === "negative" ? "warn" : "blue"}>
            {word[i.tone]}
          </Chip>
          <div className="mt-2 text-sm font-semibold" style={{ color: T.ink, lineHeight: 1.45 }}>{i.text}</div>
          <div className="mt-1 text-xs" style={{ color: T.muted, lineHeight: 1.5 }}>{i.detail}</div>
        </Card>
      ))}
      {suppressed > 0 && (
        <Card className="p-4" style={{ background: T.bg }}>
          <Chip>Suppressed</Chip>
          <div className="mt-2 text-sm font-semibold" style={{ color: T.soft, lineHeight: 1.45 }}>
            {suppressed} change{suppressed === 1 ? "" : "s"} hidden — sample below {MIN_N} teachers.
          </div>
          <div className="mt-1 text-xs" style={{ color: T.muted }}>
            Widen the segment or the date range to see them.
          </div>
        </Card>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, label, campaignsByDate }) {
  if (!active || !payload || !payload.length) return null;
  const v = payload.find((p) => p.dataKey === "value");
  const b = payload.find((p) => p.dataKey === "baseline");
  const c = campaignsByDate.get(label);
  const gap = v && b && b.value ? v.value / b.value - 1 : null;
  return (
    <div className="rounded-md p-3 text-xs"
      style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 4px 14px rgba(0,0,0,.09)", minWidth: 200 }}>
      <div className="font-bold" style={{ color: T.ink }}>{fmtShort(label)}</div>
      <div className="mt-2 flex justify-between gap-4" style={num}>
        <span style={{ color: T.soft }}>Actual</span><b style={{ color: T.blue }}>{int(v?.value)}</b>
      </div>
      <div className="flex justify-between gap-4" style={num}>
        <span style={{ color: T.soft }}>Seasonal baseline</span><b style={{ color: T.baseline }}>{int(b?.value)}</b>
      </div>
      {gap != null && (
        <div className="mt-2 pt-2 flex justify-between gap-4" style={{ ...num, borderTop: `1px solid ${T.border}` }}>
          <span style={{ color: T.soft }}>Gap</span>
          <b style={{ color: gap >= 0 ? T.good : T.warn }}>{pct(gap)}</b>
        </div>
      )}
      {c && <div className="mt-2 pt-2 text-xs" style={{ borderTop: `1px solid ${T.border}`, color: T.blue }}>
        <b>{c.name}</b><div style={{ color: T.muted }}>Click the marker to open</div>
      </div>}
    </div>
  );
}

function TrendChart({ series, metric, campaigns, onPick }) {
  const byDate = useMemo(() => {
    const m = new Map();
    campaigns.forEach((c) => m.set(c.launch, c));
    return m;
  }, [campaigns]);

  const max = Math.max(...series.map((d) => Math.max(d.value, d.baseline || 0)));
  const markerY = max * 0.045;

  const data = series.map((d) => ({
    ...d,
    gapTop: d.baseline != null ? Math.max(d.value, d.baseline) : d.value,
    gapBase: d.baseline != null ? Math.min(d.value, d.baseline) : d.value,
    marker: byDate.has(d.date) ? markerY : null,
    campaignId: byDate.get(d.date)?.id,
  }));

  const releaseHits = RELEASES.filter((r) => series.some((s) => s.date === r.date));

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="gapFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={T.blue} stopOpacity={0.16} />
              <stop offset="100%" stopColor={T.blue} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={T.border} vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fontSize: 11, fill: T.muted }}
            axisLine={{ stroke: T.border }} tickLine={false} minTickGap={28} />
          <YAxis tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false}
            tickFormatter={(v) => (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)} width={44} />
          <Tooltip content={<ChartTooltip campaignsByDate={byDate} />} />

          {/* SIGNATURE: the gap between what happened and what would have happened anyway. */}
          <Area dataKey="gapTop" stroke="none" fill="url(#gapFill)" isAnimationActive={false} />
          <Area dataKey="gapBase" stroke="none" fill={T.surface} isAnimationActive={false} />

          {releaseHits.map((r) => (
            <ReferenceLine key={r.date} x={r.date} stroke={T.navy} strokeDasharray="2 3"
              label={{ value: r.name, position: "insideTopRight", fontSize: 10, fill: T.navy }} />
          ))}

          <Line type="monotone" dataKey="baseline" stroke={T.baseline} strokeWidth={2}
            strokeDasharray="5 4" dot={false} isAnimationActive={false} name="Seasonal baseline" />
          <Line type="monotone" dataKey="value" stroke={T.blue} strokeWidth={2.5}
            dot={false} isAnimationActive={false} name={METRIC_LABEL[metric]} />
          <Scatter dataKey="marker" fill={T.warn} shape="triangle"
            onClick={(p) => p?.payload?.campaignId && onPick(p.payload.campaignId)}
            style={{ cursor: "pointer" }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ImpactRow({ campaign, ids, windowDays, onPick }) {
  const metric = campaign.effects.assignmentsCreated ? "assignmentsCreated" : "resourceOpens";
  const r = campaignImpact(campaign, metric, ids, windowDays);
  const ctr = campaign.clickRate;
  const ctor = campaign.openRate > 0 ? campaign.clickRate / campaign.openRate : null;

  let result;
  if (r.state === "out-of-segment") result = <span style={{ color: T.muted }}>Not in this segment</span>;
  else if (r.state === "insufficient-window")
    result = <span style={{ color: T.muted }}>Needs {r.needed - r.elapsed} more day{r.needed - r.elapsed === 1 ? "" : "s"}</span>;
  else if (r.state === "insufficient-n") result = <span style={{ color: T.muted }}>Below {MIN_N} exposed</span>;
  else if (!r.material) result = <span style={{ color: T.soft }}>No material change</span>;
  else result = <b style={{ color: r.adjusted > 0 ? T.good : T.warn }}>{pct(r.adjusted)}</b>;

  return (
    <tr onClick={() => onPick(campaign.id)} className="cursor-pointer"
      style={{ borderTop: `1px solid ${T.border}` }}>
      <td className="py-3 pr-3">
        <div className="text-sm font-semibold" style={{ color: T.ink }}>{campaign.name}</div>
        <div className="text-xs" style={{ color: T.muted }}>{campaign.channel} · {fmtShort(campaign.launch)}</div>
      </td>
      <td className="py-3 px-3 text-sm text-right" style={num}>{int(campaign.sends)}</td>
      <td className="py-3 px-3 text-sm text-right" style={num}>{(ctr * 100).toFixed(1)}%</td>
      <td className="py-3 px-3 text-sm text-right" style={num}>{ctor ? (ctor * 100).toFixed(1) + "%" : "—"}</td>
      <td className="py-3 pl-3 text-sm text-right" style={num}>{result}</td>
    </tr>
  );
}

function DrillPanel({ campaign, ids, windowDays, onClose }) {
  if (!campaign) return null;
  const metrics = ["wau", "resourceOpens", "assignmentsCreated"];
  return (
    <Card className="p-5" style={{ borderColor: T.blue }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Chip tone="blue">{campaign.type}</Chip>
          <div className="mt-2 text-lg font-extrabold" style={{ color: T.ink }}>{campaign.name}</div>
          <div className="text-xs" style={{ color: T.muted }}>
            {campaign.channel} · Launched {fmtShort(campaign.launch)} · {campaign.audience}
          </div>
        </div>
        <button onClick={onClose} className="rounded px-2 py-1 text-xs font-semibold"
          style={{ color: T.soft, border: `1px solid ${T.border}` }}>Close</button>
      </div>

      <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
        {metrics.map((m) => {
          const r = campaignImpact(campaign, m, ids, windowDays);
          return (
            <div key={m} className="rounded p-3" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
              <div className="text-xs font-bold uppercase" style={{ color: T.muted, letterSpacing: "0.05em" }}>
                {METRIC_LABEL[m]}
              </div>
              {r.state === "ok" ? (
                <>
                  <div className="mt-2 text-2xl font-extrabold"
                    style={{ ...num, color: r.material ? (r.adjusted > 0 ? T.good : T.warn) : T.soft }}>
                    {pct(r.adjusted)}
                  </div>
                  <div className="mt-1 text-xs" style={{ ...num, color: T.muted }}>
                    Raw {pct(r.raw)} · Expected {pct(r.expected)}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm font-semibold" style={{ color: T.muted, lineHeight: 1.45 }}>
                  {r.state === "insufficient-window" && `Insufficient data — ${r.needed - r.elapsed} more day${r.needed - r.elapsed === 1 ? "" : "s"} needed for a ${windowDays}-day window.`}
                  {r.state === "insufficient-n" && `Insufficient data — ${r.n} exposed teachers, below the ${MIN_N} minimum.`}
                  {r.state === "out-of-segment" && "No exposed teachers in the current segment."}
                  {r.state === "no-baseline" && "No prior-year baseline available for this window."}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded p-3 text-xs" style={{ background: T.bg, color: T.soft, lineHeight: 1.6 }}>
        <b style={{ color: T.ink }}>How to read this.</b> Adjusted change divides the observed
        before/after movement by the movement in the prior-year baseline over the same calendar window.
        It describes an association following exposure, not proven causation. Exposed-versus-held-out
        comparison requires a randomised holdout designed into the campaign before send.
      </div>
    </Card>
  );
}

function Rail({ active }) {
  const items = ["Executive Overview", "Marketing Performance", "Activity Timeline",
    "Campaign Impact", "Adoption & Engagement", "Segments", "Campaign Calendar"];
  return (
    <nav className="hidden lg:flex flex-col shrink-0" style={{ width: 226, background: T.railTint }}>
      <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,.10)" }}>
        <div className="text-sm font-extrabold tracking-wide" style={{ color: "#fff" }}>
          NELSON <span style={{ color: T.blue }}>edwin</span>
        </div>
        <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.55)" }}>Product Marketing</div>
      </div>
      <div className="py-3">
        {items.map((n) => {
          const on = n === active;
          return (
            <div key={n} className="px-5 py-2 text-sm"
              style={{
                color: on ? "#fff" : "rgba(255,255,255,.55)",
                fontWeight: on ? 700 : 500,
                borderLeft: on ? `3px solid ${T.blue}` : "3px solid transparent",
                background: on ? "rgba(255,255,255,.06)" : "transparent",
              }}>
              {n}{!on && <span className="ml-2 text-xs" style={{ color: "rgba(255,255,255,.30)" }}>·</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-auto px-5 py-4 text-xs" style={{ color: "rgba(255,255,255,.35)", lineHeight: 1.6 }}>
        Prototype · synthetic data<br />Phase C of 7
      </div>
    </nav>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase" style={{ color: T.muted, letterSpacing: "0.05em" }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded px-2 py-1 text-sm"
        style={{ border: `1px solid ${T.border}`, background: T.surface, color: T.ink, minWidth: 120 }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}


/* ===========================================================================
   /pages — EXECUTIVE OVERVIEW
=========================================================================== */

export default function ExecutiveOverview() {
  const [view, setView] = useState("Leadership");
  const [range, setRange] = useState(90);
  const [win, setWin] = useState(7);
  const [metric, setMetric] = useState("wau");
  const [province, setProvince] = useState("All");
  const [grade, setGrade] = useState("All");
  const [subject, setSubject] = useState("All");
  const [picked, setPicked] = useState(null);

  const filters = { province, grade, subject };
  const ids = useMemo(() => cellFilter(filters), [province, grade, subject]);

  const model = useMemo(() => {
    if (!ids.length) return null;
    const from = addDays(TODAY, -range);
    const series = seriesFor(metric, ids, from, TODAY);

    const seats = ids.reduce((s, id) => s + provisioned(TODAY) * CELLS[id].weight, 0);
    const wauNow = windowMean("wau", ids, TODAY, 7);
    const activeRate = wauNow / seats;

    const wauCh = adjustedChange("wau", ids, TODAY, 7);
    const ahaNow = windowMean("ahaUsers", ids, TODAY, 7);
    const ahaRate = ahaNow / wauNow;
    const ahaCh = adjustedChange("ahaUsers", ids, TODAY, 14);
    const ret = windowMean("retentionW4", ids, TODAY, 7) / ids.length;
    const resCh = adjustedChange("resourceOpens", ids, TODAY, 14);

    const recent = campaignsInWindow(30);
    const reached = reachedIn(recent.map((c) => c.id), ids);

    // Campaign-associated impact: exposure-weighted mean of material adjusted changes.
    let wsum = 0, w = 0;
    for (const c of recent) {
      const r = campaignImpact(c, "resourceOpens", ids, win);
      if (r.state === "ok") { wsum += r.adjusted * r.n; w += r.n; }
    }
    const assoc = w ? wsum / w : null;

    const { insights, suppressed } = buildInsights(ids, win);
    return { series, seats, wauNow, activeRate, wauCh, ahaRate, ahaCh, ret, resCh, recent, reached, assoc, insights, suppressed };
  }, [ids, range, metric, win]);

  if (!ids.length || !model) {
    return (
      <div className="p-10" style={{ fontFamily: T.font, background: T.bg, minHeight: "100%" }}>
        <Card className="p-6">
          <div className="text-base font-bold" style={{ color: T.ink }}>No teachers match this segment</div>
          <div className="mt-1 text-sm" style={{ color: T.muted }}>Reset a filter to bring data back.</div>
        </Card>
      </div>
    );
  }

  const isPMM = view === "Product Marketing";
  const pickedCampaign = CAMPAIGNS.find((c) => c.id === picked) || null;

  return (
    <div className="flex" style={{ fontFamily: T.font, background: T.bg, minHeight: "100%", color: T.ink }}>
      <Rail active="Executive Overview" />

      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="px-6 py-4 flex flex-wrap items-end justify-between gap-4"
          style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: T.ink }}>Executive Overview</h1>
            <p className="mt-1 text-sm" style={{ color: T.soft }}>
              How is Edwin doing, and what is marketing contributing?
            </p>
          </div>
          <div className="flex rounded p-1" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
            {["Leadership", "Product Marketing"].map((v) => (
              <button key={v} onClick={() => setView(v)}
                className="rounded px-3 py-1 text-sm font-semibold"
                style={{
                  background: view === v ? T.surface : "transparent",
                  color: view === v ? T.blue : T.muted,
                  border: view === v ? `1px solid ${T.border}` : "1px solid transparent",
                }}>
                {v}
              </button>
            ))}
          </div>
        </header>

        {/* Global filters */}
        <div className="px-6 py-3 flex flex-wrap items-end gap-4"
          style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
          <Select label="Date range" value={String(range)} options={["30", "90", "180"]}
            onChange={(v) => setRange(Number(v))} />
          <Select label="Province" value={province} options={["All", "ON", "AB"]} onChange={setProvince} />
          <Select label="Grade" value={grade} options={["All", ...GRADES.map((g) => g.k)]} onChange={setGrade} />
          <Select label="Subject" value={subject} options={["All", ...SUBJECTS.map((s) => s.k)]} onChange={setSubject} />
          <Select label="Attribution window" value={String(win)} options={["7", "14", "30"]}
            onChange={(v) => setWin(Number(v))} />
          {isPMM && (
            <Select label="Trend metric" value={metric}
              options={["wau", "resourceOpens", "assignmentsCreated", "classesCreated"]}
              onChange={setMetric} />
          )}
        </div>

        {/* Methodology + freshness strip */}
        <div className="px-6 py-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs"
          style={{ background: "#F1F6FB", borderBottom: `1px solid ${T.border}`, color: T.soft }}>
          <span><b style={{ color: T.navy }}>Data as of</b> 26 Aug 2026 · synthetic</span>
          <span><b style={{ color: T.navy }}>Baseline</b> prior year, rescaled for seat growth</span>
          <span><b style={{ color: T.navy }}>Minimum sample</b> {MIN_N} exposed teachers</span>
          <span><b style={{ color: T.navy }}>Materiality</b> 5% adjusted</span>
          <span style={{ color: T.warn, fontWeight: 700 }}>Association, not causation</span>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* KPI row */}
          <section className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
            <KpiCard primary label="Active teacher rate"
              value={(model.activeRate * 100).toFixed(1)} unit="%"
              raw={pct(model.wauCh?.raw)} adjusted={model.wauCh?.adjusted}
              note={`${int(model.wauNow)} of ${int(model.seats)} provisioned · target 50%`} />
            <KpiCard label="Weekly active teachers" value={int(model.wauNow)}
              raw={pct(model.wauCh?.raw)} adjusted={model.wauCh?.adjusted}
              note="Rolling 7 days" />
            <KpiCard label="Adoption rate" value={(model.ahaRate * 100).toFixed(0)} unit="%"
              raw={pct(model.ahaCh?.raw)} adjusted={model.ahaCh?.adjusted}
              note="Active teachers creating a class or assignment" />
            <KpiCard label="4-week retention" value={(model.ret * 100).toFixed(0)} unit="%"
              note="Share of a cohort still active after 4 weeks" />
            <KpiCard caveat label="Campaign-associated" 
              value={model.assoc == null ? "—" : pct(model.assoc)}
              note={model.assoc == null
                ? "No campaign has a complete attribution window yet"
                : "Exposure-weighted resource engagement vs. baseline"} />
          </section>

          {/* What changed */}
          <section>
            <h2 className="mb-3 text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
              What changed
            </h2>
            <InsightStrip insights={model.insights} suppressed={model.suppressed} />
          </section>

          {/* Marketing impact + trend */}
          <section className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
            <Card className="p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
                    Marketing impact · last 30 days
                  </h2>
                  <p className="mt-1 text-xs" style={{ color: T.muted }}>
                    What marketing did, and what happened in Edwin afterward.
                  </p>
                </div>
                <div className="flex flex-wrap gap-6">
                  <div>
                    <div className="text-xs" style={{ color: T.muted }}>Campaigns launched</div>
                    <div className="text-2xl font-extrabold" style={{ ...num, color: T.ink }}>{model.recent.length}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: T.muted }}>Teachers reached</div>
                    <div className="text-2xl font-extrabold" style={{ ...num, color: T.ink }}>{int(model.reached)}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: T.muted }}>Resource engagement</div>
                    <div className="text-2xl font-extrabold" style={{ ...num, color: T.soft }}>
                      {model.resCh ? pct(model.resCh.adjusted) : "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs" style={{ color: T.muted }}>
                <span className="flex items-center gap-2">
                  <span style={{ width: 18, height: 3, background: T.blue, display: "inline-block" }} />
                  {METRIC_LABEL[metric]}
                </span>
                <span className="flex items-center gap-2">
                  <span style={{ width: 18, height: 0, borderTop: `2px dashed ${T.baseline}`, display: "inline-block" }} />
                  Seasonal baseline (prior year)
                </span>
                <span className="flex items-center gap-2">
                  <span style={{ color: T.warn, fontSize: 14 }}>▲</span> Campaign launch — click to open
                </span>
              </div>

              <div className="mt-2">
                <TrendChart series={model.series} metric={metric} campaigns={CAMPAIGNS} onPick={setPicked} />
              </div>

              <p className="mt-2 text-xs" style={{ color: T.muted, lineHeight: 1.6 }}>
                The shaded band is the gap between what happened and what the prior year predicts would have
                happened anyway. Proximity of a marker to a change does not establish that the campaign caused it.
              </p>
            </Card>
          </section>

          {/* Drill panel */}
          {pickedCampaign && (
            <DrillPanel campaign={pickedCampaign} ids={ids} windowDays={win} onClose={() => setPicked(null)} />
          )}

          {/* PMM-only progressive disclosure */}
          {isPMM && (
            <Card className="p-5">
              <h2 className="text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
                Campaign contribution · last 30 days
              </h2>
              <p className="mt-1 mb-2 text-xs" style={{ color: T.muted }}>
                Channel engagement beside the product behaviour that followed it. Select a row to open the campaign.
              </p>
              {model.recent.length === 0 ? (
                <div className="py-6 text-sm" style={{ color: T.muted }}>
                  No campaigns launched in this window.
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-xs uppercase" style={{ color: T.muted, letterSpacing: "0.05em" }}>
                      <th className="pb-2 text-left font-bold">Campaign</th>
                      <th className="pb-2 px-3 text-right font-bold">Sends</th>
                      <th className="pb-2 px-3 text-right font-bold">CTR</th>
                      <th className="pb-2 px-3 text-right font-bold">CTOR</th>
                      <th className="pb-2 pl-3 text-right font-bold">Adjusted change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.recent.map((c) => (
                      <ImpactRow key={c.id} campaign={c} ids={ids} windowDays={win} onPick={setPicked} />
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          <footer className="pb-2 text-xs" style={{ color: T.muted, lineHeight: 1.7 }}>
            Prototype on seeded synthetic data. Figures are illustrative and must not be quoted as Edwin
            performance. Design tokens are a placeholder pending the Phia system.
          </footer>
        </div>
      </main>
    </div>
  );
}
