# Nothing lists which suites read a given file, so a scoped gate's suite list is built by hand and misses some

**Id:** 2026-11-18-no-map-of-suites-per-file
**Type:** meta
**Opened:** 2026-11-18 (review of `test-suite-hermeticity` #3, round 1, harness friction 3)
**Status:** OPEN
**Done:** —

**What was seen.** Story `test-suite-hermeticity` #3 changed OPERATIONS.md §15, `.github/workflows/test.yml` and two ledger rows.
- Its implementer built the scoped gate's suite list by searching the tests for those paths and phrases, and chose ten suites.
- The reviewer found seven more that read OPERATIONS.md: `bullboard-admin-access`, `generalized-task-scheduler`, both `reconciliation-*` suites, `router-stream-limit-on-connect`, and both `task-queue-*` suites.
- Their OPERATIONS.md checks all passed, but the list had been incomplete, and nothing would have said so.

**Fix shape.** A script that takes the changed files and prints the registry entries whose suites read them, for a role to start its scoped gate from.

**Pointer:** `test/registry.js`; `engineering-team/reviews/test-suite-hermeticity/3-rw7-times-restarts-from-the-real-start.md`, non-blocking 4 and harness friction 3.
