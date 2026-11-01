# Book of Work: Appearance setting (System, Light or Dark)

**Slug:** appearance-setting
**Status:** Closed
**Opened:** 2026-10-31
**Closed:** 2026-11-01

## Intent anchor

- **Acceptance frame (no PRD).** The ask is ngit issue `0dd21d9f` ("Appearance setting: let people choose Light,
  Dark or System, as Brainstorm does; today each page family hard-codes its palette"), with three decisions David made
  at kickoff on 2026-10-31:
  1. A first-time visitor gets **System** (the page follows the computer's light or dark setting).
  2. The older `/tapestry/*` admin pages **stay dark** in this book. Bringing them in is later work.
  3. The work is cut into **three stories**, each seen on localhost before it moves on. *(Re-cut 2026-11-01, see
     decision 5.)*

  Later decisions:

  4. **The light look matches the design shell's light look** (David, 2026-11-01): warm off-white page, white cards,
     purple accent, on every family that gains a light look.
  5. **Four stories** (David, 2026-11-01): the old story 2 is split into story 2 (the frame and the reading pages)
     and story 3 (the working pages). The two ship to staging together, so no page is ever half-converted. The search
     home becomes story 4.

### Acceptance frame

- [x] A person can choose **System**, **Light** or **Dark**, and the choice sticks in that browser. It's a per-browser
      preference: nothing is saved to an account or published.
- [x] The choice is offered in the avatar menu and on the Settings page, and a signed-out visitor can reach it too.
- [x] Loading a page never flashes the other appearance first.
- [x] The Brainstorm-styled pages follow the choice: the design-shell pages (Dictionary, Treasure Map and its
      Advanced page, My Assistants), the profile/feed/Tags/About family with the Settings page, and the search home.
      Going from one page to another no longer flips between dark and light.
- [x] The `/tapestry/*` admin pages look as they do today.

## Epics in this book

- `appearance-setting`: the switch, then a light and a dark palette for each family of Brainstorm-styled pages.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** high (acceptance-frame; every frame bullet met, see audit §1 and §4)

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/appearance-setting/audit.md`
- Product feedback: `engineering-team/audits/appearance-setting/prd-seed.md`
