# Book of Work: Create your account — /setup step 1's page, and open sign-up

**Slug:** setup-create-account
**Status:** Closed
**Opened:** 2026-11-04
**Closed:** 2026-11-05

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at planning (2026-11-04) and settled through
four questions (§ Decisions). Completion is *judged* against the bullets below. The book builds one
part of item 3 of the intake entry "2026-09-20 — The /setup page, the rest of the way…"
(`engineering-team/stories/_intake.md`): step 1's page. Steps 2 and 3's pages stay open there. It
answers ngit issue `94229587`.

The ask, as the owner typed it in the Claude Code session on the Mac Studio:

> I would like to address one of the issues in the Tapestry repo in ngit. I believe there is one issue that addresses the `Create your account` task on the setup page. Can you find that issue? If so, that is the one I would like to complete.

The issue found was `94229587`, "/setup step 1, "Create your account": build the page (today a
placeholder)". Offered a product pass first or planning at once, the owner chose "Plan it now".

### Acceptance frame

- [x] `/setup/create-account` is a real page. It tells each visitor where they stand on step 1 and
      what they can do about it: signed out, done, able to create an Assistant, a guest, or an owner
      whose Assistant key is missing.
- [x] An admin or an active customer with no Assistant creates one from that page with one button,
      and lands on the Edit Assistant Profile page.
- [x] A guest is told how to get an account here: to ask the owner (named, and linked to their
      profile) while open sign-up is off, or to sign up in one step while it is on.
- [x] The owner turns open sign-up on or off in Settings. It starts off on every instance.
- [x] A customer who signed up themselves is the same as one the owner added.

### Decisions taken at planning (2026-11-04)

The owner answered four multiple-choice questions in two rounds:

1. **A guest can be offered open sign-up.** Asked what a signed-in guest should be told, the owner chose
   "Offer open sign-up" (a button that makes the guest a customer with an Assistant) over "Ask the
   owner" (with open sign-up left to a later issue).
2. **After creating an Assistant, the person lands on the Edit Assistant Profile page**, open on the new
   Assistant's profile form, as the issue says. The owner chose this over staying on the page in its
   done state.
3. **Open sign-up is an owner switch, and it starts off.** While it is off, a guest is told to ask the
   owner. The owner chose this over a switch that starts on and over sign-up that is always open.
4. **Two stories, one book.** Story 1 is the page in all its states, with guests told to ask the owner.
   Story 2 is open sign-up: the owner's switch, and the guest's sign-up button on the page. The owner
   chose this over one story.

Planning settled two more points without a question. The owner approved both stories with them at
the story gate ("Approve both", 2026-11-04):

- A self-signed-up customer is the same as one the owner added, scores included (story 2, AC-4).
- Only the owner, not an admin, changes the switch (story 2, AC-1).

## Epics in this book

- `setup-create-account`: the Create your account page (#1) and open sign-up (#2)

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** high (acceptance-frame; every frame bullet met and live in production, see audit §1 and §4; the switch and a real sign-up never exercised live with the owner, audit §5)

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/setup-create-account/audit.md`
- Product feedback: `engineering-team/audits/setup-create-account/prd-seed.md`
