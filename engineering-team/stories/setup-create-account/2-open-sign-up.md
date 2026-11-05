# Story 2: Open sign-up, the owner's choice

**Status:** Done
**Created:** 2026-11-04
**Type:** Feature
**Epic:** `setup-create-account`
**Book:** `engineering-team/audits/setup-create-account/book.md`
**Depends on:** `setup-create-account` #1

## Background

After story 1, a guest who opens the Create your account page is told to ask the owner, because a
guest has no way to become a customer by themselves. The owner, or an admin, adds each customer by hand
on the old customer pages.

The owner chose at planning (2026-11-04) to let an instance open sign-up to guests: a signed-in guest
makes themselves a customer, with their own Tapestry Assistant, in one step. It is the owner's choice
per instance, and it starts off. Every sign-up costs the instance something: an Assistant key it holds,
and a share of the regular runs that calculate each customer's scores. An instance like
tapestry.brainstorm.world stays closed until its owner opens it.

An old sign-up action already exists, offered by two legacy pages. Book `admin-action-owner-check` put
it on the owner's side: "owner's side unless the owner runs open sign-up; then allowlist (signed-in)"
(`engineering-team/audits/admin-action-owner-check/inventory.md`, judgment call 2). This story is that
"unless".

## User-facing description

As the owner of a Tapestry instance, I want to choose whether people who sign in can make themselves
customers here, so that I decide who uses my instance's resources.

As a guest on an instance whose owner has opened sign-up, I want to create my account in one step, so
that I can use this instance without waiting for the owner to add me.

## Acceptance criteria

- [ ] **AC-1: the switch.** Given the owner, signed in, when they open Settings, they see an "Open
      sign-up" switch, with the § Copy description of what turning it on means:
  - it is off on a new instance, and off on every existing instance until its owner turns it on;
  - only the owner can turn it on or off; anyone else who tries is refused, and the setting doesn't
    change;
  - a change survives a restart of the instance.
- [ ] **AC-2: while it's off.** Given open sign-up is off:
  - a guest on the Create your account page sees story 1's ask-the-owner message, and no sign-up
    button;
  - any request to sign up, from any page or sent directly, is refused, and no customer or Assistant
    is created.
- [ ] **AC-3: while it's on.** Given open sign-up is on, when a signed-in guest with no Assistant opens
      the Create your account page, they see the § Copy sign-up line and a "Sign up" button. When they
      press it:
  - while it works, the button says so and cannot be pressed again;
  - on success, they become an active customer of this instance, with exactly one Assistant of their
    own, and they land on the Edit Assistant Profile page, which shows the new Assistant's profile
    form;
  - from then on the app treats them as a customer without a reload: `/setup` shows step 1 done, the
    Setup Alert counts one step fewer, and the avatar menu's "My Assistant's Profile" is enabled;
  - on failure, the page says why, they are left as they were, and the button can be pressed again.
- [ ] **AC-4: the same as any customer.** Given someone who signed up themselves, the owner sees them in
      the customer list like a customer the owner added, their scores are calculated in the same
      regular runs, and the owner can deactivate them like any other customer.
- [ ] **AC-5: who can't.** Given open sign-up is on:
  - a signed-out visitor is refused, and the page offers them sign-in (story 1's AC-1) instead;
  - someone who is already a customer, an admin or the owner is refused, and nothing about them
    changes;
  - signing up twice, from two tabs at once, still leaves one customer with one Assistant;
  - a customer who was deactivated is refused, and is told to ask the owner.
- [ ] **AC-6: turning it off later.** Given open sign-up is turned off after people have signed up, the
      customers who signed up stay customers, with their Assistants, and new sign-ups are refused.

## Copy

New strings, for approval with this story.

| Where | Text |
|---|---|
| Settings, switch label | Open sign-up |
| Settings, description | Let anyone who signs in make themselves a customer here. Each new customer gets a Tapestry Assistant that this instance holds for them, and their scores are calculated in this instance's regular customer runs. |
| Create your account page, guest, line 1 | You don't have an account on this instance yet. |
| Create your account page, guest, line 2 | Sign up as a customer, and this instance will create your Tapestry Assistant and hold its key for you. |
| Button | Sign up |
| Working | Signing up… |
| Failed | You couldn't be signed up: {reason} |
| Deactivated customer | Your customer account here is inactive. To use it again, ask the owner of this instance: {owner}. ("{owner}" as in story 1) |

## Concepts touched

None changed. Named for orientation; the Architect resolves the handles:

- `39998:<TA>:tapestry-assistant`: what each new customer gets
- `39998:<TA>:nostr-user`: the guest who signs up
- a customer of this instance: a role, not a graph concept as far as planning knows

## Out of scope

- **Limits on who may sign up**, such as only people the owner's point of view trusts above some
  score, a cap on the number of customers, or a waiting list the owner approves. A trust-based limit
  fits the architecture's reflex check 2 and is the natural next step; it gets an issue of its own.
- **Removing the two legacy sign-up pages.** They follow the switch like every other way in (AC-2).
- **What a customer is.** Story 2 adds a way in, not a new kind of customer.
- **Telling the owner about new sign-ups** (a notice or a digest).
- **Brainstorm's own sign-up** and its email or custodial logins: Loom block G3.

## Open questions

None. The owner answered them at planning (2026-11-04); book § Decisions records the answers.

## Deviations

Small judgment calls made during implementation (Implementer role, step 9):

- **No `mayChangeAdminList` alias.** ADR § Implementation notes keeps it "if anything imports it". Nothing does:
  it was never exported from `settingsApi.js`. So it's renamed to `mayChangeOwnerOnlySetting`, and the per-key
  refusals live in one map, `OWNER_ONLY_REFUSALS`, whose keys are the owner-only list.
- **The validation message.** A malformed `signUp` patch answers 400 with
  `signUp must be { "open": true } or { "open": false }`. The ADR names the status and not the words.
- **Two answers the ADR's table doesn't name.**
  - The handler's own 401 (behind the middleware's) carries `success`, `message` and `error`, but no `code`, as row 1
    is the middleware's answer.
  - Anything unexpected is 500 `sign-up-failed`, so every refusal the page can meet carries a code. The API docs name
    it. Test H15 reaches it (added after the first review; H11 checks only the answers H1–H10 produce).
- **The shared press logic** is a small hook, `usePressToEditor`, in `CreateAccount.jsx`, as the ADR allows. Story 1's
  button keeps its own rules through it: any 409 counts as another tab winning, and its reason comes from `error`
  only. The sign-up button takes 409 only with `code: 'already-customer'`, and its reason from `error`, then `message`.
- **The owner's name and link** are one small component, `OwnerTail`, shared by story 1's ask-the-owner line and the
  deactivated line. `GuestNoAssistant` renders the same output as before (story 1's B10 passes unchanged).
- **The Accounts panel's copy** sits in `AccountSettings.jsx` as `ACCOUNT_SETTINGS_COPY`, beside its only user, and not
  in a copy file of its own. The checkbox is disabled while a save is out, so a double click sends one request.
- **The Accounts tab is the Settings tab bar's eighth.** That bar doesn't wrap. At 900 px and at 375 px, Accounts sits
  past the right edge and is reached by scrolling the content sideways. The overflow is older than this story
  ("Auditing Tools" already overflowed at 900 px), so it's filed and not changed here: ledger row
  `2026-11-05-settings-tab-bar-overflows`.
- **The classification reads the switch defensively.** If the settings can't be read, a guest's `signUpOpen` is `false`
  (closed), and the sign-in answer still comes back.

## Linked artifacts

- Issue: ngit `94229587` (its open question "How a guest becomes a customer on an instance, if at all")
- ADR: `engineering-team/decisions/setup-create-account/0002-open-sign-up-an-owner-only-setting.md`
- Test plan: `engineering-team/stories/setup-create-account/2-open-sign-up.test-plan.md`
- Review: `engineering-team/reviews/setup-create-account/2-open-sign-up.md`
