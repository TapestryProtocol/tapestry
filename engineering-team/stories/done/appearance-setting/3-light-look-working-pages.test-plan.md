# Test Plan: Story 3 — A light look for the working pages

**Story:** `engineering-team/stories/appearance-setting/3-light-look-working-pages.md`
**ADR:** `engineering-team/decisions/appearance-setting/0003-working-pages-join-the-light-token-layer.md`
**Date:** 2026-11-01

Two files, plus re-aims in story 2's:
- `test/appearance-setting-working.test.js` (Node, in the gate);
- `tests/brainstorm/appearance-setting-working.spec.js` (Playwright, B-class), with its Dark oracle
  `tests/brainstorm/fixtures/appearance-setting-3-baseline.json`.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 working pages light | `W1` all 22 working pages in Light, signed out and as a customer, plus an owner on `/assistant*` and `/setup*`: the light canvas, no dark surface, text ≥ 3:1 and links and paragraphs ≥ 4.5:1 **as rendered** | spec | browser |
| AC-1 | `T2` every colour in a profile-family rule (reading and working pages, story 3's families included) reads a `--bsp-` token; `T3` every non-disabled dimmed opacity follows ADR 0002 Amendment 1; `I1` the 13 inline colours in `AssistantProfileEditor.jsx` and `DevPage.jsx` | Node | unit |
| AC-1, AC-3 contrast | `K1` every pair a profile-family rule paints, in Light, ≥ 4.5:1 | Node | unit |
| AC-2 working pieces everywhere | `W2` `/user/<pk>` signed in, the Manage Tags dialog opened: no dark surface, all text readable, page and dialog together | spec | browser |
| AC-3 one look | `W7` `/developers`: the light canvas, and a body link is the accent `rgb(114, 55, 255)`. It already passes, because story 2 did the frame and links | spec | browser |
| AC-4 Dark unchanged | `T1` with `--bsp-` wrappers stripped, the stylesheet reads as at this story's base `34bd3957b` (regression) | Node | unit |
| AC-4 | `W3` snapshot of every element's computed colours **and opacity** on all 22 working pages, under Dark-chosen and System-dark, plus an owner on `/assistant*` and `/setup*` (regression) | spec | browser |
| AC-5 no flash | `C1` `WORKING_PATH_PREFIXES` and `isWorkingPath`; `C2` `preloadFamily` gives `profile` on working paths and keeps `/assistants` (design) apart from `/assistant`; `P1` the script holds the list; `P2` the script agrees with `preloadFamily` on every working path and lookalike | Node | unit |
| AC-5 | `W4` with the bundle held, `/tags`, `/assistant` and `/developers` (Light on a dark computer) show the light canvas before render | spec | browser |
| AC-6 phones | `W5` at 375 and 414 px in Light, no working page scrolls sideways. It passes today and must stay that way | spec | browser |
| AC-7 the /about chip | `I2` `chipStyle.color` reads `var(--bsp-accent-ink, <today's accent>)`; `W6` the instance section reads in Light as rendered (chips included), and the Admins chip is `rgb(165, 180, 252)` in Dark | Node / spec | unit / browser |
| AC-8 everything else unchanged | story 2's `L7` (the search home, `/tapestry/`, `/dictionary` in Light) and `L3` (the reading pages in Dark) still run; `I3` the published avatar's ring stays `#0d1117` (regression) | story 2's spec / Node | browser / unit |

## Edge cases

- [x] `/assistants` (the design shell) against `/assistant` (story 3), in C2 and P2.
- [x] Owner-only parts of `/assistant` and `/setup` (W1, W3 owner runs).
- [x] Text that's dimmed **and** sits on a translucent tint. The W1, W2 and W6 sweep layers every background over the
      one beneath it and fades each group's backgrounds and text by its opacity. That's story 2's review 2-R2-1, the
      case story 2's L1 missed.
- [x] Images drawn by the app for publishing (`compositeAvatar.js`) are content, not appearance: I3.

## Test infrastructure

- **Node:** `test/appearance-setting-working.test.js`, registered in `test/registry.js`.
  - It reuses story 1's helpers and story 2's: story 2's suite now exports `stripBsp`, `lightBsp`, `lastByKey`,
    `lightScope`, `classesFrom`, `scoped`, `normSel`, `READING_FILES`, `COLOUR_PROPS`, `LITERAL` and `SCOPE`, and its
    class finder is generalized to `classesFrom(files)`.
  - T1 reads the base stylesheet with `git show 34bd3957b:…`.
- **Playwright:** run against a build, with `/api` mocked and relay sockets closed.
- **The W3 oracle:** 57 snapshots, 2,211 elements. It records colours, borders, background images and opacity.
  - **Written:** 2026-11-01, with `APPEARANCE_BASELINE=write`, from a build of `34bd3957b`'s UI.
  - **Deterministic:** a compare run with 6 workers against the same build passed all 22 W3 tests.
  - **Rewrite only from a build of the base.**
- **Re-aimed in story 2's files:**
  - **`test/appearance-setting-light.test.js`:**
    - T5 ("story 3's families are left as they are") is retired; story 3 inverts it.
    - The class finder becomes `classesFrom(files)`.
    - The helpers are exported.
  - **`tests/brainstorm/appearance-setting-light.spec.js`:** L7's `/tags` entry ("a story-3 page's content is
    unchanged") is retired. W1 and W3 cover `/tags` now.

## How to run

```
node test/appearance-setting-working.test.js
```

```
BRAINSTORM_BASE_URL=http://localhost:4174 npx playwright test tests/brainstorm/appearance-setting-working.spec.js --project=chromium
```

## Verification

The new tests fail with the current code. Confirmed on 2026-11-01 at `34bd3957b`, with the UI built and served on
`:4174`.

Node, 3 passed and 8 failed:

```
FAIL C1  WORKING_PATH_PREFIXES should be [...], got undefined
FAIL C2  preloadFamily("/tags") should be "profile", got null
FAIL P1  the script should hold the working list
PASS P2  (the script and the library agree: no hint yet on either side)
PASS T1  Dark unchanged (regression)
FAIL T2  481 colour(s) in profile-family rules don't read a --bsp- token
FAIL T3  50 opacity value(s) not on the ADR 0002 Amendment 1 rule
FAIL K1  49 pair(s) below 4.5:1 in Light
FAIL I1  18 inline colour(s) don't read a --bsp- token
FAIL I2  chipStyle.color should read var(--bsp-accent-ink, …), got "ACCENT"
PASS I3  the avatar ring is untouched (regression)
```

Playwright, 25 passed and 27 failed:

```
FAIL W1 (×22)   text readable / no dark surface in Light
FAIL W2         no dark surface on the profile or in its dialog
FAIL W4 (×3)    the light canvas before render
FAIL W6         the instance section reads in Light as rendered
PASS W3 (×22)   Dark snapshots equal the base (regression; also proves them deterministic)
PASS W5 (×2), W7   regression
```

## Amendment 1 (2026-11-01, during Implementation)

None of these loosens what its test guards.

- **Story 3's T3** leaves `opacity: 0` alone. It hides an element until a hover or focus shows it, and isn't dimmed
  text (`.bs-pindetail-naddr-showall`).
- **Story 3's I2** reads a whole quoted or template value. The wrapper itself holds a comma, and the first version cut
  the value there.
- **Story 3's sweep** (W1, W2, W6) exempts the label of a disabled control as well as the control itself
  (WCAG 1.4.3's exception for inactive components). A parked Identification Tags row's name labels a disabled
  checkbox, and it reads under 3:1 in Dark today too.
- **Story 2's C2** drops `/tags` and `/assistant/profile` from its "no hint" list. They're working paths now, and
  story 3's C2 pins them.
- **`tests/brainstorm/assistant-shared-categories.spec.js` SC2** runs in Dark explicitly, its exact pin unchanged, and
  adds the Light value of the Shared line (`rgb(85, 93, 105)`). Playwright's default light scheme now shows the hub in
  Light.
- **`test/assistant-shared-categories.test.js` D3** reads each wrapper's Dark fallback for its original checks, and
  adds the same 4.5:1 for the Light values on the light canvas.
- **`test/assistant-management-page.test.js` O4**, the guard against links to the old `/assistant` page, allows the
  one line in `src/lib/appearance.js` that names `/assistant` as a pre-render path prefix. It's a path list, not a
  link.

One judged exception in the implementation: `DevPage.jsx`'s intro is dimmed at 0.6, but it holds links, so it reads
`--bsp-opacity-soft` (full in Light). ADR 0002 Amendment 1 says soft "holds links".

After the implementation:
- Node: `appearance-setting-working` 11/11, `appearance-setting-light` 11/11, `appearance-setting` 16/16.
- Playwright: story 3's spec 52/52. Stories 1 and 2, `setup-alert-polish` and the 9 related specs: 276/276.
- Every other spec that checks a colour (found by searching `tests/brainstorm/` for colour assertions, then screened):
  38/38 after SC2's re-aim.
- 57 screened related Node suites are clean, apart from one that skips without a stack.

## Amendment 2 (2026-11-01, after review 1)

Review 1 (CHANGES_REQUESTED) found pieces that only show with data, inline styles outside the hand-picked files, greys
turned into the accent, and disabled states that would look enabled in Light. Every story-3 test passed while they
were wrong. These tests close those gaps; none loosens what an earlier test guards.

- **The class finder** (story 2's `walkFrom`, shared by both suites) reads every string in a walked file that is shaped
  like a class list and names a class the stylesheet defines, not only `className` expressions. It reads the strings
  inside a template's `${…}`. A class finished in code (`settings-message-${type}`) counts as every class the stylesheet
  defines with that start. Comments, prose, URLs and non-class attribute values (`role="tab"`, `p.set('tab', …)`) are
  skipped. State words (`active`, `stale`, `missing` …) still count only from `className` expressions.
- **Story 3's T3** skips disabled and inactive states (`:disabled`, `[disabled]`, `.disabled`, `aria-disabled`,
  `.saved`, `.is-parked`).
- **Story 3's T4 (new)**: those states keep today's opacity in both looks. No `--bsp-opacity-*` in their rules
  (Blocking 4).
- **Story 3's T5 (new)**: no `--bsp-accent*` wrapper holds a Dark value that is a grey (chroma under 0.2)
  (Blocking 3).
- **Story 3's I1** reads every file the reading and working pages reach, except `utils/compositeAvatar.js` (a
  published image's colours). **I4 (new)**: no literal inline `opacity: 0.x` in those files, apart from a line that
  dims a disabled control (Blocking 2).
- **Story 3's W8 (new), the class probe**: for every profile-family rule without a pseudo-class, pseudo-element or
  disabled state, it builds the elements its selector describes inside the light `/tags` page, puts text in the
  innermost one, and measures it as rendered (3:1, or 4.5:1 inside `a` or `p`). It also fails any dark grey surface
  (luminance under 0.15, chroma under 0.2). It doesn't depend on mock data (Blocking 1).
- **The search home's landing variant** of the shared SearchInput (`*-landing`) is left out of T2 and W8: it renders
  only on the search home, which is story 4.

`.bs-result-age.stale`, which review 1 listed, is the search home's results row (`BrainstormSearch.jsx:749`), not a
pinned list. It is story 4's.

The finder also had to read nested templates (`ptc-chip ${… `ptc-chip-mine-${…}` …}`), whose backticks pair wrongly.
It now cuts a string at an unclosed `${`, and reads `-${` class starts from the whole file. With that, the Node checks
found the tag chips the class probe had already flagged.

After the fixes:
- Node: `appearance-setting-working` 14/14, `appearance-setting-light` 11/11, `appearance-setting` 16/16.
- Playwright: story 3's spec 53/53 (W8 included). Stories 1 and 2, `setup-alert-polish`, SC2 and the 9 related specs:
  283/283.
- 46 screened related Node suites: 45 clean, and one that skips without a stack. Two H-class suites that write through
  container `tapestry` were left out (`teach-it-what-matters`, `show-the-four-on-the-goal-screens-that-already-exist`).
