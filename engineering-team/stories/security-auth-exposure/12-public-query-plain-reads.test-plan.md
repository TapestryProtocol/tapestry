# Test Plan: Story 12 — A public /api/neo4j/query is a plain read of the graph

**Story:** `engineering-team/stories/security-auth-exposure/12-public-query-plain-reads.md`
**ADR:** none (Bug, Standard; Architecture skipped as obvious)
**Book:** `engineering-team/audits/neo4j-query-public-reads/book.md`
**Date:** 2026-11-02 (written with the tests; filed after shipping)

## Coverage map

All tests are in `test/neo4j-query-public-reads.test.js`, registered after story 1's suite in `test/registry.js`.
Story 1's suite (`test/close-unauth-write-surface.test.js`) gained an `explainCypher` stub and must stay green.

| Criterion | Tests | Level |
|---|---|---|
| AC-1 | a query Neo4j returns no plan for is refused; a query that doesn't parse answers its planner error and nothing runs | unit (driver stubbed) |
| AC-2 | refused: LOAD CSV, `apoc.load.json`, backticked `apoc.load.jsonParams`, a call below other operators, `dbms.listConfig`, a near-miss procedure name, `SHOW SETTINGS`, `SHOW PROCEDURES`, nested call / LOAD CSV / CASE, `TERMINATE TRANSACTIONS`, `SHOW USERS`, `SHOW DATABASES`, a proxied request | unit; plan shapes captured from a real 5.26.10 planner |
| AC-3 | the Dockerfile and `setup/install-neo4j.sh` write the blocklist with all ten ranges | source-level |
| AC-4 | allowed: plain MATCH, `db.labels()`, `db.relationshipTypes()`, `SHOW CONSTRAINTS`, `SHOW INDEXES`, `COUNT { }`, nested `COLLECT { MATCH … }` | unit |
| AC-5 | the owner and a direct-local caller run `apoc.load.json` / LOAD CSV with no EXPLAIN; a public write is refused before planning | unit |
| AC-1–AC-4 | the real handler and `explainCypher` against a live Neo4j 5.26 + APOC (set `NEO4J_PLAN_PROBE_URI`, `NEO4J_PLAN_PROBE_PASSWORD`; SKIP otherwise) | live (optional) |
| — | `explainCypher` plans in a READ session with `EXPLAIN` and is exported | source-level |

## Teeth

Before the fix: 8 passed, 14 failed (the new behaviour). After round 1's additions, against the round-0 check: 23
passed, 8 failed. After the fix: 31 passed, 0 failed, with the live class against `neo4j:5.26.10` + APOC.

## How to run on the Mac Studio

The host has no `node_modules`, and the full `npm test` must not run here. Run the suite in a throwaway
`node:22-bookworm` container with the repo mounted read-only and dependencies in a scratch volume; for the live class,
start a throwaway `neo4j:5.26.10` with `NEO4J_PLUGINS='["apoc"]'`.
