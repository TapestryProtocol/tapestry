# ADR 0002: Markdown in a Tapestry graph links to a node by its tapestryKey or its nostr address, and export nostr turns the first into the second

**Status:** Accepted
**Date:** 2026-11-18
**Story:** none. This ADR answers Loom decision task A10.42, drafted from proposal P-159. Its plan is [docs/loom/A10.42.md](../../../docs/loom/A10.42.md). Its decider accepts it by merging it.

## Context

Markdown that a Tapestry graph holds needs a way to link to another node. The first need is a glossary on one hosted instance, david.tapestry.ninja. Its concept "tapestry glossary entry" has a `definition` field, a string its JSON Schema describes as "Markdown file, by convention", and the entries' definitions use each other's terms. The owner wants those terms to be links.

What bears on the choice:

- **A link by a term's name breaks.** `[[concept header]]` stops pointing at its entry when the entry is renamed, say to "class thread header", or when another name becomes an alias for it. A name can also name more than one node: `graph resolve` answers every node a name names, and calls the answer ambiguous.
- **A node the graph operations make has no letter.** It is kept in Neo4j without being signed. It has the address its letter would have (its `uuid`), but no event `id` and no `NostrEvent` label until a letter is published for it (ADR graph-operations-first-slice/0016 Decision 1; design D7). On 2026-11-18, only two of the glossary's entries had letters: class thread and concept. The concept header entry, at `39999:a7173e2c…:concept-header-67dbde4a`, has none. The owner won't have nodes published just so that markdown can link to them.
- **Every node has a tapestryKey, and it never changes.** It is a random v4 UUID the instance gives each node when the node is made, or, for a node from before that, when `lifecycle migrate` runs (BIBLE §29; ADR graph-operations-foundation/0003). `keyNode` never replaces a key a node has, and a letter published for a node later lands on the same node (ADR 0003 Decision 9), so the key outlives publishing. A backup restored on another instance brings its keys with it (ADR graph-operations-foundation/0002). Otherwise each instance makes its own: the same letter, imported by two instances, has a different key on each.
- **Renames keep the key and the address.** `graph update-node` renames a node's name, tapestryValue, name tag and sections, and "Its address and tapestryKey never change" (its declaration).
- **`graph resolve` already reads both.** Its `ref` takes a tapestryKey, a nostr address, an event id, or the naddr, nevent or note of one, read by its shape (`src/operations/resolve.js`; ADR graph-operations-first-slice/0009). A ref that still has its `nostr:` or `tapestry:` prefix is read as a name. A key is matched exactly, as the graph stores it, which is in lowercase. The operation answers the owner and admins only, and the public read, `GET /api/concept-graph/node/:handle`, takes an address, never a key.
- **`lmdb:` is already a pointer.** Any string property's whole value may be `lmdb:<tapestryKey>`, meaning the value is stored in the tapestry-store under that key. For any value that starts with `lmdb:`, a reader that resolves through `src/lib/tapestry-resolve.js` gets what is stored, or nothing when the store has no entry, while a raw read gets the pointer (BIBLE §29).
- **Importing a letter replaces its node's tags.** `importEventDirect` deletes the tags of the node at the letter's address and makes them again from the letter (`src/api/normalize/index.js`). Today's signing routes import each letter they sign (`src/api/normalize/helpers.js`).
- **Nothing uses a `tapestry:` scheme.** Searched staging's `src/`, `ui/src/`, `protocols/`, `docs/` and the BIBLE on 2026-11-18.
- **Tapestry's UI has no markdown renderer.** `ui/src/components/NoteContent.jsx` turns NIP-21 `nostr:` entities in a note's text into in-app links: npub and nprofile to a profile, and note, nevent and naddr to an event.
- **No markdown library follows either scheme as it comes** (tried on 2026-11-18). react-markdown 10.1.0, which Brainstorm-UI uses, empties the href of both `tapestry:` and `nostr:` links, since its URL check keeps only http, https, irc, ircs, mailto and xmpp. rehype-sanitize's default schema removes the href. markdown-it 15.0.3 and marked 14.0.0 pass both through unchanged, so a click hands the link to whatever app, if any, is registered for its scheme.
- **Export nostr is to report what it can't name.** It isn't built yet. A10.34's detail says it "reports references to nodes with no nostr address yet", and the design leaves open whether an export adds those nodes to its scope or stops (design §5, question 4).
- **CONCEPTS.md is the glossary's designated home.** Graph-rules ADR 0001 Decision 9 keeps glossary entries in NosFabrica/protocols' CONCEPTS.md, published into the graph from there. The entries on david.tapestry.ninja are written in the graph first, ahead of it.
- **NIP-21** defines `nostr:` URIs for npub, nprofile, note, nevent and naddr. An naddr holds an address (a kind, a pubkey and a d-tag), so it names a replaceable event across its versions. A note or an nevent names one version.

## Options considered

### Option A — Link by the term's name, `[[concept header]]`

The wiki convention: the link is the target's name.

- **Pros:** it reads well as plain text, and the writer needs no key.
- **Cons:** it breaks on every rename or alias, which is the problem this decision is for. A name can name several nodes, so a renderer would have to choose one. The owner rejected it for these reasons (P-159).

### Option B — `nostr:naddr…` only

Every link is a NIP-21 naddr.

- **Pros:** one form, which nostr clients already read, and which travels as it is. It survives renames, since an address never changes.
- **Cons:** a node with no letter can't be linked to. It would have to be published first, which is the precedent the owner refuses, or its would-be address put in an naddr, which names nothing a reader on any relay can fetch. P-159's case against names a smaller start, plain text for graph-only nodes, which gives up those links.

### Option C — `tapestry:<tapestryKey>` for any node, `nostr:naddr…` for a node with a letter, and export nostr rewrites (P-159)

- **Pros:** any node can be linked to, and nothing has to be published first. Both forms survive renames and aliases. What leaves the instance is NIP-21, which other clients read, since export nostr rewrites the rest.
- **Cons:** a second form for writers and renderers to learn. A `tapestry:` link is dead outside its instance, and in any letter signed by a route that doesn't rewrite it. Export nostr gains a rewrite and a report. Only Tapestry reads the scheme.

## Decision

We chose **Option C**, because it is the only one that links to every node with nothing published, and what it sends out is NIP-21.

1. **Two link forms.** In markdown a graph holds, a link to a node is a markdown link whose destination is one of:
   - `tapestry:<tapestryKey>`: the node in this graph that has that key. Any node with a key can be the target.
   - `nostr:naddr1…`: the node at the address the naddr holds. On this instance that is the node whose address it is; anywhere else, the letter at that address.

   A link has text, as in `[concept header](tapestry:e10e3045-2070-4b5c-8d4b-6c67c0a06388)`. The text is what a reader sees, since a bare key or naddr means nothing to a reader. The key is written as the graph stores it, in lowercase. Other NIP-21 entities keep NIP-21's meaning. A `nostr:note…` or `nostr:nevent…` names one version of a letter, so a link meant to follow a node's later versions uses its naddr.

2. **A `tapestry:` link means "in this graph".** Each instance makes its own keys at random (BIBLE §29), so on another instance the key names no node: the link is dead there, never wrong. The exception is an instance restored from this one's backup, where it names the same node. No letter export nostr sends carries one (Decision 3), though a letter an older signing route signs can (Consequences). Either way it is not a wire format: nothing outside the instance is meant to read it, so it needs no spec in NosFabrica/protocols.

3. **Export nostr rewrites each `tapestry:` link in the letters it sends** (A10.34). Before it signs a letter, it reads every string the letter carries, and for each `tapestry:` link:
   - **The target has a letter,** a signed event at its address, or a letter this export sends for it: the link becomes `nostr:naddr1…` for that address, with the same text. A target whose address is an event's id, not a kind, pubkey and d-tag, gets `nostr:nevent1…` for that id.
   - **The target has no letter, or no node has that key:** the link is dropped and its text kept, and the export reports it, as A10.34's detail has it report references to nodes with no nostr address. A dry run lists them first, so the owner can add the targets to the export's scope.

   An address is sent only when a letter is at it, since an naddr made from a node's would-be address names nothing any reader can fetch.

   The rewrite changes the letter, never the graph. The node keeps its `tapestry:` links in Neo4j, so it still links to its graph-only targets, and a later export rewrites whichever of them have letters by then (BIBLE §30: the graph is the self). So the letter must never come back over the node. Importing a letter replaces its node's tags (Context), so when the importer meets a letter this instance sent for one of its own nodes, it records that the node now has a letter and leaves the node's tags as they are. How it tells such a letter apart is A10.34's to settle. A `nostr:` link is sent as it is, and a letter from anyone else is imported as it came.

4. **Renderers resolve both forms with `graph resolve`.** A renderer takes the link's destination, takes off the scheme, and resolves what is left: a tapestryKey, or an naddr, which resolve decodes. The rule `tapestry_key` holds a key to one node, and an address is meant to name one, though nothing in the database holds it to that (ADR graph-operations-foundation/0003). The point of view the page reads from decides, at view time, whether the target counts: the owner's or everyone's today, since other points of view are still to come (`src/operations/reads.js`). A target that resolves to nothing from that point of view renders as the link's text, with no link, and so does one that resolves to more than one node, since resolve never picks one.

   No library follows either scheme, so each renderer turns a link it has resolved into an in-app link itself. A `nostr:` link whose target isn't in the graph goes where NoteContent.jsx sends one. `graph resolve` answers only the owner and admins, so a page that shows markdown to anyone else resolves its links on the server, with the module the operation uses (`src/operations/resolve.js`). The server uses `candidatesOf`, which reads the graph, not `resolveOne`, which hands a key back without reading it.

5. **A link whose target is deleted is reported, never refused.** `graph delete-node` leaves the links to a node dead, and they render as their text (Decision 4). A rule reports each `tapestry:` link in this instance's own nodes whose key names no node, with the node that holds it. Links in other people's letters are left alone. Once this ADR is accepted, the rule's wording goes in the rulebook with status proposed and this ADR as its source, and `rules check` (A10.31) makes it enforced (graph-rules ADR 0001, Decisions 5 and 6). A `nostr:` link to a node this graph doesn't hold is not reported, since its letter may be on a relay.

6. **`tapestry:` is not `lmdb:`.** Both carry a tapestryKey.
   - `lmdb:<tapestryKey>` is a property's whole value, and a storage pointer. The value itself is stored in the tapestry-store under that key. A reader that resolves through `tapestry-resolve.js` gets what is stored, and no one is meant to read the pointer itself.
   - `tapestry:<tapestryKey>` is a link inside markdown text. It names the node that has the key, and a reader sees the link's text.

   When a field's whole value is an `lmdb:` pointer, the pointer is resolved first, and the links are read from the text it resolves to.

## Consequences

- **Glossary entries can carry links now.** A writer can put either form into a definition today. Until a renderer lands, readers see the markdown as it is, and the links stay right through renames.
- **The older signing routes don't rewrite.** The JSON Editor, `POST /api/strfry/publish` and each route that signs as it writes publish the links as they are: dead, never wrong, but sent. So change a node that has `tapestry:` links only through the graph operations, which never sign (A10.4), and publish it only with export nostr.
- **Markdown kept outside a graph links by `nostr:` only.** A key names a node on one instance, so a file such as CONCEPTS.md can't hold a `tapestry:` link. Entries written in a graph first, as the glossary's are today, need their `tapestry:` links changed before they go into CONCEPTS.md.
- **Export nostr gains a step** (A10.34): the rewrite, its report, the dry run's list, and keeping its own letters from coming back over their nodes.
- **Each renderer has work to do:** take off the scheme, resolve, and make an in-app link, since no library does it.
- **The rulebook gains a rule that only reports:** proposed once this ADR is accepted, and enforced once A10.31's check runs it.
- **BIBLE §29 gains a paragraph** on `tapestry:` links, beside `lmdb:`, with the first story built on this ADR.
- **No protocols spec.** Export nostr never sends a `tapestry:` link, and `nostr:` links are NIP-21's.
- **Firmware reinstall required?** No. No concept definition changes.

## Implementation notes

This decision changes no code. What follows once it is accepted:

- **The rewrite in export nostr** (A10.34, TapestryProtocol/tapestry). Before a letter is signed, each `tapestry:` link in its strings is rewritten or dropped, as Decision 3 says, and the export's answer reports each dropped link, with the node that holds it and the key it named. A letter it sent, when imported, leaves its node's tags as they are (Decision 3). Its tests cover a target with a letter, a target in the same export, a target with none, a key that names no node, the node in the graph left unchanged, and the node still unchanged after its own letter is imported.
- **The rulebook entry,** in `docs/GRAPH_RULES.md`: Decision 5's rule, with status proposed and this ADR as its source. A docs-only change, once this ADR is accepted.
- **Rendering both forms** wherever definitions are shown. Tapestry's UI has no markdown renderer, so this is a story of its own. It also settles which fields a page renders as markdown: the glossary's schema says so only in the field's description, and JSON Schema's `"contentMediaType": "text/markdown"` is the standard way to say it.
- **The check for dead links,** with `rules check` (A10.31), over this instance's own nodes.
- **Finding the links.** The three share one helper that finds a markdown text's links and rewrites them, written with the first of them. It uses a CommonMark parser, not a pattern match: a pattern would rewrite examples inside code spans and code blocks, which a glossary entry about links will hold, and would miss reference definitions, such as `[term]: tapestry:<tapestryKey>`.
- **The BIBLE:** a paragraph in §29 on `tapestry:` links, with the first of these stories.

## Out of scope

- **References in tags,** and whether an export adds unpublished nodes to its scope or stops (design §5, question 4; A10.34).
- **Relay hints** in a rewritten naddr, and whether a target's letter is on the relays an export sends to (A10.34's `export status`).
- **Links to people,** `nostr:npub…` and `nostr:nprofile…`, which keep NIP-21's meaning.
- **How a page shows a link** whose target its viewer's point of view leaves out (the rendering story).
- **Aliases.** How a node's other names are recorded isn't decided here. Either way, both link forms name the node, not one of its names.
- **Links to another instance's node by its key.** A link that crosses instances uses `nostr:` today.
