/* ===========================================================================
   /analytics — CAMPAIGN-LEVEL METHODS (Phase D)
   Channel metrics, targeted-segment comparison, cohort progression, channel
   roll-up, and a single deterministic interpretation sentence. Every method is
   seasonally adjusted and gated; none asserts causation.

   GROUND-TRUTH BARRIER: no file under /analytics may import or read `effects`
   (the generator's answer key). A campaign's objective comes from the
   PMM-authored `objectiveMetric`, which will exist in real data; `effects` will
   not. Reading it here would both flatter results and break the real-data swap.
=========================================================================== */
import type { CampaignDef, Metric, SummableMetric } from "../data/schema";
import { CELLS } from "../data/segments";
import { CAMPAIGNS } from "../data/campaigns";
import { TODAY, addDays, daysBetween, provisioned } from "../data/calendar";
import { MIN_N, MATERIALITY, METRIC_LABEL } from "./constants";
import { windowMean } from "./kpis";
import { campaignImpact, campaignsInWindow, reachedIn } from "./attribution";
import { pct } from "./format";

/* --- Channel metrics ------------------------------------------------------- */
export const campaignOpens = (c: CampaignDef): number => Math.round(c.sends * c.openRate);
export const campaignClicks = (c: CampaignDef): number => Math.round(c.sends * c.clickRate);
export const campaignCTR = (c: CampaignDef): number => c.clickRate; // clicks / sends
/** CTOR is only meaningful where opens are a real funnel step. In-app and
    release-notes channels have openRate 1.0 (no open concept), so CTOR would
    just duplicate CTR — return null there and render "N/A". */
export const campaignCTOR = (c: CampaignDef): number | null =>
  c.openRate > 0 && c.openRate < 1 ? c.clickRate / c.openRate : null;

/** The metric a campaign is judged against — its declared objective. */
export function primaryMetric(c: CampaignDef): Metric {
  return c.objectiveMetric;
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

/* --- Targeted segment vs. rest of platform ---------------------------------
   NOT a matched control. The comparison group (non-targeted cells) differs
   systematically from the targeted group in population and seasonality, so no
   matching is claimed. When a campaign targets everyone there is no comparison
   group at all — surfaced honestly as `no-holdout`, the strongest argument in
   the product for reserving a randomised holdout before send. */
export type SegmentComparison =
  | { state: "out-of-segment" }
  | { state: "no-holdout" }
  | { state: "insufficient-window"; elapsed: number; needed: number }
  | { state: "insufficient-n"; n: number }
  | { state: "no-baseline" }
  | {
      state: "ok";
      n: number;
      sendAdjusted: number;
      restAdjusted: number;
      lift: number; // difference-in-differences (targeted − rest)
      restSeats: number;
    };

export function segmentComparison(
  campaign: CampaignDef,
  metric: SummableMetric,
  ids: number[],
  windowDays: number
): SegmentComparison {
  const launch = new Date(campaign.launch + "T00:00:00Z");
  const elapsed = daysBetween(launch, TODAY);
  const sendIds = ids.filter((id) => campaign.target(CELLS[id]));
  const restIds = ids.filter((id) => !campaign.target(CELLS[id]));

  if (!sendIds.length) return { state: "out-of-segment" };
  if (!restIds.length) return { state: "no-holdout" };
  if (elapsed < windowDays) return { state: "insufficient-window", elapsed, needed: windowDays };

  const n = reachedIn([campaign.id], sendIds);
  const restSeats = restIds.reduce((s, id) => s + provisioned(TODAY) * CELLS[id].weight, 0);
  if (n < MIN_N || restSeats < MIN_N) return { state: "insufficient-n", n };

  const send = groupAdjusted(metric, sendIds, launch, windowDays);
  const rest = groupAdjusted(metric, restIds, launch, windowDays);
  if (send == null || rest == null) return { state: "no-baseline" };

  return { state: "ok", n, sendAdjusted: send, restAdjusted: rest, lift: send - rest, restSeats };
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

const median = (a: number[]): number => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/* Signed verdict. A real lift decays but keeps its sign, so we check that the
   most recent weeks still point the same way as the peak and remain material —
   rather than the old |last| ≥ 0.5·peak rule, which mislabelled every decaying
   win as a "spike" the longer you observed it, and treated a +→− sign flip as
   sustained. */
export function sustainedVerdict(prog: WeekPoint[]): Sustained {
  const vals = prog.map((p) => p.adjusted).filter((v): v is number => v != null);
  if (vals.length < 2) return "insufficient";

  const peak = vals.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), vals[0]);
  if (Math.abs(peak) < MATERIALITY) return "insufficient";
  const peakSign = Math.sign(peak);

  const recent = vals.slice(-3); // last three available weeks (or all, if fewer)
  const sameSign = recent.every((v) => Math.sign(v) === peakSign);
  const holds = median(recent.map((v) => Math.abs(v))) >= MATERIALITY;

  return sameSign && holds ? "sustained" : "spike";
}

/* --- Channel roll-up ------------------------------------------------------- */
export interface ChannelRoll {
  channel: string;
  campaigns: number;
  sends: number;
  ctr: number;
  reached: number;
  assoc: number | null; // exposure-weighted adjusted change of the objective metric
}

/** Roll-up over campaigns launched within `rangeDays`, consistent with the
    global date filter (it previously summed lifetime sends regardless of range). */
export function channelRollup(ids: number[], windowDays: number, rangeDays: number): ChannelRoll[] {
  const map = new Map<string, CampaignDef[]>();
  for (const c of campaignsInWindow(rangeDays)) {
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
      const r = campaignImpact(c, c.objectiveMetric, ids, windowDays);
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
  const metric = campaign.objectiveMetric;
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
  if (r.state === "insufficient-volume")
    return {
      tone: "watch",
      text: `Activity volume too low to judge ${campaign.name}.`,
      detail: "Too few active teachers in the comparison windows for a reliable comparison.",
    };
  if (r.state === "no-baseline") return null;

  if (!r.material)
    return {
      tone: "watch",
      text: `${label} shows no material change after ${campaign.name}.`,
      detail: `Adjusted ${pct(r.adjusted)} ± ${(r.se * 100).toFixed(1)}%, inside its uncertainty band (bar ±${(
        r.threshold * 100
      ).toFixed(1)}%). Raw ${pct(r.raw)}; seasonal expectation ${pct(r.expected)}.`,
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
    text: `${label} is ${pct(r.adjusted)} ± ${(r.se * 100).toFixed(1)}% ${
      r.adjusted > 0 ? "above" : "below"
    } the seasonal baseline in the ${windowDays} days after ${campaign.name}.`,
    detail:
      `${r.n.toLocaleString()} teachers exposed. Observed association over a ${windowDays}-day window, not proven causation. ${sustainText}`.trim(),
  };
}
