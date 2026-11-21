# Story 47: A node's `wordTypes` hold the key of each concept it belongs to: `rules check` names a node that lacks one, and firmware's nodes and each new concept's JSON schema get theirs

**Status:** Done
**Created:** 2026-11-20
**Type:** Feature
**Loom:** none yet. Filing a proposal related to A10.31 is the owner's call, offered once this story is approved (the intake entry).

## Background

At story graph-operations-first-slice #46's planning, the owner dropped the wordType pair that install writes for `word.wordTypes`, which compares the list with itself and so checks nothing. The owner then asked whether the check worth making is made anywhere: "I presume that at some point, somewhere, we do, in fact, want to check whether (the expected string) is in (the existing array)." And on its scope: "Adding new tests can be for another day and another session." This is that session. The request is queued in `engineering-team/stories/_intake.md` ("Nothing checks that a node's `wordTypes` hold the key of each concept it belongs to", 2026-11-20). That entry lands with story 46's pull request; until then it is commit `3dce3f00` on branch `fix/word-wordtypes-conditionals`.

The facts, each re-checked on staging's `79c8a098` (2026-11-20):

- **Membership is the edges.** The design's D10 says: "edges are the authority on which concepts a node belongs to; the JSON's `wordTypes` and `coreMemberOf` are computed from them." A node belongs to every concept whose class thread reaches it (rulebook entries 7 and 8). A concept's key is its `oKeys.singular`, the key its elements' sections are filed under.
- **The writes put the key in.**
  - `graph create-element` writes `wordTypes` as `word` and the key of each concept whose class thread reaches the element.
  - `graph create-set` writes `word`, `set` and the key of each other concept the set is an element of.
  - `graph add-to-concept` adds the concept's key, and `graph remove-from-concept` takes it out. For a node kept beside another author's letter, the key joins `wordTypes` in the JSON the derive step reads, not in the letter.
- **Almost nothing checks it.**
  - Validation tool's schema requires its elements' `wordTypes` to contain `validationTool`.
  - Firmware `dog`'s schema ties `wordTypes` to the value of `dog.breed`. That is a check on a field's value, not on membership.
  - No graph rule checks it (`docs/GRAPH_RULES.md`, `src/operations/rules/`), nor does the derive step or the audit (`src/api/audit/`). So a node left out of line by an import, an old route or raw Cypher goes unnamed.
- **The derive step rewrites a set's `wordTypes`** as `["word", "set"]`, or `["word", "superset", "set"]` for a superset (`src/lib/derivers/set.js:98-105`). That would drop any other concept key `graph create-set` wrote, but it drops nothing today: no set on any of the four instances below holds another concept's key in its JSON.
- **Firmware wires core nodes into concepts without their keys.** Firmware's manifest makes:
  - each concept's JSON schema an element of `validation tool`, through `json schema`'s superset, which it makes a set of validation tool's;
  - the headers of `concept graph`, `core nodes graph`, `property tree graph` and `tapestry` elements of `graph type`;
  - the headers of `word` and `image` elements of `node type`;
  - the headers of `json schema` and `image validation script` elements of `validation tool type`.

  Their JSON says only `["word", "jsonSchema"]` and `["word", "conceptHeader"]`. `graph create-concept` gives each new concept's JSON schema `["word", "jsonSchema"]` too (`src/operations/catalog/graph/_concepts.js:214`), and so do the old routes that make a concept's schema (`src/api/normalize/index.js`, `src/api/property/index.js`). So validation tool's own schema fails every JSON schema. That very likely explains Loom P-158's "validation tool, 44 of 44".
- **`rules check` is built, for one rule.** It runs `property-has-one-parent` over a node, a concept or the whole graph (story #45, Loom A10.31.a), and refuses a rule it can't run yet. Running the other rules is the rest of A10.31.

**What the check would flag today.** Measured on 2026-11-20, for every element some concept's class thread reaches, comparing the JSON's `word.wordTypes` with the keys of the concepts that reach it. `word` and `graphContext` aren't judged. Nothing was written.

| | david.tapestry.ninja | staging | production | this Mac's agent-memory instance |
|---|---|---|---|---|
| Elements a class thread reaches | 993 | 516 | 492 | 521 |
| **Named, reading the node's stored JSON** | **79** | **58** | **53** | **71** |
| JSON schemas lacking `validationTool`: of firmware's concepts, of the instance's own | 63: 40, 23 | 46: 40, 6 | 45: 40, 5 | 49: 39, 10 |
| Firmware's concept headers lacking `graphType` (4), `nodeType` (2) or `validationToolType` (2) | 8 | 8 | 8 | 8 |
| JSON with no word block, so no `wordTypes` | 8 | 2 | 0 | 13 |
| Others | none | 2 test tapestries, lacking `graph` and `tapestry` | none | 1 test fixture, the same |
| No JSON at all, so not judged | 44 | 48 | 61 | 48 |
| **Named, reading the tapestryJson the derive step would build from it** | **101** | **82** | **92** | **97** |
| …the extra: nodes with no JSON that would lack a key once derived | 22 | 24 | 39 | 26 |
| Named if the check were keyed on the node's own JSON sections instead of its class threads | 0 | 2 | 0 | 1 |

- **Who made them.** Every node named is the instance's own, made by its assistant.
- **The nodes with no JSON at all** are mostly sets (22 to 24 on each instance) and the assistant's records of a superset's link to a set (22 to 38). The derive step gives such a node `["word"]`, or `["word", "set"]` for a set. So the records would lack `relationship` once derived, and the sets would lack nothing.
- **The nodes whose JSON has no word block** are all the instance's own. On david.tapestry.ninja they are 5 property tree graphs, the glossary entries "concept" and "class thread", and the property "definition".
- **The other way round:** a key for a concept that doesn't reach the node. On each instance, 7 to 10 supersets hold `superset` without being elements of the superset concept, and firmware's dog Rover holds `goldenRetriever` outside golden retriever's thread. This story doesn't judge that way round.
- **How it was read.**
  - david.tapestry.ninja: through its public read routes, with Zeus's `graph list-elements` (point of view everyone) for the class threads.
  - Staging and production: one read-only Neo4j session each, on the owner's yes (2026-11-20). Production's ran twice; the first missed 152 elements that carry no `TapestryNode` label.
  - This Mac's instance: one read-only session in its container.
  - The scripts and each instance's report are in `tmp/wordtypes-measure/` of the drafting worktree, which git ignores.

## User-facing description

As the owner, or an admin agent, I want `rules check` to name each node whose `wordTypes` lack the key of a concept it belongs to, in the whole graph, in one concept or for one node, so that a node's JSON says what the graph says, and a node left out of line by firmware, an import, an old route or raw Cypher is found instead of silently wrong.

As the owner, I want firmware's own nodes, and each new concept's JSON schema, to hold their concepts' keys, so that a fresh install and a new concept report nothing, and the check's findings on an instance are about that instance.

## Acceptance criteria

**Part one: the check, which reports only.**

- [ ] **AC1: The rule.** The rulebook gains entry 12, in its format: a node's `wordTypes` hold the key of each concept whose class thread reaches it, `word` and `graphContext` aside.
  - It only reports. It refuses no write, and no write's answer changes.
  - It judges every author's nodes, whoever made them.
  - Its code is its one definition, which `rules check` runs.
  - Its graph rule item is made from the entry and the code, as every rule's is, and reaches each instance at its next firmware install. The check itself needs no install.
- [ ] **AC2: `rules check` names a node that lacks a key.** Given the owner or an admin is signed in, when they run `rules check` over a node, a concept or the whole graph, naming this rule or no rule, then:
  - each node in the scope that lacks the key of a concept reaching it is named once for each key it lacks, with the node (its tapestryKey, name and address), the concept (its header's tapestryKey and name) and the key;
  - a node two concepts reach, lacking both keys, is named for both;
  - a node holding every key is named for none, and a key in `wordTypes` for a concept that doesn't reach the node isn't judged;
  - a node whose JSON has no `wordTypes`, or no word block, lacks every key of the concepts reaching it;
  - a node with no JSON to judge isn't named as lacking a key, and the answer tells such nodes apart from nodes that hold their keys;
  - nothing changes and nothing is recorded;
  - `rules repair` offers no fix for this rule's findings and says how to go on.
  
  On a fresh install of today's firmware, a check of the whole graph names each concept's JSON schema (for `validationTool`) and the eight concept headers above. AC3 clears them.

**Part two: firmware's nodes, and each new concept's JSON schema, hold their keys.**

- [ ] **AC3: A fresh install reports none of firmware's nodes.** Given a fresh install of this story's firmware, when `rules check` runs this rule over the whole graph, then it names none of firmware's nodes:
  - each concept's JSON schema holds `validationTool`;
  - the headers of concept graph, core nodes graph, property tree graph and tapestry hold `graphType`;
  - word's and image's headers hold `nodeType`;
  - json schema's and image validation script's headers hold `validationToolType`.

  The keys give none of those nodes a new problem against any concept's schema, `word`'s installed one included once story 46's fix is in. Every JSON schema now fits validation tool's schema.
- [ ] **AC4: A new concept reports nothing.** Given an instance with this story's code, when a concept is made by `graph create-concept`, or by today's routes that make a concept's JSON schema, then its JSON schema holds `validationTool`, and `rules check` over the new concept names none of its core nodes for this rule.
- [ ] **AC5: A reinstall mends firmware's nodes on an instance installed before.** Given an instance installed before this story, such as a scratch stack set up as staging's code leaves one, when its firmware is reinstalled with this story's firmware, then:
  - `rules check` names none of firmware's nodes for this rule;
  - the JSON schemas of concepts the instance made itself are still named (out of scope);
  - firmware's nodes gain those keys, and nothing else of theirs changes.
- [ ] **AC6: It reaches agents.** An admin agent with its own key, through the external CLI and with no change to it, runs `rules check` for this rule on a scratch stack:
  - a node made to lack a key is named, and named no more once it has the key;
  - after a reinstall with this story's firmware, nothing of firmware's is named.

  Once the change reaches david.tapestry.ninja and its firmware is reinstalled, on the owner's yes, Zeus's check of the whole graph names nothing of firmware's. What it names is the instance's own, as this story's measurement predicts for the JSON the check reads. Read from the stored JSON, that is the JSON schemas of its own 23 concepts and its 8 nodes whose JSON has no word block.

Six criteria in two parts: the check (AC1, AC2) and firmware's keys (AC3 to AC5), with AC6 for both. They are one story because the owner chose, at this planning, to fix firmware's wiring along with finding it. Split, part two would be story 48, proven by part one's check.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`). It differs on every instance, so it is never written into code.

- Any concept: its class thread and its key (read). The rule judges every element a class thread reaches.
- `39998:<TA>:validation-tool`, validation tool: its schema's check is unchanged; its elements, every concept's JSON schema, gain its key.
- `39998:<TA>:json-schema`, json schema: its elements' `wordTypes` gain `validationTool`, and its header gains `validationToolType`.
- `39998:<TA>:graph-type`, `39998:<TA>:node-type` and `39998:<TA>:validation-tool-type`: their elements, eight concept headers, gain their keys.
- `39998:<TA>:concept-graph`, `core-nodes-graph`, `property-tree-graph`, `tapestry`, `word`, `image` and `image-validation-script`: their headers' `wordTypes` change.
- `39998:<TA>:graph-rule`, graph rule (firmware): gains one item for the new entry, at the next install.
- `39998:<TA>:word`, word: its installed schema's allowed list already holds these keys (story 46). Nothing about it changes.

## Out of scope

- **Refusing a write for it, or a guard in the writes.** It reports only, as the owner chose (2026-11-20). The writes already put the key in.
- **Giving the instance's own nodes their keys:** a repair for this rule's findings, and a one-time fix for the JSON schemas of concepts each instance made before this story (david.tapestry.ninja 23, staging 6, production 5, this Mac 10). After a reinstall the check still names them. That is a follow-up.
- **The other way round:** a key in `wordTypes` for a concept that doesn't reach the node, such as 7 to 10 supersets on each instance and firmware's dog Rover.
- **Nodes with no JSON** (22 to 38 relationship records and 22 to 24 sets on each instance, plus a few from old routes), and whether they should have JSON. That is D10's question about the derive step, unless Architecture's choice of document brings them in (see below).
- **The set deriver's rewrite** of a set's `wordTypes`. It drops nothing today and stays as it is.
- **The order of `wordTypes`** ("from coarse to fine", in `word`'s schema): not judged.
- **`dog`'s breed pair and `word`'s allowed list:** unchanged (story 46).
- **The rest of A10.31:** `rules list-rules`, and running the other rules in `rules check`.
- **Reinstalling firmware** on staging, production, david.tapestry.ninja and the other hosted Tapestries. Each comes after the merge, on the owner's yes.
- **Two side findings from the measurement,** to be filed apart:
  - david.tapestry.ninja's LMDB cache holds no node's tapestryJson (all 6,880 missing, since the cache sits on no volume, BIBLE §29);
  - production holds 152 class-thread elements with a tapestryKey and no `TapestryNode` label: 41 nostr kinds, 36 relationship records, 20 sets, and the rest, which include four concepts' core nodes (ledger row `2026-11-17-walk-skips-unlabelled-keyed-nodes` calls such nodes rare).
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

Resolved at this planning, from the owner's answers (2026-11-20). The owner approved the story as drafted, the drafting's reading of question 3 included (2026-11-20, "Approved, go on").

1. **Where the expected key comes from.** *Resolved: the concepts whose class thread reaches the node*, as D10 says, not the concept sections in the node's own JSON. Keyed on sections, the check would have named 0 to 2 nodes on each instance and never firmware's wiring.
2. **Where it shows.** *Resolved: a finding of `rules check`, report only.* No write is refused, and no schema verdict changes. The other choice was to put it in each concept's schema, as validation tool's is, so every write report and cached verdict would say the node doesn't fit.
3. **Whether the story also fixes what it finds.** *Resolved: it fixes firmware's wiring too*, so a fresh install reports nothing. The drafting reads that as including the writes that make a new concept's JSON schema (AC4), so a concept made after the install reports nothing either. The JSON schemas of concepts each instance already made are left for a follow-up. The drafting had proposed finding only, with the fixes filed apart.
4. **Whether to measure staging and production.** *Resolved: yes*, and they are in the table.

For Architecture, not this gate:

- **The rule's name and its words,** and how it lists the nodes in a scope through their class threads.
- **Which JSON the check reads:** the node's stored JSON (its `json` tag, with the owner's sections kept beside it) or its tapestryJson, as rule 7 reads (ADR graph-operations-first-slice/0020a). The measurement gives both. Two consequences, for the owner at the Architecture gate:
  - on david.tapestry.ninja, whose cache is empty, a check reading tapestryJson would name every node as missing until a derive pass;
  - once derived, the relationship records with no JSON would be judged with `wordTypes` `["word"]`, so AC3 would hold only if they got their key too.
- **How firmware's nodes get their keys:** in firmware's files, or by install computing `wordTypes` from the edges as D10 says. Also, which of today's routes make a concept's JSON schema (AC4).
- **What `rules repair` says for this rule's findings.**

## Deviations

- **Eight firmware files are reordered, not just given a key.** Eight `json-schema.json` files already held `validationTool`, as `["word", "jsonSchema", "validationTool"]`: dog, graph rule, image, image type, image validation script, relationship type, tapestry and word. The install never wrote a file's word block, so on every instance their schemas lacked the key too. Like the other 38, they now hold the constant's order, coarse to fine, which the owner kept at the Test Design gate (2026-11-20).
- **One test's input was wrong, and was amended apart.** XW1's `graph create-element` gave no `description`, which `graph create-concept`'s starter schema requires, so it was refused before the checks it sets up. It now gives one; no assertion changed. That is the test plan's Amendment 1, committed by itself before the implementation.
- **The catalog's repair row says what repair does with this rule's findings too.** The ADR named only the check row.
- **A ledger row tracks the reinstalls.** `ledger/2026-11-20-word-types-keys-await-firmware-reinstall.md` records that each instance's firmware nodes gain their keys, and its graph rule concept its twelfth item, only at a firmware reinstall there, each on the owner's yes.
- **The way on names no other operation (ADR 0047, Amendment 1, 2026-11-21).** Decision 4 had it say that `graph add-to-concept` adds a key along with the concept's section. Review rounds 1 and 2 each found a case where that wording was untrue. Round 2's case was a node whose JSON holds no `wordTypes` list, which gets the section and no key. The way on now names a reinstall, and a repair still to come. Entry 12's "Refuses or reports" no longer lists the writes that put the key in, for the same reason. The finding's `why` no longer says that no operation gives a node a key it lacks (Amendment 1, item 5): add-to-concept can, as when it puts one of the instance's own nodes, whose JSON holds a `wordTypes` list, into one of the concept's sets that it isn't directly in. The Background's "The writes put the key in" and the Out of scope's "The writes already put the key in" overstate add-to-concept in the same way; both are left as planning wrote them.

## Evidence

**The scoped gate, stack-free (2026-11-20).** It ran on `8f5e0149` with the implementation in the working tree (committed as `fbd1aca1`), with every endpoint it gives the suites dead:
- a stub `curl` and `docker` first on `PATH`;
- `BRAINSTORM_CONF_PATH` at a conf whose `NEO4J_URI` is a closed port;
- `TAPESTRY_CONTAINER=no-such-container`.

One suite didn't use them (corrected at review round 2, non-blocking 3). `event-tagging-firmware-seed` GETs `http://localhost:7778` whatever the environment says, and on this Mac that port reaches the agent-memory instance. Its live check made two read-only GETs there, `/api/assistant/pubkey` and `/api/strfry/scan`, and passed. Nothing was written. Review round 1's gate and the gate after its fixes, below, did the same (ledger row `2026-11-08-suite-screen-misses-hardcoded-urls`).

It covered 14 suites:
- CI's registry entries for an operations change: `operations.test.js`, which runs every suite under `test/operations/`, `external-cli`, `openapi-coverage`, `admin-action-sweep` and `schema-save-finds-the-right-header`;
- the rule list: `graph-rules-builder`, `graph-rule-firmware` and `firmware-element-sync`;
- this story's `firmware-nodes-hold-their-concepts-keys`;
- the suites that read firmware's files or run the install: `neo4j-property-firmware`, `profile-tags`, `event-tagging-firmware-seed`, `concepts-list-shows-concepts-with-no-event` and `pass-3-finishes-in-minutes`.

Results:
- **Overall: PASS, 1534 passed, 0 failed, 44 skipped** (record `tmp/gate-runs/20261120T235304Z-73207-0e2c.json`, which git ignores). The skips are the live parts, which need a scratch container.
- One sentence of the rule's finding message changed after the run: its closing full stop, so a repair's refusal reads as rule 11's does. The four suites that read messages ran again and passed: the rule's own 10, check and repair's 10, the agent's 1, and rule 11's repair 16.
- `stack-free-npm-test` is CI's: its G2 runs against a live control panel when one answers.

**The scoped gate after review round 1's fixes (2026-11-21).** It ran on `2a8e8c2b`, with staging merged in (`a7b0aadb`). The suite list was derived from the changed files (test plan, Amendment 2): CI's registry entries for an operations change, the 37 registered suites whose source names a changed file or what it is built from (`create-concept-duplicate-check` and story 46's suite among them), and `ledger-row-ids`. It ran with the same dead endpoints, but with `TAPESTRY_CONTAINER` unset, as CI runs, and `docker` and `curl` stubbed, so nothing reached a container through them. `event-tagging-firmware-seed` made its two read-only GETs to the agent-memory instance, as in the first gate.
- **Overall: PASS, 1951 passed, 0 failed, 166 skipped across 44 suites** (record `tmp/gate-runs/20261121T004946Z-57222-e9ab.json`).
- The skips are live parts that need a stack.
- **What the list missed** (review round 2, non-blocking 4). It was derived at `14a944e7`. The fix commit, `2a8e8c2b`, then changed `src/api/openapi.yaml`, and 15 more registered suites read that file. Review round 2 ran those 15: 613 passed, 5 skipped, none failed.

**The check of review round 2's fixes (2026-11-21).** It ran on `0b22a841` with the fixes in the working tree, committed unchanged as `f860d1b5`, in the same environment as the gate above. Its list was derived at gate time from that round's diff (ledger row `2026-11-21-scoped-gate-lists-built-by-hand`):
- CI's registry entries for an operations change: `operations.test.js`, `external-cli`, `openapi-coverage`, `openapi-document`, `admin-action-sweep` and `concepts-list-shows-concepts-with-no-event`;
- 15 registered suites whose source names what the round changed:
  - the rulebook, the graph rule item or the rule: `graph-rules-builder`, `graph-rule-firmware` and `firmware-element-sync`;
  - the FN suite itself;
  - the ledger or the harness's folders: `harness-lint`, `session-start`, `ledger-row-ids`, `rollup-scanners`, `live-link-checks` and `brains-launcher-repo`;
  - a walk of firmware's element files: `firmware-concept-elements-sets`, `tapestry-per-concept-detail-views`, `add-node-as-element-restore`, `tagging-edges-realtime-engine` and `word-elements-fit-the-installed-word-schema`.
- None of them reads a live URL whatever the environment says. `harness-lint`'s local URLs are lint fixtures, and `session-start`'s stack probe goes through the stubbed `curl`. `event-tagging-firmware-seed` isn't among them.
  - With `TAPESTRY_CONTAINER` unset, `firmware-concept-elements-sets` falls back to the `tapestry` container. Only the `docker` stub kept it off the agent-memory instance; its four skips are the stub's doing (ledger row `2026-11-13-live-suites-have-no-off-switch`).

Results:
- **Overall: PASS, 1844 passed, 0 failed, 26 skipped across 21 suites** (record `tmp/gate-runs/20261121T014937Z-70585-f248.json`).
- The rule's three suites give 10, 10 and 1, as before, and story 45's `rules check` and `rules repair` give 11 and 16. The three rule-list suites give 26, 13 (4 skipped) and 21, and the FN suite 11.
- `node src/firmware/graph-rules.js --check`: the 12 items are current.
- **What it missed** (the fix check of round 2). The round changed a test file, and the list had no suite that scans every test file. `gate-result-record` is one; the fix check ran it, and its 34 pass.

**The check of the fix check's findings (2026-11-21).** The same 21 suites ran on the committed `2af10578`, in the same environment. That round changed no test file and no firmware file, and the suites that read what it changed (the rule's file, the ADR, the story and the ledger) were already listed.
- **Overall: PASS, 1844 passed, 0 failed, 26 skipped across 21 suites** (record `tmp/gate-runs/20261121T021233Z-47671-708f.json`).
- The rule's three suites give 10, 10 and 1 again.

**The live check on a scratch stack (2026-11-20 23:59 to 2026-11-21 00:05 UTC).** Never this Mac's agent-memory instance. The scripts and records are in `tmp/live-check-47/`, which git ignores: `runA.sh` and its log, `setup.sh`, `check.js`, `compare.py`, `edit-wt.js`, `fits.js` and `agent.sh`.
- **Setup.** `scripts/scratch-stack.sh up` ran from a worktree of staging's `c063ecdd`, on image `agent-memory-tapestry:latest`; its boot installs the image's firmware. Then:
  - staging's firmware was copied in;
  - the uniqueness rules a set-up instance has were added (the Dashboard's fix, then `tapestry-keys`);
  - staging's firmware was installed.
- **LB, before (staging's code and firmware).** Read with the measurement's read-only extract: 459 elements, of which 49 lack a key. Those are the 41 JSON schemas, every firmware concept's, lacking `validationTool`, and the eight headers. Nothing else lacks one.
- **LB2, this branch's code (`fbd1aca1`) before a reinstall.** `rules check` names the same 49 nodes, with the same keys. It judged 415, and `notJudged` counted 44 `no-json`: the sets and the assistant's relationship records. That is AC2's "On a fresh install of today's firmware …".
- **LA, after a reinstall with this branch's firmware.** The check names none: 0 found, 416 judged, 44 `no-json` (AC3, AC5). Field by field against LB:
  - each of the 49 gained exactly its key: 41 × `["word","jsonSchema"]` → `["word","validationTool","jsonSchema"]`, 4 × `graphType`, 2 × `nodeType`, 2 × `validationToolType`;
  - nothing else of theirs changed, and no other node's word types changed (AC5);
  - every JSON schema, 42 of 42 (the 41 and teapot's, below), fits validation tool's installed schema, judged with the app's own check (AC3).
- **LA2, a new concept.** `graph create-concept` made teapot, and a check of it found nothing, with its eight core nodes judged (AC4).
- **LA3, the agent (AC6).** An admin agent with its own key used the unchanged external CLI inside the container. It:
  1. signed in as admin;
  2. checked teapot and was told of nothing;
  3. made Brown Betty;
  4. with teapot's key taken out of Brown Betty's `json` tag by hand, checked the graph and was told of Brown Betty once, for `teapot`;
  5. repaired over teapot: the finding was left, with the way on, and nothing was recorded;
  6. with the key back, checked Brown Betty, which was judged and not named.
- **Not covered.**
  - A fresh install of this branch's firmware alone: the scratch script's boot always installs the image's firmware first. The reinstall rebuilds every firmware header and JSON schema with this branch's code and firmware: a JSON schema's word types come from the code's constant, and a header's from its firmware file. So for word types it ends where a fresh install would.
  - The hosted instances: each one's reinstall waits for the owner's yes (ledger row `2026-11-20-word-types-keys-await-firmware-reinstall`).
- The stack was taken down after.

## Linked artifacts
- ADR: `engineering-team/decisions/graph-operations-first-slice/0047-wordtypes-hold-each-concepts-key.md`
- Test plan: `engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.test-plan.md`
- Review: `engineering-team/reviews/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.md`
