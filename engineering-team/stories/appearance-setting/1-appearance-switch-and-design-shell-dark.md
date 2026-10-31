# Story 1: The Appearance switch, and a dark look for the design-shell pages

**Status:** Approved
**Created:** 2026-10-31
**Type:** Feature

## Background

Tapestry's Brainstorm-styled pages have no appearance setting. Each family of pages hard-codes its own look: the
search home, the profile/feed/Tags/About pages and the Settings page are dark, while the design-shell pages (the
Dictionary, the Treasure Map and its Advanced page, My Assistants) are light. Moving between them flips the whole
screen between dark and light, and nobody can choose. Brainstorm-UI already lets people pick System, Light or Dark.
(ngit issue `0dd21d9f`; book `appearance-setting`.)

This story builds the switch and gives one family both looks: the design-shell pages, which are light today, gain a
dark look. The other families follow in stories 2 and 3; until then they look as they do today, whatever is chosen.

Decided with David on 2026-10-31: a first-time visitor gets **System**; the `/tapestry/*` admin pages stay dark;
signed out, the control sits beside **Sign in** in the top bar.

## User-facing description

As anyone visiting a Tapestry instance, signed in or not, I want to choose whether its pages look light, dark, or
follow my computer's setting, so that the pages look the way I like and stop changing under me as I move around.

## Acceptance criteria

- [ ] **First visit follows the computer.** Given a browser that has never made a choice, when a design-shell page
      loads, then it is dark if the computer is set to dark and light if it's set to light. When the computer's setting
      changes while the page is open, the page follows without a reload.
- [ ] **Where the choice is offered.** Given a signed-in person, when they open the avatar menu or the Settings page
      (`/settings`), then they see an **Appearance** control with three choices, **System**, **Light** and **Dark**,
      with the current one marked. Given a signed-out visitor, the same control is offered beside **Sign in** in the
      top bar of the Brainstorm-styled pages, and on the signed-out Settings page.
- [ ] **The choice applies at once and sticks in that browser.** When a person picks Light or Dark, then the page
      they're on changes at once with no reload, and stays that way across reloads, new tabs and later visits in that
      browser, signed in or out. Picking **System** goes back to following the computer. Nothing is saved to an
      account, published, or sent to the server; another browser or device keeps its own choice.
- [ ] **No flash on load.** Given a choice of Dark on a computer set to light (and the other way round), when any
      design-shell page is loaded or reloaded, then it never shows the other look first, not even briefly.
- [ ] **The design-shell pages have a dark look.** Given Dark (chosen, or System on a dark computer), when a person
      visits the Dictionary, the Treasure Map, the Treasure Map's Advanced page, or My Assistants, then the whole page is
      dark: background, top bar, cards, tables, menus, form fields, text and links. Body text and links meet WCAG AA
      contrast (4.5:1), and no element is left light-on-light or dark-on-dark. Given Light, those pages look as they do
      today.
- [ ] **Everything else is unchanged.** Whatever is chosen, the search home, the profile/feed/Tags/About pages, the
      Settings page's own look and the `/tapestry/*` admin pages look exactly as they do today.
- [ ] **Works when the browser won't store anything.** Given a browser that refuses to save the choice (for example a
      private window with storage blocked), when a page loads, then it follows the computer, the control still changes
      the look for that page, and nothing errors.

## Concepts touched

None. Appearance is a per-browser display preference; it isn't a concept in the graph and touches no event or
concept. (The local Concept Graph API at :7778 is Grawk's agent-memory instance, so it wasn't consulted.)

## Out of scope

- A light look for the profile/feed/Tags/About family and the Settings page (story 2), and for the search home (story
  3).
- The `/tapestry/*` admin pages, which stay dark (David, 2026-10-31).
- Keeping the choice with a person's account or publishing it, so that it follows them across browsers or devices.
- Any change to Brainstorm-UI.
- Branding (issue `3be893b7`) and the Tagging pipeline buttons (issue `fdd1d1a5`).

## Open questions

None. (Default, admin pages and signed-out placement were settled with David on 2026-10-31.)

## Linked artifacts

- ADR: `engineering-team/decisions/appearance-setting/0001-appearance-attribute-preload-and-design-shell-tokens.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
