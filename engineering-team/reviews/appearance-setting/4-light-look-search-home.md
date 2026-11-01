# Review: Story 4 — A light look for the search home

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-01
**Diff:** `git diff 7690c8e16..HEAD` (HEAD `e9ca88351`; commits:
- `dae991052`: failing tests and re-aims;
- `1837692b7`, `3bc5f2dfe`, `a6342eeeb`: Tester amendments;
- `4c5f64201`: the implementation;
- `e9ca88351`: the test plan's results.)

**Story:** `engineering-team/stories/appearance-setting/4-light-look-search-home.md`
**ADR:** `engineering-team/decisions/appearance-setting/0004-search-home-joins-the-light-token-layer.md`
**Test plan:** `engineering-team/stories/appearance-setting/4-light-look-search-home.test-plan.md` (with Amendment 1)

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`:** not run in full on this host (machine-safety rule). There are no run records in this worktree, so
      there is **no `gate:status` line of mine to quote.** The coordinator reports a sealed run (container
      `tapestry-ci-gate-deb`, `--network none`, `CI=true`): "6,342 passed, 0 failed, 622 skipped, across 323 suites".
      I did not see that record.
- [x] **Node, one suite at a time through `run()`,** with `BRAINSTORM_BASE_URL=http://127.0.0.1:9`, each screened
      first:
  - the four appearance suites: `appearance-setting-home` **15/15**, `appearance-setting-working` 14/14,
    `appearance-setting-light` 11/11, `appearance-setting` 16/16;
  - `setup-alert-polish` 17/0 (its S1 is re-aimed);
  - `assistant-shared-categories` 21/0;
  - `assistant-management-page` 23/0 (H1 skips without a stack);
  - **the 44 related suites** from story 3: all clean, apart from `tag-detail-curated-view-and-pin-polish`, which
    skips all 33 without a stack;
  - **nine more that read the search home's sources:** `manage-treasure-map-page`, `negentropy-sync-access`,
    `nip05-checkmark-verification`, `pov-state-unification`, `pov-resolution-status`, `pov-selectable-tag-surfaces`,
    `search-results-url`, `search-api-result-type-settings`, `search-result-parity`. All clean.
- [x] **Playwright, chromium,** against `:4174`, rebuilt from HEAD (same CSS hash, `index-DhKhfmhI.css`):
  - stories 1–4, `assistant-shared-categories`, `setup-alert-polish`, `assistant-alert`, `about-this-instance` and
    `login-failure-and-tag-collapse`: **216/216 pass.**
  - **The 56 other screened, mocked specs:** 719 pass, 6 skip, 52 fail. The failures are exactly the same set as at
    story 3's HEAD, which were pre-existing in this mocked environment (story 3's review). So nothing regressed.
- [x] **The H5 oracle is sound.** I extracted the base `7690c8e16` with `git archive`, built it, and served it on a
      private port. H5 against that base build: **7/7.** The whole story-4 spec against the base fails 18, which
      matches the test plan's "failing first" count.
- [x] **Dark is identical (my own measurement).** HEAD against the base build, in Dark, element by element: opacity,
      colour, background, top and left borders, box-shadow, outline. **0 differences in all 14 states:**
  - the landing signed out, with the suggestions open, and with the point-of-view picker open (signed out and in);
  - the results, also with a card hovered and with the tag hits expanded;
  - the results as an owner with setup pending and the avatar menu open;
  - empty, error and loading;
  - `/information-for-agents`, `/tapestry/` and an unknown path.
- [ ] _Lint not configured._ _Typecheck not configured._ _Build not configured (the vite build of HEAD succeeds)._

## Spec adherence
- [ ] **AC-1 (links ≥ 4.5:1 as rendered) is not met in one state** (Blocking 1).
- [x] **The other criteria are met:**
  - AC-2: M1, M2 and H4. As rendered, the stale marker is warm and above 4.5:1; the badges are 4.67:1 and above on
    white.
  - AC-3: S1, M4, H9.
  - AC-4: H7.
  - AC-5: T1, H5, and my Dark check.
  - AC-6: C1–C3, P1, H6.
  - AC-7: H8.
  - AC-8: H10 and the earlier stories' specs.
- [x] Nothing beyond the story, apart from adding `/information-for-agents` to the pre-render list (ADR 0004
      sub-decision 4). That fix is only half done (Blocking 2).

## ADR adherence
- [x] Files match the implementation notes: `styles.css`, `src/lib/appearance.js`, `ui/index.html`. There were no
      inline colours in the search home's own JSX to wrap.
- [x] The harness notes (sub-decision 6) are done:
  - the `prefix-${` rule is narrowed. I checked that the only single-segment start it now drops, `raw-${…}` in
    `NoteTags.jsx`, is a React key, not a class;
  - I4 is tightened;
  - every test change is in a Tester commit. The implementation commit touches only `src/lib/appearance.js`,
    `ui/index.html` and `ui/src/styles.css`.
- [x] No new dependencies.

## Concept-graph integrity
- [x] None touched; no firmware change.

## Things tests can't catch
- [x] No secrets, debug output or commented-out code.
- [ ] States the sweeps exempt or don't reach (Blocking 1, Non-blocking 1 and 2).

## House rules check
- [x] Concept Graph API authority respected (not applicable).
- [x] No new lint, typecheck or build tooling.

## The coordinator's calls, judged
1. **HOLDS_LINKS** (`.bs-personalization` 0.55, `-compact` 0.6 and `.bs-footer` 0.35 read the soft token, so they're
   full in Light): **sound.** It follows story 3's DevPage precedent. Under the dim token's 0.72, their links would
   read about 3.3:1.

   The cost: the personalization line and the footer lose their quiet look in Light. Also, `.bs-personalization-status`
   loses its hover cue in Light (Non-blocking 2).
2. **The `.bs-wot-rank` K1 allowance: sound.** K1 lays the badge's tint over the canvas, but the badge sits on a white
   card. H4 measures it as rendered, at 4.67:1.

   On a *hovered* card it drops to 3.88:1 (Non-blocking 1).
3. **"What is this?" reads the ink, not the accent: sound.** In Dark it's `--text-primary` at reduced opacity, a quiet
   text link, not an accent. In Light it now reads 19:1.
4. **The `.bs-pov-option.disabled` sweep exemption: too broad.**
   - It is right for the signed-out option ("You must be logged in…"), which is inactive text.
   - It is wrong for the signed-in "being calculated" option, which holds a working **Settings link**. That link
     isn't an inactive component, and it reads **2.29:1** in Light (Blocking 1).
5. **Narrowing `isFamilyRule`** so that a shared state class never qualifies a rule: **sound.** I checked that no
   family page renders a standalone state class whose rule paints colour. The only stylesheet rules made of state
   classes alone are `.loading` and `.error`, and no walked file uses either alone. `is-agree` and `is-disagree` are
   styled under `.bsp-authored-peer`, which still qualifies.

## Re-aims in the earlier stories' tests
Each pins something this story changes on purpose, and each still guards the rest:
- **Story 1, E9:** `/` is pinned only while Dark, as `/about` has been since story 2. Its "no light background before
  render" check moves to `/no-such-page` (NotFound, outside every family), which still guards the case the test is
  for.
- **Story 2:**
  - C2 now gives `profile` for `/`.
  - The light scope is found by its shape (`isScope` requires `.bsp-page` and `.bss-page` in the `:is()` list), so
    T2, T3 and K1 still read it.
  - L7's `/` entry is retired; H1–H3, H5 and H10 cover the search home.
- **Story 3:**
  - `WORKING_PREFIXES` gains `/information-for-agents`, and C2 gives `profile` for `/`.
  - The `-landing` exclusion and the W8 allowlist are removed. That strengthens the guard.
  - `isFamilyRule` is narrowed (judged above). I4 is tightened, which is stricter.
  - The helpers are exported unchanged.
- **`setup-alert-polish` S1:** its regex accepts an optional `, .bs-page`. That's legitimate, but brittle: the next
  page added to the `:is()` list breaks it again. Story 2's `isScope` shape-match would be sturdier (Non-blocking 3).

## Findings

### Blocking

1. **The Settings link in the point-of-view picker's "being calculated" option reads 2.29:1 in Light**
   (`ui/src/pages/BrainstormSearch.jsx:1316-1319` and `:1440-1443`; `ui/src/styles.css:3386-3387`
   `.bs-pov-option.disabled { opacity: 0.5 }`; `:3405` `.bs-pov-option-link`).
   - **When it shows:** to a signed-in person whose own point of view isn't computed yet, which covers most new
     sign-ins. Their only way forward is that Settings link.
   - **Measured** with a probe that doesn't exempt the option: 2.29:1 on the landing and in the results header. AC-1
     requires links at 4.5:1 as rendered.
   - **Why the tests pass:** H1–H3's sweep exempts the whole `.bs-pov-option.disabled` subtree (WCAG 1.4.3's inactive
     components), but a link isn't inactive. In Dark it's 1.81:1 today, which Dark must keep.
   - **Asked change:**
     - **Tester amendment:** narrow the exemption so that the option's own text stays exempt and links inside it are
       measured.
     - **Implementer:** make the link reach 4.5:1 in Light only. For example, the option's dimming in Light could come
       from colour rather than opacity, with an ADR-noted exception to T4 for this selector, because it's a notice
       holding a link, not a disabled control. The approach is the Implementer's call.
2. **`/information-for-agents` is light but its own colours were never converted.**
   - **The field:** the "What are you building?" textarea (`ui/src/pages/InformationForAgents.jsx:10-13`, `field`)
     paints `border: 1px solid rgba(255,255,255,0.15)` and `background: rgba(255,255,255,0.06)`. On the light canvas
     the field has no visible edge or fill: light-on-light, which my screenshot shows.
   - **The status line:** the "Copied" status at `:63` has a literal `opacity: 0.75`.
   - **Why it was missed:** the page renders `DevPage` (a `.bsp-page`), so it has been light since story 3. But it's
     the one light-scope page file outside every inventory: it's not reached from `READING_FILES`, `WORKING_FILES` or
     `BrainstormSearch.jsx`, so T2, I1, I4 and the sweeps never see it.
   - **Why it's this story's:** ADR 0004 sub-decision 4 adopts the page ("story 3's gap") but adds only its path. With
     this the book's last story, it should leave no light page with an invisible field.
   - **Asked change:**
     - **Tester amendment:** add `pages/InformationForAgents.jsx` to the walked inventory, and add the page to a Light
       sweep.
     - **Implementer:** wrap the two colours (border split into width/style plus a colour property) and the status
       opacity.

### Non-blocking
1. **A hovered result card dims its own text in Light.** The global `a:hover` colour (`--bsp-accent-hover`) is
   inherited by the card's text, which sits under the 0.72 dim.
   - As rendered on a hovered card: nip05, about, links and the age at **3.54:1**, and the Verification Score badge at
     **3.88:1**.
   - It's hover-only and the pattern predates this story (Dark today is 1.9–3.7:1 in the same state), but it falls
     under AC-1 in that state.
   - A rule `.bs-result-card:hover { color: var(--bsp-ink, var(--accent-hover)) }` would fix Light and keep Dark
     identical.
2. **`.bs-personalization-status:hover`** (`styles.css:3341`) dims on hover in Dark (0.8). In Light both states
   resolve to 1, so it has no hover cue.
3. **S1's regex is brittle** (`test/setup-alert-polish.test.js:339`). Reuse story 2's `isScope` shape-match.

### Harness friction
1. **Exemption scope.** The sweep's "inactive" exemption is keyed by container. A container that holds both inactive
   text and an active link needs per-element judgement. Worth a line in the test-plan template: exempt elements, not
   containers, and never an `a` or a `button`.

## Verdict
**CHANGES_REQUESTED**

---

# Round 2

**Date:** 2026-11-01
**Diff:** `git diff 5ae5f89b8..HEAD` (HEAD `c94a8f1b5`)
- `28dac6e47`: Tester changes, failing first (test plan Amendment 2).
- `c9281ab3b`: ADR 0004 Amendment 1.
- `c94a8f1b5`: the fixes.

**Owner decision after review 1** (David, "Yes, with hovers", given by the coordinator): fix both blockers test-first,
plus the hover fixes (round 1's Non-blocking 1–2) and the sturdier S1 (Non-blocking 3).

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`:** not run in full on this host. There are no run records in this worktree, so there is **no
      `gate:status` line of mine to quote.** The coordinator reports a sealed run (`tapestry-ci-gate-deb`,
      `--network none`, `CI=true`): "6,345 passed, 0 failed, 622 skipped, across 323 suites". I did not see the record.
- [x] **Node, one suite at a time,** each screened first:
  - `appearance-setting-home` **18/18** (C4, M5 and M6 are new);
  - `appearance-setting-working` 14/14, `appearance-setting-light` 11/11, `appearance-setting` 16/16;
  - `assistant-shared-categories` 21/0;
  - `assistant-management-page` 23/0 (H1 skips without a stack);
  - **the same 57 related suites as round 1:** all clean (`tag-detail-curated-view-and-pin-polish` skips without a
    stack), `setup-alert-polish` (S1 now uses `isScope`) included.
- [x] **Playwright, chromium,** against `:4174`, rebuilt from HEAD (same CSS hash, `index-DR7Domws.css`): stories 1–4,
      `assistant-shared-categories`, `setup-alert-polish`, `assistant-alert`, `about-this-instance` and
      `login-failure-and-tag-collapse`: **218/218 pass.**
- [x] **Dark is identical.** `probe-home-dark.js`: HEAD against my build of `7690c8e16`. **0 differences in all 14
      states**, including the hovered card (sampled after its transition) and `/information-for-agents`. The new rules
      sit under the light scope selector, so Dark can't match them.

## Round-1 findings, re-checked

1. **Blocking 1, the picker's Settings link: resolved.** Signed in, with the point of view not ready, in Light:
   - the "being calculated" option has nothing under 4.5:1;
   - the link is the accent on white, and the option's text is `--bsp-muted`;
   - the signed-out option is clean too.

   Round 1 had the link at 2.29:1. The sweep's exemption now covers the option's text but not a link inside it.
2. **Blocking 2, `/information-for-agents`: resolved.**
   - The field reads `--bsp-surface` on `--bsp-border` (white with a `#d6d9db` edge); my screenshot shows a visible
     field. Typed text is the ink. The status line reads the soft token.
   - **Coverage:** `ADOPTED_FILES` puts the page under T2, I1 and I2, and C4 makes every light-hinted route's page
     file part of a test inventory. That closes the class of miss.
3. **Non-blocking 2 ("Not Personalized" hover): resolved.** It underlines on hover in Light.
4. **Non-blocking 3 (S1): resolved.** S1 finds the scope by its shape.
5. **Non-blocking 1 (the hovered card): half resolved.** The card's text now stays in the ink on hover. But **the
   Verification Score badge still reads 3.88:1 on a hovered card,** and the new test meant to guard the hover can't
   see it (Blocking 1 below).

## ADR 0004 Amendment 1, judged

**Sound.** Light-only rules under the light scope selector are a fair second mechanism where a wrapper can't express
the change: a Dark value that comes from another rule (`a:hover`), or an opacity that must stay literal in Dark.
- **Dark-safe by construction.** The selector starts with `:root[data-appearance="light"]`, both T1s ignore scoped
  rules, and my Dark check confirms it.
- **The exception to T4 is narrow and reasoned:** one selector, a notice holding a working link, with Dark's literal
  0.5 kept and pinned by M5.
- **One gap to note:** the token-layer checks (T2 bare colours, T3 opacities, K1 pairs) skip scoped rules, so a later
  Light-only rule could paint a bare colour unseen. Today's three use only tokens, and M5/M6 pin two of them
  (Non-blocking R2-2).

## Findings (round 2)

### Blocking

1. **On a hovered result card, the Verification Score badge reads 3.88:1 in Light, and H13 can't see it.**
   - **Measured** (after the hover transition):
     - the badge is `--bsp-cyan-ink` `#0e7490` on its 0.10 cyan tint;
     - in Light the card's hover rule (`ui/src/styles.css`, `.bs-result-card:hover`) swaps the card's white for the
       0.06 accent tint over the canvas;
     - the badge sits on that tint, so it composites to **3.88:1**.

     AC-2 asks for each badge readable at 4.5:1. The badge is inside the card link, and David put the hover fixes in
     this round's scope.
   - **Why H13 passes:** `.bs-result-card` animates its background (`transition: border-color 0.15s, background
     0.15s`, `styles.css:3606`), and H13 (`tests/brainstorm/appearance-setting-home.spec.js:502-508`) sweeps straight
     after `hover()`, while the card still reads white.
   - **Proof:** a replica of H13, built from the spec's own mocks and sweep, finds nothing when run immediately. Run
     400 ms later, it finds exactly `span.bs-wot-badge.bs-wot-rank "🏅 Verification Score: 98": 3.88:1 (needs 4.5)`.
   - **Asked change:**
     - **Tester amendment:** H13 waits for the hover state to settle before it sweeps, for example by polling until
       the card's computed background is the hover tint.
     - **Implementer:** bring the badge to 4.5:1 on a hovered card in Light, without changing Dark. For example, a
       Light-only `.bs-result-card:hover .bs-wot-rank` rule, or a hover tint that leaves the badges' backdrop white;
       the approach is the Implementer's call, with a line in ADR 0004's amendment. Verified Followers stays above
       7:1 on the same hover, so only the cyan badge needs it.

### Non-blocking
1. **The agents page's field edge** (`#d6d9db` on the canvas) is about 1.3:1, which is under WCAG 1.4.11's 3:1 for a
   component's boundary. The field's white fill helps it stand out, and the light site's own fields use the same
   border (the design shell and story 3), so this is a site-wide design choice, not this story's defect. Worth a book
   follow-up if David wants 1.4.11 across the light look.
2. **Light-only scoped rules aren't covered by T2, T3 or K1** (see the ADR judgement above). A small test that every
   rule under the light scope's selector reads only `--bsp-` tokens would cover future ones.

### Harness friction
1. **Hover and transition timing.** A sweep taken straight after `hover()` measures the pre-transition state. Worth a
   line in the test-plan template: after a pointer action, wait for the computed style to settle (or for the
   transition's duration) before measuring.

## Verdict
**CHANGES_REQUESTED**
