/* ===========================================================================
   /data/file — CSV → DataSource
   Parsing, validation, and construction of a real-data source.

   Async strictly at the boundary: `loadFileSource` is a promise, but the
   DataSource it resolves to is entirely synchronous. Nothing in /analytics
   and no component becomes async, so the swap is invisible to every layer
   above /data.
=========================================================================== */
import Papa from "papaparse";
import type {
  Cell,
  Coverage,
  DailyRow,
  DataSource,
  Metric,
  PublicCampaign,
  Release,
  SummableMetric,
  TargetSpec,
} from "../schema";
import { YOY_LAG, BASELINE_SMOOTH } from "../../analytics/constants";
import { daysBetween, fromIso } from "../../lib/dates";
import { DAILY_FACTS, CAMPAIGNS_TABLE, CAMPAIGN_REACH, RELEASES_TABLE } from "./schema";

const METRICS: Metric[] = [
  "wau",
  "resourceOpens",
  "assignmentsCreated",
  "classesCreated",
  "ahaUsers",
];

/* --- Validation report ----------------------------------------------------- */

export type Severity = "error" | "warning" | "info";

export interface Finding {
  severity: Severity;
  file: string;
  message: string;
  /** What the reader should do about it. */
  action?: string;
}

export interface ValidationReport {
  findings: Finding[];
  /** False when at least one error means no source can be built. */
  usable: boolean;
  /** Populated when usable. */
  source?: DataSource;
  summary: {
    rows: number;
    dateFrom: string | null;
    dateTo: string | null;
    historyDays: number;
    missingDates: number;
    cells: number;
    campaigns: number;
    metricsPresent: SummableMetric[];
    metricsMissing: SummableMetric[];
    hasReach: boolean;
    /** True when there is enough history for a seasonal baseline. */
    canAdjust: boolean;
  };
}

/** History needed before a single adjusted figure can be computed: the
    year-over-year lag, the baseline smoothing half-window, and a comparison
    window on top. */
export const HISTORY_NEEDED = YOY_LAG + BASELINE_SMOOTH + 7;

/* --- Parsing helpers ------------------------------------------------------- */

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const out = Papa.parse<Row>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  return out.data.filter(Boolean);
}

const numOf = (v: string | undefined): number => {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const listOf = (v: string | undefined): string[] | undefined => {
  if (!v || !v.trim()) return undefined;
  return v
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
};

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/* --- The loader ------------------------------------------------------------ */

export interface InputFiles {
  dailyFacts?: string;
  campaigns?: string;
  reach?: string;
  releases?: string;
  label?: string;
}

export function buildFileSource(files: InputFiles): ValidationReport {
  const findings: Finding[] = [];
  const err = (file: string, message: string, action?: string) =>
    findings.push({ severity: "error", file, message, action });
  const warn = (file: string, message: string, action?: string) =>
    findings.push({ severity: "warning", file, message, action });
  const info = (file: string, message: string) =>
    findings.push({ severity: "info", file, message });

  const empty: ValidationReport["summary"] = {
    rows: 0,
    dateFrom: null,
    dateTo: null,
    historyDays: 0,
    missingDates: 0,
    cells: 0,
    campaigns: 0,
    metricsPresent: [],
    metricsMissing: [],
    hasReach: false,
    canAdjust: false,
  };

  if (!files.dailyFacts) {
    err(DAILY_FACTS.file, "Required file is missing.", "Export it and try again — nothing renders without it.");
    return { findings, usable: false, summary: empty };
  }
  if (!files.campaigns) {
    err(CAMPAIGNS_TABLE.file, "Required file is missing.", "Export it and try again.");
    return { findings, usable: false, summary: empty };
  }

  /* --- daily facts --------------------------------------------------------- */
  const factRows = parseCsv(files.dailyFacts);
  if (!factRows.length) {
    err(DAILY_FACTS.file, "Parsed zero rows.", "Check the file is comma-separated with a header row.");
    return { findings, usable: false, summary: empty };
  }

  const headers = Object.keys(factRows[0]);
  for (const c of DAILY_FACTS.columns) {
    if (c.required && !headers.includes(c.name)) {
      err(DAILY_FACTS.file, `Required column "${c.name}" is missing.`, c.why);
    }
  }
  if (findings.some((f) => f.severity === "error")) {
    return { findings, usable: false, summary: empty };
  }

  // Which optional metric columns are actually present.
  const metricsPresent: SummableMetric[] = [];
  const metricsMissing: SummableMetric[] = [];
  for (const c of DAILY_FACTS.columns) {
    if (!c.metric) continue;
    if (headers.includes(c.name)) metricsPresent.push(c.metric);
    else {
      metricsMissing.push(c.metric);
      warn(
        DAILY_FACTS.file,
        `Column "${c.name}" is absent, so ${c.metric} is unavailable.`,
        c.why
      );
    }
  }

  // Build the cell dimension from the values actually present, so the app
  // adapts to Edwin's real vocabulary rather than imposing the synthetic one.
  const provinces = new Set<string>();
  const grades = new Set<string>();
  const subjects = new Set<string>();
  let badDates = 0;
  for (const r of factRows) {
    if (!ISO_RE.test(r.date ?? "")) {
      badDates++;
      continue;
    }
    provinces.add(r.province);
    grades.add(r.grade);
    subjects.add(r.subject);
  }
  if (badDates) {
    err(
      DAILY_FACTS.file,
      `${badDates.toLocaleString()} row(s) have a date that is not YYYY-MM-DD.`,
      "Reformat the date column. Excel often writes DD/MM/YYYY."
    );
    return { findings, usable: false, summary: empty };
  }

  const province = [...provinces].sort();
  const grade = [...grades].sort();
  const subject = [...subjects].sort();

  const cells: Cell[] = [];
  const cellKey = new Map<string, number>();
  for (const p of province)
    for (const g of grade)
      for (const s of subject) {
        const id = cells.length;
        cellKey.set(`${p}|${g}|${s}`, id);
        // weight and engagement are generator concepts; real cells carry
        // measured seats instead, so these stay neutral.
        cells.push({ id, province: p, grade: g, subject: s, weight: 0, engagement: 1 });
      }

  // Materialize dense, cell-id-ordered arrays per date. Dates absent from the
  // file must stay absent from the map: sumOn returns null for them and the
  // day is skipped, which is very different from counting it as a zero.
  const byDate = new Map<string, DailyRow[]>();
  const blank = (date: string, cellId: number): DailyRow => ({
    date,
    cellId,
    provisioned: 0,
    dailyActive: 0,
    wau: 0,
    resourceOpens: 0,
    classesCreated: 0,
    assignmentsCreated: 0,
    ahaUsers: 0,
    retentionW4: 0,
  });

  let unknownCells = 0;
  for (const r of factRows) {
    const id = cellKey.get(`${r.province}|${r.grade}|${r.subject}`);
    if (id == null) {
      unknownCells++;
      continue;
    }
    let list = byDate.get(r.date);
    if (!list) {
      list = cells.map((c) => blank(r.date, c.id));
      byDate.set(r.date, list);
    }
    list[id] = {
      date: r.date,
      cellId: id,
      provisioned: numOf(r.provisioned),
      dailyActive: numOf(r.daily_active),
      wau: numOf(r.wau),
      resourceOpens: numOf(r.resource_opens),
      classesCreated: numOf(r.classes_created),
      assignmentsCreated: numOf(r.assignments_created),
      ahaUsers: numOf(r.aha_users),
      retentionW4: numOf(r.retention_w4),
    };
  }
  if (unknownCells) {
    warn(DAILY_FACTS.file, `${unknownCells} row(s) had an unrecognised segment and were skipped.`);
  }

  const dates = [...byDate.keys()].sort();
  const dateFrom = dates[0];
  const dateTo = dates[dates.length - 1];
  const span = daysBetween(fromIso(dateFrom), fromIso(dateTo)) + 1;
  const missingDates = span - dates.length;
  if (missingDates > 0) {
    warn(
      DAILY_FACTS.file,
      `${missingDates} date(s) in the range have no rows at all.`,
      "Those days are skipped rather than counted as zero, which is correct — but large gaps make windows unreliable."
    );
  }

  const historyDays = span;
  const canAdjust = historyDays >= HISTORY_NEEDED;
  if (!canAdjust) {
    warn(
      DAILY_FACTS.file,
      `Only ${historyDays} days of history. Seasonal adjustment needs ${HISTORY_NEEDED}.`,
      "The dashboard will load, but every seasonally-adjusted figure will report no baseline and the trend will show raw levels only. This is the single most important thing to fix — the seasonal baseline is the dashboard's core claim."
    );
  }

  const retentionRows = factRows.filter((r) => r.retention_w4 != null && r.retention_w4 !== "");
  const suspectRetention = retentionRows.filter((r) => numOf(r.retention_w4) > 1).length;
  if (suspectRetention) {
    warn(
      DAILY_FACTS.file,
      `${suspectRetention} retention_w4 value(s) exceed 1.`,
      "This column is a rate between 0 and 1, not a percentage or a count."
    );
  }

  /* --- campaigns ----------------------------------------------------------- */
  const campRows = parseCsv(files.campaigns);
  const campaigns: PublicCampaign[] = [];
  for (const r of campRows) {
    if (!ISO_RE.test(r.launch_date ?? "")) {
      err(CAMPAIGNS_TABLE.file, `Campaign "${r.campaign_id || r.name}" has an invalid launch_date.`);
      continue;
    }
    const objective = r.objective_metric as Metric;
    if (!METRICS.includes(objective)) {
      err(
        CAMPAIGNS_TABLE.file,
        `Campaign "${r.campaign_id || r.name}" has objective_metric "${r.objective_metric}".`,
        `Must be one of: ${METRICS.join(", ")}. This is the metric the campaign was authored to move.`
      );
      continue;
    }
    const spec: TargetSpec = {
      province: listOf(r.target_province),
      grade: listOf(r.target_grade),
      subject: listOf(r.target_subject),
    };
    const has = (list: string[] | undefined, v: string) => !list || !list.length || list.includes(v);
    const sends = numOf(r.sends);
    const opens = r.opens == null || r.opens === "" ? 0 : numOf(r.opens);
    campaigns.push({
      id: r.campaign_id,
      name: r.name,
      type: r.type,
      channel: r.channel,
      launch: r.launch_date,
      audience: r.audience,
      sends,
      opens,
      clicks: numOf(r.clicks),
      // An absent opens column means the channel has no open concept; an
      // openRate of 1 is how the app already signals "suppress CTOR".
      openRate: opens ? opens / Math.max(1, sends) : 1,
      clickRate: numOf(r.clicks) / Math.max(1, sends),
      objectiveMetric: objective,
      targetSpec: spec,
      target: (c) => has(spec.province, c.province) && has(spec.grade, c.grade) && has(spec.subject, c.subject),
    });
  }
  if (findings.some((f) => f.severity === "error")) {
    return { findings, usable: false, summary: empty };
  }
  if (!campaigns.length) {
    err(CAMPAIGNS_TABLE.file, "No valid campaigns parsed.");
    return { findings, usable: false, summary: empty };
  }

  // Targeting values that match no segment would silently target nobody.
  for (const c of campaigns) {
    const miss = [
      ...(c.targetSpec.province ?? []).filter((v) => !provinces.has(v)),
      ...(c.targetSpec.grade ?? []).filter((v) => !grades.has(v)),
      ...(c.targetSpec.subject ?? []).filter((v) => !subjects.has(v)),
    ];
    if (miss.length) {
      warn(
        CAMPAIGNS_TABLE.file,
        `Campaign "${c.name}" targets values not present in the facts: ${miss.join(", ")}.`,
        "Spelling must match daily_facts.csv exactly, or the campaign will appear to target nobody."
      );
    }
  }

  /* --- reach --------------------------------------------------------------- */
  const reachByCampaign = new Map<string, Map<number, number>>();
  let hasReach = false;
  if (files.reach) {
    for (const r of parseCsv(files.reach)) {
      const id = cellKey.get(`${r.province}|${r.grade}|${r.subject}`);
      if (id == null) continue;
      let m = reachByCampaign.get(r.campaign_id);
      if (!m) {
        m = new Map();
        reachByCampaign.set(r.campaign_id, m);
      }
      m.set(id, numOf(r.reached_teachers));
    }
    hasReach = reachByCampaign.size > 0;
    if (!hasReach) warn(CAMPAIGN_REACH.file, "Parsed, but matched no known campaign or segment.");
  } else {
    warn(
      CAMPAIGN_REACH.file,
      "Not supplied, so no campaign has a known audience size.",
      "Every campaign view will report insufficient sample. This table is what the email-to-user_id join produces — it is the highest-value thing to ask the data team for."
    );
  }

  /* --- releases ------------------------------------------------------------ */
  const releases: Release[] = [];
  if (files.releases) {
    for (const r of parseCsv(files.releases)) {
      if (ISO_RE.test(r.date ?? "")) releases.push({ date: r.date, name: r.name });
    }
  } else {
    info(RELEASES_TABLE.file, "Not supplied — release markers will be absent. Nothing else is affected.");
  }

  /* --- seats --------------------------------------------------------------- */
  // Real per-cell seats, straight from the provisioned column.
  const seatsByDate = new Map<string, number[]>();
  for (const [k, list] of byDate) seatsByDate.set(k, list.map((r) => r.provisioned));
  const sortedDates = dates;
  const nearestSeats = (key: string): number[] | undefined => {
    const exact = seatsByDate.get(key);
    if (exact) return exact;
    // Fall back to the last date on or before the requested one, so a seat
    // table with gaps still answers rather than returning null everywhere.
    let lo = 0;
    let hi = sortedDates.length - 1;
    let best: string | undefined;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (sortedDates[mid] <= key) {
        best = sortedDates[mid];
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return best ? seatsByDate.get(best) : undefined;
  };

  const coverage: Coverage = {
    metrics: {
      provisioned: metricsPresent.includes("provisioned"),
      dailyActive: metricsPresent.includes("dailyActive"),
      wau: metricsPresent.includes("wau"),
      resourceOpens: metricsPresent.includes("resourceOpens"),
      classesCreated: metricsPresent.includes("classesCreated"),
      assignmentsCreated: metricsPresent.includes("assignmentsCreated"),
      ahaUsers: metricsPresent.includes("ahaUsers"),
      retentionW4: metricsPresent.includes("retentionW4"),
    },
    reach: hasReach,
    perCellSeats: true, // measured, not weight-allocated
    historyDays,
  };

  const source: DataSource = {
    id: `file:${new Date().toISOString()}`,
    label: files.label ?? "Imported CSV",
    asOf: fromIso(dateTo),
    cells,
    dimensions: { province, grade, subject },
    rowsOn: (k) => byDate.get(k),
    seatsOn: (date, ids) => {
      const key = date.toISOString().slice(0, 10);
      const seats = nearestSeats(key);
      if (!seats) return null;
      let s = 0;
      for (const id of ids) s += seats[id] ?? 0;
      return s;
    },
    reach: (campaignIds, cellIds) => {
      if (!hasReach) return null;
      // Per-campaign counts cannot be de-duplicated into a true union, so the
      // most defensible answer for a set is the largest single campaign rather
      // than a sum that would double-count shared teachers.
      let best = 0;
      for (const cid of campaignIds) {
        const m = reachByCampaign.get(cid);
        if (!m) continue;
        let n = 0;
        for (const id of cellIds) n += m.get(id) ?? 0;
        best = Math.max(best, n);
      }
      return best;
    },
    campaigns,
    releases,
    coverage,
  };

  if (hasReach && campaigns.length > 1) {
    info(
      CAMPAIGN_REACH.file,
      "Reach across several campaigns is reported as the largest single campaign, not a sum — per-campaign counts cannot be de-duplicated. Ask the data team for a pre-computed distinct union if the roll-up matters."
    );
  }

  return {
    findings,
    usable: true,
    source,
    summary: {
      rows: factRows.length,
      dateFrom,
      dateTo,
      historyDays,
      missingDates: Math.max(0, missingDates),
      cells: cells.length,
      campaigns: campaigns.length,
      metricsPresent,
      metricsMissing,
      hasReach,
      canAdjust,
    },
  };
}
