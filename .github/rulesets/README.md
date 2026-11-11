# Repository rulesets

GitHub keeps a repository's rulesets in its settings, not in its files, so a repo that moves to a new owner can lose
them. This one had none after the move of 2026-10-23. The JSON files here are the definitions, kept so they can be
recreated. **Nothing reads or applies them**: the live rulesets are in Settings, Rules, Rulesets, and that is what
GitHub enforces. When a live ruleset changes, change its file in the same PR.

| File | What it enforces |
|---|---|
| `restrict-deletions.json` | `main`, `staging`, `feature-magic-carpet`, `feat/tags`: no deletion and no force-push. |
| `main-requires-pr-before-merging.json` | The default branch (`main`): changes only by pull request (0 approving reviews), with the `stack-free` and `main-source-guard` checks passing. No bypass actors. |

`staging` has no pull-request or check rule on purpose: it permits direct pushes, and making `stack-free` required there
is a separate operator decision (OPERATIONS.md, §4).

The files come from the rulesets of the old repo, `nous-clawds4/tapestry` (ids 15863292 and 15536440), read from its
public API on 2026-11-11. One difference: `restrict-deletions` adds `feat/tags`, a live deploy branch (OPEN.md row 14),
and drops `feature-relay-discovery` and `feature-tapestry-discovery`, which no longer exist.

## Apply

Creating a ruleset needs admin on the repository. As an org owner or repo admin (`gh auth status` shows which login
you are), from the repository root:

```bash
gh api -X POST repos/TapestryProtocol/tapestry/rulesets --input .github/rulesets/restrict-deletions.json
```

```bash
gh api -X POST repos/TapestryProtocol/tapestry/rulesets --input .github/rulesets/main-requires-pr-before-merging.json
```

To change one that already exists, find its id with `gh api repos/TapestryProtocol/tapestry/rulesets --jq '.[] | {id,name}'`
and send the file with `-X PUT repos/TapestryProtocol/tapestry/rulesets/<id>`. In the web UI, "Import a ruleset" reads
the same files.

`integration_id: 15368` in the required checks is the GitHub Actions app, the same on every repository.
