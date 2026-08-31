/* ===========================================================================
   /components — KPI CARD
   SIGNATURE: raw movement and the seasonally-adjusted movement, always paired.
=========================================================================== */
import type { ReactNode } from "react";
import { T, num } from "../theme/tokens";
import { pct } from "../analytics/format";
import { Card, Chip } from "./primitives";
import { InfoTip, type KpiInfo } from "./InfoTip";

export function KpiCard({
  label,
  value,
  unit,
  raw,
  adjusted,
  note,
  caveat,
  primary,
  info,
}: {
  label: string;
  value: string;
  unit?: string;
  raw?: string | null;
  adjusted?: number | null;
  note?: ReactNode;
  caveat?: boolean;
  primary?: boolean;
  info?: KpiInfo;
}) {
  const tone = adjusted == null ? T.muted : adjusted >= 0 ? T.good : T.warn;
  return (
    <Card className="p-4 flex flex-col justify-between" style={primary ? { borderColor: T.blue } : {}}>
      <div>
        <div className="flex items-start justify-between gap-2">
          <div
            className="text-xs font-bold uppercase flex items-center gap-1.5"
            style={{ color: T.muted, letterSpacing: "0.06em" }}
          >
            {label}
            {info && <InfoTip label={label} info={info} />}
          </div>
          {caveat && <Chip tone="warn">Association</Chip>}
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span
            style={{
              ...num,
              color: primary ? T.blue : T.ink,
              fontSize: primary ? 38 : 30,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {value}
          </span>
          {unit && (
            <span className="text-sm font-semibold" style={{ color: T.soft }}>
              {unit}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        {raw != null && (
          <div className="flex items-center gap-3 text-xs" style={num}>
            <span style={{ color: T.muted }}>
              Raw <b style={{ color: T.soft }}>{raw}</b>
            </span>
            <span style={{ color: T.border }}>│</span>
            <span style={{ color: T.muted }}>
              Adjusted <b style={{ color: tone }}>{adjusted == null ? "—" : pct(adjusted)}</b>
            </span>
          </div>
        )}
        {note && (
          <div className="mt-2 text-xs" style={{ color: T.muted, lineHeight: 1.5 }}>
            {note}
          </div>
        )}
      </div>
    </Card>
  );
}
