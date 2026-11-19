# A field whose `$ref` points at itself passes the property writes' check, then sends ajv into endless recursion on every check of its elements

**Id:** 2026-11-19-self-ref-field-recurses-rule-four
**Type:** bug (low: it needs a hand-written `$ref`, and nothing on any instance is known to have one; found by a probe, not seen on a stack)
**Opened:** 2026-11-19 (story graph-operations-first-slice #19's review round 2, non-blocking 5; the code is that of stories 18 and 20)
**Status:** OPEN
**Done:** —

**What was seen.** A property write can give a field a `$ref` that points at the field itself, such as `"$ref": "#/properties/bot/properties/field"`. The property writes' check of the whole schema, `schemaProblem` (`src/operations/catalog/graph/_properties.js`), finds no problem, since the schema compiles, so the write goes through. Judging any value at that field then sends ajv into endless recursion: the review's probe of a whole-schema check threw `RangeError: Maximum call stack size exceeded`. Rule 4's check (`judge` in `_schemas.js`) and the property writes' report (`reportOf`) compile the whole schema the same way. So each write that judges an element holding that field would answer 500: create-element, update-node and add-to-concept, and every property write's report on that concept. The derive step wasn't probed.

**Fix shape.** Either the property writes refuse such a schema when it is written, as they refuse one that doesn't compile, or the checks catch the throw and answer as they answer a schema that doesn't compile, so a stored one doesn't fail every write. A case in update-property's suite and one in element-fits-schema's pin it.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/19-enumerate.md` (round 2, non-blocking 5); `src/operations/catalog/graph/_properties.js` (`schemaProblem`, `reportOf`); `src/operations/catalog/graph/_schemas.js` (`compile`, `judge`); ADR graph-operations-first-slice/0018 (the property writes) and 0020 (rule 4's check).
