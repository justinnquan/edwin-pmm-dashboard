/* ===========================================================================
   /analytics — SEGMENT COMPARISON & OPPORTUNITY (Phase F)
   Per-dimension comparison rows and an opportunity ranking. Every row is
   min-N gated: underpowered cells render an insufficient-data state rather
   than a misleading number.
=========================================================================== */
import type { Cell } from "../data/schema";
import { src } from "../data/source";
import { MIN_N } from "./constants";
import { windowMean, seatWeightedRate } from "./kpis";
import { campaignsInWindow, campaignImpact } from "./attribution";
import { MONTHLY_TARGET } from "./adoption";

export type Dimension = "province" | "grade" | "subject";

export const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "province", label: "Province" },
  { key: "grade", label: "Grade band" },
  { key: "subject", label: "Subject" },
];

const valuesFor = (d: Dimension): string[] =>
  d === "province"
    ? src().dimensions.province
    : d === "grade"
    ? src().dimensions.grade
    : src().dimensions.subject;

const matches = (c: Cell, d: Dimension, v: string): boolean =>
  d === "province" ? c.province === v : d === "grade" ? c.grade === v : c.subject === v;

export interface SegmentRow {
  key: string;
  seats: number;
  gated: boolean; // seats below MIN_N
  wau: number | null;
  activeRate: number | null;
  adoptionRate: number | null;
  retention: number | null;
  assoc: number | null; // exposure-weighted campaign-associated change
  /** Why `assoc` is null, so the table can say rather than show a bare dash. */
  assocReason: "no-campaigns" | "none-cleared" | null;
}

function rowFor(ids: number[], key: string, windowDays: number): SegmentRow {
  const seats = src().seatsOn(src().asOf, ids) ?? 0;
  if (!ids.length || seats < MIN_N) {
    return { key, seats, gated: true, wau: null, activeRate: null, adoptionRate: null, retention: null, assoc: null, assocReason: null };
  }
  const wau = windowMean("wau", ids, src().asOf, 7);
  const activeRate = wau != null && seats > 0 ? wau / seats : null;
  const ahaNow = windowMean("ahaUsers", ids, src().asOf, 7);
  const adoptionRate = ahaNow != null && wau ? ahaNow / wau : null;
  const retention = seatWeightedRate("retentionW4", ids, src().asOf, 7);

  let wsum = 0;
  let w = 0;
  const considered = campaignsInWindow(30);
  for (const c of considered) {
    const r = campaignImpact(c, c.objectiveMetric, ids, windowDays);
    if (r.state === "ok") {
      wsum += r.adjusted * r.n;
      w += r.n;
    }
  }
  const assoc = w ? wsum / w : null;
  const assocReason =
    assoc != null ? null : considered.length === 0 ? "no-campaigns" : "none-cleared";

  return { key, seats, gated: false, wau, activeRate, adoptionRate, retention, assoc, assocReason };
}

/** Comparison rows for a dimension, within an optional base segment filter. */
export function segmentRows(
  dimension: Dimension,
  baseIds: number[],
  windowDays: number
): SegmentRow[] {
  const baseSet = new Set(baseIds);
  return valuesFor(dimension).map((v) => {
    const ids = src().cells.filter((c) => baseSet.has(c.id) && matches(c, dimension, v)).map((c) => c.id);
    return rowFor(ids, v, windowDays);
  });
}

export interface Opportunity {
  key: string; // "ON · Secondary (9–12)"
  seats: number;
  activeRate: number;
  gapToTarget: number; // MONTHLY_TARGET − activeRate, only when positive
  size: number; // gap × seats ≈ teachers below target
}

/** Largest gaps to the monthly-active target, sized by population. Province ×
    grade cells, min-N gated, ranked by how many teachers sit below target. */
export function opportunityRanking(baseIds: number[]): Opportunity[] {
  const baseSet = new Set(baseIds);
  const out: Opportunity[] = [];
  for (const p of src().dimensions.province)
    for (const g of src().dimensions.grade) {
      const ids = src().cells.filter(
        (c) => baseSet.has(c.id) && c.province === p && c.grade === g
      ).map((c) => c.id);
      if (!ids.length) continue;
      const seats = src().seatsOn(src().asOf, ids) ?? 0;
      if (seats < MIN_N) continue;
      const wau = windowMean("wau", ids, src().asOf, 7);
      if (wau == null || seats <= 0) continue;
      const activeRate = wau / seats;
      const gap = MONTHLY_TARGET - activeRate;
      if (gap <= 0) continue;
      out.push({ key: `${p} · ${g}`, seats, activeRate, gapToTarget: gap, size: gap * seats });
    }
  return out.sort((a, b) => b.size - a.size);
}

/** Suppressed (below-N) cells for a dimension, so the UI can report the count. */
export function suppressedCount(rows: SegmentRow[]): number {
  return rows.filter((r) => r.gated).length;
}

export { MONTHLY_TARGET };
