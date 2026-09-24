/* ===========================================================================
   /pages — MARKETING ACTIVITY TIMELINE (§03)
   An activity lane (campaign + release markers) aligned above stacked,
   selectable metric lanes, each carrying the same week last school year. Marker click
   opens Campaign Impact. Association only — no causality is implied.
=========================================================================== */
import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { SummableMetric, SeriesPoint } from "../data/schema";
import { src } from "../data/source";
import { fmtAxis, fmtShort, fromIso } from "../lib/dates";
import { SERIES_LABEL, LAST_YEAR_LABEL } from "../analytics/constants";
import { int, pct } from "../analytics/format";
import { cellFilter, seriesFor } from "../analytics/kpis";
import { useFilters } from "../state/filterStore";
import { T, num, eyebrow } from "../theme/tokens";
import { Card } from "../components/primitives";
import { typeColor, RELEASE_COLOR, CampaignTypeLegend } from "../components/campaignStyle";

const LEFT = 52; // must equal each lane's YAxis width
const RIGHT = 16; // must equal each lane's right margin
const ALL_TIMELINE_METRICS: SummableMetric[] = [
  "wau",
  "newLogins",
  "resourceOpens",
  "assignmentsCreated",
  "classesCreated",
  "ahaUsers",
];

/** Only the lanes this source can draw. Offering the rest gives the reader a
    button that produces a flat zero line indistinguishable from a collapse. */
const timelineMetrics = (): SummableMetric[] =>
  ALL_TIMELINE_METRICS.filter((m) => src().coverage.metrics[m]);

const ms = (dateStr: string): number => new Date(dateStr + "T00:00:00Z").getTime();
const insetLeft = (frac: number): CSSProperties => ({
  left: `calc(${LEFT}px + ${frac} * (100% - ${LEFT + RIGHT}px))`,
});

/* ---- one metric lane ------------------------------------------------------ */
function LaneTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const v = payload.find((p: any) => p.dataKey === "value");
  const b = payload.find((p: any) => p.dataKey === "baseline");
  const gap = v?.value != null && b?.value ? v.value / b.value - 1 : null;
  return (
    <div
      className="rounded-lg p-2 text-xs"
      style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadowMd }}
    >
      <div className="font-bold" style={{ color: T.ink }}>
        {fmtShort(label)}
      </div>
      <div className="mt-1 flex justify-between gap-4" style={num}>
        <span style={{ color: T.soft }}>This period</span>
        <b style={{ color: T.blue }}>{int(v?.value)}</b>
      </div>
      <div className="flex justify-between gap-4" style={num}>
        <span style={{ color: T.soft }}>{LAST_YEAR_LABEL}</span>
        <b style={{ color: T.baseline }}>{int(b?.value)}</b>
      </div>
      {gap != null && (
        <div className="mt-1 flex justify-between gap-4" style={num}>
          <span style={{ color: T.soft }}>Vs. last year</span>
          <b style={{ color: gap >= 0 ? T.good : T.warn }}>{pct(gap)}</b>
        </div>
      )}
    </div>
  );
}

function MetricLane({
  metric,
  series,
  showX,
}: {
  metric: SummableMetric;
  series: SeriesPoint[];
  showX: boolean;
}) {
  const releaseHits = src().releases.filter((r) => series.some((s) => s.date === r.date));
  return (
    <div className="relative" style={{ height: showX ? 156 : 138 }}>
      <div
        className="absolute z-10 text-xs font-bold uppercase"
        style={{ ...eyebrow, left: LEFT + 6, top: 4, color: T.soft }}
      >
        {SERIES_LABEL[metric]}
      </div>
      <ResponsiveContainer>
        <ComposedChart data={series} margin={{ top: 6, right: RIGHT, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={T.border} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtAxis}
            tick={showX ? { fontSize: 11, fill: T.muted } : false}
            axisLine={{ stroke: T.border }}
            tickLine={false}
            minTickGap={40}
            height={showX ? 22 : 8}
          />
          <YAxis
            width={LEFT}
            tick={{ fontSize: 10, fill: T.muted }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v))}
          />
          <Tooltip content={<LaneTooltip />} />
          {releaseHits.map((r) => (
            <ReferenceLine key={r.date} x={r.date} stroke={RELEASE_COLOR} strokeDasharray="2 3" />
          ))}
          <Line
            type="monotone"
            dataKey="baseline"
            stroke={T.baseline}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={T.blue}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---- page ----------------------------------------------------------------- */
export default function ActivityTimeline() {
  const navigate = useNavigate();
  const { province, grade, subject, from: fromKey, to: toKey } = useFilters();
  const ids = useMemo(() => cellFilter({ province, grade, subject }), [province, grade, subject]);

  const from = fromIso(fromKey);
  const to = fromIso(toKey);
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const span = Math.max(1, toMs - fromMs);
  const fracOf = (dateStr: string): number => (ms(dateStr) - fromMs) / span;

  const [selected, setSelected] = useState<SummableMetric[]>(["wau"]);
  const toggle = (m: SummableMetric) =>
    setSelected((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));

  const seriesByMetric = useMemo(
    () => selected.map((m) => ({ metric: m, series: seriesFor(m, ids, from, to) })),
    [selected, ids, fromKey, toKey]
  );

  const campaigns = useMemo(
    () => src().campaigns.filter((c) => ms(c.launch) >= fromMs && ms(c.launch) <= toMs),
    [fromMs, toMs]
  );
  const releases = useMemo(
    () => src().releases.filter((r) => ms(r.date) >= fromMs && ms(r.date) <= toMs),
    [fromMs, toMs]
  );

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        {/* metric toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase mr-1" style={eyebrow}>
            Metric lanes
          </span>
          {timelineMetrics().map((m) => {
            const on = selected.includes(m);
            return (
              <button
                key={m}
                onClick={() => toggle(m)}
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={{
                  background: on ? T.blue : T.subtle,
                  color: on ? T.surface : T.soft,
                  border: `1px solid ${on ? T.blue : T.border}`,
                  fontFamily: T.fontUI,
                }}
              >
                {SERIES_LABEL[m]}
              </button>
            );
          })}
        </div>

        {/* activity lane */}
        <div className="mt-5">
          <div className="text-xs font-bold uppercase" style={{ ...eyebrow, marginLeft: LEFT + 6 }}>
            Campaigns &amp; releases
          </div>
          <div className="relative mt-1" style={{ height: 46 }}>
            {/* rule line */}
            <div
              className="absolute"
              style={{ left: LEFT, right: RIGHT, top: 22, height: 1, background: T.border }}
            />
            {campaigns.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/campaign/${c.id}`)}
                title={`${c.name} · ${c.type} · ${fmtShort(c.launch)}`}
                className="absolute"
                style={{
                  ...insetLeft(fracOf(c.launch)),
                  top: 12,
                  transform: "translateX(-50%)",
                  width: 0,
                  height: 0,
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderTop: `11px solid ${typeColor(c.type)}`,
                  cursor: "pointer",
                  background: "transparent",
                }}
              />
            ))}
            {releases.map((r) => (
              <span
                key={r.date}
                title={`Release · ${r.name} · ${fmtShort(r.date)}`}
                className="absolute"
                style={{
                  ...insetLeft(fracOf(r.date)),
                  top: 17,
                  transform: "translateX(-50%) rotate(45deg)",
                  width: 9,
                  height: 9,
                  background: RELEASE_COLOR,
                }}
              />
            ))}
            {/* end date labels */}
            <div className="absolute text-xs" style={{ left: LEFT, top: 30, color: T.muted, ...num }}>
              {fmtShort(series0Date(from))}
            </div>
            <div className="absolute text-xs" style={{ right: RIGHT, top: 30, color: T.muted, ...num }}>
              {fmtShort(series0Date(to))}
            </div>
          </div>
        </div>

        {/* metric lanes */}
        <div className="mt-4 flex flex-col">
          {seriesByMetric.length === 0 ? (
            <div className="py-8 text-sm text-center" style={{ color: T.muted }}>
              Select at least one metric lane above.
            </div>
          ) : (
            seriesByMetric.map((s, i) => (
              <MetricLane
                key={s.metric}
                metric={s.metric}
                series={s.series}
                showX={i === seriesByMetric.length - 1}
              />
            ))
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <CampaignTypeLegend />
          <span className="text-xs" style={{ color: T.warn, fontWeight: 700 }}>
            Proximity is not proof — no causality is implied.
          </span>
        </div>
      </Card>

      <p className="text-sm" style={{ color: T.muted, lineHeight: 1.6 }}>
        Each lane shows the metric (solid) against the same week last school year (dotted). Vertical
        navy lines and diamonds mark product releases. Click a triangle to open that campaign's impact
        detail. School year, dates and segment come from the global filters.
      </p>
    </div>
  );
}

// Small helper so the end labels read as dates without importing iso here.
function series0Date(d: Date): string {
  return d.toISOString().slice(0, 10);
}
