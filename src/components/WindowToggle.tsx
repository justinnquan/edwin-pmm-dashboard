/* ===========================================================================
   /components — COMPARE BEFORE/AFTER
   How many days either side of a send are compared. Same control in the
   global filter bar and on Campaign Impact, so the wording cannot drift.
=========================================================================== */
import { T, eyebrow } from "../theme/tokens";

export const WINDOW_OPTIONS = [
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "30 days" },
] as const;

export const WINDOW_HINT = "How many days before and after each send we compare.";

/** "1 week", "2 weeks" or "30 days" for a window length. */
export const windowLabel = (days: number): string =>
  WINDOW_OPTIONS.find((o) => o.days === days)?.label ?? `${days} days`;

export function WindowToggle({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-xs font-bold uppercase flex items-center gap-1"
        style={eyebrow}
      >
        Compare before/after
        <span
          title={WINDOW_HINT}
          aria-label={WINDOW_HINT}
          className="inline-flex items-center justify-center rounded-full"
          style={{ width: 14, height: 14, border: `1px solid ${T.faint}`, fontSize: 9, cursor: "help", textTransform: "none", letterSpacing: 0 }}
        >
          i
        </span>
      </span>
      <div
        className="flex rounded-md p-0.5"
        role="radiogroup"
        aria-label="Compare before/after"
        style={{ background: T.subtle, border: `1px solid ${T.border}`, height: 34 }}
      >
        {WINDOW_OPTIONS.map((o) => {
          const on = value === o.days;
          return (
            <button
              key={o.days}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.days)}
              className="rounded px-2.5 text-sm font-bold whitespace-nowrap"
              style={{
                background: on ? T.surface : "transparent",
                color: on ? T.blue : T.muted,
                boxShadow: on ? T.shadowXs : "none",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
