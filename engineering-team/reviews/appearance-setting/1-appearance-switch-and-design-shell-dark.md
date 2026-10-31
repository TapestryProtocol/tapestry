# Review: Story 1 — The Appearance switch, and a dark look for the design-shell pages

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-31
**Diff:** `git diff 6d3bb6595..HEAD` (HEAD `668072907`; commits b4a44c846 story, bd28893b0 ADR, 2622444e1 failing tests,
280733c9d test re-aim, 668072907 impl)
**Story:** `engineering-team/stories/appearance-setting/1-appearance-switch-and-design-shell-dark.md`
**ADR:** `engineering-team/decisions/appearance-setting/0001-appearance-attribute-preload-and-design-shell-tokens.md`
**Test plan:** `engineering-team/stories/appearance-setting/1-appearance-switch-and-design-shell-dark.test-plan.md`
(with its Amendment)

## Quality gates (run by reviewer, not trusted)

- [ ] `npm test`: **not run in full.** On this Mac Studio the full gate leaks fixtures into a private agent-memory
      instance (`:7778` / container `tapestry`), so the main session forbade it. `node test/gate-status.js --list`
      prints "No gate run records in …/appearance-setting/tmp/gate-runs", so **there is no `gate:status` line to quote
      for this branch.** Someone has to run the full gate on a machine where that is safe (CI or a scratch stack)
      before merge. Run instead, one suite at a time through `run()`, with `BRAINSTORM_BASE_URL=http://127.0.0.1:9`.
      Each was grep-checked for live-stack calls first, and none had any:
  - `appearance-setting`: 15/15 pass. `treasure-map-needs-attention`: 6/6 pass.
  - Regression check on the suites that reference the menu, the sign-in button or the design shell:
    `admin-tools-dashboard-panel` 9/0, `assistant-alert` 15/0, `dictionary-entry` 26/0, `dictionary-managed-by` 15/0,
    `live-feed-feed-page` 27/0, `login-failure-and-tag-collapse` 18/0, `manage-treasure-map-page` 22/0 (2 skipped),
    `my-assistant-page` 31/0, `note-surfaces-ui` 19/0, `pov-state-unification` 5/0, `setup-alert` 6/0,
    `setup-status` 38/0 (2 skipped).
- [x] Playwright, chromium, against a **fresh build of HEAD** (rebuilt into the `:4174` preview directory, because
      the served build was eight minutes older than the impl commit). `/api` is mocked, and the preview proxies it to
      a dead port.
  - `tests/brainstorm/appearance-setting.spec.js`: **32/32 pass.**
  - Existing specs that touch the design shell or the avatar menu (`assistant-alert`, `dictionary-concepts`,
    `manage-treasure-map-cards`, `manage-treasure-map`, `my-assistant-page`, `my-assistants`, `setup-alert`,
    `setup-status`): **180 pass, 1 FAIL.** The failure is `setup-status.spec.js:340` B7: "at 375 px wide, /setup reads
    without horizontal scrolling (signed out)". It reports "the page is 385px wide in a 375px viewport". This is a
    regression caused by this diff (Blocking 2).
  - Not run: `tests/brainstorm/treasure-map-save.spec.js`. It matches the safety grep (`strfry/publish`, mocked
    there via `page.route`, but skipped under the session's rule).
- [x] _Lint not configured, skipped._
- [x] _Typecheck not configured, skipped._
- [x] _Build not configured._ (`vite build` of HEAD succeeds. In the built `index.html`, the inline pre-render
      script comes before the module script and the stylesheet link.)

## Spec adherence
- [ ] Every acceptance criterion has a passing test. **No.** The tests pass, but AC-2 and AC-5 hold gaps the tests
      don't reach (Blocking 1, 3–5), and AC-6 is broken at phone width (Blocking 2).
- [ ] No criterion is silently dropped. **No.** AC-2's avatar menu and signed-out placement are missing on the search
      home (Blocking 1).
- [x] No behavior added that isn't in the story.

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 first visit follows the computer | Met | E1, E2, C1–C3; live listener only under System (`AppearanceContext.jsx:45-53`) |
| AC-2 where it's offered | **Not met** | Avatar menu (BrainstormUserMenu), `/settings` in and out, and beside Sign in on BrainstormUserMenu top bars, all present (E3). **Absent on the search home `/`**, both signed in and signed out (Blocking 1) |
| AC-3 applies at once, sticks, nothing sent | Met | E4, E5, C4, C5; no `/api` write path in the diff |
| AC-4 no flash | Met | E6 against the build; P1–P4; built HTML order checked |
| AC-5 dark look, AA, nothing light-on-light | **Not met** | E7 and K1 pass, but the toast, the union and local avatars, the Dictionary's primary buttons, its firmware/shared pills and its entry mark are unreadable in Dark (Blocking 3–5) |
| AC-6 everything else unchanged | **Not met at phone width** | Colours unchanged (T4, E9). The signed-out top bar overflows at 375 px on the profile family (Blocking 2) |
| AC-7 storage refused | Met for this story's code | E10 (signed out), P3, C4, C5. Signed-in pages already error via `PovContext.jsx:40`. That is pre-existing, unchanged by this diff, and not blocking (Non-blocking 6) |

## ADR adherence
- [x] Files changed match the ADR's implementation notes: lib, alias, inline script, provider (outermost), control
      with three variants, placements in `BrainstormUserMenu` and `BrainstormSettings`.
- [x] Layering / module boundaries respected. The pure CJS lib comes in through the `@tapestry/appearance` alias,
      registered in `commonjsOptions.include`.
- [x] No new dependencies.

**Deviations from ADR 0001, each flagged:**
1. **Sub-decision 5 and Palette step 1 were not completed.** Literal colours remain in the design-shell section
   (`styles.css:10048` `--dict-cyan: #0e7490`, `:10148`, `:10151`, `:10156`, `:10168-10169`, `:10213`, `:10215`,
   `:10240-10241`, `:10263`, `:10268`). The `.dict-*` rules at `:9211-9595`, which the ADR also names, are largely
   unconverted. Several of these break Dark (Blocking 4, 5). T2 didn't catch them because it only scans selectors
   that name `.bsd-` (Blocking 6).
2. **Palette step 1, "reuse the existing tokens where the value matches."** Duplicate tokens were added instead:
   `--bsd-ink-2-lit`, `--bsd-muted-lit`, `--bsd-line-lit` and `--bsd-hairline-lit` carry the same light *and* dark
   values as `--bsd-ink-2`, `--text-muted`, `--bsd-line` and `--bsd-hairline`. Likewise `--bsd-accent-tint-10` and
   `-10b`, and `--bsd-brand-cyan` and `-cyan-ink`. Not blocking (Non-blocking 3).
3. **Dark table, `--bsd-navy`.** The ADR gives `#c4b5fd` "(as text)". The implementation keeps `--bsd-navy` as a
   background (`#4c2a85`, behind white initials) and adds `--bsd-navy-ink: #c4b5fd` for text (`styles.css:9786-9788`,
   with a comment). This is justified, because navy is used both ways. Accepted.
4. **"White text on a solid accent … stays white."** In Dark, `--bsd-on-accent` becomes `#14102a` (6.79:1 on
   `#a78bfa`), because the dark accent is light lavender. That's the right call, but it was applied only where a rule
   reads `--bsd-on-accent`. Rules that put `--bsd-on-solid` or a literal `#fff` on `var(--accent)` still paint white
   on lavender (Blocking 3).
5. **Sub-decision 8 assumed `BrainstormUserMenu` is the avatar menu everywhere** ("so it appears wherever that button
   does"), and the ADR's Consequences expect the control on the search home. The search home renders its own
   `UserMenu` (`BrainstormSearch.jsx:102`, `:499`, `:1115`, `:1460`), which got no control (Blocking 1).

## Concept-graph integrity
- [x] No concepts are touched, and there are no handles.
- [x] No firmware change, so no reinstall is needed.
- [x] Not applicable: no domain code.

## Things tests can't catch
- [x] No secrets in committed files.
- [x] No leftover debug logging or `console.log`.
- [x] No commented-out code.
- [ ] Error paths and edge cases handled where it matters. Phone width isn't handled (Blocking 2).
- [x] Concurrency / race conditions. StrictMode's double effects are idempotent (`removeAttribute`, symmetric
      listener add/remove). Under System the listener is attached only while it applies. I switched Light → OS dark →
      System on the build and saw no wrong-look flash.
- [x] Security. A constant storage key, values whitelisted on read, no injection surface, no CSP to conflict with
      the inline script.

## House rules check
- [x] Concept Graph API authority respected. Not applicable.
- [x] No new lint/typecheck/build tooling.
- [x] No TA pubkey literal introduced. No `LEGACY_*` constant touched.

## Findings

### Blocking

1. **ui/src/pages/BrainstormSearch.jsx:499 and :102-…, the search home's own `UserMenu`:** the Appearance control is
   missing on `/`. On the build, `/` signed out shows "Sign in with nostr" with **no** Appearance radiogroup beside
   it. Signed in, the open avatar dropdown holds **no** Appearance radiogroup (probe: `radiogroups: 0` in both
   states). AC-2 asks for the control in "the avatar menu" and beside Sign in "in the top bar of the Brainstorm-styled
   pages". ADR 0001's Consequences say the control appears on "the search home until story 3", and the epic makes
   story 3 palette-only. The test plan never checks `/`. Asked change: add `AppearanceControl variant="compact"`
   beside the search home's signed-out button, and a `variant="menu"` section in its dropdown before its footer.
   Extend E3 to `/`. Alternatively, if David rules the search home out of story 1, amend the story and ADR to say so
   explicitly. As written, the gap is undeclared.

2. **ui/src/components/BrainstormUserMenu.jsx:90-96 (with `styles.css:2909` `.bs-signin-group`): the signed-out top
   bar breaks at phone width.** The compact control takes the room "Sign in with nostr" needs. Measured on the build,
   signed out:

   | Page | Sign in height at 375 px, control shown | Same, control hidden |
   |---|---|---|
   | `/setup` | 75 px, page 385 px wide | 30 px, 375 px wide |
   | `/assistant` | 75 px, page 385 px wide | 30 px, 375 px wide |
   | `/assistants`, `/dictionary`, `/treasure-map`, `/treasure-map/advanced` | 70 px | 38 px |

   At 414 px the button still wraps (60 px and 53 px). The button folds into a four-line pill on the design shell,
   and the profile family scrolls sideways. This **fails the existing `tests/brainstorm/setup-status.spec.js:340`
   (B7)** and breaks AC-6. Asked change: make the signed-out group fit at 375 px on every top bar (for example a
   narrower compact control, `white-space: nowrap` on the button with the control collapsing first, or the control
   moving below the bar at small widths). Add a phone-width assertion to the appearance spec for the signed-out top
   bar on both families. B7 must pass again.

3. **White or near-white text on light surfaces in Dark** (AC-5: "no element is left light-on-light"). Each of these
   was confirmed with computed styles on the build:
   - `styles.css:10801` `.bsd-tm-toast`: `background: var(--text)` becomes `#eef0f4` in Dark, with
     `color: var(--bsd-on-solid)` `#ffffff`. That's **1.14:1**. The Treasure Map's "saved" toast becomes unreadable.
   - `styles.css:10035` `.bsd-managed-avatar.is-union`: `--bsd-ink-strong` `#eef0f4` on `--bsd-brand-cyan` `#13d2e5`
     gives **1.62:1** (it was 10.45:1 in Light). This is the Dictionary's "Managed by" menu
     (`pages/dictionary/ManagedBy.jsx:86`).
   - White initials on the dark accent `#a78bfa`, **2.72:1** (5.67:1 in Light):
     - `styles.css:10032` + `:10034` `.bsd-managed-avatar.is-local`;
     - `:10318` + `:10320` `.bsd-ma-row.is-local .bsd-ma-avatar`;
     - `:10628` + `:10630` `.bsd-tm-cat-avatar.is-local`.
   - White labels on `#a78bfa`, **2.72:1**, on the Dictionary's primary buttons (Add, Create, Save changes, Re-Sync,
     Done):
     - `styles.css:10080` `.dict-skin-light .dict-add-btn` (`--bsd-on-solid`) over `:9357-9359`;
     - `:9333-9335` `.dict-pill-btn` (literal `#fff`).

   Asked change: give these a dark-correct ink. Either `--bsd-on-accent` where the surface is the accent, or a token
   whose dark value contrasts. Give the toast an inverted pair that works in both looks. Then pin it (see 6).

4. **styles.css:10048 `.dict-skin-light.dict-page { --dict-cyan: #0e7490; }`**: a light-only value with no dark
   counterpart. In Dark it paints `.dict-pill--firmware` and `.dict-pill--shared` (`:9398-9399`) at **2.46:1** on
   their tint, and `.dict-marker--shared` (`:9403`) at **3.25:1**. That's below AA for text. These render on the
   Dictionary list and entry pages (`pages/dictionaries/Concepts.jsx:437,439,515`, `ConceptEntry.jsx:299,301`).
   Asked change: tokenise `--dict-cyan` inside the shell with a dark value (the old dark `#56d4dd` reads well), as
   the ADR's Palette step 1 requires.

5. **Literals left in the design-shell section that break Dark** (ADR sub-decision 5):
   - `styles.css:10215` `.dict-entry-mark { color: #1f2328; }`: the GitHub/V4V mark beside an entry title
     (`ConceptEntry.jsx:310-311`) is **1.2:1** on the dark canvas, which makes it invisible.
   - `:10148` `.dict-gh-badge` `box-shadow: 0 0 0 3px #ffffff` and `:10151` `.dict-gh-avatar`
     `box-shadow: 0 0 0 4px #ffffff, …`: bright white rings on a dark page (GitHub account item page).

   Asked change: tokenise these. For the colours that are intentionally brand or data and read on both backgrounds
   (`.dict-gh-btn` `#1f2328`, the v4v play overlay, the language swatches), keep them with a comment, and list them
   in an explicit allowlist in T2 (see 6).

6. **The tests let Blocking 3–5 through.** This is a test gap against AC-5.
   - **T2** (`test/appearance-setting.test.js`, `mentionsShell`) scans only selectors that contain `.bsd-`. The
     `.dict-skin-light …` and `.dict-*` rules rendered inside the shell, which hold every remaining literal, are
     never checked.
   - **K1** measures ink tokens on surface tokens only. It never checks the on-solid/on-accent pairs or the inverted
     toast.
   - **E7**'s mocks render no toast, no local or union avatar, no Managed-by menu, no Dictionary entry/item/new/edit
     page, and no firmware pill.

   Asked change:
   - Widen T2 to every rule in the design-shell section (`body:has(.bsd-page)` to the end) plus the `.dict-skin-light`
     rules, with a named allowlist for brand/data colours.
   - Add K-pairs for `--bsd-on-solid` and `--bsd-on-accent` on `--accent`/`--bsd-navy`, the toast's pair, and the
     union avatar's pair, in both looks.
   - Extend E7, or add a sweep, to a Dictionary entry page and to a My Assistants / Treasure Map fixture with a local
     Assistant row.

   Each new check must fail on the current HEAD.

### Non-blocking

1. **ui/src/components/AppearanceControl.jsx:23-40**: the radiogroup doesn't follow the APG radio pattern. All three
   radios are separate tab stops (no roving `tabindex`), and the arrow keys do nothing (checked on the build:
   ArrowRight leaves focus and selection unchanged). The control is still keyboard-operable (Tab plus Enter/Space),
   so this doesn't block. Optional: roving `tabindex` (0 on the checked radio, -1 on the rest) and Arrow keys that
   move and select.
2. **tests/brainstorm/appearance-setting.spec.js:242-283 (E4 re-aim)**: the amendment says the re-aim "doesn't
   loosen" the guard, but it narrows slightly. The Cypher-read classification alone would have excused the load-time
   POST. Recording only from the click on means a write fired on mount (such as a future "sync the stored choice"
   effect) goes unchecked. `writes` keeps recording through the later `page.reload()`, but it's asserted only once,
   before the reload. Optional: assert `writes` is still `[]` at the end of the test, which covers the
   remount-after-reload path at no cost.
3. **ui/src/styles.css:9673-9765**: redundant tokens (`-lit` twins, `-10b`, `brand-cyan-ink`) against ADR Palette
   step 1's "reuse the existing tokens where the value matches". Each duplicate is a second place to keep in step.
   Optional: fold them into the existing tokens.
4. **test/appearance-setting.test.js P2**: the path list is hand-picked. If a prefix is added to
   `DESIGN_SHELL_PATH_PREFIXES` but not to `ui/index.html` (or the other way round), P2 passes, because no listed path
   falls under the new prefix. Optional: build P2's paths from `L.DESIGN_SHELL_PATH_PREFIXES` (each prefix, prefix +
   `/x`, prefix + `x`), and assert the inline script's array equals the lib's.
5. **ui/src/context/AppearanceContext.jsx:60**: `setChoiceState(next)` stores the raw argument. Storage and
   resolution normalize it, but `choice` (and so `aria-checked`) doesn't. Optional: `setChoiceState(normalizeChoice(next))`.
6. **ui/src/context/PovContext.jsx:40 (pre-existing, outside this diff)**: `localStorage.getItem` is unguarded, so
   with storage blocked a *signed-in* page throws. The appearance code itself never throws (P3, C4, C5, E10). This
   diff didn't cause the gap and doesn't widen it. **Accepted for AC-7.** It needs the OPEN.md row the test plan
   promised.

### Harness friction
1. The test plan's Amendment says Playwright passed 32/32 "against the implemented build". The `:4174` build was
   produced at 17:13, but the impl commit is 17:21. I couldn't tell whether that build matched HEAD, so I rebuilt
   (the result is the same). Recording which commit a preview build came from (for example `git rev-parse HEAD` in
   the build directory) would save the next Reviewer the rebuild.
2. Neither the Implementer nor the Tester ran the existing B-class specs whose surfaces this diff changes
   (`setup-status.spec.js` among them), so B7's regression reached Review. Test Design or Implementation should run
   every existing spec that touches a changed shared component (here `BrainstormUserMenu`).

## Verdict
**CHANGES_REQUESTED**

The story's Status stays as it is. (The template's "On PASS" section is dropped here: it follows the verdict, and the
last-token verdict rule would read its heading as PASS.)

---

# Round 2 (2026-10-31)

**Diff:** `git diff 51b60ecea..HEAD` (HEAD `c84c3dd2b`). The commits are a6b9d38bb (tests widened, test plan
Amendment 2), d5695b345 (ADR 0001 Amendment 1), 55835d1cf (test re-aims, Amendment 3) and c84c3dd2b (the fix).
**Owner decision applied:** for Blocking 2, David chose "one button opens the three" on phones (ADR 0001 Amendment 1
item 2). Blocking 2 is judged against that design.

## Quality gates, round 2 (run by the Reviewer)

- **Full `npm test`:** still not run (forbidden on this machine), and there is still no `gate:status` record for this
  branch. The full gate has to run on CI or a scratch stack before merge.
- **Node suites,** each screened first, run one at a time with `BRAINSTORM_BASE_URL=http://127.0.0.1:9`:
  - `appearance-setting` 16/16;
  - `treasure-map-needs-attention` 6/6;
  - the 12 related suites from round 1 plus `search-results-url`, all passing, 0 failures.
  - `dictionary-concepts.test.js` was not run, because it matches the safety screen.
- **The widened tests fail at the round-1 code.** I ran HEAD's `test/appearance-setting.test.js` against `668072907`'s
  `src/lib/appearance.js`, `ui/index.html` and `ui/src/styles.css` in a scratch copy:
  - T2 found 33 literals and T3 found `--dict-cyan` with no dark value.
  - K1 reported the same missing `--dict-cyan` value.
  - K2 found 16 pairs, including the toast at 1.14:1, the union avatar at 1.62:1, every white-on-`#a78bfa` pair, and
    `--bsd-faint` on the muted surface at 4.32:1.
  - T1 and T4 couldn't run there, because the scratch copy has no git history.
  - E3, E7 and E11 were not re-run against the old build.
- **Playwright,** chromium, against a fresh build of `c84c3dd2b` rebuilt into the `:4174` directory:
  `appearance-setting.spec.js` plus assistant-alert, dictionary-concepts, manage-treasure-map,
  manage-treasure-map-cards, my-assistant-page, my-assistants, setup-alert, setup-status, search-results-url and
  ta-badged-avatar. **228 passed, 0 failed**, including `setup-status` B7.
- **My own browser checks on that build:**
  - **Dark pairs** (computed styles, the real classes inside `.bsd-page`):
    - the toast is `#0e1016` on `#eef0f4`;
    - the union avatar is `#0a0e18` on `#13d2e5`;
    - the local avatars and the Dictionary buttons are `#14102a` on `#a78bfa`;
    - the firmware/shared pills and marker are `#56d4dd`, and the entry mark is `#e6edf3`;
    - the GitHub badge and avatar rings are now `#171a22`.
  - **Search home:** signed in, the dropdown holds one Appearance radiogroup. Signed out, the group sits beside Sign in.
  - **Phone widths,** signed out on 12 pages, at 375, 414, 521 and 768 px:
    - Sign in stays on one line (30–38 px tall) and nothing scrolls sideways;
    - the single button shows at 520 px and below, and the three icons show above.
  - **Keyboard:** each group has one tab stop and the arrow keys move the choice. Escape closes the popover and returns
    focus to the button, and a click outside closes it.
  - **Dangling tokens:** none are left behind by the folded ones (every `var(--x)` without a fallback resolves; only
    `--hover` and `--card-bg` are undefined, and they were already undefined at BASE).
  - **Tokens and the admin pages:** no `--bsd-*` token is declared outside the shell, so the admin Dictionary's
    `var(--bsd-x, literal)` uses still resolve to today's literal.

## Round 1 findings, rechecked

| Round 1 | Status | Evidence |
|---|---|---|
| B1 search home | **Fixed** | `BrainstormSearch.jsx:499-506` and `:591-594`; E3 covers `/` signed in and out; probe |
| B2 phone width | **Fixed for the bar; new defect in the popover** (Blocking R2-1) | B7 passes; E11 passes; probe at 375 and 414 px |
| B3 light-on-light pairs | **Fixed** | computed styles above; K2 |
| B4 `--dict-cyan` | **Fixed** | `styles.css:10116`; K1 |
| B5 literals in the shell | **Fixed** | T2 (empty allowlist); rings and entry mark tokenised |
| B6 tests | **Fixed** | T2, T3, K1 and K2 fail at `668072907` (above); E7 sweeps an entry page and a local-Assistant row |
| N1 keyboard | Fixed | `AppearanceControl.jsx:22-60`; probe |
| N2 E4 end assertion | Fixed | `appearance-setting.spec.js:293` |
| N3 redundant tokens | Fixed | `-lit` twins, `--bsd-canvas`, `--bsd-ink-strong` and `brand-cyan-ink` removed; no dangling references |
| N4 P2 path list | Fixed | P2 derives its paths from `DESIGN_SHELL_PATH_PREFIXES` and pins the script's list to the library's |
| N5 normalize | Fixed | `AppearanceContext.jsx:56-61` |
| N6 `PovContext.jsx:40` | Open, accepted | Still needs its OPEN.md row (the main session's job) |

ADR 0001 Amendment 1 matches the code: the search home's placements, the phone button, the signed-out padding and gap
rules at 520 px and below, every painted pair, folded tokens and the keyboard. T1 now reads `#rgb` as `#rrggbb`. That
is sound, since both spell the same colour, and it loosens nothing. K2's one allowlist entry, an empty `aria-hidden`
status dot, is justified.

## Findings, round 2

### Blocking

1. **ui/src/styles.css:2965-2975 `.bs-appearance-popover` (`right: 0` of `.bs-appearance-compact-wrap`, `:2946`):
   the phone popover runs off the left edge of the screen.** This is the owner's design, at the exact widths it was
   built for. The popover is about 236 px wide and right-aligned to the Appearance button, and the button sits about
   150 px in from the right edge (Sign in is to its right). Measured on the build, signed out with the popover open:

   | Width | Page | Popover left edge | "System" option |
   |---|---|---|---|
   | 375 px | `/assistants` (all four design-shell pages share the bar) | −27 px | −16..64 px |
   | 375 px | `/about`, `/settings` | −10 px | −1..79 px |
   | 320 px | `/assistants` | −74 px | −63..17 px |
   | 320 px | `/about`, `/settings` | −65 px | −56..24 px |

   At 375 px the System icon and the pill's left edge are cut off (screenshot:
   `/private/tmp/claude-501/-Users-wds4--claude-spares-spare-c1Y81L/f0e41f03-d228-4d5c-a00e-172c913a7315/scratchpad/probe/r2-popover-assistants-375.png`).
   At 320 px most of the System option is off-screen. Nothing scrolls, because overflow to the left can't be scrolled
   to, so E11's scroll check passes. Playwright's `toBeVisible` is also satisfied by a partly off-screen element.
   Asked change:
   - keep the popover inside the viewport, for example by anchoring it to the whole `.bs-signin-group` (right edge
     under Sign in), stacking the three vertically, or clamping its left edge;
   - extend E11 to assert that the open popover's bounding box lies within `[0, viewport width]`, at 375 and 414 px,
     on `/about` and `/assistants`.

### Non-blocking

1. **tests/brainstorm/appearance-setting.spec.js:565**: the comment says choosing "closes it", but the popover stays
   open after a choice (`AppearanceControl.jsx:54` only calls `setChoice`), and the test doesn't assert closing.
   ADR Amendment 1 only promises closing on an outside click or Escape. Optional: either close the popover on choice
   (and assert it), or fix the comment.
2. **At 320 px** (below every width the story and tests use), signed out, `/`, `/setup`, `/assistant` and
   `/user/<pubkey>` are 368 px wide. With the Appearance button hidden they are 332 px, so today's bar already overflows
   at 320 px, and the button adds 36 px. Optional: fold this in if the popover fix touches the bar.
3. **ui/src/components/AppearanceControl.jsx:70-77**: the popover stays open when focus leaves it with Tab. Optional:
   close it on focus-out as well.

### Harness friction
1. None new. The round-1 meta items (recording the commit of a preview build, and running the existing specs of a
   changed shared component) still stand. Round 2 did run the related specs, and B7 passes.

## Verdict, round 2
**CHANGES_REQUESTED**

---

# Round 3 (2026-10-31)

**Diff:** `git diff d9951b4de..HEAD` (HEAD `86e20ab94`). The commits are 982e2485e (E11 extended, test plan
Amendment 4) and 86e20ab94 (the fix):
- the popover stacks its three options vertically;
- choosing an option closes the popover and returns focus to its button;
- the arrow keys only move the choice;
- a `focusout` handler (`onBlur` on the wrapper) closes the popover when focus leaves it.

## Quality gates, round 3 (run by the Reviewer)

- **Full `npm test`:** not run (forbidden on this machine); there is no `gate:status` record for this branch. The full
  gate still has to run on CI or a scratch stack before merge.
- **Node:** `appearance-setting` 16/16.
- **Playwright,** chromium, against a fresh build of `86e20ab94` rebuilt into `:4174`: `appearance-setting.spec.js`
  plus the same 10 related specs as round 2. **228 passed, 0 failed.**
- **My own probe** on that build (`probe7.js` in the session scratchpad), signed out:
  - **Round-2 blocker fixed.** At 320, 360, 375, 414 and 520 px, the open popover and each of its three options lie
    within the viewport, on `/`, `/about`, `/settings`, `/setup`, `/assistants`, `/dictionary` and `/user/<pubkey>`.
    The narrowest case is 320 px on the design shell: popover 57..164, options 68..153.
  - **Chromium mouse, keyboard and touch all work:**
    - Mouse: choosing Dark applies it, closes the popover and returns focus to "Appearance: Dark".
    - Keyboard:
      - Enter opens the popover with focus on the checked option;
      - ArrowUp moves the choice and keeps the popover open;
      - Space chooses and closes it;
      - Tab out closes it.
    - Touch (`hasTouch`/`isMobile`): a tap on Dark applies it and closes the popover.
  - **Round-2 non-blocking 1 and 3** (close on choice; close on Tab-out) are fixed and covered by E11.

## Findings, round 3

### Blocking

1. **ui/src/components/AppearanceControl.jsx:91-93: in WebKit the `onBlur` close is likely to swallow the choice.**
   - **Why it is likely to break.** On macOS Safari a mouse press on a `<button>` doesn't focus the button. Instead
     the focused element blurs, with `relatedTarget === null`. When the popover opens, focus sits on the checked
     option (`autoFocus`). Pressing another option therefore blurs it with `relatedTarget` null. `onBlur` sees
     "outside the wrapper" and calls `setOpen(false)` on **mousedown**, so React unmounts the popover before the
     `click`. The choice is never applied, and the popover just closes.
   - **What the simulation showed.** I reproduced the sequence in chromium by blurring the active element on mousedown
     of a button, as WebKit does. On both `/about` and `/assistants` at 375 px, pressing "Dark" left `data-appearance`
     as `light`, and the popover was gone.
   - **What I couldn't do.** WebKit isn't installed on this machine, so I couldn't run the real thing.
     `playwright.config.js:63-75` defines `webkit` (Desktop Safari) and `Mobile Safari` (iPhone 12) projects, and the
     popover exists only at 520 px and below, which is phones. I can't verify that a choice works there, so per the
     role rule this blocks.
   - **The same mechanism in every browser.** A click on the popover's own padding (not an option) closes it in
     chromium too.
   - **Asked change (either is enough):**
     - (a) Make the close robust:
       - ignore a blur whose `relatedTarget` is `null`, leaving outside presses to the existing `mousedown` handler
         at `:74`;
       - or defer the check a tick and test `wrapRef.current.contains(document.activeElement)`;
       - or `preventDefault` on the options' `mousedown`.
     - (b) Show it works by running E11 under the `webkit` and `Mobile Safari` projects on a machine that has those
       browsers.

     With (a), please also run E11 under WebKit if a machine has it.

### Non-blocking

1. **Round-2 non-blocking 2, the 320 px bar.** Signed out at 320 px, `/`, `/setup`, `/assistant` and `/user/<pubkey>`
   are 368 px wide. Today's bar is already 332 px, and the Appearance button adds 36 px. **I don't hold the verdict on
   it; record it as a follow-up ledger row.** No AC or test names a width below 375 px, and this story didn't create
   the overflow. The follow-up should make the profile-family bar fit at 320 px with or without the button.
2. **Correction to my round-1 and round-2 reports.** The `PovContext.jsx:40` ledger row already exists:
   `ledger/2026-10-31-pov-context-unguarded-storage.md` (Status OPEN), committed in `51b60ecea`. Nothing is owed there.

### Harness friction
1. Playwright's WebKit and Mobile Safari projects are configured but their browsers aren't installed on the Mac Studio
   (`~/Library/Caches/ms-playwright` holds only chromium), so phone-only behaviour can't be checked in the browser that
   most phones use. This is worth an OPEN `meta` row: either install them, or name where WebKit runs happen (CI).

## Verdict, round 3
**CHANGES_REQUESTED**
