/* ===========================================================================
   /components — KPI CARD
   SIGNATURE: raw movement and the seasonally-adjusted movement, always paired.
   With `empty`, the period has no actuals yet (a school year not published):
   the card says so plainly and shows the same week last year for reference.
=========================================================================== */
import type { ReactNode } from "react";
import { T, num, eyebrow } from "../theme/tokens";
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
  empty,
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
  empty?: { title: string; lastYear?: string | null };
}) {
  const tone = adjusted == null ? T.muted : adjusted >= 0 ? T.good : T.warn;
  const toneBg = adjusted == null ? T.subtle : adjusted >= 0 ? T.goodBg : T.warnBg;
  return (
    <Card
      className="flex flex-col justify-between"
      style={{ padding: "16px 18px", ...(primary ? { borderColor: T.blue, boxShadow: T.shadowBrand } : {}) }}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div
            className="text-xs font-bold uppercase flex items-center gap-1.5"
            style={eyebrow}
          >
            {label}
            {info && <InfoTip label={label} info={info} />}
          </div>
          {caveat && <Chip tone="warn">Association</Chip>}
        </div>
        {empty ? (
          <div className="mt-3 text-lg font-bold" style={{ color: T.soft, lineHeight: 1.3 }}>
            {empty.title}
          </div>
        ) : (
        <div className="mt-3 flex items-baseline gap-1">
          <span
            style={{
              ...num,
              color: primary ? T.blue : T.ink,
              fontSize: primary ? 36 : 30,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {value}
          </span>
          {unit && (
            <span className="text-base font-bold" style={{ ...num, color: primary ? T.blue : T.soft }}>
              {unit}
            </span>
          )}
        </div>
        )}
      </div>

      <div className="mt-4">
        {empty && (
          <div className="text-xs" style={{ ...num, color: T.muted }}>
            Same week last year: <b style={{ color: T.soft }}>{empty.lastYear ?? "—"}</b>
          </div>
        )}
        {!empty && raw != null && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={num}>
            <span style={{ color: T.muted }}>
              Raw <b style={{ color: T.soft }}>{raw}</b>
            </span>
            <span aria-hidden style={{ width: 1, height: 14, background: T.border }} />
            <span style={{ color: T.muted }}>
              Adjusted{" "}
              <b className="rounded-full px-2 py-0.5" style={{ color: tone, background: toneBg }}>
                {adjusted == null ? "—" : pct(adjusted)}
              </b>
            </span>
          </div>
        )}
        {!empty && note && (
          <div className="mt-2 text-sm" style={{ color: T.muted, lineHeight: 1.5 }}>
            {note}
          </div>
        )}
      </div>
    </Card>
  );
}
