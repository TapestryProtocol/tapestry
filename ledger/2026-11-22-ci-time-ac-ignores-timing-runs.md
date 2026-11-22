# An acceptance criterion about "every CI run" clashed with the measurement runs the same story's ADR planned

**Id:** 2026-11-22-ci-time-ac-ignores-timing-runs
**Type:** meta
**Opened:** 2026-11-22 (story `test-gate-speed` #1, review round 1, harness friction 3)
**Status:** OPEN
**Done:** —

Story `test-gate-speed` #1's AC1 said every CI run of the story's pull request gives its verdict in under 12 minutes. Its
ADR's Decision 11 planned measurement runs on that same pull request, each running today's whole gate before the new
one, which take about 30 minutes by design. Both were approved, and three such runs took 31 to 35 minutes. Review round 1
found the clash; AC1 now names the timing runs as the exception.

Fix shape: Planning, or Architecture when it plans measurement runs, words an acceptance criterion about "every CI run"
so that it names any planned measurement runs as the exception. A line in `engineering-team/workflows/1-planning.md`'s
pitfalls, or in the Architect's notes on verification steps, would do. Both are harness-definition paths and owe a
CHANGELOG row.

**Pointer:** `engineering-team/reviews/test-gate-speed/1-stack-free-gate-in-half-the-time.md` § Harness friction 3; story AC1; ADR `test-gate-speed/0001` Decision 11.
