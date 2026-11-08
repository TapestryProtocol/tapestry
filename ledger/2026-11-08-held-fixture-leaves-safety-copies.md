# The held-removals fixture leaves a safety-copy file behind on every confirmed run

**Id:** 2026-11-08-held-fixture-leaves-safety-copies
**Type:** bug (low; fixture data only, served by no route)
**Opened:** 2026-11-08 (tagging-edges #7, staging evidence)
**Status:** OPEN
**Done:** —

`scripts/tagging-edges-held-fixture.js` gives each fixture `TAGS` relationship an `evidence` property naming its run.
That key is outside the pass's nine, so a pass that removes the relationships first appends a pre-image of each to
`<stateDir>/preimages/<runId>.jsonl` (ADR tagging-edges/0002 § "The guard", step 1). ADR 0007 § Evidence did not
foresee it, and `cleanup` removes only the nodes and their relationships.

Left so far, each holding only fixture addresses (both ends `"null"`, since the fixture nodes carry no pubkey):
- staging: `preimages/20261108T190824Z-6840eed1.jsonl`, 834 lines;
- the local stack: three files of 802 lines, from runs `l1` to `l3` on 2026-11-07.

No route serves these files, and ADR 0002 leaves pruning them to the owner. So the files on staging and on the local
stack stay until the owner decides.

Fix shape: drop `evidence` from the fixture relationships, since the address already names the run
(`tagging-edges-7-<run>-<i>`). Then a confirmed run writes no safety copy. This needs three changes:
- the script's create Cypher (`scripts/tagging-edges-held-fixture.js:51`);
- a new pin in `test/tagging-edges-held-fixture.test.js` that the relationship carries only `address`. Today no test
  names its properties (HF8 checks only the labels);
- a dated note on ADR 0007 § Evidence, whose fixture bullet names `evidence: run`.

**Pointer:** `engineering-team/stories/done/tagging-edges/7-confirm-held-removals.md` § Evidence, "Staging", "What the
counts left"
