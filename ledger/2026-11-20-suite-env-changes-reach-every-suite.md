# A suite that changes `process.env` when it loads changes it for every suite in the gate, and nothing catches it

**Id:** 2026-11-20-suite-env-changes-reach-every-suite
**Type:** meta
**Opened:** 2026-11-20 (story graph-operations-first-slice #46, review round 1, harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** Story 46's new suite, `test/word-elements-fit-the-installed-word-schema.test.js`, set dead endpoints on `process.env` when it loaded: `TAPESTRY_CONTAINER=no-such-container`, `BRAINSTORM_BASE_URL` at port 9 and five more. The gate engine loads every suite into one process before running any (`test/helpers/gateRunner.js:156`), so the values reached every suite in a full `npm test`, those registered before it included. The reviewer showed it with a probe suite listed first, which saw port 9 and `no-such-container` (gate run `20261120T222242Z-87439-52e3`).

**What it breaks, and why nothing showed it.**
- **On a machine where a control panel answers,** the live suites skip, and `test/stack-free-npm-test.test.js`'s G2 fails. G2 probes the real address, then runs `tag-detail` in a child that inherits the changed environment, and that child skips (the reviewer's copy of the spawn: run `20261120T222452Z-88266-abc8`).
- **A scratch live check** (`TAPESTRY_CONTAINER=tapestry-scratch npm test`) would point at `no-such-container`, through `test/helpers/stackHttp.js` and `test/helpers/scratchLoopback.js`, and still exit 0.
- **CI runs with no stack,** so every endpoint is dead there anyway and nothing differs. G2, the one check that would show it, runs only when a control panel answers, and the one on the owner's Mac is the agent-memory instance, where the full gate isn't run.

Story 46 fixed its own suite (commit `31e3c327`): the dead values go to its child alone. Nothing stops the next suite doing the same.

**Fix shape** (a choice for whoever takes it):
- the engine snapshots `process.env` before loading the suites, and after each suite's load and run, and fails the suite that changed it, naming the keys;
- or a stack-free guard that runs every registered suite's load in a child and compares its environment before and after.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/46-word-elements-fit-the-installed-word-schema.md` (Harness friction 1); `test/helpers/gateRunner.js`.
