# ADR 0003: A tapestryKey on every node — one shared label, `lifecycle migrate` as a job, and the key set by every path that makes a node

**Status:** Accepted
**Date:** 2026-11-08
**Story:** `engineering-team/stories/graph-operations-foundation/3-a-tapestry-key-on-every-node.md`
**Amends:** ADR `graph-operations-foundation/0002`, Decision 4 step 2's key counting (Decision 10 below).

## Context

The story asks for one operation, `lifecycle migrate`, with two migrations. `tapestry-keys` gives every node in the graph a tapestryKey and one shared label, then adds a uniqueness rule, after a backup (AC1–AC3). `event-less-nodes` takes `NostrEvent` off the nodes the instance made with no event (AC6). `lifecycle status` shows both (AC4), every path that makes a node sets the key and the label when it makes it (AC5), and the operation is open to the owner and admins, by route and command (AC7). "Every node" includes the web-of-trust graph (the owner's ruling at the planning gate).

What the instance gives this design:

1. **Neo4j 5.26.10 Community** (ADR 0002, Context 1). Uniqueness constraints hold only for nodes with a given label, and existence constraints are Enterprise-only (design §7). APOC's allowlist admits `apoc.periodic.*` (`Dockerfile:63`), which the trust pipeline already uses for batched writes with retries (`src/pipeline/batch/apocCypherCommand1_follows`). Built-in Cypher has `randomUUID()`, a version 4 UUID. `runCypher` and `writeCypher` run each query with `session.run`, an auto-commit transaction (`src/lib/neo4j-driver.js:55–59`, `:92–96`).
2. **Who sets a key today.** Of the paths that make nodes, only the brain write does: `SET e.tapestryKey = coalesce(e.tapestryKey, $fresh)` (`src/api/strfry/tapestryBrainWrite.js:91`). `POST /api/tapestry-key/initialize` and a firmware install stamp the rest later, from JavaScript, one batch of 500 at a time, only for nodes with a `uuid` or an `id` (`src/api/tapestry-key/index.js:108–149`). Some nodes hold `{}` as a key, which those counts treat as none.
3. **The paths that make nodes.**
   - **The nostr import:** `buildImportCypher` (`src/api/neo4j/eventSync.js:176–292`) makes the event node, its author's `NostrUser`, its tag nodes, and placeholders for events it references. The event route, the file import (`src/api/io.js:498`), pulling a class thread (`src/api/concept/pullClassThread.js:239`) and a firmware install (`src/firmware/install.js:1064`, `:1095`, `:1123`) all use it.
   - **The signing normalize routes:** `importEventDirect`-style writes in `src/api/normalize/helpers.js:75` (the event) and `:105` (its tags) and `src/api/normalize/index.js:143`.
   - **add-subset's event-less sets:** `src/api/normalize/nodes.js:184–216`, which makes the set and its "would-be" tag nodes.
   - **The trust pipeline**, which makes `NostrUser` nodes: the stream consumer (`src/pipeline/stream/redis-consumer.js:48–102`), the stream, batch and reconciliation APOC files (`src/pipeline/stream/wot/apocCypherCommand*`, `src/pipeline/batch/apocCypherCommand*`, `src/pipeline/reconciliation/apocCypherCommands/*`), the batch loader script (`src/pipeline/batch/processNostrEvents.sh`), and the tagging-edges pass (`src/pipeline/tagging-edges/graph.js:40–46`). Each customer's setup makes metrics-card sets and cards: `src/cns/prepareNeo4jForCustomerData.sh:96–97`, `src/cns/addSetsOfMetricsCards.sh:26`, `src/cns/addMetricsCards.sh:49`.
   - Nothing runs `src/manage/concept-graph/setup.sh`, `batchTransfer.sh` or their APOC files, and the `-backup` and `-deprecated` copies of pipeline scripts are not called either.
4. **Scale.** Production, staging and tags each hold about 3 million `NostrUser` nodes (tagging-edges story 2, 2026-09), and about 3,500 nodes with a `uuid` or an `id` (ADR 0002, Context 8). The stream consumer writes `NostrUser` nodes continuously.
5. **Backup counts every key in memory.** `countGraph` reads every non-null `tapestryKey` into one array, sorts it and hashes it, before and after the offline window (`src/operations/catalog/lifecycle/_jobs.js:47–58`); restore counts again. On a migrated production graph that is about 3 million strings, three times per restore.
6. **`NostrEvent` and addresses.** `nostrEvent_uuid` makes `uuid` unique among `NostrEvent` nodes (`setup/neo4jConstraintsAndIndexes.sh`). Every import and lookup by address relies on it: `MERGE (e:NostrEvent {uuid: …})` (`eventSync.js:187`), add-subset's own `MERGE` and its "address already held" check (`nodes.js:184–216`). An event-less set is a `NostrEvent:ListItem:Set` node with no `id`, the instance's pubkey, a `kind` and tag nodes (`nodes.js:203–212`). An import placeholder made for an `a` or `b` tag also has no `id`, only `uuid`, `kind` and `pubkey`, and no tag nodes (`eventSync.js:250–283`). Placeholders for `e` tags carry the referenced `id` (`:236–241`).
7. **`:NostrEvent` in queries.** 223 lines in 15 files under `src/` that something runs, which is D7's count (the story's 360 also counted `:NostrEventTag`). The four files nothing runs add 9 more. The UI sends another 111 lines of Cypher through `POST /api/neo4j/query`, in 28 files under `ui/src/`, most of them in `pages/reading/readVerbs.js` (31) and `writeVerbs.js` (17).
8. **The module** (ADR 0001): a declaration's refusals must be 4xx (`src/operations/declaration.js:148`); `context.caller.pubkey` names who called (`src/operations/index.js:108`); an enum input that fails says only "must be equal to one of the allowed values" (`src/operations/inputs.js:69–71`). **The lifecycle jobs** (ADR 0002 Decisions 7–8) give one lock for backup, restore and upload, stale-lock recovery, and a detached worker the caller waits for. `runBackupJob` releases the lock in its `finally` (`_jobs.js:202`).
9. **Status.** `parts.migrations` answers `{ known: true, applied: [], note }` (`status.js:144–146`), and its suite pins that (`test/operations/lifecycle/status.test.js`, P2).

No concept is touched (story, "Concepts touched"). This workspace has no stack: Docker Hub is out of reach, so nothing here was measured on a live Neo4j. The points that need a number are listed for Test Design under Implementation notes.

## Options considered

### Option A — One shared label and a uniqueness rule; keys set in Cypher by every path that makes a node; migrate as a lifecycle job that computes what to do from the graph *(chosen)*

Every node gets the label `TapestryNode`. A uniqueness constraint on `TapestryNode.tapestryKey` gives unique keys and the index lookups need. Each Cypher statement that makes a node sets the key with `randomUUID()` and the label, in the same statement. `lifecycle migrate` runs as a job of ADR 0002's kind, holding the same lock. It takes a backup inside the job, then works online, in batches. Whether a migration is applied is computed from the graph each time status asks, so it stays true after a restore.

- **Pros.** The database itself guarantees unique keys, and the instance needs no second process. No node is ever without a key between its creation and a sweep. Backup, restore and migrate can't overlap. A restored older graph reads as not migrated, since the state is the graph's own.
- **Cons.** About 25 files change, in JavaScript, shell and APOC files, and a static guard has to keep future ones honest. The label adds a label and a property to 3 million `NostrUser` nodes, plus an index entry each.

### Option B — Keys from a sweeper: a scheduled task, or an APOC trigger, gives keys to new nodes

No write path changes. A task runs `initialize` every few minutes, or `apoc.trigger.add` stamps nodes as they commit.

- **Pros.** Few files change.
- **Cons.** APOC triggers aren't on the allowlist (`Dockerfile:63`), and adding them runs code inside every transaction in the database, the trust pipeline's included. A sweeper leaves nodes without a key for minutes, which breaks AC5 ("as soon as it exists"), and any operation that names a node by its key could miss a new one. It also adds a scheduled task that scans 3 million nodes.

### Option C — A uniqueness constraint per existing label, no shared label

`FOR (n:NostrEvent)`, `FOR (n:NostrUser)` and so on, each `REQUIRE n.tapestryKey IS UNIQUE`.

- **Pros.** No new label.
- **Cons.** Uniqueness holds within each label, not across the graph, so two nodes with different labels could share a key. A node whose labels change (AC6 takes `NostrEvent` off) can fall out of every constraint. Every new label needs its own. Lookups by key need to know the label first. Design §7 already rejects it: only one shared label lets the database guarantee unique keys.

### Sub-decision 1 — How migrate gives keys to 3 million nodes: `apoc.periodic.iterate` *(chosen)*, or `CALL { … } IN TRANSACTIONS`

`apoc.periodic.iterate` streams the matching nodes from one scan and applies batches in their own transactions, with `retries` for the deadlocks the stream consumer can cause, and reports how many batches failed. That is how the pipeline already writes in bulk. `CALL { … } IN TRANSACTIONS` is built in and works under `session.run`, but in 5.26 it can only fail, continue or break on an error: it has no retry, so a deadlock with the stream consumer either fails the run or skips a batch. Migrate runs `apoc.periodic.iterate`, then counts again and runs another pass for what is left (Decision 4).

### Sub-decision 2 — Where a migration's state lives: computed from the graph, with history in the run files *(chosen)*, or a record written when it runs

A record, whether a file on the data volume or a node in the graph, would say "applied" after a restore brought back an unmigrated graph, unless restore rewrote it. A node would also need a concept of its own (D9). Instead, status asks the graph each time: no node without a key or the label, and the rule in place. When it last ran, who ran it and which backup came first are in the job's run file (ADR 0002 Decision 8), which a restore leaves alone, as it should: that history is the instance's, not the graph's.

### Sub-decision 3 — How a route answers a run that takes minutes: wait up to a limit, then answer `running` *(chosen)*, or wait to the end as backup does

On production, the backup before the migration takes the graph offline for an unmeasured while, perhaps minutes for a store holding 3 million users and their relationships. The keys and the index follow, online. Behind the droplets' host nginx (a 60 s read timeout by default, ADR 0002 Consequences), a route that waits to the end would lose its answer, and an agent's HTTP client would give up. AC1 asks that the caller's request not time out. So the route waits up to `wait` seconds (default 50), then answers `state: 'running'` with the run's id; status shows the run and its result. The command waits to the end, since a shell inside the instance has no proxy in the way.

### Sub-decision 4 — How queries find a node by its address while some nodes lack the label and others lose `NostrEvent`: `(:NostrEvent|TapestryNode {uuid})` *(chosen)*, `(:TapestryNode {uuid})`, or no label

The code ships before migrate runs on each instance. Until then, most nodes have `NostrEvent` and no `TapestryNode`; after `event-less-nodes`, event-less sets have `TapestryNode` and no `NostrEvent`. `(:TapestryNode {uuid})` would miss every unmigrated node the moment the code lands. A lookup with no label scans every node, 3 million on production. The disjunction finds both kinds in every state, and both labels have an index on `uuid`: `nostrEvent_uuid`, and `tapestry_node_uuid` (Decision 1). That the planner seeks both indexes rather than scanning has to be confirmed (Implementation notes, measurement 1). Once every instance has run both migrations, a follow-up can narrow it to `:TapestryNode`.

## Decision

We chose **Option A**, with the four sub-decisions as marked. Option B leaves nodes without keys and needs triggers the instance doesn't allow, and Option C can't make keys unique across the graph. The rest of this section says exactly how.

**1. The label, the rule and the index.**

- The label is **`TapestryNode`**. It says nothing about a node beyond being one, and doesn't collide with the `tapestry` concept (BIBLE §6) or any label in use (none matches in the repository).
- The rule: `CREATE CONSTRAINT tapestry_key IF NOT EXISTS FOR (n:TapestryNode) REQUIRE n.tapestryKey IS UNIQUE`. It owns an index, which lookups by key and Decision 10's ordered walk use.
- The index: `CREATE INDEX tapestry_node_uuid IF NOT EXISTS FOR (n:TapestryNode) ON (n.uuid)`, for Decision 9's lookups by address.
- Both are made by `tapestry-keys` (Decision 4), not by `setup/neo4jConstraintsAndIndexes.sh`, so AC2 can leave the rule out. They stay out of `src/api/status/queries/expectedNeo4jSchema.js`, which lists what firmware install waits for: firmware doesn't need them.

**2. The operation.** `src/operations/catalog/lifecycle/migrate.js`, `kind: 'write'`, `access: 'owner-and-admins'`.

| Input | Schema | |
|---|---|---|
| `migration` | string, 1–64 chars, required | `tapestry-keys` or `event-less-nodes` |
| `wait` | integer 0–600, optional | Seconds the route waits before answering `running`. Default 50 over HTTP; the command waits to the end unless given one. |

The result is `{ migration, state, runId, backup, report, note }`, where `state` is `done`, `running` or `already-applied`, `backup` is the id of the backup taken first (or null), and `report` is the migration's own (Decisions 4 and 5, or null while running).

Its own refusals:

| Code | Status | When |
|---|---|---|
| `unknown-migration` | 400 | A name it doesn't know. The message names the ones it does, which a schema `enum` wouldn't (Context 8). |
| `run-tapestry-keys-first` | 409 | `event-less-nodes` while `tapestry-keys` isn't applied. |
| `busy` | 409 | A backup, restore or migration holds the lock (ADR 0002 Decision 7). |
| `graph-unavailable` | 409 | The graph database isn't answering. |

A backup that fails inside the job ends the run before anything changes, and the route answers `failed` (500) with the job's sentence: "The backup before migration tapestry-keys failed: …; nothing was changed." It is the instance's failure, not the caller's, so it isn't a 4xx refusal (Context 8). `busyMessage` (`_store.js:278`) says "A backup, restore or migration" when the lock names no op, and names `migrate` when it does.

**3. Migrations are declared in one helper.** `src/operations/catalog/lifecycle/_migrations.js` exports a list. Each entry is `{ name, summary, requires: [names], plan(system), apply(plan, system, progress) }`.

- `plan` only reads, and resolves `{ applied, changes: { …counts }, needsBackup, details }`.
- `apply` makes the changes and resolves the migration's report.
- `progress(fields)` writes `{ stage, … }` into the run file, so status can show a running migration.

A later migration, such as copying `name` into `tapestryValue` (D11), is a new entry, with no change to the operation.

**4. `tapestry-keys`.**

`plan` reads, in this order:
- `MATCH (n) RETURN count(n)` and `MATCH (n:TapestryNode) RETURN count(n)`, both from the count store;
- `MATCH (n) WHERE n.tapestryKey IS NULL OR n.tapestryKey = '{}' RETURN count(n)`, a full scan (measurement 2);
- `SHOW CONSTRAINTS` and `SHOW INDEXES` for `tapestry_key` and `tapestry_node_uuid`;
- **shared keys:** when the rule isn't in place, every key held by more than one node (`MATCH (n) WHERE n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}' WITH n.tapestryKey AS k, collect(elementId(n))[..10] AS ids, count(*) AS c WHERE c > 1 RETURN k, c, ids LIMIT 100`); when it is, the same over nodes without the label, each also checked against the index.

It is applied when no node lacks a key or the label, no key is shared, and both the rule and the index are online. `needsBackup` is true when any node will change. Adding only the rule and the index changes no data, so a fresh instance, whose nodes all got keys when they were made, needs no backup.

`apply`, in the job, after the backup:

1. **Keys and the label, in passes.** Each pass is one `apoc.periodic.iterate`:
   ```
   CALL apoc.periodic.iterate(
     "MATCH (n) WHERE NOT n:TapestryNode OR n.tapestryKey IS NULL OR n.tapestryKey = '{}' RETURN n",
     "SET n:TapestryNode
      SET n.tapestryKey = CASE WHEN n.tapestryKey IS NULL OR n.tapestryKey = '{}' THEN randomUUID() ELSE n.tapestryKey END,
          n.tapestryJsonUpdatedAt = CASE WHEN n.tapestryKey = '{}' THEN null ELSE n.tapestryJsonUpdatedAt END",
     {batchSize: 10000, parallel: false, retries: 3})
   ```
   A node whose key is shared (from `plan`) gets the label only when the rule isn't in place yet, so no batch fails on it. Nothing else touches a node that already has a real key: `randomUUID()` runs only where `CASE` finds none, and no key is ever replaced except the `{}` placeholder. After each pass, `apply` counts what is left. It runs at most three passes, then reports what is still left.
2. **The rule and the index,** unless keys are shared. It creates the rule and the index, then polls `SHOW INDEXES` every 2 s until both are `ONLINE`, for up to 30 minutes, reporting `stage: 'indexing'`.
3. **The report:** `{ before: { nodes, withLabel, withoutKey }, after: {…}, keysGiven, labelsGiven, placeholdersReplaced, passes, failedBatches, rule: 'added' | 'already-there' | 'left-out', index: same, sharedKeys: [{ key, count, nodes }] }`.

The trust pipeline keeps writing during all this. New nodes arrive with a key and the label (Decision 8), and a node it makes before the deploy reaches it is picked up by the next pass or the next run (AC3).

**5. `event-less-nodes`.** It requires `tapestry-keys` applied.

- **The nodes:** `MATCH (n:NostrEvent) WHERE n.id IS NULL AND (n)-[:HAS_TAG]->() RETURN n`. Only add-subset makes `NostrEvent` nodes with tag nodes and no `id`: an imported event always sets `id` before its tags attach (`eventSync.js:187–193`, `:226`), and placeholders never get tag nodes (Context 6). Placeholders therefore keep the label, as the story asks. The count is checked against a scratch instance and staging (measurement 4).
- **`plan`:** applied when that query finds nothing. `needsBackup` when it finds anything.
- **`apply`:** `REMOVE n:NostrEvent` in one `apoc.periodic.iterate` (batch 1,000). The report gives the count and the first 20 addresses.

**6. The job.** It reuses ADR 0002's machinery and adds `op: 'migrate'`.

The declaration's `run`:
1. Calls `C.begin('migrate')` (`_common.js`), which recovers a stale lock, takes the lock and checks that the graph answers. Its messages name a migration.
2. Calls `plan`. When the migration is applied, it releases the lock and answers `already-applied` with no backup and no run (AC3). When a required migration isn't applied, it releases the lock and refuses `run-tapestry-keys-first`.
3. Otherwise it starts `runDetached({ op: 'migrate', runId, migration, by: context.caller.pubkey || 'local', wait })`.

`runDetached` gains `opts.waitMs`. Past it, it resolves `{ outcome: 'running' }` and leaves the job to finish and release the lock. The worker's `runJob` dispatches `migrate` to `runMigrateJob`:

1. When `needsBackup`, it takes the backup without releasing the lock. `runBackupJob`'s body becomes `takeBackup(runId, note, system)`; `runBackupJob` keeps the `finally` that releases the lock, and `runMigrateJob` calls `takeBackup` with the note "Before lifecycle migrate <name>". The manifest's `reason` stays `requested`, so a backup taken by this version still restores on an instance of A10.2's version, whose manifest schema has only `requested` and `before-restore`. If the backup fails, the job fails with Decision 2's sentence and nothing else runs.
2. Runs `plan` again, since the graph may have changed while the lock was being taken, then `apply`, with `progress` writing `stage` and counts to the run file.
3. Records `{ migration, by, backup, report }` in the run's result. The lock is released in the `finally`.

The command prints, before waiting: "This migration runs as a job of its own. If this command is interrupted, the job still finishes, and `tapestry lifecycle status` shows how it went."

**7. Status's migrations part** (`status.js`), still written nothing, now answers:

```js
{
  known: true,
  keys: { nodes, withLabel, withoutKey, rule: true | false, index: true | false },  // the whole graph (AC4)
  migrations: [
    { name, summary, applied, requires,
      lastRun: { runId, startedAt, finishedAt, outcome: 'done' | 'failed' | 'running' | 'interrupted', by, backup, error } | null },
  ],
  note,  // in words: which are applied, which can run, and what is running
}
```

`applied` comes from each migration's `plan`, through the same readers. `lastRun` comes from the newest `.runs/*.json` with `op: 'migrate'` and that name; a running one is found by the lock. Before any run, `lastRun` is null for each. The cache part keeps its scope (AC4). The part's schema changes with it, and status suite P2 changes in Test Design.

**8. Every path that makes a node sets its key and the label.** There is one rule, in two forms.

- **JavaScript:** `src/lib/tapestry-key-cypher.js` exports `keyNode(variable)`, which returns:
  ```
  FOREACH (_ IN CASE WHEN NOT <v>:TapestryNode OR <v>.tapestryKey IS NULL OR <v>.tapestryKey = '{}' THEN [1] ELSE [] END |
    SET <v>:TapestryNode,
        <v>.tapestryKey = CASE WHEN <v>.tapestryKey IS NULL OR <v>.tapestryKey = '{}' THEN randomUUID() ELSE <v>.tapestryKey END)
  ```
  It is placed after each `MERGE` or `CREATE` that makes a node, in the same statement. It writes nothing when the node already has both, so a path that touches the same node again pays no write. That answers the story's question about the stream: the consumer touches the same `NostrUser` nodes over and over. A node without a key that a path touches again gets one (AC5). The variable name is checked against `^[A-Za-z_][A-Za-z0-9_]*$`.
- **Shell and APOC files:** the same text, written out, after each node `MERGE` in the statement (or inner statement) that makes it.

The paths, from Context 3:

| Path | File |
|---|---|
| The nostr import: event node, author, tag nodes, placeholders | `src/api/neo4j/eventSync.js` `buildImportCypher` |
| The signing routes | `src/api/normalize/helpers.js` (`:75`, `:105`), `src/api/normalize/index.js` (`:143`) |
| add-subset | `src/api/normalize/nodes.js` (Decision 9 too) |
| The brain write | `src/api/strfry/tapestryBrainWrite.js:91`. Its `coalesce` gives way to `keyNode('e')`, which also adds the label. |
| The stream consumer | `src/pipeline/stream/redis-consumer.js` |
| The tagging-edges pass | `src/pipeline/tagging-edges/graph.js` (`MOVE`, `CREATE_IF_ABSENT`) |
| The trust pipeline's APOC files | `src/pipeline/{batch,stream/wot,reconciliation/apocCypherCommands}/apocCypherCommand*` (not `-deprecated`) |
| The batch loader | `src/pipeline/batch/processNostrEvents.sh` |
| Customer setup and metrics cards | `src/cns/prepareNeo4jForCustomerData.sh`, `src/cns/addSetsOfMetricsCards.sh`, `src/cns/addMetricsCards.sh` |

`initialize` and firmware install's stamping stay as they are (D15). They do no harm, and they find nothing to stamp once every path sets keys.

**9. Finding nodes by address, and `NostrEvent` coming off.** After `event-less-nodes`, `:NostrEvent` means "came from a nostr event" (D7). Every query that names `:NostrEvent` follows one rule:

- **A lookup by address** (`{uuid: …}`) of a node that may be in the concept graph matches `(:NostrEvent|TapestryNode {uuid: …})` (Sub-decision 4). Most of the 223 lines are of this kind: concept headers, supersets, sets, elements and properties named by their address.
- **A scan or a walk that should include event-less sets** names the narrowest label they share with event nodes. That is `:ListItem` for list items and `:Set` for sets. Otherwise, drop the label from the far end of a relationship whose near end is already found.
- **A query about the event itself** keeps `:NostrEvent`: one that matches by `id`, reads `created_at`, `content` or authorship, or counts events. An example is the Dashboard's event count.
- **`MERGE` can't take a disjunction**, so the three `MERGE` sites get rules of their own:
  - **The import adopts an event-less node at the same address.** Before `MERGE (e:NostrEvent {uuid})`, `buildImportCypher` adds `MATCH (x:TapestryNode {uuid: $uuid}) WHERE NOT x:NostrEvent SET x:NostrEvent`. An event published later for an event-less set attaches to that set's node, as it does today, since today the `MERGE` finds it. The node then has an event, so it carries the label again (D7).
  - **A placeholder is made only when no node holds the address.** The `a`-tag and `b`-tag branches (`eventSync.js:250–283`) first `OPTIONAL MATCH (x:NostrEvent|TapestryNode {uuid: $ref})`, and `MERGE` the placeholder only when that finds nothing. Then they match the target by the disjunction and `MERGE` the relationship. A reference to an event-less set never adds `NostrEvent` back to it, and never makes a second node at its address.
  - **add-subset makes its sets without `NostrEvent`.** It runs `MERGE (s:TapestryNode {uuid: $uuid}) ON CREATE SET s:ListItem:Set, …` plus `keyNode('s')`. Its "address already held" check and its parent lookups use the disjunction. Its tag nodes are `NostrEventTag` with `keyNode`, as now. The uuid uniqueness `nostrEvent_uuid` gave these sets is kept in practice by the import's adoption and add-subset's own held-address check. Nothing enforces it in the database (Consequences).
- **The files** (Context 7). Each line is classified by the rule above, in Implementation, and listed in the PR:
  - in `src/`: `api/normalize/index.js` (133), `firmware/install.js` (28), `api/neo4j/eventSync.js` (13), `api/brain/index.js` (12), `api/audit/index.js` (9), `api/normalize/nodes.js` (8), `api/strfry/tapestryBrainWrite.js` (5), `api/normalize/helpers.js` (4), `api/io.js` (4), `api/property/index.js` (2), and one line each in `api/firmware/index.js`, `api/concept/pullClassThread.js`, `api/concept-graph/index.js`, `api/adoption/index.js` and `api/adoption/editConcept.js`;
  - in `ui/src/`: the 28 files whose Cypher goes through `POST /api/neo4j/query`.

  The four files nothing runs stay as they are.

**10. Backup counts keys by walking the index.** This amends ADR 0002 Decision 4 step 2 for the key counts only; the manifest's fields and the digest's value don't change.

- **When `tapestry_key` is online:** `countGraph` reads the labeled keys in pages of 50,000, in key order from the rule's index (`MATCH (n:TapestryNode) WHERE n.tapestryKey > $after RETURN n.tapestryKey AS k ORDER BY k LIMIT 50000`). It also reads the keys of unlabeled nodes, normally none (`MATCH (n) WHERE NOT n:TapestryNode AND n.tapestryKey IS NOT NULL RETURN n.tapestryKey`), sorted in memory. It merges the two streams in order into an incremental sha256, counting keys, and distinct keys by comparing neighbours.
- **When the rule isn't online,** it counts as today, since the graph then holds no more keys than today's.

The digest is the same string's hash either way (the sorted keys joined by `\n`), so a backup taken before this change still compares exactly on restore. Memory stays at one page.

**11. Who may call.** `owner-and-admins`, at the owner's ruling (story, open question 3), as for status, backup and restore. The route table gives it `access: 'owner'` (ADR 0001 Decision 3). The command runs as a local caller.

## Consequences

**What this enables**

- Every node has a permanent, unique id the database guarantees. A10.4 and the reads (A10.7–A10.15) can name nodes by tapestryKey, and `rules check` can treat "every node has a unique key" as the database's own guarantee, checking only the nodes made outside the instance's paths.
- `NostrEvent` means what D7 says, so import, export and provenance can rely on it.
- Later one-time changes to data are an entry in `_migrations.js`, with backup, lock, job and status included.

**What this constrains**

- **Every new path that makes a node** must use `keyNode`, or its written-out form. The static guard (Implementation notes) fails the suite otherwise.
- **Address lookups use the disjunction** until every instance has run both migrations. A query written later with `(:NostrEvent {uuid})` misses event-less sets; the guard catches it only in the files it reads.
- **Uniqueness of an event-less node's address** is no longer enforced by the database: it isn't a `NostrEvent`, and nothing constrains `TapestryNode.uuid`. The import's adoption and add-subset's held-address check keep it in practice. Raw Cypher could make a second node at the same address. A constraint on `TapestryNode.uuid` was considered and left out, because whether every `uuid` in a real graph is unique across labels hasn't been measured. It can follow once it has (measurement 4).
- **The first migration on production takes the graph offline** for one backup, at an hour the owner picks. Everything after the backup is online.
- **Backups and restores of a migrated production graph** walk about 3 million keys twice (Decision 10). That is online, outside the offline window, and adds an unmeasured but bounded time.

**New debt and follow-ups**

- Narrowing `:NostrEvent|TapestryNode` to `:TapestryNode` once every instance has run both migrations.
- A constraint on `TapestryNode.uuid`, if measurement 4 shows addresses are unique across labels.
- New instances need `tapestry lifecycle migrate --migration tapestry-keys` run once to get the rule. It takes no backup there (Decision 4), so setup could run it. That is left for a follow-up, since setup changes are their own review.
- `initialize` and firmware install's stamping can go when today's routes are retired (D15).

**Firmware reinstall required?** No: no concept definition changes.

## Implementation notes

**New files** (helpers start with `_`, so the loader ignores them):

- `src/operations/catalog/lifecycle/migrate.js` — the declaration (Decision 2). `run` requires its helpers lazily (ADR 0001 Decision 10).
- `src/operations/catalog/lifecycle/_migrations.js` — the two migrations (Decisions 3–5). `plan` and `apply` take `system`, so suites pass a fake.
- `src/lib/tapestry-key-cypher.js` — `keyNode(variable)` (Decision 8), and the label and rule names as constants.

**Changed files:**

- `src/operations/catalog/lifecycle/_jobs.js` — `takeBackup` split out of `runBackupJob`; `runMigrateJob`; `runJob` dispatches `migrate`; `runDetached`'s `opts.waitMs` and the `running` outcome; `countGraph`'s ordered walk (Decision 10).
- `src/operations/catalog/lifecycle/_common.js` — `begin`'s messages for `migrate`.
- `src/operations/catalog/lifecycle/_store.js` — `busyMessage` (Decision 2), and a reader of the newest migrate run per name (Decision 7).
- `src/operations/catalog/lifecycle/status.js` — `parts.migrations` and its schema (Decision 7).
- The paths of Decision 8, and the lines of Decision 9's audit.
- Docs, by the Implementer:
  - **OPERATIONS.md**'s Backups section: run `tapestry lifecycle migrate --migration tapestry-keys`, then `event-less-nodes`, once per instance, at an hour when the backup's offline window is acceptable.
  - **BIBLE §29:** every node carries `TapestryNode` and a key from the moment it is made; `initialize` is no longer how keys arrive.
  - **BIBLE §6:** `NostrEvent` marks nodes that came from an event; event-less sets don't carry it.
  - **ADR 0002:** "Amended by: graph-operations-foundation/0003 (Decision 10)".
  - **The design handoff's** Status line: A10.3.

**For the Tester** (Phase 3's lane):

- The suites go in `test/operations/lifecycle/migrate.test.js` and `_migrations` beside it, run in-process with a fake `system` (ADR 0002 Decision 8's pattern). Status suite P2 changes with Decision 7.
- **A static guard:** a suite that reads every `.js`, `.sh` and APOC file under `src/` and finds each Cypher clause that makes a node (`MERGE` or `CREATE` of a node pattern). It fails when one isn't followed by the key fragment in the same statement, outside an explicit list of the files nothing runs. A second check fails on `(:NostrEvent {uuid` in the files of Decision 9 outside an explicit list of lines classified "about the event".
- **The live check** on a scratch stack (`scripts/scratch-stack.sh`), never a shared or private instance:
  - a fixture with an event-less set nested under another set, a placeholder from an `a` tag, two nodes sharing a key, and a `{}` key;
  - `tapestry-keys`, then `event-less-nodes`;
  - every surface AC6 names: the concept-graph reads by handle, add-subset under an event-less set, the elements list and the set's page data, and a backup and restore after the migration;
  - an import of an event at an event-less set's address, which lands on the same node.
- **Measurements to record in the test plan** before Implementation leans on them:
  1. `EXPLAIN MATCH (n:NostrEvent|TapestryNode {uuid: $u}) RETURN n` uses an index seek on each label, not a scan. If it doesn't, Decision 9's lookups use `CALL { MATCH (n:NostrEvent {uuid: $u}) RETURN n UNION MATCH (n:TapestryNode {uuid: $u}) RETURN n }` instead.
  2. On a scratch instance loaded with 3 million `NostrUser` nodes, and the stream consumer writing during the run:
     - the time of Decision 4's scan;
     - the time of the first pass and how many batches retried;
     - the time for the rule and the index to come online;
     - the time of Decision 10's walk;
     - the backup's offline window.

     If the scan takes more than a few seconds, status reports `withoutKey` from the last run and says so, rather than scanning on every call.
  3. That `keyNode` writes nothing when a node already has both, read from the query's statistics (`propertiesSet`, `labelsAdded`).
  4. On the scratch instance and on staging (read-only, through the public read path of `POST /api/neo4j/query`): how many nodes Decision 5's query finds, how many `NostrEvent` nodes have no `id`, and whether any `uuid` is held by more than one node across labels.

## Out of scope

- Constraining `TapestryNode.uuid` (Consequences).
- Carrying keys through the file export and import (A10.35 and the import operations, D15).
- Copying `name` into `tapestryValue` (D11), `migrate-primary-property-ztags`, and retiring `/api/tapestry-key/*` (D15).
- Running `tapestry-keys` from setup on new instances.
- Nodes made by raw Cypher or outside tools, beyond what a run of migrate finds (AC3).
