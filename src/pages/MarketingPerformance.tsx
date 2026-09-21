/* ===========================================================================
   /pages — MARKETING PERFORMANCE (§02)
   Sortable campaign table · channel roll-up · 2-up campaign comparison.
=========================================================================== */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PublicCampaign, CampaignImpact, Metric } from "../data/schema";
import { src } from "../data/source";
import { fmtShort } from "../lib/dates";
import { pct, int } from "../analytics/format";
import { cellFilter } from "../analytics/kpis";
import { campaignImpact } from "../analytics/attribution";
import {
  campaignOpens,
  campaignClicks,
  campaignCTR,
  campaignCTOR,
  primaryMetric,
  channelRollup,
  cohortProgression,
  sustainedVerdict,
  type Sustained,
} from "../analytics/campaign";
import { useFilters } from "../state/filterStore";
import { T, num } from "../theme/tokens";
import { Card, Chip, Select } from "../components/primitives";
import { ImpactValue, ProductImpactGrid } from "../components/ProductImpact";

type SortKey = "name" | "channel" | "launch" | "sends" | "ctr" | "ctor" | "assoc";

interface Row {
  c: PublicCampaign;
  opens: number;
  clicks: number;
  ctr: number;
  ctor: number | null;
  metric: Metric;
  r: CampaignImpact;
  sustained: Sustained;
  assocSort: number;
}

const sustainChip: Record<Sustained, { tone: "good" | "warn" | "muted"; word: string }> = {
  sustained: { tone: "good", word: "Sustained" },
  faded: { tone: "muted", word: "Held, then faded" },
  spike: { tone: "warn", word: "One-week spike" },
  insufficient: { tone: "muted", word: "—" },
};

function Th({
  label,
  k,
  sort,
  setSort,
  align = "right",
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  setSort: (s: { key: SortKey; dir: 1 | -1 }) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === k;
  const numeric = k !== "name" && k !== "channel";
  return (
    <th
      className={`pb-2 ${align === "left" ? "text-left pr-3" : "text-right px-3"} font-bold cursor-pointer select-none`}
      onClick={() => setSort({ key: k, dir: active ? (sort.dir === 1 ? -1 : 1) : numeric ? -1 : 1 })}
      style={{ color: active ? T.navy : T.muted }}
    >
      {label}
      <span style={{ opacity: active ? 1 : 0.25 }}>{active ? (sort.dir === 1 ? " ▲" : " ▼") : " ↕"}</span>
    </th>
  );
}

export default function MarketingPerformance() {
  const navigate = useNavigate();
  const { province, grade, subject, win, range } = useFilters();
  const ids = useMemo(() => cellFilter({ province, grade, subject }), [province, grade, subject]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "assoc", dir: -1 });

  const rows = useMemo<Row[]>(() => {
    return src().campaigns.map((c) => {
      const metric = primaryMetric(c);
      const r = campaignImpact(c, metric, ids, win);
      const sustained = sustainedVerdict(cohortProgression(c, metric, ids));
      const assocSort = r.state === "ok" ? r.adjusted : Number.NEGATIVE_INFINITY;
      return {
        c,
        opens: campaignOpens(c),
        clicks: campaignClicks(c),
        ctr: campaignCTR(c),
        ctor: campaignCTOR(c),
        metric,
        r,
        sustained,
        assocSort,
      };
    });
  }, [ids, win]);

  const sorted = useMemo(() => {
    const val = (row: Row): number | string => {
      switch (sort.key) {
        case "name":
          return row.c.name;
        case "channel":
          return row.c.channel;
        case "launch":
          return row.c.launch;
        case "sends":
          return row.c.sends;
        case "ctr":
          return row.ctr;
        case "ctor":
          return row.ctor ?? -1;
        case "assoc":
          return row.assocSort;
      }
    };
    return [...rows].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
      return cmp * sort.dir;
    });
  }, [rows, sort]);

  const channels = useMemo(() => channelRollup(ids, win, range), [ids, win, range]);

  // Comparison state
  const all = src().campaigns;
  const [aName, setAName] = useState(all[0].name);
  const [bName, setBName] = useState(all[Math.min(3, all.length - 1)].name);
  const campA = all.find((c) => c.name === aName) ?? all[0];
  const campB = all.find((c) => c.name === bName) ?? all[Math.min(1, all.length - 1)];

  return (
    <div className="flex flex-col gap-6">
      {/* Campaign table */}
      <Card className="p-5">
        <h2
          className="text-sm font-extrabold uppercase"
          style={{ color: T.navy, letterSpacing: "0.07em" }}
        >
          Campaigns
        </h2>
        <p className="mt-1 mb-3 text-xs" style={{ color: T.muted }}>
          Channel engagement beside the seasonally-adjusted product change that followed, gated at{" "}
          {win}-day windows. Click a header to sort, a row to open the campaign.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ minWidth: 900 }}>
            <thead>
              <tr className="text-xs uppercase" style={{ letterSpacing: "0.05em" }}>
                <Th label="Campaign" k="name" sort={sort} setSort={setSort} align="left" />
                <Th label="Channel" k="channel" sort={sort} setSort={setSort} align="left" />
                <Th label="Launch" k="launch" sort={sort} setSort={setSort} />
                <Th label="Sends" k="sends" sort={sort} setSort={setSort} />
                <th className="pb-2 px-3 text-right font-bold" style={{ color: T.muted }}>
                  Opens
                </th>
                <th className="pb-2 px-3 text-right font-bold" style={{ color: T.muted }}>
                  Clicks
                </th>
                <Th label="CTR" k="ctr" sort={sort} setSort={setSort} />
                <Th label="CTOR" k="ctor" sort={sort} setSort={setSort} />
                <Th label="Assoc. change" k="assoc" sort={sort} setSort={setSort} />
                <th className="pb-2 pl-3 text-right font-bold" style={{ color: T.muted }}>
                  Sustained
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const sc = sustainChip[row.sustained];
                return (
                  <tr
                    key={row.c.id}
                    onClick={() => navigate(`/campaign/${row.c.id}`)}
                    className="cursor-pointer"
                    style={{ borderTop: `1px solid ${T.border}` }}
                  >
                    <td className="py-3 pr-3">
                      <div className="text-sm font-semibold" style={{ color: T.ink }}>
                        {row.c.name}
                      </div>
                      <div className="text-xs" style={{ color: T.muted }}>
                        {row.c.type}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-sm" style={{ color: T.soft }}>
                      {row.c.channel}
                    </td>
                    <td className="py-3 px-3 text-sm text-right" style={num}>
                      {fmtShort(row.c.launch)}
                    </td>
                    <td className="py-3 px-3 text-sm text-right" style={num}>
                      {int(row.c.sends)}
                    </td>
                    <td className="py-3 px-3 text-sm text-right" style={{ ...num, color: T.soft }}>
                      {int(row.opens)}
                    </td>
                    <td className="py-3 px-3 text-sm text-right" style={{ ...num, color: T.soft }}>
                      {int(row.clicks)}
                    </td>
                    <td className="py-3 px-3 text-sm text-right" style={num}>
                      {(row.ctr * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-sm text-right" style={num}>
                      {row.ctor == null ? "N/A" : (row.ctor * 100).toFixed(1) + "%"}
                    </td>
                    <td className="py-3 px-3 text-sm text-right" style={num}>
                      <ImpactValue r={row.r} />
                    </td>
                    <td className="py-3 pl-3 text-right">
                      {row.sustained === "insufficient" ? (
                        <span className="text-sm" style={{ color: T.muted }}>
                          —
                        </span>
                      ) : (
                        <Chip tone={sc.tone}>{sc.word}</Chip>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Channel roll-up */}
      <section>
        <h2
          className="mb-3 text-sm font-extrabold uppercase"
          style={{ color: T.navy, letterSpacing: "0.07em" }}
        >
          Channel roll-up
        </h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          {channels.map((ch) => (
            <Card key={ch.channel} className="p-4">
              <div className="text-sm font-bold" style={{ color: T.ink }}>
                {ch.channel}
              </div>
              <div className="text-xs" style={{ color: T.muted }}>
                {ch.campaigns} campaign{ch.campaigns === 1 ? "" : "s"}
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-xs" style={{ color: T.muted }}>
                  Sends
                </span>
                <span className="text-sm font-semibold" style={{ ...num, color: T.ink }}>
                  {int(ch.sends)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xs" style={{ color: T.muted }}>
                  Avg CTR
                </span>
                <span className="text-sm font-semibold" style={{ ...num, color: T.ink }}>
                  {(ch.ctr * 100).toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xs" style={{ color: T.muted }}>
                  Reached
                </span>
                <span className="text-sm font-semibold" style={{ ...num, color: T.ink }}>
                  {int(ch.reached)}
                </span>
              </div>
              <div
                className="mt-3 pt-3 flex items-baseline justify-between"
                style={{ borderTop: `1px solid ${T.border}` }}
              >
                <span className="text-xs" style={{ color: T.muted }}>
                  Assoc. change
                </span>
                <span
                  className="text-lg font-extrabold"
                  style={{ ...num, color: ch.assoc == null ? T.muted : ch.assoc >= 0 ? T.good : T.warn }}
                >
                  {ch.assoc == null ? "—" : pct(ch.assoc)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section>
        <h2
          className="mb-1 text-sm font-extrabold uppercase"
          style={{ color: T.navy, letterSpacing: "0.07em" }}
        >
          Compare two campaigns
        </h2>
        <p className="mb-3 text-xs" style={{ color: T.muted }}>
          Downstream product change side by side, to learn which activity type moves behaviour. All
          figures are {win}-day, seasonally adjusted, and N-gated.
        </p>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
          {[
            { camp: campA, name: aName, set: setAName },
            { camp: campB, name: bName, set: setBName },
          ].map((col, i) => (
            <Card key={i} className="p-5">
              <Select
                label="Campaign"
                value={col.name}
                options={all.map((c) => c.name)}
                onChange={col.set}
              />
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs" style={{ color: T.muted }}>
                <span>{col.camp.channel}</span>
                <span>{fmtShort(col.camp.launch)}</span>
                <span style={num}>{int(col.camp.sends)} sends</span>
                <span style={num}>CTR {(campaignCTR(col.camp) * 100).toFixed(1)}%</span>
              </div>
              <div className="mt-4">
                <ProductImpactGrid campaign={col.camp} ids={ids} windowDays={win} />
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
