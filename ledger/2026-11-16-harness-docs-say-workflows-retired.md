# Two harness docs still say the GitHub workflows are retired and that none runs, though the repo is back on GitHub and its workflows run

**Id:** 2026-11-16-harness-docs-say-workflows-retired
**Type:** meta
**Opened:** 2026-11-16 (review of #94, its harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** `scripts/harness-def-paths.txt:16–17` says `.github/workflows` was "RETIRED with GitHub (nous-clawds4 suspended 2026-10-19; repo now on ngit)", and that it is listed so any edit stays L10-visible, "but no workflow runs". `docs/harness/H2_0-baseline.md` (`:34`, `:46–48`) calls the stack-free CI gate, the main-source guard and the deploys retired. The repository has since moved to `TapestryProtocol` on GitHub (CHANGELOG, 2026-11-11). The test gate runs on every pull request (PR #83's four runs, #90's and #91's), and #94 adds the live link checks' weekly workflow. A session that reads either file first is told the opposite of what runs.

**Fix shape.** Say in both files that the workflows run on GitHub again, or mark `H2_0-baseline.md` as a snapshot dated to the ngit period. Both are harness-definition paths, so the change needs its own CHANGELOG row.

**Pointer:** `scripts/harness-def-paths.txt`; `docs/harness/H2_0-baseline.md`; `engineering-team/CHANGELOG.md`, the 2026-11-11 row; `engineering-team/reviews/honest-test-gate/2-live-link-checks-leave-the-pr-gate.md`, harness friction 1.
