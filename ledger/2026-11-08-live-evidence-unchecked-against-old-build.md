# A fix round's live-stack evidence was never checked against the build before the fix, and read the same on both

**Id:** 2026-11-08-live-evidence-unchecked-against-old-build
**Type:** meta
**Opened:** 2026-11-08 (tagging-edges #7, review round 3)
**Status:** OPEN
**Done:** —

Story 7's fix round 2 checked each test that was green on purpose against a fault planted in the code, so a test that
could not fail was caught (B155's first version was). Its live-stack evidence had no such check.

The evidence created an enabled pass entry with a yearly rule widened to 300 characters, and recorded that the status
read "cannot tell". That input reads "cannot tell" on the build before the fix too. A yearly rule has one run within
400 days (R13), and a long rule alone already read "cannot tell". So the record showed nothing about the fix. Review
round 3 found it by replaying the input on both builds; a daily rule widened to 300 characters beside `0 4 * * *`
tells them apart.

Fix shape: wherever a workflow or template asks for live evidence of a fix, it also asks that the input be replayed
(pure function, probe or scratch copy) against the code before the fix, and that the record name both answers. The
Implementer's workflow (`engineering-team/workflows/4-implementation.md`) and the review checklist are the places.

**Pointer:** `engineering-team/reviews/done/tagging-edges/7-confirm-held-removals.md` § "Re-review, round 3", requested 2
