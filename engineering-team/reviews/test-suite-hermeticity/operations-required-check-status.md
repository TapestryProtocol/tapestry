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
