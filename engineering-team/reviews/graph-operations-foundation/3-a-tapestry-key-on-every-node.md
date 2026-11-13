# Review: Story 3 — A tapestryKey on every node: `lifecycle migrate`, one shared label and a uniqueness constraint

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-13
**Diff:** `git diff 6c57ec1f...HEAD` (HEAD `b3373c47`: failing tests `6af6dd02`, implementation `c1041193`, ADR amendment 1 `6bf2d103`, the Tester's amendment 1 `eda76e95`, implementation part 2 `b3373c47`), 81 files, +3303 −352
**Story:** [3-a-tapestry-key-on-every-node.md](../../stories/graph-operations-foundation/3-a-tapestry-key-on-every-node.md) · **ADR:** [0003-a-tapestry-key-on-every-node.md](../../decisions/graph-operations-foundation/0003-a-tapestry-key-on-every-node.md) · **Test plan:** [3-…test-plan.md](../../stories/graph-operations-foundation/3-a-tapestry-key-on-every-node.test-plan.md)

**Not independent.** This session wrote the tests, the code and this review, so it is the same mind checking its own work. Each claim below was checked against a command run or the source at `b3373c47`, not from memory of writing it. An independent checker (workflow 5, "Optional: an independent check") hasn't been run and is worth running before a PASS.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`, in the cloud workspace (no Docker, no Neo4j, every live suite skipped): `20261113T160533Z-230-6426 [a10.3-review] started 2026-11-13T16:05:33.154Z on b3373c47 — FAIL, exit 1, 7049 passed, 2 failed, 598 skipped, 338/338 suites; failed: setup-alert-polish, tagging-edges-realtime-wrapper`.
  - `setup-alert-polish` S2 also fails on `staging` without this change: the baseline at `6af6dd02`, whose `src/` is staging's, gave the same failure (`20261113T081100Z-206-343d`, 7009/38, the other 37 being this story's then-failing tests). Tracked as OPEN.md row `2026-11-07-reading-writeverbs-raw-publish`.
  - `tagging-edges-realtime-wrapper` RW7 is the known wall-clock flake (OPEN.md row `2026-10-08-realtime-wrapper-timing-flake-under-load`): its first restart came 0.76 s after the start against a 0.8 s floor. The branch doesn't touch the wrapper. Run three times on its own afterwards, it passed 24/0 each time, and the Implementer's run `20261113T154545Z-583-7274` had it passing.
  - The suites this story writes or changes: `operations` 187/0 (story 1's 46, story 2's 75 lifecycle tests, and this story's 42 new and P2/P2b), within it `tapestry-key-paths` 17/0, `migrate` 23/0, `migrate-job` 5/0, `status` 9/0; `tagging-edges-wiring` 87/0; `event-less-create-set` 14/0/11 skipped (its live tests).
  - Red before green: at `6af6dd02` the operations gate gave 143 passed and 40 failed (test plan, Verification), and each of the 40 passes now.
- [ ] **Neo4j itself: not yet.** No suite here runs the Cypher on a database. The test plan's live check and measurements 1–5 are deferred to a session on the owner's Mac. The owner chose (2026-11-13) to run them alongside this review. See Blocking 2.
- [ ] `npm run test:playwright`: not applicable (the UI changes are Cypher text only; no page's behavior changes).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] **AC1** — M2–M6. The backup comes first, with a note naming the migration and reason `requested` (M4). Every node is keyed and labelled and real keys are kept (M2). The rule and the index come online before the answer (M2). The report has the counts (M3). More passes run when the pipeline writes during the run (M6). Runs past the wait answer `running` (M22, M23, K1, K2). **"It works at production's size"** is not shown by any test, and Blocking 1 is a way it could fail there.
- [x] **AC2** — M7: no shared key changes, the rule and the index are left out, and the keys are named in the report and the note.
- [x] **AC3** — M8 (already applied: no backup, no run file, nothing written), M9 (keys arrived since: a backup, then keys), M10 (a new instance: no backup, just the rule).
- [x] **AC4** — M11–M13, P2, P2b. M13 checks that applied is read from the graph, so a restored older graph reads as not migrated while its history stays.
- [x] **AC5** — G4 (46 sites in 25 files, every one keyed), G6 (the import's 22 nodes), G10, and G14–G17 for the startup index. A node touched again gets its key by keyNode's own condition (G1).
- [x] **AC6** — M14 and M15. G7–G9 cover adoption and placeholders, G10 add-subset, G11 the 232 lookups by address.
- [x] **AC7** — M16–M21.
- [x] No criterion dropped. Added beyond the story: the index at control-panel start, which the owner ruled at Implementation (ADR Amendment 1).

## ADR adherence

- [x] Files match the ADR's Decision 8 table and Implementation notes; `_migrations.js`, `migrate.js`, `src/lib/tapestry-key-cypher.js` as named.
- [x] No new dependencies.
- **Deviations from the ADR's text, each checked:**
  1. `src/operations/catalog/lifecycle/_migrations.js:229` — event-less-nodes matches `n.id IS NULL AND n:TapestryNode AND (n)-[:HAS_TAG]->()`. Decision 5 has no `n:TapestryNode`. The added check means no node can lose `NostrEvent` without having `TapestryNode`, so lookups by the disjunction always find it. It narrows what Decision 5 changes, and nothing else.
  2. `_migrations.js:130–138` — the keys pass removes the cache stamp and sets the key in two `FOREACH` clauses. Decision 4's text instead sets `tapestryJsonUpdatedAt = CASE WHEN n.tapestryKey = '{}' …` in the same `SET` that has just replaced the key. Cypher applies a `SET`'s items in order, so that `CASE` would never see `'{}'`, and the stamp would never be cleared. The code does what the ADR meant.
  3. `_migrations.js:193–199` — `keysGiven` and `labelsGiven` are what was left when the passes began, less what is left at the end. The ADR doesn't say how to count them. Neo4j's `propertiesSet` would also count the stamp removals. The comment states that a node made without a key during the run, and then keyed, isn't counted.
  4. `_migrations.js:104–126` — `plan(system, { full })` searches the whole graph for shared keys, and counts the `'{}'` keys, only for `apply`, or when the rule is in place. Decision 4 lists both among plan's reads. With no rule, applied is false whatever that search finds, so status and the route skip two full scans of three million nodes.
  5. `_system.js:89–92` — `cypher(query, params, { write })` runs writes through `writeCypher`. A read session would refuse the passes and the schema statements on Neo4j 5. The ADR names no write path.
  6. `_migrations.js:148–152` — when `tapestry_key` or `tapestry_node_uuid` is already the name of something else, the migration refuses in words. `IF NOT EXISTS` would otherwise do nothing, and the run would poll for 30 minutes. The ADR doesn't cover this case.
  7. `test/operations/lifecycle/nostr-event-lookups-kept.json` keeps five lines. Four are `MERGE`s, which can't take a disjunction. The fifth is `src/api/firmware/index.js:140`, whether a firmware concept's header is in the graph, which is about the event. That line was kept after story 1's P7 broke on it: P7's stub matches that Cypher's text. The reason given is true on its own.
  8. ADR Amendment 1 (the startup index) and the test plan's Amendment 1 (four tests from earlier phases changed): each was ruled on by the owner, and each is recorded where it applies.

## Concept-graph integrity

- [x] Handles untouched; the a-tag addresses built in `eventSync.js` are unchanged.
- [x] No concept definitions change; no firmware reinstall needed. G12: firmware install still waits for neither the rule nor the index.
- [x] n/a — no new code reads concepts.

## Things tests can't catch

- [x] No secrets. The TA pubkey is resolved at runtime everywhere it's used. The new code adds no literal pubkey; the suites' `'ee'.repeat(32)` and similar are fixtures.
- [x] Logging: the new lines are the command's job notice (`migrate.js:78`, as backup's) and the startup index's one line (`tapestry-node-index.js`). No debug output is left.
- [x] No commented-out code.
- [ ] Error paths and scale: Blocking 1.
- [x] Concurrency: one lock covers the backup through the last write (M5). Writers run during the passes by design. A node made mid-run is picked up by the next pass, or by the next run (AC3). Before migrate, keyNode writes the label and key onto people that the stream and the tagging-edges pass both touch. Two such transactions can deadlock, and one fails with a transient error each side retries. Once migrate has run, keyNode writes nothing (Non-blocking 4).
- [x] Injection: keyNode allows only `^[A-Za-z_][A-Za-z0-9_]*$` (G2). The migration name is matched against the list before it's used. Shared keys go in as `$skip`. Only constants are spliced into the schema statements.

## House rules check

- [x] Concept Graph API authority: no new reads of concepts.
- [x] No new lint, typecheck or build tooling.
- [x] Docs: OPERATIONS.md §17; BIBLE §6 (`TapestryNode` row, `NostrEvent`'s meaning) and §29; amendment notes on ADR `graph-operations-foundation/0002` and `node-primitives/0001`; the design handoff's status line (G13).

## Findings

### Blocking

1. **`src/operations/catalog/lifecycle/_jobs.js:85–97`, with ADR Decision 10's premise.** While `tapestry_key` isn't online, `countGraph` reads every key in one query (`readAllKeys`). Through `runCypher` (`src/lib/neo4j-driver.js:55–66`), the driver holds every record, and the code then builds one array of keys and sorts it. Decision 10 allows this "since the graph then holds no more keys than today's". Decision 8 makes that untrue. Once this code is deployed, keyNode labels and keys every node the stream touches: each follow list's author and everyone they follow (`src/pipeline/stream/redis-consumer.js:50–54`). By the time someone runs `tapestry-keys` on production, possibly a day later, the graph may hold a large share of its three million keys. The backup that `tapestry-keys` takes first runs `countGraph` twice, before the rule exists: once before the offline window and once after (`_jobs.js:190` and after the dump). So does any ordinary backup in that window. That read is millions of records in the worker's memory, while `pauseWriters` (`_jobs.js:189`) has the stream and the tagging-edges writer stopped. If the worker dies of memory there, its `finally` never runs. The writers stay paused until the next lifecycle operation recovers the stale lock, and nothing starts that on its own. This is AC1's "works at production's size" case, and no test or measurement covers it.
   **Asked change**, with an ADR note, so the owner rules:
   - (a) Bound the memory of the count without the rule: read the keys as a stream that keeps only the strings, or in pages. The digest stays the same string's hash.
   - (b) OPERATIONS.md §17 says to run `tapestry-keys` soon after the deploy that brings this change. It also says what a backup taken before then costs.
   - Measurement 5 then times `countGraph` before migrate on a scratch graph keyed to production's size, in time and in the worker's peak memory.
2. **The live check and measurements 1–5 (test plan § "The live check and the measurements, run in Implementation", and Amendment 1's step) haven't run.** Nothing here has run the new Cypher on Neo4j 5.26. That covers `FOREACH` written into APOC's double-quoted inner statements, the nested `FOREACH` in add-subset and in the import's placeholders, label disjunctions in `MATCH`, `EXISTS` and `allShortestPaths`, `SHOW … WHERE`, `apoc.periodic.iterate` with `params`, and the startup index. Nor has anything shown that a lookup by the disjunction seeks both indexes (Sub-decision 4 depends on it), or what the passes and the status scan cost at production's size. The owner chose to run these alongside this review. **Asked change:** run them on a throwaway stack as the plan says, put the numbers in the test plan, and fix whatever fails. Any change to code goes back through this review.

### Non-blocking

1. **`_migrations.js:217–219`** — with the rule already in place and an unlabelled node's key shared, the note still says "the uniqueness rule … and the index … were left out", although the report says `rule: 'already-there'`. Optional: word the shared-keys sentence by the report's `rule` and `index`.
2. **`_migrations.js:216`** — "N batches failed and were picked up by a later pass" is untrue when the failures were in the last pass. The sentence about nodes still without a key covers that case. Optional: say "picked up by a later pass" only when nothing is left.
3. **`status.js:182` (the migrations part)** — every status call scans the whole graph for nodes with no key (Decision 4's third read). The ADR's Implementation notes already say that if measurement 2 shows it takes over a few seconds, status reports the last run's count instead. This finding only makes sure that branch is taken if the number calls for it.
4. **`src/pipeline/tagging-edges/graph.js:42–55`** — tagging-edges ADR 0002 D6-B said the people's `MERGE` "never changes an existing node". Until migrate has run, keyNode does change existing people that have no key, so the pass's transactions now take write locks on them. Its transient errors are retried. Optional: say so in tagging-edges ADR 0002's amendment line, as node-primitives/0001's line does for its change.
5. **The kept list** names the line text, so moving a kept line is free, but rewording one breaks G11. That is as intended.

### Harness friction

1. **Test Design didn't look for other stories' tests that the ADR contradicts.** Four turned up at Implementation: G8's own filter, story 1's H1, tagging-edges' SWR15, and node-primitives' S1 with its live checks. A fifth, story 1's P7, was avoided by keeping a line. Each cost a kick-back mid-Implementation and a gate question for the owner. Test Design could search the suites for the changes an ADR makes: a label, a Cypher shape a stub matches, a require list. Filed as OPEN.md row `2026-11-13-test-design-misses-other-suites` (meta).

## Verdict

**CHANGES_REQUESTED**

The code follows the ADR and every criterion has a passing test, but two things stand between this and a PASS. First, a backup taken before the rule exists can hold every key the stream has given since the deploy in one worker's memory, with the writers paused (Blocking 1). Second, none of this Cypher has yet run on Neo4j (Blocking 2). Back to `/implement-feature` with both: (1) after an owner ruling on its ADR note, and (2) as the live check the owner already scheduled alongside this review.

## On PASS (same commit)

- [ ] Story `**Status:**` flipped to `Done` in place. *(Not this round.)*
- [ ] Completion detection. *(Not this round.)*
