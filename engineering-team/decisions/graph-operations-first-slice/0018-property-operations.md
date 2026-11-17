# ADR 0018: The property operations — each property node holds its piece of the concept's schema, and every write rewrites the schema node from them

**Status:** Accepted
**Date:** 2026-11-17
**Story:** `engineering-team/stories/graph-operations-first-slice/18-property-operations.md`

## Context

Story 18 asks for four writes with no event: `graph add-property`, `update-property`, `remove-property` and `set-schema`. Its criteria:
- AC1, AC3–AC5: the four writes, each safe to repeat.
- AC2: after every write, a concept's JSON Schema is exactly what its properties say. The first write on a concept gives the fields its schema already lists their property nodes.
- AC6: a report on the elements that stop fitting, never a refusal.
- AC7: the refusals, a marked field's among them.
- AC8: own concepts only, the letter reported, two writes at once both safe.
- AC9: it lasts, and it reaches agents.

What the code and the graph offer, on staging at `a5204027`:

1. **Every reader reads the schema node.**
   - `_schemas.schemaOf` runs E1 (`src/operations/catalog/graph/_schemas.js:64–91`). It reads the concept's one `JSONSchema` node's json tag, takes its `jsonSchema` section, and drops `$schema`.
   - The derive step, the concept pages, the Health Audit and today's routes read the same node.
   - So whatever these writes decide is the truth, the schema node has to hold the result.
2. **The tree's layout.**
   - BIBLE §9: the JSON schema ← the primary property ← top-level properties ← nested properties. Each link is `IS_A_PROPERTY_OF` (firmware's `PROPERTY_MEMBERSHIP`).
   - `_fields.js` reads a field's node there (S2, `:150–175`): the node named for the field, hanging on the concept's section node. That is the primary property when the schema is wrapped (its only top-level key is the concept's key), else the primary property's child named for the key. The marks (S3, `:185–217`) hang on those nodes.
   - A node today's create-property hangs off the schema node doesn't count.
3. **No field has a property node here.** On the local instance (2026-11-17) the only `Property` nodes are the 49 concepts' primary properties. `graph create-concept` gives a concept three fields in its schema, `name`, `slug` and `description`, and no node for any of them (ADR 0016, Decision 12).
4. **Firmware's `property` concept says what a property node holds** (`39999:<TA>:property-schema`, read from the graph). Its section `property` requires:
   - `key`, "the property name — becomes the key in the parent JSON Schema";
   - `type`, a string from an enum of eight: the seven JSON Schema types and `regex`.

   It also describes:
   - `description` and `title`;
   - `required`, an array: "which child properties are required";
   - `properties`, an object: "inline child property definitions";
   - `enum` (an array), `format` and `pattern`;
   - `default`, which must be a string;
   - `x-tapestry`, which, when present, must hold two booleans, `requiredByParent` and `unique`.

   Today's create-property and generate-property-tree write `property: { name, type, description, required: <a boolean> }`. That has no `key`, and a boolean `required`, so it doesn't fit. The primary property create-concept writes does fit: `{ key, title, type: 'object', required: [...], properties: { <field>: { type } } }` (`_concepts.js:240–256`).
5. **Firmware's other core-node concepts.**
   - `json-schema` requires the schema node's `jsonSchema` to hold `$schema`, `type`, `required`, `definitions` and `properties`.
   - `primary-property` requires `primaryProperty.description`.
   - `property-tree-graph` requires `propertyTreeGraph.description`.
6. **The hygiene check pins the primary property's record.** `comparePropertyRecord` (`src/lib/brain/hygiene.js`; save-schema's fold and the brain's hygiene route call it) wants the record's `properties` keys, each one's `type`, and its `required` list to agree with the schema's section.
7. **Today's two directions, both signing.**
   - **Schema to tree.** `generate-property-tree` (`src/api/normalize/index.js:3654–3896`) signs a property for each schema property. Its d-tag is `<slug>-<sha256(parent uuid), first 8>`, which is `dtag.childDTag(name, parentUuid)` and BIBLE §9's rule. It wires `IS_A_PROPERTY_OF` to the parent and `HAS_ELEMENT` from the `property` concept's superset, and unhooks the nodes the schema no longer has. It hangs a list's item fields under the list's node.
   - **Tree to schema.** `/api/property/generate-json-schema` (`src/api/property/index.js`) reads `type`, `description`, `enum`, `format`, `pattern`, `default` and a boolean `required`. It turns a list that has children into an object, and drops `items`.
8. **The schemas in use.**
   - create-concept's schemas are wrapped. The section carries `name`, `title`, `slug`, `description`, `required` and `x-tapestry.unique` beside its three fields.
   - Of the local instance's nine own concepts that aren't firmware's, four are wrapped. Five keep their elements' fields under another key (`proposal`, `workRecord`, …), so the story's set-schema refuses their schemas: there is no object under the concept's key.
   - Firmware's `dog` schema has two top-level keys, `word` and `dog`, and an `allOf`.
9. **update-concept's rename edits template text only.** `renameRows` (`_concepts.js:673–717`) changes a core node's JSON only where it still holds what the old names' template made. So it can change the schema node's titles and descriptions, and nothing else.
10. **The reports' judge.**
    - ADR 0020a decided that a concept's schema describes a node's tapestryJson, and that A10.18's reports call the rule when they act (Decision 7).
    - ADR 0042 (story 42, Loom A10.20.b, accepted 2026-11-17) adds `_schemas.tapestryJsonOf(node)`, which the rule's check form reads an element with. That form sets nothing aside for a node as it stands.
    - ADR 0020a's Decision 11 puts that build before A10.18 judges elements. Story 42 was at Test Design when this ADR was written.
11. **What the writes already share.**
    - The write path: guards, one transaction, the change entry (ADR graph-operations-foundation/0004).
    - `E.makeNode`, the node with no event (ADR 0016, Decision 1).
    - `S.lockNode` on a concept's header, which create-element and delete-node take.
    - `F.writeCopies`, one statement that sets node and tag values.
    - update-node's rule: JSON goes inline, even over an `lmdb:` reference.
    - delete-node's whole-node record in its change entry, and its `already-gone` lookup (`delete-node.js:36–55`, `:120–134`).
12. **The other writes leave property nodes alone.**
    - update-node and delete-node refuse a property node or a schema node (`made-elsewhere`). They name "graph set-schema (A10.18)" and "graph update-property (A10.18)" (`_elements.js:108–128`).
    - create-element refuses to make an element of `property`, naming graph add-property (`:88–100`).
13. **The rule `field-mark-allowed`'s `no-property-node` refusal** points to `POST /api/normalize/generate-property-tree`, which signs (`docs/GRAPH_RULES.md` §3).

Concepts touched, by handle (`<TA>` is the instance's assistant, `GET /api/assistant/pubkey`):
- `39998:<TA>:property`: its elements, the property nodes, gain members.
- `39998:<TA>:primary-property`, `39998:<TA>:json-schema` and `39998:<TA>:property-tree-graph`: each concept's node of that kind is rewritten.
- `39998:<TA>:neo4j-property`: read, for the marks.
- `39998:<TA>:graph-rule`: rule 3's element text.
- No concept's definition changes.

## Options considered

### Option A — The property nodes hold the schema, piece by piece; the schema node holds what is above the fields, and a copy rebuilt from them

Each property node holds its own piece of the schema: everything the schema says about that field except its children, which are nodes of their own. The primary property holds the section's own piece. The schema node keeps what the schema says above the section, the **frame**. Every write rebuilds the section from the tree and rewrites the schema node, in the same transaction, so the readers of fact 1 see the change with no change of their own.

- **Pros:**
  - It is D10 and BIBLE §30 as written: the schema is recomputable from the tree, and a write changes the properties, never the schema directly (catalog §2).
  - No reader changes, and the files story 42 is editing are left alone.
  - Marks keep hanging on nodes that outlive every write.
- **Cons:**
  - The schema node holds a copy, which these writes keep in step, and which update-concept's rename can move ahead of the tree (fact 9).
  - Each piece has to live somewhere firmware's `property` schema doesn't reject (fact 4).

### Option B — The schema node stays the authority; each write edits it, then rebuilds the tree from it

The writes do what save-schema and generate-property-tree do, without signing: edit the schema at the field's place, then make the tree match.

- **Pros:** simple, and every keyword is kept for free.
- **Cons:**
  - It runs the way D10 and the catalog say it shouldn't: the schema decides, and the tree is a projection that a rebuild couldn't recompute the schema from (BIBLE §30).
  - The property nodes would hold no definitions of their own.

### Option C — The property nodes are the only store; `_schemas.js` computes the schema from the tree whenever it reads one

- **Pros:** no copy to keep in step.
- **Cons:**
  - Every reader of fact 1 changes now, in files story 42 is editing.
  - Every check walks a tree.
  - A concept with no tree, which is every concept today, has no schema until something writes one, and a read can't write.

## Decision

We chose **Option A**. It is the only one that keeps the readers as they are, and it makes the tree the authority D10 asks for.

**1. What each node holds.**
- **A property node's JSON** (its json tag) is word-wrapper JSON with two sections:

  ```json
  { "word": { "slug": "breed", "name": "breed", "wordTypes": ["word", "property"] },
    "property": { "key": "breed", "type": "string", "description": "The breed for this dog",
                  "schema": { "type": "string", "description": "The breed for this dog", "enum": ["goldenRetriever", "irishSetter"] } } }
  ```

  - **`property.schema` is the piece:** the field's definition exactly as the concept's schema holds it, minus the contents of its `properties`, which are its children's.
    - When the definition has `properties`, the piece keeps an empty `properties: {}` where it was. Section 2 puts the children back there.
    - Its `required` list, its `x-tapestry` and every other keyword stay as written.
    - That makes the piece the authority for the field. It also keeps it clear of firmware's `property` schema (fact 4), whose `default` must be a string and whose `x-tapestry` holds two booleans; create-concept's sections hold an `x-tapestry.unique` list.
  - **The rest of `property` is the `property` concept's view of it,** rebuilt from the piece on every write:
    - `key`: the field's name;
    - `type`: the piece's type, or the first non-null type of a list of them;
    - `title` and `description`: when the piece has them as strings;
    - `required`: when the piece has a `required` list;
    - `properties`: for an object, its children as `{ <key>: { type } }`, in their order.

    That is the shape create-concept's primary property already has (fact 4). It is what the hygiene check reads (fact 6), and what the concept page's Properties tab shows as the type.
- **The primary property** is the section's node. Its `property.key` is the concept's key, and its `property.schema` is the section's piece (`properties[<key>]` minus its fields). Its `word` and `primaryProperty` sections stay as they are.
- **The schema node** keeps its `word` block. Its `jsonSchema` is the frame with the section put back:

  ```js
  { ...frame, properties: { [key]: section } }
  ```

  The frame is everything the document holds except `properties`: `$schema`, `type`, `name`, `title`, `description`, `required`, `definitions`, `allOf`, and the rest.
- **The property tree graph's `graph`** lists the schema node, the primary property, the properties set and every property node, each as `{ slug, uuid }`. Its relationships are the primary property's `IS_A_PROPERTY_OF` to the schema node, and each property's to its parent, in create-concept's shape (`_concepts.js:268–287`). It is rewritten whenever it changes, and its `propertyTreeGraph` section stays.

**2. The section, rebuilt from the tree.**
- A node's definition is a copy of its piece. If the node has children, or its piece has the empty `properties`, `properties` holds each child's definition under the child's key, in turn.
- Children come in the order its view's `properties` lists them, then any child that list lacks, by key. So set-schema keeps the order it was given, and add-property adds at the end.
- Two documents are the same when they are equal with each object's keys sorted. Arrays keep their order.

**3. Only a wrapped schema** (this narrows the story's AC5 and AC7; the owner approves it with this ADR).
- A schema these writes accept or keep is one whose top level:
  - has a `properties` with exactly one key, the concept's;
  - has an object under that key, with `type: 'object'`;
  - has `type` `object`, or none.
- Anything else is refused `not-wrapped`, naming the keys it found. That covers set-schema's input. It also covers a concept whose current schema isn't wrapped, as the first write finds it (Decision 6).
- **Why:**
  - A wrapped schema is the only one with one place for the concept's fields. `_fields.js` reads a wrapped concept's fields straight off its primary property (fact 2).
  - Every own concept that keeps its fields under its own key here is wrapped (fact 8).
  - A second top-level key, as firmware's `dog` has, would need the tree's other layout, which only firmware concepts use, and these writes refuse those.
- **The frame keeps what the `json-schema` concept requires** (fact 5). Each write fills in what the frame lacks of `$schema` (draft 2020-12's URI, as save-schema and create-concept write it), `type: 'object'`, `required: []` and `definitions: {}`.
  - Each one filled in is named in the answer's `filledIn`.
  - So set-schema reads back as the schema given, but for what `filledIn` names (AC5).

**4. What a field may be.** In set-schema's schema, at every level under the section through `properties`, and in a piece:
- **A type.** A definition has a `type`: one of the seven, or a list of them with none repeated. A field with none, such as `{ "$ref": … }` or `{ "enum": [...] }` alone, is refused `bad-type`, naming its place. A property node must have a `type` (fact 4), and this narrows AC5 for such fields.
- **A key.** Each one passes create-concept's name check exactly as given: `CN.cleanName` leaves it as it is, and `CN.nameProblem` finds nothing. It also isn't `__proto__`, which a JSON object built by assignment can't hold (ledger row `2026-11-17-concept-key-can-be-proto`). Else `bad-name`, naming the place.
- **A size.** At most 32 levels under the section, and 1,000 properties in all. Else `schema-too-large`: one transaction holds every node, and every node goes into the change entry.
- **A list keeps its items.** A list's `items`, objects or not, stay in its piece. Their fields are not properties of their own, so `parent` can't name a list.
  - Firmware's `property` schema and `_fields.js` have no place for an item's fields, and no mark carries an object.
  - generate-property-tree's habit of hanging item fields under the list isn't kept (fact 7).
  - The story's open Architecture question is answered here: update-property's `schema.items`, and set-schema, change a list's item fields.

**5. A new property node** is the node the import would make of the letter today's create-property would sign, corrected (ADR 0016, Decision 1):
- **Its address:** `39999:<TA>:<dtag.childDTag(key, parent's uuid)>`, BIBLE §9's d-tag. When a node holds that address, the first free `~1` to `~99` is used (create-set's search), and past that it refuses `no-free-address`.
- **Its node:** kind 39999 and the assistant as its would-be author. Its labels are `ListItem:Property`, with no `NostrEvent`. Its name and tapestryValue are its key (D11). It is made with `E.makeNode`.
- **Its tags,** in create-property's order:
  - `d`;
  - `name`, its key;
  - `description`, only when it has one;
  - `type`, the view's type;
  - `z`, the `property` concept's address;
  - `json`, the JSON of Decision 1.
- **Its relationships:** `IS_A_PROPERTY_OF` to its parent, and `HAS_ELEMENT` from the `property` concept's superset. That membership is the one a reinstall leaves on the primary property (ADR 0016, Amendment 2). No other is wired: `word`, and the rest, reach it through class threads.
- A property node's `name` tag never changes, since no write renames a field.

**6. Catching up: the first write on a concept** (AC2).
- **When.** Every write first reads the concept's tree and its current schema. They are **in line** when all three hold:
  - every node in the tree has a piece;
  - no node has two parents;
  - Decision 2's section, rebuilt from the tree, is the current schema's section.
- **What.** When they aren't in line, the write first makes the tree match the current schema, exactly as set-schema given that schema would (Decision 7.4):
  - each field with no node gets one;
  - a node whose piece differs, or that has none, as nodes today's routes made have none, is rewritten from the schema;
  - a node among the fields that the schema doesn't list comes out, kept whole in the change entry.

  Its changes are marked `catchUp: true`, and the answer's `caughtUp` lists them apart from the write's own.
- **The schema decides, while catching up.** It is what every element was checked against and what every reader reads (fact 1). After update-concept's rename moved its titles ahead of the tree (fact 9), it is the newer of the two.
- **A current schema that can't be caught up to** is refused `unreadable-schema`, naming set-schema, which replaces it. That covers one that can't be read, isn't an object, doesn't compile, isn't wrapped (Decision 3), or breaks Decision 4. set-schema itself is never refused for it: it makes the tree match its own schema, against the tree as it is.

**7. The four writes.** Each runs in this order, so a refusal changes nothing:
1. inputs that need no graph;
2. `not-installed`: no assistant key, or no `property` concept with a superset;
3. the lock on the concept's header (Decision 11);
4. the concept, which must be this instance's own, as update-concept tells it (`update-concept.js`):
   - `unknown-concept`;
   - `not-own-concept`, when the header's author isn't the assistant;
   - `firmware-concept`;
   - `no-schema`, for no JSON schema node or more than one;
   - `no-primary-property`, for none or more than one;
5. the tree:
   - `tangled-tree`, for a node with two parents, or one more than 32 levels down;
   - `not-own-node`, for a node the write would change that came from another author's event;
6. catching up (Decision 6);
7. the write's own change;
8. the marks (Decision 8);
9. the new document, which must compile (`bad-schema`) and keep within Decision 4's size;
10. the writes;
11. the checks on what was written (Decision 10);
12. the report (Decision 9).

**7.1 add-property.**
- **Its inputs:**
  - `concept`;
  - `name`, cleaned with `CN.cleanName` and checked as Decision 4 checks a key;
  - `type`, one of the seven;
  - and optionally:
    - `required`, a boolean;
    - `description`, trimmed, and checked with `CN.descriptionProblem` (`bad-description`);
    - `parent`, the tapestryKey of one of this concept's object properties. Else `bad-parent`, which also covers the primary property and a list;
    - `schema`, the piece: an object, or its JSON text.
- **The piece** is refused `bad-schema` when it isn't an object, when it holds `properties` or `required` (sub-properties are properties of their own), or when it gives a `type` or `description` other than the input given beside it.
- **The definition** is the piece with `type` and `description` set from the inputs.
- **A child of the parent with that key already:**
  - with the same definition, and the same required flag, the write answers `already-exists`, untouched;
  - otherwise it is refused `name-in-use`, naming what differs.

  Catching up comes first, so a field the schema already lists but has no node for gets its node there, and the call then answers `already-exists` or `name-in-use`.
- **Else** the node is made (Decision 5), and added last to its parent's view. With `required`, its key is added to the parent's piece's `required`.

**7.2 update-property.**
- **Its inputs:** `property`, and any of `type`, `required`, `description` and `schema`.
  - `schema` merges into the piece: each keyword given takes its value, and a `null` takes one out.
  - `type` and `description` set those keywords. An empty `description` takes it out.
  - `required` adds the key to the parent's piece's `required`, or takes it out.
- **Refusals, besides Decision 7's:**
  - `nothing-to-change`, when none is given;
  - `unknown-property`: the key names no property of a concept, or names a concept's primary property. That is checked after the lock, and after catching up, which can take a stray node out;
  - `has-properties`: a type other than object for a property that has properties under it.
- A type away from object takes out the piece's empty `properties` and an empty `required`.
- The same values answer `unchanged`, with no entry.

**7.3 remove-property.**
- **Its input:** `property`.
- The property and every property under it come out, each kept whole in the entry (Decision 12).
- The parent's piece loses the key from its `required` and from `x-tapestry.unique`. The parent's view loses it.
- **A key with no node:**
  - answers `already-gone`, naming the entry that records its removal (Decision 12);
  - or is refused `unknown-property`, when no entry records one.
- Catching up can take the property out itself. Then the answer is `removed`, and the entry marks that change `catchUp`.

**7.4 set-schema.**
- **Its inputs:** `concept` and `schema`, an object or its JSON text. The schema is taken as the schema node's `jsonSchema`, the document itself.
- **The schema** has to compile, read as `_schemas.js` reads one, and keep to Decisions 3 and 4. Else `bad-schema`, `not-wrapped`, `bad-type`, `bad-name` or `schema-too-large`.
- **Matching, by path:** each field in the schema is matched to the node at the same place: the same parent node, and a child with that key.
  - **added:** a field with no node;
  - **changed:** a node whose piece or required flag differs;
  - **removed:** a node at a place the schema doesn't have, with all under it. That covers an object turned into a string: its children come out.
- **The answer** lists each of the three, against the schema as it was before the call, after catching up. The frame becomes the given schema's, with Decision 3's fill-ins.
- The same schema again answers `unchanged`, with no entry.

**8. Marked fields** (the owner's answer at the story gate).
- **What is marked:** each node `F.marksOf(read, { concept })` names.
- **What is refused,** `marked-field`, naming `graph unmark-field`:
  - a write that would remove a marked node, or a node a marked node hangs under. That covers remove-property, set-schema, and catching up;
  - a write that would change a marked node's type, or its list's item type. That covers update-property, set-schema and catching up.
- **What isn't:** a change to a marked field's description, required flag, or anything else.
- This is stricter than rule 3's check, which names a mark only when its field stops being a plain value, so the check never finds what these writes made.

**9. The report on the concept's elements** (AC6). It is the rule's own check, run twice over the same documents. The rule's `{ node }` form reads the schema from the graph, one schema per call, and a report needs two: the schema before and the schema after. So the report uses the check's parts in `_schemas.js` directly. Its verdicts are the rule's by construction, and a test pins that its "after" verdicts are the rule's `{ node, concept }` verdicts once the write is done.
- **The elements:** `F.elementsOf(read, concept, 10,001)` (F.MAX_ELEMENTS + 1), the class-thread walk. When there are more than 10,000, the first 10,000 are judged and `beyond` is true.
- **Each element's document:** `_schemas.tapestryJsonOf(key)` (ADR 0042, Decision 1). A problem there counts the element as not judged, by its reason (`missing`, or `unreadable`).
- **The two schemas:**
  - **before:** the document `_schemas.schemaOf` reads before the write;
  - **after:** the document this write will store, with `$schema` dropped as `_schemas.js` drops it.

  Each is compiled once with a new `_schemas.validatorOf(schema)`, which gives `check(json) → { fits, problems }`, or `{ problem }` when it doesn't compile. It uses `_schemas.js`'s own compile and `problemOf`, so its words are the rule's. Nothing is set aside: these are elements as they stand (ADR 0042, Decision 2).
- **The answer's `elements`:**
  - `judged`, and `notJudged` with a count for each reason;
  - `stoppedFitting`: each element that fits before and not after, with its problems (at most 20, as `listProblems` lists them), at most 50 elements, with a count of them all;
  - `alreadyNotFitting`: a count;
  - `stillHold`: for remove-property, and for set-schema's removals, each element whose document has a value at a removed field's place under the concept's key. At most 50, with a count;
  - `before`: the problem when the schema before can't be judged. Then every element that doesn't fit after is listed as `stoppedFitting`;
  - `limit` and `beyond`.

  None of it refuses.
- **Until A10.20.c,** an element made since the last derive pass has no tapestryJson, so it counts as not judged (`missing`). That is the rule's verdict, as it is.

**10. What is written is checked** (D9; ADR 0020, Decision 16). After the writes, inside the transaction, `_schemas.checkElements(read, items, { every: true })` runs over one `{ concept, json }` item for each node written and each concept it is an element of (`F.conceptsOfNodes`), but those keyed `word` or `graphContext` (`_elements.RESERVED_KEYS`). The nodes written are property nodes, the primary property, the schema node and the property tree graph. So a node that doesn't fit its concept's schema is refused `invalid-fields`, and the whole write rolls back. By construction this only catches a bug, or a frame that Decision 3's fill-ins missed.

**11. The lock** (AC8).
- **Who takes it:** each write takes `S.lockNode` on the concept's header, the lock create-element and update-node take on it.
- **When:** add-property and set-schema take it before they read anything. update-property and remove-property find the property's concept first, with `(p)-[:IS_A_PROPERTY_OF*1..32]->(:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)`, then lock `h`, then read again.
- **What it gives:** two writes to one concept go one after the other, and an element write beside a property write waits too. After the lock, a property another write removed is gone, so the second remove answers `already-gone`, and an update answers `unknown-property`.

**12. The change entries.** New change names, each with `concept`, `node` (the property's tapestryKey), `field` and `path` (the keys from the section down):
- `property-added`, with `now: { schema, required }`;
- `property-changed`, with `was` and `now` alike;
- `property-removed`, with `was`, the node read whole as delete-node reads it: labels, properties, tags, relationships and the JSON an `lmdb:` value held. So a mistake can be undone from the entry alone;
- `schema-changed`, for the schema node, with `node` its tapestryKey and `was` and `now` the two documents.

A change made while catching up has `catchUp: true`. `CHANGE` in `changes.js` documents `path`, `catchUp` and these `was` and `now`. A repeat of remove-property finds its entry as delete-node finds a deletion's, by a `property-removed` change naming the key.

**13. Letters and the cache.**
- `letterOutOfDate` is true when a node this write changed or removed has a letter: a schema node, a primary property or a tree graph today's create-concept signed, or a property node generate-property-tree signed. `export nostr` (A10.34) sends new ones.
- `cacheOutOfDate` is true when one of them has a cached tapestryJson, as update-node answers it, until A10.20.c's derive after a write.

**14. The answers.** Each declared in the operation's result schema.
- **A property** (`PROPERTY`): its tapestryKey, its concept, `field`, `path`, `parent` (null at the top level), its address, `type`, `required`, `description` (or null), its piece as `schema`, and `hasLetter`.
- **The four:**
  - add-property: `outcome` (`added` or `already-exists`), `property`;
  - update-property: `outcome` (`updated` or `unchanged`), `property`, `changed`;
  - remove-property: `outcome` (`removed` or `already-gone`), `removed` (the property and each under it), `removal`, the entry for `already-gone`;
  - set-schema: `outcome` (`set` or `unchanged`), `added`, `changed`, `removed`.
- **Each also answers:** `caughtUp` (`added`, `changed`, `removed` and `filledIn`; for set-schema, `filledIn` is top-level), `elements` (Decision 9), `letterOutOfDate`, `cacheOutOfDate` and `change`.

**15. Messages and docs that follow.**
- `_elements.js`'s refusals drop "(A10.18)" from "graph set-schema" and "graph update-property".
- `field-mark-allowed`'s `no-property-node` message names `graph add-property` and `graph set-schema` in place of the signing route. `docs/GRAPH_RULES.md` §3 says the same.
- The catalog's four rows say what is built, citing this ADR.
- BIBLE §9's property tree says what a property node holds and that the schema node is rebuilt from them. Its two-way sync table gains the four writes.

## Consequences

**What this enables**
- Every field can have a node, and so a mark. Elements are checked against fields that are written down, through operations that sign nothing.
- A concept's schema can be rebuilt from its tree and frame alone (BIBLE §30). Its schema node is that rebuild, kept current.
- An agent can rebuild a concept's schema in one call (set-schema), or one field at a time, and is told which elements a change leaves behind.
- The first write on any concept made before now catches it up, so no migration runs.

**What this constrains**
- **Only wrapped schemas, and only typed fields** (Decisions 3 and 4). This narrows the story's AC5 and AC7: a schema with a second top-level key, or a field with no `type`, is refused, not kept. Today no own concept that keeps its fields under its own key has such a schema (fact 8).
- **The schema node holds a copy** that update-concept's rename can move ahead of the tree. The next property write catches the tree up from it (Decision 6), so the two never disagree for longer than that, and never in what the readers read.
- **A list's item fields are part of the list** (Decision 4). Changing one means update-property's `schema.items`, or set-schema.
- **A report judges tapestryJson,** so until A10.20.c it counts many new elements as not judged.
- **Each write reads every element's tapestryJson,** up to 10,000. That is fine at today's sizes, and the live check times it at the largest concept there is.
- **today's routes still write what they write.** create-property's nodes off the schema node aren't part of a concept's tree, and stay as they are. generate-json-schema, run on a concept these writes keep, would read each `property.required` list as a boolean. Both sign, and D15 leaves them as they are.

**New debt and follow-ups**
- **A10.20.c:** when the writes derive after they commit, these four call it too, and their reports judge the tapestryJson the write leaves.
- **update-concept's rename could rename the pieces too,** so a catch-up never follows a rename. A small change to `renameRows`, left for a story that touches it.
- **A concept with two top-level keys,** and fields with no `type` (`$ref`, `anyOf` alone), wait for a concept that needs them.
- **`graph enumerate`** (catalog §2) will give a piece its `enum` from another concept's elements.
- **Firmware reinstall required?** Yes, for rule 3's element text (Decision 15), which `node src/firmware/graph-rules.js` regenerates. No concept definition changes.

## Implementation notes

**Sequence.** The report needs `_schemas.tapestryJsonOf` from story 42's build (ADR 0042, Decision 1; Loom A10.20.b). The Implementer merges staging with that build in before Phase 4. If it hasn't landed, the Implementer stops and says so.

- **`src/operations/catalog/graph/_properties.js`** (new), what the four share:
  - `treeOf(read, conceptKey)`: P1, the primary property and each `Property` reached by `IS_A_PROPERTY_OF*1..32`. For each: its parents, key, uuid, name, pubkey, whether it has a letter, its cache stamp, and its tags with their tapestryKeys and values. → `{ root, nodes: Map, tangled: [...] }`.
  - `pieceOf(definition)`, `viewOf(piece, children)`, `sectionOf(tree)` and `documentOf(frame, key, section)`: Decisions 1 and 2.
  - `inLine(tree, document)`, and `planFor(tree, section)`: the added, changed and removed of Decisions 6 and 7.4, by path, in memory.
  - `checkSchema(document, conceptKey)`: Decisions 3 and 4, with `filledIn`.
  - `nodeJson`, `nodeTags` and `addressFor(read, key, parentUuid, ta)`: Decision 5, with the nonce search.
  - `applyPlan(tx, read, plan, facts)`: makes, rewrites and removes nodes, and rewrites the parents' views, the primary property, the schema node and the tree graph. It uses `E.makeNode`, `E.addTags`, the tag delete update-concept uses, `F.writeCopies`, the `MERGE` of an edge between two keyed nodes, and delete-node's delete of a node's tags and then the node.
  - `marked(read, conceptKey, plan)`: Decision 8.
  - `reportOf(...)`: Decision 9.
  - The refusals' declarations, and `PROPERTY`, `CAUGHT_UP` and `ELEMENTS`.
  - Like the other `_*.js` modules, it opens nothing when it loads.
- **`src/operations/catalog/graph/add-property.js`, `update-property.js`, `remove-property.js` and `set-schema.js`** (new). Each is a declaration through the write path:
  - `kind: 'write'` and `access: 'owner-and-admins'`;
  - `guards: [{ rule: 'element-fits-schema', items: () => [] }]`, as create-element: the JSON comes from the graph, so `apply` runs the check (Decision 10);
  - its `repeatKey`, its inputs as Decision 7 gives them (pieces and schemas use `_elements.FIELDS_INPUT`'s shape: an object, or its JSON text), and its answer per Decision 14;
  - `apply` in Decision 7's order.
- **`src/operations/catalog/graph/_schemas.js`:** `validatorOf(schema)` (Decision 9), after story 42's changes, using its `compile` and `problemOf`. Nothing else here changes.
- **`src/operations/catalog/graph/_nodes.js`:**
  - `wholeNodeOf(read, key)`: delete-node's U0, D4, `relationshipsOf` and its step 7's tag read, and the `stored` JSON of an `lmdb:` value;
  - `removalOf(read, key, change)`: its D1 and `deletionOf`, given the change's name.

  Both move from `delete-node.js`, which then calls them with no change in what it answers.
- **`src/operations/changes.js`:** `CHANGE` documents `path` (an array of strings) and `catchUp` (a boolean), and `was` and `now` for a property and a schema (Decision 12).
- **`src/operations/catalog/graph/_elements.js`** and **`src/operations/rules/field-mark-allowed.js`:** the messages of Decision 15.
- **Docs:**
  - `docs/GRAPH_OPERATIONS_CATALOG.md` §2's four rows;
  - `docs/GRAPH_RULES.md` §3's `no-property-node` line, with rule 3's element regenerated by `node src/firmware/graph-rules.js`;
  - BIBLE §9 and its "Last updated" line;
  - the design doc's status line, which lists what is built;
  - the epic's story entry is already there.
- **Not changed:** the external CLI and `/docs`, which come from the declarations. `_fields.js` too: its S2 and S3 already read a wrapped concept's fields off its primary property.
- **Tests** (the Tester's, Phase 3; only the Tester changes `test/`):
  - **A seed for the suites,** on `test/helpers/graphFake.js`. It holds:
    - a concept `graph create-concept` made (no property nodes), with elements whose tapestryJson the store stub holds, one of them already not fitting;
    - a lettered concept today's create-concept made, with a tree generate-property-tree signed, in the old shape;
    - a firmware concept, another author's, one whose schema isn't wrapped, one with a field that has no `type`, and one with a mark.
  - **The statements the fake learns:**
    - P1;
    - `IS_A_PROPERTY_OF*1..32` up to a header;
    - `HAS_ELEMENT` from a superset to a keyed node;
    - the `property-removed` entry lookup;
    - the address check.
  - **Each refusal of Decision 7,** one case each, and that nothing changed after it: no entry, the graph as it was.
  - **The round trip:** set-schema, then E1's read, gives the schema given, with `filledIn`'s additions. `unchanged` on the same schema again.
  - **Catching up:** the create-concept concept's three fields get nodes on the first add-property. The old-shape tree is rewritten. A stray node comes out whole. Each change is marked `catchUp`.
  - **The readers:** after each write, `_fields.propertyNodeOf` finds a new top-level field, and mark-field marks it. create-element refuses JSON that misses a newly required field. `comparePropertyRecord` finds the primary property consistent. Each node written fits its concepts.
  - **The report:** `stoppedFitting`, `alreadyNotFitting`, `notJudged` by reason, `stillHold`, the caps and `beyond`, a schema before that doesn't compile, and agreement with the rule's `{ node, concept }` form after the write.
  - **Marks:** `marked-field` for a remove, a type change, an item-type change and a subtree, and not for a description change.
  - **Repeats:** `already-exists`, `unchanged`, `already-gone`, and the `name-in-use` that names what differs.
  - **Access and reach:** 401 and 403, the internal CLI, and an agent through the external CLI for all four, in a new `properties-agent-through-cli.test.js`, as the other groups have.
  - **delete-node's suite** still passes on the moved functions.
  - **`test/graph-rule-firmware.test.js`** passes on rule 3's regenerated element.
- **The live check** runs on a scratch stack (`scripts/scratch-stack.sh`), never the agent-memory instance:
  - on a concept `graph create-concept` made, add-property, update-property, remove-property and set-schema;
  - the Properties tab's query lists each field with its type and parent;
  - mark-field marks a new field;
  - a reinstall leaves nodes, tags and relationships as they were;
  - a backup restored on a fresh instance brings them back with their keys;
  - an admin agent runs all four through the external CLI and nginx;
  - the relay's event count is unchanged;
  - one write is timed at the concept with the most elements.
- **Branches:** staging only, by the usual chain.

## Out of scope

- **A schema with a second top-level key, and fields with no `type`** (Decisions 3 and 4).
- **A list's item fields as properties of their own** (Decision 4).
- **Renaming or moving a property** (the story's Out of scope), **`graph enumerate`**, and **changing elements to fit.**
- **Deriving after a write** (A10.20.c), and **`rules check`** (A10.31).
- **update-concept renaming the pieces** (Consequences).
- **Today's routes** and the UI's property editor (D15).
- **The properties set's members.** Nothing makes property nodes its elements today, and this ADR doesn't start.
