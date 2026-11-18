# Review: Story 22 — `graph add-to-concept` and `remove-from-concept`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-17
**Diff:** `git diff origin/staging...HEAD`, at `841b7549`: 26 files, +4088 −21. The merge base is `6def43be`, since PR #135 took the story, ADR 0022 and that merge of staging to staging (`860497a6`). So the range holds the branch's two later commits:
- `85326415`: the test plan, the failing tests and ADR Amendment 1, approved at the Test Design gate;
- `841b7549`: the implementation, the story's Deviations and Evidence, and ledger row `2026-11-18-rule-eight-awaits-firmware-reinstall`.

The story (`e7beedba`) and the ADR (`7a2c0af5`) were read as the spec. What `6def43be` brought from staging (A10.20.b, #132) isn't under review.

**Against:**
- the story, [22-add-to-concept-and-remove-from-concept.md](../../stories/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.md);
- [ADR 0022](../../decisions/graph-operations-first-slice/0022-add-to-concept-and-remove-from-concept.md), with Amendment 1, items 1–12;
- the [test plan](../../stories/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.test-plan.md).

**How it was made.** A reviewer agent with no Edit access wrote this review at the session's request. This file is its only write to a tracked file; its gate record is under the ignored `tmp/gate-runs/`.
- It ran every suite and the gate itself, with every endpoint dead.
- Its probes, the red-before-green run and the breaks ran on scratch copies under the session's scratchpad (`git archive` of a commit, with the main checkout's `node_modules` linked in), never in the worktree. The probes ran the real catalog through the suites' harness over `test/helpers/membershipGraph.js`'s seed.
- It made no call to the local stack, any container, GitHub or Loom.
- The independent check before the commit (workflow 5, P13) wasn't applied.

## Quality gates (run by reviewer, not trusted)

- [ ] **The full gate** (`npm test`): not run. On this Mac the local stack is the owner's agent-memory instance, and the full suite writes to it (ledger row `2026-11-14-harness-points-tests-at-agent-memory`). It runs as the pull request's CI check.
- [x] **A scoped gate,** at `841b7549`: the eight suites the session named, `operations.test.js` (every suite under `test/operations/`), `external-cli`, `openapi-coverage`, `admin-action-sweep`, `schema-save-finds-the-right-header`, `graph-rules-builder`, `graph-rule-firmware` and `firmware-element-sync`. It ran with `BRAINSTORM_BASE_URL=http://127.0.0.1:9`, `TAPESTRY_PORT=9`, `TAPESTRY_CONTAINER=no-such-container`, `NEO4J_URI=bolt://127.0.0.1:9` and `REDIS_PORT=9`. Its `npm run gate:status -- --label a10-22-review-r1` line, with the worktree's path shortened:

  ```
  20261118T030156Z-94282-64ba [a10-22-review-r1] started 2026-11-18T03:01:56.945Z on 841b7549+dirty — PASS, exit 0, 1122 passed, 0 failed, 10 skipped, 8/8 suites · <worktree>/tmp/gate-runs/20261118T030156Z-94282-64ba.json
  ```

  - `+dirty` is the `node_modules` link alone (`dirtyCount: 1`). The route walks need `<worktree>/node_modules/express` (ledger rows `2026-11-16-route-walk-needs-node-modules` and `2026-11-16-worktree-node-modules-link-untracked`). The link was made for the run and removed after it, and `git status` was clean.
  - By suite: operations 961 passed, 4 skipped; external-cli 53; openapi-coverage 13; admin-action-sweep 9; schema-save-finds-the-right-header 26, 2 skipped; graph-rules-builder 26; graph-rule-firmware 13, 4 skipped; firmware-element-sync 21. The ten skipped are live tests: LK1–LK4, L1–L2 and GL1–GL4.
  - Suite by suite, that is the Implementer's record `20261118T023152Z-53544-4655`, which ran on the uncommitted implementation over `85326415`, as the story's Evidence says.
  - The operations run holds the four new suites and the neighbours the test plan lists, among them update-node 42, create-element 34, delete-node 40, unlink-set 21, link-set 21, list-elements 30 and history 8.
- [x] **The new suites, each alone,** with the same variables: add-to-concept 39 passed, remove-from-concept 33, memberships-shared 18, memberships-agent-through-cli 1. The rulebook and firmware suites, run as files: graph-rules-builder 26; graph-rule-firmware 13, 4 skipped (GL1–GL4, live); firmware-element-sync 21.
- [x] **Two more route-surface suites,** in the scratch copy of HEAD: admin-action-sweep-access 13 passed, admin-action-sweep-named 6.
- [x] **Red before green.** `85326415`'s tree, extracted: add-to-concept 0 passed, 39 failed; remove-from-concept 0/33; memberships-shared 0/18; the agent 0/1; graph-rules-builder 21/5; graph-rule-firmware 12/1, 4 skipped; firmware-element-sync 20/1. That is the plan's Verification exactly.
  - `git diff 85326415 HEAD -- test/` is empty, so the implementation changed no test.
  - `git diff 6def43be 85326415 -- src firmware docs` is empty, so the test phase changed no code.
- [x] **Breaking the real code,** one break at a time in a scratch copy of HEAD, each against the suites that should catch it. Each was caught:

  | Broken | Failed |
  |---|---|
  | remove-from-concept's re-check after its delete (`remove-from-concept.js:207`) | RM18 |
  | add-to-concept's lock on the node (`add-to-concept.js:105`) | AT20 |
  | remove-from-concept's lock on the node (`remove-from-concept.js:97`) | RM17 |
  | `keptIn` counting firmware's own elements as `json-tag` (`_memberships.js:142`) | AT12, MS8 |
  | the firmware-membership check (`remove-from-concept.js:124`) | RM36, RM41 |
  | the author-claim check (`:127`) | RM37, RM41 |
  | the other-concept check (`:129`) | RM38, RM41 |
  | the name-in-use check (`add-to-concept.js:149`) | AT39, AT47, AT43 |
  | the would-be tags not written (`add-to-concept.js:208`) | AT2, AT4, AT5, AT6, AT48 |
  | remove-from-concept's tag deletes (`remove-from-concept.js:191`) | RM1, RM5, RM6, RM7, RM18 |
  | `letters` not looking for relationship events (`_memberships.js:473`) | RM5 |
  | elementsOf's overlay (`_fields.js:286`) | MS2, AT17 |
  | deriveWord's overlay (`word.js:90`) | MS3, MS4, MS5 |
  | `NODE_FIELDS` without `tapestryOwnSections` (`tapestry-derive.js:91`) | MS5 |
  | the rule counting word's concept (`node-has-a-concept.js:47`) | MS12 |
  | the guard form judging the node as it stands, not without M1's links (`node-has-a-concept.js:67`) | RM39, MS11 |

  Every file was restored after its break, and the copy compared equal to HEAD afterwards.
- [x] **`node src/firmware/graph-rules.js --check`:** "the 8 items in firmware/active/concepts/graph-rule/elements are current".
- [x] **`bash scripts/harness-lint.sh`:** clean (0 violations), before this file was written.
- [x] **The merge with staging as it is now** (`860497a6`): `git merge-tree` is clean. Since the merge base, staging has gained only docs: story 42's evidence, and ledger row `2026-11-17-rule-seven-rewrite-awaits-firmware-reinstall`, closed.
- [ ] `npm run test:playwright`: not applicable; no UI change.
- [ ] _Lint, typecheck and build not configured: skipped._

## Spec adherence

| Criterion | Tests | Live (the story's Evidence) | Result |
|---|---|---|---|
| AC1: add a node to a concept | AT1–AT3, AT16, AT18 | L1b, L9 | Met |
| AC2: into a set | AT4–AT6 | L1d, S7 | Met, except `wordTypes` in one case (non-blocking 2) |
| AC3: the new section is checked | AT4, AT40, AT41, AT43, AT48 | L1h | Met |
| AC4: safe to repeat | AT7, AT8, AT20 | L1c, L6a | Met as written. Its "graph update-node changes those" fails for a section the node lacks (non-blocking 1). A repeat over JSON that can't be read is refused (non-blocking 5) |
| AC5: anyone's node, the owner's claims only | AT9–AT14, AT47, RM9–RM11, RM36, RM37, MS2, MS3, MS8 | L1g, L1i, L2, S6 | Met |
| AC6: take a node out | RM1–RM8, RM14 | L1e, L1f, L1l, S5 | Met, except its undo clause after a removal that leaves a second concept (non-blocking 1) |
| AC7: never the last concept (D9) | RM12, RM17, RM18, RM39, MS10–MS13, GB2–GB6, GF9, IS8 | L1j, L6b, L10 | Met |
| AC8: what they refuse | AT30–AT47, RM30–RM44 | L1h–L1j, L8 | Met |
| AC9: it lasts, and it reaches agents | AT17–AT19, AT30, RM13, RM15, RM16, RM30, MS4, MS5, XM1 | L1, L3–L5, L7, L8 | Met |

- [x] **Every acceptance criterion has a passing test.** Each of Decision 17's refusals has its own, by the plan's table: AT31–AT47 and RM31–RM44.
- [x] **No criterion is silently dropped.** The two sub-cases above are non-blocking 1 and 2.
- [x] **No behaviour beyond the story.** `tag-node`, `name-in-use` and `tapestryOwnSections` came at Architecture, with the owner's approval (the story's "Added at Architecture").

**The Deviations,** each checked against the code. All fourteen hold:
1. `descriptorsOf` is exported: `_sets.js:588`, one line.
2. `ownSectionsOf`: `_fields.js:139`. elementsOf (`:283`), `word.js:89` and `jsonOf` share it.
3. Sections beside that don't parse: elementsOf reads such a node as a problem (`_fields.js:285`), so mapConcept skips it and leaves its copies. deriveWord leaves the sections out (`word.js:89–90`).
4. `section-added`'s `was`: `add-to-concept.js:224`.
5. One `unknown-node` and one `made-elsewhere` declaration per operation: `_memberships.js:46` and `:49–50`.
6. `made-elsewhere` for a superset names update-concept, and link-set and unlink-set: `_memberships.js:74`.
7. `name-in-use` isn't checked for a node already in the concept: `add-to-concept.js:146`.
8. `reserved-key` and `no-superset` worded for these operations: `_memberships.js:78–83`, chosen at `:175` and `:177`.
9. A `z` naming any concept left, word's included: `remove-from-concept.js:187` reads `left`, not `judged`.
10. `set` echoes the input: `add-to-concept.js:97` and `remove-from-concept.js:90`.
11. The relationship events found from their `nodeTo` tag: `_memberships.js:447–458` (non-blocking 4).
12. Entry 7's "will call": `docs/GRAPH_RULES.md:132` (non-blocking 7).
13. The ledger row for rule 8's reinstall. Its pointer to rule 7's row, `2026-11-16-rule-seven-awaits-firmware-reinstall`, holds.
14. The `node_modules` link: this review's gate needed the same.

**The Evidence,** checked against `tmp/live-check-22/`, which git ignores. Its `keys.json` of throwaway keys wasn't read.
- `main.log` passes 26 of 26; the reinstall run passes its 4 (L3.1a–L3.2b), the re-import its 1 (L5) and the restore its 1 (L4). That is the 32 the story counts.
- L6b's record names the re-check (Decision 15) as what answered `last-concept`, in each of its three rounds.
- L9: the relay held 478 events before the membership calls and 478 after.
- L10's log: graph-rule-firmware 16 passed, 0 failed, 1 skipped (GL4).

## ADR adherence

- [x] **The files match the Implementation notes,** with Amendment 1 item 12's change: `element-fits-schema.js` isn't in the diff.
  - New: `_memberships.js`, `add-to-concept.js`, `remove-from-concept.js`, `rules/node-has-a-concept.js` and rule 8's element file.
  - Changed: `_fields.js` (`overlaySections`, `ownSectionsOf`, elementsOf's overlay, `conceptsOfNodes`' `without`), `word.js`, `tapestry-derive.js`'s `NODE_FIELDS`, `relationship-type-allowed.js`, three strings of `update-node.js`, `changes.js`'s header, `_sets.js`'s export, `docs/GRAPH_RULES.md` §8 and the catalog's two rows.
  - `_memberships.js` holds more than the notes list: `theNode`, `theConcept`, `anchorOf`, `sectionFields`, `tagsOf`, `firmwareMembership`, `authorClaim` and `ownLetters`. Its header lists each, and each carries out a Decision. No change asked.
- [x] **Decisions 1–4.**
  - The declarations' inputs, guards and `repeatKey`: `add-to-concept.js:47–91` and `remove-from-concept.js:54–84`.
  - `not-installed` comes before the locks (`add-to-concept.js:101`, `remove-from-concept.js:93`). The locks are the node, then the concept's header; AT20 and RM17 read their keys from the fake's log.
  - `keptIn` (`_memberships.js:141–143`) needs no case for person nodes and placeholders: `factsOf` never counts them as `own` (`_nodes.js:87`), so they are kept beside.
- [x] **Decision 5.** `jsonOf` (`_memberships.js:264–291`). `overlaySections` (`_fields.js:122`) gives a copy, built from a Map with `Object.fromEntries`: a section beside replaces the author's whole, and the keys `wordTypes` lacks are added at its end, sorted (MS1).
- [x] **Decision 6.** elementsOf (`_fields.js:283–286`), deriveWord (`word.js:85–90`) and `NODE_FIELDS` (`tapestry-derive.js:91`) lay the sections over. Only the two operations write `tapestryOwnSections`, and a removal takes the property off with its last section (`remove-from-concept.js:178`).
- [x] **Decisions 7–9,** in Decision 8's order, except the repeat's read of the JSON (non-blocking 5).
  - A section the view holds is merged into with `X.mergeSection`; else it is built as create-element builds one (`add-to-concept.js:156`).
  - `fields` is parsed against the node's name; a node with no name takes its section's name from `fields` (`_memberships.js:217–237`).
  - `name-in-use` runs for every node whose author is one of the instance's own keys (Amendment 1 item 5).
  - The length check is on the text stored: for a node kept beside, `tapestryOwnSections`' (`:179`). Rule 4 judges the view (`:183`).
  - The writes: `:186–210`.
- [x] **Decisions 10 and 11.**
  - M1 (`_memberships.js:310–326`) and M2 (`:329–337`, with `count(*)`, Amendment 1 item 3).
  - The concepts left come through `conceptsOfNodes`' `without` (`_fields.js:432`), so "the concepts reaching a node" has one definition.
  - The three checks, in order: `remove-from-concept.js:123–135`.
  - `firmwareMemberships` (`_memberships.js:351–408`), parts (a) and (b). All 76 `HAS_ELEMENT` edges in the shipped concept manifests run from a set file to an element file of the same concept, the one shape part (b) resolves. Install's pass 1c¾ also falls back to a lookup by slug or name (`src/firmware/install.js:602`), which no shipped edge needs.
- [x] **Decision 12.** The rule has both forms. It gives no finding for a tag, a change entry, an unknown node, concept or set, a reserved key or an empty M1. It refuses, and requires what it reads with only when `violations()` runs (MS10). Non-blocking 3 is about its guard form.
- [x] **Decisions 13–15.** The answers and the change entries are as listed. The removal's writes go in order:
  - the links, pair by pair, by unlink-set's statement (Amendment 1 item 1: `remove-from-concept.js:32–36`, `:143–146`);
  - the sections, and their keys in `wordTypes`;
  - the tags, one at a time, by C11's statement (item 2: `:38`, `:191`);
  - the copies;
  - the re-check (`:205–209`).
- [x] **Decisions 16 and 17.** relationship-type-allowed's words (`:42`); update-node's three strings (`update-node.js:177`, `:194`, `:221`); the catalog's rows; §8; rule 8's element. Every code in Decision 17's table is declared and listed with its status (AT19, RM16).
- [x] **Amendment 1, items 4–11.**
  - Item 4: word is listed among the concepts left, never a reason to refuse, and its block and key stay (RM8).
  - Items 5, 6 and 8: AT47; `_memberships.js:72–77`; `:232`.
  - Item 7: a node already in the concept, put in a set, gets the link, its would-be tags and the marks, and no section (`add-to-concept.js:156`, `:161`, `:174`, `:203–209`). See non-blocking 2.
  - Items 9–11: MS15; the guard's silence on a set outside the thread (`_memberships.js:201–206`, RM34); §2 unchanged.
- [x] **No new dependencies.** `package.json`, `clients/` and `bin/` are untouched, and the new modules require only the repository's own.

## Concept-graph integrity

- [x] **Handles are in `kind:pubkey:slug` form,** built at run time from `getOwnerAssistantPubkey()` and `K.assistant()`. The added lines under `src/` and `firmware/` hold no 64-hex literal, and no `LEGACY_*` constant is touched.
- [x] **Firmware reinstall:** needed for rule 8's element only, as ADR follow-up 9 says. Ledger row `2026-11-18-rule-eight-awaits-firmware-reinstall` carries it, each reinstall on the owner's yes. No concept's definition changes.
- [x] **Orientation:** the story's counts come from `/api/concept-graph/summaries`, and the ADR's from `/neighbors`.

## Things tests can't catch

- [x] **No secrets** in committed files; the live check's keys are in the ignored `tmp/`.
- [x] **No leftover debug logging, `console.log`, TODO or commented-out code** in the added lines, and no control or format character.
- [x] **Error paths.** A json tag or tag with no tapestryKey, and a write count that doesn't match, are plain errors that roll back (500). An entry that can't be recorded keeps nothing (AT45, RM43). A node deleted meanwhile answers `unknown-node` (AT46, RM44).
- [x] **Concurrency.**
  - Two calls on one node go one at a time on the node's lock; the guard ran before the lock, and the re-check after the delete closes the gap (RM18; live L6b).
  - An add and a create-element, or a rename, in one concept wait on its header.
  - Deadlocks: every element write locks its node first, then headers. Beyond those, these two touch only the node's own tags and the sets and supersets their links run from, through the links themselves. Any deadlock is retried by `session.executeWrite` (`src/operations/graph.js:8–9`), and `apply` does nothing outside its transaction.
  - The known gaps stand: an add into a set while link-set or unlink-set moves that set, and ledger row `2026-11-16-shared-set-creates-can-race`.
- [x] **Security.** Every input is a parameter, checked by the tapestryKey pattern or `X.FIELDS_INPUT`. The only names written into Cypher are firmware's relationship aliases. Both routes are owner-and-admins (AT30, RM30; live L8). Nothing signs, publishes or reads a key (the spy; MS18; live L9). The sections and the merge are built with `Object.fromEntries` and own-key reads, so a `__proto__` key stays an own key (MS1).
- [ ] **Cost:** one read scans the graph's tag nodes inside the write (non-blocking 4).

## Architecture invariants

- **POV-first.** Nothing per point of view is stored. A membership counts by the read conventions (ADR 0011); see non-blocking 8.
- **Permissionless publishing.** Nothing gates a publication. An author's claim is refused as theirs to remove, never as theirs to make.
- **Filter at read time.** `letters`, `left`, `concepts` and the verdicts are derived on each call.
- **Local-first** (BIBLE §30). The owner's sections and memberships have no event behind them. They last a reinstall, a restore on a fresh instance and a fresh import of the author's letter (live L3–L5). A removed section is kept whole in its change entry.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.
- [x] The TA pubkey is never hardcoded.

## Product-guide adherence

Not applicable: the book has no PRD.

## Docs

- **The rulebook,** `docs/GRAPH_RULES.md` §8, is in the entry format (MS13, GB2–GB6) and matches the rule's code, but for one phrase (non-blocking 7).
- **The catalog's two rows** list what each operation refuses, as the declarations do.
- **`changes.js`'s header** names the fields the membership changes use.
- **The ledger row** is well formed (lint L15 is clean).

## Findings

### Blocking

None.

### Non-blocking

1. **`src/operations/catalog/graph/add-to-concept.js:133–142` with `src/operations/catalog/graph/update-node.js:221`: a node already in a concept whose JSON lacks that concept's section can't be given it.**
   - **The cause.**
     - The repeat writes nothing for a node already in the concept, whether or not it holds the section (AC4, Decision 7).
     - update-node refuses `no-section`. This diff changed its words (Decision 16) to "graph add-to-concept gives a node another concept's section".
     - add-to-concept's description says of `differs`, "`graph update-node` changes those" (`:45`).
   - **How such a node comes about.** Through AC2: AT4's Fetch, put in dog through walkers, joins pet with no pet section (pet `fits: false`, "`pet` is required"). Also through create-element into a shared set, and link-set.
   - **Probe 1, on AT4's state:**
     - update-node of Fetch's pet section: 409 `no-section`, naming add-to-concept;
     - add-to-concept of Fetch to pet, with fields: 200 `already-element`, nothing written, `differs` naming `fields.description` with `holds: null`;
     - remove-from-concept of Fetch from pet: 409 `other-concept`, since dog would leave too.
   - **AC6's undo clause.** AC6 (story line 54) and the owner's answer to open question 2 rest on undoing a removal with add-to-concept and the entry's sections. Probe 3 took RM6's case: Goldie out of golden retriever, which leaves dog too, both sections kept in the entry.
     - Added back to golden retriever with its fields: `added`. That puts it in dog again, with no dog section.
     - Then added to dog with dog's fields: `already-element`. Dog's section never comes back.
     - The other order, dog first, is refused `invalid-fields`: dog's schema wants goldenRetriever in `wordTypes` for that breed before golden retriever is joined.
     - So no sequence of add-to-concept calls restores this removal. An add to dog without the breed, then golden retriever, then update-node's breed does. Nothing is lost: the entry holds the sections.
   - **Why it doesn't block.** The code is AC4's and Decision 7's as written, and no invariant breaks. The story is of two minds: its Out of scope says "add-to-concept gives a node a section it lacks" (line 84), and AC4 says a repeat changes nothing.
   - **Asked, for the Architect:** an amendment to Decision 7.
     - One way: for a node already in the concept whose JSON lacks its section, add-to-concept writes the section (`added`, a `section-added` entry, no new link). Another: update-node gives a missing section for a concept the node is in.
     - Then tests of AT4's Fetch and of RM6's undo.
     - At least, reword `update-node.js:221` and `add-to-concept.js:45` so neither points at the other for a missing section.

   This is the finding to settle before the pull request: the rebuild meets it whenever an element goes into a set that another concept also reaches.
2. **`add-to-concept.js:161`: a node already in the concept, put in a set another concept also reaches, joins that concept, but its `wordTypes` doesn't gain its key.**
   - **The spec.** AC2 (story line 50) says the node "becomes an element of every concept whose class thread reaches the set, each listed in `wordTypes` and in the answer". Amendment 1 item 7 (ADR line 374) says "Step 2 doesn't run, so the section isn't touched", and step 2 holds the `wordTypes` change too.
   - **Probe 1.** Mark Me, in beagle, is added to dog, then to dog with set walkers: `added`. The answer lists pet (`fits: false`), but its JSON's `wordTypes` is `["word", "beagle", "dog"]`. The entry records the link and an `n` tag only.
   - **No test sees it.** AT5's show beagles joins no other concept.
   - **Why it matters a little.** deriveWord keeps the stored list rather than computing it from the edges. `src/api/io.js:516–531`'s import wires a `HAS_ELEMENT` from the superset of each concept a word's `wordTypes` names.
   - **Asked, for the Architect:** say whether item 7 meant to skip `wordTypes` as well. If not, a node kept in its json tag gains the keys the anchor joins, recorded as `field-changed`, with a test over a set two concepts share. If so, record that AC2's clause doesn't cover this case.
3. **`src/operations/rules/node-has-a-concept.js:52–74` (the guard form): for a node another operation looks after, whose only concept but word is the one named, the guard answers `last-concept` before `apply` can answer `made-elsewhere`, and its way on doesn't apply.**
   - **Probe 2.** Firmware's set-concept header, taken out of the concept-header concept, is refused 409 `last-concept`: "Add it to another concept first (graph add-to-concept), or delete it (graph delete-node)". Walkers, taken out of the set concept, gets the same. Both of those operations refuse such a node as `made-elsewhere`.
   - **No test sees it.** RM32's cases name concepts that don't reach their nodes, so the guard is silent there and `apply` answers.
   - The Consequences accept guards answering first for firmware's and authors' last concepts (ADR line 292). There, the advice leads somewhere. Here it leads nowhere. Nothing changes either way.
   - **Asked:** the guard form gives no finding for a node `X.changedElsewhere` names, as it gives none for a tag (an amendment to Decision 12), with a case in RM32.
4. **`src/operations/catalog/graph/_memberships.js:447–458` (`relationshipEvents`): it finds the instance's own relationship events by a tag's type and value, which no index covers.**
   - **The indexes.** The only constraint on `NostrEventTag` is its uuid (`setup/neo4jConstraintsAndIndexes.sh:48`), so Neo4j scans every tag node for this read.
   - **When it runs.** Inside the write, after the re-check, while the node's and the header's locks are held, once for each link a removal took out (`:474–480`). So every removal pays it.
   - **The scale.** Staging holds about 3.85 million nodes. How many are tags isn't recorded.
   - Deviation 11 records the scan.
   - **Asked:** measure it before production, with a read-only PROFILE on staging (which needs the owner's yes), or open a ledger row naming it, so a later change finds it.
5. **`add-to-concept.js:135–136`: the repeat reads the node's JSON before it answers, so a node already in the concept whose JSON can't be read is refused `unreadable-json`, not answered `already-element`.**
   - Decision 8 puts the repeat (step 5) before `unreadable-json` (step 7).
   - **The probe.** Twofer, in beagle with two json tags that differ, added to beagle: 409 `unreadable-json`.
   - It is in neither the Deviations nor a test. Nothing changes either way, and the refusal tells the caller more.
   - **Optional:** log it, or answer `already-element` with `differs` left empty when the JSON can't be read.
6. **`_memberships.js:269–276` with `remove-from-concept.js:138`: a removal reads the author's letter of a node kept beside, and refuses `unreadable-json` when it can't be read, though it writes only `tapestryOwnSections`.**
   - So the owner can't take their own claim out of a node whose author's JSON doesn't parse.
   - RM35's `uj-peer` pins this, as the test plan chose.
   - An add refuses such a node (AT38), so this arises only once a later import brings JSON that doesn't parse.
   - **Optional, for the Architect:** a removal from a node kept beside reads `tapestryOwnSections` alone.
7. **Docs and published words.**
   - **`docs/GRAPH_RULES.md:132`: entry 7's Enforced by still says `graph add-to-concept` "will call" the check "when they are built"** (Deviation 12). It is built.
     - Rewording regenerates rule 7's element, and rule 8's pending reinstall would carry both.
     - Asked: reword entry 7, regenerate, and name rule 7's element in ledger row `2026-11-18-rule-eight-awaits-firmware-reinstall`.
   - **`docs/GRAPH_RULES.md:138`, and the generated element's `says`: "word's class thread reaches nearly every element, through its word block".**
     - A class thread reaches through edges: word's superset sits above 17 other concepts' supersets (ADR line 54).
     - What the word block does is make every element a word (`_memberships.js:79`).
     - Suggest: "word's class thread reaches nearly every element, through the other concepts' supersets under its own".
   - **The `when` of `X.NO_SUPERSET` and `X.NOT_INSTALLED`** are create-element's: "no class thread to put the element in" and "the would-be author of every node a write makes" (`_elements.js:68–69`).
     - remove-from-concept lists both, so its listing, `/docs` and help say so of a removal.
     - Deviation 8 rewords only the messages.
     - Optional: declarations of `M`'s own, as Deviation 5 made for `unknown-node` and `made-elsewhere`.
8. **ADR 0022's follow-ups (Consequences 1–7) are on no surface `/whats-open` reads.**
   - No ledger row names them, and follow-up 4's memo on A10.20.c couldn't be checked from here.
   - Follow-up 1 states half of the read gap.
     - Nothing records who made a membership, so from a point of view that counts a node's author, the owner's membership counts as that author's.
     - AT9's list-elements, from everyone's point of view, shows Snowy in pet that way, as AC1 asks under today's conventions.
     - It is the other half of the same missing provenance.
   - Asked: ledger rows for follow-ups 1–3 and 5 at least, with that second half in follow-up 1's.

### Harness friction

1. **Known, seen again:** the role file and the template ask for a local `npm test`, which this Mac can't run (ledger row `2026-11-14-harness-points-tests-at-agent-memory`). The scoped gate gave this review its `gate:status` line. No new row.
2. **Known, seen again:** the test plan's live check says to check "the shared notes" before taking `tapestry-scratch` (test plan line 155), and they don't exist (ledger row `2026-11-17-live-check-shared-notes-missing`). No new row.
3. **Known, seen again:** the gate's route walks need the worktree's `node_modules` link. No new row.

## Verdict

**PASS**

**What holds.** Both operations do what ADR 0022 and its Amendment 1 decided:
- add-to-concept takes any node, holds the new section to its concept's schema, and keeps the owner's section beside another author's letter or firmware's file, never in it;
- remove-from-concept takes out every way the concept or the set reaches the node. It refuses a call that would also take the node out of a concept the call didn't name, take out the author's or firmware's claim, or leave the node in no concept but word, with D9's rule defined once, as guard and check;
- both lock the node, then the concept's header, record their changes, sign nothing and last a reinstall, a restore and a fresh import.

**The evidence.**
- Every criterion has passing tests, and they failed first exactly as the plan records.
- Sixteen breaks of the real code were each caught.
- The scoped gate passes on `841b7549`.
- The live record bears out the Evidence.
- The branch merges cleanly with staging.

**The non-blocking findings:**
- one design gap that ADR 0021 (update-node) and ADR 0022 leave between them, which AT4's own state reaches and on which AC6's undo clause rests (1);
- an AC2 sub-case that Amendment 1 item 7 reads the other way (2);
- a guard refusal whose way on doesn't apply (3);
- a tag scan inside the write (4);
- two choices about reading JSON that can't be read (5, 6);
- wording (7);
- surfaces for the follow-ups (8).

None blocks the merge. Finding 1 is the one to settle before the pull request, at least by rewording the two sentences it names.

**Still to come:** the full gate, as the pull request's CI check; and rule 8's firmware reinstall on staging and production, each on the owner's yes.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place, in the session's review commit, since this reviewer writes only this file and doesn't commit.
- [x] Completion detection: the book isn't complete (the rebuild and the race are still ahead, and story 18 is in flight), so no `/close-book` is offered; reported in the chat.

---

## Round 2 — 2026-11-18 (HEAD `f7a72259`)

**Diff checked:** `git diff 1aff849e..HEAD`: two commits, 21 files, +605 −92.
- `b06f8aa3` (test): ADR 0022 Amendment 2; the test plan's "Added at review round 1"; AT49–AT53, RM45, RM46 and MS19–MS22, with RM32 and RM35 changed; and two changes to the seed, `test/helpers/membershipGraph.js`.
- `f7a72259` (impl): the fixes, in `add-to-concept.js`, `_memberships.js`, `remove-from-concept.js`, `node-has-a-concept.js` and `update-node.js`; rulebook entries 7 and 8, with both elements regenerated; the catalog's add-to-concept row; four ledger rows and a paragraph on the rule-8 row; the story's round-1 deviations and Evidence.

Each phase kept to its files: `git diff 841b7549 b06f8aa3 -- src firmware docs` and `git diff b06f8aa3 f7a72259 -- test` are both empty.

**How it was made.** As in round 1: a reviewer agent with no Edit access. This section is its only write to a tracked file, and its gate record is under the ignored `tmp/gate-runs/`. It checked each fix as a fresh claim, not by the reports (the role file's step 10):
- round 1's three probes, re-run against HEAD, and two new ones for what the fixes touch (`probes/probe4.js` and `probe5.js` in the session's scratchpad);
- five of round 1's breaks that bear on the changed code, and twelve new ones (`probes/mutate2.js`), in a scratch copy of HEAD;
- the round's tests on `b06f8aa3`, which holds round 1's code;
- a merge with staging as it is now, resolved in a scratch copy, with this story's suites and the whole operations runner over it.

It made no call to the local stack, any container, GitHub or Loom. The independent check before the commit (workflow 5, P13) wasn't applied.

### Gates (run by the reviewer at `f7a72259`)

- [ ] **The full gate** (`npm test`): not run, for round 1's reason. It runs as the pull request's CI check.
- [x] **The scoped gate:** round 1's eight suites, with the same variables, and the `node_modules` link made for the run and removed after. Its `npm run gate:status -- --label a10-22-review-r2` line, the worktree's path shortened:

  ```
  20261118T050632Z-23726-cf5b [a10-22-review-r2] started 2026-11-18T05:06:32.437Z on f7a72259+dirty — PASS, exit 0, 1133 passed, 0 failed, 10 skipped, 8/8 suites · <worktree>/tmp/gate-runs/20261118T050632Z-23726-cf5b.json
  ```

  - `+dirty` is the link alone (`dirtyCount: 1`).
  - Only operations moved, from 961 to 972 passed, 4 skipped. 1133 is round 1's 1122 and the round's eleven new tests; RM32 and RM35 changed in place.
  - Suite by suite, that is the Implementer's record `20261118T045139Z-91032-59b1`, which ran on the fixes uncommitted over `b06f8aa3`, as the story's Evidence says.
- [x] **The new suites, each alone:** add-to-concept 44 passed, remove-from-concept 35, memberships-shared 22, memberships-agent-through-cli 1. The rulebook and firmware suites: graph-rules-builder 26; graph-rule-firmware 13, 4 skipped (live); firmware-element-sync 21.
- [x] **Red before green.** `b06f8aa3`'s tree, extracted: add-to-concept 40 passed, 4 failed (AT49–AT52); remove-from-concept 32/3 (RM32, RM45, RM46); memberships-shared 18/4 (MS19–MS22); the agent 1/0; the rulebook and firmware suites as before. That is the test plan's record exactly. AT53 and RM35 pass on round 1's code, as the plan says: they hold what it already did.
- [x] **Breaking the real code,** one break at a time in a scratch copy of HEAD:

  | Broken | Failed |
  |---|---|
  | the repeat without the held section (`add-to-concept.js:141`) | AT49, AT50, AT51 |
  | a missing section given with a new link (`:163`) | AT49, AT50 |
  | `wordTypes` left alone for a node already in the concept (`:173`) | AT52 |
  | `differs` left empty for a node already in the concept, put in a set (`:247`) | AT5 |
  | would-be tags written for a section given alone (`:217`) | nothing (R2-4) |
  | rule 4 skipped for a section given to a node already in the concept (`:194`) | nothing (R2-4) |
  | the guard's silence for a node another operation looks after (`node-has-a-concept.js:67`) | RM32 |
  | `theNode`'s `made-elsewhere` (`_memberships.js:170`) | AT33, RM32 |
  | a removal reading a beside node's letter again (`remove-from-concept.js:139`) | RM46 |
  | `relationshipEvents` finding nothing (`_memberships.js:483`) | RM5, RM45 |
  | add-to-concept's `not-installed` back to create-element's (`add-to-concept.js:87`) | MS21 |
  | round 1's: the re-check, the node's lock, name-in-use, the would-be tags, the guard's `without` | as in round 1 |
  | not a break but R2-1's candidate fix: rule 4 run whenever the JSON the call keeps changes (`:194`) | nothing, across the four suites |

  Every file was restored after its break.
- [x] **`node src/firmware/graph-rules.js --check`:** the 8 items are current.
- [x] **`bash scripts/harness-lint.sh`:** clean (0 violations), before this section was written.
- [ ] **The merge with staging as it is now** (`02e21816`): it conflicts, in three files (R2-6). Resolved in a scratch copy as R2-6 says, this story's suites pass over it (44, 35, 22 and 1; graph-rules-builder 26, graph-rule-firmware 13 with 4 skipped, firmware-element-sync 21). So does the whole operations runner, A10.18's suites among them: `operations: 1017 passed, 0 failed, 4 skipped`.
- [ ] _Playwright not applicable. Lint, typecheck and build not configured._

### Round 1's findings, re-checked

| Round 1 | Disposition | Check |
|---|---|---|
| 1. A section a member lacks | Fixed, as Amendment 2 item 1 chose | Probe 1, on HEAD. update-node's `no-section` now says add-to-concept "gives a node a section it lacks, for a concept it is already in as well as one it joins" (`update-node.js:221`, and its `when` at `:46`). add-to-concept of Fetch to pet, with fields, answers `added`, recorded as one `section-added`, with no link and no tag. The same call again is `already-element`. Probe 3: Goldie, taken out of golden retriever and dog, comes back whole when added to golden retriever, then to dog. Dog first is still refused by dog's breed conditional, and the description gives the order that works (`add-to-concept.js:45`). AT49–AT51 hold it. AT51's seed gives Goldie's golden retriever section its name, so both sections have the shape add-to-concept builds. That is a fair condition, since it can only give back a section with the node's name and slug. Two parts of the fix are unpinned (R2-4), and the story's AC4 still reads as before (R2-2). |
| 2. `wordTypes` | Fixed, and opens R2-1 | Probe 1: Mark Me, in dog, put in walkers, gains pet, recorded as `field-changed` (AT52). That change is now written with no rule-4 check: R2-1. |
| 3. The guard | Fixed | Probe 2, on HEAD: both nodes are refused `made-elsewhere`, naming update-concept and link-set (RM32's new cases). The guard form skips a node `lookedAfterElsewhere` names (`node-has-a-concept.js:67`), the one test `theNode` uses (`_memberships.js:169`); the check form still judges such a node (Deviation 4). The skip lets no removal through: `apply` refuses the same nodes with the same test after the locks, and the re-check covers the window between. |
| 4. The tag scan | Fixed, with a stated miss | `relationshipEvents` (`_memberships.js:480–501`) finds the relationship concept's header by its address, through the `tapestry_node_uuid` index, walks its class thread to its elements by the instance's own authors, and only then reads their tags. No read scans tag nodes by type and value. `firmware.conceptUuid` resolves the assistant's key at run time. RM45 holds it. What it misses is R2-3. |
| 5. The repeat over JSON that can't be read | Recorded: Amendment 2 item 5 swaps Decision 8's steps 5 and 7, as the code did | Probe 1: Twofer is `unreadable-json`. AT53 holds it. |
| 6. A removal beside a letter that doesn't parse | Fixed | `jsonOf`'s `letter: false` (`_memberships.js:290–295`), passed at `remove-from-concept.js:139`, reads only `tapestryOwnSections` on a node kept beside. A `json-tag` node's JSON is read as before. RM46 and the live check's R3 hold it; RM35 keeps its two other cases. |
| 7. Words | Fixed | Entry 7 says add-to-concept calls the check; entry 8 says "through the other concepts' supersets under its own"; both elements are regenerated, and `--check` is current. `M` declares each operation's `not-installed` and `no-superset` (`_memberships.js:62–65`), and their messages are worded per operation. MS20 and MS21 hold them. The rule-8 row names rule 7's element: see R2-6. |
| 8. The follow-ups | Fixed, but for the Loom memo, which couldn't be checked | Four ledger rows, each naming ADR 0022's follow-up, in the row format (lint L15 is clean). Follow-up 1's row states both halves of the missing provenance. MS22 holds them. The memo for follow-up 4 is on Loom, which this reviewer can't read. |

### The round-1 deviations

Each was checked against the code. All seven hold:
1. **A section given alone carries no would-be tags:** `add-to-concept.js:217` writes them only with a link. The reason holds: a `z` would have pass 1d make the direct link the call didn't. No test holds it (R2-4).
2. **`wordTypes` gains the concept's own key too:** `:177` puts `oKey` first among the keys added.
3. **The length check covers whatever the call writes:** `:190`, on `jsonChanged || ownChanged`.
4. **Only the guard form is silent:** `node-has-a-concept.js:67` comes after the check form's branch (`:58–63`).
5. **The relationship concept's header is found in a read of its own:** `_memberships.js:484–485`.
6. **The catalog row** (`docs/GRAPH_OPERATIONS_CATALOG.md:111`) says when `already-element` is answered, and that a missing section is given.
7. **`not-installed`'s and `no-superset`'s messages per operation:** `_memberships.js:72–75` and `:92–96`.

The annotations on four earlier deviations point at the amendment's items, and each is accurate.

**The live re-check,** against `tmp/live-check-22/`:
- `report-recheck-run1.json` failed R1a, R1b and R2, the three the story names, on the script's own mistake: no description, which live dog's schema requires.
- `report-recheck.json` passed all nine.
- R1b's entry holds `section-added` alone, with the same links into Fetch before and after; R2's `wordTypes` gained live pet's key.
- R4a–R4c show today's add-to-set's event reaching `letters` only once a reinstall wired it, which is R2-3's point.

### Spec and ADR

- **AC3** isn't met in one case this round made (R2-1).
- **AC4's** words no longer match what the code and Amendment 2 item 1 do (R2-2).
- **Amendment 2** matches the code, except that item 2 left Decision 8's step 8 out of date (R2-1).
- **Concept graph and house rules.** No handle and no concept definition changed. Rule 7's and rule 8's elements are regenerated, and one reinstall carries both (the rule-8 row). No tooling was added, and the added lines hold no 64-hex literal and no control or format character.

### Findings

#### Blocking

1. **R2-1. `src/operations/catalog/graph/add-to-concept.js:194` with `:170–182`: a node already in the concept that holds its section, put in a set, now has its `wordTypes` rewritten with no rule-4 check. So the call can write JSON that its own concept's schema refuses.**
   - **The cause.** Amendment 2 item 2 has such a node gain in `wordTypes` the keys of the concepts the set joins. Rule 4 still runs only when a section is written (`if (sectionWritten)`). Decision 8's step 8, "When the node was already in the concept, nothing new is judged" (ADR line 164), was written when such a call left the JSON as it was, and the amendment didn't revisit it.
   - **Probe 4, P1.** Mark Me, in dog with a dog section and no breed (dog fits), is put in golden retriever's superset through dog.
     - The answer is 200 `added`, recorded as `membership-added`, an `n` tag and `field-changed` on `word.wordTypes`, which gains `goldenRetriever`.
     - The answer reports dog `fits: false`. Firmware's dog schema says a dog whose `wordTypes` holds goldenRetriever must have that breed (its Reverse conditional, `allOf` in `firmware/versions/v1.0.0/concepts/dog/json-schema.json`).
   - **P2, the same JSON as a new membership.** Command Beagle, put in dog through golden retriever's superset, is refused 400 `invalid-fields`: "`dog.breed` is required".
   - **On round 1's code** P1 changed no JSON, and dog fit.
   - **The spec.** AC3 (story line 51) says that before anything is written, the node's JSON as the call would leave it is checked against the concept's schema, and refused when it doesn't fit. Dog is the concept named, not one the membership joins, which AC3 lets pass.
   - **No test sees it.** AT52's walkers joins pet, whose key no dog conditional names.
   - **Asked:**
     - **The Architect:** an Amendment 3, with the owner's approval, choosing one of:
       - rule 4 judges the named concept whenever the call changes the JSON it keeps (`jsonChanged || ownChanged`), so P1 is refused as P2 is. Run that way, no test breaks (the breaks' last row). The refusal should say how to go on. Probe 5 shows the way: add the node to golden retriever itself, which reports dog's verdict without refusing it, then set its breed with update-node. Or the call merges `fields` into the held section when they are given, so the breed can come with the set;
       - or AC3 is changed, with the owner's yes, to let a node already in the concept keep a section its concept no longer fits, its verdict reported, and Decision 8's step 8 says so.
     - **The Tester:** P1 as a failing test, with P2 beside it.
     - **The Implementer:** the code, as the amendment says.
   - **Why it blocks.** It is new this round, against an acceptance criterion and rule 4's one check, and it is reached in the breed case firmware itself defines. The fix is small.

#### Non-blocking

2. **R2-2. The story's AC4 (line 52), and the end of AC2 (line 50), still describe the repeat as round 1 built it.**
   - AC4 gives `already-element`, with nothing changed, to a node "already an element of the concept, and directly in the set when one is given". Amendment 2 item 1 adds "and its view holds the concept's section", and gives a node without one that section.
   - **Probe 4, P3.** A call with no fields for such a node, a no-op on round 1's code, is now refused 400 `invalid-fields` ("`pet.description` is required").
   - Neither the Deviations nor the Evidence mention AC4.
   - **Asked:** annotate AC4, and AC2's last sentence, with Amendment 2 item 1, as the story's "Added at Architecture" records the ADR's additions.
3. **R2-3. `src/operations/catalog/graph/_memberships.js:138` (`LETTERS`) and `remove-from-concept.js:52`: `letters`' published descriptions still promise "a relationship event of the instance's own that names a removed pair, as today's add-to-set signs one".**
   - Since Amendment 2 item 4, `letters` reads through the relationship concept's class thread.
   - Today's add-to-set signs its event with a `z` naming that concept, but doesn't link it there (`src/api/normalize/index.js:4525–4541`). Only a reinstall's pass 1d does, as the live check's R4a–R4b show.
   - So the most common such event is missing from `letters` until the next reinstall, and nothing in the answer says so. RM45 pins the miss as intended.
   - **Asked:** say that `letters` holds the relationship events the relationship concept reaches, so one that today's add-to-set signed since the last firmware reinstall can be missing, as Amendment 2 item 4 does.
4. **R2-4. Two parts of Amendment 2 item 1 have no test.** Breaking either left every suite green:
   - a section given alone writes no would-be tags (`add-to-concept.js:217`; Deviation 1). AT49 checks there is no link, but not that no `z` is added;
   - the section given to a node already in the concept is judged by rule 4 (`:194`). Probe 4 (P3, P4) shows the code refuses `invalid-fields` there.

   **Asked:** in AT49's run, a pet section that doesn't fit given to Fetch, refused with nothing written; and, in AT49, no `tag-added`.
5. **R2-5. `add-to-concept.js:45`: "naming in `differs` each field given that differs from what its section holds; `graph update-node` changes those".** Found this round.
   - For a node kept beside, update-node refuses (`not-own-node`, `person-node`, `placeholder-node`, `firmware-node`), as ledger row `2026-11-18-update-node-refuses-owner-sections-beside` records.
   - When the section is the author's own, the way that row gives, a removal and an add, can be refused too (`author-claim`).

   **Optional:** "for one of this instance's own nodes", or name the row.
6. **R2-6. The merge with staging now conflicts.** PR #136 (A10.18) landed first, as ADR follow-up 8 foresaw. The conflicts are in `docs/GRAPH_RULES.md`, rule 7's element and `src/operations/changes.js`.
   - **Entry 7.** Each branch marks the other's operation as still to come. Staging's says "`graph add-to-concept` (A10.22) will call it when it is built"; this branch's says the property operations "will call when they are built". The merge wants both as built, then rule 7's element regenerated from the merged rulebook, not taken from either side.
   - **`changes.js`' header:** keep both paragraphs.
   - **The ledger.** Staging's open row `2026-11-17-rule-three-rewrite-awaits-firmware-reinstall` already carries a reinstall for rule 7's element, and this branch's rule-8 row now names that element too. One reinstall closes both; say so in one of them.
   - Resolved this way in a scratch copy, everything passes (the gates, above).

   **Asked:** merge staging into the branch before the pull request, as above.

### Harness friction

1. **L1 checks one direction.** It flags a PASS-final review whose story isn't `Done`, but not a CHANGES_REQUESTED-final review whose story is. This story was set `Done` in round 1's commit, as the role file says, and stays so while this round blocks, with the lint clean. A candidate `meta` row: the "fix the findings before the PR" pattern makes this case common.
2. **Known, seen again:** the full gate can't run on this Mac, and the gate's route walks need the `node_modules` link. No new row.

### Verdict (round 2)

**CHANGES_REQUESTED**

**What holds.** Of round 1's eight findings, seven are fixed as Amendment 2 says. Of the eighth, only the Loom memo couldn't be checked from here.
- The loop is gone: add-to-concept gives a member the section it lacks, and Goldie's removal is undone in the order the description gives.
- The guard is silent for nodes looked after elsewhere, and that opens no way around D9.
- `letters` no longer scans tag nodes.
- A removal beside a letter that doesn't parse takes the owner's claim out.
- The words, the rule elements and the ledger rows are as asked.
- Every new test failed first, as the plan records. Of the twelve new breaks, nine are caught, two aren't (R2-4), and the twelfth is R2-1's candidate fix.
- The scoped gate passes on `f7a72259`, and so does the merge with staging, once resolved.

**What blocks:** R2-1. The `wordTypes` fix for round 1's finding 2 rewrites a member's JSON with no rule-4 check. So add-to-concept writes JSON its own concept refuses, which the same operation refuses for a new member. The Architect decides which way AC3 goes; then a failing test, then the code.

**The non-blocking findings:** the story's AC4 (R2-2); `letters`' descriptions (R2-3); two untested parts of item 1 (R2-4); a description's way on for a node kept beside (R2-5); and the merge with staging (R2-6).

**Next round.** I'll run the probes again, P1 and P2 first, then the breaks and the gate, and check Amendment 3's words as a fresh claim.

### Close-out (not committed)

- The story's status is `Done`, from round 1's commit. With this verdict, whether it goes back until a later round passes is the session's call; harness-lint won't flag it either way (harness friction 1).
- This section is written but not committed: the session commits it.
- Completion detection: unchanged since round 1, and reported in the chat.
