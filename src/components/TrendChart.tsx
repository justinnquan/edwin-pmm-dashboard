/* ===========================================================================
   /components — WAU TREND CHART with seasonal baseline + campaign markers
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
import { fmtShort } from "../data/calendar";
import { RELEASES } from "../data/campaigns";
import { METRIC_LABEL } from "../analytics/constants";
import { pct, int } from "../analytics/format";
import type { CampaignDef, SeriesPoint, SummableMetric } from "../data/schema";

/* eslint-disable @typescript-eslint/no-explicit-any */
function ChartTooltip({ active, payload, label, campaignsByDate }: any) {
  if (!active || !payload || !payload.length) return null;
  const v = payload.find((p: any) => p.dataKey === "value");
  const b = payload.find((p: any) => p.dataKey === "baseline");
  const c: CampaignDef | undefined = campaignsByDate.get(label);
  const gap = v && b && b.value ? v.value / b.value - 1 : null;
  return (
    <div
      className="rounded-md p-3 text-xs"
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        boxShadow: "0 4px 14px rgba(0,0,0,.09)",
        minWidth: 200,
      }}
    >
      <div className="font-bold" style={{ color: T.ink }}>
        {fmtShort(label)}
      </div>
      <div className="mt-2 flex justify-between gap-4" style={num}>
        <span style={{ color: T.soft }}>Actual</span>
        <b style={{ color: T.blue }}>{int(v?.value)}</b>
      </div>
      <div className="flex justify-between gap-4" style={num}>
        <span style={{ color: T.soft }}>Seasonal baseline</span>
        <b style={{ color: T.baseline }}>{int(b?.value)}</b>
      </div>
      {gap != null && (
        <div
          className="mt-2 pt-2 flex justify-between gap-4"
          style={{ ...num, borderTop: `1px solid ${T.border}` }}
        >
          <span style={{ color: T.soft }}>Gap</span>
          <b style={{ color: gap >= 0 ? T.good : T.warn }}>{pct(gap)}</b>
        </div>
      )}
      {c && (
        <div className="mt-2 pt-2 text-xs" style={{ borderTop: `1px solid ${T.border}`, color: T.blue }}>
          <b>{c.name}</b>
          <div style={{ color: T.muted }}>Click the marker to open</div>
        </div>
      )}
    </div>
  );
}

export function TrendChart({
  series,
  metric,
  campaigns,
  onPick,
}: {
  series: SeriesPoint[];
  metric: SummableMetric;
  campaigns: CampaignDef[];
  onPick: (id: string) => void;
}) {
  const byDate = useMemo(() => {
    const m = new Map<string, CampaignDef>();
    campaigns.forEach((c) => m.set(c.launch, c));
    return m;
  }, [campaigns]);

  const max = Math.max(...series.map((d) => Math.max(d.value, d.baseline || 0)));
  const markerY = max * 0.045;

  const data = series.map((d) => ({
    ...d,
    gapTop: d.baseline != null ? Math.max(d.value, d.baseline) : d.value,
    gapBase: d.baseline != null ? Math.min(d.value, d.baseline) : d.value,
    marker: byDate.has(d.date) ? markerY : null,
    campaignId: byDate.get(d.date)?.id,
  }));

  const releaseHits = RELEASES.filter((r) => series.some((s) => s.date === r.date));

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="gapFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={T.blue} stopOpacity={0.16} />
              <stop offset="100%" stopColor={T.blue} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={T.border} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtShort}
            tick={{ fontSize: 11, fill: T.muted }}
            axisLine={{ stroke: T.border }}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={{ fontSize: 11, fill: T.muted }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v))}
            width={44}
          />
          <Tooltip content={<ChartTooltip campaignsByDate={byDate} />} />

          {/* SIGNATURE: the gap between what happened and what would have happened anyway. */}
          <Area dataKey="gapTop" stroke="none" fill="url(#gapFill)" isAnimationActive={false} />
          <Area dataKey="gapBase" stroke="none" fill={T.surface} isAnimationActive={false} />

          {releaseHits.map((r) => (
            <ReferenceLine
              key={r.date}
              x={r.date}
              stroke={T.navy}
              strokeDasharray="2 3"
              label={{ value: r.name, position: "insideTopRight", fontSize: 10, fill: T.navy }}
            />
          ))}

          <Line
            type="monotone"
            dataKey="baseline"
            stroke={T.baseline}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
            name="Seasonal baseline"
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={T.blue}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
            name={METRIC_LABEL[metric as keyof typeof METRIC_LABEL] ?? metric}
          />
          <Scatter
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
