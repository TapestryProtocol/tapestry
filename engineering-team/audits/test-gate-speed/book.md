# Book of Work: The stack-free gate gives the same verdict in half the time

**Slug:** test-gate-speed
**Status:** Closed
**Opened:** 2026-11-21
**Closed:** 2026-11-22 (on the pull request's branch, before its merge: the frame's "Done" is the open pull request, green and reviewed)
**Shipped:** on `staging` 2026-11-22: TapestryProtocol/tapestry#201 merged as `5b135ccaa` at 14:53:27Z, 16 s after a safe answer from the safe-to-merge check. The staging deploy, run 45035265698, took 1 m 54 s. The smoke test was clean: stable after 3 polls, Neo4j answering after 3, every page and API 200, Odell's `get-user-data` the expected 504 JSON in 15.9 s, search 2 of 314 hits, and the bundle unchanged at `index-DAxhuweK.js`, since nothing served changed. On production 2026-11-22: promotion TapestryProtocol/tapestry#210, from `promote/test-gate-speed-2026-11-22` at the verified `ce98821ca`, merged as `4d426d4fa` at 15:31:52Z, 2 s after a safe answer from production's safe-to-merge check. Its required checks passed first (Test run 45038188164). Production deploy run 45038823220 took 1 m 51 s. The smoke test was clean: stable after 3 polls, Neo4j answering after 3, every page and API 200, Odell's `get-user-data` the expected 504 JSON in 16.7 s, search 2 of 384 hits, and the bundle unchanged at `index-DAxhuweK.js`.
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

- [x] **Half the time:** the `stack-free` verdict comes in at most half the time today's gate takes. On the slowest
      runner seen, that is under 12 minutes rather than 23. *(Restated 2026-11-21: one runner reached only about half,
      0.501 and 0.521 on two timings, so the owner chose to split the gate across two runners, each part at most half
      of today's whole gate on its own runner. See the story's Open questions, 3 and 4.)*
- [x] **The same verdict:** the same tests run and give the same counts, skips are still counted, and every guarantee
      the gate makes today still holds.
- [x] **One check, no retries:** pull requests to `staging` and `main` still get one check named `stack-free`. `npm test`
      is still the one command, and nothing retries.
- [x] **No new flakes:** the faster gate is shown stable before merge, and any flake it brings gets a ledger row and a
      fix at its root.
- [x] **Done:** a PR to `staging`, from a branch cut from `origin/staging`, with CI's `stack-free` green and a review
      that passes. Merging it waits for David's yes.

## Epics in this book

- `test-gate-speed` (`epics/test-gate-speed.md`): the gate's speed, keeping its verdict. New epic opened for this book.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** high. Every frame bullet is checked against named runs (audit §5).

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/test-gate-speed/audit.md`
- Product feedback: `engineering-team/audits/test-gate-speed/prd-seed.md`
