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

export interface CampaignDef {
  id: string;
  name: string;
  type: string;
  channel: string;
  launch: string;
  audience: string;
  target: (c: Cell) => boolean;
  sends: number;
  openRate: number;
  clickRate: number;
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
  | { state: "no-baseline"; n: number }
  | {
      state: "ok";
      n: number;
      adjusted: number;
      raw: number;
      expected: number;
      material: boolean;
      pre: number;
      post: number;
      bPre: number;
      bPost: number;
    };
