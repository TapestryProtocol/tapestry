# Review: Story 23 — `graph move-element`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-18
**Diff:** `git diff 4d764dd7..0b4a9f7c`: 15 files, +2345 −6. `4d764dd7` is staging's head when the branch was cut. The range holds the story's four phase commits:
- `dc568af8`: the story and the epic's entry;
- `ae481eb4`: ADR 0023 (Option A, accepted) and the four story amendments;
- `f763e1ad`: the test plan, the two suites, the seed `test/helpers/moveElementGraph.js`, and the fake graph's new `failures.beforeRelDelete`;
- `0b4a9f7c`: the implementation, the catalog row, the two ledger rows, the story's Deviations, and a rewording of ADR Decision 11.

**Against:**
- the story, [23-move-element.md](../../stories/graph-operations-first-slice/23-move-element.md), as amended at Architecture;
- [ADR 0023](../../decisions/graph-operations-first-slice/0023-move-element.md), Decisions 1–15;
- the [test plan](../../stories/graph-operations-first-slice/23-move-element.test-plan.md), and the live-check record in the ignored `tmp/live-check-23/`.

**How it was made.** A reviewer agent with no Edit access wrote this review at the session's request.
- It ran the gate itself, with every endpoint dead.
- Its breaks, its probe and the red-before-green run used scratch copies under the session's scratchpad: a `git archive` of a commit, with the main checkout's `node_modules` linked in. None ran in the working tree, and `git status` was clean after each.
- It made no call to the local stack, any container, GitHub or Loom.
- The independent check before the commit (workflow 5, P13) wasn't applied.

**Verdict:** PASS, with four non-blocking findings.

## Quality gates (run by reviewer, not trusted)

- [ ] **The full gate** (`npm test`) was not run. On this Mac the local stack is the owner's agent-memory instance, and the full suite writes to it. It runs as the pull request's CI check.
- [x] **The scoped gate** at `0b4a9f7c`, with `PATH="$TMPDIR/stubs:$PATH"` (stub `curl` exits 7, stub `docker` exits 1), `BRAINSTORM_BASE_URL=http://127.0.0.1:9`, `TAPESTRY_PORT=9`, `TAPESTRY_CONTAINER=no-such-container` and `TAPESTRY_CONTAINER_PORT` unset. Its five suites were `operations.test.js`, `external-cli`, `openapi-coverage`, `admin-action-sweep` and `schema-save-finds-the-right-header`. Its `npm run gate:status -- --label a10-23-review-r1` line, with the path shortened:

  ```
  20261118T231213Z-75121-1f40 [a10-23-review-r1] started 2026-11-18T23:12:13.109Z on 0b4a9f7c — PASS, exit 0, 1187 passed, 0 failed, 6 skipped, 5/5 suites · …/tmp/gate-runs/20261118T231213Z-75121-1f40.json
  ```

  - The tree was clean: there is no `+dirty`.
  - By suite: operations 1086 passed, 4 skipped; external-cli 53; openapi-coverage 13; admin-action-sweep 9; schema-save-finds-the-right-header 26, 2 skipped. The six skipped are live tests: LK1–LK4, L1 and L2.
  - The operations run holds move-element 44/44 and the agent's XE1 1/1. It also holds the neighbours the test plan names, all passing, among them the fake graph (31) and add-to-concept (57).
  - The total matches the 1187/0/6 the implementation commit reports.
- [x] **`bash scripts/harness-lint.sh`:** `harness-lint: clean (0 violations)`.
- [x] **Red before green.** On `f763e1ad`'s tree, extracted: move-element 1 passed, 43 failed (ME0 passes, as it should); the agent 0/1. That is the plan's Verification exactly.
- [x] **The phases kept to their own files:**
  - `git diff f763e1ad 0b4a9f7c -- test` is empty, so the implementation changed no test;
  - `git diff ae481eb4 f763e1ad -- src firmware docs` is empty, so the test phase changed no code;
  - `git diff 4d764dd7 ae481eb4 -- src test` is empty.
- [x] **The merge.** `git merge-tree --write-tree origin/staging 0b4a9f7c` is clean. Staging, now at `423006a7`, is 19 commits ahead, and none of them touches `src/`, `test/helpers/` or `test/operations/`.
- [ ] `npm run test:playwright` doesn't apply: there is no UI change.
- [ ] _Lint not configured — skipped._ _Typecheck not configured — skipped._ _Build not configured — skipped._

### Breaking the real code

The plan's W1–W14 were run against a throwaway reference. So 48 breaks were applied to this code, `0b4a9f7c`'s `move-element.js` (and, for the last one, `relationship-type-allowed.js`), one at a time. Each ran against the move suite in a scratch copy, and the file was put back after each.

| Broken | Failed |
|---|---|
| no `same-set` | ME31, ME43, ME44 |
| no `not-installed` | ME44 |
| no lock on the node | ME20, ME21, ME22, ME23 |
| the node read before the lock | ME20 |
| a lock on `from` too | ME20 |
| no `tag-node` / no `made-elsewhere` / no `not-a-set` | ME33 / ME34 / ME35 |
| word counted among the shared concepts | ME36 |
| no `different-concepts` | ME30, ME36, ME43 |
| the repeat judged before `different-concepts` | ME36 |
| the outermost shared concept | ME15 |
| no repeat (`already-moved`) | ME3, ME20, ME21 |
| `from`'s links and those below it (remove-from-concept's reading) | ME20, ME22, ME37 |
| `not-in-from` naming no holder | ME22, ME37 |
| no `firmware-membership` / no `author-claim` | ME38, ME43 / ME39, ME43 |
| the concepts judged before the claims | ME38, ME39, ME40 |
| no `leaves-concept` / no `joins-concept` | ME40, ME43 / ME41, ME43 |
| "after" read with `from`'s links still in | ME38, ME39, ME40, ME43 |
| word and graphContext judged in `left` and `joined` | ME14, ME17 |
| a delete that finds nothing ignored / always refused | ME24 / ME24 |
| no link into `to` | 16 tests, ME1 to ME22 |
| the `n` naming `from` not taken out | ME4, ME5, ME7, ME17 |
| tags written for a node kept beside | ME11, ME12, ME17 |
| an `n` for a superset `to` | ME4, ME17 |
| an `n` added though one names `to` | ME7, ME8, ME17 |
| no `n` added | ME1, ME5, ME6, ME17 |
| a tag with no tapestryKey ignored | ME27 |
| `letterOutOfDate` for any lettered own node | ME8 |
| no own-letter entry in `letters` / no relationship events | ME4, ME5, ME6 / ME4 |
| `cacheOutOfDate` always false | ME5, ME11 |
| no pass-1d sentence in the note | ME10, ME11 |
| no redundant-link sentence / `from`'s own link counted as still holding | ME10 / ME10 |
| `membership-added` recorded though `to` held the node | ME7 |
| no `count` | ME9 |
| the entry's `concept` dropped | ME2, ME7, ME15 |
| the declared refusals out of order / `repeatKey` without `to` | ME19 / ME19 |
| reserved-type words reverted (`relationship-type-allowed.js:42`) | ME45 |

Four breaks failed nothing:
- **A `MERGE` into `to` even when it holds the node** (`move-element.js:325`): `MERGE` matches the link that is there, so nothing differs. This is equivalent code, not a gap.
- **The new `n` at index 0, not `tags.length`** (`:333`): a tag's uuid also hashes its type and value, and no live `n` names `to` when one is added, so no index gives a live collision. A tag's tapestryKey is `randomUUID()`. This is equivalent too.
- **The pass-1d sentence for any superset `from`,** with or without a `z` naming its concept (`:305`): a test gap (non-blocking 4).
- **`already-moved` answering `concepts: []`** (`:270`): a test gap (non-blocking 4).

## Spec adherence

| AC | Evidence | Result |
|---|---|---|
| AC1, move an element | ME1, ME2, ME4, ME5, ME15–ME18, ME20; live L1 | Met |
| AC2, safe to repeat | ME3, ME7, ME8, ME20–ME24; live L5, 32 races | Met |
| AC3, two sets of one concept | ME14, ME36, ME43; live L1e | Met |
| AC4, the node's concepts stay the same, word and graphContext aside (amendment 3) | ME13, ME14, ME17, ME40, ME41 | Met |
| AC5, what it refuses | ME31–ME39, ME42–ME44, and the list in Decision 14's order (ME19); live L1f, L6, L7 | Met |
| AC6, anyone's node | ME11, ME12, ME1 and ME4–ME8 for the instance's own tags; live L6b | Met |
| AC7, it lasts, and it reaches agents (amendment 2) | ME10, ME18, ME19, ME30, XE1; live L1–L4, L8, L9 | Met |

- [x] **Every acceptance criterion has a passing test.**
- [x] **No criterion is silently dropped.** AC7's reinstall, restore, nginx and relay halves are live-only, as the plan says, and the record has them.
- [x] **No behaviour added that isn't in the story.** Every refusal, the note's two reinstall sentences and the cache flag are the ADR's.

## ADR adherence

- [x] **Decision 2's order is the code's.** In `apply`: `same-set` (`:197`), `not-installed` (`:198`), the lock (`:201`), then the node (`:204–208`). Then `from` whole and `to` whole (`:212–219`), `different-concepts` (`:253–260`), the repeat and `not-in-from` (`:268–281`), the claims (`:289–293`), and `leaves-concept` then `joins-concept` (`:296–297`). Decision 14's list (`:183`) is that order, with its statuses.
- [x] **Decision 3:** the node's lock, before any read, and no other. The breaks above confirm it.
- [x] **Decisions 4–7:**
  - E2 is read for each set, word's and graphContext's keys set aside. The innermost shared concept is found by M2, with the lowest key among ties.
  - M1 from `from` is kept to its own links. `inTo` comes from `isElementLink`.
  - "After" is `conceptsOfNodes(…, { without })` with `to`'s concepts. `left` and `joined` count no reserved key.
  - `firmwareMembership` and `authorClaim` are given `left`, as remove-from-concept gives them.
- [x] **Decisions 8–10:**
  - The pair delete comes first. A delete that finds nothing answers `already-moved` when `to` now holds the node, else `not-in-from`.
  - Then the `MERGE` into `to` unless it was there, then the `n` tags, for a `json-tag` node only.
  - `letterOutOfDate` is true only when a tag changed. `letters` words the node's own letter here and adds `ownLetters`' relationship events. `cacheOutOfDate` is read from R1.
- [x] **Decisions 12 and 13:** the answer's and the entry's shapes are the ADR's. `graph history` finds a move by node, `from`, `to` and concept (ME2), and finds a both-sets move by node, `from` and concept (ME7, amendment 4).
- [x] **Decision 15, the shared files:**
  - Only the four named files change outside `move-element.js`: `relationship-type-allowed.js:42` (the words and their comment), `changes.js`'s header, `_sets.js`'s header comment, and the catalog row.
  - `git diff` shows no change at all to `_memberships.js`, `_elements.js`, `_fields.js`, `_nodes.js`, `_eventless.js` or `remove-from-concept.js`, so no shared helper gained an export.
  - The test-side edit is the fake's new failure, which the plan names and ME0 tests.
- [x] **Reuse, not re-derivation.** Every read is story 22's or story 28's helper: M1, M2, E2, `conceptsOfNodes`, `lookedAfterElsewhere`, `firmwareMembership`, `authorClaim`, `ownLetters`, `kindOf` and `supersetOf`. The three statements copied from remove-from-concept (pair delete, C11, R1) match their sources character for character, with comments pointing there, as the Implementation notes allow.
- [x] **The Deviations, each checked against the code:**
  1. `concepts` is read after the move (`:366`), and `already-moved` uses `before` (`:270`).
  2. `from` is checked whole, then `to` (`:218–219`).
  3. `different-concepts`' way on is right (`:111–114`).
  4. `not-in-from`'s holders are each named once, sorted (`:272–280`).
  5. The pass-1d sentence's condition is right (`:302–307`), though its negative isn't tested (non-blocking 4).
  6. The own letter's words are worded here (`:338–341`).
  7. `firmware-membership` keeps `M.say`'s words (`:290`).
  8. `guards: []` is declared (`:186`).
  9. The ledger row is typed `bug`.
- [ ] **An accepted ADR edited in place at Implementation:** Decision 11's first sub-bullet (`0023-move-element.md:229`). Non-blocking 2.
- [x] **No new dependencies.** `package.json` and `clients/` are unchanged.

## Concept-graph integrity

- [x] **Handles:** none is written in code. The assistant's key is read at run time: `K.assistant()`, `R.ownKeys()`, and `getOwnerAssistantPubkey()` inside `firmwareMemberships`. The `src/` diff adds no 64-hex literal and touches no `LEGACY_*` constant.
- [x] **Firmware reinstall:** not required. No concept's definition and no rule element changes (ADR Consequences 5). The rulebook doesn't list `HAS_ELEMENT`'s makers, so it needs no edit (Context 8).
- [x] **New code** reads the graph through the operations' helpers. It doesn't re-derive concepts from BIBLE.md.

## Things tests can't catch

- [x] **No secrets in committed files.** The live check's throwaway keys are in the ignored `tmp/live-check-23/keys.json`, mode 600.
- [x] **No `console.log`, `TODO` or `debugger`** in the `src/` diff, and no commented-out code.
- [x] **Error paths:**
  - an entry that can't be recorded keeps nothing (ME25);
  - a node deleted meanwhile answers `unknown-node` (ME26);
  - an `n` with no tapestryKey stops the move with a 500 naming `lifecycle migrate` (ME27).
- [x] **Concurrency.**
  - **The node's lock** serialises every element write on the node.
  - **The add side has no open race.** Under that lock only a relationship `DELETE` can change the node's links unseen, since creating or `MERGE`ing a relationship locks both of its ends. So a legacy `add-to-set` waits behind the move, and the open side is the delete, which Decision 8 handles (ME24, and the two breaks of it).
  - **Two opposite moves can't deadlock.** Neither locks a set before its node, so S1→S2 and S2→S1 on two nodes form no cycle.
  - **Live:** L5 ran 32 two-move races, 26 of them overlapping. Each gave one move, one entry, and either `already-moved` or `not-in-from` naming where the winner put the node.
- [x] **Security:** `node`, `from` and `to` pass `N.keyInput`'s pattern and reach Cypher as parameters. The only text built into a statement is firmware's relationship alias.

### The live-check record, checked against its raw outputs

- **The code:** the record's `move-element.js` digest, `d163986fd76a9e04`, is the first 16 hex digits of the committed file's sha256 (`d163986f…84eba98`). So the live check ran this file. `main.log` reads `21 of 21 passed`, and `races.log`, `reinstall.log` and `restored.log` pass.
- **The refusals:** `report-main.json`'s details for L1e, L1f, L6a, L7, L8 and L9 match `results.md`:
  - `different-concepts` names add-to-concept, then remove-from-concept;
  - `not-in-from` names agility's key;
  - `author-claim` names the peer and "the next pull of their class thread";
  - `firmware-membership` names `concepts/json-data-type/manifest.json`;
  - the access checks gave 401 and 403;
  - the relay held 466 events before and after.
- **The reinstalls:** `report-reinstall.json` shows the superset link Decision 11 now describes. After each reinstall, Filed, Snoopy, Hopper and PeerZ went from `"was":[]` to the superset's key. Hopper is the case the rewording rests on: create-element made it in a set, and it was never under the superset. Filed and PeerZ, both filed out of the superset, are in `from` again, as amended AC7 allows. Every node is still in `to`, in its sets and in its concepts.
- **The restore:** `report-restored.json` has each moved node directly in `to` and not in `from`, with the same sets, concepts, tags and JSON.
- **Not hashed:** the live check ran `f763e1ad` plus the uncommitted implementation, and hashed only `move-element.js`. The other `src/` edits are a string, which ME45 pins, and two comments.

## House rules check

- [x] **Concept Graph API authority respected.**
- [x] **No new lint/typecheck/build tooling.**
- [x] **The TA pubkey is never hardcoded.**

## Product-guide adherence

Not applicable: the story traces to no PRD.

## Findings

### Blocking

None.

### Non-blocking

1. **`docs/GRAPH_OPERATIONS_CATALOG.md:113`: the row says `different-concepts`, `leaves-concept` and `joins-concept` "each nam[e] `add-to-concept` and `remove-from-concept` as the way on". Not all three do.**
   - `joins-concept`'s way on is add-to-concept, then this call again (`move-element.js:141`).
   - `different-concepts` leaves remove-from-concept out when `from` is in word alone (`:113`), and names neither when `to` is in no counted concept (`:111`).
   - The code matches ADR Decisions 4 and 7; only the row overstates.
   - **Fix:** "`different-concepts` and `leaves-concept` naming `add-to-concept`, then `remove-from-concept`, as the way on, and `joins-concept` `add-to-concept`, then this call again".
2. **`engineering-team/decisions/graph-operations-first-slice/0023-move-element.md:229`: Decision 11 was edited in place in `0b4a9f7c`, after the owner accepted the ADR.**
   - The replaced clause, "and was there before the move too", was wrong. The new one is right: at live L2/L3's first reinstall, Hopper gained the superset's link. create-element made Hopper in a set, and it was never under the superset.
   - But this epic records a change after acceptance as a dated Amendment, as ADR 0028's Amendment 2 ("at Implementation; the owner's approval") does. Here only the commit message and an inline parenthetical say it changed. The story's Deviations don't mention it.
   - **Fix:** the owner ratifies it at the gate. Then either move it into `## Amendment 1 (2026-11-18, at Implementation) — …`, quoting the replaced clause, or add one line to the story's Deviations.
3. **`ledger/2026-11-18-author-claim-words-misname-n-remaker.md:16`: "so only remove-from-concept's answer is off" understates the row's reach.**
   - move-element declares `author-claim` with `M.AUTHOR_CLAIM` (`move-element.js:183`), as Decision 14 says.
   - So its `/docs` entry (`src/operations/openapi.js:50`) and its CLI help (`src/operations/cli.js:65`) show that declaration's `when` (`_memberships.js:60`): the claim "the next import would make again". That is the wording the row calls wrong.
   - The row's fix shape, where the `when` follows, corrects move-element's docs too.
   - **Fix:** the row names move-element's `/docs` entry and help text as carrying the declaration's words.
4. **Two answers the suite doesn't pin** (`test/operations/graph/move-element.test.js:403–415`, `:306–319`):
   - **The pass-1d sentence's negative.** ME10 checks that the sentence is absent only for moves whose `from` is a set. A move out of a superset by a node with no `z` naming its concept, such as the person node, the placeholder or firmware's `fwNumber`, isn't checked. So making the sentence unconditional for any superset `from` (`move-element.js:305`) passes all 44 tests. That would tell a caller a reinstall relinks a person node, which it doesn't.
     - A probe added `for (const id of ['person', 'placeholder', 'firmware-own']) assert(reinstallSentences(note(id)).length === 0, …)` to ME10.
     - It passed on `0b4a9f7c`, and failed on both the unconditional break and a break that drops only the `z` test.
   - **`already-moved`'s `concepts`.** ME3 doesn't check it, so answering `[]` passes. Asserting `keysOf(again.concepts)` is `[beagle]` in ME3 would pin it.
   - **Fix:** a Tester's change. Neither breaks an acceptance criterion as the code stands.

### Harness friction

None new.

## Verdict

**PASS**
- Every acceptance criterion has passing tests, and AC7's live half is in a record whose raw outputs match it.
- The code follows ADR 0023's Decisions 1–15 in order. It reuses story 22's and story 28's reads, gives no shared helper a new export, and keeps its shared-file edits to the four the ADR names.
- The scoped gate and harness-lint pass. 44 of 48 breaks of the real code are caught, and the other four are two equivalent changes and the two gaps in non-blocking 4.
- The four findings are a catalog row's wording, an ADR edit to ratify, a ledger row's scope and two unpinned answers. None makes the operation wrong.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place, and its Review link filled in.
- [x] Completion detection performed. Its result goes in the chat, not this file.
