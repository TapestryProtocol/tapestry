# Review: Story 21 — `graph update-node`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16
**Diff:** `git diff b0a8537a...HEAD`, at `fa44a6f7`.
- `b0a8537a` merged PR #111, which brought the story and ADR 0021 to staging. It is the merge base.
- So the range holds the story's three commits:
  - `4479e0df`: the test plan and the failing tests, approved at the Test Design gate;
  - `6ec2c3a1`: the implementation;
  - `fa44a6f7`: the story's Evidence, and ledger row `2026-11-17-scratch-firmware-copy-needs-restart`.

**How it was made.** An independent reviewer agent wrote this review at the session's request. It has no Edit access. Its only write to a tracked file was this one; the gate kept its record under the ignored `tmp/gate-runs/`.
- It ran every suite, the gate and every probe itself.
- Each probe ran the real code over the fake graph, from the session's scratchpad: the catalog through the harness, or `_nodes.js` over the fake's reader. Nothing it wrote went into the repository.
- It made no call to the local stack, the scratch stack or GitHub.

## Quality gates (run by reviewer, not trusted)

- [ ] **The full gate** (`npm test`): not run here.
  - **Why:** on this Mac the local stack is the owner's agent-memory instance, and the full suite writes to it (ledger row `2026-11-14-harness-points-tests-at-agent-memory`).
  - **Where it runs:** as the pull request's CI check.
  - **What only CI covers:** `test/operations/lifecycle/`, `test/operations.test.js` as a whole, and every suite outside `test/operations/` but the four route-surface ones run below.
- [x] **A scoped gate, run by the Reviewer** on `fa44a6f7`, with every endpoint dead:
  - `NEO4J_URI=bolt://127.0.0.1:9`, `REDIS_HOST=127.0.0.1` and `REDIS_PORT=9`;
  - `BRAINSTORM_BASE_URL`, `TAPESTRY_BASE` and `MEILI_URL_HOST` at `http://127.0.0.1:9`;
  - `TAPESTRY_PORT=9` and `TAPESTRY_CONTAINER=no-such-container`.

  It ran 44 suites: every suite under `test/operations/` but `lifecycle/` (40), and the four route-surface suites. Its `npm run gate:status -- --label review-21` line, with the worktree's absolute path shortened:

  ```
  20261117T035222Z-97690-1f74 [review-21] started 2026-11-17T03:52:22.235Z on fa44a6f7 — PASS, exit 0, 509 passed, 0 failed, 0 skipped, 44/44 suites · <worktree>/tmp/gate-runs/20261117T035222Z-97690-1f74.json
  ```

  The suites the session named, from that run:

  | Suite | Result |
  |---|---|
  | `operations/graph/update-node.test.js` | 37 passed, 0 failed, 0 skipped |
  | `operations/graph/update-node-shared.test.js` | 7 passed, 0 failed, 0 skipped |
  | `operations/graph/update-node-agent-through-cli.test.js` | 1 passed, 0 failed, 0 skipped |
  | `operations/graph/create-element.test.js` | 33 passed, 0 failed, 0 skipped |
  | `operations/graph/element-schemas.test.js` | 9 passed, 0 failed, 0 skipped |
  | `operations/graph/elements-agent-through-cli.test.js` | 1 passed, 0 failed, 0 skipped |
  | `operations/rules/element-fits-schema.test.js` | 7 passed, 0 failed, 0 skipped |
  | `operations/change-entry-fields.test.js` | 3 passed, 0 failed, 0 skipped |
  | `operations/graph/update-concept.test.js` | 11 passed, 0 failed, 0 skipped |
  | `operations/graph/fields.test.js` | 8 passed, 0 failed, 0 skipped |
  | `openapi-coverage.test.js` | 13 passed, 0 failed, 0 skipped |
  | `admin-action-sweep.test.js` | 9 passed, 0 failed, 0 skipped |
  | `admin-action-sweep-access.test.js` | 13 passed, 0 failed, 0 skipped |
  | `admin-action-sweep-named.test.js` | 6 passed, 0 failed, 0 skipped |

  - These 14 make 158 passed, the count of the Implementer's 14-suite gate.
  - The other 30 suites all pass, 351 tests between them. Their counts are in the record.
  - The three new suites also passed when run alone, one at a time, with the same counts.
- [x] **The tests fail first.** The tests commit `4479e0df`, extracted with `git archive` into the scratchpad, with this worktree's `node_modules` linked in:
  - update-node: 0 passed, 37 failed;
  - the shared pieces: 1 passed (SN7), 6 failed;
  - the agent: 0 passed, 1 failed.

  That matches the plan's Verification exactly. `git diff 4479e0df HEAD -- test/` is empty, so the implementation changed no test.
- [x] **`bash scripts/harness-lint.sh`:** clean (0 violations) before this review was written, the new ledger row included. With this review in place, its L1 check expects the story to be Done (On PASS, below).
- [x] _Playwright not applicable: no UI._
- [x] _Lint, typecheck and build not configured: skipped._

## Spec adherence

- [x] **Every criterion has a passing test.** The plan's coverage map, checked against the suites:
  - AC1: UN1–UN3, UN7, UN9, UN12; the same call again in UN4, UN7 and UN9.
  - AC2: UN4–UN6, UN8, UN21 for the sections it changes, and UN32 for the name.
  - AC3: UN20–UN22, UN7's report, SN6, and UN37 for "nothing changes".
  - AC4: UN31's five cases, UN5, UN13; live L2.
  - AC5: UN23's three cases, UN6, UN5, SN1–SN4; live L5.
  - AC6: UN24–UN35 and UN38.
  - AC7: UN40; live L8c.
  - AC8: UN10, UN11, UN36, UN41, XU1; live L3, L4, L6 and L7.
- [x] **Each of AC6's refusals has its test.**
  - No node, and no concept but word: UN27, UN26.
  - Another operation's node, by concept and by label: UN24's eight cases. Firmware's own: UN25.
  - Nothing to change: UN34. A bad name, six ways: UN32.
  - Bad fields, nine ways, and a list in a JSON body: UN33.
  - The concept: `concept-needed` and `no-section` (UN29); `unknown-concept`, `reserved-key` and `not-its-concept` (UN28).
  - Unreadable JSON, five ways: UN30. Too long: UN33.
  - The rule's two refusals, a name in use and someone else's node: UN20, UN22, UN31, UN23.
- [x] **No criterion silently dropped.** Two small edges of AC6's wording are Non-blocking 2 and 3.
- [x] **No behaviour beyond the story.**
  - The catalog row, `CONCEPTS` and the `changes.js` widening are the ADR's Implementation notes.
  - The ledger row is harness friction the live check found.

**The Deviations,** each checked against the code. All seven hold:
1. `copies` reads again after the mapping: `update-node.js:303–308`.
2. The json tags are written only when the JSON changed: `:296`.
3. `changedElsewhere` takes `{ conceptUuids, labels, uuid }`: `_elements.js:135`.
4. Its own `bad-fields`, `unknown-node` and `not-installed`, and the reused codes: `update-node.js:36–47`, `:127`.
5. A description given two ways names `description` (`:148`); `no-section` names `concept`, else `fields` (`:215`).
6. `not-an-element` says which case it is: `:173`.
7. `firmwareElements` skips a file that doesn't parse, and keeps the first file for an address: `_elements.js:453`, `:457`.

**The Evidence, checked against `tmp/live-check-21/`.**
- The main phase ran 32 checks and 30 passed. L3b and L6h failed on the script's own mistakes, as the story says.
- **L3b rechecked:** 83 files, 76 with a node. The 7 without are the graph rule files. After the restart, 83 of 83, none twice, and the second reinstall left the 12 nodes with no differences.
- **L6h by hand:** 403, "Only the owner or an admin can do this."
- **The backup and the restore:** 2 of 2 and 3 of 3. L4e found no differences in the 12 nodes.
- **L2:** truly parallel, two `docker exec curl` processes per round. Each round answered `[200, 409]` and left one element of the name. In L2d the create made Racer and the rename was refused.
- **L7:** the relay held 461 events before and after.
- One small slip in where the Implementer's gate record says it ran: Non-blocking 7.

## ADR adherence

- [x] **The files match the Implementation notes:**
  - `update-node.js` (new);
  - `_nodes.js`'s `whoseNode`, `requireOwn` and `NOT_OWN_NODE`, with `reads.js` required on first call;
  - `_elements.js`'s additions, listed in its header index;
  - `_schemas.js`'s `every` option;
  - `changes.js`'s `was`, `now`, `field` and `change`;
  - the catalog's §2 row.
- [x] **The steps follow Decision 2's order** (`update-node.js`):
  1. what needs no graph (`:139–152`);
  2. the node's lock (`:156`);
  3. `requireOwn` (`:159`);
  4. `made-elsewhere`, `firmware-node` and `not-an-element` (`:162–174`);
  5. the header locks (`:178`);
  6. the concept (`:181–198`);
  7. the JSON and `no-section` (`:201–216`);
  8. the new JSON and its length (`:219–246`);
  9. `unchanged` (`:262–267`);
  10. `name-in-use` (`:270–281`);
  11. rule 4 with `every` (`:284–286`);
  12. the write, the marks, the answer and the entry (`:289–325`).

  Nothing is written before step 12 but the locks, which a refusal rolls back (UN37).
- [x] **Decision 3:** `own` is computed by `R.nodeOf` itself (`_nodes.js:72`), so a write counts a node as its own exactly when a read does (SN2). What that means for nodes that aren't letters is Non-blocking 4.
- [x] **Decision 4 and Amendment 1:**
  - concepts first, in `CHANGED_ELSEWHERE`'s order, then role labels (`_elements.js:108–150`);
  - a `Set` label counts only with an address (`:145`);
  - `word` and `graphContext` sections are left out of the judged concepts (`update-node.js:171`).
- [x] **Decision 5:** the node first, then each judged concept's header, in tapestryKey order from the sorted `conceptKeys` (`:162`, `:178`). UN13 counts the locks but not their order (Non-blocking 6).
- [x] **Decisions 8 and 9:**
  - the section is rebuilt with `Object.fromEntries` (`_elements.js:476–483`);
  - the rename's values follow only where they held what the old name gave (`:486–523`);
  - `name` and `slug` in `fields` are checked after the rename (`update-node.js:229–236`).
- [x] **Decisions 10–18.**
  - `repeatsOf` with `R.ownKeys()` and the TA's address.
  - `checkElements(..., { every: true })` on the changed, judged sections only.
  - `unchanged` before the name check and rule 4.
  - The writes, `addTags` for a missing name tag, the two flags, the answer's shape and the three kinds of change.
- [x] **Decision 20's codes and statuses** match the table. UN11 reads them off the listing.
- [x] **No new dependencies.** The one new runtime require is `reads.js`, at the top of `update-node.js`, as `list-elements.js` already does. At load, it requires only `./refusal`.
- [x] **create-element's behaviour is unchanged.**
  - `findRepeat` is `repeatsOf` with `authors: [ta]`, which runs the same statement with `e.pubkey IN [ta]`. create-element always passes a string address (`create-element.js:127–128`), so the parameters, the sort and the answer match the old ones.
  - `checkElements` without `every` throws exactly what it threw.
  - create-element's suites give story 20's round-3 counts: 33, 9, 7 and 1.

## Concept-graph integrity

- [x] **Handles are in `kind:pubkey:slug` form.**
  - Addresses are built as `39999:<TA>:<d>` from `K.assistant()` and `getOwnerAssistantPubkey()`, never a literal.
  - The diff adds no 64-hex literal.
- [x] **No firmware reinstall is needed.** No concept definition, firmware file or rulebook entry changes (ADR Consequences).
- [x] **Orientation:** the ADR's counts come from `/api/concept-graph/summaries`.

## Things tests can't catch

- [x] No secrets, no literal pubkey, no debug logging, no commented-out code and no TODOs in the diff.
- [x] **Concurrency.**
  - **Two updates of one node** serialize on the node's lock. Every read comes after it.
  - **The name check:** a rename and another rename, or a create, in any judged concept serialize on that header (live L2).
  - **Deadlocks:** one header order. update-node never locks the concept-header concept's header: a node of that concept is refused at step 4, before any header lock. The other writes that touch these nodes were read for a crossing order: update-concept, field mapping, create-element and unlink-set. None was found. Any deadlock is retried by `session.executeWrite` (`src/operations/graph.js:8–9`), and `apply` does nothing outside `tx`, so a retry is safe.
  - **The gaps:** Decision 5's known gap (link-set) stands. A create-element in a concept whose superset sits inside a judged concept's class thread takes another header's lock, so it isn't serialized with a rename. It needn't race to make a second element of the name: run after the rename, its repeat never looks in that thread. That is create-element's scope, and ledger row `2026-11-16-shared-set-creates-can-race` holds its fix.
- [x] **Prototype pollution: none.**
  - `fieldsOf` parses with `JSON.parse`. The merge, the rename and `canon` build objects with `Object.fromEntries`.
  - UN2 and the live L1e keep a `__proto__` field as an own field.
  - The probes left `Object.prototype` clean.
  - One blind spot: a concept whose key is `__proto__` (Non-blocking 1).
- [x] **Error paths.**
  - A tag with no tapestryKey, and a write count that doesn't match, are 500s that roll back (`:297–299`).
  - A write whose entry fails keeps nothing (UN39).
  - With no assistant key, `not-installed` comes before the lock (UN38).
- [x] **Injection.** Every input reaches Cypher as a parameter. U1 and R1 are fixed text; the only interpolations are firmware's relationship aliases, as before.
- [x] **Durability.**
  - A reinstall and a restore keep the change (live L3c, L4e).
  - An old letter imported again would undo it, as ADR 0016 says for update-concept. ADR 0021 doesn't carry that sentence over (Non-blocking 5).

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence

_Not applicable: the story traces to no PRD copy or design guide._

## Findings

### Blocking

None.

### Non-blocking

1. **`src/operations/catalog/graph/update-node.js:214`: a concept keyed `__proto__` gets past `no-section`, and the call answers `updated` and records a change it never stored.**
   - **The cause:**
     - for that key, `oldJson[targetKey]` is the inherited `Object.prototype`, an object, so `no-section` isn't thrown;
     - the merge starts from that object's own entries, of which it has none (`:226`);
     - `:243` puts the merged section only under an own key, so the JSON stays as it was and `:296` writes nothing.
   - **The probe:**
     - setup: gadget's key set to `__proto__`, and its schema made `{"type": "object"}`;
     - the call: `{ node: twoFaced, concept: gadget, fields: { weight: 3 } }`;
     - the answer: 200 `updated`, `changed: ["fields.weight"]`, with a `field-changed` change (`was: null`, `now: 3`);
     - the entries went from 1 to 2, and twoFaced's JSON is unchanged. `Object.prototype` stayed clean.
   - **Who reaches it.**
     - `toKeyName('__proto__')` is `__proto__`, and `nameProblem` passes the name, so this instance's own create-concept can make such a concept. Another author's header can carry the key too.
     - An own element lacks the section when link-set brings another concept's set into its class thread.

   Optional: require an own key at `:214` (`own(oldJson, targetKey)`), read `before` the same way, and add the case to UN29.
2. **`update-node.js:144–148`: the same description given both ways is refused when it has white space around it.**
   - `description` is trimmed (`:144`), then compared with `fields.description` as given (`:147`).
   - **The probe:** `description: " same, with spaces "` beside `fields: {"description": " same, with spaces "}` was refused 400 `bad-fields`.
   - The message reads "description is "same, with spaces", but fields gives the description "\" same, with spaces \"": give it one way, or the same both ways." AC6 refuses two values that differ. These are the same as given, and the message asks for what the caller did.

   Optional: compare the two as given, or say in the refusal that `description` is trimmed and `fields` isn't.
3. **`update-node.js:215`: `no-section` reached through `description` alone names `fields`, an input the call didn't give.**
   - Deviation 5 records the rule: `concept` when given, else `fields`.
   - **The probe:** Whiskers, with its pet section taken out, and `{ node, description: "a cat" }`, was refused 409 `no-section` with `input: "fields"`.

   Optional: name `description` when `fields` wasn't given.
4. **`src/operations/catalog/graph/_nodes.js:72–73` (`whoseNode`): what the shared test answers for nodes that aren't letters.** Decision 3 has merge-nodes (A10.25) and delete-node (A10.26) call `requireOwn` for D4. It reads `pubkey` as the author, as Decision 3 says, so:
   - **An `e`-tag placeholder** answers `own: true` and `hasLetter: true`. The import makes it as `NostrEvent {id, uuid}` with no `pubkey` (`src/api/neo4j/eventSync.js:268–270`), a stand-in for another author's event.
   - **The owner's and the assistant's `NostrUser` nodes** answer `own: true`, since their `pubkey` is the person.

   **The probe:** `whoseNode` over the fake's reader, in the suites' environment.
   - The `e`-tag placeholder: `{ own: true, author: null, hasLetter: true }`.
   - The owner's NostrUser: `own: true`.
   - An `a`-tag placeholder, which records its author: `own: false`.

   update-node can't reach either case: neither has a section to change, so a later step refuses it (`not-an-element`, or `unreadable-json`). The later writes can. Optional, for the Architect: say this in Decision 3, or open a ledger row pointing at A10.25 and A10.26.
5. **ADR 0021's Consequences (`0021-update-node.md:264–282`) leave out what ADR 0016 recorded for update-concept (`0016-create-concept-and-update-concept.md:151`): importing the old letter again undoes the change.**
   - **The route:** `POST /api/neo4j/event-update` deletes a node's tags and imports its event from the relay (`src/api/neo4j/eventSync.js:348–390`).
   - **The check:** `GET /api/neo4j/event-check` answers `in_sync` whenever the ids match (`:116–117`), as they do after update-node.
   - **Who calls the route:** the reading and dlist pages, after they publish a new letter (`ui/src/pages/reading/writeVerbs.js:280`, `ui/src/pages/lists/DListOverview.jsx:83`, `:104`). OPEN.md row 138 names it as a repair tool.
   - **What changes with update-node:** every lettered element of the instance's own can now differ from its letter (`letterOutOfDate`). Run on one with no new letter, the route brings the old tags back: an import destroying locally authored state, which principle 4 (BIBLE §30) rules out.

   Optional, for the Architect: carry ADR 0016's sentence into ADR 0021's Consequences, for elements.
6. **`test/operations/graph/update-node.test.js:417–418` (UN13): it counts the header locks, but doesn't check their order.**
   - Decision 5 avoids deadlocks by one order, and the code gets it from `.sort()` (`update-node.js:162`).
   - The fake logs no statement parameters (`test/helpers/graphFake.js:549`), so a change that dropped the sort would pass every suite.
   - The cost would be retried deadlocks, not a wrong graph.

   Optional: log a lock's key in the fake, and assert the order.
7. **The story's Evidence (`21-update-node.md:124`, `:133`) places the scoped gate "on `aee05dc7`". Its record, `20261117T031440Z-34420-84dc`, names `dff6a1ca`, with `dirty: true` and 7 uncommitted files.**
   - The record was taken a minute before `aee05dc7` was committed (03:14:40Z and 03:15:51Z). The 7 files are that commit's.
   - `git diff aee05dc7 6ec2c3a1 -- src test` is empty, and this review's gate ran on `fa44a6f7`, so what the claim says holds.

   Optional: say that the gate ran on the uncommitted implementation over `dff6a1ca`.

### Harness friction

1. **Known, seen again:** the role file and the template ask for a local `npm test`, which this Mac can't run (ledger row `2026-11-14-harness-points-tests-at-agent-memory`). A scoped gate gave this review its `gate:status` line. No new row.

## Verdict

**PASS**

**What holds.** update-node does what ADR 0021 and Amendment 1 decided, in Decision 2's order and with Decision 20's codes:
- it edits the stored JSON in place, holds each changed section to its concept's schema with every problem named, and signs nothing;
- it refuses another author's node with the one shared test, firmware's own elements, and the nodes another operation changes, by concept or by label;
- it locks the node, then each judged header in one order;
- create-element's behaviour is unchanged.

**The evidence.**
- Every criterion and every refusal has a test, and the tests failed first, as the plan records.
- 44 suites pass on `fa44a6f7`.
- The live check's records bear out the Evidence: the races, two reinstalls, a restore on a fresh instance, nginx, the relay, and the agent through the external CLI.

**The non-blocking findings** are an edge in the merge's key handling (1), two in how the input checks word a refusal (2, 3), a caveat on the shared test for the writes after it (4), a consequence ADR 0016 recorded and ADR 0021 should carry (5), a test gap (6) and an Evidence slip (7). None is required.

**Still to come:** the full gate, as the pull request's CI check. No firmware reinstall is needed.

## On PASS (same commit)

- [ ] Story `**Status:**` set to `Done` in place: left to the session's review commit, since this reviewer writes only this file. Until then harness-lint's L1 check reports one violation: this review is PASS and the story is still `Approved`.
- [ ] Completion detection: reported in the chat, not in this file.

---

## Round 2 — 2026-11-17 (HEAD `6a38f346`)

**Diff checked:** `git diff 6b6429be..6a38f346`: four commits, 8 files, 210 lines added and 14 removed.
- `0ec1f067` (test): UN42–UN44, in a `round2()` run of `update-node.test.js` over a seed of its own, for findings 1–3.
- `53bac579` (impl): the three fixes, in `update-node.js` alone.
- `36c7b382` (test): UN42's message cites Decision 6 and Amendment 2, where it cited Decision 8.
- `6a38f346` (docs): ADR 0021's Amendment 2, with in-place edits to Decisions 1, 6 and 20 and the Consequences; the story's Deviation 5 and Evidence; the test plan's "Added at review round 1"; and three ledger rows.

**How it was made.** An independent reviewer agent, with no Edit access, wrote this section at the session's request. It made no other write to a tracked file; its gate record is under the ignored `tmp/gate-runs/`.
- Every red-before-green run, probe and mutation ran in a scratch copy under the session's scratchpad (`git archive` of a commit, with this worktree's `node_modules` linked in), never in the worktree. `git status` was clean after each.
- It made no call to the local stack, any container, GitHub or Loom.
- It checked each changed statement as a new claim, round 1's own wording included (the role file's step 10). The independent check before the commit (workflow 5, P13) was not applied.

### Gates (run by the reviewer at `6a38f346`)

- [ ] **The full gate** (`npm test`): not run, for round 1's reason (ledger row `2026-11-14-harness-points-tests-at-agent-memory`). It runs as the pull request's CI check.
- [x] **The scoped gate:** round 1's 44 suites, in the order of its record `20261117T035222Z-97690-1f74`, through `test/helpers/gateRunner.js`. It ran on Node 24.18.0 with a clean tree, every endpoint dead as in round 1:
  - `NEO4J_URI=bolt://127.0.0.1:9`, `REDIS_HOST=127.0.0.1` and `REDIS_PORT=9`;
  - `BRAINSTORM_BASE_URL`, `TAPESTRY_BASE` and `MEILI_URL_HOST` at `http://127.0.0.1:9`;
  - `TAPESTRY_PORT=9` and `TAPESTRY_CONTAINER=no-such-container`.

  Its `npm run gate:status -- --label review-21-r2` line, with the worktree's absolute path shortened:

  ```
  20261117T043921Z-47707-62f4 [review-21-r2] started 2026-11-17T04:39:21.323Z on 6a38f346 — PASS, exit 0, 512 passed, 0 failed, 0 skipped, 44/44 suites · <worktree>/tmp/gate-runs/20261117T043921Z-47707-62f4.json
  ```

  - Suite by suite against round 1's record, only `operations/graph/update-node.test.js` moved: 37 to 40. Every other count is round 1's, among them update-node-shared 7, the agent suite 1 and create-element 33.
  - 509 and 3 make 512, the story's figure.
- [x] **Red before green.** `6b6429be`'s tree, with HEAD's `update-node.test.js` put over its own: update-node 37 passed, 3 failed, as the test plan's new section says. Each fails for its own reason:
  - UN42: 200 `updated`, `changed: ["fields.weight"]`;
  - UN43: 400 `bad-fields`, with the old message;
  - UN44: 409 `no-section`, naming `fields`. The suite cuts the body at 400 characters, before `input`, so the probe below shows it.

  The plan's quoted lines match these, with its elisions. Its UN42 line is the message from before `36c7b382`, and the parenthetical it elides is the part that changed.
- [x] **UN42's entry check has teeth.** On the old code each call to twoFaced with the `__proto__` key recorded an entry naming it: none before two such calls, two after. So that check would fail too, if the status check didn't stop the test first. Its JSON check passes on both codes, since the old code stored nothing either.
- [x] **Probes, on HEAD and on `6b6429be`'s code:** `probes/probe-r2.js` in the scratchpad, the real catalog through the harness over the fake graph, its state under `os.tmpdir()`. The results are in the table below. Round 1's `probe-edges.js`, rerun on HEAD, gives the fixed answers: `no-section` naming `concept`, `updated` with the trimmed text, and `no-section` naming `description`.
- [x] **One mutation,** in a scratch copy of HEAD: with the `.sort()` taken off `update-node.js:166`, update-node passes 40/0, update-node-shared 7/0 and the agent suite 1/0. That is ledger row `2026-11-17-fake-graph-logs-no-lock-order`'s claim.
- [x] **The live check's records** (`tmp/live-check-21/*-calls.json`). Of the 27 entries that touch update-node, none gave the `description` input, none answered `no-section`, and no concept's key was `__proto__`. So the story's reason for not running it again holds.
- [x] **The added lines:** no 64-hex literal, no debug output, no TODO, no `LEGACY_*` change, and no format or control character.
- [x] **`bash scripts/harness-lint.sh`:** clean (0 violations), before and after this section was written.

### Round-1 findings, re-checked

| Round 1 | Disposition | Check |
|---|---|---|
| NB1: a concept keyed `__proto__` | Fixed, as planned, and complete | `update-node.js:220` refuses `no-section` unless the section is one of the JSON's own keys and holds an object. `:232` reads `before` the same way, and `:264` the answer's slug. `:249` writes the section back through the JSON's own entries. The other readers keep own keys too: `mergeSection` and `renamedJson` build with a `Map`, `Object.entries` and `Object.fromEntries` (`_elements.js:476–523`), and `fits` judges the whole JSON (`_schemas.js:174`). So every read of the target section is now by own key. No test can pin `:232` or `:264`: past `:220` the section is always own, and an inherited `__proto__` has no text `slug`, so `slugOf` gave the name's slug before the fix too. They are defensive, and correct. The other side holds: a node whose JSON has an own `__proto__` section, as `JSON.parse` makes one, still changes (`weight` 1 to 3), answers `unchanged` the second time, and renames, that section's `name` and `slug` following, the key still own in the stored text. UN42 is a test in a run of its own rather than a UN29 case, and covers the same thing. |
| NB2: the same description both ways | Fixed, by a third option | `update-node.js:149–153`. A `fields.description` that is text is trimmed for the comparison, and takes the trimmed `description` when the two agree. Round 1 offered two options, comparing as given or saying in the refusal that only `description` is trimmed; this is neither. It also takes two values that differ as given only by white space: `"same, with spaces"` beside the same text with a tab before it and two spaces after was one value (`unchanged`). Amendment 2.2 records the choice, and Decisions 1 and 20 state it, which is where it belongs (Spec, below). In the probes, the same call again is `unchanged`; `" one "` beside `" two "` is `bad-fields`, with the new wording; and a number or `null` in `fields.description` beside `description` is `bad-fields`, as before. `fields.description` given alone is kept as given: `"  kept as given  "`, and `" as text "` in JSON text, were stored untrimmed. No test pins that (R2-3), and the published refusal text lags (R2-2). |
| NB3: the input `no-section` names | Fixed, as planned | `update-node.js:221` names `concept` when it was given, else `fields` when it was given, else `description`. On HEAD, `description` alone and `name` with `description` both name `description`; the old code named `fields` for both. `fields` alone names `fields`, and `concept` with `description` names `concept`. `fields: {}` with `description` names `fields`, which is the rule as written: the call gave `fields`. UN44 pins the first case. |
| NB4: the shared D4 test's answers | Filed, accurately | `ledger/2026-11-17-own-test-reads-pubkey-as-author.md`. Its cites hold at HEAD: `_nodes.js:71–72` (the author read from `pubkey`, then `own`) and `eventSync.js:268–270` (the placeholder `NostrEvent {id}`, with no `pubkey`). Round 1's `probe-whose.js`, rerun on HEAD in the suites' environment, gives the row's three answers: `{ own: true, author: null, hasLetter: true }` for the `e`-tag placeholder, `own: true` for the owner's NostrUser, and `own: false` for an `a`-tag placeholder. update-node can't reach either case: a node no concept reaches but word's is `not-an-element` (`update-node.js:176–177`), and a node with no json tag is `unreadable-json` (`:209`), whatever the call gives. Amendment 2.4 says the same. |
| NB5: the old letter imported again | Addressed, with two slips | The bullet at ADR 0021 `:275–279` carries ADR 0016's sentence (`0016-create-concept-and-update-concept.md:151`) over for elements, its `letterOutOfDate` and provenance lines included. Its `eventSync.js` cites hold: `:348–390` is `handleEventUpdate`, which deletes the node's tags and imports the relay's event, and `:116–117` answers `in_sync` when the ids match. OPEN.md row 138 names the route as a repair tool, and design §5's question 2 is provenance. `writeVerbs.js:280` is the call after the reading page's publish. But what the bullet says of the DList page, and what it implies of the reading page, don't hold: R2-1. |
| NB6: the lock order | Filed, accurately | `ledger/2026-11-17-fake-graph-logs-no-lock-order.md`. Its cites hold: the sort at `update-node.js:166`, the locks at `:182`, UN13 at `update-node.test.js:400`, and the fake's log at `test/helpers/graphFake.js:549–550`, which keeps each statement's kind and text but not its parameters. `S.lockNode` runs one statement for every key (`_sets.js:246–249`). The mutation above bears out the row's central claim. The test plan's note says the same, and keeping out of the shared fake is a fair reason. |
| NB7: the gate's commit | Fixed, with a slip | `aee05dc7` exists, its parent is `dff6a1ca`, and it was committed at 03:15:51Z with 7 files. The record started at 03:14:40Z, with `dirty: true`. But the record doesn't list the files: R2-4. |
| The row from NB1 | Filed, accurately | `ledger/2026-11-17-concept-key-can-be-proto.md`. Checked with node: `toKeyName` (`conceptNames.js:87`) gives `__proto__` and `nameProblem` (`:137`) gives `null`; assigning the key sets the prototype, and `JSON.stringify` then drops the section; `JSON.parse` keeps it as an own key. create-concept runs `nameProblem` through `cleanInputs` (`_concepts.js:109–126`), and `deriveAllNames` gives the key `__proto__`, so "create-concept can make such a concept" holds by reading. |

The three ledger rows' ids fit OPEN.md's pattern and are repeated in their `**Id:**` fields. Each has the template's header fields: a Type from the list, an ISO Opened date with its source, `OPEN`, `—` and a Pointer. L15 is clean.

### Spec, ADR and concept graph

- **Spec.**
  - UN42–UN44 add to AC6's `no-section` and AC1's `description`, and the 37 earlier tests pass unchanged.
  - AC6 refuses "a `description` given both on its own and in `fields`, with different values". The code now takes two that differ only by white space around them, and the field takes the trimmed text, which is what `description` alone would store. That reading of "different values" is the ADR's to make, and Amendment 2.2 makes it.
- **ADR.**
  - Amendment 2's seven items match the code and the runs, apart from R2-1 and R2-3.
  - A small slip: the amendment says each in-place edit names it, but Decision 20's `bad-fields` row doesn't. Its `no-section` row does.
- **The phases kept to their lanes.** The two test commits touch only `update-node.test.js`, the implementation commit only `update-node.js`, and the docs commit neither. The tests came first.
- **Concept graph and house rules.** No handle, concept definition or firmware changed, so no reinstall is needed. No tooling was added.
- **The invariants.** Unchanged since round 1. The round changes what this instance's own write refuses, and how it compares its own inputs.

### Findings

#### Blocking

None.

#### Non-blocking

1. **R2-1. ADR 0021 `:277–278`, the new Consequences bullet: its account of who calls `event-update` is wrong in one place and too narrow in the other.**
   - **The DList page doesn't call it after a publish.** `DListOverview.jsx:83` and `:104` are the calls behind its "Import to Neo4j" and "Import + expand" buttons, shown when `event-check` answers `missing_from_neo4j` (`:235`). "Update in Neo4j", shown for `neo4j_outdated` (`:272`), reaches `:83` too, through `handleImportOrUpdate` (`:203–205`). An `in_sync` node, which an updated element is, gets no button (`:227–233`). The wording was round 1's own, in its finding 5, carried over.
   - **The reading page's new letter can undo a rename.** Its `edit` builds the letter from the relay's newest event at the address:
     - the tags are that event's (`writeVerbs.js:267`);
     - the `name` tag is replaced only when the page itself renames (`:268`), and `nameChanged` (`:251`) compares with the graph's name (`:73`, `:200`), which update-node already set;
     - the json tag is taken from the graph.

     So after update-node renames one of this instance's own lettered elements, a text edit of it on the reading page signs a letter that still has the old `name` tag. `event-update` then deletes the node's tags and imports that letter, and the import sets the node's `name` from it (`eventSync.js:227–230`). The node is left with its old `name` and name tag, but its new `tapestryValue`, which the import doesn't set, and its new JSON. That is the principle-4 loss the bullet records, through a new letter.
   - **Who reaches it.** The page edits only an element whose letter, signed by the assistant, is on the relay (`writeVerbs.js:258–259`). So an element `graph create-element` made, which has no letter, is out of reach.
   - **How it was found:** by reading the code. No stack was used.

   Asked: correct the bullet. The fix is the reading page's, outside this story's code: take the `name` tag from the graph, as `edit` takes the json tag, or refuse an edit when the graph's name differs from the letter's. A ledger row would hold it.
2. **R2-2. `src/operations/catalog/graph/update-node.js:37`: `bad-fields`' published `when` still says "a description given on its own and in fields with different values".**
   - Decision 20's row now says "differ once trimmed", and the code takes two that differ only by white space.
   - The `when` text is what the operations listing (`src/operations/index.js:67`), `/docs` (`src/operations/openapi.js:50`) and the command's help (`src/operations/cli.js:65`) publish.

   Asked: the one line, worded as Decision 20 words it.
3. **R2-3. ADR 0021 `:377`: "UN43 pins it" follows a sentence no test pins.**
   - Amendment 2.2's last bullet says `fields.description` given alone is kept as given. UN43 gives it both ways.
   - The probe shows the behaviour holds. But a change that trimmed every text field in `fields` would pass every suite.

   Asked: a case of `fields.description` alone, with white space around it, in UN43's run; or the attribution moved to the bullet before it.
4. **R2-4. `engineering-team/stories/graph-operations-first-slice/21-update-node.md:133`: "the record says `dirty: true` and lists 7 files".**
   - The record counts them, `dirtyCount: 7`, and names none.
   - That they were `aee05dc7`'s seven is a fair inference from the count and the minute, but the record doesn't say it. Round 1's finding said "7 uncommitted files"; this sentence goes a step further.

   Asked: "counts 7 changed files (`dirtyCount: 7`)".

### Harness friction

1. None new. The known one recurred: the role file and the template ask for a local `npm test`, which this Mac can't run (ledger row `2026-11-14-harness-points-tests-at-agent-memory`). The scoped gate gave this round its `gate:status` line.

### Close-out (not committed)

- The story's status line stays `Done`.
- This section is written but not committed: the session commits it.
- Completion detection: reported in the chat, not in this file.

### Verdict (round 2)

**PASS**

Round 1's seven findings are each fixed or filed as planned. The three code fixes are correct and complete, each is pinned by a test that fails on `6b6429be`'s code for its own reason, and the 44-suite scoped gate is clean on HEAD. The four new findings are three doc slips and one test gap, none of which blocks the merge. R2-1 is the one worth doing before the pull request: the bullet it corrects was written to record a principle-4 loss, and the reading page reaches that loss through a new letter. The full gate still runs as the pull request's CI check.
