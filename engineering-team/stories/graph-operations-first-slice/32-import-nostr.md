# Story 32: `import nostr` — record nostr events as nodes, with the claims they make as relationships

**Status:** Done
**Created:** 2026-11-20
**Type:** Feature
**Loom:** A10.32 — https://loom.brainstorm.world/t/A10.32

## Background

Loom's A10.32 asks for the first operation of the import group (catalog §5):

- **`import nostr`:** "Record nostr events as nodes, with the claims they make as edges", taking "`ids`, `addresses`, a graph's address or `filter`, `relay?`" and answering "the nodes recorded; safe to repeat by the event's address or id". The catalog adds that imports "skip the guards (D4) and record where each node came from", and that "importing a graph, such as someone else's Tapestry, records its graph element and the letters it refers to" (D12).

Done, for Loom, is when "it is declared once; answers at `/api/tapestry/import/nostr` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI."

**Why now.** The owner wants Tapestry firmware published as a Tapestry, a graph of concept graphs (BIBLE §6), so that a new instance installs it by import and the firmware can leave the repo's `firmware/` folder. Every route to that needs this operation, and needs it to work in any order, since firmware is all cross-references. Whose key signs the published firmware, and whether an instance adopts it at its own assistant's addresses or uses the publisher's, are a separate decision the owner is weighing; this story only records letters as they are. The book's frame named "importing other people's nostr events" as outside it unless the race needed them; the owner has asked for it now, and it is numbered here by its Loom task, as the epic's stories are.

The design it follows (docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md):
- **D4.** "Guards apply to writes by the owner and admins, not to imports." An import "writes the instance's own node pointing at the outside data (D5) and records the claims that data makes — for example, an item claiming to belong to a concept. Check reports violations, and the point of view decides at read time whether a claim counts." And: "Repair never edits a peer's node."
- **D5.** A node can be a pointer to data outside Neo4j; each kind of source gets its own importer.
- **D7.** `NostrEvent` "typically means that the node was generated using the import (from nostr) function", whoever signed the event.
- **D12.** "Importing someone else's Tapestry records its graph element and the letters it refers to."
- **BIBLE §30, principle 4.** No import may destroy locally-authored state, and a letter is derivable from the self, not the self.

Twelve facts about today's code and instances shape the story. The importer map is from reading the code on staging `1abd2889` (2026-11-20); nothing was run except the read-only counts marked as such.

1. **Three builders, not two.** `buildImportCypher` (`src/api/neo4j/eventSync.js:198`), and `importEventDirect` twice: `src/api/normalize/index.js:139` and `src/api/normalize/helpers.js:65`, whose copies differ (OPEN.md row 142). Loom's detail and the catalog name two.
2. **Who calls which.** `buildImportCypher`: `POST /api/neo4j/event-update` (owner only; deletes the node's old tag nodes first), the I/O import (`POST /api/io/imports/:tempId/execute`, which runs `strfry import --no-verify`, so its events reach the graph unverified, and deletes no old tags), `pull-community-class-thread` (which publishes each event to the local relay first), `POST /api/normalize/set-b-tag`, and firmware's community references. The `index.js` copy: every signing normalize route, each adding its own labels and edges after it. The `helpers.js` copy: self-declare, b-append and b-defer, the list-header dispositions, the dictionary's concept edit, the publish hook for tapestry elements, and `regenerateJson` (the JSON-schema generator and firmware's Pass 1b).
3. **Nothing imports concept-graph events continuously.** The stream consumer handles kinds 3, 10000 and 1984 only, into person nodes and their follows, mutes and reports (`src/pipeline/stream/redis-consumer.js:117-122`). So catalog §5's "the stream consumer … imports continuously" is wrong for event nodes. OPEN.md row 136 (stage 2) still waits on a general letter ingest.
4. **How `buildImportCypher` keys and keeps.** It keys an event of kind 30000 or more by its address and every other by its id (`:200-202`), so kinds 0, 3 and 10000–19999, which NIP-01 makes replaceable, get a node per version, and 40000 and up are taken as addressable. It compares no `created_at`: an older version overwrites a newer one (`:214-215`). Its tag nodes are keyed by the version's id, so a new version adds a second set of tags unless the caller deleted the first (`:248`).
5. **What `buildImportCypher` records.** Labels `NostrEvent` and `TapestryNode` with a tapestryKey, `ListHeader` for kinds 9998 and 39998, `ListItem` for 9999 and 39999, `Reaction` for 7; the event's uuid, id, pubkey, created_at, kind, `aTag` and a name from its `name`, `names` or `title` tag; the author's person node, which `AUTHORS` it (BIBLE §6 says `AUTHORED`: ledger row `2026-09-27-bible-s6-relationship-name-drift`); a tag node for each tag (`HAS_TAG`); a tag-level `REFERENCES` from each `e` and `a` tag to its target; and from a `b` tag, `INHERITS_FROM` when it is inherit-typed, else `REFERENCES {source: 'b-tag'}` (BIBLE §25). It derives nothing from `p`, `q`, `z`, `s`, `n` or `t`. The two `importEventDirect` copies record no author, no `aTag` and no edge from any tag.
6. **The order bug** (Loom memo #130, run against a throwaway Neo4j). An event that names an addressable event by id (`e`), imported first, leaves a stand-in keyed by that id; the target's own import then fails on every retry, on the `nostrEvent_id` uniqueness rule, and nothing sits at its address. The same Cypher has a second collision: a `b` tag that names an event by id makes a placeholder keyed by address, which `nostrEvent_uuid` refuses the same way (the importer map). And `importEventDirect`'s `DELETE r, t`, which isn't DETACH, fails on a tag node with a `REFERENCES` (the importer map). The callers carry on past each failure.
7. **Claims that become relationships elsewhere.** A `z` tag's membership becomes `HAS_ELEMENT` from the concept's superset only when `wire-implicit-elements` runs (firmware's Pass 3c; `src/api/normalize/index.js:5832`), and `graph list-elements` lists a node that only names its concept in a `z` tag "once it is wired" (`src/operations/catalog/graph/list-elements.js:11`). `s` and `n` tags (BIBLE §23) become `IS_A_SUPERSET_OF` and `HAS_ELEMENT` only in `pull-community-class-thread`, which never makes an edge whose parent is in the local assistant's graph. A relationship letter's `nodeFrom`, `nodeTo` and `relationshipType` become an edge only where the signing route writes it itself (create-set, `index.js:4403-4420`). A graph element's `graph.relationships` become edges only in the I/O import's third phase (`src/api/io.js:593`).
8. **A concept's own wiring travels only inside its graph elements.** On the local instance (read-only count, 2026-11-20 UTC): 49 `IS_THE_JSON_SCHEMA_FOR` relationships, and no relationship letter for any of them; the only relationship letters are 22 `IS_A_SUPERSET_OF`, from create-set. Read from the same instance, the dog concept's concept graph lists its header and superset in `graph.nodes` and imports its property tree graph and core nodes graph in `graph.imports`; the core nodes graph lists all eight core nodes, each with its address, and their seven relationships (`IS_THE_CONCEPT_FOR`, `IS_THE_JSON_SCHEMA_FOR` and the rest); the class thread's sets and elements are listed nowhere, only found by the concept graph's Cypher. So a concept graph imported without its graphs' `relationships` arrives as nodes with nothing between them.
9. **Role labels come from the callers.** `Superset`, `Set`, `Property`, `JSONSchema` and `ConceptHeader` are set by the route that signs, never by a builder; firmware labels a community superset `Superset` by hand. The graph operations take a `ListHeader` as a concept header "for one the nostr import brought in" (`src/operations/resolve.js:24`), and BIBLE §22 tells a foreign header from the local one by `ConceptHeader`.
10. **Another author's claim on the owner's own concept can block the owner's writes.** The property writes refuse to change or take out a property node from another author's letter (`not-own-node`, `src/operations/catalog/graph/_properties.js:83, 748-752`), and every graph write leaves a person node and a placeholder (a `NostrEvent` with no `created_at`) as the import made them (`src/operations/catalog/graph/_nodes.js`). No relationship records its author yet, so a read counts a relationship when the node at its other end counts (catalog, read conventions).
11. **Reading relays.** `readRelayEvents` (`src/api/_shared/relaySource.js:239`) reads one relay to its end of stored events and re-checks each event's signature; `GET /api/relay/external` reads several within 8 s. Nothing pages by `since` and `until`, nothing answers NIP-42 AUTH, and the relay host guard (`src/utils/relayHostGuard.js`) connects only to hosts that resolve to public addresses, for relays named inside events. Memo #129, from 50,000 results on search.brainstorm.world: one REQ answers at most 5,000 events whatever its `limit`; a bulk publisher put 6,717 events into one second, so paging by `until` alone skips the rest, unless that second is swept with `since` equal to `until`; 32 addressable events came back in more than one version; the set's `a`, `e`, `q` and `b` tags named 11,999 events outside it (about 10,850 placeholders on an empty graph); and a tag node per tag would be at least 503,614 nodes beside the 64,995 the preview drew.
12. **Concepts the graph operations made have no letters yet.** A concept made by `graph create-concept` (A10.16) is a private thought until export nostr (A10.34) sends it. So an import from another instance can bring only what has letters there: firmware's concepts, and those made by today's signing routes. Memo #133, on A10.34: export nostr rewrites each `tapestry:` link in a letter before signing it, so when an importer meets such a letter for one of this instance's own nodes, "it records the letter and leaves the node's tags alone. How it tells such a letter apart is this task's to settle."

## User-facing description

As an admin agent, or the owner, I want to bring nostr events into my graph by their ids, by their addresses, by a graph's address with what the graph lists, or by a filter, from my instance's own relay or one I name, so that each event becomes one node with its claims as relationships, the same node and relationships whatever order the events arrive in and however often I repeat it, without my own rules refusing a peer's data.

As the same owner, I want my own nodes to stay as I made them: no letter that comes back in, mine or anyone's, changes them, and no one else's claim stops my own writes.

## Acceptance criteria

- [ ] **AC1 — Import events by id or address.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/import/nostr` with `ids` (event ids, as 64-character hex, `nevent` or `note`), `addresses` (`kind:pubkey:d-tag`, or `naddr`), or both, and `relay` (one `wss://` or `ws://` relay; left out, the instance's own relay), then each event the relay holds whose id and signature verify is recorded as one node (D5): labelled `NostrEvent` (D7) and `TapestryNode` with a tapestryKey (D6), with the labels its kind gives (`ListHeader` for 9998 and 39998, `ListItem` for 9999 and 39999); holding its id, kind, pubkey, created_at and address (the address for an addressable or replaceable event, the id for any other); with its tags, and with the claims AC2 lists. A node one of today's importers made for the same event is that node, never a second one, and keeps its tapestryKey. The answer gives, for each id and address asked for, once: its outcome (`recorded`, `updated`, `unchanged`, `older`, `own`, `not-found`, `invalid`, `unread` when a request to the relay didn't finish, or `failed` when the graph refused its write twice), the event's id and address, and its node's tapestryKey; and the counts of each outcome. Its change entry records who imported and the nodes the import made or changed, and `graph history` finds it by each of them. Nothing is signed, and no guard runs (D4).
- [ ] **AC2 — One graph from one event: its claims.** What an event makes is defined once, and is the same however it arrives (by id, by address, in a graph, by filter) and whichever builder recorded it before:
  - its author: the person node for its pubkey, which `AUTHORS` it;
  - its tags, each a tag node it `HAS_TAG`, as today's readers read them;
  - what its `e` and `a` tags name: the tag `REFERENCES` that event's node;
  - its `b` tags: `INHERITS_FROM` for an inherit-typed one, else `REFERENCES {source: 'b-tag'}` (BIBLE §25);
  - the concept its `z` tags name: `HAS_ELEMENT` from that concept's superset, as `wire-implicit-elements` adds it today (catalog §9);
  - the class thread its `s` and `n` tags claim (BIBLE §23): `IS_A_SUPERSET_OF` from the parent an `s` names, and `HAS_ELEMENT` from the set an `n` names, when the parent's address carries the claimant's own key (the spec's authorship rule: a tag naming a node of someone else's graph derives nothing there);
  - for a relationship letter (`nodeFrom`, `nodeTo`, `relationshipType`): the relationship it names, between those two nodes;
  - for a graph element: each relationship its `graph.relationships` lists, between the nodes its `graph.nodes` names (AC4);
  - each of the last two only between two nodes the claimant signed, named by address, and only of a type firmware declares outside its `nostr` category or one of the editorial three, `IMPORT`, `SUPERCEDES` and `PROVIDED_THE_TEMPLATE_FOR`;
  - the role labels its JSON's word types give it (`Superset`, `Set`, `Property`, `JSONSchema`).

  A claim names its other end by an address or an id. When that end isn't in the graph yet, the claim is made as soon as it arrives, by any import, in either order (AC3). Claims are recorded, never judged (D4; CLAUDE.md, principles 2 and 3): an element of a concept the graph doesn't hold, one that doesn't fit its concept's schema, and one whose name another element has are recorded with their claims; whether a claim counts is decided at read time, from a point of view; `rules check` (A10.31) reports what breaks a rule. A claim that ends at one of the instance's own nodes makes a relationship there only as a membership (`z`, or an `n` whose parent carries the claimant's key) or a reference (`e`, `a`, `b`), and never changes that node (AC6; open question 2, as amended at Architecture).
- [ ] **AC3 — Safe to repeat, in any order, version by version.**
  - Importing events already recorded, at the versions recorded, changes nothing, records no change entry, and answers `unchanged`.
  - An event that names an addressable event by id (`e`), imported before that event, and then the event: one node at the event's address, holding its id and its tags, with the reference pointing at it (memo #130's test). The same with a referrer that carries both the `e` and the matching `a`, with a `b` that names an event by id, and with each claim of AC2 whose other end arrives second. No import fails.
  - A reference to an event the graph doesn't hold makes one placeholder (a `NostrEvent` with no `created_at`), found again by the address when the reference gives one and by the id otherwise. Importing the event fills that placeholder in: one node, never two.
  - For an addressable or replaceable event, one node holds the newest version (NIP-01: the later `created_at`, and on a tie the lower id). Importing an older version than the one recorded changes nothing and answers `older`. A newer one answers `updated`: the claims its tags make replace those of the version before, while relationships a relationship letter or a graph claimed stay, and the node keeps its tapestryKey and what the owner or an admin added to it with the graph operations (a section kept beside the letter, a relationship).
  - Two imports of the same event at once make one node.
- [ ] **AC4 — Import a graph** (D12; open question 3). Given `graph`, the address of a graph element (an element of `39998:<TA>:graph`: a concept graph, a core nodes graph, a property tree graph, a Tapestry), it records the element, each letter its `graph.nodes` lists, and each graph its `graph.imports` lists, in the same way, each letter once, to a bounded depth; and each relationship each of those graphs lists, between the nodes it names (AC2). The answer gives each graph it followed, each letter's outcome as AC1 does, and the ones it couldn't find or verify. So one concept's concept graph from another instance arrives with its header, its superset and the graphs it imports, with their core nodes and their wiring, at the publisher's addresses and as the publisher's letters.
- [ ] **AC5 — Import by filter.** Given `filter` (a NIP-01 filter: `ids`, `authors`, `kinds`, `#<letter>` tags, `since`, `until`, `limit`, and `search` passed to the relay as given; an object, or its JSON text), it records every event the relay holds that matches, up to the call's cap. It pages past the most one request answers, by `until`, and through any second that holds more events than one page, so that none is skipped (memo #129); it keeps the newest version of each address; and it answers how many events it recorded, with their outcomes, and, when more match than its cap, the `until` to give next. A call given that `until` goes on where the last stopped, and a repeat over the same window changes nothing.
- [ ] **AC6 — The instance's own nodes stay as the owner made them** (memo #133; BIBLE §30; open questions 1 and 2). The import never changes a node that is the instance's own: by its assistant or its owner, or made here with no letter (`_nodes.js`'s test of whose node it is). A letter at one of their addresses, whoever signed it, is reported as that node's letter (`own`), and nothing in the graph changes, so export nostr's letters never come back in over the nodes they were sent for. And after an import of another author's letters that claim a place in, or a relationship to, one of the instance's own concepts (an element, a set under its superset, a second JSON schema, a property), the owner's graph writes on that concept answer as they did before, and graph reads from the owner's point of view count each claim only when its author counts (ADR 0011).
- [ ] **AC7 — What it refuses, and how it reaches agents.** It refuses, changes nothing, records no entry, and says in words what was wrong, naming the input:
  - no source given, or more than one of `ids`/`addresses` (together allowed), `graph` and `filter`; an id, address, `nevent`, `naddr` or filter that can't be read; more ids and addresses than one call takes;
  - a `relay` that isn't `ws://` or `wss://`, or whose host doesn't resolve to public addresses only (the relay host guard, for every caller);
  - a relay that can't be reached or doesn't answer in time, which it says apart from a relay that holds none of what was asked.

  An event it can't record isn't a refusal: it is reported, as `not-found` (the relay holds none), `invalid` (its id or signature doesn't verify, or it isn't an event), `older` or `unchanged`, beside the others. It is for the owner and admins: a caller who isn't signed in is refused with 401, and a signed-in person who is neither with 403. It is listed for agents and has its `/docs` entry, both made from its declaration, and someone with a shell inside the instance runs `tapestry import nostr` with the same inputs, no sign-in, and the route's answers, its entries naming the command as who made them. The catalog's import row, BIBLE §6 and §11 say what it does, and the catalog stops saying the stream consumer imports continuously. On a scratch stack, an admin agent with its own key, through the external CLI (A10.6) and with no change to it: imports one concept's concept graph from another instance's relay by the graph's address, and finds its nodes recorded at that instance's addresses and wired as its graphs list; repeats the call and is told nothing changed; imports a referrer by id before its addressable target, then the target, and finds one node for each, the reference pointing at the target; imports a filter in two calls, the second going on where the first stopped; and is refused a relay on a private address.

Seven criteria, for one operation with four ways in. Every way in shares AC1–AC3's one record of an event, and AC4 and AC5 only decide which events, so the story stays one reviewable change.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`); it differs on every instance, so it is never written into code.

- `39998:<TA>:graph` — graph (read): `graph.nodes`, `graph.relationships` and `graph.imports` of the element AC4 follows, and of the subtypes below.
- `39998:<TA>:concept-graph`, `39998:<TA>:core-nodes-graph`, `39998:<TA>:property-tree-graph`, `39998:<TA>:tapestry` — the graphs a graph import starts from (read).
- `39998:<TA>:relationship` — relationship (read): a relationship letter's claim (AC2).
- Any concept, through the `z`, `s` and `n` claims an imported letter makes on it (written: `HAS_ELEMENT` and `IS_A_SUPERSET_OF` from its superset or a set, subject to AC6 and open question 2).
- The instance's own concepts and nodes (read, never written: AC6).
- No firmware concept's definition changes.

## Out of scope

- **Whose key signs published firmware, and how an instance adopts it:** at its own assistant's addresses with `graph copy-node` (A10.24), or at the publisher's. The owner is weighing it. Firmware installed by import (`lifecycle seed-firmware`, A10.37, which reads the repo's files as written) is that decision's.
- **Export nostr, retract and status** (A10.34), and the "sent as" record export writes. Memo #133's own letters are handled here by AC6 without telling them apart (open question 1).
- **Deleting what was imported** (catalog §10, question 5), and what a deletion event (kind 5, NIP-09) does to a node: a kind 5 is recorded as an event like any other, and nothing is taken out.
- **A live subscription, and moving today's importers onto this one:** `event-update`, the I/O import, `pull-community-class-thread`, `set-b-tag`, firmware's community references and the signing routes' `importEventDirect` keep working as they do (D15), unless Architecture finds a fix for them cheap (below). No pipeline calls import nostr yet.
- **NIP-42 AUTH,** and a relay's own extensions, such as search.brainstorm.world's `observer:` (memo #129), beyond passing a filter's `search` as given. A relay hint inside an `naddr` or `nevent` isn't followed: `relay` names where to read.
- **Following a concept graph's class thread** to its sets and elements, which no graph lists (fact 8; open question 3): a filter on `#z` or `#s` imports them.
- **Provenance beyond what this records** (BIBLE §30's taxonomy; design §5, question 2): the representation of "came from" is settled here only as far as this operation needs it.
- **Fewer tag nodes.** One tag node per tag stays, since today's readers read them (D15); memo #129's counts are for Architecture to size against.
- **`published_at` and other dates inside an event:** only `created_at` decides versions.
- **Any change to today's UI.**
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

Resolved at this gate. Each carried the drafting's proposal, for the owner to confirm or change; the owner approved the story as drafted, with all three (2026-11-20).

1. **How does the import tell a letter export nostr sent for one of the instance's own nodes apart?** *Resolved: it doesn't need to* (the drafting's proposal, approved by the owner, 2026-11-20). The import never changes a node that is the instance's own (AC6), whoever signed the letter at its address: it records the letter as that node's and leaves the node as it was. The self is the graph, and a letter is derivable from it, not it (BIBLE §30), so a letter of the instance's own that comes back in, rewritten or stale, never overwrites the node. The other choices: (a) export nostr records each letter's id on its node as "sent as", and the import leaves alone only those letters, applying any other at an own node's address; or (b) a mark in the letter itself, which is a wire-format change for `protocols/`. The cost of the proposal: a letter of the instance's own that today's signing routes signed and stored but failed to import (memo #130's failure) isn't applied by import nostr; those routes keep their own import (D15).
2. **Does another author's claim that ends at one of the instance's own nodes become a relationship there?** *Resolved: a membership claim does, nothing else* (the drafting's proposal, approved by the owner, 2026-11-20). A peer's letter claiming to be an element of the owner's concept or of one of its sets (`z`, `n`) gets the `HAS_ELEMENT` today's wiring would give it, which reads count only when its author counts (D4's own example: "an item claiming to belong to a concept"). Any other claim that would hang something on the owner's node, such as a set under the owner's superset (`s`), a relationship letter, or a graph's relationships naming the owner's schema or properties, is kept as the tag that makes it and makes no relationship on the owner's node, as `pull-community-class-thread` already never makes one into the local assistant's graph (fact 7). Fact 10 is why: such a relationship would be another author's claim inside the owner's own concept, which the property writes refuse to change, so a peer could stop the owner's writes. The other choice: every claim becomes its relationship, and every graph write learns to judge only the owner's own, which is a change to the writes, not to the import.
3. **How far does a graph import go?** *Resolved: the element, the letters its `graph.nodes` lists, the graphs its `graph.imports` lists, each the same way, and each graph's `graph.relationships`, to a bounded depth; not the class thread* (the drafting's proposal, approved by the owner, 2026-11-20). That is "the letters it refers to" (D12), and it brings a concept's eight core nodes and their wiring (fact 8). A concept's sets and elements are listed by no graph, so a filter on `#z` or `#s` brings them. The other choice: a concept graph's import also follows the concept's class thread (`s`, `n` and `z` claims on its superset), as `pull-community-class-thread` does for one curator. Either way, a firmware Tapestry would have to list, or lead to, everything a new instance needs; that is the firmware decision's.
Settled by CLAUDE.md's principles and the design, and approved with the story (2026-11-20):

- Every signed event that verifies is recorded, whoever its author (principle 2): no point of view at write time, and no guard (D4).
- The relay host guard applies to every relay named in `relay`, the owner's too (AC7): the callers are mostly agents, and an outside relay is read from inside the instance, so a private address could reach what only the server can. The instance's own relay, the default, needs no guard. The other choice, not taken: the owner, as with Relay Settings, may name a relay on a private network, such as another instance on the same machine.
- Every event's id and signature are checked by the import itself, wherever it was read, since the I/O import puts unverified events into the local relay (fact 2).
- `relay` left out reads the instance's own relay, where its signing routes, its router and its pulls leave letters.
- Nothing is signed. Whether a letter read from an outside relay is also kept in the instance's own relay is for Architecture (below): either way nothing is sent to any other relay.
- Any kind is recorded; the caps bound the cost.

**Changed at Architecture** (the owner's approval of ADR 0032, Option A, with its six proposed amendments, 2026-11-20; for the first he chose the protocol's rule over this gate's answer, "Follow the protocol"):

- AC2 and open question 2: `n` and `s` make a relationship only when the parent's address carries the claimant's own key, as `protocols/drafts/class-thread-relationships.md` makes binding, so another author's `n` naming the owner's set makes nothing; only `z` membership comes from anyone. A relationship letter's or a graph's relationships are made only between nodes their author signed, of the types firmware declares outside its `nostr` category and the three editorial ones.
- AC2 and AC6: a reference (`e`, `a`, `b`) from another author's letter to one of the instance's own nodes is made. "Membership only" reads as no structure on the owner's nodes.
- AC2: its last sentence went. The nodes today's `importEventDirect` copies wrote are the signing routes', under the instance's own keys, which AC6 leaves alone.
- AC3: a newer version's tag claims replace the older's; relationships a relationship letter or a graph claimed stay.
- AC1: two more outcomes, `unread` and `failed`.
- AC6: an own letter is reported (`own`), and nothing about it is kept on the node; a "sent as" record is export nostr's (A10.34).

**Changed at Test Design** (the owner's answer, 2026-11-20, "Only on evidence"; ADR 0032 Decision 5 as amended):

- AC5: a second is listed as crowded only when the call has evidence that the relay stopped short, so a filter matching one event, or letters published in one second, raises no false alarm. "None is skipped" then holds for a relay that answers the 500 a request asks for, as strfry and search.brainstorm.world do, and for any other relay once the call sees it stop short. A relay that quietly answers fewer than 500, for a filter whose every match is in one second, can leave the rest of that second unreported.

For Architecture, not this gate (answered by ADR 0032):

- **One builder.** A new one, or `buildImportCypher` fixed; whether its callers (fact 2) move onto it under D15's caveat, which would end memo #130's failure for them too; and a ledger row for the `importEventDirect` copies' missing claims.
- **How a claim waits for its other end** (AC2, AC3): placeholders by address or id, or a claim kept and made on arrival, for every claim, not only `e` to an addressable event.
- **What a newer version takes out** (AC3): the relationships the older version's claims made, told apart from those the graph operations made, since no relationship records its author yet.
- **Keys.** NIP-01's replaceable kinds (0, 3, 10000–19999) at `kind:pubkey:`, against today's node per version, and 40000 and up; the tag nodes' keys across the three builders; and whether a node records its source relay ("came from", design §5, question 2).
- **Whether a letter read from an outside relay is kept in the instance's own relay too:** the box then holds the signed letter its node was made from, as the I/O import and `pull-community-class-thread` keep theirs, and a `strfry import` of kinds 3, 10000 and 1984 also reaches the stream consumer (fact 3); or the node only points at where it was read.
- **Caps and time:** how many events a call reads and records, how many ids and addresses it takes, how deep a graph import goes, and whether a large import is several calls or a job, as lifecycle's backup is (`src/operations/catalog/lifecycle/_jobs.js`); the answer's size; and the cost of a tag node per tag at memo #129's scale.
- **Whether it goes through the write path** (ADR graph-operations-foundation/0004), with a change entry for an import of many nodes, and a `repeatKey`, when what makes it safe to repeat is each event's address or id.
- **Locks:** two imports of one event at once, and an import beside a graph write on the same node.
- **Reading:** one relay at a time, timeouts, the per-request cap and a crowded second, and many ids in one request.
- **Role labels** from word types (AC2), and a foreign header as `ListHeader` beside BIBLE §22's `ConceptHeader`.

## Deviations

Judgment calls made in Implementation (2026-11-20), each too small for an ADR amendment:

- **The event's node is made with `CREATE`, not `MERGE`** (Decision 7.5), once the same transaction found no node at its key or with its id. Two imports of one event still make one node: the second's `CREATE` fails `nostrEvent_uuid` once the first commits, and Decision 7.9's second run then finds the node and answers `unchanged`. A `MERGE` there would match the first's node after the second had already read the graph as empty, and write it as a new event over a version it never compared.
- **An address placeholder is a `CREATE` too**, made only when the transaction's lookup by `NostrEvent|TapestryNode` found no node at the address (Decision 8's "only when no node holds it"). A `MERGE (p:NostrEvent {uuid: …})` would need the adoption `tapestry-key-paths.test.js` G9 asks of every such `MERGE`, which can't apply when nothing is there; one another import made meanwhile fails the uniqueness rule, and the event runs again. A placeholder by id stays a `MERGE` on `id`.
- **Four lines name `NostrEvent` alone,** each "about the event": the lookup by id, the event's `CREATE`, and the two placeholders. Each is listed, with why, in `test/operations/lifecycle/nostr-event-lookups-kept.json`, the registry G11 and G18 read, as earlier implementations added theirs; no test changed. Every lookup by address names `NostrEvent|TapestryNode`.
- **The `z` wiring leaves out the instance's own nodes** (`WHERE m.pubkey IS NOT NULL AND NOT m.pubkey IN $own`). Decision 8's wiring reaches "every node whose z tag names the header"; AC6 and Decision 7.2 leave an own node as the owner made it, and IW6 counts no new `HAS_ELEMENT` into one, so an import's `IS_THE_CONCEPT_FOR` doesn't hang one of the instance's own nodes under a foreign concept. An own letter recorded with no node there (IW5) still makes its own `z` claim.
- **A graph's `graphs` entry can also be `invalid`** (its letter doesn't verify) **or `unread`** (its request didn't finish; it is named under `next.graphs` too), beside Decision 6's `followed`, `not-found` and `unreadable`.
- **`ref` for a graph's letters** is the address or id the graph listed (the graph's own for its element), since that is what the call asked the relay for; a filter's events have `ref: null` (Decision 11 gives `ref` for ids and addresses).
- **A graph letter read first as another graph's node, then followed,** is recorded again when followed, so its `graph.relationships` resolve through every graph followed by then (Decision 6, step 2); its one entry takes the later outcome when the first was `unchanged`. No suite meets this order.
- **The 40 s budget covers ids and addresses too:** a request not sent in time leaves its refs `unread`.
- **A filter's pages and sweeps each ask `limit: 500`;** the filter's own `limit` is the call's cap (the plan leaves this unpinned). An event with no whole-number `created_at` is answered `invalid` at once, since it has no second to page by.
- **A newer replaceable version blocked by today's per-version node.** When a node today's builder keyed by the newer version's id holds it, and an older version holds the address, recording the newer one breaks `nostrEvent_id` and answers `failed` after the second run. Decision 7.4 leaves such a node where it is; the ledger row below lists it.
- **The ledger row** for today's builders' faults (ADR 0032, Consequences) is `2026-11-20-todays-importers-keep-their-faults`, typed `bug`; catalog §5 cites it.

Judgment calls made in review round 1's fixes (2026-11-20), each too small for an amendment:

- **The dropped connection (blocking 1) is closed two ways.** `request()` sends nothing on a connection nostr-tools no longer holds open (`relay.connected === false`), so the rest of the call's requests answer `unread` at once. And `connect` replaces the relay instance's `send` with one whose rejection is caught and ends that relay's open requests (`closeAllSubscriptions`), so the rejection that `Subscription.fire()` and `close()` leave unawaited can't reach the process. In nostr-tools 2.10.4 the check and `send`'s own check of `connectionPromise` run in the same synchronous turn, and the two are set and cleared together, so the guard covers what that relies on: another version's timing, or any other path to an unawaited `send`. A process-wide `unhandledRejection` handler was not used: it would also swallow every other module's failures in the control panel.
- **A request keeps at most its filter's `limit`:** pages and sweeps, which ask 500. A request for ids or addresses carries no `limit` (Decision 2's shapes) and keeps what the relay sends before its end, as before.
- **A graph cut short by the time** answers its nodes not recorded `unread` and is also named under `next.graphs`, so a later call can finish it; such a graph is both `followed` and named under `next`.
- **The rules' precondition in BIBLE §6** names all five, and says that Install Firmware waits for the first four, while `tapestry_key` comes from `lifecycle migrate --migration tapestry-keys`: `expectedNeo4jSchema.js` lists only the four, and `tapestry-key-paths.test.js` G12 pins that install doesn't wait for `tapestry_key`. ADR 0032's Decision 13 note says the same since `31899132`.

## Evidence

### The suites (Implementation, 2026-11-20, on `3af64502` with the implementation uncommitted)

Each ran alone on this Mac with every service endpoint dead, `TAPESTRY_CONTAINER_PORT` unset, `TAPESTRY_CONTAINER=no-such-container`, and stub `curl` and `docker` first on `PATH` (`tmp/a10-32/env.sh`). None failed:
- **This story's,** with each one's time: `nostr` 14 passed (1.1 s), `nostr-record` 15 (1.1 s), `nostr-order` 11 (5.0 s), `nostr-own` 7 (2.0 s), `nostr-graph` 10 (0.8 s), `nostr-filter` 8 (1.3 s), `nostr-relay` 7 (23.8 s: two of its cases wait out Decision 2's 10 s), `nostr-agent-through-cli` 1 (1.5 s), `nostr-live` 0 passed and 6 skipped (its live checks: the variable names no scratch container), and `cypher-engine` 11 (0.1 s). About 37 s in all, which CI's stack-free job gains in its `operations` entry.
- **`tapestry-key-paths`** 20 passed (0.7 s), with this story's four lines that name `NostrEvent` alone listed in `nostr-event-lookups-kept.json` (Deviations).
- **The scoped gate,** CI's five entries for an operations change through `test/helpers/gateRunner.js` (`tmp/a10-32/gate.sh`): record `20261120T140500Z-7070-17fd`, PASS, 1,351 passed, 0 failed, 12 skipped (live tests among them, `nostr-live`'s six), the `operations` entry in 240 s. An earlier run, `20261120T135720Z-98640-7208`, failed one test of 1,363: external-cli's SK3, since the skill's new line showed `tapestry import nostr`, which the CLI's tables don't hold as a command of their own. The line now names the operation as `import nostr`. The code changed after that run too: the recorder reads a node's integers as numbers (Neo4j hands them back as the driver's `Integer`), and a placeholder's merge counts rows.
- **harness-lint:** clean.

### Review round 1's fixes (2026-11-20, on `e90d94e1` with the fixes uncommitted)

Each suite alone, as above (`tmp/a10-32/env.sh`):
- **This story's,** with each one's time: `nostr` 15 passed (1.4 s), `nostr-record` 15 (1.1 s), `nostr-order` 11 (5.0 s), `nostr-own` 7 (2.0 s), `nostr-graph` 12 (2.0 s), `nostr-filter` 10 (2.8 s), `nostr-relay` 8 passed and 1 failed (9.7 s, IL5 and IL6 now waiting the 1.5 s their `REQUEST_MS` sets), `nostr-agent-through-cli` 1 (1.5 s), `nostr-live` 6 skipped, `cypher-engine` 12 (0.4 s). Of round 1's seven tests, IL8, IN15, IF9, IF10, IG11 and IG12 pass.
- **IL9 fails on the test's side, and is back with the Tester.** Its first two assertions pass (read on the retry, two handshakes) and so does its time (the connect gives up at the 300 ms set in `reader.CONNECT_MS`). Its third asks the suite's live server to log the timed-out handshake's socket closed, which that server can't see:
  - it holds the `upgrade` socket without reading it, and Node then never reads a client's FIN;
  - a client RST would be seen, but it kills the server's process (`UNCAUGHT ECONNRESET`), since that socket has no `error` listener.
  
  Against a raw TCP server that reads its sockets, `_relay.js`'s `open()` ends each timed-out handshake's socket with a FIN at about 320 ms, and the retry's at about 630 ms, with Node's WebSocket and with `ws` alike. The probes are in the worktree's `tmp/a10-32/il9-probes/`, with a README.
- **`tapestry-key-paths`** 20 passed (0.8 s).
- **The scoped gate** (`tmp/a10-32/gate.sh`): record `20261120T154152Z-96903-3644`, FAIL, 1,358 passed, 1 failed (IL9), 12 skipped, the `operations` entry in 229 s.
- **harness-lint:** clean.

### IL9's server fixed (2026-11-20, on `88e321bf`)

- **The change:** the Tester's `88e321bf` makes the suite's live relay server read the handshake socket it holds, and log the client's close of it. An RST no longer crashes that server.
- **IL9:** it now passes, and it fails against `e90d94e1`'s `_relay.js`, which shows it catches the stray socket.
- **Each suite alone:**
  - `nostr` 15 passed (1.6 s), `nostr-record` 15 (1.3 s), `nostr-order` 11 (5.7 s), `nostr-own` 7 (2.3 s), `nostr-graph` 12 (2.3 s), `nostr-filter` 10 (2.9 s), `nostr-relay` 9 (10.3 s), `nostr-agent-through-cli` 1 (1.7 s), `nostr-live` 6 skipped, `cypher-engine` 12 (0.5 s).
  - That's 92 passed, in about 29 s, against round 0's 37 s.
- **Also:** `tapestry-key-paths` 20 passed, and harness-lint is clean.

### After the staging merge (2026-11-20, on `f2ab1fec`)

`origin/staging` (`07d4df28`) was merged into the branch with no conflicts. That merge brought in #162 as merged and the property-has-one-parent work. The scoped gate on the merged tree, with no uncommitted changes: record `20261120T161244Z-52625-01ed`, PASS, 1,407 passed, 0 failed, 12 skipped, 5/5 suites, the `operations` entry 1,306/0/10 in 252 s.

### The live check (Implementation, 2026-11-20, on `6525d2d2`)

**Where it ran:**
- On throwaway instances from `scripts/scratch-stack.sh`, booted from image `agent-memory-tapestry:latest` with this worktree's `src/` mounted. Never on a shared or private instance: every call went to a container named `tapestry-scratch`.
- The scripts, each call's answer and the logs are in the main checkout's `tmp/live-check-32/`; `hand-calls.md` holds the calls made by hand, with their output.

**How each was set up:**
- The branch's firmware (`36600339b3b2`, 332 files) was copied over the image's (`c4c302955e90`, 319 files, none the branch lacks) and installed.
- The branch's `bin/tapestry.js` and `clients/cli` were copied in.
- The owner, the admin agent, a stranger and a publisher were throwaway keys (`keys.json`, mode 600).
- The three new files' digests matched inside the container and out.

**Afterwards,** `docker ps -a` listed the same containers as before the first boot, with `tapestry` up 4 days.

**What it found:**
- **Run 1: a scratch stack has none of the uniqueness rules the import relies on** (ADR 0032, Context 3).
  - Booted 14:11:52–14:13:23 UTC, its Neo4j held one constraint, `tags_address`, which the control panel creates at boot.
  - `nostrEvent_id`, `nostrEvent_uuid`, `nostrEventTag_uuid`, `nostrUser_pubkey` and `tapestry_key` were missing. Neither the Dashboard's fix (`POST /api/neo4j-setup-constraints-and-indexes`, which runs `setup/neo4jConstraintsAndIndexes.sh`) nor `lifecycle migrate --migration tapestry-keys` ever ran there. The scratch boot installs firmware through the API, past the Dashboard's wait for those rules.
  - LV1, LV2, LV4, LV5 and LV6 passed. LV3 failed: two imports of one new event at once both answered 200 (`recorded`, `unchanged`) and left two nodes with the same address and id. No other address or id was held twice (`run1-lv3-evidence.txt`).
  - Ledger row `2026-11-20-scratch-stack-lacks-uniqueness-rules`.
- **Run 2, with the rules a set-up instance has, passed all six live tests** (`live-suite.log`).
  - Booted again at 14:20:06. The Dashboard's fix and `tapestry-keys` ran before the branch's firmware install; `setup.log` lists the nine rules then present.
  - LV1: memo #130's referrer by `e` before its target gave one node.
  - LV2: the `e`-plus-`a` referrer gave one node with both references.
  - LV3: two imports at once gave one node.
  - LV4: a two-call filter.
  - LV5: a private relay refused for the direct-local caller.
  - LV6: 300 letters with three tags each recorded in 2.25 s (133 a second), `next` null.
- **The race, ten more times** (`race.log`, `race.json`). Two imports of one new letter were fired from one node process in the container, the second 0 to 400 ms after the first. Every run left one node, with one `recorded` answer (one change entry) and one `unchanged` (none).
  - The first import finished in 11–38 ms, so only the two runs at 0 ms overlapped. The other eight, at 25 ms and up, were repeats rather than races (review round 1, non-blocking 8).
  - So three overlapping trials passed with the rules (runs 0 and 1, and LV3). Run 1's two nodes show that LV3's pair does overlap.
- **LH1, the agent's sequence through the external CLI** (`hand-calls.md`, calls 01–10). The agent was the admin with its own key, going through the container's nginx, with no change to the CLI. It:
  - signed in (`role: admin`);
  - ran `import nostr --graph 39999:<david.tapestry.ninja's assistant>:dog-concept-graph --relay wss://david.tapestry.ninja/relay`. That recorded 8 letters at that instance's addresses in 1.6 s, with 8 change entries: the graph element, the header, the superset, the property tree graph, the core nodes graph, the JSON schema, the primary property and the properties set. All three graphs were followed (depths 0, 1, 1);
  - found it wired as the graphs list (`graph list-relationships`, `pov everyone`): the header's `IS_THE_CONCEPT_FOR` to the superset, the six core-wiring relationships into the header, and the primary property's `IS_A_PROPERTY_OF` to the JSON schema, each node authored by that instance's person node;
  - ran the same call again: all 8 `unchanged`, no change entry;
  - imported a referrer by id (its `e` naming an addressable target not yet held), then the target by address, both from the scratch relay. Each was `recorded`. One node stands at the target's address holding its id, and the referrer's `e` tag node (`<referrer id>_0`) `REFERENCES` it;
  - imported a filter in two calls from david.tapestry.ninja's relay, `limit` 5: 5 recorded with `next.until` 1794813851, then 6 more from there (it finished its last second), none twice;
  - was refused `--relay ws://10.0.0.1` with `private-relay`, nothing changed.
- **LH2, a call through nginx at the caps.**
  - The agent's filter for every kind-39999 letter of david.tapestry.ninja's assistant read 552 letters in 37.4 s, inside nginx's 60 s: 534 recorded, 18 unchanged, nothing crowded, `next` null.
  - A page of 500 of those letters (1.1 MB, 6.1 tags each) took 0.9 s from this Mac, so nearly all the time was recording: about 15 real letters a second, against LV6's 133.
  - That is below the 25 a second that Decision 12's 1,000 letters in 40 s would need. For letters like these, the 40 s budget ends a call before the 1,000 cap, with `next.until`, so no cap needed lowering.
- **LH3:** after the run, the scratch relay held no letter by david.tapestry.ninja's assistant and none of the stream consumer's kinds, and strfry-router was stopped (`lh3.log`). The 12 letters the throwaway publisher sent there on purpose were counted, which shows the count works.
- **Plans (`EXPLAIN`, kept in `explain.txt`):**
  - The lookup at an address seeks both `NostrEvent(uuid)`'s unique index and `TapestryNode(uuid)`'s.
  - The `z` wiring scans every `NostrEventTag` (7,685 on the scratch), since tag values have no index; `wire-implicit-elements` has the same match.
  - Ledger row `2026-11-20-z-wiring-scans-every-tag-node`.
- **The control panel's error log** held only two lines, both from the boot before Neo4j listened (`brainstorm-error.log`).

### The live check again, on the fixed code (2026-11-20, on `88e321bf`)

**Where it ran:** a fresh scratch stack, booted 15:52:39 UTC, with the rules applied before the branch's firmware, as on run 2. The new `nostr.js` and `_relay.js` matched inside the container and out. Its records are in the main checkout's `tmp/live-check-32/rerun/` and `hand-calls.md`.

**What it showed:**
- **The live suite:** LV1–LV6 all passed (`rerun/live-suite.log`). LV6 recorded 300 letters in 1.9 s, 157 a second.
- **The agent's calls through the external CLI:**
  - dog's concept graph from david.tapestry.ninja's relay: 8 recorded in 1.7 s;
  - the same call again: 8 `unchanged`;
  - `--relay ws://10.0.0.1`: refused, `private-relay`;
  - the filter for every kind-39999 letter of that instance's assistant: 552 letters (545 recorded, 7 unchanged) in 37.4 s, `next` null.
- **Review round 1's blocking case, live** (`rerun/drop.js`, `drop.json`, `drop-continue.json`):
  - 600 letters by the throwaway publisher were published to the scratch relay.
  - One node process in the container imported them by filter from the instance's own relay and restarted strfry 1.5 s in. `supervisorctl` finished the restart at 2.6 s.
  - The import answered 200 at the drop, with 499 recorded and `next.until`.
  - The control panel kept its pid (4349 before and after).
  - Going on from `next.until` recorded the other 101, with `next` null. All 600 are in the graph.
- **Afterwards,** `docker ps -a` listed the same containers as before the first boot.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D4, D5, D7, D12, D15); catalog §5, Import, and §9
- Loom memos on A10.32: #129 (50,000 results as a graph) and #130 (the import-order problem confirmed); on A10.34: #133 (own letters)
- Ledger rows: [2026-09-27-bible-s6-relationship-name-drift](../../../ledger/2026-09-27-bible-s6-relationship-name-drift.md); [2026-11-20-todays-importers-keep-their-faults](../../../ledger/2026-11-20-todays-importers-keep-their-faults.md) (written in Implementation); from the live check, [2026-11-20-scratch-stack-lacks-uniqueness-rules](../../../ledger/2026-11-20-scratch-stack-lacks-uniqueness-rules.md), [2026-11-20-z-wiring-scans-every-tag-node](../../../ledger/2026-11-20-z-wiring-scans-every-tag-node.md) and [2026-11-20-ci-gate-outgrows-its-timeout](../../../ledger/2026-11-20-ci-gate-outgrows-its-timeout.md) (filed by A10.31.a's session; this story's own row for it was dropped as a duplicate); from the review, [2026-11-20-strangers-tag-nodes-count-as-own](../../../ledger/2026-11-20-strangers-tag-nodes-count-as-own.md) and [2026-11-20-crowded-second-can-overrun-the-budget](../../../ledger/2026-11-20-crowded-second-can-overrun-the-budget.md); OPEN.md rows 136 and 142
- The test of whose node it is: [26-delete-node.md](./26-delete-node.md), [21-update-node.md](./21-update-node.md); the point of view: [ADR 0011](../../decisions/graph-operations-first-slice/0011-list-elements-and-the-read-conventions.md)
- The write path: [stories/graph-operations-foundation/4-the-write-path.md](../graph-operations-foundation/4-the-write-path.md)
- The external CLI the agent uses: [stories/graph-operations-foundation/6-external-cli-and-agent-skill.md](../graph-operations-foundation/6-external-cli-and-agent-skill.md)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md](../../decisions/graph-operations-first-slice/0032-import-nostr.md)
- Test plan: [32-import-nostr.test-plan.md](./32-import-nostr.test-plan.md)
- Review: [reviews/graph-operations-first-slice/32-import-nostr.md](../../reviews/graph-operations-first-slice/32-import-nostr.md)
