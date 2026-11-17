# Review: Story 8 — `graph search`, concepts and elements found by the words in their names and fields, best first, each match with the field it matched in and a passage, from a point of view

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-17 (the gate runs below are stamped 2026-11-17 UTC)
**Diff:** `git diff origin/staging...A10.8-search`, with origin/staging at `b51a2507`, the merge base at `090c848e` and HEAD at `cbadba75`. 20 files, +2457 −22, in six commits:
- the Tester's `1c8725ed`: the plan, the failing tests, the fakes' new routes and the seed;
- two Tester corrections: `42e1b381` (`search-not-ready` is 409, ADR 0008 Amendment 1) and `7f41d840` (the node-site guard reads a typed index as an index, G20);
- the Implementer's `8cec22b7` (the code, the docs and the Deviations) and `3c22acd7` (the change the live check forced);
- `cbadba75`, the Evidence.

The story and the ADR merged to staging earlier, as PR #119. Since then staging has added only two ledger files, and the branch merges onto it cleanly (`git merge-tree`).

## Quality gates (run by reviewer, not trusted)

- [ ] **The scoped gate, as briefed: FAIL, in `test/operations.test.js` only. The failure is the recipe's, not this change's.** The gate ran 65 suites through `test/helpers/gateRunner.js`, every endpoint at a dead port: the 60 under `test/operations/`, plus `operations.test.js`, `external-cli.test.js`, `openapi-coverage.test.js`, `admin-action-sweep.test.js` and `schema-save-finds-the-right-header.test.js`. `npm run gate:status -- --label a10-8-review`:

  `20261117T131129Z-37746-5cd5 [a10-8-review] started 2026-11-17T13:11:29.213Z on cbadba75 — FAIL, exit 1, 1483 passed, 193 failed, 10 skipped, 65/65 suites; failed: operations`

  - **64 of the 65 suites pass**, among them:

    | Suite | Result |
    |---|---|
    | `test/operations/graph/search.test.js` | 34 / 34 |
    | `test/operations/search-index.test.js` | 7 / 7 |
    | `test/operations/graph/search-agent-through-cli.test.js` | 2 / 2 |
    | `test/operations/graph-fake.test.js` | 31 / 31 (F1–F30, F4b) |
    | `test/operations/lifecycle/tapestry-key-paths.test.js` | 20 / 20 (G1–G20) |
    | `test/external-cli.test.js` | 53 / 53 |
    | `test/openapi-coverage.test.js` | 13 / 13 |
    | `test/admin-action-sweep.test.js` | 9 / 9 |
    | `test/schema-save-finds-the-right-header.test.js` | 26 passed, 2 skipped |

    The 60 suites under `test/operations/` sum to 763 passed, 0 failed, 4 skipped. That equals the Implementer's record, which the story's Evidence quotes and `gate:status` still reads: `20261117T060733Z-68282-73b4 [a10-8-impl-final] … on 3c22acd7 — PASS, exit 0, 763 passed, 0 failed, 4 skipped, 60/60 suites`. Only the Evidence changed after `3c22acd7`.
  - **Which suite fails.** `operations.test.js`: 619 passed, 193 failed, 4 skipped. Every failure is an ENOENT on a suite's own temporary graph file, or, in the agent suites, "No key file at …/agent.key".
  - **Why it fails.**
    - `runGate` loads every suite before any runs, and runs them all in one process (`gateRunner.js:10`, `:157–160`).
    - `operations.test.js` then `require`s the same files again (`test/operations.test.js:1161`). They are already cached, so each one's `run()` is called a second time.
    - Suites keep their seeded graph or key at module level: `add-relationship.test.js:39–43`, `graph/search.test.js:143–145` and `graph/search-agent-through-cli.test.js:87–89`, among others.
    - `graphOpsSuite`'s one shared `cleanup()` removes every temporary folder at the end of each run (`test/helpers/graphOpsSuite.js:35–37`, `:189`). So the second run reads files that are gone.
  - **Why it isn't this change's.** I didn't replace the record. The runs below diagnose it.
    - **The same 65-suite command on the merge base** (`git archive 090c848e` into the scratchpad, which is why the record says "unknown commit"): `20261117T132323Z-44697-33a7 [a10-8-review-base] started 2026-11-17T13:23:23.883Z on an unknown commit — FAIL, exit 1, 1392 passed, 188 failed, 10 skipped, 62/62 suites; failed: operations`.
      - Inside the aggregate, 25 suites fail there. They fail with the same counts at HEAD.
      - HEAD adds only the two new search suites to them, failing the same way: search 3 and the agent 2, so 188 + 5 = 193.
    - **`node test/operations.test.js` alone**, with the same dead endpoints:
      - HEAD: 812 passed, 0 failed, 4 skipped;
      - the merge base: 764 passed, 0 failed, 4 skipped.
      - The difference, 48, is this story's new tests: SR1–SR34, XI1–XI7, SX1–SX2, F27–F30 and G20.
    - **CI isn't affected.** The full `npm test` registry lists `operations.test.js` and none of the suites it runs (`test/registry.js:392`), so CI runs each of them once.
- [ ] **The full gate has not run.** The full `npm test` must not run on this Mac, because the local stack is the owner's agent-memory instance. It runs in the pull request's CI. **This verdict holds only together with that run: it must be green before the merge.**
- [x] **The fakes change no other suite's answers.** Between the two gate records, per-suite counts are identical for 59 of the 65 suites. The six that differ are this change's own:
  - `graph-fake` 27 → 31 (F27–F30);
  - `tapestry-key-paths` 19 → 20 (G20);
  - the three new suites;
  - the aggregate's double run, above.

  Outside `test/operations/`, three suites load the changed helpers, and all three ran: `schema-save-finds-the-right-header` (through `pathCypherFake`), `external-cli` (through `externalCliServer`) and `operations.test.js` (through `operationsHarness`). Five more matched a search for the helpers' names only through an identifier, `conceptGraphSlug`, and load none of them.
- [x] **The tests catch broken code.** I made 28 changes, one at a time, to an export of HEAD outside the worktree, then ran the search suite, or the index suite for the hook's changes. The unchanged export passed 34/34 and 7/7. 27 of the 28 changes failed the tests:

  | Change (one at a time) | Failed |
  |---|---|
  | the word section read whole | SR8 |
  | JSON keys taken as texts | SR3 |
  | the every-word tier left out of the order | SR13 |
  | the tapestryKey tie-break reversed | SR13 |
  | the point of view not applied | SR21, SR23, SR24 |
  | `leftOut` counted on the page only | SR21, SR24 |
  | `complete` with `<` for `<=` | SR29 |
  | the bound not cut to 5,000 | SR29 |
  | the passage's lead `…` not counted (201 characters) | SR11 |
  | the passage starting at the word | SR11 |
  | no plural or singular forms | SR7 |
  | stop words never left out | SR6 |
  | `kind=set` keeping a Set with no address | SR18 |
  | change entries not filtered out of S1 | SR4, SR14, SR21, SR22, SR24 |
  | an index still filling searched | SR27 |
  | the cursor's scope without the point of view | SR16 |
  | the last of the tied texts for the passage | SR10, SR11 |
  | a match's concepts left unsorted | SR9 |
  | a superset taken as a concept | SR20 |
  | `every` true when some word is held | SR13 |
  | `offloaded` always 0 | SR28 |
  | list values (headings) not read | SR10 |
  | the description tag not read | SR10 |
  | the hook not comparing the analyzer | XI3 |
  | the hook comparing properties in order | XI2 |
  | the hook not retrying start-up errors | XI5 |
  | the hook ignoring an equivalent index under another name | XI4 |
  | **a field one level down in an object not read** | **none** (non-blocking 2) |
- [ ] `npm run test:playwright`: not applicable, since search has no UI.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] **AC1, words find concepts and elements.**
  - **How.** S1 reads the index and joins each tag hit to its node (`search.js:45–57`). The check keeps a node only when one of its texts, its name, its description tag or a value in its JSON, holds a word or a word's form (`_search.js:110–129`, `:169–199`).
  - **The tests:**
    - whole words, whatever the case (SR2);
    - a field's name is no match, and isn't counted (SR3);
    - tag nodes, change entries and a word only in a d tag are never answered (SR4);
    - no match gives an empty list (SR5);
    - stop words, and Lucene's syntax in `q` (SR6);
    - plurals (SR7);
    - the word section's boilerplate is no text (SR8).
  - **Nothing to set up.** The boot hook makes the index (XI1).
  - **One gap.** "A concept's plural" has no test (non-blocking 2), though the code handles it.
- [x] **AC2, each match with where it matched.**
  - The five facts, the kind by resolve's rule, the concepts by S2, the field, a passage of at most 200 characters, and the words (SR9–SR11, SX1).
  - A field longer than 200 characters is never answered whole (SR11).
  - No walk is packaged (Decision 8), so no match has a path (SR12).
- [x] **AC3, best first, a page at a time.**
  - The order: every word first, then the score, then the tapestryKey (SR13).
  - Paging: pages answer every match once (SR14); a cursor from another list is refused (SR16); a match added between pages (SR17); the defaults and the maximum (SR29).
  - One edge breaks the first tier: a `q` holding a word and its own plural or singular (non-blocking 1).
- [x] **AC4, narrowed by kind or by concept.**
  - `kind`: SR18.
  - `concept`, through the class thread, with list-elements' walk: SR19 and SX2.
  - The refusals: SR20.
- [x] **AC5, from a point of view.**
  - The owner's by default (SR21).
  - `everyone`, the owner's own pubkey, a stranger's pubkey and a malformed one (SR22).
  - Nothing stored: SR23 changes a score with no write between, and the answer changes.
  - No scores yet (SR24).
  - `kept` and `leftOut` cover the whole list, the page of one included (SR21).
- [x] **AC6, what it refuses.**
  - `q`: SR25. An unknown input: SR26. The index not ready: SR27.
  - `limit` (SR15), the cursor (SR16), `kind` (SR18), `concept` (SR20) and `pov` (SR22).
  - Each refusal names its input and says in words what was wrong.
- [x] **AC7, a read behind sign-in that agents can use.**
  - Offloaded JSON (SR28) and the bound (SR29).
  - 401 for a visitor, 403 for a stranger, and an admin gets what the owner gets (SR30).
  - It writes nothing (SR31).
  - The command answers what the route answers (SR32).
  - The list entry and `/docs` (SR33), and the docs' wording (SR34).
  - The boot hook (XI1–XI7), and the agent through the external CLI (SX1–SX2).
  - The live check covers the real Lucene analyzer, the timings (71–212 ms medians, all under a second), the upgrade with the graph's counts unchanged, and a real offload (note 7).
  - `POST /api/neo4j/query` is untouched: nothing under `src/api/` changed.
- [x] **No criterion is silently dropped.** AC2's walk part is the ADR's decision (Decision 8), and SR12 pins it.
- [x] **No behavior beyond the story.** `words`, `complete` and `offloaded` are ADR 0008's (Decisions 2, 5 and 6).
- [x] **The six Deviations are each true:**
  1. 409 (`search.js:30`, with the 4xx rule at `declaration.js:169`);
  2. the guard reads typed indexes as indexes (`cypherSites.js:246`);
  3. a passage near the end of its text starts earlier (`_search.js:139`);
  4. a match's concepts with no name come last (`search.js:78`);
  5. `textProblem`'s words, the same at resolve (`resolve.js:121–122`);
  6. `not-a-concept`'s two messages (`search.js:96–99`).

  One rule isn't recorded among them (non-blocking 3).

## ADR adherence

- [x] **The files match the Implementation notes.**
  - New: `src/lib/graph-search-index.js`, `_search.js` and `search.js`.
  - Shared:
    - one call in `bin/control-panel.js`, beside `ensureChangeIndexesOnBoot`, with the same arguments, not awaited;
    - `kindOf` taken out of resolve, behaviour unchanged, since `nodeOf`'s address is null exactly when `kindOf`'s test fails (`reads.js:207–213`);
    - C1's comment in `reads.js`;
    - the catalog's Paging bullet and §1 row.
  - The exports are the ones the notes list, plus helpers.
- [x] **The statements are Decision 4's.**
  - S1, read clause by clause, is the ADR's text, with `<kind>` and `<concept>` filled as Decision 4 says.
  - S0 is `graph-search-index.js:29`, S2 is `search.js:64–68`, and S3 is `search.js:203`.
  - Every statement goes through `graph.read`, which is `runCypher` in a READ session (`graph.js:65–68`).
- [x] **The Cypher is fixed text.**
  - The kind's test is one of two fixed strings.
  - The concept's walk comes from firmware's aliases (`relAlias`), as list-elements takes them.
  - The bound is a constant, 5,001.
  - Every value reaches the statements as a parameter: `$lucene`, `$concept`, `$key`, `$keys` and the trust parameters.
  - The words reach Lucene as the one parameter `$lucene`, each form a quoted phrase with `"` and `\` escaped (`_search.js:81–86`). At 300 characters, `q` stays far under Lucene's 1,024 clauses.
- [x] **The point of view is applied inside S1.**
  - `trust('n', ['score'])` computes `counts` in the query.
  - JavaScript counts and pages over that query's own rows.
  - Nothing is stored (principles 1–3; SR23).
- [x] **The boot hook makes the index and nothing else.**
  - It runs `SHOW FULLTEXT INDEXES`, then at most one `CREATE FULLTEXT INDEX … IF NOT EXISTS`. There is no `DROP` anywhere in the change.
  - It never throws or rejects: it has an outer `try` and a guarded log, and XI5 checks a read that throws as it is called.
  - It retries as `tapestry-node-index.js` does.
  - `toJS` leaves a Cypher map as a plain object (`neo4j-driver.js:153–188`), so `isOurs` can read `options.indexConfig` on a real row. A restart with the index there reads as `present`, not `name-taken`.
  - Principle 4: the index changes no node, relationship or property, and the live check's counts were the same before and after.
- [x] **Amendment 1 and Decision 9.**
  - `search-not-ready` is 409.
  - C1's paragraph, the catalog's Paging bullet and the §1 row name search's order and its exception (Amendment 5; SR34).
- [x] **No new dependency.** `package.json` is untouched, and `Intl.Segmenter` is built in.
- [x] **3c22acd7's split can't change which nodes match, their counts or their order.**
  - `holds` stops only once a node holds every word. So match-ness (`held.size > 0`) and `every` equal a full read.
  - The order and the counts use only `every`, the score and the tapestryKey.
  - The page's matches still get the whole `check` for `words`, `field` and `passage`.
  - `mayHold`, now shared by both functions, skips only a text whose lowercase holds no form as a substring. A whole-word hit is such a substring, barring Greek final sigma, which Lucene and JavaScript already lowercase differently.
  - The change "every = some word held" is caught by SR13.
- [x] **Layering.** The pure parts are in `_search.js`, the reads in `search.js`, and the hook in `src/lib` with its driver calls passed in. None of them opens anything at load: L4 of `operations.test.js`, which checks that the catalog loads no driver, LMDB or Redis module, passed in its run alone.

## Concept-graph integrity

- [x] **Handles.** None is written in code, and no TA pubkey is hardcoded (I grepped the diff for 64-hex strings, `82b75e47` and `nsec1`).
- [x] **Firmware.** No concept definition changes, so no reinstall is needed (ADR 0008: "No").
- [x] **Orientation.** The relationship types come from firmware's aliases (`relAlias`), not from BIBLE text.

## Things tests can't catch

- [x] **No secrets** in the committed files.
- [x] **No debug output.** The one new `console.log` is the boot hook's log callback, as its three siblings have.
- [x] **No commented-out code**, and no TODOs.
- [x] **Error paths.**
  - An index dropped between S0 and S1 fails that one request with `ProcedureCallFailed`, a 500. The window is narrow, and the next request answers `search-not-ready`.
  - A JSON that can't be read leaves the node judged by its name and its description.
- [x] **Concurrency.**
  - Three boot hooks run unawaited at once. Schema transients are `Neo.TransientError.*`, which the hook retries.
  - Paging under change is Amendment 5's named exception.
- [x] **Security.**
  - Input reaches Cypher only as parameters.
  - `textProblem` refuses control, text-direction and invisible characters.
  - The refusal quotes `q` through `JSON.stringify`, which leaves U+202E and U+200B unescaped. Resolve's `bad-ref` does the same (`resolve.js:121–122`), so that is the existing convention, not this story's.

## House rules check

- [x] **Concept Graph API authority respected.** Search reads the graph through its own statements, and no concept is re-derived.
- [x] **No new lint, typecheck or build tooling.**

## Product-guide adherence *(when the story traces to a PRD)*

- [x] Not applicable. The story traces to the book's frame, not to a PRD, and search is an agent-facing read with no UI.

## Findings

### Blocking

None.

### Non-blocking (asked; small enough for the pull request before it merges, or a follow-up)

1. **`src/operations/catalog/graph/_search.js:148–152` (`ownerOf`), which `holds` (`:169–178`) and `check` (`:185–199`) use: a `q` that holds a word and its own plural or singular never has a match in the every-word tier (AC3).**
   - **What happens.** Each form is mapped to the first word that claims it, so one text can't credit both words.
     - Probe, on the real module: for `q=relay relays`, a node named "Relay lists and rules" answers `every: false` and `words: ["relay"]`. By Decision 3 ("holds a word, or one of the word's forms") it holds both words.
     - For `q=relays and relay lists`, no node can reach the first tier. So a node holding "relay lists" can rank below one that holds only "lists".
   - **What doesn't change:** which nodes match, `kept`, `leftOut` and `complete`.
   - **Why it matters:** the race's questions are natural language, where "relay … relays" in one question is plausible, and the rerun (A10.40) leans on the first tier.
   - **Optional:** let a form credit every word it is a form of, or fold such a pair into one word in `words(q)`. Add a request holding both forms to SR13.
2. **`src/operations/catalog/graph/_search.js:124`: no test reaches a field one level down in an object, which is where a concept's plural lives (`conceptHeader.oNames.plural`, AC1's "a concept's plural").**
   - **The gap.** With that branch removed, all 34 search tests passed. The seed holds `oNames` (`test/helpers/searchGraph.js:149`), but no request searches a concept by a plural that isn't a form of its name.
   - **The code is right.** A probe of `check`, on a header named mouse whose plural is mice, answered `field: conceptHeader.oNames.plural` and `passage: mice` for `q=mice`.
   - **Optional:** seed a concept such as mouse/mice and search `mice`.
3. **`src/operations/catalog/graph/_search.js:58`: a word ending in `es` drops it only when the word is longer than four letters, which neither Decision 2 nor the Deviations say.**
   - So `uses` gives `use` but not `us`, and `axes` gives `axe` but not `ax`. That's sensible, since it keeps a stem of at least three letters, but an agent can read the rule nowhere.
   - **Optional:** a line in the Deviations.
   - **Also, from the ADR's rule as written (not a code fault):** a word ending in `ss` gets no plural. So `class`, `address` and `process` don't find "classes", "addresses" or "processes", though those plurals find their singulars. The owner may want it in the word-forms follow-up.
4. **`src/operations/catalog/graph/search.js:139` (the `/docs` description) and `docs/GRAPH_OPERATIONS_CATALOG.md:64` (§1's row) say an offloaded node is found by its name "only".**
   - The same declaration's result schema (`search.js:163`), Decision 6 and the Consequences say name and description. That is what the code does: the description tag stays in the index, and only the `json` tag's value moves to the LMDB store.
   - **Optional:** "by their name and description only" in both places.

### Non-blocking (recorded, no change asked)

5. **Like walk's ledger row (`ledger/2026-11-17-walk-skips-unlabelled-keyed-nodes.md`, on staging): search never answers a keyed node without the `TapestryNode` label, and still says `complete: true`.**
   - **Why:**
     - the index covers `TapestryNode` only (`src/lib/graph-search-index.js:21–27`), so such a node's own name isn't indexed;
     - S1 joins a tag hit to its node through `(p:TapestryNode)` (`search.js:46`), so hits on its tags are dropped too;
     - given as `concept`, such a header is refused `unknown-node`, as list-elements refuses it.
   - **They are as rare as the row says.** Only the old `POST /api/tapestry-key/initialize` keys a node without labelling it (`src/api/tapestry-key/index.js:136–141`), and `lifecycle migrate` labels the rest.
   - **For the row's decision:**
     - S1's label on `p` is a filter only, since the join starts from the hit. Dropping it costs nothing and would let such a node be found through its tags.
     - Its own name would still need the label.
     - The row should name search beside walk and list-relationships. The next ledger write can widen it.
6. **The live check's "index on a fresh boot" was shown through the upgrade.** The image's own control panel has no hook, so the check copied in the branch's and restarted it (Evidence). That runs the same function down the same path, and XI5 covers the retries through Neo4j's start-up. So the risk is low, but a fresh image's first boot wasn't itself run.
7. **The live check is judged as its account, not from raw output.** Neither a transcript nor the measurement scripts are in the checkout. Its figures fit the code and the seed, and nothing in the account contradicts the code. Three things rest on it: Lucene's analyzer agreeing with the JavaScript check, the timings, and the real offload.

### Harness friction

1. **The scoped recipe in this review's brief runs every suite under `test/operations/` twice in one process, and the second run fails on state the first run's cleanup removed (Quality gates).**
   - **The mechanism:**
     - `runGate` loads all suites into one process (`test/helpers/gateRunner.js:10`, `:157–160`);
     - `operations.test.js` runs the same cached modules again (`test/operations.test.js:1161`);
     - suites cache their seeded graph or key at module level (`test/operations/graph/add-relationship.test.js:39–43` and others);
     - `graphOpsSuite`'s one `cleanup()` removes every temporary folder after each run (`test/helpers/graphOpsSuite.js:35–37`, `:189`).
   - **The effect:** 188 false failures on staging's code, and 193 on this branch. A recipe listing both can't pass on any branch.
   - **CI is unaffected:** its registry lists `operations.test.js` alone (`test/registry.js:392`).
   - **Ask:** a `meta` row. Either run `operations.test.js` on its own, outside a recipe that already lists its suites, or reset the suites' module-level seeds in `cleanup()`. I found no such row on staging.
2. **The role, workflow 5 and the template ask for `npm test` and its `gate:status` line, which this Mac can't give.** That's already ledgered: `2026-11-16-gate-status-unmet-without-local-gate` and `2026-11-14-harness-points-tests-at-agent-memory`, both still `OPEN` on staging. No new row.

## On PASS (same commit)

- [x] The story's `**Status:**` is flipped to `Done` in place (line 3).
- [x] Under Linked artifacts, the line after `- Test plan:` was the placeholder `- Review: (filled in after Review phase)`. It now links this review, as story 14's review commit (`1f595135`) did.

## Verdict

The read matches its story, ADR 0008 (with Amendment 1, and Amendment 5 to ADR 0011) and the test plan.
- **Criteria:** each one has a test that passes: 34 search tests, 7 for the boot hook and 2 for the agent, besides the fakes' F27–F30 and the guard's G20.
- **Code:**
  - it is Decision 4's statements, in fixed text, with the point of view inside S1;
  - the boot hook makes the index and nothing else;
  - 3c22acd7's split leaves which nodes match, the counts and the order unchanged;
  - the six Deviations are each true.
- **Tests:** 27 of 28 breaking changes failed them. The one that didn't was checked against the real code by probe, and the code is right.
- **Fakes:** they change no other suite's answers.
- **The two Tester corrections are legitimate.**
  - 409 follows the foundation's 4xx rule and the owner's Amendment 1, and SR27 and SR33 still check the code and the message.
  - G20 only teaches the node-site guard that an index definition makes no node, and still finds a node made beside one.
- **Merge:** clean.

The scoped gate's record is FAIL. Its one failing suite, `operations.test.js`, fails the same way on the merge base under the same command: there it has 188 failures, and here 193, the 5 more being the new search suites failing the same way. It passes alone on this branch (812/0/4), so the failure is the recipe's (Harness friction 1).

Non-blocking findings 1–4 are small, before or soon after the merge. Finding 1 is worth fixing before the race's rerun.

The verdict stands on the 64 suites that pass, on `operations.test.js` passing alone, and on the comparison with the merge base. It needs the pull request's CI to be green before merging.

**PASS**
