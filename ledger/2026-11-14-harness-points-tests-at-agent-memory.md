# On the owner's Mac Studio, the harness points a Claude's tests at the local stack, which holds the owner's agent memory

**Id:** 2026-11-14-harness-points-tests-at-agent-memory
**Type:** meta
**Opened:** 2026-11-14 (story graph-operations-foundation #4, Loom A10.4, PR #61)
**Status:** OPEN
**Done:** —

**What was seen.** Three places in the harness send a Claude to the local stack at `:7778`:
- `engineering-team/roles/implementer.md` (lines 19 and 27), and workflows 3 and 4 (`3-test-design.md:13`, `4-implementation.md:18` and `:31`), say to run `npm test`.
- The `implement-feature` command's house rule (`.claude/commands/implement-feature.md:24`) says to bring up the local stack "via the `cycle-local` skill" when a change needs testing end to end.

On the owner's Mac Studio, the stack at `:7778`, the `tapestry` container, holds the owner's agent memory. The full gate writes live to whatever instance answers there. `/cycle-local` deploys to it and smoke-tests it. CLAUDE.md's principle 4 makes that graph precious: Neo4j is the definitive self, and no dev tooling may destroy what it holds.

**How story 4 avoided it.** It ran only its stack-free suites on the Mac. Its live check ran on a throwaway instance from `scripts/scratch-stack.sh`, as the `graph-operations-foundation` epic's guardrails say: "Live checks run on a scratch stack, never on a shared or private instance". Its review ran no `npm test` either; CI ran the full gate on the pull request.

That came from a note in the owner's own Claude memory. A teammate's Claude on the same machine, or the owner's in a fresh setup, wouldn't have it, and would follow the harness as written.

**Fix shape.**
- The harness says how to tell a disposable dev stack from a precious one. Before a full gate or `/cycle-local`, a Claude checks which kind answers at `:7778`.
- Where the local stack is precious, Phase 3 and 4 live checks go to `scripts/scratch-stack.sh`, and the full gate is left to CI.
- A guard in `test/test.js` or `/cycle-local` that refuses an instance marked as someone's memory would make the rule hold without anyone having to remember it.

**2026-11-15 (graph-operations-foundation #8):** dead endpoints don't reach every suite. `test/event-tagging-firmware-seed.test.js` calls `http://localhost:7778` and `http://localhost:8877` directly (lines 127, 137, 140, 151). So exporting `BRAINSTORM_BASE_URL`, `TAPESTRY_PORT` and `TAPESTRY_CONTAINER` doesn't redirect it. Story 8's session ran it one suite at a time "with dead endpoints", and it sent the local instance two read-only GETs on `:7778`: `/api/assistant/pubkey` and `/api/strfry/scan`. Its `:8877` call reached nothing, since nothing listens there on this Mac. It wrote nothing. Fix shape: make the suite read `BRAINSTORM_BASE_URL` and `TAPESTRY_PORT` like the others, and keep it off dead-endpoint lists until it does (story 8's review, harness friction 1).

**2026-11-16 (graph-operations-foundation #10's review, harness friction 1): the dead-endpoint recipe doesn't kill Neo4j.**
- **The driver ignores the env var.** It takes its address from the conf file alone: `src/lib/neo4j-driver.js` through `getConfigFromFile` (`src/utils/config.js:17–74`), which reads `BRAINSTORM_CONF_PATH` or `/etc/brainstorm.conf`. So an exported `NEO4J_URI` changes nothing.
- **The fallback is the agent-memory instance.** With no conf, the driver uses `bolt://localhost:7687`, which the owner's `tapestry` container publishes on this Mac.
- **No harm yet.** Story 10's review ran its fourteen suites under the usual recipe behind a guard that refuses TCP connections, and none tried to connect.
- **Fix shape.** The recipe adds `BRAINSTORM_CONF_PATH`, naming a conf whose `NEO4J_URI` is a closed port, as story 8's and story 10's reviews ran it. Story 10's own suite now gives its child process such a conf.

**2026-11-17 (book `guard-only-pull-request-target` close): one more place.** `engineering-team/workflows/6-book-close.md` step 10 says to run `npm test` over the final state at every book close and quote its `gate:status` line. This close didn't run it on the Mac. The full suite's result came from CI instead: `stack-free` on TapestryProtocol/tapestry#105, run 43999081306, which passed against the change merged into staging. The close also ran the story's scoped gate, which only reads files. The audit's §5 and §7 record it. The fix shape above covers this step too: at book close, where the local stack is precious, the gate is CI's run on the change.

**2026-11-17 (story `graph-operations-first-slice` #42's review round 1, harness friction 3): one more place.** `engineering-team/workflows/4-implementation.md:29` says to run `curl -X POST http://localhost:$TAPESTRY_PORT/api/firmware/install` after concept definitions change. On the Mac Studio, that is the agent-memory instance. The same line says to record a pending reinstall "in OPEN.md", whose table is closed: a new row is a `ledger/` file. Story 42's Implementer wrote one (`2026-11-17-rule-seven-rewrite-awaits-firmware-reinstall`) and ran the reinstall on a scratch stack. The fix shape above covers the line: where the local stack is precious, the reinstall in Phase 4 goes to a scratch stack.

**Pointer:** `engineering-team/roles/implementer.md`; `engineering-team/workflows/3-test-design.md`, `4-implementation.md` and `6-book-close.md` (step 10); `.claude/commands/implement-feature.md`; `.claude/skills/cycle-local/SKILL.md`; `scripts/scratch-stack.sh`; `engineering-team/epics/graph-operations-foundation.md` (Key facts / guardrails); `engineering-team/reviews/graph-operations-foundation/4-the-write-path.md` (Quality gates).
