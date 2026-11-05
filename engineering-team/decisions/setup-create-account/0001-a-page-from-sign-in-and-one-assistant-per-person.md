# ADR 0001: The Create your account page, read from sign-in, and one Assistant per person

**Status:** Accepted
**Date:** 2026-11-04
**Story:** `engineering-team/stories/setup-create-account/1-create-account-page.md`

## Context

Story 1 replaces the `/setup/create-account` placeholder with a page that has one state for each kind
of visitor (story § The page's states). Its acceptance criteria, restated:

- **AC-1:** signed out → what an account here is, and the top bar's sign-in.
- **AC-2:** holds an Assistant, whatever the role → done, with the Assistant's name, full npub, a profile
  link, a "no profile yet" link when it has none, and a hub link. No create button.
- **AC-3:** an admin or an active customer with no Assistant → one button. Once pressed it can't be
  pressed again while it works; on success there is exactly one Assistant and the person lands on the
  Edit Assistant Profile page, with `/setup` and the Setup Alert updated and no reload. On failure the
  page says why and the button can be pressed again. Two tabs still make one Assistant.
- **AC-4:** a guest → ask the owner, named and linked. An owner with no Assistant key → it must be
  restored on the server. No button.
- **AC-5:** nothing is written until the AC-3 press.
- **AC-6:** Light, Dark and System appearance, and 375 px wide.

**What exists (read at `staging` `3eed1b8e`):**

- **The placeholder.** `SetupCreateAccount` (`ui/src/pages/setup/Placeholders.jsx:29-31`) is routed at
  `ui/src/App.jsx:278-281`, imported at `:121`. Its words are `CREATE_ACCOUNT_STEP`
  (`ui/src/pages/setup/steps.js:15-22`): `label`, `text`, `doneText`, and the `placeholder` sentence.
  `SETUP_COPY` (`:44-51`) holds "Sign in with nostr", "Done" and "Done: ".
- **Who the viewer is.** `AuthContext` keeps `user = { pubkey, classification, assistantPubkey, … }`
  (`ui/src/context/AuthContext.jsx:66-69`) from `/api/auth/user-classification`. `classification` is
  `owner`, `admin`, `customer` (active only) or `guest`, so an inactive customer is a `guest`
  (`src/api/auth/getUserClassification.js:31-78`). `assistantPubkey` comes from
  `getAssistantPubkeyFor`, the same helper `/api/setup/status` uses for step 1
  (`src/api/setup/status.js:262`), so the page and `/setup` can't disagree about "done". `login()` is
  the top bar's sign-in (`:149`). `refreshUser()` re-reads classification and Assistant (`:163-167`).
- **Who may create one.** `mayCreateAssistant(user)` is admin or customer
  (`ui/src/config/avatarMenuLinks.js:77-79`). It is `provision-key`'s rule less the Owner, whose
  Assistant is the instance TA (ADR `assistant-profile/0004`).
- **The shared setup status re-asks when an Assistant appears.** Its request key includes
  `user.assistantPubkey` (`ui/src/context/SetupStatusContext.jsx:35`), so calling `refreshUser()` after
  creating one updates `/setup` and the Setup Alert with no reload. That is how the Edit Assistant
  Profile page already does it (ADR `setup-status-and-alert/0002` Decision 5).
- **Profiles.** `useAssistantSetupState()` gives `set-up` / `needs-setup` / `unknown` for the viewer's
  own Assistant, from the read-only `GET /api/assistant/status?…&defaults=0`
  (`ui/src/hooks/useAssistantSetupState.js:23-66`). `useProfiles(pubkeys)` gives kind 0 content
  (`ui/src/hooks/useProfiles.js`). `useConfig()` gives `ownerPubkey` and `ownerProfile`
  (`ui/src/context/ConfigContext.jsx:10-38`, from `GET /api/owner/pubkey`, which reads
  `BRAINSTORM_OWNER_PUBKEY`).
- **Creating one.** `POST /api/assistant/provision-key` (`src/api/assistant/index.js:483-539`) admits
  the owner, an admin or an active customer, and returns 409 when a key exists. But it checks at `:510`
  and stores at `:526-527`, with two `await`s between. `storeToEncryptedFile` overwrites with
  `fs.writeFileSync` (`src/utils/secureKeyStorage.js:296-301`). So two calls at once can both pass the
  check. The second write replaces the first key, and the first caller was told about a key that no
  longer exists. The control panel is one Node process (`docker/entrypoint.sh:275`,
  `exec node …/bin/control-panel.js`).
- **The Edit Assistant Profile page** is the editor's one host (ADR `assistant-profile/0004`). It is
  `MY_ASSISTANT_PATH` = `/assistant/profile/edit` (`avatarMenuLinks.js:48`). The hub is
  `ASSISTANT_MANAGEMENT_PATH` = `/assistant` (`:39`). A person's profile page is `/user/:pubkey`
  (`App.jsx:169`).
- **The look.** `/setup`'s done row is `.bs-setup-step.is-done` with `.bs-setup-step-marker.is-done`
  and `.bs-setup-step-badge.is-done` (`ui/src/pages/setup/Index.jsx:36-50`; `ui/src/styles.css:8667-8841`).
  The setup styles use `--bsp-*` tokens, which the appearance setting switches (book
  `appearance-setting`).
- **Tests that pin today's shape.** `test/setup-status.test.js` R1 (`:778-805`) pins every
  `CREATE_ACCOUNT_STEP` field byte for byte, `placeholder` included. R2 (`:807-813`) pins App.jsx's
  route line `path: '/setup/create-account', element: <SetupCreateAccount />`.

**Concepts.** None change. The story names `39998:<TA>:tapestry-assistant` and `39998:<TA>:nostr-user`
for orientation only. I didn't query the local graph: the container on :7778 on this machine is a
private agent-memory instance, not the dev stack. Treat both handles as slug-constructed, to re-verify
against a dev stack if a later story touches them.

## Options considered

### Option A — A new page built from sign-in and config, plus a per-person lock on provisioning

A new `SetupCreateAccount` page derives its state from `useAuth()` alone: loading, signed out, has an
Assistant, owner, may create, guest. It reads names from the profile hooks and config. It calls
`provision-key` itself, then `refreshUser()`, then goes to the Edit Assistant Profile page. On the
server, `provision-key`'s check-and-store runs once at a time for each pubkey.

- **Pros:** every input already exists and is already shared. The state is one pure function a test can
  call. The page and `/setup` read the same Assistant. The editor stays where ADR `assistant-profile/0004`
  put it. Story 2 adds two branches to the same function.
- **Cons:** a second client caller of `provision-key` beside the editor's `provisionKey()`
  (`AssistantProfileEditor.jsx:219-235`). About ten lines of `/setup`'s done-row markup are repeated.

### Option B — Host the Assistant profile editor on the page

The editor already has a create button and no-key states (`AssistantProfileEditor.jsx:277-326`).

- **Pros:** no new provisioning code on the client.
- **Cons:**
  - It breaks ADR `assistant-profile/0004`'s rule that the Edit Assistant Profile page is the editor's
    one host.
  - The editor's states aren't the story's: it has no signed-out state and no owner-naming guest
    message, and its guest line is different.
  - After creating, it turns into the profile form in place, while the story wants the person to land
    on the Edit Assistant Profile page.

### Option C — Make `/setup/create-account` a redirect to the Edit Assistant Profile page

- **Pros:** almost no code.
- **Cons:** it fails AC-1, AC-2 and AC-4. That page shows a different signed-out line, no done state
  with the full npub, and a guest message that names no owner.

**For two presses at once (AC-3's last bullet):**

- **(i) An in-memory lock per pubkey in the handler.** Chosen. It covers every storage backend, and
  the single process makes it sufficient.
- **(ii) An exclusive create (`flag: 'wx'`) in `storeToEncryptedFile`.** It covers only the
  encrypted-file backend, and it changes a shared write that `customerManager.js:1080` relies on to
  replace keys.
- **(iii) Disabling the button.** Needed anyway, for one tab, but it can't see another tab.

## Decision

We chose **Option A, with lock (i)**. Every piece the page needs is already a shared answer, and the
page has to agree with `/setup` and the Setup Alert, so reading those same answers beats a second path.
B and C would each re-litigate a settled ADR or fail the story.

### 1. The state is one pure function of sign-in

`createAccountState(user, authLoading)`, in `ui/src/pages/setup/createAccountState.js`, exported:

| Order | When | State |
|---|---|---|
| 1 | `authLoading` | `checking` |
| 2 | no `user` | `signed-out` |
| 3 | `user.assistantPubkey` | `done` |
| 4 | `user.classification === 'owner'` | `owner-key-missing` |
| 5 | `mayCreateAssistant(user)` | `may-create` |
| 6 | otherwise | `guest` |

The order is the decision. Holding an Assistant wins over the role, so a guest who kept one is done
(AC-2). The owner check comes before `mayCreateAssistant`, so the owner is never offered provisioning
(ADR `assistant-profile/0004` sub-decision 4). The page asks nothing of `/api/setup/status` and doesn't
wait for the shared status's relay reads: step 1's answer is already in `user`.

### 2. What each state renders

- **`checking`:** the heading, the back link, and "Checking sign-in…".
- **`signed-out`:** `CREATE_ACCOUNT_STEP.text`, the new line 2, and a `bs-link-btn` "Sign in with
  nostr" calling `login().catch(() => {})`, as `/setup` does (`Index.jsx:110`). Signing in changes
  `user`, so the page re-derives its state (AC-1's second bullet).
- **`done`:** a non-link row with `/setup`'s done classes, "Done: " for screen readers, the "Done"
  badge and `CREATE_ACCOUNT_STEP.doneText`. Below it:
  - "Your Tapestry Assistant:", then the name, when `useProfiles([pk])[pk]` has `display_name` or
    `name`. On `null` or `PROFILE_LOOKUP_FAILED` there is no name.
  - The full `nip19.npubEncode(pk)`, wrapping (`overflow-wrap: anywhere`).
  - "View its profile" → `/user/<assistantPubkey>`.
  - Only when `useAssistantSetupState().status === 'needs-setup'`: "It has no profile yet." and "Set up
    its profile" → `MY_ASSISTANT_PATH`. On `loading` or `unknown` nothing is said, because an error is
    never "no profile" (the hook's own rule).
  - "Manage your Assistant" → `ASSISTANT_MANAGEMENT_PATH`.
- **`may-create`:** the line, and one `bs-link-btn` "Create my Tapestry Assistant". See §3.
- **`guest`:** two lines. `{owner}` is a link to `/user/<ownerPubkey>`. Its text is
  `ownerProfile.display_name || ownerProfile.name`, or else the owner's full npub (wrapping). When
  `ownerPubkey` is unknown (config unanswered), line 2 ends at "…ask the owner of this instance." with
  no colon and no link. The guest branch is its own component, `GuestNoAssistant`, so that story 2 can
  give it the sign-up branch.
- **`owner-key-missing`:** the one paragraph from § Copy.

### 3. Creating the Assistant

The page holds `phase: idle | working | failed` and `reason`. Pressing the button:

1. sets `working`: the button is `disabled` and reads "Creating…";
2. sends `POST /api/assistant/provision-key` with no body;
3. on `200` with `success: true`, **or on `409`** ("already exists", because another tab won the lock):
   `await refreshUser()`, then `navigate(MY_ASSISTANT_PATH)`. This is a push, so Back returns to the
   page, which by then shows `done`. A 409 counts as success because the person now holds exactly one
   Assistant, which is what they asked for;
4. on anything else (another status, `success: false`, or a network error): sets `failed` with
   `reason` = the answer's `error`, or `HTTP <status>`, or the network error's message. Shown as
   "Your Tapestry Assistant couldn't be created: {reason}" in `role="alert"`, and the button is
   enabled again.

If `refreshUser()` itself fails, the page still navigates. The Edit Assistant Profile page reads its own
status, and the shared status re-asks on the next page load.

### 4. One check-and-store at a time for each pubkey

In `src/api/assistant/index.js`, move the existing-key check, `generateRelayKeys()` and
`storeRelayKeys()` (`:510-527`) into
`provisionAssistantKeyOnce(pubkey, deps = DEFAULT_PROVISION_DEPS)`, exported. It runs under a
module-level `Map` of pubkey → promise tail:

```js
const provisionTails = new Map();
async function underProvisionLock(pubkey, fn) {
  const run = (provisionTails.get(pubkey) || Promise.resolve()).catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  provisionTails.set(pubkey, tail);
  try { return await run; } finally { if (provisionTails.get(pubkey) === tail) provisionTails.delete(pubkey); }
}
```

`deps` is `{ getAssistantKeys, generateRelayKeys, storeRelayKeys }`. The defaults are today's calls,
which lets a test give fakes whose `getAssistantKeys` waits a tick, reproducing the interleave stack-free.

It returns `{ created: true, keys }` or `{ created: false, existing }`. The handler keeps its session
and role checks before the call, maps `created: false` to today's 409 body, and keeps its log line and
its 200 body. Status codes, bodies and the route table entry don't change.

## Consequences

**Enables**

- Every visitor can act on step 1 from step 1's own page. An admin with no Assistant no longer has to
  find the avatar menu's "My Assistant's Profile".
- **Story 2** extends `createAccountState` (a guest while sign-up is open, and a deactivated customer)
  and `GuestNoAssistant`. Its sign-up mints an Assistant key too, so it reuses
  `provisionAssistantKeyOnce`, lock and all.
- `provision-key` can no longer orphan a key, from this page, the editor or a direct call.

**Constrains, or leaves as it is**

- **"Who may create one"** is still stated by `provision-key` and by `mayCreateAssistant`. The page adds a
  caller of the second, not a third statement.
- **The editor's own `provisionKey()`** stays as it is: on a 409 it shows "Assistant key already exists
  for this user" where the new page moves on. Aligning them is optional, and not this story.
- **`CREATE_ACCOUNT_STEP.placeholder` stays in `steps.js`, unused**, so R1 keeps pinning approved copy
  unchanged. It can go when steps 2 and 3's pages retire `Placeholders.jsx`.
- **The lock holds within one process.** If the control panel ever runs as several processes, the lock
  has to become a storage-level exclusive create (option ii). A comment at the lock says so.
- **ADR `assistant-profile/0004`'s known gap is unchanged:** `provision-key` still accepts an Owner whose
  TA key is missing. The page never offers it.

**Firmware reinstall required?** No. No concept definition changes.

## Implementation notes

- **`ui/src/pages/setup/createAccountState.js` (new):** `createAccountState(user, authLoading)`, per
  § Decision 1. It imports `mayCreateAssistant` from `../../config/avatarMenuLinks`. Pure, with no React.
- **`ui/src/pages/setup/createAccountCopy.js` (new):** `CREATE_ACCOUNT_COPY`, the new strings of story 1
  § Copy, each named for its row. Strings the story reuses are imported from `steps.js`
  (`CREATE_ACCOUNT_STEP.label`, `.text`, `.doneText`; `SETUP_COPY.signInButton`, `.doneBadge`,
  `.doneSrPrefix`), not copied. The doc comment points at story 1 § Copy as the approval.
- **`ui/src/pages/setup/CreateAccount.jsx` (new):** `export function SetupCreateAccount()`. The shell is
  the placeholder's: `bsp-page`, `TopBar`, `main.bsp-content.bs-setup-main`, the `bs-setup-back` link to
  `/setup`, and `h1.bs-setup-title` with `CREATE_ACCOUNT_STEP.label`. The body follows § Decision 2–3.
  Hooks: `useAuth`, `useConfig`, `useProfiles`, `useAssistantSetupState`, `useNavigate`. Call
  `useProfiles` with `[]` when there is no pubkey to ask about, and `useAssistantSetupState`
  unconditionally (it already returns `no-assistant` without a request). `nip19` comes from
  `nostr-tools`, as `ui/src/components/AboutThisInstance.jsx:3` does.
- **`ui/src/App.jsx`:** import `SetupCreateAccount` from `./pages/setup/CreateAccount`, and take it out
  of the `./pages/setup/Placeholders` import at `:121`. Leave the route object at `:278-281` as it is, so
  R2 still matches.
- **`ui/src/pages/setup/Placeholders.jsx`:** remove `SetupCreateAccount`, and update the doc comment so
  it lists the two placeholders left.
- **`ui/src/styles.css`:** no change. Superseded by Amendment 1: the page reuses existing classes.
- **`src/api/assistant/index.js`:** `underProvisionLock` and `provisionAssistantKeyOnce`, per § Decision
  4, with `DEFAULT_PROVISION_DEPS` wrapping today's `getAssistantKeys`, `generateRelayKeys` (from
  `../../utils/customerRelayKeys`) and `new SecureKeyStorage().storeRelayKeys`. `handleProvisionAssistantKey`
  calls it, and its comment names the one-process assumption. Add `provisionAssistantKeyOnce` to
  `module.exports`.
- **Tests (Phase 3, the Tester's).** R1 and R2 are designed to pass unchanged. New coverage needs:
  - the state table;
  - the copy;
  - the page's six states and the press, in the browser lane, against the scratchpad mirror build (the
    test-design-oracle recipe);
  - the lock, stack-free, through `provisionAssistantKeyOnce` with fake deps.

  The machine's :7778 container isn't the dev stack, so any live leg runs on a scratch stack.
- **Branches.** Ordinary feature work: `staging`, then `main` by the usual promotion. It isn't a security
  fix, so no sandbox port is owed, and the lock discloses no open hole.

## Amendment 1 (Test Design, 2026-11-04): no new stylesheet rules

**Proposed by the Tester at Test Design. The owner approved it with the test plan at that gate
("Approve, go on", 2026-11-04).**

**What changed.** The Implementation notes planned "a few rules" in `ui/src/styles.css`. That conflicts
with a shipped regression check: `test/appearance-setting-working.test.js` T1 compares every unscoped
rule in `styles.css` with the appearance book's base (`34bd3957b`), and fails on any "new unscoped
declaration". It passes on `staging` today, so nothing has added such a rule since that book closed. A
new rule for this page would fail it.

**Decision.** The page adds no rule to `ui/src/styles.css`. Instead:

- **It reuses classes the setup and Assistant pages already define.** These are `.bs-setup-*` (the
  shell, the back link, the done row, the signed-out line, the card), `.bs-link-btn`, and the Assistant
  pages' note and card classes. All of them already read `--bsp-*` tokens, so Light, Dark and System
  cover the page with no new CSS.
- **Inline styles are for layout only**, such as `overflowWrap: 'anywhere'` on the npub and a gap
  between links. Any inline colour reads a `var(--bsp-…)` token, and any inline dimming reads
  `var(--bsp-opacity-soft|dim, X)`. Checks I1 and I4 enforce this.
- **`pages/setup/CreateAccount.jsx` joins `WORKING_FILES`** in that suite, in Phase 3. T2, T3, K1, I1
  and I4 then guard the page's classes and inline styles like every other working page's.

**What we trade away.** The page can't have a look of its own beyond what those classes give. If a
later design pass wants one, it has to re-aim T1 (or scope its rules under `[data-appearance]`) in
its own story. T1 freezing `styles.css` for every later story is a harness issue in its own right,
filed on OPEN.md.

## Out of scope

- **Open sign-up:** story 2's own ADR.
- **The Edit Assistant Profile page, the editor, and their 409 wording.**
- **`/setup`'s checklist and the step 1 rule** (setup-status-and-alert #1), unchanged.
- **Retiring `CREATE_ACCOUNT_STEP.placeholder`.**
- **Key lifecycle**, for an Owner whose TA key is missing (`stories/_intake.md`, 2026-08-10).
