# PRD Seed: A test gate that keeps pace with the pull requests

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/test-gate-speed/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high for what shipped, medium for the next phase's shape
**Date:** 2026-11-22

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman for the product team*, not a ratified spec. Every section is tagged — `[FROM FRAME]` (grounded in the kickoff acceptance frame), `[INFERRED]` (read off the as-built system), or `[UNKNOWN — product input needed]`. The product team adopts this as the starting point for `/discover` on the next phase and validates each section. **Be honest about confidence:** a no-anchor reconstruction is a hypothesis, not ground truth — don't dress it up.

## 1. Product vision

`[FROM FRAME]` The `stack-free` check, which runs `npm test` on every pull request to `staging` or `main`, gives its
verdict in at most half the time it took, with exactly the same verdict. On 2026-11-21 the check outgrew a 15-minute
limit and then neared a 25-minute one. Each operations story added about a minute and a half to every pull request.

`[INFERRED]` The broader aim is a gate whose wait stays short as the test suite grows, without trading away what makes
its verdict trustworthy: no retries, skips counted, and each suite's failure named for that suite. The 40-minute limit
should stay a hang guard, never a budget.

## 2. Personas

`[FROM FRAME]`, from the story's "Who it hurts":
- **The contributor** who opens a pull request, a person or an agent session, and waits for its checks.
- **The owner**, promoting `staging` to `main`, where `stack-free` is required and a cancelled run blocks the merge.
- **Agent sessions** that wait on a pull request's checks before their next step.

`[INFERRED]` A fourth reader: whoever diagnoses a red run. They need to tell a failure that happens only beside other
suites from one that happens alone (`GATE_JOBS=1`), and to read one suite's output without another's mixed in.

## 3. Scope (as-built)

`[FROM FRAME]` What shipped:
- **The verdict comes in 4½ to about 7 minutes** on CI, against 14 to 23 before. CI runs the gate in two parts on two
  runners, and each part took at most a third of the old whole gate on its own runner.
- **The same verdict:** the same tests, the same counts suite by suite, skips counted, nothing retried.
- **One check, `stack-free`, and one command, `npm test`**, for CI and for a contributor alike.
- **Shown stable before merge:** ten full runs in a row in a sealed Linux container on the final code, and every CI
  run of the pull request passing.

`[INFERRED]` What isn't covered:
- **A suite that hangs** still holds its part until the 40-minute guard, though the log now names it.
- **A failure later than 2 s after a suite's run**, or on a timer the suite unref'd, is lost.
- **The parts are balanced by file size**, not by how long their suites take.
- **Making any one suite faster.**
- **Required checks on `staging`**, which has none.

## 4. Domain model

`[INFERRED]`, from ADR `test-gate-speed/0001`. The entities are the gate's own, not graph concepts:
- **A suite:** a registered test file with a `run()` that returns counts passed, failed and skipped.
- **A unit:** one suite in one fresh process. Units are the registry's entries, with `operations`' 116 files (111 on
  this branch) as units of their own.
- **A part:** one runner's share of the units, `GATE_PART=<i>/<n>`, each unit in exactly one part.
- **A run:** one `npm test`, whole or one part. It writes a record (schema 2) that names the machine, the part, the
  units still running, and each unit's verdict, counts and time.
- **A stray:** a failure a unit's suite left that fires outside its `run()`, during its load or up to 2 s after its
  run, counted against that unit.

## 5. Design rules (as-built)

`[INFERRED]` Rules the ADR and its amendments set:
- **No retries, anywhere.** The first run's verdict stands, and a failed or cancelled CI run is never run again
  (OPERATIONS.md §15).
- **A failure seen only side by side is still a failure.** It gets a ledger row and a fix at its root. It is never
  moved out of the gate.
- **No suite may rely on another**, or on having the machine to itself.
- **Every suite runs in exactly one part**, and the parts add up to a whole run.
- **A required check's name is a contract**: `stack-free` is kept, so `main`'s ruleset needs no change.

`[UNKNOWN — product input needed]` What "fast enough" is now. The frame asked for half. On a slow runner the slower part
took 6 m 42 s, and nobody has said what wait would prompt the next round.

## 6. Carry-forward & open questions

From the build audit's §6:
- **Balance the parts by time, not file size**, if the slower part starts to set the check's time. The fix needs each
  suite's time from an earlier run, which CI doesn't keep (row `2026-11-22-gate-parts-balance-by-bytes`).
- **A per-unit time limit**, so a hung suite fails in minutes rather than holding its part for 40.
- **The CI log parser outside the repo**, which ledger measurements used, reads the old log shape.
- **OPERATIONS.md §15's stale "Required-check status" paragraph** (OPEN.md row 14).
- **Four harness `meta` rows** from the review rounds (audit §7).

## 7. What product must validate

- [ ] **The next speed target, if any.** Is a 5–7 minute verdict enough, or should the gate get faster as it grows? A third part, time-based balancing and per-unit limits are the levers.
- [ ] **Whether a late failure beyond 2 s matters.** The bound was chosen to keep the run's time. A longer wait costs every run that holds a network keep-alive open.
- [ ] **Whether `staging` should require `stack-free` too.** It has no required checks today, and `/cycle-staging` merges on the deploy-safety check, not on CI.
