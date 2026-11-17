# A concept named `__proto__` gets the key `__proto__`, which a JSON object built by assignment can't hold as a section

**Id:** 2026-11-17-concept-key-can-be-proto
**Type:** bug (low: nothing on any instance is known to have such a concept)
**Opened:** 2026-11-17 (story graph-operations-first-slice #21, graph update-node, review round 1's non-blocking 1)
**Status:** OPEN
**Done:** —

**What was seen.** `src/lib/conceptNames.js` gives a concept named `__proto__` the key `__proto__` (`toKeyName`, `:87`), and `nameProblem` (`:137`) finds nothing wrong with the name. So create-concept can make such a concept, and another author's header can carry the key too. Checked 2026-11-17 with `node -e`:
- `toKeyName('__proto__')` is `"__proto__"`, and `nameProblem('__proto__')` is `null`.
- `j[key] = section`, for that key, sets `j`'s prototype and leaves `j` with no own key, so `JSON.stringify(j)` drops the section.
- `JSON.parse` does make an own `__proto__` key, so a stored JSON can hold one.

**Where it bit.** update-node read `oldJson[key]`, found `Object.prototype` there, an object, and answered `updated` for a change it never stored. Review round 1 fixed that: update-node reads a section only by the JSON's own key (ADR graph-operations-first-slice/0021 Amendment 2, UN42). Other code that builds or reads an element's JSON by its concept's key hasn't been checked: create-element's builder, the field mapping, the derive step.

**Fix shape.** Either:
- `nameProblem` refuses a name whose key is `__proto__`, so no concept of this instance's own has it;
- or the readers and builders of an element's JSON take a section only by its own key, and write it with `Object.defineProperty` or a `Map`, so another author's header with that key reads as no section.

The first is one line, but it doesn't cover another author's header; the second does.

**Pointer:** `src/lib/conceptNames.js` (`toKeyName`, `nameProblem`); `engineering-team/reviews/graph-operations-first-slice/21-update-node.md` (non-blocking 1).
