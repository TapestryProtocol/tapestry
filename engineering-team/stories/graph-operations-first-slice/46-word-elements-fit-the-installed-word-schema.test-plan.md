# Test Plan: Story 46 — An element of `word` fits the `word` schema an install leaves

**Story:** `engineering-team/stories/graph-operations-first-slice/46-word-elements-fit-the-installed-word-schema.md`
**ADR:** none. Architecture was skipped as obvious, the owner's choice when approving the story (2026-11-20).
**Date:** 2026-11-20

## Coverage map

All in `test/word-elements-fit-the-installed-word-schema.test.js`, stack-free.
- **What runs.** The install's own code runs in a child process (`test/helpers/saveSchemaChild.js`) over a fake graph (`test/helpers/pathCypherFake.js`), with firmware's real manifest and schema files. That covers its enumeration step (`POST /api/normalize/apply-enumerations`) and, for W4, Pass 2.
- **What the test reads.** What the step left in a schema is read from the json it wrote there.
- **How nodes are judged.** Over the same fake graph, with the one check the rule `element-fits-schema`, the writes and the derive step share (`src/operations/catalog/graph/_schemas.js`).

| Criterion | Test name | Level |
|---|---|---|
| AC1 | W1: after the install's enumeration step, a node whose word types are right fits word's schema once its graphContext is built: `["word","relationshipType"]`, `["word","set"]` with its set fields, `["word","jsonSchema","validationTool"]` | integration (child) |
| AC2 | W2a: the JSON `graph create-set` and `graph create-element` build (their own builders, `setJson` and `elementJson`, as the owner's run made a set and "class thread validation") reports word as waiting for the derive step, with no problems, through `fits`, the check each write makes for each concept it reaches | integration (child) |
| AC2 | W2b: once the derive step has built those nodes' tapestryJson, its cached verdict for word (`schemaVerdicts`, the derive step's own) is valid, with no errors | integration (child) |
| AC3 | W3a (sentinel): a node whose word types hold a key the install doesn't know still fails, naming `word.wordTypes.1`: the allowed list stays | integration (child) |
| AC3 | W3b (sentinel): a set whose graphContext lacks the set fields still fails, naming each: the set conditional stays | integration (child) |
| AC3 | W3c (sentinel): dog's pair still holds both ways after the enumeration step. A golden retriever listing goldenRetriever fits. One without it in its word types fails, and so does one listing goldenRetriever whose breed is irishSetter. | integration (child) |
| AC4 | W4: a reinstall (Pass 2, then the enumeration step) over word's schema as an affected instance holds it leaves no conditional comparing wordTypes with itself. The allowed list and the set conditional stay, and a relationship type and a set made before fit word. The fixture is first shown to reproduce the fault. | integration (two children) |
| AC5 | W5a: ledger row `2026-11-17-word-wordtypes-conditionals-contradict-themselves` has `**Status:** DONE` and a `**Done:**` line | unit (file) |
| AC5 | W5b (sentinel): the manifest's switch, which the Firmware Explorer page shows, is on for an enumeration exactly when the enumeration step writes it a pair (word, dog) | integration (child) |
| AC5 | BIBLE §6's account of install's enumerations says what install puts in `word`'s schema | Review (prose) |

The sentinels pass today and must still pass after the fix. They guard against a fix that loosens more than the pair: dropping the enumeration, the set conditional, or dog's pair.

## Edge cases

- [x] **A fixture that doesn't hold the fault would prove nothing.** W4 first checks that, before the reinstall, the older relationship type fails word for the self-comparing pair.
- [x] **Pass 2 must not hide the result.** W4 asserts Pass 2 logs no errors and saves word's schema before the enumeration step runs.
- [ ] **Running the enumeration step alone over a schema that already holds the pairs.** This step is `POST /api/normalize/apply-enumerations` without a reinstall. If the fix only turns the switch off, the old pairs stay until a reinstall's Pass 2 rewrites the schema from firmware's file, since the step strips old pairs only while the switch is on. AC4 asks for a reinstall, so no test pins this case. The Reviewer checks that the story's evidence and the ledger row say a reinstall is what clears an instance.
- [ ] **A fix that leaves the pair out in code but keeps the switch on.** W5b fails it: the Firmware Explorer page would still say "Yes — biconditional if/then blocks" for `word.wordTypes`. So the switch goes off, with or without a guard in the code.
- [ ] **`graph.graphType`'s pair** is out of scope and unchanged. No test reads it; the diff must not touch it.
- [x] **The derive step's real `graphContext`.** The tests use a `graphContext` in the schema's own shape. Story 42's live check found nothing `word` reported about the `graphContext` the derive step built, apart from the pairs and the set fields of the Properties Set nodes, which the derive step builds as words (its LC2 and LC7c; Loom P-157).

## Test infrastructure

- **Test framework:** Node's built-in runner pattern this repo uses: a suite with `run()`, registered in `test/registry.js`. A run's result is read per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
- **Concept Graph API:** not used. The suite is stack-free, so no suite was skipped for want of a stack.
- **Firmware state:** firmware's own files, `firmware/active` (v1.0.0): the manifest's `concept-headers` and `dog-breeds` enumerations, and the `word` and `dog` schemas.
- **Fixtures:** built in the suite.
  - `word` and `dog` concepts of the instance's own: a header and a JSON schema node.
  - Word's class thread.
  - The two enumerations as install wires them: a superset whose elements hold their keys at the manifest's source path, ENUMERATES the target schema at both paths.
  - For W4, word's schema as an affected instance holds it: firmware's file, the allowed list, and a Forward and a Reverse for each key.
- **Nothing reaches a real service.** The child gets a conf whose Neo4j is a closed port, and every other endpoint closed too, as in `test/schema-save-finds-the-right-header.test.js`. The parent sets nothing in `process.env`: the gate loads every suite into one process before running any (`test/helpers/gateRunner.js`), so a value set there would reach every other suite. It needs none, since every read it makes is given, over the fake graph. Never run the full `npm test` on the owner's Mac: the container `tapestry` there is the agent-memory instance.

## How to run

```
node test/word-elements-fit-the-installed-word-schema.test.js
```

On the owner's Mac, put a folder holding a stub `curl` (exit 7) and `docker` (exit 1) first on `PATH`, and set `TAPESTRY_CONTAINER=no-such-container`. The suite itself reaches neither; the stubs guard the gate's other parts.

**Live check, after implementation.** Run it on a scratch stack, never the shared local instance. A firmware reinstall with the fix leaves `word`'s installed schema with the set conditional and the allowed list, and no conditional comparing `wordTypes` with itself. Then `graph create-element` of a relationship type answers `word` as waiting with no problems, and after `POST /api/tapestry-key/derive/:key` its `parentJsonSchemas` say it fits `word`. The story's "done" is the fix proven on a scratch stack and merged to staging.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-20, on the tree of `dd86293e` with this commit's test files, Node v24.18.0:

```
=== an element of word fits the word schema an install leaves (graph-operations-first-slice #46) ===
  FAIL  W1 (AC1): after the install's enumeration step, a node whose word types are right fits word's schema once its graphContext is built
        ["word","relationshipType"] must fit word's installed schema; the check found: [word.wordTypes] `word.wordTypes` must be equal to constant | [the element's JSON] the element's JSON must match "then" schema | [word.wordTypes] `word.wordTypes` must be equal to constant | [the element's JSON] the element's JSON must match "then" schema
  FAIL  W2a (AC2): the JSON graph create-set and graph create-element build reports word as waiting for the derive step, with no problems
        graph create-set's set (wordTypes ["word","set"]) must report word with fits null, waiting true and no problems; it reported fits false, waiting true: [word.wordTypes] `word.wordTypes` must be equal to constant | [the element's JSON] the element's JSON must match "then" schema | [word.wordTypes] `word.wordTypes` must be equal to constant | [the element's JSON] the element's JSON must match "then" schema
  FAIL  W2b (AC2): once the derive step has built those nodes' tapestryJson, its cached verdict for word is valid, with no errors
        the derive step's verdict for word on the set must be valid with no errors; it is valid false, errors ["`word.wordTypes` must be equal to constant","the element's JSON must match \"then\" schema","`word.wordTypes` must be equal to constant","the element's JSON must match \"then\" schema"]
  PASS  W3a (AC3, sentinel): a node whose word types hold a key the install doesn't know still fails, naming that entry of word.wordTypes
  PASS  W3b (AC3, sentinel): a set whose graphContext lacks the set fields still fails word's schema
  PASS  W3c (AC3, sentinel): dog's pair still holds both ways after the enumeration step
  FAIL  W4 (AC4): a reinstall over word's schema as an affected instance holds it leaves no pair comparing wordTypes with itself; the set conditional and the allowed list stay, and older nodes fit
        after the reinstall, no conditional in word's schema may compare wordTypes with itself; 20 do, among them [{"$comment":"Forward: if word.wordTypes is conceptHeader, wordTypes must contain it", …
  FAIL  W5a (AC5): the ledger row 2026-11-17-word-wordtypes-conditionals-contradict-themselves is closed
        the ledger row's Status must be DONE; it is OPEN
  PASS  W5b (AC5, sentinel): the manifest's switch, which the Firmware Explorer page shows, is on for an enumeration exactly when the enumeration step writes it a pair

word-elements-fit-the-installed-word-schema: 4 passed, 5 failed, 0 skipped
```

Each failure is the defect itself, not a load or fixture error: W1, W2a and W2b on the self-comparing pair's problems; W4 on the 20 conditionals the reinstall writes again, a pair for each of the fixture's ten keys; W5a on the ledger row still open.

**The tests can be met.** As a check of the tests alone, the manifest's switch for `concept-headers` was turned off by hand, the suite run, and the manifest restored with `git checkout`. Eight passed; W5a still failed, as the ledger row was still open.

## Amendment after review round 1

Review round 1 (blocking 1) found that the suite set the dead endpoints on `process.env` when it loaded, so in a full run they reached every suite. Its fix, in the Tester's lane and a commit of its own: the dead values go to the child alone, in its spawn environment, and the parent sets nothing. Loading the suite and running it now leave `TAPESTRY_CONTAINER`, `BRAINSTORM_BASE_URL`, `TAPESTRY_API_BASE`, `TAPESTRY_PORT`, `MEILI_URL_HOST`, `NEO4J_URI` and `BRAINSTORM_CONF_PATH` as they were (checked 2026-11-20 by snapshotting them around `require` and `run()`), and the suite still passes 9 of 9. What each test checks didn't change.
