# Build Audit: The config reader stops logging secret values

**Book:** `engineering-team/audits/config-secret-logging/book.md`
**Date:** 2026-10-31
**Branch / commit range:** `69e10489..17e38803` on `staging` (ngit and GitHub): merges `6d3bb659` (story 9) and
`17e38803` (story 10), plus the evidence commit `3f5ae220` and this close on `docs/config-secret-logging-close`
**Provenance:** Acceptance-frame
**Confidence:** high. The frame was confirmed at kickoff, every bullet has evidence, and both stories were reviewed
and checked live on a scratch instance and on the staging droplet.

> The as-built record. It proposes nothing; `prd-seed.md` does that.

## 1. What shipped

- **The config reader logs key names and how each was resolved, never values.** `getConfigFromFile()` used to print
  the value on all four of its paths (quoted, unquoted, the `source` fallback, the default), so every app start wrote
  `NEO4J_PASSWORD` and `SESSION_SECRET` to the startup log. It now logs `Found <KEY> (quoted|unquoted)`,
  `Source command for <KEY>: found|not found` and `Using default value for <KEY>`. —
  `stories/security-auth-exposure/9-config-reader-logs-no-values.md`
- **A config file bash can't parse no longer reaches the log through five readers.** `src/utils/config.js`,
  `lib/config.js`, `addToQueue.mjs`, `publish_nip85_30382.js` and `personalizedGrapeRank/initializeScorecards.js` keep
  bash's stderr out (`stdio: ['ignore', 'pipe', 'ignore']`) and log a failed lookup's key and exit status instead of
  the error message. `addToQueue.mjs`'s own reader stops logging values. —
  `stories/security-auth-exposure/10-config-source-stderr-no-values.md`
- **Two stack-free suites pin both.** `test/config-secret-logging.test.js` (5 tests) and
  `test/config-source-stderr.test.js` (4 tests; a child-process test for `config.js`, source-level checks for the
  other four readers), both registered in `test/registry.js`.

## 2. Epics & stories rolled up

### Epic: `security-auth-exposure`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #9 config-reader-logs-no-values | `getConfigFromFile()` logs names, never values | Done | `reviews/security-auth-exposure/9-config-reader-logs-no-values.md` (PASS) |
| #10 config-source-stderr-no-values | five readers keep bash's stderr and values out of the log | Done | `reviews/security-auth-exposure/10-config-source-stderr-no-values.md` (CHANGES_REQUESTED, then PASS after narrowing) |

## 3. As-built inventory

- **User-facing:** no screen, route or command changed. Operators see different startup-log lines (names, not
  values; `failed (status N)` instead of bash's error text).
- **Domain:** no concept, handle, schema or firmware change.
- **Data & contracts:** no event kind, API route or stored shape changed. Every reader returns the same value as
  before, and every exit path is the same.
- **Code:** `src/utils/config.js` (+10 −4 across both stories), `lib/config.js`, `src/pipeline/stream/addToQueue.mjs`,
  `src/algos/nip85/publish_nip85_30382.js`, `src/algos/personalizedGrapeRank/initializeScorecards.js`; 5 files,
  +37 −17.
- **Diff walk:** all 17 files in `69e10489..17e38803` trace to story 9 or story 10 (code, tests, registry, stories,
  test plans, reviews, book, epic, the intake entry). No undocumented work.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 1 and issue `c549202b`: lines 31 and 40 log values | Four lines fixed, not two: the `source` fallback and the default printed values too | added-beyond-scope | Found while drafting story 9 (story 9 Background); the fallback inherits the environment, and the default printed the public session secret | None beyond the fix | — |
| 2 | Story 10 as drafted: every JavaScript reader that sources the conf | Five readers; 11 GrapeRank scripts (27 calls) with the same pattern left as they are | deferred | Review 10 round 1, blocking finding 1; the owner chose to narrow ("Narrow, file follow-up"); their shell wrappers mostly source the conf too, so a JavaScript-only patch wouldn't close them (story 10 *Out of scope*) | A broken conf line can still reach the GrapeRank scripts' logs | `stories/_intake.md` 2026-10-31 entry |
| 3 | Issue `c549202b` suggested a debug level to cut log volume | Not done; the function still logs on every call | deferred | Story 9 *Out of scope* (behaviour-neutral cleanup, separate) | None | §6 |
| 4 | Frame bullet 4: deployed to staging | Deployed to staging; production, `tags`, `magic-carpet` and the agent-memory instance run `main`, which has neither fix | constraint-discovered | Promotion to `main` is the owner's per-promotion call (`/cycle-prod`) | Those instances still log both values at every restart | §6 |

**Undocumented work:** none.

## 5. Quality state at close

- **Test gate:** the full `npm test` was **not run**. On the Mac Studio it publishes test fixtures to public relays
  (OPEN.md row `2026-09-27-test-fixture-taggings-on-prod-relays`), so there is no `gate:status` line. Substitute
  evidence, each suite through its `run()` export:
  - on the host: `config-secret-logging` 5/0, `config-source-stderr` 4/0, `graperank-shared-csv-race` 13/0,
    `neo4j-sizing-override` 9/0;
  - in a throwaway scratch container (`SCRATCH_IMAGE=agent-memory-tapestry`, `src/` mounted, `test/` and `lib/`
    copied), at story 10's head `a6b73119`: both story suites, and the six suites that load `config.js`
    (`harden-user-data-error-path` 2/0, `my-assistant-page` 31/0, `shell-input-hardening` 6/0,
    `bullboard-admin-access` 9/0, `tagging-edges-state-routes` 62/0, `tagging-edges-wiring` 86/0);
    `neo4j-sizing-override` was 8/1 there only because the image has no `docker-compose.yml`.
  - Both new suites failed on the code before their fix (0/5 at `ff1e4569`, 0/4 at `fa069442`), checked by the
    Reviewer in throwaway worktrees.
- **Live:** the scratch instance's and the staging droplet's startup logs hold neither value (review 9, AC-5); after
  story 10's deploy the droplet runs all five patched readers, with 0 values and 0 failed lookups in its logs.
- **Known open issues:** see §6. The two reviews' non-blocking findings are carried there.
- **ADR debt:** none; no ADR was written (Architecture skipped for both bugs).

## 6. Carry-forward register

- [ ] The 11 GrapeRank scripts and ~120 shell scripts that still pass a broken conf line to their logs, and the
      entrypoint `bash -n` check that would close the class. (§4 #2; `stories/_intake.md` 2026-10-31 entry)
- [ ] Promote both fixes to `main`; until then production and the sandboxes log the values. (§4 #4)
- [ ] Rotate `SESSION_SECRET` and `NEO4J_PASSWORD` wherever old logs may hold them; on `main`-line instances, after
      promotion. (OPEN.md row `2026-10-31-rotate-secrets-after-log-fix`)
- [ ] With stderr ignored, a conf line that parses but runs a command (`B=pw TAILY`) is now silent where it used to
      print half the value. (review 10, non-blocking 2; covered by the intake entry's render check)
- [ ] `getConfigFromFile()` logs on every call (one startup reads `BRAINSTORM_OWNER_PUBKEY` 15 times); a debug level
      would cut it. (§4 #3)
- [ ] Small test and log nits: AC-4's check knows only today's variable names; a failed lookup logs `status null` when
      the child is killed by a signal (`.signal` would fix it); both suites create their temp directory at load
      time but clean it up only in `run()`. (review 10, non-blocking 3–5; review 9, non-blocking 3)

## 7. Process findings (harness)

`bash scripts/harness-stats.sh` at retro time: 304 reviews decided, kick-back rate 0%, 9 open books and 86 closed
before this close, median cycle time same-day. The reviews' own "Harness friction" sections reported nothing new
beyond the `npm test` rule (F5).

| Finding | Source | Terminal state |
|---|---|---|
| F1. The safe-to-merge check was skipped before both staging deploys. In the ngit-first flow the deploy fires at the GitHub push, and neither the operator's step list nor any doc on that path names the check. Read afterwards: nothing was in flight. | this session; staging's `/api/deploy-safety/status` and `/api/scheduled-tasks/list`, read at 21:25Z | OPEN.md row 340 ("Seen again on 2026-10-31") |
| F2. `test/stack-free-npm-test.test.js`'s G2 ran the `tag-detail` suite against :7778, which on this Mac is the private agent-memory instance. GETs only; nothing written. | story 9 Test Design | OPEN.md row `2026-10-31-stack-free-guard-suite-calls-7778` |
| F3. `scripts/scratch-stack.sh`'s default image is stale on this Mac, and it mounts only `src/`, so `lib/` and `test/` had to be copied in by hand. | stories 9 and 10, scratch reruns | OPEN.md row `2026-10-31-scratch-stack-image-and-lib-mount` |
| F4. Story 10's first inventory came from a one-line grep and missed 11 readers that build the path as `${CONFIG_FILES.brainstorm}` or split the call across lines. | review 10 round 1, blocking finding 1 | declined: the review gate caught it as designed, and the story records the narrowing; no harness change would have done better than the review did |
| F5. The full `npm test` gate can't run on the Mac Studio, so reviews and this close have no `gate:status` line and record substitute evidence. | reviews 9 and 10 § Harness friction; this §5 | OPEN.md row `2026-09-27-test-fixture-taggings-on-prod-relays` (the cause; still open) |
| F6. The ngit-first publish flow (push branch, merge as Zeus, push GitHub as a fast-forward) is written down nowhere in the repo; the operator spelled it out. | this session | declined: where tapestry lives and who merges is an open decision on Loom (P-69, P-71), not a harness gap to patch here |

Ports to the other flow: F1 and F3 apply to a Direction-mode book the same way (row 341 already covers the
Director's copy of the staging chain); F2 applies to any Tester on this machine.

## 8. Epic close-out

`security-auth-exposure` stays **Done**. Stories 9 and 10 joined it under this book as stories 3–8 did under theirs,
and its folders stay outside `done/`, as after the 2026-09-11 and 2026-10-10 closes.
