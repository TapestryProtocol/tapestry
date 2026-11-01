# Review: Story 3 — A light look for the working pages

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-01
**Diff:** `git diff 34bd3957b..HEAD` (HEAD `94deec339`; commits eb036a08f story, 34bd3957b ADR, 25563c47a failing tests
and the W3 fixture, b3b42f58e re-aims, 94deec339 impl)
**Story:** `engineering-team/stories/appearance-setting/3-light-look-working-pages.md`
**ADR:** `engineering-team/decisions/appearance-setting/0003-working-pages-join-the-light-token-layer.md` (on ADR 0002
and its Amendment 1)
**Test plan:** `engineering-team/stories/appearance-setting/3-light-look-working-pages.test-plan.md` (with its
Amendment 1)

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`:** not run in full on this host (machine-safety rule). There are no run records in this worktree,
      so there is **no `gate:status` line of mine to quote.** The coordinator reports a sealed run in a throwaway
      container (`tapestry-ci-gate-deb`, `--network none`, a clone of `94deec339` after `npm ci`): "Overall: PASS —
      6313 passed, 0 failed, 622 skipped across 321 suites". I didn't see that record.
- [x] **Node, one suite at a time through `run()`,** with `BRAINSTORM_BASE_URL=http://127.0.0.1:9`, each screened
      first. All clean:
  - `appearance-setting-working` 11/11;
  - `appearance-setting-light` 11/11;
  - `appearance-setting` 16/16;
  - `assistant-shared-categories` 21/0;
  - `assistant-management-page` 23/0 (H1 skips without a live stack).
  - **46 more suites** that read `styles.css`, `index.html`, `src/lib/appearance.js` or the changed JSX: all pass.
    That includes `setup-alert-polish` 17/0 (it only stubs fetch) and `treasure-map-relay-presence` 35/0;
    `tag-detail-curated-view-and-pin-polish` skips all 33 without a stack.
  - **Not run** (screen match): `note-tagging-raw-events-inspector-ui`,
    `show-the-four-on-the-goal-screens-that-already-exist`, `teach-it-what-matters` (docker / stack), and
    `one-writer-assistant-profile` (drives the real publish handler in-process; I kept to the rule).
- [x] **Playwright, chromium,** against `:4174`, which serves a build of HEAD. A rebuild gave the same CSS hash,
      `index-Bt1N5fzf.css`.
  - Story 3's spec + story 2's + story 1's + `assistant-shared-categories`: **135/135 pass.**
  - **56 other screened, mocked specs** (every assistant, setup, tag, pin, TL, treasure-map, avatar and
    shared-concepts spec): 719 pass, 6 skipped, 52 fail. I ran the 9 failing spec files against my own build of the
    base `34bd3957b` (private port): **the same 50 fail there**. They are pre-existing in this mocked environment
    (`pin-a-tag`, `tag-detail-write`, `customize-pin-curation`, `most-pinned-tag-index`, `nip51-list-export-from-pins`,
    `tl-publication-from-pins`, `tapestries-nav-and-directory`, `assistant-duties-settings` B8).
  - Two failed on HEAD only, and neither is this story's:
    - `assistant-duties-settings` B6 passes 3/3 when rerun alone on HEAD (a flake under 14 workers).
    - `author-scoped-inspection` E3 fails 3/3 against the base too.
  - So **no other spec asserts a story-3 colour and now fails.**
- [x] **Dark is identical, opacity included** (my own measurement). HEAD against the base build `34bd3957b`, in
      Dark, element by element: opacity, colour, background, top border, box-shadow, outline.
  - Covered: every working page plus `/tag/<slug>/<id>`, the search home, `/tapestry/`, `/dictionary`, `/about`
    and `/user/<pk>`, each signed out, as a customer with the menu open, and as an owner with the menu open.
  - Result: see "Dark check" below.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._ (The vite build of HEAD succeeds.)

## Spec adherence
- [ ] Every acceptance criterion has a passing test. **They all pass, but AC-1 and AC-2 are not met as rendered.**
      W1, W2 and W6 sweep only what the mocks render, and every working-page mock returns empty data. So no tag chip,
      tag row, pin row, stale marker, TL row, populated Manage Tags dialog or populated profile editor is ever on
      screen. Typed text in inputs is never measured either. Blocking 1 and 2.
- [x] No criterion is silently dropped.
  - AC-3: W7 and T2's light values.
  - AC-4: T1, W3, and my Dark check.
  - AC-5: W4, C1, C2, P1, P2.
  - AC-6: W5.
  - AC-7: I2 and W6. The chip computes to about 3.4:1 as rendered in Light.
  - AC-8: story 2's L3 and L7, plus I3.
- [x] No behaviour beyond the story. Generic admin classes it touches (`.settings-group`, `.settings-message-error`,
      `.tsm-*`, `.tan-*`, `.table-page-info`) render on working pages. Outside the light scope they fall back to
      today's values, which the Dark check and L7 confirm.

## ADR adherence
- [ ] Files changed match the ADR. **Deviations:**
  - Sub-decision 1's scope misses classes the inventory's finder can't see (Blocking 1).
  - Sub-decision 4 lists the inline colours as "14", but `pages/developers/Hub.jsx`, `Nip50.jsx` and
    `OpenRanking.jsx` hold seven more (Blocking 2).
  - Sub-decision 3 / ADR 0002 Amendment 1 say disabled states are left alone, yet ten `[disabled]` / `.saved` /
    `.is-parked` opacities were converted (Blocking 4).
  - Sub-decision 2's role map sends `var(--text-tertiary, #64748b)`, a muted grey, to the accent (Blocking 3).
  - The inline opacities in `AssistantProfileEditor.jsx` weren't converted (Blocking 2).
- [x] Layering: `WORKING_PATH_PREFIXES`, `isWorkingPath` and `preloadFamily` (design first) are in
      `src/lib/appearance.js`; `index.html`'s hand copy is pinned by P1 and P2. `compositeAvatar.js` is untouched (I3).
- [x] No new dependencies.

## Concept-graph integrity
- [x] No concepts, handles or firmware touched.
- [x] No firmware reinstall needed.
- [x] N/A: no domain code.

## Things tests can't catch
- [x] No secrets, debug logging or commented-out code.
- [ ] States that matter (Blocking 1–4). Hover and focus states are fine: a static check of every `:hover` /
      `:focus` rule in the profile families against its resting rule found none that resolves to the same Light
      value while differing in Dark.
- [x] Concurrency: n/a beyond story 2's hint removal.
- [x] Security: n/a.

## House rules check
- [x] Concept Graph API authority respected (not applicable).
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence
- [x] No PRD. Book decision 4 (the design shell's light look) is pinned by T2's light values.

## Re-aims in other stories' tests
- **Story 2's C2:** sound. It drops `/tags` and `/assistant/profile` from its "no hint" list; story 3's C2 pins
  them as `profile` and keeps `/assistants` (design) apart. `/` and `/tapestry/` stay pinned to no hint.
- **Story 2's T5 (retired):** sound. Its rule was story 2's interim; story 3's T2 requires the opposite.
- **Story 2's L7 `/tags` entry (retired):** sound. W1 covers `/tags` in Light and W3 in Dark.
- **`assistant-shared-categories.spec.js` SC2:** sound. It pins the old Dark value with an explicit dark scheme,
  then adds the Light value.
- **`assistant-shared-categories.test.js` D3:** sound. Its original checks run on the wrapper's Dark fallback, and it
  adds a Light 4.5:1 check. Nit: the Light line is measured on the canvas, where the line actually sits on a white
  card. The card gives more contrast, so this is conservative.
- **`assistant-management-page.test.js` O4:** sound and narrow. It exempts only the
  `WORKING_PATH_PREFIXES =` line in `src/lib/appearance.js`.
- **The `DevPage.jsx` exception** (0.6 intro → `--bsp-opacity-soft`, full in Light, because it holds links):
  reasonable and recorded. It's Dark-identical (the fallback is 0.6).

## Dark check
**0 differences in all 78 page loads**: 26 pages, each signed out, as a customer and as an owner. The 26 are the 21 working paths, `/` (the search home), `/tapestry/`, `/dictionary`, `/about` and `/user/<pk>`.

- The comparison covers computed `opacity`, `color`, `background-color`, the top border, `box-shadow` and `outline-color` of every element. So it covers the inline styles and opacities that T1 doesn't parse and W3 doesn't record.
- Generic admin classes the story wrapped (`.settings-*`, `.tsm-*`, `.tan-*`) are Dark-identical by construction, and `/tapestry/` matches.
- `/tapestry/` renders only 8 elements under empty mocks, so the evidence there is thin. Construction carries it: no `--bsp-` token is declared outside the light scope.
- **The W3 oracle is sound:** W3 against my own build of the base `34bd3957b` passes 22/22.

## Findings

### Blocking

1. **Story-3 colours the conversion never reached: unreadable in Light where they render.** The inventory's class
   finder (`classesFrom`, `test/appearance-setting-light.test.js:234-255`) reads only literal strings inside
   `className`. It misses:
   - classes built in a nested template (`TagChip.jsx:124`);
   - classes held in a variable (`TagPageRow.jsx:165-168`, `SearchInput.jsx:26-27`);
   - classes chosen in a `${…}` expression (`AssistantProfileEditor.jsx:477`).

   So T2 and K1 never see these rules. I measured each by its computed colours in Light on `/tags`, injecting the
   missing classes where the mocks don't render them:
   - **`.ptc-chip`** and its `-mine-apply` / `-mine-dispute` / `:hover` / `:focus-visible` rules
     (`ui/src/styles.css:4311-4334`): the tag chips on profiles, notes and `/tags`. Their labels paint `#e2e8f0` on
     a near-canvas tint, **1.00–1.07:1**, invisible in Light. This fails AC-2's own example.
   - **`.bs-tag-row-net.is-positive/.is-negative/.is-zero`** (`:5452-5454`): the net score on every `/tag/<id>` row.
     #4ade80 / #f87171 / #fcd34d on the canvas read **1.56 / 2.48 / 1.29:1**. `.bs-tag-row`'s bottom border (`:5380`)
     is white at 0.05, so the separators vanish.
   - **`.bs-search-input-results`** (`:3487-3505`) on `/tags`: the text a person types is `#e0e0e0` on the canvas,
     **1.19:1**. `.bs-search-box-results` (`:3472`) is a white 0.04 wash, so the box is invisible on the canvas.
   - **`.bs-result-age.stale`** (`:3658`, pinned-list freshness): #d29922 on the canvas, **2.27:1**.
   - **`.settings-message-success`** (`:1178-1182`, the profile editor's publish result): stays a dark green box
     (#0d2818) in Light.

   **Asked change:**
   - **Tester amendment:** widen the finder to classes in nested templates, in `${…}` expressions and in string
     variables or ternaries (any quoted token in the walked files that names a CSS class is a reasonable superset).
   - **Tester amendment:** give W1/W2 populated mocks: `/tags` with tags, `/tag/<id>` with rows and net scores, a
     pinned list with a stale entry, a profile with tag chips, and the Manage Tags dialog with results. Also measure
     the typed text in inputs.
   - **Implementer:** convert every rule the widened finder reaches.

2. **Inline styles the conversion missed.**
   - **Colours** in `ui/src/pages/developers/Hub.jsx:6`: the cards' `border: 1px solid rgba(255,255,255,0.1)` and
     `background: rgba(255,255,255,0.04)`. On the light canvas the `/developers` cards lose their edges and fill.
   - **Colours** in `Nip50.jsx:44,51,56` and `OpenRanking.jsx:97,104`: the table rows' white borders, so the row
     separators vanish in Light.
   - **Opacities:** `AssistantProfileEditor.jsx` still holds seven literal inline opacities (`:285, 297, 306, 340,
     347, 390, 428`). I rendered `/assistant/profile/edit` as an owner with a populated status in Light. Inside
     `:347`'s 0.8, **"View public profile →" reads 4.01:1** (a link, under AC-1's 4.5) and **"⚠️ Not yet" 3.53:1**.
     "✅ Yes" computes to about 3.5:1 too.
   - I1 checks only `AssistantProfileEditor.jsx`'s colours and `DevPage.jsx`, and T3 only the stylesheet.

   **Asked change:**
   - **Implementer:** wrap the seven colours (border shorthands split into width/style plus a colour, as
     sub-decision 4 says), and give the editor's inline opacities ADR 0002 Amendment 1's tokens.
   - **Tester amendment:** extend I1 to every working-page file and imported component, and add an inline-opacity
     check alongside T3.

3. **A muted grey mapped to the accent.** `var(--text-tertiary, #64748b)` became `var(--bsp-accent, …)` in eleven
   rules; `--text-tertiary` is declared nowhere, so Dark paints #64748b slate. Those rules:
   - `.bs-pins-row-chevron`, `.bs-pins-row-status`, `.bs-pins-row-status.is-never` (`:6561-6570`);
   - `.bs-pins-member-hint`;
   - `.bs-pindetail-meta dt`, `.bs-pindetail-empty`, `.bs-pinned-notes-empty`, `.bs-pindetail-member-nip05`;
   - `.pcd-close`, `.pcd-tag-label` (`:7012`), `.pcd-helper`.

   In Light, the pin pages' chevrons, statuses, field labels, empty states and helper text all paint the link
   purple. They read as links, and AC-3's "muted text is the same colour as the rest of the light site" doesn't
   hold.

   **Asked change:** map them to `--bsp-ink-2` (or `--bsp-muted` where they sit on a card). Have the Tester add a
   role check that no muted or tertiary fallback (`--text-muted`, `--text-secondary`, `--text-tertiary`, or a slate
   grey) resolves to an accent token.

4. **Disabled states converted, against ADR 0002 Amendment 1 / ADR 0003 sub-decision 3** ("non-disabled";
   "disabled states are left alone"). Ten converted opacities sit on disabled selectors:
   - `.bs-tag-row-apply[disabled]` / `.bs-tag-row-dispute[disabled]` (`:5780-5784`): 0.85 → **1 in Light**;
   - `.bs-tag-pin[disabled]` (`:6429`);
   - `.bs-pins-refresh-all[disabled]` (`:6611`);
   - `.pcd-unpin/.pcd-submit/.pcd-cancel[disabled]`;
   - `.bs-pindetail-edit[disabled]` (`:7174`);
   - `.bss-save-btn.saved`;
   - `.bs-idtags-row.is-parked` (`:9187`).

   The Apply/Dispute pair matters most. Their hover is already suppressed by `:not([disabled])`, so in Light a
   disabled Apply or Dispute looks exactly like an enabled one. The script's disabled test evidently matched
   `:disabled` but not the `[disabled]` attribute selector, and T3 didn't catch it.

   **Asked change:** restore these to their literal values. Have the Tester make T3 treat `[disabled]` (and the
   repo's other inactive markers: `.saved`, `.is-parked`, `.is-disabled`) as disabled.

### Non-blocking
1. **`.settings-message-error`** (`styles.css:1183-1187`) maps its dark-red box (#2d0a0a) to `--bsp-canvas`, so in
   Light the error loses its tint and keeps only the red border and text. `--bsp-danger-tint-1` would match the
   other error boxes.
2. **`.bs-tl-export` and `.bs-tl-export-confirm`** (pink #f9a8d4) and `.bs-tagindex-count-pinned` (#d8b4fe) all
   become the purple accent ink. They're readable, but the TL export loses the pink that set it apart from the
   kind-30392 share control (nip51-list-export AC-14 asked for "visually distinct"). Worth a look in story 4 or a
   follow-up.
3. **`.bs-tag-row-verif`** maps #d4b675 to `--bsp-warn` (#b45309), a deeper amber. Fine; noted only because its
   Dark value isn't a warning colour.
4. **Test-plan Amendment 1's sweep exemption** (the label of a disabled control) is reasonable and WCAG-backed.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*
1. **Empty mocks hide populated states.** Every appearance sweep (story 2's L1, story 3's W1, W2, W6) runs on
   `/api` mocks that return empty data. A light-look sweep that never renders a row, chip or dialog with content
   can't check the pieces the story is about. Story 2's review saw the same with the empty Manage Tags dialog. A
   shared "populated" mock set for the profile family would serve stories 3 and 4 and later themes.
2. **The class inventory is a regex over `className`** and silently undercounts. Stories 2 and 3 both re-aimed it
   (function-form classNames, then the bare `ptc`/`ptd`/`pcd`), and it still misses nested templates and variables.
   A finder that takes every quoted token naming a CSS class would close the class of miss.

## Verdict
**CHANGES_REQUESTED**
