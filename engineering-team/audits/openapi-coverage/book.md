# Book of Work: OpenAPI coverage — `/docs` says what it covers, and Try it out calls this instance

**Slug:** openapi-coverage
**Status:** Open
**Opened:** 2026-11-06
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD).** The book answers ngit issue `7a13648f` ("OpenAPI document (`/docs`): covers
171 of 374 routes, and Try it out calls localhost", label `docs`, kind 1621 event
`7a13648f9c4c5611a5ba21b9d5e4b6d18a69fe2551b7dfb6fd25c992b236cf8d`, signed with the Zeus key). The session
that started this one relayed the issue as the task on 2026-11-06, with the instruction to run it through
the harness and stop at every gate. The frame below restates the issue's "How to check" in drafting; it is
not the owner's wording, and it becomes the definition of done once the owner confirms it at the planning
gate.

One count differs from the issue. The issue counted routes with a text search for `app.<method>('/api/…')`
and expected 183 gaps after this book. The router walk the issue asks the suite to use finds 13 more
routes, registered through a path constant or a loop, and the search also counted one commented-out line.
So the gap list holds **196** entries here, not 183. Story 1 § Background has the detail.

### Acceptance frame

- [ ] `/docs` documents the 20 undocumented `/api/normalize/*` routes, each with its body, its answers and
      who may call it.
- [ ] Try it out on `/docs` calls the instance that serves the page, shown on a scratch stack with
      `GET /api/normalize/node-primitives`.
- [ ] The document's contact link is the team's ngit repository on gitworkshop.dev.
- [ ] A stack-free suite, `test/openapi-coverage.test.js`, compares the routes the server registers with
      the document and a shrink-only gap list, `test/fixtures/openapi-known-gaps.json`, and fails on an
      undocumented route that isn't listed, on a listed route that is now documented, and on a documented
      route the server doesn't register. `node test/openapi-coverage.test.js` runs it on its own.
- [ ] The gap list holds 196 entries, none under `/api/normalize`.
- [ ] BIBLE §11 says what `/docs` covers today, naming the suite and the gap list.

Shipping (pushing to ngit or GitHub, staging, production) and any comment on the ngit issue are outside
this frame and wait for the owner's OK.

## Epics in this book
- `openapi-coverage` — the API document's coverage test and gap list, and the first area documented
  (`/api/normalize`).

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/openapi-coverage/audit.md`
- Product feedback: `engineering-team/audits/openapi-coverage/prd-seed.md`
