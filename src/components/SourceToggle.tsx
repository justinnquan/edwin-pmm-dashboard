/* ===========================================================================
   /components — SAMPLE / LIVE TOGGLE
   Chooses the data source for the whole dashboard. Sits in the sidebar
   footer, and in the mobile nav where the sidebar is hidden. In preview mode
   neither side is selected: the dashboard is showing an unpublished import,
   and choosing either side leaves it.
=========================================================================== */
import { T } from "../theme/tokens";
import { useDataSource } from "../state/dataStore";

export function SourceToggle({ compact = false }: { compact?: boolean }) {
  const { mode, toSample, toLive } = useDataSource();
  const options = [
    { key: "live", label: "Live", pick: () => void toLive() },
    { key: "sample", label: "Sample", pick: toSample },
  ] as const;

  return (
    <div className={compact ? "flex items-center gap-2 shrink-0" : ""}>
      <div
        className="flex rounded-md p-0.5"
        role="tablist"
        aria-label="Data source"
        style={{ background: T.subtle, border: `1px solid ${T.border}` }}
      >
        {options.map((o) => {
          const on = mode === o.key;
          return (
            <button
              key={o.key}
              role="tab"
              aria-selected={on}
              onClick={() => {
                if (!on) o.pick();
              }}
              className={`flex-1 rounded ${compact ? "px-2.5 py-0.5" : "px-3 py-1"} text-xs font-bold`}
              style={{
                background: on ? T.blue : "transparent",
                color: on ? T.surface : T.soft,
                boxShadow: on ? T.shadowXs : "none",
                fontFamily: T.fontUI,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {mode === "preview" && (
        <div
          className={compact ? "text-xs font-semibold whitespace-nowrap" : "mt-2 text-xs font-semibold"}
          style={{ color: T.caution }}
        >
          Previewing unpublished import
        </div>
      )}
    </div>
  );
}
