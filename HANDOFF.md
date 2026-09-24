# Edwin PMM Dashboard — Project Handoff

**Owner:** Justin Quan, Product Marketing Manager, Nelson Education
**Last updated:** September 24, 2026 · **Version:** 0.3.0
**Status:** **Live on real Edwin data**, password protected. A Live / Sample toggle switches the whole dashboard between the published 25/26 exports (48 weeks of usage, 57 Pardot / YesWare campaigns) and the seeded synthetic demo. The dashboard is organised by school year; 2026/27 shows "No 26/27 data yet" with 25/26 as a dotted line until this year's usage is published. Seasonal adjustment is still not possible because there is no prior year; see "What the real data can and cannot do".

---

## What this is

A SaaS-style Product Marketing analytics dashboard for Edwin, Nelson Education's K-12 digital learning platform. It puts lifecycle marketing activity (Pardot emails, YesWare, in-app notifications, release notes) and teacher behaviour inside Edwin on the same timeline, so Product Marketing and leadership can see whether campaigns coincide with meaningful changes in how teachers use the product.

The central question it answers: **Are our lifecycle marketing efforts moving teachers from awareness to activation to engagement to adoption to retention, and where should we act next?**

It has two data sources, chosen with the **Live / Sample** toggle at the bottom of the left rail. **Live** is the real published data. **Sample** is seeded synthetic data that exercises every view, including those real data cannot fill yet; its figures are illustrative and must not be quoted as Edwin performance. The page always states which one is showing.

---

## Where everything lives

### Live app

**URL:** https://edwin-pmm-dashboard.vercel.app
**Hosting:** Vercel, auto-deploys from the `main` branch on GitHub. Every push builds and deploys; branches get preview URLs.

### Live data

The repository is public, so real figures are never committed or bundled. Published data is **one private Vercel Blob object**, `live/edwin-live.json`, read and written only by the serverless function `api/live.ts`.

| Vercel environment variable | What it is |
|---|---|
| `LIVE_VIEW_PASSWORD` | Shared with anyone who should see Live. Remembered per browser after first unlock. |
| `LIVE_PUBLISH_PASSWORD` | Held by the owner. Required to replace what Live shows. |
| `BLOB_STORE_ID` | Added automatically when the private Blob store is connected. The function authenticates with Vercel's OIDC token; older stores expose `BLOB_READ_WRITE_TOKEN` instead, and either is accepted. |

The two passwords are currently set for **Production only**, so Live does not work on branch preview URLs. Add them to Preview if that is wanted.

### Source code

**Repo:** https://github.com/justinnquan/edwin-pmm-dashboard
**Branch:** `main`
**Visibility:** **Public.** Real Edwin figures must never be committed. File imports are read in the browser; Preview never uploads them, and Publish sends them only to the private Blob store.

### Local development

```
git clone https://github.com/justinnquan/edwin-pmm-dashboard.git
cd edwin-pmm-dashboard
npm install
npm run dev              # http://localhost:5173 — Sample and Preview only
npm run typecheck        # tsc --noEmit, for the app and for api/
npm run build            # layer check + typecheck + production build
npm run null-test        # attribution false-positive regression gate
npm run check:layers     # fails if the generator is reachable above /data
npm run export-sample    # write synthetic data as CSV, re-import, round-trip test
npm run gen:requirements # regenerate docs/DATA-REQUIREMENTS.md from the CSV schema
```

`npm run dev` has no serverless functions, so Live reports that the service is not running. Use `vercel dev` with the project linked and the environment variables pulled to exercise Live locally.

### Documentation in the repo

| File | What it is |
|---|---|
| `HANDOFF.md` | This file. The reference doc — architecture, files, metrics, what to ask for. It describes the project **as it stands**. Start here. |
| `HANDOFFV2.md` | The record of the 21–22 Sept 2026 session: the statistical fixes going live, the data seam, and the first real-data import. |
| `HANDOFFV3.md` | The record of the 22–24 Sept 2026 sessions: Live hosting and the toggle, school years and the dotted line, new logins, the date controls, the Data Import rework and manual editor, and the cleaned campaign data. |
| `docs/DATA-REQUIREMENTS.md` | Field-by-field ask for the Edwin BI team, tiered into Track A / Track B. **Generated** from `src/data/file/schema.ts`, so it cannot drift from what the app accepts. |
| `docs/Edwin_PMM_Dashboard_PRD_and_Prototype_Plan.md` | The full 8-phase PRD: critical assessment, requirements, information architecture, KPI framework, data model, mockup spec, build plan, open questions. The design bible. |
| `docs/PHASE-C_EdwinExecutiveOverview.jsx` | The original Phase C single-file prototype. Superseded, kept for historical reference. |
| `README.md` | Stack, Live / Sample, school years, reviewer walkthrough, architecture diagram, development and deployment. |

There is also a shareable web version of the data requirements, published as a private artifact, for sending to the BI team without asking them to clone anything.

---

## Tech stack

React 18, TypeScript, Vite, Tailwind v4, Recharts, Zustand, React Router, PapaParse (CSV), react-day-picker (the date calendar). One Vercel serverless function with `@vercel/blob` for Live data. Deployed on Vercel.

Design tokens are a placeholder for the Phia design system (Nelson's internal system). The current palette uses Edwin brand colours (primary blue `#017ACC`, dark blue `#003865`, accent orange `#E8633A`), plus a purple `#7C5CBF` for the new-logins line. Swapping to Phia is a single-object replacement in `src/theme/tokens.ts`.

The version shown bottom-left of the app is read from `package.json` at build time. Bump it for each release.

---

## Architecture

The app follows a strict layered architecture with two invariants, **both enforced by a script rather than by convention**:

1. **The UI never computes a metric.** Every number routes through `/analytics`.
2. **Nothing above `/data` can reach the synthetic generator.** Everything gets its data through one function, `src()`.

```
api/
  live.ts       Vercel function: password-gated read / publish of the private Live blob
src/
  lib/          Pure date arithmetic and school-year helpers — importable by anyone
  theme/        Design tokens (placeholder for Phia)
  data/         THE SWAP POINT — schema, the DataSource contract, and its implementations
    synthetic.ts    the seeded generator, wrapped as a DataSource (Sample)
    live.ts         client for /api/live (Live)
    file/           CSV / markdown / .xlsx parsing, validation, session persistence
    source.ts       src() / setSource() — the only door to data
  analytics/    KPI calc, seasonal adjustment, gating, attribution, insight rules, reporting period
  state/        Zustand: global filters, and the data-source mode + version signal
  components/   Layout shell, Live/Sample toggle, Live gate, date picker, KPI cards, charts, editor
  pages/        8 route-level pages (see below)
```

### The data seam

Everything above `/data` consumes a single interface, `DataSource` (`src/data/schema.ts`). No consumer can tell which implementation it has:

- `createSyntheticSource()` (`src/data/synthetic.ts`) wraps the seeded generator — **Sample**.
- `buildFileSource()` (`src/data/file/load.ts`) builds a source from CSV text or from rows already parsed from a markdown table, an Excel workbook, the campaign sheet saved as CSV, or the manual editor. **Live** and **Preview** are both built this way, so Live and a preview of the same files behave identically.

`src/data/source.ts` holds the active one as a module singleton, reached with `src()` and replaced with `setSource()`. A module singleton was chosen over threading a parameter (which would churn ~25 signatures and ~80 call sites) and over React context (impossible — the analytics functions are plain functions, and the null-test harness runs them in Node with no React).

Three modes sit on top, held in `src/state/dataStore.ts`: **live** (fetched from `/api/live`), **sample**, and **preview** (an unpublished import in this tab only). While Live is selected but not yet loaded, `LiveGate` replaces every page except `/data`, so the synthetic source underneath is never shown as Live.

Two parts of the contract are worth knowing about:

- **`seatsOn(date, cellIds)`** replaces what used to be a synthetic seat curve. It returns `null` outside the seat table, so the year-over-year rescale degrades honestly instead of fabricating a denominator.
- **`PublicCampaign`** structurally omits `effects` and `halfLife`, the generator's answer key. Reading them above `/data` is a **compile error**, not something code review has to catch.

Adding a Power BI or API source means writing one more implementation of that interface. Nothing in `/analytics` or the UI changes.

### The reporting period

`src/analytics/period.ts` owns the dates the dashboard reports on. A **school year** runs Aug 1 → Jun 30 and is labelled "2025/26". `availableYears()` offers every year the data touches plus the current one by the calendar. `yearWindow()` gives each year's selectable span: a past year is clamped to where the data starts and ends, and the current year runs to today.

`evalDate()` is the day KPIs and "recent" windows are measured to — the end of the selected dates, never later than the last day of data. Like `src()`, it is a module-level value, set by the filter store. `scripts/null-test.ts` never sets it, so the null test is unaffected.

### File-by-file reference

**Serverless** (`api/`)
| File | Purpose |
|---|---|
| `live.ts` | `GET` returns the published payload for the correct `x-live-password`; `POST` replaces it for the correct `x-publish-password`. Constant-time password comparison, `no-store` caching, a 4 MB payload cap, and JSON errors for every failure (401 wrong password, 404 nothing published, 413 too large, 502 store error, 503 not configured). Self-contained: imports nothing from `/src`. Typechecked with `tsconfig.api.json`. |

**Pure utilities** (`src/lib/`)
| File | Purpose |
|---|---|
| `dates.ts` | `iso`, `addDays`, `daysBetween`, `fromIso`; `fmtShort` ("Sep 10, 2025"), `fmtAxis` ("Sep 10 '25"), `fmtRange`; `schoolYearOf`, `schoolYearBounds`, `priorSchoolYear`, `todayIso`. Every displayed date carries its year. |

**Data layer** (`src/data/`)
| File | Purpose |
|---|---|
| `schema.ts` | Typed interfaces, discriminated unions, and the `DataSource` / `PublicCampaign` / `Coverage` contract. `SeriesPoint.value` is nullable so a series can carry last year's value on a day with no actual. |
| `source.ts` | **The swap point.** `src()` / `setSource()` / `resetSource()`. |
| `synthetic.ts` | Wraps the seeded generator as a `DataSource`. The only module that knows the generator exists. |
| `live.ts` | Client for `/api/live`: `fetchLiveInput()` (the stored exports, for the manual editor), `fetchLive()` (the same, built into a source) and `publishLive()`. |
| `target.ts` | Compiles a serializable `TargetSpec` into a cell predicate. Lives apart from `synthetic.ts` to avoid an import cycle. |
| `file/schema.ts` | **Single source of truth for the CSV contract.** Drives the downloadable templates, the import validator, and the generated requirements doc, so the three cannot disagree. |
| `file/load.ts` | Rows → `DataSource`, plus the validation report. Derives `new_logins` by differencing `cumulative_logins` when it is not supplied. Async only at the boundary; the source it produces is fully synchronous. |
| `file/persist.ts` | sessionStorage persistence so a Preview survives a page reload. Tab-scoped, cleared on close. |
| `file/markdown.ts` | Parses Obsidian / GitHub pipe tables, so the usage rollup loads without being re-keyed into CSV. |
| `file/xlsx.ts` | Reads an Excel workbook with no dependency — an .xlsx is a ZIP of XML and the browser can inflate. Encodes two traps that produce silently wrong data rather than errors: self-closing `<c .../>` cells shift every column left under naive pairing, and `t="s"` cells are shared-string indices. |
| `file/edwin.ts` | Maps the real exports onto the CSV column contract: the usage markdown table, the campaign workbook (`campaignsFromWorkbook`), and the same campaign sheet saved as CSV (`campaignsFromStackedCsv`), which reads by column and keeps every label/value pair on a row. |
| `calendar.ts` | **Ground truth.** Seasonal model, deterministic RNG, provisioned-seat curve. Unreachable above `/data`, enforced by `npm run check:layers`. |
| `campaigns.ts` | Campaign definitions and `campaignMultiplier`. Contains `effects` (ground truth). |
| `segments.ts` | Province, grade, subject and cell definitions with weights and engagement multipliers. |
| `generate.ts` | The daily fact table generator (date × cell), the user panel for exposure de-duplication, and `addNewLogins()` — a deterministic new-logins series that draws no random numbers, so the null test is unchanged by it. |

**Analytics layer** (`src/analytics/`)
| File | Purpose |
|---|---|
| `constants.ts` | Gating constants: `MIN_N` (300), `MIN_DAILY_ACTIVE` (400), `MATERIALITY` (0.05), `CONFIDENCE_Z` (1.96), `YOY_LAG` (364), `BASELINE_SMOOTH` (3). `METRIC_LABEL` for campaign objectives, `SERIES_LABEL` for every chartable metric, `LAST_YEAR_LABEL`. |
| `period.ts` | School years, the selectable window of each, `evalDate()`, `hasActualsIn()`. See "The reporting period". |
| `kpis.ts` | Core calculations: `cellFilter`, `sumOn`, `seriesFor`, `windowStats`, `adjustedSE`, `adjustedChange`, `seatWeightedRate`. `seriesFor` emits last year's value on days with no actual, which is what draws the dotted line ahead of a year's data. |
| `attribution.ts` | `reachedIn` (de-duplicated exposure), `campaignsInWindow`, `campaignsBetween` (launched within the selected dates), `campaignImpact` (before/after, seasonally adjusted, N-, volume- and uncertainty-gated). |
| `campaign.ts` | Channel metrics, `segmentComparison` (targeted vs. rest of platform), `cohortProgression`, `sustainedVerdict`, `channelRollup` (over the selected dates), `campaignInterpretation`. |
| `insights.ts` | Deterministic insight rules: seasonality guard, campaign-associated changes, segment declines. All gated. |
| `adoption.ts` | Activation funnel and OKR gauges, modelled from aggregate data. Flagged as modelled. |
| `segments.ts` | Segment comparison rows and opportunity ranking. Gated, and carries the reason a figure is suppressed. |
| `format.ts` | `pct` (signed, for changes), `pctAbs` (unsigned, for levels and thresholds), `int`. |

**State** (`src/state/`)
| File | Purpose |
|---|---|
| `filterStore.ts` | Global filters: view mode, school year, date preset and range (`from` / `to`), before/after window, trend metric, province, grade, subject, selected campaign. Keeps the range inside the year's window and refits it when the source changes. School year and preset are remembered per browser. |
| `dataStore.ts` | The active mode (live / sample / preview), Live's status, and a `version` counter bumped on swap. `toLive()`, `toSample()`, `preview()`. Remembers the mode and the Live view password per browser. **Holds no data** — the moment a component could select a metric off the store, "the UI never computes a metric" would stop being true. |

**Components** (`src/components/`)
| File | Purpose |
|---|---|
| `Layout.tsx` | App shell: left rail, top bar, filter bar (school year, Dates, Compare before/after, segments), methodology strip, view toggle. The strip is driven by the active source. Hides the filters and strip while Live is waiting, and renders `LiveGate` in place of pages. Keys `<Outlet>` on the data version so a swap remounts cleanly. |
| `Rail.tsx` | Left navigation rail, with the Live / Sample toggle and version in its footer. |
| `SourceToggle.tsx` | The **Live / Sample** segmented control (Live on the left). Also shown in the mobile nav. In Preview neither side is selected. |
| `LiveGate.tsx` | Locked (password), loading, nothing-published and unavailable states for Live. |
| `DateRangePicker.tsx` | The **Dates** button and popover: presets (Last 30 days, Last 90 days, Whole school year) beside a two-month range calendar that disables every day the dashboard cannot show. One month on narrow screens; keeps itself on screen. |
| `WindowToggle.tsx` | **Compare before/after** — 1 week · 2 weeks · 30 days — used in the filter bar and on Campaign Impact so the wording cannot drift. |
| `KpiCard.tsx` | KPI card: value, raw/adjusted pair, note, optional caveat chip, and an empty state ("No 26/27 data yet" with the same week last year). |
| `TrendChart.tsx` | The Overview trend: the metric (solid) against the same week last school year (dotted), the gap band where both exist, **new logged-in teachers** on a right-hand axis, campaign and release markers. |
| `InsightStrip.tsx` | "What changed" cards with a suppression count. |
| `DrillPanel.tsx` | Campaign drill-down opened from a marker. |
| `ProductImpact.tsx` | Campaign product-impact cards with uncertainty bands. |
| `AdoptionViz.tsx` | Activation funnel, OKR gauges, and the compact metric trends with their dotted last-year line. |
| `Collapsible.tsx` | A card whose header opens and closes its body; content stays mounted while closed. |
| `ManualEditor.tsx` | The Manual data editor on `/data`: loads Live's stored rows, edits weekly usage / campaigns / releases, and returns them as the same input an upload produces. |
| `InfoTip.tsx` / `kpiInfo.ts` | Per-KPI definition, calculation and limitation text. |
| `MethodologyModal.tsx` | Full methodology explainer. Describes the method actually implemented. |
| `campaignStyle.tsx` | Campaign type colour mapping and legend. |
| `Provenance.tsx` | Footer line stating which source the figures come from. |
| `nav.ts` | Navigation config. |
| `primitives.tsx` | Card, Chip, Select. |
| `states.tsx` / `ErrorBoundary.tsx` | Empty, loading, error and insufficient-data states. |

**Pages** (`src/pages/`)
| File | Route | Purpose |
|---|---|---|
| `ExecutiveOverview.tsx` | `/` | Landing page. North-star + 4 KPIs, "What changed" strip, Marketing Impact trend with the dotted last-year line and new logins, campaign contribution table (PMM view). Empty states for a school year with no data. |
| `MarketingPerformance.tsx` | `/marketing` | Campaign table for the selected dates (sortable), channel roll-up, 2-up campaign comparison. PMM view only. |
| `CampaignImpact.tsx` | `/campaign/:id` | Campaign drill-down: summary, product impact, before/after with uncertainty and a before/after chart against last school year, targeted vs. rest of platform, cohort progression, interpretation. |
| `ActivityTimeline.tsx` | `/timeline` | Multi-lane timeline (including a new-logins lane) with campaign/release markers and a dotted last-year line per lane. |
| `AdoptionEngagement.tsx` | `/adoption` | J1–J5 activation funnel, Day-7 and monthly-active OKR gauges, feature adoption bars, compact trends. |
| `Segments.tsx` | `/segments` | Segment comparison across province/grade/subject, opportunity ranking. PMM view only. Reports plainly when the source carries no segmentation. |
| `CampaignCalendar.tsx` | `/calendar` | Month-by-month calendar of the campaigns sent in the selected dates, with a product release overlay. |
| `DataImport.tsx` | `/data` | **Get data in.** Current source card, then three collapsible routes — **Load your Edwin exports** (open by default; `.md` usage + `.xlsx` or `.csv` campaign sheet), **Manual data**, **Load generic CSV** — each ending in the validation report with **Preview in this tab** and **Publish as Live**. |

**Scripts** (`scripts/`)
| File | Purpose |
|---|---|
| `null-test.ts` | Sweeps every launch date in a campaign-free window where the true effect is zero and fails if the "material" rate exceeds 5% at any window. Also prints ground-truth recovery per campaign. **The regression gate for any analytics change.** |
| `check-layers.ts` | Fails the build if anything under `analytics`, `components`, `pages`, `state` or `lib` imports a generator module. |
| `export-sample.ts` | Writes the synthetic data out in the real CSV contract (now including `new_logins`), reads it back, and compares. A round-trip test of the file adapter, and a concrete example file to hand the BI team. |
| `gen-requirements.ts` | Regenerates `docs/DATA-REQUIREMENTS.md` from the CSV schema. |

---

## Getting data in, and keeping Live current

All three routes are on `/data`, and all three end in the same validation report, then **Preview in this tab** (nothing uploaded, this tab only, discarded when it closes) or **Publish as Live** (publish password; replaces what Live shows for everyone).

| Route | Use it for |
|---|---|
| **Load your Edwin exports** | The monthly refresh. The weekly usage `.md` from the Obsidian vault plus the campaign sheet, as the `.xlsx` workbook or saved as `.csv`. |
| **Manual data** | Correcting a figure, adding a week, adding a release, removing a campaign — without re-exporting. Loads what Live holds now; changed cells are outlined, new rows tinted, bad values block validation, and changes can be discarded. |
| **Load generic CSV** | A segmented Power BI export in the column contract, with downloadable templates. |

**Publishing replaces the whole payload; it never appends.** Publishing the same usage file again does not create a second copy — the validation report should show 336 rows (48 weeks × 7 days).

---

## What the real data can and cannot do

What Live holds today:

| Source | What it is | What it gives |
|---|---|---|
| `Edwin Metrics 25-26 School Year.md` | Power BI weekly rollup, kept in an Obsidian vault. Aug 3 2025 → Jun 28 2026. | Weekly engaged teachers (→ `wau`) and a cumulative logged-in count, differenced into **new logged-in teachers per week**. 48 weeks. |
| `Marketing Communications Metrics_Cleaned_Corrected.csv` | The Pardot / YesWare sheet, cleaned, saved as CSV. | **57 campaigns**, Sept 10 2025 → Mar 9 2026, with delivered, total HTML opens and total clicks. In-app notifications are not included. |

Every campaign date falls inside the usage window, so before/after windows compute against real numbers.

**Works now:** the weekly-active trend and the new-logins line, all 57 campaigns with their real channel metrics, campaign drill-downs, the calendar and timeline. In 2026/27, the dotted 25/26 line is drawn up to today's matching week, and each KPI shows the same week last year.

**Does not work, and why:**

- **No seasonal adjustment.** One school year means no prior year to compare against. 336 days; 374 are needed. Every adjusted figure is suppressed rather than shown as a raw one wearing an adjusted label.
- **No dotted line in 2025/26.** There is no 24/25 usage on Live.
- **No active-teacher rate, no OKR gauges, no activation funnel.** The only denominator in the file is a cumulative login count, which is not a licence count. See the P0 below.
- **No segment views.** The usage export is platform-wide. Campaign audiences *are* recorded — the names encode ON/AB and Primary through Secondary — so targeting will start working the moment the usage side is broken down.

### P0 — a cumulative login count is not a denominator

`Total Logged-in Teachers` rises monotonically, 63 → 10,220 across the year, because it counts everyone who has ever logged in and never sheds anyone. Used as the denominator of an activity rate it falls every week while the product grows: engagement rose 37% between September and April while that rate fell 11 points.

Worse, the year-over-year rescale multiplies the prior-year baseline by that column's growth. Left alone it would set this September's expected weekly-active figure at roughly **4,100 against last September's actual of 2,018**, so every week of the new school year would render as a large decline.

The loader detects the pattern from the data — a series that never falls and grows steeply is a running total — sets `coverage.seatsAreStock = false`, and both the rate and the rescale are refused. The same column is **differenced** into new logins per week instead, which is the figure Leadership watches for spikes after a send. **The fix for the rate is a real licensed-seat count**, which is request #2 in `docs/DATA-REQUIREMENTS.md`.

### When 26/27 usage arrives

Add this year's weeks to the usage table and publish. 25/26 becomes the prior-year baseline, the solid line fills in beside the dotted one, and once 374 days span both years the seasonal method switches on. That is the single highest-value thing to obtain, alongside 24/25 if it exists.

---

## What was built and how it works

### The design thesis

The signature element is the **gap against last year**. Every metric trend shows a solid line (this period) and a dotted line (the same week last school year — rescaled for seat growth when the source has a real seat count). The shaded band between them is the gap. When the gap is narrow, the movement is calendar-driven. When it's wide, something changed above what the season explains.

This makes the central claim visible without assertions: you can see for yourself whether a campaign marker sits near a gap opening. The dotted line is drawn on its own for a school year with no data yet, so last year's shape is readable ahead of time.

### What the synthetic data contains

Seven campaigns with deliberately mixed outcomes:

| Campaign | Channel | Injected truth | What it demonstrates |
|---|---|---|---|
| Report Card Season Time-Savers | Pardot email | +14% assignments, +7% resources | Real sustained lift, hidden by seasonal decline in raw numbers |
| Summer Prep — Build Your First Class | Pardot email | Zero effect | A dud. High sends, no product impact. |
| New Content — Threaded Releases | Release notes | +2% resources | Tiny effect, nearly invisible |
| Back to School 2026 — Ready Day One | Pardot email | +2% WAU | Best channel metrics (48% open, 9.4% CTR), essentially no adjusted impact because September happened anyway |
| ELA Progress Checks — Preview | Pardot email | +1% resources | High CTR (12.8%), narrow audience (ON Secondary ELA), no meaningful product impact |
| Edwin Teaching System — First Look | In-app notification | +12% resources, +6% WAU | Genuine sustained lift. The real win. |
| Edwin Slides — Coming Soon | In-app notification | +5% resources | Too recent for a complete attribution window |

Two product releases: Assignment auto-grading (Apr 14), Edwin Teaching System live (Aug 24). Sample also carries a deterministic **new-logins** series — seasonal, with a short bump after each email send to the cells it targeted — so the Overview's second line demonstrates in Sample too. It lives only in that metric, which no campaign declares as its objective, so it cannot leak into attribution.

The mix is deliberate. If every campaign looked successful, the data would be wrong and the dashboard would not demonstrate its analytical value.

### Seasonal model

Based on the Canadian K-12 calendar (Ontario/Alberta): September surge, holiday troughs, exam spikes, summer collapse. Twenty-three anchor points interpolated across the year, with day-of-week effects (Sunday ~42% of a weekday, Saturday ~30%).

The generator uses this model. The analytics layer **cannot read it** — enforced by `npm run check:layers` — and must recover seasonality from prior-year data alone. That separation is what makes the seasonal adjustment honest rather than circular.

### Progressive disclosure

Leadership and Product Marketing views are the same data at different levels of detail. Leadership gets the 30-second read (overview KPIs, marketing impact, trend with new logins). Product Marketing unlocks campaign tables, drill-downs, segments, the calendar.

---

## Statistical issues found in code review — all fixed

Historical record of what was wrong and what was done about it. Kept because the reasoning matters when these thresholds get re-tuned against real data.

### P0 — Materiality threshold was below the method's noise floor

`MATERIALITY = 0.05` was the bar for calling a change "material", but a null-campaign test showed the method's own noise exceeded 5% at 7- and 14-day windows. At the default 7-day window the method called a zero-effect campaign "material" roughly **22%** of the time. ELA Progress Checks (truth +1%) showed +10.1% MATERIAL; Summer Prep (truth zero) showed −8.0% MATERIAL.

**Root cause.** The seasonal baseline took a single-point value from 364 days ago, carrying its own independent noise draw. Dividing two noisy series multiplies the error, and a fixed 5% threshold cannot adapt to low-activity windows.

**The fix — landed.** Smooth the baseline with a centred ±3-day rolling mean. Propagate uncertainty through the ratio-of-ratios via the delta method. Gate on `max(MATERIALITY, CONFIDENCE_Z × se)` rather than a flat threshold. Add `MIN_DAILY_ACTIVE`, a volume floor, surfaced as the `insufficient-volume` state. **False-positive rate is now 0.0% at 7 and 14 days, ≤5% at 30.**

### P1 — Ground-truth leak

`campaign.ts` and `DrillPanel.tsx` read `campaign.effects`, the generator's answer key, auto-selecting each campaign's best-looking metric.

**The fix — landed.** An author-declared `objectiveMetric` on each campaign — PMM knows the objective before send, so this field exists honestly in real data. `effects` is now structurally absent from `PublicCampaign`, so reading it above `/data` is a compile error.

### P1 — "Matched baseline" wasn't matched

`matchedBaseline()` compared targeted cells against non-targeted cells with no actual matching, and returned `no-holdout` for 5 of 7 campaigns.

**The fix — landed.** Renamed to "Targeted segment vs. rest of platform" and labelled "Not a control". The `no-holdout` state is now a prominent callout arguing for randomised holdouts rather than a quiet empty state.

### P1 — Sustained verdict mislabelled natural decay (fixed twice)

The original rule (`|last| ≥ 0.5 × peak`) guaranteed any real effect eventually read "spike" the longer you observed it.

The first revision used signed logic against a flat 5% — and introduced a worse bug, caught later by inspecting the running app: **it never received the P0 uncertainty fix.** It tested weekly values against the flat floor and ignored the standard error entirely, so Summer Prep — injected truth **zero**, and correctly gated as not material at ±19.3% SE — was labelled **"sustained"** and told the reader *"The lift has held week over week."* A zero-effect campaign was making an affirmative durability claim.

**The fix — landed.** Weekly points now carry their own `se` and materiality, and only weeks clearing their own band count as evidence. A "faded" verdict was added for a lift that held and then decayed, so Report Card — material for six consecutive weeks at 12–20% before fading — no longer reads as a one-week spike. Summer Prep now reads "insufficient".

### P2 — Smaller bugs

Retention was unweighted across cells; the channel rollup ignored the date filter; campaign-associated impact hardcoded `resourceOpens`; CTOR was duplicated for channels with no open concept. All fixed.

Separately, level metrics were rendered with the signed formatter, so a 16% active rate displayed as "+16.0%" and read as a 16% *increase*. `pctAbs` now handles levels and thresholds; only changes keep their sign.

---

## Architectural issues found while scoping real data — all fixed

None of these were in the original code review. Every one was invisible while the data was synthetic and would have broken the moment it wasn't.

### P0 — The data-layer swap point did not exist

The PRD claimed `/data` was a clean swap point. In fact `generate.ts` exported `DATA` and `PANEL` as module-level constants built eagerly at import time, and eight analytics files plus fifteen UI files imported from `/data` directly. There was no interface and no injection point — "swapping the data layer" meant deleting files and hoping everything still typechecked.

**The fix — landed.** The `DataSource` interface, the `src()` singleton, and its implementations. See "The data seam" above.

### P0 — The synthetic seat model leaked into analytics and the UI

`provisioned()` in `calendar.ts` is a hardcoded piecewise ramp — pure generator ground truth — and it was imported by five analytics files and one page. **Every rate on the dashboard, including the north-star denominator and every seasonal baseline rescale, divided by a fabricated curve.**

**The fix — landed.** `seatsOn()` on the `DataSource`, returning `null` outside the seat table. The barrier is now enforced by `npm run check:layers`, which fails the build; it was a comment for the entire life of the project, which is precisely how the leak got in.

### P1 — `TODAY` was a hardcoded constant

Pinned to 26 Aug 2026 and imported across analytics and six pages.

**The fix — landed.** `src().asOf`, derived from the data's own maximum date, and now `evalDate()` on top of it — the end of the selected dates, never past the data.

### P1 — Methodology copy described the pre-fix method

The fixes changed the math but not the explanation. The modal called the comparison group "comparable non-recipients" while the code said explicitly that it is NOT a matched control, and the strip still advertised a flat "Materiality 5%".

**The fix — landed.** All methodology copy now describes the implemented method, and hardcoded "5%" strings were replaced with `pctAbs(MATERIALITY)` so the copy cannot drift from the constants again.

---

## Known issues that remain

### P1 — Distinct-teacher metrics are summed across cells

`sumOn` (`src/analytics/kpis.ts`) adds every metric across segment cells, including `wau`, `dailyActive`, `ahaUsers` and `newLogins`. This is correct synthetically, because each generated teacher occupies exactly one cell. **Real teachers teach more than one subject or grade**, so they land in several cells and get counted once per cell, inflating WAU and the north-star.

This is a data-request problem rather than a code problem, and it is the first of the three flagged items in `docs/DATA-REQUIREMENTS.md`: ask BI for per-cell counts *and* pre-deduplicated totals at each rollup level.

### P1 — Campaign reach cannot be de-duplicated from per-campaign counts

`reachedIn` needs a *union* of distinct teachers across a set of campaigns. A CSV at campaign × cell grain gives per-campaign counts, and summing them double-counts anyone reached by two campaigns. The file adapter currently reports the largest single campaign rather than a sum, and the validator says so. The real fix is a pre-computed distinct union from BI.

### P2 — Gate constants are calibrated to synthetic magnitudes

`MIN_N = 300` and `MIN_DAILY_ACTIVE = 400` were set against a 24-cell, 28,400-seat synthetic population, and the ≤5% false-positive guarantee holds **for the synthetic generator only**. On real data expect either everything gated or nothing gated. Re-run the null test against a real campaign-free window and re-derive both from the observed noise floor. This cannot be done until there is enough real history.

### P2 — Non-exhaustive state handling in two components

`ProductImpact.tsx` and `DrillPanel.tsx` match `CampaignImpact` states with `===` chains rather than exhaustive switches, so a new union member would compile fine and render nothing. Convert both before adding any new gate state.

### Backlog — July falls outside every school year

School years run Aug 1 → Jun 30, so anything dated in July appears in no year view. Sample's Jul 14 "Summer Prep" campaign is the visible case; Live is unaffected today because its campaigns run Sept–Mar. Proposed fix: count July toward the year that just ended while keeping the Aug–Jun label. Parked by the owner on 23 Sept 2026.

### Minor

- **Publish confirmation flashes.** After **Publish as Live** the dashboard swaps onto Live and the page remounts, so the "Published…" line disappears almost at once. The Current source chip ("Live · published …") confirms it.
- **Two real campaigns cannot load.** Edwin NLI Touchpoint #1 (Dec 7 2025) and the YesWare Edwin Admin Update (Oct 21 2025) have no delivered count in the sheet, so they have no audience size.
- **In-app notifications are off Live.** The cleaned sheet covers Pardot and YesWare only; the 11 notification campaigns were removed on purpose. Re-add them through Manual data or a future export if they are wanted.

### Deferred by design

Phia design tokens (`src/theme/tokens.ts` is still a placeholder), true exposed/unexposed holdouts (a campaign-ops process change, not a dashboard feature), the account/board view (gated on board data existing), per-person sign-in for Live (a shared password is used instead), and longitudinal cohort retention curves.

---

## Approach decisions that held

- **Association, not causation language.** Every comparison is labelled observational. Non-negotiable; should survive into production.
- **Send-cohort vs. baseline, not opener-vs-non-opener.** Comparing openers to non-openers was rejected: teachers who open emails are systematically more engaged, so every campaign would look like a winner.
- **Deterministic insights, not generated text.** Insight sentences fire only when a change clears materiality, minimum N, volume, and is seasonally adjusted. No free-form narration, so the dashboard cannot assert noise as signal.
- **Layer separation, now enforced.** The UI never computes a metric; the generator is unreachable above `/data`. Both were conventions and are now build failures. This is the architecture's most important property, and making it mechanical is what stopped it eroding.
- **The dashboard should be quiet.** It suppresses more than it reports, and every suppressed figure carries its reason. That is the correct outcome, not a defect.
- **One road in.** Files, manual edits and the generic CSV all become the same input and go through the same loader, validation report and Preview / Publish buttons. A hand edit cannot reach Live by a path that skips the checks.
- **Live never shows synthetic data.** Until real data has loaded, Live replaces every page with a gate rather than drawing the Sample source underneath.

---

## Verification

Four gates, all green as of this writing. Any analytics change should keep them that way.

| Command | What it proves |
|---|---|
| `npm run typecheck` | Clean TypeScript, for the app and for `api/`. |
| `npm run check:layers` | 43 files scanned, no generator imports above `/data`. Verified to actually fail on an injected violation. |
| `npm run null-test` | False-positive rate 0.0% at 7 and 14 days, ≤5% at 30. **Its output is byte-stable** — the seeded RNG makes any diff a real behaviour change. It stayed byte-identical through every change in `HANDOFFV3.md`, apart from the version number in npm's banner line. |
| `npm run export-sample` | The file adapter reproduces the synthetic source within 0.113%, which is integer rounding. New logins are compared allowing half a unit of rounding per segment, because a quiet day's figure is small. |

Browser QA has been done on localhost for every page, on Sample and on the real 25/26 exports: the school-year and date controls, the dotted line and new logins, Preview, the manual editor end to end, and the Live gate states. For each release, the deployed build was confirmed to be serving the new code and the `/api/live` endpoint to be answering; the owner has used Live and the publish flow on the deployed site.

---

## Metrics glossary

| Metric | Definition | Calculation |
|---|---|---|
| Active teacher rate | Share of provisioned teachers who did something meaningful in the last 7 days | WAU / provisioned seats |
| WAU | Distinct teachers with ≥1 meaningful action in a rolling 7-day window | count(distinct users with events in window) |
| New logged-in teachers | Teachers logging in for the first time in the week — the line that shows spikes after a send | This week's cumulative logged-in count − last week's. The counter restarts with the school year, so the first week is its own count. Never negative. |
| Adoption rate | Share of active teachers who created a class or assignment | users with aha event / active users |
| 4-week retention | Share of a start cohort still active 4 weeks later | active in week 4 / cohort size, seat-weighted across cells |
| Last school year (dotted line) | The same week one school year earlier | Value 364 days back, smoothed ±3 days; rescaled for seat growth only when the source has a real seat count |
| Campaign-associated change | Exposure-weighted mean of seasonally-adjusted changes in each campaign's **declared objective metric** | For each campaign: (post/pre) / (baseline_post/baseline_pre) − 1, weighted by exposed teachers |
| Seasonal adjustment | Divides the observed before/after movement by the prior-year baseline movement over the same calendar window | Adjusted = (post/pre) / (bPost/bPre) − 1, baseline smoothed ±3 days |
| Raw change | Simple period-over-period movement, not adjusted for seasonality | post/pre − 1 |
| Materiality | A change is material when it clears **both** a 5% floor **and** its own uncertainty band | abs(adjusted) ≥ max(0.05, 1.96 × se) |
| Minimum N | Suppressed below 300 exposed teachers | Hard gate in the analytics layer |
| Minimum activity | Suppressed below 400 mean daily-active teachers in either comparison window | Hard gate in the analytics layer |
| Durability verdict | Sustained / faded / spike / insufficient, decided on each week's own uncertainty band | Only weeks clearing their own bar count as evidence |

---

## What's needed to make it operational

**The full field-by-field ask is `docs/DATA-REQUIREMENTS.md`.** It is generated from the CSV contract the app actually accepts, and the `/data` page will score any real export against it and report what is missing. The fastest way to make progress is to send one export, however partial, and let the tool say where things stand.

### Two parallel tracks

**Track A — aggregate history (unblocked, no identity spine).** Daily metric totals by segment with a provisioned-seats column, 13+ months. Unlocks the seasonal baseline, the north-star, and the whole trend story on its own. If Power BI already holds daily activity by province, grade and subject, this may be days of work.

**Track B — user-level exposure (blocked on the identity spine).** Distinct teachers reached per campaign. Needed for all campaign attribution. Without it the dashboard still works; campaign panels report insufficient sample rather than a result.

### The hard gate

**374 days of history** — a 364-day year-over-year lag, ±3-day smoothing, and one comparison window. Below that there is no seasonal baseline, every adjusted figure reports unavailable, and the dashboard falls back to raw levels. For K-12 data that means September always looks like a triumph and July always like a collapse. **Depth of history matters more than breadth of metrics.** The import validator states this explicitly when a file falls short.

### Risks

1. **In-app notification measurement.** ETS was the synthetic campaign with the genuine sustained lift, and it's an in-app notification. The notification sheet is instrumented, but it is not on Live today; keep a path for it.
2. **Provisioning source is migrating.** The Modular Platform roadmap targeted 85%+ of boards provisioned with no Salesforce. Build the denominator against Admin Console.
3. **Per-cell seats may not exist.** If licences are counted by board rather than grade × subject, the denominator stays allocated rather than measured. Workable — the strip shows a "Denominator modelled" caveat — but it must be known, because an allocated denominator produces a confident-looking activation rate that is partly an assumption.
4. **Gating thresholds need re-tuning.** See "Known issues that remain".
5. **Shared passwords.** Anyone with the view password sees Live, and it is remembered in the browser. Rotate `LIVE_VIEW_PASSWORD` in Vercel if it spreads beyond the intended group.

### Recommended next steps in order

1. ~~Land the statistical fixes.~~ Done.
2. ~~Build the real-data seam and a way to import data.~~ Done.
3. ~~Put real data somewhere others can see it.~~ Done — Live, password protected.
4. **Publish 26/27 usage as it accrues** (weekly rows added to the Obsidian table, then Load your Edwin exports → Publish, or Manual data → Add week). This is what turns the dotted line into a comparison.
5. **Send `docs/DATA-REQUIREMENTS.md` to the Edwin data/BI team** and book the discovery session. Licensed seats and segmentation are the next unlocks.
6. **Socialize the dashboard** with your manager and leadership. Get decisions on the five headline KPIs and whether the association framing holds.
7. **Start capturing immediately** (cannot be back-filled): weekly provisioned-teacher snapshots per account, and Pardot user-level activity archives.
8. **Re-derive the gate constants** from the real noise floor once there is enough history to run the null test against a real campaign-free window.
9. **Spike the identity spine.** Attempt the email-to-user_id join on a sample. Below ~70% match rate, scope to aggregate-only.
10. **Add Track B** once the spine holds.
11. **Design holdouts into campaigns.** The only path to causal claims.

---

## Open questions

1. Does a reliable email-to-user_id-to-account_id mapping exist today, and how lossy is it? *(Gates all of Track B.)*
2. Can Pardot and in-app notification data be delivered at the user level with timestamps, joined to user_id?
3. Can we get provisioned-teacher counts per account per period — and per segment, or only per board?
4. How many months of *consistent* product-event history exist? Is there any 24/25 usage?
5. Is campaign ops able to reserve a randomised holdout before send?
6. Can we get the Phia design-token file to theme the dashboard?
7. For how many accounts is board-level data actually populated?
8. Should in-app notifications return to Live, and from which export?

~~9. Which behaviour is the adoption "aha"?~~ **Settled:** class created OR assignment created. Implemented and ratified by PMM.

---

## Source documents and references

| Document | Where | What it covers |
|---|---|---|
| Data Requirements | `docs/DATA-REQUIREMENTS.md` | Field-by-field ask for the BI team, tiered Track A / Track B |
| PRD and Prototype Plan | `docs/Edwin_PMM_Dashboard_PRD_and_Prototype_Plan.md` | Full 8-phase product spec |
| Phase C prototype | `docs/PHASE-C_EdwinExecutiveOverview.jsx` | Original single-file prototype (historical) |
| Edwin Product Vision | Project knowledge: `HEREdwin_Product_Vision___for_Internal_Use_Only240326181557.pdf` | OKRs, strategic pillars, the J1-J5 onboarding journeys |
| Unified Product Strategy Roadmap | Project knowledge: `Unified_Product_Strategy_Roadmap_2025.pdf` | Modular Platform migration, FY27 targets |
| User Personas | Project knowledge: `User_Personas.pdf` | Elementary Teacher (Sarah), Secondary Teacher (Ethan), Admin personas |

---

## For anyone picking this up

The dashboard is a working React app with real interactive charts, not a mockup or a slide deck. It runs on the real published 25/26 data under Live, and on synthetic data under Sample. New data goes in through `/data`, and the validation report says what it supports before anything renders.

Three things are worth understanding before changing anything:

**The null test is the contract.** `npm run null-test` produces byte-stable output from a seeded generator. If a diff appears, the behaviour changed — that is a feature, and it is what made a 30-file data-layer refactor and every change since safe to perform in one pass. Run it before and after any analytics work.

**The barriers are mechanical now.** The project spent its whole life asserting in prose that analytics must not read the generator, and the seat curve leaked into six files anyway. `npm run check:layers` turns that assertion into a build failure. Don't route around it.

**Look at the running app.** Many of this project's worst bugs — a zero-effect campaign labelled "sustained", a funnel inventing 70/2/35, a campaign silently missing from Live — passed every automated check. The only way to find them was to read what the dashboard rendered.

The seasonal adjustment is the core value proposition. *"Your September spike is 90% calendar"* is a more defensible and more durable position than *"our campaign drove the September spike."* For Edwin today, though, engagement is dominated by adoption growth (it peaks in April, not September), so lead with the new-logins line and the 25/26 shape until 26/27 gives a real comparison.

The dashboard is deliberately quiet — it suppresses more than it reports, and every suppressed figure says why. That is the correct outcome, and it is the main thing to explain to anyone who expects a dashboard full of green arrows.
