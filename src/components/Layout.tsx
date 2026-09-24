/* ===========================================================================
   /components — APP SHELL / LAYOUT
   Rail + top bar (route title + Leadership/PMM toggle) + global filter bar +
   methodology strip, wrapping every routed page via <Outlet/>. Filters live in
   the Zustand store so all pages recompute against the same global state. On
   small screens the rail collapses to a scrollable top nav. Pages are lazy-
   loaded behind a Suspense fallback and an error boundary.
=========================================================================== */
import { Suspense, useState } from "react";
import { Outlet, useLocation, NavLink } from "react-router-dom";
import type { SummableMetric } from "../data/schema";
import { src } from "../data/source";
import { MIN_N, MATERIALITY, CONFIDENCE_Z, BASELINE_SMOOTH } from "../analytics/constants";
import { useDataSource } from "../state/dataStore";
import { HISTORY_NEEDED } from "../data/file/load";
import { fmtShort, iso } from "../lib/dates";
import { pctAbs } from "../analytics/format";
import { useFilters } from "../state/filterStore";
import { T } from "../theme/tokens";
import { Rail } from "./Rail";
import { Select } from "./primitives";
import { NAV, navFor } from "./nav";
import { MethodologyModal } from "./MethodologyModal";
import { ErrorBoundary } from "./ErrorBoundary";
import { PageLoading } from "./states";
import { DateRangePicker } from "./DateRangePicker";
import { WindowToggle } from "./WindowToggle";
import { availableYears, yearWindow } from "../analytics/period";
import { SourceToggle } from "./SourceToggle";
import { LiveGate } from "./LiveGate";
import { EdwinLogo } from "./EdwinLogo";

/** One entry in the methodology strip: a bold term and its value. */
const term = { color: T.ink, fontWeight: 700 } as const;

export function Layout() {
  const { pathname } = useLocation();
  const meta = navFor(pathname);
  const { view, schoolYear, preset, from, to, win, metric, province, grade, subject, update, setYear, setDates } =
    useFilters();
  const years = availableYears();
  const yw = yearWindow(schoolYear);
  const version = useDataSource((s) => s.version);
  const mode = useDataSource((s) => s.mode);
  const liveStatus = useDataSource((s) => s.live.status);
  // Live selected but no real data yet: nothing that describes the synthetic
  // source underneath may render — not the pages, and not the filter bar or
  // strip either. /data stays open, since Live is published there.
  const liveWaiting = mode === "live" && liveStatus !== "ready";
  const gated = liveWaiting && pathname !== "/data";
  // Read through src() rather than caching: the strip must describe whatever
  // source is active right now.
  const source = src();
  const hasYoY = source.coverage.canAdjust;
  const dims = source.dimensions;
  const unsegmented =
    dims.province.length <= 1 && dims.grade.length <= 1 && dims.subject.length <= 1;
  const isPMM = view === "Product Marketing";
  const showTrendMetric = isPMM && pathname === "/";
  const [methodOpen, setMethodOpen] = useState(false);

  return (
    <div
      className="flex"
      style={{ fontFamily: T.font, background: T.bg, minHeight: "100%", color: T.soft }}
    >
      <Rail />

      <main className="flex-1 min-w-0">
        {/* Mobile brand + nav (rail is hidden below lg) */}
        <div
          className="lg:hidden"
          style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}
        >
          <div className="px-4 pt-3 pb-1 flex items-center gap-2">
            <EdwinLogo height={20} />
            <span className="text-sm font-semibold" style={{ color: T.muted }}>
              Product Marketing
            </span>
          </div>
          <nav className="flex items-center gap-1 px-4 py-2 overflow-x-auto" aria-label="Sections">
            <SourceToggle compact />
            {NAV.map((n) => (
              <NavLink
                key={n.path}
                to={n.path}
                end={n.path === "/"}
                className="whitespace-nowrap rounded-md px-3 py-1 text-xs font-bold"
                style={({ isActive }) => ({
                  color: isActive ? T.blue : T.soft,
                  background: isActive ? T.blue100 : "transparent",
                  textDecoration: "none",
                })}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Top bar */}
        <header
          className="px-4 sm:px-6 lg:px-10 pt-6 lg:pt-8 pb-5 flex flex-wrap items-end justify-between gap-4"
          style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}
        >
          <div className="min-w-0">
            <h1
              className="text-2xl lg:text-4xl font-bold"
              style={{ color: T.ink, letterSpacing: "-0.01em", lineHeight: 1.15, margin: 0 }}
            >
              {meta.title}
            </h1>
            <p className="mt-1.5 text-sm lg:text-base" style={{ color: T.muted }}>
              {meta.subtitle}
            </p>
          </div>
          <div
            className="flex rounded-md p-0.5"
            role="tablist"
            aria-label="Audience view"
            style={{ background: T.subtle, border: `1px solid ${T.border}` }}
          >
            {(["Leadership", "Product Marketing"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => update({ view: v })}
                className="rounded-md px-3 py-1.5 text-sm font-bold"
                style={{
                  background: view === v ? T.surface : "transparent",
                  color: view === v ? T.blue : T.muted,
                  boxShadow: view === v ? T.shadowXs : "none",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </header>

        {!liveWaiting && (
          <>
            {/* Global filters */}
            <div
              className="px-4 sm:px-6 lg:px-10 py-3 flex flex-wrap items-end gap-3 sm:gap-5"
              style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}
            >
              <Select
                label="School year"
                value={schoolYear}
                options={years}
                onChange={setYear}
              />
              <DateRangePicker
                from={from}
                to={to}
                min={yw.min}
                max={yw.max}
                preset={preset}
                onApply={setDates}
              />
              <WindowToggle value={win} onChange={(w) => update({ win: w })} />
              {/* A dimension with a single value offers no choice, and rendering it
                  anyway invites selecting an option that empties the dashboard with
                  no explanation. Hidden entirely when the source is unsegmented. */}
              {dims.province.length > 1 && (
                <Select
                  label="Province"
                  value={province}
                  options={["All", ...dims.province]}
                  onChange={(v) => update({ province: v })}
                />
              )}
              {dims.grade.length > 1 && (
                <Select
                  label="Grade"
                  value={grade}
                  options={["All", ...dims.grade]}
                  onChange={(v) => update({ grade: v })}
                />
              )}
              {dims.subject.length > 1 && (
                <Select
                  label="Subject"
                  value={subject}
                  options={["All", ...dims.subject]}
                  onChange={(v) => update({ subject: v })}
                />
              )}
              {showTrendMetric && (
                <Select
                  label="Trend metric"
                  value={metric}
                  options={["wau", "resourceOpens", "assignmentsCreated", "classesCreated"]}
                  onChange={(v) => update({ metric: v as SummableMetric })}
                />
              )}
            </div>

            {/* Methodology + freshness strip */}
            <div
              className="px-4 sm:px-6 lg:px-10 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs"
              style={{ background: T.blue100, borderBottom: `1px solid ${T.blue200}`, color: T.soft }}
            >
              <span>
                <b style={term}>Data as of</b> {fmtShort(iso(source.asOf))} ·{" "}
                {source.label}
              </span>
              <span>
                <b style={term}>Dotted line</b> same week last school year, ±{BASELINE_SMOOTH}-day smoothed
                {source.coverage.seatsAreStock ? ", rescaled for seat growth" : ""}
              </span>
              <span>
                <b style={term}>Minimum sample</b> {MIN_N} exposed teachers
              </span>
              <span>
                <b style={term}>Materiality</b> {pctAbs(MATERIALITY)} floor or {CONFIDENCE_Z}× its own error, whichever is higher
              </span>
              {!hasYoY && (
                <span style={{ color: T.warn, fontWeight: 700 }}>
                  No seasonal baseline — {source.coverage.historyDays} days of history, needs{" "}
                  {HISTORY_NEEDED}
                </span>
              )}
              {!source.coverage.seatsAreStock && (
                <span
                  style={{ color: T.warn, fontWeight: 700 }}
                  title="This source has no licensed-seat count, so rates over seats — including the north-star active teacher rate and both OKR gauges — cannot be computed."
                >
                  No seat count — rates unavailable
                </span>
              )}
              {source.coverage.seatsAreStock && !source.coverage.perCellSeats && (
                <span title="Provisioned seats are allocated to segments by population weight rather than measured per segment. Segment-level rates are therefore modelled.">
                  <b style={term}>Denominator</b> modelled
                </span>
              )}
              {source.coverage.grain === "weekly" && (
                <span title="Rows arrive weekly and are expanded across their seven days, so day-of-week effects cannot be recovered and no uncertainty band is estimated.">
                  <b style={term}>Grain</b> weekly
                </span>
              )}
              {unsegmented && (
                <span title="This source carries no province, grade or subject breakdown, so every figure is platform-wide.">
                  <b style={term}>Scope</b> platform-wide
                </span>
              )}
              <span style={{ color: T.warn, fontWeight: 700 }}>Association, not causation</span>
              <button
                onClick={() => setMethodOpen(true)}
                className="phia-ghost rounded-md px-2.5 py-0.5 font-bold"
                style={{ color: T.blue, border: `1px solid ${T.blue}`, background: T.surface }}
              >
                Methodology
              </button>
            </div>
          </>
        )}

        <div className="px-4 sm:px-6 lg:px-10 py-6 pb-16">
          {/* Keying on `version` remounts every page when the data source is
              swapped. Remounting discards each page's useMemo cache wholesale,
              which is more reliable than adding `version` to a dozen dependency
              arrays and remembering to do it on every page added later. */}
          {gated ? (
            <LiveGate />
          ) : (
            <ErrorBoundary resetKey={`${pathname}:${version}`}>
              <Suspense fallback={<PageLoading />}>
                <Outlet key={version} />
              </Suspense>
            </ErrorBoundary>
          )}
        </div>
      </main>

      <MethodologyModal open={methodOpen} onClose={() => setMethodOpen(false)} />
    </div>
  );
}
