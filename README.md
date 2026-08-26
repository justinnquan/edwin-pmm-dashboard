# Edwin Product Marketing Dashboard

A SaaS-style Product Marketing analytics dashboard for Nelson Education's **Edwin**, connecting
lifecycle marketing activity to teacher behaviour inside the product. Prototype on **seeded synthetic
data** behind a swappable data layer.

> Figures are illustrative and must not be quoted as Edwin performance. Design tokens are a
> placeholder pending the Phia system.

## Status

Phase C — **Executive Overview** — implemented. See `docs/` for the full PRD and prototype plan.

## Stack

React 18 · TypeScript · Vite · Tailwind v4 · Recharts · Zustand

## Layered architecture

The UI never computes a metric. It requests a computed result from `/analytics`, which reads from
`/data`. Replacing `/data` with a real adapter leaves `/analytics` and the UI untouched.

```
src/
  theme/       design tokens (placeholder for Phia)
  data/        seeded synthetic generators + typed schemas   ← swap point for real data
  analytics/   KPI calc, seasonal adjustment, min-N gating, insight rules
  state/        Zustand store: global filters, view mode, selected campaign
  components/   presentational KPI cards, charts, tables, states
  pages/        ExecutiveOverview
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
