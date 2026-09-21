/* ===========================================================================
   /analytics — GATING & LABELLING CONSTANTS
=========================================================================== */
import type { Metric } from "../data/schema";

export const MIN_N = 300; // minimum exposed teachers before a result renders
export const MIN_DAILY_ACTIVE = 400; // minimum mean daily-active volume in each comparison window
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
