/* ===========================================================================
   /data — DAILY FACT TABLE + USER PANEL
   Generates the (date × cell) fact table and a lightweight user panel used
   only for exposure de-duplication. GROUND TRUTH — reached only through
   createSyntheticSource() in ./synthetic.ts, never imported above /data.
=========================================================================== */
import type { DailyRow } from "./schema";
import { CELLS } from "./segments";
import { CAMPAIGNS, campaignMultiplier } from "./campaigns";
import { compileTarget } from "./target";
import { START, TODAY, mulberry32, seasonalRate, provisioned, DOW } from "./calendar";
import { addDays, daysBetween, iso } from "../lib/dates";

export interface GeneratedData {
  rows: DailyRow[];
  byDate: Map<string, DailyRow[]>;
}

/* --- Generate the daily fact table (date × cell) --------------------------- */
export function generate(): GeneratedData {
  const rows: DailyRow[] = [];
  const byDate = new Map<string, DailyRow[]>();
  const rng = mulberry32(20260826);
  const total = daysBetween(START, TODAY);

  for (let i = 0; i <= total; i++) {
    const date = addDays(START, i);
    const key = iso(date);
    const prov = provisioned(date);
    const season = seasonalRate(date);
    const dow = DOW[date.getUTCDay()];
    const list: DailyRow[] = [];

    for (const cell of CELLS) {
      const seats = prov * cell.weight;
      const noise = 1 + (rng() - 0.5) * 0.05;

      const dailyActive = seats * season * dow * cell.engagement * noise;
      const wau =
        seats *
        Math.min(0.62, season * 1.42) *
        cell.engagement *
        (1 + (rng() - 0.5) * 0.03) *
        campaignMultiplier(cell, date, "wau");

      const opensPer = 3.1 + season * 2.4;
      const resourceOpens = dailyActive * opensPer * campaignMultiplier(cell, date, "resourceOpens");
      const classesCreated =
        dailyActive *
        (0.006 + (season > 0.2 ? 0.02 : 0.002)) *
        campaignMultiplier(cell, date, "classesCreated");
      const assignmentsCreated =
        dailyActive * 0.34 * campaignMultiplier(cell, date, "assignmentsCreated");
      const ahaUsers =
        wau * (0.24 + season * 0.55) * campaignMultiplier(cell, date, "assignmentsCreated");

      const row: DailyRow = {
        date: key,
        cellId: cell.id,
        provisioned: seats,
        dailyActive,
        wau,
        resourceOpens,
        classesCreated,
        assignmentsCreated,
        ahaUsers: Math.min(ahaUsers, wau * 0.92),
        retentionW4: Math.max(0.18, Math.min(0.74, 0.3 + season * 1.15)),
      };
      rows.push(row);
      list.push(row);
    }
    byDate.set(key, list);
  }
  return { rows, byDate };
}

export interface Panel {
  n: number;
  cellOf: Int8Array;
  exposure: Record<string, Uint8Array>;
}

/* --- Lightweight user panel (exposure de-duplication only) ----------------- */
export function buildPanel(): Panel {
  const n = 28400;
  const cellOf = new Int8Array(n);
  const rng = mulberry32(77);
  const cum: number[] = [];
  let acc = 0;
  CELLS.forEach((c) => {
    acc += c.weight;
    cum.push(acc);
  });
  for (let i = 0; i < n; i++) {
    const r = rng() * acc;
    cellOf[i] = cum.findIndex((v) => r <= v);
  }
  const exposure: Record<string, Uint8Array> = {};
  for (const c of CAMPAIGNS) {
    const bits = new Uint8Array(n);
    const eligible: number[] = [];
    const target = compileTarget(c.targetSpec);
    for (let i = 0; i < n; i++) if (target(CELLS[cellOf[i]])) eligible.push(i);
    const coverage = Math.min(1, c.sends / Math.max(1, eligible.length));
    for (const i of eligible) if (rng() < coverage) bits[i] = 1;
    exposure[c.id] = bits;
  }
  return { n, cellOf, exposure };
}

/* DATA and PANEL used to be exported here as module-level constants, computed
   eagerly at import time, and imported directly by the analytics layer. That
   made the "swap point" unswappable: there was no interface to replace, only
   two constants to delete. They are now built inside createSyntheticSource()
   in ./synthetic.ts and reached through src() in ./source.ts. */
