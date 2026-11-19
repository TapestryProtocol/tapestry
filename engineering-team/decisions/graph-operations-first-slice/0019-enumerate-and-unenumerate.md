# ADR 0019: `graph enumerate` and `unenumerate` — one `ENUMERATES` from the source's superset to the property, carrying only its type, and a rule of its own that checks each `tapestry:` value against the source when it is written, with no copy of the allowed values

**Status:** Accepted (the owner, 2026-11-18: Option A, with the four proposed story amendments)
**Date:** 2026-11-18
**Story:** `engineering-team/stories/graph-operations-first-slice/19-enumerate.md`
**Amends:** ADR graph-operations-first-slice/0018, Consequences (`:354`): `graph enumerate` gives no piece an `enum`.
**Extends:** ADR graph-rules/0002 (Loom A10.42): its `tapestry:<tapestryKey>` form names a node as a field's whole value too.

## Context

Story 19 asks for a pair of graph writes. `graph enumerate` links a property of one of the instance's own concepts to another concept, with one `ENUMERATES` from that concept's superset to the property node, and nothing else changes (AC1). From then on, a value of the field is `tapestry:<tapestryKey>`, naming an element of the source from the owner's point of view; a list holds several (AC2). The new element writes refuse a value that isn't allowed, the allowed values follow the source with no further call, elements written before the link are reported and never refused, and nothing that today's routes or an import write is checked (AC3). It is safe to repeat (AC4). `graph unenumerate` takes the link out (AC5). AC6 lists the refusals, and AC7 asks that it last and reach agents. The owner resolved the story's three questions as drafted: the shape is BIBLE §6's; a value is `tapestry:<tapestryKey>` only; and the link can be taken back, in this story. With the story he approved four things the principles settle: the link carries its type and nothing else (his rule *reducibility*); the values follow the source as it is when a value is checked, from the owner's point of view; the element writes check, and nothing else does; and the property stays where it is in its tree.

The base is staging at `9f1b4818`, which branch `A10.19-graph-enumerate` is level with. These are the facts the design rests on.

1. **The link today.** The story's Background gives the four shapes, the local instance's five firmware edges (all superset → JSON schema), today's route and what it did to Grok Bots on the owner's hosted instance. In code, the type is firmware's `PROPERTY_ENUMERATION`, whose alias `relAlias('PROPERTY_ENUMERATION')` gives as `ENUMERATES` (`src/api/normalize/firmware.js:71–80`). The new stack's alias map `K.rel()` doesn't name it yet (`src/operations/catalog/graph/_concepts.js:65–79`). The old routes use `REL.PROPERTY_ENUMERATION` (`src/api/normalize/index.js:23–35`), and firmware install and apply-enumerations the literal (`src/firmware/install.js:797`; `src/api/normalize/index.js:5979`). The rule `relationship-type-allowed` reserves the type for `graph enumerate` (`src/operations/rules/relationship-type-allowed.js:44`), so `graph add-relationship` and `remove-relationship` refuse it. Firmware's own definition says `conceptHeader → property`, category `propertyTree` (`firmware/active/concepts/relationship-type/elements/property-enumeration.json`).
2. **The property writes** (`_properties.js`, `P` below; ADR 0018).
   - `requireInstalled(read)` (`:596–610`) and `conceptOfProperty(read, key)` (`:613–619`, query `:497–500`), which walks `IS_A_PROPERTY_OF*1..33` to a primary property and its header. It answers `null` for no node, a node that isn't a property, and a primary property. It refuses `tangled-tree` when the node reaches two concepts.
   - The header's lock, `S.lockNode(tx, key)` (`_sets.js:257–260`), the write's first write (ADR 0018 Amendment 1, item 6).
   - `load(read, concept, …)` (`:628–694`) runs every concept and tree check in order: unknown concept, `not-own-concept`, `firmware-concept`, no key, `no-schema`, `no-primary-property`, `tangled-tree`, and a schema that can't be caught up to. It plans the catch-up in memory only.
   - `commit(tx, read, st, { target, frame })` (`:727–962`) writes the catch-up, rebuilds the JSON schema node, runs rule 4 over what it writes (`:878–910`), reports on the concept's elements (`reportOf`, `:1046–1087`) and builds the `PROPERTY` answer (`now(ref)`, `:917–940`). Nothing else can build that answer. add-property's `already-exists` calls it with the section unchanged (`add-property.js:103`, `:118`), so the catch-up lands even when the call changes nothing of its own.
   - A property's piece is in its node's `json` tag, at `property.schema` (`recOf`, `:545`). No helper reads `enum`. `P.has` (`:58`), `pathOf` (`:395–400`) and `placeOf` (`:314`) are exported.
3. **What the property writes do to a property's relationships.** A property commit removes is read whole into the change entry (`:812`; `was.relationships`, `:1013`, `:1026`), then deleted with `DETACH DELETE` (`:510–511`, run at `:815–816`). So `remove-property`, `set-schema` and a catch-up take an `ENUMERATES` into a removed property with it, and the answer doesn't say so. update-property can change an enumerated property's type, with nothing to stop it. The tree read follows only outgoing `IS_A_PROPERTY_OF` (`:485–491`), so an incoming `ENUMERATES` never tangles a tree.
4. **Rule 4, `element-fits-schema`** (`src/operations/rules/element-fits-schema.js`; its check is `src/operations/catalog/graph/_schemas.js`).
   - Its items are `{ concept, json }`, the JSON a write is about to store, with the problems only about `graphContext` set aside; or `{ node }` and `{ node, concept }`, a node's tapestryJson from the store (`:8–23` of the rule).
   - The schema is read from the JSON schema node's `json` tag (`_schemas.js:72–106`) and compiled by ajv 8.18 with `{ allErrors: true, strict: false }`, once per call (`:123–131`, `:213–231`). Nothing in `src/` adds an ajv keyword or format, and nothing beyond JSON Schema runs inside the rule.
   - Its refusals are `invalid-fields` (400) and `no-schema` (409). `checkElements` (`_schemas.js:266–275`) throws the first, or every one, and is tied to this rule by name (`:269`).
   - The derive step judges through the same check (`src/lib/derivers/schema-verdicts.js:39`), so the two give one verdict (ADR 0042; SC9).
5. **How the element writes run it.** Each declares it as a guard with empty items, so that its refusals are listed and `/docs` names it (`create-element.js:90`, `update-node.js:130`, `add-to-concept.js:90`; `src/operations/index.js:41–48`; `openapi.js:63–64`). The real check is in apply, after the write's locks:
   - create-element locks the header (`:106`) and checks the concept named (`:159`);
   - update-node locks the node (`:160`), then each judged concept's header (`:182`), and checks every concept whose section changed, reporting every finding (`:289–292`);
   - add-to-concept locks the node, then the header (`:105–106`), and checks when the JSON changes (`:202–209`).

   A rule's `violations(items, read)` gets no transaction, so a rule takes no lock.
6. **The property writes' report doesn't call the rule.** `reportOf` rebuilds the verdict from `F.elementsOf` (everyone's elements, the first 10,000 by key; `_fields.js:265–291`), `X.validatorOf` (a check with no graph read; `_schemas.js:173–182`) and each element's tapestryJson from the store. It names at most 50 (`MAX_LISTED`, `_properties.js:52`). No graph write starts a derive, so an element made since the last derive pass is counted as not judged. Test AP7 pins the rule's node form to this report.
7. **The owner's point of view** is `R.resolvePov(read, value)` (`src/operations/reads.js:156–165`), `R.trust(v, keep)`, a fragment of a read's Cypher (`:171–179`), and `R.trustParams(pov)` (`:182–184`), with `R.ownKeys()` (`:147–150`). Only reads use them today. `list-elements` composes the class-thread walk with `trust('e')` (`list-elements.js:34–43`, `:135–157`). No helper answers "does this concept's class thread reach node K" from a point of view: `M.reaches` (`_memberships.js:372–380`) stops at sets, and `F.conceptsOfNodes` (`_fields.js:432–452`) has none. Rule 2 takes the other stance for itself: "Any element in that class thread counts, whoever wrote it" (`relationship-type-allowed.js:14–15`).
8. **`tapestry:` in code.** Nothing parses it: `src`, `ui/src`, `clients`, `bin`, `scripts`, `setup` and `test` were searched. `graph resolve` reads a prefixed ref as a name (`src/operations/resolve.js:118–143`). Keys are matched exactly (`:154`), and every path that mints one mints it lowercase (`src/lib/tapestry-key-cypher.js:26`; `lifecycle/_migrations.js:202`; `src/api/tapestry-key/index.js:25–26`), though `KEY_PATTERN` accepts A–F (`_nodes.js:46`). Rule 9, `tapestry-link-names-a-node`, is proposed and has no code (`docs/GRAPH_RULES.md` §9).
9. **The write path and history.**
   - `attempt` (`src/operations/write.js:46–68`) runs the guards with `g.items(inputs)`, then apply, then the change entry, recorded only when there are changes.
   - A write declares `repeatKey`, guards naming loaded rules, and `result…change` (`declaration.js:177–198`). An undeclared refusal code becomes a 500 (`refusal.js:3–4`; `index.js:158–162`).
   - A change entry's keys are its `node`, `from`, `to`, `concept` and each of its `nodes` (`changes.js:95–105`), and `graph history` finds it by any of them. add-relationship records `relationship-added` `{ type, from, to }` (`add-relationship.js:58`).
   - `/docs`, the route table and both CLIs are made from the declarations, with nothing per operation (`src/operations/index.js:6–10`; `clients/cli/src/operations.js:2–6`). The catalog is hand-written (`docs/GRAPH_OPERATIONS_CATALOG.md:46`, `:96`, `:229–230`).
10. **Relationship letters.** Today's route signs `39999:<TA>:<d>`, with `nodeFrom`, `nodeTo` and `relationshipType` tags and a `z` naming the relationship concept (`src/api/normalize/index.js:4190–4203`).
    - `relationshipEvents(read, { from, to, authors })` (`_memberships.js:497–518`) finds the instance's own such letters through the relationship concept's class thread, with the type fixed to `TERM` (`:515`). It isn't exported. A letter a reinstall's pass 1d hasn't wired into that concept is left out (`:494–496`).
    - Tag nodes have only a uniqueness constraint on `uuid` (`setup/neo4jConstraintsAndIndexes.sh:48`), so finding a letter by its tags alone means reading every tag.
    - Nothing makes an edge again from a letter's tags (ADR 0022 Amendment 2, item 4). `src/api/io.js:567–597` links only the relationships a graph word lists in its own JSON.
11. **The derive step** derives a schema node with the word deriver (`src/lib/derivers/index.js:22`), which reads no `ENUMERATES`.
12. **The rulebook.** `docs/GRAPH_RULES.md` has nine entries, rule 9 proposed. Each gives Says, Kind, Refuses or reports, Check, Repair, Enforced by, Status and Source.
    - `node src/firmware/graph-rules.js` makes one element of the graph rule concept per entry, copying the code's summary and refusals (`graph-rules.js:124`, `:186–216`, `:240–275`).
    - An instance gets a new or changed item only at a firmware install (`GRAPH_RULES.md:29`).
    - The list of rules is fixed in `test/graph-rule-firmware.test.js:67`, `test/firmware-element-sync.test.js:190`, `:275` and `test/graph-rules-builder.test.js:102`.
13. **The audit's wiring rule** accepts only ListHeader → Property, in three inline copies (`src/api/audit/index.js:141`, `:359`, `:783`). The story puts it out of scope.

No concept's definition changes. Concepts read: any concept, through its header and superset; `39998:<TA>:property`; `39998:<TA>:relationship-type` and its `property-enumeration` element; `39998:<TA>:relationship`, for the letters; and `39998:<TA>:graph-rule`, which gains an element (Decision 13).

## Options considered

### Option A — A rule of its own checks each value against the source when it is written, and the link is the only record *(chosen)*

`graph enumerate` writes one `ENUMERATES` and nothing about values. A new rule, `enumerated-value-allowed`, rule 10 of the rulebook, takes the same `{ concept, json }` items as rule 4. For each property of the concept that an `ENUMERATES` ends at, it reads the field's value or values, and asks the graph, in one read, whether each is `tapestry:<tapestryKey>` of a node the source's class thread reaches, from the owner's point of view. The three element writes run it in apply, right after rule 4, over the same items. Enumerate runs it over the concept's elements to report.

- **Pros.** The allowed values are the source as it is when a value is checked, however the source changed: by an operation, today's routes, an import, or a change in the owner's web of trust (principle 3). Nothing is stored per source or per point of view, and no write into the source has to touch another concept. The link carries its type alone (reducibility), and the schema stays what its tree says (BIBLE §30). Rule 4 and the derive step keep their one verdict (ADR 0042). The check is cheap: one read finds a concept's enumerated properties, and one more checks every value a write holds.
- **Cons.**
  - The schema node doesn't show the allowed values. A reader that has only the schema, such as today's element form or an outside validator, can't see them; it reads the link (`graph list-relationships` on the property), then the source (`graph list-elements`).
  - A new rulebook entry and graph rule item, and a second guard on each of the three writes.
  - It is the first write-time check that reads from a point of view. The same value can be allowed today and not tomorrow, as the owner's scores change. Values already written aren't checked again; `rules check` (A10.31) will.

### Option B — Copy the allowed values into the property's piece as an `enum`, and renew the copy when the source changes

ADR 0018 expected this ("will give a piece its `enum` from another concept's elements", `:354`), and apply-enumerations works this way for firmware's five. Enumerate writes `enum: ["tapestry:…", …]` into the piece, perhaps as a `oneOf` with each element's name as its title, and the schema node is rebuilt. Rule 4 enforces it with no change.

- **Pros.** The schema node says everything, so any JSON Schema reader, the element form included, sees the allowed values. Rule 4, its refusals and the derive step stay as they are, and agree.
- **Cons.**
  - **Every write that changes the source's elements would rewrite every property it enumerates:** create-element, add-to-concept, remove-from-concept, delete-node, and link-set and unlink-set, which change the class thread. Each would lock another concept's header, the property's, which opens lock orderings across concepts that no write takes today.
  - **Today's routes and the import change the source without renewing it** (D15), so the copy goes stale, and AC3's "by today's routes" fails.
  - **It stores the result of a read from a point of view,** principle 3's named mistake. The owner's point of view moves when scores do, which no write sees.
  - **The schema grows with the source.** Every element write compiles its concept's schema afresh (fact 4), so a source of thousands of keys costs every write in the enumerating concept. The tree would hold derived data, where BIBLE §30 counts a schema as recomputable from its tree.

### Option C — Check the values inside `element-fits-schema`

Option A's check, placed in rule 4's `violations` after the schema check, under rule 4's name.

- **Pros.** No new rule, rulebook entry or guard. Every caller of rule 4 gets the check, including `create-set` and the property writes' check of what they write. The refusal stays `invalid-fields`.
- **Cons.**
  - Rule 4 would then judge something the derive step doesn't, breaking ADR 0042's one verdict. Keeping it would need graph reads in the derive step and in `X.validatorOf`, whose check reads nothing (facts 4 and 6).
  - AP7's pairing of the rule's node form with the property writes' report would part, unless `reportOf` gained the same graph read.
  - A value that names a node the source doesn't hold isn't a misfit with the schema, so `invalid-fields` would name the wrong thing.

## Decision

We chose **Option A**, because it is the only one in which the allowed values are always the source as it stands, from the owner's point of view, with nothing stored that can go stale, and it leaves rule 4, the derive step and the schema as they are. What it gives up is a schema that shows its allowed values to a reader that reads nothing else. A later story can add that as a copy the derive step keeps in the cache, rebuilt from the link: the serialized side the owner's glossary entry on horizontal integration describes. Enforcement would never read it.

1. **The link.** `(:Superset)-[:ENUMERATES]->(:Property)`, written with `MERGE`, with no properties. Its start is the source header's superset, by the class thread's initiation link. Its end is the property node. Its type comes from `relAlias('PROPERTY_ENUMERATION')`, added to `K.rel()` as `ENUM`. A property has at most one: a second source is refused (Decision 2, step 9). Edges that end at a JSON schema, as firmware's five do, are never read by anything this ADR builds.
2. **`graph enumerate`, step by step.** It is a property write. Each step either refuses, changing nothing, or goes on:
   1. `P.requireInstalled`.
   2. `P.conceptOfProperty(read, property)`. `null` is refused `unknown-property`, and a node that reaches two concepts `tangled-tree`.
   3. `S.lockNode(tx, <the property's concept header>)`: the first write. Every read after it sees the concept as it now stands.
   4. `P.load(read, concept, …)`, with every check fact 2 lists. A firmware concept, another author's and a tangled tree are refused here.
   5. The property's record from the caught-up tree, `P.findRec(st.t1, property)`. Its piece must hold a reference (Decision 4), or the call is refused `not-enumerable`.
   6. The piece must accept a reference (Decision 4), or the call is refused `refuses-references`.
   7. The source (Decision 3).
   8. The `ENUMERATES` already into the property. One from the source's superset makes the call a repeat, `already-enumerated`.
   9. One from anywhere else is refused `enumerated-elsewhere`, naming its start, that start's concept when it is a superset, and `graph unenumerate`.
   10. `P.commit(tx, read, st, { target: st.section1, frame: st.doc0 })`, the schema unchanged, as add-property's `already-exists` calls it. It writes any catch-up and gives the `PROPERTY` answer, and its own report on the schema.
   11. The `MERGE`, unless the call is a repeat.
   12. The values report and the allowed list (Decision 9).
3. **The source.** `source` is a tapestryKey, read as a header, `ConceptHeader` or `ListHeader`.
   - **Refused `unknown-concept`:** a key that names no node, or names a node that isn't a header. For a superset or a set, the refusal names the headers whose class thread reaches it (`X.conceptsReaching`, `_elements.js:257`), as the key to pass.
   - **Refused `reserved-source`:** a header keyed `word` or `graphContext` (`X.RESERVED_KEYS`), whose class threads reach nearly every node.
   - **Refused `no-superset`:** a header with no superset, or more than one.
   - The property's own concept may be its source.
   - A firmware concept may be the source, and so may another author's.
4. **A property that can hold a reference.**
   - **What it may hold.** The piece's `type` is `string`, or a list of types whose members other than `null` are `string` alone. Or the piece is a list: `type` `array`, with `items` an object whose `type` follows the same rule. Anything else is `not-enumerable`.
   - **What it must accept.** The piece is compiled alone, with rule 4's ajv options, and must accept `tapestry:00000000-0000-4000-8000-000000000000`, or a list holding it. Anything that would refuse every reference is `refuses-references`, naming `graph update-property` to take it out: the piece's own `enum` or `const`, or a `pattern`, `format` or length a reference can't meet, and the same in `items`. This widens AC6's "an `enum`" (proposed amendment 2).
5. **`graph unenumerate`.**
   - Its steps are enumerate's 1 to 4 and 10.
   - Then it takes out every `ENUMERATES` into the property, from wherever it starts, and counts them.
   - Then it looks for letters that claim the link: `relationshipEvents`, exported and given a `type`, defaulting to `TERM` so that its one caller doesn't change: `ownLetters` (`_memberships.js:535`), which remove-from-concept and move-element use (`remove-from-concept.js:213`, `move-element.js:342`). It is called with `type: ENUMERATES`, each removed edge's start's address as `from`, the property's address as `to`, and `R.ownKeys()` as `authors`. The answer says the search covers only letters a reinstall has wired into the relationship concept, as `LETTERS` already says (`_memberships.js:153–156`). That may leave out the one today's route signed for Grok Bots.
   - A property with none answers `not-enumerated`. Nothing makes the link again (fact 10), and taking a letter back is `export nostr`'s (A10.34).
6. **A value.** A value is `tapestry:` followed by a key as the graph mints it: lowercase, in the UUID's 8-4-4-4-12 form. Anything else is not a reference: an uppercase key, a bare key, a name, a slug, an address, an empty string or a number.
   - A string field holds one. A list holds any number, each judged on its own.
   - A `null` in a field whose type allows it, or a field left out, is not judged.
   - A reference is allowed when its key names a node, not a change entry or a tag, that the source's class thread reaches, `(sup)-[:PROP*0..]->()-[:TERM]->(e)`, and that counts from the owner's point of view, `R.trust('e')` with `R.trustParams(await R.resolvePov(read, 'owner'))`.
7. **Rule 10, `enumerated-value-allowed`,** in `src/operations/rules/enumerated-value-allowed.js`.
   - **Items:** `{ concept, json }`, as rule 4's write form.
   - **Its first read** finds the concept's enumerated properties: each `(:Superset)-[:ENUMERATES]->(p:Property)` whose `p` hangs, by a chain of `IS_A_PROPERTY_OF` through properties only, under the concept's primary property, and from there to its header. Each chain gives a path, the properties' names from the section down. An edge to the JSON schema node is never part of a chain, so Grok Bots' `project`, which has one, is found by its chain through the primary property. A property with more than one chain is judged at each.
   - **Its second read** takes every reference the items hold, from `json[<key>][…path]`, and answers which are allowed, all in one `UNWIND`.
   - **Its finding:** `{ item, concept, code: 'value-not-allowed', field, values, source, message }`. The message names the field by `P.placeOf`, each value, why it isn't allowed (not a reference; names no node; a node the source doesn't hold, or doesn't hold from the owner's point of view) and the source concept by name and key. It gives the way on: `graph resolve` to turn a name into its key, `graph list-elements` on the source for its elements, or `graph create-element` there to add one.
   - **Its refusal:** `value-not-allowed`, 400. A concept with no enumerated properties costs its first read only.
8. **The element writes run it.** create-element, update-node and add-to-concept each declare `{ rule: 'enumerated-value-allowed', items: () => [] }` beside rule 4's guard, and in apply, right after their `checkElements` call, run it over the same items. They throw the first finding, or for update-node every finding, through one helper beside `checkElements` in `_schemas.js` that takes the rule's name. Each still checks only what it checks today: create-element the concept named; update-node each concept whose section changed; add-to-concept the concept named, when the JSON changes. Rule 10 adds no lock: a source changed by another write at the same moment can let a value through that no longer names an element, and `rules check` finds it later.
9. **The values report and the allowed list.**
   - **`values`, the report on the property's concept's elements.** It is judged by rule 10's check, from each element's JSON as `F.elementsOf` gives it: everyone's elements, the first 10,000 by key, and the same `json` tag the element writes check. It is not judged from the store, where an element made since the last derive pass has no entry (fact 6).
     - Shape: `{ judged, notAllowed: { count, elements: [{ node, name, address, field, values }] }, limit, beyond }`, naming at most 50.
     - It never refuses (AC3). This judges as the element writes judge, rather than "as the property writes judge" (proposed amendment 1).
   - **`allowed`, the source's elements from the owner's point of view.** `{ count, elements: [{ node, name, address }], more }`, the first 50 by tapestryKey, as list-elements orders them, and counted to 10,001. The rest are a `graph list-elements` call away.
10. **The answers.**
    - **enumerate:** `outcome` (`enumerated` or `already-enumerated`), `property`, `source` (`{ concept, name, superset }`), `allowed`, `values`, and the property writes' `caughtUp`, `filledIn`, `elements`, `letterOutOfDate` and `cacheOutOfDate`, and `change`.
    - **unenumerate:** `outcome` (`unenumerated` or `not-enumerated`), `property`, `source` (or `null`), `removed` (the count), `letters` (`{ addresses, searched }`), the same property-write fields, and `change`.
    - A repeat that finds the tree out of line catches it up and records that, as add-property's `already-exists` does. Otherwise a repeat records nothing (proposed amendment 4).
11. **Change entries.**
    - `enumeration-added`: `{ type: 'ENUMERATES', from: <superset>, to: <property>, concept: <source header>, nodes: [<the property's concept header>] }`.
    - `enumeration-removed`: the same, with `count`.
    - `graph history` finds each by the property, the superset, the source and the property's concept. commit's own catch-up changes go in the same entry.
12. **Locks and repeats.** Both writes lock the property's concept's header first, so they go one at a time with each other and with every property write on that concept. Two enumerates at once of one property make one link: the second finds the first's edge and answers `already-enumerated`. An element write in that concept also takes the header's lock (fact 5), so it sees the link or doesn't, never half of it.
13. **The rulebook and the rule's item.** `docs/GRAPH_RULES.md` gains `## 10. enumerated-value-allowed`, with status enforced, Enforced by the three writes, and Source this ADR. `node src/firmware/graph-rules.js` makes its graph rule element. Its Check says that `rules check` (A10.31) will run it over every element, in a node form this ADR doesn't build.
14. **What this changes in other ADRs.**
    - **ADR 0018's Consequences (`:354`):** enumerate gives no piece an `enum`. A one-line note there points here, as ADR 0003's notes point at ADR 0009.
    - **ADR graph-rules/0002:** its `tapestry:` form now also names a node as a field's whole value. A whole value is not markdown: a renderer shows the target's name, and `export nostr` (A10.34) has to rewrite whole values as well as links. A memo on A10.34 records it.

### Story amendments (approved with this ADR, 2026-11-18)

1. **AC3:** "judged as the property writes judge them (ADR 0018)" becomes "judged from each element's JSON as the element writes read it, and reported as the property writes report: counted, at most 50 named, never refused". Why: the property writes judge each element's cached copy, which an element made since the last derive pass doesn't have (fact 6).
2. **AC6, third bullet:** "one whose schema already lists its own allowed values (an `enum`)" becomes "one whose own schema would refuse every `tapestry:` value: its own `enum` or `const`, or a `pattern`, `format` or length a reference can't meet". Why: each of these would leave a property no value can fill (Decision 4).
3. **AC6, fifth bullet:** "a source with no superset" becomes "a source with no superset, or more than one".
4. **AC1, AC4 and AC5:** the answers also carry the property writes' `caughtUp`, `filledIn`, `elements`, `letterOutOfDate` and `cacheOutOfDate`. A repeat that finds the concept's tree out of line with its schema brings it in line and records that, as every property write does; otherwise it records nothing. Why: both operations are property writes, and only commit builds the property's answer (fact 2).

## Consequences

- **Agents can integrate concepts horizontally through the new stack,** with checks on every write and nothing signed. This is the first operation of the K5 capability built in tapestry. K5.1 still decides how the link and its values travel as letters.
- **The link Grok Bot made counts the day this lands.** Its edge is BIBLE §6's shape, so rule 10 reads it. 11 of Grok Bots' 13 elements name a project, each by its name, so every write to one of them that changes its section is refused until its `project` is a reference. Each takes one `graph update-node` with `--fields '{"project": "tapestry:<key>"}'`, which the refusal suggests. They can be changed before the deploy too, since nothing checks them yet.
- **Firmware's five keep working as they do,** with their bare values and static enums. Their edges end at a JSON schema, which nothing here reads.
- **Write-time checks now read from a point of view.** An element by an author the owner's web of trust doesn't score above the cutoff isn't an allowed value, and the verdict moves when the scores do. Values already written aren't checked again; `rules check` (A10.31) will find each that no longer names an allowed element, as rule 9 will find dead links.
- **The schema node doesn't list the allowed values.** A picker on the element form (epic graph-curation-ui) reads the link and the source. A serialized copy in the derive step's cache is left for later (Decision).
- **Property writes can drop or break a link silently** (fact 3). remove-property, set-schema and a catch-up take a link out with its property. Their change entries keep it, under `was.relationships`, but their answers don't say so. update-property can retype an enumerated property so that it holds no reference, and its report then shows every element as not fitting. A ledger row records both, for a guard like `marked-field`'s.
- **The audit keeps flagging every link these writes make,** as it already flags today's route's. Ledger row `2026-11-19-enumerates-has-two-shapes` covers it.
- **Today's enumerate route keeps adding its extra edge to the schema** (D15). An agent that uses it tangles the concept's tree, as Grok Bot did.
- **Firmware reinstall required?** Not for the operations or the check, which work at once. Yes for rule 10's item in the graph rule concept, which `node src/firmware/graph-rules.js` makes. As with rule 9's item, it can wait for the next install.

## Implementation notes

- **New:** `src/operations/catalog/graph/_enumerations.js`, required when first called, as the other `_*.js` modules are:
  - `REF` (the value's pattern) and `refOf(value)`, which gives the key or `null`;
  - `holdsReference(piece)`, from Decision 4's type rule;
  - `acceptsReference(piece)`, which compiles the piece with ajv's options from `_schemas.js` and checks the sample;
  - `sourceOf(read, key)`, which gives the header, its superset or a refusal (Decision 3);
  - `linksInto(read, propertyKey)`, the `ENUMERATES` into a property, each with its start and the start's concept;
  - `enumeratedFieldsOf(read, conceptKey)` and `judgeValues(read, items, pov)`, rule 10's two reads;
  - `allowedOf(read, supersetKey, pov)`;
  - `valuesReport(read, conceptKey, fields, pov)`;
  - the refusal declarations `NOT_ENUMERABLE`, `REFUSES_REFERENCES`, `ENUMERATED_ELSEWHERE`, `RESERVED_SOURCE` and `NO_SUPERSET`, and the result schemas `SOURCE`, `ALLOWED`, `VALUES` and `LETTERS_ENUM`.
- **New:** `src/operations/catalog/graph/enumerate.js` and `unenumerate.js`.
  - Group `graph`, kind `write`, access `owner-and-admins`.
  - Inputs: `property: N.keyInput(…)`, and `source: N.keyInput(…)` for enumerate.
  - `repeatKey`: `['property', 'source']` and `['property']`.
  - `guards`: `[{ rule: 'element-fits-schema', items: () => [] }]`, so `no-schema` and `invalid-fields` stay declared, as the property writes declare them.
  - `refusals`: every one `load` and `commit` can give, as update-property and remove-property list them (`update-property.js:60`, `remove-property.js:84`), plus `P.UNKNOWN_CONCEPT` for `source` and the five above.
- **New:** `src/operations/rules/enumerated-value-allowed.js`. It requires `_enumerations.js` and `reads.js` inside `violations`, since the rules' loader opens nothing (ADR graph-operations-foundation/0004, Decision 4).
- **Changed:**
  - `src/operations/catalog/graph/_schemas.js`: a helper beside `checkElements` that runs a named rule over items and throws its first or every finding, without changing `checkElements` itself.
  - `create-element.js`, `update-node.js` and `add-to-concept.js`: the second guard, and the call after `checkElements` (`:159`; `:289–292`; `:202–209`).
  - `_memberships.js`: `relationshipEvents` takes `type` and is exported.
  - `_concepts.js`: `K.rel()` gains `ENUM: relAlias('PROPERTY_ENUMERATION')`.
  - `src/operations/rules/relationship-type-allowed.js:44`: `'graph enumerate and unenumerate'`.
- **Docs:**
  - `docs/GRAPH_RULES.md` gains its tenth entry; then run `node src/firmware/graph-rules.js`.
  - `docs/GRAPH_OPERATIONS_CATALOG.md`: the enumerate row takes `property` and `source` and lists its refusals; a new unenumerate row; "At a glance" becomes 62 operations, with unenumerate in the properties group; and the map of old routes (`:229–230`) sends apply-enumerations to rule 10.
  - **BIBLE §6:** the `ENUMERATES` row says it carries only its type, and a short paragraph on allowed values (`tapestry:` values, checked when written, from the owner's point of view).
  - **BIBLE §29:** the paragraph on `tapestry:` that ADR graph-rules/0002 left for its first story, covering links and whole values.
  - ADR 0018's note at `:354`.
- **Loom and the ledger.**
  - A memo on A10.34, that `export nostr` must rewrite whole `tapestry:` values.
  - A ledger row for the property writes that drop or break a link (Consequences).
- **For the Tester (Phase 3), not the Implementer:**
  - suites for enumerate, unenumerate and rule 10;
  - cases in the create-element, update-node and add-to-concept suites for a value that isn't allowed, one that is, a list, a source element added after the link, and one by an author below the cutoff;
  - the rule lists in `test/graph-rule-firmware.test.js:67`, `test/firmware-element-sync.test.js:190`, `:275` and `test/graph-rules-builder.test.js:102`;
  - the external CLI's agent run on a scratch stack (AC7).

## Out of scope

- A serialized copy of the allowed values, in the schema node or in the derive step's cache, and showing them in today's UI.
- Rule 10's node form, `{ node }`, for `rules check` (A10.31), and checking values already written.
- Values by name, slug or another field; a set as the source; more than one source (the story's Out of scope).
- The letter: how the link and a `tapestry:` value are written as events and read back (K5.1, K5.5), and `export nostr`'s rewrite (A10.34).
- Bringing firmware's five edges, firmware's definition, the audit and apply-enumerations into line (ledger row `2026-11-19-enumerates-has-two-shapes`), and repairing Grok Bots' tangled tree (`rules repair`, A10.31).
- A guard in the property writes against dropping or retyping an enumerated property (the ledger row above).
