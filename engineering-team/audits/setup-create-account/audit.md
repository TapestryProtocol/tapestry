# Build Audit: Create your account — /setup step 1's page, and open sign-up

**Book:** `engineering-team/audits/setup-create-account/book.md`
**Date:** 2026-11-05
**Branch / commit range:** `3eed1b8eb..db9325518` on `feat/setup-create-account` (16 commits, all tagged
`setup-create-account #1` or `#2`)
**Shipped:**
- story 1: staging `d9b670144` (nousclawds4/tapestry#20), production `21e371a41`;
- story 2: staging `52e0846cc` (nousclawds4/tapestry#21), production `72bfbd740`.

Each story reached main alone, by merging the feature branch into main.

**Provenance:** Acceptance-frame
**Confidence:** high. The anchor is an owner-confirmed acceptance frame (book § Intent anchor), and every bullet is met
in code and tests and is live in production. Two bullets have never been exercised live with a real owner: the switch,
and a real sign-up (§5).

> The as-built record: what the product is now, source-linked. It proposes nothing; `prd-seed.md` does that.

## 1. What shipped

- **`/setup/create-account` is a real page.** It tells each visitor where they stand on step 1, in one of five states:
  - signed out: a sign-in prompt;
  - done: the Assistant, with links to its profile;
  - able to create one: an admin or an active customer gets a one-button create;
  - a guest: told to ask the named, linked owner;
  - an owner whose Tapestry Assistant key is missing: told so, with nothing to press.

  `stories/done/setup-create-account/1-create-account-page.md`
- **One button creates the Assistant** for an admin or an active customer, and lands them on the Edit Assistant Profile
  page. Key creation is now one check-and-store at a time per pubkey, from any caller. — story 1
- **An owner-only "Open sign-up" switch** in a new Settings tab, "👥 Accounts". It is off on every instance until its
  owner turns it on, and it survives a restart. — `stories/done/setup-create-account/2-open-sign-up.md`
- **While the switch is on, a signed-in guest signs up in one step** from the page. They become an active customer with
  exactly one Assistant, and land on the Edit Assistant Profile page. The app treats them as a customer at once
  (`/setup`, the Setup Alert and the avatar menu). — story 2
- **While it is off, every way in is refused,** including the two legacy sign-up pages and a direct call. — story 2
- **A deactivated customer is told to ask the owner,** and can't reactivate themselves by signing up. — story 2
- **The owner or an admin can deactivate and reactivate any customer again.** The route had answered 401 to everyone
  since the sign-in rewrite `37a31e247` (2026-09-11). — story 2, ADR 0002 Amendment 2

## 2. Epics & stories rolled up

### Epic: `setup-create-account`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 create-account-page | The page in all five states, the one-button create, and the per-pubkey key lock | Done | `reviews/done/setup-create-account/1-create-account-page.md` (PASS, first round) |
| #2 open-sign-up | The owner's switch, guest sign-up, the deactivated state, and deactivate/reactivate working again | Done | `reviews/done/setup-create-account/2-open-sign-up.md` (round 1 asked for changes on AC-4's deactivate clause; round 2 PASS) |

## 3. As-built inventory

**User-facing**
- **New page:** `ui/src/pages/setup/CreateAccount.jsx`, with its state function (`createAccountState.js`) and copy
  (`createAccountCopy.js`). It replaces the placeholder export in `ui/src/pages/setup/Placeholders.jsx`, which now holds
  steps 2 and 3 only.
- **New Settings tab, "👥 Accounts":** `ui/src/pages/settings/AccountSettings.jsx`, wired in `ui/src/pages/settings/Index.jsx`
  and `ui/src/App.jsx`.
- **The sign-in context:** `ui/src/context/AuthContext.jsx` carries the classification's two new guest fields, and
  `refreshUser()` after a sign-up.

**Data & contracts**
- **The sign-up route:** `POST /api/auth/sign-up-new-customer` is now `signed-in` in the route table
  (`src/middleware/routeAccess.js`); it was `OWNER_ACTION`. The handler admits a guest only while `signUp.open === true`.
  - Refusals are 4xx with a `code`: `sign-up-closed`, `not-a-guest`, `already-customer`, `customer-inactive`,
    `assistant-key-failed`, `sign-up-failed`.
  - The 200 carries `customerId`, `customerName`, `assistantPubkey`, `assistantNpub`, and the legacy pages' `pubkey`,
    `status` and `relayPubkey`. No private key.
  - Source: `src/api/auth/signUpNewCustomer.js`; `src/api/openapi.yaml`.
- **The change-status route:** `POST /api/change-customer-status` reads `req.session.pubkey` when
  `authenticated === true`, as every login sets. It no longer reads `userPubkey`, which nothing sets. Owner or admin,
  else 403; not signed in, 401. Source: `src/api/customers/changeCustomerStatus.js`.
- **The classification:** `GET /api/auth/user-classification` adds `signUpOpen` and `customerStatus` for a guest only.
  Source: `src/api/auth/getUserClassification.js`.
- **The switch:** settings key `signUp.open`, default `false` (`src/config/defaults.json`). It is owner-only through the
  owner-only key list in `src/api/settings/settingsApi.js` (`OWNER_ONLY_REFUSALS`).
- **Key provisioning:** `provisionAssistantKeyOnce` (`src/api/assistant/index.js`) takes a per-pubkey in-process lock.
  `provision-key`, the page and sign-up all use it.
- **The customer store:** `createCustomer` clears the instance's cache under its file lock before reading
  (`src/utils/customerManager.js`, ADR 0002 Amendment 1).

**Domain**
- No concept definitions changed and no firmware reinstall (ADR 0001 and ADR 0002, § Consequences). Concepts named for
  orientation only: `tapestry-assistant`, `nostr-user`.

**Tests added:**
- Node: `test/setup-create-account.test.js` (19) and `test/setup-open-sign-up.test.js` (41).
- Playwright: `tests/brainstorm/setup-create-account.spec.js` (23 passed in review) and
  `tests/brainstorm/setup-open-sign-up.spec.js` (13 passed in review).
- Re-aimed: `test/appearance-setting-working.test.js` (`CreateAccount.jsx` joins `WORKING_FILES`) and
  `tests/brainstorm/appearance-setting-working.spec.js` (`REPLACED_SINCE_BASELINE`), both under ADR 0001 Amendment 1.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 3: "…or to sign up in one step while it is on" | One step, except after a key failure. A `500 assistant-key-failed` leaves a customer with no Assistant, and the page keeps offering "Sign up" until the next press. That press gets 409 `already-customer` and moves on to the editor, which can create the key. | constraint-discovered | The customer is created first, so a failed key leaves a record story 1's page can finish (ADR 0002 § 3); the page state was "left as it is" (Amendment 2; review 2 round 1, Non-blocking 4) | A rare failure path takes a second press, with a wrong-looking intermediate screen | §6 item 4 |
| 2 | Frame bullet 4: "The owner turns open sign-up on or off in Settings" | An eighth Settings tab, "👥 Accounts". At 375 px and 900 px the tab bar doesn't wrap, and Accounts sits past the right edge, reached by scrolling sideways. | constraint-discovered | The overflow predates this story ("Auditing Tools" already overflowed at 900 px) and was filed, not changed (story 2 § Deviations) | The owner may not see the tab at some widths | ledger row `2026-11-05-settings-tab-bar-overflows` |
| 3 | Frame bullet 4 (the switch) | A change to the switch reaches an already-open page at its next sign-in check or reload. There is no push. | interpretation | Same as every other setting (ADR 0002 § Consequences) | A guest's page shows the old state until reload | — |
| 4 | Frame bullet 5: "A customer who signed up themselves is the same as one the owner added" | The same record, and the same deactivate/reactivate. Deactivating had been broken for every customer since `37a31e247`, so this book fixed it. Deleting a customer is still broken the same way, for every customer. | added-beyond-scope · deferred | AC-4 promises deactivate, so the fix was in scope; delete is not promised and removes keys, so it gets its own fix (ADR 0002 Amendment 2, "Left as it is, and filed") | Owners can deactivate again; nobody can delete a customer from the app | ledger row `2026-11-05-delete-customer-reads-stale-session-field` |
| 5 | Frame bullet 5 (the same record) | `createCustomer` now reads the customer file under its lock. That also fixes an old race on the owner's own add-customer path. The other five locked writers keep the stale-cache pattern. | constraint-discovered | Two concurrent sign-ups both "succeeded" and one overwrote the other on the oracle (ADR 0002 Amendment 1) | Concurrent sign-ups leave one customer; other concurrent customer edits can still drop a change | ledger row `2026-11-05-customer-manager-stale-cache-writes` |
| 6 | Frame bullet 1 (a real page) | No stylesheet rules of its own: the page reuses `.bs-setup-*`, `.bs-link-btn`, `bss-card` and `bs-error`. The working button ("Creating…" or "Signing up…") keeps its pointer cursor and full ink; its text is the only cue. | constraint-discovered | The appearance book's T1 fails on any new unscoped rule (ADR 0001 Amendment 1; review 1, Non-blocking 6) | No visual difference beyond the button-cue gap | meta row `2026-11-04-appearance-t1-freezes-styles` |
| 7 | — (the legacy sign-up pages, not in the frame) | They follow the switch like every other way in. Refusals changed from HTTP 200 to 4xx with the same `success`, `message` and `error`. The 200 keeps their `pubkey`, `status` and `relayPubkey`. | intentional-change | Story 2 AC-2; ADR 0002 § Consequences and Amendment 2 Decision 2 | Before this book these pages could never succeed; now they can, when the switch is on | — (retiring them: §6 item 3) |
| 8 | Frame bullet 2: an admin or active customer "creates one from that page with one button" | As specified. An owner whose key is missing is not offered the button. `provision-key` still accepts that owner and stores a key nothing reads. | deferred | An older gap, ADR `assistant-profile/0004` (ADR 0001 § Consequences; review 1, Non-blocking 2) | None from this page | intake 2026-08-10 (key lifecycle) |

**Undocumented work:** none. Every file in `git diff 3eed1b8eb db9325518` traces to a story or ADR:
- the appearance re-aims, under ADR 0001 Amendment 1;
- `customerManager.js`, under ADR 0002 Amendment 1;
- the four new ledger rows and the two occurrence notes, from Test Design and the reviews;
- `_intake.md`, the PICKED UP note.

## 5. Quality state at close

- **Test gate:**
  - **CI's stack-free `npm test`** on nousclawds4/tapestry#21, head `db9325518`: run 42082655961, "Overall: PASS — 6653
    passed, 0 failed, 593 skipped across 330 suites". Story 1's PR #20 passed the same job (run 41968178859).
  - **This close changes no code** from `db9325518`: only `engineering-team/`, `ledger/` and `OPEN.md`.
  - **Not run on this machine:** the full `npm test`. It publishes tag fixtures to a public relay from the Mac Studio
    (`ledger/2026-09-30-npm-test-step-leaks-fixtures.md`). Instead, the suites that read the harness documents ran
    over the final tree, after the flip and the epic close-out, with the live paths pointed at a dead port. Results are
    recorded under "Close-time suites" below.
- **Staging and production:**
  - Both stories were smoke-tested after each ship, all five tiers. Story 2's check proved the new code live in three
    ways:
    - the bundle holds all six new strings;
    - signed out, sign-up refuses with the signed-in route's wording ("Sign in to do this.");
    - a signed-in guest's classification carries `signUpOpen: false` and `customerStatus: null`.
  - The page shows a guest the ask-the-owner line and no Sign up button, on staging and in production (Chrome).
  - Production's safe-to-merge check waited out the 20:00 search refresh before the push.
  - Main has no `publish-image.yml`, so no brain on tapestry.ninja rolled.
- **Not covered by any run:**
  - a real owner opening Settings › Accounts and flipping the switch;
  - a real guest signing up against the real `SecureKeyStorage` and `proper-lockfile`;
  - the per-pubkey lock under real storage;
  - the legacy manage-customer page with a real owner session.

  The test plans name these gaps. The automated browser has no NIP-07 signer.
- **Known open issues:** ledger rows
  - `2026-11-05-delete-customer-reads-stale-session-field` (bug);
  - `2026-11-05-customer-manager-stale-cache-writes` (bug);
  - `2026-11-05-settings-tab-bar-overflows` (bug).
- **Debt logged by the ADRs:**
  - the key lock holds within one process (ADR 0001);
  - `CREATE_ACCOUNT_STEP.placeholder` is kept, unused (ADR 0001);
  - the editor's own 409 wording is unaligned (ADR 0001);
  - the switch has no live push (ADR 0002);
  - limits on who may sign up are not taken on (ADR 0002).

**Close-time suites** (final tree after the flip and the epic close-out, before the commit; dead port, and a container
name that doesn't exist for the one suite that uses `docker exec`):
- `bash scripts/harness-lint.sh`: clean (0 violations).
- Suites that read the harness as a whole (no other suite reads the moved or edited documents outside comments):
  `harness-lint` 85/85, `harness-stats` 12/12, `ledger-row-ids` 6/6, `rollup-scanners` 33/33, `session-start` 32/32,
  `gate-result-record` 34/34, and `operational-direction` 76 passed, 10 skipped (its live checks).
- The book's own suites: `setup-create-account` 19/19 and `setup-open-sign-up` 41/41.
- `scripts/whats-open.sh` lists this book's §6 under closed-book carry-forwards and no longer lists it as open.

## 6. Carry-forward register

- [ ] **1. Limits on who may sign up:** a trust threshold from the owner's point of view, a cap, or a waiting list the
      owner approves. It's the natural next step (architecture reflex check 2), and ADR 0002 names where the rule
      would go. (story 2 § Out of scope; ADR 0002 § Consequences)
- [ ] **2. Telling the owner about new sign-ups** (a notice or a digest). (story 2 § Out of scope)
- [ ] **3. Retiring the two legacy sign-up pages** (`public/pages/customers/sign-up.html`, `public/pages/index.html`).
      (story 2 § Out of scope)
- [ ] **4. The page after `assistant-key-failed`:** call `refreshUser()` so the person sees story 1's create button,
      not "Sign up" again. (§4 #1; review 2 round 1, Non-blocking 4)
- [ ] **5. Deleting a customer:** ledger row `2026-11-05-delete-customer-reads-stale-session-field`. (§4 #4)
- [ ] **6. The other stale-cache writers in `CustomerManager`:** ledger row
      `2026-11-05-customer-manager-stale-cache-writes`. (§4 #5)
- [ ] **7. The Settings tab bar:** ledger row `2026-11-05-settings-tab-bar-overflows`. (§4 #2)
- [ ] **8. Steps 2 and 3's pages** (ngit issues `98821708` and `64a5f7bf`), still placeholders. (intake 2026-09-20,
      item 3; story 1 § Out of scope)
- [ ] **9. The owner-whose-key-is-missing gap** in `provision-key`. (§4 #8; ADR `assistant-profile/0004`)
- [ ] **10. Test soft spots:**
  - B7/B8 (story 1) and B3/B4 (story 2) check only the editor's URL after a create or sign-up, not that the editor
    shows the new Assistant's form (review 1, Non-blocking 1; review 2 round 1, Non-blocking 5);
  - D6's "still exported" check matches the `require` line too (review 2, R2-1). The suite run catches the case
    through `admin-action-sweep`.
- [ ] **11. Cross-origin posture:** the change-status route works again, and the delete route will once fixed. Both are
      owner-or-admin state changes with no `Origin` check of their own. Noted on OPEN.md row 326 at this close (review 2,
      R2-3).
- [ ] **12. A live owner check:** turn the switch on, sign up a test guest, deactivate and reactivate them, and turn the
      switch off again. Do it on staging, signed in as the owner, with a signer. (§5, "Not covered")

## 7. Process findings (harness)

`scripts/harness-stats.sh` at close:
- "reviews decided: 312 · kick-back rate: 0% · churn: 3";
- "reviews with kick-back history (any CHANGES_REQUESTED mention): 86";
- this book: 14 phase commits, open 1d, both stories same-day story→review.

The rate reads 0% because story 2's round 2 was appended to the same review file. That case is already filed as
`2026-09-20-inplace-pass-erases-kickback-history`, and the history count includes this book's round 1.

| Finding | Source | Terminal state |
|---|---|---|
| The appearance book's T1 fails on any new unscoped rule in `ui/src/styles.css`, so any later story that needs CSS must reuse classes or re-aim it. Ports to Direction mode: yes, a Director's implementer hits the same wall. | story 1 Test Design; ADR 0001 Amendment 1; review 1 Harness friction 1 | OPEN.md row `2026-11-04-appearance-t1-freezes-styles` (meta, filed in-book) |
| The review template's closing `## On PASS` heading makes a CHANGES_REQUESTED review read as PASS-final under the last-token verdict rule, and L1 then flags its story. Ports: yes, Direction stopping rules string-match the same verdict. | review 2 round 1, Harness friction 3 | OPEN.md row `2026-10-07-on-pass-heading-reads-as-verdict` (meta; occurrence added in-book) |
| Duties B6 has B8's read-once race. Ports: yes, any combined Playwright run. | review 2 round 1, Harness friction 2 | OPEN.md row `2026-10-13-duties-tab-b8-reads-row-early` (occurrence added in-book) |
| A Playwright run without `tests/global-setup.js` (the scratch config every review here used) skips all 56 specs that gate on `BRAINSTORM_SERVER_ACCESSIBLE`. It reports "skipped" and no failure, which reads as a run. Ports: yes, a Director or judge reading the counts would be fooled the same way. | review 2 round 1, Harness friction 1 | OPEN.md row `2026-11-05-playwright-skips-without-globalsetup` (meta, filed at this close) |
| The phases' "run `npm test`" step (the Implementer, the Reviewer, and this workflow's step 10) can't be followed on the Mac Studio, and no phase doc says what to do instead. This book used CI on each PR plus touched suites. Ports: yes. | reviews 1 and 2, Not verified; this close's §5 | OPEN.md row `2026-09-30-npm-test-step-leaks-fixtures` (meta; occurrence added at this close) |
| `/cycle-staging` and `/cycle-prod` still say `gh pr merge`, while this checkout ships by the mirror route: merge locally, ngit first, then fast-forward GitHub. Both ships here followed the route from memory, not the skills. During story 2's ship, ngit's staging had moved: another session's pilot commits were there and not on GitHub. Nothing in the skills says to compare the two remotes first. Ports: yes, the Director's staging chain copies the skill. | this session's two ships | OPEN.md row `2026-10-29-h2-0-baseline-predates-github-flow` (meta; occurrence added at this close) |
| The Test Design oracle's scratch mirror was built from a path list. It missed `ui/src`, `BIBLE.md`, `engineering-team/` and `ui/vite.config.js`, which made neighbouring suites fail falsely until each was added. | this session, story 2 Test Design | declined: the mirror recipe lives in this machine's agent memory, not in the harness. The note now says to archive the whole tree (`git archive HEAD`), not a path list. |
| Review 2 round 1 said nothing else changes a customer's status. A CLI command does, from a shell inside the container. | review 2 round 1 (corrected in the review) | declined: a one-off reviewer error, corrected in the review itself; no harness doc led to it |
