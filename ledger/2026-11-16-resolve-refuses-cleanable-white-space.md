# `graph resolve` refuses a tab, a line break or a U+FEFF inside a ref, which create-concept cleans out of a name

**Id:** 2026-11-16-resolve-refuses-cleanable-white-space
**Type:** cleanup
**Opened:** 2026-11-16 (story graph-operations-first-slice #9, graph resolve, A10.9; its review, non-blocking 6)
**Status:** OPEN
**Done:** —

**What was seen.** `readingsOf` (`src/operations/resolve.js:118–122`) trims the ref, checks it with `textProblem`, and cleans it only after that, as ADR graph-operations-first-slice/0009 Decision 1 (line 149) orders it. create-concept cleans a name first and checks after (`src/operations/catalog/graph/_concepts.js:113–114`). Probed at review:

| Input | resolve | create-concept |
|---|---|---|
| `live\tdog` | `bad-ref`, U+0009 | `live dog` |
| `live\ndog` | `bad-ref`, U+000A | `live dog` |
| `live` U+FEFF `dog` | `bad-ref`, U+FEFF | `live dog` |
| a leading U+FEFF, or a no-break space | cleaned | cleaned |

So text that create-concept accepts as `live dog` can't be resolved. This holds AC1's "ignoring … extra white space" and AC5's "the characters create-concept refuses in a name" only partly. The refusal is clear and names the character, so no answer is wrong.

**Fix shape.** The owner's call:
- **(a) Change the order.** In the name family, clean before checking, as create-concept does. That takes an amendment to ADR 0009 Decision 1, and RS6 and RV17 change with it.
- **(b) Keep the order,** and say in story 9's terms that resolve refuses every control character, white space included.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/9-resolve.md` (non-blocking 6).
