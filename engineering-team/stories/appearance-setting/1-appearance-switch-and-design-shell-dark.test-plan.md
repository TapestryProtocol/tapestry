# Test Plan: Story 1 — The Appearance switch, and a dark look for the design-shell pages

**Story:** `engineering-team/stories/appearance-setting/1-appearance-switch-and-design-shell-dark.md`
**ADR:** `engineering-team/decisions/appearance-setting/0001-appearance-attribute-preload-and-design-shell-tokens.md`
**Date:** 2026-10-31

Two files:
- `test/appearance-setting.test.js` (Node, in the gate): the library, the pre-render script, the stylesheet, and
  contrast.
- `tests/brainstorm/appearance-setting.spec.js` (Playwright, B-class): what a visitor sees.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 first visit follows the computer | `C1` names and default System; `C3` resolveAppearance | `test/appearance-setting.test.js` | unit |
| AC-1 | `E1` with no choice and the computer dark/light, every design-shell page shows that look | `tests/brainstorm/appearance-setting.spec.js` | browser |
| AC-1 live OS change | `E2` under System the page follows the computer without a reload | spec | browser |
| AC-2 where it's offered | `E3` avatar menu (signed in, design shell and /about), System checked by default | spec | browser |
| AC-2 | `E3` the signed-in Settings page, outside the menu | spec | browser |
| AC-2 | `E3` signed out: on the Sign in button's row, beside it (gap < 160 px), on /assistants, /dictionary and /about | spec | browser |
| AC-2 | `E3` the signed-out Settings page: two controls (top bar and page) with the sign-in prompt | spec | browser |
| AC-3 applies at once, sticks, System returns | `E4` signed out: Dark with no reload, after a reload, in a new tab; System back to the computer | spec | browser |
| AC-3 | `E4` signed in: Light from the avatar menu; the Settings page control | spec | browser |
| AC-3 explicit choice holds | `E2` explicit Light stays light when the computer turns dark | spec | browser |
| AC-3 nothing sent | `E4` no non-GET `/api` request, and none naming appearance/theme, after choosing | spec | browser |
| AC-3 other browser | `E5` a fresh browser context keeps its own (System) | spec | browser |
| AC-3 storage | `C4` readStoredChoice, `C5` writeStoredChoice (key, junk, throwing storage) | test | unit |
| AC-4 no flash | `P1` a classic inline script in `<head>`, before stylesheet and module | test | unit |
| AC-4 | `P2` the pre-render script and the library agree over 6 stored values × 2 OS × 11 paths | test | unit |
| AC-4 | `E6` bundle held: `data-appearance` and the body background are already the chosen look's, hold steady, and equal the background after render (4 combinations, 4 pages) | spec | browser |
| AC-5 dark look | `T2` design-shell rules hold no literal colours (all tokens) | test | unit |
| AC-5 | `T3` every colour token has a dark value; `color-scheme: dark`; the core tokens differ | test | unit |
| AC-5 contrast | `K1` 9 text/link/status tokens on 4 surfaces ≥ 4.5:1 in Dark | test | unit |
| AC-5 | `E7` each design-shell page in Dark, signed out and signed in with the menu open: no light surface (≥ 40×20 px, luminance > 0.6), all text ≥ 3:1, links and paragraphs ≥ 4.5:1 | spec | browser |
| AC-5 Light as today | `T1` every declaration paints in Light what it painted at BASE (regression) | test | unit |
| AC-5 | `E8` Light on a dark computer: today's ink and page background on all four pages (regression) | spec | browser |
| AC-6 everything else unchanged | `T4` every rule not naming `.bsd-` paints what it painted at BASE (regression) | test | unit |
| AC-6 | `E9` /about, /settings, /, /tapestry/ keep today's background and text colour for every choice × OS; no light pre-render background on /about (regression) | spec | browser |
| AC-7 storage refused | `P3`, `P4` the script with throwing storage or matchMedia | test | unit |
| AC-7 | `E10` storage refused: follows the computer, the control still changes the look, no page error | spec | browser |
| ADR paths | `C6` isDesignShellPath | test | unit |

## Edge cases

- [x] A junk or foreign stored value (`purple`, `Dark`, Brainstorm-UI's `brainstorm_theme` key): reads as System
      (C2, C4, P2).
- [x] Prefix lookalikes (`/dictionaryx`, `/assistant/profile`, `/tapestry/dictionaries/concepts`) get no
      design-shell hint (C6, P2).
- [x] matchMedia unavailable: the script falls back to Light, and an explicit Dark still holds (P4).
- [x] A failed storage write still changes the look for the page (C5, E10).
- [x] Grouped selectors and `@media` blocks in the stylesheet comparison: T1 and T4 split selector lists and key
      each declaration by context, selector and property, with the last one winning, as the cascade does.

## Test infrastructure

- **Node:** `test/appearance-setting.test.js`, registered in `test/registry.js`. It has a `require.main` block, so
  running it directly works too.
- **BASE for T1 and T4:** the stylesheet at staging commit `6d3bb659` (`6d3bb6595574…`), read with `git show`. CI
  checks out with `fetch-depth: 0`. Without the history the tests fail and say so; they never skip silently.
- **How T1 and T4 compare:** a small CSS reader resolves `var()` against two token maps. "Root" is every custom
  property outside the design shell. "Shell" is Root overlaid with the design shell's light tokens. Rules scoped
  to `[data-appearance]` or `[data-preload-family]` are left out of both maps. Each declaration at BASE has to paint
  the same value now. T1 checks every rule under Shell, so a `.dict-*` or `.bs-usermenu-*` rule rendered inside the
  shell is covered too. T4 checks every rule outside the shell under Root.
- **Playwright** runs against a **build**, since E6 holds `/assets/*.js` to see the page before React. Every `/api`
  call is mocked: a catch-all with empty collections, then the sign-in pair, the setup, attention, roster and My
  Assistants reads, and one Dictionary entry. Run it on chromium only.
- **Markup contract:** a `radiogroup` named **Appearance**, with three `radio`s named **System**, **Light** and
  **Dark**, each carrying `aria-checked`. The tests also use today's `.bs-usermenu-avatar-btn` and
  `.bs-usermenu-dropdown` for the avatar menu, and `.bsd-page`, `.bsp-page`, `.bss-page` and `.bs-page` for the
  pages.
- **Values pinned as today's** (E8, E9), confirmed passing on the BASE build:
  - design-shell ink `rgb(10, 14, 24)` on `rgb(242, 243, 240)`;
  - `.bsp-page` and `.bss-page`: `rgb(15, 15, 26)` with `rgb(226, 232, 240)`;
  - `.bs-page`: `rgb(15, 15, 35)` with `rgb(224, 224, 224)`;
  - admin `body`: `rgb(13, 17, 23)` with `rgb(230, 237, 243)`.
- No live stack, firmware or fixtures. Neither file publishes anything (no `strfry/publish`, no `nak`).
- **Known gap, not this story's:** with storage refused, `PovContext` reads `localStorage` unguarded once someone is
  signed in (`ui/src/context/PovContext.jsx:40`), so a signed-in page errors. E10 runs signed out for that reason.
  This gap gets an OPEN.md row at Review.
- **Not proven by an oracle:** no throwaway implementation was built, so E6 (after release) and E7's thresholds are
  first exercised in Implementation. E7's sweep was dry-run on today's light `/assistants`: it read 8 text
  elements and flagged the light "Sign in with nostr" button as a light surface, as it should. E6's sampler is
  proven by E9's pre-render test, which passes at BASE.

## How to run

```
node test/appearance-setting.test.js
```

The Playwright spec needs a build. On this Mac, `:7778` is Grawk's agent-memory instance, so serve the build from a
scratch `vite preview` whose `/api` goes nowhere, on `:4174`:

```
BRAINSTORM_BASE_URL=http://localhost:4174 npx playwright test tests/brainstorm/appearance-setting.spec.js --project=chromium
```

## Verification

The new tests fail with the current code. Confirmed on 2026-10-31 at commit `bd28893b0` (the ADR commit; code as at
staging `6d3bb659`).

Node, `node test/appearance-setting.test.js`, 2 passed and 13 failed:

```
FAIL C1–C6   src/lib/appearance.js should exist (ADR 0001, Implementation notes: "Pure logic")
FAIL P1      ui/index.html <head> should hold a classic inline <script> (no src, not type="module")
FAIL P2      src/lib/appearance.js should exist …
FAIL P3, P4  ui/index.html should carry a classic inline <script> in <head> …
PASS T1      Light is unchanged inside the design shell (regression)
FAIL T2      170 literal colour(s) left in design-shell rules …
FAIL T3      there should be a :root[data-appearance="dark"] .bsd-page rule carrying the dark token set …
PASS T4      nothing outside the design shell changed (regression)
FAIL K1      there is no dark token set to measure (see T3)
```

T1 and T4 bite. A mutated copy failed them: `.bsd-nav`'s `rgba(242, 243, 240, 0.78)` changed to `…241…` failed T1,
and `:root --bg-secondary` from `#161b22` to `#161b23` failed T4 with 41 declarations. The stylesheet was then
restored.

Playwright, against the BASE build on `:4174`, 10 passed and 22 failed. Every failure is the missing feature:

```
FAIL E1 (×2), E2, E4 signed out/in, E7 (×4), E10 (×2)   <html data-appearance> should be "dark"/"light" (null)
FAIL E2 explicit, E4 Settings, E5                        locator.click timeout: no Appearance radiogroup
FAIL E3 (×4)                                             expect(locator).toBeVisible / toHaveCount: no Appearance control
FAIL E6 (×4)                                             data-appearance before the bundle runs (null)
PASS E8, E9 (×8 combinations), E9 pre-render             (regressions: today's colours)
```

## Amendment (2026-10-31, during Implementation, approved by David)

Two tests were re-aimed by the Tester once the implementation surfaced them. Neither loosens what it guards.

- **E4 "nothing sent".** It recorded from page load, so it counted the read-only Cypher `POST /api/neo4j/query` that
  `/assistants` already makes on load, with no click. It now records from the click on, and counts a read-only
  Cypher POST as a read, by the server's own `WRITE_KEYWORDS`, as `my-assistants.spec.js` does. It still requires
  that nothing names appearance or theme, and that the look changed, so the path under test ran.
- **`treasure-map-needs-attention` S3.** It pinned the badge's literal `#b45309` on `#fffbeb`, but ADR 0001 makes
  those tokens. It now resolves the colour and the background against the design shell's light tokens (every
  `.bsd-page` rule), with the same values and the same 4.5:1. A mutant light `--bsd-warn-bg: #fffbec` fails it
  ("background is "#fffbec", want #fffbeb").

After the amendment: Node 15/15, `treasure-map-needs-attention` 6/6, Playwright 32/32 against the implemented build.

## Amendment 2 (2026-10-31, after review 1 CHANGES_REQUESTED, approved by David)

Review 1 found Dark defects the tests let through (Blocking 3-6), the search home's own user menu without a control
(Blocking 1), and the signed-out top bar breaking at phone width (Blocking 2). The Tester widened the tests first.
Each new check below fails on the implementation commit `668072907`.

| Finding | Check | File | Fails at `668072907` with |
|---|---|---|---|
| B5, B6 literals in the Dictionary's rules | `T2` now covers `.dict-` rules too, with a named allowlist (empty) | `test/appearance-setting.test.js` | 33 literal colours (e.g. `.dict-pill-btn { color: #fff }`) |
| B4 `--dict-cyan` | `T3` requires a dark value for every colour token in a `.bsd-page` or `.dict-skin-light` rule; `K1` measures `--dict-cyan` and `--bsd-on-accent` | same | `--dict-cyan` has no dark value |
| B3, B6 pairs | `K2` (new): every text-on-background pair a shell rule paints, in Dark, ≥ 4.5:1. The missing half comes from the rule it refines; translucent backgrounds are laid over `--bg` | same | 17 pairs, e.g. `.bsd-tm-toast` 1.14:1, `.bsd-managed-avatar.is-union` 1.62:1, `.dict-pill-btn` 2.72:1 |
| non-blocking 4 | `P2` takes its paths from `DESIGN_SHELL_PATH_PREFIXES` and pins the script's list to the library's | same | (passes: the lists agree) |
| B1 search home | `E3` signed in and signed out now include `/` | `tests/brainstorm/appearance-setting.spec.js` | no Appearance radiogroup on `/` |
| B2 phone width | `E11` (new): at 375 and 414 px, signed out, on `/`, `/about`, `/setup`, `/settings`, `/assistants`, `/dictionary`, `/treasure-map`: Sign in ≤ 44 px tall, the control on its row, no sideways scroll | same | no control on `/` (the first page checked) |
| B3, B6 | `E7` also sweeps a Dictionary entry page, and `/assistants` signed in with your local Assistant listed. Each asserts first that what it sweeps rendered | same | `span.bsd-ma-avatar "n": 2.72:1` |
| non-blocking 2 | `E4` asserts no writes at its end too | same | (passes) |

The mock for `GET /api/assistant/my-assistants` now answers `signedIn`. Without it, the page showed its sign-in line
even when signed in, so E7's earlier signed-in sweep of `/assistants` had read the sign-in line, not the list.
