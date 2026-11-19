# harness-lint checks a ledger id's shape, not that its date is the UTC day it was minted

**Id:** 2026-11-19-lint-skips-ledger-id-date
**Type:** meta
**Opened:** 2026-11-19 (doc-lane review `engineering-team/reviews/graph-operations-first-slice/configuration-relationship-directions.md`, round 2)
**Status:** OPEN
**Done:** —

**What was seen.** OPEN.md says a ledger id starts with the UTC day the row is minted (`date -u +%F`). Two rows in this change were first written at about 00:45 UTC on 2026-11-19 with ids dated 2026-11-18, the writer's local day, and lint L15 raised nothing about their dates (it flagged one of them only for a seven-word slug): it checks an id's shape, not its date. The review caught it, and the rows were renamed before they reached staging, after which an id never changes.

**Fix shape.** Have L15 compare a new, untracked or uncommitted ledger file's date with today's UTC date and warn when they differ; committed rows stay as they are.

**Pointer:** `OPEN.md` (how ids are made); `scripts/harness-lint.sh` (`check_L15`).
