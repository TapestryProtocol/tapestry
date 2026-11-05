# Test Plan: Story 2 — Open sign-up, the owner's choice

**Story:** `engineering-team/stories/setup-create-account/2-open-sign-up.md`
**ADR:** `engineering-team/decisions/setup-create-account/0002-open-sign-up-an-owner-only-setting.md` (with
Amendment 1, approved at this gate, and Amendment 2, from after the first review)
**Date:** 2026-11-05

Two new files carry the tests:

- **`test/setup-open-sign-up.test.js`**, the Node suite, registered in `test/registry.js`:

  | Class | What it tests | How |
  |---|---|---|
  | **C** | the page's two new state rows, and the copy | ESM in Node |
  | **G** | the switch: default, owner-only on update and reset, validation | `test/helpers/accessHarness.js` (mode `handlers`) in a child process, with the real owner and admin checks, a temp conf and a temp settings file |
  | **A** | the endpoint's access rule | `resolveRouteAccess`, pure |
  | **H** | the sign-up handler | ADR 0002's deps seam, `createSignUpHandler`; a real `CustomerManager` on a temp folder where records matter; fakes elsewhere |
  | **K** | the guest's sign-in answer | `getUserClassification.js` with its modules stubbed in `require.cache` |
  | **S** | deactivating a customer (Amendment 2) | the status handler's deps seam, `createChangeCustomerStatusHandler`, on the same real temp-folder store as a guest who signed up through the sign-up handler |
  | **D** | wiring this runner can't execute | source sentinels |

- **`tests/brainstorm/setup-open-sign-up.spec.js`**, the Playwright **B** class: what a guest, the owner
  and an admin see, against the built UI. Every `/api` route is mocked, and WebSockets are closed.

## Coverage map

| Criterion | Tests | Level |
|---|---|---|
| **AC-1** the switch | **G1** ships `signUp.open = false`. **G2** the owner saves it, and the override file holds it. **G3** an admin is refused 403 "Only the owner can change open sign-up." on update, alone or mixed with other keys, and the file is unchanged. **G4** the same on reset of `signUp` and `signUp.open`, and the owner may reset. **G5** a direct-local caller may change it. **G6** malformed values are a 400 and change nothing. **B9** the owner finds "👥 Accounts", the switch off with its description, and saves exactly `{ signUp: { open: true } }`, then `false`. **B10** an admin sees the state but disabled, with "Only the owner can change this.", and sends nothing. **B11** a refused save leaves the switch on the server's state, with the error shown. | unit (child); browser |
| **AC-2** while it's off | **H1** the switch false, missing, `"true"` or `1`: 403 `sign-up-closed`, "Open sign-up is off on this instance.", and nothing created. **A1** the route admits signed-in callers, so the handler is the gate. **K1** a guest's answer says `signUpOpen: false` unless it's exactly true. **C2** a guest is "guest" unless `signUpOpen === true`. **B1** a guest sees story 1's ask-the-owner and no "Sign up". **B7** opening the new states sends nothing but reads. | unit; browser |
| **AC-3** while it's on | **H5** one active record (owner path's name, `observer_id`, comments), created before the key, which comes from `provisionAssistantKeyOnce`. The 200 answer names the record and the Assistant. **H10** a key already held is kept. **K1**, **C2** the state. **B2** the two lines and "Sign up", and nothing of story 1's guest state. **B3** "Signing up…" disabled, one request, the editor, no reload, classification re-read, the pill "2 steps left", "My Assistant's Profile" goes from disabled to a link to the editor, Back shows done, and `/setup` shows step 1 done. **B5** failures show the reason (key, offline, closed meanwhile) and the button again. | unit; browser |
| **AC-4** same as an owner-added customer | **H6** a self-signed-up record and one built from the owner path's own fields through the same `createCustomer` have the same top-level and subscription fields, tier, interval and status, and both get a customer directory. **S1** the owner, from a real signed-in session, deactivates a customer who signed up and reactivates them. **S2** an admin may too. **S4** once deactivated, sign-up refuses them `customer-inactive`; once reactivated, `already-customer`. | unit, real store |
| **AC-5** who can't | **H2** no authenticated session: 401. **H3** the owner and admins: 403 `not-a-guest`. **H4** an active customer: 409 `already-customer`; a deactivated one: 403 `customer-inactive`, and it stays inactive. **H7** two concurrent sign-ups leave one record, one 200 and one 409. **H8** a race the store reports is re-read. **H12** `createCustomer` checks under its lock, so there are no lost records (Amendment 1). **K2**, **C1** a deactivated customer is "deactivated", whatever the switch says. **B4** a 409 goes on to the editor with no error. **B6** ×2 a deactivated customer is told to ask the owner, named and linked, with no "Sign up". **S3** only the owner or an admin changes a customer's status: no session, an unauthenticated one or one with only the old `userPubkey` field is 401, and a guest (even one whose stale `userPubkey` names the owner) or the customer themselves is 403; the record never changes. | unit; browser |
| **AC-6** turning it off later | **G4** a reset to the default closes it; **H1** closed refuses new sign-ups; **H4** existing customers are untouched by the handler. Customers are never deleted by any path in this story. | unit |
| Contract | **H9** a key failure after the record exists is 500 `assistant-key-failed`, and the record stays. **H11** every answer keeps `success` and `message` for the legacy pages, and adds a `code`. **D3** no `createSingleCustomerRelay` on the path. **D4** the API docs name the codes and the fields. **D1** AuthContext keeps both fields in both places. **D2** the tab and the route. Amendment 2: **H13** the 200 also carries the legacy pages' `pubkey`, `status` and `relayPubkey`, and no `directory`. **H14** the 200 never carries a private key, new or kept. **H15** anything unexpected is 500 `sign-up-failed`, with `success` and `message`, and creates nothing. **D5** the API docs' sign-up 200 lists the three legacy fields. **D6** the status handler reads no `session.userPubkey`, and is still exported. **S5** the default-wired status handler gives a signed-in non-owner 403, not 401. | unit |
| Look (story 1 AC-6, same page) | **B8** at 375 and 1280 px, in Light and Dark (the stored choice beating the computer's): no sideways scroll, the light canvas in Light, and WCAG AA for every line of the may-sign-up, deactivated and failed states, the failure line included. | browser |
| Regression | **C3** story 1's rows first. **G7** the admin list's rule and words, and admins still change other settings. **K3** owner, admin and customer answers unchanged. Story 1's suites pass unchanged on the oracle (19/19 Node, 23/23 browser). | unit; browser |

## Edge cases

- [x] **Switch values that are almost true** (`"true"`, `1`) read as closed in the handler and in the
      classification (H1, K1, C2).
- [x] **An owner-only key mixed into a larger patch** is still refused (G3).
- [x] **Reset by a leaf path** (`signUp.open`) as well as the key (G4).
- [x] **A deactivated customer who kept an Assistant** is "done" (C3), and one who didn't is never offered
      sign-up, even while it's open (C1, B6).
- [x] **A guest who already holds a key** keeps it (H10).
- [x] **Concurrency:** two tabs (H7), a race reported by the store (H8), and the store itself (H12).
- [x] **Failure after a partial success** (record created, key failed) is recoverable (H9).
- [x] **A session with the old `userPubkey` field** never counts as signed in, and never as the owner (S3, S5).
- [x] **An admin's click on a disabled switch** sends nothing (B10). **A refused owner save** reverts (B11).
- [ ] **A live run** against a real stack, with a real owner flipping the switch and a real guest signing up,
      isn't covered. The settings guard runs the real checks in a child process, and the handler runs
      against a real customer store on a temp folder. Neither runs against a server.

## Test infrastructure

- **Runners:** Node (`test/registry.js`) and Playwright. Results are read per [Running and reading the
  test gate](../../README.md#running-and-reading-the-test-gate).
- **No stack and no firmware.** Every file the Node suite writes is under the OS temp folder (temp conf,
  settings and customers folder). Nothing publishes or signs, and no key is generated.
- **Fixtures:** 64-hex fixture keys only.
- **On the Mac Studio:** never the full `npm test`, and :7778 is a private instance. Run suites one at a
  time through `require(…).run()`, and serve builds from a preview with no `/api` proxy.

## How to run

```
node test/setup-open-sign-up.test.js
```

Browser, as story 1's plan describes (a proxy-free preview of the built UI, a config with no globalSetup):

```
BRAINSTORM_BASE_URL=http://localhost:4174 BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test --config <that config> setup-open-sign-up.spec.js
```

## Verification

Confirmed 2026-11-05 on `feat/setup-create-account` at `ae3682126`, plus this commit's tests.

**Node, against the current code: 26 fail, each for the missing feature.** Five pass: the regressions C3,
G7 and K3, and the "allowed" halves of the guard, G2 and G5, which pass today only because nothing
guards `signUp`. They pair with G3 and G4.

```
FAIL C1, C2   expected "deactivated" / "may-sign-up", got "guest"
FAIL C4       missing from createAccountCopy.js: the six strings
FAIL G1       defaults.json must hold "signUp": { "open": false }; it holds signUp = undefined
FAIL G3, G4   an admin changing signUp must get 403; got 200
FAIL G6       bad-string: expected 400; got 200
FAIL A1       the route must resolve to 'signed-in'; got "owner"
FAIL H1–H11   signUpNewCustomer.js must export createSignUpHandler(deps); exports: ["handleSignUpNewCustomer"]
FAIL H12      same pubkey: expected one created and one "already exists"; got ["created","created"]
FAIL K1, K2   expected signUpOpen / customerStatus; got the answer without them
FAIL D1–D4    AuthContext / Settings tab / createSingleCustomerRelay / openapi
setup-open-sign-up: 5 passed, 26 failed
```

H12 fails on today's code because of the bug itself: two concurrent creates for one pubkey both succeed.

**Browser, against a build of the current UI** (proxy-free preview): 12 failed, 1 passed. B0 lacks the
sign-up line. B2–B8 can't find "Sign up" or the deactivated line. B9–B11 can't find the Accounts tab or
the switch. B1 passes, correctly: it's the closed state, which is story 1's behaviour.

**Proof the tests can pass, and that they bite.** I wrote a throwaway implementation of ADR 0002 with
Amendment 1 in a scratch mirror.

- **Node: 31 of 31 pass**, and story 1's suite 19 of 19. Mutations, each caught:

  | Mutation | Caught by |
  |---|---|
  | guard on update only | G4 |
  | the classification reads the switch loosely | K1 |
  | the key before the customer | H5, H8, H9 |
  | one refusal for every existing customer | H4, H8 |
  | no re-read after a race | H7, H8 |
  | no read under the lock (Amendment 1 removed) | H7, H12 |
  | validation off | G6 |

- **Browser: 13 of 13 pass**, and story 1's spec 23 of 23. Mutations, each rebuilt and caught:

  | Mutation | Caught by |
  |---|---|
  | no `refreshUser` | B3, B4 |
  | the deactivated owner not linked | B6 ×2 |
  | sign-up checked before deactivated | B6, B7, B8 |
  | an admin may toggle | B10 |
  | the wrong save shape | B9 |
  | a 409 treated as a failure | B4 |
  | an optimistic switch that keeps its own state | B11 |

- **Neighbours:** 35 suites that touch settings, the route table, the classification or the customer store
  (screened for live writes; 37 others were left out) gave identical results, with no failures, in this
  checkout and in a full worktree with the oracle's 14 files applied.

**What the oracle found.** H7 failed on the first oracle: both concurrent sign-ups answered 200, and one
record was lost. The cause is `CustomerManager`'s per-instance cache, read under the lock. Hence ADR 0002
Amendment 1, H12, and ledger row `2026-11-05-customer-manager-stale-cache-writes` for the other writers.

## Amendment 2 (after the first review, 2026-11-05)

The first review found that nobody can deactivate a customer from the app (AC-4): the status handler read
`session.userPubkey`, which no login has set since `37a31e247`. ADR 0002 Amendment 2 fixes the handler, puts the legacy
pages' fields back in the sign-up 200, and asks for tests of two answers no test reached. Ten tests were added to the
Node suite: **S1–S5**, **H13–H15**, **D5** and **D6**. No browser test changes: nothing the page or the Settings tab
shows changes.

**Against the current code (`376bf6596`): 8 fail, each for the missing piece.**

```
FAIL H13      the legacy pages show "Unknown" without these fields: pubkey, status, relayPubkey
FAIL S1–S4    changeCustomerStatus.js must export createChangeCustomerStatusHandler(deps)
FAIL S5       a signed-in non-owner must reach the owner check (403); got 401 "Authentication required"
FAIL D5       the sign-up section's 200 schema must list: pubkey, status, relayPubkey
FAIL D6       changeCustomerStatus.js must identify the caller by session.pubkey, not session.userPubkey
setup-open-sign-up: 33 passed, 8 failed
```

**H14 and H15 pass on the current code, as intended:** they guard behaviour that was already right (no private key in
the 200; the catch-all's code). The mutations below show they bite.

**Proof the tests can pass, and that they bite.** A throwaway implementation of Amendment 2 in a scratch copy of the
repo: **41 of 41 pass**, and story 1's suite 19 of 19. Each mutation was caught:

| Mutation | Caught by |
|---|---|
| the old `userPubkey` read kept as a fallback | S3, S5, D6 |
| no `authenticated === true` check | S3 |
| owner only (admins dropped) | S2 |
| no `relayPubkey` in the 200 | H13 |
| the key object spread into the 200 | H13, H14 |
| the catch-all without its code | H15 |

**Neighbours:** the 14 suites that read the API docs, the sign-up handler or the customers routes (screened for live
writes; none matched) gave identical results in this checkout and in the scratch copy with the fix.

**Not covered:** the legacy manage-customer page itself, in a browser. It reads `success`, `message` and `error`, which
Amendment 2 leaves as they were; S1 checks `success` and `message` on the handler's answer.
