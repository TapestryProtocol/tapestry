# On an installed instance, 247 verdicts in six concepts besides `word` fail their schemas, for causes not yet diagnosed

**Id:** 2026-11-17-six-concepts-failing-verdicts-undiagnosed
**Type:** bug
**Opened:** 2026-11-17 (story graph-operations-first-slice #42's live check, on a scratch stack, LC7b; its review round 3, non-blocking 2)
**Status:** OPEN
**Done:** —

**What was seen.** After a derive pass over all 444 list items on a scratch stack, 679 of the 1,169 cached verdicts fail. The rule's check agrees with the cache on each one (`tmp/live-check-42/report.json` in that worktree, `agreement.tally`; ignored by git).
- **Diagnosed:**
  - `word`'s 430, by the two rows below;
  - two that the live check made on purpose: runs 2 and 3 each made a Rex, and put its entry without a description. Run 1 made none.
- **Not diagnosed:** the other 247.
  - `graph`, 132 of 132;
  - `validation tool`, 44 of 44;
  - `core nodes graph`, 44 of 44;
  - `relationship`, 22 of 22;
  - `concept graph`, 3 of 44;
  - `json schema`, 2 of 44.

**What isn't known.** Why each fails: the report kept tallies, not each failing verdict's problems. One lead, unchecked: the 3 failing `concept graph` verdicts may be the live check's own three concepts, which `graph create-concept` made, one each run.

**Why it matters now.** Since story 42, the rule and the derive step judge every node's tapestryJson against the schemas the instance holds, and they agree. So `rules check` (A10.31) would report each of these, and so would the property operations' reports (A10.18).
- **`rules check` waits** for this diagnosis and the fixes it finds, as it waits for the two rows below (the owner's ruling at story 42's review round 2, in its Open questions).
- **Until the owner files its Loom task,** this row stands for it.

**Next step.**
- On a scratch stack, after a derive pass, keep each failing verdict's `errors`, and group them by concept and by cause.
- Give each cause its fix, or its own row.
- Measure on an instance, not on firmware's files, since an install changes what the schemas say (meta row `2026-11-17-instance-claims-measured-on-firmware-files`).

**Related:** `2026-11-17-word-wordtypes-conditionals-contradict-themselves` and `2026-11-17-properties-set-nodes-derived-as-words`, the causes found so far, both in `word`.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/42-both-readers-judge-tapestryjson.md` (Evidence, "The failing verdicts, by concept"; Open questions, the owner's ruling).
