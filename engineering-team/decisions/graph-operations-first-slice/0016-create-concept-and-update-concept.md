# ADR 0016: `graph create-concept` and `update-concept` — a node with no event is the letter its write would sign, recorded without signing

**Status:** Accepted
**Date:** 2026-11-15
**Story:** `engineering-team/stories/graph-operations-first-slice/16-create-concept-and-update-concept.md`

## Context

The story asks for two graph writes. `graph create-concept` makes a concept's header and its seven other core nodes, wired as today's create-concept wires them, each an element of a concept, with a tapestryKey, its name as its tapestryValue, and no `NostrEvent` label (AC1). The concept reads like one today's route makes (AC2). A repeat by slug returns the existing concept untouched and names the inputs that differ (AC3), and every answer reports near matches and other authors' concepts without refusing (AC4). Names are trimmed and checked (AC5). `graph update-concept` changes a concept's names, slug or description, while its key, labels, address and tapestryKeys stay (AC6). It refuses an unknown concept, another author's, a firmware concept, a name-keyed rename and a slug in use, and both operations hold rule 10 for slugs and keys, defined once (AC7). What they make lasts through a firmware reinstall and a restore, and reaches agents through the external CLI (AC8).

This ADR also settles, once, how a node with no event is made. `graph create-set` (A10.27) and `graph create-element` (A10.20) start from it (the A10.5 session's coordination notes, sent at the owner's request, 2026-11-15).

What the code offers today:

1. **The write path** (ADR graph-operations-foundation/0004). A declaration with `apply`, `guards` and `repeatKey` runs in one write transaction through the graph seam (`src/operations/graph.js`). Its guards run first, then `apply(inputs, { tx })`, then its change entry is recorded, all or nothing. A guard rule's refusals become the operation's own (`guardRefusals`, `src/operations/index.js:41`). Nothing signs. The transaction function may run again after a transient error, so it does nothing outside `tx`.
2. **How today's import makes a node** (`importEventDirect`, `src/api/normalize/index.js:137`). It merges `(:NostrEvent {uuid})`, sets `id`, `kind`, `pubkey`, `name` (the `name` tag, else the `names` tag's first value) and `created_at`, adds `ListHeader` for kind 39998 or `ListItem` for 39999, runs `keyNode`, and makes one `NostrEventTag` per tag. Each tag node's uuid is `sha256("<uuid>:<tag.join(',')>:<index>")`, with `type` and `value`, and `value1` and `value2` only when the tag has them. Before the merge, it gives an event-less node at the same address the `NostrEvent` label back, so a letter published later lands on that node (ADR 0003 Decision 9).
3. **Today's create-concept** (`handleCreateConcept`, `src/api/normalize/index.js:1195`). It derives the names with `deriveAllNames` (`:1160–1193`): the names lowercased, slugs by `toSlugName` (lowercase, white space to `-`), keys by `toKeyName` (camelCase), titles and labels. The header's d-tag is `dtag.headerDTag(name)`, which is `dtag.slug(name)` (`src/lib/dtag.js`). The core nodes' d-tags are `<oSlugs.singular>-<suffix>`. The two agree for a name of letters, digits and spaces, and differ for a name with punctuation. Then the header's `concept-graph` tag, `39999:<TA>:<header d>-concept-graph` as the spec computes it, names a node that isn't there (protocols/drafts/tapestry-concepts.md, "Core nodes of a concept"). The route signs each node's word-wrapper JSON and tags, adds the role labels (`ConceptHeader`, `Superset`, `JSONSchema`, `Property`), wires eight edges, and makes each core node an element of its own firmware concept only.
4. **add-subset**, the one event-less write (`src/api/normalize/nodes.js`), makes the node the import would make, minus the event: the same address, labels other than `NostrEvent`, properties other than `id`, and the would-be tag nodes, uuids and all. Every reader of a lettered set reads it.
5. **What a firmware reinstall does to concepts it didn't make** (`src/firmware/install.js`). Pass 1d makes every node with a `z` tag an element of each concept the tag names, except `word` (`:586–640`). Pass 1d½ makes every `ConceptHeader` an element of the concept-header concept (`:642–674`). Pass 3's `wire-implicit-elements` does as 1d does, `word` included. Pass 3 also derives each node's Tapestry JSON into the LMDB and stamps `tapestryJsonUpdatedAt` on its node. Firmware's own headers are rebuilt from their definitions (OPEN.md row 8). Nothing else touches another concept's nodes.
6. **The readers.** `_fields.js` reads a concept from its header's json tag and its schema node's json tag (`conceptOf`), and its elements through the class thread (`elementsOf`). The concept-graph reads find headers by label and nodes by address. Seventeen lookups in today's normalize routes, and the UI's concept list, read only `NostrEvent` headers (the story, Background).
7. **The cache.** The derive step starts from a node's existing LMDB entry before its json tag (`getExistingWordJson`, `src/lib/derivers/word.js:42`), and nothing clears an entry when a json tag changes. A json tag may itself be held in the LMDB as `lmdb:<tapestryKey>` (BIBLE §8). Every route that edits a json tag leaves the cached JSON as it was.
8. **Rule 10's full text** (tapestry-cli `docs/NORMALIZATION.md`, 2026-03-23) holds slugs unique within one author's graph, because the slug is the key elements' JSON is filed under. In that text the slug is the camelCase key, today's `oKeys.singular` (the story, Background; the owner's answers at planning).
9. **The Dictionary's edit** (`src/lib/conceptHeaderEdit.js`) exports `nameKeyed(singular)` and `NAME_KEYED_CONCEPTS`: the concepts the server finds by singular name.
10. **The fake graph** (`test/helpers/graphFake.js`) runs only named write statements. Its path reads (`test/helpers/pathCypherFake.js`) cover only the relationship types its callers list.

Concepts touched: `39998:<TA>:concept-header` and the well-known core-node concepts `superset`, `set`, `word`, `json-schema`, `primary-property`, `property`, `properties-set`, `property-tree-graph`, `graph`, `concept-graph` and `core-nodes-graph`. Each is read only: their supersets gain elements. No firmware definition changes.

## Options considered

The question this ADR settles for every later node-making write is how a node with no event keeps its facts.

### Option A — The letter its write would sign, recorded without signing

The write builds the unsigned event it would have signed: kind, tags and JSON, as today's route builds them. It records that event's node exactly as the import would, minus the event itself: the same address, labels other than `NostrEvent`, properties other than `id`, and the would-be tag nodes with the uuids the import gives them. It adds a tapestryKey (`keyNode`) and a tapestryValue (D11).

- **Pros:** every reader works with no change, `_fields.js`, the concept-graph reads and the derive step among them, because the node is exactly the node an import makes. `export nostr` (A10.34) can later sign the node's tags as they stand, and the import's adoption (fact 2) lands that letter on the same node. It is add-subset's pattern (fact 4), already reviewed and shipped.
- **Cons:** the facts stay in tag nodes and a json blob, not as properties and edges (D10's aim and D9's drafting). That reduction is still to do, and now covers these nodes too.

### Option B — Properties and edges only, no tag nodes (D9's drafting, not confirmed)

Each fact goes on the node as a property, and each link as an edge. There is no json tag.

- **Pros:** it is D10's fully stated graph, and it would be ready for the Tapestry Graph Conjecture's reduction.
- **Cons:** no reader of today's can read it. `_fields.js` (`conceptOf` and `elementsOf` read json tags), the concept-graph reads, the derive step and the UI would each need a second way in before the first concept could be read, and AC2 would fail. It is also the larger decision D10 leaves open: which properties carry what. Doing it here would decide it for every concept at once.

### Option C — A signed letter kept off the relay

The write signs the event with the assistant's key, but stores it in the graph only, never in the relay.

- **Pros:** the node is an ordinary imported node, with an `id`.
- **Cons:** it signs. D1 says graph writes never sign, and ADR 0004 Decision 10 proves that no graph operation reads the assistant's secret key. The letter would also claim publication that never happened.

## Decision

We chose **Option A**. The node is exactly what today's readers read, it is the shape add-subset already ships, and it keeps D10's reduction a separate, deliberate change. Option B is the eventual state, reached by `rules repair` and the cache work, not by these writes.

**1. A node with no event** (`src/operations/catalog/graph/_eventless.js`, new, for every node-making write). Given `{ uuid, kind, labels, name, tags }`, inside `ctx.tx` it makes:
- the node, with `CREATE (n:<labels> {uuid, kind, pubkey, name, tapestryValue, created_at})` and `keyNode('n')`, so it gets the shared label and a random key. `pubkey` is the assistant's (`getOwnerAssistantPubkey()`), the would-be author. `name` and `tapestryValue` are the same text (D11). `created_at` is now, in seconds, taken inside the transaction. There is no `id` and no `NostrEvent` (D7). `labels` come from a fixed list, never from input: `ListHeader` or `ListItem` by kind, plus a role label.
- one `NostrEventTag` per tag, in order, `(n)-[:HAS_TAG]->(tn)`, each with `keyNode('tn')`. Its uuid is `sha256("<uuid>:<tag.join(',')>:<index>")`, and it holds `type` and `value`, with `value1` and `value2` only when the tag has them, exactly as `importEventDirect` makes them (fact 2).

It answers the node's tapestryKey. It never signs, publishes, or reads a key file beyond the assistant's public key.

**2. Names** (`src/lib/conceptNames.js`, new). It holds `toSlugName`, `toKeyName`, `toTitleName`, `toLabelName` and `deriveAllNames`, copied from today's route, which stays as it is (D15). It adds:
- `cleanName(text)`: trim, and turn each run of white space into one space.
- `nameProblem(name)`: the reason, or null, for a cleaned name that is empty, whose `dtag.slug` is empty, that has a control character (`\p{Cc}`) or a text-direction control (U+202A–U+202E, U+2066–U+2069), or that is longer than 200 characters.
- `descriptionProblem(text)`: control characters other than line breaks and tabs. A description is trimmed, and one that is empty once trimmed counts as left out.

Both operations refuse a problem with `bad-name` (400) or `bad-description` (400), naming the input, before they read the graph (AC5).

**3. The eight nodes** (`src/operations/catalog/graph/_concepts.js`, new). `conceptNodes({ names, d, ta, description })` builds each node's `{ uuid, kind, labels, name, tags }` from one set of names:
- **Addresses.** The header is at `39998:<TA>:<d>`. Each core node is at `39999:<TA>:<d>-<suffix>`, with the suffixes `superset`, `schema`, `primary-property`, `properties`, `property-tree-graph`, `concept-graph` and `core-nodes-graph`. `d` is `dtag.slug(name)`. Core nodes take the header's d-tag, not `oSlugs.singular` (fact 3), so the `concept-graph` tag always names its node. When any of the eight addresses is held by a node, of any label, `d` takes the first free versioning nonce, `<d>~1` to `<d>~99` (`dtag.headerDTag(name, n)`). Past that, it refuses `no-free-address` (409).
- **Labels:** the header `ListHeader:ConceptHeader`; the superset `ListItem:Superset`; the schema `ListItem:JSONSchema`; the primary property `ListItem:Property`; the other four `ListItem`. These are today's, minus `NostrEvent`.
- **Tags and JSON:** the tags and word-wrapper JSON today's route signs for the same names, in the same order. Each core node also gets the spec's `["o", "<header address>", "<role>"]` tag after its `z` tags (tapestry-concepts.md: "Publishers SHOULD include it on new core nodes"). The core nodes graph and the concept graph get their final JSON at once, with the core nodes graph's own address and the concept graph's import of it, since every address is known before anything is written. Today's route needs a second signature for that.
- **Wiring:** the eight edges today's route makes, through `firmware.relAlias`: `CLASS_THREAD_INITIATION` (header to superset), `CORE_NODE_JSON_SCHEMA`, `CORE_NODE_PRIMARY_PROPERTY`, `CORE_NODE_PROPERTIES`, `CORE_NODE_PROPERTY_TREE_GRAPH`, `CORE_NODE_CORE_GRAPH`, `CORE_NODE_CONCEPT_GRAPH`, and `PROPERTY_MEMBERSHIP` (primary property to schema).
- **Memberships (D9):** a `CLASS_THREAD_TERMINATION` edge from the superset of every concept each node's `z` tags name, `word` included, and from the concept-header concept's superset to the header. These are the edges a reinstall's passes 1d, 1d½ and 3 would add (fact 5), so a reinstall finds nothing to add. *(Amended: a reinstall also prunes, so the memberships are the table in Amendment 2.)*

**4. This instance's own concepts, their slugs and their keys.** A concept is this instance's own when its header's `pubkey` is the assistant's, with a letter or without one. Headers by the owner's own key, and by anyone else, are other authors' concepts. They are reported, never changed (D4; the assistant can't sign a new version of them). A concept's slug is its header's `slug` tag, else its JSON's `conceptHeader.oSlugs.singular`, else `toSlugName` of its singular name. Its key is `conceptHeader.oKeys.singular`, else `toKeyName` of its singular name. Its singular and plural names are the `names` tag's `value` and `value1`, else `oNames`, else the header's `name`. A concept is a firmware concept when its header's address is `firmware.conceptUuid(<its d>)`.

**5. The rule `concept-slug-unique`** (`src/operations/rules/concept-slug-unique.js`, new). It says that no two of this instance's own concepts share a slug or a key (BIBLE §10, rule 10, as its full text gives it). It is a graph rule about the owner's and admins' own concepts, and it refuses. Its items are `{ concept?, slug?, key?, repeat? }`:
- **A create** passes `{ slug, key, repeat: true }`. An own concept with that slug is the repeat, so nothing is violated. Otherwise, an own concept with that key is a violation: `key-in-use` (409), naming it.
- **An update** passes `{ concept, slug }`. Another own concept with that slug is a violation: `slug-in-use` (409), naming it. An item whose `concept` names no own concept header has no violations, so the operation's own refusals (Decision 9) answer for it.
- **As a check,** each own concept is an item `{ concept }` (Amendment 1.2). Every concept that shares a slug or a key with another is a violation, so `rules check` (A10.31) names both.

Its one read lists every own header with its `slug`, `names` and `json` tags.

**6. One lock for concept writes.** `apply` first takes a write lock on the concept-header concept's header (`firmware.conceptUuid('concept-header')`), with `MATCH (n:TapestryNode {uuid: $uuid}) SET n.tapestryLock = true REMOVE n.tapestryLock`. Neo4j holds it until the transaction ends. No row means the firmware isn't installed: `not-installed` (409). Then `apply` runs the rule again, through `findRule('concept-slug-unique').violations`, with the same items, and throws its refusal with `rule` set, as the write path does. The guard still runs first, so a broken call is refused before the lock. The second run closes the gap between two calls at once. The second call waits for the first to commit, then reads what it made, so two creates with the same name make one concept (AC3). Every create and every update takes this lock, and nothing else does.

**7. `graph create-concept`** (`src/operations/catalog/graph/create-concept.js`), `owner-and-admins`.
- **Inputs:** `name` (text, required), `plural` (text), `description` (text, up to 10,000 characters). Its `repeatKey` is `['name']`, and its guard is `concept-slug-unique`, with `items: (inputs) => [{ slug, key, repeat: true }]` from the cleaned name. For a name with a problem, `items` gives none, so the guard reads nothing and `apply` refuses the name first.
- **Steps, in one transaction:**
  1. Clean and check the names and the description (Decision 2). Left out, the plural is the name with an `s`.
  2. Take the lock and run the rule again (Decision 6).
  3. If an own concept has the slug, answer `already-exists`: changes empty, no entry. The answer has its description (Decision 11) and `differs`, each given input that differs from what the concept holds, as `{ input, given, holds }`. Names are compared after `deriveAllNames`, and the plural and description only when given.
  4. Otherwise, find the superset of each concept the nodes join (Decision 3). A missing one, or no assistant key, refuses `not-installed` (409), naming which.
  5. Choose the free `d` (Decision 3), and make the eight nodes (Decision 1), their eight edges and their memberships. Edges use add-relationship's `MERGE` statement between nodes found by tapestryKey.
  6. Read the near matches (Decision 8).
- **Answer:** `{ outcome: 'created' | 'already-exists', concept, differs, similar, moreSimilar, note?, change }`. `note`, on a create only, says the concept is in this instance's graph only, and only a backup keeps it (BIBLE §30), as add-subset's answer does.
- **Refusals:** `bad-name`, `bad-description`, `not-installed`, `no-free-address`, and the rule's `key-in-use`. The rule also lists `slug-in-use`, which only update-concept meets.

**8. Near matches** (`similar`). This is a read of headers by any author, in the transaction, after the write. It matches those whose lowercased name, `names` values or `slug` tag equals the asked singular or plural, by name or by `toSlugName`. The concept just made, or the one returned, is left out. Each match is `{ concept, address, names, slug, author, own, match }`, where `match` is:
- `same-slug`: another author's concept with the asked slug;
- `same-name`: any concept, this instance's own included, with the asked singular name and another slug;
- `plural-swap`: a concept whose singular is the asked plural, or whose plural is the asked singular.

The list is capped at 10, in that order of `match` and then by address. `moreSimilar` says whether there were more. Nothing here is weighed by trust. Whether another author's concept counts is a point-of-view question for whoever reads the list (CLAUDE.md principle 1).

**9. `graph update-concept`** (`src/operations/catalog/graph/update-concept.js`), `owner-and-admins`.
- **Inputs:** `concept` (a tapestryKey, required), `name`, `plural`, `slug` (kebab-case, `^[a-z0-9]+(-[a-z0-9]+)*$`, up to 200 characters) and `description`. Its `repeatKey` is `['concept', 'name', 'plural', 'slug', 'description']`, and its guard is `concept-slug-unique`, with `[{ concept, slug }]` when a slug is given.
- **Steps, in one transaction:**
  1. Refuse `nothing-to-change` (400) when no field is given. Clean and check the given fields (Decision 2).
  2. Take the lock and run the rule again.
  3. Read the concept by its header's tapestryKey. Refuse `unknown-concept` (404) unless it is a `ConceptHeader` or `ListHeader`, `not-own-concept` (409) unless it is this instance's own, and `firmware-concept` (409) for a firmware concept. Refuse `name-keyed` (409) when the singular name changes and `nameKeyed(<the current singular>)`.
  4. Work out the new values. When they equal the current ones, answer `unchanged`, with no changes and no entry.
  5. Otherwise, write in place:
     - **The rename rule.** Build the eight nodes' names, tags and JSON twice, with `conceptNodes`, from the old names and from the new. Both builds keep the concept's own slugs, key, labels and addresses. Each value that differs between the two builds, in a node's `name`, `tapestryValue`, `name` and `names` tags, `description` tags and JSON, is set to the new value, but only where the node still holds the old one. So every value the names made follows the rename, and a value someone changed by hand stays. The slug fields are equal in both builds, so a rename never moves them (AC6).
     - **A slug** sets the header's `slug` tag, adding it if missing. `oSlugs` stays, as the Dictionary keeps it.
     - **A description** sets the header's `description` tag and `conceptHeader.description`. An empty one removes the tag, and the JSON's description goes back to the default create-concept writes for the current names.
     - **A json tag held in the LMDB** (`lmdb:<key>`) is read through the store, and its new value is written inline, so the graph holds the change (BIBLE §30).
- **Answer:** `{ outcome: 'updated' | 'unchanged', concept, changed, letterOutOfDate, change }`. `changed` lists the fields that changed. `letterOutOfDate` is true when this call changed a node that has a letter (an `id`): the graph now differs from the letter until `export nostr` (A10.34) sends a new one (D2).
- **Refusals:** `nothing-to-change`, `bad-name`, `bad-description`, `unknown-concept`, `not-own-concept`, `firmware-concept`, `name-keyed`, `not-installed`, and the rule's `slug-in-use`. `invalid-input` is built in, and covers a slug that isn't kebab-case.

**10. The change entries** (`src/operations/changes.js`; ADR 0004 Decision 5):
- **A create** records `{ change: 'concept-created', concept: <header key>, nodes: [the eight keys], count: 8, name, slug }`.
- **An update** records one `{ change: 'concept-updated', concept, field, was, now }` for each field that changed, and `{ change: 'core-nodes-renamed', concept, nodes, count }` when a rename changed core nodes.

`CHANGE` gains `name`, `slug`, `was` and `now` (text, `nullable`), and the descriptions of `field` and `nodes` widen to cover concepts. `keysOf` already reads `concept` and `nodes`, so `graph history` finds an entry by any of the concept's nodes (AC2).

**11. A concept, as answered** (`describeConcept(read, headerKey)` in `_concepts.js`):
- `{ conceptHeader, nodes, address, names, slug, key, description, hasLetter }`;
- `nodes` maps each role, as `coreNodesGraph.constituents` names it, to its tapestryKey, found through the eight wiring edges, or null where the concept lacks that node.

create-concept's already-exists answer and update-concept's answer use it, and `graph describe-concept` (A10.10) can build on it.

**12. What reads it.** `_fields.js` reads a concept made here as it reads a lettered one, with no change: `conceptOf` finds the header's json tag and the schema node's json tag, and `elementsOf` walks its class thread. Its fields can be marked once `graph add-property` (A10.18) gives it property nodes. Until then, mark-field refuses `no-property-node`, as for any concept without them. The concept-graph reads find it by label and address (AC2).

**13. Durability (AC8).** A reinstall adds no edge to these nodes, since Decision 3 made them all *(and, amended, prunes none, since Amendment 2 wires what a reinstall leaves)*. It rebuilds only firmware headers, and update-concept refuses those. Its derive pass writes each node's LMDB entry and its `tapestryJsonUpdatedAt` stamp. "As it was" means the same nodes, labels, properties (the cache's stamp aside), tags and relationships. A backup carries the whole graph, so a restore brings the concept back with its keys (ADR 0002).

**14. The rules document and the catalog.** `docs/GRAPH_RULES.md` gains §4, `concept-slug-unique`, in the form its entries take: what it says, its kind, what it refuses, its check, repair (none yet) and where it is enforced. The catalog's §2 rows for create-concept and update-concept give these refusals and reports.

## Consequences

**What this enables**

- Concepts with no event, made and renamed through the operations: the first step of the rebuild (A10.39).
- One way to make a node with no event, `_eventless.js`, which create-set (A10.27) and create-element (A10.20) reuse, along with the fake graph's statements for it (Implementation notes).
- Rule 10 as a defined rule, ready for `rules check` (A10.31).

**What this constrains**

- **Today's routes can't find these concepts.** The seventeen name lookups and the UI's concept list read only `NostrEvent` headers (the story's Out of scope). Until A10.18 and A10.20 land, a concept made here gets properties and elements from no route.
- **A rename of a concept that has a letter can be undone by importing that letter again.** `importEventDirect` replaces a node's tags with the event's. So an old letter imported again, by `POST /api/neo4j/event-update`, say, brings back the old names. The answer's `letterOutOfDate` warns. Keeping a newer local version over an older letter is for provenance (design §5, question 2) and `export nostr` (A10.34).
- **Concept writes are one at a time** on each instance: they all take one lock. That is fine at this scale. A bulk create (catalog §10, question 6) would hold it once for the batch.
- **A key, once given, is the concept's for good.** After a slug change, a create whose name gives the old key is refused (`key-in-use`) while the renamed concept keeps it. This corrects the story's AC6, which said such a create makes a new concept. The owner approved the correction with this ADR (2026-11-15).

**New debt and follow-ups**

- **The cache stays as it was after an update** (fact 7). The LMDB copy of a renamed node keeps its old names until the cache is rebuilt, and the derive step rebuilds from that copy before the json tag. Clearing an entry here could destroy a json tag held in the LMDB. So this ADR leaves the cache alone, and `cache check` and `rebuild` (A10.36) must rebuild from the graph. That goes on Loom as a memo on A10.36.
- **`tapestryValue`** appears for the first time, on these nodes only. `rules check` will find the nodes that lack it (D15).
- **The names copied from today's route** can drift from it. A test pins the copy's output, and today's route is due to retire (D15).
- **Firmware reinstall required?** No: no concept definition changes.

## Implementation notes

- **`src/lib/conceptNames.js`** (new): Decision 2. Pure, with no requires beyond `src/lib/dtag.js`.
- **`src/operations/catalog/graph/_eventless.js`** (new): `makeNode(tx, { uuid, kind, labels, name, tags })`, giving the node's tapestryKey (Decision 1); `tagRows(uuid, tags)`, the import's tag uuids; and `LABELS`, the list labels come from.
- **`src/operations/catalog/graph/_concepts.js`** (new):
  - `conceptNodes`, `ownConcepts(read)`, `describeConcept`, `nearMatches` and `supersetsOf(read, slugs)`;
  - `lock(tx)`, for the lock and its `not-installed`;
  - `rename(old, now)`, for the rename rule's paths;
  - the shared refusals.

  It opens nothing at load (ADR 0001 Decision 10).
- **`src/operations/rules/concept-slug-unique.js`** (new): Decision 5. It requires `_concepts.js`'s `ownConcepts` when `violations` runs.
- **`src/operations/catalog/graph/create-concept.js`** and **`update-concept.js`** (new): Decisions 7 and 9.
- **`src/operations/changes.js`**: the `CHANGE` fields (Decision 10).
- **`docs/GRAPH_RULES.md`** §4, and **`docs/GRAPH_OPERATIONS_CATALOG.md`** §2's two rows (Decision 14).
- **Statements** (the Tester teaches the fake those it doesn't run; the Implementer keeps to them):
  - **C1, the lock:** `MATCH (n:NostrEvent|TapestryNode {uuid: $uuid}) SET n.tapestryLock = true REMOVE n.tapestryLock RETURN n.tapestryKey AS key` (Amendment 1.1).
  - **C2, own headers:** `(h:ConceptHeader OR h:ListHeader) AND h.pubkey = $ta`, with their `slug`, `names`, `json` and `description` tags, by `OPTIONAL MATCH (h)-[:HAS_TAG]->(t:NostrEventTag)`, one row per tag, grouped in code.
  - **C3, supersets:** `UNWIND $uuids AS u MATCH (h:NostrEvent|TapestryNode {uuid: u})-[:IS_THE_CONCEPT_FOR]->(s:Superset) RETURN u AS concept, s.tapestryKey AS superset`.
  - **C4, held addresses:** `MATCH (n:NostrEvent|TapestryNode) WHERE n.uuid IN $uuids RETURN n.uuid AS uuid`.
  - **C5, a node:** Decision 1's `CREATE`, with `keyNode('n')` and `RETURN n.tapestryKey AS key`.
  - **C6, its tags:** `MATCH (n:TapestryNode {tapestryKey: $key}) UNWIND $tags AS t CREATE (n)-[:HAS_TAG]->(tn:NostrEventTag {uuid: t.uuid, type: t.type, value: t.value}) SET tn.value1 = t.value1, tn.value2 = t.value2` plus `keyNode('tn')`.
  - **C7, an edge:** add-relationship's `MERGE`, which the fake runs.
  - **C8, near matches:** headers of any author with `toLower(h.name) IN $names`, or a `names` or `slug` tag that matches.
  - **C9, a concept by key:** the header by tapestryKey, its core nodes through the eight wiring types, and their tags.
  - **C10, changed values:** the field mapping's S8 (`UNWIND $rows AS row MATCH (n:TapestryNode {tapestryKey: row.key}) WHERE NOT n:GraphChange SET n += row.props`), for nodes and for tag nodes alike, since tag nodes have keys too.
  - **C11, a removed tag:** `MATCH (t:NostrEventTag:TapestryNode {tapestryKey: $key}) DETACH DELETE t`.

  The fake's path reads gain the four wiring types they lack: `IS_THE_PROPERTIES_SET_FOR`, `IS_THE_PROPERTY_TREE_GRAPH_FOR`, `IS_THE_CORE_GRAPH_FOR` and `IS_THE_CONCEPT_GRAPH_FOR`.
- **Tests** (the Tester's, Phase 3):
  - a suite per operation and one for the rule, under `test/operations/`, registered in `test/operations.test.js`;
  - an agent suite through the external CLI;
  - a pin of `conceptNames.js` against a table of names and what today's route gives them;
  - a guard that no new module requires anything that signs (ADR 0004 Decision 10's spy).
- **The live check** runs on a scratch stack (`scripts/scratch-stack.sh`), never the agent-memory instance. It covers:
  - a concept made each way, compared;
  - a reinstall, and a backup restored on a fresh stack;
  - two creates at once;
  - an admin agent through nginx and the external CLI;
  - the relay's event count, unchanged.
- **Branches:** staging only, by the usual chain. This isn't a fix that must reach other live branches.

## Amendment 1 (2026-11-15, at Test Design) — what the tests pin that the Decisions left open

1. **The lock names `NostrEvent|TapestryNode`** (Decision 6, C1). It finds a node by its address, and ADR graph-operations-foundation/0003 Decision 9 holds every such lookup to the disjunction until every instance has run both migrations. The key-path guard (G11, `test/operations/lifecycle/tapestry-key-paths.test.js`) checks it.
2. **The rule's items** (Decision 5). A check's item is `{ concept }`, and the rule reads that concept's own slug and key, as Decision 4 gives them. An update's item, `{ concept, slug }`, checks the slug alone. So a key two concepts already shared, before this rule existed, never blocks an update that doesn't touch it. A create's item stays `{ slug, key, repeat: true }`.
3. **A concept, as answered** (Decision 11):
   - `nodes` holds the header too, under `conceptHeader`, as `coreNodesGraph.constituents` does;
   - `description` is the header's `description` tag, else its JSON's `conceptHeader.description`, else null;
   - each `differs` entry is `{ input, given, holds }`, with `given` the cleaned input. The names are compared after `deriveAllNames`, so `Coffee  House` is no different from `coffee house`.
4. **What the fake graph learns** (Implementation notes; the Tester's commit): C1, C5 for any node, C6 and C11 as write statements of their own; label alternatives in them; `toLower` in both read fakes; and the four wiring types. Each has its own test in `test/operations/graph-fake.test.js` (F15–F20). Nothing it ran before changed.
5. **AC2's oracle is the route itself.** `test/helpers/todaysCreateConcept.js` runs today's `handleCreateConcept`, read from its source, in a sandbox that records what it would sign and wire. So the comparison can't drift from the route, and fails loudly if the route moves.

## Amendment 2 (2026-11-15, at Implementation; the owner's ruling) — memberships are what a reinstall leaves

Decision 3 wired each node into every concept its `z` tags name, `word` included, on the premise that a reinstall only adds memberships. The live check (L3) found the premise wrong. A reinstall also prunes the memberships its passes judge redundant:
- Of the 21 the Decision wired, it removed 11: every `word` membership, `graph` on the three graph nodes, and `set` on the properties set.
- A second reinstall changed nothing, so that is where a reinstall settles.
- Every concept the `z` tags name still reaches each node through its class thread: `word`, for one, contains every core-node concept.

The owner chose to wire that end state directly (2026-11-15), so a reinstall leaves a new concept as it was, as AC8 says:

| Node | An element of |
|---|---|
| header | `concept-header` |
| superset | `superset`, `set` |
| JSON schema | `json-schema` |
| primary property | `primary-property`, `property` |
| properties set | `properties-set` |
| property tree graph | `property-tree-graph` |
| concept graph | `concept-graph` |
| core nodes graph | `core-nodes-graph` |

- **The `z` tags don't change.** They are the letter's, and they still name every concept the node belongs to, `word` and `graph` among them. The class threads give those memberships.
- **`not-installed` still asks for all twelve firmware concepts the `z` tags name.**
- **The table follows firmware 1.0.0's pruning, which isn't fully consistent.** It keeps `set` on the superset but prunes it on the properties set. A firmware that prunes differently would change what a reinstall leaves; the live check is what shows it.
- **The same check found a bug in today's concepts:** a reinstall takes the superset of a concept today's route made out of the superset concept. That is ledger `2026-11-15-reinstall-drops-a-supersets-own-membership`.

## Out of scope

- How `export nostr` signs these nodes (A10.34), and provenance (design §5, question 2).
- Moving the facts into properties and edges (Option B), and the cache's rebuild (A10.36).
- Pointing to another author's concept in place of making one (the shared-concepts app layer).
- Changing a concept's key, labels or address; `graph delete-concept` (A10.17); properties and the schema (A10.18).
- Today's routes, which keep finding concepts by name among event nodes (D15).
