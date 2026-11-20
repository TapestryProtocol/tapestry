# ADR 0032: `import nostr` — a recorder of its own, each event in its own transaction, placeholders that merge when their event arrives, the newest version standing, claims made within their author's graph, and the instance's own nodes never touched

**Status:** Accepted (the owner, 2026-11-20: Option A, with the six proposed story amendments; `n` and `s` follow the protocol's authorship rule)
**Date:** 2026-11-20
**Story:** `engineering-team/stories/graph-operations-first-slice/32-import-nostr.md`
**Amends:** story 32, as below (Story amendments).

## Context

Story 32 asks for the import group's first operation. `import nostr` records verified events, by id or address (AC1), with one graph per event made of its claims (AC2), safe to repeat and in any order, the newest version standing (AC3); it follows a graph's address through what its graphs list (AC4), and pages a filter through a relay (AC5); it never changes the instance's own nodes, and another author's claim on them becomes only its membership (AC6); AC7 lists the refusals and how it reaches agents. The owner resolved the story's three questions as drafted (2026-11-20): an import never changes an own node, whoever signed the letter; only a membership claim becomes a relationship on the owner's node; and a graph import follows what its graphs list, not the class thread. The story's Background gives today's importers (its facts 1–12). The base is staging at `1abd2889`. These are the facts the design rests on.

1. **The operations module.** A declaration has `run`, or `apply` through the write path, never both (`src/operations/declaration.js:17-29`). The write path runs a write's guards, its change and its change entry in one transaction (`src/operations/write.js`), and a write through it declares a `repeatKey` of its inputs. The group `import` is declared and empty (`src/operations/groups.js`). `callOperation` checks inputs and runs the operation; the route checks access first (`src/operations/http.js:93`); the internal command calls it with the caller `local` (`src/operations/cli.js`). The lifecycle writes use `run`, and backup runs as a job (`src/operations/catalog/lifecycle/_jobs.js`). nginx gives `/api/tapestry/lifecycle/` 900 s and every other route its default of 60 s (`docker/nginx.conf:43-49, 67`).
2. **The graph seam and the change entries.** `graph.writeTransaction(work)` runs `work(tx)` in one Neo4j write transaction, run again on a transient error such as a deadlock (`src/operations/graph.js`). `recordChange(tx, { at, caller, operation, changes })` writes an entry in a given transaction, its `keys` gathered from each change's `node`, `from`, `to`, `concept` and `nodes` (`src/operations/changes.js:96-130`).
3. **The constraints.** `nostrEvent_id` and `nostrEvent_uuid` make `NostrEvent.id` and `NostrEvent.uuid` unique, and `nostrEventTag_uuid` makes `NostrEventTag.uuid` unique (`setup/neo4jConstraintsAndIndexes.sh:43-47`); `tapestry_key` makes `TapestryNode.tapestryKey` unique, and `tapestry_node_uuid` indexes `TapestryNode.uuid` (BIBLE §29). A `MERGE` on a property a uniqueness rule covers takes that rule's lock, so two transactions that `MERGE` one value make one node.
4. **`buildImportCypher`** (`src/api/neo4j/eventSync.js:198-323`). It keys an event of kind 30000 or more by address, and every other by id (`:200-202`). It sets the event's fields with no comparison of versions (`:214-218`). Its tag nodes are keyed `<last 8 hex of the id>_<index>_<type>` (`:248`), a 32-bit suffix: among 50,000 events, two will likely share one, and their tags of the same index and type then `MERGE` onto one tag node. An `e` target is a placeholder keyed by id (`:266-272`); an `a` or `b` target is a placeholder keyed by address, made only when no node holds it (`placeholderUnlessHeld`, `:188-196`), so an event-id `b` value makes a placeholder whose `uuid` is that id and whose `id` is unset. Every node it makes gets `keyNode`'s label and tapestryKey (`src/lib/tapestry-key-cypher.js:22`). Its statements are text with escaped literals, run by `cypher-shell` with a 30-second limit (`:328-342`).
5. **Whose node it is.** `factsOf(key, node)` (`src/operations/catalog/graph/_nodes.js`) answers `own` when the node's author is the instance's assistant or its owner, or it records none, and never for a person node (`NostrUser`) or a placeholder (a `NostrEvent` with no `created_at`). The own keys come from `ownKeys()` (`src/operations/reads.js:147-150`), which resolves the assistant's key at run time.
6. **The protocol's rules for claims.** `protocols/drafts/class-thread-relationships.md:46-50`, binding on consumers: from `n` and `s` a consumer derives relationships only from events "signed by that curator", the parent's author ("A tag naming some graph's node, published by anyone else, derives nothing in that graph"); "relationships derived from a curator's tags stay within that curator's graph"; and from `n` and `s` only `HAS_ELEMENT` and `IS_A_SUPERSET_OF`. `protocols/drafts/tapestry-concepts.md:200-204`: most relationships are derived from event structure, and only editorial ones (`IMPORT`, `SUPERCEDES`, `PROVIDED_THE_TEMPLATE_FOR`, `ENUMERATES`) are explicit events. A `z` tag is the Decentralized Lists parent pointer, by which anyone's item joins a list, judged at read time (tapestry-concepts.md:15-51; CLAUDE.md, principle 2).
7. **The relationship types firmware declares** (`firmware/active/concepts/relationship-type/elements/`): category `nostr`, `HAS_TAG`, `AUTHORS`, `REFERENCES`; `classThread`, `IS_THE_CONCEPT_FOR`, `IS_A_SUPERSET_OF`, `HAS_ELEMENT`; `coreNodeWiring`, the six `IS_THE_…_FOR`; `propertyTree`, `IS_A_PROPERTY_OF`, `ENUMERATES`. `relationship-type-allowed` reads them from the active firmware (`src/operations/rules/relationship-type-allowed.js:56-80`).
8. **Today's wiring of claims.** `wire-implicit-elements` (`src/api/normalize/index.js:5832-5934`) gives each local `ConceptHeader`'s superset a `HAS_ELEMENT` to every node whose `z` tag names it, unless a path already reaches it, then prunes; firmware's step 1d skips the `word` concept (BIBLE §7). The I/O import's third phase makes each relationship a graph element's `graph.relationships` lists, resolving slugs through every imported item's `graph.nodes`, for a type matching `^[A-Z_][A-Z0-9_]*$` (`src/api/io.js:552-600`). An owner's section on another author's node is kept beside the letter, in `tapestryOwnSections` (ADR graph-operations-first-slice/0022 Decision 2), and `graph remove-from-concept` reads another author's membership claim from its `z` tag (`_memberships.js`, `authorClaim`).
9. **Reading relays.** `readRelayEvents` (`src/api/_shared/relaySource.js:239-305`) connects with nostr-tools' `Relay` (one retry; 5 s to connect, 5 s to the end of stored events), reads one REQ to its EOSE, and drops events that fail `verifyEvent` without saying so; its `connect` and `verify` are injectable. The in-container relay is `ws://127.0.0.1:7777`, never `/relay` (`src/pipeline/tagging-edges/realtime/subscription.js:32`). strfry answers at most 500 events a REQ (`setup/strfry.conf.template:91`); search.brainstorm.world 5,000 (memo #129). `isPublicRelayHostWithin(host)` answers whether a host resolves to public addresses only, within 3 s, never rejecting (`src/utils/relayHostGuard.js:35`). nostr-tools 2.10 is a dependency (`package.json:81`): `verifyEvent`, `nip19` and `matchFilter`.
10. **How operation suites run.** They replace the graph seam with `test/helpers/graphFake.js`, which runs only the statement shapes its stories named and grows with each story (story 19's `test/helpers/enumerationGraph.js` seeds it), drive the routes and the commands through `test/helpers/operationsHarness.js`, and check an agent through the external CLI (`test/operations/graph/*-agent-through-cli.test.js`). Real Neo4j is met only on a scratch stack, in the live checks a story's Evidence records.

## Options considered

### Option A — A recorder of its own under `src/operations/catalog/import/`, through the graph seam, one transaction per event; today's builders untouched *(chosen)*

The operation reads, checks and records each event itself. Its recorder writes the graph `buildImportCypher` documents (BIBLE §6), with the fixes the story asks for, in parameterized statements through `graph.writeTransaction`, one transaction per event. Today's importers keep working as they do (D15).

- **Pros.** The new stack gets a correct importer without touching the 40-odd routes that call today's three builders. Each event stands alone: one that fails rolls back alone, and no transaction holds locks across a long import. Parameters replace escaped literals. It is testable through the graph seam and a relay seam, as every operation is.
- **Cons.** A fourth builder exists beside three, though it is the one the docs describe and the others are mapped to it (catalog §9). Memo #130's failure stays on `buildImportCypher`'s callers until they move over.

### Option B — Fix `buildImportCypher` and call it from the operation

One builder for import nostr and the six paths that call it today (story fact 2).

- **Pros.** Memo #130 is fixed on every path at once. One shape for one event.
- **Cons.** Its contract is text for `cypher-shell`, so moving it onto the driver changes it for six callers. Comparing versions changes what `event-update` does when the owner re-publishes an older version by hand, and making the `z`, `n`, `s` and structure claims changes what firmware's community references and the I/O import build, beside their own wiring steps. D15 keeps old tools as they are unless a fix is cheap; this one isn't, and its risk lands on firmware install.

### Option C — Keep each letter in the instance's own relay, then import from there

Read from the outside relay, `strfry import` each verified event, then record it from the local relay, as `pull-community-class-thread` and the I/O import keep theirs.

- **Pros.** The box keeps the signed letter its node was made from, so the node can be rebuilt from it (BIBLE §30's event-projection).
- **Cons.** The story settles that nothing is sent to another relay, and the relay router's presets, when the owner turns one on, send what strfry holds onward: the `dcosl` preset sends kinds 9998–39999 both ways. A `strfry import` of kinds 3, 10000 and 1984 also reaches the stream consumer, which then writes follows, mutes and reports from an import. Keeping letters can come later, as its own choice, with the router's streams in view.

## Decision

We chose **Option A**: it gives the new stack the importer the story describes, and leaves today's paths as they are (D15).

**1. The declaration.** `src/operations/catalog/import/nostr.js`: group `import`, name `nostr`, kind `write`, access `owner-and-admins`, with `run` (Decision 10).
- Inputs, all optional, each with a description:
  - `ids`: strings (an event id as 64 lowercase hex, a `note` or a `nevent`), 1 to 200;
  - `addresses`: strings (`kind:pubkey:d-tag`, or an `naddr`), 1 to 200;
  - `graph`: a string, a graph element's address or `naddr`;
  - `filter`: an object, or its JSON text of up to 10,000 characters (set-schema's form for a JSON input);
  - `relay`: a string of up to 2,000 characters.
- Its own refusals, each changing nothing and recording no entry:
  - `no-source` (400): none of `ids`, `addresses`, `graph` and `filter`.
  - `two-sources` (400): more than one of `ids`/`addresses` (which go together), `graph` and `filter`.
  - `too-many` (400): more than 200 ids and addresses together.
  - `bad-id` (400): an id that isn't 64 lowercase hex, or a `note` or `nevent` that doesn't decode; it names the value.
  - `bad-address` (400): an address that isn't a kind (an integer 0–65535), a 64-lowercase-hex pubkey and a d-tag, or an `naddr` that doesn't decode; for `graph`, also an id. (Lowercase, as NIP-01 writes ids and keys: an uppercase one is refused, never lowered; settled at Test Design, 2026-11-20.)
  - `bad-filter` (400): JSON text that doesn't parse, or a filter with a field other than `ids`, `authors`, `kinds`, `#<letter>`, `since`, `until`, `limit` and `search`, or one of the wrong type.
  - `bad-relay` (400): not a `ws://` or `wss://` URL with a host and no user name.
  - `private-relay` (403): a relay whose host doesn't resolve to public addresses only (`isPublicRelayHostWithin`), whoever calls; the instance's own relay is read by leaving `relay` out.
  - `relay-unreachable` (409): the relay didn't connect, or answered no request to its end, before anything was read.

**2. The reading** (`_relay.js`, beside the declaration).
- One connection per call, to `relay`, or to `ws://127.0.0.1:7777` when it's left out (the in-container relay; Context 9). Requests go one at a time, each read to its EOSE within 10 s; connecting gets 5 s and one retry, as `readRelayEvents` does. Its `connect` is a seam a suite replaces.
- Every event comes back as sent: checking it is Decision 3's, so an invalid event is reported, never dropped unseen.
- `ids`: requests of at most 100 ids each.
- `addresses`: grouped by kind and pubkey; an addressable kind as `{ kinds: [k], authors: [p], "#d": [d…] }`, at most 100 d-tags a request; a replaceable kind as `{ kinds: [k], authors: [p] }` (NIP-01's empty d-tag).
- A request that doesn't finish leaves the events it would have read `unread`; with nothing read yet in the call, it is `relay-unreachable`.

**3. Checking each event** (`_letters.js`). An event is recorded only when it has a 64-hex `id` and `pubkey`, a 128-hex `sig`, a `kind` from 0 to 65535, an integer `created_at`, `tags` that are lists of strings and a string `content`, and nostr-tools' `verifyEvent` holds. Otherwise it is `invalid`, with the reason. An event the request didn't ask for is left out: an id not asked for, an address not asked for, or one `matchFilter` says doesn't match the filter. Within one call each id is recorded once, and each address once, with its newest version (Decision 4); the others are `older`.

**4. Keys and versions, by NIP-01.** Kinds 0, 3 and 10000–19999 are replaceable, at `<kind>:<pubkey>:`; 30000–39999 are addressable, at `<kind>:<pubkey>:<d>` (the first `d` tag, `''` without one); every other kind is regular, at its id (its `uuid` is its id). One node holds the newest version of an address: the later `created_at`, and on a tie the lower id. This differs from `buildImportCypher` (Context 4) for kinds 0, 3, 10000–19999 and 40000 up. So that a node it made is found, a replaceable event also finds a node with its own id and moves it to its address (Decision 7).

**5. A filter, paged** (AC5). The relay is read newest first, by `until`, in pages of 500.
- Each page is followed by a sweep of its oldest second, `{ …filter, since: T, until: T }`, since a page can stop inside a second, and events seen twice are counted once. The next page is read to `until: T − 1`.
- **When an answer is full** (amended at Test Design, 2026-11-20, the owner's answer "Only on evidence"). A request is full when it is answered with as many events as it asked for, or, once this call has seen the relay stop short, with as many as the relay stopped at. The call sees it stop short when a request is answered with fewer events than it asked for and another request then finds one the first should have held: more in the page's oldest second, found by its sweep, or older ones, found by the next page. A sweep is judged once the next page, if any, has been read, so that page's evidence counts. (The rule before, that a sweep as large as the most any request answered may have missed some, raised that alarm for a filter matching one event, and for letters published in one second, as firmware's are.)
- A full sweep may have missed some. It is split by the filter's kinds, then by its authors, when it lists more than one of either. If a part still comes back full, the second is listed under `crowded`, with how many were read, and the answer says that a narrower filter (fewer kinds or authors, or a tag) may read the rest.
- **What it can miss.** A relay that quietly answers fewer than 500 a request, for a filter whose every match is in one second, never shows that it stops short, so the rest of that second can go unreported. strfry (500 a request) and search.brainstorm.world (5,000) answer the 500 asked, so neither is affected.
- It stops when a page is empty, when `since` is passed, at 1,000 events read (or the filter's `limit`, if lower), or after 40 s. It always finishes the second it is in. On a cap or the time it answers `next: { until }`, the second before the last one finished. A call given that `until` goes on there, and a repeat over the same seconds records nothing new.
- `search` is passed as given (NIP-50), so a relay's own words, such as search.brainstorm.world's `include:spam`, work when the caller gives them.

**6. A graph, followed** (AC4; the owner's answer to the story's question 3).
- The graph element at `graph` is read, checked and recorded first. Its JSON is the value of its `json` tag, the word-wrapper form whose `graph` block lists `nodes` (`slug`, `uuid`), `relationships` (by slug) and `imports` (`slug`, `uuid`). A Tapestry element has the same block (BIBLE §6).
- For each graph, breadth first, each graph once:
  1. the letters `graph.nodes` names are read (by address, or by id when a node's `uuid` is one) and recorded;
  2. then the relationships `graph.relationships` lists, between the nodes they name, are made as Decision 8 allows, each slug resolved through that graph's own `nodes`, else through those of every graph already followed in the call, as the I/O import does;
  3. then each graph `graph.imports` names is followed, at one level deeper.
- It goes four levels below the element at most, follows at most 50 graphs and reads at most 1,000 letters a call, within 40 s. What it didn't reach is answered as `next: { graphs: [addresses] }`, each to import in a later call.
- Each graph followed is listed under `graphs`, with its depth and its outcome: `followed`, `not-found`, or `unreadable` when its JSON doesn't parse (its letter is still recorded).
- A concept's class thread, its sets and elements, is not followed (the owner's answer).

**7. The recorder** (`_letters.js`, `record(tx, event, ctx)`): one event, in one transaction of its own.
1. **Find its node.** For an event with an address, the node whose `uuid` is that address, and the node whose `id` is the event's (which may be the same one, a placeholder keyed by the id, or a node today's builder keyed by id). For a regular event, the node whose `id` or `uuid` is its id.
2. **The instance's own node** (AC6; the owner's answer to question 1). When the node at the event's address, or with its id, is the instance's own (`factsOf`'s `own`), the outcome is `own`, and nothing is written. An own letter with no node at its address is recorded like any other.
3. **Versions.** Against a node that holds an event (not a placeholder):
   - the same id is a refresh: what Decision 8 makes is made again, and the tag nodes are written again only when they aren't in the recorder's shape (a node today's builders wrote); `unchanged` when nothing changed, else `updated`;
   - an older version is `older`, and nothing is written;
   - a newer one is `updated`.
4. **Placeholders** (memo #130). For an event with an address, a placeholder keyed by its id is the event's node when no node holds the address: its `uuid` becomes the address. When a node does hold the address, the placeholder's incoming relationships, which can only be tag-level `REFERENCES` and a `b` tag's `REFERENCES` or `INHERITS_FROM` (Decision 8), are moved onto that node with their properties, and the placeholder is deleted. The change entry names it (`placeholder-merged`). A replaceable event's node that today's builder keyed by the same id is moved to the address the same way when no node holds it; if one does, it stays where it is (a per-version node of today's, for the ledger).
5. **The node.** `MERGE` on the address (an event with one) or the id, under the uniqueness rules, so two imports of one event make one node (AC3). It holds `id`, `pubkey`, `created_at`, `kind` and `uuid`, and `aTag` when it has an address. `name` and `tapestryValue` (D11) come from its first `name`, else `names`, else `title` tag, and are taken out when a newer version has none. `content` is kept for kind 7 only, as today. Its labels are `NostrEvent` (D7), `TapestryNode` with `keyNode`'s key, `ListHeader` for kinds 9998 and 39998, `ListItem` for 9999 and 39999, and `Reaction` for 7, with the role labels of Decision 9. Its author's person node `AUTHORS` it.
6. **Tags.** On a newer version, or a refresh of another builder's shape, the node's old tag nodes are deleted, with their relationships, and a tag node is made for each tag:
   - labels `NostrEventTag` and `TapestryNode`, with a key;
   - `uuid` `<event id>_<index>`: the whole id, so no two events' tags can meet (Context 4);
   - `type` and `value` to `value4`, the tag's first five values, as `buildImportCypher` keeps them and today's readers read them;
   - `HAS_TAG` from the node.
7. **Claims**: Decision 8.
8. **Its change entry.** It is written in the same transaction by `recordChange`, operation `import nostr`, whenever something changed, with one change for the event (`event-recorded`, `event-updated` or `placeholder-filled`, with `node`, and `was` and `now` as `{ id, created_at }` for an update), one `placeholder-merged` when there was one, and `nodes`, the keys of the placeholders it made and of the nodes at the other end of each relationship its claims made or took out. So `graph history` finds the entry by each of them (AC1).
9. **Failure.** A uniqueness rule's failure, met when another import made a placeholder meanwhile, runs the event once more from the start. A second failure, or any other error of this event's, answers `failed` with the error's words, and the call carries on with the next event. When the graph database can't be reached, the call stops and fails (500), and what it already recorded stays.

**8. The claims** (`claimsOf(event)` in `_letters.js`, which reads only the event, then the recorder writes what it allows). A claim names its other end by an address or an id. The table gives each claim, its relationship, and the gate it passes.

| Claim | Relationship | Made when |
|---|---|---|
| the author | `(person)-[:AUTHORS]->(node)` | always |
| each tag | `(node)-[:HAS_TAG]->(tag)` | always |
| `e`, a 64-hex id | `(tag)-[:REFERENCES]->(target)` | always (a reference) |
| `a`, a well-formed address | `(tag)-[:REFERENCES]->(target)` | always (a reference) |
| `b`, an address or id (`classifyBValue`; the `b-tag-deferred` sentinel makes none) | `(node)-[:INHERITS_FROM]->(t)` for an `inherit` third element, else `(node)-[:REFERENCES {source: 'b-tag'}]->(t)` | always (a reference) |
| `z`, a concept's address | `(superset)-[:HAS_ELEMENT]->(node)`, from each superset the concept's header `IS_THE_CONCEPT_FOR` | when the header and its `IS_THE_CONCEPT_FOR` are in the graph (below); never for a concept whose d-tag is `word`, as firmware's step 1d skips it |
| `n`, a set's address | `(set)-[:HAS_ELEMENT]->(node)` | the address carries the claimant's pubkey (Context 6, rule 1) |
| `s`, a parent's address | `(parent)-[:IS_A_SUPERSET_OF]->(node)` | the address carries the claimant's pubkey |
| a relationship letter's `nodeFrom`, `nodeTo`, `relationshipType` | `(from)-[:TYPE]->(to)` | both ends addresses carrying the claimant's pubkey (rules 1 and 2), and the type allowed (below) |
| a graph's `graph.relationships` | `(from)-[:TYPE]->(to)` | as a relationship letter's, the graph element's author the claimant |

- **The instance's own nodes** (AC6; the owner's answer to question 2). A relationship starting or ending at one of the instance's own nodes is made only as a membership (`z`, `n`: a `HAS_ELEMENT` from the own superset or set) or a reference (`e`, `a`, `b`: from the claimant's tag or node to the own node). The gates already keep another author's `n`, `s` and structure off them, since an own node's address carries an own key. An own letter's `s` and structure claims are never made either: the instance's own structure is the graph operations' and the signing routes', never the import's.
- **The types a structure claim may make**: those firmware declares outside its `nostr` category (Context 7), and the three editorial types tapestry-concepts.md names, `IMPORT`, `SUPERCEDES` and `PROVIDED_THE_TEMPLATE_FOR`. Only a name in that list, matching `^[A-Z][A-Z0-9_]{0,63}$`, reaches the statement's text. Any other claimed type stays in the letter, unmade.
- **Placeholders.** A reference, an `n` or `s` parent, or a structure claim's end that no node holds gets a placeholder (`NostrEvent`, `TapestryNode` with a key; by address, with `uuid`, `kind` and `pubkey` from it; by id, with `id` and `uuid` both the id), made only when no node holds it, so it is never a second node at an address (Context 4). A `z` claim never makes one.
- **A `z` claim in any order.** When the import makes an `IS_THE_CONCEPT_FOR`, from a graph or a relationship letter, it gives that superset a `HAS_ELEMENT`, in the same transaction, to every node whose `z` tag names the header (`wire-implicit-elements`' query, Context 8), so the order of arrival doesn't matter. The import makes these directly and never prunes one, so what it makes doesn't depend on the order the events came in.
- **A newer version.** Its tag claims replace the older's: the older's `b`, `z`, `n` and `s` relationships that the newer doesn't claim are taken out, unless the owner's `graph add-to-concept` put that membership there (the node's `tapestryOwnSections` holds that concept's section; Context 8). The older's tag-level `REFERENCES` go with its tags. A structure claim's relationships, from a relationship letter or a graph, are made and never taken out, since another letter or graph may claim the same one and no relationship records who claimed it (catalog, C6). `rules check` (A10.31) is to report one no letter claims any more.

**9. Role labels.** From the event's `json` tag's `word.wordTypes`: `superset` gives `Superset`, `set` gives `Set`, `property` and `primaryProperty` give `Property`, and `jsonSchema` gives `JSONSchema`. They are added and never taken out, since firmware's community references label a superset too. They are set only on the node the event makes, never on an own node (Decision 7.2). `ConceptHeader` stays the local header's mark (BIBLE §22); a foreign header is a `ListHeader`, which the graph operations take as a concept header (`src/operations/resolve.js:24`).

**10. `run`, not the write path.** One call records many events, each in its own transaction, so that one failure doesn't undo the rest and no transaction holds locks across a 40-second import. No guard runs (D4), and what makes a repeat safe is each event's address or id, not the call's inputs, so a `repeatKey` would say nothing true. Each event's change and its entry are still kept together, in its transaction (Decision 7.8), as the write path keeps them. The test that every graph write applies covers the `graph` group only (Context 1).

**11. The answer.**
- `source` (`ids`, `graph` or `filter`), and `relay`: `own`, or the URL read.
- `counts`: how many of each outcome, `recorded`, `updated`, `unchanged`, `older`, `own`, `notFound`, `invalid`, `unread` and `failed`.
- `events`: for each event, `ref` (what was asked, for `ids` and `addresses`), `id`, `address`, `outcome`, `node` (its tapestryKey, or null) and `reason` (for `invalid` and `failed`).
- `graphs`, for a graph, and `crowded`, for a filter; null otherwise.
- `next`: null, `{ until }` or `{ graphs }`.
- `changes`: how many change entries the call wrote.

**12. Caps and time** are constants at the top of `nostr.js`: 200 ids and addresses, pages of 500, 1,000 events read, four levels and 50 graphs, and 40 s. The live check measures them against the 60-second limit (Context 1), and Implementation may lower them.

**13. Two imports at once, and an import beside a graph write.** Two imports of one event meet at its `MERGE` under the uniqueness rules (Context 3), and a placeholder made meanwhile is met by Decision 7.9's second run. An import changes no own node, and the graph writes change no other author's node (D4), so they meet only at a membership into an own superset, a relationship both lock at its ends.

### Story amendments (approved with this ADR, 2026-11-20)

The owner chose the protocol's rule for amendment 1 over the story's earlier answer ("Follow the protocol"), and approved the six together.

1. **AC2 and open question 2: `n` and `s` only within their author's graph.** The story gives a peer's `n` naming the owner's set a `HAS_ELEMENT`. The protocol makes it binding that a tag naming a node of someone else's graph derives nothing there (Context 6), so a peer's `n` makes nothing on the owner's set; only `z` membership comes from anyone. A structure claim (a relationship letter, a graph's relationships) is likewise made only between nodes its author signed.
2. **AC2 and AC6: references to the owner's nodes are made.** The owner's answer, "membership only", is read as no structure on the owner's nodes: an `e`, `a` or `b` reference from another author's letter to an own node is made. It starts at the claimant's tag or node and changes nothing the owner's writes read.
3. **AC2: the last sentence goes.** The nodes today's `importEventDirect` copies wrote come from the signing routes, under the instance's own keys, so AC6 leaves them alone, and import nostr gives them nothing.
4. **AC3: a structure claim's relationships stay.** A newer version's tag claims replace the older's. Relationships a relationship letter or a graph claimed are made and never taken out (Decision 8).
5. **AC1: two more outcomes.** `unread`, when a request to the relay didn't finish, and `failed`, when the graph refused the event's write twice.
6. **AC6: an own letter is reported, not recorded.** A letter at an own node's address answers `own`, and nothing in the graph changes, so no record of that letter is kept on the node. A "sent as" record is export nostr's (A10.34).

## Consequences

- An agent can import from any public relay, in any order, safely repeated. A concept graph from another instance arrives wired at the publisher's addresses (AC4, AC7), and memo #130's case records one node (AC3).
- **The firmware route** gets its importer: a firmware Tapestry imported by address brings what its graphs list. What it must list, or lead to, and how an instance adopts it, are that decision's.
- **Imported nodes from an outside relay have no letter on this box** (Option C). Their data is in the graph, and a Neo4j backup keeps them. The signed letter stays where it was read, and `import refresh` (catalog §5) would read it there.
- **Today's builders keep their faults** (D15): memo #130's failure on `buildImportCypher`'s six callers, its 32-bit tag key, its keying at kind 30000, versions that overwrite newer ones, and old tags it never clears. A ledger row lists them, and moving a caller onto this recorder is the cheap fix when one is wanted.
- **The catalog was wrong** that the stream consumer imports continuously (story fact 3). Implementation corrects catalog §5, and adds to BIBLE §6 and §11 what the operation does and how it keys events.
- **A `z` membership waits for its concept's wiring**, which a graph import or a relationship letter brings. An item imported alone, before its concept is in the graph, is wired when the concept's `IS_THE_CONCEPT_FOR` arrives through an import. If the concept is made some other way, it waits for `wire-implicit-elements` or `rules repair`.
- **The agent skill's line** that every operation "checks the graph's rules as it writes" (`clients/cli/skill/SKILL.md:9`) gains the exception for imports.
- **Firmware reinstall required?** No: no concept definition changes.

## Implementation notes

- **Files.** These are new:
  - `src/operations/catalog/import/nostr.js`: the declaration and its `run`, which reads (Decisions 2, 5, 6), checks (3) and records (7) in order, keeps the budgets (12), and builds the answer (11);
  - `src/operations/catalog/import/_relay.js`: the reader, with its `connect` seam;
  - `src/operations/catalog/import/_letters.js`: `parseRef`, for ids, addresses and nostr-tools' `nip19`; `checkEvent`; `keyOf` (Decision 4); `claimsOf`; `record(tx, event, ctx)`; and the type list (Decision 8).

  Nothing in `src/api/` or `src/firmware/` changes.
- **The statements `record` runs**, each parameterized, the only text spliced in being a type from Decision 8's list or a label from Decisions 7 and 9:
  1. find the node by `uuid`, and by `id`;
  2. `MERGE` the node and set its fields, with `keyNode`;
  3. delete the old tag nodes (those it `HAS_TAG` that no other node has, as `wholeNodeOf` reads them);
  4. `UNWIND` the tags to make them, with `HAS_TAG`;
  5. a placeholder unless held;
  6. `MERGE` a claim's relationship;
  7. take out a claim's relationship;
  8. move a placeholder's incoming relationships and delete it;
  9. the `z` wiring for one header;
  10. `recordChange`'s entry.

  The Tester can extend `graphFake` to these shapes or test `record` against a scratch stack's Neo4j. Memo #130's case runs on real Neo4j in the live check either way, since only Neo4j enforces the uniqueness rules.
- **The relay seam.** `_relay.js` takes `connect(url)` → an object with nostr-tools' `subscribe(filters, { onevent, oneose, onclose })` and `close()`. A suite gives it a fake relay from fixture events, with a per-request cap, a second crowded past the cap, a relay that closes or never sends EOSE, and one that sends events it wasn't asked for and ones that don't verify.
- **The relay host guard** is required inside `run`, never at load (ADR graph-operations-foundation/0001 Decision 10), and a suite gives it a `Resolver` as `relayHostGuard.js` allows.
- **The live check** (AC7) runs on a scratch stack (`scripts/scratch-stack.sh`), whose container reaches public relays:
  - the agent's sequence through the external CLI, reading a concept graph from a hosted instance's public relay;
  - memo #130's pair and the `e`-plus-`a` referrer, published to the scratch stack's own relay with a throwaway key;
  - a two-call filter;
  - a timing run that measures the caps: events a second, with their tags, against Decision 12's numbers.
- **The ledger row** for today's builders (Consequences) is written in Implementation.

## Out of scope

- Whose key signs published firmware, how an instance adopts an import, and firmware installed by import (A10.37).
- Keeping letters in the instance's own relay (Option C), the "sent as" record, and export (A10.34).
- Moving today's importers onto this recorder; pruning; `rules check` and `repair` (A10.31).
- NIP-42 AUTH, relay hints inside an `naddr` or `nevent`, deletion events acting on nodes, and a live subscription.
- `q` tags, `p` tags, `word.coreMemberOf`, and a `nodeLabel` a concept requires (the I/O import's second phase): claims a later story can add to the table, each needing its own gate.
