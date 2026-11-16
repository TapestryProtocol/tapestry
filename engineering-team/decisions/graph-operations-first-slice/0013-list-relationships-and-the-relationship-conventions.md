# ADR 0013: `graph list-relationships`, and how every relationship read answers and judges a relationship — its direction from the node asked about, its `from` and `to`, the node at its other end judged as the read conventions judge a node, and what it records about itself

**Status:** Accepted
**Date:** 2026-11-16
**Story:** `engineering-team/stories/graph-operations-first-slice/13-list-relationships.md`

## Context

The story (Loom A10.13) asks for one graph read, and for how the relationship reads after it answer and judge a relationship. Its criteria, in short:

- **AC1** — `GET /api/tapestry/graph/list-relationships` with `node` (a tapestryKey) lists every relationship that runs from the node and every one that runs to it, of any type. `type` narrows it to one type, and `direction` (`out`, `in`, or `both` by default) to one direction. The answer gives the node with its five facts, and the type, direction and point of view it listed by. A node or type with no relationships answers an empty list.
- **AC2** — each relationship comes with its type, its direction from the node asked about, its `from` and `to` (the names `graph remove-relationship` takes), the node at its other end with its five facts, and what it records about itself. Two relationships of one type between the same two nodes, running the same way, are each listed.
- **AC3** — pages of at most `limit` (1–200, 50 by default) in a stable order, with a cursor that is null on the last page. Paging answers every relationship exactly once, parallel ones included, and one added or taken out between pages moves no other. A cursor this read didn't give, for the same node, type, direction and point of view, is refused.
- **AC4** — the owner's point of view by default. A relationship counts when the node at its other end counts by the read conventions' test. The node asked about is never left out. The answer says how many were kept and left out across the whole list, and when the owner's scores don't exist yet. `pov=everyone` keeps all. Nothing is stored. Any other `pov` is refused.
- **AC5** — refusals: no `node`, or one that names no node (a change entry is not one); a malformed `node`, `type` or `direction`; an input the read doesn't take.
- **AC6** — it writes nothing; 401 and 403 for everyone but the owner and admins; listed for agents, in `/docs`, and run by `tapestry graph list-relationships`; an admin agent uses it through the external CLI on a scratch stack.
- **AC7** — how a relationship is answered and judged is defined once, beside the read conventions, and written into the catalog's Conventions for `graph walk` (A10.14) and `graph describe-node` (A10.10).

The owner settled the story's three questions (2026-11-16):
1. The node at the other end decides whether a relationship counts, by the read conventions' test, and the node asked about is never left out.
2. Each relationship is answered with its type, its direction, `from` and `to`, the node at the other end, and what it records about itself. `direction` takes `out`, `in` or `both`, `both` by default.
3. With no `type`, relationships to tag nodes are left out, and the answer says how many. With a `type`, they are listed.

**Orientation.** The local instance's `/api/concept-graph/summaries` (read only, 2026-11-16) lists `39998:<TA>:relationship-type` (14 elements), `…:relationship` (22), `…:class-thread`, `…:nostr-user`, `…:web-of-trust` and `…:graperank`. `GET /api/concept-graph/node/39998:<TA>:relationship-type/neighbors` shows the problem this read fixes. It answers `HAS_ELEMENT: [superset for the concept of concept headers]` beside `IS_THE_CONCEPT_FOR: [superset for the concept of relationship types]`, and nothing says that the first runs to the header and the second from it. The relationship-type concept's elements name 14 types, among them `has tag`, `references` and `authors`. `FOLLOWS` and `TAGS` aren't among them. No concept changes here.

**Facts from the code and the local graph** (read only, 2026-11-16):

1. **Today's route.** `handleNeighbors` (`src/api/concept-graph/index.js:107–139`) runs `MATCH (n {uuid: $handle})-[r]-(neighbor) WHERE NOT neighbor:NostrEventTag`:
   - It is one undirected match and returns no direction.
   - It leaves out tag nodes (`:112`), and `handleSubgraph` does the same (`:184`).
   - It has no paging, and is `PUBLIC_READ` (`src/middleware/routeAccess.js:161`).
   - It stays as it is (D15).
2. **The relationships the graph holds.** The local graph has 9,549 nodes, every one with a tapestryKey, and 11,050 relationships of 16 types:

   | Type | Count | Who writes it |
   |---|---|---|
   | `TAGS` | 7,325 | the event-tagging pipeline |
   | `HAS_TAG` | 2,779 | to tag nodes |
   | `HAS_ELEMENT` | 527 | the class thread |
   | `IS_A_SUPERSET_OF` | 52 | the class thread |
   | eight types wiring a concept's header to its superset, core nodes and properties | 40 each | a concept's wiring |
   | `FOLLOWS` | 17 | the trust pipeline |
   | `AUTHORS` | 16 | the nostr import |
   | `REFERENCES` | 9 | the nostr import |
   | `ENUMERATES` | 5 | |

   A person's node gets one `FOLLOWS` for each account they follow (`src/pipeline/reconcile/processReconciliationQueue.js:166`), so one node can carry thousands of relationships.
3. **What a relationship records about itself.** Only three types record anything:
   - `TAGS`: `tagSlug`, `polarity`, `address`, `eventId`, `tagEventId`, `tagAddress`, `zLocal`, `zCanonical`, and `createdAt`, which is an INTEGER (`src/pipeline/tagging-edges/graph.js:46, 54`);
   - `REFERENCES` from a `b` tag: `source: 'b-tag'` (`src/api/neo4j/eventSync.js:312`);
   - `ENUMERATES`: `sourcePath`, `destinationPath`.

   The trust pipeline's `FOLLOWS`, `MUTES` and `REPORTS` carry a `timestamp` (`processReconciliationQueue.js:167`). No relationship records its author. The instance's own wiring records nothing on the relationship: the signing routes' `MERGE (a)-[:${relType}]->(b)` (`src/api/normalize/index.js:340–344`), the firmware install, and the new graph writes (`add-relationship.js:48–54`). Each new graph write records its admin in a change entry, which holds the keys it touched and has no relationships (`src/operations/changes.js:106`).
4. **Parallel relationships exist.** The tagging pipeline `CREATE`s one `TAGS` for each tag application. 92 pairs of nodes have more than one `TAGS` running the same way, up to 9. Nothing else in a row tells them apart: type, direction and both ends are the same.
5. **Tag nodes.** Two writers make them:
   - the nostr import, one `NostrEventTag` for each tag of an event, with `HAS_TAG` from the event's node (`eventSync.js:256–260`);
   - every write that makes a node with no event, the same way (`src/operations/catalog/graph/_eventless.js:44–49`, ADR 0016 Decision 1).

   A tag node has `type` and `value` and no name. The import's `e` and `a` tags also give their tag node a `REFERENCES` to the node they point at (`eventSync.js:262–288`). Today's route's test for a tag node is the label `NostrEventTag`.
6. **The read conventions** (`src/operations/reads.js`; ADR 0011 Decision 1):
   - C1, paging: `LIMIT_INPUT`, `CURSOR_INPUT`, `scopeOf`, `encodeCursor`, `decodeCursor(read, scope, cursor, isPosition)`, `pageOf`.
   - C2, the point of view: `POV_INPUT`, `resolvePov`, `trust(v)`, `trustParams`. `trust(v)` (`:145–150`) ends `WITH ${v}, coalesce(…) AS counts`, so it carries only the node it judges.
   - C3, a node: `NODE`, `nodeColumns(v)`, `nodeOf(row, own)`.
   - The relationship shape a write answers is `_nodes.js`'s `RELATIONSHIP`, `{ type, from, to }` (`:21–29`). `TYPE_PATTERN` (`:13`) admits a plain name only, which ADR graph-operations-foundation/0004 Decision 6 writes into Cypher's text in backticks.
7. **The driver's conversion.** `toJS` (`src/lib/neo4j-driver.js:153–186`) converts a Neo4j integer, a node, a relationship and every item of a list. It returns a map as it is, so an integer inside a map, such as a relationship's properties from `properties(r)`, stays a driver Integer. On the local graph, a `TAGS`' `createdAt` comes back from `properties(r)` as `{ low: 1789656766, high: 0 }`, and from `[k IN keys(r) | [k, r[k]]]` as `1789656766`. S3's shape (Decision 2), run read-only on the local graph, lists the relationship-type header's incoming relationships in type order, each with its `elementId`.
8. **Relationship ids.** Neo4j 5 gives each relationship an `elementId` (locally `5:<database id>:<n>`). It is stable while the relationship exists, and may be reused once it is deleted. Design doc D6 rejects Neo4j's internal id as a node's id.
9. **The fakes, as they are on staging.** `test/helpers/graphFake.js`'s `exec` (`:479–486`) sends every read that names a relationship to `pathCypherFake.js` with the repertoire `PATH_READ_TYPES` (`:312`). The path fake doesn't run three things these statements need:
   - a relationship with no type (`pathCypherFake.js:149`), or a type outside the repertoire (`:567`);
   - an undirected relationship (`:148`);
   - `elementId()`: its functions are `keys`, `head`, `size`, `coalesce`, `toString`, `toLower`, `labels` and `type` (`:37`).

   It does run directed matches, `OPTIONAL MATCH`, label tests, `CASE`, list comprehensions over `keys(r)` with `r[k]`, `count`, multi-key `ORDER BY` and a `LIMIT` written as a number. ADR 0011's traps still hold:
   - a read naming `HAS_ELEMENT` and `IS_THE_CONCEPT_FOR` with `{uuid: $…}` goes to story 4's declared-types reader;
   - an alias that spells a write's word, such as `AS set`, is taken for a write.
10. **The operations module.** `checkInputs` (`src/operations/inputs.js`) compiles each declaration's inputs with Ajv, so `enum` works, and query inputs are coerced from text. A refusal thrown with a declared code comes back at its status, with `input` in the body. Suites under `test/operations/` are found and run by `test/operations.test.js`.

## Options considered

### Option A — Each direction read in statements of its own, out before in, with the relationship conventions in `reads.js` (chosen)

`reads.js` gains two conventions:
- **C5:** how a relationship is answered.
- **C6:** how a point of view judges one. `trust` learns to carry the relationship it judges.

`list-relationships.js` reads the node, then for each direction asked for runs one statement for the counts and one for the page:
- outgoing as `(x)-[r]->(m)`;
- incoming as `(x)<-[r]-(m)`.

Pages run the outgoing relationships first, then the incoming.

- **Pros:**
  - Each statement is directed, so the direction comes from the statement and never from an engine detail.
  - A relationship from the node to itself is matched by both directions. The incoming statement leaves it out under `both`, so it is answered once (AC3).
  - The path fake runs directed statements now. It needs untyped relationships and `elementId()` only.
  - AC7 holds in code: walk and describe-node import C5 and C6, as list-elements' successors import C1–C3.
- **Cons:**
  - With `both`, a page reads up to six statements: the scores, the node, two counts and one or two pages.
  - "Out before in" splits one type's relationships into two runs.

### Option B — One undirected statement, its direction read from each relationship's start

`MATCH (x)-[r]-(m)` returns `CASE WHEN startNode(r) = x THEN 'out' ELSE 'in' END`, so one count statement and one page statement serve every direction. The order is type first, then direction, so one type's relationships sit together.

- **Pros:** fewer statements per page, and each type's relationships in one run.
- **Cons:**
  - Whether a loop comes back once or twice from an undirected match is an engine detail. AC3's "exactly once" would rest on it.
  - The fakes would need undirected patterns and `startNode()` on top of what Option A needs.
  - `direction=out` and `in` still need statements of their own, so the saving is only on `both`.

### Option C — Build `graph walk`'s engine now, and make this read a walk of one hop

The catalog calls list-relationships "a particular walk" (§1).

- **Pro:** one engine for every relationship read.
- **Con:** walk's own questions are A10.14's: several types, several starts, a depth, paths in the answer, and an order across hops. Settling them here widens the story well past its criteria, as ADR 0011 found for list-elements (its Option C).

**Smaller choices inside Option A, with what was turned down:**
- **Order.** Outgoing first, then incoming. Within a direction, the order is by type, then the other node's tapestryKey, then the relationship's `elementId`. Each of these is fixed for a relationship's whole life, so a cursor holding the four is exact (AC3).
  - Turned down: the other node's key first, which scatters one type's relationships through the list.
  - Turned down: name order, which changes and isn't unique (ADR 0011).
- **Telling parallel relationships apart.** `elementId(r)` is the last sort key. It is held inside the cursor and never answered, since D6 rejects an internal id as identity and a cursor is only a position. A reused id can only put a new relationship at a dead one's place, which moves no other.
  - Turned down: one entry for each type, direction and other node, with a count. That would merge the tags one person applied to another, which AC2 lists one by one.
- **The type in the text.** A `type` reaches Cypher in backticks, after `TYPE_PATTERN`, as ADR 0004 Decision 6 writes one.
  - Turned down: a `type(r) = $type` filter. Neo4j would then read every relationship of a dense node and drop most. With the type in the pattern, it reads only that type's.
- **What a relationship records about itself** comes back as a list of `[key, value]` pairs, `[k IN keys(r) | [k, r[k]]]`, and becomes a map in JavaScript, keys sorted.
  - Turned down: `properties(r)`, whose map `toJS` returns unconverted, so `TAGS`' `createdAt` would arrive as a driver Integer (Context 7).
- **Which nodes are tag nodes.** A node labelled `NostrEventTag`, as today's route reads it (Context 1, 5). With no type, the answer counts the relationships it left out to them as `tagsLeftOut`, apart from `leftOut`, which is the point of view's.

## Decision

We chose **Option A**. It is the only option whose directions come from the statements themselves, so AC3's "exactly once" holds for a relationship from a node to itself without leaning on an engine detail. It puts the relationship conventions in code beside C1–C3, which AC7 asks of a first relationship read. Its cost is one or two more statements per page under `both`, and the live check measures them.

### 1. The relationship conventions, in `src/operations/reads.js`

These join C1–C3, and like them they open nothing at load.

**C5. A relationship, answered.** Every read that answers a relationship gives it as `RELATIONSHIP`:

```js
{
  type: 'HAS_ELEMENT',        // its type
  direction: 'out',           // 'out' when it runs from the node the read is about, 'in' when it runs to it
  from: '<tapestryKey>',      // the node it runs from
  to: '<tapestryKey>',        // the node it runs to: with type, the three `graph remove-relationship` takes
  node: NODE,                 // the node at its other end, answered as C3
  properties: { },            // what it records about itself, keys sorted; {} for most
}
```

- **The node a read is about.** It is what the read's input names: for list-relationships, `node`. For walk, it is the node a step starts from.
- **A relationship from a node to itself** has `from` and `to` alike. A read that lists both directions answers it once, as `out`, and as `in` only when only `in` is asked for.
- **`properties`** holds the relationship's own properties, each value as `toJS` gives an item of a list: an integer as a number, a list item by item. A read may add facts of its own beside these six, never rename or drop one, as with C3.
- **The code.** `relationshipColumns(r, m)` gives the `RETURN` items: `type(r) AS type, elementId(r) AS rid, [k IN keys(r) | [k, r[k]]] AS properties`, then `nodeColumns(m)`. `rid` stays inside the read, for its cursor. `relationshipOf(row, { key, direction, own })` builds the answered relationship: `from` and `to` from the node's `key` and the row's `tapestryKey`, by `direction`, and `node` from `nodeOf(row, own)`.

**C6. A relationship, from a point of view.** No relationship records its author (Context 3), so a relationship counts when the node at its other end counts by C2's test. That node:
- has no author; or
- its author is one of `own`; or
- its author's influence is above the cutoff; or
- the point of view is `everyone`.

The node the read is about is never left out: the answer gives it whatever its author, since the caller named it. That rule covers walk's start nodes too. A relationship from the node to itself is judged by that node, as any relationship is by its other end.
- **`trust(v, keep)`** gains an optional list of variable names it carries through its `WITH`: `WITH <keep…>, v, coalesce(…) AS counts`. A relationship read writes `trust('m', ['r'])` and keeps the relationship it judges. Each name in `keep` must be a Cypher variable name, or `trust` throws, as it does for `v`. `trust('e')` is unchanged, so list-elements doesn't change.
- **What a later story changes.** When relationships come to record who made them (provenance, design doc §5, question 2), C6 widens to judge that author as well, in `reads.js`, and callers stay as they are.
- **For walk:** a walk follows a relationship only to a node its point of view counts. The catalog's §1 sentence, "A walk follows only the edges whose authors its point of view trusts", changes to say so (Decision 3).

**What C5 and C6 don't settle:** a walk's paths, its order across hops, and whether walk leaves out tag nodes. Those are A10.14's. The reasons this ADR gives for leaving tag nodes out with no type (Decision 2) apply to walk too.

### 2. `graph list-relationships`, `src/operations/catalog/graph/list-relationships.js`

A read, `owner-and-admins`, declared with `run`.

**Inputs.**

| Input | Schema | Notes |
|---|---|---|
| `node` | `N.keyInput(…)`: a tapestryKey, required | the node whose relationships are listed |
| `type` | `{ type: 'string', pattern: N.TYPE_PATTERN }` | one type; listed whether the graph declares it or not |
| `direction` | `{ type: 'string', enum: ['out', 'in', 'both'], default: 'both' }` | |
| `pov` | `R.POV_INPUT` | `owner` by default |
| `limit` | `R.LIMIT_INPUT` | |
| `cursor` | `R.CURSOR_INPUT` | |

**Refusals** (its own, beside the built-in `missing-input`, `invalid-input` and `unknown-input`):

| Code | Status | When |
|---|---|---|
| `unknown-node` | 404 | `node` names no node of the graph (a change entry is not one); `input: 'node'` |
| `unknown-pov` | 400 | from C2 |
| `invalid-cursor` | 400 | from C1 |

**`run`, in order:**
1. Check `limit` again, as list-elements does.
2. Resolve the point of view (C2), which may refuse `unknown-pov`.
3. Compute the scope from `[node, type or null, direction, pov.name]`, then decode the cursor if there is one. The cursor's position is `[direction, type, otherKey, rid]`, and it passes only when:
   - its direction is one this read lists: `out` or `in`, and only the one asked for unless `direction` is `both`;
   - its type matches `TYPE_PATTERN`, and equals `type` when one is given;
   - its key matches `KEY_PATTERN`;
   - its `rid` is non-empty text.

   Anything else is refused `invalid-cursor`.
4. Read the node (S1). Refuse `unknown-node` when no row comes back.
5. For each direction asked for, out before in, read the counts (S2).
6. Read the page (S3) one direction at a time, out before in:
   - Skip any direction before the one the cursor lies in. Start the cursor's own direction from its position, and a later one from its start.
   - Each statement's `LIMIT` is the rows still wanted: `limit + 1` less the rows already read. The next direction runs only while rows are still wanted.
   - `pageOf` takes the joined rows.
7. Answer.

**The answer:**

```js
{
  node: NODE,                       // the node asked about, its five facts
  type: '<type>' | null, direction: 'both',
  pov: { name: 'owner', observer: '<hex>', cutoff: 0.05, scored: true },
  kept: 12, leftOut: 1,             // across the whole list, from S2: the point of view's
  tagsLeftOut: 6,                   // relationships to tag nodes left out because no type was given; 0 with a type
  relationships: [ RELATIONSHIP, … ],
  cursor: '<text>' | null,
}
```

As in list-elements, the counts and the page are read at their own moments. A write between them can make them differ by what it changed.

**The statements.** All are reads through `graph.read`. `<pattern>` is `(x:TapestryNode {tapestryKey: $key})-[r]->(m)` outgoing and `(x:TapestryNode {tapestryKey: $key})<-[r]-(m)` incoming. With a `type`, it is `[r:\`<type>\`]`, the checked name in backticks. The direction and the type choose the text, never anything else from input.

- **S1, the node** (no relationship, so `nodeCypherFake.js` runs it):

  ```cypher
  MATCH (n:TapestryNode {tapestryKey: $key})
  WHERE NOT n:GraphChange
  RETURN <nodeColumns(n)>
  ```

- **The shared filter, F:**

  ```cypher
  WHERE NOT m:GraphChange AND m.tapestryKey IS NOT NULL AND m.tapestryKey <> '{}'
    AND ($loops OR m.tapestryKey <> $key)
  ```

  - `$loops` is true except for the incoming statement under `both`, which then leaves out the node's relationships to itself, already answered as `out`.
  - A node at the other end with no tapestryKey, or with `'{}'`, is neither listed nor counted, as in list-elements. `lifecycle status` counts such nodes and `lifecycle migrate` keys them.

- **S2, the counts, for one direction:**

  ```cypher
  MATCH <pattern>
  <F>
  WITH r, m, (NOT $tags AND m:NostrEventTag) AS hidden
  <trust('m', ['r', 'hidden'])>
  RETURN count(CASE WHEN hidden THEN 1 END) AS tags,
         count(CASE WHEN NOT hidden THEN 1 END) AS seen,
         count(CASE WHEN counts AND NOT hidden THEN 1 END) AS kept
  ```

  - `$tags` is true when a `type` was given.
  - Summed over the directions: `kept`, `leftOut` (`seen - kept`) and `tagsLeftOut` (`tags`).

- **S3, the page, for one direction:**

  ```cypher
  MATCH <pattern>
  <F>
    AND ($tags OR NOT m:NostrEventTag)
    AND ($afterType IS NULL OR type(r) > $afterType
         OR (type(r) = $afterType AND (m.tapestryKey > $afterKey
             OR (m.tapestryKey = $afterKey AND elementId(r) > $afterRid))))
  <trust('m', ['r'])>
  WHERE counts
  RETURN <relationshipColumns(r, m)>
  ORDER BY type, tapestryKey, rid
  LIMIT <n>
  ```

  - `$afterType`, `$afterKey` and `$afterRid` come from the cursor's position when it lies in this direction, else null.
  - `<n>` is a checked whole number written into the text (C1).

**What it doesn't do:** it walks no further than one hop, takes one type at a time, and changes nothing. It lists no relationship to a node with no tapestryKey (the filter F).

### 3. Docs

- **`docs/GRAPH_OPERATIONS_CATALOG.md`, Conventions.** The "Every read" bullet gains two parts, in words, pointing to `reads.js` and this ADR:
  - **A relationship, answered** (C5).
  - **A relationship, from a point of view** (C6).
- **`docs/GRAPH_OPERATIONS_CATALOG.md`, §1.**
  - The `list-relationships` row's "Takes → returns" gives the inputs and the answer as built.
  - The closing sentence about walk becomes: "No relationship records its author yet, so a walk follows a relationship only to a node its point of view counts (the Conventions)."
- **No rule is added,** so `docs/GRAPH_RULES.md` is unchanged.

## Consequences

**What this enables**
- An agent sees what a node is wired to, and which way each relationship points, a page at a time and with no Cypher. It can pass any relationship it sees straight to `graph remove-relationship`.
- `graph walk` and `graph describe-node` answer and judge a relationship as this read does, by importing C5 and C6.
- When relationships come to record their authors, judging them changes in one place.

**What this constrains**
- Outgoing relationships come before incoming ones, and within each, types in name order. A read that wants another order says so in its own ADR.
- Every page counts the whole list again, as list-elements does. A dense node's page costs more than a sparse one's: on a node with thousands of relationships, each page reads them all for the counts. The live check measures it at 10,000.
- A cursor is tied to its node, type, direction and point of view.
- Under C6, a relationship to a trusted node counts whoever made it. It records no maker for a read to judge.

**Debt and follow-ups**
1. **Provenance.** When relationships record who made them (design doc §5, question 2), C6 widens to judge that too.
2. **BIBLE.** §11 gains the read, beside the neighbors row's warning, when the book closes (ADR 0011, debt 5).
3. **Several types at once, and more than one hop,** are walk's (A10.14).

**Firmware reinstall required?** No: no concept definition changes.

## Implementation notes

**New files**
- `src/operations/catalog/graph/list-relationships.js`: Decision 2. It takes `KEY_PATTERN`, `TYPE_PATTERN` and `keyInput` from `_nodes.js`, and C1–C6 from `reads.js`. It declares its own `unknown-node`, with this read's `when`.

**Changed files**
- `src/operations/reads.js`: Decision 1. It adds `RELATIONSHIP`, `relationshipColumns` and `relationshipOf`, and `trust`'s `keep`. Its header lists C5 and C6 beside C1–C3, and its exports add the three new names.
- `docs/GRAPH_OPERATIONS_CATALOG.md`: Decision 3.

**Not changed:**
- `list-elements.js`, `history.js` and `changes.js`;
- `_nodes.js` and `graph.js`;
- today's neighbors and subgraph routes;
- the external CLI.

**For the Tester** (Phase 3: these are the Tester's, not the Implementer's):
- **The fakes.** S2 and S3 name a relationship with no type, or with a type beyond `PATH_READ_TYPES`, and call `elementId()` (Context 9). The path fake needs three things:
  - an untyped `-[r]->` and `<-[r]-` that match every type;
  - a named type of any name in these statements;
  - `elementId()` of a relationship, as text, fixed for the relationship's life. Neo4j's form is `5:<database id>:<n>`.

  How `graphFake.js` lets these statements through without widening other suites' repertoire is the Tester's call. Today's limits stay as they are for the rest.
- **A seed of the Tester's own**, beside `test/helpers/elementsGraph.js`, can hold:
  - a node with outgoing and incoming relationships of several types;
  - parallel `TAGS` that differ only in their properties, one of them an integer;
  - a relationship from the node to itself;
  - tag nodes: `HAS_TAG` out, and an incoming `REFERENCES` from another node's tag node;
  - nodes at the other ends by the assistant, the owner, no author, a peer scored above the cutoff, a peer below it, and a peer with no `NostrUser`;
  - a node at the other end with no tapestryKey, and one keyed `'{}'`;
  - a change entry;
  - enough relationships to fill three pages in each direction.
- **The suite** goes through the operations harness, under `test/operations/graph/`. It covers:
  - AC1 to AC6;
  - paging across harness runs, with the state changed between runs to add and remove relationships, parallel ones included;
  - a page that spans from the outgoing relationships to the incoming;
  - a relationship from the node to itself under each `direction`;
  - `tagsLeftOut` with and without a type;
  - `scored` false;
  - every refusal, and cursors from list-elements, from another node, another type, another direction and another point of view;
  - the route and the command answering alike;
  - a read that writes nothing.
- **`reads.js`'s new parts,** tested directly:
  - `relationshipOf` for each direction and for a loop;
  - `trust` with `keep`, and its refusal of a name that isn't a variable;
  - `relationshipColumns`.
- **An agent suite** through the external CLI, on the model of `test/operations/graph/list-elements-agent-through-cli.test.js`, in a new file.
- **Running only these suites.** Run the new suites alone, plus `test/operations/reads.test.js` and list-elements' suites, which `trust`'s change touches. The full `npm test` writes to the local stack, so it never runs on a machine whose stack holds live data.

**The live check** runs on a scratch stack (`scripts/scratch-stack.sh`), never on the agent-memory instance:
1. Copy the branch in as list-elements' check did (its story's Evidence), and link `tapestry`.
2. Make a concept with `graph create-concept`, and relationships between its nodes with `graph add-relationship` after declaring a type.
3. Import a peer's event signed by a throwaway key, and give the owner a few `TAGS` with Cypher, two between the same pair.
4. List a header with each `direction`, with and without `type`, and with `type=HAS_TAG`.
5. Set the peer's influence above the cutoff and then below it, and list after each. `kept` and `leftOut` must follow, with no write.
6. Give one node 10,000 relationships with Cypher, page through them all at 50 and at 200, check each comes once, and time a page and its counts.
7. Check that the relay's event count and the number of `GraphChange` nodes are unchanged.
8. Do it again as an admin agent with its own key, through the external CLI.

**Branches.** A new feature, for `staging` only. It reaches `main` through the normal promotion. No long-lived sandbox branch needs a port.

## Out of scope

- Everything the story leaves out: several types at once, more than one hop, more facts about the nodes, naming a node by name or slug, other points of view, visitors' reads, and today's neighbors route.
- Recording who made a relationship, and judging it by that (Consequences, debt 1).
- An order the caller chooses.
- Indexes. The live check says whether a dense node needs anything beyond Neo4j's per-type relationship groups.
