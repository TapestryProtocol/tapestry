# A guarantee carried forward only in prose was dropped while every test stayed green

**Id:** 2026-11-22-carried-guarantees-need-their-tests
**Type:** meta
**Opened:** 2026-11-22 (story `test-gate-speed` #1, review round 1, harness friction 1)
**Status:** OPEN
**Done:** —

Story `test-gate-speed` #1's AC2 says "every guarantee of story `honest-test-gate` #1 and story `test-suite-hermeticity`
#4 still holds". One of those guarantees was dropped by the first engine of that story, and every test stayed green: a
failure a suite leaves for after its run, such as a throw on a timer or a deferred `process.exit`, fails the run. Story
`honest-test-gate` #1 says such a call "deferred past a suite's `run()` is a stray FAIL". But no test deferred it past
one macrotask, and the new engine waited exactly one before ending a suite's process. The independent reviewer caught it
by driving both engines over fixtures that fail 300 ms after their run. The fix, ADR `test-gate-speed/0001` Amendment 4,
added the missing guards (P24–P27).

Fix shape: when an acceptance criterion carries another story's guarantees forward, Test Design lists each one from that
story's own text and names the test that pins it, or adds one. A line in `engineering-team/workflows/3-test-design.md`
step 1, or in the test-plan template's coverage map, would do. Both are harness-definition paths, so the change owes a
CHANGELOG row.

**Pointer:** `engineering-team/reviews/done/test-gate-speed/1-stack-free-gate-in-half-the-time.md` § Blocking 1 and § Harness friction 1; `engineering-team/stories/honest-test-gate/1-gate-result-tells-the-truth.md:145–146`.
