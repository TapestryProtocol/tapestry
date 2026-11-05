# PRD Seed: Becoming a user of a Tapestry instance — step 1 of /setup, and open sign-up

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/setup-create-account/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high for §3 and §4, which are read off shipped code; medium for §1 and §2, inferred from the frame and
the stories
**Date:** 2026-11-05

> A reverse-engineered baseline in the product-team PRD shape, built from what shipped. It is a strawman for the
> product team, not a ratified spec. Tags: `[FROM FRAME]` (the kickoff acceptance frame and its four planning answers),
> `[INFERRED]` (read off the as-built system), `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` Someone who opens `/setup` should be able to finish step 1, "Create your account", from step 1's own
page, whatever kind of visitor they are. An instance's owner decides whether strangers who sign in may make
themselves customers.

`[INFERRED]` "Account" here means having a Tapestry Assistant that this instance holds for you. Step 1 is done when the
instance holds one for the viewer (the rule from book `setup-status-and-alert`). The page is the front door for the
admin and customer roles, which existed before with no self-service way in.

`[UNKNOWN — product input needed]` Who open sign-up is for. The frame says *that* an owner can open it, not which
instances should, or what a self-signed-up customer is expected to do next.

## 2. Personas

`[INFERRED]` from the stories' "As a…" lines; behaviour-based:
- **The owner:** runs the instance and pays for every Assistant key it holds and every customer's score runs. Decides
  whether sign-up is open. May later want to know who signed up (§6).
- **An admin with no Assistant:** previously had to find "My Assistant's Profile" in the avatar menu. Now one button.
- **An active customer with no Assistant:** added by the owner, needs the key made. One button.
- **A guest:** signed in, not a customer. Either asks the named owner, or signs up in one step if the owner allows it.
- **A deactivated customer:** told to ask the owner; can't reactivate themselves.
- **A signed-out visitor:** told to sign in first.

## 3. Scope (as-built)

`[FROM FRAME]`, confirmed in the as-built system:
- `/setup/create-account` shows each visitor their state and the one action open to them. There are seven states:
  signed out, done, able to create, guest with sign-up closed, guest with sign-up open, deactivated customer, and an
  owner whose key is missing.
- One button creates the Assistant for an admin or an active customer, then opens the Edit Assistant Profile page.
- An owner-only switch, Settings › Accounts › "Open sign-up". It is off by default on every instance, and it persists.
- With the switch on, a signed-in guest signs up in one step, then lands on the Edit Assistant Profile page as an
  active customer with one Assistant.
- A self-signed-up customer is the same as an owner-added one: scores, the customer list, deactivate and reactivate.
- Turning the switch off keeps existing customers and refuses new sign-ups.

`[INFERRED]` Shipped beyond the frame:
- deactivate and reactivate work again for every customer (they had been broken since 2026-09-11);
- concurrent sign-ups can't create two records;
- key creation is serialised per person.

## 4. Domain model

`[INFERRED]` from the ADRs and stored shapes:
- **Visitor class**, from the sign-in answer: owner, admin, customer, guest, or unauthenticated. A guest's answer also
  carries whether sign-up is open (`signUpOpen`), and their customer record's status, if they have one
  (`customerStatus`).
- **Customer record**, in the instance's customer store: pubkey, name, status (`active` or `inactive`), an observer
  id, comments. A self-signed-up record is written by the same code as the owner's add, with the comment "Signed up
  through open sign-up".
- **Tapestry Assistant key:** at most one per person, held by the instance. Created by the page's button, by sign-up,
  or from the editor, always through one per-person lock.
- **Open sign-up setting:** `signUp.open`, a boolean in the instance's settings. Only the owner may change it, and an
  admin may not. Anything but exactly `true` counts as closed.
- No concept-graph definitions changed. The guest is a `nostr-user`, and what they get is a `tapestry-assistant`.

## 5. Design rules (as-built)

`[INFERRED]`
- **The page reuses existing classes and adds no CSS** (the setup shell, link buttons, Assistant cards, the error
  box). It therefore follows System/Light/Dark with no rules of its own.
- **Copy names the owner by display name, linked to their profile**, falling back to the npub. It is plain and
  second-person ("You don't have an account on this instance yet.").
- **A button reads its working state** ("Creating…", "Signing up…") and can't be pressed twice.
- **A failure says why** ("You couldn't be signed up: {reason}") and leaves the button pressable.
- No rule was ever recorded for how a disabled link button looks: it keeps its pointer and full ink (audit §4 #6).

## 6. Carry-forward & open questions

From audit §6:
- **Who may sign up**, beyond on and off: a trust threshold from the owner's point of view, a cap, or a waiting list.
  This is the natural next feature, and it fits the architecture's "where does this trust come from?" check.
- **Telling the owner about new sign-ups.**
- **Retiring the two legacy sign-up pages.**
- **The page after a failed key** (a second press is needed today).
- **Deleting a customer**, broken for everyone (ledger row `2026-11-05-delete-customer-reads-stale-session-field`).
- **The Settings tab bar** hides Accounts at some widths.
- **Steps 2 and 3's pages** (ngit `98821708`, `64a5f7bf`).
- **A live owner check** of the switch and a real sign-up, never done.

## 7. What product must validate

- [ ] Which instances should open sign-up, and for whom. Should tapestry.brainstorm.world stay closed? `[UNKNOWN]`
- [ ] Whether on/off is enough, or the first limit (trust threshold, cap, waiting list) should come before any public
      instance opens. `[UNKNOWN]`
- [ ] What a self-signed-up customer should see after landing on the editor, and whether `/setup` guides them on to
      steps 2 and 3. `[UNKNOWN]`
- [ ] Whether the owner wants a notice or digest of sign-ups. `[UNKNOWN]`
- [ ] Whether the legacy sign-up pages should go. `[INFERRED]` They work now, behind the switch, but nothing links to
      them from the new UI.
- [ ] Whether "account" is the right word for "an Assistant this instance holds for you". The page title says
      account; the body talks about Assistants. `[INFERRED]`
