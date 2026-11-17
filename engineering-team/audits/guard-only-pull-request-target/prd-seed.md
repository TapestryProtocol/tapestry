# PRD Seed: Workflow trigger guard (`pull_request_target`)

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/guard-only-pull-request-target/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high. A single-story book, with an owner-confirmed frame and no product surface.
**Date:** 2026-11-17

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman for the product team*, not a ratified spec. Every section is tagged — `[FROM FRAME]` (grounded in the kickoff acceptance frame), `[INFERRED]` (read off the as-built system), or `[UNKNOWN — product input needed]`. The product team adopts this as the starting point for `/discover` on the next phase and validates each section. **Be honest about confidence:** a no-anchor reconstruction is a hypothesis, not ground truth — don't dress it up.

## 1. Product vision
`[FROM FRAME]` The repository's CI refuses any GitHub workflow that runs on `pull_request_target`, apart from the
main-source guard, unless a reviewed change allows it. GitHub's own default block on that event may no longer cover the
repo's other workflows, since the owner created an Actions policy that lets the guard keep running after 2026-12-02. So
the repo holds the line in its own files.

`[INFERRED]` Part of a wider aim already visible in OPERATIONS.md §18. What a workflow can reach is decided in reviewed
files, with tests behind them, rather than in repository settings that a move or a mistake can lose.

## 2. Personas
- `[INFERRED]` **Whoever reviews a change to `.github/workflows/`**, human or Claude. They see a red CI line, naming the
  file and the rule, instead of having to know the event's risk by heart.
- `[INFERRED]` **The owner,** who holds the Actions policy in GitHub's settings and decides any new exception.

## 3. Scope (as-built)
`[FROM FRAME]`
- The `EVENT` rule in `test/workflow-hardening.test.js`, with the allow list `PULL_REQUEST_TARGET_FILES`. Today it holds
  `guard-main-source.yml` alone.
- No false alarms from the guard, `pull_request`, or a mention of the event outside `on:`.
- The procedure in OPERATIONS.md §18.4, with pointers from §4 and `.github/rulesets/README.md`.
- On `staging` with CI green. It reaches `main` at the next promotion.

`[INFERRED]` Beyond the frame, R7 ties the list to the policy definitions in `.github/rulesets/` (audit §4 #1).

## 4. Domain model
`[INFERRED]` No concept-graph entities. The working parts:
- **A workflow file:** its name, and the events its `on:` names.
- **The allow list:** file names.
- **An Actions policy definition:** included and excluded paths, and allowed events.

They relate like this: a workflow on `pull_request_target` must be on the list, and every entry on the list must be named,
with the event allowed, by a definition.

## 5. Design rules (as-built)
`[INFERRED]` from OPERATIONS.md §18.4, following GitHub's guide "Securely using pull_request_target":
- a workflow on this event never runs a pull request's code;
- the guide's hardening applies to every workflow on the list;
- a new exception is the owner's decision, recorded in `.github/rulesets/` in the same pull request.

## 6. Carry-forward & open questions
Promoted from the audit's §6:
- R7 counts a disabled definition, or one that excludes the guard by wildcard, as covering it.
- No test pins §18.4's step 1 rule, "never run a pull request's code".
- Whether GitHub's default block still covers other workflows once a path-scoped policy exists is unknown. The rule makes
  it moot for this repo.
- GitHub's other privileged triggers (`workflow_run`, `issue_comment`) have no rule.

## 7. What product must validate
- [ ] `[UNKNOWN — product input needed]` Should the workflow rules grow to cover `workflow_run` and `issue_comment` too,
      or is `pull_request_target` the only trigger worth a CI rule here?
- [ ] `[INFERRED]` Is the owner the right sole decider for a new exception, or should a second reviewer sign off before
      a workflow joins the list?
