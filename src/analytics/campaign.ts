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
import type { PublicCampaign, Metric, SummableMetric } from "../data/schema";
import { src } from "../data/source";
import { addDays, daysBetween, fromIso } from "../lib/dates";
import { MIN_N, MATERIALITY, CONFIDENCE_Z, METRIC_LABEL } from "./constants";
import { windowMean, adjustedSE } from "./kpis";
import { campaignImpact, campaignsInWindow, reachedIn } from "./attribution";
import { pct } from "./format";

/* --- Channel metrics ------------------------------------------------------- */
// Read-throughs: a real source reports opens and clicks, it does not derive
// them from a rate.
export const campaignOpens = (c: PublicCampaign): number => c.opens;
export const campaignClicks = (c: PublicCampaign): number => c.clicks;
export const campaignCTR = (c: PublicCampaign): number => c.clickRate; // clicks / sends
/** CTOR is only meaningful where opens are a real funnel step. In-app and
    release-notes channels have openRate 1.0 (no open concept), so CTOR would
    just duplicate CTR — return null there and render "N/A". */
export const campaignCTOR = (c: PublicCampaign): number | null =>
  c.openRate > 0 && c.openRate < 1 ? c.clickRate / c.openRate : null;

/** The metric a campaign is judged against — its declared objective. */
export function primaryMetric(c: PublicCampaign): Metric {
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
  campaign: PublicCampaign,
  metric: SummableMetric,
  ids: number[],
  windowDays: number
): SegmentComparison {
  const launch = fromIso(campaign.launch);
  const elapsed = daysBetween(launch, src().asOf);
  const cells = src().cells;
  const sendIds = ids.filter((id) => campaign.target(cells[id]));
  const restIds = ids.filter((id) => !campaign.target(cells[id]));

  if (!sendIds.length) return { state: "out-of-segment" };
  if (!restIds.length) return { state: "no-holdout" };
  if (elapsed < windowDays) return { state: "insufficient-window", elapsed, needed: windowDays };

  // No exposure data is not zero reach: it fails the gate and says so.
  const n = reachedIn([campaign.id], sendIds) ?? 0;
  const restSeats = src().seatsOn(src().asOf, restIds) ?? 0;
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
  /** Standard error of this week's adjusted estimate, by the same delta method
      `campaignImpact` uses. Null when it cannot be estimated. */
  se: number | null;
  /** Clears max(MATERIALITY, CONFIDENCE_Z × se) — this week's own bar, not a
      flat threshold. A quiet week raises its own bar. */
  material: boolean;
}

export function cohortProgression(
  campaign: PublicCampaign,
  metric: SummableMetric,
  ids: number[]
): WeekPoint[] {
  const launch = fromIso(campaign.launch);
  const targetIds = ids.filter((id) => campaign.target(src().cells[id]));
  if (!targetIds.length) return [];
  const elapsed = daysBetween(launch, src().asOf);
  const maxWeeks = Math.min(8, Math.floor(elapsed / 7));

  const pre = windowMean(metric, targetIds, addDays(launch, -1), 7);
  const bPre = windowMean(metric, targetIds, addDays(launch, -1), 7, true);

  const out: WeekPoint[] = [];
  for (let w = 1; w <= maxWeeks; w++) {
    const end = addDays(launch, w * 7);
    const post = windowMean(metric, targetIds, end, 7);
    const bPost = windowMean(metric, targetIds, end, 7, true);
    let adjusted: number | null = null;
    let se: number | null = null;
    let material = false;
    if (pre && post && bPre && bPost) {
      adjusted = post / pre / (bPost / bPre) - 1;
      se = adjustedSE(metric, targetIds, end, addDays(launch, -1), 7, adjusted);
      if (se != null) material = Math.abs(adjusted) >= Math.max(MATERIALITY, CONFIDENCE_Z * se);
    }
    out.push({ week: w, adjusted, se, material });
  }
  return out;
}

export type Sustained = "sustained" | "faded" | "spike" | "insufficient";

/* Durability verdict, decided on each week's own uncertainty band rather than a
   flat threshold.

   Two failure modes this avoids:

   1. The original rule (|last| ≥ 0.5 × peak) labelled every decaying win a
      "spike", and the longer you observed, the more certain the mislabel.
   2. Testing weekly values against a flat 5% — as the first revision did —
      let a campaign with no effect at all read "sustained" purely because its
      noise happened to keep one sign. A zero-effect campaign whose weekly
      estimates carry a ±19% standard error must not produce an affirmative
      durability claim.

   So only weeks that clear their own bar count as evidence, and a lift that
   held for a stretch before decaying gets its own verdict rather than being
   collapsed into "spike". */
export function sustainedVerdict(prog: WeekPoint[]): Sustained {
  const pts = prog.filter((p): p is WeekPoint & { adjusted: number } => p.adjusted != null);
  if (pts.length < 2) return "insufficient";

  // Weeks that cleared their own uncertainty band. Nothing else is evidence.
  const signal = pts.filter((p) => p.material);
  if (!signal.length) return "insufficient";

  const peak = signal.reduce((a, b) => (Math.abs(b.adjusted) > Math.abs(a.adjusted) ? b : a));
  const sign = Math.sign(peak.adjusted);

  // Still holding if at least two of the last three weeks clear their own bar
  // in the peak's direction.
  const recent = pts.slice(-3);
  const holding = recent.filter((p) => p.material && Math.sign(p.adjusted) === sign);
  if (holding.length >= 2) return "sustained";

  // It cleared its bar for a real run and then stopped: a lift that faded, not
  // a one-week blip. Three weeks distinguishes the two honestly.
  const run = signal.filter((p) => Math.sign(p.adjusted) === sign).length;
  return run >= 3 ? "faded" : "spike";
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
  const map = new Map<string, PublicCampaign[]>();
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
      reached:
        reachedIn(
          list.map((c) => c.id),
          ids
        ) ?? 0,
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
  campaign: PublicCampaign,
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
      ? "The change has held week over week."
      : verdict === "faded"
      ? "It held for several weeks before fading back toward the baseline."
      : verdict === "spike"
      ? "The movement looks like a one-week spike rather than a lasting shift."
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
