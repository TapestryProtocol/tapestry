# The test-gate-speed book's close rides its open pull request, not yet on `staging`

**Id:** 2026-11-22-gate-speed-close-awaits-staging
**Type:** cleanup
**Opened:** 2026-11-22 (test-gate-speed book close)
**Status:** OPEN
**Done:** —

The book's frame defines done as the open pull request: TapestryProtocol/tapestry#201 to `staging`, with `stack-free`
green and a review that passes, its merge waiting for David's yes. So the close commit (`book-close: test-gate-speed`)
went onto `feat/test-gate-speed` before the merge. It holds the audit, the seed, the book flipped to Closed, the epic
retired with its folders under `done/`, and these ledger rows, and it reaches `staging` with the code in one merge.
Until then, a session reading `staging` sees no book, no epic and none of this, and staging's `npm test` still runs the
old one-process gate.

**Fix shape.** Once David merges #201, set this row DONE, naming the merge commit. When `main` takes it at its next
promotion, `feat/test-gate-speed` can be deleted locally and on `origin`, with the owner's yes.

**Pointer:** `engineering-team/audits/test-gate-speed/audit.md` § 5 (epic close-out); TapestryProtocol/tapestry#201.
