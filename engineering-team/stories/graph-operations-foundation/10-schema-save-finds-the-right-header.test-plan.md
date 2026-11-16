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

A key changes what a save can reach. The name lookup only ever finds headers that came from an event (`(h:NostrEvent)`). A key can name a concept that `graph create-concept` made with no event (A10.16), and the save signs and publishes. So AC4, amended at this gate, refuses a concept with no event (S4f). A key is also unique only once `tapestry-keys` has added its rule, and some nodes on an instance that hasn't run it hold `{}` as a key (ADR 0003, Context 2), so S4g refuses a key that isn't one concept header's.

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
| AC3 | **S3h** a header with two schema nodes, laid out in either order, has the first by address saved; the second gets no write | stack-free |
| AC4 | **S4a** the Schema tab (`ui/src/pages/concepts/ConceptSchema.jsx`) still finds its header through the concept page. The page's header query returns `h.tapestryKey AS tapestryKey`, and both of the tab's saves, the visual editor's and raw mode's, send `tapestryKey: concept.tapestryKey`. The tab's schema read orders by address before its `LIMIT 1`, as the save chooses | stack-free (source) |
| AC4 | **S4b** the client (`ui/src/api/normalize.js`, imported as ESM) sends the `tapestryKey` it is given with `concept` and `schema`, to `/api/normalize/save-schema`. Given none, `{}` or an empty string, it sends today's body, `{ concept, schema }` | stack-free (stubbed fetch) |
| AC4 | **S4c** a save naming its header by `tapestryKey` lands on that header's schema: the TA's own while another author's same-named header comes first, and each of two TA headers named "tag", in both orders | stack-free |
| AC4 | **S4d** a `tapestryKey` that no node has: refused with an error; nothing written, nothing published | stack-free |
| AC4 | **S4e** `src/api/openapi.yaml` lists `tapestryKey` in save-schema's request body | stack-free (source) |
| AC4 | **S4f** sentinel: a concept laid out as `graph create-concept` makes one (addresses, no event: no `NostrEvent` label, no `id`) is refused by its key and by its name; nothing written, nothing published. It passes today, since today's lookup can't find such a concept, and it fails a fix that lets the save sign one | stack-free |
| AC4 | **S4g** a `tapestryKey` two headers hold, and the `{}` placeholder held by two: each refused, nothing written | stack-free |
| AC4 | **S4h** a value that isn't a tapestryKey answers 400 and writes nothing: one no node holds, and `{}` held by a single header | stack-free |
| AC4 | **S4i** a header that came from an event, whose schema node didn't: refused by key and by name, nothing written | stack-free |
| AC4 | **S5a** before `tapestry-keys` (no node has `TapestryNode`, the keys as `initialize` stamps them): a save by key lands on its header while another author's same-named header comes first, in both orders, and the fold reconciles that header | stack-free |
| AC3 | **S5b** before `tapestry-keys`, with no keys at all: a save by name lands on the instance's own header, in both orders, and the fold reconciles it | stack-free |
| AC1, AC3 | **L1** on a scratch stack that holds the community's `tag` header, a save by name "tag", and one by the TA's tag header's `tapestryKey`, both answer the TA's own tag schema, and leave the community's header without one. It saves the TA's current schema back, so nothing changes | live |
| AC5 | **L2** (`SCHEMA_SAVE_INSTALL=1`, on a container whose log shows exactly one install) a second firmware install answers success, and its Pass 2 logs 0 errors. The five tag concepts' own schemas' json tags come out as the first install left them. Every other difference between the two graphs is printed, from story 8's snapshot (`test/helpers/pass3Snapshot.js`), along with whether nostr relay's own schema changed | live |

AC4's page is tested at the source level and through its client, as the repo's UI stories are: the harness has no jsdom (no new test infrastructure without an ADR). Its server half (S4c) runs the real handler.

## AC5's record

L2 prints every difference it finds. AC5 asks for each one to be listed here with its cause. One that follows from this bug must be gone, and one with another cause gets a ledger row of its own. The record is under Verification, after the fix.

The draft suggested one cause to check first: the nostr-relay header from `919ba08a…` might have a schema, and today's save would write onto it silently (S1b reproduces that on the fake). On the scratch stacks it doesn't: none of the six community headers has a schema there.

## Edge cases

- [x] Other authors' headers with and without schemas of their own (S1a/S1b, S2a/S2b, S3c/S3d).
- [x] A second header of the TA's own with the same name: a firmware save (S1c), an enumerated save (S2c), a save by name (S3e) and a save by key (S4c).
- [x] Storage order: every order for AC3, both orders elsewhere.
- [x] The primary-property fold acting on another concept than the save (S3f).
- [x] A name no header has (S3g); a key no node has (S4d); a key that isn't one concept header's (S4g); a value that isn't a key (S4h).
- [x] A concept with no event, by key and by name (S4f); one whose schema node alone came from no event (S4i).
- [x] A refused save changes nothing: no write and no published event (S3d, S3e, S4d, S4f, S4g, S4h, S4i). A refusal by name answers the same in every storage order (S3d, S3e).
- [x] A header with two schema nodes (S3h).
- [x] An instance before `tapestry-keys`, with keys and with none (S5a, S5b).
- [x] A read the fake graph can't run fails the test with the fake's message, naming the read.
- [ ] Concurrent saves: out of scope, as in story 3 of second-brain (ADR second-brain/0003 Consequences).

## Test infrastructure

- **Framework:** Node's runner. The suite is registered in `test/registry.js`, after story 8's.
- **New helper:** `test/helpers/saveSchemaChild.js`, the child process above. It reuses `test/helpers/pathCypherFake.js` unchanged.
- **Concept Graph API:** not used by the stack-free tests. The live tests use a scratch container only.
- **Firmware state:** the stack-free tests read the firmware manifest and the six concepts' `json-schema.json` from `firmware/active`. L2 needs a freshly booted scratch stack (one install in its log) that fetched the community headers in that install.
- **Fixtures:** none on disk; each test builds its graph. By default every fake node carries the shared label and a tapestryKey in keyNode's form (a version 4 UUID, made from the node's address so a graph is the same every run), as on an instance that has run `tapestry-keys`. A node from an event also carries `NostrEvent`. S5a and S5b lay the graph out as before `tapestry-keys`. Neither has the shared label on any node. S5a's nodes still hold keys, as `POST /api/tapestry-key/initialize` stamps them (`src/api/tapestry-key/index.js:136–141`); S5b's hold none.
- **Dead endpoints:** the suite's child gets a conf file of its own (`BRAINSTORM_CONF_PATH`) whose Neo4j is a closed port. The database driver reads its address only from the conf (`src/lib/neo4j-driver.js`, `src/utils/config.js`). Without one it falls back to `bolt://localhost:7687`, the agent-memory instance on the owner's Mac. The child stubs the driver; the conf only guards against the stub being bypassed.

## Suites the Implementer runs again

The fix touches the code these suites cover: the save-schema callers, the Schema tab and `openapi.yaml`. Never run the full `npm test` on this Mac. Run each suite on its own with dead endpoints:
- `BRAINSTORM_BASE_URL`, `TAPESTRY_PORT` and `MEILI_URL_HOST` at `127.0.0.1:9`;
- `TAPESTRY_CONTAINER=no-such-container`;
- `BRAINSTORM_CONF_PATH` naming a conf whose `NEO4J_URI` is `bolt://127.0.0.1:9`. The database driver reads only the conf, and without one falls back to `bolt://localhost:7687`, the agent-memory instance (ledger row `2026-11-14-harness-points-tests-at-agent-memory`, 2026-11-16).

`structures-the-brain-can-trust`, `create-concept-duplicate-check`, `pass-3-finishes-in-minutes`, `capture-a-goal-and-see-it`, `break-a-goal-into-pieces`, `store-the-four-when-a-goal-is-captured-or-updated`, `attach-the-world`, `teach-it-what-matters`, `the-proposal-loop`, `the-brain-survives`, `sessions-read-the-brain`, `openapi-document` and `stack-free-npm-test`.

Skip `event-tagging-firmware-seed`, which calls `localhost:7778` directly. The full gate comes from the PR's CI.

## How to run

```
# stack-free, with dead endpoints, as on this Mac. Name a container that doesn't exist rather than leaving
# TAPESTRY_CONTAINER unset: several suites fall back to `tapestry`, the owner's agent-memory instance, when it is unset.
TAPESTRY_CONTAINER=no-such-container BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_PORT=9 MEILI_URL_HOST=http://127.0.0.1:9 \
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

### After the fix (2026-11-15/16, on `639eaaf5`)

**Stack-free**, each suite on its own with dead endpoints:

- **This suite:** 20 of 20, with L1 and L2 skipped.
- **The operations gate** (`test/operations.test.js`): 337 of 337. Its first run failed G18 on three lines that named `:NostrEvent` alone. Two were label tests, now written `'NostrEvent' IN labels(h)`, the form G18 itself lets through. The third was the fold's name lookup, which shared a line with a ternary and now has a line of its own. So no entry was added to `nostr-event-lookups-kept.json`.
- **The regression suites:** structures-the-brain-can-trust 18 (6 skipped), pass-3-finishes-in-minutes 8 (8), capture-a-goal-and-see-it 21 (6), break-a-goal-into-pieces 23 (7), store-the-four-when-a-goal-is-captured-or-updated 29 (11), attach-the-world 21 (8), teach-it-what-matters 20 (7), the-proposal-loop 22 (11), the-brain-survives 23 (8), sessions-read-the-brain 20 (10), openapi-document 10, stack-free-npm-test 6 (1).
- **create-concept-duplicate-check:** 3 (3 skipped). Run it with `TAPESTRY_CONTAINER` unset: it treats any name but `tapestry` as a live stack, so `no-such-container` fails its H1 and H2 for want of a stack. It never falls back to `tapestry`.
- **Each refusal fails for its own reason**, not an early return. Checked by printing the error each one gets:
  - a concept with no event, by key: "has no event behind it";
  - the same concept by name: "not found", as today;
  - a key two headers hold: "More than one node holds…";
  - `{}`: 400, "is not a tapestryKey";
  - a shared name: names both headers;
  - a key no node holds: "No concept header has…".

**Live**, on fresh scratch stacks (`SCRATCH_IMAGE=agent-memory-tapestry:latest`, this checkout's `src/`):

- **The boot's install** (the first): `Pass 2 complete: 40 enriched, 0 skipped, 0 errors`. It fetched all six community headers. None of them has a schema on these stacks.
- **L1 passes.** Real Neo4j runs the new lookups: the label disjunction, `labels()`, the grouped `WITH` and the ordering. By name and by key alike, a save reaches the TA's own tag schema.
- **L2 passes.** The second install answers success and logs 0 errors in Pass 2. The five tag schemas, and nostr relay's own, come out as the first install left them.
- **create-concept-duplicate-check H1 and H2 pass live.** A new concept's schema saved by name lands on it.

**AC5's record:** every difference between the first install's graph and the second's.

- **The five tag concepts' schemas are this bug, and the fix removed it.** Their failed saves were the bug itself, and with the fix their schemas came out as the first install left them.
- **Nostr relay's schema and the two moved supersets can't be judged from these runs.** *(Corrected after the review, its non-blocking finding 6.)*
  - **Where they were seen.** Story 8 saw them only on its stack seeded to staging's shape, on its second install (`8-pass-3-finishes-in-minutes.test-plan.md`, Amendment 1).
  - **On a fresh stack,** story 8's review found neither, with the code before this fix (`engineering-team/reviews/graph-operations-foundation/8-pass-3-finishes-in-minutes.md:117`).
  - **So these runs say nothing either way.** In four installs on two fresh stacks with the fix, nostr relay's schema and every superset's HAS_ELEMENT targets came out the same. That doesn't show the fix removed them, or what causes them. Nothing writes nostr relay's schema except the save (no firmware enumeration targets it), and Pass 2 hadn't failed for it there.
  - **Filed** as ledger row `2026-11-16-seeded-second-install-differs`, unexplained, until L2 runs on a seeded stack.
- **Nine nodes' cached Tapestry JSON differs, and has another cause.** They are six supersets of the TA's own (tag, nostr user tag, tag pinning, nostr relay, set, word) and three of the tag concepts' supersets under ADR 0015's literal pubkey. Everything else is the same: every schema's json tag and every superset's elements. A third install matches the second exactly.
  - **The cause.** Pass 3 rebuilds its caches before its own last steps change the graph. That is why a rebuild right after any install changes 439 nodes, and why the first install, which lays down the community-reference edges after its rebuild, differs from the later ones in these nine.
  - **Filed** as ledger row `2026-11-16-install-caches-lag-its-own-graph`, with the runs that show it: an install after a rebuild matches the other stack's second install exactly, and a rebuild after any install lands on the same state.
