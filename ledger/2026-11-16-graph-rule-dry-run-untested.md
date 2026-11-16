# No test checks that a firmware install's dry run skips the graph rule concept's updateElements path

**Id:** 2026-11-16-graph-rule-dry-run-untested
**Type:** cleanup
**Opened:** 2026-11-16 (story graph-operations-first-slice #41; its review, round 2, non-blocking 4)
**Status:** OPEN
**Done:** —

**What was seen.** Pass 1b's `updateElements` branch in `src/firmware/install.js` sits after `if (dryRun) continue;`, so a dry run neither looks elements up nor re-signs them. That is right today, but nothing pins it. The stubbed-install tests (IS4 to IS10 in `test/firmware-element-sync.test.js`, through `test/helpers/pass1bChild.js`) all run `pass1_bootstrap({})`, never with `{ dryRun: true }`.

**Fix shape.** One more child run with `{ dryRun: true }`: no lookup, no `regenerateJson`, no create-element, for the graph rule concept or any other. The child already records each of those.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/41-graph-rule-concept.md` (Round 2, non-blocking 4).
