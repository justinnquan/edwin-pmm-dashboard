# Edwin PMM Dashboard — Handoff V2

**Owner:** Justin Quan, Product Marketing Manager, Nelson Education
**Covers:** the working session of 21–22 September 2026
**Companion to:** `HANDOFF.md`

---

## What this document is

`HANDOFF.md` describes the project **as it stands** — architecture, files, metrics, what to ask the BI team for. It is the reference doc and it is current; read it first if you are new.

This document is the **record of how it got there**: what was attempted, what shipped, what had to be thrown away and redone, and what was discovered along the way. It exists because several of this session's findings were only visible by *running* the thing, and the reasoning behind them is worth keeping even after the code has moved on.

Ten commits, `36009e5` → `631708e`. **56 files changed, ~5,600 insertions.** Nineteen new files.

---

## Where the project stood at the start

The handoff at the time said: *"Prototype complete on synthetic data. Seven pages built. Statistical fixes pending."*

Three of those four claims were wrong or stale.

1. **The statistical fixes were not pending.** They were fully implemented in the working tree, passing, and **uncommitted** — so the live Vercel site had been serving the old build with its false positives the entire time.
2. **`src/data/` was not a swap point.** The PRD and handoff both claimed real data could replace it without touching anything above. There was no interface to replace.
3. **The methodology copy described a method the code no longer ran**, and in one place directly contradicted it.

Only "seven pages built" held up.

---

## The arc, in order

| Commit | What it did |
|---|---|
| `36009e5` | Committed and pushed the statistical fixes that were sitting uncommitted |
| `efdab92` | Refreshed HANDOFF; recorded the real-data blockers nobody had written down |
| `13b075e` | Made the dashboard describe the method it actually runs; fixed two verdict bugs |
| `833a4ef` | Built the `DataSource` seam the PRD had always claimed existed |
| `5bb14df` | CSV import with a validation report; round-trip test |
| `f416696` | Generated `docs/DATA-REQUIREMENTS.md` from the CSV contract |
| `c0860f1` | Brought HANDOFF and README up to date |
| `54860d8` | Loaded the real 25/26 exports — markdown table and Excel workbook |
| `32743a5` | Stopped the last surfaces rendering zeros for metrics that don't exist |
| `631708e` | Rewrote the BI ask around what the real data revealed |

---

## What shipped

### 1. The statistical fixes went live

False-positive rate **22% → 0.0%** at the 7-day window. The method had been calling a zero-effect campaign "material" roughly one time in five.

### 2. The data seam, for real

`DataSource` in `src/data/schema.ts`, reached through `src()` in `src/data/source.ts`. Three implementations now exist: the seeded generator, a CSV/row loader, and the real Edwin exports routed through the same loader.

`PublicCampaign` structurally omits `effects`, so reading the generator's answer key above `/data` is a **compile error** rather than something review has to catch.

### 3. The barriers became mechanical

`npm run check:layers` fails the build if anything under `analytics`, `components`, `pages`, `state` or `lib` imports a generator module. The project had asserted this in prose for its whole life and the seat curve had leaked into six files anyway.

### 4. Real data loads

Both of Justin's actual files, in the formats he keeps them:

- **`Edwin Metrics 25-26 School Year.md`** — an Obsidian pipe table. 48 weeks, Aug 2025 → Jun 2026.
- **`Marketing Communications Metrics.xlsx`** — 67 campaigns across Pardot, YesWare and in-app notifications.

No conversion step, because a monthly re-keying step is one that eventually gets skipped.

### 5. `Coverage` started gating computation

It previously had exactly three consumers, all cosmetic, and `coverage.metrics` was written by both sources and **read by nothing**. It now drives whether rates are computed, whether the rescale runs, whether adjusted figures exist, and whether an uncertainty band is reported.

### 6. Documentation that cannot drift

`docs/DATA-REQUIREMENTS.md` is generated from `src/data/file/schema.ts` — the same module that produces the download templates and validates imports. Change a column and the spec changes with it.

---

## What we tried that didn't work

Kept because each one cost real time and each would be easy to repeat.

### The layer check silently passed everything

The first version of `scripts/check-layers.ts` reported success on a codebase with a deliberately injected violation. Cause: it resolved the repo root with `new URL("..", import.meta.url).pathname`, which leaves the spaces in `OneDrive - Nelson Education Ltd` percent-encoded. The directory walk threw, and the `try { } catch { continue }` around it swallowed the error and moved on.

**Two lessons, both encoded in the file now.** A guarded directory that cannot be read must fail loudly rather than be skipped, and the script counts the files it scanned and fails at zero. It was caught only because the violation was injected deliberately to test it — a check that has never been seen to fail is not a check.

### `compileTarget` created an import cycle

Putting it in `synthetic.ts` meant `campaigns.ts` imported `synthetic.ts` while `synthetic.ts` imported `campaigns.ts`. Under `tsx` this surfaced as `TypeError: __name is not a function` from inside an unrelated function — a genuinely misleading error. Moved to `src/data/target.ts`, which both sides can import.

### Parsing the workbook, twice

The first cell regex, `<c ...>(.*?)</c>`, paired a self-closing `<c r="A4" s="116"/>` with the *next* cell's closing tag. Every value shifted one column left and every `t="s"` attribute was read from the wrong cell — so text columns rendered as small integers that looked like plausible data. No error, just wrong numbers.

The first run also hung for over two minutes: running that regex across a 17.9 MB sheet backtracks. Splitting on `</row>` first and matching within each chunk fixed it.

### Scanning for the metric label left to right

The workbook stacks rows vertically — a campaign header row, then metric-name/value rows beneath it. Scanning each row left to right for a label found the *channel* first and stopped, so no campaign ever acquired a delivered count and zero campaigns parsed. The label/value pair is always the **last** two populated cells; scanning from the right works on both row types.

### ESLint for the import barrier

The plan called for a `no-restricted-imports` rule. Installing an ESLint toolchain for a single rule, in a repo whose owner is not a full-time engineer, was disproportionate. A 90-line script does the same job, runs in the same place, and has no configuration to drift.

### Rejected designs for the seam

- **Threading a `DataSource` parameter** — ~25 signatures and ~80 call sites, and every future edit has to remember to pass it.
- **React context** — impossible. The analytics functions are plain functions, not hooks, and `scripts/null-test.ts` runs them in Node with no React at all.
- **Zustand holding the data** — works, but couples analytics to the state library and invites someone to put a computed metric in the store.

A module singleton won: mechanical diff, no signature churn, one file to read to answer "where does the data come from".

---

## Bugs found only by looking at the running app

A theme worth naming. Typecheck, build and the null test were all green for every one of these.

### A zero-effect campaign was labelled "sustained"

`sustainedVerdict` never received the P0 uncertainty fix. It tested weekly values against the flat 5% floor and ignored the standard error entirely. Summer Prep — **injected truth zero**, and correctly gated as *not material* by `campaignImpact` at ±19.3% SE — was labelled "sustained" and told the reader *"The lift has held week over week."*

The durability verdict was making an affirmative claim about a campaign the rest of the system had already dismissed.

### A real lift was labelled a one-week spike

Report Card held 12–20% for **six consecutive weeks** before fading, and read "one-week spike". That is the original rule's flaw mirrored: a real lift that decays is *guaranteed* to read as a spike the longer you observe it. Added a "faded" verdict.

### Levels rendered with the signed formatter

A 16% active rate displayed as **"+16.0%"** — reading as a 16% *increase*. Added `pctAbs` for levels and thresholds; only changes keep their sign.

### The footer called real Edwin numbers illustrative

Once real data could load, *"Prototype on seeded synthetic data. Figures are illustrative"* became the most dangerous text in the app — a caveat people learn to ignore, sitting under genuine figures. Provenance is now derived from the active source.

### CTOR of 98,189%

One campaign's sheet layout paired the label "Total HTML Opens" with the value from the adjacent "HTML Open Rate" row, so `opens` became 0.287 against 6,247 sends. Counts are now validated as non-negative integers within the population, and a click-to-open ratio above 1 is suppressed as the impossibility it is.

---

## Notable discoveries

### The synthetic seat curve was the denominator of everything

`provisioned()` in `calendar.ts` is a hardcoded piecewise ramp — pure generator ground truth — and it was imported by five analytics files and one page. **Every rate on the dashboard, including the north-star and every seasonal baseline rescale, divided by a fabricated curve.** This was not recorded in any document.

### A cumulative login count is not a denominator

The single most consequential finding of the session.

`Total Logged-in Teachers` rises monotonically, **63 → 10,220** across the year, because it counts everyone who has ever logged in and never sheds anyone. As a denominator it produces a rate that falls while the product grows: engagement rose **37%** between September and April while that rate fell **11 points**.

Worse, the year-over-year rescale multiplies the prior-year baseline by that column's growth. Left alone it would set this September's expectation at roughly **4,100 weekly active against last September's actual of 2,018** — every week of the new school year rendering as a large decline that did not happen.

The loader now detects the pattern from the data rather than trusting a column name: a series that never falls and grows steeply is a running total.

### The activation funnel invented its own numbers

`adoption.ts` clamped missing data into floors — `resourceConv → 0.70`, `classReach → 0.02`, `assignConv → 0.35` — and rendered them as measured conversions with no dash and no gate. On a source with no event data the funnel drew three invented constants. This was the most misleading surface in the application.

The clamps remain, because they are reasonable bounds when the underlying events *do* exist. The fix was an early return: `activationFunnel` now checks coverage first and returns an explicit unavailable state naming the missing metric, so the clamps are never reached with nothing to clamp.

### The real seasonal curve differs from the modelled one

Comparing the real weekly series against the synthetic seasonal model:

| Week | Real | Model assumed | |
|---|---|---|---|
| Dec 21 | **2%** | 33% | holiday collapse far deeper |
| Mar 15 | **17%** | 57% | March break not modelled at all |
| Jan 4 | **79%** | 40% | January snaps back instantly |
| Oct 26 | **40%** | 99% | an October dip the model lacks |

And structurally: **Edwin's real engagement peaks in April, not September.** The synthetic model assumed a mature product with a fall peak. Edwin went from 63 to 10,220 cumulative logged-in teachers in a year — the curve is dominated by adoption growth, not season.

Worth knowing before repeating *"your September spike is 90% calendar"* to leadership. It is still the right frame for a mature product; it is not yet the right frame for this one.

### In-app notifications are instrumented

The handoff's top listed risk was that they might not be. The workbook carries sessions and an engagement rate per notification, and holds empty *"LO Usage Before / After Notifications"* rows — Product Marketing had already framed the exact comparison this dashboard automates and had been unable to answer it by hand.

### Pardot's Total Delivered unblocks attribution

57 of 59 email campaigns carry it. That retires the assumption that campaign attribution had to wait on the identity spine — delivered counts are enough to clear the minimum-sample gate, labelled as *recipients* rather than verified teachers.

---

## Decisions taken, and why

| Decision | Choice | Reasoning |
|---|---|---|
| Cumulative logins as denominator | **Never** | Engagement grew 37% while the derived rate fell 11 points. A count and a growth curve are harder to misread in a leadership room than a percentage that falls when things go well. |
| Seasonal adjustment with one year | **Suppress entirely** | A raw before/after shown beside adjusted figures gets read as one. |
| Uncertainty band on weekly data | **Suppress** | Step expansion drives within-window variance to ~0; the band would print as a falsely precise "± 0.1%". |
| Weekly grain | **Accept now** | Value today beats a better shape later; the BI ask runs in parallel. |
| Campaign reach | **Total Delivered** | Obtainable today, labelled honestly as recipients. |
| Missing metrics | **Unavailable, never zero** | A zero renders as a finding. An absence must read as an absence. |
| The import barrier | **A script, not ESLint** | One rule does not justify a toolchain. |

---

## What is still true, and still outstanding

Full detail in `HANDOFF.md` → "Known issues that remain". In short:

1. **No prior year** — the one thing standing between the dashboard and its core method. 25/26 becomes the baseline the moment 26/27 usage exists.
2. **No licensed-seat count** — the north-star rate, both OKR gauges and the activation funnel stay dark.
3. **Gate constants are synthetic-calibrated** — `MIN_N = 300` and `MIN_DAILY_ACTIVE = 400` were set against a 24-cell, 28,400-seat synthetic population. Cannot be re-derived until there is enough real history to run the null test against a real campaign-free window.
4. **Distinct-teacher counts are summed across cells** — correct synthetically, wrong for a teacher who spans two subjects. A data-request problem, not a code problem.
5. **Reach cannot be de-duplicated** from per-campaign counts.
6. **Two components match `CampaignImpact` states with `===` chains** rather than exhaustive switches, so a new state would compile and render nothing.

---

## Two things to understand before changing anything

**The null test is the contract.** `npm run null-test` produces byte-stable output from a seeded generator. It stayed byte-identical through a 30-file data-layer refactor, a coverage-gating pass and the whole real-data build — which is the only reason those were safe to do in single passes. If a diff appears, behaviour changed. Capture it before, compare after.

**Look at the running app.** Every bug in the "found only by looking" section above passed typecheck, build and the null test. The verdict labelling a zero-effect campaign "sustained", the funnel inventing 70/2/35, the footer calling real numbers illustrative — none of those are type errors or arithmetic errors. They are things the software confidently said that were not true, and the only way to find them was to read what it rendered.

---

## Verification, end to end

| Command | What it proves |
|---|---|
| `npm run typecheck` | Clean TypeScript |
| `npm run check:layers` | 36 files, no generator imports above `/data` — and verified to fail on an injected violation |
| `npm run null-test` | 0.0% false positives at 7 and 14 days; byte-stable |
| `npm run export-sample` | The file adapter reproduces the synthetic source within 0.113% — integer rounding |
| Browser | All eight pages walked on both the synthetic source and the real Edwin export, on localhost and on the live Vercel deployment |

The real import was verified end to end: both files loaded through the UI, swapped into the dashboard, survived a full page reload, and rendered with every unavailable figure naming the data that would restore it.
