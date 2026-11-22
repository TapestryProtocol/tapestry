# Review: Story 39 — A firmware install leaves each header's tags once

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-21
**Diff:** `git diff 98c14108e...b0a83181a` (branch `fix/header-tags-once`; `98c14108e` is where it left `origin/staging`). Also checked merged with today's `origin/staging`, `25078cf9c`: `git merge-tree --write-tree origin/staging HEAD` gives tree `cae8351a`, with no conflicts.
**Round:** 1

## Quality gates (run by reviewer, not trusted)

Never the full `npm test` on this Mac (its local container is the owner's agent-memory instance). Each run below used the test plan's environment: stub `curl` and `docker` first on `PATH`, a dead conf, every endpoint a closed port, `TAPESTRY_CONTAINER` unset.

- [x] **The branch, at `b0a83181a`:** the Implementer's 27 suites (story #39's Evidence), run again on the clean head:
  `20261121T164355Z-7000-74de [header-tags-once-39-review-branch] started 2026-11-21T16:43:55.609Z on b0a83181 — PASS, exit 0, 1727 passed, 0 failed, 85 skipped, 27/27 suites`. The skips are live parts, which need a stack.
- [x] **The merged tree** (`cae8351a`, unpacked in scratch; the branch untouched): 14 suites, the story's 2, the 4 that pin the community-references step, `community-class-thread-pull`, and seed-firmware's 7 lifecycle suites, which read `install.js`:
  `20261121T164117Z-95151-6c3a [header-tags-once-39-review-merged] started 2026-11-21T16:41:17.547Z on an unknown commit — FAIL, exit 1, 166 passed, 1 failed, 4 skipped, 14/14 suites; failed: seed-firmware-target`. It reads "an unknown commit" because it ran on an unpacked archive of that tree. The one failure is ST33 (Blocking 1).
- [ ] `npm run test:playwright`: not applicable.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test, on the branch: AC-1 S1–S3, E2, P1–P2; AC-2 S4–S5, P4–P6; AC-3 S6–S8; AC-4 S9–S10, E1.
- [ ] No criterion is silently dropped. True of the branch. But merged with staging, AC-3 doesn't hold for staging's second installer: seed-firmware's target still gives a self-curated header the `b` that today's install no longer writes (Blocking 1).
- [x] No behavior added that isn't in the story.

## ADR adherence
- [x] Files changed match ADR 0035's Implementation notes: `buildPruneCypher` and the shared `tagUuidOf` in `src/api/neo4j/eventSync.js` (§1); the import, the loop-removal helper beside `runCypherApi`, the self-curation skip before the dry-run `continue`, and a prune after each of the step's four imports in `src/firmware/install.js` (§2).
- [x] Layering: the builder stays a pure function beside `buildImportCypher`; the step calls it through `executeCypher`, and the loop removal goes through `runCypherApi` with parameters.
- [x] No new dependencies.
- [ ] The ADR predates staging's `lifecycle seed-firmware` (graph-operations-first-slice #37, ADR 0037), whose `src/firmware/target.js` rebuilds `pass_communityReferences`, and whose ST33 pins it. It doesn't cover them (Blocking 1).

## Concept-graph integrity
- [x] Handles stay `kind:pubkey:slug`. The self-curation check compares the manifest's curator with `firmware.getTAPubkey()`, read at run time; no pubkey literal. S1 (a made-up assistant seeds nostr-relay) against S6–S8 (nostr-relay's curator skips it) shows it.
- [x] No concept definition changes. Each instance heals at its next firmware install, the book's rollout, each on the owner's yes.
- [x] Nothing re-derived from BIBLE.md.

## Things tests can't catch
- [x] No secrets in committed files.
- [x] No leftover debug logging: the new lines are the step's own log style.
- [x] No commented-out code.
- [x] Error paths: each prune runs in an `executeCypher` call of its own, after its import has resolved, inside the step's existing graceful `try` (E3 pins the order). The loop removal sits inside the per-concept `try`.
- [x] Concurrency: unchanged. OPEN.md row `2026-11-21-todays-install-races-seed-firmware` stands.
- [x] Security: every value in the prune's Cypher text goes through `esc()` (P9). The loop removal is parameterized.
- [x] Neo4j 5.26.10 (`Dockerfile:41`): the tag statement's `COUNT { … }` is the shape of import nostr's `TAGS_DROP` (`src/operations/catalog/import/_letters.js:311-317`), which staging and production run.
- [x] BIBLE §30: the prune deletes only tag nodes and `b`-derived relationships (P8). An own header's `b`-derived relationships stay (P7, E5), and no node at a relationship's end is touched.

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.

## Product-guide adherence *(when the story traces to a PRD)*
- Not applicable: no PRD.

## Findings

### Blocking
1. **`src/firmware/install.js:1093-1268` (`pass_communityReferences`), against staging's `src/firmware/target.js:478-489` and `test/operations/lifecycle/seed-firmware-target.test.js:477-504` (ST33).** The branch merges into staging cleanly but fails ST33 there. Since the branch left staging, staging gained `lifecycle seed-firmware` (graph-operations-first-slice #37). Its `target.js` rebuilds what today's install leaves (ADR 0037 Decision 4): every header with a community reference gets the pointer `b` and its `REFERENCES {source:'b-tag'}` claim. ST33 pins `pass_communityReferences` by digest, so that a change there brings `target.js` in line.
   - **What follows on the merged tree:**
     - ST33 fails, so the pull request into `staging` would be red in CI:
       ```
       today's install changed: src/firmware/install.js's pass_communityReferences (now 3d1ff06f7c6551fd9774a005a3ce650b15012b9a052f6e2f278c6dbc057d377d). src/firmware/target.js rebuilds these passes (ADR 0037 Decision 4, Amendment 3 item 8): bring it in line with the change, then update the digest in this test
       ```
     - `target.js` still gives a reference the instance curates itself a `b` naming its own header and a `REFERENCES` to itself. Run on the merged tree under production's assistant, `buildTarget` gives nostr-relay's header `["b","39998:919ba08a…:nostr-relay","pointer"]`, a `REFERENCES {source:'b-tag'}` to itself, and its own address in `references`. So on production, `lifecycle seed-firmware` would either put back what the install now removes, or report the healed header as changed.
     - `test/helpers/todaysFirmwareRoutes.js:415-428`, seed-firmware's oracle, copies the old seed line by line too.
     - None of seed-firmware's suites notices but ST33: they run under the made-up assistant `dd…dd` (`test/helpers/graphOpsSuite.js:30`), which curates no reference.
   - **What doesn't need changing there:** the tags-once and copies parts. `target.js` already gives each header its tags once, and it fetches no curator's letters (ADR 0037: "The curator's letters aren't fetched").
   - **Asked change.** This reaches past ADR 0035, so it starts with the Architect:
     1. merge `origin/staging` into `fix/header-tags-once`;
     2. amend ADR 0035 for the second installer, ratified at its gate: `target.js` and the oracle skip a reference whose curator is the target's assistant (no pointer `b`, no claim, no `references` entry), as Decision 3 does for today's install. Its Implementation notes' "Nothing else changes" (`:180`) then names them;
     3. a test that pins it, such as `buildTarget` with `ta` set to nostr-relay's curator, with the oracle agreeing;
     4. then update ST33's `pass_communityReferences` digest, as its procedure says;
     5. the next round's gate runs on the merged branch, with seed-firmware's suites in its list. `operations.test.js` there needs staging's new dependency `micromark` installed, a download that waits on the owner's OK; until then its suites run one by one, leaving out `export/`'s.

2. **`src/firmware/install.js:1167-1169` and `:1176-1179`: a failed prune turns the header's `b`-derived relationship into the legacy stub.**
   - **The mechanism.** On both the "already has a `b`" path and the seed path, `seededB = true` comes after the prune. If the prune, or the "already has a `b`" path's import, throws:
     - the catch logs "b seed failed" (`:1184`), though the letter carries the `b`;
     - the pending entry goes to the wiring with `seededB` false;
     - the wiring's `MERGE (a)-[r:REFERENCES]->(b)` has no property map, so it matches the `b`-derived relationship, and `SET r.source = 'firmware-community'` rewrites its source (`:1391-1392`).
   - **The result.** Until the next good install, the header's only `REFERENCES` is the stub Story 38 retired. AC-1's `REFERENCES {source:'b-tag'}` is gone, and its tags stay doubled.
   - **Why it's new.** Before this change, the "already has a `b`" path made no database call, and on the seed path nothing ran between a good import and `seededB = true`.
   - **Evidence.** Read from the source here. The independent check reproduced it with a child that fails only `tag`'s prune, on both paths. That check rated it non-blocking; it's blocking here because it writes a wrong relationship on the failure path ADR 0035 says stays graceful ("a failed prune is logged, and the install carries on").
   - **Asked change.** `seededB` records whether the header's letter carries the `b`, whether or not the import or prune after it succeeds: give each prune (and that path's import) a `try` of its own, or set `seededB` once the header carries the `b`. The amendment above says which, since §2 prescribes today's order. A test fails one prune and expects the `b-tag` relationship to stay.

### Non-blocking
1. **`src/firmware/install.js:1167-1168`: the "already has a `b`" path imports an own header's letter from strfry back over the node, with no check that the node holds nothing newer.**
   - **The rule elsewhere.** Staging's export rule, `holdsLetterOrNewer` (graph-operations-first-slice ADR 0034 Decision 10), turns that away in three importers: `src/api/io.js`, `handleEventUpdate` and `src/api/strfry/tapestryBrainWrite.js`. Not in every importer, as the independent check put it.
   - **The risk is narrow.** Pass 1 rewrites every header on a default install, so it needs an install with `pass1: false` (the route's pass-2-only run) after something has left the graph ahead of strfry.
   - **Optional.** The amendment says why this path is exempt, or the path skips its import (not its prune) when the node holds a newer letter.
2. **`BIBLE.md:1747` (§22, "Status today") still says the step seeds every reference.** It doesn't mention the skip for a self-curated reference, or the import-then-prune. Optional, and natural in this round: a sentence on each.
3. **The fixture and the rollout disagree on which instance heals first.**
   - **The fixture.** `stagingToday`'s comment (`test/firmware-install-leaves-tags-once.test.js:131`) says production heals first by "ADR 0035's rollout order".
   - **The ADR.** §5 (`:228`) reinstalls staging first, and its Consequences (`:125`) say a copy keeps production's loop until its first install after production's.
   - **What it means for staging.** Staging's first reinstall will leave its copy of production's header with its `REFERENCES` to itself. That is AC-2 as amended, since the version it holds derives it.
   - **Optional.** Correct the comment, and have §5's staging check expect that loop until staging's next install after production's.
4. **S0 checks less than the test plan says** (`test/firmware-install-leaves-tags-once.test.js:305-308`). It asserts that nostr-relay's reference and at least one other exist, not the six the story names. `test/b-tag-primitive.test.js`'s AC-8 already pins the six, so either is fine: tighten S0, or reword the plan's line.
5. **The prune's Cypher has run only on `test/helpers/cypherEngine.js`.** Its tag statement is the shape of import nostr's `TAGS_DROP`, which runs on staging and production, and its two edge statements are plain Cypher. So the remaining check is the book's staging reinstall (ADR 0035, OQ-4), and once Blocking 2 is fixed, a prune that fails there leaves the duplicates, not a wrong relationship. A scratch-stack run first is optional.

### Harness friction
1. **Another instance of OPEN.md row `2026-11-13-review-has-no-origin-drift-check`, with a new wrinkle.** ADR 0035 was written at `98c14108e`. During the cycle, staging gained the code that rebuilds and pins the function this story changes. No phase after Planning looked at staging again, and the trial merge showed no conflict: only running the merged tree's suites found it. A dated note is added to that row; no new row.

## Independent check
Applied (workflow 5, "Optional: an independent check before the commit"). A read-only checker, given the code, the story, the ADR and the test plan but not these findings, audited the diff on the branch and on the merged tree.
- **It found Blocking 1 on its own,** and added the ADR's `:180` line to it.
- **It raised six non-blocking points.** Each was checked against the sources here:
  - one is Blocking 2;
  - four are Non-blocking 1–4, with Non-blocking 1 narrowed;
  - the sixth is Non-blocking 5, weighed against `TAGS_DROP`.
- **Its gate account matches the runs above.** On the merged copy, `export/nostr-own` gave 2 of 4, for want of staging's new dependency `micromark`, which this worktree's `node_modules` lacks: an environment gap, not this change's. So `operations.test.js` can't run whole on a merged copy here until `micromark` is installed, which means downloading it from npm.

## Verdict
**CHANGES_REQUESTED.**
- **Blocking 1:** the change has to land with seed-firmware's target, its oracle and its tripwire brought in line, which reaches past ADR 0035.
- **Blocking 2:** a failed prune must not turn the header's `b` relationship into the legacy stub.

---

## Round 2

**Date:** 2026-11-21
**Diff:** `git diff 1513bdbb2..213db6fe9`, eleven commits:
- the merge of `origin/staging` (`7b7f5d1e2`). Staging is still `25078cf9c`, by `git ls-remote` at this round's end;
- ADR 0035 Amendment 1 (`30c0c6a74`), revised before ratification (`2ccbb0561`);
- the tests (`96032fdec`, `983c24288`);
- the fixes (`d6aeff776`, `ea5d6eefd`);
- ST33's digest (`22c9c737d`, `f344f1a92`);
- the docs the independent check's re-checks asked for (`986331bc9`, `213db6fe9`).

### Quality gates (run by reviewer, not trusted)

All in the test plan's environment, on the merged branch.
- [x] **The scoped gate at `f344f1a92`:** 92 suites, derived from `git diff origin/staging...HEAD`. It holds every registered suite, and every suite under `test/operations/`, whose code (comments aside) names a changed file or requires a helper that does:
  `20261121T180907Z-86999-f4a0 [header-tags-once-39-round2-final] started 2026-11-21T18:09:07.933Z on f344f1a9 — FAIL, exit 1, 2126 passed, 3 failed, 132 skipped, 92/92 suites; failed: router-stream-limit-on-connect`.
  - **The three failures** are that suite's P1–P3. They fail on every macOS gate, because the router patch uses GNU `sed -i` (OPEN.md row `2026-10-09-router-patch-sed-macos`). Staging's own tree, `git archive origin/staging` unpacked here, fails the same three, with the wrapper and without it. Every other suite passed. The skips are live parts, which need a stack.
  - **Left out:**
    - `test/operations/export/`, which needs staging's new dependency `micromark`, a download;
    - `event-tagging-firmware-seed`, which calls the local control panel;
    - `stack-free-npm-test`, which stays CI's.
- [x] **After the docs commits:** the suites whose code reads `BIBLE.md`, `ledger/` or `engineering-team/`:
  `20261121T181751Z-87583-892b [header-tags-once-39-docs] started 2026-11-21T18:17:51.051Z on 986331bc — FAIL, exit 1, 1639 passed, 3 failed, 57 skipped, 52/52 suites; failed: router-stream-limit-on-connect`. Its failures are the same macOS three. The last docs commit, `213db6fe9`, changed one ledger line after this run; `ledger-row-ids` passes over it, 6 of 6, and `harness-lint` is clean.
- **Two runs that aren't verdicts:**
  - `20261121T173632Z-81394-2356`, the same gate before the independent check's findings: FAIL, with the same three macOS failures, and 2023 passed across 86 suites;
  - `20261121T180622Z-5312-4915`, killed by the tool's two-minute limit on a foreground command, UNFINISHED after 19 of 92.

### Round 1's findings, checked again as fresh claims

| Finding | What changed | Checked by |
|---|---|---|
| Blocking 1 | Staging merged in. `src/firmware/target.js` and its oracle, `test/helpers/todaysFirmwareRoutes.js`, skip a reference the target's assistant curates; so does graph sets' `firmwareLinks` (`_sets.js` part d, Amendment 1 item 8). ST33's digest follows. ADRs graph-operations-first-slice/0028 and 0037 gain Amended-by pointers. | S11, S12 and S13 pass, and `seed-firmware-target` gives 34 of 34. Under production's assistant, `buildTarget` gives `nostr-relay`'s header no `b`, no relationship to itself and no `references` entry, and the oracle signs no `b`. Taking each skip out fails its test (guard checks G1, G2 and G7). |
| Blocking 2 | `seededB` is set at once on the "already has a `b`" path. On the seed path it's set once the publish answers `success: true`. The catch says which part failed. | E6 to E10 pass. Taking out each placement, or the publish check, fails its test (G3 to G6, and the check's own mutations). |
| Non-blocking 1 | The path stays exempt (Amendment 1 item 3, revised). BIBLE §7 gains the consequence. | See below: the first reasons given were wrong. |
| Non-blocking 2 | BIBLE §22's passage and the Last updated entry. | Read against the code. The suites that read the Last updated line pass. |
| Non-blocking 3 | The fixture's comment, and Amendment 1 item 5. | Read. |
| Non-blocking 4 | S0 checks the six references. | S0 passes. A manifest without `tag-pinning`'s reference fails it (the check's mutation). |
| Non-blocking 5 | No change. | — |
| Harness friction | A dated note on ledger row `2026-11-13-review-has-no-origin-drift-check`. | — |

### What the independent check found this round

It was applied three times: to the round's first four commits, then to the next four, then to the docs commits. Each finding was checked against the sources here before it was acted on.

- **Amendment 1 item 3 misstated two of its sources** (its round-2 Blocking 1).
  - It said the export rule guards an own node only against letters come back from a relay. But `handleEventUpdate` reads the instance's own strfry, through `findInStrfry` and `strfry scan`, and ADR 0034 Decision 10 gives that route the check.
  - It said BIBLE §7 covers a `pass1: false` install. §7 covers the boot install, which posts `{}`, so Pass 1 runs.
  - **Revised:** the exemption now rests on the one sound reason. The rule can't tell this path's normal case from the one it guards: in both, the node holds strfry's letter (ADR 0037, Context 4). And the revision names its cost as a new consequence for the owner to accept. BIBLE §7 says so.
- **Round 1's own suggested wording was wrong** (reviewer.md, step 10). Non-blocking 1's optional ask was to skip the import, not the prune, when the node holds a newer letter. That would prune against the older letter: on the engine, the newer letter's 8 tag nodes went to 0. Amendment 1 item 3 records it and doesn't adopt it.
- **A publish answered 200 with `success: false` was counted as stored** (its non-blocking 1). `apiPost` throws only on a failed status with no `success`. The seed path now checks the answer itself (E10).
- **Two placements of `seededB` were untested** (its non-blocking 2). E9 and E10 pin them.
- **Smaller points:** the fixture comment's wording; the third copy of the step's logic, in `_sets.js`; and ADR 0037's pointer. The re-checks then found:
  - two wording slips in the new BIBLE text;
  - the open ledger row this story fixes, `2026-11-16-curator-instance-superset-self-loop`, and ADR 0028 as the home of part (d);
  - that row's closing condition, which left out the Mac Studio's local instance.

  Each is fixed. The last re-check found nothing wrong.
- **What round 1 missed.** Planning didn't find ledger row `2026-11-16-curator-instance-superset-self-loop`, which already recorded this story's superset loop. It now has a dated note, and closes when production's reinstall takes the loop out.

### Findings

#### Blocking
None.

#### Non-blocking
None open. Each of round 1's, and each the independent check raised this round, is fixed above.

#### Harness friction
1. **Planning missed an open ledger row about the same fault.** `2026-11-16-curator-instance-superset-self-loop` recorded this story's superset loop five days earlier. The story's planning scanned the intake and the importers' row, but not the ledger for its own fault. A step in workflow 1 that greps `ledger/` for the story's key nouns before drafting would have found it. This is a lesson for the next planning, too small for a row of its own; noted here.

### Verdict
**PASS.** Both blocking findings and all five non-blocking ones are fixed, each with a test where it is code. The gate's only failures are the known macOS ones. The independent check's three passes leave nothing open.

### On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [ ] Completion detection: reported in the chat, not here.

## The feat/tags port (2026-11-22, ADR 0035 §4)

**What was reviewed.** `port/header-tags-once-tags`, cut from `feat/tags` at `25d39636`: the failing tests at `67872714` and the port at `de43928d`. It was checked against the story, ADR 0035 (§4 and Amendment 1) and the test plan's section "The feat/tags port". An independent check read the same diff, given the code and the questions but not this review's conclusions.

### Quality gates (run by reviewer, not trusted)
- **The two ported suites pass:** 9 of 9 (`community-references-prune-builder`) and 21 of 21 (`firmware-install-leaves-tags-once`). On `feat/tags`' code with only the tests, they gave 0 of 9 and 4 of 21 (the test plan's Verification).
- **The scoped gate on `de43928d`.** Its 21 suites were derived from the port's diff, as the test plan's "How to run" says.
  - **Result:** run `20261122T022125Z-33781-ddc2`, FAIL, exit 1, with 361 passed, 3 failed and 58 skipped.
  - **The Implementer's run** on the same tree (`20261122T020040Z-78681-191d`) gave the same.
- **The three failures are `item-trusted-list`'s U18–U20, and they aren't the port's.**
  - The suite passes alone on `feat/tags`' code: 51 of 51 (`20261122T020219Z-86431-1e65`).
  - It fails the same three cases in the same 19 suites without the port or its tests (`20261122T020259Z-88027-cf2e`).
  - **Why:** every suite loads before any runs. Suites loaded before it, `only-me-curation` and `per-pin-membership-method` among them, set `process.env.TA_PUBKEY` to their own fixture first. Staging's honest-test-gate work fails such a suite; `feat/tags` predates that work.
- **No CI runs on a pull request into `feat/tags`.** `test.yml` runs on pull requests into `staging` and `main` only, so these runs are the port's test evidence.
- **`harness-lint` on the port branch** gives one violation, L9 (`BIBLE.md`'s "Last updated" lags its last change), which `feat/tags` had before the port.

### Spec and ADR adherence
- **The source is staging's fix, and only it.** `de43928d` changes `src/api/neo4j/eventSync.js` and `src/firmware/install.js`. Their added and removed lines are byte-identical to those of `f2e14987^1..f2e14987` for the same files.
  - **The one difference is where `tagUuidOf` sits:** above `buildImportCypher`'s doc comment.
  - **Why it moved:** staging's copy puts it after `placeholderUnlessHeld`, which `feat/tags` doesn't have.
- **What stays out is right.** The fix's parts in `src/firmware/target.js` and `src/operations/catalog/graph/_sets.js`, and their tests S11–S13, have nothing to port to: neither file is on `feat/tags`.
- **The routes and labels the new lines rely on behave there as on staging:**
  - **`POST /api/strfry/publish`** answers `{ success: true }` once strfry stores the letter, and 200 with `success: false` when `strfry import` fails (`src/api/strfry/commands/publishEvent.js:108-121`). So the seed's new `success !== true` check reads it as on staging.
  - **`POST /api/neo4j/query`** takes `params` (`src/api/neo4j/queryPost.js`), as `removeSelfLoops` needs.
  - **Labels.** Neo4j is pinned at 5.26.10, so `NostrEvent|TapestryNode` and `COUNT {}` parse. Nothing on `feat/tags` labels a node `TapestryNode`, so the union matches `NostrEvent` nodes alone.
- **AC-1 to AC-4 are covered on this branch** by the ported cases: the plan's coverage map, less S11–S13.

### Things tests can't catch
- **A tags install takes the seed path, not the "already has a `b`" one.** ADR 0035 §4 and the test plan's port section say `feat/tags`' Pass 1 has no `overwrite`, so its installs sign no header again. In fact they sign every header again.
  - **The duplicate check never matches.** create-concept compares stored pubkeys with `Buffer.from(nt().getPublicKey(privBytes)).toString('hex')` (`src/api/normalize/index.js:1198`). In nostr-tools 2.10.4, the version both branches lock, `getPublicKey` already returns 64 hex characters, so the check compares 128 (checked with that version). The branch's own comment at `:1255-1259` says the variable double-encodes.
  - **Staging fixed that check,** and made the overwrite explicit, in `f3347d276` (2026-11-04). `feat/tags` doesn't have that commit.
  - **So each Pass 1 there signs, publishes and imports every firmware header again,** with no `b`. The community step then seeds it, as on staging and production.
  - **The tests already run that path:** S1, S2, S9, S10 and E1 do, and S9's staging-shaped graph is tags' shape too. The fix heals tags on either path. What changes is the record, and what the tags install will log: six "pointer-b seeded" lines.
- **The tags install signs every firmware concept again,** as every install on that branch does. If none has run since the six letters of 2026-09-22, it also undoes edits made there to firmware concepts since then (BIBLE §7). The owner hears this before his yes to it.

### Findings
#### Blocking
None.

#### Non-blocking
1. **The port's comments say tags' installs sign no header again.**
   - **Where:**
     - `test/firmware-install-leaves-tags-once.test.js:17` and `:351`: S3, "(feat/tags' installs)";
     - `:195`: `neverResigned()`;
     - `test/helpers/communityStep.js:18-20`: `pass1Import`, "a firmware concept the graph doesn't hold yet";
     - `src/firmware/install.js:1097`: "as feat/tags' Pass 1".
   - **The fix:** reword each for what is true on this branch. Add a dated correction to the test plan's port section, and a note to ADR 0035 §4.
   - **Staging's copy** of the `install.js` comment says the same, and can change at that file's next change there.
2. **`feat/tags`' BIBLE §22 doesn't say the step prunes or skips.** Staging's fix added a sentence to §22's "Status today", which is `BIBLE.md:1559` on this branch.
   - Port the sentence without its last clause, which is about seed-firmware's target and doesn't apply here.
   - Move `BIBLE.md`'s "Last updated" too, which also clears L9.
3. **Two test nits.**
   - **Labels:** `bringIn` and `wire` (`test/firmware-install-leaves-tags-once.test.js:121`, `:125`) match `NostrEvent|TapestryNode`, where this branch's install matches `NostrEvent`. It's harmless on the fixtures.
   - **Line references:** the three at `:109`, `:117` and `:123` cite `install.js` as it was before the port, so in the tree they ship in they point at other code. The code they mean is at `:1102-1113`, at `:1144-1147` and `:1175-1180`, and at `:1305-1358`.

### Verdict
**PASS.**
- The port brings staging's fix to `feat/tags`, and nothing else.
- It behaves there as on staging, and it is tested on both install paths.
- The gate's only failures are `feat/tags`' own.
- The three findings are about records and comments, not behavior.

### On PASS
- The story's `**Status:**` was already `Done`, from round 2.
- Completion detection is reported in the chat, not here.
