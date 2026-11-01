# Epic: appearance-setting — choose System, Light or Dark

**Status:** Done
**Created:** 2026-10-31
**Book:** `engineering-team/audits/appearance-setting/book.md` (no PRD — acceptance frame)
**Source:** ngit issue `0dd21d9f`

## Goal

**Let each person choose how Tapestry's Brainstorm-styled pages look: System, Light or Dark.** Today every family of
pages hard-codes its own palette, so moving from the search page to the Dictionary or the Treasure Map flips the
whole screen between dark and light, and nobody can choose. Brainstorm-UI already offers the same three choices; this
epic brings Tapestry level with it.

## Stories

All are features, so all take the five phases (Standard). Each is seen on localhost before the next starts. Re-cut on
2026-11-01 (David): the old story 2 became stories 2 and 3, which ship to staging together, and the search home moved
to story 4. The light look throughout matches the design shell's light look.

1. `1-appearance-switch-and-design-shell-dark.md`: the switch itself (the three choices, kept per browser, no flash
   on load, the control in the avatar menu and on the Settings page) and a dark palette for the design-shell pages
   (Dictionary, Treasure Map and its Advanced page, My Assistants). Done; on staging 2026-10-31 (`56d76a2b4`).
2. `2-light-look-frame-and-reading-pages.md`: a light look for the frame every page shares (top bar, avatar menu,
   alerts) and the reading pages (profiles and their people lists, notes, the feed, events, the About pages,
   How-search-works, the skill and personalization pages, Settings). Depends on #1.
3. `3-light-look-working-pages.md`: a light look for the working pages (`/tags`, `/tag/…`, `/pins`, `/pin/…`,
   `/assistant` and `/assistant/*`, `/setup`, the developer pages) and the tagging, pinning and trusted-list pieces
   wherever they appear. It also takes in story 2's carry-over, the `/about` Admins count chip (David, 2026-11-01).
   Depends on #2; ships with it.
4. `4-light-look-search-home.md`: a light look for the search home (`/`, landing and results), with story 2's last carry-over and story 3's round-2 test notes. Depends on #1.

## Carried forward to stories 3 and 4 (from story 2's review, 2026-11-01)

- **Story 3:**
  - The tagging pieces on the reading pages (`ProfileTagsSection`, `AuthoredTaggingSection`, `NoteTags`: the
    `.bsp-tags-*`, `.bsp-authored-*` and `.bsp-note-tags-*` classes) were converted in story 2 and are readable in
    Light. Story 3 inherits them as done.
  - The Manage Tags dialog (`.ptd`, `.ptd-*`), the pins, the trusted lists and the rest of its families are still
    dark in Light.
  - Story 3 uses ADR 0002's token layer, including Amendment 1's opacity tokens.
- **Story 3 or a follow-up:**
  - The Admins count chip on `/about` (`AboutThisInstance.jsx:16-18,131`) reads about 2.7:1 in Light. Its dimmed
    label lays a 0.72 group opacity over a 0.18 accent tint. Give the chip's text `--bsp-accent-ink`, or take it out
    of the dimmed label.
  - Story 2's L1 sweep should also composite translucent backgrounds, the way it already composites the text.
- **Story 4:** `.bs-usermenu-pov-indicator strong` (search home only) still holds a bare `#a5b4fc`.

## Key facts / guardrails

- **A choice made for oneself, counted for nobody else.** Appearance is a per-browser preference. It's never
  published, never saved to an account, and never seen by anyone else, so the POV and Show-and-Tell questions don't
  arise.
- **Default System** (David, 2026-10-31). Brainstorm-UI defaults to Light today, with a note to move to System once
  its dark mode is complete; Tapestry starts where Brainstorm-UI is heading.
- **The `/tapestry/*` admin pages stay dark** in this epic (David, 2026-10-31).
- **Related issues, not in this epic:** `3be893b7` (branding) and `fdd1d1a5` (the Tagging pipeline buttons). The
  buttons' contrast should be checked in both appearances whenever their pages join.
