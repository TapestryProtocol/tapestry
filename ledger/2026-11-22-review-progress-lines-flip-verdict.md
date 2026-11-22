# A review's progress lines can flip its verdict under L1's last-token rule

**Id:** 2026-11-22-review-progress-lines-flip-verdict
**Type:** meta
**Opened:** 2026-11-22 (story `test-gate-speed` #1, review round 3, harness friction)
**Status:** OPEN
**Done:** —

`scripts/lib/review-verdict.awk` takes as a review's verdict the last `PASS` or `CHANGES_REQUESTED` on any line that is
a heading or holds bold markers. Story `test-gate-speed` #1's round-2 review was pending, waiting on runs still going,
but four of its progress lines were bold and held a capitalised verdict word. One was "Two of ten are in, both PASS".
So harness-lint's L1 read the review as PASS-final while the story was still Approved. The `harness-lint` suite's "the
real repo lints clean" then failed in a scoped gate on a tree with nothing wrong in it. The reviewer re-worded those
lines without changing what they say. The awk file already names this edge (prose like "**PASS stands** … cannot pass"),
waived in harness-self-improvement story #1's Deviations. A review that reports progress before its verdict meets it
again.

Fix shape: either the review template warns to keep capitalised verdict words off every other bold or heading line, or
the rule reads only a line that holds nothing but the verdict, such as `**Verdict:** PASS`. The rule is a harness
definition, read by harness-lint's L1 and L4 and by `scripts/harness-stats.sh`, so the change owes a CHANGELOG row.

**Pointer:** `scripts/lib/review-verdict.awk`; `engineering-team/templates/review-checklist.md`; `engineering-team/reviews/test-gate-speed/1-stack-free-gate-in-half-the-time.md` § Round 3, harness friction.
