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

**Pointer:** `engineering-team/roles/implementer.md`; `engineering-team/workflows/3-test-design.md` and `4-implementation.md`; `.claude/commands/implement-feature.md`; `.claude/skills/cycle-local/SKILL.md`; `scripts/scratch-stack.sh`; `engineering-team/epics/graph-operations-foundation.md` (Key facts / guardrails); `engineering-team/reviews/graph-operations-foundation/4-the-write-path.md` (Quality gates).
