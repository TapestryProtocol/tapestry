# No Ready verdict has been published yet, so the Ready comment and the `ready-to-one-shot` label are untried on a real issue

**Id:** 2026-11-05-issue-evaluator-first-ready-verdict
**Type:** cleanup
**Opened:** 2026-11-05 (harness/issue-evaluator, the Issue Evaluator pilot)
**Status:** OPEN
**Done:** —

All five dry-run issues came out Not Ready, so the pilot's one publish posted two Not Ready verdicts. The Ready comment is meant as the night session's brief and the morning reviewer's checklist (`.claude/skills/evaluate-issues/verdict-format.md` § Ready), and no real one exists yet.

Close it when the first Ready verdict is published and read back: its comment, then its `ready-to-one-shot` label, with `ngit issue list --label ready-to-one-shot --json` listing the issue. The likeliest first one is an issue whose author answers a Not Ready comment.

**Pointer:** `engineering-team/designs/issue-evaluator.md` § The first publish (2026-11-05)
