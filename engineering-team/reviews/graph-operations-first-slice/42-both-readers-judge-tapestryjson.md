# Review: Story 42 — Both readers judge a node's tapestryJson

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-17
**Diff:** `git diff origin/staging...HEAD`, merge base `a5204027`, HEAD `6ba85124`. Three commits:
- `05711902`: the failing tests;
- `9db5ade4`: GB3's fixture in `test/graph-rules-builder.test.js`;
- `6ba85124`: the implementation and docs.

Staging has since moved to `8436a01a` by two docs-only commits (#130, delete-node's evidence). They touch no file this diff touches.

**Inputs:**
- the story, `engineering-team/stories/graph-operations-first-slice/42-both-readers-judge-tapestryjson.md`;
- ADR `0042-both-readers-judge-tapestryjson.md`, and the decision it builds, ADR `0020a-the-document-a-schema-describes.md`;
- the test plan, `42-both-readers-judge-tapestryjson.test-plan.md`.

## Quality gates (run by reviewer, not trusted)

- [x] **The touched suites, through the gate engine.** I ran the 15 suites the story touches, with the stack's endpoints dead (`env -u TAPESTRY_CONTAINER TAPESTRY_PORT=9 BRAINSTORM_BASE_URL=http://127.0.0.1:9`), first one at a time, then through `test/helpers/gateRunner`'s `runGate`. `npm run -s gate:status -- --label a10-20-b-story-42-review` reads:
  `20261117T170855Z-77871-5a99 [a10-20-b-story-42-review] started 2026-11-17T17:08:55.350Z on 6ba85124 — PASS, exit 0, 239 passed, 0 failed, 12 skipped, 15/15 suites`
  - **The 15 suites:**
    - the story's own: `operations/graph/element-schemas` (13/0), `operations/rules/element-fits-schema` (10/0), `operations/graph/create-set` (35/0), `create-element` (33/0), `update-node` (41/0), `graph-rules-builder` (26/0), `graph-rule-firmware` (13/0, 4 skipped), `pass-3-finishes-in-minutes` (8/0, 8 skipped);
    - the neighbours: `update-node-shared` (13/0), `delete-node` (40/0), `tapestry-key-put-await` (3/0), and the four `*-agent-through-cli` suites for create-set, update-node, elements and delete-node (1/0 each).
  - **The 12 skips are all live tests,** which run only against a named scratch container: GL1–GL4, and L1, L2, L2b, L3, L4, L5a, L5b and L5c.
  - **The Implementer's own record** (`tmp/gate-runs/20261117T165844Z-73843-1a76.json`, label `a10-20-b-story-42-impl`) has the same totals.
- [x] **The full gate (`npm test`) was not run here.** On this Mac it writes to the agent-memory instance. The pull request's CI runs it: `.github/workflows/test.yml:24–41`, job `stack-free`, `npm ci` then `npm test` on ubuntu. That job has no container, so it skips the same live tests.
- [x] **The tests fail without the code.** I extracted `9db5ade4` (every test change, and the old source) with `git archive` into a scratch directory, linked `node_modules`, and ran the suites stack-free:
  - element-schemas: 7 passed, 6 failed (SC7, SC10, SC11, SC9, SC12, SC13);
  - element-fits-schema: 3 passed, 7 failed (EFS1, EFS3, EFS6–EFS10);
  - create-set 34/1 (CS3), create-element 32/1 (CE6), update-node 40/1 (UN7);
  - graph-rules-builder 25/1 (GB3).

  Each fails for the reason the test plan's Verification gives. For example, SC9 got `["/beagle must have required property 'description'"]` beside `` ["`beagle.description` is required"] ``. `6ba85124` changes no file under `test/`.
- [x] `node src/firmware/graph-rules.js --check`: "the 7 items in firmware/active/concepts/graph-rule/elements are current."
- [x] `bash scripts/harness-lint.sh`: clean, 0 violations.
- [ ] `npm run test:playwright`: not applicable, no UI change.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._
- [ ] **The live check** in the ADR's Implementation notes and the test plan's "How to run" has no record of having run. That is blocking 1.

## Spec adherence

- [x] **AC1, the rule judges tapestryJson:**
  - EFS8: diffFits and diffMisses, whose json tags and tapestryJson differ, and, under firmware `word`'s schema, wordFull and wordNoContext;
  - EFS3: broken's list is one finding, and its unparseable tag isn't read;
  - SC10: `tapestryJsonOf`.

  The code is `element-fits-schema.js:59–79`.
- [x] **AC2, a node with no tapestryJson:** EFS9 and SC10.
  - EFS9's node has a json tag that fits beagle. So a fallback to the tag would give no finding, and the test asserts exactly one, marked `missing`, naming no concept.
- [x] **AC3, one verdict:**
  - SC9's ten cases, which match the story's four and add create-concept's and firmware dog's schemas, a schema that doesn't compile, and a `z`-only concept;
  - SC12: the entry shape, two schema nodes, none, the set deriver, and the stored document still fitting `word`;
  - SC13: one E1 read per pass.

  All of them run with `neo4j-driver` and `tapestry-store` stubbed (`element-schemas.test.js:387–393`). The real database and store under the derive step are left to the live check (blocking 1).
- [x] **AC4, a write doesn't fail a node for `graphContext`:**
  - SC11: waitOnly, waitAndMore, heldContext, strict and ordinary;
  - EFS10: no finding for the full block, and one, for `word.slug` alone, for the block without a slug;
  - CS3: create-set reports `word` as `fits: null, waiting: true`;
  - CE6 and UN7: `waiting` is passed through and declared.

  No create-element or update-node case reaches `waiting: true` (non-blocking 3).
- [ ] **AC5, the rulebook and rule 7's element:**
  - EFS6: Says, exceptions, `missing`, waiting, Source, and ADR 0020a Accepted;
  - EFS7 and `--check`: the element file;
  - EFS1: the summary;
  - GB3.

  But "rule 7's element in the graph after a firmware reinstall" is reachable only live, and that hasn't run (blocking 1). Staging's and production's reinstalls after merge are ledger row `2026-11-17-rule-seven-rewrite-awaits-firmware-reinstall`.
- [x] **No behaviour beyond the story.** The diff touches what ADR 0042's Implementation notes list, and no more.

**GB3's fixture change (`9db5ade4`) is a legitimate fixture update, not a weakened test:**
- the assertions (`test/graph-rules-builder.test.js:158–176`) are as they were, exact equality on each field;
- only rule 7's expected `description` and `source` changed (`:134–141`), to AC5's and ADR 0042 Decision 7's text, which EFS6 pins on its own against the rulebook;
- it is in a commit of its own, in the Tester's lane, before the implementation;
- the test plan (`:29`) and the story's Deviations record it;
- it fails on the old rulebook (25/1 at `9db5ade4`) and passes on the new one.

## ADR adherence

- [x] **Each decision is built as written:**
  - Decision 1 is `_schemas.js:110–118`;
  - Decision 2 is E4 at `element-fits-schema.js:30–32`, and `:67–72`;
  - Decision 3 is `aboutGraphContext`, `check(…, { writing })` and `fits`, at `_schemas.js:178–235`;
  - Decision 4 is the three output schemas, and the named concept's entry from `Sch.fits` (`create-element.js:177–178`, `create-set.js:247–248`);
  - Decision 5 is `src/lib/derivers/schema-verdicts.js`;
  - Decision 6 is `tapestry-derive.js:110, 121, 168–175`;
  - Decision 7 is the rulebook §7, the summary, the regenerated element, and 0020a Accepted.
- [x] **Every departure from the ADR is in the story's Deviations,** six items: `schemaOf`'s `name` and `nodes`, `tapestryJsonOf` synchronous, `uuid` left out, the judge built inline, GB3, and the firmware ledger row.
- [x] **Layering.** The derive step requires the graph module lazily, as D2 allows. SC13 holds that loading `schema-verdicts.js` loads nothing heavy, and SC7 holds the same for `_schemas.js`.
- [x] **No new dependencies.** ajv was already used.
- [x] **The docs** the Implementation notes list are done: the pointers in ADR 0020 (Decisions 11 and 17, Amendment 1 item 1) and ADR 0027 (Consequences 1); BIBLE §10 rule 4, §21's `graphContext` row, §29, and the "Last updated" line; and the split's ledger row closed.
- [ ] **One of ADR 0020a's decisions has no home** (non-blocking 5).

## Concept-graph integrity

- [x] **Handles.** None is added or changed. Firmware's `word` schema is unchanged (ADR 0020a, Decision 6).
- [x] **Firmware reinstall called out.** Rule 7's element file is regenerated. The reinstall on staging and production after merge is ledger row `2026-11-17-rule-seven-rewrite-awaits-firmware-reinstall`, and the agent-memory instance takes it only at David's word. The live check's own reinstall on a scratch stack is part of blocking 1.
- [x] **Orientation via `/summaries`:** no new code orients on the concept graph.

## Architecture invariants

- [x] **Principle 4, local-first.**
  - The rule's check form only reads.
  - The derive step builds `base` as it did before, from the existing entry when that has a `word` block. Only `parentJsonSchemas` is computed differently.
  - No new delete or overwrite reaches authored state, and the json tags are still written (ADR 0020a, Decision 9).
  - The known hazard, a `json` tag with no `word` block dropped for `{}`, offloaded content included, is A10.20.c's. This diff doesn't touch it.
- [x] **Principles 1 to 3.**
  - A verdict is this instance's, decided by the rule when it is asked. The cached copy is dated, and nothing acts on it (ADR 0020a, Decision 7).
  - Nothing gates publication. A write is refused for less than before, never for more.
- [x] **The TA pubkey** appears as no literal. A scan of the added lines finds no 64-hex key.

## Things tests can't catch

- [x] **No secrets in committed files.**
- [x] **No leftover debug logging.** No `console.log` is added.
- [x] **No commented-out code.**
- [ ] **Error paths.** A pass-wide judge keeps a failed schema read for the rest of the pass (non-blocking 1).
- [x] **Concurrency.**
  - One judge is shared across a pass, and `validate.errors` is read right after `validate(json)`, with no `await` between, so interleaved checks can't mix their errors.
  - The rule's tapestry-store read sits outside the write's transaction, which ADR 0042's Consequences accepts.
- [x] **Security.** No new input boundary.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence *(when the story traces to a PRD)*

- [ ] Not applicable. The story traces to Loom A10.20.b, not a PRD.

## Findings

### Blocking

1. **The live check that ADR 0042, the test plan and the story each call for has no record.**
   - **Where it is asked for:**
     - ADR 0042's Implementation notes (`0042-both-readers-judge-tapestryjson.md:221–227`);
     - the test plan's "How to run" (`42-both-readers-judge-tapestryjson.test-plan.md:70–76`) and the Live row of its coverage map (`:27`);
     - the story's Open questions (`42-both-readers-judge-tapestryjson.md:81`): "AC1 to AC4's live checks run on a scratch stack".
   - **What exists:**
     - the story has no Evidence section;
     - the worktree has no `tmp/live-check-*`;
     - the commits claim only the 15 stack-free suites.
   - **Why it matters:**
     - **The plan names what only the live check reaches** (`:15`): Neo4j itself, the real LMDB under the derive step, a firmware reinstall, rule 7's element in the graph, and Pass 3's timing. CI's job is stack-free (`.github/workflows/test.yml:24–41`), so nothing reaches them before merge.
     - **The derive step's schema logic is replaced.** It runs for every node in every firmware install's Pass 3, and on each derive by key. Each node's query moves from a walk bounded at ten links, with a join on `z` tags (staging's `word.js:104–107`), to `conceptsOfNodes`' unbounded `*0..` walk (`_fields.js:393`), plus E1 reads for its concepts: once a pass in derive-all, and once a node in a derive by key. L3's 200 ms and L4's 10-minute limits (`test/pass-3-finishes-in-minutes.test.js:45–46`) exist to guard this path, and they skip here.
     - **SC9 and SC13 stub the database and the store.** The database answers by parameter shape, and the store keeps the derived object by reference (`element-schemas.test.js:387–393`, `:410`). So a query or a store round trip that real Neo4j or LMDB treats differently still passes them.
     - **AC5's "rule 7's element in the graph after a firmware reinstall"** can only be seen live.
     - **This epic's siblings** #21 and #26 recorded their live checks under Evidence before review, and their reviews leaned on those records for what the fake can't reach.
   - **Asked change.** Run the plan's live check on a scratch stack (`scripts/scratch-stack.sh`, through `test/helpers/scratchLoopback.js`), never the agent-memory instance:
     - `graph create-set` reports `word` as waiting;
     - `POST /api/tapestry-key/derive/:key` then gives the set `parentJsonSchemas` saying it fits `word`, and the rule's `{ node }` check agrees on each concept;
     - a node with no entry gives one `missing` finding;
     - after a firmware reinstall, rule 7's item in the graph carries §7's new words. The scratch stack mounts only `src/`, so copy the firmware in and restart first (ledger row `2026-11-17-scratch-firmware-copy-needs-restart`);
     - L5a passes on the small graph;
     - L3 passes, and L4 with `PASS3_INSTALL=1`, on staging's shape (`test/helpers/seedStagingShape.js`). If either can't be run, say why;
     - the relay's event count is unchanged.

     Record it in the story's Evidence, as #21 and #26 did, and save every call made by hand (ledger row `2026-11-16-live-check-hand-calls-unsaved`). If the owner decides instead that it runs after merge, on staging, record that decision in Deviations, with a ledger row saying when and where it runs.

### Non-blocking

1. **`src/operations/catalog/graph/_schemas.js:194–208`, with `src/lib/tapestry-derive.js:170`: a pass-wide judge keeps a rejected read.**
   - **What happens.** `of(concept)` memoizes the promise of E1 and the compile. A promise that rejects stays in the memo for the whole pass.
   - **My probe:** one judge, and a read that fails on its first E1 and would succeed after. Three checks of one concept all threw the first error, and only one E1 read was made.
   - **Before this diff,** each node ran its own schema query, so a failed read failed one node.
   - **Why it matters.** Nothing is destroyed: `store.put` isn't reached, so the old entries stay, and a second pass heals it. But one transient error on `word`'s concept fails every node of the label that `word` reaches, for the rest of the pass.
   - **Optional improvement:** drop the memo entry when its promise rejects, such as `p.catch(() => memo.delete(concept))`, with a test that the next node reads again.
2. **`docs/GRAPH_RULES.md:132`, and its copy at `firmware/versions/v1.0.0/concepts/graph-rule/elements/element-fits-schema.json:21`: "Enforced by" now says something false.**
   - **What it says:** `graph add-to-concept` and the property operations "call" `_schemas.js` "too".
   - **Why it's false:** neither exists. `src/operations/catalog/graph/` has no `add-to-concept.js`, and A10.22 and A10.18 are still to come. On staging the sentence said they "will call" it.
   - **Why it matters:** the pending reinstall installs this text into every instance's graph.
   - **Optional improvement, best made in this round:** "which `graph create-set`, `graph update-node` and the derive step (`src/lib/derivers/schema-verdicts.js`) call too, and `graph add-to-concept` (A10.22) and the property operations (A10.18) will". Then regenerate the element file.
3. **A test gap against ADR 0042's Implementation notes (`0042-both-readers-judge-tapestryjson.md:216`).**
   - **What the notes ask for:** "an element created in a set under `word`'s thread" reports `word` as waiting, and "each answer validates against its declared output schema".
   - **What the tests do:**
     - CE6 and UN7 assert only `waiting: false`. In create-element's fake graph, firmware's `word` has no schema node (`test/helpers/createElementGraph.js:32`), so no create-element or update-node case reaches `waiting: true`.
     - No answer is validated whole against its declared schema. The tests check that the schema declares a required boolean `waiting`, and that the entries carry it.
     - The plan's AC4 row narrows this without saying so.
   - **Why the risk is small:** the waiting logic lives in `Sch.fits` (SC11), CS3 shows it end to end for create-set, and CE6 and UN7 show the field is passed through.
   - **Optional improvement:** a create-element case in a set under a thread with `word`'s schema, and one ajv validation of an answer for each write. Or record the narrowing in the plan.
4. **`src/lib/derivers/set.js:200–209`: the set deriver judges one document and stores another.**
   - **What happens.** "Remove old artifacts" deletes `x-tapestry.derived` after `schemaVerdicts` has judged `base`.
   - **When it splits:** for a set whose old entry carries that artifact, under a schema that closes the top level or constrains `x-tapestry`. The cache's errors then name a problem the rule's check of the stored entry doesn't find, so AC3's "on the problems" splits until the next derive.
   - **Why it is rare:** nothing in `src/` writes `x-tapestry.derived` any more, so only old entries carry it.
   - **Optional improvement:** move the block above line 200, so the document judged is the document stored.
5. **ADR 0020a, Decision 5 (`0020a-the-document-a-schema-describes.md:157`), has no home.**
   - **What it says:** "An entry built before a change is judged as it is. The finding says when it was built (`graphContext.derivedAt`)."
   - **What happened to it.** ADR 0042 doesn't carry it, and the rule's findings (`src/operations/rules/element-fits-schema.js:76–77`) don't say when the entry was built.
   - **Why it matters.** The Implementer followed ADR 0042, which the owner approved, so this isn't an implementation defect. But the 0020a decision now has no home.
   - **Optional improvement:** record where it lands, A10.31 or an amendment to 0042, for example as a ledger row.
6. **`src/operations/catalog/graph/_schemas.js:8`: a stale pointer.**
   - **What it says:** the header still says the module "reads a schema as the derive step does (src/lib/derivers/word.js:136–180)".
   - **Why it's stale:** this diff removed that block. `word.js` is 127 lines now, and reads its schemas through this module.
   - **The same pointer** is at `test/operations/graph/element-schemas.test.js:29` and `:74`. SC5's frozen copy of the old reading is still a valid pin of the dialect.
   - **Optional improvement:** name the dialect itself, or the commit that held that reading.
7. **`src/operations/catalog/graph/_schemas.js:178–182`: wrapper errors aren't recognised as being about `graphContext`.**
   - **What happens.** `aboutGraphContext` follows Decision 3's definition exactly, and that definition doesn't recognise ajv's wrapper errors.
   - **My probe:** a schema with `if … then: { required: ['graphContext'] }`, and a write's JSON with no `graphContext`. The check gives `fits: false`, with only "the element's JSON must match "then" schema". So the named concept's write would be refused for nothing but `graphContext`.
   - **Why firmware is safe:** firmware `word`'s conditional constrains `graphContext` only when it is present, and my probe gives `waiting` for a set under it. No other firmware schema names `graphContext`.
   - **Optional improvement:** also set aside an `if`, `anyOf` or `oneOf` wrapper error when every error under it is about `graphContext`, or note the limit in §7.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. **Another occurrence for `ledger/2026-09-28-live-and-evidence-runs-unrecorded`** (meta, OPEN). Phase 4 requires no record of an environment-dependent run before Review, and CI is stack-free. So a planned live check can go unrun while every gate reads green (blocking 1). Add this occurrence to that row.
2. **Another occurrence for `ledger/2026-10-07-on-pass-heading-reads-as-verdict`** (OPEN.md row 28). The template's "On PASS (same commit)" heading after its Verdict would have made this review parse as passed under `scripts/lib/review-verdict.awk`. This review puts that section above the Verdict, as review 27's round 1 did.
3. **`engineering-team/workflows/4-implementation.md:29`** still says to run `curl -X POST http://localhost:$TAPESTRY_PORT/api/firmware/install` after a concept definition changes. On the Mac Studio, that endpoint is the agent-memory instance. The same line says to record a pending reinstall "in OPEN.md", whose table is closed: new rows are `ledger/` files. This story's Implementer rightly wrote a ledger row instead. Add the line as a concrete site to `ledger/2026-11-14-harness-points-tests-at-agent-memory` (meta, OPEN).

The optional independent check (workflow 5, "Optional: an independent check before the commit") was not applied.

## On PASS (same commit)

- [ ] Not applicable: this review requests changes. The story's `**Status:**` stays `Approved`.
- [ ] Completion detection: not run, since the story hasn't passed.

## Verdict

**CHANGES_REQUESTED**

The code does what ADR 0042 decides, and the reviewer-run touched suites are green (239 passed, 12 live skips). Each of AC1 to AC5 has a stack-free test that fails without the code, and GB3's change is a legitimate fixture update. One thing blocks: the live check this story's ADR, plan and Open questions require has no record. Without it, nothing has run the rewritten derive step against a real Neo4j and LMDB, Pass 3's time limits are unchecked, and AC5's rule 7 in the graph is unseen. CI can't fill the gap, since its job is stack-free. A recorded live check, or the owner's recorded decision to run it on staging after merge, clears it. The seven non-blocking findings are optional, though number 2 is cheapest to fix in this round, before the reinstall installs the text.
