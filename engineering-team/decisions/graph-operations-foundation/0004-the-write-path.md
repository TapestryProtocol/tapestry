# ADR 0004: The write path — each graph write's guards, change and change entry in one transaction, proved with `graph add-relationship`, `remove-relationship` and `history`

**Status:** Accepted
**Date:** 2026-11-14
**Story:** `engineering-team/stories/graph-operations-foundation/4-the-write-path.md`

## Context

The story asks for the path every graph write takes, proved by three operations (AC1–AC7). A write runs its guards and refuses what breaks one, before anything changes (AC2). It is safe to repeat (AC1, AC3). It records one change entry, kept together with the change: both or neither (AC4). It takes JSON only and signs nothing (AC6). `graph history` reads the entries back, newest first, by node, by who made them and since a time. The entries are kept with the graph, so a backup carries them and a restore keeps history in step with the graph (AC5; the owner's answer to open question 5). Each rule is defined once, so `rules check` (A10.31) can use it later (D3).

What the code offers today:

1. **The declaration** (ADR 0001 Decision 2). A declaration is a plain object with `run(inputs, context)`. `callOperation` in `src/operations/index.js` checks the inputs, calls `run`, and maps a thrown `refusal(code, message)` to its declared status. JSON bodies are checked without coercion (Decision 5). The loader, the route, the command, `/docs` and the list are all made from the declaration. Nothing in it knows about guards, transactions or change entries.
2. **Neo4j access.** `src/lib/neo4j-driver.js` has `runCypher`, `writeCypher` and `streamCypher`, and each runs one auto-commit statement (`session.run`). Nothing runs several statements in one transaction. The driver is `neo4j-driver` 5.28, whose `session.executeWrite(work)` runs `work` in one transaction and runs it again on a transient error, such as a deadlock. Lifecycle reaches the graph through `src/operations/catalog/lifecycle/_system.js`, an object whose methods the tests replace (ADR 0002 Decision 8).
3. **Relationship types.** The graph declares its types as elements of the relationship type concept, `39998:<TA>:relationship-type`, where `<TA>` is this instance's assistant (`getOwnerAssistantPubkey()`, `src/utils/assistantKeys.js:48`). Firmware 1.0.0 makes 14 elements (`firmware/versions/v1.0.0/concepts/relationship-type/elements/`):
   - the nostr import's `AUTHORS`, `HAS_TAG` and `REFERENCES`;
   - the class threads' `IS_THE_CONCEPT_FOR`, `IS_A_SUPERSET_OF` and `HAS_ELEMENT`;
   - six for a concept's core-node wiring (`IS_THE_JSON_SCHEMA_FOR` and the like);
   - the property tree's `ENUMERATES` and `IS_A_PROPERTY_OF`.

   An element's node carries `slug`, the canonical name (`CLASS_THREAD_TERMINATION`). Its Neo4j type (`relationshipType.alias`, `HAS_ELEMENT`) is only in its json tag, `(e)-[:HAS_TAG]->(:NostrEventTag {type: 'json'})`. That tag's value may be an LMDB reference instead of the JSON (`isLmdbRef` and `resolveValue`, `src/lib/tapestry-resolve.js:34` and `:66`). `getExistingWordJson` (`src/lib/derivers/word.js:42`) reads it the same way. On the local instance (2026-11-14), all 14 elements' json tags are inline and each holds its alias. The firmware alias layer, `src/api/normalize/firmware.js:40–80`, reads the firmware's own files from disk, never the graph, and requires only `fs` and `path`.
4. **The edge types the instance's own code writes** beyond firmware's 14 (a search of `src/`, 2026-11-14):
   - `FOLLOWS`, `MUTES` and `REPORTS`, from the trust pipeline (`src/pipeline/reconcile/processReconciliationQueue.js:34–38` among others);
   - `TAGS`, from the tagging-edges pass (`src/pipeline/tagging-edges/graph.js:120`);
   - `INHERITS_FROM`, from a `b` tag (BIBLE §25);
   - `PROVIDED_THE_TEMPLATE_FOR`, from fork-node;
   - `SPECIFIC_INSTANCE` and `WOT_METRICS_CARDS`, from each customer's cards;
   - `IMPORT` and `SUPERCEDES`, from the old concept-graph setup script (`src/manage/concept-graph/setup.sh:143–146`). These are BIBLE §10 rule 8's.
5. **Today's whitelist pattern.** A relationship type can't be a Cypher parameter. `src/api/normalize/relationships.js:65–92` therefore writes only a resolved, whitelisted type into the query text, never the caller's string.
6. **Bodies.** The control panel parses JSON and form-encoded bodies (`bin/control-panel.js:124–125`). Its session cookie sets `secure` and `maxAge` only, so no SameSite (`:237–240`), and `src/middleware/auth.js` checks no Origin. The external CLI sends every write as `application/json`: `bodyOf` always gives a body (`clients/cli/src/operations.js:149`), and `send` sets the header whenever there is one (`clients/cli/src/instance.js:70`). No doc in the repo shows a `curl` POST to `/api/tapestry/`.
7. **The failure message.** `src/operations/cli.js` words an answer it can't serialize with `e.message`, and `src/operations/http.js` with `(err && err.message) || String(err)` (Loom memo #96).
8. **Backup** dumps the whole Neo4j database (ADR 0002), so whatever lives in the graph is carried and restored with it.
9. **Indexes at start.** `ensureUuidIndexOnBoot` (`src/lib/tapestry-node-index.js`, called from `bin/control-panel.js:362`) makes `tapestry_node_uuid` when the control panel starts, with retries, and never throws (ADR 0003 Amendment 1).
10. **Tests.** The operations harness (`test/helpers/operationsHarness.js`) runs the module in a child process with dead Neo4j and Redis endpoints, and replaces `_system.js` with fakes. `test/helpers/nodeCypherFake.js` reads single-node Cypher only. Live checks run on a scratch stack (`scripts/scratch-stack.sh`).

## Options considered

### Option A — One write transaction per write, holding the guards, the change and its entry, with the entry a node in the graph

A write declares `apply` in place of `run`. The module opens one Neo4j write transaction. In it, the module runs the write's declared guards, then `apply`, which reads and writes the graph and returns what it changed. When something changed, the module adds the change entry as a `GraphChange` node in the same transaction, and commits. `graph history` reads the `GraphChange` nodes.

- **Pros:** The change and its entry commit together by construction (AC4). Backup carries the entries and restore brings them back with the graph they describe (AC5), with no change to backup. There is one store, one atomic unit, and one place where guards run.
- **Cons:** The entries are nodes in the graph. The core rules then apply to them (a tapestryKey, the shared label), any scan of every node includes them, and every read that means the graph's content has to leave them out. They are elements of no concept, so D9's "element of at least one concept" doesn't hold for them yet. History's filter by node scans the entries, since Neo4j 5 Community can't index membership in a list property.

### Option B — Entries in a ledger file beside the graph, added to the backup

Commit the change to Neo4j, then append its entry to a JSON-lines file in the backups' volume. Backup copies the file while the graph is offline, and restore puts it back.

- **Pros:** The graph holds no records. Appending is cheap. History is a file read.
- **Cons:** Two stores can't commit together. A crash between the commit and the append loses the entry, and appending first records a change that may never commit, so AC4 needs a write-ahead log and a reconciler, which is new machinery. Restore has to replace the file in step with the dump. History filters the whole file, and a second store needs its own backup, retention and corruption story.

### Option C — Entries as properties on what changed

Each node and relationship a write touches gets `changedBy`, `changedAt` and `changedThrough` properties.

- **Pros:** No new nodes or files.
- **Cons:** Only the last change survives, and a removed relationship leaves nothing behind, so there is no history by node, by admin or over time. It fails AC5.

## Decision

We chose **Option A**. It is the only option in which AC4's "both, or neither" holds without new machinery, and AC5's "in step with the graph" holds without changing backup. The entries meet the core rules as any node does, and the open question of D9 is recorded below as debt, not settled here.

**1. Two kinds of write.** A write declaration has `run` or `apply`, never both:

- `run` works as today. Lifecycle's writes keep it (backup, restore, migrate, upload-backup), along with their own run records (story, Out of scope).
- `apply` goes through the write path.

The loader refuses a `graph` write that declares `run`, so every graph write goes through the path. It also refuses `apply` on a read.

**2. A write's new fields** (memo #96 places them in `declaration.js`'s rules):

```js
module.exports = {
  group: 'graph', name: 'add-relationship', kind: 'write', access: 'owner-and-admins',
  summary: '…', inputs: { from: {…}, to: {…}, type: {…} },
  result: { description: '…', schema: { /* … */ properties: { /* … */ change: CHANGE_ENTRY } } },
  refusals: [{ code: 'unknown-node', status: 404, when: '…' }],
  guards: [{ rule: 'relationship-type-allowed', items: (inputs) => [{ type: inputs.type, from: inputs.from, to: inputs.to }] }],
  repeatKey: ['from', 'to', 'type'],
  async apply(inputs, ctx) { /* reads and writes through ctx.tx; returns { data, changes } */ },
};
```

- **`guards`** lists each rule the write checks (Decision 4) and what it hands the rule. The loader checks that every rule named exists. Each rule's refusals are added to the operation's refusals, so `/docs`, the list and the command's help show them. The list and `/docs` also show the guards' names.
- **`repeatKey`** names the inputs that make two calls the same write. It is required, non-empty, and every name in it must be a declared input. `/docs` and the list show it as "Safe to repeat by …". The operation itself makes a repeat change nothing (Decision 7). The key says what counts as the same call.
- **`apply(inputs, ctx)`** gets run's context plus `ctx.tx`, the transaction: `tx.run(cypher, params)` resolves `{ rows, counters }`, and `tx.read(cypher, params)` resolves the rows. The context has nothing that signs or publishes. `apply` returns `{ data, changes }`:
  - `changes` is a list of `{ change: '<kebab-case>', … }`, with the tapestryKeys it touches in `node`, `from` or `to`;
  - an empty list means nothing changed;
  - `apply` may do nothing outside the transaction, since `executeWrite` can run it again.
- **The result schema** must declare `change` (the shared `CHANGE_ENTRY` schema, nullable): the path adds it to `data`.

**3. The path.** `src/operations/write.js` runs an `apply` declaration for `callOperation` once the inputs are checked:

1. It opens `graph.writeTransaction(work)` (Decision 9), so the guards, the change and the entry share one transaction.
2. It runs each guard: `rule.violations(guard.items(inputs), tx.read)`. On the first violation it throws `refusal(code, message, { rule })`, and the transaction rolls back before anything is written.
3. It calls `apply(inputs, ctx)`. A refusal it throws, such as `unknown-node`, rolls back the same way.
4. If `changes` is not empty, it writes the change entry (Decision 5) in the same transaction. If it is empty, nothing is recorded.
5. It commits and answers `data` with `change: <the entry>`, or `null`.

A refusal or a failure at any step rolls everything back, so the change and its entry are committed together or not at all (AC4). The answer to a refusal from a guard gains `rule`, the rule's name, beside `code` and `error`. `refusal(code, message, extra)` takes the extra fields (`rule`, and `input` for `unknown-node`), and `callOperation` copies them into the body.

**4. Rules are defined once, one file each.** `src/operations/rules/<name>.js`, loaded by `src/operations/rules/index.js` the way the catalog is: kebab-case file names, each rule checked as it loads (a bad file is reported and left out), and nothing opened at load (ADR 0001 Decision 10).

```js
module.exports = {
  name: 'relationship-type-allowed',
  summary: 'A relationship the owner or an admin adds or removes has a type the graph declares, and not one reserved for another operation or the nostr import.',
  refuses: true,                                   // a guard that refuses, rather than one that only reports (design §5, question 3)
  refusals: [{ code: 'undeclared-type', status: 409, when: '…' }, { code: 'reserved-type', status: 409, when: '…' }],
  async violations(items, read) { /* → [{ item, code, message }] */ },
};
```

`violations` is the rule's one definition. The write path calls it as a guard, with the write's items and the transaction's read. `rules check` (A10.31) will call it as a check, with a read session and the items it scans. Which items a check feeds it, judged by where each came from (D15), is A10.31's decision. A test that calls `violations` directly with relationships that break the rule shows the second use (AC2).

**5. The change entry is a node.** `(:GraphChange:TapestryNode)`, with:

| Property | What it holds |
|---|---|
| `tapestryKey` | a random v4 UUID (`randomUUID()`), which is the entry's id |
| `at` | when, as `new Date().toISOString()`: UTC, milliseconds, fixed width, so text order is time order; taken once per attempt of the transaction |
| `byRole` | `'owner'`, `'admin'` or `'local'`, as `callerOf` found it at the time of the write |
| `byPubkey` | the caller's hex pubkey; absent for `'local'` |
| `operation` | `'graph add-relationship'` |
| `keys` | the distinct tapestryKeys in the changes' `node`, `from` and `to`, for history's filter by node |
| `changes` | the changes list as JSON text, since Neo4j holds no nested maps |

- **It meets the core rules.** The entry has a key and the shared label, so the uniqueness rule `tapestry_key` covers it, and `lifecycle migrate` has nothing to do for it. It has no `tapestryValue`, which the core rule allows (design §7), and no `uuid`.
- **It links to nothing.** No edge joins an entry to the nodes it names, so an entry never shows among a node's neighbors, and deleting a node leaves its history readable.
- **It is never changed.** No graph write may name a `GraphChange` node. The one lookup the writes use to find a node by key leaves entries out (Decision 7), and so must any later read that means the graph's content.
- **Indexes.** `graph_change_at` on `GraphChange(at)` and `graph_change_by` on `GraphChange(byPubkey)` are made when the control panel starts, as `tapestry_node_uuid` is, with the same retries.
- **Backup and restore.** A backup carries the entries, and a restore brings back exactly the history of the graph it restores (AC5).

**6. The rule `relationship-type-allowed`.** Its items are `{ type, from, to }`.

- **Reserved first.** A type on the rule's reserved list is refused with `reserved-type` (409), even when the graph declares it. The message names what makes the type. The list is in two parts:
  - the aliases of every relationship-type element in the active firmware, read from its files through `src/api/normalize/firmware.js`, so a type a later firmware adds is reserved without an edit;
  - one constant for what the instance's code writes and firmware doesn't declare (Context 4).

  What each type is attributed to:

  | Types | Made by |
  |---|---|
  | `IS_THE_CONCEPT_FOR` and the six core-node wiring types | `graph create-concept` |
  | `IS_A_SUPERSET_OF` | `graph link-set` and `create-set` |
  | `HAS_ELEMENT` | `graph add-to-concept` and `create-element` |
  | `IS_A_PROPERTY_OF` | `graph add-property` |
  | `ENUMERATES` | `graph enumerate` |
  | `AUTHORS`, `HAS_TAG`, `REFERENCES`, `INHERITS_FROM` | `import nostr` |
  | `FOLLOWS`, `MUTES`, `REPORTS` | the trust pipeline |
  | `TAGS` | the tagging-edges pass |
  | `PROVIDED_THE_TEMPLATE_FOR` | `graph copy-node` |
  | `IMPORT`, `SUPERCEDES` | `graph merge-nodes` (BIBLE §10, rule 8) |
  | `SPECIFIC_INSTANCE`, `WOT_METRICS_CARDS` | each customer's cards |

- **Then declared.** Otherwise the type must equal the alias of some element in the class thread of this instance's relationship type concept, or it is refused with `undeclared-type` (409). The rule reads the aliases from each element's json tag, resolving an LMDB reference as `getExistingWordJson` does, within the same transaction. An element whose json can't be read or has no alias declares nothing. When the concept isn't in the graph, as before a firmware install, every type is undeclared, and the message says so.
- **Whose declarations count.** Any element in that class thread, whoever wrote it. The guard asks only whether the owner's graph knows the type. Using a type is the owner's or an admin's own act, while which declarations are trusted is a question for whoever reads and ranks them, per point of view (CLAUDE.md principles 1–3). An element enters this class thread only through the owner's own concept.
- **Only checked names reach Cypher.** The inputs' schema allows a type name of `^[A-Za-z][A-Za-z0-9_]{0,63}$` only. A name that matches and that the rule has passed is the only one written into the query text, in backticks, as today's whitelist does (Context 5). A declared alias outside that pattern can't be used.

**7. The three operations,** in `src/operations/catalog/graph/`, all `owner-and-admins`:

- **`add-relationship.js`** (write).
  - **Inputs:** `from`, `to` and `type`, all required. `from` and `to` are tapestryKeys (`^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$`). `type` follows Decision 6's pattern.
  - **Guard and key:** `relationship-type-allowed`; `repeatKey: ['from', 'to', 'type']`.
  - **Refusal:** `unknown-node` (404, with `input`).
  - **`apply`:**
    1. Finds both nodes with the shared lookup, `MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange`, and refuses the first missing one by its input.
    2. Runs `MERGE (a)-[r:\`TYPE\`]->(b)`, and reads `counters.relationshipsCreated` to tell an add from a repeat.
    3. Returns `data: { relationship: { type, from, to }, outcome: 'added' | 'already-there' }`, and `changes: [{ change: 'relationship-added', type, from, to }]` or `[]`.

    `MERGE` between two bound nodes locks both, so two calls at once make one relationship and one entry.
- **`remove-relationship.js`** (write).
  - **Inputs, guard, key and refusal:** as for add-relationship.
  - **`apply`:**
    1. Finds both nodes the same way.
    2. Runs `MATCH (a)-[r:\`TYPE\`]->(b) DELETE r`, which removes every such relationship, since older paths could have made two.
    3. Returns `outcome: 'removed' | 'already-gone'`, and `changes: [{ change: 'relationship-removed', type, from, to, count }]` or `[]`.
- **`history.js`** (read).
  - **Inputs, all optional:**
    - `node`: a tapestryKey;
    - `by`: a 64-hex pubkey or `'local'`;
    - `since`: `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$`. It is normalized with `new Date(since).toISOString()` before it is compared, since `…:00Z` sorts after `…:00.000Z` as text;
    - `limit`: 1–200, default 50;
    - `cursor`.
  - **Refusal:** `invalid-cursor` (400).
  - **Reading:** with the module's read, outside any write transaction. It orders by `at` descending, then `tapestryKey` descending, filters by every input given, and fetches `limit + 1` rows to know whether a next page exists.
  - **Answer:** `{ entries, cursor }`. `cursor` is the base64url of `[at, tapestryKey]` of the last entry returned, or `null` on the last page.
  - **Each entry:** `{ id, at, by: { role, pubkey }, operation, changes }`, the same shape the writes answer as `change`.

**8. JSON only.** For a write without a file body, the route refuses with 415 `wrong-content-type`, and changes nothing, unless the Content-Type's media type is `application/json`. The check runs after the caller's check, so a visitor still gets 401, and before the body is read. A POST with no body and no Content-Type is refused too. A cross-site request can send one, and a browser that sends a cookie with no SameSite on such a request would include the session. Lifecycle backup, which takes no inputs, would then take the graph offline. The rule covers every JSON write, lifecycle's included. A file-body write keeps its declared types (lifecycle upload-backup). The built-in `wrong-content-type` applies to every write, and no write may declare its own. The rest of the app's body parsing doesn't change.

**9. The graph seam.** `src/operations/graph.js` exports an object, as `_system.js` does, whose methods the tests replace:

- `writeTransaction(work)` runs `session.executeWrite`, wraps the transaction as `{ run, read }`, converts records with the driver module's `toJS`, and reads the counters from `summary.counters.updates()`;
- `read(cypher, params)` returns rows, as `runCypher` does.

Every graph operation and every rule reaches Neo4j through it, and through nothing else. It requires the driver when it is first called, never at load.

**10. Nothing signs.** The write path hands `apply` no signer, and no graph operation, rule or path module calls anything that signs, publishes or reads the assistant's secret key. This is proven two ways:

- A test spies on the signing and publishing entry points and runs each operation accepted, refused and repeated. It finds no call. The entry points are nostr-tools' `finalizeEvent` and the instance's relay publish (`strfry import`, `/api/strfry/publish`'s helper).
- The live check counts the relay's events before and after (AC6).

Reading the assistant's pubkey for the concept's handle reads no secret.

**11. One message for a failure.** `index.js` exports `failureMessage(err)`, which gives `(err && err.message) || String(err)`. `callOperation`, `http.js` and `cli.js` all word a failure with it (memo #96).

**12. The rules document.** `docs/GRAPH_RULES.md` starts the rulebook that design §7 describes, with one entry for each rule that is built. Each entry gives:
- what the rule says;
- whether it is a graph rule or a letter rule;
- whether it refuses a write or only reports;
- how a check finds what breaks it;
- how a repair fixes it (none yet);
- where it is enforced: by the database, a guard or a check.

It holds two entries:
- the tapestryKey rule, built in A10.3: the uniqueness rule `tapestry_key` with `lifecycle migrate`, reported by `lifecycle status`;
- `relationship-type-allowed`, a guard that refuses.

Design §7 points to the document.

**13. Callers.** The three operations are `owner-and-admins`, as Decision 3 of ADR 0001 gives every declaration its exact route-table entry. The command's caller is `local`, and its entries say so.

## Consequences

- **What this enables.** Every later graph write is a declaration with `guards`, `repeatKey` and `apply`, and the path gives it the guards, one transaction, an entry and no signer for free. `rules check` (A10.31) calls the same `violations`. History covers every graph write from this one on. The external CLI and `/docs` pick the operations up from the list, with no change to either.
- **What this constrains.**
  - A graph write does all its work inside the transaction and can't write elsewhere from `apply`. The cache rebuild a later node write needs (D10) goes after the commit, through `afterAnswer`.
  - Every read that means the graph's content has to leave `GraphChange` out, as the key lookup here does.
  - Writes through the old normalize routes record no entry (D15).
- **Debt and follow-ups.**
  1. **D9 and the entries.** An entry is an element of no concept. Whoever writes D9's rule into the rulebook decides how records count. Two likely ways: a firmware "graph change" concept whose membership the label implies (BIBLE §10's "Inferrable HAS_ELEMENT"), or a rule whose scope leaves records out.
  2. **History by node scans the entries,** because no Community index covers membership in a list. The live check measures it at a size well past the rebuild's. If it is too slow, index the keys, with a node per key or an edge per key.
  3. **The entries have no retention.** They grow with every write, and how long to keep them is BIBLE §30's open question.
  4. **The reserved list grows with the code.** A test reads every relationship type the instance's code names, plus the dynamic sites of Context 4, and fails on one the list doesn't hold.
  5. **The import path** (deferred) adds a `source` to an import's entry: the kind of source, its address and its author.
  6. **A removed admin's entries** keep their pubkey and the role as it was at the time of the write.
- **Firmware reinstall required?** No. No concept definition changes.

## Implementation notes

- **New files:**
  - `src/operations/write.js`: the path (Decision 3).
  - `src/operations/graph.js`: the seam (Decision 9).
  - `src/operations/changes.js`: `CHANGE_ENTRY`, the shared schema; `recordChange(tx, { at, caller, operation, changes })`, which returns the entry; `readHistory(read, filters)`; and the cursor's encoding and decoding.
  - `src/operations/rules/index.js`: `loadRules()` and `findRule(name)`.
  - `src/operations/rules/relationship-type-allowed.js`: the rule.
  - `src/operations/catalog/graph/add-relationship.js`, `remove-relationship.js` and `history.js`.
  - `src/operations/catalog/graph/_nodes.js`: the shared key lookup.
  - `docs/GRAPH_RULES.md`.
- **Changed files:**
  - `src/operations/declaration.js`:
    - `apply`, `guards` and `repeatKey`, with their rules (Decisions 1 and 2);
    - `wrong-content-type` applies to every write and is reserved for every write;
    - `too-large` stays a file-body code.
  - `src/operations/index.js`:
    - `describe` carries `guards` and `repeatKey`;
    - the operation's refusals include its guards' refusals;
    - `callOperation` hands an `apply` declaration to `write.js`;
    - refusal bodies carry `rule` and `input` from the refusal;
    - `failureMessage`;
    - `listEntry` adds `guards` and `repeatKey` for a write that has them.
  - `src/operations/refusal.js`: `refusal(code, message, extra)`.
  - `src/operations/http.js`: the content-type check (Decision 8) and `failureMessage`.
  - `src/operations/cli.js`: `failureMessage`.
  - `src/operations/openapi.js`: each write's guards and "Safe to repeat by …" in its description.
  - `src/lib/tapestry-node-index.js`, or a sibling beside it: make `graph_change_at` and `graph_change_by` at start with `ensureUuidIndexOnBoot`'s retries. Its own behavior and its tests stay as they are.
  - `bin/control-panel.js`: call it.
  - Design doc: its status line, and §7's pointer to `docs/GRAPH_RULES.md`.
- **Cypher, one transaction per write:**
  - a guard's read of the declared aliases: `MATCH (h:NostrEvent|TapestryNode {uuid: $handle}) WHERE h:ConceptHeader MATCH (h)-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..]->()-[:HAS_ELEMENT]->(e) WITH DISTINCT e OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'}) RETURN e.tapestryKey AS key, t.value AS json`. It finds the header by address, as ADR 0003 Decision 9 says, and takes the three class-thread types from the firmware alias layer, as the code does elsewhere. The concept is small (14 elements on a fresh instance), so the read is too;
  - the key lookup (Decision 7);
  - the change;
  - `CREATE (c:GraphChange:TapestryNode {tapestryKey: randomUUID(), at: $at, byRole: $role, operation: $operation, keys: $keys, changes: $changes}) SET c.byPubkey = $pubkey RETURN c`. A null `$pubkey` leaves the property out, since setting a property to null removes it.
- **What the tests need.** These belong to Phase 3, the Tester's lane.
  - A fake for `graph.js` that holds nodes and relationships, keeps a transaction's writes until it commits, and can fail on a chosen step, for AC4.
  - The harness's way to install it, as it installs the lifecycle fakes.
  - A guard on the reserved list (Consequences, debt 4).
  - The spy for Decision 10.
  - The live check on a scratch stack:
    - `MERGE`'s counters;
    - two calls of the same add at once make one relationship and one entry;
    - a rollback after a forced failure leaves no edge and no entry;
    - the indexes;
    - history's plan and its time with 100,000 entries;
    - a backup and a restore with entries before and after it;
    - the relay's event count;
    - an admin agent through the external CLI.

## Out of scope

- The import path (D4), which the first importer builds.
- `rules list-rules`, `check` and `repair` (A10.31).
- Declaring a relationship type through the new operations (`graph create-element`, A10.20).
- Checking a relationship's ends against the kinds of node its type names.
- Properties on relationships, and bulk writes.
- D9's rule, and how records count under it (Consequences, debt 1).
- Retention of entries, and a watch on changes (catalog §10, question 8).
- Lifecycle's writes in history.
- Read visibility beyond sign-in (catalog §10, question 1).
- Publishing an edge as a letter (A10.34).
- Shipping to staging or production, which waits for the owner's OK.

## Amendment 1 (2026-11-14, at Test Design) — `SERVES` is reserved too

The Tester's scan of every relationship type `src/` names in Cypher found one that Context 4 missed: `SERVES`, the second brain's goal tree, which its Rationale page walks (`src/api/brain/index.js:791–802`). Decision 6's constant gains it, attributed to "the second brain's goals". The test that guards the list (Consequences, debt 4) is the one that found it. It fails on any type the code names that the list doesn't hold, so the next one is caught the same way.
