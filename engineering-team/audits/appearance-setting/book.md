# Book of Work: Appearance setting (System, Light or Dark)

**Slug:** appearance-setting
**Status:** Open
**Opened:** 2026-10-31
**Closed:** —

## Intent anchor

- **Acceptance frame (no PRD).** The ask is ngit issue `0dd21d9f` ("Appearance setting: let people choose Light,
  Dark or System, as Brainstorm does; today each page family hard-codes its palette"), with three decisions David made
  at kickoff on 2026-10-31:
  1. A first-time visitor gets **System** (the page follows the computer's light or dark setting).
  2. The older `/tapestry/*` admin pages **stay dark** in this book. Bringing them in is later work.
  3. The work is cut into **three stories**, each seen on localhost before it moves on.

### Acceptance frame

- [ ] A person can choose **System**, **Light** or **Dark**, and the choice sticks in that browser. It's a per-browser
      preference: nothing is saved to an account or published.
- [ ] The choice is offered in the avatar menu and on the Settings page, and a signed-out visitor can reach it too.
- [ ] Loading a page never flashes the other appearance first.
- [ ] The Brainstorm-styled pages follow the choice: the design-shell pages (Dictionary, Treasure Map and its
      Advanced page, My Assistants), the profile/feed/Tags/About family with the Settings page, and the search home.
      Going from one page to another no longer flips between dark and light.
- [ ] The `/tapestry/*` admin pages look as they do today.

## Epics in this book

- `appearance-setting`: the switch, then a light and a dark palette for each family of Brainstorm-styled pages.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/appearance-setting/audit.md`
- Product feedback: `engineering-team/audits/appearance-setting/prd-seed.md`
