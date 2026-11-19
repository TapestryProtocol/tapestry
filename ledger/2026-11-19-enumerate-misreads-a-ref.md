# graph enumerate tries a property's piece alone, so a `$ref` in it can be named wrongly, or send ajv into endless recursion and answer 500

**Id:** 2026-11-19-enumerate-misreads-a-ref
**Type:** bug (low: each shape needs hand-written JSON Schema, and no test, seed or firmware concept has one; nothing changes, and no value gets through)
**Opened:** 2026-11-19 (story graph-operations-first-slice #19, `graph enumerate`: review round 2, non-blocking 2 and 3)
**Status:** OPEN
**Done:** —

**What was seen.** `graph enumerate` checks that a property's own schema, its piece, accepts a reference by compiling the piece alone, with rule 4's ajv options (ADR graph-operations-first-slice/0019 Decision 4 and Amendment 2; `tryReference` in `src/operations/catalog/graph/_enumerations.js`). Rule 4 compiles the concept's whole schema instead (`judge` in `_schemas.js`). So the `#` of a `$ref` is the piece in one compile and the whole schema's root in the other, and the two can judge a piece with a `$ref` differently:
- **A `$ref` into the piece's own `definitions` or `$defs`.** `refuses-references` names the keyword by its error's path, `its definitions`, and gives `'{"definitions": null}'` as the way out, which can't free the field.
  - When the piece has an `$id`, both compiles read the piece's own definition, so the refusal is right. But the way out leaves the `$ref` unresolvable, and update-property refuses that write `bad-schema`.
  - When the root's `definitions` hold the same name, rule 4 reads the root's definition, and may accept a reference at the field that enumerate says the schema refuses. After the way out, enumerate refuses the piece as one that "doesn't compile on its own".
  - A list whose items reach the piece's `definitions` is named `its definitions`, not the items'.
  - With no `$id`, and no such name at the root, it never gets this far: the whole schema doesn't compile, and `P.load` refuses the concept first (`unreadable-schema`).
- **A `$ref` that refers to itself,** such as `{ "type": "string", "$ref": "#" }` or a list's `"$ref": "#"`. Inside the whole schema, `#` is the concept's root, an object, so rule 4 refuses a string there by its type and nothing recurses, and update-property takes the piece. Alone, `#` is the piece itself: the check throws `RangeError: Maximum call stack size exceeded`, which escapes `acceptsReference`, and enumerate answers 500. Its transaction rolls back, so nothing changes. Story 19's first code did the same. An items' `"$ref": "#/items"` throws the same way alone, but inside the whole schema it points at the root's `items`, which a wrapped schema doesn't have, so update-property refuses it `bad-schema`: it reaches enumerate only under a root with an `items` keyword of its own (review round 3).

**Fix shape.** Either of these:
- name what an error's path reaches through: when it starts at `definitions` or `$defs`, the `$ref` that reaches it, with `'{"$ref": null}'`, or the items' way when that `$ref` is under `items`; and have `tryReference` catch a throw from the check and answer as it does for a piece that can't be tried alone, naming the `$ref`;
- or try the piece in place, inside the whole schema, where its `$ref`s resolve as rule 4 resolves them. That settles both, and also the false refusal of a piece whose `$ref` points into the root's `definitions` (review round 2, non-blocking 4).

A case pinning the words for a piece that doesn't compile alone belongs with the fix: none does today.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/19-enumerate.md` (round 2, non-blocking 2–4); `engineering-team/stories/graph-operations-first-slice/19-enumerate.md` (Deviations, "A keyword reached through a `$ref`"); `src/operations/catalog/graph/_enumerations.js` (`refusingKeywords`, `tryReference`, `say.refusesReferences`); ADR graph-operations-first-slice/0019, Decision 4 and Amendment 2.
