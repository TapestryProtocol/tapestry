# Test Plan: Story 26 — `graph delete-node`

**Story:** `engineering-team/stories/graph-operations-first-slice/26-delete-node.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0026-delete-node.md` (with Amendment 1, at test design)
**Date:** 2026-11-17

Every suite is stack-free:
- It runs the real catalog in a child process (`test/helpers/operationsHarness.js`), over the fake graph (`test/helpers/graphFake.js`).
- Every service endpoint is dead.
- The harness's spy watches everything that signs or reads a key.

The stack-free suites can't reach six things:
- Neo4j's own locking, and the error it gives a write that waited for a node another write deleted;
- a firmware reinstall;
- a restore;
- nginx;
- the relay;
- staging's and production's data.

The live check covers those on a scratch stack (below).

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1: delete an element, with its relationships and tags | **DN1**: rich, the assistant's lettered element, goes with every relationship it had, in and out, and its six tags with theirs. Each node at the other end stays (lucky, gizmo, its author's person node, two placeholders, citer and its tag, the superset), and the rest of the graph is as it was. **DN2**: the answer: the node's five facts and `hasLetter`, its concept, each relationship removed once in C5's shape (a link to itself once; its tags' relationships naming the tag; no `HAS_TAG` to its own tags), `tags`, the note, the entry. **DN5**: `graph history` finds the entry by the node, its superset, lucky, its author's person node and a placeholder its tag named. **DN8**: an element of two concepts leaves both. **DN12**: nothing is signed. | `test/operations/graph/delete-node.test.js` | integration (fake) |
| AC2: safe to repeat, one at a time | **DN6**: the same call again is `already-gone`, records nothing, and gives `deletion` (the first entry's id, `at`, `by`, operation), with the note saying when. **DN7**: a `node-deleted` change another operation recorded is a repeat too. A key that names no node, a change entry's key, and a key an entry names only as an other end are each `unknown-node`. **DN16**: the repeat writes only the node's lock. **DN17**: a delete that waited while another transaction deleted the node answers `already-gone`, naming the other's entry, from its second try. **DN21**: a delete whose entry fails keeps nothing. **L4**: two at once (live). | `delete-node.test.js`; live | integration (fake); live |
| AC3: never someone else's node, a person node or a placeholder | **DN22**: `not-own-node` for another author's letter, an admin's, and a stranger's node with no letter. **DN23**: `person-node`, naming the person's key, for the assistant's, the owner's and another author's person nodes, and one that is an element. **DN24**: `placeholder-node`, naming what it stands for, for an `e` tag's, an `a` tag's (another author's address, and one of the assistant's) and a `b` tag's placeholder, and one that is an element. **SN8–SN12**: the shared test: `person` and `placeholder`; `own` false for both; `refuseUnlessOwn`'s order; the declarations; a write's `own` still a read's for every other node; `factsOf`. **SN13**: update-node refuses both kinds by the new codes, and lists them. | `delete-node.test.js`, `test/operations/graph/update-node-shared.test.js` | integration (fake); unit |
| AC4: what else it refuses | **DN25**: `made-elsewhere` for a concept header, a superset, a primary property, a JSON schema (each naming `graph delete-concept`), a property (`graph remove-property`, A10.18), a set of the set concept and a set by its label (`graph delete-set`, A10.17), and a graph rule (the rulebook). **DN26**: `firmware-node`, naming the file. **DN27**: `not-an-element` for a tag and a node of no concept, naming `raw delete-node`. **DN28**: `holds-elements`, naming how many and the first five, by tapestryKey. **DN11**: a class-thread link to itself is no node below. **DN29**: `too-many-relationships` by the node's own count and with its tags'; a node at exactly 10,000 goes. **DN8**: an element of word alone is deleted. **DN30**: `not-installed`. **DN31**: the built-in input refusals. **DN33**: the refusal run changes nothing. | `delete-node.test.js` | integration (fake) |
| AC5: the letter and the cached copy stay | **DN2**: `letterRemains`, and the note names `export retract` (A10.34) and a re-import's new node. **DN8**: a node with no letter says it had none. **DN9**: `cacheRemains`; the store still holds the JSON under the node's key; the note names `cache rebuild` (A10.36). **DN1**: the placeholders its tags named and its author's person node stay. **DN10**: a tag another node has too stays. | `delete-node.test.js` | integration (fake) |
| AC6: history keeps what was deleted | **DN3**: the entry's `node-deleted` change: labels sorted, every property with keys sorted, concepts, the node's own relationships with their properties, each tag whole with its relationships, and `nodes`. **DN4**: the entry alone rebuilds rich: the graph is then as it was, but for internal ids. **DN9**: JSON held in the store is recorded as `stored`, and a missing entry as null. **DN14**: the change schema's descriptions. **DN29**: 10,000 relationships, all recorded. | `delete-node.test.js` | integration (fake) |
| AC7: it lasts, and it reaches agents | **DN12**: an admin's delete is the admin's, and the command's is the command's. **DN13**: listed with no guard, `repeatKey: ['node']`, its one input, every refusal and the result fields, with its `/docs` entry. **DN15**: the catalog's rows. **DN32**: 401, 403, 415, and the command's refusal is the route's. **DN34**: nothing new requires a signer. **XD1**: an admin agent, through the external CLI and with no change to it, creates, deletes, repeats, reads history, and is refused another author's node, a set and a firmware element. **L6–L8**: reinstall, restore, nginx (live). | `delete-node.test.js`, `test/operations/graph/delete-node-agent-through-cli.test.js`; live | integration (fake); live |

Decision 6, the write path's second try, has tests of its own:
- **DN18**: update-node, whose first attempt fails with `EntityNotFound`, answers from its second, recording one entry.
- **DN19**: a second failure answers 500, after two attempts and never a third.
- **DN20**: an update-node that waited for a node a delete removed answers `unknown-node`.
- **DN21**: any other error isn't tried again.

DN18 to DN20 use update-node, so they test the write path without delete-node.

## Edge cases

- [x] **A link from the node to itself.** It is listed and recorded once (DN2, DN3). Of a class-thread type, it is no node below (DN11).
- [x] **A tag two nodes have.** It stays with the other node's `HAS_TAG`. The deleted node's `HAS_TAG` to it is one of its relationships, and not one of its tags (DN10).
- [x] **A relationship from another node's tag to the node.** It is recorded as one of the node's in-relationships, and the tag stays (DN1–DN3, citer's `e` tag).
- [x] **JSON held only in the store.** It is recorded, and the store keeps it (DN9). An `lmdb:` value whose entry is missing is recorded as `stored: null` (DN9, phantom).
- [x] **The cap's boundary.** 10,001 is refused by the node's own count, and by the count with its tags'. Exactly 10,000 goes (DN29).
- [x] **A repeat recorded by another operation** (DN7): a `node-deleted` change from `graph merge-nodes`.
- [x] **A key an entry names only as an other end** is no repeat (DN7).
- [x] **Concurrent calls.** In the fake: DN17, DN18 and DN20, through the failures that stand for Neo4j's. Live: L4.
- [x] **The three hollow letters.** Decision 4 reads a `NostrEvent` with no `created_at` as a placeholder. `propertyNode`, `ruleElement` and `loner` were seeded with none, and now have one (Amendment 1, item 5). update-node's and create-element's suites pass unchanged.
- [x] **Concept Graph API unavailable:** every suite is stack-free, and the live check runs on a scratch stack.

## Statements

delete-node reads and deletes with these statements, and with the shared ones the fake already runs:
- U0, `whoseNode`'s read of a node whole;
- `F.conceptsOfNodes` and `K.headersByKey`;
- the lock, `S.lockNode`;
- the entry, `recordChange`.

DN0 holds the fake graph to them. The code may space them differently, since the fake reads a statement on one line, but not word them differently.

- **U0, a node read whole** (each tag too): `MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n`
- **D1, the repeat** (Decision 3): `MATCH (c:GraphChange) WHERE $key IN c.keys AND c.changes CONTAINS '"change":"node-deleted"' RETURN c.tapestryKey AS id, c.at AS at, c.byRole AS byRole, c.byPubkey AS byPubkey, c.operation AS operation, c.changes AS changes ORDER BY c.at DESC, c.tapestryKey DESC`
- **D2, the class-thread links out** (Decision 5), `$types` being `S.aliases()`'s three: `MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) WHERE NOT x:GraphChange AND type(r) IN $types AND elementId(m) <> elementId(x) RETURN DISTINCT m.tapestryKey AS tapestryKey, coalesce(m.tapestryValue, m.name) AS name, m.uuid AS address ORDER BY tapestryKey LIMIT 10001`
- **D3, the counts** (Decision 8): `MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) WHERE NOT x:GraphChange RETURN count(r) AS n`, and the same with `<-[r]-`
- **D4, the relationships** (Decision 9): `MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) WHERE NOT x:GraphChange RETURN elementId(r) AS id, type(r) AS type, properties(r) AS properties, m.tapestryKey AS tapestryKey, coalesce(m.tapestryValue, m.name) AS name, m.uuid AS address, m.pubkey AS author, labels(m) AS labels`, and the same with `<-[r]-`. Each relationship is kept once, by its `id`.
- **D6, the delete** (Decision 10; Amendment 1, item 2):
  - each of its own tags: `MATCH (t:NostrEventTag:TapestryNode {tapestryKey: $key}) DETACH DELETE t`;
  - then the node: `MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange DETACH DELETE n`.

## Test infrastructure

- **Runner:** each suite exports `run`, and `test/operations.test.js` finds and runs every suite under `test/operations/`. One suite runs alone with `node test/operations/graph/<suite>.test.js`.
- **Seed:** `test/helpers/deleteNodeGraph.js` (new). It starts from update-node's seed, which it doesn't change, and adds the nodes the suites name; its header says what each is for:
  - person nodes: the assistant's, the owner's, another author's, and one that is an element;
  - placeholders: an `e`, an `a` (another author's address, and one of the assistant's), a `b`, and one that is an element;
  - rich, with every kind of relationship, and citer, whose tag references it;
  - stored, with its JSON in the store; shareTag and sharer;
  - holder, holder7 and selfHeld;
  - a `node-deleted` change graph merge-nodes recorded, and the key it names only as an other end.

  `seedCrowded()` makes the cap's three nodes, with about 30,000 relationships. Only DN29 seeds it.
- **The store:** `storeEntries(dir, entries)` puts entries in the store a harness run reads, and `storedData(dir, key)` reads one back.
- **The fake graph** (`test/helpers/graphFake.js`) learns:
  - D6's node delete. C11 is unchanged, and a `DETACH DELETE` that could take a change entry is still refused, as F18 checks;
  - `failures.vanish { key, add }`;
  - `failures.entityNotFound`, a count.

  Each failure fails a transaction's first statement with `Neo.ClientError.Statement.EntityNotFound`, and the state it leaves is kept through the rollback (Amendment 1, item 6). The read fakes run D1 to D4 as they are.
- **Fixtures changed:** `loner` (`test/helpers/createElementGraph.js`), and `propertyNode` and `ruleElement` (`test/helpers/updateNodeGraph.js`), each get a `created_at` (Amendment 1, item 5).
- **Shared pieces:** `update-node-shared.test.js`'s child runner takes another seed, and SN8–SN13 use delete-node's.
- **Firmware:** the repo's active firmware (`firmware/active` → `versions/v1.0.0`), for firmware's rover and the class thread's type names.
- **Not run here:** the full `npm test`, which on this Mac writes to the agent-memory instance. The PR's CI runs the full gate.

## How to run

```
node test/operations/graph/delete-node.test.js
```

```
node test/operations/graph/delete-node-agent-through-cli.test.js
```

```
node test/operations/graph/update-node-shared.test.js
```

For a `gate:status` line, run them through the gate engine with every endpoint on a dead port:
- the variables `NEO4J_URI=bolt://127.0.0.1:9`, `REDIS_PORT=9`, and `BRAINSTORM_BASE_URL`, `TAPESTRY_BASE` and `MEILI_URL_HOST` at `http://127.0.0.1:9`;
- `require('./test/helpers/gateRunner').runGate({ suites: [...].map((file) => ({ file })), label: 'delete-node' })`, then `npm run gate:status -- --label delete-node`.

These suites run beside them, since the fake and the fixtures changed:
- `update-node.test.js` and `update-node-agent-through-cli.test.js`;
- `create-element.test.js`, `element-schemas.test.js` and `elements-agent-through-cli.test.js`;
- `create-set.test.js` and `create-set-agent-through-cli.test.js`;
- `map-fields.test.js`, `mark-field.test.js` and `unmark-field.test.js`;
- `update-concept.test.js` (C11), `remove-relationship.test.js` and `history.test.js`;
- `test/operations/graph-fake.test.js` and `test/operations/write-path.test.js`.

## The live check (at Implementation, on `scripts/scratch-stack.sh`, never the agent-memory instance)

Check `docker ps` and the shared notes before taking `tapestry-scratch`, note it there, and take it down afterwards.

- **L1:** an element made with create-element is deleted, then deleted again (`already-gone`). It is found in history by its key and by its superset's.
- **L2:** one of the assistant's lettered elements is deleted: `letterRemains`, with the relay's event count unchanged.
- **L3:** refusals of:
  - a stranger's lettered node, made with Cypher on the scratch stack;
  - a set and a superset;
  - a firmware element;
  - a person node;
  - a placeholder, from an event imported with an `e` tag naming one that isn't there;
  - a node with a class-thread link out.
- **L4:** two deletes of one node at once give one `deleted` and one `already-gone`. A delete beside an update-node of the node gives one first, and the other `unknown-node` or the update's answer. Say which error Neo4j 5.26 gave the one that waited (Decision 6). If it isn't `EntityNotFound`, the write path matches the one it is, and an amendment records it.
- **L5:** the cached copy: `GET /api/tapestry-key/:key` still answers it after the delete.
- **L6:** a firmware reinstall: the node is still gone, and its entry is still there.
- **L7:** a backup taken after the delete, restored on a fresh stack: the same.
- **L8:** an admin agent through nginx and the external CLI.
- **L9:** with the owner's yes for each server, read-only counts on staging and production of `NostrEvent` nodes with no `created_at`, and of how many of them a tag references (ADR Consequences). *(Ran 2026-11-17, with the owner's yes for both: none on either. The story's Evidence, "On staging and production".)*

## Added at implementation (a kick-back to test design)

- **A fourth hollow letter.** The whole operations runner, once the code was in, failed update-node's UN40 alone: `test/helpers/fieldGraph.js` builds every letter with no `id` and no `created_at`, so Decision 4 read its rover as a placeholder, `placeholder-node`. Every import gives an event a `created_at`, so its `event()` builder gives one too. That is item 5's fix for one more seed. Its ten suites pass with it: update-node, map-fields, the fake graph, fields, fields' agent, create-element, element schemas, mark-field, unmark-field and the rule `field-mark-allowed`.

## Added at review round 1 (the owner chose to fix the review's non-blocking findings before the PR; ADR Amendment 3)

**Three tests fail on the code at `e8dac240`,** each for the finding it pins:
- **DN35** (finding 1): a node with two `HAS_TAG`s to one tag is deleted, that tag once. It failed with 500: "5 nodes and 6 relationships went, where 6 and 6 were read".
- **DN36** (finding 2): a relationship to a node with no tapestryKey stops the delete with a 500 naming `lifecycle migrate`, and nothing changes. It got 200 `deleted`.
- **DN39** (finding 8): data the store holds for an `lmdb:` value that isn't JSON is recorded as it was held. It got `stored: null`.

**Four tests guard what the code already does.** Each passes on that code, and each failed alone when its guard was taken out of `delete-node.js` by a scratch edit (restored with `git checkout`):
- **DN16** (finding 5): it reads, from the fake's log, which nodes each delete locked. dog's and pet's headers are keyed so their tapestryKey order differs from the order the class thread reaches them in. An element of word alone locks only itself. Without the sort, it failed, and so did DN8, which reads the concepts' order.
- **DN29** (finding 6): fullLoop, 10,000 relationships with a link to itself, is refused, as Amendment 1 item 3 says. Without the first count, it failed.
- **DN37** (finding 4): a relationship gone between the reads and the delete (`failures.shrinkBeforeDetach`) answers 500 after one attempt, and nothing changes. Without the count check, it failed.
- **DN38** (finding 6): a relationship between the node and its own tag is listed once, from the tag, and recorded under it. When the tag's loop skipped it, it failed.

**Infrastructure:**
- **The seed** adds doubleTagged, unkeyedLinked (and the keyless node that CITES it), selfRef, storedText and, in `seedCrowded()`, fullLoop.
- **The fake graph** logs a lock or copies statement's keys, and learns `failures.shrinkBeforeDetach`.
- **Its comments** say what Amendment 2 found: Neo4j 5.26 fails no statement in the race, so its two `EntityNotFound` failures stand for a statement that would (finding 3, for the fake's part).

**Beside them,** these pass unchanged: the fake graph 27, the shared suite 13, the agent suite 1, update-node 41, and the write path 13.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-17, on `A10.26-delete-node` at `823edb29`, with this phase's tests and helpers, each suite alone with every endpoint dead:

```
operations: graph delete-node: 1 passed, 34 failed, 0 skipped
  PASS  DN0 (the fake runs the plan's statements and its two failures)
  FAIL  DN1–DN17, DN21–DN34: src/operations/catalog/graph/delete-node.js does not exist yet (ADR graph-operations-first-slice/0026 Decision 1)
  FAIL  DN18: update-node, whose first try failed with EntityNotFound, answers from its second (Decision 6); got 500 … "Unable to load NODE: another transaction deleted it while this one waited for its lock (the fake graph's failures)"
  FAIL  DN19: the write ran twice, never a third time (Decision 6); got ["rollback"]
  FAIL  DN20: update-node of a node deleted while it waited answers unknown-node from its second try (Decision 6); got 500 …

operations: an admin agent deletes elements through the external CLI: 0 passed, 1 failed, 0 skipped
  FAIL  XD1: src/operations/catalog/graph/delete-node.js does not exist yet …: the external CLI exited 2: 'graph delete-node' isn't among the operations … may call

operations: what graph update-node shares: 7 passed, 6 failed, 0 skipped
  PASS  SN1–SN7
  FAIL  SN8: taUser, the assistant's person node: … person true (ADR 0026 Decision 4); got {… "labels":["NostrUser","TapestryNode"],"own":true}
  FAIL  SN9, SN10, SN12: _nodes.js refuseUnlessOwn / PERSON_NODE and PLACEHOLDER_NODE / factsOf doesn't exist yet
  FAIL  SN11: the seed's person nodes and placeholders are among them …; got 0 and 1818
  FAIL  SN13: update-node of the owner's person node: 409 person-node (ADR 0026 Decision 4); got 409 … "not-an-element"
```

The suites run beside them all pass:
- update-node 41/41, update-node's agent 1/1;
- create-element 33/33, element schemas 9/9, elements' agent 1/1;
- create-set 35/35, create-set's agent 1/1;
- map-fields 12/12, mark-field 16/16, unmark-field 13/13;
- update-concept 11/11, remove-relationship 7/7, history 8/8;
- the fake graph 27/27, the write path 13/13.
