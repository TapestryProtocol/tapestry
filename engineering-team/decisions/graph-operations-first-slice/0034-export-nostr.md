# ADR 0034: Export nostr builds each letter from its node, sends it from the server, and records it on the node

**Status:** Accepted
**Date:** 2026-11-20
**Story:** `engineering-team/stories/graph-operations-first-slice/34-export-nostr.md` (Loom A10.34)

Two documents are cited by short name. The **design doc** is [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md), whose decisions are D1 to D15. The **catalog** is [docs/GRAPH_OPERATIONS_CATALOG.md](../../../docs/GRAPH_OPERATIONS_CATALOG.md). "Fact n" is the story's. Code is cited as it is on staging `79c8a098`.

## Context

Story 34 asks for `export nostr`. It publishes a node, a graph or everything of the instance's own as letters the instance's assistant signs, built from what the graph says now. `tapestry:` links are rewritten or reported. Someone else's nodes are named by address and never signed. Only what is new or changed is signed again, and each letter is recorded (AC1–AC7). The owner approved its three proposals (2026-11-20):
- status and retract follow as a subtask (A10.34.a), and making a release as another (A10.34.b);
- the owner and admins may sign as the assistant, to any relay;
- only what the scope names goes out, and references to the instance's own nodes that have no letter are reported.

ADR 0043 asks this ADR to say which publisher sends a release, and how that squares with community-reference ADR 0004. The story's fourteen facts stand. Reading the code and measuring the local instance found eleven more:

1. **The operations module.**
   - A declaration has `run`, or `apply` through the write path (`src/operations/declaration.js:17-29`). The write path's context "carries nothing that signs or publishes" (`src/operations/write.js:13-14`). Import nostr is a write with `run` for reasons of its own: one call records many events, each in a transaction of its own, and no `repeatKey` would say anything true (ADR 0032 Decision 10).
   - Access `owner-and-admins` becomes the route table's `owner`, open to the owner, admins and direct-local callers (`src/operations/routeTable.js:14`; `src/middleware/routeAccess.js:12`). The internal command runs as `local` (`src/operations/cli.js`).
   - The `export` group is declared and empty (story fact 1). A new declaration under `src/operations/catalog/export/` is found by the loader, routed, documented and given its command with no other file changed (ADR graph-operations-foundation/0001).
2. **How import nostr reads a letter** (`claimsOf`, `src/operations/catalog/import/_letters.js:212-260`).
   - A `z` makes `HAS_ELEMENT` from each superset the named header `IS_THE_CONCEPT_FOR`, for any author (`:228-231, 584`). It checks for no other path: an element that is also below that superset through a set gets the direct link too. A `z` whose d-tag is `word` derives nothing.
   - `n` and `s` derive only when the parent's address carries the letter's own key.
   - A relationship letter's `nodeFrom`, `relationshipType` and `nodeTo`, and a graph's `graph.relationships` (resolved through its `graph.nodes` slugs), make a relationship only between two of the author's own addresses, of a type firmware declares outside its `nostr` category or one of the editorial three (`structureTypes`, `:176-198`).
   - An event at one of the instance's own nodes' addresses answers `own` and writes nothing (`:495-497`).
3. **A letter's `z` tags aren't its class thread** (measured read-only on the local instance, 2026-11-20). It holds 535 own nodes of kinds 39998 and 39999, every one with a letter.
   - For 209 of them, some concept's class thread reaches the node while no `z` names that concept: an ancestor concept's thread, or a role concept reached through firmware's category links.
   - For 10, a `z` names a concept whose thread doesn't reach the node: nine firmware supersets' `z` for the superset concept, and one element's shared-concept stamp.
   - create-concept links each core node directly to only some of the concepts its `z` tags name, "as a firmware reinstall leaves them … the class threads give instead" (`src/operations/catalog/graph/_concepts.js:44-59`).

   So deriving `z` from the class thread would rewrite hundreds of today's letters and drop conventions.
4. **A set's `s` tags aren't its parents** (same instance). Of 71 own supersets and sets, 22 carry `s` tags and 48 have a parent link from an own node, and the two differ for 36. Ten `s` tags name a node that isn't a parent. Firmware's prune pass takes out a superset's direct link to a set reachable through another set, and its category links put supersets under other supersets with no `s` at all (ADR 0028, Context 7).
5. **The derive step can start from a stale copy.** `getExistingWordJson` takes the LMDB entry whenever it has a `word` block, and reads the `json` tag only otherwise (`src/lib/derivers/word.js:52-77`). No graph write refreshes the LMDB (story fact 5). graph update-node rewrites the `json` tag inline even when it was an `lmdb:` pointer (`update-node.js:302-313`). So a node's stored JSON is its `json` tag, and its tapestryJson can lag it.
6. **Stamps.** `selectPointerTargets(rows, selfCoord, cap)` (`src/lib/bValueForms.js:73-86`) picks the targets of a header's `b` tags that are pointer-typed or untyped and name an address, skipping every other type and the header itself, up to a cap. Today's create-element puts a `z` for each on the element (ADR 0020, fact 3).
7. **Sending.**
   - nostr-tools 2.10.4's `AbstractRelay.publish(event)` sends the event and resolves with the relay's reason on `OK true`. It rejects with an Error carrying the reason on `OK false`, and with "publish timed out" after `publishTimeout`, 4,400 ms by default (`node_modules/nostr-tools/lib/cjs/abstract-relay.js:324-336, 377-390`).
   - Import's `_relay.js` already connects with a timeout and one retry, and wraps `send` so a dropped connection can't end the process (`src/operations/catalog/import/_relay.js:69-117`). Its `open()` answers `request` and `close` only (`:113-116`). nostr-tools rejects every open publish when the socket closes (`abstract-relay.js:208-216, 256-262`). The suites' `test/helpers/relayFake.js` already logs a `publish`.
   - `strfry import` takes an event of up to 1 MiB and exits 0 even when it refuses one. A websocket message is capped at 128 KiB (story facts 9 and 13).
8. **No markdown parser** (story fact 12). micromark 4 is a CommonMark parser that marks every token, including a link's destination, with its exact offsets, but ships as ES modules only. The container runs Node 22 (`Dockerfile:14`, nodesource 22.x), and so does CI (`.github/workflows/test.yml:39`). A dynamic `import()` loads an ES module from CommonJS on any Node 22.
9. **The importers AC6 names, and one it doesn't.**
   - `POST /api/neo4j/event-update` finds the newest letter strfry holds at an address, deletes the node's tags, and imports the letter with `buildImportCypher` (`src/api/neo4j/eventSync.js:348-375`; story fact 11).
   - The I/O import writes each event to strfry, then imports it with `buildImportCypher`, deleting nothing (`src/api/io.js:493-505`). `buildImportCypher` keys a letter's tag nodes by its id (`eventSync.js:248`). So on a node the graph operations made, whose tag nodes are keyed otherwise (`_eventless.js:31-39`), it adds the letter's tags beside the node's. It also adds `NostrEvent` and overwrites `id`, `created_at` and `name`.
   - Neither compares versions.
   - A third path imports an own letter. The client-publish route's brain-write hook takes any Tapestry letter of the instance's own posted to `POST /api/strfry/publish`, and imports it with `importEventDirect`, which deletes and remakes the node's tags (`src/api/strfry/tapestryBrainWrite.js:51-64`; story fact 11).
10. **Refs.** `resolveOne(read, { input, ref, kind, pov })` uses a tapestryKey as given. It reads any other ref by its shape, and refuses `bad-ref` (400), `unknown-ref` (404) or `ambiguous-ref` (409, with up to 10 candidates) (`src/operations/resolve.js:66-68, 280-299`). No operation calls `resolveOne` yet: `graph resolve` reads refs through `candidatesOf`. The refs hook for every declaration is A10.9.a's.
11. **Change entries.** A `GraphChange:TapestryNode` node holds `at`, who made it, `operation`, `keys` (the tapestryKeys its changes name) and `changes` as JSON text. Its schema and writer are `src/operations/changes.js:51-136`. It is never changed, reads leave it out, and a backup keeps it (ADR graph-operations-foundation/0004). `graph history` finds it by any key (`readHistory`, `changes.js:170-198`). A change's `was` and `now` take any JSON. graph delete-node's entry keeps the whole node, properties and tags included (`delete-node.js:287-296`; ADR 0026).

## Options considered

The decision that shapes the rest is where a letter's tags come from.

### Option A — The node's own tags, corrected where the graph says otherwise (chosen)

A letter carries the node's tags as the graph holds them. That is the letter it came from, or the would-be letter its write recorded. Four things are corrected from the graph:
- a set's or superset's `s` from its parent links (memo #114);
- the `json` from the node's stored JSON, less what is local;
- every string with its `lmdb:` pointers resolved and its `tapestry:` links rewritten;
- an element's shared-concept stamps added.

The letter it would sign is compared with the letter the node has, so an unchanged node signs nothing.

- **Pros:**
  - It keeps every tag convention today's routes and the graph writes use: `z` for `word`, `names`, `slug`, `concept-graph`, a core node's `o`, a header's firmware tags and pointer `b`. A node nothing changed signs nothing new, which is what ADR 0043's reinstall needs.
  - One builder serves every kind of node.
  - It fixes the stale tag memo #114 names, and the would-be `s` facts 3 and 4 measure.
- **Cons:**
  - `z` tags and `wordTypes` stay as the writes keep them. graph link-set and unlink-set don't touch the elements below a set they move, so moving a set across concepts leaves those elements naming the concept they left (story fact 3). That is rare, and a ledger row records it.
  - Tag order, and any element of a tag past its fourth, aren't in the graph (story fact 2). Decision 4 takes them from the letter the node has.

### Option B — Rebuild every tag from relationships and sections, kind by kind

A builder for each kind of node (header, core node, element, set, property, graph, relationship letter) derives each tag from the graph. `z` and `wordTypes` would come from the class thread, `s` and `n` from links, and names and descriptions from sections, as ADR 0027's `setJson` and `setTags` do for a set. This is D10 in full.

- **Pros:** no tag left behind by a write can reach a letter.
- **Cons:**
  - Measured, it would put ancestor concepts' `z` on 209 of 535 own letters that never carried them, and drop 10 that carry one by convention (Context 3). That changes the letter convention every reader meets, and re-signs hundreds of letters nothing changed. Option A re-signs once, and only where the graph differs from a letter (Consequences).
  - Seven builders would have to keep in step with seven graph write paths and today's routes.

### Option C — Re-send what strfry holds, and sign only nodes with no letter

A node with a letter has its letter re-sent as it was signed. Only nodes the graph operations made get a new letter, from their would-be tags.

- **Pros:** the least new code, and no letter is ever re-signed.
- **Cons:**
  - A node a graph write changed answers `letterOutOfDate` "until export nostr … sends a new one" (story fact 4), and would never get one, so AC2 fails.
  - Stale `s` tags, missing stamps and the `tapestry:` links today's routes sent would all go out again.

## Decision

We chose **Option A**. It is the only one that both says what the graph says now (AC2) and leaves an unchanged node's letter alone (AC5; ADR 0043 Decision 1).

**1. The declaration.** `src/operations/catalog/export/nostr.js`: group `export`, name `nostr`, kind `write`, access `owner-and-admins` (the owner's answer to catalog §10, question 2), with `run`, since it signs (Context 1).
- **Inputs:** the scope is three inputs, exactly one of them given, as import's sources are. So `export file` (A10.35) takes the same three (D12; the catalog's `scope`).
  - `node`: a ref, resolved by `resolveOne` from the owner's point of view, as a write resolves one (Context 10);
  - `graph`: a ref to a graph element, resolved the same way;
  - `everything`: `true`.

  Three more inputs:
  - `relays`: 1 to 10 strings, each a `ws://` or `wss://` URL of up to 2,000 characters;
  - `dryRun`: boolean;
  - `after`: the cursor a previous call answered (Decision 2).
- **Its own refusals,** each signing, sending and recording nothing:
  - `no-scope` (400): none of `node`, `graph` and `everything`.
  - `two-scopes` (400): more than one of them.
  - `bad-ref` (400), `unknown-ref` (404) and `ambiguous-ref` (409): resolve's, naming the input.
  - `not-a-graph` (400): `graph` names a node that isn't a graph element (AC7). A graph element is one the class thread of `39998:<TA>:graph` reaches (AC1). Where firmware's wiring doesn't reach it, a node whose stored JSON holds a top-level `graph` object, as the graph concept's schema has every element hold, counts too (story amendment 6).
  - `bad-relay` (400) and `private-relay` (403): import's `relayOf` test, for each relay named.
  - `too-many-relays` (400): more than 10.
  - `bad-cursor` (400): an `after` this operation didn't give.
  - `no-assistant-key` (409): the instance's assistant key can't be read (`getOwnerAssistantKeys()` answers null).

**2. The scope** (`src/operations/catalog/export/_scope.js`, written to be shared with `export file`).
- **`node`** is that node.
- **`graph`** is the graph element and what follows from it:
  - each node its `graph.nodes` lists, by its `uuid` as an address, else as an event id;
  - each graph its `graph.imports` lists, followed the same way, as import nostr follows them: four levels, 50 graphs;
  - for a concept graph (a node that `IS_THE_CONCEPT_GRAPH_FOR` a header), that concept's header, core nodes and class thread, as today's export-set gathers them. That is the six `IS_THE_…_FOR` core nodes, the superset, the sets below it to six levels, and their elements (story fact 7). A Tapestry, whose imports are concept graphs, brings each of their class threads this way.
- **`everything`** is every own node (`factsOf`'s `own`) of kind 39998 or 39999 that has an address. Person nodes, tag nodes, change entries and placeholders are never in a scope.
- **Order.** Within a call, each letter goes out after the call's letters it names: through its `z`, `n`, `s`, `a` and `e` tags, its `nodeFrom` and `nodeTo`, and a graph's `graph.nodes` and `graph.imports`. One case makes that impossible: a header whose `concept-graph` tag names the concept graph that lists the header. A cycle like that is broken by rank:
  - concept headers;
  - supersets;
  - sets, by their depth below a superset, parents first;
  - everything else.

  Ties go by tapestryKey. A scope bigger than one call is paged in that rank order. Import nostr records letters in any order, so the order is for today's readers (story amendment 5).
- **Caps.** A call classes at most 2,000 nodes and signs at most 500 letters. When it stops short of the scope's end, for either cap or for time (Decision 6), it answers `next.after`: an opaque cursor naming the last node it finished, by rank, depth and tapestryKey. A call given `after` goes on from there. A node a graph write adds before the cursor between two calls waits for the next export, which finds it `new`.

**3. Whose letter it is** (AC4). A node is signed only when the assistant signs its letter: its author is the assistant, or it records none and its address carries the assistant's key. That covers a node with no letter, whose would-be author is the assistant (story fact 2). Every other node in a scope is answered and never signed or sent:
- `owner-signed`: its author is the owner;
- `not-own`: any other author, an admin included;
- `other-kind`: a kind other than 39998 or 39999, the two a graph node takes (`_eventless.js:28`). Export makes letters of those two kinds only;
- `no-address`: a node with no `uuid`.

**4. The letter** (`src/operations/catalog/export/_letters.js`). It has the node's kind, the assistant's pubkey, empty `content`, and these tags:
1. **Each of the node's tags,** read from its tag nodes as `[type, value, value1, value2]`, leaving out a missing `value1` or `value2`, as `regenerateJson` reads them (`src/api/normalize/index.js:59-75`). The exception is `s`.
2. **`s`, from the node's parents.** One `s` for each node with an `IS_A_SUPERSET_OF` to it whose author is the assistant, by that parent's address (memo #114; Context 4). Another author's parent derives nothing from an `s` (Context 2), so none is named.
3. **`z` and `n` as the node's tags hold them.** The writes that change a membership keep them: create-element, add-to-concept and remove-from-concept for `z` and `n` (`add-to-concept.js:45`, `remove-from-concept.js:50`), and move-element for `n` (`changes.js:43-46`). The class thread isn't read for them (Context 3; story amendment 1).
4. **Stamps,** for an element: a ListItem that isn't a superset, a set, a property, a JSON schema or a concept's core node, as today's create-element stamps one. It gets a `z` for each target `selectPointerTargets` picks from the pointer `b` tags of each own concept header its `z` tags name, unless a `z` already names it (ADR 0020:124; Context 6).
5. **The `json` tag:** the node's stored JSON, its `json` tag's value, read through `tapestry-resolve` when that value is an `lmdb:` pointer. It is never read from the LMDB copy, which can lag the stored JSON (Context 5). ADR 0020a has publishing build the letter's `json` from tapestryJson, which is derived from this stored JSON. So export reads the source rather than the cached copy, and takes out `graphContext` as ADR 0020a asks (story amendment 3). A node with no `json` tag gets none. A pointer the store doesn't hold makes the node `unbuildable`, reported, and its letter isn't built.
6. **Every string the letter carries,** in each element of each tag and in every string value inside the `json`, is read in this order:
   1. a whole value `lmdb:<tapestryKey>` is resolved, since the pointer means nothing elsewhere (BIBLE §29; graph-rules/0002 Decision 6). One the store doesn't hold is left out and reported;
   2. a whole value `tapestry:<tapestryKey>` is rewritten (ADR 0019 Decision 14), or left out and reported (Decision 7);
   3. markdown links are rewritten (Decision 7).
7. **The header's pointer `b`** is one of its tags, carried like any other. That is how the letter's `b` comes "from the header node" (ADR 0043 Decision 1), once seed-firmware's community-reference pass writes it there.
8. **Order and length.** The tags the node's letter already has keep that letter's order, and the rest follow. For a node with no letter, `d` comes first, `json` last, and the others by type, then values. A tag whose first four elements match one in the node's letter takes that letter's tag whole, so an element past the fourth isn't lost.

**5. New, changed or unchanged** (AC1, AC5).
- **The letter the node has** is the event its `id` names, read by id from the instance's own relay with import's reader.
- **`new`:** the node has no `id`.
- **`changed`:** the node has an `id`, and the event isn't in the relay, or differs from the letter Decision 4 builds. The two are compared by kind, content and tags as a multiset. Each tag is compared on its first four elements, as the graph holds it. A `json` tag is compared by its parsed value, so a difference in white space or key order isn't a change.
- **`unchanged`:** the same. It isn't signed again.
- **A dry run** answers a changed letter's added and removed tags.
- **`created_at`** is the later of now and one second after the node's letter, so each version is newer than the last (NIP-01).

**6. Sending** (`src/operations/catalog/export/_send.js`).
- **The instance's own relay first.**
  - Every letter the call signs goes through one `strfry import` on stdin, as today's routes send theirs, with the same 1 MiB limit.
  - Each letter is then read back by id over `ws://127.0.0.1:7777`. A letter read back is `accepted`. One the read-back answers without is `refused` ("the instance's own relay didn't store it").
  - When the read-back itself doesn't answer, the letter is `unread`. Nothing is claimed for it, and it is neither recorded nor sent out, as dlist-curation's batch signer claims nothing from a failed read (`src/api/dlist-curation/update.js:312-323`).
  - When `strfry import` can't run, every letter is `unreachable`. The import's exit code is never taken as an answer (story fact 9).
- **Outside relays.**
  - Only a letter the instance's own relay holds goes out. Any other is `not-sent` to them, as assistant-profile ADR 0002 and dlist-curation ADR 0004 send nothing out after a local failure.
  - **Local-only mode.** When `isPublishLocalOnly()` says so (`src/api/publish-policy/index.js`, the one reading of `BRAINSTORM_PUBLISH_LOCAL_ONLY`), nothing goes to an outside relay. Each relay named answers `not-sent`, saying why, as assistant-profile ADR 0002 and dlist-curation ADR 0004 send nothing out in that mode.
  - Each named relay gets one connection a call, through `_relay.js`'s `open()`, whose answer gains `relay`: the connected relay, its `send` wrapped. Export's own `_send.js` calls `relay.publish`, never `_relay.js` (Decision 11).
  - Up to 8 letters at a time wait for their `OK`, each for up to 5 s.
  - Each letter gets one of honest-publish-reporting ADR 0001's four classes:
    - `accepted`: `OK true`, a `duplicate:` reason included;
    - `refused`: `OK false`, with the relay's reason;
    - `timeout`: no `OK` in time;
    - `unreachable`: no connection, or it closed.
- **An `unchanged` letter** is sent as it was signed, read back from the instance's own relay, to each relay named in the call that isn't in its node's `sentTo` (Decision 8). Each relay that already has it answers `held`.
- **Time.** A call has 40 s, as import has, inside nginx's 60 s (story fact 13). No send starts after 30 s. Letters not sent by then answer `not-sent`, and `next.after` names the last node finished.

**7. Links** (`src/lib/markdownLinks.js`: graph-rules/0002's one helper, which renderers and the dead-link check will share). It uses micromark 4, loaded with `import()` and pinned in `package.json` (Context 8).
- **What it finds:** inline links, images, autolinks, and reference definitions with the references that use them. It never finds one inside a code span or code block.
- **How it rewrites:** at micromark's exact offsets, changing nothing else in the text. Only a destination that starts with `tapestry:` is touched.
- **When the key's node has a letter, or gets one in this call** (or would, in a dry run), the destination becomes `nostr:naddr1…` for its address, or `nostr:nevent1…` when its address is an event id. These are encoded with nostr-tools' `nip19`, with no relay hints (graph-rules/0002, Out of scope). A node has a letter when it holds an `id`, whoever signed it.
- **Otherwise the link is dropped and reported:**
  - an inline link becomes its text, and an image its alt text;
  - a reference becomes its text, and its definition is taken out;
  - an autolink, which has no text, becomes the target's name, or is taken out when no node has the key.

**8. The record** (AC1; `src/operations/catalog/export/_record.js`). A call that sent a letter ends with one write transaction.
- **On each node whose letter the instance's own relay accepted:**
  - its `id` and `created_at` become the letter's, so the node has a letter (`hasLetter`), and a graph write that changes it answers `letterOutOfDate`;
  - its `sentTo` lists the relays holding that letter: `own` for the instance's own, and each other by URL. A letter re-sent unchanged adds the relays that accepted it.
  - The node is set only while its `id` is still the one the call read. Otherwise it is left as it is, and its change says `raced`.
  - Nothing else on the node changes: not its tags, labels or relationships, and the `NostrEvent` label isn't added (D7).
- **One change entry,** with operation `export nostr`:
  - a `letter-sent` change for each letter sent: `node`, `address`, `kind`, `was` (the `{ id, created_at }` it replaced, or null), `now` (its own), and `relays`, each relay's answer as `{ relay, status, reason }`;
  - `nodes`, every node whose letter was sent.

  `graph history` finds the entry by each node.
- **What reads the record.**
  - `sentTo` is how a later call tells which relays hold a letter.
  - The entries are the history status and retract (A10.34.a) read: every version's id, which the DList relay needs, since it honors only `e` deletions (story fact 14).
  - A node graph delete-node took out keeps its letter's `id`, `created_at` and `sentTo` among the properties its deletion entry keeps (Context 11).
- A dry run, and a call that sent nothing, record nothing.

**9. Reports** (AC2, AC3, AC5). The answer's `reports` come before its `letters`, in a dry run as in a call:
- `link-dropped`: the node, where the link was, and the key it named;
- `value-left-out`: a whole `tapestry:` value with no letter, by node and path;
- `pointer-unresolved`: an `lmdb:` value the store doesn't hold;
- `unsent-reference`: a tag or a graph list naming an own node that has no letter and isn't sent in this call. The letter still names it (open question 3);
- `uncarried-relationship`: a relationship that no letter of the call carries. It is of a type `structureTypes` allows, between two nodes the call sends. "Carries" means one of:
  - a `z`, which import nostr wires from the concept's superset;
  - an `n` or `s` within the assistant's graph;
  - a relationship letter the call sends;
  - a graph's `graph.relationships` the call sends.

  enumerate's `ENUMERATES`, add-relationship's links, and today's set memberships whose relationship letters aren't in the scope are reported this way. Nothing is made up to carry them;
- `not-found`: an address or id a graph lists that no node holds.

**10. Its letters never come back over their nodes** (AC6). Import nostr already answers `own` and writes nothing (Context 2). `src/operations/catalog/export/_own.js` gives the other two importers one test, `holdsLetterOrNewer(read, event)`. It lives with export, since keeping its letters from coming back is export's promise, and it needs `factsOf`. It reads the node at the letter's address with `factsOf`. It answers yes when the node is the instance's own and holds that letter, or a newer one by NIP-01's order: a later `created_at`, or on a tie the lower id.
- `handleEventUpdate` checks it before deleting any tag, and answers `{ success: true, unchanged: true }` with the reason.
- The I/O import's first phase checks it after `writeToStrfry` and before `buildImportCypher`, and answers that item `skipped` with the reason. Storing the older version in strfry changes nothing there.
- The client-publish route's brain-write hook (`maybeBrainWriteTapestry`) checks it before `importEventDirect` (Context 9). A Tapestry letter the node already holds, posted again, is imported no more. A newer one, such as an edit in the Tapestries UI, is imported as today.

So none of these four paths can put a letter export sent back over its node, which keeps its tags, links, JSON and letter.

**11. The publisher, and ADR 0004.** Export nostr is another server-side publisher, beside dlist-curation's and assistant-profile's `publishToRelays`. RE1 doesn't catch the second (assistant-profile ADR 0002), because it sends with `ws`, not `SimplePool`. dlist-curation ADR 0004 says: "Any second server-side publisher needs its own ADR and its own exclusion." This is that ADR.
- **Why community-reference ADR 0004's browser path can't serve.** That path re-sends, from the owner's browser, letters the server already signed. Export can't use it:
  - agents call export with no browser (D14);
  - ADR 0043's signing step runs inside the install;
  - each relay's answer has to come back to the operation's caller (AC1).
- **Who sends a release** (ADR 0043 Decision 8, built in A10.34.b): this sender, run on the firmware instance, signing as that instance's assistant, whose key only that instance's server holds (BIBLE §31).
- **The exclusion.** ADR 0004's RE1 test scans `src/api/` alone, for `SimplePool` with `.publish(` (story fact 9). At Test Design it widens in two ways: it scans `src/operations/` too, and it catches nostr-tools' `AbstractRelay` and `Relay` beside `SimplePool`. `src/operations/catalog/export/` is excluded beside `src/api/dlist-curation/`. Export's `publish` call sits in its own `_send.js`, never in import's `_relay.js` (Decision 6), so the exclusion covers it, and a third publisher built the same way elsewhere is caught.
- **ADR 0004's header** gains an "Amended by" line naming this ADR, as dlist-curation ADR 0004 added one.
- **Where concept letters go.** ADR 0004's Revision 1 sends them only to the DList relay. Here the caller names the relays, and the instance's own relay is always among them.

**12. Two exports at once, and an export beside a graph write.** Export reads without locking. A graph write between its read and its record is picked up by the next export as `changed`, since Decision 8 records the letter it built. Two exports of one node both sign. The record keeps whichever holds the `id` it read (Decision 8), and the next export compares against that one.

### Story amendments (approved with this ADR, 2026-11-20)

The owner approved this ADR as drafted, with the seven together.

1. **AC2: `z`, `n` and `wordTypes` as the node holds them; `s` from its parents.** The story has them all come "from its relationships now". Measured, that would add ancestor concepts' `z` to 209 of 535 own letters and drop 10 kept by convention (Context 3). `s` comes from the parent links, as memo #114 asks. The rest come from the node, kept by the writes that change memberships. A set moved across concepts leaves its elements' `z` and `wordTypes` behind. That has a ledger row.
2. **AC2: the round trip, as import nostr records it.** "The same relationships" becomes: every relationship among the nodes sent, of a type a letter carries, is in the importing graph. The importing graph may also hold a superset's `HAS_ELEMENT` to an element the exporting graph reaches through a set, since import's `z` wiring doesn't prune (Context 2).
3. **AC2: the `json` from the stored JSON.** AC2 says "made from its tapestryJson", as ADR 0020a does. tapestryJson's cached copy can lag the stored JSON it is derived from (Context 5). So the letter's `json` is the stored JSON, less `graphContext` (Decision 4.5).
4. **AC1 and AC4: more outcomes.**
   - for a node: `other-kind` and `no-address` (Decision 3), and `unbuildable` (Decision 4.5);
   - for a relay, beside the four classes: `held`, `not-sent` and `unread` (Decision 6).
5. **AC5: order and paging.** Each letter goes after the call's letters it names, except where a cycle stops it, which rank breaks. "Says where the next call goes on" is `next.after`, a cursor, with the caps of Decision 2.
6. **AC1 and AC7: the graph test, and more refusals.** A graph element is one the graph concept's class thread reaches, or one whose stored JSON holds a `graph` object (Decision 1). `too-many-relays` and `bad-cursor` are new. AC7's unreadable assistant key is named `no-assistant-key` (409).
7. **AC6: four paths, and their replies.** Beside import nostr, event-update answers `unchanged`, and the I/O import answers `skipped`, for a letter the node holds or one older than it. The client-publish route's brain-write hook no longer imports such a Tapestry letter (Decision 10).

## Consequences

- **What it enables.**
  - A concept, a Tapestry or a selection made with the graph operations can be published.
  - ADR 0043's signing step is an `export nostr` call with the installed-firmware graph as `graph` and no relays named.
  - Status, retract and releases (A10.34.a and A10.34.b) build on its record and its sender.
- **The first export re-signs some letters once.** These are letters whose `s` tags differ from their parents (36 of 71 sets and supersets on the local instance, Context 4), elements without their stamps, and letters today's routes sent with `tapestry:` links. After that they answer `unchanged`.
- **event-update can no longer put a node's own letter back over it.** A node a graph write changed keeps the change, where today a re-import undoes it (ADR 0016).
- **Exporting everything isn't a backup** (BIBLE §30): relationships no letter carries are reported, not sent.
- **A new dependency,** micromark 4 and the micromark packages it brings. It is a runtime library, not lint, typecheck or build tooling, so CLAUDE.md's rule against new tooling isn't touched.
- **Debt.**
  - A set moved across concepts leaves its elements' `z` and `wordTypes` behind. A ledger row records it, for a later story that keeps them in step.
  - The graph writes make no relationship letter for what no tag carries: enumerate's and add-relationship's. They are reported, and giving those writes relationship nodes, as today's routes sign relationship letters, is a story of its own.
  - Today's set memberships carried only by relationship letters come into a concept's scope only when a graph lists those letters or the scope is `everything`, since no index finds a letter by a tag's value (ADR 0028, Context 8; Loom A10.32.c).
  - The derive step's stale start (Context 5) stays the cache's to fix (A10.36).
- **Firmware reinstall required?** No: no concept definition changes.

## Implementation notes

- **New files:**
  - `src/operations/catalog/export/nostr.js` (the declaration and the call's flow);
  - `_scope.js` (Decision 2), `_letters.js` (Decisions 3–5 and 9), `_send.js` (Decision 6) and `_record.js` (Decision 8);
  - `src/lib/markdownLinks.js`, with `findLinks(text)` and `rewriteLinks(text, decide)`, where `decide(destination)` answers `{ to }`, `{ drop: true }` or `null`. It walks micromark's events, using `parse`, `preprocess` and `postprocess` from `micromark`: `link`, `image`, `labelText`, `resourceDestinationString`, `autolink`, `definition`, `definitionDestinationString` and `reference`, with each token's `start.offset` and `end.offset`;
  - `src/operations/catalog/export/_own.js` (Decision 10), which the loader skips like every `_` file.
- **Changed files:**
  - `src/operations/catalog/import/_relay.js`: the connection `open()` answers also gives `relay`, the connected relay, its `send` already wrapped. Export's `_send.js` checks `relay.connected` before each `relay.publish`, as `request` does. nostr-tools 2.10 sends without awaiting, so a send on a closed connection is an unhandled rejection that ends the control panel on Node 22 (story 32's review, blocking 1). nostr-tools already rejects every open publish when the socket closes (Context 7);
  - `src/operations/changes.js`: `CHANGE` documents `letter-sent` and its `address`, `kind` and `relays`;
  - `src/api/strfry/tapestryBrainWrite.js`, for Decision 10's fourth path;
  - `src/api/neo4j/eventSync.js` (`handleEventUpdate`) and `src/api/io.js` (phase 1), for Decision 10;
  - `package.json` and `package-lock.json`: `micromark` 4, at an exact version.
- **Seams for the suites,** each read through its module's exported object as `_relay.js`'s `connect` is: `_send.js`'s `strfryImport(lines)` and its reader, `_relay.js`'s `connect` (relayFake publishes), and the clock.
  - The round trip of AC2 runs import nostr's recorder against `test/helpers/cypherEngine.js` on the letters a call sent to relayFake.
  - RE1's widening (Decision 11) and every suite are Test Design's.
- **Docs, at Implementation:**
  - catalog §6 (the row, its answer, and §10 questions 2 and 9 answered);
  - the design doc §5, questions 2 and 4 (the "sent as" record and export's details settled);
  - BIBLE §6 (what an exported node holds: `id`, `created_at`, `sentTo`), §11 (the route), and §29's paragraph on `tapestry:` links (`BIBLE.md:1974`, written with story 19), which gains what export does with them;
  - `clients/cli/skill/SKILL.md:9`;
  - community-reference ADR 0004's header;
  - a ledger row for amendment 1's debt.
- **The live check, on a scratch stack:** the uniqueness rules and `lifecycle migrate --migration tapestry-keys` first, as story 32's check needed. Then AC7's agent run, with the outside relay the owner chooses.

## Out of scope

- **`export status` and `export retract`** (A10.34.a), and **making a release** (A10.34.b).
- **Seed-firmware's call of the signing step** (A10.37).
- **copy-node** (A10.24) and **export file** (A10.35).
- **Moving today's importers onto import nostr's recorder** (memo #137), beyond Decision 10.
- **Relationship letters for relationships no letter carries.**
- **Relay hints, NIP-42 AUTH and NIP-65 relay lists.**
- **Any change to today's signing routes or UI.**

## Amendment 1 (2026-11-20, at Test Design; approved by the owner with the test plan)

Writing the tests raised six points the decisions left open. Each is settled here. None changes a story criterion.

1. **Decision 9: which uncarried relationships are reported.** `uncarried-relationship` covers a relationship of any type between two nodes the call sends that no letter of the call carries. The only types excluded are the `nostr` category's (`HAS_TAG`, `AUTHORS`, `REFERENCES`), which a letter's tags make themselves. The earlier "of a type `structureTypes` allows" left out every type graph add-relationship makes. add-relationship refuses firmware's types and makes declared types such as `CITES`, which import nostr's `structureTypes` never allows, so no letter carries them either. Decision 9's own list and AC2 already report those (test EL7).
2. **Decision 1: `relays` is zero to ten.** The input is a list of strings with no length bound in its schema. Left out or empty, the letters go to the instance's own relay only, which is what ADR 0043's signing step sends. More than ten is refused `too-many-relays` in `run`, so the refusal names it and isn't the built-in invalid-input answer (test EN12).
3. **Decision 1: a key no node has is `unknown-ref`.** `resolveOne` passes a tapestryKey through unread, so export reads the node, and refuses `unknown-ref` (404) when none has that key, as AC7 says (test EN7).
4. **Decision 3: one class, in this order.** A node takes the first that fits:
   - `no-address`;
   - then its author, or, when it records none, the key its address carries: the owner's makes it `owner-signed`, and any key but the assistant's makes it `not-own`;
   - then `other-kind`, a kind other than 39998 or 39999.

   Only a node none of these fits is signed. So another author's node of another kind is `not-own`, and an author-less node whose address carries another key is `not-own` too.
5. **The answer's fields** (AC1, AC5), so the Implementer has one target:
   - `dryRun`;
   - `relays`: `own`, then each relay named, by URL;
   - `reports`: each `{ report, node, words }`, plus what it names: `key`, `where`, `address`, or `type`, `from` and `to`;
   - `letters`: each `{ node, address, name, outcome, sent, id, kind, created_at, relays: [{ relay, status, reason }] }`, with `added` and `removed` on a changed one in a dry run;
   - `counts`: by outcome;
   - `next`: `{ after }`, or null;
   - `change`: the entry, or null.

   The suites read these through tolerant accessors (`exportFixtures.js`), so a field the code names otherwise fails no test, but these are the names.
6. **Decision 8: when a call writes an entry, and Decision 6's cutoff.**
   - A call writes its change entry when some relay accepted some letter. That includes an unchanged letter re-sent to a relay that hadn't had it, recorded with `was` equal to `now`.
   - A call in which no relay accepted anything records nothing. Its letters were signed, but exist nowhere.
   - `SEND_CUTOFF_MS` bounds the sends to outside relays. The one `strfry import` into the instance's own relay runs before them, and isn't cut.

## Amendment 2 (2026-11-21, at Review; approved by the owner, "Yes, as recommended")

Review round 1 (`engineering-team/reviews/graph-operations-first-slice/34-export-nostr.md`) found what follows. The story's "Changed at Review" list is the same, as it reaches the criteria.

1. **Decisions 8 and 10: the record locks, keeps the newest, and remembers what it couldn't confirm** (finding 3).
   - The record's transaction takes each node's write lock before it reads the node's `id`, as the graph writes' `lockNode` does, so two records of one node go one after the other.
   - Of the letters export sent for a node, the node keeps the newest, by NIP-01's order: the later `created_at`, or on a tie the lower id. A record that finds the node already holding a newer letter export sent leaves it, and its change says `raced`.
   - A letter whose read-back didn't answer (`unread`) may be on the instance's own relay. So it is recorded in the call's change entry, with each relay's answer, though not on the node. Amendment 1's item 6 becomes: a call writes its entry when some relay accepted a letter or a letter is `unread`; a call whose every letter was refused, unreachable or not sent records nothing.
   - `holdsLetterOrNewer` also answers yes for any letter whose id an `export nostr` entry records for that node, newer or not. A letter export sent never comes back over its node, whatever the node records.
2. **Decision 2: order by kind first** (finding 4). Letters go out by rank:
   - concept headers;
   - supersets;
   - sets, parents first;
   - then the rest.

   Within a rank, each goes after the letters of that rank it names, and a cycle within a rank goes by tapestryKey. So a header goes before its core nodes and elements, as AC5 has it, and a graph still goes after the nodes it lists.
3. **Decision 9: a graph not followed is reported** (finding 6). A graph past the fourth level of imports, or past the 50th, is sent as it is, its lists unfollowed. It is reported `graph-not-followed`, naming it and why.
4. **Decision 9: a `b` tag carries a relationship** (finding 13). Its `INHERITS_FROM`, which import nostr wires from it, is a relationship a letter carries.
5. **Decision 6: `strfry import` within the call's time** (finding 7). The import is given the call's remaining time, never more than 30 s. A hung import is stopped then, and the read-back decides each letter's answer.
6. **Decision 11: the guard test catches a publisher built export's way** (blocking finding 1). RE1 flags any file outside the excluded folders that calls `.publish(` on a relay. That means one it makes with `SimplePool`, `AbstractRelay` or `Relay`, or one it gets from import's `_relay.js`. "The second server-side publisher" reads "another server-side publisher" wherever it was written (finding 9), since assistant-profile's came first.
7. **AC7's live run: the stack's own relay only** (blocking finding 2). The scratch-stack run sends to the stack's own relay. Sending to outside relays is covered stack-free (ES3, ES16). The first real export to an outside relay is recorded in the story when it happens. The private-relay refusal is run by hand on the stack.
