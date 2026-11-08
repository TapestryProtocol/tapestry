# ADR 0007: Confirming held removals on the panel: one controller step per confirmation, the record first, an overdue verdict on the public status, and focus that returns

**Status:** Accepted (2026-11-07)
**Date:** 2026-11-07
**Story:** `engineering-team/stories/tagging-edges/7-confirm-held-removals.md`
**Amends:** ADR `tagging-edges/0002` (the confirm route's sequence and answers, C12's public confirmation) and ADR
`tagging-edges/0006` (D8, D11's history, D12's status members, R-items named below), with dated notes (§ Amendments).

## Context

Story 7 puts "Confirm held removals" on story 4's panel, for the owner only, after a prompt. It records who confirmed
and when in story 6's record of actions, and takes the owner's shortened key off the public status. It also adds an
overdue-pass warning (AC-5), makes the panel's three prompts return focus (AC-6), and carries story 6's review
leftovers. The terms below (busy, waiting, running, the held list, the owner's confirmation, pending, action) are the
story's. "Running" is story 6's: a pass past the gate's waiting→running boundary, a *starting* one (launched, no
report yet) included (ADR 0006 D3, D5).

### What exists (read at `1044e193`, which is `origin/staging` `7acc2df6` plus the story)

**The confirm route** (`src/api/tagging-edges/index.js:275-368`, `handleConfirmHeldRemovals`):
- **Who, outside any chain.** Session (401), the owner by configuration (403 "Owner access required"), `sameHost`
  (403), JSON (415), `runId` grammar (400). It is mounted behind `adminApi.requireOwnerOnly`
  (`src/api/index.js:536`); the route table keys it `OWNER_ACTION` (`src/middleware/routeAccess.js:441`), so the
  middleware admits the owner or an admin and `requireOwnerOnly` refuses the admin.
- **Then, with no serialisation at all:**
  1. reads `report.json` and runs `validateConfirmation` twice (`:124-140`): 409 `not-the-latest-report`,
     `nothing-held`, or `running` (the held run's own process still alive);
  2. reads the held list and checks its digest: 409 `held-list-changed`;
  3. **writes `confirmation.json` unconditionally** (`:310-325`), a new nonce and a new 24 h, carrying
     `mintedBy: owner.slice(0, 8)`;
  4. re-reads the report; if the latest changed, withdraws by rename: renamed → 409 `pass-started`; already gone (a
     pass claimed it) → 200 `claimedBy`; rename threw → 500 `withdraw-failed` (`:327-342`);
  5. calls `d.lineUp({who: {kind: 'confirmation'}, mode: 'confirm'})` when `queueHealth()` is ready (`:344-364`).
- **What that means for this story:**
  - a second confirmation is accepted, replacing the first's nonce and expiry, and lines up or joins again (AC-1
    wants it refused);
  - who confirmed is written only into `confirmation.json`, which the public status serves (AC-4 wants it private);
  - the record of actions is written only by `confirmStep`'s start, which "cannot be refused for want of a record"
    (ADR 0006 D8; `control/index.js:521-538`), so an unrecordable confirmation goes ahead (AC-4 wants it refused);
  - steps 1–4 run outside the controller's chain, so two confirmations, or a confirmation and the gate's
    waiting→running step, can interleave.

**The controller** (`src/pipeline/tagging-edges/control/index.js`):
- One promise chain per process (`step`, `:176-180`); `compute()` is the busy snapshot (`:330-449`); `commit` writes
  the record inside the chain, refuses while the record gives a read error, and renames a damaged file aside first
  (`:252-267`); `commitStart` keeps a copy of the record it wrote over, for `takeBack` (`:286-299`).
- **`confirmStep`** (`:522-539`): `queue !== 'ok'` → `{enqueued: false}`; any busy item with no stop asked for →
  `{enqueued: true, joined: true}`, whatever its state; otherwise a new job under its own key, its start recorded as
  `{kind: 'confirmation'}`, written or not.
- The controller requires no route module (ADR 0006 D1).

**The pass** (`src/pipeline/tagging-edges/reconcileTaggingEdges.js`):
- **Order.** Lock checks, then the pessimistic first save (the run becomes the report's latest), then identities,
  config, the schema pre-flight, then step 7, the claim (`:375-395`). A pass refused at a start check writes its
  report and never claims.
- **The claim.** `claimConfirmation` renames `confirmation.json` into `claimed/<runId>-<nonce>.json`, atomic, so
  exactly one of a claim and a withdraw wins (`state.js:199-238`).
- **What it records.** `latest.confirmation = {found, honoured, why?}` and, when honoured,
  `latest.confirmed = {confirmedRunId, heldCount, removalsApplied, heldNoLongerDue}`. Nothing says when the
  confirmation it took up was made.
- **`validateClaim`** (`:161-174`) judges against the newest *earlier* run that reached `graph-read`. So a
  confirmation survives a refused pass in between, and one for an earlier pass, while a newer pass holds a different
  list, is never honoured (`report-changed`).

**The public status** (`handleStatus`, `:211-226`; `computeStatus`, `:104-118`):
- `confirmationPending` is `confirmation.json` minus its nonce (ADR 0002 C12), so it carries `mintedBy`; a read that
  throws is served as `{unreadable: <code>}`.
- `control` is the busy snapshot (ADR 0006 D12).
- No member says anything about the schedule.

**The schedule** (`src/api/scheduled-tasks/index.js`):
- Entries live in `scheduled-tasks.json` (`CONFIG_PATH`, env-overridable, `:32-33`). `readConfig()` (`:119-142`)
  **swallows a read or parse error** (`console.error`) and returns an empty, migrated config, so a failure reads as
  "no entries".
- The scheduler's rule is `toRepeatOpts` (`queue/scheduler.js:44-51`): a non-blank cron wins (BullMQ `pattern`, parsed
  by `cron-parser` with no `tz`, so in the process's zone: UTC in the container); otherwise days, hours and minutes
  sum to `every`.
- `cron-parser@4.9.0` is a direct dependency (`package.json:68`).
- The panel reads `GET /api/scheduled-tasks/list` every 60 s (`SCHEDULE_POLL_MS`), because that handler reads each
  entry's task log. The view's `scheduleView` has no cron parser (`cronWeakerThanDaily`, `taggingPipelineView.js:976`).

**The panel** (`ui/src/pages/settings/taggingPipeline/`):
- **Role.** It knows none (ADR 0006 Context). `useAuth().user.classification` is `'owner'` or `'admin'` for anyone the
  Settings page admits (`ui/src/utils/auth.js:7`; `ui/src/pages/settings/Index.jsx:127`).
- **HeldSection** shows the held list and `ConfirmationLine` in passView's five states; it offers nothing.
- **The Stop prompt and the Turn off prompt** (`PassControls.jsx:44-73`, `PathSwitch.jsx:51-73`):
  - both move focus to Cancel when they open, and do nothing about focus when they close;
  - Cancel unmounts the focused element, so focus falls to the page;
  - a pressed Stop is disabled while under way, which drops focus too.
- **Sections.** `Section`'s `<h3>` takes no ref and no `tabIndex` (`parts.jsx:66-79`).
- **The no-Confirm pins** (B10, the source check over the panel's buttons, the held list's check, and the Stop
  prompt's check) refuse any button named `/confirm/i`.

### Constraints

- **Everything the story says.** In particular:
  - the server decides who may confirm;
  - a second confirmation of a pending held list changes nothing and records nothing;
  - a confirmation that cannot be recorded is refused, the console snippet's included, while a schedule's start
    still goes ahead unrecorded;
  - never a false "lined up" or "taken up";
  - no public read names who confirmed;
  - the overdue verdict is the same for every viewer, whatever their clock;
  - focus never falls to the page and never lands on Turn on or Run a pass now.
- **ADR 0006's binding stands:** every start of this pass from app code goes through the controller; the gate is the
  only place that decides whether a job runs; the record is written only by the controller, inside its chain; the
  view stays clock-free and keeps the 15 s race in `taggingPipelineFetch.js`.
- **The pass keeps one writer for `report.json`** and its behaviour (AC-7). An additive report member is allowed, as
  story 6 added `job`.
- **Principle 4.** Nothing here writes graph state. The evidence fixture (§ Evidence) writes only nodes and
  relationships it creates, and removes only those.
- **Who never goes anywhere a signed-out reader can see** (ADR 0006 § Constraints): `report.json`, `confirmation.json`,
  `claimed/` names, `events.jsonl`, logs, job data.

## Options considered

### Option A: one controller step owns the whole confirmation (chosen)

A new controller method, `confirm({who, runId})`, runs every check and write of a confirmation in **one chain step**:
the report checks, the pending check, the held list, a fresh snapshot, the record, `confirmation.json`, the re-read
and its withdraw, and the line-up. The route keeps only the pure who and body checks, as Run's and Stop's do.

- **Pros.**
  - Two confirmations are serialised, so "a second is refused" needs no file lock.
  - The gate's waiting→running step (`afterAcquire`) cannot land between the snapshot and the line-up decision, so
    "a waiting pass takes it up" is decided against a state that cannot move under it.
  - The record is written first, in the same step, so an unrecordable confirmation changes nothing, as Run's does.
  - One answer, built in one place, names what happened.
- **Cons.**
  - The confirmation's file work moves into the controller: it gains deps (`readHeld`, `heldDigest`,
    `writeConfirmation`, `withdrawConfirmation`, `nonce`).
  - `validateConfirmation` must move to a pure lib module, since the controller requires no route module.
  - A slow held-list read holds the chain; the held file is local and the digest is milliseconds.

### Option B: keep the route's sequence and add three guards around it

Add a pending check before the write, a controller step that records the confirmation, and keep `lineUp`.

- **Pros.** Smaller diff in `index.js`.
- **Cons.**
  - Three chain steps, or none, for one action. Two confirmations can both pass the pending check.
  - A gate step can land between the record and the line-up, so the answer can name a waiting pass that has
    begun.
  - The record-first rule needs a take-back across two steps.

Rejected: it keeps the races the story's AC-1 and AC-4 rule out.

### Option C: a file-level guard (create `confirmation.json` with `O_EXCL`, or a lock file)

- **Pros.** It serialises confirmations across processes, not only in this one.
- **Cons.**
  - Replacing a confirmation that cannot be relied on needs an overwrite, which `O_EXCL` refuses.
  - It does not order the record, the line-up or the gate.
  - Only the control panel process ever writes a confirmation; the pass only renames one.

Rejected.

### The overdue verdict: where it is computed

- **A. On the server, as a member of the public status (chosen).** The status is read every 5 s by every viewer, so
  the warning clears within 10 s of a new pass beginning, and the server's clock decides. A cron rule is judged with
  the same `cron-parser` the scheduler uses.
- **B. In the view, from the schedule list and a server time on the status.** It needs a cron parser in the browser
  bundle, and joins two reads with different cadences (5 s and 60 s). Rejected.
- **C. A new read route.** One more route, request pin and route-table entry, for nothing the status cannot carry.
  Rejected.

## Decision

We chose **option A**, with the overdue verdict on the public status. A is the only option that decides every case
AC-1 names (pending, waiting, starting, stopping, the finishing window, a pass starting mid-confirmation) in one
serialised place, against one snapshot, with the record written before anything else changes. Its costs are known:
- the confirmation's file work moves into the controller;
- one pure module (`src/lib/tagging-edges/confirmation.js`) and one more (`src/lib/tagging-edges/overdue.js`) are
  added;
  *(Amended 2026-11-07: the second is `src/pipeline/tagging-edges/overdue.js`; see D8's note.)*
- the pass writes one more report member.

## Consequences

**Enables:**
- Confirm on the panel for the owner, a disabled Confirm with its reason for admins, and one answer per case for the
  panel and the console snippet alike.
- A confirmation in story 6's history, by the owner with a shortened key, and the pass that took it up named with
  when it was made.
- An overdue warning that every viewer sees the same.
- Prompts that keep a keyboard user's place.

**Constrains:**
- **Every confirmation goes through `controller.confirm`.** Nothing else may write `confirmation.json`.
- **`confirmationPending` on the public status is an allowlist** (D6). A new field reaches signed-out readers only by
  being added to it.

**Residuals:**
- **R10. A waiting or starting pass may still not take a confirmation up.** "The waiting pass takes it up" is the
  state at the answer. A later event can still intervene: a Stop of that pass (the confirmation stays pending, story
  6), a start check that refuses it, or a 4 h give-up. The panel shows each from its next read, and the confirmation
  stays pending for the next pass until it lapses. The story accepts this ("a Stop of a waiting pass leaves it
  pending").
- **R11. A pass started outside the gate** (a hand run of the wrapper) can record itself between the snapshot and the
  re-read. The withdraw race then decides it, as today: taken up, withdrawn, or cannot tell. This is the story's "a
  pass that has only just started … may still take the confirmation up; the answer says which".
- **R12. The overdue verdict reads `scheduled-tasks.json` on the server.** The panel's own schedule list read can fail
  while the verdict is known, and the other way round. The backstop section then shows the list's failure and the
  verdict side by side. That reading of AC-5's "when the schedule list cannot be read" is one the owner ratified
  (§ "Readings the owner ratified with this ADR").
- **R13. A cron rule the server cannot judge** (fewer than two runs in 400 days, such as one for 29 February) reads
  "cannot tell", never "on time".

**Debt and follow-ups:**
- The ledger row `2026-10-28-panel-prompts-return-no-focus` closes with this story; `2026-10-28-relay-subtab-baseline-
  stale` closes only when the Tester's three parts land (story § Test tasks).
- Row `2026-10-30-prod-pass-gap-unnoticed` gets its dated note at the ship; its cause stays open.

**Firmware reinstall required?** No. No concept definition changes.

## Readings the owner ratified with this ADR

Four readings this ADR makes beyond the story's letter:
1. **A starting pass is joined, not refused** (D2 step 4). A Confirm that meets a pass launched but not yet recorded
   answers that "a pass that had just begun takes it up". The panel itself does not offer Confirm then (D9), so only
   a stale panel or the console meets this.
2. **The pass records when the confirmation it took up was made** (`latest.confirmation.mintedAt`, D7). That time is
   public on the report, as it already is on a pending confirmation. Who is not.
3. **The overdue verdict reads the schedule's file on the server** (R12).
4. **An expired confirmation counts as one that "this one replaces"** in the prompt (D10), beside the three AC-1
   names, because the server replaces it the same way and no pass carries it out.

## Implementation notes

Line numbers are at `1044e193`; prefer the named functions if they have moved.

### Server

**D1. `controller.confirm({who, runId})`: one chain step.**
- **The route.** `handleConfirmHeldRemovals` keeps its checks before the chain, in today's order: session (401), owner
  (403), `sameHost` (403), JSON (415), `runId` grammar (400). Then it calls
  `d.confirm({who: {kind: 'owner', key: owner}, runId})` and sends `{status, body}` as Run's handler does.
  - **Every handler resolves and never rejects** (ADR 0006 D6): a throw from a dep answers 500 `{code: 'error',
    cause: allowErrorCode(code)}`.
  - `index.js`'s `defaultDeps` gains `confirm`, from the default controller, and loses `writeConfirmation`,
    `withdrawConfirmation`, `heldDigest`, `nonce`, `lineUp` and `queueHealth` (the controller's now). `snapshot` stays,
    for the status.
- **The controller.** `createController` returns `confirm` beside `lineUp`, `stop` and `snapshot`. `confirm` runs
  `step(() => confirmFlow(normalWho(who), runId))`. `normalWho` keeps an 8-character key for the owner (D11 of 0006).
- **Its new deps** (defaults reach `state.js` lazily, as the others do): `readHeld(runId)`, `heldDigest(list)`,
  `writeConfirmation(record)`, `withdrawConfirmation()`, `nonce()` (`crypto.randomBytes(16).toString('hex')`, C13).
  `readReport`, `readConfirmation`, `isAlive`, `now` exist.
- **`confirmStep` goes.** `lineUp({mode: 'confirm'})` is no longer called by anything; remove the mode. RT17's and
  RT18's `lineUp` pins are revised by the Tester (§ Seams).

**D2. The step, in this order.** Nothing is written before step 5; every path bumps `generation`.
1. **The report.** Read `report.json`. Run `validateConfirmation({body: {runId}, report, alive})` with liveness of
   `latest.process`, as today: 409 `not-the-latest-report`, `nothing-held`, or `running`.
2. **The pending check** (D3). Read `confirmation.json` (`readConfirmation`; a throw reads as unreadable). If
   `pendingFor(record, latest, now)` is true: 409 `{code: 'already-pending', runId, expiresAt}`. Nothing is written or
   recorded.
3. **The held list.** `readHeld(latest.runId)`; missing, or a digest unequal to `latest.held.digest`: 409
   `held-list-changed`.
4. **The plan,** from `compute()` (fresh), in this order of precedence:
   - `queue !== 'ok'` → **`none`**, with `reason: 'QUEUE_UNAVAILABLE'`;
   - a running item with no stop asked for (starting: `runId` null; or, defensively, any other) → **`starting-pass`**;
   - a waiting item with no stop asked for → **`waiting-pass`**;
   - otherwise (nothing busy, the finishing window included, or every busy item has a stop asked for) →
     **`line-up`**, with `behindStopping: true` when anything is busy.

   A starting pass is ahead of any waiting one, so it is named first.
5. **The record first** (D5). One `commit` writes the confirm line and, for `line-up`, the start entry and its line
   under a new key from `d.randomKey()` (added to `linedUp`). Keep the record it wrote over (`prior`), as
   `commitStart` does.
   - The record is unreadable, or the write fails → 500 `{code: 'record-unavailable', cause}`. Nothing else is written.
6. **`confirmation.json`.** Write `{version: 1, runId, heldDigest, heldCount: list.length, nonce, mintedAt,
   expiresAt}`, with `mintedAt` the confirm line's `at` and `expiresAt` 24 h later. **No `mintedBy`.**
   - A failed write: take the record back to `prior`, best effort, and answer 500 `{code: 'confirmation-unwritten',
     cause}`. Nothing is pending.
7. **The re-read.** Read `report.json` again. If `latest.runId` is no longer `runId` (a pass recorded itself since
   step 1), withdraw:
   - **renamed:** take the record back to `prior` → 409 `{code: 'pass-started'}`. Nothing changed.
   - **already gone** (that pass claimed it): take back only the start, if any (`takeBackStart`, below) → 200
     `{outcome: 'taken-up', claimedBy}`.
   - **the rename threw:** take back only the start → 500 `{code: 'withdraw-failed', cause}`. The confirmation may
     stand; the confirm line stays, so the history shows it.
8. **The line-up,** for `line-up` only: `add(key, timeoutMs)`, bounded, as Run's.
   - A failure or time-out: put the key in `skips` (R1), take back only the start, and answer 200
     `{outcome: 'not-lined-up', reason: 'QUEUE_UNAVAILABLE' | 'error', cause?}`. The confirmation stays pending.
9. **Answer** (D4).
- **`takeBackStart`**: restore `prior`'s `passes` and `history`, then re-add the confirm line, pruned as every write
  is. The record then reads as if only the confirmation had been asked for (the ADR 0006 Amendment 1 § C rule).

**D3. The pure confirmation module: `src/lib/tagging-edges/confirmation.js`.**
- **Moves here:** `validateConfirmation` (from `index.js:124-140`, unchanged). `index.js` re-exports it, so its
  existing pins hold.
- **New: `pendingFor(record, latest, nowMs)`**, true only when all hold:
  - `record` is an object with `version === 1`;
  - `record.runId === latest.runId` and `record.heldDigest === latest.held.digest`;
  - `Date.parse(record.expiresAt)` is finite and `nowMs < expiresAt`.

  Anything else is not pending and is replaced by step 6: no record, an unreadable or malformed one, an expired one,
  one with an unreadable expiry, and one for another run (an earlier pass's, or the same run's with another digest).
- **New: `publicConfirmation(record, nowMs)`**, the status's allowlist (D6).
- Plain CommonJS with no I/O, so the controller, the routes and the gate's tests require it alike.

**D4. The answers.** The members the console snippet reads today stay (`success`, `confirmed`, `enqueued`,
`expiresAt`, `jobId`, `joined`, `claimedBy`). Every accepted answer adds `outcome`, which the panel reads.

| Status | Body | When |
|---|---|---|
| 200 | `{success: true, confirmed: true, outcome: 'lined-up', enqueued: true, jobId, behindStopping, expiresAt}` | nothing busy, or every busy pass has a stop asked for |
| 200 | `{…, outcome: 'waiting-pass', enqueued: true, joined: true, expiresAt}` | a pass waiting with no stop asked for takes it up |
| 200 | `{…, outcome: 'starting-pass', enqueued: true, joined: true, expiresAt}` | a pass that had just begun takes it up (R11 aside) |
| 200 | `{…, outcome: 'taken-up', enqueued: false, claimedBy, expiresAt}` | a pass that started meanwhile claimed it |
| 200 | `{…, outcome: 'not-lined-up', enqueued: false, reason, cause?, expiresAt}` | the queue unavailable, or the add failed; it stays pending |
| 409 | `{success: false, code: 'already-pending', runId, expiresAt}` | a confirmation of this held list is pending |
| 409 | `not-the-latest-report`, `nothing-held`, `running`, `held-list-changed` | as today |
| 409 | `pass-started` | a pass started meanwhile; withdrawn, nothing changed |
| 500 | `record-unavailable`, `confirmation-unwritten`, `withdraw-failed`, `error` | with `cause` through `allowErrorCode` |
| 401, 403, 415, 400 | as today | before the chain |

- **No answer carries a full pubkey** or who. `claimedBy` is a run id.
- **The 409 and 500 bodies keep `error`** beside `code`, as today, for the snippet's reader.

**D5. The record: a `confirm` action.**
- **The line.** D11's `history` gains `{action: 'confirm', key: null, at: <mintedAt>, who: {kind: 'owner', key: <8
  hex>}, runId: <the held run's id>}`. `version` stays 1: the change is additive.
- **The start.** For `line-up`, the start entry and line stay story 6's, `who: {kind: 'confirmation'}`, written in the
  same `commit` as the confirm line. The confirm line is written first, so the start shows above it (newest first; the
  sort is stable).
- **Pruning** is unchanged: a line whose `key` is null keeps no entry.
- **Refused when it cannot be written** (step 5). This replaces ADR 0006 D8's "cannot be refused for want of a record".
  A schedule's start still goes ahead unrecorded (0006 D3).
- **Who is never logged.** The route's warning line, if one stays, carries a code only.

**D6. The public status.**
- **`confirmationPending`** becomes `publicConfirmation(record, now)`:
  - null → null; a read that threw → `{unreadable: <code>}`, as today;
  - an object → only `version`, `runId`, `heldDigest`, `heldCount`, `mintedAt` and `expiresAt`, each when present,
    plus the derived `expired`;
  - anything else → null, as `withoutNonce` gives today.

  So `mintedBy` and the nonce never reach a signed-out reader, whether the file was written before this story or
  after, or edited by hand. This supersedes ADR 0002 C12's "every field of the record except `nonce`".
- **`overdue`**: a new member (D8), computed per request from server time.
- **`latest.confirmation.mintedAt`** reaches the public status through the report (D7).
- **Nothing else changes.** `held`, the path status and the Task Explorer's data carry no who today; the Tester pins
  that they still do not (story § Test tasks).

**D7. The pass: when the confirmation it took up was made.**
- In step 7 (`reconcileTaggingEdges.js:385-394`), `latest.confirmation` gains `mintedAt`: the claim's `mintedAt` when
  it parses as a date, as an ISO string, else null. It is set on `found: true` only, honoured or not.
- **Old reports** have no `mintedAt`; the view reads that as "when not recorded".
- **Nothing else in the pass changes.** `reportVersion` stays 1.

**D8. The overdue verdict: `src/lib/tagging-edges/overdue.js`.**
*(Amended 2026-11-07, at Implementation, on the owner's decision: the module is `src/pipeline/tagging-edges/overdue.js`.
Story 1's purity pin (`test/tagging-edge-contract.test.js`, "purity") refuses `new Date` and any require but a sibling's in
every file of `src/lib/tagging-edges/`, and the cron judge needs both `cron-parser` and dates. `src/pipeline/tagging-edges/`
carries no such pin. Nothing else in D8 changes; the overdue suite's module path follows.)*
- **`overdueVerdict({entries, latest, nowMs, periodOf})`**, pure:
  - **`entries`** are the schedule entries with `taskId === 'reconcileTaggingEdges'` and `enabled === true`. None →
    `{state: 'no-entry'}`.
  - **The period** of each: a non-blank cron (trimmed) wins, as in `toRepeatOpts`; otherwise days, hours and minutes
    in ms when positive. An entry with neither, or a cron that does not parse, does not run the pass and is not
    counted. None counted → `{state: 'no-schedule'}`.
  - **A cron's period** is `periodOf(pattern, nowMs)`: the longest gap between consecutive runs, from
    `cron-parser`'s `parseExpression(pattern, {currentDate: new Date(nowMs)})` (no `tz`, as BullMQ), iterating `next()`
    up to 1,000 runs or until a run is more than 400 days after `nowMs`. Fewer than two runs → null (R13). Results are
    cached per pattern, at most 32.
  - **The most frequent counts:** the smallest known period. When every counted entry's period is null →
    `{state: 'cannot-tell', reason: 'rule'}`.
  - **No pass on record** (no `latest`) → `{state: 'no-pass'}`.
  - **`latest.startedAt`** unparseable → `{state: 'cannot-tell', reason: 'report'}`. A refused or failed pass counts:
    it has a `startedAt`. A waiting pass, or one that gave up waiting, wrote no report and so has not begun.
  - **Otherwise** `expectedAt = startedAt + period`; `overdue` when `nowMs > expectedAt + 3,600,000`, else `on-time`.
    Both carry `{latestBeganAt, expectedAt, periodMs}`, ISO times.
- **The reader.** `src/api/scheduled-tasks/index.js` gains `readConfigStrict()`: the same `CONFIG_PATH`, migration and
  fresh-install seeding as `readConfig()`, but a read or parse error **throws**. `readConfig()` becomes a wrapper that
  catches and logs, so its callers are unchanged.
- **In `handleStatus`:** `answer.overdue` = `overdueVerdict(...)` over `d.readScheduleEntries()` (a new dep calling
  `readConfigStrict()`), the report it already read, and `d.now()`. A throw from the reader →
  `{state: 'cannot-tell', reason: 'schedule'}`. The status never fails for it.

### UI

**D9. Who sees Confirm: `confirmView` and the role.**
- **The role.** `TaggingPipelinePanel` reads `useAuth().user.classification`: `'owner'` → `role: 'owner'`; `'admin'`
  → `'admin'`; else null (no Confirm of either kind). It passes `role` to `HeldSection`. The server still decides
  (AC-3).
- **`confirmView(statusBody, held, runId)`**, a new pure view function → `{offer, runId, count, replaces, when}`.
  `offer` is true only when all hold:
  - the held section's `runId` is set (the latest pass held removals and no pass runs by liveness);
  - the held list's read is `ready` for that `runId` (AC-1 "until the held list is read");
  - no `control.busy` item is running with no stop asked for (story 6's running, a starting pass included);
  - passView's confirmation is not `pending` with `runId` equal to the latest's.
- **`replaces`** is true when passView's confirmation is `unreadable`, `unknown-expiry`, `expired`, or `pending` for
  another run.
- **`count`** is the held list read's `total`.
- **`when`**, from `busyView`:
  - `known` false (the queue off, not ready, or a read failed) → `'cannot-tell'`;
  - a waiting item with no stop asked for → `'waiting-pass'`;
  - otherwise → `'lines-up'`.
- **The controls.** In HeldSection's ready branch, after `ConfirmationLine`:
  - the owner: a `btn-small` "Confirm held removals" that opens the prompt;
  - an admin: the same button `disabled`, and beside it "Only the owner can confirm held removals." It sends nothing.

  Both render exactly when `offer` is true.

**D10. The prompt.**
- **The pattern** is story 5's and 6's: an inline `settings-group` with an `h4` that replaces the button while open,
  never `ConfirmDialog` or `window.confirm`. Focus moves to Cancel when it opens.
- **The snapshot.** `confirmView`'s `{runId, count, when, replaces}` is taken when it opens. The prompt says only what
  the snapshot holds, never what later polls show.
- **What it says** (AC-2), in this order:
  1. the heading: "Confirm the `<count>` held removals of pass `<runId>`?";
  2. one line for `when`:
     - `lines-up`: "Confirming lines up a pass now, which carries them out.";
     - `waiting-pass`: "A pass is already waiting. It takes this confirmation up, and nothing new is lined up.";
     - `cannot-tell`: "The panel cannot tell whether a pass is waiting, so it cannot tell whether one will be lined up
       now. The answer will say what happened.";
  3. "The confirmation covers this held list once. If no pass takes it up within 24 hours, it lapses.";
  4. "A removal cannot be undone from the panel. A removed relationship comes back only if its tagging is on the relay
     again; then the real-time path, while it is on, or a later pass adds it back.";
  5. when `replaces`: "This replaces the earlier confirmation, which no pass will carry out."

  The Implementer may polish the wording; each part's meaning stays.
- **The buttons:** "Confirm the removals" and "Cancel". Cancel sends nothing.
- **While under way:** both disabled, the first `aria-busy` with "Confirming…"; the prompt stays open, as Stop's.
- **It closes by itself** when a read makes `offer` false or changes `runId`, but never while under way. A change in
  what is busy does not close it: the answer reports what happened.

**D11. The sender and the outcome.**
- **`sendConfirm(runId)`** in `taggingPipelineFetch.js`: one POST of `{"runId": …}` as JSON to
  `'/api/tagging-edges/confirm-held-removals'`, through the private `raced(15000, …)`, resolving `sendSwitch`'s result
  shapes. It never rejects.
- **Its state** lives in `TaggingPipelinePanel`, beside `run` and `stop`, behind the same `mounted` guard:
  `confirm = {snapshot, pending, outcome}`.
- **`confirmOutcome(result)`**, a pure view function, gives a past-tense sentence and a tone for each D4 row:
  - `lined-up` (with "behind the pass that is stopping" when `behindStopping`);
  - `waiting-pass`, `starting-pass`, `taken-up`;
  - `not-lined-up`: "The confirmation was made, but no pass was lined up (`<reason>`). Run a pass now, or the next
    scheduled pass, takes it up within its 24 hours.";
  - `already-pending` (with its `expiresAt`);
  - out of date (`not-the-latest-report`, `nothing-held`, `running`, `held-list-changed`): "nothing was confirmed;
    the panel now shows the latest state";
  - `pass-started`;
  - `withdraw-failed`: the server cannot tell whether the confirmation stands; the panel shows from its next read
    whether that pass took it up;
  - `record-unavailable`, `confirmation-unwritten`, other 5xx: failed, with code and cause;
  - 401 or 403: refused, "sign in again as the owner";
  - unknown (timeout, network, bad JSON): "The panel had no answer within 15 seconds, so the outcome is unknown. It
    shows the state from its next read."
- **The flow** is `runPass`'s: on any answer but unknown, await
  `Promise.allSettled([readStatus(), readPassRecord()])`, then clear pending and the snapshot and set the outcome. On
  unknown, clear at once and fire the re-reads. The held list follows the status through the existing `heldRunId`
  effect.
- **The outcome** shows in the held section until the next Confirm is sent.

**D12. Who confirmed, in the panel.**
- **`passWho`'s history** keeps `confirm` lines beside `start` and `stop`: "Held removals of pass `<runId>` confirmed
  by the owner (`<key>`…)", at the line's `at`.
- **A run's confirmation line.** `runWho` gains `confirmation` for a run with `confirmation.found === true`:
  - "It took up the owner's confirmation, made at `<mintedAt>`";
  - with the key when a `confirm` line in the record has `at === mintedAt`;
  - "(when not recorded)" when `mintedAt` is absent.

  `LatestPass` and `EarlierPasses` show it above today's honoured and why lines, which stay as they are (AC-4).
- **Kept bodies.** As today, nothing of a kept body shows while the record read is loading or failed.

**D13. The held section's wording.** Only where Confirm makes today's wording untrue (AC-7):
- **expired:** "It stays until the next pass, which does not honour it" becomes "No pass will carry it out. The owner
  can confirm this held list again.";
- **unreadable** and **unknown-expiry:** add "No pass carries it out. Confirming again replaces it.";
- **the file comment** (`HeldSection.jsx:1-5`) no longer says the control is story 7's.

New, in the `!runId` branch: when the latest pass has `confirmation.found === true` and its outcome is `failed` or
`stopped`, say that it used the owner's confirmation up, that the removals it did not apply can be confirmed again only
once a later pass holds them again (Run a pass now, or the next scheduled pass), and offer no Confirm (AC-1).

**D14. The overdue line**, in the backstop section, from `overdueView(statusBody, statusRead, busy)` (pure,
clock-free):
- `overdue`: "The pass is overdue: the latest pass began at `<latestBeganAt>`, and the schedule expected the next by
  `<expectedAt>`." When `busy` shows a waiting item: "A pass is waiting; the warning clears when it begins running."
- `cannot-tell`, an absent `overdue` member, or a status read that failed with no body: "The panel cannot tell
  whether the pass is overdue." plus the reason (the schedule, the rule, the report).
- While the status has not answered: "Whether the pass is overdue is still being checked."
- `on-time`, `no-entry`, `no-schedule` and `no-pass`: no line; the existing lines stand.
- **It renders in every `ScheduleSection` branch**, loading and failed ones included, since it comes from the status,
  not the schedule list. The section's `tone` becomes `warn` when overdue.

**D15. Prompt focus (AC-6)**, for Turn off, Stop and Confirm:
- **The targets.**
  - `Section` takes an optional `headingRef`; its `<h3>` then has `tabIndex={-1}`.
  - Each outcome line (`Outcome` in PathSwitch and PassControls, Confirm's in HeldSection) is a `<p tabIndex={-1}>`
    with a ref.
  - Each opener (Turn off, Stop, Confirm held removals) has a ref.
- **One helper,** in `parts.jsx`: `useReturnFocus()` → `{closed(how, wasInside), …refs}`. When a prompt closes, its
  owner calls `closed('cancel' | 'other', wasInside)`. `wasInside` is whether focus was inside the prompt, or on
  `document.body`, at that moment. An effect after the next render then:
  - `cancel`: focuses the opener's ref when it is mounted and not disabled;
  - otherwise, or when the opener is gone: the outcome line when shown, else the section's heading.

  It does nothing when `wasInside` is false, so a prompt that closes by itself never takes focus from elsewhere.
- **While under way.** A prompt whose send starts moves focus to its own `h4` (`tabIndex={-1}`) before its button is
  disabled, so focus never sits on a disabled button and falls to the page.
- **Turn off closes at once on confirm** (ADR 0005 D13): focus goes to the path section's heading. When its outcome
  line then appears while focus is still on that heading, focus moves to the line.
- **Never on Turn on or Run a pass now.** Neither is ever an opener or a target; the rules above can name neither.
- **No timer.** Effects only, as today.

**D16. Copy and comments.**
- **The opening line** (`TaggingPipelinePanel.jsx:264-268`) adds that the owner can confirm held removals.
- **File comments** that say Confirm is story 7's (`TaggingPipelinePanel.jsx:8`, `HeldSection.jsx:4`) say what
  shipped. Style as PS16–PS24.

### Carry-forwards (the Implementer's, unless named)

- **CF1 (code comment):** `control/index.js:338-339`: "the record, loaded on first use, and again while its last read
  was unreadable or damaged". The ADR half is § Amendments.
- **CF3:** in `compute()`'s give-up loop (`:419-426`), a `gaveUpAt` that `toIso` cannot convert counts as no give-up.
- **CF4:** `processor.js` deletes `BRAINSTORM_TASK_JOB_ID` from the child's environment copy when the guard drops the
  id, so an inherited value never reaches the pass, and `job: null` holds without exception.
- **CF8:** BIBLE's "no request joins a pass" (now `BIBLE.md:713` and `:1581`; the review cited `:668`, `:1510`)
  becomes "no start shares a job with another".
- **NB1:** `resourceSemaphore.acquire` calls `shouldAbandon` inside a `try`; a throw reads as false, so the lease is
  released in the worker's `finally` as usual. The JSDoc says so.
- **NB2:** `busyView`'s `known` also requires `Array.isArray(control.busy)`; a busy answer with no list is unknown.
- **The Tester's:** CF5, CF6, CF7, E1, R1-opt, and the B39 baseline's three parts (story § Test tasks).

### Evidence: held lists made only of fixture relationships

**The fixture.** A held list needs more than 50 removals due, and more than a tenth of the relationships at tagging
addresses the pass starts with (`exceeds`, `sweep.js:449-451`). A `TAGS` relationship is due for removal when its
`address` is tagging-shaped and nothing is on the relay there (`decideAddress`, `sweep.js:364`). Its ends' labels play
no part. So the fixture is:
- **two nodes labelled `TaggingEdgesEvidence`** (never `NostrUser`), `{run, end: 'from' | 'to'}`. No person is joined,
  so no real person is ever shown tagging or tagged, and no reader that matches `NostrUser` sees them;
- **`T` relationships `TAGS` from one to the other**, each `{address: '39999:' + 'f'.repeat(64) + ':tagging-edges-7-'
  + run + '-' + i, evidence: run}`, with no `eventId`:
  - the author `ffff…ffff` is not a valid key (it is above the secp256k1 field prime), so no tagging, and no kind 5,
    can ever be signed for it. The pass always finds nothing on the relay there;
  - the real-time path removes only on a revoke a kind 5 proves (ADR 0003), so it never removes them. Its catch-up's
    deletion scan for that one author finds nothing;
  - `tags_address` is unique, and every fixture address is distinct.
- **`T`** is `floor(B / 9) + 1 + max(20, ceil(B / 450))`, where `B` is the count of `TAGS` with a tagging-shaped
  address, read just before (7,313 → 833 on 2026-11-07's staging count). `T > 50` always holds at these sizes.
- **One transaction** creates the two nodes and all `T` relationships, so a pass reads none or all of them.

**The script: `scripts/tagging-edges-held-fixture.js`** (the Implementer's), run inside the container with
`docker exec tapestry node /usr/local/lib/node_modules/brainstorm/scripts/tagging-edges-held-fixture.js <cmd>`. It
reads Neo4j's settings as the pass does and never prints a credential. It writes nothing to any relay.
- **`counts`:** `TAGS`, tagging-address `TAGS`, `NostrUser`, and fixture nodes and relationships.
- **`plan`:** prints `B` and `T`.
- **`create --run <tag> --count <T> --host <domain>`:**
  - refuses unless `--host` equals the instance's own configured domain;
  - refuses while any `TaggingEdgesEvidence` node exists;
  - `run` is `[a-z0-9]{1,16}`;
  - then the one transaction.
- **`check --run <tag> --count <T>`:** reads every page of `GET /api/tagging-edges/held` and passes only when the
  latest outcome is `done-removals-held`, the list's total is `T`, and its addresses are exactly the fixture's, each
  `not-on-relay`. Exit 0 or 1. The owner confirms only after a pass.
- **`cleanup --run <tag>`** (or `--all`): `MATCH (n:TaggingEdgesEvidence {run: $run}) DETACH DELETE n`, which removes
  the nodes and only the relationships attached to them. Idempotent; prints what it removed.
- **Exports for the Tester:** `FIXTURE_AUTHOR`, `fixtureAddress(run, i)`, `fixtureCount(B)`, `checkHeld(items, {run,
  count})` and the Cypher strings, so the address shape, the count, the check and the cleanup's scope are pinned.

**What happens around it:**
- **A pass that runs while the fixture exists** holds it, as the test's own would; its held list is then the latest,
  and `check` is re-run against it.
- **A real removal that falls due** joins the held list (all or nothing): `check` fails, the owner does not confirm,
  and the run is cleaned up and repeated later.
- **The daily pass.** Run the test away from the daily slot (the schedule list's `nextRunAt`). A daily pass that
  meets a pending confirmation takes it up, which is the test's own outcome.
- **Whether the test finishes or not,** `cleanup` runs, then one more Run: its report holds nothing, so no fixture
  held list is left as the latest.

**Local** (the owner's own graph; restart the backend first, ADR 0006 § Live):
1. **Overdue, first,** while the latest pass began more than 25 h ago (the local one began on 2026-10-29). Add a
   temporary Scheduled Tasks entry for the pass with the cron rule `0 3 * * *`, away from 03:00 UTC. A cron entry's
   first run is its rule's next match; an interval entry would run at once when enabled (BullMQ's `every`,
   `job-scheduler.js:27-28`), so do not enable the daily seed entry for this. The warning shows, counting 24 h. Run a
   pass: it clears within 10 s. Delete the temporary entry.
2. `counts`; `plan`; `create`; Run a pass; `check`. Confirm from the panel; the answer is `lined-up`. Once it ends:
   fixture relationships 0; `cleanup`; `counts` equal the first.
3. **Waiting:** `create`; Run; `check`; hold the heavy lock (ADR 0006's `HSET … evidence-hold`); Run (it waits behind
   heavy work); Confirm → `waiting-pass`; release the lock; the pass removes the fixture; `cleanup`.
4. **The queue unavailable, then expired:** `create`; Run; `check`. Set `TASK_QUEUE_ENABLED=false` and restart the
   backend (sessions keep working; Redis stays up, unlike R5). Confirm → `not-lined-up`. Edit `expiresAt` in the
   container's `confirmation.json` to a past time: the panel shows it expired and offers Confirm, with the replacing
   line. Restore the flag and restart; Confirm → `lined-up`; the pass removes the fixture; `cleanup`.

**Staging** (the owner runs the script over SSH; this session reads only public routes):
- `counts`, `plan` and `create` just before; Run; `check` from the container, and the held list re-read from here
  through the public `GET /api/tagging-edges/held`.
- The owner confirms from the panel and sees the confirm line; the pass removes exactly the fixture; `cleanup`; one
  more Run; `counts` differ from the first only by what the reports' and the path's counts show.
- An admin sees the disabled Confirm and its reason. A signed-in user who is neither is refused at the confirm route.
  Signed out, the status, the held list, the path status and the Task Explorer's data carry no who and no `mintedBy`.
- The overdue warning is absent while the daily pass is on time.

**Production:** read-only checks after a promotion.

### Seams for Test Design

- **The controller.** `createController(deps)` with the new deps (D1), the fake queue and timers of ADR 0006. Every
  D2 path, the precedence of step 4, `takeBackStart`, and that `already-pending` writes and records nothing.
- **Interleavings.** A second `confirm` queued behind the first; a gate `afterAcquire` queued behind a `confirm`; a
  claim landing between steps 6 and 7 (the fake `withdrawConfirmation` answers false); a withdraw that throws.
- **The route.** The real `handleConfirmHeldRemovals` with an injected `confirm`, and through `authMiddleware` for the
  refused callers (the `startApp` pattern; ADR 0006 § Seams).
- **The pure modules.** `pendingFor`'s cases (D3); `publicConfirmation` on a file with `mintedBy`, a nonce and an extra
  field; `overdueVerdict` with an injected `periodOf` and with the real cron one (24 h 59 min not overdue, 25 h 01 min
  overdue; `0 3 * * *` = 24 h; a weekday rule; two entries; a refused latest; `0 3 29 2 *` → cannot tell).
- **The view.** `confirmView`, `confirmOutcome`, `overdueView`, `passWho`'s confirm line and `runWho`'s confirmation
  line, all clock-free, in the Node gate.
- **Revised pins** (revised, not deleted; the story's test tasks):
  - RT17, RT18 and RT19: `confirm` replaces `lineUp` and `queueHealth`;
  - the request pins allow `sendConfirm`'s POST and no new read route (this ADR adds none);
  - the no-Confirm pins allow exactly "Confirm held removals" (enabled, and the admin's disabled one) and the
    prompt's "Confirm the removals"; every other button, Run, Stop and Stop's prompt included, still refuses
    `/confirm/i`;
  - their messages say Confirm is on the panel;
  - the runner's pins on `latest.confirmation` gain `mintedAt`.
- **Store tests** use a temp `TAGGING_EDGES_STATE_DIR`, never the container's (ADR 0005 § Seams).

### Docs (the Implementer)

The story's Docs tasks, with these specifics:
- **BIBLE §11:** the confirm row (`BIBLE.md:720`) gets D4's answers, the refusal when the record cannot be written, and
  that a second confirmation is refused. The status row says `confirmationPending` carries no who, and names
  `overdue`.
- **BIBLE §6:** the `confirm` action, `latest.confirmation.mintedAt`, `overdue`.
- **OPERATIONS §12.8** (`:791-799`): Confirm on the panel; the snippet stays, with D4's answers; the fixture script
  as the way to make a held list for testing, staging only, never production.

## Amendments to ADRs 0002–0006 (dated notes; the original text stays)

The Architect adds these with this ADR's commit. Line numbers are at `1044e193`. Every original line stays
byte-identical: each note is a line of its own.

**ADR 0002:**
- **Header:** `**Amended (2026-11-07):** by tagging-edges/0007 — the confirm route runs as one controller step, refuses a
  second confirmation and an unrecordable one, and writes no mintedBy; C12's public confirmation is an allowlist.`
- **The confirm route's sequence (`:482-499`),** after story 6's note: since story 7 the sequence is one controller
  step (D1–D2); a pending confirmation of this held list is refused; the record is written first and an unrecordable
  confirmation refused; no `mintedBy`; every accepted answer carries `outcome`.
- **Decision 14 (`:863`):** Confirm is on the panel for the owner; the signed-in `fetch` stays as the way without it.
- **C12 (`:1261-1262`):** superseded by D6's allowlist.
- **The other "story 7" pointers (`:589`, `:1292`):** story 7's Confirm is this ADR.

**ADR 0006:**
- **Header:** `**Amended (2026-11-07):** by tagging-edges/0007 — D8's confirm step (now one controller step, refused when
  it cannot be recorded), D11's confirm action, D12's status members; the dated notes below name each.`
- **D5's note (`:509-512`), carry-forward 1:** "only loads the record, on first use" reads "loads the record on first
  use, and again while its last read was unreadable or damaged" (`loadRecord`).
- **D8 (`:627-648`):** superseded by D1–D5. "The confirm route's start cannot be refused … goes ahead unrecorded" no
  longer holds; a schedule's start still does.
- **D11 (`:757-797`):** `history` also holds `confirm` lines (D5).
- **D12 (`:799-830`):** the status also returns `overdue`, and `confirmationPending` is D6's allowlist.
- **§ Amendments, carry-forward 2:** one line under § ADR 0004 naming its fix-round note (`0004:838-842`, T12) and one
  under § ADR 0005 naming its own (`0005:733-734`).
- **Out of scope (`:1268`, `:1279`):** Confirm is this ADR; `confirmationPending.mintedBy` is answered by D6.
- **The "story 7" pointers in the body** (`:284`, `:320`, `:1066-1069`, `:1151`): a dated note each, pointing at this
  ADR.
- **The "story 7" pointers inside § Amendments to ADRs 0002–0005** (`:1209`, `:1214`, `:1219`, `:1227`, `:1237`,
  `:1242`, `:1263`): one note at that section's head. Those lines say what notes story 6 placed elsewhere, and this
  ADR's own notes reach those places.

**ADRs 0003, 0004 and 0005:** one note each, **at the end of the file**, so no line that other ADRs cite moves: every
"story 7" pointer in them now means this ADR's Confirm on the panel.

## Out of scope

- Admins confirming; confirming part of a held list; withdrawing a confirmation; the hold rule itself (the story's
  Out of scope).
- Cleaning test-fixture taggings off the shared relays (ledger `2026-09-27-test-fixture-taggings-on-prod-relays`).
  This story's fixture lives only in a graph and is removed by `cleanup`.
- The cause of production's October gap.
- Alerts outside the panel; overdue warnings for other tasks.
- The `owner-only` access level in the route table: the confirm route keeps `OWNER_ACTION` plus `requireOwnerOnly`.
- R9 (ADR 0006 Amendment 1 § B) and R10–R13 above.

## Fix-round notes (2026-11-07, review round 1)

Review `engineering-team/reviews/tagging-edges/7-confirm-held-removals.md` asked for these. Each refines a decision
above; nothing above is struck, and no cited line moves.

- **D2 step 7, a re-read that fails** (review requested 9). A re-read of `report.json` that throws, or reads nothing,
  cannot rule out a pass, so the confirmation is withdrawn as before. The answer no longer claims that a pass started:
  - **renamed:** take the record back to `prior` → 500 `{code: 'error', cause}`, `cause` through `allowErrorCode`.
    Nothing is pending; the panel's next read shows that;
  - **already gone, or the rename threw:** as step 7 says above (`taken-up` with `claimedBy: null`, or
    `withdraw-failed`).

  D4's table is unchanged: 500 `error` is already in it. 409 `pass-started` stays only for a re-read that names
  another run.
- **D6, each member with its type** (review requested 8). `publicConfirmation` serves an allowlisted member only when
  it has its type: strings for `runId`, `heldDigest`, `mintedAt` and `expiresAt`; non-negative integers for `version`
  and `heldCount`. Any other value is left out. `expired` is derived only from a string `expiresAt`, and is false
  otherwise. A hand-edited file can neither pass an object through nor fail the status.
- **D8, a bound on the cron work, and no throw** (review requested 6 and 7).
  - **More distinct patterns than the cache holds.** When the enabled entries for the pass carry more than 32 distinct
    cron patterns, none is judged and the verdict is `{state: 'cannot-tell', reason: 'rule'}`.
  - **A pattern longer than 256 characters** is not judged. Its period cannot be told (null), as R13's rules are.
  - **What remains:** each pattern's first judgment still runs synchronously, once per process while cached. At most
    32 are judged.
  - **A throw from `overdueVerdict`** in `handleStatus` gives `{state: 'cannot-tell', reason: 'schedule'}`, as a throw
    from the reader does. The status never fails for it.
- **D14, a failed read after a good one** (review requested 5). A status read that failed gives "The panel cannot tell
  whether the pass is overdue." with the reason that the pass status could not be read. This holds whether or not a
  body is kept from an earlier read. A kept verdict is never shown while the latest read has failed. AC-5 says that a
  missing warning never stands for on time.
- **D15, one element per target, and a control replaced in place** (review blocking 1 and requested 2).
  - The Confirm prompt and its answer line keep one element identity across the held section's branches: one position,
    or a key. A read that changes the branch never remounts them, so focus on them survives it.
  - A focused opener that a read replaces in place by a control D15 rules out hands focus to its section's heading.
    Turn off becoming Turn on is the case. "Never on Turn on" covers a button node React reuses.
