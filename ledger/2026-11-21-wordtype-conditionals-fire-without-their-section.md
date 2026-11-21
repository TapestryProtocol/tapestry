# A wordType conditional's Forward rule fires on an element with no section for its field, so the element's verdict blames its `wordTypes`

**Id:** 2026-11-21-wordtype-conditionals-fire-without-their-section
**Type:** bug
**Opened:** 2026-11-21 (writing the bot team tapestry into david.tapestry.ninja's Neo4j as Zeus: `graph create-element` in *tapestry*, then `graph add-to-concept` in *graph*)
**Status:** OPEN
**Done:** —

**What was seen.** `graph create-element` made the tapestry with its `tapestry` section and no `graph` section, which only the second write adds. Tapestry's superset sits inside graph's, so the element is in *graph* too, and the call reported graph's verdict: 16 problems.
- One is real: "`graph` is required".
- The other 15 say the element's `wordTypes` (`word`, `tapestry`, `graph`) must contain `conceptGraph`, `coreNodesGraph` and `propertyTreeGraph`. Each of the three gets five problems:
  - "must be equal to constant", once for each of the three entries of `wordTypes`;
  - "`word.wordTypes` must contain at least 1 valid item(s)";
  - "must match "then" schema".

Once `graph add-to-concept` gave the element its `graph` section, with `graphType: tapestry`, graph's verdict was `fits`.

- **Why.** The enumeration step writes a pair of rules for each value of a field whose manifest entry turns `enforce-wordType-conditionals` on. Those fields are `graph.graphType` and `dog.breed` (`firmware/versions/v1.0.0/manifest.json:418` and `:448`). The pair:
  - Forward: if the field is X, `wordTypes` must contain X;
  - Reverse: if `wordTypes` contains X, the field must be X.

  The Forward's `if` is `{ properties: { graph: { properties: { graphType: { const: X } }, required: ['graphType'] } } }`. It requires the field inside its section, but not the section itself. `properties` holds for a key that isn't there, so with no `graph` section every Forward rule fires. The rule for the element's own graph type passes, and the other three fail.
- **Where.** `generateWordTypeConditionals` (`src/api/normalize/index.js:6059` on staging `cae6e1cb`) builds the `if` from the inside out (`:6097–6107`), and adds `required` only on the field's parent. Firmware's dog schema file has the same shape in its committed Forward rules (`firmware/versions/v1.0.0/concepts/dog/json-schema.json`, from `:82`).

**Why it matters.** Nothing is refused: another concept's verdict never stops `create-element`, and the noise goes once the section is there. But the verdict points at the wrong field, and acting on it does harm. Checked against graph's live schema, compiled as `src/operations/catalog/graph/_schemas.js` compiles it:
- Add the three graph types to `wordTypes`, and the step-1 JSON shows only "`graph` is required".
- The step-2 JSON then fails three Reverse rules: `graph.graphType` must be `conceptGraph`, `coreNodesGraph` and `propertyTreeGraph`.
- `add-to-concept` refuses JSON that doesn't fit the concept's schema, so it would refuse that step 2.

A tapestry made with `create-element` first and `add-to-concept` second shows the noise between its two writes, and an agent making one reads that verdict.

**Fix shape.** Add `required: [<the path's first part>]` to each Forward rule's `if`, beside its `properties`, so the rule applies only when the section is there. Checked the same way on 2026-11-21, with the four Forward rules of graph's live schema patched:
- the step-1 JSON gives one error, `graph` missing, where the live schema gives 16;
- the step-2 JSON fits under both schemas;
- three controls give the same results under both:
  - `graphType` `conceptGraph` with `wordTypes` lacking it: 4 errors;
  - the same with `wordTypes` holding it: fits;
  - `wordTypes` holding `tapestry` with `graphType` `conceptGraph`: 7 errors.

Leave the Reverse rules as they are. With no section, the schema's top-level `required` already reports it, in graph's schema and in dog's.

Make the same change in dog's committed file. Story 46's suite (`test/word-elements-fit-the-installed-word-schema.test.js`) finds a pair by the paths its `if` and `then` reach (`ties`, `:260`), and the added `required` doesn't change those paths. An instance's schemas change only at its next firmware reinstall, as in ledger row `2026-11-20-word-wordtypes-switch-awaits-firmware-reinstall`.

**Pointer:** `src/api/normalize/index.js` (`generateWordTypeConditionals`); `firmware/versions/v1.0.0/manifest.json`; `firmware/versions/v1.0.0/concepts/dog/json-schema.json`; ledger row `2026-11-17-word-wordtypes-conditionals-contradict-themselves`, an earlier bug in the same generator, for `word.wordTypes`.
