# remove-from-concept's author-claim refusal says a reinstall or the next import makes an `n` claim again, but only the next pull of the author's class thread does

**Id:** 2026-11-18-author-claim-words-misname-n-remaker
**Type:** bug
**Opened:** 2026-11-18 (story graph-operations-first-slice #23, ADR graph-operations-first-slice/0023 Context 4 and Consequences 2)
**Status:** OPEN
**Done:** —

`M.say.authorClaim` (`src/operations/catalog/graph/_memberships.js:108–110`), which `graph remove-from-concept` uses for its `author-claim` refusal, says of every claim that "a firmware reinstall, or the next import of their letter, would make the membership again". The `author-claim` declaration's `when` (`:60`) says "the next import would make again", and `authorClaim`'s comment (`:472–477`) names "Pass 1d, wire-implicit-elements or the next import".

That holds for a `z` claim: a reinstall's pass 1d links a concept's superset to each node whose `z` names its header (`src/firmware/install.js:678–685`). It doesn't hold for an `n` claim:
- no reinstall pass reads an `n` tag;
- the import doesn't either: `buildImportCypher` (`src/api/neo4j/eventSync.js:198`) links only from `e`, `a` and `b` tags;
- the Phase B pull of a curator's class thread does (`src/api/concept/pullClassThread.js:9–17`, `:258`): for each of the curator's own events whose `n` names one of the curator's sets, it makes the set's `HAS_ELEMENT` to it.

So for an `n` claim the words should name the next pull of the author's class thread. `graph move-element` words its own `author-claim` refusal that way (`src/operations/catalog/graph/move-element.js`, `say.authorClaim`), so only remove-from-concept's answer is off. The refusal is right; only what it says remakes the link is wrong.

The fix shape: `M.say.authorClaim` words the remaker by `claim.tag`, as move-element's does, and the `when` and the comment follow. A test of remove-from-concept's `n` refusal (story 22's suite) pins the new words.

**Pointer:** ADR graph-operations-first-slice/0023 (Context 4, Consequences 2); `engineering-team/stories/graph-operations-first-slice/23-move-element.md`.
