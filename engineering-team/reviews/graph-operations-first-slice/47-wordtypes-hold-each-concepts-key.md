# Review: Story 47 — a node's `wordTypes` hold the key of each concept it belongs to: the rule, `rules check`, and firmware's keys

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-20
**Diff:** `git diff bcbd7468...HEAD` at `ee531556`: 84 files, +2524 −114. `bcbd7468` is the branch's base on staging. The range holds six commits:
- `c9b9dc7d`: the story;
- `acd8b88b`: ADR 0047 (Options A and D, accepted);
- `e9dbdbd6`: the test plan, the four new suites, the seed `test/helpers/wordTypesGraph.js`, the changes to `todaysCreateConcept.js` and `pass1bChild.js`, rule 12 in the three suites that pin the rule list, and story 45's suites pinned to their rule;
- `8f5e0149`: the test plan's Amendment 1, XW1's input only;
- `fbd1aca1`: the implementation:
  - the rule, `rules check` and `rules repair`;
  - the constant and the writers, Pass 1a, and the create-concept route's `wordTypes`;
  - the 54 firmware files and the generated graph rule element;
  - rulebook entry 12, the catalog's two rows, the ledger row, and the story's Deviations.

  It touches no test file;
- `ee531556`: the story's Evidence.

**Against:**
- the story, [47-wordtypes-hold-each-concepts-key.md](../../stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.md), with its Deviations and Evidence;
- [ADR 0047](../../decisions/graph-operations-first-slice/0047-wordtypes-hold-each-concepts-key.md), Decisions 1–10;
- the [test plan](../../stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.test-plan.md), with Amendment 1;
- the live-check record in the ignored `tmp/live-check-47/`.

**How it was made.** A Reviewer agent with no Edit access wrote this review at the session's request.
- **The gate.** It ran the gate itself, stack-free:
  - stub `curl` and `docker` first on `PATH`;
  - `BRAINSTORM_CONF_PATH` at a conf whose `NEO4J_URI` is a closed port;
  - `TAPESTRY_CONTAINER=no-such-container`, and `BRAINSTORM_BASE_URL` and `TAPESTRY_PORT` on a dead port.
- **What it never ran.** `npm test`, Playwright, `stack-free-npm-test` (CI's), or anything that reaches the `tapestry` container, docker, SSH or a hosted instance.
- **Its probes** ran in copies outside the worktree:
  - a `git archive` of the base, for S2 below;
  - the tree `git merge-tree` makes of HEAD and `origin/staging`;
  - a copy of HEAD with its own scratch git, for 13 mutation probes.

  Their scripts and logs are in the ignored `tmp/review-47/`. The copies themselves were in the session's scratchpad and aren't kept.
- **The live check** was read from its record, not re-run. Its `compare.py`, which only reads the saved extracts, was run again.
- **Within the brief.** The brief limits it to this file, so it doesn't commit, and it leaves the story's status alone.
- **No independent check.** The independent check before the commit (workflow 5, P13) wasn't applied.

**Verdict:** CHANGES_REQUESTED, with one blocking finding and five non-blocking ones.

## Quality gates (run by reviewer, not trusted)

- [ ] **The full gate** (`npm test`) was not run. On this Mac the local stack is the owner's live agent-memory instance, and the full suite writes to it. CI's stack-free job runs it on the pull request, and blocking 1 says it would fail there.
- [x] **The scoped gate** at `ee531556`, clean, through the gate engine. It ran 28 suites:
  - the Implementer's 14: `operations.test.js` (every suite under `test/operations/`), `external-cli`, `openapi-coverage`, `admin-action-sweep`, `schema-save-finds-the-right-header`, `graph-rules-builder`, `graph-rule-firmware`, `firmware-element-sync`, `firmware-nodes-hold-their-concepts-keys`, `neo4j-property-firmware`, `profile-tags`, `event-tagging-firmware-seed`, `concepts-list-shows-concepts-with-no-event` and `pass-3-finishes-in-minutes`;
  - 14 more that load or read a file this diff changes: `header-conceptgraph-tag`, `community-class-thread-pull`, `community-reference-superset-link`, `community-reference-nostr-relay-stub`, `add-node-as-element-restore`, `b-tag-primitive`, `close-unauth-write-surface`, `default-deny-mutations`, `event-less-create-set`, `nostr-user-tag-hybrid-ea-writer`, `trusted-dictionary`, `openapi-document`, `pin-a-tag` and `relationship-primitives`.

  Its `npm run gate:status -- --label story-47-review` line:

  ```
  20261121T002100Z-6796-ac63 [story-47-review] started 2026-11-21T00:21:00.733Z on ee531556 — PASS, exit 0, 1676 passed, 0 failed, 75 skipped, 28/28 suites · /Users/wds4/repos/TapestryProtocol/tapestry/.claude/worktrees/magical-jepsen-43e8c5/tmp/gate-runs/20261121T002100Z-6796-ac63.json
  ```

  - **The Implementer's 14 suites:**
    - operations 1327 passed, 10 skipped; external-cli 53; openapi-coverage 13; admin-action-sweep 9; schema-save-finds-the-right-header 26, 2 skipped;
    - graph-rules-builder 26; graph-rule-firmware 13, 4 skipped (live); firmware-element-sync 21; firmware-nodes-hold-their-concepts-keys 10;
    - neo4j-property-firmware 9; profile-tags skipped whole (no stack); event-tagging-firmware-seed 9, 2 skipped; concepts-list-shows-concepts-with-no-event 10, 5 skipped; pass-3-finishes-in-minutes 8, 8 skipped.
  - **Against the Implementer's run.** Those 14 add up to 1534 passed and 44 skipped, the same as the Implementer's run, `20261120T235304Z-73207-0e2c`. That run was on `8f5e0149` with the implementation uncommitted (66 files dirty). This one is on the committed HEAD.
  - **The new and changed suites, inside operations:**
    - rule word-types-hold-concept-keys 10 passed (WT1–WT10); rules check and repair run it 10 (WC1–WC10); XW1 1;
    - rules check 11; rules repair 16; XR1 1;
    - graph create-concept 23, create-element 39, update-node 46.
  - **The 14 more:** 142 passed, 31 skipped (live parts), 0 failed.
  - The log is in `tmp/review-47/gate47r.log`.
- [ ] **`create-concept-duplicate-check.test.js`, run apart: S2 fails.** That is blocking 1.
  - Under this environment H1 and H2 fail too, since `TAPESTRY_CONTAINER=no-such-container` makes the suite think it is live. On the base the same two fail the same way, and S2 passes.
  - It was kept out of the gate so the gate's verdict isn't muddled by those two.
- [x] `b-tag-seeds` (reads firmware's files): 7 passed.
- [x] `node src/firmware/graph-rules.js --check`: "the 12 items in firmware/active/concepts/graph-rule/elements are current."
- [x] harness-lint: `harness-lint: clean (0 violations)`, before this file was written and again with it on disk.
- [x] Every `test/*.test.js` is in the registry's `suites` or `excluded`. That is G5's rule, checked by reading `test/registry.js`: 351 files, none missing.
- [ ] `npm run test:playwright`: not applicable (no UI change).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

**The merge with staging.** Staging has gained more than docs since `bcbd7468`: story 46 merged as #174 (`72f4e2c8`). It changed three things:
- `manifest.json`: `enforce-wordType-conditionals: false` on word's wordType pair;
- a new suite, `word-elements-fit-the-installed-word-schema.test.js`;
- that suite's line in `test/registry.js`.

`git merge-tree --write-tree origin/staging HEAD` is clean (tree `cad5ac57`). In an archive of that tree, with the same dead endpoints:
- story 46's suite: 9 passed;
- firmware-nodes-hold-their-concepts-keys: 10;
- graph-rules-builder: 26;
- graph-rule-firmware: 13, 4 skipped;
- firmware-element-sync: 21;
- and S2 still fails.

So AC3's "`word`'s installed one included once story 46's fix is in" holds on the merged tree. Blocking 1 survives the merge.

**Live checks.** Read from `tmp/live-check-47/`, not re-run:
- **`compare.py`, run again** (it reads only the saved files):
  - LB2 named 49: 41 × `validationTool`, 4 × `graphType`, 2 × `nodeType` and 2 × `validationToolType`. It judged 415, with `notJudged` 44 `no-json`.
  - LA named 0, judging 416.
  - Of the 49, all compared; none differs in its JSON beyond `word.wordTypes`.
  - No other node's word types changed.
  - LA2: teapot judged 8, found 0.
- **The record:**
  - `fits.js`'s answer is in `LA3-agent-2.txt`: `{"judged":42,"fit":42,"misfits":[]}`.
  - `LA3-agent-1.txt`: the agent signed in with its own key (`73a0c96d…`), role `admin`, through `clients/cli/bin/tapestry.js`, which the diff doesn't touch.
  - `LA3-agent-2.txt`: Brown Betty named once for `teapot`, left by the repair with `change: null`, then judged and not named.

## Spec adherence

- [x] **AC1.**
  - Entry 12 is in the rulebook's format (WT8).
  - It only reports: `refuses: false`, no refusals (WT1), and no write's code changed.
  - Its code is one file, which check and repair run.
  - The item is generated and current (WT9, GB2–GB6, GF9, IS4/IS8/IS10).
- [x] **AC2.**
  - The findings, once per key: WT3, WT4, WC2–WC4.
  - Two concepts give two ids, and paging between them skips neither: WC3, WC4.
  - Held keys, unreached keys and reserved keys: WT5, WT7.
  - No word block or no `wordTypes` lacks every key: WT5.
  - No JSON is told apart in `notJudged`: WC1, WC5.
  - Nothing changes or is recorded: WC9.
  - Repair leaves each finding with the way on: WC7, WC8.
  - Live: LB2 names the 49 that the measurement predicts for a fresh install, 41 JSON schemas and the eight headers, each for the key it lacks.
- [~] **AC3.**
  - The files say the keys (FN2, FN3), the constant follows the manifest (FN4), and every JSON schema fits validation tool's schema (FN5). Pass 1a hands the route each header file's list (FN9).
  - On a real install: LA's reinstall names nothing.
  - The plan's LF, a fresh install of this branch's firmware alone, wasn't run: non-blocking 5.
- [x] **AC4.**
  - `graph create-concept` (FN10, LA2) and the old create-concept route (FN7) make the schema with the constant.
  - The other five writers are pinned by FN6's text check only: non-blocking 3. I read all eight sites in the diff.
- [x] **AC5.** LB to LA, field by field, as above.
- [x] **AC6.** XW1 (stack-free, the real CLI and catalog) and LA3 (live, the agent's own key). Zeus on david.tapestry.ninja comes after the merge, on the owner's yes, and isn't part of this gate.
- [x] **No behavior beyond the story.**
  - The route's `wordTypes` input is ADR Decision 9.
  - The catalog's repair row is a recorded Deviation.

## ADR adherence

- [x] **Decision 1:**
  - the name and the summary, verbatim;
  - `refuses: false`, `refusals: []`, items `{ node }`;
  - requires only inside `scan` and `violations`;
  - every read through `read`: in `violations`, `F.conceptsOfNodes`, then `K.headersByKey`, then one `UNWIND` read.

  A reserved key, or one that can't be read, is expected of no one (`word-types-hold-concept-keys.js:140-143`).
- [x] **Decision 2:** the view is `F.readJson`, then `F.ownSectionsOf` and `F.overlaySections` (`:85-101`). The cases:
  - `no-json`: no tag, and no sections kept beside;
  - `unreadable-json`: two tags that differ, a problem from either reader, or JSON that isn't an object;
  - only the string entries of a list are matched.
- [x] **Decision 3:** the three scans. Each is labelled `TapestryNode`, not a change entry or a tag. Each is taken once and sorted, with its aliases from `K.rel()`. The core-node edges run into the header, as `rolesOf` reads them.
- [x] **Decision 4:** the finding's shape.
  - `firmware` comes from `K.isFirmware`, and `choice` holds `why` and `wayOn`.
  - The message has no closing full stop, so repair's refusals read as rule 11's do.
  - An unjudged entry is given only to a node some concept other than `word` reaches.
  - The way on's wording: non-blocking 2.
- [x] **Decision 5:**
  - `findingsIn` tallies unjudged entries into `notJudged` by rule, then why, and takes them out of `judged`.
  - `idOf` covers `key` and the concepts only when `key` is a string. Rule 11's findings carry no `key`, so their ids are as before; RP1–RP16 and CK1–CK11 pass.
  - The sort is by node, rule, then id; the cursor is three strings, and an old two-string cursor is refused.
  - `key` is in `answerOf` and `FINDING`. `notJudged` is required in the result, and the description names both rules.
- [x] **Decision 6:**
  - Unjudged entries are dropped in all three judgments.
  - A violation is found by its id; `changed-since-check` names the node's first finding now, and no longer says "parents".
  - A finding with `fix: null` is `left`, and no change entry is written.
- [x] **Decision 7:** entry 12's eight fields, the generated item, and the catalog's check row. The repair row too, as a recorded Deviation.
- [x] **Decision 8:**
  - `JSON_SCHEMA_WORD_TYPES`, frozen;
  - eight sites in six functions, each `[...firmware.JSON_SCHEMA_WORD_TYPES]` or `[...JSON_SCHEMA_WORD_TYPES]`;
  - the 46 `json-schema.json` files. Their only change is `word.wordTypes`: parsed at base and HEAD and compared with it removed, all 54 changed firmware files are otherwise equal.
- [x] **Decision 9:**
  - the eight header files gain their keys, and golden retriever's and irish setter's headers are untouched;
  - Pass 1a passes the file's list;
  - the route validates `wordTypes` and answers 400 before it reads a key or signs anything (`src/api/normalize/index.js:1226-1233`), then appends the list's other entries, once each, in order.
- [x] **Decision 10:** FN2–FN4. Every `existing-nodes` entry in the manifest is a `concept-header`, so FN3's filter misses nothing today.
- [x] **No new dependencies,** and no lint, typecheck or build tooling.

## Concept-graph integrity
- [x] **Handles** appear only in docs, as `39998:<TA>:<slug>`. No 64-hex literal is added anywhere in the diff.
- [x] **Firmware reinstall:**
  - **Called out:** "Firmware reinstall required? Yes", in the ADR's Consequences, and the ledger row `2026-11-20-word-types-keys-await-firmware-reinstall` (OPEN), each instance's on the owner's yes.
  - **What waits on it:** firmware's nodes gain their keys, and the graph rule concept its twelfth item, only at a reinstall. The check runs without one.
- [x] **Orientation:** not applicable to runtime code.

## Things tests can't catch
- [x] **No secrets.** `tmp/live-check-47/keys.json` holds the scratch stack's throwaway admin key, under the ignored `tmp/`. Nothing tracked holds a key.
- [x] **No debug logging, and no commented-out code,** in the diff's `src/`.
- [x] **No hardcoded TA pubkey.** The rule reads `K.assistant()` and `R.ownKeys()`.
- [x] **Error paths:**
  - **A bad list:** the route's 400 comes before any write.
  - **A bad header file:** Pass 1a's `apiPost` throws on a 400, and the install records an error for that concept. So a header file with a word type that isn't a key's form would fail that concept's install loudly. FN3 pins every installed header file, so none can ship.
- [x] **Concurrency.** Check is a read. Repair writes nothing for this rule and takes no lock for a finding with no fix.
- [x] **Security.**
  - The route is `OWNER_ACTION` (`src/middleware/routeAccess.js:301`), and `wordTypes` must be key-shaped strings.
  - The rule's Cypher interpolates only `K.rel()` aliases and a fixed label fragment; keys are parameters.
- [x] **Invariant 1, POV-first:** structural, no trust input.
- [x] **Invariant 2, decentralized-first:** report only; it gates no write and judges every author's nodes.
- [x] **Invariant 3, filter at view time:** computed per call, nothing stored.
- [x] **Invariant 4, local-first (BIBLE §30):**
  - **The reinstall:** it rebuilds firmware's headers and schemas, as it did before, now with keys.
  - **The route:** its new input only adds.
  - **The self-provisioning callers** of the route (`ensureResourceConcept` and the others) run only when their concept is absent. So no existing node is re-signed by this change.

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling without an ADR.

## Findings

### Blocking

1. **`src/firmware/install.js:202-205`: Pass 1a's three new lines push `overwrite: true` out of the window S2 reads, so `test/create-concept-duplicate-check.test.js:69-74` fails, and CI's stack-free `npm test` will fail on the pull request.**

   **What S2 checks.** It takes `install.js`'s text from `apiPost('/api/normalize/create-concept'` (`:196`) and asks for `overwrite: true` within the next 500 characters. On the base, `overwrite: true` is 331 characters after the call. At HEAD the comment and the `wordTypes` spread (`:202-204`) sit before it, and it is 680 characters after.

   **The proof.**
   - The base's copy of the suite, run against the base's files: S1, S2 and S3 pass.
   - At HEAD, S2 fails: "firmware install must pass overwrite: true, or a reinstall skips every existing concept".
   - On the tree merged with staging, S2 fails too.

   **Why CI fails.** The suite is in the registry (`test/registry.js:72`), so CI's run includes it. CI sets no `TAPESTRY_CONTAINER`, so its H tests return `SKIP` (`:32`, `:86`), and S2 is its one failure. The suite fails, and `npm test` exits non-zero. OPERATIONS §15 doesn't let a red check be run again.

   **Why the scoped gates missed it.** The suite reads `install.js` and `normalize/index.js` as text, but the plan's scoped gate list (`47-wordtypes-hold-each-concepts-key.test-plan.md:103-108`) doesn't name it. The code is right: Pass 1a still passes `overwrite: true`. The test is brittle, but this diff is what broke it.

   **Asked change:**
   - Make S2 pass, changing nothing else. The smallest way is in `src/firmware/install.js`: move the three new lines below `overwrite: true`, a source-only change.
   - The Reviewer tried that move in a scratch copy of HEAD. S2 passed, and the suite's result matched the base's. FN9 (10 of 10) and firmware-element-sync (21 of 21) still passed. The logs are in `tmp/review-47/logs/fix-*.log`.
   - The other way is for the Tester to make S2 read the whole call object, with a test plan amendment, since test files are the Tester's.
   - Either way, add `create-concept-duplicate-check` to the plan's scoped gate list, and run the scoped gate again with it in.

### Non-blocking

1. **"An install writes them from firmware's files" is true for the headers only.**
   - **Where:** rulebook entry 12's Repair (`docs/GRAPH_RULES.md:186`), its graph rule item (`firmware/versions/v1.0.0/concepts/graph-rule/elements/word-types-hold-concept-keys.json:20`), and the story's Evidence (`47-wordtypes-hold-each-concepts-key.md:197`, "rebuilds every firmware header and JSON schema from this branch's files").
   - **What's true:** it holds for the eight headers, whose list Pass 1a hands the route.
   - **What isn't:** a JSON schema's word block is never installed from its file (ADR fact 6, `0047-wordtypes-hold-each-concepts-key.md:36`). The route writes the code's constant, and Pass 2 sends only the `jsonSchema` section. The 46 file edits keep the files in line with what is installed. They aren't its source.
   - **Why it matters:** the item reaches every instance at its next install.
   - **Suggestion:** "since an install writes them: each header's from its file, each JSON schema's from the writers' constant, which firmware's files repeat". Then run the generator and its `--check`.
2. **The way on leaves out one case.**
   - **Where:** `src/operations/rules/word-types-hold-concept-keys.js:110`, also in entry 12's Repair and the item.
   - **What it says:** "graph add-to-concept adds a concept's key only with the concept's section, to a node that holds none".
   - **The missing case:** `graph add-to-concept` also adds the key, with no section, when it puts a node already in the concept into one of the concept's sets that the node isn't directly in (`src/operations/catalog/graph/add-to-concept.js:179-188`; that operation's own description says so at `:47`).
   - **Why it matters:** ADR Decision 4 asks the wording to "stay true to those cases" (`0047-wordtypes-hold-each-concepts-key.md:187`).
   - **Suggestion:** qualify the clause, or drop it.
3. **FN6 pins five of the seven writers by text alone** (`test/firmware-nodes-hold-their-concepts-keys.test.js:158-177`).
   - **What it checks:** the constant's name appears in each writer's function, and the old literal appears nowhere under `src/`. That catches a writer reverted to `['word', 'jsonSchema']` (mutation M10). FN7 and FN10 test two writers by what they make.
   - **What it misses:** mutation M11, `save-schema`'s fallback writing a filtered copy that still names the constant, passes every suite. The ADR's note for the Tester asks that "each of the seven makes a JSON schema whose word types are the constant".
   - **What I checked instead:** all eight sites, by reading the diff.
   - **Optional:** match the exact expression at each site.
4. **The route's OpenAPI entry doesn't document the new input** (`src/api/openapi.yaml:1041-1081`).
   - Its request body lists `dTag`, `conceptHeaderOverrides` and `overwrite` (`:1071`), but not the new optional `wordTypes`.
   - Its responses (`:1076-1081`) list no 400, neither the new one nor the existing "Concept name is required".
   - The ADR didn't name this file, and no suite compares body fields.
   - **Optional:** add `wordTypes`, a list of key-shaped strings, and the 400.
5. **The plan's LF, a fresh install of this branch's firmware alone, wasn't run** (`47-wordtypes-hold-each-concepts-key.test-plan.md:114`).
   - **Where it's recorded:** the story records it under Evidence, "Not covered" (`47-wordtypes-hold-each-concepts-key.md:196-197`), not under Deviations. AC3 reads "Given a fresh install of this story's firmware".
   - **What carries AC3 instead:** FN2, FN3, FN5 and FN9, stack-free, and LA's reinstall.
   - **The reasoning holds for word types.** On both paths Pass 1a writes each header's list from its file and each JSON schema's from the constant, with `overwrite`, before Pass 1c½ or any cache.
   - **For the owner to ratify,** as review 45 did for AC8's split.
   - **Suggestion:** move the note into Deviations.

### Mutation probes (`tmp/review-47/mutate.js`, `mutate.log`)

Each probe changes one exact string in a scratch copy of HEAD, runs the suites that should catch it, then resets the copy.

| # | Mutation | Caught by |
|---|---|---|
| M1 | `idOf` ignores `key` and the concepts | WC3, WC4, WC8 |
| M2 | the cursor ignores the id | WC4 |
| M3 | repair takes the node's first finding | WC8 |
| M4 | kept-beside sections ignored | WT3, WT5, WT6 |
| M5 | reserved keys expected | WT3, WT5, WT7 |
| M6 | a node with no JSON named as lacking every key | WT3, WT6, WC1, WC3–WC5 |
| M7 | `judged` counts unjudged nodes | WC1, WC5 |
| M8 | Pass 1a passes no `wordTypes` | FN9 |
| M9 | the route takes any list | FN8 |
| M10 | the schema generator writes `['word', 'jsonSchema']` | FN6 |
| M11 | save-schema's fallback filters the constant | **none** (non-blocking 3) |
| M12 | a concept's scan drops all core nodes but the schema | WT6, WC5 |
| M13 | repair keeps unjudged entries | WC7 |

### For the owner to ratify at this gate
- **Deviation 1.** Eight `json-schema.json` files are reordered to the constant's order. The story says the owner kept that order at the Test Design gate. The Reviewer can't confirm that.
- **AC3's "fresh install".** It is carried by the reinstall and the stack-free suites (non-blocking 5).

### Harness friction
1. **The scoped gate list was built by hand.** The list (`47-wordtypes-hold-each-concepts-key.test-plan.md:103-108`) came from categories, such as "the suites that read firmware's schema files". It missed a registry suite that reads `install.js` as text, and CI would have caught the miss only on the pull request.
   - **The Reviewer's way:** list the changed files (`git diff --name-only <base>...HEAD`), then grep `test/` for every suite that requires or reads one. That found 16 more suites: the gate's 14, `create-concept-duplicate-check` and `b-tag-seeds`. One of them fails.
   - **Suggestion:** a Test Design step, or a helper script, that derives the scoped gate's extra suites so. This is an OPEN.md `meta` row for the session to file.

## Verdict
**CHANGES_REQUESTED**

The rule, `rules check`'s and `rules repair`'s generalizations, the constant and its writers, Pass 1a and the route all match ADR 0047. The firmware files change only their word types. Twelve of the thirteen mutation probes are caught. The live record bears out AC2 through AC6.
- **The scoped gate passes:** `20261121T002100Z-6796-ac63`, PASS, 1676 passed, 0 failed, 28 of 28 suites.
- **The merge with staging is clean,** and story 46's suite passes on the merged tree.

One thing blocks the merge:
- **Blocking 1.** The diff breaks S2 in `create-concept-duplicate-check.test.js`, a stack-free suite in the registry, so CI's `npm test` will be red on the pull request. The fix is three lines moved in `src/firmware/install.js`, then the scoped gate run again with that suite in.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place: not applicable (CHANGES_REQUESTED). The brief also left the status alone.
- [ ] Completion detection: not applicable until a PASS.
