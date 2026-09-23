/* ===========================================================================
   /analytics — GATING & LABELLING CONSTANTS
=========================================================================== */
import type { Metric } from "../data/schema";

export const MIN_N = 300; // minimum exposed teachers before a result renders
export const MIN_DAILY_ACTIVE = 400; // minimum mean daily-active volume in each comparison window
/** A rolling 7-day distinct count covers more people than one day of the same
    population. Used to scale the volume floor when a source carries weekly
    actives but no daily ones, so the gate keeps roughly the same strictness
    rather than firing on every campaign or none. */
export const WAU_TO_DAILY = 2.5;
export const MATERIALITY = 0.05; // floor for a material seasonally-adjusted change
export const CONFIDENCE_Z = 1.96; // ~95% band; a change must also clear Z × its own std error
export const YOY_LAG = 364; // preserves day-of-week alignment
export const BASELINE_SMOOTH = 3; // ±N-day centred window for the prior-year baseline (tunable)

export const METRIC_LABEL: Record<Metric, string> = {
  wau: "Weekly active teachers",
  resourceOpens: "Resource engagement",
  assignmentsCreated: "Assignments created",
  classesCreated: "Classes created",
  ahaUsers: "Adoption (class or assignment created)",
};

/** Labels for every metric a chart can draw, including ones no campaign can
    declare as its objective. */
export const SERIES_LABEL: Record<string, string> = {
  ...METRIC_LABEL,
  newLogins: "New logged-in teachers",
  dailyActive: "Daily active teachers",
  provisioned: "Provisioned seats",
  retentionW4: "4-week retention",
};

/** The dotted line's name wherever it appears. */
export const LAST_YEAR_LABEL = "Last school year (same week)";
