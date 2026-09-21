/* ===========================================================================
   /state — DATA SOURCE STATE
   Holds the fact that the data source changed, never the data itself.

   Keeping rows out of the store matters: the moment a component can select a
   metric off a store, "the UI never computes a metric" stops being true. The
   store carries a version counter instead, which page-level useMemo hooks list
   as a dependency so a swap invalidates their cached results.
=========================================================================== */
import { create } from "zustand";
import type { DataSource } from "../data/schema";
import { src, setSource, resetSource } from "../data/source";

export type DataStatus = "ready" | "loading" | "error";

interface DataState {
  status: DataStatus;
  sourceId: string;
  label: string;
  error: string | null;
  /** Bumped on every swap. Add it to a useMemo dependency array to recompute. */
  version: number;
  swap: (next: DataSource) => void;
  reset: () => void;
  beginLoad: () => void;
  fail: (message: string) => void;
}

export const useDataSource = create<DataState>((set) => ({
  status: "ready",
  sourceId: src().id,
  label: src().label,
  error: null,
  version: 0,
  swap: (next) => {
    setSource(next);
    set((s) => ({
      status: "ready",
      sourceId: next.id,
      label: next.label,
      error: null,
      version: s.version + 1,
    }));
  },
  reset: () => {
    resetSource();
    set((s) => ({
      status: "ready",
      sourceId: src().id,
      label: src().label,
      error: null,
      version: s.version + 1,
    }));
  },
  beginLoad: () => set({ status: "loading", error: null }),
  fail: (message) => set({ status: "error", error: message }),
}));
