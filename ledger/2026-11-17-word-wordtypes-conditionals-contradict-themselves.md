# Install's wordType conditionals on word's schema contradict themselves, so no node with a concept's key in its wordTypes fits word

**Id:** 2026-11-17-word-wordtypes-conditionals-contradict-themselves
**Type:** bug
**Opened:** 2026-11-17 (story graph-operations-first-slice #42's live check, on a scratch stack, LC1b and LC7c)
**Status:** DONE
**Done:** 2026-11-20 — story graph-operations-first-slice #46. The manifest's `concept-headers` enumeration turns `enforce-wordType-conditionals` off (`firmware/versions/v1.0.0/manifest.json:408`), so install's enumeration step no longer writes the pair for `word.wordTypes`. The allowed list and the set conditional stay. Of the fix shapes below, the one that sets `enforce-wordType-conditionals` false; the owner chose to drop the pair, since corrected it would read "if the list contains X, the list contains X" and check nothing. An instance's `word` schema changes at its next firmware reinstall, whose Pass 2 rewrites the schema from firmware's file before the enumeration step; `apply-enumerations` run alone leaves pairs already written. Those reinstalls are ledger row `2026-11-20-word-wordtypes-switch-awaits-firmware-reinstall`.

**What was seen.** Firmware's `word` schema file has one `allOf` entry (the set conditional). The schema a firmware install leaves in the graph has 83. Install adds a Forward and a Reverse conditional for each concept key that the manifest's `concept-headers` enumeration sends to `word.wordTypes` (`firmware/versions/v1.0.0/manifest.json`: `concept: "word"`, `source-path: "conceptHeader.oKeys.singular"`, `destination-path: "word.wordTypes"`, `enforce-wordType-conditionals: true`).
- **Where they come from.** `generateWordTypeConditionals` (`src/api/normalize/index.js:6048–6143` as of story graph-operations-first-slice #46; `:6029–6125` when the row was opened) was written for a concept's own scalar field, such as `dog.breed`:
  - Forward: if the field is X, `word.wordTypes` must contain X;
  - Reverse: if `word.wordTypes` contains X, the field must be X.
- **Why they contradict.** With `word.wordTypes` as the destination, the field and `wordTypes` are the same array:
  - the Reverse reads "if `wordTypes` contains X, `wordTypes` must equal X", a `const` no array meets;
  - the Forward never fires.
- **So** every node whose `wordTypes` holds a concept's key fails the installed `word` schema with "`word.wordTypes` must be equal to constant" and "must match "then" schema".

On the scratch stack after a derive pass, all 430 list items with a cached `word` verdict failed it, with 1,096 such errors, each with its "then" error. The pass's 1,140 "then" errors also count the set conditional's 44, one on each Properties Set node (ledger row `2026-11-17-properties-set-nodes-derived-as-words`). Two days earlier, OPEN.md row 219 saw the Health Audit fail on nearly every concept; this was its second dominant error.

**Why it matters now.** Story 42 made the rule and the derive step judge every node's tapestryJson against the installed schemas, and they agree. So `rules check` (A10.31) would report every element of `word` for these conditionals, and so would the property operations' reports (A10.18). `rules check` waits for this fix (the owner's ruling at story 42's review round 2, in its Open questions).

**Fix shape** (a decision for whoever takes it):
- skip the conditionals when the destination path is `word.wordTypes` itself;
- or generate an array-aware form, where the Reverse requires the concept's section rather than a `const`;
- or set `enforce-wordType-conditionals` false for that enumeration.

Each takes a firmware reinstall to reach an instance's schema.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/42-both-readers-judge-tapestryjson.md` (Evidence, the live check); `tmp/live-check-42/report.json` in that worktree (ignored by git).
