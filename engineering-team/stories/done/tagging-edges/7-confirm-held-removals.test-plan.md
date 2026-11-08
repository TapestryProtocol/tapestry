# Test Plan: Story 7 — Confirming held removals, on the panel

**Story:** `engineering-team/stories/done/tagging-edges/7-confirm-held-removals.md`
**ADR:** `engineering-team/decisions/done/tagging-edges/0007-confirm-held-removals.md`
**Date:** 2026-11-07

## The suites

| Suite | Story 7's tests | Level |
|---|---|---|
| `test/tagging-edges-confirm.test.js` (new) | CH1–CH29; CH30–CH32 (review round 1) | component: `createController(deps)` over the shared fakes (CH1–CH25); handler with an injected `confirm` (CH26–CH27); child process with the real `authMiddleware` and `requireOwnerOnly` (CH28); signed-out reads after a confirmation, as PX38 (CH29) |
| `test/tagging-edges-confirmation-lib.test.js` (new) | CL1–CL14; CL15–CL18 (review round 1) | unit, pure |
| `test/tagging-edges-overdue.test.js` (new) | OV1–OV23; OV24–OV29 (review round 1); OV27 (revised) and OV30 (review round 2) | unit, pure (OV9–OV12 in a child process with `TZ=UTC`, the real `cron-parser`; OV25–OV28 and OV30 in such a child with `parseExpression` counted); module with a temp `SCHEDULED_TASKS_CONFIG_PATH` (OV16–OV18, OV24); handler with injected deps (OV19–OV23, OV26, OV29) |
| `test/tagging-edges-held-fixture.test.js` (new) | HF1–HF9 | unit over the script's exports, loaded with the driver and network stubbed; source pin (HF9) |
| `test/tagging-edges-pass-control.test.js` | CT8, CT24, CT29, CT31–CT34, CT51, CT55, CT58b, CT65, CT70 (revised); CT71; CT72 (review round 1) | component |
| `test/task-queue-job-gate.test.js` | JG19 (revised); JG27 | component; queue integration |
| `test/tagging-edges-wiring.test.js` | SWR84 (revised); SWR87; SWR86's header comment (CF5) | module; child process |
| `test/tagging-edges-state-routes.test.js` | RT4, RT17–RT19, RT31–RT36 (revised); RT39, RT40 | handler |
| `test/tagging-edges-runner.test.js` | SR88–SR91 | unit over injected ports |
| `test/tagging-pipeline-view.test.js` | TV111–TV132; TV133–TV135 (review round 1); TV136–TV137 (review round 2) | unit, pure and clock-free |
| `test/tagging-pipeline-fetch.test.js` | TF32–TF37 | unit, with an injected `fetchImpl` |
| `test/tagging-pipeline-panel-source.test.js` | PS13, PS14, PS28, PS31 (revised); PS39–PS44 | source pin |
| `tests/brainstorm/tagging-pipeline-panel.spec.js` | B9, B10, B11, B38, B39, B43, B94 (revised); B118–B147; B148–B154 and B129 (revised) (review round 1); B150 (revised) and B155 (review round 2) | browser (Playwright on the rebuilt UI, every `/api` route mocked) |
| `test/helpers/taggingEdgesPassFakes.js` | `readHeld`, `heldDigest`, `writeConfirmation`, `withdrawConfirmation`, `nonce`, `holdRemovals()`, `onCall()` hooks, `failNext()` (additive; self-check 20/0) | fakes |
| `test/helpers/taggingPipelineFixtures.js` | the confirm route's mock and D4 answers, `overdue`, `mintedAt`, `confirm` lines, the user's classification, 33 story-7 scenes (additive); `ENDED_CLEAN7_RECORD`, `TOOK_UP_NOW7_RECORD` and `SCENE7_R1` (review round 1) | fixtures |
| `tests/brainstorm/fixtures/relay-subtab-requests.json` | the Negentropy Sync sub-tab's `GET /api/strfry/negentropy-presets`, added by hand with a `handEdits` note | fixture |

The four new suites are in `test/registry.js`, after `tagging-edges-pass-routes.test.js`. Nothing was deleted: every
test id each changed suite had at `f0afae51` is still there.

## Coverage map

### Acceptance criteria

| Criterion | Test ids | Level |
|---|---|---|
| AC-1, when it shows: the latest pass held removals and no confirmation of that list is pending; not when nothing is held | TV111, TV112, TV113; B118 | unit; browser |
| AC-1, while a pass runs (by liveness, and a starting pass in `control.busy`): no held list, no Confirm; its own list once it ends | TV114; B119 | unit; browser |
| AC-1, until the held list is read: no Confirm while it loads or after its read failed | TV113; B120 | unit; browser |
| AC-1, a confirmation that cannot be relied on (unreadable, expiry unreadable, pending for an earlier pass): Confirm offered, and it replaces it | CL6, CL7; CH4; TV112; B118, B123 | unit; component; browser |
| AC-1, nothing busy: a pass lined up, its start recorded as the owner's confirmation; every viewer sees it waiting | CH6, CH11, CH21; CT32; B124 | component; browser |
| AC-1, a pass waiting with no stop asked (a due scheduled run included): nothing new, and the answer says the waiting pass takes it up | CH7; CT31; RT32; TV117; B128 | component; handler; unit; browser |
| AC-1, a pass running: refused out of date, nothing confirmed; a pass that has only just started takes it up, and the answer says which | CH2, CH8, CH15, CH16, CH18; CT31; TV117, TV120; B129 | component; unit; browser |
| AC-1, every busy pass has a stop asked: a new pass lined up behind it, never "taken up" by a stopping pass | CH10; CT32; RT36; TV117; B128 | component; handler; unit; browser |
| AC-1, never a false answer, the seconds after a pass ends included | CH11, CH25; TV124; B124 | component; unit; browser |
| AC-1, a second confirmation while one is pending: refused, its expiry and pass unchanged, nothing recorded (a pass waiting; the queue unavailable; 1 ms before expiry) | CL4, CL5; CH3, CH23; TV119; B126 | unit; component; browser |
| AC-1, every viewer sees it within 10 s: in the history, pending or taken up; no Confirm for that list while pending | CH22; TV125; B124, B135 | component; unit; browser |
| AC-1, made but no pass lined up (the queue unavailable, the add failing): kept pending; the panel gives the reason and points at Run or the next scheduled pass | CH9, CH19, CH20; CT33; RT18, RT34, RT35; TV118; B127 | component; handler; unit; browser |
| AC-1, a pass starting mid-confirmation: taken up, withdrawn, or the server cannot tell, each said so | CH15, CH16, CH17, CH18, CH31, CH32; TV120, TV121; B129 | component; unit; browser |
| AC-1, while under way: disabled, says so; no answer in 15 s: enabled again, outcome unknown, then the next read | TF34, TF36; TV123; B124, B125 | unit; browser |
| AC-1, an expired confirmation: Confirm offered again for the same list; refused once a newer pass ran | CL5; CH4; TV112; B118 | unit; component; browser |
| AC-1, used up by a pass that failed or was stopped: no Confirm, and the line that a later pass must hold them again | TV116; B132 | unit; browser |
| AC-2, the prompt: how many and from which pass; when, for each case (lines up; a waiting pass; cannot tell, the queue off included); once, 24 h; no undo; the replacing line | TV111, TV115; B121, B122, B123 | unit; browser |
| AC-2, Cancel sends nothing and changes nothing | B121 | browser |
| AC-2, only what the prompt showed: a changed latest pass is refused plainly, nothing changes, and the panel shows the new state | CH2; TV120; B130, B131 | component; unit; browser |
| AC-2, the answer says what happened, never what the prompt expected | CH25; TV117, TV124; B129 | component; unit; browser |
| AC-3, admins see a disabled Confirm exactly where the owner would, with the reason | PS39; B133 | source pin; browser |
| AC-3, the server decides: signed out, an admin, a user who is neither, another site are refused, nothing changed or recorded | CH27, CH28 | handler; child process |
| AC-3, refused or failed: the reason, then the held list and confirmation as they stand | TV122; TF33; B134 | unit; browser |
| AC-4, recorded: the owner with a shortened key, and when, in story 6's record | CH21; CT51 | component |
| AC-4, the panel: the confirmation in the last 10 actions; the pass that took it up names it and when it was made; what it did stays as today | SR88–SR91; TV125, TV126; B135, B136, B137 | unit; browser |
| AC-4, cannot be recorded: refused as Run is, the snippet's request too; a schedule's start still goes ahead unrecorded | CH12; CT34, CT55 | component |
| AC-4, who may read it: no public read names who confirmed; no shortened key on a pending, expired or unreadable-expiry confirmation; the public status still says pending or expired, of which pass, until when | CL9–CL18; RT39, RT40; CH13, CH29, CH30 | unit; handler; component; child process |
| AC-5, when: interval plus one hour (25 h for daily, the boundary both sides); a calendar rule by its longest gap; the most frequent of several; a refused or failed pass counts; a waiting pass has not begun | OV5–OV12, OV14; TV128; B138, B139 | unit; browser |
| AC-5, what every viewer sees: the warning with both times, and "a pass is waiting" | OV6, OV19; TV128; B138, B139 | unit; handler; browser |
| AC-5, no warning with no enabled entry, or no pass on record | OV2, OV3, OV4; TV131; B138 | unit; browser |
| AC-5, cannot tell: the schedule, the rule, the report, an absent member, a failed status read; never a missing warning for on time | OV12, OV13, OV14, OV16, OV20, OV24, OV29; TV129, TV133, TV134, TV135, TV136, TV137; B140, B141, B154 | unit; module; handler; browser |
| AC-5, the rules judged within bounds (more distinct patterns than the cache, a pattern over 256 characters: cannot tell, nothing judged, whatever stands beside them), and a schedule the verdict cannot judge never fails the status | OV25, OV26, OV27, OV28, OV29, OV30 | module; handler |
| AC-5, the same for every viewer whatever their clock | OV15, OV23; TV132; B142 | unit; handler; browser |
| AC-5, it clears within 10 s of a new pass beginning | OV21; B139 | handler; browser |
| AC-5, it is only a warning: it starts and changes nothing | by construction: `overdueVerdict` is pure (OV1, OV15); the panel's reads stay GETs (the `nonGet` checks in B138–B140) | unit; browser |
| AC-6, focus for Turn off, Stop and Confirm: Cancel → the opener; confirmed, refused, timed out or closed by itself → the outcome line or the section heading; never the page, never Turn on or Run a pass now | PS42, PS43; B143, B144, B145, B148–B153, B155 | source pin; browser |
| AC-7, Confirm changes no schedule entry and not the path's switch | CT72 (Confirm in CT63's world: lined up, a waiting pass, the queue not ready, the add refused) | component |
| AC-7, the pass removes only the confirmed entries still due | the runner suite's existing SR2–SR77 (unchanged); SR88–SR91 add only `mintedAt` | unit |
| AC-7, the confirm route keeps working for the console snippet, its answers and refusals as the panel's | CH26, CH27, CH28; RT17 | handler; child process |
| AC-7, Run and Stop as story 6 defines, apart from AC-6 | story 6's suites, unchanged and green (pass-routes 40/0; pass-control's 61 untouched tests) | component; handler |
| AC-7, the panel's reads change nothing; only this story's control, prompt, record entries, warning, opening line and held wording | PS13, PS14, PS28, PS31, PS44; B9, B10, B11, B38, B94, B146, B147 | source pin; browser |

### ADR decisions

| ADR 0007 decision | Test ids |
|---|---|
| D1, `controller.confirm`; the route keeps its checks; `confirmStep` and `lineUp`'s confirm mode gone | CH1, CH26, CH27; SWR84; RT17–RT19 |
| D2 step 1, the report checks | CH2 |
| D2 step 2, `already-pending` | CH3, CH23 |
| D2 step 3, `held-list-changed` | CH5 |
| D2 step 4, the plan and its precedence | CH6–CH11; CT31, CT32 |
| D2 step 5, the record first | CH12; CT34, CT55 |
| D2 step 6, `confirmation.json` without `mintedBy`; a failed write | CH13, CH14 |
| D2 step 7, the re-read and the withdraw race | CH15–CH18; RT31, RT33 |
| D2 step 8, the add; `takeBackStart` | CH19, CH20; CT33, CT65 |
| D2, every path bumps `generation` | CH22 |
| D3, `validateConfirmation` moved; `pendingFor` | CL1–CL8 |
| D4, the answers | CH6–CH19; RT17–RT19; TF33; TV117–TV124 |
| D5, the `confirm` history line | CH21; CT51 |
| D6, `publicConfirmation` | CL9–CL14; RT4, RT39, RT40; CH29 |
| D7, `latest.confirmation.mintedAt` | SR88–SR91 |
| D8, `overdueVerdict`, the cron judge, `readConfigStrict`, the status member | OV1–OV24 |
| D9, `confirmView` and the role | TV111–TV116; PS39; B118–B120, B133 |
| D10, the prompt | B121–B123, B131; PS41 |
| D11, `sendConfirm`, `confirmOutcome`, the flow | TF32–TF37; TV117–TV124; PS40; B124–B130, B134 |
| D12, who confirmed in the panel | TV125, TV126; B135–B137 |
| D13, the held section's wording, the used-up line | TV116; B11, B123, B132 |
| D14, the overdue line | TV128–TV131; B138–B142 |
| D15, prompt focus | PS42, PS43; B143–B145, B151–B153 |
| D16, copy and comments | PS44; B146 |
| Fix-round notes, D2 step 7: a re-read that fails answers 500 `error` | CH31, CH32 |
| Fix-round notes, D6: each member with its type | CL15–CL18; CH30 |
| Fix-round notes, D8: the bound on the cron work, and no throw | OV25–OV30 |
| Fix-round notes, D14: a failed read after a good one | TV133–TV136; B154 |
| Fix-round notes, D15: one element per target, a control replaced in place | B148, B149, B150, B155 |
| Fix-round notes, round 2, D8: a pattern too long to judge gives cannot tell, whatever stands beside it | OV27 (its cases beside an interval entry and beside the daily cron rule) |
| Fix-round notes, round 2, D14: the reason for the rule names no cause | TV137 |
| Fix-round notes, round 2, D15: decided at the swap, never from focus events; Turn on carries no ref | B150 (its window case); PS43 |
| § Evidence, the fixture and its script | HF1–HF9 (the exports, the Cypher and the source; `create`'s refusals are unpinned, review round 1 follow-up 4) |

### Carry-forwards, ledger rows and the browser baseline

| Item | Test ids, or the change |
|---|---|
| CF1 (code comment) | the Implementer's; the ADR half is in ADR 0006 |
| CF3 (an undatable give-up reads as none) | CT71; CT70's give-up check narrowed to `gaveUp: null` |
| CF4 (no inherited job-id variable reaches the child) | SWR87 |
| CF5 (SWR86's header) | SWR86's header now says that at `2cbf6124` the processor set the variable for every id |
| CF6 (story 6's plan, "D-a2") | story 6's test plan `:129` now names the Deviations bullet "The snapshot too" |
| CF7 (story 6's plan, CT70 unmapped) | story 6's test plan rows D9 and D12 now list CT70 |
| CF8 (BIBLE "join") | the Implementer's |
| NB1 (an abandon hook that throws) | JG27 |
| NB2 (a busy answer with no list is unknown) | TV115, TV127 |
| E1 (story 5's drift guard) | B43 pins "The explained part does not include them": absent while the counts predate the pass, present after a Recount. It holds today, so it passes now |
| R1-opt (CT70 pins which time is recorded at pickup) | CT70: the clock moves 7 s between the add and the pickup, and the start is recorded at the pickup time |
| Ledger `2026-10-28-panel-prompts-return-no-focus` | B143–B145; PS42, PS43 |
| Ledger `2026-10-28-relay-subtab-baseline-stale`, part (a): the baseline matches today | `relay-subtab-requests.json` gains the Negentropy Sync GET by hand. Re-recording is not possible, because the recorder refuses any build containing the panel, and every tree with `ffda8152` has it. Every other sub-tab's source since 2026-09-30 was checked: `fea06ec7` and `458b2607` add no request |
| Same row, part (b): one stale sub-tab hides none of the others | B39's per-sub-tab checks are `expect.soft` |
| Same row, part (c): written where the next story will see it | the spec's header and B39's comment say a story that changes a Relays sub-tab runs B39. The matching note in source is the Implementer's: a comment directly above `const RELAY_TABS = [` in `ui/src/pages/settings/RelaySettings.jsx` |

## Edge cases

- [x] **Concurrent calls.** Two confirmations, one queued behind the other (CH23). The gate's `afterAcquire` queued
  behind a confirmation and the other way round (CH24). A claim landing between the write and the re-read (CH16).
- [x] **A pass that records itself before the plan** (R11) (CH18).
- [x] **Boundaries.** One millisecond before expiry, and exactly at it (CL4, CL5; CH3). 25 h exactly, and 1 ms past it
  (OV5). A weekday rule's 72 h (OV10).
- [x] **A full history.** Taking the start back over a record at its cap of 10 lines (CH20; CT65).
- [x] **Files from before story 7.** A pending confirmation that still carries `mintedBy` serves none of it (CL9; CH29;
  RT39).
- [x] **A hand-edited confirmation** with other members, a non-object, an array (CL10, CL14; RT40).
- [x] **A clock set wrong,** in the process (OV15, OV23; TV132) and in the browser (B142).
- [x] **The fixture over any graph size,** from 0 to 100,000 relationships, holds every one of its removals (HF4).
- [x] **A real removal joining the fixture's held list** fails the check (HF6).
- [ ] **Concept Graph API unavailable; concept handle not found.** Not applicable: the story touches no concept.

## Test infrastructure

- **Runner.** Node's built-in runner through each suite's `run()` export, and Playwright for the browser spec. No new
  framework.
- **Node.** CI and production run Node 22. This host's Node is 16, so:
  - the Node suites ran in the `tapestry` container (Node 22.23.2, the repo bind-mounted);
  - the browser spec ran with a Node 22.23.4 x64 unpacked in the session scratchpad.
- **Concept Graph API.** Not used: the story touches no concept (story § Concepts touched). No firmware precondition.
- **Hermetic.** Every Node suite injects its deps or uses a temp `TAGGING_EDGES_STATE_DIR` and
  `SCHEDULED_TASKS_CONFIG_PATH`. None reads or writes `/var/lib/brainstorm`, Redis, a graph, a relay or the network.
  The fixture suite never runs the fixture script's commands, because in the container `brainstorm.conf` names the
  owner's real graph (HF header).
- **Fixtures.** `test/helpers/taggingEdgesPassFakes.js` (extended additively for the confirmation's file deps) and
  `test/helpers/taggingPipelineFixtures.js` (extended additively for the confirm route, `overdue`, `mintedAt`,
  `confirm` lines and the user's classification).

## How to run

One suite, through its `run()` export, in the container:

```bash
docker exec tapestry sh -c 'cd /usr/local/lib/node_modules/brainstorm && node -e "require(\"./test/tagging-edges-confirm.test.js\").run().then(r=>{console.log(r.pass,r.fail,r.skipped);process.exit(0)})"'
```

Each changed suite in turn (container):

```bash
for s in tagging-edges-confirm tagging-edges-confirmation-lib tagging-edges-overdue tagging-edges-held-fixture tagging-edges-pass-control task-queue-job-gate tagging-edges-pass-routes tagging-edges-wiring tagging-edges-state-routes tagging-edges-runner tagging-pipeline-view tagging-pipeline-fetch tagging-pipeline-panel-source; do docker exec tapestry sh -c "cd /usr/local/lib/node_modules/brainstorm && node -e \"require('./test/$s.test.js').run().then(r=>{console.log('$s',r.pass,r.fail,r.skipped);process.exit(0)})\""; done
```

The fakes' self-check:

```bash
docker exec tapestry sh -c 'cd /usr/local/lib/node_modules/brainstorm && node test/helpers/taggingEdgesPassFakes.js'
```

The browser spec (host Node 22; `<node22>` is the scratchpad's `node-v22.23.4-darwin-x64/bin`):

```bash
docker exec tapestry sh -c 'cd /usr/local/lib/node_modules/brainstorm/ui && npx vite build --outDir ../tmp/tp-dist --emptyOutDir'
```

```bash
python3 -m http.server 4174 --bind 127.0.0.1 --directory tmp/tp-dist
```

```bash
PLAYWRIGHT_HTML_OPEN=never BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:4174 PATH=<node22>:$PATH npx playwright test tests/brainstorm/tagging-pipeline-panel.spec.js --project=chromium
```

Story 7's class alone: add `-g "tagging-edges #7"`; the revised pins: `-g "B9:|B10:|B11:|B38:|B39:|B43:|B94:"`.
Afterwards stop the server and remove `tmp/tp-dist`. `PLAYWRIGHT_HTML_OPEN=never` (added 2026-11-08) keeps a run with a failure from
hanging: off CI, the HTML reporter otherwise serves its report after one and waits for Ctrl+C (ledger
`2026-11-08-local-playwright-run-hangs-on-failure`).

The whole gate is `npm test`, read with `npm run gate:status`, on Node 22.

## Choices the suites make

Where ADR 0007 leaves a detail open, each suite's header states the choice it made. The ones an Implementer will
meet:

- **`confirm` resolves `{status, body}`**, as `lineUp` and `stop` do; a flat body is not accepted (CH header).
- **The route hands the owner's full key** to `confirm`; the record keeps 8 characters. Route tests accept the full
  key or its prefix.
- **`behindStopping`** is checked as true when the line-up is behind a stopping pass, and as anything but true when
  nothing is busy.
- **A failed add.** A time-out answers `QUEUE_UNAVAILABLE`; a refused add may answer `error` (with `cause`) or
  `QUEUE_UNAVAILABLE`.
- **A lined-up pass's start** carries the confirm line's time, and its history line sits above the confirm line.
- **`confirmation.json`** has exactly the seven members D2 step 6 lists.
- **Taking the record back** leaves it byte for byte as it was, or reading the same (empty) where there was no file.
- **`pendingFor`'s boundary** is D3's letter: pending while `nowMs < expiresAt`.
- **`publicConfirmation`** serves an allowlisted member only when present; `{unreadable}` may keep today's
  `expired: false`; an array is served as null.
- **`overdueVerdict` filters its own entries** (taskId and `enabled === true`), and judges a cron itself when no
  `periodOf` is given. `readScheduleEntries()` resolves to the entries array. The `overdue` member's keys are closed:
  `state`, `reason`, `latestBeganAt`, `expectedAt`, `periodMs`.
- **The fixture count** holds every fixture removal for any graph size; wherever the ADR's formula gives more than 50
  it is the formula exactly. `checkHeld` answers `{ok: true | false, …}`. The Cypher strings are found among the
  script's exports.
- **`confirmView` gains `usedUp`** for D13's used-up line, true only when the latest pass is not running, so a running
  pass's first saved record never reads as used up.
- **`confirmOutcome`** is pinned by meaning and tone, not field names. An accepted answer is never `bad`; every other
  answer is never `ok`. Only D11's unknown sentence and the fixed parts of the not-lined-up sentence are pinned word
  for word. A 200 with no or an unknown `outcome` never claims "lined up" or "taken up" (TV124).
- **`sendConfirm(runId, opts)`** takes its options last, as story 6's senders do.
- **The browser spec matches wording by idea,** as the rest of the spec does; the fixed labels exactly: "Confirm held
  removals", "Confirm the removals", "Confirming…", "Cancel".
- **Focus is checked by behaviour** in the browser (the focused element, never refs). The outcome line is a focused
  element in the section that is not a button or heading and whose text is the outcome; the heading is the
  section's first. The admin's reason is "beside" the button within its parent or grandparent.
- **No overdue line** means no "overdue" in the backstop section; its warn tone is the section's border.
- **"Every busy pass has a stop asked for"** is built from a record entry with a stop but no `skip` or `noRerun`
  (CH10, CT32, RT36), and in the browser from a starting pass with a stop asked: see "For the owner", 1.

## Verification

The new and revised tests fail on the current code, each because the feature is missing, never on an import, syntax
or fixture error. Every test that existed before and was not revised still passes. Confirmed on 2026-11-07, on
`feat/tagging-edges-7` at `f0afae51` plus this phase's working tree, Node 22.23.2 in the container:

```
suite                              before      after (pass / fail / skipped)
tagging-edges-confirm              —           0 / 29 / 0
tagging-edges-confirmation-lib     —           0 / 14 / 0
tagging-edges-overdue              —           0 / 23 / 0
tagging-edges-held-fixture         —           0 /  9 / 0
tagging-edges-pass-control         73 / 0      61 / 13 / 0
task-queue-job-gate                27 / 0      26 /  2 / 0
tagging-edges-pass-routes          40 / 0      40 /  0 / 0
tagging-edges-wiring               86 / 0      85 /  2 / 0
tagging-edges-state-routes         62 / 0      54 / 10 / 0
tagging-edges-runner               87 / 0      88 /  3 / 0
tagging-pipeline-view             110 / 0     110 / 22 / 0
tagging-pipeline-codes             54 / 0      54 /  0      (not changed)
tagging-pipeline-fetch             31 / 0      31 /  6
tagging-pipeline-panel-source      38 / 0      34 / 10 / 0
tagging-edges-switch-record        47 / 0      47 /  0 / 0
tagging-edges-realtime-engine      83 / 0      83 /  0 / 0
tagging-edges-drift-route          27 / 0      27 /  0 / 0
taggingEdgesPassFakes self-check   19 / 0      20 /  0
```

Five revised or new tests pass today on purpose, as pins of behaviour that stays: RT4, RT40, SR91, and the refusal
halves of CH27 and CH28 (their positive controls fail). RT14–RT16 and RT20 now run through the controller and pass
before and after. B43 (E1) pins today's drift guard and passes.

Representative failures:

```
CL1  src/lib/tagging-edges/confirmation.js does not exist yet (ADR tagging-edges/0007 D3): expected a module exporting validateConfirmation, pendingFor, publicConfirmation
OV19 the status carries an `overdue` member (ADR tagging-edges/0007 D6, ADR tagging-edges/0007 D8); its members are reportVersion, running, latest, previous, confirmationPending, control
CH1  createController(deps) returns no confirm({ who, runId }) yet (ADR tagging-edges/0007 D1 …); it returns ["lineUp","stop","snapshot","gate"]
RT39 confirmationPending serves ["mintedBy","who","note"] beside D6's allowlist
JG27 acquire should read the hook's throw as false and go on (NB1); it rejected <EHOOK: the abandon hook threw>, leaving the lease ["…"] held for its lifetime
TV127 no busy member: known must be false; got {"known":true,"why":null,"items":[],"canStop":false}
PS31 …HeldSection.jsx not implemented yet: no <button> in …HeldSection.jsx is named ["Confirm held removals","Confirm the removals"] — Confirm is on the panel
```

**The browser spec** (Playwright, chromium, host Node 22.23.4, today's UI built in the container):

```
before story 7's changes:  121 tests, 120 passed; B39 failed on the Negentropy Sync sub-tab only (the stale baseline)
after:                     151 tests, 120 passed, 31 failed
failing:                   B11 (revised: D13 replaces the expired wording it pinned) and B118–B147 (new)
green again:               B39 (soft checks, every sub-tab matching the baseline); B9, B10, B38, B43, B94 (revised)
every story 4–6 case that passed before still passes
```

The failures are the missing feature: "Confirm held removals" not in the held section, no prompt to act on
(`element(s) not found` after the missing button), no took-up or used-up line, no overdue line, the opening line
unchanged, and focus falling to the page (B143, B144). None is a syntax, import or fixture error.

**The tests can be met.** Each lane also ran against a throwaway sketch of ADR 0007 kept only in the session
scratchpad, never in the repo: every new and revised Node test passed against it. Breaking the sketch on purpose was
caught by the test meant for it: four ways on the server (`mintedBy` written; no generation bump on a refusal; a waiting
pass checked before a starting one; a pass with a stop asked joined), and twenty-five in the panel's suites.

### Fix round (review round 1, 2026-11-07)

Review `engineering-team/reviews/done/tagging-edges/7-confirm-held-removals.md` asked for these tests (blocking 1,
requested 2 to 10). They pin ADR 0007 § Fix-round notes. Each suite was run alone through `run()` on host Node
22.23.4, and the browser spec on chromium, at `7be349a6` plus this round's tests:

```
suite                              before        after (pass / fail)
tagging-edges-pass-control          74 / 0        75 / 0      CT72 green on purpose
tagging-edges-overdue               23 / 0        25 / 4      OV24, OV28 green on purpose; OV25, OV26, OV27, OV29 red
tagging-edges-confirmation-lib      14 / 0        15 / 3      CL18 green on purpose; CL15, CL16, CL17 red
tagging-edges-confirm               29 / 0        30 / 2      CH32 green on purpose; CH30, CH31 red
tagging-pipeline-view              132 / 0       133 / 2      TV135 green on purpose; TV133, TV134 red
browser spec                       151 / 0       154 / 4      B151, B152, B153 green on purpose; B148, B149, B150, B154 red;
                                                              B129 now stages its next read, and stays green
```

- **What the red tests are waiting for:**
  - OV25 to OV27: the bound;
  - OV29: the throw caught;
  - CL15 to CL17 and CH30: the types;
  - CH31: the failed re-read's answer;
  - TV133, TV134 and B154: the failed read;
  - B148 and B149: the held section's element identity (focus falls to `document.body`, or moves to Cancel and the
    heading);
  - B150: Turn off replaced in place by Turn on.

  None fails on an import, syntax or fixture error.
- **Green on purpose**, each checked against a planted fault in a scratch copy:
  - CT72 is AC-7's first bullet. It fails on a `removeJobScheduler` call, a changed schedule file, or a changed
    `switch.json`.
  - OV24 is the default reader. It fails when that reader is swapped for `readConfig()`.
  - CL18, CH32, TV135 and B151 to B153 pin behaviour that already holds.
- **Readings the suites chose:**
  - "distinct" is distinct trimmed patterns;
  - the 256/257 boundary is the daily rule padded with spaces, which cron-parser accepts;
  - a long rule alone counts with no period, so it gives cannot-tell/rule;
  - OV29 expects the status route's catch;
  - for a re-read that finds no report, any cause that `allowErrorCode` keeps is accepted;
  - `Date.parse(7)` reads as a date, so CL16 pins that a number `expiresAt` is left out, with `expired: false`.
- **Not pinned:**
  - more than 32 patterns beside a positive interval entry. The D8 note gives cannot-tell/rule;
  - the overdue line during a Retry after a failed read;
  - a focused opener that a later read removes (Confirm when another tab's confirmation is pending, or Stop once
    nothing is busy). D15's note covers only an opener replaced in place.

### Fix round 2 (review round 2, 2026-11-08)

Review round 2 asked for these tests: blocking 1 and 2, requested 3 and 4. They pin ADR 0007 § Fix-round notes,
round 2. Each suite was run alone through `run()` on host Node 22.23.4, and the browser cases on chromium, at
`20c5efa7` plus this round's tests:

```
suite                     before     after (pass / fail)
tagging-edges-overdue     29 / 0     29 / 1    OV30 green on purpose; OV27 (revised) red
tagging-pipeline-view    135 / 0    136 / 1    TV136 green on purpose; TV137 red
browser spec, B150, B155   1 / 0      1 / 1    B155 green on purpose; B150 (revised) red
```

- **Four new tests and two revised:** OV30, TV136, TV137 and B155 are new; OV27 and B150 are revised. Three are red
  before the fix:
  - OV27: a pattern longer than 256 characters beside a daily interval entry, and beside the daily cron rule, reads
    on time. Its case beside the interval entry pinned that wrong answer until this round;
  - TV137: the line for `cannot-tell`/`rule` names R13's cause;
  - B150: after the window loses focus, focus is on "Turn on" once the read lands.

  None fails on an import, syntax or fixture error.
- **Green on purpose,** each checked against a planted fault in the working tree, then put back:
  - OV30 fails when the over-32 bound is applied only when every entry is a cron;
  - TV136 fails when the Retry branch (`state 'loading'` with an error kept) is taken out of the failed-read check;
  - B155 fails when the Confirm prompt's key is taken out, on its second read. On its first read, to the running
    branch, the prompt sits at the same place among the section's children, so it is kept without the key; the read
    to the branch with nothing held is what tells.
- **Readings the suites chose:**
  - a long pattern gives cannot-tell/rule whatever stands beside it. This replaces round 1's reading that it counts
    with no period;
  - B150's window case fires what a browser fires when its window or tab loses focus: `blur` and `focusout` on the
    focused element, then `blur` on the window. Its setup checks that "Turn off" is still `document.activeElement`;
  - TV137 checks that the rule line still says "rule", which B140 and TV134 need, and names no cause.
- **Round 1's "Not pinned"** has two of its three items pinned now: OV30 and TV136. The third, a focused opener that a
  later read removes, waits on the owner's decision (review round 2, § For the owner).

### Record fixes (review round 3, 2026-11-08)

Review round 3 asked for these (requested 3 and 4). No test's verdict changed.
- **The coverage map** names TV136, TV137, OV30 and B155 in their rows, and has three rows for the round-2 notes.
- **Two titles quote the ADR as written:** OV27 (round 2's D8, "on an enabled entry for the pass"), and B155 (D15,
  "While under way. A prompt whose send starts moves focus to its own h4").
- **OV30's hourly case** now starts its latest pass 2 h 1 min ago, and a setup check pins what each interval entry says
  alone: on time for the daily one at 2 h, overdue for the hourly one at 2 h 1 min. At exactly 2 h the hourly entry
  says on time, since the comparison is strict, so the old title was wrong. OV30 is still green (overdue 30/0), and it
  still fails against its planted fault (29/1; the log is kept in the session's scratch, `verify/r3-recfix-ov30-plant.log`).

## For the owner (at this gate)

1. **"Every busy pass has a stop asked for" may be unreachable while the held list is still the latest.** A Stop takes
   a waiting pass out of the busy list. A running pass has recorded itself, so its report is the latest and the
   confirmation is refused at D2 step 1, or caught at step 7. The tests build the case from a record entry with a stop
   and no `skip`, and in the browser from a starting pass with a stop asked. Story 7's Planning added the rule so the
   owner is never stuck; the behaviour is pinned either way. Whether a real flow reaches it is a question for the
   Architect, and changes no test.
2. **A pending confirmation for an earlier pass** shows PassControls' story 6 line, "The next pass to get past its
   start checks takes it up". That pass would claim it, but it would not honour it (`report-changed`). ADR 0007 D13
   does not reach that line, so no test pins it. A one-line wording change belongs to the Architect or the Product
   Owner.
3. **After D8, a `handleStatus` that is not handed `readScheduleEntries`** reads `scheduled-tasks.json` itself. The
   only readers that do so are older suites that call `handleStatus`; in the container that is a read of the real
   `/var/lib/brainstorm/scheduled-tasks.json`, never a write. The story 7 suites inject it.
