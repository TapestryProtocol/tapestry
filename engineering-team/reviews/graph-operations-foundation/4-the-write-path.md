# Review: Story 4 — The write path

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-14
**Diff:** `git diff f077badb..HEAD` (commit `c2191b07`, branch `A10.4-write-path`). Six commits: `be3f80fd` (the failing tests), `3af97668` and `af20df51` (two test corrections), `0c81db02` (the fake graph reads `keyNode`), `e84018c9` (the implementation), `c2191b07` (the reserved-type wording and the live check's record). 35 files, 3,451 lines added, 28 removed.

The base, `f077badb`, already holds the story and ADR 0004 (PR #57). The live check ran on a throwaway scratch instance that has since been removed. This review judges it from the record in the test plan's Verification and the story's Evidence, as asked, and re-runs every stack-free check itself. The optional independent check of workflow 5 was not applied.

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`: not run.** On this machine the full gate writes to the owner's agent-memory instance (container `tapestry`, `:7778`), and this review's rule forbids it.
  - `npm run gate:status` printed `no gate run records in /Users/wds4/repos/TapestryProtocol/tapestry-A10.4/tmp/gate-runs`.
  - No pull request holds the implementation yet. The branch's only one, #57, merged the story and the ADR at `bc4e7324`, and its CI run was green. So CI's run on the next pull request will be the first full gate of `c2191b07`.
  - This is how story 6's review handled the same constraint (round 4). OPEN.md row 294 carries the case.
- [x] **Suites run one by one,** on Node 24.18.0 at `c2191b07`, with a clean tree. Before running, I screened each suite and the helpers it loads for `:7778`, `docker exec` and live endpoints.
  - The harness's child environment points Neo4j, Redis, Meilisearch and the base URLs at port 9 (`test/helpers/graphOpsSuite.js:43–72`).
  - The two suites outside the list I was given (`openapi-coverage`, `default-deny-mutations`) ran with the same dead values exported in the shell.

  | Suite | Result (pass/fail/skip) |
  |---|---|
  | `test/operations/graph-fake.test.js` | 8/0/0 |
  | `test/operations/rules/relationship-type-allowed.test.js` | 10/0/0 |
  | `test/operations/change-indexes.test.js` | 3/0/0 |
  | `test/operations/write-path.test.js` | 13/0/0 |
  | `test/operations/graph/add-relationship.test.js` | 12/0/0 |
  | `test/operations/graph/remove-relationship.test.js` | 7/0/0 |
  | `test/operations/graph/history.test.js` | 8/0/0 |
  | `test/operations/graph/agent-through-cli.test.js` | 1/0/0 |
  | `test/operations.test.js`: all of the above, story 1's own tests, every lifecycle suite, the cache counts, and the tapestry keys with G4 | 263/0/0 |
  | `test/external-cli.test.js` | 53/0/0 |
  | `test/admin-action-sweep.test.js` | 9/0/0 |
  | `test/admin-action-sweep-access.test.js` | 13/0/0 |
  | `test/close-unauth-write-surface.test.js` | 14/0/0 |
  | `test/openapi-coverage.test.js` (the three new routes' generated `/docs` entries) | 13/0/0 |
  | `test/default-deny-mutations.test.js` (the new POST routes behind the central check) | 14/0/0 |
  | `scripts/harness-lint.sh` | clean, 0 violations |

  The figures match the test plan's "After Implementation" record: 263, 53, 9, 13 and 14.
- [x] **Red before green.** I exported HEAD's tree to the scratchpad and put `f077badb`'s `src/`, `bin/` and `docs/` back in it, so the tests ran against the code before this change.
  - The fake graph's suite passed 8/0. The seven other new suites failed every test: 0/10, 0/3, 0/13, 0/12, 0/7, 0/8 and 0/1. That is 54 failing tests, the test plan's count.
  - W1, W11, W11b and W12 run against code that exists, and each fails for the reason the test plan names. W11b took a backup, over the lifecycle fake, from a POST with no body. W12's command said `failed: undefined` where the route gave the thrown string.
- [x] **The phases kept to their lanes.**
  - `git diff 0c81db02..HEAD -- test/` is empty: Implementation left the tests alone.
  - `git diff f077badb..0c81db02 -- src/ bin/` is empty: the Tester's commits changed no code.
  - The three test corrections made during Implementation are each a Tester commit with its reason (Spec adherence, below).
- [ ] `npm run test:playwright`: not applicable. No UI changed.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.

| AC | Tests (all pass here) | The live record | Checked in the code |
|---|---|---|---|
| AC1, add | AR1–AR3, W4, W5 | add, repeat, and two adds at once: one relationship, one entry | `add-relationship.js:44–60`: both nodes found, then `MERGE`, and `relationshipsCreated` tells an add from a repeat |
| AC2, the guard | AR4–AR7, W6, R1–R10 | `HAS_ELEMENT` on a real class-thread edge and `FOLLOWS` refused `reserved-type`; `MENTIONS` refused `undeclared-type`; an entry's key refused `unknown-node` | one `violations`, used by the path as a guard (`write.js:32–37`) and called directly as a check (R7); written up in `docs/GRAPH_RULES.md` §2 |
| AC3, remove | RR1–RR7 | removed with `count: 1`, then `already-gone` | `remove-relationship.js:45–60` |
| AC4, recorded with it | W4–W10, AR1, AR10, AR11, RR1 | a change made, then its entry's write failed: neither kept, on Neo4j's own transaction | the guards, the change and the entry share one `executeWrite` transaction (`graph.js:42–63`, `write.js:28–46`) |
| AC5, history | H1–H8, I1–I3 | at 100,000 entries, 5.4 ms a page and 47.6 ms for a rare node; both indexes online after a restart; a restore brings back exactly the restored graph's history | `changes.js:132–160`, `history.js` |
| AC6, JSON only and nothing signed | W11, W11b, AR8, RR7 | text/plain refused 415; the relay held 450 events before the first graph write and after the last | `http.js:109–112`. I traced the requires of every new module: none calls signing or publishing code, and `getOwnerAssistantPubkey` reads only a pubkey, from the environment, the conf or the key file's plain `pubkey` field (`src/utils/assistantKeys.js:49–82`) |
| AC7, callers, the command, an agent | AR9, AR11, AR12, RR7, H7, W10, W12, X1 | an admin agent, through the external CLI and the instance's nginx, added, removed and read back both entries | I loaded the shipped catalog: all three operations are listed, have `/docs` entries, and have route-table entries at `owner`. Nothing under `clients/` changed |

The acceptance criteria are as approved. The story's only edits since `f077badb` are its Evidence, its Deviations and the test plan's link.

**The three test corrections made during Implementation,** each checked as a fresh claim:
- **`3af97668` (W1).** ADR 0004 Amendment 2 moves "every graph write applies" from the loader to a test over the shipped catalog, because story 1's and story 6's fixture catalogs keep `graph` writes with `run`. The new W1 loads the real catalog, needs both writes to be there, and fails on any graph write that has `run` or doesn't load. It is no weaker than the loader rule: a graph write with `run` now fails CI, where the loader would have left it off an instance. The owner's ruling itself is taken from the ADR's record.
- **`af20df51` (AR9).** The harness mounts the real `authMiddleware` (`test/helpers/operationsHarness.js:147` and `:157`). On a POST it answers a visitor and a stranger first, with no `code`. AR9 now asserts the statuses and a message naming who may call, as story 1's H5 does. AC7 names only the statuses.
- **`0c81db02` (the fake reads `keyNode`).** F4b tests it. The entry's CREATE uses `keyNode('c')` because ADR 0003 Decision 8 and story 3's guard G4 require it of every statement that makes a node. G4 passes, within the aggregate's 19/0 for the tapestry keys.

**The Deviations,** each checked:
- `keyNode('c')` gives the same result as the ADR's `tapestryKey: randomUUID()` with the label inline. The live check saw both labels on the entries.
- History's `LIMIT` is written into the text. `limit` is an integer from 1 to 200, checked by ajv, and `readHistory` checks it again (`changes.js:133`).
- The concept's header is read on its own before the elements (`relationship-type-allowed.js:113–114`), which R6 needs.
- `since` has a stricter pattern, and no 500 can be reached. Its wording is Non-blocking 6.
- The 415's message says what to send (`http.js:111`).
- AR9: above.

## ADR adherence
- [x] Files changed match the ADR's implementation notes. Every new and changed file it lists is in the diff, and nothing else in `src/` or `bin/` changed.
- [x] Layering / module boundaries respected.
- [x] No new dependencies the ADR didn't authorize. `package.json`, the lockfile, the Dockerfile and `docker/` are unchanged.

- **Decisions 1–3.** `run` or `apply` is checked at `declaration.js:108–114`, and an `apply` write's fields at `:177–198`. `write.js` follows Decision 3's five steps. A guard's refusal carries `rule`, and `unknown-node` carries `input` (`refusal.js`; `index.js:157`).
- **Decision 4.** `rules/index.js` loads one file per rule, checks each one, and reports and leaves out a bad one. Loading opens nothing: the rule requires its firmware, LMDB and key helpers inside `violations`.
- **Decision 5.** The entry is `(:GraphChange:TapestryNode)` with the table's properties, and it links to nothing. The one key lookup leaves entries out (`_nodes.js:34`), and so does both writes' Cypher. The indexes are made at start (`tapestry-node-index.js:72–136`, `bin/control-panel.js:369–376`), and `ensureUuidIndexOnBoot` is untouched.
- **Decision 6 and Amendment 1.** Reserved types are checked first: firmware's, read from its files, plus `CODE_MADE`, with `SERVES`. Each is attributed as the ADR's table says, and R2 checks every type's wording. Then a type must be declared in the class thread of `39998:<TA>:relationship-type`. LMDB references are resolved (R5, over a real LMDB in a temporary folder). A type reaches Cypher only if it matches `^[A-Za-z][A-Za-z0-9_]{0,63}$` and the rule has passed it, and then only in backticks.
- **Decisions 7–13: as specified.** `failureMessage` is used by `callOperation`, `http.js` and `cli.js`. `docs/GRAPH_RULES.md` holds both entries, and design §7 points to it.
- **Amendment 2.** The loader refuses `apply` on a read, and `run` with `apply`, and nothing more. W1 holds the rest.
- **The earlier ADRs in the epic.** I found no contradiction with any of them.
  - **0001.** Declarations still open nothing at load. The only shared file edited is `bin/control-panel.js`, which ADR 0004 names, and it gains one boot call.
  - **0002.** Backup and restore are unchanged, and they carry the entries, as the live check shows. The lifecycle lock is Non-blocking 2.
  - **0003.** The entry's CREATE uses `keyNode`, and the key lookup uses the shared label.
  - **0006.** The client is unchanged. Its writes already send `application/json` with an object body (`clients/cli/src/instance.js:70`, `clients/cli/src/operations.js:120–126`).

## Concept-graph integrity
- [x] Handles are in `kind:pubkey:slug` form: `39998:<TA>:relationship-type`, with the TA from `getOwnerAssistantPubkey()` at run time (`relationship-type-allowed.js:85–89`). No literal TA pubkey appears in the diff.
- [x] Firmware reinstall called out: none is needed. No concept definition changed and nothing under `firmware/` changed, as ADR 0004 says.
  - The live check's reinstall left a `CITES` relationship and its declaration in place.
  - The install prunes only class-thread edges (`src/firmware/install.js:780–830`), and those are reserved.
- [x] New code orients through the graph and the firmware alias layer, not BIBLE.md. The class-thread types come from `firmware.relAlias()`.

## Things tests can't catch
- [x] No secrets in committed files. No nsec and no 64-hex literal is in the added lines. The live check made its admin key on the scratch instance and deleted it there.
- [x] No leftover debug logging. Two `console` calls are added: the boot hook's logger and the rules loader's report of a bad rule. Each matches what the code already does for its neighbour.
- [x] No commented-out code, and no TODOs.
- [x] Error paths and edge cases handled where it matters.
  - **What already scans every node.** The entries are `TapestryNode`s, so I checked each such scan:
    - the derivers run only for their own labels;
    - offload follows `HAS_TAG` edges, which entries don't have;
    - the key counts take only nodes with a `uuid` or an `id`;
    - backup's key walk counts entries, which is right, since they are nodes with keys.
  - **No clean-up can erase the history.** Nothing in `src/`, `bin/`, `setup/` or `scripts/` deletes nodes that have no edges (principle 4).
  - **Who posts to these routes.** No UI page, script or workflow posts to `/api/tapestry/`. Only the external CLI and the tests do, and both send JSON.
- [x] Concurrency / race conditions considered.
  - Two adds at once made one relationship on Neo4j 5.26, in one trial: `MERGE` between two bound nodes held.
  - `executeWrite` retries a deadlock, and takes `at` again on each attempt.
  - Two removes at once were not tried (below).
  - The lifecycle lock is Non-blocking 2.
- [x] Security: input validation at boundaries, no obvious injection vectors.
  - A relationship type must match a plain-name pattern and pass the rule before it reaches Cypher's text. Keys and filters go in as parameters, `LIMIT` is a checked integer, and the index names are constants.
  - The write path sits behind the route table and the router's re-check.
  - The CORS posture is Non-blocking 1.

## House rules check
- [x] Concept Graph API authority respected. The rule reads the concept from the graph by its handle.
- [x] No new lint/typecheck/build tooling without an ADR.

## Product-guide adherence *(when the story traces to a PRD)*
Not applicable. The book has an acceptance frame and no PRD, and no UI changed.

## Findings

### Blocking
None.

### Non-blocking
1. **`bin/control-panel.js:117–122`: the JSON-only rule doesn't stop a preflighted JSON write.**
   - **What it closes.** Cross-site form, text and body-less POSTs, which need no preflight.
   - **What stays open.** CORS reflects any origin (`origin: true`), allows credentials, and allows `Content-Type`. A request whose origin carries the session cookie can pass the preflight and POST JSON to a graph write, or to lifecycle `backup` or `restore`.
   - **Who that is.** Other `*.brainstorm.world` hosts carry the cookie, since they are same-site and the cookie's default is `Lax` (`:237–240` sets no SameSite). So would any browser that still sends a no-SameSite cookie on a cross-site request.
   - **How this story bears on it.** It narrows the exposure rather than widening it. ADR 0004 Context 6 describes the cookie and the missing Origin check, but not the CORS reflection.
   - **Optional improvement.** Add a dated note to OPEN.md row 326 saying the `/api/tapestry/` writes are reachable this way, so whoever takes up that row weighs them.
2. **`src/operations/write.js:25–47`: graph writes don't take the lifecycle lock (ADR 0002 Decision 7).**
   - **During the backup's counts.** A write can commit between backup's first count and the stop (`_jobs.js:201`), or between the restart and its second count (`:226`). Either way the counts differ, so the backup records `countsExact: false` with its warning (`:230–232`).
   - **While the graph is offline.** A write sent then doesn't fail. `executeWrite` retries `ServiceUnavailable` for up to 30 s, the driver's default, then commits into whatever graph comes back, including a restored one.
   - **What still holds.** The dump itself stays coherent.
   - **Why it matters now.** An agent is about to run thousands of adds.
   - **Optional improvement.** Have graph writes refuse `busy` while a backup or restore holds the lock, as upload does. Or tell agents to pause during them, in the skill and in OPERATIONS.md §16.
3. **`test/operations/rules/relationship-type-allowed.test.js:137`: R9, the guard on the reserved list (debt 4), skips the APOC command files.**
   - **What it reads.** Only `.js`, `.sh` and `.cypher` files under `src/`. It skips the 22 command files there with no extension: the trust pipeline's 20 under `src/pipeline/`, and 2 under `src/manage/concept-graph/`.
   - **Why nothing slips through today.** Those files name only reserved types (`FOLLOWS`, `MUTES`, `REPORTS`, `AUTHORS`, `HAS_TAG`), and R9 adds the first three by hand.
   - **What would slip through.** A new type written only in an APOC file.
   - **Optional improvement, in the Tester's lane.** Read those files too, as story 3's G4 does.
4. **`src/operations/changes.js:76`: `byOf` records a caller whose role it doesn't recognise as `local`, with no pubkey.** `local` means the command inside the instance. Nothing reaches this today, since the route's re-check admits only the owner, admins and local callers. But a later surface that passed some other caller would have its changes credited to the shell. Optional improvement: fail closed, and throw, so the write rolls back.
5. **`src/operations/write.js:32–37`: the path refuses on any violation, whatever the rule's `refuses` says.** `rules/index.js:36` requires that field, and ADR 0004 Decision 4 defines it as a rule that refuses rather than one that only reports. The only rule refuses, so nothing differs today. Optional improvement: have the loader refuse a guard that names a report-only rule, until the first such rule decides what the path does with it.
6. **Wording.**
   - `docs/GRAPH_RULES.md:43` says "A test fails if the code names a relationship type in Cypher that isn't reserved." R9 reads `src/` only. The UI's Cypher names the second brain's link types (`BEARS_ON`, `ANSWERS` and others, `ui/src/pages/reading/readVerbs.js:28`), which are rightly not reserved. It should say "the instance's server code (`src/`)".
   - `docs/GRAPH_RULES.md:3` credits design §7 with "Write each rule into the rules document (§7) as its guard or check is built." The sentence is §8, step 3, as the new pointer in §7 itself says.
   - `src/operations/changes.js:37` says `count` is given "when the change removed more than one thing alike". Every removal carries it, a count of 1 included, as the ADR says.
   - The story's Deviation (`4-the-write-path.md:129`) says `since` is held to "a real calendar time". The pattern (`history.js:12`) admits `2026-02-31T00:00:00Z`, which `new Date` rolls to `2026-03-03T00:00:00.000Z`. No 500 can be reached, which is the Deviation's point, but "real" overstates it.
7. **`OPERATIONS.md:1072` lists lifecycle's POST routes without saying they now take JSON only.** Optional improvement: add one clause, "send `Content-Type: application/json`, and `{}` when there are no inputs". The 415 already tells the caller.

**Not checked here, and why:**
- **The full gate.** See Quality gates, above.
- **The live check.** Taken from its record, as asked. The scratch instance is gone.
- **Two removes of the same relationship at once.** Only adds were raced live.
- **A type declared under a set below the concept's superset, on Neo4j.** The live check's `CITES` came from `POST /api/normalize/create-element`. The deeper walk, `IS_A_SUPERSET_OF*0..` past depth 0, is checked only over the fake (R3, AR3).
- **The graph database not answering.** The test plan leaves this out too. By the code, it is up to 30 s of retries, then a 500 `failed`.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. None new. That the full gate can't run on this machine, and that no pull request holds the implementation yet, is OPEN.md row 294's case. The template's close-out heading is renamed below, per ledger row `2026-10-07-on-pass-heading-reads-as-verdict`.

## Verdict
**PASS**

The diff builds what the story asks and what ADR 0004 and its two amendments say. It doesn't contradict ADRs 0001, 0002, 0003 or 0006. Every acceptance criterion has a test that passes here, and the 54 new tests fail without the code. The live check covers what the fake graph can't. Nothing blocks. CI's run on the pull request will be the first full gate of `c2191b07`, and it should be green before the merge.

## Close-out (same commit)
- [x] Story `**Status:**` set to `Done` in place, by the main session, in this commit (the review left it so, as asked).
- [x] Completion detection was run, and its result is in the chat.
