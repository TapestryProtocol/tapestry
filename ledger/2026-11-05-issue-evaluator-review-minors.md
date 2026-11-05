# Five minor findings from the Issue Evaluator pilot's review were left for a person to decide

**Id:** 2026-11-05-issue-evaluator-review-minors
**Type:** cleanup
**Opened:** 2026-11-05 (harness/issue-evaluator, the Issue Evaluator pilot's review)
**Status:** OPEN
**Done:** —

The review's Critical and Important findings were fixed before merge. Of its seven Minor findings, two were handled then: a failed label now says the comment is already up (it came with the Critical fix), and the memory pointer keeps issue ids and verdicts out of `MEMORY.md`. These five are open, each detailed in the review:

1. **The missing-label offer** has no step of its own in `SKILL.md`. Once an issue carries both labels, the run can't tell which is newer, since ngit's issue JSON gives labels as bare strings.
2. **The design's stale copies:** its status line still says "Draft … Not yet built", its rubric snapshot claims to be the approved v1 though `rubric.md` has moved on, its answer block lacks `Steering:`, and it says David hasn't seen the changes made after approval.
3. **Portability:** the agent file and `rubric.md` name Tapestry outside the night-session section, `SKILL.md` names this repo's paths, `rubric.md` says `staging` where `--base` may name another ref, the ngit calls don't pass `--repo origin`, and `--base` with a tag or a sha isn't defined.
4. **No decoder is named** for turning an nevent into a short id (the dry run used `nak decode`).
5. **The record:** three departures from the approved rubric text are written down only in the run's git-ignored ledger (rule 7's P-50 aside dropped, rule 8's architecture clause reworded, `needs-info` also covering the reviewer's input).

**Pointer:** `engineering-team/reviews/harness-self-improvement/issue-evaluator-pilot-2026-11-05.md` § Findings, Minor
