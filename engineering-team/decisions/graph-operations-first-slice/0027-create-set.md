# ADR 0027: `graph create-set` — a set is the letter its write would sign, made under one parent and locked by it

**Status:** Accepted
**Date:** 2026-11-16
**Story:** `engineering-team/stories/graph-operations-first-slice/27-create-set.md`

## Context

Story 27 asks for one graph write, `graph create-set` (Loom A10.27; catalog §2, Sets): a set under a concept's superset or another set, with no event, safe to repeat by name under the parent. Its criteria, restated:

1. **AC1:** a new set directly under `parent`, an element of the set concept, with a tapestryKey, its name as its tapestryValue, no `NostrEvent` label, and the address and tags its letter would carry. The answer gives its key, address, parent, the concepts whose class thread reaches it, `created`, and a change entry `graph history` finds by the set or the parent.
2. **AC2:** its JSON is word-wrapper JSON with a `set` section, checked against the set concept's schema (rule 4) before anything is written. Each other concept it is an element of, such as `word`, is reported, never refused for.
3. **AC3:** this instance's own set directly under `parent`, with the name or the address the name and parent give, is the repeat: `already-exists`, with `differs`. Two calls at once make one set. Another author's set, and a set under another parent, aren't repeats.
4. **AC4:** it refuses a parent that names no node, a parent that is neither a superset nor a set (naming a concept header's superset), and a name or description create-concept would refuse. Any author's parent, and a firmware concept's, takes a set.
5. **AC5:** it reads `parent` as link-set does, a reading defined once, for delete-set (A10.17) and move-element (A10.23) to use.
6. **AC6:** a reinstall and a restored backup leave the set as it was.
7. **AC7:** for the owner and admins, with its list entry, `/docs` entry and internal command made from the declaration, and an agent's run through the external CLI.

The owner approved the story with its three answers (2026-11-16): a set carries JSON; only this instance's own set is the repeat; a concept header as `parent` is refused, naming its superset.

**Orientation.** `/api/concept-graph/summaries` on the local instance lists `39998:<TA>:set` (120 elements, 3 sets), `…:superset`, `…:class-thread` and `…:word`. `/neighbors` for `39998:<TA>:set` gives its superset, `39999:<TA>:set-superset`, and its JSON schema node, `39999:<TA>:set-schema`. Both are reads; that instance is the agent-memory one, so nothing else was run on it. `<TA>` is the instance's assistant, read at runtime, never written into code.

**Facts** (this checkout, 0 commits behind `origin/staging`, at `2ec98ec6`):

1. **The write path** (ADR graph-operations-foundation/0004; `src/operations/write.js`). It runs the guards, then `apply` with `ctx.tx`, then the change entry, in one transaction. A refusal anywhere rolls the transaction back. `repeatKey` names the inputs that make two calls the same.
2. **A node with no event.** `_eventless.js`'s `makeNode` (ADR graph-operations-first-slice/0016 Decision 1) creates the node with labels from a fixed list, `Set` among them (`LABELS`), the assistant as `pubkey`, its name as `tapestryValue`, a tapestryKey, and tag nodes with the import's uuids. Its header already names create-set as a user.
3. **What counts as a parent** (`src/operations/catalog/graph/_sets.js`; ADR 0028 Decision 5 and Amendment 3). `kindOf` answers `superset` for a node labelled `Superset`, and `set` for one labelled `Set` and not `Superset`, in each case only when it has a `uuid`. `NOT_A_PARENT` (409) and `say.notAParent` word the refusal, naming a concept header's superset (`supersetOf`, R2). link-set's `requireEnds` finds both ends before it judges either one's kind (`_sets.js:222–231`).
4. **The lock.** `S.lockNode(tx, key)` (`_sets.js:236–249`) sets `tapestryLock` on one node and removes it, so nothing is committed and Neo4j holds the node's write lock until the transaction ends. A key that names no node locks nothing. create-element takes it on its concept's header (ADR 0020 Decision 7), and unlink-set on its set (ADR 0028 Amendment 2).
5. **create-element's pieces** (`_elements.js`). `freeAddress` (C4) tries `childDTag(name, <address>, n)` for n from 0 to 99; `conceptsReaching` (E2) gives every concept header whose class thread reaches a superset or set; `link` MERGEs one `HAS_ELEMENT`. `_schemas.js`'s `checkElements(read, [{ concept, json }])` runs `element-fits-schema` and throws its first finding, with `rule`; `fits(read, concept, json)` only reports.
6. **Field marks.** ADR graph-operations-foundation/0005 has every element write the new operations add call `F.mapNodes(tx, keys)` on the nodes it wrote, inside its own write, with `F.copyChanges` in its entry. A set is an element of the set concept.
7. **Today's two routes** (story, facts 1 and 2). add-subset's address is `39999:<TA>:<childDTag(name, parentUuid)>` (`src/api/normalize/nodes.js:166`). Its repeat is any author's set directly under the parent (`:169–183`), a held address is refused 409 (`:184`), and one statement writes the node, its tags, its parent link and its registration under the set concept (`:195`). Today's create-set (`src/api/normalize/index.js:4333`) gives the same address and tags, and registers nothing. Firmware's sets come from it (`src/firmware/install.js:414–470`), and the JSON in their files is dropped.
8. **The set concept's schema** (`firmware/versions/v1.0.0/concepts/set/json-schema.json`) requires a `set` section, which requires `slug` and takes `name`, `title` and `description` as text; it limits no keys. Every firmware set file holds `word: { slug: "the-set-of-…", name: "The set of …", title, wordTypes: ["word", "set"] }` and `set: { slug, name, title, description }`.
9. **A set belongs to two concepts.** Firmware's existing-sets put the set concept's superset under word's (`firmware/versions/v1.0.0/manifest.json:561`, `sets.words`), so each element of `set` is an element of `word`. word's schema requires `graphContext`, which only the derive step writes (ADR 0020 Amendment 1; ledger row `2026-11-16-derive-step-and-rule-check-split`).
10. **A reinstall and a set.**
    - Pass 1d MERGEs `set-superset -HAS_ELEMENT->` each `ListItem` whose `z` tag names the set concept (`install.js:650`).
    - Pass 1e (`install.js:810`) first deletes a firmware concept's superset's direct `HAS_ELEMENT` when another path of two to twelve propagation and termination links reaches the node. A set's parent is itself an element of `set`, so every set has such a path.
    - Its second prune (`install.js:871`) deletes a superset's direct link to a set that another set reaches. That never holds for a set with one parent.
    - Yet on the local instance, firmware's own sets, reinstalled many times, still have `set-superset`'s direct `HAS_ELEMENT` (read through `/neighbors`, 2026-11-17). add-subset's set kept it in story node-primitives #1's live check too. Ledger row `2026-11-15-reinstall-drops-a-supersets-own-membership` records the same puzzle for supersets.
11. **The fakes.** The stack-free suites run over `test/helpers/graphFake.js` and `pathCypherFake.js`. Those run R1–R3, the lock, C4, `makeNode`'s C5 and C6, E1–E3, a relationship's MERGE between nodes found by tapestryKey, and `mapNodes`' reads (ADR 0020 Implementation notes). A read that walks from a node over `IS_A_SUPERSET_OF`, `HAS_ELEMENT`, `HAS_TAG` or `IS_THE_CONCEPT_FOR` runs on the path fake.
12. **The race the ledger records** (`2026-11-16-shared-set-creates-can-race`). create-element's repeat searches a concept's whole class thread, but its lock covers one concept. So two create-elements in two concepts that share a set can each make an element of one name.

## Options considered

### Option A — A write of its own, locked by its parent, made from the pieces link-set and create-element share

`create-set.js`, one declaration. It reads `parent` with `_sets.js`'s reading, makes the node with `makeNode`, checks its JSON with `_schemas.js`, carries marks with `mapNodes`, and takes the lock on `parent` before it reads anything. Its repeat looks only at the parent's direct sets, so the lock it holds is the one every call that could make the same set takes.

- **Pros:** most statements already run on the fakes, and the two new reads are in shapes they run. It is one write, with one place to read it. Creates under different parents never wait for each other, so the rebuild can run them in parallel.
- **Cons:** a second node-making write for sets beside add-subset, whose node it repeats (D15 keeps the old route).

### Option B — Today's add-subset, called from a declaration

Wrap `src/api/normalize/nodes.js`'s statement in an operation.

- **Pros:** no new statement for the node.
- **Cons:** it runs outside the write path's transaction, through its own sessions, so the change entry can't be kept with the change. Its repeat counts any author's set, where the owner chose this instance's own. It writes no JSON and checks no schema, where the owner chose both. It refuses a held address where a nonce serves. Changing it to fit would change an old route (D15).

Rejected.

### Option C — Option A, with one lock for every create-set

Lock the set concept's header for every create-set, as create-concept locks the concept-header concept's (ADR 0016 Decision 6). Or lock the header of every concept whose class thread reaches the parent, sorted: the ledger row's fix shape.

- **Pros:** simple to reason about, and the ledger row's shape closes races across concepts.
- **Cons:** no race needs it. create-set's repeat covers one parent's direct sets, which is what Option A locks. One lock for all would make every set write on the instance wait for every other, slowing the rebuild's parallel creates for nothing.

Rejected. Revisit if a set write's repeat ever covers more than its parent.

## Decision

We chose **Option A**. It reuses the readings the owner already approved (link-set's parent, create-element's node and schema check), and its lock is exactly as wide as its repeat.

### 1. The inputs (`src/operations/catalog/graph/create-set.js`, `owner-and-admins`)

- `parent` (required): `N.keyInput(…)`, the tapestryKey of a concept's superset or of a set.
- `name` (required): text, up to 1,000 characters as given, checked once cleaned (Decision 3).
- `description` (optional): text, up to 10,000 characters, as create-concept takes one.

`repeatKey: ['parent', 'name']`. Its guard is `element-fits-schema`, with `items: () => []`, as create-element's is: the JSON it judges is built from the graph inside the write, so `apply` runs the rule on it (ADR 0020 Decision 12, Option A). The declaration lists the rule's refusals through the guard.

### 2. The steps, in one transaction

1. Check what needs no graph: the name (`bad-name`), the description (`bad-description`), and the assistant's key, the would-be author (`not-installed`).
2. Take the lock on `parent` (Decision 5). Every read comes after it.
3. Read the parent (Decision 4): `unknown-node` (404), `not-a-parent` (409).
4. Read the set concept (Decision 6): `not-installed` (409).
5. Look for the repeat (Decision 7). When there is one, answer `already-exists`, with no change and no entry.
6. Choose the address (Decision 8): `no-free-address` (409).
7. Build the JSON (Decision 9), and run rule 4 on it: `invalid-fields` (400) or `no-schema` (409), with `rule`.
8. Make the node and its tags (Decision 10), and its two links (Decision 11).
9. Carry its marks (Decision 12), report the other concepts (Decision 13), and record the entry (Decision 14).

Nothing is written before step 8, so every refusal leaves the graph as it was.

### 3. The name and the description

- **The name** is cleaned with `CN.cleanName` and refused `bad-name` (400) on `CN.nameProblem` (`src/lib/conceptNames.js`), as create-concept and create-element refuse one, worded for a set. Its slug is `dtag.slug(name)`.
- **The description** is trimmed and refused `bad-description` (400) on `CN.descriptionProblem`, as create-concept's is. One that is empty once trimmed counts as left out.

### 4. The parent, read as link-set reads one (AC4, AC5)

`S.requireParent(tx, parent)`, new in `_sets.js`:
1. `N.requireNodes(tx, [['parent', parent]])`: `unknown-node`, naming `parent`;
2. `S.nodeOf` and `S.kindOf`: for `'other'`, it throws `S.NOT_A_PARENT`'s code with `S.say.notAParent(node, await S.supersetOf(read, parent))` and `input: 'parent'`;
3. it answers the parent node.

These are the functions link-set's `requireEnds` uses on its `parent`, so the two operations accept and refuse the same nodes, in the same words. `requireEnds` stays as it is, so link-set's refusal order doesn't move. delete-set and move-element use `S.kindOf` and `S.NOT_A_SET` on their set inputs, and `requireParent` for any parent they take.

- **Any author's parent** takes a set: nothing reads the parent's `pubkey`. The set is this instance's own claim that it belongs there (CLAUDE.md principle 2).
- **A firmware concept's superset or set** takes one too. Nothing here asks whether the parent is firmware's.
- **A parent no concept's class thread reaches,** such as a set an old route left under no parent, takes a set. Its `threads` are then empty (Decision 13).

### 5. The lock

`apply` first takes `S.lockNode(tx, parent)`. Every create-set that could make the same set names the same parent, so such calls go one at a time, and the second finds what the first made (AC3). Creates under different parents don't wait for each other.

- **Why not the ledger row's race:** create-element's repeat covers a concept's whole class thread while its lock covers one concept. create-set's repeat covers one parent's direct sets, which is what it locks.
- **With link-set:** its MERGE locks both ends (ADR 0028 Decision 9), so a link-set and a create-set under one parent run one after the other. When link-set first puts this instance's own set of the name under the parent, create-set answers `already-exists` with it. When create-set runs first, link-set links a second set of that name, since it doesn't check names.
- **With unlink-set,** which locks its set, not its parent: a create-set can answer `already-exists` with a set that an unlink-set is taking out at that moment. The answer was true when read, and the next call makes the set. This is left as it is.
- **For delete-set (A10.17):** it takes `S.lockNode` on the set it deletes before it checks that the set is empty. That is the lock create-set takes on its parent, so a set made under it at that moment is seen, and one made after finds no parent (`unknown-node`).
- **Deadlocks:** as ADR 0028 Decision 9 says, the driver runs the whole transaction again.

### 6. The set concept

It is read by its firmware address, `firmware.conceptUuid('set')`, as `made-elsewhere` matches it (ADR 0020 Decision 4), so another author's concept with the slug `set` isn't it. **R6:**

```cypher
MATCH (h:TapestryNode {uuid: $uuid})-[:IS_THE_CONCEPT_FOR]->(s:Superset)
WHERE NOT h:GraphChange
RETURN h.tapestryKey AS concept, s.tapestryKey AS superset LIMIT 1
```

The type name comes from `relAlias('CLASS_THREAD_INITIATION')`, as everywhere. No row means `not-installed` (409), naming the set concept's address: the firmware isn't installed.

### 7. The repeat (AC3; the owner's answer 2)

- **What counts.** A node directly under `parent` by the propagation link; labelled `Set` and not `Superset`, with a `uuid`; made by this instance's assistant, with a letter or without. Its name, lowercased, is the cleaned name lowercased, or its `uuid` is the address the name and parent give, with or without a nonce. Of several, the one at the plain address is taken, then the lowest tapestryKey, as create-element takes one. **R7:**

  ```cypher
  MATCH (p:TapestryNode {tapestryKey: $parent})-[:IS_A_SUPERSET_OF]->(s:Set)
  WHERE NOT s:Superset AND NOT s:GraphChange AND s.uuid IS NOT NULL AND s.pubkey = $ta
    AND (toLower(s.name) = $name OR s.uuid = $address OR s.uuid STARTS WITH $nonced)
  WITH DISTINCT s
  OPTIONAL MATCH (s)-[:HAS_TAG]->(d:NostrEventTag {type: 'description'})
  OPTIONAL MATCH (s)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
  OPTIONAL MATCH (u)-[:IS_A_SUPERSET_OF]->(s)
  RETURN s.tapestryKey AS key, s.uuid AS uuid, s.name AS name, s.id IS NOT NULL AS hasLetter,
         head(collect(DISTINCT d.value)) AS description, head(collect(DISTINCT j.value)) AS json,
         collect(DISTINCT u.tapestryKey) AS parents
  ```

  The type name comes from `relAlias('CLASS_THREAD_PROPAGATION')`.
- **What doesn't count.** Another author's set under the parent: its `pubkey` isn't the assistant's. A set of the name under another parent: R7 starts from `parent`. A set at the name's address that is no longer under `parent`: the new set takes a nonce (Decision 8).
- **`differs`** has `{ input: 'name', given, holds }` when the names differ at all, case included, and `{ input: 'description', given, holds }` when a description is given and differs from the set's `description` tag, or the set has none (`holds: null`). A repeat writes nothing and checks nothing.

### 8. The address

The address is `39999:<TA>:<d>`, with `d = dtag.childDTag(name, <the parent's uuid>)`. That is the address today's create-set and add-subset give the same name and parent, so a letter `export nostr` later signs for the set lands on this node.

When any node holds it, `d` takes the first free versioning nonce, `childDTag(name, uuid, 1)` to `99`, read with `X.freeAddress(read, { name, header: <the parent's uuid>, ta })` (C4; its `header` is the second part of `childDTag`, here the parent's address). Past that, `no-free-address` (409), worded for a set. add-subset refuses a held address with 409, and this doesn't follow it: a held address, such as that of a set unlink-set took out from under the parent, is no reason to refuse a new set.

### 9. The set's JSON (AC2; the owner's answer 1)

Word-wrapper JSON, as firmware's set files hold it (fact 8), keys in this order:

```json
{
  "word": {
    "slug": "the-set-of-<slug>",
    "name": "The set of <name>",
    "title": "The Set of <title>",
    "wordTypes": ["word", "set"]
  },
  "set": { "slug": "<slug>", "name": "<name>", "title": "<title>", "description": "<when given>" }
}
```

- **`<title>`** is `CN.toTitleName(name)`.
- **`wordTypes`** list `word`, `set`, and then the key of each other concept whose class thread reaches the set concept's superset (E2 over it), sorted, since membership is the edges (D10). That is create-element's rule; on firmware 1.0.0 there are no others.
- **The section's key is `set`,** the key in firmware's set concept header (`firmware/versions/v1.0.0/concepts/set/concept-header.json`). Decision 6 matches only that concept, and its key doesn't change: update-concept refuses a firmware concept.
- **The JSON is stored inline** in the `json` tag. A name of 200 characters and a description of 10,000 keep it small.

Then `Sch.checkElements(read, [{ concept: <the set concept's header>, json }])` runs. It refuses `invalid-fields` (400) for JSON that doesn't fit, which happens only on an instance whose set schema asks for more than firmware's, and `no-schema` (409) for a set concept whose schema is missing or can't be read.

### 10. The node and its tags

`E.makeNode(tx, { uuid: <address>, kind: 39999, labels: ['ListItem', 'Set'], name, tags, pubkey: <TA>, createdAt })`, with no `NostrEvent` label and no `id` (D7).

The tags follow today's create-set's order, then `json`:
1. `d`;
2. `name`;
3. `z`: the set concept's header's address;
4. `s`: the parent's address, the child-claims-parent tag (ADR community-reference/0011);
5. `description`, when one is given;
6. `json`.

No relationship event is made: the link is the graph's, and `export nostr` (A10.34) decides what a letter for it carries.

### 11. The two links

- **From `parent` to the set,** by the propagation link: `S.linkUnder(tx, parent, set)`, new in `_sets.js`. It is link-set's MERGE, between two nodes found by tapestryKey, and it throws unless it found exactly one pair, as `X.link` does.
- **From the set concept's superset to the set,** by the termination link: `X.link(tx, <its superset>, set)`. This registers the set as an element of the set concept (AC1), as add-subset does.

Nothing else is wired. A reinstall's pass 1d MERGEs the registration again from the `z` tag (fact 10).

### 12. Marks

After the links, `F.mapNodes(tx, [set])` runs, and `F.copyChanges(mapped)` goes into the entry (fact 6). On firmware 1.0.0 the set concept marks no field, so it carries nothing, but a mark made on the set concept later reaches the sets made here. The answer gives `copies` and `skipped`, as create-element's does. *The story doesn't ask for this; ADR graph-operations-foundation/0005 does, of every element write.*

### 13. The answer

`{ outcome, set, threads, concepts, differs, copies, skipped, note?, change }`:
- **`outcome`:** `created` or `already-exists`.
- **`set`:** `{ tapestryKey, address, name, slug, description, parents, hasLetter }`. `parents` are the tapestryKeys of the supersets and sets it is directly under, `[parent]` on a create. `slug` is its JSON's `set.slug`, else the one its name gives. `description` is null when it has none.
- **`threads`,** on either outcome: each concept whose class thread reaches the set, through `parent` (E2 over `parent`), as `{ concept, address }`, by tapestryKey. An element put in the set belongs to each (rule 3).
- **`concepts`,** on a create: each concept the set is an element of (E2 over the set concept's superset), the set concept first, then by tapestryKey, as `{ concept, key, fits, problems, problem }`, create-element's shape. The set concept fits, or the write was refused. word doesn't, for `graphContext` (fact 9). It is empty on a repeat.
- **`differs`,** on a repeat (Decision 7); empty otherwise.
- **`copies`** and **`skipped`,** on a create (Decision 12); empty on a repeat.
- **`note`,** on a create, as create-element's: the set is in this instance's graph only, and only a backup keeps it (BIBLE §30).

### 14. The change entry

A create records `{ change: 'set-created', node: <the set>, from: <the parent>, name, slug }`, then `copyChanges`' changes. `keysOf` reads `node` and `from`, so `graph history` finds the entry by the set or by the parent (AC1). In `src/operations/changes.js`, the descriptions of `from`, `name` and `slug` widen to cover a set made under a parent.

### 15. The refusals, each changing nothing and recording no entry

| Code | Status | When |
|---|---|---|
| `bad-name` | 400 | The name is empty once trimmed, has no slug, has a control, text-direction or invisible character, or is longer than 200 characters |
| `bad-description` | 400 | The description has a control character other than a line break or a tab |
| `not-installed` | 409 | The instance has no assistant key, the would-be author, or no set concept with a superset: the firmware isn't installed |
| `unknown-node` | 404 | `parent` names no node of the graph (a change entry isn't one) |
| `not-a-parent` | 409 | `parent` is neither a superset nor a set: an element, a concept header (the refusal names its superset, the key to pass), a node with no address such as one of the trust pipeline's card sets, or any other node |
| `no-free-address` | 409 | The address the name and parent give is held, with each nonce to `~99` |
| `invalid-fields` | 400 | The rule's: the set's JSON doesn't fit the set concept's schema, every problem listed |
| `no-schema` | 409 | The rule's: the set concept's schema is missing, can't be read, or doesn't compile |

`invalid-input` is the router's own, for an input its schema refuses: a `parent` that isn't a tapestryKey, or text too long.

### 16. Durability (AC6)

- **After a reinstall:**
  - No pass touches the set's tags or JSON.
  - No part of firmware's definition makes its link from `parent`. Pass 1e's second prune needs another path to the set, which a set with one parent doesn't have.
  - Pass 1d MERGEs its registration again from the `z` tag. Pass 1e's first prune could, by its code, take the registration out (fact 10's puzzle).
  - The live check runs a reinstall and reads the set's links. If the registration is gone, the Implementer stops and asks the owner. Wiring can't keep what a prune takes out, and the ledger row's fix is in `install.js`, outside this task.
- **The derive pass** gives the set its cached JSON. Its verdict for the set concept agrees with this check. For word it splits, as ADR 0020 Amendment 1 records.
- **A backup** carries the whole graph, so a restore brings the set back with its key (ADR graph-operations-foundation/0002).

### 17. Docs, and agents

- **The catalog's create-set row** (§2, Sets) gets its inputs, its report and its refusals. The Today column stays as it is.
- **`src/operations/changes.js`:** the three descriptions (Decision 14).
- **/docs, the list and the internal command** come from the declaration with no other edit (ADR graph-operations-foundation/0001). The internal command is `tapestry graph create-set --parent <key> --name <name> [--description <text>]`.
- **The external CLI** (A10.6) picks it up from the list with no change.
- **No rulebook entry and no firmware element,** so no reinstall is needed anywhere.

## Consequences

- **Enables:**
  - the rebuild (A10.39) has every write it waits on;
  - sets the set concept's readers can read, which `rules check` (A10.31) won't report against the set concept;
  - one lock and one reading of a parent for delete-set (A10.17) and move-element (A10.23).
- **Constrains, and the debt it leaves:**
  1. **Every create's `concepts` reports word as not fitting,** for `graphContext`. That is ADR 0020 Amendment 1's split, and its fix lies in how the rule reads word's schema (ledger row `2026-11-16-derive-step-and-rule-check-split`), not here.
  2. **Two sets of one name under two parents share a word slug,** such as `the-set-of-small`, as firmware's naming has it. Uniqueness beyond the repeat is out of the story's scope.
  3. **A create-set that races an unlink-set** can answer `already-exists` with a set that is being taken out (Decision 5).
  4. **The would-be `s` tag goes stale** when unlink-set takes the set out from under its first parent (ADR 0028 Consequences 2). Export (A10.34) reads a set's parents from its links.
  5. **Today's sets keep no JSON,** so `rules check` will report them. A repair is for later.
  6. **If a reinstall drops the registration** in the live check, this ADR gains an amendment (Decision 16).
- **Firmware reinstall required?** No. No concept definition changes, and the rulebook gains no rule.

## Implementation notes

- **`src/operations/catalog/graph/create-set.js`** (new): Decisions 1–3, 5–10 and 12–15.
- **`src/operations/catalog/graph/_sets.js`,** additions only, at the end of the file and in the header's index and `module.exports`:
  - `requireParent(tx, parent)` (Decision 4);
  - `linkUnder(tx, parent, set)` (Decision 11);
  - the set's letter: `setJson({ name, slug, description, others })` (Decision 9) and `setTags({ d, name, setConcept, parent, description, json })` (Decision 10), which export (A10.34) can reuse;
  - `findSetRepeat(read, { parent, name, ta, address })`, R7 (Decision 7), and `setDiffers(repeat, { name, description })`;
  - `describeSet(…)`, the answer's `set` (Decision 13).

  `requireEnds`, link-set and unlink-set don't change.
- **`src/operations/changes.js`:** the descriptions of `from`, `name` and `slug` (Decision 14).
- **`docs/GRAPH_OPERATIONS_CATALOG.md` §2:** the create-set row.
- **Statements.** The fake graph already runs most of them: R1 and R2, the lock, C4, C5 and C6 (`makeNode`), the relationship MERGE, E1 and E2, `mapNodes`' reads, and S8. The two new ones, R6 and R7, are reads in shapes the path fake runs: a node found by a property, a walk over `IS_THE_CONCEPT_FOR` or `IS_A_SUPERSET_OF`, then `HAS_TAG`, with `toLower` and `STARTS WITH`, as E3 has. The Tester confirms that, and teaches the fake any shape it can't run.
- **Tests** (the Tester's, Phase 3), registered in `test/operations.test.js`:
  - a suite for the operation: a test for each refusal of Decision 15, and for each report (`threads`, `concepts`, `differs`, `copies`, `skipped`); the node's labels, properties and tags, in order; the JSON; the two links; the entry and `graph history`;
  - for the repeat: a peer's set under the parent, a set of the name under another parent, a held address that takes a nonce, and differing case;
  - for the parent: a table of nodes that create-set and link-set both accept and both refuse, with the same codes and words (AC5); a peer's parent and a firmware concept's parent taking a set;
  - an agent suite through the external CLI (AC7);
  - ADR graph-operations-foundation/0004 Decision 10's guard that no new module requires anything that signs.
- **The live check** runs on a scratch stack (`scripts/scratch-stack.sh`), never the agent-memory instance. Check `docker ps` first, and note the stack in the shared notes folder when it is taken and when it is taken down. It covers:
  1. a concept made with `graph create-concept`, a set under its superset, the same call again, and a set under that set;
  2. a concept header as `parent`, refused with its superset's key;
  3. an element made in the new set with `graph create-element`;
  4. `graph list-elements` on the set concept, and `graph list-relationships` on the parent;
  5. two create-sets at once with one name under one parent, making one set;
  6. a firmware reinstall, then the set's tags, JSON, link from its parent and registration compared (Decision 16);
  7. a backup restored on a fresh stack;
  8. an admin agent through nginx and the external CLI (AC7);
  9. the relay's event count, unchanged.
- **Branches:** staging only, by the usual chain.

## Out of scope

- **Today's add-subset and create-set routes,** which stay as they are (D15), and the JSON their sets lack.
- **`install.js`'s prune** (ledger row `2026-11-15-reinstall-drops-a-supersets-own-membership`), unless the live check finds a reinstall drops the registration. That would be a separate decision for the owner.
- **Taking a ref for `parent`:** the declaration hook A10.9.a builds.
- **A rule that set slugs are unique** (`x-tapestry.unique` in the set concept's schema).
- **delete-set (A10.17) and move-element (A10.23)** themselves. This ADR gives them a lock and a reading to use.
- **Publishing a set** (`export nostr`, A10.34).

## Amendment 1 (2026-11-17, at review round 1; the owner's approval) — what keeps a set in `set` through a reinstall

Decision 16 says a reinstall's pass 1d MERGEs a set's registration again from its `z` tag. Pass 1d runs before pass 1e (`src/firmware/install.js:650`, `:810`), so it can't put back what 1e takes out.

- **What the code does,** read end to end (review round 1, not run):
  - pass 1e removes the registration of a set whose parent is itself an element of `set`, which is every set;
  - Pass 3's `wire-implicit-elements` (`install.js:1291`) wires it again from the set's `z` tag, since the set's other way in ends in `IS_A_SUPERSET_OF`, not `HAS_ELEMENT`.
- **What was seen.** The live check's reinstall (L6) left every registration in place, as that reading predicts.
- **What follows.**
  - The `z` tag naming the set concept (Decision 10) is what keeps a set in `set` through a reinstall, and CS2 holds that tag.
  - A reinstall whose Pass 3 fails leaves its sets out of `set` until the next one, since install logs that failure and goes on (`install.js:1289–1295`). Ledger row `2026-11-15-reinstall-drops-a-supersets-own-membership` records it, for whoever changes pass 1e or Pass 3.

Nothing in create-set changes.
