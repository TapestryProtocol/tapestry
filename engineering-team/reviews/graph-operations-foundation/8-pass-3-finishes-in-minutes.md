# Review: Story 8 — A firmware install's Pass 3 finishes in minutes

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-15
**Diff:** `git diff 0ebe1795..HEAD` (HEAD `0392216d`, branch `install-derive-stall`; `0ebe1795` is `origin/staging`, where the branch started). Five commits: `6276558c` the story, `b0355996` the failing tests, `43727117` the tests' Amendment 1, `ddd85135` the fix, `0392216d` the owner's approval of the amendment.

This review re-ran or re-derived everything it relies on: the stack-free suites, the live suite on both graphs, the query plans, a second install, and four wrong fixes tried against the tests in a copy of the code. During the review a teammate session supplied one fact, save-schema's lookup by name (see Amendment 1 below). It was checked on the scratch stacks before this review used it.

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`: not run.** On this Mac its live suites default to the owner's private `tapestry` container, so the review's brief rules out the full run (OPEN.md row 294). The full gate comes from the pull request's CI.
- [x] **A subset through the gate engine.** The subset is the stack-free suites that read a changed file, run with `test/helpers/gateRunner.js` and recorded under a scratch `GATE_RECORD_DIR`. Every endpoint was dead: `BRAINSTORM_BASE_URL`, `TAPESTRY_PORT` and `MEILI_URL_HOST` at `127.0.0.1:9`, `TAPESTRY_CONTAINER=no-such-container`, and `BRAINSTORM_CONF_PATH` naming a conf with `NEO4J_URI=bolt://127.0.0.1:9`. `npm run gate:status`:
  `20261115T225342Z-41315-8c94 [reviewer-8-subset] started 2026-11-15T22:53:42.856Z on 0392216d+dirty — PASS, exit 0, 348 passed, 0 failed, 8 skipped, 4/4 suites`
  - The four suites:
    - `pass-3-finishes-in-minutes`: 6 passed, 8 skipped (its live checks).
    - `operations`: 337 of 337. That includes story 7's cache counts (7 of 7) and `tapestry-key-paths` (19 of 19). Its G11 and G18 read the changed apply-enumerations line.
    - `tapestry-key-put-await`: 3 of 3.
    - `header-conceptgraph-tag`: 2 of 2.
  - `+dirty`: the tree's only changes were under `ledger/` (five new notes, two edited). Nothing under `src/` or `test/` had changed.
- [x] **Live, staging's shape.** This was `tapestry-scratch` as it was handed over: seeded by `seedStagingShape.js` (3,851,244 nodes, 370,377 card sets, `tapestry_key` online), with two installs in its log. The run used `TAPESTRY_CONTAINER=tapestry-scratch PASS3_INSTALL=1`. **11 passed, 0 failed, 3 skipped.** L1 and L5a skipped because the graph isn't small, and L5b because the log shows three installs.
  - L3, a rebuild by key, median of 3 (ms): ListItem 46, ListHeader 6, ConceptHeader 35, JSONSchema 32, Property 37, Set 32, Superset 35. Inside `derive-all` ConceptHeader: 26 ms each (40 in 1.1 s).
  - L4: 57 s before Pass 3. Pass 3 took 14 s: ListItem 4 s, JSONSchema 2 s, enumerations 2 s, implicit elements 6 s, and every other step 0 s. The install answered success. L2b: every label reads `derived = total`.
  - After the run:
    - `derive-status` read Set as 22 of 22, in 0.12 s.
    - `derive-all/Set` answered `{"derived":22,"skipped":0,"errors":0,"total":22}`.
    - No card set had a `tapestryJsonUpdatedAt`.
- [x] **Live, a small graph.** `scripts/scratch-stack.sh down`, then `up` from `agent-memory-tapestry:latest`: 3,232 nodes. Its one install ran the fix, and its log reads "Pass 3: 636 derived, 4 enumerations, 90 implicit elements". **11 passed, 0 failed, 3 skipped** (L3, L4, L2b). **L1, L2, L5c, L5a and L5b pass.**
- [x] **The same stack after a second install** (`POST /api/firmware/install`, 62 s): **10 passed, 0 failed, 4 skipped.** L5a passes on the twice-installed graph. L5b skips, since the log shows two installs (see Amendment 1).
- [x] **M3, measured again,** on the small graph, median of 3 (ms): ListItem 44, ListHeader 7, ConceptHeader 35, JSONSchema 34, Property 37, Set 37, Superset 39. Inside derive-all: 27 ms each. Against L3's run on staging's shape above, each label's time on staging's shape is 0.86 to 1.05 times its time on the small graph.
- [ ] **Not run, on purpose:**
  - `event-tagging-firmware-seed` calls `localhost:7778` and `localhost:8877` whatever the environment says (Harness friction 1).
  - `stack-free-npm-test` spawns the twelve live-API suites. Its G5 was checked directly instead: `test/registry.js:401` registers the suite, and it isn't in `excluded`.
  - `brain-first-tapestry-authoring` reads through `localhost:${TAPESTRY_PORT}` and writes to the `tapestry` container by default.
- [ ] `npm run test:playwright`: not applicable. No UI changed.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence

- [x] **Every acceptance criterion has a passing test.**

| AC | Evidence |
|---|---|
| AC1, only nodes with an address | S1a, after `tapestry-keys`: card sets, a stray under each label, and an addressed node with no key. S1b: no `TapestryNode` anywhere. L1, live: 30 keyed card sets, a stray under each label, and an event-less set. The selection is `src/lib/tapestry-derive.js:158–162`. |
| AC2, derive-status | S2a, S2b, L2 and L2b. The query (`src/api/tapestry-key/index.js:449–455`) uses derive-all's predicate (`:451`). On staging's shape, Set reads 22 of 22. |
| AC3, 200 ms, both ways | L3, by key and inside derive-all: 6–46 ms. M3 covers the second bullet: on staging's shape each time is 0.86 to 1.05 times the small graph's. |
| AC4, Pass 3 in minutes | L4: Pass 3 took 14 s, the install answered success, and the log reached "FIRMWARE INSTALL COMPLETE". The plan records M1, M2 and the time of each step. |
| AC5, nothing else changes | L5a and L5b after one install, and L5a after a second. S5 and L5c rebuild a card set by key. One more check, run for this review: a keyed card set rebuilt by key is stamped, and caches `{"word":{"slug":null,"name":null,"wordTypes":["word","set"]},"set":{"slug":null,"name":null},"graphContext":{"identifiers":{…,"uuid":null},…}}`, with every list empty and `parentJsonSchemas: []`. That is the empty JSON the story's Background describes for today's code. |

- [x] **No criterion is silently dropped.**
- [x] **No behaviour added that the story doesn't cover.** The story's Deviations list the rebuild by key's lookup in the index and the apply-enumerations line (`8-pass-3-finishes-in-minutes.md:79–85`).

## ADR adherence

The story has no ADR. Under Standard a bug skips Architecture when the fix is obvious, and the owner chose that path on 2026-11-15. The diff is judged against ADR `graph-operations-foundation/0003`, Decision 9 and Sub-decision 4, and against story 7's address: a `uuid` or an `id`.

- [x] **Story 7's address.** derive-all and derive-status select with story 7's predicate, parentheses included (`tapestry-derive.js:160`, `index.js:451`), as `readTapestryKeyCounts` counts (`index.js:42`).
- [x] **Decision 9, and the deviation from it.**
  - **The derivers don't look a node up by address at all.** Each of their queries starts from the node's element id (`src/lib/derivers/word.js:46–51, 86–117`; `src/lib/derivers/set.js:30–35, 117–187`). On the seeded stack `EXPLAIN` plans every one as `NodeByElementIdSeek`, and the schema query adds only a label scan of `ConceptHeader` (40 nodes). This is narrower than Decision 9 asks, and it works in every state an instance can be in:
    - before `tapestry-keys` or after it;
    - with or without `NostrEvent`;
    - with or without the indexes that measurement 1 depends on.
  - **The stamp** seeks by element id and checks the key (`tapestry-derive.js:127–130`).
  - **The lookup by key** plans as `NodeUniqueIndexSeek` on `tapestry_key`, and its fallback as `AllNodesScan`, as the Deviations say.
  - **Apply-enumerations' source** uses the disjunction (`src/api/normalize/index.js:6085`).
- [x] **Files and layering.** Five source files changed, and each change stays in the query it fixes. `deriveNode` gains a lookup for a caller that passes no element id (`tapestry-derive.js:112–117`). Both of today's callers pass one, so none of them reaches it.
- [x] **Dependencies:** none added.

## Concept-graph integrity
- [x] **Handles:** none touched.
- [x] **Firmware:** no concept definition changed, so the fix needs no reinstall. Rerunning staging's interrupted install is the owner's call (`ledger/2026-11-15-staging-install-cut-short.md`).
- [x] **Orientation:** not applicable. The change reads no concept.

## Things tests can't catch
- [x] **No secrets.**
  - The baseline fixture names one pubkey, ADR 0015's literal (`LEGACY_Z_TAG_PUBKEY`, `src/api/profile-tags/index.js:49`). The TA reads as `<TA>`.
  - The seeder reads the scratch password from the container's own conf.
- [x] **No debug logging and no commented-out code.**
- [x] **No caller of the engine is missed.**
  - The callers are the two routes (`src/api/tapestry-key/index.js:411, 429`) and the brain write (`src/api/strfry/tapestryBrainWrite.js:104`). The brain write keys its node with `keyNode` first, so on a migrated instance its lookup finds the node through the index.
  - The Dashboard (`ui/src/pages/Dashboard.jsx:588–596`) and NodeJson (`ui/src/pages/nodes/NodeJson.jsx:189`) call the same routes.
- [x] **Nothing else in Pass 3's path reads the whole graph on staging's shape.**
  - derive-all's selection is one label scan per label. Set's reads its 370,399 nodes in about 0.26 s.
  - wire-implicit-elements matches labelled `Superset`, `NostrEvent|ListItem` and `NostrEventTag` patterns. It took 6 s in L4.
  - The community-reference edges use the disjunction.
  - On the small stack no json tag is offloaded (0 `lmdb:` values). So the only read of the cache in the install's path is apply-enumerations' (`normalize/index.js:6090`).
- [x] **The address filter drops nothing in the concept graph** (CLAUDE.md principle 4). Every place in `src/` that gives a node one of the seven labels first finds it, or makes it, by `uuid`, and `ui/src` makes none. The places are in `normalize/index.js`, and at `normalize/nodes.js:205`, `firmware/install.js:1125`, `concept/pullClassThread.js:284` and `tapestryBrainWrite.js:74–76`. The only nodes with one of the labels and no address are the trust pipeline's card sets (`src/cns/addSetsOfMetricsCards.sh:26`, `src/cns/prepareNeo4jForCustomerData.sh:100`).
- [x] **Concurrency:** one new consideration, Non-blocking 4.
- [x] **Security:** no new input. derive-all still checks its label against the registered derivers before writing it into the query (`tapestry-derive.js:150`).

## House rules check
- [x] **Concept Graph API authority:** not applicable.
- [x] **Tooling:** no new lint, typecheck or build tooling.
- [x] **TA pubkey:** no literal added.
  - The live checks read the TA at run time (`test/helpers/scratchLoopback.js:67–71`).
  - The snapshot reads ADR 0015's literal from the source (`test/helpers/pass3Snapshot.js:23–28`).

## Amendment 1

The amendment changes two things in L5b:
- **Its precondition.** L5b now runs only on a container whose log shows one install, after a derive-all in the same run (`test/pass-3-finishes-in-minutes.test.js:456–462`).
- **Its names for addresses.** It gives each address a name that is the same on every instance, so two stacks can be compared.

What the amendment does is sound. One sentence of its reasoning isn't.

- **The comparison is like for like.**
  - **The baseline:** a fresh stack running today's code, after one install and one derive-all.
  - **L5b's other side:** a fresh stack running the fix, in the same state.

  L5b passed here (above).
- **A second install isn't a stable point to compare.** The teammate's fact holds on the scratch stacks.
  - **The lookup.** `handleSaveSchema` (`src/api/normalize/index.js:1930–1940`) finds a header by `h.name = $concept`, among any author's headers, with `LIMIT 1` and no `ORDER BY`.
  - **The shared names.** On the seeded stack, six names belong to two headers each: the five tag concepts under ADR 0015's pubkey, and the community's `nostr relay`. The other author's header has no schema in each case.
  - **The first install.** Pass 2 enriched 40 of 40, on both stacks.
  - **Every later install.** Pass 2 failed with "has no JSON Schema node" for some of the tag concepts. The seeded stack's second and third installs failed for five, the fresh stack's second install for three (`tag`, `nostr user tag`, `tag pinning`). So two stacks running the same code fail differently.
  - **The snapshot.** On the fresh stack, after the second install and a derive-all, a snapshot differed from the baseline in exactly those three schemas' json tags. Nothing else differed: none of the 448 nodes, and none of the 17 supersets' elements.
  - **The wiring.** The seeded stack's third install also wired 73 implicit elements, where its first two wired 90.
- **The fix plays no part in those differences.** It can reach the graph in two ways only.
  - **The cache.** In the install's path, only apply-enumerations reads the cache back. L5a passes after the second install, so the rebuilds still match today's queries there.
  - **Apply-enumerations' source lookup.** All five `ENUMERATES` sources carry `NostrEvent` and `TapestryNode`, so the disjunction finds what the match with no label found. Their targets are `word`, `graph`, `property`, `relationship` and `dog`, and no other header has any of those names. So its saves aren't among the ones that differ.
- **What is wrong is in two places** (Non-blocking 2):
  - **The plan's sentence** "None of these is code the fix changes" (`8-pass-3-finishes-in-minutes.test-plan.md:104`). Apply-enumerations is changed, and it saves through save-schema. The cause is save-schema's lookup by name, reached through Pass 2's enrich, and the fix doesn't change that.
  - **The test's comment** that a second install diverges "on today's code as on the fix" (`test/pass-3-finishes-in-minutes.test.js:458–459`). That wasn't measured on today's code, as the team's own ledger note says (`ledger/2026-11-15-save-schema-finds-header-by-name.md`).

## Findings

### Blocking
None.

### Non-blocking
1. **`test/pass-3-finishes-in-minutes.test.js:157–159, 184–209`: no test sees the fix on an instance that hasn't run `tapestry-keys`, except derive-all's selection.**
   - **Where the tests run.** S1b runs `deriveAll` on the graph before `tapestry-keys`. S2a, S2b and S5 run only on the graph after it. Every scratch stack labels every node `TapestryNode`.
   - **Four wrong fixes, tried in a scratch copy of the code.** Each was run with all six stack-free tests, and each passed all six:
     - `findByKey` with no fallback (`src/lib/tapestry-derive.js:96–101`);
     - derive-status counting only `TapestryNode` nodes;
     - both selections reading `uuid` only;
     - the stamp put back as `MATCH (n {tapestryKey: $key})`.
   - **What would catch them.** L3 would catch the fourth on staging's shape. The third doesn't matter in practice, since no node has an `id` and no `uuid`.
   - **The first two do matter.** Production hasn't run `tapestry-keys`, and the plan says S1b guards it (`8-pass-3-finishes-in-minutes.test-plan.md:50, 68`).
   - **The code is right.** Run on a graph with no `TapestryNode` label, through the suite's own child process, the fix's `deriveByKey`:
     - found every addressed node, an event-less set included, and a node keyed by new code beside them;
     - stamped each one by its element id;
     - answered `null` for a missing key.

   Asked change: when convenient, the Tester adds a stack-free check that runs `deriveByKey` and derive-status on the graph before `tapestry-keys`. The plan's lines 50 and 68 should then say what S1b covers.
2. **`8-pass-3-finishes-in-minutes.test-plan.md:104`, `test/pass-3-finishes-in-minutes.test.js:458–459`: Amendment 1 names the wrong cause, and claims a measurement on today's code that wasn't made** (see Amendment 1). The precondition it sets is right. Optional improvement: name save-schema's lookup by name, through Pass 2's enrich, as the cause. Then either drop "on today's code as on the fix", or say that it is inferred from code the fix doesn't change.
3. **`src/lib/tapestry-derive.js:96–101`: between a deploy and `tapestry-keys`, the first lookup is itself a scan.** The index on `TapestryNode.tapestryKey` belongs to the rule `tapestry_key`, and only `tapestry-keys` makes that (ADR 0003 Decision 1, Amendment 1).
   - **Before the migration.** After the deploy, `keyNode` labels every node the pipeline touches, so a rebuild by key on production first scans that growing label, and then the whole graph when the node is older than the deploy.
   - **Still better than before.** By the story's count, the old rebuild by key read the whole graph three to five times, its lookup included.
   - **Pass 3 isn't affected.** derive-all's rows carry their element ids.

   Optional improvement: the story's second Deviation could say so, for whoever plans production's migration.
4. **`src/lib/tapestry-derive.js:158–175` with the derivers: element ids are used across transactions.**
   - **What Neo4j guarantees.** It doesn't guarantee what an element id maps to outside the transaction that read it, and it reuses ids after deletes. On the seeded stack a card set the seeder made after the first install had node id 161.
   - **What the fix does.** derive-all reads the ids in one statement and uses them in later transactions, up to a label's whole pass. The stamp checks the key; the deriver queries don't.
   - **What could go wrong.** A concept-graph node deleted during the pass, whose id is then reused, would have its dead key's cache entry filled from the new node's edges. No live key is affected, and today's code also writes a cache entry for a node deleted mid-pass.

   Optional hardening: add `AND n.tapestryKey = $tapestryKey` to the derivers' anchors.
5. **`src/api/normalize/index.js:6081–6083`: the new comment says that "with no label the match read every node in the graph".** On staging's shape, `EXPLAIN` plans the old query and the new one alike, from a `DirectedRelationshipTypeScan` (527 `HAS_ELEMENT`, 52 `IS_A_SUPERSET_OF`). So the line brings apply-enumerations into line with Decision 9; it isn't part of the speed fix. The story's fifth Deviation describes the planner's choice correctly. Optional improvement: make the comment match.
6. **The follow-ups the story leans on exist only as uncommitted files.** At review time `ledger/` held five untracked notes:
   - `card-sets-carry-the-set-label`;
   - `save-schema-finds-header-by-name`;
   - `staging-install-cut-short`;
   - `tapestry-key-routes-scan-every-node`;
   - `tapestry-keys-exceeds-transaction-memory`.

   It also held edits to two older notes. The story's Out of scope depends on them. Asked change: commit them, with this review or beside it.

### Harness friction
1. **`test/event-tagging-firmware-seed.test.js:127, 137, 140, 151` call `http://localhost:8877` and `http://localhost:7778` directly.**
   - **The plan's claim.** The test plan lists the suite among the suites run "with dead endpoints" (`8-pass-3-finishes-in-minutes.test-plan.md:220`), but the dead-endpoint variables don't reach it.
   - **What a run does on this Mac.** The owner's `tapestry` container publishes `:7778`, so any run of the suite sends it at least `GET /api/assistant/pubkey`. The plan reports the suite as run: "9 of 9 (2 skipped)".
   - **Candidate.** An OPEN.md `meta` row: make the suite read `BRAINSTORM_BASE_URL` and `TAPESTRY_PORT`, and keep it off dead-endpoint lists until it does.
2. **Story 7's review (`engineering-team/reviews/graph-operations-foundation/7-cache-counts-cover-only-the-nodes-they-count.md:53`) says that derive-all and derive-status "don't reach the nodes `tapestry-keys` added".** The card sets carry `Set`, so they do. That claim let this story's bug through. Candidate: an erratum line on that review, or an OPEN.md `meta` row, so later readers don't lean on it.
3. **Amendment 1's prose went into the implementation commit (`ddd85135`), while its code went into the test commit (`43727117`).** So the Tester's change and its record sit in different roles' commits. A small thing, worth keeping together next time.
4. **No full gate on this Mac:** already OPEN.md row 294.

## Verdict
**PASS**

The fix does what the story asks, with changes local to the queries at fault.
- **Pass 3** rebuilds only the nodes with an address, and derive-status counts the same nodes.
- **Each rebuild** starts from its own node, so it no longer reads the graph.
- **Pass 3 on staging's shape** went from an estimated 14 days to 14 s.
- **The output** matches today's code's after one install, and after a second install the rebuilds still match today's queries.

Every acceptance criterion has a test that passes, run here on both graphs. The gaps above are in regression coverage and in the wording of the record. The code they concern was checked directly, so none of them blocks.

## Close-out (same commit)
- [ ] Story `**Status:**` set to `Done` in place. That is left to the session that commits this review, as its brief says.
- [ ] Completion detection was run, and its result is in the chat.

## Round 2

**Date:** 2026-11-15
**Diff:** `git diff 0392216d..81f533b9`. Two commits:
- `1aee3024`, the Tester's Amendment 2. It adds S6 and S7 (`test/pass-3-finishes-in-minutes.test.js:213–236`) and changes L5b's comment (`:485–487`). In the test plan it changes the guard list, the edge cases and Amendment 1's cause, and adds Amendment 2 and a correction of the Verification line on `event-tagging-firmware-seed`.
- `81f533b9`, the Implementer's round 1: the apply-enumerations comment (`src/api/normalize/index.js:6081–6083`), and the story's second Deviation (`8-pass-3-finishes-in-minutes.md:82`).

Each role kept to its own files. The Tester's commit touches only the plan and the suite. The Implementer's touches only the story and comment lines in one source file: in its diff of `src/`, every changed line is a comment.

### Gates, again
- [x] **The subset through the gate engine,** as in round 1, at `81f533b9`. `npm run gate:status -- --label reviewer-8-round2`:
  `20261115T232208Z-8671-09e9 [reviewer-8-round2] started 2026-11-15T23:22:08.483Z on 81f533b9+dirty — PASS, exit 0, 350 passed, 0 failed, 8 skipped, 4/4 suites`
  - The 350 are round 1's 348, plus S6 and S7. `pass-3-finishes-in-minutes` passes 8 of 8 stack-free.
  - `+dirty`: this review and the files the review commit will carry. Nothing under `src/` or `test/` had changed.
- [x] **Live, the small stack left from round 1** (two installs): **12 passed, 0 failed, 4 skipped** (L3, L4, L2b, L5b). Its control panel still runs the `src/` it loaded at boot, which differs from `81f533b9` only by one comment.
- [ ] **Staging's shape and L5b weren't run again.** No line of code changed. In the tests, L3 and L4 didn't change, and L5b changed only in its comment.

### The round-1 findings
1. **Non-blocking 1: fixed.** On the graph before `tapestry-keys`, S6 runs a rebuild by key and S7 runs derive-status. I tried five wrong fixes again, in a scratch copy of the code, with the amended suite:
   - **No fallback in `findByKey`:** S6 fails.
   - **derive-status counting only `TapestryNode` nodes,** written as `WHERE n:TapestryNode` or as `MATCH (n:${label}:TapestryNode)`: S7 fails in both forms.
   - **Both selections reading `uuid` only:** passes, as round 1 expected, since no node has an `id` and no `uuid`.
   - **The stamp put back as `MATCH (n {tapestryKey: $key})`:** passes stack-free. L3 catches it.

   The fix passes 8 of 8. The plan's lines 50 and 68 now say which test covers which path.
2. **Non-blocking 2: L5b's comment is fixed, but the plan's correction goes too far.**
   - **L5b's comment** (`:485–487`) is accurate. A second install comes out differently by itself, and save-schema's lookup by name is one cause.
   - **The plan** (`:104`, and Amendment 2 at `:128`) now says that "the cause is Pass 2's save-schema", and that "the second install's differences come from `POST /api/normalize/save-schema`". That holds for only some of the 24. Round 1's own wording led there.
     - Amendment 1's 24 came from the seeded stack's second install.
     - In that install, Pass 2 failed only for the five tag concepts. It enriched `nostr relay` without an error.
     - So save-schema's lookup accounts for five of the six schemas. It doesn't account for the `nostr relay` schema. Nor does it account for the two supersets that moved between `set-superset` and `superset-superset`, whose cause the save-schema ledger note itself calls unconfirmed.
   - **What holds for all 24** is round 1's argument: none of them goes through code the fix changes.

   Optional improvement: say "five of the six schemas", and leave the rest unexplained.
3. **Non-blocking 3: fixed.** The second Deviation (`8-pass-3-finishes-in-minutes.md:82`) is accurate:
   - before `tapestry-keys` nothing indexes the key: only the migration makes `tapestry_key` (`src/operations/catalog/lifecycle/_migrations.js:156`);
   - a rebuild by key makes one or two such reads, against three to five by the story's count;
   - Pass 3 doesn't use the lookup.
4. **Non-blocking 4: not taken, and I accept that.** It was optional. It protects only a deleted node's own cache entry, and today's code carries the same kind of risk.
5. **Non-blocking 5: fixed.** The comment (`normalize/index.js:6081–6083`) is accurate.
   - **On the small stack**, `EXPLAIN` plans the old query from a scan of `HAS_ELEMENT` (527 edges). It plans the new one from the `tapestry_node_uuid` index and a scan of `NostrEvent` (450 nodes). A fresh scratch stack has no `nostrEvent_uuid` index (`SHOW INDEXES`).
   - **On staging's shape**, both start from a relationship-type scan.

   "May start from" fits that.
6. **Non-blocking 6:** goes into the review commit, as the coordinator says.

### What the round's new text says that doesn't hold
All of these are in prose. None of them touches the code or its tests.
- **Amendment 2's first bullet** (plan `:115`) reads "Two of four wrong fixes passed every stack-free test". All four passed, and two of them matter.
- **The plan's Verification** (`:242`) and the pending note in `ledger/2026-11-14-harness-points-tests-at-agent-memory.md` say that the run sent the local instance three GETs, `/api/concept-graph/summaries` among them.
  - That call goes to `:8877`, and nothing listens there on this Mac. I read the socket table, without sending a request.
  - The suite's two skips fit its two `:8877` checks.
  - The owner's instance answers on `:7778`, through Colima's forwarder to the `tapestry` container. It received two GETs: `/api/assistant/pubkey` and `/api/strfry/scan`.
- **The pending erratum on story 7's review** (`7-cache-counts-cover-only-the-nodes-they-count.md:54`) says that derive-all "rebuilt staging's 370,377 card sets". It picked them. Staging's install stopped in ListHeader, before it reached Set, and derive-status read Set as 24 derived of 370,401 (story 8's Background). So none of them was rebuilt.

The last two are in files the review commit will carry. They are cheapest to correct before that commit.

### Round 2 verdict
**PASS**

The verdict stands for the code as it now is, at `81f533b9`. This round changed no line of code. Its two new tests close the gap round 1 found, and each fails the wrong fix it was written for. What is left is four statements in prose that don't hold.
