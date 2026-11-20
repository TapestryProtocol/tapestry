# ADR 0043: Firmware ships as pinned Tapestry releases, which each instance installs as nodes of its own

**Status:** Accepted
**Date:** 2026-11-20
**Story:** none. This ADR answers Loom decision task A10.43, drafted from proposal P-160. Its plan is [docs/loom/A10.43.md](../../../docs/loom/A10.43.md). Its decider accepts it by merging it.

Two documents are cited by short name. The **design doc** is [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md), whose decisions are D1 to D15. The **catalog** is [docs/GRAPH_OPERATIONS_CATALOG.md](../../../docs/GRAPH_OPERATIONS_CATALOG.md).

## Context

**Firmware today.** The firmware is the JSON under `firmware/` (BIBLE §7). `firmware/active` points at `versions/v1.0.0`, which defines 41 concepts and 11 relationship types, with their elements and sets. `src/firmware/install.js` reads those files. Pass 1 creates each concept and element through the normalize routes, which sign with the instance's assistant key, publish to the local strfry and import into Neo4j. Pass 2 re-signs each concept's JSON Schema with its full content. So every instance holds a signed copy of its own, under its own assistant's pubkey:
- a header at `39998:<assistant>:<slug>`, built by `firmware.conceptUuid(slug)`;
- its core nodes at d-tags such as `<slug>-superset` and `<slug>-schema`, built in `handleCreateConcept`;
- its elements at d-tags of the form `slug(name)-hash8(parentUuid)` (`src/lib/dtag.js`), which hash their concept's address, so they differ on every instance too;
- its sets at the d-tag each set's file gives (its `word.slug`), the same on every instance apart from the pubkey;
- and, for each set, a relationship descriptor for its `IS_A_SUPERSET_OF` link, a letter that `create-set` (`src/api/normalize/index.js`) signs at a random d-tag.

The assistant key is made at a deployment's first start and kept on its data volume. Every lifecycle backup copies it, and a restore installs a backup's key on the instance it runs on (graph-operations-foundation ADR 0002). It differs on every deployment, which is why code resolves it at runtime and never hardcodes it (CLAUDE.md). ADR 0015's legacy z-tag pubkey is the named exception. The firmware module, `src/api/normalize/firmware.js`, reads `firmware/active`. Nineteen other files under `src/` require it, eighteen of them at runtime (`src/firmware/graph-rules.js` does so only when it is run by hand).

**What David wants** (P-160): "One of my goals is to publish firmware as a tapestry, and do it in a manner such that installation of firmware for a new instance can occur via an import function, thus removing the need for the firmware to live in the repository."

**What already exists to build on.**
- **A Tapestry** (`39998:<assistant>:tapestry`) is a graph of concept graphs. Its element's `graph` block lists its nodes, relationship types and relationships, and imports its member concepts' concept-graph core nodes (BIBLE §6).
- **Install already fetches from relays, on a small scale.** Its community-reference pass (`pass_communityReferences` in `src/firmware/install.js`; community-reference ADRs 0030 and 0034) reads the `communityReference` of each of six firmware concepts. It fetches the curator's header from the reference's `relayHints`, by id when `knownGoodEventId` is set. It skips the header when the fetched id doesn't match, and carries on with the install. It imports the header with `buildImportCypher`, and links the instance's own header to it with a `pointer` b tag.
- **Exporting a concept.** Community-reference ADR 0004 exports a concept by sending out its own-authored letters, rooted at its concept graph. The assistant signed them when they were made, and the owner's browser sends them. The ADR rejected bundling a concept into one event, since an importer then can't address its parts. It also rejected a server-side publisher for this export, and later exempted `src/api/dlist-curation/` (dlist-curation ADR 0004). Its Revision 1 sends concept letters to `wss://dcosl.brainstorm.world` only, "the purpose-built DList relay" (called the DList relay below), and requires the import's relay hints to name the same relays.
- **Publishing from the server.** Assistant-profile ADR 0002 publishes from the server too (`publishToRelays` in `src/api/assistant/profilePublish.js`). It says that event-tagging ADR 0002's statement, "no server external publish exists", is out of date. ADR 0004's RE1 test (`test/publish-export-a-concept.test.js`) flags only a file in `src/api/` that uses both `SimplePool` and `.publish(`.
- **The graph operations.**
  - Export nostr (A10.34) publishes a scope: a node, a graph or everything (D12).
  - Import nostr (A10.32) records letters as nodes, by id, by address, by a graph's address or by a filter. Its ADR, graph-operations-first-slice 0032, is on TapestryProtocol/tapestry#162 and not yet merged. It reads relays and checks each letter's id and signature.
  - Copy-node (A10.24) copies someone else's node into a node of your own, linked to theirs (D8).
  - Seed-firmware (A10.37) is to install or update the built-in concepts "by the bootstrap path, without undoing local edits" (catalog §8). Today's install "can also undo local edits".
  - "Every write checks its guards (D3) unless its group says otherwise, is safe to repeat (keyed as its row says), and never signs (D1)" (catalog, Conventions). D2 has a caller combine operations: "the node first, the letter on purpose". An import skips the guards (D4).
- **Provenance.** The design doc's §5, question 2, proposes a "came from" record, set once, at import: the kind of source, its address and its author. It leaves the record's form open.
- **Graph-rule items.** ADR graph-operations-first-slice 0041 makes the graph-rule concept's items from the rulebook and the rules' code, never by hand, and rules are changed in the rulebook. Its Decision 6 has every install put back an edit made to an item in the graph.
- **Concept identity across deployments** is open problem W1 (protocols/worksheet.md; protocols/drafts/tapestry-concepts.md, "Concept identity across deployments").

**Constraints.**
- **Local-first** (BIBLE §30). Installed firmware is part of the instance's own graph, and an admin's edits to it are to survive an update.
- **Permissionless publishing** (CLAUDE.md, principle 2). Anyone may publish a firmware Tapestry, and which one an instance installs is the instance's choice.
- **No canonical home** (BIBLE §14). Nothing in the protocol requires an instance to sync with another to work, and `dcosl.brainstorm.world` is "just another relay, not a canonical home".
- **Replaceable letters** (NIP-01). For an addressable event, a relay must keep the newest version, and may discard older ones. So a release whose letters share their addresses with the next release may not be fetchable once the next one is published.
- **Arrival order.** An install has to work whatever order its letters arrive in. Memo #130 on A10.32 found a case today's importer can't handle: an addressable event that something referred to by id before it arrived can't then be imported. Today's firmware letters refer to each other only by address, which doesn't meet that case: through `z` and `s` tags, the relationship descriptors' `nodeFrom` and `nodeTo`, and the community-reference pass's `b` tag.
- **The CI gate** (OPERATIONS.md §15). It runs on a clean runner, leaves out anything that touches a relay, and takes its first run as the verdict, with no retries.

## Options considered

There are four ways to ship the firmware. The first three take it out of the repo, and differ in where an install reads it from and whose addresses it ends up at. The fourth keeps today's way.

### Option A — A release, installed as the instance's own nodes (P-160's recommendation)

An instance fetches the pinned release and checks it. It then writes each of the release's members as a node of its own, at the address it would have today, recording which letter it came from.

**Pros:**
- No address on any instance moves, and `firmware.conceptUuid` and every runtime lookup of the assistant stay as they are.
- An admin's edits are edits to the instance's own nodes, which A10.37 is to keep.
- The reads count the firmware as the instance's own, and installing a release adds no second copy of any firmware concept.
- Two instances' copies of a concept can be matched through the release letter both came from. That gives firmware concepts a shared original to match by. It doesn't answer W1 for other concepts.

**Cons:** two instances still name the same concept by different addresses, so matching them goes through the record of where each came from. The install step is new work.

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

**Cons:** the firmware stays in the repo, so P-160's goal isn't met. A firmware change still ships only with a new image. An instance installs another firmware only by changing the files its image carries (pointing `firmware/active` at another version). As an end state it is today's way. As a first step it is compatible with A: A10.37 can land on the files and take a release as its source later.

## Decision

**Option A, with Option D's step first.** Firmware ships as releases: pinned, published Tapestries that each instance installs as nodes of its own. Seed-firmware may land first with today's files as its source.

A **release** is a release element and the letters it lists. The **release element** is the one Tapestry element that names the release's version and lists its members.

1. **Whose addresses: the instance's own.** Seed-firmware writes each member of a release as a node of the instance's own, at the address the instance gives it today: its header's, its core nodes', its elements' and its sets', and for each relationship descriptor a random d-tag of its own, as `create-set` gives one today (Decision 4). All of them are under the instance's assistant's pubkey. `firmware.conceptUuid`, every runtime lookup of the assistant, and ADR 0015's exception stay as they are.
   - **The install record.** Each node records the release letter it was last installed from, by address and event id. An update moves the record to the newer release's letter, so it isn't the design doc's set-once "came from" record (§5, question 2). That question settles the form of both.
   - **The release element isn't written as a node.** Seed-firmware saves what it installed as a graph of the instance's own instead, the way D12 saves a selection: an element of the `graph` concept that lists the nodes it wrote. This **installed-firmware graph** names the release they came from, by the release element's address and id, and `lifecycle status` reports that release as the instance's firmware version (catalog §8).
   - **The members aren't recorded as the publisher's nodes.** The install record names them instead, so installing a release adds no second copy of any firmware concept. Recording them as well would put every firmware concept in the graph twice: under `everyone`, and under the owner's view once the firmware key scores above the GrapeRank cutoff. A ref like `superset` would then answer `ambiguous-ref`. Under `everyone`, the six concepts with a community reference already find a second header today, the curator's, which the community-reference pass imports. That stays as it is.
   - **Unsigned.** Seed-firmware's writes never sign, like every write (catalog, Conventions; D1). Today, code reads the instance's own letters from its strfry: the community-reference pass reads the local header there and re-signs it, and the Tapestries UI reads Tapestry elements there (BIBLE §6). Until those readers read the graph instead, the install signs the copies in a separate step, as D2 describes. That step is export nostr, with the installed-firmware graph as its scope (D12) and the instance's own relay as its destination.
     - **Until export nostr can sign, today's install stays the install.** It signs as it writes, so those readers find the letters they need. Seed-firmware replaces it once export nostr can run the signing step, or once the readers read the graph.
     - **Once seed-firmware is the install, the community-reference pass stops re-signing.** Its `pointer` b tag goes on the instance's header node, and the signing step signs the header with it.
   - **By the bootstrap path.** Seed-firmware writes the copies by the bootstrap path (catalog §8), as today's install does, not through copy-node's guards. On an empty instance the guards have no concepts to check against until the release's are in. It writes them in the order today's install uses, and `rules check` (A10.31) is to run over the result.
   - **What this changes from A10.43's Loom detail.** That detail sketched copy-node in bulk, and import nostr by a graph's address. Copy-node copies a node that is in the graph, and a release's letters aren't recorded, so seed-firmware writes the copies itself. It reuses import nostr's reading of relays and its check of each letter. The install record and copy-node's link back should take one form, set by whichever is built first.
2. **Who signs: a firmware key that NosFabrica keeps, apart from any deployment.**
   - **Why a key of its own.** A deployment's assistant key is that instance's "me", a hot key that lives on its server (BIBLE §31). The firmware's publisher is a role of its own. Worksheet W1's Duty Menu note gives a shared header a key held for the purpose, Nous' key: "a deliberately held community key, not a per-deployment Tapestry Assistant, which tags-branch ADR 0015 showed to be fragile". The firmware key differs in one way: it is also the assistant of one instance, the firmware instance (next item).
   - **Why ADR 0015's fragility doesn't recur.** There, one deployment's assistant key ended up in the concept addresses that other deployments' users wrote under, so it can't be retired without leaving their events behind. Under Decision 1, no other instance's addresses carry the firmware key. It appears only where an instance names the release it installed: the pin, the install records and the installed-firmware graph. So a new firmware key means a new pin, and moves no address.
   - **Where it signs.** The firmware key signs as the assistant of one firmware instance. That makes it hot there, so that instance's security is the firmware's. On that instance the firmware is kept with the graph operations, and released with export nostr.
   - **Giving that instance the key.** Two built routes can do it: `setup/create_nostr_identity.sh` keeps a key that is already in place at the first start, and lifecycle restore installs a backup's key. Restore has already moved one instance's key to a fresh instance (A10.2's AC4, "Move a backup to a fresh instance"), the case Decision 7's pair needs. Neither route has been tried with a key made outside any instance.
   - Anyone else may release a firmware Tapestry of their own.
3. **Which release an instance installs.** The code carries a pin: the release element's address, its event id, and the relays to fetch it from. The relays are more than one, so that no relay is a canonical home. The pin names the release the code was tested with, and an instance installs it by default. An operator can name another release for their instance without changing the code, at the risk of running firmware the code wasn't tested with.
4. **Releases: never changed once published.**
   - The release element's d-tag names its version, and it is never republished: a fix is a new release.
   - Its members carry the release in their d-tags as well, so publishing the next release adds letters rather than replacing these on a relay (NIP-01).
   - The release element lists each member by address and event id, in a top-level section beside the `graph` block BIBLE §6 defines. If a release element is too big for a relay (Consequences), its member list is split, in a form the release convention settles.
   - A release carries the relationship descriptors for as long as community-reference ADR 0011 keeps them. That ADR emits them beside the `s` and `n` tags until a follow-up ADR drops them, a cutover BIBLE lists as deferred (§22). A release made after the cutover leaves them out: tapestry-concepts.md already makes a relationship letter explicit only for an editorial relationship ("Derived vs. explicit relationships").
   - The installer checks the release element against the pin, and each member against the id the release element lists for it. An event id is a hash of the event, and each letter's signature is checked too.
   - Nothing is written until every letter has been fetched and checked. A letter that is missing or doesn't match stops the install, and the instance keeps the firmware it had. The community-reference pass skips a header it can't fetch and carries on, but a release with a member missing would be a partial firmware.
   - The exact form (the d-tags, the member list and how it splits) is the release convention's. Its draft goes in this repo's `protocols/drafts/` first, and moves to NosFabrica/protocols as it matures (protocols/README.md), which is where A10.43's Loom detail points.
5. **Updates keep local edits, except where ADR 0041 says otherwise.** An update installs the next pinned release through A10.37's path. A node the release changes is brought in line unless an admin has edited it. An edited node is left as it is, and reported. The graph-rule items are the exception: every install keeps them in line with the rulebook, and puts back an edit (ADR 0041).
6. **What stays in the repo: the code, the pin, and one test copy of the pinned release.**
   - The design doc's §9 presumes that the Tapestry Graph Conjecture's "installation file" is the firmware. Under this decision that content is the pinned release, and the repo keeps the pin that names it. Whether an empty instance needs anything beyond the code and the pin is left open (Consequences).
   - The firmware JSON (`firmware/versions/…`, `firmware/active`) leaves the repo once the equivalence check (Decision 7) passes.
   - The graph-rule elements are made by `src/firmware/graph-rules.js`, from the rulebook (`docs/GRAPH_RULES.md`) and the rules' code. They are generated when a release is made, and published with it. The repo keeps the rulebook and the generator.
   - **The test copy.** The CI gate never reads a relay (OPERATIONS.md §15), so tests read the pinned release from a file of its signed letters kept with the tests. The file is checked against the pin like any install, and changes only with the pin. It is a copy, not the source: the firmware is kept on the firmware instance.
   - **An offline install** reads the same kind of file, which its operator brings.
7. **The equivalence check, before `firmware/` goes.** Two scratch instances are given one assistant key, so that their addresses come out the same. Restore can do it, from a backup taken before either installs firmware (an instance installs it at first start only when asked, `docker/entrypoint.sh`). One installs with today's install, from today's files, and the other with seed-firmware, from the first release. The check compares only the nodes that have a nostr address, and the relationships between them. It sets aside the `NostrEvent` label, which an event-less node is made without (BIBLE §6; D7), and the tag nodes today's install makes for each letter's tags, which have no address. They match when:
   - every node's address is on both, apart from the relationship descriptors, which get random d-tags, one per set, and the installed-firmware graph, which only seed-firmware writes;
   - the same relationships, by type and by the addresses at their two ends, join those nodes, so the descriptors' edges are set aside with them;
   - each node's tapestryJSON, read with `cache get` on each instance, is the same on both, once its `graphContext` (local by definition, BIBLE §21) and its install record are set aside.
8. **What each task then does.**
   - **Seed-firmware (A10.37)** installs a pinned release. It fetches, checks, writes the instance's own nodes and its installed-firmware graph by the bootstrap path, unsigned, and keeps local edits (Decision 5). It reports what it changed and what it left as it was. It may first land with today's files as its source, so that its keeping of local edits is built before a release exists. It replaces today's install once its signing step exists, or isn't needed (Decision 1).
   - **Export nostr (A10.34)** makes a release from a scope: the release element and its members, at addresses that name the release, with the members listed by address and id. It is also the install's signing step: it signs the installed-firmware graph into the instance's own relay, for as long as code reads those letters there (Decision 1). A10.34's ADR says which publisher sends a release, and how that squares with ADR 0004. Assistant-profile's `publishToRelays` already publishes from the server, or a release can be sent from a browser, as a concept is.
   - **Import nostr (A10.32)** needs nothing new. Seed-firmware reuses its relay reading and its letter checks.
   - **Copy-node (A10.24)** shares one form with seed-firmware for the record of where a copy came from.
   - **New stories, drafted when this ADR merges:**
     - the firmware key, the firmware instance, and the first release, equal to today's `v1.0.0` files, with its test copy;
     - the equivalence check (Decision 7);
     - reading the installed firmware from the graph, wherever code reads the firmware module, or the instance's own firmware letters in strfry, today;
     - BIBLE §7 and §14, for installing from a release and for the relays a fresh install now needs;
     - taking `firmware/` out of the repo;
     - the release convention's draft in `protocols/drafts/` (a record task), since other implementations read it.

## Consequences

- **Enables:** firmware out of the repo, apart from one test copy, and installs from relays. Anyone can release a firmware Tapestry, and an instance installs the one its pin, or its operator, names. An instance can say which release it runs, and what its admins have changed since.
- **Costs:**
  - A key to keep, back up and some day rotate. A rotation means a new publisher, so a new pin. The key is hot on the firmware instance.
  - A fresh install needs one of the pin's relays, or the operator's file. Today it needs neither, so BIBLE §14 has to say so.
  - Firmware changes stop being pull requests to `firmware/`, so a release needs a review of its own. Export nostr's dry run, which lists new, changed and unchanged letters, is the start of one.
  - Code and firmware move in step through the pin, so a code change that needs new firmware ships with a new pin and a new test copy.
  - The repo keeps one copy of the pinned release's letters, for the CI gate. A cache filled outside the gate, keyed by the pin's event id, would take even that out, at the cost of a second job, as OPERATIONS.md §15's live link checks run on a schedule.
- **Firmware reinstall required?** No. This ADR changes no code and no firmware.
- **Not checked, for the stories to prove:**
  - that an empty instance can build everything it needs from a release with no firmware files present, the direction the Tapestry Graph Conjecture points;
  - that a release element, and an installed-firmware graph if the signing step signs it, fit a relay's limits:
    - Both this repo's setup paths raise strfry's `maxEventSize` from 65,536 to 1,048,576 bytes: `docker/entrypoint.sh`, which every deployment runs, and `setup/install-strfry.sh`, the native path. Both leave `maxWebsocketPayloadSize` at 131,072, so an event sent to a relay over a websocket can be at most 128 KiB.
    - The member list alone runs to about 458 letters at a rough 200 bytes each, near 90 KB, before the `graph` block. Without the 22 relationship descriptors it is 436.
    - The DList relay's own limits weren't checked;
  - that an instance can be given a key made outside any instance (Decision 2's two routes). Restore has moved a key from one instance to a fresh one (A10.2).

## Implementation notes

- Import nostr's relay reading and letter checks (ADR 0032, on TapestryProtocol/tapestry#162) are the model for the fetch and the check. The community-reference pass is the precedent for pinning a letter by its id. Unlike either, a release stops the whole install on one missing or mismatched letter (Decision 4).
- The member list is an added top-level section, which the Tapestry republish builders pass through (BIBLE §6; `ui/src/pages/tapestries/tapestryDraft.mjs`).
- To find the firmware module's readers: `git grep -l -E "normalize/firmware['\"]" -- src` together with `git grep -l -E "require\(['\"]\./firmware['\"]\)" -- src/api/normalize`.

## Out of scope

- **The builds.** Each one in Decision item 8 is a task of its own.
- **Moving existing instances' graphs.** There is nothing to move under Option A.
- **Export's open questions that firmware doesn't need answered:** other people's elements in an export (catalog §10, question 9), references to nodes with no nostr address (design doc §5, question 4), and who may sign as the assistant (catalog §10, question 2).
