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
