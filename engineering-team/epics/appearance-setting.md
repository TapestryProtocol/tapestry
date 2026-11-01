# Epic: appearance-setting — choose System, Light or Dark

**Status:** Active
**Created:** 2026-10-31
**Book:** `engineering-team/audits/appearance-setting/book.md` (no PRD — acceptance frame)
**Source:** ngit issue `0dd21d9f`

## Goal

**Let each person choose how Tapestry's Brainstorm-styled pages look: System, Light or Dark.** Today every family of
pages hard-codes its own palette, so moving from the search page to the Dictionary or the Treasure Map flips the
whole screen between dark and light, and nobody can choose. Brainstorm-UI already offers the same three choices; this
epic brings Tapestry level with it.

## Stories

All three are features, so all take the five phases (Standard). Each is seen on localhost before the next starts.

1. `1-appearance-switch-and-design-shell-dark.md`: the switch itself (the three choices, kept per browser, no flash
   on load, the control in the avatar menu and on the Settings page) and a dark palette for the design-shell pages
   (Dictionary, Treasure Map and its Advanced page, My Assistants).
2. A light palette for the profile/feed/Tags/About family (`/assistant/*`, `/setup`, the developer pages and the rest
   of that family) and for the Settings page, which shares its look. Depends on #1.
3. A light palette for the search home. Depends on #1.

## Key facts / guardrails

- **A choice made for oneself, counted for nobody else.** Appearance is a per-browser preference. It's never
  published, never saved to an account, and never seen by anyone else, so the POV and Show-and-Tell questions don't
  arise.
- **Default System** (David, 2026-10-31). Brainstorm-UI defaults to Light today, with a note to move to System once
  its dark mode is complete; Tapestry starts where Brainstorm-UI is heading.
- **The `/tapestry/*` admin pages stay dark** in this epic (David, 2026-10-31).
- **Related issues, not in this epic:** `3be893b7` (branding) and `fdd1d1a5` (the Tagging pipeline buttons). The
  buttons' contrast should be checked in both appearances whenever their pages join.
