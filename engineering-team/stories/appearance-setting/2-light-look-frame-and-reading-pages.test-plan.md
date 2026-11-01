# Test Plan: Story 2 — A light look for the frame and the reading pages

**Story:** `engineering-team/stories/appearance-setting/2-light-look-frame-and-reading-pages.md`
**ADR:** `engineering-team/decisions/appearance-setting/0002-light-only-token-layer-for-the-profile-family.md`
**Date:** 2026-11-01

Two files:
- `test/appearance-setting-light.test.js` (Node, in the gate);
- `tests/brainstorm/appearance-setting-light.spec.js` (Playwright, B-class), with its snapshot fixture
  `tests/brainstorm/fixtures/appearance-setting-2-baseline.json`.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 reading pages light in Light | `L1` each of the 15 reading pages in Light, signed out and signed in with the menu open: the page background is the light canvas; no dark surface (opaque, ≥ 40×20 px, luminance < 0.15) outside story 3's families; text ≥ 3:1, links and paragraphs ≥ 4.5:1 | spec | browser |
| AC-1 | `T3` every `--bsp-` token read (stylesheet or JSX) is declared in the light scope; `T4` every colour a story-2 rule paints reads a `--bsp-` token; `I1` the 18 inline JSX colours too | Node | unit |
| AC-1 contrast | `K1` core inks on canvas and surface ≥ 4.5:1; `K2` every pair a story-2 rule paints, in Light, ≥ 4.5:1 | Node | unit |
| AC-2 one light look | `T2` the light scope paints body `#f2f3f0` with `color-scheme: light`; `--bsp-canvas/-surface/-ink/-ink-primary/-muted/-accent` equal the design shell's `--bg-primary/--bg/--text/--text-primary/--text-muted/--accent` | Node | unit |
| AC-2 | `L2` `/about`'s page and body background equal `/dictionary`'s; a body link paints the design shell's accent `rgb(114, 55, 255)` | spec | browser |
| AC-3 Dark unchanged | `T1` with the `--bsp-` wrappers stripped, every declaration reads as at base `56d76a2b4` (regression) | Node | unit |
| AC-3 | `L3` snapshot: every element's computed colours on all 15 reading pages, under Dark-chosen and System-dark, plus signed in with the menu open on `/about` and `/user/<pk>`, equal the base build's (regression) | spec | browser |
| AC-4 switching | `L5` on `/about`: Light applies with no reload; System on a dark computer is dark and follows the computer to light live | spec | browser |
| AC-5 no flash | `C1`, `C2` the reading paths and `preloadFamily`; `P1` the script holds both lists; `P2` the script's hint equals `preloadFamily` on every path | Node | unit |
| AC-5 | `L4` with the bundle held: `/about` (Light on dark) and `/user/<pk>` (System on light) show the light canvas before and after render; `/settings` (Dark on light) keeps today's pre-render `rgb(13, 17, 23)` | spec | browser |
| AC-6 phones | `L6` at 375 and 414 px in Light, signed out, all 15 reading pages: Sign in ≤ 44 px, no sideways scroll | spec | browser |
| AC-7 everything else unchanged | `L7` snapshot in Light: the search home, `/tapestry/` and `/dictionary` paint exactly as at base. On `/tags` (story 3), the content's own backgrounds, borders and images are unchanged; the frame and the inherited text colour are left out | spec | browser |

## Edge cases

- [x] A `--bsp-` read with no fallback would leave Dark with no value: T1 fails on it ("a --bsp- token read with no
      fallback").
- [x] A token read but never declared stays dark in Light: T3. It already caught `--bsp-bg`, which is read in
      `.bsp-follows-colpanel` at the base and declared nowhere.
- [x] Story-3 families on a reading page are allowed to stay dark (L1's sweep leaves them out; T4 and K2 skip rules
      that name them).
- [x] The Appearance control's own checked state differs between "Dark chosen" and "System on dark" by design, so
      L3 and L7 leave `.bs-appearance` out of the snapshot.

## Test infrastructure

- **Node:** `test/appearance-setting-light.test.js`, registered in `test/registry.js`.
  - It reuses story 1's CSS reader, colour and pre-render helpers, now exported from `test/appearance-setting.test.js`
    as `helpers`.
  - T1 reads the base stylesheet with `git show 56d76a2b4:ui/src/styles.css`, so it needs full history (CI uses
    `fetch-depth: 0`).
  - T4 and K2 find the story's classes as the ADR's inventory did: they follow the reading pages' and the frame's
    local imports and collect their `className`s, leaving out story 3's families by prefix.
- **Playwright:** run against a **build**.
  - Every `/api` call is mocked, and relay WebSockets are closed so loads are deterministic.
  - `/user/<pk>` uses `b2b2…`, with one mocked profile.
- **The snapshot oracle** (L3, L7) is `fixtures/appearance-setting-2-baseline.json`: 36 snapshots, 953 elements. It
  holds computed `color`, `background-color`, the top and bottom border colours and `background-image`, keyed by tag
  path.
  - **Written:** 2026-11-01, with `APPEARANCE_BASELINE=write`, from a build of `b4807444b`'s UI, which is unchanged
    since base `56d76a2b4`.
  - **Deterministic:** a compare run with 6 workers against the same build passed all 17 snapshot tests.
  - **Rewrite only from a build of the base,** never of the change.

## How to run

```
node test/appearance-setting-light.test.js
```

```
BRAINSTORM_BASE_URL=http://localhost:4174 npx playwright test tests/brainstorm/appearance-setting-light.spec.js --project=chromium
```

## Verification

The new tests fail with the current code. Confirmed on 2026-11-01 at `b4807444b`.

Node, 1 passed and 10 failed:

```
FAIL C1  READING_PATH_PREFIXES should be [...], got undefined
FAIL C2  preloadFamily should be exported
FAIL P1  the script should hold the reading list [...]
FAIL P2  162 path(s) disagree
PASS T1  Dark and every untouched page are unchanged (regression)
FAIL T2  there should be a rule :root[data-appearance="light"] body:has(:is(.bsp-page,.bss-page))
FAIL T3  1 token(s) read but not declared in the light scope: --bsp-bg
FAIL T4  316 colour(s) in story-2 rules don't read a --bsp- token
FAIL I1  inline colours don't read a --bsp- token
FAIL K1, K2  there is no light scope to measure
```

T1 bites. A mutant `var(--bsp-canvas, var(--bg-primary, #0f0f1b))` in `.bsp-page` (`1a` changed to `1b`) failed it with
7 differences. The stylesheet was then restored.

Playwright, against the base build on `:4174`, 22 passed and 19 failed:

```
FAIL L1 (×15)  the page background (not the light canvas)
FAIL L2        the reading page background equals the design shell's page background
FAIL L4 (×2)   the light canvas before render
FAIL L5        Light doesn't change the page
PASS L3 (×15), L7 (×4)   snapshots equal the base (regression; also proves them deterministic)
PASS L4 /settings (Dark), L6 (×2)   regression
```
