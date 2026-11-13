# A scratch instance from `scripts/scratch-stack.sh` has none of the setup task's indexes, and `down` leaves the scratch Redis's volume behind

**Id:** 2026-11-13-scratch-stack-indexes-and-volume
**Type:** meta
**Opened:** 2026-11-13 (graph-operations-foundation #3, Loom A10.3: the live check and the measurements)
**Status:** OPEN
**Done:** —

Two gaps, found while running story 3's live check and measurements on the Mac Studio:

- **No setup indexes.** A fresh scratch instance boots with no indexes from `setup/neo4jConstraintsAndIndexes.sh`.
  - After firmware install it had two LOOKUP indexes and `tags_address`, made by the tagging-edges startup hook, and nothing else. `nostrEvent_uuid` and `nostrUser_pubkey` were missing.
  - The setup script runs only as a task, and production's graphs have long had it run.
  - So a live check of index seeks, uniqueness or lookup speed silently measures a graph unlike production's, unless it runs the task first through `POST /api/neo4j-setup-constraints-and-indexes`. Story 3's measurement 1 needed it, and its test plan didn't say so.
  - Fix shape: have `scratch-stack.sh up` run the task after firmware install (or behind a flag), or have the test-plan template's live-check section say to.
- **A volume left behind.** `down` runs `docker rm -f` on both containers without `-v`.
  - The `redis:7-alpine` container's anonymous `/data` volume is left dangling after each `up`/`down`. This session's two boots left two, created at the boots' minutes; the Mac's dangling volumes from 2026-11-08 look like the same thing.
  - The tapestry image declares no volumes, so its data goes with its container.
  - Fix shape: `docker rm -f -v` in `down`.

Related: OPEN.md row `2026-10-31-scratch-stack-image-and-lib-mount`. The stale default image, which this session also met: the default `tapestry-tapestry` has no `cron-parser`, so the session booted `agent-memory-tapestry`.

**Pointer:** `engineering-team/stories/graph-operations-foundation/3-a-tapestry-key-on-every-node.test-plan.md` § Verification, "The live check and the measurements".
