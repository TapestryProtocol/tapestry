# Graph Operations — Catalog (draft for review)

**Status:** Draft for review, 2026-11-07. Every name, route and input below is a proposal. Only what cites a decision (D1–D13 in [GRAPH_OPERATIONS_DESIGN_HANDOFF.md](GRAPH_OPERATIONS_DESIGN_HANDOFF.md)) is settled.
**Provenance:** Drafted from the design doc's decisions and from today's routes (staging `325b080f9`). None of the wording here is the owner's.
**Reviewed by the owner:** not yet.

**What to look for:** an operation that's missing; one that doesn't fit its group or has no home; one whose callers are wrong (should it be owner only?); and any of today's routes in §9 that has no good home.

## Conventions

- **Groups, routes and commands.** Seven command groups, following D1: `graph`, `raw` (the graph's owner-only tier), `rules`, `import` and `export` (the two halves of outside data), `cache` and `lifecycle`. Each operation would be a `GET` (reads) or a `POST` (writes) at `/api/tapestry/<group>/<operation>` (D13), and the command `tapestry <group> <operation>` on both CLIs, so each name maps to the other: `tapestry graph create-set` is `POST /api/tapestry/graph/create-set`. `raw` has no routes.
- **Naming a node.** An input that names a node takes its `tapestryKey` (D6). `graph resolve` turns a name, a slug or a nostr address into the nodes it names, from a point of view, and never picks one. What a ref names, and when it is ambiguous, is defined once, in `src/operations/resolve.js` (ADR graph-operations-first-slice/0009), so an input that takes a ref resolves it the same way: it refuses a ref that names no node (`unknown-ref`) or more than one (`ambiguous-ref`, with the candidates), and never guesses. Several of today's routes take a name and use the first match.
  - **What a ref names.** A ref is read by its shape. A tapestryKey names the node that has it. A nostr address (`kind:pubkey:d-tag`), an event's id, or the `naddr`, `nevent` or `note` of one names the node at it. Anything else is a name, with its extra white space cleaned: it names every node whose name it is, without regard to case, and every concept whose plural it is. A name with a slug's shape is a slug too, which names every concept whose slug it is and every concept-graph node (kind 39998 or 39999) whose d-tag it is. A change entry is never a candidate. A ref that is empty, or holds a character that can make it read as another, is refused (`bad-ref`).
  - **How an input takes a ref.** Its declaration will say which of its inputs take one, and of which kind: a concept, a set or any node. Each is resolved before the operation sees it, from the read's own point of view, or the owner's for a write, whose refs are resolved inside its transaction, before its guards. A ref shaped like a tapestryKey is used as given. The first operation that takes a ref builds this; until one does, every node input takes tapestryKeys only, and an agent calls `graph resolve` first.
- **Every write** checks its guards (D3) unless its group says otherwise, is safe to repeat (keyed as its row says), and never signs (D1). As proposed in the design doc's §5, it also records a change entry: which admin, which operation, what changed.
- **Every read** follows the read conventions, defined once in `src/operations/reads.js` (ADR graph-operations-first-slice/0011, and 0013 for relationships):
  - **Paging.** A read that answers a list takes `limit` (1 to 200, 50 by default) and `cursor`. It answers its items with the `cursor` for the next page, which is null on the last. Items come in an order that never changes for an item: by `tapestryKey` for a list of nodes, unless the read is about time, as `history` is (newest first); for a list of relationships, outgoing before incoming, then by type, the other node's `tapestryKey` and the relationship's `elementId`, as `list-relationships` gives them (ADR 0013). A walk is the one exception: it answers nearest first, by steps from a start node and then by `tapestryKey` (ADR 0014), so a change to the graph between two pages that brings a node nearer, or takes it further away, can move that node. A cursor works only with the read and the list that gave it, so one from another list is refused. `graph history`'s cursor is older than these conventions and names no list.
  - **Point of view.** A read that can include other authors' nodes takes `pov`: `owner`, the default (the owner's own pubkey means the same), or `everyone`; other points of view are to come. From the owner's point of view, a node counts when it has no author, when its author is the instance's assistant or its owner, or when GrapeRank scores its author above the verified cutoff (`VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`). An admin counts by score, like anyone. `everyone` counts every author's claims. The test runs inside the read's own query, so nothing is stored per point of view, and the answer says which point of view it read from.
  - **A node, answered,** has five facts:
    - `tapestryKey`;
    - `name`: its tapestryValue, else its name;
    - `address`: its nostr address, or its event id, as the graph records it;
    - `author`: its author's pubkey;
    - `own`: whether it is the instance's own, meaning by its assistant or its owner, or made here with no author.

    A read may add facts of its own, never rename or drop these.
  - **A relationship, answered,** has six facts:
    - `type`;
    - `direction`: `out` when it runs from the node the read is about, `in` when it runs to it;
    - `from` and `to`: the tapestryKeys of the nodes it runs from and to, which with `type` are what `graph remove-relationship` takes;
    - `node`: the node at its other end, answered as above;
    - `properties`: what it records about itself, `{}` for most.

    A relationship from a node to itself has `from` and `to` alike, and a read that lists both directions answers it once, as `out`. A read may add facts of its own, never rename or drop these.
  - **A relationship, from a point of view.** No relationship records its author yet, so a relationship counts when the node at its other end counts, by the test above. The node a read is about is never left out, since the caller named it: the node `list-relationships` lists, or a node a `walk` starts from. When relationships come to record who made them, the test widens to judge that too, in `reads.js`.
  - **Sign-in.** Every read is for the owner and admins until read visibility is decided (§10, question 1), and a read writes nothing.
- **Every exporter takes the same scope:** a node, a graph, or everything (D12). A graph is an element of the `graph` concept, listing nodes and the relationships between them: a concept's concept graph (one of its eight core nodes), a Tapestry (BIBLE §6), or a selection saved as a graph of its own with `graph create-element`. The destination is the only difference between exporters.
- **Who may call** is given for each group, with exceptions in the rows.
- **The Today column** starts with how much of the job today's routes already do: **New** (nothing does it), **Partial** (a route does part of it), **Exists** (a route does it without signing) or **Signs** (a route does it, but signs a nostr event first). It names each route, and "(not in /docs)" marks a route that works but isn't in the instance's API document yet.

## At a glance (61 operations)

- **Graph reads (10):** orient, search, resolve, describe-concept, describe-node, list-elements, class-thread-path, list-relationships, walk, history.
- **Graph writes (25):**
  - concepts: create-concept, update-concept, delete-concept;
  - properties and schema: add-property, update-property, remove-property, set-schema, enumerate, mark-field, unmark-field, map-fields;
  - nodes: create-element, update-node, add-to-concept, remove-from-concept, move-element, copy-node, merge-nodes, delete-node;
  - sets: create-set, link-set, unlink-set, delete-set;
  - relationships: add-relationship, remove-relationship.
- **Raw (6, owner only):** create-node, delete-node, set-property, create-edge, delete-edge, cypher.
- **Rules (3):** list-rules, check, repair.
- **Import (4):** nostr, file, web, refresh.
- **Export (4):** nostr, file, status, retract.
- **Cache (3):** get, check, rebuild.
- **Lifecycle (6, owner only):** backup, restore, seed-firmware, migrate, wipe, status.

## 1. Graph reads

Who may call: the owner and admins. Who else may read, and what, is question 1 in §10.

| Operation | What it does | Takes → returns | Today |
|---|---|---|---|
| `orient` | A map of the graph for a newcomer: its concepts, their sizes, recent changes | `limit` → summary | Partial: `GET /api/concept-graph/summaries` (not in /docs) lists every concept with a description snippet and its element and set counts, and `GET /api/audit/stats` counts nodes, edges and each concept's elements. Nothing reports recent changes. |
| `search` | Find concepts and elements by text | `q`, `kind?`, `concept?`, `pov?`, `limit` → matches (tapestryKey, name, kind, concepts) | New. Today an agent writes its own Cypher for `POST /api/neo4j/query`, whose reads are open to anyone. |
| `resolve` | The nodes a name, a slug, a nostr address or a tapestryKey names, from a point of view; it never picks one | `ref`, `kind?` (`concept` or `set`), `pov?`, `limit?`, `cursor?` → the `ref`, trimmed, and its `readings` (how it was read); a page of `candidates`, each a node as the Conventions answer one, with its `kind` and how the ref `matched` it; `ambiguous` when more than one counts; `kept` and `leftOut`, counted across the whole list; the `pov` read from; and the `cursor` for the next page | New. Several write routes take a name and use the first match; `GET /api/concept-graph/node/:handle` (not in /docs) takes only a nostr address. |
| `describe-concept` | A concept's definition: its names, description, properties, schema, sets and element count | `concept` → description | Partial: `GET /api/concept-graph/node/:handle` (not in /docs) returns a concept header's content and `GET /api/concept-graph/node/:handle/core-nodes` (not in /docs) its core nodes, by nostr address only; `GET /api/audit/concept` audits one concept's health. |
| `describe-node` | One node: its fields, its concepts, its relationships, where it came from and where it was sent | `node` → description | Partial: `GET /api/concept-graph/node/:handle` (not in /docs) returns one node's content and `GET /api/concept-graph/node/:handle/neighbors` (not in /docs) its neighbors, by nostr address only. Nothing records where a node came from or where it was sent. |
| `list-elements` | The elements of a concept or a set, through its class thread, from a point of view | `concept` or `set`, `direct?`, `pov?`, `limit?`, `cursor?` → a page of `elements`, each a node as the Conventions answer one; `kept` and `leftOut`, counted across the whole list; the `pov` read from; and the `cursor` for the next page | Partial: `GET /api/concept-graph/subgraph/:handle` (not in /docs) walks out from a node, at most three levels, with no paging and no point of view. |
| `class-thread-path` | How a node is an element of a concept, or why it isn't | `node`, `concept` → the path, or none | Partial: `GET /api/audit/threads` checks the class threads of whole concepts, not one node's path. |
| `list-relationships` | A node's typed relationships, in and out, each with the way it points, from a point of view | `node`, `type?`, `direction?` (`out`, `in` or `both`, the default), `pov?`, `limit?`, `cursor?` → the `node`, as the Conventions answer one; a page of `relationships`, the outgoing first, each a relationship as the Conventions answer one; `kept` and `leftOut`, counted across the whole list; `tagsLeftOut`, the relationships to tag nodes left out when no `type` is given; the `type`, `direction` and `pov` listed by; and the `cursor` for the next page | Exists: `GET /api/concept-graph/node/:handle/neighbors` (not in /docs) returns a node's one-hop neighbors, grouped by relationship type. |
| `walk` | Follow chosen relationship types out from one or more nodes, up to a depth, from a point of view: each node reached once, on a shortest path | `from` (1 to 100 tapestryKeys), `types?` (1 to 50), `direction?` (`out`, `in` or `both`, the default), `depth?` (1 to 10, 1 by default), `pov?`, `limit?`, `cursor?` → the start nodes, `from`, as the Conventions answer a node; a page of `nodes`, nearest first, each a node as the Conventions answer one with its `depth`, its `start` and its `path`, every step a relationship as the Conventions answer one; `kept` and `leftOut`, counted across the whole walk; `tagsLeftOut`, the tag nodes passed by when no `types` are given; `complete` and `finished`: whether the walk finished, or stopped short at its bound of 10,000 relationships read, and how many steps it finished; the `types`, `direction`, `depth` and `pov` walked by; and the `cursor` for the next page | Partial: `GET /api/concept-graph/subgraph/:handle` (not in /docs) walks out from one node, at most three levels, with no choice of relationship types and no point of view. |
| `history` | Changes to a node, by one admin, or since a time (proposed) | filters → change entries | New. |

`list-elements`, `class-thread-path` and `list-relationships` are particular walks. A search strategy combines `search`, `walk` and `describe-node`; which strategies to package into `search` itself is left to the search story (design doc §5, question 7). No relationship records its author yet, so a walk follows a relationship only to a node its point of view counts (the Conventions). `search` calls walk's engine, `src/operations/walk.js`, so its walks are the read's (ADR graph-operations-first-slice/0014).

## 2. Graph writes

Who may call: the owner and admins. Each write checks its guards before writing (D3).

**Concepts**

| Operation | What it does | Takes → returns | Refuses or reports | Today |
|---|---|---|---|---|
| `create-concept` | A concept with its eight core nodes and their wiring (BIBLE §9), with no event: each node the one the import would make of the letter today's route signs, recorded without signing (ADR graph-operations-first-slice/0016) | `name`, `plural?`, `description?` → the header's and core nodes' tapestryKeys by role; safe to repeat by slug | Answers `already-exists`, untouched, for a slug one of this instance's concepts has, naming each input that differs; reports near matches, another author's shared concept among them, and never refuses for them; refuses a key another of this instance's concepts has (`key-in-use`, `concept-slug-unique`: BIBLE §10, rule 10) and a name or plural that is empty, has no slug, has a control character, a text-direction control or an invisible character, or is over 200 characters | Signs: `POST /api/normalize/create-concept` and `POST /api/normalize/skeleton`. |
| `update-concept` | Change a concept's names, slug or description, keeping its key, labels and address | `concept`, `name?`, `plural?`, `slug?`, `description?` → the concept, what changed, and whether its letter no longer matches it | Refuses a slug in use (`slug-in-use`, `concept-slug-unique`), another author's concept, a firmware concept, and a new singular name for a concept the server finds by name, or onto such a name | Signs: `POST /api/normalize/set-slug` changes the slug only. |
| `delete-concept` | Remove a concept and its core nodes | `concept` → removed | Refuses while the concept has elements or sets | New. |

**Properties and schema**

| Operation | What it does | Takes → returns | Refuses or reports | Today |
|---|---|---|---|---|
| `add-property` | Add a property, under a parent property for nested objects | `concept`, `name`, `type`, `required?`, `description?`, `parent?` → the property's tapestryKey. Whether elements carry it on the node is a mark, made with `mark-field` | Refuses a duplicate name; reports elements that stop validating | Signs: `POST /api/normalize/create-property`. |
| `update-property` | Change a property's type, required flag or description | `property`, fields → the property | Reports elements that stop validating | Signs: `POST /api/normalize/save-schema` rewrites the whole schema. |
| `remove-property` | Remove a property | `property` → removed | Reports elements that still carry it | New. |
| `set-schema` | Make a concept's properties match a given JSON Schema | `concept`, `schema` → the properties added, changed and removed | Reports elements that stop validating | Signs: `POST /api/normalize/save-schema` and `POST /api/normalize/generate-property-tree`. |
| `enumerate` | Make a property's allowed values the elements of another concept | `concept`, `property`, `source` → the link | Refuses an unknown concept or property | Signs: `POST /api/normalize/enumerate` and `POST /api/normalize/apply-enumerations`. |
| `mark-field` | Mark a concept's top-level field, so each of its elements carries the field's value from its JSON on its Neo4j node, as `<concept key>_<field>` (`dog_breed`) | `concept`, `field` → the mark, how many elements carry it, and the elements it skipped; safe to repeat by concept and field | Refuses by the rule `field-mark-allowed`: an unknown concept or field, no property node, a field that isn't a plain value or a list of them, an unusable name, a name another mark yields, a name an element already carries; and more than 10,000 elements | New. |
| `unmark-field` | Take a field's mark out, and its copies off the concept's elements | `concept`, `field` → how many elements it cleared; safe to repeat by concept and field | Refuses an unknown concept or field, and more than 10,000 elements | New. |
| `map-fields` | Bring a concept's elements in line with its marks: a copy added, corrected or removed to match the JSON, and one no mark yields removed | `concept` → how many elements got a copy, lost one or were left alone; safe to repeat by concept | Refuses when the firmware isn't installed, an unknown concept, and more than 10,000 elements; reports the elements it skipped | New. |

Under D10 a concept's JSON Schema is computed from its property nodes, so there's no write that saves a schema directly: changing the properties changes the schema, and `set-schema` turns a given schema into properties. Today it runs the other way: `save-schema` writes the schema, and `generate-property-tree` builds properties from it.

A mark is a choice about this database's storage, not part of the schema: an edge that makes the field's property node an element of the concept of neo4j properties (`39998:<TA>:neo4j-property`), in its set of neo4j properties that are also fields (ADR graph-operations-foundation/0005). Today's routes and the import apply no mapping, so `map-fields` brings their elements into line.

**Nodes**

| Operation | What it does | Takes → returns | Refuses or reports | Today |
|---|---|---|---|---|
| `create-element` | An element of a concept, or of a set in its class thread, with no event: the node the import would make of the letter today's route signs, recorded without signing (ADR graph-operations-first-slice/0020) | `concept`, `set?`, `name`, `fields?` (an object, or its JSON text) → the element's tapestryKey, address and parents; each concept it belongs to, with whether its JSON fits that concept's schema; the node properties its concepts' marks carry; safe to repeat by name within the concept | Answers `already-exists`, untouched, for this instance's own element of the concept with the name, naming in `differs` each input that differs. Refuses by the rule `element-fits-schema` (BIBLE §10, rule 4): JSON that doesn't fit the concept's schema, naming every problem, and a concept with no schema to check against; the other concepts its set joins are reported, never refused for. Also refuses a concept that names no concept header, has no superset, is one whose elements another operation makes (`made-elsewhere`), or is keyed `word` or `graphContext`, keys an element's JSON keeps for itself (`reserved-key`); a `set` that names no node, isn't a set, or is outside the concept's class thread; a name as create-concept refuses one; and fields that aren't a JSON object or its text | Signs: `POST /api/normalize/create-element`. |
| `update-node` | Change a node's name, description or fields | `node`, fields (merged) → the node | Refuses a result that doesn't validate, and a node that came from someone else's event (D4) | Signs: `POST /api/normalize/save-element-json` and `POST /api/normalize/set-json-tag`. |
| `add-to-concept` | Make a node an element of another concept, or put it in a set | `node`, `concept` or `set`, `fields?` → the membership | Refuses fields that don't validate | Signs: `POST /api/normalize/add-node-as-element` adds the edge and then signs; `POST /api/normalize/add-to-set` signs. |
| `remove-from-concept` | Take a node out of a concept or a set | `node`, `concept` or `set` → removed | Refuses the node's last concept (D9) | Partial: `POST /api/normalize/delete-relationship` removes the edge, with no check for the node's last concept. |
| `move-element` | Move an element between two sets of the same concept, in one step | `node`, `from`, `to` → moved | Refuses sets of different concepts | New. |
| `copy-node` | Copy someone else's node into a node of your own, linked to theirs (D8) | `node`, `edits?` → the new tapestryKey | — | Signs: `POST /api/normalize/fork-node`. |
| `merge-nodes` | Merge a near-duplicate into another node: its edges move over and the merge is recorded (BIBLE §10, rule 8) | `keep`, `merge` → the kept node | Refuses a node that came from someone else's event | New. |
| `delete-node` | Delete a node of your own, with its edges | `node` → removed | Refuses core nodes, sets that still have elements, and nodes from someone else's event (§10, question 5) | New: no route deletes a node. |

**Sets**

| Operation | What it does | Takes → returns | Refuses or reports | Today |
|---|---|---|---|---|
| `create-set` | A set under a superset or another set | `parent`, `name`, `description?` → the tapestryKey; safe to repeat by name under the parent | Refuses a parent that isn't a superset or a set | Exists: `POST /api/normalize/add-subset` makes a set with no event; `POST /api/normalize/create-set` signs. |
| `link-set` | Put an existing set, or a concept's superset, under another parent | `set`, `parent` → the link | Refuses by the rule `class-thread-acyclic`: a cycle (a `parent` that is the set itself, or already below it), naming the chain from the set down to the parent. Also refuses a `set` or `parent` that names no node, a `set` that is neither a set nor a superset, a `parent` that is neither a superset nor a set (for a concept header, naming its superset), and a link that a firmware reinstall's prune would undo (`firmware-prunes`) | Exists: `POST /api/normalize/add-relationship` with the class-thread propagation type, with no cycle check; `POST /api/normalize/link-concepts` signs. |
| `unlink-set` | Take a set out from under one of its parents | `set`, `parent` → removed | Refuses by the rule `set-has-a-parent`: the set's last parent (a concept's superset has none to keep). Also refuses a `set` or `parent` that names no node, a `set` that is neither a set nor a superset, a `parent` that is neither a superset nor a set, a link firmware's definition makes (`firmware-link`), and a link another author's event claims (`peer-link`). Reports the instance's own letters that still name the parent | Exists: `POST /api/normalize/delete-relationship`, with no check for the set's last parent. |
| `delete-set` | Delete an empty set | `set` → removed | Refuses while the set has elements or sets | New. |

**Relationships**

| Operation | What it does | Takes → returns | Refuses or reports | Today |
|---|---|---|---|---|
| `add-relationship` | A typed relationship between two nodes | `from`, `to`, `type` → the relationship | Refuses a type the rules don't allow | Partial: `POST /api/normalize/add-relationship` allows two class-thread types only. |
| `remove-relationship` | Remove a typed relationship | `from`, `to`, `type` → removed | — | Partial: `POST /api/normalize/delete-relationship`, for the same two types. |

## 3. Raw

Who may call: the owner, from the internal CLI only; no API route (proposed). These skip the guards, so each one runs `rules check` on what it touched, and records a change entry.

| Operation | What it does | Takes → returns | Today |
|---|---|---|---|
| `create-node` | Create a bare node, with a new tapestryKey | `tapestryValue?`, `labels?`, `properties?` → the new tapestryKey | Exists: write Cypher through `POST /api/neo4j/query`. |
| `delete-node` | Delete a node and its edges | `node` → removed | Exists: write Cypher through `POST /api/neo4j/query`. |
| `set-property` | Set or remove one property on a node or an edge | `target`, `name`, `value` → the target | Exists: write Cypher through `POST /api/neo4j/query`. |
| `create-edge` | Create an edge of any type between two nodes | `from`, `to`, `type`, `properties?` → the edge | Exists: write Cypher through `POST /api/neo4j/query`. |
| `delete-edge` | Delete one edge | `from`, `to`, `type` → removed | Exists: write Cypher through `POST /api/neo4j/query`. |
| `cypher` | Run any Cypher statement | `statement`, `params?` → the result | Exists: `POST /api/neo4j/query`. |

Today `/api/neo4j/query` accepts write Cypher from the owner and from admins (§10, question 4).

## 4. Rules

Who may call: the owner and admins. The rules themselves are specified in the rules document (design doc §7); this group is the code that runs them.

| Operation | What it does | Takes → returns | Today |
|---|---|---|---|
| `list-rules` | Every rule, what it requires, and whether it refuses a write or only reports | → the rules | New. BIBLE §10 lists the rules as text. |
| `check` | Run the rules over a node, a concept or the whole graph | `scope`, `rules?` → violations (rule, node, severity, the repair that fixes it) | Partial: the 11 checks under `/api/audit/` cover some of the rules. |
| `repair` | Fix one violation, or every violation of one rule in a scope | `violation`, or `rule` and `scope` → the fixes made, and the choices left to you | Partial: `POST /api/normalize/prune-superset-edges` and `POST /api/normalize/wire-implicit-elements` repair without signing; `POST /api/normalize/skeleton`, `POST /api/normalize/json` and `POST /api/normalize/reconcile-primary-property` sign. |

Each repair is a guarded graph write. A repair that needs a choice, such as which of two duplicates to keep, is reported rather than made.

## 5. Import (outside data coming in)

Who may call: the owner and admins; the instance's own pipelines also call `import nostr`. Imports skip the guards (D4) and record where each node came from.

| Operation | What it does | Takes → returns | Today |
|---|---|---|---|
| `nostr` | Record nostr events as nodes, with the claims they make as edges | `ids`, `addresses`, a graph's address or `filter`, `relay?` → the nodes recorded; safe to repeat by the event's address or id | Exists: `POST /api/neo4j/event-update` imports one event; `POST /api/concept/:handle/pull-community-class-thread` (not in /docs) and `POST /api/io/imports/:tempId/execute` import more, and the stream consumer (a background pipeline, no route) imports continuously. Today's two importers build different graphs from the same event: only `buildImportCypher` derives edges from `b` tags. |
| `file` | Record a file (markdown, PDF, image, …) as a node that points at it, with whatever its importer extracts | `path`, `kind?`, `concept?` → the node | Signs: `POST /api/normalize/create-resource` records a pointer for a second-brain goal (kinds `file`, `vault-note`), and signs. |
| `web` | Record a web address as a node that points at it | `url`, `concept?` → the node | Signs: `POST /api/normalize/create-resource` (kind `web-address`). |
| `refresh` | Re-read a node's source and update what was recorded | `node` → changed, unchanged or gone | Signs: `POST /api/normalize/verify-resource`. |

Importing a graph, such as someone else's Tapestry, records its graph element and the letters it refers to.

## 6. Export (outside data going out)

Who may call: the owner, and admins for everything except where §10's question 2 decides otherwise.

| Operation | What it does | Takes → returns | Refuses or reports | Today |
|---|---|---|---|---|
| `nostr` | Publish a scope as signed events, and record what was sent | `scope`, `relays?`, `dryRun?` → the letters published; a dry run lists the letters it would publish, as new, changed or unchanged since last sent | Signs only nodes you assert, and refers to someone else's node by its address without re-signing it (D8); reports references to nodes with no nostr address yet (design doc §5, question 4) | Partial: `POST /api/strfry/publish` publishes one given event, and every signing route publishes as it writes. Nothing takes a scope or records what was sent. |
| `file` | Write a scope as a JSON or markdown bundle | `scope`, `format`, `dryRun?` → the file | — | Partial: `POST /api/io/exports` writes a file of chosen nodes and concepts, by nostr address; `GET /api/brain/export` (not in /docs) exports the second brain. |
| `status` | Which nodes in a scope were sent where, and whether each copy is still current | `scope` → each node's letters and whether they're current | — | New. |
| `retract` | Ask relays to delete the letters you published for a scope (NIP-09) | `scope`, `dryRun?` → the requests sent | Retracts only letters your keys signed | New. |

**What an export does, whatever the destination** (D12; drafting): it resolves the scope to its nodes and edges; adds, or reports, the nodes its letters refer to that have no nostr address yet; orders the letters so each goes out after the ones it refers to; applies D8 node by node; and records "sent as" for each letter. Exporting everything to nostr isn't a backup: letters are public and leave out whatever has no event form (BIBLE §30). Backup stays in lifecycle.

## 7. Cache

Who may call: the owner and admins for `get`; the owner for `check` and `rebuild`. Only the derive step writes to the cache (D10).

| Operation | What it does | Takes → returns | Today |
|---|---|---|---|
| `get` | A node's Tapestry JSON, rebuilt first if it's stale | `node` → the JSON | Exists: `GET /api/tapestry-key/:key`. |
| `check` | Rebuild a node's JSON from the graph and compare it with the cached copy (D10's check) | `scope` → the differences | Partial: `GET /api/tapestry-key/derive-status` counts derived and underived nodes per label; nothing compares a cached copy with a fresh build. |
| `rebuild` | Rebuild a node, a concept's elements, or everything | `scope` → how many were rebuilt | Exists: `POST /api/tapestry-key/derive/:key` and `POST /api/tapestry-key/derive-all/:label`. |

Today `POST /api/tapestry-key/:key` writes to the cache directly; D10's guard drops it.

## 8. Lifecycle

Who may call: the owner only.

| Operation | What it does | Takes → returns | Today |
|---|---|---|---|
| `backup` | A full backup of the graph: a Neo4j dump first; later encrypted and chunked into nostr events on a mirror relay (BIBLE §30) | `target?` → the backup's id | New. `bin/backup.js` doesn't back up Neo4j. |
| `restore` | Restore a backup, keeping its tapestryKeys and provenance | `backup` → restored | New. The second brain's `restore-brain` restores only its own export. |
| `seed-firmware` | Install or update the built-in concepts, by the bootstrap path, without undoing local edits | `version?` → installed | Signs: `POST /api/firmware/install`, which can also undo local edits. |
| `migrate` | One-time changes to existing data: missing tapestryKeys, relabeling nodes with no event, adding the uniqueness constraint | `migration` → the result | Partial: `POST /api/tapestry-key/initialize` stamps missing tapestryKeys; `POST /api/normalize/migrate-primary-property-ztags` is one specific migration. |
| `wipe` | Erase the graph, only after a backup | `backup` (required) → erased | Exists: the Database Settings page sends `MATCH (n) DETACH DELETE n` through `POST /api/neo4j/query`, with no backup step. |
| `status` | The last backup, the firmware version, the migrations applied, and how fresh the cache is | → the status | New. |

## 9. Today's routes and where each goes

| Today | Goes to |
|---|---|
| `normalize/skeleton` | rules repair |
| `normalize/json` | cache rebuild (a core node's JSON is computed, D10) |
| `normalize/create-concept` | graph create-concept |
| `normalize/create-element` | graph create-element |
| `normalize/save-schema`, `normalize/generate-property-tree` | graph set-schema |
| `normalize/reconcile-primary-property` | gone: under D10 the primary property's JSON is computed |
| `normalize/create-child-goal`, `update-goal-intent`, `create-resource`, `verify-resource`, `create-work-record`, `note-goal-idea`, `make-proposal`, `approve-proposal`, `skip-proposal`, `record-priority-signal`, `restore-brain`, `record-restore-drill` | the app layer: second-brain operations built on top of graph, import and export (note below) |
| `normalize/adoption-disposition`, `normalize/trusted-dictionary-snapshot` | the app layer: shared concepts |
| `normalize/save-element-json`, `normalize/set-json-tag` | graph update-node |
| `normalize/create-property` | graph add-property |
| `normalize/add-node-as-element`, `normalize/add-to-set` | graph add-to-concept |
| `normalize/migrate-primary-property-ztags` | lifecycle migrate, or gone |
| `normalize/link-concepts` | graph link-set |
| `normalize/enumerate` | graph enumerate |
| `normalize/apply-enumerations` | cache rebuild: the allowed values are computed from the source concept's elements (D10) |
| `normalize/set-slug` | graph update-concept |
| `normalize/create-set`, `normalize/add-subset` | graph create-set |
| `normalize/fork-node` | graph copy-node |
| `normalize/prune-superset-edges` | rules repair |
| `normalize/wire-implicit-elements` | import nostr writes these edges at import; rules repair for older data |
| `normalize/add-relationship`, `normalize/delete-relationship` | graph add-relationship and remove-relationship, link-set and unlink-set, remove-from-concept |
| `GET normalize/relationship-primitives`, `GET normalize/node-primitives` (deployment probes) | gone: lifecycle status and the API's own document (`/docs`) replace them |
| `neo4j/query` (writes) | raw cypher, owner only |
| `neo4j/event-update`, `concept/:handle/pull-community-class-thread`, the `io` import | import nostr |
| the `io` export | export file |
| `firmware/install` | lifecycle seed-firmware |
| `tapestry-key/*` | cache get and rebuild; lifecycle migrate (`initialize`, `offload`); `POST /:key` gone (D10) |
| `concept/:handle/self-declare`, `b-append`, `b-defer` | community references (BIBLE §22, §25): to place in the review |

**The app layer.** Operations that only make sense for one kind of concept — the second brain's goals and proposals, shared concepts, curated lists, tags — sit above the module, as combinations of its operations. The module itself stays generic.

## 10. Questions for the review

1. **Who may read what.** Today the concept-graph reads (`/api/concept-graph/*`) and the read path of `/api/neo4j/query` are open to anyone, and neither skips nodes that were never published. So a private node, such as an event-less set, can be read by any visitor. Should reads of unpublished nodes be limited to the owner and admins?
2. **Who may sign as your assistant.** `export nostr` signs with your assistant's key. Today the signing normalize routes let admins do that, while `/api/strfry/publish` with `signAs: assistant` is owner only (ADR 0005). Which should hold for agents?
3. **Are all admins equal?** Could one agent be read-only, or kept away from deletes?
4. **Raw writes.** Today any admin can send write Cypher. The plan makes raw writes owner only, from the internal CLI.
5. **Deleting an import.** What should deleting a node that came from someone else's event mean, when the next import brings it back: hide it, mute its author, or refuse?
6. **Bulk writes.** Does an agent need to create many elements in one call (a list of 200 dog breeds), or is one call per element fine?
7. **Order.** Do a concept's or a set's elements need an order, as in a ranked list? If so, is it a field or a property of the edge?
8. **Watching for changes.** Should an agent be able to subscribe to changes, rather than ask `history` over and over?
9. **Other people's elements in an export.** When you export a concept or a Tapestry, do other people's elements come along? Your keys can't sign them, so by default the export would carry your own elements and refer to theirs by address.
