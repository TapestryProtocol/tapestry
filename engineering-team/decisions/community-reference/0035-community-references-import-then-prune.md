# ADR 0035: Firmware's community references prune what each import leaves behind, and skip a reference the instance curates itself

**Status:** Accepted
**Date:** 2026-11-21
**Story:** `engineering-team/stories/community-reference/39-firmware-install-leaves-tags-once.md`
**Amends:** ADR community-reference/0034. Its Decision 1 ("re-sign, republish, and import") now imports, then prunes. Its OQ-2 assumed that create-concept's header import goes through `buildImportCypher`; it doesn't.
**Amended by:** Amendment 1 (2026-11-21, review round 1, revised at round 2's check): seed-firmware's target, its oracle and graph sets' model of firmware's links follow the self-curation skip; `seededB` says whether the header's stored letter carries the `b`; the "already has a `b`" path stays exempt from the export rule, at a cost the owner accepts; and four smaller corrections.

## Context

**The story's criteria** (`community-reference` #39), in short:
- **AC-1:** after one install or several, a header with a `communityReference` holds each tag of its current letter once, its `b` included. It holds no earlier letter's tags, and has one `REFERENCES {source:'b-tag'}`, to the community header.
- **AC-2:** a community header or superset holds only the tags of the version it now holds.
- **AC-3:** an instance whose assistant is the named curator gives the header no `b` naming itself and no relationship to itself, and its superset holds each tag once.
- **AC-4:** today's state clears on the first install with the fix, with no other step.

**Orientation.** The local container is the owner's private agent-memory instance and is off-limits, so this ADR oriented on staging's and production's public concept-graph routes and the firmware manifest. That is AGENTS.md §2's fallback, with a live graph in place of the local one. Handles are as read 2026-11-21. Each instance has its own assistant: staging `8e901369…`, production `919ba08a…`, david.tapestry.ninja `a7173e2c…`, tags `a68dbf56…`.

**How the doubling happens** (source at `98c14108e`):
1. **Pass 1 re-signs every firmware header.** It calls `create-concept` with `overwrite: true` (`src/firmware/install.js:196-206`; explicit since `f3347d276`, 2026-11-04). `create-concept` imports the letter with normalize's `importEventDirect` (`src/api/normalize/index.js:159-211`). That import deletes the header's tag nodes and makes one per tag, at uuid `sha256("<address>:<tag.join(',')>:<index>")`.
2. **The community step imports again.** `pass_communityReferences` (`install.js:1074`) handles each manifest concept with a `communityReference`:
   - **The seed** (`:1106-1140`, ADR 0034 Decision 1) reads the header back from strfry. That is Pass 1's letter, with no `b`. It appends `['b', headerATag, 'pointer']`, re-signs, publishes, and runs `executeCypher(buildImportCypher(signed))` (`:1136`).
   - **The community header** (`:1167`) and **community superset** (`:1195`) are published and imported the same way.
3. **The second import adds a set.** `buildImportCypher` (`src/api/neo4j/eventSync.js:198`) MERGEs a tag node per tag, at uuid `<last 8 hex of the event id>_<index>_<type>` (`:248`), and deletes nothing. A second letter at the same address therefore adds a full set beside the first: the header keeps Pass 1's six tags and gains the seeded letter's seven. A community copy gains a set for each new version it is handed.
4. **Two other callers already clear first.** They are `POST /api/neo4j/event-update` (`eventSync.js:363-371`) and `POST /api/normalize/set-b-tag` (`normalize/index.js:4779-4795`); the latter's comment names firmware's seed as the same import path.
5. **Why it went unseen.** ADR 0034's OQ-2 assumed create-concept's header import ran through `buildImportCypher`. Because it doesn't, nobody saw that the seed's import was a second one, keyed differently.

**What the live graph shows** (public reads, 2026-11-21):
- **The six headers hold two sets each** on staging, production, david.tapestry.ninja, avi.tapestry.ninja and tags.brainstorm.world (story #39's Background).
- **Production curates its own reference.** `nostr-relay`'s `headerATag` is `39998:919ba08a…:nostr-relay`, which is production's own header. On production:
  - the seed gave that header a `b` naming itself, and `buildImportCypher` derived a `REFERENCES` from the header to itself;
  - the community step re-imported production's own superset as if it were another curator's, so each of its tags is there twice;
  - the post-derive wiring (`install.js:1369`) MERGEd an `IS_A_SUPERSET_OF` from that superset to itself.
- **Other instances' copies point at themselves.** On staging, david.tapestry.ninja, avi.tapestry.ninja and tags, the copy of `39998:919ba08a…:nostr-relay` carries a `REFERENCES` to itself. It derives from production's self-pointing `b`.
- **`feat/tags` never re-signs.** tags.brainstorm.world's six letters all date from one install, 2026-09-22. That branch's Pass 1 has no `overwrite`, so:
  - `create-concept` refuses an existing header;
  - the seed finds the `b` it wrote last time and stops (never-clobber);
  - nothing imports the header again, so its two sets have stood since.

**Constraints:**
- **ADR graph-operations-first-slice/0032** kept today's builders as they are unless a fix is cheap (D15). It rejected rewriting `buildImportCypher` (its Option B), and its recorder never writes an instance's own nodes (Decision 7.2).
- **The ledger row** `2026-11-20-todays-importers-keep-their-faults` gives "move a caller onto the recorder" as the fix shape, with each move a story of its own.
- **ADR 0034 / Story 38:** the seed is pointer-only and never clobbers an existing `b`. Legacy `firmware-community` stubs between two headers stay (Story 38 AC-7, pinned by `test/b-tag-primitive.test.js`).
- **BIBLE §30 / principle 4:** no import or reinstall may destroy locally authored graph state. Tag nodes, and the relationships a `b` derives (`REFERENCES {source:'b-tag'}`, `INHERITS_FROM`), are written only by imports (`eventSync.js:306, 312`, and `import nostr`'s recorder), so they belong to the letter, not to the owner.
- **The assistant's pubkey differs on every instance.** Read it at runtime with `firmware.getTAPubkey()`, which the step already does at `install.js:1077`. Never write a literal.

**What tests can run here:**
- `test/helpers/cypherEngine.js` runs a subset of Cypher with Neo4j 5's rules, including `buildImportCypher`'s statements (its CE5), `COUNT {…}` subqueries and `DETACH DELETE`.
- `test/helpers/pass1bChild.js` runs install's real Pass 1 in a child process, with the driver, signer, `eventSync`, the assistant's key and `fetch` stubbed.

## Options considered

### Option A — Import, then prune, in the community step; skip a reference the instance curates
- **After each import, prune.** Each letter the step imports is followed by a prune that removes from its node every tag node that the letter's import doesn't make. For a community copy, it also removes every `b`-derived relationship that letter doesn't derive. A new pure builder beside `buildImportCypher` writes the prune.
- **A header that already has a `b` is reconciled too.** The seed's "already has a `b`" path re-imports and prunes the current letter, with no re-sign and no publish.
- **A self-curated reference is skipped.** When a reference's curator is the instance's own assistant, the step skips it and removes the self-loops that earlier installs made.
- **Pros:**
  - It's a small diff, in the one caller that hits the fault on every install. `buildImportCypher`'s output, and what its other callers build, don't change.
  - It does what `event-update` and `set-b-tag` do, in a safer order. The node always holds a full set (the old one, then old and new, then new). A failed import leaves today's state, and a letter the node already holds prunes nothing.
  - It heals `feat/tags`, whose installs only ever take the "already has a `b`" path.
  - The prune builder can serve the ledger row's other callers later.
- **Cons:**
  - The ledger row's other faults (older versions over newer, the 32-bit tag key) and its other callers stay as they are.
  - The prune must know `buildImportCypher`'s tag uuids. Both live in `eventSync.js`, and the tests pin them together.

### Option B — Move the community step onto `import nostr`'s recorder
- **Sketch.** `record()` (`src/operations/catalog/import/_letters.js:481`) keys by NIP-01, keeps the newest version, replaces old tags, and answers `own` for the instance's own nodes.
- **Pros:** it is the ledger row's fix shape, and it would also fix older-over-newer for the copies.
- **Cons:**
  - **It can't take the seed.** The seed writes the instance's own header, which `record` never writes (ADR 0032 Decision 7.2), so the step would run two importers.
  - **It changes what the step builds:** `z`, `n`, `s` and structure claims, role labels, and a change entry for each import on every install, beside the step's own wiring (the cons ADR 0032 gave its Option B).
  - **It needs more around it:** a driver transaction and an operations context inside install.
  - **The risk lands on firmware install,** with a bigger diff.

### Option C — Clear inside `buildImportCypher`, for every caller
- **Pros:** one place, and every caller is fixed.
- **Cons:**
  - It changes six callers' behavior where the story changes one. The ledger row makes each move its own story.
  - `event-update` and `set-b-tag` already clear first.
  - A clear inside the builder would still need this ADR's import-then-prune order and its care for tag nodes that two nodes share.

**Also weighed:** signing the `b` into Pass 1's own letter, so that each install signs one letter, not two. It fails on three counts:
- `importEventDirect` derives no relationships, so the `b`'s `REFERENCES` would never form on a fresh instance.
- The manifest's `headerATag` would have to be copied into six definition files.
- It leaves the community copies, the self-curation and `feat/tags` as they are.

## Decision

We chose **Option A**. It fixes the one step that makes the duplicates on every install, in an order that never leaves a node without its tags, without changing what the shared builder writes for its other callers.

1. **Prune after each import in the community step.** `src/api/neo4j/eventSync.js` gets a new export, `buildPruneCypher(event, { derivedEdges })`. It returns the statements that make the event's node hold only what `buildImportCypher(event)` makes:
   - **Tags:** each tag node whose uuid isn't one that `buildImportCypher` gives this event loses its `HAS_TAG` from the node, and is deleted when no other node holds it (the care of `_letters.js`'s `TAGS_DROP`, `:311`).
   - **Derived relationships** (only with `derivedEdges`): each `REFERENCES {source:'b-tag'}` and `INHERITS_FROM` from the node whose target this event's `b` tags don't name is deleted.
2. **Where the prune runs.** Each prune runs after its import has resolved, in an `executeCypher` call of its own, so a failed import never reaches it:
   - **the seeded header:** `buildPruneCypher(signed)`, tags only;
   - **a header that already carries a `b`:** `buildImportCypher(localHeader)`, then `buildPruneCypher(localHeader)`, tags only. There is no re-sign and no publish, so Story 38's never-clobber and no-republish rules still hold;
   - **a community header or superset:** `buildPruneCypher(ev, { derivedEdges: true })`.
3. **An instance that curates its own reference skips it.** When the `headerATag`'s pubkey is this instance's assistant, the step:
   - seeds no `b`, fetches nothing and imports nothing;
   - adds nothing to `pending`, so the post-derive wiring makes no edge for that concept;
   - removes the self-loops earlier installs made: any `REFERENCES` from the header to itself, and any `IS_A_SUPERSET_OF` from the concept's superset to itself.
4. **An own header's `b`-derived relationships are not pruned.**
   - The firmware's `b` re-derives the same `REFERENCES` with a MERGE, so AC-1's single relationship holds.
   - A relationship from a `b` the owner authored, which Pass 1's re-sign drops from the letter, is the queued lost-`b` fault's to decide. This step shouldn't erase its last trace.

**The story's open questions:**
1. **Where the clearing goes:** in the community step, as above (Option A).
2. **The relationships a `b` made:** pruned for community copies, since their letter is the only source; kept for the instance's own headers (Decision 4).
3. **An older version on the relay:** left to the ledger row.
   - A `knownGoodEventId` pin imports its pinned version on purpose, and refusing an older version would change what a pin means.
   - AC-2 holds as written: the copy holds the tags of the version it holds.
4. **Testing without the local container:** on the Cypher engine and a child-process harness (Implementation notes). The live check is the book's reinstall of staging, on the owner's yes.

**Story amendments, ratified at this gate (2026-11-21):**
- **AC-2 adds:** "…and holds no `REFERENCES {source:'b-tag'}` or `INHERITS_FROM` that the version it holds doesn't derive." Copies follow their letter, and this is what clears production's self-loop from the other instances' copies once production's letter drops its `b`.
- **AC-3 adds:** "…and no relationship runs from its superset to itself." This is production's `IS_A_SUPERSET_OF` loop, found during orientation.

## Consequences

- **Enables:**
  - every install leaves each header that has a community reference, and each copy it brings in, holding its letter's tags once;
  - production stops pointing at itself;
  - each instance heals at its next install with the fix (AC-4), with no hand-written delete;
  - the prune builder is ready for the ledger row's other callers.
- **Constrains:** `buildPruneCypher` must compute the same uuids as `buildImportCypher` and read `b` tags the same way. Both live in `eventSync.js`, and the builder tests run one after the other.
- **Rollout order:** other instances' copies drop production's self-loop at their first install after production's letter loses its `b`. So either production reinstalls before them, or they drop it at a later routine install.
- **Unchanged:**
  - a failed import leaves the previous state, because its prune doesn't run;
  - re-importing a letter the node already holds makes no new tag nodes;
  - Pass 1 still rewrites each own header's tag nodes on every install, as it does today.
- **Debt:**
  - the ledger row's other faults and callers;
  - the lost-`b` fault (`stories/_intake.md`, 2026-11-21);
  - a copy whose curator still publishes a self-pointing `b` keeps its loop (production is the only one that published one, and this change stops it).
- **Firmware reinstall required?** No concept definitions change. But each instance needs one firmware install with the fix to heal (AC-4). That is the book's rollout, each install on the owner's yes.

## Implementation notes

### 1. `src/api/neo4j/eventSync.js`

- **Add `buildPruneCypher(event, { derivedEdges = false } = {})`** and export it beside `buildImportCypher` (`:408`).
- **One node uuid.** It computes the node's uuid as `buildImportCypher` does (`:200-202`): a kind of 30000 or more at `kind:pubkey:d`, any other at its id.
- **One tag-uuid function.** The tags to keep are `` `${event.id.slice(-8)}_${i}_${tag[0]}` `` for each tag with a type, the expression at `:248`. Move that expression into one small function that both builders call, so they can't drift.
- **The tags statement,** with values through `esc()` (`:46`), as text for `cypher-shell` like the rest of the file:
  ```cypher
  MATCH (n:NostrEvent|TapestryNode {uuid: '<uuid>'})-[h:HAS_TAG]->(t:NostrEventTag)
  WHERE NOT t.uuid IN [<keep>]
  WITH n, h, t, COUNT { MATCH (o)-[:HAS_TAG]->(t) WHERE o <> n } AS others
  DELETE h
  WITH DISTINCT t, others WHERE others = 0
  DETACH DELETE t
  ```
- **The edge statements, with `derivedEdges` only.** They use the `b` tags that `buildImportCypher`'s `b` branch derives from (`:289-316`): those whose `tag[1]` is a form `classifyBValue` calls `a-tag` or `event-id`. Each target is `tag[1]`. Those with `tag[2] === 'inherit'` are inherit targets, and every other one is a pointer target.
  ```cypher
  MATCH (n:NostrEvent|TapestryNode {uuid: '<uuid>'})-[r:REFERENCES]->(x)
  WHERE r.source = 'b-tag' AND NOT x.uuid IN [<pointer targets>] DELETE r
  ```
  ```cypher
  MATCH (n:NostrEvent|TapestryNode {uuid: '<uuid>'})-[r:INHERITS_FROM]->(x)
  WHERE NOT x.uuid IN [<inherit targets>] DELETE r
  ```
- **`buildImportCypher` itself doesn't change.**

### 2. `src/firmware/install.js`, in `pass_communityReferences` (`:1074-1222`)

- **The import:** add `buildPruneCypher` to the `require('../api/neo4j/eventSync')` at `:30`.
- **The self-curation branch** goes right after `curatorPk` is read (`:1093`) and before the dry-run `continue` (`:1101`). When `curatorPk === taPubkey`, log that this instance curates its own reference. Unless it's a dry run, remove the loops with a helper defined among the module's helpers near `runCypherApi` (`:97`), run as parameterized `runCypherApi` calls:
  ```cypher
  MATCH (h:NostrEvent|TapestryNode {uuid: $header})-[r:REFERENCES]->(h) DELETE r
  ```
  ```cypher
  MATCH (s:NostrEvent|TapestryNode {uuid: $superset})-[r:IS_A_SUPERSET_OF]->(s) DELETE r
  ```
  - `header` is `` `39998:${taPubkey}:${slug}` `` and `superset` is `` `39999:${taPubkey}:${slug}-superset` ``.
  - The helper stays away from the stub's comments. `test/b-tag-primitive.test.js` AC-7 fails on any `DELETE` within 200 characters of `firmware-community`, so the statements must not name that source.
  - Then `continue`: no seed, no fetch, no `pending` entry.
- **The seed** (`:1131-1138`): after `executeCypher(buildImportCypher(signed))`, run `await executeCypher(buildPruneCypher(signed))`.
- **A header that already has a `b`** (`:1128-1130`): run `await executeCypher(buildImportCypher(localHeader))`, then `await executeCypher(buildPruneCypher(localHeader))`, then set `seededB = true` as it does now.
- **The community header** (`:1167`) and **superset** (`:1195`): after each import, run `await executeCypher(buildPruneCypher(ev, { derivedEdges: true }))`, and the same with `supEv`.
- **Failures stay graceful.** Each prune sits inside the step's existing graceful `try`: a failed prune is logged, and the install carries on, as every part of this step does.
- **Nothing else changes:** Pass 1, `buildImportCypher`, the post-derive wiring (`:1324-1377`), `event-update` and `set-b-tag`.

### 3. Tests (Phase 3, the Tester's)

- **The builder, behaviorally.** Run `buildImportCypher`'s statements, then `buildPruneCypher`'s, on `test/helpers/cypherEngine.js`, over these seeded graphs:
  - a header holding Pass 1's set (uuids by `importEventDirect`'s formula), then the seeded letter: only the seeded letter's tags remain;
  - the same run twice: nothing changes the second time, with the same tag nodes;
  - a tag node another node also holds: only this node's link to it goes;
  - a copy holding three versions' tags: only the newest version's remain;
  - with `derivedEdges`: a copy whose old version's `b` made a self-loop, imported at a version with no `b`, loses the loop;
  - without `derivedEdges`: a `REFERENCES {source:'b-tag'}` to some other target stays.
- **The step, behaviorally.** Build a child-process harness on the pattern of `test/helpers/pass1bChild.js`, with these stubs:
  - `assistantKeys`: a made-up assistant;
  - `helpers`: `loadTAKey`, and a `signAndFinalize` that returns a well-formed event;
  - global `fetch`: answers `/api/strfry/scan`, `/api/strfry/publish`, `/api/relay/external`, and `/api/neo4j/query` run on the engine;
  - `eventSync`: the real builders, with an `executeCypher` that runs each statement on the engine.

  Scenarios:
  - **AC-1:** one install, and two in a row;
  - **AC-1, the "already has a `b`" path:** a feat/tags-shaped header with both sets;
  - **AC-2:** a copy with old versions;
  - **AC-3:** an assistant that is the curator. No publish, no relay call, no `pending` entry for that concept, and the self-loops are gone;
  - **AC-4:** today's production-shaped and staging-shaped states, after one run.
- **Existing suites must keep passing:**
  - `test/b-tag-primitive.test.js` (the never-clobber check, the seed's literal, OQ-1's order, and AC-7's no `DELETE` near `firmware-community`). If the self-curation helper can't stay outside AC-7's window, re-aim that test to its intent (no sweep of stubs between two headers) in Phase 3.
  - `test/b-tag-seeds.test.js`;
  - `test/community-reference-nostr-relay-stub.test.js`;
  - `test/community-reference-superset-link.test.js`.
- **The gate is scoped.** Never run the full `npm test` on this Mac, whose local container is the owner's agent-memory instance. Leave `test/event-tagging-firmware-seed.test.js` out, since it calls the local control panel.

### 4. Branches

- **`staging`, then `main`,** by the usual promotion.
- **The brains** (david.tapestry.ninja, avi.tapestry.ninja) build from `staging` (`publish-image.yml`, `deploy/RUNBOOK.md`). Each then needs a firmware install: the owner runs david's, since the install route is owner-only, and Avi runs his.
- **`feat/tags`** (tags.brainstorm.world) needs a port PR of its own, after staging's merge, on the owner's yes.
  - **What carries over:** its `buildImportCypher` has the same tag uuids and `b` branch (`eventSync.js:219`, `:259-282` there), so `buildPruneCypher` ports as it is.
  - **Its line numbers:** its `pass_communityReferences` is at `:1001`, with the "already has a `b`" check at `:1054-1058`, the seed's import at `:1063`, and the community imports at `:1094` and `:1122`.
  - **What heals it:** its Pass 1 has no `overwrite`, so its installs take the "already has a `b`" path. That path is what heals it.
  - **What it lacks:** both `cypherEngine.js` and a Pass-1 child harness. The Tester decides whether the builder suite ports there with the engine helper, which is test-only and self-contained, or whether that branch falls back to Story 38's source-contract level.
- **`feature-magic-carpet`:** nothing to port. Its headers predate Story 38 and hold no duplicates.

### 5. Rollout and checks (the book's frame, each step on the owner's yes)

Each instance gets a deploy, then a firmware install (OPERATIONS.md; `/cycle-staging`, `/cycle-prod`), then these checks through the public routes:
- the summaries' rows equal their distinct headers;
- none of the six headers or the community copies holds a repeated tag;
- on production, neither the `nostr-relay` header nor its superset has a relationship to itself.

The order: staging, then production, then david.tapestry.ninja (the owner's install), then tags (after the `feat/tags` port).

## Out of scope

- **Story #40's guards:** the summaries listing a header once, and rewrites that would sign a repeated tag.
- **The lost-`b` fault** (`stories/_intake.md`, 2026-11-21).
- **The ledger row's other faults and other callers.**
- **Refusing a self-pointing `b`** in `buildImportCypher`'s derivation, for every caller.
- **Legacy `firmware-community` stubs between two different headers** (Story 38 AC-7).
- **The local agent-memory container,** which heals at its first install after it runs the fix, at the owner's word.
- **avi.tapestry.ninja's install,** which is Avi's.

## Amendment 1 (2026-11-21, at review round 1; the owner chose to fix all its findings before the pull request) — seed-firmware's target follows the skip, and `seededB` says whether the letter carries the `b`

*Revised the same day, before ratification, at review round 2's independent check: item 2's publish check made explicit, item 3's reasons corrected, and item 8 added.*

Review round 1 (`engineering-team/reviews/community-reference/39-firmware-install-leaves-tags-once.md`) found two blocking issues and five non-blocking ones. The branch first merged `staging` (`7b7f5d1e2`), which brought in `lifecycle seed-firmware` (graph-operations-first-slice #37, ADR 0037). Where a finding offered two fixes, the Architect chose one, below.

1. **Seed-firmware's target and its oracle skip a reference the assistant curates itself (Blocking 1).**
   - **The target.** `src/firmware/target.js` rebuilds what today's install leaves (ADR 0037 Decision 4). Its community-references step skips a reference whose curator, the `headerATag`'s pubkey, is the target's assistant `ta`: no pointer `b` on the header, no `REFERENCES {source:'b-tag'}` claim, and no entry in `references`. That is what Decision 3 does for today's install.
   - **The oracle.** `test/helpers/todaysFirmwareRoutes.js`, which follows install's passes line by line, skips it the same way.
   - **Nothing else in seed-firmware changes.** The target already gives each header its tags once, and it fetches no curator's letters.
   - **Then ST33's digest.** Its pinned digest of `pass_communityReferences` is updated, as its procedure says: "bring src/firmware/target.js in line, then update its digest here".
   - **"Nothing else changes"** (Implementation notes §2) now reads: Pass 1, `buildImportCypher`, the post-derive wiring, `event-update` and `set-b-tag`; and in seed-firmware, only the skip above.
   - **Tests (§3).** A target built under nostr-relay's curator gives its header no `b`, no claim and no `references` entry, and each other reference's header its own. The oracle under the same assistant signs no `b` on it, and agrees with the target.

2. **`seededB` says whether the header's letter carries the `b` (Blocking 2).** Of the review's two fixes, this one:
   - **When it's set.** At once on the "already has a `b`" path. On the seed path, as soon as the publish has stored the letter, which the step now checks itself. The publish route answers a failed `strfry import` with 200 and `success: false` (`src/api/strfry/commands/publishEvent.js`), and `apiPost` throws only on a failed status with no `success`, so an answer without `success: true` is thrown as a failure.
   - **A failed publish.** It throws before the import. The letter isn't imported, and `seededB` stays false, so the wiring gives the header Story 38's stub, as it gives any header whose stored letter has no `b`.
   - **What follows a failure.** The import and the prune after it stay inside the seed's graceful `try`. If either fails, the log says the header carries its `b` but its import or prune failed, and `seededB` stays true, so the wiring skips the legacy stub. That is what Story 38's AC-4 means, and what its code says `seededB` is: "true if the header now carries a `b`".
   - **What else it changes.** On the seed path, an import that fails after a good publish no longer gets the stub either. The header has no `REFERENCES` until its next good import derives the `b`-tag one. That is AC-4 as its comment reads it: a header that carries a `b` gets no stub.
   - **Why not a `try` of each prune's own.** That would still give the stub to a header whose letter carries the `b` when the seed path's import fails, the same mismatch the finding names.
   - **Tests (§3).** A prune that fails on each path, and an import that fails on each path. In each, the header keeps its `REFERENCES {source:'b-tag'}`, and no `firmware-community` relationship forms. And a publish answered without `success: true`: `seededB` is false, and the letter isn't imported.

3. **The "already has a `b`" path's import stays as it is, with no export-rule check (Non-blocking 1).**
   - **Why no check.** `holdsLetterOrNewer` (graph-operations-first-slice ADR 0034 Decision 10) can't tell this path's normal case from the one it guards. A graph write keeps the node's letter (ADR 0037, Context 4), so in both the node holds strfry's letter. In the normal case it has an earlier letter's tags beside it, which is what the prune is for. The rule would answer true in both, and stop the path from healing any instance whose installs don't sign headers again.
   - **What it costs: a new consequence, the owner's to accept at the gate.**
     - **Why the rule exists.** Re-importing an own node's letter from the instance's own strfry can undo a graph write. ADR 0037's Context 4 names `event-update` doing it, and ADR 0034 Decision 10 gives that route the check. This path re-imports the same way.
     - **A default install undoes nothing new.** Pass 1 has just signed every header again, and BIBLE §7 already says the boot install, which runs Pass 1, "undoes edits made in between".
     - **An install with `pass1: false` is the new case.** Run after `lifecycle seed-firmware` has brought one of the six headers in line, it would re-import that header's last letter over seed-firmware's write, and prune the tag nodes the write made. Before this story the path made no database call.
     - **BIBLE §7 gains a line saying so.**
   - **The review's other suggestion would be wrong.** Skipping the import but not the prune, when the node holds a newer letter, would prune against the older letter and delete the newer one's tags.

4. **BIBLE §22 says so (Non-blocking 2).** Its "Status today" paragraph gains the import-then-prune, and the skip for a reference the instance curates itself.

5. **The rollout expects staging's copy to keep production's loop until production heals (Non-blocking 3).**
   - **§5's order stays:** staging first, as the live check.
   - **Staging's check expects one loop.** After that install, its copy of production's nostr-relay header still has its `REFERENCES` to itself. Production's letter carries the `b` then, so the version the copy holds derives it (AC-2 as amended).
   - **It goes at staging's next install after production's,** and §5 checks that it does.
   - **The step suite's fixture** models the graph once production has healed, and its comment now says so.

6. **S0 checks the six references the story names (Non-blocking 4).**

7. **No change for Non-blocking 5.** The prune's tag statement has the shape of `TAGS_DROP`, which staging and production run. With item 2, a prune that fails at staging's reinstall leaves the duplicates, and the right relationship.

8. **Graph sets' model of firmware's links follows the skip too (round 2's independent check, non-blocking 4).**
   - **The model.** `firmwareLinks` in `src/operations/catalog/graph/_sets.js` builds firmware's links "as install.js parses them", for `graph link-set` and `unlink-set`. Its part (d) now leaves out a reference whose curator is the instance's assistant.
   - **Why.** Otherwise, on production, `unlink-set` would refuse to take out the leftover superset loop as firmware's own, though no install makes it any more.
   - **A test pins it.**
   - **ADR graph-operations-first-slice/0037 gains an Amended-by pointer,** since its Decision 4 says each of the six headers gets the `b`.

**Ratification:** at the next gate.
