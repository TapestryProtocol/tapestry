# ADR 0020a: A concept's JSON Schema describes a node's tapestryJson, the JSON the Tapestry LMDB holds for it, and both readers judge that one document

**Status:** Accepted
**Date:** 2026-11-17
**Story:** none. This ADR answers Loom decision task A10.20.a, a subtask of A10.20 (`graph create-element`). Its plan is [docs/loom/A10.20.a.md](../../../docs/loom/A10.20.a.md). It follows the owner's direction of 2026-11-17, given on the pull request's first draft. Its decider accepts it by merging it.

## Context

ADR 0020's Amendment 1 found that the rule `element-fits-schema` and the derive step judge different documents. It recorded the split and left it standing until the two judged alike. Loom's A10.20.a asks three things:
- which document a concept's schema describes;
- how both readers then judge that one document;
- whether firmware's `word` schema drops `graphContext` from `required`.

`rules check` (A10.31) and the property operations' reports (A10.18) judge elements already made, and need the answer first.

What bears on it:

1. **Where a node's JSON lives** (the owner, 2026-11-17):
   - **tapestryJson,** in the Tapestry LMDB: the tapestry-store, `src/lib/tapestry-store.js`, at `~/.tapestry/lmdb` in the container. It is not strfry's LMDB (BIBLE §4, §29). The derive step writes it under the node's tapestryKey (`src/lib/tapestry-derive.js:122`). It holds a `word` block, a section for each concept the node is an element of, keyed by the concept's key, and `graphContext`.
   - **The `json` tag of a nostr event:** the letter.
   - **The `json` tag node in Neo4j:** the letter's tag, as a node. The graph operations also write one on nodes that have no event, as the tag a letter would carry (ADR 0016, Decision 1; ADR 0020, Decision 9).

   Every node has tapestryJson, by design, but not every node has an event. A new element made from scratch may have no `json` tag, and may never get one. An imported event's `json` tag may or may not be the main source of an element's information.
2. **The rule judges the `json` tag.** `_schemas.js` reads a concept's schema (E1). The rule then judges one of two things:
   - the JSON a write is about to store (`{ concept, json }`);
   - a node's `json` tag (`{ node }`: E4, resolved by `F.readJson`).

   It judges against each concept whose class thread reaches the node (`F.conceptsOfNodes`, `src/operations/catalog/graph/_fields.js:386–399`).
3. **The derive step judges the tapestryJson it builds.** `src/lib/derivers/word.js` builds its `base` from three places, in order (`:42–75`):
   - the node's tapestry-store entry, when that has a `word` block;
   - else the `json` tag, when that has a `word` block;
   - else `{}`. A `json` tag with no `word` block is dropped, sections and all.

   It fills in `word.slug`, `word.name` and `word.wordTypes` (`:78–83`), adds `graphContext` (`:119–133`), judges the whole `base` (`:135–179`), and stores it. It judges against each `ConceptHeader` whose class thread reaches the node within ten links, and each one a `z` tag names (`:100–117`). It keeps the verdicts in `graphContext.parentJsonSchemas`. `set.js` does the same for sets and supersets (`:170–260`), after it adds its set fields to `graphContext`. Both readers read a schema alike: the `jsonSchema` section, `$schema` dropped, ajv's default class (draft-07's keywords), `allErrors` on and `strict` off.
4. **Where they split** (ledger row `2026-11-16-derive-step-and-rule-check-split`):
   - under firmware's `word` schema, which requires `graphContext`;
   - under a schema that forbids extra top-level keys;
   - for JSON with no `word` block, or a `word` block missing a field the derive step fills in;
   - where they judge different concepts;
   - when the derive step's entry is out of date;
   - under any schema that says anything about `graphContext`.

   Test SC9 (`test/operations/graph/element-schemas.test.js:317–344`) pins the first four. Under `word`'s schema it finds the derive step's tapestryJson valid, and the `json` tag missing `graphContext`.
5. **Firmware's `word` schema was written for tapestryJson.**
   - Its description calls it "The master schema for all word nodes", governing "'graphContext' including conditional Set-specific fields" (`firmware/versions/v1.0.0/concepts/word/json-schema.json`).
   - It requires `word` and `graphContext`. In an `allOf`, it requires `graphContext.elements`, `childSets` and `parentSets` when `wordTypes` holds `set`, which are the fields `set.js` adds.
   - It describes the two top-level keys no concept may be keyed, `word` and `graphContext`, which ADR 0020's Amendment 1 reserves (item 2).
6. **Judged as `json` tags, firmware's elements all fail `word`'s schema, and only for that.** Measured on 2026-11-17 against firmware's 83 element files (`concepts/*/elements/*.json`), read as `_schemas.js` reads a schema: each fails with one error, `must have required property 'graphContext'`. The split is in the document judged: a `json` tag never holds what only the derive step builds.
7. **Much of the graph is an element of `word`.**
   - Firmware puts seventeen concepts' supersets under `word`'s (ADR 0021, fact 9). So every set, graph, property, relationship type and concept header is an element of `word`.
   - On the local instance `word` has 503 elements (`/api/concept-graph/summaries`, 2026-11-17).
   - `graph create-set` reports on every create that the new set doesn't fit `word`, for `graphContext` (ADR 0027, Consequences 1).
8. **What the owner has settled.**
   - **D9:** each node "must validate against the expected format, as defined by that concept (typically as defined by that concept's JSON Schema)".
   - **D10:** "a local node's Tapestry JSON ought to live in LMDB" and "should be recoverable in full from the neo4j graph itself". Membership is the edges.
   - **D2:** dependencies point inward, so the cache depends on the graph, never the reverse (docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md).
   - **The local-first rule** (CLAUDE.md principle 4; BIBLE §30): Neo4j is the definitive self, and events are letters. No wipe may destroy locally authored state.
9. **tapestryJson is often missing, incomplete or out of date.**
   - **Missing.** On the local instance, these have no entry (`GET /api/tapestry-key/derive-status`, 2026-11-17):
     - 80 of 485 list items;
     - 9 of 53 supersets;
     - 9 of 49 concept headers, and as many JSON schemas and properties.
   - **Missing at first.** An element `graph create-element` makes gets none until a derive pass runs (ADR 0020, Consequences).
   - **Out of date.** The derive step starts from its old entry, so after a `json` tag changes, the entry keeps its old sections (OPEN.md row 139; memos 110 and 121 on A10.36).
   - **Not backed up.** The tapestry-store is on no Docker volume and has no backup. It is lost when the container is recreated (BIBLE §29).
10. **An offloaded `json` tag points into tapestryJson.**
    - The offload routes write a `json` tag's value into the tapestry-store under the node's tapestryKey, and set the tag to `lmdb:<key>` (`src/api/tapestry-key/index.js:255–261`, `:345–350`).
    - The derive step then rewrites that entry. So an offloaded node's `json` tag resolves to its tapestryJson, and its own content lives only in the store (OPEN.md row 137's "dual role").
    - Only those two routes write such a reference.
11. **The other readers judge the `json` tag.**
    - The Health Audit's JSON check judges each core node's `json` tag (`src/api/audit/index.js:622–718`).
    - The concept pages judge each element's `json` tag (`ui/src/pages/concepts/ConceptElements.jsx`, `ElementDetail.jsx`).
    - The node page shows one verdict on tapestryJson and one on the `json` tag (`ui/src/pages/nodes/NodeJson.jsx:282–299`).
    - The normalization tooling's `json-schema-violation` is a "json tag [that] doesn't validate" (docs/NORMALIZATION_TOOLING.md).

    OPEN.md row 219 saw the Health Audit fail on nearly every concept. One of its two dominant errors was `must have required property 'graphContext'`.
12. **No code acts on the derive step's verdicts.** Outside the two derivers, only tests read `parentJsonSchemas`: SC9, and L5a in `test/pass-3-finishes-in-minutes.test.js`, whose oracle `ORACLE_SCHEMAS` (`:345–354`) restates the derive step's concept set.

Concepts touched, by handle (`<TA>` is the instance's assistant, `GET /api/assistant/pubkey`): `39998:<TA>:word`, whose schema describes every node's `word` and `graphContext` (read; unchanged); and every concept whose elements are judged (read).

## Options considered

### Option A — The schema describes tapestryJson, and both readers judge it

A concept's schema describes a node's tapestryJson, the node's own document. The rule judges tapestryJson in place of the `json` tag. The derive step keeps judging what it builds, but through `_schemas.js` and against the rule's concepts. Firmware's `word` schema stays as it is.

- **Pros:**
  - one document for every node, with an event or without, with a `json` tag or without (fact 1);
  - the self's own document is the one judged, and a letter is made from it (fact 8);
  - `word`'s schema is right as written (fact 5), and so is every rule it makes about `graphContext`;
  - the derive step's `word` defaults and its sections stop splitting the verdicts, because they are part of the document;
  - a schema is read in one place, so its dialect moves once (ADR 0020, Decision 11).
- **Cons:**
  - a node can be judged only once its tapestryJson is built, and often it hasn't been (fact 9);
  - a write judges a document whose `graphContext` is built after it;
  - every reader of the `json` tag has to move (fact 11);
  - a received letter is judged only on the instance that builds its tapestryJson.

### Option B — The schema describes the `json` tag, and the derive step judges the `json` tag

This was the pull request's first draft. The derive step asks `_schemas.js` for the rule's verdict on the `json` tag, with `graphContext` left out. Firmware's `word` schema drops `graphContext`.

- **Pros:** the readers of the `json` tag stay as they are, and the document is the one a letter carries.
- **Cons:**
  - not every node has a `json` tag, or will (fact 1);
  - it measures the self by its letters, the wrong way round for the local-first rule (fact 8);
  - it undoes `word`'s schema, and every rule a schema could make about a node's place in the graph.

### Option C — The schema describes tapestryJson, but the rule judges the `json` tag with the derive step's sections left out

This is the second way the task named. The rule keeps reading the `json` tag. It treats `graphContext`, and the fields the derive step fills in, as present.

- **Pros:** the rule needs no tapestryJson to judge.
- **Cons:**
  - it judges a document new elements may not have;
  - the rule has to know what the derive step adds, and change whenever it does;
  - two documents remain, so the readers can still split.

## Decision

We chose **Option A**. tapestryJson is each node's own document, and the letter is made from it. Option B would judge the self by its letters, and Option C would keep two documents.

**1. The rule.** A node's **fully realized** tapestryJson validates against the JSON Schema of each concept of which it is an element. This is BIBLE §10's rule 4, and the owner's D9.
- tapestryJson is the JSON the Tapestry LMDB (the tapestry-store, not strfry's LMDB) holds under the node's tapestryKey.
- A node is an element of each concept whose class thread reaches it (rule 3). Membership is the edges (D10).
- The rule holds for every concept's schema, firmware's and any other author's. Every reader judges this one document: the derive step, the writes, `rules check`, the property operations' reports, the Health Audit and the UI.

**2. Fully realized, and the exceptions to come.**
- A node's tapestryJson can be:
  - **missing:** no entry yet;
  - **incomplete:** some of its sections not built;
  - **out of date:** built before a change.
- Its fully realized form holds a section for every concept the node is an element of, each up to date, and its `graphContext`. That is the form the rule speaks of.
- **The owner expects exceptions to the rule, for performance.** One example: not building a node's full tapestryJson until the node is published. They aren't written yet, and where they will live is open, perhaps inside the schemas themselves.
- **This ADR writes the rule, and no exceptions.** Until one is written, an entry that is missing, incomplete or out of date doesn't meet the rule, and a reader that judges it says so.

**3. tapestryJson is built one concept at a time.**
- Each concept's section is built on its own. A build starts from the node's existing entry when there is one, and keeps the sections it doesn't build intact (the owner, 2026-11-17).
- `word`'s schema describes two top-level keys:
  - **the `word` block,** which the write that makes a node gives it, and the derive step completes;
  - **`graphContext`,** which only the derive step builds, from the graph.
- Every other concept's section comes from what a write or an import gives the node. Today that is the node's `json` tag. Where it comes from later is open, as is whether an imported event's `json` tag is its main source (fact 1).
- **The derive step stays the only writer of the tapestry-store** (D10, drafting). When a write changes a concept's section, the derive step rebuilds that section from what the write stored, and keeps the rest. That answers OPEN.md row 139 in these terms: the change reaches tapestryJson, and the other sections stay as they were.

**4. Every node has tapestryJson; that is the default the exceptions may relax.**
- A write that makes or changes a node has the derive step build its tapestryJson after the write commits, so the node has one at once.
- A firmware reinstall's Pass 3, and `cache rebuild` (A10.36), still build every node's.

**5. Both readers judge tapestryJson, through `_schemas.js`.**
- **The derive step** builds a node's sections, then judges the whole tapestryJson against the schema of each concept the node is an element of. It uses `_schemas.js`: one reading of a schema, one wording of a problem. It judges the concepts the rule judges, those whose class threads reach the node, and no longer the headers a `z` tag names. It keeps the verdicts, dated, in `graphContext.parentJsonSchemas` (Decision 7).
- **A write** judges the tapestryJson its node will have once the section it writes is built. That is the node's existing entry, or what the derive step starts from, with the written concept's section as the write builds it. The write judges it against the schema of the concept it writes, and refuses as today (ADR 0020, Decisions 12 and 16).
  - Its report on each other concept judges the same document.
  - `word` is reported as waiting for the derive step until the node has a `graphContext`, since only the derive step builds it.
  - A write isn't refused for `graphContext`. It follows from the graph, not from what was written, and the derive step judges it.
- **The rule's check form** (`{ node }`: `rules check` and A10.18's reports) judges the node's tapestryJson as the tapestry-store holds it, in place of its `json` tag.
  - A node with no entry has no tapestryJson to judge. It gives one finding saying so, as a node whose JSON can't be read does today.
  - An entry built before a change is judged as it is. The finding says when it was built (`graphContext.derivedAt`).
  - Whether `rules check` has the derive step build a node's tapestryJson before judging it is A10.31's to design, and is a likely place for an exception.

**6. Firmware's `word` schema stays as it is.** It keeps `graphContext` in `required`. That answers the task's third question: no.
- Judged as tapestryJson, a node fits it once the derive step has built its `graphContext` (SC9 finds the derive step's tapestryJson valid under it).
- Judged as `json` tags, firmware's 83 element files fail it (fact 6). That is the rule judging the wrong document, not a fault in the schema.

**7. The rule decides; the derive step keeps a dated copy.**
- `parentJsonSchemas` says what the rule said at `lastValidated`. A schema change doesn't re-judge its concept's elements, so the copy can be out of date.
- A reader that acts on a verdict calls the rule when it acts, and never reads `parentJsonSchemas`. That covers `rules check` (A10.31), A10.18's reports, the writes, and the Health Audit and the UI once they move.

**8. A letter is made from tapestryJson, and judged where it lands.**
- Publishing builds a letter's `json` from tapestryJson, and strips what is local: `graphContext` at least. What else, is A10.34's (`export nostr`) to decide.
- A letter received from elsewhere is judged once the receiving instance has built its tapestryJson. Its `graphContext` comes from the receiver's own graph, since a `graphContext` built in Alice's graph means nothing in Bob's.
- So a schema's rule about `graphContext` checks the local graph around a node, not what its author wrote. One element can fit on one instance and not on another, as CLAUDE.md principle 1 expects.

**9. A section never lives only in tapestryJson, until the store is backed up.**
- The tapestry-store is lost when the container is recreated (fact 9). So a section's facts stay in the graph too, in the node's `json` tag node or its node properties, as they are today. A rebuild can then restore them (D10; BIBLE §30; CLAUDE.md principle 4).
- So the operations keep writing the `json` tag node for now, though under this model a new element needn't have one.
- Dropping it waits for one of two things: the graph holding every fact a section holds (D10), or a backup of the tapestry-store (D10: "we can at a later date decide to implement a backup procedure").

**10. What stays.**
- **create-element's `reserved-key` refusal** (ADR 0020, Amendment 1, item 2). `word` and `graphContext` are the two keys `word`'s schema governs (fact 5), so a concept keyed either would collide with them.
- **How a schema is read:** the `jsonSchema` section, `$schema` dropped, ajv's default class. It is now read in one place.

**11. The build.** It is one story in graph-operations-first-slice, under a Loom build task once this ADR is merged. It comes before A10.31 and A10.18 judge elements already made. Building one concept at a time, and deriving after a write commits, may need an ADR of the story's own. Its pieces are in Implementation notes.

## Consequences

**What this enables**
- One document and one verdict for each node, from every reader, whether or not the node has an event or a `json` tag.
- `word`'s schema stands as written. Its rules about `graphContext`, the set fields among them, are checked where they can be met.
- The derive step's `word` defaults stop splitting the verdicts.
- Exceptions can be written against a rule that is stated.
- A schema's dialect can move to draft 2020-12 in one place, `_schemas.js`.

**What this constrains**
- **A verdict needs tapestryJson.** A node with no entry, or with sections built before a change, isn't judged in its fully realized form until the derive step builds it. `rules check` has to handle those nodes (A10.31).
- **Each write now costs a derive** (Decision 4). A pass still rebuilds every node at a reinstall.
- **The rule reads the tapestry-store** as well as Neo4j, outside the write's transaction.
- **A schema that forbids extra top-level keys fits no fully realized tapestryJson,** since that always has `graphContext`. Both readers now say so.
- **The derive step depends on the graph module:** `_schemas.js`, `_fields.js` and firmware's relationship names. D2 allows it.
- **An element tied to a concept only by its `z` tag isn't judged against that concept** until wire-implicit-elements gives it the edge. BIBLE §10 lists "Inferrable HAS_ELEMENT" as an intentional violation.

**New debt and follow-ups**
- **The exceptions to the rule,** and where they live (Decision 2).
- **What a letter strips,** and how an import builds a received element's sections (A10.34; fact 1).
- **A backup of the tapestry-store,** or every fact in the graph, before a section may live only in tapestryJson (Decision 9).
- **An offloaded `json` tag** already puts its content only in the tapestry-store (fact 10). D10 drafts the offload as applying only to imported nodes, whose letters are in the relay. Row 137 is where to decide it.
- **The Health Audit and the concept pages move onto tapestryJson.** The node page's verdict on the `json` tag judges a document no schema describes.
- **OPEN.md row 219** should be measured again once the audit judges tapestryJson.
- **Firmware reinstall required?** Yes, in the build, for rule 7's element file, whose text changes. `word`'s schema doesn't change. This ADR changes no firmware.

## Implementation notes

For the build's story. Its Architect may refine them.

- **`src/operations/catalog/graph/_schemas.js`:**
  - `tapestryJsonOf(node)` → `{ json, problem }`, reading the node's entry from the tapestry-store, with a problem when there is none;
  - the header says what now holds: one document, tapestryJson, and one verdict.
- **`src/operations/rules/element-fits-schema.js`:**
  - the `{ node }` form judges `tapestryJsonOf` in place of E4 and `readJson`;
  - the `{ concept, json }` form is unchanged, since the write passes the tapestryJson it will produce (Decision 5);
  - the header follows.
- **The writes** (create-element, update-node; add-to-concept when it is built):
  - each builds the tapestryJson its node will have: its entry, or what the derive step starts from, with the written section;
  - each passes that to the rule, and reports `word` as waiting for the derive step when there is no `graphContext`;
  - each has the derive step build the node after commit, naming the section it changed.
- **`src/lib/derivers/schema-verdicts.js`** (new): the derive step's verdicts through `_schemas.js` (Decision 5).
  - It finds the concepts with `F.conceptsOfNodes`.
  - It shares one `judge` across a pass, so each schema compiles once per pass, not once per node (`word.js:162–164` today).
- **`src/lib/derivers/word.js` and `set.js`:**
  - their schema queries and ajv blocks go, replaced by the shared call;
  - a rebuild names the sections it rebuilds, and keeps the others (Decision 3);
  - a `json` tag with no `word` block keeps its sections, where today it is dropped for `{}` (`word.js:63`, `:75`).
- **Docs:**
  - `docs/GRAPH_RULES.md` §7 says the rule judges a node's fully realized tapestryJson, and that exceptions will come;
  - BIBLE §10's rule 4 names tapestryJson;
  - BIBLE §21's `graphContext` row says `word`'s schema governs it, and publishing strips it;
  - BIBLE §29 says tapestryJson is the document a concept's schema describes. It is still rebuildable, since every section's facts stay in the graph (Decision 9);
  - the ledger row `2026-11-16-derive-step-and-rule-check-split` closes, pointing here;
  - ADR 0020's Decisions 11 and 17, its Amendment 1 item 1, and ADR 0027's Consequences 1 each get a line pointing here.
- **Firmware:** rule 7's element file is regenerated with `node src/firmware/graph-rules.js` once §7's text changes. `word`'s schema stays.
- **Tests** (the Tester's, Phase 3):
  - SC9 turns from pinning the splits to pinning one verdict. It runs the real derive step and the rule's check form on the same tapestryJson, under:
    - firmware's `word` schema (both find it valid once `graphContext` is built);
    - a schema that forbids extra top-level keys (both find it invalid);
    - a `json` tag with no `word` block (its sections kept);
    - a `word` block missing a field the derive step fills in;
    - an entry built before a change (both judge the entry);
    - a concept only a `z` tag names (neither judges it).
  - A node with no entry gives one finding.
  - create-element reports `word` as waiting for the derive step, and the node has tapestryJson after the write.
  - Rebuilding one section keeps the others.
  - L5a's oracle in `test/pass-3-finishes-in-minutes.test.js` moves to the concepts `F.conceptsOfNodes` finds. L3's and L4's time limits still hold.
- **The live check** runs on a scratch stack (`scripts/scratch-stack.sh`), never the agent-memory instance:
  - after `graph create-set`, the set has tapestryJson whose `parentJsonSchemas` says it fits `word`, and the rule's check agrees for each concept;
  - after `graph update-node`, the changed section is rebuilt and the others are as they were;
  - the relay's event count is unchanged.
- **Branches:** staging only, by the usual chain.

## Out of scope

- **The build itself** (Decision 11). This ADR changes no code and no firmware.
- **The exceptions to the rule,** and where they live.
- **What a letter strips** (A10.34), and how an import builds a received element's sections.
- **Backing up the tapestry-store,** or moving every fact into the graph.
- **Moving the Health Audit and the concept pages onto the rule.**
- **Moving the dialect to draft 2020-12.**
