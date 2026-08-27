/* ===========================================================================
   /analytics — CAMPAIGN-LEVEL METHODS (Phase D)
   Channel metrics, send-cohort vs. matched baseline, cohort progression,
   channel roll-up, and a single deterministic interpretation sentence.
   Every method is seasonally adjusted and N-gated; none asserts causation.
=========================================================================== */
import type { CampaignDef, Metric, SummableMetric } from "../data/schema";
import { CELLS } from "../data/segments";
import { CAMPAIGNS } from "../data/campaigns";
import { TODAY, addDays, daysBetween, provisioned } from "../data/calendar";
import { MIN_N, MATERIALITY, METRIC_LABEL } from "./constants";
import { windowMean } from "./kpis";
import { campaignImpact, reachedIn } from "./attribution";
import { pct } from "./format";

/* --- Channel metrics ------------------------------------------------------- */
export const campaignOpens = (c: CampaignDef): number => Math.round(c.sends * c.openRate);
export const campaignClicks = (c: CampaignDef): number => Math.round(c.sends * c.clickRate);
export const campaignCTR = (c: CampaignDef): number => c.clickRate; // clicks / sends
export const campaignCTOR = (c: CampaignDef): number | null =>
  c.openRate > 0 ? c.clickRate / c.openRate : null; // clicks / opens

/** The product metric a campaign most plausibly moves (largest injected-style
    signal), defaulting to resource engagement when none is declared. */
export function primaryMetric(c: CampaignDef): Metric {
  const entries = Object.entries(c.effects) as [Metric, number][];
  if (!entries.length) return "resourceOpens";
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/* --- Seasonally-adjusted change for an arbitrary group, around a launch ----- */
function groupAdjusted(
  metric: SummableMetric,
  gIds: number[],
  launch: Date,
  windowDays: number
): number | null {
  const post = windowMean(metric, gIds, addDays(launch, windowDays), windowDays);
  const pre = windowMean(metric, gIds, addDays(launch, -1), windowDays);
  const bPost = windowMean(metric, gIds, addDays(launch, windowDays), windowDays, true);
  const bPre = windowMean(metric, gIds, addDays(launch, -1), windowDays, true);
  if (!post || !pre || !bPost || !bPre) return null;
  return post / pre / (bPost / bPre) - 1;
}

/* --- Send-cohort vs. matched baseline --------------------------------------
   MVP stand-in for exposed/unexposed. Send cohort = the campaign's targeted
   cells; matched baseline = comparable non-targeted cells in the same segment.
   When a campaign targets everyone, there is no unexposed comparison group and
   a randomized holdout is required — surfaced honestly, not faked. */
export type MatchedBaseline =
  | { state: "out-of-segment" }
  | { state: "no-holdout" }
  | { state: "insufficient-window"; elapsed: number; needed: number }
  | { state: "insufficient-n"; n: number }
  | { state: "no-baseline" }
  | {
      state: "ok";
      n: number;
      sendAdjusted: number;
      baseAdjusted: number;
      lift: number; // difference-in-differences
      baseSeats: number;
    };

export function matchedBaseline(
  campaign: CampaignDef,
  metric: SummableMetric,
  ids: number[],
  windowDays: number
): MatchedBaseline {
  const launch = new Date(campaign.launch + "T00:00:00Z");
  const elapsed = daysBetween(launch, TODAY);
  const sendIds = ids.filter((id) => campaign.target(CELLS[id]));
  const baseIds = ids.filter((id) => !campaign.target(CELLS[id]));

  if (!sendIds.length) return { state: "out-of-segment" };
  if (!baseIds.length) return { state: "no-holdout" };
  if (elapsed < windowDays) return { state: "insufficient-window", elapsed, needed: windowDays };

  const n = reachedIn([campaign.id], sendIds);
  const baseSeats = baseIds.reduce((s, id) => s + provisioned(TODAY) * CELLS[id].weight, 0);
  if (n < MIN_N || baseSeats < MIN_N) return { state: "insufficient-n", n };

  const send = groupAdjusted(metric, sendIds, launch, windowDays);
  const base = groupAdjusted(metric, baseIds, launch, windowDays);
  if (send == null || base == null) return { state: "no-baseline" };

  return { state: "ok", n, sendAdjusted: send, baseAdjusted: base, lift: send - base, baseSeats };
}

/* --- Cohort progression (week over week) ----------------------------------- */
export interface WeekPoint {
  week: number;
  adjusted: number | null;
}

export function cohortProgression(
  campaign: CampaignDef,
  metric: SummableMetric,
  ids: number[]
): WeekPoint[] {
  const launch = new Date(campaign.launch + "T00:00:00Z");
  const targetIds = ids.filter((id) => campaign.target(CELLS[id]));
  if (!targetIds.length) return [];
  const elapsed = daysBetween(launch, TODAY);
  const maxWeeks = Math.min(8, Math.floor(elapsed / 7));

  const pre = windowMean(metric, targetIds, addDays(launch, -1), 7);
  const bPre = windowMean(metric, targetIds, addDays(launch, -1), 7, true);

  const out: WeekPoint[] = [];
  for (let w = 1; w <= maxWeeks; w++) {
    const end = addDays(launch, w * 7);
    const post = windowMean(metric, targetIds, end, 7);
    const bPost = windowMean(metric, targetIds, end, 7, true);
    let adjusted: number | null = null;
    if (pre && post && bPre && bPost) adjusted = post / pre / (bPost / bPre) - 1;
    out.push({ week: w, adjusted });
  }
  return out;
}

export type Sustained = "sustained" | "spike" | "insufficient";

export function sustainedVerdict(prog: WeekPoint[]): Sustained {
  const vals = prog.map((p) => p.adjusted).filter((v): v is number => v != null);
  if (vals.length < 2) return "insufficient";
  const peak = Math.max(...vals.map((v) => Math.abs(v)));
  if (peak < MATERIALITY) return "insufficient";
  const last = vals[vals.length - 1];
  return Math.abs(last) >= 0.5 * peak ? "sustained" : "spike";
}

/* --- Channel roll-up ------------------------------------------------------- */
export interface ChannelRoll {
  channel: string;
  campaigns: number;
  sends: number;
  ctr: number;
  reached: number;
  assoc: number | null; // exposure-weighted adjusted change of primary metric
}

export function channelRollup(ids: number[], windowDays: number): ChannelRoll[] {
  const map = new Map<string, CampaignDef[]>();
  for (const c of CAMPAIGNS) {
    const list = map.get(c.channel);
    if (list) list.push(c);
    else map.set(c.channel, [c]);
  }
  const out: ChannelRoll[] = [];
  for (const [channel, list] of map) {
    let sends = 0;
    let ctrNum = 0;
    let wsum = 0;
    let w = 0;
    for (const c of list) {
      sends += c.sends;
      ctrNum += c.clickRate * c.sends;
      const r = campaignImpact(c, primaryMetric(c), ids, windowDays);
      if (r.state === "ok") {
        wsum += r.adjusted * r.n;
        w += r.n;
      }
    }
    out.push({
      channel,
      campaigns: list.length,
      sends,
      ctr: sends ? ctrNum / sends : 0,
      reached: reachedIn(
        list.map((c) => c.id),
        ids
      ),
      assoc: w ? wsum / w : null,
    });
  }
  return out.sort((a, b) => b.sends - a.sends);
}

/* --- One deterministic interpretation sentence (gated, caveated) ----------- */
export interface Interpretation {
  tone: "positive" | "negative" | "watch";
  text: string;
  detail: string;
}

export function campaignInterpretation(
  campaign: CampaignDef,
  ids: number[],
  windowDays: number
): Interpretation | null {
  const metric = primaryMetric(campaign);
  const label = METRIC_LABEL[metric];
  const r = campaignImpact(campaign, metric, ids, windowDays);

  if (r.state === "out-of-segment") return null;
  if (r.state === "insufficient-window")
    return {
      tone: "watch",
      text: `Too early to judge ${campaign.name}.`,
      detail: `Needs ${r.needed - r.elapsed} more day${
        r.needed - r.elapsed === 1 ? "" : "s"
      } for a ${windowDays}-day window.`,
    };
  if (r.state === "insufficient-n")
    return {
      tone: "watch",
      text: `Not enough exposed teachers to judge ${campaign.name}.`,
      detail: `${r.n.toLocaleString()} exposed, below the ${MIN_N}-teacher minimum.`,
    };
  if (r.state === "no-baseline") return null;
  if (!r.material)
    return {
      tone: "watch",
      text: `${label} shows no material change after ${campaign.name}.`,
      detail: `Adjusted ${pct(r.adjusted)}, within the ±5% materiality band. Raw ${pct(
        r.raw
      )}; seasonal expectation ${pct(r.expected)}.`,
    };

  const verdict = sustainedVerdict(cohortProgression(campaign, metric, ids));
  const sustainText =
    verdict === "sustained"
      ? "The lift has held week over week."
      : verdict === "spike"
      ? "The movement looks like a one-week spike rather than a sustained shift."
      : "";
  return {
    tone: r.adjusted > 0 ? "positive" : "negative",
    text: `${label} is ${pct(r.adjusted)} ${
      r.adjusted > 0 ? "above" : "below"
    } the seasonal baseline in the ${windowDays} days after ${campaign.name}.`,
    detail:
      `${r.n.toLocaleString()} teachers exposed. Observed association over a ${windowDays}-day window, not proven causation. ${sustainText}`.trim(),
  };
}
