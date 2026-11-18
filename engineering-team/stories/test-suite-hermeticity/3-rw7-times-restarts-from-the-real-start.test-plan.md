# Test Plan: Story 3 — RW7 times each restart from when node really started, so a busy test process can't fail it

**Story:** `engineering-team/stories/test-suite-hermeticity/3-rw7-times-restarts-from-the-real-start.md`
**ADR:** none. Architecture is skipped: a Bug whose fix follows from its cause, under Standard.
**Date:** 2026-11-18

## Coverage map

| Criterion | Test | Where | Level |
|---|---|---|---|
| AC1 | `RW25: a start is timed from when node started, not from when the suite noticed it — with the suite held up from the spawn until 0.5 s after the stub wrote its first start line, the first restart still reads … 0.98–3.5 s after the first start` | `test/tagging-edges-realtime-wrapper.test.js` | suite (wrappers in child processes) |
| AC2 | **The big-process run.** The suite runs in a throwaway `node:22-bookworm` container (Node 22 with flock(1), as on CI). The process holds 1 GB, and then 3 GB, of ballast, three runs each. RW7 and RW25 pass in every run. | `tmp/rw7-probe/rw7-probe.js` (git ignores it; a copy is in the main checkout's `tmp/rw7-probe/`) | verification |
| AC3 | **The hot-loop mutation.** A copy of `run.sh` has its `nap "$backoff"` replaced by `:`. RW7 fails, naming the hot loop or the gap. RW25 fails too. | the container, on a copy of `test/` and `src/pipeline/tagging-edges/realtime/` | verification (mutation) |
| AC4 | **The suite alone:** RW1–RW24 pass as before (24 of 24), and RW25 passes. **The diff:** `MS`'s existing entries and RW7's bounds (0.8–3.5 s, the 1.6 s second gap, at most 4 starts) are unchanged. | the suite; `git diff` | suite and review |
| AC5 | **The records:** ledger row `2026-10-08-realtime-wrapper-timing-flake-under-load` is DONE, with its cause. `.github/workflows/test.yml`'s header and OPERATIONS.md §15 no longer claim a record of no flakes, and say which flake was found and how it was fixed. | the docs | review |

**How RW25 is built:**
- **The hold-up.** RW25 holds the suite up with a busy wait, not a timer, so nothing else in its process runs: no observer tick and no other callback. That is how a burst of process launches holds the full gate's process up. The hold-up lasts from the spawn until 0.5 s (`MS.holdUp`) after the stub's first start line is written. So it covers the first start however long the host takes to start node, and it gives up after `MS.firstStart` if node never starts.
- **It runs alone.** RW25 awaits every scenario first (`startAll()`), and its scenario isn't one of `SCENARIOS`. So its hold-up holds up no other scenario's clock.
- **It reads what RW7 reads:** each start record's `at`. A fix that makes those records time the start itself makes both pass, and the test pins no more than that.
- **Its bounds.** The floor is 1 s less 20 ms (`MS.clockSlack`), for clock granularity: `run.sh`'s `nap 1` puts at least a full second between a node's exit and its next start, so two starts are at least 1 s apart. The ceiling is RW7's 3.5 s.

**A correction for the story's AC2.** Its "today it fails there" held in the first probe but not in every run:
- In the first probe, at 1 GB, each spawn took about 15.6 ms, and RW7 failed three runs of three (0.74–0.78 s).
- In the red-phase run, at 1 GB, each spawn took about 7 ms, and RW7 passed three of three.
- What sets the cost is the machine's state, not the code.

So AC2 is verified at 3 GB as well as 1 GB. At 3 GB, RW7 failed three of three before the fix (see Verification).

## Edge cases

- [x] **A slow host:** the hold-up waits for the first start line itself, so it covers the first start. If node never starts, RW25 says so rather than passing.
- [x] **Another scenario's clock:** RW25 runs after every scenario has settled.
- [x] **macOS and Linux:** the suite runs on both, with the perl flock(2) shim on macOS and flock(1) on Linux.
- [x] **A host that can't run the wrapper:** RW25 skips through `need()`, like the others.
- [x] **A coarse clock:** 20 ms is allowed below 1 s.
- [ ] **After the fix,** every other check that reads a start's time still passes:
  - RW3, RW9, RW10 and RW24 time from the suite's own action to a start, under an upper bound. A start timed earlier only shortens those intervals.
  - RW22 compares starts with each other. It becomes exact.
  - RW20 times an exit, not a start, and is out of scope.

## Test infrastructure

- **Framework:** none. The suite is hand-rolled in the project's style and run directly by Node, or by the gate engine, which calls its `run()`.
- **No stack:** the suite runs no stack. Every wrapper runs from temp dirs under `os.tmpdir()`, with a stub node, and never touches the agent-memory instance.
- **The container runs** need Docker and the local `node:22-bookworm` image. The worktree is mounted read-only. The mutation runs on a copy inside the container.
- **Never the full `npm test` on this Mac.** CI runs the full gate on the PR.
- **Firmware state:** none.

## How to run

The suite, alone:
```
node test/tagging-edges-realtime-wrapper.test.js
```

The big-process run and the mutation, in a throwaway container:
```
docker run --rm -v "$PWD:/w:ro" -w /w node:22-bookworm bash -c 'for mb in 0 1024 3072; do node --max-old-space-size=8192 /w/tmp/rw7-probe/rw7-probe.js "$mb" /w/test/tagging-edges-realtime-wrapper.test.js; done'
```

The mutation: inside that container, copy `test/` and `src/pipeline/tagging-edges/realtime/` to `/tmp/w2`, replace `nap "$backoff"` with `:` in the copy's `run.sh`, and run the probe on `/tmp/w2/test/tagging-edges-realtime-wrapper.test.js`.

## Verification

The new test fails with the current code. Confirmed on 2026-11-18, at `66122101` with RW25 added, before the fix:

- **This Mac** (bash 5.3.15, the perl flock(2) shim): 24 passed and 1 failed.
  ```
  FAIL  RW25: a start is timed from when node started, not from when the suite noticed it — …
        the first restart read 0.53 s after the first start, with the suite held up until 0.50 s after node first started (starts at [0,0.53] s)
  tagging-edges-realtime-wrapper: 24 passed, 1 failed, 0 skipped
  ```
- **Linux** (`node:22-bookworm`, Node 22.23.3, flock(1); `tmp/rw7-probe/red.out`): 24 passed and RW25 failed alone, in six of six runs, at 55 MB and at 1.2 GB. Each read "the first restart read 0.52 s after the first start, with the suite held up until 0.50 s after node first started". RW7 passed in all six: spawns took 1–1.2 ms at 55 MB and 6.9–8 ms at 1.2 GB.
- **AC2 before the fix:**
  - The first probe (`tmp/rw7-probe/run1.out`): RW7 failed three of three at 1.2 GB (0.74–0.78 s, spawns about 15.6 ms each), and three of three at 3.2 GB (0.10–0.56 s).
  - Today's 3 GB baseline (`tmp/rw7-probe/red-3gb.out`): RW7 failed three of three, at 0.44–0.55 s. Each spawn took about 34–36 ms, 707–777 ms in all in the first second. RW25 failed three of three too, at 0.52–0.53 s.
- **AC3 baseline,** with the backoff removed from a copy of `run.sh`: RW7 fails today with "a hot loop: 1914 starts in 6.50 s". RW15, RW18, RW19, RW20, RW22 and RW25 fail too (18 passed, 7 failed). After the fix, RW7 must still fail it.
- **RW25's reason is the right one:** its first start is timed when the suite noticed it, at the hold-up's end, so the 1 s backoff reads as about 0.5 s.
