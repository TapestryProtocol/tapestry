# Build Audit: OpenAPI coverage — `/docs` says what it covers, and Try it out calls this instance

**Book:** `engineering-team/audits/openapi-coverage/book.md`
**Date:** 2026-11-07
**Branch / commit range:** `7a57b49bf..405ef89ef` on `feat/openapi-coverage` (ngit `staging` at `7a57b49bf` as base), plus this close commit
**Provenance:** Acceptance-frame (restated in drafting from ngit issue `7a13648f`'s checks for done, confirmed at the planning gate)
**Confidence:** high

> The as-built record. The book is closed on its feature branch, before the branch is pushed or merged: shipping
> (ngit and GitHub `staging`, then production) and resolving the ngit issue wait for the owner's OK. The close commit
> rides the same branch as the work, so the two cannot reach `staging` apart.

## 1. What shipped

- **A coverage gate for the API document.** `test/openapi-coverage.test.js` compares the routes the server registers
  under `/api/` (the admin-action sweep's router walk, plus any the entrypoint registers itself) with the document's
  method entries and a shrink-only gap list, and fails, naming each `METHOD /path`, on an undocumented unlisted route, a
  listed route now documented, a documented route the server doesn't register, and a stale or doubled list line. It
  reads quoted path keys like plain ones, runs on its own with `node`, and shows its own failure in a throwaway copy of
  the tree. — `stories/done/openapi-coverage/1-coverage-test-and-normalize-docs.md`
- **The gap list,** `test/fixtures/openapi-known-gaps.json`: 196 routes, none under `/api/normalize`, capped at 196
  (`GAP_CEILING`). — same story
- **The 20 undocumented `/api/normalize/*` routes documented** in `src/api/openapi.yaml`, from their handlers: body,
  200 answer with each named refusal, every error status, and who may call it. — same story
- **Try it out calls the instance serving the page** (`servers: /`), and the document says writes are real and where
  its coverage gaps are recorded. — same story
- **The contact link** is the team's ngit repository on gitworkshop.dev. — same story
- **BIBLE §11** says what `/docs` covers, naming the suite and the gap list. — same story

## 2. Epics & stories rolled up

### Epic: `openapi-coverage`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 coverage-test-and-normalize-docs | The coverage gate, the gap list, the 20 normalize entries, `servers: /`, the contact link, BIBLE §11 | Done | `reviews/done/openapi-coverage/1-coverage-test-and-normalize-docs.md` (PASS; round-2 addendum, PASS) |

Phases: story `4e147f890`, failing tests `8198c8ad4`, implementation `cb356a52b`, review `caacdfe46`, review fixes
`37d68b06c`, review addendum `405ef89ef`. No ADR: classified Bug at intake, and Architecture was skipped at the
planning gate because the issue fixed the design.

## 3. As-built inventory

- **User-facing:** `/docs` (Swagger UI, `bin/control-panel.js:314-320`, unchanged) now shows the 20 normalize routes
  under Normalize, offers one server, `/`, and its header says Try it out writes for real and where the gaps are
  recorded. No route, page or command was added or changed; the server's behaviour is unchanged.
- **Domain:** no concept, handle, schema or firmware change. No reinstall needed.
- **Data & contracts:** `src/api/openapi.yaml` gains 20 path entries, five `components.responses` (BadRequest,
  NotSignedIn, NotOwnerOrAdmin, NodesNotFound, ServerError) and five `components.schemas` (MissingNodes, NodeRef,
  RelationshipEdit, RelationshipRefusal, ProposalDecision). The 166 entries already there parse identical to the base.
- **Tests:** two stack-free suites in the gate's registry (`test/openapi-coverage.test.js`,
  `test/openapi-document.test.js`), a shared list of the 20 routes (`test/helpers/openapiNormalizeRoutes.js`), the gap
  list fixture, and an opt-in browser spec (`tests/brainstorm/openapi-docs.spec.js`, `OPENAPI_DOCS_SCRATCH=1`).
- **Counts on 2026-11-06:** the walk registers 388 routes under `/api/`, 387 distinct method-and-path pairs
  (`POST /api/firmware/install` twice); 191 are documented and 196 are on the gap list.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Issue's check: "The gap list holds 183 entries" | 196 entries | constraint-discovered | The issue counted with a text search for `app.<method>('/api/…')`; the router walk it asks the suite to use finds 13 more routes registered through a path constant or a loop, and the search counted one commented-out line (story § Background; approved at the planning gate) | None: the walk is now the one count | Tell the issue when it is resolved |
| 2 | Issue's three failure cases | A fourth: a stale or doubled gap-list line (AC2 d) | added-beyond-scope | Without it a removed route leaves a dead line (story AC2, marked "added in drafting"; approved at the planning gate) | None | — |
| 3 | `servers: /` | Plus a description line: Try it out sends real requests with your session | added-beyond-scope | A write from `/docs` is real once it targets the live instance (story AC4, marked; approved) | Visitors are warned | — |
| 4 | "the list can only shrink" (rule b) | Also a ceiling, `GAP_CEILING` = 196 (C6) | added-beyond-scope | Rule (b) alone lets a new route be listed instead of documented (test plan; approved at the Test Design gate) | New routes must be documented | Make it exact: §6 item 2 |
| 5 | One new suite | Two suites and an opt-in browser spec | interpretation | Content checks (who may call, body fields, statuses, BIBLE rows) kept apart from the coverage gate; the browser spec is AC4's live check (test plan) | None | — |
| 6 | AC4 asked only for the Try it out line | A "Coverage" paragraph in `info.description` too | added-beyond-scope | Keeps `/docs` as honest as BIBLE §11 (story § Deviations) | Visitors learn the document is partial | — |
| 7 | Each entry gives its answers | Shared components; refusals documented as HTTP 200 with a `refusal` enum | interpretation | Most of these handlers answer domain refusals as 200 with `success: false` (story § Deviations) | Clients key on `refusal` | — |
| 8 | Review PASS, non-blocking findings 1–4 | Fixed after the PASS (`37d68b06c`), re-checked in a round-2 addendum | added-beyond-scope | The owner chose "Fix them first" at the review gate | Entries now name the unnamed `success: false` answers, the snapshot's fallback, `proposalId`, the 401 body | — |
| 9 | Epic goal: "every route the server registers" | The epic closes Done with its one story | intentional-change | The epic was opened with one story; the remaining areas carry forward as new epics rather than holding this one open under a lint waiver (L2) | None | §6 item 1 |

**Undocumented work:** none. Every file in the diff traces to story #1, its test plan, its review, or this close.

## 5. Quality state at close

- **Test gate:** the full `npm test` was not run here: on this Mac it publishes test fixtures to public relays (the
  owner's standing rule), so the full gate is left to CI on the PR. No gate run record exists in this worktree, so
  there is no `gate:status` line to quote. Run over the final state, after the flip and the moves, with the stack-free
  runner: `test/openapi-coverage.test.js` 12 passed, 0 failed (D2's throwaway-copy demo ran);
  `test/openapi-document.test.js` 10 passed, 0 failed; `scripts/harness-lint.sh` clean.
- **At review:** 32 regression suites that read `openapi.yaml` or `BIBLE.md`, run through their exported `run()`:
  1319 passed, 3 failed, 24 skipped. The 3 are `router-stream-limit-on-connect` P1–P3, macOS `sed`, already OPEN.md
  row `2026-10-09-router-patch-sed-macos`. The browser spec passed 3/3 on a scratch stack three times (implementation,
  independent review, round 2).
- **Known open issues:** OPEN.md row `2026-11-07-openapi-auth-verify-missing-schema` (two Auth entries `$ref` a schema
  that doesn't exist; predates this book).
- **At ship (after the close):** CI on nousclawds4/tapestry#28 ran the full stack-free gate on this branch merged onto
  GitHub `staging`: both new suites passed, and the gate failed 1 of 6675 tests, `setup-alert-polish` S2. That test
  fails on GitHub `staging` alone, from the /reading views' `writeVerbs.js`, and passes on this branch without them;
  OPEN.md row `2026-11-07-reading-writeverbs-raw-publish`. The owner chose to ship with it.
- **Debt:** none logged by an ADR (there is none).

## 6. Carry-forward register

- [ ] **1. The other 196 routes,** one area per story, each taking its lines off the gap list and lowering
      `GAP_CEILING`. Largest first: `/api/tagging-edges` 10, `/api/list-headers` 9, `/api/profile-tags` 9, `/api/brain`
      8, `/api/concept` 6, `/api/dictionaries` 6, `/api/trusted-list` 6, `/api/assistant` 5. (story § Out of scope)
- [ ] **2. Make C6 exact** (`lines.length === GAP_CEILING`), so every documented area has to lower the ceiling and any
      growth shows as a raise in the diff. For the next story's Tester. (review, non-blocking 5)
- [ ] **3. M2's real-document half** runs only while `'/api/settings/{keyPath}'` is a quoted key. (review, non-blocking 6)
- [ ] **4. A check that every `$ref` in the document resolves,** and the broken `AuthVerifyResponse`. OPEN.md row
      `2026-11-07-openapi-auth-verify-missing-schema`. (review, non-blocking 7)
- [ ] **5. BIBLE §11's own API table,** its "Base URL: `http://localhost:8080`" line, and which of the table and the
      document is the source for the other. (story § Out of scope)
- [ ] **6. Generating the document from the code.** (story § Out of scope)
- [ ] **7. The content of the 171 older entries,** e.g. `save-element-json`'s `required` list (`_intake.md` line 1795).
      (story § Out of scope)
- [ ] **8. BIBLE's `**Last updated:**` header** has no entry for the §11 paragraph. Left alone: GitHub's `staging`
      (PR #9) rewrote the same line, so an edit here would only add a merge conflict. (review, non-blocking 8)
- [ ] **9. Shipping:** GitHub's `staging` is 10 commits ahead of ngit's (`/reading` views and PR #9's BIBLE sweep,
      which edits §11 near this paragraph); expect a small BIBLE merge. Then resolve ngit issue `7a13648f`, with a word
      on the corrected count (§4 #1). Both wait for the owner's OK.

## 7. Process findings (harness)

`scripts/harness-stats.sh` at retro time: 314 reviews decided, kick-back rate 0%, churn 3; books open 11 (this one
included), closed 90; cycle-time median 0d (274 of 339 stories matched). This book: one story, one review, PASS with a
post-PASS round on non-blocking findings, all phases on 2026-11-06/07.

| Finding | Source (journal / review / deviation / meta row) | Terminal state (commit `<sha>` · OPEN.md row <n> · declined: <reason>) |
|---|---|---|
| `scripts/scratch-stack.sh` run from a session scratchpad (`/private/tmp/…`) mounts an empty `src/`, because Docker Desktop doesn't share that path; the script then waits 7.5 minutes and says only "the scratch app did not come up in time". Ports to Direction mode, whose Tester uses the same oracle recipe. | Test Design (test plan § How to run, step 1) | OPEN.md row `2026-11-07-scratch-stack-unshared-path` (meta) |
| `test/stack-free-npm-test.test.js` G2 runs a live suite against whatever control panel answers, so on this Mac it reaches Grawk's instance; its G5 registry rule had to be checked by hand at Test Design and at review. | Test Design; review § Quality gates | Note added to OPEN.md row `2026-11-05-suite-probe-reaches-private-container` (same class: a suite that reaches the private instance) |
| The full `npm test` that workflows 4, 5 and 6 call for can't run on this Mac; touched-suite runs plus CI on the PR stood in again. | Implementation, review, this close | declined: already proposed for workflows 4/5 and the Implementer/Reviewer roles in nousclawds4/tapestry#10 (memory `full-npm-test-leaks-fixtures`); a second record would split it |
| The session that wrote the tests and code handed the review to a fresh Reviewer agent, which found four omissions in the new entries and a pre-existing broken `$ref` that the author's own checks missed. | Review | declined: workflow 5 already recommends an independent check; this book is one more data point, recorded here |
| The issue's route counts came from a text search and were wrong by 13; running the real mechanism (the router walk) at planning caught it before any work was built on 183. | Planning (story § Background) | declined: the new suite makes the walk the one count; nothing in the harness to change |
| The test-design oracle and its mutations caught three defects in the Tester's own tests (B1 sliced at its own heading, P3 read the header cell, P1 missed Swagger's lazy `$ref` resolution) before Implementation. | Test plan § Verification | declined: the oracle practice is already filed for the Tester role (nousclawds4/tapestry#10, memory `test-design-oracle`); the Swagger-specific gotcha lives in the spec and the plan |
| The review's "Harness friction" section: none new. | Review | declined: nothing to disposition |
