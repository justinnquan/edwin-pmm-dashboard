# Edwin Product Marketing Dashboard

A SaaS-style Product Marketing analytics dashboard for Nelson Education's **Edwin**. It puts
lifecycle marketing activity (Pardot emails, in-app notifications, release notes) and teacher
behaviour inside Edwin on one timeline, to answer: *are our campaigns moving teachers from
awareness to activation to engagement to adoption to retention, and where should we act next?*

**Live:** https://edwin-pmm-dashboard.vercel.app · **Version:** 0.3.0 (shown bottom-left of the app)

## Status

The dashboard runs on either of two data sources, switched with the **Sample / Live** toggle at the
bottom of the left rail:

| Mode | What it shows |
|---|---|
| **Sample** | Seeded synthetic data. Illustrative only — must not be quoted as Edwin performance. It exercises every view, including the ones real data cannot fill yet. |
| **Live** | The real 25/26 Edwin exports, and nothing else: the weekly usage rollup (48 weeks, Aug 2025 → Jun 2026) and the Pardot / YesWare / in-app campaign workbook (67 campaigns, Sept 2025 → Mar 2026). Password protected. |

On Live, the weekly-active trend, **new logged-in teachers per week** (differenced from the
cumulative login count), all 67 campaigns with their real channel metrics, campaign drill-downs, the
timeline and the calendar all work. The **2026/27** school year shows "No 26/27 data yet" with 25/26
as a dotted line until 26/27 usage is published. Three things do not, and the dashboard says so
in place rather than showing a zero:

- **No seasonal adjustment.** One school year means no prior year to compare against (336 days of
  history; 374 are needed). The method switches on when 26/27 usage arrives and 25/26 becomes the
  baseline.
- **No active-teacher rate, OKR gauges or activation funnel.** The export's only denominator is a
  cumulative ever-logged-in count, which is not a licence count. The loader detects this and refuses
  to divide by it.
- **No segment views.** The usage export is platform-wide.

`HANDOFF.md` is the full reference; `docs/DATA-REQUIREMENTS.md` is the ask for the BI team.

## Stack

React 18 · TypeScript · Vite · Tailwind v4 · Recharts · Zustand · React Router · one Vercel
function with Vercel Blob for Live data

## Sample and Live

- **Switching.** The toggle applies to every page and is remembered per browser. On phones it sits at
  the start of the top section nav.
- **Viewing Live.** The first switch to Live asks for the shared Live password, which is then
  remembered in that browser. Until real data has loaded, Live shows a locked, loading or
  "nothing published" state in place of every page — it never renders the synthetic data underneath.
- **Updating Live.** On **Data Import** (`/data`), load the two exports as they are kept (the `.md`
  rollup and the `.xlsx` workbook), read the validation report, then either:
  - **Preview in this tab** — the dashboard uses the files in this tab only. Nothing is uploaded; it
    survives a reload and is discarded when the tab closes. Choosing Sample or Live ends it.
  - **Publish as Live** — enter the publish password and the parsed exports replace what Live shows
    for everyone.
- **Where the data lives.** This repository is public, so real Edwin figures are never committed or
  bundled. Published data is one private Vercel Blob object (`live/edwin-live.json`), read only by
  `api/live.ts` with the function's server-side store credentials and returned only for the correct password.

### One-time Vercel setup

1. In the Vercel project, **Storage → Create → Blob**, choose **private** access, and connect it to
   this project. That adds `BLOB_STORE_ID` (older stores add `BLOB_READ_WRITE_TOKEN` instead).
2. **Settings → Environment Variables**, for Production and Preview:
   - `LIVE_VIEW_PASSWORD` — shared with anyone who should see Live
   - `LIVE_PUBLISH_PASSWORD` — kept by the owner; allows replacing Live data
3. Redeploy, open `/data`, load the two exports, and **Publish as Live**.

Until this is done, Live reports that it is not configured.

## School years, dates and the dotted line

- **School year** (2025/26 · 2026/27, plus 2024/25 on Sample) scopes every page. A school year runs
  Aug 1 → Jun 30. It defaults to the current school year and is remembered per browser.
- **Dates** opens a calendar with presets — Last 30 days, Last 90 days, Whole school year — or a
  custom start and end day. Only days the dashboard can show are selectable: nothing before the data
  starts, after a past year's last published day, or after today.
- **Compare before/after** (1 week · 2 weeks · 30 days) is how many days either side of each send
  are compared.
- **The dotted line** on every trend is the same week last school year (364 days back, ±3-day
  smoothed). It is drawn on its own when this year has no data yet, so last year's shape is visible
  ahead of time. Where no prior year exists (2025/26 on Live) there is no dotted line.
- KPIs report as of the last day of the selected dates. Campaign tables, the calendar and timeline
  markers list only campaigns sent in those dates.
- Every date carries its year ("Sep 10, 2025"; chart axes "Sep 10 '25").

## Reviewer walkthrough

Open the [live dashboard](https://edwin-pmm-dashboard.vercel.app). It lands on the **Executive
Overview**. Three controls shape everything: **Sample / Live** (bottom-left), the **Leadership /
Product Marketing** toggle (top right — Leadership is the 30-second read; Product Marketing unlocks
the operating detail), and the **global filter bar** (school year, dates, compare before/after, and
province / grade / subject where the source has them). The **Methodology** button in the strip explains how
every figure is gated, and the strip itself states what the active source can and cannot support.

Start on **Sample** to see the full method, then switch to **Live** to see what real data supports.

1. **Executive Overview** (`/`). North-star *Active teacher rate* plus WAU, Adoption, Retention and a
   caveated *Campaign-associated* card, each with an ⓘ giving its definition, calculation and
   limitation. The **Marketing impact** chart shows the metric (solid), the same week last school year
   (dotted) and the gap between them, plus **new logged-in teachers** on the right-hand axis so
   spikes after a send are visible. Click a ▲ campaign marker to drill in.
2. **Marketing Performance** (`/marketing`, PMM view). Sortable campaign table with durability
   verdicts — **sustained, faded, spike or insufficient**, each decided on the week's own uncertainty
   band — and a channel roll-up.
3. **Campaign Impact** (`/campaign/:id`). Before vs. after with uncertainty (1 week / 2 weeks / 30 days) and a chart of
   the same window against last school year,
   **targeted segment vs. rest of platform** (explicitly *not* a control), week-over-week cohort
   progression, and one gated interpretation sentence. Compare a broad campaign with a narrow one to
   see the minimum-sample gate and the "needs a randomised holdout" state.
4. **Activity Timeline** (`/timeline`) and **Campaign Calendar** (`/calendar`). Campaign and release
   markers on a shared axis with selectable metric lanes, and the same activity month by month.
5. **Adoption & Engagement** (`/adoption`). J1–J5 activation funnel, Day-7 (70%) and monthly-active
   (50%) OKR gauges, feature adoption — modelled from aggregate data. On Live these report
   unavailable, naming the missing seat count and event data.
6. **Segments** (`/segments`, PMM view). Segment comparison and opportunity ranking, with small cells
   gated to *insufficient data*. On Live this reports that the export is platform-wide.
7. **Data Import** (`/data`). Validation report, preview and publish (see above), plus a generic CSV
   route with downloadable templates for when a segmented Power BI export arrives.

**What to look for.** The dashboard never asserts causation, never shows a raw change wearing an
adjusted label, and hides underpowered or unsupported figures rather than show a misleading number —
every suppressed figure says why. It is deliberately quiet. The synthetic data is deliberately mixed
(one real sustained lift, one high-CTR campaign with no product impact, movements that are pure
seasonality), so not every campaign looks good. If one did, the data would be wrong.

## Layered architecture

Two invariants, both enforced by `npm run check:layers` rather than by convention: the UI never
computes a metric, and nothing above `/data` can reach the synthetic generator. Everything gets its
data through one function, `src()`, so replacing the source replaces the whole app's data.

```
api/
  live.ts      Vercel function: password-gated read/publish of the private Live blob
src/
  lib/         pure date arithmetic
  theme/       design tokens (placeholder for Phia)
  data/        THE SWAP POINT — the DataSource contract and its implementations
    source.ts     src() / setSource() — the only door to data
    synthetic.ts  the seeded generator, wrapped (Sample)
    live.ts       client for /api/live (Live)
    file/         CSV / markdown / .xlsx parsing, validation, session persistence
  analytics/   KPI calc, seasonal adjustment, gating, attribution, insight rules
  state/       Zustand: global filters, and the data-source mode + version signal
  components/  Layout shell, Sample/Live toggle, Live gate, KPI cards, charts, tables, states
  pages/       Overview · Marketing Performance · Campaign Impact · Timeline ·
               Adoption · Segments · Calendar · Data Import
```

Sample, Live and Preview are all `DataSource` implementations built by the same loaders, so a page
cannot tell which one it has — Live and a preview of the same files behave identically.

## Develop

```bash
npm install
npm run dev              # http://localhost:5173 — Sample and Preview only
npm run typecheck        # tsc --noEmit, app and api/
npm run build            # layer check + typecheck + production build
npm run null-test        # attribution false-positive regression gate
npm run check:layers     # fails if the generator is reachable above /data
npm run export-sample    # write synthetic data as CSV, re-import, round-trip test
npm run gen:requirements # regenerate docs/DATA-REQUIREMENTS.md from the CSV schema
```

`npm run dev` has no serverless functions, so Live reports that the service is not running. To use
Live locally, run `vercel dev` with the project linked and its environment variables pulled
(`vercel env pull`).

`npm run null-test` is the regression gate for any analytics change. It sweeps launch dates in a
campaign-free window where the true effect is zero and fails if the "material" rate exceeds 5%, and
its output is byte-stable — a diff means the behaviour changed. Run it before and after.

Bump `version` in `package.json` for each release; the rail footer reads it at build time.

## Deployment

Deployed on Vercel with GitHub auto-deploy: every push to `main` builds and deploys; branches get
preview URLs. `vercel.json` rewrites every path except `/api/*` to the single-page app.
