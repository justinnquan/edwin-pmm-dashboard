/* ===========================================================================
   /state — DATA SOURCE STATE
   Holds the fact that the data source changed, never the data itself.

   Keeping rows out of the store matters: the moment a component can select a
   metric off a store, "the UI never computes a metric" stops being true. The
   store carries a version counter instead, which page-level useMemo hooks list
   as a dependency so a swap invalidates their cached results.

   Three modes, chosen with the Sample / Live toggle:
     sample   the seeded synthetic generator
     live     the published real Edwin exports, fetched behind a password
     preview  an unpublished import from /data, kept in this tab only
=========================================================================== */
import { create } from "zustand";
import type { DataSource } from "../data/schema";
import { src, setSource, resetSource } from "../data/source";
import { fetchLive } from "../data/live";
import { clearImport } from "../data/file/persist";
import { useFilters } from "./filterStore";

export type DataStatus = "ready" | "loading" | "error";
export type DataMode = "sample" | "live" | "preview";
export type LiveStatus = "idle" | "locked" | "loading" | "ready" | "empty" | "unavailable" | "error";

interface LiveState {
  status: LiveStatus;
  message?: string;
  publishedAt?: string;
}

interface DataState {
  status: DataStatus;
  sourceId: string;
  label: string;
  error: string | null;
  /** Bumped on every swap. Add it to a useMemo dependency array to recompute. */
  version: number;
  mode: DataMode;
  live: LiveState;
  swap: (next: DataSource) => void;
  reset: () => void;
  beginLoad: () => void;
  fail: (message: string) => void;
  /** Switch to the synthetic generator, discarding any preview. */
  toSample: () => void;
  /** Switch to Live. A password, when given, is remembered for next time. */
  toLive: (password?: string) => Promise<void>;
  /** Show an unpublished import in this tab only. */
  preview: (next: DataSource) => void;
}

/* Per-browser conveniences only. Storage can be absent or throw (private
   windows, blocked site data), and the app must start regardless. */
const MODE_KEY = "edwin-pmm.mode.v1";
const PW_KEY = "edwin-pmm.live-password.v1";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* a browser that refuses to store simply forgets */
  }
}

/** The mode this browser last chose. Preview never persists here — it lives
    in session storage and is restored separately. */
export const storedMode = (): "sample" | "live" => (read(MODE_KEY) === "live" ? "live" : "sample");

/** The Live password this browser last unlocked with, if any. */
export const storedLivePassword = (): string | null => read(PW_KEY);

/** Remember a Live password that has just been accepted. */
export const rememberLivePassword = (pw: string): void => write(PW_KEY, pw);

/** Guards against a slow Live fetch landing after the reader has moved on. */
let request = 0;

export const useDataSource = create<DataState>((set, getState) => ({
  status: "ready",
  sourceId: src().id,
  label: src().label,
  error: null,
  version: 0,
  mode: "sample",
  live: { status: "idle" },
  swap: (next) => {
    setSource(next);
    // A new source spans different dates; keep the selected year and range
    // inside what it can show.
    useFilters.getState().refit();
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
    useFilters.getState().refit();
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

  toSample: () => {
    request++;
    clearImport();
    write(MODE_KEY, "sample");
    getState().reset();
    set({ mode: "sample" });
  },

  toLive: async (password) => {
    const id = ++request;
    clearImport();
    write(MODE_KEY, "live");
    const pw = password ?? read(PW_KEY);
    // Put the synthetic source back underneath, so nothing from a preview
    // survives into Live. The gate in Layout keeps it from ever being shown.
    if (getState().mode !== "live" || getState().live.status !== "ready") getState().reset();
    if (!pw) {
      set({ mode: "live", live: { status: "locked" } });
      return;
    }
    set({ mode: "live", live: { status: "loading" } });
    const result = await fetchLive(pw);
    if (id !== request) return;
    if (result.kind === "ready") {
      write(PW_KEY, pw);
      getState().swap(result.source);
      set({ live: { status: "ready", publishedAt: result.publishedAt } });
      return;
    }
    // A wrong password must not be remembered, or every visit would fail.
    if (result.kind === "locked") write(PW_KEY, null);
    else write(PW_KEY, pw);
    getState().reset();
    set({ live: { status: result.kind, message: result.message } });
  },

  preview: (next) => {
    request++;
    getState().swap(next);
    set({ mode: "preview" });
  },
}));
