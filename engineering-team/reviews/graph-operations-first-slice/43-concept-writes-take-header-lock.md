# Review: Story 43 — A rename or a field mark beside a property write on the same concept: the two go one after the other, and neither is lost

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-18
**Diff:** `git diff 02e21816..6016e53b`. `02e21816` is staging with story 18 merged; branch `A10.18.a-header-lock` adds seven commits: `d8d1f040` (story), `676795e2` (ADR 0018 Amendment 4, at test design), `dd06b640` (the failing tests and the fake's new failure), `9c02d6f1` (Amendment 4 item 5, from implementation), `5c35826e` (the fix), `645120bc` (Evidence), `6016e53b` (ledger row DONE). 9 files, +659 −7.
**Inputs:** story `engineering-team/stories/graph-operations-first-slice/43-concept-writes-take-header-lock.md` (AC1–AC4, Deviations, Evidence); test plan `43-concept-writes-take-header-lock.test-plan.md`; ADR `engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md` (Decision 11, Amendment 3 item 1, Amendment 4); story 18's review, non-blocking 1, where the bug was found.
**Type:** bug. Architecture was skipped; Amendment 4 records what the fix decides.
**Independent check** (workflow 5, optional): not applied.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, scoped.** I did not run the full gate. On this Mac about 40 suites write to the agent-memory instance, and the PR's CI runs the gate whole. I ran CI's registry entries for an operations change through the gate engine: `operations.test.js` (it runs every suite under `test/operations/`), `external-cli`, `openapi-coverage`, `admin-action-sweep` and `schema-save-finds-the-right-header`. I read the Implementer's `gate.sh` first. Every endpoint was dead: both base URLs, the panel and container ports, Meilisearch, the relay, Neo4j and Redis all at port 9, and `TAPESTRY_CONTAINER=no-such-container`. `BRAINSTORM_CONF_PATH` pointed at a file that sets Neo4j and Redis to port 9; `src/utils/config.js:17-62` reads that file, then sources it in bash, which inherits the dead env for every other key. Node 24.18.0. `npm run -s gate:status -- --label a10-18-a-story-43-review-1` reads:
  `20261118T065143Z-61327-c3a6 [a10-18-a-story-43-review-1] started 2026-11-18T06:51:43.597Z on 6016e53b — PASS, exit 0, 1024 passed, 0 failed, 6 skipped, 5/5 suites` (record `tmp/gate-runs/20261118T065143Z-61327-c3a6.json`)
  - **Clean tree.** The record's `git.dirty` is false and `dirtyCount` 0, so the code under test is `6016e53b`.
  - **Per suite:** operations 923/0/4, external-cli 53/0/0, openapi-coverage 13/0/0, admin-action-sweep 9/0/0, schema-save-finds-the-right-header 26/0/2. They sum to 1,024/0/6, the same counts as the Implementer's run on `dd06b640+dirty`.
  - **Inside operations:** this story's suite 8/0 (HL0–HL7 each PASS). Its neighbours: update-concept 11/0, mark-field 16/0, unmark-field 13/0, map-fields 12/0, rule field-mark-allowed 14/0, update-node 42/0, create-element 34/0, delete-node 40/0, create-concept 23/0, add-property 15/0, update-property 11/0, remove-property 8/0, set-schema 10/0, the fake graph 31/0.
  - **The six skips are live checks:** lifecycle migrate's LK1–LK4 and schema-save's L1–L2.
- [x] **The new suite alone, under mutation.** I made a `git archive HEAD` copy in my scratchpad, with `node_modules` linked and the worktree untouched. In it I weakened the fix seven ways and ran the suite alone each time, with the same dead endpoints:

  | Mutation | Result | Failing |
  |---|---|---|
  | M0: none | 8/0 | none |
  | M1: update-concept takes no header lock | 5/3 | HL1, HL2, HL3 |
  | M2: update-concept's header lock moved after `K.conceptFacts` | 5/3 | HL1, HL2, HL3 |
  | M3: update-concept takes the header lock before C1 | 7/1 | HL1 |
  | M4: mark-field keeps the lock, drops the rule's second run | 5/3 | HL5, HL6, HL7 |
  | M5: mark-field runs the rule's second run before the lock | 5/3 | HL5, HL6, HL7 |
  | M6: mark-field drops the lock, keeps the second run | 5/3 | HL5, HL6, HL7 |
  | M7: the second run throws without `rule` | 6/2 | HL6, HL7 |

  The copy's two files hash back to `3685063f…` and `48194479…` afterwards. M2 and M4 are the two edits the Evidence names, and they fail the cases it says.
- [x] **The live check, run again at HEAD** on `tapestry-scratch`, the scratch stack the Implementer booted, through `test/helpers/scratchLoopback.js`, which refuses any other container. I ran `TAPESTRY_CONTAINER=tapestry-scratch node tmp/live-check-43/live.js review 10`, writing `report-review.json` at 06:59:09Z, stamped HEAD `6016e53b`, with the watched files the same here and as mounted. All six checks pass:
  - L1 10/10, each rename ending 107–115 ms after the add;
  - L1b 10/10, 300–339 ms;
  - L2 10/10 with exactly one landing: the mark refused `not-plain` 8 times, the type change `marked-field` 2;
  - L2b 10/10: `unknown-field` 8, `marked-field` 2;
  - L3 10/10, every copy blue and every call 200;
  - L4: the relay held 465 events before and after.

  The control panel ran the fix. Its process (pid 12449) started at 06:24:36Z, after both files' last write (`mark-field.js` 06:24:05Z, `update-concept.js` 06:24:19Z), and the files haven't changed since. The agent-memory `tapestry` container was never touched.
- [x] **`bash scripts/harness-lint.sh`:** `harness-lint: clean (0 violations)`, exit 0, before this file existed. With it in place and the story still `Approved`, one violation, L1: a PASS-final review beside an `Approved` story, as at story 18. With the Status flip below, `harness-lint: clean (0 violations)`, exit 0.
- [ ] `npm run test:playwright`: not applicable, since no UI changed.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

| AC | Verdict | Evidence |
|---|---|---|
| AC1: a rename beside a property write keeps both | met | HL2 (name) and HL3 (plural alone) end exactly as add-property then the rename, one after the other. HL2's next property write takes nothing out. HL4 covers the other order. L1 and L1b live, in the Implementer's run and mine. |
| AC2: a mark beside a property write follows the rules either way round | met | **Property write first:** HL6 (409 `not-plain`, `rule: field-mark-allowed`, graph exactly as the type change left it) and HL7 (404 `unknown-field`, likewise). **Mark first:** UP8 (`r-marked-type`, `r-marked-items`) and RM7 (`r-marked`) refuse `marked-field`, and the lock makes one after the other the only order. L2 and L2b live show both orders. |
| AC3: alone, each write is as it was | met | Neither write's own suite changed in the diff, and both pass (11/0, 16/0), as do the suites that call them. HL1 and HL5 pin that the node locked is the concept's own header. The lock's set-and-clear commits nothing. L3 live. |
| AC4: the records say it holds | met | Decision 11's note (`0018:305`), Amendment 3 item 1's pointer (`:496`) and Amendment 4 (`:502-532`). The ledger row reads DONE, but its Done line misstates the live check (non-blocking 1). |

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behaviour beyond the story. The one effect outside the ACs is that a mark now goes one after the other with create-element, update-node and delete-node on the same concept, deadlocking and retrying with the last two. It is recorded as a Deviation and in Amendment 4 item 3, and it fixes the stale copy L0's L3 found.

### The Deviations, checked

- **No suite pinned either write's first statement.** Holds. Among the concept and field suites only create-concept's CC13 pins a first write (`create-concept.test.js:442`), so no existing case changed.
- **mark-field runs `field-mark-allowed` again after the lock.** Holds (`mark-field.js:27-34`, `:74-75`).
- **A mark now holds the header while it writes copies.** Holds (below).
- **The rulebook's entry 3 keeps its "Enforced by".** Holds. See non-blocking 5.
- **The fake learns one failure.** Holds (below).

## ADR adherence

- [x] Files match Amendment 4: `update-concept.js` (item 1), `mark-field.js` (item 2), `test/helpers/graphFake.js` (item 4) and the new suite. Nothing else under `src/` or `test/` changed.
- [x] Layering. The lock is `_sets.js`'s `lockNode`, the one the property writes take. The second run follows `_concepts.js`'s `recheck` (`:628-635`), and its throw is the write path's own expression (`write.js:57`).
- [x] No new dependencies.

### Q1: does each write take the header's lock before every read that decides what it writes?

- **update-concept.** apply checks its inputs with no graph (`K.cleanInputs`, `_concepts.js:109-126`, reads nothing). It then takes C1 (`update-concept.js:71`), then `S.lockNode` on the concept's header (`:74`), and only then runs the slug's second check (`:75`), `conceptFacts` (`:77`) and every later read. The write path's guard (`write.js:53-58`) reads before apply only for a slug, and its verdict is run again after both locks.
- **mark-field.** `S.lockNode` is apply's first statement (`mark-field.js:74`), and the rule's second run comes right after it (`:75`). The concept, the property node, the first set and the elements are read after both (`:77-81`), and so are the MERGE (`:85-91`) and the copies (`:97`).
- **The second run throws as the guard does.** `mark-field.js:33` is the same expression as `write.js:57`: `refusal(found[0].code, found[0].message, { rule: rule.name })`. The status comes from the declaration's refusals, which take in the guard rule's (`src/operations/index.js:45`, `:157`), so the same code answers the same status with the same `rule`. HL6 and HL7 pin it, and M7 shows they catch a second run that drops `rule`.

### Q2: the lock order, re-derived from every explicit lock

| Write | What it locks, in order |
|---|---|
| create-concept | C1 (`create-concept.js:71`) |
| update-concept | C1, then the concept's header (`:71`, `:74`) |
| add-property, set-schema | the concept's header, after reads only (`add-property.js:84`, `set-schema.js:78`) |
| update-property, remove-property | the concept's header, found by path first (`update-property.js:79`, `remove-property.js:97`) |
| mark-field, create-element | the concept's header, as the first statement (`mark-field.js:74`, `create-element.js:106`) |
| update-node, delete-node | the node (`update-node.js:160`, `delete-node.js:167`), then its concepts' headers in tapestryKey order, `word` and `graphContext` aside (`update-node.js:175`, `:182`; `delete-node.js:198-201`). A header, core node, property or set is refused `made-elsewhere` before any header lock (`_elements.js:108-150`). |
| create-set | its parent, which must be a superset or a set (`create-set.js:189`; `_sets.js:121-127`) |
| unlink-set | the set (`unlink-set.js:73`) |
| link-set, add- and remove-relationship, unmark-field, map-fields | no explicit lock |

- **C1 then the header can't close a cycle with an explicit lock.** Only create-concept and update-concept call `K.lock`, and each takes it first. Some writes reach C1's node through `S.lockNode`: update-node or delete-node naming it, or a property write, a mark or create-element on the concept-header concept. Each locks it first, holding nothing, and the first two refuse it before they take any other lock. No write takes C1 after a header, so Amendment 4 item 1 holds.
- **A mark beside update-node or delete-node can deadlock, and the driver retries it.**
  - mark-field holds the header while it writes copies onto the concept's elements, and the two element writes hold an element while they wait for its concepts' headers.
  - `graph.writeTransaction` runs `session.executeWrite` (`graph.js:47`). neo4j-driver-core 5.28.1 retries any Neo4j error whose code contains `TransientError` (`lib/error.js` `_isTransientError`) within 30 s (`lib/internal/transaction-executor.js:95`, `:153`), and `src/lib/neo4j-driver.js:35-38` doesn't change that time.
  - No catch block sits between a statement and the driver in mark-field, update-node, delete-node or the helpers they call, so the error reaches the driver as it was thrown. apply does nothing outside its transaction, and `at` is taken again on each attempt (`write.js:50-51`).
  - The probe's run 8 shows it live (below), so Amendment 4 item 3 holds.
- **Not in the amendment, and harmless.** Neo4j also locks a relationship's end nodes when it creates or deletes one, as the mark's MERGE and unmark-field's DELETE do on the shared first set. Any cycle through those is the same `DeadlockDetected`, retried the same way.
- **One gap in item 3's last bullet,** for concepts keyed `word` or `graphContext`. See non-blocking 3.

### Q3: is any other write still free to interleave with a property write?

- **In the catalog, no harmful one.**
  - The writes that change a concept's schema node, primary property, tree, property nodes or marks are create-concept (for a new concept), update-concept, the four property writes and mark-field, which all now lock the header, and unmark-field and map-fields, which don't.
  - update-node and delete-node refuse all those nodes (`made-elsewhere`). add-relationship's rule reserves every type firmware declares (`relationship-type-allowed.js`), so it can't touch a tree or a mark.
  - link-set, unlink-set and create-set change only `IS_A_SUPERSET_OF`. A mark is read only as a direct edge from the first set (`_fields.js:191-200`), so none of them makes or takes away a mark.
- **The test plan's reasoning about unmark-field and map-fields holds.**
  - unmark-field writes only the mark's edge and the copies (`unmark-field.js:67-75`). While a field is marked no property write may take it out or change its type (Decision 8). A property write that read the mark before unmark-field committed is refused `marked-field`, as it would be in the order "property write, then unmark". For a field that isn't marked, unmark-field writes nothing.
  - map-fields writes copies of marked fields from the elements' JSON (`_fields.js:329-379`). The type that decides a copy can't change while the field is marked.
  - So the story's Out of scope is sound, and no ledger row is needed for either.
- **Outside the catalog, D15's signed routes still write these nodes with no header lock** (non-blocking 3). ADR 0018 already leaves them as they are.

### Q4: the fake

- **It stands in for Neo4j faithfully for these two writes.** Each writes the header first through `S.lockNode` (`_sets.js:247-260`), the copies shape (`graphFake.js:624`) that `meanwhile` meets.
  - Reads before that see the old graph, as in Neo4j.
  - The merge check passes only when nothing has been written yet. The lock's set-and-clear is net zero, since a null deletes the key (`graphFake.js:467`), and the comparison sorts keys (`:130-132`).
  - The other write's graph becomes the committed one, so a rollback keeps it (HL0).
- **It changes nothing without the failure.** `meanwhile()` returns at its first test when the state has no `failures.meanwhile` (`graphFake.js:675-676`), and `tx.run` is otherwise the statement it was. graph-fake 31/0, delete-node 40/0 and every operations suite pass.
- **HL0–HL7 test what they say,** and the mutation table shows each half of the fix is pinned. The fake's header overstates which statements meet the failure (non-blocking 4).

## Concept-graph integrity

- [x] Handles: none added or changed.
- [x] Firmware: no concept definition or firmware file is in the diff, so no reinstall is needed. Amendment 4 item 5 chose not to change rule 3's element, which avoids one.
- [x] No TA pubkey is written anywhere in the diff. A scan of the added lines finds no 64-hex string.
- [x] No orientation code is added, so `/summaries` doesn't arise.

## Architecture invariants

- **Principle 4 (local-first).** The fix keeps a write to the local graph from being undone by another write. The schema node a rename overwrote has no event behind it on an unlettered concept, so before the fix only the change entry kept the lost version.
- **Principles 1–3.** Not touched: nothing is per point of view, and nothing gates publication.

## Things tests can't catch

- [x] No secrets in committed files.
- [x] No leftover debug output. A scan of the added `src/` and `test/` lines finds no `console.*`, `debugger` or `TODO`.
- [x] No commented-out code. By code point, the added lines' non-ASCII characters are only U+2014, U+2013, U+00A7, U+2026 and U+2500, with no control, format or combining characters.
- [x] Error paths.
  - A key that names no node locks nothing (`_sets.js:247-250`), and the refusals follow as before.
  - update-concept, given an element's key, locks that element under C1 and then refuses `unknown-concept`. No write waits for C1 while holding an element, so that can't close a cycle.
  - A refused write releases its locks at rollback.
- [x] Concurrency: Q2, the races live, and the probe.
- [x] Security: every new statement is parameterized, and the inputs are checked by the declarations as before.
- **Cost, not measured.** For a field not yet marked, the rule's second run repeats its read of up to 10,001 elements (`field-mark-allowed.js:118`). A new mark now reads the concept's elements three times (guard, second run, apply), the last two while it holds the header. mark-field is a rare admin write, so this is not a finding.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence *(when the story traces to a PRD)*

Not applicable. The book is an acceptance frame with no PRD, and nothing user-facing changed.

## The Evidence, audited against the records

| Claim (story's Evidence) | How I checked | Holds |
|---|---|---|
| New suite 8/0; 2/6 before the fix | my gate run; M1 with M6 fail exactly HL1–HL3 and HL5–HL7 | yes |
| update-concept 11/0, mark-field 16/0, unchanged | my gate run; neither suite is in the diff | yes |
| Each half of the fix caught (HL1–HL3; HL5–HL7) | M2 and M4 above | yes |
| The scoped gate's counts | the same 1,024/0/6, per suite, at HEAD on a clean tree | yes |
| The race table, before and after | I re-counted every run in `report-before.json` and `report-after.json`; each cell matches | yes |
| 17 of 20 renames ended within 2 ms of the add | 9 in L1 and 8 in L1b; the other three at delays of 300 or 400 ms | yes |
| After the fix, renames ended 92–98 ms (L1) and 235–254 ms (L1b) after the add | the same re-count | yes |
| "Before" is staging's code; "after" is `5c35826e` | the before-stamp's hashes `70ed8f8a…` and `e7ec7da5…` are both files at `02e21816` and `dd06b640`; the after-stamp's are `5c35826e`'s and HEAD's | yes |
| The races ran the fix | not in the record: I read the control panel's start time (Harness friction 1) | yes |
| The probe: run 8 deadlocked, update-node retried, 200 at 1,818 ms, copy blue; all 12 runs 200 and blue | `report-probe.json` | yes |
| The instance's assistant was `e0806a31…` | the addresses my read-only probe returned | yes |
| Firmware digests `c4c302955e90` and `ef7fb29d1a09` | not re-derived. They describe how the instance was set up, not the fix, and my run on it at HEAD repeats the after results. | — |

## Findings

### Blocking

None.

### Non-blocking

1. **`ledger/2026-11-17-concept-writes-skip-header-lock.md:7`: the Done line misstates the live check.**
   - It says "Before, writes were lost in most runs. After, both writes were kept in every run."
   - In L2 and L2b the fix keeps exactly one write and refuses the other, which is AC2's point. "Both kept" there would be the bug.
   - Before the fix those two races went wrong by both landing (5 and 3 of 10), not by losing a write.
   - The story's own table (`43-concept-writes-take-header-lock.md:102-109`) is right.
   - **Asked:** say it per race. For example: "Before the fix, 33 of the 50 race runs went wrong: a rename lost the property write's change (L1 9 of 10, L1b 10 of 10), a mark landed beside a type change or a removal (L2 5 of 10, L2b 3 of 10), or an element kept a stale copy (L3 6 of 10). With it, all 50 went as one after the other would: both writes kept in L1, L1b and L3, and in L2 and L2b one landed and the rules refused the other." I counted these from the two reports, but the next round should check the wording as a claim like any other.
2. **Small accuracy fixes in the record.**
   - `0018-property-operations.md:532` calls `concept-slug-unique`'s rulebook entry "§2". It is entry 4 (`docs/GRAPH_RULES.md:86`, "Enforced by" at `:95`). Entry 2 is `relationship-type-allowed`.
   - `update-concept.js:12-14` says the write "goes one at a time … with every write on the same concept". unmark-field, map-fields, link-set, unlink-set, add-relationship and remove-relationship take no header lock (Q2's table). **Asked:** "with every write that takes the concept's header: the property writes, mark-field, create-element, update-node and delete-node."
   - `0016-create-concept-and-update-concept.md:111`, Decision 9's step 2, still reads "Take the lock and run the rule again", with no pointer to the header lock now taken between the two. ADR 0018's Decision 11 got such a note (`:305`). **Asked:** a one-line note there naming ADR 0018 Amendment 4, item 1.
3. **Two edges of the lock's guarantee go unnamed** (Amendment 4 item 3's last bullet, `0018:522`; item 5, `:529-532`). Neither is new, and neither is this story's to fix.
   - **D15's signed routes** write a lettered concept's schema node and tree with no header lock:
     - `/api/normalize/save-schema` (`src/api/normalize/index.js:5655`), `set-json-tag` (`:5683`), `generate-property-tree` (`:5673`) and `create-property` (`:5672`);
     - `/api/property/generate-json-schema` (`src/api/property/index.js:200`).

     save-schema refuses a concept with no letter (`src/api/normalize/index.js:1997-1999`), so this reaches lettered concepts only. Beside a property write on one, a save can write back a schema it read before that write committed, which is the rename's failure in another route. ADR 0018 leaves these routes as they are (Consequences `:348`, Out of scope `:431`).
   - **The headers of concepts keyed `word` or `graphContext`.**
     - update-node and delete-node skip these headers (`update-node.js:175`, `:182`; `delete-node.js:198-201`), yet update-node writes copies for every concept the node belongs to (`update-node.js:309`).
     - So a mark on one of those concepts would not go one after the other with an element write, and L0's stale copy could come back there.
     - No field of `word` can be marked on a fresh install: on the scratch stack the rule refuses all six of its fields `no-property-node` (a read-only probe through `rule.violations`). Item 3's "They now go one after the other" therefore holds for every concept a mark can reach there.
   - **Optional:** name both in item 5, so "Closed by story 43" (`:305`) isn't read as covering every writer.
4. **`test/helpers/graphFake.js:103-104` and `:672-676` say `failures.meanwhile` fires at "the first lock or copies statement". Only the copies shape meets it** (`KIND`, `:624`).
   - These never meet it, though Neo4j would make each wait: K.lock's SET/REMOVE (the fake's `lock` kind, `:627`), a relationship's MERGE or CREATE at the node, and a DETACH DELETE of it.
   - That is enough here. Both writes first write the header through `S.lockNode`'s copies statement, and all of HL0's cases are copies statements.
   - **Optional:** say "the first copies statement (`S.lockNode`'s shape)" in the fake's header and HL0's title, so a later suite doesn't expect it to meet any other write.
5. **Nothing tracks bringing the rulebook's entry 3 into line.**
   - Amendment 4 item 5 keeps entry 3's "Enforced by" as written, to spare every instance a reinstall for wording alone. That is reasonable: `src/firmware/graph-rules.js:26-36` copies "Enforced by" into firmware's element, and entry 3's text stays true.
   - But entry 4 now names its second run (`docs/GRAPH_RULES.md:95`) and entry 3 doesn't, and the reason is recorded only in this ADR.
   - **Optional:** a ledger row, so the next change to rule 3's element adds "run again after it takes the lock on the concept's header" to entry 3.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. **A live check's code stamp can't show that the server loaded the stamped files.**
   - live.js stamps HEAD, `git status`, and the two watched files' hashes as they are here and as mounted (`tmp/live-check-43/live.js:51-56`). That covers most of ledger row `2026-11-17-live-check-records-name-no-commit` (OPEN).
   - But the races go over HTTP to the control panel, which loads `src/` once, when it starts.
   - The after-run did run the fix. Its control panel started at 06:24:36Z, after both files' last write and 21 s before the run. Neither the report nor the Evidence records that restart; I read it from the container.
   - **Asked of that row's fix shape:** stamp the control panel's start time beside the watched files' last-change times, or restart it before each run. No new row.
2. **The review template still puts "On PASS" after "Verdict"** (`templates/review-checklist.md:61-66`). Row `2026-10-07-on-pass-heading-reads-as-verdict` is still OPEN. This review puts On PASS above, as reviews 18 and 42 do. No new row.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place, in this commit.
- [x] Completion detection performed. The result goes in the chat, never in this file.

## Verdict

**PASS**
