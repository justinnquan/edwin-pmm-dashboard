/* ===========================================================================
   /components — LIVE GATE
   Stands in for every page while Live is selected but not yet showing real
   data: locked, loading, nothing published, or the service unreachable.

   The point is that Live never renders the synthetic default underneath it.
   A synthetic figure under a "Live" toggle is the most misleading thing this
   dashboard could show, so nothing below the top bar draws until real data
   has arrived. /data is exempt, because it is where Live gets published.
=========================================================================== */
import { useState } from "react";
import { Link } from "react-router-dom";
import { T } from "../theme/tokens";
import { useDataSource } from "../state/dataStore";
import { EmptyState, PageLoading } from "./states";

const linkStyle = { color: T.surface, background: T.blue, textDecoration: "none" } as const;

export function LiveGate() {
  const { live, toLive } = useDataSource();
  const [pw, setPw] = useState("");

  if (live.status === "loading" || live.status === "idle") return <PageLoading />;

  if (live.status === "locked") {
    return (
      <EmptyState title="Live data is password protected">
        Enter the Live password to see the real 25/26 Edwin data. It is remembered in this browser.
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw) void toLive(pw);
          }}
        >
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            aria-label="Live password"
            placeholder="Password"
            autoComplete="current-password"
            className="rounded px-2 py-1 text-sm"
            style={{ border: `1px solid ${T.border}`, color: T.ink, background: T.surface }}
          />
          <button
            type="submit"
            disabled={!pw}
            className="rounded px-3 py-1 text-sm font-bold"
            style={{ color: T.surface, background: pw ? T.blue : T.muted }}
          >
            Unlock
          </button>
        </form>
        {live.message && (
          <div className="mt-2 text-xs" style={{ color: T.warn }}>
            {live.message}
          </div>
        )}
      </EmptyState>
    );
  }

  if (live.status === "empty") {
    return (
      <EmptyState title="No live data published yet">
        Load your 25/26 exports — the weekly usage rollup and the campaign workbook — on Data Import,
        validate them, and publish them as Live.
        <div className="mt-3">
          <Link to="/data" className="inline-block rounded px-3 py-1 text-sm font-bold" style={linkStyle}>
            Go to Data Import
          </Link>
        </div>
      </EmptyState>
    );
  }

  // unavailable | error
  return (
    <EmptyState title="Live data could not be loaded">
      {live.message}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => void toLive()}
          className="rounded px-3 py-1 text-sm font-bold"
          style={{ color: T.blue, border: `1px solid ${T.blue}55`, background: T.surface }}
        >
          Retry
        </button>
        <Link to="/data" className="inline-block rounded px-3 py-1 text-sm font-bold" style={linkStyle}>
          Go to Data Import
        </Link>
      </div>
    </EmptyState>
  );
}
