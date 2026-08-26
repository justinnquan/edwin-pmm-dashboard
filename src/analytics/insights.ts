/* ===========================================================================
   /analytics — DETERMINISTIC INSIGHT RULES
   No free-text generation. A statement renders only if it clears materiality
   AND minimum N.
=========================================================================== */
import type { Metric } from "../data/schema";
import { PROVINCES, GRADES, CELLS } from "../data/segments";
import { TODAY, addDays, fmtShort, provisioned } from "../data/calendar";
import { MIN_N, MATERIALITY, METRIC_LABEL } from "./constants";
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
  const wow = adjustedChange("wau", ids, TODAY, 7);
  if (wow) {
    if (Math.abs(wow.raw) >= 0.1 && Math.abs(wow.adjusted) < MATERIALITY) {
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
    } else if (Math.abs(wow.adjusted) >= MATERIALITY) {
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
      if (r.state === "insufficient-n") {
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
  for (const p of PROVINCES)
    for (const g of GRADES) {
      const segIds = ids.filter(
        (id) => CELLS[id].province === p.k && CELLS[id].grade === g.k
      );
      if (!segIds.length) continue;
      const seats = segIds.reduce((s, id) => s + provisioned(TODAY) * CELLS[id].weight, 0);
      const ch = adjustedChange("classesCreated", segIds, TODAY, 14);
      if (!ch) continue;
      if (seats < MIN_N) {
        suppressed++;
        continue;
      }
      if (ch.adjusted <= -MATERIALITY) {
        out.push({
          tone: "negative",
          text: `Class creation in ${p.k} ${g.k} is ${pct(
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
