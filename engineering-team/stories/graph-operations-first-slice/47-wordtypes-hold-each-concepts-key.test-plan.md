# Test Plan: Story 47 — A node's `wordTypes` hold the key of each concept it belongs to

**Story:** `engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0047-wordtypes-hold-each-concepts-key.md`
**Date:** 2026-11-20

## Coverage map

Every suite here is stack-free. The suites under `test/operations/rules/` run through `test/operations.test.js`, which runs every suite under `test/operations/` itself. `test/firmware-nodes-hold-their-concepts-keys.test.js` is registered in `test/registry.js`. The live checks are the plan's, run at Implementation on a scratch stack (below).

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC1: the rule, report only | WT1 the loader finds it: name, summary, `refuses: false`, no refusals, `violations` and `scan` | `test/operations/rules/word-types-hold-concept-keys.test.js` | unit (the real rule, in a child, over a seeded fake graph) |
| AC1: the rulebook entry | WT8 entry 12 in the entry format: only reports, `rules check`, the rule's file, enforced, ADR 0047; Says cites D10; Check names `no-json` and `unreadable-json`; Repair names a reinstall | same | unit (the document) |
| AC1: the graph rule item | WT9 its element file, rule 12, made by the generator, whose `--check` passes | same | unit |
| AC1: the item reaches the rule list | GB2–GB6 twelve entries, one item and one file each; GF9 one element per rule; IS4, IS8 and IS10 Pass 1b looks up and keeps in line twelve elements | `test/graph-rules-builder.test.js`, `test/graph-rule-firmware.test.js`, `test/firmware-element-sync.test.js` | unit |
| AC1: nothing changes | WC9 check and repair change nothing and record nothing | `test/operations/rules/word-types-check-and-repair.test.js` | integration (the real catalog over a fake graph) |
| AC2: what it finds | WT2 the graph's scan; WT3 the nine findings and five unjudged nodes, and the rule restated agrees; WT5 the view: sections kept beside supply keys, unreached keys and reserved keys aren't judged, only string entries of a list count | `word-types-hold-concept-keys.test.js` | unit |
| AC2: a finding's facts | WT4 code, node, the one concept (firmware's marked), key, no fix, a choice naming a reinstall; WC2 as check answers it | both rule suites | unit, integration |
| AC2: once per key, two concepts | WT3 and WT4 walker's two findings; WC3 two ids; WC4 the sort and the three-part cursor walk both | both | unit, integration |
| AC2: no JSON told apart | WC1 `notJudged`; WC5 mute's scope (judged 0, `notJudged` no-json) against rex's (judged 1) | `word-types-check-and-repair.test.js` | integration |
| AC2: scopes | WT6 a concept's scan (header, core nodes, sets, what they reach) and a node's; WC5 hound's and four nodes'; WT7 items naming nothing judgeable | both | unit, integration |
| AC2: repair says how to go on | WC7 repair over a scope leaves each finding with why and the way on; WC8 repair by id finds a node's second finding, a stale id is `changed-since-check` naming the finding now, a gone one is `nothing-to-repair` | `word-types-check-and-repair.test.js` | integration |
| AC2: both rules | WC6 rules left out run both; CK5 the same, from rule 11's suite | `word-types-check-and-repair.test.js`, `test/operations/rules/check.test.js` | integration |
| AC2: the declarations | WC10 check declares `notJudged` (required) and a finding's `key`; its description names both rules; repair's names this one | `word-types-check-and-repair.test.js` | integration |
| AC3: firmware's files say the keys | FN2 every `json-schema.json` holds `[word, validationTool, jsonSchema]`; FN3 each installed header holds `[word, conceptHeader]` and the keys the manifest's `existing-nodes` imply, the eight named; FN4 the constant follows the manifest's `existing-sets`; FN5 every JSON schema fits validation tool's schema | `test/firmware-nodes-hold-their-concepts-keys.test.js` | unit (files) |
| AC3, AC5: the install writes them | FN8 the old create-concept route takes `wordTypes`, with or without `overwrite`, and refuses a bad list 400; FN9 Pass 1a passes each header file's word types, with `overwrite: true` | same | unit (the route's code in a sandbox; Pass 1 in a child) |
| AC4: a new concept reports nothing | FN1 the constant; FN6 no `['word', 'jsonSchema']` left in `src/`, each of the seven writers uses the constant; FN7 the old create-concept route's JSON schema; FN10 `graph create-concept`'s JSON schema | same | unit, integration |
| AC4, AC6: through the agent | XW1 the agent makes a concept and a check of it names nothing; an element made to lack its key is named once; repair leaves it; with the key back, nothing | `test/operations/rules/word-types-agent-through-cli.test.js` | integration (the real external CLI against the real catalog over a fake graph) |
| AC3, AC5, AC6 on a real install | LF, LB, LA (below) | the live check, on a scratch stack | live |

### Changes to existing suites

- **The rule list.** Rule 12 joins the three suites that pin every rule by name, as story 45 should have done for its third (ledger row `2026-11-20-element-sync-misses-rule-eleven`):
  - `graph-rules-builder`: `REAL`, and GB2's twelve entries;
  - `graph-rule-firmware`: `RULES`;
  - `firmware-element-sync`: `SCENARIO`, and IS10's `others`.
- **Story 45's suites name their rule.** With a second rule that has a scan, leaving `rules` out runs both (ADR 0047 Decision 5). So the requests of `check.test.js` (all but the refusals'), `repair.test.js`'s `findingsOn` and `rules-agent-through-cli.test.js`'s two checks now name `property-has-one-parent`, and check what they checked before. CK5 asks a new request, `graph-all`, to leave rules out, and expects both rules. These pass on today's code, CK5 aside.
- **`test/helpers/todaysCreateConcept.js`.** The sandbox gives the route `firmware.JSON_SCHEMA_WORD_TYPES`, and the bare name too, read from the real module, so story 16's suites keep working once the route uses it. `runCreateConcept({ body, ta })` runs the route with any body and answers its status, whether or not it made the concept. `todaysConcept` is unchanged.
- **`test/helpers/pass1bChild.js`** prints `createConcept`, each Pass 1a call's `dTag`, `wordTypes` and `overwrite`. Its other output is unchanged.
- **`test/helpers/wordTypesGraph.js`,** new: the seed, and the rule restated in plain JavaScript (`missingKeys`, `scopeKeys`). The seed refuses to build unless the restated rule finds exactly the findings and unjudged nodes it names.

## Edge cases

- [x] A node two concepts reach, lacking both keys: two findings, two ids, and paging between them skips neither (WT3, WC3, WC4).
- [x] A node in a set below another concept's superset: `show hound` under `hound` (WT3: champ and half champ).
- [x] Sections kept beside another author's letter supply their keys through the view (WT5: beside).
- [x] A key for a concept that doesn't reach the node isn't judged (WT5: extraKey; beside's `cat`).
- [x] The reserved keys, `word` and `graphContext`, are never expected (WT5, WT7: wordOnly, ctxOnly).
- [x] `wordTypes` not a list, entries not strings, a word block with no `wordTypes`, no word block (WT5).
- [x] No JSON; two `json` tags that differ; a tag that doesn't parse; a tag holding a list; kept-beside sections that aren't JSON (WT3, WC1, WC5).
- [x] A node with no JSON that nothing is expected of gives no entry at all (WC5: wordOnly).
- [x] A node with no `TapestryNode` label, and a change entry, aren't scanned (WT2, WT7).
- [x] A JSON schema reached through validation tool's superset (WT3: houndSchema), and one already holding both keys (petSchema).
- [x] A concept header made an element of graph type (WT3: cngHeader).
- [x] A repair of one violation that names a node's second finding (WC8).
- [x] A stale violation, after the node gained one of its two keys (WC8).
- [x] `wordTypes` given to the old route with duplicates, without `word` and `conceptHeader`, and with `overwrite` (FN8).
- [x] `wordTypes` that isn't a list of key-shaped strings: a string, a name with a space, a number, a null, an object (FN8).
- [ ] An `lmdb:` pointer as a node's `json` tag. `F.readJson` resolves one, and its own suites cover it. None of the four measured instances holds one, so this plan doesn't seed one.
- [ ] Production's 152 class-thread elements with no `TapestryNode` label. The rule doesn't see them, as no operation's read does (WT2's unlabelled node), which the ADR records.

## Test infrastructure

- **Test framework:** Node's own runner, each suite's `run()`. A run's result is read per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
- **Concept Graph API:** none. Every suite here is stack-free. The live checks run on a scratch stack, never on this Mac's agent-memory instance (`tapestry`, `:7778`).
- **Firmware state:** none for the stack-free suites; they read firmware's files from the checkout. The live checks run firmware installs on the scratch stack (below).
- **Fixtures:**
  - `test/helpers/wordTypesGraph.js`'s seed: hand-built from an empty graph, every node named in its header.
  - Story 18's graph (`test/helpers/propertyGraph.js`'s `seedProperties`), given a validation tool concept whose superset holds json schema's (XW1).
  - Story 16's graph (`test/helpers/conceptGraph.js`'s `seedConcepts`) for FN10.
  - The old create-concept route's own code in a sandbox (`test/helpers/todaysCreateConcept.js`) for FN7 and FN8.
  - Pass 1 in a child (`test/helpers/pass1bChild.js`) for FN9.
- **For the Implementer:**
  - The rule's reads run on `test/helpers/pathCypherFake.js`, a subset of Cypher. It has no map literal, no arithmetic, no undirected relationship and no path variable, and only the types in `test/helpers/graphFake.js`'s `PATH_READ_TYPES`; every type the rule walks is there. The reads the ADR implies were tried on the seed, 2026-11-20, and all ran: the graph's scan, a concept's core nodes by one type list, its sets, its elements, the `UNWIND` read of `json` tags with `collect(DISTINCT …)`, `F.conceptsOfNodes` and `K.headersByKey`.
  - The old route reaches the constant as `firmware.JSON_SCHEMA_WORD_TYPES`, or the bare name. FN6 looks for the name `JSON_SCHEMA_WORD_TYPES` in each writer's function.
  - An unjudged entry is `{ item, unjudged: true, code, message }` (WT3 reads `item.node`).
  - The changed-since-check message names the finding's id as it is now, and doesn't say "parents" (WC8). Rule 11's RP7 asks only for the id.
  - Run `node src/firmware/graph-rules.js` after writing entry 12, then `--check`.

## How to run

Never the full `npm test` on this Mac: about 40 suites reach the agent-memory instance. Run each suite with every endpoint dead:
- a folder first on `PATH` holding a stub `curl` (exit 7) and a stub `docker` (exit 1);
- `BRAINSTORM_CONF_PATH` set to a conf whose `NEO4J_URI` is `bolt://127.0.0.1:9`;
- `TAPESTRY_CONTAINER=no-such-container`, `BRAINSTORM_BASE_URL=http://127.0.0.1:9` and `TAPESTRY_PORT=9`.

The new and changed suites, one at a time:

```
node test/operations/rules/word-types-hold-concept-keys.test.js
node test/operations/rules/word-types-check-and-repair.test.js
node test/operations/rules/word-types-agent-through-cli.test.js
node test/operations/rules/check.test.js
node test/operations/rules/repair.test.js
node test/operations/rules/rules-agent-through-cli.test.js
node test/graph-rules-builder.test.js
node test/graph-rule-firmware.test.js
node test/firmware-element-sync.test.js
node test/firmware-nodes-hold-their-concepts-keys.test.js
```

**The scoped gate for Implementation and Review,** through `test/helpers/gateRunner.js`'s `runGate` with that environment:
- CI's registry entries for an operations change: `operations.test.js` (which runs every suite under `test/operations/`, so list it or them, never both), `external-cli.test.js`, `openapi-coverage.test.js`, `admin-action-sweep.test.js` and `schema-save-finds-the-right-header.test.js`;
- the rule list: `graph-rules-builder`, `graph-rule-firmware` and `firmware-element-sync`;
- this story's own: `firmware-nodes-hold-their-concepts-keys`;
- the suites that read firmware's schema files: `neo4j-property-firmware`, `profile-tags` (a live-API suite, which skips with no stack) and `event-tagging-firmware-seed`;
- the suites that share the changed helpers, all green on today's code (2026-11-20): `test/operations/graph/create-concept.test.js` (23), `concept-names.test.js` (5), `create-element.test.js` (39) and `update-node.test.js` (46), all inside `operations.test.js`.

`stack-free-npm-test` stays CI's: its G2 runs against a live control panel when one answers.

**The live check,** on a scratch stack (`scripts/scratch-stack.sh`), never the agent-memory instance. Its record goes in `tmp/live-check-47/`, which git ignores, and its results in the story's Evidence.

1. **LF, a fresh install of this branch.** Boot a scratch stack whose image or mount holds this branch's `src/` and `firmware/`. Apply the uniqueness rules a set-up instance has, then install firmware. Then:
   - `GET /api/tapestry/rules/check?scope=graph&rules=word-types-hold-concept-keys&limit=200` through the loopback names none of firmware's nodes: no firmware concept's header, no core node of one, and no firmware element (AC3);
   - every firmware JSON schema holds `validationTool`, and the eight headers hold their keys;
   - rule 12's graph rule item is installed, found by its name.
2. **LB, before.** Boot a scratch stack from staging's image, with its own code, and install its firmware. Then:
   - `tmp/wordtypes-measure/extract.js`, read-only in the container, finds what the four instances showed: each JSON schema lacking `validationTool`, and the eight headers lacking their keys;
   - with this branch's `src/` copied in and the control panel restarted, the check names those nodes (AC2: "On a fresh install of today's firmware …").
3. **LA, after a reinstall.** Copy this branch's `firmware/` in and reinstall. Then:
   - the check names none of firmware's nodes;
   - those nodes gain their keys and nothing else of theirs changes, compared field by field with LB's extract (AC5).
4. **LA2, a new concept.** `graph create-concept`, then a check of it, names nothing (AC4).
5. **LA3, the agent.** An admin agent with its own key, through the external CLI and with no change to it, runs `rules check` for this rule: a node made to lack a key is named, then not once it has the key (AC6).

## Verification

The new tests fail with the current code, each for want of what the story builds; the changed suites pass but for the one assertion that waits on the new rule. Confirmed on 2026-11-20 at commit `acd8b88b` (the ADR's) with the test changes in the working tree, every endpoint dead:

```
operations: rule word-types-hold-concept-keys: 0 passed, 10 failed, 0 skipped
  WT1–WT7  rule word-types-hold-concept-keys isn't loaded: src/operations/rules/word-types-hold-concept-keys.js does not exist yet (ADR graph-operations-first-slice/0047 Decision 1)
  WT8      docs/GRAPH_RULES.md has entry 12, `## 12. \`word-types-hold-concept-keys\`` (Decision 7)
  WT9      firmware's graph rule concept holds an element for it: firmware/versions/v1.0.0/concepts/graph-rule/elements/word-types-hold-concept-keys.json (node src/firmware/graph-rules.js makes it)
  WT10     docs/GRAPH_OPERATIONS_CATALOG.md's check row names both rules it runs; got "| `check` | … Partial: built for the rule `property-has-one-parent` …"
operations: rules check and repair run word-types-hold-concept-keys: 0 passed, 10 failed, 0 skipped
  WC1–WC5, WC7–WC9  … must answer 200; got 400 {"success":false,"error":"There is no rule \"word-types-hold-concept-keys\". …"}
  WC6      left out, rules are every rule with a scan: property-has-one-parent and word-types-hold-concept-keys; got ["property-has-one-parent"]
  WC10     check's result declares notJudged, required; got {"required":["scope","rules","judged","found","violations","cursor"]}
operations: an admin agent checks word types through the external CLI: 0 passed, 1 failed, 0 skipped
  XW1      src/operations/rules/word-types-hold-concept-keys.js does not exist yet (ADR graph-operations-first-slice/0047 Decision 1): the external CLI exited 1
operations: rules check: 10 passed, 1 failed, 0 skipped
  CK5      left out, rules are every rule with a scan: property-has-one-parent and word-types-hold-concept-keys; got ["property-has-one-parent"]
operations: rules repair: 16 passed, 0 failed, 0 skipped
operations: an admin agent repairs a property hung under two parents through the external CLI: 1 passed, 0 failed, 0 skipped
graph-rules-builder: 21 passed, 5 failed, 0 skipped
  GB2–GB6  an item (or entry, or file) for word-types-hold-concept-keys
graph-rule-firmware: 12 passed, 1 failed, 4 skipped
  GF9      one element per rule; got […eleven files…]
firmware-element-sync: 20 passed, 1 failed, 0 skipped
  IS8      all 12 elements were looked up, the ones after the failure included; got 11
firmware-nodes-hold-their-concepts-keys: 0 passed, 10 failed, 0 skipped
  FN1      src/api/normalize/firmware.js exports JSON_SCHEMA_WORD_TYPES, a list (ADR 0047 Decision 8); got undefined
  FN2      46 differ: class-thread: ["word","jsonSchema"]; …
  FN3      8 differ: json-schema: ["word","conceptHeader"], not ["word","conceptHeader","validationToolType"]; …
  FN4      the constant exists (FN1)
  FN5      38 don't: class-thread: `word.wordTypes` must contain at least 1 valid item(s); …
  FN6      these files still do: ["src/api/normalize/index.js","src/api/property/index.js","src/operations/catalog/graph/_concepts.js"]
  FN7      its word types are ["word","validationTool","jsonSchema"]; got ["word","jsonSchema"]
  FN8      with {"wordTypes":["word","conceptHeader","graphType"]}, the header's word types are ["word","conceptHeader","graphType"]; got ["word","conceptHeader"]
  FN9      41 don't: node-type: {"wordTypes":null,"overwrite":true}, not {"wordTypes":["word","conceptHeader"],"overwrite":true}; …
  FN10     its word types are ["word","validationTool","jsonSchema"] (ADR 0047 Decision 8); got ["word","jsonSchema"]
```

GF9's four skips are its live checks, which need a scratch container.

**Found while writing the tests:** eight of firmware's 46 `json-schema.json` files already hold `validationTool`, as `["word", "jsonSchema", "validationTool"]`: dog, graph rule, image, image type, image validation script, relationship type, tapestry and word. The install never writes a file's word block, so on every instance those schemas lack the key too, as the measurement found. FN2 holds all 46 to the ADR's coarse-to-fine order, `["word", "validationTool", "jsonSchema"]`, so the eight are reordered. Keeping the files' order instead is a one-word change to the ADR and this plan, the owner's call at this gate.

## Amendments

1. **XW1 gives Brown Betty a description (Implementation, 2026-11-20).** `graph create-concept`'s starter schema requires `description` on its elements, so XW1's `graph create-element --fields '{}'` was refused `invalid-fields` ("`teapot.description` is required") before any check ran. The test now passes `{"description":"A round brown teapot."}`, as the other agent-through-CLI suites do. It was a fixture's input: no assertion changed, and the step it fixes comes after the check of the new concept (AC4), which had already passed.
2. **The scoped gate is derived from the changed files, not listed by hand (review round 1, 2026-11-21).** The list above missed `create-concept-duplicate-check.test.js`. That suite is stack-free and in the registry, and its S2 reads `src/firmware/install.js`'s create-concept call, which this story changes; review round 1's Blocking 1 is that S2. From now on the gate is CI's registry entries for an operations change (`operations.test.js`, `external-cli`, `openapi-coverage`, `openapi-document`, `admin-action-sweep`, `concepts-list-shows-concepts-with-no-event`), plus every registered suite whose source names a changed file or what it is built from. On 2026-11-21 that was 37 suites:
   - the source files: `firmware/install`, `normalize/index`, `normalize/firmware`, `api/property`, `graph/_concepts`, `catalog/rules`, `operations/rules`;
   - the functions: `handleCreateConcept`, `handleSaveSchema`, `handleNormalizeSkeleton`, `handleNormalizeJson`, `handleGenerateJsonSchema`;
   - firmware's `json-schema.json` and `concept-header.json`;
   - the helpers `todaysCreateConcept`, `pass1bChild` and `saveSchemaChild`;
   - `graph-rules`, `GRAPH_RULES` and `GRAPH_OPERATIONS_CATALOG`.

   The list is in the session's record of the round 2 gate. Story 46's suite, `word-elements-fit-the-installed-word-schema.test.js`, reached the branch with staging's merge and is among them.
3. **FN11 holds save-schema's fallback by what it writes (review round 1, non-blocking 3, 2026-11-21).** FN6 reads five of the seven writers' source, and one of the review's mutations, a save-schema fallback dropping `validationTool` with the constant's name still in place, got past every suite. FN11 runs the real save-schema in `test/helpers/saveSchemaChild.js` over a teapot whose schema node's JSON has no word wrapper, and holds the wrapper it writes to the constant. It fails on that mutation and passes on the code. The same was tried for `skeleton` and `normalize/json`, and the fake graph can't run their reads: skeleton reads over `IS_THE_CORE_GRAPH_FOR`, which the child doesn't serve. normalize/json's header read names a variable `desc`, which the fake reads as the keyword DESC, and it reads over `IS_THE_CORE_GRAPH_FOR` too. Run in the child, that route answers 500, "expected ), met DESC" (review round 2, non-blocking 2, corrected this reason: an earlier draft said it sorts with `ORDER BY … DESC`, and it sorts nothing). The property route's generator isn't a route the child registers. So those three stay held by FN6's reading of their source, which the suite's header now says.
