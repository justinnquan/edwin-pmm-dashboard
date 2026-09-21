/* ===========================================================================
   scripts/gen-requirements.ts — writes docs/DATA-REQUIREMENTS.md

   Run with:  npm run gen:requirements

   The field tables are generated from src/data/file/schema.ts, which is the
   same module that drives the downloadable CSV templates and the import
   validator. A specification that drifts from the code it describes is worse
   than no specification, so this one cannot: change a column and the document
   changes with it.

   The prose around the tables is hand-written and lives here.
=========================================================================== */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TABLES, type TableSpec } from "../src/data/file/schema";
import { HISTORY_NEEDED } from "../src/data/file/load";
import { MIN_N, MIN_DAILY_ACTIVE, YOY_LAG, MATERIALITY, CONFIDENCE_Z } from "../src/analytics/constants";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const KIND: Record<string, string> = {
  date: "Date (`YYYY-MM-DD`)",
  text: "Text",
  number: "Integer",
  rate: "Decimal 0–1",
  metric: "Enum",
  list: "Pipe-delimited list",
};

const TRACK: Record<string, "A" | "B"> = {
  "daily_facts.csv": "A",
  "campaigns.csv": "A",
  "campaign_reach.csv": "B",
  "releases.csv": "A",
};

function table(t: TableSpec): string {
  const rows = t.columns
    .map(
      (c) =>
        `| \`${c.name}\` | ${KIND[c.kind] ?? c.kind} | ${c.required ? "**Yes**" : "No"} | ${c.why.replace(/\|/g, "\\|")} |`
    )
    .join("\n");
  return [
    `### \`${t.file}\``,
    ``,
    `**Track ${TRACK[t.file]}** · ${t.required ? "**Required**" : "Optional"} · ${t.grain}`,
    ``,
    t.purpose,
    ``,
    `| Column | Type | Required | Why the dashboard needs it |`,
    `|---|---|---|---|`,
    rows,
    ``,
    `Example row:`,
    ``,
    "```csv",
    t.columns.map((c) => c.name).join(","),
    t.example.map((v) => (v.includes(",") ? `"${v}"` : v)).join(","),
    "```",
    ``,
  ].join("\n");
}

const doc = `# Edwin PMM Dashboard — Data Requirements

**Owner:** Justin Quan, Product Marketing Manager
**For:** Edwin data / BI team
**Status:** Request for a data availability assessment

> This document is generated from \`src/data/file/schema.ts\`, the same module that
> produces the dashboard's downloadable CSV templates and validates imports. It
> cannot drift from what the application actually accepts. Regenerate with
> \`npm run gen:requirements\`.

---

## What we are asking for

A working prototype dashboard exists. It runs today on synthetic data and has a
built-in importer that accepts the four CSV files described below. **We are not
asking for an integration.** We are asking whether these shapes can be produced,
and at what cost — starting with a one-off export we can load by hand.

The dashboard has a **Data Import** page that will score any export against this
specification and report exactly what is missing, what is unusable, and what it
limits. The fastest way to answer this request is to send one export, however
partial, and let the tool tell us where we stand.

## The two tracks

The ask is deliberately split, because the two halves have very different
dependencies and one of them is unblocked today.

### Track A — aggregate history (no identity spine needed)

Daily metric totals by segment, plus a campaign list. **No user-level join, no
email matching, no personal data.** This alone unlocks the dashboard's core
claim: the seasonal baseline, the north-star active-teacher rate, and the whole
trend story.

If Power BI already holds daily activity by province, grade and subject, Track A
may be days of work rather than a project.

### Track B — user-level exposure (blocked on the identity spine)

Which distinct teachers a campaign actually reached. This is the only part that
needs the email → \`user_id\` → \`account_id\` join, and it is what every
campaign-attribution view depends on. **Without Track B the dashboard still
works**, but every campaign panel reports insufficient sample rather than a
result.

Please treat Track A as the immediate ask and Track B as the thing to scope.

---

## The files

${TABLES.map(table).join("\n")}

---

## Three things that will otherwise bite us

These are the questions most likely to produce data that looks right and is
wrong. Worth settling before anyone writes a query.

### 1. Distinct-teacher counts need two grains

A real teacher can teach two subjects, or span grade bands. That means they
belong to more than one segment cell, and **counts of distinct people cannot be
added across cells** — summing them counts that teacher twice.

The dashboard currently sums \`wau\` across the cells in the selected segment,
which is correct only if each teacher sits in exactly one cell. So we need
either:

- **(preferred)** per-cell counts *and* pre-deduplicated totals at each rollup
  level — province, grade, subject, and all-up; or
- a rule assigning each teacher a single primary cell, stated explicitly, so we
  can caveat the segment figures accordingly.

Additive metrics (\`resource_opens\`, \`assignments_created\`) are unaffected.

### 2. Reach cannot be de-duplicated after the fact

\`campaign_reach.csv\` gives distinct teachers per campaign per cell. Those are
counts of people, so adding two campaigns' reach double-counts anyone who got
both. The dashboard needs a **union** across a set of campaigns for its channel
roll-up.

Per-campaign counts cannot produce that union. Either supply a pre-computed
distinct count per campaign *set*, or tell us and we will label the roll-up as
possibly double-counting.

### 3. Provisioned seats may not exist per segment

\`provisioned\` is the denominator for the north-star active-teacher rate and the
rescale for every year-over-year comparison. If Edwin licences are counted by
board rather than by grade × subject, a true per-cell figure may not exist.

That is workable — the dashboard will allocate by population weight and display
a **"Denominator modelled"** caveat — but we need to know which it is, because
an allocated denominator produces a confident-looking activation rate that is
partly an assumption.

---

## Hard constraints

| Constraint | Value | Consequence if unmet |
|---|---|---|
| History depth | **${HISTORY_NEEDED} days** (${YOY_LAG}-day year-over-year lag + smoothing + one window) | No seasonal baseline. Every adjusted figure reports unavailable and the dashboard shows raw levels only — which for K-12 means September always looks like a triumph and July always like a collapse. This is the single most important number in this document. |
| Minimum sample | ${MIN_N} exposed teachers | Results below this are suppressed rather than shown. |
| Minimum activity | ${MIN_DAILY_ACTIVE} mean daily-active teachers per comparison window | Low-volume windows are reported as insufficient rather than compared. |
| Date format | ISO \`YYYY-MM-DD\`, UTC | Rows with any other format are rejected. Excel commonly writes \`DD/MM/YYYY\`. |
| Segment vocabulary | Consistent spelling across files | The dashboard builds its segments from the values present, but campaign targeting is matched by exact string. |

The sample-size and activity thresholds were calibrated against synthetic data.
They will need re-deriving from the real noise floor — expect either everything
suppressed or nothing suppressed on the first pass.

## What we are *not* asking for

- No personal data, names, or email addresses. Track A is aggregate counts only,
  and Track B needs distinct *counts*, never identities.
- No real-time feed. A periodic export is enough; the dashboard reports its own
  as-of date from the data.
- No schema change on your side. These four shapes are what the application
  accepts; how you produce them is entirely your call.

## Security note

The prototype repository is **public**. Imported files are read in the browser
and never uploaded, committed, or deployed — they stay on the machine doing the
import and are discarded when the tab closes. Real Edwin figures must not be
committed to the repository.

---

## Open questions for the data team

1. Does a reliable email → \`user_id\` → \`account_id\` mapping exist today, and
   how lossy is it? (Gates all of Track B.)
2. Can Pardot deliver per-user activity with timestamps, joined to \`user_id\`?
3. **Are in-app notification impressions instrumented per user at all?** In the
   prototype's synthetic data the campaign with the genuine sustained lift was
   an in-app notification. If that channel is not instrumented, the channel most
   likely to work is the one we cannot measure.
4. Can we get provisioned-teacher counts per account per period — and is that
   Salesforce or Admin Console, given the Modular Platform migration?
5. How many months of *consistent* product-event history actually exist?
6. For how many accounts is board-level data populated?
7. Can campaign operations reserve a randomised holdout before send? This is the
   only route to a causal claim rather than an observed association, and it is a
   process change rather than a reporting one.

## Two things that cannot be back-filled

Worth starting now regardless of what else is decided, because every week of
delay is a week of history permanently lost:

1. **Weekly provisioned-teacher snapshots per account.** There is no way to
   reconstruct what was provisioned last March.
2. **Pardot user-level activity archives.** The retention window is finite.

---

## Method, in one paragraph

Every figure on this dashboard is an **observed association, not a causal
claim**. Each period is compared against the same calendar window a year
earlier, and a change is reported as material only when it clears both a
${(MATERIALITY * 100).toFixed(0)}% floor and ${CONFIDENCE_Z} times its own standard error — so a quiet
window raises its own bar rather than producing a false positive. The dashboard
is deliberately quiet: it suppresses more than it reports. That is the intended
behaviour, and it is why the data quality questions above matter more than the
volume of data.
`;

mkdirSync(join(ROOT, "docs"), { recursive: true });
writeFileSync(join(ROOT, "docs", "DATA-REQUIREMENTS.md"), doc);
console.log(
  `Wrote docs/DATA-REQUIREMENTS.md — ${TABLES.length} tables, ` +
    `${TABLES.reduce((n, t) => n + t.columns.length, 0)} columns.`
);
