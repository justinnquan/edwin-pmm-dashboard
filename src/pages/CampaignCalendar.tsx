/* ===========================================================================
   /pages — CAMPAIGN CALENDAR (§07)
   Month grid of campaign chips (colour by type) with product releases overlaid.
   Chip click opens Campaign Impact.
=========================================================================== */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CampaignDef, Release } from "../data/schema";
import { CAMPAIGNS, RELEASES } from "../data/campaigns";
import { T } from "../theme/tokens";
import { Card } from "../components/primitives";
import { typeColor, RELEASE_COLOR, CampaignTypeLegend } from "../components/campaignStyle";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parse an ISO date's parts in UTC. */
const parts = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() };
};

export default function CampaignCalendar() {
  const navigate = useNavigate();
  // Default to August 2026, where campaign activity clusters.
  const [ym, setYm] = useState({ y: 2026, m: 7 });

  const first = new Date(Date.UTC(ym.y, ym.m, 1));
  const startDow = first.getUTCDay();
  const daysIn = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const monthLabel = first.toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const { campByDay, relByDay, monthCount } = useMemo(() => {
    const campByDay = new Map<number, CampaignDef[]>();
    const relByDay = new Map<number, Release[]>();
    let monthCount = 0;
    for (const c of CAMPAIGNS) {
      const p = parts(c.launch);
      if (p.y === ym.y && p.m === ym.m) {
        (campByDay.get(p.day) ?? campByDay.set(p.day, []).get(p.day)!).push(c);
        monthCount++;
      }
    }
    for (const r of RELEASES) {
      const p = parts(r.date);
      if (p.y === ym.y && p.m === ym.m)
        (relByDay.get(p.day) ?? relByDay.set(p.day, []).get(p.day)!).push(r);
    }
    return { campByDay, relByDay, monthCount };
  }, [ym]);

  const step = (delta: number) => {
    setYm((s) => {
      const m = s.m + delta;
      if (m < 0) return { y: s.y - 1, m: 11 };
      if (m > 11) return { y: s.y + 1, m: 0 };
      return { y: s.y, m };
    });
  };

  // Build the cell array: leading blanks + day numbers.
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        {/* month nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => step(-1)}
            className="rounded px-3 py-1 text-sm font-semibold"
            style={{ color: T.soft, border: `1px solid ${T.border}` }}
          >
            ← Prev
          </button>
          <div className="text-center">
            <div className="text-lg font-extrabold" style={{ color: T.ink }}>
              {monthLabel}
            </div>
            <div className="text-xs" style={{ color: T.muted }}>
              {monthCount} campaign{monthCount === 1 ? "" : "s"} this month
            </div>
          </div>
          <button
            onClick={() => step(1)}
            className="rounded px-3 py-1 text-sm font-semibold"
            style={{ color: T.soft, border: `1px solid ${T.border}` }}
          >
            Next →
          </button>
        </div>

        {/* weekday header */}
        <div className="mt-4 grid" style={{ gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="text-xs font-bold uppercase text-center pb-1"
              style={{ color: T.muted, letterSpacing: "0.04em" }}
            >
              {w}
            </div>
          ))}
          {cells.map((day, i) => {
            const weekend = i % 7 === 0 || i % 7 === 6;
            const camps = day ? campByDay.get(day) ?? [] : [];
            const rels = day ? relByDay.get(day) ?? [] : [];
            return (
              <div
                key={i}
                style={{
                  minHeight: 108,
                  background: day ? (weekend ? T.bg : T.surface) : "transparent",
                  border: day ? `1px solid ${T.border}` : "1px solid transparent",
                  borderRadius: 8,
                  padding: day ? 6 : 0,
                }}
              >
                {day && (
                  <>
                    <div className="text-xs font-semibold" style={{ color: T.soft }}>
                      {day}
                    </div>
                    <div className="mt-1 flex flex-col gap-1">
                      {camps.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => navigate(`/campaign/${c.id}`)}
                          title={`${c.name} · ${c.type} · ${c.channel} · ${c.audience}`}
                          className="text-left rounded px-2 py-1 text-xs font-semibold truncate"
                          style={{ background: typeColor(c.type), color: "#fff", cursor: "pointer", border: "none" }}
                        >
                          {c.name}
                        </button>
                      ))}
                      {rels.map((r) => (
                        <div
                          key={r.date + r.name}
                          title={`Release · ${r.name}`}
                          className="rounded px-2 py-1 text-xs font-semibold truncate flex items-center gap-1"
                          style={{ background: T.bg, color: RELEASE_COLOR, border: `1px solid ${RELEASE_COLOR}` }}
                        >
                          <span
                            style={{ width: 7, height: 7, background: RELEASE_COLOR, transform: "rotate(45deg)", display: "inline-block" }}
                          />
                          {r.name}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <CampaignTypeLegend />
        </div>
      </Card>

      <p className="text-xs" style={{ color: T.muted, lineHeight: 1.6 }}>
        Campaign activity clusters across June–August 2026. Click a chip to open that campaign's impact
        detail. Product releases are overlaid as outlined tags.
      </p>
    </div>
  );
}
