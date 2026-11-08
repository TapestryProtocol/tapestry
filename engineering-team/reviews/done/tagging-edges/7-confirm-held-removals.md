# Review: Story 7 — Confirming held removals, on the panel

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-07
**Diff:** `git diff 1044e193..337f1170` on `feat/tagging-edges-7`. `1044e193` is `origin/staging` `7acc2df6` plus the
approved story. The story's commits are:
- ADR 0007, `f0afae51`;
- the failing tests, `79432158`;
- ADR 0007 D8's note (the overdue module moves to `src/pipeline`), `27e640e9`;
- the overdue suite's module path, `6e468129`;
- the implementation, `60043230`;
- the evidence, `337f1170`.

**How it was reviewed.**
- **The lanes.** Six read-only reviewers each took one dimension:
  - spec and tests;
  - the server against ADR 0007 and ADR 0006's controller;
  - the overdue verdict and the evidence fixture script;
  - the panel;
  - security and privacy;
  - the accuracy of the docs and records.

  Each ran its probes from its own scratch folder, made no mutating request to any host, and changed nothing in the
  tree. The Reviewer ran the gate and the browser spec.
- **Checking the findings.** The Reviewer re-derived every finding that is blocking or asked in this round, from the
  source or a probe, before writing it here:
  - Blocking 1 was reproduced in a real browser. A scratch copy of the spec added one case, with a control. Focus stays
    on the Confirm answer line while the status is unchanged, and falls to `BODY` once the next read shows the pass
    running.
  - The rest were re-read at the cited lines, or re-run, as each finding says.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` on Node 22.23.4 (`GATE_LABEL=te7-review-337f1170`). `npm run gate:status -- --label
  te7-review-337f1170`:
  `20261107T234904Z-51977-f97c [te7-review-337f1170] started 2026-11-07T23:49:04.645Z on 337f1170 — FAIL, exit 1, 7152
  passed, 39 failed, 173 skipped, 334/334 suites`.
  - **The backend its live suites measured.** It was spawned at 23:12:45Z on `60043230`'s server code. This is the
    first gate on this story's server code: both runs in the story's § Evidence measured the backend from 2026-10-28.
  - **Against the Implementation run** (`20261107T055729Z-34174-736c`, `60043230`), only two suites differ:
    - `relay-scan-bounds`: 28 passed → 27 passed and 1 skipped. Its live probe skips or runs from run to run, as it did
      between the story's two runs.
    - `brains-launcher-service`: 139/0 → 138/1. Test 51 of `deploy/launcher/test/compose.test.js` ("destroy detaches
      Caddy first…") failed with "destroy must not remove volumes". Its check is `!commands.some((c) =>
      c.includes('-v'))` (`:84`), and every command carries a random temp-dir path made from the prefix
      `launcher-test-`. When the random suffix starts with `v`, the path contains `-v`. That happened in 313 of 20,000
      `mkdtemp` calls measured here, about 1.6%. Re-run alone three times, the suite passed 139/0 each time. The story
      does not touch the launcher (§ Outside this story 1).
  - **The 12 story suites pass**, with the same counts as in the story's § Evidence.
  - **The other 17 failing suites fail with the same counts as in both of the story's runs.** That now holds on this
    story's backend too.
- [x] `npm run test:playwright` equivalent, per the test plan's how-to-run: the UI built in the container from
  `337f1170`, served on :4174, `tests/brainstorm/tagging-pipeline-panel.spec.js --project=chromium`: **151 passed
  (1.9m)**. The server was stopped and `tmp/tp-dist` removed afterwards.
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`. None of the INFO or WAIVED lines names a
  story 7 file.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence

- [ ] Every acceptance criterion has a passing test.
  - **AC-1 to AC-4:** yes.
    - Every refusal code in D4 is reached and asserted: CH2, CH3, CH5, CH12, CH14, CH15, CH17, CH18, CH23 and CH26;
      401, 403, 415 and 400 by CH27, and CH28 through the real `authMiddleware` and `requireOwnerOnly`.
    - D2 step 4's precedence is asserted by CH8 to CH11.
    - Expired and unreadable confirmations are pinned apart (CL5, CL6, CL11, CL13, CH4, TV112, B118, B123).
  - **AC-5:** yes, apart from requested 4 and 5.
  - **AC-6:** not in full. Blocking 1 is a behaviour failure that B145 does not reach, and requested 2 lists the closing
    paths no test runs.
  - **AC-7:** its first bullet has no test (requested 3).
- [x] No criterion is silently dropped. The carry-forwards CF1 to CF8, NB1, NB2, E1 and R1-opt each have their test or
  their record (spec lane: CT71, CT70, SWR87, JG27, TV115, TV127, B43; CF1 at `control/index.js:363` and ADR 0006
  `:519`; CF8 at BIBLE `:713` and `:1581`).
- [x] No behaviour added that isn't in the story.
- **Test-first held.** `git diff --stat 79432158..337f1170 -- test tests` shows only `test/tagging-edges-overdue.test.js`,
  all of it from `6e468129`: the `LIB` path, OV1's title and a header note.
  - No test id from before the story was deleted, in any of the nine revised suites.
  - Each revised assertion follows a decision: CT34 (D5), CT31 (AC-1), CT33 and CT65 (`takeBackStart`), CT70, RT4
    (D6), RT17, RT31, JG19, B9, B10, B11 and B94. None was loosened to fit the code.

## ADR adherence

- [x] The files changed match ADR 0007's implementation notes, with the owner-decided move of the overdue module
  (D8's dated note).
- [x] Layering is respected. `src/lib/tagging-edges/` stays pure; the confirmation runs as one controller step; the
  route keeps only who, the body and the checks before the chain.
- [x] No new dependency. `cron-parser` 4.9.0 was already installed and is the one BullMQ uses. `package.json`, the lock
  files and `firmware/` are unchanged.
- **Server (D1–D7).** `controller.confirm` runs D2 steps 1–9 in order inside one chain step
  (`control/index.js:562-667`). The server lane's probes reached every path: lined up, waiting pass, starting pass,
  taken up, not lined up, each refusal, and the interleavings with Run, Stop and the gate's two decisions. The
  generation bumps on every path (`finally`, `:659-661`).
  - `who` is built only from the configured owner, already checked equal to the session's key
    (`src/api/tagging-edges/index.js:258-280`). A body's `who`, `pubkey` or `key` never reaches the controller.
  - D6's allowlist (`confirmation.js:66`) drops `mintedBy`, the nonce and any extra member.
  - D7: the pass writes `latest.confirmation.mintedAt`.
  - CF1, CF3, CF4 and NB1 each change only what their ADR wording says.
- **Deviations.** Every server, script and UI bullet in the story's § Deviations checks against the code, apart from:
  - the sentence at `:598-600` (blocking 1);
  - the re-read reading (requested 9);
  - the overdue suite's "one-line" change (requested 11).
- **One gap between AC-5 and D14** (requested 5), for the Architect.

## Concept-graph integrity

- [x] No concept handle is written or changed. The story's § Concepts touched names the `nostr-user-tag` handle, which
  keeps ADR 0015's literal.
- [x] No firmware reinstall is needed: no concept definition changed.
- [x] No new code reads concepts.

## Things tests can't catch

- [x] **No secrets in committed files.** The added lines carry no 64-hex key, nsec, npub, token or address. `f0178122`
  appears once, in § Evidence, as the record's owner key, which is AC-4's record.
- [x] **No leftover debug logging.** The `console.log` lines in the diff are the fixture script's own output.
- [x] No commented-out code.
- [ ] Error paths and edge cases are handled where it matters: requested 6 to 9.
- [ ] Concurrency and remounts are considered: the server's races are sound (§ ADR adherence); the panel's remounts are
  not (blocking 1).
- [x] **Security.**
  - Only a signed-in owner can confirm. A direct local call is `localTrusted`, but `requireOwnerOnly` and the handler
    still need the owner's session, as the ADR says.
  - `runId` is checked before any file path. The fixture script's Cypher is parameterised, and it reads the settings
    with no credential on any command line or in any output.
  - Signed out, no public read carries who, `mintedBy` or the nonce. Checked as a remote client: the status, the held
    list, the path status, the Task Explorer's two data routes, the task timeline and the scheduled-tasks reads.
  - `confirmation.json` and `record.json` are written atomically, at 0600.
  - Requested 6 bounds work the public status now does.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.
- [x] **The TA pubkey is not hardcoded.** The fixture's author is the invalid `f…f`, by design.
- [x] **No explicit compose `-f` flags** in docs or scripts.

## Product-guide adherence

Not applicable: the story traces to no PRD.

## Findings

### Blocking

1. **`ui/src/pages/settings/taggingPipeline/HeldSection.jsx:219-269`. After a Confirm answer, focus falls to the page
   once the held section changes branch. An open prompt can also take focus from another section.**
   - **Why it happens.** The section has three branches: a pass running (`:219`), no held list (`:229`) and the held
     list (`:259`). The prompt and the answer sit at different child positions of `Section` in each:
     - in the running branch, the prompt is 3rd and the answer 4th (`:224-225`);
     - with no held list, the prompt is 4th and the answer 5th (`:235-236`);
     - in the held-list branch, the prompt is 3rd and the answer 5th (`:263`, `:265`).

     React matches unkeyed children by position, so a move between branches unmounts the element and mounts a new one.
   - **The answer line.** After "lined up" or "waiting pass", focus is placed on the answer line, as D15 says. The next
     read shows the pass running, and focus falls to `BODY`. It falls again when the pass ends.
     - Reproduced in a real browser: chromium, the spec's own mocks, `S.HELD_NONE`, then `F.STATUS.RUNNING`.
     - The panel lane's probe with react-dom 19.2.4 shows the same thing.
     - This happens after every Confirm that lines up a pass, which is the usual case. It breaks AC-6's "Never lost.
       Focus never falls to the page itself", and the ledger row this story closes
       (`2026-10-28-panel-prompts-return-no-focus`).
   - **The prompt** (the panel lane's UI-2). Open and not under way, it remounts when one read moves the section from
     the held list to no held list. Its mount effect then focuses its own Cancel, and the panel's close effect moves
     focus to the Held heading. That takes focus from wherever the owner had put it, which D15 rules out. It needs a
     pass that starts and ends between two polls, so the window is narrow.
   - **The story's Deviation** at `7-confirm-held-removals.md:598-600` ("the answer line shows in every branch, so a
     re-read during the send never removes them") is true of the text and not of the element.
   - **Asked change:**
     - Render the prompt and the answer at one stable position in every branch, or give them stable `key`s.
     - Add a browser case where focus on the answer line survives waiting → running → ended.
     - Add one where focus elsewhere survives a read from held list to no held list while the prompt is open.
     - Correct the Deviation sentence.

### Requested in this round (non-blocking: asked now while the story goes back)

2. **AC-6's other gaps.**
   - **"Turn on" reached by focus.** `ui/src/pages/settings/taggingPipeline/PathSwitch.jsx:145-147`. After Cancel puts
     focus on "Turn off" (AC-6's rule), a read that shows the path off turns that same `<button>` into "Turn on". React
     reuses the node, so focus sits on it, and one keypress turns the path on with no prompt. AC-6 names Turn on as a
     control focus must never land on. The reuse dates from story 5; this story's Cancel rule makes it reachable.
     - **Asked change:** when "Turn off" gives way to "Turn on" while focused, move focus to the path section's heading,
       and add a browser case.
   - **Closing paths with no test.** `tests/brainstorm/tagging-pipeline-panel.spec.js` B143 to B145. AC-6 says each
     prompt returns focus "however it closes" (confirmed, refused, gets no answer in time, or closes by itself). These
     are not run:
     - Confirm with no answer in time. That is separate code: the prompt is cleared at once, `TaggingPipelinePanel.jsx`
       `:228-232`. B125 covers the timeout but not focus.
     - Turn off refused, and Turn off with no answer in time.
     - Stop refused.

     The test plan's AC-6 row (`:71`) claims all four for all three prompts.
     - **Asked change:** add Confirm's no-answer case to B145, as B144 has for Stop. Add the others, or narrow the row
       to what is run.
3. **AC-7's first bullet is untested.** `test/tagging-edges-pass-control.test.js:2268` (CT63), and test plan `:72`.
   - The plan credits "Confirm changes no schedule entry and not the path's switch" to CT63 and B147.
     - CT63 calls only `runA` and `stop`, never `confirmA`.
     - B147 runs against mocks, so it cannot see the server's schedule or switch.
     - The CH suite's `stateOf` does not track the scheduler, `scheduled-tasks.json` or the switch files.
   - `confirmFlow` never touches the scheduler, so the behaviour is right today; the coverage claim is not.
   - **Asked change:** run `confirmA` in CT63's world (lined up, waiting pass, not lined up, a failed add), so its
     queue, scheduler and file checks apply. Correct the row.
4. **The overdue verdict's default schedule reader is unpinned.** `src/api/tagging-edges/index.js:51`.
   - OV19 to OV23 inject `readScheduleEntries`, and no status test reads the default (`state-routes.test.js:755`).
   - If the default were swapped for `readConfig()`, which swallows a parse error, every test would still pass. The
     panel would then read `no-entry` where AC-5 says "cannot tell".
   - The default works today: the spec lane's probe got `cannot-tell`/`schedule` for an unparseable file.
   - **Asked change:** one OV case that calls `handleStatus` with no `readScheduleEntries` injected and a temporary
     `SCHEDULED_TASKS_CONFIG_PATH`: bad JSON gives `cannot-tell`/`schedule`, and a valid file gives its verdict.
5. **A failed status read after a good one hides "cannot tell".** `ui/src/utils/taggingPipelineView.js:1147`
   (`overdueView`), with `TaggingPipelinePanel.jsx` `useRead`.
   - A failed read keeps the last good body, and `overdueView` judges that body. So an open panel whose reads now fail
     shows nothing in the backstop section while the kept verdict is on time.
   - The pass section does say its report could not be read (`PassSection.jsx:201`).
   - AC-5 says "A missing warning never stands for on time", and that the panel says when it cannot tell. D14 covers
     only "a status read that failed with no body".
   - **Asked change:**
     - the Architect adds a dated note to D14;
     - `overdueView` says it cannot tell while `statusRead.state === 'error'`, at least when the kept verdict would
       show no line;
     - a TV and a browser case for a failed read after a good one.
6. **The overdue verdict's cron work has no bound, and every signed-out status read does it.**
   `src/pipeline/tagging-edges/overdue.js:27-54`, reached from `src/api/tagging-edges/index.js:202`.
   - Judging one pattern the first time takes hundreds of milliseconds of synchronous work. Two lanes measured it
     separately in the container: 170 to 600 ms.
   - The per-pattern cache holds 32 (`:28`, `:51`). With more distinct enabled patterns than that, every status read
     recomputes all of them. The cost then lands on every viewer's poll, and on signed-out reads.
   - Nothing caps the number of entries or the length of a cron string. Only the owner or an admin can save an entry.
   - **Asked change:**
     - bound the work per verdict: for example, answer `cannot-tell`/`rule` without judging when the distinct
       patterns exceed the cache, and skip a pattern past a fixed length;
     - add a test that a second status read with more patterns than the cache makes no parse calls.
   - A cap at write time in scheduled-tasks is outside this story (§ Outside this story 2).
7. **A throw from the verdict fails the whole public status.** `src/api/tagging-edges/index.js:184-188`.
   - `overdueOf` catches the schedule reader's throw but not one from `overdueVerdict`. A hand-edited entry whose
     `cron` or interval is an object that can't become a string or number makes it throw.
     - Re-run here: "Cannot convert object to primitive value".
     - The status then answers 500, against D8's "never fails the status".
   - **Asked change:** answer `{state: 'cannot-tell', reason: 'schedule'}` when the verdict throws, with a test.
8. **`publicConfirmation` checks member names, not their types.** `src/lib/tagging-edges/confirmation.js:66-76`.
   - **A nested object goes out as is.** With a hand-edited `confirmation.json`, a `runId` that is an object carrying
     `mintedBy` and a nonce is served whole on the public status. D6 promises that `mintedBy` and the nonce never reach
     a signed-out reader.
   - **An object `expiresAt` makes `Date.parse` throw** at `:74`, and the public status answers 500. The old
     `computeStatus` had the same throw. Both need write access to the file, which only the server has.
   - **Asked change:**
     - serve each member only with its type: strings for `runId`, `heldDigest`, `mintedAt` and `expiresAt`, integers
       for `version` and `heldCount`;
     - guard `Date.parse` with a type check, as `pendingFor` does;
     - add a CL case.
9. **A failed re-read is answered "a pass started".** `src/pipeline/tagging-edges/control/index.js:630-645`.
   - When step 7's re-read fails, the confirmation is withdrawn and the answer is 409 `pass-started` ("a pass started;
     confirm its report when it ends"). No pass is known to have started.
   - The state is consistent: withdrawn, and the record taken back. But the panel then says "A pass started meanwhile",
     where AC-1 asks that the answer say plainly which happened.
   - It is logged as a Deviation, and no test reaches it: `world.failNext` is used only by the helper's own self-check.
   - **Asked change:** after withdrawing on a failed re-read, answer 500 `error` with the cause, and add a CH case for a
     re-read that throws. Or the owner ratifies the Deviation knowing the sentence can be untrue (§ For the owner).
10. **Test plan rows that cite the wrong tests, and one title.** In `7-confirm-held-removals.test-plan.md`:

    | Line | Row | What the row says | What actually covers it |
    |---|---|---|---|
    | `:65` | AC-5, what every viewer sees | TV129 (that is "cannot tell") | TV128 |
    | `:67` | AC-5, cannot tell | TV130 (that is "still being checked") | TV129 |
    | `:42` | AC-1, a pass waiting | CH9 and RT33, neither a waiting case | CH7, CT31, RT32, TV117, B128 |
    | `:48` | AC-1, made but no pass lined up | CH6 and RT19 | CH9, CH19, CT33, RT18, RT34, RT35 |
    | `:62` | AC-4, cannot be recorded | CH14 (that is confirmation-unwritten) | CH12, CT34, CT55 |
    | `:70` | AC-5, only a warning | B147 (that is Confirm's request pin) | the `nonGet` checks in B138 to B140 |

    Also B129's title (`tagging-pipeline-panel.spec.js:3938-3941`) says the panel "shows from its next read whether that
    pass took it up", but no next read is staged.
    - **Asked change:** correct the rows, and stage the read or trim the title.
11. **Record fixes.**
    - **`OPERATIONS.md:768`**, "a request that lines up nothing records nothing". This is now false for confirmations:
      every accepted one is recorded, lined up or not. The live record has confirm lines with no start at 23:08:07Z
      and 23:11:14Z.
    - **`OPERATIONS.md:799`** leaves out 500 `confirmation-unwritten` and 500 `error`. ADR 0007 D4 and BIBLE `:720`
      name the first.
    - **`OPERATIONS.md:801`** gives `--count <n>` without saying it must be the `T` that `plan` prints.
    - **BIBLE `:720` and `OPERATIONS.md:799`** say "changing and recording nothing" or "nothing changes" for
      `confirmation-unwritten` and `pass-started`. The record's take-back is best effort (D2 step 6;
      `control/index.js:607`). BIBLE `:720` also leaves out 500 `error`.
    - **The story's § Evidence:**
      - "a Run" at `:519`, `:522`, `:531-532`, `:540` and `:553` were direct local run-task calls (the record shows
        `who: local`), not the panel's Run;
      - "no schedule entry" at `:554` means no temporary or enabled one, since the disabled seed entry stands.
    - **The story's § Deviations, `:564`:** the overdue suite's change is the `LIB` path and OV1's title, with a header
      note, not "one line".
    - **Line cites moved** by this story's header inserts in `taggingPipelineView.js`: `'no-status'` moved from `:220`
      to `:223`, which breaks the cites at ADR 0006 `:1270` and ADR 0004 `:842`. Cite the key, or the new line.
    - **File headers:**
      - `control/index.js:19-20` says the queue being off is the routes' refusal; `confirm` answers it itself
        (`not-lined-up`);
      - `ScheduleSection.jsx:12` says the section takes the warn tone while overdue; not when its list read has failed.

### Non-blocking (follow-ups, not asked in this round)

1. `control/index.js:616`: `d.nonce()` runs after step 5's record write and outside step 6's `try`. A throw there
   would leave the confirm line with no take-back. `crypto.randomBytes` does not throw in practice. Build the nonce
   before step 5.
2. `src/api/tagging-edges/pass.js:115` still passes `mode: 'run'`, which `lineUp` ignores (D1; logged).
3. **The record-first design leaves a crash window.** Between step 5 and step 6, a restart leaves a confirm line, and
   for a line-up a start, with no `confirmation.json`. Run's start-before-add has the same window. At most, add a
   residual next to R10–R13.
4. The fixture script's `create` refusals (`--host`, an existing fixture, the run grammar) are untested. HF1 to HF9 pin
   only the exports, the Cypher and the source. Pin them with the driver stubbed before the staging evidence relies on
   them again.
5. CH29 reads `/api/task-explorer/single-task/data` but not `/api/task-explorer/data`. The story's local evidence read
   both.
6. Story 6's test plan, D8 row: those tests now pin story 7's reversal. Add a dated note pointing at ADR 0007 D1–D5.
7. Paging the held list while the Confirm prompt is open closes the prompt (`TaggingPipelinePanel.jsx:297-301`). Keep
   the prompt across a page read for the same run, or disable the pager.
8. **D11's "unknown" sentence** ("no answer within 15 seconds") is also shown for an immediate network failure and for
   a 2xx answer whose body is not JSON. Run, Stop and the switch say "no answer came back that the panel could read".
   This is the ADR's wording, so it is for the Architect.
9. **After `held-list-changed`,** the line says "The panel now shows the latest state", but the held list is re-read
   only when the run id changes. Re-read it, or soften that code's sentence.
10. The last answer line stays under a newly opened prompt and becomes the focus target if that prompt closes by
    itself. This holds for all three prompts. Clear it when a prompt opens, or accept it.
11. **The cron judge's limits** (1,000 runs, 400 days) under-read clustered rules, always towards a false "overdue"
    (`0 0 * 2 *` reads 24 h). The cache ignores `nowMs`, so a judgment that depends on the date lasts for the process's
    life. cron-parser also runs in the process's zone: under a zone with daylight saving, `0 3 * * *` reads 25 h. The
    containers run in UTC. A dated residual in D8.
12. **The fixture script.**
    - `create` trusts `--count` up to 9,999,999 in one transaction. Read B inside it and refuse a count below
      `fixtureCount(B)` or far above it.
    - The success line should name the pass that may be confirmed.
    - An unknown argument exits 1, where the Deviation says 2.
    - The header's "never production" is policy, not a check.

### Outside this story (for the owner to place)

1. **`deploy/launcher/test/compose.test.js:84` is flaky**, about 1.6% of runs: its `-v` substring check matches the
   random temp-dir name. Match `-v` as an argument, not a substring. It failed once in this review's gate. The ledger
   has no row for it.
2. **Scheduled-tasks validation caps neither the number of entries nor a cron string's length.** That is requested 6's
   precondition, and also the parse cost of the public schedule list.
3. **The pass's `validateClaim`** (`reconcileTaggingEdges.js:164`) calls `Date.parse` on a hand-edited claim's
   `expiresAt` without a type check, as requested 8 describes for the confirmation.

### For the owner

- **The test plan's three notes for the owner** (`7-confirm-held-removals.test-plan.md:301-318`) have no recorded
  answer:
  - the "every busy pass stopping" case may be unreachable while the held list is the latest;
  - PassControls' pending line can be shown for an earlier pass's confirmation, which that pass will not honour;
  - older suites now read the real `scheduled-tasks.json`.
- **Requested 9:** fix the answer, or ratify the Deviation.

### Harness friction

1. **Seen again: `2026-10-01-test-plan-credits-unpinned-behaviour`.** Requested 3 is a coverage row for a bullet no
   test covers. Requested 10 is six rows that cite tests that don't cover them, plus a title. Nothing between Test
   Design and Review re-derives the map. A dated note is added to the row in this commit.
2. **Seen again: `2026-09-29-test-plan-misses-injected-seams`.** Requested 4: the real default reader behind
   `readScheduleEntries` runs in no test. A dated note is added to the row in this commit.

## Verdict

**CHANGES_REQUESTED.**
- **Blocking 1** is a behaviour failure against AC-6. It was reproduced in a real browser and happens after every
  Confirm that lines up a pass. It also leaves open the ledger row this story was to close.
- **Requested 2 to 11** are small, and best done while the story is back:
  - two AC-6 gaps, and coverage for AC-7's first bullet and AC-5's default reader;
  - three robustness fixes on the public status;
  - one answer that can be untrue;
  - the test plan's rows, and the record fixes.

  Requested 5 needs a dated D14 note from the Architect first.

The rest holds:
- the server matches D1–D7, and its races, refusals and take-backs check out;
- only the owner can confirm, and who never reaches a public read;
- the overdue rule matches D8;
- the fixture can never cause a real removal, and its cleanup reaches only fixture nodes;
- the gate's story suites and the browser spec pass, and the local evidence matches the record.

## Re-review, round 2 (2026-11-08)

**Diff:** `git diff 7be349a6..f10bc317`. `7be349a6` is round 1's review. The fix round's commits are:
- the tests and the test plan, `fffb2d91`;
- ADR 0007's fix-round notes, `0637e9b9`;
- the implementation and the record fixes, `4943e870`;
- the evidence, `f10bc317`.

**How it was reviewed.**
- **The lanes.** Round 1's six read-only lanes were resumed. Each re-derived its own asks from code, commands and
  records, as reviewer rule 10 asks, the review's and the ADR notes' wording included. Each then looked for new problems
  the fix round brought into its dimension. They ran no suite and made no mutating request.
- **The Reviewer's own checks.** The Reviewer ran the gate and the browser spec, and reproduced blocking 1 below.

### Quality gates (run by reviewer, not trusted)

- [x] `npm test` on Node 22.23.4: `20261108T011950Z-54570-4152 [te7-review2-f10bc317] started 2026-11-08T01:19:50.824Z on
  f10bc317 — FAIL, exit 1, 7170 passed, 38 failed, 173 skipped, 334/334 suites`.
  - **The backend** was spawned at 00:46:07Z on `4943e870`. `f10bc317` changes no source after it.
  - **Against the fix round's own run** (`20261108T004631Z-59123-13d4`), only `relay-scan-bounds` differs: its live
    probe skipped (28/0/0 → 27/0/1).
  - The story suites pass in full, and the same 17 suites fail with the same counts.
- [x] **Browser spec** on the UI built from `f10bc317`, chromium: **158 passed (2.0m)**.
- [x] `bash scripts/harness-lint.sh`: clean (0 violations).

### Round 1's asks

| Ask | Round 2 | Evidence |
|---|---|---|
| Blocking 1, focus after a Confirm answer; an open prompt taking focus | **Fixed** | `HeldSection.jsx:212`, `:220` keys. The panel lane moved the section between 8 states, every ordered pair (56), three ways: the answer line focused, the prompt under way, and the prompt open with focus elsewhere. Element and focus held each time, with no React warning. B148 and B149 are red before the fix and green after. The Deviation is corrected. |
| Requested 2, AC-6's other gaps | **Partly** | The coverage part is fixed: B151, B152 and B153; every prompt × way of closing now has a test (the spec lane's table). Turn on is not: blocking 2 below. |
| Requested 3, AC-7's first bullet | **Fixed** | CT72 runs Confirm in CT63's world, four cases, with CT63's three checks. |
| Requested 4, the default reader | **Fixed** | OV24 gives `cannot-tell`/`schedule` for bad JSON. With `readConfig()` swapped in it reads `no-entry`, so OV24 tells them apart. |
| Requested 5, a failed read after a good one | **Fixed** | `taggingPipelineView.js:1151`. "Cannot tell" can't show for a read that did not fail: `error` is set only by a failed answer and cleared only by a good one (`TaggingPipelinePanel.jsx:93-94`). TV133, TV134 and B154. Its Retry branch is untested (requested 4 below). |
| Requested 6, the cron work's bound | **Partly** | More than 32 patterns: 0.8 ms and 0.1 ms per read, against 8 to 20 s before. The cache only ever holds the pass's patterns and settles in every case simulated. The 256-character skip brings in a false "on time": blocking 1 below. |
| Requested 7, a verdict throw | **Fixed** | `index.js:187-188`. Both hand-edited entries answer 200 with `cannot-tell`/`schedule` and the full body (OV29). |
| Requested 8, member types | **Fixed** | `confirmation.js:68-81`. An object `runId` is dropped, and an object `expiresAt` no longer throws (CL15–CL18, CH30). The input is always JSON-parsed, so no getter can reach it. |
| Requested 9, a failed re-read | **Fixed** | `control/index.js:630-645`. The server lane crossed five re-read results with three withdraw results under two plans, and each answers as the note says. 409 `pass-started` stays only for a re-read that names another run. CH31 and CH32. |
| Requested 10, plan rows and B129 | **Fixed** | Each row cites what covers it. B129 keeps its old check and stages both next reads. |
| Requested 11, record fixes | **Fixed** | Each sentence checks against the code. The ADR 0004 cite was fixed by editing an accepted ADR's older note in place: requested 5 below. |

### Blocking (round 2)

1. **`src/pipeline/tagging-edges/overdue.js:82`. A cron rule over 256 characters gives a false "on time" when it is the
   most frequent rule.**
   - **Why it happens.** The fix counts a pattern over 256 characters with no period. When a less frequent entry sits
     beside it, that entry's period decides the verdict.
   - **Reproduced here.** An every-minute rule padded to 285 characters, beside a daily interval entry, with the latest
     pass begun 2 h ago, reads `{"state":"on-time",…,"periodMs":86400000}`. At `7be349a6` the same input read overdue,
     correctly.
   - **Why the note's reasoning fails.** It says the period "cannot be told (null), as R13's rules are". An R13 rule
     runs fewer than twice in 400 days, so it is always rarer than any judged period; a skipped long rule may be the
     most frequent one.
   - AC-5 rules this out: "the most frequent counts", and "A missing warning never stands for on time".
   - OV27's fourth case pins the wrong answer. The precondition is an owner-saved cron over 256 characters. It is
     unlikely, but this round brought it in, and a test now holds it in place.
   - **Asked change:**
     - when any counted pattern is skipped for its length, answer `cannot-tell`/`rule`, as the over-32 bound does;
     - flip OV27's fourth case;
     - the Architect corrects the D8 fix-round note.
2. **`ui/src/pages/settings/taggingPipeline/PathSwitch.jsx:126-133`, `:157-158`. Focus can still sit on "Turn on".**
   - **Why it happens.** The fix tracks "Turn off"'s focus with `onFocus` and `onBlur`. Switching away from the
     browser tab or window fires a blur on the focused element while it stays `document.activeElement`. The flag
     clears, a read in the background then turns "Turn off" into "Turn on", and the layout effect does nothing.
   - **What the owner sees.** Back on the tab, focus is on "Turn on", and one keypress turns the path on with no prompt.
     This is the panel lane's probe; a panel left open in a background tab is the usual way to reach it.
   - **A second, browser-dependent route.** "Turn on" pressed from the keyboard becomes "Turning the path on…", then
     "Turn off", on the same node, with no focus event. A later read showing the path off again leaves focus on
     "Turn on".
   - AC-6 names Turn on as a control focus must never land on, and requested 2 asked for exactly this.
   - **Asked change:**
     - decide at the swap from `document.activeElement` against the button node, for example one ref on the button in
       both states;
     - add a case to B150 that blurs the window before the read.

### Requested in this round (non-blocking: asked now while the story goes back)

3. **The panel's sentence for `cannot-tell`/`rule` is now false for the fix's own causes.**
   `ui/src/utils/taggingPipelineView.js:1130` says the rule "runs fewer than twice in 400 days". The over-32 bound and
   the long-pattern rule give the same reason, so 33 daily rules read that way. No test pins the clause.
   - **Asked change:** drop the clause, or give each cause its own reason and sentence.
4. **Three behaviours the fix brought in are unpinned:**
   - the Retry branch of requested 5 (`state 'loading'` with an error kept): one TV case, and its pair with no error;
   - more than 32 patterns beside an interval entry reads `cannot-tell`/`rule`, which the D8 note gives: one OV case;
   - the Confirm prompt keeping its element while its confirmation is under way and a read changes the branch. Focus
     is then on its own `h4`, and a lined-up pass began 0.3 s after the confirm in the local evidence: one B148-style
     case.
5. **Records.**
   - **ADR 0004's older note, edited in place.** `4943e870`, an `impl:` commit, changed the text of story 6's dated
     note at `0004-tagging-pipeline-panel.md:842`, in an accepted ADR. The note's `:220` was true when written. Restore
     the line byte for byte. The Architect then appends a line in an `adr:` commit naming the `'no-status'` key (`:223`
     now). The same edit at ADR 0006 `:1270` is acceptable: that note is this story's own and has not shipped.
     (§ Harness friction 1.)
   - **The story overstates the round's red tests** (`7-confirm-held-removals.md:567`). Of the 24 new tests, 15 failed
     before the fix. The other nine pinned behaviour that already held and were green on purpose: CT72, OV24, OV28,
     CL18, CH32, TV135, B151, B152 and B153.
   - **A server Deviation is out of date** (`:602-603`): it still gives a failed re-read as 409 `pass-started`. Add a
     dated "superseded" note pointing at the D2 step 7 fix-round note.
   - **The test plan's suites table** (`:11-25`) still lists round 1's id ranges. Extend them, and mark B129 revised.
   - **ADR 0007's D8 fix-round note:**
     - "once per process while cached" doesn't hold after an edit. With 32 patterns, changing the last entry cost 1,
       then 31, then 0 judgments over three reads;
     - the worst case left is about 1 s for each pattern crafted to be costly, and about 35 s for 32. It lands on the
       first read after a restart, or after a save that adds new patterns;
     - an unparseable pattern over 256 characters is counted, so it reads "cannot tell" where a short one reads
       `no-schedule`.

     State all three, alongside blocking 1's correction.
   - **OPERATIONS:788** doesn't state the new bounds. Add one clause. OPERATIONS' "Last updated" line (`:6`) still
     reads 2026-11-04.
   - **`src/lib/tagging-edges/confirmation.js:60-73`.** `publicConfirmation`'s doc comment now sits above the new
     helper, not above the function. Move the helper above it.

### Non-blocking (follow-ups, not asked in this round)

1. **When a failed re-read is followed by a withdraw that throws,** the answer is 500 `withdraw-failed`. Its sentence
   (`control/index.js:61`), and the panel's line for it (`taggingPipelineView.js:1067`), still say a pass started.
   Reaching it needs both reads to fail. A neutral sentence is the Architect's to word, as D11's are.
2. **A cron of more than 256 characters that is not a cron** reads `cannot-tell`/`rule`, while a short one reads
   `no-schedule`. Requested 5's note wording covers it.
3. **The remaining first-read cost could be spread** by capping how many patterns not yet cached one status read may
   judge. That would show "cannot tell" for a few seconds after a restart. For the owner, beside requested 5's
   wording.

### For the owner

- **A focused control that a later read removes outright still loses focus to the page.** Two cases, each confirmed by
  the panel lane's probes and the Tester's:
  - "Confirm held removals" once another tab's confirmation is pending;
  - "Stop" once nothing is busy.

  D15's note covers only a control replaced in place. Either:
  - **extend D15 and fix it in this story:** a dated note, two browser cases, and a change to the shared focus helper,
    about one more short cycle;
  - **or leave it:** it becomes its own ledger row, and the row this story closes
    (`2026-10-28-panel-prompts-return-no-focus`) closes for the prompts only, saying so.
- **The test plan's three notes for the owner** still have no recorded answer (round 1, § For the owner).

### Harness friction

1. **Seen again: `2026-10-11-implementer-edited-accepted-adr`.** The fix round's `impl:` commit edited an accepted ADR's
   older note in place (requested 5). The review's round-1 ask, "Cite the key, or the new line", invited it. A dated
   note is added to the row in this commit.

## Verdict (round 2)

**CHANGES_REQUESTED.**
- **Two blocking issues remain.** Each is in a round-1 ask the fix only partly met, and each breaks an AC's explicit
  rule:
  - a false "on time" for a long frequent rule (AC-5), which a test now pins;
  - focus on "Turn on" after the tab loses focus (AC-6).
- **Requested 3 to 5** are small: one sentence, three tests and record fixes. Requested 5's ADR 0004 line needs the
  Architect's appended note.

The rest of round 1 is fixed and re-derived:
- the blocking focus loss on the held section;
- the coverage gaps;
- the public status's three robustness fixes;
- the failed re-read's answer;
- the plan rows;
- the records.

## Re-review, round 3 (2026-11-08)

**Diff:** `git diff 20c5efa7..cebcbffa`. `20c5efa7` is round 2's review. Fix round 2's commits are:
- the tests and the test plan, `188c8165`;
- ADR 0007's round-2 notes, and ADR 0004's T12 note restored with a dated line at its end, `8cde9c76`;
- the implementation and the record fixes, `065fa2c1`;
- the evidence, `d518e3a0`;
- a ledger row and a line in the test plan's § How to run, `cebcbffa`.

**How it was reviewed.**
- **The lanes.** Five of the six lanes were resumed. Each re-derived round 2's asks in its dimension from code,
  commands and records, as reviewer rule 10 asks, the review's own wording included. Each then looked for new problems
  the round brought in. They ran no suite and made no mutating request.
- **The server lane was not resumed.** The round's server diff is `overdue.js`, which is the overdue lane's, and a
  doc comment moved in `confirmation.js`, which the docs and security lanes checked.
- **The Reviewer's own checks.** The Reviewer ran the gate and the browser spec. It re-checked requested 2, 4 and 5
  below with its own probes (scratch `rev7/reviewer-r3/`).

### Quality gates (run by reviewer, not trusted)

- [x] `npm test` on Node 22.23.4: `20261108T153416Z-81387-3270 [te7-review3-cebcbffa] started 2026-11-08T15:34:16.272Z
  on cebcbffa — FAIL, exit 1, 7173 passed, 38 failed, 173 skipped, 334/334 suites`.
  - **The backend** was spawned at 14:50:18Z on `065fa2c1`. `cebcbffa` changes no source after it.
  - **Against fix round 2's own run** (`20261108T145041Z-79787-7f9a`), only `relay-scan-bounds` differs: its live
    probe skipped (28/0/0 → 27/0/1).
  - The story suites pass in full, and the same 17 suites fail with the same counts.
- [x] **Browser spec** on the UI built from `cebcbffa`, chromium: **159 passed (2.0m)**.
- [x] `bash scripts/harness-lint.sh`: clean (0 violations).

### Round 2's asks

| Ask | Round 3 | Evidence |
|---|---|---|
| Blocking 1, a long rule read on time | **Fixed** | `overdue.js:81-82`. Any trimmed pattern over 256 characters on an enabled pass entry now gives `cannot-tell`/`rule` before any rule is judged. Round 2's input (every minute, padded to 285 characters, beside a daily interval, the latest pass 2 h ago) read `on-time` at `20c5efa7` and reads `cannot-tell`/`rule` now, as do the 319-character list rule and a long rule beside the daily cron rule. A long rule on a disabled pass entry, or on another task's entry, changes nothing. A long pattern now comes before `no-schedule`, `no-pass` and `report`, as the round-2 D8 note gives. OV27's flipped and new cases are red on round 1's build. |
| Blocking 2, focus on Turn on | **Fixed** | `PathSwitch.jsx:126-139`, `:161`. The panel lane's probe passed all its cases, P1–P9, in react-dom 19 with StrictMode. Round 1's flag code fails P6 (B150's window case) and P8 (Turn on from the keyboard, then on, then off). The button node is the same across Turn off → Turn on, so the check fires. A stale node after the prompt opens is disconnected, so it is a no-op, and useReturnFocus moves focus once. "Turn on" carries no ref, as PS43 requires. The review's "one ref in both states" was only an example, and would have broken PS43. B150's window case was red on the build before the fix. |
| Requested 3, the rule sentence | **Fixed** | `taggingPipelineView.js:1131`. It is true for all three causes (the panel lane rendered each one), and B140's, TV129's and TV134's checks still hold. TV137 pins it. |
| Requested 4, three tests | **Fixed** | TV136 fails both with the Retry branch removed and with an over-wide "any loading read" check. OV30 fails against the planted fault. B155 discriminates on its second read only: the prompt is the third child in both the held-list and the running branches, and the fourth with nothing held. Without the key it remounts there, and the same-element check catches it. |
| Requested 5, records | **Partly** | ADR 0004 is restored byte for byte. The old file is a prefix of the new one, and its end line is true (`:220` at `17dd5017`, `:223` now). Also fixed: the story's count of 15 red of 24; the superseded Deviation note; the suites table; OPERATIONS `:788` and `:6`; `confirmation.js` (comments only: with them removed, the file is identical). The D8 note states the review's three points, but one clause the review gave is wrong: requested 1 below. |

### Blocking (round 3)

None.

### Requested in this round (non-blocking: record fixes before ship)

These are record fixes. Only requested 4's OV30 may change a test input. Whoever lands them re-derives each changed
sentence (reviewer rule 10).

1. **ADR 0007 `:736-737`, the round-2 D8 note:** "It lands on the first status read after a restart, or after a save
   that brings in new patterns".
   - This is the review's own wording from round 2, requested 5, adopted word for word. After a save it is wrong.
   - The cache drops the oldest pattern first, so a one-entry save costs 1 judgment on the first read and 31 on the
     second. Two lanes measured 1, then 31, then 0:
     - with cheap patterns, 10.5 ms, then 332 ms;
     - with crafted ones, 0.9 s, then 28.8 s.
   - **Asked change:** the Architect appends a dated correction: "on the first status read after a restart, and on
     the first one or two after a save that brings in new patterns".
   - **Optionally, in the same line:** `:723-724`'s "always rarer than any period that is judged" overstates
     slightly. A yearly rule under R13 and a judged yearly rule can tie.
2. **The story's fix-round-2 local status (`7-confirm-held-removals.md:610-613`) shows nothing about the fix.**
   - The yearly rule `0 3 1 1 *` has one run within 400 days of the check (2027-01-01; the next is 419 days away).
     So R13 alone reads "cannot tell", and a long rule alone read "cannot tell" at `20c5efa7` too.
   - **The Reviewer re-checked it,** with the latest pass 2 h before 15:03:46Z:

     | Input | `20c5efa7` | `cebcbffa` |
     |---|---|---|
     | the evidence's yearly rule, widened to 300 characters, alone | `cannot-tell`/`rule` | `cannot-tell`/`rule` |
     | the daily rule `0 3 * * *` widened to 300 characters, beside `0 4 * * *` | `on-time` | `cannot-tell`/`rule` |
   - **Asked change:** either say the check shows only that a long entry does not fail the status, or redo it with the
     second pair. Create and delete that entry away from 03:00 and 04:00 UTC, so no pass runs.
3. **The test plan's coverage map has no rows for round 2's tests or notes** (`7-confirm-held-removals.test-plan.md`).
   - `:67` lacks TV136 and TV137.
   - `:68` and `:109` lack OV30.
   - `:72` and `:111` lack B155.
   - `:110` lacks TV136.
   - No row covers any round-2 note: D8's long pattern (OV27), D14's reason (TV137), and D15 decided at the swap
     (B150's window case).
   - **Asked change:** add those ids, and three rows for the round-2 notes.
4. **Three test titles say what is not so:**
   - **OV27** (`test/tagging-edges-overdue.test.js:725`) quotes the round-2 D8 note without "on an enabled entry for
     the pass". That is a real condition, and follow-up 1 finds it unpinned.
   - **B155** (`tests/brainstorm/tagging-pipeline-panel.spec.js:4793`) quotes D15 as "while under way, focus is on
     the prompt's heading". That text is not in the ADR. D15 reads "A prompt whose send starts moves focus to its own
     `h4` …".
   - **OV30** (`:800`) says the hourly interval entry "alone would say overdue 2 h after". At exactly 2 h it says on
     time: a 1 h period plus 1 h of grace, and the comparison is strict. The Reviewer reproduced it.
   - **Asked change:** quote the ADR as written, or mark the gap with "…". For OV30, start the hourly case's latest
     pass 2 h 1 min ago, so it shows the bound overriding a warning; or reword the title.
5. **Two small slips:**
   - The story's fix-round-2 commit list (`:592-595`) leaves out `cebcbffa`.
   - The new ledger row's fix shape names "the cycle skills", which run no Playwright. The run commands are in:
     - `.claude/agents/tester.md:22`;
     - `.claude/agents/reviewer.md:22`;
     - `engineering-team/roles/tester.md:16-17`;
     - `engineering-team/templates/test-plan.md:38`.

**Who:**
- 1 is the Architect's;
- 2 and 5 are the Implementer's;
- 3 and 4 are the Tester's.

### Non-blocking (follow-ups, not asked in this round)

1. **Three conditions of the long check are unpinned** (two lanes):
   - it reads only the pass's enabled entries;
   - it measures the trimmed pattern;
   - a long pattern that is not a cron reads "cannot tell".

   The code is right today. A build that checked every entry, or the untrimmed length, passes every OV case, and both
   mistakes err towards a false "cannot tell". The fix is OV27 cases for:
   - a long rule on a disabled pass entry, and one on another task's entry, each beside a daily interval;
   - a short rule padded outside past 256 characters;
   - a long non-cron alone.
2. **Round 2's second route to Turn on has no browser case:** pressing Turn on from the keyboard, then the path on,
   then a read showing it off. The panel lane's P8 shows it fixed.
3. **Superseded round-1 lines carry no forward pointer:** ADR 0007 `:702-703`, and the test plan's `:345`.
4. **The spec's own run recipe** (`tagging-pipeline-panel.spec.js:277`) lacks `PLAYWRIGHT_HTML_OPEN=never`. The new
   ledger row covers it.
5. **No saved log** for fix round 2's red Node runs, or for OV30's and TV136's planted faults. This is the known
   durability gap (ledger `2026-10-28-browser-lane-recipe-and-run-record`). The claims fit the code.
6. **`overdue.js:101`, `Math.min(...periods)`,** overflows the call stack at about 130,000 counted entries. This has
   been so since `60043230`, not this round. The status catches it, and answers 200 with `cannot-tell`/`schedule`:
   the reason is wrong, nothing fails, and nothing leaks. A running minimum fixes it.
7. **TV137 bans only R13's words,** so a sentence naming another single cause would pass it. It is acceptable while
   the sentence is right.

### For the owner

- **A focused control that a later read removes outright still drops focus to the page.** The two cases are "Confirm
  held removals" once another tab's confirmation is pending, and "Stop" once nothing is busy.
  - AC-6 is "Prompts return focus", and in these cases no prompt is open, so they do not hold this verdict.
  - Either a short follow-up story extends D15, or the case gets its own ledger row.
  - Either way, the row this story closes (`2026-10-28-panel-prompts-return-no-focus`) closes for the prompts only,
    and says so.
- **The test plan's three notes for the owner** still have no recorded answer.
- **Round 1's and round 2's follow-ups, and § Outside this story,** remain for the owner to place.

### Harness friction

1. **Filed by the fix round:** `2026-11-08-local-playwright-run-hangs-on-failure` (`cebcbffa`). Off CI, a red
   Playwright run never exits, because the HTML reporter serves its report and waits.
2. **Filed with this review:** `2026-11-08-live-evidence-unchecked-against-old-build`. The fix round checked each
   green-on-purpose test against a planted fault, but not its live evidence, and that evidence read the same on the
   build before the fix (requested 2).
3. **Rule 10 caught the review's own wording** (requested 1), as it is meant to.

## Verdict (round 3)

**PASS**

- **Both blocking issues from round 2 are fixed,** and so are requested 3 and 4.
  - Each was re-derived from code, probes and the run records, the review's own wording included.
  - Each new test fails on the build it is meant to catch.
- **The quality gates are clean.** Every story suite passes. The full gate on `cebcbffa` differs from fix round 2's
  run only by a live probe's skip. The browser spec passes 159 of 159.
- **No finding this round is blocking.**

The five requested changes are record fixes, and only OV30 may change a test input. They do not hold the verdict, but
they should land before the merge to staging, each re-derived by whoever lands it.

With this commit, the story's `**Status:**` (`:3`) becomes Done. The book is not complete yet. Its acceptance frame is
judged by what has shipped, and story 7 has not shipped. Once story 7 is on production, with its staging evidence (the
owner runs the fixture over SSH, ADR 0007 § Evidence), the frame's bullets look met, and a close can be offered then.

### Record-fix check (2026-11-08)

Round 3's requested 1 to 5 landed in four commits:
- `637da836`, then `9143f737`: ADR 0007's dated correction;
- `b24d5729`: the test plan's rows and the three titles;
- `1b8fe3e9`: the story's live check and the two slips.

The docs lane re-derived every changed sentence from code, commands and logs (reviewer rule 10), and the Reviewer
re-ran the two that needed a measurement. The record fixes changed no file under `src/`, `ui/` or `scripts/`.

| Ask | Result | Evidence |
|---|---|---|
| 1, ADR 0007's D8 cost note | **Holds, after one more fix** | `637da836`'s correction said a one-entry save costs 1 judgment, then 31. The lane found that this holds only when the changed entry is the one judged last. Changing entry *k* of 32 costs 1, then *k*−1, then 0; the Reviewer re-measured it for *k* = 1, 2, 16 and 32 (`1,0,0`, `1,1,0`, `1,15,0`, `1,31,0`). `9143f737` fixes the correction in place, since it was this round's own and not yet accepted. "On the first one or two after a save" holds. |
| 2, the live check | **Holds** | The first check is marked corrected. The new pair matches the log (16:22:58Z to 16:23:10Z, on the backend spawned at 14:50:18Z on `065fa2c1`). Live: `cannot-tell`/`rule` with both entries, `on-time` with the short one alone. The replay on `20c5efa7`'s `overdue.js` gives `on-time` for both. "Over 10 hours before either rule would have run" is right (10.61 h to 03:00Z). No entry and no Redis key remain. |
| 3, the coverage map | **Holds** | Each added id exists and fits its row. The three new round-2 rows match the round-2 notes. |
| 4, three titles | **Holds** | Every quote in OV27's, B155's and OV30's titles is in the ADR, the story or the review. OV30's hourly case starts 2 h 1 min back. Its setup check pins on time for the daily entry alone and overdue for the hourly one alone (the comparison is strict). It still fails against its planted fault (29/1, log kept). No test's verdict changed: overdue is 30/0, and the spec lists 159 tests. |
| 5, two slips | **Holds** | The commit list names `cebcbffa`. The ledger row now names the four files whose lines run Playwright (`npm run test:playwright`). The cycle skills run none. |

All five requested changes have landed and been re-derived, so nothing from this review stands between the story and
the merge to staging. The follow-ups and § For the owner stay as round 3 lists them.
