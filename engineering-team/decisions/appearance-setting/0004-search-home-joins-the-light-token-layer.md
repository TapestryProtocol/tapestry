# ADR 0004: The search home joins the light token layer, with an exact pre-render path

**Status:** Accepted
**Date:** 2026-11-01
**Story:** `engineering-team/stories/appearance-setting/4-light-look-search-home.md`

## Context

Story 4 gives the search home (`/`, landing and results) the light look in Light and keeps Dark exactly as today. It is
the book's last story.

ADRs 0002 (with Amendment 1) and 0003 are the mechanism, in production on staging since `d1b9c3077`:
- every colour, and every dimmed opacity, in a converted rule is written as `var(--bsp-<role>, <today's value>)`;
- the tokens are declared only in `:root[data-appearance="light"] body:has(:is(.bsp-page, .bss-page))`;
- the reading and working paths get a `profile` pre-render hint from two prefix lists.

ADR 0003 forecast story 4 as "add `.bs-page` to the scope and retire the path lists". The first half holds; the second
doesn't (see sub-decision 4).

What the code has (inventory at `b9332376f`):

- **The search home is one page file, `pages/BrainstormSearch.jsx`.** Its landing (`:1124`) and results (`:1361`)
  roots are both `.bs-page`, and nothing else in `ui/src` uses that class. It reaches three files stories 2–3 didn't:
  `components/TagResultRow.jsx`, `components/PinnedTagChips.jsx` and `hooks/useTagMemberSets.js`. The shared
  `SearchInput`, `TopBar`, the alerts and `AppearanceControl` are already converted.
- **It renders 154 stylesheet classes, 89 of them new to the conversion.** About 250 rules name them. They hold 87 bare
  colours and 30 literal opacities (some of those on disabled states). The families are `bs-tag*` (the search's tag
  hits) 14, `bs-suggest*` 13, `bs-result*` 12, `bs-pov*` 10, `bs-pin*` 9, `bs-search*` (the landing variant) 6,
  `bs-matched*` 6, `bs-usermenu*` 6 (its own menu, including story 2's carry-over `.bs-usermenu-pov-indicator strong`,
  `#a5b4fc`), `bs-personalization*` 6, `bs-load*` 5, `bs-wot*`, `bs-nip05*`, `bs-error*`, `bs-footer*` and
  `bs-page` itself (`background: var(--bg-primary, #0f0f23)`).
- **Two meanings carried by colour:**
  - the freshness marker `.bs-result-age.stale` (`#d29922`, amber);
  - the badges `.bs-wot-rank` (Verification Score, blue `#58a6ff` on a blue tint) and `.bs-wot-followers` (Verified
    Followers, green `#3fb950` on a green tint).
- **The pre-render hint has no entry for `/`.** It can't be a prefix: every path starts with `/`.
- **A gap from story 3:** `/information-for-agents` renders through `DevPage` (a `.bsp-page`), so it's light in Light.
  It's in neither path list, though, so it shows the dark canvas first.
- **Paths in no family:** the top-level `*` route renders `NotFound` (`pages/NotFound.jsx`). It's a bare page on the
  dark global palette, with inline `#a5b4fc` and `rgba(255,255,255,0.06)`. It belongs to no family and is out of scope.

No concepts; no firmware change.

## Options considered

### Option A — `.bs-page` joins the light scope; convert with ADR 0002/0003's rules; an exact `/` in the pre-render hint

- Add `.bs-page` to the `:is()` of the light scope.
- Run the same conversion over every rule naming a class the search home renders: the same role map and opacity rule,
  and the same "wrap, never rewrite".
- The pre-render hint gains an exact search-home path beside the two prefix lists.

Pros: the same construction keeps Dark identical. Shared pieces (the pinned chips, the tag rows, the avatar menu) are
already wrapped and turn light here with no further change. One palette for the whole site.
Cons: none of substance.

### Option B — Retire the path lists: `profile` for every path that isn't admin or design shell

This is ADR 0003's forecast. It's simpler, and a new page can't be forgotten. But `NotFound` at an unknown path, and
any future page outside the families, would get the light pre-render canvas and then render dark: a flash the other
way. Rejected. The lists stay, and say exactly which pages are in a family.

### Option C — Fold the search home into the design shell (`--bsd-*`)

Its look is closer to the profile family's (the same top bar, menu and chips), and the shared pieces already read
`--bsp-*`. Using the design shell's tokens would mean wrapping those pieces twice. Rejected.

## Decision

We chose **Option A**.

Sub-decisions:

1. **Scope:**
   - every rule (outside `.bsd-`, `.dict-` and the appearance-scoped rules) naming a class the search home renders,
     the landing variant of the shared `SearchInput` (`*-landing`) included;
   - the light scope's selector becomes `body:has(:is(.bsp-page, .bss-page, .bs-page))`;
   - the `-landing` exclusion stories 3's tests made (T2, W8) is removed.
2. **The role map, light values and opacity rule are ADR 0002's and 0003's.** A role this story needs that isn't yet
   declared is added to the same light scope with its design-shell value (expected: `--bsp-cyan-ink` `#0e7490`, from
   `--bsd-cyan-ink`, and a cyan tint bucket). Disabled and inactive states keep their literal opacity (review 3-R1,
   Blocking 4).
3. **The two meanings carried by colour:**
   - **the stale marker** reads `--bsp-warn-ink` (`#92400e`): amber-brown, which still reads as a warning. That's
     6.4:1 on the canvas and 7.1:1 on a white card;
   - **Verification Score** reads `--bsp-cyan-ink` on a cyan tint. Cyan is the design shell's nearest hue to today's
     blue, and it isn't the accent, so the badge doesn't read as a link;
   - **Verified Followers** reads `--bsp-success-ink` (`#065f46`) on a success tint.

   The two badges then differ by about 30° of hue and by their own icons (🏅 and 👥). On white, cyan-ink is 5.4:1 and
   success-ink 7.7:1. The tint takes a little off, so the tests measure each badge at 4.5:1 or better as rendered. If
   David wants more separation, the alternative is the accent for Verification Score. That's a one-token change.
4. **The pre-render hint:**
   - `src/lib/appearance.js` gains `SEARCH_HOME_PATH = '/'` and `isSearchHomePath(pathname)`, an **exact** match
     (the query string isn't part of the pathname);
   - `preloadFamily` returns `'profile'` for it, after the design-shell check;
   - `/information-for-agents` joins `WORKING_PATH_PREFIXES` beside `/developers` (story 3's gap);
   - `ui/index.html`'s hand copy holds the same;
   - every other path keeps today's answer, so an unknown path (`NotFound`) still gets no hint.
5. **Inline styles:** the files the search home newly reaches are walked by I1/I4. Any inline colour is wrapped as story
   3's were, and any dimming opacity reads an opacity token.
6. **The test harness's round-2 notes (review 3-R2), for the Tester:**
   - **narrow the class finder's `prefix-${` rule.** A prefix counts only when it has at least two segments (`bs-tag-`,
     `settings-message-`), and never when it's a state prefix (`is-`, `has-`). Today `is-${…}` pulls in every `is-*`
     class;
   - **tighten I4's exemption.** A line is exempt only where the opacity itself is chosen by a disabled condition (for
     example `opacity: disabled ? 0.5 : 1`), not wherever the word "disabled" appears;
   - **test changes go in the Tester's commits,** including any made during Implementation (a Tester amendment
     commit, then the implementation).

## Consequences

- **Enables** the book's acceptance frame to be met. Every Brainstorm-styled page follows the choice, and going between
  them no longer flips the look. After this story's PASS, the book is ready to offer for `/close-book`.
- **Constrains:**
  - the reviewer rule of ADR 0002 ("a new colour in a converted rule is a wrapper, never a bare literal") now covers the
    search home too;
  - a new top-level page that joins a family must add its path to one of the lists, or it flashes. The P-tests
    enumerate the router's non-admin paths, so a new one fails them until it's listed or named as out of scope.
- **Amends** ADR 0003's forecast that story 4 retires the path lists (Option B above).
- **Firmware reinstall required?** No.

## Implementation notes

- **`ui/src/styles.css`:**
  - widen the light scope's `:is()`;
  - rerun the conversion with the inventory widened to `pages/BrainstormSearch.jsx` (following local imports), the
    classifier fixed as in story 3 round 1 (grey stays a grey under chroma 0.2, disabled selectors skipped, the wider
    finder);
  - wrap `.bs-page`'s background to `--bsp-canvas` and its text to `--bsp-ink`;
  - hand-map the badges, the stale marker and `.bs-usermenu-pov-indicator strong` (`--bsp-accent-ink`) as in
    sub-decision 3;
  - add any new tokens to the light scope.
- **`src/lib/appearance.js`, `ui/index.html`:** as sub-decision 4.
- **JSX:** any inline colours or opacities in `BrainstormSearch.jsx`, `TagResultRow.jsx` and `PinnedTagChips.jsx`.

**What the tests must pin (for the Tester).**
- **Node:**
  - **T1:** Dark and every untouched page are unchanged against this story's base (wrappers stripped);
  - **T2/T3/T4/T5/K1/I1/I4** extended to the search home's files and classes, the `-landing` exclusion removed;
  - **C/P:** the exact `/` path, `/information-for-agents`, lookalikes (`/foo`, `/x/`, `''`) getting no hint, and the
    hand copy matching the library. Also a check that every non-admin route in `App.jsx` is either in a list or named
    as out of scope (`*`).
- **Browser:**
  - a sweep of `/` in Light, landing and results, with **populated mocks**: people results, a stale result, both
    badges, matched fields, tag hits, pinned-tag chips, the suggestions open, the POV picker and personalization
    explainer open, and the empty, loading and error states. Signed out, and signed in with the avatar menu open.
    Translucent backgrounds composited, and inputs' typed text measured;
  - **W8's class probe** extended to the search home's rules;
  - the badges at 4.5:1 each, with their hues told apart;
  - Dark snapshots of `/` (landing and results, with the same mocks) from a build of this story's base;
  - no flash on `/` and `/?q=…` in both directions;
  - no flip on `/` → a profile → `/settings` → back;
  - phones at 375 and 414 px;
  - `/tapestry/` and `NotFound` unchanged;
  - the earlier stories' specs still green.

## Out of scope

- The `/tapestry/*` admin pages (book decision 2), and `NotFound`, which belongs to no family.
- Widths below 375px.
- How search, ranking or personalization behave.

## Amendment 1 (2026-11-01, after review 1)

Review 1 (CHANGES_REQUESTED) found three things the decision above didn't cover. Each fix changes Light only; Dark keeps
today's values.

- **Light-only rules inside the light scope.** A few corrections can't be written as a wrapper over today's value,
  because Dark's value comes from a different rule or from an opacity that has to stay. These are written as rules
  under the light scope selector (`:root[data-appearance="light"] body:has(:is(.bsp-page, .bss-page, .bs-page)) <rule>`),
  in one block after the token declarations. Dark never matches them. Story 3's T1 and this story's T1 ignore scoped
  rules by construction, and H5 snapshots Dark.
- **The unavailable point-of-view option holds a working link.**
  - `.bs-pov-option.disabled` ("Your personalized perspective is being calculated. Settings") is dimmed with
    `opacity: 0.5`. Under ADR 0002 Amendment 1 and story 3's T4, a disabled state keeps that literal in both looks.
  - Its Settings link is a working link, though: the way forward for a newly signed-in person. Under the group opacity
    it reads 2.29:1 in Light.
  - **Exception, this selector only:** in Light the option has `opacity: 1` and is dimmed by colour (`--bsp-muted`), so
    the link reads whole in the accent ink. Dark keeps the literal 0.5 (1.81:1 today, unchanged), and T4 still holds for
    every unscoped disabled rule.
- **A hovered result card.** The card is a link, so the global `a:hover` colour (the link-hover purple) is inherited by
  its text, and under the 0.72 dim that reads 3.97:1. In Light, `.bs-result-card:hover` keeps its text in `--bsp-ink`.
  The hover cue is the card's border and tint, as today.
- **"Not Personalized" gets a hover cue in Light.** Its `:hover { opacity: 0.8 }` reads the soft token, which is 1 in
  Light, so hovering showed nothing. In Light it underlines on hover.
- **`/information-for-agents`** (sub-decision 4 adopted its path): its field's border and fill and its status line's
  dimming are wrapped like story 3's inline styles (`--bsp-border`, `--bsp-surface`, `--bsp-opacity-soft`), so the
  field has a visible edge in Light.
