/* ===========================================================================
   /analytics — CAMPAIGN ATTRIBUTION
   Reach de-duplication, campaigns-in-window, and the before/after impact
   calculation — seasonally adjusted, N- and volume-gated, and gated on the
   change's own uncertainty band rather than a fixed threshold.
=========================================================================== */
import type { CampaignDef, CampaignImpact, SummableMetric } from "../data/schema";
import { CELLS } from "../data/segments";
import { CAMPAIGNS } from "../data/campaigns";
import { PANEL } from "../data/generate";
import { TODAY, addDays, daysBetween } from "../data/calendar";
import { MIN_N, MIN_DAILY_ACTIVE, MATERIALITY, CONFIDENCE_Z } from "./constants";
import { windowMean, windowStats, adjustedSE } from "./kpis";

// Distinct teachers exposed, within the current segment filter.
export function reachedIn(campaignIds: string[], ids: number[]): number {
  const set = new Set(ids);
  const bits = campaignIds.map((c) => PANEL.exposure[c]).filter(Boolean) as Uint8Array[];
  if (!bits.length) return 0;
  let n = 0;
  for (let i = 0; i < PANEL.n; i++) {
    if (!set.has(PANEL.cellOf[i])) continue;
    for (const b of bits)
      if (b[i]) {
        n++;
        break;
      }
  }
  return n;
}

export function campaignsInWindow(days: number): CampaignDef[] {
  const from = addDays(TODAY, -days);
  return CAMPAIGNS.filter((c) => {
    const d = new Date(c.launch + "T00:00:00Z");
    return d >= from && d <= TODAY;
  });
}

/* Before vs. after for one campaign: seasonally adjusted, N-gated, volume-gated,
   and called material only when it clears both the 5% floor and its own ~95%
   uncertainty band. */
export function campaignImpact(
  campaign: CampaignDef,
  metric: SummableMetric,
  ids: number[],
  windowDays: number
): CampaignImpact {
  const launch = new Date(campaign.launch + "T00:00:00Z");
  const elapsed = daysBetween(launch, TODAY);
  const targetIds = ids.filter((id) => campaign.target(CELLS[id]));
  const n = targetIds.length ? reachedIn([campaign.id], targetIds) : 0;

  if (!targetIds.length) return { state: "out-of-segment", n: 0 };
  if (elapsed < windowDays)
    return { state: "insufficient-window", n, elapsed, needed: windowDays };
  if (n < MIN_N) return { state: "insufficient-n", n };

  // Activity-volume gate: low daily volume makes the comparison unstable even
  // when the exposed teacher count passes MIN_N.
  const activePre = windowMean("dailyActive", targetIds, addDays(launch, -1), windowDays);
  const activePost = windowMean("dailyActive", targetIds, addDays(launch, windowDays), windowDays);
  if (activePre == null || activePost == null) return { state: "no-baseline", n };
  const active = Math.min(activePre, activePost);
  if (active < MIN_DAILY_ACTIVE) return { state: "insufficient-volume", n, active };

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
