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
