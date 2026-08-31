/* ===========================================================================
   /components — ADOPTION VISUALS (presentation only)
   Activation funnel bars, OKR gauge, feature-adoption bars, and a compact
   metric trend. All values arrive computed from /analytics.
=========================================================================== */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { T, num } from "../theme/tokens";
import { fmtShort } from "../data/calendar";
import { pct, int } from "../analytics/format";
import type { FunnelStage, Gauge as GaugeData, FeatureAdoption } from "../analytics/adoption";
import type { SeriesPoint } from "../data/schema";
import { InfoTip, type KpiInfo } from "./InfoTip";

/* --- Activation funnel ----------------------------------------------------- */
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  return (
    <div className="flex flex-col gap-2">
      {stages.map((s, i) => (
        <div key={s.key} className="flex items-center gap-3">
          <div className="shrink-0 text-right" style={{ width: 30 }}>
            <span className="text-xs font-bold" style={{ color: T.blue }}>
              {s.journey}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold truncate" style={{ color: T.ink }}>
                {s.label}
              </span>
              <span className="text-xs shrink-0" style={{ ...num, color: T.muted }}>
                {int(s.count)} · {pct(s.shareOfTop)}
              </span>
            </div>
            <div
              className="mt-1 rounded"
              style={{ height: 22, background: T.bg, border: `1px solid ${T.border}`, overflow: "hidden" }}
            >
              <div
                style={{
                  width: `${Math.max(1, s.shareOfTop * 100)}%`,
                  height: "100%",
                  background: T.blue,
                  opacity: 1 - i * 0.14,
                }}
              />
            </div>
          </div>
          <div className="shrink-0 text-right" style={{ width: 74 }}>
            {i > 0 && (
              <>
                <div className="text-xs" style={{ color: T.muted }}>
                  converts
                </div>
                <div className="text-sm font-bold" style={{ ...num, color: T.soft }}>
                  {pct(s.shareOfPrev)}
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* --- OKR gauge (horizontal bar vs target marker) --------------------------- */
export function Gauge({ gauge, info }: { gauge: GaugeData; info?: KpiInfo }) {
  const met = gauge.value >= gauge.target;
  const color = met ? T.good : T.warn;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-xs font-bold uppercase flex items-center gap-1.5"
          style={{ color: T.muted, letterSpacing: "0.05em" }}
        >
          {gauge.label}
          {info && <InfoTip label={gauge.label} info={info} />}
        </span>
        <span className="text-xs shrink-0" style={{ ...num, color: T.muted }}>
          target {pct(gauge.target)}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold" style={{ ...num, color }}>
          {(gauge.value * 100).toFixed(0)}%
        </span>
        <span className="text-xs font-semibold" style={{ color }}>
          {met ? "at / above target" : `${((gauge.target - gauge.value) * 100).toFixed(0)} pts below`}
        </span>
      </div>
      <div className="relative mt-2 rounded" style={{ height: 12, background: T.bg, border: `1px solid ${T.border}` }}>
        <div
          className="rounded-l"
          style={{ width: `${Math.min(100, gauge.value * 100)}%`, height: "100%", background: color }}
        />
        {/* target marker */}
        <div
          className="absolute"
          style={{ left: `${Math.min(100, gauge.target * 100)}%`, top: -3, bottom: -3, width: 2, background: T.navy }}
          title={`Target ${pct(gauge.target)}`}
        />
      </div>
      <div className="mt-2 text-xs" style={{ color: T.muted, lineHeight: 1.5 }}>
        {gauge.sublabel}
      </div>
    </div>
  );
}

/* --- Feature adoption bars ------------------------------------------------- */
export function FeatureBars({ features }: { features: FeatureAdoption[] }) {
  return (
    <div className="flex flex-col gap-3">
      {features.map((f) => (
        <div key={f.feature} className="flex items-center gap-3">
          <span className="text-sm shrink-0" style={{ width: 210, color: T.soft }}>
            {f.feature}
          </span>
          <div className="flex-1 rounded" style={{ height: 18, background: T.bg, border: `1px solid ${T.border}` }}>
            <div style={{ width: `${Math.max(1, f.reach * 100)}%`, height: "100%", background: T.blue }} />
          </div>
          <span className="text-sm font-bold shrink-0 text-right" style={{ ...num, width: 52, color: T.ink }}>
            {(f.reach * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

/* --- Compact metric trend (value vs seasonal baseline) --------------------- */
export function MiniTrend({ title, series }: { title: string; series: SeriesPoint[] }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase" style={{ color: T.soft, letterSpacing: "0.04em" }}>
        {title}
      </div>
      <div style={{ width: "100%", height: 150 }} className="mt-1">
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={T.border} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtShort}
              tick={{ fontSize: 10, fill: T.muted }}
              axisLine={{ stroke: T.border }}
              tickLine={false}
              minTickGap={44}
            />
            <YAxis
              tick={{ fontSize: 10, fill: T.muted }}
              axisLine={false}
              tickLine={false}
              width={38}
              tickFormatter={(v: number) => (v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v))}
            />
            <Tooltip
              labelFormatter={(l: string) => fmtShort(l)}
              formatter={(v: unknown) => (typeof v === "number" ? int(v) : "—")}
              contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${T.border}` }}
            />
            <Line
              type="monotone"
              dataKey="baseline"
              stroke={T.baseline}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
              name="Seasonal baseline"
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={T.blue}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name={title}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
