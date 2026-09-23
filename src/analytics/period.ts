/* ===========================================================================
   /analytics — REPORTING PERIOD
   Which school years the active source can show, the dates each one spans,
   and the day the dashboard reports "as of".

   The as-of day used to be `src().asOf` everywhere: the last day of data. With
   a school-year filter it is the last day of the *selected* dates instead, so
   viewing 2025/26 reports Jun 30 2026 even after 2026/27 data exists. It is
   held as a module-level override for the same reason `src()` is: the
   analytics are plain functions called from pages and from the Node null
   test, and threading a date through every signature would churn dozens of
   call sites. The null test never sets it, so its output is unchanged.
=========================================================================== */
import { src } from "../data/source";
import {
  fromIso,
  iso,
  schoolYearBounds,
  schoolYearOf,
  priorSchoolYear,
  todayIso,
} from "../lib/dates";

let override: Date | null = null;

/** Set by the filter store whenever the selected end date changes. */
export function setEvalDate(d: Date | null): void {
  override = d;
}

/** The day KPIs and "recent" windows are measured to: the end of the
    selected dates, never later than the last day of data. */
export function evalDate(): Date {
  const asOf = src().asOf;
  return override && override < asOf ? override : asOf;
}

/** First and last day the active source has actuals for. */
export function dataSpan(): { from: string; to: string } {
  const to = iso(src().asOf);
  const from = iso(new Date(src().asOf.getTime() - (src().coverage.historyDays - 1) * 86400000));
  return { from, to };
}

/** School years to offer: every year the data touches, plus the current one
    by the calendar — which may have no actuals yet, and still has last year's
    dotted line to show. Newest first. */
export function availableYears(): string[] {
  const span = dataSpan();
  const current = schoolYearOf(fromIso(todayIso()));
  const years = new Set<string>([current]);
  for (let y = schoolYearOf(fromIso(span.from)); ; y = nextYear(y)) {
    const b = schoolYearBounds(y);
    if (b.from <= span.to && b.to >= span.from) years.add(y);
    if (y >= current || b.from > span.to) break;
  }
  return [...years].sort().reverse();
}

const nextYear = (label: string): string => {
  const start = Number(label.slice(0, 4)) + 1;
  return `${start}/${String(start + 1).slice(2)}`;
};

export interface YearWindow {
  label: string;
  /** Earliest and latest selectable days. */
  min: string;
  max: string;
  /** True for the school year the calendar is in now. */
  current: boolean;
  /** True when the source has at least one day of actuals inside [min, max]. */
  hasActuals: boolean;
}

/** The selectable span of one school year. A past year is clamped to where
    the data starts and ends; the current year runs to today, so its dotted
    last-year line can be read up to this week even before any of this
    year's data is published. */
export function yearWindow(label: string): YearWindow {
  const b = schoolYearBounds(label);
  const span = dataSpan();
  const today = todayIso();
  const current = schoolYearOf(fromIso(today)) === label;
  const min = current ? b.from : maxIso(b.from, span.from);
  const max = current ? minIso(b.to, today) : minIso(b.to, span.to);
  return { label, min, max, current, hasActuals: span.from <= max && span.to >= min };
}

/** True when the source has actuals anywhere in [from, to]. */
export function hasActualsIn(from: string, to: string): boolean {
  const span = dataSpan();
  return span.from <= to && span.to >= from;
}

/** Label for the year a comparison line is drawn from. */
export const priorYearOf = priorSchoolYear;

const maxIso = (a: string, b: string) => (a > b ? a : b);
const minIso = (a: string, b: string) => (a < b ? a : b);
