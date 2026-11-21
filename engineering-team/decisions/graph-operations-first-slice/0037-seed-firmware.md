# ADR 0037: Seed-firmware builds the firmware's nodes from its source, then writes only what changed and keeps what was edited

**Status:** Accepted
**Date:** 2026-11-20
**Story:** `engineering-team/stories/graph-operations-first-slice/37-seed-firmware.md`
**Accepted:** by the owner, as drafted, 2026-11-20, with its three changes to the story: Decision 5's departure from pass 3b, and Decision 8's two rules for relationships (one the firmware no longer makes is taken out; on first contact a missing one is kept). The story's AC1 and AC4 say so.
**Amended by:** `community-reference` ADR 0035, Amendment 1 (2026-11-21): a community reference whose curator is the instance's own assistant gets no pointer `b` and no claim, so Decision 4's "each of the six headers" is each one the instance doesn't curate itself. `src/firmware/target.js`, its oracle (`test/helpers/todaysFirmwareRoutes.js`) and `src/operations/catalog/graph/_sets.js`'s firmware links skip it, as today's install does.

ADR graph-operations-first-slice/0043 binds this one: firmware ships as pinned Tapestry releases, each installed as nodes of the instance's own. Its Decisions 1, 4, 5 and 8 are cited by number below, as "ADR 0043, Decision n".

## Context

The story asks for `lifecycle seed-firmware`, with seven criteria:
- **AC1:** an unsigned install of the firmware the instance carries, equal to today's install's nodes apart from `NostrEvent` and `id`.
- **AC2:** an install record on each node, an installed-firmware graph, and `lifecycle status` reporting it.
- **AC3:** safe to repeat.
- **AC4:** updates that keep local edits, a re-pointed `b` included. A node today's install made is kept when it differs from the source, and a call can take the firmware's version of a kept node.
- **AC5:** graph-rule's items always in line with the rulebook.
- **AC6:** a report of each node's outcome, a change entry, and `rules check` over the result.
- **AC7:** its refusals, owner and admins only, the CLI and `/docs`, and an agent's live use.

What the code does today, read on staging `79c8a098`, beyond the story's twelve facts:

1. **How each route builds what today's install signs.**
   - **create-concept** (`handleCreateConcept`, `src/api/normalize/index.js:1217`). For firmware, install passes `dTag: slug`, `overwrite: true` and `conceptHeaderOverrides` (`src/firmware/install.js:196-203`). The overrides go into the header's `conceptHeader` block, all but description, `oNames`, `oSlugs`, `oKeys`, `oTitles` and `headerTags`. So a firmware file's `oLabels` and `x-tapestry` win. Its `headerTags` become literal tags after the description tag (`index.js:1274-1310`).
   - **The graph operations' copy of create-concept.** `conceptNodes` (`src/operations/catalog/graph/_concepts.js:161`, ADR graph-operations-first-slice/0016) builds the same eight nodes, with two differences:
     - it adds the spec's `o` tag to each core node, which today's route doesn't sign;
     - it takes its `z` addresses and relationship aliases from the firmware module's cached manifest (`firmwareUuid`, `rel()`).
   - **create-element** (`index.js:1798`). It signs `d` (`childDTag(name, header)`), `name`, `z` and the file's JSON as `json`. It adds a `z` for each target of the header's pointer `b` (`index.js:1894-1902`). Pass 1b runs before the community-reference seed, so a firmware element gets the concept's `z` alone. It sets `ListItem` and a `slug` property (`:1912-1919`), and a `HAS_ELEMENT` from the superset. It refuses a name that the concept's class thread already holds, whoever its author is (`:1827-1838`).
   - **create-set** (`index.js:4345`). It signs `d`, `name`, `z` (the set concept), `s` (the parent) and `description` when there is one, but no `json`, and sets `Set`. Then it signs a relationship letter at a random d-tag, with `name` ("<parent name> IS_A_SUPERSET_OF <set name>"), `z` (the relationship concept), `nodeFrom`, `nodeTo` and `relationshipType`. Then it makes the `IS_A_SUPERSET_OF`. A set already there returns early, so each set has one such letter.
   - **save-schema** (pass 2, `index.js:2006`). It keeps the schema node's word block and sets `jsonSchema` to `{ $schema, type: 'object', ...the file's jsonSchema }`. It re-signs through `regenerateJson` (`src/api/normalize/helpers.js:124`), which rebuilds the tags in the order of their tag nodes' uuids (`ORDER BY t.uuid`), which are hashes. So a re-signed node's tags come in a hash order.
   - **apply-enumerations** (pass 3b, `index.js:5983`). It copies the enumerating concept's elements, as the graph holds them, into five firmware schemas: `word`, `graph`, `property`, `relationship` and `dog`. Every concept header's key goes into `word.wordTypes`, user concepts' included. Where the manifest says so, it adds a pair of `allOf` conditionals for each value, and it re-signs through save-schema. Proposal P-156 (open) found that `word`'s conditionals can't be met by any element of `word`. ADR 0019 sends this route to rule 10, under which "nothing copies them into a schema" (catalog §9).
   - **wire-implicit-elements** (pass 3c, `index.js:5844`). For every concept, `word` included, it gives each node whose `z` names the concept and that has no class-thread path a `HAS_ELEMENT` from the superset, then prunes.
2. **Firmware's definition is already read in three places:**
   - the address of each element file, `firmwareElements` (`_elements.js:436`, its `installName` at `:417` not exported);
   - the links firmware makes and the supersets its prune covers, `firmwareLinks` (`_sets.js:294`);
   - the memberships behind `firmware-membership` (`_memberships.js:62`).

   Each reads the firmware module's cached folder, `firmware/active`, which is fixed in `src/api/normalize/firmware.js:18` with no override. So no suite can point an install at another firmware.
3. **The cache.**
   - The derive step builds a node's tapestryJSON from its cached copy when that copy has a word block, and from its `json` tag only otherwise (`src/lib/derivers/word.js:52-77`; `set.js:31-33`). A rewritten `json` tag therefore needs its entry removed first, as `src/api/strfry/tapestryBrainWrite.js:96-104` does.
   - It reads only some node properties (`src/lib/tapestry-derive.js:89-92`), so no install record would reach tapestryJSON.
   - `GET /api/tapestry-key/:key` never rebuilds a stale entry.
   - An offloaded `json` tag (`lmdb:<tapestryKey>`) shares one entry with the node's tapestryJSON.
   - The graph writes never derive, and say `cacheOutOfDate` instead (ADR 0021, Decision 16).
4. **A graph write on a node that has a letter** keeps "its `id`, `pubkey`, `created_at`, labels and links", and answers `letterOutOfDate` until export nostr sends a new letter (ADR 0021, Decisions 9 and 13). An old route that imports the old letter again, `POST /api/neo4j/event-update`, can then undo the write (ADR 0021, Consequences).
5. **Lifecycle.**
   - **The lock.** `C.begin` takes the lifecycle lock, refusing `busy` while another lifecycle job runs. It refuses `graph-unavailable` when Neo4j doesn't answer within 5 s (`src/operations/catalog/lifecycle/_common.js:73-87`).
   - **Jobs.** A job runs in a worker process (`_jobs.js:466`, `_worker.js`), and `runJob` sends any op that isn't restore or migrate to the backup job (`_jobs.js:449`). The caller's role never reaches the worker.
   - **Time.** nginx allows 900 s on `/api/tapestry/lifecycle/` (`docker/nginx.conf:43-49`).
6. **Change entries.** An entry is one `GraphChange` node naming every tapestryKey its changes give, with no cap (`src/operations/changes.js:101-136`). `graph history` finds an entry by node by reading every entry. Import nostr records one entry per event.
7. **The graph concept.** Its schema requires `graph.nodes` (`slug`, `uuid`, `name`), `graph.relationshipTypes` (`slug`) and `graph.relationships` (`nodeFrom`, `relationshipType` and `nodeTo`, each `{ slug }`), and allows other sections (`firmware/active/concepts/graph/json-schema.json:24-38`). Every reader matches a relationship's ends by slug through `graph.nodes`: the Tapestries UI's `composeGraph`, `src/api/io.js:556-600`, and import nostr's `claimsOf` (`_letters.js:246-257`).
8. **The concept lock.** Every concept write first locks the concept-header concept's header (`_concepts.js:621`), which on an empty graph isn't there. There, every concept write refuses `not-installed`.
9. **A `b` tag's claim.** The import makes `REFERENCES {source: 'b-tag'}` from the letter's own node to the node at the `b` address, or to a placeholder it makes there (`placeholderUnlessHeld`, `src/api/neo4j/eventSync.js:289-313`). So today's install leaves that edge on each of the six headers, whether or not the curator's header was fetched.
10. **Test tooling.**
    - **Fakes.** `test/helpers/cypherEngine.js` runs general Cypher with the uniqueness rules, and `cypherGraphFake.js` adds transactions. The import suites use them through `operationsHarness.js` (`engine: 'cypher'`).
    - **An oracle.** `test/helpers/todaysCreateConcept.js` runs today's route from its source in `node:vm`, with signing, the relay and Neo4j recorded, so it can't drift from the route.
    - **Rules on Cypher.** `tapestry-key-paths.test.js` holds rules on any new Cypher: G4 (every node made gets `keyNode`), G11 and G18 (a lookup by address names `NostrEvent|TapestryNode`), and G19.
11. **`rules check` in process.** `X.findingsIn(read, scope, rules)` (`src/operations/catalog/rules/_rules.js`) gives a scope's findings, and `check.js` pages them.

## Options considered

### Option A — Build the target from the source, then plan and write what changed

A builder makes the firmware's **target** from the source: every node today's install would leave, with its address, kind, labels, name, tags, JSON and where it came from, and every relationship between them. It is a pure function of the files and the assistant's pubkey, with no Neo4j, relay or key.

An installer then reads the graph at the target's addresses and plans each node and relationship against its install record: `added`, `changed`, `unchanged`, `kept` and so on. It writes the plan in one transaction, unsigned.

A release, later, is a second source that produces the same target.

**Pros:**
- AC1's equivalence and AC4's keeping of edits are both pure functions, testable without a stack.
- The release story adds a source, and the installer stays as it is.
- Today's install isn't touched.

**Cons:**
- It is a second copy of today's install's logic, which can drift from it until today's install retires (D15). Oracles pin it.
- The builder is the larger half of the work.

### Option B — Run today's install with its signing turned off

A switch for the duration of a call (for example AsyncLocalStorage) makes `signAndFinalize`, `publishToStrfry` and `importEventDirect` write unsigned nodes. The edit-keeping checks wrap each route call and each edge statement in `install.js`.

**Pros:** one copy of the logic, equal to today's install by construction.

**Cons:**
- It changes the old routes, which D15 leaves as they are.
- The run's context still carries the signer, where catalog Conventions say a write's carries nothing that signs (D1).
- Several routes overwrite before any check could run: create-concept's `overwrite`, and `regenerateJson`. So keeping edits would mean rewriting them, not wrapping them.
- A release's letters don't come from routes, so the release story would need a path of its own.

### Option C — Install from a recorded snapshot

A script runs today's install on a scratch stack and records its nodes and relationships in a file in the repo. Seed-firmware installs the file.

**Pros:** exact for the instance it was recorded on, and the installer is simple.

**Cons:**
- Every firmware change needs a scratch-stack run to re-record, and the firmware changed in a dozen commits this month.
- It adds a second copy of the firmware to the repo, against P-160's direction.
- The snapshot holds the recording instance's addresses, so every other instance must translate them. That is Option A's builder's work anyway.

## Decision

We chose **Option A**. It is the one option where keeping local edits is a function that can be tested on its own, and where the release story adds a source rather than a second installer. Its cost, a builder that copies today's install's logic, is paid down by oracles that run today's routes from their source (Implementation notes) and by the live check's first contact (Decision 13).

**1. The operation.** `src/operations/catalog/lifecycle/seed-firmware.js` declares a write (`group: 'lifecycle'`, `name: 'seed-firmware'`), with `access: 'owner-and-admins'` (story, open question 1).
- **It has `run`,** as lifecycle's writes do (write-path W1 holds `apply` to the graph group only).
- **Its inputs:**
  - `version`, optional, a string;
  - `take`, optional: up to 500 tapestryKeys or addresses of firmware nodes;
  - `takeAll`, optional, a boolean (story, open question 3; AC4).
- **Its own refusals:**
  - `unknown-version` (409), naming the version carried;
  - `firmware-unreadable` (409), naming each file and its problem (Decision 3);
  - `not-firmware` (400), naming each `take` ref that is no node of the source;
  - `no-assistant` (409), when the instance has no assistant key;
  - `address-held` (409), when a node without seed-firmware's mark holds the installed-firmware graph's address, naming it (Amendment 3);
  - lifecycle's `busy` and `graph-unavailable` (`_common.js`, whose message gains "installed").
- **It runs inline, not as a job.** It holds the lifecycle lock (`C.begin('seed-firmware')`) for its whole run, so it never runs beside a backup, restore or migrate, and two calls at once install once (AC3).
  - Its work is bounded: 459 nodes, their tags and their relationships. It finishes well inside nginx's 900 s.
  - Its one transaction either commits or leaves the graph as it was, even when the control panel stops mid-run. A stale lock is recovered by the next `C.begin`.
  - Running inline also keeps the caller's role for the change entry, which a job's worker never sees (Context 5).

**2. Two parts: a source and an installer.**
- **The source.** `src/firmware/target.js`, new: `buildTarget({ dir, ta })` → `{ version, source, nodes, relationships, problems }`. It reads, and touches nothing.
- **The installer.** `src/operations/catalog/lifecycle/_seed.js`, new: `readState`, `plan` (pure) and `apply`.
- **The release later.** A release source (ADR 0043, Decision 8) returns the same shape, with each member's `cameFrom` naming its letter.

**3. The source: today's files, read once, all checked before anything is written** (AC7).
- **The folder** is `firmware.firmwareDir()`. The firmware module gains one override, `TAPESTRY_FIRMWARE_DIR`, which no deployment sets. A suite sets it, so that the whole control panel reads the firmware it is given.
- **Read once, fresh.** The builder reads every file it needs once, fresh, not through the module's cached manifest, so one run sees one snapshot.
- **What refuses `firmware-unreadable`,** naming each problem:
  - a manifest that doesn't parse;
  - a file a manifest names that isn't there, or isn't JSON;
  - a concept an enumeration names that the manifest doesn't define. An existing node or existing set naming one is skipped, as today, and isn't a problem (Amendment 1);
  - a relationship type a concept manifest uses that `relationshipTypes` lacks;
  - a relationship alias that isn't a plain name, `[A-Z_][A-Z0-9_]*`, so no firmware text reaches Cypher's text (Amendment 3).
- **`version`.** It must be the manifest's version, `1.0.0`, or the folder's name for it, `v1.0.0`. Anything else refuses `unknown-version`.
- **`source.digest`** is the sha256 of every file the builder read, by path and by content. So two runs of the same files are known to be the same, though the version number doesn't change (story, fact 5).

**4. The target: what today's install leaves, rebuilt.** Each node of the target has:
- its address, kind and role labels (`ListHeader`, `ConceptHeader`, `ListItem`, `Superset`, `Set`, `JSONSchema`, `Property`);
- its name, its tags as today's route first signs them, and its JSON (`null` for a set and a relationship letter);
- an element's `slug` property;
- `cameFrom` (Decision 6).

Pass by pass, in today's order:
- **1a, the concepts.** For each, `conceptNodes` with the header file's names, its description, and the instance's assistant. The header's `d` is the concept's slug, and the core nodes' d-tags are the name's slug with their suffix, as today's route puts them (Amendment 1).
  - The overrides go into the header's `conceptHeader` as `handleCreateConcept` merges them, and its `headerTags` after its description tag.
  - It has no `o` tags.
  - `conceptNodes` gains parameters for its `z` resolver and its relationship aliases. They default to today's, so that the builder resolves both from the folder it read.
- **1b, the elements.** For each element file:
  - **Its address:** `39999:<ta>:<childDTag(installName(file), 39998:<ta>:<slug>)>`, as `firmwareElements` computes it. `installName` is exported.
  - **Its node:** tags `d`, `name`, `z` and `json` (the file as it is), `ListItem`, the `slug` property, and a `HAS_ELEMENT` from the concept's superset.
  - **Blocked:** an element with no node at its address, when another element with its name is in the concept's class thread. It isn't made, and the report says so: create-element's own check, which ADR 0041's Consequences note for every firmware concept.
- **1c, existing nodes.** A `HAS_ELEMENT` from the parent concept's superset to each core node the manifest's existing nodes name. The parent's concept graph keeps the form create-concept gave it, which today's route flattens (Amendment 1).
- **1c½, the sets.** Each set file at `39999:<ta>:<its word.slug, else its file name>`, with tags as create-set signs them and `ListItem` and `Set`.
  - **Its relationship letter:** the same as create-set's, at a random d-tag the first time.
  - **Its link:** an `IS_A_SUPERSET_OF` from the parent.
  - A relationship letter is matched to a node in the graph by its `nodeFrom`, `nodeTo` and `relationshipType`, never by its address, so a later run finds the one an earlier install made.
- **Existing sets.** An `IS_A_SUPERSET_OF` from the parent's superset to the child's.
- **1c¾.** Each concept manifest's `HAS_ELEMENT` and `IS_A_SUPERSET_OF`. They are resolved as install resolves them: the concept's own files first, then a node of the target whose slug, or whose name with dashes for spaces, is the one named.
- **1d.** A `HAS_ELEMENT` from each concept's superset, `word`'s excepted, to each node of the target whose `z` names the concept.
- **1d½.** A `HAS_ELEMENT` from concept-header's superset to every header of the target.
- **1d¾.** Each `ENUMERATES {sourcePath, destinationPath}`.
- **1e.** The prune, as install prunes, for the concepts that have a concept manifest, in one fixed order, by address (Amendment 1).
- **Pass 2.** Each schema's JSON: its 1a word block, with `jsonSchema` set to `{ $schema, type: 'object', ...the file's jsonSchema }`. Each primary property is as save-schema's fold re-signs it against that schema (Amendment 1).
- **The community references.** Each of the six headers' tags end with `['b', headerATag, 'pointer']`. Its claim, `REFERENCES {source: 'b-tag'}`, runs from the header to the node at that address, or to a placeholder made there, as the import makes it (Context 9). The curator's letters aren't fetched: today's pass and import nostr do that, and the pass stays as it is.
- **Pass 3c.** Wire-implicit-elements over the target, with its prune, in the same fixed order.
- **Pass 3b** isn't rebuilt (Decision 5).

**Tag order.** Each node's tag order is today's route's first signature. Where today's install re-signs through `regenerateJson`, today's order is a hash order (Context 1). The comparison (Decision 6) reads tags as a set, so order is never a difference. AC1's "the tags today's install's node carries" holds as a set.

**5. One departure from today's install: pass 3b, ratified by the owner.** Each schema is installed as its file says (pass 2), and nothing is copied into it from the graph.
- **Why.**
  - ADR 0019 sends apply-enumerations to rule 10, under which the allowed values are the source concept's elements, checked at write time, and "nothing copies them into a schema".
  - Pass 3b's values come from the graph (every concept's key goes into `word`'s), so they are no firmware's to install.
  - Its `word` conditionals fail every element of `word` (P-156).
- **What stays.** The `ENUMERATES` edges (1d¾), which rule 10 reads.
- **The cost.**
  - Of the five enumerated schemas (`word`, `graph`, `property`, `relationship`, `dog`), the ones pass 3b writes into differ from today's install's, which is an exception to AC1. In firmware v1.0.0 that is four: `dog`'s enumerating concept, `dog-breed`, has no elements, and today's route skips an enumeration with none, so `dog`'s schema is its file's either way (Amendment 2).
  - On an instance today's install installed, those four differ from the source. So by the story's open question 2 they are `kept`, until taken.

**6. The install record, and what counts as an edit.** Each node that seed-firmware writes, brings in line or adopts gets two properties:
- **`cameFrom`.** JSON text `{ "kind": "file", "address": "<the file's path in the folder>", "id": "<the file's sha256>" }`. A release member's, later, is `{ "kind": "nostr", "address": "<its address>", "id": "<its event id>" }`.
  - This is the form copy-node shares: its original's address and the id of the version it copied (D8; ADR 0043, Decision 1).
  - For firmware it moves forward with each update; copy-node sets it once.
- **`installed`.** JSON text `{ "version", "source": "<source digest>", "digest": "<content digest>", "parts": { "name", "json", "tags": { "<tag type>": "<digest>" } }, "at" }`.
- **A node's content** is three things:
  - its name;
  - its tags other than `json`, as a sorted set;
  - its `json` by value, read with the derive's reader (`lmdb:` references resolved, `graphContext` and the two record sections set aside), with `word.wordTypes` read as a set (Amendment 3).

  Labels, tapestryKey, `id`, `created_at` and the other properties aren't content.
- **A node is edited** when its content's digest isn't `installed.digest`. The parts say what differs: its name, its JSON, or a tag type, such as `b`.
- **`cache get` answers it** (AC2). The derive puts both properties into the node's tapestryJSON, as top-level `cameFrom` and `installed` sections, only when the node carries them (Amendment 3).
  - That is a change to `tapestry-derive.js`'s property list and to the `word` and `set` derivers.
  - Wherever tapestryJSON is judged against a schema (story 42's judge), the two sections are set aside, as `graphContext` is, for a node that carries them (Amendment 3).

**7. Each node's outcome** (`plan`, a pure function of the target, the graph's state and `take`):
- **No node at its address:** `added`, or `blocked` (Decision 4, 1b).
- **A node with a record:**
  - unedited: `unchanged` when the target's content is what was installed, `changed` otherwise;
  - edited: `kept`, naming the parts that differ from what was installed and from the source;
  - taken: `changed`.
- **A node without a record** (today's install made it, or a run kept it):
  - its content is the target's: `unchanged`, and its record is written, adopting it;
  - otherwise `kept`, with `noRecord: true`;
  - taken: `changed` (story, open question 2).
- **Graph-rule's items** (the concept whose manifest entry sets `updateElements`) are always brought in line (AC5): `put-back` when edited, `changed` when its file changed, `unchanged` otherwise. Another author's item with the name, where none is at firmware's address, makes `blocked` (ADR 0041, Decision 6).
- **A node the last installed-firmware graph lists, which the target lacks:** `not-in-source`. It is left as it is.
- **`take` and `takeAll`.** `take` names nodes by tapestryKey or address, and a ref no node of the target answers refuses `not-firmware`. `takeAll` takes every kept node, and every kept relationship (Decision 8).

**8. Relationships.**
- **The target's relationships** are firmware's relationship types, by type and by the addresses at their two ends, with `ENUMERATES`' two properties.
- **The last install's** are the ones the last installed-firmware graph lists (Decision 9).
- **A target relationship** is:
  - `unchanged` when it is there with its properties;
  - `changed` when its properties differ from the target and are what was installed, and `kept` when they differ from what was installed;
  - `added` when it is missing and the last install didn't list it;
  - `kept` when it is missing but the last install listed it, since it was removed since. On first contact, with no installed-firmware graph yet, a missing relationship is `kept` with `noRecord`, by the same rule as a node (story, open question 2), unless `takeAll`.
- **A relationship the last install listed that the target lacks** is taken out (`removed`): firmware no longer makes it. Nothing else is ever taken out.
- **A relationship between two firmware nodes that is in neither list** is the instance's own and stays as it is, counted as `others`. A direct link the owner made under a firmware superset is one (story, fact 2).
- **The `b` claim** goes with its tag, as the import's claims do. When seed-firmware writes a header's tags, the node's `REFERENCES {source: 'b-tag'}` is replaced by the one its `b` names.

**9. The installed-firmware graph.** One element of the graph concept:
- **Where:** at `39999:<ta>:installed-firmware`, a d-tag no element write gives, with seed-firmware's mark: its own `installed` record and its `installedFirmware` section. Anything else at that address refuses `address-held` (Amendment 3). It has no letter, `ListItem`, tags `d`, `name`, `z` and `json`, and a `HAS_ELEMENT` from graph's superset.
- **Its JSON**, in `elementJson`'s form:
  - `word`: `{ slug: 'graph--installed-firmware', name: 'graph: installed firmware', title: 'Graph: Installed Firmware', wordTypes: ['word', 'graph'] }`;
  - `graph`:
    - `nodes`: one entry for each node the install made, brought in line or adopted, each `{ slug: <its address>, uuid: <its address>, name }`. A curator's header the `b` claims is listed too, so its slug resolves;
    - `relationshipTypes`: each alias used;
    - `relationships`: `{ nodeFrom: { slug }, relationshipType: { slug }, nodeTo: { slug } }`, with `properties` for `ENUMERATES`. A kept relationship is listed in `installedFirmware.keptRelationships` instead, and a later install never takes it out (Amendment 3);
    - `imports`: `[]`;
  - `installedFirmware`: `{ version, source: { kind: 'files', digest, files }, at, by: { role, pubkey }, nodes, relationships }`.
- **Why addresses as slugs.** Every reader matches a relationship's ends by slug (Context 7), and only an address is unique across the firmware's 459 nodes and the curators' headers.
- **When it's written.** Every run that changes anything rewrites it, in the same transaction as the nodes.

**10. Writing: one transaction, unsigned, by the bootstrap path.** When the plan changes anything, `graph.writeTransaction` runs it in today's order.
- **The lock.** It locks the concept-header concept's header first, when it is there, as every concept write does (Context 8).
- **The nodes.**
  - An `added` node is made with `_eventless.makeNode`.
  - A `changed` node gets its name, tapestryValue, tags (its old tag nodes taken out, its new ones made by `addTags` with `tagRows`), role labels and `slug`.
  - It keeps its tapestryKey, `id`, `NostrEvent`, `created_at` and links, as ADR 0021's Decision 13 has a graph write keep them.
- **Then the rest:** the records, the relationships, the installed-firmware graph, and one change entry. The entry is `recordChange`, with operation `lifecycle seed-firmware` and one change per outcome naming its nodes.
- **No guard runs** (catalog §8; D4's bootstrap path). The statements meet `tapestry-key-paths`' G4, G11, G18 and G19.
- **After the commit, the cache.** For each node whose `json` it wrote, the cached entry is removed, then derived again. Each node whose record it wrote is derived again, so `cache get` answers the record (Context 3).
- **A failed derive** doesn't undo the commit. The answer counts it (`cacheOutOfDate`).
- **Then `rules check`.** It judges the firmware's own nodes, the target's nodes the graph holds (Amendment 4). The answer gives the rules run, how many findings there are, and the first 20. It reports what it finds and undoes nothing (AC6).

**11. The answer.**
- `version` and `source`;
- `nodes`: each node whose outcome isn't `unchanged`, with its outcome, tapestryKey, address, role and file, and for `kept`, what differs and `noRecord`;
- the counts of each outcome;
- `relationships`: lists of the added, removed, changed and kept ones, and counts of the unchanged and `others`;
- `letterOutOfDate`: the written nodes a letter backs, which keep their old letter until export nostr sends a new one (Context 4);
- `cacheOutOfDate`, `rulesCheck`, `change` and `note`.

A run that changes nothing writes nothing, records no entry, and answers every node `unchanged` (AC3).

**12. `lifecycle status`.**
- **Its firmware part gains `seeded`,** read from the installed-firmware graph: `{ version, at, by, source, nodes, relationships, changedSince }`. `changedSince` is how many of its nodes are edited (Decision 6). With no such graph, `seeded` is null, and the part's words say that nothing has been installed by seed-firmware yet.
- **What stays.** The version carried, and the all, some or none of today's reader (`readInstallState`).

**13. The live check, and what it proves.** On scratch stacks, with Neo4j's uniqueness rules and `tapestry-keys` applied first (story, fact 12), an admin agent runs it through the external CLI:
- **L1, first contact.** On an instance today's install installed, every firmware node answers `unchanged` and every target relationship is there. The exceptions answer `kept`: the schemas pass 3b wrote into (Decision 5; four in v1.0.0), Amendment 1's three concept graphs, and the direct links from a superset that today's prune order decides. This is AC1's equivalence as far as one instance shows it. Decision 7 of ADR 0043, with two instances and one key, is its own story.
- **L2, an empty instance.** On an instance with no firmware, it installs everything, and a second run changes nothing.
- **L3, an update.** After a header's `b` is re-pointed (`b-defer` or a raw query) and a firmware file is changed (copied in, then the control panel restarted, ledger row `2026-11-17-scratch-firmware-copy-needs-restart`), it answers the header `kept`, naming its `b`, and the changed file's node `changed`.
- **L4, taking.** `take` brings a kept node in line.

## Consequences

- **Enables:**
  - an update that keeps local edits, with each outcome reported;
  - `lifecycle status` naming what was installed and what has changed since;
  - the release story adding a source, not an installer.
- **An instance installed by seed-firmware alone isn't ready by today's readers.** `readInstallState` and `GET /api/ready` count `NostrEvent` headers, and the old routes read letters. The graph operations work on it (`supersetsOf` matches `TapestryNode`). The story's "reading the installed firmware from the graph", and the signing step, close this.
- **Stale letters.** A changed node that a letter backs keeps the old letter until export nostr signs a new one. `event-update` could import the old letter over the change, ADR 0021's caveat.
- **A second copy of today's install's logic.** It is pinned in three ways, and it retires with today's install:
  - the routes in `src/api/normalize/index.js`, by oracles that run them from their source;
  - `install.js`'s walk and edge passes, by expectations worked out from the real firmware, and by Amendment 3's tripwire, which fails whenever those passes change;
  - the whole, by the live check's L1 (Decision 13).
- **Four schemas and three concept graphs differ from today's install's** in firmware v1.0.0 (Decision 5; Amendments 1 and 2). P-156 then shows only on instances today's install installed. The concept graphs' rewrite is ledger row `2026-11-20-add-node-flattens-concept-graphs`.
- **The firmware module gains `TAPESTRY_FIRMWARE_DIR`,** and the derive gains the two record sections.
- **One transaction for a fresh install:** 459 nodes, their tag nodes and their relationships. If that ever outgrows Neo4j's transaction memory (story graph-operations-foundation #9's limit), it batches by concept, with the installed-firmware graph last.
- **No index on a change entry's keys,** so `graph history` by node reads every entry. A fresh install's entry names about 460 keys.
- **The thirteen graph writes' firmware refusals stay** while today's install is the install (story, Out of scope).
- **Firmware reinstall required?** No. No firmware file changes.

## Implementation notes

- **New:**
  - `src/firmware/target.js` (Decisions 3 and 4);
  - `src/operations/catalog/lifecycle/_seed.js` (Decisions 6 to 10);
  - `src/operations/catalog/lifecycle/seed-firmware.js` (Decisions 1 and 11).
- **Changed:**
  - `src/api/normalize/firmware.js`: `TAPESTRY_FIRMWARE_DIR`, read when the module loads, default `firmware/active`.
  - `src/operations/catalog/graph/_concepts.js`: `conceptNodes` takes an optional `z` resolver, relationship aliases, and leaves out the `o` tags when asked.
  - `src/operations/catalog/graph/_elements.js`: exports `installName`.
  - `src/operations/catalog/lifecycle/_common.js`: the graph-unavailable words.
  - `src/operations/catalog/lifecycle/status.js`: `seeded` (Decision 12).
  - `src/lib/tapestry-derive.js`, `src/lib/derivers/word.js` and `set.js`, and story 42's judge: the two record sections (Decision 6).
  - The docs: `docs/GRAPH_OPERATIONS_CATALOG.md` §8's row, BIBLE §7 (seed-firmware beside today's install) and §11 (the route).
- **For the Tester.** AC1's oracles are today's routes run from their source in `node:vm`, as `todaysCreateConcept.js` runs create-concept:
  - that helper, extended with `dTag`, `overwrite` and `conceptHeaderOverrides`;
  - new ones, in the same way, for create-element, create-set and save-schema.

  The edge passes are pinned against expectations worked out from the real `firmware/active`. The plan is pinned as a pure function, and the writes through `cypherGraphFake` with the cypher engine. A temporary firmware folder, through `TAPESTRY_FIRMWARE_DIR`, carries AC4's changed files. Each refusal has a test.

## Out of scope

- **The release source:** fetching, checking the pin, and translating a release's addresses (ADR 0043, Decision 8's new stories).
- **The signing step and the move off today's install:** export nostr (A10.34), and retiring `POST /api/firmware/install`, the Dashboard's button and the install at first start.
- **Fixing P-156 in today's install.**
- **`cache rebuild` and `cache check`** (A10.36): this derives only the nodes it writes.
- **Copy-node (A10.24),** beyond the `cameFrom` form.
- **A dry run.** Every run reports what it did, and a run with nothing to change writes nothing.

## Amendment 1 (2026-11-20, at Test Design) — what the Tester's readings of today's install settle

The Tester ran today's routes from their source over the real firmware (story 37's test plan, "Settled at Test Design"). Five places where Decisions 3 and 4 didn't say what today's install does came out of it. The owner ruled on each at the Test Design gate, as the drafting proposed, and the decisions above are corrected to match.

1. **Pass 2's primary-property fold is rebuilt.** Save-schema also re-signs each concept's primary property against its new schema: 38 of the 41 (`reconcilePrimaryPropertyForConcept`). The target's primary properties are the folded ones, as AC1 asks.
2. **Pass 1c's rewrite of three concept graphs isn't rebuilt: a second departure, beside Decision 5's.**
   - *What today does:* add-node-as-element rewrites the parent concept's concept graph as a bare `{ graph: { nodes, relationshipTypes, relationships: [] } }`. That drops its word block, each node's slug (which the graph concept's schema requires), its imports, its relationship and its Cypher. Today's install does this to `node-type`'s, `graph-type`'s and `validation-tool-type`'s on every run.
   - *The target:* those three keep the concept graph `conceptNodes` gives them, as create-concept made them.
   - *The cost:* like Decision 5's five schemas, they differ from today's install's. On an instance today's install set up, they answer `kept` with `noRecord` until taken.
   - *The route's rewrite* is ledger row `2026-11-20-add-node-flattens-concept-graphs`.
3. **Core nodes go where today's route puts them.** Today's create-concept puts the header at the manifest's slug (`dTag`) and the core nodes at the name's slug. `nostr-event-tag` is named "nostr event tagging", so its core nodes are at `39999:<ta>:nostr-event-tagging-superset` and so on. The target does the same, so `conceptNodes` takes the header's d-tag and the core nodes' apart.
4. **A concept the manifest doesn't define stops the install only when an enumeration names it.** The manifest's `elements.dog-breeds.existing-nodes` names `irish-setter` and `golden-retriever`, which no manifest concept is. Today's pass 1c makes nothing for them. An existing node or existing set that names such a concept is skipped, as today, and isn't a problem. The story's AC7 says the same.
5. **The prune runs in one fixed order, by address.**
   - *The cause:* today's 1e and 3c read a superset's direct links in Neo4j's order, and the class threads cycle through `word`'s superset. So which direct link survives depends on that order: 915 relationships in one order, 929 in the reverse.
   - *The target* prunes 1e and 3c in one fixed order, by address, so it is the same on every run.
   - *On first contact:* a link today's install kept that the target prunes is counted among the instance's own (`others`). A target link that today's install pruned answers `kept` with `noRecord`, until taken.
   - *L1* allows only such direct links from a superset (`HAS_ELEMENT` and `IS_A_SUPERSET_OF`), and lists them.

**The Tester's other choices are accepted as made** (the test plan's items 6 to 10): `_seed.js`'s seam, `readState(read, target)` and `plan(target, state, { take, takeAll })`; the field names of the target and the answer; graph-rule's first contact (`put-back` or `changed`, never `kept`); `takeAll`'s missing relationship (`added` or `changed`); and L2's second scratch container (`TAPESTRY_SEED_EMPTY_CONTAINER`).

## Amendment 2 (2026-11-21, at Implementation's live check) — `dog`'s schema

The live check's first contact on a scratch instance that today's install set up (L1) found `dog`'s schema `unchanged`. Its enumerating concept, `dog-breed`, has no elements in firmware v1.0.0: the manifest's dog-breeds existing nodes name concepts it doesn't define (Amendment 1, item 4). Today's apply-enumerations skips an enumeration with no elements (`src/api/normalize/index.js:6183`, "No elements found — skipping"). So pass 3b leaves `dog`'s schema as its file says, and Decision 5's departure shows on four schemas, not five. The design doesn't change: seed-firmware installs all five as their files say. Decisions 5 and 13 and the Consequences are corrected above, and L1 and the first-contact fixture now count the schemas pass 3b writes into from the instance's own graph.

## Amendment 3 (2026-11-21, at Review) — review round 1's findings, as the owner chose

Review round 1 (`engineering-team/reviews/graph-operations-first-slice/37-seed-firmware.md`) found two ways seed-firmware could misread or overwrite state, and eight smaller gaps. The owner chose the fix for each, as the drafting recommended. This amendment is ratified at the next gate.

1. **The installed-firmware graph is read through the LMDB** (finding 1). Both readers of its `json` (the plan's state and status's `seeded`) resolve an `lmdb:` reference, as every firmware node's `json` is read. So the Dashboard's offload leaves the record readable.
2. **`word.wordTypes` compares as a set** (finding 1; Decision 6). An offloaded node's `json` is its derived copy, and the set deriver writes a superset's `word.wordTypes` in its own order. That order isn't content, since a node's memberships are its edges (D10). So the content digest reads `word.wordTypes` sorted. An offloaded, re-derived firmware then answers `unchanged`.
3. **The installed-firmware graph has a reserved address, and a mark** (finding 2; Decisions 1 and 9).
   - *Its address* is `39999:<ta>:installed-firmware`: a d-tag that no element write gives, since theirs end in a hash of their concept's address.
   - *It counts as seed-firmware's* only when it carries seed-firmware's mark: its own `installed` record, and its `installedFirmware` section.
   - *Anything else at that address* refuses `address-held` (409), naming the node and saying it isn't seed-firmware's record. Nothing changes. So a node an admin made there is never read as the last install's lists, and never rewritten.
4. **Kept relationships are listed apart** (finding N2; Decisions 8 and 9).
   - *`graph.relationships`* lists only the relationships the install made, brought in line, or adopted as the target has them.
   - *A kept one* (removed since, or with properties an admin edited) is listed in `installedFirmware.keptRelationships` instead. A later install never takes it out: it stays as it is, and is reported `kept`.
5. **A relationship alias must be a plain name** (finding N1; Decision 3). The builder refuses `firmware-unreadable` for an alias that isn't `[A-Z_][A-Z0-9_]*`. So no text from the firmware, read from files now and from relays later, reaches Cypher's text.
6. **The record's sections come only from the node's record** (finding N4; Decision 6). The derive adds `cameFrom` and `installed` to tapestryJSON only when the node carries those properties. Otherwise it leaves a section of either name as it is: it may be a concept's own. The schema judge sets them aside only when the node carries them.
7. **Today's install and seed-firmware run apart, as the docs say** (finding N5).
   - *The race:* today's install takes no lock, so the two run at once can leave two nodes at one address.
   - *The docs:* BIBLE §7 says not to run them together.
   - *The ledger:* row `2026-11-21-todays-install-races-seed-firmware` records the race. It ends when seed-firmware becomes the install and today's install retires.
   - *No new lock:* today's install takes none, so AC7's "work as they did" holds.
8. **A tripwire on today's install's passes** (finding N7).
   - *The test* holds a digest of `install.js`'s pass functions: `pass1_bootstrap`, `pass2_enrich`, `pass_communityReferences`, and the pass-3 part of `install`.
   - *It fails* whenever they change, naming `src/firmware/target.js`, so the builder is brought in line before the digest is updated.
   - *The Consequences* are corrected to say what pins each part.
9. **Deviation 7 names its conflict with ADR 0043** (finding N3). For files, an unchanged node keeps its record. In the release story, where every member is a new letter, an update moves every unedited node's record to the new release's letter (ADR 0043, Decision 1).

## Amendment 4 (2026-11-21, at Review round 4) — rules check judges the firmware's own nodes

Staging's story graph-operations-first-slice #47 added rule 12, `word-types-hold-concept-keys`, which judges a concept's elements. Decision 10 runs `rules check` over each firmware concept's scope. The `word` concept's elements are nearly every node, firmware's and the instance's, so that run judged 447 of 460 nodes on a fresh install. On a real instance it would judge far more, and report on nodes seed-firmware never wrote (review round 4, R4-N2).

So `rules check` judges only the firmware's own nodes, the target's nodes that the graph holds, and reports only the findings on them. It no longer walks each concept's scope. The answer's `rulesCheck` keeps its shape: the rules run, the number judged, the number found, and the first 20.

The owner chose this at the round-4 gate. It is ratified at the next gate.
