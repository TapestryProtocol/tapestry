# The appearance sweeps only ever see empty mocked data, and the class inventory misses classes built in code

**Id:** 2026-11-01-appearance-sweeps-empty-data
**Type:** meta
**Opened:** 2026-11-01 (appearance-setting #3, review 1)
**Status:** OPEN
**Done:** —

Story 3 of `appearance-setting` passed every one of its own tests while tag chips, tag-row scores, the `/tags` search
box's typed text and stale markers were unreadable in Light. Review 1 found two shared weaknesses:

- **Empty mocks.** The browser sweeps (story 2's L1, story 3's W1 and W2) mock every `/api` read with empty
  collections. The pieces that only appear with data (chips, scored rows, results, notices) never render, so they're
  never measured.
- **A regex class inventory.** The inventory that tells the Node checks (T2/T4, K1/K2) which rules belong to a page
  family reads `className` strings with a regex. It misses classes built in nested templates, held in variables, or
  chosen inside `${…}`, so those rules escape both the conversion and the checks.

Fix shape:
- Give each sweep populated fixtures for every piece that only shows with data.
- Collect any quoted token in the walked files that names a class the stylesheet defines, instead of parsing
  `className` expressions.
- When a story's acceptance criteria are about how pieces look, require a review probe with injected classes or real
  data before the PASS.

**Pointer:** `engineering-team/reviews/appearance-setting/3-light-look-working-pages.md` (Blocking 1, harness friction).
