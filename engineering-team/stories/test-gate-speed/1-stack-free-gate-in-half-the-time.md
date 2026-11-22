# Story 1: The stack-free gate gives the same verdict in half the time

**Status:** Approved
**Created:** 2026-11-21
**Type:** Refactor

## Background

The `stack-free` check runs `npm test` on every pull request to `staging` or `main` (ADR `test-hermeticity-ci/0001`). It is a required check on `main`: `main`'s ruleset 27080672 requires `stack-free` and `main-source-guard` by name.

**It outgrew its time limit twice in two days.**
- On 2026-11-20 the 15-minute limit cancelled passing runs, one of them on the promotion pull request #167. The limit went to 25 minutes (ADR `test-hermeticity-ci/0001`, Amendment 1).
- On 2026-11-21 a slow runner took the job to 22 m 53 s. The owner chose to raise the limit to 40 minutes first, and to make the gate faster after that ("Raise to 40 first"). The raise is TapestryProtocol/tapestry#191, promoted to `main` in #193 (Amendment 2). This story is the second step.

**What the runs show** (ledger row `2026-11-21-ci-gate-nears-25-minute-timeout`):
- **GitHub picks the runner, and the runner makes most of the spread.** Nine passing runs of one tree took 13 m 58 s to 22 m 53 s. Five of the nine got a slow runner, at about 21 minutes. Nothing in a run's log predicts the speed.
- **`operations` is most of the time.** It is about 64% of `npm test` on a slow runner: 797 s of 1,259 s in run 44949158788, #191's last run. Its 111 files run one after another.
- **The time is spread out.** The slowest 3 files hold 17% of `operations`, and the slowest 10 hold 36%. Trimming one file buys little.
- **It grows with every operations story.** Export nostr and seed-firmware each added about 85 s on a typical slow runner, and 96 s on the slowest. At that rate, 40 minutes holds about ten more stories like them.
- **Nothing runs side by side.** The gate runs one suite at a time, in one process. GitHub's Linux runners for public repositories have 4 CPUs (GitHub's "GitHub-hosted runners reference"). The slowest files keep about one of them busy: on this Mac, measured at planning, `lifecycle/seed-firmware` took 28.6 s and used 34.5 s of CPU, and `export/nostr-send` took 28.4 s and used 27.0 s. So most of a runner sits idle while the gate runs.

**Who it hurts.**
- Everyone who opens a pull request. On a slow runner the verdict takes about 21 minutes.
- The owner, promoting to `main`, where `stack-free` is required and a cancelled run blocks the merge. OPERATIONS.md §15 forbids running a failed or cancelled run again, so the next try is a new push.
- Every agent session that waits on a pull request's checks.

## User-facing description

As anyone who opens a pull request to `staging` or `main`, I want the `stack-free` check to give its verdict in at most half the time it takes today, and to give exactly the same verdict. Then I wait less, and the 40-minute limit stays a hang guard as operations stories keep adding tests.

## Acceptance criteria

- [ ] **AC1 — Half the time.**
  - **Given** one tree and one machine with 4 CPUs, as GitHub's runners have,
  - **when** today's gate and this story's gate run that tree one after the other,
  - **then** this story's `npm test` takes at most half as long as today's.
  - On a runner as slow as the slowest seen, that is a job of under 12 minutes, where today's took 22 m 53 s. Every CI run of this story's pull request finishes the job in under 12 minutes.
- [ ] **AC2 — The same verdict.**
  - **Given** the same tree, the same tests run, and each suite, and each file under `test/operations/`, reports the same counts passed, failed and skipped as it does today. The `Total skipped:` line and the `Overall:` line give the same totals. If the run counts its parts differently, the log says how, and no test is lost or counted twice.
  - Every guarantee of story `honest-test-gate` #1 and story `test-suite-hermeticity` #4 still holds, and their tests still pass:
    - a suite that throws, fails to load, calls `process.exit`, returns no counts, or never settles is that suite's FAIL, never the end of the run;
    - a suite that changes `process.env` fails, named, with its keys and never their values, and the change reaches no other suite;
    - the run record is true, and `npm run gate:status` reads it;
    - an interrupted run records INTERRUPTED.
- [ ] **AC3 — A log you can still read and measure.**
  - Each suite's lines appear together under its name, never mixed with another suite's.
  - The log gives each suite's time, and each time for a file under `test/operations/`, so a later ledger row can measure what this one did.
  - The log names the machine's CPU count and model, so runs can be compared across GitHub's runners.
- [ ] **AC4 — One check, one command, no retries.**
  - Pull requests to `staging` and `main` still get one check named `stack-free`, and it carries the verdict. `main`'s ruleset needs no change.
  - `npm test` is still the one command that CI runs and a contributor runs, and it gives the same verdict in both places.
  - Nothing retries or reruns a suite, and the 40-minute hang guard stays. The workflow tests in `test/ci-test-job.test.js` pin the new shape.
- [ ] **AC5 — No new flakes.**
  - Running suites side by side loads the machine, and load made RW7 flaky before (OPERATIONS.md §15).
  - **Before merge,** the full gate passes ten times in a row in a Linux environment like CI's, with nothing failing, and every CI run of this story's pull request passes.
  - A suite that fails only when run beside others gets a ledger row and a fix at its root. It is never retried, and it isn't moved out of the gate to hide it.
  - A contributor can still run the gate with nothing side by side, to tell such a failure from a real one. OPERATIONS.md §15 says how.

## Concepts touched

None in the concept graph: this is test infrastructure. No concept definitions change, so no firmware reinstall.

## Out of scope

- **Making any one suite faster.** The time is spread out, so trimming one file buys little. A file that turns out to set the new run's length can get a story of its own.
- **The time limit.** It stays at 40 minutes, a hang guard and not a budget.
- **`main`'s ruleset and `staging`'s branch rules.**
- **Which suites the gate runs.** No suite leaves it and none joins it. The live and e2e classes stay out, as ADR `test-hermeticity-ci/0001` keeps them.
- **Bigger or paid runners.**
- **OPERATIONS.md §15's stale "Required-check status" paragraph** (OPEN.md row 14), unless the new text replaces it anyway.

## Open questions

None open. The owner answered two at planning, on 2026-11-21:

1. **The target.** Half the time on the same runner (AC1), not a third. Half fits the 4 CPUs a runner has with room to spare. A third might have needed the job split across several runners.
2. **A full local run.** Yes, for this story: the full `npm test` may run on this Mac inside a throwaway Linux container. It works on a copy of the checkout, with networking switched off while the tests run and no Docker socket or host port, so it can't reach the agent-memory instance. AC1's measurement and AC5's ten runs use it.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
- Intake: `engineering-team/stories/_intake.md`, the 2026-11-21 entry "The stack-free gate runs one suite at a time, and each operations story adds about a minute and a half to every pull request (refactor)"
- Ledger: `ledger/2026-11-21-ci-gate-nears-25-minute-timeout.md` (the measurements; closed by #191)
- Book: `engineering-team/audits/test-gate-speed/book.md`
