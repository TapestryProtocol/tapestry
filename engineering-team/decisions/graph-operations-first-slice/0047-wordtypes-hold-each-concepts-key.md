# ADR 0047: A node's `wordTypes` hold the key of each concept it belongs to: the rule `word-types-hold-concept-keys`, which `rules check` runs, and the keys firmware's nodes and each new JSON schema get

**Status:** Accepted
**Date:** 2026-11-20
**Story:** `engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.md`

## Context

The story asks for two things, in one story, as the owner chose at its planning:

- **Part one, the check (AC1, AC2).** A rulebook entry 12: a node's `wordTypes` hold the key of each concept whose class thread reaches it, `word` and `graphContext` aside. `rules check` names each node that lacks a key, once for each key, over a node, a concept or the whole graph. It reports only and judges every author's nodes. A node whose JSON has no word block, or no `wordTypes`, lacks every key. A node with no JSON to judge isn't named as lacking one, and the answer tells such nodes apart from those that hold their keys. `rules repair` offers no fix for these findings and says how to go on.
- **Part two, the keys (AC3 to AC5).**
  - After a fresh install, the check names none of firmware's nodes. Each concept's JSON schema holds `validationTool`; the headers of concept graph, core nodes graph, property tree graph and tapestry hold `graphType`; word's and image's hold `nodeType`; json schema's and image validation script's hold `validationToolType`.
  - A concept made by `graph create-concept`, or by today's routes that make a concept's JSON schema, reports nothing.
  - A reinstall mends firmware's nodes on an instance installed before.
- **AC6.** An agent runs the check through the external CLI.

The facts this design rests on, read on staging's `bcbd7468`:

1. **The rule contract.** A rule is one file in `src/operations/rules/`, exporting `{ name, summary, refuses, refusals, violations(items, read) }` and, for a check, `scan(read, scope)`, which lists the items a check over a scope judges (`src/operations/rules/index.js:6-19`; ADR 0045 Decision 2). `rules check` runs every rule that has a `scan` when `rules` is left out (`src/operations/catalog/rules/_rules.js:66-81`). Today only `property-has-one-parent` has one.
2. **What `rules check` and `rules repair` share,** `src/operations/catalog/rules/_rules.js`. Three parts of it assume one finding per node and rule, which held for rule 11 and won't for this rule, which names a node once for each key it lacks:
   - **The id.** A finding's id hashes `{ code, node, parents }` (`idOf`, `:97-102`; ADR 0045 Decision 3). Two findings on one node for two concepts would share an id.
   - **The cursor.** Check sorts findings by node, then rule, and pages from the last finding's `[node, rule]` (`check.js:57-62`). A page that ends between a node's two findings skips the second.
   - **Repair's lookup.** For one violation, repair takes the node's first finding and compares its id (`repair.js:141-146`). A violation naming a node's second finding would be refused `changed-since-check` when nothing changed.
3. **Which concepts reach a node.** `F.conceptsOfNodes(read, keys)` (`src/operations/catalog/graph/_fields.js:432-452`) walks from each node back through `HAS_ELEMENT`, `IS_A_SUPERSET_OF*0..` and `IS_THE_CONCEPT_FOR` to every concept header (`ConceptHeader` or `ListHeader`). It is the walk rule 8 and the field mapping use. `K.headersByKey(read, keys)` (`_concepts.js:447`) gives each header's key, `oKeys.singular`, else the key its singular name gives (`headerOf`, `:409-422`). `RESERVED_KEYS` is `['word', 'graphContext']` (`_elements.js:81`). Like every operation's read, these find nodes labelled `TapestryNode`.
4. **A node's JSON as the writes keep it.**
   - **The `json` tag.** `F.readJson(raw)` (`_fields.js:101-111`) reads it: inline, or an `lmdb:` pointer resolved through the store. It names a problem for a missing tag, a pointer whose entry is gone, or text that doesn't parse.
   - **Sections kept beside.** The owner's sections kept beside another author's letter, or firmware's definition, are in `tapestryOwnSections`. `F.ownSectionsOf` reads them (`:139-147`), and `F.overlaySections` lays them over the JSON and appends their keys to `wordTypes` (`:122-133`).
   - **Who reads it this way.** The writes, the field mapping and the derive step all read a node so. `M.jsonOf` (`_memberships.js:310-338`) builds the same view for one node, but refuses where a check must report.
   - **Today's instances.** None of the four measured holds a node with sections kept beside, or a `json` tag that is an `lmdb:` pointer.
5. **The cached copy, tapestryJson, can be missing or stale.**
   - The word deriver starts from the node's cached copy when it has one, else its `json` tag (`getExistingWordJson`, `src/lib/derivers/word.js:52-73`). D10 says as much: "Today's code doesn't meet the rule yet."
   - `regenerateJson`, through which the old routes and the install rewrite a letter, re-signs and re-imports it and leaves the cached copy as it was (`src/api/normalize/helpers.js:124-152`).
   - The set deriver rewrites a set's `wordTypes` (`src/lib/derivers/set.js:98-105`).
   - david.tapestry.ninja's cache holds none of its 6,880 nodes: the cache sits on no volume (BIBLE §29).
6. **Where firmware's nodes get their word types at install** (`src/firmware/install.js`). Firmware's files' word blocks are never installed today:
   - **Pass 1a** calls `POST /api/normalize/create-concept` with the header file's `conceptHeader` section and `overwrite: true` (`:196-203`). The route writes the header's word types as `['word', 'conceptHeader']` and the starter schema's as `['word', 'jsonSchema']`, both fixed (`src/api/normalize/index.js:1254-1260`, `:1370-1376`). On a reinstall, `overwrite` rebuilds them the same way.
   - **Pass 2** sends `save-schema` only the file's `jsonSchema` section (`install.js:1031`). The route keeps the node's word block and replaces `jsonSchema` (`index.js:2037-2056`).
   - **Pass 1c** wires the eight headers into node type, graph type and validation tool type with `POST /api/normalize/add-node-as-element` (`install.js:330-410`). That route adds `HAS_ELEMENT` and rebuilds the concept graph's JSON, never the node's word types, and answers 409 on a repeat (`index.js:3929-4005`).
   - **Pass 1c½** makes json schema's superset a set of validation tool's (the manifest's `sets.validation-tools`; `install.js:491`). So validation tool's class thread reaches each JSON schema only after Pass 1a has made them.
7. **The seven writers of a JSON schema's word block**, all writing `['word', 'jsonSchema']`:
   - `graph create-concept`, `src/operations/catalog/graph/_concepts.js:214`;
   - `POST /api/normalize/skeleton`, `src/api/normalize/index.js:434`;
   - `POST /api/normalize/json`, `:952`, `:969` and the default at `:978`;
   - `POST /api/normalize/create-concept`, `:1375`;
   - `save-schema`'s fallback wrapper, `:2050`;
   - `src/api/property/index.js:175`, the schema generator.

   The property operations keep the schema node's JSON and replace only `jsonSchema` (`_properties.js:856-859`), so they keep whatever word types it holds.
8. **`graph create-concept` already names its core nodes' superconcepts.** Its lists are literal and coarse to fine: a superset is `['word', 'set', 'superset']`, a primary property `['word', 'property', 'primaryProperty']`, a properties set `['word', 'set', 'propertiesSet']`, each graph `['word', 'graph', …]` (`_concepts.js:183-318`; memberships `:50-59`). Each matches the concepts firmware's manifest makes its role's concept a set of. The JSON schema's list is the one that misses one: validation tool.
9. **The order is free.** No code reads `wordTypes` by position or compares the whole list (searched `src/`, `ui/src/`, `scripts/`). The nostr import gives role labels from five keys only (`src/operations/catalog/import/_letters.js:45`), none of them added here. `word`'s schema calls the list "Ordered list of word types from coarse to fine".
10. **The manifest's wiring of headers** (`firmware/versions/v1.0.0/manifest.json`, `elements.<category>.existing-nodes`, every entry a `concept-header`):
    - node-types: word, image;
    - graph-types: core nodes graph, concept graph, property tree graph, tapestry;
    - validation-tool-types: json schema, image validation script;
    - dog-breeds: golden retriever and irish setter, two concepts the manifest doesn't install (41 of the 46 concept folders are installed).
11. **The rule list is pinned.**
    - Three suites name every rule: `test/graph-rules-builder.test.js`, `test/graph-rule-firmware.test.js` and `test/firmware-element-sync.test.js`.
    - `node src/firmware/graph-rules.js` makes each entry's graph rule item from the rulebook and the rule's code, and a stack-free test fails until it has run.
    - The item reaches an instance at its next firmware install. The rule's code runs without it.
12. **The measurement** (the story's table, 2026-11-20). Read from the stored JSON, the check would name:

    | | david.tapestry.ninja | staging | production | this Mac |
    |---|---|---|---|---|
    | Named, reading the stored JSON | 79 | 58 | 53 | 71 |
    | Named, reading the tapestryJson the derive step would build | 101 | 82 | 92 | 97 |

    The difference is mostly the assistant's relationship records, which have no JSON at all; derived, they would lack `relationship`.

## Options considered

### Part one: the check

#### Option A: a rule that reads the node's JSON as the writes keep it, with a scan, run by `rules check` (chosen)

The rule reads each node's `json` tag with its kept-beside sections laid over, as the writes and the derive step read a node (fact 4). It compares that JSON's `word.wordTypes` with the keys of the concepts whose class thread reaches the node (fact 3).

- **Pros:** The stored JSON is where the writes put the key and where a letter carries it, so the check names the writer that left it out. It is always there to read, unlike david.tapestry.ninja's cache, and it changes the moment a writer or a reinstall fixes it (fact 5). A node with no JSON is a node with no `wordTypes` to judge, which the answer can say plainly.
- **Cons:**
  - It doesn't see the derive step's set rewrite. That drops nothing today, as the story measured.
  - It reads a different document from rule 7, which judges tapestryJson (ADR 0020a). That is the right document for a schema, which describes `graphContext` too. The word types are written in the stored JSON and only copied into tapestryJson.
  - Three small generalizations of `rules check` and `rules repair` are needed (fact 2).

#### Option B: the same rule, reading tapestryJson as the tapestry-store holds it

Rule 7's document, with a node not yet derived reported as missing, as rule 7 reports it.

- **Pros:** One document for both rules, and it would catch the set deriver's rewrite.
- **Cons:**
  - On david.tapestry.ninja every node would be named missing until a derive pass.
  - After a reinstall the cached word blocks stay stale, since the derive step starts from them (fact 5), so AC5 would fail until each cache entry was rebuilt from its JSON (A10.36).
  - The 22 to 38 relationship records on each instance would be named once derived, which AC3 would then need fixed too.

#### Option C: each concept's schema carries the requirement, as validation tool's does

The owner ruled this out at planning: findings show in `rules check`, report only, and no schema verdict changes.

### Part two: the keys

#### Option D: firmware's files and every JSON-schema writer state the keys; the install writes what the files say; a stack-free test ties them to the manifest (chosen)

- **JSON schemas.** One constant for a JSON schema's word types, `['word', 'validationTool', 'jsonSchema']`, used by all seven writers (fact 7). Firmware's `json-schema.json` files say the same.
- **The eight headers.** Their `concept-header.json` files gain the keys the manifest's `existing-nodes` imply (fact 10). Pass 1a hands the old create-concept route each header file's word types, and the route writes them.
- **The pin.** A stack-free test checks the files and the constant against the manifest's wiring.
- **Pros:**
  - The smallest change at each writer: one line each, the cheap kind the owner's D15 allows in old routes.
  - It follows `graph create-concept`'s own pattern of naming superconcepts in the list (fact 8).
  - A reinstall mends firmware's nodes, because `overwrite` rebuilds every firmware header and JSON schema through the same route (fact 6).
  - The files say what is installed, which ADR 0043's releases, built from firmware's files, will need.
- **Cons:**
  - The fact "a JSON schema is a validation tool" is stated in two places, the manifest's wiring and the constant. The test holds them together, and the rule names any instance whose graph disagrees.

#### Option E: the install computes firmware nodes' keys from the graph after its wiring

A new step after Pass 1c½ gives each firmware node the keys of the concepts that reach it, through `regenerateJson`.

- **Pros:** The keys are "computed from the edges" (D10), for any wiring.
- **Cons:**
  - It fixes only the install, so `graph create-concept` and the old routes still need Option D's change (AC4).
  - It re-signs about fifty nodes on every install, after Pass 1a's rebuild has re-signed them once.
  - The graph says what firmware's files don't.

#### Option F: every writer computes the keys from the instance's graph at write time, as `graph create-element` does

- **Pros:** D10 to the letter, on each instance's own graph.
- **Cons:**
  - A read inside seven writers, four of them old routes D15 asks to touch lightly.
  - On a fresh install it can't work: Pass 1a makes the JSON schemas before Pass 1c½ wires json schema under validation tool (fact 6). So the install would still need Option D or E.

## Decision

We chose **Option A** for the check and **Option D** for the keys.

- **The check.** The stored JSON is where word types are written and where a fix lands at once, and it is readable on every instance today. Option B would make AC5 fail on stale caches and AC3 wait on records with no JSON.
- **The keys.** Option D makes one-line changes where the word types are written, and keeps firmware's files true to what is installed. Option E fixes only the install, and Option F can't work on a fresh install.

### Decision 1: the rule, `src/operations/rules/word-types-hold-concept-keys.js`

- `name: 'word-types-hold-concept-keys'`.
- `summary`: "A node's wordTypes hold the key of each concept whose class thread reaches it (design D10), word and graphContext aside. It only reports."
- `refuses: false`, `refusals: []`.
- Items are `{ node }`, a tapestryKey, as rules 7, 8 and 11 take them. `scan` (Decision 3) lists them, and `violations(items, read)` judges them (Decisions 2 and 4).
- It requires what it reads with only when `scan` or `violations` runs, as every rule does. Every read goes through `read`, each over all its items at once:
  1. the concepts that reach each node, `F.conceptsOfNodes`;
  2. their headers, `K.headersByKey`;
  3. the nodes, with their `json` tags and `tapestryOwnSections`, in one `UNWIND`.
- A concept whose key is reserved, or can't be read, isn't expected of anyone. A node that only `word` reaches is judged for nothing and given no entry.

### Decision 2: the JSON it judges

The node's **view**: its `json` tag read with `F.readJson`, with its `tapestryOwnSections` read with `F.ownSectionsOf` and laid over with `F.overlaySections`. That is exactly the view `M.jsonOf` builds and the derive step starts from when there is no cache (fact 4).

- **No JSON.** A node with neither a `json` tag nor sections kept beside it has no JSON to judge (`no-json`).
- **Unreadable JSON.** A node whose JSON can't be read is named apart (`unreadable-json`). That covers: two `json` tags that differ, a tag `F.readJson` names a problem for, sections `F.ownSectionsOf` names a problem for, or JSON that isn't an object.
- **Its word types.** The view's `word.wordTypes` when it is a list, else the empty list. So a view with no word block, or no `wordTypes`, lacks every key (AC2).
- Only string entries are matched. Order and extra keys aren't judged.

### Decision 3: `scan`, the nodes in a scope

Each scope's nodes are labelled `TapestryNode`, not `GraphChange` or `NostrEventTag`, and are taken once, sorted. Aliases come from `K.rel()`.

- **`graph`:** every node a class thread reaches: `(h)-[:INIT]->(:Superset)-[:PROP*0..]->()-[:TERM]->(e)`, with `h` a `ConceptHeader` or `ListHeader`.
- **A concept** (its header's tapestryKey):
  - the header itself;
  - its seven other core nodes: the superset by `INIT`, and the nodes joined to the header by `SCHEMA`, `PRIMARY`, `PROPERTIES`, `TREE`, `CORE` and `GRAPH`;
  - the sets of its class thread, `(sup)-[:PROP*1..]->(s)`;
  - the nodes its class thread reaches.

  Each core node is an element of firmware's concepts, so "rules check over the new concept" judges what AC4 names.
- **A node:** that node.

### Decision 4: what it reports

**A finding**, one for each key a node lacks:

```
{ item, code: 'missing-concept-key', message,
  node: { tapestryKey, name, address, author, own },            // as reads answer a node (reads.js C3)
  concepts: [{ tapestryKey, name, address, own, firmware }],    // the one concept whose key it lacks, shaped as rule 11's
  key: '<the key>', fix: null,
  choice: { why, wayOn } }
```

- **The message** names the node, the concept by its name and the key, and quotes the node's `wordTypes`, such as: `"JSON schema for the concept of repositories" is an element of "validation tool", whose key validationTool its wordTypes, ["word","jsonSchema"], lack.`
- **`firmware`** is `K.isFirmware(header address)`.
- **`choice.why`** says that the rule only reports, and that no operation gives a node a key it lacks.
- **`choice.wayOn`** says how to go on: a firmware reinstall gives firmware's nodes their keys; for any other node, a repair for this rule is a follow-up. `graph add-to-concept` adds a key only along with the concept's section, to a node that holds none. The wording is the Implementer's, and must stay true to those cases.

**A node it couldn't judge** is an entry `{ item, unjudged: true, code: 'no-json' | 'unreadable-json', message }`. It is not a finding (Decision 5), and is given only for a node some concept other than `word` reaches.

### Decision 5: `rules check` tells the two apart, and pages a node's several findings (amends ADR 0045 Decisions 3 and 5)

- **What isn't judged.** `findingsIn` (`_rules.js:83-94`) keeps every entry with `unjudged: true` out of the findings and tallies it instead. It returns `{ judged, findings, notJudged }`. `judged` counts the items each rule judged: its scan's items less those it couldn't. `notJudged` is `[{ rule, why, count }]`, by rule, then `why`, across the whole check, as `judged` and `found` are. Check's answer carries `notJudged`: always present, empty when nothing went unjudged, and declared in its result.
- **The id.** `idOf`'s digest also covers `key` and the tapestryKeys of `concepts` when a finding carries a string `key`. So two keys on one node give two ids. Rule 11's findings carry no `key`, so their ids are unchanged.
- **The answer.** `answerOf` passes `key` through (null when absent), and `FINDING` gains `key: { type: 'string', nullable: true }`.
- **Sort and cursor.** Findings are sorted by the node's tapestryKey, then rule, then id. A cursor's position is the last finding's `[node, rule, id]`, and check's `isPosition` and its filter (`check.js:57-62`) take three strings. A cursor in the old two-string shape is refused `invalid-cursor`, as any cursor from another read is.
- **Its description** names both rules it runs.

### Decision 6: `rules repair` finds a violation by its id, and leaves this rule's findings (amends ADR 0045 Decision 6)

- **Not judged.** Both judgments, and the re-judgment of fixed nodes, drop entries with `unjudged: true`.
- **One violation.** Repair finds it among the node's findings by its id: `now.find((x) => idOf(x) === inputs.violation)`.
  - None for the node: `nothing-to-repair`, as today.
  - Some for the node, none with that id: `changed-since-check`, naming the node's first finding's id as it is now. Its message stops saying "parents", which is rule 11's word, and says the node breaks the rule differently now.
- **This rule's findings** carry `fix: null`, so repair leaves each with its `why` and `wayOn`: outcome `left`. Over a scope, every finding goes in `left`, and no change entry is recorded.

### Decision 7: the rulebook entry and the graph rule item

`docs/GRAPH_RULES.md` gains entry 12, `` ## 12. `word-types-hold-concept-keys` ``, with the eight fields:

- **Says:** Decision 2's rule, citing D10's "Membership" line.
- **Kind:** a graph rule; as a check it judges every node a class thread reaches, whoever made it.
- **Refuses or reports:** it only reports.
- **Check:** Decisions 3 to 5, with what isn't judged.
- **Repair:** none yet; a firmware reinstall gives firmware's nodes their keys.
- **Enforced by:** a check, `rules check`, and the rule's file.
- **Status:** enforced.
- **Source:** this ADR.

Then `node src/firmware/graph-rules.js` makes its item, and `--check` passes. Any line that lists what `rules check` runs, its description and the catalog's §4 Rules row among them, names the new rule beside rule 11.

### Decision 8: a JSON schema's word types: one constant, every writer

`src/api/normalize/firmware.js` exports `JSON_SCHEMA_WORD_TYPES = Object.freeze(['word', 'validationTool', 'jsonSchema'])`, coarse to fine as fact 9 allows.

- **The writers.** Each of the seven writers (fact 7) writes a copy of it in place of `['word', 'jsonSchema']`, `:978`'s default included.
- **Firmware's files.** The `word.wordTypes` of every `firmware/versions/v1.0.0/concepts/*/json-schema.json` (46 files, through a script) equal it.
- **Fresh install.** Pass 1a makes every JSON schema with the key, before any cache exists, so each fits validation tool's schema (AC3).
- **Reinstall.** Pass 1a's `overwrite` rebuilds firmware's, and Pass 2 keeps that word block (AC5).

### Decision 9: the eight headers: their files say their keys, and the install writes them

- **The files.** The eight `concept-header.json` files of the concepts the manifest installs gain their keys in `word.wordTypes`: `nodeType` (word, image), `graphType` (core-nodes-graph, concept-graph, property-tree-graph, tapestry), `validationToolType` (json-schema, image-validation-script). Golden retriever's and irish setter's files are outside the manifest and stay as they are.
- **Pass 1a** (`install.js:196`) adds `wordTypes: header.word.wordTypes` to its create-concept body.
- **`POST /api/normalize/create-concept`** takes an optional `wordTypes`. When given, it must be a list of strings, each a key's form (`/^[a-z][A-Za-z0-9]*$/`); otherwise the route answers 400, saying so, and makes nothing. The header's word types are `['word', 'conceptHeader']` followed by the list's other entries, once each, in the order given. Without it, the route writes `['word', 'conceptHeader']` as today.
- **Fresh install and reinstall alike** build each header with its keys in one write, since a reinstall's `overwrite` rebuilds it (AC3, AC5).

### Decision 10: what holds the two parts together: a stack-free test of firmware's files and the constant against the manifest

For the Tester to write, at Test Design. For the concepts the manifest installs, it holds:

- each header file's word types are `['word', 'conceptHeader']` plus exactly the keys of the concepts whose `elements.<category>.existing-nodes` name that concept's header (the category's concept, `categoryToSlug`, read for its key);
- each `json-schema.json`'s word types equal `JSON_SCHEMA_WORD_TYPES`;
- the constant's keys between `word` and `jsonSchema` are exactly the keys of the concepts whose `sets.<category>.existing-sets` chains reach json schema, transitively, `word` aside.

A later wiring that adds a superconcept to json schema, or a header to a category, fails it until the files and the constant follow.

## Consequences

- **What it enables.**
  - `rules check` finds a node whose word types don't say what the graph says, from firmware, an import, an old route or raw Cypher.
  - A fresh install, and every new concept, reports nothing for it.
  - Validation tool's schema stops failing every JSON schema, which very likely clears P-158's "validation tool, 44 of 44" on a fresh install.
- **`rules check` and `rules repair` grow, for every later rule.** A finding may carry a `key`, a rule may say what it couldn't judge, and several findings per node page and repair correctly. Check's answer gains `notJudged`, and its cursor changes shape.
- **What stays.**
  - The JSON schemas of concepts each instance made before this story still lack `validationTool`, and are named: david.tapestry.ninja 23, staging 6, production 5, this Mac 10. Giving them the key is a follow-up (the story's out of scope), as is a repair for this rule.
  - On an instance installed before, the cached tapestryJson of firmware's nodes keeps its old word block after the reinstall, since the derive step starts from it (fact 5). This rule, reading the stored JSON, sees the fix at once. Rule 7's cached verdicts on those nodes clear only once their cache entries are rebuilt from their JSON (A10.36, `cache rebuild`).
  - The old `POST /api/normalize/json` rebuilds a header's word block as `['word', 'conceptHeader']` (`index.js:876-884`). Run on one of the eight, it drops its key, and the rule names it. Nothing calls it but a person (D15 leaves it).
- **What it doesn't see.**
  - The rule sees only nodes labelled `TapestryNode`, as every operation's read does. Production's 152 class-thread elements without that label are invisible to it, a side finding filed apart (ledger row `2026-11-17-walk-skips-unlabelled-keyed-nodes`).
  - The set deriver's rewrite is unseen: it drops nothing today.
- **Firmware reinstall required? Yes**, for each instance's firmware nodes to gain their keys (AC5), and for the graph rule concept's new item. The check runs without one. Each reinstall comes after the merge, on the owner's yes. The future `lifecycle seed-firmware` (A10.37) and ADR 0043's releases build on the same files.

## Implementation notes

**Part one:**

- **New: `src/operations/rules/word-types-hold-concept-keys.js`** (Decisions 1 to 4).
  - `scan(read, scope)` takes `{ kind: 'graph' }`, `{ kind: 'concept', key }` or `{ kind: 'node', key }`.
  - `violations(items, read)` returns findings and `unjudged` entries.
  - It reuses `require('../catalog/graph/_fields')` (`conceptsOfNodes`, `readJson`, `ownSectionsOf`, `overlaySections`), `require('../catalog/graph/_concepts')` (`headersByKey`, `isFirmware`, `rel`), `RESERVED_KEYS` from `_elements.js`, and a node's answer as `reads.js` builds one, its `own` from the instance's own keys.
- **`src/operations/catalog/rules/_rules.js`** (Decision 5): `findingsIn` returns `notJudged` and sorts by id third; `idOf` covers `key` and the concepts when a finding has a `key`; `answerOf` passes `key`; `FINDING` gains `key`; export the `notJudged` item schema.
- **`src/operations/catalog/rules/check.js`** (Decision 5): `notJudged` in the result, required; the three-part cursor; the description names both rules.
- **`src/operations/catalog/rules/repair.js`** (Decision 6): drop `unjudged` entries; find a violation by its id; the message; the description says this rule's findings are left, with the way on.
- **`docs/GRAPH_RULES.md`** (Decision 7): entry 12, then `node src/firmware/graph-rules.js` and `--check`, which add its element file under `firmware/versions/v1.0.0/concepts/graph-rule/elements/`. The item is looked up by its name; its address carries a hash.
- **`docs/GRAPH_OPERATIONS_CATALOG.md`** §4 Rules: `check`'s row says which rules it runs, if it names any.

**Part two:**

- **`src/api/normalize/firmware.js`:** export `JSON_SCHEMA_WORD_TYPES` (Decision 8).
- **The seven writers** (Decision 8): `src/operations/catalog/graph/_concepts.js:214`; `src/api/normalize/index.js:434`, `:952`, `:969`, `:978`, `:1375`, `:2050`; `src/api/property/index.js:175`. Each writes `[...JSON_SCHEMA_WORD_TYPES]`.
- **`src/api/normalize/index.js` `handleCreateConcept`** (`:1217`): the optional `wordTypes`, and the 400 (Decision 9).
- **`src/firmware/install.js` Pass 1a** (`:196`): pass `wordTypes` (Decision 9).
- **Firmware's files,** edited by a script, never by hand, and the script kept out of the repo:
  - 46 `json-schema.json` word blocks;
  - eight `concept-header.json` word blocks: `word`, `image`, `core-nodes-graph`, `concept-graph`, `property-tree-graph`, `tapestry`, `json-schema`, `image-validation-script`.

**For the Tester (Phase 3; test-file changes are the Tester's, never the Implementer's):**

- **The rule list.**
  - Add the rule to the three suites that pin it (fact 11): `graph-rules-builder`'s `REAL` and its count, `graph-rule-firmware`'s `RULES`, and `firmware-element-sync`'s `SCENARIO` and IS10's `others`.
  - Put all three in the scoped gate. Story 45 missed the third, and staging went red until hotfix #165 (ledger row `2026-11-20-element-sync-misses-rule-eleven`).
- **Story 45's suites that leave `rules` out now run both rules:** `test/operations/rules/check.test.js` (CK1, CK5, CK7's cursor), `repair.test.js` and `rules-agent-through-cli.test.js`. Pin them to `property-has-one-parent`, or give their seed what this rule reads. Then add the new answer field and cursor shape.
- **The new rule's suite,** stack-free over a seed as story 45's are:
  - one key missing, two missing, all held;
  - a key for a concept that doesn't reach the node;
  - no word block; no JSON (`no-json`); unreadable JSON (`unreadable-json`);
  - sections kept beside, whose overlay supplies the key;
  - a reserved key;
  - each scope's nodes, a concept's core nodes included;
  - ids, the sort and the three-part cursor across a node's two findings;
  - repair: left, by id, `nothing-to-repair`, and `changed-since-check` after a key changes.
- **The firmware pin:** Decision 10's stack-free suite.
- **The writers:**
  - each of the seven makes a JSON schema whose word types are the constant;
  - `create-concept` with and without `wordTypes`, and its 400;
  - Pass 1a passes the file's list.
- **The CI registry entries for an operations change:** `operations.test.js` (not its suites again), `external-cli.test.js`, `openapi-coverage.test.js`, `admin-action-sweep.test.js` and `schema-save-finds-the-right-header.test.js`. Also the firmware and graph-rule suites above.
- **The live check, on a scratch stack:**
  - **AC3:** a fresh install of this branch's firmware, then `rules check` over the graph names none of firmware's nodes.
  - **AC4:** `graph create-concept`, then a check of the new concept.
  - **AC5:** an install of staging's firmware, then a reinstall of this branch's.
  - **AC6:** an admin agent's key through the external CLI: a node made to lack a key, then given it.
  - **Caution:** never against this Mac's agent-memory instance.

## Out of scope

- **A repair for this rule's findings,** and a one-time fix for each instance's own concepts' JSON schemas.
- **Judging the other way round,** a key for a concept that doesn't reach the node, and the order of `wordTypes`.
- **Nodes with no JSON**, and whether they should have JSON (D10's derive question), beyond counting them.
- **Rebuilding cached tapestryJson** after a reinstall (A10.36), and the set deriver's rewrite.
- **The old `normalize/json` route's header rebuild.**
- **Labelling production's 152 unlabelled elements.**
- **Reinstalling firmware anywhere,** which waits for the owner's yes on each instance.

## Amendment 1 (2026-11-21, at review round 2; the owner chose to fix the review's non-blocking findings before the pull request) — the way on names no other operation

Review round 2 (`engineering-team/reviews/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.md`, non-blocking 1) found the way on's sentence about `graph add-to-concept` untrue for a node whose JSON holds no `wordTypes` list: add-to-concept adds keys only to a word block that already holds a list (`src/operations/catalog/graph/add-to-concept.js:179`), so such a node gets the section and no key. Round 1 had found the first wording untrue in another case. The review offered two fixes: drop the sentence, or state every condition. The owner said "Fix findings first" and left the choice, so the Architect picks the first.

1. **`choice.wayOn` names a reinstall and a repair still to come, and no other operation.** It reads: "A firmware reinstall gives firmware's own nodes their keys. For any other node a repair for this rule is still to come." Rulebook entry 12's Repair drops the same sentence, and so does its graph rule item. This replaces Decision 4's "`graph add-to-concept` adds a key only along with the concept's section, to a node that holds none."
2. **Entry 12's "Refuses or reports" says the same thing without a list of writes.** It said the writes "already put the key in", naming `graph create-element`, `graph create-set` and `graph add-to-concept`. That holds for add-to-concept only when the node's JSON holds a list, as item 1's finding shows. It now gives the reason the rule only reports: the owner chose it (2026-11-20, the story's Out of scope).
3. **Why not the second fix.** Whether add-to-concept adds a key turns on the node's JSON: a word block holding a list, the view a node kept beside reads, and whether the node is already directly in the set given. A sentence stating all of that has to be checked again whenever add-to-concept changes, and two rounds have each found a case the wording missed. The way on says what clears a finding. For the nodes with no list, the review's count is 8 on david.tapestry.ninja, 2 on staging and 13 on this Mac, and add-to-concept clears none of them. Saying how such a node gets its key belongs to a repair for this rule, which is out of scope.
4. **What doesn't change.** WT4, WC2, WC7 and XW1 hold that the way on names a reinstall, and it still does. No finding's facts, id or code change.

**Ratification:** to be recorded at the next gate.
