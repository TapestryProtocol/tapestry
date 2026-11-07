# Story 1: The API docs say what they cover: a coverage test, the normalize routes, and Try it out on this instance

**Status:** Approved
**Created:** 2026-11-06
**Type:** Bug

## Background

Every instance serves a Swagger UI at `/docs`, built from the API document `src/api/openapi.yaml`. BIBLE
§11 (line 604) says it documents "all REST endpoints". It doesn't, and its Try it out button calls the
wrong place. This is ngit issue `7a13648f` (label `docs`); its text is the source for this story.

- **It covers 171 of 387 routes.** Walking the real router (the same walk the admin-action sweep uses)
  finds 388 registrations under `/api/`: 387 distinct method-and-path pairs, because
  `POST /api/firmware/install` is registered twice. The document lists 171 of them, and every one it
  lists is registered, so nothing in it is stale. 216 routes have no entry, 20 of them under
  `/api/normalize`.
- **The issue's count was 374 and 203.** It came from a text search for `app.<method>('/api/…')`, on the
  belief that no route has a computed path. 13 do: they register through a path constant or a loop
  (`/api/dictionaries/concepts/new`, `…/edit`, `…/resync`; `/api/dlist-curation/header`; nine under
  `/api/list-headers/me/:handle/…` and `/api/list-headers/my-assistant/:handle/…`). The search also
  counted one commented-out line (`POST /api/publish`, `src/api/index.js:185`). So once the 20 normalize
  routes are documented, the gap list holds **196** entries, where the issue expected 183.
- **Try it out calls localhost.** `servers` lists only `http://localhost:8080` and
  `http://localhost:7778`. On a hosted instance, Swagger sends each request to the visitor's own
  computer, not to the instance serving the page.
- **The contact link is stale.** `info.contact.url` is `https://github.com/nous-clawds4/tapestry`, a
  copy that is no longer the team's.
- **Nothing keeps it complete.** A few feature suites check their own routes' entries, but no test
  compares the document with what the server registers. A new route can land undocumented.

Who is affected: anyone building against a Tapestry instance from its `/docs` page, a developer or their
agent, and every maintainer adding a route.

## User-facing description

As someone building against a Tapestry instance, I want its `/docs` page to say truthfully what it
covers and to try requests against the instance I'm looking at, so that I can rely on what it tells me.

As a maintainer, I want a new route to fail the test gate until it is documented or recorded as a known
gap, so the document can't fall further behind.

## Acceptance criteria

- [ ] **AC1. The coverage suite runs on its own and passes.** Given this branch, when
      `node test/openapi-coverage.test.js` runs, then it prints a result for each of its tests, passes,
      and exits 0; when any of its tests fails, it exits non-zero. It needs no running instance and calls
      no container. It is in the test gate's registry, so `npm test` and CI run it too.
  - It counts the routes the server registers: the admin-action sweep's router walk, run in a child
    process, plus any route the entrypoint (`bin/control-panel.js`) registers under `/api/` itself
    (none today). It keeps only `/api/` routes, each method and path once.
  - `:param`, `{param}` and `*` read as the same path segment. A path key written in quotes in the
    document, single or double, counts like any other: today `'/api/settings/{keyPath}'` documents
    `DELETE /api/settings/*`.
- [ ] **AC2. It fails in each of these cases, naming each offending route as `METHOD /path`:**
  - (a) a registered route has no entry in the document and isn't on the gap list,
    `test/fixtures/openapi-known-gaps.json` (one `"METHOD /path"` string per route);
  - (b) a route on the gap list now has an entry, so the list can only shrink;
  - (c) the document lists a method and path the server doesn't register;
  - (d) the gap list names a route the server doesn't register, or names the same route twice.
    *(Added in drafting, not in the issue: without it, a removed route leaves a stale line behind.)*

  Shown in a throwaway copy, the way the admin-action sweep's AC6b shows its own failure, for at least
  (a), with a route added to `src/api/index.js` and no entry, and (b), with a documented route whose
  line is left on the gap list.
- [ ] **AC3. The 20 undocumented normalize routes are documented,** and taken off the gap list:
  `reconcile-primary-property`, `create-child-goal`, `update-goal-intent`, `create-resource`,
  `verify-resource`, `create-work-record`, `note-goal-idea`, `make-proposal`, `approve-proposal`,
  `skip-proposal`, `record-priority-signal`, `restore-brain`, `record-restore-drill`,
  `adoption-disposition`, `trusted-dictionary-snapshot`, `add-relationship`, `delete-relationship` and
  `add-subset` (all `POST`), and the probes `relationship-primitives` and `node-primitives` (`GET`).
  - Each entry gives its request body (the POSTs), its answers (the success answer and each error status
    its handler sends), and who may call it, as the route table and its handler decide. Today the route
    table makes the 18 POSTs owner actions (the owner, an admin or a direct-local caller; 401 signed
    out, 403 for anyone else) and the two probes public reads.
  - Where BIBLE §11 has a row (`add-relationship`, `delete-relationship`, `relationship-primitives`,
    `add-subset`, `node-primitives`), the entry agrees with it.
  - The gap list then holds 196 entries, none under `/api/normalize`.
- [ ] **AC4. Try it out calls the instance serving the page, and the contact names the team's
      repository.**
  - `servers` is a single entry, `url: /`. The document's description says that Try it out sends real
    requests to this instance with your session, so a write is a real write. *(The description line was
    added in drafting, not in the issue.)*
  - `info.contact.url` is
    `https://gitworkshop.dev/npub1zhma4lzxyjc7dvq2klux8hs62wm3je6jspcwclgcxlr6grquwfcq28ccgm/relay.ngit.dev/Tapestry`.
  - On a scratch stack (`scripts/scratch-stack.sh`), `/docs` loads the document with no errors on the
    page, shows the 20 normalize routes, and Try it out on `GET /api/normalize/node-primitives` gets its
    answer from the scratch instance.
- [ ] **AC5. BIBLE says what `/docs` covers.** BIBLE §11's "API Documentation" paragraph (line 604 today)
      no longer says "all REST endpoints". It says that `/docs` documents the registered routes that
      aren't on the gap list, and it names the coverage suite and the gap list.

## Concepts touched

None. The story changes the API's documentation and adds a test; no concept-graph data or concept
definition changes. (The normalize routes act on the graph, but only their documentation changes here.)

## Out of scope

- The other 196 undocumented routes: later stories in this epic, one area at a time, each shrinking the
  gap list.
- BIBLE §11's own API table, its "Base URL: `http://localhost:8080`" line, and which of the table and the
  document is the source for the other.
- Generating the document from the code.
- Checking the content of the 171 entries already there. The accuracy audit covers the 20 new entries
  only. (One known error, `save-element-json`'s `required` list, is `_intake.md` line 1795.)
- Checking, for every documented route, that what it says about who may call it matches the route table.

## Open questions

None. Both were settled at the planning gate (2026-11-06), when the owner chose "Approve as drafted":
the gap list holds 196 entries, and both additions (AC2 (d) and AC4's description line) stay.

## Linked artifacts
- ADR: none. Classified Bug at intake, and the design is fixed by the issue (the existing router walk, a
  shrink-only gap list), so Architecture is skipped under Standard; approved at the planning gate.
- Test plan: `engineering-team/stories/openapi-coverage/1-coverage-test-and-normalize-docs.test-plan.md`
  (suites `test/openapi-coverage.test.js`, `test/openapi-document.test.js`; browser spec
  `tests/brainstorm/openapi-docs.spec.js`)
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
