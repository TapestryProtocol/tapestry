# Story 45's new graph-rule element failed firmware-element-sync on staging, and was fixed by a hotfix

**Id:** 2026-11-20-element-sync-misses-rule-eleven
**Type:** bug (a test that lists every graph-rule element; a hotfix's trace, `engineering-team/workflows/0-intake.md` step 3)
**Opened:** 2026-11-20 (Loom A10.31.a, story graph-operations-first-slice #45, after PR #164 merged into staging)
**Status:** DONE
**Done:** 2026-11-20, commit `805275a9`

**What was seen.** Story 45 added the graph-rule element `firmware/versions/v1.0.0/concepts/graph-rule/elements/property-has-one-parent.json`. `test/firmware-element-sync.test.js` names every graph-rule element in its `SCENARIO` map and in IS10's `others`, so with an eleventh element IS4, IS8 and IS10 failed: CI run 44759714425 on PR #164, `Overall: FAIL — 8223 passed, 3 failed`. The PR merged with that check red, so `staging` failed the same three.

The story's scoped gate, and the Reviewer's, ran the two rulebook suites (`graph-rules-builder`, `graph-rule-firmware`) but not this one, which is the third suite that pins the rule list.

**Fix.** Commit `805275a9` adds rule 11 to both lists, as story 19 did for rule 10. A scoped run of the three suites passes, 60 passed, 0 failed (`tmp/gate-runs/20261120T152232Z-71137-51de.json`).

**Lesson.** A new graph rule touches three suites that list the rules, not two: `graph-rules-builder`, `graph-rule-firmware` and `firmware-element-sync`. Add the rule to all three at Test Design.

**Pointer:** `test/firmware-element-sync.test.js`; PR #164; ledger row `2026-11-20-ci-gate-outgrows-its-timeout` (why a red check there was easy to misread).
