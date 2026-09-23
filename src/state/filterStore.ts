/* ===========================================================================
   /state — GLOBAL FILTER / VIEW STORE
   Holds the filters, view mode, and selected campaign so every page shares
   the same global state.

   Dates are a school year plus a range inside it. The range is always kept
   inside the year's selectable window (see analytics/period.ts), so no page
   can be asked for days the source cannot have: before the data starts,
   after the last published day of a past year, or after today.
=========================================================================== */
import { create } from "zustand";
import type { SummableMetric } from "../data/schema";
import { addDays, fromIso, iso, schoolYearOf, todayIso } from "../lib/dates";
import { availableYears, setEvalDate, yearWindow } from "../analytics/period";

export type View = "Leadership" | "Product Marketing";
export type Preset = "30" | "90" | "year" | "custom";

export interface FilterState {
  view: View;
  schoolYear: string; // e.g. "2026/27"
  preset: Preset;
  from: string; // ISO, inclusive
  to: string; // ISO, inclusive
  win: number; // before/after comparison window (7 / 14 / 30)
  metric: SummableMetric; // trend metric
  province: string;
  grade: string;
  subject: string;
  picked: string | null; // selected campaign id
  update: (patch: Partial<FilterState>) => void;
  /** Choose a school year; the dates reset to that year's preset. */
  setYear: (label: string) => void;
  /** Apply a preset, or a custom range when `range` is given. */
  setDates: (preset: Preset, range?: { from: string; to: string }) => void;
  /** Re-fit the year and dates to the active source after a swap. */
  refit: () => void;
}

const YEAR_KEY = "edwin-pmm.school-year.v1";
const PRESET_KEY = "edwin-pmm.date-preset.v1";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* forget quietly */
  }
}

const clamp = (d: string, min: string, max: string) => (d < min ? min : d > max ? max : d);

/** Dates for a preset inside a school year's window. */
export function datesFor(year: string, preset: Preset): { from: string; to: string } {
  const w = yearWindow(year);
  if (preset === "year" || preset === "custom") return { from: w.min, to: w.max };
  const days = Number(preset);
  const from = iso(addDays(fromIso(w.max), -(days - 1)));
  return { from: clamp(from, w.min, w.max), to: w.max };
}

function pickYear(wanted: string | null): string {
  const years = availableYears();
  if (wanted && years.includes(wanted)) return wanted;
  const current = schoolYearOf(fromIso(todayIso()));
  return years.includes(current) ? current : years[0];
}

function initial() {
  const schoolYear = pickYear(read(YEAR_KEY));
  const stored = read(PRESET_KEY) as Preset | null;
  const preset: Preset = stored === "30" || stored === "90" ? stored : "year";
  const { from, to } = datesFor(schoolYear, preset);
  setEvalDate(fromIso(to));
  return { schoolYear, preset, from, to };
}

export const useFilters = create<FilterState>((set, get) => ({
  view: "Leadership",
  ...initial(),
  win: 7,
  metric: "wau",
  province: "All",
  grade: "All",
  subject: "All",
  picked: null,
  update: (patch) => set(patch),
  setYear: (label) => {
    const preset = get().preset === "custom" ? "year" : get().preset;
    const { from, to } = datesFor(label, preset);
    write(YEAR_KEY, label);
    setEvalDate(fromIso(to));
    set({ schoolYear: label, preset, from, to });
  },
  setDates: (preset, range) => {
    const { schoolYear } = get();
    const w = yearWindow(schoolYear);
    const next =
      preset === "custom" && range
        ? { from: clamp(range.from, w.min, w.max), to: clamp(range.to, w.min, w.max) }
        : datesFor(schoolYear, preset);
    if (preset !== "custom") write(PRESET_KEY, preset);
    setEvalDate(fromIso(next.to));
    set({ preset, ...next });
  },
  refit: () => {
    const schoolYear = pickYear(get().schoolYear);
    const preset = get().preset === "custom" ? "year" : get().preset;
    const { from, to } = datesFor(schoolYear, preset);
    setEvalDate(fromIso(to));
    set({ schoolYear, preset, from, to });
  },
}));
