# Story 18: `graph add-property`, `update-property`, `remove-property` and `set-schema` — change a concept's properties, with no event

**Status:** Done
**Created:** 2026-11-17
**Type:** Feature
**Loom:** A10.18 — https://loom.brainstorm.world/t/A10.18

## Background

Loom's A10.18 asks for four graph writes (catalog §2, Properties and schema):

- **`graph add-property`:** "add a property, under a parent property for nested objects", taking `concept`, `name`, `type`, `required?`, `description?` and `parent?` and answering "the property's tapestryKey". It "refuses a duplicate name; reports elements that stop validating".
- **`graph update-property`:** "change a property's type, required flag or description", taking `property` and the fields and answering the property. It "reports elements that stop validating".
- **`graph remove-property`:** "remove a property", taking `property`. It "reports elements that still carry it".
- **`graph set-schema`:** "make a concept's properties match a given JSON Schema", taking `concept` and `schema` and answering "the properties added, changed and removed". It "reports elements that stop validating".

Done, for Loom, is when "each is declared once; answers at `/api/tapestry/graph/<operation>` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI."

Loom's text also has add-property take "whether elements carry it on the node (design doc §5, question 1)". The catalog has since settled that question. Whether an element carries a field on its node is a mark, made with `graph mark-field` (ADR graph-operations-foundation/0005), so add-property doesn't take it.

These facts about today's instance shape the story:

- **A concept's schema follows from its properties.** The catalog reads D10 this way: "a concept's JSON Schema is computed from its property nodes, so there's no write that saves a schema directly: changing the properties changes the schema, and `set-schema` turns a given schema into properties." BIBLE §30 counts "JSON Schema documents, recomputable from a full property tree" among what is recomputable. BIBLE §9 lays the tree out: the JSON schema, then the primary property, then the top-level properties, then the nested ones.
- **Today it runs the other way, and every route signs.**
  - `POST /api/normalize/save-schema` rewrites a concept's whole schema, and signs it.
  - `POST /api/normalize/generate-property-tree` signs one event for each property it reads from the schema, and unhooks the properties the schema no longer has.
  - `POST /api/normalize/create-property` signs one property. It hangs a top-level property off the JSON schema node, not off the primary property as BIBLE §9 has it. It never changes the schema, so the schema and the tree disagree after it.
  - `POST /api/property/generate-json-schema` builds a schema back from the tree, and signs it. What the tree doesn't hold, such as a list's item type, it drops.
  - None of them changes a concept that `graph create-concept` made. Three find their concept by name among headers that came from an event. save-schema can find one by its tapestryKey, but refuses a concept with no event behind it.
- **No field here has a property node.** On the local instance (2026-11-17), each of the assistant's 49 concepts has a JSON schema, and the only property nodes are their 49 primary properties. A concept that `graph create-concept` makes has three fields in its schema, `name`, `slug` and `description`, and no property node for any of them (ADR graph-operations-first-slice/0016, Decision 12).
- **Marks need property nodes.** `graph mark-field` refuses a field with no property node (`no-property-node`, by the rule `field-mark-allowed`). So today no field of any concept here can be marked. That rule's check also names a mark whose field has changed type or lost its property node (docs/GRAPH_RULES.md §3).
- **Every reader reads the schema node.** The rule `element-fits-schema`, which create-element and update-node refuse by, reads a concept's schema from its JSON schema node. So do the derive step, the concept pages and the Health Audit. A schema that changed only in the property nodes would change nothing anyone checks.
- **The reports are already written down.** The rules document's §7 says the property operations "will run it over a concept's elements after its schema changes, reporting only". ADR graph-operations-first-slice/0020a (merged 2026-11-17) says such a reader calls the rule when it acts (Decision 7), and that the rule's check form judges a node's tapestryJson (Decision 5). Loom's A10.20.b, which another session is building now, moves the rule onto tapestryJson. These reports judge whatever the rule judges.
- **Elements keep their fields under the concept's key.** An element's JSON has a `word` block and a section under its concept's key, such as `{"dog": {…}}`, holding its name, its slug and its fields (BIBLE §8; `graph create-element`).
- **Nothing else changes a property.** update-node and delete-node refuse a property node (`made-elsewhere`), naming these operations.
- **The write path is built.** A10.4 gives a graph write its guards, one transaction with its change entry, and no signing (ADR graph-operations-foundation/0004). A node with no event is the node the import would make of the letter its write would sign, recorded without signing (ADR 0016, Decision 1). create-concept, create-element and create-set make their nodes that way.
- **Agents already have a way in.** The external CLI (A10.6) turns each operation the instance lists into a command.

## User-facing description

As an admin agent building a concept graph, or the owner, I want to give a concept the fields its elements hold, one at a time or a whole JSON Schema at once, without signing anything. Then its elements are checked against the fields they really have, and I can mark the fields I need on their nodes.

As the same agent, I want to change or remove a field, and be told which elements stop fitting the concept's schema, or still hold a field I removed. Then I can fix them, rather than find out when a later write is refused.

As the same agent, I want a concept's properties and its schema to say the same thing after every change, whatever state they started in, so that what I read back is what I wrote.

## Acceptance criteria

- [ ] **AC1 — Add a property.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/add-property` with:
  - `concept`, its header's tapestryKey;
  - `name`;
  - `type`, one of JSON Schema's seven: string, number, integer, boolean, object, array or null;
  - and optionally `required`, `description`, `parent` (the tapestryKey of one of the concept's object fields, for a field nested in it) and `schema` (the rest of what JSON Schema says about the property, such as `{"enum": […]}`, a `format`, or a list's `items`),

  then the concept has a new property. Its JSON Schema, read as every reader reads it, holds the field at that place with everything given, and lists it as required when `required` is true. The concept's Properties page lists it, with its type and its parent. The answer gives the property's tapestryKey, the property as it is, and the change entry. The same call again changes nothing, records nothing, and answers `already-exists` with that property. Nothing is signed or sent to a relay.
- [ ] **AC2 — The properties and the schema agree.** Given a concept whose schema lists fields that have no property node (every concept on this instance today), when any of the four writes changes it, then the same write first brings the concept's property nodes in line with its schema, as set-schema given that same schema would. Each field gets a node holding what the schema says of it, and a node among its fields that the schema doesn't list comes out. The answer lists what that changed, apart from the write's own change. After every write, the concept's JSON Schema is exactly what its properties say. create-element and update-node check new JSON against it, and `graph mark-field` can mark any of its top-level fields that holds a plain value.
- [ ] **AC3 — Update a property.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/update-property` with `property` (its tapestryKey) and any of `type`, `required`, `description` and `schema`, then each one given replaces what the property said. Within `schema`, each keyword given replaces that keyword, and a `null` takes one out. Everything else the property says stays as it was. The concept's schema follows. The answer gives the property as it now is, what changed, and the change entry. Given values the property already holds, it changes nothing, records nothing, and answers `unchanged`.
- [ ] **AC4 — Remove a property.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/remove-property` with `property`, then the property and every property under it leave the concept. Its schema no longer has them, nor lists them as required. The change entry keeps each removed property whole, so a mistake can be undone. The answer lists what was removed. The same call again changes nothing and answers `already-gone`, naming the entry that records the removal.
- [ ] **AC5 — Set the whole schema.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/set-schema` with `concept` and `schema`, then the concept's properties match the schema given. That schema is a JSON Schema for the concept's elements' JSON, as `save-schema` takes one today, with the concept's fields under its key. The concept's schema then reads back as the one given: every keyword at every level is kept, and nothing is added that the answer doesn't name. The answer lists the properties added, changed and removed, each by its field and its tapestryKey. A field the concept already had keeps its property node and its tapestryKey, so a mark on it goes on working. The same schema again changes nothing, records nothing, and answers `unchanged`.
- [ ] **AC6 — Elements are reported, never refused for.** Every answer judges the concept's elements as the rule `element-fits-schema` judges an element as it stands (ADR graph-operations-first-slice/0020a), and says:
  - which elements fit the concept's schema before the write and don't after, each with what doesn't fit;
  - how many already didn't fit;
  - how many couldn't be judged.

  remove-property's answer, and set-schema's when it removes a field, also say which elements still hold a value for a field that was removed. None of this stops the write. The list is capped, says how many there were in all, and says so when the concept has more elements than one call judges.
- [ ] **AC7 — What they refuse.** Each refuses these, changes nothing, records no entry, and says in words what was wrong:
  - a `concept` that names no concept header, or a concept with no JSON schema node, or more than one (BIBLE §10, rule 11);
  - a `property` that names no field of a concept (a concept's primary property is not one);
  - a concept that isn't this instance's own, and a firmware concept, as update-concept refuses them;
  - for add-property:
    - a `name` already used at that place in the concept's schema, by a field other than the one asked for (`name-in-use`), naming what differs;
    - a name that is empty once trimmed, is longer than 200 characters, holds a control, text-direction or invisible character (as create-concept refuses one), or can't key a field of an element's JSON, such as `__proto__`;
    - a `type` that isn't one of JSON Schema's seven;
    - a `parent` that isn't one of the same concept's object fields;
  - a `schema` piece (add-property's or update-property's) that isn't a JSON object, that names the property's own sub-properties (`properties`, or a `required` list: those are properties of their own), that says something different from an input given beside it, or that would leave the concept's schema one that doesn't compile;
  - for update-property: a call that names nothing to change, and a type other than object for a property with properties under it;
  - for set-schema: a schema that isn't a JSON object, doesn't compile, or has no object under the concept's key, where its elements keep their fields;
  - for each of the four, a marked field: removing it, or changing the type of value it holds (its type, or its list's item type). The refusal names `graph unmark-field`, which takes the mark and its copies off first. This covers a marked field under a property being removed.
- [ ] **AC8 — Which concepts, and their letters.** The four change this instance's own concepts, made by an operation or by today's routes, with or without a letter. For a concept with a letter, the answer says that the letter no longer matches it (`letterOutOfDate`), as update-concept does; `export nostr` (A10.34) is what sends a new one. Two writes to one concept's properties at once both land, one after the other, or one is refused; neither is lost.
- [ ] **AC9 — It lasts, and it reaches agents.** A concept's properties and schema, as these writes leave them, are as they were after a firmware reinstall, and after a backup is restored on a fresh instance (BIBLE §30). Each write records a change entry naming who made it. All four are for the owner and admins: a caller who isn't signed in is refused with 401, and a signed-in person who is neither with 403. Each is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs each as `tapestry graph <operation>`, with no sign-in. An admin agent with its own key adds, updates and removes a property, and sets a concept's schema, through the external CLI (A10.6), with no change to the CLI.

Nine criteria, for four operations that share one reading of a concept's properties and one report. They stay one story because Loom has one task for them, and because the first write on any concept already does what set-schema does (AC2).

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`); it differs on every instance, so it is never written into code.

- `39998:<TA>:property` — property (its elements are properties). Each new property becomes one of its elements, as today's routes make one; Architecture confirms how.
- `39998:<TA>:primary-property` — primary property (read). A concept's top-level properties hang under its primary property (BIBLE §9).
- `39998:<TA>:json-schema` — JSON schema (read; its elements are each concept's schema node). What a concept's schema node holds follows from its properties.
- `39998:<TA>:property-tree-graph` and `39998:<TA>:properties-set` — the core nodes that record a concept's properties (read). What each holds after a write is Architecture's.
- `39998:<TA>:json-data-type` — JSON data type (read): "the primitive data types of JSON Schema". Its elements include the seven types a property can have, and `regex`, which JSON Schema doesn't check as a type.
- `39998:<TA>:neo4j-property` — neo4j property (read). Its set of neo4j properties that are also fields holds the marks AC7 refuses for.
- Nothing in this story changes a firmware concept's definition.

## Out of scope

- **Renaming a property, or moving it under another parent.** Either would leave every element's value under the old key. That is a later operation, if one is needed.
- **`graph enumerate`** (catalog §2): a property's allowed values made the elements of another concept.
- **Changing elements to fit a new schema.** The reports name them; `graph update-node` changes them.
- **A firmware concept's schema,** which stays with the firmware (lifecycle seed-firmware, A10.37), and **another author's concept,** which is that author's claim (D4).
- **Today's routes** (create-property, save-schema, generate-property-tree, generate-json-schema) and the UI's property editor, which uses them. They stay as they are (D15).
- **Publishing a concept's properties** as nostr events (`export nostr`, A10.34).
- **`rules check` over the whole graph** (A10.31), and refreshing the derive step's dated verdicts (ADR 0020a, Decision 7).
- **Moving the rule onto tapestryJson,** which is A10.20.b's.
- **More than one concept per call** (catalog §10, question 6).
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

Resolved at this gate.

1. **What happens to the fields a schema lists with no property node?** *Resolved: the write gives them nodes too* (the owner's answer, 2026-11-17). Every concept here is in that state, create-concept's own included. The first write on such a concept brings its property nodes in line with its schema, and says what that changed (AC2). From then on the properties and the schema agree, and any field can be marked.
2. **What do the writes do with a marked field?** *Resolved: refuse, naming unmark-field* (the owner's answer, 2026-11-17). Removing a marked field, or changing the type of value it holds, is refused until its mark and copies are off (AC7). The rule `field-mark-allowed` already counts such a mark as broken.
3. **What do add-property and update-property take?** *Resolved: the catalog's inputs, and also an optional piece of JSON Schema for the property* (the owner's answer, 2026-11-17). An agent can add a list of strings, or a field with allowed values, in one call (AC1, AC3). The piece can't hold the property's own sub-properties, which are properties of their own (AC7).
4. **Which concepts may they change?** *Resolved: this instance's own, with or without a letter, never a firmware concept or another author's, as update-concept* (the owner's approval of the story, 2026-11-17; AC8). That includes the concepts the server makes for its own features and finds by name: tapestry work record, tapestry owner goal and the rest of the Dictionary's name-keyed concepts. The server's code writes their elements in a fixed shape, so a property write can leave new ones failing the changed schema. AC6 reports that.
5. **Are elements that stop fitting refused or reported?** *Resolved: reported, never refused* (the owner's approval, 2026-11-17), as the catalog and the rules document's §7 say ("reporting only"; AC6).
6. **Are the writes safe to repeat?** *Resolved: yes, as create-concept and create-set are* (the owner's approval, 2026-11-17). A repeat answers `already-exists`, `unchanged` or `already-gone` and changes nothing (AC1, AC3–AC5).

**Corrected at Architecture** (the owner's approval, 2026-11-17, with ADR 0018):

- **Only a wrapped schema** (AC5, AC7). Its one top-level property is the concept's key, an object. A schema with another top-level property beside it is refused `not-wrapped`, as is a property write on a concept whose schema has one (ADR 0018, Decision 3).
- **Every field has a `type`** (AC5): one of the seven, or a list of them. A field defined by `$ref` or `enum` alone is refused `bad-type`, since a property node has to have a type (Decision 4).
- **A size bound** (AC7): at most 32 levels under the concept's key, and 1,000 properties, else `schema-too-large` (Decision 4).
- **What a write fills in** (AC5): the schema's `$schema`, `type`, `required` and `definitions`, when it lacks them, since the `json-schema` concept requires them. The answer names each one (`filledIn`; Decision 3).
- **A list's item fields stay in the list's own definition** (AC1): `parent` can't name a list, and update-property's `schema` or set-schema changes them (Decision 4).

For Architecture, not this gate (each answered in ADR 0018):

- **What a property node holds, and how a concept's schema follows from its properties** (D10; BIBLE §30), so that set-schema keeps every keyword. That covers what a concept's schema says above its fields, such as `x-tapestry`'s `unique`, `allOf`, `definitions`, and the `name`, `title`, `slug` and `description` that create-concept writes beside them. It also covers what a property says beyond its type.
- **Where the schema is kept,** so that every reader that reads the JSON schema node today reads the change.
- **How a property node is made:** its address and d-tag (BIBLE §9 gives today's deterministic d-tag), its labels and memberships, and what the property tree graph and the properties set record of it.
- **A list whose items are objects.** Today generate-property-tree hangs the items' fields under the list's node. Are those fields properties of their own, and so may `parent` name such a list? Either way, set-schema keeps such a list as given (AC5).
- **How the reports judge each element before and after, within one write,** and how many elements one call judges (AC6).
- **ADR 0020a's Decision 4,** under which a write has the derive step build its nodes' tapestryJson after it commits; and A10.20.b, which another session is building now, and which moves the rule's check form onto tapestryJson. The reports call the rule, so they follow it.
- **The lock** that two writes to one concept take (AC8), and **the change entries' shape,** a removal's kept whole so it can be undone (AC4).
- **What makes a name unable to key a field** of an element's JSON (AC7).
- **How the first write's catching-up** is told apart from its own change in the answer and the change entry (AC2).

## Deviations

- **field-mark-allowed's `no-property-node` names the property writes beside `generate-property-tree`,** not in its place (Decision 15 said "in place of"). mark-field's MF6 pins that the message names that route and says it signs, and D15 leaves the route as it is. So the message says `graph set-schema`, or any other property write, gives a concept's fields their nodes and signs nothing, and that the route does it too but signs. Its `when` and rulebook §3 say the same.
- **delete-node's messages keep "(A10.18)"** and drop only ", to come": DN25 pins `A10.18` in the made-elsewhere message for a property.
- **BIBLE's property tree is in §6, not §9.** Decision 15 names §9, but the property tree's layout, its deterministic d-tags and the two-way sync table are in §6's Property Relationships. They are edited there, and the "Last updated" line names §6.
- **The tree read, and update-property's and remove-property's search for a property's concept, go 33 levels deep,** one more than the 32 the writes keep, where Decision 11 wrote `*1..32`. So a node one level too deep is refused `tangled-tree`, naming its depth, rather than missed.
- **The property tree graph names each property node by its d-tag,** not its word slug. Two properties under different parents can share a key, and so a slug, and the graph's relationships name nodes by slug. The schema node, the primary property and the properties set keep their word slugs, as create-concept writes them.
- **A node that catching up would add and the write's own change takes out again** (set-schema dropping a field the schema had but the tree lacked) is neither made nor recorded. Its two changes would cancel out, and a removal's entry keeps a node that existed.
- **The four declare no `no-schema` of their own.** The guard rule `element-fits-schema` declares `no-schema` at 409, the status Amendment 1 gives a concept with no schema node or two, and a declaration listing the code again would list it twice.
- **Each declares every refusal its shared code can give,** beyond Amendment 1's lists: remove-property's `bad-schema` and `no-free-address`, update-property's `no-free-address`, and set-schema's `not-wrapped` (400) for a concept with no key, which catching up can't avoid. So no refusal comes back as a 500.
- **remove-property's `already-gone` answers `removed: []` and `elements: null`:** it judged nothing, and the entry it names in `removal` holds what was taken out.
- **`already-exists` and `unchanged` can still carry a change entry** when catching up, or a fill-in of Decision 3, wrote something first. The outcome is the write's own change.
- **`not-own-node` covers every node the write rewrites or takes out,** a parent whose view changes among them, not only those a plan lists as changed: a rewrite is a change.
- **The whole node a property-removed change keeps** gives each relationship `from` and `to` beside delete-node's `direction` and `other`, so RM2's reading, and an undo, need no second lookup. delete-node's own entry is unchanged.
- **A catch-up change's `was` for a node in the old shape** is `{ schema: null, required }`, its required flag read from its boolean `property.required` where its parent has no piece.
- **The report's lists are in tapestryKey order,** so which 50 it names doesn't depend on the read's order, for a concept of up to 10,000 elements. Past that, the read's order decides which 10,000 are judged, and so which can be named (review round 1, finding 3).
- **A piece that names `__proto__` is refused `bad-schema`,** by add-property and update-property alike. update-property merges a piece's keywords by assignment, and assigning `__proto__` would set the definition's prototype, not a keyword. No suite pins it; a probe of `pieceInput` refuses it as text and as a parsed object, and accepts `{"minLength": 1}`.

## Evidence

### The suites (Implementation, 2026-11-17)

Run on this Mac, each with every service endpoint dead and `TAPESTRY_CONTAINER=no-such-container`. No full `npm test` ran here: the local stack is the owner's agent-memory instance, and the PR's CI runs the full gate.
- **The five suites, each alone:** add-property 14/0, update-property 11/0, remove-property 8/0, set-schema 9/0, properties-agent-through-cli 1/0.
- **Their neighbours, each alone:** delete-node 40/0 on the functions moved to `_nodes.js`, mark-field 16/0, update-node 42/0, rules/element-fits-schema 11/0, rules/field-mark-allowed 14/0, graph-rule-firmware 13/0 and graph-rules-builder 26/0.
- **The scoped gate,** through the gate engine: CI's registry entries for an operations change, `operations.test.js` (which runs every suite under `test/operations/`), `external-cli`, `openapi-coverage`, `admin-action-sweep` and `schema-save-finds-the-right-header`. `npm run gate:status -- --label a10-18-story-18-impl-final` reads:
  `20261118T021214Z-39591-5716 [a10-18-story-18-impl-final] started 2026-11-18T02:12:14.004Z on bd017881+dirty — PASS, exit 0, 1014 passed, 0 failed, 6 skipped, 5/5 suites`
  - **Dirty** is this commit's implementation, uncommitted beside the tests' commit.
  - **The first run failed 13,** each for want of a `node_modules` in this worktree (record `20261118T020059Z-33339-696e`; ledger row `2026-11-16-route-walk-needs-node-modules`, this occurrence added): most on the route walker's `Cannot find module …/node_modules/express`, openapi-coverage's D2 on `js-yaml` in its throwaway copy, and `schema-save-finds-the-right-header`, which didn't load, on `…/node_modules/nostr-tools` (review round 1 corrected this line). With the main checkout's linked in, untracked, the rest passed.
- **harness-lint** is clean, and `node src/firmware/graph-rules.js --check` finds rules 3 and 7 current. A code-point scan of every file touched finds no control or invisible character this branch added (BIBLE.md's three U+FE0F are staging's). It counted controls and format characters only: review round 1 found two combining marks it didn't count, U+0300 and U+036F in `test/helpers/propertyGraph.js:66`, now written as escapes.
- **Before the implementation,** at `e509c390` (staging with A10.20.b merged in), the five suites were 0/13, 0/11, 0/8, 0/9 and 0/1, each failing because its declaration didn't exist.

### The live check (Implementation, 2026-11-17)

It ran on a throwaway instance from `scripts/scratch-stack.sh`, never a shared or private one. Every call went through `test/helpers/scratchLoopback.js`, which refuses any container not named `tapestry-scratch…`. The records are in this worktree's `tmp/live-check-18/` (ignored by git): `live.js`, `report-main.json`, `main.log`, `hand-calls.md` (the calls made by hand), `up.log`, and for L4 `backup.json`, `up-restore.log` and `report-restored.json`.
- **The instance.** It booted from image `agent-memory-tapestry:latest` with this branch's `src/` mounted. The image's firmware differed from the branch's (digests `4610d6d4fdc8` and `99c0db5f3e01`). The branch's firmware, `bin/tapestry.js` and `clients/cli` were copied in, the control panel restarted, and the firmware installed again. Three throwaway keys were made, and the owner's and an admin's set in `/etc/brainstorm.conf`.
- **The calls** went through `docker exec` to `127.0.0.1:7778`, as the trusted local operator. The agent's and the visitor's went through the instance's nginx. The rule's check form ran inside the container, with the app's own modules, store and database.

**Run 1 found Decision 10 refusing every first write (L1a).** add-property on a concept `graph create-concept` made was refused `invalid-fields`: the rewritten property tree graph fails firmware's installed `graph` schema (`graph.graphType` is required), and the JSON schema node `validation tool`'s wordType conditionals. Both nodes fail those before any property write. The owner ruled that the check refuses only what the write breaks (ADR Amendment 2), and run 2 ran with that check.

**Run 2: 23 of 23 passed** (`report-main.json`), on concept `live teapot jf5c`. It ran on `_properties.js` uncommitted, with Amendment 2's check. Before `c6a2ea51`, that file changed twice more: the check's comment, which then named Amendment 2, and `pieceInput`'s refusal of a `__proto__` key. Review round 1 (finding 2) asked for this account. The live check ran again on the commit at round 1's fixes (below).
- **L1:**
  - add-property lands, catching up name, slug and description first, nothing filled in, and judges the three derived elements;
  - a nested property is required under its parent;
  - making volume required stops the three elements fitting, and the rule's check form, run in the container, finds exactly those, with the same problems;
  - remove-property takes address and city out of the tree and the schema;
  - set-schema adds brand, and the schema reads back as given; the same schema again is `unchanged`, with no entry;
  - the Properties tab's own query lists each field with its type and its parent;
  - mark-field marks volume. Its type can't then change (`marked-field`), and its description can;
  - the hygiene check finds the primary property's record consistent with the schema.
- **L2:** two add-property calls at once on one concept both landed. The same add twice at once answered one `added` and one `already-exists`, with one node.
- **L3:** after a firmware reinstall, the property nodes, their tags and relationships, and the schema node's JSON were as before. Each node's derive stamp (`tapestryJsonUpdatedAt`) was left out of the comparison, since a reinstall's derive pass sets it.
- **L5:** an admin agent with its own key, through nginx and the external CLI, added spout, updated it, set the schema with lid, and removed spout, each recorded as its own; the concept's history gave the four newest first. A visitor through nginx got 401.
- **L6:** the relay held 465 events before the seed and 465 after L1's writes: none of them signed. The count didn't bracket L2, L5 or L7 (review round 1, finding 6); the suites' spy covers those, and the run on the committed code brackets every write.
- **L7:** on a concept with 1,000 elements, all derived, add-property took 0.74 s (catching up first, judging each element before and after) and set-schema 0.34 s. Making the elements took 120 s and the derive pass 6.1 s.

**L4, after it: 1 of 1 passed** (`report-restored.json`). Backup `20261118T020341Z-db606e37` (6.3 MB: 9,674 nodes and 9,177 relationships), taken after run 2, was uploaded to a fresh instance and restored there:
- the transaction (21933) and the counts matched exactly, and the instance took the backup's assistant;
- the property nodes, with their tapestryKeys, labels, properties, tags and relationships, and the schema node's JSON, were as run 2 left them.

Each `down` first checked that the container mounted this worktree's `src/`. The instance is removed after the check.

### Review round 1's fixes (2026-11-17)

Review round 1 passed with nine non-blocking findings, and the owner chose to fix them before the PR: ADR Amendment 3 (`d8a8bb1b`), the Tester's cases (`0e2039e0`), and the fixes (`27f1a985`).
- **The suites, each alone with every endpoint dead:** add-property 15/0, update-property 11/0, remove-property 8/0, set-schema 9/0, properties-agent-through-cli 1/0. On the code before the fixes, `1ab4e00c`, the new cases failed: add-property 14/1, update-property 9/2, set-schema 7/2 (the test plan's "Added at review round 1").
- **The scoped gate,** the same five registry entries through the gate engine. `npm run gate:status -- --label a10-18-story-18-round-1-fixes` reads:
  `20261118T031634Z-20933-134f [a10-18-story-18-round-1-fixes] started 2026-11-18T03:16:34.639Z on 27f1a985+dirty — PASS, exit 0, 1015 passed, 0 failed, 6 skipped, 5/5 suites`
  - The dirty path is the untracked `node_modules` link alone.
- **harness-lint** is clean. A code-point scan of every file touched, counting combining marks too, finds none this branch added.
- **The live check, again, on the commit** (`main-round2.log`, `report-main-round2.json`; ledger row `2026-11-17-live-check-records-name-no-commit`'s fix, tried here):
  - It ran on a fresh scratch stack, set up as before (`hand-calls.md`, "Review round 1's fixes"). Its report stamps code `27f1a985c576ecca7d930d6e4996aca8e20ce370`, with nothing beside it but the `node_modules` link.
  - **24 of 24 passed,** on `live teapot z8sw`: L1, L2, L3, L5 and L7 as before.
  - **L6** counts the relay at five points: before the seed, after L1, after L7, after the reinstall, and at the end. Each held 465, so it now brackets every write of the run, the agent's among them.
  - **L3** compares the schema with the one read before the reinstall.
  - **L7:** on a concept with 1,000 elements, add-property took 0.69 s and set-schema 0.34 s.
  - **L4,** the restore, wasn't run again: the fixes touch the inputs' checks and the address lookup, not what a backup holds.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Rebuild bullet)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D1, D2, D4, D9, D10, D15); catalog §2, Properties and schema; BIBLE §9 and §30
- The field marks AC7 refuses for: [stories/graph-operations-foundation/5-field-mapping.md](../graph-operations-foundation/5-field-mapping.md)
- The concepts these change: [16-create-concept-and-update-concept.md](16-create-concept-and-update-concept.md)
- The rule the reports call: ADR [0020](../../decisions/graph-operations-first-slice/0020-create-element.md) and [0020a](../../decisions/graph-operations-first-slice/0020a-the-document-a-schema-describes.md)
- The external CLI the agent uses: [stories/graph-operations-foundation/6-external-cli-and-agent-skill.md](../graph-operations-foundation/6-external-cli-and-agent-skill.md)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md](../../decisions/graph-operations-first-slice/0018-property-operations.md)
- Test plan: [18-property-operations.test-plan.md](18-property-operations.test-plan.md)
- Review: [engineering-team/reviews/graph-operations-first-slice/18-property-operations.md](../../reviews/graph-operations-first-slice/18-property-operations.md) (round 1, PASS, nine non-blocking findings)
