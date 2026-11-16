# Review: Story 9 — `tapestry-keys` finishes on a large graph whatever the transaction limit

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16 (UTC; the Mac's clock read 2026-11-15, EST)
**Diff:** `git diff origin/staging...HEAD` (HEAD `12f6ada8`, branch `fix/tapestry-keys-tx-memory`; merge base `33c5ce2f`). Five commits: `87bd02f8` the story, `0b25440f` ADR 0009, `1c549899` the failing tests, `ae288385` the fix, `12f6ada8` the live checks' numbers. 12 files, +1143 −24. `origin/staging` has since moved to `5a27550a`; none of its 12 newer commits touches a file this diff changes.
**Story:** `engineering-team/stories/graph-operations-foundation/9-tapestry-keys-within-transaction-memory.md` · **ADR:** `engineering-team/decisions/graph-operations-foundation/0009-shared-keys-from-a-stream-of-hashes.md` (amends ADR 0003, Decision 4) · **Test plan:** `engineering-team/stories/graph-operations-foundation/9-tapestry-keys-within-transaction-memory.test-plan.md`

This session wrote none of the story, the ADR, the tests or the code. It re-ran or re-derived everything below. That includes the live checks, run once on a fresh scratch stack after the slot came free.

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`: not run.** On this Mac a full run writes to the owner's agent-memory instance, the `tapestry` container, so the brief rules it out (OPEN.md row 294). The full gate comes from the PR's CI.
- [x] **The operations family, through the gate engine.**
  - **How it ran.** `test/helpers/gateRunner.js` ran `operations.test.js` alone, which runs every suite under `test/operations/`. Its record went to a scratch `GATE_RECORD_DIR`.
  - **Every endpoint was dead.** `BRAINSTORM_BASE_URL`, `TAPESTRY_PORT` and `MEILI_URL_HOST` pointed at `127.0.0.1:9`. `TAPESTRY_CONTAINER` was `no-such-container`. `BRAINSTORM_CONF_PATH` named a conf with `NEO4J_URI=bolt://127.0.0.1:9`. `TAPESTRY_KEYS_LIVE` was unset.
  - **`npm run gate:status -- --label reviewer-9-subset`:**
    `20261116T013533Z-76828-5e00 [reviewer-9-subset] started 2026-11-16T01:35:33.416Z on 12f6ada8 — PASS, exit 0, 345 passed, 0 failed, 4 skipped, 1/1 suites`
  - Story 8's review counted 337 here. The 8 more are SK1–SK8, and the 4 skips are LK1–LK4.
  - The tree was clean.
- [x] **Each suite on its own,** stack-free, with `TAPESTRY_CONTAINER` and `TAPESTRY_KEYS_LIVE` unset and each exit status read directly:
  - `shared-keys`: 8 passed, 0 failed, 4 skipped.
  - The eleven other lifecycle suites: `migrate` 27/0, `migrate-job` 6/0, `status` 9/0, `backup` 21/0, `backup-job` 17/0, `restore` 23/0, `download-backup` 7/0, `list-backups` 6/0, `upload-backup` 10/0, `cache-counts` 7/0 and `tapestry-key-paths` 19/0. That is 152 tests, as the plan says.
  - The operations family through `node -e`: 345 passed, 0 failed, 4 skipped, exit 0.
- [x] **Red before green, re-derived.** In a scratch copy of the tree, `_migrations.js` was put back to its text at `1c549899`.
  - The new suite failed all 8, with the eight reasons the plan's Verification quotes, word for word.
  - On that code, with the new fake, the eleven other lifecycle suites passed: 152 tests.
- [x] **Live checks LK1–LK4, re-run: 11 passed, 1 failed (LK4).**
  - **The slot.** When I first looked, another session had just booted `tapestry-scratch-a1028`. Later, `tapestry-scratch` was up. Near the end the slot was empty.
  - **The run.** `SCRATCH_IMAGE=agent-memory-tapestry:latest bash scripts/scratch-stack.sh up` at `12f6ada8`, with `src/` clean, booted 01:57:33–01:59:16 UTC. `seedStagingShape.js` then took 191 s, and `TAPESTRY_KEYS_LIVE=1 node test/operations/lifecycle/shared-keys.test.js` ran 02:02:26–02:06:55 UTC. `scripts/scratch-stack.sh down` removed the stack, and no scratch container was left.
  - **The counts** are the suite's own summary line: `operations: lifecycle migrate: the check for shared keys: 11 passed, 1 failed, 0 skipped`. My runner script echoed `rc=0` for that step, because its `$?` followed a command substitution. That is the README's warning about reading a run's exit status.
  - The numbers are under ADR adherence → "The live record", and the failure is Blocking 1.
- [ ] `npm run test:playwright`: not applicable. No UI changed.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence

- [ ] **Every acceptance criterion has a passing test.** All but one point do. AC4's second bullet on AC2's graph is LK4's last assertion, and it failed when re-run (Blocking 1).

| AC | Evidence |
|---|---|
| AC1, staging's shape with no rule | SK1: one streamed read of all 8 keys, nothing grouped and no second read; the rule added and status applied. LK1: `done` with no backup in 19.2 s (19.6 s recorded). The rule added and both online, no key given and none shared, status applied. |
| AC2, production's shape | LK4, re-run: `done` in 67.6 s with its backup taken. `keysGiven` and `labelsGiven` both equal the 2,294,384 stripped nodes, and no node is left without a key or the label. The rule and the index are online, and status reads applied. Each of these passed before LK4's last assertion failed. LK4 doesn't check that every key a node already had is kept. Story 3's M2 checks that, and it passes here. This diff doesn't change the keys pass. |
| AC3, with no rule | SK2: keys on 2 and on 12 nodes named in key order, with counts 2 and 12 and ten nodes for the twelve. Neither key changes, the rule is left out, and status reads not applied. SK3: with over 100 shared keys, the first 100 in key order, each count exact. LK2 passed: 23.3 s (18.7 s recorded). |
| AC3, the rule in place | SK4: the held key named with both nodes, and the holder left without the label. The rule stays, and status reads not applied before and after. SK5: two unlabelled nodes sharing a key. LK2 passed: 67.9 s with its backup (68.2 s recorded). |
| AC4, under 64 MB | All transactions together: LK1 2 MB and LK4 28 MB, on both runs. Stack-free, no SK test sends a grouping, and each read goes through `cypherEach`. Wrong fixes 5 and 6 below fail on that. |
| AC4, the job's process | LK1 passes on both runs: 112.7 MB against 452.4 MB for a backup's count of the same keys (113 against 443 MB recorded). **LK4 fails on the re-run:** 298.9 MB against 225.1 MB, 1.33× against the plan's 1.25× (`…test-plan.md:24`). The recorded run passed at 1.24×. Blocking 1. |
| AC4, the record | Before the fix, each read is recorded (`…test-plan.md:88–98`). After it, each live check is, but not each read (Non-blocking 4). |
| AC5, nothing else changes | The eleven lifecycle suites pass unchanged, M7 and M27 included. SK8. LK3: status took 3.16 s on the migrated graph (2.87 s recorded). That is under its 5 s bound, against 3.17–3.38 s on today's code. |

- [x] **No criterion is silently dropped.** The partial points are in the table: AC2's kept keys, AC4's record of each read, and LK4's bound.
- [x] **No behaviour the story doesn't cover.**
  - The answer's key order is ADR 0009 Decision 4.
  - The fake now honours `$skip`. That is the Tester's change, recorded in the plan (Test infrastructure, item 3).
  - With the rule in place, what status costs while a key is shared follows from ADR Decision 3 (Non-blocking 1).

## ADR adherence

- [x] **Files.** Only `_migrations.js` changed in `src/`. `_system.js`, `src/lib/neo4j-driver.js`, `_jobs.js`, `migrate.js` and `status.js` are untouched, as the Implementation notes say.
- [x] **The Decision, step by step** (`src/operations/catalog/lifecycle/_migrations.js`):
  1. **The first read.**
     - Both forms are the ADR's queries verbatim (`:111–114`), sent through `system.cypherEach` (`:115`).
     - The array starts at `max(1024, ⌈expected × 1.01⌉)` (`:108`) and doubles when full (`:116–120`).
     - A `held` row puts its key in a set, exactly (`:122`).
  2. **The candidates.** The filled part is sorted as numbers (`:126`), and equal neighbours are candidates (`:127`). With none and no held key, the answer is `[]` after one read (`:130`).
  3. **The second read** is the ADR's query (`:133`).
     - It keeps only held keys and candidate hashes (`:135`).
     - It counts every holder and keeps the first ten ids (`:141–142`).
     - It drops a candidate whose key has one holder (`:145`).
  4. **The answer** is in key order, at most 100 (`:146–147`). Each `key` is `String(k)` (`:138`).
  5. **`keyHash`** (`:84–96`) is the published cyrb53.
     - I checked it on 200,000 strings, ASCII and not, against bryc's version written out on its own.
     - The SK6 pair both hash to 7794590295477596 under it, and every hash is a safe integer.
     - `keyText` (`:78`) carries a non-string's type. The driver hands integers over as JS numbers (`src/lib/neo4j-driver.js:157–158`), so `1` and `1.0` are one key, as Neo4j compares them, and `'1'` is another.
     - It is exported (`:364`).
- [x] **Implementation notes.**
  - `planKeys` passes `expected` from the counts (`:168`). With the rule in place that is the number of unlabelled nodes, an upper bound on the first read's rows.
  - `HASHES_MIN` and `HASHES_SLACK` sit beside `SHARED_LIMIT` (`:24–26`).
  - The check sends no `collect(`, `count(` or grouping.
- [x] **Docs.**
  - **OPERATIONS.md §17** has the sentence (`OPERATIONS.md:1113`). It drops the ADR's "Before the rule exists" (Non-blocking 1).
  - **ADR 0003:** its header and its Decision 4 bullet name Amendment 0009.
  - **The ledger row** stays `OPEN` on this branch. The story's Deviation 5 leaves it to the PR's own commit.
- [x] **Dependencies:** none. cyrb53 is written inline, and it is public domain.
- [x] **Each role kept to its own files.**
  - The test commit (`1c549899`) touched the plan, the suite, the fake, the probes and one line of the story, its Test plan link.
  - The implementation commits (`ae288385`, `12f6ada8`) touched `_migrations.js`, OPERATIONS.md, ADR 0003, the story's Deviations and the plan's "After the fix", which the plan assigns to the Implementer (`…test-plan.md:104`). Neither touched `test/`.

### Wrong fixes tried against the suite

Each wrong fix was made in a scratch copy of `_migrations.js`, then run against the copy's `shared-keys` and `migrate` suites. `migrate` passed 27 of 27 under every one.

| # | Wrong fix | Fails |
|---|---|---|
| 1 | Keys that hash alike grouped as one key, with no exact comparison | SK2, SK3, SK6 |
| 2 | The array grows only when `n > hashes.length`, so rows past its end are dropped | nothing (Non-blocking 3) |
| 3 | `keyText` as `String(value)`, so `1` and `'1'` are one key | SK7 |
| 4 | No key order: the answer in the order the read met the keys | SK2, SK3 |
| 5 | The second read through `system.cypher`, unstreamed | SK2, SK4, SK6 |
| 6 | The first read through `system.cypher`, unstreamed | SK1, SK2, SK4, SK5, SK7, SK8 |
| 7 | With the rule in place, the second read narrowed to `NOT n:TapestryNode` | nothing (Non-blocking 2) |
| 8 | With the rule in place, the first read over every node | SK1, SK4, SK5, SK8 |
| 9 | `held` ignored | SK4 |
| 10 | Eleven nodes named instead of ten | SK2 |

### The live record

The two runs are the Implementer's, recorded at `ae288385` (`…test-plan.md:106–119`), and this review's, at `12f6ada8`. Between them only the plan changed, so the code is the same.

| Check | Recorded | This review |
|---|---|---|
| LK1 | 19.6 s; transactions 2 MB; process 113 MB against 443 MB | 19.2 s; transactions 2 MB; process 112.7 MB against 452.4 MB |
| LK2, no rule | 18.7 s | 23.3 s |
| LK2, the rule in place | 68.2 s, with its backup | 67.9 s, with its backup |
| LK3 | 2.87 s | 3.16 s |
| LK4 | 66.2 s; 2,294,385 stripped; transactions 28 MB; process 274.7 MB against 221.3 MB (1.24×) | 67.6 s; 2,294,384 stripped; transactions 28 MB; process 298.9 MB against 225.1 MB (**1.33×, fails**) |

- **Everything reproduces except LK4's process peak.** That peak rose 24 MB (9%) between two runs of the same code, while its yardstick moved 2%. Before the fix, the same measure read 1.20× (273.5 against 227.8 MB).
- **The recorded run tested the committed code.**
  - The scratch stack mounts the checkout's `src/` read-only (`scripts/scratch-stack.sh:80`).
  - The recorded run began at 01:14 UTC, 2 minutes after `ae288385` (01:12:28 UTC). Its container had booted about 3 minutes before that commit.
  - But nothing loads `_migrations.js` at boot or in the seeder. `migrate.js` requires it inside `run` (`:56`), status requires it inside `migrations()` (`status.js:183`), and each migration job runs in a fresh worker. So the first load came with LK1's first call, after the commit.
- **The new Cypher ran on Neo4j 5.26.10, on both runs.** In LK2's run with the rule in place, the job named the held key with both its nodes. That takes both the `EXISTS` subquery and the second read.

## Concept-graph integrity
- [x] **Handles:** none touched.
- [x] **Firmware:** no concept definition changed, so there is no reinstall.
- [x] **Orientation:** not applicable. The change reads no concept.

## Things tests can't catch
- [x] **No secrets.**
  - The probe and the suite read the scratch password from the container's own conf (`test/helpers/scratchProbes/txMemoryPeak.js:14`, `test/operations/lifecycle/shared-keys.test.js:299`).
  - The fixtures' TA is `'ee'.repeat(32)`.
- [x] **No debug logging and no commented-out code.** The live checks' `[LKn]` lines are the plan's evidence.
- [x] **The live checks can't reach the shared stack.** `cs`, `tapestry`, `copyProbes`, `startProbes` and `live.sh` all go through `assertScratch()`. It refuses any container whose name doesn't start with `tapestry-scratch`.
- [x] **Concurrency.** The two reads aren't one snapshot. Neither was the old single query, at Neo4j's read-committed isolation.
  - A node deleted between the reads lowers its key's count, which is right at that moment.
  - The pipeline gives random UUIDs, so it can't make a candidate shared.
  - A held key whose labelled holder is deleted falls to one holder and is dropped. The pass then labels the other node, as it should.
- [x] **Edge cases.**
  - Counts read moments apart can make `expected` negative. `Math.max(HASHES_MIN, …)` (`:108`) covers it.
  - `found` holds every held or candidate key before the cut to 100. The ADR's Consequences name that cost.
- [x] **The fake's new matchers catch nothing else.**
  - Backup's read of the keys (`_jobs.js:90`) has no `<> '{}'`.
  - The cache counts' read of the keys (`src/api/tapestry-key/index.js:61–66`) has the no-rule shape, but it reaches `nodeCypherFake`, not this fake.
- [x] **Injection:** none. The queries are constants, and `${LABEL}` is a module constant.

## House rules check
- [x] **Concept Graph API authority:** not applicable.
- [x] **Tooling:** no new lint, typecheck or build tooling.
- [x] **TA pubkey:** no literal added.

## Findings

### Blocking

1. **`test/operations/lifecycle/shared-keys.test.js:463–464` (LK4), against story AC4's second bullet (`9-tapestry-keys-within-transaction-memory.md:56`): LK4 fails when re-run on the committed code.**
   - **What failed.** On a fresh scratch stack at `12f6ada8`, the job's process peaked at 298,896 kB. A backup's count of the same 1,556,860 keys took 225,120 kB. That is 1.33×, past the plan's 1.25× (`:278`).
     - It is LK4's last assertion, and every one before it passed.
     - The plan records a pass at 1.24× (`…test-plan.md:117`).
   - **Why this measure can't settle AC4 on AC2's graph.**
     - **It compares unlike things.** Before the check runs, the job's own backup counts the keys twice, with the dump in between. The yardstick counts them once, in a fresh process. Before the fix, when the check held nothing in the process, the job already peaked at 1.20× its yardstick (273.5 against 227.8 MB).
     - **So the AC's words can't hold there.** On AC2's graph, "no higher than a backup's count of the same graph's keys" fails for any code. The plan's 1.25× leaves 5% for everything else.
     - **The noise is larger than the margin.** Between two runs of the same code, the job's peak varied by 9% (274.7 MB, then 298.9 MB). The recorded pass and this failure both sit inside that noise.
   - **What is known without LK4.**
     - By construction, the check keeps 8 bytes a key: a `Float64Array` of 1,572,429 entries, 12.6 MB at this size, plus the rows in flight.
     - On AC1's graph, whose job takes no backup, both runs put the process at a quarter of a backup's count.
     - So nothing suggests the fix moved Neo4j's 1.5 GB into the process. But AC4 asks for a measure that passes. LK4 is that measure, and its pass doesn't reproduce.
   - **Asked change.** No source change.
     - **Owner, through the Product Owner:** restate AC4's second bullet for AC2's graph so that it can hold. For example: on AC2's graph, the check adds no more than 8 bytes a key, plus a stated margin, to the peak the job's own backup sets.
     - **Tester:** re-express LK4's check of the process to match. The job writes `planning` again after its backup and just before the check (`src/operations/catalog/lifecycle/_jobs.js:292`). Read the worker's `VmHWM` at that point, and bound the final peak by it plus 8 bytes a key and the margin. Record this review's run beside the Implementer's.
     - **Then** run LK1–LK4 on a fresh scratch stack at least twice, since this measure moved 9% between two runs, and record both.

### Non-blocking

1. **`src/operations/catalog/lifecycle/_migrations.js:132–143`: with the rule in place, a shared key now costs every `lifecycle status` call a second read of the whole graph.**
   - **Why it happens.** Status calls `plan` on every request (`status.js:189`), and with the rule online, `plan` runs the check.
     - Before the fix, the check with the rule in place was one query: a scan of the unlabelled nodes, each seeking the rule's index.
     - Now three things bring on the second read (ADR Decision 3): an unlabelled node holding a labelled node's key, two unlabelled nodes sharing a key, or two unlabelled keys that hash alike.
     - That read streams every key in the graph with its element id. On staging's shape that is 3.85 million rows. The ADR measured a read of the keys alone at 4.4–4.6 s.
     - It runs in the control panel's own process, on every call, until the owner deals with the key. I ran `plan` on such a graph through a stub system, as status calls it, and it sent the second read.
   - **What doesn't change.** Memory stays small: the read is streamed and keeps only the matching rows. AC5's migrated graph is unaffected (LK3). LK2 called status in this state but didn't time it.
   - **The record says less than this.**
     - The `planKeys` comment says that with the rule in place the check "reads only the unlabelled nodes" (`:161–162`).
     - The `sharedKeys` comment says the second read comes "only when there is" a candidate (`:103`). A held key brings it too.
     - ADR 0009 says "Status keeps today's cost" (line 130).
     - OPERATIONS.md §17 (`:1113`) describes only the first run's form. It drops the "Before the rule exists" that the ADR's notes gave the sentence (ADR 0009 line 161).
   - **Optional improvement.** One of:
     - Narrow the second read when the rule is in place: the held keys through the rule's index, plus the unlabelled nodes. That is complete, since any key that both an unlabelled and a labelled node hold is a held key. Make this change after Non-blocking 2, so a wrong narrowing fails stack-free.
     - Keep the read, and say so in the two comments, in ADR 0009's "Memory and time" and in OPERATIONS.md §17. For example: with the rule in place, while a key is shared, each status call reads every key once more, about 5 s at four million keys.
2. **`test/helpers/lifecycleFakes.js:470–477`: the fake answers the holders read with every node whose key is in scope, whatever label test the query carries.**
   - **What it lets through.** Wrong fix 7 passes every SK and migrate test: the second read narrowed to `NOT n:TapestryNode` with the rule in place. That is the obvious shortcut for Non-blocking 1.
   - **What it breaks on Neo4j.**
     - The narrowed read drops a held key's labelled holder, so the key's count falls to one and it isn't named.
     - The keys pass then tries to label the other holder, and its batch fails on the rule.
   - **Who would see it.** Only LK2, and CI never runs LK2.
   - **Asked change** (Tester, when convenient; it can ride with Blocking 1), one of:
     - make the holders read apply the query's label tests, as the unlabelled read already does;
     - make the fake refuse a holders read that carries a label test (`note('unknown')` and throw), so a narrowing has to be modelled before it can pass.
3. **`_migrations.js:116–120`: no test reaches the growth path.**
   - **Why.** Every fixture's `expected` is its exact count, so the array never fills; it starts at no fewer than `HASHES_MIN` (1,024) entries. The live checks' graphs don't change while the check reads, so they don't fill it either.
   - **The risk.** Wrong fix 2 passes everything. A typed array ignores writes past its end, so a bug in the growth path would silently miss shared keys among the dropped rows.
   - **The code is right.** I drove `plan` through a stub whose count reads said 0. The array grew from 1,024 entries past 20,012 rows. Both planted shared keys were named with exact counts, one of them past row 20,000.
   - **Optional** (Tester): a case whose count reads under-report the keys, as keys made during the read would, with a shared key past row 1,024.
4. **`9-tapestry-keys-within-transaction-memory.test-plan.md:106–119`: AC4's third bullet (story, line 57) asks for each read's time and memory after the fix. The "After the fix" table gives each live check's totals instead.**
   - For the reads this diff doesn't change, that is harmless.
   - The check itself has no time of its own after the fix. Its time is folded into LK1's 19.2–19.6 s, and the "about 5 s" in OPERATIONS.md §17 rests on ADR 0009's measurement of the design (4.7 s).
   - **Optional:** in the re-runs Blocking 1 asks for, add the check's own time, and the probe's peak for each of its two reads.

### Harness friction
1. **One scratch slot serves every session, and nothing reserves it.**
   - The first two times I looked, another session held the slot. It came free near the end, which is the only reason this review could re-run the live checks. Those re-runs found Blocking 1.
   - The first container, `tapestry-scratch-a1028`, has a name `scripts/scratch-stack.sh` doesn't make. On this branch and on `origin/staging` the script uses the fixed name `tapestry-scratch`, and its guard checks only that name (`scripts/scratch-stack.sh:61`). So the script can't see a stack named any other way, and the brief's `grep tapestry-scratch` is the only lock.
   - **Candidate:** an OPEN.md `meta` row for a lease on the slot (who holds it, since when, until when). Then a Reviewer could queue for it instead of depending on luck.
2. **No full gate on this Mac:** already OPEN.md row 294.

## Verdict
**CHANGES_REQUESTED**

The fix itself is sound, in the one source file the ADR names.
- **The check no longer groups the keys in Neo4j.** It streams them, keeps an 8-byte hash of each in the job's process, and confirms each candidate by the key itself.
- **Neo4j's memory is fixed.** On both runs, `tapestry-keys` finished on staging's and production's shapes under a 512 MB limit, with Neo4j at 2 MB and 28 MB. The old check failed at 464 and 468 MB.
- **The answer is story 3's,** except that it now comes in key order.
- **The tests hold.** The stack-free tests pass, fail on the old code for the reasons the plan gives, and catch 8 of 10 wrong fixes.

One acceptance test doesn't reproduce. Re-run on the committed code, LK4's bound on the job's process fails at 1.33× against 1.25×. On AC2's graph that bound measures the job's own backup more than the check, and it can't hold for any code as AC4 words it.

What goes back, with no change to the code:
1. **The owner, through the Product Owner,** rules on a wording of AC4's second bullet for AC2's graph that can hold.
2. **The Tester** re-expresses LK4's check of the process to match.
3. **LK1–LK4 run twice** on a fresh scratch stack, and the runs are recorded.

The four non-blocking items can ride along. The story stays `Approved`.

## Close-out (same commit)
- [ ] Story `**Status:**` stays `Approved`. Its Review line fills in on the round that passes.
- [ ] **Still owed by the PR's own commit:** ledger row `2026-11-15-tapestry-keys-exceeds-transaction-memory` is `OPEN` on this branch. The story's Deviation 5 leaves it to that commit to flip it to `DONE`, naming story 9 and the PR's number, as ADR 0009's Implementation notes ask.
