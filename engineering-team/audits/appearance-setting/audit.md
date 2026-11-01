# Build Audit: Appearance setting (System, Light or Dark)

**Book:** `engineering-team/audits/appearance-setting/book.md`
**Date:** 2026-11-01
**Branch / commit range:** `6d3bb6595..af582d398` (`feat/appearance-setting`, 52 commits; on staging since `56d76a2b4`,
`d1b9c3077` and `af582d398`)
**Provenance:** Acceptance-frame (ngit issue `0dd21d9f`, decisions 1–5 in `book.md`)
**Confidence:** high

> The as-built record. The product team reads it to scope the next phase; a future engineer reads it to see what
> shipped. Proposals are in `prd-seed.md`, not here.

## 1. What shipped

- **A choice of System, Light or Dark, kept in this browser.** System is the default and follows the computer, live.
  Nothing is saved to an account or published. — `stories/done/appearance-setting/1-appearance-switch-and-design-shell-dark.md`
- **Offered everywhere it's needed:** in the avatar menu (signed in), on the Settings page, and beside "Sign in"
  (signed out). On phones, one button opens the three choices. — story 1
- **No flash on load.** A script in the page head sets the look, and a hint for the page's family, before anything
  draws. — stories 1–4
- **The design-shell pages** (Dictionary, Treasure Map and its Advanced page, My Assistants) gained a Dark look; they
  were light-only. — story 1
- **The frame and the reading pages** (profiles and their people lists, notes, the feed, events, the About pages,
  How-search-works, the skill and personalization pages, Settings) gained a Light look. —
  `stories/done/appearance-setting/2-light-look-frame-and-reading-pages.md`
- **The working pages** (`/tags`, `/tag/…`, `/pins`, `/pin/…`, `/assistant` and below, `/setup` and below, the developer
  pages, `/information-for-agents`) and the tag, pin and trusted-list pieces wherever they appear gained a Light
  look. — `stories/done/appearance-setting/3-light-look-working-pages.md`
- **The search home** (`/`, landing and results) gained a Light look; the stale marker and the two score badges keep
  their meanings. — `stories/done/appearance-setting/4-light-look-search-home.md`
- **One light look across the site,** matching the design shell's (warm off-white page, white cards, purple accent).
  Going between pages no longer flips between dark and light. — stories 2–4
- **The `/tapestry/*` admin pages look as they did,** whatever is chosen (book decision 2).

## 2. Epics & stories rolled up

### Epic: `appearance-setting`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 appearance-switch-and-design-shell-dark | The switch, its three places, no-flash pre-render, the design shell's Dark look | Done (round 3) | `reviews/done/appearance-setting/1-appearance-switch-and-design-shell-dark.md` |
| #2 light-look-frame-and-reading-pages | The light token layer (ADR 0002 + Amendment 1, opacity tokens), the frame and reading pages | Done (round 2) | `reviews/done/appearance-setting/2-light-look-frame-and-reading-pages.md` |
| #3 light-look-working-pages | The working pages and pieces, the `/about` count chip | Done (round 2) | `reviews/done/appearance-setting/3-light-look-working-pages.md` |
| #4 light-look-search-home | The search home, `/information-for-agents`'s field, Light-only corrections | Done (round 3) | `reviews/done/appearance-setting/4-light-look-search-home.md` |

ADRs: `0001` appearance attribute, pre-render and design-shell tokens (+ Amendment 1); `0002` a light-only token layer
for the profile family (+ Amendment 1, opacity tokens); `0003` the working pages join it; `0004` the search home joins
it (+ Amendment 1, Light-only rules).

## 3. As-built inventory

- **User-facing:**
  - The Appearance control (`ui/src/components/AppearanceControl.jsx`) in three variants: menu, compact (one popover
    button at ≤520px) and card. It sits in `BrainstormUserMenu.jsx`, `BrainstormSearch.jsx`'s signed-out bar and
    `BrainstormSettings.jsx`.
  - `ui/src/context/AppearanceContext.jsx`: `useAppearance()`, mounted outermost in `ui/src/main.jsx`.
  - The pre-render script in `ui/index.html`, a hand copy of `src/lib/appearance.js`, sets `data-appearance` and
    `data-preload-family`.
- **Styling (`ui/src/styles.css`):**
  - The design shell's `--bsd-*` tokens gained Dark values under `:root[data-appearance="dark"] .bsd-page`.
  - Every colour and dimmed opacity in the profile family and the search home now reads
    `var(--bsp-<role>, <today's value>)`. The tokens are declared only in
    `:root[data-appearance="light"] body:has(:is(.bsp-page, .bss-page, .bs-page))`, so Dark falls back to exactly what
    it painted before.
  - Four Light-only rules sit under that scope (ADR 0004 Amendment 1).
  - Inline styles were wrapped the same way in about a dozen JSX files (listed in each story's test plan).
- **Library:** `src/lib/appearance.js`, aliased as `@tapestry/appearance` in `ui/vite.config.js`. It holds the storage
  key `tapestry_appearance`, the choices, the resolution rule, three path lists (design shell, reading, working), an
  exact search-home path, and `preloadFamily`.
- **Domain:** no concepts, no firmware, no events. Appearance is a per-browser preference.
- **Data & contracts:** one `localStorage` key, `tapestry_appearance` (`system` | `light` | `dark`).
- **Tests:**
  - Node: `test/appearance-setting{,-light,-working,-home}.test.js`, all in the gate.
  - Playwright: `tests/brainstorm/appearance-setting{,-light,-working,-home}.spec.js`, with Dark oracles in
    `tests/brainstorm/fixtures/appearance-setting-{2,3,4}-baseline.json`.
  - Re-aims across five other suites and specs, each recorded in a test-plan amendment.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Decision 3: "three stories" | Four stories; 2 and 3 shipped together | intentional-change | The old story 2 was too large; split so no page was half-converted (book decision 5, David 2026-11-01) | None | — |
| 2 | Frame: "Brainstorm-styled pages follow the choice" (the design shell already had a light look) | The design shell gained a Dark look; the other families gained a Light look | interpretation | Each family had one hard-coded palette; the missing half was built (ADR 0001, 0002) | Every family now has both looks | — |
| 3 | Frame: the light look (unspecified) | Matches the design shell's light look | interpretation | Book decision 4 (David) | One look site-wide | — |
| 4 | Frame: "offered … a signed-out visitor can reach it" | Beside Sign in; on phones one button opens the three | interpretation | Owner decision at story 1 (the phone bar overflowed) | — | 320px overflow (§6) |
| 5 | — | `/information-for-agents` adopted: no-flash hint, field wrapped | added-beyond-scope | Story 3 made it light without a hint; story 4 found it (ADR 0004 sub-decision 4, review 4-R1) | It no longer flashes and its field shows in Light | — |
| 6 | ADR 0003: "story 4 retires the path lists" | The lists stay; `/` is an exact path | constraint-discovered | A default would make NotFound flash light (ADR 0004 Option B) | A new top-level page must join a list; test C3/C4 enforce it | — |
| 7 | ADR 0002: every correction is a token wrapper | Four Light-only rules under the scope | constraint-discovered | The picker's working link inside a disabled option, the card hover, the badge on hover, the status hover cue (ADR 0004 Amendment 1, reviews 4-R1/R2) | Readable in Light; Dark unchanged | — |
| 8 | ADR 0002: disabled states keep their opacity | One exception: `.bs-pov-option.disabled` dims by colour in Light | constraint-discovered | It holds the Settings link a new user needs (ADR 0004 Amendment 1) | The link reads 4.5:1+ in Light | Dark still 1.81:1 (§6) |
| 9 | ADR 0002: new roles take design-shell values | `--bsp-cyan-ink-strong: #155e75` has no design-shell equivalent | constraint-discovered | The shell has no darker cyan; used only on a hovered card's badge (ADR 0004 Amendment 1, review 4-R3) | — | Design shell may want the shade (§6) |
| 10 | Owner decision: Setup chip dark on amber | Dark on amber in Dark, white on `#b45309` in Light | interpretation | Owner decision at story 2 review 1 | — | — |

**Undocumented work:** none found. Every code file the book's 52 commits touch traces to a story, an ADR or a
test-plan amendment. `ui/vite.config.js` and `ui/src/main.jsx` are named in ADR 0001; the re-aimed suites are named in
the test-plan amendments.

## 5. Quality state at close

- **Test gate:** the sealed-container run of `npm test` over the final tree (after the flip and the epic close-out),
  `tapestry-ci-gate-deb`, `--network none`, `CI=true`: `20261101T193320Z-20-f4cf started 2026-11-01T19:33:20.159Z on fc28b850 — PASS, exit 0, 6346 passed, 0 failed, 622 skipped, 323/323 suites`. (`fc28b850` was a local snapshot of this close's staged tree, undone right after the clone; the close commit holds the same tree plus this line.) The full `npm test` isn't run on the
  Mac Studio host (live suites reach Grawk's container); the sealed container is this book's gate of record.
- **Playwright:** 366/366 at `9c6e59f6d` against a build of that tree: the four appearance specs, `setup-alert-polish`,
  `assistant-shared-categories` and 9 related specs. Dark oracles: 28 + 57 + 36 snapshots, unchanged.
- **Staging:** smoke-tested after each ship. Served stylesheet = the tested build (`index-BLMWOGj1.css` at close).
- **Known open issues:** the two `bug` rows below (§6), and a pre-existing search-box glitch filed at close.
- **Not covered by any run:** Safari/WebKit (not installed on this Mac), Firefox, a real NIP-07 signed-in session.
- **Debt logged by ADRs:**
  - two hand-maintained copies of the path lists (`src/lib/appearance.js` and `ui/index.html`), kept in step by P-tests;
  - two mechanisms for Light (token wrappers and Light-only scoped rules), each guarded by its own tests;
  - the profile family's Dark look still lives as literal fallbacks, not tokens (ADR 0002 Option B, "a refactor with
    no visible change" if wanted).

## 6. Carry-forward register

- [ ] The `/tapestry/*` admin pages are still dark-only (book decision 2). Bringing them in is later work.
- [ ] At 320px, signed out, the profile-family top bar overflows; the Appearance button adds 36px (`ledger/2026-10-31-profile-bar-overflows-at-320px.md`).
- [ ] With browser storage blocked, signed-in pages throw because `PovContext` reads `localStorage` unguarded (`ledger/2026-10-31-pov-context-unguarded-storage.md`). The appearance code itself survives blocked storage (story 1 E10).
- [ ] Field edges in Light are about 1.3:1 (`--bsp-border` on the canvas), below WCAG 1.4.11's 3:1 for component boundaries. A site-wide design choice (review 4-R2/R3).
- [ ] The unavailable point-of-view option's Settings link reads 1.81:1 in Dark (pre-existing; Light is fixed).
- [ ] `--bsp-cyan-ink-strong` (`#155e75`) has no design-shell equivalent; the design shell may want a darker cyan.
- [ ] In Light the personalization line and the footer lose their "quiet" dimming, because they hold links (ADR 0004 test T3 `HOLDS_LINKS`).
- [ ] `NotFound` belongs to no family and stays on the dark global palette in every look.
- [ ] Related issues left open: `3be893b7` (branding) and `fdd1d1a5` (the Tagging pipeline buttons' contrast in both looks).
- [ ] Not verified in Safari/WebKit or Firefox, or with a real NIP-07 session.

## 7. Process findings (harness)

`scripts/harness-stats.sh` at close: 1,836 phase commits; 309 reviews decided, kick-back rate 0% by its count; 9 books
open and 88 closed. This book's own reviews ran 3, 2, 2 and 3 rounds. The stat counts a review with a final PASS as no
kick-back, so it doesn't see within-review rounds. That gap is itself recorded below.

| Finding | Source | Terminal state |
|---|---|---|
| Light-look sweeps ran on empty mocks, so populated pieces (chips, scored rows, dialogs) were never measured | Review 3-R1 friction 1; 3-R2 friction 1 | OPEN.md meta row `2026-11-01-appearance-sweeps-empty-data` (updated at close: story 4's spec is populated; a shared populated mock set and the review-probe rule remain) |
| The class inventory read only `className` expressions and undercounted | Review 3-R1 friction 2 | Fixed in this book's tests: `7cedfd19c`, `d08811439`, `dae991052` (fix rounds the owner approved); recorded on the same meta row |
| The safety screen skipped mocked-publish suites, and related suites/specs were picked by hand | Review 2-R1 friction 1–2; 1-R1 friction 2 | OPEN.md meta row `2026-11-01-related-suites-picked-by-hand` |
| Playwright's WebKit projects aren't installed on the Mac Studio | Review 1-R3 friction | OPEN.md meta row `2026-10-31-webkit-projects-not-installed` |
| The preview build's source commit wasn't recorded, so the Reviewer rebuilt | Review 1-R1 friction 1 | Declined: from story 2 on, every hand-off names the commit the build came from, and the Reviewer rebuilds from HEAD anyway (the cheaper habit already holds) |
| Exempt elements, not containers, from contrast sweeps (never an `a` or `button`) | Review 4-R1 friction | Operator-ratified harness commit: a line in `templates/test-plan.md` § Edge cases (David, 2026-11-01), in this close's commit `book-close: appearance-setting` |
| After a pointer action, wait for transitions before measuring | Review 4-R2 friction | Operator-ratified harness commit: the same template line, same commit |
| Test changes made during Implementation landed in the impl commit | Review 3-R2 non-blocking 1 | Declined: already the rule (`roles/implementer.md:11`, "kick it back to the Tester"); story 4 followed it with three Tester amendment commits |
| A test run reached Grawk's container (the screen missed `docker exec`) | Session incident, 2026-10-31 | OPEN.md meta row `2026-11-01-related-suites-picked-by-hand` (its first fix shape, telling live-stack suites from mocked ones, covers it); the operator-level memory "screen suites for docker exec" holds meanwhile |
| `harness-stats` counts within-review rounds as no kick-back | This retro | Declined: rounds are visible in each review file's headings; the stat is an instrument, not a gate (its own footer says so) |

Ports to the Direction flow? The empty-mock, related-suite and transition lessons apply to any B-class test, gated or
directed; the rows above don't depend on the flow.
