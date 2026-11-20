# ADR 0043: Firmware ships as pinned Tapestry releases, which each instance installs as nodes of its own

**Status:** Accepted
**Date:** 2026-11-20
**Story:** none. This ADR answers Loom decision task A10.43, drafted from proposal P-160. Its plan is [docs/loom/A10.43.md](../../../docs/loom/A10.43.md). Its decider accepts it by merging it.

Two documents are cited by short name. The **design doc** is [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md), whose decisions are D1 to D15. The **catalog** is [docs/GRAPH_OPERATIONS_CATALOG.md](../../../docs/GRAPH_OPERATIONS_CATALOG.md).

## Context

**Firmware today.** The firmware is the JSON under `firmware/` (BIBLE §7). `firmware/active` points at `versions/v1.0.0`, which defines 41 concepts and 11 relationship types, with their elements and sets. `src/firmware/install.js` reads those files. Pass 1 creates each concept and element through the normalize routes, which sign with the instance's assistant key, publish to the local strfry and import into Neo4j. Pass 2 re-signs each concept's JSON Schema with its full content. So every instance holds a signed copy of its own, at addresses made from its own assistant's pubkey:
- a header at `39998:<assistant>:<slug>`, built by `firmware.conceptUuid(slug)`;
- its core nodes at d-tags such as `<slug>-superset` and `<slug>-schema`, built in `handleCreateConcept`;
- its elements and sets at d-tags of the form `slug(name)-hash8(parentUuid)` (`src/lib/dtag.js`). These hash their parent's address, so they differ on every instance too.

The assistant key is made at a deployment's first start and kept on its data volume. It differs on every deployment, which is why code resolves it at runtime and never hardcodes it (CLAUDE.md). ADR 0015's legacy z-tag pubkey is the named exception. The firmware module, `src/api/normalize/firmware.js`, reads `firmware/active`. Twenty other files under `src/` require it, nineteen of them at runtime (`src/firmware/graph-rules.js` does so only when it is run by hand).

**What David wants** (P-160): "One of my goals is to publish firmware as a tapestry, and do it in a manner such that installation of firmware for a new instance can occur via an import function, thus removing the need for the firmware to live in the repository."

**What already exists to build on.**
- **A Tapestry** (`39998:<assistant>:tapestry`) is a graph of concept graphs. Its element's `graph` block lists its nodes, relationship types and relationships, and imports its member concepts' concept-graph core nodes (BIBLE §6).
- **Install already fetches from relays, on a small scale.** Its community-reference pass (`pass_communityReferences` in `src/firmware/install.js`; community-reference ADRs 0030 and 0034) reads a concept's `communityReference`. It fetches the curator's header from the reference's `relayHints`, by id when `knownGoodEventId` is set. It skips the header when the fetched id doesn't match, and carries on with the install. It imports the header with `buildImportCypher`, and links the instance's own header to it with a `pointer` b tag.
- **Exporting a concept.** Community-reference ADR 0004 exports a concept as its own-authored letters, rooted at its concept graph. It rejected bundling a concept into one event, since an importer then can't address its parts. It also rejected a server-side publisher: concept letters are signed and sent from the owner's browser. Its Revision 1 sends them to `wss://dcosl.brainstorm.world` only, "the purpose-built DList relay" (called the DList relay below), and requires the import's relay hints to name the same relays. A server-side publisher is allowed only in `src/api/dlist-curation/` (dlist-curation ADR 0004), and ADR 0004's RE1 test (`test/publish-export-a-concept.test.js`) checks `src/api/` for any other.
- **The graph operations.**
  - Export nostr (A10.34) publishes a scope: a node, a graph or everything (D12).
  - Import nostr (A10.32) records letters as nodes, by id, by address, by a graph's address or by a filter. Its ADR, graph-operations-first-slice 0032, is on TapestryProtocol/tapestry#162 and not yet merged.
  - Copy-node (A10.24) copies someone else's node into a node of your own, linked to theirs (D8).
  - Seed-firmware (A10.37) is to install or update the built-in concepts "by the bootstrap path, without undoing local edits" (catalog §8). Today's install "can also undo local edits".
  - Every graph write runs its guards and never signs (catalog, Conventions; D1). An import skips the guards (D4).
- **Provenance.** The design doc's §5, question 2, proposes a "came from" record, set once when a node arrives from outside: the kind of source, its address and its author. It leaves the record's form open.
- **Graph-rule items.** ADR graph-operations-first-slice 0041 keeps the graph-rule concept's items in line with the rulebook on every install. An edit made to an item in the graph is put back, since the items describe the rules' code (its Decision 6).

**Constraints.**
- **Local-first** (BIBLE §30). Installed firmware is part of the instance's own graph, and an admin's edits to it are to survive an update.
- **Permissionless publishing** (CLAUDE.md, principle 2). Anyone may publish a firmware Tapestry, and which one an instance installs is the instance's choice.
- **No canonical home** (BIBLE §14). Nothing in the protocol requires an instance to sync with another to work, and `dcosl.brainstorm.world` is "just another relay, not a canonical home".
- **Replaceable letters** (NIP-01). For an addressable event, a relay must keep only the newest version and may discard older ones. So a release whose letters share their addresses with the next release may not be fetchable once the next one is published.
- **Arrival order.** An install has to work whatever order its letters arrive in. Memo #130 on A10.32 found the one case today's importer can't handle: an addressable event that something referred to by id before it arrived can't then be imported. Today's firmware letters refer to each other only by address (`z` tags, and the community-reference pass's `b` tag), which doesn't meet that case.

## Options considered

There are four ways to ship the firmware. The first three take it out of the repo, and differ in where an install reads it from and whose addresses it ends up at. The fourth keeps today's way.

### Option A — A release, installed as the instance's own nodes (P-160's recommendation)

An instance fetches the pinned release and checks it. It then writes each of the release's letters as a node of its own, at the address it would have today, recording where it came from.

**Pros:**
- No address on any instance moves, and `firmware.conceptUuid` and every runtime lookup of the assistant stay as they are.
- An admin's edits are edits to the instance's own nodes, which A10.37 is to keep.
- The reads count the firmware as the instance's own, and find each concept once.
- Two instances' copies of a concept can be matched through the release letter both came from.

**Cons:** two instances still name the same concept by different addresses, so matching them goes through the "came from" record. The install step is new work.

### Option B — A release, used at the publisher's addresses

Every instance records the release's letters and uses them as they are, so a firmware concept's address is `39998:<publisher>:<slug>` on every instance.

**Pros:** one vocabulary on every instance, with nothing to match. An element filed under the publisher's concept means the same thing everywhere.

**Cons:**
- Every place code builds a firmware address from the instance's assistant changes. That goes against the runtime-assistant rule and well beyond ADR 0015's named exception.
- Every element already filed under `39998:<assistant>:<slug>`, on every instance, has to move. That is the orphaning ADR 0015 was written to avoid.
- On a fresh instance the reads don't count the publisher's nodes. They aren't the instance's own, and the publisher has no GrapeRank score there yet, so the trust test would need a special case.
- An admin can't edit the publisher's letters, only copy them, so local edits change shape.

### Option C — A file bundle, no nostr

The firmware is written as a bundle (export file, A10.35) and published at a URL or as a release asset. An install reads it and writes the instance's own nodes, as today.

**Pros:** the simplest option of the three. No key and no relay, and it works offline.

**Cons:** the firmware isn't a Tapestry anyone can find on nostr, which is the point of P-160. Nothing in the catalog imports a bundle (import file records a pointer to a file).

### Option D — Keep `firmware/`, and build A10.37 on its files (P-160's case against)

**Pros:** it works today, and adds no key, pin or relay. A10.37's keeping of local edits lands without waiting for a release.

**Cons:** the firmware stays in the repo, so P-160's goal isn't met. A firmware change still ships only with a new image, and an instance can't install another firmware. As an end state it is today's way. As a first step it is compatible with A: A10.37 can land on the files and take a release as its source later.

## Decision

**Option A, with Option D's step first.** Firmware ships as releases: pinned, published Tapestries that each instance installs as nodes of its own. Seed-firmware may land first with today's files as its source.

A **release** is a release element and the letters it lists. The **release element** is the one Tapestry element that names the release's version and lists its members.

1. **Whose addresses: the instance's own.** Seed-firmware writes each letter of a release as a node of the instance's own, at the address the instance gives it today: its header's, its core nodes', and its elements' and sets', all made from the instance's assistant's pubkey. Each node keeps the design doc's "came from" record, naming the release letter it came from by address and event id, in the form that question settles. `firmware.conceptUuid`, every runtime lookup of the assistant, and ADR 0015's exception stay as they are.
   - **The release's letters aren't recorded as the publisher's nodes.** The "came from" record names them instead, so each firmware concept is one node on the instance, found once from every point of view. If they were recorded as well, each concept would appear twice: under `everyone`, and under the owner's view once the firmware key scores above the GrapeRank cutoff. A ref like `superset` would then answer `ambiguous-ref`.
   - **Signed, as today.** Seed-firmware signs each copy with the instance's assistant, as today's install does. Code reads the instance's own letters from its strfry: the community-reference pass reads the local header there and re-signs it, and the Tapestries UI reads Tapestry elements there (BIBLE §6). Whether seed-firmware stops signing once those readers read the graph is A10.37's to decide.
   - **By the bootstrap path.** Seed-firmware writes the copies by the bootstrap path (catalog §8), as today's install does, not through copy-node's guards. On an empty instance the guards have no concepts to check against until the release's are in. It writes them in the order today's install uses, and `rules check` (A10.31) is to run over the result.
   - **What this changes from P-160's sketch.** P-160 sketched copy-node in bulk, and import nostr by a graph's address. Copy-node copies a node that is in the graph, and a release's letters aren't recorded, so seed-firmware writes the copies itself. It reuses import nostr's reading of relays and its check of each letter. The "came from" record and copy-node's link back should take one form, set by whichever is built first.
2. **Who signs: a firmware key that NosFabrica keeps.** An assistant key lives and dies with one deployment's data volume, and nothing backs it up apart from that volume. The firmware's publisher has to outlive any one deployment. So releases are signed by a firmware key kept apart from every deployment. It signs as the assistant of one firmware instance, set up with that key. There the firmware is kept with the graph operations, and released with export nostr. `setup/create_nostr_identity.sh` keeps a key that is already in place at the first start, which is the likely way to set the instance up; it hasn't been tried. Anyone else may release a firmware Tapestry of their own.
3. **Which release an instance installs.** The code carries a pin: the release element's address, its event id, and the relays to fetch it from. The relays are more than one, so that no relay is a canonical home. The pin names the release the code was tested with, and an instance installs it by default. An operator can name another release for their instance without changing the code, at the risk of running firmware the code wasn't tested with.
4. **Releases: never changed once published.**
   - The release element's d-tag names its version, and it is never republished: a fix is a new release.
   - Its members carry the release in their d-tags as well, so publishing the next release adds letters rather than replacing these on a relay (NIP-01).
   - The release element lists each member by address and event id, in a top-level section beside the `graph` block BIBLE §6 defines.
   - The installer checks the release element against the pin, and each member against the id the release element lists for it. An event id is a hash of the event, and each letter's signature is checked too.
   - Nothing is written until every letter has been fetched and checked. A letter that is missing or doesn't match stops the install, and the instance keeps the firmware it had. The community-reference pass skips a header it can't fetch and carries on, but a release with a member missing would be a partial firmware.
   - The exact form, the d-tags and the member list, is the release convention's. Its draft goes in this repo's `protocols/drafts/` first, and moves to NosFabrica/protocols as it matures (protocols/README.md), which is where A10.43's Loom detail points.
5. **Updates keep local edits, except where ADR 0041 says otherwise.** An update installs the next pinned release through A10.37's path. A node the release changes is brought in line unless an admin has edited it. An edited node is left as it is, and reported. The graph-rule items are the exception: every install keeps them in line with the rulebook, and puts back an edit, as ADR 0041 Decision 6 says.
6. **What stays in the repo: the code, and the pin.**
   - The design doc's §9 presumes that the Tapestry Graph Conjecture's "installation file" is the firmware. Under this decision that content is the pinned release, and the repo keeps only the pin that names it. Whether an empty instance needs anything beyond the code and the pin is left open (Consequences).
   - The firmware JSON (`firmware/versions/…`, `firmware/active`) leaves the repo once the equivalence check (Decision 7) passes.
   - The graph-rule elements are made by `src/firmware/graph-rules.js`, from the rulebook (`docs/GRAPH_RULES.md`) and the rules' code. They are generated when a release is made, and published with it. The repo keeps the rulebook and the generator.
   - The repo holds no copy of a release. Tests read the pinned release from its relays, through a cache kept outside the repo. An offline install reads a file of the release's signed letters that its operator brings, checked against the pin the same way.
7. **The equivalence check, before `firmware/` goes.** Two scratch instances are set up with one assistant key, so that every address, and every element's and set's hash suffix, comes out the same on both. One installs from today's files, and the other from the first release. They match when:
   - every address is on both, with the same relationships between addresses;
   - each node's tapestryJSON, read with `cache get` on each, is the same on both, once its `graphContext` (local by definition, BIBLE §21) and its "came from" record are set aside.
8. **What each task then does.**
   - **Seed-firmware (A10.37)** installs a pinned release: it fetches, checks, writes the instance's own nodes by the bootstrap path, keeps local edits (Decision 5), and reports what it changed and what it left as it was. It may first land with today's files as its source, so that keeping local edits isn't held up.
   - **Export nostr (A10.34)** makes a release from a scope: the release element and its members, at addresses that name the release, with the members listed by address and id. Sending them from the server would make export nostr a second server-side publisher. ADR 0004's posture forbids that outside `src/api/dlist-curation/`, and its RE1 test checks for it. So either A10.34's own ADR makes the exception, or a release is sent from a browser, as a concept is.
   - **Import nostr (A10.32)** needs nothing new. Seed-firmware reuses its relay reading and its letter checks.
   - **Copy-node (A10.24)** shares one form with seed-firmware for the record of where a copy came from.
   - **New stories, drafted when this ADR merges:**
     - the firmware key, the firmware instance, and the first release, equal to today's `v1.0.0` files;
     - the equivalence check (Decision 7);
     - reading the installed firmware from the graph, wherever code reads the firmware module today;
     - BIBLE §7 and §14, for installing from a release and for the relays a fresh install now needs;
     - taking `firmware/` out of the repo;
     - the release convention's draft in `protocols/drafts/` (a record task), since other implementations read it.

## Consequences

- **Enables:** firmware out of the repo, and installs from relays. Anyone can release a firmware Tapestry, and an instance installs the one its pin, or its operator, names. An instance can say which release it runs, and what its admins have changed since.
- **Costs:**
  - A key to keep, back up and some day rotate. A rotation means a new publisher, so a new pin.
  - A fresh install needs one of the pin's relays, or the operator's file. Today it needs neither, so BIBLE §14 has to say so.
  - Firmware changes stop being pull requests to `firmware/`, so a release needs a review of its own. Export nostr's dry run, which lists new, changed and unchanged letters, is the start of one.
  - Code and firmware move in step through the pin, so a code change that needs new firmware ships with a new pin.
- **Firmware reinstall required?** No. This ADR changes no code and no firmware.
- **Not checked, for the stories to prove:**
  - that an empty instance can build everything it needs from a release with no firmware files present, the direction the Tapestry Graph Conjecture points;
  - that a release element fits a relay's limits. This repo's strfry setup raises `maxEventSize` from strfry's 65,536 to 1,048,576 bytes (`setup/install-strfry.sh`, `setup/strfry.conf.template`), but leaves `maxWebsocketPayloadSize` at 131,072, so an event sent to the relay over a websocket can be at most 128 KiB. The member list alone runs to about 436 letters at a rough 200 bytes each, near 90 KB, before the `graph` block. The DList relay's own limits weren't checked. If a release element doesn't fit, its member list can be split, each concept's concept-graph letter listing that concept's members;
  - that an instance can be set up with a given assistant key (Decision 2).

## Implementation notes

- The community-reference pass is the model for the fetch and the check: fetch by relays, check by id, import with `buildImportCypher`. Unlike it, a release stops the whole install on one missing or mismatched letter (Decision 4).
- The member list is an added top-level section, which the Tapestry republish builders pass through (BIBLE §6; `ui/src/pages/tapestries/tapestryDraft.mjs`).
- To find the firmware module's readers: `git grep -l -E "normalize/firmware['\"]|require\(['\"]\./firmware['\"]\)|firmware/active" -- src`.

## Out of scope

- **The builds.** Each one in Decision item 8 is a task of its own.
- **Moving existing instances' graphs.** There is nothing to move under Option A.
- **Export's open questions that firmware doesn't need answered:** other people's elements in an export (catalog §10, question 9), references to nodes with no nostr address (design doc §5, question 4), and who may sign as the assistant (catalog §10, question 2).
