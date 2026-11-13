# Book of Work: The GitHub workflows pin what they run, limit their token, and name a deploy environment

**Slug:** workflow-hardening
**Status:** Open
**Opened:** 2026-11-13
**Closed:** —
**Gating:** **Human-gated.** Standard strictness, Bug lane. Architecture was skipped at intake as obvious, on the
owner's choice (2026-11-13). No Direction mode.

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask of 2026-11-13, "prepare the workflow hardening pull request". It
followed a check of this repo against the stolen-token campaign reported publicly as "wfx", which found no trace of
the campaign here. The ask was restated as the six bullets below and confirmed by the owner the same day. Completion
is *judged* against them.

### Acceptance frame

- [ ] Every action a workflow calls is pinned to a full commit.
- [ ] Every workflow declares what its token may do, and none can write to the repository's contents.
- [ ] Every job that reads a deploy secret names a GitHub environment: `tapestry`, `staging`, `tags`, `magic-carpet`
      or `ninja`.
- [ ] A test in `npm test` fails when a workflow breaks any of the three rules above.
- [ ] OPERATIONS.md says how to set up a deploy target's environment and how to move a pin.
- [ ] Deploys and the test gate behave as before. The settings work in GitHub (limiting each environment to its
      branch, moving the secrets in) stays with the owner and is not part of this book.

## What stays open

Known at opening, and outside this book:

- The owner's settings work: creating and limiting the environments, moving each target's secrets in, and removing
  the repository-level copies.
- Items 2 and 3 of [the repo-move ledger row](../../../ledger/2026-10-28-repo-move-follow-ups.md).

## Epics in this book
- `workflow-hardening` — story 1.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** *(filled by `/close-book`)*

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/workflow-hardening/audit.md`
- Product feedback: `engineering-team/audits/workflow-hardening/prd-seed.md`
