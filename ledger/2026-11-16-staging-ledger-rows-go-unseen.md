# A ledger row that reaches staging after a story's branch point goes unseen by its Architecture and Review

**Id:** 2026-11-16-staging-ledger-rows-go-unseen
**Type:** meta
**Opened:** 2026-11-16 (graph-operations-first-slice #28, Loom A10.28: review round 1)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The row.** `2026-11-15-card-sets-carry-the-set-label` reached staging at 19:15 on 2026-11-15. It says the trust pipeline's card sets carry the `Set` label with no address, and asks for a decision "before more readers of `:Set` are written".
- **The ADR it missed.** ADR graph-operations-first-slice/0028, a new reader of `:Set`, merged at 17:41, before the row existed. Its Architecture never saw the row, and the implementation followed it.
- **How it was caught.** The Review caught it by reading staging after the fact. That became the round's one blocking finding and ADR 0028 Amendment 3.
- **What made it likely.** Parallel sessions on one book each work from their own branch point, and the ledger grows on staging between those points and each later phase.

**Fix shape.**
- Architecture and Review each list the ledger rows staging has gained since the branch's merge base (`git diff --name-only $(git merge-base HEAD origin/staging) origin/staging -- ledger/`) and read those that touch what the story builds.
- The session-start digest could print that list for the current branch.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/28-link-set-and-unlink-set.md` (round 1, the blocking finding); `engineering-team/decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md` (Amendment 3); `engineering-team/workflows/2-architecture.md`, `5-review.md`.
