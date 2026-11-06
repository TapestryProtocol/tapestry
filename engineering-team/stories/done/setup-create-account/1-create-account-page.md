# Story 1: The Create your account page

**Status:** Done
**Created:** 2026-11-04
**Type:** Feature
**Epic:** `setup-create-account`
**Book:** `engineering-team/audits/setup-create-account/book.md`

## Background

`/setup` lists three steps, and since book `setup-status-and-alert` it shows whether the signed-in
viewer has done each one. Step 1, "Create your account", is done once this instance holds a Tapestry
Assistant for the viewer (setup-status-and-alert #1 § The rules, unchanged here). But the page behind
the step, `/setup/create-account`, is still the placeholder from setup-page-scaffold #1. It says only
"Placeholder page." and what the page will one day do. Nobody can act on the step from there.

This story builds that page, as ngit issue `94229587` asks. It tells each visitor where they stand on
step 1 and offers the one thing they can do about it. Today an Assistant can be created only from the
Edit Assistant Profile page, which few people reach while setting up.

Who can get an Assistant here today:

- **The owner** always has one: the instance's own Tapestry Assistant, made when the instance is first
  set up. It cannot be made again from a page.
- **An admin, or an active customer,** may create one of their own, once.
- **A guest** (signed in, but not the owner, an admin or an active customer; an inactive customer
  counts as a guest) cannot. Nor can a guest become a customer by themselves: only the owner or an
  admin can add one. Story 2 adds the owner's choice to open sign-up to guests. Until then, and
  whenever it is off, the page tells a guest to ask the owner.

## User-facing description

As someone setting up my account on a Tapestry instance, I want the Create your account step to tell
me whether I have a Tapestry Assistant here and let me create one when I'm allowed to, so that I can
finish the step without hunting for the right page.

## The page's states (decided at planning, 2026-11-04)

| Visitor | What the page shows |
|---|---|
| Sign-in still resolving | a short checking line, and nothing else yet |
| Signed out | what an account here is, and a sign-in button |
| Signed in, holds an Assistant (any role) | the step is done, and who the Assistant is |
| Admin or active customer, no Assistant | one button that creates it, then the profile editor |
| Guest, no Assistant | what it takes to get an account here, naming the owner to ask |
| Owner whose Assistant key is missing | that the key can't be created here and must be restored on the server |

## Acceptance criteria

- [ ] **AC-1: signed out.** Given a visitor who is not signed in, when they open `/setup/create-account`:
  - they see the step's heading, the back link to `/setup`, the § Copy lines saying what an account
    here is, and a "Sign in with nostr" button that starts the same sign-in as the top bar's;
  - once they sign in, the page shows their own state without a reload.
- [ ] **AC-2: already done.** Given a signed-in viewer for whom this instance holds an Assistant,
      whatever their role (the owner, an admin, a customer, or a guest who kept one), when they open
      the page:
  - it shows the step as done, with the done sentence and the same done look `/setup` uses;
  - it shows the Assistant: its name when it has a profile, its npub in full, and a link to its
    profile page on this instance;
  - when the Assistant has no profile yet, it says so, with a link to the Edit Assistant Profile page;
  - it links to the Assistant hub (`/assistant`) for the rest;
  - no button creates anything.
- [ ] **AC-3: create it.** Given a signed-in admin or active customer with no Assistant here, when they
      open the page, they see one "Create my Tapestry Assistant" button. When they press it:
  - while it works, the button says so and cannot be pressed again;
  - on success, exactly one Assistant is created for them, and they land on the Edit Assistant
    Profile page, which shows the new Assistant's profile form;
  - from then on, `/setup` shows step 1 done and the Setup Alert counts one step fewer, without a
    reload;
  - on failure, the page says it couldn't be created and why, nothing is created, and the button can
    be pressed again;
  - pressing it from two tabs at once still leaves them with exactly one Assistant.
- [ ] **AC-4: can't create it here.** Given a signed-in viewer with no Assistant who may not create
      one, no button is offered, and:
  - a guest is told this instance gives accounts to its owner, its admins and its customers, and to
    ask the owner to become a customer. The owner is named (their profile name, or their npub when
    they have no profile) and linked to their profile page on this instance;
  - the owner, whose Assistant key is missing, is told it is created when the instance is first set up,
    can't be created from this page, and has to be restored on the server.
- [ ] **AC-5: nothing happens by opening it.** Given anyone opening the page, nothing is created,
      signed, stored or published until an admin or customer presses the AC-3 button. Every request
      the page makes before that only reads.
- [ ] **AC-6: how it looks.** The page follows the viewer's Light, Dark or System appearance like the
      other setup pages, and at 375 px wide every state reads without horizontal scrolling.

## Copy

New strings, for approval with this story. The heading, the back link and the step's sentence are the
approved copy of setup-page-scaffold #1, unchanged. "Edit profile page" means the existing Edit
Assistant Profile page.

| Where | Text | Source |
|---|---|---|
| Sign-in resolving | Checking sign-in… | the Edit Assistant Profile page's |
| Signed out, line 1 | Your account comes with your own Tapestry Assistant: a nostr identity this instance holds for you, which signs and publishes on your behalf. | step 1's approved sentence |
| Signed out, line 2 | Sign in to see your account here, or to create it. | new |
| Signed out, button | Sign in with nostr | the top bar's, verbatim |
| Done badge, done sentence | Done · This instance holds your Tapestry Assistant. | setup-status-and-alert #1 |
| Done, the Assistant | Your Tapestry Assistant: {name}, then its npub | new; "{name}" is left out when it has no profile |
| Done, profile link | View its profile | new |
| Done, no profile yet | It has no profile yet. Set up its profile | new; "Set up its profile" links to the Edit profile page |
| Done, hub link | Manage your Assistant | new |
| May create, line | You don't have a Tapestry Assistant on this instance yet. Create one, and this instance will hold its key for you. | new |
| May create, button | Create my Tapestry Assistant | new; the Edit profile page's button says "Create my Tapestry Assistant key" |
| May create, working | Creating… | the Edit profile page's |
| May create, failed | Your Tapestry Assistant couldn't be created: {reason} | new |
| Guest, line 1 | You don't have a Tapestry Assistant on this instance. This instance sets one up for its owner, its admins and its customers. | adapted from the Edit profile page's |
| Guest, line 2 | To become a customer here, ask the owner of this instance: {owner}. | new; "{owner}" is the owner's name or npub, linked to their profile |
| Owner, key missing | This instance's Tapestry Assistant key is missing. It is created when the instance is first set up and can't be created from this page; it has to be restored on the server. | the Edit profile page's, minus its last clause |

## Concepts touched

None changed. Named for orientation; the Architect resolves the handles (`<TA>` is this instance's TA
pubkey, AGENTS.md §1):

- `39998:<TA>:tapestry-assistant`: what the step creates and shows
- `39998:<TA>:nostr-user`: the viewer, and the owner a guest is told to ask
- a customer of this instance: a role, not a graph concept as far as planning knows

## Out of scope

- **Open sign-up** for guests, and the owner's switch for it: story 2.
- **What makes step 1 done.** setup-status-and-alert #1's rule stands: this instance holds an Assistant
  for the viewer. Whether it has a profile is still not part of `/setup`.
- **The Assistant's profile itself:** editing it stays on the Edit Assistant Profile page, unchanged.
- **The `/setup` checklist.** Its step 1 card is unchanged: a link here while not done, and not a link
  once done.
- **Steps 2 and 3's pages** (ngit issues `98821708` and `64a5f7bf`), which stay placeholders.
- **Naming admins** to a guest, as well as the owner.
- **Brainstorm's own account flow** (sign-up, email or custodial login): Loom block G3.

## Open questions

None. The owner answered them at planning (2026-11-04); book § Decisions records the answers.

## Deviations

Small judgment calls made during implementation (Implementer role, step 9):

- **Which existing classes (ADR Amendment 1).**
  - The cards are `bss-card` with `bs-assistant-note` lines, as on the Edit Assistant Profile page.
    The placeholder's `bs-setup-placeholder` has a dashed border, which reads as "not built yet".
  - The buttons are `/setup`'s `bs-link-btn`.
  - The failure line is `bs-error`, the search page's error box. Its rule reads the `--bsp-danger`
    tokens. Now that this page uses it, the appearance suite's T2 (tokens) and K1 (Light contrast)
    cover it. The browser class doesn't sweep the failure line's colours: B14 checks the page at rest,
    and B9 checks only its words.
  - Links are plain: the base `a` rule already reads `--bsp-accent`.
- **The offline reason.** When the request never reaches the server, the reason is the browser's own
  message ("Failed to fetch"). Only if that is empty does the page say "the request did not reach the
  server". The story's copy has `{reason}` and no fixed wording for this case.
- **The two profile hooks are called inside the done state, not by the page.** `useProfiles` and
  `useAssistantSetupState` run in `Done` (`CreateAccount.jsx:64-65`), where the ADR's Implementation notes say
  the page calls them unconditionally. The hook rules hold either way, and only a viewer who holds an Assistant
  sends those reads. (Review note 5.)
- **A name of only spaces counts as no name.** Both the Assistant's and the owner's display names are
  trimmed, and a blank one falls back to no name (the Assistant) or the npub (the owner).

## Linked artifacts

- Issue: ngit `94229587` ("/setup step 1, "Create your account": build the page (today a placeholder)")
- ADR: `engineering-team/decisions/setup-create-account/0001-a-page-from-sign-in-and-one-assistant-per-person.md`
- Test plan: `engineering-team/stories/setup-create-account/1-create-account-page.test-plan.md`
- Review: `engineering-team/reviews/setup-create-account/1-create-account-page.md`
