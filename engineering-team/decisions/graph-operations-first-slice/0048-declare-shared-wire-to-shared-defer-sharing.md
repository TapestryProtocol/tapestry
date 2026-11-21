# ADR 0048: `graph declare-shared`, `wire-to-shared` and `defer-sharing` write a concept's shared-concept disposition in the graph, with the relationship its `b` draws, for export nostr to send

**Status:** Accepted
**Date:** 2026-11-21
**Story:** `engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.md`
**Amended by:** Amendment 1 (2026-11-21, at Test Design). It covers:
- what `target.held` means;
- the field for the `b` values;
- what a repeat answers in `target`;
- the order of the checks;
- the `target` input's schema;
- the words the refusals say;
- the two tests whose catalog count moves.

## Context

**The story's criteria** (story 48, in short):
- **AC1, declare.** One of the instance's own concept headers, with a letter or with none, gets the self-pointing pointer `b` once. A deferral marker it held goes, and its other tags and its JSON stay as they were. One change entry is recorded, nothing is signed, and the answer says whether its letter no longer matches it. A repeat answers `already-declared`.
- **AC2, wire and defer.**
  - **Wire** adds `["b", <target>, "pointer"]` once, beside any `b` the header holds. A repeat answers `already-wired`. A target the graph doesn't hold is reported, and still written.
  - **Defer** adds `["b", "b-tag-deferred"]` to a header with no real `b`. A repeat answers `already-deferred`.
- **AC3, refusals.** Every call refuses:
  - a caller who isn't the owner or an admin;
  - a node that isn't a concept header;
  - another author's header, and a header at the owner's own key;
  - one of firmware's own concepts.

  Wire also refuses a target that isn't an address, and the header's own address. Defer refuses a header that has a real `b`.
- **AC4, export.** Export nostr sends each `b` as the node holds it. A dry run lists the header as new or changed. An element's letter carries a `z` for each concept the header is wired to, up to five. The marker travels with its header like any tag.
- **AC5, the declaration.** Each is declared once, with its route, CLI command and `/docs` entry made from that declaration. Catalog §9 says where the three went, and set-b-tag gets a row. An agent, through the external CLI, declares a concept shared and exports it, and the letter read back carries the self-pointing `b`.
- **Open question 1, answered by the owner (2026-11-21): the owner and admins** may call them.

**Orientation.** The local container is the owner's private agent-memory instance and is off-limits. So, as ADR community-reference/0035 did, this ADR oriented on public concept-graph routes, then the code at staging `f2e149876`.
- **Staging's summaries** list `concept header` (46 elements) and `relationship type` (14), at `39998:<TA>:concept-header` and `39998:<TA>:relationship-type`.
- **david.tapestry.ninja's** `39998:<TA>:vulnerability`, the first use, has 3 elements and 3 sets.
  - Its header is labelled `ListHeader`, `ConceptHeader` and `TapestryNode`, with no `NostrEvent` and no `id`: it has no letter yet.
  - Its tags are `d`, `names`, `slug`, `description`, `concept-graph` and `json`, with no `b`.
- Each instance has its own assistant, so handles here write `<TA>`. Code reads it at runtime with `K.assistant()` (`src/operations/catalog/graph/_concepts.js`).

**What the code does today:**

1. **A concept write's pattern** (`src/operations/catalog/graph/update-concept.js`):
   - **The declaration:** `group`, `name`, `kind: 'write'`, `access: 'owner-and-admins'`, `inputs` (`concept: N.keyInput(...)`, the header's tapestryKey), `result`, `refusals`, `guards`, `repeatKey`, and `apply(inputs, ctx)` answering `{ data, changes }`.
   - **The locks, before it reads:** `K.lock(tx)` (C1, the concept-header concept's header, which also refuses `not-installed`), then `S.lockNode(tx, concept)` (the concept's own header; story 43).
   - **The reads and refusals:**
     - `K.conceptFacts(read, key)` answers the header and its nodes' tags, `{ key, uuid, type, value, value1, value2 }`, and `hasLetter`. It answers null for a node that isn't a concept header (`K.UNKNOWN_CONCEPT`).
     - `K.NOT_OWN_CONCEPT` covers a header whose author isn't the assistant: another author's, or the owner's own key's.
     - `K.FIRMWARE_CONCEPT` uses `K.isFirmware(uuid)`.
   - **The writes:** tags are added with `E.tagRows(uuid, tags, from)` and `E.addTags(tx, key, rows)` (`_eventless.js:31-56`), and removed by tapestryKey with `DETACH DELETE`.
   - **What it answers:** `letterOutOfDate` comes from `hasLetter`. Its changes use the existing shapes: `tag-added { node, field, now }`, `tag-removed { node, field, was }` (`add-to-concept.js:258`, `remove-from-concept.js:226`) and `relationship-added { type, from, to }` (`add-relationship.js:58`). `CHANGE` declares every field a change may carry (`src/operations/changes.js:58-99`).
2. **Every writer of a `b` but one also draws its relationship.**
   - **The rule they share:** each draws `REFERENCES {source:'b-tag'}` for a pointer or untyped `b`, `INHERITS_FROM` for an inherit one, and nothing for the marker or a malformed value. When the target isn't in the graph, they draw to a placeholder.
   - **The writers that follow it:**
     - `buildImportCypher` (`src/api/neo4j/eventSync.js:297-320`, with `placeholderUnlessHeld` at `:188-196`);
     - import nostr (`claimsOf` at `src/operations/catalog/import/_letters.js:223-227`, its placeholder `HOLD_ADDRESS` at `:330-334`);
     - seed-firmware, whose rule is "The b claims go with the tags" (`src/operations/catalog/lifecycle/_seed.js:593-624`; ADR 0037 Decision 8).
   - **The self-loop:** buildImportCypher and import nostr both draw a self-declaration's self-loop.
   - **The exception:** normalize's `importEventDirect` (`src/api/normalize/helpers.js:64-120`), behind today's three routes, draws no `b` relationship.
3. **The placeholders differ.**
   - **Import nostr's** is `CREATE (p:NostrEvent {uuid})`, with `kind`, `pubkey` and a tapestryKey. It is made only when no node of any label is at the address.
   - **Seed-firmware's** is `MERGE (p:TapestryNode {uuid})`, with no `NostrEvent` label.
   - **How others read one:** export and update-node take a placeholder to be a `NostrEvent` with no `created_at`. Import nostr fills one when the letter at its address arrives.
   - **Rule 8's check** names placeholders as elements of no concept, a known category (`docs/GRAPH_RULES.md` § 8).
4. **Rule 2 reserves `REFERENCES` and `INHERITS_FROM`.** `graph add-relationship` can't make them, so a `b`'s relationship needs a write that is its maker, as `graph add-property` is `IS_A_PROPERTY_OF`'s.
5. **Export sends what the node holds** (`src/operations/catalog/export/_letters.js`):
   - **The tags:** every tag node but `s`, `d` and `json` (`:143-150`), so a `b` goes out as it stands, the marker included.
   - **The stamps:** a `z` for each pointer `b` that names another header (`selectPointerTargets`: the a-tag form only, the self coordinate left out, five at most; `:201-225`).
   - **The relationships:** a `b`-derived `REFERENCES` counts as carried by the letter's `b` (`:508`), and `uncarried` skips a self-loop (`:488`).
   - **The references:** a `b` naming one of the instance's own nodes with no letter, which the call doesn't send, is reported `unsent-reference` (`REFERRING`, `:39`).
   - **The order:** the tags of the letter the node has stay in its order, and the rest are added in export's order (`orderTags`, `:379`). The graph's tag nodes hold no order (story 34, fact 2), so where a new `b` sits is export's to decide.
6. **The value forms have one owner:** `src/lib/bValueForms.js`. It holds `SENTINEL`, `classifyBValue` (`a-tag | event-id | sentinel | malformed`), `stripSentinel` and `dispositionOf`.
7. **Story 39's self-loop** (ADR community-reference/0035, Decision 3) was a `b` firmware's community step made naming production's own header, which shouldn't exist. A self-declaration is a different thing: the spec derives it as a self-loop (`protocols/drafts/inherit-from.md` § "The `b` tag").
8. **Operations are found by their files** (`src/operations/index.js:6`). Each one's route under `/api/tapestry/`, its CLI command and its `/docs` entry come from its declaration, so nothing else lists them.

**Constraints:**
- **D1.** Writes never sign.
- **D4.** A write changes only the instance's own nodes.
- **D10.** The graph holds every fact a letter states.
- **BIBLE §30.** A `b` written here has no letter behind it until an export, and nothing may destroy it.
- **No new tooling.**
- **Never write the TA pubkey as a literal.**

## Options considered

### Option A — Three writes in the graph group, each drawing its `b`'s relationship as the importers do (chosen)

`graph declare-shared`, `graph wire-to-shared` and `graph defer-sharing` are three declaration files in `src/operations/catalog/graph/`. They share one helper module.
- **Pros:**
  - Each has its own inputs, refusals, outcomes, CLI help and `/docs` entry, one per disposition, as today's three routes and the concept page's three actions have.
  - After a write, the graph holds the same tags and the same relationships that importing its letter would give. Another instance that imports the letter sees the same shape.
- **Cons:**
  - Three declarations and three suites.
  - Taking a `b` out, which set-b-tag also does, would be a fourth write later.

### Option B — One write, `graph set-disposition`, with a `disposition` input

`--disposition shared|wired|deferred`, with `--target` for wired.
- **Pros:** one declaration holds the three-action rule.
- **Cons:**
  - Its input is valid for one value only, and its refusals and outcomes change with the value.
  - Its `/docs` entry and its CLI help must explain three writes in one.
  - The catalog names every other write by its verb.

### Option C — One general write of a `b`, set-b-tag's jobs as an operation

It adds, replaces or removes a pointer or inherit `b`, with a note, on any of the instance's own nodes.
- **Pros:** it covers set-b-tag, so the app layer could build the three on top of it.
- **Cons:**
  - It goes past the story, which leaves out removal, inherit and notes.
  - An inherit `b` decides deference, and ADR community-reference/0029 makes `inherit` load-bearing. Giving agents that is a decision of its own.
  - The three-action rules would live in each caller: the self `b` is the declaration's, the marker goes only on an unaffiliated header, and a real `b` replaces the marker.

### Option A′ — Option A's tags, with no relationship, as today's routes write them

- **Pros:** smaller, with no placeholder and no self-loop.
- **Cons:**
  - The instance's own letter never comes back in, since import nostr answers `own`. So the relationship would never be drawn, and the graph would say less than the letter it sends. That goes against D10 and seed-firmware's Decision 8.
  - A walk or a discovery from the header would miss its affiliations.
  - The same header would hold a relationship once another instance imported it, but not here.

## Decision

We chose **Option A**. Each operation's job matches what its name says, and the graph after one of them looks as it would after an import of the letter it leads to.

1. **Three writes in the `graph` group.**
   - **Names:** `declare-shared`, `wire-to-shared` and `defer-sharing`, named after the dispositions they write: self-declared, wired and deferred (`dispositionOf`, the concept page's words).
   - **Who may call them:** each is `kind: 'write'` and `access: 'owner-and-admins'`, the owner's answer.
   - **ADR 0001 for these three only:** this widens ADR shared-concepts-adoption/0001's owner-only rule. Today's three routes, and set-b-tag, stay as they are, owner-only.
2. **Their inputs.**
   - **`concept`** is the header's tapestryKey (`N.keyInput`), as update-concept's is.
   - **`target`** belongs to `wire-to-shared` only.
     - **Its forms:** an address `39998:<64 lowercase hex>:<d-tag>`, or an naddr of kind 39998, which the operation turns into that address.
     - **Kind 39998 only:** a wired `b` names a concept header, and export turns it into a `z` stamp on the elements, which must name a header too.
     - **No event id,** as today's route accepts none.
3. **Which headers.**
   - **Any of the instance's own concept headers,** with a letter or with none.
   - **The refusals:**
     - `K.UNKNOWN_CONCEPT` for a node `K.conceptFacts` doesn't read as a concept header;
     - `K.NOT_OWN_CONCEPT` when the header's author isn't the assistant. Its words say which of the two cases it is: another author's (D8: the assistant never re-signs another author's node) or the owner's own key's (the assistant can't sign a new version of it);
     - `K.FIRMWARE_CONCEPT` for `K.isFirmware(uuid)`, since a reinstall would drop the `b` (the queued intake entry);
     - `K.NOT_INSTALLED`, from `K.lock`.
4. **Locks.** `K.lock(tx)`, then `S.lockNode(tx, concept)`, both before anything is read, as update-concept takes them.
   - **Who waits:** the three then go one at a time with every write that takes the concept's header, and with each other.
   - **No deadlock:** the order matches update-concept's.
5. **What each writes, in its one transaction.** Nothing is signed. The header's `b` values are read after the locks.
   - **`declare-shared`.**
     - **When the header already holds a `b` naming its own address** (any type, as today's route reads it): the answer is `already-declared`, and nothing is written.
     - **Otherwise:**
       - it adds the tag `["b", "39998:<TA>:<d-tag>", "pointer"]`, built from the header's uuid;
       - it deletes each marker tag node;
       - it draws `(header)-[:REFERENCES {source:'b-tag'}]->(header)` (Decision 6).
   - **`wire-to-shared`.**
     - **The header's own address** is refused `self-target`: declaring the concept shared is `declare-shared`'s job.
     - **When a `b` already names the target** (any type): the answer is `already-wired`, and nothing is written.
     - **Otherwise:** it adds `["b", <target>, "pointer"]`, deletes each marker, and draws `REFERENCES {source:'b-tag'}` to the node at the target's address, or to a placeholder made there (Decision 6).
   - **`defer-sharing`.**
     - **A header that holds a real `b`** (`classifyBValue` gives `a-tag` or `event-id`) is refused `affiliated`.
     - **A header that holds the marker:** the answer is `already-deferred`, and nothing is written.
     - **Otherwise:** it adds `["b", "b-tag-deferred"]` and draws no relationship.
   - **The new tag's node:** each new tag uses `E.tagRows(h.uuid, [tag], tags.length)` and `E.addTags`, which is how update-concept adds one.
6. **The relationship a `b` draws.** It is drawn as seed-firmware draws it:
   - **Against a doubled relationship:** `MERGE (h)-[r:REFERENCES {source: 'b-tag'}]->(t)`. Its source is in the pattern, so §22's other `REFERENCES` producers are never matched. A relationship an earlier import drew isn't doubled.
   - **A placeholder:** when no node of any label is at the target's address, the write makes one first. It is import nostr's kind: `CREATE (p:NostrEvent {uuid})` with `kind` and `pubkey`, and a tapestryKey. Import nostr fills it when the letter at that address arrives, and the other readers take it to be a placeholder.
   - **The self-loop:** `declare-shared`'s relationship is the self-loop the spec describes. Story 39's removal is firmware's community step, for a `b` that shouldn't exist, and doesn't apply.
7. **Answers.** `data` holds:
   - `outcome`: `declared` or `already-declared`, `wired` or `already-wired`, `deferred` or `already-deferred`;
   - `concept`, as `K.answerOf` gives it;
   - `disposition`: `{ selfDeclared, wired, deferred }` from `dispositionOf`, read after the call, and the header's `b` values;
   - `letterOutOfDate`: true when the call changed a header that has a letter;
   - for `wire-to-shared`, `target`: `{ address, held, node }`. `held` is false when a placeholder was made, and `node` is the tapestryKey of the node it runs to.

   Each refusal is declared in `refusals` with its code, status and when. That adds `bad-target` (400), `self-target` (400) and `affiliated` (409) to `K`'s four. A repeat answers its `already-` outcome, with `change` null. `repeatKey` is `['concept']`, and `['concept', 'target']` for `wire-to-shared`.
8. **Change entries,** in the existing shapes, with no new field:
   - `tag-added { node: <header key>, field: 'b', now: <the b's value> }`;
   - `tag-removed { node, field: 'b', was: 'b-tag-deferred' }` for each marker it took out;
   - `relationship-added { type: 'REFERENCES', from: <header key>, to: <the node's key> }`, only when the `MERGE` made it.

   A placeholder's key is the `to` of its relationship, so `graph history` finds it.
9. **Export doesn't change.** Its letter carries the tag nodes (fact 5), so AC4 holds by construction. The suites pin it.
   - **The marker** travels with its header like any tag. That is the spec's own answer to the Loom task's question (`protocols/drafts/shared-concepts.md` § "Deliberate non-affiliation", written by ADR 0001).
   - **The `z` stamps** of a wired concept's elements come from the same `b` tag nodes, through `selectPointerTargets`.
10. **Docs.**
    - **The catalog** (`docs/GRAPH_OPERATIONS_CATALOG.md`):
      - §2 gets the three rows, and "At a glance" lists them under concepts (graph writes 26 → 29, operations 62 → 65);
      - §9's row for the three routes says where they went, and that the routes stay behind the concept page's buttons;
      - set-b-tag gets a §9 row: still to place, since it also takes a `b` out and writes an inherit one.
    - **BIBLE §25** gets a bullet: the three write a header's `b` with no letter, and draw its relationship.
    - **`protocols/drafts/inherit-from.md`'s implementation note** adds them beside `composeSelfDeclare`. This is no wire-format change.
    - **`clients/cli/skill/SKILL.md`** gains one sentence: to offer a concept as a shared concept, declare it with `graph declare-shared`, then send it with `export nostr`.

## Consequences

- **Enables:**
  - An admin agent can offer a concept it made as a shared concept, wire it to another author's shared concept, or mark it deliberately unaffiliated. It does this through the external CLI, with a change entry, and with no letter needed first.
  - Export then sends the concept as a shared concept, its elements stamped for each concept it is wired to. On `wss://dcosl.brainstorm.world`, a self-declared header shows on every instance's Shared with the community page.
  - A wired `b`'s relationship is in the graph for walks and discovery, as an imported one would be.
- **Constrains:**
  - The three rules each write keeps (the self `b`, the marker, a real `b` beats the marker) must match today's routes and `bValueForms.js`. The suites pin both.
  - A placeholder a wire makes is one more node that rule 8's check names until its letter arrives. Rule 8 already lists placeholders as known.
- **Debt and follow-ups:**
  - **Two writers of the same `b`:** today's routes, and set-b-tag, still write `b` tags by signing first, beside these operations. Moving the concept page's buttons onto the operations is a story of its own.
  - **set-b-tag's other jobs** have no operation yet: taking a `b` out, an inherit `b`, and a note.
  - **Taking back a declaration** someone has sent is export retract's job.
  - **A firmware concept** can't be declared shared through the operations until a reinstall keeps an owner's `b` (the intake entry of 2026-11-21).
- **Firmware reinstall required?** No. No concept definition changes, and no graph rule changes.

## Implementation notes

- **`src/operations/catalog/graph/_dispositions.js`** (new): what the three share.
  - `headerOf(read, key)` → `{ facts, h, bTags }`, with the refusals of Decision 3.
  - `targetOf(text)` → the address, or a `bad-target` refusal. It takes an address or an naddr, through `nostr-tools`' `nip19`, and accepts kind 39998 only.
  - `addB(tx, h, tag)` and `dropMarkers(tx, h)` → the change rows.
  - `drawReference(tx, fromKey, toAddress)` → `{ key, held, made }`.

  `bValueForms.js` stays the one owner of the value forms. Its constants are required, never copied.
- **`declare-shared.js`, `wire-to-shared.js`, `defer-sharing.js`** (new), in `src/operations/catalog/graph/`. Each is a declaration like update-concept's: its `summary`, its `description` paragraphs, its `inputs`, its `result` schema, its `refusals`, `repeatKey` and `apply`.
- **No change** to export, import, the routes, routeAccess or firmware.
- **Docs** as in Decision 10.
- **For the Tester** (test files are Phase 3's):
  - **The suites:** one suite for each operation over `test/helpers/graphFake.js` and `test/helpers/conceptGraph.js`'s seed. It holds a lettered concept, one with no letter, another author's, one at the owner's key, and a firmware concept.
  - **The agent suite:** one agent-through-CLI suite.
  - **Export:** export cases in `test/operations/export/` for AC4, covering the `b`s as held, a dry run's new and changed, and the `z` stamps.
  - **Registration:** each new suite is registered in `test/operations.test.js`.
  - **Statement shapes:** the fake runs only the statement shapes earlier ADRs taught it. So the `OPTIONAL MATCH` / `CREATE` placeholder and the `MERGE` with a property in the pattern may need teaching, in the test helper.
  - **The gate on this Mac:** scoped to `test/operations.test.js` (the agent-memory rule), with curl and docker stubbed first on PATH and `BRAINSTORM_CONF_PATH` pointed at a dead conf.
- **The live check** (AC5) runs on a scratch stack:
  1. An admin agent, through the external CLI, makes a concept.
  2. It declares the concept shared and wires a second concept to it.
  3. It runs export nostr with `dryRun`, then for real, to the stack's own relay.
  4. The letters are read back from that relay by id: the header carries the self-pointing `b`, and the wired concept's elements carry the stamp.

  The first use on david.tapestry.ninja waits for the owner's yes.

## Out of scope

- Moving the concept page's buttons, the disposition panel or the adoption queue onto the operations.
- set-b-tag's other jobs: taking a `b` out, an inherit `b`, and a note.
- Declaring firmware concepts shared through the operations.
- Export retract.
- The routes for a user's own headers.
- Whether a target is itself declared shared. It is that author's claim, read per point of view, and this ADR neither checks nor reports it.

## Amendment 1 (2026-11-21, at Test Design) — what the answers hold, and the order of the checks

The Tester raised four points the Decisions left open (`48-declare-a-concept-shared.test-plan.md`, § "Raised at Test Design", items 1–4). The suites pin what follows.

1. **`target.held` says whether the graph holds the target itself.** It replaces Decision 7's "`held` is false when a placeholder was made".
   - **What counts as held:** a node at the address that isn't a placeholder. A placeholder is a node with no `created_at`, whoever made it and whenever. Import nostr and `buildImportCypher` make one as a `NostrEvent`, seed-firmware as a `TapestryNode`.
   - **An earlier placeholder:** a wire whose target holds only a placeholder an earlier call made answers `held: false`. `node` is then that placeholder's key, and no second node is made.
   - **Why:** an agent reads `held` to learn whether the instance knows the concept it wired to, not whether this call made a node.
2. **`disposition` carries the header's `b` values as `bValues`.** It is a list of strings: each `b`'s value, its second element, once each and sorted, read after the call. ADR shared-concepts-adoption/0001 gave the same name to the same list in the Concepts page's query.
3. **A repeat of `wire-to-shared` answers `target` as a first call does,** read from the graph, writing nothing.
   - `address` and `held` are as in item 1.
   - `node` is the key of the node at the address. It is null when the graph holds none there, which happens when a route that draws no relationship wrote the `b`. The repeat doesn't draw the relationship: a repeat changes nothing.
4. **The order of the checks.**
   - **`wire-to-shared`:**
     1. the input checker;
     2. `bad-target`, the target's form, checked in `apply` before any statement, since an input's own refusal comes first (update-concept, its Decision 2);
     3. the locks, which give `not-installed`;
     4. the header's refusals, `unknown-concept`, `not-own-concept` and `firmware-concept`, in that order;
     5. `self-target`;
     6. the repeat;
     7. the write.
   - **`declare-shared` and `defer-sharing`:**
     1. the locks;
     2. the header's refusals, in the same order;
     3. `affiliated`, for `defer-sharing` only;
     4. the repeat;
     5. the write.

   So the first statement of every transaction is still `K.lock`'s (Decision 4).
5. **`target`'s input schema is a string with a `maxLength` of 2048, and no `pattern`.** Its form is `targetOf`'s to check (Decision 2), so a bad form is refused `bad-target`, naming the input `target`. A pattern would let the input checker answer `invalid-input` first.
6. **The words the suites read** follow Decisions 3 and 5:
   - `not-own-concept` says "another author" for another author's header, and "owner" for one at the owner's key;
   - `self-target` names `graph declare-shared`;
   - `not-installed` names the concept-header concept.
7. **Two existing tests move.** MF15 (`mark-field.test.js`) and EN29 (`enumerate.test.js`) now pin "At a glance (65 operations)", which Decision 10 makes the catalog say, as story 19's Test Design moved MF15.

**Ratification:** the owner, 2026-11-21, at the Test Design gate ("Approved, go on").
