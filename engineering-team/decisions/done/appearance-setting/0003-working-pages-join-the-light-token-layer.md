# ADR 0003: The working pages and pieces join ADR 0002's light token layer

**Status:** Accepted
**Date:** 2026-11-01
**Story:** `engineering-team/stories/appearance-setting/3-light-look-working-pages.md`

## Context

Story 3 gives the working pages and the working pieces (tags, pins, trusted lists, the Manage Tags dialog, the
Assistant hub's and setup's own pieces) a light look in Light, wherever they appear. Dark stays exactly as today. It
also fixes the `/about` Admins count chip. Story 3 ships with story 2 (book decision 5).

**ADR 0002 is the mechanism.** It's on `feat/appearance-setting` with Amendment 1:
- every colour, and every dimmed opacity, in a converted rule is written as `var(--bsp-<role>, <today's value>)`;
- the tokens are declared only in `:root[data-appearance="light"] body:has(:is(.bsp-page, .bss-page))`;
- reading paths get a `profile` pre-render hint;
- story 2 deliberately left the story-3 families alone, and test T5 enforces that.

What the code has (inventory at `eb036a08f`):

- **Every working page is a `.bsp-page`.** That covers 17 page files under `pages/Tags.jsx`, `Tag.jsx`, `Pins.jsx`,
  `components/PinRedirect.jsx`, `pages/assistant/*`, `pages/setup/*` and `pages/developers/*`. So the light scope
  already reaches them and their working pieces, on reading pages too. No portals.
- **About 855 CSS rules name a class these pages render.** Many are story 2's, already converted. The rest hold about
  382 literal colours plus fallbacks, mostly in the story-3 families: `bs-tag*` 95, `bs-pindetail*` 42, `bs-setup*` 40,
  `bs-tl*` 34, `bs-pins*` 33, `bs-tagindex*` 27, `bs-assistant*` 26, `bs-idtags*` 22, `ptc-*`, `ptd`/`ptd-*`, `pcd-*`
  and others.
- **Inline colours: 14.**
  - `components/AssistantProfileEditor.jsx`, 8: status colours, a link, notice boxes, and an input style reading
    `var(--bg-primary, #0f0f23)`.
  - `pages/developers/DevPage.jsx`, 5: code and pre blocks on `rgba(255,255,255,…)`.
  - `utils/compositeAvatar.js:23`, `RING_COLOR = '#0d1117'`. This is drawn into a canvas that **produces the
    Assistant's published profile picture** (`compositeAvatar` → `stampedAvatar.js`). It's content, not appearance.
- **The `/about` count chip** (`components/AboutThisInstance.jsx:14-20`) sits inside a label whose dim opacity is 0.72
  in Light, on a 0.18 accent tint, and its text is the accent. That renders at about 2.7:1 (review 2-R2-1).
- **The pre-render hint** covers only story 2's reading paths. `/tags`, `/pins`, `/assistant`, `/setup` and
  `/developers` show today's dark canvas before React mounts, so they'd flash dark in Light.

No concepts; no firmware change.

## Options considered

### Option A — Extend ADR 0002 to the story-3 families: the same wrapper and roles, the same light scope, a widened pre-render list

Run ADR 0002's conversion over every rule naming a class the working pages or working pieces render, now including
the story-3 families. Use the same role map, the same opacity rule and the same light scope, adding light tokens only
where a new role is needed.

Pros: no new mechanism, so Dark stays identical by the same construction and the same tests. One palette for the whole
light site.
Cons: none of substance. It's ADR 0002's own stated next step.

### Option B — A separate token family for the working pages (`--bsw-*`)

It would keep the two stories' conversions apart in the stylesheet. But it splits one light look across two palettes
that must be kept equal, and every shared piece (the Manage Tags dialog on a profile) would need both. Rejected.

## Decision

We chose **Option A**.

Sub-decisions:

1. **Scope:**
   - every rule (outside `.bsd-`, `.dict-` and the appearance-scoped rules) naming a class rendered by the working
     pages, by the reading pages' working pieces, or by the story-3 families of ADR 0002 sub-decision 7;
   - the bare `ptc`, `ptd` and `pcd` too;
   - the global element rules story 2 already wrapped stay as they are.

   Story 2's T5 is retired: its rule ("leave story 3 alone") was story 2's, and story 3 inverts it.
2. **The role map and light values are ADR 0002's.** A role story 3 needs that story 2 didn't (for example a tint
   bucket or an ink not yet declared) is added to the same light scope with a design-shell value. A colour gets the
   darker family ink when its text sits on its family's tint (`--bsp-<family>-ink`), and `--bsp-on-accent` when it
   sits on a solid hue.
3. **The opacity rule is ADR 0002 Amendment 1's:** non-disabled `opacity: X < 1` becomes `var(--bsp-opacity-soft, X)`
   or `var(--bsp-opacity-dim, X)`.
4. **Inline colours** in `AssistantProfileEditor.jsx` and `DevPage.jsx` are wrapped as story 2's were. Each colour
   string starts `var(--bsp-…, …)`, and border shorthands split into width/style plus a colour property.
   **`compositeAvatar.js`'s `RING_COLOR` is not touched:** it's drawn into a published image and must be the same
   whoever makes it.
5. **The pre-render hint widens:**
   - `src/lib/appearance.js` gains `WORKING_PATH_PREFIXES`: `/tags`, `/tag`, `/pins`, `/pin`, `/assistant`, `/setup`,
     `/developers`;
   - `preloadFamily` returns `'profile'` for them as well, after the design-shell check, so `/assistants` (the design
     shell) is never mistaken for `/assistant`;
   - `ui/index.html`'s hand copy holds the same list.

   Story 4 retires the lists.
6. **The `/about` count chip:** its text reads `--bsp-accent-ink` (`#5b21d6`), giving about 3.5:1 as rendered under
   the label's 0.72 dim on the 0.18 tint. Dark stays `#a5b4fc`. The chip stays inside its label: the layout doesn't
   change.

## Consequences

- **Enables** stories 2 and 3 to ship together with no known Light gap on any profile-family page. Story 4 is then
  "add `.bs-page` to the scope and retire the path lists".
- **Constrains:** every family under `.bsp-page` is converted after this story, so the reviewer rule of ADR 0002
  ("a new colour in a converted rule is a wrapper, never a bare literal") now covers the whole profile family.
- **Firmware reinstall required?** No.

## Implementation notes

- **`ui/src/styles.css`:** rerun story 2's conversion with:
  - the class inventory widened to the working pages' files (the 17 page files above, following local imports);
  - the story-3 exclusion removed.

  The same script rules apply: wrap, never rewrite; skip rules already wrapped; resolve a `var()` against `:root` to
  classify it. Then wrap the opacities by Amendment 1's rule, and add any new token to the light scope with its
  design-shell value.
- **`src/lib/appearance.js`, `ui/index.html`:** `WORKING_PATH_PREFIXES`, `isWorkingPath`, and `preloadFamily`
  extended (design first, then reading or working → `'profile'`).
- **JSX:** `AssistantProfileEditor.jsx` (8 colours) and `DevPage.jsx` (5), as sub-decision 4.
  `AboutThisInstance.jsx`'s `chipStyle.color` reads `var(--bsp-accent-ink, ${ACCENT})`.

**What the tests must pin (for the Tester).**
- **Story 2's suites, extended to the working pages:**
  - T1 still holds against this story's base, the head of story 2;
  - T3 every token read is declared;
  - T4 over the widened inventory, with the story-3 exclusion removed;
  - K2 over the same;
  - I1 over the two new files;
  - P1 and P2 over the three lists.
- **T5 retired.** In its place: no rule in the profile family holds a bare colour.
- **The browser:**
  - an L1-style sweep in Light of every working page, signed out and signed in (an owner where a page has owner-only
    parts, e.g. `/assistant` and `/setup`);
  - the reading pages again, with their working pieces now included in the sweep: the Manage Tags dialog opened, a
    profile with pins and tags mocked;
  - the sweep composites translucent backgrounds as well as the text's opacity (review 2-R2-1);
  - L3-style Dark snapshots of every working page from a build of this story's base;
  - no flash on two working paths;
  - phones at 375 and 414 px;
  - the search home, `/tapestry/` and the design shell unchanged.
- **The chip:** `/about`'s Admins count at 3:1 or better in Light as rendered, and `#a5b4fc` in Dark.
- **`compositeAvatar.js`'s `RING_COLOR` is unchanged** (a static check).

## Out of scope

- The search home (story 4), the admin pages (book decision 2), widths below 375px.
- The colours inside generated images (`compositeAvatar.js`): content, not appearance.
