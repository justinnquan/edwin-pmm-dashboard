/* ===========================================================================
   /data/file — CSV CONTRACT
   The exact shape a real export must take to drive this dashboard. This file
   is the single source of truth for three things that must never disagree:
   the template offered for download, the parser's validation, and
   docs/DATA-REQUIREMENTS.md.
=========================================================================== */
import type { SummableMetric } from "../schema";

export interface ColumnSpec {
  /** Header as it must appear in the CSV, lowercase snake_case. */
  name: string;
  required: boolean;
  kind: "date" | "text" | "number" | "rate" | "metric" | "list";
  /** What breaks without it, in the reader's terms. */
  why: string;
  /** The daily-facts metric this column feeds, where it maps to one. */
  metric?: SummableMetric;
}

export interface TableSpec {
  file: string;
  required: boolean;
  grain: string;
  purpose: string;
  columns: ColumnSpec[];
  /** One example row, used for the downloadable template. */
  example: string[];
}

export const DAILY_FACTS: TableSpec = {
  file: "daily_facts.csv",
  required: true,
  grain: "One row per date × province × grade × subject.",
  purpose:
    "Everything on the dashboard. Thirteen or more months of it makes the seasonal baseline possible, which is the whole value proposition.",
  columns: [
    {
      name: "date",
      required: true,
      kind: "date",
      why: "ISO YYYY-MM-DD, interpreted as UTC. Use a week_starting column instead if the export is weekly — the loader detects the grain and reports which it found.",
    },
    {
      name: "province",
      required: false,
      kind: "text",
      why: "Must match the vocabulary used in campaigns.csv. Omit all three segment columns for a platform-wide export; segment views then report that this source carries no segmentation.",
    },
    { name: "grade", required: false, kind: "text", why: "Segment key. See province." },
    { name: "subject", required: false, kind: "text", why: "Segment key. See province." },
    {
      name: "provisioned",
      required: false,
      kind: "number",
      metric: "provisioned",
      why: "Teachers holding a licence on that date — a stock, not a running total. The denominator for the north-star rate and the year-over-year rescale. A cumulative 'ever logged in' count is NOT a substitute: it never sheds anyone, so every rate built on it declines regardless of behaviour. Supply that as a cumulative_logins column instead and it will be charted rather than divided by.",
    },
    {
      name: "daily_active",
      required: false,
      kind: "number",
      metric: "dailyActive",
      why: "Drives the activity-volume gate that stops low-volume windows being compared. If absent the gate falls back to weekly actives — it is never synthesised from a weekly figure, because dividing a weekly distinct count by seven understates it and repeating it overstates it.",
    },
    {
      name: "wau",
      required: true,
      kind: "number",
      metric: "wau",
      why: "Distinct teachers active in a rolling 7 days. The north-star numerator.",
    },
    {
      name: "resource_opens",
      required: false,
      kind: "number",
      metric: "resourceOpens",
      why: "The default engagement metric for campaign impact.",
    },
    {
      name: "classes_created",
      required: false,
      kind: "number",
      metric: "classesCreated",
      why: "Half of the adoption 'aha'.",
    },
    {
      name: "assignments_created",
      required: false,
      kind: "number",
      metric: "assignmentsCreated",
      why: "The other half of the adoption 'aha'.",
    },
    {
      name: "aha_users",
      required: false,
      kind: "number",
      metric: "ahaUsers",
      why: "Distinct teachers who created a class OR an assignment. Not derivable by adding the two columns above — the same teacher may do both.",
    },
    {
      name: "cumulative_logins",
      required: false,
      kind: "number",
      why: "Running total of distinct teachers who have ever logged in. Never used as a denominator, because a figure that never sheds anyone makes every rate built on it fall regardless of behaviour. When new_logins is absent it is differenced into new logins per week.",
    },
    {
      name: "new_logins",
      required: false,
      kind: "number",
      metric: "newLogins",
      why: "Distinct teachers logging in for the first time in a rolling 7 days — the line that shows spikes after a send. Derived from cumulative_logins when that is supplied instead.",
    },
    {
      name: "retention_w4",
      required: false,
      kind: "rate",
      metric: "retentionW4",
      why: "A rate between 0 and 1, not a count. Share of a start cohort still active four weeks later.",
    },
  ],
  example: [
    "2025-09-02",
    "ON",
    "Primary (1–3)",
    "Mathematics",
    "2145",
    "912",
    "1404",
    "3388",
    "18",
    "310",
    "486",
    "",
    "42",
    "0.51",
  ],
};

export const CAMPAIGNS_TABLE: TableSpec = {
  file: "campaigns.csv",
  required: true,
  grain: "One row per campaign.",
  purpose: "Campaign markers, channel metrics, and every attribution view.",
  columns: [
    { name: "campaign_id", required: true, kind: "text", why: "Stable key, also used to join campaign_reach.csv." },
    { name: "name", required: true, kind: "text", why: "Display name." },
    { name: "type", required: true, kind: "text", why: "Groups campaigns by activity type; drives marker colour." },
    { name: "channel", required: true, kind: "text", why: "Groups the channel roll-up." },
    { name: "launch_date", required: true, kind: "date", why: "Anchors every before/after window." },
    { name: "audience", required: true, kind: "text", why: "Human description shown on the drill-down." },
    { name: "sends", required: true, kind: "number", why: "Denominator for CTR." },
    { name: "opens", required: false, kind: "number", why: "Leave blank for channels with no open concept — in-app notifications and release notes. A blank suppresses CTOR rather than reporting a meaningless one." },
    { name: "clicks", required: true, kind: "number", why: "Numerator for CTR." },
    {
      name: "recipients",
      required: false,
      kind: "number",
      why: "Distinct people the campaign actually reached — Pardot's Total Delivered will do. Used only as the sample size that lets a result clear the minimum-N gate, and labelled as recipients rather than verified teachers, since without an identity join we cannot confirm they are the same people the product data counts.",
    },
    {
      name: "objective_metric",
      required: true,
      kind: "metric",
      why: "One of: wau, resourceOpens, assignmentsCreated, classesCreated, ahaUsers. The metric the campaign was authored to move, declared before send. This replaces picking each campaign's best-looking result after the fact.",
    },
    { name: "target_province", required: false, kind: "list", why: "Pipe-delimited. Blank means all." },
    { name: "target_grade", required: false, kind: "list", why: "Pipe-delimited. Blank means all." },
    { name: "target_subject", required: false, kind: "list", why: "Pipe-delimited. Blank means all." },
  ],
  example: [
    "c-bts",
    "Back to School 2026 — Ready Day One",
    "Pardot email",
    "Pardot email",
    "2026-08-10",
    "All teachers",
    "27800",
    "13344",
    "2613",
    "26910",
    "wau",
    "",
    "",
    "",
  ],
};

export const CAMPAIGN_REACH: TableSpec = {
  file: "campaign_reach.csv",
  required: false,
  grain: "One row per campaign × province × grade × subject.",
  purpose:
    "Distinct teachers actually reached. Without it every campaign view is suppressed for lack of a sample size — this is the table that needs the email-to-user_id join.",
  columns: [
    { name: "campaign_id", required: true, kind: "text", why: "Joins to campaigns.csv." },
    { name: "province", required: true, kind: "text", why: "Segment key." },
    { name: "grade", required: true, kind: "text", why: "Segment key." },
    { name: "subject", required: true, kind: "text", why: "Segment key." },
    {
      name: "reached_teachers",
      required: true,
      kind: "number",
      why: "Distinct teachers reached by this campaign in this cell. Counts of distinct people, so they cannot be summed across campaigns without double-counting anyone reached by two.",
    },
  ],
  example: ["c-bts", "ON", "Primary (1–3)", "Mathematics", "1820"],
};

export const RELEASES_TABLE: TableSpec = {
  file: "releases.csv",
  required: false,
  grain: "One row per product release.",
  purpose: "Release markers on the trend and timeline charts. Display only — no metric depends on it.",
  columns: [
    { name: "date", required: true, kind: "date", why: "ISO YYYY-MM-DD." },
    { name: "name", required: true, kind: "text", why: "Release label." },
  ],
  example: ["2026-08-24", "Edwin Teaching System live"],
};

export const TABLES: TableSpec[] = [DAILY_FACTS, CAMPAIGNS_TABLE, CAMPAIGN_REACH, RELEASES_TABLE];

/** A template CSV for one table: header row plus one example row. */
export function templateFor(t: TableSpec): string {
  return `${t.columns.map((c) => c.name).join(",")}\n${t.example
    .map((v) => (v.includes(",") ? `"${v}"` : v))
    .join(",")}\n`;
}
