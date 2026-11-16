# A firmware install leaves most nodes' cached Tapestry JSON behind the graph it just made, because Pass 3 rebuilds before its own last steps

**Id:** 2026-11-16-install-caches-lag-its-own-graph
**Type:** bug
**Opened:** 2026-11-16 (story graph-operations-foundation #10's scratch-stack runs, AC5)
**Status:** OPEN
**Done:** —

**What was seen.** Story 10's fix was run on two fresh scratch stacks (`agent-memory-tapestry:latest` with the fix's `src/`, 2026-11-15/16). Each comparison used story 8's instance-independent snapshot (`test/helpers/pass3Snapshot.js`).

- **A rebuild right after an install changes most of the cache.** Running `derive-all` of the seven labels right after an install changed 442 of the firmware's nodes' cached Tapestry JSON after a first install, and 439 after a later one. Nothing else changed: every JSON schema's json tag and every superset's HAS_ELEMENT targets came out the same.
- **Installs agree with each other, and rebuilds agree with each other.** A second and a third install leave identical caches. So does an install that follows a rebuild. A rebuild after any of them lands on the same state.
- **A first install differs from later ones in nine nodes.** They are the TA's supersets of tag, nostr user tag, tag pinning, nostr relay, set and word, and the supersets of tag, nostr user tag and tag pinning under ADR 0015's literal pubkey.

**The code.** Pass 3 rebuilds each label's cache first: 3a, `src/firmware/install.js:1198–1215`. Then it applies enumerations (3b, `:1217`), wires implicit elements (3c, `:1226`), and adds the community-reference edges, REFERENCES and IS_A_SUPERSET_OF (`:1238–`). Nothing rebuilds what 3b–3d change.

- **Why later installs lag too** (inferred from the code; no cached entry's contents were compared). Each install's Pass 2 saves the firmware's schemas, which carry no enumerated values. So every install's 3a reads the schemas before 3b puts the values back.
- **Why the first install differs in nine nodes.** The community-reference edges stay through an install. So the first install's 3a runs before they exist, and every later install's 3a sees them.

**Effect.** After any firmware install, a reader of the cache (`GET /api/tapestry-key/:key`, and whatever reads a node's Tapestry JSON) sees it as it was before enumerations, implicit elements and community-reference edges, until something rebuilds it. A first install and a second also leave different caches for the nine. Story 8's test plan met the same order (Amendment 1), which is why its L5b compares only after a rebuild.

**Fix shape.** Rebuild after 3b–3d, not before them: move 3a after them, or rebuild again at the end of Pass 3. Story 8 made a rebuild take seconds, so either is cheap. Check that a rebuild right after an install then changes nothing.

**Not this row.** On its seeded stack, after a second install, story 8 also found two things differing from its baseline: nostr relay's schema, and where `tagging-with-specific-tag-superset` and `tapestry-superset` sat among the elements of `set-superset` and `superset-superset`. Neither appears on a fresh stack, before story 10's fix or after it. Those two are row `2026-11-16-seeded-second-install-differs`.

**Pointer:** `engineering-team/stories/graph-operations-foundation/10-schema-save-finds-the-right-header.test-plan.md` (Verification, after the fix); `src/firmware/install.js:1198–1259`.
