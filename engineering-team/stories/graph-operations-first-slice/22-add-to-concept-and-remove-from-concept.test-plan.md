# Test Plan: Story 22 — `graph add-to-concept` and `remove-from-concept`

**Story:** `engineering-team/stories/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0022-add-to-concept-and-remove-from-concept.md` (with Amendment 1, at test design)
**Date:** 2026-11-17

**A10.20.b landed first.** TapestryProtocol/tapestry#132 merged into staging, and staging into this branch, at test design (ADR Amendment 1, item 12). So ADR 0042 is built: the rule's check form judges a node's tapestryJson from the tapestry-store, and the writes' `concepts` entries carry `waiting`. MS3 now derives, then judges (as 0042's SC9 does), and AT1, AT4 and AT48 check `waiting`.

Every suite is stack-free:
- It runs the real catalog in a child process (`test/helpers/operationsHarness.js`), over the fake graph (`test/helpers/graphFake.js`).
- Every service endpoint is dead.
- The harness's spy watches everything that signs or reads a key.

The stack-free suites can't reach five things, which the live check covers on a scratch stack (below):
- Neo4j's own locking, so two calls truly at once;
- a firmware reinstall, and its pass 1d and wire-implicit-elements;
- a restore;
- a fresh import of a peer's letter;
- nginx and the relay.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1: add a node to a concept | **AT1**: Whiskers, a pet, joins beagle directly under its superset. Beagle's section holds the name, the slug its name gives and the fields given; `wordTypes` gains beagle. The answer gives the node, `added`, `kept: json-tag`, each concept with whether it fits (the named one first), and both out-of-date flags false. **AT2**: its pet section, tags (one z naming beagle added), node properties, address, key and pet membership are as they were; its json tag is rewritten in place. **AT3**: the entry (`membership-added`, `section-added`, `tag-added`, `wordTypes`); `graph history` finds it by the node and by the concept; `list-elements` lists Whiskers. **AT18**: nothing is signed. | `test/operations/graph/add-to-concept.test.js` | integration (fake) |
| AC2: into a set | **AT4**: Fetch goes directly in walkers and joins dog and pet. Each is in `wordTypes` (dog first) and in the answer; a z naming dog and an n naming walkers are added. **AT5**: rover, already in beagle, goes in show beagles too, its JSON as it was; it gains a would-be n naming the set, recorded as `tag-added` (Amendment 1, item 7). **AT6**: a set that is the concept's own superset is the same as none. | `add-to-concept.test.js` | integration (fake) |
| AC3: the new section is checked | **AT40**: `invalid-fields` by `element-fits-schema`, naming each field and what is wrong. A required field left out is never filled in, and a node with no name, given none, leaves the schema to decide. **AT41**: `no-schema` for a missing schema, one that doesn't parse, two schema nodes, a missing LMDB entry and one that doesn't compile. **AT4**: another concept the set joins is reported, never refused. **AT48**: with word given its real schema, an add through a set word's thread holds is made, and word is reported waiting for the derive step (`fits: null`, `waiting: true`), not failing; the answer's `concepts` validate against the declared one. **AT1, AT4**: every entry carries `waiting: false`. **AT43**: nothing changes, nothing is recorded. | `add-to-concept.test.js` | integration (fake) |
| AC4: safe to repeat | **AT7**: `already-element`, `change: null`. `differs` names each field given that differs, with `holds` null for one the section lacks; the same holds with the set holding the node directly. **AT8**: two adds make one link and one entry. **AT20**: the node is locked, then the concept's header, so two calls go one at a time; a repeat writes only its locks. **L6**: two at once (live). | `add-to-concept.test.js`; live | integration (fake); live |
| AC5: anyone's node, the owner's claims only | **AT9**: another author's Snowy is filed under pet, `kept: beside`. `tapestryOwnSections` holds the section, its letter (tags, json tag, properties) is as recorded, no tag is written, and pet's schema judges the overlay. `list-elements` from everyone's point of view lists it. **AT10**: an admin's letter and a stranger's node with no letter are kept beside; the owner's letter is the instance's own (`json-tag`, `letterOutOfDate`). **AT11**: a person node; **AT12**: a placeholder, and firmware's rover, its file's JSON unchanged. **AT14**: another author's node kept beside is never `name-in-use`; **AT47**: firmware's own element, kept beside but at the assistant's address, is (Amendment 1, item 5). **RM9–RM11**: the owner's claim beside a letter, beside firmware's file, and one of two owner's sections are taken out, the author's own section staying in their letter. **RM36**: `firmware-membership`. **RM37**: `author-claim`. **MS2**: `elementsOf` lays the sections over. **MS3**: derived, then judged: the rule fits pet through the owner's section, which replaces the letter's whole. **MS8**: `keptIn`. | `add-to-concept.test.js`, `remove-from-concept.test.js`, `memberships-shared.test.js` | integration (fake); unit |
| AC6: take a node out | **RM1**: Two Home leaves pet. Its link, pet's section and key and its z naming pet go; beagle's section and z, and its word block, stay. The answer gives `removed`, `links`, `left`, `concepts`, `letters: []` and the flags. **RM2**: the entry keeps the section whole; history finds it by the node and by the concept; `list-elements` drops the node. **RM3**: `already-removed`, and add-to-concept with the section's fields undoes a removal. **RM4**: a concept or a set that doesn't reach the node. **RM5**: out of a set, staying in the concept; the n tag goes; `letters` names its own letter and the relationship event naming the pair. **RM6–RM8**: the concepts the node leaves with it (one this one is a kind of; the set's other concept; word), listed and never refused. | `remove-from-concept.test.js` | integration (fake) |
| AC7: never the last concept (D9) | **RM12**: two removals of a node's last two concepts, one after the other; the second is `last-concept` by `node-has-a-concept`, naming the concept, add-to-concept and delete-node. **RM18**: the re-check, when another write takes the node's other concept away while the call runs, rolls back with `last-concept`, saying so. **RM39**: a last concept that is firmware's or the author's is still answered `last-concept`. **RM17**: the locks. **MS10–MS12**: the rule's declaration, guard form and check form. **MS13**: the rulebook's entry 8. **GB2–GB6, GF9, IS8**: rule 8's item. **L6**: two at once (live). | `remove-from-concept.test.js`, `memberships-shared.test.js`, `test/graph-rules-builder.test.js`, `test/graph-rule-firmware.test.js`, `test/firmware-element-sync.test.js`; live | integration (fake); unit; live |
| AC8: what they refuse | Each refusal in Decision 17, by suite: add **AT31–AT42**, remove **RM31–RM40**. **AT43, RM41**: each refusal run changes nothing and records nothing. **AT44, RM42**: `not-installed`. | both suites | integration (fake) |
| AC9: it lasts, and reaches agents | **AT17, RM13**: the marks follow in the same write, recorded as copies; a node kept beside carries copies from the owner's section. **AT18, RM15**: the command, as the command's. **AT19, RM16**: listed, with `/docs`. **AT30, RM30**: 401, 403, 415, and the command's refusal is the route's. **XM1**: an admin agent through the external CLI. **MS4, MS5**: the derive step lays the sections over. **L1–L9**: reinstall, restore, a fresh import, nginx (live). | both suites, `memberships-agent-through-cli.test.js`, `memberships-shared.test.js`; live | integration (fake); unit; live |

### Decision 17's refusals and the outcomes

| Code | add-to-concept | remove-from-concept |
|---|---|---|
| `not-installed` (409) | AT44 | RM42 (a node of two concepts, so the guard passes) |
| `unknown-node` (404), node or set | AT31 (no node, a change entry), AT36 (set), AT46 (deleted meanwhile) | RM31, RM34, RM44 |
| `tag-node` (409) | AT32 | RM31 |
| `made-elsewhere` (409), the node | AT33 (header, superset, schema, property, set, rule) | RM32 |
| `made-elsewhere` (409), the concept | AT35 (all eleven) | not checked (Decision 3) |
| `unknown-concept` (404) | AT34 | RM33 |
| `reserved-key` (409) | AT34 | RM33 (even for a node only word reaches) |
| `no-superset` (409) | AT34 | RM33 |
| `not-a-set`, `not-in-class-thread` (409) | AT36 | RM34 (and a set outside the thread that reaches a node's only concept: the guard is silent, so `not-in-class-thread`, not `last-concept`: Amendment 1, item 10) |
| `bad-fields`, `bad-name` (400) | AT37 (`bad-name` names `fields`: Amendment 1, item 8) | not an input |
| `unreadable-json` (409) | AT38 (two json tags, unparsable, missing LMDB entry, a list; a letter, and sections beside, that don't parse) | RM35 |
| `name-in-use` (409) | AT39 (by name, case aside; by address; the owner's element), AT47 (firmware's own element) | not checked |
| `invalid-fields`, `no-schema` | AT40, AT41 | not checked |
| `firmware-membership` (409) | — | RM36 (an element file; a manifest edge) |
| `author-claim` (409) | — | RM37 (a z; an n) |
| `other-concept` (409) | — | RM38 (through a subconcept; through a shared set) |
| `last-concept` (409) | — | RM12, RM18, RM39 |
| `added` / `already-element` | AT1–AT6, AT9–AT17, AT48 / AT7, AT20 | — |
| `removed` / `already-removed` | — | RM1, RM5–RM15 / RM3, RM4, RM17 |

### The shared pieces

| Piece | Test |
|---|---|
| `F.overlaySections` (Decision 5) | **MS1** |
| `elementsOf` lays the sections over (Decision 6) | **MS2** |
| The rule judges the derive step's overlay: the real `deriveWord` builds the tapestryJson, a store stub keeps it, and the rule's `{ node, concept }` check reads it, as ADR 0042's SC9 runs them. Two sentinels hold today, so the failure is the overlay's, not the stubs' (Decision 6, Amendment 1 item 12) | **MS3** |
| `waiting` in the writes' `concepts` entries, through `Sch.fits` (ADR 0042 Decision 4; Amendment 1, item 12) | **AT1**, **AT4**, **AT48** |
| `deriveWord` and `NODE_FIELDS` (Decision 6) | **MS4**, **MS5** |
| `F.conceptsOfNodes(read, keys, { without })` (Decision 10) | **MS6** |
| M1 `M.waysIn`, M2 `M.reaches` (Decision 10, Amendment 1) | **MS7** |
| `M.keptIn` (Decision 2) | **MS8** |
| `M.firmwareMemberships` (Decision 11) | **MS9**, **RM36** |
| `node-has-a-concept` (Decision 12) | **MS10–MS12**, **RM12**, **RM18**, **RM39** |
| The rulebook's entry 8 | **MS13**, **GB2–GB6** |
| relationship-type-allowed's words, update-node's three "to come" strings (Amendment 1, item 9), the catalog's rows (Decision 16) | **MS14**, **MS15**, **MS16** |
| `changes.js`'s header (Decision 14) | **MS17** |
| Nothing new requires a signer | **MS18** |

## Edge cases

- [x] A node with no json tag gets one (AT15, `mute`); a JSON held in the store is written back inline, on both sides (AT15, RM14).
- [x] A section the view already holds is merged into, own (`stale`) and beside, starting from the author's (`peerStale`) (AT13).
- [x] Another author's element of the name is no clash (AT14, `petSnowy`); a node kept beside is never checked for a name in use (AT14, `peerLucky`).
- [x] Fields given as JSON text, on the route (AT14) and by both CLIs (AT18, XM1).
- [x] Word, through a set it shares with beagle (`commonSet`): leaving beagle leaves word too. That is listed and never refused, and the word block stays, `word` first in `wordTypes` (RM8). A node beagle and word reach, taken out of beagle, is the rule's finding (MS11, `commonOnly`).
- [x] A kind-of concept leaves with its subconcept (RM6); with `set`, both concepts that reach the named set leave (RM7).
- [x] The guard answers before the operation's own checks: a node whose last concept is firmware's (`firmwareRover`) or the author's (`snowy`) is `last-concept` (RM39).
- [x] A node another write deleted while the call waited: `unknown-node`, from the write path's second try (AT46, RM44).
- [x] A write whose entry can't be recorded keeps nothing (AT45, RM43).
- [x] Concurrency: lock order is read from the fake's log (AT20, RM17); the re-check is driven by `failures.shrinkBeforeDetach` (RM18); two calls at once on Neo4j are live (L6).
- [x] The marks: carried on an add, taken off on a remove, and copied from the owner's section for a node kept beside (AT17, RM13).
- [x] A concept whose schema wants the graphContext only the derive step builds: an add that joins it is made, the concept reported `waiting` (AT48).
- [ ] The concept graph API unavailable: not applicable; every suite is stack-free.

## Statements

Amendment 1 holds: the fake runs every statement the ADR names as it is. The fake isn't changed. A probe at test design ran each over this seed through `graphFake.exec`:
- M1, with backticked types, `labels(x)` and `elementId(r)`;
- M2's `count(*) AS n`, which answers 0 or 1;
- a `without` walk filtering `elementId(r)` on the last hop;
- the relationship event's lookup by its `nodeFrom` and `nodeTo` tags;
- unlink-set's pair delete for `HAS_ELEMENT`;
- C11's tag delete;
- S8 setting and removing `tapestryOwnSections`.

So no test pins statement text. MS7 calls `M.waysIn` and `M.reaches` over the fake, so a statement the fake can't run fails there, naming it.

The rule's E4 isn't among them. Since A10.20.b, the rule's check form judges a node's tapestryJson from the tapestry-store, and E4 reads only a name and an address, so this story doesn't change `element-fits-schema.js` (Amendment 1, item 12).

## Test infrastructure

- **Runner:** each suite exports `run`, and `test/operations.test.js` finds and runs every suite under `test/operations/`. The three rulebook and firmware suites run from `test/test.js`.
- **Seed:** `test/helpers/membershipGraph.js` (new). It starts from update-node's seed, `updateNodeGraph.js`, itself built on `createElementGraph.js`; neither changes. It adds:
  - json-data-type, firmware's concept, with its numeric set and two of its element files at their install addresses (`fwInteger`, `fwNumber`);
  - the relationship concept and a relationship event naming a set and an item;
  - the concept of neo4j properties, whose first set marks gadget's `size` and `color`;
  - `commonSet`, under beagle's superset and word's;
  - the nodes for each test.

  Its header says what each node is for. `storeEntries(dir)` puts `stored`'s and `storedPair`'s JSON in the store a run reads (`fieldGraph.seedLmdb`).
- **The fake graph and the harness:** unchanged (see Statements).
- **The derive step's children:** MS3, MS4 and MS5 run the real `deriveWord` (and MS5 `deriveByKey`) in a child with Neo4j, the store and the resolver stubbed in `require.cache`, as element-schemas does. MS3's stubbed database answers each statement by the parameters it takes, as SC9's does, and its store stub keeps what the derive step puts, for the rule to read.
- **Existing tests changed:** rule 8 joins `test/graph-rules-builder.test.js` (`REAL`, and GB3 reads a pattern for its description), `test/graph-rule-firmware.test.js` (`RULES`) and `test/firmware-element-sync.test.js` (`SCENARIO` and IS10). This mirrors story 20's commit for rule 7. Each fails today only where rule 8 is missing, and passes once `node src/firmware/graph-rules.js` writes its element.
- **Firmware:** the repo's active firmware (`firmware/active` → `versions/v1.0.0`), for firmware's rover, json-data-type's files and the class thread's type names. No `POST /api/firmware/install` is needed: nothing reads a live graph.
- **Not run here:** the full `npm test`, which on this Mac writes to the agent-memory instance. The PR's CI runs the full gate.

## How to run

Each suite alone, with every endpoint dead:

```
BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_PORT=9 TAPESTRY_CONTAINER=no-such-container NEO4J_URI=bolt://127.0.0.1:9 REDIS_PORT=9 node -e "require('./test/operations/graph/add-to-concept.test.js').run().then(r => { console.log(JSON.stringify({pass:r.pass,fail:r.fail,skipped:r.skipped})); process.exit(0); })"
```

The same for `remove-from-concept.test.js`, `memberships-shared.test.js` and `memberships-agent-through-cli.test.js`. The rulebook and firmware suites run as files, with the same variables:

```
node test/graph-rules-builder.test.js
node test/graph-rule-firmware.test.js
node test/firmware-element-sync.test.js
```

`graph-rule-firmware`'s live part runs only against a scratch container (`TAPESTRY_CONTAINER=tapestry-scratch…`).

Run these beside them once the code is in, since `_fields.js`, `word.js`, `tapestry-derive.js`, `update-node.js`, `relationship-type-allowed.js` and `changes.js` change:
- update-node, its shared suite and its agent;
- create-element, element schemas and elements' agent;
- map-fields, mark-field, unmark-field, fields and the rule `field-mark-allowed`;
- `element-fits-schema` and `relationship-type-allowed`, the rules' suites;
- add-relationship, remove-relationship, history and list-elements;
- delete-node, unlink-set and link-set;
- the fake graph, the write path and change-entry-fields.

## The live check (at Implementation, on `scripts/scratch-stack.sh`, never the agent-memory instance)

Check `docker ps` and the shared notes before taking `tapestry-scratch`, note it there, and take it down afterwards.

- **L1:** XM1's run, through the external CLI, by an admin agent with its own key. The agent:
  - adds an element create-element made to a second concept;
  - adds it again (`already-element`);
  - puts it in a set, takes it out of the set, and takes it out of the second concept;
  - adds a peer's node;
  - is refused fields that don't fit, the peer's claim, and the last concept.
- **L2:** a peer's lettered node, made with Cypher as story 21's live check made one, is added to a concept with fields. Its tags and json tag are unchanged, and `tapestryOwnSections` holds the section.
- **L3:** two firmware reinstalls after a set of adds and removes:
  - each membership and section stays as the calls left it, kept in the json tag or beside;
  - the z and n tags added stay, the ones taken out stay out, and so do the copies;
  - a membership taken out isn't linked again by pass 1d or wire-implicit-elements.
- **L4:** a backup restored on a fresh instance: the same.
- **L5:** the peer's letter imported again. The owner's section beside it, and the owner's membership, stay; the letter's tags are remade as the import makes them.
- **L6:** two adds of one membership at once give one link and one entry. Two removes of a node's last two concepts at once give one `removed` and one `last-concept`; say which check answered it (the re-check, Decision 15). An add beside an update-node of the node goes after it.
- **L7:** the derive step, after an add to a node kept beside: its rebuilt tapestryJson (`GET /api/tapestry-key/:key`) holds the owner's section, and `cacheOutOfDate` was reported before.
- **L8:** through nginx: a visitor gets 401 and a stranger 403.
- **L9:** across L1–L8, the relay's event count is unchanged: nothing was signed.
- **L10:** rule 8's element, after `node src/firmware/graph-rules.js` and a reinstall: `TAPESTRY_CONTAINER=tapestry-scratch node test/graph-rule-firmware.test.js` (GL1–GL3) lists eight items.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-17, on `A10.22-add-remove-from-concept` at `6def43be` (staging merged in, A10.20.b with it), with this phase's tests and helpers and the gate's edits, each suite alone with every endpoint dead:

```
operations: graph add-to-concept: 0 passed, 39 failed, 0 skipped
  FAIL  AT1–AT48: src/operations/catalog/graph/add-to-concept.js does not exist yet (ADR graph-operations-first-slice/0022 Decision 1)

operations: graph remove-from-concept: 0 passed, 33 failed, 0 skipped
  FAIL  RM1–RM44: src/operations/catalog/graph/remove-from-concept.js does not exist yet (ADR graph-operations-first-slice/0022 Decision 1)

operations: what add-to-concept and remove-from-concept share: 0 passed, 18 failed, 0 skipped
  FAIL  MS1: F.overlaySections does not exist yet in src/operations/catalog/graph/_fields.js (ADR graph-operations-first-slice/0022 Decision 5)
  FAIL  MS2: peerItem reads as its letter with the owner's pet section laid over it, pet's key in wordTypes …; got {"json":{"word":{… "wordTypes":["word","beagle"]},"beagle":{…}},"problem":null}
  FAIL  MS3: peerItem's letter has no pet section; the owner's, beside it, reaches its tapestryJson through deriveWord's overlay, which the rule judges: it fits pet (Decision 6); got [{"concept":"pc","code":"invalid-fields","missing":false,"message":"\"Peer Item\" (39999:eeee…:peer-item-3f1b6f17) doesn't fit the JSON schema of \"pet\" (pc-address): `pet` is required. …","problems":["`pet` is required"]}], the derived pet section null
  FAIL  MS4: over the json tag's JSON: the owner's pet section joins …; got {"beagle":{"name":"Peer","slug":"peer","description":"the author's"}}
  FAIL  MS5: the node read by its key carries tapestryOwnSections to deriveWord …; got ["word","beagle","graphContext"]
  FAIL  MS6: without walkers' link to it, no concept reaches it; got ["4624634e-…>93a1dcd5-…","4624634e-…>93db6b53-…"] (walkerMax, still dog's and pet's)
  FAIL  MS7–MS9: src/operations/catalog/graph/_memberships.js does not exist yet (ADR graph-operations-first-slice/0022 Implementation notes)
  FAIL  MS10–MS12: rule node-has-a-concept isn't loaded: src/operations/rules/node-has-a-concept.js does not exist yet (ADR graph-operations-first-slice/0022 Decision 12)
  FAIL  MS13: docs/GRAPH_RULES.md has no entry "## 8. `node-has-a-concept`" yet (ADR graph-operations-first-slice/0022 Decision 12)
  FAIL  MS14: the reserved-type message names the three operations; got HAS_ELEMENT is reserved: it is made by graph add-to-concept and create-element, with the checks it needs. …
  FAIL  MS15: not-an-element names graph add-to-concept as built: no "(A10.22, to come)"; got … graph add-to-concept (A10.22, to come) makes a node …
  FAIL  MS16: add-to-concept's row names ADR graph-operations-first-slice/0022, its rule `element-fits-schema`, and its inputs as built (concept, set?); got "| `add-to-concept` | … `node`, `concept` or `set`, `fields?` → the membership | …"
  FAIL  MS17: the comment before CHANGE names ADR graph-operations-first-slice/0022 …
  FAIL  MS18: src/operations/catalog/graph/add-to-concept.js does not exist yet (ADR graph-operations-first-slice/0022 Implementation notes)

operations: an admin agent adds and removes memberships through the external CLI: 0 passed, 1 failed, 0 skipped
  FAIL  XM1: src/operations/catalog/graph/add-to-concept.js and src/operations/catalog/graph/remove-from-concept.js do not exist yet (ADR graph-operations-first-slice/0022 Decision 1): the external CLI exited 2: 'graph add-to-concept' isn't among the operations … may call

graph-rules-builder: 21 passed, 5 failed, 0 skipped
  FAIL  GB2: the entries, in order, are [[1,…],…,[7,"element-fits-schema"],[8,"node-has-a-concept"]]; got [[1,…],…,[7,"element-fits-schema"]]
  FAIL  GB3: an item for node-has-a-concept
  FAIL  GB4, GB5: an item named node-has-a-concept; the items are [… "element-fits-schema"]
  FAIL  GB6: the folder holds one file per entry, named for its rule; got [… seven files]

graph-rule-firmware: 12 passed, 1 failed, 4 skipped (GL1–GL4, live)
  FAIL  GF9: one element per rule; got [… seven files]

firmware-element-sync: 20 passed, 1 failed, 0 skipped
  FAIL  IS8: all 8 elements were looked up, the ones after the failure included; got 7
```

**MS3 fails for the overlay's reason, not the stubs'.** Its two sentinels hold today: a letter whose pet section fits is judged fitting, and one whose pet section lacks a description is one finding naming `pet.description`. Both are derived, kept in the store stub and judged, and neither finding is marked missing. Before this rewrite, MS3 read the rule's check of a node the store held nothing for, and failed on `"missing":true`, which the code couldn't have fixed.

**Each test gets past the declaration.** In scratch copies of the two operation suites, with the declaration check turned off, every test reached its first status check and failed on today's `404 Cannot POST /api/tapestry/graph/<operation>`. That covers all 39 of add-to-concept's, AT47 and AT48 among them, and all 33 of remove-from-concept's. AT19 and RM16 failed at "is listed". None failed in the test code. The same harness run answered update-node correctly over the new seed, through the store and gadget's marks. So the seed and the plumbing work, and what is left to fail is the feature. AT48's expectation was checked against the merged `Sch.fits` itself. Over the seed, with word's real schema, it gives word `fits: null, waiting: true`, and beagle and pet `fits: true, waiting: false`.

**What passes today, and why that is right:** the tests GB1, GB7–GB10, GP1–GP15, GF1–GF8, GF10–GF13, ES1–ES11, IS1–IS7, IS9 and IS10 pass as before. They check the rulebook, firmware and install machinery, which this phase doesn't change. No new test passes today.
