# Test Plan: Story 9 — `tapestry-keys` finishes on a large graph whatever the transaction limit

**Story:** `engineering-team/stories/graph-operations-foundation/9-tapestry-keys-within-transaction-memory.md`
**ADR:** `engineering-team/decisions/graph-operations-foundation/0009-shared-keys-from-a-stream-of-hashes.md` (amends ADR 0003, Decision 4)
**Date:** 2026-11-16

## Coverage map

All of it is in one suite, `test/operations/lifecycle/shared-keys.test.js`. `test/operations.test.js` finds it, as it finds every suite under `test/operations/`.
- **Stack-free cases (SK)** run on every run, CI included, through the lifecycle fake.
- **Live checks (LK)** run only on a scratch stack in staging's shape, with `TAPESTRY_KEYS_LIVE=1`.

| Criterion | Test | Level |
|---|---|---|
| AC1 — staging's shape, with no rule | SK1: with no rule, the keys are read once, as a stream; nothing is grouped; nothing more is read when no key is shared; the rule is added and status reads it applied | stack-free |
| | LK1: on 3.85 million keyed nodes with the rule dropped, `done` with no backup; the rule `added` and the index there or added, both `ONLINE`; no key given; none shared; status applied | live |
| AC2 — production's shape | LK4: every second `NostrUser`, and every card set and card, with no key and no label (2,294,384 nodes), and no rule. It takes its backup, gives every stripped node a key and the label (`keysGiven` = `labelsGiven` = the stripped count), adds the rule and the index, both `ONLINE`, and leaves no node without either; status applied | live |
| AC3 — shared keys at that size | SK2: with no rule, a key on two nodes and one on twelve are named in key order, with counts 2 and 12 and up to ten nodes each. Neither key changes, the rule is left out, status reads not applied | stack-free |
| | SK3: with more than 100 shared keys, the answer is the first 100 in key order, each count exact | stack-free |
| | SK4: with the rule in place, an unlabelled node holding a labelled node's key is named with both nodes and left unlabelled, the rule stays, and status reads not applied before and after | stack-free |
| | SK5: with the rule in place, two unlabelled nodes sharing a key no labelled node holds are named, and both are left unlabelled | stack-free |
| | LK2: keys planted on 2 and on 12 nodes are named and left unchanged, and the rule is left out. Then, with the rule in place, a node without the label holding a labelled node's key is named and left unlabelled, the rule stays, and status reads not applied until the probe is gone | live |
| AC4 — it doesn't depend on the limit | SK1, SK2, SK4, SK5, SK7, SK8: no grouping query is ever sent (`shared-keys-grouped` never logged), and every read the check makes goes through `cypherEach` | stack-free |
| | LK1 and LK4: `SHOW TRANSACTIONS`, summed and sampled every 200 ms, stays under 64 MB through the run. LK1: the job's process peaks (`VmHWM`) no higher than a backup's count of the same keys, measured in a process of its own just before. LK4: within 1.25× of it, since that job's own backup is the same count | live |
| AC5 — nothing else changes | SK8: on a migrated graph, status reads applied, with one streamed read of the unlabelled keys (none) and nothing more | stack-free |
| | LK3: status on the migrated graph answers in under 5 s, applied. On the same scratch stack today's code took 3.17–3.38 s, counting `docker exec` and the command's start; story 3's 1.2–1.4 s was on another machine state | live |
| | Every lifecycle suite that exists today, unchanged, must still pass: `migrate.test.js` M1–M27 (M7 and M27 cover the shared-key report and its words), `migrate-job.test.js` K1–K6, `status.test.js`, `backup`, `backup-job`, `restore`, `download-backup`, `list-backups`, `upload-backup`, `cache-counts` and `tapestry-key-paths`. They pass on today's code with this plan's fake: 152 tests | stack-free |
| ADR 0009, Decisions 3 and 5 | SK6: two different keys with the same `keyHash` are confirmed by the second read, and neither is named; the rule is added. Also: `keyHash` is exported, and is Decision 5's cyrb53 | stack-free |
| | SK7: the number `1` and the string `'1'` are two keys, as Neo4j compares them. Neither is named, the rule is added, and `keyHash(1) !== keyHash('1')` | stack-free |

## Edge cases

- [x] **A hash collision (SK6).** Two different keys with equal hashes must reach the second read and be dropped there. The pair `collide-8xvbc` / `collide-28yjcu` (both 7794590295477596) came from a birthday search of 240 million strings `collide-<n in base 36>`: 41 s on the Mac Studio, which found 4 pairs. The search script is described under Test infrastructure.
- [x] **Keys that aren't strings (SK7).** Neo4j compares `1` and `'1'` as different values, so the check must too.
- [x] **More than 100 shared keys (SK3).** The fixture is written in descending key order, so an answer in node order names the wrong 100.
- [x] **A key on more nodes than are named (SK2, LK2).** Twelve holders give `count: 12` and ten nodes.
- [x] **The rule in place:** a held key (SK4, LK2), two unlabelled nodes sharing a key (SK5), and no unlabelled node at all (SK8).
- [x] **A "nothing more is read" assertion is paired with one that the read ran.** SK1 sees its one read of all 8 keys, and SK8 its read of none, before asserting that no second read came. SK6 asserts that the second read did run.
- [ ] **Writers during the run.** The scratch stack runs no trust pipeline (`strfry-router` stopped). This story doesn't change the passes, and ADR 0003's live check ran them under the stream consumer's writes. Not retested here.
- [ ] **A lower limit set at runtime.** Neo4j 5.26 Community has no `dbms.setConfigValue` (ADR 0009, Context 7), so AC4's bound is measured during the run instead.

## Test infrastructure

- **Framework:** Node's built-in runner, through the lifecycle suite kit (`test/helpers/lifecycleFakes.js` `suite`). Each `S.setup` runs the route in a child process (`test/helpers/operationsHarness.js`) against a temporary instance, with dead endpoints. Nothing reaches a stack.
- **The fake (`test/helpers/lifecycleFakes.js`) changes three ways.** The header lists each read it now knows. On today's code with this fake, all 11 lifecycle suites pass: 152 tests.
  1. **It answers ADR 0009's three streamed reads,** recognising each by what its query names, ahead of backup's own key reads. A key in scope is any key but null and `'{}'`, numbers included, each with its own type.
     - `tapestryKey <> '{}'` with `elementId(`: the holders, `{ k, id }` (an `IN $<param>` narrows them). Logged `shared-holders`.
     - `NOT <v>:TapestryNode`, `<> '{}'` and `EXISTS {`: the unlabelled keys, `{ k, held }`. Logged `shared-keys-unlabelled`.
     - `IS NOT NULL` and `<> '{}'` with no label test: every key in scope, `{ k }`. Logged `shared-keys-read`.

     Each log entry carries `rows`, and `cypherEach` marks it `streamed`.
  2. **Story 3's grouping now logs as `shared-keys-grouped`** (it was `shared-keys`, which no suite read). It is still answered as before, so today's code runs and the guard fails on it.
  3. **The keys pass honours `$skip`** (`AND NOT coalesce(n.tapestryKey, '') IN $skip`). SK5 found the gap: the fake labelled a node that real Neo4j leaves alone. No suite's result changes.

  **The Implementer doesn't edit the fake.** A fix whose reads it can't answer is a kick-back to the Tester.
- **The probes (`test/helpers/scratchProbes/`)** are copied into the scratch container by the live checks and run there. They only read.
  - `txMemoryPeak.js` samples `SHOW TRANSACTIONS` every 200 ms: the peak of all transactions together (`estimatedUsedHeapMemory`, summed, which is what `dbms.memory.transaction.total.max` caps), and each query's own peak. It opens a session per sample, so it keeps sampling across a backup's restart.
  - `workerPeak.sh` gives the lifecycle worker's peak `VmHWM` from `/proc`.
  - `backupCountPeak.js` runs a backup's count of the keys (`countGraph`, which keeps the strings while the rule is offline) in a process of its own, and prints its count and peak. That is AC4's yardstick.
- **The live checks need:** `TAPESTRY_CONTAINER` naming a scratch container (`tapestry-scratch…`; `scratchLoopback.js` refuses any other), `TAPESTRY_KEYS_LIVE=1`, and staging's shape (at least 3.5 million nodes and 370,000 card sets).
  - They run in order, LK1 to LK4, and each leaves the graph as the next expects. LK4 leaves it in production's shape, migrated.
  - They rewrite keys and labels, so they never run on the shared stack.
- **Story 8's seeder** (`test/helpers/seedStagingShape.js`) keeps adding the rule itself. It seeds staging's state, as it was, independently of the code under test, and the live checks run the migration themselves (story, Out of scope: the test plan's call).
- **Concept Graph API and firmware:** not used. No concept is touched. The scratch stack installs firmware when it boots, and no reinstall is needed.
- **The collision search,** run once to find the SK6 pair: hash `collide-<i in base 36>` for i < 240,000,000 into a `Float64Array` with ADR 0009 Decision 5's `keyHash`, sort a copy numerically, and take equal neighbours. Then rescan for the indices that give each value.

## How to run

```
node test/operations/lifecycle/shared-keys.test.js
```

Live, on a scratch stack, never the shared one:

```
TAPESTRY_CONTAINER=$(SCRATCH_IMAGE=agent-memory-tapestry:latest bash scripts/scratch-stack.sh up)
TAPESTRY_CONTAINER=tapestry-scratch node test/helpers/seedStagingShape.js
TAPESTRY_CONTAINER=tapestry-scratch TAPESTRY_KEYS_LIVE=1 node test/operations/lifecycle/shared-keys.test.js
bash scripts/scratch-stack.sh down
```

On the owner's Mac, never run `npm test`, since it writes to the agent-memory instance. Run suites one at a time, and take the full gate from the PR's CI.

## Measurements before the fix

These are AC4's "before", from the reproduction on 2026-11-16 (story Background): 3,851,244 nodes, Neo4j 5.26.10 Community, a 512 MiB transaction limit.

| Read (today's code) | Time | Neo4j transaction memory |
|---|---|---|
| `MATCH (n) RETURN count(n)` (count store) | 113 ms | — |
| `MATCH (n:TapestryNode) RETURN count(n)` (count store) | 1 ms | — |
| Decision 4's scan (`… IS NULL OR … = '{}' RETURN count(n)`) | 1,482 ms | 2 MB |
| `SHOW CONSTRAINTS`, `SHOW INDEXES` | 2 ms, 4 ms | — |
| The shared-keys check, no rule (one grouping) | fails after 1,677 ms | 458–510 MB, then `MemoryPoolOutOfMemoryError`. It needs 394 B a key, so 1.52 GB at this size |
| Backup's key count (streamed, before a run on production's shape) | — | 2 MB; worker 274 MB at 1.56 million keys |
| The keys pass over 2,294,384 nodes | 13 s | 28 MB for all transactions together (12 MB a batch) |
| `CREATE CONSTRAINT tapestry_key` until online | 7 s | not counted (population) |
| `tapestry lifecycle status` on the migrated graph (the rule in place), four runs | 3.17–3.38 s | — |

For the design (ADR 0009): a streamed read of all 3,851,244 keys held 2.0 MB.
- **Keeping the strings:** 6.9 s and a worker peak of 442 MB.
- **Keeping a 53-bit hash of each key:** 4.7 s and 101 MB.

The Implementer adds the "after" column from LK1 and LK4.

## Verification

The new tests fail with the current code, each for the reason ADR 0009 changes. Confirmed on 2026-11-16 at `0b25440f`, with this plan's suite, fake and probes uncommitted on top.

**Stack-free** (`node test/operations/lifecycle/shared-keys.test.js`):

```
  FAIL  SK1  the check for shared keys never groups the keys in one query (ADR 0009, Decision 1: it streams them); it sent story 3's grouping 2 times
  FAIL  SK2  the shared keys come in key order, so every run names them alike (ADR 0009 Decision 4); got ["k-two","k-twelve"]
  FAIL  SK3  they are the first 100 in key order, k-dup-000 to k-dup-099; got ["k-dup-119","k-dup-118","k-dup-117"] … ["k-dup-021","k-dup-020"]
  FAIL  SK4  the check for shared keys never groups the keys in one query (ADR 0009, Decision 1: it streams them); it sent story 3's grouping 5 times
  FAIL  SK5  the check for shared keys never groups the keys in one query (ADR 0009, Decision 1: it streams them); it sent story 3's grouping 4 times
  FAIL  SK6  _migrations.js exports keyHash for the suites (ADR 0009 Decision 5); it exports ["MIGRATIONS","names","byName","keyCountsOf","readSchema"]
  FAIL  SK7  _migrations.js exports keyHash for the suites (ADR 0009 Decision 5); it exports ["MIGRATIONS","names","byName","keyCountsOf","readSchema"]
  FAIL  SK8  the check for shared keys never groups the keys in one query (ADR 0009, Decision 1: it streams them); it sent story 3's grouping 1 time
  SKIP  LK1–LK4  (live check skipped: TAPESTRY_KEYS_LIVE=1 is not set)
operations: lifecycle migrate: the check for shared keys: 0 passed, 8 failed, 4 skipped
```

SK4, SK5 and SK8 get past every assertion about what is named and what is left alone before the guard stops them, since today's code gives the same answers, only by grouping. SK5 first failed on the fake: it labelled a node that the keys pass's `$skip` keeps unlabelled. The fake now honours `$skip` (Test infrastructure).

**Every lifecycle suite with this fake, on today's code** (one at a time, stack-free): `migrate` 27 of 27, `migrate-job` 6 of 6, `status` 9 of 9, `backup` 21 of 21, `backup-job` 17 of 17, `restore` 23 of 23, `download-backup` 7 of 7, `list-backups` 6 of 6, `upload-backup` 10 of 10, `cache-counts` 7 of 7, `tapestry-key-paths` 19 of 19.

**Live, on today's code** (a scratch stack seeded to staging's shape, 01:02–01:03 UTC; booting and seeding took 255 s):

```
[LK1] {"seconds":6.342,"txPeakMB":464,"txSamples":31,"txTop":[{"mb":464,"query":"MATCH (n) WHERE n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}' WITH n.tapestryKey AS k, collect(elementId(n))[..10]"},{"mb":2,"query":"MATCH (n) WHERE n.tapestryKey IS NULL OR n.tapestryKey = '{}' RETURN count(n) AS withoutKey"}],"workerKB":69348,"backupCount":{"keys":3851244,"peakKB":449248}}
  FAIL  LK1  tapestry-keys answers done (AC1); got { "success": false, "error": "lifecycle migrate failed: The allocation of an extra 2.0 MiB would use more than the limit 512.0 MiB. …" }
[LK2 no rule] {"seconds":6.533}
  FAIL  LK2  tapestry-keys answers done; got { "success": false, … }
[LK3] {"seconds":3.273}
  FAIL  LK3  status reads tapestry-keys as applied; got { …, "applied": false, "lastRun": { "outcome": "failed", "error": "The allocation of an extra 2.0 MiB would use more than the limit 512.0 MiB. …" } }
[LK4] {"seconds":44.8,"stripped":2294386,"txPeakMB":468,"txSamples":101,"txTop":[{"mb":468,"query":"MATCH (n) WHERE n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}' WITH n.tapestryKey AS k, collect(elementId(n))[..10]"},{"mb":286.9,"query":""}, …],"workerKB":273544,"backupCount":{"keys":1556858,"peakKB":227788}}
  FAIL  LK4  tapestry-keys answers done (AC2); got { "success": false, … }
```

- **The probes caught the cause.** LK1 and LK4 each show the grouping as the transaction that held the most: 464 and 468 MB at the last sample before the limit.
- **The yardsticks.** A backup's count of the same keys peaked at 449 MB for 3.85 million keys (LK1), and at 228 MB for 1.56 million (LK4).
- **LK4's worker** peaked at 274 MB, its own backup counting the keys before the job failed.
- **LK3 failed only because no run had succeeded.** It also timed status at 3.27 s with no rule. After the run, today's status on the graph migrated by hand took 3.17–3.38 s over four runs, so LK3's bound is 5 s, not story 3's 3 s.
- **Cleanup.** The finally blocks restored LK2's planted keys. LK4 left the graph in production's shape, which was migrated by hand afterwards for the status timing. The stack was removed at 01:04 UTC.
