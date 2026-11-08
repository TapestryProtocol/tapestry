const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const F = require('../../test/helpers/taggingPipelineFixtures');

/**
 * tagging-edges #4: the tagging pipeline panel — the browser class.
 *
 * Story: engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md
 * ADR:   engineering-team/decisions/tagging-edges/0004-tagging-pipeline-panel.md
 *        (§ UI, § Seams for Test Design "The browser spec", § Clarifications T9 and T10)
 * Answers: test/helpers/taggingPipelineFixtures.js. Node halves: the view, fetch, codes, drift-route and countStrict
 * suites under test/.
 *
 *   B0  — the served origin runs a build that contains the panel.                                     [prerequisite]
 *   B1  — the owner: the sub-tab directly after Streaming ETL, the other five unchanged, five sections ready. [AC-1, AC-6]
 *   B2  — an admin sees and opens it too.                                                              [AC-1]
 *   B3  — a customer and a signed-out visitor see no panel (passes today: Settings' own gate).         [AC-1]
 *   B4  — while loading, each section says what it is loading.                                        [AC-5]
 *   B5  — a running pass: running, no result, the held list waits for its end.                          [AC-2]
 *   B6  — a running first pass is not "no pass yet".                                                   [AC-2; T1]
 *   B7  — the latest pass explained, its times and figures, and nine earlier passes newest first.       [AC-2]
 *   B8  — an outcome the panel does not know reads "not recognised" beside its code.                   [AC-2; explanations]
 *   B9  — no pass yet: says so, and its line names Run beside the two other ways one starts (story 6). [AC-2; 0006 D19]
 *   B10 — the held list pages to every item, matches the report, gives reasons; pending until when; no
 *         Confirm while that confirmation is pending, and no other button named for confirming (story 7). [AC-2]
 *   B11 — an expired confirmation is shown as expired, not pending; no pass carries it out, the owner can
 *         confirm again (story 7's wording, ADR 0007 D13).                                             [AC-2]
 *   B12 — an unreadable confirmation is shown as unreadable.                                           [AC-2]
 *   B13 — schedule: none enabled, a disabled one mentioned, the button opens Scheduled Tasks.          [AC-2]
 *   B14 — schedule: none at all, no disabled one to mention.                                           [AC-2]
 *   B15 — schedule: one, its interval and next run, no warning; a disabled one mentioned, not counted. [AC-2]
 *   B16 — schedule: one, enabled but not scheduled.                                                    [AC-2]
 *   B17 — schedule: one, weaker than daily (an interval, and a weekly cron).                           [AC-2]
 *   B18 — schedule: several, how many.                                                                 [AC-2]
 *   B19 — the path on and live: state explained, times, counts, failed reads, refusals, gauges, catch-up. [AC-3]
 *   B20 — the path on but not running: said so, the stored 'live' not shown as current.               [AC-3]
 *   B21 — the eight states, each with its code and its explanation; an unknown state.                  [AC-3]
 *   B22 — the three warnings: stale, status unreadable, switch unreadable.                             [AC-3]
 *   B23 — before the first start: "not yet available", never 0.                                        [AC-3]
 *   B24 — the path off: its last figures, labelled so, with their time.                                [AC-3]
 *   B25 — counts reset: said so.                                                                       [AC-3]
 *   B26 — a setup problem and a last error, with their codes and explanations.                         [AC-3]
 *   B27 — drift: the story's example, difference 3, explained 3, unexplained 0, the pass named.        [AC-4]
 *   B28 — drift: an unexplained remainder, and the addresses left to the next pass.                    [AC-4]
 *   B29 — drift: a clean pass, unexplained 0.                                                          [AC-4]
 *   B30 — drift: an unknown count reads "unknown", no difference, never 0.                             [AC-4]
 *   B31 — drift: the latest pass not finished, the finished pass it used instead named.                [AC-4]
 *   B32 — drift: no finished pass, no explained part, the whole difference unexplained, and why.       [AC-4]
 *   B33 — drift: path on names its refused taggings and parked; path off says changes wait for a pass. [AC-4]
 *   B34 — drift: Recount counts again.                                                                 [AC-4]
 *   B35 — refresh: a status change shows after POLL_MS, without a reload.                              [AC-5; page.clock]
 *   B36 — a failed read (path status, pass report, schedule list, held list) names itself, its code,
 *         Retry; the others stay ready; Retry (not a poll) recovers.                                   [AC-5; page.clock]
 *   B37 — a failed drift read: both counts unknown, the read named, Retry.                            [AC-5, AC-4]
 *   B38 — a minute open, two Recounts, closed: only GETs, exactly three counts, no reads after close;
 *         the reads gain the switch record (story 5) and the pass record (story 6).                   [AC-1, AC-4; page.clock]
 *   B40 — the held list of a run that is no longer the latest: re-read the status, restart, no error.   [AC-2; ADR § UI "The held list"]
 *   B39 — the five existing sub-tabs send the requests of the baseline (T10).                          [AC-6]
 *
 *   Story 4 review round 1 (engineering-team/reviews/tagging-edges/4-tagging-pipeline-panel.md):
 *   B41 — drift while a pass runs says a pass is running, never that the latest pass did not finish.     [AC-4; NB1]
 *   B42 — a failed pass shows its failure code with its failureCode explanation under where it failed (ENOSPC); a
 *         schema refusal for an unreachable Neo4j names Neo4j, not only the Dashboard fix.                [AC-2; Blocking 1, NB2]
 *   B43 — counts taken before the explaining pass ended: no "unexplained" figure, a Recount asked for;
 *         a Recount with newer counts brings the explained and unexplained lines back.                    [AC-4; NB3, T5]
 *   B44 — "applied the confirmed removals" only when confirmed.removalsApplied > 0.                      [AC-2; NB5]
 *   B45 — a catch-up's not-established reason is labelled as "why" only on a not-established outcome.     [AC-3; NB11]
 *   B46 — a re-poll that fails after a good read: error, the earlier figures kept, labelled with their time. [AC-5; ADR § UI "Failure"; F1]
 *   B47 — an answer to an older status request that lands after a newer one is dropped.                    [ADR § UI "Polling"; F1]
 *   B48 — a poll tick is skipped while the previous one is in flight.                                     [ADR § UI "Polling"; F1]
 *   B49 — a pass-minted failure code (plan-error, on a plan failure) shows its own failureCode sentence under
 *         where it failed, never "not recognised".                                                         [AC-2, AC-5; Blocking 1, T12]
 *
 *   Story 5, the real-time path's switch (engineering-team/stories/tagging-edges/5-real-time-path-switch.md; ADR
 *   engineering-team/decisions/tagging-edges/0005-real-time-path-switch.md, § Seams "Browser mocks", "Browser
 *   fixtures", "The 15 s cases"). B38 is revised: its allowed reads gain the switch's record, re-read with the status.
 *   Story 4 review round 2 carry-forwards:
 *   B50 — R2-10: a held list restart whose status re-read is overtaken by a failing poll does not stay loading. [AC-2]
 *   B80 — R2-3: a confirmed pass that never recorded its end words its applied removals as a lower bound.      [AC-2]
 *   B81 — R2-6: failure.message and failure.stderrTail under "Where it failed"; no remedy points at the task log
 *         or strfry-error.log.                                                                                [AC-2]
 *   The switch:
 *   B51 — the control: "Turn off" on, "Turn on" off or unreadable, once the path status has a body.         [AC-1]
 *   B52 — under way: disabled, aria-busy, says so; the new state when the answer comes.                     [AC-1]
 *   B53 — "Turn on" asks nothing: one POST {"on":true}; on and starting, with who, from the reads after it.  [AC-3, AC-5]
 *   B54 — no answer in 15 s (switch, status and record hang): enabled again, "outcome unknown", then the next read. [AC-1]
 *   B55 — the warning beside "Turn on": no finished pass; the report unreadable; none otherwise.             [AC-1]
 *   B56 — the prompt, normally, for each of story 4's schedule states: what keeps the graph in step.         [AC-2]
 *   B57 — the prompt with the schedule unreadable: the backstop could not be checked.                        [AC-2]
 *   B58 — the prompt before the first start has completed.                                                   [AC-2]
 *   B59 — the prompt when the status cannot say whether the first start completed.                           [AC-2]
 *   B60 — Cancel sends nothing and changes nothing.                                                           [AC-2]
 *   B61 — confirming: one POST {"on":false}; off within 10 s, with who.                                       [AC-2, AC-5]
 *   B62 — the prompt closes by itself when a read shows the path off.                                        [AC-2]
 *   B63 — starting within the window, never failed; past it, story 4's "not running".                        [AC-3]
 *   B64 — a viewer who did not press sees it within POLL_MS; a reload in the window still says starting.     [AC-3, AC-5]
 *   B65 — an "on" while the old process still runs: starting, not running.                                   [AC-3]
 *   B66 — an "on" while already on: running, not starting.                                                    [AC-3]
 *   B67 — refused (403, and a lapsed session's 401): why, the status, the state unchanged.                   [AC-4]
 *   B68 — a failed on: unchanged, free space and writable, the code.                                          [AC-4]
 *   B69 — a failed off: not turned off, still on, the code.                                                    [AC-4]
 *   B70 — an admin turns on what the owner turned off: last change wins, both in the history.                 [AC-4, AC-5]
 *   B71 — the latest change and the last 10, newest first.                                                    [AC-5]
 *   B72 — never switched: no change recorded, an empty history.                                               [AC-5]
 *   B73 — an off the server could not record: said so, no who, never an earlier "on" as the latest.           [AC-5]
 *   B74 — a recorded state with no who: who and when not recorded.                                            [AC-5]
 *   B75 — the switch unreadable: no latest who, the stored history still shown.                               [AC-5]
 *   B76 — the history unreadable: said so, the latest change still shown.                                     [AC-5]
 *   B77 — a record that disagrees with the path status shows no who until they agree.                        [AC-5]
 *   B78 — a failed record read after a good one: no kept "who".                                               [AC-5]
 *   B79 — an answer that lands after the panel closed starts no read.                                        [AC-1]
 *   Story 5's review, round 1:
 *   B82 — the prompt while the schedule list's first read loads: still being checked, no verdict and no "could not
 *         be checked"; once the read answers, the verdict, in the prompt already open.                         [AC-2]
 *   Story 5's review carry-forward C5-4 (story 6; ADR 0006 D20):
 *   B113 — during a Retry after a failed schedule read, the open off prompt says still being checked.      [C5-4; D20]
 *
 *   Story 6, running and stopping the pass (engineering-team/stories/tagging-edges/6-pass-run-and-stop.md; ADR
 *   engineering-team/decisions/tagging-edges/0006-pass-run-and-stop.md D15–D19, § Seams "Request pins"). Revised, not
 *   deleted: B9 (the empty-state line names Run, D19), B10 (its message names story 7 for Confirm), B38 (the allowed
 *   reads and counts gain the pass record; still no non-GET for a viewer who never presses). Fixtures: F.SCENE,
 *   F.STOP_CASES, F.WHO_EACH, F.HISTORY6, F.RUN_ANSWER, F.STOP_ANSWER; the mock's Run and Stop act as the server would
 *   (F.applyRun, F.applyStop).
 *   B83 — Run with nothing busy: asks nothing, one POST {}, the pass waiting with who, from the reads after.  [AC-1, AC-5]
 *   B84 — Run while busy (a Run waiting; a due scheduled run, the seed id): refused plainly, the pass shown.  [AC-1]
 *   B85 — two passes busy: each shown, with its state, time and who.                                         [AC-1, AC-5]
 *   B86 — Run under way: disabled, aria-busy, "Lining up a pass…"; then the pass waiting.                     [AC-1]
 *   B87 — no answer to Run in 15 s: enabled again, "outcome unknown", then the next read.                     [AC-1]
 *   B88 — the pending-confirmation line beside Run; none without a pending confirmation.                     [AC-1]
 *   B89 — a first pass, no report: the empty branch keeps "No pass has run yet", shows Run, then the wait.   [AC-1; D17]
 *   B90 — waiting (asked for; behind heavy work; behind a pass ahead), since when, by a viewer who did not
 *         press, and after a reload.                                                                         [AC-2]
 *   B91 — a stop asked for, since when and who, by a viewer who did not press, after a reload; no Stop.     [AC-2, AC-3]
 *   B92 — the server cannot tell whether a pass is waiting (read-failed, not-ready, off, no control).        [AC-2]
 *   B93 — a waiting pass that gave up: not waiting, gave up and never began, its start kept; with a due run. [AC-2]
 *   B94 — Stop only while some pass has no stop asked; the waiting pass's prompt.                             [AC-3]
 *   B95 — the running pass's prompt.                                                                          [AC-3]
 *   B96 — two busy passes: what happens to each, "Stop the passes".                                           [AC-3]
 *   B97 — the confirmation warning (taken up; cannot tell) and the "stays pending" line.                     [AC-3, AC-4]
 *   B98 — Cancel sends nothing.                                                                               [AC-3]
 *   B99 — confirming a waiting pass's stop: the POST, "Stopping…" with the prompt open, gone within 10 s.    [AC-3, AC-4, AC-5]
 *   B100 — no answer to Stop in 15 s: the prompt closes, "outcome unknown", then the next read.              [AC-3]
 *   B101 — an out-of-date prompt: refused, nothing changed, the new state, Stop again.                       [AC-3]
 *   B102 — a running pass's stop: asked for until it ends, then "stopped on request by … at …", not failed.  [AC-3, AC-4, AC-5]
 *   B103 — stopped with its start unrecorded; a stopped hand run; a signal no one recorded.                  [AC-3, AC-5]
 *   B104 — a stop that came too late: the pass's own outcome, "but the pass ended first" — a pass that finished,
 *         and one killed (time-out, deploy or restart) after it was asked to stop; never "stopped on request".  [AC-3]
 *   B105 — refused Run (403) and Stop (401): sign in again, the state unchanged.                              [AC-4]
 *   B106 — a Run that fails: queue unavailable, record unavailable, a failure with its code.                 [AC-1, AC-4, AC-5]
 *   B107 — a Stop refused or failed: nothing to stop, not reachable, queue unavailable, a failure.           [AC-3, AC-4]
 *   B108 — who started each pass: admin, owner (and stopped), schedule, confirmation, local, another way,
 *         not recorded.                                                                                      [AC-5]
 *   B109 — the last 10 actions newest first; the empty state; a pass from before story 6.                    [AC-5]
 *   B110 — actions not recorded: a Stop (no who), a running pass's stop, a scheduled and a lined-up start.   [AC-5]
 *   B111 — a failed pass-record read: its own failure, no kept who, Retry.                                    [AC-5]
 *   B112 — the opening line names running and stopping a pass.                                               [AC-6; D19]
 *   Story 6's Test Design review (COV-3, COV-4): B104 gains the killed twin (above), and
 *   B114 — a poll with the Stop prompt open never rewrites it: its text, its label and what it sends are the
 *         snapshot's.                                                                                       [AC-3; D17]
 *   B115 — the prompt closes by itself on a read of nothing busy, but not while its stop is under way; the
 *         stop's outcome shows until the next Run is sent.                                                  [AC-3; D17]
 *   Added after Implementation (2026-10-28; ADR 0006 Amendment 1 § C, story 6 § Deviations, last group); the
 *   mock's Stop body rule (F.applyStop) follows Amendment 1 § A (keys of 1 to 256 code units, no control character):
 *   B116 — a read that cannot tell (a failed queue read; no control member) never closes an open Stop prompt.  [AC-2; D17]
 *   B117 — focus inside the pass controls (Cancel, "Stop the pass", "Run a pass now") survives the switch from an
 *         empty report to a ready one.                                                                       [D17]
 *
 *   Story 7, confirming held removals (engineering-team/stories/tagging-edges/7-confirm-held-removals.md; ADR
 *   engineering-team/decisions/tagging-edges/0007-confirm-held-removals.md D4–D16, § Seams "Revised pins"). The class
 *   is titled "tagging-edges #7", so -g "tagging-edges #7" selects it. Revised, not deleted: B9, B10 and B94 (the
 *   no-Confirm pins now allow exactly "Confirm held removals" and the prompt's "Confirm the removals", in the held
 *   section; every other button still refuses /confirm/i), B11 (the expired line's wording, D13), B38 (the request pin:
 *   the allowed POSTs gain the confirm route, the reads gain nothing) and B43 (E1: the drift line's guard). B39's
 *   baseline is brought up to date and its checks are soft (ledger 2026-10-28-relay-subtab-baseline-stale). Fixtures:
 *   F.SCENE7, F.CONFIRM_ANSWER, F.OVERDUE, F.CLASSIFICATION; the mock's confirm acts as the server would
 *   (F.applyConfirm).
 *   B118 — Confirm for each confirmation state: none, pending for the latest list (no Confirm), pending for an
 *          earlier pass, expired, unreadable, expiry unreadable; none when nothing is held.                 [AC-1; D9]
 *   B119 — no Confirm while a pass runs (by liveness, and a starting pass in control.busy); the ended pass's own
 *          held list and Confirm.                                                                           [AC-1; D9]
 *   B120 — no Confirm until the held list is read (loading, failed), then Confirm.                           [AC-1; D9]
 *   B121 — the prompt: inline, focus on Cancel, how many and which pass, lines up a pass now, once, 24 hours,
 *          no undo and how a removal comes back; Cancel sends nothing.                                     [AC-2; D10]
 *   B122 — the prompt's "when" for a waiting pass, every busy pass asked to stop, and "cannot tell".         [AC-2; D9, D10]
 *   B123 — the replacing line (pending for an earlier pass, expired, unreadable, expiry unreadable), and D13's
 *          held-section wording.                                                                            [AC-2, AC-7; D10, D13]
 *   B124 — confirming with nothing busy: one POST {runId}, "Confirming…", lined up, the pass waiting, pending. [AC-1; D4, D10, D11]
 *   B125 — no answer in 15 s: Confirm enabled again, "outcome unknown", then the next read.                  [AC-1; D11]
 *   B126 — a stale panel's Confirm: already pending, until when; then shown pending.                        [AC-1; D4]
 *   B127 — no pass lined up (queue unavailable; an add that failed): said so, its reason, Run or the schedule. [AC-1; D4, D11]
 *   B128 — a waiting pass takes it up (nothing new); every busy pass asked to stop: lined up behind it.     [AC-1; D2, D4]
 *   B129 — the answer says what happened: busy changed since the prompt; a starting pass; taken up; withdrawn;
 *          cannot tell.                                                                                     [AC-1, AC-2; D4, D11]
 *   B130 — an out-of-date prompt: nothing confirmed, the new state, Confirm again for the new pass.         [AC-2; D4, D11]
 *   B131 — the prompt closes by itself on a read that makes Confirm unavailable or changes the pass; not on a
 *          change in what is busy; never while under way.                                                  [AC-2; D10]
 *   B132 — a confirmation used up by a pass that failed or was stopped: no Confirm, and confirm again once a
 *          later pass holds them again.                                                                    [AC-1; D13]
 *   B133 — an admin's disabled Confirm and its reason, exactly where the owner's would be.                  [AC-3; D9]
 *   B134 — a refused (403, 401) or failed (500) confirmation: the reason, then the state as it stands.     [AC-3, AC-4; D4, D11]
 *   B135 — the confirmation in the history, below the start it lined up; another viewer sees it.            [AC-4, AC-1; D5, D12]
 *   B136 — the pass that took it up: the owner's confirmation and when it was made; "(when not recorded)".  [AC-4; D7, D12]
 *   B137 — a pass that found it and did not honour it, with why.                                             [AC-4; D12]
 *   B138 — the overdue warning; none when on time, with no entry, no schedule, or no pass.                 [AC-5; D14]
 *   B139 — overdue while a pass waits says so; it clears within POLL_MS of a pass beginning.               [AC-5; D14]
 *   B140 — "cannot tell" (the schedule, the rule, the report, no member, a failed status read); still being
 *          checked before the status answers.                                                               [AC-5; D14]
 *   B141 — the warning shows while the schedule list loads and beside its failure.                         [AC-5; D14, R12]
 *   B142 — a device clock 3 days out shows the same verdict.                                                 [AC-5; D8, D14]
 *   B143 — focus: the Turn off prompt.                                                                       [AC-6; D15]
 *   B144 — focus: the Stop prompt.                                                                           [AC-6; D15]
 *   B145 — focus: the Confirm prompt.                                                                        [AC-6; D15]
 *   B146 — the opening line names confirming held removals, for the owner.                                   [AC-7; D16]
 *   B147 — the request pin: only GETs on a held list until Confirm is pressed, then exactly its POST.       [Test tasks; § Seams]
 *   Story 7's review, round 1 (engineering-team/reviews/tagging-edges/7-confirm-held-removals.md, blocking 1, requested
 *   2, 5 and 10; ADR 0007 § "Fix-round notes", D14 and D15). Fixtures: F.SCENE7_R1. Red until the fix, each for the
 *   reason its last message names: B148 (focus falls to the page), B149 (focus moves to Cancel, then the held heading),
 *   B150 (focus stays on the button now reading "Turn on") and B154 (the kept verdict is judged). Green on purpose, to
 *   pin AC-6's "however it closes" on the closing paths no case ran (requested 2): B151, B152 and B153. B129 is revised,
 *   not replaced: its withdraw-failed case now stages the read after the answer, both ways (the confirmation stands; that
 *   pass took it up), so its title holds (requested 10); it stays green.
 *   B148 — focus on Confirm's answer line ("lined up"; the waiting pass takes it up) stays on that same line while the
 *          next reads show the pass running, then ended.                                          [AC-6; D15 note]
 *   B149 — the prompt open, focus elsewhere: a read from the held list to none closes it and moves no focus — never to
 *          Cancel, never to the held section's heading.                                            [AC-6; D15, D15 note]
 *   B150 — "Turn off" focused (after Cancel, or by the owner) and a read shows the path off: focus to the path
 *          section's heading, never on "Turn on", by text or as the same button; a keypress sends nothing. [AC-6; D15 note]
 *   B151 — Confirm with no answer in 15 s: focus on the line that says the outcome is unknown, kept there as the next
 *          read lands.                                                                              [AC-6; D11, D15]
 *   B152 — Turn off refused (403), and Turn off with no answer in 15 s: focus on the line that says so.     [AC-6; D15]
 *   B153 — Stop refused (a lapsed session's 401): focus on the line that says so.                           [AC-6; D15]
 *   B154 — a status read that fails after a good one (on time; overdue): the backstop section cannot tell, because the
 *          pass status could not be read, and never shows the kept verdict; a good read brings it back.   [AC-5; D14 note]
 *   Story 7's fix round 2 (review round 2, blocking 2 and requested 4; ADR 0007 § Fix-round notes, round 2, D15):
 *   B150 gains a third case, red until the fix: "Turn off" focused, then the window loses focus (a blur while it stays
 *   the focused element) before the read shows the path off. B155 is green on purpose: round 1's keys already do it,
 *   and no case ran it.
 *   B155 — Confirm under way, focus on the prompt's heading: reads that show a pass running, then ended holding nothing,
 *          keep the prompt, the same element, and focus on it; the answer then takes focus to its line. [AC-6; D10, D15 note]
 *
 * ── A story that changes a Relays sub-tab runs B39 ───────────────────────────────────────────────────────────────
 * B39 is the only check that the other Relays sub-tabs (Router Management, Negentropy Sync, Relay Configuration,
 * Streaming ETL, Scheduled Tasks) send the requests they did, and this spec is not part of `npm test`'s gate. So any
 * story that changes what one of those sub-tabs requests (a new read on mount, a poll, a removed read) runs B39:
 *   ... npx playwright test tests/brainstorm/tagging-pipeline-panel.spec.js --project=chromium -g "B39"
 * If the change is intended, update tests/brainstorm/fixtures/relay-subtab-requests.json by hand in the same story,
 * with a `handEdits` entry naming the commit and why (re-recording with TP_RECORD_BASELINE=1 is refused on every
 * build since story 4, which contains the panel). relay-stream-gaps #3 (ffda8152) skipped this, and B39 was red from
 * 2026-10-09 until story 7 (ledger 2026-10-28-relay-subtab-baseline-stale).
 *
 * ── Hermetic by construction ──────────────────────────────────────────────────────────────────────────────────────
 * Every /api route is mocked, story 5's switch included (GET its record, POST a change, on one route; the default
 * POST acts as the server would, so the status and the record follow it), and story 6's pass record (GET), Run and
 * Stop (POSTs), whose defaults are as quiet: no action recorded, and Run and Stop as the server would answer them
 * (F.applyRun, F.applyStop). Story 4's and 5's status bodies carry no `control` (a server before story 6). Story 7's
 * confirm (POST) acts as the server would by default (F.applyConfirm, owner only); story 4–6 bodies carry no `overdue`
 * (a server before story 7), story 7's scenes (F.SCENE7) do. The catch-all is registered FIRST (so every later route wins) and answers 599
 * { success: false }: readSection treats any 2xx JSON object as good, so an unmocked route must never look like a good
 * answer (ADR 0004 § Seams). App routes (/tapestry/**) are answered with the served app shell, so client routing works
 * on a static server. The panel's tests run in UTC with the en-GB locale and a page clock that starts at the fixtures'
 * NOW and flows in real time, so every printed time is known.
 *
 * ── What the copy checks read ─────────────────────────────────────────────────────────────────────────────────────
 * Only T9's words are matched as words (Tagging pipeline, not yet available, unknown, not recognised, Recount, Retry).
 * Every other note is matched by its idea (the regexes below accept several phrasings), and each is checked against a
 * state where it must NOT show, so a heading or a label that is always there cannot satisfy it. Explanations are read
 * from the panel's own view module (ui/src/utils/taggingPipelineView.js's explain()), so no sentence is pinned here.
 * Times are matched as the clock time (24- or 12-hour) or as the time relative to the fixtures' NOW.
 *
 * ── Running it ────────────────────────────────────────────────────────────────────────────────────────────────────
 * Build the UI under test into the gitignored repo tmp dir (never dist/, which the local stack serves), inside the
 * container (the repo is bind-mounted at /usr/local/lib/node_modules/brainstorm):
 *   docker exec tapestry sh -c 'cd /usr/local/lib/node_modules/brainstorm/ui && npx vite build --outDir ../tmp/tp-dist --emptyOutDir'
 * Serve it (background):   cd tmp/tp-dist && python3 -m http.server 4174 --bind 127.0.0.1
 * Run (Node 22 on PATH):   BRAINSTORM_BASE_URL=http://localhost:4174 npx playwright test \
 *                            tests/brainstorm/tagging-pipeline-panel.spec.js --project=chromium
 * Record AC-6's baseline:  the same with TP_RECORD_BASELINE=1, on the UI before the change (88af7df3). It writes
 *                          tests/brainstorm/fixtures/relay-subtab-requests.json and skips every other test. It refuses
 *                          to record from a build that already contains the panel.
 * Afterwards: stop the server, rm -rf tmp/tp-dist.
 */

const POLL_MS = 5000; // ADR 0004 § UI: taggingPipelineView.js's POLL_MS
const TAB = 'Tagging pipeline'; // T9
const SECTIONS = ['tp-pass', 'tp-held', 'tp-schedule', 'tp-path', 'tp-drift'];
const EXISTING_TABS = ['🔄 Router Management', '🔃 Negentropy Sync', '📡 Relay Configuration', '⚡ Streaming ETL', '📅 Scheduled Tasks'];
const BASELINE_FILE = path.join(__dirname, 'fixtures', 'relay-subtab-requests.json');
const VIEW_MODULE = path.join(__dirname, '..', '..', 'ui', 'src', 'utils', 'taggingPipelineView.js');
const RECORDING = process.env.TP_RECORD_BASELINE === '1';
const SETTLE_MS = 3000;

/* ── Small helpers ─────────────────────────────────────────────────────────────────────────────────────────────── */

const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A whole number as the panel may print it (with or without a thousands separator), never part of a longer token. */
function numSrc(n) {
  const s = String(n);
  let p = '';
  for (let i = 0; i < s.length; i += 1) {
    p += s[i];
    const rest = s.length - 1 - i;
    if (rest > 0 && rest % 3 === 0) p += '[,.\\u00a0\\u202f ]?';
  }
  return `(?<![\\w.,])${p}(?![\\w]|[.,]\\d)`;
}
const numRe = (n) => new RegExp(numSrc(n));
/** A number within 40 non-digit characters of a label, on either side ("unexplained 0", "3 unexplained"). */
const near = (label, n) => new RegExp(`(?:${label})\\D{0,40}${numSrc(n)}|${numSrc(n)}\\D{0,40}(?:${label})`, 'i');
/** A code as a word of its own (codes hold hyphens and dots). */
const codeRe = (code) => new RegExp(`(?<![\\w-])${esc(code)}(?![\\w-])`);
/** The text without an "on/off" label, so 'on' and 'off' are read as values. */
const noOnOff = (s) => s.replace(/\bon\s*\/\s*off\b/gi, ' ');

/**
 * A time as the panel may print it: its UTC clock time (24- or 12-hour, the page runs in UTC), or its distance from
 * the fixtures' NOW (the page clock starts there) in minutes or hours.
 */
function timeRe(iso) {
  const d = new Date(iso);
  const h = d.getUTCHours();
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const h12 = h % 12 || 12;
  const hours = [...new Set([String(h).padStart(2, '0'), String(h), String(h12), String(h12).padStart(2, '0')])];
  const alts = [`(?<![\\d:])(?:${hours.join('|')})[:.]${mi}(?!\\d)`];
  const diff = Math.abs(Date.parse(iso) - Date.parse(F.NOW)) / 60000;
  if (diff < 1) alts.push('just now', '\\bnow\\b', '\\bseconds?\\b', '\\b0\\s?(?:m|min|mins|minutes?)\\b');
  const m = Math.floor(diff);
  if (diff < 120) for (const x of [m - 1, m, m + 1]) if (x >= 1) alts.push(`\\b${x}\\s?(?:m|min|mins|minutes?)\\b`);
  if (diff >= 60) alts.push(`\\b${Math.floor(diff / 60)}\\s?(?:h|hr|hrs|hours?)\\b`);
  return new RegExp(alts.join('|'), 'i');
}

const NOT_RECOGNISED = 'not recognised'; // T6 / T9
const NOT_YET = 'not yet available'; // T9

/* The notes, by idea. Each is also checked absent where it must not show. */
const NO_PASS_YET = /no pass\b[^.]*\b(?:yet|so far)\b|\bno pass (?:has|have) (?:ever )?run\b|(?:has|have) not (?:yet )?run\b|hasn't (?:yet )?run\b|\bnever (?:been )?run\b/i;
const NO_BACKSTOP = /\bno backstop\b|without (?:a |any )?backstop|backstop\b[^.]{0,30}\b(?:missing|absent)\b|\bno (?:enabled )?(?:scheduled tasks? )?(?:entry|entries)\b[^.]{0,60}\b(?:runs?|running|schedules?)\b[^.]{0,30}\bpass\b|\bnothing\b[^.]{0,30}\b(?:schedules|runs)\b[^.]{0,20}\bpass\b/i;
const DISABLED_MENTION = /(?<!\b(?:no|0|zero|without) )\bdisabled\b(?![^.]{0,6}\b(?:0|none|no)\b)|\b(?:entry|entries)\b[^.]{0,40}\b(?:turned|switched) off\b/i;
const NOT_SCHEDULED = /not scheduled|\bno next run\b|(?:is not|isn't|not) (?:yet )?(?:due|planned|set) to run|scheduler has no/i;
const WEAKER_THAN_DAILY = /weaker than daily|less (?:often|frequently) than (?:daily|once a day|every day)|\bnot (?:even )?(?:daily|every day|once a day)\b|(?:runs?|running) less than (?:daily|once a day)/i;
const SEVERAL = /\b(?:2|two)\b[^.]*\b(?:entries|enabled|schedules|backstops)\b|\b(?:entries|enabled|schedules)\b[^.]*\b(?:2|two)\b|\bmore than one\b|\bseveral\b/i;
const PENDING = /\bpending\b|\bawaiting\b|waits? for the next pass|will be (?:used|honou?red|applied)|\bconfirm\w*\b[^.]*\b(?:until|expires?|valid)\b/i;
const PENDING_STRICT = /\bpending until\b|\bis pending\b/i; // absent when expired (the reviewer's check)
const EXPIRED = /\bexpired\b|no longer valid|\blapsed\b/i;
// Story 4's expired line ("it stays until the next pass, which does not honour it"); story 7 replaced that wording
// (ADR 0007 D13), so B11 no longer asks for it. Kept for the record of what story 4 pinned.
const EXPIRED_STAYS = /until the next pass|next pass\b[^.]*\b(?:not|never|won't|doesn't|ignores?)\b|\b(?:not|never|won't|doesn't)\b[^.]*\b(?:honou?r|use|apply|act on)\w*\b[^.]*\bnext pass\b/i;
const UNREADABLE = /unreadable|(?:cannot|could not|can't|couldn't) be read|not readable/i;
const RUNNING_WAITS = /\b(?:ends|finishes|ended|finished|done|completes?|completed)\b/i;
const ON = /\b(?:is|path|switch(?:ed)?|turned) on\b|\bswitch\b[^.]{0,20}\bon\b|\bon\b[^.]{0,20}\brunning\b/i;
const NOT_RUNNING = /not running|\bisn't running\b|(?:process|path)\b[^.]*\b(?:stopped|not alive|isn't alive|has stopped|is down|not started)\b/i;
const NOT_RUNNING_STRICT = /\bnot running\b|\bis not alive\b|\bisn't (?:running|alive)\b/i;
const STALE = /\bstale\b|not (?:been )?(?:re)?written|not (?:been )?updated|out of date|hasn't (?:been )?(?:updated|rewritten)|(?:over|more than) a minute (?:old|ago)/i;
const STATUS_UNREADABLE = /status\b[^.]*(?:(?:cannot|could not|can't|couldn't) be (?:read|parsed)|unreadable|not readable)|unreadable status/i;
const SWITCH_UNREADABLE = /(?:switch|on\s*\/\s*off|on-off)\b[^.]*(?:(?:cannot|could not|can't|couldn't) be read|unreadable|not readable)|unreadable (?:switch|on\s*\/\s*off)/i;
const FIRST_START = /\bfirst\b[^.]{0,20}\bstart|\bsince\b[^.]{0,30}\bstart/i;
const COUNTS_RESET = /(?:since|from|after) (?:the |a |their |its )?reset\b|\bwere reset\b|\bhave been reset\b|\bwas reset\b|\breset (?:at|on|when|because)\b/i;
const LAST_FIGURES = /last figures|figures (?:it )?(?:produced|recorded|written|from|before)|last (?:recorded|written|known|produced)|(?:before|when) (?:it was |the path was )?(?:switched|turned) off|previous figures/i;
const CATCH_UP = /catch[- ]?up/i;
const INSTEAD = /\binstead\b|not the latest|latest pass\b[^.]*\b(?:not|did not|didn't|has not|hasn't|never)\b[^.]*\bfinish|\b(?:older|earlier|previous) (?:finished )?pass\b/i;
const NO_FINISHED_WHY = /no finished pass|not finished|no pass (?:has )?finished|none (?:of the passes )?(?:has )?finished|no pass\b[^.]*\bfinished\b/i;
const WAITS_FOR_PASS = /\b(?:changes|anything|edits|taggings)\b[^.]*\bsince\b[^.]*\b(?:wait|next pass)|\bwait\w*\b[^.]*\bfor the next pass|until the next pass|next pass will (?:pick|catch|reflect)/i;
const EXPLAINED_NUM = /(?<![Uu]n)explained\W{0,5}-?\d/i;
const LOADING = /loading|reading|fetching|waiting for|asking/i;
// Story 4 review round 1.
const DID_NOT_FINISH = /\b(?:did not|didn't|failed to|never|could not) (?:finish|complete|end)\w*\b|\blatest pass\b[^.]*\b(?:failed|was stopped|stopped)\b/i;
const PASS_RUNNING = /\bpass is (?:still )?(?:running|under ?way|in progress)\b|\brunning pass\b|\bpass (?:that is |which is )?(?:still )?running\b/i;
const NEWEST_FINISHED_EXPLAINS = /\b(?:newest|latest|last|most recent|previous|earlier) (?:finished|completed) pass\b|\bfinished pass\b[^.]*\bexplain|\bexplain\w*\b[^.]*\bfinished pass\b/i;
const NEO4J_DOWN = /\bNeo4j\b[^.]*\b(?:down|unreachable|not running|not answering|not reachable|unavailable|(?:could not|cannot|can't|couldn't) be reached|not up|refus\w*|stopped)\b|\b(?:reach|connect(?:ed)? to|contact)\w*\b[^.]*\bNeo4j\b/i;
const COUNTS_PREDATE = /\bbefore\b[^.]*\bpass\b[^.]*\b(?:ended|finished|completed|ran)\b|\bpredat\w*\b|\b(?:older|earlier) than\b[^.]*\bpass\b|\bpass\b[^.]*\b(?:ended|finished)\b[^.]*\bafter\b[^.]*\b(?:counts?|counted|taken|counting)\b/i;
const ASK_RECOUNT = /\b(?:press|click|use|run|ask for|do|choose|select|try|needs?|request)\b[^.]{0,30}\bRecount\b|\bRecount\b[^.]{0,60}\b(?:to|for|so)\b[^.]{0,40}\b(?:count|figures?|explain\w*|current|fresh|new|up to date)\b/i;
const APPLIED_REMOVALS = /\bapplied\b[^.]*\bremovals?\b|\bremovals?\b[^.]*\b(?:were|was|been|are) applied\b/i;
/** The path line's guard (story 4 review round 2 R2-4; story 5 review NB2, E1): the explained part leaves the path's figures out. */
const EXPLAINED_EXCLUDES = /\bexplained part\b[^.]*\b(?:does not|doesn't|do not|don't|not) include\b|\bexplained part\b[^.]*\b(?:excludes?|leaves? (?:them |these )?out)\b|\bnot (?:included|counted) in the explained part\b/i;
const NEGATED = /\b(?:no|none|not|never|nothing|without|0)\b/i;
/** The sentences that claim confirmed removals were applied (a negated sentence, "applied none of …", is no claim). */
const appliedClaims = (text) => text.split(/(?<=\.)\s+/).filter((x) => APPLIED_REMOVALS.test(x) && !NEGATED.test(x));
/** A code labelled as the reason ("Why: record-missing", "because record-missing", "Reason: record-missing"). */
const whyLabel = (code) => new RegExp(`\\b(?:why|because|reason)\\b\\W{0,15}${esc(code)}(?![\\w-])`, 'i');
/** A label that dates figures read earlier ("read at 12:00", "as of 12:00"), at the time `iso`. */
const readAtLabel = (iso) => new RegExp(`\\b(?:read|fetched|loaded|received|as of|from)\\b[^.]{0,60}?(?:${timeRe(iso).source})`, 'i');

/*
 * Story 5 (ADR 0005). Matched by idea, as above; the labels the story and ADR fix ("Turn off", "Turn on", "Cancel")
 * are matched as words.
 */
/** A time as its UTC clock time only (24- or 12-hour): for times near NOW, where timeRe's relative forms match other copy. */
function clockRe(iso) {
  const d = new Date(iso);
  const h = d.getUTCHours();
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const h12 = h % 12 || 12;
  const hours = [...new Set([String(h).padStart(2, '0'), String(h), String(h12), String(h12).padStart(2, '0')])];
  return new RegExp(`(?<![\\d:])(?:${hours.join('|')})[:.]${mi}(?!\\d)`);
}
/** The sentences of `text` that match every one of `res`. */
const sentencesWith = (text, ...res) => text.split(/(?<=[.?])\s+/).filter((s) => res.every((re) => re.test(s)));
const STARTING_NOTE = /\bstarting\b/i;
const UP_TO_30S = /\b30\s?(?:s|secs?|seconds)\b|\bhalf a minute\b/i;
const IS_RUNNING = /\bis running\b|\bprocess\b[^.]*\brunning\b|\brunning since\b|\bhas run since\b/i;
const UNDER_WAY = /\b(?:turning|switching)\b|\bunder ?way\b|\bin progress\b|\bsending\b|\bwaiting\b/i;
const OUTCOME_UNKNOWN = /\b(?:outcome|result)\b[^.]*\bunknown\b|\bunknown\b[^.]*\b(?:outcome|result|whether)\b|\bnot known whether\b|\b(?:cannot|can't|could not|couldn't) tell whether\b/i;
/** The warning beside "Turn on" (AC-1): taggings already on the relay wait for a pass. */
const relayTaggingsWait = (text) => sentencesWith(text, /\balready\b/i, /\brelay\b/i, /\b(?:wait\w*|until)\b/i, /\bpass\b/i);
/** ... and when the report cannot be read: it could not check. */
const couldNotCheckPass = (text) => sentencesWith(text, /\b(?:could not|couldn't|cannot|can't|unable to)\b[^.]*\bcheck/i, /\b(?:pass\w*|report)\b/i);
const SIGN_IN_AGAIN = /\bsign(?:ed)? in again\b/i;
/** The refusal's own sentence (ADR 0005 D12 "refused", as TV80 reads it): sign in again, as the owner or an admin. */
const OWNER_OR_AN_ADMIN = /\bowner or an admin\b/i;
const refusedSentences = (text) => sentencesWith(text, SIGN_IN_AGAIN, OWNER_OR_AN_ADMIN);
const STATE_UNCHANGED = /\bunchanged\b|\bnot changed\b|\bhas not changed\b|\bdid not change\b|\bdidn't change\b/i;
const FREE_SPACE = /\bfree space\b|\bspace\b[^.]*\bdata volume\b|\bdata volume\b[^.]*\b(?:space|full)\b/i;
const WRITABLE = /\bwritable\b|\bcan be written\b|\bwrite to it\b/i;
const NOT_TURNED_OFF = /\b(?:could not|couldn't|cannot|can't|was not|wasn't|did not|didn't)\b[^.]*\bturn(?:ed)? (?:it |the path )?off\b|\bnot turned off\b/i;
const STILL_ON = /\bstill on\b|\bremains on\b|\bstays on\b/i;
const TURNED_ON = /\b(?:turned|switched) on\b/i;
const TURNED_OFF = /\b(?:turned|switched) off\b/i;
const TURNED_ON_BY = /\b(?:turned|switched) on by\b/i;
const NOT_RECORDED = /\bnot (?:been )?recorded\b|\bunrecorded\b|\b(?:could not|couldn't|cannot|can't) be recorded\b|\bwasn't recorded\b|\bweren't recorded\b/i;
const NO_CHANGE_RECORDED = /\bno change\b[^.]*\brecorded\b|\bno changes? (?:has|have) been recorded\b|\bnothing (?:has been )?recorded\b|\bnever (?:been )?(?:switched|turned|changed)\b/i;
const HISTORY_UNREADABLE = /\bhistory\b[^.]*(?:(?:cannot|could not|can't|couldn't) be read|\bunreadable\b|not readable)|\bunreadable history\b/i;
const RECORD_REFRESHING = /\brefresh\w*\b|\bbeing (?:updated|read|re-?read)\b|\bupdating\b|\bre-?reading\b/i;
/** A sentence that claims how many confirmed removals were applied (R2-3), and the words that make it a lower bound. */
const removalClaims = (text) => sentencesWith(text, /\bappl(?:ied|y)\b/i, /\bconfirm\w*\b/i, /\bremovals?\b/i);
const LOWER_BOUND = /\bat least\b|\bor more\b|\bno fewer than\b|\b(?:may|might|could) have\b|\bpossibly\b|\blast sav(?:e|ed)\b|\bbefore it stopped\b|\bat (?:its|the) last\b/i;
/** Where a remedy must no longer send the owner (R2-6): logs that do not hold a pass's error details. */
const LOG_POINTERS = /\btask(?:'s)? log\b|strfry-error\.log/i;
/** The several-entries backstop warning (B18's idea). */
const SEVERAL_COUNT = /\b(?:2|two)\b[^.]*\b(?:entries|enabled|schedules|backstops)\b|\b(?:entries|enabled|schedules)\b[^.]*\b(?:2|two)\b/i;
/* The off prompt (AC-2; ADR 0005 D13). */
const PROMPT_STOPS = /\bstops?\b[^.]*\b(?:within|in) (?:a few |about \d+ |\d+ )?seconds?\b|\b(?:within|in) (?:a few |about \d+ |\d+ )?seconds?\b[^.]*\bstops?\b/i;
const PROMPT_KEPT = /\bkept\b|\bkeeps\b/i;
const PROMPT_CATCH_UP = /\bcaught up\b|\bcatch(?:es)?[- ]?up\b/i;
const PROMPT_BACK_ON = /\bTurn on\b|\b(?:turned|switched) (?:it |the path )?(?:back )?on\b/i;
const PROMPT_NEXT_PASS = /\bnext pass\b/i;
/** The backstop still being checked: the schedule list's read is still loading (review round 1, requested 5). */
const BACKSTOP_CHECKING = new RegExp('\\b(?:backstop|schedul\\w*)\\b[^.]*'
  + '\\b(?:(?:still )?being (?:checked|read)|(?:still )?loading)\\b'
  + '|\\b(?:still )?(?:checking|reading|loading)\\b[^.]*\\b(?:backstop|schedul\\w*)\\b', 'i');
const BACKSTOP_UNCHECKED = /\bbackstop\b[^.]*(?:could not|couldn't|cannot|can't) be (?:checked|read|confirmed)|\b(?:could not|couldn't|cannot|can't|unable to) (?:check|read|confirm)\b[^.]*\b(?:backstop|schedul\w*)\b/i;
const FIRST_DROPPED = /\b(?:dropped|discarded|thrown away|lost|deleted|cleared)\b/i;
const FIRST_START_AGAIN = /\bfirst start\b[^.]*\bagain\b|\bagain\b[^.]*\bfirst start\b/i;
const PASS_AFTER_LIVE = /\bpass\b[^.]*\b(?:after|once|when)\b[^.]*\blive\b|\b(?:after|once|when)\b[^.]*\blive\b[^.]*\bpass\b/i;
const FIRST_START_UNCHECKED = /\b(?:could not|couldn't|cannot|can't|unable to) (?:check|tell|confirm|be (?:checked|confirmed|sure))\b[^.]*\bfirst start|\bfirst start\b[^.]*(?:could not|couldn't|cannot|can't) be (?:checked|confirmed|read)|\bunknown\b[^.]*\bfirst start|\bfirst start\b[^.]*\bunknown\b/i;
const IF_FIRST_START = /\bif\b[^.]*\b(?:first start|dropped|discarded)\b/i;
/**
 * The normal variant's claims (AC-2 "Normally"), sentence by sentence: what the path holds is kept, and changes stored
 * meanwhile are caught up when it is turned back on. A negated sentence ("nothing it gathered is kept") claims neither.
 */
const keptClaims = (text) => sentencesWith(text, PROMPT_KEPT).filter((s) => !NEGATED.test(s));
const caughtUpOnClaims = (text) => sentencesWith(text, PROMPT_CATCH_UP, PROMPT_BACK_ON).filter((s) => !NEGATED.test(s));

/** An answer that is an HTTP failure: fail(500) → 500 { success: false }. */
const fail = (status, body = { success: false, error: 'fixture failure' }) => ({ __http: status, body });
/** A fixture answer written { status, body } (F.SWITCH_ANSWER) as a mock answer; anything else as it is. */
const answerOf = (a) => (a && !a.__http && typeof a.status === 'number' && Object.prototype.hasOwnProperty.call(a, 'body')
  ? (a.status >= 200 && a.status <= 299 ? a.body : fail(a.status, a.body))
  : a);

async function fulfil(route, spec) {
  let v = typeof spec === 'function' ? spec(route.request()) : spec;
  if (v && typeof v.then === 'function') v = await v;
  if (v && v.__http) return route.fulfill({ status: v.__http, contentType: 'application/json', body: JSON.stringify(v.body) });
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
}

/* ── The panel's own explanations (no sentence is pinned here) ─────────────────────────────────────────────────── */

let VIEW = null;
let VIEW_ERROR = null;
async function loadView() {
  if (VIEW || VIEW_ERROR) return;
  try {
    VIEW = await import(pathToFileURL(VIEW_MODULE).href);
    if (typeof VIEW.explain !== 'function') throw new Error('it has no explain() export');
  } catch (e) {
    VIEW = null;
    VIEW_ERROR = e;
  }
}
/** explain(kind, code).text from the panel's view module; fails by name while the module does not exist. */
function explanation(kind, code) {
  expect(VIEW, `${path.relative(process.cwd(), VIEW_MODULE)} loads and exports explain() (ADR 0004 § UI) — not implemented yet: ${VIEW_ERROR && VIEW_ERROR.message}`).toBeTruthy();
  const e = VIEW.explain(kind, code);
  expect(e.recognised, `explain('${kind}', '${code}') is recognised`).toBe(true);
  return squash(e.text);
}

/* ── The mocks ─────────────────────────────────────────────────────────────────────────────────────────────────── */

const WHO = {
  owner: { pubkey: F.OWNER, classification: 'owner' },
  admin: { pubkey: F.ADMIN, classification: 'admin' },
  customer: { pubkey: F.CUSTOMER, classification: 'customer' },
  visitor: null,
};

/**
 * Mock every route. Each answer is a body, fail(status), or a function of the request returning either (or a promise
 * of either), evaluated per request, so a test can change it mid-run through the returned `set`. `held` answers from
 * the current status body; a `held` function gets (request, theDefaultAnswer).
 * Story 5 (ADR 0005 § Seams "Browser mocks"): the switch path is one route branching on the method. `record` is the
 * GET's answer; left undefined, it is the record that agrees with the current `realtime` body (F.recordFor). `switch`
 * is the POST's answer (a body, fail(…), an F.SWITCH_ANSWER, or a function of (request, theServersChange)); left
 * undefined, the change lands as the server would make it: the record gains the viewer's change and the status
 * follows (F.REALTIME.STARTING after an on, F.REALTIME.OFF_WITH_FIGURES after an off).
 * Returns { log, set }: log.api is every /api request as "METHOD /path?query", log.nonGet every non-GET, and log.sent
 * every non-GET's { method, path, body, contentType }.
 */
async function mock(page, o = {}) {
  const cur = {
    who: 'owner',
    status: F.STATUS.HELD_PENDING,
    realtime: F.REALTIME.ON_LIVE,
    schedule: F.SCHEDULE.ONE,
    drift: F.DRIFT.EXAMPLE,
    heldList: F.HELD_LIST,
    record: undefined,
    switch: undefined,
    passRecord: undefined,
    run: undefined,
    stop: undefined,
    confirm: undefined,
    ...o,
  };
  const log = { api: [], nonGet: [], sent: [], navigations: 0 };
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/api/')) log.api.push(`${req.method()} ${u.pathname}${u.search}`);
    if (u.pathname.startsWith('/api/') && req.method() !== 'GET') {
      log.nonGet.push(`${req.method()} ${u.pathname}`);
      log.sent.push({ method: req.method(), path: u.pathname, body: req.postData(), contentType: req.headers()['content-type'] || null });
    }
  });
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) log.navigations += 1; });

  const shellRes = await page.request.get('/');
  const shell = await shellRes.text();

  // The catch-all FIRST: every route registered after it wins. 599, so it is never a good answer.
  await page.route('**/api/**', (r) => r.fulfill({ status: 599, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'not mocked by tagging-pipeline-panel.spec.js' }) }));
  await page.route('**/tapestry/**', (r) => (r.request().resourceType() === 'document'
    ? r.fulfill({ status: 200, contentType: 'text/html', body: shell })
    : r.fallback()));

  const who = () => WHO[cur.who];
  /** The current answer for key k: a function stored in `cur` is called per request. */
  const pick = (k) => (req) => (typeof cur[k] === 'function' ? cur[k](req) : cur[k]);
  await page.route('**/api/auth/status', (r) => fulfil(r, () => (who()
    ? { authenticated: true, pubkey: who().pubkey }
    : { authenticated: false, pubkey: null })));
  // The signed-in user's classification, from which the panel takes its role (story 7; ADR 0007 D9).
  await page.route('**/api/auth/user-classification', (r) => fulfil(r, () => F.CLASSIFICATION[cur.who] || F.CLASSIFICATION.visitor));
  await page.route('**/api/profiles**', (r) => fulfil(r, { success: true, profiles: {} }));
  await page.route('**/api/settings', (r) => fulfil(r, { success: true, settings: {}, defaults: {}, overrides: {} }));
  // The Scheduled Tasks sub-tab (the schedule warning's button opens it; AC-6 opens it).
  await page.route('**/api/scheduled-tasks/history**', (r) => fulfil(r, { success: true, runs: [] }));
  await page.route('**/api/get-customers', (r) => fulfil(r, { success: true, customers: [] }));
  await page.route('**/api/grapevine/preferences', (r) => fulfil(r, { success: true, preferences: { povPubkey: 'f'.repeat(64) } }));
  // The panel's five reads.
  await page.route('**/api/tagging-edges/status', (r) => fulfil(r, pick('status')));
  await page.route('**/api/tagging-edges/realtime/status', (r) => fulfil(r, pick('realtime')));
  await page.route('**/api/scheduled-tasks/list', (r) => fulfil(r, pick('schedule')));
  await page.route('**/api/tagging-edges/drift-counts**', (r) => fulfil(r, pick('drift')));
  const heldDefault = (req) => {
    const s = typeof cur.status === 'function' ? null : cur.status;
    if (!s || s.__http) return fail(404, { success: false, error: 'no report yet' });
    const a = F.heldAnswer(s, cur.heldList, req.url());
    return a.status === 200 ? a.body : fail(a.status, a.body);
  };
  await page.route('**/api/tagging-edges/held**', (r) => fulfil(r, (req) => {
    if (typeof cur.held === 'function') return cur.held(req, () => heldDefault(req));
    if (cur.held && cur.held.__http) return cur.held;
    return heldDefault(req);
  }));

  // Story 5's route (ADR 0005 D6, D11): GET the switch's record, POST a change.
  const recordNow = () => (cur.record === undefined ? F.recordFor(typeof cur.realtime === 'function' ? null : cur.realtime) : cur.record);
  /** The server's change (ADR 0005 D2, D3, D11): recorded as the viewer's, the status following it. */
  const serverSwitch = (req) => {
    let on = null;
    try { on = JSON.parse(req.postData() || 'null').on; } catch (_) { on = null; }
    if (typeof on !== 'boolean') return fail(400, { success: false, error: 'the body must be {"on": true} or {"on": false}' });
    const w = who();
    const prev = typeof cur.record === 'function' || (cur.record && cur.record.__http) ? null : recordNow();
    cur.record = F.foldRecord(prev, { on, at: F.NOW, role: w ? w.classification : null, key: w ? w.pubkey.slice(0, 8) : null });
    cur.realtime = on ? F.REALTIME.STARTING : F.REALTIME.OFF_WITH_FIGURES;
    return (on ? F.SWITCH_ANSWER.ON : F.SWITCH_ANSWER.OFF).body;
  };
  await page.route('**/api/tagging-edges/realtime/switch', (r) => fulfil(r, async (req) => {
    if (req.method() === 'POST') {
      let v;
      if (typeof cur.switch === 'function') v = await cur.switch(req, () => serverSwitch(req));
      else v = cur.switch === undefined ? serverSwitch(req) : cur.switch;
      return answerOf(v);
    }
    return typeof cur.record === 'function' ? answerOf(await cur.record(req)) : recordNow();
  }));

  // Story 6's routes (ADR 0006 D6, D9, D13): GET the pass record, POST Run, POST Stop. Their quiet defaults keep the
  // 599 catch-all for routes no story names: `passRecord` left undefined answers F.PASS_RECORD.EMPTY (no action
  // recorded), and `run` / `stop` left undefined act as the server would (F.applyRun, F.applyStop, at F.NOW, as the
  // viewer): the status and the record follow them. Each may be a body, fail(…), an F.RUN_ANSWER / F.STOP_ANSWER
  // { status, body }, or a function of (request, theServersAnswer).
  let lineUps = 0;
  const passRecordNow = () => (cur.passRecord === undefined ? F.PASS_RECORD.EMPTY : cur.passRecord);
  const plainBody = (v) => (v && typeof v === 'object' && !v.__http && typeof v.then !== 'function' ? v : null);
  const viewer = () => (who() ? { role: who().classification, key: who().pubkey.slice(0, 8) } : null);
  const postBody = (req) => { try { return JSON.parse(req.postData() || 'null'); } catch (_) { return undefined; } };
  /** Apply a server action's result: the status and the record follow it, unless a test holds them as functions. */
  const follow = (res) => {
    if (res.status && typeof cur.status !== 'function') cur.status = res.status;
    if (res.passRecord && (cur.passRecord === undefined || plainBody(cur.passRecord))) cur.passRecord = res.passRecord;
    return res.answer;
  };
  const statusBodyNow = () => (typeof cur.status === 'function' ? null : plainBody(cur.status));
  const recordBodyNow = () => (typeof cur.passRecord === 'function' ? null : plainBody(passRecordNow()));
  const serverRun = (req) => {
    lineUps += 1;
    const key = F.lineUpKey((0x5e7000000000 + lineUps).toString(16));
    return follow(F.applyRun({ status: statusBodyNow(), passRecord: recordBodyNow(), viewer: viewer(), body: postBody(req), key }));
  };
  const serverStop = (req) => follow(F.applyStop({ status: statusBodyNow(), passRecord: recordBodyNow(), viewer: viewer(), body: postBody(req) }));
  await page.route('**/api/tagging-edges/pass/record**', (r) => fulfil(r, async (req) => (typeof cur.passRecord === 'function'
    ? answerOf(await cur.passRecord(req))
    : answerOf(passRecordNow()))));
  const action = (k, server) => async (req) => {
    if (req.method() !== 'POST') return fail(404, { success: false, error: 'POST only' });
    let v;
    if (typeof cur[k] === 'function') v = await cur[k](req, () => server(req));
    else v = cur[k] === undefined ? server(req) : cur[k];
    return answerOf(v);
  };
  await page.route('**/api/tagging-edges/pass/run', (r) => fulfil(r, action('run', serverRun)));
  await page.route('**/api/tagging-edges/pass/stop', (r) => fulfil(r, action('stop', serverStop)));

  // Story 7's route (ADR 0007 D1, D4): POST the owner's confirmation. `confirm` left undefined acts as the server would
  // (F.applyConfirm, at F.NOW, as the viewer): the status and the record follow it. It may be a body, fail(…), an
  // F.CONFIRM_ANSWER { status, body }, or a function of (request, theServersAnswer).
  let confirmLineUps = 0;
  const serverConfirm = (req) => {
    confirmLineUps += 1;
    const key = F.lineUpKey((0xc0f000000000 + confirmLineUps).toString(16));
    return follow(F.applyConfirm({ status: statusBodyNow(), passRecord: recordBodyNow(), viewer: viewer(), body: postBody(req), key }));
  };
  await page.route('**/api/tagging-edges/confirm-held-removals', (r) => fulfil(r, action('confirm', serverConfirm)));

  const set = (patch) => Object.assign(cur, patch);
  return { log, set };
}

/** Record every data-state each section takes, from the page's first paint (window.__tpStates). */
async function trackStates(page) {
  await page.addInitScript(() => {
    window.__tpStates = [];
    const note = (el) => {
      const id = el.getAttribute && el.getAttribute('data-testid');
      if (id && /^tp-/.test(id)) window.__tpStates.push(`${id}:${el.getAttribute('data-state')}`);
    };
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') note(r.target);
        for (const n of r.addedNodes || []) {
          if (n.nodeType !== 1) continue;
          note(n);
          n.querySelectorAll('[data-testid^="tp-"]').forEach(note);
        }
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });
  });
}
const statesOf = async (page, id) => (await page.evaluate(() => window.__tpStates || []))
  .filter((s) => s.startsWith(`${id}:`)).map((s) => s.slice(id.length + 1));

/* ── Opening things ────────────────────────────────────────────────────────────────────────────────────────────── */

const relayTabBar = (page) => page.locator('.tab-bar', { has: page.getByRole('button', { name: /Streaming ETL/ }) }).first();
const subTab = (page, name, exact = true) => relayTabBar(page).getByRole('button', { name, exact });
const section = (page, id) => page.getByTestId(id);
const textOf = async (page, id) => squash(await section(page, id).innerText());

async function openRelays(page) {
  await page.goto('/tapestry/settings/relays');
  await expect(page.getByRole('button', { name: /Streaming ETL/ }).first(), 'Settings › Relays renders its tab bar').toBeVisible({ timeout: 20000 });
}

/** Open Settings › Relays › Tagging pipeline. Fails by name while the sub-tab does not exist. */
async function openPanel(page) {
  await openRelays(page);
  const tab = subTab(page, TAB);
  await expect(tab, `Settings › Relays has a "${TAB}" sub-tab (AC-1; T9) — not implemented yet: no such button in the Relays tab bar`).toBeVisible({ timeout: 5000 });
  await tab.click();
  await expect(section(page, 'tp-pass'), 'the panel renders its pass section (data-testid tp-pass, ADR 0004 § UI)').toBeVisible({ timeout: 10000 });
}

/** Wait until a section has left `loading` (ready, empty or error). */
async function settled(page, id) {
  await expect(section(page, id), `${id} finishes loading`).toHaveAttribute('data-state', /^(ready|empty|error)$/, { timeout: 10000 });
}

async function openAndSettle(page, except = []) {
  await openPanel(page);
  for (const id of SECTIONS) if (!except.includes(id)) await settled(page, id);
}

/** Load a fresh page state for one variant: set the answers, reload, reopen the panel. */
async function reopenWith(page, m, patch) {
  m.set(patch);
  await openAndSettle(page);
}

/** Stop the page clock (after a real second has passed since opening), so no poll runs until the test says so. */
async function pauseClock(page) {
  const t = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(t + 1000);
}

const requestsTo = (log, route) => log.api.filter((l) => l.split(' ')[1].split('?')[0] === route);

/* ── Story 5: the control, the prompt and the record (ADR 0005 D12, D13) ─────────────────────────────────────────── */

const SWITCH_POST = `POST ${F.ROUTES.switch}`;
/** The path section's control, by its label (AC-1: "Turn off" while on, "Turn on" while off). */
const control = (page, name) => section(page, 'tp-path').getByRole('button', { name, exact: true });
const controls = (page) => section(page, 'tp-path').getByRole('button', { name: /^\s*Turn (?:on|off)\s*$/ });
const cancelButton = (page) => section(page, 'tp-path').getByRole('button', { name: 'Cancel', exact: true });
/**
 * The pending control (ADR 0005 D12 "While pending it is disabled … and aria-busy"): a button in tp-path that itself
 * carries aria-busy="true". Other elements of tp-path may be busy too (a re-read, say); they are not counted.
 */
const busyButtons = (page) => section(page, 'tp-path').locator('button[aria-busy="true"]');
/** Press the control labelled `name`; fails by name within 5 s when there is no such control. */
async function press(page, name) {
  const b = control(page, name);
  await expect(b, `the path section has a "${name}" control (AC-1; ADR 0005 D12) — not implemented yet if missing`).toBeVisible({ timeout: 5000 });
  await b.click();
}
/**
 * The off prompt (ADR 0005 D13): the nearest element around its "Cancel" button that also holds its "Turn off" button
 * and a heading — an inline confirmation inside tp-path with "a heading, the variant's text, and the buttons".
 */
const PROMPT_XPATH = 'xpath=.//button[normalize-space(.)="Cancel"]/ancestor::*[.//button[normalize-space(.)="Turn off"]]'
  + '[.//h1 or .//h2 or .//h3 or .//h4 or .//h5 or .//h6 or .//*[@role="heading"]][1]';

/** Press "Turn off" and return the prompt it opens: { prompt, cancel, confirm, text() }. */
async function openPrompt(page) {
  await press(page, 'Turn off');
  const cancel = cancelButton(page);
  await expect(cancel, 'pressing "Turn off" opens a prompt inside the path section, with a "Cancel" button (AC-2; ADR 0005 D13) — not implemented yet').toBeVisible({ timeout: 5000 });
  const prompt = section(page, 'tp-path').locator(PROMPT_XPATH).first();
  await expect(prompt, 'the prompt is one element holding its heading, its text, and its "Turn off" and "Cancel" buttons (ADR 0005 D13 "Layout")').toHaveCount(1);
  expect(await prompt.getAttribute('data-testid'), 'the prompt is its own element inside tp-path, not the whole section (ADR 0005 D13: an inline confirmation inside tp-path)').not.toBe('tp-path');
  return {
    prompt,
    cancel,
    confirm: prompt.getByRole('button', { name: 'Turn off', exact: true }),
    text: async () => squash(await prompt.innerText()),
  };
}

/** The history list: the ordered list of up to 10 changes (ADR 0005 D12), its rows newest first. */
const historyRows = (page) => section(page, 'tp-path').locator('ol > li');
const rowText = async (page, i) => squash(await historyRows(page).nth(i).innerText());
/**
 * tp-path's text as the viewer reads it, with its history list left out: where the latest change shows. One
 * synchronous read in the page (the list hidden, the text read, the list shown again), so no render falls between.
 */
async function outsideHistory(page) {
  return squash(await section(page, 'tp-path').evaluate((el) => {
    const lists = [...el.querySelectorAll('ol')];
    const before = lists.map((o) => o.style.display);
    lists.forEach((o) => { o.style.display = 'none'; });
    try {
      return el.innerText;
    } finally {
      lists.forEach((o, i) => { o.style.display = before[i]; });
    }
  }));
}
/**
 * Wait until a section's text as the viewer reads it matches `re`. (innerText, as textOf reads it: toContainText reads
 * textContent, which runs block elements together — "Turn onNo change" — so a \b-anchored idea could miss.)
 */
async function untilText(page, id, re, message, timeout = 5000) {
  await expect.poll(async () => re.test(await textOf(page, id)), { message: `${message} (${re})`, timeout }).toBe(true);
}
const KEYS = [F.OWNER_KEY, F.ADMIN_KEY];

/** The control while a change is under way: the button carrying aria-busy="true", and disabled (ADR 0005 D12). */
async function busyControl(page) {
  const busy = busyButtons(page).first();
  await expect(busy, 'while a change is under way the control — the button itself — carries aria-busy="true" (ADR 0005 D12 "While pending it is disabled … and aria-busy") — not implemented yet if missing').toBeVisible({ timeout: 5000 });
  await expect(busy, 'and that pending control is disabled (ADR 0005 D12)').toBeDisabled();
  return busy;
}

/* ── Story 6: Run, Stop, the busy list and who (ADR 0006 D15–D19) ──────────────────────────────────────────────── */

const RUN_POST = `POST ${F.ROUTES.run}`;
const STOP_POST = `POST ${F.ROUTES.stop}`;
/** D17 fixes the labels: "Run a pass now", "Stop", and the prompt's "Stop the pass" / "Stop the passes". */
const RUN_LABEL = 'Run a pass now';
const runButton = (page) => section(page, 'tp-pass').getByRole('button', { name: RUN_LABEL, exact: true });
const stopButton = (page) => section(page, 'tp-pass').getByRole('button', { name: 'Stop', exact: true });
const passCancel = (page) => section(page, 'tp-pass').getByRole('button', { name: 'Cancel', exact: true });
/** A button in tp-pass that itself carries aria-busy="true" (D17: a pending Run, or the prompt's pending stop). */
const passBusyButtons = (page) => section(page, 'tp-pass').locator('button[aria-busy="true"]');
const STOP_THE_PASS = /^\s*Stop the pass(?:es)?\s*$/;

/** Press "Run a pass now"; fails by name within 5 s when there is no such control (ADR 0006 D17). */
async function pressRun(page) {
  const b = runButton(page);
  await expect(b, `the pass section has a "${RUN_LABEL}" control for the owner or an admin (story 6 AC-1; ADR 0006 D17) — not implemented yet if missing`).toBeVisible({ timeout: 5000 });
  await expect(b, `"${RUN_LABEL}" is enabled`).toBeEnabled();
  await b.click();
}

/**
 * The Stop prompt (ADR 0006 D17, the ADR 0005 D13 pattern): the nearest element around its "Cancel" that also holds
 * a "Stop the pass(es)" button and a heading — an inline confirmation inside tp-pass.
 */
const STOP_PROMPT_XPATH = 'xpath=.//button[normalize-space(.)="Cancel"]/ancestor::*[.//button[starts-with(normalize-space(.),"Stop the pass")]]'
  + '[.//h1 or .//h2 or .//h3 or .//h4 or .//h5 or .//h6 or .//*[@role="heading"]][1]';

/** Press "Stop" and return the prompt it opens: { prompt, cancel, confirm, heading, text() }. */
async function openStopPrompt(page) {
  const b = stopButton(page);
  await expect(b, 'the pass section shows "Stop" while some busy pass has no stop asked for (story 6 AC-3; ADR 0006 D16 canStop, D17) — not implemented yet if missing').toBeVisible({ timeout: 5000 });
  await b.click();
  const cancel = passCancel(page);
  await expect(cancel, 'pressing "Stop" opens a prompt inside the pass section, with a "Cancel" button (story 6 AC-3 "A prompt comes first"; ADR 0006 D17)').toBeVisible({ timeout: 5000 });
  const prompt = section(page, 'tp-pass').locator(STOP_PROMPT_XPATH).first();
  await expect(prompt, 'the prompt is one element holding its heading, its text, and its "Stop the pass(es)" and "Cancel" buttons (ADR 0006 D17: settings-group, h4)').toHaveCount(1);
  expect(await prompt.getAttribute('data-testid'), 'the prompt is its own element inside tp-pass, not the whole section (ADR 0006 D17: an inline prompt)').not.toBe('tp-pass');
  const heading = squash(await prompt.locator('h1, h2, h3, h4, h5, h6, [role="heading"]').first().innerText());
  return {
    prompt,
    cancel,
    heading,
    confirm: prompt.getByRole('button', { name: STOP_THE_PASS }),
    text: async () => squash(await prompt.innerText()),
  };
}

/**
 * Whether section `id` shows one thing — a busy pass, a pass's who, a history row — that says every one of `must` and
 * none of `mustNot`: one sentence of its text (its buttons left out, so a label never runs into a line), or one block
 * (li, tr, td, p, div, dd) holding all of `must` with no smaller such block inside it. A block or sentence that runs
 * two passes together cannot pass a `mustNot`. No regex here may carry the g flag.
 */
async function shows(page, id, must, mustNot = []) {
  const ok = (s) => must.every((re) => re.test(s)) && !mustNot.some((re) => re.test(s));
  const text = await textOutsideButtons(page, id);
  if (sentencesWith(text, ...must).some(ok)) return true;
  const blocks = await section(page, id).evaluate((el, srcs) => {
    const res = srcs.map(([s, f]) => new RegExp(s, f));
    const all = (t) => res.every((re) => re.test(t.replace(/\s+/g, ' ')));
    const found = [...el.querySelectorAll('li, tr, td, p, div, dd')].filter((c) => all(c.innerText || ''));
    return found.filter((c) => !found.some((d) => d !== c && c.contains(d))).map((c) => c.innerText);
  }, must.map((re) => [re.source, re.flags]));
  return blocks.map(squash).some(ok);
}
/** Wait until `shows` holds. */
async function untilShows(page, id, must, mustNot, message, timeout = 5000) {
  await expect.poll(() => shows(page, id, must, mustNot), { message: `${message} (${must.join(' & ')}${mustNot.length ? ` and not ${mustNot.join(', ')}` : ''})`, timeout }).toBe(true);
}
/** A section's text with its buttons left out (their labels are not lines), read in one synchronous pass. */
async function textOutsideButtons(page, id) {
  return squash(await section(page, id).evaluate((el) => {
    const bs = [...el.querySelectorAll('button')];
    const before = bs.map((b) => b.style.display);
    bs.forEach((b) => { b.style.display = 'none'; });
    try {
      return el.innerText;
    } finally {
      bs.forEach((b, i) => { b.style.display = before[i]; });
    }
  }));
}

/* Story 6's ideas (AC-1..AC-5; ADR 0006 D16–D19), matched by idea as above. D17 fixes "Lining up a pass…", "Stopping…". */
const WAITING = /\bwaiting\b/i;
const RUNNING_NOW = /\brunning\b/i;
const BEHIND_HEAVY = /\bheavy\b|\bscoring\b|\bdatabase work\b/i;
const BEHIND_PASS = /\bpass(?:es)? ahead\b|\bbehind (?:another|a|the|an earlier) pass\b|\banother pass\b[^.]*\b(?:ahead|first|before)\b/i;
const STOP_ASKED = /\bstop (?:was |has been )?(?:asked for|requested)\b|\basked to stop\b/i;
const LINING_UP = /\blining up\b/i;
const STOPPING = /\bstopping\b/i;
const START_WORD = /\bstart\w*\b|\blined up\b|\basked for\b/i;
const STOPPED_ON_REQUEST = /\bstopped on request\b/i;
const OWNER_WHO = [/\bowner\b/i, new RegExp(esc(F.OWNER_KEY))];
const ADMIN_WHO = [/\badmin\b/i, new RegExp(esc(F.ADMIN_KEY))];
const SCHEDULE_WHO = /\bschedul\w*\b/i;
const CONFIRMATION_WHO = /\bconfirmation\b/i;
const LOCAL_WHO = /\blocal\b/i;
const OTHER_WHO = /\banother way\b/i;
const START_NOT_RECORDED = /\bstart\w*\b[^.]*\bnot (?:been )?recorded\b|\bnot recorded\b[^.]*\bstart\w*\b/i;
const NO_ACTION_RECORDED = /\bno (?:actions?|starts?|stops?)\b[^.]*\brecorded\b|\bnothing (?:has been |was )?recorded\b|\bno actions? (?:has|have) been recorded\b/i;
const CANNOT_TELL = /\b(?:cannot|can't|could not|couldn't|unable to)\b[^.]*\btell\b[^.]*\bwaiting\b|\bwhether\b[^.]*\bwaiting\b[^.]*\b(?:unknown|not known)\b|\b(?:unknown|not known)\b[^.]*\bwhether\b[^.]*\bwaiting\b/i;
const NOTHING_WAITING = /\b(?:nothing|no pass(?:es)?|none)\b[^.]*\b(?:is |are )?(?:waiting|busy|queued|in line)\b/i;
const GAVE_UP_WAITING = /\b(?:gave|given) up\b[^.]*\bwait\w*\b|\bwait\w*\b[^.]*\b(?:gave|given) up\b/i;
const NEVER_BEGAN = /\bnever (?:began|begun|started|got to run)\b|\bdid not (?:begin|start) running\b/i;
const ALREADY_BUSY = /\balready\b[^.]*\b(?:waiting|running|busy)\b|\b(?:waiting|running|busy)\b[^.]*\balready\b/i;
const NOTHING_LINED_UP = /\bnothing (?:new )?(?:was |has been |is )?lined up\b|\bno (?:new )?pass (?:was |has been )?lined up\b|\bnot lined up\b|\bdid not line up\b|\bnothing new\b/i;
const QUEUE_DOWN = /\bqueue\b[^.]*\b(?:unavailable|not available|down|not ready|unreachable|off)\b|\bunavailable\b[^.]*\bqueue\b/i;
const NOTHING_STARTED = /\bnothing (?:was |has been )?(?:started|lined up|changed)\b|\bno pass (?:was |has been )?(?:started|lined up)\b|\bstarted nothing\b|\bnothing new\b/i;
const NOT_RECORDABLE = /\b(?:could not|couldn't|cannot|can't)\b[^.]*\brecord\w*\b|\brecord\b[^.]*\b(?:unavailable|could not be (?:written|read))\b/i;
const FAILED_IDEA = /\b(?:could not|couldn't|failed|did not|didn't|was not|wasn't)\b/i;
const NEXT_PASS_TAKES_UP = (text) => sentencesWith(text, /\bnext pass\b/i, /\bstart checks?\b/i);
const TAKEN_OUT = /\bout of (?:the )?(?:line|queue)\b|\bremoved from the (?:line|queue)\b/i;
const BEFORE_RUNNING = /\bbefore it (?:begins|starts|has begun|has started) running\b|\bnever (?:begins|starts) running\b|\bbefore it (?:begins|starts|runs)\b/i;
const WRITES_NOTHING = /\bwrites nothing\b|\bnothing (?:is |gets )?written\b|\bwrites? no\b|\bwill not write\b|\bdoes not write\b/i;
const NO_SCHEDULE_CHANGE = /\bno schedul\w* entr\w*\b[^.]*\bchang\w*\b|\bschedul\w* entr\w*\b[^.]*\b(?:not|never|unchanged|stays?|stay)\b|\b(?:does not|doesn't|never|not) chang\w*\b[^.]*\bschedul\w*\b|\bschedul\w*\b[^.]*\bunchanged\b/i;
const SAFE_POINT = /\bsafe point\b/i;
const SECONDS = /\bseconds\b/i;
const MINUTES_WHEN_SLOW = (text) => sentencesWith(text, /\bminutes\b/i, /\bslow\b/i);
const TIMEOUT_30 = (text) => sentencesWith(text, /\b30[- ]?minute\b|\b30 min\w*\b|\bthirty[- ]minute\b|\bhalf an hour\b/i, /\btime-?\s?out\b|\btimes out\b/i);
const WROTE_STANDS = /\b(?:wrote|written)\b[^.]*\b(?:stands?|kept|stays?|remains?)\b/i;
const NEXT_PASS_FINISHES = /\bnext pass\b[^.]*\b(?:finish\w*|complet\w*|does the rest|picks? up|catch\w* up)\b/i;
const USED_UP = /\bused up\b|\buses? (?:it |the confirmation |the owner's confirmation )?up\b|\bspen[dt]s?\b/i;
const CONFIRM_AGAIN = /\bconfirm\w*\b[^.]*\bagain\b|\bagain\b[^.]*\bconfirm\w*\b/i;
const LATER_HOLDS = /\b(?:later|next|another) pass\b[^.]*\bhold\w*\b|\bhold\w*\b[^.]*\bagain\b/i;
const STAYS_PENDING = /\b(?:stays?|remains?|kept|left|still)\b[^.]*\bpending\b|\bpending\b[^.]*\bnext pass\b/i;
const confirmationWarning = (text) => sentencesWith(text, USED_UP).filter((s) => /\bconfirm\w*\b/i.test(s));
const STALE_PROMPT = /\bout of date\b|\b(?:has|had|have) changed\b|\bchanged since\b|\bsince the prompt\b|\bno longer\b|\b(?:began|begun|started) running\b/i;
const NOTHING_CHANGED = /\bnothing (?:was |has )?(?:changed|stopped)\b|\bchanged nothing\b|\bnot stopped\b|\bno pass was stopped\b/i;
const NOTHING_TO_STOP = /\bnothing (?:left )?to stop\b|\bno pass (?:left )?to stop\b|\balready (?:has|had) a stop\b/i;
const NOT_REACHABLE = (text) => sentencesWith(text, /\bstarting\b/i, /\bprocess\b/i).length > 0 && /\bpress Stop again\b/i.test(text);
const TOO_LATE = /\btoo late\b|\bended (?:first|before)\b/i;
const ENDED_FIRST = /\bended first\b|\bended before\b|\btoo late\b/i;
const RECORD_FAILED = /\brecord\b[^.]*(?:(?:could not|couldn't|cannot|can't) be read|\bunreadable\b|\bnot readable\b)/i;

/* ── Story 7: Confirm, its prompt, who confirmed, the overdue line and focus (ADR 0007 D9–D16) ─────────────────── */

const CONFIRM_POST = `POST ${F.ROUTES.confirm}`;
/** Every POST the panel may send, each only when its control is pressed (stories 5–7; ADR 0007 § Seams "Request pins"). */
const ALLOWED_POSTS = [SWITCH_POST, RUN_POST, STOP_POST, CONFIRM_POST];
/** D9 and D10 fix the labels: "Confirm held removals", the prompt's "Confirm the removals" and "Cancel", "Confirming…". */
const CONFIRM_LABEL = 'Confirm held removals';
const CONFIRM_PROMPT_LABEL = 'Confirm the removals';
const CONFIRMING = /^\s*Confirming(?:…|\.\.\.)\s*$/;
/**
 * The names a button may carry and still be named for confirming (story 7 § Test tasks "The no-Confirm pins"): the
 * held section's Confirm (the owner's, enabled; an admin's, disabled), its prompt's confirm, and that button while
 * under way (D10 "Confirming…").
 */
const CONFIRM_NAMES_ALLOWED = [/^Confirm held removals$/, /^Confirm the removals$/, /^Confirming(?:…|\.\.\.)$/];
/** The buttons whose name matches /confirm/i: each { name, inHeld }, read in the page. */
async function confirmNamedButtons(page) {
  return page.getByRole('button', { name: /confirm/i }).evaluateAll((bs) => bs.map((b) => ({
    name: (b.getAttribute('aria-label') || b.innerText || b.textContent || '').replace(/\s+/g, ' ').trim(),
    inHeld: !!b.closest('[data-testid="tp-held"]'),
  })));
}
/** The buttons named for confirming that the pins refuse: any name but the allowed ones, and any allowed one outside tp-held. */
async function refusedConfirmButtons(page) {
  return (await confirmNamedButtons(page))
    .filter((b) => !b.inHeld || !CONFIRM_NAMES_ALLOWED.some((re) => re.test(b.name)))
    .map((b) => `${b.name}${b.inHeld ? '' : ' (outside the held section)'}`);
}
const confirmButton = (page) => section(page, 'tp-held').getByRole('button', { name: CONFIRM_LABEL, exact: true });
const heldCancel = (page) => section(page, 'tp-held').getByRole('button', { name: 'Cancel', exact: true });
/** A button in tp-held that itself carries aria-busy="true" (D10: the prompt's confirm while under way). */
const heldBusyButtons = (page) => section(page, 'tp-held').locator('button[aria-busy="true"]');
const heldHeading = (page, name) => section(page, 'tp-held').getByRole('heading', { name, exact: true });
/**
 * The Confirm prompt (ADR 0007 D10, the ADR 0005 D13 pattern): the nearest element around its "Cancel" that also holds
 * a "Confirm the removals" button and a heading — an inline confirmation inside tp-held.
 */
const CONFIRM_PROMPT_XPATH = 'xpath=.//button[normalize-space(.)="Cancel"]/ancestor::*[.//button[normalize-space(.)="Confirm the removals"]]'
  + '[.//h1 or .//h2 or .//h3 or .//h4 or .//h5 or .//h6 or .//*[@role="heading"]][1]';
/** An element's text as the viewer reads it, its buttons left out, in one synchronous pass. */
async function textLeavingOutButtons(locator) {
  return squash(await locator.evaluate((el) => {
    const bs = [...el.querySelectorAll('button')];
    const before = bs.map((b) => b.style.display);
    bs.forEach((b) => { b.style.display = 'none'; });
    try {
      return el.innerText;
    } finally {
      bs.forEach((b, i) => { b.style.display = before[i]; });
    }
  }));
}

/** Press "Confirm held removals" and return the prompt it opens: { prompt, cancel, confirm, heading, text() }. */
async function openConfirmPrompt(page) {
  const b = confirmButton(page);
  await expect(b, `the held section shows "${CONFIRM_LABEL}" to the owner (story 7 AC-1; ADR 0007 D9) — not implemented yet if missing`).toBeVisible({ timeout: 5000 });
  await expect(b, `"${CONFIRM_LABEL}" is enabled for the owner`).toBeEnabled();
  await b.click();
  const cancel = heldCancel(page);
  await expect(cancel, `pressing "${CONFIRM_LABEL}" opens a prompt inside the held section, with a "Cancel" button (AC-2 "A prompt comes first"; D10)`).toBeVisible({ timeout: 5000 });
  const prompt = section(page, 'tp-held').locator(CONFIRM_PROMPT_XPATH).first();
  await expect(prompt, `the prompt is one element holding its heading, its text, and its "${CONFIRM_PROMPT_LABEL}" and "Cancel" buttons (D10: settings-group, h4)`).toHaveCount(1);
  expect(await prompt.getAttribute('data-testid'), 'the prompt is its own element inside tp-held, not the whole section (D10: an inline prompt)').not.toBe('tp-held');
  const heading = squash(await prompt.locator('h1, h2, h3, h4, h5, h6, [role="heading"]').first().innerText());
  return {
    prompt,
    cancel,
    heading,
    confirm: prompt.getByRole('button', { name: CONFIRM_PROMPT_LABEL, exact: true }),
    /** The prompt's text with its buttons left out, so "Confirm the removals" is never read as a line. */
    text: async () => textLeavingOutButtons(prompt),
  };
}

/**
 * Where keyboard focus is (AC-6): the page itself (`body`), or an element — its tag and text, the panel section around
 * it, whether it is a button (and disabled), a heading, and that section's own heading (its first one).
 */
async function focusAt(page) {
  return page.evaluate((ids) => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return { body: true, text: '' };
    const sec = el.closest(ids.map((id) => `[data-testid="${id}"]`).join(','));
    const heading = /^H[1-6]$/.test(el.tagName) || el.getAttribute('role') === 'heading';
    const first = sec ? sec.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]') : null;
    return {
      body: false,
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(),
      section: sec ? sec.getAttribute('data-testid') : null,
      button: el.tagName === 'BUTTON',
      disabled: !!el.disabled,
      heading,
      sectionHeading: !!first && first === el,
    };
  }, SECTIONS);
}
const focusSummary = (f) => (f.body
  ? 'document.body (the page itself)'
  : `<${f.tag}>${f.button ? ' button' : ''}${f.disabled ? ' (disabled)' : ''}${f.heading ? ' heading' : ''} in ${f.section || 'no panel section'}: "${f.text.slice(0, 90)}"`);
/** The controls that send at a keypress: focus never lands on them (AC-6 "Never lost"; D15). */
const SENDS_AT_A_KEYPRESS = [/^Turn on$/, /^Run a pass now$/];
function expectNotLost(f, what) {
  expect(f.body, `${what}: focus never falls to the page itself (AC-6 "Never lost"; ADR 0007 D15) — it is on ${focusSummary(f)}`).toBe(false);
  expect(f.button && SENDS_AT_A_KEYPRESS.some((re) => re.test(f.text)), `${what}: focus never lands on "Turn on" or "Run a pass now", which send at a keypress (AC-6; D15) — it is on ${focusSummary(f)}`).toBe(false);
}
/** Wait until focus satisfies `ok`, then check it is not lost. The poll reports where focus is when it fails. */
async function untilFocus(page, ok, what, timeout = 10000) {
  await expect.poll(async () => { const f = await focusAt(page); return ok(f) ? 'there' : focusSummary(f); }, { message: what, timeout }).toBe('there');
  expectNotLost(await focusAt(page), what);
}
/** Focus on the line that says what happened, in section `id`: no button, no heading, its text matching `re` (D15). */
const onOutcomeLine = (id, re) => (f) => !f.body && f.section === id && !f.button && !f.heading && re.test(f.text);
/** Focus on section `id`'s own heading (D15: "else the section's heading"). */
const onSectionHeading = (id) => (f) => !f.body && f.section === id && f.sectionHeading;
/** Focus on a heading in section `id` whose text is `text` (D15: a prompt whose send starts focuses its own h4). */
const onHeadingNamed = (id, text) => (f) => !f.body && f.section === id && f.heading && f.text === text;

/* Story 7's ideas (AC-1..AC-7; ADR 0007 D9–D16), matched by idea as above; each is checked absent where it must not show. */
const ONLY_OWNER = /\bonly the owner\b[^.]*\bconfirm\w*\b/i;
const TAKES_UP_ANY = /\b(?:takes?|took|taken|taking|will take)\b[^.]*\bup\b/i;
/** The sentences that say a pass is lined up now (a negated one, or one that cannot tell, claims nothing). */
const linesUpNow = (text) => sentencesWith(text, /\blin(?:es|ing) up\b|\blined up\b/i, /\bnow\b/i)
  .filter((s) => !NEGATED.test(s) && !/\b(?:cannot|can't|could not|couldn't|whether)\b/i.test(s));
/** The sentences that claim a pass was lined up (a negated one, "no pass was lined up", claims nothing). */
const linedUpClaimsOf = (text) => sentencesWith(text, /\blined up\b/i).filter((s) => !NEGATED.test(s));
const ALREADY_WAITING = /\balready\b[^.]*\bwaiting\b|\bwaiting\b[^.]*\balready\b/i;
const takesThisUp = (text) => sentencesWith(text, /\b(?:takes?|will take)\b/i, /\bconfirmation\b/i, /\bup\b/i);
const CANNOT_TELL_LINED_UP = /\b(?:cannot|can't|could not|couldn't|unable to)\b[^.]*\btell\b[^.]*\blined up\b/i;
const ANSWER_WILL_SAY = /\banswer\b[^.]*\b(?:says?|tells?|will say|will tell)\b[^.]*\bhappen\w*\b/i;
const onceLines = (text) => sentencesWith(text, /\bonce\b/i, /\b(?:held list|list|removals?)\b/i);
const lapseLines = (text) => sentencesWith(text, /\b24 hours\b|\b24 h\b|\b24-hour\b|\btwenty-four hours\b/i, /\blaps\w*\b|\bexpir\w*\b/i);
const NO_UNDO = /\b(?:cannot|can't|can not|could not)\b[^.]*\bundone\b|\bnot be undone\b|\bno undo\b|\birreversible\b/i;
const comesBackLines = (text) => sentencesWith(text, /\b(?:comes?|came) back\b|\badds? (?:it |them )?back\b|\brestor\w*\b/i, /\brelay\b/i);
const WHILE_PATH_ON = /\breal-time path\b[^.]*\b(?:while|when|if|as long as) (?:it|the path) is on\b|\b(?:while|when|if) the real-time path is on\b/i;
const LATER_PASS = /\b(?:later|next) pass\b/i;
const replacesLines = (text) => sentencesWith(text, /\breplac\w*\b/i, /\b(?:earlier|previous|existing|other|older)\b/i);
const BEHIND_STOPPING = /\bbehind\b[^.]*\bstopping\b/i;
const JUST_BEGUN = /\b(?:just )?(?:begun|began|beginning|started|starting)\b/i;
const NOTHING_CONFIRMED = /\bnothing (?:was |has been )?confirmed\b|\b(?:was|were|is|has) not (?:been )?confirmed\b|\bnot confirmed\b|\bno confirmation was made\b/i;
const ALREADY_PENDING = /\balready pending\b|\bis already\b[^.]*\bpending\b/i;
const WITHDRAWN = /\bwithdrawn\b|\bnothing (?:was |has )?(?:changed|confirmed)\b|\bchanged nothing\b/i;
const PASS_STARTED_MEANWHILE = /\bpass\b[^.]*\b(?:start\w*|began|begun)\b/i;
const CANNOT_TELL_STANDS = /\b(?:cannot|can't|could not|couldn't)\b[^.]*\btell\b[^.]*\b(?:confirmation|stands?|stood)\b|\bwhether\b[^.]*\bconfirmation\b[^.]*\bstands?\b/i;
const NEXT_READ = /\bnext read\b/i;
const RUN_NAMED = /\bRun a pass now\b/i;
const NEXT_SCHEDULED = /\bnext scheduled pass\b|\bscheduled pass\b|\bthe schedule\b/i;
const WITHIN_24H = /\b24 hours\b|\b24 h\b|\b24-hour\b/i;
const NO_PASS_CARRIES = /\bno pass\b[^.]*\bcarr(?:y|ies)\b[^.]*\bout\b|\b(?:will not|won't|does not|doesn't|never)\b[^.]*\bcarr(?:y|ied)\b[^.]*\bout\b/i;
const CONFIRMING_AGAIN_REPLACES = /\bconfirm\w*\b[^.]*\bagain\b[^.]*\breplac\w*\b|\breplac\w*\b[^.]*\bconfirm\w*\b[^.]*\bagain\b/i;
const EXPIRY_UNREADABLE = /\bexpir\w*\b[^.]*(?:(?:cannot|can't|could not|couldn't) be read|\bunreadable\b|\bnot readable\b)/i;
const USED_IT_UP = /\bused (?:it |the confirmation |the owner's confirmation |its confirmation |that confirmation )?up\b|\bused up\b|\bspent\b/i;
const TOOK_UP_CONFIRMATION = /\b(?:took|takes|taken) up\b[^.]*\bconfirmation\b|\b(?:took|takes|taken)\b[^.]*\bconfirmation\b[^.]*\bup\b/i;
const WHEN_NOT_RECORDED = /\bwhen not recorded\b|\b(?:time|when)\b[^.]*\bnot recorded\b/i;
const DID_NOT_HONOUR = /\b(?:did not|didn't|does not|not) honou?r\b/i;
const CONFIRMED_WORD = /\bconfirmed\b/i;
const refusedAsOwner = (text) => sentencesWith(text, SIGN_IN_AGAIN, /\bowner\b/i);
const OVERDUE_WORD = /\boverdue\b/i;
const OVERDUE_CANNOT_TELL = /\b(?:cannot|can't|could not|couldn't|unable to)\b[^.]*\btell\b[^.]*\boverdue\b/i;
const OVERDUE_CHECKING = /\boverdue\b[^.]*\b(?:still )?being checked\b|\b(?:still )?(?:checking|being checked)\b[^.]*\boverdue\b/i;
/** The overdue claims of a text: sentences saying "overdue" that are not "cannot tell" or "still being checked". */
const overdueClaims = (text) => sentencesWith(text, OVERDUE_WORD).filter((s) => !/\b(?:cannot|can't|could not|couldn't|unable to|whether)\b/i.test(s));
const overdueWaitingLines = (text) => sentencesWith(text, /\bwaiting\b/i).filter((s) => /\b(?:clears?|cleared|goes away|lifts?)\b|\bbegins? running\b/i.test(s));
const OPENING_CONFIRMS = /\bconfirm\w*\b[^.]*\bheld removals\b/i;

/* ── B0 ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

async function bundleContains(request, needles) {
  const index = await request.get('/');
  if (!index.ok()) return { missing: needles, why: `the app shell answered HTTP ${index.status()}` };
  const html = await index.text();
  const queue = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
  if (queue.length === 0) return { missing: needles, why: 'no built JS is referenced from the app shell — is this a built UI?' };
  const left = new Set(needles);
  const seen = new Set();
  while (queue.length && seen.size < 400 && left.size) {
    const asset = queue.shift();
    if (seen.has(asset)) continue;
    seen.add(asset);
    const res = await request.get(asset);
    if (!res.ok()) continue;
    const js = await res.text();
    for (const n of [...left]) if (js.includes(n)) left.delete(n);
    for (const m of js.matchAll(/["'(](\.{0,2}\/?(?:assets\/)?[\w.-]+\.js)["')]/g)) {
      const ref = m[1];
      const resolved = ref.startsWith('assets/') ? `/${ref}` : new URL(ref, new URL(asset, 'http://origin')).pathname;
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }
  return { missing: [...left], why: `searched ${seen.size} JS chunks` };
}

/* ══ The panel ═══════════════════════════════════════════════════════════════════════════════════════════════════ */

test.describe('The tagging pipeline panel (tagging-edges #4, ADR 0004)', () => {
  // Every printed time is known: UTC, a 24-hour locale, and a page clock that starts at the fixtures' NOW and flows.
  test.use({ timezoneId: 'UTC', locale: 'en-GB' });

  test.beforeAll(async () => { await loadView(); });

  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip(true, 'Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    if (RECORDING) test.skip(true, 'TP_RECORD_BASELINE=1: only the AC-6 baseline is recorded');
    await page.clock.install({ time: new Date(F.NOW) });
  });

  test('B0: the served origin runs a build that contains the panel — its sub-tab label and its section hooks [prerequisite; ADR 0004 § Seams/T9]', async ({ request, baseURL }) => {
    const { missing, why } = await bundleContains(request, [TAB, 'tp-drift', 'tp-held']);
    expect(missing, `the bundle served by ${baseURL} does not contain ${JSON.stringify(missing)} (${why}). Rebuild the UI, or the panel is not built yet — B1–B40 say so directly.`).toEqual([]);
  });

  /* ── AC-1: where it is and who sees it ──────────────────────────────────────────────────────────────────────── */

  test('B1: a signed-in owner sees "Tagging pipeline" directly after Streaming ETL, the other five sub-tabs unchanged, and it opens the panel with its five sections ready [AC-1, AC-6; ADR 0004 § UI/T9]', async ({ page }) => {
    await mock(page);
    await openRelays(page);
    const labels = (await relayTabBar(page).getByRole('button').allInnerTexts()).map(squash);
    const expected = [...EXISTING_TABS.slice(0, 4), TAB, EXISTING_TABS[4]];
    expect(labels, `the Relays tab bar reads ${JSON.stringify(expected)} — the new sub-tab directly after ⚡ Streaming ETL, the other five as before`).toEqual(expected);
    await openPanel(page);
    for (const id of SECTIONS) {
      await expect(section(page, id), `${id} is ready`).toHaveAttribute('data-state', 'ready', { timeout: 10000 });
      expect((await textOf(page, id)).length, `${id} is never blank`).toBeGreaterThan(0);
    }
  });

  test('B2: a signed-in admin sees the sub-tab and opens the panel [AC-1]', async ({ page }) => {
    await mock(page, { who: 'admin' });
    await openAndSettle(page);
    await expect(section(page, 'tp-drift')).toHaveAttribute('data-state', 'ready');
  });

  test('B3: a signed-in customer and a signed-out visitor see no panel and no sub-tab, as for the rest of Settings [AC-1]', async ({ page }) => {
    const m = await mock(page, { who: 'customer' });
    for (const who of ['customer', 'visitor']) {
      m.set({ who });
      await page.goto('/tapestry/settings/relays');
      await expect(page.getByText(/Settings are only available to the owner/i), `${who}: Settings' gate shows`).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('button', { name: TAB, exact: true }), `${who}: no "${TAB}" sub-tab`).toHaveCount(0);
      for (const id of SECTIONS) await expect(section(page, id), `${who}: no ${id}`).toHaveCount(0);
    }
    expect(requestsTo(m.log, F.ROUTES.drift), 'nobody but an owner or admin asks for a count').toEqual([]);
  });

  /* ── AC-5: loading ──────────────────────────────────────────────────────────────────────────────────────────── */

  test('B4: while its read is in flight, each section says what it is loading — never a blank area [AC-5; ADR 0004 § UI "Loading"]', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const later = (body) => async () => { await gate; return body; };
    await mock(page, {
      status: later(F.STATUS.HELD_PENDING),
      realtime: later(F.REALTIME.ON_LIVE),
      schedule: later(F.SCHEDULE.ONE),
      drift: later(F.DRIFT.EXAMPLE),
    });
    try {
      await openPanel(page);
      const names = { 'tp-pass': /pass|report/i, 'tp-path': /path|real-time/i, 'tp-schedule': /schedul/i, 'tp-drift': /count|drift|relay|graph/i };
      for (const [id, what] of Object.entries(names)) {
        await expect(section(page, id), `${id} is loading`).toHaveAttribute('data-state', 'loading');
        const text = await textOf(page, id);
        expect(text, `${id} says it is loading`).toMatch(LOADING);
        expect(text, `${id} names what it loads`).toMatch(what);
      }
      expect((await textOf(page, 'tp-held')).length, 'tp-held is never blank while the report loads').toBeGreaterThan(0);
    } finally {
      release();
    }
    for (const id of SECTIONS) await settled(page, id);
    await expect(section(page, 'tp-pass'), 'the pass section is ready once its read answers').toHaveAttribute('data-state', 'ready');
  });

  /* ── AC-2: the pass ─────────────────────────────────────────────────────────────────────────────────────────── */

  test('B5: a running pass whose stored record reads failed/stopped is shown as running, with no result, and the held list waits for its end [AC-2 "Running now"; ADR 0004 § UI passView/T1]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.RUNNING });
    await openAndSettle(page);
    const pass = await textOf(page, 'tp-pass');
    expect(pass, 'the pass is shown as running').toMatch(/running/i);
    expect(pass, 'the stored pessimistic reason is never shown as its result').not.toContain(F.STOPPED_REASON);
    expect(pass, 'the stored outcome "failed" is not shown as its result (its explanation)').not.toContain(explanation('passOutcome', 'failed'));
    expect(pass, 'the stored reason "stopped" is not shown as its result (its explanation)').not.toContain(explanation('passReason', 'stopped'));
    await expect(section(page, 'tp-pass')).toHaveAttribute('data-state', 'ready');
    await expect(section(page, 'tp-held'), 'nothing is held while the pass runs').toHaveAttribute('data-state', 'empty');
    expect(await textOf(page, 'tp-held'), 'the held section says the list returns when the pass ends').toMatch(RUNNING_WAITS);
    expect(requestsTo(m.log, F.ROUTES.held), 'the held list is not read while a pass runs').toEqual([]);
  });

  test('B6: a running first pass (nothing in the report before it) is running, not "no pass yet" [AC-2; T1 empty]', async ({ page }) => {
    await mock(page, { status: F.STATUS.RUNNING_FIRST });
    await openAndSettle(page);
    await expect(section(page, 'tp-pass')).toHaveAttribute('data-state', 'ready');
    const pass = await textOf(page, 'tp-pass');
    expect(pass).toMatch(/running/i);
    expect(pass, 'not the no-pass-yet text').not.toMatch(NO_PASS_YET);
  });

  test('B7: the latest pass shows its outcome and reason explained, when it ran and how long it took, what it did, and the nine earlier passes newest first [AC-2 "The latest pass"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.LATEST_AND_NINE });
    await openAndSettle(page);
    const pass = await textOf(page, 'tp-pass');
    expect(pass, 'its outcome code').toMatch(codeRe('done'));
    expect(pass, 'its outcome explained').toContain(explanation('passOutcome', 'done'));
    expect(pass, 'its reason explained').toContain(explanation('passReason', 'done'));
    expect(pass, 'a known outcome and reason are explained, not "not recognised"').not.toContain(NOT_RECOGNISED);
    const D = F.LATEST_DONE;
    expect(pass, `when it started (${D.startedAt})`).toMatch(timeRe(D.startedAt));
    expect(pass, `when it ended (${D.endedAt})`).toMatch(timeRe(D.endedAt));
    expect(pass, 'how long it took (83 s)').toMatch(/\b83\s?s(?:ec\w*)?\b|\b1\s?min\w*,?\s?23\s?s|\b1m\s?23s\b|\b1:23\b|\b83,?000\s?ms\b/i);
    const L = F.LATEST_FIGURES;
    for (const [what, n] of [['taggings read', L.taggingsRead], ['added', L.added], ['changed', L.changed], ['removed', L.removed],
      ['unchanged', L.unchanged], ['refused taggings', L.refused], ['left in place', L.leftInPlace], ['people added', L.peopleAdded]]) {
      expect(pass, `the latest pass's ${what} (${n})`).toMatch(numRe(n));
    }
    // Each earlier pass is found by what it did: its own "added" figure (200 + i, newest first), with its time.
    let last = -1;
    for (const [i, rec] of F.EARLIER_NINE.entries()) {
      const n = rec.relationships.added;
      const m = numRe(n).exec(pass);
      expect(m, `earlier pass ${i + 1} of 9 is listed with what it did (added ${n})`).not.toBeNull();
      expect(m.index, `earlier pass ${i + 1} comes after the one newer than it (newest first)`).toBeGreaterThan(last);
      last = m.index;
      expect(pass, `earlier pass ${i + 1} of 9 shows its time (${rec.startedAt})`).toMatch(new RegExp(`${timeRe(rec.startedAt).source}|${timeRe(rec.endedAt).source}`, 'i'));
    }
    expect((pass.match(new RegExp(codeRe('done').source, 'g')) || []).length, 'each of the ten passes shows its outcome').toBeGreaterThanOrEqual(10);
  });

  test('B8: an outcome and reason code the panel does not know are shown as they are, with "not recognised" beside them [AC-2; story "Explanations"; T6/T9]', async ({ page }) => {
    await mock(page, { status: F.STATUS.UNKNOWN_OUTCOME });
    await openAndSettle(page);
    const pass = await textOf(page, 'tp-pass');
    expect(pass, 'the unknown outcome as it is').toMatch(codeRe(F.UNKNOWN_OUTCOME_RECORD.outcome));
    expect(pass, 'the unknown reason code as it is').toMatch(codeRe(F.UNKNOWN_OUTCOME_RECORD.reasonCode));
    expect(pass).toContain(NOT_RECOGNISED);
  });

  // Revised for story 6 (ADR 0006 § Seams "Request pins": "B9 follows the new empty-state line"; D19): the line on how
  // a pass starts names "Run a pass now" beside the Scheduled Tasks entry and the Task Explorer. It is read with the
  // section's buttons left out, so the Run control's own label does not count as the line.
  test('B9: with no pass in the report, the panel says no pass has run yet, and its line on how a pass starts names "Run a pass now" beside an enabled Scheduled Tasks entry and the Task Explorer [AC-2 "No pass yet"; story 6 AC-6 "the pass section\'s line on how a pass starts, which names Run", Test tasks "B9\'s pin … follows the new line"; ADR 0006 D19]', async ({ page }) => {
    await mock(page, { status: F.STATUS.NO_PASS });
    await openAndSettle(page);
    await expect(section(page, 'tp-pass')).toHaveAttribute('data-state', 'empty');
    const lines = await textOutsideButtons(page, 'tp-pass');
    expect(lines, 'no pass has run yet').toMatch(NO_PASS_YET);
    expect(lines, 'an enabled Scheduled Tasks entry').toMatch(/Scheduled Tasks/i);
    expect(lines, 'or the Task Explorer').toMatch(/Task Explorer/i);
    expect(lines, `the line on how a pass starts names "${RUN_LABEL}" (ADR 0006 D19: the empty state keeps "No pass has run yet" and names "Run a pass now" beside the Scheduled Tasks entry and the Task Explorer; the button's own label is not counted) — not implemented yet`).toMatch(/\bRun a pass now\b/i);
    // Revised for story 7 (story § Test tasks "The no-Confirm pins"; ADR 0007 D9): with no pass on record nothing is
    // held, so no Confirm, and no other button is named for confirming.
    await expect(section(page, 'tp-held'), 'nothing is held').toHaveAttribute('data-state', 'empty');
    await expect(confirmButton(page), `no pass on record: nothing is held, so no "${CONFIRM_LABEL}" (story 7 AC-1 "It is not shown when the latest pass held nothing")`).toHaveCount(0);
    expect(await refusedConfirmButtons(page), 'no other button is named for confirming: Confirm is on the panel, in the held section only (story 7; ADR 0007 § Seams "the no-Confirm pins")').toEqual([]);
  });

  // Revised for story 7 (story § Test tasks "The no-Confirm pins"; ADR 0007 § Seams "Revised pins"): Confirm is on the
  // panel now. With a confirmation of the latest held list pending the owner is offered none, and no other button is
  // named for confirming.
  test('B10: the held list pages to every held removal, the count matches the report, each shows why, a pending confirmation is said with its end, and while it is pending nothing offers to confirm [AC-2 "Held removals"; story 7 AC-1 "While a confirmation of the latest held list is pending … offers no Confirm"; ADR 0007 D9]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.HELD_PENDING });
    await openAndSettle(page);
    const held = section(page, 'tp-held');
    await expect(held).toHaveAttribute('data-state', 'ready');
    const seen = new Set();
    const reasons = new Set();
    let text = await textOf(page, 'tp-held');
    expect(text, `the report's held total (${F.HELD_TOTAL})`).toMatch(numRe(F.HELD_TOTAL));
    expect(text, 'the owner\'s confirmation is pending').toMatch(PENDING);
    const expiresAt = F.STATUS.HELD_PENDING.confirmationPending.expiresAt;
    expect(text, `and until when (${expiresAt})`).toMatch(timeRe(expiresAt));
    for (let i = 0; i < 10; i += 1) {
      text = await textOf(page, 'tp-held');
      for (const x of text.matchAll(/held-address-(\d{3})/g)) seen.add(x[1]);
      for (const r of ['not-on-relay', 'non-tagging']) if (codeRe(r).test(text)) reasons.add(r);
      const next = held.getByRole('button', { name: /^\s*Next\b/i });
      if ((await next.count()) === 0 || !(await next.isEnabled())) break;
      const before = [...text.matchAll(/held-address-(\d{3})/g)].map((x) => x[1]).join(',');
      await next.click();
      // The section may show a loading state between pages: wait for the next page's addresses, not just a change.
      await expect.poll(async () => {
        const now = [...(await textOf(page, 'tp-held')).matchAll(/held-address-(\d{3})/g)].map((x) => x[1]).join(',');
        return now !== '' && now !== before;
      }, { message: 'Next shows another page' }).toBe(true);
    }
    expect(seen.size, `every one of the ${F.HELD_TOTAL} held removals is reachable by paging`).toBe(F.HELD_TOTAL);
    expect([...reasons].sort(), 'each held removal shows why it was held').toEqual(['non-tagging', 'not-on-relay']);
    expect(requestsTo(m.log, F.ROUTES.held).every((l) => l.includes(`runId=${F.HELD_RECORD.runId}`)), 'the held list is read for the latest run id').toBe(true);
    await expect(confirmButton(page), `the owner's confirmation of the latest held list is pending: no "${CONFIRM_LABEL}" (Confirm is on the panel, story 7 AC-1; ADR 0007 D9 offer)`).toHaveCount(0);
    expect(await refusedConfirmButtons(page), 'and no other button is named for confirming: only the held section\'s Confirm and its prompt\'s may be (Confirm is on the panel, story 7; ADR 0006 D17\'s "No button name may match /confirm/i (B10)" as revised by ADR 0007 § Seams)').toEqual([]);
  });

  // Revised for story 7 (AC-7 "the held section's wording about the owner's confirmation, only where Confirm makes
  // today's wording untrue. For example, an expired confirmation no longer just waits for the next pass"; ADR 0007 D13:
  // "It stays until the next pass, which does not honour it" becomes "No pass will carry it out. The owner can confirm
  // this held list again."). EXPIRED_STAYS, story 4's idea, is no longer asked for.
  test('B11: an expired confirmation is shown as expired, not as pending: no pass will carry it out, and the owner can confirm this held list again [AC-2 "Confirmation"; ADR 0004 § UI passView; story 7 AC-1 "When the confirmation expires unused", AC-7; ADR 0007 D13]', async ({ page }) => {
    await mock(page, { status: F.STATUS.HELD_EXPIRED });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-held');
    expect(text).toMatch(EXPIRED);
    expect(text, 'no pass will carry it out (ADR 0007 D13) — not implemented yet: today it says it stays until the next pass').toMatch(NO_PASS_CARRIES);
    expect(text, 'and the owner can confirm this held list again (D13; story 7 AC-1)').toMatch(CONFIRM_AGAIN);
    expect(text, 'not shown as pending').not.toMatch(PENDING_STRICT);
  });

  test('B12: a confirmation that cannot be read is shown as unreadable, with its code [AC-2 "Confirmation"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.HELD_UNREADABLE });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-held');
    expect(text).toMatch(UNREADABLE);
    expect(text).toMatch(codeRe('EACCES'));
    expect(text, 'not shown as pending').not.toMatch(PENDING_STRICT);
  });

  test('B42: a failed pass shows its failure code with its explanation under where it failed (a write on a full disk, ENOSPC); a schema refusal because Neo4j cannot be reached shows ServiceUnavailable and names Neo4j, not only the Dashboard fix [AC-2 "The latest pass"; review round 1 Blocking 1, NB2; ADR 0004 T12]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.WRITE_FAILED });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-pass');
    const stage = explanation('failureStage', 'write');
    // A pass's own failure.code is explained under failureCode, never countCode (ADR 0004 T12).
    const enospc = explanation('failureCode', 'ENOSPC');
    expect(text, 'where it failed (the write stage, explained)').toContain(stage);
    // Not codeRe('ENOSPC') alone: passReason 'write' names ENOSPC in its own sentence ("If the code is ENOSPC, …").
    const shown = new RegExp(`${codeRe('ENOSPC').source}\\W{0,40}${esc(enospc)}`).exec(text);
    expect(shown, `the failure's code ENOSPC is shown beside its explanation, explain('failureCode', 'ENOSPC') ("${enospc}") — review Blocking 1/NB2, T12: "Where it failed" shows failure.code explained under failureCode`).not.toBeNull();
    expect(shown.index, 'the code is shown under where it failed').toBeGreaterThan(text.indexOf(stage));

    await reopenWith(page, m, { status: F.STATUS.SCHEMA_UNREACHABLE });
    text = await textOf(page, 'tp-pass');
    const unavailable = explanation('failureCode', 'ServiceUnavailable');
    expect(text, `the failure's code ServiceUnavailable is shown beside its explanation ("${unavailable}")`).toMatch(new RegExp(`${codeRe('ServiceUnavailable').source}\\W{0,40}${esc(unavailable)}`));
    // Apart from the code's own explanation, the refusal's reason must not send the owner only to the Dashboard's
    // constraints fix: a schema refusal is also Neo4j being down or refusing the password.
    const rest = text.split(unavailable).join(' ');
    expect(rest, 'the schema refusal\'s reason names Neo4j being down or unreachable as a cause (review Blocking 1: passReason.schema names only the Dashboard constraints fix)').toMatch(NEO4J_DOWN);
  });

  test('B49: a pass-minted failure code — plan-error, on a pass that failed at the plan stage — is shown under where it failed with its own failureCode sentence, explain(\'failureCode\', \'plan-error\'), and the pass section never reads "not recognised" [AC-2 "The latest pass", AC-5 "Explanations"; review round 1 Blocking 1; ADR 0004 T12]', async ({ page }) => {
    // The runner's plan failure (reconcileTaggingEdges.js:436): fail('plan', { stage: 'plan', code: 'plan-error', … }).
    const planFailed = F.passRecord({
      startedMinutesAgo: 9,
      suffix: 'b1a4b1a4',
      outcome: 'failed',
      reasonCode: 'plan',
      reason: 'planning failed',
      failure: { stage: 'plan', code: 'plan-error', message: 'a planning step threw' },
      phases: F.clone(F.LATEST_DONE.phases).slice(0, 3),
    });
    await mock(page, { status: F.statusBody({ latest: planFailed, previous: [F.LATEST_DONE] }) });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-pass');
    const stage = explanation('failureStage', 'plan');
    const own = explanation('failureCode', 'plan-error');
    expect(text, 'where it failed (the plan stage, explained)').toContain(stage);
    const shown = new RegExp(`${codeRe('plan-error').source}\\W{0,40}${esc(own)}`).exec(text);
    expect(shown, `the failure's code plan-error is shown beside its own sentence, explain('failureCode', 'plan-error') ("${own}") — T12: a pass mints its own codes, explained under failureCode`).not.toBeNull();
    expect(shown.index, 'the code is shown under where it failed').toBeGreaterThan(text.indexOf(stage));
    expect(text, 'a code the pass mints is never "not recognised" (T12; AC-5)').not.toContain(NOT_RECOGNISED);
  });

  test('B81: a failed pass shows its error details — failure.message and, for a relay read, failure.stderrTail, both redacted by the server — under "Where it failed", and no remedy beside them points at "the task log" or strfry-error.log, which hold none of a pass\'s error details [AC-2 "The latest pass"; story 5 Test tasks (R2-6, added by the Product Owner); story 4 review round 2 R2-6: passReason.error and the failureCode entries plan-error, error, spawn, process-error, exit, unparseable and not-an-event-line]', async ({ page }) => {
    test.setTimeout(150000);
    const relay = (code, suffix, message, stderrTail) => F.passRecord({
      startedMinutesAgo: 7,
      suffix,
      outcome: 'failed',
      reasonCode: 'read',
      reason: 'the relay read failed',
      failure: { stage: 'read', read: 'relay', code, message, ...(stderrTail ? { stderrTail } : {}) },
      phases: F.clone(F.LATEST_DONE.phases).slice(0, 2),
    });
    const CASES = [
      { what: 'a relay read whose strfry command exited with a failure code (exit)', record: F.RELAY_EXIT_RECORD },
      { what: 'a relay read whose output was not JSON (unparseable)', record: relay('unparseable', 'e8e8e8e8', 'strfry scan printed a line that is not JSON', 'strfry error: malformed record in <path>') },
      { what: 'a relay read that printed a line that is not an event (not-an-event-line)', record: relay('not-an-event-line', 'e9e9e9e9', 'strfry scan printed a line that is not an event') },
      { what: 'a relay read whose strfry command could not start (spawn)', record: relay('spawn', 'eaeaeaea', 'could not start strfry scan: ENOENT') },
      { what: 'a relay read whose strfry command could not run (process-error)', record: relay('process-error', 'ebebebeb', 'strfry scan could not be read: EPIPE', 'exit code 141') },
      {
        what: 'a planning fault (plan-error)',
        record: F.passRecord({ startedMinutesAgo: 9, suffix: 'ecececec', outcome: 'failed', reasonCode: 'plan', reason: 'planning failed', failure: { stage: 'plan', code: 'plan-error', message: 'a planning step threw: cannot read the tag address' }, phases: F.clone(F.LATEST_DONE.phases).slice(0, 3) }),
      },
      {
        what: 'a fault in the pass\'s own code (passReason error, failureCode error)',
        record: F.passRecord({ startedMinutesAgo: 9, suffix: 'edededed', outcome: 'failed', reasonCode: 'error', reason: 'an unexpected error ended the pass', failure: { stage: 'unexpected', code: 'error', message: 'Cannot read properties of undefined (reading \'relationships\')' }, phases: F.clone(F.LATEST_DONE.phases).slice(0, 4) }),
      },
    ];
    const m = await mock(page, { status: F.statusBody({ latest: CASES[0].record, previous: [F.LATEST_DONE] }) });
    for (const [i, c] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reopenWith(page, m, { status: F.statusBody({ latest: c.record, previous: [F.LATEST_DONE] }) });
      const text = await textOf(page, 'tp-pass');
      const stage = explanation('failureStage', c.record.failure.stage);
      expect(text, `${c.what}: where it failed`).toContain(stage);
      for (const field of ['message', 'stderrTail']) {
        const value = c.record.failure[field];
        if (!value) continue;
        const at = text.indexOf(value);
        expect(at, `${c.what}: failure.${field} ("${value}") is shown — review R2-6: a pass's error details are failure.message and, for a relay read, failure.stderrTail, already redacted on the public route`).toBeGreaterThanOrEqual(0);
        expect(at, `${c.what}: failure.${field} is shown under where it failed`).toBeGreaterThan(text.indexOf(stage));
      }
      expect(text, `${c.what}: no remedy points at "the task log" (deleted by launchChildTask.sh) or strfry-error.log (not where a pass's strfry stderr goes) — review R2-6`).not.toMatch(LOG_POINTERS);
    }
  });

  test('B44: a pass says it applied the owner\'s confirmed removals only when it applied some (confirmed.removalsApplied > 0): a confirmed run that failed before applying any does not claim it [AC-2 "The latest pass"; review round 1 NB5]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.CONFIRMED_APPLIED });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-pass');
    expect(appliedClaims(text).length, `a confirmed run that applied ${F.CONFIRMED_APPLIED_RECORD.confirmed.removalsApplied} removals says it applied the confirmed removals`).toBeGreaterThan(0);
    await reopenWith(page, m, { status: F.STATUS.CONFIRMED_FAILED });
    text = await textOf(page, 'tp-pass');
    expect(appliedClaims(text), 'a confirmed run that failed with confirmed.removalsApplied 0 (confirmation.honoured still true) does not say it applied the confirmed removals — review NB5: build the sentence from latest.confirmed').toEqual([]);
  });

  test('B80: a confirmed pass that never recorded its end (its pessimistic "stopped" record, kept only at its last save) words how many confirmed removals it applied as a lower bound — 60 "at least", and none never as a flat fact — while a pass that recorded its end states its figure exactly [AC-2 "The latest pass"; story 4 review round 2 R2-3 (a story 5 carry-forward): "word the figure as a lower bound in that case; add a browser case next to B44"]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.STOPPED_CONFIRMED });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-pass');
    let claims = removalClaims(text);
    expect(claims.length, 'it says how many of the confirmed removals it applied').toBeGreaterThan(0);
    expect(claims.some((s) => numRe(60).test(s)), 'with the figure its last save holds, 60').toBe(true);
    for (const s of claims) {
      expect(s, 'a pass that never recorded its end may have applied more after its last save: the figure is a lower bound — review R2-3 ("It applied N of the confirmed removals" can be false)').toMatch(LOWER_BOUND);
    }
    await reopenWith(page, m, { status: F.STATUS.STOPPED_CONFIRMED_NONE });
    text = await textOf(page, 'tp-pass');
    claims = removalClaims(text);
    expect(claims.length, 'it says what its last save holds of the confirmed removals').toBeGreaterThan(0);
    for (const s of claims) {
      expect(s, 'none applied by its last save is not "it applied none": it may have applied some after — review R2-3').toMatch(LOWER_BOUND);
    }
    await reopenWith(page, m, { status: F.STATUS.CONFIRMED_APPLIED });
    text = await textOf(page, 'tp-pass');
    claims = removalClaims(text).filter((s) => numRe(F.HELD_TOTAL).test(s));
    expect(claims.length, `a pass that recorded its end says it applied ${F.HELD_TOTAL} of the confirmed removals`).toBeGreaterThan(0);
    for (const s of claims) expect(s, 'a pass that recorded its end states its figure exactly, not as a lower bound').not.toMatch(LOWER_BOUND);
  });

  /* ── AC-2: the backstop schedule ─────────────────────────────────────────────────────────────────────────────── */

  test('B13: with no enabled entry and a disabled one, the schedule warns the path has no backstop, mentions the disabled entry, and its button opens Scheduled Tasks [AC-2 "None enabled"]', async ({ page }) => {
    await mock(page, { schedule: F.SCHEDULE.NONE_WITH_DISABLED });
    await openAndSettle(page);
    await expect(section(page, 'tp-schedule'), 'a warning is a ready state').toHaveAttribute('data-state', 'ready');
    const text = await textOf(page, 'tp-schedule');
    expect(text, 'no backstop').toMatch(NO_BACKSTOP);
    expect(text, 'the disabled entry is mentioned').toMatch(DISABLED_MENTION);
    await section(page, 'tp-schedule').getByRole('button', { name: /schedul/i }).first().click();
    await expect(page.getByText('Schedule any parameterized task'), 'the Scheduled Tasks sub-tab opens').toBeVisible({ timeout: 10000 });
  });

  test('B14: with no entry at all, the schedule warns of no backstop and mentions no disabled entry [AC-2 "None enabled"]', async ({ page }) => {
    await mock(page, { schedule: F.SCHEDULE.NONE });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-schedule');
    expect(text).toMatch(NO_BACKSTOP);
    expect(text, 'no disabled entry exists to mention').not.toMatch(DISABLED_MENTION);
    await expect(section(page, 'tp-schedule').getByRole('button', { name: /schedul/i }).first()).toBeVisible();
  });

  test('B15: one enabled entry shows its interval and next run with no warning, and the disabled one is mentioned but not counted [AC-2 "One"]', async ({ page }) => {
    await mock(page, { schedule: F.SCHEDULE.ONE });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-schedule');
    expect(text, 'its interval').toMatch(/\b6\s?(?:hours?|hrs?|h)\b/i);
    const next = F.SCHEDULE.ONE.entries[1].timer.nextRunAt;
    expect(text, `when it runs next (${next})`).toMatch(timeRe(next));
    expect(text, 'the disabled entry is mentioned').toMatch(DISABLED_MENTION);
    expect(text, 'no "no backstop" warning').not.toMatch(NO_BACKSTOP);
    expect(text, 'not "enabled but not scheduled"').not.toMatch(NOT_SCHEDULED);
    expect(text, 'not weaker than daily').not.toMatch(WEAKER_THAN_DAILY);
    expect(text, 'the disabled entry is not counted (no "2 entries" / "more than one")').not.toMatch(SEVERAL);
  });

  test('B16: one enabled entry with no next run warns that it is enabled but not scheduled [AC-2 "One"]', async ({ page }) => {
    await mock(page, { schedule: F.SCHEDULE.ONE_UNSCHEDULED });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-schedule');
    expect(text).toMatch(NOT_SCHEDULED);
    expect(text, 'an entry exists: not "no backstop"').not.toMatch(NO_BACKSTOP);
  });

  test('B17: one enabled entry running less often than daily warns that the backstop is weaker than daily — an interval and a weekly cron [AC-2 "One"; ADR 0004 § UI scheduleView]', async ({ page }) => {
    const m = await mock(page, { schedule: F.SCHEDULE.ONE_WEAKER_INTERVAL });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-schedule');
    expect(text, 'every 2 days').toMatch(WEAKER_THAN_DAILY);
    expect(text).toMatch(/\b2\s?(?:days?|d)\b/i);
    expect(text, 'an entry exists: not "no backstop"').not.toMatch(NO_BACKSTOP);
    await reopenWith(page, m, { schedule: F.SCHEDULE.ONE_WEAKER_CRON });
    text = await textOf(page, 'tp-schedule');
    expect(text, 'a weekly cron').toMatch(WEAKER_THAN_DAILY);
    expect(text, 'the cron is its interval text').toContain('0 3 * * 0');
    expect(text, 'an entry exists: not "no backstop"').not.toMatch(NO_BACKSTOP);
  });

  test('B18: more than one enabled entry warns, naming how many [AC-2 "More than one"]', async ({ page }) => {
    await mock(page, { schedule: F.SCHEDULE.SEVERAL });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-schedule');
    expect(text, 'how many: 2').toMatch(/\b(?:2|two)\b[^.]*\b(?:entries|enabled|schedules|backstops)\b|\b(?:entries|enabled|schedules)\b[^.]*\b(?:2|two)\b/i);
    expect(text, 'entries exist: not "no backstop"').not.toMatch(NO_BACKSTOP);
  });

  /* ── AC-3: the real-time path ────────────────────────────────────────────────────────────────────────────────── */

  test('B19: the path on and running shows its state explained, when it first started and last reflected a change, its counts, failed reads, database refusals, changes left to the next pass, gauges and last catch-up [AC-3]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.ON_LIVE });
    await openAndSettle(page);
    await expect(section(page, 'tp-path')).toHaveAttribute('data-state', 'ready');
    const text = await textOf(page, 'tp-path');
    expect(text, 'the state code').toMatch(codeRe('live'));
    expect(text, 'the state explained').toContain(explanation('pathState', 'live'));
    expect(text, 'a known state is explained').not.toContain(NOT_RECOGNISED);
    expect(noOnOff(text), 'on').toMatch(ON);
    expect(text, 'running').toMatch(/running/i);
    expect(text, 'not "not running"').not.toMatch(NOT_RUNNING_STRICT);
    const P = F.PATH_FIGURES;
    const fr = P.failedReads;
    for (const [what, n] of [['added', P.added], ['changed', P.changed], ['removed', P.removed], ['unchanged', P.unchanged],
      ['people added', P.peopleAdded], ['refused taggings', P.refused], ['failed relay reads', fr.relay], ['failed graph reads', fr.graph],
      ['failed element reads', fr.element], ['failed catch-up reads', fr.catchUp], ['failed reads in all', fr.relay + fr.graph + fr.element + fr.catchUp],
      ['database refusals', P.dbRefused], ['removals not prompted', P.removalsNotPrompted], ['dropped over the backlog', P.droppedOverBacklog],
      ['parked', P.parked], ['pending', P.pending]]) {
      expect(text, `${what} (${n})`).toMatch(numRe(n));
    }
    const T = F.PATH_TIMES;
    expect(text, 'the counts run from the first start').toMatch(FIRST_START);
    expect(text, `when it first started (${T.firstStartedAt})`).toMatch(timeRe(T.firstStartedAt));
    expect(text, `when it last reflected a change (${T.lastReflectedAt})`).toMatch(timeRe(T.lastReflectedAt));
    expect(text, 'its last catch-up').toMatch(CATCH_UP);
    expect(text, 'the catch-up\'s outcome explained').toContain(explanation('catchUpOutcome', 'done'));
    expect(text, `when the catch-up ran (${T.catchUpStartedAt})`).toMatch(timeRe(T.catchUpStartedAt));
    expect(text, 'how long the catch-up took (4200 ms)').toMatch(/\b4[.,]2\s?s(?:ec\w*)?\b|\b4,?200\s?ms\b|\b4\s?s(?:ec\w*)?\b/i);
    expect(text, 'no "not yet available" once started').not.toContain(NOT_YET);
    expect(text, 'no stale warning while the status is fresh').not.toMatch(STALE);
    expect(text, 'no unreadable warning').not.toMatch(UNREADABLE);
    expect(text, 'no reset note: the counts were not reset').not.toMatch(COUNTS_RESET);
  });

  test('B20: the path on but not running says so, and does not show the stored "live" as current [AC-3 "On but not running"]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.ON_NOT_RUNNING });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-path');
    expect(text).toMatch(NOT_RUNNING);
    // 'live' may appear only as the last stored state, labelled so ("last stored state: live"), never as the state now.
    for (const x of text.matchAll(new RegExp(codeRe('live').source, 'g'))) {
      const before = text.slice(Math.max(0, x.index - 60), x.index);
      expect(before, 'the stored state "live" is not shown as current — only as the last stored state').toMatch(/\b(?:last|stored|previous|was|before)\b/i);
    }
    expect(text, 'nor explained as the state now').not.toContain(explanation('pathState', 'live'));
  });

  test('B21: each of the eight path states is shown with its code and its explanation, and an unknown state reads "not recognised" [AC-3 "Running"; story "Explanations"]', async ({ page }) => {
    test.setTimeout(150000);
    const m = await mock(page, { realtime: F.realtimeInState(F.PATH_STATES[0]) });
    for (const state of F.PATH_STATES) {
      await reopenWith(page, m, { realtime: F.realtimeInState(state) });
      const text = await textOf(page, 'tp-path');
      expect(noOnOff(text), `state ${state} shown`).toMatch(codeRe(state));
      expect(text, `state ${state} explained`).toContain(explanation('pathState', state));
      expect(text, `state ${state} is recognised`).not.toContain(NOT_RECOGNISED);
    }
    await reopenWith(page, m, { realtime: F.REALTIME.UNKNOWN_STATE });
    const text = await textOf(page, 'tp-path');
    expect(text).toMatch(codeRe('hibernating'));
    expect(text).toContain(NOT_RECOGNISED);
  });

  test('B22: the path warns when its status is stale, when its status cannot be read, and when its on/off record cannot be read (then counting as off) [AC-3 "Warnings"]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.STALE });
    await openAndSettle(page);
    expect(await textOf(page, 'tp-path'), 'stale').toMatch(STALE);
    await reopenWith(page, m, { realtime: F.REALTIME.STATUS_UNREADABLE });
    expect(await textOf(page, 'tp-path'), 'status unreadable').toMatch(STATUS_UNREADABLE);
    await reopenWith(page, m, { realtime: F.REALTIME.SWITCH_UNREADABLE });
    const text = await textOf(page, 'tp-path');
    expect(text, 'switch unreadable').toMatch(SWITCH_UNREADABLE);
    expect(noOnOff(text), 'the path then counts as off').toMatch(/\boff\b/i);
    expect(text, 'the switch warning is not the stale one').not.toMatch(STALE);
  });

  test('B23: before the path\'s first start its figures read "not yet available", never 0 [AC-3 "Values not yet produced"; T9]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.NEVER_STARTED });
    await openAndSettle(page);
    await expect(section(page, 'tp-path'), 'before the first start').toHaveAttribute('data-state', 'empty');
    const text = await textOf(page, 'tp-path');
    expect(text).toContain(NOT_YET);
    expect(text, 'no figure reads 0').not.toMatch(numRe(0));
  });

  test('B24: the path off shows the figures it produced before, labelled as its last figures, with the time they were written [AC-3 "Values not yet produced"]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.OFF_WITH_FIGURES });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-path');
    expect(text).toMatch(LAST_FIGURES);
    expect(text, `the time they were written (${F.REALTIME.OFF_WITH_FIGURES.updatedAt})`).toMatch(timeRe(F.REALTIME.OFF_WITH_FIGURES.updatedAt));
    expect(text).toMatch(numRe(F.PATH_FIGURES.added));
    expect(noOnOff(text)).toMatch(codeRe('off'));
  });

  test('B25: counts reset because the path\'s status was lost are said to be reset, running from the reset [AC-3 "What it has done"]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.COUNTS_RESET });
    await openAndSettle(page);
    expect(await textOf(page, 'tp-path')).toMatch(COUNTS_RESET);
  });

  test('B26: a setup problem and a last error are shown with their codes and explanations [AC-3 "Problems"]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.WAITING_SETUP });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-path');
    expect(text).toMatch(codeRe('waiting-setup'));
    expect(text, 'the state explained').toContain(explanation('pathState', 'waiting-setup'));
    expect(text, 'the schema rule').toContain('tags_address');
    expect(text, 'the problem').toMatch(codeRe('not-online'));
    expect(text, 'the setup problem explained').toContain(explanation('setupProblem', 'schema:tags_address:not-online'));
    expect(text, 'the last error\'s code').toMatch(codeRe('ServiceUnavailable'));
    expect(text, 'the last error\'s stage').toMatch(codeRe('graph-read'));
    expect(text, 'the last error explained').toContain(explanation('lastErrorStage', 'graph-read'));
    expect(text, 'every code here is known').not.toContain(NOT_RECOGNISED);
  });

  test('B45: the last catch-up\'s not-established reason is labelled as why only when its outcome is not-established; a failed catch-up carrying one does not label it as why it failed [AC-3 "Catch-up"; review round 1 NB11]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.CATCH_UP_NOT_ESTABLISHED });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-path');
    expect(text, 'a not-established catch-up gives its reason as why').toMatch(whyLabel('record-missing'));
    await reopenWith(page, m, { realtime: F.REALTIME.CATCH_UP_FAILED_WITH_REASON });
    text = await textOf(page, 'tp-path');
    expect(text, 'the failed catch-up\'s stage').toMatch(codeRe('stamp-scan'));
    expect(text, 'a failed catch-up carrying a not-established reason still to report does not label it as why it failed — review NB11: PathSection labels catchUp.last.reason "Why:" whatever the outcome').not.toMatch(whyLabel('record-missing'));
  });

  /* ── AC-4: drift ─────────────────────────────────────────────────────────────────────────────────────────────── */

  test('B27: the story\'s example — relay 7032, graph 7029: difference 3, explained 5 − 1 − 1 = 3 by the named pass, unexplained 0 [AC-4 "Example"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.DRIFT_EXAMPLE, drift: F.DRIFT.EXAMPLE, realtime: F.REALTIME.OFF_WITH_FIGURES });
    await openAndSettle(page);
    await expect(section(page, 'tp-drift')).toHaveAttribute('data-state', 'ready');
    const text = await textOf(page, 'tp-drift');
    expect(text, 'relay taggings').toMatch(numRe(7032));
    expect(text, 'graph relationships').toMatch(numRe(7029));
    expect(text, `when the counts were taken (${F.DRIFT.EXAMPLE.relay.takenAt})`).toMatch(timeRe(F.DRIFT.EXAMPLE.relay.takenAt));
    expect(text, 'the difference, 3').toMatch(near('differen\\w*', 3));
    expect(text, 'the explained part, 3').toMatch(near('(?<![Uu]n)explained', 3));
    const R = F.DRIFT_EXAMPLE_RECORD;
    expect(text, 'labelled with the explaining pass\'s run id').toContain(R.runId);
    expect(text, 'and its time').toMatch(new RegExp(`${timeRe(R.startedAt).source}|${timeRe(R.endedAt).source}`, 'i'));
    expect(text, '"unexplained" reads 0').toMatch(near('unexplained', 0));
    expect(text, 'the latest pass explains: nothing says another pass was used instead').not.toMatch(INSTEAD);
  });

  test('B28: a remainder is shown as unexplained, beside the addresses the pass left to the next one [AC-4 "What it names"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.LEFT_TO_NEXT, drift: F.DRIFT.UNEXPLAINED_8 });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-drift');
    expect(text, 'the difference 7040 − 7029 = 11').toMatch(near('differen\\w*', 11));
    expect(text, '"unexplained" reads 8').toMatch(near('unexplained', 8));
    expect(text, `lost races and conflicting addresses left to the next pass (${F.EXPECTED_DRIFT.LEFT_TO_NEXT.leftToNextPass})`).toMatch(numRe(F.EXPECTED_DRIFT.LEFT_TO_NEXT.leftToNextPass));
  });

  test('B29: after a clean pass with nothing changed since, "unexplained" reads 0 [AC-4 "A clean pass"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.CLEAN, drift: F.DRIFT.CLEAN });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-drift');
    expect(text).toMatch(numRe(7027));
    expect(text).toMatch(near('unexplained', 0));
  });

  test('B30: a count that failed or took too long reads "unknown" with its code, and no difference is shown from it [AC-4 "Unknown, never 0"; T9]', async ({ page }) => {
    await mock(page, { status: F.STATUS.DRIFT_EXAMPLE, drift: F.DRIFT.RELAY_TIMEOUT });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-drift');
    expect(text).toMatch(/\bunknown\b/);
    expect(text, 'the count\'s code').toMatch(codeRe('timeout'));
    expect(text, 'the known graph count').toMatch(numRe(7029));
    expect(text, 'the unknown relay count never reads 0').not.toMatch(near('relay', 0));
    expect(text, 'no difference is shown from an unknown count').not.toMatch(/difference\W{0,5}-?\d/i);
    expect(text, 'and no unexplained remainder either').not.toMatch(/unexplained\W{0,5}-?\d/i);
  });

  test('B31: when the latest pass is not finished, the panel says which finished pass it used instead [AC-4 "No finished pass"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.LATEST_FAILED, drift: F.DRIFT.EXAMPLE });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-drift');
    expect(text, 'the finished pass used').toContain(F.DRIFT_EXAMPLE_RECORD.runId);
    expect(text, 'said to be used instead of the latest').toMatch(INSTEAD);
    expect(text).toMatch(near('unexplained', 0));
  });

  test('B32: with no finished pass in the report, there is no explained part, the whole difference is "unexplained", and the panel says why [AC-4 "No finished pass"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.NO_FINISHED, drift: F.DRIFT.EXAMPLE });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-drift');
    expect(text, '"unexplained" reads the whole difference, 3').toMatch(near('unexplained', 3));
    expect(text, 'and says why').toMatch(NO_FINISHED_WHY);
    expect(text, 'no explained part is shown').not.toMatch(EXPLAINED_NUM);
  });

  test('B33: with the path on, drift names the path\'s refused taggings and parked addresses; with it off, it says changes since the pass wait for the next pass [AC-4 "What it names"]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.DRIFT_EXAMPLE, drift: F.DRIFT.EXAMPLE, realtime: F.REALTIME.ON_LIVE });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-drift');
    expect(text, `the path's refused taggings (${F.PATH_FIGURES.refused})`).toMatch(numRe(F.PATH_FIGURES.refused));
    expect(text, `the path's parked addresses (${F.PATH_FIGURES.parked})`).toMatch(numRe(F.PATH_FIGURES.parked));
    expect(text, 'named, not subtracted: "unexplained" still reads 0').toMatch(near('unexplained', 0));
    expect(text, 'the path is on: no "changes wait for the next pass" note').not.toMatch(WAITS_FOR_PASS);
    await reopenWith(page, m, { realtime: F.REALTIME.OFF_WITH_FIGURES });
    text = await textOf(page, 'tp-drift');
    expect(text, 'changes since that pass wait for the next pass').toMatch(WAITS_FOR_PASS);
  });

  test('B34: Recount counts again and shows the new counts [AC-4 "When it counts"; T9 Recount]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.DRIFT_EXAMPLE, drift: F.DRIFT.EXAMPLE });
    await openAndSettle(page);
    expect(requestsTo(m.log, F.ROUTES.drift).length, 'counted once on opening').toBe(1);
    m.set({ drift: F.DRIFT.RECOUNT });
    await section(page, 'tp-drift').getByRole('button', { name: 'Recount', exact: true }).click();
    await expect.poll(() => textOf(page, 'tp-drift'), { message: 'the recount\'s relay count shows' }).toMatch(numRe(7051));
    expect(await textOf(page, 'tp-drift')).toMatch(numRe(7043));
    expect(requestsTo(m.log, F.ROUTES.drift).length, 'one more count').toBe(2);
  });

  test('B41: drift while a pass is running says a pass is running and that the newest finished pass explains the difference, never that the latest pass did not finish [AC-4; ADR 0004 T5 usedInsteadOfLatest; review round 1 NB1]', async ({ page }) => {
    await mock(page, { status: F.STATUS.RUNNING, drift: F.DRIFT.EXAMPLE });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-drift');
    expect(text, 'the explaining pass is the newest finished one').toContain(F.LATEST_DONE.runId);
    expect(text, 'a pass is running').toMatch(PASS_RUNNING);
    expect(text, 'the newest finished pass explains the difference').toMatch(NEWEST_FINISHED_EXPLAINS);
    expect(text, 'while a pass runs, drift does not say the latest pass did not finish — review NB1: DriftSection shows "did not finish" whenever usedInsteadOfLatest, a running pass included').not.toMatch(DID_NOT_FINISH);
  });

  // Extended for story 7's carry-forward E1 (story 5's review, round 1, non-blocking 2: "nothing pins the drift line's
  // guard, The explained part does not include them"; story 4 review round 2 R2-4, DriftSection.jsx Named): with the
  // path on, its line says the explained part does not include its figures only where an explained part is shown.
  test('B43: counts taken before the explaining pass ended show no "unexplained" figure: the panel says they predate that pass and asks for a Recount, and the path\'s line does not say the explained part leaves its figures out; a Recount with newer counts brings the explained and unexplained lines back, and that guard with them [AC-4; ADR 0004 T5 countsPredatePass; review round 1 NB3; story 4 review round 2 R2-4; story 5 review round 1 NB2 (E1, carried by story 7)]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.DRIFT_EXAMPLE, drift: F.DRIFT.PREDATING });
    await openAndSettle(page);
    const drift = section(page, 'tp-drift');
    await expect(drift).toHaveAttribute('data-state', 'ready');
    let text = await textOf(page, 'tp-drift');
    expect(text, `the counts are shown (relay 7032, taken ${F.DRIFT.PREDATING.relay.takenAt})`).toMatch(numRe(7032));
    expect(text, `the counts were taken before pass ${F.DRIFT_EXAMPLE_RECORD.runId} ended (T5 countsPredatePass) — review NB3: the panel presents them as unexplained instead`).toMatch(COUNTS_PREDATE);
    expect(text, 'and it asks for a Recount').toMatch(ASK_RECOUNT);
    expect(text, `no "unexplained" figure (arithmetic alone reads ${F.EXPECTED_DRIFT.PREDATING.unexplained})`).not.toMatch(/unexplained\W{0,5}-?\d/i);
    expect(text, 'nor the arithmetic\'s remainder beside "unexplained"').not.toMatch(near('unexplained', F.EXPECTED_DRIFT.PREDATING.unexplained));
    expect(await drift.getAttribute('style') || '', 'not in the warn tone (T5: tone neutral)').not.toMatch(/--orange|--red/);
    // E1: the path is on (the mock's default, ON_LIVE), so its line names its refused taggings and parked addresses;
    // with no explained part shown, it does not say the explained part leaves them out.
    expect(text, `the path is on: its line names its parked addresses (${F.PATH_FIGURES.parked})`).toMatch(numRe(F.PATH_FIGURES.parked));
    expect(sentencesWith(text, EXPLAINED_EXCLUDES), 'counts that predate the pass show no explained part, so the path\'s line does not say "The explained part does not include them" (DriftSection.jsx Named: known && !countsPredatePass; R2-4, E1)').toEqual([]);

    m.set({ drift: F.DRIFT.EXAMPLE });
    await drift.getByRole('button', { name: 'Recount', exact: true }).click();
    await expect.poll(async () => near('unexplained', 0).test(await textOf(page, 'tp-drift')), { message: 'after a Recount with counts newer than the pass, "unexplained" reads 0 again' }).toBe(true);
    text = await textOf(page, 'tp-drift');
    expect(text, 'the explained part is shown again').toMatch(near('(?<![Uu]n)explained', 3));
    expect(text, 'no "counts predate the pass" note any more').not.toMatch(COUNTS_PREDATE);
    expect(sentencesWith(text, EXPLAINED_EXCLUDES).length, 'with an explained part shown, the path\'s line says the explained part does not include its figures — "The explained part does not include them" (R2-4; E1)').toBeGreaterThan(0);
  });

  /* ── AC-5: refresh and failures ──────────────────────────────────────────────────────────────────────────────── */

  test('B35: a change on the status routes shows within POLL_MS, without a reload [AC-5 "Refresh"; ADR 0004 § UI "Polling", § Seams page.clock]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.NO_PASS, realtime: F.REALTIME.ON_LIVE });
    await openAndSettle(page);
    await expect(section(page, 'tp-pass')).toHaveAttribute('data-state', 'empty');
    expect(await textOf(page, 'tp-path'), 'no stale warning before the change').not.toMatch(STALE);
    const navigations = m.log.navigations;
    m.set({ status: F.STATUS.CLEAN, realtime: F.REALTIME.STALE });
    await page.clock.runFor(POLL_MS);
    await expect(section(page, 'tp-pass'), 'the new pass shows').toHaveAttribute('data-state', 'ready', { timeout: 3000 });
    await expect(section(page, 'tp-pass')).toContainText(codeRe('done'), { timeout: 3000 });
    await expect(section(page, 'tp-path'), 'the path\'s new warning shows').toContainText(STALE, { timeout: 3000 });
    expect(m.log.navigations, 'no reload').toBe(navigations);
  });

  // Each failed read: the answers that fail it, the section, the read it names, the code, and the sections that must
  // keep what they loaded. The page clock is paused before Retry, so only Retry (never a poll) can read it again.
  const FAILURES = [
    { read: 'the path status', mocks: { realtime: fail(500) }, recover: { realtime: F.REALTIME.ON_LIVE }, id: 'tp-path', names: /path(?:'s)? status|status of the (?:real-time )?path/i, code: 'http-500', others: ['tp-pass', 'tp-held', 'tp-schedule', 'tp-drift'] },
    { read: 'the pass report', mocks: { status: fail(500) }, recover: { status: F.STATUS.HELD_PENDING }, id: 'tp-pass', names: /\breport\b|pass(?:es)?(?:'s)? status|status of the pass/i, code: 'http-500', others: ['tp-path', 'tp-schedule', 'tp-drift'], unsettled: ['tp-held'] },
    { read: 'the schedule list', mocks: { schedule: fail(500) }, recover: { schedule: F.SCHEDULE.ONE }, id: 'tp-schedule', names: /schedul\w*\b[^.]*\b(?:list|entries)\b|\b(?:list|entries)\b[^.]*\bschedul/i, code: 'http-500', others: ['tp-pass', 'tp-held', 'tp-path', 'tp-drift'] },
    { read: 'the held list', mocks: { held: fail(502) }, recover: { held: undefined }, id: 'tp-held', names: /held list|list of (?:the )?held/i, code: 'http-502', others: ['tp-pass', 'tp-schedule', 'tp-path', 'tp-drift'] },
  ];
  for (const [i, c] of FAILURES.entries()) {
    test(`B36${'abcd'[i]}: a failed read of ${c.read} names itself, shows its code and offers Retry, while the other sections keep what they loaded; Retry recovers [AC-5 "States"; T9 Retry]`, async ({ page }) => {
      const m = await mock(page, c.mocks);
      await openAndSettle(page, c.unsettled || []);
      const failed = section(page, c.id);
      await expect(failed).toHaveAttribute('data-state', 'error');
      const text = await textOf(page, c.id);
      expect(text, `names the read (${c.read})`).toMatch(c.names);
      expect(text, 'shows the code').toMatch(codeRe(c.code));
      expect(text, 'never a raw JSON body').not.toMatch(/[{}]|"success"|fixture failure/);
      expect(text, 'never a stack trace').not.toMatch(/\bat [\w.]+ \(|TypeError|SyntaxError/);
      for (const id of c.others) await expect(section(page, id), `${id} keeps what it loaded`).toHaveAttribute('data-state', 'ready');
      await pauseClock(page);
      m.set(c.recover);
      await wait(1200);
      await expect(failed, 'with the clock paused and Retry not clicked, it stays failed').toHaveAttribute('data-state', 'error');
      await failed.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(failed, 'Retry reads it again').toHaveAttribute('data-state', 'ready', { timeout: 10000 });
    });
  }

  test('B37: a failed drift read makes both counts unknown, names the relay and graph counts, shows its code and offers Retry [AC-5 "States", AC-4]', async ({ page }) => {
    const m = await mock(page, { drift: fail(503) });
    await openAndSettle(page);
    const drift = section(page, 'tp-drift');
    await expect(drift).toHaveAttribute('data-state', 'error');
    const text = await textOf(page, 'tp-drift');
    expect(text, 'names the read: the relay and graph counts').toMatch(/relay (?:and|or|&) (?:the )?graph/i);
    expect(text).toMatch(codeRe('http-503'));
    expect((text.match(/\bunknown\b/g) || []).length, 'both counts read "unknown"').toBeGreaterThanOrEqual(2);
    expect(text, 'the relay count never reads 0').not.toMatch(near('relay', 0));
    expect(text, 'the graph count never reads 0').not.toMatch(near('graph', 0));
    expect(text, 'no difference is shown from unknown counts').not.toMatch(/difference\W{0,5}-?\d/i);
    for (const id of ['tp-pass', 'tp-path', 'tp-schedule']) await expect(section(page, id)).toHaveAttribute('data-state', 'ready');
    m.set({ drift: F.DRIFT.EXAMPLE });
    await drift.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(drift).toHaveAttribute('data-state', 'ready', { timeout: 10000 });
  });

  /* ── Polling (ADR 0004 § UI "Polling", "Failure"; review round 1 friction 1). These pin behaviour the panel has. ── */

  test('B46: a re-poll that fails after a good read sets the pass section to error, keeps the earlier figures, and labels them with the time they were read [AC-5 "States"; ADR 0004 § UI "Failure"; review friction 1]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.LATEST_AND_NINE });
    await openAndSettle(page);
    const pass = section(page, 'tp-pass');
    await expect(pass).toHaveAttribute('data-state', 'ready');
    const readAt = await page.evaluate(() => new Date().toISOString()); // the page clock, a moment after the good read
    expect(await textOf(page, 'tp-pass'), 'no "read at" label while the read is good').not.toMatch(readAtLabel(readAt));
    await pauseClock(page);
    m.set({ status: fail(500) });
    await page.clock.runFor(POLL_MS);
    await expect(pass, 'the failed re-poll sets error').toHaveAttribute('data-state', 'error', { timeout: 5000 });
    const text = await textOf(page, 'tp-pass');
    expect(text, 'the failure\'s code').toMatch(codeRe('http-500'));
    const L = F.LATEST_FIGURES;
    for (const [what, n] of [['taggings read', L.taggingsRead], ['added', L.added], ['removed', L.removed], ['unchanged', L.unchanged]]) {
      expect(text, `the earlier read's ${what} (${n}) is kept`).toMatch(numRe(n));
    }
    expect(text, 'the earlier read\'s outcome is kept').toContain(explanation('passOutcome', 'done'));
    expect(text, `the kept figures are labelled with the time they were read (${readAt})`).toMatch(readAtLabel(readAt));
    await expect(section(page, 'tp-path'), 'the path section is untouched').toHaveAttribute('data-state', 'ready');
  });

  test('B47: an answer to an older status request that arrives after a newer one is dropped — the section shows the newer answer [ADR 0004 § UI "Polling"; review friction 1]', async ({ page }) => {
    await trackStates(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let calls = 0;
    let firstReq = null;
    // The first status read (on opening) answers late with "no pass yet"; every later one answers at once, a clean pass.
    await mock(page, {
      status: (req) => {
        calls += 1;
        if (calls === 1) {
          firstReq = req;
          return gate.then(() => F.STATUS.NO_PASS);
        }
        return F.STATUS.CLEAN;
      },
    });
    try {
      await openPanel(page);
      await expect.poll(() => calls, { message: 'the opening status read is in flight' }).toBeGreaterThanOrEqual(1);
      await pauseClock(page);
      await page.clock.runFor(POLL_MS);
      await expect.poll(() => calls, { message: 'a poll tick sends a newer status read' }).toBeGreaterThanOrEqual(2);
      await expect(section(page, 'tp-pass'), 'the newer answer (a clean pass) shows').toHaveAttribute('data-state', 'ready', { timeout: 5000 });
      await expect(section(page, 'tp-pass')).toContainText(codeRe('done'));
    } finally {
      release();
    }
    await firstReq.response(); // the older answer has now reached the page
    await wait(800);
    await expect(section(page, 'tp-pass'), 'the older answer did not replace the newer one').toHaveAttribute('data-state', 'ready');
    expect(await textOf(page, 'tp-pass'), 'the older answer ("no pass yet") is not shown').not.toMatch(NO_PASS_YET);
    expect(await statesOf(page, 'tp-pass'), 'the section never took the older answer\'s state (empty), even briefly').not.toContain('empty');
  });

  test('B48: a poll tick is skipped while the previous one is in flight — no second status read starts until the first settles [ADR 0004 § UI "Polling"; review friction 1]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.CLEAN });
    await openAndSettle(page);
    await pauseClock(page);
    await wait(300);
    const mark = m.log.api.length;
    const since = (route) => requestsTo({ api: m.log.api.slice(mark) }, route).length;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    // The read hangs for longer than POLL_MS, until released. Two more ticks run while it hangs: a third would reach
    // readSection's own 15 s time-out (taggingPipelineFetch.js), which settles the read as 'timeout'.
    m.set({ status: () => gate.then(() => F.STATUS.CLEAN) });
    try {
      await page.clock.runFor(POLL_MS);
      await expect.poll(() => since(F.ROUTES.status), { message: 'the first tick reads the status' }).toBe(1);
      for (let i = 0; i < 2; i += 1) {
        await page.clock.runFor(POLL_MS);
        await wait(250);
      }
      expect(since(F.ROUTES.status), 'two more ticks while the first read hangs start no second status read').toBe(1);
      expect(since(F.ROUTES.realtime), 'the whole tick is skipped: the path status is not re-read either').toBe(1);
    } finally {
      release();
    }
    await expect(section(page, 'tp-pass')).toHaveAttribute('data-state', 'ready');
    await wait(500);
    await page.clock.runFor(POLL_MS);
    await expect.poll(() => since(F.ROUTES.status), { message: 'once the first read settles, the next tick reads again' }).toBe(2);
  });

  /* ── AC-2: the held list of a run that is no longer the latest ──────────────────────────────────────────────── */

  test('B40: a held list answer of 404 carrying latestRunId makes the panel re-read the status and restart the list, never showing a failure [AC-2 "Held removals"; ADR 0004 § UI "The held list"]', async ({ page }) => {
    await trackStates(page);
    const NEWER_ID = F.runIdAt(F.at(2), '5e5e5e5e');
    const newer = F.clone(F.STATUS.HELD_PENDING);
    newer.latest.runId = NEWER_ID;
    newer.previous = [F.clone(F.HELD_RECORD), ...newer.previous];
    newer.confirmationPending = null;
    let first = true;
    const m = await mock(page, { status: F.STATUS.HELD_PENDING });
    m.set({
      held: (req, dflt) => {
        if (first) {
          first = false;
          m.set({ status: newer }); // a newer pass has written the report since the panel read it
          return fail(404, { success: false, error: 'that run is not the latest report', latestRunId: NEWER_ID });
        }
        return dflt();
      },
    });
    await openAndSettle(page);
    const held = section(page, 'tp-held');
    await expect(held, 'the list of the newer run shows').toHaveAttribute('data-state', 'ready', { timeout: 10000 });
    await expect.poll(async () => (await textOf(page, 'tp-held')).match(/held-address-\d{3}/g)?.length || 0, { message: 'the newer run\'s items show' }).toBeGreaterThan(0);
    const heldReads = requestsTo(m.log, F.ROUTES.held);
    expect(heldReads.some((l) => l.includes(`runId=${NEWER_ID}`)), 'the list is restarted for the newer run id').toBe(true);
    const firstHeld = m.log.api.findIndex((l) => l.split(' ')[1].startsWith(F.ROUTES.held));
    expect(m.log.api.slice(firstHeld + 1).some((l) => l.split(' ')[1] === F.ROUTES.status), 'the status is re-read after the 404').toBe(true);
    expect(await statesOf(page, 'tp-held'), 'the held section never shows a failure').not.toContain('error');
  });

  test('B50: when the held list\'s restart re-reads the status and that answer is overtaken by a poll tick whose own status read then fails, the held list does not stay loading — it shows its own failure [AC-2 "Held removals", AC-5 "States"; story 4 review round 2 R2-10 (a story 5 carry-forward), round 1 friction 3; ADR 0004 § UI "The held list"; TaggingPipelinePanel.jsx useRead\'s `kept`]', async ({ page }) => {
    const NEWER_ID = F.runIdAt(F.at(2), '5e5e5e5e');
    const newer = F.clone(F.STATUS.HELD_PENDING);
    newer.latest.runId = NEWER_ID;
    newer.previous = [F.clone(F.HELD_RECORD), ...newer.previous];
    newer.confirmationPending = null;
    let releaseHeld;
    let releaseStatus;
    const heldGate = new Promise((resolve) => { releaseHeld = resolve; });
    const statusGate = new Promise((resolve) => { releaseStatus = resolve; });
    // before: the report as first read. reread: the first status read after the held list's 404 (the restart's own),
    // held until released, then naming the newer run. overtaken: every later status read fails.
    let phase = 'before';
    let restartReads = 0;
    let heldCalls = 0;
    const m = await mock(page, {
      status: () => {
        if (phase === 'before') return F.STATUS.HELD_PENDING;
        if (phase === 'reread') {
          phase = 'overtaken';
          restartReads += 1;
          return statusGate.then(() => newer);
        }
        return fail(500);
      },
      held: (req, dflt) => {
        heldCalls += 1;
        if (heldCalls > 1) return dflt();
        return heldGate.then(() => {
          phase = 'reread';
          return fail(404, { success: false, error: 'that run is not the latest report', latestRunId: NEWER_ID });
        });
      },
    });
    try {
      await openPanel(page);
      await expect.poll(() => heldCalls, { message: 'the held list of the latest run is read' }).toBe(1);
      await pauseClock(page); // no poll tick but the one the test runs
      releaseHeld();
      await expect.poll(() => restartReads, { message: 'the 404 naming a newer run makes the panel re-read the status' }).toBe(1);
      await expect(section(page, 'tp-held'), 'while that re-read is in flight, the held list is loading').toHaveAttribute('data-state', 'loading');
      await page.clock.runFor(POLL_MS);
      await expect(section(page, 'tp-pass'), 'a poll tick\'s newer status read fails, and it is the answer the panel keeps').toHaveAttribute('data-state', 'error', { timeout: 5000 });
    } finally {
      releaseHeld();
      releaseStatus(); // the restart's status answer now arrives, older than the poll's: it is dropped
    }
    await expect(section(page, 'tp-held'), 'the restart\'s status answer was dropped, so the held list falls through to its own failure instead of waiting on loading for a restart that never comes — review R2-10, friction 3').toHaveAttribute('data-state', /^(ready|empty|error)$/, { timeout: 5000 });
    await wait(600);
    await expect(section(page, 'tp-held'), 'and it stays out of loading').not.toHaveAttribute('data-state', 'loading');
  });

  /* ── AC-1: it changes nothing ────────────────────────────────────────────────────────────────────────────────── */

  // Revised for story 6 (ADR 0006 § Seams "Request pins": "B38's allowed set gains the record read"; D15 "The record
  // read is one more useRead in the panel's 5 s Promise.allSettled tick"): the allowed reads gain the pass record, re-read
  // with the status, and a viewer who never presses Run, Stop or the switch still sends nothing but GETs.
  // Revised for story 7 (story § Test tasks "The request pins … allow exactly this story's confirmation, any read route
  // the Architecture adds, and nothing else"; ADR 0007 § Seams "the request pins allow sendConfirm's POST and no new read
  // route (this ADR adds none)"): the POSTs the panel may send gain the confirm route's, sent only when Confirm's prompt
  // is confirmed (B147 presses it); the allowed reads gain nothing.
  test('B38: open for a minute with two Recounts and then closed, by a viewer who never presses the switch, Run, Stop or Confirm, the panel sends only GETs, exactly three counts, and no read after it closes; it reads its five routes, story 5\'s switch record and story 6\'s pass record, which it re-reads with the status, and no read route story 7 adds (it adds none) [AC-1 "It changes nothing", AC-4 "Reads only"; story 5 AC-6, story 6 AC-6 "The panel\'s reads still change nothing", story 6 Test tasks "the browser spec\'s non-GET log allow[s] exactly this story\'s requests, and any read route the Architecture adds"; story 7 AC-7, Test tasks "The request pins"; ADR 0005 D12; ADR 0006 D13, D15, § Seams "Request pins"; ADR 0007 § Seams "Revised pins"; ADR 0004 § Seams page.clock]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.CLEAN, realtime: F.REALTIME.OFF_WITH_FIGURES, schedule: F.SCHEDULE.ONE, drift: F.DRIFT.CLEAN });
    await openRelays(page);
    await wait(1500);
    const start = m.log.api.length;
    const startNonGet = m.log.nonGet.length;
    await openAndSettle(page);
    const recount = section(page, 'tp-drift').getByRole('button', { name: 'Recount', exact: true });
    const counts = () => requestsTo({ api: m.log.api.slice(start) }, F.ROUTES.drift).length;
    // A minute, one poll period at a time (a short real wait lets each tick's reads answer), with a Recount at 20 s
    // and at 40 s.
    for (let step = 1; step <= 60000 / POLL_MS; step += 1) {
      await page.clock.runFor(POLL_MS);
      await wait(150);
      if (step * POLL_MS === 20000 || step * POLL_MS === 40000) {
        const before = counts();
        await recount.click();
        await expect.poll(counts, { message: `the Recount at ${step * POLL_MS / 1000} s counts` }).toBe(before + 1);
      }
    }
    await settled(page, 'tp-drift');
    const open = m.log.api.slice(start);
    expect(m.log.nonGet.slice(startNonGet), 'every request the panel sends is a GET').toEqual([]);
    expect(requestsTo({ api: open }, F.ROUTES.drift).length, 'exactly three counts: on opening and on each Recount, none on a timer').toBe(3);
    const reads = open.map((l) => l.split(' ')[1].split('?')[0]).filter((p) => /^\/api\/(tagging-edges|scheduled-tasks)\//.test(p));
    // Story 5 (ADR 0005 § Consequences): the allowed reads gain the switch's record, GET on the switch path. Story 6
    // (ADR 0006 § Seams "Request pins", D13): and the pass record's GET. Story 7 (ADR 0007 § Seams): no read route.
    const allowed = new Set([F.ROUTES.status, F.ROUTES.realtime, F.ROUTES.schedule, F.ROUTES.drift, F.ROUTES.held, F.ROUTES.switch, F.ROUTES.passRecord]);
    expect([...new Set(reads)].filter((p) => !allowed.has(p)), 'the panel reads only its five routes, the switch\'s record and the pass record; story 7 adds no read route (ADR 0007 § Seams; the overdue verdict rides on the status, D6, D8)').toEqual([]);
    expect(m.log.nonGet.filter((l) => !ALLOWED_POSTS.includes(l)), `no request but a GET and the four POSTs the panel may send (${ALLOWED_POSTS.join(', ')}), each only when pressed`).toEqual([]);
    expect(requestsTo({ api: open }, F.ROUTES.status).length, 'the pass status is re-read at least every 10 s while open (≥ 6 in a minute)').toBeGreaterThanOrEqual(6);
    expect(requestsTo({ api: open }, F.ROUTES.realtime).length, 'the path status is re-read at least every 10 s while open (≥ 6 in a minute)').toBeGreaterThanOrEqual(6);
    expect(requestsTo({ api: open }, F.ROUTES.switch).filter((l) => l.startsWith('GET ')).length,
      'the switch\'s record is read and re-read with the status, at least every 10 s while open (≥ 6 in a minute), so other viewers see a change within POLL_MS (ADR 0005 D12)').toBeGreaterThanOrEqual(6);
    expect(requestsTo({ api: open }, F.ROUTES.passRecord).filter((l) => l.startsWith('GET ')).length,
      `the pass record (${F.ROUTES.passRecord}) is read and re-read with the status, at least every 10 s while open (≥ 6 in a minute), so every viewer sees who started or stopped a pass within POLL_MS (ADR 0006 D15 "one more useRead in the panel's 5 s Promise.allSettled tick") — not implemented yet`).toBeGreaterThanOrEqual(6);
    // Close it: open another sub-tab, and let the clock run on.
    await subTab(page, EXISTING_TABS[3]).click();
    const closedAt = m.log.api.length;
    await page.clock.runFor(POLL_MS * 3);
    await wait(500);
    const after = m.log.api.slice(closedAt).filter((l) => /\/api\/tagging-edges\//.test(l));
    expect(after, 'no read after the panel closes (its timer is cleared)').toEqual([]);
    expect(m.log.nonGet, 'nothing but GETs in the whole visit: a viewer who never presses the switch, Run, Stop or Confirm sends none of their POSTs (ADR 0005 § Seams; ADR 0006 D15; ADR 0007 D11)').toEqual([]);
  });
});

/* ══ Story 5: the real-time path's switch (ADR 0005) ═════════════════════════════════════════════════════════════ */

test.describe('The real-time path\'s switch on the panel (tagging-edges #5, ADR 0005)', () => {
  test.use({ timezoneId: 'UTC', locale: 'en-GB' });

  test.beforeAll(async () => { await loadView(); });

  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip(true, 'Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    if (RECORDING) test.skip(true, 'TP_RECORD_BASELINE=1: only the AC-6 baseline is recorded');
    await page.clock.install({ time: new Date(F.NOW) });
  });

  /* ── AC-1: the control ──────────────────────────────────────────────────────────────────────────────────────── */

  test('B51: the owner sees one control in the path section once the path status has a body — "Turn off" while the path is on (its process running or not), "Turn on" while it is off, and "Turn on" when the switch cannot be read, which counts as off [AC-1 "What it shows"; ADR 0005 D12 "The control": "It renders only once the path status has a body"]', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const m = await mock(page, { realtime: async () => { await gate; return F.REALTIME.ON_LIVE; } });
    try {
      await openPanel(page);
      await expect(section(page, 'tp-path')).toHaveAttribute('data-state', 'loading');
      await expect(controls(page), 'no control while the path status has no body').toHaveCount(0);
    } finally {
      release();
    }
    await settled(page, 'tp-path');
    const CASES = [
      [null, 'Turn off', 'on and running'],
      [F.REALTIME.ON_NOT_RUNNING, 'Turn off', 'on, its process not running'],
      [F.REALTIME.OFF_WITH_FIGURES, 'Turn on', 'off'],
      [F.REALTIME.NEVER_STARTED, 'Turn on', 'off, never started'],
      [F.REALTIME.SWITCH_UNREADABLE, 'Turn on', 'its switch cannot be read, so it counts as off'],
    ];
    for (const [rt, name, why] of CASES) {
      if (rt) await reopenWith(page, m, { realtime: rt });
      await expect(control(page, name), `${why}: the control reads "${name}" — not implemented yet if missing (ADR 0005 D12)`).toBeVisible({ timeout: 5000 });
      await expect(control(page, name), `${why}: and is enabled`).toBeEnabled();
      await expect(controls(page), `${why}: one control`).toHaveCount(1);
    }
    expect(m.log.nonGet, 'showing the control sends nothing').toEqual([]);
  });

  test('B52: while a change is under way the control is disabled and says so, with aria-busy, and no control is enabled; when the answer comes the panel shows the new state [AC-1 "While a change is under way, the control is disabled and says so"; ADR 0005 D12 "While pending it is disabled, with text such as Turning the path off… and aria-busy"]', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const m = await mock(page, { realtime: F.REALTIME.OFF_WITH_FIGURES });
    m.set({ switch: async (req, server) => { await gate; return server(); } });
    await openAndSettle(page);
    try {
      await press(page, 'Turn on');
      await expect.poll(() => m.log.nonGet, { message: 'pressing "Turn on" sends the change' }).toEqual([SWITCH_POST]);
      const busy = await busyControl(page);
      await expect(busy, 'the control is disabled while the change is under way').toBeDisabled();
      expect(squash(await busy.innerText()), 'and the control says the change is under way').toMatch(UNDER_WAY);
      for (const b of await controls(page).all()) await expect(b, 'no "Turn on" / "Turn off" is enabled meanwhile').toBeDisabled();
    } finally {
      release();
    }
    await expect(control(page, 'Turn off'), 'the answer came: the panel shows the path on').toBeVisible({ timeout: 10000 });
    await expect(control(page, 'Turn off')).toBeEnabled();
    await expect(busyButtons(page), 'the control is no longer busy').toHaveCount(0);
    expect(m.log.nonGet, 'one change, sent once').toEqual([SWITCH_POST]);
  });

  test('B53: pressing "Turn on" asks nothing: it sends one POST {"on":true} as JSON to the switch path, and the panel shows the path on and starting, with the owner\'s change as the latest, from the reads that follow the answer — with the page clock stopped, so no poll [AC-3 "Pressing Turn on asks nothing. Within 10 seconds the panel shows the path on"; AC-5; ADR 0005 D12 "sendSwitch … POST … Content-Type: application/json, the body {"on":…}", "When the server answered … await Promise.allSettled([readRealtime(), readRecord()])"]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.OFF_WITH_FIGURES });
    await openAndSettle(page);
    await pauseClock(page);
    const mark = m.log.api.length;
    await press(page, 'Turn on');
    await expect(control(page, 'Turn off'), 'within 10 s, with no poll, the panel shows the path on').toBeVisible({ timeout: 10000 });
    await expect(cancelButton(page), '"Turn on" asks nothing: no prompt').toHaveCount(0);
    expect(m.log.nonGet, 'exactly one request that is not a GET: the switch\'s POST').toEqual([SWITCH_POST]);
    const sent = m.log.sent[0];
    expect(JSON.parse(sent.body || 'null'), 'its body is {"on":true}').toEqual({ on: true });
    expect(sent.contentType || '', 'sent as JSON').toMatch(/^application\/json\b/i);
    const reread = m.log.api.slice(mark).filter((l) => l.startsWith('GET ')).map((l) => l.split(' ')[1].split('?')[0]);
    expect(reread, 'the path status is read again after the answer').toContain(F.ROUTES.realtime);
    expect(reread, 'and the switch\'s record').toContain(F.ROUTES.switch);
    await untilText(page, 'tp-path', STARTING_NOTE, 'the path is starting');
    const latest = await outsideHistory(page);
    expect(latest, 'the latest change names the owner\'s shortened key').toContain(F.OWNER_KEY);
    expect(latest, 'as the owner').toMatch(/\bowner\b/i);
    expect(latest, 'turning it on').toMatch(TURNED_ON);
    // The start completes: a process started after the "on" is alive, and the server's window verdict is false.
    m.set({ realtime: F.REALTIME.STARTED });
    await page.clock.runFor(POLL_MS);
    // Wait for the running state's own sentence — that the process is running, with its running-since time (12:00,
    // apart from onSince's 11:59) — which D7 never prints while starting; the bare word "running" is not enough.
    const since = F.REALTIME.STARTED.runningSince;
    await expect.poll(async () => sentencesWith(await textOf(page, 'tp-path'), IS_RUNNING, clockRe(since)).length, {
      message: `once a process started after the "on" is alive, a sentence says the process is running, since ${since} (story 4's on-and-running line; ${IS_RUNNING} with ${clockRe(since)})`,
      timeout: 5000,
    }).toBeGreaterThan(0);
    const text = await textOf(page, 'tp-path');
    expect(text, 'no longer starting').not.toMatch(STARTING_NOTE);
    expect(text, 'never "not running" on the way').not.toMatch(NOT_RUNNING_STRICT);
  });

  test('B54: when the server does not answer a change within 15 s — the switch, the path status and the record all hang — the control is enabled again and the panel says the outcome is unknown; it then shows the state from its next read [AC-1 "If the server has not answered within 15 seconds"; ADR 0005 D12 "When the answer is unknown … clear pending at once … Then start the re-reads without waiting for them"; § Seams "The 15 s cases"]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.OFF_BY_OWNER });
    await openAndSettle(page);
    await expect(control(page, 'Turn on'), 'the path is off — not implemented yet if missing (ADR 0005 D12)').toBeEnabled({ timeout: 5000 });
    await pauseClock(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    m.set({
      switch: async () => { await gate; return F.SWITCH_ANSWER.ON; },
      realtime: async () => { await gate; return F.REALTIME.STARTING; },
      record: async () => { await gate; return F.RECORD.STARTING; },
    });
    try {
      await press(page, 'Turn on');
      await expect.poll(() => m.log.nonGet, { message: 'the change is sent' }).toEqual([SWITCH_POST]);
      await expect(await busyControl(page), 'under way').toBeDisabled();
      await page.clock.runFor(15000);
      await expect(controls(page).first(), 'after 15 s with no answer, the control is enabled again').toBeEnabled({ timeout: 5000 });
      await expect(busyButtons(page), 'and the control is no longer busy').toHaveCount(0);
      await untilText(page, 'tp-path', OUTCOME_UNKNOWN, 'and the panel says the outcome is unknown', 5000);
    } finally {
      release();
    }
    await expect(control(page, 'Turn off'), 'it then shows the state from its next read: on').toBeVisible({ timeout: 10000 });
    await untilText(page, 'tp-path', STARTING_NOTE, 'and it reads starting');
    expect(m.log.nonGet, 'the change was sent once and never retried').toEqual([SWITCH_POST]);
    await wait(300);
  });

  test('B55: beside "Turn on", a warning shows when the report holds no finished pass — taggings already on the relay wait for a pass — and, when the report cannot be read, one that says it could not check; none when a finished pass exists, and none while the path is on [AC-1 "A warning beside Turn on"; ADR 0005 D14 turnOnWarning]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.OFF_WITH_FIGURES, status: F.STATUS.NO_PASS });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-path');
    expect(relayTaggingsWait(text).length, `no pass in the report: a warning says taggings already on the relay wait for a pass; tp-path reads ${JSON.stringify(text.slice(0, 300))}`).toBeGreaterThan(0);
    await reopenWith(page, m, { status: F.STATUS.NO_FINISHED });
    text = await textOf(page, 'tp-path');
    expect(relayTaggingsWait(text).length, 'passes in the report, none finished: the warning shows').toBeGreaterThan(0);
    await reopenWith(page, m, { status: F.STATUS.LATEST_AND_NINE });
    await expect(control(page, 'Turn on')).toBeVisible({ timeout: 5000 });
    expect(relayTaggingsWait(await textOf(page, 'tp-path')), 'a finished pass in the report: no warning').toEqual([]);
    await reopenWith(page, m, { realtime: F.REALTIME.ON_LIVE, status: F.STATUS.NO_PASS });
    await expect(control(page, 'Turn off')).toBeVisible({ timeout: 5000 });
    expect(relayTaggingsWait(await textOf(page, 'tp-path')), 'the path on: no "Turn on", so no warning').toEqual([]);
    m.set({ realtime: F.REALTIME.OFF_WITH_FIGURES, status: fail(500) });
    await openAndSettle(page, ['tp-held']);
    text = await textOf(page, 'tp-path');
    expect(couldNotCheckPass(text).length, 'the report cannot be read: the warning says it could not check for a finished pass').toBeGreaterThan(0);
    expect(m.log.nonGet).toEqual([]);
  });

  /* ── AC-2: turning off asks first ──────────────────────────────────────────────────────────────────────────── */

  const BACKSTOP_STATES = [
    { name: 'no enabled entry', schedule: F.SCHEDULE.NONE, has: [NO_BACKSTOP] },
    { name: 'no enabled entry, a disabled one', schedule: F.SCHEDULE.NONE_WITH_DISABLED, has: [NO_BACKSTOP] },
    { name: 'one entry, every 6 hours', schedule: F.SCHEDULE.ONE, has: [/\b6\s?(?:hours?|hrs?|h)\b/i, clockRe(F.SCHEDULE.ONE.entries[1].timer.nextRunAt)], lacks: [NO_BACKSTOP, NOT_SCHEDULED, WEAKER_THAN_DAILY] },
    { name: 'one entry, not scheduled', schedule: F.SCHEDULE.ONE_UNSCHEDULED, has: [NOT_SCHEDULED], lacks: [NO_BACKSTOP] },
    { name: 'one entry, every 2 days', schedule: F.SCHEDULE.ONE_WEAKER_INTERVAL, has: [WEAKER_THAN_DAILY, /\b2\s?(?:days?|d)\b/i], lacks: [NO_BACKSTOP] },
    { name: 'one entry, a weekly cron', schedule: F.SCHEDULE.ONE_WEAKER_CRON, has: [WEAKER_THAN_DAILY, /0 3 \* \* 0/], lacks: [NO_BACKSTOP] },
    { name: 'two enabled entries', schedule: F.SCHEDULE.SEVERAL, has: [SEVERAL_COUNT], lacks: [NO_BACKSTOP] },
  ];

  test('B56: pressing "Turn off" opens a prompt inside the path section — a heading, focus on Cancel, one "Turn off" on the page — that says the path stops reflecting changes within seconds, that what it holds is kept and changes stored meanwhile are caught up when it is turned back on (story 3\'s few cases aside, for the next pass), and what keeps the graph in step meanwhile, described as the backstop section describes each of story 4\'s schedule states [AC-2 "Normally, the prompt says"; ADR 0005 D13 "The normal variant", "Layout", BackstopVerdict]', async ({ page }) => {
    test.setTimeout(150000);
    const m = await mock(page, { schedule: BACKSTOP_STATES[0].schedule });
    for (const [i, c] of BACKSTOP_STATES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reopenWith(page, m, { schedule: c.schedule });
      const before = await textOf(page, 'tp-path');
      const p = await openPrompt(page);
      await expect(p.cancel, `${c.name}: focus moves to Cancel when the prompt opens`).toBeFocused();
      await expect(page.getByRole('button', { name: 'Turn off', exact: true }), `${c.name}: one "Turn off" at a time — the prompt replaces the control`).toHaveCount(1);
      await expect(controls(page), `${c.name}: the control is replaced while the prompt is open`).toHaveCount(1);
      const text = await p.text();
      const sched = await textOf(page, 'tp-schedule');
      for (const re of c.has) {
        expect(before, `${c.name}: before the prompt opens, the path section does not say it (${re})`).not.toMatch(re);
        expect(sched, `${c.name}: the backstop section says it (${re})`).toMatch(re);
        expect(text, `${c.name}: the prompt says what keeps the graph in step, as the backstop section does (${re})`).toMatch(re);
      }
      for (const re of c.lacks || []) expect(text, `${c.name}: the prompt does not say ${re}`).not.toMatch(re);
      expect(text, `${c.name}: the path stops reflecting changes within seconds`).toMatch(PROMPT_STOPS);
      expect(text, `${c.name}: what it holds is kept`).toMatch(PROMPT_KEPT);
      expect(text, `${c.name}: changes stored meanwhile are caught up`).toMatch(PROMPT_CATCH_UP);
      expect(text, `${c.name}: when it is turned back on`).toMatch(PROMPT_BACK_ON);
      expect(text, `${c.name}: apart from the few cases left to the next pass`).toMatch(PROMPT_NEXT_PASS);
      expect(text, `${c.name}: not the first-start variant`).not.toMatch(FIRST_START_AGAIN);
      await p.cancel.click();
      await expect(control(page, 'Turn off'), `${c.name}: Cancel closes the prompt`).toBeVisible({ timeout: 5000 });
    }
    expect(m.log.nonGet, 'opening and cancelling the prompt sends nothing').toEqual([]);
  });

  test('B57: with the schedule list unreadable, the prompt says the backstop could not be checked, and claims no backstop state [AC-2 "When the schedule cannot be read, it says the backstop could not be checked"; ADR 0005 D13 "With no schedule view, it says the backstop could not be checked"]', async ({ page }) => {
    const m = await mock(page, { schedule: fail(500) });
    await openAndSettle(page);
    await expect(section(page, 'tp-schedule')).toHaveAttribute('data-state', 'error');
    const p = await openPrompt(page);
    const text = await p.text();
    expect(text, 'the backstop could not be checked').toMatch(BACKSTOP_UNCHECKED);
    expect(text, 'no "no backstop" claim from an unread list').not.toMatch(NO_BACKSTOP);
    expect(text, 'the rest of the normal prompt stands: it stops within seconds').toMatch(PROMPT_STOPS);
    expect(text, 'and what it holds is kept').toMatch(PROMPT_KEPT);
    await p.cancel.click();
    expect(m.log.nonGet).toEqual([]);
  });

  test('B82: while the schedule list\'s first read is still loading, the prompt neither says the backstop could not be checked nor claims any verdict, and says the backstop is still being checked; once the read answers, the prompt already open shows the real verdict, without being reopened [AC-2 "When the schedule cannot be read, it says the backstop could not be checked"; ADR 0005 D13 (a pending read, review round 1), D14 "none while loading"; story 5\'s review, round 1, requested 5]', async ({ page }) => {
    // The schedule list's read is held, then released. It must settle well within readSection's own 15 s time-out
    // (taggingPipelineFetch.js), which would turn the held read into a failed one.
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const one = F.SCHEDULE.ONE;
    const ONE_VERDICT = [/\b6\s?(?:hours?|hrs?|h)\b/i, clockRe(one.entries[1].timer.nextRunAt)];
    const VERDICTS = [NO_BACKSTOP, NOT_SCHEDULED, WEAKER_THAN_DAILY, SEVERAL_COUNT, ...ONE_VERDICT];
    const m = await mock(page, { schedule: () => gate.then(() => one) });
    let p;
    try {
      await openAndSettle(page, ['tp-schedule']);
      await expect(section(page, 'tp-schedule'), 'the schedule list\'s first read is still in flight')
        .toHaveAttribute('data-state', 'loading');
      p = await openPrompt(page);
      const text = await p.text();
      expect(text, 'a read still loading has not failed: the prompt does not say the backstop could not be checked')
        .not.toMatch(BACKSTOP_UNCHECKED);
      for (const re of VERDICTS) expect(text, `no verdict from a list not yet read (${re})`).not.toMatch(re);
      expect(text, 'it says the backstop is still being checked').toMatch(BACKSTOP_CHECKING);
      expect(text, 'the rest of the normal prompt stands: it stops within seconds').toMatch(PROMPT_STOPS);
      expect(text, 'and what it holds is kept').toMatch(PROMPT_KEPT);
    } finally {
      release();
    }
    await expect(section(page, 'tp-schedule'), 'the schedule list answers once released')
      .toHaveAttribute('data-state', 'ready', { timeout: 10000 });
    await expect(p.cancel, 'the prompt is still open: nothing closed it').toBeVisible();
    for (const re of ONE_VERDICT) {
      const message = `the open prompt now shows the real verdict (${re}), without being reopened`;
      await expect.poll(() => p.text(), { message, timeout: 5000 }).toMatch(re);
    }
    const after = await p.text();
    expect(after, 'no longer "still being checked"').not.toMatch(BACKSTOP_CHECKING);
    expect(after, 'and never "could not be checked"').not.toMatch(BACKSTOP_UNCHECKED);
    for (const re of [NO_BACKSTOP, NOT_SCHEDULED, WEAKER_THAN_DAILY]) {
      expect(after, `the verdict is one entry's, not another (${re})`).not.toMatch(re);
    }
    await p.cancel.click();
    expect(m.log.nonGet, 'opening and cancelling the prompt sends nothing').toEqual([]);
  });

  test('B113: during a Retry of the schedule list after its read failed, the off prompt already open says the backstop is still being checked, not that it could not be checked; once the Retry answers, the prompt shows the real verdict, without being reopened [story 5 review carry-forward C5-4 (story 6 Carry-forwards; ADR 0006 D20: schedPending={schedule.state === \'loading\'}, "During a Retry after a failed read, the open off prompt now says the backstop is still being checked"); story 5 AC-2; ADR 0005 D13\'s note]', async ({ page }) => {
    const one = F.SCHEDULE.ONE;
    const ONE_VERDICT = [/\b6\s?(?:hours?|hrs?|h)\b/i, clockRe(one.entries[1].timer.nextRunAt)];
    const m = await mock(page, { schedule: fail(500) });
    await openAndSettle(page);
    const sched = section(page, 'tp-schedule');
    await expect(sched, 'the schedule list\'s first read failed').toHaveAttribute('data-state', 'error');
    const p = await openPrompt(page);
    expect(await p.text(), 'with the read failed, the open prompt says the backstop could not be checked (B57\'s state, today\'s behaviour)').toMatch(BACKSTOP_UNCHECKED);
    await pauseClock(page); // no poll re-reads the schedule list but the Retry
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    // The Retry's read is held, then released well within readSection's own 15 s time-out.
    m.set({ schedule: () => gate.then(() => one) });
    try {
      await sched.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(sched, 'the Retry is in flight: the schedule list is loading again').toHaveAttribute('data-state', 'loading', { timeout: 5000 });
      await expect(p.cancel, 'the prompt is still open: the Retry did not close it').toBeVisible();
      await expect.poll(() => p.text(), {
        message: `during the Retry the open prompt says the backstop is still being checked (${BACKSTOP_CHECKING}) — ADR 0006 D20 (C5-4): schedPending must follow schedule.state === 'loading', not "no answer yet", so a Retry after a failed read counts as pending; not implemented yet: the prompt still says it could not be checked`,
        timeout: 5000,
      }).toMatch(BACKSTOP_CHECKING);
      expect(await p.text(), 'and not that it could not be checked while the Retry is still loading').not.toMatch(BACKSTOP_UNCHECKED);
    } finally {
      release();
    }
    await expect(sched, 'the Retry answers').toHaveAttribute('data-state', 'ready', { timeout: 10000 });
    for (const re of ONE_VERDICT) {
      await expect.poll(() => p.text(), { message: `the open prompt now shows the real verdict (${re}), without being reopened`, timeout: 5000 }).toMatch(re);
    }
    const after = await p.text();
    expect(after, 'no longer "still being checked"').not.toMatch(BACKSTOP_CHECKING);
    expect(after, 'and not "could not be checked"').not.toMatch(BACKSTOP_UNCHECKED);
    await p.cancel.click();
    expect(m.log.nonGet, 'a Retry and the prompt send nothing but GETs').toEqual([]);
  });

  test('B58: before the path has completed its first start, the prompt says instead that what it has gathered so far is dropped, that the next "Turn on" is a first start again, and that a pass should run after the path shows live [AC-2 "Before the path has completed its first start"; ADR 0005 D8 offPromptVariant "first-start" (firstStartedAt not served), D13; OPERATIONS §12.9\'s order]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.FIRST_STARTING });
    await openAndSettle(page);
    const p = await openPrompt(page);
    const text = await p.text();
    expect(text, 'what it has gathered so far is dropped').toMatch(FIRST_DROPPED);
    expect(text, 'the next "Turn on" is a first start again').toMatch(FIRST_START_AGAIN);
    expect(text, 'whatever the relay holds then waits for a pass, so one should run after the path shows live').toMatch(PASS_AFTER_LIVE);
    // "Says instead": the normal variant's claims are absent.
    expect(keptClaims(text), 'not the normal variant: no claim that what the path holds is kept').toEqual([]);
    expect(caughtUpOnClaims(text), 'not the normal variant: no claim that changes stored meanwhile are caught up when it is turned back on').toEqual([]);
    await p.cancel.click();
    expect(m.log.nonGet).toEqual([]);
  });

  test('B59: when the path\'s status cannot be read, the prompt is the normal one plus a line that it could not check whether the first start completed, with the first-start consequences stated as a condition [AC-2; ADR 0005 D8 offPromptVariant "unknown" (statusUnreadable)]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.STATUS_UNREADABLE });
    await openAndSettle(page);
    const p = await openPrompt(page);
    const text = await p.text();
    expect(text, 'the normal prompt: it stops within seconds').toMatch(PROMPT_STOPS);
    expect(text, 'the normal prompt: what it holds is kept').toMatch(PROMPT_KEPT);
    expect(text, 'it could not check whether the first start completed').toMatch(FIRST_START_UNCHECKED);
    expect(text, 'the first-start consequences, as a condition').toMatch(IF_FIRST_START);
    await p.cancel.click();
    expect(m.log.nonGet).toEqual([]);
  });

  test('B60: Cancel closes the prompt and sends nothing: the control is back, the path still on, and no request but GETs [AC-2 "Cancelling sends nothing and changes nothing"; ADR 0005 D13 "Cancel sends nothing"; § Seams "log.nonGet … [] after a cancel"]', async ({ page }) => {
    const m = await mock(page);
    await openAndSettle(page);
    const p = await openPrompt(page);
    await p.cancel.click();
    await expect(cancelButton(page), 'the prompt is closed').toHaveCount(0, { timeout: 5000 });
    await expect(control(page, 'Turn off'), 'the control is back').toBeEnabled();
    await wait(1000);
    expect(m.log.nonGet, 'Cancel sends nothing').toEqual([]);
    expect(noOnOff(await textOf(page, 'tp-path')), 'the path is still on').toMatch(ON);
  });

  test('B61: confirming the prompt sends one POST {"on":false} as JSON to the switch path, and within 10 s — with no poll — the panel shows the path off, with "Turned off by the owner" and its shortened key as the latest change [AC-2 "Confirming turns the path off, and within 10 seconds the panel shows it off"; AC-5; ADR 0005 D12, D13; § Seams "log.nonGet equals exactly [\'POST /api/tagging-edges/realtime/switch\'] after a confirm"]', async ({ page }) => {
    const m = await mock(page);
    await openAndSettle(page);
    const p = await openPrompt(page);
    await pauseClock(page);
    await p.confirm.click();
    await expect(control(page, 'Turn on'), 'within 10 s the panel shows the path off').toBeVisible({ timeout: 10000 });
    await expect(cancelButton(page), 'the prompt is closed').toHaveCount(0);
    expect(m.log.nonGet, 'exactly one request that is not a GET: the switch\'s POST').toEqual([SWITCH_POST]);
    expect(JSON.parse(m.log.sent[0].body || 'null'), 'its body is {"on":false}').toEqual({ on: false });
    expect(m.log.sent[0].contentType || '', 'sent as JSON').toMatch(/^application\/json\b/i);
    expect(noOnOff(await textOf(page, 'tp-path')), 'the path reads off').toMatch(/\boff\b/i);
    const latest = await outsideHistory(page);
    expect(latest, 'the latest change names the owner\'s shortened key').toContain(F.OWNER_KEY);
    expect(latest, 'as the owner').toMatch(/\bowner\b/i);
    expect(latest, 'turning it off').toMatch(TURNED_OFF);
    expect(latest, `when (${F.NOW})`).toMatch(clockRe(F.NOW));
    expect(await rowText(page, 0), 'the history\'s first row is that change').toContain(F.OWNER_KEY);
    expect(await rowText(page, 0)).toMatch(/\boff\b/i);
  });

  test('B62: the prompt closes by itself when a read shows the path off — another viewer turned it off — and nothing is sent [AC-2; ADR 0005 D13 "It closes by itself if a read shows the path off"]', async ({ page }) => {
    const m = await mock(page);
    await openAndSettle(page);
    await openPrompt(page);
    await pauseClock(page);
    m.set({ realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.OFF_BY_ADMIN });
    await page.clock.runFor(POLL_MS);
    await expect(cancelButton(page), 'the prompt closed by itself').toHaveCount(0, { timeout: 5000 });
    await expect(control(page, 'Turn on'), 'the control reads "Turn on"').toBeVisible();
    expect(m.log.nonGet, 'nothing was sent').toEqual([]);
  });

  /* ── AC-3: turning on, without a false alarm ──────────────────────────────────────────────────────────────── */

  test('B63: within the starting window the path section says the path is starting — switched on at its time, which can take up to about 30 seconds — and never that it has failed: no "not running" by B20\'s patterns, no stored state shown, no red, across polls; past the window, with no process, it shows story 4\'s "on, but its process is not running" [AC-3 "Within the window … never that it has failed", "Past 60 seconds"; ADR 0005 D7 "OnLine checks starting first", "B20\'s patterns"; § Seams STARTING, ON_NOT_RUNNING]', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    // The record is held at first, so the only time printed in the section is the path's own "switched on at".
    const m = await mock(page, { realtime: F.REALTIME.STARTING, record: async () => { await gate; return F.RECORD.STARTING; } });
    let text;
    try {
      // tp-path is read by its text, not its data-state: ADR 0005 does not say whether that state also waits for the
      // record read (held here), only that the control adds no new data-state value (D12, PS12).
      await openAndSettle(page, ['tp-path']);
      await untilText(page, 'tp-path', STARTING_NOTE, 'it says the path is starting', 10000);
      text = await textOf(page, 'tp-path');
      expect(text, `that it was switched on at ${F.SWITCH_TIMES.startOnAt}`).toMatch(clockRe(F.SWITCH_TIMES.startOnAt));
      expect(text, 'which can take up to about 30 seconds').toMatch(UP_TO_30S);
      expect(text, 'never "not running" (B20\'s NOT_RUNNING, matched over the whole section)').not.toMatch(NOT_RUNNING);
      expect(text, 'nor B19\'s strict form').not.toMatch(NOT_RUNNING_STRICT);
      expect(text, 'the old status.json\'s stored "off" is not shown as its state').not.toContain(explanation('pathState', 'off'));
      expect(await section(page, 'tp-path').getAttribute('style') || '', 'not in the bad tone').not.toMatch(/--red/);
      await expect(control(page, 'Turn off'), 'it is on: the control reads "Turn off"').toBeVisible();
    } finally {
      release();
    }
    await expect.poll(async () => (await textOf(page, 'tp-path')).includes(F.OWNER_KEY), { message: 'the record shows' }).toBe(true);
    text = await textOf(page, 'tp-path');
    expect(text, 'the whole section, the record included, never matches NOT_RUNNING').not.toMatch(NOT_RUNNING);
    expect(text).not.toMatch(NOT_RUNNING_STRICT);
    await pauseClock(page);
    for (let i = 1; i <= 2; i += 1) {
      await page.clock.runFor(POLL_MS);
      await wait(300);
      text = await textOf(page, 'tp-path');
      expect(text, `poll ${i}, still inside the window: still starting`).toMatch(STARTING_NOTE);
      expect(text, `poll ${i}: never "not running"`).not.toMatch(NOT_RUNNING);
    }
    m.set({ realtime: F.REALTIME.ON_NOT_RUNNING });
    await page.clock.runFor(POLL_MS);
    await untilText(page, 'tp-path', NOT_RUNNING, 'past 60 s with no process: story 4\'s "on, but its process is not running"', 5000);
  });

  test('B64: a viewer who did not press sees another viewer\'s "on" within POLL_MS — starting, and the admin who turned it on — and a reload inside the window still says starting; that viewer sends nothing [AC-3 "Every viewer sees it, and it survives a reload"; AC-5; ADR 0005 D7 (a verdict in the body), D12 "polled with the status reads, so other viewers see a change within POLL_MS"; § Seams "A reload and a second viewer see the same"]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.OFF_BY_OWNER });
    await openAndSettle(page);
    await expect(control(page, 'Turn on'), 'the path is off — not implemented yet if missing (ADR 0005 D12)').toBeVisible({ timeout: 5000 });
    await pauseClock(page);
    m.set({ realtime: F.REALTIME.STARTING, record: F.RECORD.STARTING_BY_ADMIN });
    await page.clock.runFor(POLL_MS);
    await untilText(page, 'tp-path', STARTING_NOTE, 'within POLL_MS the path shows starting', 3000);
    await expect(control(page, 'Turn off')).toBeVisible({ timeout: 3000 });
    await expect.poll(async () => (await outsideHistory(page)).includes(F.ADMIN_KEY), { message: 'within POLL_MS the admin\'s change is the latest', timeout: 3000 }).toBe(true);
    const latest = await outsideHistory(page);
    expect(latest, 'by an admin').toMatch(/\badmin\b/i);
    expect(latest, 'turning it on').toMatch(TURNED_ON);
    await page.clock.resume();
    await openAndSettle(page); // a reload inside the window
    const text = await textOf(page, 'tp-path');
    expect(text, 'after a reload, still starting').toMatch(STARTING_NOTE);
    expect(text, 'never "not running"').not.toMatch(NOT_RUNNING);
    expect(text).not.toMatch(NOT_RUNNING_STRICT);
    expect(m.log.nonGet, 'a viewer who did not press sends nothing').toEqual([]);
  });

  test('B65: an "on" while the process from before is still stopping (a quick off then on) shows starting, not running: no sentence that a process is running, no running-since time, and the old process\'s stored "live" not shown as current [AC-3 "A process that started before that on does not count as running, so a quick off-then-on shows starting"; ADR 0005 D7 "Within the window it never prints that the process is running, and never shows runningSince"; § Seams STARTING_OLD_PROCESS]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.STARTING_OLD_PROCESS, record: F.RECORD.STARTING_OLD_PROCESS });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-path');
    expect(text, 'starting').toMatch(STARTING_NOTE);
    expect(text, 'no sentence that a process is running').not.toMatch(IS_RUNNING);
    expect(text, `no running-since time (${F.PATH_TIMES.runningSince})`).not.toMatch(clockRe(F.PATH_TIMES.runningSince));
    expect(text, 'the old process\'s stored "live" is not shown as the state now').not.toContain(explanation('pathState', 'live'));
    expect(text, 'never "not running"').not.toMatch(NOT_RUNNING);
    expect(text).not.toMatch(NOT_RUNNING_STRICT);
    expect(await section(page, 'tp-path').getAttribute('style') || '', 'not in the bad tone').not.toMatch(/--red/);
  });

  test('B66: an "on" while the path is already on does not restart the window: the path shows on and running, not starting, and the record shows that latest "on" [AC-3 "An on while the path is already on does not restart the window"; AC-5; ADR 0005 D4; § Seams "An on while already on: the same onSince, and not in the window"]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.ON_WHILE_ON, record: F.RECORD.ON_WHILE_ON });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-path');
    expect(text, 'running').toMatch(/\brunning\b/i);
    expect(text, 'not starting').not.toMatch(STARTING_NOTE);
    expect(text, 'not "not running"').not.toMatch(NOT_RUNNING_STRICT);
    const latest = await outsideHistory(page);
    expect(latest, 'the latest change is the admin\'s "on"').toContain(F.ADMIN_KEY);
    expect(latest).toMatch(TURNED_ON);
    expect(latest, `at ${F.SWITCH_TIMES.onWhileOnAt}`).toMatch(clockRe(F.SWITCH_TIMES.onWhileOnAt));
  });

  /* ── AC-4: refused or failed ──────────────────────────────────────────────────────────────────────────────── */

  test('B67: a refused change shows why — sign in again as the owner or an admin — with the HTTP status beside it, and the path\'s state unchanged: a 403 on "Turn off", and a lapsed session\'s 401 on "Turn on" [AC-4 "Refused or failed"; ADR 0005 D12 switchOutcome "refused": "Its own sentence says to sign in again as the owner or an admin, from the instance\'s own address. The HTTP status is shown beside it."]', async ({ page }) => {
    const m = await mock(page, { switch: F.SWITCH_ANSWER.REFUSED_403 });
    await openAndSettle(page);
    const p = await openPrompt(page);
    await p.confirm.click();
    await expect.poll(async () => refusedSentences(await textOf(page, 'tp-path')).length, {
      message: `a 403: one sentence says to sign in again as the owner or an admin (ADR 0005 D12 "refused"; TV80) (${SIGN_IN_AGAIN}, ${OWNER_OR_AN_ADMIN})`,
      timeout: 10000,
    }).toBeGreaterThan(0);
    let text = await textOf(page, 'tp-path');
    expect(text, 'the HTTP status beside it').toMatch(/\b403\b/);
    await expect(control(page, 'Turn off'), 'the state unchanged: still on').toBeEnabled({ timeout: 5000 });
    await reopenWith(page, m, { realtime: F.REALTIME.OFF_WITH_FIGURES, switch: F.SWITCH_ANSWER.REFUSED_401 });
    await press(page, 'Turn on');
    await expect.poll(async () => refusedSentences(await textOf(page, 'tp-path')).length, {
      message: `a lapsed session's 401: one sentence says to sign in again as the owner or an admin (ADR 0005 D12 "refused"; TV80) (${SIGN_IN_AGAIN}, ${OWNER_OR_AN_ADMIN})`,
      timeout: 10000,
    }).toBeGreaterThan(0);
    text = await textOf(page, 'tp-path');
    expect(text, 'the HTTP status beside it').toMatch(/\b401\b/);
    await expect(control(page, 'Turn on'), 'the state unchanged: still off').toBeEnabled({ timeout: 5000 });
    expect(m.log.nonGet, 'one POST each, nothing retried').toEqual([SWITCH_POST, SWITCH_POST]);
  });

  test('B68: a failed "Turn on" says the path\'s state is unchanged and to check that the data volume has free space and is writable, with the failure\'s code; the path stays off [AC-4 "Turning on fails, for example, when the server cannot write the switch"; ADR 0005 D11 (500s gain code), D12 switchOutcome "failed": "A failed on says the path\'s state is unchanged, and to check that the data volume has free space and is writable"]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.OFF_WITH_FIGURES, switch: F.SWITCH_ANSWER.FAILED_ON });
    await openAndSettle(page);
    await press(page, 'Turn on');
    await untilText(page, 'tp-path', FREE_SPACE, 'the failure shows', 10000);
    const text = await textOf(page, 'tp-path');
    expect(text, 'the state is unchanged').toMatch(STATE_UNCHANGED);
    expect(text, 'and writable').toMatch(WRITABLE);
    expect(text, 'with the failure\'s code').toMatch(codeRe('ENOSPC'));
    await expect(control(page, 'Turn on'), 'still off').toBeEnabled({ timeout: 5000 });
    expect(m.log.nonGet).toEqual([SWITCH_POST]);
  });

  test('B69: a failed "Turn off" says the path could not be turned off and is still on as before, with the failure\'s code [AC-4 "When the server … cannot make the change, the panel shows the reason and the path\'s state unchanged"; ADR 0005 D11, D12 "A failed off says the path could not be turned off and is still on as before"]', async ({ page }) => {
    const m = await mock(page, { switch: F.SWITCH_ANSWER.FAILED_OFF });
    await openAndSettle(page);
    const p = await openPrompt(page);
    await p.confirm.click();
    await untilText(page, 'tp-path', NOT_TURNED_OFF, 'the failure shows', 10000);
    const text = await textOf(page, 'tp-path');
    expect(text, 'and it is still on').toMatch(STILL_ON);
    expect(text, 'with the failure\'s code').toMatch(codeRe('EIO'));
    await expect(control(page, 'Turn off'), 'still on').toBeEnabled({ timeout: 5000 });
    expect(m.log.nonGet).toEqual([SWITCH_POST]);
  });

  test('B70: an admin may turn back on what the owner turned off — the last change wins — and the record shows the admin\'s "on" as the latest, the owner\'s "off" below it [AC-4 "Last change wins, whoever made it"; AC-5 "Every change records who made it"; ADR 0005 D3, D5]', async ({ page }) => {
    const m = await mock(page, { who: 'admin', realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.OFF_BY_OWNER });
    await openAndSettle(page);
    await press(page, 'Turn on');
    await expect(control(page, 'Turn off'), 'the admin\'s change took effect').toBeVisible({ timeout: 10000 });
    const latest = await outsideHistory(page);
    expect(latest, 'the latest change is the admin\'s').toContain(F.ADMIN_KEY);
    expect(latest).toMatch(/\badmin\b/i);
    expect(latest).toMatch(TURNED_ON);
    expect(await rowText(page, 0), 'the history\'s first row: the admin\'s on').toContain(F.ADMIN_KEY);
    expect(await rowText(page, 1), 'below it: the owner\'s off').toContain(F.OWNER_KEY);
    expect(await rowText(page, 1)).toMatch(/\boff\b/i);
    expect(await rowText(page, 1)).toMatch(clockRe(F.SWITCH_TIMES.offAt));
    expect(m.log.nonGet).toEqual([SWITCH_POST]);
  });

  /* ── AC-5: who did it ─────────────────────────────────────────────────────────────────────────────────────── */

  test('B71: the latest change shows who made it — owner or admin and a shortened key — and when, and the last 10 changes show newest first, each with its own who, when and on or off [AC-5 "What the panel shows"; ADR 0005 D12 switchRecordView "recorded, with a role", "an ordered list of up to 10"]', async ({ page }) => {
    await mock(page, { realtime: F.rtBody({ onSince: F.at(3) }), record: F.RECORD.HISTORY_TEN });
    await openAndSettle(page);
    const first = F.HISTORY_TEN[0];
    await expect.poll(async () => (await outsideHistory(page)).includes(first.key), { message: 'the latest change names its shortened key — not implemented yet if missing (ADR 0005 D12)' }).toBe(true);
    const latest = await outsideHistory(page);
    expect(latest, 'by the owner').toMatch(/\bowner\b/i);
    expect(latest, 'turned on').toMatch(TURNED_ON);
    expect(latest, `when (${first.at})`).toMatch(clockRe(first.at));
    await expect(historyRows(page), 'the last 10 changes').toHaveCount(10);
    for (const [i, e] of F.HISTORY_TEN.entries()) {
      const row = await rowText(page, i);
      expect(row, `row ${i + 1}: its key`).toContain(e.key);
      expect(row, `row ${i + 1}: ${e.role}`).toMatch(new RegExp(`\\b${e.role}\\b`, 'i'));
      expect(row, `row ${i + 1}: ${e.on ? 'on' : 'off'}`).toMatch(e.on ? /\bon\b/i : /\boff\b/i);
      expect(row, `row ${i + 1}: when (${e.at})`).toMatch(clockRe(e.at));
    }
  });

  test('B72: with no change recorded — an instance never switched — the panel says no change has been recorded, and the history is empty [AC-5 "When no change is recorded"; ADR 0005 D3 never-switched, D12]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.NEVER_STARTED, record: F.RECORD.NEVER_SWITCHED });
    await openAndSettle(page);
    await untilText(page, 'tp-path', NO_CHANGE_RECORDED, 'no change has been recorded', 5000);
    await expect(historyRows(page), 'the history is empty').toHaveCount(0);
    const text = await textOf(page, 'tp-path');
    for (const k of KEYS) expect(text, 'no who').not.toContain(k);
    await expect(control(page, 'Turn on')).toBeVisible();
  });

  test('B73: an off the server could not record takes effect and says so; the panel then shows the path off with no who or when for that change, never an earlier "Turned on by …" as the latest, and the history recorded before it below — after a reload too [AC-4 "An off still takes effect"; AC-5 "The one exception"; ADR 0005 D3 unrecorded-off, D11, D12 switchOutcome "done-unrecorded"]', async ({ page }) => {
    const m = await mock(page);
    m.set({
      switch: () => {
        m.set({ realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.UNRECORDED_OFF });
        return F.SWITCH_ANSWER.OFF_UNRECORDED;
      },
    });
    await openAndSettle(page);
    const p = await openPrompt(page);
    await p.confirm.click();
    await expect(control(page, 'Turn on'), 'the off took effect').toBeVisible({ timeout: 10000 });
    expect(await textOf(page, 'tp-path'), 'the answer said the change could not be recorded').toMatch(NOT_RECORDED);
    for (const when of ['after the change', 'after a reload']) {
      if (when === 'after a reload') await openAndSettle(page);
      const latest = await outsideHistory(page);
      expect(latest, `${when}: the latest change says it was not recorded`).toMatch(NOT_RECORDED);
      for (const k of KEYS) expect(latest, `${when}: no who for that change`).not.toContain(k);
      expect(latest, `${when}: never an earlier "Turned on by …" as the latest change`).not.toMatch(TURNED_ON_BY);
      expect(await rowText(page, 0), `${when}: the history's first row is the off`).toMatch(/\boff\b/i);
      for (const k of KEYS) expect(await rowText(page, 0), `${when}: without who`).not.toContain(k);
      expect(await rowText(page, 1), `${when}: the history recorded before it survives`).toContain(F.OWNER_KEY);
    }
    expect(m.log.nonGet).toEqual([SWITCH_POST]);
  });

  test('B74: a record that holds the state but not who or when shows the change with "who and when were not recorded", and no who [AC-5; ADR 0005 D3 (a version 2 record without a role), D12 switchRecordView "recorded, with a null role"]', async ({ page }) => {
    await mock(page, { record: F.RECORD.NULL_ROLE });
    await openAndSettle(page);
    await untilText(page, 'tp-path', NOT_RECORDED, 'who and when were not recorded', 5000);
    const latest = await outsideHistory(page);
    expect(latest, 'the latest change says who and when were not recorded').toMatch(NOT_RECORDED);
    for (const k of KEYS) expect(latest, 'no who for it').not.toContain(k);
    expect(await rowText(page, 1), 'the recorded changes before it keep their who').toContain(F.OWNER_KEY);
  });

  test('B75: with the switch unreadable (counting as off), the record shows no latest who and still shows the stored history [AC-5; ADR 0005 D3 switch-unreadable ("the stored history is still returned"), D12 "switch-unreadable: the on/off record cannot be read"]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.SWITCH_UNREADABLE, record: F.RECORD.SWITCH_UNREADABLE });
    await openAndSettle(page);
    await expect(control(page, 'Turn on'), 'it counts as off').toBeVisible({ timeout: 5000 });
    await expect(historyRows(page), 'the stored history still shows').toHaveCount(2, { timeout: 5000 });
    expect(await rowText(page, 0)).toContain(F.OWNER_KEY);
    expect(await rowText(page, 1)).toContain(F.ADMIN_KEY);
    const latest = await outsideHistory(page);
    for (const k of KEYS) expect(latest, 'no latest who').not.toContain(k);
    expect(latest, 'the on/off record cannot be read').toMatch(SWITCH_UNREADABLE);
  });

  test('B76: with the history unreadable, the panel says the history cannot be read and still shows the latest change [AC-5; ADR 0005 D3 historyUnreadable, D12 "historyUnreadable: the history cannot be read, with the latest change still shown"]', async ({ page }) => {
    await mock(page, { record: F.RECORD.HISTORY_UNREADABLE });
    await openAndSettle(page);
    await untilText(page, 'tp-path', HISTORY_UNREADABLE, 'the history cannot be read', 5000);
    const latest = await outsideHistory(page);
    expect(latest, 'the latest change still shows its who').toContain(F.OWNER_KEY);
    expect(latest).toMatch(/\bowner\b/i);
    expect(latest).toMatch(TURNED_ON);
  });

  test('B77: a record that disagrees with the path status — its on, or its switchUnreadable — shows no who: the panel says the record is being refreshed until a read brings them into step [AC-5 "never an earlier Turned on by … as the latest change"; ADR 0005 D12 switchRecordView "only when … its on equals rtBody.on, and its switchUnreadable agrees. Otherwise it says the record is being refreshed"]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.ON_LIVE, record: F.RECORD.OFF_BY_ADMIN });
    await openAndSettle(page);
    await untilText(page, 'tp-path', RECORD_REFRESHING, 'the record is being refreshed', 5000);
    let text = await textOf(page, 'tp-path');
    for (const k of KEYS) expect(text, 'a record whose on disagrees shows no who, latest or history').not.toContain(k);
    await pauseClock(page);
    m.set({ record: F.RECORD.ON_BY_OWNER });
    await page.clock.runFor(POLL_MS);
    await expect.poll(async () => (await outsideHistory(page)).includes(F.OWNER_KEY), { message: 'once they agree, the latest change shows', timeout: 5000 }).toBe(true);
    await page.clock.resume();
    await reopenWith(page, m, { realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.SWITCH_UNREADABLE });
    await untilText(page, 'tp-path', RECORD_REFRESHING, 'a record whose switchUnreadable disagrees: being refreshed', 5000);
    text = await textOf(page, 'tp-path');
    for (const k of KEYS) expect(text, 'and no who').not.toContain(k);
  });

  test('B78: a record read that fails after a good one shows no kept who — neither the latest change nor the history — and says the record could not be read, with its code [AC-5; ADR 0005 D12 switchRecordView "it never renders a kept body\'s latest line after a failed record read", "it has its own ReadFailed"]', async ({ page }) => {
    const m = await mock(page);
    await openAndSettle(page);
    await expect.poll(async () => (await outsideHistory(page)).includes(F.OWNER_KEY), { message: 'the latest change shows — not implemented yet if missing (ADR 0005 D12)', timeout: 5000 }).toBe(true);
    await pauseClock(page);
    m.set({ record: fail(500) });
    await page.clock.runFor(POLL_MS);
    await expect.poll(async () => (await textOf(page, 'tp-path')).includes(F.OWNER_KEY), { message: 'after the failed read, no kept who', timeout: 5000 }).toBe(false);
    const text = await textOf(page, 'tp-path');
    expect(text, 'the record could not be read').toMatch(UNREADABLE);
    expect(text, 'with its code').toMatch(codeRe('http-500'));
    await expect(control(page, 'Turn off'), 'the path itself still reads on').toBeVisible();
  });

  test('B79: when a change\'s answer lands after the panel has closed, no read follows it [AC-1; ADR 0005 D12 "After an unmount, no re-read is sent"]', async ({ page }) => {
    const m = await mock(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    m.set({ switch: async (req, server) => { await gate; return server(); } });
    await openAndSettle(page);
    const p = await openPrompt(page);
    await p.confirm.click();
    let closedAt;
    try {
      await expect.poll(() => m.log.nonGet, { message: 'the change is sent' }).toEqual([SWITCH_POST]);
      await subTab(page, EXISTING_TABS[3]).click(); // close the panel: open Streaming ETL
      await expect(section(page, 'tp-path'), 'the panel is closed').toHaveCount(0);
      closedAt = m.log.api.length;
    } finally {
      release();
    }
    await wait(1500);
    const after = m.log.api.slice(closedAt).filter((l) => /\/api\/tagging-edges\//.test(l));
    expect(after, 'no read after the panel closed, though the answer came after').toEqual([]);
  });
});

/* ══ Story 6: running and stopping the pass (ADR 0006) ═══════════════════════════════════════════════════════════ */

test.describe('Running and stopping the pass on the panel (tagging-edges #6, ADR 0006)', () => {
  test.use({ timezoneId: 'UTC', locale: 'en-GB' });

  test.beforeAll(async () => { await loadView(); });

  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip(true, 'Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    if (RECORDING) test.skip(true, 'TP_RECORD_BASELINE=1: only the AC-6 baseline is recorded');
    await page.clock.install({ time: new Date(F.NOW) });
  });

  const T = F.PASS_TIMES;
  const K = F.PASS_KEYS;
  /** The sentences that claim a pass was lined up (a negated one, "nothing new was lined up", claims nothing). */
  const linedUpClaims = (text) => sentencesWith(text, /\blined up\b/i).filter((s) => !NEGATED.test(s));
  const heading = (page, name) => section(page, 'tp-pass').getByRole('heading', { name, exact: true });

  /* ── AC-1: Run a pass now ───────────────────────────────────────────────────────────────────────────────────── */

  test('B83: with nothing busy, the owner sees "Run a pass now" once the status has a body; pressing it asks nothing, sends one POST {} as JSON to the run route, and the reads that follow — with no poll — show the pass waiting since it was asked for, started by the owner and its shortened key [AC-1 "What it shows", "When nothing is busy … within 10 seconds every viewer sees it waiting"; AC-5; ADR 0006 D6, D15 sendRun, D16 busyView, passWho, D17 "Run … asks nothing", "after an answer: await the status and record re-reads"]', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const m = await mock(page, { ...F.SCENE.IDLE, status: async () => { await gate; return F.SCENE.IDLE.status; } });
    try {
      await openPanel(page);
      await expect(section(page, 'tp-pass'), 'the status read is in flight').toHaveAttribute('data-state', 'loading');
      await expect(runButton(page), 'no Run control while the status has no body (ADR 0006 D17 "It shows once the status has a body")').toHaveCount(0);
    } finally {
      release();
    }
    m.set({ status: F.SCENE.IDLE.status });
    await settled(page, 'tp-pass');
    await pauseClock(page);
    const mark = m.log.api.length;
    await pressRun(page);
    await expect(passCancel(page), 'Run asks nothing: no prompt opens (story 6 Planning: "Run asks nothing")').toHaveCount(0);
    await untilShows(page, 'tp-pass', [WAITING, clockRe(F.NOW), ...OWNER_WHO], [],
      'within 10 s, with no poll, the pass shows waiting since it was asked for (12:00), started by the owner and its shortened key (D16 busyView, passWho; D17)', 10000);
    expect(m.log.nonGet, 'exactly one request that is not a GET: Run\'s POST').toEqual([RUN_POST]);
    const sent = m.log.sent[0];
    expect(JSON.parse(sent.body || 'null'), 'its body is {} (D6: "The body is {}", D15)').toEqual({});
    expect(sent.contentType || '', 'sent as JSON (D6: 415 otherwise)').toMatch(/^application\/json\b/i);
    const reread = m.log.api.slice(mark).filter((l) => l.startsWith('GET ')).map((l) => l.split(' ')[1].split('?')[0]);
    expect(reread, 'the status is read again after the answer (D17)').toContain(F.ROUTES.status);
    expect(reread, 'and the pass record (D17)').toContain(F.ROUTES.passRecord);
  });

  test('B84: a Run while a pass is busy is refused plainly — a pass is already waiting or running, and nothing new was lined up — and the panel then shows that pass; the same for a scheduled run that has come due and is waiting (the seed backstop\'s id), shown as the schedule\'s [AC-1 "When a pass is busy" (a scheduled run whose time has come included); AC-5; ADR 0006 D5, D6 "If busy → 409 {code: \'pass-busy\', busy: items}", D16 runOutcome refused-busy, passWho "a repeat:sched: key is the schedule, at the id\'s millis"; § Seams "the seed form of the id"]', async ({ page }) => {
    test.setTimeout(90000);
    const CASES = [
      { what: 'another viewer\'s Run, waiting since 11:58', scene: F.SCENE.WAITING_ASKED, item: [WAITING, clockRe(T.waitAsked), ...OWNER_WHO] },
      { what: 'the seed backstop\'s run, come due at 11:55 and waiting', scene: F.SCENE.SEED_DUE, item: [WAITING, clockRe(T.seedDue), SCHEDULE_WHO] },
    ];
    const m = await mock(page, F.SCENE.IDLE);
    for (const [i, c] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else {
        await page.clock.resume();
        await reopenWith(page, m, F.SCENE.IDLE);
      }
      await expect(runButton(page), `${c.what}: "${RUN_LABEL}" shows — not implemented yet if missing (D17)`).toBeEnabled({ timeout: 5000 });
      expect(await textOf(page, 'tp-pass'), `${c.what}: before the press, nothing says a pass is already busy`).not.toMatch(ALREADY_BUSY);
      await pauseClock(page);
      m.set(c.scene); // the pass became busy after this panel's last read: the server refuses (F.applyRun, 409 pass-busy)
      await pressRun(page);
      await untilText(page, 'tp-pass', ALREADY_BUSY, `${c.what}: the panel says plainly that a pass is already waiting or running (D16 refused-busy)`, 10000);
      expect(await textOf(page, 'tp-pass'), `${c.what}: and that nothing new was lined up (AC-1)`).toMatch(NOTHING_LINED_UP);
      await untilShows(page, 'tp-pass', c.item, [], `${c.what}: the panel then shows the busy pass, from the reads after the answer`, 10000);
    }
    expect(m.log.nonGet, 'one POST each, never retried').toEqual([RUN_POST, RUN_POST]);
  });

  test('B85: with two passes busy the panel shows each — the owner\'s running since 11:57, and an admin\'s waiting since 11:58 behind a pass ahead of it — each with its own state, time and who, to an admin viewer [AC-1 "When more than one pass is busy, the panel shows each"; AC-2; AC-5 "for each pass it shows, who started it"; ADR 0006 D5, D12, D16 busyView, passWho "A running busy item with a run takes who from its run", D17 "The busy list"]', async ({ page }) => {
    const m = await mock(page, { who: 'admin', ...F.SCENE.TWO_BUSY });
    await openAndSettle(page);
    await untilShows(page, 'tp-pass', [RUNNING_NOW, clockRe(T.runStarted), ...OWNER_WHO], [new RegExp(esc(F.ADMIN_KEY))],
      'the owner\'s pass: running since 11:57, started by the owner — a line of its own, without the admin\'s pass — not implemented yet if missing (D16, D17)');
    await untilShows(page, 'tp-pass', [WAITING, clockRe(T.waitAsked), BEHIND_PASS, ...ADMIN_WHO], [new RegExp(esc(F.OWNER_KEY))],
      'the admin\'s pass: waiting since 11:58 behind a pass ahead of it, started by an admin — a line of its own');
    expect(m.log.nonGet, 'showing them sends nothing').toEqual([]);
  });

  test('B86: while a Run is under way the control is disabled and says so — "Lining up a pass…", with aria-busy — and when the answer comes the panel shows the pass waiting and the control is free again [AC-1 "While a Run is under way, the control is disabled and says so"; ADR 0006 D17 "while pending: disabled, aria-busy, with the text Lining up a pass…"]', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const m = await mock(page, F.SCENE.IDLE);
    m.set({ run: async (req, server) => { await gate; return server(); } });
    await openAndSettle(page);
    try {
      await pressRun(page);
      await expect.poll(() => m.log.nonGet, { message: 'pressing Run sends it' }).toEqual([RUN_POST]);
      const busy = passBusyButtons(page).first();
      await expect(busy, 'while the Run is under way, the control — the button itself — carries aria-busy="true" (D17) — not implemented yet if missing').toBeVisible({ timeout: 5000 });
      await expect(busy, 'and is disabled').toBeDisabled();
      expect(squash(await busy.innerText()), 'and says a pass is being lined up (D17 "Lining up a pass…")').toMatch(LINING_UP);
      for (const b of await runButton(page).all()) await expect(b, 'no enabled "Run a pass now" meanwhile').toBeDisabled();
    } finally {
      release();
    }
    await untilShows(page, 'tp-pass', [WAITING, clockRe(F.NOW), ...OWNER_WHO], [], 'the answer came: the pass shows waiting, the owner\'s', 10000);
    await expect(passBusyButtons(page), 'the control is no longer busy').toHaveCount(0);
    await expect(runButton(page), '"Run a pass now" is back').toBeEnabled();
    expect(m.log.nonGet, 'one Run, sent once').toEqual([RUN_POST]);
  });

  test('B87: when the server does not answer a Run within 15 s — Run, the status and the pass record all hang — the control is enabled again and the panel says the outcome is unknown; it then shows the state from its next read [AC-1 "If the server has not answered within 15 seconds"; ADR 0006 D15 "raced(15000, …)", D17 "on unknown: clear pending at once and fire the re-reads"]', async ({ page }) => {
    const m = await mock(page, F.SCENE.IDLE);
    await openAndSettle(page);
    await expect(runButton(page), `"${RUN_LABEL}" — not implemented yet if missing (D17)`).toBeEnabled({ timeout: 5000 });
    expect(await textOf(page, 'tp-pass'), 'before the press, no "outcome unknown"').not.toMatch(OUTCOME_UNKNOWN);
    await pauseClock(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    m.set({
      run: async () => { await gate; return F.RUN_ANSWER.linedUp(K.WAITING); },
      status: async () => { await gate; return F.SCENE.WAITING_ASKED.status; },
      passRecord: async () => { await gate; return F.SCENE.WAITING_ASKED.passRecord; },
    });
    try {
      await pressRun(page);
      await expect.poll(() => m.log.nonGet, { message: 'Run is sent' }).toEqual([RUN_POST]);
      await expect(passBusyButtons(page).first(), 'under way: the control is busy and disabled (D17)').toBeDisabled({ timeout: 5000 });
      await page.clock.runFor(15000);
      await expect(runButton(page), 'after 15 s with no answer, "Run a pass now" is enabled again').toBeEnabled({ timeout: 5000 });
      await expect(passBusyButtons(page), 'and is no longer busy').toHaveCount(0);
      await untilText(page, 'tp-pass', OUTCOME_UNKNOWN, 'and the panel says the outcome is unknown (D16 "unknown (timeout, network or bad-json)")', 5000);
    } finally {
      release();
    }
    await untilShows(page, 'tp-pass', [WAITING, clockRe(T.waitAsked)], [], 'it then shows the state from its next read: the pass waiting', 10000);
    expect(m.log.nonGet, 'Run was sent once and never retried').toEqual([RUN_POST]);
  });

  test('B88: when the owner\'s confirmation of held removals is pending, the pass section says beside "Run a pass now" that the next pass to get past its start checks takes it up; it says nothing of the kind with no confirmation, or an expired one [AC-1 "When the owner\'s confirmation of held removals is pending"; ADR 0006 D17 "The pending-confirmation line … HeldSection\'s ConfirmationLine is unchanged"]', async ({ page }) => {
    test.setTimeout(90000);
    const m = await mock(page, F.SCENE.IDLE_PENDING);
    await openAndSettle(page);
    await expect(runButton(page), `"${RUN_LABEL}" shows — not implemented yet if missing (D17)`).toBeVisible({ timeout: 5000 });
    expect(NEXT_PASS_TAKES_UP(await textOf(page, 'tp-pass')).length,
      'a confirmation pending: a line in the pass section, beside Run, says the next pass to get past its start checks takes it up (D17: "The owner\'s confirmation is pending. The next pass to get past its start checks takes it up.")').toBeGreaterThan(0);
    for (const [scene, why] of [[F.SCENE.IDLE, 'no confirmation'], [F.SCENE.IDLE_EXPIRED, 'an expired confirmation']]) {
      await reopenWith(page, m, scene);
      await expect(runButton(page), `${why}: Run shows`).toBeVisible({ timeout: 5000 });
      expect(NEXT_PASS_TAKES_UP(await textOf(page, 'tp-pass')), `${why}: no such line (D17: only when passView.confirmation.state is 'pending')`).toEqual([]);
    }
    expect(m.log.nonGet).toEqual([]);
  });

  test('B89: with no pass in the report and none busy, the empty pass section keeps "No pass has run yet" and shows "Run a pass now"; pressing it lines up the first pass, which shows waiting while the section stays empty and still says no pass has run yet [AC-1; ADR 0006 D17 "in both the empty-report branch (after the No pass has run yet lines; data-state stays empty) and the ready branch", D19; § Seams "New cases the review named": "A first pass waits, and Run is pressed, with no report yet"]', async ({ page }) => {
    const m = await mock(page, F.SCENE.FIRST_IDLE);
    await openAndSettle(page);
    const pass = section(page, 'tp-pass');
    await expect(pass, 'no report yet: the section is empty').toHaveAttribute('data-state', 'empty');
    expect(await textOf(page, 'tp-pass'), 'no pass has run yet').toMatch(NO_PASS_YET);
    await pauseClock(page);
    await pressRun(page);
    await untilShows(page, 'tp-pass', [WAITING, clockRe(F.NOW), ...OWNER_WHO], [], 'the first pass shows waiting, the owner\'s', 10000);
    await expect(pass, 'the section stays empty: still no report (D17; PS12)').toHaveAttribute('data-state', 'empty');
    expect(await textOf(page, 'tp-pass'), 'and still says no pass has run yet').toMatch(NO_PASS_YET);
    await expect(runButton(page), 'the controls stay in the empty branch').toBeVisible();
    expect(m.log.nonGet).toEqual([RUN_POST]);
  });

  /* ── AC-2: waiting and stopping, seen by every viewer ──────────────────────────────────────────────────────── */

  test('B90: a pass waiting — asked for with nothing ahead, behind other heavy database work, or behind a pass ahead of it — is shown with since when to a viewer who did not press, within POLL_MS, and a reload keeps it; that viewer sends nothing [AC-2 "What the server reports, for each busy pass", "Every viewer sees the same, whoever pressed, and a reload keeps it"; ADR 0006 D5, D12, D16 busyView "waiting since <time>, behind a pass ahead or other heavy database work"]', async ({ page }) => {
    test.setTimeout(150000);
    const CASES = [
      { what: 'asked for, nothing ahead of it', scene: F.SCENE.WAITING_ASKED, must: [WAITING, clockRe(T.waitAsked)], lacks: [BEHIND_HEAVY, BEHIND_PASS] },
      { what: 'behind other heavy database work', scene: F.SCENE.WAITING_HEAVY, must: [WAITING, clockRe(T.heavySince), BEHIND_HEAVY], lacks: [BEHIND_PASS] },
      { what: 'behind a pass ahead of it', scene: F.SCENE.TWO_BUSY, must: [WAITING, clockRe(T.waitAsked), BEHIND_PASS], lacks: [BEHIND_HEAVY] },
    ];
    const m = await mock(page, F.SCENE.IDLE);
    for (const [i, c] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else {
        await page.clock.resume();
        await reopenWith(page, m, F.SCENE.IDLE);
      }
      expect(await shows(page, 'tp-pass', c.must, c.lacks), `${c.what}: not shown before it is busy`).toBe(false);
      await pauseClock(page);
      m.set(c.scene); // another viewer pressed Run, or the heavy-task lock is held: this viewer pressed nothing
      await page.clock.runFor(POLL_MS);
      await untilShows(page, 'tp-pass', c.must, c.lacks, `${c.what}: within POLL_MS this viewer sees it waiting, and since when — not implemented yet if missing (D16 busyView)`, 3000);
      await page.clock.resume();
      await openAndSettle(page); // a reload
      await untilShows(page, 'tp-pass', c.must, c.lacks, `${c.what}: after a reload, still shown`, 5000);
    }
    expect(m.log.nonGet, 'a viewer who did not press sends nothing').toEqual([]);
  });

  test('B91: a stop asked for — the owner\'s running pass, a stop asked for at 11:59 by an admin — is shown with since when and who asked to a viewer who did not press, within POLL_MS, and a reload keeps it; the pass still shows running, and with every busy pass asked to stop "Stop" is not shown [AC-2 "whether a stop has been asked for it, and since when"; AC-3 "What it shows … Otherwise it is not shown", "No force-stop"; AC-5 "who asked it to stop"; ADR 0006 D12, D16 busyView canStop, "a stop was asked for at <time>", passWho]', async ({ page }) => {
    const m = await mock(page, F.SCENE.RUNNING);
    await openAndSettle(page);
    await expect(stopButton(page), 'the pass running, no stop asked for: "Stop" shows (D16 canStop) — not implemented yet if missing').toBeVisible({ timeout: 5000 });
    await pauseClock(page);
    m.set(F.SCENE.STOP_ASKED);
    await page.clock.runFor(POLL_MS);
    const must = [STOP_ASKED, clockRe(T.stopAsked), ...ADMIN_WHO];
    await untilShows(page, 'tp-pass', must, [], 'within POLL_MS: a stop was asked for at 11:59, by an admin', 3000);
    await expect(stopButton(page), 'every busy pass has a stop asked for: "Stop" is not shown').toHaveCount(0);
    await untilShows(page, 'tp-pass', [RUNNING_NOW, clockRe(T.runStarted)], [], 'and the pass still shows running until it ends');
    await page.clock.resume();
    await openAndSettle(page); // a reload
    await untilShows(page, 'tp-pass', must, [], 'after a reload, still shown', 5000);
    await expect(stopButton(page), 'and still no "Stop"').toHaveCount(0);
    expect(m.log.nonGet, 'a viewer who did not press sends nothing').toEqual([]);
  });

  test('B92: when the server cannot tell whether a pass is waiting — its queue read failed, the queue is not ready or off, or the status carries no control member at all — the panel says so, never that nothing is waiting; a live pass still shows running beside it [AC-2 "When the server cannot tell whether a pass is waiting, every viewer is told so. It is never shown as nothing waiting"; ADR 0006 D5 "When queue !== \'ok\', only the liveness item is known, and the panel says it cannot tell whether a pass is waiting", D12, D16 "An absent control reads as not known"; R5]', async ({ page }) => {
    test.setTimeout(150000);
    const idle = F.STATUS.HELD_NONE;
    const CASES = [
      { what: 'the queue read failed', status: F.withControl(idle, F.controlBody({ queue: 'read-failed' })) },
      { what: 'the queue is not ready', status: F.withControl(idle, F.controlBody({ queue: 'not-ready' })) },
      { what: 'the task queue is off', status: F.withControl(idle, F.controlBody({ queue: 'off' })) },
      { what: 'the status carries no control member', status: idle },
      { what: 'the queue read failed while a pass is alive', status: F.withControl(F.SCENE.RUNNING.status, F.controlBody({ queue: 'read-failed', busy: [F.ITEM.RUNNING] })), running: true },
    ];
    const m = await mock(page, F.SCENE.IDLE);
    await openAndSettle(page);
    await expect(runButton(page), 'the controls show (D17) — not implemented yet if missing').toBeVisible({ timeout: 5000 });
    expect(await textOf(page, 'tp-pass'), 'the queue read ok and nothing busy: no "cannot tell"').not.toMatch(CANNOT_TELL);
    for (const c of CASES) {
      await reopenWith(page, m, { status: c.status, passRecord: c.running ? F.SCENE.RUNNING.passRecord : F.PASS_RECORD.EMPTY });
      await untilText(page, 'tp-pass', CANNOT_TELL, `${c.what}: the panel says the server cannot tell whether a pass is waiting`, 5000);
      expect(await textOf(page, 'tp-pass'), `${c.what}: never that nothing is waiting`).not.toMatch(NOTHING_WAITING);
      if (c.running) await untilShows(page, 'tp-pass', [RUNNING_NOW, clockRe(T.runStarted)], [], `${c.what}: the live pass still shows running ("Liveness comes first", D5)`);
    }
    expect(m.log.nonGet).toEqual([]);
  });

  test('B93: a waiting pass that gave up after 4 hours behind other heavy database work no longer shows as waiting; the panel says it gave up waiting and never began running, the latest pass is unchanged (it left no report), and the history keeps its start, saying it gave up; the gave-up line still shows while a due scheduled run waits on, which shows as the schedule\'s [AC-2 "A waiting pass that gives up"; ADR 0006 D12 gaveUp, D17 "A gave-up line shows from control.gaveUp", D18 "A start whose entry has gaveUpAt says it gave up waiting and never began running"; § Seams "New cases the review named": "A pass gives up while a due scheduled run waits behind it, and the gave-up line still shows"]', async ({ page }) => {
    const GAVE_UP = /\b(?:gave|given) up\b/i;
    const m = await mock(page, F.SCENE.GAVE_UP);
    await openAndSettle(page);
    await untilText(page, 'tp-pass', GAVE_UP_WAITING, 'the panel says the pass gave up waiting (D17 gave-up line) — not implemented yet if missing', 5000);
    const text = await textOf(page, 'tp-pass');
    expect(text, 'and that it never began running').toMatch(NEVER_BEGAN);
    expect(await shows(page, 'tp-pass', [WAITING, clockRe(T.gaveUpAsked)], [GAVE_UP]), 'it is no longer shown as waiting').toBe(false);
    expect(text, 'it left no pass report: the latest pass is still the one before it').toContain(F.HELD_RECORD.runId);
    await untilShows(page, 'tp-pass', [START_WORD, clockRe(T.gaveUpAsked), ...OWNER_WHO, GAVE_UP], [], 'the history keeps its start (the owner\'s, at 07:54) and says it gave up waiting (D18)');
    await reopenWith(page, m, F.SCENE.GAVE_UP_SEED_WAITING);
    await untilText(page, 'tp-pass', GAVE_UP_WAITING, 'with the seed backstop\'s due run waiting on, the gave-up line still shows', 5000);
    await untilShows(page, 'tp-pass', [WAITING, clockRe(T.seedDue), SCHEDULE_WHO], [], 'and the due run shows waiting since 11:55, the schedule\'s (D16 passWho)');
    expect(m.log.nonGet).toEqual([]);
  });

  /* ── AC-3: Stop ────────────────────────────────────────────────────────────────────────────────────────────── */

  // Revised for story 7 (story § Test tasks "The no-Confirm pins … still refuse the name on every other button, Run,
  // Stop and Stop's prompt included"; ADR 0007 § Seams "Revised pins"): the held section's Confirm may now show beside
  // a waiting pass (D9), and is the only button named for confirming; the pass section and the Stop prompt have none.
  test('B94: "Stop" shows only while some busy pass has no stop asked for; for a waiting pass its prompt — inside the pass section, with a heading, focus on Cancel and one "Stop the pass" — says the pass is taken out of line before it begins running, so it writes nothing, and that no schedule entry changes; no button but the held section\'s Confirm is named "confirm" — not Run, Stop, nor the Stop prompt\'s; opening and cancelling it sends nothing [AC-3 "What it shows", "A prompt comes first … for a waiting pass"; ADR 0006 D16 canStop, stopPromptView, D17 "Stop … opens an inline prompt", "No button name may match /confirm/i", as revised by ADR 0007 § Seams]', async ({ page }) => {
    const m = await mock(page, F.SCENE.IDLE);
    await openAndSettle(page);
    await expect(runButton(page), 'the controls show — not implemented yet if missing (D17)').toBeVisible({ timeout: 5000 });
    await expect(stopButton(page), 'nothing busy: no "Stop" (it never applies to the backstop\'s next scheduled run, whose time has not come)').toHaveCount(0);
    await reopenWith(page, m, F.SCENE.WAITING_ASKED);
    const p = await openStopPrompt(page);
    await expect(p.cancel, 'focus moves to Cancel when the prompt opens (D17)').toBeFocused();
    await expect(p.confirm, 'one pass: its button reads "Stop the pass" (D17)').toHaveText(/^\s*Stop the pass\s*$/);
    await expect(p.prompt.getByRole('button', { name: /confirm/i }), 'the Stop prompt has no button named "confirm" (B10; D17)').toHaveCount(0);
    await expect(section(page, 'tp-pass').getByRole('button', { name: /confirm/i }), 'nor has the pass section: not Run, not Stop (B10; D17)').toHaveCount(0);
    expect(await refusedConfirmButtons(page), 'no button on the page is named for confirming but the held section\'s Confirm and its prompt\'s (story 7 § Test tasks "The no-Confirm pins"; ADR 0007 § Seams)').toEqual([]);
    const text = await p.text();
    expect(text, 'the pass is taken out of line').toMatch(TAKEN_OUT);
    expect(text, 'before it begins running').toMatch(BEFORE_RUNNING);
    expect(text, 'so it writes nothing').toMatch(WRITES_NOTHING);
    expect(text, 'and no schedule entry changes').toMatch(NO_SCHEDULE_CHANGE);
    expect(text, 'not a running pass\'s text (no safe point)').not.toMatch(SAFE_POINT);
    expect(confirmationWarning(text), 'no confirmation involved: no warning').toEqual([]);
    await p.cancel.click();
    expect(m.log.nonGet, 'opening and cancelling the prompt sends nothing').toEqual([]);
  });

  test('B95: for a running pass the prompt says it stops at its next safe point, usually within seconds, several minutes when the graph or the relay is slow, at worst its 30-minute time-out; that everything it wrote before then stands and the next pass finishes the rest; and that no schedule entry changes [AC-3 "A prompt comes first … for a running pass"; ADR 0006 D16 stopPromptView "a running item"]', async ({ page }) => {
    const m = await mock(page, F.SCENE.RUNNING);
    await openAndSettle(page);
    const p = await openStopPrompt(page);
    await expect(p.confirm, 'one pass: "Stop the pass"').toHaveText(/^\s*Stop the pass\s*$/);
    const text = await p.text();
    expect(text, 'it stops at its next safe point').toMatch(SAFE_POINT);
    expect(text, 'usually within seconds').toMatch(SECONDS);
    expect(MINUTES_WHEN_SLOW(text).length, 'when the graph or the relay is slow it can take several minutes').toBeGreaterThan(0);
    expect(TIMEOUT_30(text).length, 'at worst it runs until its 30-minute time-out').toBeGreaterThan(0);
    expect(text, 'everything it wrote before then stands').toMatch(WROTE_STANDS);
    expect(text, 'and the next pass finishes the rest').toMatch(NEXT_PASS_FINISHES);
    expect(text, 'no schedule entry changes').toMatch(NO_SCHEDULE_CHANGE);
    expect(text, 'not a waiting pass\'s text').not.toMatch(TAKEN_OUT);
    expect(confirmationWarning(text), 'no confirmation involved: no warning').toEqual([]);
    await p.cancel.click();
    expect(m.log.nonGet).toEqual([]);
  });

  test('B96: with two passes busy the prompt says what happens to each — the running one stops at its next safe point, the waiting one is taken out of line before it begins running — and its button reads "Stop the passes" [AC-3 "When more than one pass is busy, it says what happens to each"; ADR 0006 D16 stopPromptView "each item\'s block", D17 "Stop the passes for more than one"]', async ({ page }) => {
    const m = await mock(page, F.SCENE.TWO_BUSY);
    await openAndSettle(page);
    const p = await openStopPrompt(page);
    await expect(p.confirm, 'two passes: its button reads "Stop the passes" (D17)').toHaveText(/^\s*Stop the passes\s*$/);
    const text = await p.text();
    expect(text, 'the running pass: its next safe point').toMatch(SAFE_POINT);
    expect(text, 'and what it wrote stands').toMatch(WROTE_STANDS);
    expect(text, 'the waiting pass: taken out of line').toMatch(TAKEN_OUT);
    expect(text, 'before it begins running').toMatch(BEFORE_RUNNING);
    expect(text, 'no schedule entry changes').toMatch(NO_SCHEDULE_CHANGE);
    await p.cancel.click();
    expect(m.log.nonGet).toEqual([]);
  });

  test('B97: the prompt warns, when the running pass has taken up the owner\'s confirmation or the panel cannot yet tell whether it has, that stopping uses it up and the owner must confirm again after a later pass holds those removals again; for a waiting pass with the confirmation pending it says instead that the confirmation stays pending for the next pass [AC-3 "about the owner\'s confirmation of held removals"; AC-4 "Either may act on the other\'s pass … after the prompt\'s warning"; ADR 0006 D12 confirmation, D16 stopPromptView "the warning", "the stays pending line"]', async ({ page }) => {
    test.setTimeout(120000);
    const CASES = [
      { what: 'the running pass has taken it up', scene: F.SCENE.CONFIRM_TAKEN_UP, warns: true },
      { what: 'the panel cannot yet tell whether it has', scene: F.SCENE.CONFIRM_CANNOT_TELL, warns: true },
      { what: 'a waiting pass, the confirmation pending', scene: F.SCENE.WAITING_WITH_PENDING, warns: false },
    ];
    const m = await mock(page, { who: 'admin', ...CASES[0].scene });
    for (const [i, c] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reopenWith(page, m, c.scene);
      const p = await openStopPrompt(page);
      const text = await p.text();
      if (c.warns) {
        expect(confirmationWarning(text).length, `${c.what}: the prompt warns that stopping uses up the owner's confirmation`).toBeGreaterThan(0);
        expect(text, `${c.what}: that the owner must confirm again`).toMatch(CONFIRM_AGAIN);
        expect(text, `${c.what}: after a later pass holds those removals again`).toMatch(LATER_HOLDS);
      } else {
        expect(text, `${c.what}: the confirmation stays pending for the next pass`).toMatch(STAYS_PENDING);
        expect(confirmationWarning(text), `${c.what}: and no warning that it is used up`).toEqual([]);
      }
      await p.cancel.click();
    }
    expect(m.log.nonGet, 'opening and cancelling sends nothing').toEqual([]);
  });

  test('B98: Cancel closes the prompt and sends nothing: "Stop" is back and the pass still waits [AC-3 "Cancelling the prompt sends nothing and changes nothing"; ADR 0006 D17]', async ({ page }) => {
    const m = await mock(page, F.SCENE.WAITING_ASKED);
    await openAndSettle(page);
    const p = await openStopPrompt(page);
    await p.cancel.click();
    await expect(passCancel(page), 'the prompt is closed').toHaveCount(0, { timeout: 5000 });
    await expect(stopButton(page), '"Stop" is back').toBeEnabled();
    await wait(1000);
    expect(m.log.nonGet, 'Cancel sends nothing').toEqual([]);
    await untilShows(page, 'tp-pass', [WAITING, clockRe(T.waitAsked)], [], 'and changes nothing: the pass still waits');
  });

  test('B99: confirming a stop of a waiting pass — an admin stopping the owner\'s — sends one POST {"targets":[{key, state:"waiting"}]} as JSON; while under way the prompt stays open, its button disabled, aria-busy and "Stopping…"; on the answer the prompt closes and, with no poll, the pass is gone from the line within 10 s, the latest pass and its held list as they were, the confirmation still pending, and the record shows the admin\'s stop [AC-3 "Confirming a stop of a waiting pass", "While a stop is under way"; AC-4 "Either may act on the other\'s pass"; AC-5; ADR 0006 D9, D15 sendStop, D17 "the prompt stays open with that button disabled, aria-busy and Stopping…", "sendStop(snapshot.map(({key, state}) => ({key, state})))"]', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const m = await mock(page, { who: 'admin', ...F.SCENE.WAITING_WITH_PENDING });
    m.set({ stop: async (req, server) => { await gate; return server(); } });
    await openAndSettle(page);
    await untilShows(page, 'tp-pass', [WAITING, clockRe(T.waitAsked), ...OWNER_WHO], [], 'the owner\'s pass waits, since 11:58 — not implemented yet if missing (D16, D17)');
    const p = await openStopPrompt(page);
    await pauseClock(page);
    try {
      await p.confirm.click();
      await expect.poll(() => m.log.nonGet, { message: 'confirming sends the stop' }).toEqual([STOP_POST]);
      const busy = passBusyButtons(page).first();
      await expect(busy, 'while the stop is under way the prompt\'s button carries aria-busy="true" (D17)').toBeVisible({ timeout: 5000 });
      await expect(busy, 'and is disabled').toBeDisabled();
      expect(squash(await busy.innerText()), 'and says "Stopping…" (D17)').toMatch(STOPPING);
      await expect(heading(page, p.heading), 'the prompt stays open while the stop is under way (AC-3; D17: unlike story 5\'s switch, on purpose)').toBeVisible();
    } finally {
      release();
    }
    await expect(heading(page, p.heading), 'on the answer the prompt closes').toHaveCount(0, { timeout: 10000 });
    await expect.poll(() => shows(page, 'tp-pass', [WAITING, clockRe(T.waitAsked)], [TAKEN_OUT]), { message: 'within 10 s, with no poll, the pass is gone from the line (AC-3)', timeout: 10000 }).toBe(false);
    const sent = m.log.sent[0];
    expect(JSON.parse(sent.body || 'null'), 'its body names the prompt\'s pass and the state the prompt showed (D9, D17)').toEqual({ targets: [{ key: K.WAITING, state: 'waiting' }] });
    expect(sent.contentType || '', 'sent as JSON').toMatch(/^application\/json\b/i);
    expect(await textOf(page, 'tp-pass'), 'it left no pass report: the latest pass is as it was').toContain(F.HELD_RECORD.runId);
    const held = await textOf(page, 'tp-held');
    expect(held, 'its held list as it was').toMatch(numRe(F.HELD_TOTAL));
    expect(held, 'and the owner\'s confirmation still pending').toMatch(PENDING);
    await untilShows(page, 'tp-pass', [/\bstop\w*\b/i, clockRe(F.NOW), ...ADMIN_WHO], [], 'the record shows the admin\'s stop, at 12:00 (AC-5)');
    expect(m.log.nonGet, 'one stop, sent once').toEqual([STOP_POST]);
  });

  test('B100: when the server does not answer a stop within 15 s — the stop, the status and the pass record all hang — the prompt closes and the panel says the outcome is unknown; it then shows the state from its next read [AC-3 "If the server has not answered within 15 seconds, the prompt closes, the panel says the outcome is unknown"; ADR 0006 D15, D17 "On unknown, it clears at once, fires the re-reads"]', async ({ page }) => {
    const m = await mock(page, F.SCENE.WAITING_ASKED);
    await openAndSettle(page);
    await untilShows(page, 'tp-pass', [WAITING, clockRe(T.waitAsked)], [], 'the pass waits — not implemented yet if missing (D16, D17)');
    expect(await textOf(page, 'tp-pass'), 'before the stop, no "outcome unknown"').not.toMatch(OUTCOME_UNKNOWN);
    const p = await openStopPrompt(page);
    await pauseClock(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    m.set({
      stop: async () => { await gate; return F.STOP_ANSWER.stopped([{ key: K.WAITING, how: 'taken-out-of-line' }]); },
      status: async () => { await gate; return F.SCENE.IDLE.status; },
      passRecord: async () => { await gate; return F.foldPassRecord(F.SCENE.WAITING_ASKED.passRecord, { action: 'stop', key: K.WAITING, at: F.NOW, who: F.ACTOR.owner }); },
    });
    try {
      await p.confirm.click();
      await expect.poll(() => m.log.nonGet, { message: 'the stop is sent' }).toEqual([STOP_POST]);
      await expect(passBusyButtons(page).first(), 'under way (D17)').toBeDisabled({ timeout: 5000 });
      await page.clock.runFor(15000);
      await expect(passCancel(page), 'after 15 s with no answer, the prompt closes').toHaveCount(0, { timeout: 5000 });
      await expect(passBusyButtons(page), 'and nothing is busy').toHaveCount(0);
      await untilText(page, 'tp-pass', OUTCOME_UNKNOWN, 'and the panel says the outcome is unknown', 5000);
    } finally {
      release();
    }
    await expect.poll(() => shows(page, 'tp-pass', [WAITING, clockRe(T.waitAsked)], [TAKEN_OUT]), { message: 'it then shows the state from its next read: the pass gone from the line', timeout: 10000 }).toBe(false);
    expect(m.log.nonGet, 'the stop was sent once and never retried').toEqual([STOP_POST]);
  });

  test('B101: a stop whose prompt is out of date — the waiting pass began running after the prompt opened — is refused plainly and changes nothing; the panel then shows the new state, and "Stop" can be pressed again, its prompt now a running pass\'s [AC-3 "What it acts on … If what is busy has changed since the prompt opened … the stop is refused plainly and changes nothing. The panel then shows the new state, so the viewer can press Stop again"; ADR 0006 D9 409 prompt-out-of-date, D16 stopOutcome refused-stale, D17 "It never rewrites its text from later polls"]', async ({ page }) => {
    const m = await mock(page, F.SCENE.WAITING_ASKED);
    await openAndSettle(page);
    await pauseClock(page);
    const p = await openStopPrompt(page);
    expect(await p.text(), 'the prompt says what it shows: a waiting pass, taken out of line').toMatch(TAKEN_OUT);
    m.set(F.SCENE.WAITING_NOW_RUNNING); // the pass began running since the prompt opened (no poll has shown it)
    await p.confirm.click();
    await untilText(page, 'tp-pass', STALE_PROMPT, 'the stop is refused plainly: what is busy changed since the prompt opened (D16 refused-stale)', 10000);
    expect(await textOf(page, 'tp-pass'), 'and nothing changed').toMatch(NOTHING_CHANGED);
    await untilShows(page, 'tp-pass', [RUNNING_NOW, clockRe(F.ITEM.WAITING_NOW_RUNNING.since)], [STOP_ASKED], 'the panel then shows the new state: the pass running since 11:59, no stop asked for', 10000);
    const again = await openStopPrompt(page);
    expect(await again.text(), '"Stop" can be pressed again, and its prompt now says what happens to a running pass').toMatch(SAFE_POINT);
    await again.cancel.click();
    expect(m.log.nonGet, 'one stop sent and refused; nothing retried').toEqual([STOP_POST]);
  });

  test('B102: an admin confirms a stop of the owner\'s running pass: one POST with {key, state:"running"}; the panel then shows a stop asked for, at its time and by whom, with the pass still running until it ends and no "Stop"; when the pass stops at a safe point it shows its own outcome, stopped and its reason explained, "stopped on request by" the admin "at" the time the stop was asked for, never "failed", and who started it [AC-3 "Confirming a stop of a running pass", "No force-stop"; AC-4 "Either may act on the other\'s pass"; AC-5; ADR 0006 D9, D10 stopped/requested, D16 "EXPLANATIONS.passOutcome.stopped and passReason.requested", D18; § Seams "New cases the review named": listed as running with stopAskedAt until it ends]', async ({ page }) => {
    const m = await mock(page, { who: 'admin', ...F.SCENE.RUNNING });
    await openAndSettle(page);
    const p = await openStopPrompt(page);
    expect(await p.text(), 'the prompt is a running pass\'s').toMatch(SAFE_POINT);
    await pauseClock(page);
    await p.confirm.click();
    await untilShows(page, 'tp-pass', [STOP_ASKED, clockRe(F.NOW), ...ADMIN_WHO], [], 'with no poll, a stop asked for at 12:00, by the admin', 10000);
    expect(JSON.parse(m.log.sent[0].body || 'null'), 'its body names the running pass').toEqual({ targets: [{ key: K.RUNNING, state: 'running' }] });
    await untilShows(page, 'tp-pass', [RUNNING_NOW, clockRe(T.runStarted)], [], 'the pass still shows running until it ends (no force-stop)');
    await expect(stopButton(page), 'every busy pass has a stop asked for: no "Stop"').toHaveCount(0);
    // The pass reaches a safe point and ends: its report reads stopped, and nothing is busy.
    m.set(F.SCENE.STOPPED_BY_ADMIN);
    await page.clock.runFor(POLL_MS);
    await untilText(page, 'tp-pass', STOPPED_ON_REQUEST, 'the stopped pass shows "stopped on request" (D18)', 5000);
    const text = await textOf(page, 'tp-pass');
    expect(text, 'its outcome code, stopped').toMatch(codeRe('stopped'));
    expect(text, 'the stopped outcome explained (D16 EXPLANATIONS.passOutcome.stopped)').toContain(explanation('passOutcome', 'stopped'));
    expect(text, 'and its reason (D16 passReason.requested)').toContain(explanation('passReason', 'requested'));
    expect(text, 'never as failed').not.toContain(explanation('passOutcome', 'failed'));
    await untilShows(page, 'tp-pass', [STOPPED_ON_REQUEST, clockRe(F.NOW), ...ADMIN_WHO], [], '"stopped on request by" the admin "at" 12:00, the time the stop was asked for (D18)');
    await untilShows(page, 'tp-pass', [START_WORD, clockRe(T.runAsked), ...OWNER_WHO], [], 'and who started it: the owner, at 11:56');
    expect(m.log.nonGet).toEqual([STOP_POST]);
  });

  test('B103: a stopped run whose start was not recorded shows "start not recorded" and still "stopped on request by" its stopper "at" its time; so does a stopped hand run, which has no job id; a pass stopped by a signal no one recorded reads "stopped on request" with who and when not recorded, and no who [AC-3; AC-5 "When the server cannot record an action", "Before story 6"; ADR 0006 D9 (a run: key), D16 passWho "A run\'s stop … under any key", D18 "or stopped on request (who and when not recorded)"; R6; § Seams "New cases the review named"]', async ({ page }) => {
    const CASES = [
      ['a run whose start was not recorded', F.STOP_CASES.UNRECORDED_START],
      ['a hand run, with no job id', F.STOP_CASES.HAND_RUN],
    ];
    const m = await mock(page, CASES[0][1]);
    for (const [i, [what, scene]] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reopenWith(page, m, scene);
      await untilShows(page, 'tp-pass', [STOPPED_ON_REQUEST, clockRe(F.STOP_CASE_TIMES.stopAsked), ...ADMIN_WHO], [], `${what}: stopped on request by an admin at 11:53`);
      await untilText(page, 'tp-pass', START_NOT_RECORDED, `${what}: its start reads not recorded`);
    }
    await reopenWith(page, m, F.STOP_CASES.NO_ENTRY);
    await untilText(page, 'tp-pass', STOPPED_ON_REQUEST, 'a signal no one recorded: "stopped on request"', 5000);
    const text = await textOf(page, 'tp-pass');
    expect(sentencesWith(text, STOPPED_ON_REQUEST, NOT_RECORDED).length, 'with who and when not recorded (D18)').toBeGreaterThan(0);
    for (const k of KEYS) expect(text, 'and no who').not.toContain(k);
    expect(m.log.nonGet).toEqual([]);
  });

  test('B104: a stop that came too late keeps the pass\'s own outcome — for a pass that finished before its next safe point the panel says the stop came too late to take effect, and the latest pass, done, says a stop was asked for at its time by whom, but the pass ended first; for a pass asked to stop and then ended by its time-out, a deploy or a restart (its pessimistic record left as the latest: failed, reason stopped, no end, nothing busy), the latest pass says the same, its own outcome explained, never "stopped on request" [AC-3 "A stop that comes too late … it finishes, is refused, fails, hits its time-out, or is ended by a deploy or a restart. Its outcome is then what it was"; ADR 0006 D9 how \'too-late\', step 4 "If the pass has ended by then … the stop came too late", D16 stopOutcome, D18 "a stop was asked for at <time> by <who>, but the pass ended first"; Test Design review COV-3]', async ({ page }) => {
    const m = await mock(page, F.SCENE.RUNNING);
    await openAndSettle(page);
    const p = await openStopPrompt(page);
    await pauseClock(page);
    m.set({
      stop: () => {
        // The pass finished first: the server records the stop and sends no signal (D9 step 4, "too-late").
        m.set({
          status: F.withControl(F.statusBody({ latest: F.TOO_LATE_DONE_RECORD, previous: [F.LATEST_DONE] }), F.controlBody()),
          passRecord: F.foldPassRecord(F.SCENE.RUNNING.passRecord, { action: 'stop', key: K.RUNNING, at: F.NOW, who: F.ACTOR.owner, runId: F.RUNNING6_RECORD.runId, state: 'running' }),
        });
        return F.STOP_ANSWER.stopped([{ key: K.RUNNING, how: 'too-late' }]);
      },
    });
    await p.confirm.click();
    await untilText(page, 'tp-pass', TOO_LATE, 'the panel says the stop came too late to take effect', 10000);
    const text = await textOf(page, 'tp-pass');
    expect(text, 'the pass\'s own outcome stands: done, explained').toContain(explanation('passOutcome', 'done'));
    expect(text, 'never "stopped on request"').not.toMatch(STOPPED_ON_REQUEST);
    await untilShows(page, 'tp-pass', [STOP_ASKED, clockRe(F.NOW), ...OWNER_WHO, ENDED_FIRST], [], 'the latest pass says a stop was asked for at 12:00 by the owner, but the pass ended first (D18)');
    expect(m.log.nonGet).toEqual([STOP_POST]);

    // The killed twin: an admin asks the owner's running pass to stop, and it is then ended by its time-out, a deploy or
    // a restart before its next safe point. Its pessimistic record (failed, reason stopped, stopped: true, no end) is
    // left as the latest, no longer alive — the case most easily misread as stopped on request.
    await page.clock.resume();
    await reopenWith(page, m, { who: 'admin', ...F.SCENE.RUNNING, stop: undefined });
    const asked = await openStopPrompt(page);
    expect(await asked.text(), 'the killed twin: the prompt is a running pass\'s').toMatch(SAFE_POINT);
    await pauseClock(page);
    await asked.confirm.click();
    await untilShows(page, 'tp-pass', [STOP_ASKED, clockRe(F.NOW), ...ADMIN_WHO], [], 'the killed twin: the server asks the pass to stop (D9 asked-to-stop), and with no poll the panel shows a stop asked for at 12:00 by the admin', 10000);
    m.set(F.SCENE.KILLED_AFTER_STOP);
    await page.clock.runFor(POLL_MS);
    await untilShows(page, 'tp-pass', [STOP_ASKED, clockRe(F.NOW), ...ADMIN_WHO, ENDED_FIRST], [], 'the killed twin: the next read shows the pass ended another way, and the latest pass says a stop was asked for at 12:00 by the admin, but the pass ended first (D18)', 10000);
    const killed = await textOf(page, 'tp-pass');
    expect(killed, 'the killed pass\'s own outcome stands: failed, explained').toContain(explanation('passOutcome', 'failed'));
    expect(killed, 'with its own reason: it never recorded its end (a time-out, a restart or a deploy), explained').toContain(explanation('passReason', 'stopped'));
    expect(killed, 'never "stopped on request": its record says stopped: true and reason stopped, but no stop reached a safe point').not.toMatch(STOPPED_ON_REQUEST);
    await expect(stopButton(page), 'nothing is busy: no "Stop"').toHaveCount(0);
    expect(m.log.nonGet, 'one stop in each case, each sent once').toEqual([STOP_POST, STOP_POST]);
  });

  /* ── AC-3: the prompt while reads land (Test Design review COV-4) ──────────────────────────────────────────────── */

  test('B114: a poll that lands while the Stop prompt is open never rewrites it — the owner\'s waiting pass has begun running and an admin\'s Run has lined up behind it, yet the prompt still says what happens to the one waiting pass it opened on, never a running pass\'s safe point, and its button still reads "Stop the pass"; confirming sends only what the prompt showed, and the server refuses it as out of date [AC-3 "What it acts on … never does more than its prompt said. If what is busy has changed since the prompt opened … the stop is refused plainly"; ADR 0006 D17 "The snapshot … taken when the prompt opens. stopPromptView, the button\'s label and sendStop use only those", "It never rewrites its text from later polls", "sendStop(snapshot.map(({key, state}) => ({key, state})))", D9 prompt-out-of-date; Test Design review COV-4]', async ({ page }) => {
    const m = await mock(page, F.SCENE.WAITING_ASKED);
    await openAndSettle(page);
    const p = await openStopPrompt(page);
    expect(await p.text(), 'the prompt opens on the waiting pass: taken out of line').toMatch(TAKEN_OUT);
    await pauseClock(page);
    m.set(F.SCENE.NOW_RUNNING_AND_ANOTHER_WAITING);
    await page.clock.runFor(POLL_MS);
    await untilShows(page, 'tp-pass', [RUNNING_NOW, clockRe(F.ITEM.WAITING_NOW_RUNNING.since)], [STOP_ASKED], 'a poll lands with the prompt open: the panel shows the pass running since 11:59', 10000);
    await expect(heading(page, p.heading), 'a read that shows passes busy leaves the prompt open (D17 closes it by itself only on nothing busy)').toBeVisible();
    const text = await p.text();
    expect(text, 'the prompt still says what happens to the waiting pass it opened on: taken out of line').toMatch(TAKEN_OUT);
    expect(text, 'it is never rewritten to a running pass\'s text (no safe point)').not.toMatch(SAFE_POINT);
    await expect(p.confirm, 'its button still reads "Stop the pass", for the one pass it opened on, never "Stop the passes" (D17)').toHaveText(/^\s*Stop the pass\s*$/);
    await p.confirm.click();
    await expect.poll(() => m.log.nonGet, { message: 'confirming sends the stop' }).toEqual([STOP_POST]);
    expect(JSON.parse(m.log.sent[0].body || 'null'), 'its body names only the pass and the state the prompt showed, never the running state nor the admin\'s pass (D17 "sendStop(snapshot…)")').toEqual({ targets: [{ key: K.WAITING, state: 'waiting' }] });
    await untilText(page, 'tp-pass', STALE_PROMPT, 'and the server refuses it plainly: what is busy changed since the prompt opened (D9 prompt-out-of-date; D16 refused-stale)', 10000);
    expect(m.log.nonGet, 'one stop sent and refused; nothing retried').toEqual([STOP_POST]);
  });

  test('B115: the Stop prompt closes by itself when a read shows nothing busy, and sends nothing; but while its own stop is under way, a read showing nothing busy leaves it open, its button disabled, aria-busy and "Stopping…", until the answer closes it; the stop\'s outcome then shows until the next Run is sent [ADR 0006 D17 "It closes by itself when a read shows nothing busy, but only while it is not pending", "While the request is under way, the prompt stays open with that button disabled, aria-busy and Stopping…", "The outcomes of Run and Stop show … until the next Run or Stop is sent"; story 6 AC-3 "While a stop is under way, the prompt\'s confirm is disabled and says so"; Test Design review COV-4]', async ({ page }) => {
    // Not pending: a read that shows nothing busy (another viewer stopped the pass) closes the prompt.
    const m = await mock(page, F.SCENE.WAITING_ASKED);
    await openAndSettle(page);
    let p = await openStopPrompt(page);
    await pauseClock(page);
    m.set(F.SCENE.IDLE);
    await page.clock.runFor(POLL_MS);
    await expect(heading(page, p.heading), 'a read that shows nothing busy closes the prompt by itself (D17)').toHaveCount(0, { timeout: 10000 });
    await expect(passCancel(page), 'its Cancel goes with it').toHaveCount(0);
    await expect(stopButton(page), 'and the panel shows nothing busy: no "Stop"').toHaveCount(0);
    await wait(1000);
    expect(m.log.nonGet, 'a prompt that closes by itself sends nothing').toEqual([]);

    // Pending: with its own stop under way, the same read leaves the prompt open.
    await page.clock.resume();
    await reopenWith(page, m, F.SCENE.WAITING_ASKED);
    p = await openStopPrompt(page);
    await pauseClock(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    m.set({ stop: async () => { await gate; return F.STOP_ANSWER.stopped([{ key: K.WAITING, how: 'taken-out-of-line' }]); } });
    try {
      await p.confirm.click();
      await expect.poll(() => m.log.nonGet, { message: 'confirming sends the stop' }).toEqual([STOP_POST]);
      await expect(passBusyButtons(page).first(), 'the stop is under way (D17)').toBeDisabled({ timeout: 5000 });
      // The server has taken the pass out of line; its answer has not come yet.
      m.set({ status: F.SCENE.IDLE.status, passRecord: F.foldPassRecord(F.SCENE.WAITING_ASKED.passRecord, { action: 'stop', key: K.WAITING, at: F.NOW, who: F.ACTOR.owner }) });
      const landed = page.waitForResponse((r) => new URL(r.url()).pathname === F.ROUTES.status, { timeout: 10000 });
      await page.clock.runFor(POLL_MS);
      await landed;
      await wait(1000);
      await expect(heading(page, p.heading), 'a read that shows nothing busy, landing while the stop is under way, leaves the prompt open (D17 "only while it is not pending")').toBeVisible();
      const busy = passBusyButtons(page).first();
      await expect(busy, 'its button still carries aria-busy="true"').toBeVisible();
      await expect(busy, 'and is disabled').toBeDisabled();
      expect(squash(await busy.innerText()), 'and says "Stopping…"').toMatch(STOPPING);
    } finally {
      release();
    }
    await expect(heading(page, p.heading), 'the answer closes it').toHaveCount(0, { timeout: 10000 });
    await untilText(page, 'tp-pass', TAKEN_OUT, 'the stop\'s outcome shows: the pass was taken out of line (D16 stopOutcome)', 10000);
    await pressRun(page);
    await expect.poll(() => m.log.nonGet, { message: 'the next Run is sent' }).toEqual([STOP_POST, RUN_POST]);
    await expect.poll(async () => TAKEN_OUT.test(await textOf(page, 'tp-pass')), { message: 'once the next Run is sent, the stop\'s outcome is gone (D17 "until the next Run or Stop is sent")', timeout: 10000 }).toBe(false);
  });

  /* ── Added after Implementation (2026-10-28): ADR 0006 Amendment 1 § C and story 6 § Deviations, last group ───── */

  test('B116: a read that cannot tell whether a pass is waiting never closes an open Stop prompt — with the prompt open on the owner\'s waiting pass, a poll whose queue read failed (control.queue read-failed, busy empty) and then one whose status carries no control member each land, the panel says the server cannot tell, and the prompt stays open, its text and Cancel unchanged; only a read that knows nothing is busy then closes it; nothing is sent [ADR 0006 Amendment 1 § C "D17: the Stop prompt closes by itself only on a known, empty read" ("A read that cannot tell leaves it open"; "A read that cannot tell is never nothing waiting", AC-2); beside B115]', async ({ page }) => {
    const m = await mock(page, F.SCENE.WAITING_ASKED);
    await openAndSettle(page);
    const p = await openStopPrompt(page);
    const opened = await p.text();
    await pauseClock(page);
    for (const c of [
      { what: 'a poll whose queue read failed', status: F.withControl(F.STATUS.HELD_NONE, F.controlBody({ queue: 'read-failed' })) },
      { what: 'a poll whose status carries no control member', status: F.STATUS.HELD_NONE },
    ]) {
      m.set({ status: c.status });
      const landed = page.waitForResponse((r) => new URL(r.url()).pathname === F.ROUTES.status, { timeout: 10000 });
      await page.clock.runFor(POLL_MS);
      await landed;
      await untilText(page, 'tp-pass', CANNOT_TELL, `${c.what}: the read has landed, and the panel says the server cannot tell whether a pass is waiting (D16)`, 10000);
      await wait(500);
      await expect(heading(page, p.heading), `${c.what}: the prompt stays open — a read that cannot tell is never "nothing busy" (Amendment 1 § C, D17)`).toBeVisible();
      await expect(passCancel(page), `${c.what}: its Cancel is still there`).toBeVisible();
      expect(await p.text(), `${c.what}: its text is unchanged (D17 "It never rewrites its text from later polls")`).toBe(opened);
    }
    m.set({ status: F.SCENE.IDLE.status });
    await page.clock.runFor(POLL_MS);
    await expect(heading(page, p.heading), 'a read that knows nothing is busy then closes it (D17)').toHaveCount(0, { timeout: 10000 });
    expect(m.log.nonGet, 'nothing is sent').toEqual([]);
  });

  test('B117: focus inside the pass controls survives the switch from an empty report to a ready one — with the first pass waiting and the Stop prompt open, Cancel (where the prompt puts focus) and then "Stop the pass" (reached with Shift+Tab) each keep focus when that pass begins running and its report appears; with nothing busy, "Run a pass now" keeps focus when a report appears [story 6 § Deviations, last group ("PassControls carries a key in both branches, so the empty-to-ready switch does not remount it"); ADR 0006 D17 "rendered at one position in each branch"; Amendment 1 § C (the Implementer\'s under D17); PS38 is the source half]', async ({ page }) => {
    const EMPTY_WAITING = { status: F.withControl(F.STATUS.NO_PASS, F.controlBody({ busy: [F.ITEM.WAITING] })), passRecord: F.SCENE.WAITING_ASKED.passRecord };
    const pass = section(page, 'tp-pass');
    /** Let one poll land with `next`, and wait for the pass section to switch from its empty branch to its ready one. */
    const switchToReady = async (m, next, what) => {
      await expect(pass, `${what}: before the poll the pass section is in its empty branch`).toHaveAttribute('data-state', 'empty');
      m.set(next);
      await page.clock.runFor(POLL_MS);
      await expect(pass, `${what}: after the poll the report has appeared and the section is in its ready branch`).toHaveAttribute('data-state', 'ready', { timeout: 10000 });
      await wait(500);
    };
    const m = await mock(page, EMPTY_WAITING);
    // 1. Cancel, where the prompt puts focus when it opens. (Alone this cannot tell a kept instance from a remounted one:
    // a remounted prompt focuses its Cancel again. Cases 2 and 3 can.)
    await openAndSettle(page);
    let p = await openStopPrompt(page);
    await expect(p.cancel, 'focus moves to Cancel when the prompt opens (D17)').toBeFocused();
    await pauseClock(page);
    await switchToReady(m, F.SCENE.WAITING_NOW_RUNNING, 'Cancel focused');
    await expect(heading(page, p.heading), 'the prompt stays open: a pass is still busy').toBeVisible();
    await expect(passCancel(page), 'Cancel keeps focus across the switch').toBeFocused();
    // 2. "Stop the pass", reached from Cancel with Shift+Tab.
    await page.clock.resume();
    await reopenWith(page, m, EMPTY_WAITING);
    p = await openStopPrompt(page);
    await expect(p.cancel, 'setup: focus is on Cancel').toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(p.confirm, 'setup: Shift+Tab moves focus to "Stop the pass"').toBeFocused();
    await pauseClock(page);
    await switchToReady(m, F.SCENE.WAITING_NOW_RUNNING, '"Stop the pass" focused');
    await expect(heading(page, p.heading), 'the prompt stays open: a pass is still busy').toBeVisible();
    await expect(section(page, 'tp-pass').getByRole('button', { name: STOP_THE_PASS }), '"Stop the pass" keeps focus across the switch — the controls are not remounted (a remount would put it back on Cancel)').toBeFocused();
    // 3. "Run a pass now", with nothing busy.
    await page.clock.resume();
    await reopenWith(page, m, F.SCENE.FIRST_IDLE);
    await expect(runButton(page), 'setup: the controls show in the empty branch (D17)').toBeVisible({ timeout: 5000 });
    await runButton(page).focus();
    await expect(runButton(page), 'setup: "Run a pass now" has focus').toBeFocused();
    await pauseClock(page);
    await switchToReady(m, F.SCENE.IDLE, '"Run a pass now" focused');
    await expect(runButton(page), '"Run a pass now" keeps focus across the switch — the controls are not remounted').toBeFocused();
    expect(m.log.nonGet, 'nothing is sent').toEqual([]);
  });

  /* ── AC-4: refused or failed ───────────────────────────────────────────────────────────────────────────────── */

  test('B105: a refused Run (403: no longer the owner or an admin) and a refused Stop (a lapsed session\'s 401) each show why — sign in again as the owner or an admin — with the pass\'s state unchanged, never as done [AC-4 "Refused or failed", "A refusal can come from a lapsed session, or from a viewer who is no longer owner or admin"; ADR 0006 D14, D16 runOutcome/stopOutcome "refused (401 or 403, with the sign in again as the owner or an admin sentence)"]', async ({ page }) => {
    const m = await mock(page, { ...F.SCENE.IDLE, run: F.RUN_ANSWER.REFUSED_403 });
    await openAndSettle(page);
    await pressRun(page);
    await expect.poll(async () => refusedSentences(await textOf(page, 'tp-pass')).length, {
      message: `a 403 on Run: one sentence says to sign in again as the owner or an admin (D16 "refused") (${SIGN_IN_AGAIN}, ${OWNER_OR_AN_ADMIN})`,
      timeout: 10000,
    }).toBeGreaterThan(0);
    expect(linedUpClaims(await textOf(page, 'tp-pass')), 'never said to be lined up').toEqual([]);
    await expect(runButton(page), 'Run is free again').toBeEnabled({ timeout: 5000 });
    await reopenWith(page, m, { ...F.SCENE.WAITING_ASKED, stop: F.STOP_ANSWER.REFUSED_401 });
    const p = await openStopPrompt(page);
    await p.confirm.click();
    await expect.poll(async () => refusedSentences(await textOf(page, 'tp-pass')).length, {
      message: `a lapsed session's 401 on Stop: one sentence says to sign in again as the owner or an admin (${SIGN_IN_AGAIN}, ${OWNER_OR_AN_ADMIN})`,
      timeout: 10000,
    }).toBeGreaterThan(0);
    await untilShows(page, 'tp-pass', [WAITING, clockRe(T.waitAsked)], [], 'the pass\'s state unchanged: still waiting');
    expect(await textOf(page, 'tp-pass'), 'never said to be taken out of line').not.toMatch(/\bwas taken out of line\b/i);
    expect(m.log.nonGet, 'one POST each, nothing retried').toEqual([RUN_POST, STOP_POST]);
  });

  test('B106: a Run the server cannot carry out shows the reason and starts nothing: the task queue unavailable (503), the record unavailable (500 record-unavailable), and a failure with its code (500) — never said to be lined up [AC-1 "When the task queue is unavailable, the server refuses plainly and starts nothing"; AC-4 "Refused or failed"; AC-5 "When the server cannot record an action: a Run is refused and changes nothing"; ADR 0006 D6, D14, D16 runOutcome queue-unavailable, record-unavailable, failed]', async ({ page }) => {
    test.setTimeout(120000);
    const CASES = [
      { what: 'the task queue unavailable (503 QUEUE_UNAVAILABLE)', answer: F.RUN_ANSWER.QUEUE_UNAVAILABLE, says: [QUEUE_DOWN, NOTHING_STARTED] },
      { what: 'the record could not be written (500 record-unavailable)', answer: F.RUN_ANSWER.RECORD_UNAVAILABLE, says: [NOT_RECORDABLE, NOTHING_STARTED] },
      { what: 'a failure (500, code error, cause EIO)', answer: F.RUN_ANSWER.FAILED, says: [FAILED_IDEA, new RegExp(`${codeRe('error').source}|${codeRe('EIO').source}`)] },
    ];
    const m = await mock(page, { ...F.SCENE.IDLE, run: CASES[0].answer });
    for (const [i, c] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reopenWith(page, m, { ...F.SCENE.IDLE, run: c.answer });
      await pressRun(page);
      for (const re of c.says) await untilText(page, 'tp-pass', re, `${c.what}: the panel says why`, 10000);
      expect(linedUpClaims(await textOf(page, 'tp-pass')), `${c.what}: never said to be lined up`).toEqual([]);
      await expect(runButton(page), `${c.what}: Run is free again`).toBeEnabled({ timeout: 5000 });
    }
    expect(m.log.nonGet, 'one POST each, nothing retried').toEqual([RUN_POST, RUN_POST, RUN_POST]);
  });

  test('B107: a Stop refused or failed shows the reason with the pass\'s state unchanged: nothing to stop (409), a pass not yet reachable (409 pass-not-reachable: press Stop again), the task queue unavailable (503), and a failure with its code (500) [AC-3 "Nothing to stop"; AC-4 "Refused or failed"; ADR 0006 D9, D14, D16 stopOutcome nothing-to-stop, not-reachable ("The stop was refused: the pass was starting and had not yet recorded its process, so nothing changed. Press Stop again."), queue-unavailable, failed]', async ({ page }) => {
    test.setTimeout(150000);
    const CASES = [
      { what: 'nothing to stop (409 nothing-to-stop)', answer: F.STOP_ANSWER.NOTHING, says: (t) => NOTHING_TO_STOP.test(t) },
      { what: 'the pass not yet reachable (409 pass-not-reachable)', answer: F.STOP_ANSWER.NOT_REACHABLE, says: NOT_REACHABLE },
      { what: 'the task queue unavailable (503)', answer: F.STOP_ANSWER.QUEUE_UNAVAILABLE, says: (t) => QUEUE_DOWN.test(t) },
      { what: 'a failure (500, code error, cause EIO)', answer: F.STOP_ANSWER.FAILED, says: (t) => FAILED_IDEA.test(t) && (codeRe('error').test(t) || codeRe('EIO').test(t)) },
    ];
    const m = await mock(page, { ...F.SCENE.WAITING_ASKED, stop: CASES[0].answer });
    for (const [i, c] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reopenWith(page, m, { ...F.SCENE.WAITING_ASKED, stop: c.answer });
      const p = await openStopPrompt(page);
      await p.confirm.click();
      await expect.poll(async () => c.says(await textOf(page, 'tp-pass')), { message: `${c.what}: the panel says why`, timeout: 10000 }).toBe(true);
      await untilShows(page, 'tp-pass', [WAITING, clockRe(T.waitAsked)], [], `${c.what}: the pass's state unchanged, still waiting`);
      expect(await textOf(page, 'tp-pass'), `${c.what}: never said to be taken out of line`).not.toMatch(/\bwas taken out of line\b/i);
    }
    expect(m.log.nonGet, 'one POST each, nothing retried').toEqual([STOP_POST, STOP_POST, STOP_POST, STOP_POST]);
  });

  /* ── AC-5: who did it ──────────────────────────────────────────────────────────────────────────────────────── */

  test('B108: who started each pass shows, from the record: the latest pass started by an admin, with the shortened key and when it was asked for; the earlier passes by the owner (and stopped on request by the owner), the schedule, the owner\'s confirmation, a local call, "started another way" for a legacy-id job, and "start not recorded" for a pass from before story 6 [AC-5 "What is recorded", "What the panel shows: for each pass it shows, who started it, and who asked it to stop", "Before story 6"; ADR 0006 D16 passWho, D18 "LatestPass and EarlierPasses add … Started by <who> at <time>"; R7]', async ({ page }) => {
    const W = F.WHO_EACH;
    const R = W.records;
    const m = await mock(page, W);
    await openAndSettle(page);
    await untilShows(page, 'tp-pass', [START_WORD, clockRe(W.starts.latest), ...ADMIN_WHO], [], 'the latest pass: started by an admin, at the time it was asked for (D18) — not implemented yet if missing');
    const ROWS = [
      ['the owner\'s pass', R.ownerStopped, [...OWNER_WHO]],
      ['the owner\'s pass, stopped on request by the owner', R.ownerStopped, [STOPPED_ON_REQUEST, ...OWNER_WHO]],
      ['a scheduled run', R.scheduled, [SCHEDULE_WHO]],
      ['a pass the owner\'s confirmation started', R.confirmed, [CONFIRMATION_WHO]],
      ['a local call\'s pass', R.local, [LOCAL_WHO]],
      ['a legacy-id job (R7)', R.legacyRun, [OTHER_WHO]],
      ['a pass from before story 6, with no job', R.before6, [START_NOT_RECORDED]],
    ];
    for (const [what, r, who] of ROWS) {
      await untilShows(page, 'tp-pass', [clockRe(r.startedAt), ...who], [], `${what} (started ${r.startedAt}): shown with who started it`);
    }
    expect(m.log.nonGet).toEqual([]);
  });

  test('B109: the last 10 actions show newest first, each with what it was (a start or a stop), who took it and when; with no action recorded the panel says so and the history is empty, and a pass from before story 6 shows its start as not recorded [AC-5 "the last 10 actions, newest first", "Before story 6 … With no action recorded, the panel says so and the history is empty"; ADR 0006 D11, D13, D18 "The history list shows the last 10 actions, newest first, with an empty state"]', async ({ page }) => {
    const H = F.HISTORY6;
    const WHO_RE = { owner: OWNER_WHO, admin: ADMIN_WHO, schedule: [SCHEDULE_WHO], confirmation: [CONFIRMATION_WHO], local: [LOCAL_WHO], other: [OTHER_WHO] };
    const m = await mock(page, H);
    await openAndSettle(page);
    for (const [i, l] of H.lines.entries()) {
      await untilShows(page, 'tp-pass', [clockRe(l.at), l.action === 'start' ? START_WORD : /\bstop\w*\b/i, ...WHO_RE[l.who.kind]], [],
        `history action ${i + 1} of 10: a ${l.action} by ${l.who.kind} at ${l.at}${i === 0 ? ' — not implemented yet if missing (D18)' : ''}`);
    }
    const text = await textOf(page, 'tp-pass');
    const order = H.lines.map((l) => text.search(clockRe(l.at)));
    expect(order.every((x, i) => i === 0 || x > order[i - 1]), `newest first: each action after the one newer than it (positions ${order.join(', ')})`).toBe(true);
    await reopenWith(page, m, { status: H.status, passRecord: F.PASS_RECORD.EMPTY });
    await untilText(page, 'tp-pass', NO_ACTION_RECORDED, 'no action recorded: the panel says so', 5000);
    const empty = await textOf(page, 'tp-pass');
    for (const l of H.lines) expect(empty, `the history is empty: no action at ${l.at}`).not.toMatch(clockRe(l.at));
    for (const k of KEYS) expect(empty, 'and no who').not.toContain(k);
    expect(empty, 'the latest pass, from before story 6 (no job), shows its start as not recorded').toMatch(START_NOT_RECORDED);
    expect(m.log.nonGet).toEqual([]);
  });

  test('B110: an action that could not be recorded: a Stop whose answer says it was not recorded takes effect and says so, with no who for it; a running pass whose stop could not be recorded shows the stop asked for with no who; a scheduled run\'s start, and a lined-up pass\'s, that could not be recorded read "start not recorded" [AC-5 "When the server cannot record an action": "a Stop still takes effect, its answer says it was not recorded, and the panel shows it with no who", "a start that cannot be refused … shows as not recorded"; ADR 0006 D9 recorded false, D11, D16 stopOutcome done-unrecorded, passWho (startRecorded false)]', async ({ page }) => {
    test.setTimeout(120000);
    const m = await mock(page, F.SCENE.WAITING_ASKED);
    await openAndSettle(page);
    await untilShows(page, 'tp-pass', [WAITING, clockRe(T.waitAsked)], [], 'the pass waits — not implemented yet if missing (D16, D17)');
    const p = await openStopPrompt(page);
    await pauseClock(page);
    m.set({
      stop: () => {
        // Taken out of line in memory; the record write failed (D9: "A failed or refused write leaves the effect in place and sets recorded: false").
        m.set({ status: F.SCENE.IDLE.status });
        return F.STOP_ANSWER.stopped([{ key: K.WAITING, how: 'taken-out-of-line' }], false);
      },
    });
    await p.confirm.click();
    await expect.poll(async () => sentencesWith(await textOutsideButtons(page, 'tp-pass'), /\bstop\w*\b/i, NOT_RECORDED).length, { message: 'the answer said the stop was not recorded: the panel says so (D16 done-unrecorded)', timeout: 10000 }).toBeGreaterThan(0);
    await expect.poll(() => shows(page, 'tp-pass', [WAITING, clockRe(T.waitAsked)], [TAKEN_OUT]), { message: 'the stop took effect: the pass is gone from the line', timeout: 10000 }).toBe(false);
    expect(sentencesWith(await textOutsideButtons(page, 'tp-pass'), /\bstop\w*\b/i, new RegExp(esc(F.OWNER_KEY))), 'and no who for that stop').toEqual([]);
    await page.clock.resume();
    await reopenWith(page, m, F.SCENE.STOP_ASKED_UNRECORDED);
    await untilShows(page, 'tp-pass', [STOP_ASKED, clockRe(T.stopAsked)], [], 'a running pass whose stop was not recorded still shows the stop asked for, at 11:59');
    expect(await textOf(page, 'tp-pass'), 'with no who for it').not.toContain(F.ADMIN_KEY);
    await reopenWith(page, m, F.SCENE.SCHED_START_UNRECORDED);
    await untilShows(page, 'tp-pass', [WAITING, BEHIND_HEAVY, START_NOT_RECORDED], [], 'a scheduled run waiting for the lock whose start could not be recorded: start not recorded');
    await reopenWith(page, m, F.SCENE.LINEUP_START_UNRECORDED);
    await untilShows(page, 'tp-pass', [WAITING, BEHIND_PASS, clockRe(T.waitAsked), START_NOT_RECORDED], [], 'a lined-up pass behind the running one whose start could not be recorded: start not recorded');
    expect(m.log.nonGet).toEqual([STOP_POST]);
  });

  test('B111: a failed read of the pass record shows its own failure inside the pass section — its code and Retry — with no kept who, the section\'s state unchanged; Retry brings who back [AC-5; ADR 0006 D16 "Kept bodies. Like switchRecordView, it says loading or failed rather than showing a kept body", D17 "A record failure renders its own ReadFailed inside the controls", "tp-pass\'s data-state stays as it is (PS12)"]', async ({ page }) => {
    const m = await mock(page, F.SCENE.RUNNING);
    await openAndSettle(page);
    await untilShows(page, 'tp-pass', [START_WORD, clockRe(T.runAsked), ...OWNER_WHO], [], 'a good record read: who started the running pass shows — not implemented yet if missing (D16, D17)');
    expect(await textOf(page, 'tp-pass'), 'no read failure yet').not.toMatch(UNREADABLE);
    await pauseClock(page);
    m.set({ passRecord: fail(500) });
    await page.clock.runFor(POLL_MS);
    await expect.poll(async () => (await textOf(page, 'tp-pass')).includes(F.OWNER_KEY), { message: 'after the failed read, no kept who', timeout: 5000 }).toBe(false);
    const text = await textOf(page, 'tp-pass');
    expect(text, 'the record could not be read').toMatch(UNREADABLE);
    expect(text, 'with its code').toMatch(codeRe('http-500'));
    await expect(section(page, 'tp-pass'), 'the section\'s own state is unchanged (PS12)').toHaveAttribute('data-state', 'ready');
    await untilShows(page, 'tp-pass', [RUNNING_NOW, clockRe(T.runStarted)], [], 'the running pass itself still shows');
    m.set({ passRecord: F.SCENE.RUNNING.passRecord });
    await section(page, 'tp-pass').getByRole('button', { name: 'Retry', exact: true }).click();
    await expect.poll(async () => (await textOf(page, 'tp-pass')).includes(F.OWNER_KEY), { message: 'Retry reads the record again: who shows again', timeout: 10000 }).toBe(true);
  });

  /* ── AC-6: the copy that changes ───────────────────────────────────────────────────────────────────────────── */

  test('B112: the panel\'s opening line says it lets the owner or an admin switch the path and run or stop a pass, and no longer says the switch is the only thing it changes [AC-6 "the panel\'s opening line, which today says it changes nothing but the path\'s switch"; ADR 0006 D19 "The opening line … lets the owner or an admin switch the path and run or stop a pass"]', async ({ page }) => {
    await mock(page, F.SCENE.IDLE);
    await openAndSettle(page);
    const line = squash(await page.locator('h2', { hasText: TAB }).locator('xpath=following-sibling::p[1]').innerText());
    expect(line, 'it names running a pass (D19) — not implemented yet').toMatch(/\brun\b/i);
    expect(line, 'and stopping one').toMatch(/\bstop\b/i);
    expect(line, 'and the path\'s switch').toMatch(/\bswitch\b/i);
    expect(line, 'not "apart from the real-time path\'s switch, it changes nothing"').not.toMatch(/\bapart from\b[^.]*\bswitch\b[^.]*\bchanges nothing\b/i);
  });
});

/* ══ Story 7: confirming held removals on the panel (ADR 0007) ═══════════════════════════════════════════════════ */

test.describe('Confirming held removals on the panel (tagging-edges #7, ADR 0007)', () => {
  test.use({ timezoneId: 'UTC', locale: 'en-GB' });

  test.beforeAll(async () => { await loadView(); });

  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip(true, 'Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    if (RECORDING) test.skip(true, 'TP_RECORD_BASELINE=1: only the AC-6 baseline is recorded');
    await page.clock.install({ time: new Date(F.NOW) });
  });

  const S = F.SCENE7;
  const RUN = F.HELD_RECORD.runId;
  const NEWER = F.HELD_NEWER_RECORD.runId;
  const heldItems = async (page) => ((await textOf(page, 'tp-held')).match(/held-address-\d{3}/g) || []).length;
  const heldLines = (page) => textOutsideButtons(page, 'tp-held');
  const passHeading = (page, name) => section(page, 'tp-pass').getByRole('heading', { name, exact: true });
  /** Confirm the open prompt and wait for the answer to close it (D11), so no line of the prompt is read as the answer's. */
  const confirmedVia = async (page, p) => {
    await p.confirm.click();
    await expect(heldHeading(page, p.heading), 'the answer closes the prompt (D11)').toHaveCount(0, { timeout: 10000 });
  };
  /** Reload with `scene` (and any other answers), the clock flowing again, and wait for every section to settle. */
  const reload = async (page, m, patch, except = []) => {
    await page.clock.resume();
    m.set({ confirm: undefined, held: undefined, ...patch });
    await openAndSettle(page, except);
  };

  /* ── AC-1: when Confirm shows ──────────────────────────────────────────────────────────────────────────────── */

  test('B118: the owner sees "Confirm held removals" in the held section when the latest pass held removals and no confirmation of that held list is pending — with no confirmation, one pending for an earlier pass, an expired one, an unreadable one, or one whose expiry cannot be read, each said as today — and none while a confirmation of the latest held list is pending, when the latest pass held nothing, or with no pass on record; showing it sends nothing [AC-1 "When it shows", "A confirmation that cannot be relied on … still offers Confirm"; ADR 0007 D9 offer, role]', async ({ page }) => {
    test.setTimeout(150000);
    const CASES = [
      { what: 'no confirmation', scene: S.HELD_NONE, offered: true, says: [/\bno confirmation\b/i] },
      { what: 'a confirmation of the latest held list, pending', scene: S.HELD_PENDING, offered: false, says: [PENDING_STRICT, clockRe(S.HELD_PENDING.status.confirmationPending.expiresAt)] },
      { what: 'a confirmation pending for an earlier pass, while the latest holds another list', scene: S.PENDING_EARLIER, offered: true, says: [PENDING, new RegExp(esc(RUN))] },
      { what: 'an expired confirmation', scene: S.EXPIRED, offered: true, says: [EXPIRED] },
      { what: 'an unreadable confirmation', scene: S.UNREADABLE, offered: true, says: [UNREADABLE, codeRe('EACCES')] },
      { what: 'a confirmation whose expiry cannot be read', scene: S.UNKNOWN_EXPIRY, offered: true, says: [EXPIRY_UNREADABLE] },
    ];
    const m = await mock(page, CASES[0].scene);
    for (const [i, c] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reload(page, m, c.scene);
      await expect(section(page, 'tp-held'), `${c.what}: the held list is read`).toHaveAttribute('data-state', 'ready');
      await expect.poll(() => heldItems(page), { message: `${c.what}: the held list shows its items` }).toBeGreaterThan(0);
      const lines = await heldLines(page);
      for (const re of c.says) expect(lines, `${c.what}: the held section says so, as today (${re})`).toMatch(re);
      if (c.offered) {
        await expect(confirmButton(page), `${c.what}: the owner is offered "${CONFIRM_LABEL}" (AC-1; D9: the held list read, nothing running, no confirmation pending for the latest run) — not implemented yet`).toBeVisible({ timeout: 5000 });
        await expect(confirmButton(page), `${c.what}: and it is enabled`).toBeEnabled();
        await expect(confirmButton(page), `${c.what}: one Confirm`).toHaveCount(1);
        expect(lines, `${c.what}: the owner sees no "only the owner" reason (that is an admin's, D9)`).not.toMatch(ONLY_OWNER);
      } else {
        await expect(confirmButton(page), `${c.what}: no Confirm (AC-1 "While a confirmation of the latest held list is pending … offers no Confirm")`).toHaveCount(0);
      }
      expect(await refusedConfirmButtons(page), `${c.what}: no other button is named for confirming`).toEqual([]);
    }
    for (const [what, scene] of [['the latest pass held nothing', S.NOTHING_HELD], ['no pass on record', S.NO_PASS]]) {
      await reload(page, m, scene);
      await expect(section(page, 'tp-held'), `${what}: the held section says nothing is held`).toHaveAttribute('data-state', 'empty');
      await expect(confirmButton(page), `${what}: no Confirm (AC-1 "It is not shown when the latest pass held nothing")`).toHaveCount(0);
    }
    expect(m.log.nonGet, 'showing Confirm sends nothing').toEqual([]);
  });

  test('B119: while a pass runs there is no held list and no Confirm — by liveness, and for a pass that has just been launched and not yet recorded itself (control.busy lists it running), whose held list of the latest pass still shows with no Confirm; when the running pass ends having held removals, its own held list shows, with Confirm [AC-1 "While a pass is running … no held list and no Confirm, as today. When the pass ends, its own held list shows"; ADR 0007 D9 "no control.busy item is running with no stop asked for (story 6\'s running, a starting pass included)"]', async ({ page }) => {
    test.setTimeout(90000);
    const m = await mock(page, S.RUNNING);
    await openAndSettle(page);
    await expect(section(page, 'tp-held'), 'a pass is alive: no held list').toHaveAttribute('data-state', 'empty');
    expect(await textOf(page, 'tp-held'), 'the held list returns when it ends, as today').toMatch(RUNNING_WAITS);
    await expect(confirmButton(page), 'no Confirm while a pass runs').toHaveCount(0);

    await reload(page, m, S.STARTING);
    await expect(section(page, 'tp-held'), 'a starting pass has written no report: the latest pass\'s held list still shows').toHaveAttribute('data-state', 'ready');
    await expect.poll(() => heldItems(page), { message: 'its items show' }).toBeGreaterThan(0);
    await untilShows(page, 'tp-pass', [RUNNING_NOW], [], 'the pass section shows the starting pass running');
    await wait(500);
    await expect(confirmButton(page), 'but no Confirm while a pass runs, a starting one included (D9; only a stale panel or the console meets a starting pass, ratified reading 1)').toHaveCount(0);

    await reload(page, m, S.RUNNING);
    await pauseClock(page);
    m.set(S.RUNNING_ENDED_HELD);
    await page.clock.runFor(POLL_MS);
    await expect(section(page, 'tp-held'), `the pass ended holding removals: its own held list shows (${F.ENDED_HELD7_RECORD.runId})`).toContainText(F.ENDED_HELD7_RECORD.runId, { timeout: 10000 });
    await expect(confirmButton(page), 'with Confirm for that held list — not implemented yet if missing (D9)').toBeVisible({ timeout: 10000 });
    expect(m.log.nonGet).toEqual([]);
  });

  test('B120: until the held list is read Confirm is not offered — while the list is loading the section says so, and when its read failed it shows the failure and Retry, with no Confirm; once read, Confirm shows [AC-1 "Until the held list is read, Confirm is not offered … so the owner never confirms removals the panel is not showing"; ADR 0007 D9 "the held list\'s read is ready for that runId"]', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const m = await mock(page, { ...S.HELD_NONE, held: (req, dflt) => gate.then(() => dflt()) });
    try {
      await openAndSettle(page, ['tp-held']);
      await expect(section(page, 'tp-held'), 'the held list is still loading').toHaveAttribute('data-state', 'loading');
      expect(await textOf(page, 'tp-held'), 'and the section says so').toMatch(LOADING);
      await wait(500);
      await expect(confirmButton(page), 'no Confirm while the held list is loading').toHaveCount(0);
    } finally {
      release();
    }
    await expect(section(page, 'tp-held'), 'the list answers').toHaveAttribute('data-state', 'ready', { timeout: 10000 });
    await expect(confirmButton(page), 'once the held list is read, Confirm shows — not implemented yet if missing (D9)').toBeVisible({ timeout: 5000 });

    await reload(page, m, { ...S.HELD_NONE, held: fail(502) });
    await expect(section(page, 'tp-held'), 'the held list\'s read failed').toHaveAttribute('data-state', 'error');
    expect(await textOf(page, 'tp-held'), 'the section shows its failure, with its code').toMatch(codeRe('http-502'));
    await expect(confirmButton(page), 'no Confirm while the held list cannot be read').toHaveCount(0);
    m.set({ held: undefined });
    await section(page, 'tp-held').getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(section(page, 'tp-held'), 'Retry reads it').toHaveAttribute('data-state', 'ready', { timeout: 10000 });
    await expect(confirmButton(page), 'and Confirm shows').toBeVisible({ timeout: 5000 });
    expect(m.log.nonGet).toEqual([]);
  });

  /* ── AC-2: the prompt ──────────────────────────────────────────────────────────────────────────────────────── */

  test('B121: pressing Confirm opens a prompt inside the held section — a heading, focus on Cancel, one "Confirm the removals", the button replaced while open — that says how many removals it confirms and from which pass, that confirming lines up a pass now, that it covers this held list once and lapses after 24 hours if no pass takes it up, and that a removal cannot be undone from the panel: it comes back only if its tagging is on the relay again, through the real-time path while it is on, or a later pass; with no earlier confirmation, no replacing line; Cancel sends nothing and changes nothing [AC-2 "What it says", "Cancelling sends nothing and changes nothing"; ADR 0007 D10]', async ({ page }) => {
    const m = await mock(page, S.HELD_NONE);
    await openAndSettle(page);
    const p = await openConfirmPrompt(page);
    await expect(p.cancel, 'focus moves to Cancel when the prompt opens (D10)').toBeFocused();
    await expect(confirmButton(page), 'the prompt replaces "Confirm held removals" while open (D10)').toHaveCount(0);
    await expect(page.getByRole('button', { name: CONFIRM_PROMPT_LABEL, exact: true }), `one "${CONFIRM_PROMPT_LABEL}" on the page`).toHaveCount(1);
    const text = await p.text();
    expect(text, `how many removals it confirms (${F.HELD_TOTAL})`).toMatch(near('removals?', F.HELD_TOTAL));
    expect(text, `and from which pass (${RUN}), the one the held section shows`).toContain(RUN);
    expect(linesUpNow(text).length, 'nothing busy: confirming lines up a pass now (D10 lines-up)').toBeGreaterThan(0);
    expect(text, 'not the waiting case').not.toMatch(ALREADY_WAITING);
    expect(text, 'not the cannot-tell case').not.toMatch(CANNOT_TELL_LINED_UP);
    expect(onceLines(text).length, 'the confirmation covers this held list once').toBeGreaterThan(0);
    expect(lapseLines(text).length, 'and lapses after 24 hours if no pass takes it up').toBeGreaterThan(0);
    expect(text, 'a removal cannot be undone from the panel').toMatch(NO_UNDO);
    expect(comesBackLines(text).length, 'a removed relationship comes back only if its tagging is on the relay again').toBeGreaterThan(0);
    expect(text, 'then the real-time path, while it is on').toMatch(WHILE_PATH_ON);
    expect(text, 'or a later pass adds it back').toMatch(LATER_PASS);
    expect(replacesLines(text), 'no earlier confirmation is shown: no replacing line').toEqual([]);
    await p.cancel.click();
    await expect(heldCancel(page), 'Cancel closes the prompt').toHaveCount(0, { timeout: 5000 });
    await expect(confirmButton(page), 'and "Confirm held removals" is back').toBeEnabled();
    await wait(1000);
    expect(m.log.nonGet, 'Cancel sends nothing').toEqual([]);
    expect(await heldLines(page), 'and changes nothing: no confirmation is pending').not.toMatch(PENDING_STRICT);
  });

  test('B122: the prompt says when the removals happen for the state the panel last showed, and only that case — a pass waiting with no stop asked for takes the confirmation up and nothing new is lined up; with every busy pass asked to stop, confirming lines up a pass now; and when the panel cannot tell whether a pass is waiting (the task queue off, its read failed, not ready, or a status with no control member) it cannot tell whether one will be lined up now, and the answer will say what happened [AC-2 "when they happen … only the case that applies"; ADR 0007 D9 when, D10 item 2]', async ({ page }) => {
    test.setTimeout(150000);
    const CASES = [
      { what: 'a pass waiting with no stop asked for', scene: S.WAITING, when: 'waiting' },
      { what: 'every busy pass with a stop asked for', scene: S.ALL_STOPPING, when: 'lines-up' },
      { what: 'the task queue off', scene: S.QUEUE_OFF, when: 'cannot-tell' },
      { what: 'the queue read failed', scene: S.QUEUE_READ_FAILED, when: 'cannot-tell' },
      { what: 'the queue not ready', scene: S.QUEUE_NOT_READY, when: 'cannot-tell' },
      { what: 'a status with no control member', scene: S.NO_CONTROL, when: 'cannot-tell' },
    ];
    const m = await mock(page, CASES[0].scene);
    for (const [i, c] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reload(page, m, c.scene);
      const p = await openConfirmPrompt(page);
      const text = await p.text();
      if (c.when === 'waiting') {
        expect(text, `${c.what}: a pass is already waiting`).toMatch(ALREADY_WAITING);
        expect(takesThisUp(text).length, `${c.what}: it takes this confirmation up`).toBeGreaterThan(0);
        expect(text, `${c.what}: and nothing new is lined up`).toMatch(NOTHING_LINED_UP);
        expect(linesUpNow(text), `${c.what}: never "lines up a pass now"`).toEqual([]);
      } else if (c.when === 'lines-up') {
        expect(linesUpNow(text).length, `${c.what}: none of them takes it up, so confirming lines up a pass now (AC-1 "Every busy pass has a stop asked for"; D9 when lines-up)`).toBeGreaterThan(0);
        expect(text, `${c.what}: not the waiting case`).not.toMatch(ALREADY_WAITING);
        expect(text, `${c.what}: not the cannot-tell case`).not.toMatch(CANNOT_TELL_LINED_UP);
      } else {
        expect(text, `${c.what}: the panel cannot tell whether a pass is waiting`).toMatch(CANNOT_TELL);
        expect(text, `${c.what}: so it cannot tell whether one will be lined up now`).toMatch(CANNOT_TELL_LINED_UP);
        expect(text, `${c.what}: and the answer will say what happened`).toMatch(ANSWER_WILL_SAY);
        expect(linesUpNow(text), `${c.what}: never "lines up a pass now"`).toEqual([]);
        expect(text, `${c.what}: never "a pass is already waiting"`).not.toMatch(ALREADY_WAITING);
      }
      await p.cancel.click();
      await expect(heldCancel(page)).toHaveCount(0, { timeout: 5000 });
    }
    expect(m.log.nonGet, 'opening and cancelling the prompt sends nothing').toEqual([]);
  });

  test('B123: when the panel shows an earlier confirmation that no pass will carry out — pending for an earlier pass, expired, unreadable, or with an expiry that cannot be read — the prompt says this one replaces it; and the held section words each so: an expired one, that no pass will carry it out and the owner can confirm this held list again; an unreadable one and one whose expiry cannot be read, that no pass carries it out and confirming again replaces it [AC-2 "when the panel shows an earlier confirmation that no pass will carry out … this one replaces it"; AC-7 "the held section\'s wording"; ADR 0007 D10 item 5, D13; ratified reading 4]', async ({ page }) => {
    test.setTimeout(120000);
    const CASES = [
      { what: 'a confirmation pending for an earlier pass', scene: S.PENDING_EARLIER, says: [PENDING, new RegExp(esc(RUN))] },
      { what: 'an expired confirmation', scene: S.EXPIRED, says: [EXPIRED, NO_PASS_CARRIES, CONFIRM_AGAIN] },
      { what: 'an unreadable confirmation', scene: S.UNREADABLE, says: [UNREADABLE, NO_PASS_CARRIES, CONFIRMING_AGAIN_REPLACES] },
      { what: 'a confirmation whose expiry cannot be read', scene: S.UNKNOWN_EXPIRY, says: [EXPIRY_UNREADABLE, NO_PASS_CARRIES, CONFIRMING_AGAIN_REPLACES] },
    ];
    const m = await mock(page, CASES[0].scene);
    for (const [i, c] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reload(page, m, c.scene);
      const lines = await heldLines(page);
      for (const re of c.says) expect(lines, `${c.what}: the held section says (${re}) (D13)`).toMatch(re);
      const p = await openConfirmPrompt(page);
      expect(replacesLines(await p.text()).length, `${c.what}: the prompt says this confirmation replaces the earlier one, which no pass will carry out (D10 item 5)`).toBeGreaterThan(0);
      await p.cancel.click();
      await expect(heldCancel(page)).toHaveCount(0, { timeout: 5000 });
    }
    expect(m.log.nonGet).toEqual([]);
  });

  /* ── AC-1: confirming, and what the answer says ────────────────────────────────────────────────────────────── */

  test('B124: confirming with nothing busy sends one POST {"runId": the prompt\'s pass} as JSON to the confirm route; while under way both prompt buttons are disabled and the first says "Confirming…" with aria-busy, the prompt open; on the answer the prompt closes, the held section says a pass was lined up, and the reads that follow — with no poll — show the new pass waiting, started by the owner\'s confirmation, the confirmation pending until 24 hours on, and no Confirm [AC-1 "When nothing is busy, confirming lines up a pass. Within 10 seconds every viewer sees it waiting", "While a confirmation is under way, the control is disabled and says so", "From then on no panel offers Confirm for that held list"; ADR 0007 D4 lined-up, D10 "While under way", D11 sendConfirm, the flow]', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const m = await mock(page, S.HELD_NONE);
    m.set({ confirm: async (req, server) => { await gate; return server(); } });
    await openAndSettle(page);
    const p = await openConfirmPrompt(page);
    await pauseClock(page);
    const mark = m.log.api.length;
    try {
      await p.confirm.click();
      await expect.poll(() => m.log.nonGet, { message: 'confirming sends the confirmation' }).toEqual([CONFIRM_POST]);
      const busy = heldBusyButtons(page).first();
      await expect(busy, 'while under way the prompt\'s confirm carries aria-busy="true" (D10)').toBeVisible({ timeout: 5000 });
      await expect(busy, 'and is disabled').toBeDisabled();
      expect(squash(await busy.innerText()), 'and says "Confirming…" (D10)').toMatch(CONFIRMING);
      await expect(heldCancel(page), 'Cancel is disabled too (D10 "both disabled")').toBeDisabled();
      await expect(heldHeading(page, p.heading), 'the prompt stays open while under way (D10)').toBeVisible();
    } finally {
      release();
    }
    await expect(heldHeading(page, p.heading), 'on the answer the prompt closes').toHaveCount(0, { timeout: 10000 });
    const sent = m.log.sent[0];
    expect(JSON.parse(sent.body || 'null'), 'its body is {"runId": the pass the prompt named} (D11)').toEqual({ runId: RUN });
    expect(sent.contentType || '', 'sent as JSON').toMatch(/^application\/json\b/i);
    await expect.poll(async () => linedUpClaimsOf(await heldLines(page)).length, { message: 'the held section says a pass was lined up (D11 confirmOutcome lined-up)', timeout: 10000 }).toBeGreaterThan(0);
    const reread = m.log.api.slice(mark).filter((l) => l.startsWith('GET ')).map((l) => l.split(' ')[1].split('?')[0]);
    expect(reread, 'the status is read again after the answer (D11)').toContain(F.ROUTES.status);
    expect(reread, 'and the pass record (D11)').toContain(F.ROUTES.passRecord);
    await untilShows(page, 'tp-pass', [WAITING, clockRe(F.NOW), CONFIRMATION_WHO], [], 'within 10 s, with no poll, the new pass waits since 12:00, started by the owner\'s confirmation', 10000);
    await untilText(page, 'tp-held', PENDING_STRICT, 'the confirmation shows pending', 5000);
    expect(await heldLines(page), `until 24 hours on (${F.plusTtl(F.NOW)})`).toMatch(clockRe(F.plusTtl(F.NOW)));
    await expect(confirmButton(page), 'no Confirm for that held list while it is pending').toHaveCount(0);
    expect(m.log.nonGet, 'one confirmation, sent once').toEqual([CONFIRM_POST]);
  });

  test('B125: when the server does not answer a confirmation within 15 s — the confirmation, the status and the pass record all hang — the prompt closes, "Confirm held removals" is enabled again and the panel says the outcome is unknown; it then shows the state from its next read: the confirmation pending, and no Confirm [AC-1 "If the server has not answered within 15 seconds, the control is enabled again and the panel says the outcome is unknown. It then shows the state from its next read"; ADR 0007 D11 "unknown (timeout, network, bad JSON)", "On unknown, clear at once and fire the re-reads"]', async ({ page }) => {
    const m = await mock(page, S.HELD_NONE);
    await openAndSettle(page);
    const p = await openConfirmPrompt(page);
    expect(await heldLines(page), 'before the confirmation, no "outcome unknown"').not.toMatch(OUTCOME_UNKNOWN);
    await pauseClock(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    m.set({
      confirm: async () => { await gate; return F.CONFIRM_ANSWER.linedUp(F.OTHER_TAB_JOB_KEY); },
      status: async () => { await gate; return S.HISTORY.status; },
      passRecord: async () => { await gate; return S.HISTORY.passRecord; },
    });
    try {
      await p.confirm.click();
      await expect.poll(() => m.log.nonGet, { message: 'the confirmation is sent' }).toEqual([CONFIRM_POST]);
      await expect(heldBusyButtons(page).first(), 'under way (D10)').toBeDisabled({ timeout: 5000 });
      await page.clock.runFor(15000);
      await expect(confirmButton(page), 'after 15 s with no answer, "Confirm held removals" is enabled again').toBeEnabled({ timeout: 5000 });
      await expect(heldBusyButtons(page), 'and nothing is busy').toHaveCount(0);
      await untilText(page, 'tp-held', OUTCOME_UNKNOWN, 'and the panel says the outcome is unknown (D11)', 5000);
    } finally {
      release();
    }
    await untilText(page, 'tp-held', PENDING_STRICT, 'it then shows the state from its next read: the confirmation pending', 10000);
    await expect(confirmButton(page), 'and no Confirm').toHaveCount(0, { timeout: 5000 });
    expect(m.log.nonGet, 'sent once and never retried').toEqual([CONFIRM_POST]);
  });

  test('B126: a Confirm sent from a panel that has not yet re-read a confirmation pending for this held list (another tab confirmed at 11:59) is refused plainly — a confirmation of this held list is already pending, until when — and the panel then shows it pending, with no Confirm [AC-1 "A second confirmation while one is pending is refused plainly … The answer says that a confirmation of this held list is already pending, and until when. It changes nothing"; ADR 0007 D2 step 2, D4 409 already-pending, D11]', async ({ page }) => {
    const m = await mock(page, S.HELD_NONE);
    await openAndSettle(page);
    await pauseClock(page);
    m.set(S.HISTORY); // another tab confirmed; no poll has shown it here
    const p = await openConfirmPrompt(page);
    await confirmedVia(page, p);
    const until = S.HISTORY.status.confirmationPending.expiresAt;
    await untilShows(page, 'tp-held', [ALREADY_PENDING, clockRe(until)], [], `refused plainly: a confirmation of this held list is already pending, until ${until} (D4 already-pending)`, 10000);
    expect(linedUpClaimsOf(await heldLines(page)), 'never said to be lined up').toEqual([]);
    await untilText(page, 'tp-held', PENDING_STRICT, 'the panel then shows it pending', 10000);
    await expect(confirmButton(page), 'with no Confirm').toHaveCount(0, { timeout: 5000 });
    expect(m.log.nonGet, 'one confirmation sent, refused; nothing retried').toEqual([CONFIRM_POST]);
  });

  test('B127: when the confirmation is made but no pass is lined up — the task queue unavailable, or the server failing to line one up — the panel says plainly that no pass was lined up, gives the reason, and says that Run a pass now, or the next scheduled pass, takes it up within its 24 hours; the confirmation shows pending; never "lined up" [AC-1 "When the confirmation is made but no pass is lined up"; ADR 0007 D2 step 8, D4 not-lined-up, D11 "not-lined-up: The confirmation was made, but no pass was lined up (<reason>)…"]', async ({ page }) => {
    test.setTimeout(90000);
    const m = await mock(page, S.QUEUE_OFF);
    await openAndSettle(page);
    let p = await openConfirmPrompt(page);
    await confirmedVia(page, p); // the server-like default: the queue off → not-lined-up QUEUE_UNAVAILABLE
    await untilText(page, 'tp-held', NOTHING_LINED_UP, 'the task queue unavailable: no pass was lined up', 10000);
    let lines = await heldLines(page);
    expect(lines, 'with the reason, QUEUE_UNAVAILABLE').toMatch(codeRe('QUEUE_UNAVAILABLE'));
    expect(lines, 'Run a pass now takes it up').toMatch(RUN_NAMED);
    expect(lines, 'or the next scheduled pass').toMatch(NEXT_SCHEDULED);
    expect(lines, 'within its 24 hours').toMatch(WITHIN_24H);
    expect(linedUpClaimsOf(lines), 'never said to be lined up').toEqual([]);
    await untilText(page, 'tp-held', PENDING_STRICT, 'the confirmation is kept pending', 10000);

    await reload(page, m, {
      ...S.HELD_NONE,
      confirm: () => {
        m.set({ status: F.withConfirmationPending(S.HELD_NONE.status, F.NOW) });
        return F.CONFIRM_ANSWER.notLinedUp('error', 'EIO');
      },
    });
    p = await openConfirmPrompt(page);
    await confirmedVia(page, p);
    await untilText(page, 'tp-held', NOTHING_LINED_UP, 'the line-up failed: no pass was lined up', 10000);
    lines = await heldLines(page);
    expect(codeRe('error').test(lines) || codeRe('EIO').test(lines), 'with the server\'s reason (error, cause EIO)').toBe(true);
    expect(lines, 'Run a pass now, or the next scheduled pass, takes it up').toMatch(RUN_NAMED);
    expect(linedUpClaimsOf(lines), 'never said to be lined up').toEqual([]);
    await untilText(page, 'tp-held', PENDING_STRICT, 'the confirmation is kept pending', 10000);
    expect(m.log.nonGet).toEqual([CONFIRM_POST, CONFIRM_POST]);
  });

  test('B128: with a pass waiting and no stop asked for, confirming starts nothing new — the answer says plainly that the waiting pass takes the confirmation up, and one pass still waits; with every busy pass asked to stop, confirming lines up a new pass, the answer says it is behind the pass that is stopping, and every viewer sees it waiting behind [AC-1 "When a pass is busy: A pass waiting with no stop asked for", "Every busy pass has a stop asked for"; ADR 0007 D2 step 4, D4 waiting-pass, lined-up behindStopping, D11]', async ({ page }) => {
    test.setTimeout(90000);
    const m = await mock(page, S.WAITING);
    await openAndSettle(page);
    const waitingBefore = ((await textOf(page, 'tp-pass')).match(/\bwaiting\b/gi) || []).length;
    let p = await openConfirmPrompt(page);
    await confirmedVia(page, p);
    await expect.poll(async () => sentencesWith(await heldLines(page), /\bwaiting\b/i, TAKES_UP_ANY).length, { message: 'the answer says plainly that the waiting pass takes the confirmation up (D4 waiting-pass)', timeout: 10000 }).toBeGreaterThan(0);
    expect(linedUpClaimsOf(await heldLines(page)), 'it starts nothing new: never "lined up"').toEqual([]);
    await untilText(page, 'tp-held', PENDING_STRICT, 'the confirmation pending', 10000);
    await untilShows(page, 'tp-pass', [WAITING, clockRe(F.PASS_TIMES.waitAsked)], [], 'the waiting pass still waits, since 11:58');
    expect(((await textOf(page, 'tp-pass')).match(/\bwaiting\b/gi) || []).length, 'and no new pass waits beside it').toBe(waitingBefore);

    await reload(page, m, S.ALL_STOPPING);
    p = await openConfirmPrompt(page);
    await confirmedVia(page, p);
    await expect.poll(async () => linedUpClaimsOf(await heldLines(page)).length, { message: 'every busy pass asked to stop: a pass was lined up (D4 lined-up)', timeout: 10000 }).toBeGreaterThan(0);
    expect(await heldLines(page), 'behind the pass that is stopping (D11 "with behind the pass that is stopping when behindStopping")').toMatch(BEHIND_STOPPING);
    await untilShows(page, 'tp-pass', [WAITING, clockRe(F.NOW), BEHIND_PASS], [], 'every viewer sees the new pass waiting behind the one that is stopping', 10000);
    expect(m.log.nonGet).toEqual([CONFIRM_POST, CONFIRM_POST]);
  });

  test('B129: the answer says what happened, never what the prompt expected — a prompt that said a pass lines up, confirmed after a pass began waiting, says the waiting pass takes it up; a pass that had just begun takes it up; a pass that started meanwhile took it up, named by its run; a pass started meanwhile and the confirmation was withdrawn, nothing changed; and when the server cannot tell whether the confirmation stands, the panel says so, never as unchanged, and shows from its next read whether that pass took it up [AC-1 "When a pass starts while the confirmation is being made", AC-2 "The answer says what happened"; ADR 0007 D4 waiting-pass, starting-pass, taken-up, pass-started, withdraw-failed; D11; ratified reading 1]', async ({ page }) => {
    test.setTimeout(150000);
    const CLAIMED = F.runIdAt(F.at(0.1), 'c1a1c1a1');
    const m = await mock(page, S.HELD_NONE);
    // 1. What is busy changed after the prompt opened.
    await openAndSettle(page);
    let p = await openConfirmPrompt(page);
    expect(linesUpNow(await p.text()).length, 'the prompt said a pass lines up now').toBeGreaterThan(0);
    await pauseClock(page);
    m.set(S.WAITING); // a Run lined up meanwhile; no poll has shown it
    await confirmedVia(page, p);
    await expect.poll(async () => sentencesWith(await heldLines(page), /\bwaiting\b/i, TAKES_UP_ANY).length, { message: 'the answer reports what happened: the waiting pass takes it up (AC-2)', timeout: 10000 }).toBeGreaterThan(0);
    expect(linedUpClaimsOf(await heldLines(page)), 'never what the prompt expected ("lined up")').toEqual([]);

    const CASES = [
      {
        what: 'a pass that had just begun takes it up (starting-pass)',
        answer: () => { m.set({ status: F.withConfirmationPending(S.STARTING.status, F.NOW) }); return F.CONFIRM_ANSWER.startingPass(); },
        says: (t) => sentencesWith(t, JUST_BEGUN, TAKES_UP_ANY).length > 0 && linedUpClaimsOf(t).length === 0,
      },
      {
        what: `a pass that started meanwhile took it up (taken-up, claimedBy ${CLAIMED})`,
        answer: F.CONFIRM_ANSWER.takenUp(CLAIMED),
        says: (t) => TAKES_UP_ANY.test(t) && t.includes(CLAIMED) && linedUpClaimsOf(t).length === 0,
      },
      {
        what: 'a pass started meanwhile and the confirmation was withdrawn (409 pass-started)',
        answer: F.CONFIRM_ANSWER.PASS_STARTED,
        says: (t) => PASS_STARTED_MEANWHILE.test(t) && WITHDRAWN.test(t) && linedUpClaimsOf(t).length === 0,
      },
      // Story 7's review, round 1, requested 10: the read after a withdraw-failed answer is staged, both ways, so the
      // panel is seen to show from that read whether that pass took the confirmation up (the title's last clause).
      {
        what: 'the server cannot tell whether the confirmation stands (500 withdraw-failed), and its next read shows it stands',
        answer: () => { m.set(F.SCENE7_R1.WITHDRAW_FAILED_STANDS); return F.CONFIRM_ANSWER.WITHDRAW_FAILED; },
        says: (t) => CANNOT_TELL_STANDS.test(t) && NEXT_READ.test(t) && !STATE_UNCHANGED.test(t) && !NOTHING_CONFIRMED.test(t),
        then: async (what) => {
          await untilText(page, 'tp-held', PENDING_STRICT, `${what}: from that read the panel shows the confirmation pending, so no pass has taken it up yet`, 10000);
          expect(await heldLines(page), `${what}: the confirmation made at 12:00, pending until 24 hours on`).toMatch(clockRe(F.plusTtl(F.NOW)));
          await expect(confirmButton(page), `${what}: and no Confirm while it is pending`).toHaveCount(0);
        },
      },
      {
        what: 'the server cannot tell whether the confirmation stands (500 withdraw-failed), and its next read shows that pass took it up',
        answer: () => { m.set(F.SCENE7_R1.WITHDRAW_FAILED_TOOK_UP); return F.CONFIRM_ANSWER.WITHDRAW_FAILED; },
        says: (t) => CANNOT_TELL_STANDS.test(t) && NEXT_READ.test(t) && !STATE_UNCHANGED.test(t) && !NOTHING_CONFIRMED.test(t),
        then: async (what) => {
          await untilShows(page, 'tp-pass', [TOOK_UP_CONFIRMATION, clockRe(F.NOW)], [], `${what}: from that read the panel shows the latest pass took up the owner's confirmation, made at 12:00 (D12)`, 10000);
          await expect(section(page, 'tp-held'), `${what}: and that pass held nothing`).toHaveAttribute('data-state', 'empty');
          expect(await heldLines(page), `${what}: nothing is pending`).not.toMatch(PENDING_STRICT);
        },
      },
    ];
    for (const c of CASES) {
      await reload(page, m, { ...S.HELD_NONE, confirm: c.answer });
      p = await openConfirmPrompt(page);
      await confirmedVia(page, p);
      await expect.poll(async () => c.says(await heldLines(page)), { message: `${c.what}: the answer says so (D11)`, timeout: 10000 }).toBe(true);
      if (c.then) await c.then(c.what);
    }
    expect(m.log.nonGet, 'one confirmation each, never retried').toEqual(Array(6).fill(CONFIRM_POST));
  });

  test('B130: a prompt that is out of date — a newer pass held another list after it opened — is refused plainly and changes nothing: nothing was confirmed, the panel then shows the new pass\'s held list, and Confirm can be pressed again, its prompt naming the new pass; the other out-of-date refusals (nothing held, the held run running, the held list changed) say the same [AC-2 "Only what the prompt showed. If the latest pass is no longer the one the prompt named, the confirmation is refused plainly and changes nothing. The panel then shows the new state, so the owner can press Confirm again"; ADR 0007 D4 409 not-the-latest-report, nothing-held, running, held-list-changed; D11 "out of date … nothing was confirmed; the panel now shows the latest state"]', async ({ page }) => {
    test.setTimeout(120000);
    const m = await mock(page, S.HELD_NONE);
    await openAndSettle(page);
    const p = await openConfirmPrompt(page);
    expect(await p.text(), 'the prompt names the latest pass').toContain(RUN);
    await pauseClock(page);
    m.set(S.NEWER_HELD); // a newer pass held another list; no poll has shown it
    await confirmedVia(page, p);
    await untilText(page, 'tp-held', NOTHING_CONFIRMED, 'refused plainly: nothing was confirmed (D11 out of date)', 10000);
    expect(linedUpClaimsOf(await heldLines(page)), 'never said to be lined up').toEqual([]);
    await expect(section(page, 'tp-held'), `the panel then shows the new state: the held list of ${NEWER}`).toContainText(NEWER, { timeout: 10000 });
    await expect(section(page, 'tp-held')).toHaveAttribute('data-state', 'ready', { timeout: 10000 });
    expect(await heldLines(page), 'and nothing is pending').not.toMatch(PENDING_STRICT);
    const again = await openConfirmPrompt(page);
    expect(await again.text(), 'Confirm can be pressed again, its prompt naming the new pass').toContain(NEWER);
    await again.cancel.click();
    expect(m.log.nonGet, 'one confirmation sent and refused; nothing retried').toEqual([CONFIRM_POST]);

    for (const [code, answer] of [['nothing-held', F.CONFIRM_ANSWER.NOTHING_HELD], ['running', F.CONFIRM_ANSWER.RUNNING], ['held-list-changed', F.CONFIRM_ANSWER.HELD_LIST_CHANGED]]) {
      await reload(page, m, { ...S.HELD_NONE, confirm: answer });
      const q = await openConfirmPrompt(page);
      await confirmedVia(page, q);
      await untilText(page, 'tp-held', NOTHING_CONFIRMED, `409 ${code}: nothing was confirmed`, 10000);
      expect(linedUpClaimsOf(await heldLines(page)), `409 ${code}: never said to be lined up`).toEqual([]);
    }
  });

  test('B131: the prompt closes by itself, sending nothing, when a read makes Confirm unavailable (another tab\'s confirmation of this list now pending) or changes the pass it named (a newer held list); a read that changes only what is busy leaves it open, its text the one it opened with; and while its own confirmation is under way no read closes it [AC-2 "Only what the prompt showed", "The answer says what happened"; ADR 0007 D10 "The snapshot … never what later polls show", "It closes by itself when a read makes offer false or changes runId, but never while under way. A change in what is busy does not close it"]', async ({ page }) => {
    test.setTimeout(150000);
    const m = await mock(page, S.HELD_NONE);
    // A read that makes offer false.
    await openAndSettle(page);
    let p = await openConfirmPrompt(page);
    await pauseClock(page);
    m.set(S.HISTORY);
    await page.clock.runFor(POLL_MS);
    await expect(heldHeading(page, p.heading), 'a read showing this list\'s confirmation pending closes the prompt by itself').toHaveCount(0, { timeout: 10000 });
    await expect(heldCancel(page), 'its Cancel goes with it').toHaveCount(0);
    await untilText(page, 'tp-held', PENDING_STRICT, 'and the panel shows the confirmation pending', 5000);
    // A read that changes the pass the prompt named.
    await reload(page, m, S.HELD_NONE);
    p = await openConfirmPrompt(page);
    await pauseClock(page);
    m.set(S.NEWER_HELD);
    await page.clock.runFor(POLL_MS);
    await expect(heldHeading(page, p.heading), 'a read naming a newer held list closes the prompt by itself').toHaveCount(0, { timeout: 10000 });
    await expect(section(page, 'tp-held')).toContainText(NEWER, { timeout: 10000 });
    // A read that changes only what is busy.
    await reload(page, m, S.HELD_NONE);
    p = await openConfirmPrompt(page);
    const opened = await p.text();
    await pauseClock(page);
    m.set(S.WAITING);
    await page.clock.runFor(POLL_MS);
    await untilShows(page, 'tp-pass', [WAITING, clockRe(F.PASS_TIMES.waitAsked)], [], 'the read has landed: a pass now waits');
    await wait(500);
    await expect(heldHeading(page, p.heading), 'a change in what is busy leaves the prompt open (D10)').toBeVisible();
    expect(await p.text(), 'and its text is the one it opened with, never rewritten to the waiting case (D10 snapshot)').toBe(opened);
    await p.cancel.click();
    await wait(500);
    expect(m.log.nonGet, 'a prompt that closes by itself sends nothing').toEqual([]);
    // While under way.
    await reload(page, m, S.HELD_NONE);
    p = await openConfirmPrompt(page);
    await pauseClock(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    m.set({ confirm: async () => { await gate; return F.CONFIRM_ANSWER.linedUp(F.OTHER_TAB_JOB_KEY); } });
    try {
      await p.confirm.click();
      await expect.poll(() => m.log.nonGet, { message: 'the confirmation is sent' }).toEqual([CONFIRM_POST]);
      m.set(S.HISTORY);
      const landed = page.waitForResponse((r) => new URL(r.url()).pathname === F.ROUTES.status, { timeout: 10000 });
      await page.clock.runFor(POLL_MS);
      await landed;
      await wait(1000);
      await expect(heldHeading(page, p.heading), 'a read that makes Confirm unavailable, landing while the confirmation is under way, leaves the prompt open (D10 "never while under way")').toBeVisible();
      const busy = heldBusyButtons(page).first();
      await expect(busy, 'its confirm still carries aria-busy="true"').toBeVisible();
      expect(squash(await busy.innerText()), 'and says "Confirming…"').toMatch(CONFIRMING);
    } finally {
      release();
    }
    await expect(heldHeading(page, p.heading), 'the answer closes it').toHaveCount(0, { timeout: 10000 });
    expect(m.log.nonGet).toEqual([CONFIRM_POST]);
  });

  test('B132: when the owner\'s confirmation was used up by a pass that then failed, or was stopped, the held section says so — that pass used the confirmation up, and the removals it did not apply can be confirmed again only once a later pass holds them again: Run a pass now, or the next scheduled pass — and offers no Confirm [AC-1 "When a confirmation is used up by a pass that then failed or was stopped, the panel says so … Until then it offers no Confirm"; ADR 0007 D13 "New, in the !runId branch"]', async ({ page }) => {
    const m = await mock(page, S.USED_UP_FAILED);
    for (const [i, [what, scene]] of [['a pass that failed', S.USED_UP_FAILED], ['a pass that was stopped', S.USED_UP_STOPPED]].entries()) {
      if (i === 0) await openAndSettle(page);
      else await reload(page, m, scene);
      await expect(section(page, 'tp-held'), `${what}: the latest pass held nothing`).toHaveAttribute('data-state', 'empty');
      const lines = await heldLines(page);
      expect(lines, `${what}: it used the owner's confirmation up (D13) — not implemented yet`).toMatch(USED_IT_UP);
      expect(lines, `${what}: the removals it did not apply can be confirmed again`).toMatch(CONFIRM_AGAIN);
      expect(lines, `${what}: only once a later pass holds them again`).toMatch(LATER_HOLDS);
      expect(lines, `${what}: Run a pass now`).toMatch(RUN_NAMED);
      expect(lines, `${what}: or the next scheduled pass`).toMatch(NEXT_SCHEDULED);
      await expect(confirmButton(page), `${what}: no Confirm until then`).toHaveCount(0);
      expect(await refusedConfirmButtons(page)).toEqual([]);
    }
    expect(m.log.nonGet).toEqual([]);
  });

  /* ── AC-3: who may ─────────────────────────────────────────────────────────────────────────────────────────── */

  test('B133: an admin sees "Confirm held removals" disabled, with the reason beside it — only the owner can confirm held removals — exactly where and when the owner would see Confirm, and nowhere else: with no confirmation, one pending for an earlier pass, expired, unreadable, an unreadable expiry, a pass waiting, or a queue it cannot read; never with this list\'s confirmation pending, nothing held, a pass running or starting, a used-up confirmation, or the held list loading or failed; pressing it sends nothing [AC-3 "Admins see a disabled Confirm exactly where and when the owner would see Confirm (AC-1), and nowhere else, with the reason beside it … It sends nothing"; ADR 0007 D9 role "admin", "Both render exactly when offer is true"]', async ({ page }) => {
    test.setTimeout(180000);
    const CASES = [
      ['no confirmation', S.HELD_NONE, true],
      ['a confirmation pending for an earlier pass', S.PENDING_EARLIER, true],
      ['an expired confirmation', S.EXPIRED, true],
      ['an unreadable confirmation', S.UNREADABLE, true],
      ['an unreadable expiry', S.UNKNOWN_EXPIRY, true],
      ['a pass waiting', S.WAITING, true],
      ['the task queue off', S.QUEUE_OFF, true],
      ['this list\'s confirmation pending', S.HELD_PENDING, false],
      ['nothing held', S.NOTHING_HELD, false],
      ['a pass running', S.RUNNING, false],
      ['a pass starting', S.STARTING, false],
      ['a used-up confirmation', S.USED_UP_FAILED, false],
    ];
    const m = await mock(page, { who: 'admin', ...CASES[0][1] });
    for (const [i, [what, scene, offered]] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reload(page, m, scene);
      const lines = await heldLines(page);
      if (offered) {
        const b = confirmButton(page);
        await expect(b, `${what}: the admin sees "${CONFIRM_LABEL}" where the owner would (D9) — not implemented yet`).toBeVisible({ timeout: 5000 });
        await expect(b, `${what}: disabled`).toBeDisabled();
        const beside = await b.evaluate((el, src) => {
          const re = new RegExp(src, 'i');
          let at = el.parentElement;
          for (let k = 0; k < 2 && at && !at.matches('[data-testid="tp-held"]'); k += 1, at = at.parentElement) {
            if (re.test((at.innerText || '').replace(/\s+/g, ' '))) return true;
          }
          return false;
        }, ONLY_OWNER.source);
        expect(beside, `${what}: with the reason beside it — "Only the owner can confirm held removals." (D9)`).toBe(true);
        await b.click({ force: true });
        await wait(300);
        await expect(heldCancel(page), `${what}: pressing it opens no prompt`).toHaveCount(0);
      } else {
        await wait(500);
        await expect(confirmButton(page), `${what}: no Confirm of either kind, as the owner would see none`).toHaveCount(0);
        expect(lines, `${what}: and no "only the owner" reason`).not.toMatch(ONLY_OWNER);
      }
      expect(await refusedConfirmButtons(page), `${what}: no other button named for confirming`).toEqual([]);
    }
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    try {
      await reload(page, m, { ...S.HELD_NONE, held: (req, dflt) => gate.then(() => dflt()) }, ['tp-held']);
      await expect(section(page, 'tp-held')).toHaveAttribute('data-state', 'loading');
      await wait(500);
      await expect(confirmButton(page), 'the held list loading: no Confirm of either kind').toHaveCount(0);
    } finally {
      release();
    }
    await reload(page, m, { ...S.HELD_NONE, held: fail(502) });
    await expect(section(page, 'tp-held')).toHaveAttribute('data-state', 'error');
    await expect(confirmButton(page), 'the held list failed: no Confirm of either kind').toHaveCount(0);
    expect(m.log.nonGet, 'an admin\'s Confirm sends nothing').toEqual([]);
  });

  test('B134: when the server refuses the confirmation (403, no longer the owner; a lapsed session\'s 401) or cannot carry it out (500 record-unavailable, confirmation-unwritten, error), the panel shows the reason — sign in again as the owner, or the failure\'s code and cause — then the held list and the confirmation as they now stand, from a re-read: nothing confirmed, nothing pending, Confirm offered again; never "lined up" [AC-3 "Refused or failed. When the server refuses the panel\'s request, or cannot carry it out, the panel shows the reason. It then shows the held list and the confirmation as they now stand"; AC-4 "When the server cannot record it, Confirm is refused, as Run is, and changes nothing"; ADR 0007 D4 500 rows, D11 "401 or 403: refused, sign in again as the owner", "record-unavailable, confirmation-unwritten, other 5xx: failed, with code and cause"]', async ({ page }) => {
    test.setTimeout(150000);
    const CASES = [
      { what: 'refused: no longer the owner (403)', answer: F.CONFIRM_ANSWER.REFUSED_403, says: (t) => refusedAsOwner(t).length > 0 },
      { what: 'refused: a lapsed session (401)', answer: F.CONFIRM_ANSWER.REFUSED_401, says: (t) => refusedAsOwner(t).length > 0 },
      { what: 'the record could not be written (500 record-unavailable)', answer: F.CONFIRM_ANSWER.RECORD_UNAVAILABLE, says: (t) => codeRe('record-unavailable').test(t) && codeRe('ENOSPC').test(t) },
      { what: 'the confirmation could not be written (500 confirmation-unwritten)', answer: F.CONFIRM_ANSWER.CONFIRMATION_UNWRITTEN, says: (t) => codeRe('confirmation-unwritten').test(t) && codeRe('EIO').test(t) },
      { what: 'a failure (500 error, cause EIO)', answer: F.CONFIRM_ANSWER.FAILED, says: (t) => FAILED_IDEA.test(t) && (codeRe('error').test(t) || codeRe('EIO').test(t)) },
    ];
    const m = await mock(page, { ...S.HELD_NONE, confirm: CASES[0].answer });
    for (const [i, c] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reload(page, m, { ...S.HELD_NONE, confirm: c.answer });
      const p = await openConfirmPrompt(page);
      const mark = m.log.api.length;
      await confirmedVia(page, p);
      await expect.poll(async () => c.says(await heldLines(page)), { message: `${c.what}: the panel shows the reason (D11)`, timeout: 10000 }).toBe(true);
      expect(linedUpClaimsOf(await heldLines(page)), `${c.what}: never said to be lined up`).toEqual([]);
      await expect.poll(() => requestsTo({ api: m.log.api.slice(mark) }, F.ROUTES.status).length, { message: `${c.what}: the status is read again after the answer (AC-3 "as they now stand")` }).toBeGreaterThan(0);
      await expect(section(page, 'tp-held'), `${c.what}: the held list as it stands`).toHaveAttribute('data-state', 'ready', { timeout: 10000 });
      expect(await heldLines(page), `${c.what}: nothing pending`).not.toMatch(PENDING_STRICT);
      await expect(confirmButton(page), `${c.what}: Confirm offered again`).toBeEnabled({ timeout: 5000 });
    }
    expect(m.log.nonGet, 'one confirmation each, nothing retried').toEqual(Array(5).fill(CONFIRM_POST));
  });

  /* ── AC-4: who confirmed ───────────────────────────────────────────────────────────────────────────────────── */

  test('B135: within POLL_MS of a confirmation made in another tab, a viewer who did not press sees it in the history of the last 10 actions — held removals of the pass, confirmed by the owner and its shortened key, at its time, below the start of the pass it lined up (newest first, the same instant) — the confirmation pending and no Confirm [AC-4 "The history of the last 10 actions shows the confirmation"; AC-1 "Every viewer sees it. Within 10 seconds of a confirmation, every viewer\'s panel shows it in the history, and shows it pending … no panel offers Confirm"; ADR 0007 D5 "the start shows above it", D12 passWho confirm lines]', async ({ page }) => {
    const m = await mock(page, S.HELD_NONE);
    await openAndSettle(page);
    // Soft: the case is about the history line below, which it must still reach while Confirm is not built.
    await expect.soft(confirmButton(page), 'before: Confirm — not implemented yet if missing (D9)').toBeVisible({ timeout: 5000 });
    await pauseClock(page);
    m.set(S.HISTORY);
    await page.clock.runFor(POLL_MS);
    const T = F.CONFIRM_TIMES.otherTab;
    await untilShows(page, 'tp-pass', [CONFIRMED_WORD, new RegExp(esc(RUN)), clockRe(T), ...OWNER_WHO], [], `within POLL_MS the history shows the confirmation: held removals of pass ${RUN} confirmed by the owner (${F.OWNER_KEY}…) at 11:59 (D12) — not implemented yet`, 5000);
    await untilText(page, 'tp-held', PENDING_STRICT, 'the confirmation shows pending', 5000);
    await expect(confirmButton(page), 'and no panel offers Confirm for that held list while it is pending').toHaveCount(0);
    const rows = (await section(page, 'tp-pass').locator('ol > li').allInnerTexts()).map(squash);
    const confirmRow = rows.findIndex((t) => CONFIRMED_WORD.test(t) && t.includes(F.OWNER_KEY));
    const startRow = rows.findIndex((t) => START_WORD.test(t) && CONFIRMATION_WHO.test(t) && !t.includes(F.OWNER_KEY));
    expect(confirmRow, `the history lists the confirm line (rows: ${JSON.stringify(rows)})`).toBeGreaterThanOrEqual(0);
    expect(startRow, 'and the start of the pass it lined up, by the owner\'s confirmation').toBeGreaterThanOrEqual(0);
    expect(startRow, 'newest first, the start written in the same commit shows above the confirm line (D5)').toBeLessThan(confirmRow);
    expect(m.log.nonGet, 'a viewer who did not press sends nothing').toEqual([]);
  });

  test('B136: the pass that took a confirmation up names it — it took up the owner\'s confirmation (with the shortened key from the record\'s confirm line made at that time) made at 11:51 — above what it did with it, which stays as today: it honoured it and applied all 120 confirmed removals; with no confirm line at that time it names no key; and a report from before story 7 reads "when not recorded" [AC-4 "The pass that took a confirmation up names it: the owner\'s confirmation, and when it was made. What it says it did with it stays as today"; ADR 0007 D7 latest.confirmation.mintedAt, D12 runWho confirmation "with the key when a confirm line in the record has at === mintedAt", "(when not recorded) when mintedAt is absent", "above today\'s honoured and why lines"]', async ({ page }) => {
    const M = F.CONFIRM_TIMES.tookUp;
    const m = await mock(page, S.TOOK_UP);
    await openAndSettle(page);
    await untilShows(page, 'tp-pass', [TOOK_UP_CONFIRMATION, clockRe(M), ...OWNER_WHO], [], `the latest pass took up the owner's confirmation (${F.OWNER_KEY}…), made at 11:51 (D12) — not implemented yet`, 5000);
    const text = await textOf(page, 'tp-pass');
    const claims = removalClaims(text).filter((s) => numRe(F.HELD_TOTAL).test(s));
    expect(claims.length, `what it did stays as today: it applied ${F.HELD_TOTAL} of the confirmed removals`).toBeGreaterThan(0);
    for (const s of claims) expect(s, 'stated exactly, never more than it applied').not.toMatch(LOWER_BOUND);
    expect(text.search(TOOK_UP_CONFIRMATION), 'the took-up line shows above the honoured line (D12)').toBeLessThan(text.search(/\bhonou?red\b/i));

    await reload(page, m, S.TOOK_UP_NO_LINE);
    await untilShows(page, 'tp-pass', [TOOK_UP_CONFIRMATION, clockRe(M)], [new RegExp(esc(F.OWNER_KEY))], 'no confirm line made at that time in the record: the line names when, and no key (D12)', 5000);
    await reload(page, m, S.TOOK_UP_UNDATED);
    await untilShows(page, 'tp-pass', [TOOK_UP_CONFIRMATION, WHEN_NOT_RECORDED], [], 'a report from before story 7 (no mintedAt): it took up the owner\'s confirmation, when not recorded (D7, D12)', 5000);
    expect(m.log.nonGet).toEqual([]);
  });

  test('B137: a pass that found the owner\'s confirmation and did not honour it names it — it took up the owner\'s confirmation made at 11:13 — and says, as today, that it did not honour it and why (a newer pass had held another list), never that it applied any [AC-4 "What it says it did with it stays as today: whether it honoured it, and why not if it did not"; ADR 0007 D7 "set on found: true only, honoured or not", D12]', async ({ page }) => {
    const m = await mock(page, S.NOT_HONOURED);
    await openAndSettle(page);
    const M = F.CONFIRM_TIMES.notHonoured;
    await untilShows(page, 'tp-pass', [TOOK_UP_CONFIRMATION, clockRe(M), ...OWNER_WHO], [], 'the latest pass took up the owner\'s confirmation made at 11:13 (D7, D12) — not implemented yet', 5000);
    const text = await textOf(page, 'tp-pass');
    expect(text, 'it did not honour it').toMatch(DID_NOT_HONOUR);
    expect(text, 'and why, explained').toContain(explanation('confirmationWhy', 'report-changed'));
    expect(text.search(TOOK_UP_CONFIRMATION), 'the took-up line shows above the why line (D12)').toBeLessThan(text.search(DID_NOT_HONOUR));
    expect(appliedClaims(text), 'never that it applied any confirmed removal').toEqual([]);
    expect(m.log.nonGet).toEqual([]);
  });

  /* ── AC-5: an overdue pass is flagged ──────────────────────────────────────────────────────────────────────── */

  test('B138: when the status says the pass is overdue, every viewer sees a warning in the backstop section — the pass is overdue, when the latest pass began (04:50) and when one was expected (10:50) — in the warn tone; with the pass on time, no enabled entry (the no-backstop warning stands), no entry that runs it, or no pass on record (the pass section says none has run), there is no overdue line [AC-5 "What every viewer sees", "No warning"; ADR 0007 D8 states, D14 "overdue: The pass is overdue: the latest pass began at …, and the schedule expected the next by …", "on-time, no-entry, no-schedule and no-pass: no line", "tone becomes warn"]', async ({ page }) => {
    test.setTimeout(120000);
    const O = F.OVERDUE.OVERDUE;
    const m = await mock(page, { who: 'admin', ...S.OVERDUE });
    await openAndSettle(page);
    await untilShows(page, 'tp-schedule', [OVERDUE_WORD, clockRe(O.latestBeganAt), clockRe(O.expectedAt)], [OVERDUE_CANNOT_TELL], 'the backstop section says the pass is overdue, when the latest pass began (04:50) and when one was expected (10:50) (D14) — not implemented yet', 5000);
    expect(overdueWaitingLines(await textOf(page, 'tp-schedule')), 'nothing waits: no "a pass is waiting" line').toEqual([]);
    expect(await section(page, 'tp-schedule').getAttribute('style') || '', 'the section is in the warn tone (D14)').toMatch(/--orange/);
    const QUIET = [
      ['the pass on time', { ...S.HELD_NONE, schedule: F.SCHEDULE.ONE }, [/\b6\s?(?:hours?|hrs?|h)\b/i]],
      ['no enabled entry', { ...S.NO_ENTRY_VERDICT, schedule: F.SCHEDULE.NONE }, [NO_BACKSTOP]],
      ['no entry that runs the pass', { ...S.NO_SCHEDULE_VERDICT, schedule: F.SCHEDULE.ONE }, [/\b6\s?(?:hours?|hrs?|h)\b/i]],
      ['no pass on record', { ...S.NO_PASS, schedule: F.SCHEDULE.ONE }, [/\b6\s?(?:hours?|hrs?|h)\b/i]],
    ];
    for (const [what, patch, stands] of QUIET) {
      await reload(page, m, patch);
      const text = await textOf(page, 'tp-schedule');
      for (const re of stands) expect(text, `${what}: the backstop section's existing lines stand (${re})`).toMatch(re);
      expect(text, `${what}: no overdue line (D14)`).not.toMatch(OVERDUE_WORD);
    }
    expect(await textOf(page, 'tp-pass'), 'no pass on record: the pass section says no pass has run').toMatch(NO_PASS_YET);
    await reload(page, m, { ...S.HELD_NONE, schedule: F.SCHEDULE.ONE });
    expect(await section(page, 'tp-schedule').getAttribute('style') || '', 'on time, with one 6-hourly entry: not in the warn tone').not.toMatch(/--orange|--red/);
    expect(m.log.nonGet, 'it is only a warning: it sends nothing').toEqual([]);
  });

  test('B139: while a pass waits the pass is still overdue, and the warning says a pass is waiting and that it clears when that pass begins running; within POLL_MS of the pass beginning, the warning is gone; it starts nothing [AC-5 "A pass that is waiting … has not begun. So the warning stays while a pass waits, and says that one is waiting", "It clears within 10 seconds of a new pass beginning", "It is only a warning"; ADR 0007 D8, D14 "When busy shows a waiting item: A pass is waiting; the warning clears when it begins running."]', async ({ page }) => {
    const O = F.OVERDUE.OVERDUE;
    const m = await mock(page, S.OVERDUE_WAITING);
    await openAndSettle(page);
    await untilShows(page, 'tp-schedule', [OVERDUE_WORD, clockRe(O.latestBeganAt), clockRe(O.expectedAt)], [OVERDUE_CANNOT_TELL], 'a pass waits and the pass is still overdue (D14) — not implemented yet', 5000);
    expect(overdueWaitingLines(await textOf(page, 'tp-schedule')).length, 'the warning says a pass is waiting, and clears when it begins running (D14)').toBeGreaterThan(0);
    await pauseClock(page);
    m.set(S.OVERDUE_CLEARED);
    await page.clock.runFor(POLL_MS);
    await expect.poll(async () => OVERDUE_WORD.test(await textOf(page, 'tp-schedule')), { message: 'within POLL_MS of the pass beginning, the warning is gone (AC-5 "It clears within 10 seconds")', timeout: 5000 }).toBe(false);
    expect(m.log.nonGet, 'it starts nothing').toEqual([]);
  });

  test('B140: when the panel cannot tell whether the pass is overdue — the server could not read the schedule, a rule it cannot judge, an unreadable report time, a status with no overdue member, or a status read that failed — the backstop section says it cannot tell, with the reason it has, and never that the pass is overdue; before the status has answered it says the overdue check is still being made [AC-5 "When it cannot tell … the backstop section says it cannot tell whether the pass is overdue. A missing warning never stands for on time"; ADR 0007 D8 cannot-tell reasons, R13; D14 "cannot-tell, an absent overdue member, or a status read that failed with no body", "While the status has not answered"]', async ({ page }) => {
    test.setTimeout(150000);
    const CASES = [
      ['the schedule could not be read on the server', S.CANNOT_TELL_SCHEDULE, /\bschedul\w*\b/i],
      ['a rule the server cannot judge', S.CANNOT_TELL_RULE, /\brule\b/i],
      ['the latest pass\'s start cannot be read', S.CANNOT_TELL_REPORT, /\breport\b/i],
      ['a status with no overdue member (a server before story 7)', F.SCENE.IDLE, null],
    ];
    const m = await mock(page, CASES[0][1]);
    for (const [i, [what, scene, reason]] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reload(page, m, scene);
      const text = await textOf(page, 'tp-schedule');
      expect(text, `${what}: the backstop section says it cannot tell whether the pass is overdue (D14) — not implemented yet`).toMatch(OVERDUE_CANNOT_TELL);
      if (reason) {
        const at = text.search(OVERDUE_CANNOT_TELL);
        expect(text.slice(at, at + 300), `${what}: with the reason (${reason})`).toMatch(reason);
      }
      expect(overdueClaims(text), `${what}: never that the pass is overdue`).toEqual([]);
    }
    await reload(page, m, { ...S.HELD_NONE, status: fail(500) }, ['tp-held']);
    await expect(section(page, 'tp-pass'), 'the status read failed').toHaveAttribute('data-state', 'error');
    expect(await textOf(page, 'tp-schedule'), 'a status read that failed with no body: cannot tell (D14)').toMatch(OVERDUE_CANNOT_TELL);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    try {
      await reload(page, m, { ...S.OVERDUE, status: () => gate.then(() => S.OVERDUE.status) }, ['tp-pass', 'tp-held', 'tp-drift']);
      await expect(section(page, 'tp-pass'), 'the status has not answered').toHaveAttribute('data-state', 'loading');
      await settled(page, 'tp-schedule');
      const text = await textOf(page, 'tp-schedule');
      expect(text, 'whether the pass is overdue is still being checked (D14)').toMatch(OVERDUE_CHECKING);
      expect(text, 'not "cannot tell" before the status has answered').not.toMatch(OVERDUE_CANNOT_TELL);
      expect(overdueClaims(text), 'and no verdict yet').toEqual([]);
    } finally {
      release();
    }
    expect(m.log.nonGet).toEqual([]);
  });

  test('B141: the overdue warning shows in the backstop section whatever the schedule list\'s own read is doing — while it is still loading, and beside its failure, which the section still names — since it comes from the status [AC-5; ADR 0007 D14 "It renders in every ScheduleSection branch, loading and failed ones included"; R12 "The backstop section then shows the list\'s failure and the verdict side by side"]', async ({ page }) => {
    const O = F.OVERDUE.OVERDUE;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const m = await mock(page, { ...S.OVERDUE, schedule: () => gate.then(() => F.SCHEDULE.ONE) });
    try {
      await openAndSettle(page, ['tp-schedule']);
      await expect(section(page, 'tp-schedule'), 'the schedule list is still loading').toHaveAttribute('data-state', 'loading');
      await untilShows(page, 'tp-schedule', [OVERDUE_WORD, clockRe(O.latestBeganAt), clockRe(O.expectedAt)], [OVERDUE_CANNOT_TELL], 'while the list loads, the overdue warning shows (D14) — not implemented yet', 5000);
    } finally {
      release();
    }
    await reload(page, m, { ...S.OVERDUE, schedule: fail(500) });
    await expect(section(page, 'tp-schedule'), 'the schedule list\'s read failed').toHaveAttribute('data-state', 'error');
    const text = await textOf(page, 'tp-schedule');
    expect(text, 'the section names the failed read, with its code').toMatch(codeRe('http-500'));
    await untilShows(page, 'tp-schedule', [OVERDUE_WORD, clockRe(O.latestBeganAt), clockRe(O.expectedAt)], [OVERDUE_CANNOT_TELL], 'and beside it, the overdue warning (R12)', 5000);
    expect(m.log.nonGet).toEqual([]);
  });

  test('B142: a viewer whose device clock is wrong — three days ahead, or three days behind — sees the same as everyone else: no overdue line while the server says on time, and the server\'s times when it says overdue [AC-5 "The same for every viewer. A viewer whose device clock is wrong sees the same as everyone else"; ADR 0007 D8 "computed per request from server time", D14 overdueView "pure, clock-free"]', async ({ page }) => {
    test.setTimeout(90000);
    const O = F.OVERDUE.OVERDUE;
    const DAY = 24 * 60 * 60 * 1000;
    const m = await mock(page, S.HELD_NONE);
    for (const [i, skew] of [3 * DAY, -3 * DAY].entries()) {
      const when = skew > 0 ? 'three days ahead' : 'three days behind';
      await page.clock.setSystemTime(new Date(Date.parse(F.NOW) + skew));
      if (i === 0) await openAndSettle(page);
      else await reload(page, m, S.HELD_NONE);
      const onTime = await textOf(page, 'tp-schedule');
      expect(onTime, `${when}: the server says on time, so the backstop section's own line stands`).toMatch(/\b6\s?(?:hours?|hrs?|h)\b/i);
      expect(onTime, `${when}: and there is no overdue line, whatever the device clock says`).not.toMatch(OVERDUE_WORD);
      await reload(page, m, S.OVERDUE);
      await untilShows(page, 'tp-schedule', [OVERDUE_WORD, clockRe(O.latestBeganAt), clockRe(O.expectedAt)], [OVERDUE_CANNOT_TELL], `${when}: the server says overdue, and the panel shows its times, 04:50 and 10:50 — not implemented yet`, 5000);
    }
    expect(m.log.nonGet).toEqual([]);
  });

  /* ── AC-6: prompts return focus ────────────────────────────────────────────────────────────────────────────── */

  test('B143: the Turn off prompt returns focus — after Cancel, to "Turn off"; after confirming, to the path section\'s heading while the change is under way, then to the line that says what happened; when it closes by itself with focus inside it, to the path section\'s heading, never to "Turn on"; and when focus was elsewhere it stays there; never on the page itself [AC-6 "After Cancel, keyboard focus goes back to the control that opened the prompt", "Otherwise … focus goes to the line that says what happened, or if there is none, to that section\'s heading", "Never lost"; ADR 0007 D15 "Turn off closes at once on confirm: focus goes to the path section\'s heading. When its outcome line then appears … focus moves to the line", "It does nothing when wasInside is false"; ledger 2026-10-28-panel-prompts-return-no-focus]', async ({ page }) => {
    test.setTimeout(150000);
    const m = await mock(page);
    await openAndSettle(page);
    let p = await openPrompt(page);
    await expect(p.cancel).toBeFocused();
    await p.cancel.click();
    await untilFocus(page, (f) => f.button && f.section === 'tp-path' && f.text === 'Turn off', 'after Cancel, focus goes back to "Turn off", the control that opened the prompt (D15) — not implemented yet: today it falls to the page');

    p = await openPrompt(page);
    await pauseClock(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    m.set({ switch: async (req, server) => { await gate; return server(); } });
    try {
      await p.confirm.click();
      await expect.poll(() => m.log.nonGet, { message: 'the off is sent' }).toEqual([SWITCH_POST]);
      await untilFocus(page, onSectionHeading('tp-path'), 'confirming closes the prompt at once: focus goes to the path section\'s heading while the change is under way, never to the disabled control (D15)');
    } finally {
      release();
    }
    await untilFocus(page, onOutcomeLine('tp-path', TURNED_OFF), 'once the answer comes, focus moves to the line that says what happened: the path was turned off (D15)');

    await reload(page, m, { realtime: F.REALTIME.ON_LIVE, record: undefined, switch: undefined });
    p = await openPrompt(page);
    await expect(p.cancel, 'focus is inside the prompt, on Cancel').toBeFocused();
    await pauseClock(page);
    m.set({ realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.OFF_BY_ADMIN });
    await page.clock.runFor(POLL_MS);
    await expect(cancelButton(page), 'a read shows the path off: the prompt closes by itself').toHaveCount(0, { timeout: 5000 });
    await untilFocus(page, onSectionHeading('tp-path'), 'with focus inside it, focus goes to the path section\'s heading (no line says what happened), never to "Turn on" (D15)');

    await reload(page, m, { realtime: F.REALTIME.ON_LIVE, record: undefined });
    p = await openPrompt(page);
    const recount = section(page, 'tp-drift').getByRole('button', { name: 'Recount', exact: true });
    await recount.focus();
    await expect(recount, 'setup: focus is outside the prompt, on Recount').toBeFocused();
    await pauseClock(page);
    m.set({ realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.OFF_BY_ADMIN });
    await page.clock.runFor(POLL_MS);
    await expect(cancelButton(page), 'the prompt closes by itself').toHaveCount(0, { timeout: 5000 });
    await wait(500);
    await expect(recount, 'focus was not inside it: it stays on Recount (D15 "It does nothing when wasInside is false")').toBeFocused();
    expect(m.log.nonGet).toEqual([SWITCH_POST]);
  });

  test('B144: the Stop prompt returns focus — after Cancel, to "Stop"; after Cancel with "Stop" gone (every busy pass now asked to stop), to the pass section\'s heading; while its stop is under way, to its own heading; after the answer, to the line that says what happened; after no answer in 15 s, to the line that says the outcome is unknown; when it closes by itself with focus inside it, to the pass section\'s heading — never to "Run a pass now", never to the page itself [AC-6; ADR 0007 D15 "cancel: focuses the opener\'s ref when it is mounted and not disabled; otherwise, or when the opener is gone: the outcome line when shown, else the section\'s heading", "While under way … moves focus to its own h4", "Never on Turn on or Run a pass now"]', async ({ page }) => {
    test.setTimeout(180000);
    const K = F.PASS_KEYS;
    const m = await mock(page, F.SCENE.WAITING_ASKED);
    await openAndSettle(page);
    let p = await openStopPrompt(page);
    await p.cancel.click();
    await untilFocus(page, (f) => f.button && f.section === 'tp-pass' && f.text === 'Stop', 'after Cancel, focus goes back to "Stop" (D15) — not implemented yet: today it falls to the page');

    p = await openStopPrompt(page);
    await pauseClock(page);
    m.set(F.SCENE.STOP_ASKED);
    await page.clock.runFor(POLL_MS);
    await untilShows(page, 'tp-pass', [STOP_ASKED], [], 'the read has landed: every busy pass has a stop asked for, so "Stop" is gone', 5000);
    await expect(passHeading(page, p.heading), 'the prompt stays open: a pass is still busy (ADR 0006 D17)').toBeVisible();
    await p.cancel.click();
    await untilFocus(page, onSectionHeading('tp-pass'), 'after Cancel with its opener gone, focus goes to the pass section\'s heading (no line says what happened), never to "Run a pass now" (D15)');

    await reload(page, m, F.SCENE.WAITING_ASKED);
    p = await openStopPrompt(page);
    await pauseClock(page);
    let release;
    let gate = new Promise((resolve) => { release = resolve; });
    m.set({ stop: async (req, server) => { await gate; return server(); } });
    try {
      await p.confirm.click();
      await expect.poll(() => m.log.nonGet.filter((l) => l === STOP_POST).length, { message: 'the stop is sent' }).toBe(1);
      await untilFocus(page, onHeadingNamed('tp-pass', p.heading), 'while its stop is under way, focus is on the prompt\'s own heading, never on its disabled button (D15)');
    } finally {
      release();
    }
    await untilFocus(page, onOutcomeLine('tp-pass', TAKEN_OUT), 'after the answer, focus goes to the line that says what happened: the waiting pass was taken out of line (D15)');

    await reload(page, m, { ...F.SCENE.WAITING_ASKED, stop: undefined });
    p = await openStopPrompt(page);
    await pauseClock(page);
    gate = new Promise((resolve) => { release = resolve; });
    m.set({
      stop: async () => { await gate; return F.STOP_ANSWER.stopped([{ key: K.WAITING, how: 'taken-out-of-line' }]); },
      status: async () => { await gate; return F.SCENE.IDLE.status; },
      passRecord: async () => { await gate; return F.SCENE.WAITING_ASKED.passRecord; },
    });
    try {
      await p.confirm.click();
      await expect.poll(() => m.log.nonGet.filter((l) => l === STOP_POST).length, { message: 'the stop is sent' }).toBe(2);
      await page.clock.runFor(15000);
      await untilFocus(page, onOutcomeLine('tp-pass', OUTCOME_UNKNOWN), 'no answer in 15 s: the prompt closes and focus goes to the line that says the outcome is unknown (D15)');
    } finally {
      release();
    }

    await reload(page, m, { ...F.SCENE.WAITING_ASKED, stop: undefined });
    p = await openStopPrompt(page);
    await expect(p.cancel, 'focus is inside the prompt, on Cancel').toBeFocused();
    await pauseClock(page);
    m.set(F.SCENE.IDLE);
    await page.clock.runFor(POLL_MS);
    await expect(passHeading(page, p.heading), 'a read shows nothing busy: the prompt closes by itself').toHaveCount(0, { timeout: 10000 });
    await untilFocus(page, onSectionHeading('tp-pass'), 'with focus inside it, focus goes to the pass section\'s heading, never to "Run a pass now" (D15)');
    expect(m.log.nonGet, 'two stops sent, each once').toEqual([STOP_POST, STOP_POST]);
  });

  test('B145: the Confirm prompt returns focus — after Cancel, to "Confirm held removals"; while its confirmation is under way, to its own heading; after the answer, to the line that says what happened; after a refusal, to the refusal\'s line; when it closes by itself with focus inside it, to the held section\'s heading; and when focus was elsewhere it stays there; never on the page itself [AC-6 "This covers each of the panel\'s prompts (Turn off, Stop and Confirm), however it closes"; ADR 0007 D15 targets (Confirm\'s outcome line in HeldSection), "While under way", "It does nothing when wasInside is false"]', async ({ page }) => {
    test.setTimeout(150000);
    const m = await mock(page, S.HELD_NONE);
    await openAndSettle(page);
    let p = await openConfirmPrompt(page);
    await p.cancel.click();
    await untilFocus(page, (f) => f.button && f.section === 'tp-held' && f.text === CONFIRM_LABEL, `after Cancel, focus goes back to "${CONFIRM_LABEL}" (D15)`);

    p = await openConfirmPrompt(page);
    await pauseClock(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    m.set({ confirm: async (req, server) => { await gate; return server(); } });
    try {
      await p.confirm.click();
      await expect.poll(() => m.log.nonGet, { message: 'the confirmation is sent' }).toEqual([CONFIRM_POST]);
      await untilFocus(page, onHeadingNamed('tp-held', p.heading), 'while the confirmation is under way, focus is on the prompt\'s own heading (D15)');
    } finally {
      release();
    }
    await untilFocus(page, onOutcomeLine('tp-held', /\blined up\b/i), 'after the answer, focus goes to the line that says what happened: a pass was lined up (D15)');

    await reload(page, m, { ...S.HELD_NONE, confirm: F.CONFIRM_ANSWER.NOT_LATEST });
    p = await openConfirmPrompt(page);
    await p.confirm.click();
    await untilFocus(page, onOutcomeLine('tp-held', NOTHING_CONFIRMED), 'after a refusal, focus goes to the line that says what happened: nothing was confirmed (D15)');

    await reload(page, m, S.HELD_NONE);
    p = await openConfirmPrompt(page);
    await expect(p.cancel, 'focus is inside the prompt, on Cancel').toBeFocused();
    await pauseClock(page);
    m.set(S.HISTORY);
    await page.clock.runFor(POLL_MS);
    await expect(heldHeading(page, p.heading), 'another tab\'s confirmation is now pending: the prompt closes by itself').toHaveCount(0, { timeout: 10000 });
    await untilFocus(page, onSectionHeading('tp-held'), 'with focus inside it, focus goes to the held section\'s heading (no line says what happened) (D15)');

    await reload(page, m, S.HELD_NONE);
    p = await openConfirmPrompt(page);
    const recount = section(page, 'tp-drift').getByRole('button', { name: 'Recount', exact: true });
    await recount.focus();
    await pauseClock(page);
    m.set(S.HISTORY);
    await page.clock.runFor(POLL_MS);
    await expect(heldHeading(page, p.heading), 'the prompt closes by itself').toHaveCount(0, { timeout: 10000 });
    await wait(500);
    await expect(recount, 'focus was not inside it: it stays on Recount (D15)').toBeFocused();
    expect(m.log.nonGet).toEqual([CONFIRM_POST, CONFIRM_POST]);
  });

  /* ── AC-7: the copy that changes, and the request pin ──────────────────────────────────────────────────────── */

  test('B146: the panel\'s opening line names confirming held removals, for the owner, beside switching the path and running or stopping a pass [AC-7 "the panel\'s opening line, which names what it changes"; ADR 0007 D16 "The opening line adds that the owner can confirm held removals"]', async ({ page }) => {
    await mock(page, S.HELD_NONE);
    await openAndSettle(page);
    const line = squash(await page.locator('h2', { hasText: TAB }).locator('xpath=following-sibling::p[1]').innerText());
    expect(line, 'it names confirming held removals (D16) — not implemented yet').toMatch(OPENING_CONFIRMS);
    expect(sentencesWith(line, OPENING_CONFIRMS).some((x) => /\bowner\b/i.test(x)), 'for the owner (D16 "the owner can confirm held removals")').toBe(true);
    expect(line, 'and still running a pass (story 6, D19)').toMatch(/\brun\b/i);
    expect(line, 'and stopping one').toMatch(/\bstop\b/i);
    expect(line, 'and the path\'s switch').toMatch(/\bswitch\b/i);
  });

  test('B147: on a held list with Confirm offered, a viewer who does not press it sends only GETs, from the routes stories 4–6 read (story 7 adds no read route), for 30 s of polls; pressing Confirm and cancelling sends nothing; confirming sends exactly one POST, to the confirm route, as JSON {"runId"} [story 7 Test tasks "The request pins … allow exactly this story\'s confirmation, any read route the Architecture adds, and nothing else"; AC-7 "The panel\'s reads still change nothing"; ADR 0007 § Seams "the request pins allow sendConfirm\'s POST and no new read route", D11]', async ({ page }) => {
    const m = await mock(page, { ...S.HELD_NONE, realtime: F.REALTIME.OFF_WITH_FIGURES, drift: F.DRIFT.CLEAN });
    await openAndSettle(page);
    await expect(confirmButton(page), 'Confirm is offered — not implemented yet if missing (D9)').toBeVisible({ timeout: 5000 });
    await pauseClock(page);
    const start = m.log.api.length;
    for (let step = 1; step <= 30000 / POLL_MS; step += 1) {
      await page.clock.runFor(POLL_MS);
      await wait(150);
    }
    const open = m.log.api.slice(start);
    const reads = open.map((l) => l.split(' ')[1].split('?')[0]).filter((p) => /^\/api\/(tagging-edges|scheduled-tasks)\//.test(p));
    const allowed = new Set([F.ROUTES.status, F.ROUTES.realtime, F.ROUTES.schedule, F.ROUTES.drift, F.ROUTES.held, F.ROUTES.switch, F.ROUTES.passRecord]);
    expect([...new Set(reads)].filter((p) => !allowed.has(p)), 'it reads only the routes stories 4–6 read: story 7 adds no read route (ADR 0007 § Seams)').toEqual([]);
    expect(m.log.nonGet, 'a viewer who does not press Confirm sends only GETs').toEqual([]);
    const p = await openConfirmPrompt(page);
    await p.cancel.click();
    await wait(500);
    expect(m.log.nonGet, 'pressing Confirm and cancelling sends nothing').toEqual([]);
    const q = await openConfirmPrompt(page);
    await q.confirm.click();
    await expect.poll(() => m.log.nonGet, { message: 'confirming sends exactly one POST, to the confirm route' }).toEqual([CONFIRM_POST]);
    await wait(1000);
    expect(m.log.nonGet, 'and nothing else that is not a GET').toEqual([CONFIRM_POST]);
    expect(m.log.nonGet.filter((l) => !ALLOWED_POSTS.includes(l)), 'every non-GET is one of the four POSTs the panel may send').toEqual([]);
    expect(JSON.parse(m.log.sent[0].body || 'null'), 'its body is {"runId"}').toEqual({ runId: RUN });
    expect(m.log.sent[0].contentType || '', 'as JSON').toMatch(/^application\/json\b/i);
  });

  /* ── Story 7's review, round 1: blocking 1, requested 2, 5 and 10 (ADR 0007 § Fix-round notes, D14, D15) ─────── */

  const R1 = F.SCENE7_R1;
  /** Mark the element that has focus now, so a later check can tell whether focus is still on that same element. */
  const markFocused = (page) => page.evaluate(() => {
    window.__tpMarked = document.activeElement;
    return !!window.__tpMarked && window.__tpMarked !== document.body && window.__tpMarked !== document.documentElement;
  });
  /** Is focus still on the marked element, and is that element still in the page? */
  const onMarked = (page) => page.evaluate(() => ({
    same: !!window.__tpMarked && document.activeElement === window.__tpMarked,
    connected: !!window.__tpMarked && window.__tpMarked.isConnected,
  }));
  /** From now on, note every element focus moves to (focusin), as "<tag> in <section>: text". */
  const logFocusMoves = (page) => page.evaluate((ids) => {
    window.__tpFocusMoves = [];
    if (window.__tpFocusLogging) return;
    window.__tpFocusLogging = true;
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      const sec = el && el.closest ? el.closest(ids.map((id) => `[data-testid="${id}"]`).join(',')) : null;
      const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      window.__tpFocusMoves.push(`<${String(el.tagName).toLowerCase()}> in ${sec ? sec.getAttribute('data-testid') : 'no panel section'}: "${text}"`);
    }, true);
  }, SECTIONS);
  const focusMoves = (page) => page.evaluate(() => window.__tpFocusMoves || []);
  /** Focus still satisfies `ok` (a short wait for the render to settle, not for focus to come back), and is not lost. */
  const stillFocused = async (page, ok, what) => {
    await expect.poll(async () => { const f = await focusAt(page); return ok(f) ? 'there' : focusSummary(f); }, { message: what, timeout: 2000 }).toBe('there');
    expectNotLost(await focusAt(page), what);
  };
  /** The reason ADR 0007's D14 note gives when the status read has failed: the pass status could not be read. */
  const STATUS_UNREAD = /\bstatus\b[^.]*\b(?:could not|couldn't|cannot|can't) be read\b|\b(?:could not|couldn't|cannot|can't) read\b[^.]*\bstatus\b/i;

  test('B148: focus on the line that says what a confirmation did stays on that same line while the next reads move the held section between its branches — after "a pass was lined up", through the read that shows the pass running and the read that shows it ended; and the same after "the pass already waiting takes it up" — the line still shown each time, focus never on the page itself [AC-6 "Never lost. Focus never falls to the page itself"; ADR 0007 D15 "Each outcome line (… Confirm\'s in HeldSection) is a <p tabIndex={-1}> with a ref", § Fix-round notes D15 "The Confirm prompt and its answer line keep one element identity across the held section\'s branches … A read that changes the branch never remounts them, so focus on them survives it"; D11 "The outcome shows in the held section until the next Confirm is sent"; review round 1, blocking 1; ledger 2026-10-28-panel-prompts-return-no-focus]', async ({ page }) => {
    test.setTimeout(120000);
    const CASES = [
      { what: 'a pass was lined up', scene: S.HELD_NONE, line: /\blined up\b/i },
      { what: 'the pass already waiting takes it up', scene: S.WAITING, line: /\bwaiting\b[^.]*\btakes?\b[^.]*\bup\b/i },
    ];
    const STEPS = [
      ['the next read shows the pass running', S.RUNNING, /\bpass is running\b/i],
      ['the read after it shows the pass ended, holding nothing', S.TOOK_UP, /\bheld no removals\b/i],
    ];
    const m = await mock(page, CASES[0].scene);
    for (const [i, c] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reload(page, m, c.scene);
      const p = await openConfirmPrompt(page);
      await confirmedVia(page, p);
      await untilFocus(page, onOutcomeLine('tp-held', c.line), `${c.what}: setup — after the answer, focus is on the line that says so (D15; B145)`);
      expect(await markFocused(page), `${c.what}: setup — that line is marked`).toBe(true);
      await pauseClock(page);
      for (const [step, scene, landed] of STEPS) {
        m.set(scene);
        await page.clock.runFor(POLL_MS);
        await untilText(page, 'tp-held', landed, `${c.what}, ${step}: the read has landed in the held section`, 5000);
        expect(await heldLines(page), `${c.what}, ${step}: the line still says what the confirmation did (D11)`).toMatch(c.line);
        await stillFocused(page, onOutcomeLine('tp-held', c.line), `${c.what}, ${step}: focus stays on that line (AC-6 "Never lost"; ADR 0007 § Fix-round notes D15) — today the held section's branch change remounts the line and focus falls to the page`);
        expect(await onMarked(page), `${c.what}, ${step}: and it is the same element, never remounted (D15 note "one element identity")`).toEqual({ same: true, connected: true });
      }
    }
    expect(m.log.nonGet, 'one confirmation each').toEqual([CONFIRM_POST, CONFIRM_POST]);
  });

  test('B149: with the Confirm prompt open and not under way, and focus moved out of it to another section\'s control, a read that takes the held section from its held list to none — a newer pass ran and ended between two polls, holding nothing — closes the prompt by itself and moves no focus: never to the prompt\'s Cancel, never to the held section\'s heading; focus stays where the owner put it, and nothing is sent [AC-6; ADR 0007 D10 "It closes by itself when a read makes offer false or changes runId", D15 "It does nothing when wasInside is false, so a prompt that closes by itself never takes focus from elsewhere", § Fix-round notes D15 "A read that changes the branch never remounts them"; review round 1, blocking 1 (the panel lane\'s UI-2)]', async ({ page }) => {
    const m = await mock(page, S.HELD_NONE);
    await openAndSettle(page);
    const p = await openConfirmPrompt(page);
    const recount = section(page, 'tp-drift').getByRole('button', { name: 'Recount', exact: true });
    await recount.focus();
    await expect(recount, 'setup: focus is outside the prompt, on Recount').toBeFocused();
    await logFocusMoves(page);
    await pauseClock(page);
    m.set(R1.ENDED_CLEAN);
    await page.clock.runFor(POLL_MS);
    await expect(heldHeading(page, p.heading), 'a read showing a newer pass that held nothing closes the prompt by itself (D10)').toHaveCount(0, { timeout: 10000 });
    await expect(section(page, 'tp-held'), 'the held section has no held list now').toHaveAttribute('data-state', 'empty');
    await wait(500);
    expect(await focusMoves(page), 'focus never moved — not to the prompt\'s Cancel, not to the held section\'s heading (D15 "never takes focus from elsewhere") — today the read remounts the prompt, which focuses its Cancel, and its closing then sends focus to the heading').toEqual([]);
    await expect(recount, 'focus stays on Recount').toBeFocused();
    expect(m.log.nonGet, 'a prompt that closes by itself sends nothing').toEqual([]);
  });

  test('B150: when "Turn off" has focus — put back there by Cancel, moved there by the owner, or moved there by the owner before the window lost focus (they switched to another tab or window, so "Turn off" had a blur while it stayed the focused element) — and a read shows the path off, focus moves to the path section\'s heading: it is never on "Turn on", neither by its text nor as the same button relabelled, so a keypress then sends nothing and the path stays off [AC-6 "Never on Turn on"; ADR 0007 D15 "Never on Turn on or Run a pass now", § Fix-round notes D15 "A focused opener that a read replaces in place by a control D15 rules out hands focus to its section\'s heading. Turn off becoming Turn on is the case. Never on Turn on covers a button node React reuses", and round 2 D15 "decided when the read swaps it, from document.activeElement against the switch\'s button node … Focus and blur events are not used"; review round 1, requested 2; review round 2, blocking 2]', async ({ page }) => {
    test.setTimeout(120000);
    const m = await mock(page);
    const WINDOW_BLURRED = 'the owner moved focus to it, then the window lost focus';
    for (const [i, how] of ['after Cancel', 'the owner moved focus to it', WINDOW_BLURRED].entries()) {
      if (i === 0) await openAndSettle(page);
      else await reload(page, m, { realtime: F.REALTIME.ON_LIVE, record: undefined });
      if (how === 'after Cancel') {
        const p = await openPrompt(page);
        await p.cancel.click();
        await untilFocus(page, (f) => f.button && f.section === 'tp-path' && f.text === 'Turn off', `${how}: setup — focus is on "Turn off" (D15; B143)`);
      } else {
        await control(page, 'Turn off').focus();
        await expect(control(page, 'Turn off'), `${how}: setup — focus is on "Turn off"`).toBeFocused();
        if (how === WINDOW_BLURRED) {
          // What a browser fires when its window or tab loses focus (review round 2, blocking 2): blur and focusout on the
          // focused element, then blur on the window, while that element stays document.activeElement.
          const kept = await page.evaluate(() => {
            const el = document.activeElement;
            el.dispatchEvent(new FocusEvent('blur', { relatedTarget: null }));
            el.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
            window.dispatchEvent(new FocusEvent('blur'));
            return document.activeElement === el && /^Turn off$/.test((el.innerText || '').trim());
          });
          expect(kept, `${how}: setup — after the window's blur, "Turn off" is still the document's focused element`).toBe(true);
        }
      }
      expect(await markFocused(page), `${how}: setup — "Turn off" is marked`).toBe(true);
      await pauseClock(page);
      m.set({ realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.OFF_BY_ADMIN });
      await page.clock.runFor(POLL_MS);
      await expect(control(page, 'Turn on'), `${how}: the read has landed: the path shows off, its control "Turn on"`).toBeVisible({ timeout: 5000 });
      await wait(300);
      const f = await focusAt(page);
      expect(f.button && /^Turn on$/.test(f.text), `${how}: focus is never on "Turn on", which turns the path on at a keypress (AC-6; D15) — it is on ${focusSummary(f)}`).toBe(false);
      expect((await onMarked(page)).same && f.button, `${how}: nor on the button that read "Turn off", relabelled in place (D15 note "a button node React reuses") — it is on ${focusSummary(f)}`).toBe(false);
      await untilFocus(page, onSectionHeading('tp-path'), `${how}: focus moves to the path section's heading (ADR 0007 § Fix-round notes D15)`);
      await page.keyboard.press('Enter');
      await page.keyboard.press(' ');
      await wait(500);
      expect(m.log.nonGet, `${how}: a keypress then sends nothing: the path is not turned on`).toEqual([]);
      await expect(control(page, 'Turn on'), `${how}: the path stays off`).toBeVisible();
    }
  });

  test('B151: green on purpose — when a confirmation gets no answer within 15 s, the prompt closes and focus goes from its heading to the line that says the outcome is unknown, never to the page itself, and stays on that line when the next read lands [AC-6 "This covers each of the panel\'s prompts (Turn off, Stop and Confirm), however it closes (… gets no answer in time …)"; ADR 0007 D11 "On unknown, clear at once and fire the re-reads", D15 "otherwise … the outcome line when shown"; review round 1, requested 2: B144 runs this for Stop, B145 did not run it for Confirm]', async ({ page }) => {
    const m = await mock(page, S.HELD_NONE);
    await openAndSettle(page);
    const p = await openConfirmPrompt(page);
    await pauseClock(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    m.set({
      confirm: async () => { await gate; return F.CONFIRM_ANSWER.linedUp(F.OTHER_TAB_JOB_KEY); },
      status: async () => { await gate; return S.HISTORY.status; },
      passRecord: async () => { await gate; return S.HISTORY.passRecord; },
    });
    try {
      await p.confirm.click();
      await expect.poll(() => m.log.nonGet, { message: 'the confirmation is sent' }).toEqual([CONFIRM_POST]);
      await untilFocus(page, onHeadingNamed('tp-held', p.heading), 'while under way, focus is on the prompt\'s own heading (D15)');
      await page.clock.runFor(15000);
      await expect(heldHeading(page, p.heading), 'no answer in 15 s: the prompt closes (D11)').toHaveCount(0, { timeout: 5000 });
      await untilFocus(page, onOutcomeLine('tp-held', OUTCOME_UNKNOWN), 'focus goes to the line that says the outcome is unknown (D15)');
    } finally {
      release();
    }
    await untilText(page, 'tp-held', PENDING_STRICT, 'the next read lands: the confirmation shows pending', 10000);
    await stillFocused(page, onOutcomeLine('tp-held', OUTCOME_UNKNOWN), 'and focus stays on the line that says the outcome is unknown');
    expect(m.log.nonGet, 'sent once and never retried').toEqual([CONFIRM_POST]);
  });

  test('B152: green on purpose — the Turn off prompt closes at once on confirm, and when the change is refused (403) or gets no answer within 15 s, focus goes from the path section\'s heading to the line that says so — that it was refused, sign in again, or that the outcome is unknown — never to "Turn on" or the page itself, and it stays on that line when the next read shows the path off [AC-6 "however it closes (confirmed, refused, gets no answer in time …)"; ADR 0007 D15 "Turn off closes at once on confirm: focus goes to the path section\'s heading. When its outcome line then appears while focus is still on that heading, focus moves to the line"; review round 1, requested 2]', async ({ page }) => {
    const m = await mock(page, { switch: F.SWITCH_ANSWER.REFUSED_403 });
    await openAndSettle(page);
    let p = await openPrompt(page);
    await p.confirm.click();
    await untilFocus(page, onOutcomeLine('tp-path', SIGN_IN_AGAIN), 'refused (403): focus goes to the line that says so, and to sign in again (D15)');
    await expect(control(page, 'Turn off'), 'refused: the path is still on').toBeVisible();

    await reload(page, m, { realtime: F.REALTIME.ON_LIVE, record: undefined, switch: undefined });
    p = await openPrompt(page);
    await pauseClock(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    m.set({
      switch: async () => { await gate; return F.SWITCH_ANSWER.OFF; },
      realtime: async () => { await gate; return F.REALTIME.OFF_WITH_FIGURES; },
      record: async () => { await gate; return F.RECORD.OFF_BY_OWNER; },
    });
    try {
      await p.confirm.click();
      await expect.poll(() => m.log.nonGet, { message: 'the off is sent' }).toEqual([SWITCH_POST, SWITCH_POST]);
      await untilFocus(page, onSectionHeading('tp-path'), 'under way: focus on the path section\'s heading (D15)');
      await page.clock.runFor(15000);
      await untilFocus(page, onOutcomeLine('tp-path', OUTCOME_UNKNOWN), 'no answer in 15 s: focus goes to the line that says the outcome is unknown (D15)');
    } finally {
      release();
    }
    await expect(control(page, 'Turn on'), 'the next read lands: the path shows off').toBeVisible({ timeout: 10000 });
    await stillFocused(page, onOutcomeLine('tp-path', OUTCOME_UNKNOWN), 'and focus stays on the line, never moving to "Turn on"');
    expect(m.log.nonGet, 'one POST each, nothing retried').toEqual([SWITCH_POST, SWITCH_POST]);
  });

  test('B153: green on purpose — the Stop prompt, refused (a lapsed session\'s 401), closes once its re-reads settle and focus goes from its heading to the line that says it was refused and to sign in again — never to "Run a pass now" or the page itself [AC-6 "however it closes (… refused …)"; ADR 0007 D15 "otherwise, or when the opener is gone: the outcome line when shown"; review round 1, requested 2]', async ({ page }) => {
    const m = await mock(page, { ...F.SCENE.WAITING_ASKED, stop: F.STOP_ANSWER.REFUSED_401 });
    await openAndSettle(page);
    const p = await openStopPrompt(page);
    await p.confirm.click();
    await untilFocus(page, onOutcomeLine('tp-pass', SIGN_IN_AGAIN), 'refused (401): focus goes to the line that says so, and to sign in again (D15)');
    await expect(passHeading(page, p.heading), 'the prompt has closed').toHaveCount(0);
    expect(m.log.nonGet, 'one stop sent, nothing retried').toEqual([STOP_POST]);
  });

  test('B154: an open panel whose status read fails after a good one says in the backstop section that it cannot tell whether the pass is overdue, because the pass status could not be read — after an on-time read, where it showed no line, and after an overdue one, whose warning and times it no longer shows — and the next good read brings the verdict back [story 7 AC-5 "A missing warning never stands for on time", "When the pass report … cannot be read, the backstop section says it cannot tell whether the pass is overdue"; ADR 0007 § Fix-round notes, D14 "This holds whether or not a body is kept from an earlier read. A kept verdict is never shown while the latest read has failed"; review round 1, requested 5]', async ({ page }) => {
    test.setTimeout(90000);
    const O = F.OVERDUE.OVERDUE;
    const OVERDUE_SAID = [OVERDUE_WORD, clockRe(O.latestBeganAt), clockRe(O.expectedAt)];
    const m = await mock(page, S.HELD_NONE);
    for (const [i, [what, scene]] of [['on time', S.HELD_NONE], ['overdue', S.OVERDUE]].entries()) {
      if (i === 0) await openAndSettle(page);
      else await reload(page, m, scene);
      if (what === 'on time') expect(await textOf(page, 'tp-schedule'), `${what}: setup — no overdue line (B138)`).not.toMatch(OVERDUE_WORD);
      else await untilShows(page, 'tp-schedule', OVERDUE_SAID, [OVERDUE_CANNOT_TELL], `${what}: setup — the overdue warning (B138)`);
      await pauseClock(page);
      m.set({ status: fail(500) });
      await page.clock.runFor(POLL_MS);
      await expect(section(page, 'tp-pass'), `${what}, then a failed read: the pass section shows the failure, its earlier figures kept (B46)`).toHaveAttribute('data-state', 'error', { timeout: 10000 });
      await untilText(page, 'tp-schedule', OVERDUE_CANNOT_TELL, `${what}, then a failed read: the backstop section says it cannot tell whether the pass is overdue (ADR 0007 § Fix-round notes D14) — today it judges the answer kept from the good read`, 5000);
      const text = await textOf(page, 'tp-schedule');
      const at = text.search(OVERDUE_CANNOT_TELL);
      expect(text.slice(at, at + 300), `${what}, then a failed read: because the pass status could not be read`).toMatch(STATUS_UNREAD);
      expect(overdueClaims(text), `${what}, then a failed read: never that the pass is overdue`).toEqual([]);
      expect(text, `${what}, then a failed read: no time of the kept verdict`).not.toMatch(clockRe(O.latestBeganAt));
      m.set({ status: scene.status });
      await page.clock.runFor(POLL_MS);
      await expect(section(page, 'tp-pass'), `${what}: the next read is good`).toHaveAttribute('data-state', 'ready', { timeout: 10000 });
      if (what === 'on time') {
        await expect.poll(async () => OVERDUE_WORD.test(await textOf(page, 'tp-schedule')), { message: `${what}: the good read shows no overdue line again`, timeout: 5000 }).toBe(false);
      } else {
        await untilShows(page, 'tp-schedule', OVERDUE_SAID, [OVERDUE_CANNOT_TELL], `${what}: the good read brings the warning back`);
      }
    }
    expect(m.log.nonGet, 'it is only a warning: it sends nothing').toEqual([]);
  });

  /* ── Story 7's fix round 2: review round 2, blocking 2 (B150's window case) and requested 4 (B155) ──────────── */

  test('B155: green on purpose — while a confirmation is under way, focus on the prompt\'s own heading stays on that same heading when a read moves the held section to another branch: the read that shows a pass running (a lined-up pass can begin before the answer comes; it began 0.3 s after the confirm in the local evidence), then the read that shows it ended holding nothing, each leave the prompt shown, the same element, and focus on it; when the answer comes, focus goes to the line that says so, never to the page itself [AC-6 "Never lost. Focus never falls to the page itself"; ADR 0007 D10 "never while under way", D15 "while under way, focus is on the prompt\'s heading", § Fix-round notes D15 "The Confirm prompt and its answer line keep one element identity across the held section\'s branches"; review round 2, requested 4]', async ({ page }) => {
    const m = await mock(page, S.HELD_NONE);
    await openAndSettle(page);
    const p = await openConfirmPrompt(page);
    await pauseClock(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    m.set({ confirm: async () => { await gate; return F.CONFIRM_ANSWER.linedUp(F.OTHER_TAB_JOB_KEY); } });
    try {
      await p.confirm.click();
      await expect.poll(() => m.log.nonGet, { message: 'the confirmation is sent' }).toEqual([CONFIRM_POST]);
      await untilFocus(page, onHeadingNamed('tp-held', p.heading), 'setup — while under way, focus is on the prompt\'s own heading (D15)');
      expect(await markFocused(page), 'setup — that heading is marked').toBe(true);
      // The prompt sits at the same place among the held section's children in the held list's branch and the running
      // one, so the first read keeps it even without its key; the branch with nothing held puts it elsewhere.
      const STEPS = [
        ['the next read shows a pass running', S.RUNNING, /\bpass is running\b/i],
        ['the read after it shows that pass ended, holding nothing', S.TOOK_UP, /\bheld no removals\b/i],
      ];
      for (const [step, scene, landed] of STEPS) {
        m.set(scene);
        await page.clock.runFor(POLL_MS);
        await untilText(page, 'tp-held', landed, `${step}: the read has landed in the held section`, 5000);
        await expect(heldHeading(page, p.heading), `${step}: the prompt is still shown while its confirmation is under way (D10)`).toHaveCount(1);
        await stillFocused(page, onHeadingNamed('tp-held', p.heading), `${step}: focus stays on the prompt's heading (AC-6 "Never lost"; D15 note)`);
        expect(await onMarked(page), `${step}: and it is the same element, never remounted (D15 note "one element identity")`).toEqual({ same: true, connected: true });
      }
    } finally {
      release();
    }
    await expect(heldHeading(page, p.heading), 'the answer closes the prompt (D11)').toHaveCount(0, { timeout: 10000 });
    await untilFocus(page, onOutcomeLine('tp-held', /\blined up\b/i), 'the answer: focus goes to the line that says a pass was lined up (D15)');
    expect(m.log.nonGet, 'one confirmation, nothing retried').toEqual([CONFIRM_POST]);
  });
});

/* ══ AC-6: the existing sub-tabs send the same requests as before (T10) ═══════════════════════════════════════════ */

const TAB_KEYS = { '🔄 Router Management': 'router', '🔃 Negentropy Sync': 'sync', '📡 Relay Configuration': 'config', '⚡ Streaming ETL': 'etl', '📅 Scheduled Tasks': 'schedule' };

/**
 * The distinct API requests one existing sub-tab sends from its click until the set has not grown for 1 s, at least
 * SETTLE_MS and at most SETTLE_MS × 2 after the click, sorted.
 */
async function requestsOfSubTab(page, m, label) {
  await openRelays(page);
  await wait(SETTLE_MS);
  // Start from another sub-tab, so the one under test mounts on its click (Router Management is open by default).
  const from = label === EXISTING_TABS[2] ? EXISTING_TABS[0] : EXISTING_TABS[2];
  await subTab(page, from).click();
  await wait(1000);
  const mark = m.log.api.length;
  await subTab(page, label).click();
  const distinct = () => new Set(m.log.api.slice(mark)).size;
  const t0 = Date.now();
  let size = -1;
  let stableSince = Date.now();
  while (Date.now() - t0 < SETTLE_MS * 2) {
    await wait(200);
    const now = distinct();
    if (now !== size) { size = now; stableSince = Date.now(); }
    if (Date.now() - t0 >= SETTLE_MS && Date.now() - stableSince >= 1000) break;
  }
  return [...new Set(m.log.api.slice(mark))].sort();
}

test.describe('AC-6: nothing else moves (tagging-edges #4, T10)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip(true, 'Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  /*
   * A story that changes a Relays sub-tab runs B39 (see the header, "A story that changes a Relays sub-tab runs B39").
   * Revised for story 7 (ledger 2026-10-28-relay-subtab-baseline-stale, all three parts; story 7 § Test tasks "The
   * browser baseline"):
   *   (a) the baseline is brought up to date by hand (its `handEdits` entry says what and why: ffda8152's Negentropy
   *       Sync presets read; re-recording is refused on every build that contains the panel);
   *   (b) each check is expect.soft, so one stale sub-tab no longer ends the test before the others are checked (from
   *       2026-10-09, Relay Configuration, Streaming ETL and Scheduled Tasks went unchecked behind Negentropy Sync);
   *   (c) the rule that such a story runs B39 is written in this spec's header and here.
   */
  test('B39: each existing Relays sub-tab — Router Management, Negentropy Sync, Relay Configuration, Streaming ETL, Scheduled Tasks — sends the same API requests as the recorded baseline, and keeps its label and order; each sub-tab is checked and reported even when another differs [AC-6 "The tab bar"; T10; ledger 2026-10-28-relay-subtab-baseline-stale]', async ({ page, request }) => {
    test.setTimeout(150000);
    if (RECORDING) {
      const { missing } = await bundleContains(request, [TAB]);
      expect(missing, 'refusing to record the AC-6 baseline from a build that already contains the panel (T10: record before the change)').toEqual([TAB]);
    }
    const m = await mock(page);
    await openRelays(page);
    const labels = (await relayTabBar(page).getByRole('button').allInnerTexts()).map(squash);
    const observed = { tabs: labels.filter((l) => l !== TAB), subTabs: {} };
    for (const label of EXISTING_TABS) observed.subTabs[TAB_KEYS[label]] = await requestsOfSubTab(page, m, label);

    if (RECORDING) {
      let commit = null;
      try { commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..', '..') }).toString().trim(); } catch (_) { commit = null; }
      const record = {
        note: 'AC-6 baseline (ADR 0004 T10): the distinct API requests each existing Relays sub-tab sends from its click until '
          + `the set has not grown for 1 s (at least ${SETTLE_MS} ms, at most ${SETTLE_MS * 2} ms), under `
          + 'tests/brainstorm/tagging-pipeline-panel.spec.js\'s mocks (catch-all 599). Recorded with TP_RECORD_BASELINE=1 '
          + 'against the UI before story 4.',
        recordedAt: commit,
        settleMs: SETTLE_MS,
        ...observed,
      };
      fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
      fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(record, null, 2)}\n`);
      test.info().annotations.push({ type: 'recorded', description: BASELINE_FILE });
      return;
    }

    expect(fs.existsSync(BASELINE_FILE), `the AC-6 baseline ${path.relative(process.cwd(), BASELINE_FILE)} exists — record it with TP_RECORD_BASELINE=1 against the UI before story 4 (T10)`).toBe(true);
    const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    // Soft (ledger 2026-10-28-relay-subtab-baseline-stale): every sub-tab is checked and reported, whichever differs.
    expect.soft(observed.tabs, 'the five existing sub-tabs keep their labels and order').toEqual(baseline.tabs);
    for (const key of Object.values(TAB_KEYS)) {
      expect.soft(observed.subTabs[key], `the ${key} sub-tab sends the same API requests as the baseline — if this sub-tab's change was intended, update ${path.relative(process.cwd(), BASELINE_FILE)} by hand with a handEdits entry (see the spec's header)`).toEqual(baseline.subTabs[key]);
    }
  });
});
