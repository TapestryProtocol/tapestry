# The dead-endpoint scoped-gate recipe that test plans cite lives in untracked files

**Id:** 2026-11-22-scoped-gate-recipe-lives-in-tmp
**Type:** meta
**Opened:** 2026-11-22 (story `test-gate-speed` #1, review round 1, harness friction 2)
**Status:** OPEN
**Done:** —

Test plans on this machine run their scoped gates through `tmp/ste4/safe-run.sh` and `tmp/ste4/gate.js`, in the main
checkout's `tmp/`. The wrapper points every endpoint at a dead port and stubs `curl` and `docker`. Story
`test-gate-speed` #1's plan does this too (its § "How to run"). Neither file is tracked, so a fresh checkout or another
machine has neither. And `gate.js` passes only `{ file }` entries, so since that story it can't drive the engine's
`expand` path: the review used a scratchpad variant that can. That variant was copied to `tmp/ste4/gate-entries.js` at the book's close, where it is
just as untracked. Row `2026-11-21-scoped-gate-lists-built-by-hand` is the
sibling: a script to derive the list was deferred the same way.

Fix shape: decide where the dead-endpoint scoped-gate recipe lives. A tracked script under `scripts/` or `test/helpers/`
would take a suite list, `file=expand` entries included, and refuse to start unless every endpoint is dead. Or, as now,
memory and untracked files, with test plans saying so.

**Pointer:** `engineering-team/stories/done/test-gate-speed/1-stack-free-gate-in-half-the-time.test-plan.md` § How to run; `engineering-team/reviews/done/test-gate-speed/1-stack-free-gate-in-half-the-time.md` § Harness friction 2.
