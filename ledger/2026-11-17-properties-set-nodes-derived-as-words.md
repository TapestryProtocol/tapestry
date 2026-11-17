# A concept's Properties Set node says it is a set but is derived as a word, so its tapestryJson lacks the set fields word's schema asks of a set

**Id:** 2026-11-17-properties-set-nodes-derived-as-words
**Type:** bug
**Opened:** 2026-11-17 (story graph-operations-first-slice #42's live check, on a scratch stack, LC7c)
**Status:** OPEN
**Done:** —

**What was seen.** Each concept's Properties Set core node ("the set of properties for the concept of …") has `wordTypes` `["word", "set", "propertiesSet"]`, but carries the label `ListItem` and no `Set`.
- **The deriver it gets.** The derive engine picks a deriver by label (`labelPriority`, `src/lib/tapestry-derive.js:39`), so the node gets the word deriver, which builds no `elements`, `childSets` or `parentSets`.
- **What `word`'s schema asks.** Its set conditional requires those three fields in `graphContext` whenever `wordTypes` contains `set`. So the node's tapestryJson is never fully realized, and both readers say so, in agreement.
- **How many.** On the scratch stack after a derive pass: 44 nodes, one for each concept, each with three such errors, 132 in all, and each with the set conditional's "then" error. The run before, with one concept fewer, counted 43 nodes and 129 errors.

**Why it matters now.** Since story 42, `rules check` (A10.31) would report each of them under `word`. The problem is in the deriver's choice, or in the node's labels, not in what the rule judges. `rules check` waits for this fix (the owner's ruling at story 42's review round 2, in its Open questions).

**Fix shape** (a decision for whoever takes it):
- the derive engine picks the set deriver for a node whose `wordTypes` contains `set`;
- or the Properties Set nodes carry the label `Set`;
- or the set conditional asks its set fields only of nodes labelled `Set`.

The self-ontology epic's deriver audit (anticipated story 4) and `cache rebuild` (A10.36) are natural homes.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/42-both-readers-judge-tapestryjson.md` (Evidence, the live check).
