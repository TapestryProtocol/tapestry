# Test Plan: Story 18 — `graph add-property`, `update-property`, `remove-property` and `set-schema`

**Story:** `engineering-team/stories/graph-operations-first-slice/18-property-operations.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md` (with Amendment 1, at test design)
**Date:** 2026-11-17

Every suite is stack-free:

- It runs the real catalog in a child process (`test/helpers/operationsHarness.js`), over the fake graph (`test/helpers/graphFake.js`), with every service endpoint dead.
- Each element's tapestryJson is a real entry in a throwaway LMDB under the run's directory, the store the child reads (`TAPESTRY_LMDB_PATH`).
- The harness's spy watches everything that signs or reads a key.

The stack-free suites can't reach six things: Neo4j's own locking, a firmware reinstall, a restore, nginx, the relay, and timing. The live check covers those on a scratch stack (below).

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1: add a property | **AP1**: a top-level property; the answer's property (field, path, no parent, type, required, description, piece, address, no letter); the schema node holds it, its own fields kept; the entry's own `property-added` and its `schema-changed`. **AP3**: the node: labels `ListItem:Property`, no `NostrEvent`; address `39999:<TA>:<slug>-<hash8(parent uuid)>`; kind 39999, the assistant, name and tapestryValue its key, no id; tags d, name, description, type, z, json in that order; its JSON's word block, view and piece; it hangs on the primary property and is an element of `property` alone. **AP4**: city under address, required there; a list's `items`; `enum` and `minimum` given as JSON text. **AP5**: the same call again is `already-exists`, recording nothing. **AP8**: the Properties tab's own query lists it, with its type and its parent. | `test/operations/graph/add-property.test.js` | integration (fake) |
| AC2: the properties and the schema agree | **AP2**: the first write on a concept create-concept made gives name, slug and description nodes holding the schema's definitions, each a `property-added` change marked `catchUp`. The primary property's view lists its children, in order, with the section's required list, and the hygiene check (`comparePropertyRecord`) finds it consistent. **AP8**: mark-field marks the new field; create-element refuses JSON missing a newly required field. **UP9, SS6, RM6**: beagle's old-shape tree is rewritten, and its stray taken out, before the write's own change. **AP11, UP10**: a refused write undoes its catching up. **SS5**: a concept whose schema can't be caught up to is set all the same. | `add-property.test.js`, `update-property.test.js`, `set-schema.test.js`, `remove-property.test.js` | integration (fake) |
| AC3: update a property | **UP1**: a description: answer, piece, view, entry. **UP2**: a type, in the schema, the view and the type tag. **UP3**: required, in the parent's list and the primary property's view. **UP4**: a piece merges, and `null` takes a keyword out. **UP5**: an empty description takes it out, tag and all. **UP6**: `unchanged`. **UP7**: `has-properties`; an object with nothing under it loses its empty `properties`. **UP8**: a marked field's description changes. | `update-property.test.js` | integration (fake) |
| AC4: remove a property | **RM1**: address and city and street come out of the tree and the schema. **RM2**: the entry keeps each node whole: labels, properties, tags, relationships. **RM3**: `already-gone`, naming the removal's entry. **RM4**: out of the required list. **RM5**: out of `x-tapestry.unique`. **RM6**: a stray catching up takes out answers `removed`, its change marked `catchUp`. | `remove-property.test.js` | integration (fake) |
| AC5: set the whole schema | **SS1**: the schema written is the schema given, every keyword kept (`allOf`, `additionalProperties`, `default`, `enum`, `items`); the answer's added, at their places; catching up first. **SS2**: `unchanged`. **SS3**: added, changed and removed, against the schema before; a field kept keeps its tapestryKey. **SS4**: `$schema`, `type`, `required` and `definitions` filled in and named in `filledIn`, nothing else added. **SS7**: 32 levels read back as given. **SS9**: the admin's schema is the graph's, as given. | `set-schema.test.js` | integration (fake) |
| AC6: elements reported, never refused for | **AP6**: lapsang, chai and assam stop fitting when opened becomes required, each with the rule's words; oolong already didn't fit; matcha (no tapestryJson) and sencha (one that isn't an object) aren't judged; `stillHold` empty, `before` null, `limit` 10,000, `beyond` false; an optional field stops nothing fitting. **AP7**: the rule's `{ node, concept }` form, run over the final graph in a child process, finds exactly the report's elements, with the same problems, and judges assam by its tapestryJson. **UP3, SS3**: elements that stop fitting. **RM1, RM5, SS3, SS4**: elements that still hold a removed field. **SS5**: a schema before that can't be judged is named in `before`. | all four suites | integration (fake) |
| AC7: what they refuse | **AP11**: every refusal of add-property, with its status, and the graph after the refusals equal to the graph before them. **AP12**: `not-installed`. **UP10**: update-property's, the same way. **RM7**: remove-property's. **SS8**: set-schema's, the narrowings among them (`not-wrapped` four ways, `bad-type` three ways, `bad-name` three ways, `schema-too-large` for 1,001 fields). **SS7**: a 33rd level, by set-schema and by add-property. **UP7, UP8, RM7, SS8**: `has-properties` and `marked-field`, which names unmark-field. | all four suites | integration (fake) |
| AC8: which concepts, letters, two at once | **AP9, UP9, SS6, RM6**: a lettered concept's writes say its letter no longer matches. **AP11, SS8**: another author's concept, one under the owner's own key, and a firmware concept are refused. **AP10**: each write's first statement that writes is the lock on the concept's header, set then cleared. **L2**: two writes at once (live). | `add-property.test.js` and the others; live | integration (fake); live |
| AC9: it lasts, and it reaches agents | **AP13, UP11, RM8, SS9**: nothing signed; 401, 403, 415; the admin's write is the admin's; the command's write is the command's, and its refusal the route's; listed as a write with its guard, `repeatKey` and every refusal; `/docs` has its route. **X18**: an admin agent with its own key, through the external CLI with no change to it, adds, updates, removes and sets, and reads the concept's history back, each entry its own. **L3–L6**: a reinstall, a restore, nginx, the relay (live). | the four suites, `test/operations/graph/properties-agent-through-cli.test.js`; live | integration (fake); live |

## Edge cases

- [x] **`__proto__`.** As a name (AP11) and as a schema's key given as JSON text (SS8): `bad-name`, since a JSON object built by assignment can't hold it (ledger row `2026-11-17-concept-key-can-be-proto`).
- [x] **Control, text-direction and invisible characters.** AP11's names, UP10's and AP11's descriptions, and SS8's key are made with `String.fromCodePoint`, so no test file holds one raw.
- [x] **A piece as JSON text** (AP4), text that isn't JSON, and text of an array (AP11, UP10, SS8).
- [x] **The size bound's edges.** 32 levels land and a 33rd is refused (SS7). 1,001 fields are refused (SS8).
- [x] **A schema that doesn't compile now.** cat's is replaced by set-schema, whose report names the problem in `before` (SS5). add-property on it is `unreadable-schema` (AP11).
- [x] **A refused write leaves nothing behind,** its catching up included. Each suite's refusals run alone, so the graph after them is compared whole with the graph before (AP11, UP10, RM7, SS8). bookshop's fields get no nodes from a refused add (AP11), and beagle's old tree survives a refused update (UP10).
- [x] **A tree that isn't a tree** (hut: door under two parents) and **another author's node in an own tree** (cabin's name): `tangled-tree` and `not-own-node`, for all four.
- [x] **tapestryJson and the json tag disagree** (assam): the report and the rule judge tapestryJson (AP7).
- [x] **The Properties tab's Required column** reads `property.required` as the field's own flag. AP8 checks only the type and the parent, as AC1 asks. Ledger row `2026-11-17-properties-tab-misreads-required`.
- [x] **Concurrent calls:** L2, live; the fake runs one transaction at a time.
- [x] **Concept Graph API unavailable:** every suite is stack-free; the live check runs on a scratch stack.

## Test infrastructure

- **Runner:** Node's, through each suite's exported `run()`. `test/operations.test.js` finds and runs every suite under `test/operations/` (ADR graph-operations-foundation/0001 Decision 12), so no suite needs a line in `test/registry.js`.
- **The seed,** `test/helpers/propertyGraph.js` (new), says what it holds.
  - It starts from `test/helpers/conceptGraph.js`.
  - It adds the firmware schemas of `property`, `json-schema`, `primary-property` and `property-tree-graph`, read from firmware's files, since each write checks the nodes it writes against them (Decision 10).
  - It adds the concept of neo4j properties, with its first set, for mark-field.
  - It shapes beagle's old tree, mouse's schema that isn't wrapped, cat's that doesn't compile, and bird's second schema node.
  - `prepare(label)` then runs the real `graph create-concept` for eight concepts, and gives tea house and gadget their elements, with tapestryJson in the store.
- **The fake graph learns nothing new** (ADR Amendment 1, item 9). Each statement the ADR's steps need is one it already runs.
- **Sequencing with story 42.** The report reads tapestryJson through `_schemas.tapestryJsonOf`, which story 42 (Loom A10.20.b) adds. AP7 passes only once that build is in. The others pass with or without it.
- **Firmware state:** none on a live instance. The suites read `firmware/versions/v1.0.0/concepts/*/json-schema.json` for the four schemas, and the active manifest gives the harness its firmware concepts.

## How to run

Each suite alone, stack-free, with nothing able to reach the agent-memory instance:

```bash
for f in add-property update-property remove-property set-schema properties-agent-through-cli; do
  TAPESTRY_CONTAINER=no-such-container BRAINSTORM_BASE_URL=http://127.0.0.1:9 \
    node -e "require('./test/operations/graph/$f.test.js').run().then((r) => process.exit(r.fail ? 1 : 0))"
done
```

The scoped gate, for a review's `gate:status` line, runs CI's own registry entries for an operations change. That is `operations.test.js` (which runs these suites) with `external-cli.test.js`, `openapi-coverage.test.js`, `admin-action-sweep.test.js` and `schema-save-finds-the-right-header.test.js`, never `operations.test.js` beside the suites it runs. Never run the full `npm test` on the Mac Studio, whose stack is the agent-memory instance. The pull request's CI runs the full gate.

## The live check (at Implementation, on `scripts/scratch-stack.sh`, never the agent-memory instance)

- **L1:** on a concept `graph create-concept` made, add-property, update-property, remove-property and set-schema each land.
  - The Properties tab's query lists each field with its type and its parent.
  - mark-field marks a new field.
  - Each answer's report matches `rules check`'s, or the rule's check form run by hand.
- **L2:** two add-property calls at once on one concept both land, one after the other, or one is refused; neither is lost.
- **L3:** a firmware reinstall leaves the properties' nodes, tags and relationships, and the schema node's JSON, as they were.
- **L4:** a backup restored on a fresh instance brings them back with their tapestryKeys.
- **L5:** an admin agent, through nginx and the external CLI, runs all four.
- **L6:** the relay's event count is unchanged.
- **L7:** one write timed at the concept with the most elements.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-17 at commit `370d8118` (staging, with ADR 0018 and its story merged; the suites uncommitted beside it), each suite run alone as above:

```
add-property                  {"pass":0,"fail":13,"reasons":["src/operations/catalog/graph/add-property.js does not exist yet"]}
update-property               {"pass":0,"fail":11,"reasons":["src/operations/catalog/graph/add-property.js does not exist yet"]}
remove-property               {"pass":0,"fail":8,"reasons":["src/operations/catalog/graph/add-property.js does not exist yet"]}
set-schema                    {"pass":0,"fail":9,"reasons":["src/operations/catalog/graph/set-schema.js does not exist yet"]}
properties-agent-through-cli  {"pass":0,"fail":1,"reasons":["src/operations/catalog/graph/add-property.js does not exist yet"]}
```

42 tests, each failing because its operation's declaration doesn't exist yet. Each suite was also run once with that check bypassed, to show the harness, the seed and the runs work. Each then failed at its first missing route:
- add-property, update-property and remove-property on `404 Cannot POST /api/tapestry/graph/add-property`;
- set-schema on `404 Cannot POST /api/tapestry/graph/set-schema`;
- the agent's on the external CLI not knowing `graph add-property`, after its `graph create-concept` succeeded.

So they fail for the reason the feature isn't built, not on the fixtures.
