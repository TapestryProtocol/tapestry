# Repository rulesets and the Actions policy

GitHub keeps a repository's rulesets and Actions policies in its settings, not in its files, so a repo that moves to a
new owner can lose them. This one had no rulesets after the move of 2026-10-23. The JSON files here are the
definitions, kept so they can be recreated. **Nothing reads or applies them**: the live rulesets are in Settings, Rules,
Rulesets, the live Actions policies are in Settings, Actions, Policies, and that is what GitHub enforces. When a live
ruleset or policy changes, change its file in the same PR.

| File | What it enforces |
|---|---|
| `restrict-deletions.json` | `main`, `staging`, `feature-magic-carpet`, `feat/tags`: no deletion and no force-push. |
| `main-requires-pr-before-merging.json` | The default branch (`main`): changes only by pull request (0 approving reviews), with the `stack-free` and `main-source-guard` checks passing. No bypass actors. |
| `allow-pull-request-target-for-main-source-guard.json` | An Actions policy, not a ruleset: `guard-main-source.yml`, found by its path, may run on `pull_request_target`, and on no other event. It covers no other workflow. From 2026-12-02 GitHub blocks that event without such a policy, and `main-source-guard` then never runs (OPERATIONS.md, §4). |

`staging` has no pull-request or check rule on purpose: it permits direct pushes, and making `stack-free` required there
is a separate operator decision (OPERATIONS.md, §4).

The files come from the rulesets of the old repo, `nous-clawds4/tapestry` (ids 15863292 and 15536440), read from its
public API on 2026-11-11. One difference: `restrict-deletions` adds `feat/tags`, a live deploy branch (OPEN.md row 14),
and drops `feature-relay-discovery` and `feature-tapestry-discovery`, which no longer exist.

The policy file is written from GitHub's REST reference for Actions policies (API version 2026-03-10), for the choice
recorded in `ledger/2026-11-16-main-guard-blocked-by-github-policy.md`.

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

An Actions policy needs admin too. In the web UI it is Settings, Actions, Policies. The API takes the file as it is:

```bash
gh api -X POST repos/TapestryProtocol/tapestry/actions/policies -H 'X-GitHub-Api-Version: 2026-03-10' --input .github/rulesets/allow-pull-request-target-for-main-source-guard.json
```

To change it, find its id. Without `has_parents=false` the list also shows the organization's policies, which change
through the organization's endpoint:

```bash
gh api 'repos/TapestryProtocol/tapestry/actions/policies?has_parents=false' -H 'X-GitHub-Api-Version: 2026-03-10' --jq '.policies[] | {id,name}'
```

Then send the file:

```bash
gh api -X PUT repos/TapestryProtocol/tapestry/actions/policies/<id> -H 'X-GitHub-Api-Version: 2026-03-10' --input .github/rulesets/allow-pull-request-target-for-main-source-guard.json
```

Keep its `workflow_path`. The rule lists the only events a workflow it covers may run on, so with no path it would
cover every workflow, and every other one would stop: the deploys, the image publisher, the test gate and the weekly
link checks. The path is also how it finds the guard. A PR that moves or renames `guard-main-source.yml` changes this
file and the live policy with it, and the policy lists both paths in `include` until the rename is on `main`, since
until then `main`'s copy at the old path is the one that runs. Then the old path comes out.

The policy says nothing about other workflows. GitHub's docs don't say whether its default block still applies to the
repository's other workflows once this policy exists, so a new `pull_request_target` workflow needs its own review
against GitHub's guide, and its own decision about the policy.
