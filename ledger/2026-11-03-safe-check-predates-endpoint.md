# A sandbox built before /api/deploy-safety/status existed can't answer the safe-to-merge check

**Id:** 2026-11-03-safe-check-predates-endpoint
**Type:** meta
**Opened:** 2026-11-03 (book `neo4j-query-public-reads`, the `feature-magic-carpet` deploy)
**Status:** OPEN
**Done:** —

`feature-magic-carpet` is about 4,000 commits behind `main` and has no `/api/deploy-safety/status` route (404 from
inside the container; 401 from outside, the default refusal for unknown routes), so
`scripts/check-safe-to-merge.sh` never returns a verdict there and the branch has no copy of the script. Under
`docs/SAFE_TO_MERGE.md` that hands the decision to the owner every time; on 2026-11-03 the owner approved after a
read-only look (supervisor status, task processes, load). That look is a reasonable stand-in, but it is improvised.

Fix shape: either document the stand-in in `docs/SAFE_TO_MERGE.md` ("a target too old for the endpoint: check
supervisor status, task processes and load over SSH, then ask"), or bring the sandbox branches forward so the check
works there.

**Pointer:** `docs/SAFE_TO_MERGE.md`; `engineering-team/audits/neo4j-query-public-reads/book.md` (magic-carpet bullet).
