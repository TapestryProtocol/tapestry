# ADR 0023: `graph move-element` — one link out of `from` and one into `to`, the node's concepts judged before anything is written, and what a reinstall does to a superset's link

**Status:** Accepted (the owner, 2026-11-18: Option A, with the four proposed story amendments)
**Date:** 2026-11-18
**Story:** `engineering-team/stories/graph-operations-first-slice/23-move-element.md`

## Context

Story 23 asks for one graph write. It moves a node from `from`, a set or superset that holds it directly, to `to`, a set or superset of the same concept, in one write (AC1). It is safe to repeat (AC2). It refuses sets that share no concept but word (AC3), and a move that would change which concepts the node belongs to (AC4). It refuses the inputs and nodes AC5 lists, takes any node add-to-concept takes (AC6), and lasts (AC7). The owner resolved the story's three questions as drafted:
- a move changes only which sets of one concept hold the node;
- `from` must hold the node directly, and `to` must differ from it;
- only the owner's own links move: a link the node's author's letter claims, or one firmware's definition makes, is refused.

What the code offers, on the story's base, staging at `4d764dd7`. `origin/staging` is 16 commits ahead, at `b4866eb3`, and none of them touches `src/`: they add rulebook entry 9, `tapestry-link-names-a-node`, and test-hermeticity work. The Implementer merges staging before the pull request.

1. **The write path** (`src/operations/write.js:36–68`). In one transaction it runs each declared guard, then `apply(inputs, ctx)`, then writes the change entry. A refusal anywhere rolls everything back. A first attempt that fails with `EntityNotFound` runs once more (`:36–43`). Guards are optional (`src/operations/declaration.js:185`), and each refusal code may be listed once (`:164–172`).
2. **What story 22 built, in `_memberships.js` (`M`):**
   - the node and whose it is: `lookedAfterElsewhere` (`:197`), `keptIn` (`:171`), `keysOf` (`:176`) and `tagsOf` (`:294`);
   - the class thread's reads: `isElementLink` (`:338`), M1 `waysIn` (`:353`), which gives each `HAS_ELEMENT` into the node from the anchor or below it with its `elementId`, and M2 `reaches` (`:372`);
   - whose claim a link is: `firmwareMembership` (`:458`) and `authorClaim` (`:478`);
   - `ownLetters` (`:526`);
   - the declarations `NOT_INSTALLED_REMOVE`, `TAG_NODE`, `MADE_ELSEWHERE_REMOVE`, `FIRMWARE_MEMBERSHIP` and `AUTHOR_CLAIM`, and the schemas `NODE`, `CONCEPT_KEYS` and `LETTERS` (`:543–549`).

   Beside them:
   - `_sets.js` (`S`, story 28) has `lockNode` (`:257`), `nodeOf` (`:100`), `kindOf` (`:121`), which counts a node as a set or a superset only when it has a uuid (ADR 0028 Amendment 3), `supersetOf` (`:130`), `descriptorsOf` (`:373`), `aliases` (`:52`) and `describe` (`:77`);
   - `_elements.js` (`X`) has E2 `conceptsReaching` (`:257`), the concepts whose class thread reaches a superset or set; `link` (`:399`), one `HAS_ELEMENT` by `MERGE`; `RESERVED_KEYS` (`:81`); and `conceptLabel` (`:163`);
   - `_fields.js` (`F`) has `conceptsOfNodes(read, keys, { without })` (`:432`);
   - `_eventless.js` (`E`) has `addTags` and `tagRows`;
   - `remove-from-concept.js` has the pair delete (`:33–36`), C11's tag delete (`:38`) and R1, the node read whole (`:40`).
3. **The locks today's element writes take.** Each locks the node first: add-to-concept (`add-to-concept.js:105–106`) and remove-from-concept (`remove-from-concept.js:97–98`) then the concept's header; update-node (`update-node.js:160`, `:182`) and delete-node (`delete-node.js:167`, `:200`) then their concepts' headers.
   - A relationship's `DELETE` locks neither of its ends on Neo4j 5.26, and a `MERGE` locks both (ADR 0028 Amendment 2).
   - A lock statement that waited for a node another write deleted goes on with no error, and the read after it finds the node gone (ADR 0026 Amendment 2; `delete-node.js:164–166`).
4. **What reads a node's tags and links it again.**
   - **`z`.** A reinstall's pass 1d (`src/firmware/install.js:650–704`) `MERGE`s each concept's superset, word's aside, to every `NostrEvent|ListItem` node whose `z` names its header (`:678–685`). It does so whether or not a set of the concept already holds the node. That covers the owner's own concepts, whose headers are `ListHeader:ConceptHeader` (`_concepts.js:367`), and create-element's nodes, which are `ListItem` (`create-element.js:166`).

     Pass 1e (`install.js:810–902`) then deletes a superset's direct link to a node it also reaches through its sets. It does so only for the firmware concepts whose folder has a `manifest.json`: 30 of the 41 the active firmware's manifest lists.

     Pass 3, wire-implicit-elements (`src/api/normalize/index.js:5832`), links only a node no class thread of the concept reaches (`:5886–5893`). It takes out redundant direct links only once something in the run has been linked (`:5912`; ledger row `2026-11-16-wire-implicit-prune-depends-on-run`).

     ADR 0020 fact 9 and Decision 10 accepted this for the elements create-element makes in a set: "the element belongs to the same concepts and sets as before."
   - **`n`.** No reinstall pass reads it, and neither does the import: `buildImportCypher` (`src/api/neo4j/eventSync.js:198`) links only from `e`, `a` and `b` tags. The Phase B pull of a curator's class thread (`src/api/concept/pullClassThread.js:9–17`, `:258`) does read it. For each of the curator's own events whose `n` names one of the curator's sets, it makes `(set)-[:HAS_ELEMENT]->(event)`. So an `n` tag is what a reader of a letter follows:
     - on another author's node, the next pull of their thread makes the link again;
     - on one of the instance's own, it is what this owner's letter will say, once export nostr (A10.34) sends it, to an instance that pulls this owner's thread.

     The story's background (its seventh fact) says, after story 22, that the `n` tags keep a reinstall and wire-implicit-elements from linking the node again. That holds for `z`, not for `n` (proposed story amendment 1).
5. **The local instance** (read-only, 2026-11-18). There are 532 element links from supersets and 76 from sets (the story's fourth fact).
   - Every element a set of a firmware concept with a manifest holds has no direct link from that concept's superset, since pass 1e took them out: nostr kind 41, relationship type 12, nostr relay 12, json data type 2.
   - 70 nodes sit directly under the property or the set concept's superset and also in a set of its thread (40 and 30): redundant links no prune took out.
   - No concept of the owner's has a set that holds elements.
6. **The derive step's cached copy** names the node's parents. `deriveWord` writes `graphContext.elementOf.direct`, the nodes that directly hold it, and `.indirect`, the sets above them (`src/lib/derivers/word.js:100–128`). So a move leaves a cached copy that is out of date, though it never changes the node's JSON.
7. **Change entries.** An entry's `keys`, which `graph history` filters by, are every tapestryKey in its changes' `node`, `from`, `to`, `concept` and `nodes` (`src/operations/changes.js:92`). Story 22's membership changes are `{ change, type, from, to, node, concept }` (`remove-from-concept.js:224`, `add-to-concept.js:250`), and its tag changes are `{ change, node, field, was | now }`.
8. **The reserved type.** `relationship-type-allowed.js:42` says what makes `HAS_ELEMENT`, which add-relationship and remove-relationship refuse. A rule's element is made from the rulebook and from the rule's `summary`, `refuses` and `refusals` (`src/firmware/graph-rules.js:212–214`), so that string reaches no element.
9. **The catalog row** (`docs/GRAPH_OPERATIONS_CATALOG.md:113`) reads: `node`, `from`, `to` → moved; "Refuses sets of different concepts"; New.

All concepts touched are read only (`<TA>` is the instance's assistant):
- `39998:<TA>:superset` and `39998:<TA>:set`: `from` and `to` are one or the other;
- `39998:<TA>:word`: never the concept two sets share;
- the concept-header, core-node, set, property and graph-rule concepts: their elements are refused as the node;
- firmware's concepts, for the memberships their definitions make.

No concept's definition changes.

## Options considered

### Option A — Its own declaration and apply, built from story 22's and story 28's reads: one link out, at most one in, everything judged before a write

`src/operations/catalog/graph/move-element.js` has an apply of its own:
- it locks the node;
- it reads the node, `from` and `to` with the helpers in Context 2;
- it finds the concepts the two sets share with E2;
- it takes `from`'s direct links from M1, and judges whose claim they are with M's checks;
- it compares the node's concepts before and after with `conceptsOfNodes(…, { without })` and E2 of `to`.

Then it deletes `from`'s link, `MERGE`s `to`'s, and keeps the node's `n` tags in step.

- **Pros:**
  - exactly the one link named goes out, and at most one comes in (open question 2);
  - no section, `wordTypes`, schema check or mark is touched (open question 1);
  - every refusal comes before anything is written;
  - "the concepts reaching a node" and "whose claim a link is" keep story 22's one definition each;
  - one new file, no new export, and four small edits to shared files (ADR graph-operations-foundation/0004: parallel builders keep apart).
- **Cons:**
  - a reinstall's passes, as they are, can make or take out a superset's direct link to a node a set of its concept also holds (Context 4). So AC7's "not directly in `from`" doesn't hold after a reinstall for a node filed out of its superset, and "directly in `to`" doesn't for one moved up to a superset while another set holds it (Decision 11, proposed story amendment 2);
  - it copies remove-from-concept's pair delete and C11's tag delete, as remove-from-concept copied unlink-set's.

### Option B — add-to-concept's apply, then remove-from-concept's, in one transaction

move-element would call add-to-concept with `set: to`, then remove-from-concept with `set: from`.
- **Cons:**
  - it needs a `concept` input, or a choice of one;
  - add-to-concept writes a section when the node's JSON lacks one, adds keys to `wordTypes` and a `z`, runs the schema check, and can refuse `invalid-fields`. A move does none of these (open question 1, AC4);
  - remove-from-concept with `set` takes out the links from that set and from the sets below it (story 22, AC6), which is more than the one link open question 2 allows;
  - its D9 guard and re-check run for nothing (Decision 7);
  - the locks are taken twice, and the field mapping runs twice;
  - the two operations' outcomes and refusals (`already-element`, `other-concept`, `reserved-key`) don't say what a move did or why it was refused.

### Option C — Option A, plus pass 1d skipping a node its concept's class thread already reaches, so that AC7 holds as approved

- **The install change.** Pass 1d's query (`install.js:679–685`) gains wire-implicit-elements' own test (`normalize/index.js:5886–5893`): it skips a node that a superset or set in the concept's class thread already holds. A reinstall then no longer links a superset to a node a set of its concept holds.
- **A new refusal.** move-element refuses a move up to a superset while another set of the concept still holds the node, since pass 1e would take that link out again.
- **Pros:**
  - AC7 holds as written, for every move;
  - the elements create-element makes in a set stop gaining a superset link at each reinstall (ADR 0020 Decision 10's debt);
  - wire-implicit-elements' dependence on the run matters less.
- **Cons:**
  - it changes install, which runs at every reinstall of every instance, firmware's own elements included. The story put install's passes out of scope, as their ledger rows' work;
  - the 70 redundant links already in the graph stay;
  - it needs install tests and a reinstall check on staging and production;
  - its refusal is one AC5 doesn't list.

## Decision

We chose **Option A**. It does exactly the move asked for, with story 22's definitions and no change to any shared helper's exports. Its cost is AC7's reading of a superset's redundant link after a reinstall. That is the reading ADR 0020 already gives create-element, and the story keeps install's passes out of its scope. Option C is the alternative the owner may choose at this gate. It makes AC7 hold as written, at the price of an install change and one more refusal.

### The operation

**1. The declaration.**
- **File:** `src/operations/catalog/graph/move-element.js`, a `write` for `owner-and-admins` in group `graph`, through the write path.
- **Inputs:**
  - `node`: `N.keyInput`, any node add-to-concept takes;
  - `from`: `N.keyInput`, a set or superset that holds the node directly;
  - `to`: `N.keyInput`, a set or superset of the same concept.
- **`repeatKey`:** `['node', 'from', 'to']`.
- **Guards:** none (Decision 7).
- **`refusals`,** in the order Decision 2 checks them (Decision 14).
- **The description** says in plain words what it does, refuses and records, and what a reinstall does to a superset's link (Decision 11), as story 22's descriptions do.

**2. Its checks, in order.** Each comes before anything is written:
1. **`same-set`** (400), new: `to` is `from`, a move of nothing (open question 2). It needs no graph, so it comes first.
2. **`not-installed`** (409), `M.NOT_INSTALLED_REMOVE` and its words. With no assistant key the instance can't tell its own nodes, or firmware's, from another author's, nor whose claim a link is.
3. **The lock** (Decision 3).
4. **The node.** `N.whoseNode`:
   - no node (a change entry is never one): `unknown-node` (404), naming `node`;
   - a `NostrEventTag`: `tag-node` (409);
   - `M.lookedAfterElsewhere(read, facts).hit`: `made-elsewhere` (409). This also gives the concepts reaching the node now (`before`) and their headers.
5. **`from`, then `to`.** `S.nodeOf`:
   - no node: `unknown-node` (404), naming the input;
   - `S.kindOf` is `other`: `not-a-set` (409), naming the input, and, for a concept header, its superset (`S.supersetOf`), the key to pass.
6. **`different-concepts`** (409), new (Decision 4).
7. **The repeat** (Decision 5): `already-moved`.
8. **`not-in-from`** (409), new (Decision 5).
9. **`firmware-membership`, then `author-claim`** (409) (Decision 6).
10. **`leaves-concept`, then `joins-concept`** (409), new (Decision 7).

Words that name the input, the node or a set give each by its name, its address and its tapestryKey. Every way on gives the operation's inputs as tapestryKeys, so an agent can follow it with no `graph resolve` first (ADR 0022 Amendment 5, item 1). move-element words its own `unknown-node`, `not-a-set`, `tag-node`, `made-elsewhere` and `author-claim`, in its own file. Their codes and statuses are the siblings'.

**3. The lock: the node, and nothing else.** After `not-installed`, `S.lockNode(tx, node)` comes before any read, so every read in apply comes after it.
- **Two moves of one node** go one at a time. The second reads what the first committed. With the same `to` it answers `already-moved`; with another it is refused `not-in-from`, naming the set the first moved the node to (AC2).
- **A move beside an add-to-concept, remove-from-concept, update-node or delete-node of the node** goes one at a time with it, since each of those locks the node first (Context 3). After a delete, the lock statement goes on and `whoseNode` finds nothing, so the move answers `unknown-node`. The write path's second try is the safety net (Context 1).
- **No header lock.** add-to-concept locks the concept's header for its name check (ADR 0022 Decision 4). A move checks no name, and a header lock would make every move in a concept wait for every other.
- **No lock on `from` or `to`.**
  - The `MERGE` into `to` locks `to` and the node until commit. The `DELETE` of `from`'s link locks neither end (Context 3), and needn't: under the node's lock, only a write that doesn't lock the node can touch its links. Today's `delete-relationship` and `add-to-set` routes are such writes (D15), and Decision 8's count catches them.
  - A class-thread write beside the move (link-set, unlink-set, create-set) reads no element's links. So the two come out as if one ran before the other: the move judged the class thread as it read it, and what the class-thread write does to the node's concepts is that write's (ADR 0022 follow-up 5).
  - Locking both sets would make two opposite moves of two nodes, S1→S2 and S2→S1, wait on each other in a cycle, which Neo4j breaks with a deadlock error. That costs something and gains nothing.

### The two sets and their concept

**4. "The same concept."**
- **Each set's concepts.** `from`'s concepts are E2, `X.conceptsReaching(read, from)`: every concept whose class thread reaches it, its own superset included. `to`'s are E2 of `to`. Their keys come from `K.headersByKey`.
- **Word and graphContext don't count.** A concept whose key is in `X.RESERVED_KEYS` is set aside: `word`, whose class thread holds nearly every set, and `graphContext`, which no concept has today. That is how remove-from-concept judges (`remove-from-concept.js:120`) and how D9's rule counts (`node-has-a-concept.js`). graphContext is also the derive step's block in a cached copy, but a move reads and writes no JSON, so that is all it means here.
- **`shared`** is the concepts in both lists. When there are none, the call is refused **`different-concepts`** (409, naming `to`). The refusal:
  - names each set's concepts, word aside, or says that `from` is in no concept's class thread but word's;
  - says how to go on: add the node to the other concept first (`graph add-to-concept`, with that concept and `set: to`, and its fields), then take it out of the first (`graph remove-from-concept`, with that concept and `set: from`).

  When `from` is in no concept but word's, such as word's own superset, the second step is left out, since remove-from-concept refuses a concept keyed word.
- **The move's `concept`** is the innermost shared concept: the one whose class thread reaches the superset of no other shared concept (M2); of several, the lowest tapestryKey. When dog's superset is under animal's, a move between two of dog's sets is in dog. With one shared concept, it is that one, as on the local instance, where every set has one parent. It names the move in the answer and in its change entry (Decisions 12 and 13).

**5. Where the node is: the repeat, both sets, and `not-in-from`.** `ways` is M1 from `from`, `M.waysIn(read, { anchor: from, node })`, keeping only the links whose start is `from` itself, with their `elementId`s. `inTo` is `M.isElementLink(read, to, node)`.
- **No way, and `inTo`: `already-moved`.** Nothing changes, nothing is recorded, and `change` is null (AC2).
- **No way, and not `inTo`: `not-in-from`** (409, naming `from`, new). For each shared concept, M1 from its superset gives the sets that hold the node directly. The refusal names them, so the caller can pass the right one; a node `from` reaches only through a set below it is named in that set. When none holds it, the refusal says the node isn't an element of the concept, and names `graph add-to-concept` with the concept and `set: to`.
- **A way, and `inTo`: both sets.** Only `from`'s link goes (AC2). No link is added, and the outcome is `moved`.
- **A way, and not `inTo`:** the move.

**6. Whose claim `from`'s link is** (open question 3). These are story 22's checks, given `ways` and `left`, the concepts Decision 7 finds the node would leave:
- **`firmware-membership`** (409): `M.firmwareMembership(read, { facts, ways, left })`. Part (b) is a concept manifest's `HAS_ELEMENT` from `from` to the node. Part (a) is an element file's concept among `left`. The words are `M.say.firmwareMembership`.
- **`author-claim`** (409): `M.authorClaim({ facts, tags: M.tagsOf(read, node), ways, left })`. On another author's lettered node it is an `n` naming `from`'s address, or a `z` naming the header of a concept in `left`. move-element says what makes each again (Context 4):
  - for an `n`, the next pull of the author's class thread;
  - for a `z`, a firmware reinstall (pass 1d).

  The words add that whether the claim counts is each point of view's call (D4).
- **A `z` naming a concept the node stays in** is no claim on `from`'s link. The author claims the concept, and the move keeps it. When `from` is that concept's superset, a reinstall links it again from that `z` (Decision 11).
- **Nodes no author claims for.** A person node and a placeholder have no letter, so no author claims for them. Firmware's own elements are the assistant's, so `authorClaim` passes them, and part (b) covers them.

**7. The node's concepts stay the same (AC4), and D9 needs no guard.**
- **Before:** the concepts reaching the node now (Decision 2, step 4).
- **After:** `M.keysOf(F.conceptsOfNodes(read, [node], { without: ways.map((w) => w.rel) }))`, together with `to`'s concepts (Decision 4). So another way into the node that keeps it in a concept is counted, as remove-from-concept counts one.
- **Judged:** only concepts whose key isn't reserved. `left` is before minus after, and `joined` is after minus before.
- **`leaves-concept`** (409, naming `from`, new): `left` isn't empty. `from` is in the class thread of a concept that `to` isn't in, and nothing else of that concept reaches the node. The refusal names each such concept and says how to go on: put the node in `to` first (`graph add-to-concept`, with the move's `concept` and `set: to`), then take it out of that concept (`graph remove-from-concept`, with that concept).
- **`joins-concept`** (409, naming `to`, new): `joined` isn't empty. `to` is in the class thread of a concept the node isn't in. The refusal names each, and says how to go on: add the node to that concept with its section (`graph add-to-concept`, with that concept, `set: to` and the fields its schema asks for), then make this call again, which then takes out only `from`'s link (Decision 5, both sets).
- **The order.** The claim checks run first, given `left` (Decision 6), as remove-from-concept runs them before `other-concept`. So a concept left that firmware's definition, or the author's `z`, puts the node in is refused for that claim, since the way on would be refused for it too.
- **No guard.** The node is in every shared concept before the move, since `from` holds it directly, and after it, since `to` does. AC4 keeps the rest. So the node can't be left in no concept but word (D9): `node-has-a-concept` isn't a guard, and the move runs no rule after its writes.
- **No re-check either.** The node's lock makes every membership write on the node go one at a time, and a class-thread write reads no element's links (Decision 3). So what apply judges is what its writes leave.

### The writes

**8. In order, with the race.**
1. **`from`'s link**, every copy, by remove-from-concept's pair delete (`remove-from-concept.js:33–36`), with `{ from, to: node }`. When it deletes nothing, a write that doesn't lock the node, such as today's `delete-relationship`, took the link out meanwhile. Nothing more is written:
   - when `to` now holds the node directly (`M.isElementLink`, read again), the call answers `already-moved`;
   - else it is refused `not-in-from`, saying that another write took the node out of `from` while this call ran.
2. **`to`'s link**, unless `inTo`: `X.link(tx, to, node)`, one `HAS_ELEMENT` by `MERGE`.
3. **The tags** (Decision 9).

No section, `wordTypes`, schema check or mark is touched, and `F.mapNodes` isn't called: a mark carries a field of a concept the node is in, and those don't change (AC1).

**9. The node's tags.** For a node kept in its json tag (`M.keptIn(facts)` is `json-tag`) only:
- **The `n` naming `from` goes.** Each `n` whose value is `from`'s address goes, one at a time, by C11's statement (`remove-from-concept.js:38`).
- **An `n` naming `to` comes,** when `to` is a set (`S.kindOf` is `set`) and no `n` names it yet. It is written by `E.addTags(tx, node, E.tagRows(facts.uuid || node, [['n', <to's address>]], <its tags before this call's removal>))`, so its index, and with it its tag's uuid, is new. A superset gets no `n`: a letter names its concept's superset through its `z`, as create-element's tags and add-to-concept's give none for one.
- **`z` is untouched,** since the concepts don't change.
- **A tag with no tapestryKey** fails the write with an error saying to run lifecycle migrate first, as remove-from-concept's does (`remove-from-concept.js:191`).

A node kept beside gets no tag written. Its tags are its author's letter's, or firmware's definition's, and a person node and a placeholder have none of the owner's.

Why the `n` tags change (Context 4): no reinstall pass reads them. They keep the node's tags in step with its place, so the letter export nostr sends names `to` and not `from`, and an instance that pulls this owner's class thread files the node in `to`. That is AC6's "its tags follow the move".

**10. Its letter and its cached copy.**
- **`letterOutOfDate`** is true when the node is kept in its json tag, has a letter, and Decision 9 changed a tag. That letter was signed with the `n` tags it had.
- **`letters`** are the instance's own letters that still state the node's old place (`M.LETTERS`):
  - the node's own letter, when `letterOutOfDate`, saying which `n` names `from` or which is missing for `to`;
  - each relationship event of the instance's own that names `from` → node, found by `M.ownLetters(read, { facts, kept, removed: [<from's link>], tags: <the n tags taken out>, sections: [], authors: R.ownKeys() })`.

  Of what `ownLetters` returns, move-element keeps the relationship events and words the node's own entry itself.
- **`cacheOutOfDate`** is true when the node has `tapestryJsonUpdatedAt`, however it is kept. It is read with R1 (`remove-from-concept.js:40`), the node read whole. The derive step's cached copy lists `from` among its direct parents until cache rebuild (A10.36; Context 6). So it can be true though a move never changes the node's JSON.

### What lasts (AC7)

**11. A restore keeps the move, and a reinstall keeps it except for a superset's redundant link.**
- **A backup restored on a fresh instance** restores the graph whole (BIBLE §30), with the links and tags as the move left them.
- **A firmware reinstall** (Context 4), by the move's shape:
  - **Between two sets:** it lasts. No reinstall pass links a set from a tag. When the node's `z` names the concept, it may also be directly under the concept's superset afterwards, as every element in a set is (ADR 0020 Decision 10). That link is pass 1d's, and was there before the move too.
  - **Out of a superset into a set, the filing of an element:** the link to `to` lasts. The link from `from` comes back when the node has a `z` naming the concept, as every node create-element makes has, and as another author's letter that names the concept has: pass 1d makes it. Pass 1e takes it out again on a firmware concept with a manifest, and wire-implicit-elements on other concepts only when something in the run was linked before it. So on the owner's own concepts, a filed node is usually directly in the superset again after a reinstall. It is still in the set, and its concepts are the same. A node with no such `z`, such as a person node, a placeholder, or a node kept beside whose letter names no such concept, stays as it was moved.
  - **Up to a superset while another set of the concept still holds the node:** the superset's link is redundant. Pass 1e takes it out on a firmware concept with a manifest (ledger row `2026-11-16-prune-drops-superset-has-element`), and wire-implicit-elements may on others. The node is still not in `from`, and its concepts are the same.
- **So AC7 as written** ("directly in `to` and not directly in `from`") holds after a restore, and after a reinstall for a move between two sets. In the two other shapes it doesn't hold for the superset's link. This is ADR 0020's reading of a reinstall, which "the same concepts and sets as before" sums up. Proposed story amendment 2 says it for AC7.
- **Both shapes are allowed, not refused.** Refusing a filing would refuse the move made most often. Refusing a move up to a superset while another set holds the node is Option C's half, which only pays once pass 1d changes too.
- **The answer's `note`** says so when it applies (Decision 12).

### What it answers and records

**12. The answer:** `{ outcome: 'moved' | 'already-moved', node, from, to, concept, kept, concepts, letters, letterOutOfDate, cacheOutOfDate, note, change }`.
- `node` is `M.NODE`, `{ tapestryKey, address, name }`. `from` and `to` are tapestryKeys. `concept` is the move's concept (Decision 4). `kept` is `json-tag` or `beside`.
- `concepts` is `M.CONCEPT_KEYS`, each concept the node is an element of, word's included, by tapestryKey. It is the same before and after.
- **`note`,** when the call changed something:
  - "Changed in this instance's graph only: nothing was signed or sent anywhere."
  - For a node kept beside: its tags and its JSON are left as they are, and only its links changed.
  - The letter sentence, and the cache sentence (`add-to-concept.js:246–247`).
  - When `from` is a superset whose concept's header a `z` of the node names: a firmware reinstall links `from` to the node again from that `z` (pass 1d), as for every element in a set. Install takes that redundant link out again only on a firmware concept with a manifest, and the node stays in `to` and in the concept.
  - When `to` is a superset and a set of its concept still holds the node directly, which M1 from `to` shows: the superset's link is redundant, and a reinstall's prune may take it out, leaving the node in that set and in the concept.
- **`already-moved`** answers `letters: []`, `letterOutOfDate: false`, `cacheOutOfDate: false` and `change: null`.

**13. The change entry,** in story 22's shapes (Context 7). The move's tag changes name `n` only.
- `{ change: 'membership-removed', type: <HAS_ELEMENT>, from: <from>, to: <node>, node, concept }`, with `count` when more than one copy went, as remove-from-concept records one;
- `{ change: 'membership-added', type: <HAS_ELEMENT>, from: <to>, to: <node>, node, concept }`, unless `inTo`;
- `{ change: 'tag-removed', node, field: 'n', was: <from's address> }` for each `n` taken out;
- `{ change: 'tag-added', node, field: 'n', now: <to's address> }` when one is added.

`graph history` finds the entry by the node, by `from`, by `to` and by the concept, with no change to history. When the node was already directly in `to`, it is found by the node, `from` and the concept, since `to`'s link wasn't made (proposed story amendment 4). `changes.js`'s header gains a sentence for these.

**14. The refusals, in one place,** in Decision 2's order, which is the declaration's:

| Code | Status | Names | Declared by |
|---|---|---|---|
| `same-set` | 400 | `to` | move-element (new) |
| `not-installed` | 409 | — | `M.NOT_INSTALLED_REMOVE` |
| `unknown-node` | 404 | `node`, `from` or `to` | move-element (its `when` names the three inputs) |
| `tag-node` | 409 | `node` | `M.TAG_NODE` |
| `made-elsewhere` | 409 | `node` | `M.MADE_ELSEWHERE_REMOVE` |
| `not-a-set` | 409 | `from` or `to` | move-element (its `when` names the two inputs) |
| `different-concepts` | 409 | `to` | move-element (new) |
| `not-in-from` | 409 | `from` | move-element (new) |
| `firmware-membership` | 409 | `node` | `M.FIRMWARE_MEMBERSHIP` |
| `author-claim` | 409 | `node` | `M.AUTHOR_CLAIM` |
| `leaves-concept` | 409 | `from` | move-element (new) |
| `joins-concept` | 409 | `to` | move-element (new) |

Signing in, the inputs' types and the body are the module's built-in refusals: 401, 403 and 400.

### Elsewhere

**15. What else changes.** These are small edits, each named, and no shared helper gains an export:
- `src/operations/rules/relationship-type-allowed.js:42`: `HAS_ELEMENT` is made by "graph add-to-concept, remove-from-concept, move-element and create-element", with its comment. No rulebook entry or rule element changes (Context 8; ADR 0022 Amendment 1, item 11).
- `src/operations/changes.js`'s header: a sentence for a move's changes.
- `src/operations/catalog/graph/_sets.js:35`'s header comment drops "and move-element (A10.23)". A move uses none of the set-write helpers listed there.
- `docs/GRAPH_OPERATIONS_CATALOG.md:113`: what was built, naming this ADR, as each built row does.
- Two ledger rows (Consequences).

## Consequences

**What this enables**
- Filing an element into a set, taking it back up to the superset, and moving it between sets, each in one call that never leaves it in both or in neither. The rebuild and tidying work the story describes needs no more than this.
- Moving another author's item, a person node, a placeholder or one of firmware's elements within the owner's own sets, with their letters and tags untouched.

**What this constrains**
- **A reinstall can make or take out a superset's redundant link** (Decision 11). On the owner's own concepts, a node filed out of its superset is usually directly under it again after a reinstall, as create-element's set members are today. Readers that ask for a superset's `direct` elements see it there. Its concepts and its set are unchanged.
- **A move never changes concepts.** Moving across concepts stays two calls, `add-to-concept` and then `remove-from-concept`, and the refusals say so.
- **Lock order:** the node alone. A later write that moves several nodes, or that locks a set before an element, has to keep node-first to stay deadlock-free beside these.

**New debt and follow-ups**
1. **Pass 1d links a superset to a node its class thread already reaches.** That is what makes create-element's and move-element's set placements depend on the run. The Implementer adds move-element's case to ledger row `2026-11-16-wire-implicit-prune-depends-on-run`. The fix shape is Option C's: pass 1d skips such a node, as wire-implicit-elements' own wiring does.
2. **`M.say.authorClaim`'s words** say that a firmware reinstall or the next import makes the claim again. That is true of a `z` claim, through pass 1d. For an `n` claim, the next pull of the author's class thread makes it, and the import makes no link (Context 4). The Implementer opens a ledger row for that wording in `_memberships.js`, which remove-from-concept shows. move-element words its own.
3. **The story's background, and ADR 0022's Decisions 9 and 15,** say the `n` tags keep a reinstall from linking again. Proposed story amendment 1 corrects the story; ADR 0022 is left as accepted, and this ADR's Context 4 is the correction.
4. **No reader counts the owner's claims** (ADR 0022 follow-up 1). A move of another author's node is the owner's claim, which reads judge by the node's author.
5. **Firmware reinstall required?** No. No concept's definition changes, and no rule element changes.

## Implementation notes

- **`src/operations/catalog/graph/move-element.js`** (new): Decisions 1–14, in remove-from-concept's shape. It keeps its own declarations (`SAME_SET`, `UNKNOWN_NODE`, `NOT_A_SET`, `DIFFERENT_CONCEPTS`, `NOT_IN_FROM`, `LEAVES_CONCEPT`, `JOINS_CONCEPT`), their words, and the words it gives `tag-node`, `made-elsewhere` and `author-claim`. It copies the pair delete, C11's tag delete and R1 from remove-from-concept, with a comment pointing there. Its header lists what it uses from `M`, `S`, `X`, `F`, `K`, `E`, `N` and `R`.
- **What it calls, all already exported:**
  - `N.keyInput`, `N.whoseNode`, `N.labelOf`;
  - `S.lockNode`, `S.nodeOf`, `S.kindOf`, `S.supersetOf`, `S.aliases`, `S.describe`, `S.descriptorsOf`;
  - `X.conceptsReaching`, `X.link`, `X.RESERVED_KEYS`, `X.conceptLabel`;
  - `F.conceptsOfNodes`;
  - `K.headersByKey`;
  - `M.lookedAfterElsewhere`, `M.keptIn`, `M.keysOf`, `M.tagsOf`, `M.waysIn`, `M.reaches`, `M.isElementLink`, `M.firmwareMembership`, `M.authorClaim`, `M.ownLetters`, `M.nodeOf`, `M.say.notInstalled`, `M.say.firmwareMembership`, and the declarations and schemas in Decision 14;
  - `E.addTags`, `E.tagRows`;
  - `R.ownKeys`.
- **Shared files:** `relationship-type-allowed.js`, `changes.js` (header), `_sets.js` (header comment) and the catalog's row (Decision 15).
- **Ledger:** move-element's case in `2026-11-16-wire-implicit-prune-depends-on-run`, and a new row for `M.say.authorClaim`'s `n` wording (Consequences 1 and 2).
- **Tests** (the Tester's, Phase 3; only the Tester changes `test/`):
  - each refusal of Decision 14, and each outcome;
  - the both-sets case, and the delete that finds nothing (Decision 8);
  - a move of a node `from` reaches only through a set below it;
  - tags written for a `json-tag` node and none for a node kept beside;
  - an `n` added for a set `to` and none for a superset;
  - `letterOutOfDate` false when no tag changed;
  - `cacheOutOfDate` true for a cached node kept beside;
  - the `note`'s two reinstall sentences;
  - JSON, `wordTypes`, `tapestryOwnSections` and marks unchanged;
  - `graph history` by the node, each set and the concept;
  - two moves of one node at once;
  - a move beside a remove-from-concept of the node.

  Every statement listed above is one story 22's and story 28's suites already run through the fake graph (`test/helpers/graphFake.js`); the Tester confirms that, and teaches the fake any shape it lacks.
- **The live check,** on a scratch stack (`scripts/scratch-stack.sh`), never the agent-memory instance:
  - AC7's agent run, through the external CLI;
  - on one of the owner's concepts with a set, a node filed out of the superset, a firmware reinstall, and the node then in the set, with its superset link as Decision 11 says, recorded either way;
  - a set-to-set move kept through a reinstall;
  - a backup restored on a fresh instance;
  - two moves of one node at once;
  - a peer's lettered node with an `n` naming `from`, refused `author-claim`;
  - a firmware element in a manifest's set, refused `firmware-membership`;
  - the relay's event count unchanged.
- **Branches:** staging only, by the usual chain, after staging is merged in (Context).

## Proposed story amendments (for the owner, at this gate)

1. **The background's seventh fact, on tags.** Instead of "so that a firmware reinstall and `wire-implicit-elements` don't put the link back", read: "so that the node's tags say where it is, as the letter `export nostr` sends will, and as an instance that pulls this owner's class thread follows them. A reinstall links from a `z` tag, never from an `n`." AC6 stands as written.
2. **AC7, after a reinstall** (Decision 11). Read: "After a backup restored on a fresh instance, a moved node is directly in `to` and not directly in `from`. After a firmware reinstall it is still directly in `to`, unless `to` is the concept's superset and another set of the concept holds it, and it is not directly in `from`, unless `from` is the concept's superset and the node's `z` names the concept: a reinstall can make or take out a superset's direct link to a node a set of its concept holds (ledger rows `2026-11-16-wire-implicit-prune-depends-on-run` and `2026-11-16-prune-drops-superset-has-element`). Its concepts and its sets are the same either way." Under Option C instead, AC7 stays as written, and AC5 gains the refusal of a move up to a superset while another set holds the node.
3. **AC4, word aside.** "The node's concepts stay the same" counts no concept keyed `word` or `graphContext`, as AC3 counts no word and D9 counts none.
4. **AC1, history.** "Which `graph history` finds by the node and by each set" holds whenever the move made `to`'s link. When the node was already directly in `to` (AC2), its entry is found by the node, `from` and the concept.

## Out of scope

- **Changing install's passes** (Option C; Consequences 1).
- **Moving a node across concepts,** a set under another parent, or many nodes in one call; an element's order in a set (the story's Out of scope).
- **Counting the owner's claims in reads** (ADR 0022 follow-up 1), and publishing the move (`export nostr`, A10.34).
- **Today's `delete-relationship` and `add-to-set` routes,** which stay as they are (D15).
