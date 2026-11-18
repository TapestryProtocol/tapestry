# `test/operations.test.js`'s W1, X1 and X2 fail in an agent worktree with no `node_modules` folder, though every module resolves there

**Id:** 2026-11-16-route-walk-needs-node-modules
**Type:** meta
**Opened:** 2026-11-16 (graph-operations-first-slice #28, Loom A10.28: implementation)
**Status:** OPEN
**Done:** —

**What was seen.**
- **How modules resolve in a worktree.** A worktree under `.claude/worktrees/<name>/` has no `node_modules` of its own. Node resolves every `require` by walking up to the parent checkout's, so the stack-free suites run there as they are.
- **Where that breaks.** `test/helpers/routeWalk.js:78` loads express by absolute path, `require(path.join(ROOT, 'node_modules/express'))`, so in such a worktree it throws.
- **What fails.** In `node test/operations.test.js` that fails W1, and X1 and X2 too, which copy the tree to a temporary folder that has no `node_modules` either: 390 passed, 3 failed. With a `node_modules` link in place, the same run passed 393 of 393 (A10.28, 2026-11-15).
- **The same path elsewhere.** The admin-action sweep and the openapi-coverage gates load it the same way, so they can't run in such a worktree at all.
- **The risk.** An agent can read the three failures as its change's fault. Or it adds a `node_modules` symlink, which the `.gitignore` entry `node_modules/` doesn't ignore, since that pattern matches only a directory, so `git add -A` would commit it.

**Fix shape.** Load express as the other modules are loaded, `require('express')` resolved from the tree (`require.resolve('express', { paths: [ROOT] })`), so a worktree passes as the parent checkout does. Or ignore `node_modules` with no trailing slash, so a link is ignored too.

**Seen again, 2026-11-17 (story `graph-operations-first-slice` #18, Loom A10.18, implementation).** The scoped gate for an operations change, through the gate engine, failed 13 tests across `operations`, `openapi-coverage`, `admin-action-sweep` and `schema-save-finds-the-right-header`, every one on the route walker's `Cannot find module …/node_modules/express` (record `20261118T020059Z-33339-696e`). With the main checkout's `node_modules` linked in, the same five passed 1,014 of 1,014 (record `20261118T020710Z-36534-d02d`). The link showed as `?? node_modules`, as ledger row `2026-11-16-worktree-node-modules-link-untracked` says, and the commits named every path.

**Pointer:** `test/helpers/routeWalk.js:78`; `test/operations.test.js` (W1, X1, X2); `.gitignore:41`.
