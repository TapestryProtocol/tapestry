# Test Plan: Story 14 — `graph walk`, following chosen relationship types out from one or more nodes, up to a depth

**Story:** `engineering-team/stories/graph-operations-first-slice/14-walk.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0014-walk.md`
**Date:** 2026-11-16

## Coverage map

Every suite is stack-free and lives under `test/operations/`, where `test/operations.test.js` finds and runs it (ADR graph-operations-foundation/0001, Decision 12). None needs a line in `test/registry.js`, and each also runs on its own: `node <file>`.

The read's requests go through the operations harness (`test/helpers/operationsHarness.js`): the real router, Express's own query parser, the real central auth middleware and the real command. The graph is a fake (`test/helpers/graphFake.js`), seeded by `test/helpers/walkGraph.js`, which is new in this story. The engine, `src/operations/walk.js`, is also called from code, in a child process, as search (A10.8) will call it. The fakes gain one route (below), and nothing they did before changes.

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1 — A walk from one or more nodes | W1 the class thread out from its header at each depth from 1 to 5: every node within the depth, nearest first, each once; a start with nothing to follow · W2 `types` narrows the walk; a type named twice walked by once, `types` answered sorted; none follows every type, MENTIONS (undeclared) among them; a type no relationship has: an empty list, no refusal · W3 `in` from elem3 up to header; `both` the default; the answer gives the start nodes (five facts, in the order given, each once), the types, direction, depth and point of view, and exactly its twelve fields · W7 two start nodes, one leading to the other | `graph/walk.test.js` | integration (route over the fake graph) |
| AC2 — Each node reached, with its path | W4 a node reached is exactly its five facts, `depth`, `start` and `path`; each step exactly a relationship's six facts; elem3's five steps out, header's five steps in, each read from the node it leaves · W5 a shortest path: both ways, elem3 one step away by its CITES back, set3 two · W6 of several as short, the same each time: the start with the lesser key, the parent with the lesser key, the type first by name, out before in (inward; set2 out from set1, not in from set3); one of two parallel SAME, the same on a second run · W32 *(added after the review)* the order between those keys: ordX through the lesser parent though its type is the greater, ordY out from the greater parent rather than in from the lesser · W7 a relationship back, a loop and a cycle go no further; no start answered as reached · WK3 `REACHED` · WK5 the engine's paths from `pathOf` | `graph/walk.test.js`, `walk.test.js` | integration; unit |
| AC3 — Tag nodes | W8 with no types: tagged's two HAS_TAG out and one REFERENCES in passed by and counted, tagger beyond never met; header's two and elem1's one counted across steps; a tag node met from two starts counted once. With HAS_TAG and REFERENCES: the tag nodes reached, and tagger behind one, `tagsLeftOut` 0; the owner's point of view steps onto them (no author). Nodes with no tapestryKey, keyed `'{}'`, or a change entry neither reached nor counted · W31 *(added after the review)* a node left out and a tag node passed by at step 1, met again a step later, each counted once | `graph/walk.test.js` | integration |
| AC4 — From a point of view, the owner's by default | W9 the owner's steps onto the peer scored 0.2, the author-less and the owner's, and on to povHiKid; leaves out 0.01, no NostrUser and no influence (3); never reaches povLoKid behind povLo; `owner` and the owner's pubkey walk as the default · W10 a start by a peer scored 0.01 is answered and walked from · W11 `everyone` steps onto all 8 · W12 new scores between two runs walk through povLo instead of povHi, and both runs only read · W13 no scores yet: only the instance's own, `scored: false` · W14 a stranger's or the admin's pubkey refused `unknown-pov`; `house` refused `invalid-input` | `graph/walk.test.js` | integration |
| AC5 — Page by page, nearest first, within a bound | W15 bulkHub's 120 in three pages (50 at one step; 10 at one and 40 at two; the last 20), in order, each once, the whole count on every page · W16 limit 3 and 200; 0 and 201 refused naming `limit` · W17 between two pages, two leaves added after the cursor and one leaf cut off: every node whose steps didn't change answered exactly once, the new ones answered, the cut one not · W18 a cursor refused `invalid-cursor` from another start, types, direction, depth or point of view, from list-relationships, or garbage; and one of this read's whose position isn't `[steps, tapestryKey]` (not a list, 0, past the depth, 1.5, text, not a key, short, long); the same starts in another order share a cursor · W19 depth 10 along the chain, 1 by default; 0, 11 and text refused naming `depth` · W20 the bound through the route: a walk whose second step would read 10,000 more than its first stops short (`complete` false, `finished` 1, only boundMid); one step that reads exactly 10,000 is complete · WK7 the bound at small sizes: exactly the bound; one over at the first step; two steps; the incoming statement past it under `both`, dropping the step whole; relationships to tag nodes and to nodes left out counting · WK8 no bound given: `BOUND` | `graph/walk.test.js`, `walk.test.js` | integration; unit |
| AC6 — What it refuses | W21 no `from` (alone, and with other inputs): `missing-input`; a `from` that isn't a key, a second that isn't one, 101 keys: `invalid-input`; a key no node has, two of them beside one that is, and a change entry's: `unknown-node`, 404, naming `from` and each key that names none · W22 a type with a space, a leading digit, a dash, a backtick and Cypher after it, or a second one malformed; 51 types (50 taken); `sideways` and `OUT`; an unknown input · WK9 the engine refuses `unknown-node`, naming the input it is given · WK10 it throws, never refuses, for the calls no schema lets through | `graph/walk.test.js`, `walk.test.js` | integration; unit |
| AC7 — A read, behind sign-in, that agents and search can use | W23 401 and 403; an admin walks what the owner walks · W24 reads only: no write transaction, the same nodes and relationships, no change entry · W25 the command answers what the route answers, a refusal included; `--from` twice and `--types` three times make lists · W26 listed for an admin with its seven inputs and its refusals; `/docs` has GET with the seven parameters, `from` and `types` as lists · W27 the engine, called from code over the same graph with the same inputs, gives the route's start nodes, counts, nodes, order and paths · W28 100 start nodes as 100 repeated keys through the route's own query parser · W29 one step both ways meets the other ends list-relationships lists for header and for tie1 · W30 the declaration takes `walk.js`'s four inputs and `reads.js`'s three, declares the three refusals, answers `NODE`, `REACHED` and `POV`; the catalog's Paging bullet, §1's row and §1's mention of `src/operations/walk.js` · WK1, WK2, WK4, WK6, WK11 the engine's exports and limits, its inputs, `UNKNOWN_NODE`, any read function, nothing opened at load · WX1 an admin agent walks from header to the elements, 3 a page, to its last cursor, through the external CLI · WX2 it walks in from elem3, from two starts with `--from` twice, and is refused a key no node has · *on a real Neo4j: the live check* | `graph/walk.test.js`, `walk.test.js`, `graph/walk-agent-through-cli.test.js` | integration; unit; the real external CLI against a loopback instance; live |

## The readings these tests take

The ADR leaves these open, or states them loosely. The tests settle them:

1. **A cursor's position is `[steps, tapestryKey]`,** a whole number from 1 to `depth` and a key, as Decision 2's step 4 names it. W18 opens a real cursor to forge positions, and so pins that the cursor is C1's `[read, scope, position]` with this position.
2. **The start nodes' order doesn't matter to the walk.** The same starts in another order share the walk and its cursors, as Decision 2's step 4 has the scope take `from` sorted (W18). The answer still gives them in the order given, each once (W3).
3. **Exact shapes.** The answer has exactly its twelve fields (W3), a node reached exactly eight (W4), a step exactly C5's six (W4), and a start node C3's five (W3). The engine answers exactly its eight, and an entry of `reached` its seven: no `path`, which `pathOf` gives (WK5).
4. **`types` is answered sorted and each once, null when none is given** (W2).
5. **`finished` is `depth` when the walk is complete,** a walk that runs out of nodes before its depth included (W5, W8).
6. **Parallel relationships of one type from one node:** which one a path takes isn't predicted, only that it's one of them and the same on every walk of the same graph (W6). The ADR's tie-break ends with `elementId`, whose order in the fake the tests don't lean on.
7. **A step dropped at the bound leaves nothing behind:** its nodes, those it left out and its tag nodes are neither answered nor counted (WK7).
8. **`unknown-node` names every key that names no node,** in its message, with `from` as its input; the engine names the input it is given, `from` when given none (W21, WK9).
9. **The engine throws a plain `Error` for a call no schema lets through:** a `from` that isn't a list of 1 to 100 keys, a malformed type, a direction other than the three, a depth that isn't a whole number from 1 to 10, a bound below 1 (WK10). That's a programming error, not a refusal, as `trust` throws.
10. **A start named twice is walked from once** (W3).
11. **`tagsLeftOut` counts tag nodes, each once,** as a walk meets nodes: a tag node met from two starts counts once (W8). list-relationships' `tagsLeftOut` counts relationships.

## The fakes

ADR 0014 asks the Tester for one route (Implementation notes, For the Tester). It is added this way, and every existing fake test still passes:

- **`test/helpers/graphFake.js`** routes a walk's step to the path fake with no repertoire (`types: null`). A step here is a statement that opens with `MATCH (x:TapestryNode)`, with no property map, then one relationship held in a variable, of no type or of types in backticks joined by `|`, to a bare node, then `WHERE x.tapestryKey IN $p` (`STEP_FROM_KEYS`). As for ADR 0013's one-hop reads, any relationship later in the statement keeps the repertoire. So does a relationship with no variable, or a labelled node at the far end, which is the shape of `_sets.js`'s read of a set's parents (F26).
- **No change to `pathCypherFake.js` or `nodeCypherFake.js`.** The path fake already runs S2 once the repertoire is lifted: untyped relationships, several backticked types, `IN` with a list, the trust fragment, `elementId()` and `[k IN keys(r) | [k, r[k]]]`. The node fake runs S1 (`IN` with a list). The Tester checked both before writing the route.
- **F26** in `test/operations/graph-fake.test.js` pins the route: a step out and in with no type, and with three backticked types, one outside the fake's repertoire, from two nodes at once, the nodes in `$known` left out and tag nodes flagged. A later relationship, and a read of a set's parents, still fail. **Its number may clash** with A10.27's or A10.21's fake tests, built at the same time; whichever merges second renumbers.
- **What shares the fake, run unchanged after the route:** `graph-fake.test.js` 27 of 27, `graph/list-relationships.test.js` 26 of 26, `graph/list-relationships-agent-through-cli.test.js` 2 of 2, `graph/list-elements.test.js` 30 of 30, `graph/link-set.test.js` 21 of 21, `resolve.test.js` 11 of 11, `graph/history.test.js` 8 of 8.

## Edge cases

- [x] **Cycles:** elem3's CITES back to the start, set2's MENTIONS to itself, and every relationship walked back under `both` (W5, W7).
- [x] **A start node another start leads to** (W7), and **a start named twice** (W3).
- [x] **Ties,** each pair made in the order that would mislead a walk that took the first relationship it met: the start, the parent, the type, out against in (W6).
- [x] **Parallel relationships:** pair's two SAME (W6).
- [x] **The order between the tie-break's keys,** and out before in against a lesser parent (W32, added after the review).
- [x] **A node left out, and a tag node passed by, met again a step later** (W31, added after the review).
- [x] **A type the graph doesn't declare, a type no relationship has, 50 types, 51** (W2, W22).
- [x] **Tag nodes:** HAS_TAG out, REFERENCES in, one met from two starts, one with a node behind it (W8).
- [x] **Nodes no walk meets:** no tapestryKey, keyed `'{}'`, a change entry (W8).
- [x] **A node left out with a node behind it** that only it leads to (W9).
- [x] **A start by an untrusted author** (W10).
- [x] **Scores that change between walks, and scores that don't exist yet** (W12, W13).
- [x] **A page that runs from one depth into the next** (W15).
- [x] **Nodes added and cut off between pages,** at an unchanged depth (W17).
- [x] **Cursors carried to another walk, or forged** (W18).
- [x] **Depth 10, and depth left out** (W19).
- [x] **The bound,** exactly met and passed, at the route with the real 10,000 and at the engine with small bounds, under `both` and with tag nodes and nodes left out (W20, WK7, WK8).
- [x] **100 start nodes through Express's own query parser** (qs reads repeated keys as a list; a qs that capped them would fail W28).
- [x] **A type that carries Cypher after a backtick** is refused by the input's pattern before any statement is built (W22), and the engine throws for it (WK10).
- [x] **A read that says nothing happened** (W24) is paired with walks that answered 200 in the same run, as workflow 3 asks.

## Test infrastructure

- **Runner.** Node's, through each suite's own `run()` (`test/helpers/graphOpsSuite.js`'s `makeSuite`), as every suite under `test/operations/` has.
- **No live API.** Every suite gives its child processes dead Neo4j, Redis, Meilisearch and base-URL endpoints (`S.childEnv`). The local `:7778` stack is the owner's agent-memory instance, so no suite here reaches it.
- **Firmware.** None installed. Nothing reads a concept definition.
- **Fixtures.** `test/helpers/walkGraph.js` (new), whose header says what each node is for:
  - `seedWalk()`: the class thread with a relationship back, a loop and tag nodes; the tie-break group, on fixed keys; the point-of-view group; the tag nodes; the filter; a chain of 12; lonely; bulkHub's 60 links and 60 leaves; and the scores. `unscored` takes every influence away.
  - `seedBound()`: boundHub, boundMid and 10,000 leaves, for W20 alone, so the other tests' graph stays small.
- **The live check** is Implementation's, on a scratch stack (ADR, Implementation notes). It isn't a gate suite.

## How to run

On this Mac, run the suites one at a time, never a full `npm test`, with every endpoint dead:

```
export NEO4J_URI=bolt://127.0.0.1:9 REDIS_HOST=127.0.0.1 REDIS_PORT=9 BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_BASE=http://127.0.0.1:9 MEILI_URL_HOST=http://127.0.0.1:9
node test/operations/walk.test.js
node test/operations/graph/walk.test.js
node test/operations/graph/walk-agent-through-cli.test.js
node test/operations/graph-fake.test.js
node test/operations/graph/list-relationships.test.js
node test/operations/graph/list-elements.test.js
node test/operations/graph/link-set.test.js
node test/operations/resolve.test.js
```

The full gate runs in the pull request's CI.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-16, on branch `A10.14-walk` at `47816cae`, with the test changes in place and nothing else changed:

```
=== operations: the walk (walk.js) ===
  FAIL  WK1: it exports the inputs, the limits, REACHED, UNKNOWN_NODE and walk, with Decision 1's limits
        src/operations/walk.js does not exist yet (ADR graph-operations-first-slice/0014 Decision 1)
  …  (WK2–WK11 the same)
operations: the walk (walk.js): 0 passed, 11 failed, 0 skipped

=== operations: graph walk ===
  FAIL  W1: a walk from one node reaches every node within depth steps, each once, at its least number of steps
        src/operations/catalog/graph/walk.js does not exist yet (ADR graph-operations-first-slice/0014 Decision 2)
  …  (W2–W30 the same)
operations: graph walk: 0 passed, 30 failed, 0 skipped

=== operations: an admin agent walks the graph through the external CLI ===
  FAIL  WX1: …  src/operations/catalog/graph/walk.js does not exist yet (ADR graph-operations-first-slice/0014 Decision 2)
  FAIL  WX2: …  the same
operations: an admin agent walks the graph through the external CLI: 0 passed, 2 failed, 0 skipped

=== operations: the fake graph ===
operations: the fake graph: 27 passed, 0 failed, 0 skipped   (F26 new, F1–F25 as before)
```

**That the expectations are right.** The Tester checked the expected walks with a breadth-first search of distances only, written apart from the suites and kept outside the tree. It agreed on every walk the suites name: the class thread out, in and both ways, two starts, the tie group, the point of view scored and unscored, tag nodes, the filter, bulk, the chain, the 100 starts and the cross-check.

**That they can pass.** Before committing them, the Tester ran the suites once against a throwaway build of the ADR. It was kept outside the tree and copied in only for that run, and the tree was restored after.

| Suite | Passed |
|---|---|
| `walk.test.js` | 11 of 11 |
| `graph/walk.test.js` | 29 of 30 |
| `graph/walk-agent-through-cli.test.js` | 2 of 2 |

The one left, W30, fails on the catalog's Paging bullet alone: the docs are the Implementer's (ADR Decision 4), and the throwaway build changed none.

**After the review** (review 14, non-blocking 1 and 2), the Tester added W31 and W32, with the seed groups they walk (`rm0`; `ord0`, on fixed keys). `graph/walk.test.js` passes 32 of 32. Each fails under the review's breaking change: W32 when `walk.js` compares the type before the parent, W31 when it no longer adds the nodes it left out and the tag nodes it passed by to what it has met.
