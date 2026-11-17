# The derive step's parentJsonSchemas and the rule element-fits-schema judge different documents, so their verdicts split under some schemas

**Id:** 2026-11-16-derive-step-and-rule-check-split
**Type:** protocol
**Opened:** 2026-11-16 (story graph-operations-first-slice #20, review round 1, blocking finding 1; ADR graph-operations-first-slice/0020 Amendment 1, item 1)
**Status:** OPEN
**Done:** —

**What was seen.** The rule `element-fits-schema` (`src/operations/rules/element-fits-schema.js`, through `src/operations/catalog/graph/_schemas.js`) judges an element's stored JSON, its json tag, against the concepts whose class threads reach it.

The derive step (`src/lib/derivers/word.js`) judges its own `base` instead:
- the cached JSON, or the json tag's JSON when that has a `word` block, else `{}`;
- with `word` defaults filled in (`:78–82`) and its own `graphContext` added (`:122`);
- against the `ConceptHeader`s whose class threads reach the node within ten links, and those its `z` tags name.

Both read a schema the same way, so they agree under most schemas. They split:
- under firmware's `word` schema, which requires `graphContext`;
- under a schema that forbids extra top-level keys;
- for JSON with no word block;
- for a word block missing a field the derive step fills in (`word.slug`, `word.name` or `word.wordTypes`), such as under firmware's `validation-tool` schema, which requires `word.slug`;
- where the two judge different concepts.

Test SC9 (`test/operations/graph/element-schemas.test.js`) runs both, and pins the first four of these splits.

It matters now only to the writes that judge elements already made:
- `rules check` (A10.31) will report every element of the `word` concept as missing `graphContext`;
- the property operations' reports (A10.18) will have the same blind spot.

create-element refuses a concept keyed `word` (Amendment 1, item 2), so its writes don't meet it.

**Fix shape.** Decide which document a concept's schema describes, the stored json tag or the derived cache, and make the two readers judge the same one. Two ways:
- the derive step calls `_schemas.js` on the stored JSON (ADR 0020 Decision 11's "move together");
- or the rule's check form leaves the derive step's own sections out of what it requires.

Firmware's `word` schema may also want `graphContext` dropped from `required`, since no stored JSON can hold it. Decide this before A10.31 builds `rules check`.

**Pointer:** ADR graph-operations-first-slice/0020 Amendment 1; `engineering-team/reviews/graph-operations-first-slice/20-create-element.md` (blocking finding 1).
