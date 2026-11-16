# Test Plan: Story 9 — `graph resolve`, a name, slug or nostr address turned into tapestryKeys

**Story:** `engineering-team/stories/graph-operations-first-slice/9-resolve.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0009-resolve-and-naming-a-node.md` (with its Amendment 1, which records the readings below)
**Date:** 2026-11-16

## Coverage map

Every suite is stack-free and lives under `test/operations/`, where `test/operations.test.js` finds and runs it (ADR graph-operations-foundation/0001, Decision 12). So none needs a line in `test/registry.js`, and each also runs on its own: `node <file>`.
- **The requests** go through the operations harness (`test/helpers/operationsHarness.js`): the real router, the real central auth middleware and the real command.
- **The graph** is a fake (`test/helpers/graphFake.js`), seeded by `test/helpers/resolveGraph.js`, new in this story. Its header says what each node is for.
- **The module's own checks** run in a child process with the harness's environment, over the same seed, through `readerOver`.

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1 — What a ref names | RV1 a key: the node; a change entry's, a tag node's and an unknown key: none; with `kind` · RV2 an address, its pubkey in capitals, a kind-30000 address, an unknown one · RV3 an event id in either case: the note, not the tag node that shares it; a replaceable node's latest id · RV4 `naddr`, `note1`, `nevent`; an `naddr` with a bad checksum, read as a name and a slug · RV5 a name, extra white space, a tapestryValue before a name, a name in another script · RV6 plurals, in capitals; a header with no plural · RV7 a slug and a d-tag: one and both; a core node's d-tag; a versioned d-tag; a header with no slug tag; not a kind-30000 d-tag, not a d-tag holding a colon · RV8 once, however many ways; never a change entry or a keyless node; `kind=concept`, `kind=set`, a card set · RS5 each shape, read | `graph/resolve.test.js`, `resolve.test.js` | integration (route over the fake graph); unit |
| AC2 — The candidates, and any ambiguity | RV9 exactly the five facts, `kind` and `matched`: the instance's own, a peer's ListHeader, an element, a superset, a set, a card set, a tapestryValue · RV10 the answer's keys; `ambiguous`, `kept` and `leftOut`; `ref` and `kind`; a ref that names nothing, and one whose only node is left out, answer empty lists · RS4 `READING` and `CANDIDATE` | `graph/resolve.test.js`, `resolve.test.js` | integration; unit |
| AC3 — From a point of view | RV11 `nostr relay`: one from the owner's, two and ambiguous from everyone's; `pov=owner` and the owner's pubkey as the default; a peer scored 0.2 counts, the admin at 0.01 doesn't · RV12 new scores between two runs answer differently, and both runs only read · RV13 no scores yet: only the instance's own, `scored: false` · RV14 a stranger's and the admin's pubkey `unknown-pov`; `house` `invalid-input` | `graph/resolve.test.js` | integration |
| AC4 — Page by page | RV15 120 nodes named `item`: 50, 50 and 20, each once, ascending; `kept` 120 on the first page; limit 3 and 200; 0 and 201 refused · RV16 the cursor pages its own list; another ref's, kind's, point of view's, list-elements', history's and garbage are refused | `graph/resolve.test.js` | integration |
| AC5 — What it refuses | RV17 no `ref` (`missing-input`); empty and spaces only (`bad-ref`); a control character, a text-direction control and an invisible character (`bad-ref`, naming U+0007, U+202E and U+200B); 1,001 characters (`invalid-input`), 1,000 fine; `kind=property`; an unknown input · RS6 the same, naming the input it is given; a name in another script, a long one and one with no slug pass · CN5 `textProblem`, nameProblem's first four checks, word for word | `graph/resolve.test.js`, `resolve.test.js`, `graph/concept-names.test.js` | integration; unit |
| AC6 — A read, behind sign-in, for agents | RV18 401 and 403; an admin reads what the owner reads · RV19 reads only: no write transaction, the same nodes and relationships, no change entry · RV20 the command answers what the route answers, a refusal included · RV21 listed with its five inputs and its refusals; `/docs` has GET with five parameters · RX1 an admin agent resolves a concept by name and lists its elements with the key it got back, through the external CLI · RX2 it is told a name is ambiguous, narrows a set by kind, and is refused a kind there isn't · *on a real Neo4j, through nginx: the live check* | `graph/resolve.test.js`, `graph/resolve-agent-through-cli.test.js` | integration; the real external CLI against a loopback instance; live |
| AC7 — Resolution, written once | RV22 the declaration's `limit`, `cursor` and `pov` are `reads.js`'s, its `ref`, `kind` and `bad-ref` are `resolve.js`'s, and its candidates are `CANDIDATE`, which keeps `NODE`; the catalog's "Naming a node" and §1's row · RS1–RS3 the exports, refusals and inputs · RS7 a key comes back as given, unread · RS8 one candidate: its key, narrowed by kind · RS9 none: `unknown-ref` · RS10 several: `ambiguous-ref`, with up to 10 candidates and `more` · RS11 loading opens nothing | `graph/resolve.test.js`, `resolve.test.js` | integration; unit; docs |

## The readings these tests take

The ADR leaves these open, or states them loosely. The tests settle them, and ADR Amendment 1 records them:

1. **A refusal carries its candidates** (RS10). `refusal.js` copies only `rule` and `input`, so it gains `candidates` and `more`. That is the one change to a shared module the tests ask for that the ADR's file list didn't name.
2. **`refInput(description)`** is `{ schema, description }`, with no `required` (RS3).
3. **`readingsOf` answers `family` and `readings`** (RS5).
4. **The answer's `ref` is trimmed, and the name read is cleaned** (RV5, RS5).
5. **The schemas' lists** for `READING.as`, `CANDIDATE.kind` and `CANDIDATE.matched` (RS4).
6. **`unknown-ref`'s message gives the number left out** (RS9).
7. **The fakes' routing** (F25).

## A change to a shared test helper

ADR 0009, Context 9: `graphFake.exec` sent every read with no relationship to `nodeCypherFake`, which refuses `OPTIONAL MATCH`. The trust fragment of `reads.js` adds one, with no relationship.
- **The change.** A read with `OPTIONAL MATCH` now goes to `pathCypherFake`. It is one condition in `exec`, with a note in the file's header.
- **Its test.** `test/operations/graph-fake.test.js` gains F25, numbered after story 13's F21–F24. It failed before the change ("the fake graph database can't read this Cypher (a OPTIONAL clause)…"), and passes after it.
- **Nothing else moved.** Every other suite under `test/operations/` passes as before (Verification).

## Edge cases

- [x] **A node found three ways,** by name, slug and d-tag, is listed once (RV8).
- [x] **A name another author also uses,** left out from the owner's point of view and counted from everyone's (RV8, RV11, RX2).
- [x] **A node named like a concept** (`Dog`) makes `dog` ambiguous for any node, and `kind=concept` settles it (RV10, RS8, RS10).
- [x] **A slug and a d-tag that differ,** as the firmware's `nostr-event-tag` does (RV7).
- [x] **Look-alikes that must not match:**
  - a d-tag of another kind (`30000:…:dog`);
  - a d-tag holding a colon (`x:dog`);
  - a versioned d-tag asked without its nonce (`cat` isn't `cat~1`'s d-tag);
  - a name property behind a tapestryValue (RV5, RV7).
- [x] **Things that are never candidates:** a change entry, a tag node whose uuid is an event id, nodes with no key or the key `'{}'` (RV1, RV3, RV8).
- [x] **A card set named like a set** is another node, and no set (RV8, RV9, RS8).
- [x] **A name with no slug, or in another script,** resolves (RV5, RS6).
- [x] **An identifier that doesn't decode** falls through to a name (RV4, RS5).
- [x] **Scores that change between reads,** and scores that don't exist yet (RV12, RV13).
- [x] **A cursor carried to another list,** kind, point of view or read (RV16).
- [x] **A read that says nothing happened** (RV19) is paired with reads that answered 200 in the same run, as workflow 3 asks.

## Test infrastructure

- **Runner.** Node's, through each suite's own `run()` (`test/helpers/graphOpsSuite.js`'s `makeSuite`), as every suite under `test/operations/` has.
- **No live API.** Every suite gives its child processes dead Neo4j, Redis, Meilisearch and base-URL endpoints (`S.childEnv`). The local `:7778` stack is the owner's agent-memory instance, so no suite here reaches it.
- **Firmware.** None installed. Nothing here reads a relationship alias.
- **Fixtures.** `test/helpers/resolveGraph.js` (new): eight concept headers with their `names` tags, all but `fish` with a `slug` tag, three of them another author's or versioned; elements, a set, a card set, a note and its look-alike tag node, a kind-30000 event, and 120 nodes named `item`; the NostrUser scores. `unscored` takes every influence away, and `items` sets how many share the name `item`.
- **The live check** is Implementation's, on a scratch stack (ADR, Implementation notes). It isn't a gate suite.

## How to run

On this Mac, run the suites one at a time, never a full `npm test`, with every endpoint dead:

```
export NEO4J_URI=bolt://127.0.0.1:9 NEO4J_USER=neo4j NEO4J_PASSWORD=none REDIS_HOST=127.0.0.1 REDIS_PORT=9 BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_BASE=http://127.0.0.1:9 MEILI_URL_HOST=http://127.0.0.1:9
node test/operations/graph/resolve.test.js
node test/operations/resolve.test.js
node test/operations/graph/resolve-agent-through-cli.test.js
node test/operations/graph/concept-names.test.js
node test/operations/graph-fake.test.js
```

The full gate runs in the pull request's CI.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-16, on branch `A10.9-resolve` at `5466749a`, with the new and changed test files in place and nothing else changed:

```
=== operations: graph resolve ===
  FAIL  RV1: a tapestryKey names the node that has it; a change entry, an event's tag node, or a key no node has names none
        src/operations/catalog/graph/resolve.js does not exist yet (ADR graph-operations-first-slice/0009 Decision 4)
  …  (RV2–RV22 the same)
operations: graph resolve: 0 passed, 22 failed, 0 skipped

=== operations: the resolution (resolve.js) ===
  FAIL  RS1: it exports the inputs, the refusals, the schemas and the functions the ADR names
        src/operations/resolve.js does not exist yet (ADR graph-operations-first-slice/0009 Decisions 1–3 and 5)
  …  (RS2–RS11 the same)
operations: the resolution (resolve.js): 0 passed, 11 failed, 0 skipped

=== operations: an admin agent resolves names through the external CLI ===
  FAIL  RX1: the agent resolves a concept by its name, gets one candidate, and lists its elements with the key it got back
        src/operations/catalog/graph/resolve.js does not exist yet (ADR graph-operations-first-slice/0009 Decision 4)
  FAIL  RX2: …
operations: an admin agent resolves names through the external CLI: 0 passed, 2 failed, 0 skipped

=== operations: concept names ===
  PASS  CN1–CN4
  FAIL  CN5: textProblem finds an empty text and each character that can make it read as another, as nameProblem words them, and nothing else
        conceptNames exports textProblem, nameProblem's first four checks (ADR graph-operations-first-slice/0009 Decision 6)
operations: concept names: 4 passed, 1 failed, 0 skipped
```

**The fake's routing change.** F25 (numbered F21 when this ran) failed before it, and passes after: `operations: the fake graph: 22 passed, 0 failed`. With the change in place, every other suite under `test/operations/` passes as before, run one at a time (2026-11-16):
- `test/operations/`'s own five suites;
- `graph/`: 18 suites besides the two new ones, with concept-names passing CN1–CN4 and failing only the new CN5;
- `rules/` (5 suites).

`lifecycle/` was left out: it doesn't read through the fake's routing, and three of its suites are gated on a scratch container.

**That the expectations are the ADR's.** Before committing them, the Tester ran Decision 3's statements T and N over the seed through `pathCypherFake`, from a script kept outside the tree. Statement N was run with the trust fragment and the matched columns. That run was for 27 refs and both points of view.
- **Two expectations were wrong, and were fixed:**
  - `fido`'s seeded address had made its d-tag match too, so the seed now gives it an element's address;
  - `nostr relay` has a space, so it is never read as a slug.
- **Everything else** matched the suites' expectations.

Whether the suites pass as a whole is shown at Implementation.
