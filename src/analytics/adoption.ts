/* ===========================================================================
   /analytics — ADOPTION & ENGAGEMENT (Phase F)
   The activation funnel, Day-7 / monthly-active gauges, and feature adoption.

   HONESTY NOTE: the synthetic data is aggregate (daily metric flows per cell),
   not per-user cohort events. Distinct-teacher funnel stages and activation
   rates are therefore MODELLED from those aggregates — deterministically and
   monotonically — rather than counted. A real deployment would count distinct
   per-user cohort events (see PRD Open Questions #1–#4). Every consumer of this
   module must surface that these are modelled estimates.
=========================================================================== */
import type { SummableMetric } from "../data/schema";
import { CELLS } from "../data/segments";
import { TODAY, addDays, iso, provisioned } from "../data/calendar";
import { sumOn, windowMean } from "./kpis";

export const DAY7_TARGET = 0.7; // Day-7 activation OKR
export const MONTHLY_TARGET = 0.5; // monthly LMS-active OKR

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Seats (provisioned teachers) in the selected segment, as of today. */
export function seatsOf(ids: number[]): number {
  return ids.reduce((s, id) => s + provisioned(TODAY) * CELLS[id].weight, 0);
}

/** Events per active teacher over a trailing window: total metric flow divided
    by the mean daily active count. Feeds a zero-truncated-Poisson reach. */
function perActive(metric: SummableMetric, ids: number[], days: number): number | null {
  let flow = 0;
  let act = 0;
  let n = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(TODAY, -i);
    const f = sumOn(iso(d), metric, ids);
    const a = sumOn(iso(d), "dailyActive", ids);
    if (f != null && a != null) {
      flow += f;
      act += a;
      n++;
    }
  }
  if (!n || act <= 0) return null;
  const meanActive = act / n;
  return flow / meanActive; // events per active teacher across the window
}

/** Distinct-teacher reach implied by an event intensity (1 − e^−λ). */
const reachFrom = (lambda: number | null): number =>
  lambda == null ? 0 : 1 - Math.exp(-lambda);

/** Weekly-active share, and the monthly reach implied by four independent weeks. */
function activeShares(ids: number[]): { seats: number; wauRate: number; monthly: number } {
  const seats = seatsOf(ids);
  const wau = windowMean("wau", ids, TODAY, 7) ?? 0;
  const wauRate = seats > 0 ? clamp(wau / seats, 0, 0.95) : 0;
  const monthly = clamp(1 - Math.pow(1 - wauRate, 4), 0, 0.98);
  return { seats, wauRate, monthly };
}

export interface FunnelStage {
  key: string;
  label: string;
  journey: string; // J1–J5
  count: number;
  shareOfTop: number; // vs invited
  shareOfPrev: number; // conversion from previous stage
}

/* --- Activation funnel: Invited → login → resource → class → assignment ----- */
export function activationFunnel(ids: number[]): { seats: number; stages: FunnelStage[] } {
  const { seats, monthly } = activeShares(ids);

  // Modelled conversions (monotonic). Resource use is near-universal among the
  // active; class creation is the real bottleneck; assignment/student-invite is
  // the deepest stage among class creators.
  const resourceConv = clamp(reachFrom(perActive("resourceOpens", ids, 30)), 0.7, 0.95);
  const classReach = clamp(reachFrom(perActive("classesCreated", ids, 30)), 0.02, 0.9);
  const assignConv = clamp(reachFrom(perActive("assignmentsCreated", ids, 30)) * 0.8, 0.35, 0.85);

  const invited = seats;
  const login = invited * monthly;
  const resource = login * resourceConv;
  const cls = login * classReach; // relative to login, naturally ≤ resource
  const assignment = cls * assignConv;

  const counts = [invited, login, resource, cls, assignment];
  const meta = [
    { key: "invited", label: "Invited", journey: "J1" },
    { key: "login", label: "First login", journey: "J2" },
    { key: "resource", label: "First resource", journey: "J3" },
    { key: "class", label: "Class created", journey: "J4" },
    { key: "assignment", label: "Assignment / student invited", journey: "J5" },
  ];

  const stages: FunnelStage[] = meta.map((m, i) => ({
    ...m,
    count: counts[i],
    shareOfTop: invited > 0 ? counts[i] / invited : 0,
    shareOfPrev: i === 0 ? 1 : counts[i - 1] > 0 ? counts[i] / counts[i - 1] : 0,
  }));
  return { seats, stages };
}

/* --- OKR gauges ------------------------------------------------------------ */
export interface Gauge {
  value: number;
  target: number;
  label: string;
  sublabel: string;
}

export function activationGauges(ids: number[]): { day7: Gauge; monthly: Gauge } {
  const { wauRate, monthly } = activeShares(ids);
  // Day-7 activation modelled as a proxy of the weekly-active intensity of the
  // newly-provisioned population; sits below target during the fall ramp.
  const day7 = clamp(wauRate * 2.4, 0.02, 0.98);
  return {
    day7: {
      value: day7,
      target: DAY7_TARGET,
      label: "Day-7 activation",
      sublabel: "New teachers reaching an activation event within 7 days",
    },
    monthly: {
      value: monthly,
      target: MONTHLY_TARGET,
      label: "Monthly active on any LMS feature",
      sublabel: "Distinct teachers active in ≥1 of the last 4 weeks",
    },
  };
}

/* --- Feature adoption ------------------------------------------------------ */
export interface FeatureAdoption {
  feature: string;
  reach: number; // share of active teachers using the feature in the period
}

export function featureAdoption(ids: number[]): FeatureAdoption[] {
  const wau = windowMean("wau", ids, TODAY, 7) ?? 0;
  const ahaNow = windowMean("ahaUsers", ids, TODAY, 7) ?? 0;
  const out: FeatureAdoption[] = [
    { feature: "Resource library", reach: clamp(reachFrom(perActive("resourceOpens", ids, 30)), 0, 0.99) },
    { feature: "Assignments", reach: clamp(reachFrom(perActive("assignmentsCreated", ids, 30)), 0, 0.99) },
    { feature: "Classes", reach: clamp(reachFrom(perActive("classesCreated", ids, 30)), 0, 0.99) },
    { feature: "Adoption (class or assignment)", reach: wau > 0 ? clamp(ahaNow / wau, 0, 0.99) : 0 },
  ];
  return out.sort((a, b) => b.reach - a.reach);
}
