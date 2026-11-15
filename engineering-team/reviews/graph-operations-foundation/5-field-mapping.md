# Review: Story 5 — Field mapping

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-15
**Diff:** `git diff e53e5474..HEAD` (commit `1fc4ca39`, branch `A10.5-field-mapping`). Five commits: `56e38321` (ADR 0005's Amendments 1 and 2), `eb2db1fa` (the test plan and the failing tests), `2aa3f2bc` (the implementation), `0afe375b` (the live check's record), `1fc4ca39` (a one-line fix in the rule). 32 files, 4,388 lines added, 20 removed.

The base, `e53e5474`, is `origin/staging`, and already holds the story and ADR 0005 (PR #65). The live check ran on a throwaway scratch instance that has since been removed. This review judges it from its record in the test plan's Verification, as asked, and re-runs every stack-free check itself. An independent Reviewer agent wrote it, since the session that built the code is anchored on it. Before the commit, that session checked each finding, line reference and ledger row against the sources and corrected Non-blocking 3, whose conclusion held only for instances started without the firmware-on-boot flag.

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`: not run.** On this machine the full gate writes to the owner's agent-memory instance (container `tapestry`, `:7778`), and this review's rule forbids it.
  - `npm run gate:status` printed `20261113T204400Z-47565-3703 [workflow-hardening-pre] started 2026-11-13T20:44:00.421Z on 1dc1ca44+dirty — FAIL, exit 1, 7161 passed, 70 failed, 398 skipped, 339/339 suites`, then its failed suites. That run is of `1dc1ca44`, an ancestor of the base, with a dirty tree. It says nothing about this diff (Harness friction 2).
  - The branch is pushed: by the local ref, `origin/A10.5-field-mapping` holds `1fc4ca39`. This review made no GitHub calls, so it can't say whether a pull request holds it. CI's run on that pull request will be the first full gate of `1fc4ca39`.
  - This is OPEN.md row 294's case, as in story 4's review.
- [x] **Suites run one by one,** on Node 24.18.0 at `1fc4ca39`, with a clean tree.
  - Before running, I screened each suite and the helpers it loads for `:7778`, `docker exec` and live endpoints. I screened every suite under `test/operations/` too, since the aggregate runs them all.
  - Every shell exported dead endpoints (Neo4j, Redis, Meilisearch and both base URLs at port 9) and unset `TASK_QUEUE_ENABLED`. openapi-coverage and the two sweeps hand their children the shell's environment, over a conf that names no endpoint.

  | Suite | Result (pass/fail/skip) |
  |---|---|
  | `test/neo4j-property-firmware.test.js` | 9/0/0 |
  | `test/operations/change-entry-fields.test.js` | 3/0/0 |
  | `test/operations/rules/field-mark-allowed.test.js` | 14/0/0 |
  | `test/operations/graph/fields.test.js` | 8/0/0 |
  | `test/operations/graph/mark-field.test.js` | 16/0/0 |
  | `test/operations/graph/unmark-field.test.js` | 13/0/0 |
  | `test/operations/graph/map-fields.test.js` | 12/0/0 |
  | `test/operations/graph/fields-agent-through-cli.test.js` | 1/0/0 |
  | `test/operations/graph-fake.test.js` | 15/0/0 |
  | `test/operations.test.js`: the above but the firmware suite, story 4's suites, every lifecycle suite, the cache counts, and its own tests | 337/0/0 |
  | `test/b-tag-seeds.test.js` (reads the firmware manifest) | 7/0/0 |
  | `test/b-tag-primitive.test.js` (reads the firmware manifest) | 16/0/0 |
  | `test/community-reference-nostr-relay-stub.test.js` (reads the firmware manifest) | 4/0/0 |
  | `test/external-cli.test.js` | 53/0/0 |
  | `test/openapi-coverage.test.js` | 13/0/0 |
  | `test/default-deny-mutations.test.js` | 14/0/0 |
  | `test/admin-action-sweep.test.js` | 9/0/0 |
  | `test/admin-action-sweep-access.test.js` | 13/0/0 |
  | `test/close-unauth-write-surface.test.js` | 14/0/0 |
  | `scripts/harness-lint.sh` | clean, 0 violations |

  - The figures match the test plan's record for `2aa3f2bc`: 337, 9, 7, 16, 4, 53 and 13.
  - Inside the aggregate, the shared helpers' other users give the test plan's numbers: write path 13, add-relationship 12, remove-relationship 7, history 8, the relationship-type rule 10, story 4's agent 1, cache counts 7, lifecycle status 9, change indexes 3.
  - Story 4's review counted 263 in the aggregate. The 74 new tests under `test/operations/` make 337.
- [x] **Red before green.** I exported HEAD's tree to the scratchpad and put `e53e5474`'s `src/`, `bin/`, `docs/` and `firmware/` back in it. Its `test/` is HEAD's.
  - 75 tests failed: the firmware suite 0/9, CE 1/2, FR 0/14, FD 0/8, MF 0/16, UF 0/13, MP 0/12, X2 0/1. CE3 passed, by design, and so did the fake's suite, 15/0. These are the test plan's figures, and the commit message's: 83 new tests, 75 failing, 8 passing.
  - Each failure names what it waits for and its decision, such as "src/operations/catalog/graph/mark-field.js does not exist yet (… Decision 7)" or "versions/v1.0.0/manifest.json has no concepts[] entry for neo4j-property yet (… Decision 1)". CE2 failed on `keysOf`'s answer, which held only the property node.
- [x] **The tests catch what the amendments forbid.** The test plan's own check used a reference that was deleted. So I broke the real code three times, one line each, in scratch copies of the tree:
  - Amendment 2.2 off, so JSON that can't be read is mapped like JSON with no section (`_fields.js:348`): MF1, MP5 and MP5b failed.
  - map-fields' stray pass off (`_fields.js:368`): MP1 failed.
  - Amendment 2.5 off, so an empty `copies-removed` is recorded (`unmark-field.js:77`): UF13 failed.
- [x] **The phases kept to their lanes.**
  - `git diff eb2db1fa..HEAD -- test/` is empty: Implementation left the tests alone.
  - `git diff e53e5474..eb2db1fa -- src/ bin/ firmware/ docs/ clients/ ui/` is empty: the Tester's commit changed no code.
  - `56e38321` only appends the two amendments, and removes no line of the ADR.
- [x] **The shipped catalog,** loaded with dead endpoints: 13 operations and no problems.
  - The three are listed at `owner-and-admins`. mark-field's guard is `field-mark-allowed`; the other two have none.
  - Each has a route-table entry, `POST /api/tapestry/graph/<name>` at `owner`, made from its declaration (`src/operations/routeTable.js`), and a `/docs` POST entry.
  - The rule loads, with `refuses: true`.
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
| AC1, the concept | NP1–NP9 | the header, its superset and its JSON Schema node; both sets, empty, with the firmware's words; the superset has no parent; the install signed 12 events | the five files and the manifest entry are Decisions 1 and 2's. NP3 and NP6 compare the descriptions exactly, as plain text. No `x-tapestry`, so a marked node gets no label |
| AC2, mark | MF1–MF5, MF13, MF16, FD2–FD8, CE1–CE3 | Dog's `breed` marked: carried 2, nothing skipped, `field-marked` and `copies-set`. Neo4j holds the copy as `STRING`, and nostr-kind's 41 `kind` copies as `INTEGER` | the guard, then the 10,001-element read, then `MERGE`. A new mark maps only its own field (`mark-field.js:59–84`). Values follow Decision 10 and Amendment 2.6 (`_fields.js:262–290`) |
| AC3, refused | MF6–MF9, FR1–FR14 | `mark-field --field wordTypes` refused `unknown-field`, naming slug, breed and name | one `violations`, in the table's order (`field-mark-allowed.js:72–125`). The rules document's entry 3 |
| AC4, unmark | UF1–UF13 | `breed` unmarked: cleared 2. The reads found neither dog, and no mark or copy was left. Breed's node was still a property (D9) | deletes only the first set's edge (`unmark-field.js:67–73`), then clears every current element that carries the copy, without reading JSON |
| AC5, catch up | MP1–MP11, MP5b | Lady, changed through save-element-json, kept her stale copy until map-fields: set 1, unchanged 1 | `mapConcept` with `strays` (`_fields.js:327–377`). The counts are of elements (`map-fields.js:60–69`) |
| AC6, a read | MF14, MP11, UF11, over the fake | through `/api/neo4j/query`, Dog's class thread by `dog_breed` found Rover and not Lady; both after the change; neither after the unmark | plain Cypher on `dog_breed`. No read code is added |
| AC7, survival | none: live only | a reinstall, a re-run of generate-property-tree, and a backup restored left the marks and copies as recorded | no code change, as Decision 14 says. I read the three passes that delete edges. Install's step 1e (`src/firmware/install.js:781–830`) and `wire-implicit-elements` (`src/api/normalize/index.js:5850–5873`) delete only edges that start at a superset. generate-property-tree's unhook deletes `HAS_ELEMENT` edges only into a property node that has left the tree (`index.js:3761–3791`) |
| AC8, callers, the command, an agent, the docs | MF10–MF12, MF15, UF7–UF9, MP9, MP10, X2 | the command and an admin agent through nginx, each write recorded as `local` or as `admin` with the agent's pubkey; a visitor 401; text/plain 415; no relay event came from a graph operation | the spy saw nothing (MF10, UF7, MP9). The only key helper the new code calls is `getOwnerAssistantPubkey`, which reads a pubkey, not a secret (`src/utils/assistantKeys.js:49–82`). Nothing under `clients/` changed |

The acceptance criteria are as approved. The story's only edits since `e53e5474` are its Deviations and the test plan's link.

**The Deviations,** each checked:
1. mapNodes walks the class thread backwards (`_fields.js:392–399`). The Cypher is valid by reading, and the fake runs it (FD8). It has no caller yet, and never ran on Neo4j.
2. mark-field reads the elements once in its `apply` and hands them to `mapConcept` (`mark-field.js:59`, `:75`). The guard, which runs first, reads them too, for property-in-use, when the field isn't marked yet.
3. elementsOf answers each element's `uuid`. marksOf's `uuid` is the concept header's, not the node's (Non-blocking 6).
4. mark-field's `skipped` is `{ node, reason }` (`mark-field.js:81`); map-fields' keeps `field`.
5. unusable-name also holds the key to a leading letter and the field to the input's pattern (`field-mark-allowed.js:29–30`, `:106`).
6. not-plain reads a type list as one type besides null (`field-mark-allowed.js:37–53`).
7. unmark-field reads the elements only for a marked field (`unmark-field.js:62–66`).
8. mark-field's `already-marked` counts `carried` from the copies, with `skipped: []` (`mark-field.js:70–74`).
9. map-fields' copy changes don't name the concept. That is Decision 7's `copies-set` shape, so it follows the ADR (`_fields.js:418–424`).
10. The catalog's three rows say "New.".

elementsOf also takes an `{ only }` option, which the Deviations don't name (Non-blocking 6). It serves `mapConcept`'s `only`, which the ADR does name.

**`1fc4ca39`, the rule's fix.** It is unreachable, as its message says. A concept with no key has no fields (`_fields.js:142–143`), so `unknown-field` refuses it first (`field-mark-allowed.js:88`). The live check ran on `2aa3f2bc`, and this is HEAD's only later code change.

## ADR adherence
- [x] Files changed match the ADR's implementation notes. Every new and changed file it lists is in the diff, and nothing else in `src/`, `bin/` or `firmware/` changed.
- [x] Layering / module boundaries respected.
- [x] No new dependencies the ADR didn't authorize. `package.json`, the lockfile, the Dockerfile and `docker/` are unchanged.

- **Decisions 1 and 2, Amendments 1 and 2.1.** The files, names and slugs are the ADR's, and the descriptions are its words without the markdown. The manifest entry sits next to relationship-type's, and under neither `sets.properties` nor `sets.words`.
- **Decision 3.** A mark is one `HAS_ELEMENT` from the first set (`mark-field.js:63–69`). Every element of the first set counts (`marksOf`, `_fields.js:189–215`), but only for the concept whose section node its node hangs on (`:209`).
- **Decision 4.** `propertyName` is `<key>_<field>` (`_fields.js:112–114`). No property name enters Cypher's text: copies go in through `SET n += row.props`, and the prefix as `$prefix`. The convention is in the rules document. Its limit is Non-blocking 1.
- **Decision 5.** The eight codes and statuses, in the table's order. A repeat passes: property-taken and property-in-use skip the field's own mark (`field-mark-allowed.js:112–117`). FR13 runs it as a check over many marks.
- **Decision 6.** `_fields.js` opens nothing at load (FD1), and keeps its contract, with the Deviations' additions. S1–S5 and S8 are the Implementation notes' statements. The relationship types come from `firmware.relAlias`. I checked the six aliases against firmware's relationship-type elements: `IS_THE_CONCEPT_FOR`, `IS_A_SUPERSET_OF`, `HAS_ELEMENT`, `IS_THE_JSON_SCHEMA_FOR`, `IS_THE_PRIMARY_PROPERTY_FOR`, `IS_A_PROPERTY_OF`.
- **Decision 7.** The inputs, guard, `repeatKey`, refusals, the five steps and the answer are as specified.
- **Decision 8 and Amendment 2.3.** `not-installed` comes before `unknown-concept`. The stray pass spares every name a mark of any same-key concept yields (`_fields.js:332–334`). The counts are of elements.
- **Decision 9, Amendments 2.4 and 2.5.** As specified.
- **Decision 10, Amendments 2.2, 2.6 and 2.8.** As specified. `same()` compares a copy as the driver reads it back: `toJS` turns integers into numbers, inside lists too (`src/lib/neo4j-driver.js:153–183`). The live check's "unchanged 41" bears this out, and 2.8's known limit follows from it.
- **Decisions 11–13.** `MAX_ELEMENTS` is 10,000, and the refusal names 10,001. `CHANGE` and `keysOf` are as specified (`changes.js:32–47`, `:74–83`). Nothing signs.
- **Decision 14.** No code change; see AC7's row.
- **Decision 15.** "At a glance" adds up: 10 + 25 + 6 + 3 + 4 + 4 + 3 + 6 = 61, and the writes' groups give 3 + 8 + 8 + 4 + 2 = 25. add-property's row points to mark-field, and §9 is unchanged. The design's §5, question 1, and its Status line are updated.
- **Context 6, the tree's shape.** generate-property-tree wraps any single top-level object key (`index.js:3745–3746`). `conceptOf` calls a schema wrapped only when that key is the concept's (`_fields.js:145`). A schema whose one key isn't the concept's has no fields for `conceptOf`, so mark-field refuses it `unknown-field` and never marks the wrong node.
- **The earlier ADRs in the epic.** I found no contradiction with any of them.
  - **0001.** Declarations and the rule open nothing at load.
  - **0002.** Backup and restore are unchanged, and the live restore brought the marks back as they were at the backup.
  - **0003.** No new statement makes a node.
  - **0004.** The three run on the write path, in one transaction with their entries, JSON only. S6 and S7 are add-relationship's and remove-relationship's statements (`add-relationship.js:49–52`, `remove-relationship.js:49–52`).
  - **0006.** The client is unchanged. X2 and the live agent drove all three through it.

## Concept-graph integrity
- [x] Handles are in `kind:pubkey:slug` form: `39998:<TA>:neo4j-property` and `39999:<TA>:the-set-of-neo4j-properties-that-are-also-fields`. The TA comes from `getOwnerAssistantPubkey()` at run time (`_fields.js:68–72`). No literal TA pubkey, and no 64-hex literal, is in the added lines.
- [x] Firmware reinstall called out: yes. ADR 0005's Consequences say to restart the control panel and install, and the live check did both. An instance does it on its own only if it starts with `TAPESTRY_FIRMWARE_ON_BOOT=true` (Non-blocking 3).
- [x] New code orients through the graph and the firmware alias layer, not BIBLE.md.

## Things tests can't catch
- [x] No secrets in committed files. No nsec and no 64-hex literal is in the added lines. The live agent's key was made inside the scratch instance and removed with it.
- [x] No leftover debug logging. The added `src/` lines hold no `console` call.
- [x] No commented-out code, and no TODOs.
- [x] Error paths and edge cases handled where it matters.
  - mark-field answers `already-marked` when the `MERGE` created no edge (`mark-field.js:70`). If its two `MATCH`es found nothing, that would be a false `already-marked`. It can't happen: both keys were read in the same transaction.
  - JSON that can't be read is left alone everywhere but unmark-field, as Amendment 2.2 says.
  - The namespace and names other code writes: Non-blocking 1.
  - A node that leaves a concept: Non-blocking 2.
- [x] Concurrency / race conditions considered.
  - Two marks at once, live: one edge, one entry. `MERGE` held its lock.
  - Other interleavings: Non-blocking 4.
  - Graph writes still don't take the lifecycle lock (story 4's Non-blocking 2). Those writes now include map-fields, which can write 10,000 nodes in one transaction.
- [x] Security: input validation at boundaries, no obvious injection vectors.
  - Property names never enter Cypher's text. Relationship types come from firmware. `LIMIT` is a checked integer.
  - The three sit behind the route table and the router's re-check, and take JSON only.
  - The CORS posture of story 4's Non-blocking 1 (OPEN.md row 326) covers these three routes too.

## House rules check
- [x] Concept Graph API authority respected. The code reads the concept, its tree and its marks from the graph, by handle and by tapestryKey.
- [x] No new lint/typecheck/build tooling without an ADR.

## Product-guide adherence *(when the story traces to a PRD)*
Not applicable. The book has an acceptance frame and no PRD, and no UI changed.

## Findings

### Blocking
None.

### Non-blocking
1. **`src/operations/catalog/graph/_fields.js:368–372`: map-fields' stray pass would remove `created_at` from the elements of a concept keyed `created`.**
   - **What happens.** Any property `<key>_…` on an element counts as a copy. For a concept whose `oKeys.singular` is `created`, that includes `created_at`. The nostr import and `importEventDirect` set `created_at` on every event node, so every element today's routes made carries one (`src/api/neo4j/eventSync.js:215`, `:218`; `src/api/normalize/index.js:154`). No mark yields it, so map-fields removes it from every element.
   - **Why it matters.** The node loses metadata the import set, until its event is imported again. And `GET /api/neo4j/event-check` reads a node's `created_at` to tell whether strfry holds a newer version. Without it, `parseInt` gives NaN, so a newer version is classed `neo4j_newer_or_conflict` and not reported as needing an update (`eventSync.js:113–122`).
   - **How narrow.** No firmware concept has such a key. A user-made concept named "created" would. So would a concept keyed `observer`, `observee`, `customer`, `input`, `influence`, `average` or `confidence`, if its elements were the nodes that carry `observer_pubkey`, `customer_id` or the `*_imported` scores.
   - **What still holds.** While the elements carry `created_at`, property-in-use refuses to mark such a concept's `at`.
   - **Optional improvement.** The code follows Decision 4's convention, so this is the ADR's to settle. Have the stray pass leave alone names other code sets, `created_at` at least, or refuse a concept key that prefixes one. Either way, state the limit in the rules document's naming convention.
2. **`src/operations/catalog/graph/unmark-field.js:65–75` and `_fields.js:223–236`, `:386–399`: a node that stops being an element keeps its copies, and no operation clears them.**
   - unmark-field and map-fields see only current elements. mapNodes finds only the concepts a node is an element of now. The tests pin this: a node of no concept keeps its `dog_breed` (MF1, UF1, MP2).
   - Today's owner-gated `POST /api/normalize/delete-relationship` can delete a `HAS_ELEMENT` edge, and the catalog's remove-from-concept and move-element will too. A node taken out of Dog that way keeps `dog_breed` for good.
   - The read in ADR 0005's Consequences (line 336) and in mark-field's description (`mark-field.js:25`), `MATCH (d:TapestryNode) WHERE d.dog_breed = 'goldenRetriever'`, finds such nodes. AC6's read, through Dog's class thread, doesn't.
   - The ADR covers a field that leaves the schema (Decision 14), but not an element that leaves the concept.
   - **Optional improvement.** Show the class-thread read in the description. File a follow-up so that remove-from-concept and move-element clear the old concept's copies inside their own write.
3. **`tools/firmware-on-boot.sh:15–33`: only instances started with the firmware-on-boot flag install the new concept on their own.**
   - **The flag.** The boot script runs only when `TAPESTRY_FIRMWARE_ON_BOOT=true` (`docker/entrypoint.sh:356`). It installs whenever `GET /api/firmware/install-status` answers `installed: false`, whatever its marker says, and that counts every manifest concept's header (`src/api/firmware/index.js:128–151`, `:160`).
   - **Who sets it.** The new concept's header is missing on every existing instance, so one started with the flag installs it on its next start. The launcher sets the flag for its brains (`deploy/launcher/lib/render.js:23`, `deploy/templates/brain.compose.yml:23`).
   - **Who doesn't.** The repo's own compose files don't set it, and the runbook calls the install a manual step (`deploy/RUNBOOK.md:17`). So unless their environment sets the flag, staging, production and the owner's local instance need someone to run Install Firmware after the deploy restarts the control panel: Settings › Firmware, or `POST /api/firmware/install`. Until then, mark-field and map-fields refuse `not-installed`.
   - **What the ADR says.** Its Consequences say to reinstall, but not which instances do it on their own.
   - **Optional improvement.** Put the install in the steps for shipping this epic.
4. **`src/operations/catalog/graph/_fields.js:332–337` and the guard's reads: the three writes don't exclude each other.**
   - Neo4j isolates transactions at read committed, so one statement can see what another transaction committed after this one began.
   - map-fields reads the marks, then the elements, in two statements. If a mark-field commits between them, map-fields sees copies with no mark and removes them as strays. If an unmark-field commits between them, map-fields puts its copies back, with no mark.
   - Two same-key concepts marking a field of the same name at once each pass property-taken, so two marks yield one name.
   - Each case is put right by the next map-fields, or reported by the rule's check. Only two mark-fields at once were tried live.
   - **Optional improvement.** Have each of the three take a write lock on the first set's node before anything else, so they run one at a time.
5. **`src/operations/rules/field-mark-allowed.js:121`: property-in-use doesn't say how to clear the copies.** When a field leaves the schema and comes back, its old copies are still there unless map-fields ran in between (Decision 14), so marking it again is refused property-in-use. map-fields removes them, but the message says only "Remove it first". Optional improvement: name `graph map-fields`, which removes copies no mark yields.
6. **Wording.**
   - `src/operations/catalog/graph/mark-field.js:27` says "One concept's mark yields one property name across the graph." That doesn't say what Decision 4 means. It could say "A property name has one mark across the graph: another concept with the same key can't mark a field of the same name." The description reaches `/docs` and the agents' CLI help.
   - `docs/GRAPH_OPERATIONS_CATALOG.md:75`: mark-field's row lists the rule's refusals but leaves out `not-installed`, which map-fields' row names.
   - The story's Deviation (`5-field-mapping.md:171`) says marksOf answers "each node's `uuid`". It answers the concept header's (`_fields.js:212`), which is what property-taken's message names.
   - The Deviations don't name elementsOf's `{ only }` option (`_fields.js:223`).

**Not checked here, and why:**
- **The full gate.** See Quality gates, above.
- **The live check.** Taken from its record, as asked. The scratch instance is gone. That covers every live figure: the 12 install events, the 65 s and 62 s reinstalls, the 18.0 s and 24.3 s offline, Neo4j 5.26.10, and the relay's list of events.
- **mapNodes on Neo4j.** It has no caller, and only the fake has run its statement.
- **A concept of 10,000 elements on Neo4j.** Only the fake ran the cap (MF8, MP7, UF12). The entry's size there wasn't measured: about 360 KB of keys, by the ADR, plus the nodes again in its changes text.
- **Two map-fields at once,** and the interleavings of Non-blocking 4.
- **A stranger's 403 on a real instance.** It was shown only over the harness.
- **The fake's timing at the cap,** about 110 ms by the test plan.
- **The test plan's reference run and its seven breaks.** The reference was deleted. I ran three breaks of my own against the real code, above.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. None new for the full gate. That it can't run on this machine, and that no pull request this review could see holds the implementation, is OPEN.md row 294's case.
2. **`npm run gate:status` prints the newest record without saying it isn't of HEAD.** Here that record is a FAIL from `1dc1ca44+dirty`, two days old. A review told to quote "the run's" line could quote it as this diff's. Candidate: have `test/gate-status.js` (`:44–45`) say when the record's commit isn't HEAD, or was dirty. Filed as OPEN.md row `2026-11-15-gate-status-shows-another-commits-run`, type `meta`.

The template's close-out heading is renamed below, as in story 4's review, per ledger row `2026-10-07-on-pass-heading-reads-as-verdict`.

## Verdict
**PASS**

The diff builds what the story asks, and what ADR 0005 and its two amendments say. It doesn't contradict ADRs 0001, 0002, 0003, 0004 or 0006. Every acceptance criterion has a test that passes here, and the 75 new tests that should fail without the code do. Three breaks of the real code are caught. The live check's record covers what the fake can't: AC1's install, AC6's read through `/api/neo4j/query`, AC7's survival, and AC8's relay and agent. Nothing blocks. CI's run on the pull request will be the first full gate of `1fc4ca39`, and it should be green before the merge.

## Close-out (same commit)
- [x] Story `**Status:**` set to `Done` in place, in this commit, once the main session had checked the findings.
- [x] Completion detection: done. Its result is in the chat, not in this file.
