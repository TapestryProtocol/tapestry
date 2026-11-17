# Book of Work: Only the main-source guard runs on `pull_request_target`

**Slug:** guard-only-pull-request-target
**Status:** Closed
**Opened:** 2026-11-17
**Closed:** 2026-11-17
**Strictness:** Light (trial) — workflows/light-profile.md *(single Bug-lane story: Implementer +
Reviewer, one human stop at Gate B; no irreversibility trigger fires: a test-file rule and docs)*

## Intent anchor

**Acceptance frame (no PRD)**: the operator's ask, restated and confirmed on 2026-11-17 in the
session that closed ledger row `2026-11-16-main-guard-blocked-by-github-policy`. The repo's Actions
policy, `allow-pull-request-target-for-main-source-guard`, lets `guard-main-source.yml` run on
`pull_request_target`. GitHub's docs don't say whether GitHub's default block still applies to
the repository's other workflows once that policy exists. So the repo holds the line itself:
no workflow but the guard may run on the event without a reviewed change that says so.

### Acceptance frame

- [x] **The check:** `test/workflow-hardening.test.js` reports a finding, naming the file and the
      rule, for any workflow other than `guard-main-source.yml` that runs on `pull_request_target`,
      whichever way its `on:` is written (a single event name, a list, or a map). *(S18, R5, M2.)*
- [x] **No false alarms:** the guard itself, `pull_request`, and a comment or job name that
      mentions the event raise nothing, and the real `.github/workflows/` passes. *(S17, S19, R5.)*
- [x] **The docs:** OPERATIONS.md §18 states the rule. §4 and `.github/rulesets/README.md` point to
      it where they say the policy covers no other workflow. *(§18.4, and D5.)*
- [x] **Done:** on staging, with CI's `stack-free` green. Any new workflow reaches `main` through
      staging, so the check guards from there. *(TapestryProtocol/tapestry#105, merged as
      `2ec98ec6`; `stack-free` run 43999081306 passed; staging deploy 44000226873.)*

## Epics in this book
- `guard-only-pull-request-target`: the EVENT rule in the workflow guard. *(Done, retired
  2026-11-17.)*

## Provenance
- **Mode:** Acceptance-frame
- **Confidence:** high
- **Close artifacts:** [`audit.md`](./audit.md) (the as-built record, with the retro in §7) and
  [`prd-seed.md`](./prd-seed.md) (the product-facing baseline).
