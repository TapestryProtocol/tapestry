# Review: Story 14 — `graph walk`, following chosen relationship types out from one or more nodes, up to a depth

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16 (the gate run below is stamped 2026-11-17 UTC)
**Diff:** `git diff origin/staging...HEAD`, with origin/staging at `b0a8537a`, the merge base at `47816cae` and HEAD at `52b65acc`. It holds three commits: the Tester's `4812bd8b` (the plan, the tests, the seed and the fake's new route), the Implementer's `c211051e` (the code, the docs and the Deviations) and `52b65acc` (the Evidence). 12 files, +2084 −10. The story and the ADR merged to staging earlier, as PR #110 (`f412f405`).

## Quality gates (run by reviewer, not trusted)

- [x] **Run by the Reviewer:** 13 suites, each first on its own (`node <file>`), then together through the gate engine (`test/helpers/gateRunner.js`), every endpoint pointed at a dead port. They are the eight in the test plan's "How to run", the two more its "The fakes" section names as sharing the fake, and `reads.test.js`, `openapi-coverage.test.js` and `admin-action-sweep.test.js`. `npm run gate:status -- --label a10-14-walk-review`:

  `20261117T034448Z-93423-d21c [a10-14-walk-review] started 2026-11-17T03:44:48.114Z on 52b65acc — PASS, exit 0, 211 passed, 0 failed, 0 skipped, 13/13 suites`

  | Suite | Result |
  |---|---|
  | `test/operations/walk.test.js` | 11 / 11 |
  | `test/operations/graph/walk.test.js` | 30 / 30 |
  | `test/operations/graph/walk-agent-through-cli.test.js` | 2 / 2 |
  | `test/operations/graph-fake.test.js` | 27 / 27 (F1–F26 and F4b) |
  | `test/operations/graph/list-relationships.test.js` | 26 / 26 |
  | `test/operations/graph/list-relationships-agent-through-cli.test.js` | 2 / 2 |
  | `test/operations/graph/list-elements.test.js` | 30 / 30 |
  | `test/operations/graph/link-set.test.js` | 21 / 21 |
  | `test/operations/resolve.test.js` | 11 / 11 |
  | `test/operations/graph/history.test.js` | 8 / 8 |
  | `test/operations/reads.test.js` | 21 / 21 |
  | `test/openapi-coverage.test.js` | 13 / 13 |
  | `test/admin-action-sweep.test.js` | 9 / 9 |

  The Implementer's own record, which the story's Evidence cites, is there too, and says the same: `20261117T032724Z-53466-a18c [a10-14-walk-impl-committed] … on c211051e — PASS, exit 0, 211 passed, 0 failed, 0 skipped, 13/13 suites`.
- [ ] **The full gate has not run.** The full `npm test` must not run on this Mac, because the local stack is the owner's agent-memory instance (ledger `2026-11-14-harness-points-tests-at-agent-memory`). The full gate runs in the pull request's CI (`.github/workflows/test.yml`), not here. Other suites that load the changed fake (the rule suites, the write suites, `test/schema-save-finds-the-right-header.test.js` and more) run only there. **This verdict holds only together with that CI run: it must be green before the merge.**
- [x] **The catalog loads (L1 and L4 of `test/operations.test.js`, re-run here as a child process):**
  - no problems, 22 operations;
  - `graph walk` is a `GET` read for `owner-and-admins` at `/api/tapestry/graph/walk`, with the command `tapestry graph walk`;
  - `resolveRouteAccess('GET', '/api/tapestry/graph/walk')` gives `owner`, and the table's entry is `{ access: 'owner', kind: 'read' }`;
  - no Neo4j driver, LMDB, store or Redis module is required at load.
- [x] **The tests catch broken code.** 24 changes were made one at a time to a copy of HEAD's tree outside the worktree, and both walk suites ran after each. The unchanged copy passed 11/11 and 30/30 (and 2/2 for the agent suite). 21 of the 24 failed them:

  | Change (one at a time) | Tests that failed |
  |---|---|
  | the bound tested with `>` for `>=` (`walk.js:161`) | WK7, W20 |
  | `LIMIT` the bound left plus 2, not plus 1 (`:158`) | WK7, W20 |
  | `finished = step` when stopped short (`:173`) | WK7, W20 |
  | the outgoing statement's rows not counted in the incoming one's `LIMIT` | WK7, W20 |
  | a dropped step keeping its nodes | WK7 |
  | in before out | W6 |
  | the tie-break keeping the greatest, not the least | W6 |
  | the incoming statement not leaving out what the outgoing one met | W6 |
  | tag nodes hidden with `types` too | W8 |
  | `$tags` always false | W8 |
  | the filter without `<> '{}'` | W8 |
  | the filter without `NOT m:GraphChange` | W8 |
  | nodes sorted by tapestryKey alone | 15 tests, among them WK5, W1 and W15 |
  | every step answered as `out` | W3, W4, W5, W8 |
  | `start` the parent, not the path's start | WK5, W3–W6, W9 |
  | the cursor's filter `>=` for `>` | W15, W17, W18 |
  | the scope taking `from` unsorted | W18 |
  | the scope leaving out `depth` | W18 |
  | `types` answered unsorted | W2, W25 |
  | the cursor's steps not bounded by `depth` | W18 |
  | the walk run from the starts sorted, not as given | W3, W25, W27, W28 |
  | **the tie-break's type before its parent (`:111`)** | **none** (Finding 1) |
  | **left-out nodes not added to `met` (`:177`)** | **none** (Finding 2) |
  | **tag nodes passed by not added to `met` (`:178`)** | **none** (Finding 2) |

  One more change, dropping `:TapestryNode` from the step's opening, failed 29 tests. It is left out of the count: the fake routes a step by that label (`STEP_FROM_KEYS`), so it measures the fake, not the tests.
- [x] **The tests came before the code.** At `4812bd8b`, neither `src/operations/walk.js` nor `src/operations/catalog/graph/walk.js` exists, and the test commit touches nothing under `src/`. `git diff 4812bd8b 52b65acc -- test` is empty, so the Implementer changed no test file.
- [x] **It merges cleanly:** `git merge-tree --write-tree origin/staging HEAD` exits 0, tree `04a2040f`. Staging's commits since the merge base are docs only: stories 21 and 27 and their ADRs, the epic, and a ledger row.
- [x] _Playwright not applicable: no UI._
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

**Independent check:** not applied. It is optional for a story that isn't docs-mode.

## Spec adherence

- [x] Every acceptance criterion has a passing test:

  | Criterion | Tests |
  |---|---|
  | AC1 | W1–W3, W7 (two starts), W28 (100 starts), WK5 |
  | AC2 | W4–W7, WK3, WK5 |
  | AC3 | W8 |
  | AC4 | W9–W14 |
  | AC5 | W15–W20, WK7, WK8 |
  | AC6 | W21, W22, WK9, WK10 |
  | AC7 | W23–W30, WK6, WK11, WX1, WX2; and the live check |

- [x] **Loom's "done when":**
  - it is declared once (L1 above; W30);
  - it answers at its route for the owner and admins (W23, and the route table above);
  - its command and its `/docs` entry come from the declaration (W25, W26). `/docs` gives `from` and `types` as `array` query parameters, which OpenAPI sends as repeated keys by default;
  - each thing it refuses has a test: `missing-input` (W21); `invalid-input` for `from`, `types`, `direction`, `depth`, `limit` and `pov` (W21, W22, W19, W16, W14); `unknown-input` (W22); `unknown-node` (W21); `unknown-pov` (W14); `invalid-cursor` (W18); 401 and 403 (W23);
  - each thing it reports has a test: `kept`, `leftOut`, `tagsLeftOut`, `complete`, `finished` and `scored` (W1, W8, W9, W13, W20);
  - an agent used it through the external CLI, in WX1 and WX2 and, by its account, on the scratch stack.
- [x] **The live check, judged as its account** (Finding 5). Its figures fit its seed and the code:
  - AC1's 1, 4, 6 and 7 nodes at depths 1 to 4 follow from the seed it describes: the superset; then set a, gadget one and the peer's element; then set b and gadget two; then gadget deep.
  - The page counts follow from the node counts: 943 nodes make 19 pages of 50 and 5 of 200; 999 make 5 of 200; 9,999 leaves make 50 of 200.
  - The 12,000 hub must stop before its first step: its first statement asks for 10,001 rows and gets them.
  - An Avi-size walk can't reach the bound. A relationship is returned at most once in a walk, since its far end is then met, so a walk inside 8,000 relationships returns at most 8,000.
  - Its 4 change entries are the concept's and three elements'. Sets made with Cypher make none.
  - "`whoami` exited 0 with the agent's own pubkey, not the owner's" shows an admin: `whoami` exits non-zero for anyone who is neither owner nor admin (`clients/cli/src/main.js:80–85`).
- [x] **No criterion is silently dropped.** AC5's "a set number of nodes" is met as ADR 0014 reads it, which its gate accepted: the bound counts relationships returned, and a walk reaches at most as many nodes as it returns relationships. So it never answers more than 10,000 nodes.
- [x] **No behavior beyond the story.** The three Deviations are each true of the code:
  1. `walk()` throws when `read` isn't a function (`walk.js:117`), for a `types` list that is empty or longer than 50 (`:121–123`), and when `pov` isn't resolved (`:127`), as it throws for a `from` of the wrong length (`:118–120`).
  2. `stepStatement` checks its direction, its types and its `LIMIT` again before writing them into the text (`:94–96`).
  3. `/docs` and `complete`'s description give the bound as "10,000", grouped from `BOUND` with no locale data (`catalog/graph/walk.js:25`, `:38`, `:64`).

## ADR adherence

- [x] **Files.**
  - `src/operations/walk.js` and `src/operations/catalog/graph/walk.js` are new.
  - `src/operations/reads.js` changes in C1's comment only (`:15–24`), and `docs/GRAPH_OPERATIONS_CATALOG.md` is changed.
  - Nothing on the "Not changed" list was touched: `list-relationships.js`, `list-elements.js`, `resolve.js`, `_nodes.js`, `graph.js`, the subgraph and neighbors routes, both CLIs, and `reads.js`'s code. `pathCypherFake.js` and `nodeCypherFake.js` are unchanged, as the plan says.
- [x] **The engine (Decision 1).**
  - The exports and limits are the table's: 100 starts, 50 types, depth 10, a bound of 10,000.
  - S1 and S2 are the ADR's text, character for character apart from layout (`walk.js:88–90`, `:97–106`).
  - The tie-break is out before in, then parent, then type, then `rid` (`:111`, with out run first and its nodes in the incoming statement's `$known`, `:159`).
  - The bound: `LIMIT` is the bound less what the walk has read, plus one (`:158`). A statement that returns that many drops the step whole, counts included (`:161`, `:173`).
  - `$known` holds every node met: the starts, the nodes reached, those left out and the tag nodes passed by (`:142`, `:159`, `:177–179`).
  - Paths are built only for the page's nodes (`pathOf`, `:190–197`).
  - `walk()`'s options default as the inputs do (`types` null, `direction` both, `depth` 1). That isn't in the ADR's signature, but it changes nothing a caller can see.
- [x] **The read (Decision 2).** `run` follows steps 1–7:
  - it checks `limit` and `depth` again;
  - it takes `from` each once in the order given, and `types` each once and sorted;
  - it resolves the point of view;
  - the scope is `[from sorted, types, direction, depth, pov.name]`;
  - the position is `[steps, tapestryKey]`, with its four checks;
  - it walks, then pages after the position, and builds each page node's `path`.
  - The answer has the twelve fields, and the three refusals are declared.
- [x] **C5 and C6 are reused, not re-made.** Each step is `relationshipOf(row, { key: parent, direction, own })`. The trust test is `trust('m', ['x', 'r', 'hidden'])`. A start is never judged.
- [x] **Search (Decision 3).** `walk(read, …)` takes any read function and a resolved point of view, and W27 shows it answers what the route answers.
- [x] **Docs (Decision 4).**
  - Amendment 4 to ADR 0011 is on staging.
  - `reads.js`'s C1 paragraph names walk's order, the exception, and that a walk pages a walk it reads whole.
  - The catalog's Paging bullet (`:17`), §1's row (`:71`) and §1's closing sentence say the same.
  - `docs/GRAPH_RULES.md` is unchanged.
- [x] **No new dependency,** and no firmware change.

## Concept-graph integrity

- [x] **Handles** are written `39998:<TA>:<slug>` in the story. The new code reads no concept and holds no assistant pubkey: own keys come from `ownKeys()` at run time (`reads.js:144–147`).
- [x] **Firmware:** no file under `firmware/` and no concept definition changed, so no reinstall is needed.
- [x] **Orientation:** the ADR oriented through `/api/concept-graph/summaries` (Context, Orientation).

## Things tests can't catch

- [x] **Secrets:** none. The 2,084 added lines hold no nsec, no 64-hex literal and no TA literal. By its account, the live check made its keys inside the throwaway instance and removed them with it.
- [x] **Debug code:** no `console.log`, `debugger`, TODO or commented-out code. The four new `//` lines in `src/` are explanations.
- [x] **The bound's arithmetic.**
  - `LIMIT` is always at least 1. Each statement kept returns at most `LIMIT − 1` rows, so what the walk has read never passes the bound.
  - A walk that reads exactly the bound is complete, and the next step's `LIMIT 1` tells whether anything lies past it.
  - Under `both`, the incoming statement gets what the outgoing one left (WK7's `bothInOver`).
  - At the route, W20 pins the 10,000 exactly. One step of 10,000 is complete, and 1 then 10,000 stops short, so neither 9,999 nor 10,001 would pass.
- [x] **Cypher text from input.**
  - Only three things reach the text, each checked twice (by the schema or `walk()`, then by `stepStatement`): the direction, as one of two fixed openings; the types, through the anchored `TYPE_PATTERN` (64 characters at most) into backticks; and `LIMIT`, a computed whole number.
  - Everything else is a parameter.
  - A type carrying a backtick and Cypher is refused (W22), and the engine throws for it (WK10).
  - The cursor's position is used only in JavaScript, never in Cypher.
- [x] **Nodes with no tapestryKey, keyed `'{}'`, or change entries** are neither met nor counted (W8; the filter mutations above). Every key writer in `src/` makes a UUID that `KEY_PATTERN` accepts, so no real node gives a cursor this read refuses. A keyed node with no label is Finding 4.
- [x] **The fake's new route** catches only walk's step.
  - Every statement in `src/` and `test/` that opens from an unanchored `TapestryNode` with a relationship was checked. Besides walk's own, there are `_sets.js:138`, which has no relationship variable and a labelled far end and so keeps the repertoire, and F26's two probes that the route must refuse (`graph-fake.test.js:596`, `:598`).
  - A later relationship keeps the repertoire too (`isStepFromKeys` applies `LATER_RELATIONSHIP`).
  - F1–F25 and the six suites that share the fake pass unchanged.
- [x] **Determinism of paths.** The tie-break ends in `elementId`. A statement cut short by its `LIMIT` drops its step whole, so a truncated read never reaches an answer. A probe of 300 parallel relationships of two types, from two starts to one node, gave one path over five walks.
- [x] **Memory and time.**
  - JavaScript holds at most about 10,100 met keys and 10,000 reached entries, and builds paths only for the page (200 nodes, 10 steps at most).
  - Each statement sends `$frontier` and `$known`, up to about 10,000 keys each.
  - A page is at most 22 reads: 20 step statements at depth 10 with `both`, the start nodes, and the scores for the owner's point of view.
  - By the account: 70 ms a page at the 9,999 hub, and 339 ms at the median at depth 10 on the Avi-size graph.
  - What the bound doesn't count is Finding 3.
- [x] **Concurrency.** `graph.read` runs each statement on its own (`runCypher`, `graph.js:65–68`), so a write during a page can land between two steps. That is the conventions' "read at their own moments", at a finer grain. Between pages, Amendment 4 covers how a node can move. The read writes nothing, so it races with no write of its own.
- [x] **Security.**
  - Only the owner and admins may call it (W23, and the route table).
  - `pov` passes its pattern, then `resolvePov`.
  - A cursor's position is checked before use.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.

## Product-guide adherence *(when the story traces to a PRD)*

Not applicable. The book has an acceptance frame, not a PRD, and the read has no UI.

## Findings

### Blocking

None.

### Non-blocking (asked; small enough for the pull request before it merges, or a follow-up)

1. **`test/helpers/walkGraph.js:15–21` and `test/operations/graph/walk.test.js:350–367` (W6): each of the tie-break's keys is tested, but not the order between them.**
   - **What the ADR orders:** out before in, then the parent's key, then type, then `elementId` (Decision 1; `src/operations/walk.js:111`).
   - **What the seed varies:** each tie pair differs in one key only. `shared` and `far` differ by parent, `twin` by type, `inward` by direction from one parent, and `pair` by `elementId`.
   - **What that misses:**
     - Swapping parent and type at `walk.js:111` passed all 43 walk tests.
     - Out before in is tested against type (`inward`). Against a lesser parent it is tested only through W6's `set2`, out from set1 or in from set3, whose keys are random (`walkGraph.js:79`). So that check tells the two orders apart only when set3's key happens to sort first.
   - **The code is right.** A probe with starts s1 < s2, `s2 -ALPHA-> x` and `s1 -ZETA-> x`, answered `s1 -ZETA-> x`: parent first.
   - **Optional:** add a pair whose parent and type disagree, and give set1 and set3 fixed keys, or add a pair whose incoming parent has the lesser key.
2. **`src/operations/walk.js:177–178`: no test meets a left-out node or a tag node a second time.**
   - **What the lines do:** they add the step's left-out nodes and tag nodes to `met`. A later step then leaves them out inside its statement (`$known`), so each is counted once and never read again against the bound ("counted once, never read again", ADR Decision 1).
   - **What the tests do:** W8 counts a tag node met from two starts once, but within one step, where the incoming statement's `$known` and the sets already dedupe. Deleting either line passed all 43 walk tests.
   - **The code is right.** In a probe, a node left out at step 1 and a tag node passed by at step 1 were each also linked from a node reached at step 1. It answered `leftOut` 1 and `tagsLeftOut` 1, out and both. With a bound of 3 it read 3 and stayed complete.
   - **Optional:** seed such a pair and check both counts, under `both` and with a bound that a second read would pass.
3. **`src/operations/walk.js:100–102`, with the `/docs` text at `src/operations/catalog/graph/walk.js:38` and `:64` and the catalog row at `docs/GRAPH_OPERATIONS_CATALOG.md:71`: the bound counts the rows a step returns, not the relationships Neo4j expands.**
   - **What the text says:** "A walk reads at most 10,000 relationships". The engine's header says it exactly (`walk.js:19`): the bound counts "the relationships a walk reads to nodes it hasn't met".
   - **What isn't counted:** S2 leaves out the nodes met with `NOT m.tapestryKey IN $known`, after the expand. So a frontier node's relationships back to nodes already met are expanded and dropped, at a cost the bound never sees. ADR 0014 chose this knowingly: returning them would charge every relationship back to a parent against the bound.
   - **Why it stays bounded:** a node is walked from once per walk, a walk reaches at most 10,000 nodes, and S2 streams to its `LIMIT`. So a page costs at most the degrees of the nodes walked from.
   - **What wasn't measured:** the live check's graphs were random pairs (degree about 16) and two stars. Neither is a dense cluster such as the trust pipeline's `FOLLOWS` among NostrUsers. Those carry `TapestryNode` and a tapestryKey (`src/pipeline/reconciliation/apocCypherCommands/apocCypherCommand2_follows:6–8`), and a walk with no types follows them.
   - **Optional:** say "relationships to nodes it hasn't met" in the `/docs` sentence and the catalog row. Then time a walk with no types through a dense follow cluster on an instance with the trust pipeline's graph, as a ledger row or in A10.8's live check, since search will call this walk.

### Non-blocking (recorded, no change asked)

4. **`src/operations/walk.js:98` and `:88–90`: a node with a tapestryKey but no `TapestryNode` label is answered as reached and never walked from, and the walk still says it is complete.**
   - **Why:** S2 doesn't label `m`, while the next step's `x` and S1 need the label. A probe walked start, then `bare` (keyed, unlabelled), then `beyond`, to depth 3. It reached `bare` at 1 and never `beyond`, and answered `complete: true, finished: 3`. Given as a start, `bare` is refused `unknown-node`.
   - **Such nodes are rare.** Every writer labels as it keys (`src/lib/tapestry-key-cypher.js:22–26`). `lifecycle migrate` labels the rest, except nodes that share a key, which it leaves for the owner (`src/operations/catalog/lifecycle/_migrations.js:296`). Only the old `POST /api/tapestry-key/initialize` keys without labelling (`src/api/tapestry-key/index.js:139`).
   - **The same asymmetry is in list-relationships:** its other end is unlabelled (ADR 0013's F), and its node labelled.
5. **The live check is judged as its account, not from raw output.** Neither a transcript nor a script is in the checkout, and this review was asked to judge the account as one. Review 13 checked its figures against a transcript; these weren't. They fit the seed and the code (Spec adherence), and nothing in the account contradicts the code. Real-Neo4j behavior and the timings rest on it.
6. **The full gate** runs only in the pull request's CI (Quality gates).
7. **F26's number** may clash with A10.27's or A10.21's fake tests when those land, and the plan says whichever merges second renumbers. On staging today, both are story and ADR only.

### Harness friction

1. **The role, workflow 5 and the template ask for `npm test` and its `gate:status` line, which this Mac can't give.**
   - **Where:** `roles/reviewer.md:35`, `workflows/5-review.md` step 1, and the template.
   - **Already ledgered:** `2026-11-16-gate-status-unmet-without-local-gate` and `2026-11-14-harness-points-tests-at-agent-memory`, both still `OPEN` on staging.
   - **The workaround worked again:** `runGate` with an explicit list of suites and a label, as in review 13. No new row.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place, in this review's commit, by the main session after it checked these findings.
- [x] Completion detection performed. The result is in the chat, not here.

## Verdict

The read matches its story, ADR 0014 (with ADR 0013's C5 and C6 and ADR 0011's Amendment 4) and the test plan.
- **Criteria:** each one has a test that passes: 43 new tests, and the 13 suites above.
- **Code:** it is the ADR's statements and arithmetic, and the three Deviations are each true.
- **Tests:** 21 of 24 breaking changes failed them. The three that didn't were checked against the real code by probe, and it behaves as the ADR says.
- **Merge:** clean.

Findings 1–3 are small and optional, before or soon after the merge. The verdict stands on the 13-suite run above, and it needs the pull request's CI to be green before merging.

**PASS**
