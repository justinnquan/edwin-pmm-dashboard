/* ===========================================================================
   /data — CAMPAIGNS, RELEASES, GROUND-TRUTH MULTIPLIER
   `effects` is the injected ground truth. The analytics layer must recover it
   from the data alone. The mix is deliberately honest: one campaign that is
   pure seasonality, one high-CTR/no-impact, one sustained real lift, one dud.
=========================================================================== */
import type { Cell, CampaignDef, Metric, Release } from "./schema";
import { daysBetween, fromIso } from "../lib/dates";
import { compileTarget } from "./target";

/** Targets the whole platform. */
const ALL = {};

export const CAMPAIGNS: CampaignDef[] = [
  {
    id: "c-report-card",
    name: "Report Card Season Time-Savers",
    type: "Product/feature launch",
    channel: "Pardot email",
    launch: "2026-06-01",
    audience: "ON + AB, Primary and Junior/Intermediate",
    targetSpec: { grade: ["Primary (1–3)", "Junior/Intermediate (4–8)"] },
    sends: 19400,
    openRate: 0.41,
    clickRate: 0.062,
    objectiveMetric: "assignmentsCreated",
    effects: { assignmentsCreated: 0.14, resourceOpens: 0.07 },
    halfLife: 30,
  },
  {
    id: "c-summer-prep",
    name: "Summer Prep — Build Your First Class",
    type: "Re-engagement",
    channel: "Pardot email",
    launch: "2026-07-14",
    audience: "All teachers",
    targetSpec: ALL,
    sends: 24100,
    openRate: 0.22,
    clickRate: 0.019,
    objectiveMetric: "classesCreated",
    effects: {},
    halfLife: 10,
  },
  {
    id: "c-threaded",
    name: "New Content — Threaded Releases",
    type: "Release notes",
    channel: "In-product release notes",
    launch: "2026-08-05",
    audience: "All teachers",
    targetSpec: ALL,
    sends: 8900,
    openRate: 1.0,
    clickRate: 0.031,
    objectiveMetric: "resourceOpens",
    effects: { resourceOpens: 0.02 },
    halfLife: 14,
  },
  {
    id: "c-bts",
    name: "Back to School 2026 — Ready Day One",
    type: "Pardot email",
    channel: "Pardot email",
    launch: "2026-08-10",
    audience: "All teachers",
    targetSpec: ALL,
    sends: 27800,
    openRate: 0.48,
    clickRate: 0.094,
    objectiveMetric: "wau",
    effects: { wau: 0.02 },
    halfLife: 21,
  },
  {
    id: "c-pc-preview",
    name: "ELA Progress Checks — Preview",
    type: "Product/feature launch",
    channel: "Pardot email",
    launch: "2026-08-17",
    audience: "Ontario, Secondary English/ELA",
    targetSpec: { province: ["ON"], grade: ["Secondary (9–12)"], subject: ["English/ELA"] },
    sends: 2180,
    openRate: 0.54,
    clickRate: 0.128,
    objectiveMetric: "resourceOpens",
    effects: { resourceOpens: 0.01 },
    halfLife: 14,
  },
  {
    id: "c-ets",
    name: "Edwin Teaching System — First Look",
    type: "In-app notification",
    channel: "In-app notification",
    launch: "2026-08-18",
    audience: "All teachers",
    targetSpec: ALL,
    sends: 6240,
    openRate: 1.0,
    clickRate: 0.27,
    objectiveMetric: "resourceOpens",
    effects: { resourceOpens: 0.12, wau: 0.06 },
    halfLife: 45,
  },
  {
    id: "c-slides",
    name: "Edwin Slides — Coming Soon",
    type: "In-app notification",
    channel: "In-app notification",
    launch: "2026-08-24",
    audience: "All teachers",
    targetSpec: ALL,
    sends: 1980,
    openRate: 1.0,
    clickRate: 0.19,
    objectiveMetric: "resourceOpens",
    effects: { resourceOpens: 0.05 },
    halfLife: 21,
  },
];

export const RELEASES: Release[] = [
  { date: "2026-04-14", name: "Assignment auto-grading" },
  { date: "2026-08-24", name: "Edwin Teaching System live" },
];

// Compiled once: campaignMultiplier runs per cell per day per metric.
const TARGETS = new Map(CAMPAIGNS.map((c) => [c.id, compileTarget(c.targetSpec)]));

// Multiplier applied by the generator; decays from launch.
export function campaignMultiplier(cell: Cell, date: Date, metric: Metric): number {
  let m = 1;
  for (const c of CAMPAIGNS) {
    const lift = c.effects[metric];
    if (!lift || !TARGETS.get(c.id)!(cell)) continue;
    const d = daysBetween(fromIso(c.launch), date);
    if (d < 0) continue;
    m *= 1 + lift * Math.pow(0.5, d / c.halfLife);
  }
  return m;
}
