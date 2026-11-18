# Setting TAPESTRY_CONTAINER_PORT to a dead port, as a dead-endpoint run does, turns every scratch live check into a silent skip

**Id:** 2026-11-18-container-port-skips-scratch-checks
**Type:** meta
**Opened:** 2026-11-18 (story graph-operations-first-slice #44, review round 1, harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** A run with every endpoint dead sets each port variable the suites read to a dead port, `TAPESTRY_CONTAINER_PORT` among them. But `test/helpers/scratchLoopback.js:14` reads that variable as the control panel's port *inside* the scratch container: every call is `docker exec <container> curl http://127.0.0.1:$TAPESTRY_CONTAINER_PORT…`.

So keeping the dead-endpoint env and swapping only `TAPESTRY_CONTAINER=tapestry-scratch` skips every live check:
- `scratchRefusal()` answers "container 'tapestry-scratch' is unreachable via docker exec", though the container is up;
- the run still reads, for example, "9 passed, 0 failed, 4 skipped" and exits 0, so it looks as if the live checks ran.

The story 44 reviewer verified this, and no ledger or OPEN.md row named the variable before.

**Fix shape,** either:
- the helper takes a variable of its own for the in-container port, so a host-side dead-port setting can't reach it;
- or the dead-endpoint recipes say to leave `TAPESTRY_CONTAINER_PORT` unset for a scratch run, and `scratchRefusal()` names the port it tried.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/44-concepts-list-shows-concepts-with-no-event.md` § Harness friction 1; `test/helpers/scratchLoopback.js:14`, `:19–31`.
