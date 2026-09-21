/* ===========================================================================
   /analytics — DETERMINISTIC INSIGHT RULES
   No free-text generation. A statement renders only if it clears materiality
   AND minimum N.
=========================================================================== */
import type { Metric } from "../data/schema";
import { src } from "../data/source";
import { addDays, fmtShort } from "../lib/dates";
import { MIN_N, METRIC_LABEL } from "./constants";
import { adjustedChange } from "./kpis";
import { campaignImpact, campaignsInWindow } from "./attribution";
import { pct } from "./format";

export type InsightTone = "positive" | "negative" | "watch";

export interface Insight {
  tone: InsightTone;
  text: string;
  detail: string;
  campaignId?: string;
}

export const order = (t: InsightTone): number =>
  ({ watch: 0, positive: 1, negative: 2 } as Record<InsightTone, number>)[t] ?? 3;

export function buildInsights(
  ids: number[],
  windowDays: number
): { insights: Insight[]; suppressed: number } {
  const out: Insight[] = [];
  let suppressed = 0;

  // R1 — seasonality guard on the headline metric.
  const wow = adjustedChange("wau", ids, src().asOf, 7);
  if (wow) {
    if (Math.abs(wow.raw) >= 0.1 && !wow.material) {
      out.push({
        tone: "watch",
        text: `Weekly active teachers moved ${pct(wow.raw)} week over week, but ${pct(
          wow.adjusted
        )} after seasonal adjustment.`,
        detail:
          "The movement is consistent with the normal back-to-school ramp. Prior-year baseline moved " +
          pct(wow.expected) +
          " over the same calendar window.",
      });
    } else if (wow.material) {
      out.push({
        tone: wow.adjusted > 0 ? "positive" : "negative",
        text: `Weekly active teachers are ${pct(wow.adjusted)} against the seasonal baseline.`,
        detail: "Raw week-over-week change was " + pct(wow.raw) + ".",
      });
    }
  }

  // R2 — campaign-associated changes.
  const metrics: Metric[] = ["resourceOpens", "assignmentsCreated", "wau"];
  for (const c of campaignsInWindow(30)) {
    for (const metric of metrics) {
      const r = campaignImpact(c, metric, ids, windowDays);
      if (r.state === "insufficient-n" || r.state === "insufficient-volume") {
        suppressed++;
        continue;
      }
      if (r.state !== "ok" || !r.material) continue;
      out.push({
        tone: r.adjusted > 0 ? "positive" : "negative",
        text: `${METRIC_LABEL[metric]} is ${pct(r.adjusted)} against baseline since ${c.name} (${fmtShort(
          c.launch
        )}).`,
        detail: `${r.n.toLocaleString()} teachers exposed. Observed association over a ${windowDays}-day window, not proven causation.`,
        campaignId: c.id,
      });
    }
  }

  // R3 — segment declines.
  const cells = src().cells;
  for (const p of src().dimensions.province)
    for (const g of src().dimensions.grade) {
      const segIds = ids.filter(
        (id) => cells[id].province === p && cells[id].grade === g
      );
      if (!segIds.length) continue;
      const seats = src().seatsOn(src().asOf, segIds) ?? 0;
      const ch = adjustedChange("classesCreated", segIds, src().asOf, 14);
      if (!ch) continue;
      if (seats < MIN_N) {
        suppressed++;
        continue;
      }
      if (ch.material && ch.adjusted < 0) {
        out.push({
          tone: "negative",
          text: `Class creation in ${p} ${g} is ${pct(
            ch.adjusted
          )} against the seasonal baseline.`,
          detail:
            "Fourteen-day window. Worth checking before September onboarding volume peaks.",
        });
      }
    }

  const ranked = out.sort((a, b) => order(a.tone) - order(b.tone)).slice(0, 4);
  return { insights: ranked, suppressed };
}
