/* ===========================================================================
   /analytics — GATING & LABELLING CONSTANTS
=========================================================================== */
import type { Metric } from "../data/schema";

export const MIN_N = 300; // minimum exposed teachers before a result renders
export const MATERIALITY = 0.05; // 5% seasonally-adjusted change to count as material
export const YOY_LAG = 364; // preserves day-of-week alignment

export const METRIC_LABEL: Record<Metric, string> = {
  wau: "Weekly active teachers",
  resourceOpens: "Resource engagement",
  assignmentsCreated: "Assignments created",
  classesCreated: "Classes created",
  ahaUsers: "Adoption (class or assignment created)",
};
