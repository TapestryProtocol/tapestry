# ADR 0009: `tapestry-keys` finds shared keys from a stream of their hashes, not one grouping in Neo4j

**Status:** Accepted
**Date:** 2026-11-16
**Story:** `engineering-team/stories/graph-operations-foundation/9-tapestry-keys-within-transaction-memory.md`
**Amends:** ADR `graph-operations-foundation/0003`, Decision 4: the shared-keys read in `plan`. Everything else in Decision 4 stands.

## Context

The story's Background gives the reproduction. These are the facts the design rests on, measured on 2026-11-16 on a scratch stack seeded to staging's shape: 3,851,244 nodes, Neo4j 5.26.10 Community, a 1 GiB heap and a 512 MiB transaction limit.

1. **Which read fails.** It is `sharedKeys(system, ruleInPlace)` (`src/operations/catalog/lifecycle/_migrations.js:78–89`), which only `planKeys` calls (`:104–125`).
   - **With no rule** it groups every real key in one `EagerAggregation` (`:85–87`). Neo4j's profile gives 394 bytes per key, exactly in proportion: 98.5 MB at 250,000 keys, 197.0 MB at 500,000 and 394.1 MB at 1,000,000. That is 1.52 GB for staging's shape and 1.82 GB for production's 4,625,039 nodes once they are all keyed.
   - It failed after 1.7 s with `Neo.TransientError.General.MemoryPoolOutOfMemoryError`. Every other read in the plan passed. Decision 4's scan held 2 MB.
   - **With the rule in place** it runs the same grouping over the nodes without the label, each one also seeking the rule's index (`:80–84`). That is small after a migration, but it grows with the number of unlabelled keyed nodes.
2. **When it runs.**
   - `runMigrateJob` runs `plan(system, { full: true })` once per run, after the backup (`_jobs.js:293`).
   - `migrate.js` and `lifecycle status` call `plan` without `full`. That runs the check only when the rule is online, and so only the rule-in-place form (`_migrations.js:107`, `status.js:189`). Status does this on every request, in the control panel's own process.
3. **What depends on its answer.** The answer is `[{ key, count, nodes }]`: at most 100 keys (`SHARED_LIMIT`), each with up to ten element ids.
   - `applied` needs it empty (`:112`).
   - `applyKeys` skips those keys when the rule is in place (`:172`), and leaves the rule and index out when it isn't empty (`:191`).
   - The report and its words carry it (`:211`, `describeKeys` `:227–235`).
4. **A streamed read already exists.** ADR 0003 Amendment 2 added `system.cypherEach(query, params, onRow)` over `streamCypher` (`src/lib/neo4j-driver.js`). It subscribes to the result, so neither the driver nor Neo4j holds more than the driver's fetch window.
   - A read of all 3,851,244 keys through it held **2.0 MB** of transaction memory throughout, by `SHOW TRANSACTIONS` sampled every 200 ms. It finished in 4.4–4.6 s.
5. **The job's own process already holds a lot during production's run.** On production the run needs a backup first. The backup's key count, `readAllKeys` (`_jobs.js:87–100`), keeps every key string and sorts them: about 400 MB at three million keys (ADR 0003 Amendment 2, measured).
   - On production's shape it peaked the worker at 274 MB, with 1.56 million keys.
   - The story (AC4) asks that the check not add a second structure that size.
6. **The rest of the migration fits.**
   - Today's keys pass over 2,294,384 unkeyed nodes peaked at 28 MB for all transactions together, 12 MB for each batch of 10,000.
   - The rule came online over 3.85 million keys 7 s after `CREATE CONSTRAINT`. Index population doesn't count against the transaction limit.
7. **The limit.** `dbms.memory.transaction.total.max` caps all transactions together, and per-transaction memory is uncapped (`db.memory.transaction.max = 0`). The setting reads as dynamic, but Community has no `dbms.setConfigValue`, so a test can lower it only by restarting Neo4j with another value.
8. **The suites' fake.** `test/helpers/lifecycleFakes.js` recognises the shared-keys read by `tapestryKey`, `collect(` and `> 1` (header, line 38), and answers it over the whole fake graph (`:449–455`). Its `cypherEach` answers whatever `cypher` would, marking the log entry `streamed` (`:503–511`).

No concept is touched.

## Options considered

Measured on the seeded scratch stack (A, B and today's grouping), or estimated from those measurements (C, D):

| | Neo4j transaction memory | The job's process | Time at 3.85M keys |
|---|---|---|---|
| Today: one grouping | 1.52 GB (394 B a key) | 68 MB | fails at 512 MB after 1.7 s |
| A: stream the keys, keep the strings | 2 MB | 442 MB peak (+381 MB) | 6.9 s |
| **B: stream the keys, keep a hash of each** | **2 MB** | **101 MB peak (+41 MB)** | **4.7 s** |
| C: the grouping by key range, 16 ranges | about 95 MB a range, growing with the graph | none | about 16 full scans, 25 s or more |
| D: the rule's own population as the check | none (population isn't counted) | none | 7 s to build the rule, wasted when refused |

### Option A — Stream every key and keep the strings, as backup's `readAllKeys` does

One streamed read of every real key. The worker keeps the strings, sorts them, and compares neighbours. A second streamed read gets the holders of the shared keys.

- **Pros.** The least new code, and it mirrors `readAllKeys`. Exact by construction.
- **Cons.** The worker holds about 100 bytes a key: +381 MB at 3.85 million keys measured, and about +580 MB at 4.6 million in the off-stack simulation. That is as much as a backup's count, so AC4's second bullet would hold only at its boundary. On production's run it would be a third structure of that size in one job, after the backup's two.

### Option B — Stream every key and keep a 53-bit hash of each; confirm the candidates with a second streamed read *(chosen)*

One streamed read. The worker keeps one hash per key, 8 bytes, in a `Float64Array`, sorts it numerically, and treats equal neighbours as candidates. Only when there are candidates does a second streamed read go over every key with its element id, keeping only the rows whose hash is a candidate. Those are then compared exactly.

- **Pros.** Neo4j holds the fetch window, whatever the graph's size. The worker holds 8 bytes a key: +41 MB measured at 3.85 million keys, about +116 MB at 4.6 million in simulation, a sixth to a ninth of A. It is exact, because a candidate is confirmed by comparing keys. It is also the fastest, since sorting numbers is cheap.
- **Cons.** More code: a hash function, a typed array that grows, and two reads. A graph with a shared key, or a hash collision, pays a second full read of about 5 s. A collision happens about once in a thousand runs at 4.6 million keys (n² ⁄ 2⁵⁴).

### Option C — Keep the grouping in Neo4j, one key range at a time

Run today's grouping once per range of keys, by leading character, each a full scan.

- **Pros.** No new code in the worker.
- **Cons.** It still depends on the limit, only less: each range holds 394 bytes a key of its share, about 95 MB a range at 16 ranges, and more as the graph grows. Keeping that bounded means more ranges as the graph grows, and each range is another full scan, so the time grows as keys × ranges. The ranges must also cover any string, not only UUIDs.

### Option D — Let the rule's own population check, after the passes

Give keys and labels first, then try to create the rule. Neo4j refuses it while two labelled nodes share a key, and population doesn't count against the transaction limit. Look for the shared keys only when it refuses.

- **Pros.** On the usual graph, with no shared key, there is no extra read at all.
- **Cons.** It moves Decision 4's check from `plan` to after the passes, so the report would know nothing until the end. A refused rule wastes its whole population, about 7 s here and more on production. The refused path still needs B, or a temporary index with schema churn and cleanup if the job is cut short. The rule-in-place form, unlabelled nodes against the rule, would still need its own read.

## Decision

We chose **Option B**. It is the only option whose Neo4j memory doesn't depend on the graph's size and that doesn't move the cost into the job's process: 8 bytes a key against A's 100 or so. It keeps Decision 4's order, answer and report. A and C remain fallbacks with known numbers. D's saving matters only on graphs that need no answer at all.

**`sharedKeys(system, ruleInPlace, expected)` keeps its answer, with no grouping in Cypher.**

1. **The first read, streamed** through `system.cypherEach`. It reads the keys in scope, as today's two forms do:
   - **no rule:** `MATCH (n) WHERE n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}' RETURN n.tapestryKey AS k`
   - **the rule in place:** `MATCH (n) WHERE NOT n:TapestryNode AND n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}' RETURN n.tapestryKey AS k, EXISTS { MATCH (m:TapestryNode {tapestryKey: n.tapestryKey}) } AS held`. The `EXISTS` subquery seeks the rule's index once per row. `m` can't be `n`, since `n` has no label.

   For each row, the worker writes `keyHash(k)` into a `Float64Array`.
   - The array starts at the size `planKeys` passes as `expected`, plus room for keys made while it reads, and never below a small minimum. That size is `counts.nodes - counts.withoutKey` with no rule, and `counts.nodes - counts.withLabel` with the rule. The array doubles when full.
   - A row with `held: true` puts its key, exactly, in a small set of keys already shared.
2. **The candidates.**
   - The worker sorts the filled part of the array in place. A typed array sorts numerically.
   - Each hash equal to its neighbour is a candidate.
   - With no candidate and no held key, the answer is `[]`, after one read.
3. **The second read, streamed, only when there is a candidate or a held key:** `MATCH (n) WHERE n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}' RETURN n.tapestryKey AS k, elementId(n) AS id`. It reads every node, with or without the label, as today's holders do.
   - The worker keeps only the rows whose key is held, or whose hash is a candidate. For each such key it keeps how many rows it saw and the first ten ids.
   - A key with more than one holder is shared.
   - A candidate whose keys each have a single holder was a hash collision, and is dropped.
4. **The answer** is the shared keys in key order, the first 100, each `{ key, count, nodes }`. `count` is every holder, as `count(*)` and `size(holders)` are today, and `nodes` holds up to ten element ids in the order the read met them.
   - Today the 100 come in whatever order the grouping gives. Key order makes the answer the same on every run.
5. **`keyHash(value)`** is cyrb53: two 32-bit lanes, multiplied in per character and mixed at the end, giving a 53-bit integer that a JavaScript number holds exactly. It is public domain (bryc). A string key is hashed as its text.
   - A key that isn't a string is hashed and compared together with its type, as Neo4j compares values, so `1` and `'1'` stay two keys. One way to do this is a type prefix on the text used for hashing and comparing, while the answer still gives `String(k)`.
   - `_migrations.js` exports `keyHash` for the suites.

   For example:

   ```js
   function keyHash(value) {
     const s = typeof value === 'string' ? value : `\u0000${typeof value}:${JSON.stringify(value)}`;
     let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
     for (let i = 0; i < s.length; i++) {
       const c = s.charCodeAt(i);
       h1 = Math.imul(h1 ^ c, 2654435761);
       h2 = Math.imul(h2 ^ c, 1597334677);
     }
     h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
     h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
     return 4294967296 * (2097151 & h2) + (h1 >>> 0);
   }
   ```

**Unchanged:**
- Decision 4's order: `plan` reads the shared keys before the passes, `full` with no rule and always with the rule.
- When the check runs: with no rule only for `full`, which only the job uses; with the rule, on every `plan`, status included.
- The skip list, the rule left out while any key is shared, `applied`, the report's fields and the words of `describeKeys`.
- The passes, the schema and every other read.

**Memory and time.**
- **Neo4j:** the fetch window, about 2 MB whatever the size of the graph.
- **The job's process:** 8 bytes for each key in scope, plus the candidates' rows while they are confirmed. On real graphs that is none, or a handful of keys.
- **Time:** one streamed read, about 4.5 s at 3.85 million keys. A second read comes only when a key is shared.
- **With the rule in place,** the first read covers only unlabelled nodes, normally none. Status keeps today's cost: the same full scan for unlabelled keyed nodes that today's rule-in-place query makes, with no grouping after it.

## Consequences

**What this enables**
- `tapestry-keys` runs on any instance whatever its transaction limit: production at 4.6 million nodes, staging, and every new instance whose nodes were keyed as they were made.
- While the check runs it no longer takes most of the shared pool, so the trust pipeline's writes don't fail meanwhile.
- On production's run the job's peak stays where Amendment 2 left it, the backup's count of the keys. The check adds about 40–50 MB to it.

**What this constrains**
- The check is two queries, not one, and the second runs only when needed. A later change to it must keep both streamed. The suites' guard (Implementation notes) fails on a grouping or an unstreamed read of the keys.
- The suites' fake has to answer the new reads. The old grouping is no longer something the code sends.
- How much memory the check uses follows how many keys are actually shared, about 250 bytes each while it confirms them. A graph with millions of distinct shared keys would cost the job's process that much, still never Neo4j. Real graphs have none or a handful.

**New debt and follow-ups**
- A hash function lives in `_migrations.js`. If another read needs one, it moves to `src/lib/`.
- Story 8's seeder adds the rule itself (`test/helpers/seedStagingShape.js`). Now it could run the migration instead. That is the test plan's call (story, Out of scope).
- With the rule in place, keys beyond the first 100 shared ones aren't skipped, so their batches fail and are reported as failed batches. That is today's behaviour, and it is unchanged.
- **Firmware reinstall required?** No: no concept definition changes.

## Implementation notes

**`src/operations/catalog/lifecycle/_migrations.js`**, the only source file that changes:
- `sharedKeys(system, ruleInPlace, expected)` follows Decision steps 1–4. It reads only through `system.cypherEach` and sends no `collect(`, `count(` or grouping.
- `keyHash(value)` follows step 5 and is exported beside `readSchema`.
- `planKeys` passes `expected` from `counts`: `counts.nodes - counts.withoutKey` with no rule, and `counts.nodes - counts.withLabel` with the rule. Name the starting size and the growth in constants beside `SHARED_LIMIT`.
- Keep the file's header comment and Decision 4's comments true. `sharedKeys`' doc comment says how it reads now, and cites this ADR.

Unchanged: `_system.js`, `src/lib/neo4j-driver.js`, `_jobs.js`, `migrate.js` and `status.js`.

**Docs, by the Implementer:**
- **OPERATIONS.md §17:** one sentence. Before the rule exists, `tapestry-keys` reads every key once more, as a stream, to find keys held by more than one node. That takes about 5 s and 40 MB in the job's process at four million keys, and almost none of Neo4j's transaction memory, so it doesn't depend on the limit (ADR 0009).
- **ADR 0003's header:** "Amended by: graph-operations-foundation/0009 (Decision 4's shared-keys read)". Decision 4's bullet then says the read is Amendment 0009's.
- **Ledger row `2026-11-15-tapestry-keys-exceeds-transaction-memory`:** `DONE`, naming story 9 and its PR.

**For the Tester (Phase 3).** The suites stay in `test/operations/lifecycle/`, stack-free, through the fake.
- **The fake answers the new reads,** through `cypherEach`:
  - the first read in both forms: the real keys in scope, and `held` for each unlabelled key that a labelled node holds;
  - the second read: every real key with its node's element id.

  Each is logged under its own `what`. The old grouping keeps a match of its own that logs it as sent, so a guard can fail on it.
- **Cases:**
  - M7 and M27 still pass.
  - No query of the check groups. Each of its reads of the keys is `streamed`.
  - With no rule:
    - a key on twelve nodes is named with `count: 12` and ten nodes;
    - with more than 100 shared keys, the answer is the first 100 in key order, each with its exact count.
  - With the rule in place:
    - an unlabelled node holding a labelled node's key is named (the held case);
    - two unlabelled nodes sharing a key are named;
    - status reads `tapestry-keys` as not applied in both.
  - Two different keys with the same `keyHash` aren't named. Find such a pair once, offline, by a birthday search of about 10⁸ random strings, which takes minutes on the Mac Studio. Write it into the fixture, with a check that the two hash alike.
  - A key that isn't a string isn't confused with its text (`1` against `'1'`).
- **The live check, on a scratch stack:** AC1–AC4 as the story states them.
  - Seed with `test/helpers/seedStagingShape.js`, then drop the rule.
  - AC2's shape: take the key and label off every second `NostrUser` and every card set and card.
  - AC3's keys: plant one on two nodes and one on twelve with the rule dropped, then a node without the label carrying a labelled node's key with the rule in place.
  - AC4's measures: `SHOW TRANSACTIONS` (`estimatedUsedHeapMemory`, summed) sampled every 200 ms through the run, and the worker's `VmHWM` from `/proc`. The story's Background has the numbers before the fix.
  - The limit can't be lowered at runtime on Community (Context 7).

## Out of scope

- **The backup's read of every key before the rule exists** (`readAllKeys`, Amendment 2). It needs the sorted strings for its digest, so hashes can't stand in for it there.
- **Caching status's answer,** or reading the check less often.
- **Skipping more than the first 100 shared keys** when the rule is in place.
- **Story 8's seeder,** and **running the migration on staging or production.**
