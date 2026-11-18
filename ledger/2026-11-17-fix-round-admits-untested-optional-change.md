# A review's fix round can change code for a finding that names no test, so a change can land with nothing to catch it

**Id:** 2026-11-17-fix-round-admits-untested-optional-change
**Type:** meta
**Opened:** 2026-11-17 (story graph-operations-first-slice #18's review round 2, Harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The finding.** Round 1's non-blocking 9 was an optional, unmeasured speed-up of the address check (Decision 5's nonce search), and it named no test for the path it touched.
- **The round.** The owner chose to fix round 1's findings before the PR, and the Tester wrote cases first, as the practice is. They covered findings 3, 4, 5 and 8. So the address check's rewrite went in with nothing to catch it, and it regressed: two new properties whose keys slug alike could share an address (round 2's blocking 1).
- **What no one saw.** Decision 5's nonce search had no suite case before the rewrite either, and round 1 didn't notice that.

**Fix shape.**
- In a fix round, every code change a fix makes gets a Tester case first, optional findings included. Otherwise the round's Evidence says which path is untested.
- A reviewer's optional change names the test that would guard its path.
- A line for each in `engineering-team/workflows/5-review.md` and the review template.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/18-property-operations.md` (round 1's non-blocking 9; round 2's blocking 1 and Harness friction 1).
