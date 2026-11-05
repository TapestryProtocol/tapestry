# ADR 0002: Open sign-up, an owner-only setting the sign-in answer carries

**Status:** Accepted
**Date:** 2026-11-05
**Story:** `engineering-team/stories/setup-create-account/2-open-sign-up.md`

## Context

Story 2 lets an instance's owner open sign-up to guests. Its acceptance criteria, restated:

- **AC-1:** an "Open sign-up" switch in Settings with its description. It is off on every instance until
  its owner turns it on, only the owner can change it, and a change survives a restart.
- **AC-2:** while it's off, a guest sees story 1's ask-the-owner message, and any sign-up request, from any
  page or sent directly, is refused with nothing created.
- **AC-3:** while it's on, a guest with no Assistant gets the sign-up line and a "Sign up" button. It's
  disabled while working. On success they're an active customer with exactly one Assistant, on the Edit
  Assistant Profile page, treated as a customer with no reload (`/setup`, the Setup Alert, the avatar menu).
  On failure they get the reason and the button again.
- **AC-4:** a self-signed-up customer is the same as one the owner added: in the list, in the regular
  runs, and deactivatable.
- **AC-5:** refused while it's on: a signed-out visitor, an existing customer, an admin, the owner, a
  second concurrent sign-up, and a deactivated customer. The deactivated customer is told to ask the
  owner.
- **AC-6:** turning it off later keeps existing customers and refuses new sign-ups.

**What exists (read at `feat/setup-create-account` `4a99b4038`, which is `main` with no staging-only
commits):**

- **Settings** (`src/config/settings.js:1-17`) has two layers: `src/config/defaults.json`, shipped and
  read-only, and an override file on the persistent volume (`/var/lib/brainstorm/settings.json`).
  `getSettings()` deep-merges them, so a key added to `defaults.json` holds on every instance until an
  override changes it, and an override survives restarts.
  - `PUT /api/settings` and `DELETE /api/settings/*` are `OWNER_ACTION` (owner or admin;
    `routeAccess.js:396-397`), behind `requireOwner` (`settingsApi.js:48-59`).
  - **One key is already owner-only:** an update or reset touching `adminPubkeys` is refused unless
    `mayChangeAdminList(req)` (`settingsApi.js:61-76, 114-116, 162-164`). It checks against the owner's
    pubkey, and a direct-local caller keeps it.
- **The Settings UI** is the control panel's `/tapestry/settings` (`ui/src/pages/settings/Index.jsx`), a
  tab bar (`TABS`, `:15-24`) of panels. Its gate is owner-or-admin (`:38`). Panels such as
  `AssistantDuties.jsx` use the `settings-group`, `settings-action-btn` and `settings-message` classes.
- **The sign-up endpoint** `POST /api/auth/sign-up-new-customer` (`src/api/auth/signUpNewCustomer.js`)
  is `OWNER_ACTION` today (`routeAccess.js:129`), and its handler then refuses the owner and admins
  (`:28-41`). So nobody can use it. Book `admin-action-owner-check` left it there "unless the owner runs
  open sign-up; then allowlist (signed-in)" (`audits/admin-action-owner-check/inventory.md:531-533`).
  When it ran:
  - it refused **any** existing customer, active or not, with one message (`:49-57`);
  - it created the key first, with `createSingleCustomerRelay` (`src/utils/customerRelayKeys.js`), which
    always generates and **overwrites** whatever key the person holds;
  - then it created the customer;
  - every refusal was HTTP 200 with `success: false`.
- **The legacy sign-up pages** (`public/pages/customers/sign-up.html:481-493`, `public/pages/index.html:481`)
  read only `data.success` and `data.message`.
- **`createCustomer`** (`src/utils/customerManager.js:167-235`) takes a file lock, refuses a second record
  for the same pubkey, assigns the id, and fills in the owner path's defaults: `display_name`,
  `directory`, `service_tier: 'free'`, `update_interval: 604800`. The owner's
  `POST /api/add-new-customer` (`src/api/customers/commands/add-new-customer.js`) sets the same values
  explicitly, plus `comments`.
- **`/api/auth/user-classification`** (`src/api/auth/getUserClassification.js:25-78`) already loads the
  customer record and answers `guest` for an inactive one. `AuthContext` keeps
  `{ pubkey, classification, assistantPubkey, profile }` (`AuthContext.jsx:66-71`) and re-reads the
  classification in `refreshUser()` (`:163-170`).
- **Story 1** gave the page `createAccountState` (`ui/src/pages/setup/createAccountState.js`),
  `GuestNoAssistant` (`CreateAccount.jsx`), and `provisionAssistantKeyOnce`, the per-pubkey lock
  (`src/api/assistant/index.js`, ADR 0001 § Decision 4).
- **ADR 0001 Amendment 1 still holds:** no new unscoped rule in `ui/src/styles.css` (appearance T1).
- **Staging's extra commits** (Avi's, not on `main`) touch `routeAccess.js` in one unrelated line
  (`GET /api/ready`), so a merge back into `staging` is expected to be clean.

**Concepts.** None change. The story names `39998:<TA>:tapestry-assistant` and `39998:<TA>:nostr-user` for
orientation only, as in ADR 0001.

## Options considered

### Option A — A settings key guarded like the admin list, carried in the sign-in answer

- **The switch is a new settings key**, `signUp.open`, `false` in `defaults.json`. The general settings
  routes write it, and the admin list's owner-only guard is widened to cover it.
- **The sign-in answer carries what the page needs:** `/api/auth/user-classification` adds `signUpOpen`
  and `customerStatus` for a guest, so the page knows its state as soon as sign-in resolves.
- **The sign-up endpoint opens to signed-in callers.** Its handler gates on the switch, creates the
  customer, then gets the key through `provisionAssistantKeyOnce`.
- **A new "Accounts" tab in Settings** holds the switch.

**Pros:**
- One persistence mechanism, the one every other setting uses.
- The owner-only rule is the existing pattern, not a second one.
- No new route.
- The page never flashes "ask the owner" before switching to "Sign up".
- Story 1's lock covers the key.

**Cons:**
- The classification answer grows two fields that only a guest uses.
- The guard list in `settingsApi.js` becomes a list.

### Option B — Dedicated routes and a public policy read

`GET /api/sign-up/policy` (public) and `PUT /api/sign-up/policy` (owner-only), stored in their own file. The
page fetches the policy when it reaches the guest state.

- **Pros:** sign-up stays apart from the general settings.
- **Cons:**
  - a second store for one boolean;
  - two new routes, with their access entries and API docs;
  - the page renders "ask the owner" and then swaps in "Sign up" once the read lands, unless it also
    grows a loading state;
  - the deactivated-customer fact still needs the classification or a third route.

### Option C — An operator flag in `brainstorm.conf`

`BRAINSTORM_OPEN_SIGN_UP=true`, read like the other config values.

- **Pros:** almost no code.
- **Cons:** it fails AC-1. There's no switch in Settings, a change needs a shell and a restart, and the
  owner can't flip it.

## Decision

We chose **Option A**. It reuses the settings store and the owner-only pattern that the admin list
already set, and it gives the page its state in the same answer that sign-in already waits for.

### 1. The switch: `signUp.open`, owner-only

- **`src/config/defaults.json`** gains `"signUp": { "open": false }`. Every instance, existing ones
  included, reads `false` until its owner saves `true` (AC-1, AC-6).
- **`settingsApi.js`**: `ADMIN_LIST_KEY` becomes `OWNER_ONLY_KEYS = ['adminPubkeys', 'signUp']`.
  - `mayChangeAdminList` becomes `mayChangeOwnerOnlySetting`, the same rule.
  - `handleUpdateSettings` and `handleResetSetting` refuse with 403 when a patch has, or a reset path
    starts with, any of those keys and the caller isn't the owner (or direct-local).
  - The refusal names the key: "Only the owner can change the admin list." stays word for word, and the
    new one is "Only the owner can change open sign-up."
  - A `signUp` patch is validated: `{ open: boolean }`, no other keys, else 400.
- **The server reads it as** `getSettings().signUp?.open === true`, so a missing or malformed value is
  closed.

### 2. The sign-in answer: `signUpOpen` and `customerStatus`

In `getUserClassification.js`, the **guest** answer gains:

- `customerStatus`: the customer record's `status` when this pubkey has a record that isn't `active`,
  else `null`;
- `signUpOpen`: as in § 1.

Owner, admin and customer answers are unchanged. `AuthContext` keeps both, in `checkStatus` and in
`refreshUser()`, as `user.customerStatus` (default `null`) and `user.signUpOpen` (default `false`).

### 3. The endpoint: open to signed-in callers, gated by the switch

`routeAccess.js:129` becomes
`allow('signed-in', "Makes the caller a customer of this instance; the handler admits a guest only while the owner's open sign-up is on.")`.

`handleSignUpNewCustomer` is rewritten. Every answer keeps `success` and `message`, for the legacy pages,
and gains `error` and `code`:

| Order | When | Answer |
|---|---|---|
| 1 | no authenticated session (the middleware answers first) | 401 |
| 2 | `signUp.open` isn't `true` | 403 `sign-up-closed`, "Open sign-up is off on this instance." |
| 3 | the owner or an admin | 403 `not-a-guest`, today's messages |
| 4 | a customer record exists, active | 409 `already-customer`, "You are already a customer." |
| 5 | a customer record exists, not active | 403 `customer-inactive`, "Your customer account here is inactive." |
| 6 | otherwise | `createCustomer({ name, pubkey, status: 'active', observer_id: pubkey, comments: 'Signed up through open sign-up' })`, then `provisionAssistantKeyOnce(pubkey)`, then 200 with `customerId`, `customerName`, `assistantPubkey` and `assistantNpub` |

- **The name** is the owner path's `customer_<first 8 hex>_<base-36 ms>`. Every other field comes from
  `createCustomer`'s defaults, the owner's values (AC-4).
- **`createCustomer` throwing "already exists"** means a concurrent sign-up won. The handler re-reads the
  record and answers row 4 or 5. With `createCustomer`'s file lock, and its duplicate check reading the file
  under that lock (Amendment 1), two tabs leave one customer. With `provisionAssistantKeyOnce`'s lock, they
  leave one key (AC-5).
- **The customer is created first.** If the key then fails, the answer is 500 `assistant-key-failed`.
  The person is now a customer with no Assistant, so story 1's create button recovers it. The reverse
  order would leave a guest holding a key and no record.
- **`provisionAssistantKeyOnce` keeps a key the person already holds** (a former customer whose record was
  deleted). `createSingleCustomerRelay` would have overwritten it, so this path no longer calls it.

### 4. The page: two more states

`createAccountState(user, authLoading)`, story 1's table plus two rows before its last:

| Order | When | State |
|---|---|---|
| 1–5 | as ADR 0001 | `checking`, `signed-out`, `done`, `owner-key-missing`, `may-create` |
| 6 | `user.customerStatus` is a non-null, non-`active` string | `deactivated` |
| 7 | `user.signUpOpen === true` | `may-sign-up` |
| 8 | otherwise | `guest` (ask the owner) |

- **`deactivated`:** the story's line, naming and linking the owner as `GuestNoAssistant` does. A
  deactivated customer who kept an Assistant stays `done` (row 3), as story 1 decided.
- **`may-sign-up`:** the two guest lines and "Sign up", with the same phase machine as story 1's create
  button (ADR 0001 § Decision 3):
  - "Signing up…" and disabled while working;
  - on 200, or 409 `already-customer` (another tab won): `refreshUser()`, then
    `navigate(MY_ASSISTANT_PATH)`;
  - anything else: "You couldn't be signed up: {reason}" in `role="alert"`, with the reason taken from
    `error`, then `message`, then `HTTP <status>`, and the button again.
- **No reload needed.** `refreshUser()` brings `classification: 'customer'` and the new `assistantPubkey`.
  That makes `/setup` and the Setup Alert re-ask (their request key includes `assistantPubkey`), and it
  enables "My Assistant's Profile" (`hasMyAssistantPage`).

### 5. The Settings tab: "👥 Accounts"

`TABS` gains `{ key: 'accounts', path: 'accounts', label: '👥 Accounts' }` and a child route
`settings/accounts`. The panel is `ui/src/pages/settings/AccountSettings.jsx`:

- one `settings-group` with a checkbox labelled "Open sign-up" and the story's description below it;
- it reads `settings.signUp.open` from the page's existing `GET /api/settings`, and saves through the
  page's `handleSave({ signUp: { open } })`;
- **the owner** can toggle it, and the page shows the existing saved or error message;
- **an admin** sees it checked or not but disabled, with "Only the owner can change this." (new copy,
  proposed here for approval).

The panel uses existing classes only (Amendment 1 of ADR 0001 applies here too).

## Consequences

**Enables**

- An owner can open an instance to self-sign-up and close it again, and nothing changes on any instance
  until its owner does.
- The page knows a guest's sign-up state at sign-in, with no extra request and no flicker.
- Self-sign-up and the owner's add-customer produce the same record. Self-sign-up never overwrites a key.

**Constrains, or leaves as it is**

- **Every refusal of this endpoint changes from HTTP 200 to a 4xx.** The two legacy pages read only
  `success` and `message`, which every answer keeps, so they behave as before.
- **`/api/auth/user-classification` grows two guest-only fields.** Clients that don't know them ignore
  them.
- **The owner-only guard becomes a list.** A future owner-only setting is one entry.
- **A change to the switch reaches an open page on its next sign-in check, or a reload.** There is no
  push. This is the same as every other setting.
- **Debt, not taken on:** limits on who may sign up (a trust threshold, a cap, a waiting list) are the
  story's out-of-scope follow-up, and nothing here forecloses them. The rule would go in row 2's place in
  § 3 and in the classification's `signUpOpen`.

**Firmware reinstall required?** No.

## Implementation notes

- **`src/config/defaults.json`:** add `"signUp": { "open": false }`.
- **`src/api/settings/settingsApi.js`:**
  - `OWNER_ONLY_KEYS`, `mayChangeOwnerOnlySetting` (keep `mayChangeAdminList` as an alias if anything
    imports it);
  - per-key refusal messages;
  - `validateSignUp(patch.signUp)` → 400 on anything but `{ open: boolean }`.
- **`src/api/auth/getUserClassification.js`:** the guest answer's two fields. Read the setting through
  `require('../../config/settings').getSettings()`.
- **`src/api/auth/signUpNewCustomer.js`:**
  - rewrite the handler per § 3, and export it with a deps seam for tests:
    `createSignUpHandler({ getSettings, getConfigFromFile, isAdminPubkey, customerManagerFactory, provisionAssistantKeyOnce })`,
    with `handleSignUpNewCustomer` as the default-wired instance;
  - drop `generateNextCustomerId`, which `createCustomer` assigns, and the `createSingleCustomerRelay`
    import.
- **`src/middleware/routeAccess.js:129`:** the new entry.
- **`src/api/openapi.yaml`:** the endpoint's new codes and body, and the classification's two fields
  (`:202`, `:943`).
- **`ui/src/context/AuthContext.jsx`:** keep `customerStatus` and `signUpOpen` in both places.
- **`ui/src/pages/setup/createAccountState.js`:** rows 6–7.
- **`ui/src/pages/setup/CreateAccount.jsx`:**
  - a `MaySignUp` component, sharing the create button's phase logic. Extract it to a small hook in the
    same file if that's cleaner, without changing story 1's behaviour;
  - a `Deactivated` view;
  - `GuestNoAssistant` unchanged.
- **`ui/src/pages/setup/createAccountCopy.js`:** the story's eight new strings.
- **`ui/src/pages/settings/AccountSettings.jsx`** (new), **`Index.jsx`** (`TABS`), **`ui/src/App.jsx`**
  (the child route). The Accounts panel's copy: the switch's label and description from the story, and
  "Only the owner can change this." (new).
- **Tests (Phase 3).**
  - Story 1's suites are designed to pass unchanged: their mocks send no `signUpOpen`, so a guest stays
    "ask the owner".
  - New coverage needs:
    - the settings guard (owner, admin, direct-local; update and reset), the validation, and the
      default `false`;
    - the handler's table through the deps seam, with a fake customer manager that throws "already
      exists" on a race;
    - the classification's two fields;
    - the state rows;
    - in the browser: the page's two new states, the sign-up press (200, 409, failures), and the Settings
      tab as owner and as admin.
- **Branches.** As story 1: the book's branch, off `main`, so it carries no staging-only commits. It
  reaches `staging` by merge and `main` on its own.

## Amendment 1 (Test Design, 2026-11-05): `createCustomer` reads the file under its lock

**Proposed by the Tester at Test Design; approved by the owner at that gate (2026-11-05).**

**What was wrong.** § 3 said `createCustomer`'s file lock makes two concurrent sign-ups leave one
customer. It doesn't, as designed:
- **The read is cached.** Inside the lock, `createCustomer` reads the list through `getAllCustomers()`,
  which keeps a 30-second per-instance cache (`src/utils/customerManager.js:51-58`). The cache is cleared
  only after the write (`:227`).
- **The handler fills that cache first.** It calls `getCustomer` before `createCustomer`, so the
  duplicate check inside the lock reads a list from before the lock.
- **What happens.** Two tabs both "succeed", and the second write replaces the first record. The test
  plan's H7 caught it on the oracle (both answers 200), and H12 shows it in `createCustomer` alone: on
  today's code, two concurrent creates for one pubkey both succeed.
- **It's an old bug.** The owner's `POST /api/add-new-customer` reads the list before `createCustomer`
  too (`add-new-customer.js:43`), so an owner adding a customer at the same moment as a sign-up can
  silently drop one of the two records.

**Decision.** In `createCustomer`, clear the instance's cache right after acquiring the lock, and before
`getAllCustomers()` (`customerManager.js:181-182`). The duplicate check and the write then work from the
file as it is under the lock. One line, in a shared utility, so `src/utils/customerManager.js` joins
this ADR's files.
- With it, H7 and H12 pass on the oracle.
- The 35 neighbouring suites that touch settings, the route table, the classification or the customer
  store give the same results with and without it.

**Left as it is, and filed.** The other locked writers in `customerManager.js` (`:245`, `:309`, `:384`,
`:473`, `:980`, `:1195`) follow the same read-a-cached-list pattern. They aren't on this story's path:
ledger row `2026-11-05-customer-manager-stale-cache-writes`.

## Out of scope

- **Who may sign up** beyond on and off: trust thresholds, caps, a waiting list.
- **Telling the owner about new sign-ups.**
- **Retiring the legacy sign-up pages.**
- **Live updates** of the switch to pages already open.
