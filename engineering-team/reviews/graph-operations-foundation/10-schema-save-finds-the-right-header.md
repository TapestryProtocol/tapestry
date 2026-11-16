# Review: Story 10 — Saving a concept's schema never lands on another author's header

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-15 (the runs were between 02:10 and 02:33 UTC on 2026-11-16)
**Diff:** `git diff 33c5ce2f..HEAD` (HEAD `d4910cef`, branch `save-schema-by-address`; `33c5ce2f` is where the branch left `origin/staging`, and is still its merge base). Four commits:
- `4a11576c` the story;
- `d6aa1bdf` the failing tests;
- `639eaaf5` the fix;
- `d4910cef` the live verification, AC5's record and the new ledger row `2026-11-16-install-caches-lag-its-own-graph`.

This review re-ran or re-derived everything it relies on:
- the stack-free suites, through the gate engine;
- the new suite against the code before the fix;
- fifteen wrong fixes;
- the live suite, on a fresh scratch stack;
- the concept page's data path;
- the new ledger row's counts.

The session that wrote the code did not review it. `origin/staging` has moved on to `a282b2b7`. None of its new commits touches a file this diff changes, and `git merge-tree` merges the two without a conflict.

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`: not run.** On this Mac the full gate writes to the owner's private `tapestry` instance (OPEN.md row 294). The full gate comes from the pull request's CI.
- [x] **The stack-free suites that read a changed file, through the gate engine.**
  - **Which suites.** The plan's thirteen, less `create-concept-duplicate-check` (next item), plus this suite and `operations`.
  - **How they ran.** Through `test/helpers/gateRunner.js`, with a scratch `GATE_RECORD_DIR`. Every endpoint was dead: `BRAINSTORM_BASE_URL`, `TAPESTRY_PORT` and `MEILI_URL_HOST` at `127.0.0.1:9`, `TAPESTRY_CONTAINER=no-such-container`, and `BRAINSTORM_CONF_PATH` naming a conf with `NEO4J_URI=bolt://127.0.0.1:9`.
  - **A guard.** A preload in `NODE_OPTIONS`, which every child process inherits, refused and logged any TCP connection except to port 9 and to the ephemeral range (49152 and up). It logged none.
  - `npm run gate:status -- --label reviewer-10`:
    `20261116T021737Z-28028-3d89 [reviewer-10] started 2026-11-16T02:17:37.715Z on d4910cef — PASS, exit 0, 578 passed, 0 failed, 85 skipped, 14/14 suites`
  - **The counts** (skipped in brackets) are the plan's own, suite for suite: `schema-save-finds-the-right-header` 20 (2), `operations` 337 of 337 (G11 and G18 among them), structures-the-brain-can-trust 18 (6), pass-3-finishes-in-minutes 8 (8), capture-a-goal-and-see-it 21 (6), break-a-goal-into-pieces 23 (7), store-the-four-when-a-goal-is-captured-or-updated 29 (11), attach-the-world 21 (8), teach-it-what-matters 20 (7), the-proposal-loop 22 (11), the-brain-survives 23 (8), sessions-read-the-brain 20 (10), openapi-document 10, stack-free-npm-test 6 (1).
  - **An earlier record in the same directory reads FAIL** in `operations` (`20261116T021616Z-13764-cbc5 [reviewer-10-subset]`). It isn't a result of the code. My first guard refused every port but 9, so it refused the operations harness's own server (316 refusals, all to ports 63071–63202).
  - **The plan's recipe, exactly** (no `BRAINSTORM_CONF_PATH`), in a separate record directory: `20261116T022602Z-63242-48c2 [reviewer-10-noconf-probe] … PASS, exit 0, 578 passed, 0 failed, 85 skipped, 14/14 suites`. The guard refused nothing. So under the plan's recipe none of these suites opens a TCP connection on this Mac (Harness friction 1).
- [x] **`create-concept-duplicate-check` on its own, with `TAPESTRY_CONTAINER` unset.** It treats any other name as a live stack, and never falls back to `tapestry` (`test/create-concept-duplicate-check.test.js:31–32`). `npm run gate:status -- --label reviewer-10-ccdc`:
  `20261116T021858Z-38140-2447 [reviewer-10-ccdc] started 2026-11-16T02:18:58.736Z on d4910cef — PASS, exit 0, 3 passed, 0 failed, 3 skipped, 1/1 suites`
- [x] **The suite against the code before the fix.** I checked out `33c5ce2f`'s six changed `src/` and `ui/` files under HEAD's tests.
  - **The result:** 4 passed, 16 failed, 2 skipped. That is the plan's red run exactly, with S3a, S3b, S3g and S4f the four that pass.
  - **After:** the files were restored, and `git status` was clean.
- [x] **The UI parses.** No `ui/` toolchain is installed on this Mac (no esbuild, no vite).
  - **The parser.** TypeScript 5.8.3, already in the root `node_modules`, run from a scratch script for syntax only. The three UI files give 0 diagnostics each.
  - **A control.** A copy of `ConceptSchema.jsx` with one comma removed gives 1 diagnostic.
  - **S4b** also imports `ui/src/api/normalize.js` as an ES module, and runs it.
- [x] **Live, on a fresh scratch stack.** It booted from `SCRATCH_IMAGE=agent-memory-tapestry:latest` with this checkout's `src/` at 02:22 UTC, and was removed by 02:31.
  - **The boot's install.**
    - There is one install in the log, and Pass 2 reads `Pass 2 complete: 40 enriched, 0 skipped, 0 errors`.
    - The six community headers are present, at the manifest's addresses, and none has a schema. Each of the TA's six has one.
    - The stack has no `tapestry_key` rule.
  - **`TAPESTRY_CONTAINER=tapestry-scratch SCHEMA_SAVE_INSTALL=1`: 22 passed, 0 failed, 0 skipped.**
    - L1 passes.
    - L2 passes. The second install logs `40 enriched, 0 skipped, 0 errors`.
    - L2 prints nine differences, all in cached Tapestry JSON. Six are the TA's supersets of nostr relay, nostr user tag, set, tag pinning, tag and word. Three are the supersets of nostr user tag, tag pinning and tag under ADR 0015's literal.
    - It finds no difference in any schema's json tag or any superset's elements. Nostr relay's own schema came out the same.
  - **The concept page's data path, run as the page runs it.**
    - **How.** The header query is read out of `ConceptDetail.jsx`, and the schema query out of `ConceptSchema.jsx`; both go through `POST /api/neo4j/query`. The real client (`ui/src/api/normalize.js`) saves, with `fetch` routed into the container.
    - **The stack** has two headers named "tag": the community's and the TA's.
    - **The page's header row** carries the header's `tapestryKey`, in key form.
    - **The client** sent `concept`, `schema` and that key, from both the visual path and the raw one.
    - **Both saves** answered the schema node the page shows, with the fold `already-consistent`. The page showed the same schema after.
    - **Before `tapestry-keys`.** The same held with `TapestryNode` taken off the header. Real Neo4j ran the label-scan key lookup and the fold's `NostrEvent|TapestryNode` match. The label was then put back.
  - **`create-concept-duplicate-check`, live:** 5 passed, 1 skipped (H3 needs `CREATE_CONCEPT_REINSTALL=1`). H1 and H2 save a new concept's schema by name.
  - **Apply-enumerations, on its route.**
    - There are five `ENUMERATES` edges. Every target is the TA's own and has a key.
    - Four saved. The fifth (dog breeds) was skipped for "No elements found".
    - Each install's log reads 4 enumerations, as story 8's small stack did before this fix (`8-pass-3-finishes-in-minutes.md:27`).
  - **None of the edge cases in the findings occurs there.** No header has two schema nodes, every header has a key, and no key is held twice.
- [ ] **Not run, on purpose:**
  - `event-tagging-firmware-seed` calls `localhost:7778` directly. `brain-first-tapestry-authoring` writes to the `tapestry` container by default.
  - **The new row's "442 after a first install."** It needs a second fresh stack.
    - When I tried, `tapestry-scratch` already belonged to another session. Its `src/` is mounted from worktree `awesome-ramanujan-76c6f8`, and it was created at 02:31:24 UTC.
    - `scripts/scratch-stack.sh up` refused, and created nothing.
    - My only contact with that stack was one read-only `grep` of its log. I left it alone (Harness friction 2).
- [ ] **`npm run test:playwright`: not run.** The UI change passes one more field, and running the page in a browser on this Mac would need a dev UI pointed at an instance. The page's data path was run live instead (above).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence

- [x] **Every acceptance criterion has a passing test.** There is one gap in AC4 (Non-blocking 1) and one in AC5's record (Non-blocking 6).

| AC | Evidence |
|---|---|
| AC1, Pass 2 on the instance's own header | S1a, S1b and S1c, in both storage orders. Live, both installs' Pass 2 logged 0 errors, with all six community headers present. Pass 2 finds the header at `39998:<TA>:<slug>` (`src/firmware/install.js:917–922`), the form `readInstallState` uses (`src/api/firmware/index.js:138`), and names it by key (`:970`). |
| AC2, apply-enumerations | S2a, S2b and S2c, through the route Pass 3 calls (`install.js:1219`). The key comes from the header that the `ENUMERATES` edge's schema belongs to (`src/api/normalize/index.js:5990, 6287–6289`). Live: four saves, all by key. |
| AC3, a save by name | S3a, S3b and S3g give today's answers. S3c gives one answer in every order. S3d and S3e refuse and name the headers. S3f checks the fold. The code: `findSchemaHeader` (`normalize/index.js:1968–1983`), and the fold by address (`:2052, 2102–2117`). |
| AC4, the page and the key | S4a (source), S4b (client), S4c, S4d, S4e, S4f and S4g. Live: the page's own queries and the real client, above. One case of the second bullet isn't met as worded (Non-blocking 1). |
| AC5, a second install | L2, live: 0 Pass 2 errors, and the five tag schemas as the first install left them. The record is in the plan (`10-schema-save-finds-the-right-header.test-plan.md:175–181`), and the new row files the nine caches. The two differences the story names weren't tried on the stack shape where they were seen (Non-blocking 6). |

- [x] **No criterion is silently dropped.**
- [x] **No behaviour added beyond the story.**
  - **Each new behaviour is in the story's Deviations** (`10-schema-save-finds-the-right-header.md:93–102`):
    - the field;
    - the TA found by the signing key;
    - the label scan;
    - the no-event refusal;
    - the fold by address;
    - Pass 2 and apply-enumerations by key;
    - the page's key;
    - the bootstrap routes left by name;
    - the fixed choice among schema nodes.
  - **Checked against the code:** each holds, except the first Deviation's "more than one node" (Non-blocking 1).
  - **The eight bootstrap callers** are unchanged (`normalize/index.js:2593, 2874, 3202, 4919, 5090, 5334, 5466, 5575`).

## ADR adherence

There is no ADR: the owner chose the Standard bug path on 2026-11-15. The diff is judged against ADR `graph-operations-foundation/0003`.

- [x] **Decision 9, the label disjunction.** Pass 2's lookup and the fold's both match `NostrEvent|TapestryNode {uuid: …}` (`install.js:918`, `normalize/index.js:2103`). G11 and G18 pass.
  - **The label tests** are written `'NostrEvent' IN labels(…)` (`:1941–1942`), a form G18 itself lets through. They test whether a node came from an event, which is what they mean.
  - **The two name lookups** keep `MATCH (h:NostrEvent)` on a line of its own (`:1969, 2105`), and the existing kept entry covers that line.
    - That entry's reason says "a header is always an event". A10.16's event-less headers will make that untrue.
    - Here the name lookup is meant to see only headers that came from an event, so the line still belongs on the list.
  - `nostr-event-lookups-kept.json` is unchanged.
- [x] **Keys.**
  - **The form.** A key is checked against `KEY_PATTERN`, the graph operations' own form (`src/operations/catalog/graph/_nodes.js:11`).
  - **How keys are minted.** By `randomUUID()` in `keyNode` (`src/lib/tapestry-key-cypher.js:22–26`), or by `crypto.randomUUID()` in `initialize` (`src/api/tapestry-key/index.js:25–26, 133`). `{}` is the only placeholder the code knows.
  - So the 400 can't refuse a real key.
- [x] **Files and layering.** Each change stays where the story puts it:
  - the save route and its fold;
  - Pass 2's lookup;
  - apply-enumerations' save;
  - the page's query and the tab's two calls;
  - the client;
  - the route's documentation.
- [x] **Dependencies:** none added. `package.json` and `ui/package.json` are unchanged.

## Concept-graph integrity
- [x] **Handles:** `39998:<TA>:<slug>`, and the manifest's `communityReference` addresses, all in `kind:pubkey:slug` form. The story read them from the manifest (`10-…md:71`). They were confirmed on the scratch stack.
- [x] **Firmware:** no concept definition changed (`firmware/` is untouched), so no reinstall is needed.
- [x] **Orientation:** not applicable. The change reads headers by address and by key.

## Things tests can't catch
- [x] **No secrets.**
  - The suite's TA is derived from a test key, `'11'.repeat(32)` (`test/schema-save-finds-the-right-header.test.js:77–79`).
  - The community authors come from the manifest.
  - The diff's two full pubkeys appear only in the story's "Concepts touched" (`10-…md:69`).
- [x] **No debug logging, TODOs or commented-out code** were added under `src/` or `ui/`.
- [x] **Wrong fixes, tried in place.** Each was run against the whole suite stack-free, then restored with `git checkout --`. `git status` was clean after each.

| Wrong fix | Caught by |
|---|---|
| W1 the name lookup restricted to the TA's own headers | S3b, S3d, S3e |
| W2 prefer the TA's header, never refuse | S3d, S3e |
| W3 the fold left looking up by name | S3f |
| W4a Pass 2 sends only the name | S1c |
| W4b Pass 2 finds the header by name again, then sends its key | S1b, S1c |
| W5 apply-enumerations sends only the name | S2c |
| W6 no no-event refusal | S4f |
| W7 a key two headers hold takes the first | S4g |
| W8 the key lookup reads `:TapestryNode` | **nothing** (Non-blocking 2) |
| W9 the tab sends the header's address as `tapestryKey` | **nothing** (Non-blocking 3) |
| W10 the client sends `{}` | **nothing** (Non-blocking 3) |
| W11 no 400 for a value that isn't a key | **nothing** (Non-blocking 4) |
| W12 the no-event refusal checks only the header | **nothing** (Non-blocking 4) |
| W15 no `ORDER BY` in the header lookup | **nothing** (Non-blocking 4) |
| W17 the fold matches `:TapestryNode` only | **nothing** (Non-blocking 2) |

- [x] **Each refusal fails for its own reason.** I checked this with my own scenarios, run through the suite's child process. Each answered with no write and no published event:
  - a concept with no event, by key: 200, "has no event behind it";
  - the same concept by name: "not found";
  - a key two headers hold: "More than one node holds…";
  - `{}`: 400, "is not a tapestryKey";
  - a shared name: the error names both headers;
  - an unknown key: "No concept header has…".
- [x] **Error paths.**
  - A save that has found its header but can't sign still answers 500, as before.
  - One change: the TA is now read before the lookup (`normalize/index.js:1993`). So before `loadTAKey` has run, even a "not found" answers 500. That can happen only at startup.
- [x] **Concurrency:** out of scope, as the plan says (`:75`).
- [x] **Security.**
  - The key is validated before use, and passed as a parameter.
  - An invalid value is echoed back in a JSON error, on a route only the owner, an admin or a direct-local caller may call (`src/middleware/routeAccess.js:324`).
  - The page's query stays a read under the route's write check (`src/api/neo4j/queryPost.js:17`).
- [x] **Scope:** nothing beyond the story. The epic gains story 10's entry, and AC5 asks for the new row.

## House rules check
- [x] **Concept Graph API authority:** the handles were checked on a scratch stack, as above.
- [x] **Tooling:** no new lint, typecheck or build tooling. The TypeScript parser used for the parse check was already installed, and ran from a scratch script.
- [x] **TA pubkey:** no literal added.
  - The route reads its TA from its signing key (`normalize/index.js:1993`), and Pass 2 from `firmware.getTAPubkey()` (`install.js:921`). Both are found at runtime.
  - ADR 0015's `LEGACY_*` constants are untouched.

## Product-guide adherence
Not applicable: the story traces to no PRD.

## The new ledger row

I checked `ledger/2026-11-16-install-caches-lag-its-own-graph.md` on the scratch stack, with story 8's snapshot (`test/helpers/pass3Snapshot.js`):
- **Its line references** (`install.js:1198–1215`, `:1217`, `:1226`, `:1238`) are where 3a, 3b, 3c and the community-reference edges are.
- **"439 after a later one" holds.** A rebuild of the seven labels right after the second install changed the cached JSON of 439 of 448 nodes. It changed no schema's json tag (0 of 40) and no superset's elements (0 of 17).
- **"A second and a third install leave identical caches. So does an install that follows a rebuild" holds.** The third install (64 s, 0 Pass 2 errors) followed that rebuild, and matched the second exactly, with 0 differences in each part.
- **"A rebuild after any of them lands on the same state" holds.** A rebuild after the third install matched the rebuild after the second, with 0 differences.
- **The nine nodes** that L2 printed are the row's nine.
- **Not re-run:** "442 after a first install" (see Quality gates).
- **The row says which part is inferred:** the reason later installs lag too.

## Findings

### Blocking
None.

### Non-blocking

1. **`src/api/normalize/index.js:1956–1964`: a key that a concept header shares with a node that isn't a header is not refused, though the record says it is.**
   - **The code.** The key lookup reads only `ListHeader|ClassThreadHeader|ConceptHeader` nodes. It refuses when more than one of those holds the key.
   - **The record says more:**
     - AC4: "one that more than one node holds, changes nothing" (`10-schema-save-finds-the-right-header.md:59`);
     - the Deviation: "one that more than one node holds, answers `success: false`" (`:93`);
     - the documented contract (`src/api/openapi.yaml:1246–1247`);
     - the error's own words, "More than one node holds…" (`normalize/index.js:1963`);
     - the plan: "S4g refuses a key that isn't one node's" (`10-…test-plan.md:26, 71`). S4g lays the key on two headers only (`test/schema-save-finds-the-right-header.test.js:511–522`).
   - **Shown.** I laid the key of the TA's tag header on one `ListItem` as well. The save answered success, wrote 4 times and published 1 event.
   - **Why it doesn't block.**
     - The lookup can only land on the one concept header that holds the key. So the save still reaches the concept named "and no other".
     - Keys are random UUIDs, and none is shared on the scratch stack.
     - Counting every holder would scan the whole graph on an instance before `tapestry-keys`.
   - **Asked change.** Either:
     - make the record match the code ("more than one concept header") in openapi, the Deviation, the error and the plan, and put AC4's wording to the owner; or
     - count every node that holds the key.
2. **`test/schema-save-finds-the-right-header.test.js:120, 123`: no test sees the key path on an instance that hasn't run `tapestry-keys`, which is production's state.**
   - **The fixture.** Every fake node carries `TapestryNode` and a real key (plan `:83`).
   - **Two wrong fixes pass all 20 tests:**
     - W8, the key lookup written `MATCH (h:TapestryNode {tapestryKey: $tapestryKey})` (`normalize/index.js:1958`). It is a likely change, since that is the indexed form.
     - W17, the fold written `MATCH (h:TapestryNode {uuid: $headerUuid})` (`:2103`).
   - **Where they would break.**
     - **Which headers.** Step 1f stamps keys through `POST /api/tapestry-key/initialize` (`install.js:843–851`), and that route sets `tapestryKey` without the label (`src/api/tapestry-key/index.js:136–141`). So a header that no import since `keyNode` has touched can hold a key and no label.
     - **Under W8,** a save from that header's page answers "No concept header has the tapestryKey…".
     - **Under W17,** its fold reports an error.
     - **Pass 2 is spared.** Pass 1 re-imports the TA's headers, and the import labels them (`src/api/normalize/helpers.js:87`).
   - **The code is right.**
     - My own stack-free scenario uses a graph with no `TapestryNode`. A save by key landed on the TA's own schema, and the fold reconciled. With no keys at all, a save by name did the same. W8 and W17 each fail this scenario.
     - Live, the page path worked with the label taken off the header.
   - **Asked change (Tester, when convenient).** Add a stack-free check on a graph without `TapestryNode`, as story 8's S6 and S7 did. The plan's `:83` should then say which test covers which state.
3. **`test/schema-save-finds-the-right-header.test.js:424–456`: S4a and S4b don't pin what the page sends.**
   - **W9.** The tab sending `tapestryKey: concept.uuid` passes S4a, which checks only that the word appears in each call. At runtime every save from the page would answer 400.
   - **W10.** The client sending `{}` passes S4b, which has no `{}` case (`ui/src/api/normalize.js:44`). A page whose header holds `{}` would answer 400, where today it saves by name.
   - **The code is right.** Live, the page's own query gives the key, and the real client sends it (above).
   - **Optional improvement:**
     - S4a asserts `tapestryKey: concept.tapestryKey` in each call, and `h.tapestryKey AS tapestryKey` in the page's query;
     - S4b adds a `{}` case and an empty-string case.
4. **`src/api/normalize/index.js:1943, 1953–1955, 1997`: three of the Deviations' details have no test.**
   - **W11,** no 400 for a value that isn't a key, passes. S4g's `{}` is held by two headers, so the duplicate check refuses it first.
   - **W12,** the no-event refusal checking only the header, passes. S4f's schema node has no event either.
   - **W15,** no `ORDER BY`, passes. No fixture has a header with two schema nodes, and no refusal compares its message across storage orders.
   - The code was confirmed by reading it, and by the refusal reasons above. Optional: one fixture for each.
5. **`ui/src/pages/concepts/ConceptSchema.jsx:20–26`, `src/firmware/install.js:917–922, 975`: for a header with more than one schema node, the page and Pass 2's log may not name the schema the save writes.**
   - **The save** writes the header's first schema node by address (`normalize/index.js:1943, 1946–1950`).
   - **The tab** reads its schema with `LIMIT 1` and no order.
   - **Pass 2's log** names the node its own lookup found.
   - So AC4's "the schema saved is the one the page showed" holds when a header has one schema node. The scratch stack has none with two.
   - Optional: order the tab's read the same way, or say so beside the story's last Deviation (`10-…md:102`).
6. **`10-schema-save-finds-the-right-header.test-plan.md:177–178` (AC5's third bullet): the two differences the story names weren't tried where they were seen, and have no row of their own.**
   - **The two.** Nostr relay's schema, and the two supersets that moved between `set-superset` and `superset-superset` (`10-…md:30, 64`).
   - **Where they were seen.** Story 8 saw them on its seeded, staging-shaped stack's second install (`8-pass-3-finishes-in-minutes.test-plan.md:104`; story 8's review, `:222`).
   - **On a fresh stack,** story 8's review found neither, with the code before this fix (`engineering-team/reviews/graph-operations-foundation/8-pass-3-finishes-in-minutes.md:117`).
   - **This story tried fresh stacks only** (plan `:168`). So "didn't recur" says nothing about their cause, or about whether the fix removed them.
   - **The record.** AC5 says that a difference with another cause "gets a ledger row of its own".
     - The superset move appears only in the new row's "Not this row" note (`ledger/2026-11-16-install-caches-lag-its-own-graph.md:24`).
     - Nostr relay's schema appears only in the bug's own row (`ledger/2026-11-15-save-schema-finds-header-by-name.md:25`), which this story fixes.
   - **Asked change.** Before the bug's row closes, either:
     - file a row for the two, saying they were seen only on a seeded stack's second install, and not tried there since; or
     - run L2 on a stack seeded to staging's shape.

### Harness friction
1. **The dead-endpoint recipe doesn't kill Neo4j.**
   - **The recipe.** The plan's "How to run" (`10-…test-plan.md:96–99`) names no Neo4j endpoint at all. The suite's own `DEAD` env sets `NEO4J_URI=bolt://127.0.0.1:9` (`test/schema-save-finds-the-right-header.test.js:189`).
   - **The driver never reads it.**
     - `src/lib/neo4j-driver.js:33` takes its address from `getConfigFromFile`, which reads only the conf file (`src/utils/config.js:17–74`).
     - With no conf it falls back to `bolt://localhost:7687`, and the owner's `tapestry` container publishes 7687 on this Mac.
   - **It doesn't bite today.**
     - Under the recipe, the fourteen suites above opened no TCP connection at all (the guarded run).
     - This suite's child stubs the driver.
   - **Candidate.** An addendum to `ledger/2026-11-14-harness-points-tests-at-agent-memory.md`: the recipe adds `BRAINSTORM_CONF_PATH`, naming a conf with a dead `NEO4J_URI`, as story 8's review ran it.
2. **`scripts/scratch-stack.sh:35–36`: `down` removes `tapestry-scratch` by name, whoever booted it.**
   - **What happened.** Seconds after this review's `down`, another session's stack took the name. `up` then refused, as it should.
   - **The danger.** A `down` run at that point, as the brief's "always finish with down" says to, would have removed the other session's stack.
   - **Candidate.** An OPEN.md `meta` row. Either `down` checks that the container mounts this checkout's `src/` before removing it, or the name carries the worktree.
3. **No full gate on this Mac:** already OPEN.md row 294.

## Verdict
**PASS**

The fix does what the story asks, in the places the story names.
- **Pass 2** finds each firmware concept's header by its address, and names it by its key.
- **Apply-enumerations** names the header its schema belongs to.
- **A save by name** is never the database's choice. It reaches the one header with that name; among several, the TA's own; and otherwise it refuses, naming them.
- **The concept page** sends its header's key, and a concept with no event is refused.
- **On a fresh scratch stack,** a second install logs 0 errors in Pass 2, and the five tag schemas come out as the first install left them.

Every acceptance criterion has a test that passes, and each wrong fix the brief names fails at least one. What is left:
- regression coverage of the state before `tapestry-keys`, and of the value the page sends;
- a contract that says "node" where the code means "concept header";
- AC5's record of two differences seen only on a seeded stack.

The code those findings concern was checked directly, so none of them blocks.

## Close-out (same commit)
- [x] Story `**Status:**` set to `Done` in place, by the session that commits this review. Before committing, that session checked the findings' main claims against the sources. They are:
  - the key lookup counting headers only, while its error says "node";
  - `POST /api/tapestry-key/initialize` setting keys without the label;
  - story 8's fresh-stack result.
  It corrected one citation.
- [x] Completion detection: performed in the chat.

## Round 2

**Date:** 2026-11-15 (the runs were between 03:00 and 03:30 UTC on 2026-11-16)
**Diff:** `git diff cd6c375b..601575f1`. Two commits:
- `ab4722b3` (`impl:`) covers findings 1–5: the wording, the new and tightened tests, three `ORDER BY` lines, and the suite's dead conf.
- `601575f1` (`ledger:`) covers finding 6 and the harness friction: AC5's record, two new rows, and an addendum.

The two commits change nothing else. I checked each fix as a fresh claim, my own round-1 wording included. No scratch stack was used this round.

### Gates, again
- [x] **The fourteen stack-free suites, through the gate engine,** as in round 1. Endpoints were dead, `BRAINSTORM_CONF_PATH` named a dead conf, and the TCP guard was on; the guard refused nothing. `npm run gate:status -- --label reviewer-10-round2`:
  `20261116T031626Z-56295-ab03 [reviewer-10-round2] started 2026-11-16T03:16:26.198Z on 601575f1 — PASS, exit 0, 583 passed, 0 failed, 85 skipped, 14/14 suites`
  - The 583 are round 1's 578 plus the five new tests.
  - `operations` passes 337 of 337, G11 and G18 among them.
- [x] **`create-concept-duplicate-check` on its own, with `TAPESTRY_CONTAINER` unset:**
  `20261116T031739Z-63909-4741 [reviewer-10-round2-ccdc] started 2026-11-16T03:17:39.654Z on 601575f1 — PASS, exit 0, 3 passed, 0 failed, 3 skipped, 1/1 suites`
- [x] **The suite on its own:** 25 passed, 0 failed, 2 skipped. The temporary conf it writes is gone after the run.
- [x] **The new tests against round 1's code.** I checked out `cd6c375b`'s four changed `src/` and `ui/` files, ran the suite, and restored them: 24 passed, 1 failed.
  - Only S4a fails, on the tab's missing `ORDER BY`.
  - The other new tests guard behaviour that round 1's code already had.
- [x] **The UI still parses:** 0 diagnostics in each of the three files. The tab's new query is still a read under the route's write check.
- [ ] **Live: not run,** as the brief says. See "The `ORDER BY` lines" below.

### Wrong fixes, again
Each was applied in place, run against the whole suite stack-free, and restored with `git checkout --`. `git status` was clean after each.

| Wrong fix | Caught in round 1 by | Caught in round 2 by |
|---|---|---|
| W1 the name lookup restricted to the TA's own headers | S3b, S3d, S3e | S3b, S3d, S3e |
| W2 prefer the TA's header, never refuse | S3d, S3e | S3d, S3e |
| **W3 the fold left looking up by name** | S3f | **nothing** (Blocking 1) |
| W4a Pass 2 sends only the name | S1c | S1c |
| **W4b Pass 2 finds the header by name again, then sends its key** | S1b, S1c | **nothing** (Blocking 1) |
| W5 apply-enumerations sends only the name | S2c | S2c |
| W6 no no-event refusal | S4f | S4f, S4i |
| W7 a key two headers hold takes the first | S4g | S4g |
| W8 the key lookup reads `:TapestryNode` | nothing | S5a |
| W9 the tab sends the header's address as `tapestryKey` | nothing | S4a |
| W10 the client sends `{}` | nothing | S4b |
| W11 no 400 for a value that isn't a key | nothing | S4h |
| W12 the no-event refusal checks only the header | nothing | S4i |
| W12b the no-event refusal checks only the schema node | (not tried) | nothing (Non-blocking 9) |
| W15 no `ORDER BY` in the header lookup | nothing | S3d, S3e, S3h |
| W17 the fold matches `:TapestryNode` only | nothing | S5a, S5b |
| W18 the fold's new `ORDER BY` removed; W18b, reversed | (new line) | nothing (Non-blocking 7) |
| W19 Pass 2's new `ORDER BY` removed | (new line) | nothing (Non-blocking 7) |
| W20 the tab's read ordered `uuid DESC` | (new line) | nothing (Non-blocking 8) |
| W21 the tab's new `ORDER BY` removed | (new line) | S4a |
| W22 the header lookup takes the last schema node by address | (not tried) | S3h |
| W23 the page stops reading the header's key | (not tried) | S4a |
| W24 the client sends an empty key | (not tried) | S4b |
| W25 a value that isn't a key answers 200 | (not tried) | S4h |

### The round-1 findings
1. **Non-blocking 1: fixed.** The record now says "concept header" wherever the code counts concept headers:
   - AC4 (`10-schema-save-finds-the-right-header.md:59`);
   - the Deviation (`:93`);
   - `src/api/openapi.yaml:1246–1248`;
   - the error (`src/api/normalize/index.js:1963`);
   - the plan (`10-…test-plan.md:26, 76`) and S4g's title.

   Each matches the code. AC4's new note gives the reason, which I re-derived: a match on a key with no label can't use an index before `tapestry-keys`, so counting every holder would read every node. The note also records the owner's go-ahead at the review gate. That is the committing session's record, and I can't check it from the repo.
2. **Non-blocking 2: fixed.**
   - S5a and S5b lay the graph out with no `TapestryNode` label: with keys as `initialize` stamps them, and with no keys at all.
   - W8 now fails S5a, and W17 fails S5a and S5b.
   - The plan's Fixtures line says which test covers which state (`10-…test-plan.md:90`).
3. **Non-blocking 3: fixed.**
   - S4a pins `tapestryKey: concept.tapestryKey` in each call, and `h.tapestryKey AS tapestryKey` in the page's query. W9 and W23 fail it.
   - S4b adds the `{}` case and the empty case. W10 and W24 fail it.
   - One residue: Non-blocking 8.
4. **Non-blocking 4: fixed.**
   - S4h catches W11 and W25.
   - S4i catches W12.
   - S3d and S3e now require one answer in every storage order, and with S3h they catch W15. S3h also catches W22.
   - One mirror case is left: Non-blocking 9.
5. **Non-blocking 5: fixed in the code, and two of its three new lines cause Blocking 1.**
   - The save, the fold, Pass 2 and the tab now all take a header's first schema node by address, ascending. So the new Deviation's sentence (`10-…md:102`) holds by reading.
   - Only the tab's line has a test (S4a), and that test accepts a reversed order (Non-blocking 8). The fold's and Pass 2's lines have none (Non-blocking 7).
6. **Non-blocking 6: fixed, with two points of prose (Non-blocking 10 and 11).**
   - The plan's record no longer reads the fresh stacks as evidence about nostr relay's schema or the moved supersets (`10-…test-plan.md:189–193`).
   - The two are filed as `ledger/2026-11-16-seeded-second-install-differs.md`. Its settling procedure would test the right thing: seed after the boot's install, then run L2, comparing one stack's two installs.
   - The caches row's "Not this row" points there (`ledger/2026-11-16-install-caches-lag-its-own-graph.md:24`).
- **Harness friction 1: fixed.**
  - The addendum's claims hold: the driver reads the conf alone (`src/lib/neo4j-driver.js:33`, `src/utils/config.js:17–74`).
  - The suite's child now gets a dead conf (`test/schema-save-finds-the-right-header.test.js:209–212`). In that conf's form, `NEO4J_URI` reads back through `getConfigFromFile` as `bolt://127.0.0.1:9`.
  - The plan's recipe names `BRAINSTORM_CONF_PATH` (`10-…test-plan.md:98`).
  - The suite's dead env no longer sets `NEO4J_URI`. The only readers of that variable in `src/` are pipeline and maintenance scripts, none of them in the child's path, so nothing is lost.
- **Harness friction 2: filed,** as `ledger/2026-11-16-scratch-stack-down-removes-anyones.md`. Its claims hold:
  - `down` is `scripts/scratch-stack.sh:34–38`;
  - worktree `awesome-ramanujan-76c6f8` is on `fix/tapestry-keys-tx-memory`;
  - test plans do tell a session to run `down` afterwards (`engineering-team/stories/done/node-primitives/1-event-less-create-set.test-plan.md:91`; story 8's plan `:142`). The words "always finish with" are the review brief's.
- **Harness friction 3:** unchanged, OPEN.md row 294.

### The `ORDER BY` lines
- **The lines.** The fold's `ORDER BY schemaUuid, ppUuid` (`src/api/normalize/index.js:2116`), Pass 2's `ORDER BY schemaUuid` (`src/firmware/install.js:920`), and the tab's `ORDER BY uuid` (`ui/src/pages/concepts/ConceptSchema.jsx:25`).
- **They need no live check before merge, for their Cypher.** The same forms already run on real Neo4j:
  - the save's own `WITH … RETURN … ORDER BY headerUuid, schemaUuid` ran in round 1's L1 and on the page path;
  - an aggregating `RETURN` followed by `ORDER BY` on its aliases runs in the audit route (`src/api/audit/index.js:69, 71, 249`).
- **Still to run, when a scratch stack is free or at the first install on staging after merge:**
  - L1 and the page path;
  - an install's Pass 2 line, `40 enriched, 0 skipped, 0 errors`.

  None of the three lines has run on real Neo4j yet, and Pass 2's is on every install's path.

### New findings

#### Blocking
1. **`src/api/normalize/index.js:2116` and `src/firmware/install.js:920`, with the fixtures' authors (`test/schema-save-finds-the-right-header.test.js:82–86`): the new `ORDER BY` lines let two wrong fixes pass every test, and the round-1 brief named one of them.**
   - **What passes.** W3, the fold left looking up by name. W4b, Pass 2 finding the header by name, then sending its key. Each passes all 25 tests. Each also passes the whole fourteen-suite subset: 583 passed, 0 failed.
   - **What used to catch them.** In round 1, S3f caught W3, and S1b and S1c caught W4b. With the new lines taken out again, they still do: W3 fails S3f, S5a and S5b, and W4b fails S1b and S1c.
   - **Why.** Every other author in the fixtures sorts after the test's TA, `4f355bdc…`. That is `abab…` (`:86`), and the manifest's `82b75e47…` and `919ba08a…`. So among same-named concepts, the first by address is always the TA's own. A lookup by name that then orders by address lands on the right concept only by the fixtures' luck.
   - **What it would do on an instance,** where the TA's pubkey is random. My own scenario, through the suite's child process, adds an author whose pubkey sorts before the TA's (`00…`):
     - under W3, the fold read that author's concept (`already-consistent`), and left the TA's primary property behind the schema just saved;
     - under W4b, Pass 2 wrote the firmware's schema onto that author's schema node, and not onto the TA's.

     The real code does neither.
   - **What it leaves.**
     - AC3's fifth bullet (`10-…md:56`) no longer has a test that fails when it regresses.
     - AC1 has none for W4b. W4a, sending only the name, is still caught, by S1c.
     - Round 1's PASS rested on each wrong fix the brief names failing a test (`:288`). For W3 that no longer holds.
   - **The code is right.** The fold reconciles the header the save found (`src/api/normalize/index.js:2052`), and Pass 2 finds the header by its address (`src/firmware/install.js:917–923`). The gap is in the fixtures.
   - **Asked change (Tester).** Make "first by address" and "the instance's own" disagree in the fixtures. Either:
     - add an author whose pubkey sorts before the TA's to S3f, S5a and S5b, and to S1b or a case beside it; or
     - run the order-sensitive tests twice, under a TA that sorts first and under one that sorts last.

     Then show W3 and W4b failing again.

#### Non-blocking
7. **`src/api/normalize/index.js:2116`, `src/firmware/install.js:920`: the fold's and Pass 2's new ordering have no test.**
   - W18 (the fold's `ORDER BY` removed), W18b (reversed) and W19 (Pass 2's removed) pass every test.
   - No fixture has a header with two schema nodes and a primary property. Pass 2's choice shows only in its log line (`:976`).
   - So the new Deviation's "reconciled" and "logged" (`10-…md:102`) hold by reading only.
   - Optional: give S3h a primary property, and assert the fold reconciled against the schema node that was saved.
8. **`test/schema-save-finds-the-right-header.test.js:472`: S4a's check accepts `ORDER BY uuid DESC`.** W20 passes. The tab would then show a header's last schema node, not the one the save writes. Optional: require ascending order.
9. **`src/api/normalize/index.js:1997`: the header half of the no-event refusal is only tested together with the schema half.** W12b, which checks only the schema node, passes. S4f's schema node has no event either, and S4i's header has one. Optional: a fixture with an event-less header and a schema node from an event.
10. **`10-schema-save-finds-the-right-header.test-plan.md:192`: "Nothing writes nostr relay's schema except the save" isn't so.**
    - Pass 1 calls create-concept with `overwrite: true` (`src/firmware/install.js:173–180`), and create-concept rebuilds the schema node on every install (`src/api/normalize/index.js:1345–1346`, its section "3. JSON Schema").
    - The new row says this correctly (`ledger/2026-11-16-seeded-second-install-differs.md:10`).
    - The plan's point still holds: Pass 2's save is the last writer, since no enumeration targets nostr relay. Optional: say that instead.
11. **`ledger/2026-11-16-seeded-second-install-differs.md:9`: "differed from the first install's" is an inference.**
    - Story 8 compared the seeded stack, after its second install, with a baseline taken on another, fresh stack after one install (`8-pass-3-finishes-in-minutes.test-plan.md:94, 102–104`).
    - The row's own "it may need the seeded shape" allows for that.
    - Optional: say what story 8 compared.
12. **`src/api/normalize/index.js:2116`: the fold's ordering also changes the standalone `POST /api/normalize/reconcile-primary-property`.**
    - Given no `headerUuid`, its lookup by name now takes the same-named header whose schema node sorts first by address. Before, it took the database's choice.
    - The route is out of scope (`10-…md:75`). The change is deterministic, and no worse than before. It is noted here because it's a change to that route.

### Harness friction, round 2
4. **The new tests and the code they guard arrived in one `impl:` commit (`ab4722b3`).**
   - So no recorded run shows the new tests failing first. Against round 1's code, only S4a fails.
   - The fold's and Pass 2's new lines went in with no test that fails without them, and that is how Blocking 1 got through.
   - As in story 8's harness friction 3: the Tester's change belongs in a commit of its own, run red first.

### Corrections to round 1
- My citation at line 63, `8-pass-3-finishes-in-minutes.md:27`, means story 8's review (`engineering-team/reviews/graph-operations-foundation/8-pass-3-finishes-in-minutes.md:27`). It has the same ambiguity the committing session corrected at line 253.
- Round 1's "each wrong fix the brief names fails at least one" held for round 1's code. At `601575f1` it doesn't hold for W3 (Blocking 1).

### Round 2 verdict
**CHANGES_REQUESTED**

Every finding and harness friction from round 1 is addressed, and each fix holds when re-derived, apart from the smaller points above. One new issue blocks.
- **What it is.** Two of the round's new `ORDER BY` lines, in fixtures where the TA always sorts first, leave the suite unable to see a fold, or a Pass 2, that finds its header by name.
- **What is asked.** The code is right. The ask is a fixture change, and a re-run of W3 and W4b.

This round edits no other file, so it leaves the story's status line as round 1's verdict set it, Done. Whether that stands until the fix lands is for the session that commits this review. That session set it back to In Progress.

## Round 3

**Date:** 2026-11-15 (the runs were between 03:35 and 03:49 UTC on 2026-11-16)
**Diff:** `git diff bb3e0016..f8d237bf`. Two commits:
- `8f8ff515` (`test:`) changes only the suite. It answers Blocking 1 and Non-blocking 7, 8 and 9.
- `f8d237bf` (`docs:`) changes the story, the plan and two ledger rows. It answers Non-blocking 10, 11 and 12, and adds the coverage map and a record of the rounds' wrong fixes.

`src/` and `ui/` are unchanged since `601575f1` (`git diff --stat 601575f1..f8d237bf -- src ui` is empty). I checked each fix as a fresh claim: the coordinator's wording, the commits' wording, and my own round-2 asks.

### Gates, again
- [x] **The fourteen stack-free suites, through the gate engine,** as in rounds 1 and 2. Endpoints were dead, `BRAINSTORM_CONF_PATH` named a dead conf, and the TCP guard was on; the guard refused nothing. `npm run gate:status -- --label reviewer-10-round3`:
  `20261116T034429Z-16384-161e [reviewer-10-round3] started 2026-11-16T03:44:29.559Z on f8d237bf — PASS, exit 0, 584 passed, 0 failed, 85 skipped, 14/14 suites`
  - The 584 are round 2's 583 plus S1e.
  - `operations` passes 337 of 337, G11 and G18 among them.
- [x] **`create-concept-duplicate-check` on its own, with `TAPESTRY_CONTAINER` unset:**
  `20261116T034538Z-17373-ded0 [reviewer-10-round3-ccdc] started 2026-11-16T03:45:38.018Z on f8d237bf — PASS, exit 0, 3 passed, 0 failed, 3 skipped, 1/1 suites`
- [x] **The suite on its own:** 26 passed, 0 failed, 2 skipped, as the plan (`10-…test-plan.md:205`) and the commit say. The new load-time order check holds: `00…` sorts before the TA (`4f355bdc…`), which sorts before `abab…` (`test/schema-save-finds-the-right-header.test.js:92–93`).
- [x] **Live, on a fresh scratch stack.**
  - **Before `up`:** `docker ps -a --filter name=tapestry-scratch` showed none.
  - **The stack:** booted from `SCRATCH_IMAGE=agent-memory-tapestry:latest`, 03:44:25–03:46:05 UTC.
  - **Before any check and again before `down`,** `docker inspect` showed it mounting this worktree's `src/`. It was removed at 03:48:23.
  - See "Live" below for what ran on it.
- [x] _Lint, typecheck and build: not configured._

### Wrong fixes, again
Each was applied in place, run against the whole suite stack-free, and restored with `git checkout --`. `git status` was clean after each. Every failure below is the test's own assertion; none is the fake graph failing to run a query.

| Wrong fix | Caught in round 2 by | Caught in round 3 by |
|---|---|---|
| W1 the name lookup restricted to the TA's own headers | S3b, S3d, S3e | S3b, S3d, S3e |
| W2 prefer the TA's header, never refuse | S3d, S3e | S3d, S3e |
| W3 the fold left looking up by name | nothing | S3f, S5a, S5b |
| W4a Pass 2 sends only the name | S1c | S1c |
| W4b Pass 2 finds the header by name again, then sends its key | nothing | S1b |
| W5 apply-enumerations sends only the name | S2c | S2c |
| W6 no no-event refusal | S4f, S4i | S4f, S4i |
| W7 a key two headers hold takes the first | S4g | S4g |
| W8 the key lookup reads `:TapestryNode` | S5a | S5a |
| W9 the tab sends the header's address as `tapestryKey`, in both saves | S4a | S4a |
| W9b the same, in the raw-mode save only | (not tried) | S4a |
| W10 the client sends `{}` | S4b | S4b |
| W11 no 400 for a value that isn't a key | S4h | S4h |
| W12 the no-event refusal checks only the header | S4i | S4i |
| W12b the no-event refusal checks only the schema node | nothing | S4i |
| W15 no `ORDER BY` in the header lookup | S3d, S3e, S3h | S1e, S3d, S3e, S3h |
| W17 the fold matches `:TapestryNode` only | S5a, S5b | S5a, S5b |
| W18 the fold's `ORDER BY` removed; W18b, reversed | nothing | S3h |
| W19 Pass 2's `ORDER BY` removed | nothing | S1e |
| W20 the tab's read ordered `uuid DESC` | nothing | S4a |
| W21 the tab's `ORDER BY` removed | S4a | S4a |
| W22 the header lookup takes the last schema node by address | S3h | S1e, S3h |
| W23 the page stops reading the header's key | S4a | S4a |
| W24 the client sends an empty key | S4b | S4b |
| W25 a value that isn't a key answers 200 | S4h | S4h |
| W26 the name rule takes the first header by address | (not tried) | S3d, S3e, S3f, S5b |
| W29 Pass 2 finds its header by name among the TA's own headers, ordered by address | (not tried) | nothing (Non-blocking 13) |

The plan's new record of what catches each wrong fix (`10-…test-plan.md:199–224`) matches these runs, row for row.

### The round-2 findings
1. **Blocking 1: fixed.**
   - **The fix.** An author whose addresses sort before the TA's, `EARLY` (`00…`), is now in S1b, S3f, S5a and S5b, in all six storage orders. A check at load time keeps the order `EARLY` < TA < `OTHER` (`test/…:92–93`).
   - **W3 now fails S3f, S5a and S5b.** Under W3 the fold read EARLY's concept, whose schema is still the starter, and reported `not-applicable`.
   - **W4b now fails S1b.** Under W4b, Pass 2 saved nothing on the TA's own schemas.
   - So AC3's fifth bullet and AC1 again have tests that fail when they regress, with address order and identity kept apart.
   - W26, a name rule that takes the first header by address, also fails four tests.
2. **Non-blocking 7: fixed.**
   - S3h gives the header a primary property. W18 and W18b fail it: the fold read the second schema node, which still holds the starter.
   - New S1e has Pass 2 save on the first node and checks that its log names that node. W19 fails it, and so do W15 and W22.
3. **Non-blocking 8: fixed.** S4a's check now rejects `DESC`, in any case (`test/…:509`). W20 fails it, and W21 still does.
4. **Non-blocking 9: fixed.** S4i covers each half of the check on its own (`test/…:614–621`), and W12 and W12b each fail it.
   - The catch is on the key path.
   - By name, an event-less header isn't found at all, so the answer is today's "not found".
5. **Non-blocking 10: fixed.** The plan now says that Pass 1 rebuilds every schema node on each install, and that Pass 2's save is the last to write nostr relay's (`10-…test-plan.md:193`). Both hold:
   - Pass 1 calls create-concept with `overwrite: true` (`src/firmware/install.js:173–180`);
   - create-concept rebuilds the schema node (`src/api/normalize/index.js:1345–1346`);
   - no enumeration targets nostr relay.
6. **Non-blocking 11: fixed.**
   - **The row** (`ledger/2026-11-16-seeded-second-install-differs.md:1, 9–14`) now says story 8 compared the seeded stack with its baseline, taken on another, fresh stack. It also says that "differed from that stack's own first install" is an inference.
   - **That matches story 8's plan** (`8-pass-3-finishes-in-minutes.test-plan.md:94, 102–104, 109`).
   - **The caches row's "Not this row"** (`ledger/2026-11-16-install-caches-lag-its-own-graph.md:24`) says the same.
7. **Non-blocking 12: fixed.** The new Deviation (`10-…md:103`) describes the standalone route as the code has it (`src/api/normalize/index.js:2102–2117`).
   - Live, the route asked for "tag" by name chose the TA's own primary property, and answered `already-consistent`.
   - The community's "tag" header on the stack has no schema node, so its row sorts last.
- **Harness friction 4: followed.**
  - The tests came in a commit of their own (`8f8ff515`, the suite only), ahead of the docs, and this round changed no code.
  - They guard code that is already right, so their red run is the wrong fixes above.

### Live
All on the fresh scratch stack above, this worktree's `src/`, real Neo4j:
- **The boot's install.** One install in the log, and `Pass 2 complete: 40 enriched, 0 skipped, 0 errors`. Pass 2's new `ORDER BY schemaUuid` lookup ran there for each of the 40 concepts.
- **`TAPESTRY_CONTAINER=tapestry-scratch SCHEMA_SAVE_INSTALL=1`: 28 passed, 0 failed, 0 skipped.**
  - L1 and L2 pass.
  - The second install logs `40 enriched, 0 skipped, 0 errors`, 4 enumerations and 90 implicit elements, as the first did.
  - L2 prints the same nine cached-JSON differences as in round 1, and nostr relay's own schema came out the same.
- **The page path, run as the page runs it** (round 1's method).
  - The tab's read now has its `ORDER BY uuid`.
  - Both saves sent the header's key, landed on the schema node the page shows, and the page showed it unchanged after.
  - This held with `TapestryNode` taken off the header too, and the label was put back.
- **A header with two schema nodes, on real Neo4j.**
  - **The setup.** I gave the TA's `tag` header a second schema node, at an address that sorts before the real one (`39999:<TA>:tag-a-reviewer-probe-schema`), and saved by key a schema with one extra field.
  - **The save** answered that first node.
  - **The fold** reported `reconciled` against it: the primary property gained the field.
  - **The tab's read and Pass 2's lookup,** each run with its text read from its file, both picked that node.
  - **The real schema node** was left untouched.
  - **Cleanup.** The extra node and its tags were then deleted.

  So the story's Deviation holds on real Neo4j: such a header is saved, reconciled, logged and shown on the same schema node (`10-…md:102`).

That covers what round 2 left still to run: the three `ORDER BY` lines on real Neo4j, and Pass 2's line.

### New findings

#### Blocking
None.

#### Non-blocking
13. **`test/schema-save-finds-the-right-header.test.js:309–321` (S1c): the TA's twin header sorts after the firmware header. So a Pass 2 that finds its header by name among the TA's own headers, ordered by address, passes.**
    - **W29 passes all 26 tests.** It keeps Pass 2's `ORDER BY schemaUuid`. S1c's twin, `tag-made-by-hand`, sorts after `tag`, so the first by address is the firmware header by the fixture's luck. That is round 2's mechanism, for the TA's own twin.
    - **My own scenario** gives the twin a d tag that sorts first, `a-tag-twin`. Under W29, Pass 2 wrote the firmware's schema onto the twin and not onto `39998:<TA>:tag`. HEAD wrote it on the firmware header.
    - **Why it doesn't block.**
      - AC1's Given is another author's header, and S1b now tests that both ways round.
      - The twin is the plan's own edge case (`10-…test-plan.md:74`).
      - It needs two same-named headers of the TA's own, which create-concept's duplicate check refuses.
      - W29 isn't any earlier version of the code.
    - **Optional improvement:** give S1c's twin a d tag that sorts before the slug, such as `a-tag-made-by-hand`, and show W29 failing.

#### Harness friction
None new.

### Round 3 verdict
Every finding from round 2 is fixed, and each fix holds when re-derived.
- **The suite** again sees a fold, or a Pass 2, that finds its header by name, with address order and identity kept apart.
- **Each wrong fix the briefs named fails a test.**
- **Live, the round's three `ORDER BY` lines ran on real Neo4j.** Pass 2's line read `40 enriched, 0 skipped, 0 errors` on both installs, and a header with two schema nodes was saved, reconciled, picked and shown on the same node.
- **What is left** is Non-blocking 13, an edge case outside the acceptance criteria.

The story's `**Status:**` is `In Progress`, from round 2. This round edits no other file, so marking it Done is left to the session that commits this review. Round 3 supersedes round 2's verdict.

**PASS**

### Close-out, after round 3
- Non-blocking 13 was taken up after this round, test-only, in `7e04a206`: S1c's twin's d tag now sorts both before the slug and after it, and W29 fails S1c. The suite reads 26 passed, 0 failed, 2 skipped, and nothing under `src/` or `ui/` changed.
- The story's status line is set to Done in the commit that adds this round.
- Completion detection: book `graph-operations-first-slice` is far from complete (its acceptance frame still needs the brain rebuild and the race), so no book close is offered.
