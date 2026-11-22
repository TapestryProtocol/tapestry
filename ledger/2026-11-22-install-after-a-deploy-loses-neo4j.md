# A firmware install started just after a deploy loses its Neo4j driver reads, still answers success, and its Pass 2 calls the failures "not found"

**Id:** 2026-11-22-install-after-a-deploy-loses-neo4j
**Type:** bug
**Opened:** 2026-11-22 (book `audits/deploy-safety-sees-installs/`, the staging evidence install)
**Status:** OPEN
**Done:** —

**What was seen.** On the owner's yes, story deploy-safety-gate #4's evidence install ran on staging as the loopback call `POST http://127.0.0.1:7778/api/firmware/install`, from 04:53:38 to 04:55:56 UTC. Just before it:
- **#204's deploy** recreated the container (run 44986704127, done 04:50:47).
- **Another session merged #205** at 04:51:47. Its deploy (run 44986895556) recreated the container again, done at 04:53:18.
- **The install's pre-check,** at 04:53:29, found no staging deploy running or queued (`docs/SAFE_TO_MERGE.md`, "Before a firmware install"). That was true: #205's had finished 11 seconds before.

So the install began 20 seconds after the container was recreated, and its reads through the Neo4j Bolt driver failed. The install answered `success: true`:
- **Pass 1** gave 41 concepts. But all 12 errors were its element sync for `graph-rule`, which reads through the driver (`runCypher`): "Failed to connect to server. Please ensure that your database is listening …".
- **Pass 2** enriched none and skipped all 41. Its header lookup goes through `/api/neo4j/query`, which is driver-backed (`src/api/neo4j/queryPost.js:13`, `:95`). On a driver error that route answers `{ success: false, cypherResults: '' }` (`:116`), and Pass 2 reads that as "Concept … not found in graph — run Pass 1 first".
- **Pass 3** ran (746 derived, 4 enumerations applied), by which time Neo4j was answering.
- **One minute after the install,** the driver-backed `/api/firmware/install-status` answered normally, at 41 of 41.

**Nothing was damaged this time,** by luck of the timing:
- **No firmware file changed** between `425006cf`, the tree of the last full install on staging (2026-11-21 22:07–22:11), and staging's tree now. So a successful element sync and Pass 2 would have changed nothing.
- **The tag concept's JSON schema** still holds the enriched schema from 22:09:31.
- **The six community-reference headers** were re-signed by this install, each with its pointer `b` and no repeated tag.

With a firmware change pending, the same run would have left the changed rule items and schemas behind while answering success.

**Three gaps:**
1. **The procedure's pre-check misses a deploy that has just finished.** "No deploy running or queued" doesn't mean the instance is ready. The smoke test already knows HTTP readiness isn't Neo4j readiness (`docs/SMOKE_TEST.md`, Tier 1, "Neo4j-readiness gate").
2. **Today's install doesn't check that the graph answers before it starts.** `lifecycle` operations do (`_common.js` `begin`, `graphAnswers`), and refuse `graph-unavailable`.
3. **A failed read is reported as something else.** Pass 2 calls it "not found", and the install answers `success: true` with every one of Pass 1b's reads failed.

**Fix shapes, none chosen:**
- **The procedure's pre-check also waits for Neo4j readiness** when a deploy finished in the last few minutes, by the smoke test's gate: `verifiedFollowerCount` non-null three times. Docs only, in `docs/SAFE_TO_MERGE.md`.
- **Today's install checks the graph answers first,** and refuses as `lifecycle begin()` does.
- **Pass 2 tells a failed query from a missing concept,** and the install answers `success: false`, or at least names the failed reads, when a pass's reads fail.

**Pointer:**
- the book's Rollout evidence, staging (`engineering-team/audits/deploy-safety-sees-installs/book.md`);
- the raw records, git-ignored, in the main checkout's `tmp/deploy-safety-sees-installs/staging-2026-11-22/` (`install-response.json`, `check-journal.txt`, `during-snapshot.txt`);
- `src/firmware/install.js` (`pass2_enrich`, Pass 1b's `planElement` reads);
- `src/api/neo4j/queryPost.js:116`.
