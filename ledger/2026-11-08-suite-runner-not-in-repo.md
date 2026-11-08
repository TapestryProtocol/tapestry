# The one-by-one suite runner a test plan relies on lives only in a session scratchpad, and leaves Neo4j and Redis live

**Id:** 2026-11-08-suite-runner-not-in-repo
**Type:** meta
**Opened:** 2026-11-08 (graph-operations-foundation #1, Loom A10.1: the review's Harness friction 2 and 3)
**Status:** OPEN
**Done:** —

On the Mac Studio the full `npm test` can't be run (OPEN.md row `2026-09-27-test-fixture-taggings-on-prod-relays`), so sessions run suites one by one through their `run()` exports. They use a small runner that sets the service endpoints dead inside itself. A10.1's test plan ("How to run", `node <runner> …`) and its review both used one, but it exists only in that session's scratchpad. Another session or machine can't reproduce the runs.

It has a gap too. It sets `BRAINSTORM_BASE_URL`, `TAPESTRY_BASE`, `MEILI_URL_HOST`, `TAPESTRY_PORT` and `TAPESTRY_CONTAINER` dead, but not `NEO4J_URI`, `REDIS_HOST` or `REDIS_PORT`.

A child process whose temp conf lacks those keys falls back, through `getConfigFromFile`'s `source` step, to the inherited environment and then to `bolt://localhost:7687`. The route walker's child is one: `test/admin-action-sweep.test.js`, `test/openapi-coverage.test.js` and `test/operations.test.js`'s `walk()` each write it an empty conf. This Mac's colima port forward answers on `:7687`. The walker loads registration only and opens no connection that was seen, but nothing guarantees it. The review exported the three as dead by hand.

Fix shape:
- commit the runner beside the test helpers (for example `test/helpers/runSuites.js`, no new tooling: it calls each suite's `run()` as `test/test.js` does);
- have it set the three Neo4j and Redis values dead with the rest;
- have the helpers that write a temp conf for a child put dead `NEO4J_URI`, `REDIS_HOST` and `REDIS_PORT` in it, rather than an empty file.

**Pointer:** `engineering-team/reviews/graph-operations-foundation/1-operation-declaration-and-lifecycle-status.md` § Harness friction 2, 3
