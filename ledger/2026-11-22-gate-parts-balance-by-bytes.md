# The stack-free gate's two parts balance by file size, not by time

**Id:** 2026-11-22-gate-parts-balance-by-bytes
**Type:** cleanup
**Opened:** 2026-11-22 (story `test-gate-speed` #1, review round 1, non-blocking 3)
**Status:** OPEN
**Done:** —

`GATE_PART=<i>/<n>` places each suite, largest test file first, in the part whose files total the fewest bytes so far
(ADR `test-gate-speed/0001` Amendment 3). A file's size is only a rough guide to how long it runs:
- In the sealed container, part 2 held 920 unit-seconds to part 1's 539, so the parts took 232.7 s and 136.7 s. The
  three heaviest suites, `seed-firmware`, `nostr-send` and `schema-save-finds-the-right-header`, all landed in part 2.
- On CI, V1′'s parts took 444 s and 215 s, and the pull request's own head run took 340 s and 329 s.

AC1 still holds with room to spare, 0.328 of the old gate's time at worst. But the margin depends on how the split falls
as files are added, and the slower part sets the check's time.

Fix shape, if the slower part starts to set the verdict's time: balance by time rather than bytes. The engine would read
each suite's time from an earlier run's record, which CI doesn't keep between runs: a committed table of suite times,
refreshed now and then, would do. Until then, the part times in each run's log show whether the gap is growing.

**Pointer:** `test/helpers/gateRunner.js` (`partsOf`); ADR `engineering-team/decisions/test-gate-speed/0001-every-suite-runs-in-its-own-process-several-at-a-time.md` Amendment 3 and Amendment 4 ("The parts balance by bytes, not time"); `engineering-team/reviews/test-gate-speed/1-stack-free-gate-in-half-the-time.md` § Non-blocking 3.
