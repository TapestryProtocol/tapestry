# Review: Story 2 — A light look for the frame and the reading pages

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-01
**Diff:** `git diff 56d76a2b4..HEAD` (HEAD `5e30cf41c`; commits 1ab421bf8 story, b4807444b ADR, 0c2cab6c2 failing tests
and snapshot fixture, cd7e5df37 test re-aims, 5e30cf41c impl)
**Story:** `engineering-team/stories/appearance-setting/2-light-look-frame-and-reading-pages.md`
**ADR:** `engineering-team/decisions/appearance-setting/0002-light-only-token-layer-for-the-profile-family.md`
**Test plan:** `engineering-team/stories/appearance-setting/2-light-look-frame-and-reading-pages.test-plan.md`
(with its Amendment 1)

## Quality gates (run by reviewer, not trusted)

- [ ] `npm test`: **not run in full.** On this Mac Studio the full gate leaks fixtures into a private agent-memory
      instance (`:7778` / container `tapestry`), so it is forbidden here. `node test/gate-status.js --list` prints
      "No gate run records in …/appearance-setting/tmp/gate-runs", so **there is no `gate:status` line to quote.** And
      the full gate would not pass: `setup-alert-polish` S1 fails on this diff (Blocking 1). I couldn't run that suite,
      because it matches the safety grep (`/api/strfry/publish`, though only through a mocked fetch), but I reproduced
      its parse statically.
      Run one suite at a time through `run()` with `BRAINSTORM_BASE_URL=http://127.0.0.1:9`, each grep-checked
      first:
  - `appearance-setting-light`: **11/11 pass.** `appearance-setting`: **16/16 pass.**
  - Suites that read `styles.css` or the changed JSX: `treasure-map-needs-attention` 6/0, `profile-verified-reporters-count`
    11/0, `profile-follows-list` 27/0, `live-feed-feed-page` 27/0, `author-scoped-inspection-views` 23/0 (0 skipped),
    `tag-actions-menu-ui` 30/0, `login-failure-and-tag-collapse` 18/0, `about-this-instance` 29/0,
    `information-for-agents` 53/0 (4 skipped), `recognizable-published-ta-profile` 8/0 (5 skipped), `relay-scan-bounds`
    21/0 (7 skipped). `tag-detail-curated-view-and-pin-polish` skipped all 33 (it needs a live stack).
  - **Not run:** `setup-alert-polish` (safety grep match). Its S1 reads `.bs-setup-alert-button`'s `color` and
    `background` and requires plain hex values. Now they read `var(--bsp-on-accent, #0f0f1a)` and
    `var(--bsp-warn, #d29922)`, so S1 fails with "the chip's color and background must be hex values to measure".
- [x] Playwright, chromium, against a **fresh build of HEAD**. I rebuilt it into the `:4174` preview directory and
      checked that `:4174` serves the new CSS hash. `/api` is mocked, and the preview proxies it to a dead port.
  - `appearance-setting-light.spec.js`: **41/41 pass.** `appearance-setting.spec.js` (story 1, re-aimed E9): **36/36 pass.**
  - `assistant-alert.spec.js` + `setup-alert-polish.spec.js`: **30 pass, 3 FAIL.** `setup-alert-polish.spec.js:329`
    P1 at 1280, 800 and 375 px fails with "the chip's text must be dark (the owner's call); it is rgb(255, 255, 255)".
    It **passes 3/3 against a build of the base**, so this diff causes the failure (Blocking 1).
  - `assistant-shared-categories`, `assistant-coming-soon`, `my-assistants-nip05` (they visit `/about` or `/user/…`):
    25/25 pass.
- [x] **The snapshot oracle, checked independently.** I extracted `56d76a2b4`'s `ui/` and `src/lib/` with `git archive`
      into my own scratch directory, built it, and served it on a private port through vite's preview API. L3 and L7
      against that base build: **19/19 pass.** So `fixtures/appearance-setting-2-baseline.json` equals the base, and
      `b4807444b`'s UI is identical to the base (`git diff 56d76a2b4 b4807444b -- ui src` is empty).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._ (The vite build of HEAD succeeds.)

## Spec adherence
- [ ] Every acceptance criterion has a passing test. **AC-1 is not met as rendered, though its tests pass.**
      Blocking 2 and 3 cover it. L1's sweep compares the computed `color` with no ancestor `opacity` folded in, so it
      passes body links that render at 4.05:1. Its exclusions also match the class `ptd-` but not `ptd`. The alerts
      AC-1 names (the Setup and Assistant alerts) are never rendered in L1, because the mocks complete every setup step
      and give no Assistant. K2 measures them statically.
- [x] No criterion is silently dropped. AC-2 to AC-7 are met:
  - AC-3, Dark unchanged: by construction (every `--bsp-` token is declared only at `styles.css:4900-4940`, inside
    the light scope), plus T1, L3 and the base-build check above.
  - AC-4 L5, AC-5 L4/P2, AC-6 L6, AC-7 L7.
- [ ] No behaviour beyond the story. The conversion also reached story 3's tagging pieces (Non-blocking 1) and
      global rules (Non-blocking 2).

## ADR adherence
- [ ] Files changed match the ADR's implementation notes. Mostly yes: `styles.css`, `src/lib/appearance.js`,
      `ui/index.html`, the six JSX files with the 18 inline colours, and `AppearanceContext.jsx` unchanged.
      **Deviations:**
  - **Sub-decision 7:** `.ptd`, the Manage Tags dialog box, was converted (Blocking 3).
  - **Sub-decision 7 / the story's Out of scope:** the `bsp-tags-*`, `bsp-authored-*` and `bsp-note-tags-*` tagging
    pieces were converted (Non-blocking 1).
  - **Implementation note 1:** the element rules `a` / `a:hover` and the shared admin rules (`.data-table*`,
    `.table-*`, `.empty-row`, `.constituent-card.clickable:hover`) were converted. The ADR doesn't list them
    (Non-blocking 2).
  - **Sub-decision 2 / AC-2:** reading-page muted text paints `--bsp-ink-2` (#555d69, the design shell's
    `--bsd-ink-2`), not `--bsp-muted` (#6b7480, the design shell's `--text-muted`). `--bsp-muted` is read once
    (Non-blocking 3).
- [x] Layering and module boundaries are respected. `preloadFamily` / `isReadingPath` are in `src/lib/appearance.js`,
      and the hand copy in `index.html` is pinned by P1/P2.
- [x] No new dependencies.

## Concept-graph integrity
- [x] No concepts, handles or firmware are touched (Appearance is a per-browser display preference).
- [x] No firmware reinstall needed.
- [x] N/A: no domain code.

## Things tests can't catch
- [x] No secrets in committed files.
- [x] No leftover debug logging or `console.log`.
- [x] No commented-out code.
- [ ] Edge and interaction states, where they matter:
  - Light text over inherited `opacity` falls below AA (Blocking 2).
  - Several hover states lose their feedback in Light (Non-blocking 4).
- [x] Concurrency and races: the pre-render hint is removed after the first render, as in story 1; L4 checks it is
      steady.
- [x] Security: none. The inline styles are static strings.

**The light scope doesn't leak.** `body:has(:is(.bsp-page, .bss-page))` matches only on pages that render those
containers. That is the 15 reading pages plus story 3's (`Tags`, `Tag`, `Pins`, `PinRedirect`, `assistant/*`,
`setup/*`, `DevPage`). It never matches the search home (`.bs-page`), the `/tapestry/*` admin pages or the design
shell (`.bsd-page`; no page renders both). The shared rules (global `a`, `.data-table*`, `.bs-usermenu-*`,
`.bs-link-btn`) therefore fall back to today's values there, and L7 confirms it by snapshot. A browser without
`:has()` gets the light pre-render canvas, then today's dark page once React clears the hint. That is a graceful
fallback.

## House rules check
- [x] Concept Graph API authority respected (not applicable).
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence *(when the story traces to a PRD)*
- [x] No PRD; the book's acceptance frame applies. The palette is the design shell's light values (book decision 4,
      pinned by T2).

## The four re-aimed tests (Amendment 1)
- **T4/K2 function-form `className`:** broadens coverage and loosens nothing. But the story-3 exclusion it uses
  (`STORY3`, `test/appearance-setting-light.test.js:46`) matches `ptd-` and not the bare class `ptd`, and that is what
  forced the `.ptd` conversion (Blocking 3).
- **K1 muted on the surface only:** the stated reason was that muted text "is secondary text, not AC-1's body text or
  links". The implementation contradicts it. `.bss-dashboard-link` (`styles.css:4971-4974`), a **link** shown to
  owners and admins at the top of `/settings`, paints `--bsp-muted` on the canvas at **4.25:1**. No test renders it:
  the specs sign in only as a customer, and K2 skips the rule because it has no background of its own (Blocking 2).
- **Story 1's P2:** sound. It expects `preloadFamily`'s hint.
- **Story 1's E9:** sound. `/about` and `/settings` stay pinned to today's colours whenever the look resolves to Dark,
  and the search home and `/tapestry/` under every choice. Story 2's L4 covers the reading pages' Light pre-render;
  the moved pre-render check (now on `/`) still guards the search home.

## Findings

### Blocking

1. **`ui/src/styles.css:8854-8860` (`.bs-setup-alert-button`) breaks two existing regression tests:
   `test/setup-alert-polish.test.js:326-339` (S1, in the gate) and `tests/brainstorm/setup-alert-polish.spec.js:329-336`
   (P1 ×3).**
   - S1 can't parse the wrapped values.
   - P1 runs under Playwright's default light colour scheme, so the alert on its reading page is now white on
     #b45309. P1 still requires "dark (the owner's call)", and it passes against the base build.
   - The Light pair itself is right. White on #b45309 is 5.02:1, and the design shell's light alert uses the same
     pair (`--bsd-on-solid` #ffffff on `--bsd-warn-solid` #b45309).
   - The Amendment's "9 related specs 174/174" didn't include this spec, and the safety screen skipped the Node
     suite.

   **Asked change:** Tester amendment to both tests.
   - S1 resolves the `--bsp-` wrapper to its fallback (the Dark value) and keeps "dark on amber at 4.5:1" for Dark.
   - P1 pins the dark text only while the look resolves to Dark (as E9 now does), and checks ≥ 4.5:1 in Light.
   - Record the owner's earlier "dark on the amber" call as a Dark-look decision, citing the design shell's light
     precedent, or ask David if that's not settled.

   Then show both suites passing.

2. **AC-1 is not met as rendered: body links and body text on the reading pages fall below 4.5:1 in Light.** I swept
   all 15 pages, signed out and signed in with the menu open, folding in ancestor `opacity`. Disabled controls were
   left out. Each of these was ≥ 4.5:1 in Dark at the base (same sweep against the base build):
   - **Every in-body link** on `/about`, `/about-brainstorm-search`, `/how-search-works`, `/brainstorm-skill` and
     `/personalization`: **4.05:1**. They sit in a container with `opacity: 0.85`: `BrainstormAbout.jsx:23`,
     `BrainstormAboutSearch.jsx:22`, `BrainstormHowSearchWorks.jsx:22`, `BrainstormPersonalization.jsx:22`,
     `BrainstormSkill.jsx:27`.
   - **"← Back to profile"** (`.bsp-back-link`, `styles.css:7924`, `opacity: 0.75`) on all seven `/user/<pk>/*`
     pages: **3.42:1**.
   - **"← About Brainstorm Search"** (`BrainstormSkill.jsx:21`, `opacity: 0.7`): **3.13:1**.
   - `/settings` body text at `opacity: 0.5`:
     - `.bss-subtitle` (`styles.css:4991`): 3.53:1;
     - the signed-out "Sign in with nostr to personalize…" (`.bss-empty p`): 3.53:1;
     - `.bss-card-desc` (`styles.css:5022`): 3.48:1;
     - `.bss-pov-btn-desc` (`styles.css:5246`): 3.36:1.
   - `/personalization`'s "Personalization is entirely…" paragraph (`BrainstormPersonalization.jsx:69`, opacity 0.6):
     3.65:1.
   - `.bss-dashboard-link` (owners and admins): 4.25:1. See the K1 note above.

   L1 passes all of these because `lightSweep` (`tests/brainstorm/appearance-setting-light.spec.js:141-165`) measures
   `getComputedStyle(el).color`, which ignores inherited `opacity`.

   **Asked change:**
   - Implementer: bring every link and body paragraph on the reading pages to ≥ 4.5:1 in Light **as rendered**.
     How is the Implementer's call, within ADR 0002: a darker role for these inks, or a light-scope override of the
     dimming. Inline-style opacity needs a class to override. Dark must stay byte-for-byte; T1 and L3 will hold
     that.
   - Give `.bss-dashboard-link` a role that passes on the canvas.
   - Tester amendment: L1's sweep composes ancestor opacity into the text colour, and covers an owner session on
     `/settings`, so the test bites on this class of failure.
   - Revisit the K1 narrowing's stated reason.

3. **`ui/src/styles.css:4524-4533` (`.ptd`, the Manage Tags dialog box) was converted. ADR 0002 sub-decision 7 lists
   `ptd-*` as story 3's, to "stay as they are".**
   - The box turns light (#fafaf9), but every child rule (`.ptd-close`, `.ptd-tab`, `.ptd-input`, `.ptd-result-btn`,
     `.ptd-empty` …, `styles.css:4535-4690`) keeps today's dark-look inks.
   - I opened it on `/user/<pk>` signed in, in Light. The empty-state text is rgb(139,148,158) on #fafaf9, about
     2.9:1. With tags present, the inputs and result buttons would show `#e2e8f0` text on a near-white box, about
     1.2:1.
   - So the dialog is half-converted and unreadable on a reading page. That's worse than the "stays dark" interim the
     story and ADR accept.
   - The cause is the story-3 exclusion: `STORY3` at `test/appearance-setting-light.test.js:46` (and
     `[class*="ptd-"]` at `tests/brainstorm/appearance-setting-light.spec.js:41`) doesn't match the bare class
     `ptd`, so T4 demanded the conversion.

   **Asked change:**
   - Tester amendment: the story-3 exclusion also matches the bare family roots (`ptd`, `ptc`, `pcd`).
   - Implementer: revert `.ptd` to its base declarations, so the whole dialog stays dark until story 3.

### Non-blocking

1. **Story 3's tagging pieces were converted in story 2:**
   - `.bsp-tags-*` (`styles.css:~4222-4272`), the profile Tags section;
   - `.bsp-authored-*` (`~6093-6250`, "Authored-tagging section");
   - `.bsp-note-tags-*` (`~8369-8411`);
   - `.bsp-authored-note-tag*` (`8447-8449`).

   The story's Out of scope gives "the tagging, pinning and trusted-list pieces wherever they appear" to story 3.
   ADR sub-decision 7's prefix list doesn't name these, so the inventory counted them as story 2's. It's harmless,
   since they're readable and 2 and 3 ship together. **Suggestion:** record in story 3's inputs that these are done,
   so story 3 doesn't redo or re-scope them.

2. **Global rules converted that the ADR doesn't mention:**
   - `a` / `a:hover` (`styles.css:35-36`);
   - `.data-table*`, `.table-*` and `.empty-row` (`310-399`);
   - `.constituent-card.clickable:hover` (`282-285`).

   They are needed (DataTable is on the follows, followers, muters and reporters pages) and inert outside the light
   scope. But on story 3's pages the global link rule now paints purple on their still-dark content. That's
   accepted interim. **Role slip:** `.data-table tbody tr.row-self-declared td:first-child` (`styles.css:390`) maps
   the `--purple` self-declared mark to `--bsp-shadow-3`, a grey shadow. It's unreachable in Light today: the rule is
   used only by `shared-concepts/ActiveBTags.jsx`, which is not a `.bsp-page`. Give it an accent role so a later
   scope widening doesn't inherit the slip. **Suggestion:** an ADR amendment line naming the element and shared
   rules as in scope.

3. **AC-2's "muted text":** T2 pins `--bsp-muted` equal to the design shell's `--text-muted`. But reading-page text
   that was `--text-muted` / `--text-secondary` now paints `--bsp-ink-2` (#555d69); `--bsp-muted` is read only at
   `styles.css:4974`. #555d69 is a design-shell colour (`--bsd-ink-2`), so the "one look" intent holds. Still, the
   role choice isn't recorded, and it sits oddly with Amendment 1's reason for narrowing K1 ("AC-2 requires that
   exact colour"). **Suggestion:** state the mapping in the ADR or test plan.

4. **Hover states that lose their feedback in Light** (hover and rest resolve to the same token):
   - `.bsp-confirm-ok:hover` (`styles.css:4764`, accent → accent);
   - `.bsp-report-submit:hover` (`4874`, danger → danger);
   - `.bs-login-error-btn:hover` (`7608`);
   - `.bsp-confirm-cancel:hover` / `.bsp-report-cancel:hover` border (`4756`, `4866`, border → border);
   - `.data-table tbody tr:hover` (`377`): surface on a surface wrapper, so the clickable follows rows give no hover
     feedback in Light.

   **Suggestion:** map these to `--bsp-accent-hover`, a darker danger, or a `--bsp-wash-*` tint.

5. **Secondary text in the avatar menu** at its own opacity: the "Searching as" / "Appearance" labels are 4.27:1 in
   Light (≥ 4.5 in Dark), and the pubkey is 2.66:1 (3.32:1 in Dark at the base, so it was already below AA). They
   aren't body text or links, so AC-1's 4.5 doesn't strictly apply. Worth folding into the Blocking-2 fix if cheap.

6. **Snapshot oracle scope:** sound but thin. With every `/api` mocked empty, L3 sees no populated lists, notes, feed
   items or tag chips, and no hover or focus states. T1's character-for-character check of the stylesheet is what
   carries Dark-unchanged for those states, and it's sufficient.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*
1. **The machine-safety grep hides real regressions.** It excludes any suite that mentions `/api/strfry/publish`,
   even inside a mocked `withFetch`. That skipped `setup-alert-polish.test.js` at Test Design, at Implementation and
   here, and its S1 is broken by this diff. Suggest the screen tell real network or `docker` use apart from mocked
   fetch tables, or that each phase list the suites it skipped for the next phase to run.
2. **"Related specs" is chosen by hand.** Amendment 1's "9 related specs 174/174" missed
   `setup-alert-polish.spec.js`, which pins a frame colour on a reading page. Playwright's default colour scheme is
   light, so once a family follows the setting, every existing spec that pins a colour there is affected. A grep of
   `tests/brainstorm/` for colour assertions crossed with the family's paths would have found it.

## Verdict
**CHANGES_REQUESTED**
