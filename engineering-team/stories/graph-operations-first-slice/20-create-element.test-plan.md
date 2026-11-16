# Test Plan: Story 20 — `graph create-element`

**Story:** `engineering-team/stories/graph-operations-first-slice/20-create-element.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0020-create-element.md`
**Date:** 2026-11-16

Every suite is stack-free:

- It runs the real catalog in a child process (`test/helpers/operationsHarness.js`), over the fake graph (`test/helpers/graphFake.js`).
- Every service endpoint is dead.
- The harness's spy watches everything that signs or reads a key.

The stack-free suites can't reach six things: Neo4j's own locking, a firmware reinstall, the derive step's cached verdict, a restore, nginx, and the relay. The live check covers those on a scratch stack (below).

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1: make an element of a concept | **CE1** one keyed node under the superset, no `NostrEvent`, its name its tapestryValue, the answer's key, address, concept and parents, its `element-created` entry, the backup note. **CE2** today's address (`dtag.childDTag`), the tags `d`, `name`, `z` and `json` in order with the import's tag uuids, and word-wrapper JSON with its keys in Decision 8's order. **CE3** `graph history` by the element, the concept and the set; `graph list-elements` lists it. **CE4** a name trimmed and collapsed; the section holds name, slug, then the fields as given; JSON text works. **CE13** nothing signed. | `test/operations/graph/create-element.test.js` | integration (fake) |
| AC2: in a set | **CE5** Buddy directly in the golden retrievers' superset, which is in dog's class thread: its `n` tag names it; `wordTypes` and the answer list dog, then golden retriever. **CE6** Max, in walkers, is of dog and pet; Ribbon is in a set only beagle reaches; a `set` that is the concept's own superset is the same as none. | `create-element.test.js` | integration (fake) |
| AC3: rule 4 | **CE20** `invalid-fields` from `element-fits-schema`, each problem in words: required, the wrong type, a value not allowed (with the values), a field the schema doesn't take, and dog's breed tied to `wordTypes`. **CE21** twenty problems named, then how many more. **CE22** `no-schema`, saying why. **CE4** no value made up. **CE5/CE6** the other concepts reported (`fits: false` with the problems), never refused. **SC1–SC6** the shared check. **SC5** its verdict is the derive step's. | `create-element.test.js`, `test/operations/graph/element-schemas.test.js` | integration (fake); unit |
| AC4: safe to repeat | **CE7** `already-exists`, `change: null`, nothing written. `differs` names the name's case, a set it isn't in, and each field given that differs; a repeat checks no fields. **CE8** found anywhere in the class thread, by name or by the address the name gives, with or without a nonce; the plain address wins, then the lowest key; today's lettered rover counts. **CE9** another author's element is no repeat. **CE10** a held address takes the next nonce. **CE12** each transaction takes the lock before any read. **L2** two calls at once. | `create-element.test.js`; live | integration (fake); live |
| AC5: what it refuses | **CE23** `unknown-concept` (a random key, an element's key) and `no-superset`. **CE24** `unknown-node`, `not-a-set` (an element; a header names its superset), `not-in-class-thread` (naming dog and its superset) and `no-free-address`. **CE25** `bad-name`, six ways. **CE26** `bad-fields`: text that isn't JSON, a list, null, another name or slug, JSON over 1,000,000 characters; a list in a JSON body. **CE27** `made-elsewhere` for the eleven concepts of Decision 4, naming the operation to use. **CE11** another author's concept, another author's concept named `set`, firmware's relationship type and `graph` each take one. **CE30** the refusal run changes nothing and records nothing. **CE31** `not-installed`. | `create-element.test.js` | integration (fake) |
| AC6: marked fields | **CE40** over `fieldGraph.js`'s dog: the copies `dog_breed` and `dog_age` in the same write, their `copies-set` changes in the entry, and `skipped` for the owner (an object) and for pet (no pet section). | `create-element.test.js` | integration (fake) |
| AC7: rule 4, defined once | **EFS1** loaded with its two refusals. **EFS2** `{ concept, json }`. **EFS3** `{ node }` and `{ node, concept }`. **EFS4** a schema read once per concept per call. **EFS5** `checkElements` throws the first finding with `rule`. **EFS6** the rulebook's entry 7, in its format. **EFS7** its firmware element file, `--check` clean. **CE14** the guard listed. **CE15** the change fields' descriptions. **CE16** the catalog's §2 row. `graph-rule-firmware`, `graph-rules-builder` and `firmware-element-sync` know rule 7. | `test/operations/rules/element-fits-schema.test.js`, `create-element.test.js`, and the three A10.41 tests | unit; integration (fake) |
| AC8: it lasts, and it reaches agents | **CE29** 401, 403 and 415, and the command's refusal is the route's. **CE13** an admin's create is the admin's, and the command's is the command's. **CE14** listed with guard, `repeatKey`, inputs and every refusal, and `/docs`. **CE41** no new module requires a signer. **XE1** an admin agent through the external CLI, with no change to it. **L3–L7** reinstall, derive, restore, nginx, relay. | `create-element.test.js`, `test/operations/graph/elements-agent-through-cli.test.js`; live | integration (fake); live |

## Edge cases

- [x] **The lock's order.** CE12: in every transaction of the main run, the first two statements are the lock (set, then removed), before any read (Decision 7).
- [x] **The entry can't be written.** CE32: the node and its tags aren't kept (ADR 0004 Decision 3).
- [x] **Inputs.** CE28: a missing input, the wrong type, and an unknown input.
- [x] **A name of 200 characters** is made (CE11); one of 201 is refused (CE25).
- [x] **Two schemas with one `$id`** both check, in one process (CE11, SC4).
- [x] **No stamps.** Beagle's header has a `b` pointer to another author's nostr relay. Today's route would stamp that as a second `z`; CE2 holds the tags to `d`, `name`, one `z` and `json` (Decision 9).
- [x] **The dialect.** SC5 runs eight schema and JSON pairs through both readings, `_schemas.problemsOf` and the derive step's (`src/lib/derivers/word.js:136–180`), and requires one verdict:
  - draft-07's `dependencies`, `definitions` with `$ref`, and `if`/`then` with `contains` count;
  - `prefixItems`, `dependentRequired` and `unevaluatedProperties` are ignored by both.

  A check that reads draft 2020-12 fails it.
- [x] **Reading a schema.** SC1: a schema node whose JSON is the schema itself, and one held in LMDB.
- [x] **Why there is no schema.** SC2: no schema node, two of them, no json tag, JSON that doesn't parse, a missing LMDB entry, and a list.
- [ ] **Two creates at once on Neo4j:** the fake runs one transaction at a time, so this is live check L2.

## Test infrastructure

- **Framework:** Node's own runner, through each suite's `run()`.
  - Every suite under `test/operations/` is found by `test/operations.test.js` (ADR graph-operations-foundation/0001 Decision 12), so `test/registry.js` gains no line.
  - `graph-rule-firmware`, `graph-rules-builder` and `firmware-element-sync` are already registered there.
- **The fake graph needs nothing new.**
  - E1–E4 run on the path fake as the ADR writes them. SC8 holds that, and passes already.
  - Every other statement create-element uses is one the fake already runs: S1, R1–R3, the lock's S8 shape, C4–C7, C8b, and `mapNodes`' reads.
  - Neither `graphFake.js` nor `pathCypherFake.js` changes, so the A10.13 and A10.9 branches' edits to them don't meet this one.
- **Fixtures:**
  - `test/helpers/createElementGraph.js` (new) starts from story 16's `conceptGraph.js` seed. That seed gives the firmware headers, beagle exactly as today's create-concept makes it with rover, another author's nostr relay, and widget headers with no superset. It adds:
    - beagle's set, its near-repeats, a held address, and a hundred crowded ones;
    - dog and golden retriever, with firmware's own header and schema JSON;
    - pet and walkers (a set two concepts reach), and lap pets;
    - schemas that ask more (`gadget`, `survey`), two with one `$id`, and four schemas that can't be used;
    - firmware's relationship type, `graph` given a schema, `graph-rule`, another author's concept named `set`, a loner and a change entry.
  - `test/helpers/fieldGraph.js` (unchanged) gives CE40 its marks. Pet's superset is linked to walkers, so the element joins pet.
  - `FG.seedLmdb` stores SC1's LMDB-held schema.
- **Firmware state:** none. The seeds stand in for it.
- **The concept-graph API at `localhost`:** not used. This Mac's stack is the agent-memory instance, not a test one.
- **The A10.41 tests, brought up to rule 7.** These are this story's to change, since its rule joins the rulebook:
  - `graph-rule-firmware`: `RULES` gains `element-fits-schema`, and its counts follow `RULES.length`.
  - `graph-rules-builder`: `REAL` gains entry 7, and GB2 reads seven entries.
  - `firmware-element-sync`: rule 7's file is an unchanged element in the scenario, and IS8 counts the scenario's rules.
  - **One wording is pinned:** entry 7's Says must open with Decision 12's sentence, "an element's JSON fits the JSON schema of each concept it belongs to." GB3 reads its first sentence as the item's description.

## How to run

Run only the suites this story touches, one at a time, with the service endpoints dead. Never run the full `npm test` on this Mac: about 40 suites write to the local instance, the live agent-memory instance. The full gate is the pull request's CI run.

```
export NEO4J_URI=bolt://127.0.0.1:9 REDIS_HOST=127.0.0.1 REDIS_PORT=9 BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_BASE=http://127.0.0.1:9 MEILI_URL_HOST=http://127.0.0.1:9
node test/operations/graph/create-element.test.js
node test/operations/graph/element-schemas.test.js
node test/operations/rules/element-fits-schema.test.js
node test/operations/graph/elements-agent-through-cli.test.js
node test/graph-rule-firmware.test.js
node test/graph-rules-builder.test.js
node test/firmware-element-sync.test.js
```

At Implementation, re-run as well the suites that read the files it changes:

- `graph/{fields,map-fields,mark-field,unmark-field,fields-agent-through-cli}`, `change-entry-fields`, `write-path` and `rules/field-mark-allowed`, which use `_fields.js` and `changes.js`;
- `graph/create-concept`, for the shared name checks.

## The live check (at Implementation, on `scripts/scratch-stack.sh`, never the agent-memory instance)

Take the scratch stack only when the shared notes say it is free, and write a line there when you take it and when you take it down. The container is always named `tapestry-scratch`.

- **L1. An element under a concept and one in a set, and their repeats.** Read them back through `graph list-elements` and the concept-graph routes, and check `already-exists` with `differs`.
- **L2. Two creates of one name at once** (two `docker exec` calls in parallel) make one element and one entry.
- **L3. A refusal of fields that don't fit**, with every problem named, and nothing written.
- **L4. A firmware reinstall.** For each element, its tags, JSON, node properties and memberships are as before. A redundant direct link from the concept's superset to an element in a set is noted as Decision 10 expects, not as a failure.
- **L5. After the reinstall's derive pass,** each element's cached `parentJsonSchemas` verdict agrees with the `concepts` the create answered.
- **L6. A backup, restored on a fresh scratch stack,** brings each element back with its key.
- **L7. An admin agent with its own key, through nginx and the external CLI:** create, create again, create in a set, and a refusal.
- **L8. The relay** holds as many events after every write as before the first.

The ADR's ledger row (wire-implicit-elements' prune depends on the run) is written at Implementation. L4's result goes into it.

## Verification

The new tests fail with the current code, and for the right reason: what they test isn't written yet. The one test that passes, SC8, holds the fake to the ADR's four new reads, which it already runs. Confirmed 2026-11-16 on the code at `9e979a00` (staging after ADR PR #89, before any implementation), with this commit's tests:

```
operations: graph create-element: 0 passed, 31 failed, 0 skipped
        src/operations/catalog/graph/create-element.js does not exist yet (ADR graph-operations-first-slice/0020 Decision 1)
operations: _schemas.js, the check of an element against its schema: 1 passed, 7 failed, 0 skipped
        src/operations/catalog/graph/_schemas.js does not exist yet (ADR graph-operations-first-slice/0020 Decision 11)
        PASS  SC8: the fake graph runs E1–E4 as the ADR writes them, answering as Neo4j would
operations: rule element-fits-schema: 0 passed, 7 failed, 0 skipped
        src/operations/rules/element-fits-schema.js does not exist yet (ADR graph-operations-first-slice/0020 Decision 12)
        docs/GRAPH_RULES.md has an entry headed "## 7. `element-fits-schema`" (ADR 0020 Decision 12)
operations: an admin agent makes elements through the external CLI: 0 passed, 1 failed, 0 skipped
        src/operations/catalog/graph/create-element.js does not exist yet (ADR graph-operations-first-slice/0020 Decision 1):
        the external CLI exited 2: 'graph create-element' isn't among the operations npub1… may call
graph-rule-firmware: 12 passed, 1 failed, 4 skipped     (GF9: one element per rule; element-fits-schema.json isn't there; live checks skipped)
graph-rules-builder: 21 passed, 5 failed, 0 skipped     (GB2–GB6: the rulebook has no entry 7 yet)
firmware-element-sync: 20 passed, 1 failed, 0 skipped   (IS8: all 7 elements were looked up; got 6)
```

The harness and the seed work before the code exists:

- A harness run over the seed answers the route with today's 404, and the command with "Unknown operation 'graph create-element'".
- The 1 MB body of CE26's length refusal passes the harness's body parser.
- The rule suite's child process runs, and reports the rule as not loaded.
