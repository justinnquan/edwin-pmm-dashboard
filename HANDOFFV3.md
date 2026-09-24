# Edwin PMM Dashboard — Handoff V3

**Owner:** Justin Quan, Product Marketing Manager, Nelson Education
**Covers:** the working sessions of 22–24 September 2026
**Companion to:** `HANDOFF.md` (the current state) and `HANDOFFV2.md` (21–22 Sept)

---

## What this document is

`HANDOFF.md` describes the project **as it stands**. This document is the **record of how it got there** over three days: what was asked for, what was decided and why, what shipped, what broke along the way, and what was only found by running the thing.

Six feature commits plus this documentation pass, `26b3c94` → `7c6eedc`. **49 files changed, ~3,200 insertions, ~470 deletions.** Version 0.1.0 → 0.3.0.

---

## Where the project stood at the start

HANDOFFV2 left the dashboard able to load the real 25/26 exports, but only into the tab that loaded them. Real data vanished when the tab closed, so no one else could see it; the site itself still booted on synthetic data. The README still described a synthetic-only prototype with "seven sections" and a "matched baseline".

---

## The arc, in order

| Commit | Date | What it did |
|---|---|---|
| `26b3c94` | 22 Sept | Sample / Live toggle; Live served from a private Vercel Blob behind a password; README rewritten. v0.2.0 |
| `3efe9ab` | 22 Sept | Accepted OIDC-connected Blob stores, which fixed "not configured" on a correctly set-up project |
| `587152b` | 23 Sept | School years, the dotted last-year line, new logins, a calendar date picker, "Compare before/after", years on every date. v0.3.0 |
| `9acaf4f` | 23 Sept | Data Import reorganised into collapsible routes; Manual data editor |
| `994d91e` | 23 Sept | The campaign sheet accepted as CSV; the cleaned campaign data published |
| `7c6eedc` | 24 Sept | Live moved to the left of the toggle; README counts corrected |

---

## What shipped

### 1. Live, for everyone with the password

- A **Live / Sample** toggle in the rail footer, replacing "Prototype · synthetic data / Phases C–G of 7". The build version shows beneath it.
- **Where the data lives.** The repository is public, so real data is kept in one **private Vercel Blob** (`live/edwin-live.json`). `api/live.ts` reads it for the shared **view** password and replaces it for a separate **publish** password.
- **No synthetic data under a Live label.** Until real data has loaded, `LiveGate` stands in for every page (locked, loading, nothing published, or unavailable). The filter bar and methodology strip are hidden too, so nothing describes the synthetic source underneath as Live.
- **`/data` gained Preview and Publish.** Preview is today's tab-only swap; Publish replaces what Live shows for everyone.

### 2. School years and the dotted line

- A **School year** dropdown (Aug 1 → Jun 30) scopes every page. It defaults to the current year, 2026/27.
- The **dotted line** is the same week one school year earlier, drawn on the Overview trend, Timeline lanes, Adoption trends, and a new before/after chart on each campaign. It is drawn on its own where this year has no data, so 2026/27 shows 25/26's shape up to today's matching week.
- An empty school year says so. Each KPI reads "No 26/27 data yet" with the same week last year beneath it (weekly active teachers: 2,024), and "What changed" gives the same message.
- KPIs report as of the **end of the selected dates** (`evalDate()`), not always the end of the data.

### 3. New logged-in teachers

- The weekly difference of the cumulative `Total Logged-in Teachers` column, drawn as a second line on the Overview trend with its own right-hand axis, in both views. On the real file the week of Aug 31 2025 is **+1,398**.
- Sample gets a deterministic series that **draws no random numbers**, so the null test stayed byte-identical.

### 4. Friendlier dates

- A **Dates** button opens presets (Last 30 days, Last 90 days, Whole school year) beside a two-month calendar. Days the dashboard cannot show — before the data, after a past year's last published day, after today — are disabled.
- "Attribution window 7/14/30" became **"Compare before/after · 1 week / 2 weeks / 30 days"**, with a hover hint.
- Every date carries its year: "Sep 10, 2025" everywhere, "Sep 10 '25" on chart axes.

### 5. Data Import reorganised, and a manual editor

- Three **collapsible** routes: **Load your Edwin exports** (open by default), **Manual data**, **Load generic CSV**. Closing a section keeps what is in it.
- **Manual data** loads the rows Live holds — weekly usage, campaigns, releases — for changing, adding or removing by hand. Changed cells are outlined, new rows tinted, bad values block validation, and changes can be discarded. The result goes through the same validation report and Preview / Publish as a file.

### 6. The cleaned campaign data

- The Edwin route now reads the campaign sheet **saved as CSV** as well as `.xlsx`.
- Justin's `Marketing Communications Metrics_Cleaned.csv` was checked against what Live held. With his corrections applied, it was published: **57 Pardot / YesWare campaigns**, replacing the previous 67.

---

## Decisions taken, and why

| Decision | Choice | Reasoning |
|---|---|---|
| Where Live data lives | Private Vercel Blob behind a serverless function | The repo is public, so nothing real can be bundled. Justin confirmed hosting the figures on Vercel was cleared. |
| Who can see Live | One shared view password; a separate publish password | Enough for a small group without an identity provider; viewers cannot overwrite Live. Per-person sign-in (Nelson SSO) would need IT. |
| Toggle placement | Rail footer, replacing the old prototype text, plus the mobile nav | Justin's choice; the rail is hidden on phones. |
| Toggle order | Live left, Sample right | Changed on 24 Sept: Live is the view people come for. |
| Live before data loads | A gate in place of every page except `/data` | A synthetic figure under a "Live" label is the most misleading thing the dashboard could show. |
| Dotted line with no 26/27 data | Current year by default; solid line empty, dotted = same week of 25/26 | Justin chose "overlay only", with no comparison maths the method cannot support. |
| School-year control | A dropdown beside Dates, scoping everything | Justin's choice over a preset or a toggle. |
| Bounds of the current year | Aug 1 → today | Only dates that have happened; later days are greyed out. |
| Logins figure | New logins per week, not the cumulative total | Spikes after a send show in the difference and vanish into the slope of a running total. |
| Logins placement | Second line on the Overview trend, right axis | Justin's choice; it shares the campaign markers. |
| First week of new logins | 63 (its own count), not blank | The counter restarts with the school year, so the first week's total *is* that week's new logins. A change from the plan, flagged at the time. |
| Date picker | react-day-picker with presets | Justin's choice over presets-only or native inputs. |
| Axis date format | "Sep 10 '25" | Justin's choice; full dates elsewhere. |
| Manual editor start point | Load from Live, publish back | Edits change what was published, not a re-interpreted copy. |
| Manual edits | Through the same loader and buttons | One road in, so a hand edit cannot skip validation. |
| Section order / default | Edwin · Manual · CSV, Edwin open | Justin's choice. |
| In-app notifications | Removed from Live | The cleaned sheet omits them; Justin chose to drop the 11 rather than keep the old figures. |
| July | Left outside every school year, on the backlog | Justin's call on 23 Sept. |

---

## The cleaned campaign data, in detail

Comparing the cleaned CSV with what Live held (the workbook import):

- **55 campaigns changed**, almost all opens and clicks going up. The cleaned sheet reports **Total** HTML Opens and Total Clicks, where the workbook's figures matched its Unique columns.
- **1 campaign was added: Edwin Mid Year Survey** (Dec 6 2025, 12,436 delivered). The workbook reader had been silently dropping it (see below).
- **11 in-app notification campaigns were removed**, because the cleaned sheet covers Pardot and YesWare only.
- **Two campaigns never load** because the sheet has no delivered count for them: Edwin NLI Touchpoint #1 and the YesWare Edwin Admin Update.

Four values looked wrong, and each was put to Justin:

| Campaign | Problem | Resolution |
|---|---|---|
| December Newsletter ON Junior | Total Clicks written as "2.05%" — a rate | **80**, from its 3.27% CTR × 2,444 delivered |
| ON - March Junior Newsletter | Total Clicks 2 against a 0.82% CTR of 2,319 (≈ 19) | **19**, from the CTR |
| ON - YCDSB: Getting Started with Edwin | 616 total opens against 614 delivered | **Kept** — total opens count repeats and can exceed delivered |
| December Newsletter ON Intermediate | Identical to Edwin Intermediate Live Lessons (2,949 / 1,091 / 154) | **Kept as is**, confirmed correct |

The corrections went into a new file, `Marketing Communications Metrics_Cleaned_Corrected.csv`, alongside the untouched original. The two files differ in exactly those two click cells. Before publishing, the file plus the usage table validated locally at 336 usage rows and 57 campaigns with no errors; Justin then published it and confirmed Live looked correct.

---

## What we tried that didn't work

### The Blob store "was not configured"

Justin created the store and set both passwords, and the endpoint still returned 503. The check required `BLOB_READ_WRITE_TOKEN`, but a store connected the current way exposes `BLOB_STORE_ID` and authenticates with Vercel's short-lived OIDC token, which `@vercel/blob` reads from the request itself. `vercel env ls` showed the difference. The fix was to accept either (`3efe9ab`).

### Validating inside the serverless function

The plan had `api/live.ts` run the full loader before accepting a publish. That would have meant importing `/src` into a Vercel function under `"type": "module"`, where extensionless relative imports are a known runtime failure. The function checks the payload's shape instead; the browser already validates before Publish is offered.

### The API tsconfig inside `api/`

A `tsconfig.json` inside `api/` risked Vercel compiling the function with `noEmit`. It moved to `tsconfig.api.json` at the root, and `npm run typecheck` runs both.

### The date popover, three times

1. **Oversized cells.** react-day-picker declares its CSS variables on its own root element, so variables set on a wrapper lost to them. They are now passed on the picker itself.
2. **Months stacked vertically.** An absolutely-positioned popover shrinks to its anchor's width. Fixed with `width: max-content`.
3. **Off the right edge** on narrower windows. It now measures itself on open and shifts left.

A fourth problem was behavioural. With a range already chosen, a click nudged the nearest end rather than starting a new range, so "pick a start, then an end" silently kept the old start. A click after a complete range now starts fresh.

### Shell quoting

Several scripted edits failed on apostrophes inside single-quoted `node -e` strings, and Python is not installed on this machine. Nothing half-applied, because each script threw before writing. Longer edits moved to script files in the session scratchpad.

### A line-ending surprise

The first corrected CSV was written with `awk` and came out different on every line: the original uses CRLF. It was rewritten with Node, preserving line endings, and diffed to confirm only two lines changed.

---

## Bugs found only by running the app

As in V2, typecheck, build and the null test were green for every one of these.

### Edwin Mid Year Survey was missing from Live

The workbook walker reads only the **last** label/value pair on a row. The Mid Year Survey's row carries "Total Delivered 12,436" and, further right, "Opt Out Rate 0.21%", so its delivered count was lost and the campaign dropped. The same row's header also carries a board-level note ("RCSD | LR 43% ? 45%") that would have been read as its audience. The CSV reader reads by column and keeps every pair.

### Duplicate rows after adding a week (development only)

In the manual editor, typed values landed on the Aug 10, 2025 row instead of the new week. Hot reload had reset the module's row-key counter while React kept the loaded rows, so the new row reused an existing key. This cannot happen on the deployed site, but keys now carry a random per-load prefix.

### The strip described synthetic data under Live

On `/data`, which stays open while Live loads, the methodology strip still read "Seeded synthetic data" while the Current source card named it. Both are hidden or reworded while Live is waiting.

### "What changed" reported on an empty year

In 2026/27 with no data, the insight strip computed against the last day of 25/26 and reported "No material changes". It now says there is no 26/27 data yet.

### Smaller ones

- **A capital "I" hint icon.** The hint beside "Compare before/after" rendered as "I", inheriting its label's `uppercase` class.
- **A hard-coded calendar line.** The Campaign Calendar still said "Campaign activity clusters across June–August 2026".
- **Nothing to explain a missing line.** Legends showed a dotted-line key where there was no prior year; a note now says so.
- **A new row out of sight.** It went to the bottom of a 48-row scrolling table; rows now show newest first.
- **"+ Add week" used the wrong row.** It followed the last row in the list rather than the latest date.

---

## Notable discoveries

- **The cleaned sheet's header rows carry the previous campaign's last metric** — the YesWare row's open rate sits on the next Pardot header. None of the three fields the dashboard uses (delivered, opens, clicks) is affected, which is why reading header-row values as belonging to their own campaign is still correct.
- **The workbook's opens were Unique; the cleaned sheet's are Total.** That, not a correction, is why opens rose across the board.
- **July falls outside every school year** under an Aug–Jun definition. Parked on the backlog.
- **The real engagement curve is growth-dominated** (from V2), which is why the new-logins line matters to Leadership: it shows adoption directly.

---

## Verification, end to end

| Check | Result |
|---|---|
| `npm run typecheck` | Clean, app and `api/` |
| `npm run check:layers` | 43 files, no generator imports above `/data` |
| `npm run null-test` | **Byte-identical** before and after every change, apart from npm's version banner |
| `npm run export-sample` | Passes. New logins are compared allowing half a unit of rounding per segment (a quiet day's 23 became 22 after rounding 24 cells) |
| API branches | Run directly: 503 unconfigured; 401 wrong or missing password, and the publish password does not unlock viewing; 400 bad JSON or missing tables; 413 oversized; 502 store failure |
| Real data | The real `.md` + workbook, and later the corrected CSV, validated end to end: 48 weeks, 336 rows, 57 campaigns, no errors, no campaign with more clicks than opens |
| Browser, Sample | All three school years, the dotted line from Feb 2026 in 2025/26, and new-logins spikes after sends |
| Browser, real data | Previewed on localhost: both school years, every page, the date presets and custom ranges, and the manual editor with a stand-in for `/api/live` (add / edit / remove / add release → validate → publish), with the published payload inspected |
| Deployed | Each release confirmed live by the bundle it served. Justin published twice and confirmed Live looked right |

**Not verified:** the phone-width layout. The browser window would not resize, so the one-month calendar and mobile toggle have been checked in the DOM but not seen at phone size.

Temporary copies of the real files were placed in the git-ignored `sample-export/` folder for browser tests and deleted after each one. Browser storage used in testing was cleared.

---

## What is still true, and still outstanding

Full detail in `HANDOFF.md` → "Known issues that remain". In short:

1. **No prior year of usage.** Publish 26/27 as it accrues; the dotted line becomes a comparison and, at 374 days, the seasonal method switches on.
2. **No licensed-seat count.** The north-star rate, OKR gauges and funnel stay dark.
3. **Gate constants are synthetic-calibrated.**
4. **Distinct-teacher counts are summed across cells**, and **reach cannot be de-duplicated**.
5. **July is outside every school year** (backlog).
6. **In-app notifications are off Live** until a source for them is chosen.
7. **Shared passwords.** Rotate `LIVE_VIEW_PASSWORD` if it spreads.

---

## Things to understand before changing anything

**The null test is still the contract.** It stayed byte-identical through six feature commits, including a new generated metric, which is only possible because that metric draws no random numbers. Keep new synthetic series RNG-free, or accept and explain the diff.

**One road in.** Files, manual edits and the generic CSV all become the same `InputFiles` and go through `buildFileSource`. Don't add a path to Live that skips it.

**Live must never show Sample.** Anything new that renders while Live is loading has to respect `LiveGate`.
