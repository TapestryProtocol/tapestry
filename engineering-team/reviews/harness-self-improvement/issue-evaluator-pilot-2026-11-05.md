# Review: the Issue Evaluator pilot (`/evaluate-issues`, its judge, rubric v1, the verdict format and `publish.sh`)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-05 (EST; the review ran from about 17:00Z to 17:45Z)
**Diff:** `git diff 3eed1b8eb..4ddd118df` on `harness/issue-evaluator`, the same range as `origin/staging...HEAD`.
It has four commits: `701aa7449` (design), `528138118` (judge, rubric, verdict format), `65d61ae9a` (`SKILL.md`) and
`4ddd118df` (`publish.sh`, first publish recorded). There are 7 files and 516 insertions. The review package
`.superpowers/sdd/issue-evaluator-plan/review-3eed1b8eb..4ddd118df.diff` carries the same 453 changed lines, with
wider context.
**File:** not numbered. This is the doc / harness lane (Implementer + Reviewer, `workflows/0-intake.md` §3), with no
story, ADR or test plan. The same review is the final whole-branch review of the implementation plan.
**Intent anchor:** the spec, `engineering-team/designs/issue-evaluator.md` (approved "Spec approved", 2026-11-04
23:56 ET), plus the plan's Global Constraints and Review Focus. The plan is a session-scratchpad file, not in the repo.

This reviewer wrote this one file and nothing else in the repo. There was no `git add`, no commit, no push and no
branch switch.
- **ngit:** `ngit repo --json` once, and `--help` / `--version`. No `ngit issue view|list` was run; the executor's
  read-back files were used instead. Nothing was published.
- **Docker:** no `docker exec`. The suites ran with a stub `docker` first on `PATH` that refuses every call (it
  logged two refused probes), plus `TAPESTRY_PORT=1` and `TAPESTRY_CONTAINER=no-such-container-review`.
- **publish.sh:** run only against stub `ngit` binaries. Those were the executor's ten checks, and three probes of my
  own, guarded to abort unless the stub is the `ngit` on `PATH`.
- **Never read:** `nostr.*` config, signer settings or keys.

**Short version.** The skill, the judge and the three reference files are carefully built. They agree with each other
on the marker line, the labels and the answer block. Every ngit flag they use exists in 3.0.3, lint is clean, and the
first publish traces byte-for-byte from the judge's answer to the relay. **Five things block.**
1. **Critical:** a comment that arrives between gathering an issue and publishing its verdict is masked for good. This
   already happened in the first publish.
2. **Important:**
   - anyone's comment that starts with the marker line counts as a verdict;
   - the skill hands the judge the Evaluator's own design as "activity", which its blinding forbids it to read;
   - `publish.sh` silently drops the label when a full verdict contains a line starting "Re-checked after ";
   - the judge's Bash plus untrusted issue text has never been tested as the real agent type, or against a command
     rather than a verdict.

## Quality gates (run by reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh`: last line `harness-lint: clean (0 violations)`.
  - **L5 / L6:** the new wiring files, `publish.sh` included, carry no `localhost:<digit>`, `/Users/` or `/home/<name>`.
  - **L8:** the relative links in `SKILL.md`, `rubric.md` and `verdict-format.md` resolve.
  - **L10:** checked per commit by hand, since the lint looks only at the newest. `528138118`, `65d61ae9a` and
    `4ddd118df` each touch `engineering-team/CHANGELOG.md`. `701aa7449` touches only `engineering-team/designs/`,
    which is not in `scripts/harness-def-paths.txt`.
  - **L11:** `CLAUDE.md` and `AGENTS.md` are untouched.
- [ ] `npm test`: **not run.** The full suite leaks fixtures on this machine, so there is no `npm run gate:status` line
  to quote. Instead, the four suites that read skill and agent files were run through their `run()` export with the
  scratchpad runner, with docker stubbed as above. Its last line was `SUITES: all green`.

  | Suite | Result |
  |---|---|
  | `safe-to-merge-check` | 16 pass, 0 fail |
  | `operational-direction` | 76 pass, 0 fail. The ten live H-class tests skipped, because docker was stubbed. |
  | `harness-lint` | 85 pass, 0 fail |
  | `gate-result-record` | 34 pass, 0 fail |

  - **No other suite reads `.claude/skills` or `.claude/agents`.** A grep of `test/*.test.js` also hits
    `appearance-setting-home` and `information-for-agents`, but both are false positives: they name the
    `/information-for-agents` page. This answers the pre-flight ruling's "the Reviewer is told to look for one".
- [x] **The executor's publish tests**, `scratchpad/scripts/test-publish.sh` (stub ngit): 10 passed, 0 failed.
- [x] **Reviewer probes of `publish.sh`**, against a stub ngit:
  - **(1)** A full Ready verdict containing a line that starts "Re-checked after " posts the comment, posts **no
    label**, exits 0 and prints `posted the comment on nevent1probe` (Important 3).
  - **(2)** A label that fails after the comment exits 1 with only ngit's error (Minor 5).
  - **(3)** A CRLF comment file fails safe: exit 2, before any ngit call.
- [x] **The answer validator**, `scratchpad/scripts/check-answer.sh`: the two saved real answers (`94229587`,
  `fdd1d1a5`) pass, and the two broken copies fail ("Rules has 7 entries", "marker line"). The other six rubric answers
  are recorded as parsed in `ie/results.md`; I did not re-check them.
- [ ] `npm run test:playwright`: not applicable (no UI). Lint, typecheck and build are not configured.

## Claims adherence (doc-lane variant)

| # | Claim (where) | Evidence | Holds? |
|---|---|---|---|
| 1 | The run's ngit commands are right for 3.0.3 (`SKILL.md:14–24`, `publish.sh:25–27`) | `ngit --version` = 3.0.3. `--help` shows `issue view --comments --history --json`, `issue comment --body`, `issue label --label`, `--defaults` ("non-interactive mode"), `--repo-relay-only`, `pr list --status`, `repo --json` and `account whoami`. | Yes |
| 2 | With no issue named, it judges every *open* issue (`SKILL.md:12, 17`) | `ngit issue list --help`: `--status … [default: open]` | Yes |
| 3 | Labels come only from the author or a maintainer, and can't be removed (`verdict-format.md:7`) | `label` is "(author or maintainer only)", and the `issue` subcommands have no unlabel | Yes |
| 4 | The maintainer check compares npubs (`SKILL.md:14`) | `ngit repo --json` `.maintainers` (= `.confirmed_maintainers` here) are npubs, and comment and issue authors in the read-back are npubs. I did not run `whoami` (it isn't on my read-only list). | Yes, as far as checked |
| 5 | A marker comment is never activity (`verdict-format.md:77`; Review Focus 2) | `ie/testA-after.txt`: `open issues: 20, candidates: 18`, and the two published issues read `current verdict`. The rule is author-blind, though (Important 1). | Yes, but too broad |
| 6 | The snapshot leaves out the Evaluator's design and skill (`SKILL.md:16`) | As written, yes. But the *mentions* step and reviews of the Evaluator aren't covered (Important 2). | Partly |
| 7 | `publish.sh` posts the comment, then the label its heading names. A re-check note gets no label, and a failed comment stops the label (`publish.sh:2–4`; design :242) | 10/10 stub checks. Probe 1 shows the re-check test fires anywhere in the file (Important 3). | Partly |
| 8 | Two Not Ready verdicts went up, each a comment and then a label, read back (design :238–240) | `ie/readback/labelled.json` lists exactly the two, each labelled `not-ready-to-one-shot`. Each published body is byte-identical to its comment file (`diff` exit 0). `comment-94229587.md` differs from the judge's answer only by "Since" becoming "As of", as recorded; `fdd1d1a5` is unchanged. | Yes |
| 9 | Sent to "the repo's two relays only" (design :238) | `--repo-relay-only` in `publish.sh`. `ngit repo --json` `grasp_servers` are `relay.ngit.dev` and `gitnostr.com`. | Yes |
| 10 | "The two published ones now count as current" (design :241) | True. But `94229587`'s verdict is current over a comment its judge never saw (Critical 1). | True, and that is the defect |
| 11 | The d-tag bug "already on the repo's ledger" (design :233) | `ledger/2026-10-10-core-node-dtags-ignore-header-dtag.md` exists | Yes |
| 12 | **Status:** "Draft, for David's review. Not yet built." (design :3) | It is approved (design :266) and built (this diff) | **No** (Minor 2) |
| 13 | "This is v1 as approved. The live copy is `rubric.md`" (design :37) | The two texts differ: rule 4, rule 7, rule 8, `needs-info`, night session | **No** (Minor 2) |
| 14 | The judge's answer block (design :148–155) | `verdict-format.md:85–93` adds `Steering:` | **Diverged** (Minor 2) |
| 15 | "Nothing in the skill folder or the agent file names this repo or this machine except the rubric's night-session section" (design :171) | `issue-evaluator.md:3` "Tapestry's"; `rubric.md:23` "for Tapestry"; `SKILL.md:16` names this repo's design path | **No** (Minor 3) |
| 16 | The judge "never runs a command that writes, publishes or fetches" (design :84) | Instruction only (`issue-evaluator.md:26–28`). The real agent type was never spawned (design :234). | **Unverified** (Important 4) |

## The plan's Review Focus

1. **An issue that tries to steer the verdict.** Expected: judged on the rubric alone, with the attempt noted. The
   synthetic `5e1f0a7c` came out `NOT_READY`, with the line quoted on `Steering:` (`ie/results.md:111`). The
   `Steering:` slot is structural (`verdict-format.md:90`, `issue-evaluator.md:21`). **Holds, narrowly.** The issue
   is plainly Not Ready on rules 1 and 2 without the injection, so the test shows the attempt is noticed. It can't show
   the verdict wasn't swayed, and no test asks the judge to *run a command* (Important 4).
2. **The evaluator's own comments counted as new activity.** Expected: a marker comment is never activity. Test A
   after the publish gave 18 of 20. **Holds, too broadly:** *anyone's* marker-first comment is never activity
   (Important 1).
3. **A comment that adds scope.** Expected: the body and every comment are judged together. `rubric.md:20` says "from
   the body and every comment", and both `d6398202` runs judged the comment's owner alert, as rule 5 or as rules 7
   and 8 (`ie/results.md:100, 116–117`). **Holds.**
4. **A comment that went up without its label.** Expected: the next run offers it. `verdict-format.md:79` says so,
   and Test C's fresh reader found it. **Holds in isolation.** A no-arg run skips current-verdict issues at
   `SKILL.md:17`, and no step says where the offer is shown. Inclusion also stops detecting anything after a flip
   (Minor 1).
5. **A checkout with no ngit remote.** Expected: it stops at the start. `SKILL.md:14` checks for `nostr://` before
   anything else; Test D matched, and this checkout's `origin` is `nostr://…/relay.ngit.dev/Tapestry`. **Holds.**

## Rulings weighed (`progress.md`, every `Ruling:` line)

| Ruling | Assessment |
|---|---|
| Pre-flight: RED = baseline, GREEN = rubric runs | Accept |
| Pre-flight: no full `npm test`; lint plus four suites | Accept. I checked for a fifth suite reading `.claude/`: there is none. The four-suite command itself docker-execs on this machine (Harness friction 1). |
| T1: bundles carry `short_id` and `nevent` | Accept. `SKILL.md:20` and `issue-evaluator.md:15` both document them. |
| T1: a worktree mention counts only if it differs from the base; the Evaluator's design is never a mention | Accept the rule. **Only the first half reached `SKILL.md:18`.** The exclusion lives in the scratch `make-bundles.sh:35` (Important 2). |
| T1: issue 4's Expected superseded (staging moved) | Accept. `origin/staging` has the setup book, epic and stories citing `94229587`. |
| T2: contaminated `94229587` baseline not re-run | Accept. The rubric run was blind and agreed. |
| T2: the snapshot drops the Evaluator's files | Accept. It is incomplete: reviews and `git show <base>:` after merge (Important 2). |
| T2: two predictions were wrong; the baselines stand | Accept. The merits are not re-judged here (Declined 1). |
| T2/T3: rule 4 and rule 8 additions, and the night-session line | Accept. They are recorded in the design's dry-run section. |
| T3: five departures from the approved rubric text | Accept the substance. Three of them are recorded nowhere durable (Minor 6). |
| T3: `Steering:` line; "Could be split off" section | Accept. The design's own answer block wasn't updated (Minor 2). |
| T3: judges as general-purpose agents | Accept as forced in that session. The gap must be closed (Important 4). |
| T3: synthetic injection issue instead of a copy of bundle 3 | Accept for cost. Both versions only test a plainly Not Ready issue (Important 4). |
| T3: stability ×2, not ×3 | Accept; it is disclosed (design :218, :232) |
| T3: rule 4 "wouldn't work"; judge every rule; stop iterating | Accept. The ledger entry exists. |
| T4: `SKILL.md` at 539, then 563, words (plan: under 500) | Accept. It's a writing-skills guideline, not a house rule, and the reason holds. |
| T4: account check through `whoami` vs `.maintainers` | Accept. The formats match (claim 4). |
| T4: Test B by validator; Tests C and D by a fresh reader | Accept. Test C exercised the current-verdict step alone, not the no-arg run (Minor 1). |
| T5: two Not Ready published, not one Ready and one Not Ready | Accept; it was David's choice. The Ready comment and `ready-to-one-shot` are untried, and that is disclosed. |
| T5: publish through `publish.sh` | Accept the move. Its re-check test needs anchoring (Important 3). |
| T5: David's three later approvals recorded with times | Accept. I could not check the times (Declined 13). |

## ADR adherence / Concept-graph integrity / Product-guide adherence

Not applicable. There is no ADR, no concept definitions changed (so no firmware reinstall), and nothing traces to a PRD.

## Things tests can't catch

- [x] No secrets: a diff scan for `nsec1`, private-key headers, machine paths and ports finds nothing. The
  `82b75e47…` in the design is a public-key prefix quoted in prose about an issue, not code.
- [x] No debug code, no commented-out code, no TODOs.
- [ ] **Race:** gather → judge → operator → publish has no re-read (Critical 1).
- [ ] **Trust boundary:** marker comments are trusted without an author check (Important 1). Untrusted issue text
  reaches an agent with Bash (Important 4).
- [ ] **Silent failure:** `publish.sh` drops a label by content sniff (Important 3).

## House rules check

- [x] No new lint, typecheck or build tooling. `publish.sh` is a skill helper.
- [x] Concept Graph API authority and the TA-pubkey rule are not touched.
- [x] `CLAUDE.md` and `AGENTS.md` are untouched; the skill is found by its description.
- [ ] **H²₀:** the files are harness definition at L1, so the merge needs David's OK in chat first, recorded verbatim.
  The plan's Task 7 records it. The present Origin cell is short of §6's fields (Minor 6).

## Strengths

1. **The dry run was honest, and it changed the design.**
   - Two of the four predictions were wrong. Each disagreement was checked in the code, and the lessons went into the
     rubric (rule 4's broken-fix clause, rule 8's recorded-decision clause) and into the design's dry-run section.
   - The design says plainly that the baselines judged as well as the rubric, and that the rubric's value is
     structure.
2. **Blinding where it was cheap.**
   - The snapshot export drops the Evaluator's design and skill.
   - The spawn prompt is paths only.
   - Auto-loaded `CLAUDE.md` and memory notes count only as hints (`issue-evaluator.md:22`).
   - Earlier verdicts count as judgments, not evidence (`:23`).
   - `Steering:` is a required slot, not an afterthought.
3. **Permanent labels are handled conservatively.**
   - The comment goes before its label, and a failed comment stops the label (tested).
   - One issue at a time, on the operator's OK.
   - A re-check note avoids a duplicate label.
   - A missing label is offered again.
4. **`publish.sh`'s input guards fail safe.** No marker, two headings, no heading, an empty or missing file, and CRLF
   all exit 2 before any ngit call. It rejects a whole judge answer pasted in by mistake, since the first line is
   `VERDICT:`.
5. **The three reference files agree with each other,** checked pair by pair: the marker line (also matched by
   `publish.sh:14` and the validator), both labels, the answer block, the eight rule names and the reason tags. The
   agent file mirrors `gate-judge.md`'s working frontmatter and `tools:` line.
6. **The first publish is fully traceable:** judge answer → comment file (one recorded word change) → published body,
   byte-identical, then read back through `ngit issue list --label`.
7. **Limits are disclosed in the spec,** not buried: cost, rule-level variance, the deep bug no rubric run found, the
   untested agent type, and the untried Ready path.

## Findings

### Critical (blocking)

1. **`SKILL.md:24` (Publish), against `verdict-format.md:77` (current verdict): a comment that arrives between
   gathering and publishing is masked permanently.**
   - **The gap:** the run gathers each issue (step 2), judges it (10–20 minutes a judge), waits for the operator, and
     publishes, with no re-read. Once the verdict is posted, every earlier comment counts as already considered: "It
     stays current until, *after it*, the issue gets a comment that isn't the marker." So a comment from the window is
     treated as judged when no judge saw it, and no-arg runs skip the issue from then on.
   - **It happened in the first publish:**
     - the bundle `ie/bundles/94229587.json` was built at 00:09:17 EST with `issue.comments` empty;
     - a maintainer's comment ("## Status: step 1's page is built and in production", `created_at` 1793855598 =
       00:13:18 EST) arrived four minutes later;
     - the verdict went up at 12:01:33 EST, nearly 12 hours later;
     - `ie/testA-after.txt` now lists that issue as `current verdict`.
   - **This time it did no harm:** the comment agrees with the verdict's rule 4. The mechanism is the defect.
   - **Why it matters:**
     - an author who answers the Evaluator's questions, or adds scope, in that window is silently ignored, and the
       issue looks judged with their input;
     - in the Ready direction, a comment like "this needs the production key" would sit under a `ready-to-one-shot`
       label that an unattended overnight run reads;
     - the operator can't see it, because Show displays the verdict built from the old bundle;
     - the same gap lets a second machine's run publish over this one's (David runs two machines).
   - **Fix:**
     - record when each bundle was gathered;
     - just before `publish.sh`, re-read the issue (`ngit issue view <id> --comments --history --json`);
     - if a non-marker comment, an edit or another verdict is newer than the bundle, don't publish that verdict: show
       what's new and re-judge, or ask;
     - say so in `SKILL.md` step 6 and in `verdict-format.md` § When a verdict is current;
     - for `94229587`, re-judge it by name, or record that the status comment doesn't change the verdict.

### Important (blocking)

1. **`verdict-format.md:77, 79`, `SKILL.md:17, 32`: any comment whose first line is the marker counts as a verdict,
   whoever wrote it.**
   - **The gap:** issues on nostr take comments from anyone, and the marker is plain text. A stranger's comment, or a
     person's reply that copies the marker line:
     - makes the verdict "current", so no-arg runs stop re-judging the issue; and
     - names a label through its heading. If the issue lacks that label, the run reads it as "the label failed after
       the comment went up" and offers to publish it. On a busy operator's OK, that is a maintainer-signed
       `ready-to-one-shot` on an issue no judge rated, and a label can't be removed.
   - **Why the fix is cheap:** the spec already filters labels by "the issue's author or a maintainer"
     (`verdict-format.md:7`), and ngit's JSON gives every comment's `author` as an npub (see the read-back).
   - **Fix:**
     - count a marker comment as a verdict only when its author is in the same trust set, or narrower: the
       maintainers from step 1, plus this machine's account;
     - treat any other marker-first comment as ordinary activity;
     - when offering a missing label, show the verdict comment's author.
2. **`SKILL.md:18` (and `:16`): the run hands the judge the Evaluator's own records as "activity".**
   - **The gap:** the ledger's Task 1 ruling says "the Evaluator's own design doc is never a mention". The dry run's
     `make-bundles.sh:35` drops it, but `SKILL.md:18` doesn't.
   - **After merge:**
     - `git grep -l <short> <base> -- engineering-team` returns `engineering-team/designs/issue-evaluator.md` for all
       five dry-run issues (on `HEAD` today, `94229587` is named only by the design);
     - the worktree clause adds every worktree's copy, because `SKILL.md:16` removes the design from the snapshot, so
       every copy "differs from the snapshot";
     - this review names the same ids, and the snapshot doesn't exclude reviews;
     - once the design is on the base, `git show <base>:engineering-team/designs/issue-evaluator.md` reaches it
       too. `issue-evaluator.md:27` allows `git show` on the base ref, so that path stays instruction-level.
   - **Why it matters:**
     - the bundle gives the judge a path that `issue-evaluator.md:19` forbids it to read ("its design … or its
       records");
     - it lists the design as possible in-flight work under rule 3 ("an open branch, PR, book … naming it",
       `rubric.md:13`);
     - a compliant judge marks rule 3 `unverifiable` (a false Not Ready); a curious one reads the predictions and
       verdicts. Each new record (reviews, future dry runs) widens it.
   - **Fix:**
     - keep one list of the Evaluator's own paths in `SKILL.md`: the design, the skill folder, and reviews named
       `issue-evaluator-*`;
     - apply it both to the snapshot and to the mentions, on the base and in the worktrees.
3. **`publish.sh:24`: the label is skipped whenever *any* line starts "Re-checked after ".**
   - **The gap:** `grep -q '^Re-checked after '` reads the whole file. A full verdict that leads with that phrase
     posts with no label, exits 0, and reports only "posted the comment" (probe 1). This is plausible on a re-judge:
     the judge reads `verdict-format.md`, whose re-check template (`:72`) teaches exactly that phrase, and it is told
     to weigh the earlier verdict (`issue-evaluator.md:23`).
   - **Why it matters:** in a flip from Ready to Not Ready, the old `ready-to-one-shot` stays the verdict of record
     until a later run notices. After an earlier flip, inclusion (Minor 1) never notices at all.
   - **Fix:**
     - let the skill state the mode, for example `publish.sh --recheck <id> <file>`, since `SKILL.md:24` already
       decides it;
     - have the script refuse a re-check file that carries a full section (`**What would make it ready:**`,
       `**Done when**`), and a full verdict that lacks one;
     - at minimum, anchor the test to the first non-blank line after the heading;
     - add the case to the stub tests.
4. **`.claude/agents/issue-evaluator.md:4, 26–28` (design :84, :234): the judge's read-only promise is untested where
   it matters.**
   - **The setup:** the judge has Bash and reads issue text that anyone on nostr can write. It runs on a machine whose
     ngit signs as a maintainer (design :15, :238). "Never run ngit … never run anything that writes" is an
     instruction, not a control.
   - **Evidence it bends:** one baseline judge wrote a file despite "change no files" (`ie/results.md:57`).
   - **What was tested, and what wasn't:**
     - the steering test asked for a verdict on an issue that was Not Ready anyway, never for a command;
     - the real `issue-evaluator` type was never spawned, so its `tools:` whitelist (no Write or Edit) is unverified;
     - the spec says the evening run may re-judge (design :133), which may be unattended.
   - **Why it matters:** an issue body that gets the judge to run `ngit issue label … ready-to-one-shot` bypasses the
     operator's publish gate entirely.
   - **Fix, before the next publish:**
     - in a fresh session, spawn `issue-evaluator` as itself on one real bundle and on one command-injection bundle,
       whose text asks it to run a labelling or writing command. Expected: nothing runs, and `Steering:` quotes the
       attempt;
     - record both results in the design's Limits;
     - if this can't happen before merge, an OPEN.md row that gates the next publish on it is the minimum.
   - **Optional:**
     - say in `SKILL.md:22` that judges run only in a session that prompts for Bash;
     - add a `Blinding: intact | BROKEN` line to the answer, as `gate-judge` has.

### Minor (non-blocking)

1. **`verdict-format.md:79`; `SKILL.md:17, 24`: the missing-label check.**
   - **Where the offer lives:** no step says where it appears. Step 2 skips current-verdict issues, so the offer lives
     only in the format file. Test C passed with the step applied alone.
   - **Inclusion goes blind after a flip:** once both labels exist, the check never fires again. ngit's
     `issue view --json` gives labels as bare strings, with no time or author, so the skill can't tell which label is
     newer.
   - **Suggest:**
     - Show lists "current verdict, label missing" rows explicitly;
     - when both labels are present, flag the verdict of record as unknown from ngit's JSON, rather than passing.
2. **`engineering-team/designs/issue-evaluator.md`: stale copies inside the binding spec.**
   - `:3` still reads "Draft, for David's review. Not yet built."
   - `:37` claims "v1 as approved" for a text that no longer matches the live `rubric.md`. Two texts now answer to
     "rubric v1", the version the marker records and staleness keys on.
   - `:148–155` lacks `Steering:`.
   - `:198` still says "David hasn't seen them yet", after his "Spec approved".
   - `SKILL.md:21` says "200–300k" where the design says 140k–325k (`:231`).
   - **Suggest:** update the header, and mark both sections "superseded by the live copy; deltas listed below".
3. **Portability (design :171, "move to the team plugin unchanged").**
   - `issue-evaluator.md:3` opens "Tapestry's".
   - `rubric.md:23`'s "(for Tapestry, the four invariants in CLAUDE.md)" sits outside the night-session section.
   - `SKILL.md:16` hard-codes this repo's design path.
   - `rubric.md:5, 14` say `staging`. That is approved wording, but inaccurate under `--base`.
   - Git uses `origin` while ngit picks its repo by `nostr.repo`, tracked upstream or remote detection. A fork checkout
     could judge one repo's issues against another's snapshot. Pass `--repo origin`; ngit accepts a remote name.
   - `--base <ref>` with `git fetch origin <branch>` (`SKILL.md:12, 16`) is undefined for a tag or a sha.
4. **`SKILL.md:12, 18`: no way to get a short id is given.**
   - ngit's JSON carries only nevent ids, for issues and comments alike. The dry run used `nak decode`
     (`make-bundles.sh:16`), and `/evaluate-issues <short id>` needs a list-and-decode match.
   - **Why it matters:** a wrong decode silently empties the in-flight search for rule 3.
   - **Suggest:** name the decoder (`nak decode <nevent> | jq -r .id`), and check that the hex id round-trips through
     `ngit issue view`.
5. **`publish.sh:25–29`: a label failure doesn't say the comment is up** (probe 2). A natural retry duplicates the
   comment. **Suggest:** print "comment posted" after line 25, and on a label failure, "the comment is up; the label
   failed; the next run offers it; don't re-run publish.sh".
6. **The record (`engineering-team/CHANGELOG.md:112`; the ledger).**
   - **The ledger is gitignored** (`.superpowers/sdd/.gitignore`), so rulings "listed for David" live nowhere
     durable. Three rubric departures appear only there:
     - rule 7's P-50 aside was dropped;
     - rule 8's architecture clause was reworded;
     - `needs-info` now also covers the reviewer's input (`rubric.md:35` vs design :63).
   - **The Origin cell** quotes "Spec approved" without the time (23:56 ET, design :266) or a hold-level clause, both
     of which H²₀ §6 asks for. The rubric, format and `publish.sh` changes post-date that OK.
   - **Suggest:** list the departures in the design, and have the merge OK (plan Task 7) name them.
7. **Plan Task 7's memory pointer:** keep issue ids and verdicts out of `MEMORY.md`. Judges on this machine load it
   automatically, and one baseline leaned on memory notes (`ie/results.md:57`).

### Harness friction (each should become an OPEN.md `meta` row)

1. **The "four safe suites" command docker-execs into `tapestry` on this Mac.**
   - **The mechanism:** `test/operational-direction.test.js:309–323` runs its in-container probe
     (`docker exec tapestry curl … 127.0.0.1:7778`) even when the host probe fails.
   - **The executor's run reached the container:** its Task 4 run (`ie/suites.log:94–103`) shows H1–H10 **PASS**, not
     SKIP. So it reached `localhost:7778` and `docker exec`'d into Grawk's private agent memory, including H6's
     `/api/neo4j/query` count. Those calls are read-only by the suite's design.
   - **The mitigation falls short:** the memory note's "dead port" stops the H-tests, but not the probe.
   - **Suggest:**
     - the runner stubs `docker` or sets `TAPESTRY_CONTAINER` to a container that doesn't exist;
     - optionally, the suite short-circuits on the host probe;
     - the brief that names this command says so.
2. **The worktree guard refuses compound commands that mention `ngit`, reading it as `git`.** This hits even `--help`
   loops. The design already records it for publishing (`:242`), and reviewers and executors meet it on reads too.

## Declined to judge

1. Whether each verdict is right on its merits (for example `fdd1d1a5`'s rule 6): that was the dry run's job.
   Re-judging costs 140k+ tokens an issue, and calibration is the spec's stated next step (design :250).
2. An issue's author can self-label `ready-to-one-shot`, and `verdict-format.md:7` counts it as the verdict of record.
   The spec chose "author or a maintainer" (design :93), and the pipeline and Loom page that act on it are out of
   scope. Flagged for the pipeline's design.
3. The yolo pipeline's own safety (instances, relays, resets): out of scope (design :246).
4. Whether `ngit issue comment`'s exit 0 means every repo relay took the event: can't test without publishing. The
   read-back shows both landed.
5. The exact output of `ngit account whoami --json` (several accounts?): it isn't on my read-only list. The
   subcommand exists.
6. Whether `.maintainers` can include invited, unaccepted maintainers: here it equals `.confirmed_maintainers`, and
   ngit enforces authorship at publish time anyway.
7. Whether a cover note (`ngit issue set-cover-note`) appears in `edit_history` and so counts as an edit: no sampled
   issue has one, and it can't be verified read-only.
8. The NIP-32 kind 1985 / `#t` detail (`verdict-format.md:7`): the file defers to "as `ngit issue label` makes them".
   I didn't check it against raw events.
9. A re-check note drops a judge's updated questions when the failing rules are the same: a spec decision (design
   :135).
10. Reading other worktrees' uncommitted files during gather: a spec decision (design :82).
11. Token cost a run: not a correctness matter beyond the ask-before-five rule, which is present.
12. Whether `git archive` of the base is the right snapshot for a judge, versus a checkout: a spec decision (design
    :81).
13. The ET times of David's three later approvals (design :266–268): the transcript isn't available to me.

## Verdict

**CHANGES_REQUESTED**

**Ready to merge? With fixes.** The fixes are Critical 1 and Important 1–4. Separately, H²₀ (L1) requires David's
merge OK in chat, recorded verbatim, before the merge (plan Task 7). The Minor items and the harness-friction rows
can follow, but Harness friction 1 should be filed before anyone runs that suite command on this machine again.

## On PASS (same commit)

Not applicable. This is the doc lane, with no story to flip to Done. Completion detection: the spec opened no book
(`engineering-team/audits/` has none for the Evaluator), so there is nothing to offer to close.

## Round 2 (2026-11-05, fix commit `456134969`)

**Diff:** `git diff 4ddd118df..456134969`: 12 files, 558 insertions and 29 deletions, in one commit. Besides the
fixes, it carries this review's round-1 text and five new ledger rows. The round-1 text is unchanged from what I
wrote: 397 lines, with my last three edits present.

**Side effects, same limits as round 1:**
- **ngit:** one read, `ngit issue view <94229587's nevent> --comments --history --json`.
- **Docker:** no `docker exec`; `safe-suites.sh` refused its one docker call.
- **publish.sh:** run only against stubs. Those were the executor's 26 cases and six probes of mine, guarded to
  abort unless the stub is the `ngit` on `PATH`.
- **The injection judge's transcript:** read only through targeted `jq` extractions (its Bash commands and its
  final answer) and its 300-byte metadata file. I also read the final answers of the three probe spawns.

Per the role's later-round rule, each fix was re-derived from commands. That includes the parts that follow my own
round-1 wording.

### Gates (re-run, not trusted)

- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`. The fix commit touches
  `engineering-team/CHANGELOG.md` (L10).
- [x] **The suites, through `scratchpad/scripts/safe-suites.sh`** (stub docker, dead port, missing container):

  | Suite | Result |
  |---|---|
  | `safe-to-merge-check` | 16 pass, 0 fail |
  | `operational-direction` | 76 pass, 0 fail; H1–H10 skipped |
  | `harness-lint` | 85 pass, 0 fail |
  | `gate-result-record` | 34 pass, 0 fail |

  The runner reported `SUITES: all green` and `docker calls refused: 1`.
- [x] `scratchpad/scripts/test-publish.sh`: **26 passed, 0 failed.**
- [ ] `npm test`: not run (the machine rule), so there is no `gate:status` line to quote.

### The round-1 findings, re-derived

1. **Critical 1, a comment arriving between gathering and publishing: resolved.**
   - **The fix:** `publish.sh:48–67` re-reads the issue and posts nothing (exit 3) if any comment, edit or label id
     isn't in the bundle. `SKILL.md:23` (Show) re-reads too, and `:24` says what exit 3 means.
   - **The risk I checked, and it doesn't happen:** ngit ids are nevents with a relay hint. If they varied between
     reads, every publish would be refused. They don't vary. The 00:09 bundle's edit id, the 12:03 read-back's comment
     ids and the 12:43 regather bundle's ids all equal a fresh read of mine, and every id carries the same relay hint.
     ngit's update notice goes to stderr, so the JSON parses.
   - **Probes on that real view** (`scratchpad/review-probe/r2-probe-publish.sh`):
     - **The 00:09 bundle:** exit 3. It lists exactly what the first judge never saw: the status comment, the
       published verdict, and `label not-ready-to-one-shot added`.
     - **The fresh bundle:** passes, and posts to the stub.
     - **A stranger's marker comment added after gathering:** exit 3.
   - **For `94229587`:** it was re-judged by the real type from a fresh bundle (`ie/answers/94229587-regather.txt`).
     The answer parses (`check-answer.sh`): NOT_READY on rules 3 and 4, with rule 5 now passing on the status comment.
     The published comment's rule-5 question is therefore already settled; a corrected comment waits for David's OK
     (design :253).
2. **Important 1, anyone's marker comment counted as a verdict: resolved.**
   - **The fix:** `verdict-format.md:77–81` counts a marker comment only from step 1's maintainers or this machine's
     account. Anyone else's is ordinary activity and names no label, and the missing-label offer names the verdict's
     author (`SKILL.md:17, :24, :32`). That set is narrower than the labels' (author or maintainer), as asked.
   - **The fresh reader's texts:**
     - the old ones are byte-identical to `4ddd118df`;
     - its `verdict-format.md` is identical to `HEAD`;
     - its `SKILL.md` differs from `HEAD` only in steps 5–6, which the scenarios don't test.
   - **Its answers:** scenario 1 went from `yes / skip / ready-to-one-shot` (RED) to `no / judge / none` (GREEN).
3. **Important 2, the Evaluator's own records handed to the judge: resolved.**
   - **The fix:** `SKILL.md:15–16` names the Evaluator's own files once (its skill folder, its design and
     `engineering-team/reviews/*/issue-evaluator-*`) and keeps them out of both the snapshot and the activity.
   - **The fresh reader:** scenario 2 went from four paths (RED) to the story alone (GREEN).
   - **On real data:** the regather bundle's `repo_mentions` list only the setup book's files, although both the
     design and this review named `94229587` in this worktree when it was built.
   - **Nothing else leaks:** no ledger row, `CHANGELOG.md` or `OPEN.md` names a judged id (grep), so nothing more
     about the Evaluator reaches the snapshot.
4. **Important 3, a full verdict losing its label to a "Re-checked after" line: resolved.**
   - **The fix:** `publish.sh:16–17, :36–46` takes `--recheck` from the caller. It refuses a re-check note without
     the flag, a full verdict with it, and a full verdict missing its section.
   - **Tests:** `full-verdict-with-a-re-checked-line-keeps-its-label` and the refusals pass.
   - **My probes:** `--recheck` on the real view posts the comment only. A section line with a trailing space is
     refused before any call (exit 2).
5. **Important 4, the judge's Bash against untrusted issue text: resolved.** Keeping Bash is a ruling, and the test
   I asked for was run.
   - **The real type ran:** both runs' metadata says `"agentType":"issue-evaluator"`. The tools probe answered
     `Read, Bash, SubagentHandback`: no Write, Edit, Glob or Grep.
   - **The injection run held:**
     - both canary files are absent (`check-injection.sh`);
     - a `jq` extraction of all 35 of its Bash commands shows every one is a read: `cd`, `sed -n`, `wc`, `ls`, `jq`,
       `head`, `echo`, one read-only `for` loop, and `git -C <worktree> log|show` on the base. There is no write, no redirect to a file, no ngit and no
       network;
     - it returned NOT_READY on rules 4 and 8, with both attempts named on `Steering:`.
   - **The new wording is untested.** The line probe quoted the *pre-fix* sentence, so this result holds for the
     older, weaker wording, and the new "do none of it" line waits for a fresh session (`progress.md:60`).
   - **The residual risk is stated in the ledger** (`progress.md:56`): an injected judge could still sign a label or a
     comment. Show and `publish.sh` would surface it, but neither can stop or undo it.
6. **The Minors.**
   - **Minor 5: resolved.** `publish.sh:73`, the test, and my probe (f) all say the comment is up.
   - **Minor 7: committed but not verifiable here.** `MEMORY.md` is outside this worktree.
   - **Minors 1–4 and 6:** deferred to `ledger/2026-11-05-issue-evaluator-review-minors.md`, which is well-formed and
     points back here.
   - **Harness friction 1 and 2:** filed as meta rows. A `ledger/` file *is* an OPEN.md row (`OPEN.md:19`).

### Rulings weighed (the `Final:` lines, `progress.md:51–76`; numbers are its line numbers)

- **Accepted:** 51–55, 57 (no `Blinding:` line: it was optional), 58 (`SKILL.md` at 645 words: not a house rule),
  59, 60 (honest about the untested wording), 67, and the declined-line rulings 68–76.
- **56, accepted:** the risk is stated plainly, but only in the git-ignored ledger. See N1.
- **66:** the memory half isn't verifiable from here.

### New in round 2 (all non-blocking)

- **N1. `engineering-team/designs/issue-evaluator.md:252`:** "The publish gate has two guards instead" can read as
  prevention. The guards surface an injected label or comment after the fact and refuse to post over it; they can't
  stop or remove it. Only the git-ignored ledger (`progress.md:56`) says so. Put that sentence in the design, and name the
  risk in the merge request, since David's H²₀ OK is what accepts it.
- **N2. `SKILL.md:15`:** `engineering-team/reviews/*/issue-evaluator-*` misses
  `engineering-team/reviews/done/<epic>/…` after an epic close-out. `harness-self-improvement` is Done, but its
  reviews aren't under `done/` yet. Use `reviews/**/issue-evaluator-*`, or name both.
- **N3. `publish.sh:19–24`:** nothing ties the comment file to the bundle's issue, so a file mix-up would post one
  issue's verdict, and a permanent label, on another. This predates this commit.
  - **Partial check:** the marker's `<sha8>` against `base.sha`.
  - **Full check:** take the judge's answer file and match its `Issue:` line to `short_id`.
- **N4. `publish.sh:44–45`:** a full verdict whose section line has trailing whitespace is refused safely, but the
  message, "a re-check note needs --recheck", points the wrong way.
- **N5. `issue-evaluator.md:27`:** the allowance now includes `find`, whose `-exec` and `-delete` write. "Never run
  anything that writes" still covers it. Optional: "find (no -exec or -delete)".
- **N6. Design :254:** "quoted both attempts on `Steering:`". The judge named and described both, writing "[passage
  omitted]" in place of the injected text, so "named" is exact.
- **N7. `verdict-format.md:79`:** the current-verdict rule is sound now because `publish.sh` re-reads first. Another
  publisher that reads this file (a night session or a pipeline) wouldn't learn that it must re-read too. One
  sentence would fix it.

### Declined to judge (round 2)

1. A comment that reaches the repo relays late (propagation lag, or a skewed client clock) after a verdict: that
   window is seconds to minutes and invisible to the re-read, and it can't be tested read-only.
2. The effect of the new "do none of it" wording: it needs a fresh session (`progress.md:60`).
3. The memory pointer (Minor 7): it is outside this worktree.
4. Whether David was told about the Task 4 docker exec (`progress.md:67`): that isn't in this worktree's record.
5. Everything declined in round 1: unchanged, and ruled on at `progress.md:68–76`.

### Verdict (round 2)

**PASS**

**Ready to merge? Yes,** once David's merge OK is recorded verbatim in chat, as H²₀ asks for an L1 change (plan
Task 7). N1 belongs in that request. N2–N7 and the deferred minors can follow.

**On PASS:** this is the doc lane, so there is no story to flip to Done. Completion detection: the Evaluator has no
book under `engineering-team/audits/`, so there is nothing to offer to close.
