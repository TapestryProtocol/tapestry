# Test Plan: Story 21 — `graph update-node`

**Story:** `engineering-team/stories/graph-operations-first-slice/21-update-node.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0021-update-node.md` (with Amendment 1, at test design)
**Date:** 2026-11-16

Every suite is stack-free:

- It runs the real catalog in a child process (`test/helpers/operationsHarness.js`), over the fake graph (`test/helpers/graphFake.js`).
- Every service endpoint is dead.
- The harness's spy watches everything that signs or reads a key.

The stack-free suites can't reach five things: Neo4j's own locking, a firmware reinstall, a restore, nginx, and the relay. The live check covers those on a scratch stack (below).

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1: change an element's fields | **UN1**: a field merged into the section; the rest of the node as it was (labels, address, author, time, no id, memberships, `d` and `z` tags); the answer's `node` (the read conventions' five facts, `slug`, `hasLetter`), `changed`, `concepts`; the entry's `field-changed` with `was` and `now`; the note. **UN2**: new fields at the end, an object replaced whole, a `null` taking a field out, JSON text read, a field called `__proto__` kept as an own field. **UN3**: `description` is the section's field, trimmed; given both ways alike, one change; `""` is a value. **UN7**: `concept` names the section of a node of two concepts. **UN9**: an own element of a firmware concept, and an element of a strict schema, change. **UN12**: `graph history` by the node and by the concept. **UN4/UN7/UN9**: the same call again is `unchanged`, recording nothing. | `test/operations/graph/update-node.test.js` | integration (fake) |
| AC2: rename | **UN4**: the node's name and tapestryValue, its name tag, its section's name and slug, its word block's name, title and slug follow; the address, `d` tag and key stay; create-element with the old name answers it; the same rename again is unchanged. **UN6**: a word block that holds the name itself follows. **UN8**: a hand-edited section name stays while the slug follows, and a node with no name tag gains one at the end, with the import's uuid. | `update-node.test.js` | integration (fake) |
| AC3: rule 4 on the sections it changes | **UN20**: `invalid-fields` from `element-fits-schema`: the wrong type, a value not allowed, a field the schema doesn't take, a required field taken out. **UN21**: a rename that breaks two concepts' sections names every problem of both. **UN22**: `no-schema`. **UN7**: the other concept's verdict is reported, not refused. **SN6**: `checkElements` with `every` throws one refusal naming each finding, and without it the first only. | `update-node.test.js`, `test/operations/graph/update-node-shared.test.js` | integration (fake); unit |
| AC4: a rename onto a name in use | **UN31**: `name-in-use`, naming the element that has the name: by name, by case, by the address the name gives, the owner's element, and an element of the other concept the node belongs to. **UN5**: a case-only rename, and another author's element of the name, are no clash. **UN13**: each update locks the node first, then each judged concept's header. **L2**: two at once (live). **SN7**: E3 with `$authors`. | `update-node.test.js`, `update-node-shared.test.js`; live | integration (fake); live |
| AC5: never someone else's node | **UN23**: `not-own-node` for another author's letter, an admin's letter, and a stranger's node with no letter, naming the input, the author, the address and copy-node (A10.24). **UN6**: the assistant's letter and the owner's letter change, with `letterOutOfDate`. **UN5**: a node made here with no author is the instance's own. **SN1–SN4**: the one shared test, `whoseNode`/`requireOwn`/`NOT_OWN_NODE`, which merge-nodes and delete-node will call, with the input they name. **SN2**: its `own` is the read conventions' `own`, node for node. | `update-node.test.js`, `update-node-shared.test.js` | integration (fake); unit |
| AC6: what else it refuses | **UN24**: `made-elsewhere` for a concept header, a superset, a primary property, a JSON schema, a property, a set and a graph rule, by its concepts or by its role labels alone (Amendment 1). **UN25**: `firmware-node`, naming the file. **SN5**: every firmware element file's address, as install gives it. **UN26**: `not-an-element`. **UN27**: `unknown-node`. **UN28**: `unknown-concept`, `reserved-key`, `not-its-concept`. **UN29**: `concept-needed` and `no-section`. **UN30**: `unreadable-json`, five ways. **UN32**: `bad-name`, six ways. **UN33**: `bad-fields`, nine ways, and a list in a JSON body. **UN34**: `nothing-to-change`. **UN35**: the built-in input refusals. **UN37**: the refusal run changes nothing and records nothing. **UN38**: `not-installed`. **UN39**: a write whose entry fails keeps nothing. | `update-node.test.js`, `update-node-shared.test.js` | integration (fake); unit |
| AC7: marked fields follow | **UN40**, over `fieldGraph.js`'s dog with its marks: a changed breed follows onto `dog_breed`, with its `copies-set` change and `copies`; the owner, an object, is skipped; the breed taken out takes `dog_breed` with it, with its `copies-removed` change. | `update-node.test.js` | integration (fake) |
| AC8: it lasts, and it reaches agents | **UN36**: 401, 403, 415, and the command's refusal is the route's. **UN10**: nothing signed, an admin's change the admin's, the command's change the command's. **UN11**: listed with guard, `repeatKey`, inputs and every refusal, and `/docs`. **UN14**: the change fields. **UN15**: the catalog's §2 row. **UN41**: no new or changed module requires a signer. **XU1**: an admin agent through the external CLI, with no change to it. **L3–L7**: reinstall, restore, nginx, relay (live). | `update-node.test.js`, `test/operations/graph/update-node-agent-through-cli.test.js`; live | integration (fake); live |

## Edge cases

- [x] **The lock's order** (Decision 5). UN13 runs two calls that change nothing, so their only writes are locks. Each transaction starts with the node's lock, set then removed, before any read. It holds one lock pair more per judged concept: three pairs for walkerMax (dog and pet), two for lucky (beagle). *(Review round 1, non-blocking 6: so UN13 pins the node's lock first, and the count, but not the order of the concepts' locks among themselves. The fake logs no statement's parameters, so no suite can see their keys: ledger row `2026-11-17-fake-graph-logs-no-lock-order`.)*
- [x] **`word` aside** (Decision 4). walkerMax's two concepts are dog and pet. An element of the seventeen concepts under word would add `word` to its concepts; the live check's element of firmware's relationship type meets that.
- [x] **Read-modify-write** (Decision 8). UN8 restates a section's own slug, which isn't the slug its name gives. UN33 refuses one that is neither.
- [x] **`__proto__`.** UN2: a field called `__proto__`, given as JSON text, stays an own field of the section, and no object gains its value (Decision 8).
- [x] **Invisible characters.** UN32's control, text-direction and zero-width names are made with `String.fromCodePoint`, so no test file holds one raw.
- [x] **A section the node lacks.** UN29 is the add-to-concept boundary (story 20's Out of scope).
- [x] **Firmware's own node.** UN25 and SN5 pin the address install gives each element file. An own element of a firmware concept, which firmware's files don't define, changes (UN9).
- [x] **Concurrent calls:** L2, live; the fake runs one transaction at a time.
- [x] **Concept Graph API unavailable:** every suite is stack-free; the live check runs on a scratch stack.

## Test infrastructure

- **Runner:** each suite exports `run`, and `test/operations.test.js` finds and runs every suite under `test/operations/` (T1). One suite runs alone with `node test/operations/graph/<suite>.test.js`.
- **Seed:** `test/helpers/updateNodeGraph.js` (new). It starts from create-element's `test/helpers/createElementGraph.js`, which it doesn't change, and adds the nodes these suites name; its header says what each is for:
  - the owner's, an admin's and a stranger's elements, and one with no author;
  - firmware's own rover, at the address install gives it;
  - a property, a graph rule and a word-only node;
  - walkerMax, Whiskers, a set two concepts share, and Two Face in it;
  - elements whose sections test the merge and the rename;
  - five elements whose JSON can't be read, and one of scroll.
- **Main run:** create-element makes Snoopy, Mentors and Widget Four first, so update-node changes nodes in that write's own shape. A probe before any code ran confirmed that step answers 200 three times, and that the route answers 404 today.
- **Shared pieces:** `update-node-shared.test.js` runs each test in a child process with `graphOpsSuite.js`'s environment, over the seed, through `graphFake.js`'s `readerOver`.
- **The fake:** unchanged. It already runs U0 (`_sets.js`'s R1), U1 and E3 with `$authors`, and SN7 holds it to them.
- **Firmware:** the repo's active firmware (`firmware/active` → `versions/v1.0.0`), read by SN5 and the seed's rover.
- **Not run here:** the full `npm test`, which on this Mac writes to the agent-memory instance. The PR's CI runs the full gate.

## How to run

```
node test/operations/graph/update-node.test.js
```

```
node test/operations/graph/update-node-shared.test.js
```

```
node test/operations/graph/update-node-agent-through-cli.test.js
```

For a `gate:status` line, run the three through the gate engine with every endpoint on a dead port:
- the variables `NEO4J_URI=bolt://127.0.0.1:9`, `REDIS_PORT=9`, and `BRAINSTORM_BASE_URL`, `TAPESTRY_BASE` and `MEILI_URL_HOST` at `http://127.0.0.1:9`;
- `require('./test/helpers/gateRunner').runGate({ suites: [...].map((file) => ({ file })), label: 'update-node' })`, then `npm run gate:status -- --label update-node`.

create-element's suites (`create-element.test.js`, `element-schemas.test.js`, `elements-agent-through-cli.test.js`) run beside them, since `findRepeat` now calls `repeatsOf` and `checkElements` gains an option.

## The live check (at Implementation, on `scripts/scratch-stack.sh`, never the agent-memory instance)

Check `docker ps` and the shared notes before taking `tapestry-scratch`, note it there, and take it down afterwards.

- **L1:** an element made with create-element, then changed, renamed and changed again with the same call, through the route.
- **L2:** two renames of two elements of one concept onto one name, sent at once: one is refused `name-in-use`, the other lands. And a rename and a create-element of one name at once: one element of that name.
- **L3:** a firmware reinstall: each changed node keeps its tags, JSON, properties and memberships. Firmware's dog rover is refused `firmware-node`, and `firmwareElements()` holds every firmware element node's address on the fresh instance.
- **L4:** a backup restored on a fresh stack: the changes come back.
- **L5:** a refusal of another author's node: a node lettered by a throwaway key, made with Cypher on the scratch stack.
- **L6:** an admin agent through nginx and the external CLI: XU1's steps, live.
- **L7:** the relay's event count, unchanged.
- **L8:** a marked field followed, and an element of firmware's relationship type, an element of word too, changed without word judged.

## Verification

The new tests fail with the current code, and for the right reason: what they test isn't written yet. The one test that passes, SN7, holds the fake to the ADR's new statements, which it already runs. Confirmed 2026-11-16 on the code at `38504a94` (the story, ADR and Amendment 1 commits on `A10.21-update-node`, rebased on staging after #109), with this commit's tests:

```
operations: graph update-node: 0 passed, 37 failed, 0 skipped
        src/operations/catalog/graph/update-node.js does not exist yet (ADR graph-operations-first-slice/0021 Decision 1)
operations: what graph update-node shares: 1 passed, 6 failed, 0 skipped
        _nodes.js whoseNode doesn't exist yet (ADR graph-operations-first-slice/0021 Implementation notes)
        _nodes.js requireOwn doesn't exist yet
        _nodes.js NOT_OWN_NODE doesn't exist yet
        _elements.js firmwareElements and firmwareElementOf doesn't exist yet
        SN6: its message names each concept's problems, pet's and gadget's; got "… `pet.description` is required."
        PASS  SN7: the fake graph runs U0, U1 and E3 with $authors as the ADR writes them
operations: an admin agent changes elements through the external CLI: 0 passed, 1 failed, 0 skipped
        src/operations/catalog/graph/update-node.js does not exist yet (ADR graph-operations-first-slice/0021 Decision 1):
        the external CLI exited 2: 'graph update-node' isn't among the operations npub1… may call
```

The harness and the seed work before the code exists. A harness run over the seed answers create-element's three makes with 200, and update-node's route with today's 404.

## Added at review round 1 (2026-11-17)

The review passed with seven non-blocking findings, and the owner chose to fix them before the PR. Three got a test each, in `update-node.test.js`'s round-2 run (ADR Amendment 2):

| Finding | Test | What it pins |
|---|---|---|
| 1 | **UN42** | A concept keyed `__proto__`, whose section the node lacks, is refused `no-section`, naming `concept`. The node's JSON is unchanged, and no entry names it. |
| 2 | **UN43** | `description` and `fields.description`, the same once trimmed, are one change: `updated`, `changed` is `["fields.description"]`, and the field holds the trimmed text. |
| 3 | **UN44** | `no-section` reached through `description` alone names `description`. |

They failed on the code at `6b6429be`, and for the right reasons, and pass with the fixes at `53bac579`:

```
  FAIL  UN42: a concept keyed __proto__ whose section the node lacks is refused no-section; nothing is recorded or changed
        the section is read by the JSON's own key, so an inherited __proto__ is no section (…); got 200 {"success":true,"data":{"outcome":"updated",…
  FAIL  UN43: the same description given both ways, with white space around it, is one change, trimmed
        description and fields.description, alike once trimmed, are one change (…); got 400 {"success":false,"error":"description is \"same, with spaces\", but fields gives the description …","code":"bad-fi…
  FAIL  UN44: no-section reached through description alone names the input description
        with no fields and no concept given, the refusal names description, the input given (…); got 409 {"success":false,"error":"\"Whiskers\" (39999:…:whiskers-443da4f8)'s JSON has no pet section, …
operations: graph update-node: 37 passed, 3 failed, 0 skipped
```

Findings 4 and 6 are ledger rows, `2026-11-17-own-test-reads-pubkey-as-author` and `2026-11-17-fake-graph-logs-no-lock-order`; 5 and 7 were doc fixes.

## Added at review round 2 (2026-11-17)

Round 2 passed, with four non-blocking findings. One was a test gap (R2-3): Amendment 2.2 says `fields.description` given alone is kept as given, and no test pinned it.

| Finding | Test | What it pins |
|---|---|---|
| R2-3 | **UN45** | `fields: {"description": " kept as given "}` alone, on oddSlug, is `updated` with `changed: ["fields.description"]`, and the section holds the text as given, white space and all. |

UN45 pins behaviour the code already had, so it passes on both `53bac579` and the code after it. It has teeth: with every text field in `fields` trimmed (a scratch mutation, undone), update-node gave 40 passed and 1 failed, UN45 alone:

```
  FAIL  UN45: fields.description given alone is a field like any other, kept as given, white space and all
        only the description input is trimmed: fields are kept as given (Amendment 2.2; review round 2, R2-3); got "kept as given"
operations: graph update-node: 40 passed, 1 failed, 0 skipped
```
