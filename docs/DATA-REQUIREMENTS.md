# Edwin PMM Dashboard — Data Requirements

**Owner:** Justin Quan, Product Marketing Manager
**For:** Edwin data / BI team
**Status:** Request for a data availability assessment

> This document is generated from `src/data/file/schema.ts`, the same module that
> produces the dashboard's downloadable CSV templates and validates imports. It
> cannot drift from what the application actually accepts. Regenerate with
> `npm run gen:requirements`.

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
needs the email → `user_id` → `account_id` join, and it is what every
campaign-attribution view depends on. **Without Track B the dashboard still
works**, but every campaign panel reports insufficient sample rather than a
result.

Please treat Track A as the immediate ask and Track B as the thing to scope.

---

## The files

### `daily_facts.csv`

**Track A** · **Required** · One row per date × province × grade × subject.

Everything on the dashboard. Thirteen or more months of it makes the seasonal baseline possible, which is the whole value proposition.

| Column | Type | Required | Why the dashboard needs it |
|---|---|---|---|
| `date` | Date (`YYYY-MM-DD`) | **Yes** | ISO YYYY-MM-DD, interpreted as UTC. |
| `province` | Text | **Yes** | Must match the dimension vocabulary exactly. |
| `grade` | Text | **Yes** | Must match the dimension vocabulary exactly. |
| `subject` | Text | **Yes** | Must match the dimension vocabulary exactly. |
| `provisioned` | Integer | **Yes** | The denominator for the north-star active teacher rate, and the rescale for year-over-year comparison. Without it no rate on the dashboard is trustworthy. |
| `daily_active` | Integer | **Yes** | Drives the activity-volume gate that stops low-volume windows being compared. |
| `wau` | Integer | **Yes** | Distinct teachers active in a rolling 7 days. The north-star numerator. |
| `resource_opens` | Integer | No | The default engagement metric for campaign impact. |
| `classes_created` | Integer | No | Half of the adoption 'aha'. |
| `assignments_created` | Integer | No | The other half of the adoption 'aha'. |
| `aha_users` | Integer | No | Distinct teachers who created a class OR an assignment. Not derivable by adding the two columns above — the same teacher may do both. |
| `retention_w4` | Decimal 0–1 | No | A rate between 0 and 1, not a count. Share of a start cohort still active four weeks later. |

Example row:

```csv
date,province,grade,subject,provisioned,daily_active,wau,resource_opens,classes_created,assignments_created,aha_users,retention_w4
2025-09-02,ON,Primary (1–3),Mathematics,2145,912,1404,3388,18,310,486,0.51
```

### `campaigns.csv`

**Track A** · **Required** · One row per campaign.

Campaign markers, channel metrics, and every attribution view.

| Column | Type | Required | Why the dashboard needs it |
|---|---|---|---|
| `campaign_id` | Text | **Yes** | Stable key, also used to join campaign_reach.csv. |
| `name` | Text | **Yes** | Display name. |
| `type` | Text | **Yes** | Groups campaigns by activity type; drives marker colour. |
| `channel` | Text | **Yes** | Groups the channel roll-up. |
| `launch_date` | Date (`YYYY-MM-DD`) | **Yes** | Anchors every before/after window. |
| `audience` | Text | **Yes** | Human description shown on the drill-down. |
| `sends` | Integer | **Yes** | Denominator for CTR. |
| `opens` | Integer | No | Leave blank for channels with no open concept — in-app notifications and release notes. A blank suppresses CTOR rather than reporting a meaningless one. |
| `clicks` | Integer | **Yes** | Numerator for CTR. |
| `objective_metric` | Enum | **Yes** | One of: wau, resourceOpens, assignmentsCreated, classesCreated, ahaUsers. The metric the campaign was authored to move, declared before send. This replaces picking each campaign's best-looking result after the fact. |
| `target_province` | Pipe-delimited list | No | Pipe-delimited. Blank means all. |
| `target_grade` | Pipe-delimited list | No | Pipe-delimited. Blank means all. |
| `target_subject` | Pipe-delimited list | No | Pipe-delimited. Blank means all. |

Example row:

```csv
campaign_id,name,type,channel,launch_date,audience,sends,opens,clicks,objective_metric,target_province,target_grade,target_subject
c-bts,Back to School 2026 — Ready Day One,Pardot email,Pardot email,2026-08-10,All teachers,27800,13344,2613,wau,,,
```

### `campaign_reach.csv`

**Track B** · Optional · One row per campaign × province × grade × subject.

Distinct teachers actually reached. Without it every campaign view is suppressed for lack of a sample size — this is the table that needs the email-to-user_id join.

| Column | Type | Required | Why the dashboard needs it |
|---|---|---|---|
| `campaign_id` | Text | **Yes** | Joins to campaigns.csv. |
| `province` | Text | **Yes** | Segment key. |
| `grade` | Text | **Yes** | Segment key. |
| `subject` | Text | **Yes** | Segment key. |
| `reached_teachers` | Integer | **Yes** | Distinct teachers reached by this campaign in this cell. Counts of distinct people, so they cannot be summed across campaigns without double-counting anyone reached by two. |

Example row:

```csv
campaign_id,province,grade,subject,reached_teachers
c-bts,ON,Primary (1–3),Mathematics,1820
```

### `releases.csv`

**Track A** · Optional · One row per product release.

Release markers on the trend and timeline charts. Display only — no metric depends on it.

| Column | Type | Required | Why the dashboard needs it |
|---|---|---|---|
| `date` | Date (`YYYY-MM-DD`) | **Yes** | ISO YYYY-MM-DD. |
| `name` | Text | **Yes** | Release label. |

Example row:

```csv
date,name
2026-08-24,Edwin Teaching System live
```


---

## Three things that will otherwise bite us

These are the questions most likely to produce data that looks right and is
wrong. Worth settling before anyone writes a query.

### 1. Distinct-teacher counts need two grains

A real teacher can teach two subjects, or span grade bands. That means they
belong to more than one segment cell, and **counts of distinct people cannot be
added across cells** — summing them counts that teacher twice.

The dashboard currently sums `wau` across the cells in the selected segment,
which is correct only if each teacher sits in exactly one cell. So we need
either:

- **(preferred)** per-cell counts *and* pre-deduplicated totals at each rollup
  level — province, grade, subject, and all-up; or
- a rule assigning each teacher a single primary cell, stated explicitly, so we
  can caveat the segment figures accordingly.

Additive metrics (`resource_opens`, `assignments_created`) are unaffected.

### 2. Reach cannot be de-duplicated after the fact

`campaign_reach.csv` gives distinct teachers per campaign per cell. Those are
counts of people, so adding two campaigns' reach double-counts anyone who got
both. The dashboard needs a **union** across a set of campaigns for its channel
roll-up.

Per-campaign counts cannot produce that union. Either supply a pre-computed
distinct count per campaign *set*, or tell us and we will label the roll-up as
possibly double-counting.

### 3. Provisioned seats may not exist per segment

`provisioned` is the denominator for the north-star active-teacher rate and the
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
| History depth | **374 days** (364-day year-over-year lag + smoothing + one window) | No seasonal baseline. Every adjusted figure reports unavailable and the dashboard shows raw levels only — which for K-12 means September always looks like a triumph and July always like a collapse. This is the single most important number in this document. |
| Minimum sample | 300 exposed teachers | Results below this are suppressed rather than shown. |
| Minimum activity | 400 mean daily-active teachers per comparison window | Low-volume windows are reported as insufficient rather than compared. |
| Date format | ISO `YYYY-MM-DD`, UTC | Rows with any other format are rejected. Excel commonly writes `DD/MM/YYYY`. |
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

1. Does a reliable email → `user_id` → `account_id` mapping exist today, and
   how lossy is it? (Gates all of Track B.)
2. Can Pardot deliver per-user activity with timestamps, joined to `user_id`?
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
5% floor and 1.96 times its own standard error — so a quiet
window raises its own bar rather than producing a false positive. The dashboard
is deliberately quiet: it suppresses more than it reports. That is the intended
behaviour, and it is why the data quality questions above matter more than the
volume of data.
