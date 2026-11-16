# On a stack seeded to staging's shape, a second firmware install changed nostr relay's schema and moved two supersets, for a reason not yet known

**Id:** 2026-11-16-seeded-second-install-differs
**Type:** bug
**Opened:** 2026-11-16 (story graph-operations-foundation #10's review, non-blocking finding 6)
**Status:** OPEN
**Done:** —

**What was seen.** Story 8 seeded a scratch stack to staging's shape with `test/helpers/seedStagingShape.js`: 3.85 million nodes. Its second firmware install (2026-11-15) left a graph that differed from the first install's in two ways. Neither has a known cause:
- **The TA's own nostr relay schema**, `39999:<TA>:nostr-relay-schema`, came out with a different json tag. Pass 2 didn't fail for nostr relay there, and no firmware enumeration targets it. An install writes a schema's json tag in two places: Pass 1, whose create-concept lays down the starter, and the schema save, from Pass 2 and apply-enumerations.
- **`tagging-with-specific-tag-superset` and `tapestry-superset` moved** between the HAS_ELEMENT targets of `set-superset` and `superset-superset`.

The other differences that install showed were the five tag concepts' failed saves, row `2026-11-15-save-schema-finds-header-by-name`, which story 10 fixed.

**Where it wasn't seen.** On fresh scratch stacks, neither has appeared:
- with the code before story 10, in story 8's review (`engineering-team/reviews/graph-operations-foundation/8-pass-3-finishes-in-minutes.md:117`);
- with story 10's fix, in four installs on two stacks (story 10's test plan, Verification).

So it may need the seeded shape, or the history of that stack's installs. It hasn't been tried on a seeded stack since story 10's fix.

**What would settle it.**
1. Seed a fresh scratch stack (`TAPESTRY_CONTAINER=tapestry-scratch node test/helpers/seedStagingShape.js`).
2. Run story 10's L2 there: `TAPESTRY_CONTAINER=tapestry-scratch SCHEMA_SAVE_INSTALL=1 node test/schema-save-finds-the-right-header.test.js`. It needs a log showing one install, so seed before any other install. L2 prints every difference between the two installs, nostr relay's schema among them.
3. If either difference recurs:
   - for nostr relay, compare its json tags;
   - for the supersets, compare each run of `wire-implicit-elements` (`POST /api/normalize/wire-implicit-elements`, whose log names what it wired and pruned).

One lead from reading the code: before wiring an element, wire-implicit-elements checks for an existing path through `IS_A_SUPERSET_OF|HAS_ELEMENT` edges (`src/api/normalize/index.js`, `handleWireImplicitElements`). So what it wires can depend on what is already wired.

**Pointer:** story 10's test plan (`engineering-team/stories/graph-operations-foundation/10-schema-save-finds-the-right-header.test-plan.md`, Verification, after the fix); story 8's test plan, Amendment 1.
