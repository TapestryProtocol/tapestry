# Story 34: `export nostr` — publish a scope as signed letters, and record what was sent

**Status:** Done
**Created:** 2026-11-20
**Type:** Feature
**Loom:** A10.34 — https://loom.brainstorm.world/t/A10.34

## Background

Loom's A10.34 asks for three operations of the export group (catalog §6):

- **`export nostr`:** "Publish a scope as signed events, and record what was sent", taking "`scope`, `relays?`, `dryRun?`" and answering "the letters published; a dry run lists the letters it would publish, as new, changed or unchanged since last sent". It "signs only nodes you assert, and refers to someone else's node by its address without re-signing it (D8)", and "reports references to nodes with no nostr address yet (design doc §5, question 4)".
- **`export status`:** "which nodes in a scope were sent where, and whether each copy is still current".
- **`export retract`:** "ask relays to delete the letters you published for a scope (NIP-09)", retracting "only letters your keys signed".

Done, for Loom, is when "each is declared once; answers at `/api/tapestry/export/<operation>` for the owner and admins, unless the catalog's §10 question 2 narrows who may sign; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI."

This story is `export nostr`. `export status` and `export retract` follow as a subtask of A10.34, with a story of their own (open question 1, resolved).

**Why now.** Nothing the graph operations make has a letter: a concept made with `graph create-concept`, an element made with `graph create-element` and a set made with `graph create-set` stay private thoughts until something publishes them (BIBLE §30). The glossary on david.tapestry.ninja is written that way. And ADR graph-operations-first-slice/0043 (accepted 2026-11-20, from P-160) gives export nostr two jobs on the way to firmware that installs by import:
- **the install's signing step.** Seed-firmware (A10.37) writes the firmware as the instance's own nodes, unsigned, and lists them in an installed-firmware graph. Export nostr, "with the installed-firmware graph as its scope (D12) and the instance's own relay as its destination", then "signs only the letters that are new or changed since they were last sent", so a reinstall with no change signs nothing. It "makes the letter's `b` tag from the header node" (Decision 1).
- **making a release** (Decisions 4 and 8): a release element and its members, at addresses that name the release. "A10.34's ADR says which publisher sends a release, and how that squares with ADR 0004." The release's exact form is the release convention's (Decision 4). That draft isn't written yet, so this story leaves the release itself out (Out of scope) and its ADR answers the publisher question.

The book's frame names "publishing to nostr (the second priority)" as outside it. The owner has asked for it now, and it is numbered here by its Loom task, as story 32 is.

The design it follows (docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md):
- **D1.** Writes never sign. Export is the publisher for the nostr transport: outside data going out.
- **D2.** "The node first, the letter on purpose." A caller combines operations: create, then publish.
- **D8.** Publishing someone else's node gives the owner a node of their own: that is `graph copy-node` (A10.24). Export refers to someone else's node by its address and never re-signs it.
- **D10.** Every fact in a node's JSON is also stored in the graph. Edges are the authority on which concepts a node belongs to, and the JSON's `wordTypes` are computed from them.
- **D12.** Every exporter takes the same scope: a node, a graph, or everything. A graph is an element of the `graph` concept: a concept's concept graph, a Tapestry, or a selection saved as a graph with `graph create-element`. An export resolves its scope, adds or reports the unpublished nodes its letters refer to, orders the letters, applies D8 node by node, offers a dry run, and records "sent as" for each letter.
- **BIBLE §30 and §31.** A letter is derivable from the self, not the self, and exporting everything isn't a backup. The assistant's key is the instance's "me" and lives on the server. The owner's key is cold and never held server-side.

Decisions already made for export nostr:
- **ADR graph-rules/0002, Decision 3** (memo #133). Before export signs a letter, it rewrites each `tapestry:` link in the letter's strings to `nostr:naddr1…` when the target has a letter (one signed before, or one this export sends), or to `nostr:nevent1…` when the target's address is an event id. Otherwise the link is dropped, its text kept, and the export reports it, listing such links first in a dry run. The rewrite changes the letter, never the graph, "so the letter must never come back over the node". How an importer tells such a letter apart "is A10.34's to settle". Links are found with a CommonMark parser, not a pattern.
- **ADR 0019, Decision 14** (memo #136). An enumerated field's whole value `tapestry:<tapestryKey>` is rewritten the same way. How such a value travels in a letter is K5.1's to decide (K5.1 is still proposed, with no ADR).
- **ADR 0020a.** "Publishing builds a letter's `json` from tapestryJson, and strips what is local: `graphContext` at least. What else, is A10.34's."
- **ADR 0020.** A concept's `b` pointers to shared concepts give its elements a `z` stamp for each, and "`export nostr` (A10.34) is the deliberate publish, so it adds them when it builds the letter".
- **ADR 0027.** `setJson` and `setTags` build a set's letter, "which export (A10.34) can reuse".
- **ADR 0028, debt 2** (memo #114; ledger row `2026-11-16-would-be-s-tags-go-stale`). Export takes a set's parents from `(parent)-[:IS_A_SUPERSET_OF]->(set)`, never from its would-be `s` tag.
- **ADR 0032, AC6.** Import nostr never changes the instance's own nodes. A letter at one of their addresses answers `own`, and "a 'sent as' record is export nostr's".

Fourteen facts about today's code shape the story. They are from reading the code on staging `79c8a098` (2026-11-20). Nothing was run.

1. **The export group is declared and empty** (`src/operations/groups.js:14`; no `src/operations/catalog/export/`). Nothing records where a node was sent: no property, label or LMDB field does (catalog §6, "Nothing takes a scope or records what was sent"). The design doc's "sent as" record (transport, address, signing key, time, the version of the node it carried) is proposed, and its form is open (design §5, question 2; BIBLE §30, "no provenance marking exists").
2. **What a node with no letter holds.** `makeNode` writes the address its letter would have (`uuid`), its kind (39998 or 39999), the assistant's pubkey as its would-be author, its name, tapestryValue and `created_at`, and a tag node for each would-be tag. It writes no `id` and no `NostrEvent` label (`src/operations/catalog/graph/_eventless.js:59-74`). A tag node keeps `type`, `value`, `value1` and `value2` only, with no index (`:31-39`), so a letter rebuilt from tag nodes can't recover their order or any element past the fourth. Today's re-signing routes order them by uuid (`src/api/normalize/index.js:64`). A node "has a letter" when it holds an event `id` (`_nodes.js:99`).
3. **The would-be tags go stale.**
   - `graph link-set` and `unlink-set` change a set's parents and leave its `s` tags, and the `z` and `n` tags and `wordTypes` of the elements below it (memo #114).
   - `graph update-node` rewrites only the `name` and `json` tags (`update-node.js:302-313`). `graph update-concept` rewrites only the concept's eight nodes, so its elements' word blocks keep the old name.
   - `graph enumerate`, `mark-field` and `add-relationship` make edges that no tag records (`enumerate.js:116-121`, `add-relationship.js:48-54`). Today's enumerate route signs a relationship letter for the same link (`src/api/normalize/index.js:4235-4243`).
   - `graph delete-node` takes out only the node's own tags. Other nodes' tags and graph lists that name it stay (`delete-node.js:263-272`).
4. **A signed node that a graph write changed** keeps its old event's `id` and `created_at`, which then name a letter whose tags no longer match the node. Nothing stored marks this. The writes answer `letterOutOfDate`, "until export nostr (A10.34) sends a new one" (`update-node.js:122`, and the same in update-concept, add-to-concept, move-element and the property writes). No importer stores a letter's signature (`src/api/normalize/index.js:173-186`, `src/api/neo4j/eventSync.js:215`, `src/operations/catalog/import/_letters.js:283`), so a signed letter is kept only in strfry.
5. **A node's JSON.** A letter's JSON is its `json` tag, inline or as `lmdb:<tapestryKey>`. The derived tapestryJson in the LMDB adds the owner's sections and the local `graphContext` (`src/lib/derivers/word.js:52-132`), and no write refreshes it (`update-node.js:325`).
6. **The letters today's routes sign.**
   - A concept header: `d`, `names`, `slug`, `concept-graph`, `json`, an optional `description`, and the tags firmware declares for it (`src/api/normalize/index.js:1284-1309`).
   - A core node: `d`, `name`, `z`, `description` and `json` (`:1347-1356`). The graph operations' core nodes add an `o` tag (`_concepts.js:361`).
   - An element: `d`, `name`, `z` (with the shared-concept stamps) and `json` (`:1898-1903`).
   - A set: `d`, `name`, `z`, `s` and an optional `description`, with no `json` (`:4397-4408`). `graph create-set` gives its sets a `json` (`_sets.js:503-506`).
   - A relationship letter: kind 39999 at a random d-tag, with `name`, `z` (the relationship concept), `nodeFrom`, `nodeTo` and `relationshipType` (`:4416-4426`). `graph create-set` makes none (ADR 0027).
7. **What a graph lists.** A graph element names its nodes by slug and nostr address, never by tapestryKey: `nodes`, `relationshipTypes`, `relationships` by slug, and `imports` (`firmware/versions/v1.0.0/concepts/graph/json-schema.json`). A concept graph lists its header and superset, and imports its property tree graph and core nodes graph. No graph lists the class thread's sets and elements (`_concepts.js:291-345`; story 32, fact 8). Today's concept export, the owner-only `GET /api/concept/:handle/export-set`, gathers the header, the class thread to six levels and the core nodes, and keeps only letters the assistant signed. The owner's browser then sends them to the DList relay only (`src/api/concept/exportSet.js:10-66`; community-reference ADR 0004 and its Revision 1).
8. **Who can sign as the assistant today.**
   - Admins can sign through the normalize routes, firmware install and trusted-list publish. Each is open to "the owner's side: the owner, admins and direct-local callers" (`src/middleware/routeAccess.js:12, 293-333`).
   - `POST /api/strfry/publish` with `signAs: 'assistant'` signs content the caller writes, and is the owner's alone (`src/api/strfry/commands/publishEvent.js:28-36`). That is ADR security-auth-exposure/0005, owner's decision 3. "Every other flagged action stays `owner` (admins equal the owner)."
   - `lifecycle backup` and `download-backup` are open to admins (`src/operations/catalog/lifecycle/backup.js:13`, `download-backup.js:16`), and "Anyone with the file can sign as the instance" (ADR graph-operations-foundation/0002).
   - The owner's key is never on the server (BIBLE §31), so the server signs only as the assistant. A node the owner signed counts as the instance's own in the reads (`src/operations/reads.js:146-150, 215`), but its address carries the owner's pubkey, and the assistant can't sign a new version of it.
9. **Sending today.** Every server path puts a letter into the local strfry with `strfry import` on stdin. That exits 0 even when strfry refuses the event (`publishEvent.js:88-93`), so newer code reads each one back by id (`src/api/dlist-curation/update.js:310-326`). Three senders reach outside relays from the server:
   - assistant-profile's `publishToRelays`, which classes each relay as `accepted`, `refused`, `unreachable` or `timeout` within 8 s (`src/api/assistant/profilePublish.js:120-199`), as honest-publish-reporting ADR 0001 has the browser do;
   - dlist-curation's header publish;
   - its batch signer, `update.js`.

   Community-reference ADR 0004 rejected a server-side publisher as "not justified yet". dlist-curation ADR 0004 lifted that for `src/api/dlist-curation/` only: "Any second server-side publisher needs its own ADR and its own exclusion." ADR 0004's RE1 test scans `src/api/` only (`test/publish-export-a-concept.test.js:63, 113-138`).
10. **The router.** Every preset ships off (`setup/router-presets.json`). When it is on, `dcosl` copies kinds 9998, 9999, 39998 and 39999 both ways between the local relay and the DList relays (`:2-14`), so a letter put into the local relay then goes out to them as well. The instance's own relay can be read from outside: nginx serves it at `/relay` (`docker/nginx.conf:78`), and story 32's live check imported from `wss://david.tapestry.ninja/relay`.
11. **Re-importing a letter replaces its node's tags.** `importEventDirect` and `POST /api/neo4j/event-update` delete a node's tags and make them again from the letter (`src/api/normalize/index.js:188-209`; `src/api/neo4j/eventSync.js:365-374`). That undoes graph edits, and would put a rewritten letter's links over the node's `tapestry:` links. Import nostr answers `own` and writes nothing (`_letters.js:495-497`). Moving today's importers onto import nostr's recorder is a follow-up of story 32 (memo #137, item 2; ledger row `2026-11-20-todays-importers-keep-their-faults`).
12. **Links and whole values.** No code parses markdown, and no markdown or CommonMark parser is a dependency (root, `ui/` and `clients/cli/` package files). A whole value `tapestry:<tapestryKey>` is matched in `_enumerations.js:40` and held inside the element's `json` tag. No server code encodes an `naddr` or an `nevent`, though nostr-tools 2.10.4's `nip19` can.
13. **Limits.**
    - nginx gives an export route its default 60 s (`docker/nginx.conf:43-49, 67`).
    - strfry takes an event of up to 1 MiB, but a websocket message of at most 128 KiB (`docker/entrypoint.sh:89-98`; ADR 0043, Consequences).
    - A 1,024-byte cap on a tag value was seen for a `b` tag (list-headers-disposition ADR 0004). Whether it reaches a `json` tag isn't confirmed.
14. **For retract, later.**
    - `composeDeletion` builds a kind 5 for the assistant (`src/api/dlist-curation/updateEvents.js:78-101`).
    - The local strfry (1.1.0) honors a deletion's `e` and `a` tags and refuses a re-send of what it deleted. The DList relay (1.0.4) honors only `e` (curated-dlist-update ADR 0006 §10; ledger row `2026-09-27-revokes-do-not-travel`).
    - `graph delete-node` already tells its caller that the deleted node's letter "stays wherever it was sent" and that `export retract` "takes a letter back" (ADR 0026), and ADR 0028 makes retract where today's stale relationship letters are reconciled.

## User-facing description

As the owner or an admin agent, I want to publish one node, a graph (a concept, a Tapestry, or a selection I saved as a graph) or everything of my own as signed letters, to my instance's relay and any relays I name, so that what my graph says now can be read and imported elsewhere. My private `tapestry:` links should be rewritten or reported, someone else's nodes named by their address and never signed as mine, and only what is new or changed signed again.

As the same owner, I want to see before I send what would go out and what can't be named, and I want my graph to stay as I made it, even when the letters I sent come back in.

## Acceptance criteria

- [ ] **AC1 — Publish a scope.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/export/nostr` with `scope` and `relays`, then each node in the scope that the assistant signs (AC4) gets one letter, signed with the assistant's key and sent to the instance's own relay and to each relay named. The scope takes one of three forms:
  - **a node:** its tapestryKey, or a ref `graph resolve` reads;
  - **a graph:** a graph element, an element of `39998:<TA>:graph`, named the same way: one that concept's class thread reaches, or one whose stored JSON holds a `graph` object (as amended at Architecture). That is a concept graph, a Tapestry, or a selection saved with `graph create-element`, with what its lists name and the graphs it imports, each the same way, four levels and 50 graphs at most. A graph past them is sent with its lists unfollowed and reported `graph-not-followed` (as amended at Review). A concept graph also brings its concept's class thread and core nodes, as today's export-set gathers them (fact 7);
  - **everything:** every node of the instance's own.

  `relays` holds zero or more `wss://` or `ws://` relays. The instance's own relay is always sent to.

  The answer gives, for each node in the scope:
  - its tapestryKey and address;
  - its outcome: `new` (the node has no letter yet), `changed` (the letter it would sign differs from the one the node has), `unchanged` (the same), `not-own` (another author's), `owner-signed` (the owner's own letter, which the assistant can't sign), `other-kind` (a kind other than 39998 and 39999), `no-address` (a node with no address), or `unbuildable` (its JSON points into the store at nothing). The last three were added at Architecture;
  - the letter's id and kind;
  - for each relay, what that relay did with the letter: `accepted`, `refused` with the relay's words, `unreachable` or `timeout`, the four classes of honest-publish-reporting ADR 0001. Three more were added at Architecture: `held` (it has the letter already), `not-sent` (the instance's own relay didn't store it, or the instance publishes locally only) and `unread` (the instance's own relay couldn't be read back).

  It also gives the counts of each.

  It records each letter it sent: the node, the letter's id, address and kind, the key that signed it, when, and each relay's answer. Later calls read that record to tell new, changed and unchanged apart, and export status and retract will read it (open question 1). The node then has a letter: a graph write that changes it answers `letterOutOfDate`, and a later export's link to it becomes its `naddr`. Its change entry records who exported and the nodes whose letters it sent, and `graph history` finds it by each of them. The node's names, JSON, tags and relationships don't change.
- [ ] **AC2 — A letter says what the graph says now** (D2, D10, memo #114, ADR 0020a, ADR 0043). The letter export signs for a node is made from the node as the graph holds it at the call, never from a letter or tag left behind:
  - its kind and its address, which never changes, so a node with no letter gets the address its write gave it;
  - its names, slug and description;
  - its JSON: its stored JSON, which its tapestryJson is derived from, without what is local to this instance (`graphContext` at least), and with `wordTypes` as the JSON holds it (as amended at Architecture);
  - the concepts and sets it belongs to (`z`, `n`), as the writes that change a membership keep them on the node; and a set's or superset's parents (`s`), from its parent links now (fact 3; as amended at Architecture);
  - for a concept header with a community reference, its pointer `b` from the header node; for an element, a `z` stamp for each shared concept its concept's `b` pointers name (ADR 0020);
  - the other tags its node holds, as today's routes write them (fact 6), so that today's readers read it as they read a letter those routes signed.

  So when import nostr records the letters of one call into an empty graph, it gets one node at each address, with the names the exporting graph gives it and its JSON less what is local. It also gets every relationship between those nodes that a letter carries: the class thread, the core-node wiring, the property tree and relationship letters. It may hold one more: a superset's `HAS_ELEMENT` to an element the exporting graph reaches through a set, since import nostr's `z` wiring doesn't prune (as amended at Architecture). Exporting a concept made with the graph operations, then importing it, gives the concept back whole. A relationship among the nodes sent that no letter can carry is reported, with its type and its two nodes, and nothing is invented to carry it.
- [ ] **AC3 — Links, whole values and references it can't name** (graph-rules/0002 Decision 3; memo #136; design §5, question 4). Before a letter is signed, each `tapestry:` link in any string it carries, in its tags and inside its JSON, is found with a CommonMark parser. Links in code spans and code blocks are left as they are, and reference definitions are found too. Each link becomes:
  - `nostr:naddr1…` for its target's address, with the same text, when the target has a letter, or gets one in this call;
  - `nostr:nevent1…` when the target's address is an event's id;
  - otherwise its text alone, reported with the node that holds it and the key it named.

  A string whose whole value is `tapestry:<tapestryKey>` (ADR 0019) is rewritten the same way. When its target has no letter, the value is left out of the letter and reported. A tag that names one of the instance's own nodes that has no letter and isn't in the call is reported, and its letter is still sent (open question 3).

  No letter it sends carries `tapestry:`. The graph never changes: the node keeps its `tapestry:` links and values, so a later export rewrites whichever have letters by then.
- [ ] **AC4 — Whose nodes it signs** (D8; catalog §10, question 9; BIBLE §31). It signs only nodes whose letter is the assistant's to sign: those whose author is the instance's assistant, and those made here with no letter, whose would-be author is the assistant (fact 2).
  - A node another author signed, an admin's included, is `not-own`. It is never signed or sent, and the letters that name it name it by its address.
  - A node the owner signed is `owner-signed`. It is treated the same way, since only the owner's own signer can sign its next version (fact 8).
  - Person nodes, tag nodes, placeholders and change entries are never letters, and no scope counts them.
- [ ] **AC5 — In order, with a dry run, and safe to repeat.**
  - Letters go out by kind of node first: concept headers, then supersets, then sets, parents first, then the rest. So a concept's header goes before its core nodes and elements. Within a kind, each goes after the call's letters of that kind it names (as amended at Review).
  - `dryRun: true` signs, sends and records nothing, and answers what the call would do:
    - each node's outcome;
    - for a `changed` one, the tags it would add and take out;
    - and first of all, the reports of AC2 and AC3.
  - The same call again, with nothing changed, signs nothing and sends nothing new. Each letter answers `unchanged`, so a reinstall's signing step signs nothing (ADR 0043 Decision 1).
  - An `unchanged` letter is sent, as it was signed, to a relay named in the call that hasn't accepted it yet.
  - A scope with more letters than one call sends answers the ones it sent, and gives a cursor, `next.after`, where the next call goes on (as amended at Architecture).
- [ ] **AC6 — Its letters never come back over their nodes** (graph-rules/0002 Decision 3; memo #133). After export sends a letter for one of the instance's own nodes, the node stays as it was however that letter comes back in:
  - through import nostr (answered `own`, as story 32 has it);
  - through `POST /api/neo4j/event-update` (answered `unchanged`);
  - through the I/O import (that item answered `skipped`);
  - through the client-publish route's brain-write hook, for a Tapestry letter posted again (added at Architecture).

  Its tags, its JSON and its `tapestry:` links stay as the graph had them, and the node still has its letter. An older letter at its address is turned away the same way. So is any of the 20 latest letters export sent for the node, even one newer than the letter the node records, after two exports raced or a read-back failed (as amended at Review, and bounded to 20 when the owner ratified ADR 0034's Amendment 3). A newer letter from anywhere else, such as an edit in the Tapestries UI, is imported as today.
- [ ] **AC7 — What it refuses, and how it reaches agents.** It refuses, signs, sends and records nothing, and says in words what was wrong, naming the input:
  - no scope, or more than one form of it;
  - a ref that names no node (`unknown-ref`) or more than one (`ambiguous-ref`, with the candidates), as `graph resolve` reads it;
  - a graph ref whose node isn't a graph element;
  - more than 10 relays (`too-many-relays`), or a cursor this operation didn't give (`bad-cursor`), both added at Architecture;
  - a relay that isn't `ws://` or `wss://`, or whose host doesn't resolve to public addresses only (the relay host guard, as import nostr applies it);
  - an instance whose assistant key can't be read (`no-assistant-key`).

  A relay that refuses a letter, can't be reached or doesn't answer in time isn't a refusal: it is reported for that letter, beside the others.

  It is for the owner and admins (open question 2): a caller who isn't signed in is refused with 401, and a signed-in person who is neither with 403. It is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs `tapestry export nostr` with the same inputs, no sign-in, and the route's answers, its change entries naming the command as who made them. The catalog's export row, BIBLE §6 and §11, and the external CLI's skill say what it does. The skill stops saying that no operation publishes to nostr or signs a nostr event.

  On a scratch stack, an admin agent with its own key, through the external CLI (A10.6) and with no change to it:
  - makes a concept with the graph operations, with a set, two elements and a `tapestry:` link between them, and dry-runs its export, seeing every letter `new`;
  - exports it to the stack's own relay. Sending to outside relays is covered by the stack-free suites, and the first real export to one is recorded in this story when it happens (as amended at Review);
  - changes one element with `graph update-node`, and sees a dry run list only that element as `changed`;
  - exports again, and sees only that element signed;
  - imports the letters back with import nostr, and finds the graph unchanged;
  - is refused a relay on a private address.

Seven criteria, for one operation. AC1 and AC2 are its letters, AC3 and AC4 what they may name and who signs them, AC5 the call's shape, AC6 its promise to the graph, and AC7 its surface. Status and retract read what AC1 records, so they can follow in a story of their own.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`). It differs on every instance, so it is never written into code.

- `39998:<TA>:graph`: graph (read). The scope a graph names, and its `graph.nodes`, `graph.relationships` and `graph.imports`.
- `39998:<TA>:concept-graph`, `39998:<TA>:tapestry`: the graphs a scope most often names (read).
- `39998:<TA>:relationship`: relationship (read). The relationship letters today's routes signed, and any AC2 sends.
- Any concept whose nodes a scope reaches (read): its header, core nodes, sets, elements and properties, each sent as its letter.
- The community references in firmware's manifest (read), through a header's pointer `b` (ADR 0030).
- No firmware concept's definition changes.

## Out of scope

- **`export status` and `export retract`** (open question 1): a subtask of A10.34 with a story of its own, reading the record AC1 keeps, with fact 14's precedents.
- **Making a release** (ADR 0043 Decisions 4 and 8): the release element, and its members at addresses that name the release, listed by address and id. The form is the release convention's, whose draft (a record task, `protocols/drafts/`) isn't written yet. A follow-up subtask builds it on this story's scope, signer and sender once that draft exists. This story's ADR still says which publisher sends a release (ADR 0043).
- **Seed-firmware (A10.37) and taking over today's install.** This story makes the signing step possible: a graph's new and changed letters into the instance's own relay. Seed-firmware writes the installed-firmware graph and calls it.
- **Publishing someone else's node as one of your own:** `graph copy-node` (A10.24), D8.
- **`export file`** (A10.35).
- **Moving today's importers onto import nostr's recorder** (memo #137, item 2), beyond what AC6 needs.
- **Today's signing routes** keep signing as they write, and don't rewrite links (D15; graph-rules/0002, Consequences).
- **Relay hints** inside a rewritten `naddr` (graph-rules/0002, Out of scope).
- **NIP-42 AUTH, NIP-65 relay lists,** and any letter that isn't public.
- **A backup.** Exporting everything isn't one (BIBLE §30).
- **Any change to today's UI.**
- **Merging to staging and shipping to production,** which wait for the owner's OK (the book's frame).

## Open questions

Resolved at this gate. Each carried the drafting's proposal, for the owner to confirm or change; the owner approved the story as drafted, with all three (2026-11-20).

1. **Is this one story, or three operations in one?** *Resolved: this story is `export nostr` alone* (the drafting's proposal, approved by the owner, 2026-11-20). `export status` and `export retract` follow as a subtask of A10.34 with a story of their own, and the release as another, once its convention is drafted. Export nostr alone is as large as import nostr was: seven criteria, a letter builder for every kind of node, the rewrite with a new parser, a new record, and a sender. Status and retract each read that record, and neither is on the firmware route. A10.34 would then close on export nostr, with its deviations naming the split. The other choice: keep all three here, with one criterion each for status and retract, in one pull request about a third larger. That is how Loom's task has it.
2. **Who may sign as the assistant?** (catalog §10, question 2) *Resolved: the owner and admins, to any relay* (the drafting's proposal, approved by the owner, 2026-11-20).
   - Admins already sign as the assistant through the normalize routes, and can take its key away in a backup (fact 8).
   - The one route kept for the owner, `signAs: 'assistant'`, signs content the caller writes. Export signs only what the graph holds, which admins can already write.
   - The instance's own relay can be read from outside (fact 10), so keeping admins to it wouldn't keep a letter private.
   - Each call's change entry names who exported what.

   The other choices: admins to the instance's own relay only, with the owner alone naming other relays; or the owner only, from a browser or the internal CLI, which would leave agents unable to publish.
3. **What goes out, beyond the nodes the scope names?** (catalog §10, question 9; design §5, question 4) *Resolved: only what the scope names, and nothing added or stopped for what it names in turn* (the drafting's proposal, approved by the owner, 2026-11-20).
   - Another author's node, the owner's included, is named by its address and never sent (AC4).
   - A reference to one of the instance's own nodes that has no letter isn't added to the export, and doesn't stop it. A link is dropped and its text kept, as graph-rules/0002 decides. A whole value is left out. A tag still names the address, since the claim holds once that node is sent.
   - Each is reported, and a dry run lists them first, so the caller can widen the scope.

   The other choices: add those nodes to the export (the design's "adds"), which could pull much of the graph out unasked; or refuse the call until they have letters, which makes every partial export fail.

Settled by the design, and approved with the story (2026-11-20):
- **The node first, the letter on purpose** (D2). Export never changes what the graph says about a node, only what is recorded about its letters (AC1).
- **The instance's own relay is always sent to,** and the relays named besides. Today's concept export went to the DList relay alone (fact 7). Here the caller names it, and with the router's `dcosl` stream on, the local relay copies these kinds there anyway (fact 10).
- **A concept graph brings its class thread,** as today's export-set does, so "a whole concept" (D12) includes its sets and elements, the instance's own only. Import nostr's graph import doesn't follow the class thread (story 32); a filter on `#z` or `#s` brings it in.
- **Only what is new or changed is signed again** (ADR 0043 Decision 1; ADR 0041 Decision 7).
- **Every relay's answer is reported as that relay gave it** (honest-publish-reporting ADR 0001): `strfry import`'s exit code is never taken as a relay's answer (fact 9).

**Changed at Architecture** (the owner's approval of ADR 0034, Option A, with its seven proposed amendments, 2026-11-20):

- AC2: `z`, `n` and `wordTypes` come from the node as the writes keep them, and only `s` from the parent links. Measured on the local instance, the class thread reaches 209 of 535 own nodes through concepts their letters never named, and misses 10 whose `z` is a convention (ADR 0034, Context 3).
- AC2: the round trip may add a superset's `HAS_ELEMENT` to an element reached through a set, since import nostr's `z` wiring doesn't prune.
- AC2: the letter's `json` is the stored JSON, less `graphContext`, not the LMDB copy, which can lag it.
- AC1 and AC4: the outcomes `other-kind`, `no-address` and `unbuildable`, and the relay classes `held`, `not-sent` and `unread`.
- AC5: each letter goes after the call's letters it names, with rank breaking a cycle; a big scope goes on through `next.after`.
- AC1 and AC7: a graph element is one the graph concept's class thread reaches, or one whose stored JSON holds a `graph` object; `too-many-relays`, `bad-cursor` and `no-assistant-key` are named.
- AC6: event-update answers `unchanged` and the I/O import `skipped` for a letter the node holds or an older one, and the client-publish route's brain-write hook is guarded too.

**Changed at Review** (the owner's answer to review round 1, "Yes, as recommended", 2026-11-21; ADR 0034, Amendment 2):

- AC1: a graph past four levels of imports, or past the 50th, is reported `graph-not-followed`.
- AC5: letters go out by kind of node first (headers, supersets, sets parents first, the rest), and within a kind after what they name.
- AC6: the importers also turn away any of the 20 latest letters an export of the node sent, even one newer than the letter the node records. The owner chose this bound when he ratified Amendment 3 (2026-11-21).
- AC7: the scratch-stack run sends to the stack's own relay only. Outside relays are covered stack-free, and the first real send to one is recorded when it happens.

For Architecture, not this gate (answered by ADR 0034):
- **The record of what was sent:** its form (a property, a node or a ledger; design §5, question 2), per letter and per relay, and how it serves status and retract, including a letter whose node `graph delete-node` took out (ADR 0026).
- **How each kind of letter is built:** from the would-be tags, which lose their order and any fifth element (fact 2), from relationships (fact 3), from tapestryJson (ADR 0020a), and from `setJson` and `setTags` (ADR 0027). And how to tell the letter a node has, which only strfry keeps whole (fact 4), from the one the graph would sign now.
- **Relationships no letter carries today** (enumerate's, mark-field's, add-relationship's; fact 3): a relationship letter for each, as today's enumerate route signs, or a report.
- **The publisher.** A server-side sender, squared with community-reference ADR 0004, its RE1 test and dlist-curation ADR 0004's "its own ADR and its own exclusion". That sender is also what sends a release (ADR 0043). It must cover how letters reach the local relay (`strfry import`, read back by id, or a websocket) and the outside relays, with per-relay classes and time limits.
- **Versions.** A new version must be dated after the one before (NIP-01), even when a route signed that one later than now.
- **Keeping its letters from coming back** (AC6), in event-update and the I/O import: a check against the record, or those callers moved onto import nostr's recorder (memo #137).
- **The parser,** a new dependency, and **caps and time**: nginx's 60 s, a job as lifecycle backup is, the 128 KiB websocket limit, and a large `json` tag (fact 13).
- **Locks:** an export beside a graph write on the same node.

## Deviations

Judgment calls made in Implementation (2026-11-20), each too small for an ADR amendment:

- **`everything` counts only when it is `true`.** `{ everything: false }` alone is `no-scope`, and beside `node` or `graph` it is no second scope, since false asks for nothing.
- **Each relay is checked before any ref is read.** The order is the scope's form, then the relays (their count, each one's shape, then the host guard), then the ref (`bad-ref`, `unknown-ref`, `ambiguous-ref`), `not-a-graph`, `bad-cursor`, and `no-assistant-key` last. A dry run needs the key too, since it previews a call that would be refused without one.
- **A relay is named and recorded as `new URL()` gives it, without a trailing slash,** and a relay given twice is sent to once. So `sentTo`, the answer and the change entry all name `wss://relay.example.com/` and `wss://relay.example.com` alike. Each URL keeps import's 2,000-character schema bound (beyond it, `invalid-input`). The list itself has none, and `too-many-relays` is checked in `run` (Amendment 1, item 2).
- **A cursor is tied to its scope** (the form and the resolved key), as reads.js ties a cursor to its list. One from another scope is `bad-cursor` too. When no node of a page finished, `next.after` goes back to the call's own `after`, or to a start position before every node.
- **Classing stops at `SEND_CUTOFF_MS`,** checked between batches of 100 nodes, so a big scope leaves the rest for `next.after` and its sends a chance. `BUDGET_MS` bounds the read-back: no read-back request starts after it, and its letters are `unread`. The one `strfry import` is never cut (Amendment 1, item 6).
- **`MAX_SEND` counts the letters signed** (new and changed), not an unchanged letter re-sent. The page is cut before the letter that would pass it. The page's letters are then built again, so a link to a node the cut left out drops: that node gets no letter in this call.
- **"Gets a letter in this call"**, for a link's target or a whole value's, means it is a new letter of the call's page (signable, buildable, with no `id`). That is known before anything is signed. So a target whose letter the instance's own relay then refuses still got its `naddr` in the letter that links to it. The next export of the same scope sends the target again.
- **A tag is left out whole when one of its values is** (an `lmdb:` pointer the store lacks, or a whole `tapestry:` value with no letter), since a tag missing one element would shift the rest. Inside the JSON, only that key or list item is left out.
- **The `d` tag is the address's d-tag,** whatever the node's tag node says, so a letter always lands at its node; the `d` tag is never rewritten. A node of kind 39998 or 39999 whose `uuid` isn't a `kind:pubkey:d-tag` address is `no-address`, and one whose address carries a key that isn't the assistant's is `not-own`. Both cases extend Amendment 1, item 4, after `other-kind`.
- **An unbuildable node is reported as `pointer-unresolved`,** with `where: json`, since Decision 9 names no report of its own for it.
- **`unsent-reference` reads the tags `z`, `n`, `s`, `a`, `e`, `o`, `b`, `concept-graph`, `nodeFrom` and `nodeTo`,** and a graph's `graph.nodes` and `graph.imports`. A placeholder is never the instance's own (graph/_nodes.js's `factsOf`), so a tag naming one isn't reported.
- **The send order follows Decision 2's naming tags, with `concept-graph` added and `o` and `b` left out.** The groups that name each other (strongly connected) go out in rank order, and the groups themselves in Kahn's order, the lowest-ranked ready group first. With `o`, every core node would name its header and fall into one cycle, losing the order the graphs' lists give.
- **The change entry's `nodes` is its `keys`:** each `letter-sent` change's `node`, which `graph history` reads. There's no separate field. A change also carries `raced: true` when another write gave the node another letter meanwhile (Decision 8), and CHANGE documents it.
- **A turned-away letter's answers:** event-update answers `{ success: true, unchanged: true, uuid, eventId, reason }`; the I/O import, `{ slug, status: 'skipped', reason }`; the brain-write hook, `{ success: true, uuid, unchanged: true, reason }`. `holdsLetterOrNewer` looks at the node at the letter's NIP-01 key and at the node keyed by its id, since today's builder keys a replaceable kind by id.
- **When the instance's own relay can't be read, a node with an `id` is `changed`,** since "the event isn't in the relay" can't be told from "can't read it". Its read-back is then `unread`, and nothing is recorded.
- **A dry run's relay answers** are `held` where that is known (the instance's own relay for an unchanged letter, a relay in its `sentTo`), and `not-sent`, "a dry run sends nothing", for the rest. A new or changed letter's `id` and `created_at` are null there, since nothing is signed. A letter's `sent` is true when some relay accepted it in this call.
- **The real `strfryImport` resolves whenever `strfry import` ran,** whatever its exit code, and rejects only when it couldn't start. A run killed at 60 s resolves too, and the read-back tells what it kept.
- **A concept graph's class thread brings the instance's own nodes only** (the read conventions' own test), as the story's settled design says. What a graph's lists name is kept whoever wrote it, and answered `not-own` or `owner-signed`. Graphs past four levels or the 50th are neither followed nor reported.
- **micromark 4.0.2,** pinned exactly as asked (`npm install --save-exact micromark@4.0.2`; 4.0.3 exists). The lock gains its 27 packages, all micromark's own and theirs.

Judgment calls made fixing review round 1 (2026-11-21, ADR 0034 Amendment 2), each too small for another amendment:

- **(Finding 13, unlogged at Implementation; now Amendment 2 item 4.) `uncarried-relationship` counts a `b` tag as carrying a relationship:** `INHERITS_FROM` for an inherit-typed `b`, `REFERENCES` for any other, as import nostr makes them (`import/_letters.js`), though Decision 9's list named no `b`.
- **The record takes its locks in one statement:** every node it sets, in tapestryKey order, with the `SET n.tapestryLock = true REMOVE n.tapestryLock` that `_concepts.js`'s lock uses, rather than `lockNode`'s two statements a node, so a 500-letter record isn't 1,000 more round trips and two records lock in one order.
- **A record that finds a letter no export sent** (neither the one the call read, nor one an `export nostr` entry records for the node) leaves the node as it is, `raced`, as Decision 8 had it. Amendment 2 item 1 speaks only of the letters export sent.
- **A record that replaces an older letter another export sent** gives that letter as its change's `was`, since it is the letter it replaced, not the one the call read.
- **An unread letter's change** has `was` and `now` as a sent one's, its relays' answers and no `raced`. Its node is in the entry's `keys`, so `graph history` finds it, though the node records nothing.
- **The guard's entry check** applies to an own node at the letter's address (or keyed by its id) whether or not it holds a letter. It reads only the `export nostr` entries whose `keys` hold that node and whose changes' text holds the id, then checks for a `letter-sent` change of that node with that `now.id`. The record uses the same reader (`_record.js`'s `sentByExport`).
- **`graph-not-followed`** is given once for each node a `graph.imports` lists that the caps left unread and no other path followed, whether or not its JSON holds lists. It names the graph by its tapestryKey and name and says which cap, but not its address: EK7's `named` matches an address by substring, so `…:wide-w50` would also name `…:wide-w5`.
- **The send order (Amendment 2 item 2) replaces deviation 12's:** rank by rank, and within a rank the strongly connected groups in Kahn's order, the ready group with the lowest depth (so sets' parents first), then tapestryKey, going first, and a group of more than one by tapestryKey. Deviation 12's naming tags stay.
- **`strfry import`'s time (Amendment 2 item 5) replaces deviation 17's 60 s.** It gets the time left before `BUDGET_MS`, 30 s at most, and its child is then killed. `toOwn` waits 1 s more (`STOP_MS`) for the killed child to close, so the read-back never runs beside a live import, and no longer, so a seam that never ends can't hold the call. There's no floor: with no time left, the import is killed at once. The read-back still starts only before `BUDGET_MS`, so the letters of an import stopped at the deadline answer `unread`, and go in the entry.
- **A byte-order mark** that starts a text moves each of micromark's offsets on by one. A mark later in the text is kept as a character by micromark, so it needs nothing.

Judgment calls made fixing review round 2's findings (2026-11-21, ADR 0034 Amendment 3), each too small for another amendment:

- **(Finding 14.) The same letter twice:** the relays go on through the re-send's statement, which adds them only while the node still holds that id (else `raced`), and the change's `was` is the letter the node held, so the same as `now`, as a re-send's is, by round 1's rule that `was` is what the node held.
- **`sentIds` lists only the letters a call signed:** each the instance's own relay accepted (set, already held or `raced`) and each `unread`. A re-send adds none, as the test plan's stand-in did, since the letter it re-sends is the one the node holds, which the guard already turns away.
- **"The newest 20" is the 20 latest recorded.** `sentIds` holds ids only, so the record can't order them by `created_at`. A new id goes last, one already listed keeps its place, and past 20 the earliest recorded drops. So a raced record's older letter goes after the newer one it lost to.
- **The record locks and reads every node of its letters,** an `unread` one's too, since it now writes that node's `sentIds`. Before, it locked only the nodes it set or re-sent to.
- **The record tells "a letter another export sent" by the node's `sentIds`** (it lists the id the node holds), so `_record.js`'s `sentByExport` and its entry read are gone. Only scratch stacks and suites hold letters export sent before `sentIds`, since export nostr hasn't been merged anywhere.
- **The guard's `sentIds` check** (replacing round 1's entry check) applies to an own node at the letter's address, or keyed by its id, with or without a letter, and is asked before the node's own letter is compared.
- **(Finding 16; replaces round 1's `graph-not-followed` deviation.) The report's `address` is the graph's `uuid`,** left out when it has none, since the schema's `address` isn't nullable. Its words still give the name and the key, and the schema's `address` now says it is the graph's own address for this report.
- **Wording beyond the brief's list.** The declaration's description, the catalog's row and its "sent as" paragraph name `sentIds` beside `sentTo`, and `changes.js`'s `was` adds "or one the node already held". ADR 0004's header (finding 17) also names the NIP-85 publishers under `src/algos/nip85/`, which send to outside relays from the server in a folder RE1 doesn't read, since without them the new sentence would be wrong too.

## Evidence

### The suites (Implementation, 2026-11-20, on the tree just before it was committed as `26712ded`)

Each suite ran alone on this Mac, with every service endpoint dead, `TAPESTRY_CONTAINER_PORT` unset, `TAPESTRY_CONTAINER=no-such-container`, and stub `curl` and `docker` first on `PATH` (`tmp/a10-34/`). Their logs are dated 20:08–20:09 (UTC−5), and `26712ded` was committed at 20:10. None failed:
- export: nostr 15, markdown-links 9, nostr-letters 11, nostr-links 6, nostr-send 16, nostr-own 5, nostr-agent-through-cli 1, nostr-live 6 skipped;
- RE1 (`test/publish-export-a-concept.test.js`, widened) 3;
- import nostr's suites, the graph writes the scopes use, `write-path`, `tapestry-key-paths`, `relationship-type-allowed`, and the suites behind the three guarded importers, every one passing as before.

The scoped gate, through the gate engine with a conf file whose Neo4j is a closed port, is `20261121T010128Z-88708-2efe`: PASS, exit 0, 1,473 passed, 0 failed, 18 skipped, 6/6 suites (`operations.test.js`, `external-cli`, `openapi-coverage`, `admin-action-sweep`, `schema-save-finds-the-right-header`, `publish-export-a-concept`). It didn't run on `26712ded` (review round 1, finding 12): its record names `823683c6`, the tests' commit, with the implementation's 16 files uncommitted (`dirty: true`), before they were committed as `26712ded` with the docs, the ledger row and these Deviations, 21 files in all. The Reviewer's clean run on `39a9b8c5`, `20261121T014306Z-58530-ba74`, gives the same totals.

### The live check (2026-11-21, 01:15–01:25Z, scratch stack `tapestry-scratch`)

The image is `tapestry-tapestry`, with this branch's `src/` mounted read-only.
- **Setup:** story 32's recipe, adapted (`tmp/live-check-34/setup.sh`). It copied in the branch's firmware, `bin/tapestry.js` and `clients/cli`, and set a fresh throwaway owner and admin. It added the five uniqueness rules, ran `lifecycle migrate --migration tapestry-keys`, and installed firmware.
- **micromark:** the image had none of the 27 packages the lock adds, so they were copied in, and `import('micromark')` loads in the container.
- **`nostr-live.test.js`:** 6 passed, 0 failed.
  - LV1: each letter went through the real `strfry import` and was read back, verifying.
  - LV2: a repeat was all `unchanged`, with nothing signed.
  - LV3: after `update-node`, only that letter was `changed`, and the relay keeps the newer version.
  - LV4: import nostr answered `own`, and every node stayed as it was.
  - LV5: two exports fired together each answered, and every node ended with one letter.
  - LV6: 497 letters accepted in 1.92 s, about 259 a second. The suite's 8 core nodes and 489 elements fall short of the 500 cap, so the cap wasn't reached.
- **LH1, by hand (20 of 20):** an admin agent with its own key, through the unchanged external CLI, inside the container.
  - It made a concept, a set and two elements, the second's description linking to the first by `tapestry:`.
  - A dry run listed 11 letters `new`; the export sent them to the stack's relay, and a repeat was all `unchanged` (`held`).
  - After `update-node` on the first element, a dry run listed only it, and the export signed only it, its `created_at` one second after its last.
  - `import nostr` of the 11 letters answered `own` for each, with the graph's 6,603 nodes and 6,623 relationships unchanged.
  - The second element's letter on the relay links by `nostr:naddr1…`, which decodes to the first's address, while its node in the graph still holds the `tapestry:` link.
  - `graph history` shows the two `export nostr` entries.
- **LH2, by hand (6 of 6):** `POST /api/neo4j/event-update` on both exported elements answered `unchanged`, naming the letter each holds. Their tag nodes are the same nodes, and the control panel logged no tag deletion.
- **Not yet run:** EA1's private-relay refusal by hand on the stack. The send to an outside relay is no longer part of this run (AC7 as amended at Review, ADR 0034 Amendment 2 item 7): the first real export to one is recorded here when it happens. A large export through nginx isn't timed; LV6 timed the call direct to the control panel.

The records are in the worktree's `tmp/live-check-34/`, to be copied to the main checkout's `tmp/` before the worktree goes.

### The suites after review round 1's fixes (2026-11-21, on `d58a6889` with the fixes uncommitted)

Each suite ran alone, as above: stub `curl` and `docker` first on `PATH`, every endpoint dead, and the conf file's Neo4j and Redis on a closed port. None failed:
- export: nostr 15, markdown-links 10, nostr-letters 12, nostr-links 8, nostr-send 19, nostr-own 5, nostr-agent-through-cli 1, nostr-live 6 skipped. The nine round-1 tests the test plan lists as failing pass: ML10, EK7, EK8, EW2, EW5, ES8, ES13, ES17 and ES19;
- RE1 (`test/publish-export-a-concept.test.js`) 3;
- import: cypher-engine 12, nostr 15, nostr-agent-through-cli 1, nostr-filter 10, nostr-graph 12, nostr-order 11, nostr-own 7, nostr-record 15, nostr-relay 9, nostr-live 6 skipped;
- the guarded importers' suites: brain-first-tapestry-authoring 11 (its 8 live checks skipped), publish-event-signature-verification 5, b-tag-primitive 16 and curated-dlist-update-publish 69; with change-entry-fields 3 and openapi-coverage 13.

The scoped gate, the same six entries through the gate engine, is `20261121T034436Z-32410-17ad`: PASS, exit 0, 1,480 passed, 0 failed, 18 skipped, 6/6 suites. Its record names `d58a6889` with 12 files uncommitted (`dirty: true`): these fixes, before their commit. `operations` has round 1's seven new tests (1,376 passed, against 1,369), and the other five entries' totals are as before.

### The live check after review round 1's fixes (2026-11-21, 03:53–03:58Z, on `306ef8828`)

A fresh scratch stack `tapestry-scratch` was set up with the same scripts, `tmp/live-check-34/setup.sh` and `micromark.sh`. The export code inside it hashes the same as the worktree's, and the control panel was restarted on the committed fixes.
- **`nostr-live.test.js`:** 6 passed, 0 failed. LV5's two exports fired together now meet the record's node locks on a real Neo4j: each answers, and every node ends with one letter. LV6: 497 letters accepted in 2.03 s.
- **The private-relay refusal, by hand** (Amendment 2 item 7). The admin agent, through the unchanged external CLI, asked for `export nostr --everything true --relays wss://localhost:7777 --dryRun true`. It was refused `private-relay` on `relays`: "its host, localhost, doesn't resolve to public addresses only … Nothing was signed or sent." The output is `tmp/live-check-34/r2-private-relay.out`.

Sending to an outside relay waits for the first real export, as the story's AC7 has it since Review.

### The suites after review round 2's findings (2026-11-21, on `8a445856` with the fixes uncommitted)

Each suite ran alone, as above: stub `curl` and `docker` first on `PATH`, every endpoint dead, and the conf file's Neo4j and Redis on a closed port. None ran beside the gate, and none failed:
- export: nostr 15, markdown-links 10, nostr-letters 12, nostr-links 8, nostr-send 24, nostr-own 6, nostr-agent-through-cli 1, nostr-live 6 skipped. The nine tests the test plan's "Review round 2" lists as failing pass: ES20 to ES24, EW2, EW5, EW6 and EK7. After the gate, the same seven suites and RE1 gave the same counts on Node 22.23.1, CI's major version;
- RE1 (`test/publish-export-a-concept.test.js`) 3;
- import: cypher-engine 12, nostr 15, nostr-agent-through-cli 1, nostr-filter 10, nostr-graph 12, nostr-order 11, nostr-own 7, nostr-record 15, nostr-relay 9, nostr-live 6 skipped;
- the guarded importers' suites: brain-first-tapestry-authoring 11 (its 8 live checks skipped), publish-event-signature-verification 5, b-tag-primitive 16 and curated-dlist-update-publish 69.

The scoped gate, the same six entries through the gate engine on Node 24.18.0, labelled `a10-34-r2-fixes`, is `20261121T051347Z-55527-b43b`: PASS, exit 0, 1,486 passed, 0 failed, 18 skipped, 6/6 suites. By entry: `operations` 1,382/0/16, `external-cli` 53/0/0, `openapi-coverage` 13/0/0, `admin-action-sweep` 9/0/0, `schema-save-finds-the-right-header` 26/0/2 and `publish-export-a-concept` 3/0/0. `operations` has the round's six new tests (ES20 to ES24 and EW6) beside review round 2's 1,376. The record names `8a445856`, the tests' commit, with 12 files uncommitted (`dirty: true`): the 11 files of these fixes, and this story with the Deviations above. This section was written after it. Nothing of this round is committed yet. `bash scripts/harness-lint.sh` was clean before the gate. The runs' logs are in the worktree's `tmp/a10-34/round2-impl/`.

**The live checks on these fixes** (2026-11-21, 05:23–05:24Z, on `454e6c5e4`, the same scratch stack. Its control panel was restarted first, from this session, with `supervisorctl restart brainstorm`, which answered "stopped" and then "started". That output wasn't saved to the records.): `nostr-live.test.js` 6 passed, 0 failed, LV6 497 letters in 2.09 s (`tmp/live-check-34/nostr-live.log`; the earlier runs kept as `nostr-live-run1.log` and `nostr-live-run2.log`).


### The scoped gate on the merged tree (2026-11-21, on `7ff957e13`, staging merged in)

The gate was derived from the changed files, as ledger row `2026-11-21-scoped-gate-lists-built-by-hand` asks: CI's entries for an operations change, plus every registered suite whose source names a changed file, function or helper. That came to 86 suites; the script and its list are in the session's records, `tmp/a10-34-records/`. Record `20261121T055736Z-44398-0ab1`: 3,795 passed, 10 failed, 180 skipped. The ten failures are this Mac's, not the branch's:
- safe-to-merge-check's B1–B9 (7) time out behind the stub `curl`, and pass 16/0 when run alone without it;
- router-stream-limit-on-connect's P1–P3 (3) fail on macOS's BSD `sed` (ledger row `2026-10-09-router-patch-sed-macos`), in files identical to staging's.

The pull request's CI runs the full gate on Linux.

### On staging and production (2026-11-21)

**Staging: TapestryProtocol/tapestry#183,** after its ADR, #173.
- **The first try:** #183's `stack-free` run, 44874358447, passed on `eef541a6`, and the safe-to-merge check said SAFE at 06:27:38Z. The merge didn't go through: seed-firmware's #182 had merged into staging at 06:26:55Z, and `test/helpers/externalCliServer.js` now conflicted, since each had added its own hooks there.
- **The fix:** staging was merged in as `c327474b`, keeping both sets of hooks: export's `strfry` and `assistantKeys`, and seed-firmware's `lifecycleFakeState`. Five suites that use them then passed on this Mac, stack-free: the agent runs through the external CLI for export nostr, seed-firmware and import nostr (1 each), nostr-send (24) and nostr-own (6). The owner was told, and answered "ok, merge when it's green".
- **Its CI:** `stack-free` run 44875787707 passed on `c327474b`, in 22 m 53 s.
- **The merge:** the safe-to-merge check said SAFE at 06:53:05Z, and #183 merged at 06:53:12Z, pinned with `--match-head-commit` (merge commit `cae6e1cb`).
- **The deploy:** `deploy-staging.yml` run 44877650711 succeeded, its job in 2 m 39 s, by 06:56:30Z.
- **The smoke test, 06:56:56–06:57:32Z:** Tiers 1, 2, 3 and 5 passed. Tier 4 doesn't apply, since no UI changed.
  - Tier 1: stable after 3 polls, with Neo4j answering (19,886 verified followers).
  - Tier 2: every page and public API answered 200, apart from `get-user-data`'s documented 504.
  - Tier 3: `/docs/swagger-ui-init.js` listed 40 operation paths. At 06:13, before #182 and #183, it listed 38; the two added are `export/nostr` and seed-firmware's `lifecycle/seed-firmware`. All eleven of export nostr's refusals are listed, and a signed-out call answers 401. The script's check for event-update's new reply looked for the wrong words and printed 0; the saved docs hold the reply ("turned away unchanged", ADR 0034 Decision 10).
  - Tier 5: import nostr and `graph list-elements` are still listed, and import nostr still answers 401 signed out.
- **Loom** marked A10.34 done, verified weakly: #183 was merged by nousclawds4, with no teammate's approval.

**Production: TapestryProtocol/tapestry#184,** the promotion of staging at `cae6e1cb`, through `promote/seed-firmware-export-nostr-2026-11-21`.
- **What it carried:** #183 and seed-firmware's #182 (story 37), with move-element's records (#180) and story 47's records and a ledger row (#179). The owner said "Yes, promote" after being told it would carry #182, and "Yes, merge" once the PR listed all four.
- **Its required checks:** `stack-free` (run 44878655853, 16 m 55 s) and `main-source-guard` (run 44878655851) passed on `cae6e1cb`.
- **The merge:** the safe-to-merge check against production said SAFE at 07:23:52Z, and #184 merged at 07:23:55Z, pinned with `--match-head-commit cae6e1cb` (merge commit `e0d5480f`).
- **The deploy:** `deploy-tapestry.yml` run 44880067110 succeeded, its job in 3 m 29 s, by 07:27:57Z.
- **The smoke test, 07:28:07–07:28:48Z:** Tiers 1, 2, 3 and 5 passed. Tier 4 doesn't apply.
  - Tier 1: stable after 3 polls, with Neo4j answering (19,252 verified followers).
  - Tier 2: every page and public API answered 200, apart from `get-user-data`'s documented 504.
  - Tier 3: the served docs listed 40 operation paths, where they listed 38 before the merge. The two added are `export/nostr` and `lifecycle/seed-firmware`, and none was dropped. Every refusal of both is listed, with event-update's new reply, and signed-out calls to both answer 401. The docs are byte for byte the ones staging served after #183.
  - Tier 5: import nostr, `graph list-elements` and `lifecycle status` are still listed, and import nostr still answers 401 signed out.
- **No firmware reinstall** was needed, and none ran.

**What no one has run.** No signed-in export ran on staging or production: one would sign letters as that instance's assistant, send them to its relay and record them in its graph. The first real export to an outside relay is to be recorded here when it happens (AC7, as amended at Review).

The records are in the main checkout's ignored `tmp/a10-34-records/`: `ship/` for staging, `promote/` for production.

## Linked artifacts
- ADR: `engineering-team/decisions/graph-operations-first-slice/0034-export-nostr.md`
- Test plan: [34-export-nostr.test-plan.md](./34-export-nostr.test-plan.md)
- Review: `engineering-team/reviews/graph-operations-first-slice/34-export-nostr.md`
