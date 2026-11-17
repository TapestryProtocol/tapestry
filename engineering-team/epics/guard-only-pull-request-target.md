# Epic: guard-only-pull-request-target

**Created:** 2026-11-17
**Status:** Done (epic retired 2026-11-17 at the guard-only-pull-request-target book close: story 1 Done, on
`staging` via TapestryProtocol/tapestry#105; `main` takes it at its next promotion)
**Book:** `engineering-team/audits/guard-only-pull-request-target/book.md` (acceptance-frame,
**Light profile trial**, workflows/light-profile.md; Bug lane)
**Provenance:** Operator request 2026-11-17, in the session that put the Actions policy
`allow-pull-request-target-for-main-source-guard` in place and checked it (ledger row
`2026-11-16-main-guard-blocked-by-github-policy`, closed by TapestryProtocol/tapestry#102). The
policy covers the guard's file alone. GitHub's docs don't say whether the default block on
`pull_request_target` still applies to the repo's other workflows once it exists.

## Goal
No workflow in `.github/workflows/` but `guard-main-source.yml` runs on `pull_request_target`,
unless a reviewed change adds it to the guard's list and to the policy.

## Stories
`stories/done/guard-only-pull-request-target/`:
1. `1-only-the-guard-runs-on-pull-request-target.md`: the EVENT rule in
   `test/workflow-hardening.test.js`, and the docs that point to it. Bug, Light lane.
