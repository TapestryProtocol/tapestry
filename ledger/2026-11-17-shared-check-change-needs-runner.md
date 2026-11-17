# A change to a shared check was tested against a hand-picked list of suites, and the one that broke wasn't on it

**Id:** 2026-11-17-shared-check-change-needs-runner
**Type:** meta
**Opened:** 2026-11-17 (story graph-operations-first-slice #26 review, harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** Story 26 changed `_nodes.js`'s `whoseNode`, the shared test of whose node it is. A `NostrEvent` with no `created_at` now reads as a placeholder. At test design the Tester looked for seed nodes of that shape, found three, gave them a `created_at`, and listed in the test plan the suites to run beside the new ones. The list didn't include all of `test/helpers/fieldGraph.js`'s users: that seed builds every letter with no `created_at`.
- The first run of the whole operations runner, `test/operations.test.js`, at implementation failed update-node's UN40 alone.
- The fix was a kick-back to test design (commit `80189eb3`).
- The runner is stack-free and takes about five minutes on this Mac. It would have found the gap at test design.

**Fix shape.** In `engineering-team/workflows/3-test-design.md`: when a change touches a module other operations share (`_nodes.js`, `_fields.js`, `write.js`, the fake graph), run the whole operations runner once with the failing tests in, and note in the plan which failures are the new tests'. That workflow is a harness-definition path, so the change owes a CHANGELOG row.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/26-delete-node.test-plan.md` ("Added at implementation"); `engineering-team/reviews/graph-operations-first-slice/26-delete-node.md` § Harness friction.
