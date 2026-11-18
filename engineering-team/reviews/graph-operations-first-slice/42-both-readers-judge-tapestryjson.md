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

## Round 2 — 2026-11-17 (HEAD `4b3632a5`)

**Diff:** `git diff 73239a2f..HEAD`, where `73239a2f` is round 1's review commit. Three commits:
- `d1b18ccd`: the Tester's cases for round 1's findings, and the test plan's record of them;
- `6ead878a`: the fixes;
- `4b3632a5`: the live check's record, the story's new `## Evidence` and two Deviations bullets, and two new ledger rows.

`4b3632a5` touches no file under `src/` or `test/`. No file under `src/` changed between `6ba85124` and `d1b18ccd`.

### Quality gates (round 2, run by reviewer)

- [x] **The touched suites, through the gate engine.** I ran the same 15 suites as round 1, the same way: one at a time first, with the endpoints dead, then through `runGate`. `npm run -s gate:status -- --label a10-20-b-story-42-review-2` reads:
  `20261117T175622Z-56825-2e81 [a10-20-b-story-42-review-2] started 2026-11-17T17:56:22.194Z on 4b3632a5 — PASS, exit 0, 240 passed, 0 failed, 12 skipped, 15/15 suites`
  - element-schemas is 14/0, with SC14 new. Every other suite's count is round 1's.
  - The 12 skips are the same live tests.
- [x] **The full gate (`npm test`) was not run here,** for round 1's reason. The PR's CI runs it, stack-free.
- [x] **The new cases fail without their fixes.** I extracted `d1b18ccd` (round 2's tests over round 1's source) into a scratch directory and ran the suites:
  - element-schemas: 12/2. SC14 got `{"threw":"a transient failure"}`. SC12's case "a set entry with an old artifact" got the cache's `valid: false`, for `x-tapestry`.
  - element-fits-schema: 9/1. EFS8's finding has no `derivedAt`.
  - create-set, create-element and update-node pass, as the plan says: the answer validation in CS3, CE6 and UN7 is a guard.
- [x] `node src/firmware/graph-rules.js --check` finds the files current. `bash scripts/harness-lint.sh` is clean, 0 violations.
- [x] **The live check's records.** I read `tmp/live-check-42/live.js`, and every record beside it, against the Evidence, claim by claim: `report.json`, `pass-3.log`, `pass-3-staging-shape.log`, `graph-rule-firmware.log`, `seed.log`, `up.log` and `gc-examples.js`.
  - **I didn't boot a scratch stack to run it again.** The records settle every claim except those non-blocking 2 and 3 name.
  - **The timeline holds**, in local time:
    - the tests and fixes were committed at 12:32 and 12:33;
    - `up.log` booted `tapestry-scratch` from this worktree's `src/` at 12:35;
    - `report.json` was written at 12:40, and the suites' logs by 12:46;
    - the Evidence was committed at 12:47.

### Round 1's findings

| Round 1 | Disposition |
|---|---|
| Blocking 1: the live check had no record | **Resolved.** The check is real. It covers every item of ADR 0042's and the test plan's live-check lists, and the logs bear out its numbers. One planned item didn't hold, for a reason this story doesn't own; that is round 2's blocking 1. |
| Non-blocking 1: the judge keeps a failed read | Fixed at `_schemas.js:198–209`. SC14 pins it. |
| Non-blocking 2: "Enforced by" said "call" | Fixed at `docs/GRAPH_RULES.md:132`, with the element file regenerated. LC8 finds "will call when they are built" in the graph. |
| Non-blocking 3: test gap | Half fixed. CS3, CE6 and UN7 validate each answer's `concepts` against the declared schema. No create-element or update-node case reaches `waiting: true` yet (round 2's non-blocking 4). |
| Non-blocking 4: set.js judged one document and stored another | Fixed at `set.js:200–209`. SC12's new case pins it. |
| Non-blocking 5: ADR 0020a Decision 5 had no home | Fixed. The check form's findings carry `derivedAt` (`element-fits-schema.js:73–84`), §7's Check says so, and EFS8 and LC5 pin it. The fix brings a new edge (round 2's non-blocking 1). |
| Non-blocking 6: stale pointer | Fixed at `_schemas.js:8–10`, and in the comments on SC5 and `DERIVE`. |
| Non-blocking 7: wrapper errors | Deferred, with its reason in Deviations: no firmware schema needs it. Accepted. |

### The live check, item by item

| Asked for (ADR 0042 `:221–227`; test plan `:70–76`) | Where | Result |
|---|---|---|
| create-set reports `word` as waiting | LC1a | Holds: `waiting: true`, and no problem about `graphContext`. But `fits` is `false`, not `null`: four conditional problems are left |
| derive gives the set `parentJsonSchemas` saying it fits `word` | LC2 | Doesn't hold: `word` is `valid: false`, for the same four problems. For `word`, LC2 checks only that none of them is about `graphContext` |
| the rule's check of the set agrees on each concept | LC3 | Holds: the same four problems, in the same words |
| a node with no entry gives one `missing` finding | LC4c | Holds |
| after a reinstall, rule 7's element carries §7's new words | LC8; GL1–GL4 | Holds |
| the relay's event count is unchanged | LC6 | Holds: 465 before and after |
| L5a passes on the small graph | `pass-3.log` | Holds |
| L3 and L4 meet their limits | `pass-3-staging-shape.log` | Holds: at most 63 ms by key; Pass 3 in 10 s |

The check also goes beyond those lists:
- **LC5** checks AC1 live, with `derivedAt` 1700000000.
- **LC7** is a derive pass over all 444 list items: 1,169 verdicts, on which the cache and the rule agree every time. That is AC3 over real firmware.

### What the live check found: my judgment

**AC4's example on an installed instance.** The diagnosis is right:
- **I traced it.** The manifest's `concept-headers` enumeration sends each concept's key to `word.wordTypes`, with `enforce-wordType-conditionals: true` (`firmware/versions/v1.0.0/manifest.json:405–408`). With that destination, the Reverse `then` that `generateWordTypeConditionals` builds (`src/api/normalize/index.js:6103–6114`) requires `wordTypes` to equal a string `const`, which no array does.
- **It predates this story.** The generator dates from `5fab44fe` (2026-03-29).
- **The set-aside works on the instance.** LC1a's `word` has `waiting: true` and nothing about `graphContext`. Only the conditionals' problems are left.

But the handling isn't complete, and that is round 2's blocking 1. The story's promised outcome doesn't hold on an instance, and its narrowing hasn't been put to the owner.

**LC7c's narrowed premise is legitimate in substance, and disclosed:**
- **What it now leaves out** are the set conditional's errors on the Properties Set nodes, which the word deriver builds with no set fields. Both readers agree on them (LC7b), and they have their own ledger row.
- **What it still catches.** It still fails on any "`graphContext` is required", and on any other `graphContext` error outside the three set fields.
- **Real sets are fine:** L5a shows on its own that they carry their set fields.

The record of it is imprecise, though (non-blocking 2 and 3).

### Findings (round 2)

#### Blocking

1. **The story's promised outcome doesn't hold on an installed instance, and its narrowing hasn't been put to the owner.**
   - **What doesn't hold:**
     - **AC4's last sentence** (`42-both-readers-judge-tapestryjson.md:53`): "So a set made by `graph create-set` reports `word` as waiting, not failing." LC1a gives `fits: false, waiting: true`, with four problems.
     - **AC3's** "which a node fits once its `graphContext` is built" (`:44`). None of the 430 list items with a `word` verdict does, under the installed schema.
     - **The User-facing description** (`:33`): "the elements of `word` stop reading as broken." LC7c: all 430 list items with a `word` verdict fail it.
     - **The plan's "saying it fits `word`"** (LC2, in the table above).
     - **Beyond `word`,** the same tally has these failing too: `graph` 132 of 132, `validation tool` 44 of 44, `core nodes graph` 44 of 44, `relationship` 22 of 22, `concept graph` 3 of 44 and `json schema` 2 of 44 (`report.json`, `agreement.tally`). In all, 679 of the 1,169 verdicts fail, 2 of them on elements of the live check's own concepts. The Evidence mentions only `word`'s, and `rules check` (A10.31) will report each one.
   - **What the story does instead.** The Deviations bullet at `:99` scopes AC4's example to firmware's file, on the Implementer's word.
   - **Why it blocks:**
     - **The epic's practice.** In this epic, an AC sentence that turns out wrong is corrected with the owner's approval, and the correction is recorded in the story. Story 16 did it for AC6's last sentence, as "Corrected at Architecture (the owner's approval, 2026-11-15, …)" (`16-create-concept-and-update-concept.md:92`), and story 20 as "Added at review round 1 (the owner's approval, …)" (`20-create-element.md:91`).
     - **It's a scope call.** Whether story 42 closes with its headline outcome waiting on another fix, or takes that fix in, is the owner's decision.
     - **Done would say something false.** A pass flips the story to Done, and Done would then say the story delivered "the elements of `word` stop reading as broken", which no installed instance will show.
   - **Asked change:**
     - **Put it to the owner.** If the owner has already ruled, recording that ruling is all this needs. Either the story closes with that outcome waiting on ledger rows `2026-11-17-word-wordtypes-conditionals-contradict-themselves` and `2026-11-17-properties-set-nodes-derived-as-words`, each of whose fixes then needs a firmware reinstall, or it takes the conditionals fix in.
     - **Record the decision in the story** as story 16 did, with the owner's approval and its date, covering AC4's last sentence, AC3's parenthesis and the User-facing description, as the owner rules.
     - **In the Evidence:** say plainly that the plan's "saying it fits `word`" didn't hold (LC2), and give the tally of failing verdicts by concept from `report.json`, so A10.31 knows what `rules check` will report.

#### Non-blocking

1. **`src/operations/rules/element-fits-schema.js:76–78`: a `derivedAt` outside the Date range throws.**
   - **Why.** `typeof gc.derivedAt === 'number'` lets NaN, Infinity, or any number of about 8.64e12 or more through, and `new Date(derivedAt * 1000).toISOString()` then throws a RangeError. The date string is built before the concept loop, so it throws for a node that fits, too.
   - **My probe** ran the real rule at HEAD, with a fake read and a scratch LMDB. A node whose stored `derivedAt` is 1e13 makes `violations` throw "RangeError: Invalid time value", whether or not the node fits. One whose `derivedAt` is 1794935902 gives a finding with its `derivedAt`.
   - **Why it matters.** One odd entry ends the whole call, so `rules check` (A10.31) over a graph would stop at it. The derive step writes a valid `derivedAt`. But an entry the offload routes put in holds whatever the letter's `json` tag held, until the node is next derived, and anyone may publish that.
   - **Optional improvement:** give the date only for a finite `derivedAt` within the Date range, and the number alone otherwise. Add an EFS8 case with 1e13.
2. **The record's counts and descriptions are off.**
   - **"43 Properties Set nodes"** (`42-both-readers-judge-tapestryjson.md:130`). The ledger row `2026-11-17-properties-set-nodes-derived-as-words.md:12` also says "43 nodes … each with three such errors, 132 in all", but 43 × 3 is 129. `report.json` gives 44 in two ways: the `properties set` concept has 44 elements, and the 1,140 "then" errors are 1,096 failures of the Reverse conditionals plus 44 failures of the set conditional.
   - **Not all 1,140 "then" errors are the wordType conditionals'**, as `:130` and the conditionals' ledger row (`2026-11-17-word-wordtypes-conditionals-contradict-themselves.md:18`) have it: 44 of them are the set conditional's.
   - **LC7c's new premise** is described as counting "only "`graphContext` is required"" (`:135`). `live.js:189` also fails on any other `graphContext` error outside the three set fields, which is stricter than the record says.
   - **The Evidence's list of records** (`:111`) leaves out `pass-3-staging-shape.log`, which L3's and L4's claims rest on, and `seed.log`, `up.log` and `gc-examples.js`.
   - **Optional improvement:** correct each, in the story and in both ledger rows.
3. **Some records weren't kept.**
   - **The first run's `report.json`** was overwritten by the second's.
   - **An unexplained element.** The second run's tally has a failing verdict for an element of the first run's concept, "live hound 156289" (`report.json`, `agreement.tally`). A create-element refused `missing-input`, as the record says the first run's was, can't have made it. Something the record doesn't name made it.
   - **Unsaved hand calls:**
     - `gc-examples.js`'s output, the basis for "on the Properties Set nodes";
     - the firmware digests, the copy of the branch's firmware, the restart and the second install.
   - **Optional improvement:** say what made the element, keep each run's report under its own name, and save the hand calls (ledger row `2026-11-16-live-check-hand-calls-unsaved`).
4. **The other half of round 1's non-blocking 3.**
   - **The gap.** No create-element or update-node case reaches `waiting: true`. The plan's AC4 row (`42-both-readers-judge-tapestryjson.test-plan.md:24`) still narrows the ADR's "an element created in a set under `word`'s thread" without saying so.
   - **The live check doesn't reach it either:** Rex isn't under `word`'s thread.
   - **Optional**, as in round 1.

#### Harness friction

1. **Round 1's three harness-friction items haven't reached their rows.** `git diff 73239a2f..HEAD -- ledger/` adds only the two new bug rows. The rows to update are:
   - `2026-09-28-live-and-evidence-runs-unrecorded`;
   - `2026-10-07-on-pass-heading-reads-as-verdict`;
   - `2026-11-14-harness-points-tests-at-agent-memory`.
2. **Planning measured a schema fact against firmware's files, not an installed instance.**
   - The story's Background (`:25`) and ADR 0020a's fact 6 measured "each only for `graphContext`" on firmware's element files, against firmware's `word` file.
   - An installed `word` schema has 83 `allOf` entries where the file has one, by the conditionals' ledger row; they come from the enumeration at `manifest.json:405–408`. So the story promised an outcome on an instance that the installed schema can't give, and only the live check found it.
   - A `meta` row should say that a story's claims about what an instance does are measured on an instance: a scratch stack, where the local one is precious.

The optional independent check was not applied in this round either.

### On PASS (round 2, same commit)

- [ ] Not applicable: this round requests changes. The story's `**Status:**` stays `Approved`.

### Verdict (round 2)

**CHANGES_REQUESTED**

Round 1's blocking finding is resolved. The live check is real, covers every item ADR 0042 and the test plan list, and its records bear out its numbers. Of round 1's seven non-blocking findings, five are fixed, one is half fixed and one is knowingly deferred. Each of the three code fixes is pinned by a test that fails without it, and the 15 touched suites pass (240 passed, 12 live skips).

What blocks now is what the live check found. On an installed instance, these don't hold:
- AC4's last sentence;
- AC3's "fits once its graphContext is built";
- the story's headline outcome, that the elements of word stop reading as broken.

The cause is a defect in install that predates this story. The code is right, but the story's record narrows its own acceptance criteria on the Implementer's word. The owner's decision, recorded as story 16's correction was, clears it. Non-blocking 1 is the one I'd fix in the same round, since it is new in this round's code.

## Round 3 — 2026-11-17 (HEAD 7f40c848)

**Diff:** `git diff bc1dcb40..HEAD`, where `bc1dcb40` is round 2's review commit. Four commits:
- `8e2482bc`: the story, with the owner's ruling recorded (the Product Owner's lane);
- `15d541c0`: EFS11, CE34 and UN46, and the test plan's record of them (the Tester's lane);
- `638fee86`: the fix to the check form's `derivedAt` (`element-fits-schema.js:73–82`), and a Deviations bullet;
- `7f40c848`: the Evidence corrected, and the ledger.

Under `src/`, `638fee86` changes only `element-fits-schema.js`. No test file changed after `15d541c0`. `7f40c848` touches no file under `src/` or `test/`.

**The owner's ruling**, as the coordinator reports it: to round 2's question, "Narrow story 42's promise, or widen it to fix install's conditionals?", David answered "Narrow it" (2026-11-17, 20:31 UTC). The Loom tasks for the older defects aren't filed yet: he hasn't picked among the three candidates.

### Quality gates (round 3, run by reviewer)

- [x] **The touched suites, through the gate engine.** I ran the same 15 suites, the same way: one at a time first, with the endpoints dead, then through `runGate`. `npm run -s gate:status -- --label a10-20-b-story-42-review-3` reads:
  `20261117T231911Z-33423-3f23 [a10-20-b-story-42-review-3] started 2026-11-17T23:19:11.358Z on 7f40c848 — PASS, exit 0, 243 passed, 0 failed, 12 skipped, 15/15 suites`
  - **What's new:** element-fits-schema is 11/0 (EFS11 new), create-element 34/0 (CE34) and update-node 42/0 (UN46). Every other count is round 2's.
  - **The Implementer's record** `20261117T204508Z-64465-9fc3` (label `a10-20-b-story-42-round-3`) ran on `638fee86` with 8 files dirty, the 8 that `7f40c848` commits: 243 passed, 0 failed, 12 skipped, 15 suites. That is what the Evidence says.
- [x] **The full gate (`npm test`) was not run here,** for round 1's reason. The PR's CI runs it, stack-free.
- [x] **The new cases fail without what they pin:**
  - **EFS11.** On `15d541c0` (round 3's tests over round 2's source), extracted into a scratch directory: element-fits-schema is 10/1, with "case wordFar failed: {"error":"Invalid time value"}".
  - **CE34 and UN46.** I took `a5204027`'s source, from before this story (`9db5ade4`'s is the same), and overlaid HEAD's two test files. The story changed no test helper. create-element is 32/2 (CE6, CE34) and update-node 40/2 (UN7, UN46). Each of CE34 and UN46 gets `word` at `fits: false`, for "`graphContext` is required", and no `waiting`.
  - **What they pin.** With the set-aside dropped but `waiting` still answered, `word` would be `fits: false, waiting: false`, and both tests would still fail. So they pin the set-aside through each write's answer, not just the field.
- [x] `node src/firmware/graph-rules.js --check` finds the files current. `bash scripts/harness-lint.sh` is clean, 0 violations.
- [x] **My probe of the fixed check form** ran the real rule at HEAD, with a fake read and a scratch LMDB, over stored `derivedAt` values that msgpack can hold even though JSON can't:
  - 1e13 and 1e306 give the finding with the number and no date;
  - NaN, Infinity and the string "1794935902" give the finding with no `derivedAt`;
  - a fitting node with 1e13 gives nothing;
  - none of them throws.
- [x] **The records.** I read `tmp/live-check-42/hand-calls.md` against the Evidence. I spot-checked seven of its outputs against the session transcript the coordinator named: the digests, the copy and second install, run 1, the installed schema's 83 `allOf` entries, run 2, `gc-examples.js`'s count of 43, and run 3. Each appears in a tool result at the "answered at" time the file gives. I didn't boot a scratch stack.

### Round 2's findings

| Round 2 | Disposition |
|---|---|
| Blocking 1: the promised outcome didn't hold on an instance, and its narrowing wasn't put to the owner | **Fixed for what it listed.** The owner ruled, and the story records the ruling the way stories 16 and 20 record theirs: a bold-lead note under Open questions, with the owner and the date, and what each promise first said, the AC text rewritten in place (`:83–88`). The three reworded promises hold against the records (below). The Evidence says LC2's planned item didn't hold (`:141`), and gives the failing tally by concept (`:156–166`). One promise the ruling's rewording missed is round 3's blocking 1. |
| Non-blocking 1: an out-of-range `derivedAt` threw | Fixed at `element-fits-schema.js:73–82`. EFS11 pins it, and my probe agrees. |
| Non-blocking 2: counts and descriptions | Fixed: 44 Properties Set nodes, with run 2's 43 explained; 1,140 "then" errors as 1,096 plus 44; LC7c's premise as `live.js` has it; the full list of records; and both bug rows corrected. |
| Non-blocking 3: records not kept | Fixed as far as possible after the fact. `hand-calls.md` has the hand calls and each run's output, and my spot-check agrees. The record now has three runs, and run 2 made "live hound 156289". The hand-calls row's fix shape gains "give each run's report its own name". One gap in the durable record is left (round 3's non-blocking 3). |
| Non-blocking 4: no `waiting: true` through create-element or update-node | Fixed: CE34 and UN46, which fail on the source from before this story. |
| Harness friction 1: round 1's friction items not in their rows | Fixed: occurrences added to `2026-09-28-live-and-evidence-runs-unrecorded`, `2026-10-07-on-pass-heading-reads-as-verdict` and `2026-11-14-harness-points-tests-at-agent-memory`, and to `2026-11-16-live-check-hand-calls-unsaved`. |
| Harness friction 2: planning measured on firmware's files | Fixed: the new `meta` row `2026-11-17-instance-claims-measured-on-firmware-files`. |

### Each promise, against the records

| Promise | Records | Holds? |
|---|---|---|
| User-facing description (`:33`): the readers never contradict each other; a write stops reporting a node as broken for `graphContext` | LC3; LC7b, 1,169 verdicts agreeing; LC1a, CS3, CE34, UN46 | Yes |
| AC3's first case (`:44`): firmware's file fits a node once its `graphContext` is built; the schema an install leaves fits no element yet | SC9's `word` case (the file); LC7c, none of 430 fitting; the Reverse `then` at `src/api/normalize/index.js:6103–6114` | Yes |
| AC4's last sentence (`:53`): waiting, never failing for `graphContext`; under the file, nothing more; under an install, the conditionals too | LC1a and LC1b (installed: waiting, four conditional problems, none about `graphContext`); CS3 (the file: `fits: null`, waiting, no problems) | Yes |
| The ruling note (`:83–88`) | Evidence; `report.json` | Yes. The Loom tasks are still to be filed (non-blocking 2) |
| **AC1's example** (`:37`): "a node whose tapestryJson has its `graphContext` fits firmware's `word` schema, whatever its `json` tag holds" | EFS8's wordFull (the file: it fits); LC7c (installed: none of 430 fits) | **Not on an instance** |

**Would Done now say anything false?** Yes, AC1's example, on an instance (blocking 1). Nothing else in the story does.
- **ADR 0042 still states two of the narrowed promises** (non-blocking 1). It is a decision record, not the story.
- **The Background's bullet at `:24–27`** describes the instance before this story. The ruling note corrects the promise it led to.

### Findings (round 3)

#### Blocking

1. **AC1's example is the claim the owner's ruling narrowed in AC3, left as it was** (`42-both-readers-judge-tapestryjson.md:37`).
   - **What it says:** "a node whose tapestryJson has its `graphContext` fits firmware's `word` schema, whatever its `json` tag holds."
   - **Where it holds:** under firmware's file. EFS8's wordFull fits it.
   - **Where it doesn't:** under the schema an install leaves, which no element fits. LC7c shows none of 430, and the Reverse conditionals mean none can. That is what AC3's first case now says of the same phrase, "which a node fits once its `graphContext` is built".
   - **Why it blocks.** Done would carry an AC example that no installed instance shows. That is what round 2 blocked on in AC3's parenthesis. Round 2's list of what didn't hold missed AC1's example, and the rewording followed that list. This round checks the rewording as a fresh claim.
   - **Asked change.** Apply the owner's ruling to AC1's example as it was applied to AC3's first case; for example, "fits `word`'s schema as firmware's file has it, whatever its `json` tag holds". Then add AC1 to the ruling note, whose "So three of the story's promises didn't hold on an instance" (`:83`) becomes four. It needs no new decision: the option the owner chose rewords the story's promises so that they hold.

#### Non-blocking

1. **ADR 0042 still states two promises the ruling narrowed.**
   - **Where:** Decision 4's example, "So a set made by create-set reports `word` as `{ fits: null, waiting: true, problems: [], … }`" (`0042-both-readers-judge-tapestryjson.md:122`), and the Consequences line "The writes stop reporting `word` as failing on every set" (`:166`).
   - **The epic's practice.** It ties a correction to its ADR: story 16's was "with ADR 0016", and story 20's "with ADR 0020 Amendment 1". This story added pointer lines under ADRs 0020 and 0027 for the same reason.
   - **Optional improvement:** a pointer line under each, to the story's ruling note. The same pointer could sit beside the Background's bullet (`:24–27`).
2. **The third follow-up has no home yet.**
   - **What's recorded.** The ruling note (`:88`) says the older defects "become Loom tasks of their own", and that `rules check` (A10.31) waits for them.
   - **What's missing.** Two of them have ledger rows. "A diagnosis of the other failing concepts" has none. That is 247 failing verdicts outside `word`: `graph` 132, `validation tool` 44, `core nodes graph` 44, `relationship` 22, `concept graph` 3 and `json schema` 2. And the A10.31 dependency is recorded only in story 42's prose.
   - **Why it doesn't hold the verdict.** The Loom tasks wait on David's pick, a step outside this diff, and a book close would harvest the note.
   - **Optional, best before merge:** a ledger row for the diagnosis, naming the A10.31 dependency, standing for its Loom task as the other two rows do.
3. **The Evidence's account of run 1 leaves out what found the defect** (`:135`, `:170–171`).
   - **What `hand-calls.md` shows:**
     - before the script's fault stopped it, run 1 failed LC1, LC2 and LC3 on their first premises, for install's conditionals: `word` waiting with no problems, the set fitting `word`, and no finding for any concept;
     - LC1 to LC3's premises, and LC7c's, were rewritten before run 2, with LC1 split into LC1a and LC1b.
   - **What the Evidence says instead:**
     - "The first two runs showed a fault in the script and a premise of LC7c set too broadly";
     - "Its LC7c, first written as "no `word` verdict mentions `graphContext`"", which is LC7c's second premise. Its first, "every element of `word` fits `word`'s schema", never ran.
   - **Why it matters.** `hand-calls.md` is ignored by git, so the story's Evidence is the durable record (ledger row `2026-11-16-live-check-hand-calls-unsaved`).
   - **Optional improvement:** say both in the Evidence.

#### Harness friction

1. **Round 2's ask listed the promises to narrow from a reading of the story, and missed one.** AC1's example uses the phrase AC3's first case did, and the rewording followed the list. An ask to narrow a story's promises could quote a search of the story for each narrowed phrase, so the list is complete. Here, "fits firmware's `word` schema" appears at `:37`, and appeared at `:44`. If it recurs, it is a `meta` row.

The optional independent check was not applied in this round either.

### On PASS (round 3, same commit)

- [ ] Not applicable: this round requests changes. The story's `**Status:**` stays `Approved`, and completion detection waits for a passing round.

### Verdict (round 3)

**CHANGES_REQUESTED**

The owner's ruling is recorded the way the epic records an owner's correction, and the three promises it rewords hold against the live check's records. Round 2's four non-blocking findings and both harness-friction items are fixed, each new test fails without what it pins, and the 15 touched suites pass (243 passed, 12 live skips).

One promise the rewording missed blocks. AC1's example says a node with its graphContext fits firmware's word schema, which no installed instance shows. It is the claim the ruling narrowed in AC3, and round 2 should have listed it. Applying the owner's ruling to that one sentence, and counting it in the ruling note, clears it, with no new decision. The three non-blocking findings are optional, though the ledger row for the third follow-up is the one I'd add before merge.

## Round 4 — 2026-11-17 (HEAD 6825f28d)

**Diff:** `git diff 5a0de486..HEAD`, where `5a0de486` is round 3's review commit. Four commits, all docs; no file under `src/`, `test/` or `firmware/` changes:
- **`09216560`, the story (the Product Owner's lane):**
  - AC1's example is narrowed;
  - the ruling note counts four promises, with a bullet for AC1's example;
  - the Background's measurement names its source;
  - the Deviations bullet on AC4's example names AC1's.
- **`0b845147`, pointer lines (the Architect's lane),** at ADR 0042 `:122`, `:166` and `:223`, and at ADR 0020a `:253`.
- **`3478c1eb`, the record and the ledger:**
  - the Evidence's account of run 1;
  - the ruling note names a ledger row for each older defect;
  - a new ledger row holds the 247 undiagnosed verdicts;
  - the two bug rows and the `meta` row are updated;
  - the Deviations and the suites' Evidence record round 4.
- **`6825f28d`:** one phrase. The installed schema's 83 `allOf` entries were read from the graph, not from run 1's report.

**The owner's answer**, as the coordinator reports it. To round 3's "Proceed?", David chose "Fix all four" (2026-11-17). Just before, the coordinator had told him it would apply his "Narrow it" ruling to AC1's example unless he'd rather rule on it himself.

### Quality gates (round 4, run by reviewer)

- [x] **The touched suites, through the gate engine.** The same 15 suites, run the same way. The code hasn't changed since round 3's run. `npm run -s gate:status -- --label a10-20-b-story-42-review-4` reads:
  `20261118T001731Z-38245-6acc [a10-20-b-story-42-review-4] started 2026-11-18T00:17:31.873Z on 6825f28d — PASS, exit 0, 243 passed, 0 failed, 12 skipped, 15/15 suites`
- [x] **The suites that read the changed files, or scan the ledger and the stories,** one at a time with the endpoints dead:
  - `ledger-row-ids` 6/0;
  - `harness-lint` 85/0;
  - `operations/rules/element-fits-schema` 11/0;
  - `session-start` 32/0;
  - `rollup-scanners` 33/0.

  These are the Evidence's numbers (`:127`). `session-start.test.js` only checks that the script exists, and sources two of its libraries. It never runs the script's stack probe, a GET to `:7778`.
- [x] **The full gate (`npm test`) was not run here,** for round 1's reason. The PR's CI runs it, stack-free.
- [x] **The usual checks.** `node src/firmware/graph-rules.js --check` finds the files current. `bash scripts/harness-lint.sh` is clean, 0 violations, with this round's verdict and the story's `Done` in place (L1).

### Round 3's findings

| Round 3 | Disposition |
|---|---|
| Blocking 1: AC1's example left unnarrowed | **Fixed** (`09216560`). AC1's example (`:37`) now tells firmware's file and the installed schema apart, as AC3's first case does. The ruling note counts four promises and has AC1's bullet (`:83`, `:86`), with the owner's go-ahead. |
| Non-blocking 1: ADR 0042's two lines | **Fixed** (`0b845147`). The search found two more, ADR 0042 `:223` and ADR 0020a `:253`, and each pointer holds against LC1a or LC2. The Background's bullet (`:25`) gains the note on the installed schema (`09216560`). |
| Non-blocking 2: the third follow-up had no home | **Fixed** (`3478c1eb`). The new row `2026-11-17-six-concepts-failing-verdicts-undiagnosed` carries A10.31's wait. The two bug rows say `rules check` waits for their fixes. The ruling note names all three rows (`:89`). |
| Non-blocking 3: the Evidence's account of run 1 | **Fixed** (`3478c1eb`, `6825f28d`). The Evidence now gives run 1's LC1 to LC3 failing on their first premises, no check after LC4a running, and LC7c's three premises in order. The summary (`:142`) follows, and the 83 entries are read from the graph. |
| Harness friction 1: an ask to narrow should quote a search | **Fixed.** The `meta` row gains the occurrence and the fix shape. Round 4's own pointers came from such a search. |

### The new text, against the records

| Sentence | Records | Holds? |
|---|---|---|
| AC1's example (`:37`): under firmware's file it fits; as an install leaves the schema, no element fits yet | EFS8's wordFull (the file); LC7c, none of 430 (installed) | Yes |
| The ruling note: four promises (`:83`), and AC1's bullet with the owner's go-ahead (`:86`) | The story as it stands; the go-ahead as the coordinator reports it | Yes |
| The Background (`:25`): measured on firmware's files; an installed instance's elements also fail the conditionals | LC7c | Yes |
| The ruling note's last bullet (`:89`): a ledger row stands for each older defect | The three rows exist | Yes |
| Run 1's account (`:177–180`) and the summary (`:142`) | `hand-calls.md`: run 1's output, the read from the graph after it, and the edit before run 2 | Yes. "Rewritten to what the story guarantees" holds as the story now stands. The rewrite (17:39 UTC) came before the owner's ruling (20:31 UTC), the order the Deviations bullet at `:107` gives |
| ADR 0042 `:122` and `:166`: under an install, `fits: false, waiting: true`, failing for the conditionals | LC1a | Yes |
| ADR 0042 `:223` and ADR 0020a `:253`: the live check's "fits `word`" holds under firmware's file only | LC2 | Yes |
| The new ledger row's numbers | `report.json`, `agreement.tally`: 247 = 132 + 44 + 44 + 22 + 3 + 2; 679 = 430 + 247 + 2, of 1,169 | Yes. Its one lead is marked unchecked |
| The bug rows' and the `meta` row's added sentences | The ruling; this review's round 3 | Yes |
| The suites' Evidence (`:127`) | My runs, above | Yes |

### Is anything still promising what an instance doesn't do?

No.

**The search.** I looked for each narrowed phrase: "fits word", "fits firmware's `word` schema", "which a node fits", "fits it once", "stop reporting `word`", "stop reading as broken", "waiting, not failing", "saying it fits", "`{ fits: null`" and "valid under it". The files:
- story 42 and its test plan;
- ADRs 0042, 0020a, 0020 and 0027;
- `docs/GRAPH_RULES.md`, BIBLE and rule 7's element file;
- the ledger rows this story added or closed.

**Every hit is narrowed or holds:**
- **Narrowed:** the story's ACs and ruling note, ADR 0042's three pointers and ADR 0020a's at `:253`.
- **Describing the instance before this story:** the story's Background (`:27`) and ADR 0020a's fact 7 (`:52`).
- **Scoped to firmware's file:**
  - ADR 0020a `:161`, its Decision 6, whose subject is firmware's file, as round 3 judged it;
  - the test plan's AC3 row (`:23`), which describes SC9's fixture, the file.
- **True on an instance:** §7's Check (`docs/GRAPH_RULES.md:130`) and its element file, that tapestryJson without its `graphContext` doesn't fit `word`'s schema; and the conditionals row's title.

The epic's line for this story (`epics/graph-operations-first-slice.md:62–65`) says the writes stop reporting `word` as failing "for `graphContext`", which holds.

### Findings (round 4)

#### Blocking

None.

#### Non-blocking

1. **`ledger/2026-11-17-six-concepts-failing-verdicts-undiagnosed.md:12`** says the two verdicts the live check made on purpose are "each run's Rex". The check had three runs, and run 1 made no Rex. The count, two, is right. "Runs 2 and 3's Rex", as the story's Evidence has it, would be exact. Optional.

#### Harness friction

None new.

The optional independent check was not applied.

### On PASS (round 4, same commit)

- [x] **The story's Status flipped to `Done`** in place: line 3 only, nothing else in the story changed.
- [x] **Completion detection performed,** and the result given in the chat: the book isn't complete.

### Verdict (round 4)

**PASS**

Every finding from round 3 is fixed:
- AC1's example now says what holds under firmware's file and under the schema an install leaves, as the owner's ruling has the other promises say.
- The ADRs point to the ruling wherever they state a narrowed promise.
- The undiagnosed verdicts have a ledger row, with A10.31's wait.
- The Evidence tells run 1 as the records show it.

A search of the story, its plan, its ADRs, the rulebook, BIBLE and the ledger rows finds nothing still promising what an instance doesn't do. The code is unchanged since round 3. The 15 touched suites pass (243 passed, 12 live skips), and so do the five that read the changed docs.

The story is mergeable as it stands. The full gate runs in the pull request's CI. Rule 7's reinstall on staging and production waits on its ledger row.

## Round 5 — 2026-11-17 (HEAD eacc6f0c)

**Diff:** `git show eacc6f0c`, on top of round 4's review commit `14e0c0e2`. It changes one line, `ledger/2026-11-17-six-concepts-failing-verdicts-undiagnosed.md:12`, and touches no other file. **The owner's answer**, as the coordinator reports it: at round 4's gate, David chose "Fix the nit" (2026-11-17).

### What I checked

- **The sentence.** It now reads: "two that the live check made on purpose: runs 2 and 3 each made a Rex, and put its entry without a description. Run 1 made none." It holds against the records:
  - **Run 1 made no Rex.** In `hand-calls.md`, run 1's LC4a failed with create-element refused (`"ce":400,"concepts":[]`). The story's Evidence (`:179`) says its concept has no elements.
  - **Runs 2 and 3 each made one.** Each passed LC4a, Rex made, and LC5, its entry put without the section's description (`live.js:170`). Run 3's `report.json` gives LC5's problem as "`liveHound218062.description` is required".
  - **The count.** `report.json`'s tally has one failing verdict in each of the two hound concepts, "live hound 156289" and "live hound 218062". That is the two the row counts.
- **The checks.** `bash scripts/harness-lint.sh` is clean, 0 violations. `test/ledger-row-ids.test.js` is 6/0, with the endpoints dead. No gate-engine run: nothing under `src/` or `test/` changed.

### Round 4's finding

| Round 4 | Disposition |
|---|---|
| Non-blocking 1: "each run's Rex" | **Fixed** (`eacc6f0c`), in the words above. |

No new findings.

### On PASS (round 5)

- [x] **The story stays `Done`,** flipped at round 4. This commit touches no story.
- [x] **Completion detection is unchanged from round 4,** and was given in the chat: the book isn't complete.

### Verdict (round 5)

**PASS**

The one line now matches the records: two Rex verdicts, from runs 2 and 3, and none from run 1. The commit changes nothing else, lint is clean, and the ledger-id suite passes.
