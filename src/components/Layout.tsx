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

export function Layout() {
  const { pathname } = useLocation();
  const meta = navFor(pathname);
  const { view, range, win, metric, province, grade, subject, update } = useFilters();
  const version = useDataSource((s) => s.version);
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
      style={{ fontFamily: T.font, background: T.bg, minHeight: "100%", color: T.ink }}
    >
      <Rail />

      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header
          className="px-4 sm:px-6 py-4 flex flex-wrap items-end justify-between gap-4"
          style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}
        >
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold" style={{ color: T.ink }}>
              {meta.title}
            </h1>
            <p className="mt-1 text-sm" style={{ color: T.soft }}>
              {meta.subtitle}
            </p>
          </div>
          <div
            className="flex rounded p-1"
            role="tablist"
            aria-label="Audience view"
            style={{ background: T.bg, border: `1px solid ${T.border}` }}
          >
            {(["Leadership", "Product Marketing"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => update({ view: v })}
                className="rounded px-3 py-1 text-sm font-semibold"
                style={{
                  background: view === v ? T.surface : "transparent",
                  color: view === v ? T.blue : T.muted,
                  border: view === v ? `1px solid ${T.border}` : "1px solid transparent",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </header>

        {/* Mobile nav (rail is hidden below lg) */}
        <nav
          className="lg:hidden flex gap-1 px-4 py-2 overflow-x-auto"
          aria-label="Sections"
          style={{ background: T.railTint }}
        >
          {NAV.map((n) => (
            <NavLink
              key={n.path}
              to={n.path}
              end={n.path === "/"}
              className="whitespace-nowrap rounded px-3 py-1 text-xs font-semibold"
              style={({ isActive }) => ({
                color: isActive ? "#fff" : "rgba(255,255,255,.6)",
                background: isActive ? "rgba(255,255,255,.12)" : "transparent",
                textDecoration: "none",
              })}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* Global filters */}
        <div
          className="px-4 sm:px-6 py-3 flex flex-wrap items-end gap-3 sm:gap-4"
          style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}
        >
          <Select
            label="Date range"
            value={String(range)}
            options={["30", "90", "180"]}
            onChange={(v) => update({ range: Number(v) })}
          />
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
          <Select
            label="Attribution window"
            value={String(win)}
            options={["7", "14", "30"]}
            onChange={(v) => update({ win: Number(v) })}
          />
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
          className="px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs"
          style={{ background: "#F1F6FB", borderBottom: `1px solid ${T.border}`, color: T.soft }}
        >
          <span>
            <b style={{ color: T.navy }}>Data as of</b> {fmtShort(iso(source.asOf))} ·{" "}
            {source.label}
          </span>
          <span>
            <b style={{ color: T.navy }}>Baseline</b> prior year, ±{BASELINE_SMOOTH}-day smoothed, rescaled for seat growth
          </span>
          <span>
            <b style={{ color: T.navy }}>Minimum sample</b> {MIN_N} exposed teachers
          </span>
          <span>
            <b style={{ color: T.navy }}>Materiality</b> {pctAbs(MATERIALITY)} floor or {CONFIDENCE_Z}× its own error, whichever is higher
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
              <b style={{ color: T.navy }}>Denominator</b> modelled
            </span>
          )}
          {source.coverage.grain === "weekly" && (
            <span title="Rows arrive weekly and are expanded across their seven days, so day-of-week effects cannot be recovered and no uncertainty band is estimated.">
              <b style={{ color: T.navy }}>Grain</b> weekly
            </span>
          )}
          {unsegmented && (
            <span title="This source carries no province, grade or subject breakdown, so every figure is platform-wide.">
              <b style={{ color: T.navy }}>Scope</b> platform-wide
            </span>
          )}
          <span style={{ color: T.warn, fontWeight: 700 }}>Association, not causation</span>
          <button
            onClick={() => setMethodOpen(true)}
            className="rounded px-2 py-0.5 font-semibold"
            style={{ color: T.blue, border: `1px solid ${T.blue}55`, background: T.surface }}
          >
            Methodology
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {/* Keying on `version` remounts every page when the data source is
              swapped. Remounting discards each page's useMemo cache wholesale,
              which is more reliable than adding `version` to a dozen dependency
              arrays and remembering to do it on every page added later. */}
          <ErrorBoundary resetKey={`${pathname}:${version}`}>
            <Suspense fallback={<PageLoading />}>
              <Outlet key={version} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <MethodologyModal open={methodOpen} onClose={() => setMethodOpen(false)} />
    </div>
  );
}
