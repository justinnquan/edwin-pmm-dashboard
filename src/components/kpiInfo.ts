/* ===========================================================================
   /components — KPI METADATA REGISTRY
   Definition, calculation, and limitation for every headline KPI, surfaced via
   InfoTip. Kept next to the presentation layer because it is display copy, not
   analytics. Wording mirrors the PRD's KPI framework (Phase 4).
=========================================================================== */
import type { KpiInfo } from "./InfoTip";

export const KPI_INFO = {
  activeRate: {
    definition: "Active teachers as a share of provisioned teachers, per period. The north-star: PMM's real lever is activating provisioned seats.",
    calculation: "Weekly active teachers ÷ provisioned teachers, over the trailing 7 days.",
    limitation: "Needs a reliable provisioned denominator; highly seasonal, so read the adjusted figure.",
  },
  wau: {
    definition: "Distinct teachers with at least one meaningful action in a rolling 7 days.",
    calculation: "Count of distinct active teachers over the trailing 7 days, in the current segment.",
    limitation: "Strongly seasonal (school calendar); the raw figure is paired with a seasonally-adjusted one.",
  },
  adoption: {
    definition: "Share of active teachers who performed a high-value 'aha' behaviour — creating a class or an assignment.",
    calculation: "Teachers with a class-or-assignment event ÷ weekly active teachers.",
    limitation: "The 'aha' definition is fixed here as class-or-assignment; a different definition shifts the number.",
  },
  retention: {
    definition: "Share of a start cohort still active four weeks later — the durability test.",
    calculation: "Active in week 4 ÷ cohort size, averaged across the current segment.",
    limitation: "Needs sufficient history depth; small cohorts are noisy.",
  },
  campaignAssociated: {
    definition: "Change in resource engagement for exposed teachers after recent campaigns, versus the seasonal baseline.",
    calculation: "Exposure-weighted mean of each recent campaign's seasonally-adjusted before/after change.",
    limitation: "Association only — confounded by seasonality and selection. Renders only past the minimum-sample gate.",
  },
  day7: {
    definition: "Share of newly invited teachers who reach an activation event within 7 days (Edwin OKR ≥ 70%).",
    calculation: "Modelled from weekly-active intensity of the provisioned population (no per-user cohort events here).",
    limitation: "A modelled proxy; a real build counts distinct invite→activation events. Sits below target during the fall ramp.",
  },
  monthly: {
    definition: "Distinct teachers active on any LMS feature in the last month (Edwin OKR ≥ 50%).",
    calculation: "Modelled as the reach across four independent weeks: 1 − (1 − weekly-active-rate)^4.",
    limitation: "A modelled estimate from aggregate data; treat the exact percentage as directional.",
  },
} satisfies Record<string, KpiInfo>;

export type KpiInfoKey = keyof typeof KPI_INFO;
