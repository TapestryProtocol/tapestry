# The test plan maps criteria to tests, not modules to tests, so a real module behind an injected seam can ship untested

**Id:** 2026-09-29-test-plan-misses-injected-seams
**Type:** meta
**Opened:** 2026-09-29 (tagging-edges #3 review, harness friction 2)
**Status:** OPEN
**Done:** —

**What was seen.** Story 3's engine takes all of its dependencies through a seam (ADR `tagging-edges/0003` T20), and
every suite injects fakes there. So the real `src/pipeline/tagging-edges/realtime/subscription.js`, the path's only
websocket client, ran in no suite: V8 coverage over all seven realtime suites executed 0 of its 167 lines. The test
plan's coverage map lists acceptance criteria against tests, and no row asks which suite loads each real module the
ADR adds. Two local end-to-end runs exercised the module live, which is evidence but not a regression test.

**Fix shape.** The test-plan template (`engineering-team/templates/test-plan.md`), or workflow 3, gains a table of the
real implementations behind injected seams. Each ADR "New file" or default dependency is named with the suite that
loads the real module, or with an explicit waiver (for example live-only, with the evidence that covers it).

**Seen again, 2026-11-07 (tagging-edges #7).** The status route's overdue verdict reads the schedule through an
injected `readScheduleEntries`, whose default calls the strict reader (`src/api/tagging-edges/index.js:51`). Every
overdue test injects it, and no status test reads the default, so swapping it for the lenient reader (which turns a
parse error into "no entry" instead of "cannot tell") would pass every suite (review
`tagging-edges/7-confirm-held-removals.md`, requested 4).

**Pointer:** `engineering-team/reviews/tagging-edges/3-real-time-path.md` § Non-blocking 8 and § Harness friction 2.
