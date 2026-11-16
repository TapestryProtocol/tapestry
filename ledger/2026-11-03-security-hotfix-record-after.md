# "Ship a live security fix first, describe it without naming it, record it after" is a convention written nowhere

**Id:** 2026-11-03-security-hotfix-record-after
**Type:** meta
**Opened:** 2026-11-03 (book `neo4j-query-public-reads` close, retro)
**Status:** OPEN
**Done:** —

Stories 4–8 and 12 of `security-auth-exposure` were shipped before their story, test plan and review were written,
with commit messages that describe the fix without spelling out the exploit, and the review kept outside the repo
until production. The only written trace of that convention is a parenthesis in the epic ("Members of the class were
described, never named, until their fixes shipped"). The intake table's hotfix note (`workflows/0-intake.md` step 3)
covers "operator present, trivial change", which a reviewed, tested security fix is not. Each session re-derives it.

Fix shape: a short paragraph in `workflows/0-intake.md` (or the Reviewer role) naming the lane: a live, exploitable
hole is fixed and reviewed before anything describing it lands in the public repo; tests and review run as usual,
the review is kept out of the tree, and story, test plan, review and book are filed once production has it.

**Pointer:** `engineering-team/epics/security-auth-exposure.md` (story 8); story 12's Phase path.
