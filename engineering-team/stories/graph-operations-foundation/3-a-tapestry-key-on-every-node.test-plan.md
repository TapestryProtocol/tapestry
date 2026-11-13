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
