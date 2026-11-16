# In a worktree-isolated Claude Code session, a compound command that names `ngit` is refused as if it were `git`

**Id:** 2026-11-05-worktree-guard-reads-ngit-as-git
**Type:** meta
**Opened:** 2026-11-05 (harness/issue-evaluator, the Issue Evaluator pilot)
**Status:** OPEN
**Done:** —

A session the desktop app isolates in a worktree refuses any git command it can't verify stays inside the worktree, and it reads `ngit` as `git`. So `ngit issue comment <id> --body "$(cat <file>)"` is refused ("names git in a form too complex to verify that it stays inside the worktree"), and so are pipes, loops and command substitutions around ngit, even a loop over `--help`. A plain single command runs. A script file run as `bash <path>` runs too, since the guard sees only the `bash` call.

The Issue Evaluator met it at its first publish and now publishes through `.claude/skills/evaluate-issues/publish.sh`. Any skill or doc that tells an agent to run ngit with a substitution or a pipe will be refused the same way in a worktree session. Fix shape: write such steps as plain commands or a bundled script, and say why wherever an ngit recipe is written down.

**Pointer:** `engineering-team/designs/issue-evaluator.md` § The first publish (2026-11-05)
