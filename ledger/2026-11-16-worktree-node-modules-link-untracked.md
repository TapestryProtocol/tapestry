# A worktree's `node_modules` link shows as untracked, because `.gitignore` ignores only a directory of that name

**Id:** 2026-11-16-worktree-node-modules-link-untracked
**Type:** meta
**Opened:** 2026-11-16 (graph-operations-first-slice #11 review, Harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The practice.** A worktree under `.claude/worktrees/` needs `node_modules` to run the stack-free suites, and the sessions link the main checkout's into it. Story 16's worktree had that link, and story 11's got one so its suites could run. OPEN.md row 27 also mentions the practice.
- **The pattern.** `.gitignore:41` is `node_modules/`, and a pattern ending in `/` matches only a directory. A symbolic link is a file to git, so `git status` lists it as `?? node_modules` in every such worktree.
- **The risk.** A `git add -A` or `git add .` would commit the link, which points at one machine's absolute path. Story 11's commits named every path to stay clear of it.

**Fix shape.** Make the line `node_modules` (no trailing slash), which ignores the link as well as the directory, or add `/node_modules` beside it. Check that nothing tracked is named `node_modules` first.

**Pointer:** `.gitignore:41`; `engineering-team/reviews/graph-operations-first-slice/11-list-elements.md` (Harness friction 1).
