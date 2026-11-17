# A scoped gate that lists `operations.test.js` beside the suites under `test/operations/` runs each of them twice in one process, and the second run fails on files the first run's cleanup removed

**Id:** 2026-11-17-gate-recipe-runs-operations-suites-twice
**Type:** meta
**Opened:** 2026-11-17 (story graph-operations-first-slice #8, Loom A10.8; its review's Harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** The brief for `graph search`'s review, written by the session that built it, asked for one scoped gate over every suite under `test/operations/` and five suites outside it, `operations.test.js` among them. The record read FAIL: `operations.test.js` had 193 failures, each an ENOENT on a suite's own temporary graph file or a missing agent key. The other 64 suites passed. The same command on the merge base, `090c848e`, failed the same way, with 188.
- **The gate loads every suite into one process** before any runs (`test/helpers/gateRunner.js:10`, `:157–160`).
- **`operations.test.js` runs every suite under `test/operations/` itself** (`test/registry.js:389–392`, ADR graph-operations-foundation/0001 Decision 12), by `require` (`test/operations.test.js:1159–1172`). They are already loaded, so each one runs a second time.
- **Suites keep their seeded graph or key file at module level** (`test/operations/graph/add-relationship.test.js:39–43`, `test/operations/graph/search.test.js:143–145`, and others). `graphOpsSuite`'s one `cleanup()` removes every temporary folder at the end of the first run (`test/helpers/graphOpsSuite.js:35–37`, `:189`).
- **CI is unaffected.** The registry lists `operations.test.js` and none of the suites it runs.

**Why it matters.** Such a recipe can't pass on any branch, so a reviewer reads a false FAIL, or narrows the run until it passes. Nothing warns, since the recipe looks like two correct ones put together. Sessions on this Mac write their own scoped gates, because the full `npm test` must not run here (row `2026-11-14-harness-points-tests-at-agent-memory`).

**Fix shape.** Any of these:
- **The README's "Running and reading the test gate"** (`engineering-team/README.md`) says that `operations.test.js` runs every suite under `test/operations/`, so a scoped gate lists one or the other, never both.
- **`runGate`** refuses a suite that another listed suite runs, or drops it with a note.
- **`graphOpsSuite`'s `cleanup()`** also resets the suites' module-level seeds, so a second run seeds again.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/8-search.md`, Quality gates and Harness friction 1.
