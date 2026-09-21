/* ===========================================================================
   /data — TYPED SCHEMA
   The contract every layer above /data honours. Swapping the synthetic
   generator for a real adapter must keep these shapes intact.
=========================================================================== */

/** The five product metrics campaigns can affect and the UI can label. */
export type Metric =
  | "wau"
  | "resourceOpens"
  | "assignmentsCreated"
  | "classesCreated"
  | "ahaUsers";

/** Every numeric field on a daily row the analytics layer may sum. */
export type SummableMetric =
  | "provisioned"
  | "dailyActive"
  | "wau"
  | "resourceOpens"
  | "classesCreated"
  | "assignmentsCreated"
  | "ahaUsers"
  | "retentionW4";

export interface Cell {
  id: number;
  province: string;
  grade: string;
  subject: string;
  weight: number;
  engagement: number;
}

/** Which cells a campaign was aimed at. An omitted or empty dimension means
    "all values of it", so `{}` targets the whole platform.

    This is a serializable description rather than a predicate because real
    campaign targeting arrives as data — Pardot list criteria, a CSV column —
    not as code. The data source compiles it into a predicate once. */
export interface TargetSpec {
  province?: string[];
  grade?: string[];
  subject?: string[];
}

export interface CampaignDef {
  id: string;
  name: string;
  type: string;
  channel: string;
  launch: string;
  audience: string;
  targetSpec: TargetSpec;
  sends: number;
  openRate: number;
  clickRate: number;
  /** PMM-authored objective declared before send — the metric this campaign set
      out to move. Survives the real-data swap (unlike `effects`). */
  objectiveMetric: Metric;
  /** Generator ground truth. NEVER read above /data — it will not exist in real
      data. The analytics layer must recover effect size from the data alone. */
  effects: Partial<Record<Metric, number>>;
  halfLife: number;
}

export interface Release {
  date: string;
  name: string;
}

export interface DailyRow {
  date: string;
  cellId: number;
  provisioned: number;
  dailyActive: number;
  wau: number;
  resourceOpens: number;
  classesCreated: number;
  assignmentsCreated: number;
  ahaUsers: number;
  retentionW4: number;
}

export interface SeriesPoint {
  date: string;
  value: number;
  baseline: number | null;
}

export interface Filters {
  province: string;
  grade: string;
  subject: string;
}

/** Result of a before/after campaign impact calculation, discriminated on state. */
export type CampaignImpact =
  | { state: "out-of-segment"; n: number }
  | { state: "insufficient-window"; n: number; elapsed: number; needed: number }
  | { state: "insufficient-n"; n: number }
  | { state: "insufficient-volume"; n: number; active: number }
  | { state: "no-baseline"; n: number }
  | {
      state: "ok";
      n: number;
      adjusted: number;
      raw: number;
      expected: number;
      material: boolean;
      se: number; // standard error of the adjusted change (delta method)
      threshold: number; // the bar it had to clear: max(MATERIALITY, Z × se)
      pre: number;
      post: number;
      bPre: number;
      bPost: number;
    };

/* ===========================================================================
   THE DATA CONTRACT
   Everything above /data reaches its data through this interface and nothing
   else. A real adapter satisfies it; the synthetic generator satisfies it; no
   consumer can tell which one it has.
=========================================================================== */

/** A campaign as the app is allowed to see it. Structurally omits `effects`
    and `halfLife` — the generator's answer key — so reading them above /data
    is a compile error rather than something code review has to catch. */
export interface PublicCampaign {
  id: string;
  name: string;
  type: string;
  channel: string;
  launch: string;
  audience: string;
  sends: number;
  opens: number;
  clicks: number;
  openRate: number;
  clickRate: number;
  objectiveMetric: Metric;
  targetSpec: TargetSpec;
  /** Compiled from `targetSpec` by the source. */
  target: (c: Cell) => boolean;
}

/** What this source can actually answer, so the UI can caveat honestly rather
    than presenting a modelled figure as a measured one. */
export interface Coverage {
  /** False where a column is absent from the source and the metric is unavailable. */
  metrics: Record<SummableMetric, boolean>;
  /** True when de-duplicated campaign reach is real rather than unavailable. */
  reach: boolean;
  /** True when provisioned seats are measured per cell rather than allocated
      from a population-level figure by segment weight. */
  perCellSeats: boolean;
  /** Days of history available. Below YOY_LAG + window, no seasonal baseline
      can be computed and every adjusted figure must degrade to unavailable. */
  historyDays: number;
}

export interface DataSource {
  /** Stable identity for this source, e.g. "synthetic" or "file:2026-09-21". */
  readonly id: string;
  /** Human-readable provenance, shown in the methodology strip. */
  readonly label: string;
  /** The as-of date, derived from the data rather than the clock. */
  readonly asOf: Date;
  /** Dense and ordered so that `cells[i].id === i`. */
  readonly cells: readonly Cell[];
  readonly dimensions: { province: string[]; grade: string[]; subject: string[] };

  /** Rows for one date, dense and indexed by cell id. Undefined when the date
      is absent from the source — which must stay distinct from a date whose
      values are genuinely zero. */
  rowsOn(dateKey: string): DailyRow[] | undefined;

  /** Provisioned seats across `cellIds` on `date`. Null outside the seat
      table, so a rescale degrades instead of inventing a denominator. */
  seatsOn(date: Date, cellIds: readonly number[]): number | null;

  /** Distinct teachers reached by at least one of `campaignIds` within
      `cellIds` — a de-duplicated union, not a sum. Null when the source has
      no exposure data. */
  reach(campaignIds: readonly string[], cellIds: readonly number[]): number | null;

  readonly campaigns: readonly PublicCampaign[];
  readonly releases: readonly Release[];
  readonly coverage: Coverage;
}
