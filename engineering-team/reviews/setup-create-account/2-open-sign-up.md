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
