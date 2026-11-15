# Test Plan: Story 5 — Field mapping

**Story:** `engineering-team/stories/graph-operations-foundation/5-field-mapping.md`
**ADR:** `engineering-team/decisions/graph-operations-foundation/0005-field-mapping.md` (with its Amendment 1, the firmware descriptions are plain text, and Amendment 2, which settles the readings this plan first took)
**Date:** 2026-11-15

## Coverage map

Every operations suite is stack-free and lives under `test/operations/`, where `test/operations.test.js` finds and runs it (ADR 0001 Decision 12), so it needs no line in `test/registry.js`. The firmware suite is top-level, like its model, and has its registry line. Each runs on its own too: `node <file>`.

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1 — The concept, in firmware | NP1 the five files, and only the two sets · NP2 the header's slug and names, no `x-tapestry` · NP3 the header's description, as plain text · NP4 the permissive schema · NP5 the empty manifest · NP6 the two sets: address, slug, name, description (starting after the bold name, 2.1), shaped like `class-threads.json` · NP7 the global manifest's entry, next to relationship-type, under neither `sets.properties` nor `sets.words` · NP8 the slugs are unique in firmware · NP9 nothing else went missing · *what an install makes of them: the live check, step 1* | `neo4j-property-firmware.test.js` | unit (files) |
| AC2 — Mark a field | MF1 one mark from the first set to the tree's node; the copies on each current element whose JSON gives a value (a subset's, one reached two ways, one in the LMDB); none on the rest; `carried`, `skipped`; the entry and its keys · MF2 again: already-marked, nothing recorded · MF3 a repeat writes nothing else, even over a stale copy · MF4 a wrapped concept, and one the import brought in (ListHeader only) · MF5 the values table · MF13 history finds the entry by the header, the property node and an element · MF16 a field no element gives a value for: `field-marked` alone (2.5) · FD2–FD8 the mapping module · CE1–CE3 the entry's new fields | `graph/mark-field.test.js`, `graph/fields.test.js`, `change-entry-fields.test.js` | integration (route and command over the fake graph); unit |
| AC3 — Refused before anything changes | MF6 each of AC3's refusals, from the rule, in words, nothing changed · MF7 not-installed · MF8 too-many-elements · MF9 inputs · FR1–FR13 the rule's one definition: each violation, the table's order, the repeat, and as a check over many marks · FR14 the rules document | `graph/mark-field.test.js`, `rules/field-mark-allowed.test.js` | integration; unit (the rule) |
| AC4 — Unmark a field | UF1 the edge gone, no current element carries it, the property node stays a property (D9), `cleared`, the entry · UF2 again: already-unmarked · UF3 another concept's copy on a shared node stays · UF4 a field that left the schema but has its node · UF5 never marked · UF6 names that name nothing · UF10 history · UF12 above 10,000 elements, refused `too-many-elements` (2.4) · UF13 a marked field no element carries: `field-unmarked` alone (2.5) | `graph/unmark-field.test.js` | integration |
| AC5 — Catch up | MP1 missing added, stale corrected, gone removed, a copy no mark yields removed; one entry naming the changed nodes; `set` 4, `removed` 2, `unchanged` 4, counts of elements (2.3) · MP2 a copy another same-key concept's mark yields stays · MP3 nothing to do records nothing · MP4 a wrapped concept, and a node that joined late · MP5 flat JSON loses its stale copy and is skipped · MP5b JSON that can't be read (an LMDB entry missing, no json tag) keeps its copy and is skipped, in a call that changed others (2.2) · MP6 not-installed · MP7 too-many-elements · MP8 bad concepts | `graph/map-fields.test.js` | integration |
| AC6 — A read filters on it | MF14, MP11, UF11: a Cypher read of Dog's elements by `dog_breed`, over the fake graph, finds the right dogs after marking, follows a change after map-fields, and finds none after unmarking · *through `/api/neo4j/query` on Neo4j: the live check, steps 3, 4 and 8* | the three operations' suites | integration (fake); live |
| AC7 — Marks survive what the instance does to itself | *the live check, step 6: a reinstall, a re-run of generate-property-tree, a backup restored* | — | live |
| AC8 — Callers, the command, an agent, the docs | MF10, UF7, MP9: 401 and 403, 415, nothing signed (the spy), an admin's write is the admin's · MF11, UF8, MP9: the command, and its refusal matching the route's · MF12, UF9, MP10: listed with guard, repeatKey and refusals, and in `/docs` · X2 an admin agent marks, maps and unmarks through the external CLI · MF15 the catalog and the design · *the relay's event count, and the agent and the command on a real instance: the live check, steps 4, 5 and 7* | the three operations' suites, `graph/fields-agent-through-cli.test.js` | integration (the real external CLI against a loopback instance); live |
| — the fake itself | F1–F7 as before · F8–F14: S1–S5 and S8 answered as Neo4j would, and what it still can't run says so | `graph-fake.test.js` | unit |

## Edge cases

- [x] **A repeated call:** MF2, UF2, MP3. It changes nothing, records nothing, and says so.
- [x] **A repeat over a stale copy:** MF3. mark-field writes nothing else; map-fields is the catch-up.
- [x] **Two nodes for one field:** create-property's node off the schema node, beside the tree's (MF1, FD6), and one alone (MF6, FR6). Only the tree's counts.
- [x] **A child a level down with a field's name:** owner's `name` (F9, FD6).
- [x] **Wrapped and unwrapped schemas:** widget and dog (MF1, MF4, FD5, FD6, F9).
- [x] **A concept the import brought in, labelled ListHeader only:** cat (MF4, FR2, FD5, F8).
- [x] **No primary property:** rock (MF6, FR6, FD6).
- [x] **A subset's element, and one reached two ways:** spot and bella (MF1, F11).
- [x] **An implicit member, not wired:** stray gets nothing (MF1, MP2).
- [x] **JSON in the LMDB, and an LMDB entry missing:** luna and ghost (MF1, MP1, FD4).
- [x] **JSON that can't be read keeps its copies:** ghost (an LMDB entry missing) and mute (no json tag) (MP5b, Amendment 2.2). Unmarking still clears such an element's copy, as AC4 asks: UF1's luna has no LMDB entry in its run.
- [x] **Flat JSON, as the UI's write verbs save it:** flat, skipped, and its stale copy removed (MF1, MP1, MP5, FD4).
- [x] **Every row of the values table,** with `false`, a whole number under `number`, a fraction and an unsafe number under `integer`, a string under `integer`, and integers among fractions under integer items, all sent as floats (MF5, FD4, Amendment 2.6).
- [x] **A marked field no element carries, or gives a value for:** `field-unmarked` or `field-marked` alone (UF13, MF16, Amendment 2.5).
- [x] **One node in two concepts:** max, a dog and a pet (UF3, MP4, FD8); od1, in two same-key concepts (MP2).
- [x] **Same-key concepts:** otherDog and otherWeird, another author's (MF6, FR9, FR11, FR13, MP2).
- [x] **A field that left the schema:** its mark (UF4, FR5) and its copies (MP1's `dog_retired`).
- [x] **A node of no concept with a copy's name:** loner is never touched (MF1, UF1, MP2).
- [x] **Exactly at the cap, and one over:** 10,000 marks, 10,001 is refused (MF8, MP7), and unmarking over 10,001 is refused too (UF12, Amendment 2.4).
- [x] **A change entry named as a node:** left alone by S8 (F13).
- [x] **Two calls of the same mark at once:** the live check, step 9. The fake runs transactions one at a time.
- [ ] **The graph database not answering:** the path's generic failure, 500 `failed`, shown by story 4's W8.

## Test infrastructure

- **Runner.** Node's built-in runner through `test/operations.test.js`, which the gate runs (`test/registry.js`). No new framework.
- **No live API in the gate.** The local instance at `:7778` is the owner's agent-memory instance and must not be written to; on the Mac Studio, run these suites one at a time, never the full `npm test`. The gate runs in CI on the pull request. The live check runs on a scratch stack at Implementation (below).
- **New helpers:**
  - `test/helpers/fieldGraph.js`: the graph the suites seed, shaped as today's routes make it. Its header says what it holds: the concept of neo4j properties with its two sets, the property concept, dog (unwrapped, with a subset, a create-property node, a field that left its schema, and owner's child `name`), widget (wrapped), cat (ListHeader only), pet, rock (no primary property), weird (key `weird-thing`), another author's dog and weird-thing, and an element for each case above. Options add marks, copies, JSON, an unhooked node, a changed dog schema, a dog with no json tag, and a big concept, with or without copies. `seedLmdb(dir, entries)` stores LMDB entries where a harness run in `dir` reads them.
  - `test/helpers/pathCypherFake.js`: the reads over paths (below).
- **Changed helpers:**
  - `test/helpers/graphFake.js`: S1–S4 go to `pathCypherFake.js`, S8 is new, and a stored integer reads back as a number. Story 4's statements run as before. Two latent faults are fixed: a label, a parameter or a property that spells a clause's word (`:Set`, `$set`) no longer reads as a write, and a bracket-less `-->` counts as a relationship.
  - `test/helpers/nodeCypherFake.js`: where a name is expected, a keyword is read as the name it spells, so `WHERE s:Set` (S5) parses.
- **The fake graph's repertoire.** It runs ADR 0004's statements and these, and throws "the fake graph can't run this Cypher" on anything else, naming it (F7, F14). The Implementer's Cypher stays within them:
  1. **S1–S4, reads over paths.** Every read that names a relationship, other than story 4's declared types' read, is evaluated as Neo4j would, over seven types only: `HAS_TAG`, `IS_THE_JSON_SCHEMA_FOR`, `IS_THE_PRIMARY_PROPERTY_FOR`, `IS_A_PROPERTY_OF`, `HAS_ELEMENT`, `IS_THE_CONCEPT_FOR` and `IS_A_SUPERSET_OF`. The subset:
     - clauses: `MATCH`, `OPTIONAL MATCH` (each with a `WHERE`), `WITH [DISTINCT] … [WHERE]`, `RETURN [DISTINCT]`, with `ORDER BY`, `SKIP` and `LIMIT`;
     - patterns: comma-separated paths of nodes with labels and a property map, joined by `-[r:T]->` or `<-[r:T]-`, fixed or variable length (`*0..`, `*0..1`);
     - expressions: comparisons, `IS [NOT] NULL`, `IN`, `STARTS WITH`, `NOT`/`AND`/`OR`, `CASE`, label tests, `v.p` and `v[k]`, list comprehensions, and the functions `keys`, `head`, `size`, `coalesce`, `toString`, `labels`, `type`, `count` and `collect`.

     There is no `UNION`, `CALL`, `UNWIND`, arithmetic or `properties()`. As in Neo4j, a `LIMIT` sent as a JavaScript number is refused as a float (F11), so the checked number goes into the text, as history's does. F8–F11 run representative S1–S4 statements, among them both of S3's climbs (two `OPTIONAL MATCH`es with `coalesce`, or `*0..1`).
  2. **S5** is a read of one node: `MATCH (s:TapestryNode {uuid: $uuid}) WHERE s:Set RETURN s.tapestryKey AS key` (F12).
  3. **S6 and S7** are story 4's `MERGE` and `DELETE`. Their two nodes are found by tapestryKey, which is why S5 reads the set's key.
  4. **S8** is `UNWIND $rows AS row MATCH (n:TapestryNode {tapestryKey: row.key}) WHERE NOT n:GraphChange SET n += row.props`. The key can also be given as `n.tapestryKey = row.key`, and `RETURN count(n)` may follow.
     - A null in `props` removes that property.
     - A `neo4j.int` is kept as `{ $int: '<digits>' }`, which is how the suites tell an integer from a float. A JavaScript number is kept as a float.
     - As Neo4j does, S8 refuses a map, a list holding a null, a list of lists or maps, and a list of mixed types, an integer among floats included (F13). The transaction then keeps nothing.
- **What the tests pin where the ADR left a choice:**
  - The answers' fields, as Decision 7–9 name them:
    - mark-field: `mark: { concept, field, property, node }`, `outcome`, `carried`, `skipped: [{ node, reason }]`, `change`;
    - unmark-field: `mark`, `outcome`, `cleared`, `change`;
    - map-fields: `concept`, `marks`, `set`, `removed`, `unchanged`, `skipped`, `change`. The three counts are of elements, as Amendment 2.3 defines them.
  - A skipped element's `reason` is a non-empty string. Flat JSON's and a missing LMDB entry's must differ ("saying which").
  - A change's `nodes` are compared as a set, and its `count` equals their number. mark-field's two changes and unmark-field's two are found by name, not by order. `copies-set` and `copies-removed` appear only when they name a node (Amendment 2.5).
  - The refusals: the rule's eight codes and statuses, and `too-many-elements` 409 for all three operations (Amendment 2.4). A guard's refusal carries `rule: 'field-mark-allowed'`.
  - What each message names is the ADR's column, read loosely:
    - the key;
    - the top-level fields (breed and slug among them);
    - `generate-property-tree` and that it signs;
    - "object", or "array" or "list";
    - `weird-thing`;
    - the other concept's tapestryKey or uuid;
    - the node's tapestryKey or uuid;
    - "firmware" and "install";
    - for `too-many-elements`, 10,000 or 10,001.
  - `_fields.js` exports the names Decision 6 gives, and `MAX_ELEMENTS` is 10000.
    - `conceptOf` answers null for a non-header. `fields` may be a list of names or a map of definitions.
    - `valueOf` may give an integer as a `neo4j.int` or a number. Either way the node must end up with an integer (MF5).
    - `marksOf`'s filter is `{ concept: <the header's tapestryKey> }`.
    - `mapNodes` returns what it changed, in a shape of its own: FD8 checks only that it names each changed node and each property set (Amendment 2.7).
  - unmark-field's list entry shows `guards: []`. The tests leave map-fields' guards open.
  - The firmware: the global manifest's entry is exactly Decision 1's object, at an index next to relationship-type's.
- **Firmware state:** none needed for the gate. The seeded graph holds the concept of neo4j properties as an install makes it.
- **The branch:** `A10.5-field-mapping`, Loom's branch for the task, off `staging`. Never `staging` or `main`.

## The live check (at Implementation, on a scratch stack)

Never on a shared or private instance. Run it on a throwaway instance from `scripts/scratch-stack.sh`, and record every step and number under Verification. These are the ADR's Implementation notes, with AC7 and AC8 added:

1. **Install.** Restart the control panel (the manifest is read once per process), then `POST /api/firmware/install` on loopback inside the container. The graph has `39998:<TA>:neo4j-property`, its superset and its two sets, each with its description and no elements (AC1).
2. **Dogs.** Make Dog's property tree (`POST /api/normalize/generate-property-tree`) and a second dog beside rover, through today's routes. They sign, which is fine on a throwaway instance. Dog's schema lists its breeds, so use `goldenRetriever` and `irishSetter` for AC6's Beagle and Labrador.
3. **Count and mark.**
   - Count the relay's events: this is the baseline.
   - Mark `breed` with `graph mark-field`.
   - Read through `/api/neo4j/query`, asking for Dog's elements (its class thread) where `dog_breed = 'goldenRetriever'`. It finds rover and not the second dog (AC6). Note the property's type on Neo4j.
4. **A change.** Change the second dog's breed through today's routes, run `graph map-fields`, and read again: the read follows the change (AC5, AC6).
5. **The relay.** Its event count is the baseline's after every operation above (AC8).
6. **Survival.** Record the marks and every copy, then:
   - reinstall;
   - re-run generate-property-tree for Dog;
   - `lifecycle backup`, a change, then `lifecycle restore`.

   After each, the mark (the first set's `HAS_ELEMENT` to breed's node) and every copy are as recorded, and after the restore as they were at the backup (AC7, BIBLE §30).
7. **The command and the agent.**
   - `tapestry graph mark-field --concept <key> --field <name>`, and the other two, from a shell in the instance, get the routes' answers.
   - An admin agent with a throwaway key drives all three through the external CLI, pointed at the instance's nginx, so the instance doesn't trust it as local (AC8).
8. **Unmark** `breed`, and read again: neither dog (AC6).
9. **If time allows:** two marks of the same field at once make one edge and one entry.

## How to run

One suite at a time:

```
node test/neo4j-property-firmware.test.js
node test/operations/change-entry-fields.test.js
node test/operations/rules/field-mark-allowed.test.js
node test/operations/graph/fields.test.js
node test/operations/graph/mark-field.test.js
node test/operations/graph/unmark-field.test.js
node test/operations/graph/map-fields.test.js
node test/operations/graph/fields-agent-through-cli.test.js
node test/operations/graph-fake.test.js
```

All of the operations ones, with the suites they join: `node test/operations.test.js`. The full gate is `npm test`, which runs in CI on the pull request: on the Mac Studio it writes to the local instance.

## Readings: settled by Amendment 2

The readings this plan first took went to the gate, and ADR 0005's Amendment 2 settles them. The tests now pin its answers:

- the sets' descriptions start after their bold names (2.1, NP6);
- JSON that can't be read keeps its copies, while JSON with no section loses them (2.2, MP5 and MP5b);
- map-fields' three counts are of elements (2.3, MP1, MP4, MP5b and MP9);
- unmark-field is capped (2.4, UF12);
- `copies-set` and `copies-removed` appear only when they name a node (2.5, UF13 and MF16);
- integers among fractions go as floats (2.6, FD4 and MF5);
- mapNodes returns what it changed (2.7, FD8).

Its known limit (2.8, a float copy of an integer field stays a float) has no test.

A few small readings remain, each named by its test:

- `valueOf(null, …)` is `{ bad }` (FD4).
- `marksOf`'s filter takes the header's tapestryKey (FD7).
- Unmarking clears the copy of an element whose JSON can't be read (UF1's luna). That follows AC4; 2.2 is about the mapping.
- Not tested: inline JSON that doesn't parse, a type list of two plain types, and a field with no `type`.

## Verification

The new tests fail with the current code, each for the reason it names. Confirmed on 2026-11-15 on `e53e5474` (`A10.5-field-mapping`, with the story and the ADR, and the ADR's Amendments 1 and 2 uncommitted), plus these tests, each suite run on its own after Amendment 2 was applied:

```
neo4j-property-firmware: 0 passed, 9 failed, 0 skipped
  FAIL  NP1: the concept's five files are there, its two sets the only ones
        firmware/versions/v1.0.0/concepts/neo4j-property/concept-header.json does not exist yet (ADR graph-operations-foundation/0005 Decision 1)
  FAIL  NP6: its two sets, each with its address, slug, name and description, shaped like relationship-type's class-threads set
        firmware/versions/v1.0.0/concepts/neo4j-property/sets/neo4j-properties-that-are-also-fields.json does not exist yet (ADR graph-operations-foundation/0005 Decision 2)
operations: the change entry's new fields: 1 passed, 2 failed, 0 skipped
  FAIL  CE1: … CHANGE has no `concept` string field yet (ADR graph-operations-foundation/0005 Decision 12); its fields: ["change","type","from","to","node","count"]
  PASS  CE3: keysOf still answers what it did for ADR 0004's changes
operations: rule field-mark-allowed: 0 passed, 14 failed, 0 skipped
  FAIL  FR1–FR13: src/operations/rules/field-mark-allowed.js does not exist yet (ADR graph-operations-foundation/0005 Decision 5)
  FAIL  FR14: docs/GRAPH_RULES.md has no entry 3 for field-mark-allowed yet (ADR graph-operations-foundation/0005 Decision 15)
operations: the mapping module (_fields.js): 0 passed, 8 failed, 0 skipped
  FAIL  FD1–FD8: src/operations/catalog/graph/_fields.js does not exist yet (ADR graph-operations-foundation/0005 Decision 6)
operations: graph mark-field: 0 passed, 16 failed, 0 skipped
  FAIL  MF1–MF16: src/operations/catalog/graph/mark-field.js does not exist yet (ADR graph-operations-foundation/0005 Decision 7)
operations: graph unmark-field: 0 passed, 13 failed, 0 skipped
  FAIL  UF1–UF13: src/operations/catalog/graph/unmark-field.js does not exist yet (ADR graph-operations-foundation/0005 Decision 9)
operations: graph map-fields: 0 passed, 12 failed, 0 skipped
  FAIL  MP1–MP11, MP5b: src/operations/catalog/graph/map-fields.js does not exist yet (ADR graph-operations-foundation/0005 Decision 8)
operations: an admin agent maps fields through the external CLI: 0 passed, 1 failed, 0 skipped
  FAIL  X2: src/operations/catalog/graph/mark-field.js does not exist yet (ADR graph-operations-foundation/0005 Decisions 7–9)
operations: the fake graph: 15 passed, 0 failed, 0 skipped
```

Why each fails:

- **On a file or module that doesn't exist yet,** named with its decision: the firmware files (NP1–NP9), the rule (FR1–FR13), the rules document's entry (FR14), `_fields.js` (FD1–FD8), and each operation's declaration (MF, UF, MP, X2). Against the harness, each operation's route answers 404 "Cannot POST /api/tapestry/graph/mark-field", and the suites say which declaration is missing.
- **Against today's `changes.js`,** which runs and lacks the fields: CE1 and CE2. CE3 holds what ADR 0004 already does, and passes.
- **The fake graph's own suite passes,** F8–F14 included, so the suites above will pass or fail for the graph's reasons, not the fake's.

The shared helpers' other users still pass, each run on its own after `graphFake.js` and `nodeCypherFake.js` changed. Amendment 2 changed only `fieldGraph.js`, which none of them uses.

| Suite | Passed | Failed |
|---|---|---|
| write path | 13 | 0 |
| add-relationship | 12 | 0 |
| remove-relationship | 7 | 0 |
| history | 8 | 0 |
| rule relationship-type-allowed | 10 | 0 |
| story 4's agent through the CLI | 1 | 0 |
| cache counts | 7 | 0 |
| lifecycle status | 9 | 0 |
| change indexes | 3 | 0 |
| external CLI | 53 | 0 |

The fake at the cap: S4 over 10,001 elements takes about 110 ms, and S8 over 10,000 rows about the same.

### The tests can pass, and catch what Amendment 2 forbids: checked against a throwaway reference

A failing test proves little if no correct code could pass it. So the suites were also run against a quick reference, written from the ADR and its amendments alone, in a scratch copy of the tree. The reference never entered the repo, was deleted afterwards, and is not the implementation.

Against it, every new suite passed, each run on its own:

| Suite | Passed |
|---|---|
| NP | 9 of 9 |
| CE | 3 of 3 |
| FR | 14 of 14 |
| FD | 8 of 8 |
| MF (the two 10,000-element runs included) | 16 of 16 |
| UF | 13 of 13 |
| MP | 12 of 12 |
| X2 | 1 of 1 |
| the fake | 15 of 15 |

With the three declarations loaded, the existing gate tests the ADR names passed too: W1 (every graph write applies, in write-path's 13) and R9 (Cypher names only reserved types, in the relationship-type rule's 10).

Then each part of Amendment 2 was broken in the reference, one at a time, and the tests written for it failed:

| Broken | Failed |
|---|---|
| 2.1, a set's description keeping its bold name | NP6 |
| 2.2, JSON that can't be read losing its copy | MP5b, and MP5's "flat only" removal |
| 2.3, `set` and `removed` answered as maps | MP1, MP4, MP5b, MP9 |
| 2.4, unmark-field uncapped | UF12 |
| 2.5, an empty `copies-removed` or `copies-set` recorded | UF13; MF16 |
| 2.6, integers converted item by item | FD4; MF5, where the fake refused the mixed list, as Neo4j would, and the mark answered 500 |
| 2.7, mapNodes returning nothing | FD8 |

The first reference run, before Amendment 2, found four faults in the tests, all fixed:

- MF6 matched `dog_nickname` inside `dog_nicknames`.
- The rule suite's child wrote its answer to a pipe and then exited, which cut it at 64 KB.
- UF1 read a copy that a later call in the same run removes.
- map-fields' helper called a default that wasn't a function.

### The live check (Implementation, 2026-11-15, on `2aa3f2bc`)

Run on the Mac Studio, on one throwaway instance from `scripts/scratch-stack.sh`. It booted from image `agent-memory-tapestry`, as story 4's did, with this branch's `src/` mounted.
- **What was copied in.** The image's firmware has no concept of neo4j properties, so this branch's `firmware/versions/v1.0.0/` and `bin/` were copied in, and the `tapestry` command was linked as the Dockerfile links it. Then the control panel was restarted and the firmware reinstalled.
- **The instance.** It had its own assistant key and no published ports, and ran Neo4j 5.26.10. It was removed afterwards.
- **The calls.** Every call went through `docker exec` to `127.0.0.1:7778`, a direct-local caller recorded as `local`. The agent's went through the instance's own nginx.

1. **The concept (AC1).**
   - The reinstall took 65 s. Afterwards the graph held `39998:<TA>:neo4j-property`, labelled ConceptHeader and ListHeader, with its superset and its JSON Schema node.
   - Its two sets, `39999:<TA>:the-set-of-neo4j-properties-that-are-also-fields` and `39999:<TA>:the-set-of-neo4j-only-properties`, had no elements.
   - The header's `description` tag and each set's are the firmware's words.
   - The superset has no parent, so it is no subset of the property concept's.
   - The install signed 12 events (448 to 460), as it does for every firmware concept.
2. **Dogs.** Both routes below sign. Afterwards the relay held 467 events, the baseline for the graph operations.
   - generate-property-tree made Dog's tree: word, wordTypes, dog, and Dog's fields slug, breed and name under the `dog` node.
   - create-element made Lady, an irish setter, beside rover.
3. **Mark and read (AC2, AC6).**
   - mark-field on Dog's `breed` answered `marked`: carried 2, nothing skipped, with `field-marked` and `copies-set` for the two dogs.
   - A read through `/api/neo4j/query` of Dog's class thread where `dog_breed = 'goldenRetriever'` found Rover and not Lady. `irishSetter` found Lady.
   - Neo4j holds the copy as a `STRING`.
4. **A change (AC5, AC6).**
   - save-element-json made Lady a golden retriever. Her copy stayed `irishSetter` until map-fields ran, since today's route applies no mapping.
   - map-fields answered set 1 and unchanged 1, with one `copies-set` for Lady.
   - The read then found both dogs as golden retrievers and none as irish setters.
5. **Integers.** These were checked on nostr-kind, a wrapped concept with 41 elements, all in its four sets, once its tree was made.
   - mark-field on `kind` carried 41, and Neo4j holds all 41 copies as `INTEGER`.
   - A read `WHERE nostrKind_kind = 1` found kind 1.
   - map-fields straight after answered unchanged 41, with no entry, so an integer read back compares equal.
   - Unmarking cleared 41.
6. **Survival (AC7).** The marks (breed's node, under the `dog` node) and every copy on any node were recorded, then:
   - a firmware reinstall (62 s) left them the same;
   - a re-run of generate-property-tree for Dog left them the same, since it landed on the same nodes;
   - `tapestry lifecycle backup` took the graph offline for 18.0 s. A mark of `name` followed, through the command, so both dogs carried `dog_name`. Then `tapestry lifecycle restore` of that backup took the graph offline for 24.3 s. Its transaction and its tapestryKey digest matched the backup's, and the marks and copies were as at the backup, with the `name` mark and its copies gone.
7. **The command and the agent (AC8).**
   - **The command.** `tapestry graph mark-field --concept <dog> --field name`, `map-fields --concept <dog>` and `unmark-field` answered as the routes do, each recorded as `local`. unmark-field again answered `already-unmarked`. `mark-field --field wordTypes` was refused `unknown-field`, naming slug, breed and name.
   - **The agent.** An admin agent drove the external CLI, `clients/cli` copied in, through the instance's nginx (`http://127.0.0.1:80`). Its throwaway key was made inside the instance and removed with it.
     - It marked Dog's `slug` (carried 2), mapped Dog (nothing to change, so no entry) and unmarked `slug` (cleared 2). Each write was recorded as `admin`, with the agent's pubkey.
     - After Lady's breed was changed back through today's route, the agent's map-fields corrected her copy, recorded as the agent's.
     - `graph history --node <rover>` read the agent's entries back, newest first.
   - **Callers.** A visitor through nginx got 401, and a text/plain body 415 `wrong-content-type`.
8. **Unmark (AC4, AC6).**
   - unmark-field on `breed` cleared 2, with `field-unmarked` and `copies-removed`.
   - The reads found neither dog, and the graph held no mark and no copy.
   - Breed's node was still an element of the property concept (D9).
9. **Two marks at once.** Two mark-field calls on `breed` at once answered one `marked`, with its entry, and one `already-marked`, with none. They left one edge: MERGE held its lock.
10. **The relay (AC8).** The relay's events were listed by the time they were made, after each step. None came from a graph operation. Each one came from one of today's signing routes, before the operation that followed it: the trees, Lady, and her two JSON changes.

**Not checked live:** the graph database not answering. W8 shows the path's 500 `failed` over the fake.

### The touched suites (Implementation, 2026-11-15, on `2aa3f2bc`)

Each suite was run on its own on the Mac Studio, with every service endpoint dead in the environment, since the local stack publishes Neo4j and Redis on the host:

| Suite | Passed | Failed |
|---|---|---|
| operations: its own tests, and every suite under `test/operations/`, the nine new ones among them | 337 | 0 |
| neo4j-property-firmware | 9 | 0 |
| b-tag-seeds | 7 | 0 |
| b-tag-primitive | 16 | 0 |
| community-reference-nostr-relay-stub | 4 | 0 |
| external-cli | 53 | 0 |
| openapi-coverage | 13 | 0 |

**Not run here:**
- the full `npm test`, which writes to the local instance; its result comes from the pull request's CI;
- event-tagging-firmware-seed and event-less-create-set, whose live parts reach the local stack at `:7778`.
