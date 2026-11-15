# `lifecycle migrate --migration tapestry-keys` failed at 3.85 million nodes on a 512 MB transaction limit

**Id:** 2026-11-15-tapestry-keys-exceeds-transaction-memory
**Type:** bug
**Opened:** 2026-11-15 (story graph-operations-foundation #8, Test Design)
**Status:** OPEN
**Done:** —

**What was seen.** A scratch stack had its transaction limit at 512 MB (`BRAINSTORM_NEO4J_TX_MAX_MB=512`, `scripts/scratch-stack.sh`). It was seeded to staging's shape: 3,851,244 nodes, every one already keyed and labelled `TapestryNode`. `docker exec tapestry-scratch tapestry lifecycle migrate --migration tapestry-keys` answered after 7 s, before adding the rule:

> lifecycle migrate failed: The allocation of an extra 2.0 MiB would use more than the limit 512.0 MiB. Currently using 510.0 MiB. dbms.memory.transaction.total.max threshold reached

Staging ran the migration on 2026-11-13, at about the same size, so its limit is larger. Production has 4,625,039 nodes and hasn't run it yet. Story 3's promotion to main brings that run.

**Fix shape.**
- Before running `tapestry-keys` on production, check its `dbms.memory.transaction.total.max`.
- Better, find which of the migration's reads holds the memory: Decision 4's scan, or the check for keys held twice. Then stream or batch it, so the migration doesn't depend on the limit.

Story 8's seeder adds the rule with the migration's own statement instead (`test/helpers/seedStagingShape.js`).

**Pointer:** `engineering-team/stories/graph-operations-foundation/8-pass-3-finishes-in-minutes.test-plan.md` (Test infrastructure).
