/* ===========================================================================
   /analytics — CAMPAIGN ATTRIBUTION
   Reach de-duplication, campaigns-in-window, and the before/after impact
   calculation — seasonally adjusted, N- and volume-gated, and gated on the
   change's own uncertainty band rather than a fixed threshold.
=========================================================================== */
import type { PublicCampaign, CampaignImpact, SummableMetric } from "../data/schema";
import { src } from "../data/source";
import { addDays, daysBetween, fromIso } from "../lib/dates";
import { MIN_N, MIN_DAILY_ACTIVE, WAU_TO_DAILY, MATERIALITY, CONFIDENCE_Z } from "./constants";
import { windowMean, windowStats, adjustedSE } from "./kpis";

/** Distinct teachers exposed to at least one of these campaigns, within the
    current segment filter. A union, not a sum: a teacher reached by three
    campaigns counts once. Null when the source has no exposure data — which is
    the likely state on first real data, and must not be read as zero. */
export function reachedIn(campaignIds: string[], ids: number[]): number | null {
  return src().reach(campaignIds, ids);
}

export function campaignsInWindow(days: number): PublicCampaign[] {
  const asOf = src().asOf;
  const from = addDays(asOf, -days);
  return src().campaigns.filter((c) => {
    const d = fromIso(c.launch);
    return d >= from && d <= asOf;
  });
}

/* Before vs. after for one campaign: seasonally adjusted, N-gated, volume-gated,
   and called material only when it clears both the 5% floor and its own ~95%
   uncertainty band. */
export function campaignImpact(
  campaign: PublicCampaign,
  metric: SummableMetric,
  ids: number[],
  windowDays: number
): CampaignImpact {
  const cells = src().cells;
  const launch = fromIso(campaign.launch);
  const elapsed = daysBetween(launch, src().asOf);
  const targetIds = ids.filter((id) => campaign.target(cells[id]));
  // A source with no exposure data cannot clear the minimum-N gate, and says so
  // through the same state rather than silently reporting zero reach.
  const n = targetIds.length ? reachedIn([campaign.id], targetIds) ?? 0 : 0;

  if (!targetIds.length) return { state: "out-of-segment", n: 0 };
  if (elapsed < windowDays)
    return { state: "insufficient-window", n, elapsed, needed: windowDays };
  if (n < MIN_N) return { state: "insufficient-n", n };

  // Activity-volume gate: low daily volume makes the comparison unstable even
  // when the exposed teacher count passes MIN_N.
  // The volume gate normally reads daily actives. A source without that column
  // fills zeros, not nulls, so the gate would fire for every campaign and every
  // metric — including one whose objective is the single metric that IS
  // present. Fall back to weekly actives at a proportionate floor instead:
  // MIN_DAILY_ACTIVE is a per-day level, and a rolling 7-day distinct count of
  // the same population is larger, so the floor scales with it.
  const hasDaily = src().coverage.metrics.dailyActive;
  const gateMetric: SummableMetric = hasDaily ? "dailyActive" : "wau";
  const floor = hasDaily ? MIN_DAILY_ACTIVE : MIN_DAILY_ACTIVE * WAU_TO_DAILY;
  const activePre = windowMean(gateMetric, targetIds, addDays(launch, -1), windowDays);
  const activePost = windowMean(gateMetric, targetIds, addDays(launch, windowDays), windowDays);
  if (activePre == null || activePost == null) return { state: "no-baseline", n };
  const active = Math.min(activePre, activePost);
  if (active < floor) return { state: "insufficient-volume", n, active };

  const sPost = windowStats(metric, targetIds, addDays(launch, windowDays), windowDays);
  const sPre = windowStats(metric, targetIds, addDays(launch, -1), windowDays);
  const sBPost = windowStats(metric, targetIds, addDays(launch, windowDays), windowDays, true);
  const sBPre = windowStats(metric, targetIds, addDays(launch, -1), windowDays, true);
  if (!sPost || !sPre || !sBPost || !sBPre) return { state: "no-baseline", n };
  const post = sPost.mean;
  const pre = sPre.mean;
  const bPost = sBPost.mean;
  const bPre = sBPre.mean;
  if (!post || !pre || !bPost || !bPre) return { state: "no-baseline", n };

  const adjusted = post / pre / (bPost / bPre) - 1;
  const se = adjustedSE(
    metric,
    targetIds,
    addDays(launch, windowDays),
    addDays(launch, -1),
    windowDays,
    adjusted
  );
  if (se == null) return { state: "no-baseline", n };
  const threshold = Math.max(MATERIALITY, CONFIDENCE_Z * se);

  return {
    state: "ok",
    n,
    adjusted,
    raw: post / pre - 1,
    expected: bPost / bPre - 1,
    material: Math.abs(adjusted) >= threshold,
    se,
    threshold,
    pre,
    post,
    bPre,
    bPost,
  };
}
