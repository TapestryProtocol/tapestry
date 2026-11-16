# Test Plan: Story 13 — `graph list-relationships`, a node's typed relationships, in and out, each with the way it points

**Story:** `engineering-team/stories/graph-operations-first-slice/13-list-relationships.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0013-list-relationships-and-the-relationship-conventions.md`
**Date:** 2026-11-16

## Coverage map

Every suite is stack-free and lives under `test/operations/`, where `test/operations.test.js` finds and runs it (ADR graph-operations-foundation/0001, Decision 12). None needs a line in `test/registry.js`, and each also runs on its own: `node <file>`.

The requests go through the operations harness (`test/helpers/operationsHarness.js`): the real router, the real central auth middleware and the real command. The graph is a fake (`test/helpers/graphFake.js`), seeded by `test/helpers/relationshipsGraph.js`, which is new in this story. The fakes gain what the ADR's statements need (below), and nothing they did before changes.

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1 — A node's relationships, in and out | LR1 hub's 9 out (a relationship to itself among them) and 3 in, of every type, in order, each once; not those to a node with no tapestryKey or keyed `'{}'` · LR2 `type` CITES; FOLLOWS, which the graph doesn't declare; a type no relationship has, an empty list and no refusal · LR3 `out`, `in`, `both` (the default); a relationship from the node to itself under each · LR4 the answer gives the node with its five facts, `type` (null when not given), `direction` and `pov`; a node with no relationships · LR5 tag nodes: left out with no type and counted as `tagsLeftOut` (3 out, 1 in); listed with `type` HAS_TAG or REFERENCES, then counting as author-less; a tag node asked about lists its other relationships; a node with only tag nodes | `graph/list-relationships.test.js` | integration (route over the fake graph) |
| AC2 — Each relationship, answered, with the way it points | LR6 exactly `{ type, direction, from, to, node, properties }`, the node's five facts, `from` and `to` by direction, a loop from and to the node · LR7 `properties`: `{}` for most, a FOLLOWS' integer timestamp and a TAGS' integer `createdAt` as numbers, keys sorted · LR8 alice's three TAGS to bob each listed, told apart by their tags · RC18 the `RELATIONSHIP` schema · RC19 `relationshipColumns` · RC20 `relationshipOf` | `graph/list-relationships.test.js`, `reads.test.js` | integration; unit |
| AC3 — Page by page | LR9 bulkHub's 130 in three pages (50 out; 20 out and 30 in; 30 in), in order, each once, with the whole count on every page · LR10 limit 3 and 200; 0 and 201 refused naming `limit`; a page of 1 parts alice's three TAGS · LR11 between two pages, one relationship answered and one not yet taken out, one that sorts first and one last added: no other twice or missing · LR12 a cursor refused `invalid-cursor` when it comes from another node, point of view, type or direction, from list-elements, or is garbage. So is one of this read's whose position isn't `[direction, type, key, rid]`: not a list, a direction it doesn't give, `in` for a list of `out`, a type that isn't one, another type than `type`, a key that isn't one, too short. Its own list pages on, typed too | `graph/list-relationships.test.js` | integration |
| AC4 — From a point of view, the owner's by default | LR13 the owner's keeps the relationships to the assistant's, the owner's, the author-less and hi (0.2) nodes, and to hub itself; leaves out 0.01, no influence and no NostrUser; kept 8, left out 4; `owner` and the owner's pubkey answer as the default; out, in and CITES alone · LR14 the node asked about, by a peer scored 0.01, is still answered, and its relationship to hub counts · LR15 kept, leftOut and tagsLeftOut across the whole list on a page of 2 · LR16 `everyone` keeps all 12 · LR17 new scores between two runs answer differently (9 and 3), and both runs only read · LR18 no scores yet: kept 7, `scored: false` · LR19 a stranger's or the admin's pubkey refused `unknown-pov`, naming the two it reads from; `house` refused `invalid-input` · RC21 `trust(v, keep)` judges the node at the other end and carries the relationship | `graph/list-relationships.test.js`, `reads.test.js` | integration; unit |
| AC5 — What it refuses | LR20 no `node` (alone, and with other inputs): `missing-input`; a key no node has, and a change entry's: `unknown-node`, 404, naming `node` · LR21 a `node` that isn't a key; a `type` with a space, a leading digit, a dash, or a backtick and Cypher after it; a `direction` other than the three, `OUT` included; an unknown input | `graph/list-relationships.test.js` | integration |
| AC6 — A read, behind sign-in, for agents | LR22 401 and 403; an admin reads what the owner reads · LR23 reads only: no write transaction, the same nodes and relationships, no change entry · LR24 the command answers what the route answers, a refusal included, and `--direction in --type CITES` · LR25 listed for an admin with its six inputs and its refusals; `/docs` has GET with the six parameters · RX1 an admin agent pages through hub to its last cursor, through the external CLI, getting the 8 the owner keeps once each · RX2 it lists hub's incoming CITES from everyone's point of view, and is refused a key no node has · *on a real Neo4j: the live check* | `graph/list-relationships.test.js`, `graph/list-relationships-agent-through-cli.test.js` | integration; the real external CLI against a loopback instance; live |
| AC7 — The convention for relationship reads, written once | LR26 the declaration's `limit`, `cursor` and `pov` are `reads.js`'s; `direction` takes the three, `both` by default; `type` is a pattern that takes plain names and refuses the rest; `node` is required. It declares `reads.js`'s two refusals and `unknown-node`. The node asked about is `NODE`, its relationships `RELATIONSHIP` and its `pov` `POV`. The catalog's Conventions say how a relationship is answered and judged. §1's row gives the answer as built, and §1 no longer says a walk follows only the edges whose authors its point of view trusts · RC17 the new exports · `graph/list-elements.test.js` and `graph/history.test.js` run unchanged | `graph/list-relationships.test.js`, `reads.test.js` | integration; unit; docs |

## The readings these tests take

The ADR leaves these open, or states them loosely. The tests settle them:

1. **A cursor's position is a list of four,** `[direction, type, otherKey, rid]`, as Decision 2's step 3 names it. LR12 opens a real cursor to forge positions, and so pins that the cursor is C1's `[read, scope, position]` with this position.
2. **Exact shapes.** The node asked about has exactly C3's five facts, and each relationship exactly C5's six (LR4, LR6, RC20).
3. **Parallel relationships come in no pinned order.** Two that share a direction, a type and the node at the other end follow the element id, which the tests don't predict. They check only that each comes once, and together (LR8, LR10, LR11).
4. **What the answer echoes.** `type` is given back as asked, null when not, and `direction` as asked, `both` when not (LR2, LR3, LR4).
5. **`tagsLeftOut` is 0 with a type,** and a tag node, listed, counts as author-less from the owner's point of view (LR5).
6. **A type no relationship has** is an empty list, not a refusal, and a type the graph doesn't declare is listed like any other (LR2).
7. **`trust`'s `keep` throws for a name that isn't a variable,** as `trust` does for `v`. That's a plain error, not a refusal (RC21).

## The fakes

ADR 0013 asks the Tester for three things in the fakes (Implementation notes, For the Tester). They are added this way, and every existing fake test still passes:

- **`test/helpers/graphFake.js`** routes ADR 0013's one-hop reads to the path fake with no repertoire (`types: null`). A one-hop read here is a statement that opens with `MATCH (x:TapestryNode {tapestryKey: $p})`, then one relationship held in a variable, of no type or of one type in backticks, to a bare node (`ONE_HOP_FROM_KEY`). The repertoire still applies to everything else: a relationship with no variable, a type outside backticks, a second hop, a later `MATCH`. So F14 is unchanged, and still refuses FOLLOWS named the old way.
- **`test/helpers/pathCypherFake.js`:**
  - with `types: null`, a relationship of no type matches every type, and a named type needn't be in the repertoire;
  - `elementId(x)` gives `5:<database id>:<eid>`;
  - `properties(x)` gives a node's or a relationship's map, an integer left as `{ $int }`. That is how the driver's `toJS` leaves an Integer inside a map, so a read that used it would answer an integer that isn't a number (Context 7).
- **`test/operations/graph-fake.test.js`** gains:
  - F21: one-hop reads of every type, out and in, untyped and in backticks, a loop in both directions, and the limits that stay;
  - F22: `elementId()` is text, one for each relationship, the same on every read, and compares as text;
  - F23: `properties()` leaves the integer unconverted, and `[k IN keys(r) | [k, r[k]]]` gives it as a number.

## Edge cases

- [x] **A relationship from the node to itself:** once, as `out`, under `both` and `out`; once, as `in`, under `in`. Judged by the node itself (LR3, LR6, LR14).
- [x] **Parallel relationships:** three TAGS between alice and bob, each listed and paged apart (LR8, LR10).
- [x] **A type outside the repertoire, and one the graph doesn't declare:** CITES, MENTIONS, TAGS, FOLLOWS (LR2, F21).
- [x] **A type no relationship has** (LR2).
- [x] **Tag nodes,** out (HAS_TAG) and in (REFERENCES from another event's tag), with and without a type, and a tag node asked about (LR5).
- [x] **A node with no relationships, and one with only tag nodes** (LR4, LR5).
- [x] **Nodes at the other end with no tapestryKey, or keyed `'{}'`:** never listed or counted (LR1).
- [x] **No author, no address:** citedAnon counts as the instance's own (LR6, LR13).
- [x] **A peer with no influence, and one with no NostrUser node** (LR13, RC21).
- [x] **The node asked about by an untrusted author** (LR14).
- [x] **Scores that change between reads, and scores that don't exist yet** (LR17, LR18).
- [x] **A page that runs from the outgoing relationships into the incoming** (LR9).
- [x] **Relationships added and taken out between pages,** before and after the cursor, in both directions (LR11).
- [x] **Cursors carried to another list, or forged** (LR12).
- [x] **Integer properties,** through the read and through the driver's map (LR7, RC19, F23).
- [x] **A `type` that carries Cypher after a backtick** is refused by the input's pattern before any statement is built (LR21).
- [x] **A read that says nothing happened** (LR23) is paired with reads that answered 200 in the same run, as workflow 3 asks.

## Test infrastructure

- **Runner.** Node's, through each suite's own `run()` (`test/helpers/graphOpsSuite.js`'s `makeSuite`), as every suite under `test/operations/` has.
- **No live API.** Every suite gives its child processes dead Neo4j, Redis, Meilisearch and base-URL endpoints (`S.childEnv`). The local `:7778` stack is the owner's agent-memory instance, so no suite here reaches it.
- **Firmware.** None installed. Nothing reads a concept definition.
- **Fixtures.** `test/helpers/relationshipsGraph.js` (new), whose header says what each node is for:
  - hub, with its relationships out and in, a loop, tag nodes, and nodes by every kind of author;
  - the people: alice, bob and carol, with parallel TAGS and a FOLLOWS that record integers;
  - bulkHub: 70 out and 60 in;
  - empty, tagsOnly, a change entry, and the scores.

  `unscored` takes every influence away.
- **The live check** is Implementation's, on a scratch stack (ADR, Implementation notes). It isn't a gate suite.

## How to run

On this Mac, run the suites one at a time, never a full `npm test`, with every endpoint dead:

```
export NEO4J_URI=bolt://127.0.0.1:9 NEO4J_USER=neo4j NEO4J_PASSWORD=none REDIS_HOST=127.0.0.1 REDIS_PORT=9 BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_BASE=http://127.0.0.1:9 MEILI_URL_HOST=http://127.0.0.1:9
node test/operations/graph/list-relationships.test.js
node test/operations/reads.test.js
node test/operations/graph/list-relationships-agent-through-cli.test.js
node test/operations/graph-fake.test.js
node test/operations/graph/list-elements.test.js
node test/operations/graph/history.test.js
```

The full gate runs in the pull request's CI.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-16, on branch `A10.13-list-relationships` at `1f53bf23`, with the test changes in place and nothing else changed:

```
=== operations: graph list-relationships ===
  FAIL  LR1: a node's relationships are every one that runs from it or to it, of any type, each once, and nothing else
        src/operations/catalog/graph/list-relationships.js does not exist yet (ADR graph-operations-first-slice/0013 Decision 2)
  …  (LR2–LR26 the same)
operations: graph list-relationships: 0 passed, 26 failed, 0 skipped

=== operations: the read conventions (reads.js) ===
  …  (RC1–RC16 pass, as before)
  FAIL  RC17: it exports RELATIONSHIP, relationshipColumns and relationshipOf
        it exports RELATIONSHIP, an object (ADR 0013, C5); got undefined
  FAIL  RC18: RELATIONSHIP is { type, direction, from, to, node, properties }, its node C3's NODE
        RELATIONSHIP requires its six facts; got null
  FAIL  RC19: relationshipColumns gives a relationship's type, its id as text, what it records as pairs, and the other node's facts
        relationshipColumns does not exist yet (ADR graph-operations-first-slice/0013 Decision 1)
  FAIL  RC20: relationshipOf answers a relationship by its direction, with its node and its properties as a map, keys sorted
        relationshipOf does not exist yet (ADR graph-operations-first-slice/0013 Decision 1)
  FAIL  RC21: trust(v, keep) carries the variables it keeps and judges the node v; a name that isn't a variable throws
        a statement that judges m and keeps r runs: trust carries the variables it keeps through its WITH (ADR 0013, C6); it failed: "Variable `r` not defined"
operations: the read conventions (reads.js): 16 passed, 5 failed, 0 skipped

=== operations: an admin agent lists relationships through the external CLI ===
  FAIL  RX1: …  does not exist yet (ADR graph-operations-first-slice/0013 Decision 2)
  FAIL  RX2: …  does not exist yet
operations: an admin agent lists relationships through the external CLI: 0 passed, 2 failed, 0 skipped

=== operations: the fake graph ===
operations: the fake graph: 24 passed, 0 failed, 0 skipped   (F21–F23 new, F1–F20 as before)
```

**That they can pass.** Before committing them, the Tester ran the suites once against a throwaway build of the ADR. It was kept outside the tree and copied in only for that run, and the tree was restored after.

| Suite | Passed |
|---|---|
| `graph/list-relationships.test.js` | 25 of 26 |
| `reads.test.js` | 21 of 21 |
| `graph/list-relationships-agent-through-cli.test.js` | 2 of 2 |
| `graph/list-elements.test.js` (after `trust`'s change) | 30 of 30 |
| `graph/history.test.js` | 8 of 8 |
| `graph/list-elements-agent-through-cli.test.js` | 2 of 2 |

The one left failing, LR26, failed only on the catalog's text, which Implementation writes. No test was changed to fit that build: it only showed that the tests ask for what the ADR describes.
