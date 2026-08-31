/* ===========================================================================
   /pages — SEGMENTS (§06, PMM operating view)
   Segment comparison table across a chosen dimension (min-N gated) · "where is
   the opportunity" ranking · account/board operating view (data-gated, PMM-only,
   never a leadership headline).
=========================================================================== */
import { useMemo, useState } from "react";
import { CELLS } from "../data/segments";
import { MIN_N } from "../analytics/constants";
import { pct, int } from "../analytics/format";
import { cellFilter } from "../analytics/kpis";
import {
  DIMENSIONS,
  segmentRows,
  opportunityRanking,
  suppressedCount,
  MONTHLY_TARGET,
  type Dimension,
  type SegmentRow,
} from "../analytics/segments";
import { useFilters } from "../state/filterStore";
import { T, num } from "../theme/tokens";
import { Card, Chip } from "../components/primitives";

const num2 = (v: number | null, kind: "pct" | "int"): string =>
  v == null ? "—" : kind === "pct" ? pct(v) : int(v);

function Cellv({ row, k, kind }: { row: SegmentRow; k: keyof SegmentRow; kind: "pct" | "int" }) {
  if (row.gated) return <span style={{ color: T.muted }}>—</span>;
  const v = row[k] as number | null;
  const color =
    k === "assoc" && v != null ? (v >= 0 ? T.good : T.warn) : T.ink;
  return (
    <span style={{ ...num, color }}>{num2(v, kind)}</span>
  );
}

export default function Segments() {
  const { view, province, grade, subject, win } = useFilters();
  const isPMM = view === "Product Marketing";
  const baseIds = useMemo(() => cellFilter({ province, grade, subject }), [province, grade, subject]);
  const [dim, setDim] = useState<Dimension>("grade");

  const rows = useMemo(() => segmentRows(dim, baseIds, win), [dim, baseIds, win]);
  const suppressed = suppressedCount(rows);
  const opportunities = useMemo(() => opportunityRanking(baseIds), [baseIds]);
  const maxOpp = opportunities.length ? opportunities[0].size : 1;

  // Does any board/account dimension exist in the data? (It does not — surfaced honestly.)
  const hasBoardData = CELLS.some((c) => "board" in c);

  return (
    <div className="flex flex-col gap-6">
      {/* Comparison table */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
            Segment comparison
          </h2>
          <div className="flex rounded p-1" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
            {DIMENSIONS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDim(d.key)}
                className="rounded px-3 py-1 text-sm font-semibold"
                style={{
                  background: dim === d.key ? T.surface : "transparent",
                  color: dim === d.key ? T.blue : T.muted,
                  border: dim === d.key ? `1px solid ${T.border}` : "1px solid transparent",
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 mb-3 text-xs" style={{ color: T.muted }}>
          Weekly active, active rate, adoption, retention, and campaign-associated change per segment.
          Cells below {MIN_N} provisioned teachers are gated to an insufficient-data state.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ minWidth: 720 }}>
            <thead>
              <tr className="text-xs uppercase" style={{ color: T.muted, letterSpacing: "0.05em" }}>
                <th className="pb-2 text-left font-bold">Segment</th>
                <th className="pb-2 px-3 text-right font-bold">Provisioned</th>
                <th className="pb-2 px-3 text-right font-bold">WAU</th>
                <th className="pb-2 px-3 text-right font-bold">Active rate</th>
                <th className="pb-2 px-3 text-right font-bold">Adoption</th>
                <th className="pb-2 px-3 text-right font-bold">Retention</th>
                <th className="pb-2 pl-3 text-right font-bold">Assoc. change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td className="py-3 pr-3">
                    <div className="text-sm font-semibold flex items-center gap-2" style={{ color: T.ink }}>
                      {r.key}
                      {r.gated && <Chip tone="muted">Insufficient data</Chip>}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-sm text-right" style={num}>
                    {int(r.seats)}
                  </td>
                  <td className="py-3 px-3 text-sm text-right">
                    <Cellv row={r} k="wau" kind="int" />
                  </td>
                  <td className="py-3 px-3 text-sm text-right">
                    <Cellv row={r} k="activeRate" kind="pct" />
                  </td>
                  <td className="py-3 px-3 text-sm text-right">
                    <Cellv row={r} k="adoptionRate" kind="pct" />
                  </td>
                  <td className="py-3 px-3 text-sm text-right">
                    <Cellv row={r} k="retention" kind="pct" />
                  </td>
                  <td className="py-3 pl-3 text-sm text-right">
                    <Cellv row={r} k="assoc" kind="pct" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {suppressed > 0 && (
          <div className="mt-3 text-xs" style={{ color: T.muted }}>
            {suppressed} segment{suppressed === 1 ? "" : "s"} gated below the {MIN_N}-teacher minimum.
          </div>
        )}
      </Card>

      {/* Opportunity ranking */}
      <Card className="p-5">
        <h2 className="text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
          Where is the opportunity
        </h2>
        <p className="mt-1 mb-4 text-xs" style={{ color: T.muted }}>
          Province × grade cells ranked by teachers below the {pct(MONTHLY_TARGET)} monthly-active
          target — the largest gaps, sized by population. Min-N gated.
        </p>
        {opportunities.length === 0 ? (
          <div className="py-4 text-sm" style={{ color: T.muted }}>
            No segment sits below target in the current filter.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {opportunities.map((o) => (
              <div key={o.key} className="flex items-center gap-3">
                <span className="text-sm shrink-0" style={{ width: 220, color: T.ink }}>
                  {o.key}
                </span>
                <div className="flex-1 rounded" style={{ height: 20, background: T.bg, border: `1px solid ${T.border}` }}>
                  <div
                    className="h-full rounded-l flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(4, (o.size / maxOpp) * 100)}%`, background: T.warn }}
                  >
                    <span className="text-xs font-bold" style={{ color: "#fff", ...num }}>
                      ~{int(o.size)}
                    </span>
                  </div>
                </div>
                <span className="text-xs shrink-0 text-right" style={{ width: 130, color: T.muted, ...num }}>
                  {pct(o.activeRate)} active · {pct(o.gapToTarget)} gap
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 text-xs" style={{ color: T.muted }}>
          Bar length ≈ number of teachers below target (gap × provisioned).
        </div>
      </Card>

      {/* Account / board operating view — data-gated, PMM only */}
      {isPMM && (
        <Card className="p-5" style={{ background: T.bg }}>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
              Account / board operating view
            </h2>
            <Chip tone="muted">PMM only</Chip>
          </div>
          {hasBoardData ? null : (
            <div className="mt-2 text-sm" style={{ color: T.soft, lineHeight: 1.6, maxWidth: 640 }}>
              Board-level data is not available in this prototype. Account/board attribution depends on
              a reliable account dimension, which is partial today and in flux during the
              Salesforce-to-Admin-Console provisioning migration. This view unlocks once board coverage
              is verified — and remains a PMM operating view, never a leadership headline.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
