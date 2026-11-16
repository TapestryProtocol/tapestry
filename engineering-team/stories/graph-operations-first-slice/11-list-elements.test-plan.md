# Test Plan: Story 11 — `graph list-elements`, the elements of a concept or a set, from a point of view

**Story:** `engineering-team/stories/graph-operations-first-slice/11-list-elements.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0011-list-elements-and-the-read-conventions.md` (with its Amendment 1, which records the readings below)
**Date:** 2026-11-15

## Coverage map

Every suite is stack-free and lives under `test/operations/`, where `test/operations.test.js` finds and runs it (ADR graph-operations-foundation/0001, Decision 12), so none needs a line in `test/registry.js`. Each also runs on its own: `node <file>`. The requests go through the operations harness (`test/helpers/operationsHarness.js`): the real router, the real central auth middleware and the real command. The graph is a fake (`test/helpers/graphFake.js`) seeded by `test/helpers/elementsGraph.js`, new in this story. The fakes run the ADR's statements as they are on staging, and no shared helper is changed.

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1 — The elements of a concept or a set | LE1 every node dog's class thread reaches, each once (bella has two paths), and not an implicit member, a node of no concept, a change entry, a set, the superset or a node with no tapestryKey · LE2 a set's own and its sub-set's; the superset as `set` lists the concept · LE3 `direct`, for a concept, a set and a superset · LE4 a class link (dog's superset under mammal's) and a concept labelled ListHeader only · LE5 an empty concept and one with no superset · LE6 the answer names the concept or set, the other null | `graph/list-elements.test.js` | integration (route over the fake graph) |
| AC2 — Each element, answered | LE7 exactly `{ tapestryKey, name, address, author, own }`: the assistant's, the owner's, one with no author or address, a peer's, an admin's, a tapestryValue before a name, no name at all · RC4 the `NODE` schema · RC13 `nodeColumns` and `nodeOf` | `graph/list-elements.test.js`, `reads.test.js` | integration; unit |
| AC3 — Page by page | LE8 three pages of bulk (50, 50, 20), each element once, ascending tapestryKey · LE9 limit 3 and 200; 0 and 201 refused naming `limit` · LE10 between two pages, two taken out and two added: no other element twice or missing · LE11 a cursor for another concept, another point of view, the other `direct`, the same elements asked as a set, history's, and garbage, refused `invalid-cursor`; its own list pages on · RC5–RC8 the cursor's text, what it refuses, the scope, a page's cut | `graph/list-elements.test.js`, `reads.test.js` | integration; unit |
| AC4 — From a point of view, the owner's by default | LE12 the owner's keeps the assistant's, the owner's, the author-less and a peer scored 0.2; leaves out 0.01, no influence, no NostrUser and the admin (scored 0.01); `owner` and the owner's pubkey answer as the default · LE13 kept and leftOut across the whole list on a page of 2 · LE14 `everyone` keeps all 12 · LE15 new scores between two runs answer differently, and both runs only read · LE16 no scores yet: only the instance's own, `scored: false` · LE17 the cutoff from `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` (0.3) · LE18 a stranger's or the admin's pubkey refused `unknown-pov`, naming the two it reads from; `house` refused `invalid-input` · RC9–RC12, RC14 how a point of view resolves, `scored`, the cutoff (set, unset, not a number), what `trust` counts, `ownKeys` | `graph/list-elements.test.js`, `reads.test.js` | integration; unit |
| AC5 — What it refuses | LE19 neither, neither with other inputs, both: `concept-or-set` · LE20 unknown keys, and a change entry's: `unknown-node`, naming the input · LE21 a set, a superset or an element as `concept`: `not-a-concept` (pass it as set); a header or an element as `set`: `not-a-set` (pass it as concept, naming its superset) · LE22 malformed keys, a `direct` that isn't true or false, an unknown input · LE28 a trust-pipeline card set, labelled `Set` with no address: `not-a-set` as `set`, and `not-a-concept` with no "pass it as set" as `concept` (ADR Amendment 2) | `graph/list-elements.test.js` | integration |
| AC6 — A read, behind sign-in, for agents | LE23 401 and 403; an admin reads what the owner reads · LE24 reads only: no write transaction, the same nodes and relationships, no change entry · LE25 the command answers what the route answers, a refusal included, and `--direct` alone is true · LE26 listed for an admin with its inputs and refusals; `/docs` has GET with the six parameters · LX1 an admin agent pages through a concept to its last cursor, through the external CLI · LX2 it lists a set from everyone's point of view and is refused a header as a set · *on a real Neo4j, through nginx: the live check* | `graph/list-elements.test.js`, `graph/list-elements-agent-through-cli.test.js` | integration; the real external CLI against a loopback instance; live |
| AC7 — The conventions, written once | LE27 the declaration's `limit`, `cursor` and `pov` are `reads.js`'s, it declares `reads.js`'s two refusals, and its elements and `pov` are `NODE` and `POV`; the catalog's Conventions name `reads.js`, ADR 0011 and the conventions' words; §1's row gives the answer as built · RC1–RC3 the exports and their schemas · RC15 loading it opens nothing · `graph/history.test.js` runs unchanged | `graph/list-elements.test.js`, `reads.test.js`, `graph/history.test.js` | integration; unit; docs |

## The readings these tests take

The ADR leaves these open, or states them loosely. The tests settle them, and ADR Amendment 1 records them:

1. **The three inputs are input declarations.** `LIMIT_INPUT`, `CURSOR_INPUT` and `POV_INPUT` are each `{ schema, description }`, and a read puts them into its `inputs` as they are (RC2, LE27).
2. **Nullable facts.** `NODE`'s `name`, `address` and `author`, and `POV`'s `observer`, `cutoff` and `scored`, are `nullable: true` (RC4).
3. **The answer's `pov` holds four facts:** `{ name, observer, cutoff, scored }` (LE6, LE12).
4. **The input not given is null** in the answer (LE6).
5. **A superset given as `concept`** gets the same hint as a set (LE21).
6. **A cursor's position must pass the read's own test,** and its JSON must be three items long (RC6).
7. **`everyone` resolves without a read** (RC10).

At Implementation, ADR Amendment 2 adopted ADR 0028's Amendment 3: a set or superset has an address. LE28 was added for it in a Tester commit of its own, and it failed against the code it was added beside, as the Verification below records.

## Edge cases

- [x] **One element reached by two paths:** bella, once (LE1, LE2).
- [x] **A set two levels down:** puppies' elements are dog's and walkers' (LE1, LE2).
- [x] **A class link across concepts:** mammal holds dog's elements (LE4).
- [x] **A concept the import brought in,** labelled ListHeader only (LE4).
- [x] **No elements, and no superset:** an empty list, a null cursor, 0 and 0 (LE5).
- [x] **Things that aren't elements:** an implicit member, a node of no concept, a change entry, a node with no tapestryKey (LE1).
- [x] **No author, no address:** ada counts as the instance's own (LE7, LE12, RC12, RC13; ADR Decision 1, C2).
- [x] **An admin's element** counts by score and isn't the instance's own (LE7, LE12, LX1).
- [x] **A peer with no influence, and one with no NostrUser node** (LE12, RC12).
- [x] **Scores that change between reads,** and scores that don't exist yet (LE15, LE16).
- [x] **A cutoff that isn't set, or isn't a number** (RC11).
- [x] **Elements added and taken out between pages,** before and after the cursor (LE10).
- [x] **A cursor carried to another list,** another point of view, or the other `direct`; history's cursor (LE11, RC6).
- [x] **A read that says nothing happened** (LE24) is paired with reads that answered 200 in the same run, as workflow 3 asks.

## Test infrastructure

- **Runner.** Node's, through each suite's own `run()` (`test/helpers/graphOpsSuite.js`'s `makeSuite`), as every suite under `test/operations/` has.
- **No live API.** Every suite gives its child processes dead Neo4j, Redis, Meilisearch and base-URL endpoints (`S.childEnv`). The local `:7778` stack is the owner's agent-memory instance, so no suite here reaches it.
- **Firmware.** None installed. The class thread's relationship types come from the firmware's definition files (`relAlias`), which are in the tree.
- **Fixtures.** `test/helpers/elementsGraph.js` (new): dog with a superset, two sets and twelve elements; mammal, cat, empty, bare and a bulk concept of 120 elements; the NostrUser scores. Its header says what each node is for. `unscored` takes every influence away.
- **The live check** is Implementation's, on a scratch stack (ADR, Implementation notes). It isn't a gate suite.

## How to run

On this Mac, run the suites one at a time, never a full `npm test`, with every endpoint dead:

```
export NEO4J_URI=bolt://127.0.0.1:9 NEO4J_USER=neo4j NEO4J_PASSWORD=none REDIS_HOST=127.0.0.1 REDIS_PORT=9 BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_BASE=http://127.0.0.1:9 MEILI_URL_HOST=http://127.0.0.1:9
node test/operations/graph/list-elements.test.js
node test/operations/reads.test.js
node test/operations/graph/list-elements-agent-through-cli.test.js
```

The full gate runs in the pull request's CI.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-15, on branch `A10.11-list-elements` at `fee1adbe`, with the new test files in place and nothing else changed:

```
=== operations: graph list-elements ===
  FAIL  LE1: a concept's elements are every node its class thread reaches, each once, and nothing else
        src/operations/catalog/graph/list-elements.js does not exist yet (ADR graph-operations-first-slice/0011 Decision 2)
  …  (LE2–LE27 the same)
operations: graph list-elements: 0 passed, 27 failed, 0 skipped

=== operations: the read conventions (reads.js) ===
  FAIL  RC1: it exports the inputs, the refusals, the schemas and the functions the ADR names
        src/operations/reads.js does not exist yet (ADR graph-operations-first-slice/0011 Decision 1)
  …  (RC2–RC15 the same)
operations: the read conventions (reads.js): 0 passed, 15 failed, 0 skipped

=== operations: an admin agent lists elements through the external CLI ===
  FAIL  LX1: the agent lists a concept's elements page by page, to the end, each kept element once, with what was left out counted
        src/operations/catalog/graph/list-elements.js does not exist yet (ADR graph-operations-first-slice/0011 Decision 2)
  FAIL  LX2: …
operations: an admin agent lists elements through the external CLI: 0 passed, 2 failed, 0 skipped
```

**LE28, added at Implementation** (ADR Amendment 2), was run on 2026-11-16 against `c0bcb744`, the implementation before the amendment. It failed for the reason it names, and the rest passed:

```
  FAIL  LE28: a node labelled Set with no address, as the trust pipeline's card sets are, is no set
        card-set: 409 not-a-set; got 200 {"success":true,"data":{"concept":null,"set":"901fc764-…","direct":false,…,"kept":0,"leftOut":0,"elements":[],"cursor":null}}
operations: graph list-elements: 27 passed, 1 failed, 0 skipped
```

**That they can pass.** Before committing them, the Tester ran the three suites once against a throwaway build of the ADR. It was kept outside the tree and copied in only for that run. The results were 26 of 27, 15 of 15 and 2 of 2. The one left failing, LE27, checks the catalog's Conventions, which Implementation writes. No test was changed to fit that build: it only showed that the tests ask for what the ADR describes. `graph/history.test.js` passes as it stands (8 of 8).
