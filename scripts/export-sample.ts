/* ===========================================================================
   scripts/export-sample.ts — write the synthetic data out in the real CSV
   contract, then read it back and validate it.

   Run with:  npm run export-sample

   Two jobs:

   1. A round-trip test of the file adapter. If the synthetic source can be
      serialized to CSV, parsed back, and produce the same figures, the
      FileDataSource honours the same contract as the synthetic one.
   2. A concrete example to hand the BI team. "Here are four files with real
      headers and 13 months of rows — produce these shapes" is a far more
      answerable request than a prose specification.

   Output goes to sample-export/, which is gitignored: the shapes are the
   point, and the files are large.
=========================================================================== */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { src } from "../src/data/source";
import { iso, addDays } from "../src/lib/dates";
import { buildFileSource } from "../src/data/file/load";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "sample-export");
mkdirSync(OUT, { recursive: true });

const s = src();
const cells = s.cells;

/* --- daily_facts.csv ------------------------------------------------------- */
const factHeader =
  "date,province,grade,subject,provisioned,daily_active,wau,resource_opens," +
  "classes_created,assignments_created,aha_users,new_logins,retention_w4";

const lines: string[] = [factHeader];
// Walk back far enough to include the prior year the baseline needs.
let d = addDays(s.asOf, -(s.coverage.historyDays - 1));
let days = 0;
while (d <= s.asOf) {
  const key = iso(d);
  const rows = s.rowsOn(key);
  if (rows) {
    days++;
    for (const c of cells) {
      const r = rows[c.id];
      // Real exports carry integer counts, not the generator's floats.
      lines.push(
        [
          key,
          `"${c.province}"`,
          `"${c.grade}"`,
          `"${c.subject}"`,
          Math.round(r.provisioned),
          Math.round(r.dailyActive),
          Math.round(r.wau),
          Math.round(r.resourceOpens),
          Math.round(r.classesCreated),
          Math.round(r.assignmentsCreated),
          Math.round(r.ahaUsers),
          Math.round(r.newLogins),
          r.retentionW4.toFixed(3),
        ].join(",")
      );
    }
  }
  d = addDays(d, 1);
}
writeFileSync(join(OUT, "daily_facts.csv"), lines.join("\n") + "\n");

/* --- campaigns.csv --------------------------------------------------------- */
const campLines = [
  "campaign_id,name,type,channel,launch_date,audience,sends,opens,clicks," +
    "objective_metric,target_province,target_grade,target_subject",
];
for (const c of s.campaigns) {
  const spec = c.targetSpec;
  campLines.push(
    [
      c.id,
      `"${c.name}"`,
      `"${c.type}"`,
      `"${c.channel}"`,
      c.launch,
      `"${c.audience}"`,
      c.sends,
      // An open rate of exactly 1 is how the app marks a channel with no open
      // concept; that must round-trip as a blank, not as a real number.
      c.openRate === 1 ? "" : c.opens,
      c.clicks,
      c.objectiveMetric,
      `"${(spec.province ?? []).join("|")}"`,
      `"${(spec.grade ?? []).join("|")}"`,
      `"${(spec.subject ?? []).join("|")}"`,
    ].join(",")
  );
}
writeFileSync(join(OUT, "campaigns.csv"), campLines.join("\n") + "\n");

/* --- campaign_reach.csv ---------------------------------------------------- */
const reachLines = ["campaign_id,province,grade,subject,reached_teachers"];
for (const c of s.campaigns) {
  for (const cell of cells) {
    const n = s.reach([c.id], [cell.id]) ?? 0;
    if (n > 0) {
      reachLines.push(
        [c.id, `"${cell.province}"`, `"${cell.grade}"`, `"${cell.subject}"`, n].join(",")
      );
    }
  }
}
writeFileSync(join(OUT, "campaign_reach.csv"), reachLines.join("\n") + "\n");

/* --- releases.csv ---------------------------------------------------------- */
writeFileSync(
  join(OUT, "releases.csv"),
  ["date,name", ...s.releases.map((r) => `${r.date},"${r.name}"`)].join("\n") + "\n"
);

console.log(`Wrote sample-export/ — ${days} days, ${cells.length} segments, ${lines.length - 1} fact rows.`);

/* --- Round-trip: read it back and validate --------------------------------- */
const report = buildFileSource({
  dailyFacts: readFileSync(join(OUT, "daily_facts.csv"), "utf8"),
  campaigns: readFileSync(join(OUT, "campaigns.csv"), "utf8"),
  reach: readFileSync(join(OUT, "campaign_reach.csv"), "utf8"),
  releases: readFileSync(join(OUT, "releases.csv"), "utf8"),
  label: "Round-trip",
});

console.log("\nROUND-TRIP VALIDATION");
console.log(`  usable         ${report.usable}`);
console.log(`  rows           ${report.summary.rows.toLocaleString()}`);
console.log(`  range          ${report.summary.dateFrom} → ${report.summary.dateTo}`);
console.log(`  history        ${report.summary.historyDays} days`);
console.log(`  segments       ${report.summary.cells}`);
console.log(`  campaigns      ${report.summary.campaigns}`);
console.log(`  seasonal adj.  ${report.summary.canAdjust ? "available" : "UNAVAILABLE"}`);
for (const f of report.findings) {
  console.log(`  [${f.severity}] ${f.file}: ${f.message}`);
}

if (!report.usable || !report.source) {
  console.error("\nFAIL — the exported files do not satisfy the loader.");
  process.exit(1);
}

/* Compare a few headline figures between the two sources. Exact equality is
   not expected: the export rounds floats to the integers a real system would
   report. Anything beyond a percent of drift means the contract is not being
   honoured. */
const fileSrc = report.source;
const ids = cells.map((c) => c.id);
const key = iso(s.asOf);
const a = s.rowsOn(key)!;
const b = fileSrc.rowsOn(key)!;
const sum = (rows: typeof a, m: keyof (typeof a)[0]) =>
  ids.reduce((t, id) => t + (rows[id][m] as number), 0);

let worst = 0;
const checks: [string, number, number][] = [];
for (const m of ["wau", "resourceOpens", "assignmentsCreated", "dailyActive", "newLogins"] as const) {
  const x = sum(a, m);
  const y = sum(b, m);
  // New logins run to a handful per segment on a quiet day, so rounding each
  // of the cells to an integer can move the total by up to half a unit per
  // cell — several percent of a small number. Only drift beyond that bound
  // says anything about the contract.
  const rounding = m === "newLogins" ? ids.length * 0.5 : 0;
  const drift = x ? Math.max(0, Math.abs(y - x) - rounding) / x : 0;
  worst = Math.max(worst, drift);
  checks.push([m, x, y]);
}
const seatsA = s.seatsOn(s.asOf, ids) ?? 0;
const seatsB = fileSrc.seatsOn(s.asOf, ids) ?? 0;
const seatDrift = seatsA ? Math.abs(seatsB - seatsA) / seatsA : 0;
worst = Math.max(worst, seatDrift);
checks.push(["seats", seatsA, seatsB]);

console.log("\nSOURCE COMPARISON (as of " + key + ")");
for (const [m, x, y] of checks) {
  console.log(
    `  ${m.padEnd(20)} synthetic ${Math.round(x).toLocaleString().padStart(10)}` +
      `   file ${Math.round(y).toLocaleString().padStart(10)}`
  );
}
console.log(`\n  worst drift ${(worst * 100).toFixed(3)}%`);

if (worst > 0.01) {
  console.error("FAIL — drift over 1%. The file adapter is not honouring the contract.");
  process.exit(1);
}
console.log("PASS — the file adapter reproduces the synthetic source within rounding.");
