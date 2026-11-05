# Review: Story 1 — The Create your account page

**Reviewer:** Claude (acting as Reviewer, a subagent separate from the author)
**Date:** 2026-11-04
**Diff:** `git diff c7a10a63f..e9f33314a` on `feat/setup-create-account` (cut from `origin/staging` `3eed1b8e`): `c7291cfbb` (tests, re-aims, ADR Amendment 1, ledger row) and `e9f33314a` (implementation)
**Story:** `engineering-team/stories/setup-create-account/1-create-account-page.md`
**ADR:** `engineering-team/decisions/setup-create-account/0001-a-page-from-sign-in-and-one-assistant-per-person.md`, with Amendment 1
**Test plan:** `engineering-team/stories/setup-create-account/1-create-account-page.test-plan.md`
**Book:** `engineering-team/audits/setup-create-account/book.md` (no PRD; acceptance frame)

The story, ADR, tests and code all came from one session. So I treated every coverage table, "verified" line and
Deviation as a claim, and re-derived each one from the code or from a command I ran.

## Quality gates (run by reviewer, not trusted)

- [ ] Full `npm test` / `npm run gate:status`: **not run**, on purpose. On the Mac Studio the full suite's live legs publish
  signed fixtures that the local relay router uploads to public relays, and the `tapestry` container here is a private
  agent-memory instance, not a dev stack. The owner's standing rule and this review's brief both forbid it. There is no
  gate:status line to quote. The full gate runs in CI on the PR.
- [x] Node suites, one at a time through `require('./test/<name>.test.js').run()` with `BRAINSTORM_BASE_URL` on a dead
  port (`127.0.0.1:9`). I screened each one first for `docker exec`, `dockerCurl`, `TAPESTRY_PORT`/`_CONTAINER`,
  `strfry/publish` and `nak`. Every suite ran, and all were clean:
  - `setup-create-account`: **19 passed, 0 failed.**
  - `appearance-setting-working`: **14 passed, 0 failed.** T1, T2, T3, K1, I1 and I4 included.
  - `setup-status`: **38 passed, 0 failed, 2 skipped.** R1 and R2 passed by name. H1 and H2 skipped on the dead port,
    as designed.
  - `stack-free-npm-test`: **6 passed, 0 failed, 1 skipped.** G5 (the new suite is registered) passed. G2 skipped
    because the control panel was unreachable.
  - The other fourteen:

    | Suite | Passed | Failed | Skipped |
    |---|---|---|---|
    | `appearance-setting` | 16 | 0 | 0 |
    | `appearance-setting-light` | 11 | 0 | 0 |
    | `appearance-setting-home` | 19 | 0 | 0 |
    | `my-assistant-page` | 31 | 0 | 0 |
    | `setup-alert` | 6 | 0 | 0 |
    | `setup-alert-polish` | 17 | 0 | 0 |
    | `assistant-setup-state` | 26 | 0 | 2 |
    | `assistant-profile-check` | 33 | 0 | — |
    | `one-default-assistant-profile` | 55 | 0 | 0 |
    | `one-writer-assistant-profile` | 17 | 0 | 0 |
    | `recognizable-published-ta-profile` | 8 | 0 | 5 |
    | `stamped-composite-avatar` | 13 | 0 | 2 |
    | `assistant-taggings-publish` | 19 | 0 | 1 |
    | `assistant-publish-relays` | 39 | 0 | 0 |

  - Hazard matches, read before deciding:
    - `one-writer-assistant-profile` uses a fake req/res with `cp.exec` stubbed. Ran.
    - `setup-alert-polish` uses `withFetch` mocks, an in-process relay on 127.0.0.1 and a dead relay. Ran.
  - **Left out:**
    - `show-the-four-on-the-goal-screens-that-already-exist`: real `docker exec tapestry curl`.
    - `dictionary-concepts`: its base is the local control panel's port.
    - `assistant-self-map-publish`: low relevance. It reads `src/api/assistant/index.js` only for self-Map names, and I
      checked that with a grep (0 hits) instead of running the whole suite.
- [x] **Mutation check of the lock**, done by me against the real `src/api/assistant/index.js`. I rewrote the module
  in memory as it loaded (a require hook plus a `readFileSync` view, so the source sentinels saw the mutant too). No
  file on disk changed: `git status` was clean before and after.
  - Caught:

    | Mutation | Caught by |
    |---|---|
    | no lock | U3, U4 |
    | one lock for every pubkey | U5 |
    | both `.catch(() => {})` calls removed (a failure poisons the queue) | U7 |
    | the handler stores a key around the lock | S1 |
    | the 409 body changed | S2 |

  - Survived, and equivalent: either `.catch` removed alone. The stored tail never rejects, so each catch is redundant
    while the other stays. That is not a test gap.
- [x] **Playwright**, through the scratchpad config (chromium only, no globalSetup) against the proxy-free preview of
  this branch's build. The build is newer than `e9f33314a` (built 23:02, commit 22:53), the tree is clean, and the
  bundle holds implementation-only strings ("the request did not reach the server").
  - `setup-create-account.spec.js`: **23 passed, 0 failed.**
  - `appearance-setting-working.spec.js`: **52 passed, 0 failed.** W8 (the class probe over the source) and W1
    `/setup/create-account` included.
  - `setup-status.spec.js`, `setup-alert.spec.js` and `setup-alert-polish.spec.js`: **91 passed, 0 failed.**
  - Not run: `my-assistant-page.spec.js`. The editor is unchanged, and this lane mocks the server, so the handler change
    can't show there.
- [x] `bash scripts/harness-lint.sh`: see § On PASS for the one expected L1 line.
- [x] `git diff --check c7a10a63f..e9f33314a`: clean.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped. The UI bundle was built for the browser lane._

## Spec adherence

- [x] **AC-1:** B1 and B2 pass. The sign-in button calls the shared `login()`, and B2 proves the fake signer ran
  `getPublicKey` and `signEvent:22242` with no reload.
- [x] **AC-2:** B4 ×4, B5 and B6 ×2 pass. The page checks `status === 'needs-setup'` only
  (`ui/src/pages/setup/CreateAccount.jsx:74`), so a failed or loading check never says "no profile".
- [x] **AC-3:** B7 ×2, B8 and B9 pass, and U1–U7 and S1 pass. The two-tab case is covered twice: on the server by the
  lock, and on the page by treating a 409 as success. That 409 path also covers a stale tab. The clause "which shows
  the new Assistant's profile form" is not asserted (see Non-blocking 1).
- [x] **AC-4:** B10 ×3 and B11 pass. With no owner known, the line ends at "…ask the owner of this instance." with no
  colon and no link, as ADR § Decision 2 says.
- [x] **AC-5:** B12 passes in all six states. On the server, the only write path the page reaches is the AC-3 POST. For
  what the done state's status read can do on the server, see Non-blocking 3.
- [x] **AC-6:** B13 (375 px, long names and the inline owner npub) and B14 Light and Dark (seven states) pass. The
  failed state isn't swept in the browser, as the Deviations say; K1 covers `.bs-error`'s Light pair.
- [x] **Copy:** C5 checks the twelve fixed strings word for word, and B9 and B10 check `{reason}` and `{owner}` as
  rendered. I compared `createAccountCopy.js` with story § Copy and found no drift. The reused strings come from
  `steps.js` (D5).
- [x] No behaviour beyond the story. `GuestNoAssistant` is exported for story 2, as the ADR plans.

## ADR adherence

- [x] **Decision 1:** `createAccountState.js` is the six-row table in the ADR's order. It names no role itself (D4) and
  takes "who may create" from `mayCreateAssistant`.
- [x] **Decisions 2 and 3:** each state renders what § 2 lists. The press follows § 3: `disabled` while working, a POST
  with no body, success on 200 + `success: true` or on 409, `await refreshUser()` and then a push to
  `MY_ASSISTANT_PATH`, and otherwise `error`, `HTTP <status>` or the network message in `role="alert"`.
- [x] **Decision 4:** `underProvisionLock` is the ADR's code verbatim. The handler keeps its 401/403 checks before the
  call, and its 409 body, log line and 200 body are unchanged. The `existing` and `keys` objects hold private keys,
  but only `pubkey` and `npub` reach the response. Storage reads go to disk on every call with no cache
  (`getCustomerRelayKeys` → `getRelayKeys`), so a key stored under the lock is visible to the next caller in the queue.
  The one-process premise holds: supervisord's `brainstorm` program runs `start-brainstorm.sh`, which execs one
  `node bin/control-panel.js`, and `control-panel.js` has no cluster or fork.
- [x] **Amendment 1:** no `styles.css` change. Inline styles are layout and typography only (margin, `overflowWrap`,
  monospace), and none sets a colour. The reused rules (`.bss-card`, `.bs-assistant-note`, `.bs-link-btn`,
  `.bs-error`, the `.bs-setup-*` shell and done row) all read `--bsp-*` tokens. I checked each in `styles.css`.
- [x] **Files:** they match the Implementation notes, with one equivalent variation (Non-blocking 5). No new
  dependencies.
- [x] **The two appearance re-aims are legitimate, not a weakened guard:**
  - **`WORKING_FILES` + `CreateAccount.jsx`** (`test/appearance-setting-working.test.js:46-49`) widens the guard. I
    computed the difference. It brings one class into the family, `bs-error`, so T2 and K1 now check `.bs-error`.
    And I1/I4 now walk four more files: the page, `createAccountCopy.js`, `createAccountState.js` and
    `useAssistantSetupState.js`. Nothing is removed.
  - **W3's `REPLACED_SINCE_BASELINE`** (`tests/brainstorm/appearance-setting-working.spec.js:216-223`) is necessary and
    narrow. The three excluded baseline entries recorded the placeholder's tree, including
    `main>div>p>strong` ("Placeholder page."). The new page doesn't render that, so W3 would fail on "gone" elements
    there whatever the colours. Only that one URL is excluded: steps 2 and 3 stay under W3, and W1, W5 and W8 still
    sweep the page in Light. The new page's Dark is checked by B14 Dark (dark canvas, AA contrast), which is looser
    than "unchanged". But there is no earlier Dark of this page for "unchanged" to compare with.

## Concept-graph integrity

- [x] No concept handles in the diff. The ADR names two for orientation only.
- [x] No concept definitions changed. No firmware reinstall needed (ADR § Consequences says so).
- [x] Orienting via `/summaries` doesn't apply: the code reads no concept. No TA pubkey literal appears. The page takes
  the Assistant from `user.assistantPubkey`, and the tests use fixture keys.

## Things tests can't catch

- [x] No secrets. The only keys are fixtures (`a1…`, `ee…`, `ff…`, `nsec-fixture-N`).
- [x] No debug logging, no `debugger`, no TODO, and no commented-out code in the new files or the handler change.
- [x] **Error paths:**
  - A non-JSON answer falls back to `HTTP <status>`.
  - A 401 shows "Authentication required".
  - A failed `refreshUser` still navigates. It swallows its own errors anyway.
  - Navigating after the user changes causes no state update after unmount: the success path returns straight after
    `navigate`.
- [x] **Concurrency:** I walked through the lock's interleavings (a call queued before or after the head's `finally`,
  and a failure at the head). The `finally` guard `provisionTails.get(pubkey) === tail` releases each entry exactly
  once. Map entries only exist for sessions that passed the role check, so the Map can't grow without bound.
- [x] **Security:** the route's auth and route-table entry are unchanged (`src/middleware/routeAccess.js:101`). The
  diff removes an old comment ("Owner is handled above … we never write the owner here",
  `c7a10a63f:src/api/assistant/index.js:524`), which was wrong.
- [x] **Accessibility:** the done row keeps `/setup`'s "Done: " screen-reader prefix and `aria-hidden` marker, and the
  failure line is `role="alert"`. The disabled button's look is in Non-blocking 6.

## House rules check

- [x] Concept Graph API authority respected (not touched).
- [x] No new lint, typecheck or build tooling.
- [x] Ledger row `ledger/2026-11-04-appearance-t1-freezes-styles.md` is well formed (L15 clean). Its description of
  T1 matches the code: `test/appearance-setting-working.test.js:138` fails on any "new unscoped declaration".

## Product-guide adherence *(when the story traces to a PRD)*

- [x] Not applicable. The book has no PRD; its anchor is an acceptance frame.

## Findings

### Blocking

None.

### Non-blocking

1. **tests/brainstorm/setup-create-account.spec.js:498** — B7 asserts the URL after the press, not that the Edit
   Assistant Profile page "shows the new Assistant's profile form" (AC-3). From the source it does. The editor is
   unchanged, `EditProfile.jsx` mounts `AssistantProfileEditor` for an admin or customer, and the editor shows the form
   once its own `/api/assistant/status` read has `hasRelayKey` (`AssistantProfileEditor.jsx:277`). The server holds
   the key before it answers, and B7's mock does the same. Optional improvement: after the URL check in B7 and B8, add
   that the editor's "Create my Tapestry Assistant key" button is absent.
2. **engineering-team/decisions/setup-create-account/0001-a-page-from-sign-in-and-one-assistant-per-person.md:216** —
   "`provision-key` can no longer orphan a key, from this page, the editor or a direct call" overclaims by one case.
   The same ADR keeps it as a gap at `:228`. When an owner's TA key is missing:
   - `getAssistantKeys(owner)` reads the `tapestry-assistant` slot (`src/utils/assistantKeys.js:22-24`);
   - the store writes under the owner's own pubkey (`src/api/assistant/index.js:496`);
   - so each direct owner call still stores a fresh key that nothing ever reads, and the lock can't change that.

   The page never offers it, and the gap is older than this story. Optional improvement: scope that bullet to "an
   admin or a customer".
3. **engineering-team/decisions/setup-create-account/0001-a-page-from-sign-in-and-one-assistant-per-person.md:45** —
   "the read-only `GET /api/assistant/status`" isn't exact. For the assistant's own signed-in user, that handler may
   copy a kind 0 found only on the publish relays into the local relay (`src/api/assistant/index.js:380-396`,
   `src/api/assistant/profileState.js:179`). So opening the done state can store a copy of an already-signed,
   already-public event. Nothing is created, signed or published, and the editor and dashboard already do this
   through the same hook (ADR `assistant-profile/0001`). I don't read it as breaking AC-5's intent, but AC-5 says
   "stored", and B12 sees only the browser's request methods. Optional improvement: name this cache fill in the ADR,
   or in the story's AC-5, as allowed.
4. **ledger/2026-11-04-appearance-t1-freezes-styles.md:34** — the pointer `test/appearance-setting-working.test.js:121-137`
   was already 3 lines off in the commit that added it (`c7291cfbb`), because that commit also added the 3-line
   `WORKING_FILES` re-aim above T1. T1 is at `:124-140`. Also, `test/appearance-setting-working.test.js:48` still says
   "Until the page exists, those five fail on the missing file", which has been false since `e9f33314a`. Optional
   improvement: fix the pointer, and put that comment in the past tense.
5. **ui/src/pages/setup/CreateAccount.jsx:64-65** — `useProfiles` and `useAssistantSetupState` are called inside
   `Done`, not "unconditionally" in the page as the ADR's Implementation notes say (`:246`). It's equivalent (the hooks
   rules hold, and it sends fewer requests), but it isn't in `## Deviations`. Optional improvement: add one line there.
6. **ui/src/pages/setup/CreateAccount.jsx:119** — while working, the button is `disabled` and reads "Creating…".
   `.bs-link-btn` has no disabled rule (`ui/src/styles.css:2582-2594`), so it keeps the pointer cursor and full ink.
   The text is the only cue, which meets AC-3. Optional improvement: none needed now. Amendment 1 rules out a new rule
   in this story.
7. **ui/src/pages/setup/CreateAccount.jsx:36** — a `display_name` of only spaces doesn't fall through to `name`, so a
   profile with `display_name: " "` and `name: "olive"` reads as unnamed. The Deviations describe the trim, and
   `display_name || name` is the ADR's rule. Optional improvement: trim each field before choosing.
8. **tests/brainstorm/appearance-setting-working.spec.js:218-219** — the three excluded W3 entries stay in
   `fixtures/appearance-setting-3-baseline.json`, unread. That's harmless, and the comment says so.

### Not verified

- **The full `npm test` gate:** not run here, for the reason in Quality gates. CI on the PR is the gate of record.
- **A live run against a real server:** the lock under the real `SecureKeyStorage` (encrypted-file `writeFileSync`),
  or a real admin pressing the button. The test plan names this gap. My conclusion that the lock holds with real
  storage comes from reading the read and write paths, not from a run.
- **The owner's approval of Amendment 1 at the Test Design gate:** recorded in `c7291cfbb`'s message and in the
  review brief. I can't see the owner's own message from the repo.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. Nothing new. The one this story found, T1 freezing `styles.css`, is already filed as
   `ledger/2026-11-04-appearance-t1-freezes-styles.md`.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place, in this review's commit, by the main session (the review's brief
  reserved the flip). With the flip, `harness-lint` reports 0 violations.
- [x] Completion detection: the book `setup-create-account` (no PRD) is judged against its acceptance frame. It is
  **not complete**: story 2 (open sign-up, `Approved`) is still needed for the frame's bullets on guest sign-up, the
  Settings switch, and self-signed-up customers. Nothing to offer yet.
- Amendment 1's approval: the owner approved the test plan, with the amendment, in this session's chat ("Approve, go
  on", 2026-11-04). The main session checked this against the conversation, which this review couldn't see.
