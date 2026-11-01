# Test Plan: Story 4 — A light look for the search home

**Story:** `engineering-team/stories/appearance-setting/4-light-look-search-home.md`
**ADR:** `engineering-team/decisions/appearance-setting/0004-search-home-joins-the-light-token-layer.md`
**Date:** 2026-11-01

Two new files, plus the round-2 harness notes and re-aims in stories 1–3's files:
- `test/appearance-setting-home.test.js` (Node, in the gate);
- `tests/brainstorm/appearance-setting-home.spec.js` (Playwright, B-class), with its Dark oracle
  `tests/brainstorm/fixtures/appearance-setting-4-baseline.json`.

The browser half is **populated** (review 3-R1, Blocking 1). The mocks return:
- three people: one with both badges, matched tags, NIP-05, website and lightning; one stale (three years old);
  one bare;
- four tag hits ("Show 1 more tags");
- 741 estimated hits ("Show more results");
- for a signed-in viewer, a pinned tag with a trusted list, so the pinned-tag chips render.

The empty, error and loading states have their own mocks.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 light in Light | `H1–H3` seven states, signed out and signed in, in Light: the landing; the landing with the suggestions open; the landing with the point-of-view picker open; results; results with the tag hits expanded; empty; error. The light canvas, no dark surface, text ≥ 3:1, and links, paragraphs and typed text ≥ 4.5:1 **as rendered** | spec | browser |
| AC-1 | `H1–H3` also: the landing with the pinned-tag chips, the results with the avatar menu open, the typed text in both search boxes, and "Searching…" while results load | spec | browser |
| AC-1 | `H11` the class probe: every rule naming a class the search home renders is built inside the light search home and measured as rendered | spec | browser |
| AC-1 | `T2` every colour in a search-home rule reads a `--bsp-` token (the landing variant included); `T3` every non-disabled dimmed opacity follows ADR 0002 Amendment 1; `K1` every pair ≥ 4.5:1 in Light; `I1`/`I2` no unwrapped inline colour or dimming in the files the search home reaches | Node | unit |
| AC-2 meanings survive | `M1` the stale marker reads `--bsp-warn-ink` (Dark `#d29922`); `M2` Verification Score reads `--bsp-cyan-ink` (declared `#0e7490`) on a cyan tint, and Verified Followers reads `--bsp-success-ink` on a success tint | Node | unit |
| AC-2 | `H4` as rendered in Light: each badge ≥ 4.5:1, their inks ≥ 20° apart in hue, and the stale marker ≥ 4.5:1 with a warm hue (15°–50°) | spec | browser |
| AC-3 one look | `S1` the light scope's `:is()` holds `.bs-page`; `M4` `.bs-page` reads the canvas and ink | Node | unit |
| AC-3 | `H9` the canvas `rgb(242, 243, 240)`, a result card `rgb(255, 255, 255)`, a result's name `rgb(10, 14, 24)`, and "What is this?" the accent `rgb(114, 55, 255)` | spec | browser |
| AC-4 no flip | `H7` in Light and in Dark, each on a computer set to the other look: results → a profile → Settings → back, every page in the chosen look | spec | browser |
| AC-5 Dark unchanged | `T1` with `--bsp-` wrappers stripped, the stylesheet reads as at this story's base `7690c8e16` (regression) | Node | unit |
| AC-5 | `H5` snapshot of every element's colours, borders, background image, shadow and opacity: all seven states, signed out and in, under Dark-chosen and System-dark (regression) | spec | browser |
| AC-6 no flash | `C1` `SEARCH_HOME_PATH` / `isSearchHomePath`, exact; `C2` `preloadFamily` gives `profile` on `/` and `/information-for-agents`, and `null` on an unknown path; `C3` every top-level route outside `/tapestry` has a hint or is named as being in no family; `P1` the script agrees with the library on the search home and its lookalikes, in both looks | Node | unit |
| AC-6 | `H6` with the bundle held: on `/` and `/?q=podcast`, Light on a dark computer shows the light canvas before render, and Dark on a light computer shows today's dark background | spec | browser |
| AC-7 phones | `H8` at 375 and 414 px in Light, the landing and the results are light and don't scroll sideways | spec | browser |
| AC-8 everything else unchanged | `H10` in Light, `/tapestry/` and an unknown path (NotFound) keep today's background. Stories 1–3's specs and suites still run, re-aimed below | spec / all | browser / unit |
| Carried: POV name | `M3` `.bs-usermenu-pov-indicator strong` reads `--bsp-accent-ink` | Node | unit |

## Edge cases

- [x] `/` is an **exact** path: `//`, `/x`, `''`, `/search`, null and undefined aren't it (C1). A query string
      (`/?q=…`) doesn't change the pathname (P1, H6).
- [x] An unknown path still gets no hint, so NotFound doesn't flash light (C2, H10, story 1's re-aimed E9 test).
- [x] `/information-for-agents`, story 3's gap: C2 and C3.
- [x] The point-of-view picker's unavailable option ("You must be logged in…") is an inactive option, and the sweep
      exempts it (WCAG 1.4.3). It reads under 4.5:1 in Dark today too, and T4 keeps its literal 0.5 in both looks.
- [x] **Dimmed boxes that hold links** (`.bs-personalization`, `.bs-personalization-compact`, `.bs-footer`, all ≤ 0.6)
      must read `--bsp-opacity-soft`, not dim. Their links couldn't reach 4.5:1 under 0.72. This is named in T3's
      `HOLDS_LINKS`, after story 3's DevPage precedent.
- [x] Typed text in both search boxes, measured as the input's value (H1–H3).

## The round-2 harness notes (review 3-R2), done here

- **The class finder's `prefix-${` rule is narrowed** (`test/appearance-setting-light.test.js`):
  - a start counts only when it names a family (two segments or more, `bs-tag-`), never a state start (`is-`,
    `has-`);
  - the reading and working pages' inventory went from 760 classes to 713, keeping the code-built ones (for example
    `settings-message-success` and `ptc-chip-mine-apply`).
- **A shared state class no longer makes a rule a family's** (story 3's `isFamilyRule`). `.event-type-card.disabled`
  was being read as a search-home rule only because the search home uses `disabled`.
- **I4 is tightened** (story 3's `inlineOpacities`):
  - a conditional opacity (`opacity: busy ? 0.6 : 1`) counts as well as a literal one;
  - only a disabled control's own dimming is exempt: the condition names a disabled state, or the same style sets the
    not-allowed cursor on that condition (`BrainstormSettings.jsx:504`).
- **Test changes go in the Tester's commits.** Any test change found to be needed during Implementation gets its own
  Tester amendment commit before the implementation commit.

## Re-aims in stories 1–3's files

Each one is a test that pinned what story 4 changes on purpose.

- **Story 1, `tests/brainstorm/appearance-setting.spec.js`:**
  - E9 pins `/` only while the look resolves to Dark, like `/about` since story 2.
  - E9's "no light background before the search home renders" now uses an unknown path (`/no-such-page`), which is
    outside every family.
- **Story 2:**
  - **`test/appearance-setting-light.test.js`:**
    - C2 expects `profile` on `/`;
    - the light scope is found by shape (its `:is()` list holds `.bsp-page` and `.bss-page`), not by its exact
      selector;
    - `isScope` and `STATE_WORD` are exported.
  - **`tests/brainstorm/appearance-setting-light.spec.js`:** L7's search-home entry is retired; this story's H-tests
    cover it.
- **Story 3:**
  - **`test/appearance-setting-working.test.js`:**
    - `WORKING_PREFIXES` gains `/information-for-agents` (C1, P2);
    - C2 expects `profile` on `/`;
    - T2's `-landing` exclusion is removed;
    - K1, I1 and I4 are split into `lowPairs`, `inlineColours` and `inlineOpacities` and exported with
      `isFamilyRule`, `withoutBsp`, `DISABLED` and `CONTENT_FILES`, so this story's suite reuses them; their
      behaviour is unchanged apart from the harness notes above.
  - **`tests/brainstorm/appearance-setting-working.spec.js`:** W8's allowlist entries for the landing variant are
    removed.

## Test infrastructure

- **Node:** `test/appearance-setting-home.test.js`, registered in `test/registry.js`. It reuses stories 1–3's
  helpers. T1 reads the base stylesheet with `git show 7690c8e16:…`. C3 reads the router's literal top-level paths
  from `ui/src/App.jsx`; paths set through constants (`/assistants`, `/assistant`, `/treasure-map`) are covered by
  stories 1 and 3.
- **Playwright:** run against a build, with `/api` mocked and relay sockets closed.
- **The H5 oracle:** 28 snapshots (7 states × signed out and in × Dark-chosen and System-dark), 1,494 elements.
  - **Written:** 2026-11-01, with `APPEARANCE_BASELINE=write`, from a build whose UI is `7690c8e16`'s. The UI is
    unchanged since `d08811439`; the commits in between touch only server files.
  - **Deterministic:** a compare run with 6 workers against the same build passed all seven H5 tests.
  - **Rewrite only from a build of the base.**

## How to run

```
node test/appearance-setting-home.test.js
```

```
BRAINSTORM_BASE_URL=http://localhost:4174 npx playwright test tests/brainstorm/appearance-setting-home.spec.js --project=chromium
```

## Verification

The new tests fail with the current code. Confirmed on 2026-11-01 at `7690c8e16`, with the UI built and served on
`:4174`.

Node, 3 passed and 12 failed:

```
FAIL C1  SEARCH_HOME_PATH should be "/", got undefined
FAIL C2  preloadFamily("/") should be "profile", got null
FAIL C3  2 route(s) would show the other look first: /, /information-for-agents
FAIL P1  the library should give the search home the profile hint
FAIL S1  every light scope rule should list .bs-page
PASS T1  Dark unchanged (regression)
FAIL T2  85 colour(s) in search-home rules don't read a --bsp- token
FAIL T3  20 opacity value(s) not on the rule
FAIL M1  .bs-result-age.stale { color } should be var(--bsp-warn-ink, …), got "#d29922"
FAIL M2  the badges read #58a6ff / #3fb950 on blue / green tints
FAIL M3  .bs-usermenu-pov-indicator strong { color } … got "#a5b4fc"
FAIL M4  .bs-page { background } should be var(--bsp-canvas, …)
FAIL K1  pairs below 4.5:1 in Light (the matched tags 1.42:1, the badges 2.07:1, the error 2.75:1, …)
PASS I1  no inline colour to wrap (a guard)
PASS I2  no inline dimming to wrap (a guard)
```

Playwright, 11 passed and 18 failed:

```
FAIL H1–H3 (×10)  the page background is the dark rgb(15, 15, 35)
FAIL H4           the results are light, so the badges are measured in Light
FAIL H6 (×2)      Light on a dark computer: the light canvas before render
FAIL H7 light     search results and back to the search home: rgb(15, 15, 35)
FAIL H8 (×2)      / and /?q=podcast not light
FAIL H9           the page background
FAIL H11          19 pieces: dark surfaces (.bs-page, the landing box, the suggestions, the POV picker, the result card,
                  the results box …) and dimmed text under 3:1
PASS H5 (×7)      Dark snapshots equal the base (regression; also proves them deterministic)
PASS H6 dark (×2), H7 dark, H10   regression
```

Re-aimed suites at the base:
- Story 2's C2 and story 3's C1, C2 and T2 fail, for the paths and the landing variant this story changes.
- Story 3's W8 fails on the landing box only.
- Stories 1–3's specs are otherwise green: 127 passed, 1 failed (that W8).

## Amendment 1 (2026-11-01, during Implementation)

This doesn't loosen what K1 guards: H4 measures the badge as rendered.

- **Story 4's K1** gets a `PAIR_ALLOWLIST` with one entry, `.bs-wot-rank`. K1 lays a translucent background over the
  page canvas. The Verification Score badge sits on a result card, white in Light, where it reads 4.67:1 (`#0e7490` on
  the 0.10 cyan tint). Laid on the canvas, it would read 4.21:1.
- **Story 4's H9** reads the accent from "Show N more tags" (`.bs-taghits-toggle`), not "What is this?". In Dark
  "What is this?" is quiet text in the primary text colour, not an accent link, so in Light it rightly reads the ink.
  The toggle is accent-coloured in both looks.
- **`test/setup-alert-polish.test.js` S1** finds the light scope by its selector. That selector's `:is()` list now also
  holds `.bs-page`, so S1 accepts it with or without. Its checks are unchanged.

After the implementation:
- Node: `appearance-setting-home` 15/15, `appearance-setting-working` 14/14, `appearance-setting-light` 11/11,
  `appearance-setting` 16/16.
- Playwright: story 4's spec 29/29. Stories 1–4, `setup-alert-polish`, `assistant-shared-categories` and the 9 related
  specs: 364/364.
- 44 screened related Node suites: 43 clean (`setup-alert-polish` after the S1 re-aim above), and
  `tag-detail-curated-view-and-pin-polish`, which skips without a stack. The two H-class suites that write through
  container `tapestry` were left out, as before.

## Amendment 2 (2026-11-01, after review 1)

Review 1 (CHANGES_REQUESTED) found two gaps and some hover issues. None of these changes loosens what an earlier test
guards.

- **Blocking 1, the unavailable point-of-view option:**
  - H1–H3's sweep narrows its exemption. The option's text stays exempt (an inactive option), but a working link inside
    it is measured. The Settings link read 2.29:1 in Light.
  - New **M5:** a Light-only rule, inside the light scope, sets the option's opacity to 1 and dims it by colour
    (`--bsp-muted` or `--bsp-ink-2`), so its link reads whole. Dark keeps the literal 0.5 (story 3's T4), as ADR 0004
    Amendment 1 records.
- **Blocking 2, `/information-for-agents`:**
  - Its page file joins story 4's Node checks as `ADOPTED_FILES`, so T2, I1 and I2 now read it.
  - New **C4:** every top-level route with a light pre-render hint has its page file in a test inventory. A light page
    no test reads can't slip through again.
  - New **H12:** the page in Light is light and readable, typed text included, and its field's edge shows against the
    page (1.25:1 or more; white on white was 1.02:1).
- **Non-blocking 1–2, hovers:**
  - New **H13:** in Light, a hovered result card's text reads as rendered (it was the link-hover purple at 0.72, 3.97:1),
    and "Not Personalized" changes when hovered.
  - New **M6:** a Light-only `.bs-result-card:hover` sets `color: var(--bsp-ink)`.
- **Non-blocking 3:** `test/setup-alert-polish.test.js` S1 finds the light scope by its shape (story 2's `isScope`), not
  by a pattern of its selector.

At `5ae5f89b8`, with the UI built from the implementation: M5, M6, I1 and I2 fail (14 passed, 4 failed), and H1–H3's
picker state, H12 and H13 fail (28 passed, 3 failed).

## Amendment 3 (2026-11-01, after review 2)

- **H13** measures a hovered result card only once every transition inside it has finished
  (`getAnimations({ subtree: true })`). The card animates its hover background, so measuring straight after the
  pointer arrived saw the card still white. Measured after the transition, the Verification Score badge on the hover
  tint read 3.88:1 (review 4-R2, Blocking 1).
- New **S2:** every Light-only rule under the light scope (ADR 0004 Amendment 1) paints with `--bsp-` tokens, never a
  literal colour. T2, T3 and K1 don't read scoped rules (review 4-R2, non-blocking). It passes; it's a guard.

At `f5d4a6532`, with the UI built from `c94a8f1b5`: H13 fails on `.bs-wot-rank` at 3.88:1, and S2 passes.
