# PRD Seed: Appearance setting

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/appearance-setting/audit.md`
**Anchor:** acceptance frame in `book.md` (ngit issue `0dd21d9f`, decisions 1–5)
**Confidence:** high (the frame and every later decision were David's, recorded as they were made)
**Date:** 2026-11-01

> A baseline in PRD shape, built from what shipped. It's a strawman for the product team, not a ratified spec. Tags:
> `[FROM FRAME]` (the kickoff frame or a recorded owner decision), `[INFERRED]` (read off the built system),
> `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` People can choose how Brainstorm looks: **System** (follow the computer), **Light** or **Dark**, as
Brainstorm-UI offers. Before this, each family of pages hard-coded its own palette, so moving around the site flipped
between dark and light.

`[INFERRED]` The aim is comfort and consistency: one chosen look across every page a person uses, with no flash of the
other look on load.

## 2. Personas

`[INFERRED]` Anyone who reads or works in Brainstorm, signed in or out:
- someone who prefers a light screen, or whose computer is set to light (the default, System, now honours that);
- someone who prefers dark, which every page still offers;
- a signed-out visitor, who can choose without an account.

No persona-specific behaviour was built; the setting is the same for everyone.

## 3. Scope (as-built)

- `[FROM FRAME]` Three choices, System by default, kept per browser; never saved to an account or published.
- `[FROM FRAME]` Offered in the avatar menu, on the Settings page, and to signed-out visitors (beside Sign in; on
  phones, one button that opens the three).
- `[FROM FRAME]` No flash of the other look on load.
- `[FROM FRAME]` Every Brainstorm-styled page follows it: the design shell, the frame and reading pages, the working
  pages, the search home. `/information-for-agents` too.
- `[FROM FRAME]` The `/tapestry/*` admin pages stay as they were (dark).
- `[FROM FRAME]` The light look is the design shell's (decision 4).

## 4. Domain model

`[INFERRED]` One entity: **Appearance choice**, with the values `system`, `light` and `dark`. It's stored in the
browser (`tapestry_appearance`), resolved against the computer's setting when it's `system`, and applied to the whole
page. It isn't a nostr event or a concept, and it isn't tied to a point of view: it's a choice made for oneself and
counted for nobody else.

## 5. Design rules (as-built)

- `[FROM FRAME]` One light look site-wide: warm off-white page `#f2f3f0`, white cards, ink `#0a0e18`, purple accent
  `#7237ff`.
- `[INFERRED]` Text and links reach WCAG AA (4.5:1) as rendered in both looks, except where Dark already fell short
  before this work. Dark was kept exactly as it was.
- `[INFERRED]` Meaning carried by colour survives the switch: the stale-profile warning stays warm, and the two score
  badges stay told apart (cyan and green in Light).
- `[INFERRED]` Disabled controls stay dimmed in both looks. A working link inside a dimmed box is never dimmed below
  4.5:1.
- `[UNKNOWN — product input needed]` Field edges are about 1.3:1 in Light, below WCAG 1.4.11's 3:1 for component
  boundaries. No rule was recorded either way.

## 6. Carry-forward & open questions

From audit §6:
- the `/tapestry/*` admin pages: bring them into the setting, or keep them dark?
- the 320px top-bar overflow when signed out;
- signed-in pages throwing when browser storage is blocked (`PovContext`);
- field-edge contrast (WCAG 1.4.11) across the light look;
- the Dark contrast of the unavailable point-of-view option's link;
- whether the design shell adopts the darker cyan used on a hovered badge;
- whether the personalization line and the footer should keep a quieter look in Light;
- NotFound, which belongs to no family;
- related issues `3be893b7` (branding) and `fdd1d1a5` (Tagging pipeline buttons).

## 7. What product must validate

- [ ] Should the `/tapestry/*` admin pages follow the setting next, or stay dark (book decision 2 was "for now")?
- [ ] Should the light look meet WCAG 1.4.11 (3:1 field edges) everywhere?
- [ ] Should Brainstorm keep System as the default once Brainstorm-UI's own dark mode is complete (it defaults to
      Light today)?
- [ ] Does anyone need the choice to follow them across devices (an account-level setting)? Today it's per browser
      by design.
