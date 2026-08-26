/* ===========================================================================
   /state — GLOBAL FILTER / VIEW STORE
   Holds the filters, view mode, and selected campaign so later phases share
   the same global state. Phase C reads and updates this store instead of
   local component state.
=========================================================================== */
import { create } from "zustand";
import type { SummableMetric } from "../data/schema";

export type View = "Leadership" | "Product Marketing";

export interface FilterState {
  view: View;
  range: number; // trend lookback in days
  win: number; // attribution window (7 / 14 / 30)
  metric: SummableMetric; // trend metric
  province: string;
  grade: string;
  subject: string;
  picked: string | null; // selected campaign id
  update: (patch: Partial<FilterState>) => void;
}

export const useFilters = create<FilterState>((set) => ({
  view: "Leadership",
  range: 90,
  win: 7,
  metric: "wau",
  province: "All",
  grade: "All",
  subject: "All",
  picked: null,
  update: (patch) => set(patch),
}));
