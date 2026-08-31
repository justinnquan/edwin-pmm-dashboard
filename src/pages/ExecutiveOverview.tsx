/* ===========================================================================
   /pages — EXECUTIVE OVERVIEW (content only; shell lives in Layout)
   Reads computed results from /analytics and global filters from /state.
   Never computes a metric itself.
=========================================================================== */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { T, num } from "../theme/tokens";
import { CAMPAIGNS } from "../data/campaigns";
import { CELLS } from "../data/segments";
import { TODAY, addDays, provisioned } from "../data/calendar";
import { METRIC_LABEL } from "../analytics/constants";
import { pct, int } from "../analytics/format";
import { cellFilter, seriesFor, windowMean, adjustedChange } from "../analytics/kpis";
import { campaignsInWindow, reachedIn, campaignImpact } from "../analytics/attribution";
import { buildInsights } from "../analytics/insights";
import { useFilters } from "../state/filterStore";
import { Card } from "../components/primitives";
import { EmptyState } from "../components/states";
import { KpiCard } from "../components/KpiCard";
import { KPI_INFO } from "../components/kpiInfo";
import { InsightStrip } from "../components/InsightStrip";
import { TrendChart } from "../components/TrendChart";
import { ImpactRow } from "../components/DrillPanel";

export default function ExecutiveOverview() {
  const navigate = useNavigate();
  const { view, range, win, metric, province, grade, subject } = useFilters();
  const openCampaign = (id: string) => navigate(`/campaign/${id}`);

  const ids = useMemo(
    () => cellFilter({ province, grade, subject }),
    [province, grade, subject]
  );

  const model = useMemo(() => {
    if (!ids.length) return null;
    const from = addDays(TODAY, -range);
    const series = seriesFor(metric, ids, from, TODAY);

    const seats = ids.reduce((s, id) => s + provisioned(TODAY) * CELLS[id].weight, 0);
    const wauNow = windowMean("wau", ids, TODAY, 7);
    const activeRate = wauNow != null ? wauNow / seats : null;

    const wauCh = adjustedChange("wau", ids, TODAY, 7);
    const ahaNow = windowMean("ahaUsers", ids, TODAY, 7);
    const ahaRate = ahaNow != null && wauNow ? ahaNow / wauNow : null;
    const ahaCh = adjustedChange("ahaUsers", ids, TODAY, 14);
    const retRaw = windowMean("retentionW4", ids, TODAY, 7);
    const ret = retRaw != null ? retRaw / ids.length : null;
    const resCh = adjustedChange("resourceOpens", ids, TODAY, 14);

    const recent = campaignsInWindow(30);
    const reached = reachedIn(
      recent.map((c) => c.id),
      ids
    );

    // Campaign-associated impact: exposure-weighted mean of material adjusted changes.
    let wsum = 0,
      w = 0;
    for (const c of recent) {
      const r = campaignImpact(c, "resourceOpens", ids, win);
      if (r.state === "ok") {
        wsum += r.adjusted * r.n;
        w += r.n;
      }
    }
    const assoc = w ? wsum / w : null;

    const { insights, suppressed } = buildInsights(ids, win);
    return {
      series,
      seats,
      wauNow,
      activeRate,
      wauCh,
      ahaRate,
      ahaCh,
      ret,
      resCh,
      recent,
      reached,
      assoc,
      insights,
      suppressed,
    };
  }, [ids, range, metric, win]);

  if (!ids.length || !model) {
    return (
      <EmptyState title="No teachers match this segment">
        Reset a filter to bring data back.
      </EmptyState>
    );
  }

  const isPMM = view === "Product Marketing";

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <section
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}
      >
        <KpiCard
          primary
          label="Active teacher rate"
          info={KPI_INFO.activeRate}
          value={model.activeRate == null ? "—" : (model.activeRate * 100).toFixed(1)}
          unit="%"
          raw={pct(model.wauCh?.raw)}
          adjusted={model.wauCh?.adjusted}
          note={`${int(model.wauNow)} of ${int(model.seats)} provisioned · target 50%`}
        />
        <KpiCard
          label="Weekly active teachers"
          info={KPI_INFO.wau}
          value={int(model.wauNow)}
          raw={pct(model.wauCh?.raw)}
          adjusted={model.wauCh?.adjusted}
          note="Rolling 7 days"
        />
        <KpiCard
          label="Adoption rate"
          info={KPI_INFO.adoption}
          value={model.ahaRate == null ? "—" : (model.ahaRate * 100).toFixed(0)}
          unit="%"
          raw={pct(model.ahaCh?.raw)}
          adjusted={model.ahaCh?.adjusted}
          note="Active teachers creating a class or assignment"
        />
        <KpiCard
          label="4-week retention"
          info={KPI_INFO.retention}
          value={model.ret == null ? "—" : (model.ret * 100).toFixed(0)}
          unit="%"
          note="Share of a cohort still active after 4 weeks"
        />
        <KpiCard
          caveat
          label="Campaign-associated"
          info={KPI_INFO.campaignAssociated}
          value={model.assoc == null ? "—" : pct(model.assoc)}
          note={
            model.assoc == null
              ? "No campaign has a complete attribution window yet"
              : "Exposure-weighted resource engagement vs. baseline"
          }
        />
      </section>

      {/* What changed */}
      <section>
        <h2
          className="mb-3 text-sm font-extrabold uppercase"
          style={{ color: T.navy, letterSpacing: "0.07em" }}
        >
          What changed
        </h2>
        <InsightStrip insights={model.insights} suppressed={model.suppressed} />
      </section>

      {/* Marketing impact + trend */}
      <section className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
        <Card className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                className="text-sm font-extrabold uppercase"
                style={{ color: T.navy, letterSpacing: "0.07em" }}
              >
                Marketing impact · last 30 days
              </h2>
              <p className="mt-1 text-xs" style={{ color: T.muted }}>
                What marketing did, and what happened in Edwin afterward.
              </p>
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-xs" style={{ color: T.muted }}>
                  Campaigns launched
                </div>
                <div className="text-2xl font-extrabold" style={{ ...num, color: T.ink }}>
                  {model.recent.length}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: T.muted }}>
                  Teachers reached
                </div>
                <div className="text-2xl font-extrabold" style={{ ...num, color: T.ink }}>
                  {int(model.reached)}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: T.muted }}>
                  Resource engagement
                </div>
                <div className="text-2xl font-extrabold" style={{ ...num, color: T.soft }}>
                  {model.resCh ? pct(model.resCh.adjusted) : "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-xs" style={{ color: T.muted }}>
            <span className="flex items-center gap-2">
              <span style={{ width: 18, height: 3, background: T.blue, display: "inline-block" }} />
              {METRIC_LABEL[metric as keyof typeof METRIC_LABEL] ?? metric}
            </span>
            <span className="flex items-center gap-2">
              <span
                style={{
                  width: 18,
                  height: 0,
                  borderTop: `2px dashed ${T.baseline}`,
                  display: "inline-block",
                }}
              />
              Seasonal baseline (prior year)
            </span>
            <span className="flex items-center gap-2">
              <span style={{ color: T.warn, fontSize: 14 }}>▲</span> Campaign launch — click to open
            </span>
          </div>

          <div className="mt-2">
            <TrendChart
              series={model.series}
              metric={metric}
              campaigns={CAMPAIGNS}
              onPick={openCampaign}
            />
          </div>

          <p className="mt-2 text-xs" style={{ color: T.muted, lineHeight: 1.6 }}>
            The shaded band is the gap between what happened and what the prior year predicts would
            have happened anyway. Proximity of a marker to a change does not establish that the
            campaign caused it.
          </p>
        </Card>
      </section>

      {/* PMM-only progressive disclosure */}
      {isPMM && (
        <Card className="p-5">
          <h2
            className="text-sm font-extrabold uppercase"
            style={{ color: T.navy, letterSpacing: "0.07em" }}
          >
            Campaign contribution · last 30 days
          </h2>
          <p className="mt-1 mb-2 text-xs" style={{ color: T.muted }}>
            Channel engagement beside the product behaviour that followed it. Select a row to open the
            campaign.
          </p>
          {model.recent.length === 0 ? (
            <div className="py-6 text-sm" style={{ color: T.muted }}>
              No campaigns launched in this window.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs uppercase" style={{ color: T.muted, letterSpacing: "0.05em" }}>
                  <th className="pb-2 text-left font-bold">Campaign</th>
                  <th className="pb-2 px-3 text-right font-bold">Sends</th>
                  <th className="pb-2 px-3 text-right font-bold">CTR</th>
                  <th className="pb-2 px-3 text-right font-bold">CTOR</th>
                  <th className="pb-2 pl-3 text-right font-bold">Adjusted change</th>
                </tr>
              </thead>
              <tbody>
                {model.recent.map((c) => (
                  <ImpactRow key={c.id} campaign={c} ids={ids} windowDays={win} onPick={openCampaign} />
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <footer className="pb-2 text-xs" style={{ color: T.muted, lineHeight: 1.7 }}>
        Prototype on seeded synthetic data. Figures are illustrative and must not be quoted as Edwin
        performance. Design tokens are a placeholder pending the Phia system.
      </footer>
    </div>
  );
}
