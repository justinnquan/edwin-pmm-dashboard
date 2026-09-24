/* ===========================================================================
   /pages — EXECUTIVE OVERVIEW (content only; shell lives in Layout)
   Reads computed results from /analytics and global filters from /state.
   Never computes a metric itself.
=========================================================================== */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { T, num, eyebrow } from "../theme/tokens";
import { src } from "../data/source";
import { addDays, fmtRange, fromIso } from "../lib/dates";
import { SERIES_LABEL, LAST_YEAR_LABEL, YOY_LAG } from "../analytics/constants";
import { pct, int } from "../analytics/format";
import { cellFilter, seriesFor, windowMean, adjustedChange, seatWeightedRate } from "../analytics/kpis";
import { campaignsBetween, reachedIn, campaignImpact } from "../analytics/attribution";
import { evalDate, hasActualsIn, priorYearOf } from "../analytics/period";
import { buildInsights } from "../analytics/insights";
import { seatsOf } from "../analytics/adoption";
import { useFilters } from "../state/filterStore";
import { Card } from "../components/primitives";
import { EmptyState } from "../components/states";
import { KpiCard } from "../components/KpiCard";
import { KPI_INFO } from "../components/kpiInfo";
import { Provenance } from "../components/Provenance";
import { MarkerTriangle } from "../components/Icon";
import { InsightStrip } from "../components/InsightStrip";
import { TrendChart } from "../components/TrendChart";
import { ImpactRow } from "../components/DrillPanel";

export default function ExecutiveOverview() {
  const navigate = useNavigate();
  const { view, from, to, schoolYear, win, metric, province, grade, subject } = useFilters();
  const openCampaign = (id: string) => navigate(`/campaign/${id}`);

  const ids = useMemo(
    () => cellFilter({ province, grade, subject }),
    [province, grade, subject]
  );

  const model = useMemo(() => {
    if (!ids.length) return null;
    const start = fromIso(from);
    const end = fromIso(to);
    const series = seriesFor(metric, ids, start, end);
    const cov0 = src().coverage;
    const logins = cov0.metrics.newLogins ? seriesFor("newLogins", ids, start, end) : null;

    // No actuals anywhere in the selected dates: a school year that has not
    // been published. Nothing below may compute on it; the cards show the
    // same week last year instead.
    const hasActuals = hasActualsIn(from, to);
    const lastYearWau = windowMean("wau", ids, addDays(end, -YOY_LAG), 7);
    const now = evalDate();

    const cov = src().coverage;
    const seats = seatsOf(ids);
    const wauNow = windowMean("wau", ids, now, 7);
    // Null seats means the source has no licence count, so there is no rate to
    // report. Dividing by whatever else is to hand would produce a confident
    // figure answering a different question.
    const activeRate = wauNow != null && seats != null && seats > 0 ? wauNow / seats : null;

    const wauCh = adjustedChange("wau", ids, now, 7);
    // A metric the source does not carry reads as 0, and 0 renders as a
    // confident "0%" rather than a dash. Check presence before the arithmetic.
    const ahaNow = cov.metrics.ahaUsers ? windowMean("ahaUsers", ids, now, 7) : null;
    const ahaRate = ahaNow != null && wauNow ? ahaNow / wauNow : null;
    const ahaCh = adjustedChange("ahaUsers", ids, now, 14);
    const ret = cov.metrics.retentionW4
      ? seatWeightedRate("retentionW4", ids, now, 7)
      : null;
    const resCh = adjustedChange("resourceOpens", ids, now, 14);

    const recent = campaignsBetween(from, to);
    const reached = reachedIn(
      recent.map((c) => c.id),
      ids
    );

    // Campaign-associated impact: exposure-weighted mean of material adjusted changes.
    let wsum = 0,
      w = 0;
    for (const c of recent) {
      const r = campaignImpact(c, c.objectiveMetric, ids, win);
      if (r.state === "ok") {
        wsum += r.adjusted * r.n;
        w += r.n;
      }
    }
    const assoc = w ? wsum / w : null;

    const { insights, suppressed } = buildInsights(ids, win);
    return {
      series,
      logins,
      hasActuals,
      lastYearWau,
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
  }, [ids, from, to, metric, win]);

  if (!ids.length || !model) {
    return (
      <EmptyState title="No teachers match this segment">
        Reset a filter to bring data back.
      </EmptyState>
    );
  }

  const isPMM = view === "Product Marketing";
  // "2026/27" → "26/27", the way the year is spoken about.
  const yearShort = schoolYear.slice(2);
  const empty = (lastYear: string | null = null) =>
    model.hasActuals ? undefined : { title: `No ${yearShort} data yet`, lastYear };

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <section
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}
      >
        <KpiCard
          primary
          empty={empty()}
          label="Active teacher rate"
          info={KPI_INFO.activeRate}
          value={model.activeRate == null ? "—" : (model.activeRate * 100).toFixed(1)}
          unit="%"
          raw={pct(model.wauCh?.raw)}
          adjusted={model.wauCh?.adjusted}
          note={
            model.activeRate == null
              ? "Needs a licensed-seat count. This source has none, so the rate — and the 50% MAU OKR measure — cannot be computed."
              : `${int(model.wauNow)} of ${int(model.seats)} provisioned · target 50%`
          }
        />
        <KpiCard
          empty={empty(model.lastYearWau == null ? null : int(model.lastYearWau))}
          label="Weekly active teachers"
          info={KPI_INFO.wau}
          value={int(model.wauNow)}
          raw={pct(model.wauCh?.raw)}
          adjusted={model.wauCh?.adjusted}
          note="Rolling 7 days"
        />
        <KpiCard
          empty={empty()}
          label="Adoption rate"
          info={KPI_INFO.adoption}
          value={model.ahaRate == null ? "—" : (model.ahaRate * 100).toFixed(0)}
          unit="%"
          raw={pct(model.ahaCh?.raw)}
          adjusted={model.ahaCh?.adjusted}
          note={
            model.ahaRate == null
              ? "Needs a count of teachers creating a class or assignment. Not in this source."
              : "Active teachers creating a class or assignment"
          }
        />
        <KpiCard
          empty={empty()}
          label="4-week retention"
          info={KPI_INFO.retention}
          value={model.ret == null ? "—" : (model.ret * 100).toFixed(0)}
          unit="%"
          note={
            model.ret == null
              ? "Needs a cohort retention rate. Not in this source."
              : "Share of a cohort still active after 4 weeks"
          }
        />
        <KpiCard
          caveat
          empty={empty()}
          label="Campaign-associated"
          info={KPI_INFO.campaignAssociated}
          value={model.assoc == null ? "—" : pct(model.assoc)}
          note={
            model.assoc != null
              ? "Exposure-weighted change on each campaign's objective vs. baseline"
              : !src().coverage.canAdjust
              ? "Needs a prior year to compare against. Without one nothing can be seasonally adjusted."
              : "No campaign has a complete before/after window yet"
          }
        />
      </section>

      {/* What changed */}
      <section>
        <h2
          className="mb-3 text-lg font-bold"
          style={{ color: T.ink, lineHeight: "24px" }}
        >
          What changed
        </h2>
        {model.hasActuals ? (
          <InsightStrip insights={model.insights} suppressed={model.suppressed} />
        ) : (
          <EmptyState title={`No ${yearShort} data yet`}>
            Changes are reported once {schoolYear} usage is published. Until then the trend below
            shows {priorYearOf(schoolYear)} as a dotted line.
          </EmptyState>
        )}
      </section>

      {/* Marketing impact + trend */}
      <section className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                className="text-lg font-bold"
                style={{ color: T.ink, lineHeight: "24px" }}
              >
                Marketing impact · {fmtRange(from, to)}
              </h2>
              <p className="mt-1 text-sm" style={{ color: T.muted }}>
                What marketing did, and what happened in Edwin afterward.
              </p>
            </div>
            <div className="flex flex-wrap gap-8">
              <div>
                <div style={eyebrow}>
                  Campaigns launched
                </div>
                <div className="mt-1 text-2xl font-bold" style={{ ...num, color: T.ink }}>
                  {model.recent.length}
                </div>
              </div>
              <div>
                <div style={eyebrow}>
                  Teachers reached
                </div>
                <div className="mt-1 text-2xl font-bold" style={{ ...num, color: T.ink }}>
                  {int(model.reached)}
                </div>
              </div>
              <div>
                <div style={eyebrow}>
                  Resource engagement
                </div>
                <div className="mt-1 text-2xl font-bold" style={{ ...num, color: T.soft }}>
                  {model.resCh ? pct(model.resCh.adjusted) : "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" style={{ color: T.soft }}>
            <span className="flex items-center gap-2">
              <span style={{ width: 18, height: 3, borderRadius: 2, background: T.blue, display: "inline-block" }} />
              {SERIES_LABEL[metric] ?? metric}
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
              {LAST_YEAR_LABEL}
            </span>
            {model.logins && (
              <span className="flex items-center gap-2">
                <span style={{ width: 18, height: 3, borderRadius: 2, background: T.logins, display: "inline-block" }} />
                New logged-in teachers (right axis)
              </span>
            )}
            <span className="flex items-center gap-2">
              <MarkerTriangle color={T.warn} /> Campaign launch — click to open
            </span>
          </div>

          <div className="mt-2">
            {!model.hasActuals && (
              <p className="mb-2 text-xs font-semibold" style={{ color: T.soft }}>
                No {schoolYear} data published yet — dotted line shows {priorYearOf(schoolYear)}.
              </p>
            )}
            {model.hasActuals && !model.series.some((p) => p.baseline != null) && (
              <p className="mb-2 text-xs" style={{ color: T.muted }}>
                No {priorYearOf(schoolYear)} data, so there is no dotted line for these dates.
              </p>
            )}
            <TrendChart
              series={model.series}
              metric={metric}
              logins={model.logins}
              campaigns={model.recent}
              onPick={openCampaign}
            />
          </div>

          <p className="mt-3 text-sm" style={{ color: T.muted, lineHeight: 1.6 }}>
            The dotted line is the same week last school year; where both lines exist, the shaded
            band is the gap between them. New logged-in teachers are teachers logging in for the
            first time that week. Proximity of a marker to a change does not establish that the
            campaign caused it.
          </p>
        </Card>
      </section>

      {/* PMM-only progressive disclosure */}
      {isPMM && (
        <Card className="p-6">
          <h2
            className="text-lg font-bold"
            style={{ color: T.ink, lineHeight: "24px" }}
          >
            Campaign contribution · {fmtRange(from, to)}
          </h2>
          <p className="mt-1 mb-4 text-sm" style={{ color: T.muted }}>
            Channel engagement beside the product behaviour that followed it. Select a row to open the
            campaign.
          </p>
          {model.recent.length === 0 ? (
            <div className="py-6 text-sm" style={{ color: T.muted }}>
              No campaigns sent in these dates.
            </div>
          ) : (
            <table className="phia-table w-full">
              <thead>
                <tr style={{ color: T.muted }}>
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

      <footer className="pb-2">
        <Provenance />
      </footer>
    </div>
  );
}
