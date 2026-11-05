# Review: Story 2 — Open sign-up, the owner's choice

**Reviewer:** Claude (acting as Reviewer, a subagent separate from the author)
**Date:** 2026-11-05
**Diff:** `git diff 4a99b4038..e7c134e5c` on `feat/setup-create-account`: `ae3682126` (ADR), `4a7fa1744` (test plan, tests, ADR Amendment 1, ledger row `2026-11-05-customer-manager-stale-cache-writes`) and `e7c134e5c` (implementation, ledger row `2026-11-05-settings-tab-bar-overflows`). Main diff `4a7fa1744..e7c134e5c`.
**Story:** `engineering-team/stories/setup-create-account/2-open-sign-up.md`
**ADR:** `engineering-team/decisions/setup-create-account/0002-open-sign-up-an-owner-only-setting.md`, with Amendment 1
**Test plan:** `engineering-team/stories/setup-create-account/2-open-sign-up.test-plan.md`
**Book:** `engineering-team/audits/setup-create-account/book.md` (no PRD; acceptance frame)

The story, ADR, tests and code all came from one session. So I treated every coverage row, "verified" line and Deviation
as a claim, and re-derived each one from the code or from a command I ran.

## Quality gates (run by reviewer, not trusted)

- [ ] Full `npm test` / `npm run gate:status`: **not run**, on purpose. On the Mac Studio the full suite's live legs publish
  signed fixtures that the local relay router uploads to public relays, and the `tapestry` container here is a private
  agent-memory instance, not a dev stack. The owner's standing rule and this review's brief both forbid it. There is no
  gate:status line to quote. The full gate runs in CI on the PR.
- [x] **The implementation commit doesn't touch the tests:** `git diff 4a7fa1744..e7c134e5c -- test tests` is empty.
- [x] **Node suites**, one at a time through the scratchpad runner (`require(…).run()`, with `BRAINSTORM_BASE_URL`,
  `TAPESTRY_BASE` and `MEILI_URL_HOST` on the dead port `127.0.0.1:9`). Before running each, I grepped it for
  `docker exec`, `dockerCurl`, `execFileSync('docker'`, `TAPESTRY_PORT`/`_CONTAINER`, `strfry/publish` and `nak`. Every
  suite I ran had no match, and all were clean:

  | Suite | Passed | Failed | Skipped |
  |---|---|---|---|
  | `setup-open-sign-up` (new) | **31** | 0 | 0 |
  | `setup-create-account` (story 1) | **19** | 0 | 0 |
  | `admin-action-sweep` (the route walk) | 9 | 0 | 0 |
  | `appearance-setting-working` (T1 included) | 14 | 0 | 0 |
  | `setup-status` | 38 | 0 | 2 (H1, H2: live, dead port) |
  | `setup-alert` | 6 | 0 | 0 |
  | `stack-free-npm-test` | 6 | 0 | 1 (G2: needs the stack) |
  | `assistant-duties-settings` (the settings routes) | 36 | 0 | 0 |
  | `task-routes-owner-admin` | 5 | 0 | 0 |
  | `my-assistant-page` | 31 | 0 | 0 |
  | `about-this-instance` | 29 | 0 | — |
  | `login-failure-and-tag-collapse` (AuthContext) | 18 | 0 | — |
  | `signer-guard-rollout` | 4 | 0 | — |
  | `search-api-result-type-settings` | 14 | 0 | 2 (live, dead port) |
  | `assistant-scores-route` | 32 | 0 | — |
  | `appearance-setting` | 16 | 0 | 0 |
  | `appearance-setting-light` | 11 | 0 | 0 |
  | `appearance-setting-home` | 19 | 0 | 0 |

  - **Left out, each for a hazard match:**
    - `admin-action-sweep-access` (1) and `default-deny-mutations` (6). Both test the route table, and their matches
      look like path strings (`/api/strfry/publish`) in in-process middleware calls. The brief rules out every match, so
      I didn't run them. `admin-action-sweep` and A1 cover the one entry this story changes.
    - `setup-alert-polish` (15): story 1's review ran it after reading it. This brief doesn't allow that.
    - The other suites that matched among those my search for this story's modules turned up: most `*-publish`
      suites, `author-scoped-inspection-roster`, `not-yet-shared-filter`, `treasure-map-relay-presence`,
      `tapestry-per-concept-detail-views` and `firmware-concept-elements-sets`.
  - **Not run, though clean of matches:** the rest of that search's hits, such as `assistant-duty-menu-publish` and the
    `dictionary-*` suites. They reach this story's files only through shared modules such as AuthContext or the route
    table, which the suites above cover.
- [x] **Mutation check**, by me, against the real files, in memory only. A `--require` hook in `NODE_OPTIONS` (so the
  G-class child process loaded it too) replaced one file's source in Node's load hook (`module.registerHooks`, which
  covers `require` and ESM `import`) and in `fs.readFileSync` (so the source sentinels saw the mutant). No file on disk
  changed: `git status` was clean before and after. 21 mutations, 19 caught:

  | Mutation | Caught by |
  |---|---|
  | reset path unguarded | G4 |
  | update guard covers `adminPubkeys` only | G3 |
  | the owner-only rule admits anyone | G3, G4, G7 |
  | `signUp` validation off | G6 |
  | the handler reads the switch loosely (`open` truthy) | H1 |
  | no cache clear under the lock (Amendment 1 removed) | H7, H12 |
  | no re-read after a race | H7, H8 |
  | the handler ignores `session.authenticated` | H2 |
  | the classification reads the switch loosely | K1 |
  | the classification never sets `customerStatus` | K2 |
  | an inactive record answered 409 `already-customer` | H4, H8 |
  | the route back to `OWNER_ACTION` | A1 |
  | the owner not refused | H3 |
  | an admin not refused | H3 |
  | state: sign-up checked before deactivated | C1 |
  | state: `signUpOpen` truthy | C2 |
  | customers' answers also carry `signUpOpen` | K3 |
  | the record created `inactive` | H5, H6, H7, H9 |
  | the key failure answered 200 | H9 |
  | **the 200 body adds `nsec` and `privkey`** | **survived** (Non-blocking 1) |
  | **the 500 catch-all drops its `sign-up-failed` code** | **survived** (Non-blocking 2) |

  I didn't redo the browser mutations. They need a rebuild and a served build, and this review may not start a server.
- [x] **Playwright**, through the scratchpad config (chromium only, no globalSetup), against the proxy-free preview on
  `:4174`. That build is of `e7c134e5c`: it was built at 09:30, after the commit (08:07); the tree is clean at that
  HEAD; the served `index.html` is the same file as the scratchpad's `build-review2/index.html`; and the bundle holds
  implementation-only strings ("Only the owner can change this.", `already-customer`).
  - **`setup-open-sign-up.spec.js`: 13 passed, 0 failed.** The brief's command gives **13 skipped** and no failure: with no
    globalSetup, nothing sets `BRAINSTORM_SERVER_ACCESSIBLE`, and the spec skips every test (`:286`). The test plan's
    own command sets it. I re-ran with `BRAINSTORM_SERVER_ACCESSIBLE=true` (Harness friction 1).
  - `setup-create-account.spec.js` (story 1): **23 passed, 0 failed.**
  - `appearance-setting-working.spec.js`: **52 passed, 0 failed.**
  - `setup-status.spec.js`, `setup-alert.spec.js` and `setup-alert-polish.spec.js`: **91 passed, 0 failed.**
  - `assistant-duties-settings.spec.js` and `my-assistant-page.spec.js` (they open the Settings page, whose tab bar
    changed): **30 passed, 2 failed.** The failures are Duties B6 and B8, and they aren't this story's:
    - the diff touches nothing on that panel's path (`AssistantDuties.jsx`, its routes and its mocks are unchanged);
    - both tests read the DOM once, right after the mock logs the PUT, which happens before the answer is fulfilled
      (`tests/brainstorm/assistant-duties-settings.spec.js:278-280`, `:305-307`);
    - repeated (`--repeat-each=4`), they went 3 passed and 5 failed;
    - B8's race is already filed, as `ledger/2026-10-13-duties-tab-b8-reads-row-early.md`. B6 has the same pattern
      (Harness friction 2).
- [x] **Settings tab bar**, measured by me with a throwaway spec in the scratchpad (all `/api` mocked, owner signed in,
  `/tapestry/settings/accounts`): at 375 px the last tab, "👥 Accounts", ends at 723 px; at 900 px it ends 83 px past
  the content's edge (content 660 px wide, scroll width 743); at 1280 px it fits. This confirms the Deviation and the
  ledger row's shape. My numbers differ from the row's (360 and 115 px), probably from how each of us took the edge.
- [x] `bash scripts/harness-lint.sh`: **clean (0 violations)**, before and after this review file was added. It reports
  no L1 line for story 2, because L1 fires only once a PASS review exists (but see Harness friction 3).
- [x] `git diff --check 4a7fa1744..e7c134e5c` and `git diff --check ae3682126..4a7fa1744`: clean.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped. The UI bundle was built for the browser lane._

## Spec adherence

- [x] **AC-1, the switch:**
  - B9 passes: the owner finds "👥 Accounts", the switch off with its description, and saves exactly
    `{ signUp: { open: true } }`, then `false`.
  - It starts off: G1 (`src/config/defaults.json:72-74`).
  - Owner only: G3 and G4 (update, reset by key and by leaf), G7 (the admin list unchanged). B10 shows the admin a
    disabled switch, and B11 keeps the server's state on a refused save.
  - It survives a restart: `getSettings()` re-reads the override file on every call (`src/config/settings.js:76-78`),
    and G2 checks the file holds the value.
  - I looked for a way around the guard:
    - no other writer of the settings file touches `signUp` (`admin/index.js`, `assistant/index.js`,
      `assistantDutiesApi.js` and `grapevinePrefApi.js` each write a fixed key);
    - a dotted key in a patch (`{"signUp.open": true}`) stores a different, unread key;
    - a `__proto__` patch sets the merged object's prototype, which `JSON.stringify` doesn't write;
    - a reset path that only looks like `signUp` (`signUp/open`, `.signUp`, `SignUp`) deletes nothing.
- [x] **AC-2, while it's off:**
  - H1 refuses false, missing, `"true"` and `1` with nothing created.
  - B1 shows story 1's guest message, and B7 shows that opening the new states sends only reads.
  - Only one handler serves the endpoint (`src/api/index.js:166`), and the two legacy pages call that same endpoint
    (`public/pages/customers/sign-up.html:481`, `public/pages/index.html:481`).
- [x] **AC-3, while it's on:** H5, H10, B2, B3 and B5 pass. The press follows ADR § 4 (`CreateAccount.jsx:99-126`).
  `refreshUser()` brings the new `assistantPubkey`, and B3 sees "2 steps left", the menu link and `/setup`'s done row
  with no reload. Two gaps against the AC's words: the Edit Assistant Profile page's form isn't asserted (Non-blocking
  5), and a failed key doesn't leave the person "as they were" (Non-blocking 4).
- [ ] **AC-4, the same as any customer: not met** (Blocking 1).
  - **The list:** met by reading. `GET /api/get-customers` lists every active record from `customers.json`
    (`src/api/customers/getCustomers.js:16-28`). H6 shows that the two paths make the same record, through the same
    `createCustomer`.
  - **The regular runs:** met by reading. They take `status == "active"` records from `customers.json`
    (`src/algos/customers/processAllActiveCustomers.sh:73`). Both paths store the Assistant key in the same slot (the
    customer's pubkey, through `SecureKeyStorage.storeRelayKeys`).
  - **"The owner can deactivate them like any other customer": false**, for every customer (Blocking 1).
- [x] **AC-5, who can't:**
  - H2 (and the middleware's 401) for a signed-out caller; H3 for the owner and admins; H4 for active and deactivated
    customers.
  - H7 for two tabs at once; H8 for a race the store reports; H12 for the store itself.
  - K2, C1 and B6 ×2 for a deactivated customer, told to ask the owner.
- [x] **AC-6, turning it off later:** met by reading, and by H1. Only the handler's gate
  (`signUpNewCustomer.js:66`) and the guest's classification (`getUserClassification.js:102`) read the switch. Nothing
  in the closed path touches customer records or keys, and customers' classification answers don't depend on it (K3).
- [x] **Copy:** I compared the eight § Copy strings with the code byte for byte (a script parsing the story's table),
  and all eight match. C4 checks the page's six. "Only the owner can change this." is ADR § 5's proposed string, as
  written.
- [x] No behaviour beyond the story. The `comments` value `'Signed up through open sign-up'` is ADR § 3's, and only the
  legacy customer pages display it.

## ADR adherence

- [x] **§ 1:**
  - `OWNER_ONLY_REFUSALS`/`OWNER_ONLY_KEYS` (`settingsApi.js:66-70`) guard the update (`:125-128`) and the reset by the
    path's first segment (`:177-180`).
  - The rule is the admin list's rule unchanged: the owner pubkey or `req.localTrusted` (`:72-77`).
  - The admin list's refusal words are unchanged (G7).
  - The validation (`:83-87`, `:129-131`) runs after the guard. So an admin sending a malformed `signUp` gets 403, not
    400, which is the right order.
- [x] **§ 2:** `customerStatus` and `signUpOpen` go on the guest answer only (`getUserClassification.js:71-86`).
  `customerStatus` is the caller's own record's status: the session pubkey is set only by a verified login
  (`src/middleware/auth.js:50-58`). The switch is something every signed-in guest is meant to learn. Signed-out
  answers carry neither field. `AuthContext` keeps both in `checkStatus` (`:71-72`) and `refreshUser` (`:174-175`).
- [x] **§ 3:**
  - The order is the table's: 401, closed, owner, admin, existing record, create.
  - The record comes first, then the key through `provisionAssistantKeyOnce`.
  - `createSingleCustomerRelay` and `generateNextCustomerId` are gone (D3).
  - **Private keys:** `outcome.keys` (from `generateRelayKeys`) and `outcome.existing` (from `getCustomerRelayKeys`)
    both hold `privkey` and `nsec`, but only `pubkey` and `npub` reach the 200 (`signUpNewCustomer.js:112-121`). That
    rests on reading alone (Non-blocking 1). The key store's error messages carry no key material
    (`src/utils/secureKeyStorage.js`).
  - **The race path:** I walked it with `proper-lockfile`'s `retries: 3`. The loser's locked read sees the winner's
    record, throws "already exists", and gets 409 or 403 from a fresh re-read. If the lock retries run out instead,
    the error doesn't match, so the answer is 500 `sign-up-failed` and the person can press again. A second
    sign-up whose name collides in the same millisecond also matches "already exists", and its re-read finds the
    winner.
- [x] **§ 4:** `createAccountState.js:30-31` adds rows 6 and 7 before `guest`. `MaySignUp` takes 409 only with
  `code: 'already-customer'`, and its reason from `error`, then `message`, then `HTTP <status>`.
- [x] **§ 5:** the tab, the route (`App.jsx:590`) and the panel. The panel reads `settings.signUp.open` and saves
  through the page's `handleSave`. Its own owner check is strict (`AccountSettings.jsx:25`), though the page's gate
  admits admins (`Index.jsx:40`).
- [x] **Amendment 1:** `this.cache.clear()` sits right after the lock and before the read
  (`src/utils/customerManager.js:184`). It is enough for this story's path:
  - `createCustomer` now checks and writes against the file as it is under the lock, whoever calls it (H12);
  - the owner's `add-new-customer` reads before `createCustomer` too, and is covered the same way;
  - the one other owner write on a working route, the display name, builds a fresh instance first
    (`update-customer-display-name.js:37`), so it reads the file under the lock. The status route would too
    (`changeCustomerStatus.js:60`), once it works (Blocking 1). The delete route would not (see Blocking 1, option a).
  - The stale-cache pattern left in the other writers is filed (Non-blocking 6 on its pointers).
- [x] **ADR 0001 Amendment 1, the appearance constraint:**
  - no `ui/src/styles.css` change in any of the three commits, and T1 passes;
  - inline styles are layout only (`margin` ×3, `padding` ×1);
  - `settings-group`, `settings-hint`, `bs-assistant-note`, `bs-link-btn` and `bs-error` are existing classes.
- [x] **Files:** they match the Implementation notes plus Amendment 1's `customerManager.js`. No new dependencies:
  `package.json`, the lock file and `ui/package.json` are unchanged. `validateSignUp` is named `isValidSignUp`, which
  is equivalent.
- [x] **Deviations, each re-derived:**
  - **No alias:** `mayChangeAdminList` was never exported (`4a7fa1744:src/api/settings/settingsApi.js:185-192`), and
    nothing references it now.
  - **The validation message:** at `:130`.
  - **The handler's own 401 has no `code`:** at `:60`.
  - **The shared hook keeps story 1's rules:** confirmed, `CreateAccount.jsx:128-132`.
  - **`OwnerTail`:** renders story 1's line unchanged, and story 1's spec passes 23/23.
  - **The panel's copy, and the checkbox disabled while busy:** confirmed.
  - **The tab bar's overflow:** confirmed by measurement (Quality gates).
  - **The defensive read of the switch:** at `getUserClassification.js:98-107`.
  - **One overclaim:** "500 `sign-up-failed` … (test H11)". No H test reaches that path (Non-blocking 2).

## Concept-graph integrity

- [x] No concept handles in the diff. The story names two for orientation only.
- [x] No concept definitions changed. No firmware reinstall is needed (ADR § Consequences).
- [x] Orienting via `/summaries` doesn't apply: the code reads no concept. There is no TA pubkey literal: no 64-hex
  string is added anywhere in the diff.

## Things tests can't catch

- [x] **No secrets.** The test keys are fixtures (`c1…`, `ASSISTANT`, `'npub1fixtureassistant'`).
- [x] **Logging:** one new `console.log` (`signUpNewCustomer.js:101`), an operational line like the one it replaces.
  No `debugger`, TODO or commented-out code.
- [x] **Error paths:**
  - A key failure after the record exists answers 500 `assistant-key-failed` and is recoverable (Non-blocking 4).
  - An unexpected throw answers 500 `sign-up-failed` with `error.message`. Like story 1's provision-key, that can
    show a signed-in caller a server path, but no key material.
- [x] **Concurrency:** see ADR § 3 and Amendment 1 above.
- [x] **Security:**
  - The route opens to `signed-in` (`routeAccess.js:129-130`), it isn't in the customer-or-owner quirk list
    (`auth.js:327`), and only one handler serves it.
  - Every way to change `signUp` is owner-only, as AC-1 above lists.
  - Opening sign-up makes the customer role self-serve. I checked the most powerful thing a customer can reach:
    `POST /api/neo4j/query` keeps write Cypher owner-only whatever the role (`src/api/neo4j/queryPost.js:79-81`). Who
    may sign up is out of scope by the story.
- [x] **Accessibility:** the failure line is `role="alert"`, and the switch is a labelled checkbox, disabled for an
  admin. The tab bar's overflow is older than this story and filed.

## House rules check

- [x] Concept Graph API authority respected (not touched).
- [x] No new lint, typecheck or build tooling.
- [x] Both ledger rows are well formed (harness-lint clean). `2026-11-05-settings-tab-bar-overflows` points to
  `ui/src/styles.css:1389` correctly.

## Product-guide adherence *(when the story traces to a PRD)*

- [x] Not applicable. The book has no PRD; its anchor is an acceptance frame.

## Findings

### Blocking

1. **src/api/customers/changeCustomerStatus.js:43** (and **src/api/customers/deleteCustomer.js:33**) — AC-4's last
   clause, "the owner can deactivate them like any other customer" (story `:58-60`; ADR `:19-20`, "deactivatable"),
   is false on this branch, for every customer.
   - **What's wrong.** The owner's only deactivate route, `POST /api/change-customer-status` (`src/api/index.js:425`,
     `OWNER_ACTION` at `routeAccess.js:158`), identifies the caller by `req.session?.userPubkey`.
     - No login sets that field. `finalizeAuthenticatedSession` sets only `authenticated` and `pubkey`
       (`src/middleware/auth.js:50-58`), and the last line that set it (`req.session.userPubkey = sessionPubkey`)
       was removed in `37a31e247` (security-auth-exposure #3, 2026-09-11).
     - I called both handlers in memory with the session a real login makes, `{ authenticated: true, pubkey: <owner> }`.
       Both answered `401 {"success":false,"error":"Authentication required"}`.
     - A direct-local caller fails the same way: the handler never reads `req.localTrusted`.
     - No page or web route changes a customer's status: I grepped `src`, `ui/src` and `customerManagerCli.js`. The
       legacy manage-customer pages are the route's only callers (`public/pages/customers/manage-customer.html:1570`).
     - *Main session's correction:* one command does. The CLI's generic `update <pubkey> <field> <value>`
       (`src/utils/customerManagerCli.js:121-129`, `CustomerManager.updateCustomer`) sets `status` to `inactive` from a
       shell inside the container. That is not a way an owner deactivates anyone from the app, so the finding stands.
   - **Why it blocks this story, though the bug is older:**
     - The story asserts the capability, and the test plan's AC-4 row cites only H6, which checks the record's shape.
       So the story would close Done with a false clause.
     - It matters more now. Before this story only the owner made customers. With open sign-up on, anyone with a nostr
       key can make themselves one, and the owner's after-the-fact remedies, deactivate and delete (both 401), don't
       work from any page.
     - The deactivated line this story adds ("To use it again, ask the owner of this instance") sends people to an
       owner who can't reactivate them either.
   - **Asked change: the owner's call. Either option clears the block.**
     - **(a) Fix it in this story.**
       - In both handlers, identify the caller by `req.session.pubkey` behind `req.session.authenticated === true`,
         and keep their owner-or-admin rule.
       - Add tests that a real owner session can deactivate and reactivate a self-signed-up customer, and that a guest
         can't.
       - Mind the delete route if it's fixed too. It reads the list (`deleteCustomer.js:54`) on the same instance whose
         locked write then reads that cached list (`customerManager.js:476`, `:491`). That is the stale-cache pattern
         ledger row `2026-11-05-customer-manager-stale-cache-writes` names, so a sign-up landing in between would be
         lost. Clear the cache under that lock too, or leave delete for the row.
       - Name the files in an ADR 0002 amendment.
     - **(b) Take it out of this story.** With the owner's approval, amend AC-4 to drop or defer the deactivation
       clause, and file the 401 as its own bug (a ledger row, or a story) before this story closes.

### Non-blocking

1. **test/setup-open-sign-up.test.js:330** — nothing guards the 200 answer against carrying a private key. The fake
   `provisionAssistantKeyOnce` keys hold `{ pubkey, npub }` only (`:330` and `:432`), so a mutation that adds `nsec` and
   `privkey` to the answer survives. The code is right today (`src/api/auth/signUpNewCustomer.js:112-121`), and the real
   `generateRelayKeys` and `getCustomerRelayKeys` objects both hold `privkey` and `nsec`. Optional improvement: give
   the fakes `privkey` and `nsec`, and have H5 and H10 assert that the answer has neither.
2. **engineering-team/stories/setup-create-account/2-open-sign-up.md:119** — "Anything unexpected is 500
   `sign-up-failed`, so every refusal the page can meet carries a code (test H11)" overclaims. H11 checks the answers
   that H1–H10 produce, and none of them reaches the catch-all (`signUpNewCustomer.js:122-130`). Removing the code
   survives. Optional improvement: add a case whose manager's `initialize` throws, or drop "(test H11)".
3. **engineering-team/decisions/setup-create-account/0002-open-sign-up-an-owner-only-setting.md:224-225** — "The two
   legacy pages read only `success` and `message` … so they behave as before" isn't accurate.
   - On a refusal they read `data.error` (`public/pages/customers/sign-up.html:496`, `public/pages/index.html:496`),
     which every answer carries, so that half is fine.
   - On success they read `data.status`, `data.relayPubkey` and `data.pubkey` (`:522-540` in both files), which the
     new 200 dropped. A legacy-page sign-up now shows "Status: Unknown" and "Your Public Key: Unknown", and calls
     `/api/get-nip85-status?pubkey=undefined`.
   - Nothing regresses in use: before this story these pages could never succeed.
   - Optional improvement: add `pubkey` and `status` to the 200 (both are the caller's own), or correct the ADR line.
4. **ui/src/pages/setup/CreateAccount.jsx:117-118** — on `500 assistant-key-failed`, the person is now a customer with
   no Assistant. That is ADR § 3's approved order, but it isn't AC-3's "left as they were" (story `:57`). The page
   doesn't call `refreshUser()` on that path, so it keeps offering "Sign up". A second press gets 409
   `already-customer` and goes on to the editor, which can create the key, so it's recoverable, as the ADR says.
   Optional improvement: call `refreshUser()` on that code, so the page shows story 1's create button.
5. **tests/brainstorm/setup-open-sign-up.spec.js:340** — B3, like B4 at `:368`, asserts the editor's URL, not that the
   Edit Assistant Profile page "shows the new Assistant's profile form" (AC-3). This is the same gap as story 1's
   review, Non-blocking 1. The editor is unchanged, and the server stores the key before it answers 200. Optional
   improvement: as story 1's.
6. **ledger/2026-11-05-customer-manager-stale-cache-writes.md:22** — the pointers `:245`, `:309`, `:384`, `:473`,
   `:980` and `:1195` were right at `4a7fa1744`. `e7c134e5c` inserted three lines above them, so at HEAD the writers
   are at `:248`, `:312`, `:387`, `:476`, `:983` and `:1198`. Optional improvement: update the pointers, or name the
   methods (`updateCustomer`, `changeCustomerDisplayName`, `changeCustomerStatus`, …).

### Not verified

- **The full `npm test` gate:** not run here, for the reason in Quality gates. CI on the PR is the gate of record.
- **A live run against a real server:** a real owner flipping the switch, and a real guest signing up against the real
  `SecureKeyStorage` and `proper-lockfile`. The test plan names this gap. The handler ran against a real
  `CustomerManager` on a temp folder (H5–H12), and my lock analysis comes from reading.
- **The browser mutations:** not redone, because they need a rebuild and a served build.
- **The other appearance specs** the implementation commit counts ("158/158"): I ran the one that sweeps this page,
  `appearance-setting-working.spec.js` (52/52).
- **The owner's approval of Amendment 1 at the Test Design gate:** recorded in `4a7fa1744`'s message ("approved at the
  gate") and in the ADR. I can't see the owner's own message from the repo.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. The review brief's Playwright command (the scratchpad config, which drops globalSetup) runs nothing unless
   `BRAINSTORM_SERVER_ACCESSIBLE=true` is set. It reports "13 skipped" and no failure, which is easy to read as a run.
   The test plan's own command sets the variable. Suggested: have the scratch config set it, or put it in the brief
   template.
2. `tests/brainstorm/assistant-duties-settings.spec.js` B6 (`:278-280`) has B8's read-once race, already filed as
   `ledger/2026-10-13-duties-tab-b8-reads-row-early.md`. Here both failed in a combined run, then went 3 passed and 5
   failed over repeats. Suggested: add B6 to that row.
3. `engineering-team/templates/review-checklist.md` ends with the heading `## On PASS (same commit)`, after `## Verdict`.
   `scripts/lib/review-verdict.awk` takes the last PASS or CHANGES_REQUESTED token on a heading or bold line. So a
   CHANGES_REQUESTED review written in the template's order reads as PASS-final, and L1 then flags its story as a
   missing Done flip (it did, here, before I reordered). The three reviews the rule reads as CHANGES_REQUESTED-final
   don't use that closing heading. I kept the On PASS items, unchecked as the brief asks, and put
   `## Verdict` last. Suggested: move the On PASS block above `## Verdict` in the template, or have the verdict rule
   skip that heading.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place.
- [ ] Completion detection performed; the result and any book arithmetic recorded in the run journal (Direction) or the chat (human-gated) — never in this file. `/close-book` offered if the book looks complete.

## Verdict
**CHANGES_REQUESTED**

---

## Round 2 — 2026-11-05 (HEAD `16f76a4c0`)

**Diff checked:** `git diff 7d6398751..16f76a4c0`, three commits: `376bf6596` (ADR 0002 Amendment 2 and ledger row
`2026-11-05-delete-customer-reads-stale-session-field`), `2a77e97c7` (ten Node tests and the test plan's Amendment 2
section) and `16f76a4c0` (the implementation). I read the handler change without its re-indentation through
`git diff -w 2a77e97c7..16f76a4c0`. I checked every changed statement as a new claim, including the fix round 1
suggested (Blocking 1, option a).

- **The implementation commit doesn't touch the tests:** `git diff 2a77e97c7..16f76a4c0 -- test tests` is empty.
- **Nothing a browser runs changed since round 1's HEAD:** `git diff e7c134e5c..16f76a4c0 -- ui tests public` is
  empty. So round 1's Playwright results stand, and I didn't re-run them. The page reads `assistantPubkey` and the
  other existing fields of the 200. The three new fields are additions.
- **Files:** exactly Amendment 2's list (`changeCustomerStatus.js`, `signUpNewCustomer.js`, `openapi.yaml`, the story's
  Deviation line), plus its tests, the test plan and the ledger row. No dependency changed.

### Gates (re-run by the reviewer at `16f76a4c0`, host)

- [ ] Full `npm test` / `npm run gate:status`: **not run**, by the machine rule (the full suite's live legs publish
  signed fixtures here, and `tapestry`/`:7778` is a private agent-memory instance). There is no gate:status line to
  quote. CI on the PR runs the full gate.
- [x] **Node suites**, one at a time through the scratchpad runner, which forces `BRAINSTORM_BASE_URL`,
  `TAPESTRY_BASE` and `MEILI_URL_HOST` to the dead port `127.0.0.1:9`. I screened each one first for `docker exec`,
  `dockerCurl`, `execFileSync('docker'`, `TAPESTRY_PORT`, `TAPESTRY_CONTAINER`, `strfry/publish` and `nak`, and every
  suite below had no match. I also screened them for `wss://`, `WebSocket`, `SimplePool`, `:7778`,
  `/var/lib/brainstorm` and `spawn`/`exec`. Every hit was a fixture relay string, a base URL taken from the env (so
  the dead port), or a sentinel regex. `git status` was clean before and after every batch.

  | Suite | Passed | Failed | Skipped |
  |---|---|---|---|
  | `setup-open-sign-up` | **41** | 0 | 0 |
  | `setup-create-account` (story 1) | **19** | 0 | 0 |
  | `about-this-instance` | 29 | 0 | — |
  | `admin-action-sweep` (the route walk) | 9 | 0 | 0 |
  | `stack-free-npm-test` | 6 | 0 | 1 (needs the stack) |
  | `setup-status` | 38 | 0 | 2 (live, dead port) |
  | `assistant-scores-route` | 32 | 0 | — |
  | `my-assistants-nip05` | 13 | 0 | 0 |
  | `assistant-shared-categories` | 21 | 0 | — |
  | `assistant-trusted-content` | 30 | 0 | — |
  | `assistant-profile-check` | 33 | 0 | — |
  | `assistant-taggings-publish` | 19 | 0 | 1 |
  | `assistant-attention` | 38 | 0 | 1 |
  | `assistant-duty-menu-check` | 65 | 0 | 0 |
  | `assistant-duty-menu-publish` | 36 | 0 | 0 |
  | `assistant-outbox-check` | 29 | 0 | 0 |
  | `assistant-relay-list-publish` | 32 | 0 | 1 |
  | `assistant-self-map-check` | 94 | 0 | 0 |
  | `assistant-self-map-publish` | 92 | 0 | 0 |
  | `information-for-agents` | 52 | 1 | 4 |
  | `llms-txt` | 23 | 1 | 3 |

  - **Which suites:** the brief's five, every suite that reads `openapi.yaml` (17, by grep), and the one suite that
    loads `signUpNewCustomer` or `changeCustomerStatus` (`setup-open-sign-up`).
  - **The two failures are one external link check, not this story's.** In each suite, L1 asks that
    `https://api.brainstorm.world/openapi.json` answer 2xx, and it answered 502. My own `curl` got 502 too. That's the
    Brainstorm API's public document, not this repo's `src/api/openapi.yaml`, and the diff touches neither those docs
    nor that URL.
  - **Left out for a hazard match**, as in round 1: `admin-action-sweep-access` (1 match) and `default-deny-mutations`
    (6). `admin-action-sweep` covers the route table, and this diff doesn't touch the table.
- [x] **The tests fail on the code before the fix.** I ran HEAD's suite with `376bf6596`'s three source files swapped
  in memory (a `--require` hook serving the old text to `require` and `fs.readFileSync`): **33 passed, 8 failed**.
  The failures were H13, S1–S4, S5, D5 and D6, each for the reason the test plan's Amendment 2 section gives. That
  matches the plan exactly.
- [x] **Mutation check, in memory only.** A `--require` hook in `NODE_OPTIONS` rewrote one file's source when Node
  compiled it and when `fs.readFileSync` read it (so the source sentinels saw the mutant). It refused to run if an
  edit's text wasn't found, and an identity edit gave 41/41. No file on disk changed: `git status` was clean before
  and after. 20 mutations, 18 caught:

  | Mutation | Caught by |
  |---|---|
  | status: the old `req.session?.userPubkey` read restored | S1, S2, S3, S4, S5, D6 |
  | status: `userPubkey` kept as a fallback | S3, S5, D6 |
  | status: no `authenticated` check | S3 |
  | status: `authenticated` read as truthy, not `=== true` | survived (equivalent: every writer sets `true`) |
  | status: owner only, admins dropped | S2 |
  | status: the owner-or-admin check removed | S3, S5 |
  | status: the module's `getOwnerPubkey`, not the injected one | S1, S2, S4 |
  | status: the injected store ignored | S1, S2, S4 |
  | status: the 200 drops `message` | S1 |
  | `customers/index.js` stops exporting the handler | survived D6 (R2-1); caught by `admin-action-sweep` W1, T2 |
  | sign-up: `pubkey` from the body, not the session | H13 |
  | sign-up: `status` hard-coded `inactive` | H13 |
  | sign-up: `relayPubkey` dropped | H13 |
  | sign-up: `relayPubkey` only for a new key | H13 |
  | sign-up: `directory` added | H13 |
  | sign-up: the key object spread into the 200 | H13, H14 |
  | sign-up: `nsec` and `privkey` added (survived in round 1) | H14 |
  | sign-up: the catch-all drops its code (survived in round 1) | H15 |
  | sign-up: the catch-all answers 200 | H15 |
  | openapi: `relayPubkey` left out of the 200 | D5 |

- [x] `bash scripts/harness-lint.sh`: **clean (0 violations)** before this section was added.
- [x] `git diff --check 7d6398751..16f76a4c0`: clean.
- [ ] _Lint, typecheck and build: not configured, skipped._

### Blocking 1, re-derived

- **What a login sets.** `finalizeAuthenticatedSession` (`src/middleware/auth.js:50-58`) regenerates the session, then
  sets `authenticated = true` and `pubkey`. It is the only writer of `session.pubkey` in `src` or `bin` (grep).
  - The only other writer of `session.authenticated` is `src/api/export/nip85/commands/kind10040.js:129`. It runs
    only when `session.pubkey` is already set (`:100-108`), so it can't create an identity.
  - Logout destroys the session (`auth.js:210`).
  - So `authenticated === true` plus `pubkey` means exactly one thing: a verified login. Seven other handlers already
    read it this way (for example `src/api/assistant/scores.js:87`).
- **Accepts it:** `src/api/customers/changeCustomerStatus.js:46-47`. S1 (owner) and S2 (admin) deactivate and
  reactivate a guest who signed up through the real sign-up handler, on a real store in a temp folder.
- **Refuses everything else.** S3's eight cases:
  - no session, a pubkey without `authenticated`, `authenticated: false`, only `userPubkey`, and `authenticated` with
    only `userPubkey`: each 401;
  - a guest, a guest whose stale `userPubkey` names the owner, and the customer themselves: each 403;
  - the record never changes.
  - S5 shows the default-wired handler reads the same session.
- **The owner-or-admin rule is unchanged** (`:55-61`).
  - The default wiring (`:112-116`) binds the same `getOwnerPubkey` and `isAdminPubkey` as before.
  - Those helpers read the same sources the middleware's `isOwnerOrAdmin` reads (`BRAINSTORM_OWNER_PUBKEY`,
    `getAdminPubkeys`).
  - The route table entry (`src/middleware/routeAccess.js:158`, `OWNER_ACTION`), the registration
    (`src/api/index.js:425`) and `src/api/customers/index.js` aren't in the diff.
- **The legacy page's contract holds.**
  - `public/pages/customers/manage-customer.html` reads `result.success`, `result.message` and `result.error`
    (`:1583`, `:1585`, `:1595`).
  - `git diff -w` changes only the identity read, the `deps.` calls and the factory. Every answer's body is as it was.
- **AC-4's clause is now true, end to end (by reading):**
  - The owner opens the avatar menu's Legacy Dashboard (`ui/src/config/avatarMenuLinks.js:161`), then Manage Customers,
    then a customer's page. That page is gated on classification `owner` (`manage-customer.html:757`).
  - Deactivate posts to the route, the middleware admits the owner (`OWNER_ACTION`), and the handler now accepts the
    session.
  - Reactivation: the list shows only active customers (`src/api/customers/getCustomers.js:16`). But the page loads a
    record of any status by its URL (`get-customer` doesn't filter), and its Activate button uses the same route. That
    is the same for every customer, so "like any other customer" holds.
- **Tested at the right level, for the layer the bug was in.**
  - S1–S4 drive the real handler through its seam, from the session shape a login makes, on a real `CustomerManager`.
  - S4 also closes the loop with AC-5: deactivated, the person's sign-up gets 403 `customer-inactive`; reactivated,
    409 `already-customer`.
  - The middleware's decision for this route is the route table's, which `admin-action-sweep` walks.
  - Not tested, and fine to leave: the legacy page in a browser (the test plan says so), and the default-wired
    handler's success path, which would write to the real store.
- **"No cache change is needed here" (ADR :343-344): true.**
  - The default factory builds a fresh instance (`:115`).
  - The handler calls nothing on it before `changeCustomerStatus`. That method takes the lock
    (`src/utils/customerManager.js:387`), then reads through `getAllCustomers` (`:394`) on an empty cache, so it reads
    the file.

### Round-1 findings, re-checked

| Round 1 | Disposition | Check |
|---|---|---|
| Blocking 1: deactivate answered 401 | Fixed, `16f76a4c0`; tests S1–S5, D6 | Re-derived above. |
| NB1: no guard against a private key in the 200 | Fixed, `2a77e97c7`: H14 | The fakes now hold `privkey` and `nsec`. H14 checks values and field names, for a new key and a kept one. The round-1 mutant that survived is now caught, and so is spreading the key object. |
| NB2: "(test H11)" overclaimed | Fixed: H15 (`2a77e97c7`), story `:119-120` (`16f76a4c0`) | H15 reaches the catch-all through a manager whose `initialize` throws, and nothing is created. The new parenthesis ("H11 checks only the answers H1–H10 produce") is accurate: H11 reads `allAnswers`, which the earlier H tests fill, and exempts 401. One clause is still a touch broad (R2-4). |
| NB3: the legacy pages "behave as before" | Fixed, Amendment 2 Decision 2: H13, D5 | `showNewCustomerDetails` (`public/pages/customers/sign-up.html:509-540`, the same in `public/pages/index.html`) reads `customerName`, `customerId`, `status`, `relayPubkey` and `pubkey`, and calls `checkKind10040Status(data.pubkey)`. All five are now in the 200. Neither page reads `directory` or `createdAt`, so leaving them out is right. |
| NB4: a key failure leaves "Sign up" offered | Left (Amendment 2, "Left as it is") | Acceptable. It's recoverable on the next press, the order is § 3's approved one, and the owner approved the amendment that keeps it. |
| NB5: B3/B4 assert the editor's URL, not its form | Left | Acceptable, as story 1's review accepted the same gap. The editor is unchanged. |
| NB6: the stale-cache row's pointers | Left | Still off by three at HEAD (`:245` → `:248`, …, `:473` → `:476`). The two 2026-11-05 rows now disagree about the delete writer's line: the new row's `:476` is right. Non-blocking, as before. |
| Harness friction 1–3 | 2 and 3 filed by round 1's commit `7d6398751` | B6 was added to `ledger/2026-10-13-duties-tab-b8-reads-row-early.md`, and the verdict-heading edge to `ledger/2026-10-07-on-pass-heading-reads-as-verdict.md`. Friction 1 concerns a scratchpad config outside the repo. This round needed no browser run. |

### Amendment 2's own claims

- **Line references**, each checked at its commit: `src/api/index.js:425`, `routeAccess.js:158`,
  `manage-customer.html:1570`, `changeCustomerStatus.js:43` (at `376bf6596`), `auth.js:50-58` (the function's last
  statement; its closing brace is `:59`), `customerManagerCli.js:121-129`, `sign-up.html:509-540`,
  `deleteCustomer.js:33` and `:54`, and `customerManager.js:476` and `:491`. All correct.
- **`37a31e247`** (2026-09-11, security-auth-exposure #3) removed `req.session.userPubkey = sessionPubkey`. Correct.
- **"Nothing local calls this route":** correct. A repo-wide grep finds only the legacy page and the test.
- **The delete ledger row** is accurate. Its pointers are right (`src/api/index.js:422`, `routeAccess.js:181`,
  `deleteCustomer.js:33`), and so is its second bug:
  - `deleteCustomer.js:54`'s `getCustomer` fills the instance's 30-second cache;
  - `deleteCustomer` takes the lock (`customerManager.js:476`), and its read at `:491` reuses that cache;
  - it then writes that list back (`:565-566`).
- **The openapi change:** the file still parses (js-yaml). The three fields are in the 200 schema of
  `/api/auth/sign-up-new-customer` (`src/api/openapi.yaml:997-1005`), with accurate descriptions.

### The delete route left broken: not blocking

AC-4 (story `:58-60`) promises three things: the list, the regular runs, and that "the owner can deactivate them like
any other customer". It doesn't promise deletion. Round 1's option (a) allowed leaving delete for a row, and the
reversible remedy, deactivation, now works. Delete is irreversible and carries a second bug (the cache window above).
So a separate fix with its own temp-folder tests is the safer course. The row records both bugs accurately.

### Security, round 2

- **No private key in any answer.** The sign-up 200 adds only the caller's own pubkey, the record's status and the
  Assistant's public key (H14). The status handler's answers are unchanged.
- **No route opened.** The route table, the registrations and the middleware aren't in the diff. The status handler
  is as strict as the route's `OWNER_ACTION` entry, and stricter for a direct-local caller with no session.
- **No secrets, no debug code.** The diff adds no 64-hex literal. Its one `console.log` is an existing line,
  re-indented.

### Findings (round 2)

**Blocking:** none.

**Non-blocking:**

1. **R2-1, test/setup-open-sign-up.test.js:837-839.** D6 says the handler "is still exported". But its first regex
   also matches the destructuring `require` at `src/api/customers/index.js:16`. So removing
   `handleChangeCustomerStatus` from the index's `module.exports` (`:37`) survives D6. It doesn't survive the suite
   run: `admin-action-sweep` W1 and T2 fail ("Route.post() requires a callback function"). Optional: have D6 require
   the index and check `typeof handleChangeCustomerStatus === 'function'`, or drop "still exported" from D6's name and
   the test plan's Contract row.
2. **R2-2, src/api/openapi.yaml:4148-4149.** `/api/change-customer-status` says "Owner, admin or a direct-local caller
   only". But the handler answers 401 to a direct-local caller with no session, which Amendment 2 Decision 1 keeps
   (ADR `:336`). The sentence is older than this story, and the other owner routes share it. Optional: say this one
   needs a signed-in owner or admin.
3. **R2-3, src/api/customers/changeCustomerStatus.js.** Now that the route works again, it falls under OPEN.md row
   326's open question about the instance's cross-origin posture. That covers the CORS middleware in
   `bin/control-panel.js` (named in the row's 2026-09-27 note), the session cookie with no explicit `sameSite`, and no
   `Origin` check on this route. The change this route makes is reversible. Kept to a pointer, per that row's house
   rule. Optional: add the route, and delete when its row is fixed, to row 326's list or to
   `ledger/2026-10-11-assistant-signing-routes-csrf-scope.md`, so the posture fix covers them.
4. **R2-4, engineering-team/stories/setup-create-account/2-open-sign-up.md:119.** "So every refusal the page can meet
   carries a code" is one case too broad. A 401 carries none: the handler's own, as the bullet above it says, and the
   middleware's "Sign in to do this." for a session that has ended. The rest of the line is accurate. Optional:
   "every refusal but a 401".

**Harness friction:** none new.

### Not verified (round 2)

- **The full `npm test` gate:** not run here, for the reason in Gates. CI on the PR is the gate of record.
- **The legacy manage-customer page in a browser,** with a real owner session. The page's contract is unchanged, and
  S1 checks the answer's `success` and `message`.
- **The default-wired handler's success path,** which would write to `/var/lib/brainstorm`. The default wiring is
  three lines, read above.
- **The owner's approvals** of Amendment 2 at the Architecture and Test Design gates: recorded in the ADR and in the
  `376bf6596` and `2a77e97c7` messages. I can't see the owner's own messages from the repo.

### Verdict (round 2)

Round 1's blocking finding is fixed. The owner, and an admin, can deactivate and reactivate a self-signed-up customer
from a real signed-in session. Nothing else is admitted, the route's rule and the legacy page's contract are as they
were, and AC-4's deactivate clause now holds. Round-1 non-blocking items 1–3 are fixed, with tests that fail before
the fix and catch the round-1 survivors. Items 4–6 are left, acceptably. Amendment 2's claims and the delete ledger
row are accurate, and leaving delete to that row is consistent with AC-4's text. The four new findings are
non-blocking.

**PASS**
