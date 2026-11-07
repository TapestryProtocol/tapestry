# PRD Seed: Tapestry's API document (`/docs`)

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/openapi-coverage/audit.md`
**Anchor:** acceptance frame in `book.md` (from ngit issue `7a13648f`'s checks for done)
**Confidence:** high for what shipped; low for the product questions in §7, which no one has decided
**Date:** 2026-11-07

> A reverse-engineered baseline in the product-team PRD shape, built from what shipped. A strawman for the product
> team, not a ratified spec. Tags: `[FROM FRAME]` (the kickoff acceptance frame), `[INFERRED]` (read off the as-built
> system), `[UNKNOWN — product input needed]`.

## 1. Product vision

`[INFERRED]` Every Tapestry instance describes its own HTTP API at `/docs`, truthfully: it says which routes it covers,
lets a reader try a request against that same instance, and a test stops the description from falling behind the code.

`[UNKNOWN — product input needed]` Whether `/docs` is meant to become complete (every route), or a curated public
surface (the routes outside builders should use), with the rest internal. The as-built answer is "complete, area by
area", inherited from the issue.

## 2. Personas

`[INFERRED]` from the story's "As a …" lines:
- **A builder against an instance** — a developer, or their AI agent, reading `/docs` on a hosted Tapestry to call it.
  Needs the request body, the answers (including the named refusals most write routes return as HTTP 200), and who may
  call each route.
- **A maintainer adding a route** — needs the test gate to say, by name, that the new route has no entry.

`[UNKNOWN]` Whether the instance owner is a reader of `/docs` too (e.g. to drive their own instance from Try it out).

## 3. Scope (as-built)

`[FROM FRAME]`
- `/docs` documents the registered `/api/` routes except 196 recorded gaps; the 20 `/api/normalize/*` routes that were
  missing are now documented.
- Try it out calls the instance serving the page (`servers: /`), with the visitor's session; writes are real.
- The contact link is the team's ngit repository.
- A stack-free suite fails on an undocumented unlisted route, a listed route now documented, a documented route the
  server doesn't register, and a stale or doubled gap line; the gap list can't grow (ceiling 196).
- BIBLE §11 says what `/docs` covers.

## 4. Domain model

`[INFERRED]`
- **Registered route:** a method and a path the server dispatches (the router walk, plus the entrypoint's own).
- **Documented entry:** a method under a path in `src/api/openapi.yaml`. `:param`, `{param}` and `*` are one segment.
- **Known gap:** a registered route with no entry, recorded as one `"METHOD /path"` line. The list only shrinks; its
  ceiling is lowered as areas are documented.
- **Who may call:** the route table's access (`src/middleware/routeAccess.js`) plus any check in the handler.

## 5. Design rules (as-built)

`[INFERRED]` from the new entries and the reviews:
- Each entry says who may call it in one sentence naming the route table, with 401 and 403 for owner actions.
- A route that refuses with HTTP 200 and `success: false` lists its refusal names in the 200 schema's `refusal` enum,
  and says when it answers `success: false` with only an `error`.
- Shared answers live in `components` (responses and schemas); the older entries still inline theirs.
- No rule was ever recorded for: summaries' tone, examples, operationIds, or tags beyond the existing groups.

## 6. Carry-forward & open questions

Promoted from the build audit §6:
1. The other 196 routes, one area per story, largest first: `/api/tagging-edges`, `/api/list-headers`,
   `/api/profile-tags`, `/api/brain`, `/api/concept`, `/api/dictionaries`, `/api/trusted-list`, `/api/assistant`.
2. An exact ceiling check, and a check that every `$ref` resolves (two Auth entries are broken today).
3. BIBLE §11's API table versus the document: which is the source of the other.
4. Generating the document from the code.
5. The content of the 171 older entries, which no test checks.

## 7. What product must validate

- [ ] Complete versus curated: should `/docs` aim at every route, or only the routes outside builders should use?
- [ ] Try it out on a hosted instance sends real writes with the visitor's session. Is that wanted on every
      deployment, or should some instances serve `/docs` read-only, or not at all?
- [ ] Should `/docs` stay public on every instance (it is mounted before the auth middleware)?
- [ ] Is the API document or BIBLE §11's table the source of truth, and should one be generated from the other or
      from the code?
- [ ] Order of the remaining areas: by size (as listed), or by what builders and agents ask for first.
