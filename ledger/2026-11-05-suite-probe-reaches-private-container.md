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

**Note 2026-11-07 (openapi-coverage book close):** the same class, in a suite whose name says otherwise.
`test/stack-free-npm-test.test.js` G2 ("with the real control panel reachable, a guarded suite still RUNS its live
tests", sampled on tag-detail) runs a live suite against whatever control panel answers, which on this Mac is Grawk's
instance. So the suite that guards the registry can't be run here either; its G5 rule (every `test/*.test.js` is
registered or excluded) was checked by hand at that book's Test Design and review. Fix shape: G2 skips unless an
explicit opt-in names the stack it may reach, or G5 moves to a suite with no live half.

**Note 2026-11-08 (graph-operations-foundation #6, review rounds 2 and 3, harness friction):** three more suites
in the same class.

- `test/ledger-row-ids.test.js` says "No stack, no network" (`:14`), but it runs `scripts/session-start.sh` (`:28`).
- `test/rollup-scanners.test.js` does the same, through `test/helpers/rollupFixtures.js` (`:4–6`).
- `test/session-start.test.js` imports that helper's digest runner as `digest` (`:33`), and runs the script about 20
  times. That review's round 2 ran it (32/0) and so sent up to 20 probes there. Its screen had grepped the suite's
  own file, which names the script only in comments and a structure check. **A grep of a suite's file can't see a
  live call that a script it runs makes, through a renamed helper:** the screen must follow the helpers a suite
  loads, and the scripts they run.

The digest's stack probe (`scripts/session-start.sh:41–47`) curls `http://localhost:7778/api/concept-graph/summaries`,
which on this Mac is Grawk's instance. It only asks whether the instance answers (`-o /dev/null`), but a run here
still reaches it. That review skipped the first two at round 2, and all three from round 3 on, and checked their one real-tree claim by hand. Fix shape: the
digest takes its probe URL from a variable that a suite can point at a dead port, or the suites put a stub `curl`
first on `PATH`.

**Pointer:** `engineering-team/reviews/harness-self-improvement/issue-evaluator-pilot-2026-11-05.md` § Harness friction 1
