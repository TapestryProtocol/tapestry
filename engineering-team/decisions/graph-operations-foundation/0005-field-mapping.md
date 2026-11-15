# ADR 0005: Field mapping — a firmware concept for Neo4j properties with two sets, a mark as membership of the first, and each copy named by its field's JSON path

**Status:** Accepted
**Date:** 2026-11-14
**Story:** `engineering-team/stories/graph-operations-foundation/5-field-mapping.md`

## Context

The story asks for a way to mark a concept's field so that its elements carry the field's value on their Neo4j nodes (AC1–AC8). At the planning gate the owner settled how a mark is held:

- **A mark is an edge,** into a firmware concept of its own. The edge makes the field's property node an element of that concept.
- **The concept sits outside property, with two sets:** one for Neo4j properties that are also fields, one for Neo4j-only properties. The second set ships empty.
- **The operations.** `graph mark-field` copies the field's values onto the concept's current elements, and `graph unmark-field` removes them. `graph map-fields` catches up the elements that today's routes and the nostr import wrote.
- **The read** is plain Cypher.

The story leaves several things for Architecture:
- names;
- the firmware version;
- the inputs;
- the property name on the node and its collisions;
- where values are read from;
- many elements;
- a field that leaves the schema;
- whose marks count;
- the check.

What the code offers today:

1. **The write path** (ADR 0004).
   - `applyWrite` in `src/operations/write.js:26–48` runs a declaration's guards, then its `apply`, then records its change entry. All three happen in one transaction, through the seam in `src/operations/graph.js`.
   - `tx.run` answers `{ rows, counters }`, and `counters` include `propertiesSet`.
   - A declaration that applies has `guards`, a `repeatKey`, and a result schema that declares `change` (`src/operations/declaration.js:20–25`).
   - `apply` may do nothing outside the transaction except read, since `executeWrite` can run it again (ADR 0004 Decision 2).
   - Nothing in the context signs (`write.js:14`).
2. **Rules.** Each rule is one file, loaded by `src/operations/rules/index.js`. `relationship-type-allowed` is the model for a rule that reads a concept (`src/operations/rules/relationship-type-allowed.js:93–131`):
   - it finds the concept's header by its address, `39998:<TA>:<slug>`, with the TA from `getOwnerAssistantPubkey()`;
   - it walks the class thread with `firmware.relAlias('CLASS_THREAD_INITIATION' | 'CLASS_THREAD_PROPAGATION' | 'CLASS_THREAD_TERMINATION')`;
   - it reads each element's `json` tag, resolving an LMDB reference with `resolveValue`.

   It reserves `HAS_ELEMENT` for "graph add-to-concept and create-element" (`:41–47`), so `graph add-relationship` can't make a mark.
3. **Change entries** (`src/operations/changes.js`). An entry is a `GraphChange` node, and its changes are kept as JSON text. Its `keys` are the tapestryKeys its changes name in `node`, `from` or `to` (`keysOf`, `:69–77`), so `graph history` can filter by node.
4. **Firmware.**
   - **Version.** `firmware/active` links to `versions/v1.0.0` (`src/api/normalize/firmware.js:18`). Every firmware change since `46996baf` has edited v1.0.0 in place, with `version` unchanged. No code reads the manifest's `changelog`.
   - **What a concept needs.** A new concept needs a header, a schema, a `manifest.json` and an entry in the global manifest's `concepts[]`. A concept's own sets are its `sets/*.json`.
   - **How install makes a set.** Install makes each set through `create-set`, which signs it as a TA kind-39999 event at `39999:<TA>:<word.slug>` and wires it under the concept's superset (`src/firmware/install.js:350–425`; `src/api/normalize/index.js:4306–4358`). The `word.slug` must be unique in the TA's kind-39999 addresses.
   - **On a reinstall.** An existing set is left alone (`index.js:4309–4321`).
   - **The superset's address** is `39999:<TA>:<singular slug>-superset` (`index.js:1205, 1302`).
   - **When install sees new files.** The manifest is read once per process, so new firmware files need a restart of the control panel before an install sees them.
5. **What a reinstall deletes.** Two passes delete edges, and both delete only edges that start at a concept's own superset:
   - install's step 1e deletes such an edge when a longer path reaches the same node. It runs only for a concept with its own `manifest.json` (`install.js:764–829`);
   - `wire-implicit-elements` deletes a superset's direct `HAS_ELEMENT` edge when one of its sets already reaches the element (`index.js:5850–5873`).

   Nothing deletes an edge that starts at a set. Test H10 in `test/event-less-create-set.test.js` checks the same thing for a set under nostr-kind: a reinstall keeps its links to members that firmware didn't make.
6. **Property nodes** (`handleGeneratePropertyTree`, `src/api/normalize/index.js:3592–3830`).
   - Each is a TA-signed kind-39999 event with `name` and `type` tags and the json `{ word, property: { name, type, description, required } }`.
   - Its address is made from its name and its parent's (`deterministicDTag`, `:3652–3658`), so a re-run lands on the same node. `importEventDirect` replaces only the node's tags (`:166–170`).
   - **Where a field's node hangs** depends on the schema's shape. The tree is the schema node ← the primary property, `(pp:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)` ← fields. Then:
     - when the schema has one top-level key, the concept's `oKeys.singular`, as create-concept makes it, the fields hang on the primary property;
     - when it has more, as firmware Dog's `{ word, dog }` does, each top-level key gets a node under the primary property, and Dog's `breed` hangs under the `dog` node (`:3745–3756`).
   - **create-property's nodes can be shared.** create-property hangs a field off the schema node, at an address made from the property concept's uuid, so two concepts' same-named fields can share one node (`:3430–3442, 3470`).
   - A list's item type isn't on the property node, only in the schema.
   - **When a field leaves the schema,** the next run deletes every `HAS_ELEMENT` edge into its node, whatever the edge starts at (`:3786–3791`).
   - **A renamed field** gets a new node.
7. **Element JSON.** An element's fields are in the section of its JSON named by its concept's `oKeys.singular`, which the header's json holds as `conceptHeader.oKeys`: `{ word: {...}, dog: { breed: 'goldenRetriever' } }`.
   - **The node's `json` tag is the only copy every write updates.** Its value is either inline JSON or `lmdb:<tapestryKey>`. `resolveValue` in `src/lib/tapestry-resolve.js` resolves such a reference synchronously, to an object, or to null when the entry is missing; that happens after the container is recreated. No tag is offloaded today (ADR 0002, Context).
   - **The LMDB cache isn't safe to read.** It is read first by `getExistingWordJson` and never refreshed when a json tag changes (`src/lib/derivers/word.js:42–66`), so it can be stale or lack the section. The relationship-type rule reads the tag, not the cache.
   - **Not every element has the section.** The UI's write verbs save flat JSON, `{ field: value }` (`ui/src/pages/reading/writeVerbs.js:302–334`), and create-element's fallback is `{ name }` (`src/api/normalize/index.js:1864`).
8. **What nodes already carry.**
   - The nostr import sets `id`, `pubkey`, `created_at`, `kind`, the node's address and `name`, and `content` for kind 7 (`buildImportCypher` in `src/api/neo4j/eventSync.js`).
   - Today's create-element sets `slug` (`handleCreateElement`).
   - Story 3 set `tapestryKey`, D11 gives `tapestryValue`, and the change entries carry their own properties.

   No concept declares any of them.
9. **Neo4j.**
   - Properties hold plain values and lists of one type, and setting a property to null removes it.
   - `SET n += $props` sets several properties from a parameter map, and a null in the map removes that property, so a property's name never enters the query text.
   - The driver sends a JavaScript number as a float unless it is sent as `neo4j.int` (story 4's deviation on `LIMIT`).
10. **The graph today.** The concept graph's summaries on the local instance (2026-11-14) show:
    - property: 39 elements and 2 sets (its superset and primary-property's);
    - relationship-type: 14 elements and 4 sets (its superset and three of its own);
    - dog: 1 element.
11. **Concepts and their elements.**
    - **Labels.** create-concept and skeleton label a header `ConceptHeader`. One brought in by the nostr import carries only `ListHeader`, as BIBLE.md notes.
    - **Which nodes the walk finds.** The class-thread walk finds an element through `HAS_ELEMENT` at any depth, which allows for pruned direct edges (Context 5).
    - **Implicit members.** A node that only names the concept in its `z` tag isn't on the walk until `wire-implicit-elements` wires it (`src/api/normalize/index.js:5770–5893`); a firmware install runs that pass.
    - **Set membership on import.** The nostr import doesn't read the `n` tag that add-to-set writes (`:4442`), so an import never puts a node into a set.
12. **Tests.**
    - **The fake graph** (`test/helpers/graphFake.js`) runs only the statements ADR 0004 names, and throws on any other. Every new statement this ADR adds is named below (Implementation notes) so the Tester can teach it.
    - **Models.** `test/event-tagging-firmware-seed.test.js` is the model for checking a firmware concept's files. Every suite is listed in `test/registry.js`.

## Options considered

The owner settled where a mark lives (the story's open questions 1 and 2). What is left is how the copies are named and kept apart. That decides whether marking, unmarking and the catch-up stay right in two cases: when a node belongs to two concepts, and when a mark goes away without an unmark (Context 6).

### Option A — Each copy named after its field (`breed`)

Marking Dog's `breed` sets `breed` on Dog's elements.

- **Pros:** the most natural read, `{breed: 'Beagle'}`, as in the owner's Dog example.
- **Cons:**
  - **Names collide.** If Spot is a Dog and a Pet, and both concepts mark `owner`, one property holds two values. A field called `name`, `slug`, `kind` or `id` collides with what other code sets (Context 8), so a list of reserved names has to be kept up to date by hand.
  - **Unmarking needs to know the other marks.** Unmarking Dog's `owner` must not remove Pet's copy, so unmark and map-fields would work out, for each node, which other marks cover it.
  - **Leftover copies can't be told apart.** A copy whose mark has gone (Context 6) looks like any property another writer set, so map-fields can't safely remove it, and it stays.

### Option B — Each copy named by its field's JSON path (`dog_breed`)

The property's name is the concept's key and the field's name joined by `_`, matching the JSON path `dog.breed`.

- **Pros:**
  - **Two concepts on one node never share a copy.** Dog's is `dog_owner` and Pet's is `pet_owner`, and unmarking one leaves the other alone.
  - **No reserved list.** A field called `name` is carried as `dog_name`, which nothing else sets.
  - **Leftover copies can be cleaned up.** Names starting `dog_` on Dog's elements belong to Dog's marks, so map-fields can remove one that no mark yields, which is what's left when a field leaves the schema.
  - **Reduction-safe.** The name is computed, never chosen, so a fully reduced graph expands back to the same names.
  - **Room for nested fields.** It extends to nested fields later as flattened names (`dog_owner_name`), one of the options the design's §5, question 1 lists.
- **Cons:**
  - **Longer reads.** A read says `dog_breed`, not `breed`.
  - **Same-key concepts can still meet.** Two concepts with the same key, such as two authors' Dogs, can still meet on a shared node. The rule refuses a second mark of the same name (Decision 5).

### Option C — The copies on a side node for each element

`(Spot)-[:CARRIES]->(:NodeValues {breed: 'Beagle'})`.

- **Pros:** element nodes stay as they are.
- **Cons:**
  - every read takes one more hop;
  - each side node would be an element of no concept, against D9;
  - it doubles the node count of every marked concept;
  - it adds a relationship type that would have to be reserved.

**Where the mapping runs** is a smaller choice:
- inside each operation's own transaction (chosen);
- or a task-queue job after it. A job would separate a mark from its copies, so a failure between them would leave a mark with no copies, against ADR 0004's one-transaction write.

## Decision

We chose **Option B**, with the mapping inside each operation's transaction.
- **Why:** it's the only option in which unmarking and the catch-up never need to know about other concepts' marks, and in which a copy left by a vanished mark can be recognised and removed.
- **The cost:** reads use the longer name.

**1. The concept, in firmware v1.0.0,** edited in place, as every firmware change has been (Context 4). The new files go under `firmware/versions/v1.0.0/concepts/neo4j-property/`:

- **`concept-header.json`.**
  - `word.slug` is `concept-header-for-the-concept-of-neo4j-properties`.
  - `conceptHeader` holds the description below and these names:
    - `oNames`: neo4j property, neo4j properties;
    - `oSlugs`: `neo4j-property`, `neo4j-properties`;
    - `oKeys`: `neo4jProperty`, `neo4jProperties`;
    - `oTitles`: Neo4j Property, Neo4j Properties;
    - `oLabels`: `Neo4jProperty`, `Neo4jProperties`.
  - It has no `x-tapestry`, so a marked property node gets no label. A label would be one more copy to keep right.
- **`json-schema.json`.** It is permissive, shaped like nostr-event-tag's: `properties.neo4jProperty` is an object with no fields, and nothing is required. Membership is the whole fact. The story that fills the second set gives Neo4j-only properties their fields.
- **`manifest.json`:** `{"HAS_ELEMENT": [], "IS_A_SUPERSET_OF": []}`.
- **`sets/`:** the two sets of Decision 2.
- **The global manifest** gets one `concepts[]` entry, next to relationship-type: `{ "slug": "neo4j-property", "dir": "./concepts/neo4j-property/", "conceptHeader": "concept-header.json", "jsonSchema": "json-schema.json", "categories": ["graph-theoretic"] }`. It isn't listed under `sets.properties`, by the owner's revision, nor under `sets.words`.

The header is `39998:<TA>:neo4j-property` and its superset `39999:<TA>:neo4j-property-superset`. The header's description (AC1), exactly:

> A property that Neo4j nodes carry, so that Cypher can find nodes by it. It has two sets. *Neo4j properties that are also fields* holds fields of concepts, marked with `graph mark-field`: each element of the field's concept carries the field's value from its JSON on its node, as the property `<concept key>_<field>`, such as `dog_breed`. *Neo4j-only properties* holds properties a node carries that are no field of its concept, such as search strings or an event's kind, each with the source its value comes from. These values are optional data and cost space on every node, so a property goes in only when a read needs it. A fully reduced graph keeps the memberships, which are edges, and drops the values on the nodes, which can be made again: a field's from the element's JSON, a Neo4j-only property's from its source.

**2. The two sets.** Each set file is shaped like relationship-type's `sets/class-threads.json`.

| File | `word.slug` (the set's address) | `set.slug` | Name |
|---|---|---|---|
| `sets/neo4j-properties-that-are-also-fields.json` | `the-set-of-neo4j-properties-that-are-also-fields` | `neo4j-properties-that-are-also-fields` | neo4j properties that are also fields |
| `sets/neo4j-only-properties.json` | `the-set-of-neo4j-only-properties` | `neo4j-only-properties` | neo4j-only properties |

Their descriptions, exactly:

> **Neo4j properties that are also fields.** Fields of a concept that its elements also carry on their Neo4j nodes. Each element is the field's property node, from its concept's property tree. `graph mark-field` adds one and copies the field's value from each element's JSON to the node property `<concept key>_<field>`; `graph unmark-field` takes it out and removes the copies; `graph map-fields` brings the copies up to date.

> **Neo4j-only properties.** Properties a Neo4j node carries that are no field of its concept, such as search strings, or an event's id, kind and created_at. Each will name where its value comes from, so that a fully reduced graph can make it again. It stays empty until a story adds the first one and decides its shape.

Install signs both sets, as it signs every firmware set (Context 4). None of this story's operations signs anything.

**3. What a mark is.** A mark is one `HAS_ELEMENT` edge from the first set, `39999:<TA>:the-set-of-neo4j-properties-that-are-also-fields`, to the field's property node. Nothing else counts as a mark: membership of the concept's superset doesn't, and neither does membership of the second set.

The edges that can make a mark:
- `graph mark-field`. add-relationship reserves `HAS_ELEMENT` (Context 2). The nostr import never puts a node into a set (Context 11).
- Today's owner-gated `POST /api/normalize/add-relationship` and `add-to-set`, which can still make one outside every guard (D15). The rule's check reports any they got wrong (Decision 5).

**Whose marks count.** Every element of the first set counts, whoever made the edge. That is the same answer the relationship-type rule gives for declared types: a mark is a fact about this instance's storage, made only by its owner and admins.

**4. The property name.** The property is named `<key>_<field>`:
- **the key** is the concept's `oKeys.singular`, the section of the JSON its elements' fields sit in. It must be letters and digits;
- **the field** is the field's name. It must be letters, digits and underscores, starting with a letter; the input's pattern checks that.

So Dog's `breed` is `dog_breed`.
- The name is computed every time and never stored.
- **One mark per name across the graph.** A second mark that would yield the same name is refused (Decision 5).
- **Names starting `<key>_` on an element of a concept with that key belong to marks.** map-fields removes one that no mark yields (Decision 8). This convention goes into the rules document.

**5. The rule `field-mark-allowed`** (D3), in `src/operations/rules/field-mark-allowed.js`.
- **Items:** `{ concept, field }`, where `concept` is the header's tapestryKey.
- **Refuses:** yes.
- **Violations,** checked in this order; a guard refuses with the first:

| Code | Status | When | Its message says |
|---|---|---|---|
| `not-installed` | 409 | The graph has no concept for neo4j properties, or no first set | install the firmware first |
| `unknown-concept` | 404 | No concept header has the key: a node labelled `ConceptHeader`, or `ListHeader` for one brought in by the import (Context 11) | the key |
| `unknown-field` | 404 | The concept's schema has no top-level field of that name, `jsonSchema.properties[<key>].properties[<field>]` | the concept's top-level fields |
| `no-property-node` | 409 | The field has no property node under the concept's section node (Decision 6), or the concept has no primary property. A node create-property made, hanging off the schema node, doesn't count, since it can be shared (Context 6). | to run `POST /api/normalize/generate-property-tree` for the concept first, and that it signs |
| `not-plain` | 409 | The field's schema `type` isn't one of `string`, `number`, `integer` and `boolean`, and isn't an `array` whose `items.type` is one of them. A `type` list may add `null`. | what the field holds |
| `unusable-name` | 409 | The concept's key isn't letters and digits, so `<key>_<field>` can't be written unquoted in Cypher | the name |
| `property-taken` | 409 | Another mark already yields the same name: another concept with the same key marked a field of the same name | that concept |
| `property-in-use` | 409 | A current element of the concept already carries the name, but this field isn't marked | one such node, and that something else wrote it |

A repeat call on an already marked field passes: the last two skip the field's own mark.

As a check (`rules check`, A10.31), it runs over every current mark. It reports a mark whose field has changed type, lost its property node, or now collides. The story's AC3 lists the refusals in its own words; the table adds `not-installed`, `unusable-name` and `property-taken`. AC3's last bullet, a name other code sets, is met by `property-in-use`: since names carry the concept's key, a field called `name` becomes `dog_name`, which nothing else sets.

**6. The mapping, in one module:** `src/operations/catalog/graph/_fields.js`. The three operations, the rule, and every later element write use it. Like `_nodes.js`, it opens nothing when it loads. Its contract:

- **`conceptOf(read, key)`** → `{ key, uuid, name, oKey, fields, wrapped }`, or null.
  - It reads the header by tapestryKey, the header's json for `oKeys.singular`, and its JSON Schema's json, unwrapped as `parsed.jsonSchema || parsed`, for the top-level `fields`.
  - `wrapped` is true when the schema's only top-level key is `oKey`.
  - Both json values are resolved as in Context 7.
- **The section node** is the node that stands for `jsonSchema.properties[<key>]`:
  - the primary property, when `wrapped`;
  - otherwise the property node named `<key>` that `IS_A_PROPERTY_OF` the primary property, such as Dog's `dog`.
- **`propertyNodeOf(read, concept, field)`** → the tapestryKey of the property node whose `name` is the field and that `IS_A_PROPERTY_OF` the section node, or null. A concept with no primary property has none.
- **`marksOf(read, { concept? })`** → `[{ concept, oKey, field, property, node }]`: every element of the first set, found back to its concept through its property tree. Given `concept`, only that concept's marks.
- **`elementsOf(read, concept, limit)`** → `[{ key, json, copies }]`.
  - These are the concept's elements, its subsets' elements included, read through the class-thread walk as the relationship-type rule reads them, with their JSON resolved. Implicit members join once they are wired (Context 11).
  - `copies` holds their current properties that start with `<key>_`.
  - It reads at most `limit` rows.
- **`valueOf(json, concept, field)`** → `{ value }`, `{ none: true }` or `{ bad: reason }` (Decision 10).
- **`propertyName(oKey, field)`** → `<key>_<field>`.
- **`writeCopies(tx, rows)`** runs one statement for `[{ key, props }]`, where a null in `props` removes that property.
- **`mapConcept(tx, concept, { only?, fields?, strays? })`** → `{ set: { [property]: [keys] }, removed: { [property]: [keys] }, skipped: [{ node, field, reason }] }`. This is the mapping itself:
  - it brings each element, or each of the `only` keys, in line with the concept's marks, or with the marks of the `fields` given;
  - with `strays`, it also removes copies in the concept's namespace that no mark yields (Decision 8);
  - it writes only what differs.
- **`mapNodes(tx, keys)`** groups the given nodes by the concepts they're elements of and calls `mapConcept` with `only` for each. Every element write the new operations add later (create-element, update-node, add-to-concept) calls it, inside its own write, on the nodes it wrote. That is how the story's "whenever the element is written" holds for them. Its first caller is A10.20, so this story tests it directly.

**7. `graph mark-field`,** in `src/operations/catalog/graph/mark-field.js`.
- **Inputs:**
  - `concept`: `N.keyInput(…)`, the header's tapestryKey;
  - `field`: a required string matching `^[A-Za-z][A-Za-z0-9_]{0,63}$`.
- **Declaration:**
  - `guards: [{ rule: 'field-mark-allowed', items: (i) => [{ concept: i.concept, field: i.field }] }]`;
  - `repeatKey: ['concept', 'field']`;
  - `refusals: [TOO_MANY_ELEMENTS]` (Decision 11).

`apply`, inside the transaction:
1. It resolves the concept, the property node and the first set, which the guard has already checked.
2. It reads up to 10,001 elements. If 10,001 come back, it refuses `too-many-elements` before writing anything.
3. It `MERGE`s the mark.
4. **On a new mark,** it calls `mapConcept` with `fields: [field]`. The changes are:
   - `{ change: 'field-marked', node, concept, field, property }`;
   - `{ change: 'copies-set', property, nodes, count }` when any element carries a value.
5. **When the mark was already there,** it writes nothing else and records no change.

It answers:
- `mark: { concept, field, property, node }`;
- `outcome: 'marked' | 'already-marked'`;
- `carried`: how many elements carry the property now;
- `skipped: [{ node, reason }]`: the elements whose value couldn't be carried;
- `change`.

**8. `graph map-fields`,** in `map-fields.js`. It takes one input, `concept`, and its `repeatKey` is `['concept']`.
- **Refusals:**
  - `not-installed`;
  - `unknown-concept`, both declared from `_fields.js`;
  - `too-many-elements`.

  It refuses `not-installed` because, with no concept for neo4j properties, every `<key>_` copy would look like one no mark yields.
- **Its `apply`** calls `mapConcept` with `strays: true` over all the concept's elements:
  - every mark's copy is added, corrected or removed to match the JSON;
  - every copy in the concept's namespace that no mark anywhere yields is removed.
- **It records** one entry, with a `copies-set` change and a `copies-removed` change for each property that changed, or no entry when nothing did.
- **It answers** `concept`, `marks` (the property names), `set`, `removed`, `unchanged` (counts of elements), `skipped` and `change`.

This is AC5. It also clears what a vanished mark leaves behind (Decision 14).

**9. `graph unmark-field`,** in `unmark-field.js`. It takes the same inputs as mark-field, and its `repeatKey` is `['concept', 'field']`.
- **Refusals:** `unknown-concept` and `unknown-field`, declared from `_fields.js`. It has no guard: unmarking breaks no rule.
- **When the field is marked,** `apply` deletes the mark's edge and removes the property from every current element that carries it. The changes are:
  - `{ change: 'field-unmarked', node, concept, field, property }`;
  - `{ change: 'copies-removed', property, nodes, count }`.
- **When the field isn't marked,** it answers `already-unmarked`, provided the field is in the schema or has a property node. Otherwise it refuses `unknown-field`.
- **What it touches.** Only the first set's edge, never the property concept's edge to the node (D9). No other concept's copy has this name (Decision 4).
- **It answers** `mark`, `outcome: 'unmarked' | 'already-unmarked'`, `cleared` and `change`.

**10. Values.** The value is `json[<key>][<field>]`.

| The JSON holds | The node gets |
|---|---|
| a string or a boolean | that value |
| a number | the number, sent as `neo4j.int` when the schema says `integer` and the number is a safe integer, otherwise as a float |
| a list whose items are all strings, all booleans or all numbers | the list, with integer items converted the same way |
| an empty list, `null`, or nothing | no property, so an existing copy is removed |
| no `<key>` section at all, such as the UI's flat JSON (Context 7), or an LMDB reference whose entry is missing | no property, and the element is listed under `skipped`, saying which |
| anything else: an object, or a list that holds an object, a `null` or mixed types | no property, and the element is listed under `skipped` with the reason; the write isn't refused |

The mapper copies a plain value as the JSON holds it, even if it doesn't match the schema's type. Checking an element against its schema is D9's work, not this story's.

**11. Many elements.** A call handles at most 10,000 elements (`MAX_ELEMENTS` in `_fields.js`). Above that it is refused with `too-many-elements` (409), naming the count, and nothing changes.
- **Why:** one transaction holds every copy, and the entry lists every node it touched. At 10,000 nodes the entry's `keys` are about 360 KB.
- **Larger concepts** wait for batching, which is a follow-up.

**12. The change entry.** This extends ADR 0004 Decisions 2 and 5, adding to them without changing what's there.
- `changes.js`'s `CHANGE` schema gains four optional fields:
  - `concept`, `field` and `property`: strings;
  - `nodes`: a list of tapestryKeys.
- `keysOf` adds `concept` and every key in `nodes` to `keys`. `graph history` then finds a mark's entries by the concept's header, by the property node, and by every element whose copy changed.
- The new change names are `field-marked`, `field-unmarked`, `copies-set` and `copies-removed`.

**13. Nothing signs.** The three operations go through the write path, so they sign nothing and send nothing to a relay (AC8). The firmware install signs the new concept, its core nodes and its two sets, as it does for every firmware concept. Those events appear once, when the firmware is installed, before any of the three operations runs.

**14. Marks survive what the instance does to itself (AC7),** with no code change:
- **A reinstall** deletes only edges that start at a superset (Context 5), and a mark starts at a set.
- **A re-run of generate-property-tree** keeps the property node's address and its edges (Context 6).
- **A backup** dumps the whole graph (ADR 0002).

The live check proves all three, as test H10 does for sets.

Two cases end a mark without an unmark: a field that leaves the schema, and a renamed field.
- **What happens.** generate-property-tree's unhook deletes the mark along with the node's other `HAS_ELEMENT` edges (Context 6), and the elements keep copies that no mark yields.
- **We keep the unhook as it is** (D15). The field is gone, so its mark should go too.
- **Cleaning up.** The next `map-fields` removes those copies (Decision 8). The new name of a renamed field is marked again with `mark-field`.

**15. Docs.**
- **`docs/GRAPH_RULES.md`:** entry 3, `field-mark-allowed`, in the entry format, with the naming convention of Decision 4.
- **`docs/GRAPH_OPERATIONS_CATALOG.md`:**
  - §2 gets rows for `mark-field`, `unmark-field` and `map-fields`, and "At a glance" goes from 58 to 61, with the three added to "properties and schema";
  - `add-property`'s "whether elements carry it on the node" now points to `mark-field`;
  - §9 maps no route, since none exists today.
- **`docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md`:**
  - §5, question 1 records the first half as settled, with the owner's answers (2026-11-14) and this ADR; nested objects stay open;
  - the Status line adds A10.5.

## Consequences

- **It enables:**
  - Cypher filters on a marked field: `MATCH (d:TapestryNode) WHERE d.dog_breed = 'goldenRetriever'`;
  - one list of every property the instance carries on nodes;
  - an empty, described home for Neo4j-only properties;
  - names that extend to nested fields.
- **It constrains:**
  - reads use `dog_breed`, not `breed`;
  - there is one mark per name across the graph;
  - a call covers at most 10,000 elements;
  - a field can be marked only once its property node exists, which today takes a signing route (D15).
- **Debt and follow-ups:**
  - today's routes and the nostr import don't apply the mapping, so their elements are right only after `map-fields`. Hooking them in is a follow-up subtask;
  - a field that leaves the schema leaves copies until `map-fields` runs (Decision 14);
  - `mapNodes` has no caller until A10.20;
  - entries grow with the number of elements a call touches;
  - concepts above 10,000 elements need batching;
  - copies can disagree with the schema's types, since the mapper copies plain values as the JSON holds them (Decision 10);
  - elements whose JSON has no section for their concept, such as those the UI's write verbs saved, are skipped and listed until their JSON has one;
  - an implicit member gets its copies only once it is wired (Context 11).
- **Firmware reinstall required? Yes.** The new concept and its two sets need an install. After the new files are in place, restart the control panel (the manifest is read once per process), then install: `POST /api/firmware/install` (AGENTS.md §6). The install is owner-gated, so from the host it is called on loopback inside the container.

## Implementation notes

**New files:**
- the five firmware files of Decisions 1 and 2, and the global manifest's entry;
- `src/operations/catalog/graph/_fields.js`;
- `src/operations/catalog/graph/mark-field.js`, `unmark-field.js` and `map-fields.js`;
- `src/operations/rules/field-mark-allowed.js`.

**Changed files:**
- `src/operations/changes.js`: `CHANGE` and `keysOf` (Decision 12);
- the three docs of Decision 15.

**The statements this ADR adds,** for the Tester to teach the fake graph. Relationship types come from `firmware.relAlias(...)`, as in the relationship-type rule.

- **S1, the concept.** The header by `tapestryKey`, `WHERE h:ConceptHeader OR h:ListHeader`, then optionally:
  - its json tag;
  - its JSON Schema node, `(js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)`;
  - the schema node's json tag.

  It returns the header's uuid, its name, and both json values.
- **S2, the property node.** From the header: `(pp:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)`, then the section node (Decision 6), either `pp` itself or `(sec:Property {name: $key})-[:IS_A_PROPERTY_OF]->(pp)` as `wrapped` says. Then `(p:Property)-[:IS_A_PROPERTY_OF]->(section)` with `p.name = $field`. It returns `p.tapestryKey`.
- **S3, the marks.**
  - It starts from the first set, found by its uuid, and follows `-[:HAS_ELEMENT]->(p:Property)-[:IS_A_PROPERTY_OF]->(parent)`.
  - From the parent it climbs back to the concept header:
    - the parent is the primary property, `(parent)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)`;
    - or the parent is a section node, `(parent)-[:IS_A_PROPERTY_OF]->(pp)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)`.
  - It can be limited to one header key.
  - It returns the property node's key and name, the parent's name, and the header's key and json. In JS, a mark counts for that concept only when the parent is the concept's section node.
- **S4, the elements.** The relationship-type rule's class-thread read, starting from the header found by `tapestryKey`. For each element it returns `e.tapestryKey`, its json tag's value, and `[k IN keys(e) WHERE k STARTS WITH $prefix | [k, e[k]]]`. `LIMIT` is written into the text as the checked constant, as history's is.
- **S5, the first set.** A one-node read, by uuid, `WHERE s:Set`, returning its tapestryKey.
- **S6 and S7, the mark.** Its `MERGE` and its `DELETE`. These are add-relationship's and remove-relationship's statements with `HAS_ELEMENT`, which the fake already runs.
- **S8, the copies.** `UNWIND $rows AS row MATCH (n:TapestryNode {tapestryKey: row.key}) WHERE NOT n:GraphChange SET n += row.props`.

**What Phase 3 covers.** This list is a pointer for the Tester, not the tests themselves:
- **The firmware files:** the concept, its sets, its description and the manifest entry, on the model of `test/event-tagging-firmware-seed.test.js`.
- **The rule:** each violation and the repeat case.
- **The three operations,** through the operations harness: AC2–AC5, the values table, `too-many-elements`, and the entry's `keys`.
- **`mapNodes`,** directly.
- **The existing gate tests:** every graph write applies, and Cypher names only reserved types.
- **Registry entries** for the new suites.

**The live check** runs on a scratch stack (`scripts/scratch-stack.sh`), never on a shared or private instance. Its steps:
1. Restart the control panel, then reinstall.
2. Make Dog's property tree, and a second dog beside firmware's own (`elements/rover.json`), through today's routes. They sign, which is fine on a throwaway instance. Dog's schema lists its breeds (`goldenRetriever`, `irishSetter`), so the check uses those values in place of AC6's Beagle and Labrador.
3. Mark `breed`, and read with Cypher (AC6).
4. Change one dog through today's routes, then run `map-fields` and read again.
5. Count the relay's events before the first operation and after the last (AC8).
6. Reinstall, re-run generate-property-tree, back up and restore, and confirm the marks and copies are as they were (AC7).
7. Drive all three operations through the external CLI with an admin key (AC8).
8. Unmark `breed`, and read again.

## Out of scope

- Everything the story puts out of scope:
  - nested fields;
  - the Neo4j-only set in use;
  - moving a property between the sets;
  - hooking today's writes;
  - indexes and constraints;
  - search;
  - a UI;
  - publishing marks.
- **Batching** for concepts of more than 10,000 elements.
- **A Neo4j index** on a copy, which belongs to the search story, A10.8.
- **Changing generate-property-tree's unhook** (Decision 14).

## Amendment 1 (2026-11-14, at Test Design) — the firmware descriptions are plain text

The three descriptions that Decisions 1 and 2 quote are stored in the firmware files as plain text. That means the quoted words without the quotes' markdown: no `*` around the set names and no backticks around code names, as every other firmware description is written. The firmware-files suite checks them exactly.

## Amendment 2 (2026-11-15, at Test Design) — what the Tester's readings settle

1. **The sets' descriptions start after their bold names,** which are only the ADR's labels: "Fields of a concept that…" and "Properties a Neo4j node carries…".
2. **The mapping leaves an element whose JSON can't be read exactly as it is,** copies and strays alike, and lists it under `skipped`. Its JSON can't be read when it has no `json` tag, when the tag is inline JSON that doesn't parse, or when the tag is an LMDB reference whose entry is missing (Context 7). This is about the mapping only. unmark-field still removes the mark's copy from every element, since it needs no JSON to do that (AC4).
   - **Why:** after the container is recreated, its copies may be the last record of those values, and nothing may destroy it (BIBLE §30).
   - **Every other row of Decision 10 that gives "no property" still removes an existing copy.** That includes JSON with no `<key>` section.
3. **map-fields' counts are of elements:**
   - `set` counts the elements that got at least one copy added or corrected;
   - `removed` counts those that lost at least one;
   - `unchanged` counts those it wrote nothing to, skipped ones included.

   One element can count in both `set` and `removed`.
4. **unmark-field is capped too** (Decision 11). Above 10,000 elements it is refused with `too-many-elements`, and nothing changes.
5. **`copies-set` and `copies-removed` appear only when they name at least one node.** Unmarking a field that no element carries records `field-unmarked` alone.
6. **A list under an `integer` item type is sent as integers only when every item is a safe integer.** Otherwise every item goes as a float, so the list stays one type. A single number follows the same rule.
7. **`mapNodes` returns what it changed and records no entry.** The write that calls it puts those changes in its own entry.
8. **A known limit.** map-fields compares copies as the driver reads them, and a float that holds a whole number reads like an integer. So a float copy of an integer field stays a float.
