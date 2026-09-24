# Edwin PMM Dashboard — Handoff V4

**Owner:** Justin Quan, Product Marketing Manager, Nelson Education
**Covers:** the redesign session of 24 September 2026
**Companion to:** `HANDOFF.md` (the current state), `HANDOFFV2.md` and `HANDOFFV3.md`

---

## What this was

A redesign onto **Phia**, Edwin's design system, and nothing else. The brief was to change how the
dashboard looks without changing what it does or touching any data. Version 0.3.0 → 0.4.0.

The references were the "Phia by Edwin" design-system project (its README, `colors_and_type.css`,
the Edwin dashboard UI kit, and the component previews) and a composite screenshot of the Edwin app.

## Decisions, all made by Justin before any code changed

| Question | Choice |
|---|---|
| Navigation | Phia light sidebar (240px, off-white, edwin logotype, icon + label items), replacing the dark navy rail. Live / Sample toggle and version stay in its footer. |
| Page header | Phia top bar: 36px Source Sans Bold title, grey subtitle, Leadership / Product Marketing toggle on the right. No eyebrow line, because that would have meant new copy. |
| Headings | Sentence case (the uppercase was CSS; the strings were already sentence case). Uppercase kept only for small labels, as Phia allows. |
| Copy | **Word for word.** No visible text changed. |
| Fonts | Source Sans Pro bundled from Phia's own files (OFL); Inter from Google Fonts for numbers and UI chrome. |
| Sidebar icons | The closest existing Phia icons: Overview → dashboard, Marketing → notifications, Timeline → history, Campaign Impact → star, Adoption → heart, Segments → geography, Calendar → calendar, Data Import → download-cloud. |
| Colours | Phia palette: positive green-500, negative red-600, new logins violet-500, dotted line neutral-400. Blue is unchanged. |
| Unicode glyphs | Replaced with SVG icons (chevrons, calendar, close, the marker triangle). Arrows inside sentences stay as text. |
| Logo | The official blue edwin logotype over the existing "Product Marketing" line. The typed "NELSON" is gone. |
| Campaign colours | Phia tones, plus colours for the real Live channel names (Pardot → blue, YesWare → violet), which previously fell back to grey. |
| Delivery | A `redesign` branch reviewed locally before anything reaches `main`. |

## What changed

- `src/theme/tokens.ts` — rewritten to Phia's tokens. The old key names were kept, so no call site
  changed; new keys added for tints, badges and shadows, plus `num` (now Inter) and `eyebrow`.
- `src/index.css` — the font faces, the canvas background, Phia's focus glow, 120ms colour
  transitions, the `phia-table` table style, and hover classes.
- New: `Icon.tsx` (Phia SVGs, inlined), `EdwinLogo.tsx`, and `src/assets/` (fonts, OFL, logotype).
- Restyled: every component and page. Headings, labels, buttons (6px radius, Phia primary /
  secondary / disabled), badges, cards (hairline, soft shadow, 24px padding), inputs, the date popover,
  the methodology strip (Phia info blue), callouts (Phia warning amber), progress bars (pills),
  chart tooltips and axis numbers.

## What did not change

Nothing under `src/analytics`, `src/data`, `src/state`, `src/lib`, `api/` or `scripts/`. No
calculation, gate, data path or Live / Sample behaviour. A scripted comparison of the diff found no
visible string changed, apart from arrow glyphs becoming icons beside the same words and the existing
"Product Marketing" line reused in the phone header.

## Notes worth keeping

- **Phia's icon exports are imperfect.** `left-arrow.svg` is identical to `right-arrow.svg`, `clock.svg`
  is actually a chevron, `close.svg` is drawn as a plus, `student.svg` is a bare circle, and
  `calendar.svg` is only its outline. `Icon.tsx` uses the one chevron rotated for every direction,
  rotates the plus 45° for close, and adds a header rule and two binder rings to the calendar outline.
- **Two lines of copy are now out of date** and were left alone under the word-for-word rule: the
  Sample footer says design tokens are "a placeholder pending the Phia system", and the error card calls
  the app "a prototype on synthetic data". Worth a one-line decision.
- **Phia's `--blue-700` is a teal** (`rgb(0,98,113)`), almost certainly an extraction slip, so blue-800
  is used for the darker blue instead.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | Clean |
| `npm run check:layers` | 45 files, no generator imports above `/data` |
| `npm run null-test` | **Byte-identical** to the run captured before the redesign |
| `npm run export-sample` | Passes, worst drift 0.113% |
| `npm run build` | Succeeds |
| Browser, Sample | Every page on localhost in both views, the date popover, the methodology modal, the Live password gate, and a 390px phone width (no page-level horizontal scroll) |

**Not verified in the browser:** the real 25/26 data (Live or a Preview of the exports), and so the
platform-wide and "unavailable" states that only appear on it. Those states use the same restyled
components, but they have not been seen.
