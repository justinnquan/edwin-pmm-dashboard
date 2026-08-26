/* ===========================================================================
   /components — CAMPAIGN DRILL (impact row + detail panel)
=========================================================================== */
import { T, num } from "../theme/tokens";
import { fmtShort } from "../data/calendar";
import { MIN_N, METRIC_LABEL } from "../analytics/constants";
import { pct, int } from "../analytics/format";
import { campaignImpact } from "../analytics/attribution";
import type { CampaignDef, SummableMetric } from "../data/schema";
import { Card, Chip } from "./primitives";

export function ImpactRow({
  campaign,
  ids,
  windowDays,
  onPick,
}: {
  campaign: CampaignDef;
  ids: number[];
  windowDays: number;
  onPick: (id: string) => void;
}) {
  const metric: SummableMetric = campaign.effects.assignmentsCreated
    ? "assignmentsCreated"
    : "resourceOpens";
  const r = campaignImpact(campaign, metric, ids, windowDays);
  const ctr = campaign.clickRate;
  const ctor = campaign.openRate > 0 ? campaign.clickRate / campaign.openRate : null;

  let result: React.ReactNode;
  if (r.state === "out-of-segment")
    result = <span style={{ color: T.muted }}>Not in this segment</span>;
  else if (r.state === "insufficient-window")
    result = (
      <span style={{ color: T.muted }}>
        Needs {r.needed - r.elapsed} more day{r.needed - r.elapsed === 1 ? "" : "s"}
      </span>
    );
  else if (r.state === "insufficient-n")
    result = <span style={{ color: T.muted }}>Below {MIN_N} exposed</span>;
  else if (r.state === "no-baseline")
    result = <span style={{ color: T.muted }}>No baseline</span>;
  else if (!r.material) result = <span style={{ color: T.soft }}>No material change</span>;
  else result = <b style={{ color: r.adjusted > 0 ? T.good : T.warn }}>{pct(r.adjusted)}</b>;

  return (
    <tr
      onClick={() => onPick(campaign.id)}
      className="cursor-pointer"
      style={{ borderTop: `1px solid ${T.border}` }}
    >
      <td className="py-3 pr-3">
        <div className="text-sm font-semibold" style={{ color: T.ink }}>
          {campaign.name}
        </div>
        <div className="text-xs" style={{ color: T.muted }}>
          {campaign.channel} · {fmtShort(campaign.launch)}
        </div>
      </td>
      <td className="py-3 px-3 text-sm text-right" style={num}>
        {int(campaign.sends)}
      </td>
      <td className="py-3 px-3 text-sm text-right" style={num}>
        {(ctr * 100).toFixed(1)}%
      </td>
      <td className="py-3 px-3 text-sm text-right" style={num}>
        {ctor ? (ctor * 100).toFixed(1) + "%" : "—"}
      </td>
      <td className="py-3 pl-3 text-sm text-right" style={num}>
        {result}
      </td>
    </tr>
  );
}

export function DrillPanel({
  campaign,
  ids,
  windowDays,
  onClose,
}: {
  campaign: CampaignDef | null;
  ids: number[];
  windowDays: number;
  onClose: () => void;
}) {
  if (!campaign) return null;
  const metrics: SummableMetric[] = ["wau", "resourceOpens", "assignmentsCreated"];
  return (
    <Card className="p-5" style={{ borderColor: T.blue }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Chip tone="blue">{campaign.type}</Chip>
          <div className="mt-2 text-lg font-extrabold" style={{ color: T.ink }}>
            {campaign.name}
          </div>
          <div className="text-xs" style={{ color: T.muted }}>
            {campaign.channel} · Launched {fmtShort(campaign.launch)} · {campaign.audience}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded px-2 py-1 text-xs font-semibold"
          style={{ color: T.soft, border: `1px solid ${T.border}` }}
        >
          Close
        </button>
      </div>

      <div
        className="mt-4 grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}
      >
        {metrics.map((m) => {
          const r = campaignImpact(campaign, m, ids, windowDays);
          return (
            <div
              key={m}
              className="rounded p-3"
              style={{ background: T.bg, border: `1px solid ${T.border}` }}
            >
              <div
                className="text-xs font-bold uppercase"
                style={{ color: T.muted, letterSpacing: "0.05em" }}
              >
                {METRIC_LABEL[m as keyof typeof METRIC_LABEL] ?? m}
              </div>
              {r.state === "ok" ? (
                <>
                  <div
                    className="mt-2 text-2xl font-extrabold"
                    style={{
                      ...num,
                      color: r.material ? (r.adjusted > 0 ? T.good : T.warn) : T.soft,
                    }}
                  >
                    {pct(r.adjusted)}
                  </div>
                  <div className="mt-1 text-xs" style={{ ...num, color: T.muted }}>
                    Raw {pct(r.raw)} · Expected {pct(r.expected)}
                  </div>
                </>
              ) : (
                <div
                  className="mt-2 text-sm font-semibold"
                  style={{ color: T.muted, lineHeight: 1.45 }}
                >
                  {r.state === "insufficient-window" &&
                    `Insufficient data — ${r.needed - r.elapsed} more day${
                      r.needed - r.elapsed === 1 ? "" : "s"
                    } needed for a ${windowDays}-day window.`}
                  {r.state === "insufficient-n" &&
                    `Insufficient data — ${r.n} exposed teachers, below the ${MIN_N} minimum.`}
                  {r.state === "out-of-segment" && "No exposed teachers in the current segment."}
                  {r.state === "no-baseline" && "No prior-year baseline available for this window."}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="mt-4 rounded p-3 text-xs"
        style={{ background: T.bg, color: T.soft, lineHeight: 1.6 }}
      >
        <b style={{ color: T.ink }}>How to read this.</b> Adjusted change divides the observed
        before/after movement by the movement in the prior-year baseline over the same calendar
        window. It describes an association following exposure, not proven causation.
        Exposed-versus-held-out comparison requires a randomised holdout designed into the campaign
        before send.
      </div>
    </Card>
  );
}
