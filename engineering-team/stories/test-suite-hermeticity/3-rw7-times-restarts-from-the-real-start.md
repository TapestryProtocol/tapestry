# Story 3: RW7 times each restart from when node really started, so a busy test process can't fail it

**Status:** Approved
**Created:** 2026-11-18
**Type:** Bug

## Background

RW7, in the tagging-edges real-time wrapper's suite (`tagging-edges` #3), checks that a node which exits at once is restarted with backoff, not in a hot loop: the second start must come 0.8–3.5 s after the first. The wrapper sleeps a full second between a node's exit and its next start, so the real gap can't be under 1 s.

RW7 fails anyway, reading 0.64–0.78 s:
- **in more than a dozen local gate runs since 2026-10-08,** recorded on ledger row `2026-10-08-realtime-wrapper-timing-flake-under-load`;
- **on CI four times since 2026-11-13,** about one run in 28. Each was on a pull request that didn't touch the wrapper.

Alone, the suite has passed every time it was tried.

**The cause,** reproduced on 2026-11-18:
- The suite times a start by when it first notices it, not by when it happened.
- It starts all its scenarios at once, which launches about 23 processes in one burst.
- The full gate runs every suite inside one process. Launching a process costs more the more memory that process holds: by RW7's turn, about 15 ms each instead of 1 ms.
- So the burst keeps the suite from looking for a quarter of a second or more, and it notices the first start late.

**The reproduction,** in a throwaway Linux container:
- At 55 MB, the suite alone passed RW7 three times out of three.
- Holding 1 GB more, it failed three times out of three, at 0.74–0.78 s, as on CI.
- At 3 GB, it read 0.10–0.56 s.

**Who it hurts:**
- **Everyone whose pull request runs the gate.**
- **Promotions:** `stack-free` is a required check on `main`, so a promotion that hits RW7 is blocked.
- **The owner:** OPERATIONS.md §15 forbids reruns, so each hit costs the owner a decision. Two of the four CI hits were rerun anyway.

## User-facing description

As anyone whose pull request runs the gate, I want RW7 to fail only when the wrapper really restarts too soon, so that a red gate means the code is wrong, not that the test process was busy.

## Acceptance criteria

- [ ] **AC1 — A busy test process doesn't shorten a gap.**
  - **Given** the wrapper restarting a node that exits at once,
  - **when** the suite's own process is held up for half a second around the first start,
  - **then** RW7 reads the first restart as the wrapper's real backoff: no less than 1 s after the first start, minus a few milliseconds of clock granularity. RW7 passes.
- [ ] **AC2 — Inside a big process too.** Given the suite run in a process that holds about a gigabyte more memory than it needs, as it does inside the full gate, RW7 passes in three runs out of three. Today it fails there.
- [ ] **AC3 — RW7 still catches a hot loop.** Given a wrapper that restarts node with no backoff, RW7 fails and names the gap.
- [ ] **AC4 — Nothing else changes.** Given the suite run alone, every case passes as before (24 of 24), and no check's window is widened.
- [ ] **AC5 — The records say what happened.**
  - Ledger row `2026-10-08-realtime-wrapper-timing-flake-under-load` is closed, with its cause.
  - `.github/workflows/test.yml`'s header and OPERATIONS.md §15 no longer claim a record of no flakes. They say instead which flake was found, and that it was fixed at its root, so §15's quarantine file stays unneeded.

## Concepts touched

None in the concept graph: this is test infrastructure. The wrapper under test is `tagging-edges` #3's real-time path.

## Out of scope

- **The wrapper itself.** It already sleeps the full backoff.
- **The suite's other windows,** which time from a test's own action to a start, an exit or a signal (RW3, RW9–RW13, RW20, RW24). They have generous upper bounds and haven't failed on CI. One that does gets its own row.
- **RW15,** a process group still alive 3 s after a SIGKILL. It's a different check, seen once, on 2026-09-30.
- **`setup-alert-polish`'s failures:** 31 of 36 failed CI attempts, from 2026-11-06 to 2026-11-14, and none since.
- **Running suites in separate processes,** or making process launches cheaper.
- **OPERATIONS.md §15's quarantine file.** It isn't needed if RW7 is fixed at its root.

## Open questions

- None that block.

## Linked artifacts

- ADR: none. Architecture is skipped: a Bug whose fix follows from its cause, under Standard.
- Test plan: `engineering-team/stories/test-suite-hermeticity/3-rw7-times-restarts-from-the-real-start.test-plan.md`
- Review: (filled in after Review)
- Ledger: `ledger/2026-10-08-realtime-wrapper-timing-flake-under-load.md`
- The reproduction: the probe and its output, in the main checkout's `tmp/rw7-probe/` (git ignores it).
