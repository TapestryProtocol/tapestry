# A suite run to check a harness change docker-execs into this Mac's `tapestry` container even when the stack's port is dead

**Id:** 2026-11-05-suite-probe-reaches-private-container
**Type:** meta
**Opened:** 2026-11-05 (harness/issue-evaluator, the Issue Evaluator pilot's review)
**Status:** OPEN
**Done:** —

`test/operational-direction.test.js` decides whether the stack is up by probing both the host port and the container. `stackAvailable()` (`:309–323`) runs `docker exec <TAPESTRY_CONTAINER> curl …`, with `tapestry` as the default container, even after the host probe has failed. On the Mac Studio that container is Grawk's private agent memory, so a dead `TAPESTRY_PORT` alone doesn't keep the suite off it. The pilot ran the suite as one of the four that read skill and agent files, the usual check for a harness change short of the full `npm test`, and its ten H-tests passed against Grawk's instance: GETs and one `/api/neo4j/query` count, read-only by the suite's design.

Fix shape, either or both:
- the suite skips the container probe when the host probe fails;
- a runner for this machine puts a stub `docker` that refuses every call first on `PATH`, and sets `TAPESTRY_PORT=1` and `TAPESTRY_CONTAINER` to a container that doesn't exist. The review's re-run did this: 76 pass, with the ten H-tests skipped.

**Pointer:** `engineering-team/reviews/harness-self-improvement/issue-evaluator-pilot-2026-11-05.md` § Harness friction 1
