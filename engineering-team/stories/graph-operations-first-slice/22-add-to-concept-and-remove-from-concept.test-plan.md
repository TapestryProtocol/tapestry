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

## Added at review round 1 (2026-11-18)

The review passed with eight non-blocking findings, and the owner chose to fix them before the PR (ADR Amendment 2, items 1–8). Each item got its tests before any fix.

| Item | Tests | What they pin |
|---|---|---|
| 1, the missing section | **AT49** | AT4's Fetch, in pet through walkers with no pet section, added to pet with fields: `added`, one `section-added`, no `membership-added` and no new link. The same call again is `already-element`, since its view now holds the section. AT7 stands. |
| | **AT50** | The same for a node kept beside: Snowy, in pet through walkers, gains pet's section in `tapestryOwnSections`, beside its dog section. No new link; its letter is as it was. |
| | **AT51** | Story 22's undo. Goldie leaves golden retriever, and dog with it. Then add-to-concept puts it into golden retriever, then into dog with dog's fields from the entry. Both sections are back as they were, and `wordTypes` names the same concepts. |
| | **MS19** | update-node's `no-section` message, its published `when`, and add-to-concept's description each say add-to-concept gives the section a node lacks. It looks for "lacks", "missing", "doesn't have", "has no" or "without" after the first mention of add-to-concept. |
| 2, `wordTypes` | **AT52** | Mark Me, in dog, put in walkers: its `wordTypes` gains pet, recorded as `field-changed` on `word.wordTypes`; no pet section. |
| 3, the guard | **RM32** (changed) | Two cases from the review's probe 2 join it: firmware's set-concept header out of the concept-header concept, and walkers out of the set concept. Each is refused `made-elsewhere`, naming `update-concept` and `link-set`, not `last-concept`. |
| 4, letters | **RM45** | Paired Item out of show beagles: `letters` holds its own letter and `relInConcept`, which the relationship concept's class thread reaches. It doesn't hold `relZOnly`, which only its `z` tag names, with no class-thread link. |
| 5, the repeat | **AT53** | Twofer, already in beagle with two json tags that differ, added to beagle: `unreadable-json`, naming `node`. |
| 6, a removal beside | **RM46** | Peer Garbled's owner claim in pet is taken out, though its author's letter doesn't parse: `removed`, its last section beside gone with the property, its letter, tags and other properties as they were, still in beagle. |
| | **RM35** (changed) | Keeps `unreadable-json` for a `json-tag` node's two json tags that differ, and for `tapestryOwnSections` that doesn't parse. `uj-peer` left REF for MAIN, as RM46's `peer-garbled`, since that removal now changes the graph. |
| 7, words | **MS20** | Rulebook entry 7 says `graph add-to-concept` calls the check: the first "call" after it isn't "will call". Entry 8's Says has "through the other concepts' supersets under its own", not "through its word block". Rule 7's and rule 8's element files say the same. GB6 and GB9 still hold the files to the rulebook. |
| | **MS21** | Both operations publish `no-superset` and `not-installed` (409) with a `when` of their own, not create-element's. remove-from-concept's no longer speaks of putting an element in, or of a would-be author. |
| 8, follow-ups | **MS22** | A ledger row naming ADR 0022 carries each of follow-ups 1, 2, 3 and 5, as "follow-up N". Follow-up 1's also says that the owner's membership counts as the node's author's. The Loom memo for follow-up 4 isn't testable here. |

**The seed** (`test/helpers/membershipGraph.js`) gains two things:
- Paired Item, with two relationship events naming it, `relInConcept` and `relZOnly`, for item 4.
- Goldie's golden retriever section gains its `name`. Its sections are then the ones add-to-concept builds, so AT51's undo can give them back exactly.

No other test's outcome changed.

**The guards, and what each mutation shows.** AT53 and RM35 pass on today's code, since they pin what it already does. Each was checked by a scratch edit of a copy (`git archive` of HEAD, this phase's tests laid over it, every file restored after), never the real `src/`:
- **AT53** fails when the repeat swallows `jsonOf`'s refusal (G5).
- **RM35** fails, with RM41, when differing json tags are taken as the first (G6a), and again when `tapestryOwnSections` that doesn't parse is read as none (G6b).
- **RM32**, for item 3's guard: with the guard made silent for a node `X.changedElsewhere` names (item 3's fix, simulated in the copy, G3a), RM32 passes and every other test answers as before. So RM32 fails today because the guard answers first. With the guard silent and apply's `made-elsewhere` also taken out (G3b), RM32 fails again: it holds that answer too.

**Today's code** (`841b7549`, at `1aff849e` with the review), each suite alone with every endpoint dead:

```
  FAIL  AT49 [AC2, AC4, Amendment 2 item 1]: a node already in the concept whose JSON lacks its section is given it: added, section-added, no new link; then it is already-element
        Fetch is in pet through walkers, but its JSON has no pet section: add-to-concept gives it one, added, not already-element (Amendment 2, item 1); got {"outcome":"already-element",…}
  FAIL  AT50 [AC5, Amendment 2 item 1]: the same for a node kept beside: its missing section goes into tapestryOwnSections, beside the dog section it has, and its letter stays
        Snowy is in pet through walkers, and neither its letter nor the owner's sections hold pet's section: it is given one, added (Amendment 2, item 1); got {"outcome":"already-element",…,"kept":"beside",…}
  FAIL  AT51 [AC6, Amendment 2 item 1]: a removal that also leaves a second concept is undone by add-to-concept: Goldie back into golden retriever, then dog with dog's fields from the entry, both sections as they were
        Goldie is in dog again, through golden retriever, with no dog section: add-to-concept with dog's fields from the entry gives it back, added, not already-element (Amendment 2, item 1); got 200 {"success":true,"data":{"outcome":"already-element",…}}
  FAIL  AT52 [AC2, Amendment 2 item 2]: a node already in the concept, put in a set another concept also reaches, gains that concept's key in wordTypes, recorded
        its wordTypes gains pet, the other concept walkers reaches, as a new membership's does (AC2; Amendment 2, item 2); got ["word","beagle","dog"]
operations: graph add-to-concept: 40 passed, 4 failed, 0 skipped

  FAIL  RM45 [AC6, Amendment 2 item 4]: letters names the instance's own relationship event the relationship concept's class thread reaches, and leaves out one only its z tag names
        letters: its own letter and relInConcept, …; never relZOnly, which only its z tag names, with no link, as a scan of tag nodes would find it (Amendment 2, item 4); got three: Paired Item's letter, relInConcept (…:8f82d6fdfdb920e0) and relZOnly (…:a742a67e6178e10e)
  FAIL  RM46 [AC5, Amendment 2 item 6]: the owner's claim is taken out beside an author's letter that doesn't parse, writing only tapestryOwnSections
        peer-garbled must answer 200; got 409 {"success":false,"error":"\"Peer Garbled\" (39999:eeee…:peer-garbled-3f1b6f17)'s JSON can't be read: its json tag isn't JSON that parses, …","code":"unreadable-json","input":"node"}
  FAIL  RM32 [AC8, Decision 2, Amendment 2 item 3]: a node another operation looks after is refused made-elsewhere, naming the operation, even when the concept named is its only one but word
        men-fw-header must be refused 409 made-elsewhere; got 409 {"success":false,"error":"Taking \"set\" (39998:dddd…:set) out of \"concept header\" (39998:dddd…:concept-header) would leave it an element of no concept but word: …","code":"last-concept",…}
operations: graph remove-from-concept: 32 passed, 3 failed, 0 skipped

  FAIL  MS19 [Amendment 2 item 1]: update-node's no-section words and add-to-concept's description say add-to-concept gives a node the section it lacks
        the refusal says graph add-to-concept gives a node the section it lacks, a concept it is already in included, …; got "… update-node changes a section the node already has; graph add-to-concept gives a node another concept's section. Nothing changed."
  FAIL  MS20 [Amendment 2 item 7]: rulebook entry 7 says add-to-concept calls the check, as built; entry 8 says word reaches "through the other concepts' supersets under its own"; and both elements say the same
        entry 7's Enforced by says graph add-to-concept calls the check, not "will call … when they are built" (review round 1, finding 7); got "… and `graph add-to-concept` (A10.22) and the property operations (A10.18) will call when they are built. …"
  FAIL  MS21 [Amendment 2 item 7]: each operation publishes no-superset and not-installed worded for itself, not create-element's, with the same codes and statuses
        add-to-concept's no-superset publishes a when of its own (M's declaration), not create-element's "A concept with no superset, so no class thread to put the element in (BIBLE §10, rule 1)"
  FAIL  MS22 [Amendment 2 item 8]: ledger rows carry ADR 0022's follow-ups 1, 2, 3 and 5, and follow-up 1's states the other half of the missing provenance
        a ledger row names ADR 0022's follow-up 1, so /whats-open finds it (review round 1, finding 8); the rows naming the ADR are ["2026-11-18-rule-eight-awaits-firmware-reinstall.md"]
operations: what add-to-concept and remove-from-concept share: 18 passed, 4 failed, 0 skipped

operations: an admin agent adds and removes memberships through the external CLI: 1 passed, 0 failed, 0 skipped
graph-rules-builder: 26 passed, 0 failed, 0 skipped
graph-rule-firmware: 13 passed, 0 failed, 4 skipped (GL1–GL4, live)
firmware-element-sync: 21 passed, 0 failed, 0 skipped
```

The scratch mutations:

```
{"id":"G3a","what":"item 3, its fix simulated: the guard silent for a node X.changedElsewhere names","suites":{"remove-from-concept":{"pass":33,"fail":2,"failed":["RM45","RM46"]},"memberships-shared":{"pass":18,"fail":4,"failed":["MS19","MS20","MS21","MS22"]}}}
{"id":"G3b","what":"item 3: the guard silent as in G3a, and apply's made-elsewhere taken out","suites":{"remove-from-concept":{"pass":32,"fail":3,"failed":["RM45","RM46","RM32"]}}}
{"id":"G5","what":"item 5: the repeat answers before it can tell the JSON can't be read (its jsonOf's refusal swallowed)","suites":{"add-to-concept":{"pass":39,"fail":5,"failed":["AT49","AT50","AT51","AT52","AT53"]}}}
{"id":"G6a","what":"item 6's kept case: json tags that differ no longer refused (the first taken)","suites":{"remove-from-concept":{"pass":30,"fail":5,"failed":["RM45","RM46","RM32","RM35","RM41"]}}}
{"id":"G6b","what":"item 6's kept case: tapestryOwnSections that don't parse no longer refused (read as none)","suites":{"remove-from-concept":{"pass":30,"fail":5,"failed":["RM45","RM46","RM32","RM35","RM41"]}}}
```

## Added at review round 2 (2026-11-18)

Review round 2 asked for changes: one blocking gap, which round 1's fix for `wordTypes` opened, and five non-blocking ones (ADR Amendment 3, items 1–6). The owner chose to fix them before the PR. Each item that code or published words can show got its tests before any fix.

| Item | Tests | What they pin |
|---|---|---|
| 1, rule 4 judges a changed JSON (R2-1) | **AT54** | Mark Me is put in dog, with no breed. Then it is put in golden retriever's superset through dog, so its `wordTypes` would gain `goldenRetriever`. Dog's schema judges the JSON the call would leave: `invalid-fields` by `element-fits-schema`, naming `dog.breed` in dog's schema. Golden retriever, which the set joins, isn't what refuses it. Nothing changes: no link, no `n`, no entry, `wordTypes` as it was. Command Beagle, a new member, put in the same set is refused the same way today. |
| | **AT55** | The other side. Bare's beagle section holds neither name nor slug. Bare is put in show beagles with fields, as AT5 puts rover there. Its JSON is unchanged, and only the set's link and its `n` are written. So it is `added`, beagle's verdict reported (`fits: false`, naming `beagle.name` and `beagle.slug`), not refused. `differs` names the field given, which isn't written. |
| 2, the story's AC2 and AC4 (R2-2) | none | The story's words; no code changes. |
| 3, `letters`' words (R2-3) | **MS23** | `M.LETTERS`' description says `letters` finds the instance's own relationship events through the relationship concept. One of its sentences says an event signed since the last reinstall can be missing. |
| | **RM47** | The same in remove-from-concept's published description, read from the operations listing. A sentence matches when it has "since" (or "after") with "last" and "reinstall", and one of "missing", "miss", "absent", "left out" or "not (yet) listed / named / found / there". |
| 4, item 1's untested parts (R2-4) | **AT56** | A section given alone writes no would-be tag. FILL's Fetch, given pet's section, gains no `z` naming pet. walkerMax, directly in walkers, is given pet's section through walkers. Its seed tags name neither pet nor walkers, and it gains neither. |
| | **AT57** | Rule 4 judges the section given alone. Fetch, kept in its json tag, and Snowy, kept beside, are each in pet through walkers with no pet section. Each is given `description: 5`, and each is refused `invalid-fields`, naming `pet.description`. Nothing changes. |
| 5, `differs`' words (R2-5) | **AT58** | add-to-concept's published description has a sentence naming a node kept beside (or another author), a removal and an add. It also says update-node refuses such a node, or that the change isn't made through update-node. |
| 6, the merge with staging (R2-6) | none new | Done at `a49c76a5`. The builder, firmware and sync suites run on the merged tree, as below. |

**The seed doesn't change.** ROUND2 is a run of its own: three harness runs over one fresh seed, each read back after it ran.
- **SETUP** puts Mark Me in dog, Fetch and Snowy in dog through walkers, and Bare in show beagles. It also gives walkerMax its pet section through walkers.
- **GR** holds AT54's two calls into golden retriever's superset.
- **BAD** holds AT57's two refusals.

Every call in GR, once item 1 is built, and every call in BAD is refused. So each run must leave the graph as the run before it left it, and AT54 and AT57 compare the whole graph, change entries included.

**Tests that pass today.**
- AT56 and AT57 pin what the code already does.
- AT55 pins the other side, which item 1's fix must keep.

**The scratch edits.** Each ran on a copy, never the real `src/`. The copy is a `git archive` of HEAD with this round's tests laid over it, and every file was restored after each edit. Each edit's suites ran against a baseline of the same suites on the copy, and only tests whose result changed are listed:
- **N12** is the Reviewer's candidate fix: rule 4 runs whenever the call changes the node's JSON. AT54 passes, and no other test in the four suites that load add-to-concept answers differently.
- **N13** is a wrong fix: rule 4 judges every call that isn't a repeat, so a JSON left unchanged too. AT54 passes under it as well, and AT55 fails. So AT55 is what tells the two fixes apart.
- **N4** writes the would-be tags for a section given alone, and AT56 fails, on Fetch.
- **N4s** does the same only when a set is given, and AT56 still fails, on walkerMax.
- **N5** skips rule 4 for a node already in the concept, and AT57 fails, on Fetch.
- **N5b** skips it only for a node kept beside, and AT57 still fails, on Snowy.
- **W** lays Amendment 3's words in, and MS23, RM47 and AT58 pass.
- **Wp** gives half of each set of words: the relationship concept without the reinstall gap, and the removal and the add without update-node's refusal. MS23, RM47 and AT58 each still fail, on their second assertion.

Their output, each suite's passed/failed after the edit:

```
baseline (the copy, unchanged): add-to-concept 47/2 (AT54, AT58); remove-from-concept 35/1 (RM47); memberships-shared 22/1 (MS23); memberships-agent-through-cli 1/0
{"id":"N12","what":"the Reviewer's candidate fix for R2-1: rule 4 runs whenever the call changes the node's JSON","changed":["AT54 FAIL -> PASS"],"suites":{"add-to-concept":"48/1","remove-from-concept":"35/1","memberships-shared":"22/1","memberships-agent-through-cli":"1/0"}}
{"id":"N13","what":"a wrong fix for R2-1: rule 4 judges every call that is not a repeat, one that leaves the JSON unchanged included","changed":["AT54 FAIL -> PASS","AT55 PASS -> FAIL"],"suites":{"add-to-concept":"47/2"}}
{"id":"N4","what":"R2-4's first part taken out: the would-be tags written for a section given alone","changed":["AT56 PASS -> FAIL"],"suites":{"add-to-concept":"46/3"}}
{"id":"N4s","what":"N4 for a section given through a set only: the would-be tags written when a set is given, though no link is made","changed":["AT56 PASS -> FAIL"],"suites":{"add-to-concept":"46/3"}}
{"id":"N5","what":"R2-4's second part taken out: rule 4 skipped for a section given to a node already in the concept","changed":["AT57 PASS -> FAIL"],"suites":{"add-to-concept":"46/3"}}
{"id":"N5b","what":"N5 for a node kept beside only: rule 4 skipped for a section given beside to a node already in the concept","changed":["AT57 PASS -> FAIL"],"suites":{"add-to-concept":"46/3"}}
{"id":"W","what":"items 3 and 5's words, as Amendment 3 gives them","changed":["AT58 FAIL -> PASS","RM47 FAIL -> PASS","MS23 FAIL -> PASS"],"suites":{"add-to-concept":"48/1","remove-from-concept":"36/0","memberships-shared":"23/0"}}
{"id":"Wp","what":"half of each: the relationship concept without the reinstall gap; the removal and the add without update-node's refusal","changed":[],"suites":{"add-to-concept":"47/2","remove-from-concept":"35/1","memberships-shared":"22/1"},"stillFailing":["AT58: and that graph update-node, which refuses such a node, isn't the way for it…","RM47: and that one signed since the last firmware reinstall, as one today's add-to-set has just signed, can be missi…","MS23: and that one signed since the last firmware reinstall, as one today's add-to-set has just signed, can be missi…"]}
```

**Today's code** (`f7a72259`, at `a49c76a5` with staging merged), each suite alone with every endpoint dead:

```
  FAIL  AT54 [AC3, Amendment 3 item 1]: a node already in dog, with no breed, put in golden retriever's superset through dog is refused invalid-fields naming dog.breed, as a new member is: the wordTypes the call would write is judged, and nothing changes
        Mark Me, already in dog with its section, put in the same set must be refused alike: the call would add goldenRetriever to its wordTypes, a change to its JSON, so dog's schema judges the JSON as the call would leave it (Amendment 3, item 1; AC3); got 200 {"success":true,"data":{"outcome":"added",…,"kept":"json-tag","concepts":[{…,"key":"dog","fits":false,"problems":[{"path":"dog","message":"`dog.breed` is required"},…
  FAIL  AT58 [AC4, Amendment 3 item 5]: the published description says how the fields differs names change: graph update-node for the instance's own node, and for a node kept beside another author's letter, which update-node refuses, a removal and then an add
        a sentence says a node kept beside another author's letter changes the fields differs names by a removal and then an add with them (Amendment 3, item 5; ledger row 2026-11-18-update-node-refuses-owner-sections-beside); its sentences on differs are ["Safe to repeat: … naming in `differs` each field given that differs from what its section holds; `graph update-node` changes those."]
operations: graph add-to-concept: 47 passed, 2 failed, 0 skipped

  FAIL  RM47 [AC6, Amendment 3 item 3]: the published description says letters finds the instance's own relationship events through the relationship concept, and that one signed since the last reinstall can be missing
        it says letters finds the instance's own relationship events through the relationship concept, as RM45 shows (Amendment 3, item 3); its sentences on letters and reinstalls are ["… so a firmware reinstall doesn't link it again.","… since the next import or a firmware reinstall would make it again.","`letters` names the instance's own letters that still state a removed membership: the node's own letter, and a relationship event that names a removed pair."]
operations: graph remove-from-concept: 35 passed, 1 failed, 0 skipped

  FAIL  MS23 [Amendment 3 item 3]: letters' description in _memberships.js says it finds the instance's own relationship events through the relationship concept, and that one signed since the last reinstall can be missing
        it says letters finds the instance's own relationship events through the relationship concept, as remove-from-concept's RM45 shows (Amendment 3, item 3); got "The instance's own letters that still state a removed membership: the node's own letter, for one of the instance's own nodes that has one, and a relationship event of the instance's own that names a removed pair, as today's add-to-set signs one. export nostr (A10.34) is what sends letters that match"
operations: what add-to-concept and remove-from-concept share: 22 passed, 1 failed, 0 skipped

operations: an admin agent adds and removes memberships through the external CLI: 1 passed, 0 failed, 0 skipped
graph-rules-builder: 26 passed, 0 failed, 0 skipped
graph-rule-firmware: 13 passed, 0 failed, 4 skipped (GL1–GL4, live)
firmware-element-sync: 21 passed, 0 failed, 0 skipped
```

Round 1's tests all pass on this code, AT49–AT53, RM45, RM46 and MS19–MS22 among them.

## Added at review round 3 (2026-11-18)

Review round 3 passed with two non-blocking findings, both about words (R3-1 and R3-2; ADR Amendment 4, items 1 and 2). The owner chose to fix them before the PR. Each got its tests before any fix, all in the add suite.

| Item | Tests | What they pin |
|---|---|---|
| 1, a member's misfit names the way on (R3-1) | **AT59** | AT54's call is refused for a misfit its `wordTypes` change brings, and it writes no section. Mark Me, already in dog with its section, is put in golden retriever's superset through dog, and refused `invalid-fields` naming `dog.breed`. The same call with `fields: { breed: "goldenRetriever" }`, the review's probe 6 Q1, joins ROUND2's GR run and is refused too. Each refusal must also do three things. It says that fields given in this call aren't written into a section the node already holds. It names the way on: add Mark Me to golden retriever, the concept the set joins. Then it says to give dog's missing field with `graph update-node`. |
| | **AT60** | So a fix can't over-reach, a refused call that writes a section keeps the rule's plain message. The calls are Command Beagle's, a new member's (AT54), and Fetch's and Snowy's, each given pet's missing section (AT57). Each message starts as the rule's does ("The element's JSON doesn't fit the JSON schema of …"). None names update-node, add-to-concept or remove-from-concept, or says "written" or "merged". |
| 2, the words for a node kept beside (R3-2) | **AT61** | add-to-concept's published description has a sentence about a node kept beside, a removal and an add. That sentence says they change the owner's own section. A sentence says a section the author's letter holds, for a membership their letter claims, stays theirs. The removal-and-add sentence is for every node kept beside: its "kept beside" isn't followed by "another author". AT58 is unchanged, and still matches Amendment 4's sentence. |

**What the word tests accept.** Each sentence test looks inside one sentence; the text is split after a full stop, a question mark or an exclamation mark.
- **AT59, fields left unwritten:** "field(s)", "section", a negation ("aren't", "isn't", "not", "never", "doesn't", "won't") and "written", "write(s)", "merged" or "merge(s)".
- **AT59, the way on:** golden retriever by name (or `goldenRetriever`, or its header's key) with "add" or add-to-concept. A sentence, the same one or another, holds `update-node` with "dog" or "breed".
- **AT61:**
  - "owner's own section";
  - "the author's letter holds" or "their letter holds", with "letter claims" and "stays theirs" (or "remains theirs").

Amendment 4's own sentence passes (W3, below).

**Not tested: the way on for a node kept beside.** Amendment 4 item 1 says that for a node kept beside, the way on is a removal and then an add. No call can reach that refusal for such a node. add-to-concept never changes a beside node's `wordTypes`. So a call that writes it no section changes none of its JSON, and is reported, not judged (AT55's rule). AT59 doesn't ask for those words, and doesn't forbid them.

**Tests that pass today.** AT60 pins what a fix must keep. The scratch edits show it catches both over-reaches.

**The scratch edits.** These ran as round 2's did: on a copy of HEAD (`394e7dae`) with this round's add suite laid over it, each file restored after its edit, against a baseline of the same suites on the copy.
- **F1** simulates item 1's fix. When a call that writes no section is refused `invalid-fields`, the rule's message gains "Fields given in this call aren't written into the "dog" section the node already holds." It then names golden retriever with add-to-concept, and dog's missing fields with update-node. AT59 passes, and no other test in the four suites that load add-to-concept answers differently.
- **F2** is an over-reach: those words on every `invalid-fields` refusal of add-to-concept. AT59 passes, and AT60 fails, on Command Beagle.
- **F3** is an over-reach too: those words for any node already in the concept, so for one given its missing section. AT59 passes, and AT60 fails, on Fetch.
- **W3** lays in Amendment 4 item 2's sentence. AT61 passes, and AT58 still passes.
- **W3h** has only the owner's own section, not the author's section staying theirs. AT61 still fails, on its second assertion.
- **W3n** is Amendment 4's sentence, but still for a node "kept beside another author's letter". AT61 still fails, on its third assertion.

Their output, each suite's passed/failed after the edit:

```
baseline (the copy, unchanged): add-to-concept 50/2 (AT59, AT61); remove-from-concept 36/0; memberships-shared 23/0; memberships-agent-through-cli 1/0
{"id":"F1","what":"item 1's fix, simulated: a call that writes no section adds to its invalid-fields refusal that fields aren't written, and the way on","changed":["AT59 FAIL -> PASS"],"suites":{"add-to-concept":"51/1","remove-from-concept":"36/0","memberships-shared":"23/0","memberships-agent-through-cli":"1/0"}}
{"id":"F2","what":"an over-reach: every invalid-fields refusal of add-to-concept gets those words","changed":["AT59 FAIL -> PASS","AT60 PASS -> FAIL"],"suites":{"add-to-concept":"50/2"}}
{"id":"F3","what":"an over-reach: those words for any node already in the concept, a section it is given included","changed":["AT59 FAIL -> PASS","AT60 PASS -> FAIL"],"suites":{"add-to-concept":"50/2"}}
{"id":"W3","what":"item 2's sentence, as Amendment 4 gives it","changed":["AT61 FAIL -> PASS"],"suites":{"add-to-concept":"51/1"}}
{"id":"W3h","what":"half of it: the owner's own section, without the author's section staying theirs","changed":[],"suites":{"add-to-concept":"50/2"},"stillFailing":["AT61: and that a section the author's letter holds, for a membership their letter claims, stays theirs: su…"]}
{"id":"W3n","what":"Amendment 4's sentence, but still only for a node beside another author's letter","changed":[],"suites":{"add-to-concept":"50/2"},"stillFailing":["AT61: the sentence is for every node kept beside, not only one beside another author's letter: person node…"]}
```

**Today's code** (`9c6d890c`, at `394e7dae`), each suite alone with every endpoint dead:

```
  FAIL  AT59 [AC8, Amendment 4 item 1]: Mark Me's refusal, from a call that writes no section, says fields given in it aren't written into the section it holds, and names the way on: golden retriever, then dog's breed with update-node
        r2-gr: the refusal says fields given in this call aren't written into a section the node already holds, since the call writes no section, so giving the breed here can't help (Amendment 4, item 1; the review's R3-1); got "The element's JSON doesn't fit the JSON schema of \"dog\" (39998:dddd…:dog): `dog.breed` is required; the element's JSON must match \"then\" schema."
  FAIL  AT61 [AC4, Amendment 4 item 2]: the published description says a removal and then an add change the owner's own section of any node kept beside, and that a section the author's letter holds, for a membership their letter claims, stays theirs
        a sentence says what a removal and then an add change for a node kept beside: the owner's own section (Amendment 4, item 2; the review's R3-2); its sentences on a node kept beside are ["For a node kept beside another author's letter, which `graph update-node` refuses, a removal and then an add with the fields change them."]
operations: graph add-to-concept: 50 passed, 2 failed, 0 skipped

operations: graph remove-from-concept: 36 passed, 0 failed, 0 skipped
operations: what add-to-concept and remove-from-concept share: 23 passed, 0 failed, 0 skipped
operations: an admin agent adds and removes memberships through the external CLI: 1 passed, 0 failed, 0 skipped
graph-rules-builder: 26 passed, 0 failed, 0 skipped
graph-rule-firmware: 13 passed, 0 failed, 4 skipped (GL1–GL4, live)
firmware-element-sync: 21 passed, 0 failed, 0 skipped
```

Every earlier round's test passes on this code, AT54 among them with the retry added to its run.

## Added at review round 4 (2026-11-18)

Review round 4 passed with three non-blocking findings (R4-1 to R4-3; ADR Amendment 5, items 1–3). The owner chose to fix them before the PR. Item 3 is a ledger edit made at the next staging merge, so it has no test here. Items 1 and 2 got their tests before any fix, all in the add suite.

They first read AT59's two refusals: Mark Me put in golden retriever's superset through dog, once with no fields and once with the breed given. That left two gaps: no seeded call reached `no-schema` with no section written, and AT63 couldn't tell the refused call's own set from golden retriever's superset. The owner asked for both to be closed, so the seed gained two sets, and the tests gained the cases they reach.

| Item | Tests | What they pin |
|---|---|---|
| 1, the way on gives each concept's key (R4-1) | **AT62** | The way on's add is the sentence naming add-to-concept. It must still name golden retriever by its name and address, as round 3 built it, and now by its tapestryKey too. The review's probe 7 shows the address alone is refused as add-to-concept's `concept` (400 `invalid-input`). AT62 reads AT59's two refusals and the same call into show goldens. |
| 2, the words' three details (R4-2) | **AT63** | The add gives the refused call's own `set`. For AT59's two refusals, that is "set" and then golden retriever's superset's key. For the call into show goldens it is show goldens' key, and that add must not give golden retriever's superset as its set. |
| | **AT64** | The update-node sentence gives "concept" and then dog's tapestryKey, the concept named, in all three refusals. Probe 7c shows update-node with no concept is refused `concept-needed`, since by then Mark Me is in three concepts. |
| | **AT65** | A `no-schema` refusal from a call that writes no section keeps the rule's plain message. Scrolled, already in scroll with its section, is put in the scroll shelf through scroll. The call writes no section but adds beagle to its `wordTypes`, so rule 4 judges scroll, which has no schema node: 409 `no-schema`. Its message is word for word the one Command Beagle, a new member of scroll, gets, with none of the way-on words. Nothing changes. |
| | **AT66** | The other side: a concept with no schema that a membership joins is reported, never refused for (Amendment 3, item 1). Rover, already in beagle, is put in the scroll shelf through beagle. Beagle judges its JSON, now with scroll in `wordTypes`, and it fits. So the call is `added`, with scroll reported `fits: null`, saying it has no schema. |

**The seed's two new sets** (`test/helpers/membershipGraph.js`) are eventless sets, as add-subset makes them. Each holds nothing, and both are added last, so no other node's place in the seed moves.
- **scrollShelf**, "scroll shelf", is under scroll's superset and beagle's.
- **showGoldens**, "show goldens", is below golden retriever's superset.

ROUND2 gains four calls:
- SETUP gains Rover into the shelf through beagle (AT66).
- GR gains Mark Me into show goldens through dog, refused (AT62–AT64).
- A fourth run, SCROLL, holds Scrolled into the shelf through scroll and Command Beagle given to scroll (AT65). Both are refused, so it must leave the graph as BAD left it.

**Which call reaches `no-schema`.** Rule 4 judges only the concept a call names (Amendment 3, item 1). So the call must name scroll: a node already in scroll, put through scroll into a set that another concept also reaches, so that its `wordTypes` gains that concept's key. The reverse, a node already in beagle put through beagle into the shelf, gains scroll in its `wordTypes`. Beagle judges that call, and scroll is only reported, so it is `added`: that is AT66.

**No other test's outcome changed.** Each of the seven suites ran alone before the new sets and after them. The only changes are the two new tests, AT65 and AT66. AT63 was widened in the same change. So the add suite as it stood before the change was also run over the new seed, and each of its 55 tests answered as it had before.

**How AT63 and AT64 read a key.** The input's name, then the key, with up to four other characters between, such as a space or a backtick. So "set 1e71…" and "concept \`7be9…\`" both match.

**Tests that pass today.** AT63, AT64, AT65 and AT66 pin what the code already does.

**The scratch edits.** These ran as round 3's did: on a copy of HEAD (`bf5dd615`) with this round's seed and add suite laid over it, each file restored after its edit, against a baseline of the same suites on the copy.
- **R1a** simulates item 1's fix: each concept in the way on is labelled with its tapestryKey too. AT62 passes, and no other test in the four suites that load add-to-concept answers differently.
- **R1b** is item 1's fix in the review's own form, "with graph add-to-concept, concept <key> and set <set>". AT62 passes, and AT63 still does.
- **G7** takes the set out of the add (the review's Q7), and AT63 fails.
- **G7b** names dog's superset as the add's set, not the refused call's. AT63 fails.
- **G7c** names the superset of the concept the set joins, not the refused call's set. AT63 fails, on the call into show goldens: the case golden retriever's own superset couldn't tell apart.
- **G8** takes the concept out of update-node (the review's Q8), and AT64 fails.
- **G8b** tells update-node golden retriever's key, not dog's. AT64 fails.
- **Q5** gives `no-schema` the way-on words too (the review's Q5, which no test caught before the scroll shelf), and AT65 fails.
- **U** undoes R2-1's fix, so rule 4 runs only when a section is written. AT65 fails, since the shelf call is then `added`: it reaches `no-schema` only through its change to `wordTypes`. AT54, AT59, AT63 and AT64 fail with it.
- **J** is a wrong fix: rule 4 judges every concept a call reaches, the ones its set joins included. AT66 fails. So do AT4, AT49–AT52, AT56 and AT57, which each have a joined concept reported, not refused for.

Their output, each suite's passed/failed after the edit:

```
baseline (the copy, unchanged): add-to-concept 56/1 (AT62); remove-from-concept 36/0; memberships-shared 23/0; memberships-agent-through-cli 1/0
{"id":"R1a","what":"item 1's fix, simulated: each concept to add the node to is labelled with its tapestryKey too","changed":["AT62 FAIL -> PASS"],"suites":{"add-to-concept":"57/0","remove-from-concept":"36/0","memberships-shared":"23/0","memberships-agent-through-cli":"1/0"}}
{"id":"R1b","what":"item 1's fix in the review's form: \"with graph add-to-concept, concept <key> and set <set>\"","changed":["AT62 FAIL -> PASS"],"suites":{"add-to-concept":"57/0"}}
{"id":"G7","what":"item 2's set taken out: the way on's add with no set (the review's Q7)","changed":["AT63 PASS -> FAIL"],"suites":{"add-to-concept":"55/2"}}
{"id":"G7b","what":"item 2's set wrong: the add names the named concept's superset, not the refused call's set","changed":["AT63 PASS -> FAIL"],"suites":{"add-to-concept":"55/2"}}
{"id":"G8","what":"item 2's concept taken out: update-node with no concept (the review's Q8)","changed":["AT64 PASS -> FAIL"],"suites":{"add-to-concept":"55/2"}}
{"id":"G8b","what":"item 2's concept wrong: update-node told the concept the set joins, not the one named","changed":["AT64 PASS -> FAIL"],"suites":{"add-to-concept":"55/2"}}
{"id":"Q5","what":"item 2's no-schema detail taken out: no-schema gets the words too (the review's Q5)","changed":["AT65 PASS -> FAIL"],"suites":{"add-to-concept":"55/2"}}
{"id":"G7c","what":"item 2's set wrong: the add names the superset of the concept the set joins, not the refused call's set","changed":["AT63 PASS -> FAIL"],"suites":{"add-to-concept":"55/2"}}
{"id":"U","what":"R2-1's fix undone: rule 4 only when a section is written, so a call that writes none is never judged","changed":["AT54 PASS -> FAIL","AT59 PASS -> FAIL","AT63 PASS -> FAIL","AT64 PASS -> FAIL","AT65 PASS -> FAIL"],"suites":{"add-to-concept":"51/6"}}
{"id":"J","what":"a wrong fix: rule 4 judges every concept the call reaches, the ones the set joins included","changed":["AT4 PASS -> FAIL","AT49 PASS -> FAIL","AT50 PASS -> FAIL","AT51 PASS -> FAIL","AT52 PASS -> FAIL","AT56 PASS -> FAIL","AT57 PASS -> FAIL","AT66 PASS -> FAIL"],"suites":{"add-to-concept":"48/9"}}
```

**Today's code** (`58c8bf58`, at `bf5dd615`), each suite alone with every endpoint dead:

```
  FAIL  AT62 [AC8, Amendment 5 item 1]: the way on gives golden retriever, the concept to add Mark Me to, by its tapestryKey, beside its name and address, since add-to-concept's concept takes a tapestryKey
        r2-gr: and by its tapestryKey, 4a00…c520: the address, 39998:dddd…:golden-retriever, is refused as add-to-concept's concept (400 invalid-input, the review's probe 7), so an agent would need graph resolve first (Amendment 5, item 1; the review's R4-1); its add reads ["To go on, add the node to \"golden retriever\" (39998:dddd…:golden-retriever), which the set joins, with graph add-to-concept and set ea6a…d7d7: that judges its own section, and reports the verdict of \"dog\" (39998:dddd…:dog) without refusing."]
operations: graph add-to-concept: 56 passed, 1 failed, 0 skipped

operations: graph remove-from-concept: 36 passed, 0 failed, 0 skipped
operations: what add-to-concept and remove-from-concept share: 23 passed, 0 failed, 0 skipped
operations: an admin agent adds and removes memberships through the external CLI: 1 passed, 0 failed, 0 skipped
graph-rules-builder: 26 passed, 0 failed, 0 skipped
graph-rule-firmware: 13 passed, 0 failed, 4 skipped (GL1–GL4, live)
firmware-element-sync: 21 passed, 0 failed, 0 skipped
```

Every earlier round's test passes on this code.

## Added at review round 5 (2026-11-18)

Review round 5 passed with one optional finding, R5-1, and the owner chose to fix it before the PR. `say.memberMisfit`'s branch for a set that joins more than one concept (`_memberships.js:127–128`) had no test. No seeded call reaches it: that needs a set whose joined concepts each add a key to `wordTypes`, with the named concept misfitting. With each concept's key taken out of the branch, every suite stayed green. The review read the words in a direct call and found them right, so the test is a guard that passes today. No code changes.

| Finding | Test | What it pins |
|---|---|---|
| R5-1, the way on through several concepts | **MS24** | It calls `say.memberMisfit` directly, with dog as the named concept and two, then three, joined concepts: golden retriever, irish setter and show dog. Each joined concept is named by its own label, its name and address, then "with concept" and its own key. They come in the order given, the last after "and". One "set <set>" stands for all of them: the set's key appears once. The update-node step names dog's key as `concept`. The one-concept wording, "which the set joins", isn't used. |

**Why the shared suite.** The words are the shared module's, `_memberships.js`. The test needs no seed and no harness run, like MS1 and MS23. So it is MS24 in memberships-shared, not an AT in the add suite.

**The header objects.** `X.conceptLabel` reads a concept's `name`, then its `uuid`, else its `key`. So each object, header-shaped as `K.headersByKey` gives the joined concepts, carries three fields:
- `key`, a tapestryKey;
- `uuid`, an address `39998:<TA>:<slug>`;
- `name`.

MS24 first checks that each label holds its name and address. What it then pins is memberMisfit's own wording.

**The scratch edits.** These ran as round 4's did: on a copy of HEAD (`5826c324`) with MS24 laid over it, each file restored after its edit, against a baseline of the same suites on the copy. Each edit is to the several-concepts branch of `say.memberMisfit`, and each ran all four suites that load the seed.
- **a** takes each concept's key out, the review's break: MS24 fails.
- **b** takes the set out: MS24 fails.
- **c** drops the first concept, by an off-by-one in the list's slice: MS24 fails.
- **d** names each concept with the next one's key: MS24 fails.
- **e** gives the concepts in the reverse of the order given: MS24 fails.
- **f** takes the named concept's key out of update-node, in this branch only: MS24 fails.
- **g** uses the one-concept wording for two and three concepts: MS24 fails.

No other test in the four suites answered differently under any of them.

Their output, each suite's passed/failed after the edit:

```
baseline (the copy, unchanged): add-to-concept 57/0; remove-from-concept 36/0; memberships-shared 24/0; memberships-agent-through-cli 1/0
{"id":"a","what":"each concept's key taken out of the several-concepts branch (the review's break)","changed":["MS24 PASS -> FAIL"],"suites":{"add-to-concept":"57/0","remove-from-concept":"36/0","memberships-shared":"23/1","memberships-agent-through-cli":"1/0"}}
{"id":"b","what":"the set taken out of the several-concepts branch","changed":["MS24 PASS -> FAIL"],"suites":{"add-to-concept":"57/0","remove-from-concept":"36/0","memberships-shared":"23/1","memberships-agent-through-cli":"1/0"}}
{"id":"c","what":"one concept dropped from the list: the first, by an off-by-one in its slice","changed":["MS24 PASS -> FAIL"],"suites":{"add-to-concept":"57/0","remove-from-concept":"36/0","memberships-shared":"23/1","memberships-agent-through-cli":"1/0"}}
{"id":"d","what":"each concept named with the next one's key","changed":["MS24 PASS -> FAIL"],"suites":{"add-to-concept":"57/0","remove-from-concept":"36/0","memberships-shared":"23/1","memberships-agent-through-cli":"1/0"}}
{"id":"e","what":"the concepts in the reverse of the order given","changed":["MS24 PASS -> FAIL"],"suites":{"add-to-concept":"57/0","remove-from-concept":"36/0","memberships-shared":"23/1","memberships-agent-through-cli":"1/0"}}
{"id":"f","what":"update-node without the named concept's key, in the several-concepts branch only","changed":["MS24 PASS -> FAIL"],"suites":{"add-to-concept":"57/0","remove-from-concept":"36/0","memberships-shared":"23/1","memberships-agent-through-cli":"1/0"}}
{"id":"g","what":"the one-concept wording used for two and three concepts","changed":["MS24 PASS -> FAIL"],"suites":{"add-to-concept":"57/0","remove-from-concept":"36/0","memberships-shared":"23/1","memberships-agent-through-cli":"1/0"}}
```

**Today's code** (HEAD `5826c324`), each suite alone with every endpoint dead:

```
operations: what add-to-concept and remove-from-concept share: 24 passed, 0 failed, 0 skipped
operations: graph add-to-concept: 57 passed, 0 failed, 0 skipped
operations: graph remove-from-concept: 36 passed, 0 failed, 0 skipped
operations: an admin agent adds and removes memberships through the external CLI: 1 passed, 0 failed, 0 skipped
```
