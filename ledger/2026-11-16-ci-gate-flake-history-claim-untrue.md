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

**Pointer:** OPERATIONS.md §15, "No-retry policy" and "First-flake waiver pattern"; the three rows above; `engineering-team/reviews/honest-test-gate/2-live-link-checks-leave-the-pr-gate.md`, non-blocking 8.
