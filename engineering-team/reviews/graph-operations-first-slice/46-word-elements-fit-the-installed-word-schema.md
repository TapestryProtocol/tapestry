# Review: Story 46 — An element of `word` fits the `word` schema an install leaves

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-20
**Diff:** `git diff 79c8a098..HEAD`. `79c8a098` is origin/staging. Branch `fix/word-wordtypes-conditionals` adds five commits: `3dce3f00` (intake entry), `dd86293e` (story), `f288493e` (failing tests), `b9db0e84` (the fix) and `65f14d3d` (evidence, at HEAD). 10 files, +682 −4.
**Inputs:**
- The story `engineering-team/stories/graph-operations-first-slice/46-word-elements-fit-the-installed-word-schema.md`: AC1–AC5, the owner's ruling, Out of scope, Deviations and Evidence.
- Its test plan, beside it.
- The live check's record `tmp/live-check-46/`: `live.js`, `live.log`, `report.json` and `manifest-switch-on.json`, which git ignores.
- Ledger rows `2026-11-17-word-wordtypes-conditionals-contradict-themselves` and `2026-11-20-word-wordtypes-switch-awaits-firmware-reinstall`.
- Loom P-156, read with `loom proposals show P-156`.

**Type:** bug. There is no ADR. The owner skipped Architecture as obvious when approving the story (story `:112`), and the decision is the owner's ruling (story `:35-37`).
**Independent check** (workflow 5, optional): not applied.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, scoped.** I didn't run the full gate: on this Mac the `tapestry` container is the agent-memory instance.
  - **The six suites I chose:**
    - this story's suite;
    - `schema-save-finds-the-right-header`, which drives the enumeration step and Pass 2 through the same child;
    - `graph-rule-firmware` and `firmware-element-sync`, which read the manifest;
    - `ledger-row-ids` and `harness-lint`, which cover the two ledger rows, the intake entry and the epic.
  - **The run:** through the gate engine on Node 24.18.0. Every endpoint was at port 9, with `TAPESTRY_CONTAINER=no-such-container` and stub `curl` and `docker` first on `PATH`. `npm run gate:status -- --label review-46` reads:
  `20261120T221408Z-43799-9630 [review-46] started 2026-11-20T22:14:08.248Z on 65f14d3d — PASS, exit 0, 160 passed, 0 failed, 6 skipped, 6/6 suites` (record `tmp/gate-runs/20261120T221408Z-43799-9630.json`)
  - **Per suite:** this story's 9/0/0, schema-save 26/0/2, graph-rule-firmware 13/0/4, firmware-element-sync 21/0/0, ledger-row-ids 6/0/0, harness-lint 85/0/0. Every skip is a live check that needs a scratch container: schema-save's L1 and L2, and graph-rule-firmware's GL1–GL4.
  - **Left out:** `stack-free-npm-test`. Its G2 runs live suites when a control panel answers, which the brief rules out. I checked its G5 property, the registry's completeness, by hand. There are 351 suite files on disk, each registered or excluded, with no duplicates, and the new suite is registered (`test/registry.js:419`).
- [x] **On Node 22.23.1, CI's major:** this story's suite and schema-save, with the same dead endpoints: `20261120T222559Z-88677-7170 [review-46-node22] started 2026-11-20T22:25:59.522Z on 65f14d3d — PASS, exit 0, 35 passed, 0 failed, 2 skipped, 2/2 suites`.
- [x] **The Implementer's gate, against its record.** `tmp/gate-runs/20261120T212447Z-63609-283c.json` matches the story's Evidence (`:93-94`) exactly. It is PASS, 54/0/6 over the four suites the Evidence names, on `f288493e` with 5 dirty paths, the five files `b9db0e84` commits.
- [x] **The tests fail without the fix, and on the switch alone.** I exported two trees into the scratchpad with `git archive`, leaving the worktree untouched. I ran each through the gate engine with the same dead endpoints. Their records are in those trees, not in the worktree:

  | Tree | gate:status | Failing |
  |---|---|---|
  | `f288493e`: the tests, no fix | `20261120T221625Z-84421-045b` FAIL, 4 passed, 5 failed | W1, W2a, W2b, W4, W5a |
  | HEAD with only `manifest.json:408` set back to `true` | `20261120T221624Z-84386-0526` FAIL, 5 passed, 4 failed | W1, W2a, W2b, W4 |

  The first row is the test plan's Verification (`:62-84`), with the same failure messages word for word. The second shows the four behaviour tests turn on the switch alone, and the sentinels pass either way.
- [x] **`bash scripts/harness-lint.sh`,** run before this file existed: `harness-lint: clean (0 violations)`, exit 0. Run again with this file in place, the story still `Approved`: `harness-lint: clean (0 violations)`. `scripts/lib/review-verdict.awk` reads this file as CR.
- [ ] **The live check:** not re-run, since the brief makes it optional. I checked its record instead (below).
- [ ] `npm run test:playwright`: not applicable, since no UI file changed.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

| AC | Verdict | Evidence |
|---|---|---|
| AC1: an element of `word` fits | met | W1, all three cases. It holds on david.tapestry.ninja's real schema too (below), and in the live check's LA4 and LA5. |
| AC2: waiting, then fitting | met | W2a runs `Sch.fits` on the builders' JSON, as both writes call it (`create-element.js:157`, `:183`; `create-set.js:227`, `:247`). W2b runs the derive step's own `schemaVerdicts`. The live check covers LA3 (create-element), LA4 and LA5. Live covers create-element only; create-set is covered stack-free. |
| AC3: the rest stays | met | W3a, W3b and W3c, sentinels that pass before and after. Live: LA1 (41 allowed keys and the set conditional) and LA2 (dog's 4). |
| AC4: a reinstall mends | met | W4 runs Pass 2, then the enumeration step, over a fixture shown to hold the fault. It covers both a relationship type and a set made before. Live: LA1 and LA4. |
| AC5: what describes it says what it does | met | W5a (the row is closed). W5b (the switch the Firmware Explorer shows matches what the step writes). BIBLE §6 is checked as prose, below. |

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] **No behaviour beyond the story.** The code change is one manifest value (`firmware/versions/v1.0.0/manifest.json:408`).
  - With the switch off, `apply-enumerations` also stops adding `word` to the schema's `required`, and stops adding a `word` stub (`src/api/normalize/index.js:6255-6275`). Firmware's `word` file already has both, so for `word` nothing else changes.
  - The `graph.graphType` and `dog.breed` entries (`:418`, `:448`) are untouched.

### Checked against david.tapestry.ninja's real schema

I read `word`'s installed schema from the public read API (`/api/concept-graph/node/39999:<TA>:word-schema`). I judged nodes against it with the shared check, `problemsOf` (`src/operations/catalog/graph/_schemas.js`), stack-free.
- **The Background's counts hold.** The schema has 95 `allOf` entries: 94 tie `wordTypes` to itself, for 47 keys, and one is the set conditional. Its allowed list has 47 keys. Apart from those, it is firmware's file.
- **The Background's verdicts hold.** I judged `["word","relationshipType"]` and a set (`["word","set"]`), each with a `graphContext` built. Each gets 4 problems under the live schema, and each fits firmware's file.
- **The fix's outcome holds with 47 keys.** With the tying entries removed, both fit. `["word","notAConcept"]` still fails on `word.wordTypes.1`, and a set without its set fields still fails on all three.
- **The owner's ruling holds.** I rewrote each Reverse with "contains" (its `then` the same as its `if`). Each node then gets the same verdict as with the pair removed.
- **The other enumerated schemas there:** `graph` has 8 tying entries (4 types), `dog` has 4, and `property` and `relationship` have none. So BIBLE's "for `dog.breed` and `graph.graphType` … it also writes" holds on an instance.

### The Deviations, checked
- **The switch alone, with no guard in code.** Holds.
  - `generateWordTypeConditionals` runs only when the switch is on (`src/api/normalize/index.js:6254`, `:6278`), and nothing else calls it. The story states the known limit.
  - If the active manifest turned the switch back on, W1, W2a, W2b and W4 would fail (the table above).
- **A reinstall, not the enumeration step alone.** Holds.
  - The step strips old `Forward:`/`Reverse:` entries only inside `if (enforceConditionals)` (`:6280-6286`).
  - Pass 2 sends firmware's `jsonSchema` (`src/firmware/install.js:1031-1035`), and save-schema replaces the whole section (`src/api/normalize/index.js:2056`). That happens before Pass 3's enumeration step (`install.js:1282`).
  - The story (`:87`), the closed row's Done line and the new row all say a reinstall is what clears an instance. The test plan's untested edge case (`:33`) asks the Reviewer to check that.
- **BIBLE §6.** Holds; see below.
- **The Firmware Explorer needed no change.** Holds.
  - The page reads the live manifest from `GET /api/firmware/manifest` (`src/api/firmware/index.js:27`, `:66`), not a copy in the built bundle.
  - When the switch is off it shows "❌ No — enum values only" (`ui/src/pages/settings/FirmwareExplorer.jsx:754`). The paragraph about biconditionals shows only when the switch is on (`:766-772`).

### BIBLE §6 (AC5), as prose
- **Placement.** `BIBLE.md:262` sits under §6 (`BIBLE.md:219`), in "Relationship Types".
- **Accuracy.** Each sentence the diff adds holds against the code and an installed instance:
  - `word.wordTypes` gets the concept headers' keys and nothing more;
  - `dog.breed` and `graph.graphType`, whose entries turn the switch on, also get the pairs;
  - the manifest leaves the pair off for `word.wordTypes`.

  One wording point is Non-blocking 4.
- **The rest of BIBLE.** `BIBLE.md:1554` ("Firmware v1.0.0 with biconditional ENUMERATES schema conditionals") is a dated milestone, and still true for `dog` and `graph`.

### The live check's record
`tmp/live-check-46/` bears out the story's Evidence (`:98-109`):
- **What ran.** `report.json`'s `worktreeHead` is `f288493e`, taken at 21:28:45 UTC. `b9db0e84` was committed at 21:28:53, before the "after" manifest was copied in at 21:30:06. `src/` is the same in both commits, and the stack mounted this worktree's `src/`.
- **The two manifests.**
  - `manifest-switch-on.json` is byte-identical to `79c8a098`'s manifest, which is still origin/staging's.
  - The "after" copy came from the working tree. `b9db0e84`'s only manifest change is line 408, which the step log shows as `false`.
- **The numbers:**
  - the installs took 65.8 s and 57.4 s, with 0 Pass 2 errors each time and 4 enumerations applied;
  - LB1: 83 entries, 82 tying, 41 keys;
  - LA1: 1 entry, 0 tying, 41 allowed;
  - dog: 4 entries before and 4 after;
  - LA3: `fits: null`, `waiting: true`, no problems;
  - LA4 and LA5: `valid: true`, no errors;
  - LA6: no finding on either node, for any concept;
  - 9 of 9 checks passed.
- **One wording slip**, Non-blocking 1: "82 self-comparing pairs".
- **LA6 has no "before" twin.** Story 42's LC7b showed the rule and the cache agree on every verdict, so LA4 and LA5 carry it.

### The story's other claims, checked
- **The origin (`:31`).** `46996baf` (2026-03-28) hand-wrote dog's pairs. `5fab44fe` (2026-03-29) made them general. It set the switch `true` for `word.wordTypes`, `graph.graphType` and `dog.breed`, and `false` for the other two.
- **Story 42's figures (`:25`, `:70`).** 83 entries, 430 list items and 1,096 errors. The 247 verdicts outside `word` are 132+44+44+22+3+2 (story 42 `:158-164`; its review `:311`).
- **The owner's run (`:22-24`).** The run's record is in `tmp/validation-vocabulary/answers/` in the main checkout. It holds one create-set, three create-elements of relationship types and one add-to-concept. Each answered `word` with `fits: false`, `waiting: true` and the four problems.
- **P-156.** It is open. It lists the three fix shapes in the ledger row's order, and the A10.31 dependency.
- **The intake entry.** Its code claims hold:
  - the builders' `wordTypes` (`_elements.js:383`, `_sets.js:498`);
  - what add-to-concept and remove-from-concept do to `wordTypes`;
  - the derive step's rewrite (`src/lib/derivers/set.js:98-105`);
  - validation tool's schema is the only one that requires a concept's key outside the pairs.
- **The epic entry.** 46 is the next number free, taken the way story 44 took its own (`epics/graph-operations-first-slice.md:89-92`).
- **The new row.** Type `cleanup` is in the template's list. The node path it gives resolves on david.tapestry.ninja. The rule-nine row it names exists and is OPEN.

## ADR adherence

There is no ADR, so I checked against the owner's ruling (story `:35-37`). The pair goes for `word.wordTypes` only, by one of the two ways the ruling allows: the switch. The allowed list, the set conditional, and dog's and graph's pairs all stay.
- [x] **Files changed match the ruling:** one manifest value, the BIBLE sentence AC5 asks for, the two ledger rows, the suite and its registry line.
- [x] **Layering untouched:** no source file changed.
- [x] **No new dependencies.**

## Concept-graph integrity
- [x] **Handles.** None is added or changed in code. The records write `<TA>` (`39998:<TA>:word`, `39999:<TA>:word-schema`). The suite signs with a synthetic key (`test/word-elements-fit-the-installed-word-schema.test.js:82-84`), and the live check reads the assistant's key at runtime (`L.taPubkey()`).
- [x] **Firmware reinstall called out.** The manifest changes what install writes into `word`'s schema. The new row holds the reinstall on each instance, each on the owner's yes (story Out of scope `:74`). Non-blocking 3 asks for one precondition to be spelled out.
- [x] **Orientation:** not applicable, since there is no new code.
- [x] **Principle 4.** The reinstall's Pass 2 replaces only firmware's own schema section, from firmware's file, as every reinstall does. Nothing locally authored is touched.

## Things tests can't catch
- [x] **No secrets.** The only key in the diff is the suite's synthetic `'46'.repeat(32)`.
- [x] **No leftover debug logging.** The suite's `console.log`s are its reporter.
- [x] **No commented-out code,** and `git diff --check` is clean.
- [ ] **Test isolation: not met** (Blocking 1). The new suite changes the whole gate's environment when it loads.
- [x] **Concurrency:** nothing added.
- [x] **Security:** no boundary changed.

## House rules check
- [x] **Concept Graph API authority:** no new reads.
- [x] **No new lint, typecheck or build tooling.**

## Product-guide adherence
Not applicable: the story traces to no PRD.

## Findings

### Blocking

1. **`test/word-elements-fit-the-installed-word-schema.test.js:54`: when the suite loads, it rewrites the environment for every suite in the gate run.**
   - **What it does.** `Object.assign(process.env, DEAD)` runs at load, and nothing undoes it. It sets:
     - `NEO4J_URI`, `BRAINSTORM_BASE_URL`, `TAPESTRY_API_BASE`, `TAPESTRY_PORT` and `MEILI_URL_HOST` to port 9;
     - `TAPESTRY_CONTAINER` to `no-such-container`;
     - `BRAINSTORM_CONF_PATH` to a temp conf, which lasts until the process exits (`:50-53`).
   - **Why it reaches every suite.**
     - The engine loads every suite into one process before it runs any (`test/helpers/gateRunner.js:10`, `:157-166`), and `npm test` hands it the whole registry (`test/test.js:19`). So suites registered before this one see the change too.
     - I showed this in a gate run with dead values of my own: port 8, and the container `review-46-canary`. An entry listed *first* read port 9 and `no-such-container` at run time (`20261120T222242Z-87439-52e3`).
   - **What breaks: G2.** On any machine where a control panel answers, a full `npm test` fails at `stack-free-npm-test`'s G2.
     - G2 takes its base URL when it loads (`test/stack-free-npm-test.test.js:43`). That is before this suite loads, so its probe finds the panel.
     - It then runs `tag-detail` in a child process with the current environment (`:87-91`, `:147`).
     - That child reads port 9 (`test/tag-detail.test.js:16`) and skips the whole suite (`:449-451`). G2's assertion that `pass + fail >= 1` then fails (`:149-151`).
     - A replica of G2's child spawn showed the split. With the new suite in the run, the probe got `:8` and the child `:9` (`20261120T222452Z-88266-abc8`). Without it, both got `:8` (`20261120T222451Z-88215-9121`). I didn't run G2 itself, which the brief rules out.
   - **What breaks: live coverage.** Two helpers read the container when called: `test/helpers/stackHttp.js:19`, used by 14 suite files, which defaults to `tapestry`, and `test/helpers/scratchLoopback.js:17`, used by 6. Both now get `no-such-container`. So a full run with a stack, or with `TAPESTRY_CONTAINER=tapestry-scratch…`, loses their live checks.
   - **Why CI can't show it.** CI's gate is stack-free (`.github/workflows/test.yml:25-42`). With no panel, G2 and the live checks skip either way, so the run would pass there.
   - **No precedent.**
     - The model this suite names gives its dead endpoints to its child only (`test/schema-save-finds-the-right-header.test.js:219`, `:224`).
     - Every other suite that sets these variables puts them back: `test/config-secret-logging.test.js:97`, `:106`; `test/neo4j-query-public-reads.test.js:205`, `:212`; and `test/setup-status.test.js:539-545`.
   - **Asked change.** Kick back to the Tester, since a test is wrong (`engineering-team/roles/implementer.md:11`).
     - Leave the gate's environment as the suite found it. Give the dead values to the child only.
     - If the parent still needs them for its in-process requires, set them inside `run()` and restore them in a `finally`, as `setup-status`'s `withEnv` does. All the parent's reads already go through the fake graph (`:56-61`, `:173-176`).
     - Reword test plan `:48` ("The parent and the child get…") to match.
     - A check would pin it: an entry listed before the suite reads the same values after the suite has run.

### Non-blocking

1. **Story `:101` says "82 self-comparing pairs for 41 keys".** By the story's own definition, a pair for each key (`:13-14`), that is 82 conditionals, or 41 pairs. `report.json`'s LB1 counts entries: 83 in `allOf`, 82 of them tying.
   - Test plan `:84` makes the same slip: "the 20 pairs … for the fixture's ten keys". W4's message counts 20 conditionals ("20 do").
   - The commit message of `65f14d3d` repeats the slip; no change asked there.
   - Optional fix: "82 self-comparing conditionals (41 pairs)" and "the 20 conditionals (10 pairs)".
2. **Test plan `:36` overstates story 42's finding.** It says the live check "found nothing `word` reported about the `graphContext` the derive step built, apart from the pairs (its LC2 and LC7c)". LC7c also found 132 set-field errors on the 44 Properties Set nodes (story 42 `:158-160`; P-157). Those are outside this story's scope, but the sentence says nothing else was found. Optional fix: add "and the Properties Set nodes' set fields (P-157, out of scope)".
3. **`ledger/2026-11-20-word-wordtypes-switch-awaits-firmware-reinstall.md:11` leaves one precondition unsaid.**
   - The manifest is read from the build an instance runs, and cached until a restart (`src/api/normalize/firmware.js:31-37`).
   - So a reinstall on an instance not yet running a build with this commit writes the pairs again.
   - The row implies the order for staging and production, but not for "david.tapestry.ninja and the other hosted Tapestries".
   - Optional fix: "each once it runs a build with this manifest". The row's own check, one conditional, would catch the mistake after the fact.
4. **`BIBLE.md:262` says "it also writes a pair of conditionals tying the field's value to `word.wordTypes`".** It writes a pair for each allowed value: 8 entries for `graph`'s four types on david.tapestry.ninja. Optional fix: "a pair of conditionals for each value, tying …".
5. **Story `:37` and the closed row's `:7` each say "the third", meaning different fix shapes.** The story's third is the array-aware form, the one left over. The row's third, by its list (`:22-25`) and by P-156's, is the switch: the shape taken. Optional fix: name the shape instead, in either place.
6. **`ledger/2026-11-17-word-wordtypes-conditionals-contradict-themselves.md:10` cites `src/api/normalize/index.js:6029–6125`.** `generateWordTypeConditionals` is at `:6048-6143`, both at base and at HEAD; P-156 repeats the old range. This diff didn't introduce it, but the row closes in this diff. Optional fix, while the row is open for edits.

### Harness friction
1. **Nothing keeps one suite's environment out of the others, and the one check that would show it never runs where it could.**
   - The engine shares one `process.env` across the whole run and loads every suite first (`test/helpers/gateRunner.js:10-11`, `:157-166`). Its isolation covers throws and exits, not the environment.
   - `stack-free-npm-test`'s G2 is the only check that would catch a leak like Blocking 1. It runs only where a panel answers: never in CI, and not on this Mac, where the full gate is barred.
   - This needs a new `meta` row, for a guard. For example, the engine could snapshot the endpoint variables before the first load, and fail a suite whose load or run leaves them changed.
2. **The review template's "On PASS" heading after "Verdict" still reads as the verdict.**
   - In the template's order (`engineering-team/templates/review-checklist.md:61`, `:64`), this review would parse as PASS in `scripts/lib/review-verdict.awk`. I checked that on a two-heading sample. It would draw a false L1.
   - It is already recorded as ledger row `2026-10-07-on-pass-heading-reads-as-verdict` and OPEN.md row 272. I worked around it here by putting "On PASS" before the Verdict. No new row is needed.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place: not applicable, since the verdict below requests changes.
- [ ] Completion detection: not applicable until a passing review.

## Verdict
**CHANGES_REQUESTED**

## Round 2 — 2026-11-20 (HEAD `e5494dfe`)

Round 1 was committed as `f01a09d6`, with the story's Review link. Two commits came after it:
- `31e3c327`, in the Tester's lane, for Blocking 1:
  - the suite no longer sets `process.env`, and its dead values go to its child alone;
  - its comment and test plan `:48` say why;
  - the test plan's Verification and edge cases take non-blocking 1 and 2;
  - a new "Amendment after review round 1" section.
- `e5494dfe`, in the Implementer's lane, for the rest:
  - non-blocking 1 in the story;
  - non-blocking 3 to 6 in the reinstall row, BIBLE §6, the story and the closed row;
  - the story's Deviations, which list round 2;
  - harness friction 1 as ledger row `2026-11-20-suite-env-changes-reach-every-suite`.

`git diff f01a09d6..HEAD`: 7 files, +52 −17. No file under `src/` or `firmware/` changed. The test bodies are as they were: the suite's diff is its comment block and one removed line. I checked each fix as a fresh claim, my own suggested wording included (reviewer.md rule 10). I checked them against the code, the history, Loom and my own probes, not against the commit messages.

### Gates (run by the reviewer at `e5494dfe`)

- [x] **The scoped gate:** the same six suites and dead endpoints as round 1, plus `BRAINSTORM_CONF_PATH` at a dead conf of my own.
  - **Why the extra variable.** `NEO4J_URI` alone moves nothing: the driver reads its address only from the conf file, and with none it falls back to `bolt://localhost:7687` (`src/utils/config.js:19`, `src/lib/neo4j-driver.js:33`). In round 1 the suite's parent set that variable for the whole run; now it doesn't.
  - **The run.** `npm run gate:status -- --label review-46-r2` reads:
  `20261120T224734Z-1757-8851 [review-46-r2] started 2026-11-20T22:47:34.497Z on e5494dfe — PASS, exit 0, 160 passed, 0 failed, 6 skipped, 6/6 suites` (record `tmp/gate-runs/20261120T224734Z-1757-8851.json`)
  - **The counts.** There is no `+dirty`. Each suite's count is round 1's: 9/0/0, 26/0/2, 13/0/4, 21/0/0, 6/0/0 and 85/0/0. The skips are the same six scratch-container live checks.
  - **Against the coordinator's run.** It matches `20261120T224144Z-59257-74fe` (PASS, 160/0/6 over the same suites). That record is on `31e3c327+dirty`, with 5 dirty paths: the five files `e5494dfe` then committed.
- [x] **On Node 22.23.1,** the suite alone: `20261120T224959Z-42109-4f42 [review-46-r2-node22] … on e5494dfe — PASS, exit 0, 9 passed, 0 failed, 0 skipped, 1/1 suites`.
- [x] **harness-lint** at `e5494dfe`, before this round was written: `harness-lint: clean (0 violations)`. What it says with this round on disk is under "On PASS".

### Probes

- **The environment, around the suite.** I ran the suite through the gate engine between two probe entries, in one run. It started from dead values of my own: port 8, `TAPESTRY_CONTAINER=review-46-r2-canary` and my dead conf.
  - All seven variables the suite once set read the same three times: before the load, at the probe listed first, and at the probe listed last.
  - The run was `20261120T224927Z-41790-b033`, with 11 passed: the suite's 9 and the two probes.
  - In round 1, the same kind of probe read port 9 and `no-such-container` (`20261120T222242Z-87439-52e3`).
- **The parent reaches nothing.** In that same run, the parent refused and recorded every `net.Socket` connect, every `fetch` and every `http`/`https` request. It also recorded every load of `src/lib/neo4j-driver.js`, `src/lib/tapestry-store.js` or a network client in `node_modules`.
  - It saw none of any, and the suite passed 9 of 9.
  - So the comment's "It needs none" (`test/word-elements-fit-the-installed-word-schema.test.js:50-52`) holds.
  - The modules the parent loads say they open nothing (`_schemas.js:47-48`, `_sets.js:13`, `_elements.js:37`, `schema-verdicts.js:21`). `src/api/normalize/firmware.js` requires only `fs` and `path`. Each read they make is the fake graph's.
- **The tests still tell the fix apart.** I exported HEAD with `git archive` and set only `manifest.json:408` back to `true`; the copy's suite is identical to HEAD's. The run, `20261120T224943Z-42002-5e41`, is FAIL with 5 passed and 4 failed: W1, W2a, W2b and W4, as in round 1.

### Round-1 findings, re-checked

1. **Blocking 1 — fixed.**
   - **The fix.** `Object.assign(process.env, DEAD)` is gone. The only `process.env` left in the suite is the child's spawn environment, `{ ...process.env, ...DEAD }` (`:202`), so the child's dead values are as before.
   - **The probes above** show that loading and running the suite leave the gate's environment unchanged. They also show the parent opens nothing without the dead values.
   - **The comment** (`:43-52`) is accurate on each point: what the child needs, the driver's fallback (`src/utils/config.js:19`, `src/lib/neo4j-driver.js:33`), why the parent sets nothing, and why it needs nothing.
   - **Test plan `:48` and its amendment (`:88-90`)** say the same. The amendment matches what I re-derived: the seven variables, the snapshot around `require` and `run()`, 9 of 9, and no test's check changed.
   - **Not pinned by a test.** My round-1 "a check would pin it" wasn't taken up as a test. The new ledger row's guard would pin it for every suite, which is the better place.
2. **Non-blocking 1 — fixed.**
   - Story `:108` now reads "82 self-comparing ones, a pair for each of 41 keys". That agrees with `report.json`'s LB1: 83 entries, 82 tying, 41 allowed keys.
   - Test plan `:84` now reads "the 20 conditionals …, a pair for each of the fixture's ten keys". That agrees with the ten entries of `KEYS` (`test/word-elements-fit-the-installed-word-schema.test.js:79`) and W4's "20 do".
3. **Non-blocking 2 — fixed.** Test plan `:36` now names the Properties Set nodes' set fields, which the derive step builds as words. That matches:
   - story 42's LC7c (`42-both-readers-judge-tapestryjson.md:160`: 132 set-field errors on 44 nodes);
   - P-157, which says the word deriver builds no `elements`, `childSets` or `parentSets` for those nodes.
4. **Non-blocking 3 — fixed.** The reinstall row (`:11`) now makes two claims, and both hold:
   - each instance must run code with this manifest before its reinstall: the step reads the manifest of the build it runs (`src/api/normalize/firmware.js:30-39`);
   - a reinstall over the old manifest writes the pairs again: with the switch on, the step writes them (`src/api/normalize/index.js:6254-6289`), as the live check's first install did (LB1: 82).
5. **Non-blocking 4 — fixed.** `BIBLE.md:262` now says "a pair of conditionals for each value". That is my round-1 wording, so I re-derived it rather than recognising it:
   - `generateWordTypeConditionals` pushes a Forward and a Reverse for each allowed value (`src/api/normalize/index.js:6052-6140`);
   - david.tapestry.ninja's schemas hold 8 such entries for `graph`'s 4 types, and 4 for `dog`'s 2 breeds.
6. **Non-blocking 5 — fixed.**
   - Story `:37` now names "P-156's array-aware form", which is P-156's own name for its second shape.
   - The closed row's Done line (`:7`) now names "the one that sets `enforce-wordType-conditionals` false", the row's own third bullet (`:25`).
7. **Non-blocking 6 — fixed in part.** The closed row's current range (`:10`), `:6048–6143`, is right. The clause added beside it isn't; see new non-blocking 1.
8. **Harness friction 1 — filed,** as ledger row `2026-11-20-suite-env-changes-reach-every-suite`. Its header fields pass L15. Its account of the leak is right, as are the two runs it cites, CI's blind spot and its two fix shapes. It has two slips; see new non-blocking 2.
9. **Harness friction 2 — already on file,** as round 1 said. Nothing was added, which is right.

### Findings

- **Blocking:** none.
- **Non-blocking:**
  1. **`ledger/2026-11-17-word-wordtypes-conditionals-contradict-themselves.md:10` says the function was at "`:6029–6125` when the row was opened".**
     - At the commit that opened the row, `4b3632a5` (2026-11-17), `generateWordTypeConditionals` ran `:6036–6131`. Line `:6029` was the blank line above its docblock.
     - No commit since 2026-11-01 has the function at `:6029–6125`. So the range was already off when the row was written, and the new clause says it was right.
     - Optional fix: drop the clause, or say "the row first said `:6029–6125`; at `4b3632a5` it was `:6036–6131`".
     - The current range beside it is right, so nobody is sent to the wrong code.
  2. **`ledger/2026-11-20-suite-env-changes-reach-every-suite.md` has two slips.**
     - **`:12` says "the live suites skip".** Not all of them would. A suite that reads its base URL when it loads kept the real address, if it loaded before the leaking suite. `tag-detail.test.js:16` is one: it is registered at `test/registry.js:37`, so it would have run its live tests. What got the dead values was each check that reads an endpoint when it runs, and each child a suite starts, G2's child among them. Optional fix: say that.
     - **`:9` cites `test/helpers/gateRunner.js:156`.** That line is the `try {` above the loading. The loading is `:157-164` and the run loop starts at `:166`. Optional fix.

### Harness friction

- None new.

### On PASS (same commit)
- [ ] Story `**Status:**` set to `Done`: left to the session that commits this review, since the brief keeps the Reviewer off the story file. harness-lint's L1 flags a PASS-final review whose story isn't Done, so the change belongs in this review's commit (workflow 5). With this round on disk and the story still `Approved`, harness-lint gives exactly that one violation (`VIOLATION L1 …46-word-elements-fit-the-installed-word-schema.md … PASS-final but story status is 'Approved'`, `harness-lint: 1 violation(s)`), and nothing else.
- [ ] Completion detection: its result goes in the chat, not this file.

### Verdict

**PASS**
- Blocking 1 is fixed. The suite leaves the gate's environment as it found it, and its parent reaches nothing without the dead values. Probes before and after the suite show the first, and a parent that refuses the network shows the second.
- Of round 1's six non-blocking findings, five are fixed and one is fixed in part. Both harness-friction items are on file.
- Two new non-blocking slips, both in ledger-row prose, send no one to the wrong code or the wrong fix.
- The scoped gate passes at `e5494dfe`, and the tests still fail without the fix.
