# Review: Story 26 — `graph delete-node`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-17
**Diff:** `git diff origin/staging...HEAD`, at `4ed257af`. The base is `b51a2507`, staging's head when the branch was cut. The range holds the story's commits:
- `bcd2cb31`, `c6ad1f7b` and `823edb29`: the story, ADR 0026 and the epic's entry, approved at their gates and on PR #124, which isn't merged yet;
- `8439efc5`: the test plan and the failing tests, approved at the Test Design gate;
- `80189eb3`: a kick-back to test design found at implementation: `fieldGraph.js`'s letters get a `created_at`;
- `608bf8ae`: the implementation;
- `b219178d` and `4ed257af`: the live check's evidence, and ADR Amendment 2, approved at the Implementation gate.

**How it was made.** The session wrote this review as the Reviewer. Beside it, an independent reviewer agent, read-only and told nothing of the session's conclusions, audited the same diff against the story, the ADR and the test plan. Each of its findings was checked against the code before it went in below.

## Quality gates (run by reviewer, not trusted)

- [ ] **The full gate** (`npm test`): not run here.
  - **Why:** on this Mac the local stack is the owner's agent-memory instance, and the full suite writes to it.
  - **Where it runs:** as the pull request's CI check.
- [x] **A scoped gate, run by the Reviewer** at `4ed257af`, with every endpoint dead (`NEO4J_URI=bolt://127.0.0.1:9`, `REDIS_PORT=9`, and `BRAINSTORM_BASE_URL`, `TAPESTRY_BASE` and `MEILI_URL_HOST` at `http://127.0.0.1:9`):
  - the three new or changed suites;
  - the suites the change touches: update-node and its agent, create-element, element schemas, map-fields, mark-field, unmark-field, fields, the fake graph, the write path, update-concept, remove-relationship and history;
  - two route-surface suites, `openapi-coverage` and `admin-action-sweep`.

  Its `npm run gate:status -- --label delete-node` line, with the worktree's path shortened:

  ```
  20261117T142651Z-20646-df80 [delete-node] started 2026-11-17T14:26:51.984Z on 4ed257af+dirty — PASS, exit 0, 270 passed, 0 failed, 0 skipped, 18/18 suites · …/tmp/gate-runs/20261117T142651Z-20646-df80.json
  ```

  `+dirty` is the untracked `node_modules` link alone (ledger row `2026-11-16-worktree-node-modules-link-untracked`): no tracked file differs from `4ed257af`.
- [x] **The whole operations runner** (`test/operations.test.js`, stack-free, every suite under `test/operations/`): 806 passed, 0 failed, 4 skipped, on the code at `608bf8ae` (the story's Evidence). The 4 skipped are `lifecycle/shared-keys.test.js`'s live tests, which need a named scratch container.
- [x] **The other route-surface suites,** `admin-action-sweep-access` 13 passed and `admin-action-sweep-named` 6, at `608bf8ae`.
- [ ] `npm run test:playwright`: not applicable; no UI changes.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] **Every acceptance criterion has a passing test.**

  | Criterion | Tests |
  |---|---|
  | AC1: delete an element, with its relationships and tags | DN1–DN5, DN8, DN12; live L1, L2 |
  | AC2: safe to repeat, one at a time | DN6, DN7, DN16, DN17, DN21; live L1e, L4a, L4b |
  | AC3: never someone else's node, a person node or a placeholder | DN22–DN24, SN8–SN13; live L3a, L3e, L3f |
  | AC4: what else it refuses | DN8, DN11, DN25–DN31, DN33; live L3b–L3d, L3g, L3h |
  | AC5: the letter and the cached copy stay | DN1, DN2, DN8–DN10; live L2b, L2c, L5 |
  | AC6: history keeps what was deleted | DN3, DN4, DN9, DN14, DN29 |
  | AC7: it lasts, and it reaches agents | DN12, DN13, DN15, DN32, DN34, XD1; live L6–L8 |

- [x] **No criterion is silently dropped.** AC7's live half ran on a scratch stack (the story's Evidence). The read-only counts on staging and production (live L9) wait for the owner's yes, as the ADR's Consequences say.
- [x] **No behavior added that isn't in the story.** The write path's second try serves AC2 (ADR Decision 6). update-node's two new refusals follow from AC3's "every operation that calls it agrees".

## ADR adherence

- [x] **Files changed match the ADR's Implementation notes:**
  - `delete-node.js` (new);
  - `_nodes.js` (`factsOf`, `refuseUnlessOwn`, the two declarations);
  - `update-node.js` (its refusal list only);
  - `write.js` (Decision 6);
  - `changes.js` (Decision 12's descriptions);
  - the catalog's rows.
- [x] **The statements are the test plan's** (Amendment 1): U0, D1–D4 and D6, which DN0 holds the fake to.
- [x] **Small deviations are logged** in the story's Deviations, and none changes a decision.
- [x] **Amendment 2** records the live finding: Neo4j 5.26 gives no error to a statement that waited for a node another write deleted. The races resolve on the lock and the read after it, and the second try stays as a safety net. The owner approved it.
- [x] **Layering / module boundaries respected:** the declaration calls the shared helpers; nothing in it signs, publishes or reads a key (DN34).
- [x] **No new dependencies.** `package.json` and the CLI's are unchanged.

## Concept-graph integrity

- [x] **Handles:** none are written in code. The assistant's key is read at run time (`K.assistant()`, `R.ownKeys()`, `S.aliases()`), never hardcoded.
- [x] **Firmware reinstall:** not required. No concept's definition changes, and the rulebook gains no entry (ADR Consequences).
- [x] **New code** reads the graph through the operations' own helpers. It doesn't re-derive concepts from BIBLE.md.

## Things tests can't catch

- [x] **No secrets in committed files.** The live check's throwaway keys are in the ignored `tmp/live-check-26/`.
- [x] **No leftover debug logging or `console.log`** in `src/`.
- [x] **No commented-out code.**
- [x] **Error paths and edge cases** are handled where it matters. A count that differs from what was read rolls the delete back with a plain error (Decision 7's gap). A tag with no tapestryKey stops the delete with an error naming `lifecycle migrate`.
- [x] **Concurrency** was checked live (L4): two deletes at once, and a delete beside an update-node, three times each.
- [x] **Security:** `node` is checked by `N.keyInput`'s pattern before it reaches Cypher, and goes in as a parameter. The only text built into a statement is constants: the cap, and the arrow's direction.

## House rules check

- [x] **Concept Graph API authority respected.**
- [x] **No new lint/typecheck/build tooling.**
- [x] **The TA pubkey is never hardcoded** (CLAUDE.md): the diff adds no 64-hex literal to `src/`.

## Product-guide adherence

Not applicable: the story traces to no PRD.

## Findings

### Blocking

None.

### Non-blocking

The independent check raised N1–N8, and each was checked against the code before it went in.
1. **`src/operations/catalog/graph/delete-node.js:231–236`: a node with two `HAS_TAG`s to one tag can't be deleted.**
   - The tags to delete come from every outgoing `HAS_TAG`, with no de-duplication, so such a tag is listed twice.
   - Its second delete then removes nothing, and the count check at `:294` fails every time: a permanent 500 that says "try again".
   - The checker's probe gave ghosty a second `HAS_TAG`, and got "5 nodes and 6 relationships went, where 6 and 6 were read".
   - It's latent: every writer of `HAS_TAG` MERGEs it or makes one per tag.
   - Optional improvement: de-duplicate the tags by tapestryKey before reading them.
2. **`delete-node.js:244–253`, `:262`, `:278–279`: a neighbour with no tapestryKey is recorded as `null`.**
   - In the answer, its `from` or `to` and its `node.tapestryKey` are null, though `REMOVED` declares `from` and `to` as text.
   - In the entry, its `other` is null, and it is left out of `nodes`. So AC6's undo from the entry fails for that relationship, and history can't find the delete by that node.
   - Only a graph `lifecycle migrate` hasn't keyed has such nodes. A tag with no key already stops the delete (`:232`).
   - Optional improvement: stop the same way for such a neighbour, naming `lifecycle migrate`; or record its address.
3. **Comments contradict ADR Amendment 2:** `src/operations/write.js:16–21` and `:30–32`, `delete-node.js:185–186`, and `test/helpers/graphFake.js:79–87` and `:543`.
   - They say Neo4j fails a statement that waited for a node another write deleted, and that the second try is how the races resolve.
   - The live check found that Neo4j gives no error, and the races resolve on the lock and the read after it (Amendment 2).
   - Optional improvement: reword them to match Amendment 2.
4. **Decision 10's count check has no test** (`delete-node.js:294–296`).
   - No suite makes the delete's counts differ from what was read. The throw, the only guard for Decision 7's known race, could be removed and every suite would still pass.
   - Optional improvement: a fake failure that removes a relationship after the reads, then assert 500, one rollback, and the graph unchanged.
5. **DN16 can't see which nodes were locked** (`test/operations/graph/delete-node.test.js:578–596`). The fake logs no statement's parameters (OPEN.md row `2026-11-17-fake-graph-logs-no-lock-order`). So two things are untested:
   - the headers' key order;
   - that word's header is left unlocked.

   The code sorts the keys (`delete-node.js:197`).
6. **Two of Decision 9's and Amendment 1's cases have no test:**
   - a relationship other than `HAS_TAG` between the node and one of its own tags. The checker's probe found it right: listed once, from the tag, and recorded under it;
   - a link from the node to itself, which the cap's first count counts twice.

   Optional improvement: give rich's `a` tag a `REFERENCES` to rich in the seed.
7. **The ADR's ledger follow-up wasn't done.** Done in this commit:
   - OPEN.md row `2026-11-17-own-test-reads-pubkey-as-author` is closed for the writes' half;
   - row `2026-11-17-reads-own-person-placeholder` is opened for the reads' half.
8. **Wording leftovers:**
   - `src/operations/catalog/graph/_nodes.js:10–11` still lists delete-node among the writes "when they are built";
   - update-node's description (`update-node.js:96`) doesn't name `person-node` or `placeholder-node`, though its refusal list and catalog row do;
   - `delete-node.js:266–269` records an `lmdb:` value whose stored data doesn't parse as `stored: null`, as for a missing entry.

### Harness friction

1. **A change to a shared check was tested against a hand-picked list of suites.** `test/helpers/fieldGraph.js`'s users weren't all on the test plan's list. Only the whole operations runner, at implementation, found the fourth hollow letter, update-node's UN40. OPEN.md row `2026-11-17-shared-check-change-needs-runner`.
2. **"The shared notes" the live-check plans say to check don't exist.** The working rule is OPEN.md row `2026-11-16-scratch-stack-down-removes-anyones`'s: inspect the container's mounts before any `down`. OPEN.md row `2026-11-17-live-check-shared-notes-missing`.

## Verdict

**PASS**
- Every acceptance criterion has passing tests.
- The code matches ADR 0026's Decisions 1–15 and both amendments, and its small deviations are logged in the story.
- The scoped gate and the whole operations runner pass.
- The live check confirmed the behaviour on a real stack: the repeat, every refusal, the cache, a reinstall, a restore, an agent through nginx, and two writes at once.

None of the eight findings breaks an acceptance criterion, the ADR or correctness on a graph today's writers make:
- N1 and N2 need shapes no current writer makes;
- N7 is done in this commit;
- the rest are comments and missing tests.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed, and the result given in the chat: the book isn't complete.
