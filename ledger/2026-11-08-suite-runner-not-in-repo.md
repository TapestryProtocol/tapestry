# The one-by-one suite runner a test plan relies on lives only in a session scratchpad, and leaves Neo4j and Redis live

**Id:** 2026-11-08-suite-runner-not-in-repo
**Type:** meta
**Opened:** 2026-11-08 (graph-operations-foundation #1, Loom A10.1: the review's Harness friction 2 and 3)
**Status:** OPEN
**Done:** —

On the Mac Studio the full `npm test` can't be run (OPEN.md row `2026-09-27-test-fixture-taggings-on-prod-relays`), so sessions run suites one by one through their `run()` exports. They use a small runner that sets the service endpoints dead inside itself. A10.1's test plan ("How to run", `node <runner> …`) and its review both used one, but it exists only in that session's scratchpad. Another session or machine can't reproduce the runs.

It has a gap too. It sets `BRAINSTORM_BASE_URL`, `TAPESTRY_BASE`, `MEILI_URL_HOST`, `TAPESTRY_PORT` and `TAPESTRY_CONTAINER` dead, but not `NEO4J_URI`, `REDIS_HOST` or `REDIS_PORT`.

A child process whose temp conf lacks those keys falls back, through `getConfigFromFile`'s `source` step, to the inherited environment and then to `bolt://localhost:7687`. The route walker's child is one: `test/admin-action-sweep.test.js` and `test/openapi-coverage.test.js` each write it an empty conf. (`test/operations.test.js`'s `walk()` did too, until A10.1's fix round, `506e7584f`.) This Mac's colima port forward answers on `:7687`. The walker loads registration only and opens no connection that was seen, but nothing guarantees it. The review exported the three as dead by hand.

**With no conf file at all, the environment isn't read** (added 2026-11-09, graph-operations-foundation #2, Loom A10.2). `getConfigFromFile` (`src/utils/config.js`) reaches the environment only through its `source` step, and that runs only when the conf file exists. So when `BRAINSTORM_CONF_PATH` is unset or names a missing file, and there's no `/etc/brainstorm.conf`, as on the Mac Studio host, it returns the default. That holds whatever the environment says. For `NEO4J_URI` the default is `bolt://localhost:7687` (`src/lib/neo4j-driver.js`).

A runner's dead `NEO4J_URI` therefore protects only a process that has a conf file. Measured on the Mac Studio, with `NEO4J_URI=bolt://127.0.0.1:9` in the environment each time:

| Conf | `getConfigFromFile('NEO4J_URI', …)` |
|---|---|
| none: a missing path, or unset with no `/etc/brainstorm.conf` | `bolt://localhost:7687` |
| an empty file | `bolt://127.0.0.1:9` (the environment, through `source`) |
| a file naming a dead URI | that URI |

**A near miss in A10.2.** Test J10 (`test/operations/lifecycle/backup-job.test.js`) spawns the real job worker. Before its fix, the worker would have run a backup job, and that job opens the driver. As first written, J10 gave it no conf, so its first query would have gone to `bolt://localhost:7687`, which on this Mac is a private instance. This was seen in the code before the test was ever run. J10 now writes a conf of dead endpoints for the worker.

Fix shape:
- commit the runner beside the test helpers (for example `test/helpers/runSuites.js`, no new tooling: it calls each suite's `run()` as `test/test.js` does);
- have it set the three Neo4j and Redis values dead with the rest, **and point `BRAINSTORM_CONF_PATH` at a conf of dead endpoints**, since the environment alone doesn't reach a process with no conf file;
- have the helpers that write a temp conf for a child put dead `NEO4J_URI`, `REDIS_HOST` and `REDIS_PORT` in it, rather than an empty file;
- have a test that spawns real code which loads `src/lib/neo4j-driver` give it such a conf, as J10 does.

**Pointer:** `engineering-team/reviews/graph-operations-foundation/1-operation-declaration-and-lifecycle-status.md` § Harness friction 2, 3; for the no-conf case, `src/utils/config.js` `getConfigFromFile` and `test/operations/lifecycle/backup-job.test.js` J10.
