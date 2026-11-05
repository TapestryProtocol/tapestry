# Test Plan: Story 1 — The Create your account page

**Story:** `engineering-team/stories/setup-create-account/1-create-account-page.md`
**ADR:** `engineering-team/decisions/setup-create-account/0001-a-page-from-sign-in-and-one-assistant-per-person.md`
(with Amendment 1, proposed at this gate)
**Date:** 2026-11-04

The work touches two new files and three existing ones:

- **`test/setup-create-account.test.js`** (new) is the Node suite, registered in `test/registry.js`. It
  has four classes:

  | Class | What it tests | How |
  |---|---|---|
  | **C** | the page's state rule and its copy | `createAccountState.js` and `createAccountCopy.js`, loaded in Node as ESM |
  | **U** | one check-and-store at a time per pubkey | `provisionAssistantKeyOnce` with fake deps; no key store, no disk |
  | **S** | the route goes through the lock | source sentinels on `src/api/assistant/index.js` |
  | **D** | the JSX wiring this runner can't execute | source sentinels on App.jsx, Placeholders.jsx, the page, the rule, the copy |

- **`tests/brainstorm/setup-create-account.spec.js`** (new) is the Playwright **B** class: what a
  visitor sees, and what the page sends, against the built UI. Every `/api` route is mocked and
  WebSockets are closed.
- **Re-aims in the appearance book's suites** (Amendment 1):
  - `test/appearance-setting-working.test.js`: `pages/setup/CreateAccount.jsx` joins `WORKING_FILES`.
    T2, T3, K1, I1 and I4 then guard the new page's classes and inline styles. The browser spec's W8
    walks the same list.
  - `tests/brainstorm/appearance-setting-working.spec.js`: W3 (Dark unchanged, a snapshot) leaves out
    `/setup/create-account`. Its baseline recorded the placeholder, which this story replaces. B14
    checks the new page's Dark instead, and W1 and W5 still sweep it in Light.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| **States table** | **C1**: one exported rule, and it's pure. **C2**: the ten rows of ADR § Decision 1. **C3**: the order (holding an Assistant wins over the role; the owner is never offered provisioning). **C4**: an unknown or missing classification is a guest. **B3**: "Checking sign-in…" while sign-in resolves, and no other state flashes (sampled every 100 ms with the answer held). | both | unit; browser |
| **AC-1** signed out | **B1**: heading, back link to `/setup`, step 1's approved sentence, line 2, "Sign in with nostr", no placeholder, no button. **B2**: the page's own button runs the real sign-in (fake NIP-07 signer) and shows the visitor's own state, with no reload. | spec | browser |
| **AC-2** done | **B4** ×4 (owner/TA, admin, customer, a guest who kept one): the "Done: " prefix, the "Done" badge, the done sentence, the name (`display_name` first), the full npub, "View its profile" → `/user/<hex>`, "Manage your Assistant" → `/assistant`, no button, and the done sentence not a link. **B5**: the ✓ marker and the "Done" badge paint exactly as on `/setup`. **B6**: no profile yet → the line and "Set up its profile" → the editor, with no name and no "undefined". A failed profile check → never "no profile", and the Assistant still shown. | spec | browser |
| **AC-3** create | **B7** (admin): "Creating…" and disabled while held, a second click sends nothing, one POST, lands on `/assistant/profile/edit`, no reload, classification re-read, the Setup Alert says "2 steps left". Back on the page it's done with the new npub, and in-app `/setup` shows step 1 done. **B7** (customer): the same button, on to the editor. **B8**: a 409 (another tab won) goes on to the editor, no error ever shows, and Back shows done. **B9**: a 500 shows "…couldn't be created: disk full" in `role="alert"` with the button again; then offline, a reason; then a retry works. **U1–U7**: the lock itself (below). | both | browser; unit |
| **AC-3** two tabs | **U3**: two concurrent calls → one key stored, and the second answer names it. **U4**: five → one. **U5**: per pubkey (another person never waits). **U6**: a failed store rejects, stores nothing and releases the lock. **U7**: a failed first call doesn't poison the queued second. **U1**, **U2**: create, and exists. **S1**: the route stores only through the lock. **S2**: the route's 409 and 403 bodies are unchanged (a regression). | `setup-create-account.test.js` | unit |
| **AC-4** can't create | **B10** ×3: a guest gets the line, and the owner named by profile (linked to `/user/<hex>`), or by full npub when they have no profile, or no name and no link when the owner is unknown. No button and no "Sign up" either way. **B11**: an owner whose key is missing gets the restore-on-the-server line, no button and no guest line. | spec | browser |
| **AC-5** read-only | **B12**: in all six states, after the state's finished evidence shows, no request other than GET/HEAD (Cypher reads aside) and no create request. | spec | browser |
| **AC-6** look | **B13**: 375 px in all six states with long names, plus the inline owner npub, and no sideways scroll. **B14** Light and Dark (the stored choice beats the computer's): the light canvas in Light, a dark canvas in Dark, and every line in `main` at 4.5:1 (links, paragraphs) or 3:1 elsewhere, across seven states. **Appearance re-aims:** T2, T3, K1, I1, I4 and W8 guard the page's classes and inline styles; W1 and W5 sweep it in Light. | both | browser; unit |
| ADR structure | **C5**: every new string of § Copy, word for word. **D1**: App.jsx imports from the new page, and steps 2 and 3 stay placeholders. **D2**: Placeholders.jsx exports only those two. **D3**: the page uses the rule and provision-key, and never `/api/setup/status`. **D4**: the rule imports `mayCreateAssistant` and names no role. **D5**: the copy imports step 1's approved strings, without restating them. | `setup-create-account.test.js` | unit |
| Regression | `setup-status.test.js` **R1** (step copy, `placeholder` included) and **R2** (the route line) are unchanged and still pass. **S2**. The appearance suite's T1 (no new unscoped CSS) holds the line Amendment 1 draws. | `setup-status.test.js`; appearance | unit |

## Edge cases

- [x] **A guest who kept an Assistant** (an inactive customer) is done (C2, C3, B4).
- [x] **An owner with a key** is done; **an owner without one** is never offered provisioning (C2, C3, B11).
- [x] **A stale user while sign-in re-resolves** shows "checking", not their old state (C2).
- [x] **An unknown classification** (`undefined`, `null`, `''`, `unauthenticated`, a typo) is a guest (C4).
- [x] **Concurrent calls:** two, five, two people at once, a failure mid-queue (U3–U7). Two tabs at the page level: the 409 path (B8).
- [x] **A double click while working** sends one request (B7).
- [x] **Network failure** (aborted request), not only an error answer (B9).
- [x] **No profile, a failed profile lookup, and an unknown owner** never print "undefined" or "null" (B6, B10).
- [x] **The longest unbroken strings,** the npubs, fit at 375 px (B13).
- [x] **Light chosen on a dark computer, and Dark on a light one** (B14).
- [x] **For colour checks:** exempt elements, not containers (a disabled control and its text); measured
      at rest, after the state's evidence shows (template note, 2026-11-01).
- [ ] **A live session** (a real admin on a scratch stack) is not covered: the server's role checks are
      unchanged, and the route's new part is covered stack-free through U1–U7 and S1. The browser class
      mocks the server.

## Test infrastructure

- **Runners:** Node's built-in (`test/registry.js` via `npm test`) and Playwright. Read a run's result
  per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
- **No live stack and no firmware precondition.** No concept is touched. The Node suite is
  stack-free. Nothing in either new file publishes, signs, writes a key or reaches :7778.
- **Fixtures:** 64-hex fixture keys only (`a1…`, `a2…`, `a3…`, `ee…`, `bb…`). In the U class, fake key
  material with `nsec-fixture-N`.
- **On the Mac Studio:** never run the full `npm test` (live suites publish fixtures), and container
  `tapestry` on :7778 is a private agent-memory instance. Run single suites through `require(…).run()`,
  with `BRAINSTORM_BASE_URL=http://127.0.0.1:9` for any suite that has an H class. Serve the build from
  a preview with **no `/api` proxy** (below), so that a missed mock can't reach :7778.

## How to run

```
node test/setup-create-account.test.js
```

The suite has a `require.main` block. Neighbours, one by one:

```
BRAINSTORM_BASE_URL=http://127.0.0.1:9 node -e "const m=require('./test/setup-status.test.js');m.run().then(r=>process.exit(r.fail?1:0))"
node -e "const m=require('./test/appearance-setting-working.test.js');m.run().then(r=>process.exit(r.fail?1:0))"
```

For the browser class:

1. Build: `cd ui && npm run build` (output in `dist/`).
2. Serve it **without the `/api` proxy**: `vite preview --config <a config with no proxy> --outDir <dist> --port 4174`.
3. Run Playwright from a config with no `globalSetup`, so the setup's unmocked page load never touches
   a live stack:

```
BRAINSTORM_BASE_URL=http://localhost:4174 BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test --config <that config> setup-create-account.spec.js
```

`npm run test:playwright` works too, where `:7778` is a dev stack that may be read.

## Verification

Confirmed 2026-11-04 on `feat/setup-create-account` at `c7a10a63f`, plus this commit's tests.

**Node suite, against the current code: 18 fail, for the right reasons.** The one pass is S2, a
regression.

```
FAIL C1–C4  createAccountState.js must exist and load in Node as ESM … Cannot find module …/createAccountState.js
FAIL C5     createAccountCopy.js must exist and load in Node as ESM … Cannot find module …/createAccountCopy.js
FAIL U1–U7  src/api/assistant/index.js must export provisionAssistantKeyOnce(pubkey, deps) (ADR 0001 § Decision 4)
FAIL S1     handleProvisionAssistantKey must call provisionAssistantKeyOnce, so the route is covered by the per-pubkey lock
PASS S2     the route's answers are unchanged — 409 … when a key exists
FAIL D1     App.jsx must import { SetupCreateAccount } from './pages/setup/CreateAccount'
FAIL D2     Placeholders.jsx must no longer export SetupCreateAccount
FAIL D3     ui/src/pages/setup/CreateAccount.jsx must exist
FAIL D4, D5 …createAccountState.js / createAccountCopy.js must exist
setup-create-account: 1 passed, 18 failed
```

**Neighbours, against the current code:**

- `setup-status`: 38 passed, 0 failed, 2 skipped. R1 and R2 pass; the H class skipped on purpose (dead
  port).
- `appearance-setting-working`: 9 passed, 5 failed. T2, T3, K1, I1 and I4 fail with `ENOENT … CreateAccount.jsx`,
  as the re-aim intends, and T1 passes.
- `stack-free-npm-test`: G5 passes (the new suite is registered).

**Browser class, against a build of the current UI** (proxy-free preview on :4174): **23 failed, 0
passed.**

- B0: the bundle lacks "Sign in to see your account here, or to create it."
- Every other test: the h1 loaded, then its state's evidence was missing (the placeholder).
- B5's `/setup` half passed before it failed on the new page.

**Proof the tests can pass, and that they bite.** I built a throwaway implementation of ADR 0001 with
Amendment 1 outside the repo (the test-design-oracle recipe), reusing only existing classes.

- **Node: 19 of 19 pass.** Mutations, each caught by the tests that guard it:

  | Mutation | Caught by |
  |---|---|
  | no lock | U3, U4 |
  | one lock for all pubkeys | U5 |
  | a failed store poisons the queue | U7 |
  | role checked before the Assistant | C2 |
  | no owner check | C2 |

- **Browser: 23 of 23 pass.** Ten mutations, each rebuilt and rerun:

  | Mutation | Caught by |
  |---|---|
  | no `refreshUser` | B7, B8 |
  | button pressable while working | B7 |
  | 409 treated as a failure | B8 |
  | owner named but not linked | B10 ×2, B13 |
  | a failed check read as "no profile" | B6 |
  | npub not wrapping | B13 |
  | a literal dark colour | B14 Dark |
  | the signed-out line while checking | B3 |
  | the done sentence as a link | B4 ×4, B14 Dark |
  | a POST on open | B12 |

  The clean oracle rebuilt passes 23 of 23.
- **The appearance re-aims, on the oracle's source:** W8, W1 (`/setup/create-account`) and W5 (375 and
  414 px) pass. T2–T5, K1, I1 and I4 pass. T1 can't run in the mirror, which has no git history; it
  passes in the repo, and Amendment 1 leaves `styles.css` unchanged.
- **One run left unproven, the full `appearance-setting-working.spec.js`:**
  - against both builds, 51 passed and 1 failed (W8). W8 walks the repo's source, where the page doesn't
    exist yet, so this is the re-aim working;
  - W3 without `/setup/create-account` passes on both builds.
