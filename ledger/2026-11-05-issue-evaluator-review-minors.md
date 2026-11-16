# Ten minor findings from the Issue Evaluator pilot's review were left for a person to decide

**Id:** 2026-11-05-issue-evaluator-review-minors
**Type:** cleanup
**Opened:** 2026-11-05 (harness/issue-evaluator, the Issue Evaluator pilot's review)
**Status:** OPEN
**Done:** —

The review's Critical and Important findings were fixed before merge, and its round 2 passed. Round 1 also found seven Minor issues: two were handled then (a failed label now says the comment is already up, and the memory pointer keeps issue ids and verdicts out of `MEMORY.md`). Round 2 found seven more, all non-blocking: two were corrections to the design's own account (the injection checks surface a write rather than prevent it, and the judge named the attempts rather than quoting them), made before merge. These ten are open, each detailed in the review:

1. **The missing-label offer** has no step of its own in `SKILL.md`. Once an issue carries both labels, the run can't tell which is newer, since ngit's issue JSON gives labels as bare strings.
2. **The design's stale copies:** its status line still says "Draft … Not yet built", its rubric snapshot claims to be the approved v1 though `rubric.md` has moved on, its answer block lacks `Steering:`, and it says David hasn't seen the changes made after approval.
3. **Portability:** the agent file and `rubric.md` name Tapestry outside the night-session section, `SKILL.md` names this repo's paths, `rubric.md` says `staging` where `--base` may name another ref, the ngit calls don't pass `--repo origin`, and `--base` with a tag or a sha isn't defined.
4. **No decoder is named** for turning an nevent into a short id (the dry run used `nak decode`).
5. **The record:** three departures from the approved rubric text are written down only in the run's git-ignored ledger (rule 7's P-50 aside dropped, rule 8's architecture clause reworded, `needs-info` also covering the reviewer's input).
6. **The own-files pattern** `engineering-team/reviews/*/issue-evaluator-*` in `SKILL.md` misses a review moved under `reviews/done/<epic>/`; `reviews/**/issue-evaluator-*` would catch both.
7. **Nothing ties a comment file to its bundle's issue** in `publish.sh`, so a mix-up would post one issue's verdict, and a permanent label, on another. The judge's answer has an `Issue:` line that could be matched to the bundle's `short_id`.
8. **A misleading refusal:** a full verdict whose section line ends in a space is refused safely, but the message points at `--recheck`.
9. **`find` in the judge's allowance** includes `-exec` and `-delete`. "Never run anything that writes" still covers them; the list could say so.
10. **Other publishers aren't told to re-read.** `verdict-format.md` § When a verdict is current is sound only because `publish.sh` re-reads first; a night session or a pipeline reading that file alone wouldn't learn it must.

**Pointer:** `engineering-team/reviews/harness-self-improvement/issue-evaluator-pilot-2026-11-05.md` § Findings, Minor, and § Round 2, New in round 2
