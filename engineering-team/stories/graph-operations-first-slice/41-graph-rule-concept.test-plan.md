# Test Plan: Story 41 — The graph rules as a concept on every instance, made from the rulebook

**Story:** `engineering-team/stories/graph-operations-first-slice/41-graph-rule-concept.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0041-graph-rule-concept.md` (with Amendment 1, written at this phase)
**Date:** 2026-11-15

Three suites, each stack-free in every run, CI included:

- **`test/graph-rules-builder.test.js` (GB, GF0, GP)** covers the script that makes the items, `src/firmware/graph-rules.js`. It feeds the script's three pure parts the real rulebook and rules, and small fixtures for every problem the ADR names.
- **`test/graph-rule-firmware.test.js` (GF, GL)** covers the concept's firmware files and the manifest entry, the BIBLE, and the live checks. The live checks run only against a scratch container.
- **`test/firmware-element-sync.test.js` (ES, IS)** covers the step that decides what a reinstall does with one element file, `planElement`, and what install.js uses to act on it.

Amendment 1 to the ADR pins the shapes these tests read. It covers the script's parts and their problems, `planElement`'s arguments and answers, finding the header by its address, and how the schema states Decision 2's values.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC1 — the concept is installed | GF1 its files, and no sets · GF2 its header's word block and names, no x-tapestry · GF3 the description, exactly · GF5 its manifest · GF6 the manifest entry, exactly, appended last · GF8 the changelog | `test/graph-rule-firmware.test.js` | unit (files) |
| AC1 | GL1 after an install, the concept with eight core nodes, as relationship-type has, listed by summaries as "graph rule" | `test/graph-rule-firmware.test.js` | live (scratch) |
| AC2 — one item per entry | GB2 six entries, numbered 1 to 6, no problem, entry 1 is `tapestry-key-unique` · GB3 each item's word block | `test/graph-rules-builder.test.js` | unit |
| AC2 | GF9 one element per rule, each valid against the schema · GF10 install names each by its rule's name · GF12 its word slugs are its own | `test/graph-rule-firmware.test.js` | unit (files) |
| AC2 | GP9 the format's problems · GP10 another heading isn't an entry | `test/graph-rules-builder.test.js` | unit (fixtures) |
| AC2 | GL1 six elements · GL2 each item at an address of the instance's own | `test/graph-rule-firmware.test.js` | live (scratch) |
| AC3 — what an item says | GB3 about, status, source · GB4 each field's text, dedented, and the other fields in alsoSays · GB5 the code's declaration, null for entry 1 · GB7 the file text and key order | `test/graph-rules-builder.test.js` | unit |
| AC3 | GP8 a bad Status or Kind · GP11 a letter rule is about events | `test/graph-rules-builder.test.js` | unit (fixtures) |
| AC3 | GF4 the schema's fields, types, enums and uniqueness · GF9 the items validate | `test/graph-rule-firmware.test.js` | unit (files) |
| AC3 | GL2 each item in the graph holds its file's JSON | `test/graph-rule-firmware.test.js` | live (scratch) |
| AC4 — made, not kept | GB6 the real inputs make exactly the committed files, and nothing else is in the folder · GB8 an edited entry, or rule declaration, changes that item only · GB9 `--check` answers 0 and writes nothing | `test/graph-rules-builder.test.js` | unit |
| AC4 | GP1 a rule file with no entry · GP2 a file the loader left out · GP3 an entry naming another or a missing code file · GP4 a code file the entry doesn't name · GP5 code but not enforced · GP6 refusal codes or statuses that differ · GP7 refuses against reports | `test/graph-rules-builder.test.js` | unit (fixtures) |
| AC5 — a reinstall brings an instance in line | ES2 to ES11 `planElement`'s four outcomes: create, unchanged, update, blocked | `test/firmware-element-sync.test.js` | unit |
| AC5 | IS1 install reads `updateElements` and calls `planElement`, and still creates through create-element · IS2 it re-signs through the helpers' `regenerateJson` · IS3 it reads with `runCypher` and finds the header by its address | `test/firmware-element-sync.test.js` | source |
| AC5 | GF6 every other concept in its old order · GF7 only graph-rule sets `updateElements` | `test/graph-rule-firmware.test.js` | unit (files) |
| AC5 | GL4 a second install with no change signs nothing new for the items | `test/graph-rule-firmware.test.js` | live (scratch, `GRAPH_RULE_INSTALL=1`) |
| AC5 | The live check below, steps 3 and 4: a changed entry, and a new one | manual, at Implementation | live (scratch) |
| AC2, AC3 (review round 1, ADR Amendment 2.2 and 2.3) | GP12 an unindented line after a field is a problem · GP13 a heading with a name in backticks that isn't an entry's · GP14 a field line outside any entry · GP15 a first sentence never ends at e.g. or i.e. | `test/graph-rules-builder.test.js` | unit (fixtures) |
| AC5 (review round 1, ADR Amendment 2.4) | IS4 to IS9: the real `pass1_bootstrap`, run in a child with its dependencies stubbed (`test/helpers/pass1bChild.js`). It covers create, unchanged, re-sign, another author's, a failed lookup, the header by address, and every other concept as before | `test/firmware-element-sync.test.js` | unit (stubbed install) |
| AC6 — it reads like any concept | GB10 the rulebook's preamble · GF13 BIBLE §7 | both | unit (docs) |
| AC6 | GL1 summaries lists it · GL3 `graph list-elements` gives the six items | `test/graph-rule-firmware.test.js` | live (scratch) |

GF0 is a sentinel. The fixture rulebook makes its two items with no problem, so no problem case passes for the wrong reason.

## Edge cases

- [x] A field whose text goes on below its bullet, as nested bullets and a paragraph (GB4, entry 1's Enforced by).
- [x] Fields beyond the eight, in order (GB4: entry 2's Reserved, entry 3's The naming convention).
- [x] A rule with no code file (GB5 and GF0: `code` is null).
- [x] A level-2 heading that isn't an entry, such as "## Notes" (GP10).
- [x] A retired rule with no code is a good entry (GP8). A letter rule is about events (GP11).
- [x] The JSON in the graph is compared as values, with key order ignored (ES3), including a json tag held in LMDB (ES5).
- [x] JSON that can't be read is brought in line (ES6): unparseable, empty, null, an LMDB entry that is missing, and a store that throws.
- [x] Another author's element with the rule's name is never signed over (ES7, ES8).
- [x] A pubkey that only starts with the assistant's is another author (ES10).
- [x] Two of the assistant's elements with the name: the first by address decides (ES9).
- [x] No pubkey in the committed files (GF11).
- [x] Every other firmware concept: the same manifest entries in the same order, none flagged (GF6, GF7), and on a live stack untouched by a reinstall (the live check, step 3).
- [ ] An item whose entry has left the rulebook stays as it was (ADR Decision 6). No test: nothing in this story touches it, so there is no code to test. The Reviewer checks that install has no path that deletes.
- [ ] Two installs at once. Not covered: install has no lock today, and this story adds none.

## Test infrastructure

- Test framework: the gate's own runner. Each suite exports `run()` and is registered in `test/registry.js`, and each runs on its own with `node test/<file>`. **Never run the full `npm test` on the owner's Mac**, because it writes to the local agent-memory instance.
- `ajv` (already a dependency) validates each item against the concept's schema, as `ajv/dist/2020`, since the schema names draft 2020-12.
- Live checks: only with `TAPESTRY_CONTAINER` naming a scratch container whose name starts `tapestry-scratch`, through `test/helpers/scratchLoopback.js`. They skip otherwise, and refuse any other container.
- Firmware state for GL1 to GL3: a scratch stack that has run `POST /api/firmware/install` with this branch's firmware, `src/` and `docs/`. GL4 runs a second install (minutes), so it asks for `GRAPH_RULE_INSTALL=1`.
- Fixtures: inline in each suite. A two-entry rulebook (`alpha-rule` with no code, `beta-rule` with code), a fake rule declaration, and element rows under two made-up pubkeys.

## How to run

```
node test/graph-rules-builder.test.js
node test/graph-rule-firmware.test.js
node test/firmware-element-sync.test.js
```

With a scratch stack (`scripts/scratch-stack.sh`):

```
TAPESTRY_CONTAINER=tapestry-scratch node test/graph-rule-firmware.test.js
TAPESTRY_CONTAINER=tapestry-scratch GRAPH_RULE_INSTALL=1 node test/graph-rule-firmware.test.js
```

## The live check, at Implementation

On a scratch stack only, never a shared or private instance (ADR Implementation notes):

1. Install firmware on a fresh stack. Run GL1 to GL3.
2. Record each item's address and event id, and a digest of every other firmware concept's nodes, tags and relationships.
3. Change one entry's Says in the scratch copy of the rulebook, run `node src/firmware/graph-rules.js`, and install again. Only that item has a new event, at the same address, with its relationships kept. The digest of the rest is unchanged. Run GL4's comparison for the other five.
4. Add a seventh entry, with a fixture rule file, run the script, and install again. A seventh item appears.

Record what each step showed in the story's Evidence section.

## Verification

The new tests fail with the current code, because the feature isn't built: the script and the step don't exist, the concept's files don't either, and the docs lack their lines. None fails on an import of its own, a typo, or a wrong expectation of the rulebook's text. The expected texts were checked against `docs/GRAPH_RULES.md` as it stands. Confirmed on 2026-11-15 on branch `A10.41-graph-rule-concept`, at `a35fd054` plus this phase's files:

```
graph-rules-builder:   0 passed, 22 failed, 0 skipped
  FAIL  GB1 … src/firmware/graph-rules.js does not exist yet (ADR graph-operations-first-slice/0041 Decision 4)
  (GB2 to GB9, GF0 and GP1 to GP11 fail the same way)
  FAIL  GB10 … the preamble has a paragraph "In the graph" (Decision 8)
graph-rule-firmware:   0 passed, 13 failed, 4 skipped
  FAIL  GF1 … firmware/versions/v1.0.0/concepts/graph-rule/concept-header.json does not exist yet (… Decision 1)
  FAIL  GF6 … graph-rule is the last concept …; the last is "tagging-with-specific-tag"
  FAIL  GF7 … only graph-rule's entry has updateElements …; got []
  FAIL  GF8 … the first changelog entry is 1.0.0, 2026-11-15 (Decision 1); got {"version":"1.0.0","date":"2026-04-06"}
  FAIL  GF13 … the Tapestry category line lists graph-rule (Decision 8)
  SKIP  GL1 to GL4 (no scratch container)
firmware-element-sync: 0 passed, 14 failed, 0 skipped
  FAIL  ES1 … src/firmware/element-sync.js does not exist yet (… Decision 6)
  (ES2 to ES11 fail the same way)
  FAIL  IS1 … install.js requires ./element-sync (Decision 6)
  FAIL  IS2 … it takes regenerateJson and loadTAKey from the helpers (Decision 6); it takes "loadTAKey, signAndFinalize"
  FAIL  IS3 … install.js requires ../lib/neo4j-driver …
```

### Review round 1's cases (2026-11-16)

Added at Review, in a commit of their own before the fixes, for ADR 0041 Amendment 2:
- **GP12 to GP15 fail** against the round-1 code, because the parser and the first-sentence rule aren't changed yet:

  ```
  FAIL  GP12 … a --- separator between entries: a problem naming "alpha-rule"; the problems are []
  FAIL  GP13 … the heading "## 3 `gamma-rule`": a problem naming "gamma-rule"; the problems are []
  FAIL  GP14 … a field line under "## Letter rules" is a problem with rule null that names its label; got []
  FAIL  GP15 … word.description is "No beta (e.g. a superset) is below itself."; got "No beta (e.g."
  graph-rules-builder: 22 passed, 4 failed, 0 skipped
  ```

- **IS4 to IS9 pass** against the round-1 code: they pin install behaviour the review checked by hand, so a regression fails in CI (`firmware-element-sync: 20 passed, 0 failed, 0 skipped`).
