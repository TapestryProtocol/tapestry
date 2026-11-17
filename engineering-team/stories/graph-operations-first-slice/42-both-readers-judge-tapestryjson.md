# Story 42: Both readers judge a node's tapestryJson — the rule `element-fits-schema` and the derive step give one verdict

**Status:** Approved
**Created:** 2026-11-17
**Type:** Feature
**Loom:** A10.20.b — https://loom.brainstorm.world/t/A10.20.b

## Background

ADR graph-operations-first-slice/0020a (merged in TapestryProtocol/tapestry#125, Loom A10.20.a) decided which document a concept's JSON Schema describes. It is a node's **tapestryJson**: the JSON the Tapestry LMDB (the tapestry-store, not strfry's LMDB) holds for the node under its tapestryKey. The rule: a node's fully realized tapestryJson validates against the JSON Schema of each concept it is an element of (BIBLE §10's rule 4; the owner's D9). The ADR says both readers judge that one document, through one check, and that firmware's `word` schema stays as it is. Exceptions to the rule, for performance, come later.

At this story's planning (2026-11-17), the owner split the ADR's build in two:
- **This story** makes the readers of a node as it stands judge its tapestryJson, and give one verdict. It also stops the writes reporting `word` as failing for what only the derive step builds.
- **Loom A10.20.c** makes the writes leave their node's tapestryJson up to date, built one concept at a time after they commit, starting with `graph create-element` and `graph update-node`.

What today's instance does, that this story changes:

- **Two readers, two documents.**
  - The rule `element-fits-schema` (rulebook §7) judges a node's `json` tag.
  - The derive step judges the tapestryJson it builds: its existing entry when that has a `word` block, else the `json` tag, else `{}`, with `word` defaults filled in and its own `graphContext` added.

  Their verdicts split, as the ledger row `2026-11-16-derive-step-and-rule-check-split` lists, and test SC9 pins four of the splits.
- **They judge different concepts.** The rule judges each concept whose class thread reaches the node. The derive step judges each concept header whose class thread reaches it within ten links, and each one the node's `z` tags name.
- **Every element of `word` reads as broken.** Firmware's `word` schema requires `graphContext`, which only the derive step builds.
  - Judged as `json` tags, all 83 of firmware's element files fail it, each only for `graphContext` (measured 2026-11-17).
  - Firmware puts seventeen concepts under `word`. On the local instance, `word` has 503 elements.
  - `graph create-set` reports on every create that the new set doesn't fit `word`. `rules check` (A10.31) would report every one of those 503.
- **Not every node has tapestryJson yet.** On the local instance, 80 of 485 list items, 9 of 53 supersets and 9 of 49 concept headers have none (2026-11-17). An element `graph create-element` makes has none until a derive pass runs.
- **No code acts on the derive step's verdicts.** They sit in each node's tapestryJson, as `graphContext.parentJsonSchemas`. A person or an agent sees them through `GET /api/tapestry-key/:key`.

## User-facing description

As the owner, or an agent of an admin working the graph, I want one answer to "does this node fit the schemas of the concepts it belongs to?", judged on the node's tapestryJson, whoever asks. Then `rules check`, the property operations' reports, a write's report and a node's cached verdicts never contradict each other, and the elements of `word` stop reading as broken.

## Acceptance criteria

- [ ] **AC1 — The rule judges a node's tapestryJson.** Take a node whose tapestryJson and `json` tag differ. When the rule checks it as it stands, it judges the tapestryJson. For example, a node whose tapestryJson has its `graphContext` fits firmware's `word` schema, whatever its `json` tag holds. A node whose tapestryJson lacks a field its concept requires doesn't fit, even when its `json` tag has the field.
- [ ] **AC2 — A node with no tapestryJson yet.** When the rule checks an element that has no tapestryJson, it gives one finding for the node, saying it has no tapestryJson yet. It gives no finding for each of its concepts' schemas, and it doesn't fall back to the `json` tag.
- [ ] **AC3 — One verdict, from both readers.** For a node the derive step has built, its cached verdicts and the rule's check of the same node agree on each concept:
  - on whether it fits, doesn't fit, or can't be checked;
  - on the problems, in the rule's words.

  They judge the same concepts: each whose class thread reaches the node. A concept only a `z` tag names is judged by neither. This holds under each of these:
  - firmware's `word` schema, which a node fits once its `graphContext` is built;
  - a schema that forbids extra top-level keys;
  - a `word` block missing a field the derive step fills in;
  - an entry built before the node's `json` tag last changed.
- [ ] **AC4 — A write doesn't fail a node for what the derive step builds.** When `graph create-element`, `graph create-set` or `graph update-node` judges JSON with no `graphContext`, it sets aside every problem that is only about `graphContext`.
  - A concept the JSON misses only for `graphContext` is reported as waiting for the derive step. The write neither reports it as not fitting nor refuses for it.
  - A concept the JSON misses for other things too is reported, or refused, for those things alone.
  - Every other verdict and refusal is as today.

  So a set made by `graph create-set` reports `word` as waiting, not failing.
- [ ] **AC5 — The rulebook says what the rule judges.** The rulebook's entry 7, and rule 7's element in the graph after a firmware reinstall, say that the rule judges a node's fully realized tapestryJson. They also say that a node with no tapestryJson is reported, and that exceptions will come. ADR 0020a reads as accepted.

## Concepts touched

`<TA>` is the instance's assistant (`GET /api/assistant/pubkey`).

- `39998:<TA>:word` — word (read: its schema governs every node's `word` and `graphContext`; it doesn't change).
- `39998:<TA>:graph-rule` — graph rule (rule 7's element, regenerated from the rulebook).
- Any concept, through its header, superset and JSON schema (read: its elements are judged).

## Out of scope

- **Loom A10.20.c:**
  - the writes leaving their node's tapestryJson up to date after they commit, one concept at a time;
  - the derive step rebuilding one section and keeping the others;
  - a `json` tag with no `word` block keeping its sections in tapestryJson;
  - a write's refusal judging the tapestryJson its node will have.
- **Building tapestryJson for nodes that have none.** A firmware reinstall's derive pass and `cache rebuild` (A10.36) do that.
- **`rules check` (A10.31) and the property operations' reports (A10.18) themselves,** and what `rules check` does with a node that has no tapestryJson.
- **The exceptions to the rule,** and where they live.
- **Moving the Health Audit and the concept pages onto tapestryJson.**
- **Changing firmware's `word` schema** (ADR 0020a, Decision 6).
- **Moving the schemas' dialect to draft 2020-12.**

## Open questions

- None that block planning.
- The full test gate writes to the stack it finds, and on the Mac Studio that is the agent-memory instance. So the Tester and Implementer run only the suites they touch there, and the pull request's CI runs the full gate. AC1 to AC4's live checks run on a scratch stack (`scripts/scratch-stack.sh`).

## Deviations

- **`schemaOf` returns `name` and `nodes` with every problem,** not only with "more than one" (ADR 0042, Decision 5). So a concept whose one schema node can't be read still gets a cache entry, with `valid: null`, naming that node. That is the same entry the rule's `no-schema` stands beside.
- **`tapestryJsonOf` is synchronous,** since the store's `get` is. It answers "no node was named" for an empty key.
- **A cache entry leaves out `uuid` when the schema node has none.** Firmware `word`'s schema types it as a string, so a null would break the node's own fit. `schemaVerdicts` also takes an optional `read`.
- **`deriveAll` builds its pass's judge from `runCypher` inline,** with the same read `schema-verdicts.js` makes.
- **GB3's fixture** (`test/graph-rules-builder.test.js`) restated rule 7's old first Says sentence and Source. It was amended in the Tester's lane, in a commit of its own, before the implementation commit; the test plan records it.
- **Firmware:** rule 7's element file was regenerated. Its reinstall on staging and production after merge is ledger row `2026-11-17-rule-seven-rewrite-awaits-firmware-reinstall`.

- **Round 2, from review round 1:**
  - the shared judge drops a failed read;
  - set.js strips its old artifact before the verdicts;
  - the check form's findings give `derivedAt`;
  - the rulebook says `add-to-concept` and the property operations "will call" the check.

  ajv's wrapper errors, such as an `if`/`then` that requires `graphContext`, are still not set aside (non-blocking 7). No firmware schema needs it.
- **AC4's example holds where `word`'s schema is firmware's file,** as the stack-free CS3 has it. On an installed instance, `word` still fails a new set, for install's wordType conditionals (ledger row `2026-11-17-word-wordtypes-conditionals-contradict-themselves`), not for anything this story builds. The set-aside works there too: the live check's LC1 finds `graphContext` set aside and `waiting: true`, with only those conditionals' problems left.

## Evidence

### The suites (round 2, 2026-11-17)

Run on this Mac, each with every service endpoint dead. No full `npm test` ran here: the local stack is the owner's agent-memory instance, and the PR's CI runs the full gate.
- **The gate engine, over the 15 suites this story touches and their neighbours,** at `d1b18ccd` with round 2's fixes in: PASS, 240 passed, 0 failed, 12 live skips (record `20261117T173248Z-23396-c2ad`). Before round 2, at `6ba85124`: 239 passed (records `20261117T165844Z-73843-1a76`, and the reviewer's own `20261117T170855Z-77871-5a99`).
- **harness-lint** is clean, and `node src/firmware/graph-rules.js --check` finds rule 7's file current.

### The live check (round 2, 2026-11-17, on `6ead878a`)

It ran on a throwaway instance from `scripts/scratch-stack.sh`, never a shared or private one. Every call went through `test/helpers/scratchLoopback.js`, which refuses any container not named `tapestry-scratch…`. The script and every call's request and answer are in this worktree's `tmp/live-check-42/` (ignored by git): `live.js`, `report.json`, `pass-3.log` and `graph-rule-firmware.log`.
- **The instance.** It booted from image `agent-memory-tapestry:latest`, with this branch's `src/` mounted. The image's firmware differed from the branch's (digests `4610d6d4fdc8` and `06c0aa2b2e7f`). The branch's was copied in, the control panel restarted, and the firmware installed again, after which the digests matched.
- **The calls** went through `docker exec` to `127.0.0.1:7778`, as the trusted local operator. The rule's check form ran inside the container, with the app's own modules, store and database, as `rules check` will run it.

**By check, 14 of 14 passed** (the second run of `live.js`; the first showed a fault in the script, and a premise of LC7c set too broadly, below):
- **LC1a (AC4).** `graph create-set` under firmware dog's superset reports:
  - the set concept fitting, with `waiting: false`;
  - `word` with `waiting: true`, its problems about `graphContext` set aside.
- **LC1b.** What `word` still finds in the new set's JSON is install's wordType conditionals alone, four problems, a defect that predates this story (Deviations; its ledger row).
- **LC2 and LC3 (AC3).** The set derived by `POST /api/tapestry-key/derive/:key` has entries in today's shape. It fits the set concept, and nothing `word` finds is about the `graphContext` the derive step built. The rule's check of the set, on the stored tapestryJson, agrees with the cache on every concept, in the same words.
- **LC4 (AC2).**
  - `graph create-concept` made "live hound", and `graph create-element` made Rex in it, fitting and waiting for nothing.
  - Rex keeps its json tag node (ADR 0020a Decision 9).
  - Before a derive, the rule's check gives one `invalid-fields` finding, marked `missing`, naming no concept.
  - After a derive it finds nothing, and the cache says Rex fits.
- **LC5 (AC1).** With Rex's entry put without its section's description, though its json tag has it, the rule finds the missing description, and gives the entry's `derivedAt`, 1700000000.
- **LC6.** The relay's event count was the same before and after: none of these writes signed.
- **LC7a.** `POST /api/tapestry-key/derive-all/ListItem`: 444 derived, 0 errors, in 1.8 s.
- **LC7b (AC3, over real firmware).** Over all 444 list items with an entry, 1,169 verdicts, the cache and the rule agree on every one.
- **LC7c.** No cached `word` verdict says `graphContext` is missing, the split this story ends. What `word` does find: 1,096 wordType-conditional errors and 1,140 "then" errors (ledger row `2026-11-17-word-wordtypes-conditionals-contradict-themselves`). There were also 132 set-field errors on the 43 Properties Set nodes, which are derived as words (ledger row `2026-11-17-properties-set-nodes-derived-as-words`).
- **LC8 (AC5).** After the reinstall, rule 7's item in the graph says it judges a node's fully realized tapestryJson, and which writes will call it.

**What the first run showed:**
- **A fault in the script:** it read `create-concept`'s answer as `concept.tapestryKey`, not `concept.conceptHeader`, so `create-element` was refused `missing-input`.
- **LC7c, first written as "no `word` verdict mentions `graphContext`":** it counted the Properties Set nodes' set fields as the old split. It now counts only "`graphContext` is required".

**The live suites, on the same instance** (`TAPESTRY_CONTAINER=tapestry-scratch`):
- **`test/pass-3-finishes-in-minutes.test.js` on the small graph** (3,571 nodes): 12 passed, 0 failed.
  - L5a passes with its oracle moved to the rule's concept set: each rebuilt node's `parentJsonSchemas` lists the schemas of the concepts whose class threads reach it.
  - L1, L2 and L5c pass too.
- **The same suite at staging's shape** (`test/helpers/seedStagingShape.js`, 150 s; 3,851,583 nodes), with `PASS3_INSTALL=1`: 13 passed, 0 failed.
  - **L3:** rebuilding one node of each label by key, the median of three, took ListItem 63 ms, ListHeader 8, ConceptHeader 43, JSONSchema 57, Property 39, Set 51 and Superset 40. That is at most 200 ms each. Inside `derive-all`, ConceptHeader took 5 ms each.
  - **L4:** a firmware install took 55 s before Pass 3, and Pass 3 took 10 s in all, under its 10-minute limit; the install completed.
  - **L2b:** every label reads derived = total afterwards.
  - **L5b:** not run, since it needs a container that has had one install; this one had had four.
- **`test/graph-rule-firmware.test.js`,** with `GRAPH_RULE_INSTALL=1`: 17 passed, 0 failed. GL1 to GL3 find the graph rule concept and an item per rule, each holding its committed file's JSON, rule 7's new text among them. GL4 finds a second install signs nothing new.
- **Afterwards** the instance was removed with `scripts/scratch-stack.sh down`, after checking that it mounted this worktree's `src/`.

## Linked artifacts

- Decision: ADR graph-operations-first-slice/0020a (`engineering-team/decisions/graph-operations-first-slice/0020a-the-document-a-schema-describes.md`)
- ADR: `engineering-team/decisions/graph-operations-first-slice/0042-both-readers-judge-tapestryjson.md`
- Test plan: `engineering-team/stories/graph-operations-first-slice/42-both-readers-judge-tapestryjson.test-plan.md`
- Review: `engineering-team/reviews/graph-operations-first-slice/42-both-readers-judge-tapestryjson.md`

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
