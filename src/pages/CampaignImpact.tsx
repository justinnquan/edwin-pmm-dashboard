/* ===========================================================================
   /pages — CAMPAIGN IMPACT (§04)
   Summary · product impact · Before vs. After (window + seasonal toggle) ·
   send-cohort vs. matched baseline · cohort progression · interpretation.
   Reached from the Marketing Performance table or the Overview timeline.
=========================================================================== */
import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import type { CampaignDef, Metric } from "../data/schema";
import { CAMPAIGNS } from "../data/campaigns";
import { fmtShort } from "../data/calendar";
import { MIN_N, METRIC_LABEL } from "../analytics/constants";
import { pct, int } from "../analytics/format";
import { cellFilter } from "../analytics/kpis";
import { campaignImpact } from "../analytics/attribution";
import {
  campaignOpens,
  campaignClicks,
  campaignCTR,
  campaignCTOR,
  primaryMetric,
  matchedBaseline,
  cohortProgression,
  sustainedVerdict,
  campaignInterpretation,
} from "../analytics/campaign";
import { useFilters } from "../state/filterStore";
import { T, num } from "../theme/tokens";
import { Card, Chip } from "../components/primitives";
import { ProductImpactGrid, IMPACT_METRICS } from "../components/ProductImpact";

const toneColor = { positive: T.good, negative: T.warn, watch: T.blue } as const;

/* ---- Campaign picker (index at /campaign) --------------------------------- */
export function CampaignPicker() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: T.soft }}>
        Pick a campaign to open its impact detail.
      </p>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
        {CAMPAIGNS.map((c) => (
          <Link key={c.id} to={`/campaign/${c.id}`} style={{ textDecoration: "none" }}>
            <Card className="p-4" style={{ height: "100%" }}>
              <Chip tone="blue">{c.type}</Chip>
              <div className="mt-2 text-sm font-bold" style={{ color: T.ink }}>
                {c.name}
              </div>
              <div className="mt-1 text-xs" style={{ color: T.muted }}>
                {c.channel} · {fmtShort(c.launch)} · {int(c.sends)} sends
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---- Detail --------------------------------------------------------------- */
export default function CampaignImpact() {
  const { id } = useParams();
  const campaign = CAMPAIGNS.find((c) => c.id === id);
  if (!campaign) {
    return (
      <Card className="p-6">
        <div className="text-base font-bold" style={{ color: T.ink }}>
          Campaign not found
        </div>
        <Link to="/marketing" className="mt-2 inline-block text-sm" style={{ color: T.blue }}>
          ← Back to Marketing Performance
        </Link>
      </Card>
    );
  }
  return <Detail key={campaign.id} campaign={campaign} />;
}

function Detail({ campaign }: { campaign: CampaignDef }) {
  const navigate = useNavigate();
  const { province, grade, subject, win } = useFilters();
  const ids = useMemo(() => cellFilter({ province, grade, subject }), [province, grade, subject]);

  const [metric, setMetric] = useState<Metric>(primaryMetric(campaign));
  const [localWin, setLocalWin] = useState<number>(win);
  const [adjust, setAdjust] = useState(true);

  const ctor = campaignCTOR(campaign);
  const impact = campaignImpact(campaign, metric, ids, localWin);
  const mb = matchedBaseline(campaign, metric, ids, localWin);
  const prog = cohortProgression(campaign, metric, ids);
  const verdict = sustainedVerdict(prog);
  const interp = campaignInterpretation(campaign, ids, localWin);

  const metricByLabel = new Map(IMPACT_METRICS.map((m) => [METRIC_LABEL[m], m]));

  return (
    <div className="flex flex-col gap-6">
      {/* Summary header */}
      <Card className="p-5" style={{ borderColor: T.blue }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Chip tone="blue">{campaign.type}</Chip>
            <div className="mt-2 text-xl font-extrabold" style={{ color: T.ink }}>
              {campaign.name}
            </div>
            <div className="text-xs" style={{ color: T.muted }}>
              {campaign.channel} · Launched {fmtShort(campaign.launch)} · {campaign.audience}
            </div>
          </div>
          <button
            onClick={() => navigate("/marketing")}
            className="rounded px-2 py-1 text-xs font-semibold"
            style={{ color: T.soft, border: `1px solid ${T.border}` }}
          >
            ← All campaigns
          </button>
        </div>

        <div
          className="mt-4 grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))" }}
        >
          {[
            { k: "Sends", v: int(campaign.sends) },
            { k: "Opens", v: int(campaignOpens(campaign)) },
            { k: "Clicks", v: int(campaignClicks(campaign)) },
            { k: "CTR", v: (campaignCTR(campaign) * 100).toFixed(1) + "%" },
            { k: "CTOR", v: ctor == null ? "—" : (ctor * 100).toFixed(1) + "%" },
          ].map((s) => (
            <div key={s.k} className="rounded p-3" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
              <div className="text-xs font-bold uppercase" style={{ color: T.muted, letterSpacing: "0.05em" }}>
                {s.k}
              </div>
              <div className="mt-1 text-lg font-extrabold" style={{ ...num, color: T.ink }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Product impact */}
      <section>
        <h2 className="mb-3 text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
          Product impact · {localWin}-day window
        </h2>
        <ProductImpactGrid campaign={campaign} ids={ids} windowDays={localWin} />
      </section>

      {/* Controls for the analysis metric + window + adjustment */}
      <Card className="p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase" style={{ color: T.muted, letterSpacing: "0.05em" }}>
            Metric analysed
          </span>
          <select
            value={METRIC_LABEL[metric]}
            onChange={(e) => setMetric(metricByLabel.get(e.target.value) ?? metric)}
            className="rounded px-2 py-1 text-sm"
            style={{ border: `1px solid ${T.border}`, background: T.surface, color: T.ink, minWidth: 220 }}
          >
            {IMPACT_METRICS.map((m) => (
              <option key={m} value={METRIC_LABEL[m]}>
                {METRIC_LABEL[m]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase" style={{ color: T.muted, letterSpacing: "0.05em" }}>
            Window
          </span>
          <div className="flex rounded p-1" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
            {[7, 14, 30].map((w) => (
              <button
                key={w}
                onClick={() => setLocalWin(w)}
                className="rounded px-3 py-1 text-sm font-semibold"
                style={{
                  background: localWin === w ? T.surface : "transparent",
                  color: localWin === w ? T.blue : T.muted,
                  border: localWin === w ? `1px solid ${T.border}` : "1px solid transparent",
                }}
              >
                {w}d
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 mt-4 cursor-pointer">
          <input type="checkbox" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} />
          <span className="text-sm font-semibold" style={{ color: T.ink }}>
            Seasonally adjusted
          </span>
        </label>
      </Card>

      {/* Before vs After */}
      <section className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
              Before vs. after
            </h2>
            <Chip tone="muted">Observational</Chip>
          </div>
          {impact.state === "ok" ? (
            <>
              <div className="mt-4 flex items-center justify-between gap-3">
                <BeforeAfterCol label={`Before · ${localWin}d`} value={int(impact.pre)} />
                <div className="text-2xl" style={{ color: T.muted }}>
                  →
                </div>
                <BeforeAfterCol label={`After · ${localWin}d`} value={int(impact.post)} />
              </div>
              <div className="mt-4 pt-4 flex items-baseline justify-between" style={{ borderTop: `1px solid ${T.border}` }}>
                <span className="text-sm" style={{ color: T.soft }}>
                  {adjust ? "Seasonally adjusted change" : "Raw change"}
                </span>
                <span
                  className="text-3xl font-extrabold"
                  style={{
                    ...num,
                    color: (adjust ? impact.adjusted : impact.raw) >= 0 ? T.good : T.warn,
                  }}
                >
                  {pct(adjust ? impact.adjusted : impact.raw)}
                </span>
              </div>
              <p className="mt-2 text-xs" style={{ color: T.muted, lineHeight: 1.6 }}>
                Raw {pct(impact.raw)}. Prior-year baseline moved {pct(impact.expected)} over the same
                calendar window; the adjusted figure divides the two. Describes an association after
                exposure, not proven causation.
              </p>
            </>
          ) : (
            <GateNote state={impact} windowDays={localWin} />
          )}
        </Card>

        {/* Send-cohort vs matched baseline */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
              Send-cohort vs. matched baseline
            </h2>
            <Chip tone="warn">Association only</Chip>
          </div>
          {mb.state === "ok" ? (
            <>
              <div className="mt-4 flex items-center justify-between gap-3">
                <BeforeAfterCol label="Send cohort" value={pct(mb.sendAdjusted)} tone={mb.sendAdjusted >= 0 ? T.good : T.warn} />
                <div className="text-2xl" style={{ color: T.muted }}>
                  vs
                </div>
                <BeforeAfterCol label="Matched baseline" value={pct(mb.baseAdjusted)} tone={T.soft} />
              </div>
              <div className="mt-4 pt-4 flex items-baseline justify-between" style={{ borderTop: `1px solid ${T.border}` }}>
                <span className="text-sm" style={{ color: T.soft }}>
                  Difference (cohort − baseline)
                </span>
                <span
                  className="text-3xl font-extrabold"
                  style={{ ...num, color: mb.lift >= 0 ? T.good : T.warn }}
                >
                  {pct(mb.lift)}
                </span>
              </div>
              <p className="mt-2 text-xs" style={{ color: T.muted, lineHeight: 1.6 }}>
                {int(mb.n)} exposed teachers vs. comparable non-targeted teachers in this segment.
                A quasi-experimental stand-in for exposed/unexposed; a randomized holdout would be
                stronger.
              </p>
            </>
          ) : (
            <MatchedGate state={mb} windowDays={localWin} />
          )}
        </Card>
      </section>

      {/* Cohort progression */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
            Cohort progression · week over week
          </h2>
          {verdict !== "insufficient" && (
            <Chip tone={verdict === "sustained" ? "good" : "warn"}>
              {verdict === "sustained" ? "Sustained shift" : "One-week spike"}
            </Chip>
          )}
        </div>
        <p className="mt-1 text-xs" style={{ color: T.muted }}>
          Adjusted change for {METRIC_LABEL[metric]}, tracked each week since launch, to tell a lasting
          shift from a spike.
        </p>
        {prog.filter((p) => p.adjusted != null).length >= 2 ? (
          <div style={{ width: "100%", height: 220 }} className="mt-3">
            <ResponsiveContainer>
              <LineChart
                data={prog.map((p) => ({ week: `W${p.week}`, adjusted: p.adjusted == null ? null : p.adjusted * 100 }))}
                margin={{ top: 8, right: 16, bottom: 4, left: 4 }}
              >
                <CartesianGrid stroke={T.border} vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: T.muted }} axisLine={{ stroke: T.border }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: T.muted }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(v: unknown) =>
                    typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "—"
                  }
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${T.border}` }}
                />
                <ReferenceLine y={0} stroke={T.baseline} strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="adjusted"
                  stroke={T.blue}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: T.blue }}
                  isAnimationActive={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-3 text-sm" style={{ color: T.muted }}>
            Not enough weeks since launch to plot progression yet.
          </div>
        )}
      </Card>

      {/* Interpretation */}
      <section>
        <h2 className="mb-3 text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
          Interpretation
        </h2>
        {interp ? (
          <Card className="p-5" style={{ borderLeft: `3px solid ${toneColor[interp.tone]}` }}>
            <div className="text-sm font-semibold" style={{ color: T.ink, lineHeight: 1.5 }}>
              {interp.text}
            </div>
            <div className="mt-1 text-xs" style={{ color: T.muted, lineHeight: 1.6 }}>
              {interp.detail}
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <div className="text-sm" style={{ color: T.muted }}>
              No deterministic statement clears the materiality and minimum-sample gates for this
              campaign in the current segment.
            </div>
          </Card>
        )}
      </section>

      <div
        className="rounded p-3 text-xs"
        style={{ background: T.bg, color: T.soft, lineHeight: 1.6 }}
      >
        <b style={{ color: T.ink }}>How to read this.</b> Adjusted change divides the observed
        before/after movement by the movement in the prior-year baseline over the same calendar
        window. Every figure here describes an association following exposure, not proven causation.
        A true exposed-versus-held-out comparison requires a randomized holdout designed into the
        campaign before send.
      </div>
    </div>
  );
}

/* ---- small pieces --------------------------------------------------------- */
function BeforeAfterCol({ label, value, tone = T.ink }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex-1 text-center">
      <div className="text-xs font-bold uppercase" style={{ color: T.muted, letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold" style={{ ...num, color: tone }}>
        {value}
      </div>
    </div>
  );
}

function GateNote({
  state,
  windowDays,
}: {
  state: Exclude<ReturnType<typeof campaignImpact>, { state: "ok" }>;
  windowDays: number;
}) {
  return (
    <div className="mt-4 text-sm font-semibold" style={{ color: T.muted, lineHeight: 1.5 }}>
      {state.state === "insufficient-window" &&
        `Insufficient data — ${state.needed - state.elapsed} more day${
          state.needed - state.elapsed === 1 ? "" : "s"
        } needed for a ${windowDays}-day window.`}
      {state.state === "insufficient-n" &&
        `Insufficient data — ${state.n} exposed teachers, below the ${MIN_N} minimum.`}
      {state.state === "out-of-segment" && "No exposed teachers in the current segment."}
      {state.state === "no-baseline" && "No prior-year baseline available for this window."}
    </div>
  );
}

function MatchedGate({
  state,
  windowDays,
}: {
  state: Exclude<ReturnType<typeof matchedBaseline>, { state: "ok" }>;
  windowDays: number;
}) {
  return (
    <div className="mt-4 text-sm font-semibold" style={{ color: T.muted, lineHeight: 1.5 }}>
      {state.state === "no-holdout" &&
        "This campaign targeted every teacher, so there is no comparable unexposed group. A true comparison needs a randomized holdout designed in before send."}
      {state.state === "insufficient-window" &&
        `Insufficient data — ${state.needed - state.elapsed} more day${
          state.needed - state.elapsed === 1 ? "" : "s"
        } needed for a ${windowDays}-day window.`}
      {state.state === "insufficient-n" &&
        `Insufficient data — the send cohort or matched baseline is below the ${MIN_N}-teacher minimum.`}
      {state.state === "out-of-segment" && "No exposed teachers in the current segment."}
      {state.state === "no-baseline" && "No prior-year baseline available for this window."}
    </div>
  );
}
