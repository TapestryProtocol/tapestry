# wire-implicit-elements takes out a concept's redundant direct links only when the run has wired something before it, so a reinstall's end state depends on the run

**Id:** 2026-11-16-wire-implicit-prune-depends-on-run
**Type:** bug
**Opened:** 2026-11-16 (story graph-operations-first-slice #20, ADR graph-operations-first-slice/0020 fact 9 and Consequences)
**Status:** OPEN
**Done:** —

`handleWireImplicitElements` (`src/api/normalize/index.js:5832`), which a firmware reinstall runs in pass 3, walks every concept. For each one, it wires the nodes whose `z` tag names the concept but that no class thread reaches, then takes out each direct link from the concept's superset that is also reached through a set (`prune`). But the prune is guarded by `prune && totalWired > 0` (`:5912`), and `totalWired` is one count for the whole run, not this concept's (`:5836`, `:5905`).

So whether a concept's redundant direct links go depends on whether any concept before it, in the order the run reads them, wired something. Each later concept is then pruned, and none before.

What it means for elements:

- An element in a set has a `z` tag naming its concept. Pass 1d links the concept's superset to it directly. That includes the elements `graph create-element` (A10.20) makes in a set (ADR 0020 Decision 10).
- For a firmware concept with a manifest, pass 1e takes that link out again. For any other concept, wire-implicit-elements may or may not, depending on the run.
- Either way the element belongs to the same concepts and sets, so no reader is wrong. But a reinstall's end state can't be stated, and two reinstalls of one graph can differ.

The fix shape: count each concept's wiring on its own (or prune whatever was wired), so a concept's redundant links go whenever it has some. Then check what the change does to the memberships story 16's Amendment 2 measured (its live check, L3).

**Pointer:** ADR graph-operations-first-slice/0020 (fact 9, Decision 10, Consequences); the story's live check, L4, in `engineering-team/stories/graph-operations-first-slice/20-create-element.test-plan.md`.
