# ADR 0042: Both readers judge a node's tapestryJson — the rule reads the tapestry-store, the derive step asks `_schemas.js`, and a write waits on `graphContext`

**Status:** Accepted
**Date:** 2026-11-17
**Story:** `engineering-team/stories/graph-operations-first-slice/42-both-readers-judge-tapestryjson.md`

## Context

ADR 0020a decided that a concept's JSON Schema describes a node's tapestryJson: the JSON the Tapestry LMDB holds for it. Story 42 builds the readers' half of that:
- the rule's check reads tapestryJson (AC1), and a node with none gets one finding (AC2);
- the derive step's cached verdicts and the rule's check agree, concept by concept (AC3);
- the three writes that report verdicts stop failing a node for `graphContext`, which only the derive step builds (AC4);
- the rulebook says what the rule judges (AC5).

The writes leaving their node's tapestryJson up to date is Loom A10.20.c.

What the code offers today, on staging at `341fe1f2`:

1. **`_schemas.js`** (`src/operations/catalog/graph/_schemas.js`):
   - `schemaOf(read, concept)` runs E1: the header's `name` and `uuid`, its schema node's tapestryKey and its json tag. It returns `{ schema, node, label, header }`, or `{ problem, label, header }` when there is no schema node, more than one, or one that can't be read.
   - `judge(read)` memoizes each concept's compiled schema. Its `check(concept, json)` gives `{ header, label, fits, problems, problem }`, where `fits` is null when there is no schema to check against.
   - `problemOf(err)` turns one of ajv's errors into `{ path, message }`.
   - `fits(read, concept, json)` and `checkElements(read, items, { every })` sit on top.
   - It requires nothing heavy at load: SC7 pins that requiring it loads nothing.
2. **The rule** (`src/operations/rules/element-fits-schema.js`) takes two kinds of item.
   - `{ concept, json }`: a write's JSON. Each write passes one through `checkElements`.
   - `{ node }` or `{ node, concept }`: an element as it stands. It runs `F.conceptsOfNodes` for the concepts, then E4 for the node's `name`, `uuid` and json tag, resolved by `F.readJson`. JSON that can't be read gives one `invalid-fields` finding. No code outside tests uses this form yet; `rules check` (A10.31) and A10.18 will.
3. **The writes that report verdicts.** Each answers `concepts`, one entry for each concept the node belongs to: `{ concept, key, fits, problems, problem }`.
   - `graph create-element` (`create-element.js:158`, `:175–178`) and `graph create-set` (`create-set.js:228`, `:245–248`) hand-build the named concept's entry as fitting, since `checkElements` would have refused otherwise, and take the others from `Sch.fits`.
   - `graph update-node` takes each entry from `Sch.fits` (`update-node.js:259–260`), and refuses through `checkElements(…, { every: true })` (`:292`).
   - Their declared output schemas give `fits` as a boolean or null, null meaning "no schema to check against":
     - `X.CONCEPTS` in `_elements.js:548–562`, which update-node uses;
     - create-element's own copy, at `:51–64`;
     - create-set's own copy, at `:134–147`.
4. **The derive step.** `src/lib/derivers/word.js` and `set.js` each run their own schema query (`word.js:100–117`, `set.js:170–187`): `ConceptHeader`s whose class thread reaches the node within ten links, plus those its `z` tags name. Each also compiles its own ajv for each schema of each node (`word.js:162–164`, `set.js:241–243`). Each judges its `base` once `graphContext` is built, with `parentJsonSchemas` still empty, then writes each entry as `{ uuid, tapestryKey, conceptName, conceptTapestryKey, lastValidated, valid, errors }`:
   - `uuid` and `tapestryKey` name the schema node;
   - `errors` are ajv's `"<path> <message>"`;
   - a schema that doesn't compile gives `valid: false`;
   - a concept with no schema node gets no entry.
5. **The derive engine** (`src/lib/tapestry-derive.js`).
   - `deriveNode(node)` calls `deriver.fn(node)`, puts the result into the store under the node's tapestryKey (`:122`), and stamps `tapestryJsonUpdatedAt` on the node.
   - `deriveByKey(key)` derives one node. `deriveAll(label)` loops over a label's nodes; Pass 3 and `POST /api/tapestry-key/derive-all/:label` call it.
   - It reads through `runCypher` (`src/lib/neo4j-driver.js`), whose rows are plain objects with numbers, as the operations' `tx.read` rows are.
6. **The tapestry-store** (`src/lib/tapestry-store.js`). `get(key)` returns the envelope `{ updatedAt, rebuiltFrom?, data }`, or undefined, and the LMDB opens on first use (`getDb`). No operations module reads it yet. Only `F.readJson` reaches it, through `tapestry-resolve`, for an `lmdb:` json tag.
7. **How firmware's `word` schema constrains the cache's verdicts.** Each `parentJsonSchemas` item must have a string `tapestryKey` and a string `conceptName`. `uuid` and `conceptTapestryKey` are strings, `lastValidated` a number or null, `valid` a boolean or null, and `errors` strings. So an entry with no schema node's tapestryKey would make the node's own tapestryJson fail `word`.
8. **Tests that touch this:**
   - SC1–SC9 in `test/operations/graph/element-schemas.test.js`, of which SC8 runs E1–E4 on the fake graph and SC9 runs the real `deriveWord` with `neo4j-driver`, `tapestry-store` and `tapestry-resolve` stubbed in `require.cache`;
   - the create-element, create-set and update-node suites;
   - `test/graph-rule-firmware.test.js`, which fails while rule 7's element file differs from what `node src/firmware/graph-rules.js` makes;
   - L5a in `test/pass-3-finishes-in-minutes.test.js`, whose live oracle `ORACLE_SCHEMAS` (`:345–354`) restates the derive step's concept set.

Concepts touched, by handle (`<TA>` is the instance's assistant): `39998:<TA>:word`, whose one schema node is `39999:<TA>:word-schema` (read; unchanged); `39998:<TA>:graph-rule` (rule 7's element, regenerated); and any concept whose elements are judged (read).

## Options considered

### Option A — `_schemas.js` reads tapestryJson and sets `graphContext` aside for writes; the derivers ask it for their verdicts

One module keeps one reading of a schema and one wording of a problem. The rule's check form reads the node's entry from the tapestry-store. A write's check sets aside problems that are only about `graphContext`. The derive step's verdicts come from a small shared function that calls `F.conceptsOfNodes` and `_schemas.judge`.

- **Pros:**
  - one check, so AC3's agreement follows from how it is built, not from two copies kept alike;
  - each schema compiles once per pass instead of once per node;
  - the dialect moves in one place (ADR 0020, Decision 11).
- **Cons:**
  - the derive step now requires the graph module (D2 allows it);
  - E1 and E4 change, so the fake graph learns both again.

### Option B — The rule's check reads the derive step's cached verdicts

`rules check` and A10.18 take each node's `parentJsonSchemas` as the verdict. One verdict by construction, since there is one reader.

- **Cons:**
  - ADR 0020a, Decision 7 says the rule decides when asked and nobody acts on the cached copy, which goes stale when a schema changes;
  - the derive step keeps its own concept set and its own ajv, so the writes and the cache still split.

### Option C — The rule's check derives the node first, then judges

The check calls `deriveByKey`, so it always judges a freshly built tapestryJson.

- **Cons:**
  - a check would write the store, and a node property outside the write path;
  - whether `rules check` builds first is A10.31's to decide (ADR 0020a, Decision 5);
  - a whole-graph check would cost a full derive pass.

## Decision

We chose **Option A**. It is the one that makes AC3 true by construction, and it keeps the rule the one judge (ADR 0020a, Decision 7).

**1. `_schemas.js` reads a node's tapestryJson.** A new `tapestryJsonOf(node)` → `{ json }` or `{ problem, missing }`:
- it requires `src/lib/tapestry-store.js` when first called, so the module still loads nothing at require (SC7);
- it reads `store.get(node)`, and takes the envelope's `data`;
- no entry, or `data` null: `{ problem: 'it has no tapestryJson yet; the derive step builds it (cache rebuild, or a firmware reinstall's derive pass)', missing: true }`;
- `data` that isn't an object: `{ problem: "its tapestryJson isn't an object" }`.

**2. The rule's check form judges it** (AC1 and AC2). For `{ node }` and `{ node, concept }`:
- the concepts come first, as today. A node no concept reaches still gives no finding;
- then E4 reads only the node's `name` and `uuid`, for messages. Its json tag is no longer read:

  ```cypher
  MATCH (e:TapestryNode {tapestryKey: $key}) WHERE NOT e:GraphChange RETURN e.name AS name, e.uuid AS uuid
  ```

- then `tapestryJsonOf`. A problem there gives one `invalid-fields` finding for the node, saying why, with `missing: true` when there is no entry. That makes one finding, with no finding for each concept and no fallback to the json tag (AC2). `rules check` can tell "not built yet" from "doesn't fit" by `missing`;
- else the tapestryJson is judged as it is, against each concept's schema, as today's form judges the json tag. Nothing is set aside: an entry without its `graphContext` fails `word`, as ADR 0020a, Decision 2 says a reader reports an incomplete one.

**3. A write's check sets aside what only the derive step builds** (AC4).
- `problemOf(err)` marks a problem `derived: true` when ajv's error is about `graphContext`:
  - a `required` error at the top whose `missingProperty` is `graphContext`;
  - or any error whose `instancePath` is `/graphContext` or under it.
- `judge(read).check(concept, json, { writing: true })` sets those problems aside when `json` has no top-level `graphContext`.
- `fits(read, concept, json)` and the rule's `{ concept, json }` form pass `writing: true`, since both judge a write's JSON. The `{ node }` form doesn't.
- A check that set something aside answers `waiting: true`:
  - **nothing else wrong:** `fits` is null, `problems` empty, and `problem` is "`<label>` waits for the derive step, which builds the node's `graphContext`";
  - **other problems too:** `fits` is false, `problems` holds only those, and `problem` is null.
- Every check answers `waiting`, false when nothing was set aside.
- The rule's `{ concept, json }` form makes a finding only when `fits` is false. So a write is refused only for problems that aren't about `graphContext`, and its refusal lists only those.

**4. A write's report says "waiting"** (AC4). Each entry of `concepts` gains `waiting`, a boolean, in each declared output schema: `X.CONCEPTS`, create-element's and create-set's. They are required, as the other fields are.
- `fits`'s description widens: "null when there is no schema to check against, or when the JSON misses only what the derive step builds (`waiting`)".
- create-element and create-set take the named concept's entry from `Sch.fits` too, in place of a hand-built `fits: true`. So it says `waiting` when that is what it is. Nothing else in their order changes.

So a set made by create-set reports `word` as `{ fits: null, waiting: true, problems: [], problem: "… waits for the derive step …" }`.

**5. The derive step's verdicts come from `_schemas.js`** (AC3), through a new `src/lib/derivers/schema-verdicts.js`:

```js
// sketch
async function schemaVerdicts({ tapestryKey, json, judge, now }) → parentJsonSchemas
```

- **Its read** is made from `runCypher`: `(cypher, params) => runCypher(cypher, params)`.
- **Its concepts** are `F.conceptsOfNodes(read, [tapestryKey])`: each concept whose class thread reaches the node, a `ConceptHeader` or a `ListHeader`, at any depth, sorted by tapestryKey. No header a `z` tag names is added.
- **Its document** is the `json` passed in, the derive step's `base`, once its `word` defaults and `graphContext` are built. It is judged with `judge.check(concept, json)`, with nothing set aside: the derive step judges the whole tapestryJson.
- **Its entries,** one for each concept that has a JSON schema node, in today's shape:
  - `uuid` and `tapestryKey` name the schema node. E1 also returns `js.uuid AS schemaUuid`, and `schemaOf` returns `{ schema, node, nodeUuid, … }`;
  - `conceptName` is the header's name, and `conceptTapestryKey` the concept;
  - `lastValidated` is `now`, the deriver's `derivedAt`;
  - `valid` is the check's `fits`;
  - `errors` are its problems' messages, or its one `problem`. A schema that can't be read or doesn't compile gives `valid: null`, as the rule's `no-schema` does, where today it gives `valid: false`;
  - a concept with more than one schema node gets one entry for each, each with `valid: null` and the rule's problem. `schemaOf` returns the nodes it found with that problem;
  - a concept with no schema node gets no entry, as today, since the list is of schemas. The rule's `no-schema` finding for it has no counterpart in the cache.
- **Why filling the entries changes no verdict.** Every entry has string `tapestryKey` and `conceptName`, and fields of the types `word`'s schema gives (fact 7). So the stored document, with its entries filled in, gets the verdicts the derive step gave it with them empty. A test pins that.
- **In `word.js` and `set.js`,** the schema query and the ajv block go. Each calls `schemaVerdicts` after building `graphContext`, and sets `base.graphContext.parentJsonSchemas` to what it returns.

**6. One judge per pass.**
- `deriveNode(node, ctx)` passes `ctx` to the deriver, as `deriver.fn(node, ctx)`.
- `schemaVerdicts` uses `ctx.judge` when there is one, else a new `_schemas.judge(read)` for that node.
- `deriveAll(label)` makes one judge for its loop. Each schema is then read and compiled once a pass, instead of once a node. A schema changed during a pass is seen by the next pass.
- `deriveByKey` stays as it is: one node, one judge.

**7. The rulebook and rule 7's element** (AC5).
- `docs/GRAPH_RULES.md` §7 is rewritten:
  - **Says:** a node's fully realized tapestryJson fits the schema of each concept it is an element of, and exceptions will come;
  - **Refuses or reports:** a write's JSON is judged with problems only about `graphContext` set aside, and that concept is reported as waiting;
  - **Check:** it reads the node's tapestryJson, and a node with none gives one finding, marked `missing`;
  - **Source:** ADR 0020, ADR 0020a, ADR 0042.
- The rule's `summary` says the same in a line.
- `node src/firmware/graph-rules.js` regenerates `firmware/versions/v1.0.0/concepts/graph-rule/elements/element-fits-schema.json`.
- ADR 0020a's status becomes Accepted (merged by its decider, TapestryProtocol/tapestry#125).

## Consequences

**What this enables**
- `rules check` (A10.31) and A10.18's reports read one verdict on tapestryJson, and can tell a node not yet built (`missing`) from one that doesn't fit.
- A node's cached verdicts are the rule's verdicts, as of its `derivedAt`.
- The writes stop reporting `word` as failing on every set, and on every element in a set under its class thread.
- A derive pass compiles each schema once.

**What this constrains**
- **The rule's check form now depends on the tapestry-store.** It reads outside the write's transaction. A node derived after its last change is judged as it was then. That is the stale entry ADR 0020a, Decision 2 allows, and A10.20.c's to narrow.
- **On a stack where most nodes have no entry, `rules check` reports most nodes as missing,** until a reinstall's derive pass or `cache rebuild` (A10.36) builds them. On the local instance today, that is 80 list items and 9 of each concept's core nodes.
- **The derive step's concept set changes.** It drops `z`-only concepts, and picks up `ListHeader` concepts and deeper sets. A node's `parentJsonSchemas` may list other concepts after its next derive.
- **The cache's `errors` change words,** from ajv's to the rule's, and a schema that doesn't compile now reads `valid: null`, not `false`. No code reads them (ADR 0020a, fact 12).
- **The writes' answers gain a required field,** `waiting`, in three output schemas. A client that reads only `fits` sees null where it saw false for a `graphContext`-only miss.

**New debt and follow-ups**
- **A10.20.c:** the writes leave their node's tapestryJson up to date. A write's refusal then judges the tapestryJson its node will have, and `waiting` can give way to the derive step's verdict.
- **Three copies of a `concepts` entry's schema.** create-element's and create-set's copies of `X.CONCEPTS` each gain the field; folding them into one is left for a story that touches all three.
- **`rules check` (A10.31) decides** whether a `missing` node is a finding, a separate count, or a place for an exception.
- **Firmware reinstall required?** Yes, for rule 7's element (AC5). `word`'s schema doesn't change.

## Implementation notes

- **`src/operations/catalog/graph/_schemas.js`:**
  - `tapestryJsonOf` (Decision 1);
  - E1 gains `js.uuid AS schemaUuid`, and `schemaOf` returns `nodeUuid`, and with its "more than one" problem, `nodes: [{ tapestryKey, uuid }]`;
  - `problemOf` marks `derived`;
  - `check(concept, json, { writing })` sets aside and answers `waiting` (Decision 3);
  - `fits` passes `writing: true`;
  - the header says what holds now.
- **`src/operations/rules/element-fits-schema.js`:**
  - E4 as Decision 2 writes it;
  - the `{ node }` form reads `tapestryJsonOf`;
  - the `{ concept, json }` form passes `writing: true`;
  - the summary and header follow.
- **`src/operations/catalog/graph/_elements.js`** (`X.CONCEPTS`), **`create-element.js`** and **`create-set.js`:**
  - each output schema's entry gains `waiting`, and `fits`'s description widens;
  - create-element and create-set take the named concept's entry from `Sch.fits` (Decision 4);
  - update-node's entries already come from `Sch.fits`, so it changes only through `X.CONCEPTS`.
- **`src/lib/derivers/schema-verdicts.js`** (new): Decision 5. It requires `_schemas.js` and `_fields.js` when first called.
- **`src/lib/derivers/word.js` and `set.js`:** their schema queries (`word.js:100–117`, `set.js:170–187`) and ajv blocks (`word.js:135–179`, `set.js:214–258`) go, replaced by `schemaVerdicts(…)`. Their headers say the verdicts are the rule's. Each takes `(node, ctx)`.
- **`src/lib/tapestry-derive.js`:**
  - `deriveNode(node, ctx = {})` passes `ctx` to the deriver;
  - `deriveAll` makes one `_schemas.judge` from a `runCypher` read for its loop, and passes `{ judge }`.
- **Docs:**
  - `docs/GRAPH_RULES.md` §7 as Decision 7 says;
  - rule 7's element file regenerated;
  - ADR 0020a's status set to Accepted;
  - a pointer line under ADR 0020's Decisions 11 and 17 and its Amendment 1, item 1, and under ADR 0027's Consequences 1;
  - BIBLE §10's rule 4 names tapestryJson, §21's `graphContext` row says `word`'s schema governs it, and §29 says tapestryJson is the document a schema describes, with BIBLE's "Last updated" line;
  - the ledger row `2026-11-16-derive-step-and-rule-check-split` closes, pointing here.
- **Tests** (the Tester's, Phase 3; only the Tester changes `test/`):
  - **SC9** turns from pinning the splits to pinning one verdict. It runs the real `deriveWord`, then the rule's `{ node }` check on what it stored, with a store stub that keeps what is put. They agree under each of the story's AC3 cases. Concepts come from the stub's class-thread rows, so a `z`-only concept is judged by neither.
  - **`schemaVerdicts`:** the entry's shape; `valid: null` for a schema that doesn't compile and for a concept with more than one schema node; no entry for a concept with none; the rule's words in `errors`; and that filling the entries changes no verdict under `word`'s schema.
  - **The rule's `{ node }` form** judges tapestryJson where it and the json tag differ (AC1). It gives one `missing` finding for a node with no entry (AC2), and fails `word` for an entry without its `graphContext`.
  - **The writes** (AC4): create-set's set and an element created in a set under `word`'s thread report `word` as waiting. A concept whose schema the JSON misses for `graphContext` and something else is refused, or reported, for the other thing only. Each answer validates against its declared output schema.
  - **SC7** still holds: requiring `_schemas.js` loads nothing heavy. A new check holds the same for `schema-verdicts.js`.
  - **SC8:** the fake graph runs E1 and E4 as Decisions 2 and 5 write them.
  - **`test/graph-rule-firmware.test.js`** passes on the regenerated element file.
  - **L5a's oracle** moves to `F.conceptsOfNodes`' class-thread walk. L3's and L4's time limits still hold.
- **The live check** runs on a scratch stack (`scripts/scratch-stack.sh`), never the agent-memory instance:
  - `graph create-set` reports `word` as waiting;
  - `POST /api/tapestry-key/derive/:key` then gives `parentJsonSchemas` saying the set fits `word`;
  - the rule's check of the set agrees for each concept;
  - a node with no entry gives one `missing` finding;
  - after a firmware reinstall, rule 7's element in the graph carries §7's new words;
  - the relay's event count is unchanged.
- **Branches:** staging only, by the usual chain.

## Out of scope

- **Everything in A10.20.c:** the writes building tapestryJson after they commit, the one-section rebuild, a json tag with no `word` block keeping its sections, and a write's refusal judging the tapestryJson its node will have.
- **Building tapestryJson for nodes that have none.**
- **`rules check` and A10.18 themselves.**
- **The exceptions to the rule.**
- **Moving the Health Audit and the concept pages onto tapestryJson.**
- **Folding the three `concepts` schemas into one.**
