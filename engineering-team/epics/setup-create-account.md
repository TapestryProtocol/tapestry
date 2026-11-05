# Epic: setup-create-account — the Create your account page, and open sign-up

**Created:** 2026-11-04
**Status:** Active
**Book:** `engineering-team/audits/setup-create-account/book.md` (no PRD — acceptance frame)
**Provenance:** ngit issue `94229587` and the owner's ask of 2026-11-04, quoted in the book and settled
through four questions at planning (book § Decisions). It builds step 1's page from item 3 of the
intake entry "2026-09-20 — The /setup page, the rest of the way…".

## Goal

**Replace `/setup/create-account`'s placeholder with a page that tells each visitor where they stand
on step 1 and lets them act on it, and let an owner open sign-up to guests.** Today the page says only
"Placeholder page.", an Assistant can be created only from the Edit Assistant Profile page, and a guest
cannot become a customer by themselves.

## Stories

`stories/setup-create-account/`. Both are features and take all five phases (Standard).

1. `1-create-account-page.md`: the page in all its states. An admin or an active customer creates
   their Assistant with one button and lands on the Edit Assistant Profile page; a guest is told to ask
   the owner.
2. `2-open-sign-up.md`: the owner's "Open sign-up" switch in Settings, off to begin with, and the
   guest's sign-up button on the page while it is on. Depends on #1.

## Related

- Steps 2 and 3's pages: ngit issues `98821708` and `64a5f7bf` (still open; not in this book).
- The My Assistants overview (`df02005e`), branding (`3be893b7`), and first-run guidance with an owner
  setup alert (`d6398202`, comment `a148b08f`): named by issue `94229587` as related.
- Loom: no task covers this page. The nearest blocks are G5 (a person's Assistants) and G3 (portable
  identity and on-ramps).
