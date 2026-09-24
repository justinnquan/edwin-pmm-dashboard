/* ===========================================================================
   /components — SAMPLE / LIVE TOGGLE
   Chooses the data source for the whole dashboard. Sits on the dark rail, and
   in the mobile nav where the rail is hidden. In preview mode neither side is
   selected: the dashboard is showing an unpublished import, and choosing
   either side leaves it.
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
        className="flex rounded p-0.5"
        role="tablist"
        aria-label="Data source"
        style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)" }}
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
              className={`flex-1 rounded ${compact ? "px-2 py-0.5" : "px-3 py-1"} text-xs font-semibold`}
              style={{
                background: on ? T.blue : "transparent",
                color: on ? "#fff" : "rgba(255,255,255,.6)",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {mode === "preview" && (
        <div
          className={compact ? "text-xs whitespace-nowrap" : "mt-2 text-xs"}
          style={{ color: "#F6AD55" }}
        >
          Previewing unpublished import
        </div>
      )}
    </div>
  );
}
