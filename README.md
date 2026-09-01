# Edwin Product Marketing Dashboard

A SaaS-style Product Marketing analytics dashboard for Nelson Education's **Edwin**, connecting
lifecycle marketing activity to teacher behaviour inside the product. Prototype on **seeded synthetic
data** behind a swappable data layer.

> Figures are illustrative and must not be quoted as Edwin performance. Design tokens are a
> placeholder pending the Phia system.

## Status

All seven sections built (PRD build plan Phases A–G complete). See `docs/` for the full PRD and
prototype plan.

**Live:** https://edwin-pmm-dashboard.vercel.app

## Stack

React 18 · TypeScript · Vite · Tailwind v4 · Recharts · Zustand · React Router

## Reviewer walkthrough

Open the [live dashboard](https://edwin-pmm-dashboard.vercel.app). It lands on the **Executive
Overview**. Two controls shape everything: the **Leadership / Product Marketing** toggle (top right —
Leadership is the 30-second read; Product Marketing unlocks the operating detail) and the **global
filter bar** (date range, province, grade, subject, attribution window) which every view recomputes
against. The blue **Methodology** button in the strip explains how every figure is gated.

A five-minute tour:

1. **Executive Overview** (`/`). North-star *Active teacher rate* plus WAU, Adoption, Retention, and
   a caveated *Campaign-associated* card — each with an ⓘ giving its definition, calculation, and
   limitation. Read the **"What changed"** strip (deterministic, gated insights) and the **Marketing
   impact** chart: the solid line is actual, the dashed line the prior-year seasonal baseline, and
   the shaded band the gap between them. Click a ▲ **campaign marker** to jump into its impact.
2. **Marketing Performance** (`/marketing`, PMM view). Sort the campaign table by **Assoc. change**;
   note the **Sustained vs. One-week spike** chips and the channel roll-up. Click any row to drill in.
3. **Campaign Impact** (`/campaign/:id`). The heart of the thesis: **Before vs. After** (toggle the
   7/14/30 window and seasonal adjustment), **send-cohort vs. matched baseline**, week-over-week
   **cohort progression**, and a single gated interpretation sentence. Try a broad campaign like
   *Back to School* vs. the narrow *ELA Progress Checks* to see the min-N gate and the honest
   "needs a randomized holdout" state.
4. **Activity Timeline** (`/timeline`). Toggle metric lanes; campaign/release markers sit on a shared
   x-axis above them. **Campaign Calendar** (`/calendar`) shows the same activity month by month.
5. **Adoption & Engagement** (`/adoption`). The J1–J5 activation funnel, Day-7 (70%) and
   monthly-active (50%) OKR gauges, and feature adoption — clearly flagged as **modelled from
   aggregate data**.
6. **Segments** (`/segments`, PMM view). Switch the comparison dimension, watch small cells gate to
   *insufficient data*, and read the opportunity ranking (teachers below target, sized by population).

**What to look for.** The dashboard should never assert causation, always pair a raw change with a
seasonally-adjusted one, and hide underpowered cells rather than show a misleading number. The
synthetic data is deliberately mixed — one campaign with a real sustained lift, one high-CTR/no-impact,
and movements that are pure seasonality — so not every campaign looks good. If one did, the data would
be wrong.

> **Note:** figures are illustrative synthetic data and must not be quoted as Edwin performance.

## Layered architecture

The UI never computes a metric. It requests a computed result from `/analytics`, which reads from
`/data`. Replacing `/data` with a real adapter leaves `/analytics` and the UI untouched.

```
src/
  theme/       design tokens (placeholder for Phia)
  data/        seeded synthetic generators + typed schemas   ← swap point for real data
  analytics/   KPI calc, seasonal adjustment, min-N gating, attribution, insight rules
  state/       Zustand store: global filters, view mode
  components/  Layout shell, KPI cards, charts, tables, tooltips, states
  pages/       Overview · Marketing Performance · Campaign Impact · Timeline ·
               Adoption · Segments · Calendar
```

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build      # production build to dist/
```

## Deployment

Deployed on Vercel with GitHub auto-deploy: every push to `main` builds and deploys; branches get
preview URLs.
