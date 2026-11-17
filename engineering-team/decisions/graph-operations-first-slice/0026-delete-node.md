# ADR 0026: `graph delete-node` — one of the instance's own elements deleted whole and recorded whole, and the shared own test taught person nodes and placeholders

**Status:** Accepted
**Date:** 2026-11-17
**Story:** `engineering-team/stories/graph-operations-first-slice/26-delete-node.md`
**Amends:** ADR graph-operations-first-slice/0021 Decision 3 (Decision 4 below)

## Context

The story asks for one graph write. `graph delete-node` takes `node`, the tapestryKey of one of this instance's own elements. It deletes the node with every relationship it has, and its tags (AC1).
- Run again, it answers `already-gone` (AC2).
- It refuses someone else's node, a `NostrUser` node and a placeholder (AC3), and the nodes AC4 lists.
- It leaves the letter and the cached copy where they are, and says so (AC5).
- Its change entry records the whole node (AC6).
- It lasts through a reinstall and a restore, and reaches agents (AC7).

At the gate the owner settled three questions:
- sets are `graph delete-set`'s (A10.17), and the catalog's two rows agree;
- a node from the instance's own letter is deleted, and the answer says the letter is still out there;
- the change entry keeps the node whole.

What the code and the graph offer today:

1. **The write path** (`src/operations/write.js:25`). One transaction: the guards, then `apply(inputs, ctx)`, then the change entry when `changes` isn't empty. A refusal anywhere rolls everything back. The seam (`src/operations/graph.js:42`) runs the work through `session.executeWrite`, which runs it again on a transient error, such as a deadlock. A plain error answers 500 (`src/operations/http.js:120`).
2. **update-node, the model** (`src/operations/catalog/graph/update-node.js`). Its order:
   - `not-installed` (`:156`);
   - the lock on the node (`:160`, `S.lockNode`);
   - whose node it is (`:163`, `N.requireOwn`);
   - its concepts, then `made-elsewhere` (`:169`, `X.changedElsewhere`), `firmware-node` (`:171`) and `not-an-element` (`:175`);
   - then the locks on its concepts' headers, in tapestryKey order (`:182`).
3. **The shared own test** (`src/operations/catalog/graph/_nodes.js:63`, `:84`).
   - `whoseNode` reads the node whole and answers `{ key, uuid, name, author, hasLetter, labels, own }`.
   - Its `own` is the read conventions' (`src/operations/reads.js:204`): the author is null, or the assistant's or the owner's key.
   - `requireOwn` refuses `unknown-node`, then `not-own-node`.
   - ADR 0021 Decision 3 binds reads and writes: a write counts a node as its own exactly when a read does.
4. **What the test gets wrong** (memo #124; ledger row `2026-11-17-own-test-reads-pubkey-as-author`).
   - **`NostrUser` nodes.** The import makes one `NostrUser {pubkey}` for each author whose events it reads, with `AUTHORS` to each of their events (`src/api/neo4j/eventSync.js:234–236`). Its `pubkey` is the person it stands for, not an author, so the owner's and the assistant's answer `own: true`.
     - This document calls one a *person node*.
     - This instance has 6,560 of them, none in a class thread and none with tags (read-only count, 2026-11-17).
   - **Placeholders.** For a tag that names an event the graph doesn't hold, the import makes a `NostrEvent` that stands for it:
     - for an `e` tag, by the event's id: `{ id, uuid }` (`:268–270`);
     - for an `a` tag, by its address: `{ uuid, kind, pubkey }` (`:285`);
     - for a `b` tag, by its address: `{ uuid }` (`placeholderUnlessHeld`, `:188`).

     An `e`-tag placeholder answers `own: true` and `hasLetter: true`; a `b`-tag one answers `own: true`.
   - **What marks a placeholder.** Every import of an event sets its `created_at`, with its id, pubkey and kind. That holds for `eventSync.js` and for both of `src/api/normalize/`'s imports (`helpers.js:83`, `index.js:154`).
     - No placeholder has a `created_at`.
     - A node made with no event has no `NostrEvent` label (`src/operations/catalog/graph/_eventless.js:65`).
     - This instance has 545 events, each with a `created_at`, and no placeholder (read-only count, 2026-11-17).
5. **A node's concepts** (`F.conceptsOfNodes`, `src/operations/catalog/graph/_fields.js:386`): every concept header whose class thread reaches it, `(e)<-[:TERM]-()<-[:PROP*0..]-(:Superset)<-[:INIT]-(h)`. The three class-thread types are firmware's aliases (`S.aliases()`, `src/operations/catalog/graph/_sets.js:52`). `/api/concept-graph/summaries` (2026-11-17) gives `39998:<TA>:nostr-user` no elements.
6. **The nodes another operation looks after.**
   - `X.changedElsewhere` (`src/operations/catalog/graph/_elements.js:135`) finds them by their concepts' firmware addresses, then by their role labels (ADR 0021 Amendment 1).
   - `X.firmwareElementOf(uuid)` (`:465`) names a firmware element's file.
7. **Locks.** `S.lockNode(tx, key)` (`_sets.js:257`) sets a property and takes it away again, so the node stays locked until the transaction ends. A relationship's DELETE doesn't lock its ends (ADR 0028 Amendment 2).
8. **The change entries** (`src/operations/changes.js`).
   - An entry's `keys` are every tapestryKey its changes name in `node`, `from`, `to`, `concept` and `nodes` (`keysOf`, `:81`). `graph history` filters by them (`:150`).
   - `was` and `now` take any JSON value (ADR 0021 Decision 18). `entryOf` (`:119`) parses a stored entry.
9. **The cache** (story fact 10).
   - The derive step writes a node's JSON to the store under the node's tapestryKey, and stamps `tapestryJsonUpdatedAt` (`src/lib/tapestry-derive.js:122–129`).
   - The offload route puts a json tag's JSON there under the node's tapestryKey, points the tag at it (`lmdb:<key>`), and stamps the node (`src/api/tapestry-key/index.js:255–267`).
   - So a node the store holds JSON for always carries the stamp. `F.readJson` resolves an `lmdb:` reference (`_fields.js:100`).
10. **Deleting.**
    - No route deletes a node.
    - Tags are deleted with `DETACH DELETE` when an event is imported again (`eventSync.js:369`), and by update-concept (`update-concept.js:146`).
    - The field mapping refuses a call over 10,000 elements (`too-many-elements`, `_fields.js:33`).

Two readings of the story, for this gate:
- **A concept's superset** is in two of AC4's bullets: among a concept's core nodes (`graph delete-concept`), and beside sets (`graph delete-set`). A superset goes with its concept, and delete-set takes sets, so the refusal names `graph delete-concept` (Decision 5).
- **An element of word alone** is an element: word's class thread reaches it. update-node refuses one, since word's section is its word block. A delete changes no section, so delete-node deletes one (Decision 5).

## Options considered

### Option A — Delete it whole in one transaction, record it whole, and teach the shared test the two kinds of node
`apply` locks the node and finds out whose it is and what kind it is. It locks its concepts' headers, reads all of it, and deletes it and its tags with `DETACH DELETE`. The entry's one change, `node-deleted`, holds what was read.
- `whoseNode` learns person nodes and placeholders, so every write that calls it refuses them.
- The write path runs a write once more when a node it was waiting for is deleted meanwhile, so the second of two deletes answers `already-gone`.

*Pros:*
- The graph keeps nothing of the node but its entry.
- Each check sits where update-node's does.
- The shared test is fixed once, for update-node, merge-nodes, copy-node and delete-node alike.

*Cons:* An entry is as large as the node it deletes (the owner's answer, question 3). The write path's second try is new.

### Option B — A soft delete: mark the node deleted, and hide it
The node keeps its relationships and tags, and gains a mark, such as a `Deleted` label, that every read leaves out. An undo takes the mark off.

*Pros:* Undo is one statement, and nothing is lost.

*Cons:*
- Every reader would have to learn the mark: the operations' reads and rules, the concept-graph API, the UI's Cypher, the derive step, search, export and the trust pipeline.
- The import's `MERGE`, by address or by id, would land on a marked node and bring it back, or update it.
- AC1 asks for the node gone from the graph.

### Option C — The checks as rules of the rulebook, declared as guards
For example, a rule that no delete leaves a node of no concept, and the test of whose node it is as a rule too.

*Pros:* `rules check` (A10.31) could reuse the rules.

*Cons:*
- A guard's items come from the inputs, and it runs before `apply`'s lock, so it would read the graph before the node is locked.
- The graph doesn't hold D9 today: tags, person nodes and placeholders are elements of no concept. As a check, the rule would report every one of them.
- A rule needs a rulebook entry, an element of the graph rule concept and a firmware reinstall (ADR 0041).
- ADR 0021 Option C turned the own test down as a rule: it is "a policy about writes, not a rule the graph can break".

## Decision

We chose **Option A**. It deletes what the story asks and records what the owner asked. It leaves every reader as it is, and it fixes the shared test where every write reads it. Option B's easy undo is a later story's, and AC6 keeps what that story needs. Option C's gain, `rules check` reusing the checks, can come when A10.31 is built, from the entries and the graph.

**1. The inputs** (`src/operations/catalog/graph/delete-node.js`, `access: 'owner-and-admins'`):
- `node` (required): a tapestryKey (`N.keyInput`).
- `repeatKey: ['node']`.
- No guards.

**2. The steps,** in one transaction:
1. `not-installed` (409) when the instance has no assistant key: the own test and firmware's own elements both need it.
2. Lock the node (Decision 7).
3. Read whose node it is (`N.whoseNode`, Decision 4):
   - no node: the repeat, `already-gone`, or `unknown-node` (404) (Decision 3);
   - then `person-node`, `placeholder-node` or `not-own-node` (409), by `N.refuseUnlessOwn`.
4. Read its concepts (`F.conceptsOfNodes`, `K.headersByKey`) and what kind of node it is (Decision 5): `made-elsewhere`, `firmware-node`, `not-an-element` and `holds-elements` (409).
5. Lock its concepts' headers (Decision 7).
6. Count what it would remove: `too-many-relationships` (409) over 10,000 (Decision 8).
7. Read it whole (Decision 9).
8. Delete its tags and it (Decision 10), then answer (Decision 11) and record the entry (Decision 12).

Only the locks are written before step 8, and they leave no trace, so every refusal leaves the graph as it was.

**3. A repeat, told from a key that never named a node** (AC2). When `whoseNode` answers null, `apply` reads the entries that may record the node's deletion, newest first:
```
MATCH (c:GraphChange)
WHERE $key IN c.keys AND c.changes CONTAINS '"change":"node-deleted"'
RETURN c.tapestryKey AS id, c.at AS at, c.byRole AS byRole, c.byPubkey AS byPubkey, c.operation AS operation, c.changes AS changes
ORDER BY c.at DESC, c.tapestryKey DESC
```
It parses each with `entryOf`, and takes the first with a `node-deleted` change whose `node` is the key. `CONTAINS` only narrows the scan: an entry that names the key because one of its relationships ended there doesn't count.
- **Found:** `outcome: already-gone`, with no changes.
  - The answer gives the node and its concepts as the entry recorded them.
  - `deletion` gives the entry's `{ id, at, by, operation }`.
  - Any operation that records a `node-deleted` change counts. So a node that merge-nodes (A10.25) or raw delete-node (A10.30) removes is a repeat too, if they record one.
- **Not found:** `unknown-node` (404). No node has the key, and no entry records deleting one that did. The message says that something other than a graph write may have removed it.

**4. Whose node it is: person nodes and placeholders** (AC3; memo #124). *This amends ADR 0021 Decision 3.*
- **`whoseNode` answers two more facts:**
  - `person`: the node is labelled `NostrUser`;
  - `placeholder`: the node is labelled `NostrEvent` and has no `created_at` (Context 4).
- **Its `own`** is the read conventions' `own`, except that it is false for either kind. A person node stands for the person whose key it carries, and a placeholder for an event the graph doesn't hold. The import makes both. Neither is the instance's own to change, whatever key it carries.
- **Its `hasLetter`** is false for a placeholder: the graph doesn't hold the event it stands for.
- **Its `author`** stays the node's `pubkey`, as reads answer it.
- **`factsOf(key, node)`** is the pure part: a node's properties and labels to these facts. `whoseNode` reads the node with U0 and calls it. delete-node calls it on a node its entry recorded (Decision 3).
- **`refuseUnlessOwn(facts, { input })`** throws for a node that isn't the instance's own, in this order. `requireOwn` calls it after `whoseNode`. delete-node calls it after its own null case.
  1. `person-node` (409), naming the person's key. The node stands for that person. The import makes one for each author whose events it reads, and the instance's Web of Trust is computed from them, so an operation leaves it as the import made it. `raw delete-node` (A10.30, to come, the owner's) removes any node.
  2. `placeholder-node` (409), naming the id or address it stands for. The import made it for an event the graph doesn't hold, which another node's tag names. Importing that event fills it in, and `raw delete-node` removes any node.
  3. `not-own-node` (409), as Decision 3 has it.
- **`PERSON_NODE` and `PLACEHOLDER_NODE`** are the declarations. Each write that calls `requireOwn` or `refuseUnlessOwn` lists them:
  - update-node and delete-node now;
  - merge-nodes (A10.25), when it is built.

  copy-node (A10.24) reads `whoseNode`, and decides what it does with each kind.
- **What this changes for update-node.** Until now it refused a person node or a placeholder by `not-own-node` or `not-an-element`. Now it refuses them by `person-node` and `placeholder-node`.
- **What it leaves alone.** The read conventions still answer `own` by the author alone, so an `e`-tag placeholder still reads `own: true`. A write's `own` is still a read's, except for these two kinds of node, which a write never counts as its own. A ledger row records the reads' half (Consequences).

**5. What kind of node it is** (AC4). These checks run after whose node it is, as update-node's do. Each refusal changes nothing and names `node`.
- **`made-elsewhere`** (409), when `X.changedElsewhere({ conceptUuids, labels, uuid })` matches. delete-node names the operation that deletes such a node:

  | `changedElsewhere`'s slug | The node is | The refusal names |
  |---|---|---|
  | `concept-header` | a concept header | `graph delete-concept` (A10.17) |
  | `superset`, `primary-property`, `properties-set`, `property-tree-graph`, `concept-graph`, `core-nodes-graph` | one of a concept's core nodes, which goes with its concept | `graph delete-concept` (A10.17) |
  | `json-schema` | a concept's JSON schema, which goes with its concept | `graph delete-concept` (A10.17); `graph set-schema` (A10.18) replaces one |
  | `property` | a property | `graph remove-property` (A10.18) |
  | `set` | a set | `graph delete-set` (A10.17) |
  | `graph-rule` | a graph rule | the rulebook |

  The table is delete-node's own. `X.CHANGED_ELSEWHERE` keeps update-node's operations.
- **`firmware-node`** (409), when `X.firmwareElementOf(uuid)` names a file. A firmware reinstall would make the node again, so it changes in firmware's definition, through `lifecycle seed-firmware` (A10.37).
- **`not-an-element`** (409), when no concept's class thread reaches it, as with a tag. Word counts as a concept here, so an element of word alone is deleted (Context). `raw delete-node` (A10.30) removes any node.
- **`holds-elements`** (409), when a class-thread link (one of `S.aliases()`'s three types) runs from the node to another node.
  - Deleting the node would take those nodes, and any below them, out of the concepts whose class thread runs through it. Any with no other way in would be left of no concept (D9).
  - The refusal names how many nodes are directly below it, and the first five, by tapestryKey.
  - A link from the node to itself doesn't count.
  - It is a precondition of one write, so it isn't a rule (Option C).

**6. The write path's second try** (AC2). `applyWrite` runs a write once more, from the start, when its first attempt fails with Neo4j's `Neo.ClientError.Statement.EntityNotFound`. A statement gets that error when it waited for a node's lock and another transaction deleted the node meanwhile.
- **Two deletes of one node.** The second waits for the node's lock, fails, and runs again. Now the node is gone and the first delete's entry is there, so it answers `already-gone`.
- **Other writes.** A write that waited for a node a delete removed, such as an update-node of it, answers `unknown-node` the same way, never a 500.
- **A second failure is thrown,** and any other error is never retried.
- **Running a write again is safe.** Its work does nothing outside its transaction, the seam's rule for `executeWrite`, and `at` is taken again on each attempt (`write.js`'s own comment).
- **To confirm on Neo4j.** The fake graph can't wait for a lock. The live check runs two deletes of one node at once, and says which error Neo4j 5.26 gave. If it is another code, the Implementer matches that one, and an amendment records it.

**7. The locks.**
- **The node first** (`S.lockNode(tx, key)`), before anything is read. Two deletes of one node, and a delete beside an update-node of it, go one at a time. The second waits for the lock, then runs again (Decision 6).
- **Then its concepts' headers,** in tapestryKey order. Headers of concepts keyed `word` or `graphContext` aren't locked, as update-node locks only its judged concepts. create-element locks its concept's header before it looks for its repeat (`create-element.js:105`, `:128`). So it never answers with a node that is being deleted, and none of its reads sees one disappear.
- **One order,** the node and then its headers in key order, as update-node takes them. So neither write can deadlock the other, and create-element takes only one lock.
- **A known gap.** A relationship's DELETE doesn't lock its ends (Context 7).
  - A remove-relationship, an unlink-set or an import of the node's letter could take out one of its relationships or tags between the read and the delete.
  - The delete's counts would then differ from what it read, so it fails and rolls back (Decision 10).
  - It never records what it didn't delete.

**8. A cap.** Before reading the node whole, `apply` counts what the delete would remove: the node's relationships in and out, its `HAS_TAG`s among them, and its tags' other relationships.
- Over 10,000, the field mapping's cap, the call is refused: `too-many-relationships` (409), naming the count.
- `raw delete-node` (A10.30) removes any node.
- The cap bounds the transaction, the answer and the entry.

**9. What it reads,** once the locks are held:
- **The node:** `RETURN n`: its properties and labels.
- **Its relationships,** out and in, each with its type, its properties and the node at its other end, as the read conventions give a node (C5).
  - A link from the node to itself is read once, as out.
  - Its `HAS_TAG`s to the tags deleted with it are left out here: the tags carry them.
- **Its tags:** each `NostrEventTag` it has by `HAS_TAG` that no other node has.
  - Each is read whole, with each of its relationships but that `HAS_TAG`: its type, its direction, its properties and the node at the other end.
  - A relationship between the node and one of these tags is read once, under the tag.
  - A tag that another node has too stays. Its `HAS_TAG` from this node is one of the node's relationships.
- **JSON held in the store:** for each tag whose value is an `lmdb:` reference, the JSON the store holds for it (`F.readJson`), or null when the store's entry is missing.
- **Its concepts:** `{ concept, name, address }` for each one found in step 4.

**10. The delete.** Its tags first, then the node:
```
MATCH (n:TapestryNode {tapestryKey: $key})-[:HAS_TAG]->(t:NostrEventTag)
WHERE NOT n:GraphChange AND NOT EXISTS { MATCH (o)-[:HAS_TAG]->(t) WHERE o <> n }
DETACH DELETE t
```
```
MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange DETACH DELETE n
```
The counters must show the node and its tags deleted, and every relationship read deleted. If they don't, something changed between the read and the delete (Decision 7's gap):
- `apply` throws, so the transaction rolls back and nothing changes;
- the call answers 500, saying that the node changed while it was being deleted, and to try again.

**11. The answer** (AC1, AC2, AC5):

| Field | What it holds |
|---|---|
| `outcome` | `deleted`, or `already-gone` |
| `node` | the node as it was: the read conventions' five facts, and `hasLetter` |
| `concepts` | each concept it was an element of: `{ concept, name, address }`, sorted by the concept's tapestryKey |
| `relationships` | each relationship removed, as C5 gives one (`type`, `direction`, `from`, `to`, `node`, `properties`), with `tag`: for one of its tags' relationships, that tag's `{ key, type }`, else null. Empty for `already-gone` |
| `tags` | how many tags were deleted with it; 0 for `already-gone` |
| `letterRemains` | whether it had a letter, which stays wherever it was sent |
| `cacheRemains` | whether the store held a copy of its JSON (`tapestryJsonUpdatedAt`), which stays there |
| `deletion` | for `already-gone`, the entry that records the deletion, `{ id, at, by, operation }`; null for `deleted`, whose entry is `change` |
| `note` | in words: what went, and what stays |
| `change` | this call's entry; null for `already-gone` |

The note says:
- that the node was deleted from this instance's graph only, and nothing was signed or sent anywhere;
- with a letter:
  - its letter, by its address or id, stays wherever it was sent, this instance's relay among them;
  - `export retract` (A10.34, to come) takes a letter back;
  - importing that letter again makes the node again, as a new node with a new tapestryKey;
- without a letter: it had none, so nothing of it was sent anywhere;
- with a cached copy: the store keeps a copy of its JSON under its tapestryKey. Its JSON page and `GET /api/tapestry-key/:key` may still show that copy until `cache rebuild` (A10.36) drops it;
- that its change entry keeps the whole node, which `graph history` finds by this tapestryKey.

For `already-gone`, it says when the node was deleted, by whom and through which operation, and that nothing changed.

**12. The entry** (AC1, AC6). One change:
```
{ change: 'node-deleted', node: <key>, nodes: [<the other ends>], was: { … } }
```
- **`nodes`:** the distinct tapestryKeys at the other end of each relationship removed, the node's and its tags', sorted. The node itself and the tags deleted with it aren't among them. So `graph history` finds the entry by the node and by each of these (`keysOf`).
- **`was`:**
  - `labels`: its labels, sorted;
  - `properties`: every property it had, keys sorted, `tapestryKey` among them;
  - `concepts`: as the answer gives them;
  - `relationships`: `{ type, direction, other, properties }` for each relationship of Decision 9, where `other` is the other end's tapestryKey;
  - `tags`: `{ labels, properties, stored, relationships }` for each tag deleted. `stored` is the JSON the store held for an `lmdb:` value, and is absent otherwise. `relationships` is as above.
- **What it leaves out:** the cached copy, which the derive step makes again from the node.
- **`changes.js`** gains `node-deleted` among `change`'s examples. `was` is described as "for a deleted node, the node as it was", and `nodes` as "or the nodes at the other end of a deleted node's relationships". The entry's size is in Consequences.

**13. What stays behind** (AC5).
- **The letter.** A graph write never touches a relay (D1, D2).
- **The cached copy.** A graph write keeps out of the store, which is the derive step's, as update-node leaves the cache as it is (story 21, open question 4). A memo on A10.36 asks `cache rebuild` to drop the copies of nodes that are gone.
- **The nodes it pointed at stay,** since nothing else is deleted (AC1):
  - a placeholder that only its tags referenced;
  - its author's person node, even when left with no `AUTHORS`.

  `rules check` (A10.31) can find a placeholder nothing references.

**14. Durability** (AC7).
- **A firmware reinstall** makes firmware's headers and nodes alone (ADR 0016 Decision 13). delete-node refuses those, so a reinstall never makes a deleted node again.
- **A backup** carries the whole graph, change entries among them. A backup taken after the delete brings back the deletion and its entry (ADR graph-operations-foundation/0002).
- **An import of the node's letter** makes it again, as a new node with a new tapestryKey (story fact 4), and the answer warns of it. Keeping a deleted node deleted against an import is a question for provenance (design §5, question 2), as is keeping a newer local version against an older letter (ADR 0021 Consequences).

**15. The refusals,** each changing nothing and recording no entry:

| Code | Status | When |
|---|---|---|
| `not-installed` | 409 | The instance has no assistant key, so it can't tell its own nodes or firmware's |
| `unknown-node` | 404 | `node` names no node, and no entry records its deletion (a change entry is not a node) |
| `person-node` | 409 | The node is a person node (`NostrUser`), which stands for a person (Decision 4) |
| `placeholder-node` | 409 | The node is a placeholder the import made for an event the graph doesn't hold (Decision 4) |
| `not-own-node` | 409 | The node came from another author's event, or records another author (D4) |
| `made-elsewhere` | 409 | The node is a concept header or core node, a JSON schema, a property, a set or a graph rule, by its concepts or its role labels; the refusal names the operation that deletes it (Decision 5) |
| `firmware-node` | 409 | The node is one of firmware's own elements |
| `not-an-element` | 409 | No concept's class thread reaches the node |
| `holds-elements` | 409 | A class-thread link runs from the node to another node |
| `too-many-relationships` | 409 | Deleting the node would remove more than 10,000 relationships |

## Consequences

**What this enables**
- Taking out a wrong or duplicate element, and running a step that failed partway again, with nothing signed.
- One answer, for every write, to whose node a person node or a placeholder is.
- An undo, later, from the entry alone.

**What this constrains**
- **An entry is as large as the node it deletes** (the owner's answer, question 3): up to 1,000,000 characters of JSON, and up to 10,000 relationships. `graph history` answers entries whole, so a page of large deletes is large.
- **The cache keeps a deleted node's JSON** until A10.36 (Decision 13).
- **An import of the letter brings the node back,** as a new node (Decision 14).
- **Reads and writes differ on `own`** for person nodes and placeholders (Decision 4).
- **Lock order.** A later write that locks both a node and a concept's header must lock the node first, as update-node and delete-node do.
- **An event an older import left with no `created_at` reads as a placeholder,** and every write that tests whose node it is refuses it. That refusal is safe, since nothing is deleted or changed. This instance has none, and the live check counts staging's and production's.
- **Decision 7's gap answers 500.** The rare race rolls back, and the caller tries again.

**New debt and follow-ups**
- **A memo on A10.36:** `cache rebuild` drops the copies of nodes that are gone.
- **A ledger row:** the read conventions' `own` for person nodes and placeholders (Decision 4). This change does what ledger row `2026-11-17-own-test-reads-pubkey-as-author` asks, for writes.
- **A memo on A10.17:** delete-set and delete-concept take the sets, supersets and core nodes that delete-node refuses. They can share Decision 3's repeat and Decision 12's entry.
- **Undo** is a later story. AC6 keeps what it needs.
- **Firmware reinstall required?** No. No concept's definition changes, and the rulebook gains no entry.

## Implementation notes

- **`src/operations/catalog/graph/delete-node.js`** (new): Decisions 1–3, 5 and 7–15.
- **`src/operations/catalog/graph/_nodes.js`:** Decision 4.
  - `factsOf`, with `person`, `placeholder`, `own` and `hasLetter`. `whoseNode` calls it.
  - `refuseUnlessOwn`, which `requireOwn` calls.
  - `PERSON_NODE` and `PLACEHOLDER_NODE`.
  - Its header's index, and `NOT_OWN_NODE`'s `when` where it says which nodes it leaves to the two new refusals.
- **`src/operations/catalog/graph/update-node.js`:** lists `N.PERSON_NODE` and `N.PLACEHOLDER_NODE` in its refusals. Nothing else changes.
- **`src/operations/write.js`:** Decision 6, with a step in its header.
- **`src/operations/changes.js`:** Decision 12's descriptions.
- **`docs/GRAPH_OPERATIONS_CATALOG.md` §2:**
  - delete-node's row: `node` → the node as it was, its concepts, each relationship removed, how many tags went with it, and whether its letter and its cached copy remain; safe to repeat (`already-gone`); Decision 15's refusals. It no longer says it deletes empty sets;
  - update-node's row gains `person-node` and `placeholder-node`;
  - delete-set's row already says it deletes an empty set, so with delete-node's changed, the two rows agree (the owner's answer, question 1).
- **Statements.** New ones, which the Tester teaches the fake graph:
  - D1, the repeat (Decision 3);
  - D2, the class-thread links out (Decision 5);
  - D3, the count (Decision 8);
  - D4, the relationships out and in, with their properties (Decision 9);
  - D5, the tags whole, with their relationships;
  - D6, the delete (Decision 10), with its counters.
- **Tests** (the Tester's, Phase 3), registered as the other graph suites are:
  - **a suite for the operation:**
    - each refusal of Decision 15;
    - `deleted`, with each field of Decision 11;
    - `already-gone`, with `deletion`;
    - `unknown-node` for a key that was never a node's, and for a change entry's key;
    - history by the node and by a node at the other end;
    - nothing signed;
  - **the entry:** `was` whole, `stored` for an `lmdb:` json tag, and `nodes`;
  - **the locks:** the node, then each header, in order;
  - **the write path's second try:**
    - a write whose first attempt throws `EntityNotFound` answers from its second;
    - a second failure is thrown;
    - any other error isn't retried;
  - **the shared test** (`test/operations/graph/update-node-shared.test.js`):
    - the owner's, the assistant's and a stranger's person nodes, and an `e`-, an `a`- and a `b`-tag placeholder, each `own: false` and refused by its code;
    - a placeholder's `hasLetter`;
    - SN2's pairing, which stays true for every other node;
  - **the fake's two hollow letters.** `test/helpers/updateNodeGraph.js` gives `propertyNode` and `ruleElement` a `NostrEvent` label and an `id` but no `created_at`, which Decision 4 now reads as placeholders. Every import gives an event a `created_at`, so the Tester gives them one, and update-node's suites stay as they are;
  - **an agent suite** through the external CLI;
  - **ADR graph-operations-foundation/0004 Decision 10's guard:** nothing new requires anything that signs.
- **The live check** runs on a fresh scratch stack (`scripts/scratch-stack.sh`), never the agent-memory instance:
  - an element made with create-element, deleted, deleted again (`already-gone`), and found in history by its key and by its superset's;
  - one of the assistant's lettered elements deleted, with the relay's event count unchanged;
  - refusals of a stranger's lettered node (made with Cypher on the scratch stack), a set, a superset, a firmware element, a person node, a placeholder (from an event imported with an `e` tag naming one that isn't there), and a node with a class-thread link out;
  - two deletes of one node at once, and a delete beside an update-node of it, saying which error Neo4j gave (Decision 6);
  - the cached copy, still answered by `GET /api/tapestry-key/:key`;
  - a reinstall, and a backup restored on a fresh stack: the node still gone, with its entry;
  - an admin agent through nginx and the external CLI;
  - with the owner's yes for each server, a read-only count on staging and production of `NostrEvent` nodes with no `created_at`, and of how many of them a tag references (Consequences).
- **Branches:** staging only, by the usual chain.

## Out of scope

- Undoing a delete: a later story, from the entry.
- Deleting concepts, supersets and sets (A10.17), and properties (A10.18).
- Deleting any node unguarded (A10.30).
- Taking back a letter (A10.34), and rebuilding the cache (A10.36).
- The read conventions' `own` for person nodes and placeholders: a ledger row.
- Hiding or muting another author's node (catalog §10, question 5).
- Bulk deletes.

## Amendment 1 (2026-11-17, at test design; approved by the owner with the test plan) — the statements, the cap's two counts, and a third hollow letter

Test design wrote the statements the ADR names, and found where they refine it. The test plan gives each statement whole, and the fake graph runs them. DN0 holds the fake to them.

1. **The reads are one-hop statements from a node found by its tapestryKey:**
   - D2, the class-thread links out, with `type(r) IN $types`;
   - D3, the counts out and in;
   - D4, the relationships out and in.

   D4 answers each relationship's `elementId`, so one read twice is kept once: a link from the node to itself, or one between the node and its tag. Each tag is read whole with U0, and its relationships with D4.
2. **The tags are deleted one at a time, with C11:** `MATCH (t:NostrEventTag:TapestryNode {tapestryKey: $key}) DETACH DELETE t`, the statement update-concept already uses. Then the node goes with Decision 10's second statement.
   - This replaces Decision 10's first statement and its `NOT EXISTS`.
   - A tag that another node has too is told from D4's reads: it has a `HAS_TAG` from a node other than this one. It stays, as Decision 9 says.
3. **The cap is checked twice** (Decision 8).
   - **First, on D3's counts** for the node's own relationships, before anything is read whole. A link from the node to itself counts twice there, so a node at exactly 10,000 with such a link is refused.
   - **Then on the relationships read,** the tags' among them, each counted once.
4. **`stored` is the value the store held** for an `lmdb:` reference, as `F.readJson` resolves it: the object, not its text. It is null when the store's entry is missing.
5. **A third hollow letter.** The Implementation notes name `propertyNode` and `ruleElement`. `loner` in `test/helpers/createElementGraph.js` is a third: a `NostrEvent` with an id and no `created_at`, which update-node's UN26 refuses. It gets a `created_at` too.
   - `held` in `test/helpers/conceptGraph.js` ("not a concept": an id, no pubkey, no kind) reads as a placeholder by Decision 4's mark.
   - No write tests whose node `held` is, so it stays as it is.
6. **The fake graph learns three things:**
   - D6's node delete;
   - `failures.vanish`, which deletes a node, with the tags only it has, and commits another transaction's entry, as if that transaction had done it while this one waited;
   - `failures.entityNotFound`, which fails a number of first statements.

   Each failure fails a transaction's first statement with Neo4j's `Neo.ClientError.Statement.EntityNotFound`.
