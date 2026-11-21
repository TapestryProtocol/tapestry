# A story's scoped gate is a list someone builds by hand, and story 47's left out a stack-free suite that reads a file the story changed

**Id:** 2026-11-21-scoped-gate-lists-built-by-hand
**Type:** meta
**Opened:** 2026-11-21 (story graph-operations-first-slice #47, review round 1, Blocking 1)
**Status:** OPEN
**Done:** —

**What was seen.** On this Mac the full `npm test` can't run: about 40 suites reach the agent-memory instance. So each story's Implementer and Reviewer run a scoped gate, a list of suites built by hand from the test plan:
- **Story 47's list** was CI's registry entries for an operations change, plus the suites the story wrote or changed and the ones its author thought of. It passed: 1534 tests, 14 suites.
- **What it left out.** `test/create-concept-duplicate-check.test.js` is stack-free and in the registry. Its S2 reads `src/firmware/install.js` and checks that `overwrite: true` comes within 500 characters of Pass 1a's create-concept call. The story added three lines before it, so S2 failed, and CI's `npm test` would have gone red on the pull request.
- **Who caught it.** Review round 1's Reviewer found the failure on its own. Its 28-suite gate didn't list that suite either.
- **The same gap before.** Story 45's gate missed `firmware-element-sync` (ledger row `2026-11-20-element-sync-misses-rule-eleven`), and staging went red until hotfix #165.

**Fix shape.**
- **Derive the scoped gate from the changed files, never list it by hand.** Take every registered suite whose source names a changed file or what it is built from: its source path, its functions, firmware's file names, the helpers it uses. Add CI's registry entries for the kind of change.
- **A changed test file brings in the suites that scan every test file.** `gate-result-record` reads every `test/*.test.js` for banned patterns. Story 47's round 2 fixes changed one test file, and the session's check of them missed that suite. The reviewer's fix check ran it, and all 34 passed.
- **Derive it at gate time, from the final diff, not once at Test Design.** Story 47's Amendment 2 derived its list at `14a944e7`. The fix commit, `2a8e8c2b`, then changed `src/api/openapi.yaml`, which 15 more registered suites read, and the gate ran the old list (review round 2, non-blocking 4). Round 2 ran those 15, and all passed.
- **Flag a suite that reads a live URL whatever the environment says,** so the gate leaves it out or sandboxes it. `event-tagging-firmware-seed` is one: in all three of story 47's gates it made two read-only GETs to this Mac's agent-memory instance (ledger row `2026-11-08-suite-screen-misses-hardcoded-urls`).
- **What it costs.** Story 47's test plan, Amendment 2, did this by hand with a short `node -e` over `test/registry.js`, which found 37 suites. A script, say `scripts/scoped-gate-suites.sh <base>`, would make it one step for every Implementer and Reviewer. It would read `git diff --name-only <base>...HEAD` and print the suites for `gateRunner.runGate`.
- **What closes it.** A harness change: the script, named in the Implementer's and the Reviewer's workflows in place of a hand-built list.

**2026-11-21 (story `container-apt-refresh` #1, review round 1, harness friction 2): again.**
- **The gap.** The test plan's scoped gate named 8 suites. The review derived 42 from the diff: the registered suites
  that read a file the story changed, such as `OPERATIONS.md`, `docs/SAFE_TO_MERGE.md`, the workflows or the
  `Dockerfile`.
- **No harm this time.** Apart from the story's own new suite, the 42 passed or failed exactly as on `staging` alone.
- **Not a fix.** The derivation was a one-off script, kept only as a local record
  (`tmp/review-container-apt-refresh/derive-gate.js` in the main checkout). The book's audit records the sighting
  (`engineering-team/audits/container-apt-refresh/audit.md` §7).

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.md` (round 1, Blocking 1, and its process note; round 2, non-blocking 3 and 4); `engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.test-plan.md` (Amendment 2).
