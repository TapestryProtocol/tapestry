# ADR 0011: `graph list-elements`, and the conventions every graph read follows — pages in tapestryKey order with a cursor bound to its list, the owner's point of view as a filter inside the query, and one shape for a node

**Status:** Accepted
**Date:** 2026-11-15
**Story:** `engineering-team/stories/graph-operations-first-slice/11-list-elements.md`

## Context

The story (Loom A10.11) asks for one graph read and the conventions every later read follows. Its criteria, in short:

- **AC1** — `GET /api/tapestry/graph/list-elements` lists a concept's elements (`concept`, a header's tapestryKey: every node its class thread reaches, each once), or a set's (`set`, a set's or a superset's tapestryKey: its own and those of the sets below it). `direct=true` keeps only those directly under the superset or the set. The answer names what it listed and the point of view.
- **AC2** — each element comes with its tapestryKey, name, nostr address, author, and whether it is the instance's own.
- **AC3** — pages of at most `limit` (1–200, 50 by default) in a stable order, with a cursor that is null on the last page. Paging answers every element exactly once, and an element added or taken out between pages moves no other. A cursor this read didn't give, for the same list, is refused.
- **AC4** — the owner's point of view by default. An element counts when its author is the instance's own, or scored by the owner's web of trust above the verified cutoff. The answer says how many were kept and how many left out, across the whole list, and says when the owner's scores don't exist yet. `pov=everyone` keeps everything. Nothing about a point of view is stored. Any other `pov` is refused.
- **AC5** — refusals for neither or both of `concept` and `set`, a key that names no node, the wrong kind of node (a header given as `set` is told to pass it as `concept`), and malformed or unknown inputs.
- **AC6** — it writes nothing; 401 and 403 for everyone but the owner and admins; listed for agents, in `/docs`, and run by `tapestry graph list-elements`; an admin agent uses it through the external CLI on a scratch stack.
- **AC7** — paging, the point of view and a node's shape are each defined once, written into the catalog's Conventions for A10.7–A10.14, and `graph history` is left as it is.

The owner settled the story's three questions (2026-11-15): `pov` is the owner's (the default) or `everyone`, and any other is refused for now; from the owner's point of view, the instance's own always count and anyone else counts when GrapeRank scores them above `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`, admins by score like anyone else; and a node is answered with its tapestryKey, name, address, author and whether it is the instance's own.

**Orientation.** The local instance's `/api/concept-graph/summaries` (read only, 2026-11-15) lists `39998:<TA>:class-thread`, `…:concept-header` (40 elements), `…:superset` (31), `…:set` (102), `…:nostr-user` (none: the trust pipeline's `NostrUser` nodes aren't wired as its elements), `…:graperank` and `…:web-of-trust`. `GET /api/concept-graph/node/39998:<TA>:class-thread` describes the pattern this read follows: "ConceptHeader –[IS_THE_CONCEPT_FOR]→ Superset –[IS_A_SUPERSET_OF]→ (0 or more Supersets/Sets) –[HAS_ELEMENT]→ Elements". No concept changes here.

**Facts from the code.**

1. **The read before it.** `graph history` (`src/operations/catalog/graph/history.js`) is a `run` declaration that reads through `graph.read` and never opens a write transaction. Its paging is `readHistory` in `src/operations/changes.js:143–171`:
   - `limit` is an integer from 1 to 200, 50 by default.
   - The query fetches `limit + 1` rows, with the checked number written into its text (`:166`), because the driver sends a JavaScript number as a float.
   - The cursor is the base64url of `[at, tapestryKey]` of the page's last entry (`:125–135`), and anything else is refused `invalid-cursor` (400).
   - The cursor names no list: one from a filtered page, passed to an unfiltered one, starts mid-list without complaint.
   - `changes.js` is story 16's session's to change; nothing here edits it.
2. **The class-thread walk.** `elementsOf` in `src/operations/catalog/graph/_fields.js:223–247` reads a concept's elements as `(h)-[:INIT]->(:Superset)-[:PROP*0..]->()-[:TERM]->(e)`, then `WITH DISTINCT e`, from a header found by tapestryKey with `h:ConceptHeader OR h:ListHeader`. Its relationship types come from `firmware.relAlias('CLASS_THREAD_INITIATION' | 'CLASS_THREAD_PROPAGATION' | 'CLASS_THREAD_TERMINATION')` (`:44–54`). It returns the field mapping's JSON and copies, and has no paging, order or point of view. Implicit members, nodes that only name the concept in a `z` tag, join once wired (ADR graph-operations-foundation/0005, Context 11).
3. **Kinds of node.** Story 28's ADR reads a set as a node labelled `Set` and not `Superset`, and a superset as a node labelled `Superset` (ADR graph-operations-first-slice/0028, Decision 5; the citation corrected, and the reading refined, by Amendment 2 below). Its refusals are `unknown-node` (404) and `not-a-set` (409), and a header given as a set is told which key to pass. The field mapping reads a concept header as a node labelled `ConceptHeader`, or `ListHeader` for one the nostr import brought in (ADR 0005, Decision 5).
4. **Authors.** A node records its author as `pubkey`:
   - the event's author, for a node the nostr import made (`buildImportCypher`, `src/api/neo4j/eventSync.js:215–218`);
   - the assistant's, for nodes from today's signing routes, from add-subset, and from the new graph writes (ADR 0016, Decision 1).

   Every element writer in `src/` today writes from a signed event or as the assistant, so a node with no `pubkey` was made here by some older path. "Own" means the assistant's (`getOwnerAssistantPubkey()`, `src/utils/assistantKeys.js:49`) or the owner's (`getOwnerPubkey()`, `src/utils/config.js:96`), as in ADR 0028 Decision 7.
5. **The owner's point of view is in Neo4j** (BIBLE §27, the Owner row):
   - GrapeRank's `influence` is on each `NostrUser` node. `pubkey` is unique there and `influence` is indexed (`setup/neo4jConstraintsAndIndexes.sh:50, 54`).
   - The verified-follower list compares `follower.influence > <cutoff>` (`src/api/grapevineInteractions/queries/followersWithMetrics.js:95`). Its cutoff is `getConfigFromFile('VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF', '0.05')` (`:27`), read once at load, as every JS reader of it does (`cypherQueries.js:10`, `ownerInfo.js:22`).
   - `getConfigFromFile` reads `brainstorm.conf`, and falls back to sourcing it with bash before the default (`src/utils/config.js:17–75`). The template sets the value in `graperank.conf` (`config/graperank.conf.template:76`), which the owner's count scripts source. So the API's readers use 0.05 wherever `brainstorm.conf` doesn't also carry it: an existing difference this ADR doesn't change.
   - Each customer's scorecards are `NostrUserWotMetricsCard {observer_pubkey, observee_pubkey, influence}`, unique and indexed on the pair (`:64`). They are deferred by the owner's answer.
6. **Today's point-of-view code is Meilisearch's.** `resolvePov` in `src/api/_shared/pov.js:49` resolves `wotPov=house|user` to a delegate's `wot_rank_<suffix>` columns in Meilisearch. The event-tag reads filter on them (`src/api/event-tags/index.js:119–139`) and report `povResolution`. None of it reads the graph's own scores.
7. **The operations module.** `callOperation` (`src/operations/index.js:132–166`) checks the inputs, then calls `run(inputs, context)`. A refusal thrown with a declared code comes back at its status, with its `extra` fields (`input`) in the body; an undeclared code becomes a 500. Query and command inputs are coerced from text, so `"true"` becomes true and `"5"` becomes 5, and defaults apply (`src/operations/inputs.js:11`). Each declaration's file opens nothing at load (ADR 0001, Decision 10).
8. **The fakes, as they are on staging.** The stack-free suites run statements through `test/helpers/graphFake.js`. Its `exec` (`:375–388`) routes them:
   - a read with no relationship goes to `nodeCypherFake.js`: one `MATCH` of one node, `WHERE`, `WITH`, `RETURN`, label tests, `IN`, `coalesce`, `count`;
   - a read that names a relationship goes to `pathCypherFake.js`: `MATCH` and `OPTIONAL MATCH`, `WITH [DISTINCT] … WHERE`, `ORDER BY` by alias or variable, `LIMIT` written as a number, `CASE`, `coalesce`, `count` of non-null values. It reads paths over seven types only (`:298`), among them `IS_THE_CONCEPT_FOR`, `IS_A_SUPERSET_OF` and `HAS_ELEMENT`.

   Two traps:
   - a read that names `HAS_ELEMENT` and `IS_THE_CONCEPT_FOR` and finds a node by `{uuid: $…}` goes to story 4's declared-types reader instead (`:300–302`);
   - a read whose text has a write's word outside a label, property or parameter, such as an alias `AS set`, is taken for a write and refused (`:76–79`).

   Story 16's session owns those files and is adding to them, so this ADR's statements fit them as they are.
9. **Today's subgraph route** (`src/api/concept-graph/index.js:160–215`) follows every relationship type from a node's address, at most three levels out, with no paging and no point of view. It stays as it is (D15).
10. **The external CLI** sends a read's flags as the query string, as text, with `true` for a flag given with no value (`clients/cli/src/operations.js:110–147`), so `--direct` and `--cursor <text>` need no change to it.

## Options considered

### Option A — One module of read conventions, and a declaration that reads the class thread in two statements of its own (chosen)

`src/operations/reads.js` holds what every read shares, defined once:
- the paging inputs and a cursor bound to the read and the list it pages;
- the `pov` input, its resolution, and the trust test as a fragment of the read's own Cypher;
- the node's shape, as a schema and as the columns a query returns.

`list-elements.js` uses it, with two reads of the class thread: one for the counts and one for the page.

- **Pros:**
  - AC7 holds in code, not only in prose: a later read imports the same inputs, cursor, trust fragment and node shape, so the reads can't drift apart.
  - The trust test runs inside Neo4j, at read time, over raw claims (each element's `pubkey`) and the owner's scores, so nothing per point of view is stored (CLAUDE.md, principles 1–3).
  - A page returns at most `limit + 1` rows.
- **Cons:**
  - Each page walks the class thread twice, once for the counts and once for the page.
  - A new shared module that later reads depend on, so a change to it is a change to every read.

### Option B — The conventions in the catalog's prose only, each read writing its own

`list-elements.js` holds its own cursor, trust filter and answer shape. The catalog's Conventions describe them, and each later read follows the text.

- **Pros:** one file for this story, and no module shared between sessions working on different reads at once.
- **Cons:**
  - Eight reads would each write their own cursor and trust filter, and the first difference between two of them becomes the convention by accident.
  - AC7's "each defined once" would be met only in the docs.

### Option C — Build `graph walk` first, and make list-elements one of its presets

The catalog calls list-elements "a particular walk" (§1). Build walk's engine now (relationship types, direction, depth, a point of view per edge), and declare list-elements as a walk from the header along the class thread.

- **Pros:** one engine for list-elements, class-thread-path, list-relationships and walk.
- **Cons:**
  - Walk's own questions (which types, which direction, paths in the answer, whose edges count) are A10.14's, and settling them here widens this story well past its criteria.
  - A path-shaped engine also has to answer list-elements' counts and its kept and left-out numbers.

**Smaller choices inside Option A, with what was turned down:**
- **Order.** tapestryKey order, chosen over name order. A name can change between two pages, which would show that element twice or not at all, and two elements can share a name. Name order also needs a case-insensitive sort, which the fakes don't run yet. A tapestryKey never changes and is unique, so a cursor that holds the last key is exact (AC3).
- **Filtering where?** Inside the query, chosen over reading every element and filtering in JavaScript. The JavaScript way returns every element on every page.
- **What a cursor names.** The read and its list, chosen over a bare position, which is history's. A bare position lets a cursor from Dogs page Cats without complaint.

## Decision

We chose **Option A**. It is the only one that defines the conventions once in code, which is what AC7 asks of a first read, and it keeps the trust test at read time inside the query (principles 1–3). Its cost is a second walk of the class thread per page, and the live check measures it.

### 1. The read conventions, `src/operations/reads.js`

The module opens nothing at load. It requires the config, the assistant's key and the firmware aliases when first called (ADR 0001, Decision 10).

**C1. Paging.** Every read that answers a list follows this:
- **Inputs.** It takes `limit`, `LIMIT_INPUT` (`{ type: 'integer', minimum: 1, maximum: 200, default: 50 }`), and `cursor`, `CURSOR_INPUT` (`{ type: 'string', minLength: 1 }`). It answers its items and `cursor`, null on the last page.
- **Order.** Items come in an order that never changes for an item: tapestryKey ascending, unless the read is about time (history, newest first).
- **The query** fetches `limit + 1` rows, with the checked whole number written into its text. `pageOf(rows, limit, cursorOf)` returns `{ items, cursor }`: the first `limit` rows, and `cursorOf(the last of them)` when more came back, else null.
- **The cursor** is the base64url of JSON `[read, scope, position]`:
  - `read` is `'<group> <name>'`;
  - `scope` is the first 16 hex characters of the sha256 of the JSON of the inputs that choose the list, in a fixed order the read gives, never `limit` or `cursor`;
  - `position` is the last item's sort key.
- **Encoding and refusing.** `encodeCursor(read, scope, position)` makes it. `decodeCursor(read, scope, cursor, isPosition)` returns the position, or throws `invalid-cursor` (400, `input: 'cursor'`) when the text doesn't parse, or names another read, another list or a position that isn't one. Its message says to leave the cursor out to start again. `INVALID_CURSOR` is the refusal to declare.
- **What it promises.** A cursor positions within a list the caller may read anyway, so it needs no signature. Every value reaches Cypher as a parameter.

**C2. The point of view.** Every read that can include other authors' nodes follows this:
- **The input.** It takes `pov`, `POV_INPUT`: `{ type: 'string', pattern: '^(owner|everyone|[0-9a-f]{64})$', default: 'owner' }`. A malformed value is the built-in `invalid-input`.
- **Resolving it.** `resolvePov(read, value)` returns:
  - for `owner`, or the owner's own pubkey: `{ name: 'owner', observer: <the owner's pubkey>, own, cutoff, scored }`;
  - for `everyone`: `{ name: 'everyone', observer: null, own, cutoff: null, scored: null }`.

  Any other pubkey throws `unknown-pov` (400, `input: 'pov'`). Its message says that this instance reads from its owner's point of view or from everyone's, and that other points of view are to come. `UNKNOWN_POV` is the refusal to declare.
- **The values.**
  - `own` is `ownKeys()`, the assistant's and the owner's pubkeys, without nulls.
  - `cutoff` is `Number(getConfigFromFile('VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF', '0.05'))`, read once and kept, as the verified-follower list does. A value that isn't a finite number reads as 0.05.
  - `scored` comes from one read, `MATCH (u:NostrUser) WHERE u.influence IS NOT NULL RETURN u.pubkey AS pubkey LIMIT 1`: true when a row comes back. It is made for the `owner` point of view only.
- **What counts.** A node counts when any of these holds:
  - the point of view is `everyone`;
  - the node has no author, which means some older path made it here (Context 4);
  - its author is one of `own`;
  - its author's `NostrUser.influence` is above `cutoff`.

  An admin's key counts by score, like anyone's. `trust(v)` gives the fragment for node variable `v`, with `$everyone`, `$own` and `$cutoff` as parameters:

  ```cypher
  OPTIONAL MATCH (u_v:NostrUser {pubkey: v.pubkey})
  WITH v, coalesce($everyone OR v.pubkey IS NULL OR v.pubkey IN $own OR u_v.influence > $cutoff, false) AS counts
  ```

  (`u_v` stands for `u_` plus the variable's name.) A missing `NostrUser`, or one with no influence, leaves the test false through Cypher's null logic, and `coalesce` makes that explicit.
- **Nothing is stored.** The same graph, read from another point of view or after GrapeRank writes new scores, answers differently with no write between.
- **The answer** carries `pov`, schema `POV`: `{ name, observer, cutoff, scored }`.
- **What a later story adds.** A story that adds observers, such as a customer's scorecards on `NostrUserWotMetricsCard`, or BIBLE §27's House or Personalized points of view, widens `resolvePov` and `trust` and leaves callers as they are.

**C3. A node, answered.** Every read that answers a node gives it as `NODE`: `{ tapestryKey, name, address, author, own }`.
- `name` is `coalesce(v.tapestryValue, v.name)` (D11).
- `address` is `v.uuid`: the nostr address `kind:pubkey:d-tag`, or the event id, as the graph records it. These are the names ADR 0016 uses.
- `author` is `v.pubkey`.
- `own` is true when `author` is null or one of `own`.

`nodeColumns(v)` gives the `RETURN` items, `<v>.tapestryKey AS tapestryKey, coalesce(<v>.tapestryValue, <v>.name) AS name, <v>.uuid AS address, <v>.pubkey AS author`. `nodeOf(row, own)` builds the answered node. A read may add facts of its own beside these five, as `describe-node` will, but never renames or drops one.

**C4. Where reads sit.** Every read is `access: 'owner-and-admins'`, until read visibility is decided (catalog §10, question 1; the book's frame). A read uses `graph.read` and never `writeTransaction`, so it records no change entry.

**`graph history`** keeps its own cursor, which predates C1 and names no list. It already agrees with C1's inputs, its null last cursor and its refusal code. Changing it would mean changing `changes.js`, and the story leaves it as it is.

### 2. `graph list-elements`, `src/operations/catalog/graph/list-elements.js`

A read, `owner-and-admins`, declared with `run`.

**Inputs.**

| Input | Schema | Notes |
|---|---|---|
| `concept` | tapestryKey (`KEY_PATTERN`) | a concept header's |
| `set` | tapestryKey | a set's or a superset's |
| `direct` | boolean, default false | only the elements directly under the superset or set |
| `pov` | `POV_INPUT` | `owner` by default |
| `limit` | `LIMIT_INPUT` | |
| `cursor` | `CURSOR_INPUT` | |

**Refusals** (its own, beside the built-in ones):

| Code | Status | When | Its message |
|---|---|---|---|
| `concept-or-set` | 400 | neither `concept` nor `set`, or both | give one |
| `unknown-node` | 404 | the key names no node of the graph (a change entry is not one); `input` names which | |
| `not-a-concept` | 409 | `concept` names a node that isn't labelled `ConceptHeader` or `ListHeader` | for a set or a superset, to pass it as `set` |
| `not-a-set` | 409 | `set` names a node labelled neither `Set` nor `Superset` | for a concept header, to pass it as `concept`, and names its superset's tapestryKey as the other key to pass |
| `unknown-pov` | 400 | from C2 | |
| `invalid-cursor` | 400 | from C1 | |

**`run`, in order:**
1. Refuse `concept-or-set` unless exactly one of `concept` and `set` is given.
2. Resolve the point of view (C2), which may refuse `unknown-pov`.
3. Compute the scope from `[concept or null, set or null, direct, pov.name]`, then decode the cursor if there is one. Both checks run before the graph is read.
4. Read the node (L1). Refuse `unknown-node` when there is no row, and `not-a-concept` or `not-a-set` for the wrong kind. For a header given as `set`, also read its superset (L2), so the message can name it.
5. For `owner`, read `scored` (C2).
6. Read the counts (L3), then the page (L4).
7. Answer.

**The answer:**

```js
{
  concept: '<key>' | null, set: '<key>' | null, direct: false,
  pov: { name: 'owner', observer: '<hex>', cutoff: 0.05, scored: true },
  kept: 946, leftOut: 12,           // across the whole list, from L3
  elements: [ NODE, … ],            // this page
  cursor: '<text>' | null,
}
```

`kept` and `leftOut` are read in one statement and the page in another, each at its own moment. A write between the two can make them differ by what that write changed.

**The statements.** All are reads through `graph.read`, with the class-thread types from `firmware.relAlias(…)` as `_fields.js` takes them (INIT, PROP, TERM). Never use `{uuid: $…}` in them, nor an alias that spells a write's word, such as `set` (Context 8).

- **L1, the node:**

  ```cypher
  MATCH (n:TapestryNode {tapestryKey: $key})
  WHERE NOT n:GraphChange
  RETURN n.tapestryKey AS key, n:ConceptHeader OR n:ListHeader AS isHeader, n:Superset AS isSuperset, n:Set AS isSet
  ```

- **L2, a header's superset** (only on `not-a-set`):

  ```cypher
  MATCH (h:TapestryNode {tapestryKey: $key})-[:INIT]->(s:Superset)
  RETURN s.tapestryKey AS key
  ORDER BY key
  LIMIT 1
  ```

- **The walk,** from one of four fixed texts, chosen by `[concept or set, direct]` and never built from input. Each finds its start by tapestryKey:
  - a concept, all: `MATCH (h:TapestryNode {tapestryKey: $key}) WHERE h:ConceptHeader OR h:ListHeader MATCH (h)-[:INIT]->(:Superset)-[:PROP*0..]->()-[:TERM]->(e)`;
  - a concept, direct: the same, with `-[:INIT]->(:Superset)-[:TERM]->(e)`;
  - a set, all: `MATCH (s:TapestryNode {tapestryKey: $key}) WHERE s:Set OR s:Superset MATCH (s)-[:PROP*0..]->()-[:TERM]->(e)`;
  - a set, direct: the same, with `(s)-[:TERM]->(e)`.

- **L3, the counts:**

  ```cypher
  <walk>
  WITH DISTINCT e
  WHERE e.tapestryKey IS NOT NULL
  <trust(e)>
  RETURN count(e) AS seen, count(CASE WHEN counts THEN 1 END) AS kept
  ```

  `leftOut` is `seen - kept`.

- **L4, the page:**

  ```cypher
  <walk>
  WITH DISTINCT e
  WHERE e.tapestryKey IS NOT NULL AND ($after IS NULL OR e.tapestryKey > $after)
  <trust(e)>
  WHERE counts
  RETURN <nodeColumns(e)>
  ORDER BY tapestryKey
  LIMIT <limit + 1>
  ```

  `$after` is the cursor's position, or null.

**What it doesn't do.** It lists no implicit member, since one isn't on the walk until wired (story's Out of scope). It lists no node without a tapestryKey: `lifecycle status` counts those, and `lifecycle migrate` gives them one. It changes nothing.

### 3. Docs

- **`docs/GRAPH_OPERATIONS_CATALOG.md`, Conventions.** The "Every read" bullet becomes C1–C4, in words, pointing to `src/operations/reads.js` and this ADR.
- **`docs/GRAPH_OPERATIONS_CATALOG.md`, §1's `list-elements` row.** Its "Takes → returns" gives the inputs and the answer as built.
- **No rule is added,** so `docs/GRAPH_RULES.md` is unchanged.

## Consequences

**What this enables**
- Each later read imports `reads.js`, and its answers page, filter and name nodes as this one does.
- An agent can list a concept's elements, a page at a time, from the owner's point of view or from everyone's, with no Cypher.
- Adding a point of view later is a change in `reads.js`, not in each read.

**What this constrains**
- Pages come in tapestryKey order, which looks random to a person. A read that wants another order says so in its own ADR.
- Every page walks the class thread twice, so a page's cost grows with the whole list, not with `limit`. The live check measures it at 10,000 elements. If it is too slow, the counts can move to the first page only, by a later ADR.
- A cursor is tied to its read, its list and its point of view. Changing any of them means starting again.

**Debt and follow-ups**
1. **The cutoff's two homes** (Context 5). The API reads `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` from `brainstorm.conf`, while the template and the owner's count scripts keep it in `graperank.conf`. An OPEN.md row records it, for whoever unifies the readers.
2. **Other observers.** Customers' scorecards, and BIBLE §27's House and Personalized points of view (§27, open question 5), are refused until a story adds them to `resolvePov` and `trust`.
3. **History's cursor names no list.** C1 is the convention, and history stays as it is until a change to `changes.js` is worth making for it.
4. **Implicit members** appear once `wire-implicit-elements` or a later `import nostr` (A10.32) wires them.
5. **BIBLE.** §27's "Status today" table gains the graph reads, and BIBLE §11 gains the conventions, when the book closes (design §8, step 4).

**Firmware reinstall required?** No: no concept definition changes.

## Implementation notes

**New files**
- `src/operations/reads.js`: Decision 1. It exports:
  - the inputs, `LIMIT_INPUT`, `CURSOR_INPUT` and `POV_INPUT`;
  - the refusals, `INVALID_CURSOR` and `UNKNOWN_POV`;
  - the schemas, `NODE` and `POV`;
  - the functions `encodeCursor`, `decodeCursor`, `scopeOf(parts)` (the 16 hex characters), `pageOf`, `resolvePov`, `trust`, `ownKeys`, `nodeColumns` and `nodeOf`.
- `src/operations/catalog/graph/list-elements.js`: Decision 2. It takes `KEY_PATTERN` from `_nodes.js` and the aliases from `firmware.relAlias`.

**Changed files**
- `docs/GRAPH_OPERATIONS_CATALOG.md`: Decision 3.
- `OPEN.md`: one row for Consequences' debt 1, the cutoff's two homes.

**Not changed:** `history.js`, `changes.js`, `_fields.js`, `_nodes.js`, `graph.js`, `src/api/_shared/pov.js`, the subgraph route, and every test helper story 16's session owns.

**For the Tester** (Phase 3: these are the Tester's, not the Implementer's):
- **The statements.** L1 to L4 and C2's scored read run on `graphFake.js`, `nodeCypherFake.js` and `pathCypherFake.js` as they are on staging (Context 8). A seed of the Tester's own, beside `test/helpers/fieldGraph.js`, can hold:
  - a concept with a superset, a set under it and a set under that;
  - elements at each level, one reached by two paths, and one directly under the superset;
  - elements by the assistant, the owner, an author with no `pubkey`, a peer scored above the cutoff, a peer below it, and a peer with no `NostrUser`;
  - an implicit member, a node of no concept, and enough elements to fill three pages.
- **The suite** goes through the operations harness, under `test/operations/graph/`. It covers:
  - AC1 to AC6;
  - paging across harness runs, with the state file changed between runs to add and remove elements, and to change a peer's influence;
  - `scored` false when no `NostrUser` has influence;
  - every refusal, and cursors from history, from another concept, from another point of view, and from the other `direct`;
  - the route and the command answering alike;
  - a read that writes nothing (the log shows reads only).
- **`reads.js`'s own functions,** tested directly: a cursor's round trip and each way one is refused; `resolvePov` for each value; `nodeOf`.
- **An agent suite** through the external CLI, on the model of `test/operations/graph/agent-through-cli.test.js`, in a new file.

**The live check** runs on a scratch stack (`scripts/scratch-stack.sh`), never on the agent-memory instance:
1. Copy the branch's `firmware/versions/v1.0.0/` and `bin/` in, link `/usr/local/bin/tapestry`, restart the control panel, and install the firmware.
2. Make a concept with sets and elements through today's routes, which sign; that is fine on a throwaway instance.
3. Import a peer's element, signed by a throwaway key, with a `z` tag naming the concept, and wire it with `wire-implicit-elements`.
4. Set the peer's `NostrUser.influence` with Cypher, above the cutoff and then below it, and list after each. `kept` and `leftOut` must follow, with no write by the read.
5. List with `pov=everyone`.
6. Seed 10,000 elements with Cypher, page through them all, check each comes once, and time a page.
7. Check that the relay's event count and the number of `GraphChange` nodes are unchanged.
8. Do it again as an admin agent with its own key, through the external CLI.

**Branches.** A new feature, for `staging` only. It reaches `main` through the normal promotion, and no long-lived sandbox branch needs a port.

## Amendment 1 (2026-11-15, at Test Design) — what the Tester's readings settle

The test plan (`engineering-team/stories/graph-operations-first-slice/11-list-elements.test-plan.md`) reads the decisions this way, and the suites hold the Implementer to it:

1. **The three inputs are input declarations.** `LIMIT_INPUT`, `CURSOR_INPUT` and `POV_INPUT` are each `{ schema, description }`, with the schemas C1 and C2 give. A read puts them into its `inputs` exactly as they are.
2. **The facts that can be missing are nullable.** In `NODE`, `name`, `address` and `author` are text with `nullable: true`, and `own` is a boolean. In `POV`, `observer`, `cutoff` and `scored` are nullable, and `name` is text.
3. **The answer's `pov` holds four facts:** `{ name, observer, cutoff, scored }`. The keys in `own` stay inside the read.
4. **The input not given is null in the answer.** A concept's listing answers `set: null`, and a set's answers `concept: null`.
5. **A superset given as `concept`** is refused `not-a-concept` with the same hint as a set: pass it as `set`.
6. **A cursor's position must pass the read's own test,** which for list-elements is a tapestryKey. A cursor whose position fails it, or whose JSON isn't three items long, is refused `invalid-cursor`.
7. **Only the owner's point of view reads the graph to resolve.** `everyone` resolves without a read.

## Amendment 2 (2026-11-16, at Implementation) — a set has an address

ADR 0028's Amendment 3 refines the reading of a set that Context 3 adopts, and passes it on to this ADR's readers. The owner approved it on 2026-11-15; when this was written, it was on branch `A10.28-link-unlink-set` at `f77faea7`.

**The refined reading:** a node counts as a set or a superset only when it has an address, its `uuid`.

**Why.** The trust pipeline's card sets, `Set:SetOfNostrUserWotMetricsCards`, are 370,377 of staging's 370,401 `Set` nodes. Each has a tapestryKey, but no address and no class-thread links (ledger `2026-11-15-card-sets-carry-the-set-label`).

**For list-elements:**
1. `set` must name a node labelled `Set` or `Superset` that has a `uuid`. Anything else is refused `not-a-set`. So a card set is refused, rather than answering an empty list.
2. The walk from a set starts only from such a node: the `set` walks of L3 and L4 add `s.uuid IS NOT NULL`.
3. `not-a-concept` gives its hint, "pass it as set", only for a set or a superset that has an address.
4. Context 3's citation of ADR 0028's reading is Decision 5, not Decision 4.

**What stays as it is.** The walk from a concept doesn't change: card sets have no class-thread links, so no walk reaches one. Concept headers are read as before.

## Amendment 3 (2026-11-16, at Review) — what review round 1 settled

Review round 1 (`engineering-team/reviews/graph-operations-first-slice/11-list-elements.md`) found these, and round 2's commits make them so:
1. **A key of `'{}'` is no key.** L3 and L4 leave out `e.tapestryKey = '{}'` wherever they leave out a null key. `'{}'` is the placeholder the codebase reads as no key (ADR graph-operations-foundation/0003). So such a node is neither listed nor counted, as Decision 2 already says of a node with no key, and no cursor can hold it.
2. **Both instance keys are read as events carry them.** `ownKeys` trims, lowercases and checks the assistant's key as well as the owner's. A key that isn't 64 hex characters is left out.
3. **The shared cursor refusal names no read's own inputs.** It says a cursor works only with the inputs that made it.
4. **Decision 2, step 3, as built.** Its last sentence, "Both checks run before the graph is read", holds for everyone's point of view only. For the owner's, `resolvePov` reads the scores (C2) as it resolves, before the cursor is decoded. A cursor that doesn't parse then costs one small read before its 400.
5. **Consequences, debt 1.** The cutoff's two homes are recorded by `engineering-team/stories/_intake.md`, 2026-06-06, item 2. That item notes a live `graperank.conf` of 0.01, so the verified counts and the API's lists may already disagree. The ledger row `2026-11-16-verified-cutoff-two-homes` is closed as its duplicate.

## Amendment 4 (2026-11-16, by ADR graph-operations-first-slice/0014) — a walk's order

C1 says items come in an order that never changes for an item. `graph walk` (Loom A10.14, story graph-operations-first-slice #14) answers nearest first: by how many steps a node is from a start node, then by tapestryKey. Its owner chose that at the story's gate (open question 2). A node's distance depends on the rest of the graph, so a change between two pages that brings a node nearer, or takes it further away, can move it:
- to a page already read, so it's missed;
- or to one still to come, so it shows twice.

Every node whose distance doesn't change is answered exactly once.
- C1's rule holds for every other read. Walk is the one exception, and ADR 0014 (Decision 4) names it.
- C1's paragraph in `src/operations/reads.js` and the catalog's Paging bullet say so.

## Amendment 5 (2026-11-17, by ADR graph-operations-first-slice/0008) — a search's order

C1 says items come in an order that never changes for an item. `graph search` (Loom A10.8, story graph-operations-first-slice #8) answers best first: a match that holds every word searched for, then the higher score, then the lower tapestryKey. Its owner chose that at the story's gate (open question 2). A match's score depends on the rest of the graph, such as how many nodes hold each word. So a change between two pages can change the score, and move a match:
- to a page already read, so it's missed;
- or to one still to come, so it shows twice.

Every match whose place doesn't change is answered exactly once.
- C1's rule holds for every other read. Walk (Amendment 4) and search are its two exceptions, and ADR 0008 (Decision 5) names search's.
- When search is built, C1's paragraph in `src/operations/reads.js` and the catalog's Paging bullet say so.

## Out of scope

- Everything the story leaves out: implicit members, other points of view, more about each element, naming by name or slug, an order the owner chooses, counts without a list, visitors' reads, today's subgraph route, and `graph history`.
- A read transaction that would read the counts and the page at one moment. It needs a new method on the graph seam and its fake, and the fakes are story 16's session's.
- Unifying the cutoff's two homes (Consequences, debt 1).
- Indexes for the walk. The live check says whether one is needed.
