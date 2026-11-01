# Story 2: A light look for the frame and the reading pages

**Status:** Done
**Created:** 2026-11-01
**Type:** Feature

## Background

Story 1 (on staging since 2026-10-31) gave Tapestry the Appearance setting (System, Light or Dark) and gave the
design-shell pages (Dictionary, Treasure Map, My Assistants) a dark look. Every other Brainstorm-styled page is still
dark whatever is chosen. So someone who picks Light, or whose computer is set to light, still flips between light
design-shell pages and dark everything-else.

This story gives the reading pages, and the frame every page shares, a light look. Its sibling, story 3, does the
working pages; the two ship together, so nobody sees a half-converted site (David, 2026-11-01). The search home is
story 4.

Decided with David on 2026-11-01:
- The light look **matches the design shell's light look**: warm off-white page, white cards, purple accent. Every
  light page in Tapestry then reads as one product.
- The work is cut into **two stories that ship together**: this one (the frame and the reading pages) and story 3
  (the working pages).

## User-facing description

As someone who has chosen Light (or uses System on a light computer), I want the profile, people-list, feed, notes,
About, How-search-works and Settings pages to be light too, so that the whole site matches the look I chose instead of
switching back to dark as I move around.

## Acceptance criteria

The **reading pages** are: `/about`, the About-search page, `/how-search-works`, `/brainstorm-skill`,
`/personalization`, `/settings`, `/user/<pubkey>` and its follows, followers, follows-by-hops, muters, reporters and
notes pages, `/feed` and `/event`. The **frame** is the top bar, the avatar menu and its dropdown, the Setup and
Assistant alerts, and the Sign in control, wherever they appear.

- [ ] **The reading pages are light in Light.** Given Light (chosen, or System on a light computer), when a person
      opens any reading page, signed in or out, then it's light: page background, top bar, avatar menu, alerts,
      headings, body text, links, buttons, form fields, cards, lists, notes and feed items. Body text and links meet
      WCAG AA contrast (4.5:1), and no element is left dark-on-light or light-on-light. The only exceptions are the
      tagging, pinning and trusted-list pieces that story 3 owns, where they appear on these pages.
- [ ] **One light look across the site.** In Light, the reading pages' page background, card surface, body text,
      muted text and accent are the same colours as the design-shell pages' in Light.
- [ ] **Dark is unchanged.** Given Dark (chosen, or System on a dark computer), every reading page and the frame look
      exactly as they do today.
- [ ] **Switching is instant and live.** On a reading page, choosing Light or Dark changes it at once with no reload,
      and under System it follows a change of the computer's setting while open, as the design-shell pages already
      do.
- [ ] **No flash on load.** Given Light on a dark computer (and the other way round), when a reading page is loaded
      or reloaded, then it never shows the other look first, not even briefly.
- [ ] **Phones keep working.** In Light, at phone widths (375px and up), each reading page fits the screen as it does
      today: no new sideways scroll, and the top bar stays on one line.
- [ ] **Everything else is unchanged.** Whatever is chosen, the search home and the `/tapestry/*` admin pages look as
      they do today. The design-shell pages look as they do today in both looks. Story 3's working pages keep their
      own content's current look; only the frame they share changes, as above.

## Concepts touched

None. Appearance is a per-browser display preference; it touches no event or concept. (The local Concept Graph API
at :7778 is Grawk's agent-memory instance, so it wasn't consulted.)

## Out of scope

- The working pages (`/tags`, `/tag/…`, `/pins`, `/pin/…`, `/assistant` and `/assistant/*`, `/setup`, the developer
  pages) and the tagging, pinning and trusted-list pieces wherever they appear: story 3.
- The search home: story 4.
- The `/tapestry/*` admin pages (book decision 2).
- Widths below 375px (ledger row `2026-10-31-profile-bar-overflows-at-320px`).

## Open questions

None. (Palette and cut settled with David on 2026-11-01.)

## Linked artifacts

- ADR: `engineering-team/decisions/appearance-setting/0002-light-only-token-layer-for-the-profile-family.md`
- Test plan: `engineering-team/stories/appearance-setting/2-light-look-frame-and-reading-pages.test-plan.md`
- Review: `engineering-team/reviews/appearance-setting/2-light-look-frame-and-reading-pages.md`
