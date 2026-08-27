/* ===========================================================================
   /analytics — CAMPAIGN ATTRIBUTION
   Reach de-duplication, campaigns-in-window, and the before/after impact
   calculation — seasonally adjusted and N-gated.
=========================================================================== */
import type { CampaignDef, CampaignImpact, SummableMetric } from "../data/schema";
import { CELLS } from "../data/segments";
import { CAMPAIGNS } from "../data/campaigns";
import { PANEL } from "../data/generate";
import { TODAY, addDays, daysBetween } from "../data/calendar";
import { MIN_N, MATERIALITY } from "./constants";
import { windowMean } from "./kpis";

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

/* Before vs. after for one campaign, seasonally adjusted and N-gated. */
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

  const post = windowMean(metric, targetIds, addDays(launch, windowDays), windowDays);
  const pre = windowMean(metric, targetIds, addDays(launch, -1), windowDays);
  const bPost = windowMean(metric, targetIds, addDays(launch, windowDays), windowDays, true);
  const bPre = windowMean(metric, targetIds, addDays(launch, -1), windowDays, true);
  if (!post || !pre || !bPost || !bPre) return { state: "no-baseline", n };

  const adjusted = post / pre / (bPost / bPre) - 1;
  return {
    state: "ok",
    n,
    adjusted,
    raw: post / pre - 1,
    expected: bPost / bPre - 1,
    material: Math.abs(adjusted) >= MATERIALITY,
    pre,
    post,
    bPre,
    bPost,
  };
}
