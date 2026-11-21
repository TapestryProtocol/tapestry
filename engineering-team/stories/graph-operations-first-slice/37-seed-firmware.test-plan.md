# Test Plan: Story 37 — `lifecycle seed-firmware`

**Story:** `engineering-team/stories/graph-operations-first-slice/37-seed-firmware.md` (approved, with its "Changed at Architecture" and "Changed at Test Design" sections)
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0037-seed-firmware.md` (accepted: Option A, Decisions 1–13, with Amendment 1, the owner's rulings at Test Design, 2026-11-20; Amendment 2, at Implementation's live check; and Amendment 3, review round 1's findings as the owner chose, 2026-11-21, ratified at the next gate)
**Review:** `engineering-team/reviews/graph-operations-first-slice/37-seed-firmware.md` (round 1: Blocking 1–2, N1, N2, N4, N7, tested below as "Amendment 3"; round 2, PASS: R2-N1–R2-N3 and nit 1, tested below as "Review round 2")
**Date:** 2026-11-20; Amendment 3's tests 2026-11-21

Every suite but one is stack-free, and all live under `test/operations/lifecycle/`, where `test/operations.test.js` finds and runs them, so none needs a line in `test/registry.js`:

- **The oracles** (`seed-firmware-oracles.test.js`) run today's routes from their source and pass now. They test the oracles, not the feature.
- **The target** (`seed-firmware-target.test.js`) and **the plan** (`seed-firmware-plan.test.js`) run in-process: `buildTarget` reads files, and `readState` reads an in-memory graph through `test/helpers/cypherEngine.js`.
- **The route** (`seed-firmware.test.js`) runs the real catalog in a child process (`test/helpers/operationsHarness.js`):
  - over a graph kept in a file, each statement run by the cypher engine with Neo4j's uniqueness rules;
  - with lifecycle's system faked (`test/helpers/lifecycleFakes.js`: the lock, and the graph's answer to `C.begin`);
  - with the spy on everything that signs or reads a key, and every endpoint dead;
  - with `TAPESTRY_FIRMWARE_DIR` naming a copy of `firmware/active`, changed where a case says so.
- **The record** (`seed-firmware-record.test.js`) runs today's derive in a child process over the engine, and the schema judge in-process.
- **The agent** (`seed-firmware-agent-through-cli.test.js`): `clients/cli/bin/tapestry.js` with an admin's own key, against `test/helpers/externalCliServer.js`.
- **The live check** (`seed-firmware-live.test.js`) skips, saying so, unless `TAPESTRY_CONTAINER` names a `tapestry-scratch…` container. With the variable unset or naming anything else, it asks docker nothing.

**The oracle is today's install's letters.** `test/helpers/todaysFirmwareRoutes.js` runs today's create-concept, create-element, add-node-as-element (pass 1c), create-set (with its relationship letter) and save-schema (with the primary-property fold and `regenerateJson`) from `src/api/normalize/index.js` in `node:vm`, as `test/helpers/todaysCreateConcept.js` runs create-concept. That helper gains `dTag`, `overwrite` and `conceptHeaderOverrides`.
- It walks the firmware folder as `install.js`'s passes 1a, 1b, 1c, 1c½, 2 and the b seed do.
- Signing is NIP-01's id over the letter's fields, with no key. Publishing is recorded. Each read a route makes is answered from a store of the letters signed so far, and a read the store doesn't know throws, naming it.
- So a change to today's routes fails a test until the builder follows (ADR, Consequences).
- Over `firmware/active` it takes 47 ms and signs 459 letters: 437 nodes and 22 relationship letters.
- It also keeps each concept graph as create-concept signed it, before pass 1c's rewrite (`rewrittenBy1c`). The target's expected letters (`targetLetters`) are today's install's with those three put back: the second departure (Amendment 1, item 2).

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1 the nodes | **ST1** 459 at today's addresses, `nostr-event-tag`'s core nodes at its name's slug. **ST2** tags as a set. **ST3** kind, role labels, no `NostrEvent`. **ST4** JSON by value, including the 38 primary properties pass 2's fold re-signs; the 3 concept graphs pass 1c flattens keep create-concept's form (word block, slugs, imports, IS_THE_CONCEPT_FOR), not the flattened one. **ST5** name, an element's slug. **ST6** no `o` tag. **ST7** header overrides, headerTags. **ST8** pass 2's schemas; the five carry no pass 3b value. **ST9** the six b. **ST10** the relationship letters. **SF3** the same nodes in the graph, the 3 concept graphs as create-concept made them: TapestryNode with a key, no `NostrEvent`, no `id`. **SP1** all added on an empty graph | target, route, plan | unit, integration (fake) |
| AC1 the relationships, pruned in one fixed order, by address | **ST17** the same files give the same relationships. **ST11** 1a's 328 core edges. **ST12** 1c's existing nodes, nothing for `irish-setter` and `golden-retriever`. **ST13** the 26 existing sets. **ST14** 1c¾ and 1e's prune. **ST15** 1d (relationship letters) and 1d½ (41 headers). **ST16** five ENUMERATES with both paths. **SF4** the same in the graph | target, route | unit, integration |
| AC1 the six b | **ST9**. **SF5** the b and its claim, `REFERENCES {source: 'b-tag'}`, to a placeholder at the b's address | target, route | |
| AC1 nothing signed, no guard; the graph operations work | **SF6** the spy is empty; `graph create-concept` then answers `created`. **ST20** the builder asks no graph | route, target | |
| AC2 the install record | **ST19** cameFrom in the target: an element's file and sha256. **SF7** cameFrom and installed on every node. **SR1–SR3** the derive puts both into tapestryJSON (word and set derivers) and nothing for a node with no record. **SR4** the derive's verdicts set the record aside for a node that carries it. **SR5, SR6** a node with no record keeps a concept section of its own named `installed` or `cameFrom`, and the verdicts judge it (Amendment 3, item 6). **SR7** the write path's checks too (round 2, R2-N1): `graph add-to-concept` puts an element seed-firmware recorded in a concept whose schema closes its top level, its `json` offloaded (the store's copy holds the record's sections) or inline, and `graph update-node` changes the installed-firmware graph under graph's schema, closed the same way; each record is set aside by `checkElements` and in the answer's verdicts (`fits`). A node with no record is judged whole, its own `installed` section refused. **SR8** `recordCarried`: both properties, one, none, and none that can't be read (R2-N2). **SR9** the rule's node form under the same closed schema: a recorded node fits, a node with no record is judged whole (R2-N2) | target, route, record | |
| AC2 the installed-firmware graph | **SF8** at its reserved address, `39999:<ta>:installed-firmware` (d tag `installed-firmware`), with seed-firmware's mark: its own `installed` record and `installedFirmware` (Amendment 3, item 3); labels, tags, HAS_ELEMENT from graph's superset, word, graph.nodes by address (curator headers included), relationships with ENUMERATES' properties, imports `[]`. **SF34** an admin's element "installed firmware" of graph, made by `graph create-element` at the address Decision 9 first used, stays as it was and isn't read as the record; seed-firmware writes its own at the reserved address. **SF35** a node there without the mark is refused (AC7). **SF33** read through the store after the Dashboard's offload | route | integration |
| AC2 status | **SF33** after the Dashboard's offload of the installed-firmware graph's json and a superset's, and a derive: `seeded` 1.0.0, `changedSince` 0 (Amendment 3, items 1–2). **SF9** `seeded` and its schema field; `changedSince` 0, then 1 after an edit; null, in words naming seed-firmware, for an empty graph and for today's install's graph; `installed` still `none` by readInstallState. **status.test.js P3**, re-aimed at Implementation: the old fields as before, beside `seeded: null` and a `note` naming seed-firmware, the graph seam stubbed to find no installed-firmware graph | route (status child), status | integration, unit |
| AC3 safe to repeat | **SF33** after the offload and a derive: 459 unchanged, none kept, change null, no entry (Amendment 3, items 1–2). **SP9** pure: a superset whose `word.wordTypes` is only in the set deriver's order is unchanged; one with another type in it is kept (item 2). **SF10** again, as admin, with `1.0.0` and `v1.0.0`: 459 unchanged, change null, one entry. **SF11** two at once: one installs, the other `busy` or unchanged; each node once. **SF15**'s and **SF23**'s repeats write nothing. **SA1**'s repeat | route, agent | |
| AC4 update | **SF14** changed (record moved), added. **SF15** kept naming json / name / b, record not moved, edit kept; kept again with nothing written. **SF16** not-in-source, still there. **SF17** relationships: removed, added, kept (removed by hand; properties edited), others (a direct link under a firmware superset; a second parent). **SF18** the instance's own element stays. **SF21** take by key and by address; takeAll by an admin (the b claim replaced); then nothing to change. **SF36** the two relationships SF17 keeps (removed by hand; properties edited) are listed in `installedFirmware.keptRelationships`, not `graph.relationships` (Amendment 3, item 4) | route | integration |
| AC4 first contact (open question 2) | **SP3** (9 kept), **SP4**, **SP8** pure. **SF22** 450 unchanged and adopted (keeping their letters), dog's schema among them; 9 kept with noRecord: the four schemas pass 3b filled, the three concept graphs and the fixture's two edits; missing relationships kept with noRecord. **SF23** again, 9 kept; takeAll changes the 9 ("Settled at Test Design", item 9): tapestryKey, id, NostrEvent and created_at kept, old tag nodes gone, letterOutOfDate. **SF37** a relationship kept with noRecord (dog-breed's ENUMERATES, its paths edited) is listed in `installedFirmware.keptRelationships`; a later firmware that drops it leaves it in place, reported kept, not removed (Amendment 3, item 4) | plan, route | |
| AC4 take (open question 3) | **SP5** (takeAll changes 9), **SF21**, **SF23**, **SA1** | plan, route, agent | |
| AC5 graph rules | **SP6** put back (or changed) on first contact; another author's item blocks. **SF19** put-back, changed, nine unchanged. **ST28** the eleven items | plan, route, target | |
| AC6 the answer, the entry, rules check | **SF12** version, source (files), nodes with outcome/tapestryKey/address/role/file, counts, relationships, letterOutOfDate `[]`, cacheOutOfDate counting each failed derive, rulesCheck, change, note. **SF13** the entry's who and keys; `graph history` finds both entries by a node. **SF20** 0 findings fresh; a second parent found and left as it was | route | integration |
| AC7 refusals | **SF24** unknown-version (names 2.0.0 and 1.0.0), not-firmware (names each ref), 501 refs. **SF25** firmware-unreadable (names each file and problem), graph untouched. **SF26** busy (names the backup); graph-unavailable, in words saying nothing can be installed. **SF27** no-assistant. **SF28** 401, 403, 415, unknown input. **ST21–ST27** each unreadable kind (below). **ST31** an existing set naming an undefined concept is skipped, no problem. **SF35** `address-held` (409) for a node at the reserved address without the mark: neither part, the section alone, the record alone; naming the node, nothing written. **SF39** seed-firmware's own installed-firmware graph, its record there, whose offloaded `json` has no entry in the store: still `address-held`, in words that say its JSON can't be read, never that it isn't seed-firmware's; nothing written (round 2, nit 1). **ST32, SF38** an alias that isn't a plain name (Amendment 3, items 3 and 5) | route, target | |
| AC7 how it's reached | **SF1** the declaration, its seven refusals, `address-held` among them (Amendment 3, item 3). **SF2** the listing with every refusal; `/docs` has the POST. **SF29** the internal command, no sign-in, its refusal the route's. **SA1** the agent | route, agent | |
| AC7 what stays, the docs | **SF30** today's install and its route (passes now, a guard). **ST33** the tripwire: a digest of today's install's pass functions, and of pass 3c's route, `handleWireImplicitElements` in `src/api/normalize/index.js` (round 2, R2-N3), failing, naming `src/firmware/target.js`, when one changes (passes now, a guard; Amendment 3, item 8). **SF31** catalog §8's row, BIBLE §7 and §11 | route, target | |
| AC7 the live check | **L1–L4** (below); L1 reads the installed-firmware graph at its reserved address and requires each kept relationship listed apart (Amendment 3, items 3 and 4) | live | live |

### The ADR's decisions

| Decision | Tests |
|---|---|
| 1 the operation: `run`, inputs, refusals, inline under the lock | SF1, SF11, SF24, SF26, SF27, SF28 |
| 2 a source and an installer (`buildTarget`; `readState`, `plan`, `apply`) | ST1, ST20; SP1–SP8 |
| 3 the source: `TAPESTRY_FIRMWARE_DIR`, read once and fresh, problems, `version`, `source.digest` | SF32, ST17, ST18, ST21–ST27, ST31, SF24, SF25 |
| 4 the target, pass by pass | ST1–ST16, ST19, ST28, ST29 (`installName` exported), ST30 (`conceptNodes`' defaults unchanged, a guard), ST31, SP7 (blocked) |
| 5 pass 3b isn't rebuilt | ST8, SF22, SF23, L1 |
| Amendment 1 (Test Design): the fold; the three concept graphs kept as create-concept made them; the core nodes' addresses; undefined concepts; one fixed order | SO5, ST4, SF3 (item 1); SO6, ST4, SF3, SP3, SP5, SF22, SF23, L1 (item 2); ST1 (item 3); ST12, ST24, ST25, ST31 (item 4); ST17, ST11–ST16, L1 (item 5) |
| 6 the record, what counts as an edit, the derive's sections | ST19, SF7, SF15, SR1–SR9, SP9 |
| 7 each node's outcome | SP1, SP3, SP5–SP8, SF14–SF16, SF19, SF21–SF23 |
| 8 relationships | SP4, SF17, SF21, SF22, SF5 (the b claim), SF23, SF36, SF37 |
| 9 the installed-firmware graph | SF8, SF13, SF33, SF34, SF35 |
| 10 one transaction, the lock, keeping a letter's id, the cache, rules check | SF11, SF12 (cacheOutOfDate), SF20, SF23 |
| 11 the answer | SF10, SF12, SF15, SF17, SF22 |
| 12 status | SF9 |
| 13 the live check | L1–L4 |
| Amendment 3 (Review, round 1): read through the LMDB; wordTypes as a set; the reserved address and the mark; kept relationships apart; plain-name aliases; the record's sections; the tripwire | SF33, status's part in SF33 (item 1); SP9, SF33 (item 2); SF1, SF2, SF8, SF11, SF13, SF34, SF35, L1 (item 3); SF36, SF37, L1 (item 4); ST32, SF38 (item 5); SR4–SR6 (item 6); ST33 (item 8). Not tested here: item 7 (BIBLE §7's words and the ledger row) and item 9 (the ADR's words) |
| Review round 2: the write path's checks; `recordCarried` and the rule; pass 3c's route in the tripwire; a marked graph whose JSON can't be read | SR7 (R2-N1); SR8, SR9 (R2-N2); ST33 (R2-N3); SF39 (nit 1). Not tested here: R2-N4 (the ADR's decisions corrected in place) and nits 2 and 3 (the catalog's line, the story's gate line) |

### firmware-unreadable (Decision 3)

| Case | Test |
|---|---|
| A manifest that doesn't parse | ST21 |
| A file the manifest names that isn't there: a concept's schema, a relationship type's file | ST22 |
| A file that isn't JSON | ST23 |
| A concept an enumeration names that the manifest doesn't define | ST24 |
| An enumeration by a concept the manifest doesn't define (its key's singular) | ST25 |
| A relationship type a concept manifest uses that `relationshipTypes` lacks | ST26 |
| Three at once, each named | ST27, SF25 (through the route, the graph untouched) |
| An existing node or existing set naming a concept the manifest doesn't define: skipped, as today, and no problem (Amendment 1, item 4) | ST12 (the real manifest's existing nodes), ST31 (an existing set, in a temporary folder) |
| A relationship type whose alias isn't a plain name, `[A-Z_][A-Z0-9_]*` (Amendment 3, item 5) | ST32 (a space, and a backtick, each naming its file and the alias), SF38 (through the route, naming both, nothing written) |

## Settled at Test Design

Ten points where the ADR was silent, or read two ways, and the tests had to choose. The owner ruled on the first five at the Test Design gate (the owner, 2026-11-20; ADR 0037, Amendment 1, and the story's "Changed at Test Design"), and accepted the other five as chosen.

1. **Pass 2's primary-property fold.**
   - *What today's install does:* save-schema also calls `reconcilePrimaryPropertyForConcept`, which re-signs 38 of the 41 primary properties against their new schema (SO5).
   - *Ruling (the owner, 2026-11-20):* **included, as AC1 asks.** The target's primary properties are the folded ones (Amendment 1, item 1).
   - *The tests:* unchanged. ST4 and SF3 expect the folded primary properties; on first contact (SF22) they are `unchanged`.
2. **Pass 1c rewrites three concept graphs.**
   - *What today's install does:* add-node-as-element regenerates the parent concept's concept graph to `{ graph: { nodes, relationshipTypes, relationships: [] } }`, with no word block, for `node-type`, `graph-type` and `validation-tool-type` (SO6). It is ledger row `2026-11-20-add-node-flattens-concept-graphs`.
   - *Ruling (the owner, 2026-11-20):* **a second departure, beside Decision 5's.** The target keeps the concept graph `conceptNodes` gives those three, as create-concept made them: word block, slugs, imports and the IS_THE_CONCEPT_FOR relationship (Amendment 1, item 2).
   - *The tests:*
     - SO6 still shows today's rewrite, and now also that the oracle keeps create-concept's form of exactly those three (`rewrittenBy1c`).
     - ST2–ST5 and SF3 compare against `targetLetters`: today's letters with those three put back.
     - ST4 asserts each has its word block, each node's slug, two imports and its one relationship, and is not the flattened form.
     - On today's install's graph they differ, so first contact keeps them with noRecord: SP3 and SF22 count 9 kept and 450 unchanged; SP5 and SF23's takeAll change 9; SF23 also finds node-type's concept graph back in create-concept's form. (The counts were 10 and 449 until Implementation's live check: see "Found at Implementation" below.)
     - L1 expects kept with noRecord exactly the three concept graphs and each schema pass 3b filled on the instance, and every other node unchanged.
3. **`nostr-event-tag`'s core nodes.**
   - *What today's install does:* create-concept puts the header at `dTag` but the core nodes at the name's slug. The concept is named "nostr event tagging", so its core nodes are at `…:nostr-event-tagging-superset` and so on.
   - *Ruling (the owner, 2026-11-20):* **follow today.** `conceptNodes` takes the header's d-tag and the core nodes' apart (Amendment 1, item 3).
   - *The tests:* unchanged; ST1 pins today's addresses.
4. **A concept the manifest doesn't define.**
   - *The conflict:* the real manifest's `elements.dog-breeds.existing-nodes` names `irish-setter` and `golden-retriever`, which its concepts don't hold. Today's 1c makes nothing for them. Read wholly, Decision 3 would have refused `firmware/active`, which AC1 installs.
   - *Ruling (the owner, 2026-11-20):* **an existing node or existing set naming one is skipped, as today, and isn't a problem.** An enumeration naming one still refuses `firmware-unreadable` (Amendment 1, item 4; the story's AC7).
   - *The tests:* ST1 requires `firmware/active` to have no problems; ST12 requires its two existing nodes to make nothing; ST24 and ST25 refuse an enumeration's undefined concept. **ST31** (new) adds an existing set naming `no-such-concept` to a temporary folder: no problem, the same 459 nodes, no relationship naming it, and firmware/active's relationships.
5. **The prune's order.**
   - *What was found:* today's 1e and 3c depend on the order the install reads its nodes. A throwaway reading of `install.js`'s edge passes, run in the session's scratchpad over the oracle's nodes (not shipped):
     - 3c's concepts and nodes were kept in name order, as its `ORDER BY` fixes them. Only the reads `install.js` leaves to Neo4j's order were varied: 1e's, and 3c's prune's, of a superset's direct links.
     - In one order it gives 915 relationships, and in the reverse 929. Nine and 23 links differ: `superset`'s superset → `validation-tool`'s, `tapestry`'s, `tag`'s supersets in one; `set`'s superset → `dog`'s, `graperank`'s, `graph-rule`'s supersets in the other.
     - The prune checks paths through HAS_ELEMENT edges, and these cycle through `word`'s superset. So which direct link survives depends on which was pruned first.
   - *Ruling (the owner, 2026-11-20):* **the target prunes 1e and 3c in one fixed order, by address** (Amendment 1, item 5). On first contact, a link today's install kept that the target prunes is the instance's own (`others`), and a target link today's install pruned is `kept` with noRecord until taken.
   - *The tests:*
     - They keep pinning only the edges that come out the same in both orders: ST11–ST16 and SF4, and the update's relationship cases (SF17), which touch `json-data-type` and `nostr-relay` only.
     - ST17 now also requires the same files, read twice or from another folder, to give the same relationships: one fixed order.
     - **L1:** a relationship kept with noRecord, and a link between firmware nodes counted as `others`, is allowed only when it is a HAS_ELEMENT or IS_A_SUPERSET_OF from a superset (the prune's kind). L1 prints each such link. Anything else kept, added or removed fails. Since the answer counts `others` without listing them, L1 works them out: the graph's links between firmware nodes (the installed-firmware graph's `graph.nodes` under the assistant) that its `graph.relationships` doesn't list.
6. **The seam the plan suite pins.** *Accepted as chosen (the owner, 2026-11-20).*
   - *The functions:* `_seed.js` exports `readState(read, target)` and `plan(target, state, { take, takeAll })`. `read` is `(cypher, params) → Promise<rows>` (it carries `.read` and `.run` too, so a reader written for a tx works).
   - *What `plan` answers:* `{ nodes, relationships }`.
     - `nodes`: an entry `{ address, outcome, noRecord?, parts? }` for each node, as a list, a Map or an object keyed by address.
     - `relationships`: a list of `{ type, from, to, outcome }`, or Decision 11's four lists and two counts.
   - *Not pinned:* `apply`'s arguments. The cases a record decides (edited after an install, not-in-source, removed) are tested through the route.
7. **Names the ADR doesn't give, which the suites read.** *Accepted as chosen (the owner, 2026-11-20).*
   - *The target's nodes:* `address`, `kind`, `labels`, `name`, `tags`, `json` (an object or JSON text), `slug`, `cameFrom` (an object or JSON text).
   - *The target's relationships:* `{ type, from, to, properties }` (`nodeFrom`/`nodeTo`/`props` are read too).
   - *The target's source:* `kind: 'files'`, `digest`, and `files` (a list of paths, or an object keyed by path).
   - *The answer's counts:* keyed by outcome (`put-back` or `putBack`).
   - *A kept entry:* its `parts`, every string in which counts. A tag type such as `b` may be a string, a key or a word.
   - *rulesCheck:* its number of findings in a field named `findings`, `count`, `found` or `total`.
   - *Records:* `cameFrom.address` is the file's posix path relative to the folder (`concepts/dog/elements/rover.json`), and `cameFrom.id` the sha256 of its bytes.
   - *The digest:* by path relative to the folder, so a copy of `firmware/active` has the same digest (ST17).
   - *The installed-firmware graph:* it isn't counted among the 459 (SF12 leaves its address out of `nodes`).
8. **A graph-rule item that differs on first contact** has no record to tell an edit from a changed file. SP6 accepts `put-back` or `changed`, never `kept`. *Accepted as chosen (the owner, 2026-11-20).*
9. **A missing relationship taken by takeAll** is accepted as `added` or `changed` (SP5), and must exist afterwards (SF23). *Accepted as chosen (the owner, 2026-11-20).*
10. **L2 needs a second scratch container** (`TAPESTRY_SEED_EMPTY_CONTAINER`, an empty graph), since L1, L3 and L4 need an instance today's install installed. Decision 13 says "scratch stacks". L2 skips without it. *Accepted as chosen (the owner, 2026-11-20).*

**Found at Implementation's live check** (the coordinator, 2026-11-20; root cause confirmed, the fix in the tests):
- *What happened:* on a scratch stack today's install set up (firmware 1.0.0, the branch at `e18fc03d`), L1 found 7 nodes kept with noRecord, not 8. They were four schemas (word's, graph's, property's, relationship's) and the three concept graphs; dog's schema answered `unchanged`.
- *The cause:* today's apply-enumerations skips an enumeration whose enumerating concept has no element (`src/api/normalize/index.js`: "No elements found — skipping"). dog-breed has none on 1.0.0: its existing nodes name `irish-setter` and `golden-retriever`, which item 4 skips. So pass 3b never touches dog's schema, and it equals its file. Live, dog-breed's class thread holds 0 elements. L3 and L4 passed.
- *The fix:*
  - The stack-free fixture now skips such an enumeration exactly as the route does (`enumeratedOnTodaysInstall`): SP3 and SF22 count 9 kept and 450 unchanged; SP5 and SF23's takeAll change 9; SF22 also finds dog's schema unchanged.
  - L1 reads from the instance which enumerations pass 3b applied, so a later firmware that gives dog-breed elements still passes.

**Settled at Review round 1** (Amendment 3's tests, 2026-11-21). Where the amendment is silent, the tests chose as follows, for the owner to confirm at the gate:
- *The mark's record.* The installed-firmware graph must carry an `installed` property that parses to an object (SF8, SF34). Its fields aren't pinned. A node there with a record of a node's shape (`digest`, `parts`) and no `installedFirmware` section is refused like the others (SF35's third case), since the mark is both.
- *What `address-held` names:* the node's address or its tapestryKey, either (SF35). Its other words aren't pinned.
- *Each item fails for its own reason.* SF8, SF11 and SF13 look at the reserved address, so they fail until it moves. SF33 and SF36, which test other items, find the installed-firmware graph at either address.
- *The kept list's form.* `installedFirmware.keptRelationships` is read in `graph.relationships`' form (`nodeFrom.slug`, `relationshipType.slug`, `nodeTo.slug`) or as `{ type, from, to }` (`listedIn`). Whose properties it holds, the target's or the graph's, isn't pinned.
- *Both kinds of kept are listed apart:* removed since (numeric-types → number) and with properties an admin edited (dog-breed's ENUMERATES). That holds on an update (SF36) and on first contact, with noRecord (SF37).
- *A firmware that drops a kept relationship:* the relationship stays as the admin left it and is reported in `relationships.kept`, never `removed` (SF37). Whether the list still names it afterwards isn't pinned.
- *The offload is the real one.* SF33 runs the Dashboard's `POST /api/tapestry-key/offload-all` handler and the real derive in a child, over two nodes (the installed-firmware graph and node-type's superset). The real LMDB store sits at `TAPESTRY_LMDB_PATH`, and the harness run reads the same store.
- *The tripwire's text* is each pass's source with its whitespace collapsed. So re-indenting alone doesn't trip it; any other change does, a comment's included. ST33's message says to bring `src/firmware/target.js` in line, then update the digest.
- *An alias through the route* (SF38) is refused before anything is written: the graph is empty afterwards. Today a check at write time throws instead, so the route answers 500 `failed`.

**Settled at Review round 2** (2026-11-21), for the owner to confirm at the gate:
- *SR7's write paths:* `graph add-to-concept` and `graph update-node`, the callers of `fits` and `checkElements` that can reach a recorded node.
  - `add-to-concept` takes any firmware element.
  - `update-node` refuses each node seed-firmware records but one: firmware elements (`firmware-node`), the core nodes, sets and rules (`made-elsewhere`), and a relationship letter, which has no json tag (`unreadable-json`). So SR7 changes the installed-firmware graph's description.
  - `create-element` and `create-set` make new nodes, which carry no record.
  - How the record reaches the two checks isn't pinned, only their verdicts.
- *The closed schemas are put in the graph by hand,* as a raw edit would leave them, since `graph set-schema` keeps only a wrapped schema. No builder closes a top level today (the review's R2-N1).
- *SF39 keeps the refusal `address-held` (409),* which nit 1 calls safe, and pins only its words:
  - they name the node, say it is seed-firmware's, and say its JSON can't be read;
  - they never say that it isn't seed-firmware's record or lacks the mark.
- *SR8 and SR9 pass now* (guards): `recordCarried` and the rule already do what R2-N2 asks to see tested. ST33's new digest (R2-N3) passes too, and fails, naming target.js, when `handleWireImplicitElements` changes (checked in the scratchpad copy).

## Edge cases

- [x] Empty input: `{}` installs (SF3). An empty graph: all added (SP1), and status says none is recorded (SF9).
- [x] Concurrent calls: two at once (SF11), and while a backup holds the lock (SF26).
- [x] Graph database unavailable: `graph-unavailable` from C.begin's check, with the graph seam down too (SF26).
- [x] A ref that isn't a firmware node, by address and by key (SF24); 501 refs (SF24).
- [x] A version spelled `1.0.0` and `v1.0.0` (SF10), and an unknown one (SF24, SF29).
- [x] Unreadable firmware of every kind Decision 3 names (ST21–ST27), and three at once with the graph untouched (SF25).
- [x] A concept the manifest doesn't define, named by an existing node (ST12) or an existing set (ST31): skipped, no problem.
- [x] Today's six seeded headers carry each tag twice (pass 1a's tag nodes and the seed's): read as a set (SO8, SF22), and taken out when changed (SF23).
- [x] A relationship letter found at today's random address, never made again (SP8).
- [x] An element blocked by another element of its name in the class thread (SP7); another author's graph-rule item (SP6).
- [x] A node seed-firmware didn't make, under a firmware concept, and its link (SF18); a direct link the firmware's prune would take out (SF17).
- [x] The firmware folder changed between two calls in one process: the builder reads fresh (ST18, SA1).
- [x] The Dashboard's offload and a derive between two runs: the installed-firmware graph's json and a superset's an `lmdb:` reference, the superset's `word.wordTypes` in the set deriver's order (SF33, SP9).
- [x] An admin's element named "installed firmware" of graph, at the address Decision 9 first used (SF34). A node at the reserved address without seed-firmware's mark: neither part, the section alone, the record alone (SF35).
- [x] A concept section named `installed` or `cameFrom` in a node with no record (SR5, SR6).
- [x] An alias with a space, or a backtick (ST32, SF38).
- [x] A firmware that drops a relationship the instance kept (SF37).
- [x] A recorded node read back by a write while its json is offloaded, under a schema closed at its top level (SR7); `recordCarried` over properties that can't be read (SR8).
- [x] seed-firmware's own installed-firmware graph whose offloaded json has no entry in the store (SF39).
- [ ] Not tested stack-free: Neo4j's own transaction under 459 nodes (Consequences: one transaction, its memory). L2 shows it on a scratch stack.
- [ ] Not tested: the control panel stopping mid-run (Decision 1: the one transaction commits or leaves the graph as it was; the next `C.begin` recovers a stale lock, which `migrate.test.js` covers for the lock).

**Not pinned on purpose:**
- The words of each refusal, beyond what each must name.
- The Cypher's text. Any statement within the engine's subset runs (below).
- 1d's and 3c's links among the generic concepts, which the fixed order, by address, decides (item 5 above); L1 lists how they differ from today's install's.
- Whether adopting nodes on first contact records a change entry. The first run writes the installed-firmware graph, and SF23 pins only that a run with nothing to write records none.
- `apply`'s signature. `installed.digest`'s algorithm. The order of tags.

## Test infrastructure

- **Runner:** each suite exports `run()`; `test/operations.test.js` discovers them.
- **The fixtures**, in `test/helpers/seedFirmwareFixtures.js` (new):
  - *The firmware:* `copyFirmware(changes)`, `oracle(dir)` and `buildTarget(dir)`.
  - *Graphs:* `todaysGraph(oracle, …)`, the firmware's nodes as today's install leaves them:
    - lettered, with importEventDirect's tag nodes, the role labels and slugs, and the routes' edges;
    - each seeded header's two sets of tag nodes, AUTHORS, and its b claim to a placeholder;
    - each schema pass 3b fills, with an enum at its enumeration's destination path. An enumeration whose enumerating concept has no element is skipped, as the route skips it (`enumeratedOnTodaysInstall`): on `firmware/active`, dog-breed's, so dog's schema is its file's.
  - *Runs:* `runSeed(…)` is one harness run with the cypher engine, the lifecycle fake and the firmware folder. `statusFirmware(state)` runs lifecycle status's firmware part in a child whose driver and graph seam both read the state.
  - *Readers:* indexed, so a 3,000-node state reads fast. The answer's accessors are tolerant of the names in item 7.
- **The oracles** are `test/helpers/todaysFirmwareRoutes.js` (new) and `todaysCreateConcept.js` (extended additively; story 16's suites pass unchanged).
- **The derive child:** `test/helpers/seedFirmwareDeriveChild.js` (new) runs `tapestry-derive.js` over the engine. Today's derive runs there whole, its schema verdicts included.
- **The offload child** (Amendment 3): `test/helpers/seedFirmwareOffloadChild.js` (new).
  - *What it runs:* the offload-all handler, from `registerTapestryKeyRoutes`, then the real derive, over a state. Only the handler's read of inline json tags is narrowed, to the nodes named.
  - *What it touches:* only `src/lib/neo4j-driver.js` is stubbed. The real LMDB store is at `TAPESTRY_LMDB_PATH`. It writes the state back, in about 0.2 s.
  - *The fixtures it adds:* `installedGraphAddress()` (now the reserved address), `oldInstalledGraphAddress()`, `installedGraphJson`, `listedIn`, `offloadAndDerive` and `readStoreEntry`, and an `lmdb` option for `runSeed` and `statusFirmware`.
- **The harness hooks** (additive):
  - `operationsHarness.js`: a request `{ together: [r1, r2] }` sends both at once (SF11).
  - `externalCliServer.js`: `spec.lifecycleFakeState` replaces `_system.js` with the fake, as the harness does for `lifecycleFake`.
  - `migrate.test.js`, `create-concept.test.js`, `create-element.test.js`, `concept-names.test.js`, `status.test.js`, `tapestry-key-paths.test.js` and `nostr-agent-through-cli.test.js` were run after these changes, and all pass.
- **The engine's subset** (`test/helpers/cypherEngine.js`) is the Implementer's to stay within.
  - *It refuses:* `CALL`, `UNION`, path variables (`MATCH p = …`), a variable on a var-length path, CREATE of a var-length path, and label alternatives in `CREATE`/`MERGE`/`SET`.
  - *Fallback:* a statement it can't run goes to `graphFake.js`'s exec, which knows only its pinned shapes.
  - *Its uniqueness rules:* `NostrEvent.id`, `NostrEvent.uuid`, `NostrEventTag.uuid`, `NostrUser.pubkey` and `TapestryNode.tapestryKey`.
  - *What was checked to run on it now:* `graph history`, `graph create-concept`, `graph resolve` over a graph shaped as seed-firmware leaves it, and today's derive.
- **What the Implementer also meets:**
  - `tapestry-key-paths.test.js`: G4 (`keyNode` on every CREATE/MERGE), G11/G18 (address lookups by `NostrEvent|TapestryNode`), G19.
  - `write-path.test.js` W1, and `operations.test.js` L1/L3/H12/H13/C*/D*.
  - `openapi-coverage.test.js`, which reads the declaration and needs no change.
- **Speed.**
  - *The suites' cost:* most of it is the installs the implementation writes through the cypher engine, about a millisecond a statement at firmware scale. A throwaway stub's fresh install, one statement per node, its tags, and one per relationship type, took 3.0 s.
  - *The builder:* it must not enumerate every path for 1e's and 3c's checks. The scratchpad reading that did took about 10 s a build.
- **Firmware state:** none live. Stack-free suites read `firmware/active` and copies of it.

## How to run

Each suite alone, with every endpoint dead, `TAPESTRY_CONTAINER_PORT` unset, and stub `curl` and `docker` first on `PATH` (on the Mac Studio, `source tmp/a10-37/env.sh`):

```
node -e 'require("./test/operations/lifecycle/seed-firmware.test.js").run().then(r=>console.log(JSON.stringify({pass:r.pass,fail:r.fail,skipped:r.skipped})))'
```

The same for `seed-firmware-oracles`, `-target`, `-plan`, `-record`, `-agent-through-cli` and `-live` (which skips). As a scoped gate:

```
GATE_LABEL=a10-37-tests node -e 'const {runGate}=require("./test/helpers/gateRunner"); const want=new Set(["operations.test.js"]); runGate({suites: require("./test/registry").suites.filter(s=>want.has(s.file)), label: process.env.GATE_LABEL})'
```

- Never run `operations.test.js` beside the suites it runs, and never the full `npm test` on the Mac Studio, whose stack is the agent-memory instance.
- The pull request's CI runs the full gate.
- The live suite runs with `TAPESTRY_CONTAINER=tapestry-scratch-…` (and `TAPESTRY_SEED_EMPTY_CONTAINER` for L2) on stacks from `scripts/scratch-stack.sh`. The uniqueness rules and `tapestry-keys` must be applied first (story fact 12).

## The live check (at Implementation, on scratch stacks, never the agent-memory instance)

Automated in `seed-firmware-live.test.js`:

- **L1, first contact.** On an instance today's install installed (L1 runs `POST /api/firmware/install` first if needed):
  - kept with `noRecord` are exactly the three concept graphs (item 2) and each schema pass 3b filled. L1 reads which from the container's firmware and graph before it runs: an enumeration whose enumerating concept's class thread (`IS_A_SUPERSET_OF*0..10`, then `HAS_ELEMENT`) holds at least one element. On firmware 1.0.0 that is word's, graph's, property's and relationship's, since dog-breed has none, so 7 are kept. L1 prints the filled and skipped enumerations;
  - every other node is `unchanged`: 459 minus those, 452 on firmware 1.0.0;
  - no relationship is added or removed;
  - a relationship kept with noRecord, or a link between firmware nodes counted as `others`, is allowed only when it is a HAS_ELEMENT or IS_A_SUPERSET_OF from a superset, the prune's kind (item 5). L1 prints each such link, from the answer's `relationships.kept` and from the graph's links between the installed-firmware graph's nodes that neither of its relationship lists names. Anything else kept fails;
  - the installed-firmware graph is read at `39999:<ta>:installed-firmware`, and each relationship kept is listed in `installedFirmware.keptRelationships`, not in `graph.relationships` (Amendment 3, items 3 and 4).
- **L2, an empty instance.** On a second container: 459 added; no node at a firmware address has an `id`; a repeat is unchanged, with no change entry.
- **L3, an update.**
  - *The setup:* nostr-relay's b is re-pointed by a raw query, and `dcosl-brainstorm-world.json` is changed in the container's firmware, then the control panel restarted.
  - *What it asserts:* the header is `kept`, naming its b; the changed file's node is `changed`, holding the file's JSON.
- **L4, taking.** `take` brings the header in line: `changed`, its b the firmware's pointer. Then the file is put back and the control panel restarted.

By hand, in the story's record:
- **LH1** SA1's sequence through the external CLI, by an admin agent with its own key, against the scratch stack (AC7).
- **LH2** a fresh install's time through nginx, against its 900 s.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-20, on `A10.37-seed-firmware` at `67146470` (staging `79c8a098` with the story, the ADR and the amendment commit), with this phase's files uncommitted beside it, after the owner's rulings. Each suite ran alone, with every endpoint dead and the stubs first on `PATH`:

```
RESULT seed-firmware-oracles.test.js {"pass":8,"fail":0,"skipped":0} 0.1s            the oracles' own suite
RESULT seed-firmware-target.test.js {"pass":1,"fail":30,"skipped":0} 0.5s             ST30 passes: a guard
RESULT seed-firmware-plan.test.js {"pass":0,"fail":8,"skipped":0} 0.1s
RESULT seed-firmware.test.js {"pass":1,"fail":31,"skipped":0} 0.1s                    SF30 passes: a guard
RESULT seed-firmware-record.test.js {"pass":1,"fail":3,"skipped":0} 0.3s              SR3 passes: a guard
RESULT seed-firmware-agent-through-cli.test.js {"pass":0,"fail":1,"skipped":0} 0.0s
RESULT seed-firmware-live.test.js {"pass":0,"fail":0,"skipped":4} 0.0s
```

The 73 failures, by reason:

```
  30  src/operations/catalog/lifecycle/seed-firmware.js does not exist yet (ADR graph-operations-first-slice/0037 Decision 1)
  29  src/firmware/target.js does not exist yet (ADR graph-operations-first-slice/0037 Decisions 2 to 4)
   8  src/operations/catalog/lifecycle/_seed.js does not exist yet (ADR graph-operations-first-slice/0037 Decision 2: readState, plan and apply)
   1  SF32 with TAPESTRY_FIRMWARE_DIR set, the module reads that folder; got {"dir":".../A10.37/firmware/active","date":"2026-03-28"}
   1  SR1  rover-86aef126: cameFrom and installed are top-level sections, as the node holds them; got {}
   1  SR2  the-set-of-free-nostr-relays: cameFrom and installed; got {}
   1  SR4  the derive's and the rule's check: cameFrom and installed are set aside; got {"fits":false,"problems":[{"path":"the element's JSON","message":"`cameFrom` isn't a field the schema takes"},{"path":"the element's JSON","message":"`installed` isn't a field the schema takes"}]}
   1  SF31 catalog §8's row says what was built; got "| `seed-firmware` | Install or update the built-in concepts, by the bootstrap path, without undoing local edits | `version?` → installed | Signs: `POST /api/firmware/install`, which can also undo local edits. |"
   1  ST29 _elements.js exports installName (ADR 0037 Decision 4: "installName is exported")
```

**The scoped gate** (`operations.test.js`, every operations suite, these included) ran before the rulings, at `36a305fc` (`GATE_LABEL=a10-37-tests`), in 251 s.
- Its 72 failures were exactly the new suites' (29 + 8 + 31 + 3 + 1), and every other operations suite passed.
- Its 14 skips are the two live suites (4 + 6) and four of `lifecycle migrate: the check for shared keys`.
- The rulings since add one failing test (ST31) and change no other suite.

```
operations: 1317 passed, 72 failed, 14 skipped
Overall: FAIL — 1317 passed, 72 failed, 14 skipped across 1 suites · record tmp/gate-runs/20261120T232730Z-25695-61d2.json
```

**Each test gets past its declaration check.** A copy of the tree in the session's scratchpad (never the worktree) ran the suites against three throwaway stubs:
- a `firmware.js` that reads `TAPESTRY_FIRMWARE_DIR`;
- a `target.js` built from the oracle (with the second departure applied, after the rulings) and the scratchpad's reading of the edge passes;
- a naive `seed-firmware.js` that only does a fresh install: C.begin, makeNode and addTags for each node, relationships by type, records, one entry.

What that showed:
- **The target suite: 29 of 30 passed before the rulings, and 30 of 31 after** (ST4's departure, ST17's fixed order and ST31 included). ST29 failed both times because the stub doesn't export `installName`. So the suite's expectations are consistent with an oracle-built target, and its problem cases with a reader that names files.
- **The route suite: 16 of 32 passed** where the stub does what they ask: SF1–SF4, SF6, SF7, SF10, SF12, SF18, SF24, SF25, SF27–SF30 and SF32.
  - Once SF18 was fixed (below), 15 passed. After the rulings, the same 15 passed, SF3 among them with the three concept graphs as create-concept made them.
  - The rest failed on what the stub leaves out: the b claim, the installed-firmware graph, status, updates, take by key, first contact (now its 9 kept and 450 unchanged), `_common.js`'s words and the docs.
  - None crashed.
- **The agent suite** got through the install, the lookup of dog's header and the repeat, over the external CLI and the new server hook, and failed at the update, as the stub has none.
- **Three faults in the tests,** since fixed:
  - SF11 gave a misleading message when the installed-firmware graph was missing;
  - SF13 crashed reading it;
  - SF18 passed on an update that did nothing; it now asserts the update changed something.
- **The fresh install took 3.0 s** in the harness. The run of the route suite against the stub took 34 s, most of it the stub builder's slow path search.

**Suite times:**
- *At Test Design, failing:* about 1.2 s for all seven suites.
- *Expected once implemented, if the install writes about one statement a node:* about 25–35 s. Most of that is the route suite's six installs: fresh, update, take, first contact and its repeats. Then the agent suite (about 5 s), the target and plan suites (about 2 s each), and the record suite (0.3 s).
- *Measured at Implementation:* 23 s in all (below).

**At Implementation** (2026-11-20, at `e18fc03d`, the implementation uncommitted in the worktree), after the live check's finding (the fixture now skips an enumeration with no enumerating element; L1 reads which pass 3b applied). Each suite ran alone, `tmp/a10-37/env.sh` sourced (every endpoint dead, the dead conf):

```
RESULT seed-firmware-oracles.test.js {"pass":8,"fail":0,"skipped":0} 0.1s
RESULT seed-firmware-target.test.js {"pass":31,"fail":0,"skipped":0} 1.2s
RESULT seed-firmware-plan.test.js {"pass":8,"fail":0,"skipped":0} 0.5s
RESULT seed-firmware.test.js {"pass":32,"fail":0,"skipped":0} 15.5s
RESULT seed-firmware-record.test.js {"pass":4,"fail":0,"skipped":0} 0.3s
RESULT seed-firmware-agent-through-cli.test.js {"pass":1,"fail":0,"skipped":0} 5.4s
RESULT seed-firmware-live.test.js {"pass":0,"fail":0,"skipped":4} 0.0s
```

`status.test.js`, its P3 re-aimed to Decision 12 at Implementation, passes 9 of 9.

**Amendment 3's tests** (2026-11-21, on `A10.37-seed-firmware` at `d2c7a6c8`: the implementation, review round 1 and Amendment 3, with these tests uncommitted beside it). The new tests fail with the current code. Each suite ran alone, `tmp/a10-37/env.sh` sourced:

```
seed-firmware-oracles.test.js             8 passed,  0 failed, 0 skipped   1 s
seed-firmware-target.test.js             32 passed,  1 failed, 0 skipped   1 s    ST32 fails; ST33 passes (a guard)
seed-firmware-plan.test.js                8 passed,  1 failed, 0 skipped   1 s    SP9
seed-firmware.test.js                    27 passed, 11 failed, 0 skipped  25 s
seed-firmware-record.test.js              4 passed,  2 failed, 0 skipped   1 s    SR5, SR6
seed-firmware-agent-through-cli.test.js   1 passed,  0 failed, 0 skipped   5 s
seed-firmware-live.test.js                0 passed,  0 failed, 4 skipped   0 s
status.test.js                            9 passed,  0 failed, 0 skipped   1 s
```

The 15 failures, by item, each test's first failing message:

```
item 1–2  SF33  status reads the installed-firmware graph through the store: seeded 1.0.0, no node edited since; got null
item 2    SP9   40 of the 40 supersets whose wordTypes differ only in order aren't unchanged; the first: [["node-type-superset","kept"], …]
item 3    SF1   it declares address-held (409); got [ the six refusals ]
          SF2   its refusals include address-held; got [ … "no-assistant","busy","graph-unavailable"]
          SF8   one node at 39999:dd…dd:installed-firmware; got 0
          SF11  one installed-firmware graph; got 0
          SF13  and the installed-firmware graph, at 39999:dd…dd:installed-firmware; no node is there
          SF34  the admin's element keeps its tags, its JSON among them: seed-firmware neither reads it as its record nor rewrites it; got {"now":[json …],"was":[json …]}
          SF35  held-no-mark is refused 409 address-held; got 200 {"success":true, …}
item 4    SF36  dog-breed's ENUMERATES, its paths edited is listed in installedFirmware.keptRelationships; got undefined
          SF37  it is listed in installedFirmware.keptRelationships; got undefined
item 5    ST32  the alias "IS THE CONCEPT GRAPH FOR" is a problem: the builder must not take it; got no problem
          SF38  alias is refused 409 firmware-unreadable; got 500 {"error":"lifecycle seed-firmware failed: a relationship type that isn't a plain name: \"IS THE CONCEPT GRAPH FOR\"","code":"failed"}
item 6    SR5   i1 has no install record, so its own installed section stays as it is; got undefined
          SR6   c1's own cameFrom section stays as it is; got undefined
```

What the failures show:
- SF34 shows Blocking 2 on today's code: the first run reads the admin's element as its record and rewrites its JSON.
- SF37's first assertion already passes: first contact keeps the edited ENUMERATES with noRecord. It fails only on the listing.
- ST33, the tripwire, passes with today's digests.

**Each can pass, together with the rest.** A copy of the tree in the session's scratchpad (never the worktree) ran every suite against a throwaway stub of items 1–6, in `_seed.js`, `seed-firmware.js`, `target.js`, the word and set derivers, `schema-verdicts.js` and `_schemas.js`. What the stub did:
- the reserved address, and the json read through `tapestry-resolve`;
- `word.wordTypes` sorted in the content's digest;
- the mark checked when the state is read (`address-held` otherwise), and an `installed` record written on the installed-firmware graph;
- kept relationships listed apart, read back, and reported kept;
- the alias checked in the builder;
- the record's sections added only when the node carries them, with the judge told so.

The results:
- *With all six stubbed,* every suite passed: target 33/0, plan 9/0, oracles 8/0, record 6/0, route 38/0 (21 s), agent 1/0, live 4 skipped, status 9/0. So the new tests ask nothing the existing ones contradict.
- *With items 1–4 only,* the route suite passed 37 of 38, and SF38 failed.
- *One fault in the tests, fixed before this record:* SF36 and SF37 crashed building their own messages (`show(undefined)`).

**Review round 2's tests** (2026-11-21, on `A10.37-seed-firmware` at `5bc55fbd`: round 2's review and its doc fixes, with these tests uncommitted beside it). Each suite ran alone, `tmp/a10-37/env.sh` sourced:

```
seed-firmware-oracles.test.js             8 passed, 0 failed, 0 skipped   0 s
seed-firmware-target.test.js             33 passed, 0 failed, 0 skipped   2 s    ST33, with pass 3c's route, passes (a guard)
seed-firmware-plan.test.js                9 passed, 0 failed, 0 skipped   0 s
seed-firmware.test.js                    38 passed, 1 failed, 0 skipped  21 s    SF39
seed-firmware-record.test.js              8 passed, 1 failed, 0 skipped   5 s    SR7; SR8 and SR9 pass (guards)
seed-firmware-agent-through-cli.test.js   1 passed, 0 failed, 0 skipped   6 s
seed-firmware-live.test.js                0 passed, 0 failed, 4 skipped   0 s
status.test.js                            9 passed, 0 failed, 0 skipped   0 s
```

The two failures, each test's first failing message:

```
R2-N1  SR7   rover, recorded, its json offloaded: graph add-to-concept puts it in gadget, whose schema closes its top level, the record's sections set aside (checkElements); got 400 {"error":"The element's JSON doesn't fit the JSON schema of \"gadget\" (39998:dd…dd:gadget): `cameFrom` isn't a field the schema takes; `installed` isn't a field the schema takes.","code":"invalid-fields"}
nit 1  SF39  it says the node is seed-firmware's own installed-firmware graph, whose JSON can't be read (an lmdb: reference with no entry); got The node at 39999:dd…dd:installed-firmware (tapestryKey …) isn't seed-firmware's record of what it installed: it lacks seed-firmware's mark, …
```

What else the round showed:
- *SR7's other cases, on today's code:* string, inline, is added and fits; n1 is refused naming `installed`; and update-node on the offloaded installed-firmware graph is refused naming `installed`. So only the two recorded, offloaded cases fail.
- *Each can pass, together with the rest.* A scratchpad copy of the tree (never the worktree) ran every suite with a throwaway stub: `fits` and the rule's write form take a `record`; add-to-concept and update-node pass the node's `recordCarried`; and the plan words a marked graph whose JSON can't be read. Every suite passed: route 39/0, record 9/0, and the rest as above.
- *The tripwire trips.* In the same copy, a one-word change to `handleWireImplicitElements` failed ST33, naming `src/api/normalize/index.js`'s `handleWireImplicitElements (pass 3c)` and `src/firmware/target.js`.
