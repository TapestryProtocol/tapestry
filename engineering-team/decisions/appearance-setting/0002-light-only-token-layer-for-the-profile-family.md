# ADR 0002: A light-only token layer for the profile family, with today's colour as every fallback

**Status:** Accepted
**Date:** 2026-11-01
**Story:** `engineering-team/stories/appearance-setting/2-light-look-frame-and-reading-pages.md`

## Context

Story 2 gives the frame (top bar, avatar menu, alerts, Sign in control) and the reading pages a light look in Light.
The light look matches the design shell's light look (book decision 4). Dark must stay exactly as today, and the
search home, the admin pages and story 3's content must not change. Story 2 ships together with story 3 (book
decision 5).

The mechanism is ADR 0001's, already on staging (`56d76a2b4`):
- `<html data-appearance="light|dark">`, set before the bundle by `ui/index.html` and kept by `AppearanceProvider`;
- a pre-render hint, `data-preload-family="design"`, on the design-shell paths (`src/lib/appearance.js`
  `DESIGN_SHELL_PATH_PREFIXES`).

This ADR decides how the profile family's colours gain a light set.

What the code has (inventory, scratch script over `ui/src` at `1ab421bf8`):

- **The pages.** The reading pages are listed in the story: `/about`, `/about-brainstorm-search`, `/how-search-works`,
  `/brainstorm-skill`, `/personalization`, `/settings`, `/user/:pubkey` and its `follows`, `followers`, `reporters`,
  `muters`, `follows-hops` and `notes`, `/feed` and `/event` (`ui/src/App.jsx:169-251`). Each renders a `.bsp-page`
  container (`/settings`: `.bss-page`) with `TopBar` or its own top bar and `BrainstormUserMenu`.
  - Following their local imports reaches 92 files and 360 class names. None of those files calls `createPortal`, so
    everything they render sits inside the page container.
- **How the family paints today.** Two ways:
  - **literal colours,** e.g. `color: #a5b4fc` on links and back buttons;
  - **`var(--x, <literal>)`,** e.g. `.bsp-page { background: var(--bg-primary, #0f0f1a) }` (`styles.css:3768-3772`).
    Some of those names exist on `:root` (the admin palette: `--bg`, `--bg-secondary`, `--text`, `--border` …,
    `styles.css:6-30`), so they paint the admin value, not their fallback. Others (`--bg-primary`, `--text-primary`)
    are defined nowhere outside `.bsd-page`, so their fallback is what paints.

  About 509 CSS rules name a class these pages render, holding 273 literal colours and 104 colour fallbacks. Part of
  that belongs to story 3 (`bs-tag*`, `ptc-*`, `ptd-*` and so on).
- **Inline colours** written into JSX style props: 18, in `AboutThisInstance.jsx` (6), `BrainstormAboutSearch.jsx` (4),
  `BrainstormAbout.jsx` (3), `BrainstormPersonalization.jsx` (3), `BrainstormHowSearchWorks.jsx` (1) and
  `BrainstormSkill.jsx` (1).
- **The frame is shared** with pages that must not change:
  - the search home (`.bs-page`) uses the same `bs-usermenu-*`, `bs-link-btn` and `bs-appearance-*` classes through
    its own `UserMenu` (`BrainstormSearch.jsx`);
  - the design shell restyles the menu through `.bsd-page .bs-usermenu-*` overrides;
  - story 3's pages are `.bsp-page` too.
- **Before React mounts,** `body` paints the admin `--bg` (`#0d1117`). A reading page in Light would flash dark on
  load unless something paints its canvas first.

No concepts are touched; no firmware change.

## Options considered

### Option A — A light-only token layer: every colour reads `var(--bsp-<role>, <today's value>)`, and the tokens are defined only while the page is light

- Every colour a frame or reading-page rule paints is rewritten as `var(--bsp-<role>, <exactly what was there>)`:
  - a literal `#a5b4fc` becomes `var(--bsp-link, #a5b4fc)`;
  - an existing `var(--bg-primary, #0f0f1a)` becomes `var(--bsp-canvas, var(--bg-primary, #0f0f1a))`.
- The `--bsp-*` tokens are declared in one place only: a light scope,
  `:root[data-appearance="light"] body:has(:is(.bsp-page, .bss-page))`, with the design shell's light values.
- Where the tokens aren't defined (Dark, the search home, the admin pages, the design shell), every rule falls back to
  exactly what it holds today.

Pros:
- Dark is unchanged by construction: removing each `var(--bsp-…, ` wrapper gives back the old text, and a test can
  check exactly that.
- No dark values need choosing or keeping in step.
- The shared frame stays dark on the search home and untouched in the design shell, with no extra rules.
- Story 3 uses the same layer for its pieces, and story 4 widens the scope to `.bs-page`.

Cons:
- Every converted value grows a wrapper.
- Light is the only look defined in tokens, the reverse of story 1. That's acceptable, because the dark look here
  *is* today's colours.

### Option B — Story 1's pattern: tokens with a light and a dark value, declared on the page container

Each token would need a declared dark value equal to today's colour. The shared frame rules render outside
`.bsp-page` too (the search home, the design shell), so they'd still need fallbacks for those places. That's two
copies of every dark colour, for nothing. Rejected.

### Option C — CSS `light-dark()` with a `color-scheme` per scope

`light-dark(<light>, <dark>)` in each rule, with `color-scheme: light` on the light scope and `color-scheme: dark`
everywhere else.
- It needs `color-scheme: dark` set on every page that stays dark (the search home, the admin pages). That changes
  their native controls and scrollbars, which breaks the story's "everything else unchanged".
- It also needs browsers from 2024 or later.

Rejected.

## Decision

We chose **Option A**. It's the only option where Dark and every untouched page are unchanged by construction, and
the shared frame needs no per-page exceptions.

Sub-decisions:

1. **Tokens are named by role**, prefix `--bsp-`. For example: `--bsp-canvas`, `--bsp-surface`,
   `--bsp-surface-2`, `--bsp-line`, `--bsp-ink`, `--bsp-ink-2`, `--bsp-muted`, `--bsp-faint`, `--bsp-link`,
   `--bsp-accent`, `--bsp-accent-ink`, `--bsp-on-accent`, `--bsp-warn-*`, `--bsp-danger-*`, `--bsp-success-*`,
   `--bsp-shadow-*`, and tints. Story 1's rule holds: one meaning per token, so white text on a solid accent is never
   the same token as a white card.
2. **The light values are the design shell's light values**, written as the same literals, not as references (the
   `.bsd-page` tokens aren't defined on these pages):

   | Role | Value |
   |---|---|
   | canvas | `#f2f3f0` |
   | surface | `#ffffff` |
   | surface-2 | `#fafaf9` |
   | border | `#d6d9db` |
   | line | `#e8eae7` |
   | hairline | `#f0f1ee` |
   | ink | `#0a0e18` |
   | ink-primary | `#2a303b` |
   | ink-2 | `#555d69` |
   | muted | `#6b7480` |
   | accent / link | `#7237ff` |
   | accent-hover | `#612fd9` |
   | danger | `#b42318` |
   | success | `#047857` |
   | warning | `#b45309` |
   | warning bg | `#fffbeb` |
   | accent tints | `rgba(114, 55, 255, α)` |

   Today's indigo accent (`#a5b4fc` and its tints) becomes the purple accent in Light.
3. **The light scope** is `:root[data-appearance="light"] body:has(:is(.bsp-page, .bss-page))`. It sits on `body`, so
   anything fixed or appended later inherits it.
   - It also sets `background: #f2f3f0` on that `body` and `color-scheme: light`.
   - Story 3's pages are `.bsp-page` as well. In this story their frame turns light and their content stays as it is,
     the interim state the story accepts, because 2 and 3 ship together.
4. **Dark is the fallback, character for character.** Converting a value never changes it. It only wraps it.
5. **No flash: a second pre-render hint.**
   - `src/lib/appearance.js` gains `READING_PATH_PREFIXES`: `/about`, `/about-brainstorm-search`,
     `/how-search-works`, `/brainstorm-skill`, `/personalization`, `/settings`, `/user`, `/feed`, `/event`.
   - It also gains `preloadFamily(pathname)`, returning `'design'`, `'profile'` or `null`, to replace the hint test.
   - `ui/index.html`'s hand copy sets `data-preload-family="profile"` on those paths.
   - One CSS rule, `:root[data-appearance="light"][data-preload-family="profile"] body { background: #f2f3f0; }`,
     paints the light canvas before React mounts. In Dark the hint paints nothing new, so the pre-render background
     stays today's.
   - Story 3 adds its paths, and story 4 retires both lists (ADR 0001 sub-decision 4).
6. **Inline colours** in JSX become the same wrapper as a string, for example
   `style={{ color: 'var(--bsp-link, #a5b4fc)' }}`.
7. **Scope of the rewrite: the frame and the reading pages' own pieces.** Story 3's families stay as they are:
   - tags: `bs-tag*`, `bs-tagindex*`;
   - pins: `bs-pin*`, `bs-pins*`, `bs-pindetail*`;
   - trusted lists: `bs-tl*`;
   - the profile tag and pin components: `ptc-*`, `ptd-*`, `pcd-*`;
   - the Assistant and setup pages: `bs-assistant*`, `bs-idtags*`, `bs-outbox*`, the `bs-setup-*` step rules (not
     `.bs-setup-alert`, which is frame).

   The Implementer works from the inventory's class list minus those families, and records the final list in the
   test plan's terms.

## Consequences

- **Enables** story 3 as the same rewrite over its families with no new mechanism, and story 4 as
  "add `.bs-page` to the scope, retire the path lists".
- **Constrains:** a new colour in a converted rule must be written as `var(--bsp-<role>, <dark value>)`, and the
  Reviewer should reject a bare literal there. The light values are a second copy of the design shell's light
  values, so a test must pin them equal.
- **Accepted interim:** until story 3 lands, a reading page that shows a tag, pin or trusted-list piece shows it dark
  in Light. The story allows this, and it never reaches staging (book decision 5).
- **Firmware reinstall required?** No.

## Implementation notes

- **`ui/src/styles.css`.**
  1. For every rule naming a story-2 class (not under `.bsd-`, `.dict-` or `[data-appearance]`), wrap each colour
     value (in `color`, `background*`, `border*`, `outline*`, `box-shadow`, `text-shadow`, `fill`, `stroke`,
     `text-decoration-color`, `caret-color`) as `var(--bsp-<role>, <original>)`.
  2. Gradients wrap per stop.
  3. Leave `transparent`, `inherit` and `currentColor` alone.
  4. Put the light scope block and the two `body` rules (the scope's own background and the pre-render hint) in one
     new commented section after `.bss-page`.
  5. A scripted conversion like story 1's (a role map per (property kind, value), failing on any value it can't
     place) is the recommended way. Keep the map in the scratchpad, not the repo.
- **`src/lib/appearance.js`:** add `READING_PATH_PREFIXES`, `isReadingPath` and `preloadFamily`, keeping
  `isDesignShellPath`.
- **`ui/index.html`:** extend the hand copy to set `data-preload-family` to `design` or `profile`. It must stay a
  faithful copy (test P2).
- **`ui/src/context/AppearanceContext.jsx`:** unchanged. It already removes `data-preload-family` after the first
  render.
- **JSX:** the 18 inline colours above, in those six files.

**What the tests must pin (for the Tester).**
- **Dark and untouched pages, character for character.** Strip every `var(--bsp-<x>, ` wrapper (keeping its fallback)
  from today's stylesheet, and every rule must read as it did at the story's base (`56d76a2b4`). Story 1's T1/T4
  resolution helpers can do it.
- **The light values equal the design shell's** for canvas, surface, ink, ink-primary, muted and accent.
- **Every `--bsp-*` token read anywhere is declared in the light scope.** A token read but never declared would leave
  that piece dark in Light.
- **Contrast in Light** for the token pairs and for each rule's painted pairs, story 1's K2 run against the light
  scope.
- **The browser:**
  - an E7-style sweep in Light of every reading page, signed out and signed in with the menu open, allowing story 3's
    families;
  - the core colours matching the design shell's;
  - no flash on reading paths (E6-style, Light on a dark computer and the reverse);
  - phone widths at 375 and 414 px;
  - the search home, `/tapestry/`, the design-shell pages and a story-3 page's content unchanged in Light.
- **The pre-render parity test (P2)** extended to `preloadFamily`.

## Out of scope

- Story 3's families and pages, story 4's search home, and the admin pages.
- Folding the profile family's dark look into tokens with a declared dark value (Option B). If wanted later, it's
  a refactor with no visible change.
- Widths below 375px (ledger row `2026-10-31-profile-bar-overflows-at-320px`).
