# A public /api/neo4j/query read has no time limit, so one expensive read can keep Neo4j busy

**Id:** 2026-11-03-public-query-timeout
**Type:** bug
**Opened:** 2026-11-03 (security-auth-exposure #12, book `neo4j-query-public-reads`)
**Status:** OPEN
**Done:** —

Story 12 limited what an anonymous query may do, not how long it may run. `queryPost` calls `runCypher` with no
`txConfig`, so a cartesian product or a deep `range()` runs until Neo4j's transaction memory cap stops it. Left out of
the hotfix on purpose: some public pages run slow reads, and a cap set without measuring could break them.

Fix shape: pass `{ timeout: NEO4J_QUERY_TIMEOUT_MS }` (default 15 s, as `src/api/export/users/queries/userdata.js` and
the grapevine queries do) for public callers only, answer 504 with a JSON body on timeout, and measure the slowest
public UI queries on production first.

**Pointer:** `src/api/neo4j/queryPost.js`; review 12, follow-ups.
