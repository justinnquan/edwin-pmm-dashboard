/* ===========================================================================
   /components — PRODUCT-IMPACT PRIMITIVES (shared by Marketing Performance
   and Campaign Impact). Presentation only; results come from /analytics.
=========================================================================== */
import type { ReactNode } from "react";
import type { CampaignDef, CampaignImpact, Metric } from "../data/schema";
import { T, num } from "../theme/tokens";
import { MIN_N, METRIC_LABEL } from "../analytics/constants";
import { pct } from "../analytics/format";
import { campaignImpact } from "../analytics/attribution";

/** The default metric set shown for a campaign's downstream product impact. */
export const IMPACT_METRICS: Metric[] = [
  "wau",
  "resourceOpens",
  "assignmentsCreated",
  "classesCreated",
  "ahaUsers",
];

/** Renders a single campaign-impact result: the adjusted % (coloured) or the
    honest gated reason it can't be shown. */
export function ImpactValue({ r }: { r: CampaignImpact }): ReactNode {
  switch (r.state) {
    case "out-of-segment":
      return <span style={{ color: T.muted }}>Not in this segment</span>;
    case "insufficient-window":
      return (
        <span style={{ color: T.muted }}>
          Needs {r.needed - r.elapsed} more day{r.needed - r.elapsed === 1 ? "" : "s"}
        </span>
      );
    case "insufficient-n":
      return <span style={{ color: T.muted }}>Below {MIN_N} exposed</span>;
    case "no-baseline":
      return <span style={{ color: T.muted }}>No baseline</span>;
    case "ok":
      return r.material ? (
        <b style={{ color: r.adjusted > 0 ? T.good : T.warn }}>{pct(r.adjusted)}</b>
      ) : (
        <span style={{ color: T.soft }}>No material change</span>
      );
  }
}

export function ProductImpactCard({
  campaign,
  metric,
  ids,
  windowDays,
}: {
  campaign: CampaignDef;
  metric: Metric;
  ids: number[];
  windowDays: number;
}) {
  const r = campaignImpact(campaign, metric, ids, windowDays);
  return (
    <div className="rounded p-3" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
      <div
        className="text-xs font-bold uppercase"
        style={{ color: T.muted, letterSpacing: "0.05em" }}
      >
        {METRIC_LABEL[metric]}
      </div>
      {r.state === "ok" ? (
        <>
          <div
            className="mt-2 text-2xl font-extrabold"
            style={{ ...num, color: r.material ? (r.adjusted > 0 ? T.good : T.warn) : T.soft }}
          >
            {pct(r.adjusted)}
          </div>
          <div className="mt-1 text-xs" style={{ ...num, color: T.muted }}>
            Raw {pct(r.raw)} · Expected {pct(r.expected)}
          </div>
        </>
      ) : (
        <div className="mt-2 text-sm font-semibold" style={{ color: T.muted, lineHeight: 1.45 }}>
          {r.state === "insufficient-window" &&
            `${r.needed - r.elapsed} more day${
              r.needed - r.elapsed === 1 ? "" : "s"
            } needed for a ${windowDays}-day window.`}
          {r.state === "insufficient-n" &&
            `${r.n} exposed teachers, below the ${MIN_N} minimum.`}
          {r.state === "out-of-segment" && "No exposed teachers in the current segment."}
          {r.state === "no-baseline" && "No prior-year baseline for this window."}
        </div>
      )}
    </div>
  );
}

export function ProductImpactGrid({
  campaign,
  ids,
  windowDays,
  metrics = IMPACT_METRICS,
}: {
  campaign: CampaignDef;
  ids: number[];
  windowDays: number;
  metrics?: Metric[];
}) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
      {metrics.map((m) => (
        <ProductImpactCard key={m} campaign={campaign} metric={m} ids={ids} windowDays={windowDays} />
      ))}
    </div>
  );
}
