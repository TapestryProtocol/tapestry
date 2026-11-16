# Review: Story 13 — `graph list-relationships`, a node's typed relationships, in and out, each with the way it points

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16
**Diff:** `git diff origin/staging...HEAD`, with origin/staging at `89376a4c` and HEAD at `49501c49`: the Tester commit `049152dd` and the Implementer commit `49501c49`, 12 files, +1670 −18. The story and the ADR merged to staging earlier, as PR #87 (`0e092a19`). So the diff holds the story's later edits (Status, Evidence, Deviations), the test plan, the tests and fakes, and the code.

## Quality gates (run by reviewer, not trusted)

- [x] **Run by the Reviewer:** nine suites through the gate engine (`test/helpers/gateRunner.js`), with every endpoint pointed at a dead port. They are this operation's two suites, the suites of the shared code it changes (`reads.js` and the two fakes), and the API-document and route-table checks of the new route. `npm run gate:status -- --label A10.13-review`:

  `20261116T134820Z-54831-a525 [A10.13-review] started 2026-11-16T13:48:20.366Z on 49501c49 — PASS, exit 0, 135 passed, 0 failed, 0 skipped, 9/9 suites`

  | Suite | Result |
  |---|---|
  | `test/operations/graph/list-relationships.test.js` | 26 / 26 |
  | `test/operations/graph/list-relationships-agent-through-cli.test.js` | 2 / 2 |
  | `test/operations/reads.test.js` | 21 / 21 |
  | `test/operations/graph-fake.test.js` | 24 / 24 |
  | `test/operations/graph/list-elements.test.js` | 30 / 30 |
  | `test/operations/graph/list-elements-agent-through-cli.test.js` | 2 / 2 |
  | `test/operations/graph/history.test.js` | 8 / 8 |
  | `test/openapi-coverage.test.js` | 13 / 13 |
  | `test/admin-action-sweep.test.js` | 9 / 9 |

- [ ] **The full gate has not run.** The full `npm test` must not run on this Mac, because the local stack is the owner's agent-memory instance (ledger `2026-11-14-harness-points-tests-at-agent-memory`). It runs in CI (`.github/workflows/test.yml`) on the pull request, which isn't open yet. Other suites that load the changed fakes, such as `test/schema-save-finds-the-right-header.test.js` through `test/helpers/saveSchemaChild.js`, run only there. **This PASS holds only together with that CI run: it must be green before the merge.**
- [x] **The catalog loads (L1 and L4 of `test/operations.test.js`, re-run here as a child process):**
  - no problems, 19 operations;
  - `graph list-relationships` is a `GET` read for `owner-and-admins` at `/api/tapestry/graph/list-relationships`, with the command `tapestry graph list-relationships`;
  - `resolveRouteAccess` gives `owner`;
  - no Neo4j driver, LMDB, store or Redis module is required at load.
- [x] **The tests catch broken code.** Eight changes were made one at a time to a copy of HEAD's tree outside the worktree, and `list-relationships.test.js` was run after each. The unchanged copy passed 26/26. Every change failed it:

  | Change | Tests that failed |
  |---|---|
  | the `$loops` filter dropped | LR1, LR3, LR13, LR15–LR18 |
  | `elementId(r) > $afterRid` made `>=` | LR9–LR12 |
  | S2's `kept` counting tag nodes | LR5, LR13, LR15–LR18 |
  | ordered by key before type | LR1, LR3, LR10, LR12, LR13 |
  | S3 without `WHERE counts` | LR13, LR17, LR18 |
  | the cursor's type no longer tied to `type` | LR12 |
  | `<> '{}'` dropped from F | LR1–LR3, LR13, LR15–LR18 |
  | `from` and `to` not swapped for `in` | LR6, LR7 |

- [x] **The tests came before the code.** At `049152dd`, `list-relationships.js` doesn't exist and `reads.js` has none of C5's or C6's names. `git diff 049152dd 49501c49 -- test` is empty, so the Implementer changed no test file.
- [x] **It merges cleanly:** `git merge-tree --write-tree origin/staging HEAD` exits 0, tree `0a2150bc`.
- [x] _Playwright not applicable: no UI._
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

**Independent check:** not applied. It is optional for a story that isn't docs-mode.

## Spec adherence

- [x] Every acceptance criterion has a passing test:

  | Criterion | Tests |
  |---|---|
  | AC1 | LR1–LR5 |
  | AC2 | LR6–LR8, RC18–RC20 |
  | AC3 | LR9–LR12 |
  | AC4 | LR13–LR19, RC21 |
  | AC5 | LR10 (`limit`), LR20, LR21 |
  | AC6 | LR22–LR25, RX1, RX2 |
  | AC7 | LR26, RC17; list-elements' and history's suites pass unchanged |

- [x] **The live check, audited from its raw output.** Its scripts and output were read: the seed, the check, and the run's transcript, whose last line is "91 passed, 0 failed".
  - Every figure the story's Evidence gives matches the transcript, among them:
    - at 50 a page, 200 pages, 66.9 ms at the median, 312.2 ms at most and 14.3 s in all;
    - at 200 a page, 50 pages, 68.4 and 154.9 ms, 3.6 s;
    - from the owner's point of view, kept 7,501 and left out 2,499;
    - 452 relay events, 5 change entries, 13,293 nodes and 13,732 relationships before and after the calls;
    - the agent's 4 pages of 3 with `[11,1,6]`, and its 20 pages of the 4,000 CITES.
  - One line says more than its check saw (Finding 3).
- [x] **Loom's "done when":**
  - it is declared once (L1);
  - it answers at its route for the owner and admins (LR22, and the route table above);
  - its command and its `/docs` entry come from the declaration (LR24, LR25);
  - each thing it refuses has a test: `missing-input`, `unknown-node`, `invalid-input` for `node`, `type`, `direction`, `limit` and `pov`, `unknown-input`, `unknown-pov`, `invalid-cursor`, 401 and 403;
  - each thing it reports has a test: `kept`, `leftOut`, `tagsLeftOut` and `scored`;
  - an agent used it through the external CLI, on the scratch stack and in RX1 and RX2.
- [x] **No criterion is silently dropped.** Relationships to nodes with no tapestryKey, or keyed `'{}'`, are neither listed nor counted, as ADR Decision 2's filter F decides.
- [x] **No behavior beyond the story.** The four Deviations are each small and logged, and each matches the code (`reads.js:166`, `:169`, `:242`; `list-relationships.js:31`, `:92`).

## ADR adherence

- [x] **Files.**
  - `list-relationships.js` is new.
  - `reads.js` and `docs/GRAPH_OPERATIONS_CATALOG.md` are changed.
  - Nothing on the "Not changed" list was touched: `list-elements.js`, `history.js`, `changes.js`, `_nodes.js`, `graph.js`, today's neighbors and subgraph routes, and `clients/cli`.
- [x] **Statements.**
  - S1, F, S2 and S3 are Decision 2's text.
  - `run` follows steps 1–7: the limit check, `resolvePov`, the scope `[node, type, direction, pov.name]`, then the cursor, the node, the counts, and the page out before in with `limit + 1` rows still wanted.
  - The position is `[direction, type, otherKey, rid]`, with the four checks.
- [x] **C5 and C6.**
  - `relationshipColumns` is Decision 1's text.
  - `relationshipOf` builds `from` and `to` by direction.
  - `trust(v, keep)` carries `keep` through its `WITH`. `trust('e')` gives the same text as before, so list-elements doesn't change.
- [x] **Docs.**
  - The Conventions gain both parts, and point to `reads.js` and 0013.
  - §1's row gives the answer as built.
  - The walk sentence is Decision 3's, word for word.
  - `docs/GRAPH_RULES.md` is unchanged.
- [x] **No new dependency,** and no firmware change.

## Concept-graph integrity

- [x] **Handles** are written `39998:<TA>:<slug>`. No assistant pubkey is hardcoded: `ownKeys()` reads `getOwnerAssistantPubkey()` at run time.
- [x] **Firmware:** no file under `firmware/` and no concept definition changed, so no reinstall and no concept-graph call is needed.
- [x] **Orientation:** the ADR oriented through `/api/concept-graph/summaries` and the relationship-type header's neighbors (Context, Orientation).

## Things tests can't catch

- [x] **Secrets:** none. The added lines hold no key, nsec or password, and no TA literal. The live check made its keys inside the throwaway instance and removed them with it.
- [x] **Debug code:** no `console.log`, `debugger`, TODO or commented-out code.
- [x] **Error paths.** Every refusal names its input. A slip by a caller of `trust`, `relationshipOf` or `patternOf` throws a plain error, never a Cypher one.
- [x] **Concurrency.**
  - The counts and the page are read at their own moments, as the ADR says.
  - Paging is keyed on facts that don't change while a relationship exists: its direction, its type, the other node's key and its `elementId`. So an edit between pages moves no other relationship.
  - `NostrUser.pubkey` is unique (`setup/neo4jConstraintsAndIndexes.sh:50`), so trust's `OPTIONAL MATCH` can't double a row.
- [x] **Security.**
  - Only the owner and admins may call it (LR22, and the route table).
  - A type reaches Cypher's text only in backticks, after `TYPE_PATTERN` is checked twice: by the input's schema, and again in `patternOf`.
  - `LIMIT` is a computed whole number, and everything else is a parameter.
  - A cursor's position is checked before use, and used only as parameters.
- [x] **The driver.** `toJS` maps arrays recursively (`src/lib/neo4j-driver.js:181`), so an integer inside the `[key, value]` pairs becomes a number. No writer gives a relationship a temporal property, which `toJS` would pass through unconverted.
- [x] **The fakes.**
  - The new route catches no other `src/` statement. The three others that open from a tapestryKey are writes that end at a labelled node.
  - `saveSchemaChild.js` passes a repertoire, so its untyped-relationship refusal still fires.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.

## Product-guide adherence *(when the story traces to a PRD)*

Not applicable. The book has an acceptance frame, not a PRD, and the read has no UI.

## Findings

### Blocking

None.

### Non-blocking (asked; small enough for the pull request before it merges, or a follow-up)

1. **`docs/GRAPH_OPERATIONS_CATALOG.md:15` and `src/operations/reads.js:16–17`: the paging convention now overstates.**
   - **What they say:** items come "by `tapestryKey`, unless the read is about time".
   - **What this read does:** it orders by direction, then type, then the other node's tapestryKey, then `elementId`. ADR 0013 says "a read that wants another order says so in its own ADR". The read's §1 row and its description say so, but the convention that `walk` and `describe-node` will read doesn't.
   - **Asked:** in both places, say that a relationship read gives its own order, and name list-relationships' order.
2. **`test/helpers/graphFake.js:324–326` and the test plan (`13-list-relationships.test-plan.md:39`): the one-hop route lifts the repertoire for the whole statement, not just its opening clause.**
   - **Where:** `ONE_HOP_FROM_KEY` checks only how the statement opens.
   - **The probe:** run in memory over this story's seed, `MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) OPTIONAL MATCH (m)-[:TAGS]->(z) RETURN …` ran, and so did a later `MATCH (m)-[:TAGS]->(z)`. The same `TAGS` clause without the opening one-hop was refused.
   - **What it costs:** the fake still evaluates correctly, since each later pattern filters by its own type. What's lost is the loud failure that every story after this one relies on: A10.9, and `walk` (A10.14), will extend these fakes.
   - **What the docs say:** the plan says the repertoire "still applies to … a later `MATCH`", and the fake's comment says "a second hop keeps the repertoire". Both hold only within the opening pattern.
   - **Asked:** either make the route refuse a statement whose later clauses name a relationship outside the repertoire, or correct the two sentences.
3. **`13-list-relationships.md:134`: "`whoami` answered `admin`" says more than its check saw.**
   - **The check:** the live check tested `/admin/.test(stdout)`.
   - **Why that's weak:** the CLI's `whoami` prints `source: "key file /root/lr-keys/admin.hex"`, so the key file's name alone satisfies it. The output it kept stops at 200 characters, before `role`.
   - **The role still holds:**
     - `whoami` exits 0 only for the owner or an admin (`clients/cli/src/main.js:80–85`);
     - the agent's pubkey (`0f45fdfe…`) isn't the owner's (`2025765f…`);
     - its owner-and-admins reads succeeded.
   - **Asked:** reword the line to say what was seen, for example "`whoami` exited 0 with the admin key's pubkey, not the owner's", or show the `role` field.
4. **`src/operations/catalog/graph/list-relationships.js:100`: the cursor accepts fewer types than the list answers.**
   - **The mismatch:** with no `type`, the read lists every type the graph holds. The cursor's position must match `TYPE_PATTERN` (a letter first, 64 characters at most).
   - **What breaks:** a page that ends on a type outside that pattern, made with raw Cypher, would give a cursor this read refuses, and the rest of the list couldn't be reached. That is story 11's Finding 1 failure, but no graph today can reach it: every writer in the codebase uses a plain constant type, and all 14 firmware aliases match the pattern.
   - **Why the check isn't needed:** the position's type reaches Cypher only as `$afterType`, a parameter.
   - **Optional:** accept any non-empty text there, still equal to `type` when one is given.

### Non-blocking (recorded, no change asked)

5. **No parallel relationship is added or taken out between pages.**
   - **What the ADR asks:** "For the Tester" (`0013-…md:344`) asks for paging with relationships added and removed between runs, "parallel ones included".
   - **What the tests do:** LR11 adds and removes relationships that aren't parallel, and LR10 pages through parallel ones with no change between pages.
   - **Why it holds anyway:** the `elementId` tie-break makes the case hold by construction, and the `>=` change above shows the tie-break is tested.
6. **The full gate** runs only in the pull request's CI (Quality gates).

### Harness friction

1. **The role, workflow 5 and the template ask for `npm test` and its `gate:status` line, which this Mac can't give.**
   - **Where:** `roles/reviewer.md:35`, `workflows/5-review.md` step 1, and the template.
   - **Already ledgered:** `2026-11-16-gate-status-unmet-without-local-gate` and `2026-11-14-harness-points-tests-at-agent-memory`. Neither names `roles/reviewer.md:35` among the places to fix.
   - **A workaround that worked:** `runGate` with an explicit list of suites and a `GATE_LABEL` leaves a run record, so `gate:status` can quote a scoped run. It may belong in the first row's fix shape. No new row.

## Verdict

**PASS**

The read matches its story, ADR 0013 and the test plan.
- **Criteria:** every one has a test that passes.
- **Live evidence:** it holds up against its raw output.
- **Tests:** each of eight breaking changes made the suite fail.
- **Merge:** clean.

Findings 1–4 are small and should land before or soon after the merge. The PASS stands on the nine-suite run above, and needs the pull request's CI to be green before merging.

**PASS**
