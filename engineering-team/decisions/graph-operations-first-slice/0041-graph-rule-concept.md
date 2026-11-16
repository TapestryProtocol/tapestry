# ADR 0041: The graph rule concept, made from the rulebook and kept in line by every install

**Status:** Accepted
**Date:** 2026-11-15
**Story:** `engineering-team/stories/graph-operations-first-slice/41-graph-rule-concept.md`

## Context

Story 41 (Loom A10.41) asks firmware to install a graph rule concept on every instance, with one item for each entry in the rulebook, `docs/GRAPH_RULES.md`. The items are made from the rulebook and the rules' code, never by hand (ADR graph-rules/0001, Decision 5). A reinstall must bring an existing instance's items in line (AC5, the owner's answer at Planning). What bears on how:

1. **The rulebook is regular, but not yet a format anything reads.** It has six entries, each a level-2 heading and a list of bullets, one bullet per field, each starting with its label in bold:
   - **Headings.** Entries 2 to 6 head their entry with their number and their name in backticks (`## 2. `relationship-type-allowed``). Entry 1 heads it with a sentence, "Every node has a unique tapestryKey", and has no name. The story names it `tapestry-key-unique` (open question 1).
   - **Fields.** Every entry has the same eight labels: Says, Kind, Refuses or reports, Check, Repair, Enforced by, Status and Source. Two entries have one more: entry 2's "Reserved" and entry 3's "The naming convention".
   - **Continuation.** A field's text may go on below its bullet, as nested bullets and indented paragraphs (entry 1's "Enforced by", entry 3's "Refuses or reports").
   - **Refusal codes.** Each refusal is written as its code in backticks and its status in parentheses, such as `` `reserved-type` (409) ``.
   - **Code files.** Entries 2 to 6 name their code file in "Enforced by" ("The rule's code is in `src/operations/rules/<name>.js`").
2. **Each rule with code declares itself.** `src/operations/rules/index.js`'s `loadRules()` reads the folder once and answers `{ rules, problems }`. Each rule has a `name` (its file's name), a `summary`, `refuses`, `refusals` (`[{ code, status, when }]`) and `violations()`. A file that breaks the loader's rules is left out and listed under `problems`. Loading opens nothing (ADR graph-operations-foundation/0001 Decision 10), so a script can read every rule's declaration without a stack.
3. **Firmware installs a concept's elements from one file each, and only once.** Pass 1b (`src/firmware/install.js:194–265`) reads `concepts/<slug>/elements/*.json` for each manifest concept and calls `POST /api/normalize/create-element`. The element's name is its section's `name` (`install.js:236–238`). Its d-tag is `childDTag(name, header)` (`src/lib/dtag.js:51`), so its address is `39999:<TA>:<name>-<hash of the header's address>`, the same on every install. create-element refuses a name the concept already has (`src/api/normalize/index.js:1806–1816`), so a reinstall leaves an existing element as it was, and a changed file never reaches an instance that installed the earlier one.
4. **Firmware already re-signs one kind of node in place on every install.** Pass 2 saves each concept's JSON Schema from its file through save-schema, which calls `regenerateJson(uuid, json)` (`src/api/normalize/index.js:58–87`; the same function is in `helpers.js:124`). regenerateJson keeps every tag but `json`, signs the event again with the same d-tag, so at the same address, and imports it with `importEventDirect` (`index.js:137`). That import MERGEs the node by its address and replaces only its tags, so every relationship to the node stays. Kind 39999 is addressable, so the new event replaces the old one in the relay.
5. **How this epic adds a firmware concept** (ADR graph-operations-foundation/0005, Decision 1 and Amendment 1). Its files go under `firmware/versions/v1.0.0/concepts/<slug>/`, edited in place, as every firmware change has been. Its header's description is plain text. Its header has no `x-tapestry`, so its elements get no node label: io.js adds a label only when `nodeLabelRequired` is `true` (`src/api/io.js:411`). The global manifest gets one `concepts[]` entry, and the concept isn't listed under `sets.words`.
6. **The image carries the whole repo.** `Dockerfile:97` copies it, and `.dockerignore` doesn't leave out `docs/`, so the rulebook is in every image.
7. **CI runs the stack-free suites.** `npm test` runs `test/registry.js`'s suites. A suite that needs no stack gates every pull request. `ajv` is already a dependency (`package.json`), so a suite can check each item against the concept's schema.
8. **Firmware signs, and this story adds no graph operation.** The epic's "Nothing here signs a nostr event" (D1) is about its operations. Firmware signs every concept and element it installs as the instance's assistant (BIBLE §7), and the graph rule concept arrives the same way.
9. **No instance has the concept, and nothing reads it yet.** Once A10.31 is built, `rules list-rules` will read the items and `rules check` will name the item each violation breaks (catalog §4). `relationship-type-allowed` is the precedent for a rule that reads a firmware concept's elements (`src/operations/rules/relationship-type-allowed.js:53–75`), and for resolving a `json` tag held in LMDB (`:92–104`). This story changes no rule.

Concepts, by handle (the assistant's pubkey is read at runtime, never written into code):
- `39998:<TA>:graph-rule` — new. Its superset is `39999:<TA>:graph-rule-superset`, as create-concept names every superset.
- `39998:<TA>:relationship-type` — read for the precedent only. The local instance holds it with 14 elements.

## Options considered

### Option A — The element files are made by a script, kept in line by a test, and a reinstall brings them in

A script reads the rulebook and the rules' declarations and writes one element file per entry into the concept's `elements/` folder. The files are committed, and a stack-free test fails whenever they differ from what the script would write. Install creates them as it creates every firmware element. For this concept only, a reinstall also re-signs an existing item in place when its JSON in the graph differs from its file (Amendment 2).

- **Pros:**
  - Firmware stays a folder of JSON files, the "canonical set of JSON definitions" of BIBLE §7, which a version folder and the `active` symlink pin. Every reader of firmware files sees the items, as `relationship-type-allowed` sees its types.
  - A pull request that changes a rule shows the item's new JSON, so the reviewer sees what the graph will say.
  - A broken entry fails in CI, never at install on a live instance.
  - One file per rule, so two stories adding different rules don't touch the same file.
- **Cons:**
  - The repo holds a made copy beside its source. Whoever changes an entry or a rule's code runs one command. The test names the command, so the copy can be stale only until the next test run.

### Option B — Install builds the items from the rulebook and the code

No element files. Install parses the rulebook and loads the rules when it reaches the concept, and creates or updates each item from what it built.

- **Pros:** no copy to make, and nothing to run after changing a rule.
- **Cons:**
  - The items' content would follow `docs/` whatever firmware version is active, so swapping the `active` symlink no longer pins what firmware installs (`src/api/normalize/firmware.js:9–10`).
  - Every other reader of firmware files misses the items unless it also runs the builder.
  - A reviewer sees no item change in the diff.
  - A rulebook edit that breaks the format still fails in CI, through the same test as Option A, so B saves the one command and nothing else.

### Option C — The element files are written by hand, and a test compares them with the rulebook

- **Pros:** no script.
- **Cons:** every change is written twice, which is what ADR graph-rules/0001 Decision 5 rules out ("made from the rulebook, never kept by hand"). The test would only catch the second copy going wrong.

## Decision

We chose **Option A**. It keeps firmware as files a version pins, fails a broken entry in CI, and shows each rule change as an item change in review. Its cost is one command after a rule change, which the test asks for by name.

**1. The concept, in firmware v1.0.0.** Its files go under `firmware/versions/v1.0.0/concepts/graph-rule/`:

- **`concept-header.json`.**
  - `word`: slug `concept-header-for-the-concept-of-graph-rules`, name "concept header for the concept of graph rules", title "Concept Header for the Concept of Graph Rules", wordTypes `["word", "conceptHeader"]`.
  - `conceptHeader` names: `oNames` graph rule, graph rules; `oSlugs` `graph-rule`, `graph-rules`; `oKeys` `graphRule`, `graphRules`; `oTitles` Graph Rule, Graph Rules; `oLabels` `GraphRule`, `GraphRules`. No `x-tapestry`, so items get no node label.
  - Its description, exactly, as plain text:

    > A graph rule is one sentence that a graph or an event meets or breaks. The test: a program can check it and answer pass or fail. A rule either refuses a write or only reports. Each rule's wording is written once, in the rulebook, docs/GRAPH_RULES.md in TapestryProtocol/tapestry. Each element of this concept is made from its entry there and from the rule's code, never kept by hand, so a rule is changed in the rulebook, not here.

- **`json-schema.json`**, shaped like relationship-type's: a word wrapper whose `jsonSchema` requires `graphRule`, an object with the fields of Decision 2. Each field has its `type`, `name`, `title`, `slug` and `description`, as relationship-type's fields do. Its `x-tapestry.unique` is `["name"]`.
- **`manifest.json`:** `{"HAS_ELEMENT": [], "IS_A_SUPERSET_OF": []}`. The concept has no sets.
- **`elements/<name>.json`:** one per rulebook entry, made by Decision 4's script. Nothing else goes in the folder.
- **The global manifest** gets one entry, appended after the last `concepts[]` entry so every other concept installs in the same order as today: `{ "slug": "graph-rule", "dir": "./concepts/graph-rule/", "conceptHeader": "concept-header.json", "jsonSchema": "json-schema.json", "categories": ["tapestry"], "updateElements": true }`. It isn't listed under `sets.words`. The changelog gains an entry, first in the list, dated 2026-11-15.

**2. What an item holds.** Each element file is a word wrapper:

- **`word`:** `slug` and `name` are the rule's name; `title` is the name's words capitalized, such as "Relationship Type Allowed"; `wordTypes` is `["word", "graphRule"]`. `description` is the first sentence of the entry's Says, as plain text: Markdown marks removed, first letter capitalized.
- **`graphRule`:** these fields, in this order. Text fields hold the rulebook's words as Markdown, exactly as written there, with continuation lines dedented (Decision 3).

| Field | Type | From | What it is |
|---|---|---|---|
| `name` | string | the heading | the rule's name, kebab-case; its code file's name when it has one |
| `number` | integer | the heading | the entry's number in the rulebook |
| `says` | Markdown | Says | what the rule says |
| `kind` | Markdown | Kind | the entry's Kind, as written |
| `about` | `"the graph"` or `"events"` | Kind | `"the graph"` when Kind starts "a graph rule", `"events"` when it starts "a letter rule" |
| `refusesOrReports` | Markdown | Refuses or reports | whether it refuses a write or only reports, and its refusals |
| `check` | Markdown | Check | how a check finds what breaks it |
| `repair` | Markdown | Repair | how a repair fixes it |
| `enforcedBy` | Markdown | Enforced by | the database, a guard or a check, and where |
| `status` | `"proposed"`, `"enforced"` or `"retired"` | Status | the field's word, without its full stop |
| `source` | Markdown | Source | the TIP or ADR that brought it in, without its full stop |
| `alsoSays` | `[{ label, text }]` | any other field | the entry's other fields, in order, such as entry 2's Reserved; empty when there are none |
| `code` | object or `null` | `src/operations/rules/<name>.js` | `{ file, summary, refuses, refusals: [{ code, status, when }] }`, what the code declares, in the code's order; `null` for a rule with no code file, such as entry 1 |

The `about` field settles the story's word question. The concept as a whole is "graph rule", so an item says what it is about with `"the graph"` or `"events"` (Loom's words), and keeps the rulebook's Kind as written beside it.

**3. The rulebook's format, which the script reads.** These are the rules the script checks. Today's entries follow them once entry 1 has its name:

- **An entry** starts at a heading `## <n>. `<name>``: its number, a full stop and its name in backticks, and nothing else. `<name>` is kebab-case. A heading that starts `## <digits>.` but doesn't match is a problem. Any other `## ` heading ends the entry before it and isn't an entry. Everything above the first entry is the preamble, which the script doesn't read.
- **Numbers** run 1, 2, 3… in file order. **Names** are unique.
- **A field** is a line `- **<Label>:** <text>`. Its text is the rest of that line and every following line up to the next field line, the next `## ` heading or the end of the file. Each following line loses up to two leading spaces, and blank lines at either end are dropped. Text in an entry before its first field is a problem.
- **The eight labels** each appear once in every entry: Says, Kind, Refuses or reports, Check, Repair, Enforced by, Status and Source. Any other label goes into `alsoSays`.
- **A refusal** in Refuses or reports is a code in backticks followed by a space and a status in parentheses: `` `<code>` (<4xx>) ``.
- **A code file** named in Enforced by is written `` `src/operations/rules/<name>.js` ``.

**Entry 1 gets its name.** Its heading becomes `## 1. `tapestry-key-unique``. Its Says already states the rule, so nothing is lost. No document links to the old heading's anchor.

**4. The script, `src/firmware/graph-rules.js`.** A module, and a command when run directly. It opens nothing: no database and no network.

- **Its parts, each a pure function the tests can feed:**
  - `parseRulebook(text)` → `{ entries, problems }`;
  - `itemsFor({ entries, rules, ruleFiles, ruleProblems })` → `{ items, problems }`, where `rules` is `loadRules().rules`, `ruleFiles` the rule file names in the folder, and `ruleProblems` the loader's;
  - `elementFiles(items)` → `[{ file: '<name>.json', text }]`, each text `JSON.stringify(json, null, 2) + '\n'`, with keys in Decision 2's order.
- **`node src/firmware/graph-rules.js`** reads the real rulebook (resolved from the script's folder, never the working directory) and the real rules folder. It writes the files into `path.join(firmware.firmwareDir(), 'concepts/graph-rule/elements')` and removes any `.json` file there that no entry makes, saying what it wrote and removed. When there is any problem, it writes nothing, lists every problem and exits 1.
- **`--check`** writes nothing. It exits 1, naming each file that would change, appear or go, and the command to run.

**5. What fails (AC4).** `itemsFor` lists a problem, naming the rule, for each of these:

- a rule file in `src/operations/rules/` that no entry names;
- a rule file the loader left out (its problem, passed on);
- an entry whose Enforced by names a code file other than `<its name>.js`, or one that isn't there;
- an entry whose rule has a code file, but whose Enforced by doesn't name it;
- an entry whose rule has a code file but whose Status isn't enforced;
- an entry whose refusal codes and statuses, as Decision 3 reads them, aren't the code's, compared as sets;
- an entry that lists refusals for a rule whose code says it only reports (`refuses: false`), or lists none when the code refuses;
- an entry whose Status isn't proposed, enforced or retired, or whose Kind starts with neither "a graph rule" nor "a letter rule".

Along with Decision 3's format problems, these are what keep the rulebook and the code from drifting apart. A stack-free test runs the script's parts on the real files and fails on any problem, and on any element file that differs from what they make.

**6. A reinstall brings the items in line (AC5).** A manifest entry with `"updateElements": true`, which only graph-rule has, changes pass 1b for that concept alone. For each element file, before calling create-element, install looks for the element by its name, as create-element's own check does: in the concept's class thread, from its superset.

- **No element has the name:** create it, as today.
- **The instance's assistant's element has it** (its address starts `39999:<TA>:`, with the assistant's pubkey read at runtime): compare its JSON with the file's as values, not text. A `json` tag that is an LMDB reference is resolved first, as `relationship-type-allowed` resolves one. When they are equal, change nothing and sign nothing. When they differ, re-sign the element with the file's JSON through `regenerateJson`, the call pass 2 makes for every schema (Context 4). The element keeps its address, its other tags and every relationship to it. Either way, its address goes into `nodeMap`, as a created element's does.
- **Only another author's element has it:** leave it, and log that firmware's own wasn't made. Install never signs over another author's event.
- **An element whose file has gone** stays as it was. Nothing in this story deletes an item. The rulebook retires a rule rather than removing its entry (ADR graph-rules/0001, Decision 6), so this is rare.

The lookup and its outcome are one pure step, `planElement({ json, found, ta })` → `create`, `update`, `unchanged` or `blocked`, in a small module of its own, `src/firmware/element-sync.js`. Install gives it the rows it read. It reads with `runCypher` from `src/lib/neo4j-driver`, not `/api/neo4j/query`, whose CSV answer can't carry a JSON value. It signs with `helpers.js`'s `regenerateJson`, after `helpers.loadTAKey()`, as the b-tag emitter loads the key (ADR 0034). Pass 1 counts each outcome for the concept and logs the counts. Every concept without `updateElements` installs exactly as today.

**7. Signing.** The items are signed like every firmware element: when created, and again only when their file changes. A reinstall with no rule change signs nothing new for them.

**8. Documentation.**

- **The rulebook's preamble** gains a paragraph, "In the graph". It says firmware installs each entry as an element of `39998:<TA>:graph-rule`, made from this file and the rule's code by `node src/firmware/graph-rules.js`, and that a test fails until it is run again after a change. It says that a rule is changed here, never in the graph, and points to this ADR. Its "What each entry says" list gains the name ("the heading: the entry's number and its rule's name, which a rule with code shares with its file") and the format rules of Decision 3, in a sentence.
- **BIBLE §7.** "What Firmware Defines" lists `graph-rule` under Tapestry and gives the manifest's concept count, 41. "Firmware Install" says what `updateElements` does, and that graph-rule's element files are made by the script and never edited by hand.

## Consequences

- **What this enables.**
  - Every instance gets the rules as a concept on its next firmware install, david.tapestry.ninja included, once its release carries this change.
  - A10.31 can answer `rules list-rules` from the items and name an item in `rules check`'s findings, by `graphRule.name` (the node's `name` and `slug`).
  - The rulebook's format is checked from now on, so every new entry arrives in a shape the items can be made from.
- **What it constrains.**
  - A change to an entry or a rule's code needs `node src/firmware/graph-rules.js` run and its files committed. The stack-free suite fails until they are.
  - A new rule file can't merge without its rulebook entry. ADR graph-operations-foundation/0004 Decision 12 already asked for this, and now it is checked.
  - An edit made to an item in the graph is put back by the next install, whether or not the item's file changed, as a reinstall puts back every firmware header (OPEN.md row 8). Install compares the item's JSON in the graph with its file (Decision 6; Amendment 2). Rules are changed in the rulebook (story, Out of scope).
- **New debt and follow-ups.**
  - **create-element's check is by name, not by author** (Context 3), so another author's element with a rule's name in this concept stops firmware making its own. That is true of every firmware concept today. Decision 6 logs it rather than signing over the other element.
  - **An item whose entry leaves the rulebook stays on instances that have it** (Decision 6).
  - **Entry 1 has a name but no code file,** so `rules check` can't run it until a story gives it one.
  - **BIBLE §10 still lists the eleven normalization rules,** which enter the rulebook one at a time (ADR graph-rules/0001).
- **Firmware reinstall required?** Yes. The change adds a firmware concept with six elements, and changes how install treats one concept's existing elements.

## Implementation notes

- **New:**
  - `src/firmware/graph-rules.js` (Decisions 3 to 5);
  - `src/firmware/element-sync.js` (`planElement`, Decision 6);
  - `firmware/versions/v1.0.0/concepts/graph-rule/`, holding `concept-header.json`, `json-schema.json`, `manifest.json` and `elements/`, whose six files are written by the script, never by hand.
- **Changed:**
  - `firmware/versions/v1.0.0/manifest.json`: the concept's entry and the changelog entry (Decision 1);
  - `src/firmware/install.js` pass 1b: the `updateElements` branch (Decision 6). Leave every other concept's path as it is;
  - `docs/GRAPH_RULES.md`: entry 1's heading and the preamble (Decisions 3 and 8);
  - `BIBLE.md` §7 (Decision 8).
- **Order:** the rulebook's entry 1 heading first, then the script, then its output, then install.
- **Test seams, for the Tester:**
  - the script's three pure parts, fed fixture rulebooks and fake rule lists, cover every problem of Decisions 3 and 5;
  - the real rulebook and rules make exactly the committed files;
  - each committed item validates with `ajv` against the concept's schema;
  - the firmware files and the manifest entry are shaped as Decision 1 says, the way `test/neo4j-property-firmware.test.js` checks neo4j-property's;
  - `planElement` gives each of its four outcomes;
  - no committed file holds a 64-hex pubkey.

  All of these are stack-free and register in `test/registry.js`, which is the Tester's to edit. Never run the full `npm test` on the owner's Mac, because it writes to the local agent-memory instance. Run each suite with `node test/<file>`.
- **The live check (AC1, AC2, AC5, AC6),** on a scratch stack from `scripts/scratch-stack.sh`, never a shared or private instance:
  1. A fresh install gives the concept and six items. `summaries` lists the concept, and `graph list-elements` pages through the items.
  2. Record each item's address and event id, and a digest of every other firmware concept's nodes, tags and relationships.
  3. Change one entry's wording, run the script, and reinstall. Only that item has a new event, at the same address, with its relationships kept. The digest of the rest is unchanged.
  4. Add a seventh entry, using a fixture rule and file, and reinstall. A seventh item appears.

## Out of scope

- `rules list-rules` and `rules check` (A10.31).
- Relationships from a rule to its TIP, or to the glossary words it uses.
- A rule file for entry 1, and any new rule.
- Changing create-element's check by name, or how a reinstall treats any other concept's elements.
- Deleting an item when its entry goes.
- Moving the rulebook under `protocols/`.

## Amendment 1 (2026-11-15, at Test Design) — what the Tester's readings settle

1. **The script's parts.**
   - `parseRulebook(text)` answers `{ entries, problems }`. Each entry has at least its `number` and its `name`.
   - `itemsFor({ entries, rules, ruleFiles, ruleProblems })` answers `{ items, problems }`. Each item is `{ name, json }`, where `json` is the element's word wrapper of Decision 2. `ruleFiles` are file names, such as `set-has-a-parent.js`, and `ruleProblems` are the loader's `[{ file, problem }]`.
   - Each problem is `{ rule, message }`. `rule` is the name of the rule it is about, or `null` when no name can be read, as from a heading without one. `message` says what is wrong, in words.
2. **`planElement({ json, found, ta, resolve })`** answers `{ action, uuid, others }`.
   - `found` is the rows install read, `[{ uuid, json }]`, with `json` as the node's `json` tag holds it: JSON text, an LMDB reference, or null. `resolve(value)` turns an LMDB reference into its JSON, as an object or as text, or null when its entry is missing. It defaults to `resolveValue` from `src/lib/tapestry-resolve`.
   - The assistant's elements are those whose address starts `39999:<ta>:`. Install gives `ta` from `firmware.getTAPubkey()`.
   - `create` when no row has the name.
   - `unchanged`, with the element's `uuid`, when the assistant's element holds the file's JSON. They are compared as values, so key order doesn't matter.
   - `update`, with its `uuid`, when it holds other JSON, or JSON that can't be read.
   - `blocked`, with `others`, the other authors' addresses, when only other authors' elements have the name.
   - When more than one of the assistant's elements has the name, the first by address decides, and the rest are left as they are.
3. **Install finds the concept's header by its address,** `firmware.conceptUuid(slug)`, as Pass 2 now does (graph-operations-foundation #10), and never by name.
4. **The schema states what Decision 2's table gives.** `about`'s and `status`'s values are each an `enum`. `number` is an `integer`, `alsoSays` an `array`, and `code` is `["object", "null"]`.

## Amendment 2 (2026-11-16, at Review) — what review round 1 changed

1. **An install puts back an edit made in the graph.** Decision 6 compares an item's JSON in the graph with its file, so install re-signs the item whenever they differ. They differ when the file changed, and also when someone edited the item in the graph. Two sentences said otherwise: Option A's ("when its file has changed"), and the Consequences bullet saying an item whose file is unchanged keeps an edit. Both are corrected above. This is the one place the story lets an install overwrite graph state, and the story's Out of scope approved it.
2. **The rulebook's format is stricter (Decision 3).** Each of these is now a problem:
   - **A non-blank line after a field that isn't indented,** naming the entry. A field's text goes on only on blank or indented lines, so a `---` separator, a stray note or a mistyped label no longer joins the field before it.
   - **A level-2 heading that holds a name in backticks but isn't an entry's heading,** such as `` ## 7 `x` `` or `` ## Rule 7: `x` ``, naming the name. Such an entry was dropped silently before.
   - **A field line outside any entry,** in the preamble or under a level-2 heading that isn't an entry's.
3. **Where a Says' first sentence ends (Decision 2's `word.description`).** It ends at a full stop, question mark or exclamation mark followed by white space and a capital letter, or by the end of the text. It never ends at "e.g.", "i.e.", "cf." or "vs.".
4. **A stack-free test runs Pass 1b's `updateElements` path.** It runs in a child process, with the driver, the normalize helpers, the event sync and the assistant's keys stubbed, as `test/helpers/saveSchemaChild.js` does for Pass 2. The text checks IS1 to IS3 no longer stand alone.
