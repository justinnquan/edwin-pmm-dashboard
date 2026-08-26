# Edwin Product Marketing Dashboard
## Product Requirements Document and Prototype Plan

**Prepared for:** Nelson Education, Product Marketing
**Status:** Draft for internal review (pre-build)
**Purpose:** Define the concept, requirements, data model, and prototype plan for a SaaS-style Product Marketing analytics dashboard that connects lifecycle marketing activity to teacher behaviour inside Edwin.

A one-line test is applied to every element in this document: *Does this help Product Marketing understand whether our marketing activity is changing teacher behaviour inside Edwin?* If not, it is deprioritized.

---

# Phase 1 - Critical Assessment

## What is strong about the concept

The core insight is correct and genuinely differentiated. Most marketing dashboards stop at open and click rates. Tying those to downstream product behaviour (login, resource opens, classes, assignments, assessments) is the right ambition, and it is exactly the story leadership will want when Edwin's SaaS narrative matures. The lifecycle spine (awareness, engagement, activation, adoption, retention) is sound and maps cleanly onto Edwin's real onboarding journeys.

The insistence on associative rather than causal language is the right instinct and is what will keep this dashboard credible in a room full of skeptical stakeholders. The demand for honest empty and "insufficient data" states is unusually mature for a v1 brief and should be protected.

The layered architecture requirement (data, analytics, presentation) is the right call and will make the eventual swap from synthetic to real data far less painful.

## Assumptions that are risky

**1. Exposed vs. unexposed as an opener-vs-non-opener comparison is the highest-risk idea in the brief.** Opening an email is itself a marker of engagement. Teachers who open campaigns are systematically more motivated than those who don't, and that same motivation independently drives Edwin usage. Comparing the two groups measures pre-existing engagement, not campaign effect, and it biases every result upward. Left uncorrected, this makes every campaign look successful, which is precisely how a dashboard loses trust in its first leadership review.

- *Recommendation:* For MVP, compare the **full send cohort** (everyone targeted, regardless of open) against a **matched baseline** of comparable non-recipients or the send cohort's own pre-period. Reserve true exposed/unexposed for a future state that uses randomized holdout groups designed into campaigns before send.

**2. Seasonality is treated as background noise when it is actually the dominant signal.** K-12 usage is governed by the school calendar: a September surge, holiday troughs, exam-period spikes, a summer collapse. Any before/after window that straddles a calendar boundary is close to meaningless. A Back-to-School campaign launched in early September will "cause" a WAU jump that would have happened with no campaign at all.

- *Recommendation:* Every trend and every before/after comparison carries a **seasonal or year-over-year baseline**. This is a v1 requirement, not an enhancement. Without it, the dashboard systematically overstates fall campaigns and understates summer ones.

**3. The identity join is assumed to exist and is treated as trivial. It is neither.** Pardot is keyed on email address. Edwin product events are keyed on user_id. In-app notifications may be keyed on user_id already. Release-notes engagement may be keyed on nothing reliable. The entire "marketing to product behaviour" thesis depends on a dependable email to user_id to account_id mapping, and that mapping is exactly what is easiest to be missing or lossy in practice (personal vs. board email, shared logins, delayed provisioning).

- *Recommendation:* Treat the identity spine as the number-one data dependency. See Open Questions.

**4. The Salesforce dependency is a moving target.** The brief lists Salesforce as a data source. Edwin's own Modular Platform roadmap explicitly moves provisioning **off** Salesforce across FY27 (≥85% of new boards provisioned with no Salesforce/manual ops, legacy Salesforce provisioning disabled for standard paths). Any account and identity model built against Salesforce today will need to follow provisioning into the new Admin Console.

- *Recommendation:* Abstract account and identity behind a source-agnostic interface so the underlying system can change without rewriting the analytics layer.

**5. Marketing is implicitly credited with acquisition, which is not PMM's lever.** In K-12, boards purchase and provision seats. Teacher-facing lifecycle marketing almost never creates net-new accounts. Its real job is moving provisioned-but-dormant teachers through first login, first resource, first class, and keeping them returning. Framing impact as "new active users" invites a comparison PMM will always lose and misrepresents where the value actually is.

- *Recommendation:* Frame the north-star as **activation and adoption depth within the provisioned population**, not acquisition. Net-new accounts belongs to Sales and procurement, and should be shown as context, not credited to campaigns.

**6. Automated insight generation can quietly manufacture false signals.** Free-text insight sentences ("this campaign was followed by a 14% increase") are dangerous if generated loosely. They will eventually narrate noise, and one visibly wrong claim in front of leadership undoes months of trust.

- *Recommendation:* Insights are **deterministic and rule-based** in the prototype. A statement only renders when the observed change clears a materiality threshold, the sample clears a minimum-N gate, and the comparison is seasonally adjusted. No free-form language model narration in v1.

**7. Small-N is guaranteed once segmentation meets attribution windows.** Province x grade x subject x campaign x 7-day window collapses to tiny cells. Most of these will be underpowered, and unguarded they will read as trends.

- *Recommendation:* A hard, programmatic minimum-N gate that renders the "insufficient data" state automatically. This is enforced in the analytics layer, not left to the reader.

## What data gaps matter most

In priority order:

1. **User-level campaign exposure with timestamps** joined to Edwin user_id. Without this, none of the association analysis works and you are left with aggregate correlation only.
2. **A reliable identity spine** (email ↔ user_id ↔ account_id), stable across the Salesforce-to-Admin-Console migration.
3. **A provisioned-population denominator.** To report activation rate you need to know how many teachers *could* have been active, per account, per period. This is the denominator behind the 50% MAU and Day-7 activation OKRs.
4. **Sufficient historical depth for cohorts.** Longitudinal retention curves need many weeks of consistent history. If instrumentation is recent, cohort retention is a future-state metric, not an MVP one.
5. **A seasonal baseline series**, ideally year-over-year, to separate calendar effects from campaign effects.
6. **Account/board dimension in a usable form.** Likely partial today. Should be an operating view for PMM, never a leadership headline, until coverage is verified.

## What I would change

- Anchor the lifecycle model to Edwin's **real funnel** (the J1 Invitation through J5 Activate onboarding journeys, Day-7 activation ≥70%, 50% monthly active on any LMS feature) instead of a generic funnel. This makes the dashboard speak the team's language and ties directly to company OKRs.
- Cut the executive view to a **north-star plus four** headline KPIs. Eight cards is a wall, not a 30-second read.
- Make **seasonal baseline** and **minimum-N gating** first-class, non-optional features.
- Replace opener-vs-non-opener with send-cohort-vs-baseline for MVP.
- Add a persistent, visible **methodology and data-freshness strip** so caveats travel with the numbers rather than hiding in a tooltip.

## MVP vs. future state

**MVP (defensible with realistic current data):**
- Executive Overview with north-star + 4 KPIs and a Marketing Impact panel
- Campaign Performance table (channel metrics + associated product change)
- Marketing Activity Timeline overlaying campaigns and product releases against product metrics, with seasonal baseline
- Campaign detail with Before vs. After (seasonally adjusted, send-cohort)
- Adoption and Engagement view anchored to the activation funnel
- Segmentation on dimensions confirmed available (province, grade, subject, role)
- Deterministic "What changed" insights with materiality and N gating
- Honest empty, error, and insufficient-data states throughout

**Future state (needs improved instrumentation or deliberate experiment design):**
- True exposed vs. unexposed using pre-designed randomized holdouts
- Account/board-level attribution and operating views
- Longitudinal cohort retention curves with lifecycle-stage transitions
- Predictive churn and at-risk scoring
- Lifecycle scoring per user
- Causal experimentation framework (A/B holdouts as a standard campaign step)

---

# Phase 2 - Product Requirements Document

## Executive Summary

The Edwin Product Marketing Dashboard is a SaaS-style analytics product that places lifecycle marketing activity and Edwin product behaviour on the same timeline, so Product Marketing and leadership can see not just what happened, but whether marketing activity coincided with meaningful changes in teacher behaviour. It answers one central question: *Are our lifecycle efforts moving teachers from awareness to activation to adoption to retention, and where should we act next?* It is explicit about association rather than causation, transparent about data limitations, and organized around Edwin's real activation funnel and company OKRs.

## Problem Statement

Today marketing performance and product usage live in separate reporting streams. Marketing can report a campaign's click rate; product analytics can report a WAU change. Neither can answer whether the campaign coincided with the change, for whom, in which product behaviours, and whether it lasted. Without a shared timeline and a consistent, honest attribution frame, PMM cannot diagnose declines, cannot demonstrate contribution to leadership, and cannot decide what to do next. This dashboard closes that gap.

## Goals

1. Let leadership grasp Edwin health and marketing's apparent contribution within roughly 30 seconds.
2. Let PMM identify campaign-associated product changes and investigate them without leaving the dashboard.
3. Put marketing activity and product behaviour on one interactive timeline.
4. Enforce a transparent, explainable attribution frame that distinguishes association from causation.
5. Make data limitations visible rather than hidden.
6. Architect the prototype so synthetic data can be replaced by real data with minimal rework.

## Non-Goals (MVP)

- Proving causation or replacing controlled experimentation.
- Net-new account acquisition analysis (a Sales and procurement concern).
- Account/board-level attribution as a leadership headline.
- Predictive churn, lifecycle scoring, or recommendation engines.
- A production data pipeline. This is a prototype on synthetic data.
- A second, separate product for leadership. One product, progressive disclosure.

## Users

**Leadership (executive view).** Wants Edwin health, marketing activity, campaign-associated impact, major positive and negative changes, high-level adoption and retention. Time-poor, skeptical of vanity metrics, wants the one number that matters and a clear "so what."

**Product Marketing (operating view).** Wants campaign-level detail, before/after, send-cohort comparisons, segmentation, feature usage, and the ability to diagnose an underperforming metric down to the affected segment.

## Jobs To Be Done

1. Understand overall Edwin health at a glance.
2. Understand a single campaign's associated product impact.
3. Diagnose a decline down to segment, feature, and cohort.
4. Demonstrate marketing's apparent contribution to leadership.
5. Compare campaigns to learn what type of activity moves product behaviour.

## KPI Framework

Full per-KPI definitions, calculations, sources, visualizations, and limitations are in Phase 4. The prioritized hierarchy is:

1. **Activation and activity** (north-star + WAU)
2. **Adoption depth** (the "aha" behaviours: resource opens, class created, assignment created)
3. **Retention** (continued activity over time)

Marketing channel metrics (opens, clicks, CTR, CTOR) are inputs, not outcomes, and are always shown adjacent to the product behaviour they precede.

## Marketing Impact Framework

Four honest methods, each labeled with what it can and cannot claim:

- **Before vs. After (seasonally adjusted).** The send cohort's product behaviour in the pre-window vs. the post-window, indexed against a seasonal or year-over-year baseline. Default windows: 7, 14, 30 days. Labeled observational.
- **Send-cohort vs. matched baseline.** The targeted population against comparable non-recipients matched on prior activity and segment. The MVP stand-in for exposed/unexposed. Labeled quasi-experimental, association only.
- **Cohort progression.** Following the send cohort week over week to distinguish a one-week spike from a sustained shift. Requires sufficient history.
- **Exposed vs. unexposed with holdout (future).** True comparison only where a randomized holdout was designed into the campaign before send.

Every method carries an accessible methodology note stating that results indicate association, not proven causation, and a visible minimum-N gate.

## Information Architecture

See Phase 3.

## Data Model

See Phase 4.

## Segmentation Model

Dimensions are **data-driven**: a dimension appears as a filter only if the underlying data supports it at sufficient N. Confirmed-likely dimensions: province (ON/AB), grade band, subject, user role, new vs. existing. Provisional, pending data verification: account/board, cohort, individual grade. Unsupported dimensions are surfaced in a "future data requirements" note, never as empty decorative filters.

## User Flows

1. **Leadership opens the dashboard.** Lands on Executive Overview. Reads north-star + 4 KPIs with period comparison, scans the Marketing Impact panel, notes any flagged major change. Done in under a minute.
2. **PMM investigates a decline.** Sees WAU down on the overview, clicks into Adoption and Engagement, filters to the affected segment, checks the activity timeline for coinciding or absent campaigns, identifies whether the drop is concentrated (e.g., teachers who never created a class).
3. **PMM investigates a successful campaign.** Opens the campaign from the timeline or table, reads channel metrics, before/after, send-cohort comparison, and cohort progression, reads the deterministic insight, checks the sustained-change indicator.
4. **PMM compares campaigns.** Uses the campaign table sorted by associated impact, compares two campaigns' downstream product change side by side to learn which activity type moves behaviour.
5. **PMM investigates a segment.** Applies province/grade/subject filters globally and watches every view recompute, with min-N gating hiding underpowered cells.
6. **PMM drills from campaign to product impact.** From a campaign marker on the timeline directly into that campaign's product-impact detail.

## UX Requirements

- **Navigation:** left rail with the primary sections; a view toggle (Leadership / Product Marketing) driving progressive disclosure of the same data.
- **Global filters:** date range, province, grade, subject, role, campaign type, campaign, feature, cohort. Only rendered when supported by data.
- **Interactions:** click a campaign marker to open detail; hover for tooltips; toggle overlay metrics on the timeline; switch attribution windows (7/14/30).
- **Drilldowns:** overview KPI to its detail view; campaign to product impact; segment to affected cohort.
- **Empty / error / insufficient-data states:** explicit and instructive, stating what additional tracking would enable the metric.
- **Methodology and freshness strip:** persistent, showing data-as-of date and a one-tap methodology explainer.
- **Tooltips:** definition, calculation, and limitation for every KPI.

## Visualization Specification

See Phase 5. Principle: choose the visualization that answers the question, never for decoration.

## Mock Data Specification

See Phase 4 and Phase 5. The synthetic dataset must contain honest, mixed patterns: a campaign with a real sustained lift, a campaign with high CTR but no product impact, a campaign with modest CTR but strong downstream adoption, campaigns with no meaningful impact, and product movements that occur with no campaign at all (seasonal). If every campaign looks good, the data is wrong.

## MVP vs. Future State

See Phase 1.

## Success Criteria

- Leadership can state Edwin's health and marketing's apparent contribution within 30 seconds of opening the overview.
- PMM can identify a campaign-associated product change and open its detail without leaving the dashboard.
- Marketing activity is visually comparable with product behaviour on a shared, seasonally-baselined timeline.
- The dashboard never asserts causation and always distinguishes association from proof.
- Underpowered cells render an insufficient-data state rather than a misleading number.
- Swapping synthetic data for a real source touches only the data layer.

---

# Phase 3 - Information Architecture

```
Edwin Product Marketing Dashboard
│
├── View toggle:  [ Leadership ]  [ Product Marketing ]    (progressive disclosure, same data)
├── Global filter bar:  Date range · Province · Grade · Subject · Role · Campaign type · Campaign · Feature · Cohort
├── Methodology + data-freshness strip  (persistent)
│
├── 01  Executive Overview          ← landing page
│     ├── North-star KPI  (active teachers as % of provisioned)
│     ├── 4 headline KPIs  (WAU · Adoption "aha" · Retention · Campaign-associated impact)
│     ├── Marketing Impact panel  (last 30 days: campaigns, reach, associated changes)
│     ├── WAU trend with campaign + release markers and seasonal baseline
│     └── "What changed" insight strip  (deterministic, gated)
│
├── 02  Marketing Performance
│     ├── Campaign table  (metrics + associated product change, sortable)
│     ├── Channel roll-up  (email / in-app / release notes / onboarding / re-engagement)
│     └── Campaign comparison  (2-up downstream impact)
│
├── 03  Marketing Activity Timeline
│     ├── Activity lane  (campaign + product-release markers)
│     ├── Metric lanes  (selectable: WAU, logins, resource opens, classes, assignments, assessments, retention)
│     ├── Seasonal / YoY baseline overlay
│     └── Click marker → Campaign Impact
│
├── 04  Campaign Impact  (detail, reached from table or timeline)
│     ├── Campaign summary  (channel, audience, sends, opens, clicks, CTR, CTOR)
│     ├── Product impact  (WAU / login / resource / feature / retention change)
│     ├── Before vs. After  (7/14/30, seasonally adjusted)
│     ├── Send-cohort vs. matched baseline
│     ├── Cohort progression  (week over week)
│     └── Deterministic interpretation  (gated, caveated)
│
├── 05  Adoption & Engagement  (anchored to the activation funnel)
│     ├── Funnel:  Invited → First login → First resource → Class created → Assignment/Student invited  (J1–J5)
│     ├── Day-7 activation rate  vs. 70% target
│     ├── Monthly active on any LMS feature  vs. 50% target
│     ├── Feature adoption bars
│     └── Resource / classroom / assessment behaviour trends
│
├── 06  Segments  (PMM operating view)
│     ├── Segment comparison table  (province / grade / subject / role)
│     ├── "Where is the opportunity" ranking
│     └── Account/board operating view  (only if data supports; PMM-only, never leadership)
│
└── 07  Campaign Calendar
      ├── Calendar/timeline of campaigns  (date, type, channel, objective, audience)
      ├── Product events overlaid  (feature launches, releases, onboarding changes)
      └── Select campaign → Campaign Impact
```

Leadership view shows sections 01 and a simplified 03. Product Marketing view unlocks 02, 04, 05, 06, 07.

---

# Phase 4 - KPI and Data Model

## KPI framework (per-metric)

| KPI | Definition | Why it matters | Calculation | Source | Recommended viz | Limitations |
|---|---|---|---|---|---|---|
| **Active teacher rate (north-star)** | Active teachers as a share of provisioned teachers, per period | PMM's true lever is activating provisioned seats, and it ties to the 50% MAU OKR | active_teachers ÷ provisioned_teachers | Edwin activity + provisioned population | Big number + trend | Needs a reliable provisioned denominator |
| **WAU** | Distinct teachers with ≥1 meaningful action in a rolling 7 days | Core pulse of engagement | count(distinct user_id where event in week) | Edwin product events | Line with seasonal baseline | Highly seasonal; needs baseline to interpret |
| **Day-7 activation rate** | Share of newly invited teachers who reach a defined activation event within 7 days | Direct onboarding OKR (≥70%) | activated_within_7d ÷ invited_cohort | Edwin events + invite date | Cohort bar vs. target | Requires clean invite timestamps |
| **Adoption "aha" rate** | Share of active teachers who performed a high-value behaviour (resource opened, class created, or assignment created) | Distinguishes real value from mere login | count(users with aha event) ÷ active_users | Edwin product events | Bar / funnel step | "Aha" definition must be agreed and fixed |
| **Retention (Wn return)** | Share of a start cohort still active n weeks later | The durability test | active in week n ÷ cohort size | Edwin events | Cohort curve | Needs history depth; small-N risk |
| **Feature adoption** | Share of active teachers using a given feature in period | Shows which LMS features land | count(feature users) ÷ active_users | Edwin feature events | Horizontal bars | Feature instrumentation completeness varies |
| **Campaign channel metrics** | Sends, opens, clicks, CTR, CTOR, conversions where available | Inputs to the funnel | standard email math | Pardot / in-app | Table + sparkline | Open rates unreliable post-MPP; treat directionally |
| **Campaign-associated product change** | Change in a chosen product metric for the send cohort, pre vs. post, seasonally adjusted | The whole point of the dashboard | (post_rate − pre_rate) indexed to baseline | Joined marketing + product | Comparison card | Association only; confounded by seasonality and selection unless gated |

## Data model (entities and relationships)

```
Accounts ──1:many── Users ──1:many── ProductEvents
   │                   │
   │                   └──many:many── CampaignEvents ──many:1── Campaigns
   │
   └── (province, board, provisioned_seats, source_system)

IdentitySpine:  email ⇄ user_id ⇄ account_id      ← the critical join, source-agnostic
DailyMetrics:   derived aggregates (date × segment × metric)  ← precomputed for speed
SeasonalBaseline: metric × day-of-school-year (or YoY prior-period)  ← for adjustment
```

**Users:** user_id, role, province, grade, subject, account_id, created_date, invited_date, first_login_date, cohort.
**Accounts:** account_id, account_name, board, province, provisioned_seats, source_system (salesforce | admin_console).
**Campaigns:** campaign_id, name, type, channel, launch_date, end_date, audience, objective, holdout_flag.
**CampaignEvents:** campaign_id, user_id, exposure, open, click, conversion, timestamp.
**ProductEvents:** user_id, event_type, feature, timestamp. Event types: login, resource_open, class_created, student_invited, assignment_created, assessment_created, assessment_completed, feature_used.
**DailyMetrics:** date, segment_key, metric, value. **SeasonalBaseline:** metric, calendar_position, expected_value.

The identity spine and source_system field are deliberately abstracted so the Salesforce-to-Admin-Console provisioning migration does not ripple into the analytics or UI layers.

## Attribution frame (transparent, MVP)

```
Campaign exposure → Campaign engagement → Product behaviour → Adoption → Retention
                    windows: 7 / 14 / 30 days, seasonally adjusted, min-N gated
```

---

# Phase 5 - Mockup Specification

## 01 Executive Overview
- Row of 5 KPI cards: north-star (active teacher rate) enlarged, then WAU, Adoption "aha", Retention, Campaign-associated impact. Each with value, period delta, sparkline. The impact card carries a visible caveat chip.
- **Marketing Impact panel** ("Last 30 days"): campaigns launched, teachers reached, campaign-associated WAU / resource / feature change, each labeled associational, with a mini trend carrying campaign markers.
- **WAU trend chart**: line with campaign and release markers and a dashed seasonal-baseline series.
- **"What changed" strip**: up to three deterministic, gated insight chips (positive and negative).

## 02 Marketing Performance
- **Campaign table**: name, type, channel, launch date, audience, sends, opens, clicks, CTR, CTOR, associated product change, sustained indicator. Sortable by associated impact. Row click opens Campaign Impact.
- **Channel roll-up**: small multiples per channel.
- **Comparison**: pick two campaigns, see downstream product change side by side.

## 03 Marketing Activity Timeline
- Top **activity lane** with campaign markers (shape/colour by type) and product-release markers.
- Stacked, selectable **metric lanes** (WAU default) sharing one x-axis, each with its seasonal baseline.
- Window and metric toggles. Marker click routes to Campaign Impact. Explicit "no causality implied" note.

## 04 Campaign Impact
- **Summary** header (channel, audience, sends, opens, clicks, CTR, CTOR).
- **Product impact** cards (WAU / login / resource / feature / retention change).
- **Before vs. After**: two-column comparison card, window switcher, seasonal-adjustment toggle, observational label.
- **Send-cohort vs. matched baseline**: comparison card, association label, min-N gate.
- **Cohort progression**: week-over-week small line, spike-vs-sustained call-out.
- **Interpretation**: one deterministic sentence, gated and caveated.

## 05 Adoption & Engagement
- **Activation funnel** (Invited → First login → First resource → Class created → Assignment/Student invited), mapped to J1–J5, with drop-off between steps.
- **Day-7 activation** gauge vs. 70%; **monthly LMS-active** gauge vs. 50%.
- **Feature adoption** horizontal bars.
- Resource / classroom / assessment trend lines.

## 06 Segments
- **Segment comparison table** across province / grade / subject / role with per-segment WAU, adoption, retention, and campaign-associated change; min-N gated.
- **Opportunity ranking** (largest gaps to target).
- **Account/board operating view** only if data supports; clearly PMM-only.

## 07 Campaign Calendar
- Month/quarter calendar with campaign chips (type/channel/objective/audience) and overlaid product events. Chip click opens Campaign Impact.

## Global states
- Empty, loading, error, and insufficient-data states designed for every data-bearing component, each stating the additional tracking required.

---

# Phase 6 - Prototype Architecture (recommended stack)

**Recommendation for Claude Code:** React + TypeScript + Vite, Tailwind CSS themed by Phia design tokens, Recharts for standard charts with a thin custom SVG layer for the timeline, TanStack Table for tables, TanStack Router (or React Router) for routing, and Zustand for global filter/view state. Seeded synthetic data generated in a dedicated module.

Rationale: fast iteration and hot reload (Vite), type safety across the data contracts (TypeScript), reusable components and a mature charting ecosystem (React + Recharts), and a clean path to swap synthetic for real data. Tailwind themed via CSS variables lets Phia tokens drop in centrally rather than being scattered through components.

**Layered architecture (matching the "do not hard-code numbers" principle):**

```
/data          synthetic data generators (seeded) + typed schemas   ← swap point for real data
/analytics     KPI calculations, attribution, seasonal adjustment, min-N gating, insight rules
/state         Zustand stores: filters, view mode, selected campaign
/components     presentational KPI cards, charts, tables, timeline, states
/pages         Overview, Marketing Performance, Timeline, Campaign Impact, Adoption, Segments, Calendar
/theme         Phia tokens as CSS variables + Tailwind config
```

The UI never computes a metric. It requests a computed result from `/analytics`, which reads from `/data`. Replacing `/data` with a real adapter (Power BI / Edwin API) leaves `/analytics` and the UI untouched, provided the typed schema is honoured. All gating and caveating lives in `/analytics` so no component can accidentally render an ungated number.

---

# Phase 7 - Build Plan

**Phase A - Foundations.** Scaffold Vite/React/TS, Tailwind + Phia token file, routing, layout shell (left rail, view toggle, global filter bar, methodology strip). Define typed data schemas.

**Phase B - Synthetic data + analytics core.** Seeded generators producing honest mixed patterns (including null-impact campaigns and seasonal-only movements). KPI calculations, seasonal adjustment, min-N gating, before/after, send-cohort baseline, deterministic insight rules.

**Phase C - Executive Overview.** KPI cards, Marketing Impact panel, WAU trend with baseline and markers, "what changed" strip. This is the socialization centerpiece; build it first among the pages.

**Phase D - Marketing Performance + Campaign Impact.** Campaign table, channel roll-up, comparison, and the full campaign-impact drilldown with all attribution views and states.

**Phase E - Timeline + Calendar.** Interactive multi-lane timeline with baseline overlay and marker routing; campaign calendar with product-event overlay.

**Phase F - Adoption + Segments.** Activation funnel and OKR gauges; segment comparison with gating; account/board view behind a data-availability check.

**Phase G - Polish.** Empty/error/insufficient-data states everywhere, tooltips, methodology explainer, responsive pass, accessibility pass.

---

# Phase 8 - Open Questions (genuine blockers only)

1. **Identity join:** does a reliable email ↔ user_id ↔ account_id mapping exist today, and how lossy is it (personal vs. board email, shared logins)?
2. **User-level exposure timestamps:** can Pardot and in-app notification data be delivered at the user level with timestamps, joined to user_id? If not, association analysis is aggregate-only.
3. **Provisioned denominator:** can we get provisioned-teacher counts per account per period, to compute activation rate and the 50% MAU OKR?
4. **History depth:** how many weeks of consistent product-event history exist? This decides whether cohort retention curves are MVP or future.
5. **Holdouts:** is Pardot/campaign ops able to reserve a randomized holdout before send? This decides whether true exposed/unexposed is ever feasible.
6. **Phia tokens:** can we get the Phia design-token file (colours, type, spacing) to theme the prototype, so it matches rather than approximates?
7. **Account/board coverage:** for how many accounts is board-level data actually populated, given the Salesforce-to-Admin-Console migration in flight?
8. **"Aha" definition:** which single behaviour (or set) does PMM want to fix as the adoption "aha" for the north-star? Recommend "class created OR assignment created" as the strongest activation signal.

---

*Prepared as a pre-build planning document. No production code is included by design. The prototype should be built on synthetic data behind a swappable data layer, then socialized with Product Marketing and leadership before any real-data integration.*
