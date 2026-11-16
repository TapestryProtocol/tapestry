# One node whose name or tapestryValue isn't text would fail every `graph resolve` by name or slug

**Id:** 2026-11-16-resolve-tolower-non-text-name
**Type:** bug
**Opened:** 2026-11-16 (story graph-operations-first-slice #9, graph resolve, A10.9; its review, non-blocking 7). Latent: no such node is known.
**Status:** OPEN
**Done:** —

**What was seen.** Family N's match tests `toLower(coalesce(n.tapestryValue, n.name)) = toLower($name)` over every keyed `TapestryNode` (`src/operations/resolve.js:149`). Statement T tests `toLower(t.value1)` over every `names` tag (`:184`). Neo4j 5's `toLower` fails on a value that isn't a string. So a single node whose `name` or `tapestryValue` is a number, a list or a map would make every lookup by name or slug fail with a 500, for every ref.

Why nothing breaks today:
- **The agent-memory instance has none.** A read-only count on 2026-11-16 found 9,549 nodes, 450 named, and none with a `tapestryValue`.
- **The writers write text.** The two writers of `tapestryValue` both store the name (`src/operations/catalog/graph/_eventless.js:65`, `_concepts.js:685`), and an imported event's names come from its tags. Only raw Cypher could make such a node.

**Fix shape.** Guard both tests with a type check, such as `coalesce(n.tapestryValue, n.name) IS :: STRING AND toLower(…) = toLower($name)`, so that a node with a name that isn't text is never a candidate rather than breaking every read. RV5 can seed one such node.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/9-resolve.md` (non-blocking 7); story 9's Evidence, "Found along the way".
