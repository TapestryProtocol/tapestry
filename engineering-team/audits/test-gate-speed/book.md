# Book of Work: The stack-free gate gives the same verdict in half the time

**Slug:** test-gate-speed
**Status:** Open
**Opened:** 2026-11-21
**Closed:** —
**Strictness:** Standard. All five phases: a Refactor, with Architecture and Test Design, because it changes the gate
engine or the CI job under ADR `test-hermeticity-ci/0001`.

## Intent anchor

**Acceptance frame (no PRD).** The ask is the intake entry of 2026-11-21 ("The stack-free gate runs one suite at a time,
and each operations story adds about a minute and a half to every pull request"), after the owner's choice the same
day to raise the CI job's limit to 40 minutes first and make the gate faster after that. Restated at planning, and
confirmed by David on 2026-11-21 with two answers: the target is half the time, not a third; and the full gate may run
on his Mac inside a throwaway Linux container with networking switched off, for the story's measurement and its
stability runs.

### Acceptance frame

- [ ] **Half the time:** on the same runner, the `stack-free` job takes at most half as long as it does today. On the
      slowest runner seen, that is under 12 minutes rather than 23.
- [ ] **The same verdict:** the same tests run and give the same counts, skips are still counted, and every guarantee
      the gate makes today still holds.
- [ ] **One check, no retries:** pull requests to `staging` and `main` still get one check named `stack-free`. `npm test`
      is still the one command, and nothing retries.
- [ ] **No new flakes:** the faster gate is shown stable before merge, and any flake it brings gets a ledger row and a
      fix at its root.
- [ ] **Done:** a PR to `staging`, from a branch cut from `origin/staging`, with CI's `stack-free` green and a review
      that passes. Merging it waits for David's yes.

## Epics in this book

- `test-gate-speed` (`epics/test-gate-speed.md`): the gate's speed, keeping its verdict. New epic opened for this book.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/test-gate-speed/audit.md`
- Product feedback: `engineering-team/audits/test-gate-speed/prd-seed.md`
