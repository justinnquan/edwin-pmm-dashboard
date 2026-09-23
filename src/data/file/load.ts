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

export type Row = Record<string, string>;

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
  /** Rows already parsed from a non-CSV source (a markdown table, a workbook).
      Supplying these skips CSV parsing; the column names must still match the
      contract in ./schema.ts, so every validation below applies unchanged. */
  parsed?: {
    facts?: Row[];
    campaigns?: Row[];
    reach?: Row[];
    releases?: Row[];
  };
}

/** Weekly rows are step-expanded to days. Which rule applies depends on
    whether the figure is a level that already spans the week or a total
    accumulated across it. Getting this backwards is a silent 7x error. */
const WEEKLY_EXPANSION: Record<string, "repeat" | "divide"> = {
  // Stocks, rolling counts and rates: the weekly figure *is* the daily level.
  provisioned: "repeat",
  cumulative_logins: "repeat",
  wau: "repeat",
  // Already a 7-day count (first-time logins that week), like wau.
  new_logins: "repeat",
  aha_users: "repeat",
  retention_w4: "repeat",
  // Flows: a total accumulated over seven days.
  resource_opens: "divide",
  classes_created: "divide",
  assignments_created: "divide",
};

/** Adds a `new_logins` column differenced from `cumulative_logins`, per
    segment and in date order. Weekly rows give a weekly difference directly;
    daily rows are differenced and then summed over a trailing seven days, so
    both grains carry the same rolling-week meaning. A value that goes
    backwards (a correction in the source) counts as zero, never negative. */
function withNewLogins(rows: Row[], weekly: boolean): Row[] {
  const dateCol = weekly ? "week_starting" : "date";
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.province ?? ""}|${r.grade ?? ""}|${r.subject ?? ""}`;
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(r);
  }
  const out = new Map<Row, Row>();
  for (const g of groups.values()) {
    const sorted = [...g].sort((a, b) => (a[dateCol] ?? "").localeCompare(b[dateCol] ?? ""));
    const deltas = sorted.map((r, i) =>
      Math.max(0, numOf(r.cumulative_logins) - (i ? numOf(sorted[i - 1].cumulative_logins) : 0))
    );
    sorted.forEach((r, i) => {
      let v = deltas[i];
      if (!weekly) for (let k = Math.max(0, i - 6); k < i; k++) v += deltas[k];
      out.set(r, { ...r, new_logins: String(v) });
    });
  }
  return rows.map((r) => out.get(r)!);
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
  const rawFacts = files.parsed?.facts ?? parseCsv(files.dailyFacts);
  if (!rawFacts.length) {
    err(DAILY_FACTS.file, "Parsed zero rows.", "Check the file is comma-separated with a header row.");
    return { findings, usable: false, summary: empty };
  }

  const headers = Object.keys(rawFacts[0]);

  // Grain is detected, not declared: a week_starting column means each row
  // covers seven days.
  const weekly = !headers.includes("date") && headers.includes("week_starting");
  const grain: "daily" | "weekly" = weekly ? "weekly" : "daily";
  if (weekly) {
    info(
      DAILY_FACTS.file,
      "Weekly grain detected. Each row is expanded across its seven days, so day-of-week effects cannot be recovered and the uncertainty band is suppressed rather than reported as falsely precise."
    );
  }

  for (const c of DAILY_FACTS.columns) {
    if (!c.required) continue;
    if (c.name === "date" && weekly) continue; // week_starting stands in
    if (!headers.includes(c.name)) {
      err(DAILY_FACTS.file, `Required column "${c.name}" is missing.`, c.why);
    }
  }
  if (findings.some((f) => f.severity === "error")) {
    return { findings, usable: false, summary: empty };
  }

  // Normalise to a daily, fully-segmented row shape so everything downstream
  // sees one form. Absent segment columns collapse to a single platform-wide
  // cell rather than failing.
  const segmented = headers.includes("province") || headers.includes("grade") || headers.includes("subject");
  if (!segmented) {
    warn(
      DAILY_FACTS.file,
      "No province, grade or subject columns, so this source is platform-wide.",
      "Segment comparison, targeting and opportunity ranking all need a breakdown. Everything else works."
    );
  }

  // A cumulative login count is not a denominator, but it is worth keeping as
  // an adoption curve. Carry it in the seat field and let the stock check
  // below decide what may be done with it.
  const seatsFromCumulative = !headers.includes("provisioned") && headers.includes("cumulative_logins");

  // The same running total, differenced, is the figure Leadership actually
  // watches: how many teachers logged in for the first time that week. Spikes
  // after a send show in the difference and vanish into the slope of the
  // total. The counter restarts with the school year, so its first row is
  // itself a first-week count rather than an unknown.
  const loginsDerived = !headers.includes("new_logins") && headers.includes("cumulative_logins");
  const inputFacts = loginsDerived ? withNewLogins(rawFacts, weekly) : rawFacts;

  const factRows: Row[] = [];
  for (const r of inputFacts) {
    const base: Row = {
      ...r,
      province: r.province || "All",
      grade: r.grade || "All",
      subject: r.subject || "All",
    };
    if (seatsFromCumulative) base.provisioned = r.cumulative_logins;
    if (!weekly) {
      factRows.push(base);
      continue;
    }
    const start = base.week_starting;
    if (!ISO_RE.test(start ?? "")) {
      factRows.push({ ...base, date: start });
      continue;
    }
    const t0 = fromIso(start).getTime();
    for (let d = 0; d < 7; d++) {
      const day: Row = { ...base, date: new Date(t0 + d * 86400000).toISOString().slice(0, 10) };
      for (const [col, rule] of Object.entries(WEEKLY_EXPANSION)) {
        if (rule === "divide" && day[col] != null && day[col] !== "") {
          day[col] = String(numOf(day[col]) / 7);
        }
      }
      factRows.push(day);
    }
  }

  // Which optional metric columns are actually present.
  const metricsPresent: SummableMetric[] = [];
  const metricsMissing: SummableMetric[] = [];
  for (const c of DAILY_FACTS.columns) {
    if (!c.metric) continue;
    const present =
      headers.includes(c.name) ||
      (c.name === "provisioned" && seatsFromCumulative) ||
      (c.name === "new_logins" && loginsDerived);
    if (present) metricsPresent.push(c.metric);
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
  if (badDates && weekly) {
    err(
      DAILY_FACTS.file,
      `${badDates.toLocaleString()} row(s) have a week_starting that is not YYYY-MM-DD.`,
      "Dates must be ISO. A markdown table written as 'August 3, 2025' is converted on import; anything else must be reformatted."
    );
    return { findings, usable: false, summary: empty };
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
    newLogins: 0,
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
      newLogins: numOf(r.new_logins),
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
      `Only ${historyDays} days of history, so there is no prior year to compare against. Seasonal adjustment needs ${HISTORY_NEEDED}.`,
      "Every adjusted figure is suppressed and the dashboard shows raw before/after only. In a K-12 product a raw comparison says more about the month than about the campaign — a November send flatters itself and a June send condemns itself. Supplying the previous school year is the single thing that makes these numbers arguable."
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
  const campRows = files.parsed?.campaigns ?? parseCsv(files.campaigns);
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
    const spec: TargetSpec = segmented
      ? {
          province: listOf(r.target_province),
          grade: listOf(r.target_grade),
          subject: listOf(r.target_subject),
        }
      : // No segmentation in the usage data, so there is nothing for a target
        // to select. Treating these as platform-wide keeps the campaign
        // measurable; honouring the target would match no cell and suppress
        // it entirely. The declared audience is preserved on the campaign.
        {};
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

  const targeted = campRows.filter(
    (r) => r.target_province || r.target_grade || r.target_subject
  ).length;
  if (!segmented && targeted) {
    info(
      CAMPAIGNS_TABLE.file,
      `${targeted} campaign(s) declare an audience, but the usage data is platform-wide, so every campaign is measured against the whole platform. The targeting is kept and will apply automatically once a segmented export arrives.`
    );
  }

  // Targeting values that match no segment would silently target nobody.
  if (segmented)
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
  let reachIsRecipients = false;

  // A `recipients` column on the campaign itself is a coarser but far more
  // obtainable stand-in for the reach table: Pardot's Total Delivered is one
  // export away, whereas a per-cell teacher count needs the identity join.
  // With a single platform-wide cell the two are equivalent in shape.
  const withRecipients = campRows.filter((r) => r.recipients && numOf(r.recipients) > 0);
  if (!files.reach && withRecipients.length) {
    for (const r of withRecipients) {
      reachByCampaign.set(r.campaign_id, new Map([[0, numOf(r.recipients)]]));
    }
    hasReach = true;
    reachIsRecipients = true;
    info(
      CAMPAIGNS_TABLE.file,
      `Using the recipients column as audience size for ${withRecipients.length} campaign(s). These are people a campaign was delivered to, not teachers confirmed present in the product data — without an identity join the two cannot be reconciled, so treat it as a sample size rather than a measured reach.`
    );
  }

  const reachRows = files.parsed?.reach ?? (files.reach ? parseCsv(files.reach) : null);
  if (reachRows) {
    for (const r of reachRows) {
      const id = cellKey.get(`${r.province || "All"}|${r.grade || "All"}|${r.subject || "All"}`);
      if (id == null) continue;
      let m = reachByCampaign.get(r.campaign_id);
      if (!m) {
        m = new Map();
        reachByCampaign.set(r.campaign_id, m);
      }
      m.set(id, numOf(r.reached_teachers));
    }
    hasReach = reachByCampaign.size > 0;
    reachIsRecipients = false;
    if (!hasReach) warn(CAMPAIGN_REACH.file, "Parsed, but matched no known campaign or segment.");
  } else if (!hasReach) {
    warn(
      CAMPAIGN_REACH.file,
      "Not supplied, and no recipients column on the campaigns, so no campaign has a known audience size.",
      "Every campaign view will report insufficient sample. A recipients count per campaign — Pardot's Total Delivered — is enough to unlock them; a per-cell teacher count needs the email-to-user_id join."
    );
  }

  /* --- releases ------------------------------------------------------------ */
  const releases: Release[] = [];
  if (files.releases) {
    for (const r of files.parsed?.releases ?? parseCsv(files.releases)) {
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

  // A stock rises and falls; a cumulative counter only ever rises. Deciding
  // this from the data rather than trusting the column name is what stops a
  // running total being silently used as a denominator.
  const seatSeries = sortedDates.map((k) => (seatsByDate.get(k) ?? []).reduce((a, b) => a + b, 0));
  const everFell = seatSeries.some((v, i) => i > 0 && v < seatSeries[i - 1] - 0.5);
  const grew = seatSeries.length > 1 && seatSeries[seatSeries.length - 1] > seatSeries[0] * 1.5;
  const hasSeats = metricsPresent.includes("provisioned");
  const seatsAreStock = hasSeats && (everFell || !grew);

  if (hasSeats && !seatsAreStock) {
    warn(
      DAILY_FACTS.file,
      "The provisioned column never decreases and grows steeply, so it looks like a running total rather than a licence count.",
      "It is being charted as an adoption curve, not divided by. A denominator that never sheds anyone makes every rate built on it fall week after week regardless of behaviour, and would distort the year-over-year comparison. Supply licensed seats to restore the active-teacher rate."
    );
  } else if (!hasSeats) {
    warn(
      DAILY_FACTS.file,
      "No provisioned column, so the active-teacher rate cannot be computed.",
      "Weekly active teachers still render as a count. Licensed seats per period are what turn that into the north-star rate and the 50% MAU OKR measure."
    );
  }

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
      newLogins: metricsPresent.includes("newLogins"),
    },
    reach: hasReach,
    reachIsRecipients,
    // True only where seats are measured per cell. A platform-wide export has
    // one cell, so there is nothing to allocate and nothing to caveat.
    perCellSeats: hasSeats,
    historyDays,
    seatsAreStock,
    canAdjust,
    grain,
    seatsLabel: seatsAreStock ? "provisioned seats" : "teachers ever logged in",
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
