# ADR 0020: `graph create-element` — an element is the letter its write would sign, and one shared check holds it to its concept's schema

**Status:** Accepted
**Date:** 2026-11-16
**Story:** `engineering-team/stories/graph-operations-first-slice/20-create-element.md`

## Context

The story asks for one graph write. `graph create-element` makes an element of a concept, directly under its superset, with no event, and with the address, tags and word-wrapper JSON a letter for it would carry (AC1). Given a set in the concept's class thread, it puts the element there, and reports every other concept the element joins (AC2). It checks the element's JSON against the concept's JSON Schema before writing, refuses JSON that doesn't fit with every problem listed, makes up no value, and refuses a concept with no schema (AC3). It is safe to repeat by name within the concept (AC4), refuses what AC5 lists, carries the concept's marked fields on the node (AC6), defines BIBLE §10's rule 4 once, as its guard and as a check that the later element writes reuse (AC7), and lasts through a firmware reinstall and a restore, reaching agents through both CLIs (AC8). At the story's gate the owner chose `concept` required and `set` optional, the named concept's schema checked and the others reported, and a required field left out refused.

What the code offers today:

1. **The write path** (ADR graph-operations-foundation/0004 Decisions 2 and 3). A guard's items come from the inputs alone, `rule.violations(guard.items(inputs), tx.read)`, before `apply` runs. A write whose rule needs what it reads runs the rule again inside `apply` and throws its refusal with `rule` set: create-concept after its lock (`K.recheck`, ADR graph-operations-first-slice/0016 Decision 6), and link-set after its `MERGE` (ADR 0028 Decision 9). A guard's refusals join the operation's own (`guardRefusals`, `src/operations/index.js:41`).
2. **A node with no event** (ADR 0016 Decision 1). `_eventless.js`'s `makeNode(tx, { uuid, kind, labels, name, tags, pubkey, createdAt })` makes the node the import would make of the letter, with labels from a fixed list that holds `ListItem`, and the import's tag nodes.
3. **Today's create-element** (`src/api/normalize/index.js:1778`). Its d-tag is `dtag.childDTag(name, <header address>)`, the name's slug and an eight-character hash of the header's address. Its tags are `d`, `name`, a `z` for the header plus one for each shared concept the header's `b` pointers name (`selectPointerTargets`, `src/lib/bValueForms.js:73`), and `json`. It links the superset to the element and checks nothing. For a concept today's create-concept made, the JSON it makes up is `{"<key>": {}}`, which that concept's schema refuses.
4. **Two places check JSON against a schema today, after the fact.** The derive step (`src/lib/derivers/word.js:136–180`) takes each schema's `jsonSchema` section, drops `$schema`, and validates the node's whole JSON with `new Ajv({ allErrors: true, strict: false })`, against every concept whose class thread reaches the node or whose header a `z` tag names *(corrected by Amendment 1, item 1: it validates its own `base`, not the node's JSON)*; it keeps the verdict in the cached JSON (`graphContext.parentJsonSchemas`). The Health Audit's core-node check (`src/api/audit/index.js:22`, `:622–725`) does the same with `validateSchema: false`. The installed ajv is 8.18 (`package.json`), whose default class reads draft-07's keywords; today's schemas name draft 2020-12 in `$schema`, and use `type`, `properties`, `required`, `enum`, `definitions`, `allOf` with `if` and `then`, and `contains` (firmware's dog).
5. **What a schema asks.** create-concept's (`src/operations/catalog/graph/_concepts.js:205–239`) asks for `{"<key>": {name, slug, description}}`, each text, `required` at both levels. Firmware's dog (`firmware/versions/v1.0.0/concepts/dog/json-schema.json`) requires `word` and `dog`, and ties `dog.breed` to `word.wordTypes`.
6. **How firmware's elements name themselves.** 62 of firmware's 82 element files (`firmware/versions/v1.0.0/concepts/*/elements/`) have `word.slug` `<concept slug>--<element slug>` and `word.name` `<concept name>: <element name>`, such as dog's rover, the JSON data types, the nostr kinds and the relay. The other 20, the relationship types and the graph rules A10.41 generates, use their own slug. Every one has a `word.title`, and `wordTypes` of `word` and the key of each concept it belongs to (rover: `["word", "dog", "goldenRetriever"]`).
7. **Sets and class threads** (`src/operations/catalog/graph/_sets.js`, ADR 0028). `nodeOf`, `kindOf` (a superset or a set is a node so labelled that has an address), `supersetOf`, and `lockNode`, which takes a write lock on one node for the rest of the transaction. `_fields.js`'s `mapNodes` reads every concept header whose class thread reaches a node (`:392–399`).
8. **Field mapping** (ADR graph-operations-foundation/0005 Amendment 2.7). `mapNodes(tx, keys)` brings a write's nodes in line with the marks of every concept they belong to, and returns `{ set, removed, skipped }`; `copyChanges` turns that into the entry's `copies-set` changes.
9. **What a reinstall does to elements** (`src/firmware/install.js:650–704`, `:812–870`; `handleWireImplicitElements`, `src/api/normalize/index.js:5832`). Pass 1d links each `ListHeader:ConceptHeader`'s superset to every `NostrEvent|ListItem` node whose `z` tag names it. Pass 1e then takes out such a direct link for firmware concepts with a manifest, when the node is also below the superset through a set. Pass 3 runs wire-implicit-elements, which wires the same links and takes out redundant ones for every concept, but only after the first concept in the run that wired anything: its count, `totalWired`, runs across concepts.
10. **Stamps are for publishing.** "Stamping is the act of choosing the set of `z` tags a deliberately-published list item carries" (protocols/drafts/stamping.md).
11. **Inputs from a command line.** Both CLIs turn text into inputs with ajv's `coerceTypes: 'array'` (`src/operations/inputs.js:11`; `clients/cli/src/operations.js:22`), which never makes an object. No operation takes an object input yet. A JSON body may be up to 100 MB (`bin/control-panel.js:124`).
12. **The rulebook in the graph** (ADR 0041). A rule is an entry in `docs/GRAPH_RULES.md` and a file in `src/operations/rules/`. `node src/firmware/graph-rules.js` makes each entry an element file of the graph rule concept, and `test/graph-rule-firmware.test.js` fails while the files differ from what it makes.

Concepts touched, by handle (`<TA>` is the instance's assistant, `GET /api/assistant/pubkey`): any concept, through its header, superset and JSON schema (read; the new element joins it); `39998:<TA>:superset` and `39998:<TA>:set` (read: `set` may be either); `39998:<TA>:neo4j-property` (read: its first set holds the marks); `39998:<TA>:graph-rule` (one element added, by firmware). On the local instance, `superset` has 31 elements and `set` 102 (`/api/concept-graph/summaries`, 2026-11-16).

## Options considered

The question is how an element is held to its concept's schema, so that one definition serves this write, `rules check` (A10.31) and the element writes after it.

### Option A — One shared check, and the rule run in `apply` on the JSON the write builds

A module of its own, `_schemas.js`, reads a concept's schema and checks JSON against it, the way the derive step does. The rule `element-fits-schema` is defined with it, once. create-element declares the rule as its guard, so its refusals are listed with the operation's, and runs it in `apply` once it has built the element's JSON, as create-concept and link-set run their rules again in `apply`. Its guard's items are empty: the JSON it judges needs the graph.

- **Pros:** the write path doesn't change. The rule judges exactly the JSON that is written. The later element writes, which also build their JSON from what they read, call the same check the same way.
- **Cons:** the guard's first run has nothing to judge, so a reader of the declaration has to know that its check is in `apply`.

### Option B — Guards that read

Extend the write path (ADR 0004 Decision 3) so a guard's items may read the transaction: `items(inputs, read)`, awaited. The guard builds the element's JSON before `apply`.

- **Pros:** the guard's first run judges something.
- **Cons:** it changes the path every write goes through, for every later write. The JSON is built twice, and the rule must still run again after the lock, since a schema can change between the two. It amends a foundation decision for one operation's sake.

### Option C — A check inside create-element only, with no rule

- **Pros:** the least code.
- **Cons:** it breaks D3: a rule is defined once and used as a guard and in `rules check`. A10.21, A10.22 and A10.18 would each copy it.

## Decision

We chose **Option A**. It leaves the write path alone, judges the very JSON written, and gives the later element writes one call. Option B's gain, a guard that judges before `apply`, buys nothing here: everything the write could refuse with needs the graph, and the second run is needed anyway.

**1. The inputs** (`src/operations/catalog/graph/create-element.js`, `owner-and-admins`):
- `concept` (required): a concept header's tapestryKey (`N.keyInput`).
- `name` (required): text, up to 1,000 characters as given, checked once cleaned (Decision 5).
- `set` (optional): the tapestryKey of a set or superset in the concept's class thread.
- `fields` (optional, `{}` when left out): the concept's fields, as an object or its JSON text. Its schema is `oneOf: [{ type: 'object' }, { type: 'string', maxLength: 1000000 }]`, so a JSON body sends an object and a command line sends text, and neither CLI changes (fact 11). The text must parse to a JSON object. The owner chose this over teaching both CLIs to make objects (2026-11-16).

`repeatKey: ['concept', 'name']`. The guard is `element-fits-schema`, with `items: () => []` (Decision 12).

**2. The steps,** in one transaction:
1. Check what needs no graph: the name (`bad-name`, Decision 5); `fields` (`bad-fields`: text that isn't a JSON object, or a `name` or `slug` other than the ones the name gives; equal ones are dropped); and the assistant's key, the would-be author (`not-installed`, 409, when the instance has none).
2. Take the lock on the concept's header (Decision 7).
3. Read the concept (`F.conceptOf`): `unknown-concept` (404) for a key that names no concept header. Then `made-elsewhere` (409) for a concept whose elements another operation makes (Decision 4), `reserved-key` (409) for a concept keyed `word` or `graphContext` (Amendment 1, item 2), and `no-superset` (409) for a concept with no superset (rule 1).
4. Find where the element goes, and the concepts that reach it (Decision 3): `unknown-node` (404), `not-a-set` (409) and `not-in-class-thread` (409) for a bad `set`.
5. Look for the repeat (Decision 6). When there is one, answer `already-exists`, with no change and no entry.
6. Choose the address (Decision 5): `no-free-address` (409).
7. Build the element's JSON (Decision 8). `bad-fields` when its text is longer than 1,000,000 characters.
8. Run the rule on it (Decision 12): `invalid-fields` (400) or `no-schema` (409), with `rule`.
9. Make the node and its tags (Decision 9), and its link (Decision 10).
10. Carry its marked fields (Decision 13), check it against the other concepts it joins, for the answer (Decision 14), and record the entry (Decision 15).

Nothing is written before step 9, so every refusal leaves the graph as it was.

**3. Where the element goes.**
- **The target** is `set` when given, else the concept's superset (`S.supersetOf`). A `set` that names no node is `unknown-node`, naming `set`. One that isn't a superset or a set by `S.kindOf` is `not-a-set`; a concept header among those names its superset, the key to pass.
- **The concepts that reach the target** are every concept header whose class thread reaches it (E2): its superset is the target or above it through `IS_A_SUPERSET_OF` links. They are the concepts the element will belong to (rule 3), the named one among them.
- **A `set` outside the concept's class thread** is one whose concepts don't include the named one: `not-in-class-thread`, naming the concept and its superset. A `set` that is the concept's own superset is the same as none.

**4. Concepts whose elements another operation makes** (`made-elsewhere`, 409). An element of one of these would look like a node another operation makes, with none of its wiring. The refusal names the operation to use:
- the concept-header concept, and the seven core-node concepts (`superset`, `json-schema`, `primary-property`, `properties-set`, `property-tree-graph`, `concept-graph`, `core-nodes-graph`): `graph create-concept`;
- `set`: `graph create-set` (A10.27);
- `property`: `graph add-property` (A10.18);
- `graph-rule`: the rulebook, through firmware (ADR 0041).

Each is matched by its firmware address on this instance (`firmware.conceptUuid(<slug>)`), so another author's concept of the same slug is not one of them. `graph` stays open: the catalog makes a selection saved as a graph with create-element. Every other concept takes an element: another author's, such as a shared concept, as the instance's own claim (CLAUDE.md principle 2), and a firmware one, such as `relationship-type`. *This refusal is not in the story's AC5: it is this ADR's addition, which the owner approved with the ADR (2026-11-16).*

**5. Name, slug and address.**
- **The name** is cleaned with `CN.cleanName` and refused `bad-name` (400) on `CN.nameProblem` (`src/lib/conceptNames.js`), as create-concept refuses a name, worded for an element. A name in a script other than Latin alone has no slug, and is refused, as a concept's is (ADR 0016's known limit).
- **The slug** is `dtag.slug(name)`, the slug today's d-tag uses.
- **The address** is `39999:<TA>:<d>`, with `d = dtag.childDTag(name, <the concept header's address>)`, as today's route gives it. When any node holds it, `d` takes the first free versioning nonce, `childDTag(name, address, 1)` to `99`, read with ADR 0016's C4. Past that, `no-free-address` (409).

**6. The repeat.**
- **What counts.** An element of the concept, anywhere in its class thread, made by this instance's assistant, with a letter or without (as ADR 0016 Decision 4 counts concepts), whose name, lowercased, is the cleaned name lowercased, or which sits at the address the name gives, with or without a nonce (E3). When there are several, the one at the plain address is taken, then the lowest tapestryKey. Another author's element is never the repeat: its address isn't the assistant's.
- **What the answer says.** `already-exists`, the element (Decision 14), and `differs`, each input given that differs from what it holds: `{ input: 'name', given, holds }` when the names differ at all, case included; `{ input: 'set', given, holds }` when the given set isn't one of its direct parents, `holds` being their tapestryKeys; and `{ input: 'fields.<field>', given, holds }` for each field given whose value differs from its JSON's, compared as JSON. A repeat checks no fields against the schema: it writes nothing.
- **A known miss.** An element today's route made under a custom or random d-tag, with another name that gives the same slug, isn't found, so a second element with that slug is made beside it. `rules check` is where such pairs would be found.

**7. The lock.** `apply` first takes a write lock on the concept's header with `S.lockNode(tx, concept)`, which sets and removes a property, so nothing of it is committed. Neo4j holds it until the transaction ends, so two creates in one concept go one at a time, and the second finds what the first made. Every later read comes after it. A key that names no node locks nothing, and step 3 refuses it. The element writes after this one (A10.21, A10.22) and the schema writes (A10.18) take the same lock, so an element is never judged against a schema that is changing (Decision 16).

**8. The element's JSON** is word-wrapper JSON, with keys in this order:

```json
{
  "word": {
    "slug": "<concept slug>--<element slug>",
    "name": "<concept singular name>: <element name>",
    "title": "<concept singular title>: <element name>",
    "wordTypes": ["word", "<the named concept's key>", "<each other concept's key, sorted>"]
  },
  "<the named concept's key>": { "name": "<element name>", "slug": "<element slug>", "<field>": "…" }
}
```

- The `word` block follows most of firmware's elements (fact 6): the concept's slug joined to the element's keeps the word slugs of two concepts' elements of one name apart, as dog's rover and a car named Rover would be.
- `wordTypes` lists the key of each concept that reaches the target (Decision 3), each once, since membership is the edges (D10). So a dog put in the golden retrievers' superset, when that superset is in dog's class thread, lists `goldenRetriever`, as firmware's rover does.
- A concept's key, slug, singular name and title come from its header (`K.headersByKey`, then `headerOf`): its `oKeys`, `oSlugs`, `oNames` and `oTitles`, else the names derived from its name.
- The section holds the name and slug, then the fields in the order given. No value is made up (the owner's answer, open question 3).
- The JSON is stored inline, in the `json` tag, never as an LMDB reference.

**9. The node and its tags.** `E.makeNode(tx, { uuid, kind: 39999, labels: ['ListItem'], name, tags, pubkey: <TA>, createdAt })`. Its tags are those of the letter the write would sign, in this order: `d`, `name`, `z` with the concept header's address, `n` with the set's address when the target is a set other than the concept's superset (class-thread-relationships.md), and `json`.

**No stamps.** Today's route adds a `z` for each shared concept the header's `b` pointers name (fact 3). Stamps are chosen for a letter deliberately published (fact 10), and `export nostr` (A10.34) is the deliberate publish, so it adds them when it builds the letter. Until then, the element's link to a shared concept follows from its concept's `b` pointer in the graph (BIBLE §25). Stamping here would also make a reinstall add memberships the write never made (fact 9).

**10. The link.** One `HAS_ELEMENT` link, from the target to the element, by add-relationship's `MERGE`, which must find both nodes (ADR 0016's `count(r)` check). Nothing else is wired. For an element directly under its superset, a reinstall's passes add nothing and take nothing out. For one in a set, pass 1d adds a direct link from the concept's superset, since its `z` names the concept. Pass 1e takes that link out again for a firmware concept, and wire-implicit-elements may or may not, depending on the run (fact 9). Either way the element belongs to the same concepts and sets as before (Decision 17). Wiring the superset's link here too would make no end state certain.

**11. The shared check** (`src/operations/catalog/graph/_schemas.js`, new). It reads and checks as the derive step does (fact 4), so the operation, `rules check` and the derive step's `parentJsonSchemas` give one verdict *(narrowed by Amendment 1, item 1: they read a schema alike, but check different documents)*:
- `schemaOf(read, concept)` → `{ schema }` or `{ problem }`. It reads the concept's JSON schema nodes and their json tags (E1), and resolves an LMDB reference (`F.readJson`'s way). It takes the `jsonSchema` section, else the object itself, and drops `$schema`. The problem says why there is none: no JSON schema node, more than one (rule 11; which one counts isn't guessed), no json tag, JSON that doesn't parse, an LMDB entry that is missing, or something other than an object.
- `problemsOf(schema, json)` → `{ problems: [{ path, message }] }` or `{ problem }`. It compiles the schema with a new `new Ajv({ allErrors: true, strict: false })` for each schema, so an `$id` never clashes, and reads `problem` when it doesn't compile. Each error becomes a path and words:
  - the path is the JSON pointer as dots, `dog.breed`, or "the element's JSON" at the top;
  - `required` names the missing field: "`dog.description` is required";
  - `additionalProperties` names the extra one: "`dog.color` isn't a field the schema takes";
  - `enum` lists the values allowed, and `type` names the type;
  - every other keyword gives ajv's message.
- `fits(read, concept, json)` → `{ fits: true | false | null, problems, problem }`. It is null when there is no schema to check against.
- `checkElements(read, items)` runs the rule `element-fits-schema` over the items and throws its first finding as the write path does, with `rule` set, as `K.recheck` does. This is the one call each element write makes in `apply` (Decision 16).

**Which dialect.** The schemas name draft 2020-12, but the derive step reads them with ajv's default class, draft-07's keywords. Every keyword today's schemas use means the same in both (fact 4). Reading 2020-12 here (`ajv/dist/2020`) would make this check and the derive step disagree on any schema that later uses a keyword only 2020-12 has, such as `prefixItems` or `unevaluatedProperties`. When a schema needs one, the derive step and this check move together: the derive step can call `_schemas.js`. *(It does, since ADR graph-operations-first-slice/0042: a concept's schema describes a node's tapestryJson (ADR 0020a), and both readers judge it through `_schemas.js`.)*

**12. The rule `element-fits-schema`** (`src/operations/rules/element-fits-schema.js`, new). It says that an element's JSON fits the JSON schema of each concept it belongs to (BIBLE §10, rule 4; D9). It refuses. Its refusals are `invalid-fields` (400), JSON that doesn't fit, and `no-schema` (409), a concept whose schema is missing or can't be read, or doesn't compile. Its items:
- **`{ concept, json }`:** the JSON a write is about to store, judged against that concept's schema. This is create-element's after step 7, and the later writes' (Decision 16). An `invalid-fields` message lists every problem, at most 20 and then how many more. A key that names no concept header gives no finding, since the operation's own refusal answers for it.
- **`{ node }`, or `{ node, concept }`:** an element as it stands, read from its json tag (E4), judged against the schema of each concept whose class thread reaches it (`F.conceptsOfNodes`), or of the one named. That is one finding for each concept it doesn't fit, and one `no-schema` finding for each concept with no schema. JSON that can't be read gives one `invalid-fields` finding, saying so. A node no concept reaches gives none; that is rule 3's business. `rules check` (A10.31) and the property operations' reports (A10.18) use this form.

Within one call, a schema is compiled once for each concept. create-element's guard has `items: () => []`, with a comment pointing to this decision: its JSON comes from the graph, so the rule runs in `apply` (Option A). The declaration lists the rule's refusals through the guard, and `/docs` and the list show the guard.

**The rulebook's entry 7.** `element-fits-schema` goes into `docs/GRAPH_RULES.md`, in ADR 0041's format, with all eight fields:
- **Kind:** a graph rule. It guards the owner's and the admins' own element writes (D4), and as a check it judges every element by where it came from (D15): an import's element is reported, never refused.
- **Repair:** none yet; `graph update-node` (A10.21) changes a field.
- **Source:** this ADR.

Then `node src/firmware/graph-rules.js` writes its element file into firmware's graph rule concept.

**13. Marked fields.** After the link, `F.mapNodes(tx, [element])` carries every marked field of every concept the element belongs to, and `F.copyChanges` adds its `copies-set` changes to the entry. A field that can't be carried, and a concept whose section the element lacks, come back as `skipped`, which the answer gives.

**14. The answer:** `{ outcome, element, concepts, differs, copies, skipped, note?, change }`.
- **`outcome`:** `created` or `already-exists`.
- **`element`:** `{ tapestryKey, address, name, slug, concept, parents, hasLetter }`, where `parents` are the tapestryKeys of the supersets and sets it is directly in.
- **`concepts`:** on a create, each concept the element belongs to, the named one first, then by tapestryKey, as `{ concept, key, fits, problems, problem }`. The named one fits, or the write was refused; another may not (the owner's answer, open question 2). On a repeat, it is empty.
- **`differs`:** on a repeat (Decision 6); empty otherwise.
- **`copies`** and **`skipped`:** on a create, the node properties it now carries and what it couldn't carry (Decision 13); empty on a repeat.
- **`note`:** on a create, as create-concept's: the element is in this instance's graph only, and only a backup keeps it (BIBLE §30).

**15. The change entry.** A create records `{ change: 'element-created', node: <element>, concept: <named concept>, from: <target>, name, slug }`, then `copyChanges`' changes. `keysOf` already reads `node`, `from` and `concept`, so `graph history` finds the entry by the element, its concept or its set (AC1). In `changes.js`, the descriptions of `name`, `slug` and `from` widen to cover an element and the set it was made in.

**16. How the later writes use the check.** Each one declares `element-fits-schema` as its guard, takes the lock on the header of each concept whose section it changes (Decision 7), builds the JSON it would store, and calls `_schemas.checkElements(read, [{ concept, json }])` before it writes.
- **update-node (A10.21)** passes the JSON with the given fields merged in, for each concept whose section it changes.
- **add-to-concept (A10.22)** passes the node's JSON with the new concept's section, and reports each other concept the membership joins with `_schemas.fits`, as create-element does.
- **The property operations (A10.18)** change a schema, then, in the same transaction, run the rule as a check over the concept's elements (`{ node, concept }`) and report each one that stops fitting, never refusing. They take the same header lock, so an element write and a schema change on one concept never interleave.

**17. Durability (AC8).**
- **After a reinstall,** an element made here keeps its tags, its JSON and its node properties (a reinstall changes none of them). The class threads reach it from the same supersets and sets, perhaps with a redundant direct link from its concept's superset (Decision 10).
- **The derive pass** gives it its cached JSON, with a `parentJsonSchemas` verdict that agrees with this check (Decision 11; where they agree is Amendment 1, item 1). *(Since ADR 0042 the verdict is this check's, on the tapestryJson the derive step builds.)*
- **A backup** carries the whole graph, so a restore brings the element back with its key (ADR graph-operations-foundation/0002).

**18. The refusals,** each changing nothing and recording no entry:

| Code | Status | When |
|---|---|---|
| `bad-name` | 400 | The name is empty once trimmed, has no slug, has a control, text-direction or invisible character, or is longer than 200 characters |
| `bad-fields` | 400 | `fields` isn't a JSON object or its text; it gives a `name` or `slug` other than the name's; or the element's JSON would be longer than 1,000,000 characters |
| `unknown-concept` | 404 | `concept` names no concept header |
| `made-elsewhere` | 409 | The concept's elements are made by another operation (Decision 4) |
| `reserved-key` | 409 | The concept's key is `word` or `graphContext`, keys an element's JSON keeps for itself (Amendment 1, item 2) |
| `no-superset` | 409 | The concept has no superset (rule 1) |
| `not-installed` | 409 | The instance has no assistant key, the would-be author |
| `unknown-node` | 404 | `set` names no node of the graph |
| `not-a-set` | 409 | `set` is neither a set nor a superset |
| `not-in-class-thread` | 409 | `set` is outside the concept's class thread |
| `no-free-address` | 409 | The address the name gives is held, with each nonce to `~99` |
| `invalid-fields` | 400 | The rule's: the element's JSON doesn't fit the concept's schema, every problem listed |
| `no-schema` | 409 | The rule's: the concept's schema is missing, can't be read, or doesn't compile |

Beyond AC5's list: `made-elsewhere` is this ADR's addition, approved by the owner (Decision 4), and `reserved-key` is Amendment 1's (item 2). `not-installed`, `no-free-address` and the length limit in `bad-fields` are mechanics create-concept has too.

## Consequences

**What this enables**
- Elements with no event, checked against their concept's schema: the rebuild's element write (A10.39).
- One check of an element against a schema, for A10.21, A10.22, A10.18 and `rules check` (A10.31), and rule 4 in the rulebook and in the graph.
- The first object input, as `fields`, which both CLIs reach with no change.

**What this constrains**
- **Today's routes don't find these elements by name** among nodes that came from an event, as story 16 found for concepts. `graph list-elements` and the readers of `_fields.js` find them.
- **A schema of the old, flat shape refuses.** One whose fields sit at its top level, not under the concept's key, asks for fields the JSON doesn't have there, and the refusal names them. The JSON stays the protocol's namespaced shape (tapestry-concepts.md), and `graph set-schema` (A10.18) is the fix.
- **Another author's schema is compiled when an element joins that concept,** as the derive step already compiles it. ajv's generated code can't be injected into since version 7, but a schema can make checking slow, such as a pathological `pattern`. The concept is the caller's choice.
- **Element writes in one concept go one at a time** (Decision 7). That is fine at this scale; a bulk create (catalog §10, question 6) would hold the lock once for its batch.
- **An element made here has no cached JSON** until the derive step runs: a reinstall's derive pass, or `cache rebuild` (A10.36). Readers of the cache fall back to the json tag, as they do for create-concept's nodes.

**New debt and follow-ups**
- **The ledger gets a row** for wire-implicit-elements' prune, which depends on the run (fact 9): `totalWired` runs across concepts, so a concept's redundant links are taken out only when a concept before it, by name, wired something.
- **Stamps wait for `export nostr`** (A10.34), which should add them as today's route does (Decision 9).
- **The derive step's dialect:** when a schema needs a 2020-12 keyword, the derive step and `_schemas.js` move together (Decision 11).
- **`x-tapestry.unique`** for fields other than the slug stays unenforced (the story's Out of scope).
- **Firmware reinstall required?** Yes, but only for the graph rule concept's new element, rule 7's, which `rules list-rules` and the graph will show. create-element itself needs no reinstall.

## Implementation notes

- **`src/operations/catalog/graph/_schemas.js`** (new): Decision 11. It requires `ajv` and `_fields.js` when first called; it opens nothing at load (ADR 0001 Decision 10).
- **`src/operations/catalog/graph/_elements.js`** (new). It is what the element writes share:
  - `FIELDS_INPUT` and `parseFields(value)` (Decisions 1 and 2);
  - the refusals: Decision 18's that are the operation's own, with their wording;
  - `MADE_ELSEWHERE`, the slugs of Decision 4 and the operation each names;
  - `whereTo(read, { concept, conceptUuid, set })`: Decision 3, giving `{ target, setNode, concepts }`;
  - `findRepeat(read, ...)`: Decision 6;
  - `elementJson(...)`: Decision 8;
  - `elementTags(...)`: Decision 9;
  - `describeElement(read, key)`: Decision 14's `element`.
- **`src/operations/catalog/graph/create-element.js`** (new): Decisions 1, 2, 14 and 15.
- **`src/operations/rules/element-fits-schema.js`** (new): Decision 12. It requires `_schemas.js` when `violations` runs.
- **`src/operations/catalog/graph/_fields.js`:** `conceptsOfNodes(read, keys)`, the read `mapNodes` makes at lines 392–399, taken out and named, with `mapNodes` calling it. Its behaviour doesn't change.
- **`src/operations/changes.js`:** the descriptions of `name`, `slug` and `from` (Decision 15).
- **`docs/GRAPH_RULES.md` §7,** and its element file, from `node src/firmware/graph-rules.js` (`firmware/versions/v1.0.0/concepts/graph-rule/elements/element-fits-schema.json`).
- **`docs/GRAPH_OPERATIONS_CATALOG.md` §2,** create-element's row: `concept`, `set?`, `name`, `fields?`, and Decision 18's refusals and reports.
- **Statements.** Most are ones the fake graph already runs: S1 (`conceptOf`), R1, R2 and R3 (`_sets.js`), the lock (S8's shape), C4 (held addresses), C5 and C6 (`makeNode`), C7 (the `MERGE`), C8b (`headersByKey`), and `mapNodes`' reads and S8. The new ones, which the Tester teaches the fake where it can't run them:
  - **E1, a concept's schema nodes:** `MATCH (h:TapestryNode {tapestryKey: $key}) WHERE h:ConceptHeader OR h:ListHeader OPTIONAL MATCH (h)<-[:IS_THE_JSON_SCHEMA_FOR]-(js:JSONSchema) OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'}) RETURN js.tapestryKey AS schema, jt.value AS json`.
  - **E2, the concepts that reach a superset or set:** `MATCH (t:TapestryNode {tapestryKey: $key})<-[:IS_A_SUPERSET_OF*0..]-(s:Superset)<-[:IS_THE_CONCEPT_FOR]-(h) WHERE h:ConceptHeader OR h:ListHeader RETURN DISTINCT h.tapestryKey AS concept, h.uuid AS uuid`. The type names come from `relAlias`, as everywhere.
  - **E3, the repeat's candidates:** the class-thread walk from the concept's header (S4's), keeping elements with `e.pubkey = $ta AND (toLower(e.name) = $name OR e.uuid = $address OR e.uuid STARTS WITH $nonced)`, with each one's json tag and the tapestryKeys of its direct parents.
  - **E4, an element's JSON:** `MATCH (e:TapestryNode {tapestryKey: $key}) WHERE NOT e:GraphChange OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'}) RETURN head(collect(t.value)) AS json`.
- **Tests** (the Tester's, Phase 3), registered in `test/operations.test.js`:
  - a suite for the operation, one for the rule, and one for `_schemas.js`: the dialect (draft-07's reading, `$schema` dropped), each message's wording, and no `$id` clash;
  - a test for each refusal of Decision 18, and for each report: `differs`, `concepts`, `copies` and `skipped`;
  - an agent suite through the external CLI;
  - `test/graph-rule-firmware.test.js`, which passes once the element file is generated;
  - ADR 0004 Decision 10's guard that no new module requires anything that signs.
- **The live check** runs on a scratch stack (`scripts/scratch-stack.sh`), never the agent-memory instance. It covers:
  - an element made under a concept and one made in a set, and their repeats;
  - a refusal of fields that don't fit;
  - a reinstall, comparing each element's tags, JSON, properties and memberships, and after it the derive pass's `parentJsonSchemas` verdict;
  - a backup restored on a fresh stack;
  - an admin agent through nginx and the external CLI;
  - the relay's event count, unchanged.
- **Branches:** staging only, by the usual chain.

## Out of scope

- Fitting every concept an element joins, which is `graph add-to-concept` (A10.22); and changing an element, which is `graph update-node` (A10.21).
- Stamps, and how `export nostr` signs an element (A10.34).
- Moving the check to draft 2020-12, and the derive step's own use of `_schemas.js`.
- Uniqueness from `x-tapestry.unique` beyond the repeat.
- Nested objects as node properties (design §5, question 1).
- Today's create-element and add-to-set routes (D15), and their field mapping (A10.5.a).

## Amendment 1 (2026-11-16, at review round 1; the owner's approval) — what the derive step checks, and the keys an element keeps for itself

Review round 1 (`engineering-team/reviews/graph-operations-first-slice/20-create-element.md`) found two things this ADR got wrong. The session checked both against the code.

1. **The derive step checks another document. This corrects fact 4, Decision 11 and Decision 17.**
   - **What the derive step validates.** It doesn't validate the node's JSON. It validates its own `base` (`src/lib/derivers/word.js`):
     - the node's cached Tapestry JSON, when that has a `word` block (`:44`);
     - else the json tag's JSON, when that has one (`:63`);
     - else `{}` (`:75`).

     It fills in `word.slug`, `word.name` and `word.wordTypes` where they are missing (`:78–82`), and adds its own `graphContext` (`:122`) before `validate(base)` (`:165`). It judges a node against each `ConceptHeader` whose class thread reaches it within ten links, and each one a `z` tag names. The rule's check form judges a node against the concepts whose class threads reach it (D10).
   - **What they share.** Both read a schema the same way: the `jsonSchema` section, `$schema` dropped, ajv's default class, which reads draft-07's keywords, with `allErrors` and strict off.
   - **So the verdicts agree** for an element with a word block, under a schema that neither requires nor forbids `graphContext`, doesn't limit the element's top-level keys, and doesn't lean on the derive step's `word` defaults. Every schema create-concept writes is one, and so is every firmware schema but `word`'s, for an element whose word block has its slug, name and wordTypes, as every element create-element writes has. This is what the live check's L5 saw. *(Scoped at review round 2, 2026-11-16, with the owner's approval. `validation-tool`'s schema, for one, requires `word.slug`, which the derive step fills in when it is missing. A word block missing a field the derive step fills in is one of the ledger row's splits.)*
   - **They split** on firmware's `word` schema, which requires `graphContext`, and on a schema with top-level `additionalProperties: false`. They split also where the two judge different concepts.
   - **This stands until the derive step calls `_schemas.js`** (Decision 11's "move together"). *(It does since ADR 0042, which also has the rule judge a node's tapestryJson, as ADR 0020a decides; the ledger row is closed.)* A ledger row records it for `rules check` (A10.31) and the property operations' reports (A10.18), which are the two that judge elements already made.
   - **What changes:**
     - the rulebook's §7 and `_schemas.js`'s header say what holds, in place of "one verdict", and the element file is generated again;
     - the plan's SC5 is narrowed to what it compares, the reading of a schema;
     - a new test, SC9, runs the real derive step beside this check on both kinds of schema, with its database, store and resolver stubbed, so it stays stack-free.
2. **The keys an element's JSON keeps for itself: `word` and `graphContext`.** The owner approved refusing a concept keyed `word`, then this amendment with both keys (2026-11-16).
   - **Why these two.** An element's JSON has two top-level keys that aren't a concept's section:
     - `word`, its word block, which names it (Decision 8);
     - `graphContext`, which the derive step writes into the cached JSON.

     A concept's section filed under `word` would replace the word block, as the review's probe showed: `{"word":{"name":"Lexeme","slug":"lexeme","description":"a word"}}`, with no word block naming it. One filed under `graphContext` would be replaced in the cache.
   - **The refusal.** So create-element refuses a concept whose key is either, before it builds anything: `reserved-key` (409), in Decision 2's step 3, after `made-elsewhere` and before `no-superset`. The key is the one headerOf gives: `oKeys.singular`, else the key derived from the concept's name. The refusal names the key and says why.
   - **Firmware's own `word` is one.** Every node is a word through the word block its own write makes. Its schema requires the derived `graphContext`, so no element of it could pass rule 4 when written.
   - **Who else.** `update-node` (A10.21) and `add-to-concept` (A10.22) refuse the same keys (Decision 16). Decision 18's table has the row, `reserved-key`, 409, and Decision 2's step 3 names the refusal *(both added at review round 2)*.
3. **Two limits, recorded (the review's non-blocking findings 1 and 3). Neither changes the code.**
   - **Key order.** Decision 8's order holds for the keys JavaScript keeps in insertion order. Integer-like keys come first, as JavaScript orders them: a field named `"2"`, or a concept keyed `2024`. No reader depends on key order.
   - **Two creates in two concepts that share a set.** Each takes only its own header's lock (Decision 7). So a create in A made in B's superset, and a create of the same name in B, can both make an element when they run at once, at two addresses. Run one after the other, the second finds the first.
     - **The fix would be** to lock every header that reaches the target, in one order. It waits for a write that needs it; a ledger row records it.
   - **Also on the ledger:** the review's non-blocking finding 4, that the C8b statement `headersByKey` matches nodes with no label, so it can't use the `tapestryKey` index. That statement is shared with create-concept.
4. **What the tests and the code take from this.**
   - **New tests that fail first:**
     - firmware's `word` with its real schema, and another author's concept keyed `word` with a schema that takes any object, each refused `reserved-key` with nothing written;
     - a concept keyed `graphContext`, refused the same way;
     - SC9.
   - **CE22's case with no schema node** moves to a concept other than `word`, which `reserved-key` now refuses first.
   - **The review's non-blocking findings 2 and 5** are code fixes: `canon` copies with `Object.fromEntries`, and `_elements.js`'s index gives `describeElement`'s real signature. Finding 2 gets a test.

