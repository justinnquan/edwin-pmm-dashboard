/* ===========================================================================
   /data — SYNTHETIC DATA SOURCE
   Wraps the seeded generator in the `DataSource` contract. This is the only
   module that knows the generator exists.

   Nothing here changes what the generator produces. It exists so that the
   generator becomes *one* implementation of an interface rather than the only
   possible shape of the app's data.
=========================================================================== */
import type { Coverage, DataSource, PublicCampaign, SummableMetric } from "./schema";
import { compileTarget } from "./target";
import { CELLS, PROVINCES, GRADES, SUBJECTS } from "./segments";
import { CAMPAIGNS, RELEASES } from "./campaigns";
import { generate, buildPanel } from "./generate";
import { TODAY, START, provisioned } from "./calendar";
import { daysBetween } from "../lib/dates";

/** Every summable metric the generator produces. */
const ALL_METRICS: SummableMetric[] = [
  "provisioned",
  "dailyActive",
  "wau",
  "resourceOpens",
  "classesCreated",
  "assignmentsCreated",
  "ahaUsers",
  "retentionW4",
];

export function createSyntheticSource(): DataSource {
  const data = generate();
  const panel = buildPanel();

  // Drop `effects` and `halfLife` on the way out. The omission is structural:
  // PublicCampaign has no such fields, so nothing above /data can read them.
  const campaigns: PublicCampaign[] = CAMPAIGNS.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    channel: c.channel,
    launch: c.launch,
    audience: c.audience,
    sends: c.sends,
    opens: Math.round(c.sends * c.openRate),
    clicks: Math.round(c.sends * c.clickRate),
    openRate: c.openRate,
    clickRate: c.clickRate,
    objectiveMetric: c.objectiveMetric,
    targetSpec: c.targetSpec,
    target: compileTarget(c.targetSpec),
  }));

  const coverage: Coverage = {
    metrics: Object.fromEntries(ALL_METRICS.map((m) => [m, true])) as Coverage["metrics"],
    reach: true,
    reachIsRecipients: false,
    // The generator allocates seats to cells by segment weight rather than
    // measuring them, which is exactly what a real aggregate export is likely
    // to do as well. Flagged so the UI can say so.
    perCellSeats: false,
    historyDays: daysBetween(START, TODAY),
    // The generator's seat curve is a licence count that steps at the school
    // year — a genuine stock — and it spans two years, so the synthetic path
    // keeps every behaviour the real-data flags exist to switch off.
    seatsAreStock: true,
    canAdjust: true,
    grain: "daily",
    seatsLabel: "provisioned seats",
  };

  return {
    id: "synthetic",
    label: "Seeded synthetic data",
    asOf: TODAY,
    cells: CELLS,
    dimensions: {
      province: PROVINCES.map((p) => p.k),
      grade: GRADES.map((g) => g.k),
      subject: SUBJECTS.map((s) => s.k),
    },
    rowsOn: (dateKey) => data.byDate.get(dateKey),
    seatsOn: (date, cellIds) => {
      const total = provisioned(date);
      let s = 0;
      for (const id of cellIds) s += total * CELLS[id].weight;
      return s;
    },
    // A de-duplicated union over the user panel: a teacher reached by three
    // campaigns counts once. Summing per-campaign counts would not give this.
    reach: (campaignIds, cellIds) => {
      if (!campaignIds.length || !cellIds.length) return 0;
      const inCell = new Set(cellIds);
      const bitmaps = campaignIds.map((id) => panel.exposure[id]).filter(Boolean);
      if (!bitmaps.length) return 0;
      let n = 0;
      for (let i = 0; i < panel.n; i++) {
        if (!inCell.has(panel.cellOf[i])) continue;
        for (const bits of bitmaps) {
          if (bits[i]) {
            n++;
            break;
          }
        }
      }
      return n;
    },
    campaigns,
    releases: RELEASES,
    coverage,
  };
}
