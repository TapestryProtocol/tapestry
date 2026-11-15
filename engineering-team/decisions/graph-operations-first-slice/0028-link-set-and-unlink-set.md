# ADR 0028: `graph link-set` and `unlink-set` — class-thread links through the write path, guarded by two rules

**Status:** Accepted
**Date:** 2026-11-15
**Story:** `engineering-team/stories/graph-operations-first-slice/28-link-set-and-unlink-set.md`

## Context

Story 28 (Loom A10.28) asks for two graph writes that make and take out a class thread's propagation link, `(parent)-[:IS_A_SUPERSET_OF]->(set)`, with nothing signed. Its eight criteria, in short:

- **AC1** — link-set links `set` (a set or a concept's superset) directly under `parent` (a superset or a set), answering the link, `linked` and the change entry.
- **AC2** — a repeat answers `already-linked`, records nothing, and two calls at once make one link.
- **AC3** — link-set refuses an unknown node, a `set` that is neither a set nor a superset (for a concept header, naming its superset), a `parent` that is neither, and a cycle, naming the chain.
- **AC4** — unlink-set takes the link out, answering `unlinked`, and says when the set's own letter still names that parent. With no such link it answers `already-unlinked`.
- **AC5** — unlink-set refuses unknown and wrong-kind nodes, and the set's last parent. A superset has no last parent to keep.
- **AC6** — unlink-set refuses a peer's link and a firmware link. link-set refuses the link shape a firmware reinstall prunes.
- **AC7** — no cycle in a class thread, and no set under no parent, are each one rule, used as a guard and as a check, and written into docs/GRAPH_RULES.md.
- **AC8** — every link these operations make or take out lasts through a firmware reinstall and a restore. The operations are for the owner and admins, with an internal command and a `/docs` entry, and an admin agent uses them through the external CLI.

The owner approved the three proposals: peer and firmware links stay; the owner's own lettered links may be taken out, with the stale letter reported; elements aren't checked against the schema of a concept a link brings them into.

Facts from the codebase that the design rests on:

1. **The write path** (ADR graph-operations-foundation/0004 Decisions 1–5).
   - A graph write declares `apply`, `guards` and `repeatKey`.
   - `src/operations/write.js` opens one write transaction. It runs each guard's `rule.violations(guard.items(inputs), tx.read)` and refuses on the first violation, adding `rule` to the refusal. Then it calls `apply(inputs, { ...context, tx })` and records the change entry when `changes` isn't empty.
   - A refusal thrown in `apply` rolls everything back.
   - Each rule's refusals are added to the operation's, so `/docs`, the list and the command's help show them.
   - "`MERGE` between two bound nodes locks both, so two calls at once make one relationship and one entry" (Decision 7).
2. **The models.** `src/operations/catalog/graph/add-relationship.js` and `remove-relationship.js` make and remove one typed relationship between two nodes found by tapestryKey. They use `_nodes.js` (`keyInput`, `UNKNOWN_NODE`, `requireNodes`). Their changes are `{ change, type, from, to }`, which `changes.js`'s `CHANGE` schema already holds and whose `from` and `to` `keysOf` indexes for `graph history`.
3. **The link's type is kept for these two.** `relationship-type-allowed` refuses `IS_A_SUPERSET_OF` as `reserved-type`, made by "graph link-set and create-set" (`src/operations/rules/relationship-type-allowed.js:39`). The class-thread aliases come from `firmware.relAlias('CLASS_THREAD_INITIATION' | 'CLASS_THREAD_PROPAGATION' | 'CLASS_THREAD_TERMINATION')`, as that rule, `src/api/normalize/nodes.js` and `relationships.js` resolve them.
4. **What sets, supersets and headers are in the graph.**
   - A set carries the label `Set`: create-set sets it (`src/api/normalize/index.js`, `SET n:Set`), add-subset gives it, and Phase B's pull gives it to sub-sets.
   - A superset carries `Superset`, and a concept header points to its superset with `IS_THE_CONCEPT_FOR`.
   - add-subset refuses a parent that is "neither Superset nor Set" by those two labels (`nodes.js:159`).
   - A superset's address is `39999:<author>:<slug>-superset` (`src/api/normalize/index.js:349`, `src/firmware/install.js:1108`).
5. **Letters and would-be tags.**
   - A set today's create-set signed has an `id` (its event's) and an `s` tag naming its parent's uuid (`index.js:4332`).
   - An add-subset set has the same tag nodes, `s` among them, but no `id`, and its `pubkey` is the TA's (`nodes.js` header).
   - So an `s` tag alone doesn't prove a letter: an `id` does.
   - A node's author is its `pubkey`.
6. **A peer's links.** Phase B's pull (`src/api/concept/pullClassThread.js`) MERGEs `(parent)-[:IS_A_SUPERSET_OF]->(child)` for each event its curator signed that names the parent in an `s` tag. It never MERGEs one whose parent is in the local TA's part of the graph. A pull run again puts such a link back.
7. **Firmware's links.** A firmware install makes class-thread links from four parts of its definition, all under `firmware/versions/<v>/`:
   - **(a) Each set file.** `concepts/<slug>/sets/*.json` becomes a set under its concept's superset, through `POST /api/normalize/create-set` with the d-tag `word.slug`, or the file name when there is none (`install.js:350–421`). create-set's repeat path doesn't MERGE the link again (`alreadyExisted`), so today's reinstall puts this one back only for a set it newly makes.
   - **(b) existing-sets.** `manifest.json`'s `sets.<category>['existing-sets']` puts a concept's superset under the superset of the category's concept, mapped by `categoryToSlug` (`install.js:123`, private to install.js). Each reinstall MERGEs these again.
   - **(c) Concept manifests.** Each concept manifest's `IS_A_SUPERSET_OF: [{ nodeFrom, nodeTo }]` names files in that concept's `sets/` or `elements/` (`install.js:493–560`). Each reinstall MERGEs these again.
   - **(d) Community references.** A concept with a `communityReference` gets its superset linked to the curator's superset, `39999:<curatorPk>:<dTag>-superset` (`install.js:1097–1115`).

   After wiring, the **prune** pass runs, for each firmware concept whose folder has a `manifest.json` (29 of the 40 in v1.0.0; Amendment 1). It deletes a link from that concept's superset to a direct child that is also reachable through another direct child, within 10 links (`install.js:807–833`). It also deletes a superset's direct `HAS_ELEMENT` to an element reachable through its sets.
8. **No index on tag values.** `NostrEventTag` has only a uniqueness constraint on `uuid` (`setup/neo4jConstraintsAndIndexes.sh:48`). Any search for an event by a tag's value, such as the relationship events today's link-concepts and create-set sign (`nodeFrom`, `nodeTo`, `relationshipType`), scans every tag node. A read that starts at the set and follows its own `HAS_TAG` stays cheap.
9. **The fakes are fixed for this story.** The stack-free suites run over `test/helpers/graphFake.js` and `pathCypherFake.js`. Those run:
   - one-node reads;
   - `MERGE` or `DELETE` of one relationship between two nodes found by tapestryKey;
   - path reads with `MATCH` / `OPTIONAL MATCH`, `WHERE`, `WITH`, `RETURN`, typed relationships of fixed or variable length, `IN`, label tests, `labels()`, `count` and `collect`, over `HAS_TAG`, `IS_THE_CONCEPT_FOR`, `IS_A_SUPERSET_OF`, `HAS_ELEMENT` and the property-tree types.

   They run no path variables, `shortestPath`, `CALL`, `UNWIND` reads, or any other write. Story 16's session is editing `graphFake.js`, `nodeCypherFake.js`, `pathCypherFake.js` and `changes.js` now (agreed between the two sessions, 2026-11-15), so this story's statements must fit what the fakes run today, and this story edits none of those files.
10. **The keys.** The TA pubkey comes from `getOwnerAssistantPubkey()` (`src/utils/assistantKeys.js`) and the owner's from `getOwnerPubkey()` (`src/utils/config.js:96`). The stack-free harness sets them to `'dd'.repeat(32)` and `'aa'.repeat(32)` (`test/helpers/graphOpsSuite.js`).
11. **Orientation.** `/api/concept-graph/summaries` on the local instance lists `39998:<TA>:class-thread`, `…:set`, `…:superset` and `…:relationship-type`. `/neighbors` and `/node` need an owner's sign-in there, so the class thread's shape above is taken from the code and BIBLE §6, §10 and §23 (AGENTS.md §2's fallback). Re-check these handles against a live graph.

## Options considered

### Option A — Two invariant rules, two declarations and one helper, with walks one level at a time

- **`class-thread-acyclic`** guards link-set: no set is below itself.
- **`set-has-a-parent`** guards unlink-set: every set is directly under a superset or a set.
- Each is used as a guard on writes and as a check over the graph (D3).
- The refusals that aren't graph invariants (the kind of each end, firmware's links, peers' links) stay in each declaration's `apply`. They share one helper, `catalog/graph/_sets.js`, as `_fields.js` serves the field operations.
- Walks go up the class thread one level per read, over the tapestryKeys found so far, with a visited set.
- Firmware's links are worked out from its definition files, as `relationship-type-allowed` reads firmware's types.
- Each write re-runs its rule after the `MERGE` or `DELETE`, while Neo4j holds the ends' locks.

**Pros:**
- Each rule says one thing about the graph, so `rules check` (A10.31) can run it over the whole graph and every finding is something wrong.
- Everything is in new files.
- Every statement fits the fakes as they are.
- Walking up from the parent visits only its ancestors, which in a class thread are few, however many sets lie below.

**Cons:**
- A cycle takes as many reads as the chain is long.
- Some refusals live in the rules and some in the declarations, so a reader looks in two places. The declarations' `refusals` lists and `/docs` show them all together.

### Option B — One rule per operation that holds every refusal

`set-link-allowed` (kinds, cycle, firmware prune) and `set-unlink-allowed` (kinds, last parent, firmware link, peer link), as `field-mark-allowed` holds its eight refusals.

**Pros:** one place for each operation's refusals.

**Cons:**
- Run as a check over the graph, `set-unlink-allowed` would report every peer's link and every firmware link as breaking a rule, though both are just what they should be (D4: a peer's claim is recorded as theirs). So would every link a firmware reinstall prunes.
- The rules document would gain rules that describe operations rather than the graph, against design §7's "each rule … as its guard or check is built".

### Option C — One path query per check, and a lock node for every class-thread write

- `MATCH (s)-[:IS_A_SUPERSET_OF*0..]->(p)`, or `shortestPath`, finds a cycle in one statement.
- A `(:ClassThreadLock)` node that every link-set and unlink-set first writes makes them run one at a time.

**Pros:**
- One read per check.
- Two link-sets at once that would close a cycle between four different sets can't both pass.

**Cons:**
- A variable-length path lists every path, not every node, so it grows combinatorially in a thread where sets have several parents.
- The fakes can't run `shortestPath` or path variables, so this would mean editing the files story 16 is editing.
- The lock is a node that is an element of no concept (D9).
- Every class-thread write would queue behind every other, across unrelated concepts.

## Decision

We chose **Option A**. It is the only option in which each rule is a true statement about the graph, so its check mode reports only what is wrong. It is also the only one whose statements need no new fake, so this story and story 16 never edit the same file. Its cost is reads in proportion to the depth of a class thread, which is small. Its residual race (Decision 9) is narrower than any the old routes have, and `rules check` finds what it leaves.

### 1. The two operations, in `src/operations/catalog/graph/`, both `owner-and-admins`

**`link-set.js`** (write)

- **Inputs:** `set` and `parent`, both required tapestryKeys (`N.keyInput`).
- **Guard:** `{ rule: 'class-thread-acyclic', items: (i) => [{ set: i.set, parent: i.parent }] }`.
- **repeatKey:** `['set', 'parent']`.
- **Refusals:** `unknown-node` (404, `N.UNKNOWN_NODE`), `not-a-set` (409), `not-a-parent` (409) and `firmware-prunes` (409). `cycle` comes from the rule.
- **Result:** `{ link: { set, parent }, outcome: 'linked' | 'already-linked', change }`.
- **`apply`:**
  1. `N.requireNodes(ctx.tx, [['set', set], ['parent', parent]])`.
  2. `S.nodeOf` for both. If `set` isn't a `Set` or `Superset`, refuse `not-a-set`. If it is a concept header, the message names its superset's tapestryKey as the key to pass. If `parent` isn't a `Superset` or `Set`, refuse `not-a-parent`, naming the superset in the same way.
  3. If the link is already there, answer `already-linked` with no changes. This read comes before any refusal that only a new link could earn (step 5), so a repeat never refuses.
  4. `MERGE` the link (statement W1). `counters.relationshipsCreated` tells a link from a repeat that raced this one.
  5. When it was created, three checks run inside the transaction, so a refusal rolls it back:
     - **Re-check:** `rules.findRule('class-thread-acyclic').violations([{ set, parent }], ctx.tx.read)`. A finding is refused as the guard would refuse it (Decision 9).
     - **Firmware's prune:** `S.firmwarePrunes(ctx.tx.read, { parent, set, before })` (Decision 6), where `before` is what the same function found before the `MERGE`. Each link the prune would take out now, and wouldn't have before, is refused `firmware-prunes`, naming the link.
     - **Answer:** `data: { link: { set, parent }, outcome: 'linked' }` and `changes: [{ change: 'set-linked', type: <the alias>, from: parent, to: set }]`.

**`unlink-set.js`** (write)

- **Inputs:** as link-set's.
- **Guard:** `{ rule: 'set-has-a-parent', items: (i) => [{ set: i.set, without: i.parent }] }`.
- **repeatKey:** `['set', 'parent']`.
- **Refusals:** `unknown-node`, `not-a-set`, `not-a-parent`, `firmware-link` (409) and `peer-link` (409). `last-parent` comes from the rule.
- **Result:** `{ link: { set, parent }, outcome: 'unlinked' | 'already-unlinked', letters: [{ address, says }], change }`.
- **`apply`:**
  1. As link-set's steps 1 and 2.
  2. If no link runs from `parent` to `set`, answer `already-unlinked` with `letters: []` and no changes.
  3. If `S.isFirmwareLink(ctx.tx.read, parentNode, setNode)`, refuse `firmware-link`, naming the part of firmware's definition that makes it (Decision 6).
  4. If `S.peerClaim(ctx.tx.read, parentNode, setNode)` returns a claim, refuse `peer-link`, naming the set's author and its address (Decision 7).
  5. `DELETE` the link (statement W2), every copy of it, counted, as remove-relationship does.
  6. Re-check with `findRule('set-has-a-parent').violations([{ set }], ctx.tx.read)`, which now finds no parent if a concurrent unlink took the other (Decision 9).
  7. `letters` is `S.ownLetters(ctx.tx.read, parentNode, setNode)` (Decision 7).
  8. Answer `data: { link, outcome: 'unlinked', letters }` and `changes: [{ change: 'set-unlinked', type, from: parent, to: set, count? }]`. `count` appears only when more than one copy was removed.

Every refusal message names the input, says what is wrong in words, and says how to go on where there is a way:
- `not-a-set` names the header's superset;
- `last-parent` names the parent, and says to link the set under another parent first, or delete it once it's empty (`graph delete-set`, A10.17);
- `firmware-link` and `firmware-prunes` name lifecycle seed-firmware (A10.37);
- `peer-link` says the point of view decides whether a peer's link counts.

### 2. The helper, `src/operations/catalog/graph/_sets.js`

It requires nothing at load that opens anything (ADR graph-operations-foundation/0001 Decision 10): `firmware`, `assistantKeys` and `config` are required inside the functions that use them.

| Function | What it does |
|---|---|
| `aliases()` | `{ INIT, PROP, TERM }` through `firmware.relAlias`; the only relationship type names its statements interpolate. |
| `nodeOf(read, key)` | `{ key, uuid, name, labels, pubkey, hasLetter }` from statement R1, or null. `hasLetter` is `id != null`. |
| `kindOf(node)` | `'superset'` (label `Superset`), `'set'` (`Set`, not `Superset`), or `'other'`. |
| `supersetOf(read, key)` | The tapestryKey of the superset a concept header points to (R2), or null. |
| `parentsOf(read, keys)` | One level up for many nodes at once (R3): `[{ child, parent, uuid, name, labels }]`. |
| `ancestors(read, from, { skip })` | The class thread above `from`, walked one level per read until nothing new appears, with a visited set. It returns `Map(child → [parent])`. `skip: [parent, child]` leaves one link out of the first level (Decision 6). |
| `chain(map, from, to)` | The path up from `from` to `to` in that map, as tapestryKeys, for messages. |
| `childrenOf(read, key)` | A node's direct sets (R4). |
| `firmwareLinks()` | The links firmware's definition makes, worked out once per process, with the supersets the prune covers (Decision 6). |
| `isFirmwareLink(read, parentNode, setNode)` | Whether the pair is one of them, and which part of the definition makes it. |
| `firmwarePrunes(read, { parent, set })` | The links the prune would take out (Decision 6). |
| `peerClaim(read, parentNode, setNode)` / `ownLetters(read, parentNode, setNode)` | Decision 7. |
| `describe(node)` | `"<name>" (<tapestryKey>)` for messages, or the key alone. |

### 3. The rule `class-thread-acyclic` (`src/operations/rules/class-thread-acyclic.js`)

- **Says:** no set or superset is below itself. Following class-thread links down from any node never comes back to it.
- **Items:** `{ set, parent }`, a link that is about to be made (guard) or is there (check).
- **`violations`:** for each item:
  1. Read both nodes with `S.nodeOf`. If either is missing, or `set` isn't a set or a superset, or `parent` isn't a superset or a set, the item is not this rule's to judge: no finding, and the declaration refuses it.
  2. If `parent === set`, the finding is `cycle`: "would put X under itself".
  3. Otherwise walk `S.ancestors(read, parent)`. If `set` is among them, the finding is `cycle`, with the chain from `set` down to `parent` (`S.chain`, reversed). The message names at most 12 nodes, then "and n more".
  4. As a check, the same walk on a link that is there finds it on a cycle. Walking up from the parent never uses the link itself, so guard and check are the same definition.
- **Refusal:** `{ code: 'cycle', status: 409, when: 'The parent is the set itself, or already below it in the class thread, so the link would make a set its own subset' }`.
- **`refuses`:** true.

### 4. The rule `set-has-a-parent` (`src/operations/rules/set-has-a-parent.js`)

- **Says:** every set is directly under at least one superset or set. A superset is exempt: its concept's header holds it in its class thread.
- **Items:** `{ set, without? }`.
  - As unlink-set's guard, `without` is the parent about to be left. The item is judged only when a link from `without` to `set` is there, so an unlink of a missing link is a repeat, not a refusal (AC4).
  - As a check, `without` is left out.
- **`violations`:** read `set`. No finding when it is missing, when its kind isn't `'set'`, or when `without` is given and isn't one of its parents. Otherwise read its parents with `S.parentsOf`, count those that are a `Superset` or `Set` other than `without`, and give the finding `last-parent` when there are none:
  - "is under no other superset or set" as a guard;
  - "is under no superset or set" as a check.
- **Refusal:** `{ code: 'last-parent', status: 409, when: 'Taking the link out would leave the set under no superset or set, so no class thread would reach it or its elements' }`.
- **`refuses`:** true.

### 5. What counts as which

- **A set** is a node labelled `Set` and not `Superset`.
- **A superset** is a node labelled `Superset`.
- **A parent** is either.
- **A concept header** is a node with a `Superset` at the end of its `IS_THE_CONCEPT_FOR`; it is named only to say which key to pass.

These are the labels today's add-subset and create-set write and check (Context 4). A node that is an element of the set concept but has no label isn't a set here; `rules check` can report the difference later.

### 6. Firmware's links and firmware's prune

**`firmwareLinks()`** reads the active firmware through `src/api/normalize/firmware.js` (`getManifest`, `firmwareDir`), as `relationship-type-allowed` does. It keys each end by a descriptor:
- `node:<uuid>`, for a node whose address the definition gives;
- `superset-of:<header uuid>`, for a concept's superset, matched through its header, so a superset's own address never has to be assumed.

Pairs, with `<TA>` from `getOwnerAssistantPubkey()`:

| Part of the definition | Parent | Set |
|---|---|---|
| (a) `concepts/<c>/sets/<f>.json` | `superset-of:39998:<TA>:<c>` | `node:39999:<TA>:<word.slug or f>` |
| (b) `sets.<category>['existing-sets'][].concept` | `superset-of:39998:<TA>:<categoryToSlug(category)>` | `superset-of:39998:<TA>:<concept>` |
| (c) `concepts/<c>/manifest.json` `IS_A_SUPERSET_OF[]` | `node:39999:<TA>:<slug of nodeFrom>` | `node:39999:<TA>:<slug of nodeTo>` |
| (d) `communityReference.headerATag` `39998:<pk>:<d>` | `superset-of:39998:<TA>:<c>` | `node:39999:<pk>:<d>-superset` |

- In (c), a name resolves to the `word.slug` of the file of that name in `<c>/sets/` or `<c>/elements/`, else to the first such file in any firmware concept. A name that resolves to no file is left out, as install's own Neo4j lookup could miss it too.
- `categoryToSlug` is copied from `install.js:123` (two overrides, then strip a final `s`), with a comment pointing there. A test checks that every shipped category resolves to a firmware concept.
- **The pair test.** `isFirmwareLink` reads each end's descriptors: `node:<uuid>` always, plus `superset-of:<uuid of its header>` for a superset (R2 in reverse). The link is firmware's when any parent descriptor and set descriptor make a pair in the table, and the refusal names the part, (a) to (d).
- **(a)'s links count too,** though today's reinstall puts them back only for a set it newly makes (Context 7). The story keeps firmware's class threads as firmware defines them, and seed-firmware (A10.37) will own them.

**`firmwarePrunes(read, { parent, set })`** answers which links the prune pass would take out, among those a new link from `parent` to `set` could affect:
- **Which supersets.** It walks `S.ancestors(read, parent)`, plus `parent` itself, and keeps the supersets of firmware concepts whose folder has a `manifest.json` (the set `firmwareLinks()` also returns).
- **Which links.** For each such superset `F` and each direct child `Y` of `F`, the link `F → Y` is prunable when `F` is among `S.ancestors(read, Y, { skip: [F, Y] })`, that is, reachable from `Y` through another parent.
- **Why before and after.** link-set calls it once before its `MERGE` and once after. It refuses only the links that are prunable after and weren't before, so a redundancy already in the graph never blocks an unrelated link.
- **The two shapes this covers:**
  - the new link is itself prunable: `parent` is such a superset, and `set` is already below it through another set (the story's AC6);
  - the new link makes an earlier direct link of `F`'s prunable, because `set`, or a set below it, was directly under `F`.

  The second shape breaks AC8 just as the first does, since a reinstall would delete a link link-set made earlier.
- **Two simplifications.** Install looks only 10 links deep, while this walk has no limit: it may refuse a deeper redundancy that today's prune would miss, on the safe side. Install's `HAS_ELEMENT` prune (Context 7) changes no membership and no class-thread link, so it isn't checked. Consequences say what that leaves.

### 7. Peers' links and the instance's own letters

- **Own** means signed by the instance's assistant or its owner: `getOwnerAssistantPubkey()` or `getOwnerPubkey()`.
- **`peerClaim`** reads the set's own `s` tags (R5). It returns `{ author, address }` when the set's `pubkey` isn't one of those two keys, the set has a letter, and one of its `s` tags is the parent's `uuid`. That is exactly the link Phase B's pull would make again (Context 6).
  - A link the owner made between a peer's sets, with link-set, has no such tag, so unlink-set takes it out (the story's "the owner's own links stay theirs").
  - A peer's set the owner never linked can't reach unlink-set's delete without a claim, because nothing else makes links between peers' sets.
- **`ownLetters`** returns `[{ address: <the set's uuid>, says: "its s tag names <parent uuid> as a parent" }]` when the set's `pubkey` is one of the instance's own, the set has a letter, and one of its `s` tags is the parent's `uuid`. Otherwise it returns `[]`.
  - unlink-set answers it as `letters`: each still names the old parent, and `export nostr` (A10.34) is what sends a new one (D2).
  - An add-subset set's would-be `s` tag isn't a letter (no `id`), so it isn't reported. Consequences say what that leaves.
- **Relationship events aren't read.** Today's link-concepts and create-set sign relationship events naming a pair. Finding them means a search by tag value with no index (Context 8), and no pull makes a class-thread link from one. So they aren't read: neither refused for a peer's nor reported for the instance's own.

### 8. The walks

`S.ancestors` reads one level at a time (R3), over the frontier of tapestryKeys not yet visited, until the frontier is empty. Each read uses the `tapestry_key` uniqueness index, and the visited set ends the walk even on a cycle the old routes made. There is no depth limit, since every level shrinks the unvisited set. A class thread is a few levels deep, so a link takes a handful of reads.

### 9. Two writes at once

`MERGE` and `DELETE` of a relationship take write locks on both of its nodes (ADR 0004 Decision 7). So two link-sets, or two unlink-sets, that share a node run one after the other from their write on. The re-check each one runs after its write then sees what the other committed:
- **Two link-sets that would make a two-set cycle:** X under Y and Y under X both lock X and Y. The second finds the first's link above its parent and is refused `cycle`.
- **Two unlink-sets that would take out a set's last two parents:** both lock the set. The second finds no parent left and is refused `last-parent`.

Neo4j may instead stop one of them with a deadlock error. The driver runs the whole transaction function again (`graph.writeTransaction`), and the guard then sees the other's link.

The race that is left: two link-sets that touch four different nodes and together close a longer cycle share no lock, and can both commit. That needs two writers building opposite halves of a loop at the same moment. The rule's check mode finds it, and unlink-set repairs it (Consequences).

### 10. Statements

Each fits the fakes as they are (Context 9). `PROP`, `INIT` and `TERM` are `S.aliases()`'s values, the only names interpolated.

| | Statement |
|---|---|
| R1 | `MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n` (the whole node: `{ ...properties, _labels }`) |
| R2 | `MATCH (h:TapestryNode {tapestryKey: $key})-[:INIT]->(s:Superset) RETURN s.tapestryKey AS key LIMIT 1`; in reverse for a superset's header: `MATCH (s:TapestryNode {tapestryKey: $key})<-[:INIT]-(h) RETURN h.uuid AS uuid` |
| R3 | `MATCH (c:TapestryNode)<-[:PROP]-(u:TapestryNode) WHERE c.tapestryKey IN $keys AND NOT u:GraphChange RETURN c.tapestryKey AS child, u.tapestryKey AS parent, u.uuid AS uuid, u.name AS name, labels(u) AS labels` |
| R4 | `MATCH (p:TapestryNode {tapestryKey: $key})-[:PROP]->(c:TapestryNode) WHERE NOT c:GraphChange RETURN c.tapestryKey AS key` |
| R5 | `MATCH (s:TapestryNode {tapestryKey: $key})-[:HAS_TAG]->(t:NostrEventTag) WHERE t.type = 's' RETURN t.value AS value` |
| W1 | add-relationship's statement, with `PROP` (`MERGE (a)-[r:\`PROP\`]->(b)` between the two nodes found by tapestryKey, leaving change entries out) |
| W2 | remove-relationship's statement, with `PROP` |

### 11. Docs, and agents

- **docs/GRAPH_RULES.md** gains §5 `class-thread-acyclic` and §6 `set-has-a-parent`. Each has the entry's six parts:
  - says;
  - kind: a graph rule;
  - refuses or reports: refuses;
  - check: the same `violations` over the graph's links, or over its sets;
  - repair: `graph unlink-set` takes out a link on a cycle; `graph link-set` gives a set with no parent one;
  - enforced by.

  Story 16's rule takes §4 (agreed between the two sessions). Whichever of the two merges second renumbers.
- **The catalog's two rows** (§2, Sets) get their full refusals. The Today column stays as it is.
- **/docs, the list and the internal command** come from the declarations with no other edit (ADR 0001).
- **The external CLI** (A10.6) picks both up from the list with no change.

## Consequences

**What this enables:**
- The new stack can put an existing set, or a whole concept, under another parent, and take it out again, with nothing signed. That is P-149's class-link route, and the rebuild (A10.39) needs it.
- Two rules join the rulebook, ready for `rules check` (A10.31) to run over the graph. That check will find the cycles and parentless sets the old routes could make.

**What it constrains:**
- Firmware's own class-thread links can't be taken out, and the links its reinstall would prune can't be made, until seed-firmware (A10.37) can keep local edits.
- A peer's link can't be taken out; whether it counts is the point of view's to decide.

**Debt and follow-ups:**
1. **The four-node race** (Decision 9) can leave a cycle. `rules check` (A10.31) finds it.
2. **Would-be `s` tags go stale.** An add-subset set's tag nodes include an `s` tag naming its first parent, and unlink-set leaves it as it is. Export (A10.34) must take a set's parents from its links, not from that tag. An OPEN.md row records this for A10.34.
3. **Relationship events aren't reported.** The relationship events today's link-concepts and create-set sign aren't found as stale letters (Decision 7). Export's retract (A10.34) is where letters are reconciled.
4. **The prune check copies install's rule** (`install.js:807–833`) without its 10-link limit. If install's prune changes, `firmwarePrunes` must follow. A10.37 is expected to retire both.
5. **Install's `HAS_ELEMENT` prune** can take out a superset's direct link to an element once link-set puts that element's set under the superset. Membership is unchanged, so the element is still reached, but the direct `HAS_ELEMENT` is gone. This isn't one of this story's links. Recorded for A10.22, whose remove-from-concept counts a node's concepts.

**Firmware reinstall required?** No. No concept definition changes.

## Implementation notes

**New files:**
- `src/operations/catalog/graph/_sets.js` (Decision 2).
- `src/operations/catalog/graph/link-set.js` and `unlink-set.js` (Decision 1).
- `src/operations/rules/class-thread-acyclic.js` and `set-has-a-parent.js` (Decisions 3 and 4). Each requires `../catalog/graph/_sets`, as `field-mark-allowed` requires `_fields`.

**Edited files:**
- `docs/GRAPH_RULES.md`: §5 and §6, appended (Decision 11).
- `docs/GRAPH_OPERATIONS_CATALOG.md`: the `link-set` and `unlink-set` rows only.
- The story: the live check's record, and its Linked artifacts.

**Not edited:**
- story 16's files: `test/helpers/graphFake.js`, `nodeCypherFake.js`, `pathCypherFake.js` and `src/operations/changes.js`;
- and `src/operations/write.js`, `catalog/graph/_nodes.js`, `test/helpers/graphOpsSuite.js`, `relationship-type-allowed.js` (whose `FIRMWARE_MADE` already names link-set), and every route under `src/api/`.

A need to edit one of the first four goes to story 16's session first (agreed 2026-11-15).

**For the Tester:**
- **Fixtures.** Seed the class-thread fixtures in a new helper, `test/helpers/classThreadSeed.js`. Story 16 will add a seed helper of its own, so pick a name that can't collide.
- **Suites:**
  - `test/operations/graph/link-set.test.js`;
  - `test/operations/graph/unlink-set.test.js`;
  - `test/operations/graph/sets-agent-through-cli.test.js`, after `agent-through-cli.test.js`;
  - `test/operations/rules/class-thread-acyclic.test.js` and `set-has-a-parent.test.js`, each calling `violations` directly in both modes.

  `test/operations.test.js` finds all five with no registry line (ADR 0001 Decision 12).
- **Firmware fixtures.** The firmware-link and prune tests can use the shipped firmware files with the harness's TA. For example, a firmware set file's link from its concept's superset, a manifest edge from nostr-relay, an existing-sets link from `set`'s superset, and a community reference from `tag`.
- **The re-checks after a write** (Decision 9) can't race in a stack-free suite. A test can still show that a finding there rolls the write back, using a graph seeded so that the guard and the re-check see the same state.
- **Running suites.** One at a time, with dead endpoints exported (`NEO4J_URI=bolt://127.0.0.1:9`, Redis port 9, the base URLs at `127.0.0.1:9`). Never the full `npm test` on this Mac; the full gate comes from the pull request's CI.

**The live check (AC8)** runs on a scratch stack (`scripts/scratch-stack.sh` with `SCRATCH_IMAGE=agent-memory-tapestry`, the branch's `firmware/versions/v1.0.0/` and `bin/` copied in, `/usr/local/bin/tapestry` linked, the control panel restarted). An admin agent with its own key, through `clients/cli/bin/tapestry.js`:
1. links a set;
2. links it again;
3. is refused a cycle;
4. unlinks it;
5. is refused its last parent.

The owner then runs a firmware reinstall, and the link from step 1 (re-made for the check) is still there. The record goes into the story, as story 5's did. Never on a shared or private instance.

## Out of scope

- How `rules check` (A10.31) chooses the links and sets it feeds each rule, judged by where each came from (D15).
- Keeping an event-less set's would-be `s` tags in step with its links, and sending letters for links (export nostr, A10.34).
- Making firmware's reinstall keep local class-thread edits (lifecycle seed-firmware, A10.37).
- `create-set` (A10.27), `delete-set` (A10.17), and the element operations (A10.22, A10.23).
- Today's link-concepts, add-relationship, delete-relationship, create-set, add-subset and prune-superset-edges routes (D15).

## Amendment 1 (2026-11-15, at Test Design) — what the tests found

1. **The prune's reach.** Context 7 said 35 of v1.0.0's 40 concepts have a `manifest.json`. The count is 29, now corrected in place. Nothing else changes: `firmwareLinks()` reads which concepts have one from the files.
2. **`unknown-node`'s wording.** `_nodes.js`'s `UNKNOWN_NODE` says "A from or to that names no node…", which would mislabel these two operations' inputs in the list, the command's help and `/docs`. So each declaration declares its own entry, same code and status, as `_sets.js`'s `UNKNOWN_SET_OR_PARENT`: `{ code: 'unknown-node', status: 404, when: 'A set or parent that names no node of the graph (a change entry is not one); the refusal names which' }`. `_nodes.js` is not edited.
3. **Which refusal answers when two apply.** The write path runs a declaration's guards before its `apply` (ADR graph-operations-foundation/0004 Decision 3). This has two consequences, and nothing changes in either case:
   - **unlink-set:** a firmware link or a peer's link that is also the set's only parent is refused `last-parent`, not `firmware-link` or `peer-link`. After an install, a firmware set file's link is often its set's only parent.
   - **link-set:** a repeat of a link already on a cycle is refused `cycle`, not answered `already-linked`. Only the old routes can make such a link.

   The tests pin neither order. Putting the declarations' own checks first would mean taking the rules out of `guards`, so they would no longer be listed with their operations. That isn't worth it for two answers that both refuse.
4. **The re-check after a write is a live check.** With one writer, the guard always refuses first, so no stack-free graph can reach the re-check (Decision 9). The Implementation notes' suggestion is withdrawn. The tests show that a refusal after the `MERGE` rolls it back through `firmware-prunes` (LS12, LS13). The re-check itself is the live check's step 8: two link-sets at once that would make a two-set cycle, of which exactly one succeeds.
5. **Possible, unverified: a self-loop on a curator's instance.** On an instance whose TA is a community reference's curator, install's part (d) may MERGE that concept's superset onto itself (`src/firmware/install.js:1295` doesn't compare the two ends). `class-thread-acyclic`'s check would report that cycle, and unlink-set would refuse to take it out as firmware's. Recorded as an OPEN.md row at implementation, for a check against a live graph.
