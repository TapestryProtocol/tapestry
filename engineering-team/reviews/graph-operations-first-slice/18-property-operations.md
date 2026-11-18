# Review: Story 18 — `graph add-property`, `update-property`, `remove-property` and `set-schema`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-17
**Diff:** `git diff af392639..c6a2ea51`. `af392639` is staging's tip, merged into the branch at `e509c390`. Branch `A10.18-property-operations`, six commits over staging: `901e9c42` (ADR Amendment 1), `0ccb5fdd` (the failing tests), `e509c390` (staging merged in, with A10.20.b), `acd36fa5` (ADR Amendment 2), `bd017881` (AP3 and AP14), `c6a2ea51` (the implementation). 29 files, +3,736 −69.
**Inputs:** story `engineering-team/stories/graph-operations-first-slice/18-property-operations.md` (AC1–AC9, "Corrected at Architecture", Deviations, Evidence); ADR `engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md` with Amendments 1 and 2; test plan `18-property-operations.test-plan.md`.
**Independent check** (workflow 5, optional): not applied by this reviewer.
**Checked before the commit:** the session that spawned this reviewer re-derived findings 1, 5 and 6 from the sources before committing: mark-field takes no lock and update-concept only the concept-header concept's; `test/helpers/propertyGraph.js:66` holds U+0300 and U+036F; and the first gate's `gate.log:1365` and `:1819` are `js-yaml` and `nostr-tools`. Each holds. Harness friction 1 is filed as ledger row `2026-11-17-live-check-records-name-no-commit`.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, scoped.** I did not run the full gate: on this Mac about 40 suites write to the agent-memory instance, and the PR's CI runs it whole. I ran CI's registry entries for an operations change through the gate engine. Those are `operations.test.js`, which runs every suite under `test/operations/`, then `external-cli`, `openapi-coverage`, `admin-action-sweep` and `schema-save-finds-the-right-header`. Every endpoint was dead: Neo4j, Redis, Meilisearch, both base URLs and the ports at 9, `TAPESTRY_CONTAINER=no-such-container`, and a `BRAINSTORM_CONF_PATH` that points Neo4j and Redis at port 9. Node 24.18.0. `npm run -s gate:status -- --label a10-18-story-18-review-1` reads:
  `20261118T023545Z-55994-572c [a10-18-story-18-review-1] started 2026-11-18T02:35:45.194Z on c6a2ea51+dirty — PASS, exit 0, 1014 passed, 0 failed, 6 skipped, 5/5 suites` (record `tmp/gate-runs/20261118T023545Z-55994-572c.json`)
  - **`+dirty` is the untracked `node_modules` link alone.** The record's `git.dirtyCount` is 1, and `git status --porcelain` shows only `?? node_modules`. So the code under test is `c6a2ea51`.
  - **Per suite:** operations 913/0/4, external-cli 53/0/0, openapi-coverage 13/0/0, admin-action-sweep 9/0/0, schema-save-finds-the-right-header 26/0/2. These sum to 1,014.
  - **The new suites, inside operations:** add-property 14/0, update-property 11/0, remove-property 8/0, set-schema 9/0, properties-agent-through-cli 1/0. Their neighbours: delete-node 40/0, mark-field 16/0, update-node 42/0, rule element-fits-schema 11/0, rule field-mark-allowed 14/0.
  - **The six skips are live checks.** Four are lifecycle migrate's (`TAPESTRY_KEYS_LIVE` isn't set). Two are schema-save's (`no-such-container` isn't a scratch container).
- [x] **`test/graph-rule-firmware.test.js` 13/0 and `test/graph-rules-builder.test.js` 26/0,** each run alone with the same dead endpoints. graph-rule-firmware's live checks skip outside a `tapestry-scratch…` container.
- [x] **`bash scripts/harness-lint.sh`:** before this file existed, `harness-lint: clean (0 violations)`, exit 0. With it in place, one violation, exit 1: L1, "review … is PASS-final but story status is 'Approved'". The review commit's `**Status:** Done` on the story clears it (On PASS, below).
- [x] **`node src/firmware/graph-rules.js --check`:** "the 7 items in firmware/active/concepts/graph-rule/elements are current", exit 0. `firmware/active` is a link to `versions/v1.0.0`. Rule 3's regenerated `no-property-node` text equals the rulebook's §3 line, and it agrees with the rule's `when` (`field-mark-allowed.js:65`).
- [ ] `npm run test:playwright`: not applicable, since no UI changed.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._
- [x] **Probes**, under `tmp/review-18/` (ignored by git), each with the dead endpoints:
  - `live-shapes.js` validates the live answers left in `report-main.json` against the committed result schemas;
  - `probe-inputs.js` checks the input edge cases;
  - `probe-cap.js` checks the report's cap over the suites' fake graph;
  - `probe-description.js` follows a description holding a control character;
  - `codepoints.js` scans the diff's added lines by code point.

## Spec adherence

- [x] **Every acceptance criterion has a passing test,** with one gap in AC6 (non-blocking 3).
  - **AC1:** AP1, AP3, AP4, AP5 and AP8. The Properties tab's own query lists each field with its type and its parent.
  - **AC2:** AP2 (catch-up nodes marked `catchUp`, and the hygiene check passes), AP8, UP9, SS6, RM6, AP11 and UP10 (a refused write undoes its catch-up), and SS5.
  - **AC3:** UP1–UP8.
  - **AC4:** RM1–RM6. RM2 keeps the whole node, its relationships with `from` and `to`.
  - **AC5:** SS1–SS4 and SS7. The schema reads back as given, with `filledIn` naming every addition.
  - **AC6:** AP6, AP7 and SS3–SS5. AP7 has the rule's `{ node, concept }` form find exactly the report's elements, judged on tapestryJson. The 50-element cap and `beyond` have no suite (non-blocking 3).
  - **AC7:** AP11, AP12, UP10, RM7, SS7 and SS8. AP11, UP10, RM7 and SS8 each find the graph after their refusals equal to the graph before them. AP14 pins Amendment 2's check.
  - **AC8:** AP9, UP9, SS6 and RM6 for the letter. AP11 and SS8 for another author's concept, one under the owner's own key, and a firmware concept. AP10 for the lock. L2, live, for two at once.
  - **AC9:** AP13, UP11, RM8 and SS9 (the spy sees nothing signed; 401, 403 and 415; the list; `/docs`; the command). X18 for the agent through the external CLI. `clients/` is untouched in the diff. The reinstall and the restore are the live L3 and L4.
- [x] **No criterion is silently dropped.** The narrowings (only wrapped schemas, typed fields, the size bound) are the story's "Corrected at Architecture", approved with the ADR.
- [x] **No behavior added that isn't in the story.** The rule 7 rulebook text (`docs/GRAPH_RULES.md` §7) goes beyond Decision 15's list. It is follow-through, since §7 said the property operations "will" run the check. Ledger row `2026-11-17-rule-three-rewrite-awaits-firmware-reinstall` names both entries.

## ADR adherence

- [x] **Files match the Implementation notes.** The diff adds `_properties.js` and the four declarations. It adds `_schemas.validatorOf`, moves `wholeNodeOf`, `removalOf`, `relationshipsOf`, `storedOf` and `U0` from delete-node into `_nodes.js` (delete-node's 40 tests pass unchanged), documents `path` and `catchUp` in `changes.js`, and edits the messages and docs of Decision 15. `_fields.js`, the CLI, `/docs` and `test/helpers/graphFake.js` are unchanged (Amendment 1, item 9). Some helper names differ from the notes' sketch: `schemaProblem` with `withFillIns` stands for `checkSchema`, and `commit` for `applyPlan`. What they do matches.
- [x] **Decision 7's order holds.** `not-own-node` runs inside `commit` once the plan says what changes (`_properties.js:737-743`), before the marks, the size and compile check, the addresses and the writes. So a refusal changes nothing, as AP11, UP10, RM7 and SS8 show.
- [x] **Amendment 2 is what the code does.** `_properties.js:866-892` judges each node written with the rule's write form, after the write and, for a node that existed, as it was. It refuses only a finding the JSON before didn't have: a concept the node fitted, or a problem by its words. `word` and `graphContext` are set aside. The finding shape it compares (`item`, `concept`, `code`, `problems`) is the rule's write form (`element-fits-schema.js:91-96`).
- [x] **Layering.** It uses `E.makeNode`, `E.addTags`, `F.writeCopies`, `S.lockNode` and the shared refusals. Like the other `_*.js` modules, `_properties.js` requires the rules and the store only when called.
- [x] **No new dependencies.** `package.json` and the lockfile are untouched. ajv was already in use.
- [x] **The role boundary held.** `c6a2ea51` touches no test file. The test changes are the Tester's: `0ccb5fdd`, and `bd017881` at Amendment 2.
- [x] **Every Deviation checks out:**
  - MF6 pins the signing route in `no-property-node` (`mark-field.test.js:237`), and DN25 pins `A10.18` (`delete-node.test.js:718`).
  - BIBLE's property tree is in §6, not §9 (`BIBLE.md:256-282`; §9 is the core-nodes section).
  - The tree read goes 33 levels (`_properties.js:476`, `:488`), and a tree graph node goes by its d-tag (`:972-983`).
  - Phantom nodes are neither made nor recorded (`:722-724`).
  - The refusal lists are complete. I traced every code that `_properties.js` and each declaration throws to a declared refusal or the guard rule's.
  - `already-gone` answers `removed: []` and `elements: null` (`remove-property.js:37-49`).
  - A catch-up change's `was` for a node in the old shape is `{ schema: null, required }` (`:453`, `:400-406`).
  - `__proto__` is refused in a piece's top level, and kept as an own key when nested (probe).
  - One part doesn't hold as written: the key order of the report's lists holds only up to 10,000 elements (non-blocking 3).

## Concept-graph integrity

- [x] **Handles are in `kind:pubkey:slug` form, from the runtime assistant.** New nodes are `39999:${inst.ta}:<dtag.childDTag(key, parent uuid)>`, with the nonce form `~n` (`_properties.js:776`; `src/lib/dtag.js:51-54`). The z tag is `K.firmwareUuid('property')` (`:589`, `:807`). `inst.ta` is `K.assistant()` (`:587`). No 64-hex literal is added under `src/`.
- [x] **Firmware reinstall is called out.** No concept definition changes. Rule 3's and rule 7's graph-rule elements are regenerated, and ledger row `2026-11-17-rule-three-rewrite-awaits-firmware-reinstall` carries the reinstall on staging and production, as ADR Consequences says.
- [x] **Orientation.** No new code reads BIBLE. The writes read concepts from the graph through `_concepts.js`.

## Architecture invariants

- **Local-first (§30):** the property nodes have no event behind them. The live L3 and L4 show a reinstall leaves them, and a restore on a fresh instance brings them back with their tapestryKeys. A node catch-up takes out is kept whole in its entry.
- **Decentralized-first:** nothing gates what others publish. The writes refuse to change another author's concept or node (D4), as update-concept does.
- **POV and view-time filtering:** a schema isn't per-POV. The element report is computed per call, not stored.

## Things tests can't catch

- [x] **No secrets.** The one key-like added line is `NT.generateSecretKey()` in the agent suite, which makes a throwaway key at run time. The live check's `keys.json` is under `tmp/`, ignored by git, and not in the diff.
- [x] **No debug logging.** No `console.` is added under `src/`, and no TODO, FIXME or XXX anywhere.
- [x] **No commented-out code.**
- [x] **Error paths.** Every refusal comes before the first write. The thrown internal errors (`_properties.js:772`, `:799`, `:855`, `:958`) are for states the header lock rules out.
- [ ] **Concurrency.** Among the four writes, the header lock holds (AP10, live L2). Two other writes that rewrite these nodes don't take that lock (non-blocking 1).
- [x] **Security.** No prototype pollution:
  - objects are built with `Object.fromEntries`, and own keys are tested with `hasOwnProperty`;
  - `__proto__` is refused as a name, as a schema key and as a piece's top-level keyword;
  - nested, it stays an own key, and `Object.prototype` stayed clean in the probe.
  - One input check is narrower than it looks: a description's control character (non-blocking 4).

## House rules check

- [x] Concept Graph API authority respected. Concepts are read from the graph, and the TA pubkey is resolved at run time.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence *(when the story traces to a PRD)*

Not applicable: the story traces to no PRD copy or design guide, and no UI changed.

## The Evidence, audited against the records

| Claim (story Evidence) | Verified by | Holds |
|---|---|---|
| The five suites 14/0, 11/0, 8/0, 9/0, 1/0; the neighbours' counts | My gate run, and graph-rule-firmware and graph-rules-builder run alone | Yes |
| The final implementation gate line, `20261118T021214Z-39591-5716 … on bd017881+dirty — PASS … 1014 passed` | `npm run -s gate:status -- --run 20261118T021214Z-39591-5716`, character for character | Yes |
| "The first run failed 13, every one on the route walker's `Cannot find module …/node_modules/express`" | Record `20261118T020059Z-33339-696e` and `tmp/live-check-18/gate.log` | All 13 come from the missing `node_modules`, but two aren't the route walker's express. openapi-coverage's D2 couldn't find `js-yaml` (`gate.log:1365`), and schema-save-finds-the-right-header didn't load: `…/node_modules/nostr-tools` (`gate.log:1819`). Non-blocking 6 |
| Before the implementation, the five suites failed for want of their declarations | `git ls-tree e509c390`: no declaration files; 13, 11, 8, 9 and 1 tests at `e509c390`. Each suite's `needDecls` throws first | Yes (from git; not re-run at `e509c390`) |
| harness-lint clean; rules 3 and 7 current | My runs | Yes |
| "A code-point scan of every file touched finds no control or invisible character this branch added" | `codepoints.js` over the diff's added lines | Two combining marks, at `test/helpers/propertyGraph.js:66`. Non-blocking 5 |
| Run 2: 23 of 23 on `live teapot jf5c` | `main.log` and `report-main.json`: 23 checks, all `ok` | Yes, on a prototype `_properties.js` (non-blocking 2) |
| L1's sub-claims, L2 (`added` and `already-exists`, one node), L5 (four agent writes, history newest first, visitor 401) | `report-main.json`'s check details | Yes |
| L3: a reinstall leaves nodes, tags, relationships and the schema node's JSON | The L3 detail, `{ status: 200, differs: [] }`. Its `same(docAfter, schemaDoc(C))` compares the after-reinstall schema with itself (`live.js:248-250`). The schema node's json tag is still compared, through the snapshot's tags (`live.js:124-127`) | Yes |
| L6: "465 events before the writes and 465 after: none of them signed" | `relayBefore` and `relayAfter`, 465 and 465 | Yes for the seed and L1. The count is read before S1 and after L1 (`live.js:148`, `:204`), so it doesn't bracket L2, L5 or L7. The suites' spy covers those. Non-blocking 6 |
| L7: add-property 0.74 s, set-schema 0.34 s, elements 120 s, derive 6.1 s | The L7 detail: 0.74116, 0.34167, 119.735, 6.145 | Yes. The kept add answer also shows the cap live: 1,000 stopped, 50 named, in key order |
| L4: backup `20261118T020341Z-db606e37`, 6.3 MB, 9,674 nodes and 9,177 relationships, transaction 21933, counts exact, the backup's assistant taken | `backup.json`, `upload.json`, `restore.json` (`recorded` and `loaded` 21933, `exact`, assistant `dc263c35…` → `8267c3b9…`), and `report-restored.json` (`differs: []`) | Yes |
| The scratch stack mounted this worktree's `src/` | `up.log` and `up-restore.log` ("src/ from …/worktrees/A10.18") | Yes |
| The image's and the branch's firmware digests; the key setup; the `down` checks | `hand-calls.md` only | Not verifiable: the stack is removed |

## Findings

### Blocking

None.

### Non-blocking

1. **Decision 11's "What it gives" (`0018-property-operations.md:303`) overstates. Two writes that rewrite these nodes don't take the concept header's lock, so they can interleave with a property write.** I found this by reading and didn't reproduce it: the fake runs one transaction at a time, and L2 ran only two add-property calls.
   - **update-concept's rename.** It takes the firmware concept-header node's lock (`update-concept.js:66`; `_concepts.js:618-624`). It then reads the concept's core nodes (`:69`) and writes, in one statement (`:143`), the header's name first (`ROLES`, `_concepts.js:32`, `:685`) and the whole json tags of the schema node, the primary property and the tree graph, wherever they still hold the old names' template text (`renameRows`, `:705-713`), from what it read. A property write holds the header (`S.lockNode`) and rewrites the same three json tags (`_properties.js:839-858`).
     - **Suppose the rename reads while a property write is in flight.** Its statement waits on the header, then writes JSON from its earlier read. That undoes the property write's change to the schema node, the primary property and the tree graph. Its property nodes stay. AC2's agreement is broken.
     - **The next property write's catch-up then follows the schema.** It takes the new node out as one the schema doesn't list. The node is kept whole in that entry, so it can be put back.
     - **A plural-only rename** writes only tag nodes, so either write's change to the shared json tags can be the one lost.
   - **mark-field.** It takes no header lock (`mark-field.js:51-85`). Its MERGE locks only the first set and the property node (`:63-69`). update-property's type change writes only tag nodes (`_properties.js:821-837`), so neither write waits for the other.
     - **A type change can land on a field marked after its check read the marks** (`:746`). Decision 8 refuses that change when the two run one after the other.
     - **remove-property in the same window** waits on the property node, then deletes it with its new mark edge. The mark's copies stay on the elements, with no mark.
   - **Both cases need an owner or an admin to run the two writes at once on one concept.** The entries keep what was lost.
   - **Asked:**
     - record both cases in Decision 11 as known limits;
     - file a ledger row with a fix shape (for example, update-concept and mark-field take `S.lockNode` on the concept's header after their own lock and before they read), or take that lock here.

2. **The live check ran on a prototype `_properties.js`, edited after run 2, and the Evidence (`18-property-operations.md:172-200`) doesn't say so.**
   - `hand-calls.md:43-45` records run 2 with Decision 10's check "changed, uncommitted".
   - `report-main.json` was written at 20:47:03 local. `_properties.js` was last changed at 21:10:50, after the backup (21:04:12) and the restore check (21:10:32). Every other file of the diff under `src/` and `firmware/` was last changed before the scratch stack booted (20:38:07, `up.log`).
   - **What bounds the gap:**
     - the implementation's second and final gate logs, from before and after that edit, are identical apart from timings;
     - the nine live answers `report-main.json` still holds fit the committed result schemas. `live.js:231` trims the call list during L7, so these are the only ones left;
     - no dangling blob in the object store holds another version of it (`git fsck --dangling --no-reflogs`).
   - **Asked:** say in the Evidence that run 2 ran before `_properties.js`'s last edit, and what that edit changed. If it changed more than comments or messages, re-run L1 on a scratch stack at the commit before the merge to staging.

3. **AC6's cap and `beyond` have no suite.** AC6 (`:65`) says the list is capped and says when the concept has more elements than one call judges. The ADR's notes (`:405`) list "the caps and `beyond`" among the report's tests. The test plan's AC6 row (`:24`) leaves them out without saying so.
   - **The 50-element cap holds.** The live L7 answer named 50 of 1,000, on the prototype. On the committed code, `probe-cap.js` over the suites' fake graph gives 63 stopped, 50 named, in key order.
   - **`beyond: true` has never run.** `_properties.js:1029-1031` reads 10,001 elements, judges the first 10,000 in read order (`elementsOf` has no `ORDER BY`, `_fields.js:228-239`), then sorts them. So past 10,000, which 50 the report names does depend on read order. The Deviation (`:155`) says it doesn't.
   - **Asked:** a suite case for the cap, and a case or a test-plan note for `beyond` (the Tester). Optionally, bound the Deviation to 10,000.

4. **A description's control character is refused as `description`, but kept when given inside `schema` or a set-schema document.**
   - `pieceInput` compares a piece's description only with the input beside it (`_properties.js:251-253`). `definitionFor` keeps it (`add-property.js:22-25`), update-property assigns it (`update-property.js:94`), and `schemaProblem` doesn't look at descriptions (`_properties.js:317-352`). The node's description tag then holds it (`:806-807`, `:830-834`).
   - **The probe:**
     - `description: "a" + U+0001 + "b"` is refused, 400 `bad-description`;
     - the same text in `schema` lands, 200, and its tag holds `a`, U+0001, `b`;
     - the same text in a set-schema field lands, 200, with the same tag.
   - **Asked:** run `CN.descriptionProblem` on any description that becomes a tag, whatever input it came from, or name the gap in the ADR.

5. **`test/helpers/propertyGraph.js:66` holds a raw U+0300 and U+036F,** the combining-mark range of its slug regex. These are nonspacing marks, which render onto the bracket before them. `src/lib/dtag.js:26` writes the same range as escapes, and the suites' own convention is to build such characters with `String.fromCodePoint` (`add-property.test.js:40`). The Evidence's scan (`:169`) found none.
   - **Asked:**
     - write the range as `\u0300-\u036f` (the Tester's file);
     - have the scan count combining marks, or say that it counted only controls and format characters.

6. **Small accuracy fixes in the record.**
   - **The first gate's failures.** `18-property-operations.md:168` and the ledger row `2026-11-16-route-walk-needs-node-modules.md:18` say "every one" of the first gate's 13 failures was the route walker's express. Two weren't. openapi-coverage's D2 couldn't find `js-yaml` in its throwaway copy (`tmp/live-check-18/gate.log:1365`), and `schema-save-finds-the-right-header` failed to load on `…/node_modules/nostr-tools` (`:1819`). The cause is the same, a worktree with no `node_modules`.
   - **L6's scope.** `:193` should say that the count brackets the seed and L1's writes, not L2's, L5's or L7's (`live.js:148`, `:204`).
   - **L3's check (optional).** Next time, compare L3's schema with the one read before the reinstall (`live.js:248-250`).

7. **`docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md:3`, the status line, now names the property operations, but still ends "no other BIBLE text exists yet".** This story itself adds §6 text on the property writes (`BIBLE.md:267-268`, `:274`, `:281`). Asked: drop or update that clause.

8. **set-schema accepts properties under a field that isn't an object, and update-property then refuses every change to that field.**
   - `schemaProblem`'s walk descends `properties` whatever the field's type (`_properties.js:329-346`). The probe gives `null` for `{"type": "string", "properties": {…}}`, so such a field lands with child nodes.
   - update-property's `has-properties` check runs whenever the type it leaves isn't object (`update-property.js:99-103`). So even a description change is refused, saying its type "can't become" string.
   - **Asked:** refuse `properties` under a non-object in `schemaProblem`, or run that check only when the type changes.

9. **Optional, not measured: the address check at the size bound.** `_properties.js:773-780` sends every candidate address of every ready node in one `IN` list. That is 100 per node, so about 100,000 strings of about 90 characters each at set-schema's 1,000-property bound. L7 timed 1,000 elements, not 1,000 properties. Optional: look up the base d-tags first, and the nonces only for those held. Or time set-schema at the bound.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. **A live check's records don't name the code it ran.**
   - `scripts/scratch-stack.sh` mounts the worktree's `src/` live, and the stack is removed after the check.
   - The records name no commit, and no hash of the tree or of the modified files. So a review can tell the code that ran from the code committed only by file times. In this story, run 2 predates the last edit of `_properties.js` (non-blocking 2).
   - **Fix shape:** each live-check record carries `git rev-parse HEAD` and a hash of each modified file under `src/` (for example `git hash-object`), taken at each run.
2. **The review template still puts "On PASS" after "Verdict"** (`templates/review-checklist.md:61-66`). Ledger row `2026-10-07-on-pass-heading-reads-as-verdict` (OPEN) says that breaks the verdict parser. As review 42 does, this review puts it above. The row is already filed, so no new row.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place, in this commit, by the session that commits this review, since this reviewer edits no other file.
- [x] Completion detection performed. The result and any book arithmetic go in the run journal (Direction) or the chat (human-gated), never in this file. `/close-book` is offered if the book looks complete.

## Verdict

**PASS**

## Round 2 — 2026-11-17 (HEAD `3f4cb7a8`)

**Diff:** `git diff 1ab4e00c..3f4cb7a8`, where `1ab4e00c` is round 1's review commit. Four commits:
- `d8a8bb1b`: ADR 0018 Amendment 3, with a pointer under Decisions 4 and 11;
- `0e2039e0`: the Tester's cases for findings 3, 4, 5 and 8, and the test plan's "Added at review round 1";
- `27f1a985`: the Implementer's fixes, the docs, the Evidence's corrections and a new ledger row;
- `3f4cb7a8`: the Evidence for the fixes, with the live check run again on `27f1a985`.

12 files, +152 −17. Only the Tester's commit touches `test/`, and the Implementer's touches no test. No file under `src/`, `firmware/`, `bin/`, `clients/` or `test/` changed between `27f1a985` and `3f4cb7a8`. Round 1's text above is as committed at `1ab4e00c`, with the committing session's "Checked before the commit" line and its On PASS ticks.

**In short:** eight of round 1's nine findings are fixed or recorded as asked. The ninth, an optional speed-up of the address check, was rewritten, and the rewrite can give a new property an address another node holds. That blocks this round.

### Quality gates (round 2, run by reviewer)

- [x] **`npm test`, scoped,** as in round 1: the same five registry entries through the gate engine, every endpoint dead, Node 24.18.0. `npm run -s gate:status -- --label a10-18-story-18-review-2` reads:
  `20261118T032436Z-37554-2ac3 [a10-18-story-18-review-2] started 2026-11-18T03:24:36.340Z on 3f4cb7a8+dirty — PASS, exit 0, 1015 passed, 0 failed, 6 skipped, 5/5 suites` (record `tmp/gate-runs/20261118T032436Z-37554-2ac3.json`)
  - `+dirty` is the `node_modules` link alone (`dirtyCount` 1).
  - operations 914/0/4, external-cli 53/0/0, openapi-coverage 13/0/0, admin-action-sweep 9/0/0, schema-save-finds-the-right-header 26/0/2. add-property is 15/0, with AP15. Every other suite's count is round 1's.
- [x] **The full gate was not run here,** for round 1's reason. The PR's CI runs it.
- [x] **The new cases fail without their fixes.** I extracted `1ab4e00c` into `tmp/review-18/at-1ab4e00c/`, put HEAD's `test/` over it, and ran the three changed suites alone, every endpoint dead:
  - add-property 14/1. AP11's `r-piece-desc-control` got 200, added. AP15 holds there too: it pins what round 1's code already did.
  - update-property 9/2. UP10's `r-piece-desc-control` got 200, updated, and UP4 then fails on the description that update left on price.
  - set-schema 7/2. SS8's `r-desc-control` got 200, set, and SS9 then fails on gadget's schema.
  - Those are the test plan's counts and reasons (`18-property-operations.test-plan.md:132-135`).
- [x] **`bash scripts/harness-lint.sh`:** clean, 0 violations. **`node src/firmware/graph-rules.js --check`:** the 7 items current.
- [x] **Code points.** No control, format or combining character, and no variation selector, in the added lines of round 2 or of the whole branch (`af392639..3f4cb7a8`). `test/helpers/propertyGraph.js:66` writes its range as ASCII escapes, and its `slugOf` gives `dtag.slug`'s answers for accented names.
- [x] **Probes**, under `tmp/review-18/`, each with dead endpoints:
  - `probe-inputs.js` and `probe-description.js`, run again. A description holding U+0001 is now refused `bad-description` as the input, inside `schema`, and on a set-schema field, and no tag lands. A string field with properties is `bad-type`.
  - `probe-current-schema.js`. add-property on a concept whose current schema has either problem is refused 409 `unreadable-schema`, with the graph unchanged, and set-schema still replaces that schema.
  - `probe-nonce.js` and `probe-nonce-sequence.js`, each on HEAD and on the `1ab4e00c` copy: the address check (blocking 1).
- [x] **The live check's rerun**, read against `tmp/live-check-18/main-round2.log`, `report-main-round2.json`, `up-round2.log` and `hand-calls.md`'s last section:
  - **The stamp holds.** The report stamps `27f1a985c576ecca7d930d6e4996aca8e20ce370`, with only `?? node_modules` beside it. `live.js:146-148` takes it from `git rev-parse HEAD` and `git status`, and hashes any modified file under `src/` or `firmware/`.
  - **The timeline holds**, in local time. `_properties.js` and `set-schema.js` were last changed at 22:14:32 and 22:14:47, `27f1a985` was committed at 22:16:20, `up-round2.log` booted the stack at 22:18:13, and the run went from 22:19:51 to 22:23:17. So it ran the committed code, which is HEAD's.
  - **24 of 24 checks are `ok`,** on `live teapot z8sw`. L7 took 0.68595 s and 0.341319 s. L3 compares with the schema read before the reinstall (`live.js:251-258`).
  - **The relay held 465 at all five counts** (`live.js:152`, `:207`, `:246`, `:257`, `:275`): before the seed, after L1, after L2 and L7, after the reinstall, and at the end.
  - L4 wasn't run again. The Evidence says so, and why (`18-property-operations.md:216`), so its record is still run 2's.

### Round 1's findings

| Round 1 | Disposition |
|---|---|
| Non-blocking 1: two writes skip the header lock | **Recorded as known limits,** as asked: Decision 11's pointer (`0018-property-operations.md:305`), Amendment 3 item 1 (`:492-496`), and ledger row `2026-11-17-concept-writes-skip-header-lock`. I re-derived each claim. create-element (`create-element.js:106`), update-node (each concept it judges, `update-node.js:182`) and delete-node (`delete-node.js:200`) take the header's lock. update-concept takes C1 (`_concepts.js:617-624`), and mark-field takes none. map-fields removes every copy in the concept's namespace that no mark yields (`map-fields.js:7-9`). Accepted. |
| Non-blocking 2: the live check ran on a prototype | **Resolved beyond the ask:** the check ran again on the commit, with a stamp (above). The Evidence's account of the two later edits (`18-property-operations.md:180`) has no record to check it against, but the rerun makes it moot for L1–L3 and L5–L7. |
| Non-blocking 3: no suite for the cap or `beyond` | **Fixed for the cap.** AP15 (`add-property.test.js:433`) pins 60 counted and 50 named, the first 50 by tapestryKey, in both lists. **`beyond: true`** gets a test-plan note with its reason (`18-property-operations.test-plan.md:128`), and the Deviation is bounded to 10,000 (`18-property-operations.md:155`). Accepted. |
| Non-blocking 4: a description's control character | **Fixed.** `pieceInput` (`_properties.js:254-257`) and `schemaProblem` (`:347-348`) check it, and set-schema declares `bad-description`. AP11's, UP10's and SS8's new cases fail on round 1's code. A current schema with such a field is refused `unreadable-schema` (probe), though that refusal's declared text doesn't say so (round 2's non-blocking 1). |
| Non-blocking 5: raw U+0300 and U+036F | **Fixed** at `test/helpers/propertyGraph.js:66`, and the Evidence's scan sentence is corrected (`18-property-operations.md:169`). |
| Non-blocking 6: the record's accuracy | **Fixed:** `18-property-operations.md:168`, the ledger row (`2026-11-16-route-walk-needs-node-modules.md:18`), L6's line (`:193`), and L3's comparison in the rerun. |
| Non-blocking 7: the design handoff's status line | **Fixed** (`docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md:3`). It no longer says no other BIBLE text exists, and claims no full list. |
| Non-blocking 8: properties under a non-object | **Fixed.** `schemaProblem` refuses it `bad-type` (`_properties.js:343-346`), SS8's `r-props-under-string` pins it, and a current schema with one is refused `unreadable-schema` (probe). So after catching up, a node with children is always an object, and update-property's `has-properties` can only meet a type change away from object, as Amendment 3 item 3 says. |
| Non-blocking 9 (optional): the address check at the size bound | **Changed, and regressed:** round 2's blocking 1. |
| Harness friction 1: live-check records | Filed as ledger row `2026-11-17-live-check-records-name-no-commit`, and its fix tried in the rerun. |
| Harness friction 2: On PASS after Verdict | Unchanged. Row `2026-10-07-on-pass-heading-reads-as-verdict` is still OPEN. |

### Findings (round 2)

#### Blocking

1. **`src/operations/catalog/graph/_properties.js:789-795`: the rewritten address check can give a new property an address another node already holds.**
   - **The cause.** `crowded` (`:792`) is worked out before the assignment loop adds to `taken` (`:794-798`). Two new siblings in one write whose keys slug alike (`Price` and `price`, or `first name` and `first_name`) share one plain d-tag. Neither counts as crowded, so the second one's nonces are never looked up, and it takes `~1` whether or not a node holds it.
   - **Reproduced by the operations alone** (`probe-nonce-sequence.js`), on tea house:
     1. set-schema adds `Price` and `price`, which take the plain address and `~1`;
     2. set-schema takes `Price` out;
     3. set-schema adds `PRICE` and `pRice`. `PRICE` takes the plain address, and `pRice` takes `~1`, which `price` holds.
   - **The result.** After step 3, two property nodes of one concept share `39999:<TA>:price-<hash8>~1`. On round 1's code (`1ab4e00c`), the same three calls give `pRice` `~2`, and no address is held twice. `probe-nonce.js` shows the same thing in one call, over a node seeded at `~1`.
   - **Nothing refuses it in Neo4j.** The only uniqueness constraint on an address is on `NostrEvent.uuid` (`setup/neo4jConstraintsAndIndexes.sh:45`). These nodes have no event, and `tapestry_node_uuid` is a plain index. So the doubling is silent: a lookup by address finds two nodes, and `export nostr` (A10.34) would send two letters for one address.
   - **The other writes reach it too.** Catching up uses the same loop, so add-property, update-property and remove-property hit it when catching up and the write's own change make two such siblings in one write. I found that by reading.
   - **No suite reaches Decision 5's nonce search at all,** before this change or after. Round 1 didn't notice that either.
   - **Asked:**
     - fix the check so that a plain address another new node in the same write takes gets its nonces looked up too (for example, treat a plain address that two of `ready` share as crowded), or go back to round 1's single lookup, since finding 9 was optional;
     - correct Amendment 3's account of it ("the nonces only for one that is held", `0018-property-operations.md:500`) and the comment at `_properties.js:789`;
     - a suite case for Decision 5's search (the Tester's): a held plain address gives `~1`, and two new siblings whose keys slug alike, with `~1` held, give `~2` and leave no address held twice.

#### Non-blocking

1. **`_properties.js:81`: `unreadable-schema`'s declared text lists only the older causes.**
   - A current schema with a field description the check refuses, or with properties under a non-object, now answers `unreadable-schema` (probe), as Amendment 3 says. The refusal's message names the cause. But its declared `when`, which `/docs` and the operations list show, doesn't.
   - In the same vein, set-schema's description (`set-schema.js:33`) says "a description that check would take". "That check" reads back to create-concept's name check, but it is create-concept's description check.
   - **Asked:** add both causes to the `when`, and name the description check.

#### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **A fix round can change code for a finding that asks for no test.**
   - Round 1's finding 9 was an optional, unmeasured speed-up, and it named no test for the path it touched. The Tester's cases covered findings 3, 4, 5 and 8, so the address check's rewrite went in with nothing to catch it.
   - Round 1 also missed that Decision 5's nonce search had no case.
   - **Fix shape:** in a fix round, every code change a fix makes gets a Tester case first, optional findings included, or the round's Evidence says the path is untested. A reviewer's optional change names the test that would guard its path.
2. **No harness check looks for raw control, format or combining characters.**
   - Two stories have now found them by hand: ledger row `2026-11-16-raw-bidi-control-in-resync-test`, and round 1's finding 5. This story's own scan didn't count combining marks.
   - **Fix shape:** a harness-lint check over each branch's added lines, by code point, asking for an escape in their place.

The optional independent check was not applied in this round.

### On PASS (round 2, same commit)

- [ ] Not applicable: this round requests changes. Round 1's commit set the story's Status line to Done. In this round's commit it should read Approved again, until a round passes. That edit is the committing session's, since this reviewer edits no other file. harness-lint's L1 looks only at a review whose last verdict passes, so it won't flag a Done story beside this one.

### Verdict (round 2)

**CHANGES_REQUESTED**

## Round 3 — 2026-11-17 (HEAD `8f493feb`)

**Diff:** `git diff faa91ee4..8f493feb`, where `faa91ee4` is round 2's review commit. Four commits:
- `4afded16`: the Tester's SS10, for Decision 5's address search, and the test plan's "Added at review round 2";
- `ed32ca77`: Amendment 3's account of the address check, corrected;
- `68e48fbc`: the Implementer's fix, with `unreadable-schema`'s declared text and set-schema's description;
- `8f493feb`: the Evidence, with a stamped live check on `68e48fbc` and a new L8.

6 files, +68 −7. Each commit touches only its own role's files: the Tester's `test/` and the test plan, the ADR's commit the ADR, the Implementer's `src/`, and the Evidence's the story. No file under `src/`, `firmware/`, `bin/`, `clients/` or `test/` changed between `68e48fbc` and `8f493feb`. `faa91ee4` holds round 2 as written. It also sets the story back to Approved, words the story's review link without verdicts, and files round 2's two harness-friction items as ledger rows `2026-11-17-fix-round-admits-untested-optional-change` and `2026-11-17-no-check-scans-raw-characters`.

**In short:** round 2's blocking finding and its non-blocking one are fixed. I found no path that can hand out an address whose holder wasn't read. Nothing blocks.

### Quality gates (round 3, run by reviewer)

- [x] **`npm test`, scoped,** as in rounds 1 and 2. `npm run -s gate:status -- --label a10-18-story-18-review-3` reads:
  `20261118T035018Z-99833-bf25 [a10-18-story-18-review-3] started 2026-11-18T03:50:18.125Z on 8f493feb+dirty — PASS, exit 0, 1016 passed, 0 failed, 6 skipped, 5/5 suites` (record `tmp/gate-runs/20261118T035018Z-99833-bf25.json`)
  - `+dirty` is the `node_modules` link alone (`dirtyCount` 1).
  - operations 915/0/4, external-cli 53/0/0, openapi-coverage 13/0/0, admin-action-sweep 9/0/0, schema-save-finds-the-right-header 26/0/2. set-schema is 10/0, with SS10. Every other suite's count is round 2's.
- [x] **The full gate was not run here,** for round 1's reason. The PR's CI runs it.
- [x] **SS10 fails without its fix, for the right reason.** I extracted `faa91ee4` into `tmp/review-18/at-faa91ee4/` (its `src/` is `27f1a985`'s), put HEAD's `test/` over it, and ran set-schema alone, every endpoint dead: 9/1. SS10's first premise holds there, since weight's held plain address gives `~1`. Its second fails: `price` got `price-78fe1761~1`, the address the seed's node holds. That is the test plan's account (`18-property-operations.test-plan.md:146`).
- [x] **`bash scripts/harness-lint.sh`:** clean, 0 violations, before this round was appended. **`node src/firmware/graph-rules.js --check`:** the 7 items current. **Code points:** no control, format or combining character, and no variation selector, in round 3's added lines or the whole branch's.
- [x] **Probes**, under `tmp/review-18/`, every endpoint dead, each on HEAD and on the `faa91ee4` copy:
  - `probe-nonce.js` and `probe-nonce-sequence.js`, round 2's. On HEAD, `price` and `pRice` take `~2`, and no address is held twice.
  - `probe-nonce-paths.js`, new, covers five paths SS10 doesn't reach. On HEAD every one holds:
    - **A:** two keys that slug alike under a new object, with the children's `~1` held: `price` takes `~2`.
    - **A2:** as A, with the new object's own plain address held. The object takes `~1`, its children's search keys off that address, and `price` again takes `~2`.
    - **B:** catching up makes the two siblings, with `~1` held: `price` takes `~2`.
    - **C:** one set-schema takes both alike keys out and adds two new ones. The new ones reuse the freed plain address and `~1`, and no address is held twice.
    - **D:** all 100 addresses held: 409 `no-free-address`, with the graph unchanged.
  - On the `faa91ee4` copy, A, A2 and B each leave an address held twice. So the probe sees the defect, and HEAD doesn't have it.
- [x] **The live check on the commit**, read against `tmp/live-check-18/main-round3.log`, `report-main-round3.json`, `up-round3.log` and `hand-calls.md`'s last section:
  - **The stamp holds.** It names `68e48fbc7e694241451d3611e53237abb10b1302`, with only `?? node_modules` beside it.
  - **The timeline holds**, in local time. `_properties.js` and `set-schema.js` were last changed at 22:41:50, `68e48fbc` was committed at 22:42:28, the stack booted at 22:44:11, and the report was written at 22:49:10.
  - **25 of 25 checks are `ok`,** on `live teapot wiai`. L7 took 0.707458 s and 0.337553 s.
  - **L8 is my three set-schema calls, on the real instance** (`live.js:275-285`). `Price` took the plain address and `price` took `~1`; then `PRICE` took the plain address and `pRice` took `~2`. Its query for an address held twice covers every node whose address starts with the plain one, so the `~n` forms too. It found none.
  - **The relay held 465 at all five counts,** with L8 between the reinstall's count and the last (`live.js:287`).

### Round 2's findings

| Round 2 | Disposition |
|---|---|
| Blocking 1: the address check could hand out a held address | **Fixed** at `_properties.js:789-798`. A plain address that two nodes of one level share now counts as crowded (`:794-797`), so every candidate a crowded node may take is read. A node that isn't crowded takes its plain address, which was read. No nonce equals a plain d-tag, since a slug holds no `~`, and a shared plain address makes both nodes crowded. Across levels, `taken` keeps this write's earlier addresses, and every read comes before the write's first node. SS10 pins the search (`set-schema.test.js:299-326`), and my probes cover catching up, nested levels, freed addresses and exhaustion. The comment (`:789-791`) and Amendment 3 (`0018-property-operations.md:500`) now say what the code does. |
| Non-blocking 1: `unreadable-schema`'s declared text | **Fixed.** `_properties.js:81` now names a refused description and properties under a non-object. `set-schema.js:33` names create-concept's description check. |
| Harness friction 1 and 2 | Filed by `faa91ee4`, as ledger rows `2026-11-17-fix-round-admits-untested-optional-change` and `2026-11-17-no-check-scans-raw-characters`. |

**A correction to round 2's record.** Round 2's blocking 1 said Neo4j would keep the doubled address silently. That holds only on a graph without the setup task's constraints, such as a scratch stack (ledger row `2026-11-13-scratch-stack-indexes-and-volume`).
- A tag's uuid hashes its node's address, the tag and its index (`_eventless.js:31-39`). So a second node at an address, made by these writes, gets a `d` tag with the same uuid as the first node's.
- `nostrEventTag_uuid` (`setup/neo4jConstraintsAndIndexes.sh:48`) would most likely refuse that tag, failing the write. Production's graphs have that constraint, so there the defect would have shown as a failed write, not a doubled node.
- I found this by reading. It changes nothing now that the check is fixed.

### Findings (round 3)

#### Blocking

None.

#### Non-blocking

1. **Optional: no suite pins `no-free-address`.** All four writes declare it, and probe D shows it refuses with the graph unchanged. Optional: a case over SS10's seed, which already places holders at chosen addresses.

#### Harness friction *(each becomes an OPEN.md row, type `meta`)*

None new. Round 2's two items are filed. The correction above traces to a scratch stack lacking production's constraints, which ledger row `2026-11-13-scratch-stack-indexes-and-volume` already records.

The optional independent check was not applied in this round.

### On PASS (round 3, same commit)

- [x] The committing session sets the story's Status line to Done, in this round's commit, since this reviewer edits no other file. Until then harness-lint's L1 reports the story, as it did after round 1.
- [x] Completion detection is performed. The result and any book arithmetic go in the chat, never in this file. `/close-book` is offered if the book looks complete.

### Verdict (round 3)

**PASS**
