# OPERATIONS.md §15 still rests its no-retry policy on a zero recorded-flake history, but three flakes in the stack-free gate were recorded on 2026-11-16

**Id:** 2026-11-16-ci-gate-flake-history-claim-untrue
**Type:** meta
**Opened:** 2026-11-16 (review of #94, its non-blocking 8)
**Status:** OPEN
**Done:** —

**What was seen.** §15's "No-retry policy" says the stack-free suite has a "zero recorded-flake history", and that a red run is therefore signal by construction. On 2026-11-16, PR #83's CI recorded three flakes in that gate:
- K1's lock check racing its stand-in worker (OPEN.md row `2026-11-16-k1-lock-check-races-worker`, fixed in #90);
- the launcher's destroy test reading a temp folder's name as `-v` (OPEN.md row `2026-11-16-launcher-volume-check-matches-temp-path`, fixed in #91);
- the briefing's link check reading a production deploy's 502 as a dead link (OPEN.md row `2026-11-16-link-check-fails-during-prod-deploy`, settled in #94 by taking the link checks out of the gate).

#94 added the link checks to the paragraph's list of excluded live classes, and left the claim as it was, since the policy's wording is the owner's. The first-flake waiver pattern (the quarantine file) wasn't used for any of the three: two were fixed, and one was moved out of the gate.

**Fix shape.** The owner rewords the premise. For example: a red run is signal, and each flake found gets a ledger row and a fix, as these three did. The owner also decides whether the quarantine file is still the answer to a flake, now that fixing has been.

**2026-11-18, the premise reworded.** Story `test-suite-hermeticity` #3 rewords it, as its AC5 asks. The owner approved that aim, not these words, so the words go to the owner at the story's pull request.
- §15 now says a red run is signal, and names the four stack-free flakes found so far: these three and RW7. It says each got a ledger row and then a fix or a move out of the gate, and names, by run id, the three failed runs that were run again by hand against the policy: PR #83's, and two of RW7's.
- `.github/workflows/test.yml`'s header no longer claims a record of no flakes.
- §15's waiver paragraph adds only that none of the four needed the quarantine file.

**Still open, and the owner's:** whether the quarantine file is still the answer to a flake, now that fixing has been. The row stays OPEN for that question alone.

**Pointer:** OPERATIONS.md §15, "No-retry policy" and "First-flake waiver pattern"; the three rows above; `engineering-team/reviews/honest-test-gate/2-live-link-checks-leave-the-pr-gate.md`, non-blocking 8.
