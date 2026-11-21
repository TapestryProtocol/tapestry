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

## Round 2 — 2026-11-20 (HEAD `9106fbeb`)

Round 1 reviewed `ee531556` and was committed as `6f6f125b`. Four commits came after it:
- `a7b0aadb`, a merge of `origin/staging` at `8fc07725`: story 46 (#174), export nostr's ADR amendment (#173), seed firmware's story and ADR (#171), and property-has-one-parent's ship records (#172). 17 files, +2168 −5.
- `14a944e7`, in the Tester's lane: FN11 and the suite's header, and the test plan's Amendments 2 and 3.
- `2a8e8c2b`, in the Implementer's lane: blocking 1, non-blocking 1, 2 and 4, the intake marker, the epic's line for story 47, and a `meta` ledger row for harness friction 1.
- `9106fbeb`: the story's Evidence for the session's round 2 gate.

Story 47's own three commits come to 11 files, +135 −5. Four are under `src/` or `firmware/`: `src/firmware/install.js`, the rule's file, `src/api/openapi.yaml` and the graph rule item. I checked each fix as a fresh claim, round 1's suggested wording included (role rule 10).

**How it was made.** A Reviewer agent with no Edit access wrote this round at the session's request. It changes only this file, doesn't commit, and leaves the story's status alone.
- **The gates** ran through the session's `safe-run-ci.sh`: stub `curl` and `docker` first on `PATH`, `BRAINSTORM_CONF_PATH` at a dead conf, and `TAPESTRY_CONTAINER` unset, as CI runs.
- **Inside a sandbox, too.** Each gate ran under `sandbox-exec` with `tmp/review-47/round2/deny-forwards.sb`. It refuses outbound connections:
  - on loopback, to the 18 ports colima forwards from its VM on this Mac (80, 3000, 3069, 5432, 6379, 7474, 7475, 7687, 7688, 7700, 7777, 7778, 8000, 8081, 8687, 8777, 8778 and 19071) and to 8877;
  - anywhere, to 22, 80, 443, 7777 and 7778.

  It was tested first (`nettest.js`): those connections fail `EPERM`, and a server a suite starts on its own loopback port still answers. Neither gate's log records a refusal.
- **The probes** ran with the same environment, outside the sandbox, over fake graphs. They ran in a `git archive` copy of HEAD with its own scratch git, in the session's scratchpad:
  - FN11's mutations;
  - skeleton and normalize/json in `test/helpers/saveSchemaChild.js`, which refuses `fetch` and every launcher;
  - `graph add-to-concept` and `rules check` in the operations harness.

  The scripts and logs are in the ignored `tmp/review-47/round2/`. The copy isn't kept.
- **What it never ran:** `npm test`, Playwright, `stack-free-npm-test` (CI's), `event-tagging-firmware-seed` (new non-blocking 3), `operations.test.js` (its five rule suites ran by name instead), or the session's 44-suite gate again (read from its record).
- **No independent check** (workflow 5, P13).

### Gates (run by the reviewer at `9106fbeb`)

- [x] **The Reviewer's scoped gate,** 30 suites, through the gate engine. `npm run gate:status -- --label story-47-round2-review`:

  ```
  20261121T011021Z-1774-52f7 [story-47-round2-review] started 2026-11-21T01:10:21.123Z on 9106fbeb — PASS, exit 0, 799 passed, 0 failed, 14 skipped, 30/30 suites · /Users/wds4/repos/TapestryProtocol/tapestry/.claude/worktrees/magical-jepsen-43e8c5/tmp/gate-runs/20261121T011021Z-1774-52f7.json
  ```

  - **For the fixes, 15 suites:**
    - create-concept-duplicate-check 3, 3 skipped; firmware-nodes-hold-their-concepts-keys 11; graph-rules-builder 26; graph-rule-firmware 13, 4 skipped; firmware-element-sync 21;
    - openapi-coverage 13; openapi-document 10; ledger-row-ids 6; word-elements-fit-the-installed-word-schema 9; schema-save-finds-the-right-header 26, 2 skipped;
    - under `test/operations/rules/`, by name: word-types-hold-concept-keys 10, word-types-check-and-repair 10, word-types-agent-through-cli 1, check 11 and repair 16.
  - **Against the session's gate:** the ten outside `test/operations/` give its counts exactly, and the five rule suites give round 1's.
  - **The 15 other suites that read `src/api/openapi.yaml`.** The fix commit changed that file, and the session's gate didn't list them (new non-blocking 4). Together 613 passed, 5 skipped:
    - assistant-attention 38, 1 skipped; assistant-outbox-check 29; assistant-duty-menu-check 65; assistant-duty-menu-publish 36; assistant-profile-check 33;
    - assistant-relay-list-publish 32, 1 skipped; assistant-self-map-check 94; assistant-self-map-publish 92; assistant-scores-route 32; assistant-shared-categories 21;
    - assistant-taggings-publish 19, 1 skipped; assistant-trusted-content 30; my-assistants-nip05 13; setup-status 38, 2 skipped; setup-open-sign-up 41.
- [x] **The three suites that read the real `_intake.md`,** which the fix commit gives a marker. `--label story-47-round2-intake`:

  ```
  20261121T011436Z-19783-2946 [story-47-round2-intake] started 2026-11-21T01:14:36.941Z on 9106fbeb — PASS, exit 0, 74 passed, 0 failed, 0 skipped, 3/3 suites · /Users/wds4/repos/TapestryProtocol/tapestry/.claude/worktrees/magical-jepsen-43e8c5/tmp/gate-runs/20261121T011436Z-19783-2946.json
  ```

  rollup-scanners 33, note-tagging-raw-events-inspector-ui 32 and kill-timeout-orphans-by-default 9.
- [x] **The session's round 2 gate,** read from its record, not re-run:

  ```
  20261121T004946Z-57222-e9ab [story-47-round2] started 2026-11-21T00:49:46.036Z on 2a8e8c2b — PASS, exit 0, 1951 passed, 0 failed, 166 skipped, 44/44 suites · /Users/wds4/repos/TapestryProtocol/tapestry/.claude/worktrees/magical-jepsen-43e8c5/tmp/gate-runs/20261121T004946Z-57222-e9ab.json
  ```

  - Its tree was clean (`dirty: false`). HEAD differs from `2a8e8c2b` only in the story's four new Evidence lines (`9106fbeb`).
  - Its 44 are Amendment 2's: the six CI entries and `ledger-row-ids` in the session's `gate47-round2.js`, and the 37 in its `derived-suites.json`. `operations.test.js` gave 1327 passed, 10 skipped.
- [x] **`create-concept-duplicate-check` alone, as CI runs it:** S1, S2 and S3 pass; H1, H2 and H3 skip; exit 0.
- [x] `node src/firmware/graph-rules.js --check`: "the 12 items in firmware/active/concepts/graph-rule/elements are current."
- [x] **harness-lint** at `9106fbeb`, before this round was written: `harness-lint: clean (0 violations)`. With this round on disk, see "On PASS".
- [x] **G5:** all 352 `test/*.test.js` are in the registry. 348 `suites` entries name a file and 4 are `excluded`; the 349th suite, `config-loading`, is a `run`.
- [ ] `npm run test:playwright`: not applicable (no UI change).

### The merge with staging

- **The merge is git's own.** `git merge-tree --write-tree 6f6f125b 8fc07725` gives tree `86ac429f`, which is `a7b0aadb`'s tree: no conflict and no hand edit.
- **Nothing of story 47's was lost.** `git diff 8fc07725 a7b0aadb` is `git diff bcbd7468 6f6f125b`, line for line, `index` lines aside.
- **Staging's side arrived whole.** `git diff 6f6f125b a7b0aadb` is `git diff bcbd7468 8fc07725` but for one hunk header in `test/registry.js`, shifted by story 47's entry above it. That is the only file both sides changed.
- **Story 46's three pieces are at HEAD:**
  - `"enforce-wordType-conditionals": false` (`firmware/versions/v1.0.0/manifest.json:408`);
  - its suite, unchanged from staging;
  - its registry line (`test/registry.js:424`), beside story 47's (`:416`).

  Its suite passes on the merged tree: 9 of 9 in both gates.
- **`origin/staging`** here is still `8fc07725`, an ancestor of HEAD. It wasn't fetched again.

### Round 1's findings, re-checked

1. **Blocking 1 — fixed.**
   - **The fix.** `overwrite: true` now comes before the comment and the `wordTypes` spread (`src/firmware/install.js:202-205`). The spread adds only `wordTypes`, so the body the route gets is unchanged.
   - **S2's window,** counted from `apiPost('/api/normalize/create-concept'` (`:196`): `overwrite: true` is 331 characters on, as on the base. At `ee531556` it was 680.
   - **The suite** passes as CI runs it (above), and in both gates: 3 passed, 3 skipped.
   - **The second ask,** the suite in the scoped gate, is Amendment 2's. The session's gate ran it.
2. **Non-blocking 1 — fixed.**
   - **The new sentence** is in entry 12's Repair (`docs/GRAPH_RULES.md:186`), the item (`firmware/versions/v1.0.0/concepts/graph-rule/elements/word-types-hold-concept-keys.json:20`) and the Evidence (`47-wordtypes-hold-each-concepts-key.md:201`). It says an install writes a JSON schema's word types from the code's constant, and a header's from its file.
   - **Re-derived** over every route `src/firmware/install.js` calls:
     - only create-concept writes a JSON schema's or a header's word block: the schema's from the constant (`src/api/normalize/index.js:1386`), the header's from the file's list (`install.js:205`, `index.js:1226-1233`);
     - save-schema keeps the wrapper it finds, and its fallback writes the constant (`index.js:2045-2066`);
     - apply-enumerations replaces only `jsonSchema`;
     - the b-tag pass re-signs a header with its own tags plus a `b`;
     - none of firmware's 88 element files is a JSON schema or a header.
   - **The item** is what the generator makes (`--check`), and the edit moved no address.
3. **Non-blocking 2 — fixed in part.** The way on now names the set case (`src/operations/catalog/graph/add-to-concept.js:179-188`). Its new sentence is untrue for another case: new non-blocking 1.
4. **Non-blocking 3 — fixed for save-schema.**
   - **FN11** (`test/firmware-nodes-hold-their-concepts-keys.test.js:267-336`) runs the real save-schema in `saveSchemaChild` over a teapot whose schema node's JSON has no word wrapper. It compares the wrapper written with the literal `WANT` (`:55`), not with the module's constant, which FN1 pins.
   - **Mutations,** in the copy of HEAD, at the fallback (`src/api/normalize/index.js:2061`). Unmutated, the suite gives 11 of 11.

     | # | Mutation | Caught by |
     |---|---|---|
     | M11 | round 1's, verbatim: `firmware.JSON_SCHEMA_WORD_TYPES.filter((w) => w !== 'validationTool')` | FN11. schema-save-finds-the-right-header (26 of 26) and story 46's suite (9 of 9) still pass. |
     | M11b | no `wordTypes` at all, the constant's name left in a comment | FN11 |
     | M11c | the old `['word', 'jsonSchema']`, the constant's name in a comment | FN6, FN11 |
   - **The other three writers** stay held by FN6's reading of their source, as the suite's header (`:35-38`) and Amendment 3 say. Skeleton's reason holds: run in the child, it stops at a read over `IS_THE_CORE_GRAPH_FOR`, which the child doesn't serve. Normalize/json's reason doesn't: new non-blocking 2.
5. **Non-blocking 4 — fixed.**
   - **The entry** (`src/api/openapi.yaml:1076-1089`) lists `wordTypes`, with the route's pattern for its items (`src/api/normalize/index.js:1229`), and a 400.
   - **The 400's text** covers both of the route's 400s: "Concept name is required" (`:1221`) and the list's (`:1230`).
   - **Its description** matches the code: after `word` and `conceptHeader`, once each, in order (`:1226-1233`); every JSON schema the route makes holds the constant (`:1386`).
   - **The suites** that read the file pass: openapi-coverage, openapi-document and the 15 above.
6. **Non-blocking 5 — not taken up.** The LF note is still under the Evidence's "Not covered" (`47-wordtypes-hold-each-concepts-key.md:200-201`), now in non-blocking 1's wording, and the Deviations are as they were. AC3's "fresh install" stays for the owner to ratify at this gate, with Deviation 1.
7. **Harness friction 1 — filed,** as `ledger/2026-11-21-scoped-gate-lists-built-by-hand.md`. Its account holds:
   - S2's 500-character window (`test/create-concept-duplicate-check.test.js:69-74`);
   - the 14 suites and 1534 tests (story `:173`);
   - round 1's 28 suites, without that one;
   - story 45's miss, fixed by #165 (`c26da584`, `fix/element-sync-rule-11`). #164, which the older row's pointer names, is story 45's own pull request.

   Its fix shape lacks one point: new non-blocking 4.

### The intake marker, the epic's line and the ledger rows

- **The intake marker** (`engineering-team/stories/_intake.md:3043`) is in workflow 0's form (`engineering-team/workflows/0-intake.md:12`), at the top of its block, as `:2978`'s is.
  - **Not `(partial)`, rightly.** Story 47 settles the entry's three open decisions. The entry's other finding, the set deriver's rewrite, is out of scope as dropping nothing today.
  - **The real reader agrees:** `scripts/lib/collect-intake.sh`'s `intake_entries` lists the entry `retired`. The book folder the marker names exists.
- **The epic's line** (`engineering-team/epics/graph-operations-first-slice.md:106-109`) follows 46's, in the form 44 to 46 use for a story with no Loom task.
- **Story 47's reinstall row** (`ledger/2026-11-20-word-types-keys-await-firmware-reinstall.md`), unchanged since round 1, still holds after the merge. Its command is the form XW1 runs (`test/operations/rules/word-types-agent-through-cli.test.js:160`).
  - Story 46's row, `2026-11-20-word-wordtypes-switch-awaits-firmware-reinstall`, waits on the same reinstalls, and neither row names the other. Optional: name each in the other, as story 46's names rule 9's.
- **The new `meta` row:** above, item 7.
- **The lint:** clean at HEAD (above). `ledger-row-ids`: 6 of 6 in both gates.

### Findings

- **Blocking:** none.
- **Non-blocking:**
  1. **The way on's new sentence is untrue for one of the instance's own nodes whose JSON holds no `wordTypes` list.**
     - **Where:** `src/operations/rules/word-types-hold-concept-keys.js:110`, entry 12's Repair (`docs/GRAPH_RULES.md:186`) and the item (`firmware/versions/v1.0.0/concepts/graph-rule/elements/word-types-hold-concept-keys.json:20`).
     - **What it says:** "graph add-to-concept adds a concept's key to one of the instance's own nodes when it gives the node the concept's section, or puts it in one of the concept's sets".
     - **What the code does:** it adds keys only to a word block that already holds a list (`src/operations/catalog/graph/add-to-concept.js:179`). A node with no word block, or none with `wordTypes`, gets the section and no key.
     - **The probe** (`r2-probe-wayon.js`, `wayon.log`), in the operations harness over `test/helpers/membershipGraph.js`'s seed:
       - Whiskers as seeded, into beagle: `added`, and its list gains `beagle`. Checked after, it is named for nothing.
       - Whiskers with no word block, into beagle: `added`, kept in its json tag, and its JSON still has no word block. Checked before, it is named for `pet`; after, for `pet` and `beagle`.
       - Whiskers with a word block but no `wordTypes` (`add-no-word.log`): `added`, and no key.
     - **Why it matters:** those are the nodes AC2 says lack every key, and the story measured them: 8 on david.tapestry.ninja, 2 on staging, 13 on this Mac. For them the way on's route adds a membership and a finding, and clears none.
     - **It also understates one case.** For a node kept beside, the section's key reaches the view the rule reads, through `F.overlaySections` (`src/operations/catalog/graph/_fields.js:128`), again only when the word block holds a list. In the probe, Snowy, OTHER's, went into pet, kept beside, and was named for nothing after. So "one of the instance's own nodes" is narrower than what happens.
     - **Suggestion,** in all three places, then the generator and its `--check`. Either:
       - drop the clause, leaving "For any other node a repair for this rule is still to come"; or
       - say: "graph add-to-concept adds the concept's key when it gives a node the concept's section or puts it in one of the concept's sets, if the node's JSON holds a wordTypes list (for a node kept beside, the list its view reads), and changes nothing for a node already in the concept, directly in the set given, with the concept's section."

       The second is a claim for the next round to check (rule 10). The probes bear out its parts, except a node kept beside with no list, which I read from the code only.
     - **Best before the pull request,** since the item reaches every instance with the reinstall the row above tracks.
  2. **The FN suite's header and Amendment 3 give a wrong reason for normalize/json.**
     - **Where:** `test/firmware-nodes-hold-their-concepts-keys.test.js:37` and the test plan (`47-wordtypes-hold-each-concepts-key.test-plan.md:181`): "normalize/json sorts with `ORDER BY … DESC`".
     - **What's true:** `handleNormalizeJson` sorts nothing; there is no `ORDER BY` in it (`src/api/normalize/index.js:826-1181`). And the fake parses `DESC` (`test/helpers/pathCypherFake.js:297`).
     - **Why the fake can't run it** (`probe-routes.log`). Run in the child, the route answers 500: "expected ), met DESC". Its header read names a variable `desc` (`index.js:846`), which the fake's tokenizer takes for the keyword. The same read also goes over `IS_THE_CORE_GRAPH_FOR` (`:849`), as skeleton's does.
     - **The conclusion holds:** the fake can't run it, so FN6's reading carries it.
     - **Suggestion,** in the Tester's lane: "normalize/json's header read names a variable `desc`, which the fake reads as the keyword DESC, and reads over `IS_THE_CORE_GRAPH_FOR` too".
  3. **"Nothing reached a container" isn't so. In each of story 47's three gates, `event-tagging-firmware-seed` made two GETs to this Mac's agent-memory instance.**
     - **Where:** the story's Evidence, `:177` ("so nothing reached a container") and `:161` ("every endpoint dead").
     - **What the suite does.** Its check "LIVE: published tagging-with-specific-tag header …" GETs `http://localhost:7778/api/assistant/pubkey` and `/api/strfry/scan`, whatever the environment says (`test/event-tagging-firmware-seed.test.js:137-140`). It skips only when they fail.
     - **What answers there.** On this Mac `:7778` is colima's SSH forward (`ssh: …/.colima/_lima/colima/ssh.sock [mux]`), to the container that ledger row `2026-11-08-suite-screen-misses-hardcoded-urls` names as the agent-memory instance.
     - **What ran.** The suite has 11 tests: 8 read files and 3 are live. All three gates gave it 9 passed, 2 skipped: the Implementer's (`20261120T235304Z-73207-0e2c`), round 1's (`20261121T002100Z-6796-ac63`) and the session's round 2 (`20261121T004946Z-57222-e9ab`).
       - Nothing listens on `:8877`, so the two checks there skip.
       - The ninth pass is the `:7778` check, which passes only when both GETs are answered. Round 1's log shows it (`tmp/review-47/gate47r.log:2010`), and so does the round 2 gate's (excerpt in `tmp/review-47/round2/event-tagging-in-round2-gate.txt`).
     - **Nothing was written:** both are reads.
     - **A correction to round 1.** Its "What it never ran" names "anything that reaches the `tapestry` container". That is wrong for this suite: round 1's gate made the same two GETs.
     - **Suggestion:**
       - correct the two Evidence lines;
       - on this Mac, leave the suite out of scoped gates, or run it in a sandbox that refuses colima's ports, as this round did, until the 2026-11-08 row's fix lands (the suite reading `BRAINSTORM_BASE_URL`);
       - add a dated note to that row: story 47's three gates reached the instance in this way.
  4. **The 37 derived suites leave out 15 registered suites that read a file the fix commit changed.**
     - **What happened.** Amendment 2 derived its list at `14a944e7`. `2a8e8c2b` then changed `src/api/openapi.yaml`, and the session's gate ran the old list on it. Nineteen registered suites read that file; the gate ran four (operations, openapi-coverage, openapi-document and schema-save-finds-the-right-header).
     - **Nothing hid behind it:** this round ran the other 15, and all pass (above).
     - **Where it bears:** the Evidence's "derived from the changed files" (`47-wordtypes-hold-each-concepts-key.md:177`), and the new row's fix shape (`ledger/2026-11-21-scoped-gate-lists-built-by-hand.md:15-18`).
     - **Suggestion:**
       - in the row: derive the list at gate time from the final diff, not once at Test Design, and have the script flag a suite that reads a live URL whatever the environment says (non-blocking 3);
       - in the Evidence: say that this round ran the 15.

### Harness friction
1. **Outside this story: story 37 has no line in the epic's list.** `engineering-team/epics/graph-operations-first-slice.md` goes from 34 (`:79`) to 41 (`:84`). `stories/graph-operations-first-slice/37-seed-firmware.md` and ADR 0037 came with staging (#171), and staging's epic has no line for them either. That's for story 37's next commit, or an OPEN.md row, not for this story.
2. Non-blocking 3 and 4 already have rows: `2026-11-08-suite-screen-misses-hardcoded-urls` and `2026-11-21-scoped-gate-lists-built-by-hand`. Nothing new to file.

### For the owner to ratify at this gate
Round 1's two stand: Deviation 1 (eight `json-schema.json` files reordered), and AC3's "fresh install", carried by the reinstall and the stack-free suites (non-blocking 5).

### On PASS (same commit)
- [ ] **Story `**Status:**` set to `Done`:** left to the session that commits this review, since the brief keeps the Reviewer off the story file. harness-lint's L1 flags a review whose last verdict is a pass while its story isn't Done. So with this round on disk and the story still `Approved`, harness-lint reports one violation, L1 on the story. Setting the status in the same commit clears it.
- [ ] **Completion detection:** its result goes in the chat, not this file.

### Verdict
- Blocking 1 is fixed: S2 finds `overwrite: true` where it did on the base, and the suite passes as CI runs it.
- Of round 1's five non-blocking findings, three are fixed and one is fixed in part. One, LF's place in the story, was left for the owner. Harness friction 1 is on file.
- FN11 catches round 1's M11, which no suite caught, and two variants of it.
- The merge is git's own, and story 47's patch and story 46's three pieces are whole.
- Four new non-blocking findings, all in prose:
  - the way on, for nodes with no list;
  - a wrong reason in a test comment;
  - the Evidence's "nothing reached a container";
  - a gate list that went stale within the round.

  None changes what the code does.
- The gates pass: `20261121T011021Z-1774-52f7` (30 suites) and `20261121T011436Z-19783-2946` (3), with `20261121T004946Z-57222-e9ab` (44) read from its record.

**PASS**

## Round 2 fix check — 2026-11-20 (HEAD `2b5a9675`, not a round)

The coordinator asked for a check of the four commits after round 2's review commit (`c3ac38fe`, which also set the story `Done`). They fix round 2's four non-blocking findings: 9 files, +45 −11.
- `a2e113b8`, the Tester's lane: the FN suite's header and test plan Amendment 3.
- `0b22a841`, the Architect's: ADR 0047 Amendment 1, not yet ratified.
- `f860d1b5`, the Implementer's: the way on, entry 12, the item, the story's Deviation and Evidence, and two ledger rows.
- `2b5a9675`: the story's Evidence for the session's check of these fixes.

I re-derived each changed statement (rule 10), my round 2 wording included. The same agent made this check as round 2, within the same limits. Its scripts and logs are in the ignored `tmp/review-47/round2-fixcheck/`. Its probe ran in a `git archive` copy of `2b5a9675`.

### Gates
- [~] **My gate,** 26 suites, through `safe-run-ci.sh` inside round 2's sandbox. Its ports were regenerated from colima's forwards (the same 18) and tested again:

  ```
  20261121T020358Z-62464-47fe [story-47-round2-fixcheck] started 2026-11-21T02:03:58.046Z on 2b5a9675 — FAIL, exit 1, 596 passed, 3 failed, 16 skipped, 26/26 suites; failed: external-cli · /Users/wds4/repos/TapestryProtocol/tapestry/.claude/worktrees/magical-jepsen-43e8c5/tmp/gate-runs/20261121T020358Z-62464-47fe.json
  ```

  - **The three failures are the sandbox's.** The test signer of I5, I6 and I16 runs `ps` (`test/external-cli.test.js:332`), and the sandbox refuses it: "bin/sh: /bin/ps: Operation not permitted".
  - **`external-cli` alone, outside the sandbox.** It reaches only servers it starts on ephemeral loopback ports.

    ```
    20261121T020722Z-30541-47a7 [story-47-round2-fixcheck-extcli] started 2026-11-21T02:07:22.918Z on 2b5a9675 — PASS, exit 0, 53 passed, 0 failed, 0 skipped, 1/1 suites · /Users/wds4/repos/TapestryProtocol/tapestry/.claude/worktrees/magical-jepsen-43e8c5/tmp/gate-runs/20261121T020722Z-30541-47a7.json
    ```
  - **The rest pass:**
    - the five rule suites, by name: 10, 10, 1, 11 and 16, as before;
    - `gate-result-record`: 34 (below);
    - the 20 suites the session's check also ran, each with its counts there.
  - **Round 2's own claim still holds.** Neither of its logs holds a refusal, as text or as a byte list. Each of its skips is a live test with no stack.
- [x] **The session's check,** read from its record:

  ```
  20261121T014937Z-70585-f248 [story-47-round2-fixes] started 2026-11-21T01:49:37.281Z on 0b22a841+dirty — PASS, exit 0, 1844 passed, 0 failed, 26 skipped, 21/21 suites · /Users/wds4/repos/TapestryProtocol/tapestry/.claude/worktrees/magical-jepsen-43e8c5/tmp/gate-runs/20261121T014937Z-70585-f248.json
  ```

  The record counts six dirty paths, as many as the files `f860d1b5` changed, and holds no contents. So its "committed unchanged" rests on my run on `2b5a9675`: the 20 suites both ran give the same counts, and in place of its `operations.test.js` I ran the five rule suites, which give theirs as before.
- [x] `node src/firmware/graph-rules.js --check`: the 12 items are current. **harness-lint** at `2b5a9675`: `harness-lint: clean (0 violations)`.

### The four fixes
1. **Non-blocking 1 — fixed,** by Amendment 1's first option.
   - **The way on.** `WAY_ON` (`src/operations/rules/word-types-hold-concept-keys.js:111`) is item 1's sentence, word for word. Entry 12's Repair (`docs/GRAPH_RULES.md:186`) and the item (`firmware/versions/v1.0.0/concepts/graph-rule/elements/word-types-hold-concept-keys.json:20`) drop the clause, and `--check` passes. Both sentences left are true: a reinstall gives firmware's nodes their keys (round 1's LA), and the findings carry `fix: null`.
   - **Item 2's new wording holds.** "It only reports, as the owner chose (2026-11-20)" (`docs/GRAPH_RULES.md:184`, the item's `:18`) is the story's Out of scope (`:120`).
   - **Item 3.** Its 8, 2 and 13 are the story's measurement, "JSON with no word block" (`:41`; production 0), which round 2 cited. Add-to-concept clears none of them (round 2's probe). Its list of what decides whether add-to-concept adds a key leaves out one thing: whether the node already holds the concept's section. With no set given, that alone decides (the third case of the probe below). Optional.
   - **Item 4:** new non-blocking 3. **The `why` it leaves:** new non-blocking 1.
2. **Non-blocking 2 — fixed.** The header (`test/firmware-nodes-hold-their-concepts-keys.test.js:35-38`) and Amendment 3 (`47-wordtypes-hold-each-concepts-key.test-plan.md:181`) give the variable `desc`, read as the keyword, and the read over `IS_THE_CORE_GRAPH_FOR`, as round 2's probe showed (`tmp/review-47/round2/probe-routes.log`). The test file's diff is two comment lines.
3. **Non-blocking 3 — fixed in the story, with one slip in the ledger.**
   - The story's `:162`, `:167` and `:180` now say what reached the agent-memory instance, and that nothing was written. "Review round 1's gate … did the same" holds (`tmp/review-47/gate47r.log:2010`).
   - The 2026-11-08 row's note (`ledger/2026-11-08-suite-screen-misses-hardcoded-urls.md:21`): its three run ids, two GETs and two skips hold. Its "That round ran the suite in a sandbox" doesn't: new non-blocking 2.
   - The meta row's "in all three of story 47's gates" (`ledger/2026-11-21-scoped-gate-lists-built-by-hand.md:18`) still holds, since the session's check left the suite out.
4. **Non-blocking 4 — fixed.** The story's "What the list missed" (`:183`) and the meta row's new bullet (`:17`) match round 2's account: derived at `14a944e7`, `openapi.yaml` changed at `2a8e8c2b`, 15 more readers, 613 passed and 5 skipped.

### The session's derivation, and the Background
- **One miss.** The session's `derive.js` has no needle for a suite that scans every test file, and this round changed a test file.
  - `gate-result-record` reads every `test/*.test.js` for banned patterns (`test/gate-result-record.test.js:412-416`). My gate ran it: 34 passed.
  - `stack-free-npm-test` scans the folder too, for registration only, and is CI's.
  - Optional, for the meta row: a changed test file brings in the suites that scan every test file.
- **Nothing else was missed.** My wider derivation (`derive-r4.js`, `derive-r4.out`) found 28 more registered suites that name `docs/`, `engineering-team/` or ledger paths. Each reads another file (its own ADR, `docs/CONFIGURATION.md` and the like) or fixtures.
- **"None of them reads a live URL whatever the environment says" holds.** One caveat:
  - with `TAPESTRY_CONTAINER` unset, `firmware-concept-elements-sets` falls back to the container `tapestry` (`test/firmware-concept-elements-sets.test.js:46`, `test/helpers/stackHttp.js:19`);
  - its live tests write fixtures once its probe answers (`:267-271`);
  - its four skips, in both gates, are the docker stub's doing.

  That class is ledger row `2026-11-13-live-suites-have-no-off-switch`'s. Nothing new to file.
- **The Background** (`:15-17`). Leaving it as planning wrote it, with the Deviation, is right: it is the planning record. But the Out of scope says the same (`:120`, "The writes already put the key in"), and the Deviation (`:158`) names only the Background. Optional: name `:120` too.

### Findings
- **Blocking:** none.
- **Non-blocking:**
  1. **The finding's `why` is untrue now that it stands alone.**
     - **Where:** "It only reports: no operation gives a node a key it lacks yet" (`src/operations/rules/word-types-hold-concept-keys.js:109`). It carries out Decision 4's `choice.why` (ADR `:186`), and Amendment 1 leaves both.
     - **The probe** (`r4-probe-why.js`, `why.log`), over the membership seed:
       - Whiskers, one of the instance's own pets, has `pet` taken out of its `wordTypes`, so the rule names it for `pet`, with that `why`;
       - `graph add-to-concept` into pet with `walkers` or `lapPets`, sets of pet's it isn't directly in: `added`, its list gains `pet`, and the rule names nothing;
       - with no set: `already-element`, and nothing changes.
     - **Amendment 1's item 3 says as much:** "Whether add-to-concept adds a key turns on the node's JSON".
     - **There since round 1.** Rounds 1 and 2 missed it. While the way on named add-to-concept, it read as an exception; now nothing qualifies it.
     - **Suggestion,** in Amendment 1, which isn't ratified yet, and in the code: "It only reports, and no repair for this rule exists yet". That is a claim for the next check (rule 10).
  2. **The 2026-11-08 row's note says round 2 "ran the suite in a sandbox that refuses colima's ports"** (`ledger/2026-11-08-suite-screen-misses-hardcoded-urls.md:21`).
     - It didn't. Round 2 left `event-tagging-firmware-seed` out, and ran its other suites in that sandbox.
     - My round 2 wording, "or run it in a sandbox …, as this round did", invited the misreading.
     - **Suggestion:** "That round left the suite out, and ran its other suites in a sandbox that refuses colima's ports."
  3. **Amendment 1's item 4 overstates two of its four tests** (ADR `:333`).
     - WT4 (`test/operations/rules/word-types-hold-concept-keys.test.js:176`) and WC2 (`test/operations/rules/word-types-check-and-repair.test.js:126`) hold that the way on names a reinstall.
     - WC7 (`:197`) holds only that repair passes check's way on through. XW1 (`test/operations/rules/word-types-agent-through-cli.test.js:168`) holds only that the left finding has one.
     - WT8 (`:243`), which item 4 doesn't name, holds it for entry 12's Repair.
     - All pass. **Suggestion:** name what each holds.

### Verdict
- The four fixes are in:
  - non-blocking 2 and 4 fully;
  - non-blocking 1 by Amendment 1's first option;
  - non-blocking 3 in the story, with one slip in its ledger note.
- Three new non-blocking findings, all in prose: the `why` that now stands alone, the ledger note, and Amendment 1's item 4.
- My gate on `2b5a9675` passes but for `external-cli`'s three sandbox-made failures, and `external-cli` passes alone outside it. The session's check gives the same counts.

**PASS**

## Fix check, second pass — 2026-11-20 (HEAD `7aa3efa5`, not a round)

The coordinator asked for a check of the three commits after the fix check's commit (`1b2f8aff`). They fix its three findings and take two of its optional points: 5 files, +14 −6.
- `11cfd74c`, the Architect's: Amendment 1 gains item 5, the `why`, and items 3 and 4 are corrected. It is still unratified.
- `2af10578`, the Implementer's: the `why`, the ledger note, the story's Deviation and Evidence, and the meta row.
- `7aa3efa5`: the story's Evidence for the session's run on `2af10578`.

I re-derived each changed statement (rule 10), my suggested wording included. The records are in the ignored `tmp/review-47/fixcheck2/`, and the probe ran in a `git archive` copy of `7aa3efa5`.

### Gates
- [x] **My gate,** 20 suites, sandboxed as before. They are the suites that read what changed, the rule suites by name and CI's entries but `external-cli`:

  ```
  20261121T022224Z-32853-5ac4 [story-47-fixcheck2] started 2026-11-21T02:22:24.367Z on 7aa3efa5 — PASS, exit 0, 408 passed, 0 failed, 9 skipped, 20/20 suites · /Users/wds4/repos/TapestryProtocol/tapestry/.claude/worktrees/magical-jepsen-43e8c5/tmp/gate-runs/20261121T022224Z-32853-5ac4.json
  ```
- [x] **`external-cli` alone, outside the sandbox** (its test signer runs `ps`):

  ```
  20261121T022440Z-94781-e11d [story-47-fixcheck2-extcli] started 2026-11-21T02:24:40.840Z on 7aa3efa5 — PASS, exit 0, 53 passed, 0 failed, 0 skipped, 1/1 suites · /Users/wds4/repos/TapestryProtocol/tapestry/.claude/worktrees/magical-jepsen-43e8c5/tmp/gate-runs/20261121T022440Z-94781-e11d.json
  ```
- [x] **The session's run,** read from its record:

  ```
  20261121T021233Z-47671-708f [story-47-fixcheck-fixes] started 2026-11-21T02:12:33.258Z on 2af10578 — PASS, exit 0, 1844 passed, 0 failed, 26 skipped, 21/21 suites · /Users/wds4/repos/TapestryProtocol/tapestry/.claude/worktrees/magical-jepsen-43e8c5/tmp/gate-runs/20261121T021233Z-47671-708f.json
  ```

  Its tree was clean, and it ran the same 21 suites, with the same counts, as `…f248`. HEAD differs from `2af10578` only in the story's four Evidence lines. Every suite both of us ran gives the same counts.
- [x] `node src/firmware/graph-rules.js --check`: current. **harness-lint** at `7aa3efa5`: `harness-lint: clean (0 violations)`.

### The fixes
1. **The `why` — fixed.**
   - `WHY` (`src/operations/rules/word-types-hold-concept-keys.js:109`) is item 5's sentence. It is true: `rules repair` gives this rule's findings `fix: null` and leaves them, and nothing else repairs them.
   - Item 5's account is the fix check's probe (`tmp/review-47/round2-fixcheck/why.log`), and its quote of Decision 4 is ADR `:186`'s.
   - The old words survive only in the ADR's history (Decision 4, `:186-187`, quoted by items 1 and 5) and in the Deviation that records the change.
   - The tests that read the `why` hold only that it is a non-empty string (WT4, WC2) or that repair passes it on (WC7). They pass.
2. **The ledger note — fixed.** It now reads my suggested sentence (`ledger/2026-11-08-suite-screen-misses-hardcoded-urls.md:21`), and it holds: round 2 left `event-tagging-firmware-seed` out, and ran its gates in the sandbox. One of those suites, `create-concept-duplicate-check`, also ran once outside it, before the sandbox was built; its live tests return before any request.
3. **Item 4 — fixed.** It now says what each test holds, as the fix check found. Its id claim is `idOf`'s: code, node, parents, key and concepts (`src/operations/catalog/rules/_rules.js:120-128`).
4. **The optional points — taken:**
   - item 3's list gains the section;
   - the Deviation names the Out of scope's `:120`;
   - the meta row gains the scan-every-test-file bullet (`ledger/2026-11-21-scoped-gate-lists-built-by-hand.md:17`);
   - the Evidence records the caveat and the miss (story `:193-194`).

### Findings
- **Blocking:** none.
- **Non-blocking:**
  1. **The Deviation's example is untrue for a node kept beside** (story `:158`): "add-to-concept can, as when it puts a node whose JSON holds a `wordTypes` list into one of the concept's sets that it isn't directly in".
     - **The probe** (`r5-probe-beside.js`, `beside.log`). Two nodes hold beagle's section and a list with `beagle` taken out, so the rule names each for `beagle`. Each goes into `scrollShelf`, a set of beagle's that neither is directly in:
       - `setItem`, the assistant's own, kept in its json tag: `added`, its list gains `beagle` (and `scroll`), and the rule names nothing after;
       - `peerInSet`, OTHER's, kept beside: `added`, with only `membership-added`. It is still named for `beagle`, and now for `scroll` too.
     - **The code.** `wordTypes` gains keys only for a node kept in its json tag (`src/operations/catalog/graph/add-to-concept.js:176-190`). A node kept beside gets only a section, and only when one is written (`:167`, `:191-192`). Its view gains a key only from a section kept beside (`src/operations/catalog/graph/_fields.js:129`).
     - **Suggestion:** "as when it puts one of the instance's own nodes, whose JSON holds a `wordTypes` list, into one of the concept's sets that it isn't directly in". The probe's `setItem` bears that out.
  2. **The new Evidence paragraph sits inside the one before it** (story `:196-198`).
     - It was put after the earlier check's "What it missed" bullet, and before that check's own "Results:" (`:200-203`).
     - So the earlier check's Overall line, with record `…f248.json`, now reads as the new check's. The new check's heading already has its own (`…708f.json`).
     - **Suggestion:** move `:196-198` to after `:203`.

### Verdict
- The fix check's three findings are fixed, and two of its optional points are taken.
- Two new non-blocking slips in the story's prose:
  - the Deviation's example, true for the instance's own nodes and not for one kept beside;
  - a paragraph in the wrong place.

  Neither changes what the code does.
- My gate and `external-cli` pass on `7aa3efa5`, and the session's run gives the same counts.

**PASS**
