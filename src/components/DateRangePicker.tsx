/* ===========================================================================
   /components — DATE RANGE PICKER
   One "Dates" button that opens presets beside a range calendar. The
   calendar only offers days inside the selected school year that the
   dashboard can show — never before the data starts, after a past year's
   last published day, or after today — so there is no way to ask for a
   range that would render empty for a reason the reader cannot see.
=========================================================================== */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { T, eyebrow } from "../theme/tokens";
import { Icon } from "./Icon";
import { fmtRange, fromIso, iso } from "../lib/dates";
import type { Preset } from "../state/filterStore";

const RDP_STYLE = {
  "--rdp-accent-color": T.blue,
  "--rdp-accent-background-color": `${T.blue}1A`,
  "--rdp-day-height": "34px",
  "--rdp-day-width": "34px",
  "--rdp-day_button-height": "32px",
  "--rdp-day_button-width": "32px",
  "--rdp-nav-height": "32px",
  fontSize: 13,
  color: T.ink,
} as CSSProperties;

const PRESETS: { key: Exclude<Preset, "custom">; label: string }[] = [
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "year", label: "Whole school year" },
];

function useNarrow(): boolean {
  const q = "(max-width: 639px)";
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}

export function DateRangePicker({
  from,
  to,
  min,
  max,
  preset,
  onApply,
}: {
  from: string;
  to: string;
  /** Earliest and latest selectable days (ISO). */
  min: string;
  max: string;
  preset: Preset;
  onApply: (preset: Preset, range?: { from: string; to: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const box = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  // Shift the popover left when it would run off the right edge of the window.
  const [shift, setShift] = useState(0);
  const narrow = useNarrow();

  useEffect(() => {
    if (!open) return;
    setDraft({ from: fromIso(from), to: fromIso(to) });
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, from, to]);

  useLayoutEffect(() => {
    // Measured on open, while the shift is still zero from the last close.
    if (!open || !pop.current) return setShift(0);
    const r = pop.current.getBoundingClientRect();
    const over = r.right - (window.innerWidth - 16);
    setShift(over > 0 ? -Math.min(over, r.left - 16) : 0);
  }, [open, narrow]);

  const minD = fromIso(min);
  const maxD = fromIso(max);
  const canApply = !!draft?.from && !!draft?.to;
  // Two months side by side, ending on the month the range ends in.
  const endMonth = new Date(Date.UTC(maxD.getUTCFullYear(), maxD.getUTCMonth(), 1));
  const toD = fromIso(to);
  const shownEnd = new Date(Date.UTC(toD.getUTCFullYear(), toD.getUTCMonth(), 1));
  const defaultMonth = narrow
    ? shownEnd
    : new Date(Date.UTC(shownEnd.getUTCFullYear(), shownEnd.getUTCMonth() - 1, 1)) < minD
    ? new Date(Date.UTC(minD.getUTCFullYear(), minD.getUTCMonth(), 1))
    : new Date(Date.UTC(shownEnd.getUTCFullYear(), shownEnd.getUTCMonth() - 1, 1));

  return (
    <div className="relative flex flex-col gap-1" ref={box}>
      <span className="text-xs font-bold uppercase" style={eyebrow}>
        Dates
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="rounded px-2.5 text-sm text-left flex items-center gap-2"
        style={{
          border: `1px solid ${open ? T.blue : T.faint}`,
          background: T.surface,
          color: T.ink,
          minWidth: 200,
          height: 34,
          boxShadow: open ? "0 0 0 3px rgba(1,122,204,0.25)" : "none",
        }}
      >
        <Icon name="calendar" size={16} style={{ color: T.blue }} />
        {fmtRange(from, to)}
      </button>

      {open && (
        <div
          ref={pop}
          role="dialog"
          aria-label="Choose dates"
          className="absolute z-30 mt-1 rounded-lg p-3 flex flex-col sm:flex-row gap-3"
          style={{
            top: "100%",
            left: shift,
            background: T.surface,
            border: `1px solid ${T.border}`,
            boxShadow: T.shadowLg,
            width: "max-content",
            maxWidth: "calc(100vw - 32px)",
          }}
        >
          <div className="flex sm:flex-col gap-1 flex-wrap sm:pr-3" style={{ borderRight: narrow ? "none" : `1px solid ${T.border}` }}>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  onApply(p.key);
                  setOpen(false);
                }}
                className={"rounded-md px-3 py-1.5 text-sm font-bold text-left whitespace-nowrap" + (preset === p.key ? "" : " phia-ghost")}
                style={{
                  background: preset === p.key ? T.blue100 : "transparent",
                  color: preset === p.key ? T.blue : T.soft,
                }}
              >
                {p.label}
              </button>
            ))}
            <div className="hidden sm:block mt-2 px-3 text-xs" style={{ color: T.muted, maxWidth: 150, lineHeight: 1.5 }}>
              Or pick a start and end day on the calendar.
            </div>
          </div>

          <div>
            <div>
              <DayPicker
                mode="range"
                timeZone="UTC"
                numberOfMonths={narrow ? 1 : 2}
                selected={draft}
                onSelect={(next, day) =>
                  // With a range already chosen, a click starts a new one rather
                  // than nudging whichever end is nearer — the way people expect
                  // "pick a start, then an end" to work.
                  setDraft(draft?.from && draft?.to ? { from: day, to: undefined } : next)
                }
                defaultMonth={defaultMonth}
                startMonth={new Date(Date.UTC(minD.getUTCFullYear(), minD.getUTCMonth(), 1))}
                endMonth={endMonth}
                disabled={[{ before: minD }, { after: maxD }]}
                excludeDisabled
                // The library declares its variables on its own root, so they
                // must be set there — inherited ones lose to them.
                style={RDP_STYLE}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs" style={{ color: T.muted }}>
                {draft?.from && draft?.to
                  ? fmtRange(iso(draft.from), iso(draft.to))
                  : draft?.from
                  ? "Now pick an end day"
                  : "Pick a start day"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="phia-ghost rounded-md px-3 py-1 text-sm font-bold"
                  style={{ color: T.blue, border: `1px solid ${T.blue}`, background: T.surface }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canApply}
                  onClick={() => {
                    if (!draft?.from || !draft?.to) return;
                    onApply("custom", { from: iso(draft.from), to: iso(draft.to) });
                    setOpen(false);
                  }}
                  className="rounded-md px-3 py-1 text-sm font-bold"
                  style={{
                    color: canApply ? T.surface : T.faint,
                    background: canApply ? T.blue : T.border,
                    cursor: canApply ? "pointer" : "not-allowed",
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
