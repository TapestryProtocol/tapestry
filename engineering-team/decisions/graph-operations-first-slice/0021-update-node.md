# ADR 0021: `graph update-node` — the stored JSON edited in place, each changed section held to its concept's schema, and one test of whose node it is

**Status:** Accepted
**Date:** 2026-11-16
**Story:** `engineering-team/stories/graph-operations-first-slice/21-update-node.md`

## Context

The story asks for one graph write. `graph update-node` takes one of this instance's own elements, `node`, and changes its fields, merged into its section for one concept (AC1). It can also rename it (AC2). It checks each section it changes against that concept's schema with create-element's check (AC3). It refuses a rename onto a name in use (AC4) and a node from someone else's event (AC5), with that test defined once for merge-nodes and delete-node. It refuses what AC6 lists, carries marked fields (AC7), and lasts through a reinstall and a restore, reaching agents through both CLIs (AC8). At the gate the owner settled four questions:
- sets wait for A10.21.a;
- a rename onto a name in use is refused, and the slug follows the name;
- the instance's own letters are its assistant's or its owner's;
- the cached copy is left as it is, and the answer says when it is out of date.

What the code offers today:

1. **The write path** (ADR graph-operations-foundation/0004 Decision 3). A guard's items come from the inputs alone, before `apply` runs. A write whose rule needs what it reads runs the rule inside `apply` and throws its refusal with `rule` set (`src/operations/write.js`). create-element declares `element-fits-schema` as its guard with `items: () => []` and runs it in `apply` after its lock (`src/operations/catalog/graph/create-element.js:89`, `:157–158`; ADR graph-operations-first-slice/0020 Option A).
2. **The shared element pieces** (`src/operations/catalog/graph/_elements.js`):
   - `cleanName` (`:144`) and `FIELDS_INPUT`, an object or its JSON text;
   - `RESERVED_KEYS`, `word` and `graphContext` (`:66`);
   - `MADE_ELSEWHERE` (`:73`), the concepts whose elements another operation makes, matched by firmware address;
   - `findRepeat` (`:229`), E3: this instance's assistant's element of a concept, anywhere in its class thread, with the name lowercased or at the address the name gives, the plain address first;
   - `canon`, which compares two values as JSON.
3. **The shared check** (`src/operations/catalog/graph/_schemas.js`). `checkElements(read, items)` (`:181`) runs the rule over `{ concept, json }` items and throws the first finding. `fits(read, concept, json)` gives a verdict for a report. ADR 0020 Decision 16: update-node "passes the JSON with the given fields merged in, for each concept whose section it changes", and takes the lock on each such concept's header.
4. **A node's concepts and copies** (`src/operations/catalog/graph/_fields.js`):
   - `conceptsOfNodes(read, keys)` (`:386`): the concept headers whose class thread reaches a node;
   - `readJson` (`:100`): reads a json tag, inline or `lmdb:<tapestryKey>`;
   - `writeCopies(tx, rows)` (`:308`): sets properties on nodes found by tapestryKey;
   - `mapNodes`/`copyChanges` (`:408`, `:432`): carry the marked fields and give the entry's changes.
5. **How update-concept writes** (`src/operations/catalog/graph/update-concept.js`). It changes a node's `name` and tapestryValue, and its tags' values, with `F.writeCopies` (`:143`). It adds a tag it lacks with `E.addTags` (`:145`) and writes a json tag held in the store back inline. It refuses a header whose author isn't the assistant (`:73`, `not-own-concept`). The rename rule (`K.renameRows`, `_concepts.js:673`) changes a value only where it still holds what the old names made.
6. **Whose node it is.** The read conventions answer `own` for a node whose author is null, or is one of `ownKeys()`, the assistant's and the owner's keys as events carry them (`src/operations/reads.js:142`, `:202`). `_sets.js` has its own `ownKeys()` (`:416`), unnormalized, for unlink-set's `peer-link`. A node has a letter when it has an event id (`n.id IS NOT NULL`, as `_sets.js`'s `nodeOf` reads it, `:89`).
7. **Locks.** `S.lockNode(tx, key)` (`_sets.js:246`) takes a write lock on one node for the rest of the transaction, by setting and removing a property. create-element locks its concept's header. Ledger row `2026-11-16-shared-set-creates-can-race` suggests every header that reaches the target, in one order.
8. **Firmware's own elements** (`src/firmware/install.js:233–323`).
   - Install makes each file `concepts/<slug>/elements/<file>.json` through today's create-element route. The name is `word.name` after its last colon, else the section's `name`, else `word.slug` (`:262–266`).
   - The route trims the name and gives the d-tag `dtag.childDTag(name, <the concept's header address>)` (`src/api/normalize/index.js:1784`, `:1877`), so the address is `39999:<TA>:<d>`.
   - On a reinstall the route finds an element by name. A firmware element whose name changed is made again at its old address, as its file says. A graph rule (the manifest's `updateElements`) is re-signed from its file every time.
9. **Firmware puts seventeen concepts under word.** The manifest's `sets.words['existing-sets']` puts the supersets of set, graph, property, relationship, relationship-type, node-type, graph-type, concept-header, validation-tool, validation-tool-type, json-data-type, image, image-type, list, nostr-user, nostr-relay and nostr-kind under word's. So every element of those is an element of `word` too, and word's schema requires `graphContext`, which no stored JSON has (ADR 0020 Amendment 1).
10. **The cache** (story fact 10). The derive step prefers a node's cached copy over its json tag, and stamps `tapestryJsonUpdatedAt` on the node when it writes one (ADR 0016, fact 5).
11. **Answers aren't validated against their declared schema** (`src/operations/http.js`). A result schema is the documentation that `/docs` and the list are made from.

Concepts touched, by handle (`<TA>` is the instance's assistant, `GET /api/assistant/pubkey`):
- any concept, through its header and JSON schema (read);
- the concept-header concept and the seven core-node concepts, `39998:<TA>:set`, `39998:<TA>:property` and `39998:<TA>:graph-rule` (read: their elements are refused);
- `39998:<TA>:neo4j-property` (read: the marks);
- `39998:<TA>:word` (read: reported, never judged for refusal).

On the local instance, `word` has 503 elements and `set` 120 (`/api/concept-graph/summaries`, 2026-11-16).

## Options considered

### Option A — Edit the stored JSON in place, judge the sections the edit changed, and decide whose node it is with one shared test

update-node reads the node's json tag and edits that JSON where the call asks: the fields merged into one section, and a rename's values where they held what the old name made. It then runs `element-fits-schema` on the result, for each concept whose section changed. Whether the node is someone else's is a function in `_nodes.js`, built on the read conventions' `own`, which update-node calls in `apply`. merge-nodes, delete-node and copy-node call it the same way.

- **Pros:** the write changes what was asked and nothing else, so an old element keeps its other sections, its word block and its key order (CLAUDE.md principle 4). `own` means one thing in every read and write. The write path doesn't change.
- **Cons:** an old element whose JSON doesn't follow create-element's shape keeps that shape. A rename of one with no word block, for one, leaves it with none.

### Option B — Rebuild the element's JSON from its name and fields with create-element's builder, then judge it

update-node builds the JSON afresh with `X.elementJson` from the node's name, its concept and its merged fields, as create-element builds a new element's.

- **Pros:** every element update-node touches comes out in create-element's shape, word block included, so old elements are normalized on their first change.
- **Cons:** it drops whatever the builder doesn't make: another concept's section, a word block's other fields, a field order. It changes what wasn't asked, which is repair's job (D15, `rules repair`). It can't serve an element of several concepts, whose sections the builder doesn't know.

### Option C — The ownership test as a rule of the rulebook, declared as a guard

A rule `node-is-own`, whose items are `[{ node: inputs.node }]`, refuses a node that is someone else's, as a guard before `apply`.

- **Pros:** it is listed with the guards, and has a rulebook entry.
- **Cons:** it isn't a property of the graph. Every node is someone's, so `rules check` (A10.31) has nothing to report with it (D3: a rule is a guard and a check). A rulebook entry is an element of the graph rule concept, so it needs a firmware reinstall to reach the graph (ADR 0041). The writes that use it have different inputs: merge-nodes has two.

## Decision

We chose **Option A**. It changes only what the call asks, keeps `own` one definition, and adds nothing to the write path or the rulebook. Option B's gain, normalized JSON, is repair's work, and rebuilding loses data. Option C's gain, a guard's listing, is had by listing the refusal itself. The test is a policy about writes, not a rule the graph can break.

**1. The inputs** (`src/operations/catalog/graph/update-node.js`, `owner-and-admins`):
- `node` (required): the element's tapestryKey (`N.keyInput`).
- `name` (optional): text, up to 1,000 characters as given, cleaned and checked by `X.cleanName` (`bad-name`).
- `description` (optional): text, up to 10,000 characters, as the other operations' descriptions are, trimmed. It is the section's `description` field. An empty one sets the field to `""`, since a concept's schema may require a description an agent leaves empty on purpose (story 20, open question 3). `fields: {"description": null}` takes it out.
- `fields` (optional): `X.FIELDS_INPUT`, an object or its JSON text. A value of `null` takes that field out (Decision 8).
- `concept` (optional): a concept header's tapestryKey, the concept whose section `fields` and `description` go in (Decision 6).

`repeatKey: ['node', 'concept', 'name', 'description', 'fields']`. The guard is `element-fits-schema` with `items: () => []`, as create-element's: the JSON it judges comes from the graph, so `apply` runs it (Decision 11).

**2. The steps,** in one transaction:
1. Check what needs no graph:
   - `nothing-to-change` (400) when none of `name`, `description` and `fields` is given;
   - the name (`bad-name`);
   - `fields` that isn't a JSON object or its text (`bad-fields`);
   - `description` beside `fields.description`: `bad-fields` when both are given and differ once trimmed, and the field then takes the trimmed text (Amendment 2);
   - the assistant's key: `not-installed` (409) when there is none. The tests of Decisions 3, 4 and 10 all need it.
2. Lock the node (Decision 5).
3. Whose node it is (Decision 3): `unknown-node` (404), then `not-own-node` (409).
4. The node's concepts (Decision 4):
   - `made-elsewhere` (409) when one of them is a concept whose elements another operation changes;
   - `firmware-node` (409) when the node is one of firmware's own elements;
   - `not-an-element` (409) when no concept but `word` reaches it.
5. Lock the headers of the concepts it judges (Decision 5).
6. The concept the section belongs to (Decision 6):
   - `unknown-concept` (404), `reserved-key` (409) or `not-its-concept` (409) for `concept`;
   - `concept-needed` (409) when it is left out and must be given.
7. The node's JSON and tags (Decision 7):
   - `unreadable-json` (409);
   - `no-section` (409) when `fields` or `description` names a section the JSON lacks.
8. Build the new JSON (Decisions 8 and 9):
   - `bad-fields` for a `name` or `slug` in `fields` that is neither the node's nor the section's;
   - `bad-fields` for JSON longer than 1,000,000 characters.
9. When nothing differs, answer `unchanged` (Decision 12).
10. A rename's name check (Decision 10): `name-in-use` (409).
11. Rule 4 on each changed section (Decision 11): `invalid-fields` (400) or `no-schema` (409), with `rule`.
12. Write (Decision 13). Carry the marked fields (Decision 14). Report (Decisions 15–17), and record the entry (Decision 18).

Nothing is written before step 12, so every refusal leaves the graph as it was.

**3. Whose node it is: one test, in `_nodes.js`** (AC5).
- **`whoseNode(read, key)`** reads U0 and returns `{ key, uuid, name, author, hasLetter, own }`, or null when no node has the key. A change entry never has it. `own` is the read conventions' own: `R.nodeOf({ tapestryKey, author }, R.ownKeys()).own`, computed by that very function, so a node counts as the instance's own in a write exactly when a read answers `own: true` for it. That means a null author, or one of the assistant's and the owner's keys.
- **`requireOwn(read, key, { input })`** answers that, or throws:
  - `unknown-node` (404), naming the input;
  - `not-own-node` (409), naming the node, its author and its address.

  For a node with a letter, the message says it came from an event its author signed. For one without, it says its recorded author is someone else, which is a node such as a `NostrUser`, whose `pubkey` is the person it stands for. Either way, it says that an operation never changes another author's node (D4), and that `graph copy-node` (A10.24) makes a copy of one's own, linked to theirs (D8).
- **`NOT_OWN_NODE`** is the refusal's declaration, which each write that calls `requireOwn` lists.
- **An admin's letter is someone else's** (the owner's answer, open question 3): an admin's key isn't one of `ownKeys()`. The instance can't send a new version of an admin's letter, since it doesn't hold the admin's key.
- **How the later writes use it.**
  - merge-nodes (A10.25) calls `requireOwn` on each node it changes or removes: `merge`, at least.
  - delete-node (A10.26) calls it on `node`.
  - copy-node (A10.24) calls `whoseNode`, since a node that isn't `own` is the one it copies.

  Each lists `NOT_OWN_NODE`. unlink-set's `peer-link` and update-concept's `not-own-concept` stay as they are. One is about a link a letter claims; the other, about a concept only the assistant's key can sign again.

**4. The node's concepts, and the ones it judges.**
- **Its concepts** are every concept header whose class thread reaches it (`F.conceptsOfNodes`), with their headers (`K.headersByKey`: each one's address, key, slug and names).
- **The judged concepts** are those whose key isn't one of `X.RESERVED_KEYS`. Rule 4 judges these sections (Decision 11). The name check looks in these (Decision 10). `concept` must be one of them (Decision 6). Leaving `word` out is this ADR's reading of the story's "the concepts the node belongs to":
  - word's section is the word block, which names the node;
  - its schema requires `graphContext`, which no stored JSON holds (ADR 0020 Amendment 1);
  - so judging it would refuse every rename of an element of the seventeen concepts under word (fact 9).

  `concepts` in the answer still reports `word` (Decision 17).
- **`made-elsewhere`** (409). `X.CHANGED_ELSEWHERE` lists, by firmware slug and in this order, the concepts whose elements another operation changes, and the operation each refusal names:
  - `concept-header`, `superset`, `primary-property`, `properties-set`, `property-tree-graph`, `concept-graph` and `core-nodes-graph`: `graph update-concept` (a concept's names, which its core nodes' names follow);
  - `json-schema`: `graph set-schema` (A10.18);
  - `property`: `graph update-property` (A10.18);
  - `set`: A10.21.a (the owner's answer, open question 1);
  - `graph-rule`: the rulebook.

  A node is refused when one of its concepts' headers sits at the firmware address of one of these slugs (`firmware.conceptUuid`, as `X.madeElsewhere` matches) *(widened by Amendment 1: or when it carries one of these nodes' role labels)*. The first in the list names the operation. So a concept's superset, an element of `superset` and of `set`, names update-concept.
- **`firmware-node`** (409). `X.firmwareElements()` works out, once per process, the address install gives each of the active firmware's element files (fact 8), mapped to the file's path. A node at one of those addresses is refused, naming its file. A firmware reinstall can make it again as its file says, and firmware changes through `lifecycle seed-firmware` (A10.37). An element of a firmware concept that firmware's files don't define is another matter: one of the owner's own relationship types, say, sits at no such address and changes like any other.
  - The name is derived from `install.js:262–266`, copied, since install doesn't export it. If install's changes, this must follow (as `_sets.js` says of its own copy of `categoryToSlug`).
- **`not-an-element`** (409) when the node has no judged concept. Either no concept's class thread reaches it, or only word's does. There is no section to change and no schema to check against (D9). `graph add-to-concept` (A10.22) makes a node an element.

**5. The locks.** `apply` first takes a write lock on the node (`S.lockNode(tx, node)`), so two updates of one node go one at a time and the second reads what the first wrote. Once it knows the judged concepts, it locks each of their headers, in tapestryKey order (ledger row `2026-11-16-shared-set-creates-can-race`'s fix shape).
- create-element locks its concept's header, and update-node locks every judged concept's header. So a rename and a create of one name, in any concept the node belongs to, go one at a time, and so do two renames onto one name.
- Locking every judged concept's header, not only those whose section changes, covers the name check, which looks in all of them. ADR 0020 Decision 16 asked for the headers of the concepts whose sections change, and these include them.
- One order, and nothing locked twice, means two updates can't deadlock each other. Nothing else takes these locks in another order: update-concept locks the concept-header concept's header and then writes headers, and update-node never locks that one.
- **A known gap.** The concepts are read before their headers are locked, so a link-set that brings the node into another concept meanwhile isn't seen. link-set itself checks no names among the elements a link brings (story 28), so this adds no new way to get two of a name.

**6. Which section** (AC1, AC6). `concept`, when given, is read with `F.conceptOf`:
- `unknown-concept` (404) when it names no concept header;
- `reserved-key` (409) when its key is `word` or `graphContext`;
- `not-its-concept` (409) when it isn't one of the node's judged concepts, listing those.

When `fields` or `description` is given and `concept` isn't, the node's one judged concept is the one. With more than one, the call is refused `concept-needed` (409), listing each concept and its key. The section is the JSON's value under that concept's key, among the JSON's own keys (Amendment 2). When it isn't an object, `no-section` (409) is the refusal: `graph add-to-concept` (A10.22) gives a node another concept's section.

**7. The node, read** (U1). Its address, name, tapestryValue and cache stamp, and every tag, each with its tapestryKey, type and value.
- **Its JSON** is the value of its `json` tags, read with `F.readJson`.
- **`unreadable-json`** (409) when there is no json tag, or more than one with different values (which one counts isn't guessed), or the JSON doesn't parse, or its LMDB entry is missing, or it isn't an object. Nothing could be checked.
- **Its old name** is its tapestryValue, else its `name`, as the read conventions answer a node's name.

**8. The merge** (AC1). It works on a copy of the JSON:
- **The section** is rebuilt with `Object.fromEntries`, so a field called `__proto__` stays a field.
- **The fields** are taken in the order given. Each one already there takes the value given, in its place. Each one given as `null` is taken out. Each new one goes at the end. A value that is an object or a list is replaced whole.
- **`description`**, when given, is the field `description`.
- **`name` and `slug` in `fields`** are merged after a rename is applied (Decision 9). `name` must be the node's name after the call, or what the section then holds; `slug` must be the slug that name gives (`dtag.slug`), or what the section then holds. Either is then set into the section. So an agent can restate a section's own values, as a read-modify-write does, and can give an old element's section the name and slug it lacks. One that is neither is refused `bad-fields`, and so is either given as `null`: the section's name and slug can't be taken out.
- **Nothing else changes:** other sections, the word block (except as a rename changes it), the order of keys.

**9. The rename** (AC2; the owner's answer, open question 2). When the cleaned `name` differs from the old name in any way, case included, the node is renamed:
- **The node:** its `name` and tapestryValue.
- **Its `name` tags:** each one's value. A node with none gains one, as update-concept adds a tag a node lacks, since the letter the write would sign has one.
- **Its sections:** in each top-level value of the JSON that is an object, other than `word` and `graphContext`, a `name` equal to the old name takes the new one. A `slug` equal to the slug the old name gives takes the slug the new name gives.
- **Its word block:** `name` and `title`, where one equals the old name or ends with `: <old name>`, take the new name in its place. `slug`, where it equals the old slug or ends with `--<old slug>`, takes the new slug in its place. That is create-element's shape (`dog--rover`, "dog: Rover"); every other value stays.
- **What never changes:** the address, the d-tag, the tapestryKey and the labels. So a letter published later lands on the node. create-element with the old name still answers this element, which sits at the address the old name gives.

**10. The name check** (AC4). For each judged concept, `X.repeatsOf` looks for the new name, as create-element's repeat looks, among the instance's own elements, its assistant's and its owner's (`R.ownKeys()`):
- one anywhere in the concept's class thread whose name, lowercased, is the new name lowercased;
- or one that sits at the address the new name gives in that concept, `39999:<TA>:<childDTag(name, header address)>`, with or without a nonce.

Any such element other than the node is a clash: `name-in-use` (409), naming it and the concept. Another author's element doesn't count, as it never counts for create-element. A concept header with no address is checked by name alone.
- **`repeatsOf`** is E3's statement with `e.pubkey IN $authors` in place of `e.pubkey = $ta`, returning every candidate, sorted as `findRepeat` sorts them. `findRepeat` becomes `repeatsOf` with `authors: [ta]`, taking the first, so create-element doesn't change.
- **Counting the owner's elements too** keeps the story's guarantee whole. With the assistant's alone, an owner's element of the name would pass, and two of the instance's own elements could share a name.

**11. Rule 4** (AC3). The changed sections are the target section, when `fields` or `description` changed it, and each section the rename changed, where the section's key is a judged concept's key. A concept is judged when its section is among them.
- `_schemas.checkElements(read, items, { every: true })` runs the rule on `[{ concept, json: <the new JSON> }]` for each such concept. With `every`, it throws one refusal: its code is the first finding's, its message joins every finding's, and it has `rule` set. So AC3's "every problem" holds when two concepts' sections both fail. Without `every`, as create-element calls it, nothing changes.
- A call that changes no section, only the node's name, judges nothing. Its `concepts` still say how each concept's schema sees the JSON.

**12. Unchanged** (AC1). When the new JSON equals the old (compared with `canon`) and the name is the old name, nothing is written and no entry is recorded. The answer is `outcome: unchanged`, with `changed` empty. This comes before the name check and rule 4, as create-element's repeat checks nothing, since it writes nothing.

**13. The write.**
- **The node:** when renamed, `F.writeCopies(tx, [{ key: node, props: { name, tapestryValue } }])`.
- **Its tags:** each `name` tag's new value, and each `json` tag's new value inline, by `F.writeCopies` on the tags' tapestryKeys. The JSON goes inline even when it was an LMDB reference, as update-concept writes it, so the graph holds the change (BIBLE §30). A tag with no tapestryKey is a failure (500), naming `lifecycle migrate`, as update-concept's is.
- **A missing name tag:** `E.addTags(tx, node, E.tagRows(uuid, [['name', name]], <the node's tag count>))`.
- **What stays:** its `id`, `pubkey`, `created_at`, labels and links. Nothing is signed or published.

**14. Marked fields** (AC7). After the write, `F.mapNodes(tx, [node])` brings the node's copies in line with every concept's marks. `F.copyChanges` adds the changes to the entry. The answer's `copies` are the node properties it now carries for its concepts' marks, sorted, and `skipped` is what couldn't be carried.

**15. The letter.** `letterOutOfDate` is true when the node has a letter and this call changed it. Its letter, by the instance's assistant or owner, now differs from the graph until `export nostr` (A10.34) sends a new one.

**16. The cache** (the owner's answer, open question 4). The cache isn't touched. `cacheOutOfDate` is true when the node carries `tapestryJsonUpdatedAt`, the derive step's stamp, and this call changed it. The derive step made a cached copy before the change, and readers of the cache see that copy until `cache rebuild` (A10.36):
- the node's JSON page;
- `GET /api/tapestry-key/:key`;
- a reinstall's derive pass.

The stamp is a fact of the graph, so this needs no read of the store. A store that has lost its copies since (D10) leaves the stamp behind, so the note says the cached copy *may* be out of date. A memo on A10.36 says that `cache check` can find every node changed after its stamp: its change entries are newer than the stamp, and name it in `keys`.

**17. The answer:** `{ outcome, node, changed, concepts, copies, skipped, letterOutOfDate, cacheOutOfDate, note?, change }`.
- **`outcome`:** `updated` or `unchanged`.
- **`node`:** the read conventions' five facts (`tapestryKey`, `name`, `address`, `author`, `own`), plus two:
  - `slug`: the target section's slug when there is one, else the slug its name gives;
  - `hasLetter`.
- **`changed`:** `name` when renamed, then `fields.<field>` for each field whose value changed, sorted. `description` is `fields.description`.
- **`concepts`:** each concept the node belongs to, `word` included, as `{ concept, key, fits, problems, problem }` (create-element's shape, `X.CONCEPTS`). Each fit is judged by `_schemas.fits` on the JSON as it now is. The target concept comes first, then the rest by tapestryKey. On `unchanged`, they judge the JSON as it is.
- **`copies`** and **`skipped`:** Decision 14; empty on `unchanged`.
- **`letterOutOfDate`** and **`cacheOutOfDate`:** Decisions 15 and 16, false on `unchanged`.
- **`note`:** on `updated`, a sentence saying the change is in this instance's graph only and nothing was signed, and when either flag is true, what it means.

**18. The change entry.** An update records:
- `{ change: 'node-renamed', node, was, now }` when renamed, with the old and new names;
- `{ change: 'field-changed', node, concept, field, was, now }` for each field changed, with `was` and `now` the field's JSON values, `null` for one it lacked or no longer has;
- then `copyChanges`' changes.

`keysOf` reads `node` and `concept`, so `graph history` finds the entry by the node, and a field's change by its concept too (AC1). `changes.js` widens:
- `was` and `now` to any JSON value, with no `type`, as create-element's `differs` declares `given` and `holds` (fact 11);
- `field` to an element's field;
- `change`'s examples.

**19. Durability (AC8).**
- **A firmware reinstall** changes no tag, property or link of a node this write may change: update-node refuses firmware's own elements (Decision 4), and a reinstall rebuilds firmware's headers and nodes alone (ADR 0016 Decision 13). Its derive pass rewrites the stamp and the cached copy, from the old copy (Decision 16).
- **A backup** carries the whole graph, so a restore brings the change back (ADR graph-operations-foundation/0002).

**20. The refusals,** each changing nothing and recording no entry:

| Code | Status | When |
|---|---|---|
| `nothing-to-change` | 400 | None of `name`, `description` and `fields` is given |
| `bad-name` | 400 | The name is empty once trimmed, has no slug, has a control, text-direction or invisible character, or is longer than 200 characters |
| `bad-fields` | 400 | `fields` isn't a JSON object or its text; it gives a `name` or `slug` that is neither the node's name (or the slug it gives) nor what the section holds, or takes either out; `description` and `fields.description` differ once trimmed; or the JSON would be longer than 1,000,000 characters |
| `not-installed` | 409 | The instance has no assistant key, so it can't tell its own nodes or firmware's |
| `unknown-node` | 404 | `node` names no node (a change entry is not one) |
| `not-own-node` | 409 | The node came from another author's event, or records another author (D4; Decision 3) |
| `made-elsewhere` | 409 | The node is a concept header, a core node, a property, a set or a graph rule, which another operation changes, by its concepts or its role labels (Decision 4; Amendment 1) |
| `firmware-node` | 409 | The node is one of firmware's own elements (Decision 4) |
| `not-an-element` | 409 | No concept but `word` reaches the node |
| `unknown-concept` | 404 | `concept` names no concept header |
| `reserved-key` | 409 | `concept`'s key is `word` or `graphContext` |
| `not-its-concept` | 409 | `concept` isn't one of the node's concepts |
| `concept-needed` | 409 | `fields` or `description` with no `concept`, and the node belongs to more than one |
| `unreadable-json` | 409 | The node's JSON can't be read, or its json tags differ |
| `no-section` | 409 | The node's JSON has no section for the concept among its own keys. It names `concept` when the call gave it, else `fields` when the call gave it, else `description` (Amendment 2) |
| `name-in-use` | 409 | Another of the instance's own elements of one of the node's concepts has the new name, or sits at the address it gives |
| `invalid-fields` | 400 | The rule's: a changed section doesn't fit its concept's schema, every problem listed |
| `no-schema` | 409 | The rule's: a concept whose section changed has no schema that can be read or compiled |

Beyond AC6's list: `not-installed` is a mechanic create-element has too. AC6 asks for every other code.

## Consequences

**What this enables**
- Fixing an element without signing: the rebuild's corrections (A10.39), and any agent's.
- One test of whose node it is, for merge-nodes, delete-node and copy-node.
- The name check is create-element's repeat, so the rename and the create agree on what counts as one element of a name.

**What this constrains**
- **An element with no word block, under a schema that requires `word`, can't change** until its JSON has one. Firmware's dog schema is one such. Rule 4 judges the stored JSON (story fact 9), and update-node edits sections, not the word block. Today's create-element route made such elements. `rules repair` is where they get a word block.
- **The cache is stale after a change** (Decision 16) until A10.36, and so is the node's JSON page.
- **A rename doesn't move the address,** so create-element with the old name answers the renamed element (Decision 9), and its `differs` names the name.
- **The old letter, imported again, undoes an update** (Amendment 2, carried over from ADR 0016 for elements).
  - `POST /api/neo4j/event-update` deletes a node's tags and imports its event from the relay (`src/api/neo4j/eventSync.js:348–390`). `GET /api/neo4j/event-check` answers `in_sync` whenever the ids match (`:116–117`), as they do after update-node.
  - The reading and dlist pages call the route after they publish a new letter (`ui/src/pages/reading/writeVerbs.js:280`; `ui/src/pages/lists/DListOverview.jsx:83`, `:104`), and OPEN.md row 138 names it as a repair tool.
  - So the route, run on an updated element that has no new letter, brings back its old name and fields. That is an import destroying locally authored state, which principle 4 (BIBLE §30) rules out. The answer's `letterOutOfDate` warns of it.
  - Keeping a newer local version over an older letter is for provenance (design §5, question 2) and `export nostr` (A10.34), as ADR 0016 says for concepts.
- **Element writes in one concept, and updates of one node, go one at a time** (Decision 5). That is fine at this scale.
- **A concept's other rules aren't checked:** a relationship type's `alias`, which `relationship-type-allowed` reads, and `x-tapestry.unique` beyond the name. They are concept-dependent rules (design §7), as the story leaves them.

**New debt and follow-ups**
- **A10.21.a:** sets, once create-set (A10.27) lands (on Loom, depending on A10.27).
- **A memo on A10.36:** `cache check` finds nodes changed after their stamp from the change entries (Decision 16).
- **`firmwareElements` copies install's naming of an element file** (Decision 4). The live check compares it with every firmware element on a fresh instance.
- **Firmware reinstall required?** No. No concept's definition changes, and the rulebook gains no entry.

## Implementation notes

- **`src/operations/catalog/graph/update-node.js`** (new): Decisions 1, 2 and 5–18. It requires `_schemas.js` inside `apply`, as create-element does.
- **`src/operations/catalog/graph/_nodes.js`:** `whoseNode`, `requireOwn` and `NOT_OWN_NODE` (Decision 3), and U0. It requires `src/operations/reads.js` when first called; reads.js requires nothing of the catalog, so there is no cycle.
- **`src/operations/catalog/graph/_elements.js`,** additive. The index in its header lists each new piece:
  - `CHANGED_ELSEWHERE` and `changedElsewhere(uuids)` (Decision 4);
  - `firmwareElements()` and `firmwareElementOf(uuid)` (Decision 4);
  - `repeatsOf(read, { concept, name, authors, address })` (Decision 10), with `findRepeat` calling it and unchanged;
  - `mergeSection(section, fields)` (Decision 8);
  - `renamedJson(json, { was, now })` → `{ json, sections }`, the keys of the sections it changed (Decision 9);
  - `CONCEPTS`, the schema of the answer's `concepts`. create-element keeps its own copy; pointing it here is a later tidy-up, left out so this change doesn't edit create-element.
- **`src/operations/catalog/graph/_schemas.js`:** `checkElements(read, items, { every = false } = {})` (Decision 11). Its header gains a line for it.
- **`src/operations/changes.js`:** `was`, `now`, `field` and `change` (Decision 18).
- **`docs/GRAPH_OPERATIONS_CATALOG.md` §2,** update-node's row: `node`, `concept?`, `name?`, `description?`, `fields?`. It answers the node, what changed, each concept's fit, its copies and its two flags, and lists Decision 20's refusals.
- **Statements.** Most are ones the fake graph already runs:
  - `F.conceptsOfNodes`, `K.headersByKey` (C8b) and `F.conceptOf` (S1);
  - the lock (S8's shape), and `writeCopies` (S8);
  - `E.addTags` (C6), and E1 (`schemaOf`);
  - `mapNodes`' reads.

  The new ones, which the Tester teaches the fake where it can't run them:
  - **U0, whose node:** `MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n.uuid AS uuid, coalesce(n.tapestryValue, n.name) AS name, n.pubkey AS author, n.id IS NOT NULL AS hasLetter LIMIT 1`.
  - **U1, the node and its tags:** `MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange OPTIONAL MATCH (n)-[:HAS_TAG]->(t:NostrEventTag) RETURN n.uuid AS uuid, n.name AS name, n.tapestryValue AS value, n.tapestryJsonUpdatedAt AS cached, t.tapestryKey AS tag, t.type AS type, t.value AS tagValue`.
  - **E3 with `$authors`:** E3 as `findRepeat` has it, with `e.pubkey IN $authors`.
- **Tests** (the Tester's, Phase 3), registered in `test/operations.test.js`:
  - **a suite for the operation,** with a test for each refusal of Decision 20 and for each report: `changed`, `concepts`, `copies`, `skipped`, `letterOutOfDate`, `cacheOutOfDate`, `unchanged`;
  - **the merge:** `null`, an object replaced whole, key order, `__proto__`;
  - **the rename:** sections, word block and name tag, a node with no name tag, the address unchanged;
  - **the locks:** that both are taken, and in order;
  - **a suite for `whoseNode`/`requireOwn`:** own by the assistant, by the owner, with no author; an admin's letter; a stranger's letter; a stranger's node with no letter; a change entry;
  - **`firmwareElements`:** dog's rover at `39999:<TA>:<childDTag('Rover', '39998:<TA>:dog')>`;
  - **`checkElements` with `every`;**
  - **an agent suite** through the external CLI;
  - **create-element's suites,** which pass unchanged, since `findRepeat` now calls `repeatsOf`;
  - **ADR 0004 Decision 10's guard:** no new module requires anything that signs.
- **The live check** runs on a scratch stack (`scripts/scratch-stack.sh`), never the agent-memory instance. It covers:
  - an element made with create-element, changed, renamed, and changed again with the same call;
  - refusals of fields that don't fit, of a rename onto a name in use, and of a node from another author's event (a lettered node with a throwaway key's pubkey, made with Cypher on the scratch stack);
  - a firmware element refused, and `firmwareElements()` compared with every firmware element node's address;
  - a marked field followed;
  - a reinstall, comparing the node's tags, JSON, properties and memberships;
  - a backup restored on a fresh stack;
  - an admin agent through nginx and the external CLI;
  - the relay's event count, unchanged.
- **Branches:** staging only, by the usual chain.

## Out of scope

- Sets (A10.21.a), adding a concept's section or a membership (A10.22), and moving an element (A10.23).
- Concept headers, core nodes, properties and schemas (update-concept, A10.18), and firmware's own nodes.
- Someone else's node, which copy-node (A10.24) copies.
- Which document a schema describes (A10.20.a). This follows ADR 0020: the stored JSON.
- The cache's rebuild (A10.36) and the derive step's preference for its copy (OPEN.md row 139).
- Concept-dependent rules (design §7), today's save-element-json and set-json-tag routes (D15), and their field mapping (A10.5.a).
- Publishing (A10.34), refs as inputs (A10.9.a), and bulk updates.

## Amendment 1 (2026-11-16, at test design; for the owner's approval with the test plan) — the nodes another operation changes, told by their role labels too

The test seed showed a gap in Decision 4, which found these nodes by their concepts alone.
- **A header today's create-concept route made** isn't an element of the concept-header concept until a firmware reinstall wires it (pass 1d½). Today's route makes only the core nodes elements of their firmware concepts (ADR 0016, fact 3).
- **A set today's create-set route made** isn't an element of the set concept until a reinstall's pass 1d wires it.
- **So update-node would answer `not-an-element`** for either one, and point to add-to-concept, which is the wrong operation.

What changes:
1. **`made-elsewhere` also reads the node's role labels,** after its concepts, in this order:
   - `ConceptHeader` or `ListHeader`: `graph update-concept`;
   - `Superset`: `graph update-concept`;
   - `JSONSchema`: `graph set-schema` (A10.18);
   - `Property`: `graph update-property` (A10.18);
   - `Set`: A10.21.a.

   These are the labels the import, today's routes and create-concept give such nodes (BIBLE §9; ADR 0016 Decision 3; ADR 0028 Decision 5). A node with no event takes its labels from a fixed list, never from input (`_eventless.js`'s `LABELS`). A primary property its concepts don't yet reach names `graph update-property`, a property's operation; the concept test comes first, and names update-concept, as Decision 4 does.
2. **A `Set` label counts only on a node with an address,** as `_sets.js`'s `kindOf` reads a set (ADR 0028 Amendment 3). The trust pipeline's card sets, labelled `Set` with no address, stay `not-an-element`.
3. **U0 reads the whole node,** with the statement `_sets.js`'s R1 uses: `MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n`. The fake graph already runs it. So `whoseNode` answers the node's labels too: `{ key, uuid, name, author, hasLetter, labels, own }`.
4. **Decision 20's `made-elsewhere` row** reads: the node is a concept header, a core node, a property, a set or a graph rule, by its concepts or by its role labels.

## Amendment 2 (2026-11-17, at Review round 1; the owner chose to fix the findings before the PR) — what the review found

The review passed, with seven non-blocking findings. Three changed the code, each with a test; the rest are recorded here and in the ledger. Decisions 1, 6 and 20 and the Consequences were edited in place to match, each naming this amendment.

1. **A section is one of the JSON's own keys** (Decision 6; non-blocking 1).
   - An inherited key counts as no section, so a concept keyed `__proto__` gives `no-section`.
   - Before, `oldJson['__proto__']` read `Object.prototype`, an object. The call answered `updated`, and recorded a change it never stored.
   - The section's values before the change, for `changed`, and its slug, for the rename, are read the same way. UN42 pins it.
   - create-concept can make a concept with that key: ledger row `2026-11-17-concept-key-can-be-proto`.
2. **`description` and `fields.description` are compared as `description` is read, trimmed** (Decision 1; non-blocking 2).
   - Given both ways, they are one value when they're the same once trimmed, and the field takes the trimmed text. Two that differ once trimmed are still `bad-fields`, and the message says so.
   - Before, the trimmed `description` was compared with the field as given, so the same text with white space around it, given both ways, was refused.
   - `fields.description` given alone is a field like any other, kept as given. UN43 pins it.
3. **`no-section` names the input the call gave** (Decision 20; non-blocking 3): `concept` when it was given, else `fields` when it was given, else `description`. UN44 pins it.
4. **What Decision 3's test answers for a node that isn't a letter** (non-blocking 4).
   - `whoseNode` reads `pubkey` as the author, as Decision 3 says. So an `e`-tag placeholder, which the import makes as `NostrEvent {id, uuid}` with no `pubkey` (`src/api/neo4j/eventSync.js:268–270`), answers `own: true` and `hasLetter: true`.
   - The owner's and the assistant's `NostrUser` nodes answer `own: true` too.
   - update-node can't reach either: neither has a section to change, so `not-an-element` or `unreadable-json` refuses it. merge-nodes (A10.25) and delete-node (A10.26) can, and must decide before they call `requireOwn`: ledger row `2026-11-17-own-test-reads-pubkey-as-author`.
5. **The Consequences gain the old letter imported again** (non-blocking 5), carried over from ADR 0016 for elements.
6. **No suite checks Decision 5's lock order** (non-blocking 6). UN13 counts the header locks, but the fake graph logs no statement's parameters, so it can't see their keys: ledger row `2026-11-17-fake-graph-logs-no-lock-order`.
7. **The story's Evidence placed the scoped gate on the wrong commit** (non-blocking 7). The story now says it ran on the uncommitted implementation over `dff6a1ca`.
