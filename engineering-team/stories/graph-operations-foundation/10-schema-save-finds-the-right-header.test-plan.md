# Test Plan: Story 10 — Saving a concept's schema never lands on another author's header

**Story:** `engineering-team/stories/graph-operations-foundation/10-schema-save-finds-the-right-header.md`
**ADR:** none. The owner chose the Standard bug path, with Architecture skipped, on 2026-11-15.
**Date:** 2026-11-15
**Approved:** by the owner, 2026-11-15, with `tapestryKey` as the field and AC4's amendment (a concept with no event is refused).

## How the tests see the code

The schema save, apply-enumerations and the firmware install's Pass 2 all reach Neo4j through `src/lib/neo4j-driver.js`, and they all read over relationships. So the stack-free tests run the real code in a child process, `test/helpers/saveSchemaChild.js`, over a fake graph that runs those reads as Neo4j would: `test/helpers/pathCypherFake.js`, story 5's fake. The child calls the route handlers as `registerNormalizeRoutes` registers them, and answers Pass 2's calls to the control panel in-process. It stubs:

- **the database driver.** Reads run on the fake graph. Writes are recorded with their parameters. A write that re-creates a node's json tag is also applied to the fake graph, so the primary-property step that follows a save reads the saved schema, as it would on Neo4j.
- **`strfry import`**, which records each event it would have published. Every other way of starting a process, and every network call, throws.
- **the Tapestry Assistant's key**, which is the test's own. No pubkey is hardcoded: the test's TA is derived from its own private key, and the community authors come from the firmware manifest's `communityReference` entries.

A test reads where a save landed from what the code did: the addresses its writes name, the json it wrote there, and the route's answer. It doesn't read the query text, so the Implementer is free in how the lookups are written. A read the fake can't run fails the test with the fake's own message, naming the read.

**Storage order.** The fake meets nodes in the order the test lays them out. Today's code keeps whichever same-named header comes first, which is what makes the bug depend on the database. So each check that involves several headers runs in more than one order, and AC3's checks run in every order.

## The contract the tests assume

A caller names the header it means with **`tapestryKey`**, the header's tapestryKey, in the body of `POST /api/normalize/save-schema`, beside `concept` and `schema`. `concept` keeps today's meaning, and a body without `tapestryKey` is today's contract (AC3).

The story left the field to the Implementer (Open questions, no ADR). AC4 can't be tested from outside without naming it, so this plan names it. The draft proposed `conceptUuid`, the header's address, as `add-node-as-element` names a concept. At this gate the owner chose the tapestryKey instead. Every node has one (ADR graph-operations-foundation/0003), while not every concept is guaranteed an address. The graph operations name a concept's header the same way (`graph mark-field`'s `concept`, design D6). The Implementer documents the field in `src/api/openapi.yaml` and records it under the story's Deviations.

A key changes what a save can reach. The name lookup only ever finds headers that came from an event (`(h:NostrEvent)`). A key can name a concept that `graph create-concept` made with no event (A10.16), and the save signs and publishes. So AC4, amended at this gate, refuses a concept with no event (S4f). A key is also unique only once `tapestry-keys` has added its rule, and some nodes on an instance that hasn't run it hold `{}` as a key (ADR 0003, Context 2), so S4g refuses a key that isn't one node's.

## Coverage map

All in `test/schema-save-finds-the-right-header.test.js`. "Stack-free" runs in every run, CI included. "Live" runs only with `TAPESTRY_CONTAINER` naming a scratch container (`tapestry-scratch…`); `test/helpers/scratchLoopback.js` refuses any other.

| Criterion | Test | Level |
|---|---|---|
| AC1 | **S1a** Pass 2 saves the six shared-name firmware concepts' schemas on `39998:<TA>:<slug>`, while the community's same-named headers (from the manifest, with no schema) come first and then last. Pass 2 logs 0 errors, enriches all six, saves the firmware's schema on each own schema node, and writes nothing to the community's headers | stack-free |
| AC1 | **S1b** the same when the community's headers have schemas of their own. Those schemas get no write | stack-free |
| AC1 | **S1c** a second header of the TA's own named "tag" (another d tag, with a schema) doesn't take the firmware address's place, in either order | stack-free |
| AC2 | **S2a** apply-enumerations saves the values it enumerated (a superset with two elements, ENUMERATES on `tag.kind`) on the schema its edge points to, while the community's "tag" header (no schema) comes first and then last. It answers `updated: 1` | stack-free |
| AC2 | **S2b** the same when another author's "tag" header has a schema of its own. That schema gets no write | stack-free |
| AC2 | **S2c** a second header of the TA's own named "tag", with a schema, doesn't take the enumerated schema's place | stack-free |
| AC3 | **S3a** sentinel: one header named "tag", the TA's. A save by name answers as today: success, the same message, `schemaUuid`, `primaryProperty` | stack-free |
| AC3 | **S3b** sentinel: one header named "tag", another author's. A save by name answers as today, and saves there | stack-free |
| AC3 | **S3c** three headers named "tag": the TA's, another author's with a schema, the community's without. In all six orders the save goes to the TA's, nothing else is written, and the answer is the same every time | stack-free |
| AC3 | **S3d** two headers named "tag", neither the TA's. In both orders the save is refused: no write, no event, and the error names both addresses and the name | stack-free |
| AC3 | **S3e** three headers named "tag", two of them the TA's. In all six orders it is refused, and the error names all three | stack-free |
| AC3 | **S3f** both "tag" concepts have a primary property that lags the new schema. In both orders the fold reports `reconciled`, the TA's primary property gets the new field, and the other concept gets no write | stack-free |
| AC3 | **S3g** sentinel: no header has the name. The answer is today's `Concept "…" not found`, and nothing is written | stack-free |
| AC4 | **S4a** the Schema tab (`ui/src/pages/concepts/ConceptSchema.jsx`) still finds its header through the concept page. The page or the tab reads the header's tapestryKey (`h.tapestryKey`), and both of the tab's saves, the visual editor's and raw mode's, send `tapestryKey` | stack-free (source) |
| AC4 | **S4b** the client (`ui/src/api/normalize.js`, imported as ESM) sends the `tapestryKey` it is given with `concept` and `schema`, to `/api/normalize/save-schema`. Given none, it sends today's body, `{ concept, schema }` | stack-free (stubbed fetch) |
| AC4 | **S4c** a save naming its header by `tapestryKey` lands on that header's schema: the TA's own while another author's same-named header comes first, and each of two TA headers named "tag", in both orders | stack-free |
| AC4 | **S4d** a `tapestryKey` that no node has: refused with an error; nothing written, nothing published | stack-free |
| AC4 | **S4e** `src/api/openapi.yaml` lists `tapestryKey` in save-schema's request body | stack-free (source) |
| AC4 | **S4f** sentinel: a concept laid out as `graph create-concept` makes one (addresses, no event: no `NostrEvent` label, no `id`) is refused by its key and by its name; nothing written, nothing published. It passes today, since today's lookup can't find such a concept, and it fails a fix that lets the save sign one | stack-free |
| AC4 | **S4g** a `tapestryKey` two headers hold, and the `{}` placeholder held by two: each refused, nothing written | stack-free |
| AC1, AC3 | **L1** on a scratch stack that holds the community's `tag` header, a save by name "tag", and one by the TA's tag header's `tapestryKey`, both answer the TA's own tag schema, and leave the community's header without one. It saves the TA's current schema back, so nothing changes | live |
| AC5 | **L2** (`SCHEMA_SAVE_INSTALL=1`, on a container whose log shows exactly one install) a second firmware install answers success, and its Pass 2 logs 0 errors. The five tag concepts' own schemas' json tags come out as the first install left them. Every other difference between the two graphs is printed, from story 8's snapshot (`test/helpers/pass3Snapshot.js`), along with whether nostr relay's own schema changed | live |

AC4's page is tested at the source level and through its client, as the repo's UI stories are: the harness has no jsdom (no new test infrastructure without an ADR). Its server half (S4c) runs the real handler.

## AC5's record

L2 prints every difference it finds. AC5 asks for each one to be listed here with its cause. One that follows from this bug must be gone, and one with another cause gets a ledger row of its own. That is filled in from the L2 run, under Verification, after the fix. One cause is worth checking first. If the nostr-relay header from `919ba08a…` has a schema, today's save writes the firmware's schema onto that schema and logs no error. Meanwhile the TA's own schema stays as Pass 1 left it. That would be this bug, and it would explain why Pass 2 didn't fail for nostr relay (S1b reproduces it on the fake).

## Edge cases

- [x] Other authors' headers with and without schemas of their own (S1a/S1b, S2a/S2b, S3c/S3d).
- [x] A second header of the TA's own with the same name: a firmware save (S1c), an enumerated save (S2c), a save by name (S3e) and a save by key (S4c).
- [x] Storage order: every order for AC3, both orders elsewhere.
- [x] The primary-property fold acting on another concept than the save (S3f).
- [x] A name no header has (S3g); a key no node has (S4d); a key that isn't one node's (S4g).
- [x] A concept with no event, by key and by name (S4f).
- [x] A refused save changes nothing: no write and no published event (S3d, S3e, S4d, S4f, S4g).
- [x] A read the fake graph can't run fails the test with the fake's message, naming the read.
- [ ] Concurrent saves: out of scope, as in story 3 of second-brain (ADR second-brain/0003 Consequences).

## Test infrastructure

- **Framework:** Node's runner. The suite is registered in `test/registry.js`, after story 8's.
- **New helper:** `test/helpers/saveSchemaChild.js`, the child process above. It reuses `test/helpers/pathCypherFake.js` unchanged.
- **Concept Graph API:** not used by the stack-free tests. The live tests use a scratch container only.
- **Firmware state:** the stack-free tests read the firmware manifest and the six concepts' `json-schema.json` from `firmware/active`. L2 needs a freshly booted scratch stack (one install in its log) that fetched the community headers in that install.
- **Fixtures:** none on disk; each test builds its graph. Every fake node carries the shared label and a tapestryKey in keyNode's form (a version 4 UUID, made from the node's address so a graph is the same every run), as on an instance that has run `tapestry-keys`. A node from an event also carries `NostrEvent`.

## Suites the Implementer runs again

The fix touches the code these suites cover: the save-schema callers, the Schema tab and `openapi.yaml`. Run each one on its own with dead endpoints. Never run the full `npm test` on this Mac.

`structures-the-brain-can-trust`, `create-concept-duplicate-check`, `pass-3-finishes-in-minutes`, `capture-a-goal-and-see-it`, `break-a-goal-into-pieces`, `store-the-four-when-a-goal-is-captured-or-updated`, `attach-the-world`, `teach-it-what-matters`, `the-proposal-loop`, `the-brain-survives`, `sessions-read-the-brain`, `openapi-document` and `stack-free-npm-test`.

Skip `event-tagging-firmware-seed`, which calls `localhost:7778` directly. The full gate comes from the PR's CI.

## How to run

```
# stack-free, with dead endpoints, as on this Mac
env -u TAPESTRY_CONTAINER BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_PORT=9 MEILI_URL_HOST=http://127.0.0.1:9 \
  node test/schema-save-finds-the-right-header.test.js

# live: a fresh scratch stack from staging's image (the script's default image is stale)
TAPESTRY_CONTAINER=$(SCRATCH_IMAGE=agent-memory-tapestry:latest bash scripts/scratch-stack.sh up)
TAPESTRY_CONTAINER=tapestry-scratch node test/schema-save-finds-the-right-header.test.js                        # + L1
TAPESTRY_CONTAINER=tapestry-scratch SCHEMA_SAVE_INSTALL=1 node test/schema-save-finds-the-right-header.test.js  # + L2
```

Scratch stacks run one at a time on this Mac, so first check that no other session's is up (`docker ps --filter name=tapestry-scratch`).

## Verification

The new tests fail with the current code. Confirmed on 2026-11-15, on `4a11576c` (the story's commit) with these tests added and no change to `src/` or `ui/`, run stack-free with dead endpoints:

```
=== saving a concept's schema never lands on another author's header (graph-operations-foundation #10) ===
  FAIL  S1a (AC1): … [theirs first] Pass 2 must log no errors; it logged 6: [{"slug":"nostr-relay","error":"Concept \"nostr relay\" has no JSON Schema node. Create one first via normalize skeleton."},{"slug":"tag","error":"Concept \"tag\" has no JSON Schema node. …
  FAIL  S1b (AC1): … [theirs first] nostr-relay's schema on 39998:<TA>:nostr-relay must be the firmware's; nothing was saved there
  FAIL  S1c (AC1): … [twin first] the firmware's tag schema must be saved on 39998:<TA>:tag's schema; nothing was saved there
  FAIL  S2a (AC2): … [other first] apply-enumerations must save the one schema it enumerated; it saved 0: ["  ❌ Save failed: Concept \"tag\" has no JSON Schema node. …"]
  FAIL  S2b (AC2): … [other first] the enumerated values must be saved on 39999:<TA>:tag-json-schema; nothing was saved there
  FAIL  S2c (AC2): … [other first] the enumerated values must be saved on 39999:<TA>:tag-json-schema; nothing was saved there
  PASS  S3a (AC3, sentinel): with one header named "tag", the instance's own, a save by name does what it does today
  PASS  S3b (AC3, sentinel): with one header named "tag", another author's, a save by name does what it does today
  FAIL  S3c (AC3): … order otherWithSchema, own, communityWithout: the save must answer schemaUuid 39999:<TA>:tag-json-schema; it answered 39999:abab…:tag-json-schema
  FAIL  S3d (AC3): … order other, community: the save must be refused; {"statusCode":200,"body":{"success":true,"message":"JSON Schema for \"tag\" updated.", …
  FAIL  S3e (AC3): … order own, ownTwin, other: the save must be refused; {"statusCode":200,"body":{"success":true, …
  FAIL  S3f (AC3): … order other, own: the save must answer schemaUuid 39999:<TA>:tag-json-schema; it answered 39999:abab…:tag-json-schema
  PASS  S3g (AC3, sentinel): with no header of that name, a save by name does what it does today
  FAIL  S4a (AC4): … the concept page or its Schema tab must read the header's tapestryKey (h.tapestryKey), to send it with the save
  FAIL  S4b (AC4): … the request must carry the tapestryKey it was given; its body is {"concept":"tag","schema":{…}}
  FAIL  S4c (AC4): … another author's header first: the save must answer schemaUuid 39999:<TA>:tag-json-schema; it answered 39999:abab…:tag-json-schema
  FAIL  S4d (AC4): … a key no node has: the save must be refused with an error; {"statusCode":200,"body":{"success":true, …
  FAIL  S4e (AC4): … save-schema's documented request body must list tapestryKey beside concept and schema
  PASS  S4f (AC4, sentinel): a concept with no event is refused, by its tapestryKey or by its name, and nothing is signed or published
  FAIL  S4g (AC4): … a key two headers hold: the save must be refused with an error; {"statusCode":200,"body":{"success":true, …
  NOTE  live checks skipped: TAPESTRY_CONTAINER is not set
  SKIP  L1 (AC1, AC3, live): …
  SKIP  L2 (AC5, live, SCHEMA_SAVE_INSTALL=1): …

schema-save-finds-the-right-header: 4 passed, 16 failed, 2 skipped
```

(`<TA>` stands for the test's own TA, `4f355bdc…`; `abab…` is the other author.)

Each failure is the bug itself, not a fault in the test:
- S1a's errors are the owner's local instance's error, word for word.
- S1b and S2b show the worse case: the save went to the other author's schema, and nothing was logged.
- S3d and S3e show a save that should have been refused landing on whichever header came first.
- S4c, S4d and S4g show today's route ignoring the key and saving by name.

The four sentinels pass (S3a, S3b, S3g, S4f). So does `stack-free-npm-test` (6 of 6, 1 skipped) with the suite registered. The suite takes about 3 s.
