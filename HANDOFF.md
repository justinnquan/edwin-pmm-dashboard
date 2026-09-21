# Edwin PMM Dashboard — Project Handoff

**Owner:** Justin Quan, Product Marketing Manager, Nelson Education
**Last updated:** September 21, 2026
**Status:** Prototype complete on synthetic data. Seven pages built. Statistical fixes landed and verified. Not yet connected to real data — and the data-layer swap point the PRD describes does not actually exist yet (see "Known issues").

---

## What this is

A SaaS-style Product Marketing analytics dashboard for Edwin, Nelson Education's K-12 digital learning platform. It puts lifecycle marketing activity (Pardot emails, in-app notifications, release notes) and teacher behaviour inside Edwin on the same timeline, so Product Marketing and leadership can see whether campaigns coincide with meaningful changes in how teachers use the product.

The central question it answers: **Are our lifecycle marketing efforts moving teachers from awareness to activation to engagement to adoption to retention, and where should we act next?**

It runs on seeded synthetic data behind a swappable data layer. Figures are illustrative and must not be quoted as Edwin performance.

---

## Where everything lives

### Live app

**URL:** https://edwin-pmm-dashboard.vercel.app
**Hosting:** Vercel, auto-deploys from the `main` branch on GitHub. Every push builds and deploys; branches get preview URLs.

### Source code

**Repo:** https://github.com/justinnquan/edwin-pmm-dashboard
**Branch:** `main`
**Visibility:** Public (was briefly private during early build)

### Local development

```
git clone https://github.com/justinnquan/edwin-pmm-dashboard.git
cd edwin-pmm-dashboard
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build      # production build to dist/
```

### Documentation in the repo

| File | What it is |
|---|---|
| `docs/Edwin_PMM_Dashboard_PRD_and_Prototype_Plan.md` | The full 8-phase PRD: critical assessment, requirements, information architecture, KPI framework, data model, mockup spec, Claude Code architecture recommendation, build plan, and open questions. This is the design bible. |
| `docs/PHASE-C_EdwinExecutiveOverview.jsx` | The original Phase C prototype (single-file React component with embedded data/analytics layers). Superseded by the full multi-file build, kept for historical reference. |
| `docs/DATA-REQUIREMENTS.md` | What real data the dashboard needs, field by field, tiered into Track A (aggregate, unblocked) and Track B (user-level). **The artifact for the BI discovery session.** |
| `README.md` | Stack, architecture diagram, 5-minute reviewer walkthrough, development instructions. |

---

## Tech stack

React 18, TypeScript, Vite, Tailwind v4, Recharts, Zustand, React Router. Deployed on Vercel.

Design tokens are a placeholder for the Phia design system (Nelson's internal system). The current palette uses Edwin brand colours (primary blue `#017ACC`, dark blue `#003865`, accent orange `#E8633A`). Swapping to Phia is a single-object replacement in `src/theme/tokens.ts`.

---

## Architecture

The app follows a strict layered architecture. **The UI never computes a metric.** Every number routes through `/analytics`, which reads from `/data`. All gating (minimum-N, materiality, activity volume) lives in the analytics layer so no component can render an ungated figure by accident.

```
src/
  theme/        Design tokens (placeholder for Phia)
  data/         Seeded synthetic generators + typed schemas   ← THE SWAP POINT
  analytics/    KPI calc, seasonal adjustment, min-N gating, attribution, insight rules
  state/        Zustand store: global filters, view mode, selected campaign
  components/   Layout shell, KPI cards, charts, tables, tooltips, empty/error states
  pages/        7 route-level pages (see below)
```

The key architectural principle: replacing `src/data/` with a real adapter (Power BI, Edwin API, etc.) that honours the typed schema in `src/data/schema.ts` should leave `src/analytics/` and everything above it untouched.

> **This is the design intent, not yet the implementation.** The seam does not exist as an interface today, and the synthetic seat model leaks upward into both analytics and one page. See "Known issues — real-data blockers" below. Building that seam for real is the current workstream.

### File-by-file reference

**Data layer** (`src/data/`)
| File | Purpose |
|---|---|
| `schema.ts` | Typed interfaces and discriminated unions. The contract every layer above honours. |
| `calendar.ts` | Date utilities, deterministic RNG, seasonal model (K-12 school calendar), provisioned-population function. **Ground truth** — analytics must not read this directly, but currently does at seven sites (see Known issues). |
| `campaigns.ts` | Campaign definitions, release events, and the `campaignMultiplier` function that injects effects into the synthetic data. Contains `effects` (ground truth). |
| `segments.ts` | Province, grade, subject, and cell definitions with weights and engagement multipliers. |
| `generate.ts` | The daily fact table generator (date x cell) and the lightweight user panel for exposure de-duplication. Exports `DATA` and `PANEL`. |

**Analytics layer** (`src/analytics/`)
| File | Purpose |
|---|---|
| `constants.ts` | Gating constants: `MIN_N` (300), `MATERIALITY` (0.05), `YOY_LAG` (364), metric labels. |
| `kpis.ts` | Core calculations: `cellFilter`, `sumOn`, `seriesFor`, `windowMean`, `adjustedChange`. The seasonal-adjustment math lives here. |
| `attribution.ts` | Campaign-level attribution: `reachedIn` (de-duplicated exposure), `campaignsInWindow`, `campaignImpact` (before/after, seasonally adjusted, N-gated). |
| `campaign.ts` | Phase D methods: channel metrics, `matchedBaseline` (send-cohort vs. rest-of-platform), `cohortProgression`, `sustainedVerdict`, `channelRollup`, `campaignInterpretation`. |
| `insights.ts` | Deterministic insight rules. Three rule types: seasonality guard, campaign-associated changes, segment declines. All gated on materiality and minimum N. |
| `adoption.ts` | Activation funnel modelled from aggregate data (not per-user cohort events). Clearly flagged as modelled estimates. |
| `segments.ts` | Segment comparison rows and opportunity ranking. Min-N gated. |
| `format.ts` | Formatting helpers (`pct`, `int`). |

**State** (`src/state/`)
| File | Purpose |
|---|---|
| `filterStore.ts` | Zustand store holding global filters (view mode, date range, attribution window, province, grade, subject, selected campaign). All pages read from and write to this. Default view is Leadership, default window is 7 days. |

**Components** (`src/components/`)
| File | Purpose |
|---|---|
| `Layout.tsx` | App shell: left rail, top bar, filter bar, methodology strip, view toggle. |
| `Rail.tsx` | Left navigation rail with section links. |
| `KpiCard.tsx` | KPI card component showing value, raw/adjusted pair, note, and optional caveat chip. |
| `TrendChart.tsx` | The main WAU trend chart with seasonal baseline, gap shading, and campaign/release markers. |
| `InsightStrip.tsx` | Renders the "What changed" insight cards with suppression count. |
| `DrillPanel.tsx` | Campaign drill-down panel (opened by clicking a campaign marker). |
| `ProductImpact.tsx` | Campaign product-impact cards (WAU, resource, assignment change). |
| `AdoptionViz.tsx` | Activation funnel visualization and OKR gauges. |
| `InfoTip.tsx` | Tooltip component for KPI definitions and methodology. |
| `MethodologyModal.tsx` | Full methodology explanation modal. |
| `campaignStyle.tsx` | Campaign type colour/icon mapping. |
| `kpiInfo.ts` | Per-KPI definition, calculation, and limitation text (feeds InfoTip). |
| `nav.ts` | Navigation item definitions. |
| `primitives.tsx` | Shared primitives: Card, Chip, Select. |
| `states.tsx` | Empty, error, and insufficient-data state components. |
| `ErrorBoundary.tsx` | React error boundary. |

**Pages** (`src/pages/`)
| File | Route | Purpose |
|---|---|---|
| `ExecutiveOverview.tsx` | `/` | Landing page. North-star + 4 KPIs, Marketing Impact panel, WAU trend with baseline, "What changed" strip, campaign contribution table (PMM view). |
| `MarketingPerformance.tsx` | `/marketing` | Campaign table (sortable by associated impact), channel roll-up, campaign comparison. PMM view only. |
| `CampaignImpact.tsx` | `/campaign/:id` | Full campaign drill-down: summary, product impact, before/after, send-cohort vs. baseline, cohort progression, interpretation. |
| `ActivityTimeline.tsx` | `/timeline` | Interactive multi-lane timeline with campaign/release markers and selectable metric lanes. |
| `AdoptionEngagement.tsx` | `/adoption` | J1-J5 activation funnel, Day-7 and monthly-active OKR gauges, feature adoption bars. |
| `Segments.tsx` | `/segments` | Segment comparison table across province/grade/subject, opportunity ranking. PMM view only. |
| `CampaignCalendar.tsx` | `/calendar` | Month-by-month campaign calendar with product event overlay. |

---

## What was built and how it works

### The design thesis

The signature element is the **seasonal baseline gap**. Every metric trend shows a solid line (actual) and a dashed line (what the prior year predicts would have happened anyway, rescaled for seat growth). The shaded band between them is the gap. When the gap is narrow, the movement is calendar-driven. When it's wide, something changed above what the season explains.

This makes the central claim of the dashboard visible without assertions: you can see for yourself whether a campaign marker sits near a gap opening.

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

Based on the Canadian K-12 calendar (Ontario/Alberta): September surge, holiday troughs, exam spikes, summer collapse. Twenty-three anchor points interpolated across the year. Day-of-week effects applied (Sunday ~42% of weekday, Saturday ~30%).

The generator uses this model to produce the synthetic data. The analytics layer is **not allowed to read it** and must recover seasonality from the prior-year data alone. This separation is what makes the seasonal adjustment honest rather than circular.

### Progressive disclosure

Leadership and Product Marketing views are the same data with different levels of detail. The toggle in the top-right header controls which sections and detail rows appear. Leadership gets the 30-second read (overview KPIs, marketing impact, trend). Product Marketing unlocks campaign tables, drill-downs, segments, the calendar.

---

## Statistical issues found in code review — all fixed

Historical record of what was wrong and what was done about it. Kept because the reasoning matters when these thresholds get re-tuned against real data.

### P0 — Materiality threshold is below the method's noise floor

**The problem.** `MATERIALITY = 0.05` (5%) is the threshold for calling a change "material." But a null-campaign test (100 fake launch dates where the true effect is zero) shows the method's own noise level exceeds 5% at 7-day and 14-day windows. At the 7-day default window, the method calls a zero-effect campaign "material" roughly 22% of the time.

**Live consequences.** ELA Progress Checks (injected truth +1%) currently shows as +10.1%, MATERIAL. Summer Prep (injected truth zero) shows as -8.0%, MATERIAL. The dashboard reports wins that don't exist.

**Root cause.** The seasonal baseline takes a single-point value from 364 days ago, which carries its own independent noise draw. Dividing two noisy series multiplies the error. And the fixed 5% threshold can't adapt to low-activity windows where noise is larger.

**The fix — LANDED.** Smooth the baseline with a centred ±3 day rolling mean. Add uncertainty propagation through the ratio-of-ratios. Gate on estimated uncertainty, not a fixed threshold. Add a minimum activity-volume gate alongside the headcount gate.

### P1 — Ground-truth leak

`src/analytics/campaign.ts:26` and `src/components/DrillPanel.tsx:23` read `campaign.effects`, which is the generator's answer key. This auto-selects each campaign's best metric (flattery mechanism) and will break when real data replaces synthetic data.

**The fix (Task 4).** Add an author-declared `objectiveMetric` field to `CampaignDef`. PMM knows the campaign's objective before send, so this field exists honestly in real data.

### P1 — Matched baseline isn't matched

`matchedBaseline()` compares targeted cells against non-targeted cells, but no actual matching happens. Primary/Junior teachers (engagement 1.06) get compared to Secondary (0.89). It also returns `no-holdout` for 5 of 7 campaigns because most target everyone.

**The fix (Task 5).** Rename honestly to "Targeted segment vs. rest of platform." Make the `no-holdout` state visually prominent as an argument for reserving randomised holdouts.

### P1 — Sustained verdict mislabels natural decay

Report Card's weekly progression decays from +15% to +2% and gets labelled "spike" when it's actually a sustained lift that naturally faded. The `|last| >= 0.5 * peak` rule guarantees any real effect eventually reads "spike" the longer you observe it.

**The fix (Task 6).** Use signed logic: sustained when the last three weeks hold the same sign as the peak and clear materiality.

### P2 — Smaller bugs

Retention is unweighted across cells. Channel rollup ignores the date filter. Campaign-associated impact hardcodes `resourceOpens` for all campaigns. CTOR shows a duplicated number for channels with no open concept.

**All of the above are fixed.** Verified by `npm run null-test`, which sweeps every launch date in a campaign-free window and fails if the false-positive rate exceeds 5% at any window. It currently reports 0.0% at 7 and 14 days.

---

## Known issues — real-data blockers

These are architectural, not statistical, and none of them were in the original code review. They were found while scoping the real-data work. **Every one of them is invisible while the data is synthetic and breaks the moment it isn't.**

### P0 — The data-layer swap point does not exist

The PRD and the Architecture section above both claim `src/data/` is a clean swap point: replace it with a real adapter and `src/analytics/` and the UI are untouched. That is not true today.

`src/data/generate.ts` exports `DATA` and `PANEL` as module-level constants computed eagerly at import time. Eight analytics files and fifteen UI files import from `src/data/` directly. There is no interface, no injection point, and no way to hold two sources at once. "Swapping the data layer" currently means deleting files and hoping everything above still typechecks.

**The fix.** A `DataSource` interface in `src/data/source.ts` capturing the eight things analytics actually consumes, with a module-singleton provider (`src()` / `setSource()`), a `SyntheticDataSource` wrapping today's generators, and a `FileDataSource` parsing uploaded CSV.

### P0 — The synthetic seat model leaks into analytics and the UI

`provisioned()` (`src/data/calendar.ts:62`) is a hardcoded piecewise ramp — pure generator ground truth. The file-by-file table above says analytics must not read `calendar.ts` directly. It does, at seven sites: `kpis.ts:9`, `campaign.ts:15`, `insights.ts:8`, `segments.ts:9`, `adoption.ts:14`, and the UI at `pages/ExecutiveOverview.tsx:11`.

**Consequence.** Every rate on the dashboard — the north-star active teacher rate, every seasonal baseline rescale, every per-cell seat figure — currently divides by a fabricated curve. This is the single biggest blocker to real data.

**The fix.** `seatsOn(date, cellIds)` on the `DataSource`, returning `null` outside the seat table so the year-over-year rescale degrades honestly instead of silently fabricating a denominator. Enforce the barrier with an ESLint `no-restricted-imports` rule so it becomes a build failure rather than a code-review catch.

### P1 — Distinct-teacher metrics are summed across cells

`sumOn` (`src/analytics/kpis.ts:22-28`) adds every metric across segment cells, including `wau`, `dailyActive`, and `ahaUsers`. This is correct synthetically because each generated teacher occupies exactly one cell. Real teachers teach more than one subject or grade, so they land in several cells and get counted once per cell — inflating WAU and the north-star.

**The fix.** Ask BI for both grains: per-cell counts *and* pre-deduplicated totals at each rollup level. Documented in `docs/DATA-REQUIREMENTS.md`.

### P1 — `TODAY` is a hardcoded constant

`src/data/calendar.ts:8` pins the as-of date to 26 Aug 2026 and is imported across analytics and six pages. Real data needs an as-of date derived from the data's own maximum date, so the dashboard reports what it actually has rather than what the clock says.

### P1 — Methodology copy describes the pre-fix method

The statistical fixes changed the math but not the explanation. `MethodologyModal.tsx:19-22` still calls the comparison group "comparable non-recipients" while `campaign.ts:52` says explicitly that it is NOT a matched control. The strip in `Layout.tsx:160` still advertises a flat "Materiality 5%" rather than the floor-plus-uncertainty-band bar that is actually applied. The dashboard currently misdescribes itself.

### P2 — Gate constants are calibrated to synthetic magnitudes

`MIN_N = 300` and `MIN_DAILY_ACTIVE = 400` were set against a 24-cell, 28,400-seat synthetic population, and the ≤5% false-positive guarantee holds **for the synthetic generator only**. On real data expect either everything gated or nothing gated. Re-run the null test against a real campaign-free window and re-derive both constants from the observed noise floor.


---

## Approach decisions that held

- **Association, not causation language.** Every comparison is labelled observational. The "Association" chip on KPI cards, the methodology strip, the drill-panel caveats. This is non-negotiable and should survive into production.
- **Send-cohort vs. baseline, not opener-vs-non-opener.** The brief originally suggested comparing openers to non-openers. This was rejected because teachers who open emails are systematically more engaged, so every campaign would look like a winner. The prototype compares the full targeted send cohort instead.
- **Deterministic insights, not generated text.** Insight sentences fire only when a change clears materiality AND minimum N AND is seasonally adjusted. No free-form language model narration. This prevents the dashboard from asserting noise as signal.
- **Layer separation.** The UI never computes a metric. Verified by grep: no arithmetic in `components/` or `pages/`. All gating in `analytics/`. This is the architecture's most important property.

---

## How the project was built

### Phase sequence

| Phase | What | Status |
|---|---|---|
| Prompt + PRD | 30-section product brief specifying the dashboard concept, a critical assessment challenging assumptions, and a full PRD with KPI framework, data model, IA, mockup spec, and build plan | Complete. Lives in `docs/Edwin_PMM_Dashboard_PRD_and_Prototype_Plan.md` |
| Phase C prototype | Single-file React component (Executive Overview) with embedded data/analytics/UI layers, demonstrating the seasonal baseline, KPI cards, insight strip, and campaign drill-down | Complete. Superseded by multi-file build. Original in `docs/PHASE-C_EdwinExecutiveOverview.jsx` |
| Full build (Phases A-G) | Justin built the full 7-page app in Claude Code, separating the single-file prototype into the layered architecture | Complete. All 7 pages, clean TypeScript, clean build, deployed to Vercel. |
| Code review | Cloned repo, ran typecheck and build, grepped for ground-truth leaks and ungated arithmetic, ran numerical harnesses against the attribution math, measured false-positive rate with null-campaign test | Complete. |
| Statistical fixes | 8 tasks addressing the P0/P1/P2 findings, plus a null-test regression script | Complete. Commit `36009e5`. False-positive rate 22% → 0.0% at the 7-day window. |
| Real-data readiness | Build the data-source seam the PRD claims already exists, an in-app CSV upload with schema validation, and the BI requirements spec | **In progress. This is the current step.** |

### Key design decisions and their rationale

**Why the north-star is active teacher rate, not WAU.** WAU grows when sales sells more seats, which has nothing to do with PMM. Active teacher rate (WAU / provisioned) isolates behaviour change from seat growth. Maps directly to the 50% MAU company OKR.

**Why seasonal adjustment is a v1 requirement, not a v2 enhancement.** Edwin usage is dominated by the school calendar. Without a seasonal baseline, every fall campaign is a fake hero and every summer campaign looks like a crisis. This is the thing that makes the dashboard credible in a leadership room.

**Why "exposed vs. unexposed" was scoped to future state.** True exposed/unexposed requires randomised holdout groups designed into campaigns before send. That's a campaign-ops process change, not a dashboard feature. Faking it with opener-vs-non-opener would systematically inflate every campaign's apparent impact.

**Why the "aha" definition matters.** "Adoption rate" is defined as the share of active teachers who created a class or assignment. This is the point where a teacher has committed their workflow to Edwin. It maps to the J4/J5 onboarding journeys. A different definition (e.g. "opened 5 resources") would change the north-star's behaviour. PMM should own this call.

---

## Metrics glossary

| Metric | Definition | Calculation |
|---|---|---|
| Active teacher rate | Share of provisioned teachers who did something meaningful in Edwin in the last 7 days | WAU / provisioned seats |
| WAU | Distinct teachers with ≥1 meaningful action in a rolling 7-day window | count(distinct users with events in window) |
| Adoption rate | Share of active teachers who created a class or assignment | users with aha event / active users |
| 4-week retention | Share of a start cohort still active 4 weeks later | active in week 4 / cohort size |
| Campaign-associated change | Exposure-weighted mean of seasonally-adjusted resource engagement changes across recent campaigns | For each campaign: (post/pre) / (baseline_post/baseline_pre) - 1, weighted by exposed teachers |
| Seasonal adjustment | Divides the observed before/after movement by the prior-year baseline movement over the same calendar window | Adjusted = (post/pre) / (bPost/bPre) - 1 |
| Raw change | Simple period-over-period movement, not adjusted for seasonality | post/pre - 1 |
| Materiality | A change is "material" when it exceeds the threshold (currently 5%) after seasonal adjustment | (After fixes: must also exceed its own uncertainty band) |
| Minimum N | Results are suppressed when the exposed teacher count falls below 300 | Hard gate in the analytics layer |

---

## What's needed to make it operational

### Two parallel data tracks

**Track A — Aggregate history (unblocked, no identity spine needed).** Daily metric totals by segment (province, grade, subject) going back 13+ months. Needed for the seasonal baseline. If Power BI already has this, the baseline may be computable in weeks.

**Track B — User-level joins (blocked on identity spine).** Needed for all campaign-to-product-behaviour attribution. Requires a reliable email-to-user_id-to-account_id mapping.

### Data requirements

| Data | Needed for | Likely source | Blocker |
|---|---|---|---|
| Daily activity by segment, 13+ months | Seasonal baseline | Power BI / Edwin DB | History depth: under 13 months means no YoY baseline |
| Provisioned teachers per account as a time series | Active teacher rate, Day-7 activation | Salesforce (migrating to Admin Console) | Cannot be back-filled. Start snapshotting immediately. |
| Product events with user_id + timestamp | All campaign attribution | Edwin app DB | Needs event store or derived tables, not GA |
| Pardot sends/opens/clicks per prospect + timestamp | Campaign exposure | Pardot | Retention window is finite. Start archiving now. |
| In-app notification impressions/clicks per user | In-app campaign attribution | Notification delivery system | Often not instrumented at all. Check early. |
| Province, grade, subject, role on user record | All segmentation | Edwin user profile | Grade and subject may be self-declared or blank |
| Email-to-user_id-to-account_id mapping | Identity spine (Track B) | Salesforce + Edwin | The single biggest dependency. Match rate unknown. |
| Randomised holdout flag per send | Causal claims (future) | Pardot (process change) | Requires campaign ops buy-in |

### Risks

1. **In-app notification instrumentation.** ETS was the campaign with the genuine sustained lift, and it's an in-app notification. If those don't log per-user impressions, the channel that showed the best result is the channel you can't measure.
2. **Provisioning source is migrating.** The Modular Platform roadmap targeted 85%+ of boards provisioned with no Salesforce. Build the denominator against Admin Console, not Salesforce.
3. **Gating thresholds need re-tuning on real data.** `MIN_N = 300` and the volume floor were set against synthetic data. Re-run the null test against real data and set both from the observed noise floor.

### Recommended next steps in order

1. ~~Land the statistical fixes.~~ Done — commit `36009e5`.
2. **Socialize the fixed prototype** with your manager and leadership. Get decisions on the "aha" definition, the five headline KPIs, and whether the association framing holds.
3. **Run a data discovery session** with the Edwin data/BI team. Output: a data availability matrix scored against `src/data/schema.ts`.
4. **Start capturing immediately** (cannot be back-filled): weekly provisioned-teacher snapshots per account, and Pardot user-level activity archives.
5. **Spike the identity spine.** Attempt the email-to-user_id join on a sample. If match rate is below ~70%, scope to aggregate-only (Track A).
6. **Swap to real aggregate data** (Track A). Ship the seasonal baseline on real data first, before user-level attribution.
7. **Add user-level attribution** (Track B) once the spine holds.
8. **Design holdouts into campaigns.** The only path to causal claims.

---

## Open questions (from the PRD, still unresolved)

1. Does a reliable email-to-user_id-to-account_id mapping exist today, and how lossy is it?
2. Can Pardot and in-app notification data be delivered at the user level with timestamps, joined to user_id?
3. Can we get provisioned-teacher counts per account per period?
4. How many weeks of consistent product-event history exist?
5. Is Pardot/campaign ops able to reserve a randomised holdout before send?
6. Can we get the Phia design-token file (colours, type, spacing) to theme the prototype?
7. For how many accounts is board-level data actually populated?
8. Which behaviour does PMM want as the adoption "aha"? Recommended: class created OR assignment created.

---

## Source documents and references

| Document | Where | What it covers |
|---|---|---|
| PRD and Prototype Plan | `docs/Edwin_PMM_Dashboard_PRD_and_Prototype_Plan.md` | Full 8-phase product spec |
| Data Requirements | `docs/DATA-REQUIREMENTS.md` | Field-by-field ask for the Edwin BI team, tiered Track A / Track B |
| Phase C prototype | `docs/PHASE-C_EdwinExecutiveOverview.jsx` | Original single-file prototype (historical) |
| Edwin Product Vision | Project knowledge: `HEREdwin_Product_Vision___for_Internal_Use_Only240326181557.pdf` | OKRs, strategic pillars, the J1-J5 onboarding journeys |
| Unified Product Strategy Roadmap | Project knowledge: `Unified_Product_Strategy_Roadmap_2025.pdf` | Modular Platform migration, FY27 targets |
| User Personas | Project knowledge: `User_Personas.pdf` | Elementary Teacher (Sarah), Secondary Teacher (Ethan), Admin personas |

---

## For anyone picking this up

The prototype is a working React app with real interactive charts, not a mockup or a slide deck. It demonstrates the concept convincingly enough to socialize internally, but it runs on synthetic data. The statistical issues found in code review are fixed and regression-tested; the remaining barrier to real numbers is the data layer itself (see "Known issues").

The architecture is sound and was independently verified: clean TypeScript, clean build, no ground-truth leaks in the analytics layer (aside from the two documented in the fix brief), and no metric computation in the UI. The layer separation means swapping synthetic data for real data should not require touching the analytics or UI code, provided the new adapter honours the schema.

The seasonal adjustment is the core value proposition. "Your September spike is 90% calendar" is a more defensible and more durable position than "our campaign drove the September spike." Lead with that in any socialization meeting.

The dashboard will get quieter after the fixes. That is the correct outcome.
