# Story 3: A light look for the working pages

**Status:** Done
**Created:** 2026-11-01
**Type:** Feature

## Background

Story 2 (Done, `d6a8d8aa5`) gave the frame every page shares and the reading pages a light look. The working pages,
where people tag, pin, curate trusted lists, manage their Assistant, finish setting up and read the developer
docs, are still dark in Light, apart from their frame. The same goes for the tag, pin and trusted-list pieces wherever
they appear: the Manage Tags dialog on a profile is still dark.

Stories 2 and 3 ship to staging together, so nobody sees a half-converted site (book decision 5). The light look
matches the design shell's light look (book decision 4). The search home is story 4.

David decided on 2026-11-01 to fold one gap from story 2's review into this story. The Admins count chip on `/about`
reads about 2.7:1 in Light, and story 2's light check missed it because the chip's tinted background wasn't laid over
the page.

## User-facing description

As someone who has chosen Light (or uses System on a light computer), I want the pages where I work (Tags, Pins, my
Assistant, setup, the developer docs) and the tag, pin and trusted-list pieces on every page to be light too. Then
the whole site matches the look I chose, and nothing I work with stays dark.

## Acceptance criteria

The **working pages** are:
- `/tags`, `/tag/<id>` and `/tag/<slug>/<id>`;
- `/pins` and `/pin/<d>`;
- `/assistant` and every page under it;
- `/setup` and `/setup/create-account`, `/setup/follow`, `/setup/activate`;
- `/developers`, `/developers/nip-50`, `/developers/open-ranking`, `/developers/trusted-assertions` and
  `/developers/relay-tools`.

The **working pieces** are the tag, pin and trusted-list pieces, the Manage Tags dialog, and the Assistant hub's and
setup's own pieces, wherever they appear, the reading pages included.

- [ ] **The working pages are light in Light.** Given Light (chosen, or System on a light computer), when a person
      opens any working page, signed in or out, then all of it is light: its content as well as the frame story 2
      already did. Body text and links meet WCAG AA contrast (4.5:1) as they render, and no element is left
      dark-on-light or light-on-light.
- [ ] **The working pieces are light everywhere.** Given Light, when a working piece appears on a reading page
      (for example the Manage Tags dialog, or a profile's pins and trusted lists), then it's light and readable there
      too. No reading page keeps a dark piece in Light.
- [ ] **One light look across the site.** In Light, the working pages' page background, card surface, body text,
      muted text and accent are the same colours as the design-shell and reading pages' in Light.
- [ ] **Dark is unchanged.** Given Dark (chosen, or System on a dark computer), every working page and every working
      piece looks exactly as it does today.
- [ ] **No flash on load.** Given Light on a dark computer (and the other way round), when a working page is loaded
      or reloaded, then it never shows the other look first.
- [ ] **Phones keep working.** In Light, at 375px and up, each working page fits the screen as it does today, with no
      new sideways scroll.
- [ ] **The /about Admins count is readable.** Given Light, the count chip beside "Admins" on `/about` (and its kind,
      the count chips in that section's labels) reads at 3:1 or better as rendered. It looks as it does today in Dark.
- [ ] **Everything else is unchanged.** Whatever is chosen, the search home and the `/tapestry/*` admin pages look as
      they do today, and so do the design-shell pages in both looks. The reading pages keep the light look story 2
      gave them, now with their working pieces light too.

## Concepts touched

None. Appearance is a per-browser display preference; it touches no event or concept.

## Out of scope

- The search home: story 4.
- The `/tapestry/*` admin pages (book decision 2).
- Widths below 375px (ledger row `2026-10-31-profile-bar-overflows-at-320px`).
- Anything about how tagging, pinning or the Assistant pages work: this story changes only how they look.

## Open questions

None. (The carry-over chip was folded in by David on 2026-11-01.)

## Linked artifacts

- ADR: `engineering-team/decisions/appearance-setting/0003-working-pages-join-the-light-token-layer.md`
- Test plan: `engineering-team/stories/appearance-setting/3-light-look-working-pages.test-plan.md`
- Review: `engineering-team/reviews/appearance-setting/3-light-look-working-pages.md`
