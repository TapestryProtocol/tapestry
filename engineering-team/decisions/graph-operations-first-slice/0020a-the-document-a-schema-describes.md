# ADR 0020a: A concept's JSON Schema describes an element's stored JSON, never the derived cache, and the derive step judges that one document through `_schemas.js`

**Status:** Proposed
**Date:** 2026-11-17
**Story:** none. This ADR answers Loom decision task A10.20.a, a subtask of A10.20 (`graph create-element`). Its plan is [docs/loom/A10.20.a.md](../../../docs/loom/A10.20.a.md). Its decider accepts it by merging it.

## Context

ADR 0020's Amendment 1 found that the rule `element-fits-schema` and the derive step judge different documents. It recorded the split and left it standing "until the derive step calls `_schemas.js`". Loom's A10.20.a asks which document a concept's schema describes, how both readers then judge that one document, and whether firmware's `word` schema drops `graphContext` from `required`. `rules check` (A10.31) and the property operations' reports (A10.18) judge elements already made, and need the answer first.

What bears on it:

1. **The rule judges the stored JSON.** `_schemas.js` reads a concept's schema (E1), and the rule judges either the JSON a write is about to store (`{ concept, json }`) or a node's json tag (`{ node }`: E4, resolved by `F.readJson`). It judges against each concept whose class thread reaches the node (`F.conceptsOfNodes`, `src/operations/catalog/graph/_fields.js:386–399`), a `ConceptHeader` or a `ListHeader`, through any number of sets.
2. **The derive step judges its own copy.** `src/lib/derivers/word.js` builds its `base` from the cached entry when that has a `word` block, else from the json tag when that has one, else from `{}` (`:42–75`). It fills in `word.slug`, `word.name` and `word.wordTypes` (`:78–83`), adds its `graphContext` (`:119–133`), and then judges the whole `base` (`:135–179`). It judges against each `ConceptHeader` whose class thread reaches the node within ten links, and each one a `z` tag names (`:100–117`). It keeps the verdicts in the cache, as `graphContext.parentJsonSchemas`. `set.js` does the same for sets and supersets (`:170–260`), after it adds its set fields to `graphContext`. Both readers read a schema alike: the `jsonSchema` section, `$schema` dropped, ajv's default class (draft-07's keywords), `allErrors` on and `strict` off.
3. **Where they split** (ledger row `2026-11-16-derive-step-and-rule-check-split`):
   - under firmware's `word` schema, which requires `graphContext`;
   - under a schema that forbids extra top-level keys;
   - for JSON with no word block, or a word block missing a field the derive step fills in;
   - where they judge different concepts;
   - when the cache is stale;
   - under any schema that says anything about `graphContext`.

   Test SC9 (`test/operations/graph/element-schemas.test.js`) pins the first four.
4. **Firmware's `word` schema was written for the cache.** Its `$comment` reads "Test schema — unified word schema with graphContext and conditional dependencies" (`firmware/versions/v1.0.0/concepts/word/json-schema.json`). Its description calls it "The master schema for all word nodes", governing "'graphContext' including conditional Set-specific fields". So it:
   - requires `word` and `graphContext`;
   - describes `graphContext`'s `identifiers`, `elementOf`, `parentJsonSchemas` and `derivedAt`;
   - in an `allOf`, requires `graphContext.elements`, `childSets` and `parentSets` when `wordTypes` holds `set`. Those are the fields `set.js` adds.

   `json-schema-backup.json` beside it is the earlier schema, with no `graphContext`: "Every word node must validate against this JSON schema." No other firmware schema mentions `graphContext`.
5. **Every firmware element fails `word`'s schema, and only for that.** Measured on 2026-11-17 against firmware's 83 element files (`concepts/*/elements/*.json`), with the ajv the repo installs and read as `_schemas.js` reads it:
   - each one fails `word`'s schema, with one error: `must have required property 'graphContext'`;
   - with `graphContext` taken out (its property, its `allOf`, and its two `$defs`, which nothing else uses), all 83 fit.
6. **Much of the graph is an element of `word`.** Firmware puts seventeen concepts' supersets under `word`'s (ADR 0021, fact 9), so every set, graph, property, relationship type and concept header is an element of `word`. On the local instance `word` has 503 elements (`/api/concept-graph/summaries`, 2026-11-17). `graph create-set` reports on every create that the new set doesn't fit `word`, for `graphContext` (ADR 0027, Consequences 1). `rules check` would report every one of them.
7. **What the protocol says a schema is for.** The JSON Schema core node "Validates the structure of elements". Element data is stored in a `json` tag, and the word-wrapper format is "the canonical structure of the `json` tag" (protocols/drafts/tapestry-concepts.md). BIBLE §29: "Node content is still *specified* in the event's `json` tag"; the LMDB is "a local storage optimization over that content". BIBLE §21 calls `graphContext` "local, dynamic, non-portable metadata ... Stripped before sharing via nostr events", and `word`'s own schema says the same of it. A schema is itself published, as a concept's core node. Another instance, or another author, has only letters to judge with it: an export sends the events from the relay, "the portable signed form (no `graphContext`…)" (`src/api/concept/exportSet.js:16`).
8. **What the owner settled about the cache.** D10: the Tapestry JSON lives in LMDB as a cache, "recoverable in full from the neo4j graph itself". What is "bulk computed from the graph (element lists, resolved schemas, graph context)" lives only there, and edges are the authority on which concepts a node belongs to. D9: each node "must validate against the expected format, as defined by that concept (typically as defined by that concept's JSON Schema)". D2: dependencies point inward, so the cache depends on the graph, and the graph on neither (docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md).
9. **The cache is often missing or stale.**
   - An element create-element makes has no cached JSON until the derive step runs (ADR 0020, Consequences).
   - On one local instance, 3,435 of 3,886 nodes had no cached entry (`GET /api/tapestry-key/status`, 2026-11-17).
   - The derive step prefers its cached entry over the json tag. So after update-concept, update-node, save-element-json or set-json-tag changes a json tag, the cache keeps the old content until it is rebuilt from the graph (OPEN.md row 139; memos 110 and 121 on A10.36).
10. **An offloaded json tag shares its LMDB entry with the cache.** The offload routes write a json tag's value into LMDB under the node's tapestryKey and set the tag to `lmdb:<key>` (`src/api/tapestry-key/index.js:255–261`, `:345–350`). The derive engine writes its cached JSON under the same key (`src/lib/tapestry-derive.js:122`). So once an offloaded node is derived, its json tag resolves to the cached JSON, with `graphContext` and `word` defaults in it, and the rule's `F.readJson` judges the cache too. update-node then writes that JSON back inline, `graphContext` included (`src/operations/catalog/graph/update-node.js:301–302`; `_elements.js:505` keeps the key as it found it). This is OPEN.md row 137's "dual role". Only those two routes write such a reference.
11. **The other readers already judge the stored JSON.**
    - The Health Audit's JSON check judges each core node's json tag (`src/api/audit/index.js:622–718`).
    - The concept pages judge each element's json tag (`ui/src/pages/concepts/ConceptElements.jsx`, `ElementDetail.jsx`).
    - The node page shows two verdicts, one on the cached JSON and one on the json tag (`ui/src/pages/nodes/NodeJson.jsx:282–299`).
    - The normalization tooling's `json-schema-violation` is a "json tag [that] doesn't validate against concept's schema" (docs/NORMALIZATION_TOOLING.md).

    OPEN.md row 219 saw the Health Audit fail on nearly every concept in September, its commonest error `must have required property 'graphContext'`. The row doesn't record which schema gave it.
12. **No code acts on the cached verdict.** Outside the two derivers, only tests read `parentJsonSchemas`: SC9, and L5a in `test/pass-3-finishes-in-minutes.test.js`, whose oracle `ORACLE_SCHEMAS` (`:345–354`) restates the derive step's concept set. A person or an agent sees the verdict in a node's cached JSON (`GET /api/tapestry-key/:key`, A10.36's `cache get`).

Concepts touched, by handle (`<TA>` is the instance's assistant, `GET /api/assistant/pubkey`): `39998:<TA>:word`, whose JSON schema node's json tag changes (by firmware, in the build); and every concept whose elements the derive step judges (read).

## Options considered

### Option A — The schema describes the stored JSON, and the derive step judges it through `_schemas.js`

A concept's schema describes the word-wrapper JSON an element's letter carries. The derive step stops judging its `base`. It asks `_schemas.js` for the rule's verdict on the stored JSON, against the concepts the rule judges, and keeps that verdict in the cache. Firmware's `word` schema drops `graphContext`.

- **Pros:**
  - one document and one verdict, on every instance and for every author;
  - every reader but the derive step already judges this document (fact 11), so only the derive step changes;
  - a write judges exactly what it stores (ADR 0020, Option A), and judges an element that has no cache yet;
  - a stale or missing cache doesn't change the verdict;
  - the schema's dialect is read in one place, so it moves once (ADR 0020, Decision 11).
- **Cons:**
  - firmware's `word` schema changes, and reaches each instance only with a firmware reinstall;
  - no concept's schema can describe what the derive step computes;
  - the cached verdict is a dated copy of the rule's (Decision 6).

### Option B — The schema describes the cache, and the rule leaves the derive step's own sections out of what it requires

The derive step keeps judging its `base`. Before it judges stored JSON, the rule rewrites each schema: it drops `graphContext` from `required`, lets it through a top-level `additionalProperties: false`, and treats the fields the derive step fills in as present.

- **Pros:** firmware's `word` schema stays as it is.
- **Cons:**
  - every schema then means "this deployment's cache", which only this code builds. Every published schema would describe a document no letter carries, and another instance or author couldn't judge an element with one;
  - the rule would need to know what the derive step adds, and change whenever the derive step does;
  - the Health Audit, the concept pages and the normalization tooling judge the json tag (fact 11), so they would still disagree with both;
  - a write would be judged against a schema that speaks of sections the write can't supply;
  - the verdict still follows a stale cache.

### Option C — The schema describes the stored JSON, and the derive step stops judging

As Option A, but the cache keeps no verdict: `parentJsonSchemas` goes, or lists the schemas without one. Every verdict is the rule's, computed when it is asked for.

- **Pros:** nothing can go stale (CLAUDE.md principle 3: filter at view time).
- **Cons:**
  - the cache's shape changes, and a person or an agent reading a node's cached JSON needs a second call for its verdicts;
  - what it guards against is small: a verdict that says when it was made (`lastValidated`) is honest about its age, and A10.36's `cache get` rebuilds a stale entry before it answers.

## Decision

We chose **Option A**. A concept's schema is published and read by others, so it has to describe what the letter carries. The cache is this instance's own, rebuildable view of the graph (D10). Every reader but one already judges the stored JSON. Option B would make every schema describe a local document, and Option C's gain comes from A10.36's rebuild-before-read anyway.

**1. What a concept's schema describes.** An element's stored JSON: the word-wrapper JSON its letter carries in its json tag. It never describes the derived cache. This holds for every concept's schema, firmware's and any other author's, and for every reader: the rule, the derive step, `rules check`, the property operations' reports, the Health Audit and the UI.

**2. The stored JSON, exactly.**
- For a node, it is its json tag, resolved through the LMDB when it is an `lmdb:` reference (fact 10), with any top-level `graphContext` left out.
- For a write, it is the JSON the write is about to store, with any `graphContext` left out in the same way.
- **Why `graphContext` is left out.** It is the key the cache keeps for itself, which no concept may be keyed (ADR 0020, Amendment 1, item 2), and no letter carries it (fact 7). So no concept's schema can ask for it, forbid it or describe it. Leaving it out gives one verdict whether the tag is inline or offloaded, and whatever an update has copied into it (fact 10).
- **A write stores no `graphContext`.** update-node leaves it out of the JSON it stores, and add-to-concept (A10.22) will do the same. `export nostr` (A10.34) never signs one.

**3. One function reads it.** `_schemas.js` gains `storedJson(read, node)` → `{ json, problem }`: E4's read of the json tag, `F.readJson`, and `graphContext` left out. The rule's `{ node }` form calls it in place of its own E4 and `readJson`. Its `{ concept, json }` form leaves `graphContext` out of the JSON it is given. `judge`, `fits` and `checkElements` don't otherwise change, and neither do the rule's codes, messages or items.

**4. The derive step judges that document, against the same concepts, through `_schemas.js`.** In `word.js` and `set.js`, the schema rows and the ajv block are replaced by one call to a new shared function, `src/lib/derivers/schema-verdicts.js`. It:
- **finds the concepts the rule judges:** `F.conceptsOfNodes(read, [tapestryKey])`, every concept whose class thread reaches the node. It no longer adds the headers a `z` tag names: membership is the edges (D10), and a node no class thread reaches is rule 3's business;
- **reads the stored JSON** with `storedJson` (Decision 3), never the derive step's `base`. A stale cache then can't change the verdict, only the rest of the cached JSON (fact 9);
- **judges it** with one `judge(read)`, so each concept's schema is read and compiled once per derive pass rather than once per node (today's derivers compile one for each node, `word.js:162–164`);
- **returns `parentJsonSchemas` in today's shape:** one entry for each of those concepts that has a JSON schema node, `{ uuid, tapestryKey, conceptName, conceptTapestryKey, lastValidated, valid, errors }`:
  - `valid` is the rule's `fits`, and is null when the schema can't be read or doesn't compile;
  - `errors` are the rule's problems in its words, or its one `problem`.

The derive step runs outside a transaction, so it passes a read made from `runCypher`. `_schemas.js` and `_fields.js` only read through it. The cache now depends on the graph module, which D2 allows (fact 8).

**5. Firmware's `word` schema drops `graphContext` altogether: from `required`, as the task asked, and its section too.**
- It loses:
  - `graphContext` from `required`;
  - its `graphContext` property;
  - the `allOf` that requires the set fields;
  - its two `$defs`, `nodeRef` and `nodeRefList`, which nothing else uses;
  - its `$comment`.
- Its description says what it governs: the `word` block of every word node's stored JSON.
- What is left is `json-schema-backup.json`'s schema in today's words. The backup file then only copies it, and goes. Nothing reads it.

**Why the whole section, not only `required`.** Under Decision 2 the rest of the section could never apply. It would also tell the next reader that `word`'s schema governs the cache. The cache's shape is the derive step's to keep, written in the derivers' headers and BIBLE §29. It is checked by rebuilding and comparing (D10's check, `cache check`, A10.36), not by a concept's schema.

The change reaches an instance with a firmware reinstall: Pass 2's save-schema writes `word`'s schema node from the firmware file. Fact 5's measure becomes a test.

**6. The rule decides; the cache keeps a dated copy.** `parentJsonSchemas` says what the rule said at `lastValidated`. The copy can be out of date:
- a schema change doesn't re-derive its concept's elements;
- a json tag change doesn't re-derive its node.

So a reader that acts on a verdict calls the rule when it acts, and never reads `parentJsonSchemas`. That covers `rules check` (A10.31), the property operations' reports (A10.18), the writes, and the Health Audit and the UI when they move onto the operations. An agent that wants a fresh copy uses `cache get`, which rebuilds a stale entry before it answers (A10.36).

**7. What stays.**
- **create-element's `reserved-key` refusal** (ADR 0020, Amendment 1, item 2). A section filed under `word` would still replace the word block, so firmware's `word` stays refused. Only half of item 2's reason for `word` lapses: that its schema requires `graphContext`, so no element of it could pass rule 4.
- **How a schema is read:** the `jsonSchema` section, `$schema` dropped, ajv's default class. It is now read in one place.
- **The Health Audit and the concept pages** already judge the stored JSON. Their other differences from the rule are theirs to settle when they move onto the operations: which concepts they judge, and the audit's choice of a core node's first `z` tag. The node page's verdict on the cached JSON (fact 11) judges a document no schema describes. It should show the derive step's copy, or nothing (Consequences).

**8. The build.** It is one story in graph-operations-first-slice, under a Loom build task once this ADR is merged. It comes before A10.31 and A10.18 judge elements already made. Its pieces are in Implementation notes.

## Consequences

**What this enables**
- One verdict on an element, from every reader, on every instance. `rules check` (A10.31) and A10.18's reports report it once.
- Firmware's 83 element files fit `word`'s schema, and so do the sets create-set makes, whose one problem with it is `graphContext` (ADR 0027). create-set's, update-node's and add-to-concept's reports stop naming `word` for `graphContext`.
- A schema's dialect can move to draft 2020-12 in one place, `_schemas.js` (ADR 0020, Decision 11).

**What this constrains**
- **A concept's schema can't describe what the derive step computes.** That covers `graphContext`, and the `word` fields the derive step fills in. A schema that requires `word.slug` asks whether the letter carries one.
- **The cache's shape has no JSON Schema.** Its contract is the derivers' code and BIBLE §29, checked by `cache check` (A10.36).
- **The derive step depends on the graph module.** That is `_schemas.js`, through it `_fields.js`, and firmware's relationship names. D2 allows it.
- **Some elements lose a cached verdict.** An element tied to a concept only by its `z` tag, with no class-thread edge, loses that concept's verdict from its cache. BIBLE §10 lists "Inferrable HAS_ELEMENT" as an intentional violation. wire-implicit-elements gives such an element its edge, and then both readers judge it.

**New debt and follow-ups**
- **An offloaded node's cached `word` defaults.** Once derived, an offloaded node's entry carries the derive step's `word` defaults, which can't be told from the letter's own (fact 10). D10 drafts §29's offload as applying only to imported nodes. Giving offloaded content an entry apart from the cache is row 137's to decide.
- **The node page's verdict on the cached JSON** (`NodeJson.jsx:282–289`) should show the derive step's copy, or nothing. It is a UI follow-up, not in the build.
- **OPEN.md row 219** should be measured again after the build's reinstall, and its row told which part this answers.
- **Firmware reinstall required?** Yes, by the build: for `word`'s schema, and for rule 7's element file, whose text changes. This ADR changes no firmware.

## Implementation notes

For the build's story. The Architect of that story may refine them.

- **`src/operations/catalog/graph/_schemas.js`:**
  - `storedJson(read, node)` (Decision 3);
  - the `{ concept, json }` form leaves `graphContext` out;
  - the header says what now holds, one document and one verdict, in place of where the two readers split.
- **`src/operations/rules/element-fits-schema.js`:**
  - the `{ node }` form calls `storedJson`;
  - the header follows.
- **`src/lib/derivers/schema-verdicts.js`** (new): Decision 4. It requires `_schemas.js` and `_fields.js` when first called. `derive-all` and Pass 3 share one `judge` for the pass.
- **`src/lib/derivers/word.js` and `set.js`:** their schema queries and ajv blocks go, replaced by the shared call. Their headers say the verdicts are the rule's.
- **`src/operations/catalog/graph/update-node.js`:** leaves `graphContext` out of the JSON it stores (Decision 2).
- **Firmware:**
  - `concepts/word/json-schema.json` as Decision 5 says;
  - `concepts/word/json-schema-backup.json` removed;
  - rule 7's element file regenerated with `node src/firmware/graph-rules.js` once §7's text changes.
- **Docs:**
  - `docs/GRAPH_RULES.md` §7 says what the rule judges, and that the derive step keeps its verdict;
  - BIBLE §10's rule 4 names the stored JSON;
  - BIBLE §21's `graphContext` row says no concept's schema describes it;
  - BIBLE §29 says the cache's verdicts are dated copies of the rule's;
  - the ledger row `2026-11-16-derive-step-and-rule-check-split` closes, pointing here;
  - ADR 0020's Decisions 11 and 17, its Amendment 1 item 1, and ADR 0027's Consequences 1 each get a line pointing here.
- **Tests** (the Tester's, Phase 3):
  - SC9 turns from pinning the splits to pinning one verdict. It runs the real derive step beside the rule, as today, under: firmware's new `word` schema; one that forbids extra top-level keys; JSON with no word block; a word block missing a field the derive step fills in; a cached entry that differs from the json tag (the verdict follows the json tag); an offloaded tag whose entry holds `graphContext`; and a concept only a `z` tag names (judged by neither).
  - A test that every firmware element file fits `word`'s schema (fact 5).
  - A test that update-node stores no `graphContext`.
  - L5a's oracle in `test/pass-3-finishes-in-minutes.test.js` moves to the concepts `F.conceptsOfNodes` finds. L3's and L4's time limits still hold.
- **The live check** runs on a scratch stack (`scripts/scratch-stack.sh`), never the agent-memory instance. After a reinstall and its derive pass:
  - a set made by `graph create-set` has `word` fitting, in its `parentJsonSchemas` and in create-set's own report;
  - the rule's check gives the same verdict for each concept;
  - the relay's event count is unchanged.
- **Branches:** staging only, by the usual chain.

## Out of scope

- **The build itself** (Decision 8). This ADR changes no code and no firmware.
- **The cache going stale,** and what a node owes the LMDB (OPEN.md rows 137 and 139; A10.36).
- **Moving the dialect to draft 2020-12.**
- **Moving the Health Audit and the concept pages onto the rule,** and their other differences from it.
- **A schema for the cache's own shape.**
