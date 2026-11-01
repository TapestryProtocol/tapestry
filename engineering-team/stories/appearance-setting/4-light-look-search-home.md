# Story 4: A light look for the search home

**Status:** Approved
**Created:** 2026-11-01
**Type:** Feature

## Background

Stories 1–3 are on staging (`56d76a2b4`, then `d1b9c3077`). The design-shell pages, the frame every page shares, the
reading pages and the working pages all follow the appearance choice. The search home (`/`, both its landing search and
its results) is the one Brainstorm-styled page still dark in Light. So someone who chose Light lands on a dark page,
searches, opens a profile that's light, and comes back to a dark page again. This story ends that flip and finishes the
book's acceptance frame.

The light look matches the design shell's light look (book decision 4). The `/tapestry/*` admin pages stay dark (book
decision 2).

## User-facing description

As someone who has chosen Light (or uses System on a light computer), I want the search home to be light too: the
landing search, the results, and everything I use there. Then the whole site matches the look I chose, from the first
page I see.

## Acceptance criteria

The **search home** is `/` in both its states:
- the **landing search**: the logo, the tagline, the search box, the personalization line ("Not Personalized · What is
  this?") with its explanation and the point-of-view picker, and the footer links;
- the **results**: the top bar's search box, the result count, the people results (name, the "updated … ago" freshness
  marker, NIP-05, npub, about, website and lightning, the Verification Score and Verified Followers badges, matched
  fields), the tag results, the pinned-tag chips, and the empty, loading and error states.

The search box's suggestions, and the search home's own avatar menu and alerts when signed in, are part of it.

- [ ] **The search home is light in Light.** Given Light (chosen, or System on a light computer), when a person opens
      the search home, signed in or out, landing or results, then all of it is light. Body text and links meet WCAG AA
      contrast (4.5:1) as they render, with real results on the page, and no element is left dark-on-light or
      light-on-light. What a person types in the search box is readable.
- [ ] **Its meanings survive.** In Light, the stale-profile marker still reads as a warning, and the Verification Score
      and Verified Followers badges are still told apart at a glance, each readable at 4.5:1.
- [ ] **One light look across the site.** In Light, the search home's page background, card surface, body text, muted
      text and accent are the same colours as every other light page's.
- [ ] **No flip between pages.** Given Light, when a person goes from the search home to a profile, a tag or Settings
      and back, then every page they pass through is light. The same holds in Dark.
- [ ] **Dark is unchanged.** Given Dark (chosen, or System on a dark computer), the search home looks exactly as it does
      today, landing and results, signed in or out.
- [ ] **No flash on load.** Given Light on a dark computer (and the other way round), when the search home is loaded or
      reloaded, with or without a search in its address, then it never shows the other look first.
- [ ] **Phones keep working.** In Light, at 375px and up, the landing search and the results fit the screen as they do
      today, with no new sideways scroll.
- [ ] **Everything else is unchanged.** Whatever is chosen, the `/tapestry/*` admin pages look as they do today, and
      every page stories 1–3 made light keeps its look in both appearances.

## Concepts touched

None. Appearance is a per-browser display preference; it touches no event or concept.

## Carried into this story

- From story 2's review: the point-of-view name in the search home's avatar menu still holds a fixed colour.
- From story 3's round-2 review (engineering notes, for the Tester and Architect):
  - the test that finds which styles belong to a page should be narrowed before it reaches the search home, so styles
    that only share a state name with an admin page don't get pulled in;
  - the check for fixed inline dimming exempts too much (any line that mentions "disabled");
  - test changes go in the test-design commit, not the implementation commit.

## Out of scope

- The `/tapestry/*` admin pages (book decision 2).
- Widths below 375px (ledger row `2026-10-31-profile-bar-overflows-at-320px`).
- Anything about how search, ranking, personalization or the point-of-view picker work: this story changes only how
  they look.
- The branding issue (`3be893b7`).

## Open questions

None.

## Linked artifacts

- ADR: `engineering-team/decisions/appearance-setting/0004-search-home-joins-the-light-token-layer.md`
- Test plan: `engineering-team/stories/appearance-setting/4-light-look-search-home.test-plan.md`
- Review: —
