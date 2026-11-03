# On a Neo4j upgrade, re-run story 12's live planner tests before shipping

**Id:** 2026-11-03-neo4j-upgrade-plan-tests
**Type:** meta
**Opened:** 2026-11-03 (security-auth-exposure #12 review, round 2 non-blocking 1)
**Status:** OPEN
**Done:** —

The public-read check in `src/api/neo4j/queryPost.js` refuses known admin operator families by name
(`ADMIN_OPERATORS`) rather than allowing only known read operators. A Neo4j version that adds a new command operator
would pass by default, and plan text formats (the `ResolvedCall(` scan) could change too.

Fix shape: add a line to the Neo4j upgrade procedure (OPERATIONS.md, and wherever the Dockerfile's `neo4j=` pin is
bumped): run `test/neo4j-query-public-reads.test.js` with `NEO4J_PLAN_PROBE_URI` pointed at the new version (with APOC)
and re-check the admin commands that version adds.

**Pointer:** review 12, round 2, non-blocking 1; `Dockerfile` (`neo4j=1:5.26.10`).
