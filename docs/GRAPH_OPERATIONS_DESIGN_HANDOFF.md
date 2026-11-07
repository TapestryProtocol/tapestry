# Graph Operations — a Neo4j-First Operations Stack — Design Handoff

**Status:** 🔴 OPEN: scoping in progress. Eleven decisions are settled (§3); the open questions are in §5, in the order planned. The owner's draft core rules for the rulebook are in §7, and the Tapestry Graph Conjecture is in §9. Nothing is built, and no story, ADR or BIBLE text exists yet.
**Created:** 2026-11-07
**Provenance:** Scoped in direct conversation with the owner on 2026-11-07 (his Claude Code session `1a32c5d2` on the Mac Studio; part of it in advisory mode, `/discuss` with the Product Expert lens). This is the **Capture** step of the Protocol-Spec Workflow ([engineering-team/workflows/protocol-spec-workflow.md](../engineering-team/workflows/protocol-spec-workflow.md)): settled decisions and open questions, recorded so nothing lives only in the transcript. Every decision in §3 says where it came from. Every quotation credited to the owner is his own typing, with only typography tidied (the rules in [design-philosophies/README.md](../design-philosophies/README.md)); everything not credited to him is drafting. Check his quotes against the session transcript, not against this file.
**Reviewed by the owner:** not yet.

---

## 0. Where we paused — read this first

- **Settled:** the eleven decisions in §3. D1–D4 fix how the operations are organized; D5–D11 fix the data model underneath them.
- **Next:** the rest of §5's first question: how a concept marks the fields its elements carry on the Neo4j node, and how plain values and nested objects are stored (D11 settled what a node's `tapestryValue` holds). Then provenance, then which rules refuse a write.
- **After that:** write the rules document (§7) and the operation list (§6), ratify them, and open an engineering book for a first slice (§8).
- **How to resume:** continue one question at a time, in advisory mode (`/discuss`). Record each new decision in §3 with its source and date, and move answered questions out of §5.

## 1. Why this exists

The owner's opening request (2026-11-07): "I would like to plan out the development of the neo4j tapestry API that will allow the owner or an admin to perform basic concept graph functions in a way that does not touch nostr, only neo4j."

The question that shaped the design (owner, 2026-11-07): "what exactly is the entire list of commands that we need to support? On the one extreme, endpoints to add/remove nodes and add/remove edges is enough to perform any action we need. But those endpoints do not leverage the concept graph protocol. They have no knowledge of concepts, class threads, JSON Schema validation, etc."

It follows from [BIBLE §30](../BIBLE.md): Neo4j is the definitive self, and a Neo4j write that is never published is a private thought. Today almost every concept-graph write signs a nostr event first (§4), so apart from raw Cypher and five narrow routes there is no way to write to the graph privately.

## 2. The stack and the priorities

**Who uses it** (owner, 2026-11-07): "It assumes an owner who is human and a set of admins, with each admin being a nostr account controlled by one of several agents. (One key held by Claude, one key held by Grok Bot, one key held by local model A on machine A, etc)"

**The layers** (owner, 2026-11-07, his list; the wording of the operations-module and internal-CLI layers was drafted earlier the same day and adopted into it):

> * an agentic harness (one or more skill files) which explain how to use the external CLI
> * an external CLI which signs in to the API with the agent's nostr key, which is an admin on the instance, and calls the routes. It has no Cypher access.
> * The API route, such as /api/foo/create-concept, which checks who is calling (owner or admin) and then calls the operation
> * The operations module, inside the instance, holds each operation's Cypher together with its rules: which edge types are allowed, that it's safe to repeat, and that it never signs an event.
> * The internal CLI is a command-line wrapper over the same module, for someone with a shell inside the container. Anyone who can run it already has a shell there, so it needs no sign-in. That's the same trust today's in-container curl calls get.
> * cypher and neo4j

The API routes and the internal CLI both call the operations module in-process; the API doesn't start the CLI as a separate program for each request (drafting, 2026-11-07; the owner's list adopts the shared module). Precedent: [src/firmware/install.js](../src/firmware/install.js) runs as a command and is also the handler for `POST /api/firmware/install`.

**Priorities** (owner, 2026-11-07): "Our first priority will be to build the stack focused entirely on neo4j. Our second priority will be to build tools to publish to nostr."

**Method** (drafting, 2026-11-07; the owner: "Focusing on the design doc sounds right to me."): design the operations module first, because every other layer maps onto it — one operation becomes one route, one command in each CLI, and one entry in the skill. Start from the protocol's rules, then check the result against today's routes, which serve as a checklist rather than a template: they are organized around events, one route per kind of event to sign, and the new stack is organized around the graph.

## 3. Settled decisions

**D1. Operations are organized by role, not by technology.** (Drafting, from BIBLE §30's roles; owner agreed 2026-11-07: "Organize by role.")
- **Graph:** the self. Reads, and writes that follow the protocol, on concepts, elements, sets, properties, schemas and relationships. Never signs, never mentions nostr. Includes a raw tier (nodes, edges, properties, Cypher) for the owner only.
- **Outside data:** an importer for each kind of source (nostr, markdown, files, web pages, …) and a publisher for each transport (nostr now, perhaps IPFS later). Drafted first as "letters", then widened after D5; the owner didn't object, but hasn't confirmed the widening separately.
- **Cache:** the LMDB's per-node Tapestry JSON (D10) and any other index built from the graph. Its operations are check and rebuild.
- **Rules:** the rule definitions, check and repair (D3).
- **Lifecycle:** backup, restore, firmware seeding.
- **Attributes of each operation, not categories:** read or write; who may call it; which rules it guards; whether it's safe to repeat; its caps; and, for reads, a point of view (the owner's by default).
- The owner's framing: "I am inclined to separate them, at least conceptually. In practice, nostr is integral to Tapestry; but in theory, nostr is only one of multiple ways for peers to communicate with each other. (IPFS being another option.)"

**D2. No category for operations that touch both.** (Drafting; owner agreed 2026-11-07: "No “both” category.") A caller combines a graph operation with an outside-data operation — for example, create, then publish. Publishing is a deliberate act (§30), a "both" category would grow with every transport, and backup already follows the pattern. Dependencies point inward: outside data and cache depend on the graph, and the graph depends on neither. Today's signing routes are all "both", in one fixed order (sign, store, then build the node from the event); the new stack reverses it — the node first, the letter on purpose.

**D3. Each rule is defined once and used two ways.** (Drafting; owner agreed 2026-11-07: "Each rule is defined once and used both as a guard and in check.") As a guard inside each write that could break it, and in check, with repair; each repair is itself a guarded write. The rules go in one document first and become a firmware concept later (owner, 2026-11-07: "More likely: document first, add the concept later."). Some rules refuse a write and others only report (BIBLE §10's "intentional violations"); which is which is open (§5).

**D4. Guards apply to writes by the owner and admins, not to imports.** (Drafting; owner, 2026-11-07: "I think I agree with you: we should guard our own writes, not our peers' writes.") An import is a write the instance makes, but the content belongs to its author. So an import writes the instance's own node pointing at the outside data (D5) and records the claims that data makes — for example, an item claiming to belong to a concept. Check reports violations, and the point of view decides at read time whether a claim counts (CLAUDE.md principles 2 and 3). Guarding imports would silently and permanently drop a peer's item that arrived before its concept, lacks a field the schema requires, or near-duplicates a name. Repair never edits a peer's node; it can add the owner's own nodes or edges alongside.

**D5. A node can be a pointer to data outside Neo4j.** (Owner, 2026-11-07: "One of the basic principles of the concept graph is that not all data lives inside neo4j: in many cases, a neo4j node is simply a pointer to some piece of data that lives outside neo4j. Nostr events, authored by someone else, is no exception.") Each kind of source gets its own importer. Precedent: the second brain's External Resource ([ADR second-brain/0004](../engineering-team/decisions/second-brain/0004-external-resource-pointers-and-one-spine-detail.md)), whose locator kinds are `file`, `vault-note`, `nostr-event`, `repository` and `web-address`.

**D6. Every node's id is its `tapestryKey`.** (Owner, 2026-11-07: "Yes, use tapestryKey".) A random v4 UUID, assigned once and never changed (BIBLE §29), owned by neither nostr nor any key.
- **Requirements:** every operation that creates a node assigns it; a Neo4j uniqueness constraint covers it (which also indexes it); every backup and import path carries it.
- **Today:** the unique id is `uuid`, a nostr address that carries the TA's pubkey even for nodes with no event. [setup/neo4jConstraintsAndIndexes.sh](../setup/neo4jConstraintsAndIndexes.sh) constrains NostrEvent `id` and `uuid`; nothing constrains `tapestryKey`. Only a few write paths set it — the derive engine and its derivers, and `src/api/strfry/tapestryBrainWrite.js`; add-subset and the normalize creates don't, and `POST /api/tapestry-key/initialize` or a firmware install stamps the rest later. [src/api/io.js](../src/api/io.js) export and import don't carry it.
- **Nostr addresses** become information recorded on the nodes that have a letter: an imported node records its source event's address, a published node its letter's address. Imports use them to find a node again instead of making a duplicate.
- **Rejected:** the nostr address (ties identity to nostr and to the TA key, which differs per instance); Neo4j's internal id (reusable after a delete, and doesn't survive export and import); an id built from name and parent (changes on rename or move); a content hash (changes on every edit).

**D7. `NostrEvent` marks the nodes that came in through the nostr importer.** (Owner, 2026-11-07: "If a node does not have an associated nostr event, then no, it should not have the NostrEvent label." and "NostrEvent typically means that the node was generated using the import (from nostr) function".) Anyone may have signed the event: the owner, an admin, a customer, any of their assistants, or anyone at all (owner, 2026-11-07, paraphrased). The label "will say nothing about whether the node has or has not been exported" as a nostr event (owner, 2026-11-07).
- Today's nodes from the signing routes keep the label: those routes sign, store and then import, so their nodes did come in through the importer, with the owner's own letter as their source. Nodes with no event — so far mainly add-subset's sets — lose it.
- 223 lines in 15 files under `src/` match `:NostrEvent`; each needs to say whether it means any node or only nodes that came from an event.

**D8. Publishing someone else's node gives the owner a node of their own.** (Owner, 2026-11-07, paraphrased: his assistant publishes an event of its own, and that event contains a reference to the original. Drafting reads this as two claims, so two nodes, and no node holding two authors' events; that reading isn't separately confirmed.) The protocol already does this for curated lists: curation copies ([protocols/drafts/assistant-designation.md § Curation copies](../protocols/drafts/assistant-designation.md); [curated-dlist-update ADR 0001](../engineering-team/decisions/done/curated-dlist-update/0001-curation-copy-convention.md)) point back with `q` tags holding the original's address and the id of the version copied. fork-node is the older pattern: it copies the tags under a new d-tag with no reference back, and records the link in a separate `PROVIDED_THE_TEMPLATE_FOR` relationship event. Still to settle when export is designed: whether the owner's event copies the content or only refers to it (§5).

**D9. A node's shape comes from its concepts.** (Owner, 2026-11-07: "each node is an element of at least one concept, and each node must validate against the expected format, as defined by that concept (typically as defined by that concept's JSON Schema)" and "which properties go into the neo4j node is likewise going to depend upon the concept to which it belongs.")
- The word-wrapper format ([protocols/drafts/tapestry-concepts.md](../protocols/drafts/tapestry-concepts.md)) already fits: a universal `word` block, plus one section for each type the node belongs to, each validated against its concept's schema. Even core nodes are elements of firmware concepts (`superset`, `json-schema`, …; BIBLE §9).
- Drafting, following from D7, D9 and D10 and not separately confirmed: a node with no event keeps its information as properties and edges, with no tag nodes (today add-subset creates "would-be" tag nodes for `d`, `name`, `z`, `s` and `description`). Creating a node always means creating an element of a concept, in one step that validates the input against the concept's schema, writes the concept's fields and adds the `HAS_ELEMENT` edge. Removing a node from its last concept would refuse.
- How a concept marks the fields its elements carry is open (§5).

**D10. Every fact in a node's JSON is also stored in the graph; the Tapestry JSON lives in LMDB as a cache.** (Owner, 2026-11-07: "I am inclined to say that a local node's Tapestry JSON ought to live in LMDB. The rationale is that the Tapestry JSON in theory should be recoverable in full from the neo4j graph itself, and in some cases may become quite large and bloated, and we don't want to have to worry about bloating neo4j. If we worry about LMDB being too ephemeral, we can at a later date decide to implement a backup procedure." He then adopted the condition below: "Yes, adopt the rule".)
- **Where each part lives:** facts (the concept's fields and the node's links) in the graph, as properties and edges; bulk computed from the graph (element lists, resolved schemas, graph context) only in LMDB; large original content (a long text, an image, a PDF) outside both, as outside data the node points at (D5).
- **Backup:** the LMDB then needs no backup, only a rebuild; the backups that matter are Neo4j's and the outside stores'. This matters because the LMDB sits at `/root/.tapestry`, on no Docker volume, and is lost when the container is recreated (BIBLE §29).
- **Membership:** edges are the authority on which concepts a node belongs to; the JSON's `wordTypes` and `coreMemberOf` are computed from them.
- **Proposed with it (drafting):** a guard — only the derive step writes to LMDB, and §29's offload applies only to imported nodes; and a check that rebuilds a node's JSON from the graph alone and compares it with the cached copy.
- **Today's code doesn't meet the rule yet.** The derive step (`getExistingWordJson` in [src/lib/derivers/word.js](../src/lib/derivers/word.js)) starts from the node's previous LMDB entry, or else its `json` tag, and only then adds what the graph says. So the data part of the JSON comes from the json tag or from the LMDB itself, not from the graph.

**D11. A concept's or an element's `tapestryValue` is its name.** (Owner, 2026-11-07, answering drafting's question "For a concept or an element, should tapestryValue hold its name?": "Yes, its name".)
- For a concept, that's its singular name: today a concept header's `names` tag lists the singular first, and the plural is a separate fact (drafting).
- Sets, properties and core nodes are elements of concepts too (D9), so the rule covers them (drafting). A node that stands for a plain value, such as a breed's origin "Scotland", would hold that value; whether such a node is itself an element of a concept (country, or a firmware concept for plain text) belongs to §5, question 1 (drafting).
- A separate `name` property then duplicates `tapestryValue`. Today's nodes carry `name`; a migration copies it into `tapestryValue`, and whether `name` stays during the change is a migration choice (drafting).
- A slug derived from the name is optional data, since it can be recomputed; a slug set by hand is a fact the reduced graph has to keep (drafting).
- Whether names are unique within a concept stays concept-dependent (§7).

## 4. What exists today (assessed 2026-11-07; numbers rechecked on staging `325b080f9`)

- **`/api/normalize/`** has 38 POST routes and 2 GET probes. 31 write to both stores: they sign an event with the TA key, store it in the instance's relay (`strfry import`), and build the Neo4j node from it. 5 write only to Neo4j: add-relationship and delete-relationship (two class-thread edge types; [ADR relationship-primitives/0001](../engineering-team/decisions/relationship-primitives/0001-strfry-free-relationship-primitives.md)), add-subset ([ADR node-primitives/0001](../engineering-team/decisions/done/node-primitives/0001-event-less-add-subset-primitive.md)), prune-superset-edges and wire-implicit-elements. 2 write to Neo4j and then sign: add-node-as-element and apply-enumerations.
- **Raw Cypher:** `/api/neo4j/query`. Writes need the owner, an admin or a direct-local caller; public reads are plan-checked. It treats any query that names the `Set` label as a write (OPEN row 286).
- **Reads:** `/api/concept-graph/*`, `/api/audit/*` (11 checks), `/api/brain/*`.
- **Who may call:** routes marked OWNER_ACTION admit the owner, admins and direct-local callers (`isOwner` is an alias of `isOwnerOrAdmin` in `src/middleware/auth.js`). BIBLE §11 and `src/api/normalize/relationships.js` describe these routes as owner-gated; the code admits admins too.
- **Where events go:** the instance's relay is public (`/relay`, through the NIP-50 proxy, to strfry). The relay router's `dcosl` preset — off by default, like every preset — sends kinds 9998, 9999, 39998 and 39999 both ways with dcosl.brainstorm.world and dcosl.brainstorm.social.
- **Gaps:** no Neo4j-only create for a concept or element; no edit or rename without re-signing; no route deletes a node; only two edge types allowed; nothing for properties or schemas; no backup for event-less nodes (OPEN row 281); no way to publish a private node later; no provenance marking (§30); a firmware install can undo local edits; several lookups go by name.
- **Agent doors that exist:** A9 on Loom ("An agent's way into a Tapestry instance", in NosFabrica/brainstorm-connector) is a library of five capped operations (orient, search, describe, create, add) with a CLI and an MCP server over it. It runs outside the instance, signs in with an agent key the owner made an admin, and its create and add go through the signing `create-concept` and `create-element`. The owner's older tapestry-cli (nous-clawds4/tapestry-cli, March 2026; BIBLE §12) mirrors the normalize routes and has no sign-in. Per A9's page, Vinney's agent uses a CLI that goes straight into Neo4j (not examined).

## 5. Open questions, in the order planned

1. **What `tapestryValue` holds, and how concepts map onto nodes.** Under the owner's core rules (§7), a fully reduced graph keeps only each node's tapestryKey and tapestryValue and each relationship's type, so every name, description and field value has to be some node's tapestryValue or follow from the edges. D11 settled the first part: a concept's or an element's tapestryValue is its name. Still open: how a concept marks the fields its elements carry on the node as optional properties (drafting suggests a flag in the schema's `x-tapestry` extension, which the code already reads for `unique` and `derived` but no doc describes); and how nested objects and lists of objects are stored, since Neo4j properties hold only plain values and lists of them: flattened names, child nodes, or a small JSON string.
2. **Provenance.** Drafting proposes two records, for nodes and for edges: "came from" (set once, at import: the kind of source, its address and its author) and "sent as" (one per publish: transport, address, signing key, time, and the version of the node it carried). Open: how they're represented (a property, a label or a ledger; §30 leaves it open), and how a change records which admin made it.
3. **Which rules refuse a write and which only report.** Settled rule by rule while writing the rules document (§7).
4. **Export details.** Whether publishing someone else's node copies its content or only refers to it (D8), and how a letter refers to nodes that have no nostr address yet.
5. **The operation list itself** (§6).
6. **Carried over from earlier in the session:** backup first or new functions first; which external CLI (extend A9's, or write a new one in this repo); the route prefixes for the categories (today's `/api/neo4j/` holds `query` and the event routes).

## 6. Sketch of the operation families (drafting, not decided)

The full draft list, with each operation's inputs, results, refusals and today's counterpart, is in [GRAPH_OPERATIONS_CATALOG.md](GRAPH_OPERATIONS_CATALOG.md). The sketch below was its starting point.

- **Graph reads:** orient, search, describe a concept or element, list a concept's elements, show a class-thread path. The first three are A9's.
- **Graph writes:** concepts (create, rename, delete); elements (create as an element of a concept, update, move to another set, remove from a concept); sets (add a subset, link or unlink a subset, delete an empty set); properties and schemas (add a property, regenerate the schema, check an element against it); relationships (add or remove a typed relationship).
- **Raw graph** (owner only, internal CLI): add or remove a node or an edge, set a property, Cypher.
- **Rules:** check (a node, a concept or the whole graph), repair.
- **Outside data:** import (per kind of source), publish (per transport), status (which nodes have letters, and whether they're current).
- **Cache:** check, rebuild.
- **Lifecycle:** backup, restore, firmware seeding.

About 30 operations in all.

## 7. The rules document (to write)

**The rulebook's structure (owner, 2026-11-07; rules he is contemplating, not yet decided).** Three rules that every node and relationship meets:

> - "Each node must have a `tapestryKey` property, and its value must be unique throughout the graph."
> - "Each node must have a `tapestryValue` property, which is a string. It does not need to be unique, and it can be null."
> - "Each relationship must be assigned one (and only one) `type`."

"Every piece of data other than the above is optional. A neo4j graph that has zero optional data is in its "fully reduced" state." In practice the graph is never fully reduced: nodes carry labels and concept-dependent properties, and relationships may carry properties too, though their role "is not fully determined" (owner, 2026-11-07). On choosing optional rules: "The thing to know about optional rules is that they come with tradeoffs. On the one hand, properties are useful when it comes to finding stuff using cypher queries. On the other hand, extra data adds bloat. This tradeoff is one that must ALWAYS be kept in mind when deciding which optional rules to implement and which ones not to implement." And: "It will be useful for us to keep in mind which rules are theoretically optional and which are not. But from a practical perspective, each rule in our rulebook is intended to be implemented, or else we wouldn't put it in our rulebook."

The optional rules he expects to enforce (owner, 2026-11-07):
- **Labels:** "Each node will tend to carry multiple labels, like NostrUser or NostrEvent; however, it will not necessarily carry every label that could be correctly applied to it. This will be determined on a concept by concept basis, whether that concept's label is expected to be applied consistently or not."
- **NostrEvent nodes:** "For NostrEvent nodes, we will probably implement the rule to always include: id, kind, created_at, and uuid. pubkey and content are up for discussion. content can cause bloat, and we will almost certainly want to have flexible guidelines for when to put content into the node property."
- **Uniqueness:** "Whether a property like `name` should be unique within a concept is a rule that will be concept-dependent"
- **The theme:** "LOTS of rules will be concept-dependent, so we will need a method to track concept-specific rules: which properties are expected to be present, which are optional, which are expected to be unique." The rules should be easy to peruse, and "we should add them frugally."

Drafting notes on these (not decided):
- **What Neo4j itself can enforce.** The stack runs Neo4j 5.26 Community. Every relationship already has exactly one type, so the third rule holds by construction. Community has uniqueness constraints, but only for nodes that carry a given label; existence and type constraints are Enterprise-only. So the database can guarantee that tapestryKeys are unique only if every node carries one shared label, which also gives lookups by tapestryKey the index they need. That label carries no information, so it doesn't touch the conjecture (§9): theoretically optional, practically required. That every node has a tapestryKey, and that a tapestryValue is a string, can only be enforced by the guards and the rules check.
- **Null in Neo4j.** Setting a property to null removes it, so the second rule reads in practice as: a node may have a `tapestryValue`, and if it does, it's a string.
- **A method for concept-specific rules.** Each concept's schema already carries part of it: JSON Schema's `required` lists the fields that must be present, the rest are optional, and the code already reads `x-tapestry.unique`. Two more `x-tapestry` settings would cover the rest: a field-level flag for "carried on the node as a Neo4j property" (§5, question 1), and a concept-level setting for whether the concept's label is applied consistently. A concept's rules then live in the concept itself, in the graph, since its schema is computed from its property nodes (D10).
- **`pubkey` on NostrEvent nodes.** Reading by point of view filters on who authored each claim, so without `pubkey` on the node every such read would have to go back to the relay.
- **Each rule's entry** would record: the rule; whether the conjecture needs it or it's optional; whether it's universal or concept-specific; what it buys (queries) and what it costs (bloat); and how it's enforced (the database, a guard, or the check).
- **Relationship properties:** two candidates are already known: provenance (an edge an importer wrote is the source's claim, D4) and order (catalog §10, question 7). Today `REFERENCES` edges carry `source: 'b-tag'` (BIBLE §25).

- **It gathers rules now spread across five places:** BIBLE §10 (a summary table of 11 rules); `docs/NORMALIZATION.md` in the owner's tapestry-cli repo (the full text, outside this repo, last changed in March 2026); the 11 checks under `/api/audit/*`; the UI's Health Audit (BIBLE §9); and guards inside individual routes (create-concept's duplicate check, add-subset's refusals, the relationship whitelist).
- **One entry per rule:** what it says; whether it's a graph rule or a letter rule; whether it refuses a write or only reports; how check finds violations; how repair fixes them.
- **Rules that come from §3:** every node has a unique tapestryKey (D6); every node is an element of at least one concept (D9); every fact in a node's JSON is in the graph, checked by rebuilding and comparing (D10); only the derive step writes to LMDB (D10, drafting); the owner's keys publish only nodes the owner asserts (D8, drafting).
- **Notes:**
  - The rules split along D1's lines: most are graph rules; §10's rule 6 (tags on relationship events) is a letter rule; rules 2 and 7 have a graph half and a letter half.
  - Rules check properties and edges, never tags, so one rule covers every kind of source (follows from D7 and D9). Checks on tags move into the nostr importer, where they report rather than refuse (D4).
  - §10's rule 8 resolves near-duplicates "via IMPORT and SUPERCEDES", but neither edge exists in the server code; fork-node's `PROVIDED_THE_TEMPLATE_FOR` is the link that does.
- **Where it lands:** once ratified, under `protocols/`, next to `protocols/drafts/tapestry-concepts.md`, with BIBLE §10 reduced to a pointer.

## 8. Next steps

1. Settle §5's questions 1–3, one at a time, recording each decision in §3.
2. Write the rules document (§7) and the operation list (§6).
3. Ratify them in docs-mode, as the workflow describes: `/plan-feature` → `/design-architecture` → (no test design) → `/implement-feature` → `/review-changes`.
4. Open the engineering book for a first slice: the fewest operations that let an agent do one real task from start to finish, plus backup.

## 9. The Tapestry Graph Conjecture

Stated by the owner, 2026-11-07: "A conjecture, which we have not proven but which I would like to explore at some point, is that a fully normalized ("normalized" in the sense of the tapestry protocol; this is an important term that is defined in various documents) graph in its fully reduced state, coupled with an installation file of finite (and very small) size, is sufficient to derive the `tapestryJSON` from scratch, for each and every node." The name is his suggestion: "Maybe: the Tapestry Graph Conjecture."

- **Status:** a conjecture, to be explored; nothing here assumes it.
- **Terms:** "fully reduced" is defined in §7 (no data beyond each node's tapestryKey and tapestryValue and each relationship's type); "normalized" in BIBLE §10 and the normalization rules it points to. `tapestryValue` is a new term: it appears nowhere else in this repo. Neither the conjecture nor "fully reduced" appears in this repo or, in these terms, in the owner's articles that could be searched.
- **Related statements:**
  - **The "normalization ⇒ covering" conjecture** (BIBLE §30, "Deliberately open"; [SELF_ONTOLOGY_DESIGN_HANDOFF.md](SELF_ONTOLOGY_DESIGN_HANDOFF.md) §8): that error-free normalization makes a covering achievable, meaning a set of derived documents from which the graph reassembles exactly. That one runs from the documents to the graph; this one runs from the graph to the documents. Together they would say that a normalized graph and its derived JSON hold the same information (drafting).
  - **The asserted core** (SELF_ONTOLOGY_DESIGN_HANDOFF.md §3): Neo4j minus everything that can be recomputed from events. That reduction removes what other sources can rebuild; full reduction removes what the graph itself can rebuild (drafting).
- **The installation file** is presumably the firmware (BIBLE §7), the built-in concepts that lifecycle seed-firmware installs (drafting).
- **How it could be explored** (drafting): reduce a copy of a normalized graph to the data the core rules require, rebuild every node's JSON from that copy plus the installation file, and compare the result with the JSON built from the full graph. D10's cache check makes the same comparison on the full graph.
