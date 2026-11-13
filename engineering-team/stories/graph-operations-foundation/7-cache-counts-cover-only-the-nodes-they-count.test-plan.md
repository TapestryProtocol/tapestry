# Test Plan: Story 7 — The cache counts cover only the nodes they count

**Story:** `engineering-team/stories/graph-operations-foundation/7-cache-counts-cover-only-the-nodes-they-count.md`
**ADR:** none. This is a bug on the Standard bug path; the owner chose to skip Architecture on 2026-11-13.
**Date:** 2026-11-13
**Approved:** by the owner, 2026-11-13, with the amendment to `status.test.js` P7.

Every test is stack-free. Each test graph runs in a child process, with two modules replaced:

- **`src/lib/neo4j-driver.js`** is replaced by a new helper, `test/helpers/nodeCypherFake.js`. It runs the Cypher it is sent over the graph's nodes, as Neo4j would.
- **`src/lib/tapestry-store.js`** is replaced by a cache that records every key looked up.

So the tests say what the reads must find, not how the query is written. Both callers are tested over the same graph: status's cache part (`parts.cache()`), and `GET /api/tapestry-key/status` (`handleStatus`).

## The graphs

- **after:** as on staging once `tapestry-keys` has run. Every node is keyed and labelled `TapestryNode`. Only four nodes have an address:
  - a node with a uuid and an id;
  - a second node with a uuid and an id;
  - an event-less set with a uuid and no id;
  - a node with an id and no uuid.

  Their cache entries: two have data, one is empty, and one is missing. Alongside them are 3,000 keyed nodes with no address: `NostrUser`, `NostrEventTag` and `NostrUserWotMetricsCard`. These stand for staging's 3.85 million.
- **gaps:** *after*, plus four nodes without a key:
  - an addressed node whose key is `'{}'`;
  - an addressed node with no key (and no label);
  - two nodes with no address, one with `'{}'` and one with no key.
- **before:** as before story 3. There is no `TapestryNode` label anywhere. The four keyed addressed nodes and the two unkeyed ones are as in *gaps*. The 3,000 nodes with no address have no key.

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC1 — the cache part adds up | **C1** after: `cached + cachedEmpty + notCached = withTapestryKey`, and none is larger than `nodes`; the part is exactly `{ nodes 4, withTapestryKey 4, withoutTapestryKey 0, cached 2, cachedEmpty 1, notCached 1 }` · **C5** before: the same counts on an unmigrated graph | `test/operations/lifecycle/cache-counts.test.js` | unit (child) |
| AC2 — the route adds up | **C2** after: `lmdb.derived + lmdb.empty + lmdb.missing = initialized`, `total` is 4, and the answer is exactly `{ success: true, data: { initialized 4, uninitialized 0, total 4, lmdb { 2, 1, 1 } } }` · **P7** (amended, below) | `cache-counts.test.js`, `status.test.js` | unit (child) |
| AC3 — only the counted nodes are looked up | **C3** after, for each caller: it reads the graph, so the test isn't passing on an answer that never looked. It looks up exactly the 4 counted keys, once each. No row any read returns holds a key of a node with no address. | `cache-counts.test.js` | unit (child) |
| AC4 — nothing else moves | **C4** gaps: an addressed node with `'{}'` or no key is counted as without a key and never looked up, and the unaddressed ones change nothing · **C5** before (see AC1) · **C6** one graph, both parts: the migrations part still counts every node, its label and its key over the whole graph, while the cache part counts only the addressed nodes and adds up · **P2** (unchanged): the migrations part's counts | `cache-counts.test.js`, `status.test.js` | unit (child) |
| (the fake itself) | **C0**: `OR` binds looser than `AND`; a comparison with null keeps no row; `WITH`, `CASE` and `count` group as in Neo4j; aggregates over no rows answer one row; label tests and parameters work, as do `ORDER BY`, `LIMIT`, `coalesce`, `NOT` and `IN`; a relationship is refused, and the refusal says so | `cache-counts.test.js` | unit |

C5, C0 and P2 pass today, and they must keep passing.
- **C5 and P2** are guards. C5 fails a fix that reads only `TapestryNode` nodes. P2 fails a change to the wrong part.
- **C0** checks the fake.

## Edge cases

- [x] An address that is a uuid only, an id only, or both: the after graph has all three.
- [x] `'{}'` and a missing key, on an addressed node and on one with no address: C4.
- [x] `OR` and `AND` precedence. The fix most likely to go wrong is `uuid IS NOT NULL OR id IS NOT NULL AND <key test>`. It keeps every node with a uuid, keyed or not, so it would look up `'{}'`: C4 fails it. C0 confirms the fake parses it as Neo4j does.
- [x] A graph that hasn't run `tapestry-keys`, which has no `TapestryNode` label: C5.
- [ ] Empty input, a graph with no addressed node: no test of its own. Its counts are zeros, and C0 shows that the fake answers an aggregate over no rows as Neo4j does.
- [ ] Concurrent calls, and the Concept Graph API unavailable or a handle not found: not applicable. The counts read Neo4j and the LMDB only. A Neo4j that doesn't answer is status's existing `known: false` (P5).
- [ ] Not covered, since the criteria don't ask for it: the time the count takes. Its first query still scans every node to find the addressed ones, as before story 3. That scan runs inside Neo4j, and since this fix no row of it reaches the control panel. On staging it is a scan of 3.85 million nodes on each Dashboard load. If that matters, it is a separate story.

## Test infrastructure

- **Framework:** Node's built-in runner. The suite is found by `test/operations.test.js`, like every suite under `test/operations/`.
- **The fake graph database, `test/helpers/nodeCypherFake.js`, which is new.** It runs one `MATCH` of one node: `(v)`, `(v:A)`, `(v:A|B)` or `(v:A:B)`. After that come `WHERE` and `WITH` clauses, then a `RETURN`, each `WITH` or `RETURN` with its own `ORDER BY`, `SKIP` and `LIMIT`. It has Cypher's precedence and three-valued logic, and it reads:
  - `IS [NOT] NULL`, comparisons, `IN`, `STARTS WITH`, `ENDS WITH` and `CONTAINS`;
  - `CASE WHEN`, and the functions `coalesce`, `size`, `toString` and `trim`;
  - the aggregates `count(x)`, `count(*)`, `count(DISTINCT x)`, `collect` and `sum`.

  Anything else throws "the fake graph database can't read this Cypher", naming what it met. Examples are a relationship, a second `MATCH`, `UNWIND` or `CALL`.
  - Its `runCypher` and `streamCypher` share the fake. `writeCypher` and `getDriver()` throw, because these reads write nothing.
  - **The Implementer doesn't edit it.** If the fix needs Cypher the fake can't read, that is a kick-back to the Tester, as with any test.
- **The cache stub** records every key passed to `get`, `getDb().get`, `getDb().getMany` or `getDb().doesExist`. Its `put` and `remove` throw.
- **Firmware state:** none. The graphs are fixtures in the suite.
- **The live check:** none on a scratch stack. The ACs are about which nodes are read, which is Cypher semantics; C0 checks the fake against those. The confirming check comes after the fix reaches staging: the owner runs `tapestry lifecycle status` there, as on 2026-11-13. The cache part should then add up: `cached + cachedEmpty + notCached = withTapestryKey`, with `notCached` no larger than the 3,608 addressed nodes.

### Amendment to an earlier test

**`status.test.js` P7** (story graph-operations-foundation #1) recognised the two queries of the time by their text:
- a query naming `AS tk` got the key rows;
- any other query got the count rows.

It also had no `streamCypher`, and its `getDb()` returned null. So a correct fix built differently would fail it: one query counted in JS, or a streamed read. P7 now runs the tapestry-key reads through the fake, over four nodes: three keyed and addressed (`k1` cached, `k2` empty, `k3` not cached), and one addressed with no key. Its firmware query is answered as before. Its expectations are unchanged: `{ initialized 3, uninitialized 1, total 4, lmdb { 1, 1, 1 } }`, and the route answers `{ success: true, data: <that> }`. It passes on the current code.

## How to run

```
node test/operations/lifecycle/cache-counts.test.js
node test/operations/lifecycle/status.test.js
node test/operations.test.js          # the operations gate: every suite under test/operations/
npm test                              # the full gate (on the Mac Studio, run only the operations suites)
```

## Verification

The new tests fail on the current code, at `6c48490b`, the story's commit on `fix-tapestry-key-counts-addressed-nodes`. They fail for the bug's reason: `notCached` and `lmdb.missing` count the 3,000 unaddressed keys, as staging's 3,849,037 did. Run 2026-11-13:

```
=== operations: the cache counts (graph-operations-foundation #7) ===
  PASS  C0: the fake graph database reads Cypher as Neo4j does — …
  FAIL  C1 (AC1): …
        cached + cachedEmpty + notCached must equal withTapestryKey, and none may exceed nodes; got {"known":true,"nodes":4,"withTapestryKey":4,"withoutTapestryKey":0,"cached":2,"cachedEmpty":1,"notCached":3001}
  FAIL  C2 (AC2): …
        lmdb.derived + lmdb.empty + lmdb.missing must equal initialized (4); got {"derived":2,"empty":1,"missing":3001}
  FAIL  C3 (AC3): …
        status's cache part must look up exactly ["k-a1","k-a2","k-a3","k-a4"], once each; it looked up 3004 keys, 3000 of them of nodes with no address
  FAIL  C4 (AC4): …
        the cache part must answer {…"notCached":1}; got {…"notCached":3001}
  PASS  C5 (AC1, AC4): before tapestry-keys — …
  FAIL  C6 (AC4): …
        the cache part counts the 6 addressed nodes, and adds up; got {…"notCached":3001}

operations: the cache counts: 2 passed, 5 failed, 0 skipped
```

`status.test.js` passes 9 of 9, with P7 amended. The operations gate shows 196 passed and 5 failed, the five above.

**That the tests accept correct fixes and catch wrong ones.** Five candidate changes to `readTapestryKeyCounts` were tried in the working tree, and the file was put back after each. None is committed: the fix is the Implementer's.

| Candidate | C0–C6 | P7 |
|---|---|---|
| (a) add `(n.uuid IS NOT NULL OR n.id IS NOT NULL) AND` to the key read | all pass | pass |
| (b) one query of the addressed nodes' keys, counted in JS | all pass | pass |
| (c) a streamed read (`streamCypher`, `WITH … WHERE`, `getDb().get`) | all pass | pass |
| (d) the precedence slip, `uuid IS NOT NULL OR id IS NOT NULL AND <key test>` | C4, C5 and C6 fail | — |
| (e) only `TapestryNode` nodes, `MATCH (n:TapestryNode)` | C5 fails | — |

### After the fix (Implementation, 2026-11-13, on `0e697046`)

The fix is candidate (a), in `src/api/tapestry-key/index.js`: the key read now has the count's own address filter, `(n.uuid IS NOT NULL OR n.id IS NOT NULL)`. `cache-counts.test.js` passes 7 of 7, and `status.test.js` passes 9 of 9. In the full gate, run in the cloud workspace with no Docker and no Neo4j, so every live suite is skipped:

```
20261113T220303Z-16998-080e [story7-impl] started 2026-11-13T22:03:03.789Z on 0e697046 — FAIL, exit 1, 7064 passed, 1 failed, 598 skipped, 338/338 suites; failed: setup-alert-polish
```

The operations gate passes 201 of 201, the earlier 196 and these five. The one failure is `setup-alert-polish` S2, which fails on `staging` without this change. `ui/src/pages/reading/writeVerbs.js` posts to `/api/strfry/publish` by hand (ledger row `2026-11-07-reading-writeverbs-raw-publish`), and each of story 3's review runs saw the same failure.
