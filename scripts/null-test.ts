/* ===========================================================================
   scripts/null-test.ts — regression test for the attribution method.

   Run with:  npm run null-test

   Two things:
   1. NULL TEST. Sweep every launch date in a campaign-free window (true effect
      = 0) and measure how often the method reports a MATERIAL change. That
      false-positive rate is the method's noise floor and must stay ≤ 5% at
      every attribution window (7/14/30) for both all-cells and a small segment.
   2. GROUND-TRUTH RECOVERY. For each real campaign, print its declared
      objective, the generator's injected effect, and the recovered raw /
      adjusted change with its material verdict.

   This script lives outside /analytics, so it may read the generator's answer
   key (`effects`) to score recovery — the barrier only applies to the app.
=========================================================================== */
import { CELLS } from "../src/data/segments";
import { CAMPAIGNS } from "../src/data/campaigns";
import { addDays, daysBetween, iso } from "../src/data/calendar";
import { cellFilter, windowStats } from "../src/analytics/kpis";
import { campaignImpact } from "../src/analytics/attribution";
import { cohortProgression, sustainedVerdict } from "../src/analytics/campaign";
import { MATERIALITY, CONFIDENCE_Z } from "../src/analytics/constants";
import type { Metric, SummableMetric } from "../src/data/schema";

const WINDOWS = [7, 14, 30];
const SWEEP_METRIC: SummableMetric = "resourceOpens";
const SWEEP_START = new Date(Date.UTC(2026, 1, 15)); // 15 Feb 2026
const SWEEP_END = new Date(Date.UTC(2026, 4, 25)); // 25 May 2026

/* Mirror campaignImpact's core math (no reach/volume gating) for a fake launch
   date, returning the adjusted change and whether it clears its own band. */
function impactAt(
  metric: SummableMetric,
  ids: number[],
  launch: Date,
  w: number
): { adjusted: number; material: boolean } | null {
  const sPost = windowStats(metric, ids, addDays(launch, w), w);
  const sPre = windowStats(metric, ids, addDays(launch, -1), w);
  const sBPost = windowStats(metric, ids, addDays(launch, w), w, true);
  const sBPre = windowStats(metric, ids, addDays(launch, -1), w, true);
  if (!sPost || !sPre || !sBPost || !sBPre) return null;
  const post = sPost.mean;
  const pre = sPre.mean;
  const bPost = sBPost.mean;
  const bPre = sBPre.mean;
  if (!post || !pre || !bPost || !bPre) return null;
  const adjusted = post / pre / (bPost / bPre) - 1;
  const relVar =
    (sPost.se / post) ** 2 +
    (sPre.se / pre) ** 2 +
    (sBPost.se / bPost) ** 2 +
    (sBPre.se / bPre) ** 2;
  const se = (1 + adjusted) * Math.sqrt(relVar);
  const threshold = Math.max(MATERIALITY, CONFIDENCE_Z * se);
  return { adjusted, material: Math.abs(adjusted) >= threshold };
}

const pctile = (arr: number[], q: number): number => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const idx = (s.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
};

const fp = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
const pad = (s: string, n: number) => s.padEnd(n);
const padL = (s: string, n: number) => s.padStart(n);

const ALL_IDS = CELLS.map((c) => c.id);
const SMALL_IDS = cellFilter({ province: "ON", grade: "Secondary (9–12)", subject: "English/ELA" });

interface Bucket {
  adj: number[];
  material: number;
  total: number;
}

function sweep(ids: number[]): Record<number, Bucket> {
  const buckets: Record<number, Bucket> = {};
  for (const w of WINDOWS) buckets[w] = { adj: [], material: 0, total: 0 };
  for (let d = new Date(SWEEP_START); d <= SWEEP_END; d = addDays(d, 1)) {
    for (const w of WINDOWS) {
      const r = impactAt(SWEEP_METRIC, ids, d, w);
      if (!r) continue;
      buckets[w].adj.push(r.adjusted);
      buckets[w].total++;
      if (r.material) buckets[w].material++;
    }
  }
  return buckets;
}

function reportSweep(title: string, ids: number[]): boolean {
  console.log(`\n${title}  (metric: ${SWEEP_METRIC}, true effect = 0)`);
  console.log(
    pad("  Window", 10) +
      padL("p5", 9) +
      padL("median", 10) +
      padL("p95", 9) +
      padL("maxAbs", 9) +
      padL("material%", 12)
  );
  let pass = true;
  const b = sweep(ids);
  for (const w of WINDOWS) {
    const bk = b[w];
    const maxAbs = Math.max(...bk.adj.map(Math.abs));
    const share = bk.material / bk.total;
    if (share > 0.05) pass = false;
    console.log(
      pad(`  ${w}-day`, 10) +
        padL(fp(pctile(bk.adj, 0.05)), 9) +
        padL(fp(pctile(bk.adj, 0.5)), 10) +
        padL(fp(pctile(bk.adj, 0.95)), 9) +
        padL(fp(maxAbs), 9) +
        padL(`${(share * 100).toFixed(1)}% ${share > 0.05 ? "✗" : "✓"}`, 12)
    );
  }
  return pass;
}

function reportRecovery() {
  console.log("\nGROUND-TRUTH RECOVERY  (all cells)");
  console.log(
    pad("  Campaign", 34) +
      pad("Objective", 22) +
      padL("Injected", 9) +
      padL("Win", 5) +
      padL("Raw", 9) +
      padL("Adjusted", 11) +
      padL("±SE", 8) +
      padL("Bar", 8) +
      padL("Material", 10) +
      padL("Verdict", 14)
  );
  const today = new Date(Date.UTC(2026, 7, 26));
  for (const c of CAMPAIGNS) {
    const launch = new Date(c.launch + "T00:00:00Z");
    const elapsed = daysBetween(launch, today);
    const injected = (c.effects as Partial<Record<Metric, number>>)[c.objectiveMetric] ?? 0;
    const fits = WINDOWS.filter((w) => elapsed >= w);
    const wins = fits.length ? fits : [Math.min(...WINDOWS)];
    const verdict = sustainedVerdict(cohortProgression(c, c.objectiveMetric, ALL_IDS));
    let first = true;
    for (const w of wins) {
      const r = campaignImpact(c, c.objectiveMetric, ALL_IDS, w);
      const raw = r.state === "ok" ? fp(r.raw) : "—";
      const adj = r.state === "ok" ? fp(r.adjusted) : "—";
      const seStr = r.state === "ok" ? `${(r.se * 100).toFixed(1)}%` : "—";
      const barStr = r.state === "ok" ? `${(r.threshold * 100).toFixed(1)}%` : "—";
      const mat = r.state === "ok" ? (r.material ? "MATERIAL" : "no") : r.state;
      console.log(
        pad(first ? "  " + c.name.slice(0, 30) : "", 34) +
          pad(first ? c.objectiveMetric : "", 22) +
          padL(first ? fp(injected) : "", 9) +
          padL(String(w), 5) +
          padL(raw, 9) +
          padL(adj, 11) +
          padL(seStr, 8) +
          padL(barStr, 8) +
          padL(mat, 10) +
          padL(first ? verdict : "", 14)
      );
      first = false;
    }
  }
}

console.log("=".repeat(78));
console.log("EDWIN PMM DASHBOARD — ATTRIBUTION NULL TEST");
console.log("=".repeat(78));
console.log(
  `Sweeping ${iso(SWEEP_START)} → ${iso(SWEEP_END)} — a campaign-free window where the`
);
console.log("true campaign effect is exactly zero. Any 'material' verdict is a false positive.");

const passAll = reportSweep("ALL CELLS", ALL_IDS);
const passSmall = reportSweep("SMALL SEGMENT — ON / Secondary / English-ELA", SMALL_IDS);

reportRecovery();

console.log("\n" + "-".repeat(78));
const ok = passAll && passSmall;
console.log(
  ok
    ? "PASS — false-positive rate ≤ 5% at every window for both sweeps."
    : "FAIL — a sweep exceeded the 5% false-positive ceiling (see ✗ above)."
);
console.log("-".repeat(78));
process.exit(ok ? 0 : 1);
