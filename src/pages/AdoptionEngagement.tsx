/* ===========================================================================
   /pages — ADOPTION & ENGAGEMENT (§05)
   Activation funnel (J1–J5) · Day-7 + monthly-active OKR gauges · feature
   adoption bars · resource / classroom / assignment trends.
   Anchored to Edwin's real activation journey and company OKRs.
=========================================================================== */
import { useMemo } from "react";
import type { Metric } from "../data/schema";
import { src } from "../data/source";
import { addDays } from "../lib/dates";
import { METRIC_LABEL } from "../analytics/constants";
import { cellFilter, seriesFor } from "../analytics/kpis";
import { activationFunnel, activationGauges, featureAdoption, seatsOf } from "../analytics/adoption";
import { useFilters } from "../state/filterStore";
import { T } from "../theme/tokens";
import { Card, Chip } from "../components/primitives";
import { EmptyState, Unavailable } from "../components/states";
import { Funnel, Gauge, FeatureBars, MiniTrend } from "../components/AdoptionViz";
import { KPI_INFO } from "../components/kpiInfo";
import { int } from "../analytics/format";

const TREND_METRICS: Metric[] = ["resourceOpens", "classesCreated", "assignmentsCreated"];

export default function AdoptionEngagement() {
  const { province, grade, subject, range } = useFilters();
  const ids = useMemo(() => cellFilter({ province, grade, subject }), [province, grade, subject]);

  const model = useMemo(() => {
    if (!ids.length) return null;
    const from = addDays(src().asOf, -range);
    return {
      seats: seatsOf(ids),
      funnel: activationFunnel(ids),
      gauges: activationGauges(ids),
      features: featureAdoption(ids),
      trends: TREND_METRICS.map((m) => ({ metric: m, series: seriesFor(m, ids, from, src().asOf) })),
    };
  }, [ids, range]);

  if (!model) {
    return (
      <EmptyState title="No teachers match this segment">
        Reset a filter to bring data back.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Modelled-data caveat */}
      <div
        className="rounded p-3 text-xs flex items-start gap-2"
        style={{ background: "#FFF6F2", border: `1px solid ${T.warn}33`, color: T.soft, lineHeight: 1.6 }}
      >
        <span style={{ color: T.warn, fontWeight: 700 }}>Modelled from aggregate data.</span>
        The funnel stages and activation rates are estimated from daily metric aggregates, not counted
        from per-user cohort events. They are deterministic and directional; a real deployment would
        count distinct per-teacher journey events (invite → first login → first resource → class →
        assignment). Treat exact percentages as illustrative.
      </div>

      {/* Funnel + gauges */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
              Activation funnel
            </h2>
            <span className="text-xs" style={{ color: T.muted }}>
              {model.seats == null ? "no licence count in this source" : `${int(model.seats)} provisioned`}
            </span>
          </div>
          <p className="mt-1 mb-4 text-xs" style={{ color: T.muted }}>
            Invited → First login → First resource → Class created → Assignment / student invited,
            mapped to Edwin's J1–J5 onboarding journeys.
          </p>
          {model.funnel.unavailable ? (
            <Unavailable
              title="Activation funnel unavailable"
              detail={`Each stage below the first is modelled from event data — ${model.funnel.unavailable}. Rather than fall back to assumed conversion rates, which would render as measured percentages, the funnel is not drawn.`}
            />
          ) : (
            <Funnel stages={model.funnel.stages} />
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {model.gauges ? (
            <>
              <Card className="p-5">
                <Gauge gauge={model.gauges.day7} info={KPI_INFO.day7} />
              </Card>
              <Card className="p-5">
                <Gauge gauge={model.gauges.monthly} info={KPI_INFO.monthly} />
              </Card>
            </>
          ) : (
            <Card className="p-5">
              <Unavailable
                title="OKR gauges unavailable"
                detail="Both gauges are shares of the licensed teacher population, and this source has no licence count. Provisioned seats per period would restore them — they are what the 70% Day-7 and 50% monthly-active OKRs are defined against."
              />
            </Card>
          )}
        </div>
      </section>

      {/* Feature adoption */}
      <Card className="p-5">
        <h2 className="text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
          Feature adoption
        </h2>
        <p className="mt-1 mb-4 text-xs" style={{ color: T.muted }}>
          Share of active teachers using each LMS feature in the last 30 days.
        </p>
        <FeatureBars features={model.features} />
      </Card>

      {/* Behaviour trends */}
      <section>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
            Resource, classroom &amp; assignment behaviour
          </h2>
          <Chip tone="muted">vs. seasonal baseline</Chip>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
          {model.trends.map((t) => (
            <Card key={t.metric} className="p-4">
              <MiniTrend title={METRIC_LABEL[t.metric]} series={t.series} />
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
