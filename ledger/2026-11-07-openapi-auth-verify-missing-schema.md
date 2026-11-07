# Two Auth entries in the API document point at a schema that doesn't exist, so /docs shows a resolver error when either is opened

**Id:** 2026-11-07-openapi-auth-verify-missing-schema
**Type:** docs
**Opened:** 2026-11-07 (openapi-coverage #1, review)
**Status:** OPEN
**Done:** —

`src/api/openapi.yaml:104` and `:151` (two Auth entries) answer with `$ref: '#/components/schemas/AuthVerifyResponse'`,
and `components.schemas` has no `AuthVerifyResponse`. Swagger resolves an entry's references only when it is
opened, so `/docs` loads cleanly and shows "Resolver error … Could not resolve reference" only once someone opens
one of the two. It predates openapi-coverage #1. Neither suite catches it: the coverage gate compares routes, and
the browser spec opens only the 20 normalize entries.

Fix shape: define `AuthVerifyResponse` from what the two handlers send (or inline the answer), and consider a
stack-free check that every `$ref` in the document resolves, which would catch this whole class of error.

**Pointer:** `engineering-team/reviews/done/openapi-coverage/1-coverage-test-and-normalize-docs.md` § Findings, non-blocking 7
