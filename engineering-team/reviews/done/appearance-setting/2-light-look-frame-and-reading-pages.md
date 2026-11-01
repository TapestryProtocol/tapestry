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

---

# Round 2

**Date:** 2026-11-01
**Diff:** `git diff ee6061cba..HEAD` (HEAD `b31915c26`)
- `aa5118610`: Tester changes, failing first (test plan "Amendment 2").
- `b31915c26`: the fix.

**Owner decisions (David, 2026-11-01), given by the coordinator:**
1. The "Finish setup" chip stays dark on amber in Dark, and is white on the deeper amber #b45309 in Light, as on the
   design shell's light chip.
2. This round fixes the three blockers plus round 1's Non-blocking 4 (hover states) and 5 (the avatar menu's labels).
   Everything else stays a note for story 3.

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`:** not run in full on this host (machine-safety rule). There are no run records in this worktree,
      so there is **no `gate:status` line of mine to quote.** The coordinator reports a sealed full run in a
      throwaway container (`tapestry-ci-gate-deb`, `--network none`, a clone of `b31915c26` after `npm ci`):
      "Overall: PASS — 6303 passed, 0 failed, 622 skipped across 320 suites". I did not see that record myself.
- [x] **Node, one suite at a time through `run()`,** with `BRAINSTORM_BASE_URL=http://127.0.0.1:9` and each
      grep-screened first:
  - `appearance-setting-light`: **12/12** (T5 included). `appearance-setting`: **16/16**.
  - The twelve round-1 regression suites again, all clean:
    - `treasure-map-needs-attention` 6/0;
    - `profile-verified-reporters-count` 11/0;
    - `profile-follows-list` 27/0;
    - `live-feed-feed-page` 27/0;
    - `author-scoped-inspection-views` 23/0;
    - `tag-actions-menu-ui` 30/0;
    - `login-failure-and-tag-collapse` 18/0;
    - `about-this-instance` 29/0;
    - `information-for-agents` 53/0 (4 skipped);
    - `recognizable-published-ta-profile` 8/0 (5 skipped);
    - `relay-scan-bounds` 21/0 (7 skipped);
    - `tag-detail-curated-view-and-pin-polish` skips all 33 without a live stack.
  - **`setup-alert-polish.test.js`: still not run** (safety-grep match). I reproduced its new S1 independently from
    the stylesheet: Dark `#0f0f1a` on `#d29922` is **7.54:1** (dark on amber); Light `#ffffff` on `#b45309` (the
    light-scope token values) is **5.02:1**. Both satisfy the owner's decision and the 4.5:1 floor.
- [x] **Playwright, chromium, against a fresh build of HEAD.** I rebuilt it into the `:4174` directory and checked
      that `:4174` serves the new CSS hash (`index-DgojI0_N.css`). `appearance-setting-light.spec.js`,
      `appearance-setting.spec.js`, `setup-alert-polish.spec.js` (P1 now runs in dark and light) and
      `assistant-alert.spec.js` together: **113/113 pass.**
- [x] **The new L1 bites.** I built `5e30cf41c` (round 1's implementation) into my own scratch directory and served
      it on a private port. HEAD's L1 against it fails **15/15**, so the opacity fold and the owner session now catch
      round 1's Blocking 2.
- [x] **Dark is identical, opacity included.** I compared HEAD and the base (`56d76a2b4`) in Dark, element by element
      on all 15 reading pages, signed out, as a customer with the menu open, and as an owner with the menu open (45
      page loads). Each element's computed `opacity`, `color`, `background-color`, top border, `box-shadow` and
      `outline-color` matched: **0 differences.** This matters because L3's snapshot doesn't record opacity, and the
      new `--bsp-opacity-*` reads include inline JSX styles that T1 doesn't parse.

## Round-1 findings, re-checked

1. **Blocking 1, the Setup chip and its tests: resolved.**
   - S1 and P1 now encode the owner's decision in both looks.
   - P1 passes 6/6 (dark and light × 1280, 800 and 375 px), and S1's pairs reproduce as above.
2. **Blocking 2, AC-1 as rendered: resolved for body text and links.**
   - My independent opacity-aware sweep ran on all 15 pages × signed out / customer + menu / owner + menu, in Light.
     Every link and every paragraph is now ≥ 4.5:1.
   - `.bss-dashboard-link` uses `--bsp-ink-2` and passes.
   - The avatar menu's "Searching as" / "Appearance" labels and its pubkey no longer fall below 4.5:1 (round 1's
     Non-blocking 5).
   - The only text left under 4.5:1 that isn't disabled:
     - **The Admins count chip** on `/about` (`AboutThisInstance.jsx:130-131`): accent on its accent tint, inside
       `labelStyle`, whose opacity is now dim (0.72). As rendered, about **2.7:1** at 12px/600. It was 2.28:1 in
       Light in round 1 and 3.61:1 in Dark. See Non-blocking R2-1.
     - **The owner card's initial letter** ("O", `aria-hidden`, a decorative avatar fallback inside the card link):
       3.68:1. Decorative, so not under AC-1.
3. **Blocking 3, the Manage Tags dialog: resolved.**
   - `.ptd` is byte-identical to the base.
   - No story-3 family rule reads a `--bsp-` token (T5).
   - Opened on `/user/<pk>` in Light, the whole dialog is dark again (`#1e293b`, `#e2e8f0`), the interim the story
     accepts.
   - I also cross-checked every story-3-looking component file that the reading pages import. The only ones with
     converted classes are `ProfileTagsSection.jsx` (`bsp-tags-*`), `AuthoredTaggingSection.jsx` (`bsp-authored-*`)
     and `NoteTags.jsx` (`bsp-note-tags-*`). In each, every class with a colour rule is converted, so none is half
     done. Those three are round 1's Non-blocking 1, which the owner left as a note for story 3.
4. **Non-blocking 4, hover states: resolved.**
   - `.data-table tbody tr:hover` → `--bsp-wash-2`;
   - `.bsp-confirm-ok:hover` and `.bs-login-error-btn:hover` → `--bsp-accent-hover`;
   - `.bsp-report-submit:hover` → `--bsp-danger-hover` (#912018; white on it is AA);
   - both cancel hover borders → `--bsp-ink-2`.

   Each now differs from its resting state in Light.
5. **Non-blocking 2's role slip:** the `.row-self-declared` mark now reads `--bsp-accent`. Resolved.
6. **Non-blocking 1 and 3** (story 3's tagging pieces done early; muted text painted as `ink-2`): left as notes,
   per the owner.

## The opacity rule, where it landed

There are 68 stylesheet declarations plus the inline styles of the six reading-page files. `soft` (0.6 < x < 1)
becomes 1 in Light; `dim` (x ≤ 0.6) becomes 0.72.

- **Dark-identical:** proven above, by construction and by measurement.
- **Light:** almost all of these rules dim text in today's ink (`--bsp-ink` / inherited). At 0.72 that is about
  7.5:1 on the canvas. Examples: loading lines, timestamps (`.bsp-note-card-time`, `.bsp-age`), the profile npub
  and nip05, card labels, the pubkeys, and the decorative separators and chevrons (`.bsp-authored-peer-sep`, the `›`
  in `AboutThisInstance`).
- **The exception is the Admins chip.** `dim` is applied to a container whose child paints accent on a tint, so the
  CSS comment's "about 7:1 in ink" doesn't hold there.
- **State pairs keep a visible difference in Light:**
  - `.bsp-top-link` 0.72 → `.is-active`/`:hover` 1;
  - `.bsp-copy-btn` 0.72 → hover 1;
  - `.bs-usermenu-action-btn` 0.72 → hover 1;
  - `.bss-save-btn.saved` 0.72 against 1.
- **Where `soft` → 1 removes the dimming:**
  - `.bs-appearance-option` (the active option keeps its tint and accent ink);
  - `.bsp-back-link` (hover keeps its underline);
  - `.bsp-action-btn.bsp-action-reported` (keeps its danger tint and ink).

  These lose a little hierarchy but keep a cue. Acceptable.
- **Untouched:** disabled opacities (0.25–0.4 on `:disabled` / `.disabled`), as WCAG exempts them.
- **Inert:** `.bs-usermenu-pov-indicator` (search home only) has a converted opacity and a bare `#a5b4fc` on its
  `strong`. Neither can apply, because the search home has no light scope. It's story 4's to finish.

## Findings (round 2)

### Blocking
None.

### Non-blocking
1. **R2-1: the Admins count chip** (`ui/src/components/AboutThisInstance.jsx:15-16` `labelStyle` opacity dim,
   holding `chipStyle` at `:18-21`) renders at about **2.7:1** in Light. That is below the test plan's own 3:1 for
   non-body text.
   - L1 misses it because its `bgOf` skips backgrounds under alpha 0.5 (the chip's 0.18 tint), and it doesn't fade
     the background by the group's opacity.
   - Suggestion for story 3 or a follow-up: give the chip's text `--bsp-accent-ink` (#5b21d6) or take the chip out
     of the dimmed label. In L1, composite translucent backgrounds the way the text is already composited.
2. **R2-2: ADR 0002 doesn't record the opacity mechanism.**
   - `--bsp-opacity-soft` / `--bsp-opacity-dim` extend the token layer from colour to opacity. ADR 0002's
     implementation note 1 lists only colour properties.
   - It's the same pattern (Dark is the fallback character for character, and T1 covers it in the stylesheet), but
     the ADR should say so. So should story 3's inputs, because its families use the same dimming.
   - Suggestion: an ADR 0002 amendment line.

### Harness friction
1. **Unrun, unconfirmed:** `setup-alert-polish.test.js` still can't run under this machine's safety screen. Its
   result here rests on a static reproduction plus the coordinator's sealed-container gate. Round 1's friction 1
   stands. (Already filed for OPEN.md by round 1; no new row.)

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place. **Left to the coordinator:** this reviewer was told not to edit
      the story or commit.
- [ ] Completion detection: done in the hand-off message, not in this file.

## Verdict
**PASS**
