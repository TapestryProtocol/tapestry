# ADR 0022: `graph add-to-concept` and `remove-from-concept` — memberships through the class thread, the owner's sections beside another author's letter, and D9's rule

**Status:** Accepted
**Date:** 2026-11-17
**Story:** `engineering-team/stories/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.md`

## Context

Story 22 asks for two graph writes. add-to-concept makes any node an element of a concept, directly under its superset or in one of its sets, with the concept's section checked against its schema (AC1–AC4). remove-from-concept takes the owner's claim out again: every way the concept, or the set, reaches the node, never a way that takes the node out of a concept the caller didn't name, and never the node's last concept (AC6–AC8). Any node is accepted. The owner's section on a node whose JSON is someone else's is kept beside their letter, never written into it. remove-from-concept takes out only the owner's own claims (AC5, the owner's answer to open question 3). Both last through a reinstall, a restore and a fresh import of the letter (AC9).

What the code offers, on staging at `370d8118`:

1. **The write path** (`src/operations/write.js`). In one transaction it runs each declared guard, `rule.violations(guard.items(inputs), read)`, then `apply(inputs, ctx)`, then writes the change entry. A refusal anywhere rolls everything back. A first attempt that meets a node another write deleted runs once more (ADR 0026 Decision 6).
2. **The pieces the element writes share:**
   - `_nodes.js` has `whoseNode(read, key)` (U0) → `{ key, uuid, name, author, hasLetter, labels, person, placeholder, own }`. A tag records no author, so the own test alone would count it as the instance's own (`_nodes.js:79–89`).
   - `_elements.js` has:
     - `whereTo` (`:280`), with its refusals and words for a `set` (`unknown-node`, `not-a-set`, `not-in-class-thread`);
     - `madeElsewhere` (`:153`) for a concept, and `changedElsewhere` (`:135`) for a node;
     - `firmwareElementOf` (`:465`);
     - `repeatsOf` (`:313`), the repeat create-element and update-node's `name-in-use` share;
     - `mergeSection` (`:476`), `parseFields` (`:232`) and `cleanName` (`:217`);
     - `link` (`:399`), one `HAS_ELEMENT` by `MERGE`;
     - `RESERVED_KEYS` (`:81`) and `X.CONCEPTS`.
   - `_fields.js` has:
     - `conceptOf` (`:124`) and `conceptsOfNodes` (`:386`), which walks from the node back to each header through the class thread, as memo #117 asks;
     - `elementsOf` (`:225`), `marksOf` (`:191`), `mapNodes` (`:408`) and `copyChanges` (`:432`);
     - `writeCopies` (`:308`), one `SET n += row.props` per node, a null taking a property off;
     - `readJson` (`:100`).
   - `_sets.js` has `lockNode` (`:257`), `supersetOf` (`:130`), `aliases` (`:52`), `descriptorsOf` (`:373`), `firmwareLinks` (`:294`) and its pattern for a peer's claim (`peerClaim`, `:445`) and the instance's own letters (`ownLetters`, `:455`).
   - `_eventless.js` has `addTags` and `tagRows`, which make tag nodes as the import makes them.
   - `_schemas.js` has `checkElements` and `fits`.
3. **The locks today's element writes take.** update-node and delete-node lock the node, then their concepts' headers in tapestryKey order (`update-node.js:160`, `:180`; `delete-node.js:188`, `:218–221`). create-element locks the concept's header (`create-element.js:105`). unlink-set locks the set before it reads anything, and runs its rule again after its delete (`unlink-set.js:73`, `:97–103`).
4. **What makes a membership again.** A firmware install does this in four passes (`src/firmware/install.js`):
   - **pass 1b** (`:218–262`) makes each firmware element file through today's create-element route: an assistant-signed letter whose `z` names the file's concept;
   - **pass 1c¾** (`:556–600`) wires each concept manifest's `HAS_ELEMENT` edges between its sets and elements;
   - **pass 1d** (`:650–704`) links each concept's superset, word's excepted, to every `NostrEvent` or `ListItem` node whose `z` tag holds the concept header's uuid;
   - **pass 3** (`:1289`), wire-implicit-elements, wires `z`-tag nodes that no class thread reaches.

   The prunes take out a direct link only when another way in makes it redundant. No pass makes an edge from a relationship event: only the routes that sign one, and fork-node, read them (`src/api/normalize/index.js:4626`).
5. **What an import keeps.** `importEventDirect` (`src/api/normalize/index.js:139–190`) `MERGE`s the event's node, sets its `id`, `kind`, `pubkey`, `name` and `created_at`, and deletes and remakes its tag nodes. Every other property and every `HAS_ELEMENT` stays, which is why the field mapping's copies on another author's node survive an import (ADR graph-operations-foundation/0005).
6. **The derive step.**
   - `word.js` derives `ListItem`, `ListHeader`, `ConceptHeader`, `JSONSchema` and `Property` nodes, and `set.js` derives `Set` and `Superset` nodes. No deriver handles a `NostrUser` node or a placeholder (`src/lib/derivers/index.js`).
   - `deriveWord`'s base is the node's cache entry when that has a `word` block, else its json tag (`word.js:42–75`). So a change to a json tag doesn't reach an entry already built (OPEN.md row 139), which the writes report as `cacheOutOfDate` (`update-node.js:318`).
   - ADR 0042, being built as A10.20.b, moves the rule's check form onto tapestryJson, and A10.20.c will have the writes rebuild their node.
7. **The other readers of a node's JSON:**
   - the field mapping: `elementsOf` reads the json tag, and `valueOf` the concept's section;
   - the rule's check form: E4, `src/operations/rules/element-fits-schema.js:25–64`;
   - search: `_search.js:98–121`, texts from the json tag;
   - update-node, which refuses every node that isn't the instance's own.
8. **The reserved type.** `relationship-type-allowed.js:40` says `HAS_ELEMENT` is made by "graph add-to-concept and create-element", so add-relationship and remove-relationship refuse it.
9. **Change entries** take any of `changes.js`'s change fields (`type`, `from`, `to`, `node`, `concept`, `field`, `property`, `nodes`, `was`, `now`, `count`). Each ADR names the ones it uses, in its header (`changes.js:28–35`).
10. **The rulebook** has seven entries, in the format `node src/firmware/graph-rules.js` checks. Each entry becomes an element of `39998:<TA>:graph-rule` with a firmware reinstall (ADR 0041).

Concepts touched, by handle (`<TA>` is the instance's assistant), all read: `39998:<TA>:superset`, `39998:<TA>:set` and `39998:<TA>:word`. word's superset sits above 17 other concepts' supersets, so word reaches their elements through them (`/neighbors` of `39999:<TA>:word-superset`, 2026-11-17). Also read: the concept-header and seven core-node concepts, `property`, `graph-rule` (rule 8's element is written) and `neo4j-property`. Firmware's concepts are read for their definitions.

## Options considered

The two operations follow the element writes' patterns (Context 2 and 3). The choice this ADR makes is where the owner's section lives on a node whose JSON is someone else's (AC5), since every reader of a node's JSON has to find it there.

### Option A — One property of the instance's own on the node, `tapestryOwnSections`, laid over the author's JSON by one shared function

The owner's sections, keyed by concept key, are JSON text in one node property. Each reader lays them over the json tag's JSON with one function in `_fields.js`. That covers the two operations, the field mapping, the rule's check form and the derive step.

- **Pros:**
  - the author's tags, json tag and event properties are untouched (AC5);
  - an import keeps a property it doesn't set (Context 5), so the section lasts a fresh import (AC9), as the mark copies already do;
  - it is one property and one function, with no new kind of node and no firmware change for it.
- **Cons:**
  - a node then has two places a section can be. Every reader of a node's JSON has to call the function: search and update-node don't yet (Consequences);
  - the property's content is opaque to Cypher. That's acceptable: a section's fields that queries need are carried by marks (A10.5).

### Option B — A node of the owner's own per annotated node, holding the sections, linked to it

An "annotation" node, linked to the author's node by a new relationship type.

- **Pros:**
  - the author's node gets nothing new;
  - it maps onto D8's "a node of the owner's own", which export nostr could publish later.
- **Cons:**
  - a new kind of node needs a tapestryKey, a concept of its own (D9), labels, and a relationship type, so firmware changes and a reinstall;
  - every reader joins through it, and delete-node, and later merge-nodes and copy-node, have to carry it;
  - it is much more than this story needs, and it presumes how export will carry such sections, which D8 leaves open.

### Option C — Write the owner's section into the author's json tag

- **Cons:** it rewrites the author's claim, which D4 keeps as theirs, and the story's AC5 refuses. The next import of their letter also deletes and remakes its tags (Context 5), taking the section out while the membership stays.

## Decision

We chose **Option A**. It keeps the author's letter exactly as the graph recorded it, it lasts an import with nothing more than the field mapping already relies on, and it costs one property and one function.

### The node and its concept

**1. Two declarations and one shared module.**
- **Files:** `src/operations/catalog/graph/add-to-concept.js` and `remove-from-concept.js`, each a `write` for `owner-and-admins` in group `graph`, through the write path. What they share is in a new `_memberships.js` (`M`).
- **Inputs:** `node` and `concept` (`N.keyInput`), and `set` (optional, `N.KEY_PATTERN`). add-to-concept also takes `fields` (`X.FIELDS_INPUT`, optional).
- **`repeatKey`:** `['node', 'concept', 'set']`.
- **Guards:**
  - add-to-concept: `[{ rule: 'element-fits-schema', items: () => [] }]`, as create-element's, since the JSON is built in apply;
  - remove-from-concept: `[{ rule: 'node-has-a-concept', items: (i) => [{ node: i.node, concept: i.concept, set: i.set }] }]` (Decision 12).

**2. The node: what can be one, and where its sections are kept.** After the locks (Decision 4), `N.whoseNode(read, node)`:
- **no node** (a change entry is never one): `unknown-node` (404), naming `node`;
- **a tag** (`NostrEventTag`): `tag-node` (409), new. A tag is part of a letter, and no element.
- **a node another operation looks after:** `made-elsewhere` (409), through `X.changedElsewhere` on its concepts and labels, naming the operation, as update-node does (`update-node.js:166–170`). That covers a concept header or core node, a schema, a property, a set or superset, and a graph rule.
- **no assistant key:** `not-installed` (409), checked first, as update-node checks it.

Where its sections are kept, `M.keptIn(facts)`:
- **`json-tag`** when `facts.own` holds and the node isn't one of firmware's own elements (`X.firmwareElementOf(facts.uuid)` is null). Its sections are in its json tag, as create-element and update-node keep them.
- **`beside`** for every other node: another author's letter (an admin's included, as `_nodes.js` counts one), a person node, a placeholder, or one of firmware's own elements. The instance's sections for it are in `tapestryOwnSections` (Decision 6). Its json tag, its tags and its event's properties are never written.

**3. The concept, the set, and the anchor.** Both operations check, in order:
- `F.conceptOf`: else `unknown-concept` (404);
- the header's key: one of `X.RESERVED_KEYS` gives `reserved-key` (409);
- `S.supersetOf`: else `no-superset` (409);
- for add-to-concept only, `X.madeElsewhere(concept.uuid)`: `made-elsewhere` (409), with create-element's words.

Then `X.whereTo(read, { concept, superset, set })` refuses an unknown set, one that is neither a set nor a superset, and one outside the concept's class thread, with create-element's codes and words. Its `target` is **the anchor**: the set, when one is given and isn't the superset, else the superset. Its `concepts` are those whose class thread reaches the anchor.

**4. The locks.** First the node (`S.lockNode`), then the concept's header, which is the order update-node and delete-node take theirs (Context 3). Every read in apply comes after them. So:
- two calls on one node go one at a time (AC4's and AC7's two calls at once);
- an add or a remove beside an update-node or a delete-node of the node waits for it;
- an add beside a create-element, or a rename into the concept, waits on the header (Decision 8's name check).

remove-from-concept's guard runs before apply, and so before its locks. apply runs the rule again after its delete (Decision 15), as unlink-set does.

**5. The node's JSON, as the operations read it.** `M.jsonOf(read, facts, keptIn)` → `{ view, base, own, tags, jsonTags }`:
- **`json-tag`:** the json tags, read as update-node reads them (`update-node.js:208–212`). Several that differ, or one that can't be read, give `unreadable-json` (409). None gives `{}`, and the write adds a json tag. `view` is that JSON.
- **`beside`:** `base`, the author's JSON, is the json tag read the same way, or `{}` when there is none. `own` is `tapestryOwnSections`, parsed; text that doesn't parse as an object gives `unreadable-json`. `view` is `F.overlaySections(base, own)`.

`F.overlaySections(json, own)`, new in `_fields.js`, gives a copy of `json`:
- each section in `own`, under its key, replaces `json`'s section of that key whole;
- when `json` has a `word` block whose `wordTypes` is a list, the keys of `own` it lacks are added at its end, sorted;
- it is built with `Object.fromEntries`, so a key called `__proto__` stays an own key.

**6. The owner's sections beside: `tapestryOwnSections`.**
- **The property:** JSON text of an object keyed by concept key, each value a section. Only these two operations write it, only on a `beside` node, through `F.writeCopies`'s statement, and it is removed (null) when its last section goes.
- **No clash with a mark:** a mark's property is always `<key>_<field>` and holds an underscore, so no mark can yield this name (`field-mark-allowed`).

Every reader of a node's JSON in the operations module and the derive step lays it over:
- **the field mapping:** `elementsOf` (`_fields.js:225`) also returns `e.tapestryOwnSections`, and gives `overlaySections(json, own)` as the element's JSON. A node with sections beside and no json tag reads as `{}` with them, so a mark's copy comes from the owner's section (AC9). A json tag that can't be read is still a problem, as today;
- **the rule's check form:** E4 (`element-fits-schema.js:25`) returns the property too, and the `{ node }` form judges the overlay. When ADR 0042's `tapestryJsonOf` replaces E4's json read, the derive step's overlay carries the sections there instead;
- **the derive step:** `deriveWord` lays `node.tapestryOwnSections` over its base (`word.js:75`) before it builds the word block. So a node's tapestryJson holds the owner's sections once it is derived. A removed section stays in a cache entry until A10.20.c (Consequences);
- **these two operations** (Decision 5).

Search and update-node don't read it yet (Consequences).

### add-to-concept

**7. The section it writes, and the repeat.** The node is already an element of the concept when `F.conceptsOfNodes` lists the concept for it. It is directly in the set when `M.isElementLink(read, set, node)` finds a `HAS_ELEMENT` from the set to it.
- **Already an element, and directly in the set when one is given:** `already-element`, and nothing is written. `differs` lists each field given whose value differs from what the view's section holds, compared as `X.differsOf` compares a field: `{ input: 'fields.<field>', given, holds }`, with `holds` null for a field the section lacks.
- **Already an element, with a set given that doesn't hold it directly:** only the set's link is written (Decision 9), and the section isn't touched. `differs` is as above, and the outcome is `added`.
- **Otherwise, the section.** When the view already holds one under the concept's key, the fields given are merged into it with `X.mergeSection`. Else it is `{ name, slug, ...fields }`, as create-element builds one: `name` is the node's (`facts.name`) and `slug` the slug its name gives.
- **`fields`** is parsed with `X.parseFields(inputs.fields, { name, slug })`, which refuses a `name` or `slug` other than the node's (`bad-fields`, 400). A node with no name, such as a placeholder, takes its section's `name` from `fields`, cleaned by `X.cleanName` (`bad-name`), and the slug that name gives. With none given, the section has no name or slug, and the schema decides.

**8. Its checks, in order.** Each runs before anything is written:
1. `not-installed`;
2. the locks (Decision 4);
3. the node (Decision 2), and the concept and the set (Decision 3);
4. `fields` (Decision 7);
5. the repeat (Decision 7);
6. **`name-in-use`** (409), for a `json-tag` node only, added at Architecture. `X.repeatsOf(read, { concept, name, authors: R.ownKeys(), address })`, as update-node calls it (`update-node.js:276–281`), with `address` the one the node's name gives in the concept (`39999:<TA>:<childDTag(name, concept.uuid)>`), finds another of the instance's own elements of the concept with the name, or at that address. The refusal names it, as update-node refuses a rename onto one: two of the instance's own elements of one name in a concept would give create-element's repeat two answers (story 21, open question 2). A `beside` node's address is never the assistant's, so it is never a repeat and isn't checked;
7. `unreadable-json` (Decision 5). The JSON to write, longer than `X.MAX_JSON`, gives `bad-fields` with create-element's words;
8. **rule 4.** When the section is new, `Sch.checkElements(read, [{ concept, json: view-with-the-section }])` refuses `invalid-fields` or `no-schema`, naming the rule. When the node was already in the concept, nothing new is judged, and its verdict is reported.

**9. Its writes.**
1. `X.link(tx, anchor, node)`, one `HAS_ELEMENT` by `MERGE`.
2. The section:
   - **`json-tag`:** the json tag's value is rewritten inline with the new JSON, by update-node's statement (`update-node.js:302`). A JSON held in the store (`lmdb:`) is written back inline, as update-node and update-concept write one. A node with no json tag gets one (`E.addTags`). When the word block's `wordTypes` is a list, it gains the concept's key and each other key the anchor joins (`whereTo`'s concepts, word's aside), the named one first, then sorted, as create-element orders them.
   - **`beside`:** `tapestryOwnSections` with the section under the concept's key.
3. For a `json-tag` node only, the would-be tags, as create-element's `elementTags` writes them: a `z` naming the concept's header, unless one already does, and an `n` naming the set when one is given, unless one already does. They go through `E.addTags` from `E.tagRows(uuid, tags, tags.length)`, so a reinstall's pass 1d and a letter published later agree with the graph.
4. `F.mapNodes(tx, [node])`.

### remove-from-concept

**10. The links, the concepts the node leaves, and the checks.** After the locks, the node (Decision 2), and the concept and the set (Decision 3):
- **M1, `M.waysIn(read, { anchor, node })`:** every `HAS_ELEMENT` into the node from the anchor or from any node below it. The types come from `S.aliases()`:

  ```cypher
  MATCH (a:TapestryNode {tapestryKey: $anchor})-[:`IS_A_SUPERSET_OF`*0..]->(x:TapestryNode)-[r:`HAS_ELEMENT`]->(n:TapestryNode {tapestryKey: $node})
  WHERE NOT x:GraphChange
  RETURN DISTINCT x.tapestryKey AS from, x.uuid AS uuid, labels(x) AS labels, elementId(r) AS rel
  ```

  None means the concept, or the set, doesn't reach the node: `already-removed`, and nothing is written.
- **The concepts it leaves.**
  - Before: `F.conceptsOfNodes(read, [node])`.
  - After: `F.conceptsOfNodes(read, [node], { without: rels })`. `without` is a new option that leaves those relationships out of the walk, so "the concepts reaching a node" keeps one definition.
  - **Left:** those before but not after. Only concepts whose key isn't reserved are judged, as update-node judges them (`update-node.js:175`).
- **M2, `M.reaches(read, { concept, anchor })`:** whether a concept's class thread reaches the anchor: `(h {tapestryKey: $concept})-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..]->(a {tapestryKey: $anchor})`.
- **The checks, in order:**
  1. **`firmware-membership`** (409): a link in M1 that firmware's definition makes, or a concept left that it makes the node an element of (Decision 11). The refusal names the part of the definition, as unlink-set's `firmware-link` does.
  2. **`author-claim`** (409): on a node whose letter is another author's (`facts.hasLetter` and not `facts.own`; firmware's own elements are the assistant's, and step 1 covers them), either of:
     - an `n` tag naming a set that a link in M1 runs from;
     - a `z` tag naming a left concept's header.

     Pass 1d, wire-implicit-elements or the next import would make either again (Context 4). The refusal names the tag and its author, as unlink-set's `peer-link` names the `s` tag.
  3. **`other-concept`** (409): a left concept whose class thread doesn't reach the anchor (M2). The node would leave a concept the call didn't name, through a link the two share. The refusal names that concept and the link's start (its superset, under the named concept's thread, or the set the two share), and says how to go on: take the node out of that concept instead, or unlink the two (`graph unlink-set`).
  4. **`last-concept`:** the guard, before apply (Decision 12), and the re-check after the delete (Decision 15).

**11. Firmware's memberships.** `M.firmwareMemberships()` is worked out once per process from the active firmware, as `S.firmwareLinks()` works out its links (ADR 0028 Decision 6). With no assistant key it is empty, and isn't kept. It has two parts:
- **(a) element files.** Each `concepts/<c>/elements/<f>.json` makes its address (`X.firmwareElements`) an element of `39998:<TA>:<c>`. Pass 1b signs it with a `z` naming that header, which pass 1d links again.
- **(b) manifest edges.** Each concept manifest's `HAS_ELEMENT` `[{ nodeFrom, nodeTo }]` (`install.js:556–600`) makes `node:<set address>` → `node:<element address>`. A set's name resolves as `S.firmwareLinks`' part (c) resolves one, to the set file of that name in the concept's `sets/`. An element's name resolves to the element file of that name in its `elements/`, at the address `X.firmwareElements` gives it. A name that resolves to nothing is left out.

A link's start is matched by its descriptors (`S.descriptorsOf`: `node:<uuid>`, and `superset-of:<header>` for a superset).

**12. The rule `node-has-a-concept`,** the rulebook's entry 8, in `src/operations/rules/node-has-a-concept.js`.
- **Says:** every node is an element of at least one concept other than word: some concept's class thread reaches it (design D9). Tags and change entries are parts of letters and of the history, and are exempt.
- **Items:**
  - **`{ node, concept, set? }`**, remove-from-concept's guard: judged as if every link M1 gives for the anchor were gone. There is no finding when the node, the concept or the set names nothing the rule can judge (apply refuses those), when the concept's key is reserved, or when M1 gives nothing (a repeat);
  - **`{ node }`**, the check, which apply's re-check also runs: judged as it stands;
  - no finding for a key that names no node, or for a tag.
- **Finding:** `last-concept` (409). As a guard, it names the concept and the way on: add the node to another concept first (`graph add-to-concept`), or delete it (`graph delete-node`). As a check, it says no concept but word reaches the node.
- **`refuses`:** true. It requires `_fields.js`, `_concepts.js` and `_memberships.js` when `violations()` runs, so loading it opens nothing (ADR graph-operations-foundation/0001 Decision 10).
- **The rulebook:** `docs/GRAPH_RULES.md` §8, with the eight labels. `node src/firmware/graph-rules.js` makes its element.

### What both answer and record

**13. The answers.**
- **add-to-concept:** `{ outcome: 'added' | 'already-element', node, concept, set, kept, concepts, differs, copies, skipped, letterOutOfDate, cacheOutOfDate, note, change }`.
  - `node` is `M.NODE`: `{ tapestryKey, address, name }`. `kept` is `json-tag` or `beside`.
  - `concepts` is `X.CONCEPTS`: each concept the node now belongs to, the named one first, then by tapestryKey. Every entry comes from `Sch.fits`, the named one's too, as ADR 0042 Decision 4 has create-element take its own, so that ADR's `waiting` reaches it with no change here.
  - `letterOutOfDate` holds for a `json-tag` node with a letter. `cacheOutOfDate` holds when the node has `tapestryJsonUpdatedAt`, as update-node reports it (`update-node.js:317–318`).
- **remove-from-concept:** `{ outcome: 'removed' | 'already-removed', node, concept, set, kept, links, left, concepts, letters, letterOutOfDate, cacheOutOfDate, copies, note, change }`.
  - `links` are the relationships taken out, each `N.RELATIONSHIP`. `left` and `concepts` are `[{ concept, key }]`: the concepts the node left, and those it is still an element of.
  - `copies` are the node properties taken off.
  - `letters` are the instance's own letters that still state a removed membership: the node's own letter, for a `json-tag` node with one, and a relationship event of the instance's own naming a removed pair, which today's add-to-set signs. Each is `{ address, says }`, as unlink-set's `letters` are.

**14. The change entries,** in `changes.js`'s change fields, whose header gains a sentence for them. `graph history` finds each by the node and by the concept.
- **add-to-concept:**
  - `{ change: 'membership-added', type: <HAS_ELEMENT>, from: <anchor>, to: <node>, node, concept }`;
  - a new section: `{ change: 'section-added', node, concept, field: <key>, was: null, now: <section> }`, with `property: 'tapestryOwnSections'` for a `beside` node;
  - each would-be tag: `{ change: 'tag-added', node, field: 'z' | 'n', now: <value> }`;
  - `wordTypes`: `{ change: 'field-changed', node, field: 'word.wordTypes', was, now }`;
  - and `F.copyChanges`.
- **remove-from-concept:**
  - one `{ change: 'membership-removed', type, from, to, node, concept }` for each link;
  - for each concept left that had a section: `{ change: 'section-removed', node, concept, field: <key>, was: <the section, whole>, now: null }`. The section is kept whole, so add-to-concept with its fields undoes the removal (the owner's answer to open question 2);
  - each tag taken out: `{ change: 'tag-removed', node, field, was }`;
  - `wordTypes`;
  - and the copies taken off, as the field mapping records a removal.

**15. remove-from-concept's writes.** In order:
1. The links: `MATCH ()-[r]->() WHERE elementId(r) IN $rels DELETE r`.
2. The sections of each left concept:
   - **`json-tag`:** taken out of the JSON, and its key out of `wordTypes`, and the json tag rewritten inline;
   - **`beside`:** taken out of `tapestryOwnSections`, and the property removed when none is left. A section of the concept in the author's own JSON stays, as their claim, and the view shows it again.
3. For a `json-tag` node only, the tags: each `z` naming a left concept's header, and each `n` naming a set that a removed link ran from, in one statement by their tapestryKeys. So a reinstall's pass 1d and wire-implicit-elements don't link the node again (AC9).
4. The copies: for each left concept, its marks' properties (`F.marksOf`) go through `F.writeCopies` as nulls. Then `F.mapNodes(tx, [node])` runs for the concepts it stays in.
5. The re-check: `findRule('node-has-a-concept').violations([{ node }], read)`. A finding rolls the write back with `last-concept`, saying that another write took the node's other concept away while the call ran, in unlink-set's shape (`unlink-set.js:97–103`).

### Elsewhere

**16. What else changes.**
- `relationship-type-allowed.js:40`: `HAS_ELEMENT` is made and taken out by "graph add-to-concept, remove-from-concept and create-element". The rulebook's §2 follows.
- update-node's `not-an-element` and `no-section` words drop "(A10.22, to come)".
- The catalog's two rows (§2, Nodes) say what was built and name this ADR, as each built row does.
- `docs/GRAPH_RULES.md` gets §8, and rule 8's element is regenerated.

**17. The refusals, in one place.**

| Code | Status | Who | Declared by |
|---|---|---|---|
| `not-installed` | 409 | both | `X.NOT_INSTALLED` |
| `unknown-node` | 404 | both (the node, or the set) | `M`, worded for `node`, as update-node declares its own; `X.UNKNOWN_SET` |
| `tag-node` | 409 | both | `M` (new) |
| `made-elsewhere` | 409 | both (the node); add-to-concept (the concept) | `X.MADE_ELSEWHERE_REFUSAL` |
| `unknown-concept` | 404 | both | `F.UNKNOWN_CONCEPT` |
| `reserved-key` | 409 | both | `X.RESERVED_KEY` |
| `no-superset` | 409 | both | `X.NO_SUPERSET` |
| `not-a-set`, `not-in-class-thread` | 409 | both | `X` |
| `bad-fields`, `bad-name` | 400 | add-to-concept | `X` |
| `unreadable-json` | 409 | both | `M` (update-node's wording) |
| `name-in-use` | 409 | add-to-concept | `M` (update-node's wording) |
| `invalid-fields`, `no-schema` | the rule's | add-to-concept | `element-fits-schema` |
| `firmware-membership`, `author-claim`, `other-concept` | 409 | remove-from-concept | `M` (new) |
| `last-concept` | 409 | remove-from-concept | `node-has-a-concept` (new) |

## Consequences

**What this enables**
- The rebuild's membership writes: an element made in one concept joins the others it belongs to, and a misplaced one moves in two calls.
- Repair for D9: a node of no concept but word can be given one, and update-node's `not-an-element` now has its operation.
- Filing other authors' items, a person node or a placeholder under the owner's own concepts, with the owner's fields, while their letters stay as they wrote them.
- One rule for D9, for `rules check` (A10.31).

**What this constrains**
- **A section can be in two places.** Every reader of a node's JSON has to lay `tapestryOwnSections` over it. Search (`_search.js:98–121`) and update-node don't yet, so the owner's section beside someone else's letter isn't searched for, and can't be changed except by a removal and an add.
- **The owner's writes put a property on someone else's node,** as the mark copies already do. delete-node records it with the node, whole (ADR 0026). merge-nodes and copy-node (A10.25, A10.24) have to carry it.
- **The derive step reads it,** in the one statement `word.js` adds.
- **Lock order:** node, then the concept's header, as update-node and delete-node lock.
- **Guards answer before the operation's own checks** (ADR 0028 Amendment 1). So a node's last concept that is also firmware's, or its author's, is answered `last-concept`.

**New debt and follow-ups**
1. **The reads don't count the owner's claim.** A read judges a relationship by the node at its other end, since none records who made it (ADR 0011). So, from the owner's point of view, a node whose author it doesn't count stays out of the concept's elements even once added. Recording who made a membership, and counting the owner's own, is a story of its own (the story's Out of scope).
2. **update-node can't change the owner's section beside another author's letter,** since it refuses such nodes (`not-own-node`). That is a follow-up for update-node.
3. **Search doesn't see the owner's sections beside.** That is a follow-up for `_search.js` and its index (ADR 0008).
4. **A removed section stays in a cache entry** until the cache is rebuilt from the graph. The derive step builds from its previous entry (Context 6), and the answer says `cacheOutOfDate`. A10.20.c's rebuild has to drop the sections a removal names. That goes on A10.20.c as a memo.
5. **unlink-set, and delete-set when it is built, can still leave an element of no concept.** Neither guards D9 for the elements it disconnects (story 28). `rules check` reports such a node through `node-has-a-concept`, and guarding those writes with it is a follow-up.
6. **On a graph with many person nodes and placeholders, the check finds every one,** since none is an element of a concept today. A10.31 decides how to present them, and making person nodes elements of `nostr-user` is a follow-up.
7. **A relationship event that names a removed pair stays,** reported in `letters`. Nothing makes an edge from one again (Context 4).
8. **Merging with A10.20.b and A10.18.** Both touch files this one does: A10.20.b changes `element-fits-schema.js`'s E4 and `word.js`, and A10.18 the shared helpers. Whichever lands second merges. The overlay is one call in each place.
9. **Firmware reinstall required?** Yes, for rule 8's element, made by `node src/firmware/graph-rules.js`. No concept's definition changes.

## Implementation notes

- **`src/operations/catalog/graph/_memberships.js`** (new), with its header listing what it holds:
  - `keptIn` (Decision 2);
  - `jsonOf` (Decision 5);
  - `isElementLink`;
  - `waysIn` (M1) and `reaches` (M2);
  - `firmwareMemberships` (Decision 11) and the claim checks (Decision 10);
  - `NODE`, the new refusal declarations, and their words.

  Like `_nodes.js`, it opens nothing when it loads.
- **`add-to-concept.js`** and **`remove-from-concept.js`** (new): Decisions 1–15, in create-element's and unlink-set's shapes. Each declaration's description says what it does, refuses and records, in plain words, as theirs do.
- **`src/operations/rules/node-has-a-concept.js`** (new): Decision 12.
- **`_fields.js`:**
  - `overlaySections(json, own)` (Decision 5);
  - `elementsOf` reads `e.tapestryOwnSections` and overlays it;
  - `conceptsOfNodes(read, keys, { without })`.
- **`src/operations/rules/element-fits-schema.js`:** E4 returns `e.tapestryOwnSections`, and the `{ node }` form judges the overlay.
- **`src/lib/derivers/word.js`:** after `getExistingWordJson`, lay `node.tapestryOwnSections` over `base`.
- **`src/lib/tapestry-derive.js`:** `NODE_FIELDS` (`:86–88`), what a deriver reads of a node, gains `n.tapestryOwnSections AS tapestryOwnSections`, since it lists fields one by one.
- **`relationship-type-allowed.js`**, **`update-node.js`** (two strings), **`changes.js`** (its header), **`docs/GRAPH_RULES.md`** (§8, and §2's line), **`docs/GRAPH_OPERATIONS_CATALOG.md`** (two rows): Decision 16.
- **Firmware:** `node src/firmware/graph-rules.js` writes rule 8's element file under `firmware/versions/v1.0.0/concepts/graph-rule/elements/`.
- **Tests** (the Tester's, Phase 3; only the Tester changes `test/`):
  - each refusal of Decision 17, and each outcome;
  - the fake graph learning M1, M2, the `without` walk, the tag deletes and `tapestryOwnSections`;
  - two calls at once: two adds of one membership, and two removes of a node's last two concepts;
  - a `beside` node's json tag and tags unchanged by both operations;
  - the overlay in `elementsOf`, E4 and `deriveWord`;
  - the rule's guard and check forms;
  - `test/graph-rule-firmware.test.js` passing on the regenerated element.
- **The live check,** on a scratch stack (`scripts/scratch-stack.sh`), never the agent-memory instance:
  - AC9's agent run, through the external CLI;
  - a peer's lettered node, made with Cypher as story 21's live check made one, added to a concept with fields, its tags and json tag unchanged;
  - two firmware reinstalls and a backup restored on a fresh instance, each keeping memberships, sections, tags and copies;
  - the peer's letter imported again, keeping the owner's section and membership;
  - the relay's event count unchanged.
- **Branches:** staging only, by the usual chain.

## Out of scope

- **Counting the owner's claims in reads** (follow-up 1), and **publishing the owner's sections** (`export nostr`, A10.34; how D8 carries them).
- **Moving an element in one step** (`graph move-element`, A10.23).
- **Changing a section through update-node, and searching one,** on a `beside` node (follow-ups 2 and 3).
- **The cache's rebuild** (A10.20.c, A10.36), beyond `deriveWord`'s overlay.
- **Guarding unlink-set and delete-set by D9** (follow-up 5), and **making person nodes elements of `nostr-user`** (follow-up 6).
- **Today's routes,** which stay as they are (D15).

## Amendment 1 (2026-11-17, at test design; approved by the owner with the test plan) — the statements the fake graph runs

The suites run every write through `test/helpers/graphFake.js`, which runs only the statement shapes earlier ADRs taught it. Three statements follow those shapes:

1. **The links go one pair at a time** (Decision 15, step 1). Each pair M1 gave is deleted with unlink-set's statement, for `HAS_ELEMENT`:

   ```cypher
   MATCH (a:TapestryNode {tapestryKey: $from})-[r:`HAS_ELEMENT`]->(b:TapestryNode {tapestryKey: $to})
   WHERE NOT a:GraphChange AND NOT b:GraphChange
   DELETE r
   RETURN count(r) AS removed
   ```

   It removes every copy between the pair, as unlink-set's does. When no pair's delete removes anything, the call answers `already-removed`. M1's `elementId`s still give `conceptsOfNodes` its `without`. The fake runs "a MATCH of a relationship between two such nodes, then DELETE of it", and no statement that finds relationships by their `elementId`.
2. **Tags go one at a time** (Decision 15, step 3), with C11's statement, `MATCH (t:NostrEventTag {tapestryKey: $p}) DETACH DELETE t`, as update-concept and delete-node delete them.
3. **M2 counts.** Its `RETURN` is `count(*) AS n`, which answers one row even when nothing matched, and the write reads `n > 0`. The path fake doesn't run a comparison in a `RETURN`.

The test design also found eight readings the ADR left open. The suites pin each one as follows:

4. **Leaving word** (Decisions 10 and 15). word's key is reserved, so word is never judged. The node's `word` block, like any reserved key's, never leaves its JSON, and `word` stays first in `wordTypes`. When word reached the node only through what the call takes out, `left` still lists word, since the story's open question 1 says the answer lists such concepts, and the call isn't refused for it.
5. **`name-in-use` for firmware's own elements** (Decision 8, step 6). The check runs for every node whose author is one of the instance's own keys (`facts.own`), not only for a `json-tag` node. Firmware's own elements are kept beside, but they sit at the assistant's addresses, so `X.repeatsOf` would find them. Firmware's rover joining beagle beside the instance's own Rover is refused. Another author's node, a person node and a placeholder are never a repeat, and aren't checked.
6. **`made-elsewhere`'s words** (Decision 2). `M` words the refusal for these two operations, not with update-node's sentence. It names what looks after that kind of node's memberships: `graph link-set` and `unlink-set` for a set or a superset, and otherwise the operation `X.changedElsewhere` names.
7. **A node already in the concept, put in a set** (Decision 7). Decision 9's steps 1, 3 and 4 run:
   - the set's link;
   - the would-be tags: an `n` naming the set, and a `z` naming the concept only if none does;
   - the marks.

   Step 2 doesn't run, so the section isn't touched.
8. **`bad-name` names `fields`** (Decision 7). A node with no name takes its section's name from `fields`, so the refusal names that input.
9. **update-node's words** (Decision 16). Every string of update-node's that calls add-to-concept "(A10.22, to come)" drops those words: `not-an-element`, `no-section` and `not-its-concept`.
10. **The guard and a set outside the class thread** (Decision 12). The guard form gives no finding when `set` isn't in the concept's class thread. So apply refuses the call `not-in-class-thread`, even where taking out the set's links would have left the node in no concept.
11. **The rulebook's §2** (Decision 16) needs no change: it names nothing that makes `HAS_ELEMENT`. Only the rule's code changes.
12. **A10.20.b landed first** (TapestryProtocol/tapestry#132, merged into this branch at test design), so ADR 0042 is built:
    - **The rule's check form.** It judges a node's tapestryJson from the tapestry-store, and its E4 reads only a name and an address. So Decision 6's change to E4 isn't made, and this story doesn't change `element-fits-schema.js`; the Implementation notes' bullet for it is dropped. The owner's sections reach the rule through the derive step's overlay (Decision 6), once the node is derived. MS3 runs the derive step and then the rule, as ADR 0042's SC9 does.
    - **`waiting`.** The writes' `concepts` entries carry `waiting` (ADR 0042 Decision 4). add-to-concept's come from `Sch.fits` through `X.CONCEPTS` (Decision 13), so they carry it with no change here.
    - **The derive step.** `word.js` now calls `schema-verdicts.js`. The overlay goes right after `getExistingWordJson`, before the word block and `graphContext` are built, as Decision 6 says.
    - **Consequences, item 8** (merging with A10.20.b) is settled by the merge.

## Amendment 2 (2026-11-18, at review round 1; the owner chose to fix the review's non-blocking findings before the PR) — what the review found

The review passed with eight non-blocking findings (`engineering-team/reviews/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.md`). The owner chose to fix them before the pull request. For finding 1, add-to-concept gives the missing section; for finding 4, the read is bounded by the relationship concept's elements. The rest follow the review's asks.

1. **A missing section is add-to-concept's to give** (finding 1; Decision 7, Amendment 1 item 7). A node can already be an element of the concept while its JSON, as the operations read it (Decision 5), has no section under the concept's key. That happens when it joined through a set another concept also reaches, or through create-element or link-set. add-to-concept now gives it one:
   - it builds the section as Decision 7 builds a new one, checks it as Decision 8's step 8 checks a new one (refusing `invalid-fields` or `no-schema`), and writes it as Decision 9's step 2 does: into the json tag, or beside in `tapestryOwnSections`;
   - it makes no new link, unless a set is given that doesn't hold the node directly;
   - the outcome is `added`, recorded as `section-added`.

   `already-element` is answered only when the node is in the concept, directly in the set when one is given, and its view holds the concept's section. `name-in-use` still isn't checked for a node already in the concept, whose name the concept already has. update-node's `no-section` words and add-to-concept's description say so.

   So a removal that also leaves a second concept is undone by add-to-concept: the node goes back into the first concept, then into the second with that concept's fields from the change entry. For story 22's Goldie, that is golden retriever first, then dog.
2. **`wordTypes` gains the concepts a set joins,** even for a node already in the concept (finding 2; AC2). A `json-tag` node put in a set that also joins other concepts gains each of their keys in its `wordTypes`, word's aside, as a new membership does, recorded as `field-changed` on `word.wordTypes`. This corrects Amendment 1 item 7, whose "step 2 doesn't run" was meant for the section alone: AC2 lists each concept the set reaches in `wordTypes`.
3. **The guard is silent for a node another operation looks after** (finding 3; Decision 12, Amendment 1 item 10). The guard form gives no finding for a node `X.changedElsewhere` names, as it gives none for a tag. So apply refuses the node `made-elsewhere`, naming the operation that does look after it, never `last-concept` with a way on that doesn't apply.
4. **The relationship events, found through their concept** (finding 4; Decision 13's `letters`).
   - **The read.** `letters` finds the instance's own relationship events by walking the class thread of the relationship concept (its header at `firmware.conceptUuid('relationship')`) to its elements, by the instance's own authors, and then reading each one's `nodeFrom`, `nodeTo` and `relationshipType` tags. It never scans tag nodes by type and value, which no index covers. An instance with no relationship concept has none.
   - **What it misses.** Pass 1d and wire-implicit-elements wire each such event into that concept from its `z` tag. So an event signed since the last firmware reinstall can be missed, and `letters` then leaves it out. `letters` is a report, and nothing makes an edge from such an event (Context 4).
5. **The JSON is read before the repeat** (finding 5; Decision 8's order). Since item 1, the repeat turns on whether the node's view holds the concept's section, which needs its JSON. So a node whose JSON can't be read is refused `unreadable-json` before the repeat, as the code does. Decision 8's steps 5 and 7 swap.
6. **A removal reads only `tapestryOwnSections` on a node kept beside** (finding 6). Taking out the owner's claim doesn't need the author's JSON, so an author's letter that doesn't parse is no reason to refuse it. On a removal, `unreadable-json` stays for a `json-tag` node's JSON and for `tapestryOwnSections` that can't be read. RM35's `uj-peer` changes with it.
7. **Words** (finding 7):
   - **Rulebook entry 7** says add-to-concept calls the check, as built. Rule 7's element is regenerated, and ledger row `2026-11-18-rule-eight-awaits-firmware-reinstall` names it beside rule 8's.
   - **Rulebook entry 8, and its element,** say word's class thread reaches nearly every element "through the other concepts' supersets under its own", not "through its word block".
   - **`M` declares its own `no-superset` and `not-installed`,** worded for these two operations, with the same codes and statuses. Each declaration then publishes a `when` of its own.
8. **The follow-ups get rows** (finding 8).
   - **Ledger rows** go to the Consequences' follow-ups 1, 2, 3 and 5. Follow-up 1's row also states the other half of the missing provenance: from a point of view that counts a node's author, the owner's membership counts as that author's.
   - **A Loom memo on A10.20.c** carries follow-up 4: a removal's section lingers in a cache entry until its rebuild drops the sections a removal names.

## Amendment 3 (2026-11-18, at review round 2; the owner chose to fix review findings before the PR) — what round 2 found

Review round 2 found one blocking gap, which round 1's fix for `wordTypes` opened, and five non-blocking ones (the review's Round 2).

1. **Rule 4 judges whenever the call changes the node's JSON** (R2-1; Decision 8, step 8; AC3). A call can change the node's JSON by giving a new section (Amendment 2, item 1) or by adding keys to `wordTypes` (Amendment 2, item 2). Either way, the named concept's schema now judges the JSON as the call would leave it. A misfit is refused `invalid-fields`, or `no-schema`, as it is for a new member. Only a call that leaves the JSON unchanged, writing a set's link and its tags alone, reports the named concept's verdict without refusing.

   That is AC3 as approved: "the node's JSON, as the call would leave it, is checked against the concept's JSON Schema". Without it, a node in dog with no breed, put in golden retriever's set through dog, gained `goldenRetriever` in its `wordTypes` and stored JSON dog's schema refuses. The other concepts a membership joins are still reported, and never refused for.
2. **The story's AC2 and AC4 follow Amendment 2** (R2-2). Beside its "Added at Architecture" note, the story now records three things:
   - A repeat is `already-element` only when the node's view holds the concept's section.
   - A member lacking its section is given one. So a call with no fields for such a member is refused `invalid-fields` when the concept's schema asks for fields.
   - AC2's "its section stays as it is" holds for a member that already has one.
3. **`letters` says what it can see** (R2-3). `_memberships.js` and remove-from-concept's description say that `letters` finds the instance's own relationship events through the relationship concept. One signed since the last firmware reinstall, such as one today's add-to-set has just signed, can be missing until a reinstall wires it.
4. **Item 1's two untested parts get tests** (R2-4). A section-only add writes no would-be tags, and rule 4 judges the section it writes. Each test fails when its part is taken out by a scratch edit.
5. **add-to-concept's words on `differs`** (R2-5). For the instance's own node, `graph update-node` changes the fields that differ. For a node kept beside another author's letter, a removal and then an add with the fields do it, since update-node refuses such a node (ledger row `2026-11-18-update-node-refuses-owner-sections-beside`).
6. **The merge with staging** (R2-6) is done, at `a49c76a5`:
   - rulebook entry 7 names add-to-concept and the property operations as built, and rule 7's element is regenerated from it;
   - `changes.js`'s header keeps stories 18's and 22's sentences;
   - the rule-8 ledger row points at story 18's reinstall row, which the same reinstall closes.
