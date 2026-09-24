/* ===========================================================================
   /components — TREND CHART
   The primary metric (solid) against the same week last school year (dotted),
   an optional second line for new logged-in teachers on its own axis, and
   campaign / release markers on the shared date axis.

   Days with no actual — a school year not yet published — still draw the
   dotted line, so last year's shape is readable ahead of this year's data.
   The gap band is only drawn where both lines exist.
=========================================================================== */
import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
} from "recharts";
import { T, num } from "../theme/tokens";
import { fmtAxis, fmtShort } from "../lib/dates";
import { src } from "../data/source";
import { SERIES_LABEL, LAST_YEAR_LABEL } from "../analytics/constants";
import { pct, int } from "../analytics/format";
import type { PublicCampaign, SeriesPoint, SummableMetric } from "../data/schema";

const kfmt = (v: number) => (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k" : String(Math.round(v)));

/* eslint-disable @typescript-eslint/no-explicit-any */
function ChartTooltip({ active, payload, label, campaignsByDate, metric, hasLogins }: any) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload ?? {};
  const c: PublicCampaign | undefined = campaignsByDate.get(label);
  const gap = row.value != null && row.baseline ? row.value / row.baseline - 1 : null;
  const line = (name: string, v: number | null | undefined, color: string) => (
    <div className="flex justify-between gap-4" style={num}>
      <span style={{ color: T.soft }}>{name}</span>
      <b style={{ color }}>{v == null ? "—" : int(v)}</b>
    </div>
  );
  return (
    <div
      className="rounded-lg p-3 text-xs"
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        boxShadow: T.shadowMd,
        minWidth: 220,
      }}
    >
      <div className="font-bold mb-2" style={{ color: T.ink }}>
        {fmtShort(label)}
      </div>
      {line(SERIES_LABEL[metric] ?? metric, row.value, T.blue)}
      {line(LAST_YEAR_LABEL, row.baseline, T.baseline)}
      {gap != null && (
        <div className="flex justify-between gap-4" style={num}>
          <span style={{ color: T.soft }}>Vs. last year</span>
          <b style={{ color: gap >= 0 ? T.good : T.warn }}>{pct(gap)}</b>
        </div>
      )}
      {hasLogins && (
        <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
          {line("New logins this week", row.logins, T.logins)}
          {line("Same week last year", row.loginsBaseline, T.baseline)}
        </div>
      )}
      {c && (
        <div className="mt-2 pt-2 text-xs" style={{ borderTop: `1px solid ${T.border}`, color: T.blue }}>
          <b>{c.name}</b>
          <div style={{ color: T.muted }}>
            {fmtShort(c.launch)} · click the marker to open
          </div>
        </div>
      )}
    </div>
  );
}

export function TrendChart({
  series,
  metric,
  logins,
  campaigns,
  onPick,
}: {
  series: SeriesPoint[];
  metric: SummableMetric;
  /** New logged-in teachers, drawn on the right-hand axis. Omitted when the
      source does not carry it. */
  logins?: SeriesPoint[] | null;
  campaigns: PublicCampaign[];
  onPick: (id: string) => void;
}) {
  const byDate = useMemo(() => {
    const m = new Map<string, PublicCampaign>();
    campaigns.forEach((c) => m.set(c.launch, c));
    return m;
  }, [campaigns]);

  const loginsByDate = useMemo(() => new Map((logins ?? []).map((p) => [p.date, p])), [logins]);
  const hasLogins = !!logins && logins.some((p) => p.value != null || p.baseline != null);

  const max = Math.max(1, ...series.map((d) => Math.max(d.value ?? 0, d.baseline ?? 0)));
  const markerY = max * 0.045;

  const data = series.map((d) => {
    const both = d.value != null && d.baseline != null;
    const l = loginsByDate.get(d.date);
    return {
      ...d,
      gapTop: both ? Math.max(d.value!, d.baseline!) : null,
      gapBase: both ? Math.min(d.value!, d.baseline!) : null,
      logins: l?.value ?? null,
      loginsBaseline: l?.baseline ?? null,
      marker: byDate.has(d.date) ? markerY : null,
      campaignId: byDate.get(d.date)?.id,
    };
  });

  const releaseHits = src().releases.filter((r) => series.some((s) => s.date === r.date));

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: hasLogins ? 4 : 16, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="gapFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={T.blue} stopOpacity={0.16} />
              <stop offset="100%" stopColor={T.blue} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={T.border} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtAxis}
            tick={{ fontSize: 11, fill: T.muted }}
            axisLine={{ stroke: T.border }}
            tickLine={false}
            minTickGap={36}
          />
          <YAxis
            yAxisId="main"
            tick={{ fontSize: 11, fill: T.muted }}
            axisLine={false}
            tickLine={false}
            tickFormatter={kfmt}
            width={44}
          />
          {hasLogins && (
            <YAxis
              yAxisId="logins"
              orientation="right"
              tick={{ fontSize: 11, fill: T.logins }}
              axisLine={false}
              tickLine={false}
              tickFormatter={kfmt}
              width={40}
            />
          )}
          <Tooltip content={<ChartTooltip campaignsByDate={byDate} metric={metric} hasLogins={hasLogins} />} />

          {/* SIGNATURE: the gap between what happened and the same week last year. */}
          <Area yAxisId="main" dataKey="gapTop" stroke="none" fill="url(#gapFill)" isAnimationActive={false} connectNulls={false} />
          <Area yAxisId="main" dataKey="gapBase" stroke="none" fill={T.surface} isAnimationActive={false} connectNulls={false} />

          {releaseHits.map((r) => (
            <ReferenceLine
              key={r.date}
              yAxisId="main"
              x={r.date}
              stroke={T.navy}
              strokeDasharray="2 3"
              label={{ value: r.name, position: "insideTopRight", fontSize: 10, fill: T.navy }}
            />
          ))}

          <Line
            yAxisId="main"
            type="monotone"
            dataKey="baseline"
            stroke={T.baseline}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
            name={LAST_YEAR_LABEL}
          />
          <Line
            yAxisId="main"
            type="monotone"
            dataKey="value"
            stroke={T.blue}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
            name={SERIES_LABEL[metric] ?? metric}
          />
          {hasLogins && (
            <Line
              yAxisId="logins"
              type="stepAfter"
              dataKey="loginsBaseline"
              stroke={T.logins}
              strokeOpacity={0.45}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
              name="New logins — last school year"
            />
          )}
          {hasLogins && (
            <Line
              yAxisId="logins"
              type="stepAfter"
              dataKey="logins"
              stroke={T.logins}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
              name="New logged-in teachers"
            />
          )}
          <Scatter
            yAxisId="main"
            dataKey="marker"
            fill={T.warn}
            shape="triangle"
            onClick={(p: any) => p?.payload?.campaignId && onPick(p.payload.campaignId)}
            style={{ cursor: "pointer" }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
