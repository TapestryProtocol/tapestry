# ADR 0043: Firmware ships as pinned Tapestry releases, which each instance imports and installs as nodes of its own

**Status:** Accepted
**Date:** 2026-11-20
**Story:** none. This ADR answers Loom decision task A10.43, drafted from proposal P-160. Its plan is [docs/loom/A10.43.md](../../../docs/loom/A10.43.md). Its decider accepts it by merging it.

## Context

**Firmware today.** The firmware is the JSON under `firmware/` (BIBLE §7). `firmware/active` points at `versions/v1.0.0`, which defines 41 concepts and 11 relationship types, with their elements and sets. `src/firmware/install.js` reads those files. Pass 1 creates each concept and element through the normalize routes, which sign with the instance's assistant key, publish to the local strfry and import into Neo4j. Pass 2 re-signs each concept's JSON Schema with its full content. So every instance holds a signed copy of its own, at addresses made from its own assistant's pubkey: `39998:<assistant>:<slug>` for a header, and deterministic d-tags for its core nodes, built by `firmware.conceptUuid(slug)`. The assistant key is made at a deployment's first start and differs on every deployment, which is why code resolves it at runtime and never hardcodes it (CLAUDE.md). ADR 0015's legacy z-tag pubkey is the named exception. Seventeen files under `src/` read the firmware module or `firmware/active` at runtime.

**What David wants** (P-160): "One of my goals is to publish firmware as a tapestry, and do it in a manner such that installation of firmware for a new instance can occur via an import function, thus removing the need for the firmware to live in the repository."

**What already exists to build on.**
- **A Tapestry** (`39998:<assistant>:tapestry`) is a graph of concept graphs. Its element's `graph` block lists its nodes, relationship types and relationships, and imports its member concepts' concept-graph core nodes (BIBLE §6).
- **Install already imports from relays, on a small scale.** Its community-reference pass (`pass_communityReferences` in `src/firmware/install.js`; community-reference ADRs 0030 and 0034) reads a concept's `communityReference`. It fetches the curator's header from the reference's `relayHints`, by id when `knownGoodEventId` is set, and skips it when the fetched id doesn't match. It imports the header with `buildImportCypher`, and links the instance's own header to it with a `pointer` b tag.
- **Exporting a concept.** Community-reference ADR 0004 exports a concept as its own-authored letters, rooted at its concept graph, and rejected bundling a concept into one event, since an importer then can't address its parts. Its Revision 1 sends concept letters to `wss://dcosl.brainstorm.world` only, and requires the import's relay hints to name the same relays.
- **The graph operations.** Export nostr (A10.34) publishes a scope: a node, a graph or everything (D12). Import nostr (A10.32) records letters as nodes, by id, address, a graph's address or a filter. Copy-node (A10.24) copies someone else's node into a node of your own, linked to theirs (D8). Seed-firmware (A10.37) installs or updates the built-in concepts without undoing local edits. An import skips the write checks (D4), so an empty instance can import letters before the concepts they name exist.

**Constraints.**
- **Local-first** (BIBLE §30). Installed firmware is part of the instance's own graph, and an admin's edits to it survive an update (A10.37).
- **Permissionless publishing** (CLAUDE.md, principle 2). Anyone may publish a firmware Tapestry. Which one an instance installs is the instance's choice, made by its pin.
- **Replaceable letters** (NIP-01). For an addressable event, a relay need keep only the newest version and may discard older ones. So a release whose letters share their addresses with the next release may not be fetchable once the next one is published.
- **Import order** (memo #130 on A10.32). Today, an addressable event that something has referred to by id before it arrives can't then be imported. Firmware letters refer to each other throughout, so an install by import needs an import that works in any order.

## Options considered

These are options for whose addresses an instance uses, the question the others follow from.

### Option A — Install and adopt (P-160's recommendation)

An instance imports the pinned release and installs each of its nodes as a node of its own, at the address it would have today (`39998:<its assistant>:<slug>`), linked back to the release letter it came from.

**Pros:** no address on any instance moves, and `firmware.conceptUuid` and every runtime lookup of the assistant stay as they are. An admin's edits are edits to the instance's own nodes, which A10.37 already keeps. The reads count the firmware as the instance's own, as they do today. Two instances' copies of a concept can be matched through the release letters they link back to.

**Cons:** two instances still name the same concept by different addresses, so matching them goes through the link back. Installing a release as the instance's own nodes is new work: copy-node, in bulk.

### Option B — The publisher's addresses everywhere

Every instance imports the release's letters and uses them as they are, so a firmware concept's address is `39998:<publisher>:<slug>` on every instance.

**Pros:** one vocabulary on every instance, with nothing to match. An element filed under the publisher's concept means the same thing everywhere.

**Cons:**
- Every place code builds a firmware address from the instance's assistant changes. That goes against the runtime-assistant rule and well beyond ADR 0015's named exception.
- Every element already filed under `39998:<assistant>:<slug>`, on every instance, has to move. That is the orphaning ADR 0015 was written to avoid.
- On a fresh instance the reads don't count the publisher's nodes. They aren't the instance's own, and the publisher has no GrapeRank score there yet, so the trust test would need a special case.
- An admin can't edit the publisher's letters, only copy them, so local edits change shape.

### Option C — A file bundle, no nostr

The firmware is written as a bundle (export file, A10.35) and published at a URL or as a release asset, and install reads it.

**Pros:** the simplest option. No key and no relay, and it works offline.

**Cons:** the firmware isn't a Tapestry anyone can find on nostr, which is the point of P-160. Nothing in the catalog imports a bundle (import file records a pointer to a file). The bundle's integrity needs a hash published somewhere else.

## Decision

**Option A.** Firmware ships as releases: pinned, published Tapestries that each instance imports and installs as nodes of its own.

1. **Whose addresses: the instance's own.** Seed-firmware installs each node of a release at the address the instance gives it today, `39998:<its assistant>:<slug>` and the deterministic core-node d-tags. It links each one back to the release letter it came from, by that letter's address and event id, in the form copy-node (A10.24) settles for a copy. The curation-copy convention's `q` tag, holding the original's address and the id of the version copied (D8), is the precedent. `firmware.conceptUuid`, every runtime lookup of the assistant, and ADR 0015's exception stay as they are. Seed-firmware settles whether the release's letters are also recorded as the publisher's nodes, or only named by the link back. Either way, the reads count only the instance's own copies.
2. **Who signs: a firmware key that NosFabrica keeps.** It is not an assistant key made at some deployment's first start, which a rebuild would replace. It signs as the assistant of one firmware instance, set up with that key. There the firmware is kept with the graph operations, and released with export nostr. Anyone else may release a firmware Tapestry of their own. An instance installs the one its code pins.
3. **Releases: never changed once published, and pinned by event id.**
   - A release is one Tapestry element whose d-tag names its version, and it is never republished: a fix is a new release.
   - Its member letters carry the release in their d-tags as well, so publishing the next release adds letters rather than replacing these. The exact form is the release convention's, in its NosFabrica/protocols spec.
   - The release element lists each member by address and event id, in a top-level section beside the `graph` block BIBLE §6 defines.
   - The code pins one release by the event id of its element. An event id is a hash of the event, so the installer checks every letter it fetches against the pin, as the community-reference pass checks `knownGoodEventId` today, and installs nothing that doesn't match.
   - An update installs the next pinned release through A10.37's path. A node the release changes is brought in line unless an admin has edited it. An edited node is left as it is and reported.
4. **What stays in the repo: the code, and the pin.**
   - The pin is the release element's address, its event id and the relays to fetch it from, in one small file the code reads. It is the "installation file" of the Tapestry Graph Conjecture (design doc §9), kept as small as it can be.
   - The firmware JSON (`firmware/versions/…`, `firmware/active`) leaves the repo once an install from the first release matches an install from today's files.
   - Some firmware is generated from code today: `src/firmware/graph-rules.js` makes the graph-rule elements from the rulebook, `docs/GRAPH_RULES.md`, and the rules' code. That part is generated when a release is made, and published with it. The repo keeps the rulebook and the generator.
   - Tests and an offline install read the pinned release either from the relays or from a file of the release's signed letters, which checks against the pin the same way. The file is a cache of the release, never its source. The release story picks which.
5. **What each task then does.**
   - **Import nostr (A10.32)** imports a release by its element's address or id, with its members by id, in any order. It checks each letter's id and signature.
   - **Export nostr (A10.34)** makes a release from a scope: the release element and its members at addresses that name the release, with the members listed by address and id. It sends them to the DList relay, as community-reference ADR 0004's Revision 1 does for a concept.
   - **Copy-node (A10.24)** copies in bulk: for each release letter, it makes a node of the instance's own, at the instance's address, linked back to the letter.
   - **Seed-firmware (A10.37)** installs a pinned release: fetch, check against the pin, import, copy, keep local edits, and report what it changed and what it left as it was.
   - **New stories, drafted when this ADR merges:**
     - the firmware instance and the first release, equal to today's `v1.0.0` files;
     - an equivalence check: an empty scratch instance installs the first release, and its graph and every node's tapestryJSON match an install from today's files (D10's cache check makes the per-node comparison);
     - reading the installed firmware from the graph wherever code reads `firmware/active/` today;
     - taking `firmware/` out of the repo;
     - a record task in NosFabrica/protocols for the release convention (addresses that name the release, and members listed by id), since other implementations read it.

## Consequences

- **Enables:** firmware out of the repo, and installs from relays. Anyone can release a firmware Tapestry, and an instance chooses one by its pin. An instance can say which release it runs, and what its admins have changed since.
- **Costs:**
  - A key to keep, back up and some day rotate. A rotation means a new publisher, so a new pin.
  - Installs need a relay, or the cache file.
  - Firmware changes stop being pull requests to `firmware/`, so a release needs a review of its own. Export nostr's dry run, which lists new, changed and unchanged letters, is the start of one.
  - Code and firmware move in step only through the pin, so a code change that needs new firmware ships with a new pin.
- **Firmware reinstall required?** No. This ADR changes no code and no firmware.
- **Not checked, for the stories to prove:**
  - that an empty instance can build everything it needs from a release with no firmware files present, the direction the Tapestry Graph Conjecture points;
  - that a release element listing every member fits a relay's limit on event size. This repo's strfry setup sets `maxEventSize = 1048576`. A release lists something like 400 to 450 letters, at a rough 200 bytes each, under 100 KB. The DList relay's own limit wasn't checked, and other relays may allow less;
  - that an instance can be set up with a given assistant key. `src/utils/assistantKeys.js` reads the pubkey from `TA_PUBKEY`, `brainstorm.conf` or SecureKeyStorage, and nothing was tried.

## Implementation notes

- The community-reference pass is the model for the install side, and the start of seed-firmware's fetch-and-check step: fetch by `relayHints`, check `knownGoodEventId`, import with `buildImportCypher`.
- The release element keeps BIBLE §6's `graph` block. The member list is an added top-level section, which the Tapestry republish builders pass through (BIBLE §6).

## Out of scope

- **The builds.** Each one in Decision item 5 is a task of its own.
- **Moving existing instances' graphs.** There is nothing to move under Option A.
- **Export's open questions that firmware doesn't need answered:** other people's elements in an export (catalog §10, question 9), references to nodes with no nostr address (design doc §5, question 4), and who may sign as the assistant (catalog §10, question 2).
