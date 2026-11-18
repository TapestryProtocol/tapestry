# Test Plan: Story 42 — Both readers judge a node's tapestryJson

**Story:** `engineering-team/stories/graph-operations-first-slice/42-both-readers-judge-tapestryjson.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0042-both-readers-judge-tapestryjson.md`
**Date:** 2026-11-17

Every suite is stack-free, and each runs in child processes with every service endpoint dead and a store of its own (`TAPESTRY_LMDB_PATH`, from `test/helpers/graphOpsSuite.js`'s `childEnv`):

- **The rule's suite and SC1–SC8, SC10 and SC11** run over the fake graph (`test/helpers/graphFake.js`'s `readerOver`), with tapestryJson put into the child's real LMDB store.
- **SC9, SC12 and SC13** run the real derivers (`src/lib/derivers/word.js`, `set.js`), the real derive engine and the real rule in one child, with `src/lib/neo4j-driver`, `src/lib/tapestry-store` and `src/lib/tapestry-resolve` stubbed in `require.cache`.
  - The stubbed database answers each statement by the parameters it takes, as a graph holding the case's one node would, so the Implementer's queries aren't pinned: `$keys` is the class-thread walk, `$key` E1 or E4, `$elementId` the derive step's own queries.
  - One statement is matched by its text: `deriveAll`'s list of nodes, which ADR 0042 leaves as it is.
- **The write suites** (`create-set`, `create-element`, `update-node`) run the real catalog over the fake graph (`test/helpers/operationsHarness.js`).

The stack-free suites can't reach five things, which the live check covers on a scratch stack (below): Neo4j itself, the real LMDB under the derive step (SC9 stubs it), a firmware reinstall, rule 7's element in the graph, and Pass 3's timing.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| **AC1: the rule judges a node's tapestryJson** | **EFS8:** where the tapestryJson and the json tag differ, the tapestryJson decides: diffFits fits (its tag lacks the description, its tapestryJson has it), diffMisses doesn't (the other way round); under firmware `word`'s schema, wordFull fits (its tapestryJson has its `graphContext`, its tag has none) and wordNoContext doesn't, since the check form sets nothing aside. **EFS3:** rover, walker, walkerDog and walkerPet judged on their tapestryJson; broken's, a list, gives one finding saying it isn't an object, and its unparseable json tag isn't read. **SC10:** `tapestryJsonOf` gives the store's entry as it was put, `graphContext` and all, and a problem for an entry that isn't an object, not marked missing. **EFS11:** a stored `derivedAt` beyond the Date range stops nothing: wordFar, which fits, gives no finding, and farMisses, which doesn't, gives its finding with its `derivedAt` and a message giving the number and no date. | `test/operations/rules/element-fits-schema.test.js`, `test/operations/graph/element-schemas.test.js` | integration (fake graph, real store); unit |
| **AC2: a node with no tapestryJson** | **EFS9:** noEntry, whose json tag fits beagle, gives one `invalid-fields` finding, marked `missing`, naming no concept, saying it has no tapestryJson yet and that the derive step builds it; no finding for each concept, and no fallback to the json tag. **SC10:** `tapestryJsonOf` of a node with no entry is a problem marked missing that says so. | `element-fits-schema.test.js`, `element-schemas.test.js` | integration (fake); unit |
| **AC3: one verdict, from both readers** | **SC9:** ten cases. The real derive step builds the node's tapestryJson, the store keeps it, and the rule checks the node. On each concept they agree, the cache's `valid` beside the rule's finding: <br>• create-concept's schema, fitting and not; <br>• firmware dog's, in its set and outside it; <br>• firmware `word`'s, which a node fits once its `graphContext` is built; <br>• a schema that forbids extra top-level keys, which the stored `graphContext` breaks; <br>• a `word` block missing a field the derive step fills in; <br>• an entry built before the node's json tag changed; <br>• a schema that doesn't compile, not checkable in both; <br>• a concept only a `z` tag names, judged by neither. <br>The cache's errors are the rule's problems, in its words, and nothing reads as missing. **SC12:** an entry's shape (the schema node's `uuid` and `tapestryKey`, the concept's `conceptName` and `conceptTapestryKey`, `lastValidated`, `valid`, `errors`); two schema nodes give one entry each, `valid: null`, with the rule's problem; no schema node gives no entry; the set deriver's verdicts are the rule's too; and the stored tapestryJson, its entries filled in, still fits firmware `word`'s schema. **SC13:** `deriveAll('ListItem')` over three nodes reads the concept's schema once, and each node has its verdict (ADR 0042 Decision 6). | `element-schemas.test.js` | unit (real derivers and rule, stubbed database and store) |
| **AC4: a write doesn't fail a node for what the derive step builds** | **SC11:** `fits` under firmware `word`'s schema: <br>• a full `word` block is `fits: null, waiting: true`, no problems, its `problem` naming the derive step and `graphContext`; <br>• a block with no slug is reported for `word.slug` alone, still waiting; <br>• JSON that holds a `graphContext`, an empty one, is judged as it is, `waiting: false`; <br>• a check that isn't a write's (`judge().check`, as the check form and the derive step use) sets nothing aside; <br>• JSON that fits beagle's schema answers `waiting: false`. <br>**EFS10:** the rule's `{ concept, json }` form gives no finding for the full block, and `checkElements` passes it; the block with no slug gives one finding, for `word.slug` alone. **CS3:** a set made by `graph create-set` reports `word` as `fits: null, waiting: true`, no problems, its `problem` naming the derive step, the set concept as `waiting: false`, and create-set's declared answer requires a boolean `waiting`. **CE6, UN7:** each `concepts` entry of create-element and update-node, the named concept's too, says `waiting: false`, and each declared answer requires a boolean `waiting`. **CE34, UN46:** with firmware `word`'s real schema and beagle's superset under `word`'s, an element create-element makes there, and a node update-node changes there, reports beagle fitting and `word` as `fits: null, waiting: true`, no problems, its `problem` naming the derive step; the write is made, and each answer validates against its declared schema. | `element-schemas.test.js`, `element-fits-schema.test.js`, `test/operations/graph/create-set.test.js`, `create-element.test.js`, `update-node.test.js` | unit; integration (fake) |
| **AC5: the rulebook says what the rule judges** | **EFS6:** rulebook entry 7's Says field names a node's fully realized tapestryJson. The entry says: <br>• exceptions will come; <br>• a node with no tapestryJson gives one finding marked `missing`; <br>• a write's problems only about `graphContext`, which the derive step builds, are set aside as waiting. <br>Its Source names ADR 0020a and ADR 0042 beside ADR 0020, and ADR 0020a's status is Accepted. **EFS7:** rule 7's element file, made from the rulebook, says it judges tapestryJson, and `node src/firmware/graph-rules.js --check` finds it as the rulebook makes it. **EFS1:** the rule's summary says it judges tapestryJson. | `element-fits-schema.test.js` | doc |
| **ADR 0042's statements** | **SC8:** the fake graph runs E1 with the schema node's uuid (`js.uuid AS schemaUuid`), and E4 with only the node's name and uuid. **SC7:** loading `_schemas.js` loads no ajv, LMDB, Neo4j driver or store, and it exports `tapestryJsonOf`. **SC13:** loading `src/lib/derivers/schema-verdicts.js` loads no ajv, `_schemas.js`, `_fields.js` or LMDB. | `element-schemas.test.js` | fake graph; unit |
| **Live** | **L5a's oracle** (`ORACLE_SCHEMAS`) is now the rule's concept set, the class-thread walk at any depth, a ConceptHeader or ListHeader, one row for each schema node, so L5a checks the derive step's new `parentJsonSchemas`. The live check below. | `test/pass-3-finishes-in-minutes.test.js` | live (skipped on the Mac Studio) |

**Amended at implementation (2026-11-17), the Tester's lane.** `test/graph-rules-builder.test.js`'s GB3 holds each real rulebook entry's expected `word.description` (its Says' first sentence) and `source`. Rule 7's fixture still had story 20's: "An element's JSON fits…" and ADR 0020 alone. AC5 rewrites both by design, so GB3 failed on the rulebook this story asks for. The fixture now has the new first sentence and the three ADRs; GB3's assertions are as they were. Test Design missed it because GB3's fixture restates the rulebook rather than reading it.

**Added for review round 1's findings (2026-11-17), the Tester's lane.** Each fails without its fix:
- **SC14** (non-blocking 1): a judge whose first schema read fails, as a transient database error would, reads that schema again on the next check, rather than keeping the failure for the rest of a derive pass.
- **SC12's case "a set entry with an old artifact"** (non-blocking 4): a set whose entry still carries `x-tapestry.derived`, under a schema closed at the top. The set deriver must judge what it stores, without the artifact, so the cache and the rule agree.
- **EFS8's `derivedAt`** (non-blocking 5): the check form's finding on diffMisses gives its entry's `graphContext.derivedAt`, and wordNoContext's, with no `graphContext`, gives none (ADR 0020a Decision 5).
- **CS3, CE6 and UN7** (non-blocking 3) validate each answer's `concepts` against the operation's declared result schema with the repo's ajv, which honours `nullable`. They pass already, as guards.

**Added for review round 2's findings (2026-11-17), the Tester's lane:**
- **EFS11** (non-blocking 1), the edge of EFS8's `derivedAt`: an entry whose `graphContext.derivedAt` is 1e13 seconds, past the last time a Date can hold. Today's check throws "Invalid time value" for it, whether or not the node fits, so one odd entry would stop a whole `rules check`. It fails without its fix: `case wordFar failed: {"error":"Invalid time value"}`.
- **CE34 and UN46** (non-blocking 4) close the gap this plan's AC4 row left: ADR 0042's Testing asks for "an element created in a set under `word`'s thread", and until now no create-element or update-node case reached `waiting: true`. They pass at HEAD, since they pin round 1's code. Over the source from before this story (`9db5ade4`), each fails as the story says today's instance does: `word` is `fits: false`, for "`graphContext` is required".
- **The live check's item "saying it fits `word`"** (How to run, below) was narrowed by the owner's ruling at review round 2 (the story's Open questions). An installed `word` schema fails the set for install's wordType conditionals, so the check asks that nothing `word` finds in the set is about `graphContext`.

## Edge cases

- [x] **An entry built before the node's json tag changed** (SC9). Both readers judge the entry the store keeps, so they agree on it, stale or not. Keeping the entry up to date is A10.20.c's.
- [x] **A schema that doesn't compile** (SC9), **two schema nodes** (SC12) and **no schema node** (SC12). The first two are `valid: null` in the cache and `no-schema` from the rule. A concept with no schema node has no cache entry, since the list is of schemas (ADR 0042 Decision 5).
- [x] **A concept only a `z` tag names** (SC9). The stub answers today's derive query with it, so today's code lists it, and the new code doesn't ask.
- [x] **A write's JSON that holds a `graphContext`** (SC11, heldContext): nothing set aside, judged as it is.
- [x] **The check form sets nothing aside** (SC11 strict, EFS8 wordNoContext): an entry with no `graphContext` fails `word`'s schema, as ADR 0020a Decision 2 has a reader report an incomplete one.
- [x] **tapestryJson that isn't an object** (SC10 odd, EFS3 broken): a problem, but not marked missing.
- [x] **Every finding of a built node isn't missing** (SC9).
- [x] **A test of absence paired with the path running:**
  - EFS9 asserts the one finding the path gives, not only that per-concept findings are absent;
  - SC9's `z` case asserts the case's other concept is judged;
  - SC13's load check pairs with the file existing.
- [x] **Concept Graph API unavailable:** every suite is stack-free.

## Test infrastructure

- **Test framework:** the repo's own suites, `test/helpers/graphOpsSuite.js`'s `makeSuite`, run by `test/operations.test.js` in the gate (`node test/test.js`, read with `npm run gate:status`). No new suite file, so no registration changes.
- **Concept Graph API:** not used. The local stack on the Mac Studio is the agent-memory instance, so only the suites this story touches ran there, one at a time, and the pull request's CI runs the full gate.
- **Firmware state:** none for the stack-free suites. The live check needs a firmware reinstall after rule 7's element file is regenerated.
- **Fixtures:**
  - `test/helpers/createElementGraph.js`'s seed, with the children's own additions: `wordy` with firmware `word`'s schema; diffFits, diffMisses, farMisses and noEntry; wordFull, wordNoContext and wordFar;
  - `test/helpers/createSetGraph.js`'s seed, whose `word` has firmware's schema;
  - the derive child's one-node graph, case by case.

## How to run

One suite at a time, from the checkout (stack-free):

```
node -e "require('./test/operations/graph/element-schemas.test.js').run()"
node -e "require('./test/operations/rules/element-fits-schema.test.js').run()"
node -e "require('./test/operations/graph/create-set.test.js').run()"
node -e "require('./test/operations/graph/create-element.test.js').run()"
node -e "require('./test/operations/graph/update-node.test.js').run()"
```

The full gate (`npm test`) runs in the pull request's CI, never on the Mac Studio's agent-memory instance.

**Live check, on a scratch stack** (`scripts/scratch-stack.sh`), never the agent-memory instance:
- `graph create-set` reports `word` as waiting;
- `POST /api/tapestry-key/derive/:key` gives the set `parentJsonSchemas` in which nothing `word` finds is about `graphContext` (narrowed from "saying it fits `word`" by the owner's ruling, above), and the rule's check agrees for each concept;
- a node with no entry gives one `missing` finding;
- after a firmware reinstall, rule 7's element in the graph carries §7's new words;
- L5a passes on the small graph, and L3 and L4 still meet their limits;
- the relay's event count is unchanged.

## Verification

The new and changed tests fail with the current code, each for the reason the story names, and every other test in the five suites passes. Confirmed on 2026-11-17 on `A10.20.b-judge-tapestryjson` at `a5204027` (staging after #129), with this commit's test changes:

```
operations: _schemas.js, the check of an element against its schema: 7 passed, 6 failed
  FAIL SC7   it exports tapestryJsonOf (ADR 0042 Decision 1); got [MAX_LISTED, TOP, checkElements, fits, judge, listProblems, problemOf, problemsOf, schemaOf]
  FAIL SC10  tapestryJsonOf(rover) answers, never throws; got {"threw":"X.tapestryJsonOf is not a function"}
  FAIL SC11  a word block with its slug and wordTypes, and no graphContext: not failing but waiting; got {"fits":false,"problems":[{"path":"the element's JSON","message":"`graphContext` is required"}],"problem":null}
  FAIL SC9   beagle misses: the cache's errors are the rule's problems, in its words; got ["/beagle must have required property 'description'"] beside ["`beagle.description` is required"]
  FAIL SC12  a concept with two schema nodes: one entry for each, not checkable; got [{... "tapestryKey":"sk1", "valid":true ...}, {... "tapestryKey":"sk2", "valid":true ...}]
  FAIL SC13  one pass reads ck's schema once, not once a node (ADR 0042 Decision 6); got {}
operations: rule element-fits-schema: 3 passed, 7 failed
  FAIL EFS1  its summary says it judges a node's tapestryJson; got "An element's JSON fits the JSON schema of each concept it belongs to (BIBLE §10, rule 4)"
  FAIL EFS3  broken's tapestryJson is a list: one finding saying it isn't an object; got "…its json tag isn't JSON that parses, so its JSON can't be read."
  FAIL EFS6  its Says field: a node's fully realized tapestryJson fits…; got "- **Says:** an element's JSON fits the JSON schema of each concept it belongs to. …"
  FAIL EFS7  its graphRule section, made from the rulebook, says the rule judges tapestryJson
  FAIL EFS8  diffFits: its json tag lacks the description, its tapestryJson has it: it fits; got invalid-fields, "`beagle.description` is required"
  FAIL EFS9  one finding for the node, not one for each concept; got {"violations":[]}
  FAIL EFS10 a word block with its slug and wordTypes, and no graphContext: no finding; got invalid-fields, "`graphContext` is required"
operations: graph create-set: 34 passed, 1 failed
  FAIL CS3   it fits the set concept's schema, and waits for nothing; got {"key":"set","fits":true,"problems":[],"problem":null}
operations: graph create-element: 32 passed, 1 failed
  FAIL CE6   each entry, dog's and pet's, says it waits for nothing; got entries with no waiting
operations: graph update-node: 40 passed, 1 failed
  FAIL UN7   each entry says it waits for nothing; got entries with no waiting
```

SC8 passes already: the fake graph runs ADR 0042's E1 and E4 as written. EFS2, EFS4 and EFS5 pass, since their behaviour doesn't change. L5a is live, and skipped on the Mac Studio.
