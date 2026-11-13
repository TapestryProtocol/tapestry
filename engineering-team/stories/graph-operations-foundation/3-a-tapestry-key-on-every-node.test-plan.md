# Test Plan: Story 3 — A tapestryKey on every node

**Story:** `engineering-team/stories/graph-operations-foundation/3-a-tapestry-key-on-every-node.md`
**ADR:** `engineering-team/decisions/graph-operations-foundation/0003-a-tapestry-key-on-every-node.md`
**Date:** 2026-11-13

Every suite is stack-free. The routes and commands run in a child process (`test/helpers/operationsHarness.js`) against a temporary instance (`test/helpers/lifecycleFakes.js`), as in story 2. The fake graph database is extended here to hold each node: its labels, key, event id, address and tag count. It also holds the schema, and answers the queries ADR Decisions 4, 5, 7 and 10 name. The node-making Cypher is checked in two ways: by reading the source (`test/helpers/cypherSites.js`), and by building the import's Cypher and reading that. Some things only a real Neo4j can show: what the fragment does, that an import adopts an event-less set, that a label disjunction uses both indexes, and how long all this takes at production's size. Those are the scratch-stack check and the four measurements at the end. Implementation runs them on the Mac Studio and records them.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1 — tapestry-keys, after a backup | M2 a backup first, then every node keyed and labelled (NostrUser and metrics cards included), real keys kept, the rule and index online · M3 the report's counts · M4 the backup is an ordinary one · M5 the lock held to the last write, the writers running after the backup · M6 the pipeline writing and a batch failing: more passes, every node keyed · K1 a run past its wait answers running | `migrate.test.js`, `migrate-job.test.js` | unit, through the route |
| AC2 — keys already shared | M7 no shared key changes, the rest keyed, the rule and index left out, each shared key named; status says not applied | `migrate.test.js` | unit |
| AC3 — safe to repeat | M8 nothing left: already-applied, no backup, no run, nothing written · M9 new keyless nodes: a backup, keys for them, the rule already there · M14 (its end) the same for event-less-nodes | `migrate.test.js` | unit |
| AC4 — status shows it | M11 before any run · M12 after a run: applied, when, who, the backup · M13 a restored older graph reads not applied, its run kept · M19 a failed run and why · M20, M21 who ran it · P2 the part's shape, from the graph and the run files · P2b the graph down | `migrate.test.js`, `status.test.js` | unit |
| AC5 — new nodes get a key when they are made | G1 the fragment · G2 its variable checked · G3 the names · G4 the static guard over every file the instance runs · G5 the skipped files are unused · G6 the import's Cypher keys every node it makes | `tapestry-key-paths.test.js` | static; built Cypher |
| AC6 — NostrEvent off the event-less nodes | M14 only add-subset's sets lose it, keeping everything else; placeholders and events keep it · M15 before tapestry-keys, refused · G7 the import adopts an event-less node at its event's address · G8 an a or b tag's target looked up before a placeholder is made · G9 every other MERGE by address adopts first · G10 add-subset makes a TapestryNode, never a NostrEvent · G11 every lookup by address names NostrEvent\|TapestryNode, or is kept with why · **the live check** | `migrate.test.js`, `tapestry-key-paths.test.js` | unit; static; live |
| AC7 — refusals, callers, the command | M1 the declaration · M16 unknown migration · M17 busy, and backup's busy naming the migration · M18 graph-unavailable · M19 a failed backup ends the run · M20 owner and admins; visitor 401, stranger 403 · M21 the command · M22 how long each waits | `migrate.test.js` | unit |
| ADR Decision 10 — backup walks the keys | K3 with the rule online, pages of 50,000, never all at once, the same digest · K4 restore compares by the walk; a backup written the A10.2 way matches · K5 with no rule, as before | `migrate-job.test.js` | unit, 100,003 keys |
| ADR Decision 1 and the docs | G12 firmware install doesn't wait for the rule · G13 OPERATIONS.md, BIBLE §29 and ADR 0002's amendment note | `tapestry-key-paths.test.js` | static |

## Gaps the ADR left, closed here

The tests below pin four answers the ADR doesn't give. The owner confirmed all four at this gate (2026-11-13), with the test plan.

1. **The direct importers adopt too** (G9). Decision 9 makes `buildImportCypher` adopt an event-less node at an event's address. The signing routes don't import through it, though: they use `importEventDirect` in `src/api/normalize/helpers.js:75` and in `src/api/normalize/index.js:144`. Both `MERGE (e:NostrEvent {uuid: $uuid})` too. Once `event-less-nodes` has run, an event signed at an event-less set's address would get a second node beside the set. G9 requires every `MERGE` of a `NostrEvent` by its address to adopt first, the same way.
2. **The backup part's last run stays a backup or a restore** (M12). Without a filter, `store.lastRun()` would report a migrate run as status's last backup run. The backup part's description says "the most recent backup or restore run". The migrate's backup still shows as the backup part's `last`.
3. **event-less-nodes' report** is `{ relabelled, addresses }`: how many nodes lost the label, and the first 20 addresses (M14). The ADR gives what the report holds, not its fields.
4. **A running answer's note** says where to see how the run goes (M23).

## Edge cases

- [x] Concurrent calls: a live lock refuses migrate (M17), and backup refuses while a migration holds the lock (M17). Every write happens while the run's lock is held (M5).
- [x] Graph unavailable: refused before anything stops (M18). Status's part throws rather than counting zeros (P2b).
- [x] A failure before anything changes: the backup's dump (M19).
- [x] Failures and writes during the run: a deadlocked batch, and nodes the pipeline makes between passes (M6).
- [x] Keys shared before the run (M7), the `'{}'` placeholder (M2, M3, P2), and nodes that have the label but no key (P2).
- [x] Restoring an older graph after a migration (M13).
- [x] Sizes: 100,003 keys for the walk (K3, K4).
- [x] A variable name that isn't one can't be spliced into Cypher (G2).
- [x] Tests that assert something did *not* happen also assert the path ran. For example, M8 checks that the first run did run, M18 that the graph was asked, M19 that the dump was attempted, and P2b that the part counts when the graph answers.

## The test-facing contract (what the suites rely on, from the ADR)

The Implementer must keep these, or the suites can't drive the code.

- **The fragment** is `keyNode(v)` in `src/lib/tapestry-key-cypher.js`. Whitespace aside, it is exactly ADR Decision 8's text. The module also exports constants whose values are `'TapestryNode'`, `'tapestry_key'` and `'tapestry_node_uuid'`.
- **Where the fragment goes** (G4): in the same Cypher literal as the clause that makes the node, written out or as `${keyNode('v')}`, or in the same JavaScript statement as that literal (`` `…` + keyNode('v') ``). In shell scripts and APOC files it goes inside the same double-quoted statement. `eventSync.js` builds its Cypher at run time, so G6–G8 read what it builds instead.
- **The adoption** (G7, G9) is either a statement or call of its own before the `MERGE`, which makes nothing: `MATCH (x:TapestryNode {uuid: …}) WHERE NOT x:NostrEvent SET x:NostrEvent`. Or it is an `OPTIONAL MATCH (x:TapestryNode {uuid: …})` that sets `x:NostrEvent`, ahead of the `MERGE` in the same statement. A bare `MATCH` in the same statement would stop the import whenever it found nothing.
- **Lookups by address** (G11) are written `(:NostrEvent|TapestryNode {uuid: …})`. The ones that are about the event itself go in `test/operations/lifecycle/nostr-event-lookups-kept.json`, as `{ "kept": [ { "file", "text", "reason" } ] }`. `text` is the line exactly as it stands, trimmed, and `reason` is at least a few words saying why the lookup is about the event. The Reviewer reads that list.
- **The queries the fake knows** are listed in `test/helpers/lifecycleFakes.js`'s header. They are Decision 4's counts, `SHOW CONSTRAINTS` and `SHOW INDEXES`, the `CREATE CONSTRAINT tapestry_key …` and `CREATE INDEX tapestry_node_uuid …` statements, the two `apoc.periodic.iterate` passes, the shared-keys query (columns `k`, `c`, `ids`), Decision 10's walk (`$after`, `LIMIT`), the unlabelled keys, and Decision 5's query. A query it doesn't know throws, saying so.
  - The keys pass must call `randomUUID()`.
  - Polling waits through `system.sleep`.
  - Every query goes through `system.cypher(query, params)`.
- **The answer** is `{ migration, state, runId, backup, report, note }`:
  - `state` is `done`, `running` or `already-applied`;
  - `backup` is an id or null;
  - `report` is null when `state` is `running` or `already-applied`;
  - an `already-applied` note says "already applied".
- **tapestry-keys' report** is `{ before, after, keysGiven, labelsGiven, placeholdersReplaced, passes, failedBatches, rule, index, sharedKeys }`:
  - `before` and `after` are `{ nodes, withLabel, withoutKey }`;
  - `rule` and `index` are each `added`, `already-there` or `left-out`;
  - each entry of `sharedKeys` is `{ key, count, nodes }`.
- **A failed backup** answers 500 `failed`, whose error contains "The backup before migration <name> failed" and "nothing was changed".
- **runDetached** takes `opts.waitMs`:
  - the route passes `wait × 1000`, 50,000 by default;
  - the command passes nothing unless given `--wait`;
  - past the wait it resolves `{ outcome: 'running' }` and leaves the lock to the job.

  The harness logs what was passed.
- **A migrate run's file** carries `op: 'migrate'`, `migration`, `by` (the caller's pubkey, or `'local'`), `startedAt`, and, at the end, `outcome`, `finishedAt`, and `result` or `error`. `result.backup` is the backup's id.
- **Status's migrations part** is `{ known, keys: { nodes, withLabel, withoutKey, rule, index }, migrations: [...], note }`:
  - each entry of `migrations` is `{ name, summary, applied, requires, lastRun }`;
  - `lastRun` is `{ runId, startedAt, finishedAt, outcome, by, backup, error }` or null;
  - `tapestry-keys` comes first;
  - with no run, the note says "no migration has run" and names both.
- **busyMessage** names a migration when the lock's op is `migrate`.
- **The backup before a migration** has `reason: 'requested'`, and a note containing "Before lifecycle migrate <name>".

## Test infrastructure

- **Node's own runner style.** Each suite exports `run()`, and `test/operations.test.js` finds every suite under `test/operations/`, so `test/registry.js` is unchanged.
- **`test/helpers/lifecycleFakes.js` (extended).**
  - `nodeGraph`, `gnode`, `migratedSchema` and `keysOf` build node-level graphs.
  - The fake answers the queries above, and dumps and loads node-level graphs with their schema.
  - New knobs: `failures.indexPolls`, `keysPassFailsOnce` and `writesBetweenPasses`.
  - Each cypher call logs the lock's stage.
  - The coarse graph and every rule the backup suites use are unchanged: their 141 tests pass on the extended fake.
- **`test/helpers/operationsHarness.js` (extended).** Its in-process `runDetached` logs `{ call: 'runDetached', op, runId, waitMs }`. With `lifecycleFake.detachedOutcome: 'running'` it answers running after the job.
- **`test/helpers/cypherSites.js` (new).** A small scanner of the string literals in JavaScript, shell and APOC files, and of the node patterns in CREATE and MERGE clauses. It finds all 69 node-making sites in 34 files under `src/` today. G4 checks that it still finds every file known to make nodes, so a scanner gone wrong fails loudly.
- **No running stack, no container, no network.** Every service endpoint is dead in each child's environment. **Firmware state:** none. **Concept Graph API:** not used.

## How to run

On the Mac Studio, don't run the full `npm test`, since its live suites reach the private instance on :7778. Run the operations suites, which include these:

```
node -e "require('./test/operations.test.js').run().then(r => process.exit(r.fail ? 1 : 0))"
```

or one suite at a time, for example `node test/operations/lifecycle/migrate.test.js`. CI runs the stack-free gate on the pull request.

### The live check and the measurements, run in Implementation

Run on a throwaway instance (`scripts/scratch-stack.sh`), from a worktree under `/Users`, never a shared or private instance. Ask before pausing `vespa` and `brainstorm-graperank` for memory. Copy in `bin/tapestry.js` as in story 2.

1. **Measurement 1, the disjunction.** Run `EXPLAIN MATCH (n:NostrEvent|TapestryNode {uuid: $u}) RETURN n` after `tapestry-keys`. Pass when the plan seeks both `nostrEvent_uuid` and `tapestry_node_uuid`, with no label or all-nodes scan. If it doesn't, Decision 9's lookups use the `CALL { … UNION … }` form, and G11 accepts it once its pattern is added.
2. **Measurement 3, the fragment writes nothing on a node that has both.**
   - Run `MERGE (u:NostrUser {pubkey: 'x'})` plus `keyNode('u')` twice.
   - Pass when the first run's statistics show `labelsAdded: 1, propertiesSet: 1` and the second's 0 and 0.
   - Then put `'{}'` on the node and run it again: the key is replaced.
3. **The live check (AC6, AC1).** Build the fixture first, before any migration:
   - an event-less set under a concept's superset (add-subset), and one nested under it;
   - an event with an `a` tag whose target doesn't exist (a placeholder);
   - one node keyed `'{}'`;
   - a few NostrUser nodes from the stream.

   Note `lifecycle status`. Run `tapestry lifecycle migrate --migration tapestry-keys`, then `--migration event-less-nodes`. Pass when:
   - status shows both applied, with their backups;
   - every node has `TapestryNode` and a key: `MATCH (n) WHERE NOT n:TapestryNode OR n.tapestryKey IS NULL RETURN count(n)` gives 0;
   - only the two sets lost `NostrEvent`, and the placeholder keeps it;
   - every surface AC6 names still works for the sets:
     - the concept's elements;
     - the set's page data, the UI's own read Cypher in `ui/src/pages/reading/readVerbs.js`;
     - add-subset under the event-less set;
     - a backup and a restore, with `match: true`;
   - an event imported at one set's address (sign it through a normalize route, or publish one with its d tag) lands on the same node:
     - one node holds that `uuid`;
     - it carries `NostrEvent` again, and keeps its key;
   - a new event, a new NostrUser and a new add-subset set each have a key and the label as soon as they exist, with no migrate run in between;
   - with two nodes given the same key by Cypher, a run of a fresh instance's `tapestry-keys` leaves the rule out and names the key (AC2).
4. **Measurement 2, production's size** (Decision 4, Consequences). On a scratch instance only, load 3 million `NostrUser` nodes with no key, in batches. Then run `tapestry-keys` while a loop writes NostrUser nodes through the stream consumer's Cypher. Record:
   - the time of Decision 4's scan;
   - the backup's offline window;
   - each pass's time, and its retried or failed batches;
   - the time for the rule and the index to come online;
   - Decision 10's walk, in a later backup;
   - the store's size before and after.

   If the scan takes more than a few seconds, status reports `withoutKey` from the last run, saying so, and M11's expectation changes with it.
5. **Measurement 4, today's graphs.** These are read-only, through the public read path of `POST /api/neo4j/query`. They run on the scratch instance, and on staging only with the owner's OK, since the third is a full scan:
   - `MATCH (n:NostrEvent) WHERE n.id IS NULL AND (n)-[:HAS_TAG]->() RETURN count(n)`: Decision 5's nodes;
   - `MATCH (n:NostrEvent) WHERE n.id IS NULL RETURN count(n)`: those plus the placeholders;
   - `MATCH (n) WHERE n.uuid IS NOT NULL WITH n.uuid AS u, count(*) AS c WHERE c > 1 RETURN count(*)`: addresses held by more than one node.

Record each result in the story's Evidence section, and in this plan's Verification.

## Verification

The new tests fail with the current code, for the reasons they should. The run was on 2026-11-13, on the tree of this commit (branch `A10.3-tapestry-key-every-node`, base `6c57ec1f`), on Node 22.23.4, in the cloud workspace, where nothing listens on any service port:

```
=== operations: lifecycle migrate ===                   0 passed, 23 failed
    M1–M23   src/operations/catalog/lifecycle/migrate.js does not exist yet (ADR …0003 Decision 2)
=== operations: lifecycle migrate job and key walk ===  1 passed, 4 failed
    K1  runDetached answers { outcome: 'running' } past its wait; got {"rec":{"outcome":"done",…},"took":4040}
    K2  passes: it pins what runDetached already does when the job ends within the wait
    K3  … each in at least 3 pages of 100,001 keys; got 0 pages
    K4  … got 0 pages (its first check, match: true on 100,003 keys, passes on today's code)
    K5  backup asks whether the rule is online
=== operations: tapestry keys on every node ===         2 passed, 11 failed
    G1–G4, G6  src/lib/tapestry-key-cypher.js does not exist yet (ADR …0003 Decision 8)
    G5   passes: the skipped files are unused (the entrypoint names setup.sh only in a comment)
    G7   item: before MERGE (e:NostrEvent {uuid: '39999:…:item-1'}), a statement adopts the node at that address …
    G8   39999:…:elsewhere: not looked up by NostrEvent|TapestryNode in "MATCH (t:NostrEventTag …) MERGE (ref:NostrEvent …"
         (and the b tags' parent, target and event id)
    G9   src/api/normalize/helpers.js:75, src/api/normalize/index.js:144, src/api/normalize/nodes.js:203:
         MERGE of a NostrEvent by its address with no adoption before it
    G10  it MERGEs (s:TapestryNode {uuid: $uuid}); got ["MERGE (s:NostrEvent {uuid: $uuid})", …]
    G11  236 lookups by address name only NostrEvent … (listed, the first 40)
    G12  passes: it guards what firmware install already doesn't wait for
    G13  OPERATIONS.md says to run `tapestry lifecycle migrate --migration tapestry-keys` …
=== operations: lifecycle status ===                     7 passed, 2 failed
    P2   keys is { nodes: 3, withLabel: 2, withoutKey: 2, … }; got {"known":true,"applied":[],"note":"No migration has been recorded …"}
    P2b  the part throws … or answers known: false; got {"known":true,"applied":[],…}
=== operations ===                                       143 passed, 40 failed
```

The backup, restore, list, download, upload and job suites, story 2's 141 tests, pass unchanged on the extended fake and harness. The whole run takes about a minute here, K3–K4's 100,003-key graph included.

### The live check and the measurements (Implementation, 2026-11-13, on `9b4bdfb7`)

These ran on the Mac Studio on two throwaway instances from `scripts/scratch-stack.sh`, one after the other, never a shared or private one. Neither instance published a port. Every call went over the container's own loopback, and each instance was removed afterwards.

- **The instances.**
  - Both booted from `SCRATCH_IMAGE=agent-memory-tapestry`, built 2026-10-31. The default `tapestry-tapestry` (2026-08-28) has no `cron-parser` in its `package.json`, and the branch's has (OPEN.md row `2026-10-31-scratch-stack-image-and-lib-mount`).
  - `src/` was mounted from a detached worktree under `/Users`, and the branch's `bin/tapestry.js` and `bin/control-panel.js` were copied in.
  - Neo4j 5.26.10 ran at the script's sizes: a 1,024 MB heap, a 512 MB page cache and a 512 MB transaction limit. The Docker VM has 4 CPUs and 23.4 GiB. Between 3.7 and 4.6 GB stayed free throughout, so `vespa` and `brainstorm-graperank` were not paused.
  - A fresh instance has none of the indexes `setup/neo4jConstraintsAndIndexes.sh` makes, `nostrEvent_uuid` among them, until that task runs. Production's graphs have them, so each instance ran the task first, through `POST /api/neo4j-setup-constraints-and-indexes` (OPEN.md row `2026-11-13-scratch-stack-indexes-and-volume`).
- **No Cypher failed on Neo4j.** That includes the import's adoption and placeholder statements, add-subset's write, the stream consumer's, both migrations' passes, the rule and the index, the walk and the stream.
- The checks ran through small throwaway scripts inside the container. They used the instance's own modules (`keyNode`, the driver, `countGraph`, the Tapestry Assistant's signer), and none of them is committed.

**Instance A: the live check, measurements 1 and 3, Amendment 1's index, and measurement 4 on scratch.**

The fixture was built with staging's code. The mounted worktree was at `f3aab4d4`, this branch's base, because on this branch add-subset makes its sets without `NostrEvent`, which would leave `event-less-nodes` nothing to change.
- Firmware installed: 3,145 nodes, 2,533 of them with a key, none with `TapestryNode`.
- Sets A ("Live check set A", under the `tag` concept's superset) and B (nested under A), made by add-subset: each is `NostrEvent:ListItem:Set` with no `id`.
- An event signed with a throwaway key, whose `a` tag names an address nothing holds, imported by `POST /api/neo4j/event-update`. Its placeholder is a `NostrEvent` with no `id`, no key and no tags.
- `'{}'` and a cache stamp, put on one firmware `ListItem` by Cypher.
- Two follow lists through the stream consumer, which made 3 `NostrUser` nodes with no key.
- In all, 3,166 nodes, 634 of them without a key.

Then the worktree moved to `9b4bdfb7` and the Node programs were restarted (`brainstorm`, `stream-consumer`, `tagging-edges-realtime`, `nip50-proxy`), as a deploy would restart them.

1. **Measurement 1, the disjunction: passes.** `EXPLAIN MATCH (n:NostrEvent|TapestryNode {uuid: $u}) RETURN n` plans as `Distinct` over a `Union` of `NodeUniqueIndexSeek n:NostrEvent(uuid)` and `NodeIndexSeek RANGE INDEX n:TapestryNode(uuid)`. There is no label scan or all-nodes scan. The plan is the same before migrate, after `tapestry-keys` on instance A's 3,166 nodes, and after it on instance B's 3 million. On B, `PROFILE` with a real address returns its node.
   - **Amendment 1, the index at startup: passes.** Before the restart, `SHOW INDEXES WHERE name = 'tapestry_node_uuid'` listed nothing. After it, with no migrate run, the index is there: RANGE on `TapestryNode(uuid)`, ONLINE, and no `tapestry_key` rule. The control panel logged `[tapestry-keys] index tapestry_node_uuid created (on TapestryNode.uuid, for lookups by address; it comes online by itself)`. The disjunction already seeks both indexes, and `tapestry-keys` later reported `index: 'already-there'` on both instances.
2. **Measurement 3, the fragment: passes.** These are the statistics of `MERGE (u:NostrUser {pubkey: 'x'})` plus `keyNode('u')`, in the module's own text, on a node first made by raw Cypher with no key:
   - the first run: `labelsAdded: 1, propertiesSet: 1`;
   - the second run: 0 and 0, with `containsUpdates: false` and the same key;
   - with `'{}'` put on the node: `labelsAdded: 0, propertiesSet: 1`, and the key is a new v4 UUID; the next run is 0 and 0;
   - where the `MERGE` makes the node itself: `nodesCreated: 1, labelsAdded: 2, propertiesSet: 2`, then 0 and 0.

   The test nodes were removed afterwards.
3. **The live check (AC6, AC1).** Every point passes except the `set` concept's Elements tab (finding 1 below).
   - **Status before any run.** The migrations part's keys are `{ nodes: 3166, withLabel: 0, withoutKey: 634, rule: false, index: true }`, and both `lastRun` are null. The note reads "No migration has run yet. Applied: event-less-nodes. Can run now: tapestry-keys" (finding 2).
   - **`--migration event-less-nodes` first** is refused: 409 `run-tapestry-keys-first`, with its sentence, and exit 1. No backup and no run file was made.
   - **`tapestry-keys`** was done in 29.2 s by the command; the job took 28.9 s.
     - The backup `20261113T170208Z-36087224` came first. Its note is "Before lifecycle migrate tapestry-keys", its reason `requested`. The graph was offline 19.3 s, and the counts were exact.
     - The report: `keysGiven: 634, labelsGiven: 3166, placeholdersReplaced: 1, passes: 1, failedBatches: 0, rule: 'added', index: 'already-there', sharedKeys: []`.
     - Checked node by node against a snapshot from before the switch: all 2,532 real keys are unchanged, and the 633 null keys were given keys. The `'{}'` was replaced and its cache stamp removed. No key is held twice.
   - **`event-less-nodes`** was done in 27.5 s; the job took 27.1 s, with the graph offline 17.9 s. Its backup is `20261113T170352Z-c368852c`, and its report `{ relabelled: 2, addresses: [A, B] }`.
   - **Status after.** Both migrations are applied, each with its `lastRun` (`done`, `by: 'local'`, its backup). The keys are `{ 3166, 3166, 0, rule: true, index: true }`, and the note reads "Applied: tapestry-keys, event-less-nodes."
   - **Every node has the label and a key.** `MATCH (n) WHERE NOT n:TapestryNode OR n.tapestryKey IS NULL RETURN count(n)` gives 0, and so does the same count with `'{}'` added.
   - **Only the two sets lost `NostrEvent`.** A node-by-node diff of labels shows exactly A and B going from `NostrEvent:ListItem:Set:TapestryNode` to `ListItem:Set:TapestryNode`, and no key changed. The placeholder keeps `NostrEvent`.
   - **The surfaces, before and after the migration.** Each read used the UI's own Cypher. The `useCypher` templates came from `ConceptElements.jsx` and `SetDetail.jsx`, filled as the pages fill them. `readVerbs.js`'s `group` and `node` ran as written, with only their imports pointed at a loopback client.
     - **Set Detail for A and B:** the set, its supersets, its subsets and its elements are the same before and after.
     - **`group` and `node` for A and B:** the same documents, with the same role, `inside`, kinds, members and neighbours.
     - **The `tag` concept's Elements tab** lists A and B among its sets, before and after.
     - **The `set` concept's Elements tab fails.** Its explicit and implicit element queries end on `(e:NostrEvent)` (`ConceptElements.jsx:70` and `:81`). After the migration A and B drop out of both lists, which go from 100 rows to 98. As written, the explicit query finds 98; without that label it finds 100. Set C, made by this branch's add-subset, never appears there at all (finding 1).
     - **The concept-graph API still finds A, B and C:** `/api/concept-graph/node/:handle/neighbors` on the `set` superset, and `/node/:handle` on B.
     - **add-subset under B** made set C: `ListItem:Set:TapestryNode`, with a key and no `NostrEvent`, its tag nodes keyed, and registered under `set`.
     - **A backup and a restore.** The backup `20261113T170552Z-d1d33f0c` held 3,172 nodes and keys, with the graph offline 18.0 s. Restoring it: transaction 6999 recorded and loaded, counts and digest exact, `match: true`, the graph offline 25.4 s, and the safety backup `20261113T170632Z-4cc62419`. Every node's `elementId`, labels, `uuid`, key and `pubkey` are as they were before the restore, A, B and C among them.
   - **An event at a set's address lands on the set.** An event was signed as the Tapestry Assistant with A's `d` tag and its `name`, `z`, `s` and `description` tags, put in strfry, and imported by `POST /api/neo4j/event-update` (`buildImportCypher`).
     - One node holds A's address, with the same `elementId` as before.
     - It carries `NostrEvent` again and keeps its key. It has the event's `id`, its 5 tags, and its parent, child and `AUTHORS` edges.
     - The same holds for B, imported through `importEventDirect`, the signing routes' importer.
   - **New nodes have the label and a key as soon as they exist,** with no migrate run in between.
     - A new event came in through the event route, signed with a throwaway key. It had an `a` tag to an address nothing holds, an `a` tag to set C, and an `e` tag to an unknown id.
     - The event, its 5 tag nodes and its author each have the label and a key.
     - The first `a` tag made one keyed placeholder (`NostrEvent:TapestryNode`). The second references C, with no second node at C's address and no `NostrEvent` given to C. The `e` tag made a keyed placeholder by `id`.
     - A new follow list through the stream consumer made two `NostrUser` nodes with the label and a key, and the existing user it touched kept its key.
     - Set C is the third new node (above).
   - **AC2, on a fresh instance (B).** Two firmware `ListItem` nodes were given the same key by Cypher.
     - `tapestry-keys` answered `done` in 0.5 s, with no backup, since nothing else would change: `passes: 0, rule: 'left-out', index: 'already-there', sharedKeys: [{ key: '21e69db6-…', count: 2, nodes: [both elementIds] }]`.
     - No key changed, and `SHOW CONSTRAINTS` has no `tapestry_key`. The note says the index "were left out" (finding 3).
     - The second node's own key was then put back for measurement 2.

**Instance B: measurements 2 and 5.**

4. **Measurement 2, production's size.** 3,000,000 `NostrUser` nodes, each with a `pubkey` and no key or label, were loaded by raw Cypher in 60 batches of 50,000, in 35.9 s: 3,003,145 nodes in all. While `tapestry-keys` ran, a loop put 5 follow lists a second on the stream consumer's Redis queue. Each list was by a new user and followed 10 loaded users and 10 new ones. The instance's own consumer wrote them with its own Cypher, `keyNode` included.
   - **Decision 4's scan** took 0.63 s, then 0.47 s and 0.42 s, over 3,003,145 nodes (3,000,000 of them without a key). A whole `tapestry lifecycle status` took 1.2–1.4 s. That is far under "a few seconds", so status keeps scanning on every call, and M11 stands.
   - **The run** took 58.7 s by its run file, 59.5 s by the command. Before it, by its report: 3,005,851 nodes, 8,310 with the label, 2,997,500 without a key. After it: 3,007,677 nodes, all 3,007,677 with the label, 0 without a key.
   - **The backup's offline window was 24.1 s.**
     - Stopping Neo4j and the dump took the first 11 s, and starting Neo4j again and waiting for it to answer took the other 13 s. The dump was 406.7 MB, and the counts were exact.
     - The job's start to the window took 1.9 s. From the graph answering again to the next plan took 8.2 s: the second `countGraph`, then restarting the writers.
     - The stream consumer was paused for about 33 s in all. 124 lists queued in Redis meanwhile, and they were drained within 20 s of its restart.
   - **The passes:** one pass, 17.4 s with the counts after it, and `failedBatches: 0`.
     - The job's report has no field for retried batches (finding 4). So the identical statement was run again directly, with APOC's `retries` added to its `YIELD`. It ran on all 3,004,887 users, after their keys and labels were stripped, while the loop wrote.
     - That run gave 301 batches, 3,004,256 committed, 0 failed and **0 retries**, in 16.0 s.
     - Through both runs the consumer logged no errors, and Neo4j's `debug.log` has no deadlock.
   - **The rule and the index.** The index was already there from startup (Amendment 1). The rule went from `CREATE` to ONLINE over 3,007,677 keys in 5.1 s: POPULATING 6% at 0.45 s, 100% at 4.6 s.
   - **The report:** `keysGiven: 2997325, labelsGiven: 2997282`. It also says `placeholdersReplaced: 132`, on an instance where no path ever wrote `'{}'` (finding 5).
   - **Decision 10's walk, in a later backup.** The backup `20261113T171714Z-e66b681e` held 3,008,029 nodes and keys, with counts exact.
     - `countGraph` alone took 4.9–5.0 s, at a peak of 195–203 MB RSS.
     - The backup took 41.1 s in all: 5.3 s before the offline window, 22.7 s offline and 12.8 s after.
     - The worker's peak was 241 MB, and the dump was 725.6 MB.
   - **The store.** `databases/neo4j` was 1,011,096,160 bytes before the run and 1,313,361,920 after, a 30% rise. The transaction logs went from 820,336,321 bytes to 1,360,979,567.
   - **How far this carries to production.** This graph has 12,475 relationships, where production has the follow graph's millions, and this Neo4j's memory is small. The offline window grows with the store, so production's will be longer than 24 s. The passes and the rule grow with the node count.
5. **Measurement 4, today's graphs.** These ran on instance A after the fixture and before any migration, through the public read path: `POST /api/neo4j/query` on loopback, with an `X-Forwarded-For` header, so the request is treated as remote.
   - Decision 5's nodes: 2 (A and B).
   - `NostrEvent` nodes with no `id`: 3 (A, B and the placeholder). The firmware graph alone had 0.
   - Addresses held by more than one node: 0.
   - **On staging**, with the owner's OK: 2026-11-13 at 18:39 UTC, the same three queries through staging's public read path (`https://staging.brainstorm.world/api/neo4j/query`, from the Mac Studio). The times are curl's, round trip included.
     - Decision 5's nodes: 0, in 0.4 s.
     - `NostrEvent` nodes with no `id`: 2, in 0.1 s. Both are placeholders.
     - Addresses held by more than one node: 0. The full scan took 5.9 s.
     - So on staging today, `event-less-nodes` would relabel nothing, and no node would drop out of the `set` concept's Elements tab at migrate. Finding 1 still holds for the sets add-subset makes after the deploy.
6. **Measurement 5 (Amendment 2), the key read before migrate.** This ran on instance B after measurement 2, with the rule dropped (`DROP CONSTRAINT tapestry_key`). That leaves a graph keyed to production's size with no rule, as it will be between the deploy and migrate: 3,008,029 nodes, every one keyed and labelled, with the index still there.
   - `countGraph` alone, through `cypherEach`, took 5.9–6.0 s. It peaked at 373–380 MB RSS (68–69 MB before it ran) and 287 MB of heap, and gave the same counts and digest as the walk (`sha256:ae215bce…`).
   - In a backup (`20261113T171843Z-51888c2f`, counts exact), it took 44.3 s in all: 6.6 s before the offline window, 23.4 s offline and 14.0 s after. **The worker's peak (VmHWM) was 412 MB.**
   - For comparison, A10.2's read ran on the same graph. That is staging's `countGraph`, which takes one `runCypher` of every key, a `Set` and a joined string. It took 9.3 s and peaked at 1,662 MB, with the same digest. The stream needs about a quarter of that. Amendment 2's "about 200 MB" is low: the strings, the array, the sort and the driver come to about 400 MB.

**Findings for the Implementer and the Reviewer.** They are recorded here, and no code was changed.

1. **AC6: the `set` concept's Elements tab drops event-less sets.** `ConceptElements.jsx`'s explicit and implicit element queries end on `(e:NostrEvent)`, at lines 70 and 81.
   - After `event-less-nodes`, the migrated sets leave that tab, and sets made by this branch's add-subset never reach it.
   - The two lines aren't in `nostr-event-lookups-kept.json`, and G11 reads only lookups by `{uuid`, so no test sees them. This is Decision 9's far-end case: "drop the label from the far end of a relationship whose near end is already found".
   - `readVerbs.js` ends on `(m:NostrEvent)` the same way in `node`'s neighbour query (line 508) and in `plan`'s (lines 572–573). This check didn't exercise them, because the fixture had no typed links.
2. **Before `tapestry-keys`, status calls `event-less-nodes` applied.** Its query requires `n:TapestryNode`, which no node has yet. So the note says "Applied: event-less-nodes" while two sets still carry `NostrEvent`. Migrate still refuses it correctly, because it checks `requires` first.
3. **The shared-keys note says the index "were left out"** when the report says `index: 'already-there'`. Once Amendment 1's startup hook has run, the index is always already there.
4. **The report can't show retried batches.** `runKeysPass` doesn't yield APOC's `retries`.
5. **`placeholdersReplaced` counts other writers' keys.** It is `withoutKey` minus `nullKeys`, read by two scans at different moments. With the consumer keying nodes between the scans, it reported 132 where there were none.

## Amendment 1 (2026-11-13, at Implementation, approved by the owner)

Implementation found four tests that contradicted the approved ADR. An Implementer may not change tests, so they came back here. The owner approved each change as drafted. With them, every suite passes except `setup-alert-polish` S2, which already fails on `staging` (`ui/src/pages/reading/writeVerbs.js` posts to `/api/strfry/publish` by hand; it isn't this story's).

| Test | Was | Now | Why |
|---|---|---|---|
| G8 (this plan) | checked every statement that held a reference's address | checks only the statements that look the address up (`{uuid: '<ref>'}`) | the statement that makes the tag nodes holds the address as the tag's value, which isn't a lookup |
| H1 (`test/operations.test.js`, story 1) | expected the migrations part's old shape, `{ known: true, applied: [], note }` | stubs the migrations part, as it stubs firmware and cache | the part reads the graph since Decision 7; its shape is P2's and migrate.test.js's to check |
| SWR15 (`test/tagging-edges-wiring.test.js`, tagging-edges #2) | no `SET` on a node in the pass | takes out the exact `keyNode(x)` for each merged person before reading the clauses; anything else still fails | Decision 8 keys the people the pass adds (`MOVE`, `CREATE_IF_ABSENT`) |
| `event-less-create-set` S1 and its live checks (node-primitives #1) | `nodes.js` required exactly five modules; a new set carried `NostrEvent`; the suite found sets by `:NostrEvent {uuid}` | allows `lib/tapestry-key-cypher`, which builds Cypher text and requires nothing; expects `TapestryNode`, `ListItem` and `Set` and no `NostrEvent`; finds nodes by `NostrEvent\|TapestryNode` | Decision 9: add-subset makes its sets as `TapestryNode`, without `NostrEvent` |

**New tests, for ADR 0003 Amendment 1** (the index `tapestry_node_uuid` at control-panel start, the owner's ruling), in `tapestry-key-paths.test.js`, stack-free with an injected runner:

- **G14** — a missing index is made with Decision 1's statement in a call of its own; no rule and no data are written.
- **G15** — an index already there is left alone; a name held by another definition is never replaced, and is logged `not created: name-taken`.
- **G16** — while the graph isn't answering it retries, waiting no less each time, then makes the index once; past its window it answers `gave-up` with one line; an error that isn't the graph starting stops it with no retry; it never rejects.
- **G17** — `bin/control-panel.js` calls `ensureUuidIndexOnBoot` once the routes are registered, without awaiting it.

Live check, added to step 1: after a restart of the scratch stack on this branch, `SHOW INDEXES WHERE name = 'tapestry_node_uuid'` lists it before migrate has run, and `EXPLAIN` of a disjunction lookup seeks both indexes.

## Amendment 2 (2026-11-13, at Review round 1, for ADR 0003 Amendment 2)

Review round 1 (Blocking 1) found that a backup taken before the rule exists reads every key in one query, and that keyNode makes that millions of keys on production. The owner ruled that the read becomes a stream. Tests:

- **K5**, sharpened: with no rule, each read of every key goes through `system.cypherEach` (the fake's log entry is marked `streamed`), never through `cypher`, and the counts and digest are as before. The fake system gains `cypherEach`, which answers and logs as `cypher` does, so story 2's traces (`count:keys`) are unchanged.
- **K6**, new: `_system.cypherEach` reads through `lib/neo4j-driver`'s `streamCypher`. Run in a child process with the `neo4j-driver` package replaced, each record reaches `onRow` as a plain object, in order. The result is subscribed to, never awaited whole, and the read session is closed once.

Measurement 5 adds: on a scratch graph keyed to production's size, before migrate, the time and the worker's peak memory of `countGraph`, which a backup runs twice.
