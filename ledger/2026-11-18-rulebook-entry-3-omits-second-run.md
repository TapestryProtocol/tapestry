# The rulebook's entry 3 says field-mark-allowed is enforced by mark-field's guard, but not that mark-field runs it again after it takes the concept header's lock

**Id:** 2026-11-18-rulebook-entry-3-omits-second-run
**Type:** docs
**Opened:** 2026-11-18 (story graph-operations-first-slice #43's review round 1, non-blocking 5; ADR graph-operations-first-slice/0018 Amendment 4, item 5)
**Status:** OPEN
**Done:** —

**What was seen.** Story 43 (Loom A10.18.a) made `graph mark-field` take the lock on the concept's header as its first write, then run `field-mark-allowed` again. The write path runs a guard before that lock.
- `docs/GRAPH_RULES.md` §4, `concept-slug-unique`, names its guards' second run after their lock: "run again after each takes its lock".
- §3, `field-mark-allowed`, still says only "the guard of `graph mark-field`". That still holds, but it leaves out the second run.
- Story 43 left §3 as written. `src/firmware/graph-rules.js` copies each entry's "Enforced by" into firmware's graph-rule element, and its `--check` test fails while the committed element differs. So the change would alter firmware's rule 3 element, and need a firmware reinstall on every instance, for wording alone.

**Fix shape.** The next change that touches firmware's rule 3 element, `firmware/versions/v1.0.0/concepts/graph-rule/elements/field-mark-allowed.json`, also adds to §3's "Enforced by": "run again after it takes the lock on the concept's header, so a property write at once can't change or take out the field between the two". Then it runs `node src/firmware/graph-rules.js` and the reinstall that change needs anyway.

**Pointer:** `docs/GRAPH_RULES.md` §3 ("Enforced by") and §4; ADR 0018 Amendment 4, item 5; story 43's review, non-blocking 5.
