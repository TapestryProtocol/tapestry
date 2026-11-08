# Story 7: Confirming held removals, on the panel

**Status:** Approved
**Created:** 2026-10-30
**Type:** Feature

## Background

Stories 1–6 are in production. The gap-filling pass (story 2) and the real-time path (story 3) keep one `TAGS`
relationship per tagging. Story 4's panel (Settings › Relays › Tagging pipeline) shows both to the owner and admins.
Story 5 added the path's switch, and story 6 added Run and Stop for the pass, with a record of who did what.

The book's acceptance frame asks that the owner can manage the pipeline from the control panel. Since story 4's
Planning that includes confirming held removals, for the owner only, after a prompt (`audits/tagging-edges/book.md`,
"Front-end controls"). It is the frame's last unmet part. Story 6's Planning split it off into this story
(`epics/tagging-edges.md` item 7).

Today:
- **A pass holds large removals for the owner.** When a pass would remove more than 50 relationships and more than a
  tenth of those it started with, it removes none of them and lists them as held (story 2).
- **The panel shows the held list but cannot confirm it.**
  - It shows the held list, 50 at a time, with each entry's reason.
  - It shows the owner's confirmation in one of five states: none, pending (and until when), expired, unreadable, or
    pending with an expiry it cannot read.
  - While a pass is running it shows no held list: "The held list returns when it ends".
- **Confirming takes a console snippet.** The owner, signed in, pastes it into a browser console on the instance's own
  page (OPERATIONS §12.8). The confirmation it makes:
  - covers that one held list, once;
  - lasts 24 hours;
  - is taken up by the next pass to get past its start checks, which removes the confirmed entries still due.

  The snippet's request lines up a pass, or hands the confirmation to a pass already waiting. Once a pass has begun
  running, its own report is the latest, so a confirmation sent then is refused and nothing is confirmed.
- **Who confirmed is half-recorded.** Story 6's record names "the owner's confirmation" as the start of a pass the
  confirm route lined up. The confirmation itself, by whom and when, is not in the history.
- **The public status shows the owner's shortened key** on the owner's confirmation, pending or expired. Since story 6,
  no other public read names who did anything.
- **No pass on record on staging or production has held removals.** Stories 2 and 3 § Evidence record "nothing held"
  for the passes they name. Each host's ten latest pass reports, read on 2026-10-30, show none held. Earlier passes are
  not on record. Hold and confirm rest on tests.
- **What a held list takes on staging.** Staging had 7,313 relationships on 2026-11-07. A pass holds its removals
  there when about 730 or more are due at once. A held list made only of relationships created for a test needs more,
  about 810, because those relationships count among the ones the pass starts with. The number moves with staging's
  count, so it is read again just before the test.

This story also carries:
- **story 6's review carry-forwards and leftovers,** and one leftover from story 5's review, an untracked browser pin
  (§ "Carry-forwards", below);
- **three ledger rows** the owner placed here: prompts that return no focus, a stale browser-test baseline, and
  production's unnoticed pass gap;
- **two closings** for story 3: its open question 14, and its review's harness question.

None of them changes what Confirm does.

Dates in this story are UTC. This Planning ran on 2026-10-30 and 2026-11-07.

## User-facing description

As the owner of a Tapestry instance, I want to confirm a pass's held removals from the Tagging pipeline panel, after a
prompt that tells me what I am agreeing to:
- being told plainly when a pass already waiting will carry them out, instead of a second one lining up;
- being offered Confirm again when my confirmation lapses, or cannot be relied on, before any pass uses it;
- seeing who confirmed, and when, in the panel's history.

Then nobody needs the browser console to confirm held removals. Admins see that only the owner can confirm. And every
viewer of the panel is warned when the daily pass has not run for longer than its schedule allows.

## Acceptance criteria

The terms are stories 4–6's: "the panel", "the pass", "the report", "the path", "owner", "admin", "busy", "waiting"
and "running". In addition:
- **The held list.** The latest pass's held removals: those of a pass whose outcome is "removals held".
- **The owner's confirmation.** Story 2's: it covers one report's held list, once, for 24 hours from when it is made.
  The first pass to get past its start checks in that time takes it up. There is only ever one; a new one replaces it.
- **Pending.** A confirmation that is made, unexpired, and not yet taken up. A confirmation that cannot be read, or
  whose expiry cannot be read, is not pending: no pass carries it out.
- **Action.** Story 6's start or stop, and also an owner's confirmation that the server accepts. A confirmation's time
  is when it was made, not when a pass takes it up.

- [ ] **AC-1. Confirm, for the owner.**
  - **When it shows.** The owner sees "Confirm held removals" in the panel's held section when the latest pass held
    removals, and no confirmation of that held list is pending. It is not shown when the latest pass held nothing.
    While a confirmation of the latest held list is pending, the panel says so, as today, and offers no Confirm.
    - **While a pass is running,** the held section shows no held list and no Confirm, as today. When the pass ends,
      its own held list shows, if it held removals.
    - **Until the held list is read,** Confirm is not offered. While the list is loading, or its read has failed, the
      held section says so, as today, so the owner never confirms removals the panel is not showing.
    - **A confirmation that cannot be relied on.** When the owner's confirmation cannot be read, or its expiry cannot
      be read, or it is pending for an earlier pass while the latest pass holds a different list, the panel says so,
      as today, and still offers Confirm. Confirming replaces it (AC-2).
  - **A prompt comes first** (AC-2).
  - **When nothing is busy,** confirming lines up a pass. Within 10 seconds every viewer sees it waiting, running, or
    ended with its outcome. The pass removes the confirmed removals still due, as story 2 defines.
  - **When a pass is busy:**
    - **A pass waiting with no stop asked for:** confirming starts nothing new. The answer says plainly that the
      waiting pass will take the confirmation up.
    - **A pass that has begun running:** its report is already the latest, so the held list the prompt showed is no
      longer the latest pass's. The confirmation is refused as out of date (AC-2), and nothing is confirmed. The owner
      can confirm the new pass's held list once it ends. A pass that has only just started, before it records itself
      as the latest, may still take the confirmation up; the answer says which happened.
    - **Every busy pass has a stop asked for:** none of them takes the confirmation up. Confirming lines up a new pass,
      as when nothing is busy, and the answer says so. Every viewer sees the new pass waiting behind the one that is
      stopping.
  - **Never a false answer.** Confirm is never answered as lined up, or as taken up, when no pass will take it up. That
    includes the few seconds after a pass ends (ledger `2026-09-28-confirm-route-joins-finishing-job`, closed by story
    6; this story checks it from the panel).
  - **A second confirmation while one is pending** is refused plainly, for example one sent from another tab or the
    console snippet. The answer says that a confirmation of this held list is already pending, and until when. It
    changes nothing: the first keeps its 24 hours and its pass, and nothing new is recorded.
  - **Every viewer sees it.** Within 10 seconds of a confirmation, every viewer's panel shows it in the history, and
    shows it pending or taken up by a pass. From then on no panel offers Confirm for that held list while it is pending.
  - **When the confirmation is made but no pass is lined up,** whatever the reason (the task queue unavailable, or the
    server failing to line one up), the confirmation is kept pending. The panel says plainly that no pass was lined up,
    gives the server's reason when it gives one, and says that Run, or the next scheduled pass, takes the confirmation
    up within its 24 hours.
  - **When a pass starts while the confirmation is being made,** the answer says plainly which of these happened: that
    pass took the confirmation up, or the confirmation was withdrawn and nothing changed (as in AC-2). When the server
    cannot tell whether the confirmation stands, the panel says so. It does not show the confirmation as unchanged, and
    from its next read it shows whether that pass took it up.
  - **While a confirmation is under way,** the control is disabled and says so. If the server has not answered within 15
    seconds, the control is enabled again and the panel says the outcome is unknown. It then shows the state from its
    next read.
  - **When the confirmation expires unused,** the panel says so, as today. It offers Confirm again for the same held
    list, as long as that pass is still the latest. Nothing else alerts the owner.
  - **When a confirmation is used up by a pass that then failed or was stopped,** the panel says so. The confirmed
    removals that pass did not apply can be confirmed again only once a later pass holds them again: a Run, or the next
    scheduled pass. Until then it offers no Confirm. Story 6's Stop prompt already warns of this.
- [ ] **AC-2. The prompt.**
  - **What it says.** Pressing Confirm opens a prompt before anything changes. It says:
    - how many removals it confirms, and from which pass: the pass whose held list the held section shows;
    - when they happen, for the state the panel last showed, and only the case that applies:
      - when nothing is busy, or every busy pass has a stop asked for: confirming lines up a pass now;
      - when a pass is waiting with no stop asked for: that pass takes the confirmation up, and nothing new is lined
        up;
      - when the panel cannot tell whether a pass is waiting, or the task queue is off: it cannot tell whether a pass
        will be lined up now, and the answer will say what happened;
    - that the confirmation covers this held list once, and lapses after 24 hours if no pass takes it up;
    - that a removal cannot be undone from the panel: a removed relationship comes back only if its tagging is on the
      relay again, and then the real-time path, while it is on, or a later pass adds it back;
    - when the panel shows an earlier confirmation that no pass will carry out (AC-1), that this one replaces it.
  - **Cancelling** sends nothing and changes nothing.
  - **Only what the prompt showed.** If the latest pass is no longer the one the prompt named, the confirmation is
    refused plainly and changes nothing. The panel then shows the new state, so the owner can press Confirm again.
  - **The answer says what happened.** If what is busy has changed by the time the owner confirms, the answer reports
    what actually happened (AC-1), never what the prompt expected.
- [ ] **AC-3. Who may.**
  - **Admins see a disabled Confirm** exactly where and when the owner would see Confirm (AC-1), and nowhere else, with
    the reason beside it: only the owner can confirm held removals. It sends nothing.
  - **Others.** A signed-in user who is neither owner nor admin sees no panel, as today.
  - **The server decides.** It accepts a confirmation only from the signed-in owner. It refuses everyone else, and
    changes and records nothing:
    - a signed-out request;
    - a signed-in admin;
    - a signed-in user who is neither owner nor admin;
    - a request from another site.
  - **Refused or failed.** When the server refuses the panel's request, or cannot carry it out, the panel shows the
    reason. It then shows the held list and the confirmation as they now stand, not as they were assumed to be. Apart
    from AC-1's case where the server cannot tell whether the confirmation stands, nothing has changed.
- [ ] **AC-4. Who confirmed.**
  - **What is recorded.** Every confirmation the server accepts records the owner, with a shortened key, and when, in
    story 6's record of actions.
  - **What the panel shows.**
    - The history of the last 10 actions shows the confirmation.
    - The pass that took a confirmation up names it: the owner's confirmation, and when it was made. What it says it
      did with it stays as today: whether it honoured it, and why not if it did not, and how many of the confirmed
      removals it applied, never more than it applied.
  - **When the server cannot record it,** Confirm is refused, as Run is, and changes nothing. This replaces story 6's
    rule that the confirm route's start goes ahead unrecorded; a schedule's start still goes ahead unrecorded, as story
    6 defines.
  - **Who may read it.** Only a signed-in owner or admin may read who confirmed, and the server enforces it.
    - No public read names who confirmed. The owner's shortened key goes from every confirmation the public status
      shows: pending, expired, or with an expiry that cannot be read.
    - The public status keeps saying that a confirmation is pending or has expired, of which pass, and until when.
    - Only the owner can confirm, so a public pending confirmation still shows that the owner acted. That is accepted,
      as story 6 accepted the public time of a stop.
- [ ] **AC-5. An overdue pass is flagged.**
  - **When.** The pass is overdue when an enabled schedule entry runs it, and the latest pass began running longer ago
    than that entry's interval plus one hour. For the daily entry that is more than 25 hours.
    - An entry set by a calendar rule instead of an interval counts by the longest time between two of its runs in a
      row: a rule for 03:00 every day counts as 24 hours.
    - With more than one enabled entry, the most frequent counts.
    - A pass that was refused or failed counts as having begun.
    - A pass that is waiting, or that gave up waiting, has not begun. So the warning stays while a pass waits, and says
      that one is waiting.
  - **What every viewer sees.** A warning in the panel's backstop section that the pass is overdue, saying when the
    latest pass began and when one was expected.
  - **No warning** when no entry is enabled; the backstop section's existing warning stands. There is also none when no
    pass is on record; the panel already says that no pass has run.
  - **When it cannot tell.** When the pass report or the schedule list cannot be read, the backstop section says it
    cannot tell whether the pass is overdue. A missing warning never stands for "on time".
  - **The same for every viewer.** A viewer whose device clock is wrong sees the same as everyone else.
  - **It clears** within 10 seconds of a new pass beginning.
  - **It is only a warning.** It starts nothing and changes nothing.
- [ ] **AC-6. Prompts return focus.** This covers each of the panel's prompts (Turn off, Stop and Confirm), however it
  closes.
  - **After Cancel,** keyboard focus goes back to the control that opened the prompt, if that control is still shown.
  - **Otherwise** (the prompt is confirmed, refused, gets no answer in time, or closes by itself because what it showed
    has changed, or the control that opened it is gone), focus goes to the line that says what happened, or if there
    is none, to that section's heading.
  - **Never lost.** Focus never falls to the page itself, and never lands on a control that sends at a keypress, such
    as Turn on or Run a pass now. A keyboard or screen-reader user keeps their place (ledger
    `2026-10-28-panel-prompts-return-no-focus`).
- [ ] **AC-7. Nothing else moves.**
  - **Confirm changes nothing else.** It does not change any schedule entry or the path's switch. Follows, mutes and
    reports are untouched.
  - **The pass behaves as story 2 defines.** It removes only the confirmed entries still due. Other removals are
    judged against the limit again, and may be held for another confirmation.
  - **The confirm route** keeps working for the console snippet, for the owner only. The snippet's request is answered
    as the panel's Confirm is, its refusals included (AC-1, AC-4).
  - **Run and Stop** work as story 6 defines, apart from AC-6.
  - **The panel's reads still change nothing.** Nothing else on the panel or in Settings changes, apart from:
    - this story's control, prompt, record entries and warning;
    - the panel's opening line, which names what it changes;
    - the held section's wording about the owner's confirmation, only where Confirm makes today's wording untrue. For
      example, an expired confirmation no longer just waits for the next pass, because the owner can now confirm
      again. The panel still says when a confirmation is pending, until when, or that it has expired.

### Docs tasks

- **OPERATIONS §12.8.**
  - **Confirming held removals.** The panel's Confirm is the way, for the owner. The console snippet stays, as the way
    without the panel, with its answers as AC-1 and AC-4 give them.
  - **The panel.** Its paragraph says the panel confirms held removals and flags an overdue pass.
  - **Who started or stopped it.** The record also holds confirmations, and the confirm route's start is now refused
    when it cannot be recorded.
- **BIBLE.**
  - §11: the confirm route's answers, and the public status without the owner's shortened key.
  - §6: who confirmed.
  - A §16 entry, and the Last-updated line.
- **Point the "story 7" references at what shipped.** They are in OPERATIONS §12.8, BIBLE §16 (the entries for the
  tagging pipeline panel and for running and stopping the pass), the panel's comments, the epic, the handoff and the
  book. The ADRs that name story 7 get dated notes from the Architect; their original text stays.
- **Story 3 closings.**
  - **Open question 14.** Record this Planning's staging reading in story 3 § Evidence and close the question:
    staging's `GET /api/tagging-edges/realtime/status` at 2026-10-30T01:28:58Z read:
    - `state` `live`, `runningSince` 2026-10-30T00:16:05.716Z, `lastError` null;
    - every `failedReads` count 0 (relay, graph, element, catch-up), `removalsNotPrompted` 0, `droppedOverBacklog` 0,
      `refused.total` 0, `dbRefused.total` 0, `leftInPlace.total` 0, every lost race 0;
    - since the path first started (2026-09-30T14:26:36Z), with its counts carried across every restart and never
      reset: 243 added, 5 changed, 3 removed, 32 people added; 439 deletions that matched no relationship (the
      reading of 2026-10-01 had none) and none naming another author.

    A deletion that matched no relationship is not a failure: the path counts it and moves on, because nothing it
    deleted was a tagging relationship in the graph. So the question's "no failures" holds.
  - **The heap harness.** Record that the owner declined to commit the heap-ceiling measurement harness (review 3,
    round 1, non-blocking 13; 2026-10-30). The measured figures in § Evidence stand.
- **Ledger rows,** at the ship:
  - close `2026-10-28-panel-prompts-return-no-focus`;
  - close `2026-10-28-relay-subtab-baseline-stale` only when all three parts of its fix are done (Test tasks, "The
    browser baseline"). If any part is left out, name it, and the row that tracks it, before the row closes;
  - row `2026-10-30-prod-pass-gap-unnoticed` gets a dated note that the panel now flags an overdue pass. Its cause
    stays open, for the owner's read of the droplet's logs.
- **The handoff § 0, the epic, and the book's frame** follow at the ship. The epic's item 7 records that Confirm lines
  up a new pass when every busy pass has a stop asked for (this Planning).

### Test tasks

- **Server cases for AC-1 to AC-4:**
  - the owner confirming with nothing busy: a pass lined up, and the confirmed removals carried out;
  - with a pass waiting, or a scheduled run come due and waiting: nothing new lined up, and the answer says plainly
    that a waiting pass will take the confirmation up;
  - with a pass running: refused as out of date, nothing confirmed; and the moment before it records itself, where it
    may take the confirmation up, with an answer that says which;
  - every busy pass with a stop asked for: a new pass lined up, which takes the confirmation up; never answered as taken
    up by a pass that is stopping;
  - in the seconds after a pass ends: lined up, or a plain answer that none will;
  - a second confirmation while one is pending, with a pass waiting and with the queue unavailable: refused, the first
    one's expiry unchanged, nothing recorded;
  - no pass lined up (the queue unavailable, or the line-up failing): kept pending, and the answer says so;
  - a pass starting mid-confirmation: taken up, withdrawn, or the server cannot tell, each answered as such;
  - the latest pass changed since the prompt opened: refused, nothing changed;
  - an expired confirmation: Confirm offered again for the same held list, and refused once a newer pass ran;
  - an unreadable confirmation, one with an unreadable expiry, and one pending for an earlier pass: a new confirmation
    accepted, replacing it;
  - each refused caller (signed out, an admin, a user who is neither, another site): nothing changed or recorded;
  - the record: a confirmation recorded with the owner and the time; a record that cannot be written refuses Confirm
    and the snippet's request alike, while a schedule's start still goes ahead unrecorded;
  - after the owner's confirmation, signed-out reads of the public status, the held list, the path's status and the
    Task Explorer's data for this task carry no who, and no shortened key of the owner on a pending confirmation, an
    expired one, or one whose expiry cannot be read.
- **Server or view cases for AC-5:**
  - the daily entry at 24 hours 59 minutes since the latest pass began (not overdue) and at 25 hours 1 minute
    (overdue);
  - an entry set by a calendar rule;
  - two enabled entries;
  - a refused latest pass;
  - a daily pass waiting at 25 hours 1 minute: overdue, and the warning says one is waiting;
  - no enabled entry: no overdue warning, and the existing no-entry warning shows;
  - no pass on record;
  - the report or the schedule list unreadable: "cannot tell";
  - a viewer's clock set wrong: the same warning;
  - the warning cleared by a new pass.
- **Browser cases** on the rebuilt UI:
  - AC-1: Confirm shown or hidden for each of the confirmation's states (none, pending for the latest held list,
    pending for an earlier pass, expired, unreadable, expiry unreadable), while a pass runs, and while the held list
    is loading or cannot be read; under way; no answer within 15 seconds; a Confirm sent from a panel that has not yet
    re-read a pending confirmation (refused, and the panel then shows it pending); no pass lined up; a confirmation
    used up by a pass that failed or was stopped (no Confirm, and the line saying a later pass must hold the removals
    again).
  - AC-2: each part of the prompt's text, for each "when" case; the replacing line; cancelling; a prompt that is out
    of date.
  - AC-3: the admin's disabled Confirm and its reason, shown exactly where the owner's would be; a refused request and
    a failed one.
  - AC-4: the confirmation in the history; the pass that took it up, with what it applied; a pass that found it and
    did not honour it, with why.
  - AC-5: the overdue warning, the waiting case, "cannot tell", and none when the pass is on time.
  - AC-6: for all three prompts, where focus lands after Cancel, after confirming, and after the prompt closes by
    itself; never on Turn on or Run a pass now, or on the page itself.
- **The browser baseline** (ledger `2026-10-28-relay-subtab-baseline-stale`):
  - B39's recorded baseline matches the Relays sub-tabs as they are today, so the browser lane is green on this
    story's tree;
  - when one sub-tab's requests differ from the baseline, B39 still checks and reports every other sub-tab, so one
    stale sub-tab can no longer hide the rest (Relay Configuration, Streaming ETL and Scheduled Tasks have gone
    unchecked since 2026-10-09);
  - whether a story that changes a Relays sub-tab must run B39 is written down where the next such story will see it.
- **The earlier stories' pins are revised, not deleted.**
  - **The request pins.** The pins on which requests the panel sends allow exactly this story's confirmation, any read
    route the Architecture adds, and nothing else.
  - **The no-Confirm pins.** The pins that no button on the panel is named for confirming (the source check over the
    panel's buttons, the held list's check, and the Stop prompt's check) now allow exactly this story's Confirm, the
    admin's disabled Confirm and the buttons of its prompt. They still refuse the name on every other button, Run,
    Stop and Stop's prompt included.
  - **Their messages** that name story 7 for Confirm change to say Confirm is on the panel.

### Carry-forwards

Placed by the owner on 2026-10-30. Each is small, and none gates this story's criteria.
- **From story 6's review** (`reviews/tagging-edges/6-pass-run-and-stop.md` § "Re-review, round 2", carry-forwards
  1–8, and round 1's non-blocking 1 and 2; carry-forward 9 is already done). The review gives each one's evidence in
  full.
  - *CF1 (ADR, code comment):* ADR 0006 D5's note says the record is loaded "only on first use". It is also re-read
    after a read that was unreadable or damaged. Say so, in the note and in the code's comment.
  - *CF2 (ADR):* ADR 0006's lists of its notes on ADRs 0004 and 0005 leave out the two fix-round notes. Add them.
  - *CF3 (code, copy, optional):* a give-up time that a date cannot hold shows as "at not recorded", and no later start
    clears it. Only a hand-edited record can carry one. Leave out the time when it is not recorded, or treat such a
    time as no give-up.
  - *CF4 (code or docs):* when the job-id guard drops an id, an inherited job-id variable would still reach the pass.
    It cannot happen today. Unset it, or qualify the story's and ADR's "records `job: null`".
  - *CF5 (test comment):* SWR86's comment on why it fails describes a tree that was never committed. Correct it.
  - *CF6 (test plan):* story 6's test plan uses a label, "D-a2", that is defined nowhere. Define it or drop it.
  - *CF7 (test plan):* the test plan's D9 and D12 rows do not list CT70. Add it where it belongs.
  - *CF8 (docs, optional):* BIBLE uses "join" in two senses near the confirm route's `joined: true`. Make them
    distinct.
  - *NB1 (code or JSDoc):* if the heavy-task lock's abandon hook throws just after winning, the lease stays held for
    its 4-hour lifetime. Today's hook cannot throw. Guard the call, or say in the JSDoc that the hook must not throw.
  - *NB2 (code, optional):* the panel reads a busy answer with no list as "known and empty", which could close an open
    Stop prompt. Treat it as unknown.
- **From story 5's review** (`reviews/tagging-edges/5-real-time-path-switch.md`, round 1, non-blocking 2):
  - *E1 (test):* nothing pins the drift line's guard, "The explained part does not include them". Extend B43, or add
    a case.
- **Proposed by the Product Owner** (story 6's review, round 2, requested change 1, its optional test half; the
  Architect's and Implementer's halves are done, and nothing else tracks this one):
  - *R1-opt (test, optional, the Tester's call):* make CT70 pin which time is recorded at pickup, not only that a
    valid time is.

Who does each: the Architect, CF1's and CF2's ADR halves; the Tester, CF5, CF6, CF7, E1 and R1-opt; the Implementer,
the rest.

## Concepts touched

None directly. The pass whose held removals it confirms writes taggings of
`39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag` (and this deployment's own
stamp, TA resolved at runtime) into relationships between `39998:<TA>:nostr-user` ends, as in stories 4–6.

## Out of scope

- **Admins confirming.** Decided at story 4's Planning: the owner only.
- **Confirming part of a held list.** A confirmation covers the whole held list, as story 2 defines.
- **Withdrawing a confirmation.** Once the server accepts one, the panel offers no way to take it back. It stays
  pending until a pass takes it up or it lapses after 24 hours. A Stop of a waiting pass leaves it pending, and a Stop
  of a running pass that has taken it up uses it up (story 6). A way to withdraw one would be a decision of its own.
- **The hold rule itself** (more than 50 and more than a tenth): story 2's, unchanged.
- **Cleaning test-fixture taggings off the shared relays** (ledger `2026-09-27-test-fixture-taggings-on-prod-relays`).
  That cleanup is a real deletion, and it stays its own decision.
- **The cause of production's October gap.** It stays open on row `2026-10-30-prod-pass-gap-unnoticed`. This story
  adds the warning, not the cause.
- **Alerts outside the panel,** and overdue warnings for other tasks or for Scheduled Tasks in general.
- **The heap measurement harness:** declined (Docs tasks).
- **tags.brainstorm.world,** which has neither the pass nor the path.

## Open questions

None, once the owner ratifies the Product Owner's proposals below by approving this story.

**Decided at earlier Plannings (the owner; epic items 6 and 7):**
- Confirm is the owner's only, after a prompt (story 4's Planning). Story 2's confirm route stays owner only.
- Confirm, while a pass is waiting or running, says so plainly and starts nothing new. This Planning narrows it (below).
- Who confirmed, and when, is recorded and shown, as story 6 shows starts and stops.
- The confirm-route row is folded here for a check. Story 6 closed it.

**Decided at this Planning (the owner, 2026-10-30):**
- **Admins see a disabled Confirm,** with the reason beside it.
- **An expired confirmation** that no pass used: the panel offers Confirm again for the same held list, while that
  pass is still the latest. No other alert.
- **The public status drops the owner's shortened key** from the owner's confirmation. Who confirmed is for a
  signed-in owner or admin only.
- **The prompt says all four things:** how many and from which pass; when they happen; once only, within 24 hours; no
  undo from the panel. *(The no-undo line names the real-time path beside a later pass, because while the path is on
  it adds a returning tagging without a pass. And "when they happen" offers a waiting pass, not a running one, because
  a pass that has begun running has already replaced the held list as the latest. Both were worded at this Planning,
  for the owner's nod at the gate.)*
- **Evidence on staging, with throwaway relationships** (below).
- **This story also carries:**
  - the prompt focus fix;
  - story 6's review leftovers, with story 5's untracked browser pin;
  - the overdue-pass flag, at the schedule's interval plus one hour;
  - the stale browser baseline.
- **Story 3's open question 14** closes on this Planning's staging reading.
- **The heap harness** is not committed.

**Decided at this Planning (the owner, 2026-11-07, on the Product Owner's recommendations):**
- **When every busy pass has a stop asked for,** Confirm lines up a new pass, as the confirm route does today. This
  narrows epic item 7's "starts nothing new" to busy passes that will take the confirmation up. Otherwise the owner
  would be stuck: Run is refused while a pass is busy, and Confirm is hidden while the confirmation is pending.
- **A second confirmation of a held list already pending** is refused, and the first one stands.
- **A confirmation that cannot be relied on** (unreadable, an unreadable expiry, or pending for an earlier pass while
  the latest pass holds a different list) does not block Confirm. A new one replaces it.

**Proposed by the Product Owner, ratified with this story:**
- **One story, not split.** Seven criteria is past the planning guide's ~5, and they reach the confirm route, the
  record of actions, the public status and the panel. Confirm's criteria (AC-1 to AC-4, AC-7) stay together: a
  Confirm without its prompt and owner-only rule would miss story 4's Planning, and one without its record of who
  confirmed would miss story 6's. AC-5 (the overdue flag) and AC-6 (prompt focus) are here because the owner placed
  them here. Neither depends on Confirm, apart from AC-6 covering Confirm's prompt as well as Turn off's and Stop's.
  So AC-5, with its evidence and its ledger note, is the one clean seam if a split is ever wanted.
- Confirm is not shown while a confirmation of the latest held list is pending.
- Confirm is not offered until the held list has been read.
- An admin's disabled Confirm appears exactly where the owner's Confirm would.
- A confirmation is refused when the latest pass is no longer the one its prompt named.
- When no pass can be lined up, for any reason, the confirmation is kept pending, and the panel points at Run or the
  next scheduled pass.
- A confirmation used up by a pass that failed or was stopped is said so, with no Confirm until a later pass holds
  the removals again.
- When the record cannot be written, Confirm is refused, as Run is, and so is the snippet's request. A schedule's start
  still goes ahead unrecorded.
- A confirmation, once made, cannot be withdrawn from the panel.
- The 15-second limit before "outcome unknown", as for Run and Stop.
- The overdue rule's details: it counts from when the latest pass began running; an entry set by a calendar rule
  counts by the longest gap between its runs; the most frequent enabled entry counts; a refused or failed pass counts
  as having begun; while a pass waits the warning stays and says so; it clears within 10 seconds of a new pass
  beginning; with no enabled entry, or no pass on record, the existing lines stand instead; when the panel cannot tell,
  it says so.
- The console snippet stays in OPERATIONS as the way without the panel.
- R1-opt rides with the carry-forwards, as the Tester's call.
- **Evidence:**
  - a browser test on the rebuilt UI;
  - on the local stack, which is the owner's own graph, every held list is made, as on staging, only of relationships
    created for the test. No tagging on the local relay is touched, and no relationship or person that was there before
    the test is removed. The Architect works out how, safely. The checks:
    - a held list confirmed by the owner from the panel, and carried out: the pass removes exactly those relationships,
      and the local graph's tagging relationships and people then match their counts from before the test;
    - a Confirm while a pass is waiting;
    - a Confirm with the task queue unavailable;
    - an expired confirmation, offered again;
    - the overdue warning;
  - on staging:
    - a held list made only of relationships created for the test:
      - nobody's real taggings or relay events are touched, and nothing in staging's graph from before the test is
        changed or removed, by the test or by the pass it confirms;
      - no real person is ever shown tagging, or being tagged by, anyone they did not;
      - nothing is published to or deleted from any relay for the test, because events on one relay reach other hosts
        (ledger `2026-09-27-test-fixture-taggings-on-prod-relays`);
      - a held list is all or nothing, so a real removal that falls due during the test would join it. Before the
        owner confirms, the held list is checked to be exactly the test's; if it is not, the owner does not confirm;
      - whether the test finishes or not, everything it created is taken out again afterwards. A list left behind
        would make every later pass on staging hold all its removals, real ones too;
      - the Architect works out how, safely: which people the relationships join, how many are needed (about 810 at
        2026-11-07's count), how the real-time path treats them, and what happens if the daily pass runs during the
        test;
    - the owner confirms it from the panel and sees who confirmed;
    - the pass removes exactly those relationships and nothing else. Afterwards nothing made for the test is left on
      staging. Staging's tagging relationships and people differ from before the test only by what the relay's own
      taggings changed meanwhile, as the path's and the passes' reports show;
    - an admin sees the disabled Confirm and its reason;
    - a user who is neither is refused at the confirm route and gets no who;
    - signed out, no read names who confirmed;
    - the overdue warning absent while the daily pass is on time;
  - production gets read-only checks only, after a promotion.

## Evidence

### The gate (Implementation, 2026-11-07)

Node 22.23.4, full `npm test`, read from the run records (`gate:status`):

| Run | Tree | Backend its live suites measured | Passed | Failed | Skipped | Suites |
|---|---|---|---|---|---|---|
| Before the story `20261107T053043Z-34143-9125` | `79432158`, the failing tests (a worktree; its one untracked entry is its `node_modules`) | started 2026-10-28 | 7,010 | 181 | 173 | 334 |
| After Implementation `20261107T055729Z-34174-736c` | `60043230` | started 2026-10-28 | 7,154 | 38 | 172 | 334 |

- **Which backend the live suites measured.** Both runs came before the local backend's restart at 21:22:05Z, so their
  live suites measured the process started on 2026-10-28 23:11:49Z, not this story's server code. The review's run
  will be the first gate on it.
- **The story's 12 suites go from failing to passing**, before → after (passed/failed):
  - confirm, 0/29 → 29/0; confirmation-lib, 0/14 → 14/0; held-fixture, 0/9 → 9/0; overdue, 0/23 → 23/0;
  - pass-control, 61/13 → 74/0; runner, 88/3 → 91/0; state-routes, 54/10 → 64/0; wiring, 85/2 → 87/0;
  - fetch, 31/6 → 37/0; panel-source, 34/10 → 44/0; view, 110/22 → 132/0;
  - task-queue job-gate, 26/2 → 28/0.
- **One other suite changed:** `relay-scan-bounds`, 27 passed and 1 skipped → 28 passed. Its live probe skipped in the
  first run and ran in the second; the story does not touch it.
- **The other 17 failing suites fail in both runs** with the same pass, fail and skip counts.
- **The browser spec** (`tests/brainstorm/tagging-pipeline-panel.spec.js`, Playwright on the rebuilt UI, chromium):
  151 of 151.

### The local stack (2026-11-07, times UTC)

The backend was restarted onto `60043230` at 21:22:05Z and the UI rebuilt (`scripts/dev-refresh.sh`). Every held list
was made only of fixture relationships (ADR 0007 § Evidence). Nothing touched a relay. The owner pressed each Confirm
on the panel, signed in as the owner. The answer lines themselves were read by the owner only; what is recorded below
is the server's side, and in each case it is the state D2's plan gives for the outcome named. The panel text quoted
was read in the app's browser pane with only the two sign-in reads and `/api/settings` stubbed and every non-GET
blocked (none was sent).

- **Counts before:** `TAGS` 7,030, all at tagging addresses; `NostrUser` 6,201; no fixture nodes. `plan`: B 7,030,
  T 802.
- **1. Overdue.** With no enabled entry the status's `overdue` read `no-entry`. A temporary entry with the cron rule
  `0 3 * * *` (21:23:20Z; first run 2026-11-08 03:00Z, and nothing ran) gave `overdue`, counting 24 h (`periodMs`
  86,400,000) from the pass that began on 2026-10-29 05:14:51Z. The panel: "The pass is overdue: the latest pass began
  at 10/29/2026, 1:14:51 AM, and the schedule expected the next by 10/30/2026, 1:14:51 AM." A Run at 21:24:59Z read
  `on-time` 0.8 s later, and the warning was gone from the panel. The entry was disabled and deleted; `no-entry` again,
  and no repeat key left in Redis.
- **2. Confirmed and carried out (run `l1`).** `create` → 7,832 `TAGS`. A Run held exactly the 802
  (`20261107T212601Z-957b7a82`, `done-removals-held`); `check` passed. The panel: "The latest pass,
  20261107T212601Z-957b7a82, held 802 removals for the owner to confirm." The owner confirmed at 21:36:43.374Z (lined
  up): the record gained the confirm line, `who: {kind: 'owner', key: 'f0178122'}` with the held run's id, and at the
  same instant a start line with `who: {kind: 'confirmation'}`. Pass `20261107T213643Z-fd54ab4f` began 0.3 s later
  and removed exactly the 802 (`not-on-relay` 802, unchanged 7,030); its report's `confirmation` reads found and
  honoured, with `mintedAt`. Signed out, the status, the held list, the path status, the Task Explorer's two data
  routes and the task timeline carry no owner key, no `who` and no `mintedBy`. `cleanup` removed the two nodes and no
  relationship; the counts equal the first.
- **3. A waiting pass (run `l2`).** `create`; a Run held the 802; `check` passed. The heavy lock was held (ADR 0006's
  `HSET … evidence-hold`) and a second Run waited behind it (`state: waiting`, `behind: heavy-work`). The first hold
  was set to one hour, which ran out (22:38:37Z) before the owner confirmed. The waiting pass then ran, found no
  confirmation, and held the same 802 again as `20261107T223838Z-94b98aba`, as it should. The step was redone with a
  three-hour hold, under the four-hour wait limit. The owner confirmed at 23:08:07.442Z (waiting-pass): a confirm line
  and no start line. The public `confirmationPending` showed only version, runId, heldDigest, heldCount, mintedAt,
  expiresAt and `expired: false`. The lock was released at 23:08:24Z; the waiting job began about a second later as
  `20261107T230825Z-f0dbc7b6`, took up the confirmation, and removed exactly the 802. `cleanup`; counts equal the
  first. **For a re-run:** hold the lock for longer than the owner may take to confirm, and under four hours.
- **4. The queue unavailable, then expired (run `l3`).** `create`; a Run held the 802 (`20261107T230857Z-c7ded939`);
  `check` passed. `TASK_QUEUE_ENABLED=false` in the container's `/etc/brainstorm.conf` (that one line, from a backup)
  and a backend restart (23:09:03Z); the status's `control.queue` read `off`. The owner confirmed at 23:11:14.075Z (not
  lined up): a confirm line, no start line, no busy pass. `confirmation.json` held version, runId, heldDigest,
  heldCount, nonce, mintedAt and expiresAt (no `mintedBy`); the public member left out the nonce. With `expiresAt` set
  a minute into the past, the status read `expired: true`, and the panel said "The owner's confirmation of pass
  20261107T230857Z-c7ded939 expired at 11/7/2026, 6:10:54 PM. No pass will carry it out. The owner can confirm this
  held list again." and offered Confirm. Its prompt (opened, then cancelled; nothing sent) ended "This replaces the
  earlier confirmation, which no pass will carry out." Focus went to Cancel when it opened, and back to "Confirm held
  removals" after Cancel. The flag was restored (the file identical to its backup) and the backend restarted
  (23:12:45Z; `control.queue` `ok`). The owner confirmed again at 23:26:05.272Z (lined up): a confirm line and a start
  line by `confirmation`; pass `20261107T232605Z-e42fcb36` took up the new confirmation and removed exactly the 802.
  `cleanup`.
- **After:** one more Run (`20261107T232624Z-d87fefad`, `done`, nothing held), so no fixture held list is the latest.
  Counts equal the first; no fixture node, no schedule entry, no confirmation, no lock holder; the queue on.

## Deviations

Logged at Implementation (2026-11-07). Each is a reading of ADR 0007 where its letter left a detail open, or a small
choice beside it.

**Owner-decided (2026-11-07):**
- **The overdue module is `src/pipeline/tagging-edges/overdue.js`, not `src/lib/tagging-edges/`.** Story 1's purity pin
  (`test/tagging-edge-contract.test.js`) refuses dates and any outside require there, and the cron judge needs both. The
  owner chose to move it. ADR 0007 D8 has a dated note, and the overdue suite's module path followed (a one-line test
  change, recorded in its header).

**Server:**
- `publicConfirmation` serves an `unreadable` code only when it is an E-code or `error` (else `error`), so a
  hand-edited file cannot pass text through. `{unreadable}` keeps today's `expired: false` beside it.
- D2 step 7: a re-read of the report that throws counts as "a pass may have started" and withdraws (409 `pass-started`,
  or `taken-up` with `claimedBy: null` if a pass already took it). The old route answered 500.
- D2 step 1 runs `validateConfirmation` twice, as the route did, so liveness (a /proc read) is read only once the other
  checks hold (RT14 pins it).
- D2 step 2: a `readConfirmation` that throws counts as not pending, so a new confirmation replaces it.
- Every refusal from `confirm` carries an `error` sentence, its 500 `error` included; the route passes it through.
- `overdueVerdict` checks `cannot-tell`/`rule` before `no-pass`, D8's listed order. Whether a cron parses is judged
  with cron-parser even when `periodOf` is injected. A `startedAt` that is not a string, or a start plus period past
  a Date's range, reads `cannot-tell`/`report`. When the cron cache is full, the oldest pattern is dropped.
- An interval sums days, hours and minutes exactly as `toRepeatOpts` does (so 1 day minus 5 hours counts as 19 h).
- `lineUp` still accepts a `mode` argument and ignores it; `pass.js` still passes `mode: 'run'`.
- The fixture script:
  - reads the Neo4j settings and the domain by sourcing brainstorm.conf in bash, as the pass's wrapper does, values
    through a pipe and bash's stderr dropped; `BRAINSTORM_CONF_PATH` overrides the path;
  - reads "the instance's configured domain" as `STRFRY_DOMAIN`, compared ignoring case, before any driver is built;
  - runs `create`'s "a fixture already exists" refusal inside the create's own transaction;
  - `plan` notes when fixture nodes already exist, since the base would count them;
  - `check` pins later pages to the first page's run id (a newer pass in between fails it) and reads `127.0.0.1` on
    `CONTROL_PANEL_PORT` or 7778;
  - `cleanup` reports what it removed from the driver's counters;
  - exits 2 for usage, 1 for refusals and failures; `--count` is 1 to 7 digits.

**UI:**
- D15's helper is `useReturnFocus(open, headingRef)`: it sees the prompt close from its open flag and calls `closed()`
  itself; owners call `cancelled()` from Cancel. `wasInside` is read just after the prompt has gone, as "focus is on
  the page", which is where focus from a removed prompt falls.
- D15's "focus parked on the heading moves to the outcome line when it appears" applies to all three prompts, not only
  Turn off. The pass and path sections' heading refs are made in PassSection and PathSection and passed down.
- D10: a Confirm prompt that remounts while under way focuses its `h4`, not the disabled Cancel. While its snapshot is
  set the prompt renders in every held-section branch, and the answer line shows in every branch, so a re-read during
  the send never removes them.
- D13: "The owner can confirm this held list again" shows only where the section shows the latest pass's held list;
  elsewhere only "No pass will carry it out." For an unknown expiry, today's "is waiting" sentence stays and D13's two
  sentences are appended.
- D9: `offer` also requires `!usedUp` (D13 "offer no Confirm").
- D12: a confirm line joins `mintedAt` by instant (equal `Date.parse`), and only an owner's line with a key gives the
  key; the line reads "It took up the owner's confirmation (key…), made at T."
- D11: a 200 with no or an unknown `outcome` has its own sentence, claiming nothing. Each out-of-date code has its own
  first sentence, then "The panel now shows the latest state", and shows its code, as do `pass-started` and
  `withdraw-failed`; a 4xx with a body code (such as 400 `bad-run-id`) takes the generic failed sentence. Sending a
  Confirm clears only Confirm's last outcome.
- D14: an `overdue` state outside D8's reads "cannot tell"; the warn tone also applies in the schedule list's loading
  branch, while the failed-list branch keeps its bad border.
- Run's outcome line also carries `tabIndex -1` (the shared outcome component); only Stop's carries a ref.
  ScheduleSection and HeldSection import `TimedLine` from `PassControls.jsx`.
- Wording that is the Implementer's: the used-up line, the cannot-tell reasons, and the opening line's added sentence.

## Linked artifacts
- ADR: `engineering-team/decisions/tagging-edges/0007-confirm-held-removals.md`
- Test plan: `engineering-team/stories/tagging-edges/7-confirm-held-removals.test-plan.md`
- Review: `engineering-team/reviews/tagging-edges/7-confirm-held-removals.md`

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
