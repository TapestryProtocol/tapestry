---
name: evaluate-issues
description: Use when asked whether an ngit issue is ready to one shot, which issues an agent could take overnight with no help, or to evaluate, triage or label the issues of an ngit repository for an unattended agent run.
---

# Evaluate issues

An issue is ready to one shot when an agent alone overnight would probably produce a change the morning reviewer keeps. A fresh judge rates each issue against [rubric.md](rubric.md); on the person's OK, the issue gets a comment and a label, as [verdict-format.md](verdict-format.md) says.

## The run

`/evaluate-issues <issue>` (short id, hex id or nevent) judges one issue; with none, every open issue without a current verdict. `--base <ref>` replaces `origin/staging`. Run it in a checkout of the repo.

1. **Check.** `git remote get-url origin` must start with `nostr://`; if not, stop and say so. Note the maintainers (`ngit repo --json`, `.maintainers`) and this machine's account (`ngit account whoami --json`: an npub, never a key).
2. **Gather, read-only, into a scratch directory.** The Evaluator's own files (this skill's folder, its design `engineering-team/designs/issue-evaluator.md` and its reviews `engineering-team/reviews/*/issue-evaluator-*`) stay out of the snapshot and never count as activity, so the judge can't read its own record.
   - Snapshot: `git fetch origin <branch>`, then `git archive <base>` unpacked into `base/`, minus the Evaluator's own files.
   - Issues: `ngit issue list --json`, then `ngit issue view <id> --comments --history --json`. Skip an issue whose verdict is current (verdict-format.md § When a verdict is current, with step 1's maintainers and account) unless it was named.
   - Activity, by short id (the event id's first 8 hex characters): branch names in `git ls-remote origin`, `ngit pr list --status open,draft --json`, `git grep -l <short> <base> -- engineering-team`, and files under `engineering-team` in each `git worktree list` path that name it and differ from the snapshot.
   - Loom's open tasks and open proposals, one call each, if the Loom connector is there.
   - One bundle per issue: `{short_id, nevent, issue, activity: {branches, prs, repo_mentions, loom}, base: {ref, sha, path}}`.
3. **Cost.** A judge run costs 200–300k tokens. Before judging more than five issues, say how many and ask.
4. **Judge.** One fresh `issue-evaluator` per bundle, at most four at a time, given only the rubric, the verdict format, the bundle and the snapshot, by path. A malformed answer gets one fresh judge, then is reported as failed.
5. **Show.** Re-read each judged issue (`ngit issue view <id> --comments --history --json`), marking any that changed after gathering and what changed. Then a table of verdicts, failing rules, reasons and `Steering:` lines, and each comment in full. Nothing is published yet.
6. **Publish on the person's OK** (all, some or none), one issue at a time, a few seconds apart: write each comment to a file and run `bash <this skill's folder>/publish.sh [--recheck] <bundle> <file>` ([publish.sh](publish.sh)). It posts the comment, then the label its heading names; `--recheck` posts a re-check note (same verdict, same failing rules) with no label. If the issue changed after gathering it posts nothing (exit 3): show what's new, then re-judge or ask. A missing label goes up alone, once the person has seen who wrote its verdict: `ngit issue label <id> --label <label> --defaults --repo-relay-only`. If this account is neither the author nor a maintainer, publish nothing.
7. **Report** what was published, by short id, and what failed. A relay or ngit error stops that issue; never guess.

## Common mistakes

| Mistake | Instead |
|---|---|
| Judging the working tree | Judge the snapshot; a working tree holds someone's unfinished work |
| Counting the Evaluator's comments as activity, or anyone's marker comment as a verdict | A marker comment is a verdict only from a maintainer or this account |
| Reading signer settings or keys | Let ngit sign; never read `nostr.*` git config or a key |
