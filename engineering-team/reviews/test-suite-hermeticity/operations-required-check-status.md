# Review: doc lane — OPERATIONS.md §15's "Required-check status", §4's warning about it, and OPEN.md row 14

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-21 local (US Eastern), 2026-11-22 UTC
**Diff:** `git diff origin/staging...edc58fed8`. One commit, `edc58fed8`, on `docs/operations-required-check-status`, over `ff8ec4cce` (this checkout's `origin/staging`, and the merge base). Two files, +3 −3:
- `OPERATIONS.md:227` (§4) loses its last sentence, and `:1174` (§15) gets a new "Required-check status" paragraph;
- `OPEN.md:47`, row 14, gains two dated notes and closes.

Live `staging` has moved on to `fb9e230bb` (PR #195, fetched into `FETCH_HEAD` only). Its four new commits touch neither file, so the moved base can't conflict with this diff.
**Lane:** doc lane (`engineering-team/workflows/0-intake.md` step 3: `:27`, `:31`, `:39`). Implementer, then Reviewer. A non-numbered review, with no story, no test plan and no book. This file is the lane's record. Template: the docs-mode variant of `templates/review-checklist.md` (`:20`).
**Spec:** the owner's request.
- Fix §15's "Required-check status" paragraph, which said `stack-free` is advisory on both branches.
- Drop §4's sentence warning that the §15 note was out of date.
- Update OPEN.md row 14, which tracked it.

**Filed under:** test-suite-hermeticity, the path row 14's Done cell already cites. That placement holds:
- §15 is the CI gate's own section.
- The epic that built the gate, `test-hermeticity-ci`, is Done and retired under `done/`.
- `test-suite-hermeticity` is In Progress, and it is the epic that keeps §15 up to date: its story #3 changed §15's flake list.
- The other candidate, `harness-self-improvement`, holds the earlier ruleset doc-lane review (`main-guard-actions-policy-2026-11-16.md`), but it is Done.

## Quality gates (run by reviewer, not trusted)

- [x] `git diff --check origin/staging...edc58fed8`: no output, exit 0. `git diff --stat`: `OPEN.md` +1 −1, `OPERATIONS.md` +2 −2.
- [x] `bash scripts/harness-lint.sh`, before this file was written: last line `harness-lint: clean (0 violations)`, exit 0. With this file in place: the same last line, exit 0. Its one new line is an INFO line about this file (friction 3).
- [ ] `npm test`: **not run, on purpose.**
  - The Docker container `tapestry` on this Mac is the live agent-memory instance, and suites write to it.
  - The brief rules out Docker and `localhost:7778`.
  - Open rows `2026-09-30-npm-test-step-leaks-fixtures` and `2026-11-05-suite-probe-reaches-private-container` cover the same ground.
  - I ran no suite at all. CI's `Test / stack-free` job runs `npm test` on the pull request.
- [x] **The implementer's scoped gates**, read with `npm run gate:status -- --label <label>`, which reads records and runs nothing:
  - `20261122T004214Z-88197-fac1 [required-check-status-docs] started 2026-11-22T00:42:14.304Z on edc58fed — FAIL, exit 1, 0 passed, 21 failed, 0 skipped, 21/21 suites`. This is a failed invocation, not a result. The driver (`tmp/ste4/gate.js` in the main checkout) resolves each file against `test/`, as the registry's header says, so the `test/`-prefixed paths named no suite and all 21 failed to load.
  - `20261122T004305Z-88708-5605 [required-check-status-gate] started 2026-11-22T00:43:05.457Z on edc58fed — FAIL, exit 1, 2009 passed, 55 failed, 34 skipped, 21/21 suites; failed: router-stream-limit-on-connect, operations`. The tree was clean (`dirty: false` in the record).
  - `20261122T005258Z-50902-7c90 [required-check-status-ops] started 2026-11-22T00:52:58.761Z on edc58fed+dirty — PASS, exit 0, 1504 passed, 0 failed, 20 skipped, 1/1 suites`. This run finished before this review was written.
- [x] **`+dirty` is the `node_modules` link and nothing else.**
  - `git status --short` prints only `?? node_modules`, HEAD is `edc58fed8`, and the record says `dirtyCount: 1`.
  - The link points at `awesome-ramanujan-76c6f8/node_modules`. It was made at 19:52 local, just before the run started at 00:52:58Z.
- [x] **Every endpoint was dead.**
  - The wrapper, `tmp/ste4/safe-run.sh` in the main checkout:
    - points every URL and port at `127.0.0.1:9`;
    - puts failing `curl` and `docker` stubs first on PATH;
    - sets `BRAINSTORM_CONF_PATH` to a dead conf, `TAPESTRY_CONTAINER` to a container that doesn't exist, and unsets `TAPESTRY_CONTAINER_PORT`;
    - guards its `cd`.
  - It rewrites its stubs and conf on each call, and they are dated 19:52 local, the ops run's start.
  - The 21-suite run's record doesn't hold its environment. But `operations` skipped the same 20 tests in both runs, which fits dead endpoints both times.
  - Neither run includes `event-tagging-firmware-seed`, which calls `:7778` directly. Both run `operations` without its sub-suites.
- [x] **Each failure has a cause outside the diff.**
  - **`router-stream-limit-on-connect` P1–P3** fail inside the patch script with `sed: 1: "/var/folders/…": invalid command code f` (log `gate-required-check-2.log:580-591`). That is GNU `sed -i` under macOS's BSD sed. Open row `2026-10-09-router-patch-sed-macos` tracks it: these three tests fail on every macOS gate, on any branch.
  - **`operations`, 52 failures.**
    - 49 name a missing `express` or `micromark` (`Cannot find module` / `Cannot find package`), and one sub-suite failed to load for want of `nostr-tools`.
    - The other two have the same cause. EN2's next lines name `micromark`. ES8 got 0 letters from an `export nostr` that fails on `micromark` for each of its neighbours (ES9, ES10…).
    - The worktree had no `node_modules` at that time.
    - Run alone with the link in place, `operations` passes the same tests. The first run had 1444 + 52 + 20 = 1516, with the unloaded file's 9 tests counted as 1 failure: 1516 − 1 + 9 = 1524 = 1504 + 20.
- [x] **The selection covers the diff.**
  - 22 files under `test/` name `OPERATIONS.md` or `OPEN.md` as a quoted path.
  - 19 suites name one of the two docs themselves, two of them through `operations` sub-suites (`test/operations/lifecycle/backup-job.test.js`, `tapestry-key-paths.test.js`).
  - `rollup-scanners` and `session-start` reach the docs through `test/helpers/rollupFixtures.js`. All of these were run.
  - The 22nd file, `brains-launcher-repo`, names both docs only as top-level paths in its `NOT_RUNTIME` set (`test/brains-launcher-repo.test.js:261-262`). It never reads them, and this diff adds and renames no top-level path.
  - Of the suites that walk the tree for Markdown, `protocols-index` reads only `protocols/`, and `session-start` was run.
  - `harness-stats` was run too, though it doesn't read either doc. It does no harm.
- [ ] Playwright: not applicable (no UI change).
- [ ] _Lint / typecheck / build not configured: skipped._
- [ ] Independent checker (`workflows/5-review.md`, "Optional: an independent check before the commit"): not applied, because this session can't start one. The session that commits this review can run one first.
- **Live reads.**
  - **Eight `gh api` requests, one at a time:**
    - `rules/branches/` for `main`, `staging` and `feat/tags`;
    - rulesets 27080672 and 27080689;
    - the repo, for this login's permissions;
    - `branches/staging` and `branches/main`, for classic protection.
  - **Two `git ls-remote --heads` listings:** origin, and the old mirror `nous-clawds4/tapestry`.
  - **One fetch of `staging` into `FETCH_HEAD`.** `origin/staging` is untouched.

## Claims adherence (doc-lane variant)

### OPERATIONS.md

| # | Where | Claim | Source checked | Holds? |
|---|---|---|---|---|
| 1 | §4 `:227` | Drops "The 'Required-check status' note further down this file predates `stack-free` becoming required on `main`." | The sentence is out of date once §15 is fixed (claims 3–10). What stays in the paragraph still holds: `staging` has no PR rule and no required check (claim 9), and `/cycle-staging` merges on the deploy-safety check (row 256, `OPEN.md:289`) | Yes |
| 2 | §15 `:1174` | The heading drops "— an operator decision, not taken here" | For `main` the decision has been taken: ruleset 27080672 requires `stack-free` (claim 5) | Yes |
| 3 | Same | "The check is **required** on `main` and **advisory** on `staging`" | Live: `rules/branches/main` lists `required_status_checks` with `stack-free` and `main-source-guard`, from ruleset 27080672. `rules/branches/staging` lists only `deletion` and `non_fast_forward`, from 27080689. Classic branch protection is off on both (`branches/main`, `branches/staging`: `protection.enabled: false`, `required_status_checks.enforcement_level: off`) | Yes |
| 4 | Same | "([§4](#4-branch-protection-rulesets))" | The anchor is §4's heading (`:205`), and the contents line (`:15`) and three other links (`:1270`, `:1291`, `:1316`) use it | Yes |
| 5 | Same | "the ruleset `main-requires-pr-before-merging` requires `stack-free` and `main-source-guard`" | Live ruleset 27080672: that name, `enforcement: active`, `~DEFAULT_BRANCH` (the repo's default branch is `main`), both contexts with `integration_id` 15368. The kept file says the same (`.github/rulesets/main-requires-pr-before-merging.json:29-32`), and so does §4 (`:214-217`). Both contexts exist: `test.yml`'s job is `stack-free` (`:25`, with no `name:`), and the guard's job is named `main-source-guard` (`guard-main-source.yml:33`) | Yes |
| 6 | Same | "so a pull request into `main` stays `BLOCKED` until both pass" | Under the same ruleset on the old repo: row 155 (`OPEN.md:188`, throwaway PR #521: guard fail, `mergeStateStatus=BLOCKED`) and row 256 (`:289`, PR #630: `BLOCKED` while the checks ran, merged once they passed). On this repo, the guard's startup failure held promotion #96 for about two hours, until the guard passed (`ledger/2026-11-16-main-guard-blocked-by-github-policy.md:16`). §4 says the same (`:217`). "Until both pass" is a necessary condition. The PR rule asks for 0 approvals | Yes |
| 7 | Same | "A `stack-free` run that fails, or that the timeout cancels, blocks the merge" | `test.yml:27` sets `timeout-minutes: 40`. Runs that hit the old limit were "cancelled", and "GitHub shows the check as failing although no test failed" (`ledger/2026-11-20-ci-gate-outgrows-its-timeout.md:15-18`). Promotion #167's required run was cancelled the same way (`:25`) | Yes |
| 8 | Same | "and the no-retry policy above still holds" | §15's policy (`:1158`). `test.yml:6`, and its steps (`:41-42`) have no retry. The timeout row says "The no-retry rule in §15 still holds: a cancelled run is not run again by hand" (`:20`) | Yes |
| 9 | Same | "`staging` has no required checks and takes direct pushes" | Claim 3's reads: no `pull_request` rule, no `required_status_checks`, and classic protection off. `non_fast_forward` blocks force pushes only | Yes |
| 10 | Same | "Making the check required there is a separate operator decision, and it would also mean closing the direct-push path" | Carried over from the old text. §4 (`:227`) and `.github/rulesets/README.md:16-17` say the same. `test.yml` runs only on `pull_request` (`:11-13`), so a commit pushed straight to `staging` gets no `stack-free` result, and a required check would refuse it | Yes |
| 11 | Same | "`gh api repos/TapestryProtocol/tapestry/rules/branches/<branch>` lists a branch's rules, and needs no admin rights" | I ran it for `main`, `staging` and `feat/tags` as a login with `push: true` and `admin: false` (`gh api repos/TapestryProtocol/tapestry --jq .permissions`). Each call listed its rules. It lists ruleset rules only (N2) | Yes |

### OPEN.md row 14 (`:47`)

| # | Claim | Source checked | Holds? |
|---|---|---|---|
| 12 | "**DONE, checked 2026-11-21:** the live ruleset `restrict-deletions` (27080689 on `TapestryProtocol/tapestry`) targets `main`, `staging`, `feature-magic-carpet` and `feat/tags`" | Live ruleset 27080689: that name, `active`, and an `include` of exactly those four refs. The kept file (`.github/rulesets/restrict-deletions.json:7-12`) and §4 (`:209`) match | Yes |
| 13 | "so `gh api repos/TapestryProtocol/tapestry/rules/branches/feat/tags` lists its deletion and non-fast-forward rules" | I ran it: `deletion` and `non_fast_forward`, both from 27080689 | Yes |
| 14 | "**FIXED 2026-11-21:** §4 has described both rulesets since `c8b24d871` (2026-11-11)" | `git show c8b24d871`: 2026-11-11T18:56:54-05:00 (23:56Z, the same UTC day). It rewrote §4 to describe both rulesets. It is on `staging` (`git merge-base --is-ancestor`, exit 0) | Yes |
| 15 | "§15's 'Required-check status' now says the check is required on `main` and advisory on `staging`" | This diff; claim 3 | Yes |
| 16 | "the live ruleset `main-requires-pr-before-merging` (27080672 …) requires `stack-free` and `main-source-guard`, and `staging` has only deletion and non-fast-forward rules" | Claims 3 and 5 | Yes |
| 17 | Status `DONE` | It reads exactly `DONE`, as the meta reader requires (row 331, `OPEN.md:363`), and the row keeps its seven cells. `OPEN.md:23` says how a numbered row closes | The form, yes. Whether it may close, no (claim 18) |
| 18 | Done cell: "the last two open parts are closed, so every part of the row is fixed" | The next table | **No** (B1) |
| 19 | The Done cell cites `engineering-team/reviews/test-suite-hermeticity/operations-required-check-status.md` | This file's path | Yes |

### Row 14's other parts, against today's tree and origin

The Done cell says every part of the row is fixed, so each part was checked again.

| Part | Today | Holds? |
|---|---|---|
| §1's "six" against §2/§3's "four" (FIXED 2026-09-12) | §1 `:35` "Four long-lived branches", §2 `:66` "the four deploy-target branches", §3 `:89` "All four" | Yes |
| §4's list of branches the ruleset covers | §4 `:209` names the four branches the live ruleset covers (claim 12) | Yes |
| `feat/pubkey-tagging-target` in §1/§7 | Named only as history (`:42`, `:77`, `:254`). Not in §7, and not on origin (`git ls-remote --heads origin`) | Yes |
| `deploy-tags.yml` repointed (FIXED 2026-07-16) | `.github/workflows/deploy-tags.yml:5`: `branches: [feat/tags]` | Yes |
| `SECURITY.md` and `siteTrust.js` estate lists trimmed, and `deploy-communities.yml` deleted (2026-09-12) | Neither file names communities or curate as a live host. `.github/workflows/` has no `deploy-communities.yml` | Yes |
| §9.9's prose. Row 14 says "§1/§7/§9.9 prose reconciliation is **FIXED 2026-09-12**" | `:540` still reads "all four existing deploy droplets (`brainstorm.world`, …)". `brainstorm.world` has been NosFabrica's since 2026-07-10 (`:39`). A review on 2026-09-13 found this claim overstated (`engineering-team/reviews/harness-self-improvement/ledger-closeout-2026-09-13.md:104-113`). Row 24(c), which is OPEN, says the same and leaves the fix to row 14 (`OPEN.md:57`) | **No** (B1) |
| "§7's person↔branch table is stale" | §7 `:409` gives Vinney `feature-relay-discovery` and `feature-tapestry-discovery` (PR #32) as active branches. Neither is on origin | **No** (B1) |
| "Reconcile with `scripts/long-lived-branches.txt`" | The keep-list and §2 agree with each other. But five of the keep-list's branches are not on origin: `feat/communities`, `feat/curate`, `feature-relay-discovery`, `feature-tapestry-discovery` and `fix/launch-child-task-protection-audit` (`:12-13`, `:15-17`). All five are on the old mirror, `nous-clawds4/tapestry` (`git ls-remote --heads`). `/whats-open` prints "MISSING on origin" for each (`scripts/whats-open.sh:313-316`) | The two docs agree. Against origin, **no** (B1) |

## ADR adherence

Not applicable as such: the lane has no ADR. Two records still say the required-check decision is "not yet taken": ADR `test-hermeticity-ci/0001` (`engineering-team/decisions/done/test-hermeticity-ci/0001-ci-test-job.md:64`) and the closed book's acceptance frame (`engineering-team/audits/test-hermeticity-ci/book.md:19`). Both are dated records of their time and need no change. The diff adds no dependency, no code and no layering.

## Concept-graph integrity

- [x] No concept definition or handle is touched, so no firmware reinstall is needed.
- [x] No new code, so nothing has to orient via `/summaries`.

## Things tests can't catch

- [x] No secrets: ruleset ids, contexts and branch names are public API data. No debug output and no commented-out content.
- [x] Scope: the owner's three asks, and nothing else.
- [x] Invariant 4 (BIBLE §30): not touched.

## House rules check

- [x] No new lint, typecheck or build tooling.
- [x] No TA pubkey literal is added.
- [x] Concept Graph API authority: not touched.

## Product-guide adherence

Not applicable: no PRD-traced copy.

## Findings

### Blocking

1. **`OPEN.md:47`, row 14: the Done cell says "the last two open parts are closed, so every part of the row is fixed", and two checks show it isn't.**
   - **§9.9 is not fixed.**
     - `OPERATIONS.md:540` still lists `brainstorm.world` among "all four existing deploy droplets". Production moved to `tapestry.brainstorm.world` on 2026-07-10, and `brainstorm.world` now runs the NosFabrica codebase (`:39`).
     - Row 14's own "§1/§7/§9.9 prose reconciliation is **FIXED 2026-09-12**" was found overstated on 2026-09-13. That review says row 14 "needs a one-line correction" (`engineering-team/reviews/harness-self-improvement/ledger-closeout-2026-09-13.md:104-113`), and the correction was never made.
     - Row 24, which is OPEN, records the same and leaves the fix to this row. Its item (c) "folds into the §1/§9 drift reconciliation in **#14** (not repointed piecemeal)" (`OPEN.md:57`).
     - So closing row 14 leaves row 24(c) waiting on a closed row.
   - **The branch lists don't match origin.**
     - §2 (`OPERATIONS.md:70-71`, `:82-83`), §7 (`:409`) and the keep-list (`scripts/long-lived-branches.txt:12-13`, `:15-17`) name five branches that are not on `TapestryProtocol/tapestry`. All five are on the old mirror, `nous-clawds4/tapestry`.
     - `/whats-open` warns about each one (`scripts/whats-open.sh:313-316`).
     - Row 14's parts include "§7's person↔branch table is stale" and "Reconcile with `scripts/long-lived-branches.txt`".
     - This drift came with the repo moves, not from a slip in the 2026-09-12 pass. No row tracks it: the repo-move row says what moved (`ledger/2026-10-28-repo-move-follow-ups.md:49`, "all four deploy branches") and says nothing of these five.
   - **The commit message repeats the claim:** "Its last two open parts were this paragraph and the live restrict-deletions ruleset covering feat/tags."
   - **Asked change:** don't close row 14 as all fixed. Either of these will do:
     - **(a) Keep it OPEN.** Status exactly `OPEN` and the Done cell empty (row 331). Keep both new dated notes, which hold (claims 12–16). Add one dated line naming what is left: §9.9's droplet list (`OPERATIONS.md:540`, row 24(c)), and the five branches that §2, §7 and the keep-list name but that exist only on the old mirror.
     - **(b) Close it once both are recorded elsewhere, and say where in the Done cell.**
       - The branch drift can go into the repo-move row, or into a new ledger row. A new row's id would carry `2026-11-22`, the UTC day (`OPEN.md:20`).
       - The §9.9 fix needs a dated note on row 24(c), saying it now carries that fix itself. Or it can be fixed in this change: `brainstorm.world` → `tapestry.brainstorm.world` at `:540`. That widens the lane, so it is the owner's call.
     - Whichever you choose, make the commit message match.

### Non-blocking

1. **`test/ci-test-job.test.js:214`, `:219-220`: D3 no longer pins what its name says.** Its name says making the check required is an "un-taken operator decision", and its message says that decision was "NOT taken by this story". Its regex still passes on the new paragraph, which holds "required", "ruleset" and "operator". If D3 ever fails, its message will point the editor back to the old wording. **Suggested:** in a later test change, outside this lane, rename D3 and make it pin "required on `main`, advisory on `staging`".
2. **`OPERATIONS.md:1174`, the last sentence: the endpoint lists only the ruleset rules that apply to a branch, not classic branch protection.** Today classic protection is off on both branches (claim 3), so the endpoint shows everything enforced. **Optional:** "lists the ruleset rules that apply to a branch".
3. **`engineering-team/audits/sandbox-security/audit.md:68` still lists "Operator: add `feat/tags` to the live `restrict-deletions` ruleset (… OPEN.md row 14)" as open in its carry-forward register.** That is done (claim 12). **Optional:** tick it, with a dated note.
4. **`ledger/2026-10-28-repo-move-follow-ups.md:19-20`, `:55-56`: item 1 still says "OPERATIONS §4, §9.2 and §15 still describe the old repo's protections".** It asks whoever closes it to re-check row 14. After this change, §4 and §15 describe the live rulesets, and §9.2 only points at §4 (`OPERATIONS.md:460`). **Optional:** a dated line there. That row is also the natural place for B1's branch drift.
5. **Dates.** Row 14's "checked 2026-11-21", "FIXED 2026-11-21" and Done date give the US Eastern day. The commit (00:41:37Z) and the gate runs (00:42–00:58Z) fall on 2026-11-22 UTC. OPEN.md's UTC rule covers ledger ids only (`:20`), so no rule is broken, and no change is asked.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **Closing a numbered row has no step that finds the rows citing it.**
   - `OPEN.md:22` sets the citation form ("OPEN.md row 230") and how to look a number up, and `:23` says how to close a row. Neither asks the closer to look for rows that depend on the one being closed.
   - Row 24 cites row 14 as "**#14**", twice (`OPEN.md:57`). That form also matches PR and issue numbers, and a search for "row 14" misses it. Mine did at first, and that is how this closure missed row 24(c).
   - **Suggested meta row** (id dated `2026-11-22`): `OPEN.md:23` gains "before closing, find the rows that cite it (`git grep -n -E 'row N\b|#N\b'`) and settle what they leave to it".
2. The step "run `npm test`" can't be followed on this Mac. The open rows `2026-09-30-npm-test-step-leaks-fixtures` and `2026-11-05-suite-probe-reaches-private-container` already cover this. No new row.
3. `harness-lint`'s INFO line says this review "predates the numbering convention". It is a doc-lane review, and 0-intake step 3 (`:31`) gives doc-lane reviews exactly this non-numbered form. The open row `2026-11-16-lint-mislabels-doc-lane-reviews` already covers this. No new row.

## Not checked

- The 21-suite run's environment, which its record doesn't hold. It rests on the wrapper I read, the implementer's word, and the matching skip counts (Gates).
- GitHub's merge state on a live pull request. Claim 6 rests on recorded runs: rows 155 and 256 on the old repo, with the same ruleset, and promotions #96 and #167 on this one.
- A read-only login. "Needs no admin rights" was shown with a login that has push but not admin.
- Whether the five branches on the old mirror are meant to move to the new origin. That is the owner's call, which is why B1 asks for them to be recorded, not fixed.

## Close-out

- [x] No story to mark Done, because the doc lane has none (0-intake step 3).
- [x] Completion detection: none needed, because a doc-lane change opens no book (0-intake `:39`).
- [ ] Commit: left to the session that launched this review, which asked the Reviewer not to commit. The role's rule is to commit the review whatever the verdict. A suggested message: `review: operations-required-check-status — CHANGES_REQUESTED (test-suite-hermeticity, doc lane)`.

## Verdict

The OPERATIONS.md changes hold. Each claim in §15's new paragraph matches the live rulesets, the kept definitions, `test.yml` and the ledger's records (claims 1–11), and dropping §4's sentence is right now that §15 is fixed. Row 14's two new notes hold too (claims 12–16).

One blocking item, B1. Row 14 closes as "every part of the row is fixed", but two of its parts aren't:
- §9.9's droplet list still names `brainstorm.world`, and open row 24(c) leaves that fix to row 14;
- §2, §7 and the keep-list name five branches that exist only on the old mirror.

**CHANGES_REQUESTED**

## Round 2 — 2026-11-21 local, 2026-11-22 UTC (over `f1c4b4e6b`, round 1's committed review)

The owner chose "Fix findings first". Round 1 is committed as `f1c4b4e6b`, and no later commit touches this file. The fix round is three commits, six files, +26 −6:
- `a05bfec59` (test, N1): D3 reads §15's **Required-check status** paragraph alone.
- `31d8affb2` (docs): B1 by option (a), and N2–N5.
- `dd8a4ea5f` (ledger, friction 1): a new meta row, `ledger/2026-11-22-row-close-misses-citing-rows.md`.

I checked each changed claim afresh against round 1's sources, my own round-1 wording included (role rule 10), and not against the coordinator's summary.

### Gates (run by the reviewer)

- [x] `git diff --check f1c4b4e6b..HEAD` and `git diff --check origin/staging...HEAD`: no output, exit 0.
- [x] `bash scripts/harness-lint.sh` on `dd8a4ea5f`, before this section was written: last line `harness-lint: clean (0 violations)`, exit 0. Its one line about this file is the INFO line (round-1 friction 3). With this section in place: the same.
- [ ] `npm test`: not run, for round 1's reasons. The Reviewer ran no suite.
- [x] **The fix round's gate records**, read with `npm run gate:status`:
  - `20261122T011817Z-95446-8152 [d3-pins-required-on-main] started 2026-11-22T01:18:17.090Z on f1c4b4e6+dirty — PASS, exit 0, 14 passed, 0 failed, 0 skipped, 1/1 suites`. This ran before `a05bfec59` was committed. The two dirty paths are the test edit and the `node_modules` link.
  - `20261122T011824Z-95532-8e60 [d3-guard-old-wording] started 2026-11-22T01:18:24.879Z on a05bfec5+dirty — FAIL, exit 1, 13 passed, 1 failed, 0 skipped, 1/1 suites; failed: ci-test-job`. The two dirty paths are OPERATIONS.md, swapped for `edc58fed8^`'s, and the link. The record doesn't name the failed test. It is D3: the replica below fails on that text, and D1, D2, D4 and the W tests read nothing that differs between the two versions.
  - `20261122T011828Z-95620-1472 [d3-guard-restored] started 2026-11-22T01:18:28.195Z on a05bfec5+dirty — PASS, exit 0, 14 passed, 0 failed, 0 skipped, 1/1 suites`. The one dirty path is the link.
  - `20261122T012015Z-6748-78f6 [required-check-status-round2] started 2026-11-22T01:20:15.447Z on dd8a4ea5+dirty — FAIL, exit 1, 2069 passed, 3 failed, 34 skipped, 21/21 suites; failed: router-stream-limit-on-connect`. The one dirty path is the link (`dirtyCount: 1`).
- [x] **The round-2 gate's one failure has round 1's cause.**
  - `router-stream-limit-on-connect` fails P1–P3 and nothing else, each on `invalid command code f` (log `gate-required-check-round2.log:580-591`). That is open row `2026-10-09-router-patch-sed-macos`.
  - `ci-test-job` passes all 14 (`:17`), and `operations` passes with 1504 passed, 0 failed, 20 skipped (`:2657`).
  - The totals reconcile with round 1: 2069 + 3 + 34 = 2106, which is round 1's 2098 plus 8. Round 1 counted `operations`' unloaded file's 9 tests as 1 failure.
- [x] **Endpoints.** The record holds no environment. The wrapper's stubs and conf were last rewritten at 01:22:19Z, two minutes after this run started, so their dates can't place it. Its skip counts match round 1's dead-endpoint runs: 34 in all, 20 in `operations`.
- [x] **The selection still covers the diff.**
  - `ci-test-job` is the changed suite, and it ran.
  - OPEN.md and OPERATIONS.md have the same readers as in round 1.
  - No suite names the changed audit or either changed ledger row. `session-start` is the only suite that reads the real `ledger/` folder (`test/session-start.test.js:468`), and it ran. The other folder uses build fixtures (`test/ledger-row-ids.test.js:78`, `test/helpers/rollupFixtures.js:109`).
  - Lint's L15 checks the real rows.
- [x] **D3, replicated without running the suite.** I copied `ciSection()` and D3's three checks from `a05bfec59` into a scratch script, and ran it on four texts:
  - HEAD's OPERATIONS.md: PASS. All three checks hold in "## 15. CI test gate (PRs to staging/main)".
  - `edc58fed8^`'s: FAIL. "required on main" and "advisory on staging" are both missing.
  - HEAD's, with "**advisory** on `staging`" changed to "on both branches": FAIL.
  - HEAD's, with "operator decision" changed to "decision": FAIL.
- [x] **Live state.**
  - Two more `gh api` requests, one at a time, making ten in all: `rules/branches/feat/tags` and `rules/branches/staging`. Each still lists `deletion` and `non_fast_forward`, from ruleset 27080689.
  - `git ls-remote --heads` of both repos again: none of the five branches is on origin, and all five are on `nous-clawds4/tapestry`. This clone has no local branch by those names, and `origin` is its only remote.
- [x] **The moved base.** Live `staging` is now `deef26702`. Its PR #196 changes one line of OPEN.md (row 298), far from row 14. `git merge-tree --write-tree FETCH_HEAD HEAD` reports a clean merge, exit 0. `staging` was fetched into `FETCH_HEAD` only, so `origin/staging` is untouched.
- [x] **The closing session's transcript**, read-only, on this Mac, as the model review's round 3 read the owner's message. I listed its tool calls before `edc58fed8` (00:41:37Z) that search or read OPEN.md or `ledger/`, and every call that names row 14 in any form. None is a search for rows citing row 14 (R2-B2). Nothing else from it is copied here.

### Round-1 findings, re-checked

- **B1 (row 14 closed too early): fixed,** by option (a) (claims 22–25).
- **N1 (D3): fixed, in this lane** (claims 20–21). Round 1 had suggested a later test change, outside this lane. The owner's "Fix findings first" brought it in. It changes one test's assertion, pins only this diff's paragraph, and holds both ways (Gates). That is within the strictness table's doc-lane row, "Doc / one-liner" (0-intake `:27`).
- **N2 (the endpoint sentence): fixed,** in round 1's suggested wording, which I checked afresh (claim 26).
- **N3 (the audit tick): done** (claim 27).
- **N4 (the repo-move row): done** (claim 28).
- **N5 (dates):** round 1 asked for no change. The notes now carry 2026-11-22, and each date holds in UTC (claims 23, 29).
- **Friction 1 (no step finds citing rows): recorded** as the new meta row. Two of its claims don't hold, and both came from round 1's friction text (R2-B1, R2-B2, Corrections).
- **Friction 2 and 3:** existing rows; nothing changed.

### Changed claims

| # | Where | Claim | Source checked | Holds? |
|---|---|---|---|---|
| 20 | `test/ci-test-job.test.js:214-225` (D3) | Reads §15's **Required-check status** paragraph alone (`:219`, `:222`), and needs "required on main", "advisory on staging" and "operator decision" (`:223`) | The diff, the replica and the three guard records (Gates) | Yes |
| 21 | Same, `:224` (the message) | "`main`'s ruleset requires `stack-free`, and `staging` has no required checks (OPERATIONS.md §4)" | Round 1's claims 3 and 5, and round 2's read of `rules/branches/staging` | Yes |
| 22 | `OPEN.md:47`, row 14 | Status `OPEN`, the Done cell empty, and "every part of the row is fixed" gone | Seven cells. Status reads exactly `OPEN` (row 331), and the Done cell is empty | Yes |
| 23 | Same | "**DONE, checked 2026-11-22:**" and "**FIXED 2026-11-22:**", re-dated from 2026-11-21 | This review's live reads ran 00:54:07Z–00:55:28Z on 2026-11-22 (its own transcript), and round 2 re-read `feat/tags` and `staging`. `edc58fed8` was committed at 00:41:37Z on 2026-11-22 | Yes |
| 24 | Same, "Still open, 2026-11-22", part (1) | §9.9's checklist "still names `brainstorm.world` among 'all four existing deploy droplets'", though production has been `tapestry.brainstorm.world` since 2026-07-10. The 2026-09-12 note overstates the §9.9 part, and row 24(c) leaves the fix to this row | `OPERATIONS.md:540` (the quoted words), `:39`. The 2026-09-13 review (`engineering-team/reviews/harness-self-improvement/ledger-closeout-2026-09-13.md:104-113`). `OPEN.md:57` | Yes |
| 25 | Same, part (2) | The five branches "did not move to `TapestryProtocol/tapestry`" and "are only on the old mirror". "§2 lists four of them, and §7 gives Vinney two." Whether they move is the owner's call | `git ls-remote --heads` of both repos, again in round 2, and no local branch by those names. `OPERATIONS.md:70-71` and `:82-83` (four), `:409` (two). The keep-list's fifth, `fix/launch-child-task-protection-audit`, is not in §2 | Yes |
| 26 | `OPERATIONS.md:1174` (N2) | The endpoint "lists the ruleset rules that apply to a branch, and needs no admin rights" | Every `rules/branches` read returned rules tagged with a `ruleset_id`, and nothing from classic protection, which is off on both branches (round 1). The login has `admin: false` | Yes |
| 27 | `engineering-team/audits/sandbox-security/audit.md:68` (N3) | Ticked, with "*(Done, checked 2026-11-22: the live `restrict-deletions` ruleset, 27080689 on `TapestryProtocol/tapestry`, targets `feat/tags`.)*" | Round 2's read of `rules/branches/feat/tags`, and round 1's of ruleset 27080689. The register's last item (`:70`) already carries a dated note added after the close, so annotating the register has precedent | Yes |
| 28 | `ledger/2026-10-28-repo-move-follow-ups.md:57` (N4) | "§4 (rewritten in `c8b24d871`) and §15 now describe the live rulesets, and §9.2 only points at §4". Row 14 "stays open for two parts" | Round 1's claims 3–11 and 14. `OPERATIONS.md:460`: §9.2 names `restrict-deletions` and points at §4. Claims 24 and 25 | Yes |
| 29 | The new dates (N5) | 2026-11-22 throughout | The UTC times in claim 23, and `31d8affb2`'s commit time, 01:19:43Z | Yes |
| 30 | `31d8affb2`'s message | It "corrects `edc58fed8`'s message, which said row 14 closes" | A correcting commit, not an amend. So `edc58fed8`, which this review cites by hash, keeps its id | Yes |
| 31 | New meta row `:1-7` | Title, id, type, opened date, status and done | `templates/open-row.md`. The id has five slug words and 39 characters. The file was created at 01:19:38Z on 2026-11-22 (`stat`), the UTC day its id carries. L15 is clean | Yes |
| 32 | Same, `:9` | "The closing session searched for "row 14" and missed it, because row 24 cites the row as "#14"" | The closing session's transcript. Before `edc58fed8`, it searched the ledger for "Required-check status", which found row 14 itself (00:01:33Z, 00:01:42Z). It read row 14 (00:01:52Z, and `OPEN.md:47` at 00:38:58Z), and searched OPERATIONS.md for the row's own drift strings (00:39:29Z). It made no search for rows citing row 14. The search that missed row 24 was this review's own | **No** (R2-B2) |
| 33 | Same, `:9`, `:11` | Row 24(c)'s quote. The ledger rules have no step for finding citing rows. Older rows cite each other as "#N", a form pull requests and issues share | `OPEN.md:57` (the words, bold marks included). `OPEN.md:18-28`. Rows 11, 12 and 13 cite rows as "#4", "#11" and "#23", and cite pull requests the same way | Yes |
| 34 | Same, `:13` | Find the rows that cite it with "`git grep -n -E 'row N\b\|#N\b' -- OPEN.md ledger/`" | For N = 14, on this Mac's git 2.53.0, the command prints nothing and exits 1, though row 24 holds "#14" twice | **No** (R2-B1) |
| 35 | Same, `:13` | "A lint check could only warn, since "#N" also matches pull requests and issues" | The working search below also finds a story's "#14", in `ledger/2026-11-17-walk-skips-unlabelled-keyed-nodes.md:5` | Yes |

### Findings

#### Blocking

1. **R2-B1. `ledger/2026-11-22-row-close-misses-citing-rows.md:13`: the fix shape's search finds nothing on this Mac.**
   - `git grep -n -E 'row 14\b|#14\b' -- OPEN.md ledger/` prints nothing and exits 1 under git 2.53.0, though `OPEN.md:57` holds "**#14**" twice. `\b` is not a word boundary in this git's `-E` syntax. Without `\b`, the same search matches 19 lines in 9 files.
   - So the step this row proposes would miss citing rows without a word, on the machine these sessions run on. That is the failure the row exists to stop.
   - The command is round 1's, from friction 1, and the row took it as it was (Corrections).
   - **Asked change:** `git grep -n -w -E 'row N|#N' -- OPEN.md ledger/`. Git does `-w` itself, whatever regex library it was built with. For N = 14, it finds:
     - row 24 (`OPEN.md:57`), the row that waits on row 14;
     - row 223 (`OPEN.md:256`), a DONE row that names row 14 as an example;
     - the repo-move row's two lines (`ledger/2026-10-28-repo-move-follow-ups.md:20`, `:56`), which ask whoever closes that row to re-check row 14;
     - one false match, a story's "#14" (`ledger/2026-11-17-walk-skips-unlabelled-keyed-nodes.md:5`), as the row's last sentence predicts;
     - the meta row itself.
   - `-P 'row N\b|#N\b'` works here too, but only in a git built with PCRE.
2. **R2-B2. `ledger/2026-11-22-row-close-misses-citing-rows.md:9`: "The closing session searched for "row 14" and missed it" is not what happened.**
   - The closing session's transcript has no search for rows citing row 14 before `edc58fed8` (claim 32). It found row 14 by searching the ledger for the paragraph's name, read the row, and checked OPERATIONS.md for the row's own drift strings.
   - The "row 14" search that missed row 24 was this review's, in round 1.
   - Round 1's friction 1 said "that is how this closure missed row 24(c)". That was my inference, not a finding, and the row states it as an event (Corrections).
   - The row's point stands, and so does its fix shape. No step asks for the search, and a search for "row N" misses "#N".
   - **Asked change:** say what happened. The closing session didn't look for rows citing row 14, since no step asks for that. The review's first search, for "row 14", then missed row 24, which cites it as "#14".
   - Optional, in the same paragraph: "One of them was row 24's" could read "One of them, §9.9's droplet list, is the fix row 24(c) leaves to row 14."

#### Non-blocking

None new.

### Corrections to round 1 (the Reviewer's own)

1. Friction 1's suggested command, `git grep -n -E 'row N\b|#N\b'`, finds nothing on this Mac (R2-B1). I suggested it without running it.
2. Friction 1 said that a search for "row 14" missing row 24 "is how this closure missed row 24(c)". I hadn't checked how the closing session worked. Its transcript shows it never searched for citing rows (R2-B2).
3. The Gates said the driver "resolves each file against `test/`". The engine does that, at `test/helpers/gateRunner.js:208`. The driver only passes the names on. The account of the failed invocation is otherwise unchanged.

### Not checked

- The round-2 gate's environment, which its record doesn't hold (Gates).
- `-w` with the git on CI's Linux runners. I tested it only on this Mac, and Linux's regex library treats `\b` differently.
- Which test failed in `20261122T011824Z-95532-8e60`. The record doesn't say; it is D3 by elimination and by the replica.

### Close-out

- [x] No story to mark Done, and no book (0-intake step 3, `:39`).
- [ ] Commit: left to the session that started this review, which asked the Reviewer not to commit. A suggested message: `review: operations-required-check-status — CHANGES_REQUESTED, round 2 (test-suite-hermeticity, doc lane)`.

### Verdict

Round 1's blocking item is fixed. Row 14 is open again, and its new line names both parts that are left, each of which holds against origin, the old mirror and the tree. N1–N5 are done, and each holds: D3 now fails on the old wording and passes on the new; the endpoint sentence, the audit tick, the repo-move line and the new dates all check out.

Two blocking items remain, both in the new meta row, and both from round 1's own friction text:
- its search command finds nothing on this Mac (R2-B1);
- it says the closing session searched for "row 14", and the transcript shows no such search (R2-B2).

Each is a one-sentence fix.

**CHANGES_REQUESTED**

## Round 2, fix check — 2026-11-21 local, 2026-11-22 UTC (one commit, `f89ff663a`, over `e113b37b2`)

Round 2 is committed as `e113b37b2`, which adds this file's 128 lines and nothing else; no later commit touches this file. The fix is one commit, `f89ff663a`, which changes `ledger/2026-11-22-row-close-misses-citing-rows.md` alone, at `:9` and `:13` (+2 −2). As asked, I checked only that commit, each claim afresh.

### Gates (run by the reviewer)

- [x] `git diff --check HEAD~1..HEAD` and `git diff --check origin/staging...HEAD`: no output, exit 0.
- [x] `bash scripts/harness-lint.sh` on `f89ff663a`, before this section was written: last line `harness-lint: clean (0 violations)`, exit 0. With this section in place: the same.
- [x] **The fix's gate**, read with `npm run gate:status -- --label required-check-status-round2-fix`: `20261122T014305Z-37855-4ed5 [required-check-status-round2-fix] started 2026-11-22T01:43:05.208Z on f89ff663+dirty — PASS, exit 0, 38 passed, 0 failed, 0 skipped, 2/2 suites`. `session-start` passed 32 and `ledger-row-ids` 6, as in rounds 1 and 2. The one dirty path is the `node_modules` link.
- [x] **The selection covers the commit.** It changes the body of one `ledger/` row, and leaves the header fields that L15 and the readers take untouched.
  - `session-start` is the suite that reads the real `ledger/` folder (`test/session-start.test.js:468`).
  - `ledger-row-ids` reads the real OPEN.md table (`:130`, `:147`), but it builds its `ledger/` rows in temp folders (`:52-79`). It adds nothing for this commit, and does no harm.
- [ ] `npm test`: not run, for round 1's reasons. No `gh api` request was needed.

### Claims

| # | Where | Claim | Source checked | Holds? |
|---|---|---|---|---|
| 36 | `:9` | "One of them, §9.9's droplet list, is the fix that row 24(c) leaves to row 14" | Round 2's optional wording, plus "that". `OPEN.md:57`: row 24's item (c) is §9.9's droplet list, and it "folds into … **#14**" | Yes |
| 37 | `:9` | Row 24 is open, and its item (c) "folds into the §1/§9 drift reconciliation in **#14**" | `OPEN.md:57`: Status `OPEN`, and the quoted words with their bold marks | Yes |
| 38 | `:9` | "The closing session never looked for rows that cite row 14, since no step asks for that" | The transcript shows no such search before the close (round 2, claim 32). `OPEN.md:18-28` has no step that asks for one. The same session did run that search once afterwards, at 01:42:13Z, while testing this fix | Yes, for the close (R2F-N1) |
| 39 | `:9` | "The review's own first search, for "row 14", then missed row 24, because row 24 cites the row as "#14"" | Round 1's search was `git grep -n -E 'row 14\b\|rows? 14[ ,)]'`. It had no "#14" alternative, and its output didn't include `OPEN.md:57` | Yes |
| 40 | `:13` | Find the rows that cite it with `git grep -n -w -E 'row N\|#N' -- OPEN.md ledger/` | Run on HEAD. N = 14: finds row 24 (`OPEN.md:57`), exit 0. N = 24: finds row 14's "row 24(c)" (`OPEN.md:47`). N = 9: 7 lines in OPEN.md, against 11 without `-w`. The four lines it drops hold "#93", "row 93", "#96", "row 98" and a cross-repo issue, "Open-Ranking/protocol#9" | Yes |
| 41 | `:13` | "In an extended pattern, this Mac's git (2.53.0) doesn't read `\b` as a word boundary, so `'row 14\b\|#14\b'` finds nothing, while the `-w` search finds row 24" | `git --version` gives 2.53.0. Run again on HEAD, the `\b` form prints nothing and exits 1 | Yes |
| 42 | `:13` | "It also finds a story's "#14" in another row, so a lint check could only warn: "#N" also matches pull requests, issues and story numbers" | `ledger/2026-11-17-walk-skips-unlabelled-keyed-nodes.md:5`: "story graph-operations-first-slice #14" | Yes |

### Round-2 findings, re-checked

- **R2-B1 (the search found nothing on this Mac): fixed** (claims 40–42).
- **R2-B2 (a search that didn't happen): fixed** (claims 38–39). The optional rewording was taken (claim 36).

### Findings

#### Blocking

None.

#### Non-blocking

1. **R2F-N1. `ledger/2026-11-22-row-close-misses-citing-rows.md:9`: "never looked" is true of the close, not of the whole session.** The closing session did search for rows citing row 14 once, at 01:42:13Z, while testing this fix. The sentence is about the close, so it misleads no one, and `f89ff663a`'s message ("never searched") reads the same way. **Optional:** "didn't look for rows that cite row 14 before closing it".

### Not checked

- `-w` with the git on CI's Linux runners, as in round 2.

### Close-out

- [x] No story to mark Done, and no book (0-intake step 3, `:39`).
- [ ] Independent checker (`workflows/5-review.md`): not applied, because this session can't start one.
- [ ] Commit: left to the session that started this review, which asked the Reviewer not to commit. A suggested message: `review: operations-required-check-status — PASS, round 2 fix check (test-suite-hermeticity, doc lane)`.

### Verdict

Both of round 2's blocking items are fixed, and each fix holds against its source. On this Mac, the row's search now finds row 24, and it keeps word boundaries for other numbers. The account of the close now matches the transcript. One wording note stays optional (R2F-N1).

Round 1's B1 was fixed in round 2. So nothing blocking remains in the change as reviewed: `edc58fed8` and its four fix commits, `a05bfec59`, `31d8affb2`, `dd8a4ea5f` and `f89ff663a`. CI's `Test / stack-free` job runs `npm test` on the pull request.

**PASS**

## Round 2, R2F-N1 check — 2026-11-21 local, 2026-11-22 UTC (one commit, `c9b33c669`, over `3de89484b`)

- **What changed.** `3de89484b` commits the fix check as written (59 lines, the claim-40 clarification included), and no later commit touches this file. `c9b33c669` changes one line, `ledger/2026-11-22-row-close-misses-citing-rows.md:9` (+1 −1). At word level, two things change: "never looked" becomes "didn't look", and "row 14," becomes "row 14 before closing it,". The header fields (`:1-7`) are untouched, so no reader or suite sees anything new.
- **The claim holds.** The new sentence is "The closing session didn't look for rows that cite row 14 before closing it, since no step asks for that."
  - The transcript shows no such search before the close, `edc58fed8` at 00:41:37Z (round 2, claim 32).
  - `OPEN.md:18-28` has no step that asks for one.
  - The words are R2F-N1's, and the session's later search, at 01:42:13Z, no longer contradicts them.
- **Gates.**
  - `git diff --check HEAD~1..HEAD` and `git diff --check origin/staging...HEAD`: no output, exit 0.
  - `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`, exit 0, before and after this section.
  - No suite was run, and no `gh api` request was made.
- **R2F-N1: fixed.** Nothing remains open from any round.
- **Commit:** left to the session that started this review. A suggested message: `review: operations-required-check-status — PASS, R2F-N1 check (test-suite-hermeticity, doc lane)`.

**PASS**
