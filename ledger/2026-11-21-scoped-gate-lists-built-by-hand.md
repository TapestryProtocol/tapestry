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
- **What it costs.** Story 47's test plan, Amendment 2, did this by hand with a short `node -e` over `test/registry.js`, which found 37 suites. A script, say `scripts/scoped-gate-suites.sh <base>`, would make it one step for every Implementer and Reviewer. It would read `git diff --name-only <base>...HEAD` and print the suites for `gateRunner.runGate`.
- **What closes it.** A harness change: the script, named in the Implementer's and the Reviewer's workflows in place of a hand-built list.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.md` (round 1, Blocking 1, and its process note); `engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.test-plan.md` (Amendment 2).
