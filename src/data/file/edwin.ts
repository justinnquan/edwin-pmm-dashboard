/* ===========================================================================
   /data/file — EDWIN EXPORT ADAPTERS
   Maps the two real exports Product Marketing already keeps onto the column
   contract in ./schema.ts, so they load without being re-keyed by hand.

   1. The weekly usage rollup, kept as a markdown table in an Obsidian vault:
      "Week Starting | Weekly Engaged Teachers | Total Logged-in Teachers".
   2. The Pardot / YesWare / in-app campaign workbook, whose sheets are
      *vertically stacked*: one header row per campaign (Channel, Date Sent,
      Name, Target Audience) followed by a run of metric-name / value rows.

   Nothing here interprets numbers. It renames and reshapes only; every gate,
   warning and coverage decision stays in ./load.ts so that CSV and these two
   formats cannot drift apart in behaviour.
=========================================================================== */
import type { Row } from "./load";
import { parseMarkdownTables, tableWith, cleanNumeric } from "./markdown";
import { readWorkbook, excelDate, type Sheet } from "./xlsx";

/* --- Usage: markdown weekly rollup ---------------------------------------- */

/** "August 3, 2025" and friends -> "2025-08-03". Returns null if unparseable,
    so the loader reports a bad date rather than inventing one. */
export function parseLooseDate(v: string): string | null {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s + " UTC");
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

const HEADER_ALIASES: Record<string, string> = {
  week_starting: "week_starting",
  week_start: "week_starting",
  week: "week_starting",
  date: "date",
  weekly_engaged_teachers: "wau",
  engaged_teachers: "wau",
  weekly_active_teachers: "wau",
  wau: "wau",
  total_logged_in_teachers: "cumulative_logins",
  cumulative_logins: "cumulative_logins",
  provisioned: "provisioned",
  provisioned_teachers: "provisioned",
  licensed_teachers: "provisioned",
  daily_active: "daily_active",
  resource_opens: "resource_opens",
  classes_created: "classes_created",
  assignments_created: "assignments_created",
  aha_users: "aha_users",
  retention_w4: "retention_w4",
  province: "province",
  grade: "grade",
  subject: "subject",
};

export interface UsageParse {
  rows: Row[];
  /** Header names we could not map, so the UI can say what was ignored. */
  ignored: string[];
}

export function usageFromMarkdown(text: string): UsageParse | null {
  const tables = parseMarkdownTables(text);
  // The real file holds a weekly table and a monthly one; only the weekly
  // table carries a week-start column, which is how we tell them apart.
  const t =
    tableWith(tables, ["week_starting"]) ??
    tableWith(tables, ["date"]) ??
    tables.find((x) => x.headers.some((h) => HEADER_ALIASES[h] === "week_starting")) ??
    null;
  if (!t) return null;

  const ignored: string[] = [];
  const map = new Map<string, string>();
  for (const h of t.headers) {
    const target = HEADER_ALIASES[h];
    if (target) map.set(h, target);
    else ignored.push(h);
  }
  if (![...map.values()].includes("wau")) return null;

  const rows: Row[] = [];
  for (const raw of t.rows) {
    const out: Row = {};
    for (const [from, to] of map) {
      const v = raw[from] ?? "";
      if (to === "week_starting" || to === "date") {
        out[to] = parseLooseDate(v) ?? v;
      } else {
        out[to] = cleanNumeric(v);
      }
    }
    if (out.week_starting || out.date) rows.push(out);
  }
  return { rows, ignored };
}

/* --- Campaigns: the stacked workbook -------------------------------------- */

/** A stable, readable id from a campaign name. */
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "campaign";

/** Names encode their audience — "ON - March Primary Newsletter". Worth
    capturing even though the usage side carries no segmentation: the moment a
    segmented export arrives, targeting works with no re-entry. */
function targetsFromName(name: string): { province?: string; grade?: string } {
  const out: { province?: string; grade?: string } = {};
  const p = /^\s*(ON|AB|MB|CA)\b/i.exec(name);
  if (p && p[1].toUpperCase() !== "CA") out.province = p[1].toUpperCase();
  if (/\bprimary\b/i.test(name)) out.grade = "Primary";
  else if (/\bjunior\b/i.test(name)) out.grade = "Junior";
  else if (/\bintermediate\b/i.test(name)) out.grade = "Intermediate";
  else if (/\bsecondary\b/i.test(name)) out.grade = "Secondary";
  return out;
}

const CHANNELS = new Set(["Pardot", "YesWare", "Notification", "Email", "In-app notification"]);

export interface CampaignParse {
  campaigns: Row[];
  /** Sheet names that held no campaigns, for the validation report. */
  skipped: string[];
}

const isNum = (v: string | undefined): boolean => v !== undefined && /^-?[\d.]+$/.test(v.trim());

/** A count of people: a non-negative whole number, and no larger than the
    population it is drawn from. Anything fractional is a rate that has landed
    in the wrong field. */
function isCount(v: string | undefined, ceiling?: string): v is string {
  if (v === undefined) return false;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return false;
  if (ceiling !== undefined) {
    const max = Number(ceiling);
    if (Number.isFinite(max) && max > 0 && n > max) return false;
  }
  return true;
}

/** The metric label/value pair is always the last two populated cells in a
    row. Scanning left-to-right instead finds the channel or the campaign name
    first, because on a campaign's opening row the label sits to the *right* of
    the name — which is why this reads from the end. */
function trailingPair(cells: (string | undefined)[]): { label: string; value: string; at: number } | null {
  let vi = -1;
  for (let i = cells.length - 1; i >= 0; i--) {
    if (isNum(cells[i])) {
      vi = i;
      break;
    }
  }
  if (vi < 0) return null;
  for (let i = vi - 1; i >= 0; i--) {
    const c = cells[i];
    if (c === undefined || isNum(c)) continue;
    if (!/[A-Za-z]/.test(c)) continue;
    return { label: c.trim(), value: cells[vi]!.trim(), at: i };
  }
  return null;
}

/** Walk a vertically-stacked sheet: a row naming a channel starts a campaign,
    and the metric-name/value rows beneath it belong to that campaign until the
    next one begins. */
function campaignsFromSheet(sheet: Sheet): Row[] {
  const out: Row[] = [];
  let cur: { row: Row; m: Record<string, string> } | null = null;

  for (const cells of sheet.rows) {
    if (!cells) continue;
    const pair = trailingPair(cells);

    // Locate the channel cell rather than assuming a fixed column, since the
    // sheets differ in how far they are indented.
    const chIdx = cells.findIndex((c) => c && CHANNELS.has(c.trim()));
    if (chIdx >= 0) {
      const channel = (cells[chIdx] ?? "").trim();
      // Everything between the channel and the metric label describes the
      // campaign: a date, a name, sometimes a release tag and a title, then
      // the audience.
      const end = pair ? pair.at : cells.length;
      const between = cells.slice(chIdx + 1, end).filter((c) => c !== undefined) as string[];
      const date = between.map(excelDate).find((d): d is string => !!d) ?? null;
      const text = between.filter((c) => !excelDate(c) && /[A-Za-z]/.test(c));
      const name = text[0];
      const audience = text.length > 1 ? text[text.length - 1] : "";

      if (name && date && channel) {
        const t = targetsFromName(name);
        const row: Row = {
          campaign_id: slug(name) + "-" + date,
          name,
          type: channel,
          channel,
          launch_date: date,
          audience: audience || "Teachers",
          objective_metric: "wau",
          target_province: t.province ?? "",
          target_grade: t.grade ?? "",
          target_subject: "",
        };
        cur = { row, m: {} };
        out.push(row);
      } else {
        cur = null;
      }
    }
    if (!cur) continue;

    if (pair) cur.m[pair.label] = pair.value;

    const m = cur.m;
    const pick = (...keys: string[]) => keys.map((k) => m[k]).find((v) => v !== undefined);
    // "Sessions" is the notification sheet's equivalent of a delivered count.
    const delivered = pick("Total Delivered", "Delivered", "Sessions");
    const opens = pick("Unique HTML Opens", "Total HTML Opens", "Notification Bell Opened");
    const clicks = pick("Unique Clicks", "Total Clicks", "Notification Clickthrough");
    if (isCount(delivered)) {
      cur.row.sends = delivered;
      cur.row.recipients = delivered;
    }
    // A rate sitting where a count belongs is the failure mode to guard, not a
    // theoretical one: these sheets put "HTML Open Rate" and "Total HTML Opens"
    // in adjacent rows, and one campaign's layout pairs the label of one with
    // the value of the other. 0.287 opens against 6,247 sends then produces a
    // click-to-open ratio of 98,000%. Dropping the value suppresses the ratio;
    // keeping it would print that number as if measured.
    if (isCount(opens, cur.row.sends)) cur.row.opens = opens;
    if (isCount(clicks, cur.row.sends)) cur.row.clicks = clicks;
  }

  // Drop anything that never acquired a size — a stray header row.
  return out.filter((r) => r.sends !== undefined || r.recipients !== undefined);
}

export async function campaignsFromWorkbook(buf: ArrayBuffer): Promise<CampaignParse> {
  const sheets = await readWorkbook(buf);
  const campaigns: Row[] = [];
  const skipped: string[] = [];
  for (const sheet of sheets) {
    const found = campaignsFromSheet(sheet);
    if (found.length) campaigns.push(...found);
    else skipped.push(sheet.name);
  }
  // Ids must be unique; identical names sent on one day would otherwise merge.
  const seen = new Map<string, number>();
  for (const c of campaigns) {
    const n = (seen.get(c.campaign_id) ?? 0) + 1;
    seen.set(c.campaign_id, n);
    if (n > 1) c.campaign_id += `-${n}`;
    if (c.clicks === undefined) c.clicks = "0";
  }
  return { campaigns, skipped };
}
