# Epic: openapi-coverage — the API document covers the routes the server registers

**Created:** 2026-11-06
**Status:** Active
**Book:** `engineering-team/audits/openapi-coverage/book.md` (no PRD — acceptance frame)
**Provenance:** ngit issue `7a13648f` ("OpenAPI document (`/docs`): covers 171 of 374 routes, and Try it
out calls localhost", label `docs`).

## Goal

**`/docs` documents every route the server registers under `/api/`, and a test keeps it that way.**
Today the document lists 171 of the 387 distinct method-and-path routes, BIBLE §11 says it covers "all
REST endpoints", and nothing stops a new route landing undocumented.

The first story adds the coverage test with a gap list that can only shrink, and documents the first
area. Each later story documents one more area and takes its lines off the gap list.

## Stories

`stories/openapi-coverage/`.

1. `1-coverage-test-and-normalize-docs.md`: the coverage suite and gap list, the 20 undocumented
   `/api/normalize/*` routes, `servers: /`, the contact link, and BIBLE §11's `/docs` line. Bug.

Later areas, largest first (counts of undocumented routes from the 2026-11-06 walk): `/api/tagging-edges`
(10), `/api/profile-tags` (9), `/api/brain` (8), `/api/concept` (6), and the rest of the gap list. Not
yet stories.

## Related

- `_intake.md` line 1795: the document's `save-element-json` entry says `required: [concept, element,
  json]`, but the handler needs `uuid`. A documented route, so not on the gap list; left to its own
  entry.
- Loom: no task or open proposal covers the API document (checked 2026-11-06).
