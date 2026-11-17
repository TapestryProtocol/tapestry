# A story promised what an instance would do from a fact measured on firmware's files, and an install changes what those files say

**Id:** 2026-11-17-instance-claims-measured-on-firmware-files
**Type:** meta
**Opened:** 2026-11-17 (story `graph-operations-first-slice` #42's review round 2, harness friction 2)
**Status:** OPEN
**Done:** —

**What was seen.** Story 42's planning measured "firmware's elements fail `word`'s schema, each only for `graphContext`" (its Background; ADR 0020a's fact 6) on firmware's element files, against firmware's `word` file. On that measurement the story promised that the elements of `word` stop reading as broken.
- **What an install leaves.** The `word` schema a firmware install leaves in the graph has 83 `allOf` entries where the file has one. Install adds a pair of wordType conditionals for each concept key the manifest's `concept-headers` enumeration sends to `word.wordTypes`, and those conditionals fail every element (ledger row `2026-11-17-word-wordtypes-conditionals-contradict-themselves`).
- **What found it.** Only the live check, at review round 1's request, after the ADR, the tests and the code were done. The owner then narrowed three of the story's promises at review round 2.

**Why it matters.** A fact measured on firmware's files reads as true of an instance, but install, normalization and the derive step change what an instance holds. A promise about an instance built on such a fact can be wrong before any code is written, with every stack-free test green.

**Fix shape.**
- **Measure on an instance.** A story's or an ADR's claim about what an instance does is measured on one: a scratch stack (`scripts/scratch-stack.sh`) where the local one is precious. Firmware's files alone don't support it.
- **Say where each number came from.** Planning names the source of each measured fact: firmware's files, a scratch stack, or a named instance on a date. A reader can then tell a file's fact from an instance's.
- **A home for it:** workflow 1's or workflow 2's grounding steps, beside AGENTS.md's orientation ladder.

**Another occurrence, 2026-11-17 (story 42's review round 3, harness friction 1).**
- **What it was.** AC1's example said a node with its `graphContext` "fits firmware's `word` schema". That is the claim AC3's first case made, from the same measurement on firmware's file.
- **Why the narrowing missed it.** Round 2's ask listed the promises to narrow from a reading of the story, and missed this one. Round 3 caught it by checking the rewording as a claim of its own.
- **A search finds more.** Round 4 searched for the narrowed phrases, and found two more, in ADR 0042's and ADR 0020a's live-check notes.
- **Fix shape, added:** an ask to narrow a story's promises quotes a search of the story and its ADRs for each narrowed phrase, so its list is complete.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/42-both-readers-judge-tapestryjson.md` (round 2, Harness friction 2; round 3, Harness friction 1); `engineering-team/stories/graph-operations-first-slice/42-both-readers-judge-tapestryjson.md` (Background; Open questions, the owner's ruling).
