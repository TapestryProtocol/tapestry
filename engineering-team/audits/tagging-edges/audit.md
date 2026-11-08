# Build Audit: Tagging edges — NostrUser→NostrUser relationships that reflect Taggings

**Book:** `engineering-team/audits/tagging-edges/book.md`
**Date:** 2026-11-08
**Branch / commit range:** `60e33542..f4dd1af7` on `origin/staging`, from story 1's story commit (2026-09-26) to the
merge of story 7's ship records (nousclawds4/tapestry#41). Production is at `61b5bff1`.
- **Commits.** 144 have "tagging-edges" in the subject: 121 regular and 23 merges. By kind: test 22, adr 21, docs 20,
  impl 19, review 18, story 7, evidence 7, ledger 5, records 1, epic 1.
- **Shipped.** All seven stories are on staging and production. Story 7 reached production on its own, as 24 commits
  cherry-picked onto main (nousclawds4/tapestry#40). Its ship records (#41) are on staging only, and ride the next
  promotion.

**Provenance:** Acceptance-frame. There is no PRD. The owner's ask of 2026-09-25 is quoted verbatim in `book.md`, and
the frame was confirmed at kickoff on 2026-09-26. Three dated amendments, all the owner's, split and widened the
"front-end controls" bullet.
**Confidence:** high for what was built.
- Every frame bullet traces to a story.
- All seven stories passed review.
- Each story's evidence was recorded on staging, and each was checked read-only on production.
- The code the book owns is identical on staging and production (§3).

The frame's "from every path an event can reach the relay" holds only with the scheduled pass as its backstop (§4 #2),
and that backstop stopped for eight days in October without anyone noticing (§4 #3).

## 1. What shipped

Each capability is listed under the frame bullet it serves. The stories are in
`engineering-team/stories/done/tagging-edges/`.

- **The relationship exists and is documented** (story 1, `1-tagging-edge-contract.md`).
  - A tagging becomes one `(:NostrUser)-[:TAGS]->(:NostrUser)` relationship. It carries the raw stance and which tag
    applies, and no trust, count or name.
  - A pure module sets which events count, which version stands and what a revoke removes.
  - BIBLE §6 describes it beside FOLLOWS, MUTES and REPORTS.
- **Retroactive fill** (story 2, `2-gap-filling-pass-and-backfill.md`).
  - The registry task `reconcileTaggingEdges` brings `TAGS` into agreement with the relay. Its first run is the
    backfill: 7,023 relationships added on staging, 7,033 on production.
  - It adds missing people.
  - It holds removals when more than 50 and more than a tenth are due, and writes a report.
  - A uniqueness constraint keeps one relationship per tagging address.
  - Each host runs it daily.
- **Real time** (story 3, `3-real-time-path.md`).
  - A supervised program hears every relay write. It reflects a new tagging, a stance change, a move or a revoke within
    a minute, and a burst of 10,000 within five.
  - It catches up by itself after a restart.
  - It ships off, and the owner turns it on per host. Both hosts were turned on on 2026-09-30.
- **Front-end controls** (stories 4–7), all on Settings › Relays › Tagging pipeline, for the owner and admins:
  - **The panel** (story 4, `4-tagging-pipeline-panel.md`) shows the pass, its held removals, the backstop schedule,
    the real-time path and the drift between relay and graph. Drift is counted on demand and explained against the
    newest finished pass.
  - **The path's switch** (story 5, `5-real-time-path-switch.md`) is for the owner or an admin. It has a prompt before
    off, and a record of who switched it and when.
  - **Run and Stop for the pass** (story 6, `6-pass-run-and-stop.md`), for the owner or an admin:
    - every viewer sees "waiting", "stop asked" and "gave up";
    - a stop is graceful;
    - who started or stopped each pass is recorded;
    - the generic run-task route answers as Run does.
  - **Confirm held removals** (story 7, `7-confirm-held-removals.md`) is for the owner only, after a prompt:
    - admins see a disabled Confirm with its reason;
    - who confirmed shows in the history, and the public status names nobody;
    - every viewer is warned when the daily pass is overdue;
    - all three prompts return focus when they close.
- **Nothing else moves** (all stories). Follows, mutes and reports ingestion is unchanged. No trust, point of view or
  count is stored on `TAGS`, and nothing locally authored is removed: the pass removes only relationships at tagging
  addresses. Its side effects are listed in §4 #11 and #12.

## 2. Epics & stories rolled up

### Epic: `tagging-edges`

| Story | Delivered | Status | Review | Staging · production |
|---|---|---|---|---|
| #1 tagging-edge-contract | The `TAGS` contract and BIBLE §6 | Done | 2 rounds · `reviews/done/tagging-edges/1-tagging-edge-contract.md` | #764 · #765, 2026-09-27 |
| #2 gap-filling-pass-and-backfill | The pass, the backfill, held removals, the console confirm route | Done | 3 rounds · `2-gap-filling-pass-and-backfill.md` | #780 · #781, 2026-09-28; production's backfill ran 2026-09-30 |
| #3 real-time-path | The real-time path and its owner-only switch route | Done | 3 rounds · `3-real-time-path.md` | #785 · #786, 2026-09-30 |
| #4 tagging-pipeline-panel | The panel, read only, and drift counts | Done | 2 rounds · `4-tagging-pipeline-panel.md` | #791 · #792, 2026-10-01 |
| #5 real-time-path-switch | The switch on the panel, owner or admin, with its record | Done | 2 rounds · `5-real-time-path-switch.md` | #805 (evidence #813) · #809, 2026-10-02 |
| #6 pass-run-and-stop | Run and Stop, waiting states, who acted | Done | 2 rounds · `6-pass-run-and-stop.md` | nousclawds4/tapestry#6 (evidence #7) · #11, 2026-10-29 |
| #7 confirm-held-removals | Confirm on the panel, the overdue flag, focus from prompts | Done | 3 rounds · `7-confirm-held-removals.md` | nousclawds4/tapestry#37 (records #41) · #40, 2026-11-08 |

- **The ADRs:** `decisions/done/tagging-edges/0001`–`0007`, one per story, each amended by later ones as dated notes.
  The handoff `docs/TAGGING_EDGES_HANDOFF.md` carries the kickoff's map of the existing ETL. Its own review is
  `reviews/done/tagging-edges/handoff-doc-2026-09-27.md`.
- **Every story was sent back at least once:** 17 review rounds in all, 10 of them sent back. The harness-stats
  headline counts final verdicts only, so it reads 0% for this book (§7).
- **PR numbers.** Bare numbers are the old repo's (`nous-clawds4/tapestry`). Numbers restarted on
  `nousclawds4/tapestry` after the move of 2026-10-23.

## 3. As-built inventory

Derived from the diff (`git log` over the range above), not only the records.

**User-facing**
- **The panel:** Settings › Relays › **Tagging pipeline**, directly after ⚡ Streaming ETL. It lives in
  `ui/src/pages/settings/taggingPipeline/` (9 files, 1,940 lines), with `ui/src/utils/taggingPipelineView.js` (1,322)
  and `taggingPipelineFetch.js` (174).
  - It is reached through Settings' own lock, and has no link of its own.
  - tags.brainstorm.world does not serve it.
- **Its controls:**
  - Turn off / Turn on, with a prompt before off;
  - Run a pass now;
  - Stop, with a prompt;
  - Confirm held removals, with a prompt; admins see it disabled, with its reason;
  - Recount, for drift.
- **The Dashboard's** constraints check expects `tags_address` and offers the fix.

**Routes** (BIBLE §11)

| Method · path | Who | Story |
|---|---|---|
| GET `/api/tagging-edges/status` | public (no who, no `mintedBy`, no nonce) | 2, 6, 7 |
| GET `/api/tagging-edges/held` | public, the latest report's list only, paged | 2 |
| POST `/api/tagging-edges/confirm-held-removals` | owner only | 2, 7 |
| GET `/api/tagging-edges/realtime/status` | public | 3, 5 |
| POST `/api/tagging-edges/realtime/switch` | owner or admin (owner only until story 5) | 3, 5 |
| GET `/api/tagging-edges/realtime/switch` | owner or admin | 5 |
| GET `/api/tagging-edges/drift-counts` | owner or admin | 4 |
| POST `/api/tagging-edges/pass/run` | owner or admin | 6 |
| POST `/api/tagging-edges/pass/stop` | owner or admin | 6 |
| GET `/api/tagging-edges/pass/record` | owner or admin | 6, 7 |
| POST `/api/run-task?taskName=reconcileTaggingEdges` | owner, admin, or a direct local call | 6 |

**Domain and data**
- **Neo4j:** `TAGS {address, eventId, createdAt, polarity, tagAddress, tagEventId, tagSlug, zCanonical, zLocal}`.
  - One constraint: `tags_address`, unique on the relationship's address. It is declared in
    `setup/neo4jConstraintsAndIndexes.sh`, created at boot (`ensureTagsConstraintOnBoot`), and listed in
    `expectedNeo4jSchema.js`.
  - Missing people are added with a keyed `MERGE` on `pubkey`: about 5,850 per host.
- **Task and program:**
  - The registry task `reconcileTaggingEdges` is `neo4j-heavy`, takes no arguments, and times out after 30 minutes
    with a force-kill. Fresh installs get a disabled daily seed.
  - The supervisor program `tagging-edges-realtime` (`docker/supervisord.conf`) runs with a 384 MB heap.
- **State** in `/var/lib/brainstorm/tagging-edges/`, on the data volume:
  - the pass's `report.json`, `held/`, `confirmation.json`, `claimed/`, `preimages/` (never pruned except by the
    owner) and `pass.lock`;
  - `control/record.json`;
  - the path's files in `realtime/`: `switch.json` (version 2), `switch-history.json`, `daemon.lock`, `record.json`,
    `started.json`, `status.json` and `journal.jsonl`.
- **Status fields added over the book:**
  - `control {queue, busy, gaveUp}`;
  - outcome `stopped`;
  - `latest.job`;
  - `overdue {state, latestBeganAt, expectedAt, periodMs | reason}`;
  - `confirmationPending`, now an allowlist;
  - `latest.confirmation.mintedAt`;
  - `inStartWindow` on the path status.
- **Firmware and concepts:** no change, so no reinstall.
- **Evidence tooling:** `scripts/tagging-edges-held-fixture.js` (`counts | plan | create | check | cleanup`), for
  staging only, never production.

**Code and size**
- **Code:** `src/lib/tagging-edges/` (5 files, 1,957 lines), `src/pipeline/tagging-edges/` (14 files, 5,855),
  `src/api/tagging-edges/` (4 files, 1,113) and `src/lib/strfryScanStrict.js`.
- **Shared code touched behind a per-task opt-in:** the task queue (`jobGates.js` new, `queue/index.js`,
  `processor.js`, `resourceSemaphore.js`), `taskRegistry.json`, the scheduled-tasks API, `runTask.js` and
  `routeAccess.js`.
- **Tests:** 52 new files: 29 Node suites, one browser spec, 4 helpers and 18 fixtures, about 59,900 lines. That is
  about 4.4 lines of test per line of owned code (about 12,700).
- **Docs:** BIBLE §4, §6, §11, §16, §21, §24, §30; OPERATIONS §10.6, §12.8, §12.9.

**Production parity.** `git diff origin/main origin/staging` over every path the book owns prints nothing. Main
differs from staging only by other epics' work, and by this book's records on staging.

## 4. Deviations from intent

Harvested from the stories' Deviations, Out of scope and Open questions, the ADRs' Consequences and amendments, and the
reviews. The type vocabulary is the template's.

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Front-end controls: "the owner can see and manage … start / stop, and a gap-fill run on demand" | Four stories, not one. Admins may see the panel, switch the path, Run and Stop; Confirm stays the owner's. Story 7 also added the overdue warning and focus from prompts | intentional-change, added-beyond-scope | The owner's amendments of 2026-09-30, 10-01, 10-02 and 10-30 (`book.md`) | An admin can undo the owner's off; no "off only the owner can lift" (declined, story 5) | — |
| 2 | Real time "from every path an event can reach the relay" | Some changes wait for the daily pass: removals with no event (a wipe, an expiry, an operator delete), a version stored and revoked by id before it was announced, a lost record, changed identities | constraint-discovered | Story 3 Out of scope; ADR 0003 decisions 5 and 10, A1 | The pass is the backstop; a host is never fully real time without it | §6 #4 |
| 3 | Real time "without operator action" | The path ships off, and the owner turns it on per host | interpretation | Story 3 open question 5 | None after 2026-09-30; a new host must be turned on | — |
| 4 | Revokes reflected | The real-time path removes only on the author's revoke plus a later relay read. The pass follows the relay, so a deletion strfry ignored removes nothing. An id-only revoke lets an older re-sent version stand again | intentional-change | ADR 0002 A5, A7 and decision 2; ADR 0003 | An edge can follow an older version | Row `2026-09-27-ui-revoke-names-id-only` |
| 5 | Missed revokes filled retroactively | Revokes do not travel between instances | deferred | Story 2 Out of scope | Two taggings revoked on tags.brainstorm.world still stand on staging and production | Row `2026-09-27-revokes-do-not-travel` |
| 6 | Every instance's relay | tags.brainstorm.world has neither the pass nor the path | deferred | Story 2; story 3 Out of scope; story 7 Out of scope | No `TAGS` there | §6 #1 |
| 7 | "Never mass-deletes" | More than 50 and more than 1/10 due are held for the owner. Confirming was a console request until story 7 put it on the panel | interpretation | ADR 0002 decisions 4–7 and 14; story 7 | None now | — |
| 8 | (Planned in story 7) "Confirm while a pass is busy starts nothing new" | When every busy pass has a stop asked for, Confirm lines up a new pass | intentional-change | Story 7 Planning, 2026-11-07 | Otherwise the owner would be stuck | — |
| 9 | (Planned in story 6) a confirm-route start goes ahead unrecorded | Confirm is refused when it cannot be recorded, as Run is, and so is the console snippet | intentional-change | Story 7 AC-4; ADR 0007's amendment of 0006 D8 | The snippet can now be refused | — |
| 10 | Real-time removals bounded like the pass's | No count limit | intentional-change | Story 3 open question 4 | A bulk revoke goes straight through | — |
| 11 | "Nothing else moves" | About 5,850 `NostrUser` nodes added per host, never removed | interpretation (the owner's) | Story 2 open question 1 | The Dashboard's user count rose | — |
| 12 | "Nothing else moves" | Small residuals: about 4×10⁻⁶ scoring deadlocks per overlapping write; the pass holds the heavy lock, so scoring waits and deploy-safety reads unsafe while it runs; shared task-queue code changed behind a per-task opt-in, and every job now gets `BRAINSTORM_TASK_JOB_ID` | constraint-discovered, interpretation | ADR 0003 decision 1; ADR 0002 decision 12; ADR 0006 Decision | Deploys wait on a running pass | Row `2026-09-27-stream-consumer-at-most-once` |
| 13 | Decision 5's crash corner (≤ 250 ms) | Widened: while journal appends fail, the whole spell can be lost, and the status reads `stale` | constraint-discovered | Review 3 C7; the owner accepted 2026-09-30 | A full disk risks what is in memory | — |
| 14 | The tagging schema as written | Address-only taggings are accepted; stance comes from `polarity` and target from `p`; 6 id-only taggings stay unresolved | intentional-change | Story 1; ADR 0001 | — | Row `2026-09-27-user-tag-schema-requires-event-id` |
| 15 | Overdue rule (story 7 AC-5) | The server reads the schedule itself. More than 32 cron patterns, or one over 256 characters, reads "cannot tell" | interpretation, constraint-discovered | ADR 0007 Readings 3, R12, fix-round D8 notes | More "cannot tell" at the edges, never a false "on time" | §6 #9 |
| 16 | Prompts return focus (story 7 AC-6) | Done for the three prompts. A focused control that a later read removes still drops focus to the page | deferred | Review 7 rounds 2–3, "For the owner" | Keyboard and screen-reader gap | Row `2026-11-08-focused-control-removed-drops-focus` |
| 17 | Stop's job keys ≤120 characters (ADR 0006 D9) | 1–256 characters with no control character; a BullBoard-made job can make every Stop fail (R9), with a way out in OPERATIONS §12.8 | constraint-discovered | ADR 0006 Amendment 1 | Rare; an operator remedy exists | — |
| 18 | Evidence leaves nothing behind (ADR 0007 § Evidence) | Each confirmed fixture run leaves a safety-copy file (834 lines on staging, 3×802 locally) | constraint-discovered | Story 7 § Evidence, "Staging" | Fixture data only; no route serves it | Row `2026-11-08-held-fixture-leaves-safety-copies` |
| 19 | Evidence per story on staging and production | Story 5 reached production before its staging evidence. On production story 7's panel was not viewed (no owner sign-in), so the bundle's strings stood in for it | interpretation | Ledger `2026-10-02-promotion-outruns-pre-main-evidence`; story 7 § Evidence, "Production" | None found | — |
| 20 | Status visible without a shell | Until story 4, the public JSON routes were the only view, and confirming was a console request until story 7 | deferred | ADR 0002 decision 14 | None now | — |

**Undocumented work.** None. The diff walk found commits touching the book's paths without its name only in a
security sweep that re-pointed two of its tests (`ad61b9ad`, `0493377a`, `151e39fb`: security-auth-exposure #8,
reviewed there), and in merges whose resolutions changed none of the book's files. One related gap is documented
elsewhere: all ten `/api/tagging-edges/*` routes are in BIBLE §11 but not in `openapi.yaml`. The openapi-coverage book
lists them first in its known gaps (`audits/openapi-coverage/audit.md`).

## 5. Quality state at close

- **The test gate at close,** after the flip and the epic close-out, over the tree this close leaves behind (`+dirty` is
  this close, uncommitted; Node 22.23.4 from the scratchpad; the local backend spawned 2026-11-08 14:50:18Z on
  `065fa2c1`, story 7's code):
  `20261108T221158Z-66476-c7ac [book-close-tagging-edges] started 2026-11-08T22:11:58.616Z on f4dd1af7+dirty — FAIL, exit 1, 7244 passed, 38 failed, 173 skipped, 337/337 suites; failed: tag-detail-curated-view-and-pin-polish, nip51-list-export-from-pins, router-stream-limit-on-connect, relationship-primitives-probe, capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, not-yet-shared-filter, concept-count-canonical, summaries-element-count, setup-alert-polish`
  - **The failing set is the host's known one, unchanged.** It is the same 17 suites with the same 38 failures as
    story 7's last gate (`20261108T145041Z-79787-7f9a`, fix round 2), compared suite by suite.
    - Sixteen failed in every gate run of story 7 as well. Most are live suites that read this host's graph and stack
      (OPEN.md row 289's class).
    - `setup-alert-polish` S2 fails on every staging tree since the reading views landed. It is also the one failure
      in CI on #37 and #41.
  - **None is this book's.** Its 29 suites all pass, 1,395 tests. The opt-in `tagging-edges-live` suite skips (0/0/19),
    as it does without its environment.
  - **What changed since that run** is staging's newer work, all passing: `openapi-coverage` (13),
    `openapi-document` (10) and `operations` (46) are new, and `brains-launcher-repo` went from 29 to 31.
    `relay-scan-bounds`' live probe skipped this time (27/0/1), as it sometimes does.
- **This book's suites at story 7's last runs**, all passing: the 12 story-7 suites at fix-round-2 counts, and the
  browser spec 159 of 159. They pass on staging's tree and on the promotion's tree (story 7 § Evidence,
  "Production").
- **Ledger rows this book opened:** 51 in all, 5 of them done. The 46 still open are:
  - **Bugs (18):**
    - `2026-09-27-`: `expected-schema-lists-disagree`, `launchchildtask-reports-success-always`,
      `processalltasks-calls-removed-reconciliation`, `reports-writers-disagree-on-shape`, `revokes-do-not-travel`,
      `router-restore-defaults-drops-streams`, `scheduled-tasks-failure-never-set`, `stale-heavy-lease-after-deploy`,
      `stream-consumer-at-most-once`, `strfry-redis-misses-websocket-writes`, `strfry-redis-never-reconnects`,
      `ui-revoke-names-id-only`;
    - `2026-09-28-pass-relay-read-byte-cap`, `2026-09-29-strfry-delete-hides-next-write`,
      `2026-10-28-live-tests-expect-404-not-401`, `2026-10-30-prod-pass-gap-unnoticed`,
      `2026-11-08-held-fixture-leaves-safety-copies` and `2026-11-08-focused-control-removed-drops-focus`.
  - **Security (1):** `2026-09-27-config-reader-logs-values`.
  - **Cleanup (4):** `2026-09-27-register-social-relationship-types`,
    `2026-09-27-test-fixture-taggings-on-prod-relays`, `2026-09-29-realtime-engine-round-split` and
    `2026-10-01-drift-copies-canonical-z-pattern`.
  - **Docs (5):** `2026-09-27-bible-s6-relationship-name-drift`, `2026-09-27-social-edge-properties-undocumented`,
    `2026-09-27-user-tag-schema-requires-event-id`, `2026-09-30-missed-fire-policy-unverified` and
    `2026-10-02-admin-list-source-docs-stale`.
  - **Meta (18):** §7.
  - Most of the 2026-09-27 rows record faults in the existing ETL that the kickoff's map found, not faults this book
    introduced.
- **Debt the ADRs accepted, with no row:**
  - **ADR 0002:**
    - risk 4: a silent under-read of the relay can apply up to a tenth of removals;
    - risk 5: people with upper-case pubkeys stay separate from the pass's nodes.
  - **ADR 0003:** the path's ceilings (100,000 `seen`, a 12 s round, a 20 s stamp scan, a heap ceiling of 240,000),
    written in OPERATIONS §12.9.
  - **ADR 0004:**
    - a graph count Neo4j accepts and never answers can pile up to the pool of 20;
    - the panel's copy and colours follow the guardrails while its neighbours don't.
  - **ADR 0005:**
    - a hand edit of `switch.json` is the one unrecorded change;
    - history can be lost on a failing volume (residuals a and b).
  - **ADR 0006:** residuals R1–R9.
  - **ADR 0007:** residuals R10–R13.

## 6. Carry-forward register

Product and scope:
- [ ] **1. Other instances.** tags.brainstorm.world, and any instance but staging and production, has no pass and no
  path, so no `TAGS` (§4 #6).
- [ ] **2. Revokes across instances** (row `2026-09-27-revokes-do-not-travel`), and id-only revokes that let an older
  version stand (row `2026-09-27-ui-revoke-names-id-only`).
- [ ] **3. October's backstop gap.** The cause, from the droplet's logs, and the missed-fire reading are still open
  (row `2026-10-30-prod-pass-gap-unnoticed`, fix shapes 1 and 3). There are no alerts outside the panel (story 7 Out
  of scope).
- [ ] **4. The corners real time leaves to the pass** (§4 #2). Whether any deserves its own signal is a product
  question.
- [ ] **5. Focus when a later read removes the focused control** (row
  `2026-11-08-focused-control-removed-drops-focus`; a short story or a recorded decline).
- [ ] **6. The panel's place:** it has no link of its own (story 4); its copy and colours differ from its neighbours'
  (ADR 0004); and its buttons' contrast is low in both looks (issue `fdd1d1a5`, carried in the appearance-setting
  audit §6).
- [ ] **7. The ten `/api/tagging-edges/*` routes in `openapi.yaml`** (the openapi-coverage audit's known gaps).
- [ ] **8. The story 7 test plan's three notes for the owner**, still unanswered
  (`stories/done/tagging-edges/7-confirm-held-removals.test-plan.md`, "For the owner"):
  - whether every busy pass can have a stop asked for;
  - that the pending line shows for an earlier pass's confirmation;
  - that older suites read the real `scheduled-tasks.json`.

Code debt from the reviews, not yet placed (each with its source in `reviews/done/tagging-edges/7-confirm-held-removals.md`
unless named):
- [ ] **9. The overdue judge:**
  - `Math.min(...periods)` in `overdue.js` overflows the stack at about 130,000 entries (round 3, 6);
  - spreading the first read's cron cost is the owner's call (round 2, NB3; ADR 0007 fix-round notes);
  - the cron judge's limits (clustered rules, a cache that ignores `nowMs`, daylight saving) have no residual
    (round 1, NB11);
  - three long-check conditions are unpinned (round 3, NB1).
- [ ] **10. The confirm controller:**
  - `d.nonce()` runs after the record write (round 1, NB1);
  - `pass.js` still passes `mode: 'run'` (NB2);
  - the crash window between the record and the file needs a residual (NB3);
  - the `held-list-changed` sentence claims a re-read that does not happen (NB9);
  - the `withdraw-failed` sentence says a pass started (round 2, NB1).
- [ ] **11. The panel:**
  - paging the held list closes the Confirm prompt (round 1, NB7);
  - D11's "unknown" sentence (NB8);
  - a stale answer line can become the focus target (NB10);
  - there is no browser case for the keyboard route to "Turn on" (round 3, NB2).
- [ ] **12. Tests and records:**
  - the fixture script's `create` refusals are untested, and its `--count` trust, success line, exit code and
    "never production" are policy only (round 1, NB4 and NB12);
  - CH29 skips `/api/task-explorer/data` (NB5);
  - story 6's test plan D8 row needs a dated note (NB6);
  - superseded round-1 lines have no forward pointer (round 3, NB3).
- [ ] **13. Outside the story (review 7):**
  - `compose.test.js:84` flakes about 1.6% of runs;
  - Scheduled Tasks validation caps neither entry count nor cron length;
  - `validateClaim` calls `Date.parse` with no type check (`reconcileTaggingEdges.js`).
- [ ] **14. Two unexplained timings from story 5:** why a deploy's catch-up takes about 30 s, and an `ERR_` sentence
  family (ADR 0005).
- [ ] **15. The records riding staging:** nousclawds4/tapestry#41 (story 7's ship records and this close) is not on
  main. It rides the next promotion, which meets the two `**Last updated:**` lines the selective promotion touched
  (§7, row `2026-11-08-selective-promotion-diverges-main`).

## 7. Process findings (harness)

**Measured at retro time** (`bash scripts/harness-stats.sh`, 2026-11-08):
- 316 reviews decided, 2 final CHANGES_REQUESTED; headline kick-back rate 0%; re-review churn 3.
- The headline counts final verdicts only. In this book every one of the seven stories was sent back at least once:
  17 rounds, 10 of them sent back (§2). The undercount is the class OPEN.md row 309 already tracks.
- **Cycle times** (story to review, slug match): 0 days for stories 1, 2, 4 and 5; 3 for story 3; 25 for story 6;
  1 for story 7.
- **Books:** 91 closed before this one, 11 open with it. The book was open 43 days.
- **The session digest** counts 238 open harness lessons, the oldest 129 days, above the escalation line. This book
  opened 19 `meta` rows, of which 1 is done. This retro adds one row, and four dated sightings to rows already open.

**What held.**
- Story 5 reached production before its staging evidence (row below). Stories 6 and 7 waited for theirs.
- Rule 10 (re-derive every fix, the review's own wording included) caught wrong sentences in the handoff's review and
  twice in story 7's record fixes.
- Planted faults caught tests that could not fail, such as B155's first version.
- The safe-to-merge check ran before every merge in this session. It waited out a running search refresh before #40.

| Finding | Source | Terminal state |
|---|---|---|
| The after-gate ran on a dirty tree twice | Review 1, Harness friction | declined: the gate's run record marks a dirty tree (`+dirty`), so the run is labelled, not hidden; not seen again in stories 2–7 |
| The opt-in live suite and evidence runs leave no required record | Review 2, friction 1–2 | `ledger/2026-09-28-live-and-evidence-runs-unrecorded` |
| A review lens printed the local Neo4j password | Review 2, friction 3 | `ledger/2026-09-28-conf-secret-masking-snippet` |
| A review's own suggested wording was adopted unverified (handoff review, review 2, story 7) | Handoff review; review 2 round 2; review 7 round 3 | `ledger/2026-09-28-review-suggested-wording-unverified` |
| Named mutants were not re-run after a fix | Review 2 round 2 | `ledger/2026-09-28-named-mutants-not-rerun-after-fix` |
| One `git fetch --dry-run` despite the no-network rule | Review 2 round 2 | declined: read-only, once, no host written; the rule held otherwise |
| A doc test pinned the newest Last-updated entry | Review 3, friction 1 | `ledger/2026-09-29-newest-entry-doc-tests-go-stale` (its S2C16 half fixed in `a5273b05`) |
| The test plan maps ACs to tests, so a module behind an injected seam can ship untested (stories 3 and 7) | Review 3, friction 2; review 7 round 1 | `ledger/2026-09-29-test-plan-misses-injected-seams` |
| The reviewer's wiring contradicts read-only briefs, and role files say the Reviewer commits while parallel lanes cannot | Review 3, friction 3; review 6 friction 7 | OPEN.md row 316; `ledger/2026-10-11-reviewer-dispatch-tools-and-commit` |
| The handoff overstated the constraint gate | Story 2 Planning | `ledger/2026-09-27-handoff-overstated-constraint-gate` (DONE) |
| A promised ledger row did not exist at review | Review 1, blocking 4 | rows filed in `914f59fa` |
| The handoff's §5 repeated story 1's false belief | Handoff review, round 1 | declined: corrected in the handoff itself (blocking 4); the class is the DONE row above |
| A test plan credits behaviour no test pins (stories 4 and 7) | Review 4, friction 1; review 7 round 1 | `ledger/2026-10-01-test-plan-credits-unpinned-behaviour` |
| Review 4's header says eight friction findings stood, but it lists three | Review 4 | declined: wording in a frozen review, with no later sighting |
| The gate baseline was taken at the failing-tests commit and hid a regression | Review 5, round 1 | `ledger/2026-10-02-gate-baseline-hides-story-regressions` |
| Story 5 reached production before its staging evidence | Story 6 Planning | `ledger/2026-10-02-promotion-outruns-pre-main-evidence` |
| Process-shaped deviations: story 4's "no delayed job" check cannot hold while a backstop is enabled; story 5's baseline worktree read dirty from a `node_modules` link; story 5's notes carried two dates | Story 4, story 5 Deviations | declined for the first two: one-off test-plan wording and a recorded quirk, each handled in its evidence; the third fixed in `ca504c42` (C5-9) |
| A "goes to story N" follow-up was lost; story 7's test-plan notes for the owner and twelve review notes reached the close untracked | Review 6, friction 6; this close (§6 #8–#13) | `ledger/2026-10-28-review-routed-follow-ups-unread`, with a dated sighting at this close |
| Workflows truncate lane results | Review 6, friction 1 | `ledger/2026-10-28-workflow-truncates-lane-results` |
| The browser recipe builds into the repo, and runs leave no durable record | Review 6, friction 2 and 10; review 7 round 3, NB5 | `ledger/2026-10-28-browser-lane-recipe-and-run-record` |
| Shell traps in recipes: macOS has no `timeout`, zsh reads `$c:src`, and a `<T>` placeholder pasted into bash became an input redirection | Review 6, friction 3 and 9; story 7's staging run | `ledger/2026-10-28-macos-shell-traps-in-recipes`, with a dated sighting at this close |
| The gate record drops failing test names and prints `skipped: undefined` | Review 6, friction 4 and 8 | `ledger/2026-10-28-suite-results-omit-names-and-skips` |
| The gate's live suites measured a stale backend (story 6: 26 days old; story 7's first gate predated its restart) | Review 6, friction 5; story 7 § Evidence | `ledger/2026-09-20-live-tier-fails-on-stale-stack`, with a dated sighting at this close |
| An `impl:` commit edited an accepted ADR note | Review 7, round 2 | restored in `8cde9c76`; `ledger/2026-10-11-implementer-edited-accepted-adr` |
| A red local Playwright run hangs on the HTML reporter | Review 7, round 3 | `ledger/2026-11-08-local-playwright-run-hangs-on-failure` |
| A fix round's live evidence was not checked against the build before the fix | Review 7, round 3 | `ledger/2026-11-08-live-evidence-unchecked-against-old-build` |
| Staging PR #6 merged with no safe-to-merge check | Story 6 § Evidence | OPEN.md row 340 |
| A diverged main forced a `promote/*` branch | Story 6 § Evidence | `ledger/2026-10-29-cycle-prod-skips-trial-merge` |
| Main merged on GitHub against the H²₀ baseline (#11, and again #40 by the owner's choice) | Stories 6 and 7 § Evidence | `ledger/2026-10-29-h2-0-baseline-predates-github-flow`, with a dated sighting at this close |
| A promotion of one story by cherry-pick leaves main and staging with different commit ids, and `/cycle-prod` describes only a promotion of all of staging | Story 7 § Evidence, "Production" | `ledger/2026-11-08-selective-promotion-diverges-main` (new, this close) |
| The owner's busy refusal on staging rests on the owner's report | Story 6 § Evidence | declined: a refusal records nothing by design, and the refusal is pinned by tests |
| `git switch -c <branch> origin/staging` sets staging as the branch's upstream | This session | declined: `push.default=simple` refuses a push whose branch name differs from its upstream; the upstream was unset at once |

**Does each port to the other flow?** None of these findings depends on who answers the gates, so each applies to
Direction-mode books as well. The cherry-pick row matters more there: Direction mode never promotes, so its books meet
a diverged main at the next human promotion.
