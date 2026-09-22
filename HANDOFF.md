# Edwin PMM Dashboard — Project Handoff

**Owner:** Justin Quan, Product Marketing Manager, Nelson Education
**Last updated:** September 22, 2026
**Status:** Prototype complete. Statistical fixes landed and regression-gated. The real-data seam is built and proven — the dashboard has run end to end on an imported CSV. Not yet connected to real Edwin data, because that data has not been requested yet.

---

## What this is

A SaaS-style Product Marketing analytics dashboard for Edwin, Nelson Education's K-12 digital learning platform. It puts lifecycle marketing activity (Pardot emails, in-app notifications, release notes) and teacher behaviour inside Edwin on the same timeline, so Product Marketing and leadership can see whether campaigns coincide with meaningful changes in how teachers use the product.

The central question it answers: **Are our lifecycle marketing efforts moving teachers from awareness to activation to engagement to adoption to retention, and where should we act next?**

It ships with seeded synthetic data and can be swapped onto real data through an in-app CSV import. Synthetic figures are illustrative and must not be quoted as Edwin performance.

---

## Where everything lives

### Live app

**URL:** https://edwin-pmm-dashboard.vercel.app
**Hosting:** Vercel, auto-deploys from the `main` branch on GitHub. Every push builds and deploys; branches get preview URLs.

### Source code

**Repo:** https://github.com/justinnquan/edwin-pmm-dashboard
**Branch:** `main`
**Visibility:** **Public.** Real Edwin figures must never be committed. The CSV import reads files in the browser and never uploads them, specifically so real numbers can be used without ever entering the repository.

### Local development

```
git clone https://github.com/justinnquan/edwin-pmm-dashboard.git
cd edwin-pmm-dashboard
npm install
npm run dev              # http://localhost:5173
npm run typecheck        # tsc --noEmit
npm run build            # layer check + typecheck + production build
npm run null-test        # attribution false-positive regression gate
npm run check:layers     # fails if the generator is reachable above /data
npm run export-sample    # write synthetic data as CSV, re-import, round-trip test
npm run gen:requirements # regenerate docs/DATA-REQUIREMENTS.md from the CSV schema
```

### Documentation in the repo

| File | What it is |
|---|---|
| `HANDOFF.md` | This file. Start here. |
| `docs/DATA-REQUIREMENTS.md` | Field-by-field ask for the Edwin BI team, tiered into Track A / Track B. **Generated** from `src/data/file/schema.ts`, so it cannot drift from what the app accepts. |
| `docs/Edwin_PMM_Dashboard_PRD_and_Prototype_Plan.md` | The full 8-phase PRD: critical assessment, requirements, information architecture, KPI framework, data model, mockup spec, build plan, open questions. The design bible. |
| `docs/PHASE-C_EdwinExecutiveOverview.jsx` | The original Phase C single-file prototype. Superseded, kept for historical reference. |
| `README.md` | Stack, architecture diagram, 5-minute reviewer walkthrough, development instructions. |

There is also a shareable web version of the data requirements, published as a private artifact, for sending to the BI team without asking them to clone anything.

---

## Tech stack

React 18, TypeScript, Vite, Tailwind v4, Recharts, Zustand, React Router, PapaParse (CSV). Deployed on Vercel.

Design tokens are a placeholder for the Phia design system (Nelson's internal system). The current palette uses Edwin brand colours (primary blue `#017ACC`, dark blue `#003865`, accent orange `#E8633A`). Swapping to Phia is a single-object replacement in `src/theme/tokens.ts`.

---

## Architecture

The app follows a strict layered architecture with two invariants, **both now enforced by a script rather than by convention**:

1. **The UI never computes a metric.** Every number routes through `/analytics`.
2. **Nothing above `/data` can reach the synthetic generator.** Everything gets its data through one function, `src()`.

```
src/
  lib/          Pure date arithmetic — no Edwin, no generator, importable by anyone
  theme/        Design tokens (placeholder for Phia)
  data/         THE SWAP POINT — schema, the DataSource contract, and its implementations
    synthetic.ts    the seeded generator, wrapped as a DataSource
    file/           CSV parsing, validation, and session persistence
    source.ts       src() / setSource() — the only door to data
  analytics/    KPI calc, seasonal adjustment, gating, attribution, insight rules
  state/        Zustand: global filters, and a data-source version signal
  components/   Layout shell, KPI cards, charts, tables, tooltips, empty/error states
  pages/        8 route-level pages (see below)
```

### The data seam

Everything above `/data` consumes a single interface, `DataSource` (`src/data/schema.ts`). There are two implementations, and no consumer can tell which one it has:

- `createSyntheticSource()` (`src/data/synthetic.ts`) wraps the seeded generator.
- `buildFileSource()` (`src/data/file/load.ts`) parses uploaded CSV.

`src/data/source.ts` holds the active one as a module singleton, reached with `src()` and replaced with `setSource()`. A module singleton was chosen over threading a parameter (which would churn ~25 signatures and ~80 call sites) and over React context (impossible — the analytics functions are plain functions, and the null-test harness runs them in Node with no React).

Two parts of the contract are worth knowing about:

- **`seatsOn(date, cellIds)`** replaces what used to be a synthetic seat curve. It returns `null` outside the seat table, so the year-over-year rescale degrades honestly instead of fabricating a denominator.
- **`PublicCampaign`** structurally omits `effects` and `halfLife`, the generator's answer key. Reading them above `/data` is now a **compile error**, not something code review has to catch.

Adding a Power BI or API source means writing one more implementation of that interface. Nothing in `/analytics` or the UI changes.

### File-by-file reference

**Pure utilities** (`src/lib/`)
| File | Purpose |
|---|---|
| `dates.ts` | `iso`, `addDays`, `daysBetween`, `fromIso`, `fmtShort`. Extracted from the old `calendar.ts` so that needing `addDays` no longer means importing the one module you are least allowed to touch. |

**Data layer** (`src/data/`)
| File | Purpose |
|---|---|
| `schema.ts` | Typed interfaces, discriminated unions, and the `DataSource` / `PublicCampaign` / `Coverage` contract. What every layer above honours. |
| `source.ts` | **The swap point.** `src()` / `setSource()` / `resetSource()`. |
| `synthetic.ts` | Wraps the seeded generator as a `DataSource`. The only module that knows the generator exists. |
| `target.ts` | Compiles a serializable `TargetSpec` into a cell predicate. Lives apart from `synthetic.ts` to avoid an import cycle. |
| `file/schema.ts` | **Single source of truth for the CSV contract.** Drives the downloadable templates, the import validator, and the generated requirements doc, so the three cannot disagree. |
| `file/load.ts` | CSV → `DataSource`, plus the validation report. Async only at the boundary; the source it produces is fully synchronous. |
| `file/persist.ts` | sessionStorage persistence so an import survives a page reload. Tab-scoped, cleared on close. |
| `calendar.ts` | **Ground truth.** Seasonal model, deterministic RNG, provisioned-seat curve. Unreachable above `/data`, enforced by `npm run check:layers`. |
| `campaigns.ts` | Campaign definitions and `campaignMultiplier`. Contains `effects` (ground truth). |
| `segments.ts` | Province, grade, subject and cell definitions with weights and engagement multipliers. |
| `generate.ts` | The daily fact table generator (date × cell) and the user panel for exposure de-duplication. No longer exports eager constants. |

**Analytics layer** (`src/analytics/`)
| File | Purpose |
|---|---|
| `constants.ts` | Gating constants: `MIN_N` (300), `MIN_DAILY_ACTIVE` (400), `MATERIALITY` (0.05), `CONFIDENCE_Z` (1.96), `YOY_LAG` (364), `BASELINE_SMOOTH` (3), metric labels. |
| `kpis.ts` | Core calculations: `cellFilter`, `sumOn`, `seriesFor`, `windowStats`, `adjustedSE`, `adjustedChange`, `seatWeightedRate`. The seasonal-adjustment and uncertainty math lives here. |
| `attribution.ts` | `reachedIn` (de-duplicated exposure), `campaignsInWindow`, `campaignImpact` (before/after, seasonally adjusted, N-, volume- and uncertainty-gated). |
| `campaign.ts` | Channel metrics, `segmentComparison` (targeted vs. rest of platform), `cohortProgression`, `sustainedVerdict`, `channelRollup`, `campaignInterpretation`. |
| `insights.ts` | Deterministic insight rules: seasonality guard, campaign-associated changes, segment declines. All gated. |
| `adoption.ts` | Activation funnel and OKR gauges, modelled from aggregate data. Flagged as modelled. |
| `segments.ts` | Segment comparison rows and opportunity ranking. Gated, and carries the reason a figure is suppressed. |
| `format.ts` | `pct` (signed, for changes), `pctAbs` (unsigned, for levels and thresholds), `int`. |

**State** (`src/state/`)
| File | Purpose |
|---|---|
| `filterStore.ts` | Global filters: view mode, date range, attribution window, province, grade, subject, selected campaign. Default view is Leadership, default window 7 days. |
| `dataStore.ts` | Which source is active, and a `version` counter bumped on swap. **Holds no data** — the moment a component could select a metric off the store, "the UI never computes a metric" would stop being true. |

**Components** (`src/components/`)
| File | Purpose |
|---|---|
| `Layout.tsx` | App shell: left rail, top bar, filter bar, methodology strip, view toggle. The strip is driven by the active source — real as-of date, provenance label, a warning when history is too short for a baseline, and a "Denominator modelled" caveat from `coverage`. Keys `<Outlet>` on the data version so a swap remounts cleanly. |
| `Rail.tsx` | Left navigation rail. |
| `KpiCard.tsx` | KPI card: value, raw/adjusted pair, note, optional caveat chip. |
| `TrendChart.tsx` | WAU trend with seasonal baseline, gap shading, campaign/release markers. |
| `InsightStrip.tsx` | "What changed" cards with a suppression count. |
| `DrillPanel.tsx` | Campaign drill-down opened from a marker. |
| `ProductImpact.tsx` | Campaign product-impact cards with uncertainty bands. |
| `AdoptionViz.tsx` | Activation funnel and OKR gauges. |
| `InfoTip.tsx` / `kpiInfo.ts` | Per-KPI definition, calculation and limitation text. |
| `MethodologyModal.tsx` | Full methodology explainer. Describes the method actually implemented. |
| `campaignStyle.tsx` | Campaign type colour mapping and legend. |
| `nav.ts` | Navigation config. |
| `primitives.tsx` | Card, Chip, Select. |
| `states.tsx` / `ErrorBoundary.tsx` | Empty, loading, error and insufficient-data states. |

**Pages** (`src/pages/`)
| File | Route | Purpose |
|---|---|---|
| `ExecutiveOverview.tsx` | `/` | Landing page. North-star + 4 KPIs, Marketing Impact panel, WAU trend with baseline, "What changed" strip, campaign contribution table (PMM view). |
| `MarketingPerformance.tsx` | `/marketing` | Campaign table (sortable), channel roll-up, 2-up campaign comparison. PMM view only. |
| `CampaignImpact.tsx` | `/campaign/:id` | Campaign drill-down: summary, product impact, before/after with uncertainty, targeted vs. rest of platform, cohort progression, interpretation. |
| `ActivityTimeline.tsx` | `/timeline` | Multi-lane timeline with campaign/release markers and selectable metric lanes. |
| `AdoptionEngagement.tsx` | `/adoption` | J1–J5 activation funnel, Day-7 and monthly-active OKR gauges, feature adoption bars. |
| `Segments.tsx` | `/segments` | Segment comparison across province/grade/subject, opportunity ranking. PMM view only. |
| `CampaignCalendar.tsx` | `/calendar` | Month-by-month campaign calendar with product event overlay. |
| `DataImport.tsx` | `/data` | **Load real data.** Drop CSVs, get a validation report saying exactly what they can and cannot support, then swap the dashboard onto them. Includes downloadable templates. |

**Scripts** (`scripts/`)
| File | Purpose |
|---|---|
| `null-test.ts` | Sweeps every launch date in a campaign-free window where the true effect is zero and fails if the "material" rate exceeds 5% at any window. Also prints ground-truth recovery per campaign. **The regression gate for any analytics change.** |
| `check-layers.ts` | Fails the build if anything under `analytics`, `components`, `pages`, `state` or `lib` imports a generator module. |
| `export-sample.ts` | Writes the synthetic data out in the real CSV contract, reads it back, and compares. A round-trip test of the file adapter, and a concrete example file to hand the BI team. |
| `gen-requirements.ts` | Regenerates `docs/DATA-REQUIREMENTS.md` from the CSV schema. |

---

## What was built and how it works

### The design thesis

The signature element is the **seasonal baseline gap**. Every metric trend shows a solid line (actual) and a dashed line (what the prior year predicts would have happened anyway, rescaled for seat growth). The shaded band between them is the gap. When the gap is narrow, the movement is calendar-driven. When it's wide, something changed above what the season explains.

This makes the central claim visible without assertions: you can see for yourself whether a campaign marker sits near a gap opening.

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

Two product releases: Assignment auto-grading (Apr 14), Edwin Teaching System live (Aug 24).

The mix is deliberate. If every campaign looked successful, the data would be wrong and the dashboard would not demonstrate its analytical value.

### Seasonal model

Based on the Canadian K-12 calendar (Ontario/Alberta): September surge, holiday troughs, exam spikes, summer collapse. Twenty-three anchor points interpolated across the year, with day-of-week effects (Sunday ~42% of a weekday, Saturday ~30%).

The generator uses this model. The analytics layer **cannot read it** — enforced by `npm run check:layers` — and must recover seasonality from prior-year data alone. That separation is what makes the seasonal adjustment honest rather than circular.

### Progressive disclosure

Leadership and Product Marketing views are the same data at different levels of detail. Leadership gets the 30-second read (overview KPIs, marketing impact, trend). Product Marketing unlocks campaign tables, drill-downs, segments, the calendar.

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

**The fix — landed.** The `DataSource` interface, the `src()` singleton, and two implementations. See "The data seam" above.

### P0 — The synthetic seat model leaked into analytics and the UI

`provisioned()` in `calendar.ts` is a hardcoded piecewise ramp — pure generator ground truth — and it was imported by five analytics files and one page. **Every rate on the dashboard, including the north-star denominator and every seasonal baseline rescale, divided by a fabricated curve.**

**The fix — landed.** `seatsOn()` on the `DataSource`, returning `null` outside the seat table. The barrier is now enforced by `npm run check:layers`, which fails the build; it was a comment for the entire life of the project, which is precisely how the leak got in.

### P1 — `TODAY` was a hardcoded constant

Pinned to 26 Aug 2026 and imported across analytics and six pages.

**The fix — landed.** `src().asOf`, derived from the data's own maximum date, so the dashboard reports what it actually has rather than what the clock says.

### P1 — Methodology copy described the pre-fix method

The fixes changed the math but not the explanation. The modal called the comparison group "comparable non-recipients" while the code said explicitly that it is NOT a matched control, and the strip still advertised a flat "Materiality 5%".

**The fix — landed.** All methodology copy now describes the implemented method, and hardcoded "5%" strings were replaced with `pctAbs(MATERIALITY)` so the copy cannot drift from the constants again.

---

## Known issues that remain

### P1 — Distinct-teacher metrics are summed across cells

`sumOn` (`src/analytics/kpis.ts`) adds every metric across segment cells, including `wau`, `dailyActive` and `ahaUsers`. This is correct synthetically, because each generated teacher occupies exactly one cell. **Real teachers teach more than one subject or grade**, so they land in several cells and get counted once per cell, inflating WAU and the north-star.

This is a data-request problem rather than a code problem, and it is the first of the three flagged items in `docs/DATA-REQUIREMENTS.md`: ask BI for per-cell counts *and* pre-deduplicated totals at each rollup level.

### P1 — Campaign reach cannot be de-duplicated from per-campaign counts

`reachedIn` needs a *union* of distinct teachers across a set of campaigns. A CSV at campaign × cell grain gives per-campaign counts, and summing them double-counts anyone reached by two campaigns. The file adapter currently reports the largest single campaign rather than a sum, and the validator says so. The real fix is a pre-computed distinct union from BI.

### P2 — Gate constants are calibrated to synthetic magnitudes

`MIN_N = 300` and `MIN_DAILY_ACTIVE = 400` were set against a 24-cell, 28,400-seat synthetic population, and the ≤5% false-positive guarantee holds **for the synthetic generator only**. On real data expect either everything gated or nothing gated. Re-run the null test against a real campaign-free window and re-derive both from the observed noise floor. This cannot be done until real data exists.

### P2 — Non-exhaustive state handling in two components

`ProductImpact.tsx` and `DrillPanel.tsx` match `CampaignImpact` states with `===` chains rather than exhaustive switches, so a new union member would compile fine and render nothing. Convert both before adding any new gate state.

### Deferred by design

Phia design tokens (`src/theme/tokens.ts` is still a placeholder), true exposed/unexposed holdouts (a campaign-ops process change, not a dashboard feature), the account/board view (gated on board data existing), and longitudinal cohort retention curves.

---

## Approach decisions that held

- **Association, not causation language.** Every comparison is labelled observational. Non-negotiable; should survive into production.
- **Send-cohort vs. baseline, not opener-vs-non-opener.** Comparing openers to non-openers was rejected: teachers who open emails are systematically more engaged, so every campaign would look like a winner.
- **Deterministic insights, not generated text.** Insight sentences fire only when a change clears materiality, minimum N, volume, and is seasonally adjusted. No free-form narration, so the dashboard cannot assert noise as signal.
- **Layer separation, now enforced.** The UI never computes a metric; the generator is unreachable above `/data`. Both were conventions and are now build failures. This is the architecture's most important property, and making it mechanical is what stopped it eroding.
- **The dashboard should be quiet.** It suppresses more than it reports, and every suppressed figure carries its reason. That is the correct outcome, not a defect.

---

## Verification

Four gates, all green as of this writing. Any analytics change should keep them that way.

| Command | What it proves |
|---|---|
| `npm run typecheck` | Clean TypeScript. |
| `npm run check:layers` | 35 files scanned, no generator imports above `/data`. Verified to actually fail on an injected violation. |
| `npm run null-test` | False-positive rate 0.0% at 7 and 14 days, ≤5% at 30. **Its output is byte-stable** — the seeded RNG makes any diff a real behaviour change, which is what made the data-seam refactor safe to do. |
| `npm run export-sample` | The file adapter reproduces the synthetic source within 0.113%, which is integer rounding. |

Browser QA of all eight pages has been done on localhost and on the live Vercel deployment, including a full CSV import round trip.

---

## Metrics glossary

| Metric | Definition | Calculation |
|---|---|---|
| Active teacher rate | Share of provisioned teachers who did something meaningful in the last 7 days | WAU / provisioned seats |
| WAU | Distinct teachers with ≥1 meaningful action in a rolling 7-day window | count(distinct users with events in window) |
| Adoption rate | Share of active teachers who created a class or assignment | users with aha event / active users |
| 4-week retention | Share of a start cohort still active 4 weeks later | active in week 4 / cohort size, seat-weighted across cells |
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

1. **In-app notification instrumentation.** ETS was the campaign with the genuine sustained lift, and it's an in-app notification. If those don't log per-user impressions, the channel that showed the best result is the channel you can't measure.
2. **Provisioning source is migrating.** The Modular Platform roadmap targeted 85%+ of boards provisioned with no Salesforce. Build the denominator against Admin Console.
3. **Per-cell seats may not exist.** If licences are counted by board rather than grade × subject, the denominator stays allocated rather than measured. Workable — the strip shows a "Denominator modelled" caveat — but it must be known, because an allocated denominator produces a confident-looking activation rate that is partly an assumption.
4. **Gating thresholds need re-tuning.** See "Known issues that remain".

### Recommended next steps in order

1. ~~Land the statistical fixes.~~ Done.
2. ~~Build the real-data seam and a way to import data.~~ Done.
3. **Send `docs/DATA-REQUIREMENTS.md` to the Edwin data/BI team** and book the discovery session. This is the current blocking step — everything downstream waits on real data.
4. **Socialize the prototype** with your manager and leadership. Get decisions on the five headline KPIs and whether the association framing holds.
5. **Start capturing immediately** (cannot be back-filled): weekly provisioned-teacher snapshots per account, and Pardot user-level activity archives.
6. **Import the first real Track A export** through `/data` and read the validation report. Expect the history-depth warning.
7. **Re-derive the gate constants** from the real noise floor once there is enough history to run the null test against a real campaign-free window.
8. **Spike the identity spine.** Attempt the email-to-user_id join on a sample. Below ~70% match rate, scope to aggregate-only.
9. **Add Track B** once the spine holds.
10. **Design holdouts into campaigns.** The only path to causal claims.

---

## Open questions

1. Does a reliable email-to-user_id-to-account_id mapping exist today, and how lossy is it? *(Gates all of Track B.)*
2. Can Pardot and in-app notification data be delivered at the user level with timestamps, joined to user_id?
3. Can we get provisioned-teacher counts per account per period — and per segment, or only per board?
4. How many months of *consistent* product-event history exist?
5. Is campaign ops able to reserve a randomised holdout before send?
6. Can we get the Phia design-token file to theme the prototype?
7. For how many accounts is board-level data actually populated?

~~8. Which behaviour is the adoption "aha"?~~ **Settled:** class created OR assignment created. Implemented and ratified by PMM.

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

The prototype is a working React app with real interactive charts, not a mockup or a slide deck. It runs on synthetic data by default, and it will run on real data the moment someone hands you a CSV — go to `/data`, drop the files in, and the validation report will tell you what they support before anything renders.

Two things are worth understanding before changing anything:

**The null test is the contract.** `npm run null-test` produces byte-stable output from a seeded generator. If a diff appears, the behaviour changed — that is a feature, and it is what made a 30-file data-layer refactor safe to perform in one pass. Run it before and after any analytics work.

**The barriers are mechanical now.** The project spent its whole life asserting in prose that analytics must not read the generator, and the seat curve leaked into six files anyway. `npm run check:layers` turns that assertion into a build failure. Don't route around it.

The seasonal adjustment is the core value proposition. *"Your September spike is 90% calendar"* is a more defensible and more durable position than *"our campaign drove the September spike."* Lead with that in any socialization meeting.

The dashboard is deliberately quiet — it suppresses more than it reports, and every suppressed figure says why. That is the correct outcome, and it is the main thing to explain to anyone who expects a dashboard full of green arrows.
